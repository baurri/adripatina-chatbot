import { describe, expect, it } from "vitest";
import { buttonsOf, count, createHarness, type Harness } from "./harness.js";
import { api } from "./helpers.js";
import { processOutbox } from "../src/services/outbox.js";

const REAL =
  "Eu preciso, na terça-feira, pegar um trabalho do seu Roberto e Dona Jo. Uma mesinha de centro para lixar e passar verniz. E outros dois móveis, que seria só o tampo para lixar e envernizar. Eu gostaria de saber quanto eu deveria cobrar isso.";
const REPLY = "Um deles a mesinha de centro está com o tampo precisando de reparos os outros estão melhores";

async function setup(opts: { verniz?: boolean } = {}): Promise<Harness> {
  const h = await createHarness();
  h.clock.now = new Date("2026-11-22T15:00:00Z"); // domingo
  await h.calibrateAndPrice();
  if (opts.verniz === false) await h.ctx.db.run("UPDATE materials SET replacement_price_cents = NULL, price_updated_at = NULL WHERE key = 'verniz'");
  return h;
}

async function session(h: Harness) {
  const s = await h.ctx.db.first<{ flow: string; context_json: string }>("SELECT flow, context_json FROM conversation_messages, conversation_sessions LIMIT 1");
  return { flow: s!.flow, ctx: JSON.parse(s!.context_json) as { quoteRequest?: { step: string; draft: { items: { description: string; condition: string | null; repairPart: string | null; quantity: number }[] } }; pendingQuestion?: { type: string } } };
}

/** Conversa completa até o cálculo, como no fluxo esperado da especificação. */
async function fullConversation(h: Harness, grouping = "um para cada cliente") {
  await h.send(REAL);
  await h.send("são dois clientes");
  await h.send("Isso.");
  await h.send("Uma cômoda e um aparador.");
  await h.send("Nela inteira, mas o tampo precisa de reparos. Os outros estão melhores.");
  await h.send("Certo.");
  await h.send(grouping);
  await h.send("45 de altura, 1 metro de largura e 60 de fundura");
  await h.send("1,20 por 50");
  await h.send("médio");
  await h.send("umas 2 horas");
  await h.send("pincel");
  await h.send("vou comprar");
  await h.send("buscar e entregar");
  return h.send("60 reais");
}

describe("Ajuste 2 — caso real de produção (não pode virar 'em execução')", () => {
  it("1. mensagem real + resposta sobre condição: objetivo continua, nada vai para execução", async () => {
    const h = await setup();
    const first = await h.send(REAL);
    const t1 = h.allText(first);
    expect(t1).toMatch(/são 3 móveis para lixar e envernizar/);
    expect(t1).toMatch(/Seu Roberto/);
    expect(t1).toMatch(/Dona Jo/);
    expect(t1).toMatch(/quanto cobrar/);
    expect(t1).toMatch(/24\/11\/2026/);
    // 31. nenhuma entidade definitiva criada antes das confirmações
    expect(await count(h, "SELECT COUNT(*) AS n FROM jobs")).toBe(0);
    // nomes ditos juntos: casal ou dois clientes? (nunca adivinhar)
    expect(t1).toMatch(/são um casal, um cliente só\? Ou são dois clientes diferentes/);
    expect(buttonsOf(first.at(-1))).toEqual(["qr:couple", "qr:separate"]);
    await h.send("são dois clientes");

    const reply = await h.send(REPLY);
    const t2 = h.allText(reply);
    expect(t2).not.toMatch(/Vou marcar|em execução/);
    expect(await count(h, "SELECT COUNT(*) AS n FROM jobs WHERE status = 'EM_EXECUCAO'")).toBe(0);
    const s = await session(h);
    expect(s.flow).toBe("quote_request");
    const items = s.ctx.quoteRequest!.draft.items;
    expect(items[0]).toMatchObject({ description: "mesinha de centro", condition: "reparos", repairPart: "tampo" });
    expect(items[1]).toMatchObject({ quantity: 2, condition: "melhor_que_outros" });
    // a informação foi reconhecida e a montagem do orçamento continua (pergunta de quem é cada peça)
    expect(t2).toMatch(/Anotei: a mesinha de centro precisa de reparo no tampo/);
    expect(t2).toMatch(/de quem é cada peça/);
  });

  it("32. auditoria guarda intenção bruta, contextual e decisão de roteamento", async () => {
    const h = await setup();
    await h.send(REAL);
    await h.send("dois clientes");
    await h.send(REPLY);
    const row = await h.ctx.db.first<{ intent: string; contextual_intent: string; route: string; routing_json: string }>(
      "SELECT intent, contextual_intent, route, routing_json FROM conversation_messages WHERE direction = 'in' AND text LIKE 'Um deles%'",
    );
    expect(row!.intent).not.toBe("job_progress");
    expect(row!.route).toBe("active_goal");
    expect(row!.contextual_intent).toBe("quote_request_continue");
    const detail = JSON.parse(row!.routing_json);
    expect(detail).toMatchObject({ activeGoal: "quote_request", pendingQuestion: "item_owner" });
    expect(detail.reason).toBeTruthy();
    expect(detail.entities.conditionStatement).toBe(true);
  });
});

describe("Ajuste 2 — fluxo conversacional do pedido com vários itens", () => {
  it("10/11. pergunta de quem é cada peça e 'isso' confirma a proposta", async () => {
    const h = await setup();
    await h.send(REAL);
    const r = await h.click("qr:separate");
    expect(h.allText(r)).toMatch(/a mesinha de centro é do Seu Roberto; os outros dois móveis são da Dona Jo\?/);
    expect(buttonsOf(r.at(-1))).toEqual(["qr:owner_yes", "qr:owner_no"]);
    const next = await h.send("Isso.");
    expect(h.allText(next)).toMatch(/Quais são os outros dois móveis/);
  });

  it("'não' leva a perguntar o dono de cada peça, uma por vez", async () => {
    const h = await setup();
    await h.send(REAL);
    await h.send("são dois clientes diferentes");
    const r = await h.send("não");
    expect(h.allText(r)).toMatch(/A mesinha de centro é de quem/);
    const r2 = await h.send("da dona Jo");
    expect(h.allText(r2)).toMatch(/Os outros dois móveis são de quem/);
  });

  it("12/29. resposta de estado interpretada como estado, com 'os outros'", async () => {
    const h = await setup();
    await h.send(REAL);
    await h.send("dois clientes");
    await h.send("isso");
    await h.send("uma cômoda e um aparador");
    const r = await h.send("Nela inteira, mas o tampo precisa de reparos. Os outros estão melhores.");
    const t = h.allText(r);
    expect(t).toMatch(/a mesinha de centro \(Seu Roberto\): lixar e envernizar inteira, com reparo no tampo/);
    expect(t).toMatch(/a cômoda \(Dona Jo\): lixar e envernizar só o tampo, sem reparos grandes/);
    expect(t).toMatch(/o aparador \(Dona Jo\)/);
  });

  it("21/26/27/24. vai até o orçamento: linhas por item, subtotal por cliente, pergunta estoque x compra", async () => {
    const h = await setup();
    const msgs: string[] = [];
    h.telegram.clear();
    const final = await fullConversation(h);
    msgs.push(...h.telegram.sent.map((s) => s.text ?? ""));
    expect(msgs.join("\n")).toMatch(/estoque ou vai comprar/);
    const t = h.allText(final);
    expect(t).toMatch(/Aqui está o orçamento/);
    expect(t).toMatch(/A mesinha de centro \(Seu Roberto\): recomendado R\$/);
    expect(t).toMatch(/A cômoda \(Dona Jo\): recomendado R\$/);
    expect(t).toMatch(/O aparador \(Dona Jo\): recomendado R\$/);
    expect(t).toMatch(/Seu Roberto: recomendado R\$/);
    expect(t).toMatch(/Dona Jo: recomendado R\$/);
    expect(t).toMatch(/Total: recomendado R\$/);
    expect(await count(h, "SELECT COUNT(*) AS n FROM jobs")).toBe(3);
    expect(await count(h, "SELECT COUNT(*) AS n FROM quotes WHERE status = 'AGUARDANDO_REVISAO'")).toBe(3);
    // escopo "só tampo" chega ao motor (área menor que a peça inteira)
    const tops = await h.ctx.db.all<{ facts_json: string }>("SELECT facts_json FROM jobs");
    expect(tops.filter((j) => JSON.parse(j.facts_json).scope?.value.part === "tampo")).toHaveLength(2);
    // reparo informado pelo artesão vira horas extras auditadas
    expect(await count(h, "SELECT COUNT(*) AS n FROM audit_events WHERE action = 'job.pricing_overrides'")).toBeGreaterThan(0);
    const qr = await h.ctx.db.first<{ status: string }>("SELECT status FROM quote_requests");
    expect(qr!.status).toBe("CALCULADO");
  });

  it("28. orçamento agrupado quando solicitado (sem subtotais por cliente)", async () => {
    const h = await setup();
    const final = await fullConversation(h, "tudo junto");
    const t = h.allText(final);
    expect(t).toMatch(/Total: recomendado R\$/);
    expect(t).not.toMatch(/^Seu Roberto: recomendado/m);
  });

  it("22/23. falta de preço do verniz: pergunta preço e embalagem e retoma o orçamento", async () => {
    const h = await setup({ verniz: false });
    const ask = await fullConversation(h);
    expect(h.allText(ask)).toMatch(/preço atual do verniz/);
    const conf = await h.send("a lata de 900 ml custa 90 reais");
    const ok = buttonsOf(conf.at(-1)).find((d) => d.startsWith("mp:ok:"))!;
    const done = await h.click(ok);
    const t = h.allText(done);
    expect(t).toMatch(/Atualizei o preço do verniz/);
    expect(t).toMatch(/Aqui está o orçamento/);
    expect(t).toMatch(/Total: recomendado/);
  });

  it("25. material do estoque entra pelo preço de reposição", async () => {
    const h = await setup();
    const verniz = await h.ctx.db.first<{ id: string }>("SELECT id FROM materials WHERE key = 'verniz'");
    await h.ctx.db.run("INSERT INTO stock_movements (id, material_id, kind, quantity, historical_unit_cost_cents, created_at) VALUES ('s1', ?, 'ENTRADA', '10', '100', '2020-01-01T00:00:00Z')", verniz!.id);
    await h.send(REAL);
    for (const t of ["isso", "uma cômoda e um aparador", "inteira", "estão todos bons", "certo", "tudo junto", "médio", "pequeno", "pequeno", "pincel"]) await h.send(t);
    const r = await h.send("uso do estoque");
    expect(h.allText(r)).toMatch(/valor de reposição/);
    await h.send("não precisa");
    const q = await h.ctx.db.first<{ result_json: string }>("SELECT result_json FROM quotes LIMIT 1");
    const line = JSON.parse(q!.result_json).materials.lines.find((l: { materialKey: string }) => l.materialKey === "verniz");
    expect(Number(line.inventoryUsed)).toBeGreaterThan(0);
    expect(line.consumptionCostCents).toBeGreaterThan(0);
    expect(line.purchaseCashOutlayCents).toBe(0);
  });

  it("19/20. interrupção clara (pagamento) suspende e retoma o orçamento no ponto certo", async () => {
    const h = await setup();
    const maria = (await api(h, "POST", "/jobs", { description: "cadeira da dona Maria" })).json!.id as string;
    await api(h, "PATCH", `/jobs/${maria}/facts`, { field: "client_name", value: "Dona Maria" });
    await h.send(REAL);
    await h.send("isso"); // agora pergunta quais são os outros dois
    const pay = await h.send("A dona Maria me pagou 200 reais");
    expect(h.allText(pay)).toMatch(/recebi R\$ 200,00/);
    const done = await h.click("pay:confirm");
    const t = h.allText(done);
    expect(t).toMatch(/Anotado!/);
    expect(t).toMatch(/Agora, voltando ao orçamento dos 3 móveis/);
    expect(t).toMatch(/Quais são os outros dois móveis/);
    expect((await session(h)).flow).toBe("quote_request");
    expect(await count(h, "SELECT COUNT(*) AS n FROM payments")).toBe(1);
  });

  it("consulta no meio do orçamento é respondida e o objetivo continua", async () => {
    const h = await setup();
    await h.send(REAL);
    const r = await h.send("quais serviços eu tenho?");
    expect(h.allText(r)).toMatch(/Agora, voltando ao orçamento/);
    expect((await session(h)).flow).toBe("quote_request");
  });

  it("18. cancelar continua funcionando durante o fluxo", async () => {
    const h = await setup();
    await h.send(REAL);
    const r = await h.send("cancelar");
    expect(h.allText(r)).toMatch(/cancelei|parei/);
    expect((await session(h)).flow).toBe("idle");
    expect((await h.ctx.db.first<{ status: string }>("SELECT status FROM quote_requests"))!.status).toBe("CANCELADO");
  });

  it("35. áudio usa a transcrição no mesmo fluxo contextual", async () => {
    const h = await setup();
    h.ctx.ai.stt = h.stt;
    const r = await h.voice("aud-real", REAL);
    expect(h.allText(r)).toMatch(/são 3 móveis/);
    const r2 = await h.voice("aud-reply", REPLY);
    expect(h.allText(r2)).not.toMatch(/Vou marcar/);
    expect((await session(h)).flow).toBe("quote_request");
  });

  it("33. callback aparece de forma humana no painel", async () => {
    const h = await setup();
    await h.send(REAL);
    await h.click("qr:owner_yes");
    const res = await api(h, "GET", `/conversations?limit=50&userId=${h.artisanId}`);
    const cb = (res.json!.rows as { kind: string; display_text: string; text: string }[]).find((r) => r.kind === "callback")!;
    expect(cb.text).toBe("qr:owner_yes");
    expect(cb.display_text).toBe("Adriano confirmou de quem é cada peça");
    const detail = await api(h, "GET", `/conversations/${(res.json!.rows as { id: string; text: string }[]).find((r) => r.text === REAL)!.id}`);
    expect(detail.json!.routing).toMatchObject({ route: "global" });
  });
});

describe("Ajuste 2 — fluxo simples (legado) também respeita o contexto", () => {
  async function legacy(h: Harness) {
    await h.send("Peguei uma mesa da dona Ana para envernizar");
  }

  it("13. resposta 'precisa de reparos' à pergunta de estado é condição, não andamento", async () => {
    const h = await setup();
    await legacy(h);
    const r = await h.send("o tampo está precisando de reparos");
    expect(h.allText(r)).not.toMatch(/Vou marcar/);
    const job = await h.ctx.db.first<{ facts_json: string; status: string }>("SELECT facts_json, status FROM jobs");
    expect(JSON.parse(job!.facts_json).condition.value).toBe("reparos");
    expect(job!.status).toBe("ORCAMENTO");
  });

  it("15/34. andamento explícito interrompe, confirma e retoma a pergunta do orçamento", async () => {
    const h = await setup();
    await legacy(h);
    const r = await h.send("já comecei a mesa da dona Ana");
    expect(h.allText(r)).toMatch(/Vou marcar a mesa da Dona Ana como em execução/);
    const done = await h.click("prog:confirm");
    const t = h.allText(done);
    expect(t).toMatch(/agora está em execução/);
    expect(t).toMatch(/Agora, voltando/);
    expect(t).toMatch(/como ela está hoje/);
  });

  it("andamento 'ainda não comecei' não muda o status", async () => {
    const h = await setup();
    await legacy(h);
    await h.send("cancelar");
    const r = await h.send("ainda não comecei a mesa da dona Ana");
    expect(h.allText(r)).toMatch(/ainda não começou/);
    expect((await h.ctx.db.first<{ status: string }>("SELECT status FROM jobs"))!.status).toBe("ORCAMENTO");
  });

  it("34. regressões: compra, pagamento e estoque continuam funcionando", async () => {
    const h = await setup();
    await h.send("Comprei verniz");
    await h.send("90 reais");
    await h.send("1 lata de 900 ml");
    await h.click("exp:confirm");
    expect(await count(h, "SELECT COUNT(*) AS n FROM purchases")).toBe(1);
    expect(await count(h, "SELECT COUNT(*) AS n FROM material_price_history WHERE source = 'telegram_confirmed'")).toBe(1);
    await processOutbox(h.ctx);
  });
});

describe("Casal ou dois clientes (nomes ditos juntos)", () => {
  it("casal: vira um cliente só, sem perguntar de quem é cada peça nem agrupamento", async () => {
    const h = await setup();
    await h.send(REAL);
    const r = await h.send("é um casal");
    const t = h.allText(r);
    expect(t).toMatch(/Seu Roberto e Dona Jo ficam como um cliente só/);
    expect(t).not.toMatch(/de quem é cada peça/);
    const s = await session(h);
    const qr = s.ctx.quoteRequest as unknown as { draft: { clients: { name: string }[]; items: { ownerRef: string; ownerConfirmed: boolean }[] }; clientsRelation: string };
    expect(qr.clientsRelation).toBe("couple");
    expect(qr.draft.clients.map((c) => c.name)).toEqual(["Seu Roberto e Dona Jo"]);
    expect(qr.draft.items.every((i) => i.ownerConfirmed && i.ownerRef === "c1")).toBe(true);
  });

  it("botão 'Dois clientes' segue para de quem é cada peça", async () => {
    const h = await setup();
    await h.send(REAL);
    const r = await h.click("qr:separate");
    expect(h.allText(r)).toMatch(/Certo, são dois clientes/);
    expect(h.allText(r)).toMatch(/de quem é cada peça/);
  });

  it("'é dos dois' depois de 'dois clientes' pergunta antes de juntar (não contraria em silêncio)", async () => {
    const h = await setup();
    await h.send(REAL);
    await h.send("são dois clientes");
    const r = await h.send("a mesinha é dos dois");
    expect(h.allText(r)).toMatch(/quer que eu junte Seu Roberto e Dona Jo como um cliente só/);
    const yes = await h.send("sim");
    expect(h.allText(yes)).toMatch(/ficam como um cliente só/);
  });

  it("nomes em orações separadas não disparam a pergunta do casal", async () => {
    const h = await setup();
    const r = await h.send("Peguei uma mesa do Seu Roberto e uma cômoda da Dona Jo para envernizar, quanto cobro?");
    expect(h.allText(r)).not.toMatch(/casal/);
  });
});
