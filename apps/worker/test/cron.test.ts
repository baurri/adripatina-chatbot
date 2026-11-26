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

describe("Bom dia (07h30) e boa noite (23h10)", () => {
  it("manda uma vez por dia em cada horário, com o lembrete de chamar o assistente", async () => {
    const { greetingDue } = await import("../src/services/greetings.js");
    const h = await createHarness();
    await h.send("/start");
    h.telegram.clear();
    h.clock.now = new Date("2026-11-17T10:15:00Z"); // 07:15 — ainda não
    await runScheduled(h.ctx);
    expect(h.telegram.sent.filter((s) => /^Bom dia/.test(s.text ?? ""))).toHaveLength(0);
    h.clock.now = new Date("2026-11-17T10:30:00Z"); // 07:30
    await runScheduled(h.ctx);
    h.clock.now = new Date("2026-11-17T10:45:00Z"); // 07:45 — não repete
    await runScheduled(h.ctx);
    const morning = h.telegram.sent.filter((s) => /^Bom dia/.test(s.text ?? ""));
    expect(morning).toHaveLength(1);
    expect(morning[0]!.text).toMatch(/or[çc]amento/);
    h.clock.now = new Date("2026-11-18T02:10:00Z"); // 23:10 do dia 17
    await runScheduled(h.ctx);
    h.clock.now = new Date("2026-11-18T02:15:00Z"); // 23:15 — não repete
    await runScheduled(h.ctx);
    const night = h.telegram.sent.filter((s) => /^Boa noite/.test(s.text ?? ""));
    expect(night).toHaveLength(1);
    expect(night[0]!.text).toMatch(/descans/i);
    expect(night[0]!.text).toMatch(/me chamar|me manda|ajuda/);
    expect(h.telegram.sent.some((s) => s.kind === "sticker")).toBe(false); // sem pacote, sem figurinha
    expect(greetingDue(new Date("2026-11-18T02:09:00Z"))).toBeNull();
    // dia seguinte, de novo
    h.clock.now = new Date("2026-11-18T10:30:00Z");
    await runScheduled(h.ctx);
    expect(h.telegram.sent.filter((s) => /^Bom dia/.test(s.text ?? ""))).toHaveLength(2);
  });

  it("com pacote de figurinhas, vai uma figurinha sorteada antes do texto; pacote inválido não impede o texto", async () => {
    const h = await createHarness();
    await h.send("/start");
    h.telegram.clear();
    h.telegram.stickerSets.set("BomDiaPack", ["stk1", "stk2"]);
    h.ctx.config.stickersMorning = ["BomDiaPack"];
    h.ctx.config.stickersNight = ["NaoExiste"];
    h.clock.now = new Date("2026-11-17T10:30:00Z");
    await runScheduled(h.ctx);
    const i = h.telegram.sent.findIndex((s) => s.kind === "sticker");
    expect(i).toBeGreaterThanOrEqual(0);
    expect(["stk1", "stk2"]).toContain(h.telegram.sent[i]!.text);
    expect(h.telegram.sent[i + 1]!.text).toMatch(/^Bom dia/);
    h.telegram.clear();
    h.clock.now = new Date("2026-11-18T02:10:00Z");
    await runScheduled(h.ctx);
    expect(h.telegram.sent.some((s) => s.kind === "sticker")).toBe(false);
    expect(h.telegram.sent.filter((s) => /^Boa noite/.test(s.text ?? ""))).toHaveLength(1);
  });

  it("dá pra desligar (GREETINGS=false)", async () => {
    const h = await createHarness();
    await h.send("/start");
    h.telegram.clear();
    h.ctx.config.greetings = false;
    h.clock.now = new Date("2026-11-17T10:30:00Z");
    await runScheduled(h.ctx);
    expect(h.telegram.sent.filter((s) => /^Bom dia/.test(s.text ?? ""))).toHaveLength(0);
  });
});

describe("Piadinha do dia (quando não há nada pra perguntar)", () => {
  const at = (day: string, hour: number) => new Date(`${day}T${String(hour + 3).padStart(2, "0")}:05:00Z`); // hora de Brasília

  it("uma por dia, no horário sorteado, sem repetir a do dia anterior; nunca no meio de conversa; não sai com pergunta aberta", async () => {
    const { jokeHour, JOKES } = await import("../src/services/jokes.js");
    const h = await createHarness();
    await h.send("/start");
    const day = "2026-11-17";
    const hr = jokeHour(day);
    expect(hr).toBeGreaterThanOrEqual(10);
    expect(hr).toBeLessThanOrEqual(17);
    const isJoke = (t?: string) => JOKES.some((j) => (t ?? "").includes(j.text.replace(/^Adriano, /, "")));
    h.telegram.clear();
    if (hr > 10) {
      h.clock.now = at(day, hr - 1);
      await runScheduled(h.ctx);
      expect(h.telegram.sent.filter((s) => isJoke(s.text))).toHaveLength(0); // antes da hora do dia
    }
    h.clock.now = at(day, hr);
    await runScheduled(h.ctx);
    await runScheduled(h.ctx);
    const first = h.telegram.sent.filter((s) => isJoke(s.text));
    expect(first).toHaveLength(1);
    // dia seguinte: outra piada (não repete), mas não se ele acabou de conversar
    const next = "2026-11-18";
    h.clock.now = new Date(at(next, jokeHour(next)).getTime() - 30 * 60_000);
    await h.send("oi");
    h.clock.now = at(next, jokeHour(next));
    h.telegram.clear();
    await runScheduled(h.ctx);
    expect(h.telegram.sent.filter((s) => isJoke(s.text))).toHaveLength(0);
    h.clock.now = at(next, 17);
    await runScheduled(h.ctx);
    const second = h.telegram.sent.filter((s) => isJoke(s.text));
    expect(second).toHaveLength(1);
    expect(second[0]!.text).not.toBe(first[0]!.text);
  });

  it("sorteio respeita as últimas e dá mais peso às que ele adora", async () => {
    const { pickJoke, JOKES } = await import("../src/services/jokes.js");
    expect(pickJoke([], 0)).toBe(0); // "você pinta como eu pinto?" tem o maior peso
    expect(pickJoke([0], 0)).toBe(1);
    expect(pickJoke(JOKES.map((_, i) => i), 0)).toBe(0); // todas recentes: volta pro começo
  });

  it("com pergunta de coleta aberta, não manda piada", async () => {
    const { jokeHour } = await import("../src/services/jokes.js");
    const h = await createHarness();
    await h.send("/start");
    const u = await h.ctx.db.first<{ id: string }>("SELECT id FROM users WHERE telegram_chat_id IS NOT NULL LIMIT 1");
    await h.ctx.db.run("INSERT INTO data_collection_requests (id, user_id, need_kind, reason, entity_type, entity_id, entity_key, entity_label, dedupe_key, status, priority, attempts, correlation_id, created_at, updated_at) VALUES ('r1', ?, 'material_price', 'x', 'material', 'm1', 'k', 'lixa', 'd1', 'queued', 1, 0, 'c1', ?, ?)", u!.id, "2026-11-17T00:00:00Z", "2026-11-17T00:00:00Z");
    h.ctx.config.proactiveMode = "off";
    h.clock.now = at("2026-11-17", 17);
    h.telegram.clear();
    void jokeHour;
    await runScheduled(h.ctx);
    expect(h.telegram.sent).toHaveLength(0);
  });
});
