import { describe, expect, it } from "vitest";
import { processUpdate } from "../src/telegram/webhook.js";
import { processOutbox } from "../src/services/outbox.js";
import { count, createHarness, type Harness } from "./harness.js";
import { api } from "./helpers.js";

const NEWCOMER = 5550001;

async function hello(h: Harness, from: number, updateId: number, name = "Adriano") {
  await processUpdate(h.ctx, {
    update_id: updateId,
    message: { message_id: updateId, from: { id: from, first_name: name, username: "adri" }, chat: { id: from, type: "private" }, date: 0, text: "oi" },
  });
}

describe("Pedidos de acesso ao bot", () => {
  it("desconhecido que escreve vira pedido pendente, sem ganhar acesso", async () => {
    const h = await createHarness();
    await hello(h, NEWCOMER, 900);
    await hello(h, NEWCOMER, 901);
    const list = await api(h, "GET", "/access-requests");
    const rows = list.json!.rows as { id: string; first_name: string; attempts: number; telegram_user_id: string }[];
    expect(rows).toHaveLength(1);
    expect(rows[0]!.first_name).toBe("Adriano");
    expect(rows[0]!.attempts).toBe(2);
    expect(rows[0]!.telegram_user_id).toBe(String(NEWCOMER));
    expect(await count(h, "SELECT COUNT(*) AS n FROM users WHERE telegram_user_id = ?", String(NEWCOMER))).toBe(0);
    expect(await count(h, "SELECT COUNT(*) AS n FROM jobs")).toBe(0);
    const dash = await api(h, "GET", "/dashboard/summary");
    expect((dash.json!.summary as { pendingAccessRequests: number }).pendingAccessRequests).toBe(1);
  });

  it("aprovar como artesão libera o bot e avisa a pessoa no Telegram", async () => {
    const h = await createHarness();
    await hello(h, NEWCOMER, 900);
    const id = ((await api(h, "GET", "/access-requests")).json!.rows as { id: string }[])[0]!.id;
    const bad = await api(h, "POST", `/access-requests/${id}/approve`, { mode: "new", role: "ARTESAO", displayName: "" });
    expect(bad.status).toBe(422);
    const ok = await api(h, "POST", `/access-requests/${id}/approve`, { mode: "new", role: "ARTESAO", displayName: "Adriano Silva" });
    expect(ok.status).toBe(201);
    h.telegram.clear();
    await processOutbox(h.ctx);
    expect(h.telegram.sent.some((s) => s.chatId === String(NEWCOMER) && /acesso foi liberado/.test(s.text ?? ""))).toBe(true);
    // agora o bot atende normalmente
    const n = h.telegram.sent.length;
    await processUpdate(h.ctx, { update_id: 950, message: { message_id: 950, from: { id: NEWCOMER }, chat: { id: NEWCOMER, type: "private" }, date: 0, text: "/start" } });
    expect(h.telegram.sent.slice(n).map((s) => s.text).join(" ")).toMatch(/Adriano! Que bom/);
    expect(await count(h, "SELECT COUNT(*) AS n FROM audit_events WHERE action = 'access_request.approve'")).toBe(1);
    // aprovar de novo não é possível
    expect((await api(h, "POST", `/access-requests/${id}/approve`, { mode: "new", role: "ARTESAO", displayName: "X Y" })).status).toBe(422);
  });

  it("vincular o Telegram ao administrador já cadastrado no painel (sem duplicar usuário)", async () => {
    const h = await createHarness();
    await h.ctx.db.run("UPDATE users SET telegram_user_id = NULL WHERE id = ?", h.adminId);
    await hello(h, 7770001, 900, "Baurri");
    const id = ((await api(h, "GET", "/access-requests")).json!.rows as { id: string }[])[0]!.id;
    const r = await api(h, "POST", `/access-requests/${id}/approve`, { mode: "link", userId: h.adminId });
    expect(r.status).toBe(201);
    const admin = await h.ctx.db.first<{ telegram_user_id: string; role: string }>("SELECT telegram_user_id, role FROM users WHERE id = ?", h.adminId);
    expect(admin).toEqual({ telegram_user_id: "7770001", role: "ADMIN" });
    expect(await count(h, "SELECT COUNT(*) AS n FROM users")).toBe(2);
  });

  it("recusar mantém sem acesso; usuário desativado não gera novo pedido", async () => {
    const h = await createHarness();
    await hello(h, NEWCOMER, 900);
    const id = ((await api(h, "GET", "/access-requests")).json!.rows as { id: string }[])[0]!.id;
    expect((await api(h, "POST", `/access-requests/${id}/reject`, {})).status).toBe(200);
    await hello(h, NEWCOMER, 901);
    expect(((await api(h, "GET", "/access-requests")).json!.rows as unknown[]).length).toBe(0);
    expect(await count(h, "SELECT COUNT(*) AS n FROM users WHERE telegram_user_id = ?", String(NEWCOMER))).toBe(0);
    await h.ctx.db.run("UPDATE users SET active = 0 WHERE id = ?", h.artisanId);
    await h.send("oi");
    expect(await count(h, "SELECT COUNT(*) AS n FROM access_requests WHERE telegram_user_id = '1001'")).toBe(0);
  });

  it("rotas de pedidos exigem administrador autenticado", async () => {
    const h = await createHarness();
    expect((await api(h, "GET", "/access-requests", undefined, "")).status).toBe(401);
  });
});
