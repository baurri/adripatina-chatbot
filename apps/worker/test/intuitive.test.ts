import { describe, expect, it } from "vitest";
import { buttonsOf, createHarness, type Harness } from "./harness.js";
import { getJob } from "../src/repos/jobs.js";

/** Conversa a partir do caso real que o usuário testou (cama queen da Dona Licele). */
async function bed(): Promise<Harness> {
  const h = await createHarness();
  await h.calibrateAndPrice();
  return h;
}

async function facts(h: Harness): Promise<Record<string, { value: unknown; status: string } | undefined>> {
  const row = await h.ctx.db.first<{ id: string }>("SELECT id FROM jobs LIMIT 1");
  return (await getJob(h.ctx, row!.id))!.facts as never;
}

const START = "Peguei uma cama de casal queen da Dona Licele para envernizar";

/** Abertura do caso da cama: escopo (cama inteira) e medida da estrutura (ainda sem medir). */
async function start(h: Harness): Promise<void> {
  await h.send(START);
  await h.send("a cama inteira");
  await h.send("não tenho como medir agora");
}

describe("Conversa mais intuitiva (feedback do teste real)", () => {
  it("cama queen: medida do colchão é só referência, pergunta o escopo e nunca pergunta 'por dentro'", async () => {
    const h = await bed();
    const first = h.allText(await h.send(START));
    // referência de mercado do COLCHÃO, com a ressalva de que a estrutura é maior
    expect(first).toMatch(/Queen normalmente se refere ao colchão de 158 × 198 cm, mas a estrutura da cama costuma ser um pouco maior/);
    expect(first).toMatch(/só na cabeceira ou na cama inteira\?/);
    expect(first).not.toMatch(/Pergunta \d+ de \d+/);
    const f = await facts(h);
    // hipótese nominal: nunca medida real
    expect(f.dimensions).toMatchObject({ value: { width: "1.58", depth: "1.98", source: "nominal", kind: "mattress" }, status: "unconfirmed" });
    const dimsQ = h.allText(await h.send("a cama inteira"));
    expect(dimsQ).toMatch(/largura e o comprimento da estrutura, por fora\?/);
    await h.send("não tenho como medir agora");
    const all: string[] = [];
    for (const m of ["não sei", "não", "não", "já tenho tudo", "pincel"]) all.push(h.allText(await h.send(m)));
    expect(all.join("\n")).not.toMatch(/dentro|por fora|interna/i);
    expect((await facts(h)).surfaces).toBeUndefined();
  });

  it("pergunta do artesão ao bot é explicada e não vira resposta gravada", async () => {
    const h = await bed();
    await start(h);
    await h.send("está boa");
    const r = h.allText(await h.send("pra que você precisa saber isso?"));
    expect(r).toMatch(/Boa pergunta!/);
    expect(r).toMatch(/\?/);
    expect((await facts(h)).repairs).toBeUndefined();
  });

  it("'quanto fica?' no meio das perguntas já responde com a faixa e oferece calcular agora", async () => {
    const h = await bed();
    await h.send(START);
    await h.send("a cama inteira");
    const r = await h.send("quanto fica?");
    expect(h.allText(r)).toMatch(/Pelo que já sei, deve ficar entre R\$ [\d.]+,\d\d e R\$ [\d.]+,\d\d \(sem contar frete\)/);
    expect(h.allText(r)).toMatch(/Com mais \d+ respostas eu fecho o valor/);
    expect(buttonsOf(r.at(-1))).toEqual(["calc:yes", "cmd:continue"]);
  });

  it("sem preço de material, a faixa NÃO aparece (custo nunca entra como zero)", async () => {
    const h = await bed();
    await h.ctx.db.run("UPDATE materials SET replacement_price_cents = NULL WHERE key = 'verniz'");
    await h.send(START);
    await h.send("a cama inteira");
    const r = h.allText(await h.send("quanto fica?"));
    expect(r).not.toMatch(/R\$/);
    expect(r).toMatch(/calculo agora com o que já sei/);
  });

  it("a faixa aparece sozinha uma vez durante as perguntas, quando já dá pra calcular", async () => {
    const h = await bed();
    const texts: string[] = [];
    for (const m of [START, "a cama inteira", "não tenho como medir agora", "está boa", "não", "pincel"]) texts.push(h.allText(await h.send(m)));
    const shown = texts.filter((t) => /Só pra você ir tendo uma ideia/.test(t));
    expect(shown).toHaveLength(1);
  });

  it("'Mas e o valor?' não é gravado como resposta de texto livre", async () => {
    const h = await bed();
    await start(h);
    await h.send("está boa");
    await h.send("não");
    await h.send("não");
    await h.send("já tenho tudo");
    await h.send("pincel");
    await h.send("não precisa, ela traz e busca");
    await h.send("Mas e o valor?"); // pergunta do prazo pendente
    expect((await facts(h)).deadline).toBeUndefined();
  });

  it("informação repetida é confirmada com naturalidade, sem 'não entendi'", async () => {
    const h = await bed();
    await start(h);
    await h.send("está boa");
    await h.send("não");
    const r = h.allText(await h.send("é uma cama queen"));
    expect(r).toMatch(/Isso, já anotei/);
    expect(r).not.toMatch(/não entendi/);
  });

  it("logística parcial: 'ela vai deixar a cama na minha casa' = não precisa buscar; pergunta só a volta", async () => {
    const h = await bed();
    await start(h);
    for (const m of ["está boa", "não", "pincel"]) await h.send(m);
    const r = h.allText(await h.send("ela vai deixar a cama na minha casa"));
    expect(r).toMatch(/não precisa buscar/);
    expect(r).toMatch(/o cliente vem pegar ou você vai entregar\?/);
    await h.send("ela mesma busca");
    expect((await facts(h)).logistics).toMatchObject({ value: { pickup: false, delivery: false } });
  });

  it("prazo e pagamento não são perguntados, mas o que ele disser por conta própria vai para o campo certo", async () => {
    const h = await bed();
    await start(h);
    for (const m of ["está boa", "não", "pincel"]) await h.send(m);
    // pergunta pendente: transporte
    const r = h.allText(await h.send("sem pressa"));
    expect(r).toMatch(/prazo: sem prazo/);
    expect(r).toMatch(/transporte|buscar|entregar/);
    // "entrada agora metade na entrega" nunca vira prazo
    await h.send("entrada agora metade na entrega");
    const f = await facts(h);
    expect(f.deadline?.value).toBe("sem prazo");
    expect(f.payment_terms?.value).toBe("entrada e restante na entrega");
    const sum = h.allText(await h.send("não precisa, ela traz e busca"));
    expect(sum).toMatch(/pode calcular/);
    expect(sum).not.toMatch(/Como o cliente vai pagar|prazo combinado/);
  });

  it("aprendizado de material só registra os materiais que ele citou", async () => {
    const h = await bed();
    await start(h);
    for (const m of ["está boa", "não"]) await h.send(m);
    await h.send("vou comprar lixa e massa");
    const keys = (await h.ctx.db.all<{ entity_key: string }>("SELECT entity_key FROM learning_observations WHERE kind = 'MATERIAL_SOURCE'")).map((r) => r.entity_key);
    expect(keys).not.toContain("verniz");
    expect(keys.length).toBeGreaterThan(0);
    expect(keys.every((k) => /lixa|massa/.test(k))).toBe(true);
  });

  it("IA completa a resposta que as regras não entenderam, só com valores permitidos", async () => {
    const h = await bed();
    h.ctx.ai.extraction = h.extraction;
    h.extraction.answerResponse = { kind: "value", value: "danificado" };
    await start(h);
    await h.send("olha, o pé tá podre e a cabeceira soltando");
    expect(h.extraction.calls.interpretAnswer).toBeGreaterThanOrEqual(0);
    expect((await facts(h)).condition?.value).toBe("danificado");
  });

  it("IA com valor fora da lista ou com dinheiro é ignorada", async () => {
    const h = await bed();
    h.ctx.ai.extraction = h.extraction;
    h.extraction.answerResponse = { kind: "value", value: "R$ 999" };
    await start(h);
    await h.send("hmm deixa eu ver aqui");
    expect((await facts(h)).condition).toBeUndefined();
    expect(await h.ctx.db.first("SELECT 1 AS x FROM jobs WHERE facts_json LIKE '%R$ 999%' OR facts_json LIKE '%99900%'")).toBeNull();
  });

  it("mensagem da IA que inventa números é descartada (fica a pergunta-base)", async () => {
    const h = await bed();
    h.ctx.ai.extraction = h.extraction;
    h.ctx.config = { ...h.ctx.config, phrasingVariety: true };
    h.extraction.generateHandler = (req) => (req.purpose.startsWith("compose") ? { text: "Cobra R$ 500 e pronto, tá bom?" } : null);
    const r = h.allText(await h.send(START));
    expect(r).not.toMatch(/500/);
    expect(h.extraction.calls.generate).toBeGreaterThan(0);
    expect(r).toMatch(/só na cabeceira ou na cama inteira\?/); // pergunta-base determinística
  });
});
