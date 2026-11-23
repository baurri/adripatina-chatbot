import { expect } from "vitest";
import { inflateSync } from "node:zlib";
import { ADMIN_EMAIL, ADMIN_TG, type Harness } from "./harness.js";
import type { AccessVerifier } from "../src/ports.js";

export const fakeVerifier: AccessVerifier = {
  async verify(token: string) {
    if (token === "jwt-admin") return { email: ADMIN_EMAIL };
    if (token === "jwt-outsider") return { email: "outsider@exemplo.local" };
    throw new Error("assinatura inválida");
  },
};

export async function api(h: Harness, method: string, path: string, body?: unknown, token = "jwt-admin", env: "test" | "production" = "test") {
  const res = await h.app(fakeVerifier, env).request(`/api/v1/admin${path}`, {
    method,
    headers: { "Cf-Access-Jwt-Assertion": token, ...(body !== undefined ? { "content-type": "application/json" } : {}) },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const ct = res.headers.get("content-type") ?? "";
  return { status: res.status, json: ct.includes("json") ? ((await res.json()) as Record<string, unknown>) : null, res };
}

export function pdfText(bytes: Uint8Array): string {
  const raw = Buffer.from(bytes).toString("latin1");
  let out = raw;
  const re = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw))) {
    try {
      out += inflateSync(Buffer.from(m[1]!, "latin1")).toString("latin1");
    } catch {
      /* ignore */
    }
  }
  return out.replace(/<([0-9A-Fa-f]+)>/g, (_, hex: string) => (hex.match(/../g) ?? []).map((x) => String.fromCharCode(parseInt(x, 16))).join(""));
}

/** Conversa completa do artesão até o pedido de cálculo. */
export async function artisanCreatesQuote(h: Harness): Promise<string> {
  await h.send("/start", ADMIN_TG); // admin registra chat para notificações
  await h.send("Peguei uma cristaleira da dona Maria para fazer pátina");
  await h.click("ans:bom");
  await h.send("1,80 de altura, 1 metro de largura e 40 de fundura");
  await h.click("ans:externa");
  await h.click("ans:nao"); // reparos
  await h.click("ans:pincel");
  // terceiros, material, prazo e pagamento não mudam o preço: não são perguntados antes do orçamento
  const summary = await h.click("ans:nenhum");
  expect(h.allText(summary)).toMatch(/pode calcular/);
  return (await h.ctx.db.first<{ id: string }>("SELECT id FROM jobs"))!.id;
}

