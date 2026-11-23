import { newId } from "@adripatina/shared";
import { createApp } from "./app.js";
import { createAccessVerifier } from "./admin/access.js";
import { createAiProviders } from "./ai/providers.js";
import type { Ctx } from "./context.js";
import { runScheduled } from "./cron.js";
import { Db } from "./db/sql.js";
import { loadConfig, type Env } from "./env.js";
import { LiveTelegramClient, MissingTokenTelegramClient, MockTelegramClient } from "./telegram/client.js";
import type { TelegramClient } from "./ports.js";

function buildCtx(env: Env, requestId: string): Ctx {
  const config = loadConfig(env);
  let telegram: TelegramClient;
  if (config.telegramMode === "live") {
    // sem token, o Worker continua de pé (health, painel); só falha ao tentar falar com o Telegram
    telegram = env.TELEGRAM_BOT_TOKEN ? new LiveTelegramClient(env.TELEGRAM_BOT_TOKEN) : new MissingTokenTelegramClient();
  } else {
    telegram = new MockTelegramClient(config.environment === "local");
  }
  return {
    db: new Db(env.DB),
    config,
    clock: () => new Date(),
    telegram,
    storage: env.FILES,
    ai: createAiProviders(config, env.AI, env.ANTHROPIC_API_KEY),
    requestId,
  };
}

export default {
  async fetch(request: Request, env: Env, execCtx: ExecutionContext): Promise<Response> {
    const config = loadConfig(env);
    const app = createApp({
      makeCtx: (rid) => buildCtx(env, rid),
      accessVerifier: createAccessVerifier(config),
      telegramWebhookSecret: env.TELEGRAM_WEBHOOK_SECRET,
      defer: (p) => execCtx.waitUntil(p),
    });
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) return app.fetch(request, env, execCtx);
    // painel estático (Workers Static Assets)
    if (env.ASSETS) return env.ASSETS.fetch(request);
    return new Response("Painel não compilado. Rode: pnpm build", { status: 404 });
  },

  async scheduled(_event: ScheduledController, env: Env, execCtx: ExecutionContext): Promise<void> {
    const ctx = buildCtx(env, `cron-${newId()}`);
    execCtx.waitUntil(
      runScheduled(ctx).then(
        (r) => console.info(JSON.stringify({ level: "info", msg: "cron_done", result: r })),
        (e) => console.error(JSON.stringify({ level: "error", msg: "cron_failed", error: e instanceof Error ? e.name : "unknown" })),
      ),
    );
  },
} satisfies ExportedHandler<Env>;
