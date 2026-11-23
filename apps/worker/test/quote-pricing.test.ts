import { describe, expect, it } from "vitest";
import { buttonsOf, count, createHarness, STRANGER_TG, type Harness } from "./harness.js";
import { api } from "./helpers.js";
import { MockExtraction } from "../src/ai/providers.js";
import { processUpdate } from "../src/telegram/webhook.js";
import type { SentRecord } from "../src/telegram/client.js";

/** Catálogo calibrado com preços; os materiais em `missing` ficam SEM preço. */
async function setup(missing: string[] = ["verniz"]): Promise<Harness> {
  const h = await createHarness();
  await h.calibrateAndPrice();
  for (const key of missing) await h.ctx.db.run("UPDATE materials SET replacement_price_cents = NULL, price_updated_at = NULL WHERE key = ?", key);
  return h;
}

/** Serviço simples de verniz até o pedido de cálculo; devolve as respostas do cálculo. */
async function varnishJobAndCalc(h: Harness, client = "dona Ana") {
  await h.send(`Peguei uma mesa da ${client} para envernizar`);
  for (const t of ["está boa", "1 metro de largura, 80 de altura e 60 de fundura", "só por fora", "não", "pincel", "não precisa"]) await h.send(t);
  return h.click("calc:yes");
}

function okButton(replies: SentRecord[]): string {
  return buttonsOf(replies.at(-1)).find((d) => d.startsWith("mp:ok:"))!;
}

async function price(h: Harness, key: string) {
  return h.ctx.db.first<{ replacement_price_cents: number | null; package_size: string; origin: string; calibrated: number }>("SELECT replacement_price_cents, package_size, origin, calibrated FROM materials WHERE key = ?", key);
}

describe("Ajuste 1 — orçamento com preço ausente vira conversa com o artesão", () => {
  it("1. verniz sem preço: o bot pergunta ao artesão (não manda direto ao administrador)", async () => {
    const h = await setup();
    const r = await varnishJobAndCalc(h);
    const t = h.allText(r);
    expect(t).toMatch(/já estou quase terminando as contas da mesa da Dona Ana/);
    expect(t).toMatch(/preço atual do verniz/);
    expect(t).not.toMatch(/MATERIAL_PRICE_MISSING|Solicite ao administrador|administrador conferir/);
    expect(await count(h, "SELECT COUNT(*) AS n FROM quotes WHERE status = 'AGUARDANDO_REVISAO'")).toBe(0);
  });

  it("2. pergunta só os materiais usados pelo orçamento", async () => {
    const h = await setup(["verniz", "tinta_esmalte", "betume_patina"]);
    await varnishJobAndCalc(h);
    const s = await h.ctx.db.first<{ context_json: string }>("SELECT context_json FROM conversation_sessions");
    expect(JSON.parse(s!.context_json).pricing.pending).toEqual(["verniz"]);
  });

  it("3/16/18/19/20. preço e embalagem numa frase → confirma → grava com histórico e auditoria → recalcula", async () => {
    const h = await setup();
    await h.ctx.db.run("UPDATE materials SET calibrated = 0 WHERE key = 'verniz'");
    const before = await api(h, "GET", "/dashboard/summary");
    expect((before.json!.summary as { materialsWithoutPrice: number }).materialsWithoutPrice).toBe(1);
    await varnishJobAndCalc(h);
    const conf = await h.send("a lata de 900 ml custa 90 reais");
    expect(h.allText(conf)).toMatch(/Entendi: verniz, embalagem de 900 ml, por R\$ 90,00\. Está certo\?/);
    expect(buttonsOf(conf.at(-1))).toEqual(expect.arrayContaining(["mp:fix", "mp:later"]));
    expect((await price(h, "verniz"))!.replacement_price_cents).toBeNull(); // nada antes de confirmar
    const done = await h.click(okButton(conf));
    const t = h.allText(done);
    expect(t).toMatch(/Atualizei o preço do verniz/);
    expect(t).toMatch(/Vou refazer as contas/);
    expect(t).toMatch(/Valor recomendado: R\$/); // 18. recalculado automaticamente
    const m = await price(h, "verniz");
    expect(m).toMatchObject({ replacement_price_cents: 9000, package_size: "0.9", origin: "telegram_quote_confirmed", calibrated: 0 }); // 20
    const hist = await h.ctx.db.first<{ source: string; previous_price_cents: number | null; package_size: string; message_id: string | null; job_id: string | null; quote_id: string | null; confidence: string }>(
      "SELECT * FROM material_price_history WHERE source = 'telegram_quote_confirmed'",
    );
    expect(hist).toMatchObject({ previous_price_cents: null, package_size: "0.9", confidence: "alta" });
    expect(hist!.message_id).toBeTruthy();
    expect(hist!.job_id).toBeTruthy();
    expect(hist!.quote_id).toBeTruthy();
    expect(await count(h, "SELECT COUNT(*) AS n FROM audit_events WHERE action = 'material.price_from_quote'")).toBe(1);
    const q = await h.ctx.db.first<{ result_json: string; status: string }>("SELECT result_json, status FROM quotes");
    expect(JSON.parse(q!.result_json).blockers.map((b: { code: string }) => b.code)).not.toContain("MATERIAL_PRICE_MISSING");
    expect(q!.status).toBe("AGUARDANDO_REVISAO");
    const after = await api(h, "GET", "/dashboard/summary");
    expect((after.json!.summary as { materialsWithoutPrice: number }).materialsWithoutPrice).toBe(0); // 19
  });

  it("4. preço antes da embalagem", async () => {
    const h = await setup();
    await varnishJobAndCalc(h);
    const r1 = await h.send("Uns 90 reais.");
    expect(h.allText(r1)).toMatch(/essa embalagem de R\$ 90,00 é de quanto\?/);
    const r2 = await h.send("É a lata de 900 ml.");
    expect(h.allText(r2)).toMatch(/por volta de R\$ 90,00/); // "uns" → confiança intermediária
  });

  it("5. embalagem antes do preço", async () => {
    const h = await setup();
    await varnishJobAndCalc(h);
    const r1 = await h.send("é a lata de 900 ml");
    expect(h.allText(r1)).toMatch(/Anotei a embalagem de 900 ml\. E quanto ela custa\?/);
    const r2 = await h.send("noventa");
    expect(h.allText(r2)).toMatch(/900 ml, por R\$ 90,00/);
  });

  it("6. duas embalagens com valor total → preço por embalagem exato", async () => {
    const h = await setup();
    await varnishJobAndCalc(h);
    const conf = await h.send("Duas latas de 900 ml deram 180 reais");
    expect(h.allText(conf)).toMatch(/foram 2 embalagens de verniz, cada uma com 900 ml\. O total foi R\$ 180,00, então cada uma saiu por R\$ 90,00/);
    await h.click(okButton(conf));
    expect((await price(h, "verniz"))!.replacement_price_cents).toBe(9000);
  });

  it("7. resposta por áudio funciona igual", async () => {
    const h = await setup();
    h.ctx.ai.stt = h.stt;
    await varnishJobAndCalc(h);
    const r = await h.voice("aud-price", "o galão de três vírgula seis litros está 240 reais");
    expect(h.allText(r)).toMatch(/Ouvi:/);
    const r2 = await h.voice("aud-price2", "a lata de 900 ml custa 90 reais");
    expect(h.allText(r2)).toMatch(/900 ml, por R\$ 90,00/);
  });

  it("8. não sabe o preço: não inventa, não grava e oferece alternativas", async () => {
    const h = await setup();
    await varnishJobAndCalc(h);
    const r = await h.send("Não lembro, tenho que olhar");
    expect(h.allText(r)).toMatch(/Não vou chutar preço/);
    expect(buttonsOf(r.at(-1))).toEqual(expect.arrayContaining(["mp:later", "mp:photo", "mp:estimate", "mp:admin"]));
    expect((await price(h, "verniz"))!.replacement_price_cents).toBeNull();
    const est = await h.click("mp:estimate");
    expect(h.allText(est)).toMatch(/NÃO definitiva/);
  });

  it("9. pausa e retomada em outro dia", async () => {
    const h = await setup();
    await varnishJobAndCalc(h);
    await h.click("mp:later");
    h.advance(2);
    const r = await h.send("oi");
    expect(h.allText(r)).toMatch(/podemos continuar aquele orçamento da mesa da Dona Ana\? Faltava confirmar o preço do verniz/);
    const go = await h.click("mp:resume");
    expect(h.allText(go)).toMatch(/Quanto custa a embalagem de verniz/);
    const conf = await h.send("a lata de 900 ml custa 90 reais");
    await h.click(okButton(conf));
    expect((await price(h, "verniz"))!.replacement_price_cents).toBe(9000);
  });

  it("10. vários materiais pendentes: resumo, progresso e conclusão", async () => {
    const h = await setup(["verniz", "lixa", "solvente"]);
    const r = await varnishJobAndCalc(h);
    const t = h.allText(r);
    expect(t).toMatch(/preciso atualizar 3 materiais/);
    expect(t).toMatch(/Material 1 de 3/);
    let conf = await h.send("o pacote com 10 folhas custa 30 reais");
    expect(h.allText(conf)).toMatch(/R\$ 30,00/);
    let next = await h.click(okButton(conf));
    expect(h.allText(next)).toMatch(/Material 2 de 3/);
    conf = await h.send("a lata de 900 ml custa 90 reais");
    next = await h.click(okButton(conf));
    expect(h.allText(next)).toMatch(/Material 3 de 3/);
    conf = await h.send("a lata de 900 ml custa 25 reais");
    const done = await h.click(okButton(conf));
    expect(h.allText(done)).toMatch(/Atualizei os 3 materiais\. Vou recalcular o orçamento/);
    expect(h.allText(done)).toMatch(/Valor recomendado/);
  });

  it("11. material já atualizado não é perguntado de novo", async () => {
    const h = await setup();
    await varnishJobAndCalc(h);
    const conf = await h.send("a lata de 900 ml custa 90 reais");
    await h.click(okButton(conf));
    const second = await varnishJobAndCalc(h, "dona Bia");
    expect(h.allText(second)).not.toMatch(/preço atual do verniz/);
    expect(h.allText(second)).toMatch(/Valor recomendado/);
  });

  it("12. confirmação negativa permite corrigir o valor", async () => {
    const h = await setup();
    await varnishJobAndCalc(h);
    const conf = await h.send("a lata de 900 ml custa 90 reais");
    const fix = await h.click("mp:fix");
    expect(buttonsOf(fix.at(-1))).toEqual(["mp:fixprice", "mp:fixsize"]);
    await h.click("mp:fixprice");
    const conf2 = await h.send("85 reais");
    expect(h.allText(conf2)).toMatch(/900 ml, por R\$ 85,00/);
    await h.click(okButton(conf2));
    expect((await price(h, "verniz"))!.replacement_price_cents).toBe(8500);
    void conf;
  });

  it("13. duplo clique não duplica histórico", async () => {
    const h = await setup();
    await varnishJobAndCalc(h);
    const conf = await h.send("a lata de 900 ml custa 90 reais");
    const ok = okButton(conf);
    await h.click(ok);
    const again = await h.click(ok);
    expect(h.allText(again)).toMatch(/já foi resolvido|já está anotado/);
    expect(await count(h, "SELECT COUNT(*) AS n FROM material_price_history WHERE source = 'telegram_quote_confirmed'")).toBe(1);
    expect(await count(h, "SELECT COUNT(*) AS n FROM learning_observations WHERE kind = 'MATERIAL_PRICE_QUOTE'")).toBe(1);
  });

  it("14. valor inválido não atualiza o catálogo", async () => {
    const h = await setup();
    await varnishJobAndCalc(h);
    const r = await h.send("0 reais");
    expect(h.allText(r)).toMatch(/precisa ser maior que zero/);
    expect((await price(h, "verniz"))!.replacement_price_cents).toBeNull();
  });

  it("15. valor muito alto exige confirmação reforçada", async () => {
    const h = await setup();
    await varnishJobAndCalc(h);
    const r = await h.send("a lata de 900 ml custa 9.000 reais");
    expect(h.allText(r)).toMatch(/custa R\$ 9\.000,00 mesmo\?/);
    expect(buttonsOf(r.at(-1))).toContain("mp:fixprice");
    const fixed = await h.click("mp:fixprice");
    expect(h.allText(fixed)).toMatch(/Qual é o valor certo/);
    expect((await price(h, "verniz"))!.replacement_price_cents).toBeNull();
  });

  it("17. observação aparece em Conversas e aprendizado, com valor anterior e novo", async () => {
    const h = await setup();
    await varnishJobAndCalc(h);
    const conf = await h.send("a lata de 900 ml custa 90 reais");
    await h.click(okButton(conf));
    const res = await api(h, "GET", "/learning-observations");
    const row = (res.json!.rows as { kind: string; entity_key: string; data_json: string; origin: string; job_code: string; source_text: string }[]).find((r) => r.kind === "MATERIAL_PRICE_QUOTE")!;
    expect(row.entity_key).toBe("verniz");
    expect(row.origin).toBe("telegram_quote_confirmed");
    expect(row.job_code).toBe("S-0001");
    expect(row.source_text).toMatch(/900 ml custa 90/);
    expect(JSON.parse(row.data_json)).toMatchObject({ previousPriceCents: null, newPriceCents: 9000, newPackageSize: "0.9" });
  });

  it("21. usuário não autorizado não altera preços", async () => {
    const h = await setup();
    await varnishJobAndCalc(h);
    const conf = await h.send("a lata de 900 ml custa 90 reais");
    await processUpdate(h.ctx, { update_id: 99_001, callback_query: { id: "x", from: { id: STRANGER_TG }, data: okButton(conf) } });
    await processUpdate(h.ctx, { update_id: 99_002, message: { message_id: 1, from: { id: STRANGER_TG }, chat: { id: STRANGER_TG, type: "private" }, date: 0, text: "a lata custa 1 real" } });
    expect((await price(h, "verniz"))!.replacement_price_cents).toBeNull();
  });

  it("22. a IA não introduz preço não falado", async () => {
    const h = await setup();
    const ai = new MockExtraction();
    ai.response = { intent: "register_expense", confidence: 0.95, amountMentionedReais: 999, precoFinal: 999 };
    h.ctx.ai.extraction = ai;
    await varnishJobAndCalc(h);
    const r = await h.send("hmm deixa eu pensar aqui");
    expect(h.allText(r)).not.toMatch(/999/);
    expect((await price(h, "verniz"))!.replacement_price_cents).toBeNull();
  });

  it("23. falha no recálculo preserva o estado e permite tentar de novo", async () => {
    const h = await setup();
    await varnishJobAndCalc(h);
    const conf = await h.send("a lata de 900 ml custa 90 reais");
    const original = await h.ctx.db.first<{ recipe_json: string }>("SELECT recipe_json FROM techniques WHERE key = 'verniz'");
    await h.ctx.db.run("UPDATE techniques SET recipe_json = 'quebrado' WHERE key = 'verniz'");
    const fail = await h.click(okButton(conf));
    expect(h.allText(fail)).toMatch(/Tive um probleminha para refazer as contas/);
    expect(buttonsOf(fail.at(-1))).toEqual(["mp:retry"]);
    expect((await price(h, "verniz"))!.replacement_price_cents).toBe(9000); // preço já guardado
    await h.ctx.db.run("UPDATE techniques SET recipe_json = ? WHERE key = 'verniz'", original!.recipe_json);
    const retry = await h.click("mp:retry");
    expect(h.allText(retry)).toMatch(/Valor recomendado/);
  });

  it("24. o fluxo de compra existente continua funcionando e usa o mesmo serviço de preços", async () => {
    const h = await setup();
    await h.send("Comprei verniz");
    await h.send("180 reais");
    await h.send("2 latas de 900 ml");
    await h.click("exp:confirm");
    expect((await price(h, "verniz"))!).toMatchObject({ replacement_price_cents: 9000, origin: "telegram_confirmed" });
    expect(await count(h, "SELECT COUNT(*) AS n FROM material_price_history WHERE source = 'telegram_confirmed' AND previous_price_cents IS NULL")).toBe(1);
  });
});
