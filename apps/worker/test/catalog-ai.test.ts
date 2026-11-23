import { describe, expect, it } from "vitest";
import { COMPOSE_SYSTEM_PROMPT, countEmojis, validateComposed, validateTurn, type MessagePlan } from "@adripatina/conversations";
import { createHarness, count, type Harness } from "./harness.js";
import { api } from "./helpers.js";
import { getJob } from "../src/repos/jobs.js";
import { loadFurnitureCatalog, syncFurnitureCatalog, invalidateFurnitureCache } from "../src/repos/furniture.js";
import { calculateQuote } from "../src/services/quotes.js";
import { composeMessage, interpretTurn } from "../src/ai/orchestrator.js";

async function job(h: Harness) {
  const row = await h.ctx.db.first<{ id: string }>("SELECT id FROM jobs ORDER BY created_at DESC LIMIT 1");
  return (await getJob(h.ctx, row!.id))!;
}
const ft = async (h: Harness) => (await job(h)).facts.furniture_type?.value as { type: string; catalogKey?: string; kindCandidates?: string[]; doors?: number; drawers?: number; attributes?: Record<string, unknown> };

describe("catálogo mestre no banco", () => {
  it("carga idempotente: rodar de novo não duplica tipos nem aliases", async () => {
    const h = await createHarness();
    await loadFurnitureCatalog(h.ctx); // carrega na primeira leitura
    const types = await count(h, "SELECT COUNT(*) AS n FROM furniture_types");
    const aliases = await count(h, "SELECT COUNT(*) AS n FROM furniture_aliases");
    expect(types).toBeGreaterThanOrEqual(150);
    expect(aliases).toBeGreaterThan(400);
    const again = await syncFurnitureCatalog(h.ctx);
    expect(again.inserted).toBe(0);
    expect(await count(h, "SELECT COUNT(*) AS n FROM furniture_types")).toBe(types);
    expect(await count(h, "SELECT COUNT(*) AS n FROM furniture_aliases")).toBe(aliases);
    // partes associadas ao tipo certo
    const parts = (await h.ctx.db.all<{ part_key: string }>("SELECT part_key FROM furniture_type_parts WHERE furniture_type_key = 'guarda_roupa'")).map((r) => r.part_key);
    expect(parts).toEqual(expect.arrayContaining(["porta", "gaveta", "prateleira"]));
  });

  it("edição pelo painel é auditada, não é sobrescrita pela carga e tipo inativo some das sugestões", async () => {
    const h = await createHarness();
    await loadFurnitureCatalog(h.ctx);
    expect((await api(h, "PATCH", "/furniture-types/buffet", { displayName: "Buffet de jantar", active: false })).status).toBe(200);
    expect(await count(h, "SELECT COUNT(*) AS n FROM audit_events WHERE action = 'furniture_type.update'")).toBe(1);
    await syncFurnitureCatalog(h.ctx);
    const row = await h.ctx.db.first<{ display_name: string; active: number }>("SELECT display_name, active FROM furniture_types WHERE canonical_key = 'buffet'");
    expect(row).toEqual({ display_name: "Buffet de jantar", active: 0 });
    const list = (await api(h, "GET", "/furniture-types?q=buffet&active=1")).json!.rows as { key: string }[];
    expect(list.map((r) => r.key)).not.toContain("buffet");
    // novo apelido passa a ser reconhecido na conversa
    expect((await api(h, "POST", "/furniture-types/comoda/aliases", { alias: "sapateirão" })).status).toBe(201);
    invalidateFurnitureCache(h.ctx);
    await h.send("Peguei um sapateirão da dona Lia para pintar");
    expect((await ft(h)).catalogKey).toBe("comoda");
  });

  it("detalhe do tipo mostra partes, presets e a fonte classificada (sem chamar faixa de norma)", async () => {
    const h = await createHarness();
    const r = await api(h, "GET", "/furniture-types/cama_queen");
    expect(r.status).toBe(200);
    const t = r.json as { presets: { key: string; isStandardized: boolean; isMarketReference: boolean }[]; source: { kind: string } };
    expect(t.presets[0]).toMatchObject({ key: "queen_158", isStandardized: false, isMarketReference: true });
    expect(t.source.kind).toBe("market_reference");
  });
});

describe("reconhecimento e perguntas por tipo na conversa", () => {
  it("'armário' é ambíguo: o bot pergunta qual, e a resposta define o tipo", async () => {
    const h = await createHarness();
    const r = h.allText(await h.send("Peguei um armário da dona Rita para pintar"));
    expect(r).toMatch(/Esse arm[aá]rio é qual destes:.*guarda-roupa/i);
    expect((await ft(h)).kindCandidates).toContain("guarda_roupa");
    const r2 = h.allText(await h.send("é o da cozinha"));
    expect((await ft(h)).catalogKey).toBe("armario_cozinha_inferior");
    expect(r2).toMatch(/Anotado: armário de cozinha inferior/);
  });

  it("'cama grande' gera esclarecimento entre casal, queen e king", async () => {
    const h = await createHarness();
    const r = h.allText(await h.send("Peguei uma cama grande da dona Bia para envernizar"));
    expect(r).toMatch(/casal.*queen.*king|queen.*king/i);
    await h.send("é king");
    expect((await ft(h)).catalogKey).toBe("cama_king");
    // king exige confirmação: não preenche medida sozinho
    expect((await job(h)).facts.dimensions).toBeUndefined();
  });

  it("guarda-roupa pergunta portas e tipo de porta; cômoda pergunta gavetas", async () => {
    const h = await createHarness();
    await h.send("Peguei um guarda-roupa da dona Cida para pintar");
    await h.send("está bom");
    const dims = h.allText(await h.send("2 metros de altura, 1,60 de largura e 60 de fundura"));
    expect(dims).toMatch(/Quantas portas ele tem\?/);
    const door = h.allText(await h.send("quatro portas"));
    expect(door).toMatch(/abrir ou de correr\?/);
    await h.send("de correr");
    expect(await ft(h)).toMatchObject({ doors: 4, attributes: { door_type: "correr" } });

    const h2 = await createHarness();
    await h2.send("Peguei uma cômoda da dona Ana para pintar");
    await h2.send("está boa");
    const q = h2.allText(await h2.send("90 de altura, 1,20 de largura e 45 de fundura"));
    expect(q).toMatch(/Quantas gavetas ela tem\?/);
    await h2.send("5 gavetas");
    expect((await ft(h2)).drawers).toBe(5);
  });

  it("sofá distingue madeira e estofado; móvel externo pergunta exposição ao tempo", async () => {
    const h = await createHarness();
    await h.send("Peguei uma poltrona do seu Zé para restaurar");
    await h.send("está boa");
    const q = h.allText(await h.send("80 de altura, 70 de largura e 70 de fundura"));
    expect(q).toMatch(/só na madeira, só no estofado ou nos dois\?/);
    await h.send("só a madeira");
    expect((await ft(h)).attributes?.upholstery_scope).toBe("madeira");

    const h2 = await createHarness();
    await h2.send("Peguei um banco de jardim da dona Eva para envernizar");
    await h2.send("está bom");
    const ex = h2.allText(await h2.send("1,50 de comprimento, 45 de largura e 80 de altura"));
    expect(ex).toMatch(/sol ou na chuva/);
    await h2.send("pega sol e chuva");
    expect((await ft(h2)).attributes?.exposure).toBe("sol_e_chuva");
  });

  it("mesa redonda usa diâmetro; mesa extensível guarda medida fechada e aberta; serviço só no tampo", async () => {
    const h = await createHarness();
    await h.send("Peguei uma mesa redonda da dona Lu para envernizar");
    await h.send("está boa");
    const s = h.allText(await h.send("só o tampo"));
    expect(s).toMatch(/diâmetro/);
    await h.send("1,20 de diâmetro");
    const d = (await job(h)).facts.dimensions?.value as { diameter?: string; source?: string };
    expect(d).toMatchObject({ diameter: "1.2", source: "customer_informed" });

    const h2 = await createHarness();
    await h2.send("Peguei uma mesa extensível da dona Rosa para envernizar");
    await h2.send("está boa");
    await h2.send("a mesa inteira");
    await h2.send("1,60 por 90");
    const ext = h2.allText(await h2.send("ok")) + h2.lastText();
    expect(ext).toMatch(/aberta, com a extensão/);
    await h2.send("aberta fica 2,20");
    const d2 = (await job(h2)).facts.dimensions?.value as { width?: string; depth?: string; open?: { width?: string } };
    expect(d2).toMatchObject({ width: "1.6", depth: "0.9", open: { width: "2.2" } });
    expect((await job(h2)).facts.scope?.value).toMatchObject({ part: "inteiro" });
  });

  it("móvel desconhecido fica registrado provisoriamente com a descrição", async () => {
    const h = await createHarness();
    await h.send("Peguei uma peça diferente da dona Ivone para restaurar");
    const f = await ft(h);
    expect(f).toMatchObject({ type: "movel", catalogKey: "movel_nao_identificado" });
    expect(JSON.stringify(f)).toMatch(/peça diferente/);
  });

  it("estado físico não vira andamento do serviço", async () => {
    const h = await createHarness();
    await h.send("Peguei uma cômoda da dona Ana para pintar");
    await h.send("o tampo está descascando e uma gaveta está travando");
    expect((await h.ctx.db.first<{ status: string }>("SELECT status FROM jobs"))!.status).toBe("ORCAMENTO");
  });
});

describe("medidas nominais x medidas reais no orçamento", () => {
  async function queen(h: Harness) {
    await h.calibrateAndPrice();
    await h.send("Peguei uma cama de casal queen da Dona Licele para envernizar");
    await h.send("a cama inteira");
  }

  it("hipótese nominal: orçamento preliminar mostra a hipótese e não vira definitivo em silêncio", async () => {
    const h = await createHarness();
    await queen(h);
    await h.send("não tenho como medir agora");
    const j = await job(h);
    const q = await calculateQuote(h.ctx, j.id, h.adminId);
    expect(Number(q.result.areaM2)).toBeGreaterThan(0);
    const gaps = (q.result.gaps ?? []).map((g) => g.code);
    expect(gaps).toContain("DIMENSIONS_NOMINAL");
    expect(q.definitiveAllowed).toBe(false);
    expect(q.result.warnings.map((w) => w.code)).toContain("NOMINAL_DIMENSIONS");
  });

  it("medida real substitui a hipótese (e a estrutura não herda o colchão)", async () => {
    const h = await createHarness();
    await queen(h);
    await h.send("uns 1,70 por 2,15");
    const d = (await job(h)).facts.dimensions?.value as { width: string; depth: string; source: string; kind: string };
    expect(d).toMatchObject({ width: "1.7", depth: "2.15", source: "customer_informed", kind: "external" });
    const q = await calculateQuote(h.ctx, (await job(h)).id, h.adminId);
    expect((q.result.gaps ?? []).map((g) => g.code)).not.toContain("DIMENSIONS_NOMINAL");
  });

  it("'é o padrão' confirma a hipótese explicitamente (fica escrita no orçamento)", async () => {
    const h = await createHarness();
    await queen(h);
    await h.send("é o padrão");
    const d = (await job(h)).facts.dimensions?.value as { source: string; standardConfirmed?: boolean };
    expect(d).toMatchObject({ source: "nominal", standardConfirmed: true });
    const q = await calculateQuote(h.ctx, (await job(h)).id, h.adminId);
    expect((q.result.gaps ?? []).map((g) => g.code)).not.toContain("DIMENSIONS_NOMINAL");
    expect(q.result.warnings.map((w) => w.code)).toContain("NOMINAL_DIMENSIONS");
  });

  it("serviço só na cabeceira usa área menor que a cama inteira", async () => {
    const whole = await createHarness();
    await queen(whole);
    await whole.send("1,70 por 2,15");
    const head = await createHarness();
    await head.calibrateAndPrice();
    await head.send("Peguei uma cama de casal queen da Dona Licele para envernizar");
    await head.send("só a cabeceira");
    await head.send("1,70 por 2,15");
    const qa = await calculateQuote(whole.ctx, (await job(whole)).id, whole.adminId);
    const qb = await calculateQuote(head.ctx, (await job(head)).id, head.adminId);
    const area = (q: typeof qa) => Number(q.result.areaM2 ?? 0);
    expect(area(qb)).toBeGreaterThan(0);
    expect(area(qb)).toBeLessThan(area(qa));
  });
});

describe("IA: composição, interpretação e fallback", () => {
  const plan: MessagePlan = {
    purpose: "ask_package_size",
    fallback: "Perfeito, anotei cerca de R$ 85,00. 💰\n\nEssa lata é de quantos litros?",
    question: "Essa lata é de quantos litros?",
    keyTerms: ["litros"],
    facts: ["verniz custa cerca de R$ 85,00"],
    greet: false,
  };

  it("validador aceita mensagem natural e espaça contexto e pergunta", () => {
    const ok = validateComposed(plan, { text: "Perfeito, Adriano! Anotei que o verniz custa mais ou menos R$ 85,00. 🎨 Essa lata é de quantos litros?" });
    expect(ok.ok).toBe(true);
    expect(ok.text).toMatch(/85,00\. 🎨\n\nEssa lata é de quantos litros\?/);
  });

  it("validador recusa: pergunta essencial ausente, número inventado, emojis demais, autismo, tom infantil, duas perguntas", () => {
    expect(validateComposed(plan, { text: "Anotei! Quer mais alguma coisa?" }).reasons.join()).toMatch(/litros/);
    expect(validateComposed(plan, { text: "Essa lata de 900 ml é de quantos litros?" }).reasons.join()).toMatch(/número inventado/);
    expect(validateComposed(plan, { text: "🎨🎨🎨 Essa lata é de quantos litros?" }).reasons.join()).toMatch(/emojis/);
    expect(validateComposed(plan, { text: "Como você é autista, vou perguntar devagar: essa lata é de quantos litros?" }).ok).toBe(false);
    expect(validateComposed(plan, { text: "Muito bem, amiguinho! Essa lata é de quantos litros?" }).ok).toBe(false);
    expect(validateComposed(plan, { text: "Essa lata é de quantos litros? E quanto custou?" }).reasons.join()).toMatch(/perguntas/);
    expect(countEmojis("Oi! 🎨 📦")).toBe(2);
    expect(COMPOSE_SYSTEM_PROMPT).not.toMatch(/autis/i);
  });

  it("composeMessage usa a IA quando habilitada e volta ao texto-base quando ela falha ou erra", async () => {
    const h = await createHarness();
    h.ctx.ai.extraction = h.extraction;
    h.ctx.config = { ...h.ctx.config, phrasingVariety: true };
    h.extraction.generateHandler = () => ({ text: "Anotei os R$ 85,00 do verniz. 🎨\n\nE essa lata é de quantos litros?" });
    const ok = await composeMessage(h.ctx, plan);
    expect(ok.source).toBe("ai");
    expect(ok.text).toMatch(/quantos litros\?$/);
    h.extraction.generateHandler = () => ({ text: "Quanto custou a tinta?" });
    const bad = await composeMessage(h.ctx, plan);
    expect(bad).toMatchObject({ source: "fallback", text: plan.fallback });
    h.extraction.fail = true;
    expect((await composeMessage(h.ctx, plan)).text).toBe(plan.fallback);
    // sem IA configurada: texto determinístico
    h.ctx.ai.extraction = null;
    expect((await composeMessage(h.ctx, plan)).source).toBe("fallback");
    // log sem prompt nem segredos
    const logs = await h.ctx.db.all<{ decision_json: string | null; purpose: string }>("SELECT decision_json, purpose FROM ai_usage WHERE purpose IS NOT NULL");
    expect(logs.length).toBeGreaterThan(0);
    for (const l of logs) expect(l.decision_json ?? "").not.toMatch(/token|secret|Adriano|85,00/i);
  });

  it("JSON inválido da IA não provoca ação: interpretação volta nula e o banco não muda", async () => {
    const h = await createHarness();
    h.ctx.ai.extraction = h.extraction;
    h.extraction.generateHandler = (req) => (req.purpose.startsWith("turn") ? { primaryGoal: "apagar_tudo", sql: "DROP TABLE jobs" } : null);
    const before = await count(h, "SELECT COUNT(*) AS n FROM jobs");
    const t = await interpretTurn(h.ctx, { text: "oi", pendingQuestion: null, activeGoal: null, knownFacts: [], furnitureCandidates: [], recentTurns: [] });
    expect(t).toBeNull();
    expect(await count(h, "SELECT COUNT(*) AS n FROM jobs")).toBe(before);
    // chave de móvel fora da lista curta é descartada
    const v = validateTurn(
      { primaryGoal: "create_quote", contextualIntent: "add_information", answersPending: false, confidence: 0.9, entities: { furnitureItems: [{ text: "mesa", candidateKey: "nave_espacial" }] } },
      ["mesa_centro"],
    );
    expect(v?.entities.furnitureItems[0]?.candidateKey).toBeNull();
  });

  it("IA escolhe entre candidatos do catálogo só com confiança alta (senão pergunta)", async () => {
    const h = await createHarness();
    h.ctx.ai.extraction = h.extraction;
    h.extraction.generateHandler = (req) => (req.purpose === "choose:furniture" ? { chosenKey: "mesa_centro", confidence: 0.92, evidence: "fica na sala", needsClarification: false } : null);
    await h.send("Peguei uma mesinha da dona Gal para envernizar, fica na frente do sofá");
    expect((await ft(h)).catalogKey).toBe("mesa_centro");
    const h2 = await createHarness();
    h2.ctx.ai.extraction = h2.extraction;
    h2.extraction.generateHandler = (req) => (req.purpose === "choose:furniture" ? { chosenKey: "mesa_centro", confidence: 0.4, needsClarification: true } : null);
    const r = h2.allText(await h2.send("Peguei uma mesinha da dona Gal para envernizar"));
    // confiança baixa: nada é decidido nem cadastrado; o bot pergunta qual é
    expect(await count(h2, "SELECT COUNT(*) AS n FROM jobs")).toBe(0);
    expect(r).toMatch(/de centro, lateral, de cabeceira ou de apoio\?/);
  });

  it("Workers AI indisponível: conversa segue só com regras", async () => {
    const h = await createHarness();
    h.ctx.ai.extraction = h.extraction;
    h.ctx.config = { ...h.ctx.config, phrasingVariety: true };
    h.extraction.fail = true;
    const r = h.allText(await h.send("Peguei uma cômoda da dona Ana para pintar"));
    expect(r).toMatch(/\?/);
    expect((await ft(h)).catalogKey).toBe("comoda");
    expect(r).not.toMatch(/erro|falha/i);
  });
});
