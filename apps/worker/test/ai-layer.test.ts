import { describe, expect, it } from "vitest";
import { createHarness } from "./harness.js";
import { getJob } from "../src/repos/jobs.js";
import { inboundIssues, outboundIssues } from "../src/conversation/ai-layer.js";

/** D-073: o Claude lê toda mensagem e dá voz a toda resposta — sempre conferido pelo código. */
describe("conferência da entrada (texto claro)", () => {
  const corpus = "Assistente: Quais são as medidas da mesinha de centro?\npeças: a mesinha de centro; o 1º aparador; o 2º aparador";
  it("aceita correção de transcrição e explicitação das peças", () => {
    expect(inboundIssues("duas aparadoras", "dois aparadores", corpus)).toEqual([]);
    expect(inboundIssues("a mesinha tem 2 metros redonda e os criados tem oitenta por quarenta", "a mesinha de centro tem 2 metros de diâmetro; o 1º aparador e o 2º aparador têm 80 por 40", corpus)).toEqual([]);
    expect(inboundIssues("já trnho", "já tenho", corpus)).toEqual([]);
    expect(inboundIssues("errei, é rolo", "corrigir: o método é rolo", corpus)).toEqual([]);
  });
  it("recusa número, móvel, nome ou defeito que ele não disse", () => {
    expect(inboundIssues("já tenho", "já tenho, paguei 90 reais", corpus).join()).toMatch(/número inventado/);
    expect(inboundIssues("80 por 40", "a cômoda tem 80 por 40", corpus).join()).toMatch(/móvel inventado/);
    expect(inboundIssues("é da cliente", "é da dona Marta", corpus).join()).toMatch(/nome inventado/);
    expect(inboundIssues("tá boazinha", "está boa mas a perna quebrou", corpus).join()).toMatch(/detalhe inventado/);
  });
});

describe("conferência da saída (voz)", () => {
  const corpus = "Adriano: chegou uma cômoda da dona Carla";
  it("aceita reescrita amigável que mantém tudo", () => {
    const orig = 'Quanto custa a lata de verniz? Pode falar junto o tamanho, por exemplo: "a lata de 900 ml custa 90 reais".';
    const pol = 'Bora pro verniz! 🎨\n\nQuanto custa a lata que você costuma comprar? Pode falar junto o tamanho, tipo: "a lata de 900 ml custa 90 reais". 😉';
    expect(outboundIssues(orig, pol, corpus)).toEqual([]);
  });
  it("recusa número mudado, pergunta a mais, exemplo sumido, história inventada", () => {
    expect(outboundIssues("Minha sugestão é cobrar R$ 692,00.", "Minha sugestão é cobrar R$ 690,00. 💰", corpus).join()).toMatch(/números mudaram/);
    expect(outboundIssues("Anotado: só por fora.", "Anotado: só por fora. E por dentro?", corpus).join()).toMatch(/perguntas/);
    expect(outboundIssues('Pode dizer "não precisa".', "Pode me dizer como preferir. 🙂", corpus).join()).toMatch(/exemplo\/botão sumiu/);
    expect(outboundIssues("Anotado: sem consertos.", "Anotado! Meu filho também quebrou a perna da mesa ontem. 😄", corpus).join()).toMatch(/história|detalhe inventado/);
    expect(outboundIssues("Anotado: sem consertos.", "Anotado, o senhor manda! Sem consertos.", corpus).join()).toMatch(/formal/);
  });
});

describe("integração com o motor (Claude simulado)", () => {
  async function upToMethod() {
    const h = await createHarness();
    await h.calibrateAndPrice();
    h.ctx.ai.extraction = h.extraction;
    const seen: string[] = [];
    h.extraction.generateHandler = (req) => {
      seen.push(req.purpose);
      if (req.purpose === "turn:understand") {
        const msg = /"""([\s\S]*)"""\s*$/.exec(req.user)?.[1] ?? "";
        if (/trincha/.test(msg)) return { tipo: "resposta", texto_claro: "pincel; também vou usar faca pra raspar" };
        if (/invent/.test(msg)) return { tipo: "resposta", texto_claro: "rolo, e a mesa tem 3 metros" };
        return null;
      }
      if (req.purpose === "reply:polish") {
        const list = JSON.parse(req.user.slice(req.user.lastIndexOf("["))) as string[];
        return { mensagens: list.map((m) => (/aplicação: pincel/.test(m) ? `${m} 🎨😄` : m.replace(/R\$ [\d.,]+/, "R$ 1,00"))) };
      }
      return null;
    };
    await h.send("Peguei uma mesa da dona Ana para envernizar");
    for (const t of ["está boa", "1 metro de largura, 80 de altura e 60 de fundura", "só por fora", "não"]) await h.send(t);
    return { h, seen };
  }

  it("'vou de trincha e uma faca pra raspar' vira pincel + observação; a resposta ganha voz", async () => {
    const { h, seen } = await upToMethod();
    const r = h.allText(await h.send("vou de trincha e uma faca pra raspar"));
    const job = (await h.ctx.db.first<{ id: string }>("SELECT id FROM jobs"))!;
    const f = (await getJob(h.ctx, job.id))!.facts;
    expect(f.application_method?.value).toBe("pincel");
    expect(seen).toContain("turn:understand");
    expect(r).toMatch(/aplicação: pincel/);
    expect(r).toMatch(/🎨😄/); // voz do Claude aceita
    const m = await h.ctx.db.first<{ routing_json: string }>("SELECT routing_json FROM conversation_messages WHERE direction = 'in' AND text LIKE 'vou de trincha%'");
    expect(JSON.parse(m!.routing_json).understood).toMatch(/pincel/);
  });

  it("texto claro com número inventado é descartado: vale o que ele disse", async () => {
    const { h } = await upToMethod();
    await h.send("invent rolo");
    const job = (await h.ctx.db.first<{ id: string }>("SELECT id FROM jobs"))!;
    const f = (await getJob(h.ctx, job.id))!.facts;
    expect(f.application_method?.value).toBe("rolo");
    expect(JSON.stringify(f.dimensions?.value)).not.toMatch(/"3"/);
  });

  it("voz que muda um valor é descartada (sai o texto do sistema)", async () => {
    const { h } = await upToMethod();
    await h.send("pincel");
    const r = h.allText(await h.send("não precisa"));
    expect(r).not.toMatch(/R\$ 1,00/);
  });
});
