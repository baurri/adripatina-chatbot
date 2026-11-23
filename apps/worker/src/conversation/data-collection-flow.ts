import {
  askPackageSizeText,
  confirmPriceText,
  confirmTotalText,
  cooldownUntil,
  discontinuedText,
  DONT_KNOW_TEXT,
  exampleFor,
  formatQuantity,
  interpretCollectionAnswer,
  LATER_TEXT,
  pricePerPackageCents,
  retryText,
  subjectOf as friendlySubject,
  thanksCoatsText,
  thanksHoursText,
  thanksPriceText,
  thanksStockText,
  thanksUsageText,
  type CollectionAnswer,
  type NluResult,
} from "@adripatina/conversations";
import { Dec } from "@adripatina/shared";
import type { Conversation } from "./engine.js";
import { nowIso } from "../context.js";
import { getMaterial } from "../repos/catalog.js";
import { getJob, jobPhrase } from "../repos/jobs.js";
import type { DataCollectionState } from "../repos/sessions.js";
import { applyCollectedCoats, applyCollectedHours, applyCollectedPackageSize, applyCollectedPrice, applyCollectedStock, applyCollectedUsage, type AnswerMeta } from "../services/proactive/apply.js";
import { addEvent, getRequest, OPEN_STATUSES, updateRequest, type RequestRow } from "../services/proactive/repo.js";
import { getProactiveSettings } from "../services/proactive/settings.js";

/**
 * Resposta do Adriano a uma pergunta proativa. A mensagem é interpretada
 * PRIMEIRO no contexto do dado pedido; só uma intenção forte de outro assunto
 * libera a conversa (a pergunta continua aguardando, sem insistir).
 */

const STRONG_INTENTS = new Set(["new_job", "expense", "payment", "query_status", "list_jobs", "progress", "quote", "calc"]);

function strongOtherSubject(nlu: NluResult): boolean {
  const e = nlu.entities;
  if (e.furnitureType || (e.clientNames?.length ?? 0) > 0 || (e.techniques?.length ?? 0) > 0) return true;
  return STRONG_INTENTS.has(nlu.intent) && nlu.confidence >= 0.8;
}

function state(c: Conversation): DataCollectionState | null {
  return c.session.context.dataCollection ?? null;
}

/** Interpretação síncrona (usada pelo roteador para decidir se é resposta plausível). */
export function interpretForState(st: DataCollectionState, text: string): CollectionAnswer {
  return interpretCollectionAnswer(st.kind, text, { ...(st.baseUnit ? { baseUnit: st.baseUnit } : {}), packageSize: st.packageSize ?? null, expecting: st.expecting });
}

export function isPlausibleCollectionAnswer(c: Conversation, text: string, nlu: NluResult): boolean {
  const st = state(c);
  if (!st) return false;
  if (st.expecting === "confirm" && ["yes", "no"].includes(nlu.intent)) return true;
  return interpretForState(st, text).kind !== "unparsed";
}

/** Devolve a conversa ao estado livre (a solicitação continua com seu próprio status). */
export function releaseCollection(c: Conversation, requestId?: string): void {
  const st = c.session.context.dataCollection;
  if (requestId && st && st.requestId !== requestId) return;
  delete c.session.context.dataCollection;
  if (c.session.context.pendingQuestion?.type === "data_request") c.clearPending();
  if (c.session.flow === "data_collection") c.session.flow = "idle";
}

function meta(c: Conversation, text: string): AnswerMeta {
  return { userId: c.input.user.id, messageId: c.input.inboundMessageId, sourceText: text };
}

async function snooze(c: Conversation, req: RequestRow, kind: "later" | "dont_know", text: string): Promise<void> {
  const settings = await getProactiveSettings(c.ctx);
  const until = cooldownUntil(settings, kind === "later" ? "snooze" : "dont_know", c.ctx.clock());
  await updateRequest(c.ctx, req.id, { status: "snoozed", next_allowed_at: until, answer_text: text.slice(0, 500), answer_message_id: c.input.inboundMessageId, close_reason: kind === "later" ? "pediu para perguntar depois" : "não sabia no momento" });
  await addEvent(c.ctx, { requestId: req.id, userId: req.user_id, correlationId: req.correlation_id, kind: kind === "later" ? "snoozed" : "dont_know", actor: c.input.user.id, messageId: c.input.inboundMessageId, data: { until } });
  releaseCollection(c);
  c.say(kind === "later" ? LATER_TEXT : DONT_KNOW_TEXT);
}

async function discontinue(c: Conversation, req: RequestRow, text: string): Promise<void> {
  const now = c.ctx.clock();
  if (req.entity_type === "material") {
    // não pergunta mais sobre o item (não desativa o material do catálogo: isso é decisão do admin)
    await c.ctx.db.run("UPDATE materials SET proactive_muted_until = ?, updated_at = ? WHERE id = ?", new Date(now.getTime() + 3650 * 86_400_000).toISOString(), nowIso(c.ctx), req.entity_id);
  }
  await updateRequest(c.ctx, req.id, { status: "cancelled", close_reason: "Adriano disse que não usa mais", answer_text: text.slice(0, 500), answer_message_id: c.input.inboundMessageId });
  await addEvent(c.ctx, { requestId: req.id, userId: req.user_id, correlationId: req.correlation_id, kind: "discontinued", actor: c.input.user.id, messageId: c.input.inboundMessageId });
  releaseCollection(c, req.id);
  c.say(discontinuedText(await subjectOf(c, req)));
}

async function subjectOf(c: Conversation, req: RequestRow): Promise<string> {
  if (req.entity_type === "material") {
    const m = await getMaterial(c.ctx, req.entity_id);
    if (m) return friendlySubject(m.name);
  }
  return req.entity_label.charAt(0).toLowerCase() + req.entity_label.slice(1);
}

/** Tamanho da embalagem já é confiável? (veio de uma fonte real, não do catálogo de demonstração) */
async function trustedPackageSize(c: Conversation, req: RequestRow): Promise<string | null> {
  const m = await getMaterial(c.ctx, req.entity_id);
  if (!m || m.origin === "demo_only") return null;
  const d = Dec.tryParse(m.packageSize);
  return d && d.gt(0) ? d.toString() : null;
}

/** Confirmação proporcional ao risco: valor fora do razoável ou muito diferente de um preço real recente. */
async function needsPriceConfirmation(c: Conversation, req: RequestRow, priceCents: number): Promise<boolean> {
  if (priceCents < 100 || priceCents > 200_000) return true;
  const m = await getMaterial(c.ctx, req.entity_id);
  if (!m || m.origin === "demo_only" || m.replacementPriceCents === null) return false;
  const ratio = priceCents / m.replacementPriceCents;
  return ratio > 2 || ratio < 0.5;
}

async function finishPrice(c: Conversation, req: RequestRow, st: DataCollectionState, text: string, v: { priceCents: number; packageSize: string; approximate: boolean; packages?: number; totalCents?: number; confirmed?: boolean }): Promise<void> {
  if (!v.confirmed && (await needsPriceConfirmation(c, req, v.priceCents))) {
    st.partial = { ...st.partial, priceCents: v.priceCents, packageSize: v.packageSize, approximate: v.approximate, confirmKind: "price", ...(v.packages ? { packages: v.packages } : {}), ...(v.totalCents ? { totalCents: v.totalCents } : {}) };
    st.expecting = "confirm";
    await updateRequest(c.ctx, req.id, { status: "waiting_confirmation", needs_confirmation: 1, partial_json: JSON.stringify(st.partial) });
    await addEvent(c.ctx, { requestId: req.id, userId: req.user_id, correlationId: req.correlation_id, kind: "confirmation_asked", actor: "bot", data: st.partial });
    const subject = await subjectOf(c, req);
    c.say(confirmPriceText({ subject, ...(st.baseUnit ? { baseUnit: st.baseUnit } : {}), sizeLabel: formatQuantity(v.packageSize, st.baseUnit), priceCents: v.priceCents, approximate: v.approximate }));
    return;
  }
  const res = await applyCollectedPrice(c.ctx, req, { priceCents: v.priceCents, packageSize: v.packageSize, approximate: v.approximate, packages: v.packages ?? null, totalCents: v.totalCents ?? null }, meta(c, text));
  if (res.kind === "invalid") {
    c.say(retryText(st.question ?? "Quanto está custando a embalagem?", exampleFor("material_price", st.baseUnit)));
    return;
  }
  releaseCollection(c, req.id);
  const subject = await subjectOf(c, req);
  if (req.need_kind === "material_price" && req.benefit_job_id) {
    const job = await getJob(c.ctx, req.benefit_job_id);
    if (job && job.status === "ORCAMENTO") {
      const label = `d${jobPhrase(job)}`;
      c.say(thanksPriceText({ subject, resumeLabel: label }));
      await addEvent(c.ctx, { requestId: req.id, userId: req.user_id, correlationId: req.correlation_id, kind: "quote_resumed", actor: "bot", data: { jobId: req.benefit_job_id } });
      // continuação de uma conversa iniciada pelo próprio orçamento: recalcula agora
      // (se faltar outro preço, o fluxo de orçamento pergunta em seguida, fora dos limites proativos)
      // o orçamento pausado deste serviço, suspenso na pilha, é substituído pelo recálculo
      const stack = c.session.context.goalStack;
      if (stack?.length) c.session.context.goalStack = stack.filter((g) => !(g.activeJobId === req.benefit_job_id || (g.context.pricing?.target.kind === "job" && g.context.pricing.target.jobId === req.benefit_job_id)));
      try {
        c.session.activeJobId = req.benefit_job_id;
        c.session.flow = "collecting";
        await c.calculateAndPresent(req.benefit_job_id);
      } catch (err) {
        console.error(JSON.stringify({ level: "error", msg: "proactive_quote_resume_failed", requestId: req.id, error: err instanceof Error ? err.message : "unknown" }));
        c.say("O preço já está guardado. Quando quiser, é só pedir para eu refazer as contas desse orçamento.");
      }
      return;
    }
  }
  c.say(thanksPriceText({ subject }));
}

export async function dataCollectionText(c: Conversation, text: string, nlu: NluResult): Promise<void> {
  const st = state(c);
  const req = st ? await getRequest(c.ctx, st.requestId) : null;
  if (!st || !req || !OPEN_STATUSES.includes(req.status)) {
    // pergunta já resolvida/cancelada: a mensagem segue o caminho normal
    releaseCollection(c);
    return c.onText(text, false);
  }
  const ans = interpretForState(st, text);
  await addEvent(c.ctx, { requestId: req.id, userId: req.user_id, correlationId: req.correlation_id, kind: ans.kind === "unparsed" ? "unparsed" : "answer", actor: c.input.user.id, messageId: c.input.inboundMessageId, data: { interpreted: ans, expecting: st.expecting } });

  switch (ans.kind) {
    case "discontinued":
      return discontinue(c, req, text);
    case "later":
      return snooze(c, req, "later", text);
    case "dont_know":
      return snooze(c, req, "dont_know", text);
    case "needs_hours":
      c.say('Consegue me dizer em horas, mais ou menos? Pode ser assim: "umas 12 horas".');
      return;
    case "unparsed": {
      if (strongOtherSubject(nlu)) {
        // outro assunto claro: atende o Adriano; a pergunta fica aguardando sem insistir
        await addEvent(c.ctx, { requestId: req.id, userId: req.user_id, correlationId: req.correlation_id, kind: "released", actor: "bot" });
        releaseCollection(c, req.id);
        return c.onText(text, false);
      }
      st.unparsed = (st.unparsed ?? 0) + 1;
      if (st.unparsed >= 2) return snooze(c, req, "later", text);
      c.say(retryText(st.expecting === "size" ? `Essa embalagem é de qual tamanho?` : st.expecting === "confirm" ? "Está certo assim?" : (st.question ?? "Pode me contar de novo?"), exampleFor(req.need_kind, st.baseUnit, st.expecting === "primary" ? undefined : st.expecting)));
      return;
    }
    case "yes":
    case "no": {
      const p = st.partial ?? {};
      if (p.confirmKind === "total" && p.amountCents && p.packages) {
        const perPackage = ans.kind === "no" && ans.perPackage;
        if (ans.kind === "no" && !perPackage) {
          st.partial = {};
          st.expecting = "primary";
          c.say(`Sem problema! Então me conta de novo: quanto custou cada ${st.baseUnit?.toLowerCase() === "l" ? "lata" : "embalagem"}?`);
          return;
        }
        const priceCents = perPackage ? p.amountCents : pricePerPackageCents(p.amountCents, p.packages);
        const totalCents = perPackage ? p.amountCents * p.packages : p.amountCents;
        st.partial = { ...p, priceCents, totalCents, confirmKind: undefined };
        const size = p.packageSize ?? (await trustedPackageSize(c, req));
        if (!size) {
          st.expecting = "size";
          await updateRequest(c.ctx, req.id, { status: "partially_answered", needs_confirmation: 0, partial_json: JSON.stringify(st.partial) });
          c.say(askPackageSizeText({ amountCents: priceCents, approximate: !!p.approximate, ...(st.baseUnit ? { baseUnit: st.baseUnit } : {}) }).replace("Perfeito, anotei", "Perfeito, então cada uma saiu por"));
          return;
        }
        return finishPrice(c, req, st, text, { priceCents, packageSize: size, approximate: !!p.approximate, packages: p.packages, totalCents, confirmed: true });
      }
      if (p.confirmKind === "price" && p.priceCents && p.packageSize) {
        if (ans.kind === "yes") return finishPrice(c, req, st, text, { priceCents: p.priceCents, packageSize: p.packageSize, approximate: !!p.approximate, ...(p.packages ? { packages: p.packages } : {}), ...(p.totalCents ? { totalCents: p.totalCents } : {}), confirmed: true });
        st.partial = {};
        st.expecting = "primary";
        c.say("Tudo bem! Então me diz de novo: quanto está custando a embalagem?");
        return;
      }
      c.say(retryText(st.question ?? "Pode me contar de novo?", exampleFor(req.need_kind, st.baseUnit)));
      return;
    }
    case "price": {
      const p = st.partial ?? {};
      const packageSize = ans.packageSize ?? p.packageSize;
      if (ans.packages && ans.packages > 1 && !ans.perPackage) {
        // "duas latas por 150": total ou cada? Confirma antes de salvar.
        st.partial = { amountCents: ans.amountCents, packages: ans.packages, approximate: ans.approximate, confirmKind: "total", ...(packageSize ? { packageSize } : {}) };
        st.expecting = "confirm";
        await updateRequest(c.ctx, req.id, { status: "waiting_confirmation", needs_confirmation: 1, partial_json: JSON.stringify(st.partial) });
        await addEvent(c.ctx, { requestId: req.id, userId: req.user_id, correlationId: req.correlation_id, kind: "confirmation_asked", actor: "bot", data: st.partial });
        c.say(confirmTotalText({ packages: ans.packages, amountCents: ans.amountCents, ...(st.baseUnit ? { baseUnit: st.baseUnit } : {}) }));
        return;
      }
      if (req.need_kind === "material_package_size") {
        c.say(retryText(st.question ?? "De que tamanho é a embalagem?", exampleFor(req.need_kind, st.baseUnit)));
        return;
      }
      const size = packageSize ?? (await trustedPackageSize(c, req));
      if (!size) {
        st.partial = { amountCents: ans.amountCents, priceCents: ans.amountCents, approximate: ans.approximate };
        st.expecting = "size";
        await updateRequest(c.ctx, req.id, { status: "partially_answered", partial_json: JSON.stringify(st.partial) });
        await addEvent(c.ctx, { requestId: req.id, userId: req.user_id, correlationId: req.correlation_id, kind: "partial", actor: "bot", data: { missing: "package_size", amountCents: ans.amountCents } });
        c.say(askPackageSizeText({ amountCents: ans.amountCents, approximate: ans.approximate, ...(st.baseUnit ? { baseUnit: st.baseUnit } : {}) }));
        return;
      }
      return finishPrice(c, req, st, text, { priceCents: ans.amountCents, packageSize: size, approximate: ans.approximate });
    }
    case "size": {
      if (req.need_kind === "material_package_size") {
        await applyCollectedPackageSize(c.ctx, req, { packageSize: ans.packageSize }, meta(c, text));
        releaseCollection(c, req.id);
        c.say(`Anotado: ${ans.sizeLabel}. Obrigado! 👍`);
        return;
      }
      const p = st.partial ?? {};
      const priceCents = p.priceCents ?? p.amountCents;
      if (!priceCents) {
        st.partial = { ...p, packageSize: ans.packageSize, sizeLabel: ans.sizeLabel };
        st.expecting = "primary";
        c.say(`Certo, ${ans.sizeLabel}. 👍\n\nE quanto está custando essa embalagem?`);
        return;
      }
      return finishPrice(c, req, st, text, { priceCents, packageSize: ans.packageSize, approximate: !!p.approximate, ...(p.packages ? { packages: p.packages } : {}), ...(p.totalCents ? { totalCents: p.totalCents } : {}) });
    }
    case "quantity": {
      const subject = await subjectOf(c, req);
      if (req.need_kind === "stock_level") {
        await applyCollectedStock(c.ctx, req, { quantity: ans.quantity, approximate: ans.approximate }, meta(c, text));
        releaseCollection(c, req.id);
        c.say(thanksStockText({ subject, quantity: ans.quantity, ...(st.baseUnit ? { baseUnit: st.baseUnit } : {}), approximate: ans.approximate }));
        return;
      }
      if (req.need_kind === "job_materials_used" && req.entity_key) {
        await applyCollectedUsage(c.ctx, req, { quantity: ans.quantity, label: ans.label, approximate: ans.approximate, materialKey: req.entity_key }, meta(c, text));
        releaseCollection(c, req.id);
        const m = await c.ctx.db.first<{ name: string }>("SELECT name FROM materials WHERE key = ?", req.entity_key);
        c.say(thanksUsageText({ quantityLabel: formatQuantity(ans.quantity, st.baseUnit), subject: friendlySubject(m?.name ?? "material") }));
        return;
      }
      c.say(retryText(st.question ?? "Pode me contar de novo?", exampleFor(req.need_kind, st.baseUnit)));
      return;
    }
    case "hours":
      await applyCollectedHours(c.ctx, req, { hours: ans.hours, approximate: ans.approximate }, meta(c, text));
      releaseCollection(c, req.id);
      c.say(thanksHoursText({ hours: ans.hours, approximate: ans.approximate }));
      return;
    case "coats": {
      await applyCollectedCoats(c.ctx, req, { coats: ans.coats, approximate: ans.approximate }, meta(c, text));
      releaseCollection(c, req.id);
      c.say(thanksCoatsText({ coats: ans.coats, subject: await subjectOf(c, req) }));
      return;
    }
  }
}

/** Botões "dc:<ação>:<id>" — idempotentes: solicitação já fechada não muda de novo. */
export async function onDataCollectionCallback(c: Conversation, action: string, requestId?: string): Promise<void> {
  const req = requestId ? await getRequest(c.ctx, requestId) : null;
  if (!req || req.user_id !== c.input.user.id || !OPEN_STATUSES.includes(req.status) || req.status === "snoozed") {
    if (requestId) releaseCollection(c, requestId);
    c.say("Essa pergunta já foi resolvida. 🙂");
    return;
  }
  switch (action) {
    case "later":
      await snooze(c, req, "later", "[botão] Pergunte depois");
      break;
    case "dontknow":
      await snooze(c, req, "dont_know", "[botão] Não sei");
      break;
    case "discontinued":
      await discontinue(c, req, "[botão] Não usamos mais");
      break;
    case "cancel":
      await updateRequest(c.ctx, req.id, { status: "cancelled", close_reason: "Adriano cancelou a pergunta" });
      await addEvent(c.ctx, { requestId: req.id, userId: req.user_id, correlationId: req.correlation_id, kind: "cancelled", actor: c.input.user.id });
      releaseCollection(c, req.id);
      c.say("Tudo bem, deixei essa pergunta de lado. 👍");
      break;
    default:
      c.say("Esse botão é de uma conversa antiga, então não fiz nada com ele.");
  }
}
