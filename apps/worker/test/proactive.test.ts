import { describe, expect, it } from "vitest";
import { buttonsOf, count, createHarness, type Harness } from "./harness.js";
import { api } from "./helpers.js";
import { createUser } from "../src/repos/users.js";
import { runProactiveCollection } from "../src/services/proactive/job.js";
import { saveProactiveSettings } from "../src/services/proactive/settings.js";
import { runScheduled } from "../src/cron.js";

/**
 * Coleta proativa — integração ponta a ponta: cron/job → Telegram → resposta → banco → painel.
 * Relógio do harness: segunda 16/11/2026 10:00 em São Paulo (13:00 UTC).
 */

const MON_10 = "2026-11-16T13:00:00Z";
const TUE_10 = "2026-11-17T13:00:00Z";
const WED_10 = "2026-11-18T13:00:00Z";

/** Catálogo "limpo": tudo com preço real recente e estoque conferido — só o que o teste mexer vira necessidade. */
async function base(settings: Record<string, unknown> = {}): Promise<Harness> {
  const h = await createHarness();
  await h.calibrateAndPrice();
  await h.ctx.db.run("UPDATE materials SET origin = 'telegram_confirmed', stock_checked_at = ?", MON_10);
  // vínculo Telegram do artesão (normalmente gravado na primeira mensagem)
  await h.ctx.db.run("UPDATE users SET telegram_chat_id = telegram_user_id WHERE role = 'ARTESAO'");
  h.ctx.config = { ...h.ctx.config, proactiveMode: "live" };
  await saveProactiveSettings(h.ctx, { enabled: true, ...settings }, "teste");
  return h;
}

function at(h: Harness, iso: string): void {
  h.clock.now = new Date(iso);
}

function messages(h: Harness): string[] {
  return h.telegram.sent.filter((s) => s.kind === "message").map((s) => s.text ?? "");
}

async function lastRequest(h: Harness) {
  return h.ctx.db.first<{ id: string; status: string; priority: number; priority_reasons_json: string; attempts: number; next_allowed_at: string | null; need_kind: string; result_json: string | null; origin: string }>(
    "SELECT * FROM data_collection_requests ORDER BY created_at DESC, rowid DESC LIMIT 1",
  );
}

async function events(h: Harness, requestId: string): Promise<string[]> {
  return (await h.ctx.db.all<{ kind: string }>("SELECT kind FROM data_collection_events WHERE request_id = ? ORDER BY created_at, rowid", requestId)).map((e) => e.kind);
}

/** Orçamento de verniz que travou no preço; Adriano pediu para continuar depois. */
async function blockedVarnishQuote(h: Harness): Promise<void> {
  await h.ctx.db.run("UPDATE materials SET replacement_price_cents = NULL, price_updated_at = NULL, origin = 'demo_only' WHERE key = 'verniz'");
  await h.send("Peguei uma mesa da dona Ana para envernizar");
  for (const t of ["está boa", "1 metro de largura, 80 de altura e 60 de fundura", "não", "pincel", "não precisa"]) await h.send(t);
  await h.click("calc:yes");
  await h.click("mp:later");
}

describe("Cenário 1 — verniz sem preço trava um orçamento", () => {
  it("detecta, pergunta, entende 'uns 85 reais' + '1 litro', salva aproximado, retoma o orçamento e não repete no dia seguinte", async () => {
    const h = await base();
    await blockedVarnishQuote(h);
    const before = messages(h).length;

    at(h, TUE_10);
    const rep = await runProactiveCollection(h.ctx);
    expect(rep.users[0]!.sent).toBe(true);
    const ask = messages(h).slice(before);
    expect(ask).toHaveLength(1);
    expect(ask[0]).toMatch(/^Oi, Adriano! 🎨\n\nQuero continuar o orçamento da mesa da Dona Ana, mas preciso atualizar o preço do verniz\.\n\nQuanto está custando a lata que você costuma comprar\?$/);

    const req = (await lastRequest(h))!;
    expect(req).toMatchObject({ status: "waiting_response", need_kind: "material_price", origin: "quote_blocker", attempts: 1 });
    expect(req.priority).toBeGreaterThanOrEqual(90);
    expect(JSON.parse(req.priority_reasons_json).join(" ")).toMatch(/Orçamento em andamento travado/);

    // 27/28/29: resposta contextual (não vira gasto nem pagamento)
    const r1 = await h.send("Uns 85 reais.");
    expect(h.allText(r1)).toBe("Perfeito, anotei cerca de R$ 85,00. 💰\n\nEssa lata é de quantos litros?");
    expect(await count(h, "SELECT COUNT(*) AS n FROM expenses")).toBe(0);
    expect((await lastRequest(h))!.status).toBe("partially_answered");

    const quotesBefore = await count(h, "SELECT COUNT(*) AS n FROM quotes");
    const r2 = await h.send("1 litro.");
    const t2 = h.allText(r2);
    expect(t2).toMatch(/Obrigado! Atualizei o preço do verniz\. 🎨\n\nAgora já consigo continuar o orçamento da mesa da Dona Ana\./);

    // 34/35/36/37/38: valor salvo, aproximado, histórico com anterior, origem e usuário
    const m = await h.ctx.db.first<{ replacement_price_cents: number; package_size: string; price_is_estimate: number; origin: string; calibrated: number }>("SELECT * FROM materials WHERE key = 'verniz'");
    expect(m).toMatchObject({ replacement_price_cents: 8500, package_size: "1", price_is_estimate: 1, origin: "telegram_proactive" });
    const hist = await h.ctx.db.first<{ previous_price_cents: number | null; is_estimate: number; source: string; recorded_by: string; message_id: string | null; collection_request_id: string }>(
      "SELECT h.* FROM material_price_history h JOIN materials m ON m.id = h.material_id WHERE m.key = 'verniz' ORDER BY recorded_at DESC LIMIT 1",
    );
    expect(hist).toMatchObject({ previous_price_cents: null, is_estimate: 1, source: "telegram_proactive", recorded_by: h.artisanId, collection_request_id: req.id });
    expect(hist!.message_id).toBeTruthy();
    expect(await count(h, "SELECT COUNT(*) AS n FROM audit_events WHERE action = 'material.price_from_proactive'")).toBe(1);

    // 14/41/42: solicitação concluída e orçamento recalculado
    const done = (await lastRequest(h))!;
    expect(done.status).toBe("resolved");
    expect(JSON.parse(done.result_json!)).toMatchObject({ newPriceCents: 8500, packageSize: "1", approximate: true });
    // 42: orçamento recalculado sem a trava de preço
    expect(await count(h, "SELECT COUNT(*) AS n FROM quotes")).toBeGreaterThanOrEqual(quotesBefore);
    const q = await h.ctx.db.first<{ result_json: string }>("SELECT result_json FROM quotes ORDER BY updated_at DESC LIMIT 1");
    expect(JSON.stringify(JSON.parse(q!.result_json).blockers)).not.toMatch(/MATERIAL_PRICE_MISSING/);
    expect(r2.length).toBeGreaterThan(1); // agradecimento + orçamento apresentado
    expect(await events(h, req.id)).toEqual(["detected", "sent", "answer", "partial", "answer", "applied", "quote_resumed"]);

    // 18: não pergunta de novo o mesmo preço no dia seguinte
    const n = messages(h).length;
    at(h, WED_10);
    await runProactiveCollection(h.ctx);
    expect(messages(h).slice(n).join("\n")).not.toMatch(/verniz/);

    // 17/55: painel mostra a sequência e o aprendizado
    const detail = await api(h, "GET", `/proactive/requests/${req.id}`);
    expect(detail.status).toBe(200);
    const d = detail.json as { request: { status_label: string; created_at_br: string; priority_reasons: string[] }; events: { label: string }[]; prices: unknown[]; messages: unknown[] };
    expect(d.request.status_label).toBe("Concluída");
    expect(d.request.created_at_br).toBe("17/11/2026");
    expect(d.events.map((e) => e.label)).toContain("Orçamento retomado com o novo dado");
    expect(d.prices).toHaveLength(1);
    expect(d.messages.length).toBeGreaterThanOrEqual(3);
  });

  it("33. 'comprei duas latas por 150' → confirma total → pergunta tamanho → salva preço por lata", async () => {
    const h = await base();
    await blockedVarnishQuote(h);
    at(h, TUE_10);
    await runProactiveCollection(h.ctx);
    const c = await h.send("Comprei duas latas por 150");
    expect(h.allText(c)).toMatch(/^Entendi: foram 2 latas por R\$ 150,00 no total, certo\?/);
    expect((await lastRequest(h))!.status).toBe("waiting_confirmation");
    const s = await h.send("sim");
    expect(h.allText(s)).toMatch(/cada uma saiu por R\$ 75,00\. 💰\n\nEssa lata é de quantos litros\?/);
    await h.send("3,6 litros");
    const m = await h.ctx.db.first<{ replacement_price_cents: number; package_size: string; price_is_estimate: number }>("SELECT * FROM materials WHERE key = 'verniz'");
    expect(m).toMatchObject({ replacement_price_cents: 7500, package_size: "3.6", price_is_estimate: 0 });
  });
});

describe("Cenário 2 — estoque de lixa desatualizado", () => {
  it("pergunta em horário permitido, registra estimativa de 12 sem fingir precisão e respeita o limite diário", async () => {
    const h = await base();
    await h.ctx.db.run("UPDATE materials SET stock_checked_at = ? WHERE key = 'lixa'", "2026-09-01T12:00:00Z");
    await h.ctx.db.run("UPDATE materials SET stock_checked_at = ? WHERE key = 'cera'", "2026-09-01T12:00:00Z");
    // sábado 7h: fora do horário → nada
    at(h, "2026-11-14T10:00:00Z");
    await runProactiveCollection(h.ctx);
    expect(messages(h)).toHaveLength(0);

    at(h, MON_10);
    await runProactiveCollection(h.ctx);
    const first = messages(h);
    expect(first).toHaveLength(1);
    const asked = first[0]!;
    expect(asked).toMatch(/posso conferir uma coisa do estoque\? 📦\n\n/);

    const askedLixa = /lixa/.test(asked);
    const reply = await h.send("Acho que umas 12.");
    if (askedLixa) {
      expect(h.allText(reply)).toBe("Anotado: mais ou menos 12 folhas de lixa. 📦\n\nObrigado!");
      const mv = await h.ctx.db.first<{ kind: string; quantity: string; condition: string; created_by: string }>("SELECT sm.* FROM stock_movements sm JOIN materials m ON m.id = sm.material_id WHERE m.key = 'lixa'");
      expect(mv).toMatchObject({ kind: "AJUSTE", quantity: "12", condition: "estimado", created_by: h.artisanId });
      const obs = await h.ctx.db.first<{ confidence: number; origin: string; data_json: string }>("SELECT * FROM learning_observations WHERE kind = 'STOCK_COUNT'");
      expect(obs).toMatchObject({ confidence: 0.6, origin: "telegram_proactive" });
      expect(JSON.parse(obs!.data_json)).toMatchObject({ quantity: "12", approximate: true });
      expect((await h.ctx.db.first<{ stock_checked_at: string; stock_is_estimate: number }>("SELECT * FROM materials WHERE key = 'lixa'"))).toMatchObject({ stock_checked_at: MON_10.replace("Z", ".000Z"), stock_is_estimate: 1 });
    }

    // não emenda outra pergunta no mesmo dia
    at(h, "2026-11-16T17:00:00Z");
    await runProactiveCollection(h.ctx);
    expect(messages(h).filter((t) => /estoque/.test(t))).toHaveLength(1);
    // no dia seguinte, o outro material pode ser perguntado
    at(h, TUE_10);
    await runProactiveCollection(h.ctx);
    expect(messages(h).filter((t) => /estoque/.test(t))).toHaveLength(2);
  });
});

describe("Cenário 3 — 'não lembro agora'", () => {
  it("adia com acolhimento, sem tratar como falha, e não pergunta de novo no mesmo dia", async () => {
    const h = await base();
    await h.ctx.db.run("UPDATE materials SET price_updated_at = ? WHERE key = 'tinta_esmalte'", "2026-03-01T12:00:00Z");
    await runProactiveCollection(h.ctx);
    expect(messages(h)[0]).toMatch(/tinta esmalte/);
    const r = await h.send("não lembro agora");
    expect(h.allText(r)).toBe("Sem problema 😊\n\nA gente confere isso outro dia.");
    const req = (await lastRequest(h))!;
    expect(req.status).toBe("snoozed");
    expect(Date.parse(req.next_allowed_at!)).toBeGreaterThan(Date.parse("2026-11-29T00:00:00Z"));
    expect(await events(h, req.id)).toContain("dont_know");
    at(h, "2026-11-16T20:00:00Z");
    await runProactiveCollection(h.ctx);
    at(h, TUE_10);
    await runProactiveCollection(h.ctx);
    expect(messages(h).filter((t) => /tinta/.test(t))).toHaveLength(1);
  });
});

describe("persistência, idempotência e limites", () => {
  it("11/12/13/14. solicitação persistente, sem duplicar, job idempotente e sem mensagem dupla", async () => {
    const h = await base();
    await h.ctx.db.run("UPDATE materials SET price_updated_at = ? WHERE key = 'tinta_esmalte'", "2026-03-01T12:00:00Z");
    const a = await runProactiveCollection(h.ctx);
    const b = await runProactiveCollection(h.ctx); // mesma janela de 15 min → lock
    expect(b.skipped).toMatch(/janela/);
    at(h, "2026-11-16T13:20:00Z");
    await runProactiveCollection(h.ctx);
    expect(a.users[0]!.sent).toBe(true);
    expect(messages(h)).toHaveLength(1);
    expect(await count(h, "SELECT COUNT(*) AS n FROM data_collection_requests WHERE need_kind = 'material_price'")).toBe(1);
    expect(await count(h, "SELECT COUNT(*) AS n FROM job_runs")).toBe(2);
  });

  it("21. destinatário vem do usuário ARTESAO ativo com vínculo Telegram (sem ID no código)", async () => {
    const h = await base({ eligibleUserIds: [] });
    await createUser(h.ctx, { role: "ARTESAO", displayName: "Outro Artesão", telegramUserId: "5555" }); // sem chat ainda
    await h.ctx.db.run("UPDATE materials SET price_updated_at = ? WHERE key = 'tinta_esmalte'", "2026-03-01T12:00:00Z");
    const rep = await runProactiveCollection(h.ctx);
    expect(rep.users.map((u) => u.name)).toEqual(["Adriano"]);
    expect(h.telegram.sent.filter((s) => s.kind === "message").map((s) => s.chatId)).toEqual(["1001"]);
  });

  it("58/59. coleta pausada ou tipo desativado não envia", async () => {
    const h = await base({ pausedUntil: "2026-12-01T00:00:00Z" });
    await h.ctx.db.run("UPDATE materials SET price_updated_at = ? WHERE key = 'tinta_esmalte'", "2026-03-01T12:00:00Z");
    const rep = await runProactiveCollection(h.ctx);
    expect(rep.users[0]!.gate).toMatchObject({ ok: false, reason: "pausado" });
    expect(messages(h)).toHaveLength(0);
    await saveProactiveSettings(h.ctx, { pausedUntil: null, kinds: { material_price: false } }, "teste");
    at(h, "2026-11-16T13:30:00Z");
    await runProactiveCollection(h.ctx);
    expect(messages(h)).toHaveLength(0);
  });

  it("20. não envia outra enquanto há pergunta aguardando resposta; conversa ativa adia", async () => {
    const h = await base({ maxPerDay: 5, minIntervalHours: 0 });
    await h.ctx.db.run("UPDATE materials SET price_updated_at = ? WHERE key IN ('tinta_esmalte','cera')", "2026-03-01T12:00:00Z");
    await runProactiveCollection(h.ctx);
    at(h, "2026-11-16T14:00:00Z");
    const rep = await runProactiveCollection(h.ctx);
    expect(rep.users[0]!.gate.reason).toBe("aguardando_resposta");
    expect(messages(h)).toHaveLength(1);
  });

  it("50. falha do Telegram agenda nova tentativa sem duplicar", async () => {
    const h = await base();
    await h.ctx.db.run("UPDATE materials SET price_updated_at = ? WHERE key = 'tinta_esmalte'", "2026-03-01T12:00:00Z");
    h.telegram.failNextSends = 1;
    const rep = await runProactiveCollection(h.ctx);
    expect(rep.users[0]!.sent).toBe(false);
    const req = (await lastRequest(h))!;
    expect(req.status).toBe("failed");
    expect(await events(h, req.id)).toContain("send_failed");
    at(h, "2026-11-16T13:16:00Z"); // antes do backoff
    await runProactiveCollection(h.ctx);
    expect(messages(h)).toHaveLength(0);
    at(h, "2026-11-16T14:00:00Z");
    await runProactiveCollection(h.ctx);
    expect(messages(h)).toHaveLength(1);
    expect(await count(h, "SELECT COUNT(*) AS n FROM data_collection_requests")).toBe(1);
  });

  it("job com erro nunca derruba o cron (migration ausente / falha isolada)", async () => {
    const h = await base();
    await h.ctx.db.run("DROP TABLE data_collection_events");
    const r = await runScheduled(h.ctx);
    expect(r.proactive).toHaveProperty("error");
    expect(r).toHaveProperty("outbox");
  });
});

describe("respostas, botões e aprendizado", () => {
  it("43/44/45/46/56. botões 'Pergunte depois' e repetido são idempotentes e aparecem em linguagem humana", async () => {
    const h = await base({ showButtons: true });
    await h.ctx.db.run("UPDATE materials SET price_updated_at = ? WHERE key = 'tinta_esmalte'", "2026-03-01T12:00:00Z");
    await runProactiveCollection(h.ctx);
    const btns = buttonsOf(h.telegram.last());
    const later = btns.find((b) => b.startsWith("dc:later:"))!;
    expect(btns.some((b) => b.startsWith("dc:dontknow:"))).toBe(true);
    const r1 = await h.click(later);
    expect(h.allText(r1)).toMatch(/Combinado! 😊\n\nPergunto de novo daqui a uns dias\./);
    const req = (await lastRequest(h))!;
    expect(req.status).toBe("snoozed");
    const r2 = await h.click(later);
    expect(h.allText(r2)).toMatch(/já foi resolvida/);
    expect((await events(h, req.id)).filter((e) => e === "snoozed")).toHaveLength(1);
    const conv = await api(h, "GET", "/conversations?limit=20");
    const texts = (conv.json!.rows as { display_text: string }[]).map((r) => r.display_text);
    expect(texts).toContain("Adriano pediu para perguntar novamente depois");
    expect(texts.join(" ")).not.toMatch(/dc:later/);
    // cancelar pela conversa
    await h.ctx.db.run("UPDATE data_collection_requests SET status = 'queued', next_allowed_at = NULL WHERE id = ?", req.id);
    at(h, TUE_10);
    await runProactiveCollection(h.ctx);
    const r3 = await h.send("cancelar");
    expect(h.allText(r3)).toMatch(/deixei essa pergunta de lado/);
    expect((await lastRequest(h))!.status).toBe("cancelled");
  });

  it("47. 'não uso mais' silencia o item e ele não é perguntado de novo", async () => {
    const h = await base();
    await h.ctx.db.run("UPDATE materials SET price_updated_at = ? WHERE key = 'tinta_esmalte'", "2026-03-01T12:00:00Z");
    await runProactiveCollection(h.ctx);
    const r = await h.send("não uso mais essa tinta");
    expect(h.allText(r)).toMatch(/Não vou mais perguntar sobre a tinta esmalte/);
    expect((await h.ctx.db.first<{ proactive_muted_until: string | null; active: number }>("SELECT * FROM materials WHERE key = 'tinta_esmalte'"))).toMatchObject({ active: 1 });
    at(h, TUE_10);
    await runProactiveCollection(h.ctx);
    at(h, "2026-12-20T13:00:00Z");
    await runProactiveCollection(h.ctx);
    expect(messages(h).filter((t) => /tinta/.test(t) && /\?/.test(t))).toHaveLength(1);
  });

  it("48/49. preço informado em outra conversa resolve a solicitação e ela não é enviada depois", async () => {
    const h = await base({ maxPerDay: 0 });
    await blockedVarnishQuote(h);
    at(h, TUE_10);
    await runProactiveCollection(h.ctx); // cria a solicitação, mas o limite impede o envio
    const req = (await lastRequest(h))!;
    expect(req.status).toBe("queued");
    const conf = await h.send("a lata de 900 ml custa 90 reais");
    const ok = buttonsOf(conf.at(-1)).find((d) => d.startsWith("mp:ok:"))!;
    await h.click(ok);
    expect((await lastRequest(h))!.status).toBe("resolved");
    expect(await events(h, req.id)).toContain("resolved_elsewhere");
    await saveProactiveSettings(h.ctx, { maxPerDay: 1 }, "teste");
    const n = messages(h).length;
    at(h, WED_10);
    await runProactiveCollection(h.ctx);
    expect(messages(h).slice(n).join("\n")).not.toMatch(/verniz/);
  });

  it("40. demãos viram observação sem calibrar a técnica com uma amostra", async () => {
    // impacto baixo (uma técnica, um serviço): só entra com pontuação mínima menor
    const h = await base({ minScore: 10 });
    await h.send("Peguei uma mesa da dona Ana para envernizar");
    await h.ctx.db.run("UPDATE techniques SET calibrated = 0 WHERE key = 'verniz'");
    at(h, TUE_10);
    await runProactiveCollection(h.ctx);
    const asked = messages(h).at(-1)!;
    expect(asked).toMatch(/Quantas demãos de verniz você costuma passar\?/);
    const r = await h.send("duas demãos");
    expect(h.allText(r)).toMatch(/Anotado: 2 demãos de verniz/);
    const obs = await h.ctx.db.first<{ status: string; data_json: string }>("SELECT * FROM learning_observations WHERE kind = 'TECHNIQUE_OBSERVATION'");
    expect(obs!.status).toBe("COLETADO");
    expect((await h.ctx.db.first<{ calibrated: number }>("SELECT calibrated FROM techniques WHERE key = 'verniz'"))!.calibrated).toBe(0);
  });

  it("horas reais de trabalho concluído viram lançamento de tempo + observação", async () => {
    const h = await base({ kinds: { job_materials_used: false } });
    await h.send("Peguei uma mesa da dona Ana para envernizar");
    const job = await h.ctx.db.first<{ id: string }>("SELECT id FROM jobs");
    await h.ctx.db.run("UPDATE jobs SET status = 'CONCLUIDO', completed_at = ? WHERE id = ?", "2026-11-16T12:00:00Z", job!.id);
    at(h, TUE_10);
    await runProactiveCollection(h.ctx);
    expect(messages(h).at(-1)).toMatch(/Mais ou menos quantas horas você levou nele, no total\?/);
    const r = await h.send("umas 6 horas");
    expect(h.allText(r)).toMatch(/Anotado: mais ou menos 6 horas\. 🛠️/);
    expect(await count(h, "SELECT COUNT(*) AS n FROM time_entries WHERE job_id = ?", job!.id)).toBe(1);
    expect(await count(h, "SELECT COUNT(*) AS n FROM learning_observations WHERE kind = 'JOB_ACTUAL_HOURS'")).toBe(1);
  });

  it("assunto claramente diferente libera a conversa sem perder a pergunta", async () => {
    const h = await base();
    await h.ctx.db.run("UPDATE materials SET price_updated_at = ? WHERE key = 'tinta_esmalte'", "2026-03-01T12:00:00Z");
    await runProactiveCollection(h.ctx);
    const r = await h.send("Peguei uma cômoda do seu Roberto para pintar");
    expect(h.allText(r)).toMatch(/c[oô]moda/i);
    expect((await lastRequest(h))!.status).toBe("waiting_response");
    const s = await h.ctx.db.first<{ flow: string }>("SELECT flow FROM conversation_sessions WHERE user_id = ?", h.artisanId);
    expect(s!.flow).not.toBe("data_collection");
  });
});

describe("IA, simulação e painel", () => {
  it("51/52. IA reescreve só o contexto; JSON/texto inválido cai no texto determinístico", async () => {
    const h = await base();
    h.ctx.config = { ...h.ctx.config, phrasingVariety: true };
    h.ctx.ai = { ...h.ctx.ai, extraction: h.extraction };
    await h.ctx.db.run("UPDATE materials SET price_updated_at = ? WHERE key = 'tinta_esmalte'", "2026-03-01T12:00:00Z");
    h.extraction.rephraseResponse = "A tinta esmalte agora custa 90 reais, né?";
    await runProactiveCollection(h.ctx);
    const t = messages(h)[0]!;
    expect(t).not.toMatch(/90/);
    expect(t).toMatch(/\n\nQuanto (está custando|custa)/);
    // reescrita válida é usada, a pergunta continua a mesma
    const h2 = await base();
    h2.ctx.config = { ...h2.ctx.config, phrasingVariety: true };
    h2.ctx.ai = { ...h2.ctx.ai, extraction: h2.extraction };
    await h2.ctx.db.run("UPDATE materials SET price_updated_at = ? WHERE key = 'tinta_esmalte'", "2026-03-01T12:00:00Z");
    h2.extraction.rephraseResponse = "Queria conferir se o preço da tinta esmalte continua o mesmo.";
    await runProactiveCollection(h2.ctx);
    expect(messages(h2)[0]).toMatch(/Queria conferir se o preço da tinta esmalte continua o mesmo\.\n\nQuanto/);
  });

  it("53/54. simulação mostra pontuação e mensagem sem enviar nem gravar", async () => {
    const h = await base();
    await h.ctx.db.run("UPDATE materials SET price_updated_at = ? WHERE key = 'tinta_esmalte'", "2026-03-01T12:00:00Z");
    const res = await api(h, "POST", "/proactive/dry-run", {});
    expect(res.status).toBe(200);
    const rep = res.json as { mode: string; users: { selected: { message: string; expectedUpdate: string } | null; ranked: { score: number; reasons: string[] }[] }[] };
    expect(rep.mode).toBe("dry_run");
    expect(rep.users[0]!.selected!.message).toMatch(/tinta esmalte/);
    expect(rep.users[0]!.ranked[0]!.reasons.length).toBeGreaterThan(0);
    expect(messages(h)).toHaveLength(0);
    expect(await count(h, "SELECT COUNT(*) AS n FROM data_collection_requests")).toBe(0);
    expect(await count(h, "SELECT COUNT(*) AS n FROM job_runs")).toBe(0);
    // fora de produção o padrão é só simular
    h.ctx.config = { ...h.ctx.config, proactiveMode: "dry_run" };
    await runScheduled(h.ctx);
    expect(messages(h)).toHaveLength(0);
  });

  it("57. painel: filtros, datas DD/MM/AAAA, pausar e cancelar", async () => {
    const h = await base();
    await h.ctx.db.run("UPDATE materials SET price_updated_at = ? WHERE key = 'tinta_esmalte'", "2026-03-01T12:00:00Z");
    await runProactiveCollection(h.ctx);
    const list = await api(h, "GET", "/proactive/requests?pending=1&kind=material_price");
    const rows = list.json!.rows as { id: string; status_label: string; created_at_br: string; last_sent_at_br: string }[];
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ status_label: "Aguardando resposta", created_at_br: "16/11/2026", last_sent_at_br: "16/11/2026" });
    const cancel = await api(h, "POST", `/proactive/requests/${rows[0]!.id}/action`, { action: "cancel" });
    expect(cancel.status).toBe(200);
    expect((await lastRequest(h))!.status).toBe("cancelled");
    const s = await h.ctx.db.first<{ flow: string }>("SELECT flow FROM conversation_sessions WHERE user_id = ?", h.artisanId);
    expect(s!.flow).toBe("idle");
    const put = await api(h, "PUT", "/proactive/settings", { enabled: false });
    expect((put.json!.settings as { enabled: boolean }).enabled).toBe(false);
    expect(await count(h, "SELECT COUNT(*) AS n FROM audit_events WHERE action IN ('proactive.cancel','proactive.settings')")).toBeGreaterThanOrEqual(2);
  });
});

describe("pergunta sem resposta: nunca repete; expira quando ele segue com outro assunto (23/11/2026)", () => {
  const THU_10 = "2026-11-19T13:00:00Z";
  async function twoStalePrices(): Promise<Harness> {
    const h = await base();
    await h.ctx.db.run("UPDATE materials SET price_updated_at = '2026-01-01T00:00:00Z' WHERE key IN ('verniz', 'cera')");
    return h;
  }
  const waitingCount = (h: Harness) => count(h, "SELECT COUNT(*) AS n FROM data_collection_requests WHERE status IN ('sent','waiting_response')");

  it("sem nenhuma interação: não repete a pergunta nem manda outra, dias depois", async () => {
    const h = await twoStalePrices();
    at(h, MON_10);
    expect((await runProactiveCollection(h.ctx)).users[0]!.sent).toBe(true);
    const first = (await h.ctx.db.first<{ id: string }>("SELECT id FROM data_collection_requests WHERE status = 'waiting_response'"))!.id;
    const n = messages(h).length;
    for (const day of [TUE_10, WED_10, THU_10]) {
      at(h, day);
      const rep = await runProactiveCollection(h.ctx);
      expect(rep.users[0]!.sent).toBe(false);
    }
    expect(messages(h).length).toBe(n);
    expect((await h.ctx.db.first<{ status: string; attempts: number }>("SELECT status, attempts FROM data_collection_requests WHERE id = ?", first))).toMatchObject({ status: "waiting_response", attempts: 1 });
  });

  it("ele usa o bot para outra coisa: a pergunta expira e a próxima pode ser enviada", async () => {
    const h = await twoStalePrices();
    at(h, MON_10);
    await runProactiveCollection(h.ctx);
    const first = (await h.ctx.db.first<{ id: string; entity_label: string }>("SELECT id, entity_label FROM data_collection_requests WHERE status = 'waiting_response'"))!;
    at(h, "2026-11-16T15:00:00Z");
    await h.send("Peguei uma cadeira do seu João para pintar");
    at(h, TUE_10);
    const rep = await runProactiveCollection(h.ctx);
    const old = await h.ctx.db.first<{ status: string; close_reason: string }>("SELECT status, close_reason FROM data_collection_requests WHERE id = ?", first.id);
    expect(old).toMatchObject({ status: "expired", close_reason: "sem resposta: seguiu com outro assunto no bot" });
    expect(rep.users[0]!.sent).toBe(true);
    expect(rep.users[0]!.selected!.requestId).not.toBe(first.id);
    expect(await waitingCount(h)).toBe(1);
  });

  it("resposta à própria pergunta não conta como 'outro assunto'", async () => {
    const h = await twoStalePrices();
    at(h, MON_10);
    await runProactiveCollection(h.ctx);
    const first = (await h.ctx.db.first<{ id: string }>("SELECT id FROM data_collection_requests WHERE status = 'waiting_response'"))!.id;
    at(h, "2026-11-16T15:00:00Z");
    await h.send("uns 85 reais");
    at(h, TUE_10);
    await runProactiveCollection(h.ctx);
    const st = (await h.ctx.db.first<{ status: string }>("SELECT status FROM data_collection_requests WHERE id = ?", first))!.status;
    expect(st).not.toBe("expired");
  });
});
