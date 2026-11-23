import { Hono } from "hono";
import { ZodError } from "zod";
import { TransitionError } from "@adripatina/domain";
import { newId } from "@adripatina/shared";
import type { Ctx } from "./context.js";
import type { AccessVerifier } from "./ports.js";
import type { User } from "./repos/users.js";
import { adminRoutes } from "./admin/routes.js";
import { requireAdmin } from "./admin/access.js";
import { DomainError } from "./services/quotes.js";
import { processUpdate, verifyTelegramSecret } from "./telegram/webhook.js";

export interface AppEnv {
  Variables: {
    ctx: Ctx;
    admin: User;
    accessVerifier: AccessVerifier | null;
  };
}

export interface AppDeps {
  makeCtx: (requestId: string) => Ctx;
  accessVerifier: AccessVerifier | null;
  telegramWebhookSecret: string | undefined;
  /** executa trabalho após responder (ctx.waitUntil em produção) */
  defer?: (p: Promise<unknown>) => void;
}

/** Limite simples por janela (por isolate) — complementa o rate limiting da Cloudflare. */
const buckets = new Map<string, { count: number; resetAt: number }>();
function rateLimited(key: string, max: number, windowMs: number, now: number): boolean {
  const b = buckets.get(key);
  if (!b || b.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }
  b.count++;
  return b.count > max;
}

export function createApp(deps: AppDeps): Hono<AppEnv> {
  const app = new Hono<AppEnv>();

  app.use("*", async (c, next) => {
    const requestId = c.req.header("cf-ray") ?? newId();
    c.set("ctx", deps.makeCtx(requestId));
    c.set("accessVerifier", deps.accessVerifier);
    await next();
    c.header("x-request-id", requestId);
    c.header("x-content-type-options", "nosniff");
    c.header("referrer-policy", "no-referrer");
    c.header("x-frame-options", "DENY");
  });

  app.onError((err, c) => {
    if (err instanceof ZodError) return c.json({ error: { code: "VALIDATION", message: "Dados inválidos.", issues: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })) } }, 422);
    if (err instanceof DomainError) return c.json({ error: { code: err.code, message: err.message } }, err.status as 400);
    if (err instanceof TransitionError) return c.json({ error: { code: "INVALID_TRANSITION", message: err.message } }, 409);
    if (err instanceof SyntaxError) return c.json({ error: { code: "BAD_JSON", message: "JSON inválido." } }, 400);
    console.error(JSON.stringify({ level: "error", msg: "unhandled", requestId: c.get("ctx")?.requestId, name: err.name }));
    return c.json({ error: { code: "INTERNAL", message: "Erro interno." } }, 500);
  });

  // saúde sem segredos
  app.get("/api/v1/health", (c) => c.json({ ok: true, service: "adripatina", time: new Date().toISOString() }));

  app.post("/api/v1/telegram/webhook", async (c) => {
    if (!verifyTelegramSecret(c.req.header("X-Telegram-Bot-Api-Secret-Token"), deps.telegramWebhookSecret)) {
      return c.json({ ok: false }, 401);
    }
    const ctx = c.get("ctx");
    // limite estourado: 429 faz o Telegram reenviar depois (antes respondia 200 e a mensagem se perdia)
    if (rateLimited("telegram", 120, 60_000, ctx.clock().getTime())) return c.json({ ok: false, throttled: true }, 429);
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ ok: false }, 400);
    }
    const outcome = await processUpdate(ctx, body);
    // sempre 200 para o Telegram não reenviar indefinidamente (deduplicação já protege)
    return c.json({ ok: true, outcome });
  });

  // API administrativa — toda rota exige ADMIN autenticado via Cloudflare Access
  const admin = new Hono<AppEnv>();
  admin.use("*", requireAdmin());
  admin.use("*", async (c, next) => {
    const ctx = c.get("ctx");
    const method = c.req.method;
    if (method !== "GET") {
      // proteção CSRF: mutações exigem JSON e mesma origem
      const ct = c.req.header("content-type") ?? "";
      const origin = c.req.header("origin");
      const host = c.req.header("host");
      if (!ct.includes("application/json") && c.req.header("content-length") !== "0" && c.req.header("content-length") !== undefined) {
        return c.json({ error: { code: "UNSUPPORTED_MEDIA", message: "Use application/json." } }, 415);
      }
      if (origin && host && new URL(origin).host !== host) return c.json({ error: { code: "CSRF", message: "Origem não permitida." } }, 403);
      if (rateLimited(`admin:${c.get("admin").id}`, 120, 60_000, ctx.clock().getTime())) return c.json({ error: { code: "RATE_LIMIT", message: "Muitas operações. Aguarde um pouco." } }, 429);
    }
    await next();
  });
  admin.route("/", adminRoutes());
  app.route("/api/v1/admin", admin);

  app.all("/api/*", (c) => c.json({ error: { code: "NOT_FOUND", message: "Rota não encontrada." } }, 404));
  return app;
}
