import { describe, expect, it } from "vitest";
import { buttonsOf, createHarness, type Harness } from "./harness.js";
import type { AgentMessage, AgentModel, AgentStep } from "../src/ports.js";
import { getJob } from "../src/repos/jobs.js";

/**
 * D-075 — motor de conversa com o Claude conduzindo. Aqui o "Claude" é roteirizado: cada passo
 * devolve o que o teste manda. O que se verifica são as TRAVAS do código (não a inteligência).
 */
class ScriptedAgent implements AgentModel {
  readonly name = "claude-haiku-5-5";
  calls: AgentMessage[][] = [];
  constructor(private script: ((msgs: AgentMessage[]) => AgentStep)[]) {}
  async step(_system: string, messages: AgentMessage[]): Promise<AgentStep> {
    this.calls.push(JSON.parse(JSON.stringify(messages)) as AgentMessage[]);
    const next = this.script.shift();
    if (!next) return { stopReason: "end_turn", content: [{ type: "text", text: "Certo! 🙂" }] };
    return next(messages);
  }
}

const tool = (name: string, input: unknown, id = name): AgentStep => ({ stopReason: "tool_use", content: [{ type: "tool_use", id, name, input }] });
const say = (text: string): AgentStep => ({ stopReason: "end_turn", content: [{ type: "text", text }] });
function lastToolResult(msgs: AgentMessage[]): Record<string, unknown> {
  const m = msgs.at(-1)!;
  const blocks = m.content as { type: string; content: string }[];
  return JSON.parse(blocks.find((b) => b.type === "tool_result")!.content) as Record<string, unknown>;
}

async function setup(script: ((msgs: AgentMessage[]) => AgentStep)[]): Promise<{ h: Harness; agent: ScriptedAgent }> {
  const h = await createHarness();
  await h.calibrateAndPrice();
  const agent = new ScriptedAgent(script);
  h.ctx.ai.agent = agent;
  return { h, agent };
}

describe("motor novo (D-075): travas do código", () => {
  it("cria o serviço com o que ele disse; número que ele não disse é recusado e volta pro Claude", async () => {
    let seen: Record<string, unknown> = {};
    const { h } = await setup([
      () => tool("criar_servico", { movel: "cômoda", campos: { tecnicas: ["patina"], cliente: "Dona Carla", largura_cm: 80, altura_cm: 100, fundura_cm: 45, estado: "bom" } }),
      (m) => {
        seen = lastToolResult(m);
        return say("Anotado! 🎨 E ela precisa de algum conserto?");
      },
    ]);
    const r = h.allText(await h.send("chegou uma cômoda da dona Carla pra patinar, 80 de largura por 1 metro de altura, tá boazinha"));
    expect(r).toMatch(/conserto/);
    const job = (await h.ctx.db.first<{ id: string }>("SELECT id FROM jobs"))!;
    const f = (await getJob(h.ctx, job.id))!.facts;
    expect(f.dimensions?.value).toEqual({ height: "1", width: "0.8" }); // 45 de fundura NÃO foi dito
    expect(f.client_name?.value).toBe("Dona Carla");
    expect(f.techniques?.value).toEqual(["patina"]);
    expect(JSON.stringify(seen.recusado)).toMatch(/fundura_cm=45/);
  });

  it("resposta com número inventado é reescrita", async () => {
    const { h } = await setup([() => say("Fica uns R$ 999,00. 💰"), () => say("Ainda preciso de mais uns dados pra fazer a conta. 🙂")]);
    const r = h.allText(await h.send("quanto fica uma cadeira?"));
    expect(r).not.toMatch(/999/);
  });

  it("pagamento só é gravado depois do botão de confirmação", async () => {
    const { h } = await setup([
      () => tool("listar_servicos", {}),
      (m) => {
        const id = ((lastToolResult(m).servicos as { servico_id: string }[])[0]!).servico_id;
        return tool("registrar_pagamento", { servico_id: id, valor_reais: 200 });
      },
      () => say("Vou anotar o pagamento de R$ 200,00 da Dona Maria. Confirma? 💰"),
      () => say("Anotado! ✅"),
    ]);
    await h.ctx.db.run("UPDATE conversation_sessions SET context_json = '{}'");
    const { createJob, setFact } = await import("../src/repos/jobs.js");
    const job = await createJob(h.ctx, { actor: h.artisanId, description: "cristaleira da dona Maria" });
    await setFact(h.ctx, job.id, "client_name", "Dona Maria" as never, { actor: h.artisanId, source: "telegram_text" });
    const r = await h.send("a dona maria me pagou 200 reais");
    expect(await h.ctx.db.first<{ n: number }>("SELECT COUNT(*) n FROM payments").then((x) => x!.n)).toBe(0);
    const ok = buttonsOf(r.at(-1)).find((d) => d.startsWith("ag:ok:"))!;
    expect(ok).toBeTruthy();
    await h.click(ok);
    expect(await h.ctx.db.first<{ s: number }>("SELECT SUM(amount_cents) s FROM payments").then((x) => x!.s)).toBe(20000);
    // clique repetido não grava de novo
    await h.click(ok);
    expect(await h.ctx.db.first<{ n: number }>("SELECT COUNT(*) n FROM payments").then((x) => x!.n)).toBe(1);
  });

  it("o orçamento não fecha no mesmo turno em que foi mostrado; fecha depois do 'concordo'", async () => {
    let jobId = "";
    let closeSameTurn: Record<string, unknown> = {};
    const { h } = await setup([
      () => tool("criar_servico", { movel: "mesa", campos: { tecnicas: ["verniz"], cliente: "Dona Ana", largura_cm: 100, fundura_cm: 60, altura_cm: 80, estado: "bom", superficies: "externa", parte: "inteiro", conserto: false, metodo: "pincel", artesao_busca: false, artesao_entrega: false, prazo: "daqui a 2 meses" } }),
      (m) => {
        jobId = ((lastToolResult(m).criado as { servico_id: string }).servico_id);
        return tool("calcular_orcamento", { servico_ids: [jobId] });
      },
      () => tool("fechar_orcamento", { servico_ids: [jobId] }),
      (m) => {
        closeSameTurn = lastToolResult(m);
        return say("Minha sugestão é essa aí. Você concorda? 🤝");
      },
      // próximo turno: ele concorda
      () => tool("fechar_orcamento", { servico_ids: [jobId] }),
      () => say("Fechado! ✅ Te mandei o PDF."),
    ]);
    const r1 = await h.send("mesa da dona Ana pra envernizar, 1 metro por 60, 80 de altura, tá boa, só por fora, inteira, sem conserto, pincel, ela traz e busca, fica pronto daqui a 2 meses");
    expect(String(closeSameTurn.erro)).toMatch(/ainda não respondeu/);
    expect(buttonsOf(r1.at(-1))).toEqual(expect.arrayContaining([expect.stringMatching(/^ag:btn:/)]));
    h.telegram.clear();
    await h.send("concordo");
    expect(h.telegram.sent.some((s) => s.kind === "document")).toBe(true);
    const q = (await h.ctx.db.first<{ status: string }>("SELECT status FROM quotes"))!;
    expect(["APROVADO", "ENVIADO"]).toContain(q.status);
  });

  it("código interno do serviço (S-0001) nunca aparece para o artesão", async () => {
    const { stripJobCodes } = await import("../src/agent/engine.js");
    expect(stripJobCodes("Tem a cômoda da Dona Carla (S-0001) e o serviço S-0002, aguardando.")).toBe("Tem a cômoda da Dona Carla e o, aguardando.");
    const { h } = await setup([() => tool("listar_servicos", {}), (m) => {
      expect(JSON.stringify(lastToolResult(m))).not.toMatch(/S-\d{4}/);
      return say("Tá aqui a cristaleira (S-0001) da Dona Maria. 🙂");
    }]);
    const { createJob, setFact } = await import("../src/repos/jobs.js");
    const job = await createJob(h.ctx, { actor: h.artisanId, description: "cristaleira da dona Maria" });
    await setFact(h.ctx, job.id, "client_name", "Dona Maria" as never, { actor: h.artisanId, source: "telegram_text" });
    const r = h.allText(await h.send("o que tem em andamento?"));
    expect(r).not.toMatch(/S-\d{4}/);
    expect(r).toMatch(/cristaleira da Dona Maria/);
  });

  it("criar serviço funciona mesmo se o contador de códigos sumir (banco zerado)", async () => {
    const { h } = await setup([() => tool("criar_servico", { movel: "mesa de cabeceira", campos: { cliente: "Dona Maria" } }), () => say("Anotado! 🙂")]);
    await h.ctx.db.run("DELETE FROM job_code_sequence");
    await h.send("tenho uma mesa de cabeceira da dona Maria");
    expect(await h.ctx.db.first<{ n: number }>("SELECT COUNT(*) n FROM jobs").then((r) => r!.n)).toBe(1);
  });

  it("foto: o Claude recebe a imagem, e ela fica guardada no serviço criado; 'isso' confirma o que ele viu", async () => {
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 9, 8, 7, 6]);
    let sawImage = false;
    let created: Record<string, unknown> = {};
    const { h } = await setup([
      (m) => {
        const last = m.at(-1)!;
        sawImage = Array.isArray(last.content) && last.content.some((b) => (b as { type: string }).type === "image");
        return say("Pela foto é uma cômoda com 4 gavetas, meio descascada, certo? 📸");
      },
      () => tool("criar_servico", { movel: "cômoda", campos: { gavetas: 4, estado: "reparos" } }),
      (m) => {
        created = lastToolResult(m);
        return say("Anotado! ✅ De quem é?");
      },
    ]);
    await h.photo(jpeg);
    expect(sawImage).toBe(true);
    await h.send("isso");
    expect(created.fotos_guardadas).toBe(1);
    expect(JSON.stringify(created.recusado ?? [])).not.toMatch(/gavetas/);
    const att = await h.ctx.db.first<{ job_id: string | null }>("SELECT job_id FROM attachments");
    expect(att?.job_id).toBeTruthy();
  });

  it("peça fora do catálogo + trabalho sob medida: cria com o nome dele e calcula pelas horas e materiais", async () => {
    let calc: Record<string, unknown> = {};
    let jobId = "";
    const { h } = await setup([
      () => tool("criar_servico", { movel: "faqueiro", campos: { cliente: "Dona Lúcia", estado: "bom", trabalho_descricao: "encapar o interior com veludo vinho", horas_artesao: 4, materiais_extras: [{ descricao: "veludo", valor_unitario_reais: 35 }, { descricao: "cola de contato", valor_unitario_reais: 20 }], conserto: false, artesao_busca: false, artesao_entrega: false } }),
      (m) => {
        jobId = (lastToolResult(m).criado as { servico_id: string }).servico_id;
        return tool("calcular_orcamento", { servico_ids: [jobId] });
      },
      (m) => {
        calc = lastToolResult(m);
        return say("Pronto! 🙂");
      },
    ]);
    await h.send("faqueiro da dona Lúcia, encapar o interior com veludo vinho, uns 4 horas, veludo 35 reais e cola 20, tá bom, sem conserto, ela traz e busca");
    const job = (await getJob(h.ctx, jobId))!;
    expect((job.facts.furniture_type?.value as { label?: string }).label).toBe("faqueiro");
    expect(job.title).toMatch(/faqueiro/i);
    const item = (calc.itens as Record<string, unknown>[] | undefined)?.[0] ?? (calc as Record<string, unknown>);
    expect(JSON.stringify(calc), JSON.stringify(calc)).not.toMatch(/pode_calcular":false/);
    expect(JSON.stringify(item)).toMatch(/sugestao/);
  });

  it("'outros dois móveis' não vira serviço: pede pra dizer qual é", async () => {
    let r: Record<string, unknown> = {};
    const { h } = await setup([() => tool("criar_servico", { movel: "outros dois móveis" }), (m) => ((r = lastToolResult(m)), say("Quais são os outros dois?"))]);
    await h.send("e tem outros dois móveis");
    expect(String(r.erro)).toMatch(/não diz qual é a peça/);
    expect(await h.ctx.db.first<{ n: number }>("SELECT COUNT(*) n FROM jobs").then((x) => x!.n)).toBe(0);
  });

  it("duas peças do mesmo cliente fechadas juntas saem num PDF só", async () => {
    const ids: string[] = [];
    const base = { tecnicas: ["verniz"], cliente: "Dona Ana", estado: "bom", superficies: "externa", parte: "inteiro", conserto: false, metodo: "pincel", artesao_busca: false, artesao_entrega: false, prazo: "daqui a 2 meses" };
    const { h } = await setup([
      () => tool("criar_servico", { movel: "mesa", campos: { ...base, largura_cm: 100, fundura_cm: 60, altura_cm: 80 } }),
      (m) => {
        ids.push((lastToolResult(m).criado as { servico_id: string }).servico_id);
        return tool("criar_servico", { movel: "dois criados-mudos", campos: { ...base, porte: "pequeno" } }, "c2");
      },
      (m) => {
        ids.push((lastToolResult(m).criado as { servico_id: string }).servico_id);
        return tool("calcular_orcamento", { servico_ids: ids });
      },
      () => say("Mesa e os 2 criados: concorda? 🤝"),
      () => tool("fechar_orcamento", { servico_ids: ids }),
      () => say("Fechado! ✅ Te mandei o PDF aqui."),
    ]);
    await h.send("mesa da dona Ana 1 metro por 60, 80 de altura, e dois criados-mudos pequenos, verniz, tá bom, só por fora, inteiro, sem conserto, pincel, ela traz e busca, fica pronto daqui a 2 meses");
    const ft = (await getJob(h.ctx, ids[1]!))!.facts.furniture_type?.value as { quantity?: number };
    expect(ft.quantity).toBe(2);
    h.telegram.clear();
    await h.send("concordo");
    expect(h.telegram.sent.filter((s) => s.kind === "document").length).toBe(1);
    expect(await h.ctx.db.first<{ n: number }>("SELECT COUNT(*) n FROM quote_documents WHERE kind = 'COMERCIAL'").then((x) => x!.n)).toBe(1);
    expect(await h.ctx.db.first<{ n: number }>("SELECT COUNT(*) n FROM quotes WHERE status IN ('APROVADO','ENVIADO')").then((x) => x!.n)).toBe(2);
  });

  it("sem o Claude (falha), o motor antigo responde", async () => {
    const h = await createHarness();
    h.ctx.ai.agent = { name: "claude-haiku-5-5", step: async () => { throw new Error("fora do ar"); } };
    const r = h.allText(await h.send("Peguei uma mesa da dona Ana para envernizar"));
    expect(r).toMatch(/Anotei um serviço novo|mesa/i);
  });
});
