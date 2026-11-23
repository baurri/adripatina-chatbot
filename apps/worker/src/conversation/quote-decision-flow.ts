import { systemPrompt, type Button, type NluResult } from "@adripatina/conversations";
import { findConfidentialTerms } from "@adripatina/pdf";
import { allocateCents, extractLooseMoney, formatBRL, normalizeText, parseBareAmountCents } from "@adripatina/shared";
import type { Conversation } from "./engine.js";
import { getJob, jobPhrase, type Job } from "../repos/jobs.js";
import { closeQuoteByArtisan, getQuote, issueDocuments, sendDocumentToArtisan, type PriceAdjustment, type QuoteRecord } from "../services/quotes.js";
import { interpretStructured } from "../ai/orchestrator.js";
import { enqueueOutbox } from "../services/outbox.js";

/**
 * D-070 — o Adriano sempre fez os próprios orçamentos: o sistema SUGERE um valor e ele decide.
 * Depois do cálculo: "Você concorda? Quer dar desconto? Acrescentar?" → o PDF sai na hora com o
 * valor dele (e o desconto/acréscimo destacado). Nada de "confiança", "pendências" ou
 * "parâmetros não calibrados" para o artesão: isso fica no painel do administrador.
 * Vale para um móvel ou para vários (total sugerido; o valor dele é dividido entre as peças
 * na proporção da sugestão de cada uma; um PDF por peça).
 */

const reais = (cents: number) => formatBRL(Math.ceil(cents / 100) * 100);

interface Group {
  quotes: QuoteRecord[];
  base: number;
  floor: number | null;
}

function decisionButtons(quoteId: string): Button[][] {
  return [
    [{ text: "👍 Concordo", data: `qa:ok:${quoteId}` }],
    [
      { text: "➖ Dar desconto", data: `qa:disc:${quoteId}` },
      { text: "➕ Acrescentar", data: `qa:add:${quoteId}` },
    ],
  ];
}

function extrasLines(quotes: QuoteRecord[]): string[] {
  const lines: string[] = [];
  const floor = quotes.reduce((a, q) => a + (q.result.floorCents ?? 0), 0);
  const buy = quotes.reduce((a, q) => a + q.result.materials.purchaseCashOutlayCents, 0);
  const hours = Math.round(quotes.reduce((a, q) => a + Number(q.result.labor.totalHours), 0));
  if (floor > 0) lines.push(`⚠️ Menos que ${reais(floor)}${quotes.length > 1 ? " no total" : ""} você começa a ter prejuízo.`);
  if (buy > 0) lines.push(`🛒 Vai precisar comprar uns ${reais(buy)} de material.`);
  if (hours > 0) lines.push(`⏱️ Dá umas ${hours} ${hours === 1 ? "hora" : "horas"} de trabalho.`);
  const gaps = quotes.flatMap((q) => q.result.gaps ?? []);
  if (gaps.some((g) => g.code === "TRANSPORT_COST_MISSING")) lines.push("🚚 O frete não está na conta. Se for cobrar, é só acrescentar.");
  if (gaps.some((g) => g.code === "REPAIRS_HOURS_MISSING")) lines.push("🛠️ O conserto não está na conta. Se for cobrar, é só acrescentar.");
  if (gaps.some((g) => g.code.startsWith("DIMENSIONS") || g.code === "BED_NOMINAL_SIZE") || quotes.some((q) => q.result.warnings.some((w) => w.code === "AREA_RANGE_MAX_USED"))) {
    lines.push("📏 Fiz com a medida aproximada, então pode variar um pouco.");
  }
  return lines;
}

/** Mensagem curta e simples com o valor sugerido (um móvel). */
export function artisanQuoteMessage(job: Job, q: QuoteRecord): string {
  return [`🧮 Prontinho, fiz as contas d${jobPhrase(job)}!`, "", `💰 Minha sugestão é cobrar ${formatBRL(q.result.recommendedCents!)}.`, "", ...extrasLines([q]), "", "E aí, você concorda com esse valor? 🤝"].join("\n");
}

export async function presentQuoteDecision(c: Conversation, job: Job, q: QuoteRecord): Promise<void> {
  c.session.flow = "quote_decision";
  c.session.context.quoteDecision = { quoteId: q.id, step: "decide" };
  c.clearPending();
  c.say(artisanQuoteMessage(job, q), decisionButtons(q.id));
}

/**
 * Vários móveis: sugestão por peça e total. Se ele tinha falado quanto gasta de material
 * ("uns 70 reais de material"), compara com a conta — ajuda a calibrar sem jargão.
 */
export async function presentMultiQuoteDecision(c: Conversation, items: { name: string; quote: QuoteRecord }[], rawText: string): Promise<void> {
  const quotes = items.map((i) => i.quote);
  const total = quotes.reduce((a, q) => a + q.recommendedCents!, 0);
  const lines = [`🧮 Prontinho, fiz as contas dos ${items.length} móveis!`, ""];
  for (const it of items) lines.push(`• ${it.name.replace(/^(a|o) /, "").replace(/^./, (s) => s.toUpperCase())}: ${formatBRL(it.quote.recommendedCents!)}`);
  lines.push("", `💰 Total sugerido: ${formatBRL(total)}`, "", ...extrasLines(quotes));
  const said = /material/i.test(rawText) ? extractLooseMoney(rawText.slice(Math.max(0, rawText.search(/material/i) - 60), rawText.search(/material/i) + 60)) : null;
  const matCost = quotes.reduce((a, q) => a + q.result.materials.lines.reduce((s, l) => s + (l.consumptionCostCents ?? 0), 0), 0);
  if (said && matCost > 0) lines.push(`🧾 Você comentou uns ${formatBRL(said.cents)} de material; pela minha conta o material usado dá uns ${reais(matCost)}.`);
  lines.push("", "E aí, você concorda com esse valor? 🤝");
  c.session.flow = "quote_decision";
  c.session.context.quoteDecision = { quoteId: quotes[0]!.id, quoteIds: quotes.map((q) => q.id), step: "decide" };
  c.clearPending();
  c.say(lines.join("\n"), decisionButtons(quotes[0]!.id));
}

async function loadGroup(c: Conversation): Promise<Group | null> {
  const d = c.session.context.quoteDecision;
  if (!d) return null;
  const quotes: QuoteRecord[] = [];
  for (const id of d.quoteIds ?? [d.quoteId]) {
    const q = await getQuote(c.ctx, id);
    if (!q || q.recommendedCents === null) return null;
    quotes.push(q);
  }
  const floors = quotes.map((q) => q.floorCents);
  return { quotes, base: quotes.reduce((a, q) => a + q.recommendedCents!, 0), floor: floors.every((f) => f !== null) ? floors.reduce((a, f) => a! + f!, 0) : null };
}

/** Botões `qa:*`. */
export async function onQuoteDecisionCallback(c: Conversation, action: string, quoteId?: string): Promise<void> {
  const d = c.session.context.quoteDecision;
  if (!quoteId || !d || d.quoteId !== quoteId) {
    c.say("Esse orçamento já foi fechado. 🙂 Se quiser mudar o valor, é só pedir pra calcular de novo.");
    return;
  }
  const g = await loadGroup(c);
  if (!g) return c.greet();
  switch (action) {
    case "ok":
      return finalize(c, g, g.base);
    case "disc":
      d.step = "discount";
      c.say("Beleza! Quanto de desconto? 🙂\n\nPode falar em reais, tipo \"50 reais\", ou em porcentagem, tipo \"10%\".");
      return;
    case "add":
      d.step = "add";
      c.say("Certo! Quanto você quer acrescentar? ➕\n\nSe quiser, fala o motivo junto, tipo \"100 reais do frete\".");
      return;
    case "force":
      if (d.step !== "below_floor" || d.finalCents === undefined) return askAgain(c, g);
      return finalize(c, g, d.finalCents, d.label);
    case "redo":
      d.step = "decide";
      return askAgain(c, g);
  }
}

/** Texto durante a decisão: "concordo", "dá 50 de desconto", "cobra 650", "10%"... */
export async function quoteDecisionText(c: Conversation, text: string, nlu: NluResult): Promise<void> {
  const d = c.session.context.quoteDecision;
  const g = d ? await loadGroup(c) : null;
  if (!d || !g) {
    c.session.flow = "idle";
    return c.greet();
  }
  const base = g.base;
  const n = normalizeText(text);
  const percent = /(\d+(?:[.,]\d+)?)\s*(?:%|por ?cento)/.exec(n);
  const amount = percent ? null : parseBareAmountCents(text);
  const wantsDiscount = d.step === "discount" || /\b(desconto|descont\w*|abaix\w*|diminu\w*|tira|tirar|menos)\b/.test(n);
  const wantsAdd = d.step === "add" || /\b(acrescent\w*|soma|somar|aumenta\w*|adiciona\w*|a mais)\b|\bmais (uns |um |r\$ ?)?\d/.test(n);

  // D-074: o Claude lê a decisão ("dá pra fazer por uns 569?", "tira 10%", "põe o frete de 60").
  // Valor só vale se for dito na fala. NUNCA fecha com número na fala sem ter entendido o número
  // (avaliação 24/11/2026: "pode ser uns 569?" fechou em R$ 956 e mandou o PDF).
  const ai = await interpretDecision(c, g, d.step, text);
  if (ai) {
    if (ai.action === "concordar" && !/\d/.test(n)) return d.step === "below_floor" ? onQuoteDecisionCallback(c, "force", d.quoteId) : finalize(c, g, base);
    if (ai.action === "valor_final" && ai.cents) return confirmOrWarn(c, g, ai.cents);
    if (ai.action === "desconto" && (ai.cents || ai.pct)) return confirmOrWarn(c, g, base - (ai.cents ?? Math.round((base * ai.pct!) / 100)));
    if (ai.action === "acrescimo" && (ai.cents || ai.pct)) return confirmOrWarn(c, g, base + (ai.cents ?? Math.round((base * ai.pct!) / 100)), ai.reason);
    if (ai.action === "desconto") return onQuoteDecisionCallback(c, "disc", d.quoteId);
    if (ai.action === "acrescimo") return onQuoteDecisionCallback(c, "add", d.quoteId);
    if (ai.action === "nao_concorda") {
      c.say(`Tranquilo, o valor é você quem decide. 🙂\n\nMe diz quanto você quer cobrar, ou quanto de desconto, tipo "550 reais" ou "10%".`, decisionButtons(d.quoteId));
      return;
    }
  }
  if (d.step === "below_floor") {
    if (nlu.intent === "yes" && !/\d/.test(n)) return onQuoteDecisionCallback(c, "force", d.quoteId);
    if (nlu.intent === "no" && amount === null && !percent) return onQuoteDecisionCallback(c, "redo", d.quoteId);
  }
  if (!percent && amount === null) {
    if (/\d/.test(n)) {
      c.say("Não peguei bem o valor. 🤔 Me diz só o número que você quer cobrar, tipo \"550 reais\", ou o desconto, tipo \"10%\".", decisionButtons(d.quoteId));
      return;
    }
    if (nlu.intent === "yes" || /\b(concordo|pode ser|ta bom|ta otimo|fechado|fechou|beleza|esse mesmo|isso mesmo|perfeito|combinado|bora)\b/.test(n)) return finalize(c, g, base);
    if (/\bdesconto\b/.test(n)) return onQuoteDecisionCallback(c, "disc", d.quoteId);
    if (/\b(acrescent\w*|somar|aumentar)\b/.test(n)) return onQuoteDecisionCallback(c, "add", d.quoteId);
    c.say(
      d.step === "discount" ? "Não peguei o valor do desconto. Pode dizer, tipo \"50 reais\" ou \"10%\"." : d.step === "add" ? "Não peguei o valor. Pode dizer, tipo \"100 reais\" ou \"100 reais do frete\"." : "É só tocar num botão, ou me dizer do seu jeito, tipo \"pode ser esse\", \"dá 50 de desconto\" ou \"vou cobrar 650\". 🙂",
      d.step === "decide" ? decisionButtons(d.quoteId) : undefined,
    );
    return;
  }
  let final: number;
  let label: string | undefined;
  if (percent) {
    const pct = Number(percent[1]!.replace(",", "."));
    const delta = Math.round((base * pct) / 100);
    final = wantsAdd && !wantsDiscount ? base + delta : base - delta;
  } else if (wantsDiscount && !wantsAdd) final = base - amount!;
  else if (wantsAdd) {
    final = base + amount!;
    label = addReason(text);
  } else final = amount!; // "vou cobrar 650": valor final direto
  if (final <= 0) {
    c.say("Com esse desconto o valor fica zerado. 😅 Me diz um desconto menor, tipo \"50 reais\".");
    return;
  }
  return confirmOrWarn(c, g, final, label);
}

function addReason(text: string): string | undefined {
  const m = /\b(?:de|do|da|pelo|pela|pra|para|por causa d[oa])\s+([a-zà-ú][a-zà-ú\s]{2,30})$/i.exec(text.trim().replace(/[.!]+$/, ""));
  const reason = m?.[1]?.trim();
  if (!reason || /\b(reais|real|conto|contos)\b/i.test(reason)) return undefined;
  return reason;
}

function adjustmentFor(base: number, final: number, reason?: string): PriceAdjustment | null {
  const delta = final - base;
  if (delta === 0) return null;
  let label = delta < 0 ? "Desconto" : reason ? `Acréscimo (${reason})` : "Acréscimo";
  // o rótulo vai para o PDF do cliente: nunca termos internos
  if (findConfidentialTerms([label]).length) label = delta < 0 ? "Desconto" : "Acréscimo";
  return { baseCents: base, deltaCents: delta, label };
}

async function confirmOrWarn(c: Conversation, g: Group, final: number, label?: string): Promise<void> {
  const d = c.session.context.quoteDecision!;
  if (g.floor !== null && final < g.floor) {
    d.step = "below_floor";
    d.finalCents = final;
    if (label) d.label = label;
    c.say(`Assim fica ${formatBRL(final)}. 😬\n\nSó que abaixo de ${reais(g.floor)} você fica no prejuízo. Quer fechar assim mesmo?`, [
      [
        { text: "Sim, fechar assim", data: `qa:force:${d.quoteId}` },
        { text: "Mudar o valor", data: `qa:redo:${d.quoteId}` },
      ],
    ]);
    return;
  }
  return finalize(c, g, final, label);
}

async function askAgain(c: Conversation, g: Group): Promise<void> {
  const d = c.session.context.quoteDecision;
  const first = g.quotes[0]!;
  const job = g.quotes.length === 1 ? await getJob(c.ctx, first.jobId) : null;
  c.session.context.quoteDecision = { quoteId: first.id, ...(d?.quoteIds ? { quoteIds: d.quoteIds } : {}), step: "decide" };
  c.say(`Sem problema! A sugestão continua ${formatBRL(g.base)}${job ? ` pr${jobPhrase(job).startsWith("a ") ? "a" : "o"} ${jobPhrase(job).slice(2)}` : g.quotes.length > 1 ? ` pelos ${g.quotes.length} móveis` : ""}. Como você quer fazer?`, decisionButtons(first.id));
}

function valueLine(final: number, adj: PriceAdjustment | null): string {
  if (!adj) return formatBRL(final);
  if (adj.deltaCents < 0) return `${formatBRL(final)} (${formatBRL(adj.baseCents)} com ${formatBRL(-adj.deltaCents)} de desconto)`;
  return `${formatBRL(final)} (${formatBRL(adj.baseCents)} + ${formatBRL(adj.deltaCents)}${adj.label.startsWith("Acréscimo (") ? ` de ${adj.label.slice(11, -1)}` : ""})`;
}

/** Fecha com o valor do artesão e entrega o(s) PDF(s) na hora. */
async function finalize(c: Conversation, g: Group, final: number, reason?: string): Promise<void> {
  delete c.session.context.quoteDecision;
  c.session.flow = "idle";
  c.clearPending();
  const totalAdj = adjustmentFor(g.base, final, reason);
  // valor do artesão dividido entre as peças na proporção da sugestão de cada uma
  const shares = g.quotes.length === 1 ? [final] : allocateCents(final, g.quotes.map((q) => q.recommendedCents!));
  const closed: QuoteRecord[] = [];
  const docs: string[] = [];
  let preliminary = false;
  let failed = false;
  for (let i = 0; i < g.quotes.length; i++) {
    const q = g.quotes[i]!;
    const share = shares[i]!;
    const adj = adjustmentFor(q.recommendedCents!, share, reason);
    const res = await closeQuoteByArtisan(c.ctx, q.id, c.input.user.id, share, adj);
    closed.push(res.quote);
    preliminary ||= res.preliminary;
    try {
      const issued = await issueDocuments(c.ctx, res.quote.id, c.input.user.id, { preliminary: res.preliminary, artisanClosed: true });
      docs.push(issued.commercial.id);
    } catch (err) {
      failed = true;
      console.error(JSON.stringify({ level: "error", msg: "artisan_quote_pdf_failed", error: err instanceof Error ? err.message.slice(0, 200) : String(err) }));
    }
  }
  const firstJob = await getJob(c.ctx, g.quotes[0]!.jobId);
  const client = (firstJob?.facts.client_name?.value as string | undefined) ?? "o cliente";
  const pdfs = docs.length > 1 ? `os ${docs.length} PDFs (um por peça)` : "o PDF do orçamento";
  if (docs.length) {
    c.say(`Fechado! ✅\n\n💰 Valor final: ${valueLine(final, totalAdj)}\n\n📄 Te mandei ${pdfs} pra você encaminhar pr${/^(dona|a )/i.test(client) ? "a" : "o"} ${client}.${preliminary ? "\n\nComo alguma medida é aproximada, o PDF diz que é uma estimativa." : ""}${failed ? "\n\nUm dos PDFs não saiu agora; já avisei o administrador." : ""}`);
    for (const id of docs) await sendDocumentToArtisan(c.ctx, id, c.input.user.id, c.input.chatId);
    if (closed.length === 1) {
      c.say("Quando o cliente responder, me avisa aqui: 👇", [
        [
          { text: "👍 Cliente aceitou", data: `outcome:accept:${closed[0]!.id}` },
          { text: "👎 Cliente recusou", data: `outcome:reject:${closed[0]!.id}` },
        ],
      ]);
    } else {
      c.session.context.lastClosedQuotes = closed.map((q) => q.id);
      c.say("Quando o cliente responder, me avisa aqui: 👇", [
        [
          { text: "👍 Cliente aceitou", data: "outcome:acceptall:x" },
          { text: "👎 Cliente recusou", data: "outcome:rejectall:x" },
        ],
      ]);
    }
  } else {
    c.say(`Fechado! ✅ Valor final: ${valueLine(final, totalAdj)}.\n\nSó não consegui gerar o PDF agora. 😕 Já avisei o administrador; o valor ficou guardado.`);
  }
  const codes = (await Promise.all(g.quotes.map(async (q) => (await getJob(c.ctx, q.jobId))?.code ?? ""))).filter(Boolean).join(", ");
  await enqueueOutbox(
    c.ctx,
    "notify_admins",
    {
      text: `${c.input.user.displayName} fechou o orçamento ${codes} (${firstJob?.title ?? ""}${g.quotes.length > 1 ? ` e mais ${g.quotes.length - 1}` : ""}) por ${formatBRL(final)}. Sugerido: ${formatBRL(g.base)}${totalAdj ? ` · ${totalAdj.label} ${formatBRL(Math.abs(totalAdj.deltaCents))}` : ""}${g.floor !== null && final < g.floor ? ` · ABAIXO do mínimo (${formatBRL(g.floor)})` : ""}.`,
    },
    `artisan-close:${closed.map((q) => `${q.id}:${q.rowVersion}`).join(",").slice(0, 180)}`,
  );
}

/** Volta à pergunta do valor depois de uma interrupção. */
export async function reaskQuoteDecision(c: Conversation): Promise<void> {
  const g = await loadGroup(c);
  if (!g) {
    c.session.flow = "idle";
    return;
  }
  return askAgain(c, g);
}

const DECISION_SCHEMA = {
  type: "object",
  properties: {
    acao: { type: "string", enum: ["concordar", "desconto", "acrescimo", "valor_final", "nao_concorda", "outro"] },
    valor_reais: { type: ["number", "null"] },
    percentual: { type: ["number", "null"] },
    motivo: { type: ["string", "null"] },
  },
  required: ["acao"],
};

const DECISION_SYSTEM = systemPrompt(`O assistente mostrou ao Adriano o valor sugerido de um orçamento e perguntou se ele concorda. Classifique a resposta dele:
- "concordar": aceita o valor sugerido como está.
- "desconto": quer baixar (valor_reais = quanto tirar, ou percentual).
- "acrescimo": quer somar algo (valor_reais ou percentual; motivo curto, ex.: "frete").
- "valor_final": diz o valor que quer cobrar no total ("faz por 550", "dá pra fazer por uns 569?", "cobra 600") → valor_reais = esse total.
- "nao_concorda": não aceita mas não diz valor.
- "outro": outra coisa.
Números só os que ele disse. Uma pergunta como "dá pra fazer por 500?" é "valor_final" 500 (ele está propondo). Responda só JSON.`);

/** Decisão interpretada pelo Claude; valor só se dito na fala. */
async function interpretDecision(c: Conversation, g: Group, step: string, text: string): Promise<{ action: string; cents?: number; pct?: number; reason?: string } | null> {
  const user = JSON.stringify({ valor_sugerido: formatBRL(g.base), minimo_sem_prejuizo: g.floor !== null ? formatBRL(g.floor) : null, etapa: step, fala: text.slice(0, 600) });
  const raw = await interpretStructured(c.ctx, "decision:interpret", DECISION_SYSTEM, user, DECISION_SCHEMA, 200);
  if (!raw || typeof raw !== "object") return null;
  const r = raw as { acao?: unknown; valor_reais?: unknown; percentual?: unknown; motivo?: unknown };
  if (typeof r.acao !== "string") return null;
  const nums = (normalizeText(text).match(/\d+(?:[.,]\d+)?/g) ?? []).map((x) => Number(x.replace(/\.(?=\d{3}\b)/g, "").replace(",", ".")));
  const said = (v: unknown) => typeof v === "number" && v > 0 && nums.some((x) => Math.abs(x - v) < 0.01);
  const out: { action: string; cents?: number; pct?: number; reason?: string } = { action: r.acao };
  if (said(r.valor_reais)) out.cents = Math.round((r.valor_reais as number) * 100);
  if (said(r.percentual) && (r.percentual as number) < 100) out.pct = r.percentual as number;
  if (typeof r.motivo === "string" && r.motivo.trim().length >= 3 && r.motivo.length <= 30 && normalizeText(text).includes(normalizeText(r.motivo).split(" ")[0]!)) out.reason = r.motivo.trim();
  return out;
}
