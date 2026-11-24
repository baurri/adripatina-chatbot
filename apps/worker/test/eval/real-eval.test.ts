import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "vitest";
import { createHarness, type Harness } from "../harness.js";
import { api } from "../helpers.js";
import { ClaudeExtraction, FallbackExtraction } from "../../src/ai/claude.js";
import { ClaudeAgentModel } from "../../src/ai/claude-agent.js";
import { QUOTE_REQUEST_JSON_SCHEMA } from "../../src/ai/providers.js";
import { resetAiBreaker } from "../../src/ai/service.js";
import type { SentRecord } from "../../src/telegram/client.js";
import { DIVERSE, SCENARIOS, type Scenario } from "./scenarios.js";

/**
 * AVALIAÇÃO COM O CLAUDE DE VERDADE (D-074). Não roda nos testes normais: `EVAL=1`.
 *
 * - O bot roda inteiro (banco em memória com as migrations reais, Telegram simulado) usando o
 *   Claude Haiku de produção para entender/dar voz.
 * - O "Adriano" é simulado por outro Claude a partir de um roteiro de caso (fatos a contar e o
 *   jeito de falar), com fala natural, erros de transcrição e mudanças de assunto — por isso pega
 *   casos que ninguém mapeou: a fala muda a cada rodada.
 * - Cada cenário tem conferências objetivas no banco (o que tinha que ficar anotado) e uma nota
 *   de um Claude avaliador (Sonnet) com a rubrica do contrato de conversa.
 * - Relatório em docs/eval/latest.md (+ JSON).
 *
 * Uso: EVAL=1 npx vitest run test/eval/real-eval.test.ts   (EVAL_ONLY=id1,id2 para filtrar)
 */

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, "../../../..");

function apiKey(): string | null {
  try {
    const m = /^ANTHROPIC_API_KEY=(.+)$/m.exec(readFileSync(join(ROOT, ".dev.vars"), "utf8"));
    return m?.[1]?.trim() || null;
  } catch {
    return null;
  }
}

const KEY = process.env.EVAL ? apiKey() : null;
const BOT_MODEL = process.env.EVAL_BOT_MODEL ?? "claude-haiku-5-5";
const SIM_MODEL = process.env.EVAL_SIM_MODEL ?? "claude-haiku-5-5";
const JUDGE_MODEL = process.env.EVAL_JUDGE_MODEL ?? "claude-sonnet-5-5";

interface Turn {
  who: "adriano" | "bot";
  text: string;
  buttons?: { text: string; data: string }[];
  voice?: boolean;
}

function botTurns(records: SentRecord[]): Turn[] {
  return records
    .filter((r) => r.kind === "message" || r.kind === "document")
    .map((r) => ({ who: "bot" as const, text: r.kind === "document" ? `[PDF enviado: ${r.filename}]` : (r.text ?? ""), buttons: (r.buttons ?? []).flat().map((b) => ({ text: b.text, data: b.data })) }));
}

function transcript(turns: Turn[], diag = false): string {
  return turns
    .map((t) => (diag ? t : { ...t, text: t.text.replace(/\n {3}\{entendido[\s\S]*$/, "") }))
    .map((t, i) => `${i + 1}. ${t.who === "adriano" ? `ADRIANO${t.voice ? " (áudio)" : ""}` : "BOT"}: ${t.text}${t.buttons?.length ? `\n   [botões: ${t.buttons.map((b) => b.text).join(" | ")}]` : ""}`)
    .join("\n");
}

const SIM_SCHEMA = {
  type: "object",
  properties: {
    acao: { type: "string", enum: ["falar", "botao", "fim"] },
    texto: { type: "string" },
    botao: { type: "string" },
    audio: { type: "boolean" },
  },
  required: ["acao"],
};

function simSystem(s: Scenario): string {
  return `Você interpreta ADRIANO, artesão de restauração de móveis (Brasil), conversando com o assistente dele no Telegram. Isto é uma simulação para testar o assistente.
Como o Adriano fala: português do Brasil bem informal, frases soltas, muitas vezes por áudio (então às vezes escreve como fala, com erros de transcrição e palavras trocadas), mistura assuntos, às vezes responde mais do que foi perguntado ou fora de ordem. Não usa termos técnicos de sistema. Às vezes responde só "sim", "isso", "não sei".
O caso que você está vivendo (fatos verdadeiros — nunca contradiga, conte quando fizer sentido, não precisa contar tudo de uma vez):
${s.brief}
${s.quirks ? `Jeitos dessa conversa: ${s.quirks}` : ""}
Objetivo: ${s.goal}
Regras da simulação:
- Responda à última mensagem do assistente como o Adriano faria. Se aparecerem botões, você pode tocar num (acao "botao", com o texto exato do botão) ou escrever.
- Se o assistente perguntar algo que o caso não diz, invente uma resposta plausível e coerente com o caso, ou diga que não sabe.
- Use "audio": true quando for uma fala mais longa (como o Adriano faz).
- Quando o objetivo estiver cumprido (ou a conversa travar de vez, ou o assistente mandar o PDF/encerrar), use acao "fim".
Responda só JSON.`;
}

const JUDGE_SCHEMA = {
  type: "object",
  properties: {
    notas: {
      type: "object",
      properties: {
        entendimento: { type: "integer" },
        naturalidade: { type: "integer" },
        acessibilidade: { type: "integer" },
        uma_pergunta_por_vez: { type: "integer" },
        sem_invencao: { type: "integer" },
        eficiencia: { type: "integer" },
        conclusao: { type: "integer" },
      },
      required: ["entendimento", "naturalidade", "acessibilidade", "uma_pergunta_por_vez", "sem_invencao", "eficiencia", "conclusao"],
    },
    problemas: {
      type: "array",
      items: { type: "object", properties: { turno: { type: "integer" }, gravidade: { type: "string", enum: ["alta", "media", "baixa"] }, classe: { type: "string" }, descricao: { type: "string" } }, required: ["gravidade", "classe", "descricao"] },
    },
    resumo: { type: "string" },
  },
  required: ["notas", "problemas", "resumo"],
};

const JUDGE_SYSTEM = `Você avalia conversas entre ADRIANO (artesão de restauração de móveis, fala por áudio, pouca paciência para texto técnico) e o ASSISTENTE dele no Telegram. O padrão de excelência é o CONTRATO DE CONVERSA:
- entende o que ele quis dizer no contexto (erros de transcrição, várias peças, respostas fora de ordem, correções, "todos eles");
- fala como um parceiro de oficina: simples, curto, amigável, bem-humorado, emojis com moderação, parágrafos curtos;
- acessível: nada de jargão (parâmetro, calibrado, confiança, pendência, piso, margem, preliminar técnico), nada de textão;
- uma pergunta por mensagem, nunca repete a mesma pergunta do mesmo jeito, nunca pergunta o que ele já disse;
- nunca inventa fato (número, nome, peça, defeito, data) nem promete/agenda o que não fez;
- eficiente: chega ao objetivo com poucas trocas;
- conclusão: o objetivo do caso foi atingido.
Dê notas de 1 (péssimo) a 5 (excelente) e liste os problemas concretos (turno, gravidade, classe curta tipo "nao_entendeu", "pergunta_repetida", "jargao", "inventou", "perdeu_informacao", "tom", "travou", "fluxo_confuso", "texto_longo"). Seja exigente: 5 só se estiver no nível de um bom atendente humano. Responda só JSON.`;

interface Result {
  id: string;
  title: string;
  turns: Turn[];
  checks: { ok: boolean; name: string; detail?: string }[];
  judge: { notas: Record<string, number>; problemas: { turno?: number; gravidade: string; classe: string; descricao: string }[]; resumo: string } | null;
  error?: string;
  ms: number;
}

async function runScenario(s: Scenario, key: string): Promise<Result> {
  const started = Date.now();
  resetAiBreaker();
  const h: Harness = await createHarness();
  h.clock.now = new Date("2026-11-24T13:00:00Z");
  await h.calibrateAndPrice();
  await s.setup?.(h, (m, p, b) => api(h, m, p, b));
  h.ctx.config = { ...h.ctx.config, conversationAi: true, phrasingVariety: true, aiEnabled: true };
  h.ctx.ai.extraction = new FallbackExtraction(new ClaudeExtraction(key, BOT_MODEL, { timeoutMs: 30000 }), null, QUOTE_REQUEST_JSON_SCHEMA);
  h.ctx.ai.stt = h.stt;
  // D-075: motor novo (Claude com ferramentas); EVAL_ENGINE=legacy mede o antigo
  if (process.env.EVAL_ENGINE !== "legacy") h.ctx.ai.agent = new ClaudeAgentModel(key, BOT_MODEL, { timeoutMs: 60000 }); // o "áudio" do Adriano simulado chega transcrito (mock de transcrição)
  const sim = new ClaudeExtraction(key, SIM_MODEL, { timeoutMs: 40000 });
  const judge = new ClaudeExtraction(key, JUDGE_MODEL, { timeoutMs: 90000 });
  const turns: Turn[] = [];
  let error: string | undefined;
  let voiceSeq = 0;
  try {
    for (let i = 0; i < (s.maxTurns ?? 18); i++) {
      const last = turns.filter((t) => t.who === "bot").slice(-4);
      const user = i === 0 ? `A conversa começa agora. Mande a primeira mensagem do Adriano: ${s.opening}` : `Conversa até aqui:\n${transcript(turns.slice(-16))}\n\nResponda à última mensagem do assistente.`;
      const raw = (await sim.generate({ purpose: "eval:sim", system: simSystem(s), user, jsonSchema: SIM_SCHEMA, maxTokens: 400 })) as { acao?: string; texto?: string; botao?: string; audio?: boolean };
      if (!raw || raw.acao === "fim") break;
      let replies: SentRecord[];
      if (raw.acao === "botao" && raw.botao) {
        const btn = last.flatMap((t) => t.buttons ?? []).reverse().find((b) => b.text.toLowerCase().includes(raw.botao!.toLowerCase()) || raw.botao!.toLowerCase().includes(b.text.toLowerCase()));
        if (!btn) {
          turns.push({ who: "adriano", text: raw.botao });
          replies = await h.send(raw.botao);
        } else {
          turns.push({ who: "adriano", text: `[tocou: ${btn.text}]` });
          replies = await h.click(btn.data);
        }
      } else {
        const text = (raw.texto ?? "").trim();
        if (!text) break;
        const voice = !!raw.audio && text.split(/\s+/).length > 5;
        turns.push({ who: "adriano", text, voice });
        replies = voice ? await h.voice(`ev${voiceSeq++}`, text) : await h.send(text);
      }
      // diagnóstico: o que o Claude entendeu dessa fala (texto claro) e por onde ela foi
      const lastIn = await h.ctx.db.first<{ routing_json: string | null }>("SELECT routing_json FROM conversation_messages WHERE direction = 'in' ORDER BY rowid DESC LIMIT 1");
      const rj = lastIn?.routing_json ? (JSON.parse(lastIn.routing_json) as { understood?: string; route?: string; contextualIntent?: string }) : null;
      const lastAdriano = [...turns].reverse().find((t) => t.who === "adriano");
      if (lastAdriano && rj) lastAdriano.text += `\n   {entendido: ${rj.understood ?? "(igual)"} · rota: ${rj.route ?? "?"}/${rj.contextualIntent ?? "?"}}`;
      turns.push(...botTurns(replies));
    }
  } catch (err) {
    error = err instanceof Error ? `${err.message}\n${err.stack?.split("\n").slice(1, 4).join("\n")}` : String(err);
  }
  const checks = error ? [] : await s.checks(h);
  let verdict: Result["judge"] = null;
  try {
    const user = `CASO: ${s.title}\nO QUE O ADRIANO QUERIA: ${s.goal}\nFATOS DO CASO: ${s.brief}\n\nCONVERSA:\n${transcript(turns)}\n\nCONFERÊNCIAS OBJETIVAS NO BANCO:\n${checks.map((c) => `${c.ok ? "OK" : "FALHOU"} — ${c.name}${c.detail ? ` (${c.detail})` : ""}`).join("\n")}`;
    verdict = (await judge.generate({ purpose: "eval:judge", system: JUDGE_SYSTEM, user, jsonSchema: JUDGE_SCHEMA, maxTokens: 2500 })) as Result["judge"];
  } catch (err) {
    error = (error ? `${error}\n` : "") + `juiz: ${err instanceof Error ? err.message : String(err)}`;
  }
  return { id: s.id, title: s.title, turns, checks, judge: verdict, ...(error ? { error } : {}), ms: Date.now() - started };
}

function report(results: Result[]): string {
  const keys = ["entendimento", "naturalidade", "acessibilidade", "uma_pergunta_por_vez", "sem_invencao", "eficiencia", "conclusao"];
  const avg = (k: string) => {
    const v = results.map((r) => r.judge?.notas?.[k]).filter((x): x is number => typeof x === "number");
    return v.length ? (v.reduce((a, b) => a + b, 0) / v.length).toFixed(2) : "—";
  };
  const checks = results.flatMap((r) => r.checks);
  const lines = [
    `# Avaliação com Claude real — ${new Date().toISOString().slice(0, 16)}`,
    "",
    `Motor: ${process.env.EVAL_ENGINE === "legacy" ? "antigo" : "agente (D-075)"} · Bot: ${BOT_MODEL} · Adriano simulado: ${SIM_MODEL} · Avaliador: ${JUDGE_MODEL}`,
    "",
    `Conferências objetivas: **${checks.filter((c) => c.ok).length}/${checks.length}**`,
    "",
    "| Critério | Média (1–5) |",
    "|---|---|",
    ...keys.map((k) => `| ${k} | ${avg(k)} |`),
    "",
  ];
  const classes = new Map<string, number>();
  for (const r of results) for (const p of r.judge?.problemas ?? []) classes.set(`${p.gravidade}:${p.classe}`, (classes.get(`${p.gravidade}:${p.classe}`) ?? 0) + 1);
  lines.push("## Problemas por classe", "", ...[...classes].sort((a, b) => b[1] - a[1]).map(([k, n]) => `- ${k}: ${n}`), "");
  for (const r of results) {
    lines.push(`## ${r.id} — ${r.title}`, "", `Notas: ${r.judge ? keys.map((k) => `${k} ${r.judge!.notas?.[k] ?? "—"}`).join(" · ") : "—"} · ${Math.round(r.ms / 1000)}s`, "");
    if (r.error) lines.push("```", r.error, "```", "");
    for (const c of r.checks) lines.push(`- ${c.ok ? "✅" : "❌"} ${c.name}${c.detail ? ` — ${c.detail}` : ""}`);
    if (r.judge) lines.push("", `> ${r.judge.resumo}`, "", ...r.judge.problemas.map((p) => `- [${p.gravidade}] (${p.classe}) turno ${p.turno ?? "?"}: ${p.descricao}`));
    lines.push("", "<details><summary>Conversa</summary>", "", "```", transcript(r.turns, true), "```", "", "</details>", "");
  }
  return lines.join("\n");
}

describe.skipIf(!KEY)("avaliação com Claude real (EVAL=1)", () => {
  it("roda os cenários e grava o relatório", { timeout: 60 * 60 * 1000 }, async () => {
    const only = process.env.EVAL_ONLY?.split(",").map((s) => s.trim()).filter(Boolean);
    const list = [...SCENARIOS, ...DIVERSE].filter((s) => !only?.length || only.includes(s.id));
    const results: Result[] = [];
    for (const s of list) {
      const r = await runScenario(s, KEY!);
      results.push(r);
      console.info(`[eval] ${s.id}: checks ${r.checks.filter((c) => c.ok).length}/${r.checks.length} · notas ${r.judge ? JSON.stringify(r.judge.notas) : "—"}${r.error ? " · ERRO" : ""}`);
    }
    const dir = join(ROOT, "docs/eval");
    mkdirSync(dir, { recursive: true });
    const out = process.env.EVAL_OUT ?? "latest";
    writeFileSync(join(dir, `${out}.md`), report(results));
    writeFileSync(join(dir, `${out}.json`), JSON.stringify(results, null, 2));
  });
});
