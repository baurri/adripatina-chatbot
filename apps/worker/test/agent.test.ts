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
      () => tool("criar_servico", { movel: "mesa", campos: { tecnicas: ["verniz"], cliente: "Dona Ana", largura_cm: 100, fundura_cm: 60, altura_cm: 80, estado: "bom", superficies: "externa", parte: "inteiro", conserto: false, metodo: "pincel", artesao_busca: false, artesao_entrega: false } }),
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
    const r1 = await h.send("mesa da dona Ana pra envernizar, 1 metro por 60, 80 de altura, tá boa, só por fora, inteira, sem conserto, pincel, ela traz e busca");
    expect(String(closeSameTurn.erro)).toMatch(/ainda não respondeu/);
    expect(buttonsOf(r1.at(-1))).toEqual(expect.arrayContaining([expect.stringMatching(/^ag:btn:/)]));
    h.telegram.clear();
    await h.send("concordo");
    expect(h.telegram.sent.some((s) => s.kind === "document")).toBe(true);
    const q = (await h.ctx.db.first<{ status: string }>("SELECT status FROM quotes"))!;
    expect(["APROVADO", "ENVIADO"]).toContain(q.status);
  });

  it("sem o Claude (falha), o motor antigo responde", async () => {
    const h = await createHarness();
    h.ctx.ai.agent = { name: "claude-haiku-5-5", step: async () => { throw new Error("fora do ar"); } };
    const r = h.allText(await h.send("Peguei uma mesa da dona Ana para envernizar"));
    expect(r).toMatch(/Anotei um serviço novo|mesa/i);
  });
});
