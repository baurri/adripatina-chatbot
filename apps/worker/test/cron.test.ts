import { describe, expect, it } from "vitest";
import { count, createHarness } from "./harness.js";
import { runScheduled, purgeExpiredMedia } from "../src/cron.js";
import { enqueueOutbox, processOutbox } from "../src/services/outbox.js";

describe("Cron, lembretes e retenção", () => {
  it("resumo diário sai uma única vez por dia, no horário configurado", async () => {
    const h = await createHarness();
    await h.send("Peguei uma cristaleira da dona Maria para fazer pátina");
    h.clock.now = new Date("2026-11-17T10:05:00Z"); // 07:05 em São Paulo
    h.telegram.clear();
    await runScheduled(h.ctx);
    await runScheduled(h.ctx);
    const summaries = h.telegram.sent.filter((s) => /resumo de hoje/.test(s.text ?? ""));
    expect(summaries).toHaveLength(1);
    expect(summaries[0]!.text).toMatch(/Cristaleira — Dona Maria/);
    h.clock.now = new Date("2026-11-17T15:00:00Z");
    h.telegram.clear();
    await runScheduled(h.ctx);
    expect(h.telegram.sent.filter((s) => /resumo de hoje/.test(s.text ?? ""))).toHaveLength(0);
  });

  it("outbox é idempotente e refaz entregas que falharam com backoff", async () => {
    const h = await createHarness();
    await h.send("/start"); // artesão registra chat
    await enqueueOutbox(h.ctx, "telegram_message", { chatId: "1001", text: "teste" }, "k1");
    await enqueueOutbox(h.ctx, "telegram_message", { chatId: "1001", text: "teste" }, "k1");
    expect(await count(h, "SELECT COUNT(*) AS n FROM outbox_events")).toBe(1);
    const original = h.telegram.sendMessage.bind(h.telegram);
    h.telegram.sendMessage = async () => {
      throw new Error("Telegram fora do ar");
    };
    const r1 = await processOutbox(h.ctx);
    expect(r1.failed).toBe(1);
    h.telegram.sendMessage = original;
    expect((await processOutbox(h.ctx)).sent).toBe(0); // ainda no backoff
    h.clock.now = new Date(h.clock.now.getTime() + 10 * 60_000);
    expect((await processOutbox(h.ctx)).sent).toBe(1);
  });

  it("mídias com retenção vencida são apagadas do R2", async () => {
    const h = await createHarness();
    await h.bucket.put("audio/x.ogg", new Uint8Array([1, 2, 3]));
    await h.ctx.db.run(
      "INSERT INTO attachments (id, r2_key, mime, size_bytes, classification, retention_until, created_at) VALUES ('a1', 'audio/x.ogg', 'audio/ogg', 3, 'audio', '2026-01-01T00:00:00Z', '2025-01-01T00:00:00Z')",
    );
    expect(await purgeExpiredMedia(h.ctx)).toBe(1);
    expect(h.bucket.objects.has("audio/x.ogg")).toBe(false);
    expect(await count(h, "SELECT COUNT(*) AS n FROM attachments WHERE deleted_at IS NOT NULL")).toBe(1);
  });

  it("foto do móvel é guardada no projeto e foto repetida não é duplicada", async () => {
    const h = await createHarness();
    await h.send("Peguei uma cristaleira da dona Maria para fazer pátina");
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]);
    const r = await h.photo(jpeg);
    expect(h.allText(r)).toMatch(/Guardei a foto na cristaleira/);
    const again = await h.photo(jpeg);
    expect(h.allText(again)).toMatch(/já tinha guardado/);
    expect(await count(h, "SELECT COUNT(*) AS n FROM attachments WHERE job_id IS NOT NULL AND deleted_at IS NULL")).toBe(1);
    const bad = await h.photo(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9]));
    expect(h.allText(bad)).toMatch(/Não consegui abrir/);
  });
});
