import { describe, expect, it } from "vitest";
import { isRealMeasurement } from "@adripatina/domain";
import { buttonsOf, count, createHarness, type Harness } from "./harness.js";
import { createJob, getJob, setFact } from "../src/repos/jobs.js";
import { buildPricingInput } from "../src/services/quotes.js";
import { getActiveSettings } from "../src/repos/catalog.js";

/**
 * Rodada de validação 22/11/2026 (simulação do uso real). Banco SQLite em memória com as
 * migrations de produção, Telegram e IA simulados: nada sai da máquina.
 */
const REAL = "Preciso pegar terça uma mesinha do seu Roberto e dois móveis da Dona Jo, acho que uma cômoda e um aparador. É pra lixar e passar verniz. Quanto eu cobro?";

async function setup(): Promise<Harness> {
  const h = await createHarness();
  h.clock.now = new Date("2026-11-22T15:00:00Z");
  await h.calibrateAndPrice();
  return h;
}

type QrCtx = { quoteRequest?: { step: string; grouping?: string; notes?: string[]; removed?: { description: string }[]; draft: { items: { ref: string; description: string; furnitureType: string | null; quantity: number; ownerRef: string | null; condition: string | null; affectedPart: string | null }[]; clients: { ref: string; name: string }[] } } };
async function qr(h: Harness) {
  const s = await h.ctx.db.first<{ flow: string; context_json: string }>("SELECT flow, context_json FROM conversation_sessions LIMIT 1");
  return { flow: s!.flow, q: (JSON.parse(s!.context_json) as QrCtx).quoteRequest };
}

describe("Cenário 1 — vários clientes e móveis", () => {
  it("3 peças (não 5), donos preservados, data, objetivo, nada criado antes de confirmar", async () => {
    const h = await setup();
    const t = h.allText(await h.send(REAL));
    expect(t).toMatch(/são 3 móveis para lixar e envernizar/);
    expect(t).toMatch(/24\/11\/2026/);
    expect(t).toMatch(/quanto cobrar/);
    expect(t).toMatch(/a mesinha é do Seu Roberto; a cômoda e o aparador são da Dona Jo\?/);
    const { q } = await qr(h);
    expect(q!.draft.items.map((i) => i.furnitureType)).toEqual(["mesa", "comoda", "aparador"]);
    expect(await count(h, "SELECT COUNT(*) AS n FROM jobs")).toBe(0);
  });
});

describe("Cenários 2 e 3 — condição × andamento", () => {
  it("'o tampo está ruim, os outros melhores' sem dizer a peça: nada é aplicado a todas, e a frase volta na pergunta de estado", async () => {
    const h = await setup();
    await h.send(REAL);
    const r = h.allText(await h.send("O tampo está ruim e precisa de reparo, os outros estão melhores."));
    expect(r).toMatch(/Já já te pergunto de qual peça é/);
    expect(r).not.toMatch(/em execução|Vou marcar/);
    const { q } = await qr(h);
    expect(q!.draft.items.every((i) => i.condition === null)).toBe(true);
    expect(q!.notes?.length).toBeGreaterThan(0);
  });

  it("'já comecei a lixar a mesa' durante o orçamento: reconhece, não cria serviço, não perde o objetivo", async () => {
    const h = await setup();
    await h.send(REAL);
    const r = h.allText(await h.send("Já comecei a lixar a mesa do Roberto."));
    expect(r).toMatch(/já começou/);
    expect(r).toMatch(/voltando ao orçamento dos 3 móveis/);
    expect(await count(h, "SELECT COUNT(*) AS n FROM jobs")).toBe(0);
    expect((await qr(h)).flow).toBe("quote_request");
  });
});

describe("Cenários 8, 9 e 10 — correções no meio do pedido", () => {
  it("troca de dono, separar/juntar e 'esquece o aparador' só mexem no que foi dito", async () => {
    const h = await setup();
    await h.send(REAL);
    await h.send("Isso");
    const r1 = h.allText(await h.send("A cômoda não é da Dona Jo não, é do Roberto."));
    expect(r1).toMatch(/Corrigi: a cômoda é do Seu Roberto/);
    let { q } = await qr(h);
    const roberto = q!.draft.clients.find((c) => c.name === "Seu Roberto")!.ref;
    expect(q!.draft.items.find((i) => i.furnitureType === "comoda")!.ownerRef).toBe(roberto);
    expect(q!.draft.items.find((i) => i.furnitureType === "aparador")!.ownerRef).not.toBe(roberto);

    await h.send("Quero separado, um orçamento pro Roberto e outro pra Dona Jo.");
    expect((await qr(h)).q!.grouping).toBe("por_cliente");
    await h.send("Pode juntar tudo num orçamento só.");
    expect((await qr(h)).q!.grouping).toBe("agrupado");

    const r2 = h.allText(await h.send("Esquece o aparador, ela não vai mais fazer."));
    expect(r2).toMatch(/tirei o aparador do orçamento/);
    ({ q } = await qr(h));
    expect(q!.draft.items.map((i) => i.furnitureType)).toEqual(["mesa", "comoda"]);
    expect(q!.removed?.map((x) => x.description)).toEqual(["aparador"]);
    expect((await qr(h)).flow).toBe("quote_request");
    expect(await count(h, "SELECT COUNT(*) AS n FROM quote_requests WHERE status = 'CANCELADO'")).toBe(0);
    expect(await count(h, "SELECT COUNT(*) AS n FROM audit_events WHERE action = 'quote_request.item_removed'")).toBe(1);
  });

  it("'esquece o X' sem pedido aberto não apaga nada nem cria serviço", async () => {
    const h = await setup();
    const r = h.allText(await h.send("esquece o aparador"));
    expect(r).toMatch(/Não apaguei nada/);
    expect(await count(h, "SELECT COUNT(*) AS n FROM jobs")).toBe(0);
  });
});

describe("Cenário 6 — serviço parcial", () => {
  it("'na mesa é inteira, nos outros dois só o tampo' aplica a cada peça certa (antes invertia)", async () => {
    const h = await setup();
    await h.send("Peguei três móveis da dona Ana: uma mesa, uma cômoda e um aparador, pra envernizar. Quanto cobro?");
    await h.send("Na mesa é inteira. Nos outros dois é só o tampo.");
    const { q } = await qr(h);
    expect(q!.draft.items.map((i) => [i.furnitureType, i.affectedPart])).toEqual([
      ["mesa", "inteiro"],
      ["comoda", "tampo"],
      ["aparador", "tampo"],
    ]);
  });
});

describe("Cenário 4 — cama queen (medida nominal)", () => {
  it("158×198 é só referência: a estrutura não recebe a medida, o escopo é perguntado e o orçamento fica preliminar", async () => {
    const h = await setup();
    // "cama" sozinha não diz o tamanho: o catálogo pergunta qual é
    const t = h.allText(await h.send("Peguei uma cama da Dona Licele pra envernizar"));
    expect(t).toMatch(/Essa cama é qual destes/i);
    const r = h.allText(await h.send("É uma cama queen."));
    expect(r).toMatch(/colchão de 158 × 198 cm, mas a estrutura da cama costuma ser um pouco maior/);
    const job = (await getJob(h.ctx, (await h.ctx.db.first<{ id: string }>("SELECT id FROM jobs"))!.id))!;
    // a medida do colchão fica só como HIPÓTESE (nunca medida real da estrutura)
    expect(job.facts.dimensions?.value).toMatchObject({ source: "nominal", kind: "mattress" });
    expect(isRealMeasurement(job.facts.dimensions?.value as never)).toBe(false);
    expect(h.allText(await h.send("a cama toda"))).toMatch(/estrutura, por fora/);
    for (const m of ["não sei", "está boa", "não", "não", "já tenho tudo", "pincel", "não precisa", "sem prazo", "à vista"]) await h.send(m);
    await h.send("pode calcular");
    const quote = await h.ctx.db.first<{ definitive_allowed: number; result_json: string }>("SELECT definitive_allowed, result_json FROM quotes ORDER BY created_at DESC LIMIT 1");
    expect(quote).not.toBeNull();
    expect(quote!.definitive_allowed).toBe(0);
    expect(quote!.result_json).toMatch(/DIMENSIONS_NOMINAL/);
    expect(quote!.result_json).toMatch(/nominal_queen_158/);
  });
});

describe("Cenário 5 — 'mesinha' ambígua", () => {
  it("pergunta o tipo com botões; o botão cria o serviço certo; botão repetido não faz nada", async () => {
    const h = await setup();
    const r = await h.send("Peguei uma mesinha da dona Ana pra pintar");
    expect(h.allText(r)).toMatch(/de centro, lateral, de cabeceira ou de apoio/);
    expect(buttonsOf(r.at(-1))).toEqual(["amb:0:0", "amb:0:1", "amb:0:2", "amb:0:3"]);
    expect(await count(h, "SELECT COUNT(*) AS n FROM jobs")).toBe(0);
    await h.click("amb:0:2");
    const job = (await getJob(h.ctx, (await h.ctx.db.first<{ id: string }>("SELECT id FROM jobs"))!.id))!;
    expect((job.facts.furniture_type?.value as { type: string }).type).toBe("mesa_cabeceira");
    expect(h.allText(await h.click("amb:0:2"))).toMatch(/já foi respondida/);
    expect(await count(h, "SELECT COUNT(*) AS n FROM jobs")).toBe(1);
  });
});

describe("Quantidade chega ao cálculo (P0: '2 cadeiras' era precificado como 1)", () => {
  it("área usada = área de 1 peça × quantidade (verificação independente pela faixa do porte)", async () => {
    const h = await setup();
    const settings = await getActiveSettings(h.ctx);
    const opts = { actor: h.artisanId, source: "telegram_text" as const };
    const make = async (quantity?: number) => {
      const job = await createJob(h.ctx, { actor: h.artisanId, description: "teste" });
      await setFact(h.ctx, job.id, "furniture_type", { type: "cadeira", ...(quantity ? { quantity } : {}) }, opts);
      await setFact(h.ctx, job.id, "size_class", "medio", opts);
      return (await buildPricingInput(h.ctx, (await getJob(h.ctx, job.id))!)).input.area;
    };
    const one = await make();
    const three = await make(3);
    const [min, max] = settings.params.sizeClassAreaM2.medio;
    expect(one).toMatchObject({ kind: "range", minM2: String(Number(min)), maxM2: String(Number(max)) });
    if (three?.kind !== "range") throw new Error("faixa esperada");
    expect(Number(three.minM2)).toBeCloseTo(Number(min) * 3, 3);
    expect(Number(three.maxM2)).toBeCloseTo(Number(max) * 3, 3);
  });

  it("no pedido com vários itens, a quantidade é gravada no serviço", async () => {
    const h = await setup();
    await h.send("três cadeiras da dona Ana pra pintar, quanto cobro");
    await h.send("estão boas");
    await h.send("certo");
    await h.send("médio");
    const fv = await h.ctx.db.first<{ facts_json: string }>("SELECT facts_json FROM jobs LIMIT 1");
    expect(fv).not.toBeNull();
    expect(JSON.parse(fv!.facts_json).furniture_type.value.quantity).toBe(3);
  });
});

describe("Etapa 5 — compras: unitário × total, compra mista", () => {
  it("'duas latas por 150' e depois 'foi 150 cada' = R$ 300 (2 × R$ 150)", async () => {
    const h = await setup();
    const r1 = h.allText(await h.send("Comprei duas latas de verniz por 150"));
    expect(r1).toMatch(/de que tamanho/); // não pergunta de novo quantas latas
    const r2 = h.allText(await h.send("foi 150 cada, lata de 900 ml"));
    expect(r2).toMatch(/R\$ 300,00 \(2 × R\$ 150,00\)/);
  });

  it("compra mista nunca vira preço de um material só", async () => {
    const h = await setup();
    const before = await h.ctx.db.first<{ p: number }>("SELECT replacement_price_cents AS p FROM materials WHERE key = 'verniz'");
    const r = h.allText(await h.send("Comprei tinta, verniz e lixa por 300"));
    expect(r).toMatch(/compra só de tinta, verniz e lixa/);
    await h.click("exp:confirm");
    const after = await h.ctx.db.first<{ p: number }>("SELECT replacement_price_cents AS p FROM materials WHERE key = 'verniz'");
    expect(after!.p).toBe(before!.p);
    expect(await count(h, "SELECT COUNT(*) AS n FROM material_price_history")).toBe(0);
  });

  it("'a tinta foi 120, o resto não lembro' registra só a tinta", async () => {
    const h = await setup();
    await h.send("Comprei tinta, verniz e lixa");
    const r = h.allText(await h.send("A tinta foi 120, o resto eu não lembro."));
    expect(r).toMatch(/anoto só a tinta por R\$ 120,00/);
    expect(r).toMatch(/Verniz e lixa ficam sem valor/);
  });
});

describe("Etapa 11 — valores e datas", () => {
  it("'1000.50 reais' é R$ 1.000,50 (antes virava R$ 50,00)", async () => {
    const h = await setup();
    await h.send("Peguei uma cômoda da dona Ana pra pintar");
    const r = h.allText(await h.send("A dona Ana me pagou 1000.50 reais"));
    expect(r).toMatch(/R\$ 1\.000,50/);
    expect(r).not.toMatch(/R\$ 50,00/);
  });

  it("data citada não é presumida como retirada; 'dia 5' vira 05/12/2026 com pedido de confirmação", async () => {
    const h = await setup();
    const r = h.allText(await h.send("duas cadeiras da dona Ana pra pintar, entrego dia 5"));
    expect(r).toMatch(/Anotei a data: dia 5 \(05\/12\/2026\) — se for outro dia, me avisa/);
    expect(r).not.toMatch(/retirada/);
  });
});

describe("Etapa 16 — invariantes de negação e contexto", () => {
  it.each(["ainda não terminei a cômoda", "a cômoda ainda não está pronta", "não entreguei ainda"])("'%s' nunca propõe mudar o andamento", async (text) => {
    const h = await setup();
    await h.send("Peguei uma cômoda da dona Ana pra pintar");
    await h.send("tá boa");
    const r = h.allText(await h.send(text));
    expect(r).not.toMatch(/Vou marcar/);
    expect(await count(h, "SELECT COUNT(*) AS n FROM jobs WHERE status IN ('EM_EXECUCAO','CONCLUIDO','ENTREGUE')")).toBe(0);
  });

  it("pedido com vários móveis no meio da coleta de outro serviço vira objetivo de orçamento (não 1 serviço só)", async () => {
    const h = await setup();
    await h.send("Peguei uma cômoda da dona Bia pra pintar");
    const r = h.allText(await h.send(REAL));
    expect(r).toMatch(/são 3 móveis/);
    expect((await qr(h)).flow).toBe("quote_request");
    expect(await count(h, "SELECT COUNT(*) AS n FROM jobs")).toBe(1); // só a cômoda da Dona Bia
  });

  it("'não são duas, são três' corrige a quantidade; 'uma quebrada, as outras boas' separa a unidade", async () => {
    const h = await setup();
    await h.send("duas cadeira pra dona ana lixar e pintar quanto cobro");
    expect(h.allText(await h.send("não são duas são três"))).toMatch(/Corrigi: são 3 cadeiras/);
    await h.send("uma tá quebrada as outra tá boa");
    const { q } = await qr(h);
    expect(q!.draft.items.map((i) => [i.quantity, i.condition])).toEqual([
      [1, "danificado"],
      [2, "bom"],
    ]);
    expect(q!.draft.clients.map((c) => c.name)).toEqual(["Dona Ana"]); // "lixar" não virou sobrenome
  });
});

describe("Etapa 10 — concorrência de sessão", () => {
  it("gravação com versão antiga é registrada como conflito e não perde a mensagem atual", async () => {
    const h = await setup();
    await h.send("oi");
    const { loadSession, saveSession } = await import("../src/repos/sessions.js");
    const a = await loadSession(h.ctx, h.artisanId);
    const b = await loadSession(h.ctx, h.artisanId);
    a.lastQuestion = null;
    await saveSession(h.ctx, a); // versão avança
    b.flow = "idle";
    (b.context as { marker?: string }).marker = "segunda-mensagem";
    await saveSession(h.ctx, b); // versão antiga → conflito detectado, mas grava
    expect(await count(h, "SELECT COUNT(*) AS n FROM audit_events WHERE action = 'session.conflict'")).toBe(1);
    const row = await h.ctx.db.first<{ context_json: string }>("SELECT context_json FROM conversation_sessions WHERE user_id = ?", h.artisanId);
    expect(row!.context_json).toMatch(/segunda-mensagem/);
  });
});
