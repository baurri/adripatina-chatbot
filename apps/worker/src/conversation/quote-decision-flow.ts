import type { Button, NluResult } from "@adripatina/conversations";
import { findConfidentialTerms } from "@adripatina/pdf";
import { formatBRL, normalizeText, parseBareAmountCents } from "@adripatina/shared";
import type { Conversation } from "./engine.js";
import { getJob, jobPhrase, type Job } from "../repos/jobs.js";
import { closeQuoteByArtisan, getQuote, issueDocuments, sendDocumentToArtisan, type PriceAdjustment, type QuoteRecord } from "../services/quotes.js";
import { enqueueOutbox } from "../services/outbox.js";

/**
 * D-070 — o Adriano sempre fez os próprios orçamentos: o sistema SUGERE um valor e ele decide.
 * Depois do cálculo: "Você concorda? Quer dar desconto? Acrescentar?" → o PDF sai na hora com o
 * valor dele (e o desconto/acréscimo destacado). Nada de "confiança", "pendências" ou
 * "parâmetros não calibrados" para o artesão: isso fica no painel do administrador.
 */

const reais = (cents: number) => formatBRL(Math.ceil(cents / 100) * 100);

function decisionButtons(quoteId: string): Button[][] {
  return [
    [{ text: "👍 Concordo", data: `qa:ok:${quoteId}` }],
    [
      { text: "➖ Dar desconto", data: `qa:disc:${quoteId}` },
      { text: "➕ Acrescentar", data: `qa:add:${quoteId}` },
    ],
  ];
}

/** Mensagem curta e simples com o valor sugerido. */
export function artisanQuoteMessage(job: Job, q: QuoteRecord): string {
  const r = q.result;
  const lines = [`🧮 Prontinho, fiz as contas d${jobPhrase(job)}!`, "", `💰 Minha sugestão é cobrar ${formatBRL(r.recommendedCents!)}.`, ""];
  if (r.floorCents !== null) lines.push(`⚠️ Menos que ${reais(r.floorCents)} você começa a ter prejuízo.`);
  if (r.materials.purchaseCashOutlayCents > 0) lines.push(`🛒 Vai precisar comprar uns ${reais(r.materials.purchaseCashOutlayCents)} de material.`);
  const hours = Math.round(Number(r.labor.totalHours));
  if (hours > 0) lines.push(`⏱️ Dá umas ${hours} ${hours === 1 ? "hora" : "horas"} de trabalho.`);
  const gaps = r.gaps ?? [];
  if (gaps.some((g) => g.code === "TRANSPORT_COST_MISSING")) lines.push("🚚 O frete não está na conta. Se for cobrar, é só acrescentar.");
  if (gaps.some((g) => g.code === "REPAIRS_HOURS_MISSING")) lines.push("🛠️ O conserto não está na conta. Se for cobrar, é só acrescentar.");
  if (gaps.some((g) => g.code.startsWith("DIMENSIONS") || g.code === "BED_NOMINAL_SIZE") || r.warnings.some((w) => w.code === "AREA_RANGE_MAX_USED")) {
    lines.push("📏 Fiz com a medida aproximada, então pode variar um pouco.");
  }
  lines.push("", "E aí, você concorda com esse valor? 🤝");
  return lines.join("\n");
}

export async function presentQuoteDecision(c: Conversation, job: Job, q: QuoteRecord): Promise<void> {
  c.session.flow = "quote_decision";
  c.session.context.quoteDecision = { quoteId: q.id, step: "decide" };
  c.clearPending();
  c.say(artisanQuoteMessage(job, q), decisionButtons(q.id));
}

/** Botões `qa:*`. */
export async function onQuoteDecisionCallback(c: Conversation, action: string, quoteId?: string): Promise<void> {
  const d = c.session.context.quoteDecision;
  if (!quoteId || !d || d.quoteId !== quoteId) {
    c.say("Esse orçamento já foi fechado. 🙂 Se quiser mudar o valor, é só pedir pra calcular de novo.");
    return;
  }
  const q = await getQuote(c.ctx, quoteId);
  if (!q || q.recommendedCents === null) return c.greet();
  switch (action) {
    case "ok":
      return finalize(c, q, q.recommendedCents, null);
    case "disc":
      d.step = "discount";
      c.say("Beleza! Quanto de desconto? 🙂\n\nPode falar em reais, tipo \"50 reais\", ou em porcentagem, tipo \"10%\".");
      return;
    case "add":
      d.step = "add";
      c.say("Certo! Quanto você quer acrescentar? ➕\n\nSe quiser, fala o motivo junto, tipo \"100 reais do frete\".");
      return;
    case "force":
      if (d.step !== "below_floor" || d.finalCents === undefined) return askAgain(c, q);
      return finalize(c, q, d.finalCents, adjustmentFor(q, d.finalCents, d.label));
    case "redo":
      d.step = "decide";
      return askAgain(c, q);
  }
}

/** Texto durante a decisão: "concordo", "dá 50 de desconto", "cobra 650", "10%"... */
export async function quoteDecisionText(c: Conversation, text: string, nlu: NluResult): Promise<void> {
  const d = c.session.context.quoteDecision;
  const q = d ? await getQuote(c.ctx, d.quoteId) : null;
  if (!d || !q || q.recommendedCents === null) {
    c.session.flow = "idle";
    return c.greet();
  }
  const base = q.recommendedCents;
  const n = normalizeText(text);
  const percent = /(\d+(?:[.,]\d+)?)\s*(?:%|por ?cento)/.exec(n);
  const amount = percent ? null : parseBareAmountCents(text);
  const wantsDiscount = d.step === "discount" || /\b(desconto|descont\w*|abaix\w*|diminu\w*|tira|tirar|menos)\b/.test(n);
  const wantsAdd = d.step === "add" || /\b(acrescent\w*|soma|somar|aumenta\w*|adiciona\w*|a mais)\b|\bmais (uns |um |r\$ ?)?\d/.test(n);

  if (d.step === "below_floor") {
    if (nlu.intent === "yes") return onQuoteDecisionCallback(c, "force", q.id);
    if (nlu.intent === "no" && amount === null && !percent) return onQuoteDecisionCallback(c, "redo", q.id);
  }
  if (!percent && amount === null) {
    if (nlu.intent === "yes" || /\b(concordo|pode ser|ta bom|ta otimo|fechado|fechou|beleza|esse mesmo|isso mesmo|perfeito|combinado|bora)\b/.test(n)) return finalize(c, q, base, null);
    if (/\bdesconto\b/.test(n)) return onQuoteDecisionCallback(c, "disc", q.id);
    if (/\b(acrescent\w*|somar|aumentar)\b/.test(n)) return onQuoteDecisionCallback(c, "add", q.id);
    c.say(
      d.step === "discount" ? "Não peguei o valor do desconto. Pode dizer, tipo \"50 reais\" ou \"10%\"." : d.step === "add" ? "Não peguei o valor. Pode dizer, tipo \"100 reais\" ou \"100 reais do frete\"." : "É só tocar num botão, ou me dizer do seu jeito, tipo \"pode ser esse\", \"dá 50 de desconto\" ou \"vou cobrar 650\". 🙂",
      d.step === "decide" ? decisionButtons(q.id) : undefined,
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
  return confirmOrWarn(c, q, final, label);
}

function addReason(text: string): string | undefined {
  const m = /\b(?:de|do|da|pelo|pela|pra|para|por causa d[oa])\s+([a-zà-ú][a-zà-ú\s]{2,30})$/i.exec(text.trim().replace(/[.!]+$/, ""));
  const reason = m?.[1]?.trim();
  if (!reason || /\b(reais|real|conto|contos)\b/i.test(reason)) return undefined;
  return reason;
}

function adjustmentFor(q: QuoteRecord, final: number, reason?: string): PriceAdjustment | null {
  const base = q.recommendedCents!;
  const delta = final - base;
  if (delta === 0) return null;
  let label = delta < 0 ? "Desconto" : reason ? `Acréscimo (${reason})` : "Acréscimo";
  // o rótulo vai para o PDF do cliente: nunca termos internos
  if (findConfidentialTerms([label]).length) label = delta < 0 ? "Desconto" : "Acréscimo";
  return { baseCents: base, deltaCents: delta, label };
}

async function confirmOrWarn(c: Conversation, q: QuoteRecord, final: number, label?: string): Promise<void> {
  const d = c.session.context.quoteDecision!;
  if (q.floorCents !== null && final < q.floorCents) {
    d.step = "below_floor";
    d.finalCents = final;
    if (label) d.label = label;
    c.say(`Assim fica ${formatBRL(final)}. 😬\n\nSó que abaixo de ${reais(q.floorCents)} você fica no prejuízo. Quer fechar assim mesmo?`, [
      [
        { text: "Sim, fechar assim", data: `qa:force:${q.id}` },
        { text: "Mudar o valor", data: `qa:redo:${q.id}` },
      ],
    ]);
    return;
  }
  return finalize(c, q, final, adjustmentFor(q, final, label));
}

async function askAgain(c: Conversation, q: QuoteRecord): Promise<void> {
  const job = await getJob(c.ctx, q.jobId);
  c.session.context.quoteDecision = { quoteId: q.id, step: "decide" };
  c.say(`Sem problema! A sugestão continua ${formatBRL(q.recommendedCents!)}${job ? ` pr${jobPhrase(job).startsWith("a ") ? "a" : "o"} ${jobPhrase(job).slice(2)}` : ""}. Como você quer fazer?`, decisionButtons(q.id));
}

/** Fecha com o valor do artesão e entrega o PDF na hora. */
async function finalize(c: Conversation, q: QuoteRecord, final: number, adjustment: PriceAdjustment | null): Promise<void> {
  const job = await getJob(c.ctx, q.jobId);
  delete c.session.context.quoteDecision;
  c.session.flow = "idle";
  c.clearPending();
  const res = await closeQuoteByArtisan(c.ctx, q.id, c.input.user.id, final, adjustment);
  const valueLine = !adjustment
    ? formatBRL(final)
    : adjustment.deltaCents < 0
      ? `${formatBRL(final)} (${formatBRL(adjustment.baseCents)} com ${formatBRL(-adjustment.deltaCents)} de desconto)`
      : `${formatBRL(final)} (${formatBRL(adjustment.baseCents)} + ${formatBRL(adjustment.deltaCents)}${adjustment.label.startsWith("Acréscimo (") ? ` de ${adjustment.label.slice(11, -1)}` : ""})`;
  const client = (job?.facts.client_name?.value as string | undefined) ?? "o cliente";
  try {
    const docs = await issueDocuments(c.ctx, res.quote.id, c.input.user.id, { preliminary: res.preliminary, artisanClosed: true });
    c.say(`Fechado! ✅\n\n💰 Valor final: ${valueLine}\n\n📄 Te mandei o PDF do orçamento pra você encaminhar pr${/^(dona|a )/i.test(client) ? "a" : "o"} ${client}.${res.preliminary ? "\n\nComo a medida é aproximada, o PDF diz que é uma estimativa." : ""}`);
    await sendDocumentToArtisan(c.ctx, docs.commercial.id, c.input.user.id, c.input.chatId);
    c.say("Quando o cliente responder, me avisa aqui: 👇", [
      [
        { text: "👍 Cliente aceitou", data: `outcome:accept:${res.quote.id}` },
        { text: "👎 Cliente recusou", data: `outcome:reject:${res.quote.id}` },
      ],
    ]);
  } catch (err) {
    console.error(JSON.stringify({ level: "error", msg: "artisan_quote_pdf_failed", error: err instanceof Error ? err.message.slice(0, 200) : String(err) }));
    c.say(`Fechado! ✅ Valor final: ${valueLine}.\n\nSó não consegui gerar o PDF agora. 😕 Já avisei o administrador; o valor ficou guardado.`);
  }
  await enqueueOutbox(
    c.ctx,
    "notify_admins",
    {
      text: `${c.input.user.displayName} fechou o orçamento ${job?.code ?? ""} (${job?.title ?? ""}) por ${formatBRL(final)}. Sugerido: ${formatBRL(q.recommendedCents!)}${adjustment ? ` · ${adjustment.label} ${formatBRL(Math.abs(adjustment.deltaCents))}` : ""}${q.floorCents !== null && final < q.floorCents ? ` · ABAIXO do mínimo (${formatBRL(q.floorCents)})` : ""}.`,
    },
    `artisan-close:${res.quote.id}:${res.quote.rowVersion}`,
  );
}

/** Volta à pergunta do valor depois de uma interrupção. */
export async function reaskQuoteDecision(c: Conversation): Promise<void> {
  const d = c.session.context.quoteDecision;
  const q = d ? await getQuote(c.ctx, d.quoteId) : null;
  if (!q || q.recommendedCents === null) {
    c.session.flow = "idle";
    return;
  }
  return askAgain(c, q);
}
