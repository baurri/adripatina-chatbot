import { describe, expect, it } from "vitest";
import { buttonsOf, createHarness, type Harness } from "./harness.js";
import type { AgentMessage, AgentModel, AgentStep } from "../src/ports.js";
import { createJob, getJob, setFact } from "../src/repos/jobs.js";
import { queueInfo } from "../src/agent/tools.js";
import { albumWait } from "../src/telegram/webhook.js";
import { limitPhotoAsks, reviewDraft } from "../src/agent/engine.js";

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
      () => tool("criar_servico", { movel: "mesa", campos: { tecnicas: ["verniz"], cliente: "Dona Ana", largura_cm: 100, fundura_cm: 60, altura_cm: 80, estado: "bom", superficies: "externa", parte: "inteiro", conserto: false, metodo: "pincel", artesao_busca: false, artesao_entrega: false, prazo_entrega: "daqui a 2 meses" } }),
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
    expect(buttonsOf(r1.at(-1))).toEqual(expect.arrayContaining([expect.stringMatching(/^ag:(btn|q):/)]));
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
    const base = { tecnicas: ["verniz"], cliente: "Dona Ana", estado: "bom", superficies: "externa", parte: "inteiro", conserto: false, metodo: "pincel", artesao_busca: false, artesao_entrega: false, prazo_entrega: "daqui a 2 meses" };
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

  it("depois do PDF vem o botão do WhatsApp com link temporário que abre o PDF", async () => {
    const { createDocumentLink, openDocumentLink } = await import("../src/services/quotes.js");
    const h = await createHarness();
    (h.ctx.config as { publicBaseUrl: string | null }).publicBaseUrl = "https://exemplo.test";
    const fake = new TextEncoder().encode("%PDF-1.4 teste");
    await h.ctx.storage.put("documents/x.pdf", fake);
    const now = new Date(h.ctx.clock()).toISOString();
    const jobId = (await (await import("../src/repos/jobs.js")).createJob(h.ctx, { actor: h.artisanId, description: "mesa" })).id;
    await h.ctx.db.run("INSERT INTO quotes (id, job_id, version, status, input_json, result_json, engine_version, created_at, updated_at) VALUES ('q1', ?, 1, 'ENVIADO', '{}', '{}', 'x', ?, ?)", jobId, now, now);
    await h.ctx.db.run("INSERT INTO quote_snapshots (id, quote_id, number, doc_version, snapshot_json, sha256, created_at) VALUES ('s1','q1','AP-2026-0099',1,'{}','x',?)", now);
    await h.ctx.db.run("INSERT INTO quote_documents (id, quote_id, snapshot_id, number, doc_version, kind, preliminary, r2_key, sha256, size_bytes, created_at) VALUES ('d1','q1','s1','AP-2026-0099',1,'COMERCIAL',0,'documents/x.pdf','x',14,?)", now);
    const token = await createDocumentLink(h.ctx, "d1");
    expect(token).toMatch(/^[0-9a-f]{32}$/);
    const opened = await openDocumentLink(h.ctx, token);
    expect(new TextDecoder().decode(opened!.bytes)).toMatch(/%PDF/);
    expect(await openDocumentLink(h.ctx, "0".repeat(32))).toBeNull();
    const res = await h.app().request(`/p/${token}`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
  });

  it("mesma peça, mesmos dados, mesmas configurações → sempre o mesmo valor", async () => {
    const h = await createHarness();
    await h.calibrateAndPrice();
    const { createJob, setFact } = await import("../src/repos/jobs.js");
    const { calculateQuote } = await import("../src/services/quotes.js");
    const job = await createJob(h.ctx, { actor: h.artisanId, description: "mesa" });
    const o = { actor: h.artisanId, source: "telegram_text" as const };
    await setFact(h.ctx, job.id, "furniture_type", { type: "mesa", descriptors: [] } as never, o);
    await setFact(h.ctx, job.id, "techniques", ["verniz"] as never, o);
    await setFact(h.ctx, job.id, "dimensions", { width: "1", depth: "0.6", height: "0.8" } as never, o);
    await setFact(h.ctx, job.id, "application_method", "pincel" as never, o);
    const values = [];
    for (let i = 0; i < 3; i++) values.push((await calculateQuote(h.ctx, job.id, h.artisanId)).recommendedCents);
    expect(new Set(values).size).toBe(1);
  });

  it("sem o Claude (falha), o motor antigo responde", async () => {
    const h = await createHarness();
    h.ctx.ai.agent = { name: "claude-haiku-5-5", step: async () => { throw new Error("fora do ar"); } };
    const r = h.allText(await h.send("Peguei uma mesa da dona Ana para envernizar"));
    expect(r).toMatch(/Anotei um serviço novo|mesa/i);
  });
});

describe("excelência: álbum de fotos, foto pedida uma vez, revisão do rascunho", () => {
  it("3 fotos mandadas juntas: UMA resposta, e o Claude vê as 3", async () => {
    albumWait.ms = 30;
    let images = 0;
    const { h, agent } = await setup([
      (m) => {
        const last = m.at(-1)!;
        images = Array.isArray(last.content) ? last.content.filter((b) => (b as { type: string }).type === "image").length : 0;
        return say("Pelas fotos é uma cômoda com 4 gavetas, certo? 📸");
      },
    ]);
    const jpg = (n: number) => new Uint8Array([0xff, 0xd8, 0xff, 0xe0, n, n, n, n]);
    const r = await h.album([jpg(1), jpg(2), jpg(3)], "cômoda da dona Rita");
    albumWait.ms = 2500;
    expect(r.filter((x) => x.kind === "message")).toHaveLength(1);
    expect(images).toBe(3);
    expect(agent.calls).toHaveLength(1);
    expect(JSON.stringify(agent.calls[0])).toMatch(/dona Rita/);
  });

  it("foto é pedida uma vez: o pedido some das mensagens seguintes", () => {
    const st: Record<string, unknown> = {};
    const a = limitPhotoAsks("Anotei a cômoda ✅ Qual o tamanho?", st, 1, true, false);
    expect(a).toMatch(/foto/);
    const b = limitPhotoAsks("Anotei o tamanho ✅ Se tiver foto, manda que ajuda! 📸 Ela tem conserto?", st, 2, false, false);
    expect(b).not.toMatch(/foto/);
    expect(b).toMatch(/conserto\?/);
    // peça nova logo em seguida: não pede de novo tão cedo
    expect(limitPhotoAsks("Anotei a mesa ✅ De quem é?", st, 3, true, false)).not.toMatch(/foto/);
    // muito depois, peça nova: pede de novo
    expect(limitPhotoAsks("Anotei o rack ✅ De quem é?", st, 9, true, false)).toMatch(/foto/);
  });

  it("revisão: pergunta o que ele já disse volta pro Claude (com a frase dele)", () => {
    const r = reviewDraft("Anotei a mesinha ✅ Como tá o estado dela?", "a mesinha é redonda, tampo meio danificado, tem que acertar uns detalhes", "", [{}], "");
    expect(r?.kind).toBe("ja_disse:condition");
    expect(r?.instruction).toMatch(/meio danificado/);
    const s = reviewDraft("Beleza ✅ Vai ser pincel, rolo ou pistola?", "", "", [{ application_method: { value: "pincel" } }], "");
    expect(s?.kind).toBe("repetida:application_method");
    expect(reviewDraft("Beleza ✅ Vai ser pincel, rolo ou pistola?", "é uma cômoda da dona Ana", "", [{}], "")).toBeNull();
  });

  it("revisão: transporte ou prazo que ele não disse é tirado", () => {
    expect(reviewDraft("Fechado ✅ Você entrega depois de pronto.", "", "cômoda da dona Ana, patina", [{}], "")?.kind).toBe("inventou:transporte");
    expect(reviewDraft("Fechado ✅ Você entrega depois de pronto.", "", "eu busco e entrego", [{}], "")).toBeNull();
    expect(reviewDraft("Show ✅ Fica pronto em 5 dias.", "", "cômoda da dona Ana", [{}], "")?.kind).toBe("inventou:prazo");
  });

  it("revisão de verdade no fluxo: o Claude corrige a pergunta repetida e anota", async () => {
    const { h, agent } = await setup([
      () => tool("criar_servico", { movel: "mesinha de centro", campos: { cliente: "Dona Jo", tecnicas: ["verniz"] } }),
      () => say("Anotei a mesinha ✅ Como tá o estado dela?"),
      (m) => {
        const last = String(m.at(-1)!.content);
        expect(last).toMatch(/já falou disso/);
        return say("Anotei que o tampo tá meio danificado ✅ Precisa de conserto?");
      },
    ]);
    const r = h.allText(await h.send("mesinha de centro da dona jo pra envernizar, o tampo tá meio danificado"));
    expect(r).toMatch(/conserto/);
    expect(r).not.toMatch(/Como tá o estado/);
    expect(agent.calls.length).toBe(3);
  });
});

describe("excelência: prazo pela fila", () => {
  it("fila: serviços aceitos com previsão → livre a partir do dia seguinte ao último; o Claude vê isso", async () => {
    const { h, agent } = await setup([() => say("Você tem 2 serviços na fila. Dá pra começar lá pelo 16/12?")]);
    h.clock.now = new Date("2026-11-24T13:00:00Z");
    const mk = async (desc: string, deadline: string | null, status: "AGUARDANDO_INICIO" | "EM_EXECUCAO") => {
      const j = await createJob(h.ctx, { actor: "u", description: desc });
      await setFact(h.ctx, j.id, "furniture_type", { type: "comoda", descriptors: [] } as never, { actor: "u", source: "admin" });
      if (deadline) await setFact(h.ctx, j.id, "deadline", deadline as never, { actor: "u", source: "admin" });
      await h.ctx.db.run("UPDATE jobs SET status = ? WHERE id = ?", status, j.id);
    };
    await mk("cômoda", "Início: já · cerca de 5 dias de trabalho · previsão de entrega: por volta de 01/12/2026", "EM_EXECUCAO");
    await mk("rack", "Início: semana que vem · cerca de 1 semana de trabalho · previsão de entrega: por volta de 15/12/2026", "AGUARDANDO_INICIO");
    const q = await queueInfo(h.ctx);
    expect(q?.servicos_na_fila).toBe(2);
    expect(q?.livre_a_partir_de).toBe("16/12");
    await h.send("e aí, quando eu consigo pegar um serviço novo?");
    expect(JSON.stringify(agent.calls[0])).toMatch(/livre_a_partir_de.{0,6}16\/12/);
    expect(h.lastText()).toMatch(/16\/12/); // data da fila não é "inventada"
  });

  it("prazo com data dita ('lá pelo 16/12') vira previsão de entrega", async () => {
    let jobId = "";
    const { h } = await setup([
      () => tool("criar_servico", { movel: "cômoda", campos: { cliente: "Dona Ana" } }),
      (m) => {
        jobId = (lastToolResult(m).criado as { servico_id: string }).servico_id;
        return tool("anotar", { servico_id: jobId, campos: { prazo_inicio: "lá pelo dia 16/12", prazo_duracao: "5 dias" } });
      },
      () => say("Anotado ✅"),
    ]);
    h.clock.now = new Date("2026-11-24T13:00:00Z");
    await h.send("cômoda da dona ana, começo lá pelo dia 16/12 e levo 5 dias");
    const dl = String((await getJob(h.ctx, jobId))!.facts.deadline?.value);
    expect(dl).toMatch(/por volta de 2[2-4]\/12\/2026/);
  });
});

describe("excelência: depois do PDF (D-081)", () => {
  async function closedMesa() {
    let jobId = "";
    const { h } = await setup([
      () => tool("criar_servico", { movel: "mesa", campos: { tecnicas: ["verniz"], cliente: "Dona Ana", largura_cm: 100, fundura_cm: 60, altura_cm: 80, estado: "bom", superficies: "externa", parte: "inteiro", conserto: false, metodo: "pincel", artesao_busca: false, artesao_entrega: false, prazo_entrega: "daqui a 2 meses" } }),
      (m) => {
        jobId = (lastToolResult(m).criado as { servico_id: string }).servico_id;
        return tool("calcular_orcamento", { servico_ids: [jobId] });
      },
      () => say("Minha sugestão é essa aí. Você concorda? 🤝"),
      () => tool("fechar_orcamento", { servico_ids: [jobId] }),
      () => say("Fechado! ✅ Te mandei o PDF."),
    ]);
    h.clock.now = new Date("2026-11-24T13:00:00Z");
    await h.send("mesa da dona Ana pra envernizar, 1 metro por 60, 80 de altura, tá boa, só por fora, inteira, sem conserto, pincel, ela traz e busca, fica pronto daqui a 2 meses");
    await h.send("concordo");
    return { h, jobId };
  }

  it("3 dias depois pergunta se o cliente fechou; 'Fechou' aceita e a peça vai pra fila", async () => {
    const { runQuoteFollowups } = await import("../src/services/followup.js");
    const { h, jobId } = await closedMesa();
    h.telegram.clear();
    h.advance(1);
    expect(await runQuoteFollowups(h.ctx)).toBe(0); // cedo demais
    h.advance(2.2);
    expect(await runQuoteFollowups(h.ctx)).toBe(1);
    const msg = h.telegram.sent.at(-1)!;
    expect(msg.text).toMatch(/mesa da Dona Ana.*respondeu\?/);
    expect(buttonsOf(msg)).toEqual(expect.arrayContaining([expect.stringMatching(/^ag:fu:yes:/), expect.stringMatching(/^ag:fu:wait:/)]));
    expect(await runQuoteFollowups(h.ctx)).toBe(0); // não repete no mesmo dia
    const yes = buttonsOf(msg).find((b) => b.startsWith("ag:fu:yes:"))!;
    const r = h.allText(await h.click(yes));
    expect(r).toMatch(/fechou/i);
    expect((await getJob(h.ctx, jobId))!.status).toBe("AGUARDANDO_INICIO");
    expect(h.allText(await h.click(yes))).toMatch(/já está anotado/);
    h.advance(10);
    expect(await runQuoteFollowups(h.ctx)).toBe(0); // resolvido: nunca mais pergunta
  });

  it("'Ainda não' pergunta de novo 4 dias depois, uma vez", async () => {
    const { runQuoteFollowups } = await import("../src/services/followup.js");
    const { h } = await closedMesa();
    h.advance(3.2);
    await runQuoteFollowups(h.ctx);
    const wait = buttonsOf(h.telegram.sent.at(-1)!).find((b) => b.startsWith("ag:fu:wait:"))!;
    expect(h.allText(await h.click(wait))).toMatch(/pergunto de novo/);
    h.advance(1);
    expect(await runQuoteFollowups(h.ctx)).toBe(0);
    h.advance(3.5);
    expect(await runQuoteFollowups(h.ctx)).toBe(1);
    h.advance(10);
    expect(await runQuoteFollowups(h.ctx)).toBe(0);
  });

  it("no meio de uma conversa não pergunta", async () => {
    const { runQuoteFollowups } = await import("../src/services/followup.js");
    const { h } = await closedMesa();
    h.advance(3.2);
    h.ctx.ai.agent = new ScriptedAgent([() => say("Oi! 🙂")]);
    await h.send("e aí");
    expect(await runQuoteFollowups(h.ctx)).toBe(0);
  });
});

describe("excelência: PDF novo substitui o antigo", () => {
  it("fechar de novo a mesma peça: a proposta anterior vira CANCELADO (substituída)", async () => {
    let jobId = "";
    const { h } = await setup([
      () => tool("criar_servico", { movel: "mesa", campos: { tecnicas: ["verniz"], cliente: "Dona Ana", largura_cm: 100, fundura_cm: 60, altura_cm: 80, estado: "bom", superficies: "externa", parte: "inteiro", conserto: false, metodo: "pincel", artesao_busca: false, artesao_entrega: false, prazo_entrega: "daqui a 2 meses" } }),
      (m) => {
        jobId = (lastToolResult(m).criado as { servico_id: string }).servico_id;
        return tool("calcular_orcamento", { servico_ids: [jobId] });
      },
      () => say("Concorda? 🤝"),
      () => tool("fechar_orcamento", { servico_ids: [jobId] }),
      () => say("Fechado! ✅"),
      () => tool("calcular_orcamento", { servico_ids: [jobId] }),
      () => say("Concorda? 🤝"),
      () => tool("fechar_orcamento", { servico_ids: [jobId], valor_final_reais: 999 }),
      () => say("Fechado! ✅"),
    ]);
    await h.send("mesa da dona Ana pra envernizar, 1 metro por 60, 80 de altura, tá boa, só por fora, inteira, sem conserto, pincel, ela traz e busca, fica pronto daqui a 2 meses");
    await h.send("concordo");
    await h.send("refaz a conta da mesa, vou cobrar 999");
    await h.send("isso, 999");
    const rows = await h.ctx.db.all<{ status: string }>("SELECT status FROM quotes WHERE status IN ('ENVIADO','APROVADO','CANCELADO') ORDER BY created_at");
    expect(rows.map((r) => r.status)).toEqual(["CANCELADO", "ENVIADO"]);
  });
});

describe("excelência: guardas vindas da avaliação real", () => {
  it("criar a mesma peça do mesmo cliente de novo é recusado (volta o servico_id); outra_peca: true deixa", async () => {
    let second: Record<string, unknown> = {};
    const { h } = await setup([
      () => tool("criar_servico", { movel: "pomba decorativa", campos: { cliente: "Dona Neide" } }),
      () => say("Anotei ✅"),
      () => tool("criar_servico", { movel: "pomba decorativa", campos: { cliente: "Dona Neide", estado: "bom" } }),
      (m) => {
        second = lastToolResult(m);
        return say("Anotei ✅");
      },
    ]);
    await h.send("uma pomba decorativa da dona neide");
    await h.send("ela tá boa");
    expect(String(second.erro)).toMatch(/já existe/);
    expect(await h.ctx.db.first<{ n: number }>("SELECT COUNT(*) n FROM jobs").then((r) => r!.n)).toBe(1);
  });

  it("mesma mensagem de novo → pede resposta curtinha", () => {
    const prev = ["Fechado ✅ Te mandei o PDF aqui. Quando a Dona Neide responder, me avisa que eu marco como aceito 👍"];
    const r = reviewDraft("Beleza! Quando a Dona Neide responder, me avisa que eu marco como aceito 👍", "", "", [{}], "", prev);
    expect(r?.kind).toBe("repetiu_mensagem");
  });

  it("material perguntado 2 vezes sem resposta: não pergunta a 3ª", () => {
    const prev = ["Quanto dá, mais ou menos, a tinta que você vai usar?", "Mesmo assim, quanto dá a tinta que vai usar? Entra no valor."];
    expect(reviewDraft("Só falta isso: quanto dá o material que você vai usar?", "eu tenho as tintas", "", [{}], "", prev)?.kind).toBe("material_insistente");
    expect(reviewDraft("Mesmo assim, quanto dá a tinta?", "eu tenho as tintas", "", [{}], "", prev.slice(0, 1))?.kind).not.toBe("material_insistente");
  });
});

describe("excelência: texto pro Telegram", () => {
  it("negrito de markdown sai (Telegram mostraria os asteriscos)", async () => {
    const { stripMarkdown } = await import("../src/agent/engine.js");
    expect(stripMarkdown("💰 Sugestão: **R$ 156,00**, pelas *3 horas*.")).toBe("💰 Sugestão: R$ 156,00, pelas 3 horas.");
  });
});

describe("excelência: valor aceito e o que mudou", () => {
  it("anotar prazo ou observação depois do valor mostrado não reabre o valor; mudar o método reabre e diz o que mudou", async () => {
    let jobId = "";
    let closeTry: Record<string, unknown> = {};
    let recalc: Record<string, unknown> = {};
    const { h } = await setup([
      () => tool("criar_servico", { movel: "mesa", campos: { tecnicas: ["verniz"], cliente: "Dona Ana", largura_cm: 100, fundura_cm: 60, altura_cm: 80, estado: "bom", superficies: "externa", parte: "inteiro", conserto: false, metodo: "pincel", artesao_busca: false, artesao_entrega: false } }),
      (m) => {
        jobId = (lastToolResult(m).criado as { servico_id: string }).servico_id;
        return tool("calcular_orcamento", { servico_ids: [jobId] });
      },
      () => say("Concorda? 🤝"),
      () => tool("anotar", { servico_id: jobId, campos: { observacao: "verniz fica de fora até a nota", metodo: "pistola" } }),
      () => tool("fechar_orcamento", { servico_ids: [jobId] }),
      (m) => {
        closeTry = lastToolResult(m);
        return tool("calcular_orcamento", { servico_ids: [jobId] });
      },
      (m) => {
        recalc = lastToolResult(m);
        return say("ok");
      },
    ]);
    await h.send("mesa da dona Ana pra envernizar, 1 metro por 60, 80 de altura, tá boa, só por fora, inteira, sem conserto, pincel, ela traz e busca");
    await h.click(`ag:btn:${encodeURIComponent("Concordo com o valor")}`);
    expect(JSON.stringify(closeTry.o_que_mudou)).toMatch(/pistola|m[eé]todo/i);
    expect(JSON.stringify(closeTry.o_que_mudou)).not.toMatch(/observa/i);
    if (recalc.mudou_desde_o_valor_mostrado) expect(String(recalc.mensagem_pronta)).toMatch(/Antes deu/);
  });
});

describe("excelência: extras não duplicam", () => {
  it("o mesmo material/trabalho dito com outras palavras substitui", async () => {
    const { sameItem } = await import("../src/agent/tools.js");
    expect(sameItem("Puxadores novos (8 un.)", "puxador de latão")).toBe(true);
    expect(sameItem("Trocar puxadores", "Troca dos puxadores")).toBe(true);
    expect(sameItem("veludo", "cola de contato")).toBe(false);
    expect(sameItem("Trabalho extra", "trabalho de entalhe")).toBe(false);
  });
});

describe("24/11 (Seu Roberto): botão velho, desconto, prazo antigo, uma mensagem por vez", () => {
  const mesa = { movel: "mesa", campos: { tecnicas: ["verniz"], cliente: "Dona Ana", largura_cm: 100, fundura_cm: 60, altura_cm: 80, estado: "bom", superficies: "externa", parte: "inteiro", conserto: false, metodo: "pincel", artesao_busca: false, artesao_entrega: false } };
  const MSG = "mesa da dona Ana pra envernizar, 1 metro por 60, 80 de altura, tá boa, só por fora, inteira, sem conserto, pincel, ela traz e busca, começa já e leva 3 dias, 10% de desconto";

  it("botão de um orçamento já fechado não fecha de novo (resposta fixa, sem Claude)", async () => {
    let jobId = "";
    const { h, agent } = await setup([
      () => tool("criar_servico", mesa),
      (m) => {
        jobId = (lastToolResult(m).criado as { servico_id: string }).servico_id;
        return tool("anotar", { servico_id: jobId, campos: { prazo_inicio: "já", prazo_duracao: "3 dias" } });
      },
      () => tool("calcular_orcamento", { servico_ids: [jobId] }),
      () => say("Concorda? 🤝"),
      () => tool("fechar_orcamento", { servico_ids: [jobId] }),
      () => say("Fechado ✅"),
    ]);
    const r1 = await h.send(MSG);
    const btn = buttonsOf(r1.at(-1)).find((d) => d.endsWith(":c"))!;
    expect(btn).toMatch(/^ag:q:\d+:c$/);
    await h.send("pode fechar");
    const docs = (await h.ctx.db.first<{ n: number }>("SELECT COUNT(*) n FROM quote_documents WHERE kind = 'COMERCIAL'"))!.n;
    expect(docs).toBe(1);
    const calls = agent.calls.length;
    const r = h.allText(await h.click(btn));
    expect(r).toMatch(/já foi fechado/);
    expect(agent.calls.length).toBe(calls);
    expect((await h.ctx.db.first<{ n: number }>("SELECT COUNT(*) n FROM quote_documents WHERE kind = 'COMERCIAL'"))!.n).toBe(1);
  });

  it("botão de um valor que mudou (recalculado depois) não vale", async () => {
    const { staleButtonText } = await import("../src/agent/engine.js");
    expect(staleButtonText({ presented: { jobIds: [], quoteIds: [], turn: 3, baseCents: 1, floorCents: null } })).toMatch(/valor antigo/);
  });

  it("desconto dado continua valendo quando o valor é refeito; fechar sem valor não perde o desconto", async () => {
    let jobId = "";
    let recalc: Record<string, unknown> = {};
    let closeTry: Record<string, unknown> = {};
    const { h } = await setup([
      () => tool("criar_servico", mesa),
      (m) => {
        jobId = (lastToolResult(m).criado as { servico_id: string }).servico_id;
        return tool("calcular_orcamento", { servico_ids: [jobId] });
      },
      () => say("Concorda? 🤝"),
      () => tool("simular_ajuste", { servico_ids: [jobId], desconto_pct: 10 }),
      () => say("Com 10% fica menos. Fecho assim?"),
      () => tool("calcular_orcamento", { servico_ids: [jobId] }),
      (m) => {
        recalc = lastToolResult(m);
        return say(String(recalc.mensagem_pronta));
      },
      () => tool("fechar_orcamento", { servico_ids: [jobId] }),
      (m) => {
        closeTry = lastToolResult(m);
        return say("ok");
      },
    ]);
    await h.send(MSG);
    await h.send("dá 10% de desconto");
    await h.send("refaz a conta");
    expect(String(recalc.mensagem_pronta)).toMatch(/Com o desconto de 10% que você deu: R\$/);
    await h.send("concordo");
    expect(closeTry.erro, JSON.stringify(closeTry)).toMatch(/ajuste/);
    expect(String(closeTry.valor_com_ajuste)).toMatch(/R\$/);
  });

  it("prazo anotado em outra conversa (horas antes) é confirmado antes do PDF", async () => {
    let jobId = "";
    let closeTry: Record<string, unknown> = {};
    const { h } = await setup([
      () => tool("criar_servico", mesa),
      (m) => {
        jobId = (lastToolResult(m).criado as { servico_id: string }).servico_id;
        return tool("anotar", { servico_id: jobId, campos: { prazo_inicio: "já", prazo_duracao: "3 dias" } });
      },
      () => say("Anotado"),
      () => tool("calcular_orcamento", { servico_ids: [jobId] }),
      () => say("Concorda?"),
      () => tool("fechar_orcamento", { servico_ids: [jobId] }),
      (m) => {
        closeTry = lastToolResult(m);
        return tool("fechar_orcamento", { servico_ids: [jobId], prazo_confirmado: true });
      },
      () => say("Fechado ✅"),
    ]);
    await h.send(MSG);
    h.advance(0.5); // 12 horas depois
    await h.send("faz a conta da mesa");
    await h.send("concordo");
    expect(closeTry.erro).toMatch(/prazo anotado em outra conversa/);
    expect((await h.ctx.db.first<{ n: number }>("SELECT COUNT(*) n FROM quote_documents WHERE kind = 'COMERCIAL'"))!.n).toBe(1);
  });

  it("duas mensagens juntas: uma espera a outra (o turno conta 2, sem uma sobrescrever a outra)", async () => {
    const { h } = await setup([() => say("Oi! 🙂"), () => say("Tudo certo 🙂")]);
    await Promise.all([h.send("oi"), h.send("tudo bem?")]);
    const s = await h.ctx.db.first<{ context_json: string }>("SELECT context_json FROM conversation_sessions");
    expect((JSON.parse(s!.context_json) as { agent?: { turn?: number } }).agent?.turn).toBe(2);
    expect((await h.ctx.db.first<{ n: number }>("SELECT COUNT(*) n FROM user_locks"))!.n).toBe(0);
  });
});

describe("24/11: pergunta proativa aberta e outro assunto", () => {
  it("'Bom dia, o Seu Roberto quer mudar os orçamentos' vai pro agente (não 'Tudo certo por aqui'); resposta curta continua no fluxo da pergunta", async () => {
    const { h, agent } = await setup([() => say("Bora! O que ele quer mudar? 🙂")]);
    await h.send("oi");
    const setFlow = async () => {
      const s = (await h.ctx.db.first<{ id: string; context_json: string }>("SELECT id, context_json FROM conversation_sessions"))!;
      const c = JSON.parse(s.context_json) as Record<string, unknown>;
      c.dataCollection = { requestId: "r1", expecting: "primary", kind: "stock_quantity" };
      await h.ctx.db.run("UPDATE conversation_sessions SET flow = 'data_collection', context_json = ? WHERE id = ?", JSON.stringify(c), s.id);
    };
    await setFlow();
    const calls = agent.calls.length;
    const r = h.allText(await h.send("Bom dia, o senhor Roberto quer mudar os orçamentos do rack e do aparador"));
    expect(agent.calls.length).toBeGreaterThan(calls);
    expect(r).not.toMatch(/Tudo certo por aqui/);
    const s = await h.ctx.db.first<{ flow: string }>("SELECT flow FROM conversation_sessions");
    expect(s!.flow).toBe("idle");
  });
});
