import { describe, expect, it } from "vitest";
import { buttonsOf, count, createHarness, type Harness } from "./harness.js";

async function startCristaleira(h: Harness) {
  await h.send("Peguei uma cristaleira da dona Maria para fazer pátina");
  return (await h.ctx.db.first<{ id: string }>("SELECT id FROM jobs LIMIT 1"))!.id;
}

/** Responde confirmações de correspondência, se o bot perguntar. */
async function confirmIfAsked(h: Harness, replies: { buttons?: { data: string }[][] }[]) {
  const asked = replies.some((r) => (r.buttons ?? []).flat().some((b) => b.data === "match:yes"));
  if (asked) await h.click("match:yes");
  return asked;
}

describe("Memória contextual e prevenção de duplicidades", () => {
  it("1. mencionar o mesmo projeto dez vezes (com palavras diferentes) mantém um único projeto", async () => {
    const h = await createHarness();
    await startCristaleira(h);
    const variations = [
      "Tenho aquela cristaleira grande que precisa de pátina.",
      "A dona Maria quer que eu pinte a cristaleira dela.",
      "Sobre a cristaleira da dona Maria, ela é antiga",
      "aquela cristaleira da Maria",
      "a cristaleira da dona Maria vai levar pátina",
      "peguei a cristaleira da dona Maria",
      "lembra da cristaleira da dona Maria?",
      "a cristaleira grande da dona maria",
      "Dona Maria, cristaleira, pátina",
    ];
    for (const v of variations) {
      h.advance(1);
      const r = await h.send(v);
      await confirmIfAsked(h, r);
    }
    expect(await count(h, "SELECT COUNT(*) AS n FROM jobs")).toBe(1);
    expect(await count(h, "SELECT COUNT(*) AS n FROM clients")).toBe(1);
  });

  it("2. reenviar o mesmo áudio (reentrega, reenvio ou falha de conexão) não duplica registros", async () => {
    const h = await createHarness();
    h.ctx.ai.stt = h.stt;
    await h.voice("aud-1", "Peguei uma cômoda da dona Ana para fazer decapê");
    expect(await count(h, "SELECT COUNT(*) AS n FROM jobs")).toBe(1);
    // mesmo arquivo reenviado em nova mensagem
    const again = await h.voice("aud-1", "Peguei uma cômoda da dona Ana para fazer decapê");
    expect(h.allText(again)).toMatch(/já recebi/);
    expect(await count(h, "SELECT COUNT(*) AS n FROM jobs")).toBe(1);

    // gasto por áudio, regravado depois de "falha" (arquivo diferente, mesmo conteúdo)
    await h.voice("aud-2", "Gastei noventa reais num verniz");
    await h.send("1 lata de 900 ml");
    await h.click(`exp:job:geral`);
    await h.click("exp:confirm");
    await h.voice("aud-3", "Gastei noventa reais num verniz");
    await h.send("1 lata de 900 ml");
    await h.click("exp:job:geral");
    const dup = await h.click("exp:confirm");
    expect(h.allText(dup)).toMatch(/já está anotado/);
    expect(await count(h, "SELECT COUNT(*) AS n FROM purchases")).toBe(1);
  });

  it("2b. reentrega do mesmo update do webhook é ignorada (aceite 18)", async () => {
    const h = await createHarness();
    await h.send("Peguei uma cristaleira da dona Maria para fazer pátina", undefined, 500);
    await h.send("Peguei uma cristaleira da dona Maria para fazer pátina", undefined, 500);
    await h.send("Peguei uma cristaleira da dona Maria para fazer pátina", undefined, 500);
    expect(await count(h, "SELECT COUNT(*) AS n FROM jobs")).toBe(1);
    expect(await count(h, "SELECT COUNT(*) AS n FROM telegram_updates")).toBe(1);
  });

  it("3. descrever o mesmo projeto com palavras diferentes gera pergunta de correspondência", async () => {
    const h = await createHarness();
    await startCristaleira(h);
    h.advance(1);
    const r = await h.send("Tenho aquela cristaleira grande que precisa de pátina.");
    expect(buttonsOf(r[r.length - 1])).toEqual(expect.arrayContaining(["match:yes", "match:no", "match:unsure"]));
    expect(h.allText(r)).toMatch(/cristaleira da Dona Maria/);
  });

  it("4. dois móveis parecidos do mesmo cliente podem ser projetos distintos (sem confusão)", async () => {
    const h = await createHarness();
    await startCristaleira(h);
    h.advance(1);
    const r = await h.send("Peguei outra cristaleira da dona Maria, essa é branca");
    expect(h.allText(r)).toMatch(/serviço novo/);
    await h.click("match:no");
    expect(await count(h, "SELECT COUNT(*) AS n FROM jobs")).toBe(2);
    // decisão do usuário fica registrada como "distintos" para o admin
    expect(await count(h, "SELECT COUNT(*) AS n FROM duplicate_suspicions WHERE status = 'DISTINTOS'")).toBe(1);
    h.advance(1);
    await h.send("cancelar");
    const which = await h.send("A dona Maria quer pátina na cristaleira");
    const picks = buttonsOf(which[which.length - 1]).filter((d) => d.startsWith("match:pick:"));
    expect(picks.length).toBe(2);
    expect(await count(h, "SELECT COUNT(*) AS n FROM jobs")).toBe(2);
  });

  it("5. retomar um projeto após 30 dias recupera informações e pendências", async () => {
    const h = await createHarness();
    await startCristaleira(h);
    await h.click("ans:bom");
    h.advance(30);
    const r = await h.send("/start");
    expect(h.allText(r)).toMatch(/cristaleira da Dona Maria/);
    expect(h.allText(r)).toMatch(/tamanho/i);
    const c = await h.click("cmd:continue");
    const text = h.allText(c);
    expect(text).toMatch(/pátina/);
    expect(text).toMatch(/estado: bom/);
    expect(text).not.toMatch(/Qual é o móvel/);
  });

  it("6. repetir informação já cadastrada não gera pergunta redundante", async () => {
    const h = await createHarness();
    await startCristaleira(h);
    await h.click("ans:bom");
    await h.send("tem uns dois metros");
    const r = await h.send("a cristaleira tem uns dois metros");
    const text = h.allText(r);
    expect(text).toMatch(/já anotei/);
    expect(text).not.toMatch(/Qual é o tamanho/);
  });

  it("7. corrigir dimensões atualiza o projeto correto e preserva histórico", async () => {
    const h = await createHarness();
    const jobId = await startCristaleira(h);
    await h.click("ans:bom");
    await h.send("1,80 de altura, 1 metro de largura e 40 de fundura");
    const r = await h.send("na verdade a altura é 1,90");
    expect(h.allText(r)).toMatch(/Corrigido/);
    const job = await h.ctx.db.first<{ facts_json: string }>("SELECT facts_json FROM jobs WHERE id = ?", jobId);
    expect(JSON.parse(job!.facts_json).dimensions.value.height).toBe("1.9");
    expect(JSON.parse(job!.facts_json).dimensions.value.width).toBe("1");
    expect(await count(h, "SELECT COUNT(*) AS n FROM job_facts WHERE job_id = ? AND field = 'dimensions'", jobId)).toBe(2);
    expect(await count(h, "SELECT COUNT(*) AS n FROM job_facts WHERE job_id = ? AND field = 'dimensions' AND superseded_at IS NOT NULL", jobId)).toBe(1);
    expect(await count(h, "SELECT COUNT(*) AS n FROM job_events WHERE job_id = ? AND type = 'correcao'", jobId)).toBe(1);
  });

  it("8. informação contraditória pede esclarecimento, sem sobrescrever em silêncio", async () => {
    const h = await createHarness();
    const jobId = await startCristaleira(h);
    await h.click("ans:bom");
    await h.send("tem uns dois metros");
    const r = await h.send("ela tem 1,50 m");
    expect(h.allText(r)).toMatch(/Qual está certo/);
    let facts = JSON.parse((await h.ctx.db.first<{ facts_json: string }>("SELECT facts_json FROM jobs WHERE id = ?", jobId))!.facts_json);
    expect(facts.dimensions.value.height).toBe("2");
    await h.click("fact:new");
    facts = JSON.parse((await h.ctx.db.first<{ facts_json: string }>("SELECT facts_json FROM jobs WHERE id = ?", jobId))!.facts_json);
    expect(facts.dimensions.value.height).toBe("1.5");
  });

  it("9. correspondência incerta não associa nem cria sem confirmação", async () => {
    const h = await createHarness();
    await startCristaleira(h);
    h.advance(2);
    await h.send("cancelar");
    const r = await h.send("peguei uma cristaleira");
    expect(buttonsOf(r[r.length - 1])).toContain("match:yes");
    expect(await count(h, "SELECT COUNT(*) AS n FROM jobs")).toBe(1);
    expect(await count(h, "SELECT COUNT(*) AS n FROM jobs WHERE status = 'MESCLADO'")).toBe(0);
    // "não tenho certeza" → uma pergunta para diferenciar
    const u = await h.click("match:unsure");
    expect(h.allText(u)).toMatch(/de quem é esse móvel/i);
    await h.send("do seu João");
    expect(await count(h, "SELECT COUNT(*) AS n FROM jobs")).toBe(2);
  });

  it("10. confirmar projeto existente continua o fluxo sem reiniciar o orçamento", async () => {
    const h = await createHarness();
    const jobId = await startCristaleira(h);
    await h.click("ans:bom");
    await h.click("ans:grande");
    h.advance(3);
    await h.send("cancelar");
    await h.send("a cristaleira da dona Maria");
    const r = await h.click("match:yes");
    const text = h.allText(r);
    expect(text).toMatch(/vamos continuar com a cristaleira da Dona Maria/);
    expect(text).toMatch(/parte de dentro/); // próxima pendência real
    expect(text).not.toMatch(/Qual é o móvel|De quem é o móvel/);
    expect(await count(h, "SELECT COUNT(*) AS n FROM jobs")).toBe(1);
    const s = await h.ctx.db.first<{ active_job_id: string }>("SELECT active_job_id FROM conversation_sessions");
    expect(s!.active_job_id).toBe(jobId);
  });
});

describe("Conversação (aceites 13–17)", () => {
  it("13. áudio interpretado segue o mesmo fluxo do texto", async () => {
    const h = await createHarness();
    h.ctx.ai.stt = h.stt;
    const r = await h.voice("aud-x", "Peguei uma cômoda da dona Ana para fazer decapê");
    expect(h.allText(r)).toMatch(/Ouvi:/);
    expect(h.allText(r)).toMatch(/cômoda/);
    const job = await h.ctx.db.first<{ facts_json: string }>("SELECT facts_json FROM jobs");
    const facts = JSON.parse(job!.facts_json);
    expect(facts.techniques.value).toEqual(["decape"]);
    expect(facts.client_name.value).toBe("Dona Ana");
  });

  it("14. falha de transcrição preserva a sessão e permite reenvio/texto", async () => {
    const h = await createHarness();
    h.ctx.ai.stt = h.stt;
    await startCristaleira(h);
    const before = await h.ctx.db.first<{ flow: string; last_question: string }>("SELECT flow, last_question FROM conversation_sessions");
    h.stt.fail = true;
    const r = await h.voice("aud-fail", "qualquer");
    expect(h.allText(r)).toMatch(/Não consegui entender o áudio/);
    const after = await h.ctx.db.first<{ flow: string; last_question: string }>("SELECT flow, last_question FROM conversation_sessions");
    expect(after).toEqual(before);
    h.stt.fail = false;
    const retry = await h.voice("aud-fail", "está em bom estado");
    expect(h.allText(retry)).toMatch(/tamanho/);
  });

  it("14b. transcrição desligada (sem IA) pede texto sem perder nada", async () => {
    const h = await createHarness();
    await startCristaleira(h);
    const r = await h.voice("aud-off", "x");
    expect(h.allText(r)).toMatch(/ainda não está ligada/);
    expect(await count(h, "SELECT COUNT(*) AS n FROM jobs")).toBe(1);
  });

  it("15. mensagem ambígua gera pergunta curta e nenhum registro financeiro", async () => {
    const h = await createHarness();
    const r = await h.send("hmm deixa eu ver isso aí, 200");
    expect(h.allText(r)).toMatch(/não entendi o que você quer/);
    expect(await count(h, "SELECT COUNT(*) AS n FROM payments")).toBe(0);
    expect(await count(h, "SELECT COUNT(*) AS n FROM purchases")).toBe(0);
    expect(await count(h, "SELECT COUNT(*) AS n FROM expenses")).toBe(0);
  });

  it("15b. pagamento só é registrado após confirmação explícita", async () => {
    const h = await createHarness();
    await startCristaleira(h);
    await h.send("cancelar");
    const r = await h.send("Recebi R$ 200 da dona Maria");
    expect(h.allText(r)).toMatch(/Está certo\?/);
    expect(await count(h, "SELECT COUNT(*) AS n FROM payments")).toBe(0);
    await h.click("pay:confirm");
    expect(await count(h, "SELECT COUNT(*) AS n FROM payments")).toBe(1);
  });

  it("16. 'não sei' mantém o campo pendente e não vira zero", async () => {
    const h = await createHarness();
    const jobId = await startCristaleira(h);
    await h.click("ans:bom");
    const r = await h.click("ans:nao_sei");
    expect(h.allText(r)).toMatch(/pendente/);
    const facts = JSON.parse((await h.ctx.db.first<{ facts_json: string }>("SELECT facts_json FROM jobs WHERE id = ?", jobId))!.facts_json);
    expect(facts.dimensions.status).toBe("unknown");
    expect(facts.dimensions.value).toBeNull();
    const pending = JSON.parse((await h.ctx.db.first<{ pending_json: string }>("SELECT pending_json FROM jobs WHERE id = ?", jobId))!.pending_json);
    expect(pending).toContain("dimensions");
  });

  it("'já tenho o verniz' reduz compra mas mantém custo (mensagem correta)", async () => {
    const h = await createHarness();
    await startCristaleira(h);
    const r = await h.send("já tenho o verniz");
    expect(h.allText(r)).toMatch(/não precisa comprar agora.*custo de reposição/s);
  });

  it("voltar retorna à pergunta anterior e a nova resposta vira correção com histórico", async () => {
    const h = await createHarness();
    const jobId = await startCristaleira(h);
    await h.click("ans:bom");
    const back = await h.send("voltar");
    expect(h.allText(back)).toMatch(/Como o móvel está/);
    await h.click("ans:danificado");
    const facts = JSON.parse((await h.ctx.db.first<{ facts_json: string }>("SELECT facts_json FROM jobs WHERE id = ?", jobId))!.facts_json);
    expect(facts.condition.value).toBe("danificado");
    expect(await count(h, "SELECT COUNT(*) AS n FROM job_facts WHERE job_id = ? AND field = 'condition'", jobId)).toBe(2);
  });

  it("confirmações financeiras antigas expiram (nada é gravado sem confirmação recente)", async () => {
    const h = await createHarness();
    await startCristaleira(h);
    await h.send("Gastei R$ 90 num verniz");
    h.advance(1);
    const r = await h.send("oi");
    expect(h.allText(r)).toMatch(/não foi confirmado/);
    await h.click("exp:confirm");
    expect(await count(h, "SELECT COUNT(*) AS n FROM purchases")).toBe(0);
  });
});
