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
    for (const m of ["não sei", "está boa", "não", "pincel", "não precisa"]) await h.send(m);
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

describe("Regressões da integração com o catálogo mestre (23/11/2026)", () => {
  it("'mesa de oito cadeira' continua sendo mesa no catálogo", async () => {
    const h = await setup();
    const r = h.allText(await h.send("Peguei uma mesa grandona de oito cadeira da dona Ana pra envernizar"));
    expect(r).toMatch(/móvel: mesa/);
    expect(r).not.toMatch(/móvel: cadeira/);
  });

  it("móvel sem nome não grava a frase inteira como descrição", async () => {
    const h = await setup();
    await h.send("Peguei um móvel antigo que não sei o nome da dona Ana pra pintar");
    const row = await h.ctx.db.first<{ facts_json: string }>("SELECT facts_json FROM jobs LIMIT 1");
    expect(row!.facts_json).not.toMatch(/Peguei um m/);
  });

  it("'móvel onde põe as louças' pede esclarecimento em vez de cadastrar 'móvel'", async () => {
    const h = await setup();
    const r = await h.send("Peguei aquele móvel onde põe as louças da dona Ana pra pintar");
    expect(buttonsOf(r.at(-1))).toEqual(["amb:1:0", "amb:1:1", "amb:1:2"]);
    expect(await count(h, "SELECT COUNT(*) AS n FROM jobs")).toBe(0);
  });

  it("pergunta de tipo usa o nome com acento ('sofá', não 'sofa')", async () => {
    const h = await setup();
    const r = h.allText(await h.send("Peguei um sofá que vira cama da dona Ana pra pintar"));
    expect(r).not.toMatch(/\bsofa\b/);
  });

  it("'não tenho as medidas agora' segue como estimativa, sem insistir", async () => {
    const h = await setup();
    for (const m of ["Peguei três móveis da dona Ana: uma mesa, uma cômoda e um aparador, pra envernizar. Quanto cobro?", "Na mesa é inteira. Nos outros dois é só o tampo.", "estão bons", "certo"]) await h.send(m);
    expect(h.allText(await h.send("Não tenho as medidas agora."))).toMatch(/sigo sem a medida/);
  });
});

describe("travas do orçamento (produção 23/11/2026)", () => {
  /** reproduz a conversa do administrador: método "não sei" e material sem preço */
  async function deferredMethod(h: Harness) {
    await h.ctx.db.run("UPDATE materials SET replacement_price_cents = NULL, price_updated_at = NULL WHERE key = 'verniz'");
    await h.send("Peguei uma mesa da dona Ana para envernizar");
    for (const t of ["está boa", "1 metro de largura, 80 de altura e 60 de fundura", "só por fora", "não", "ainda não sei", "não precisa"]) await h.send(t);
  }

  it("bloqueio por campo deixado pra depois vira pergunta, não volta ao 'pode calcular?'", async () => {
    const h = await setup();
    await deferredMethod(h);
    const r = h.allText(await h.click("calc:yes"));
    expect(r).toMatch(/sem isso o cálculo não sai/);
    expect(r).toMatch(/pincel|rolo|pistola/);
    expect(r).not.toMatch(/Pode calcular|pode calcular/);
    // respondeu o método → recalcula direto e cai na coleta do preço do verniz
    const p = h.allText(await h.send("pincel"));
    expect(p).toMatch(/preço atual do verniz/);
    expect(p).not.toMatch(/Dá uma conferida/);
  });

  it("bloqueio que o artesão não resolve (técnica não cadastrada) não vira pergunta; campo confirmado também não", async () => {
    const { blockingField } = await import("../src/conversation/engine.js");
    const job = (facts: Record<string, { status: string }>) => ({ facts }) as unknown as Parameters<typeof blockingField>[0];
    expect(blockingField(job({ application_method: { status: "unknown" } }), [{ code: "METHOD_REQUIRED" }])).toBe("application_method");
    expect(blockingField(job({}), [{ code: "AREA_UNKNOWN" }])).toBe("dimensions");
    expect(blockingField(job({ application_method: { status: "confirmed" } }), [{ code: "METHOD_REQUIRED" }])).toBeNull();
    expect(blockingField(job({}), [{ code: "TECHNIQUE_UNKNOWN", ref: "decape_x" }])).toBeNull();
    expect(blockingField(job({}), [{ code: "MATERIAL_UNKNOWN", ref: "x" }])).toBeNull();
  });
});

describe("IA não inventa frases (produção 23/11/2026: 'alguém do meu filho quebrou a perna da mesa')", async () => {
  const { validateComposed } = await import("@adripatina/conversations");
  const base = "Tem alguma coisa pra consertar primeiro, como uma perna bamba, uma lasca ou uma tábua solta? Se não tiver, me avisa.";
  const plan = { purpose: "ask_repairs", fallback: base, question: base, keyTerms: ["consertar"], facts: ["móvel: criado-mudo", "cliente: Seu Abreu", "só por fora"], names: ["Administrador", "Seu Abreu"], greet: false };

  it("recusa frase com conteúdo novo (a mensagem real de produção)", () => {
    const r = validateComposed(plan, { text: "Alguém do meu filho, brincando, quebrou a perna da mesa. Tem alguma coisa pra consertar primeiro, como uma perna bamba, uma lasca ou uma tábua solta?" });
    expect(r.ok).toBe(false);
    expect(validateComposed(plan, { text: "Minha esposa adora esse tipo de móvel! Tem alguma coisa pra consertar primeiro?" }).ok).toBe(false);
    expect(validateComposed(plan, { text: "Ontem choveu bastante na cidade. Tem alguma coisa pra consertar primeiro?" }).ok).toBe(false);
  });

  it("aceita reescrita fiel, com nome e palavras de tom", () => {
    expect(validateComposed(plan, { text: "Beleza, Administrador. Antes da pintura, tem alguma coisa pra consertar no criado-mudo, tipo uma perna bamba ou uma lasca?" }).reasons).toEqual([]);
    expect(validateComposed(plan, { text: "O criado-mudo do Seu Abreu precisa consertar alguma coisa antes, como uma tábua solta?" }).reasons).toEqual([]);
  });
});

describe("IA mantém o tratamento e quem faz a ação (produção 23/11/2026)", async () => {
  const { validateComposed } = await import("@adripatina/conversations");
  const pay = "Como o cliente vai pagar? Por exemplo: \"à vista\" ou \"metade agora e metade na entrega\".";
  const payPlan = { purpose: "ask_payment_terms", fallback: pay, question: pay, keyTerms: ["pagar"], facts: [], names: ["Administrador", "Seu Abreu"], greet: false };
  const tech = "O que você vai fazer no criado-mudo? Pintar, dar pátina, passar verniz ou um conserto?";
  const techPlan = { purpose: "ask_techniques", fallback: tech, question: tech, keyTerms: ["fazer"], facts: ["móvel: criado-mudo"], names: ["Administrador"], greet: false };

  it("recusa as mensagens reais", () => {
    expect(validateComposed(payPlan, { text: "Última coisinha: E sobre o pagamento? Preferes pagar à vista, ou então metade agora e metade na entrega?" }).ok).toBe(false);
    expect(validateComposed(techPlan, { text: "O que o senhor vai fazer no criado-mudo? Pintar, dar pátina, passar verniz ou um conserto? Conforme o senhor preferir." }).ok).toBe(false);
    expect(validateComposed(payPlan, { text: "Por favor, diga-me como o cliente vai pagar: à vista ou metade agora e metade na entrega?" }).ok).toBe(false);
  });

  it("aceita a mesma pergunta em português do Brasil", () => {
    expect(validateComposed(payPlan, { text: "E o pagamento: o cliente vai pagar à vista ou metade agora e metade na entrega?" }).reasons).toEqual([]);
    expect(validateComposed(payPlan, { text: "E o Seu Abreu vai pagar como: à vista ou metade agora e metade na entrega?" }).reasons).toEqual([]);
  });
});

/** último parágrafo da resposta (a pergunta), sem o reconhecimento da resposta anterior */
const lastQuestion = (reply: string): string => reply.split(/\n\n|\n---\n/).at(-1) ?? reply;

describe("conversa real do administrador refeita (23/11/2026): mais curta, sem perder nada", () => {
  async function abreu(h: Harness) {
    const out: string[] = [];
    for (const m of [
      "E aí, consigo fazer um novo orçamento já? É o móvel do seu Abreu e da dona Isa. É uma mesa de cabeceira.",
      "Eu tenho que fazer uma reforminha assim, eu tenho que lixar e pintar de azul marinho.",
      "bom",
      "media",
    ]) out.push(h.allText(await h.send(m)));
    return out;
  }

  it("segundo dono e cor viram observações; o resumo mostra", async () => {
    const h = await setup();
    const out = await abreu(h);
    expect(out.join("\n")).toMatch(/também citado: Dona Isa/);
    expect(out.join("\n")).toMatch(/cor: azul marinho/);
    const job = (await h.ctx.db.first<{ id: string }>("SELECT id FROM jobs"))!;
    const facts = (await getJob(h.ctx, job.id))!.facts;
    expect(facts.details?.value).toMatch(/Dona Isa.*azul marinho|azul marinho.*Dona Isa/);
  });

  it("questionário não pergunta material, terceiros, prazo nem pagamento antes do orçamento", async () => {
    const h = await setup();
    const asked: string[] = await abreu(h);
    let r = asked.at(-1)!;
    for (let i = 0; i < 8 && !/pode calcular/.test(r); i++) {
      const q = lastQuestion(r);
      const answer = /conserto/i.test(q) ? "não" : /pincel|rolo|pistola/i.test(q) ? "pincel" : /buscar|entregar|transporte/i.test(q) ? "não precisa" : /fora|dentro/i.test(q) ? "só por fora" : "não sei";
      r = h.allText(await h.send(answer));
      asked.push(r);
    }
    const all = asked.join("\n");
    expect(r).toMatch(/pode calcular/);
    expect(all).not.toMatch(/já tem aí em casa|vai precisar comprar\?|marceneiro ou (um )?tapeceiro|prazo combinado|Como o cliente vai pagar/i);
    expect(asked.length).toBeLessThanOrEqual(9);
  });

  it("'e aí, vc tá bem?' no resumo: responde e lembra curto; 'quero começar de novo' pede confirmação e recomeça", async () => {
    const h = await setup();
    const out = await abreu(h);
    let r = out.at(-1)!;
    for (let i = 0; i < 8 && !/pode calcular/.test(r); i++) {
      const q = lastQuestion(r);
      r = h.allText(await h.send(/conserto/i.test(q) ? "não" : /pincel|rolo|pistola/i.test(q) ? "pincel" : /fora|dentro/i.test(q) ? "só por fora" : "não precisa"));
    }
    const social = h.allText(await h.send("e ai, vc ta bem?"));
    expect(social).toMatch(/Tudo (certo|bem)/);
    expect(social).toMatch(/Quer que eu calcule\?/);
    const restart = await h.send("quero começar de novo");
    expect(buttonsOf(restart.at(-1))).toEqual(["rst:yes", "cmd:continue"]);
    const done = h.allText(await h.click("rst:yes"));
    expect(done).toMatch(/recomecei/);
    expect((await h.ctx.db.first<{ status: string }>("SELECT status FROM jobs"))!.status).toBe("CANCELADO");
    const s = await h.ctx.db.first<{ flow: string }>("SELECT flow FROM conversation_sessions");
    expect(s!.flow).toBe("idle");
  });

  it("teste de áudio responde que chegou, sem 'não entendi'", async () => {
    const h = await setup();
    const r = h.allText(await h.send("testando o áudio, tá chegando?"));
    expect(r).toMatch(/Tô aqui|chegando direitinho/);
    expect(r).not.toMatch(/Não entendi/);
  });
});
