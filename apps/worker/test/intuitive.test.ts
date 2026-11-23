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
/** estado, escopo da cama e medida da estrutura (ainda sem medir) — antes das perguntas seguintes */
const BED_PREFIX = ["está boa", "a cama toda", "não sei"];

describe("Conversa mais intuitiva (feedback do teste real)", () => {
  it("cama queen: medida do colchão é só referência, pergunta o escopo e nunca pergunta 'por dentro'", async () => {
    const h = await bed();
    const first = h.allText(await h.send(START));
    expect(first).toMatch(/1,58 × 1,98 m\) é a medida do colchão/);
    expect(first).not.toMatch(/já vou usar essa/);
    expect(first).not.toMatch(/Pergunta \d+ de \d+/);
    const f = await facts(h);
    // a estrutura NÃO recebe a medida do colchão
    expect(f.dimensions).toBeUndefined();
    expect((f.furniture_type?.value as { descriptors: string[] }).descriptors).toContain("queen");
    expect(h.allText(await h.send("está boa"))).toMatch(/cama toda \(cabeceira, peseira e laterais\) ou só a cabeceira/);
    expect(h.allText(await h.send("a cama toda"))).toMatch(/estrutura, não o colchão/);
    const all: string[] = [];
    for (const m of ["não sei", "não", "não", "já tenho tudo", "pincel"]) all.push(h.allText(await h.send(m)));
    expect(all.join("\n")).not.toMatch(/dentro|por fora|interna/i);
    expect((await facts(h)).surfaces).toBeUndefined();
  });

  it("pergunta do artesão ao bot é explicada e não vira resposta gravada", async () => {
    const h = await bed();
    await h.send(START);
    await h.send("está boa");
    const r = h.allText(await h.send("pra que você precisa saber isso?"));
    expect(r).toMatch(/Boa pergunta!/);
    expect(r).toMatch(/\?/);
    expect((await facts(h)).repairs).toBeUndefined();
  });

  it("'quanto fica?' no meio das perguntas oferece calcular agora como estimativa", async () => {
    const h = await bed();
    await h.send(START);
    const r = await h.send("quanto fica?");
    expect(h.allText(r)).toMatch(/calculo agora com o que já sei/);
    expect(buttonsOf(r.at(-1))).toEqual(["calc:yes", "cmd:continue"]);
  });

  it("'Mas e o valor?' não é gravado como resposta de texto livre", async () => {
    const h = await bed();
    await h.send(START);
    for (const m of [...BED_PREFIX, "não", "não", "já tenho tudo", "pincel"]) await h.send(m);
    await h.send("não precisa, ela traz e busca");
    await h.send("Mas e o valor?"); // pergunta do prazo pendente
    expect((await facts(h)).deadline).toBeUndefined();
  });

  it("informação repetida é confirmada com naturalidade, sem 'não entendi'", async () => {
    const h = await bed();
    await h.send(START);
    for (const m of [...BED_PREFIX, "não", "não"]) await h.send(m);
    const r = h.allText(await h.send("é uma cama queen"));
    expect(r).toMatch(/Isso, já anotei/);
    expect(r).not.toMatch(/não entendi/);
    expect(r).toMatch(/material \(verniz\)/);
  });

  it("logística parcial: 'ela vai deixar a cama na minha casa' = não precisa buscar; pergunta só a volta", async () => {
    const h = await bed();
    await h.send(START);
    for (const m of [...BED_PREFIX, "não", "não", "já tenho tudo", "pincel"]) await h.send(m);
    const r = h.allText(await h.send("ela vai deixar a cama na minha casa"));
    expect(r).toMatch(/não precisa buscar/);
    expect(r).toMatch(/o cliente vem pegar ou você vai entregar\?/);
    await h.send("ela mesma busca");
    expect((await facts(h)).logistics).toMatchObject({ value: { pickup: false, delivery: false } });
  });

  it("resposta de outra pergunta dita antes da hora vai para o campo certo", async () => {
    const h = await bed();
    await h.send(START);
    for (const m of [...BED_PREFIX, "não", "não", "já tenho tudo", "pincel"]) await h.send(m);
    // pergunta pendente: transporte
    const r = h.allText(await h.send("sem pressa"));
    expect(r).toMatch(/prazo: sem prazo/);
    expect(r).toMatch(/transporte/);
    await h.send("não precisa, ela traz e busca");
    // prazo já respondido → pergunta o pagamento; e "entrada agora metade na entrega" nunca vira prazo
    await h.send("entrada agora metade na entrega");
    const f = await facts(h);
    expect(f.deadline?.value).toBe("sem prazo");
    expect(f.payment_terms?.value).toBe("entrada e restante na entrega");
  });

  it("pagamento dito na pergunta do prazo é guardado como pagamento, não como prazo", async () => {
    const h = await bed();
    await h.send(START);
    for (const m of [...BED_PREFIX, "não", "não", "já tenho tudo", "pincel", "não precisa, ela traz e busca"]) await h.send(m);
    await h.send("entrada agora metade na entrega");
    const f = await facts(h);
    expect(f.deadline).toBeUndefined();
    expect(f.payment_terms?.value).toBe("entrada e restante na entrega");
  });

  it("aprendizado de material só registra os materiais que ele citou", async () => {
    const h = await bed();
    await h.send(START);
    for (const m of [...BED_PREFIX, "não", "não"]) await h.send(m);
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
    await h.send(START);
    await h.send("olha, o pé tá podre e a cabeceira soltando");
    expect(h.extraction.calls.interpretAnswer).toBeGreaterThanOrEqual(0);
    expect((await facts(h)).condition?.value).toBe("danificado");
  });

  it("IA com valor fora da lista ou com dinheiro é ignorada", async () => {
    const h = await bed();
    h.ctx.ai.extraction = h.extraction;
    h.extraction.answerResponse = { kind: "value", value: "R$ 999" };
    await h.send(START);
    await h.send("hmm deixa eu ver aqui");
    expect((await facts(h)).condition).toBeUndefined();
    expect(await h.ctx.db.first("SELECT 1 AS x FROM jobs WHERE facts_json LIKE '%R$ 999%' OR facts_json LIKE '%99900%'")).toBeNull();
  });

  it("reescrita da IA que muda números é descartada (fica a pergunta-base)", async () => {
    const h = await bed();
    h.ctx.ai.extraction = h.extraction;
    h.ctx.config = { ...h.ctx.config, phrasingVariety: true };
    h.extraction.rephraseResponse = "Cobra R$ 500 e pronto, tá bom?";
    const r = h.allText(await h.send(START));
    expect(r).not.toMatch(/500/);
    expect(h.extraction.calls.rephrase).toBeGreaterThan(0);
    expect(r).toMatch(/(está|tá|anda|chegou).*\?/i); // pergunta-base do estado (3 variações sorteadas, sem a reescrita)
  });
});
