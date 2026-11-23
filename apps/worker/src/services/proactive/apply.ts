import { Dec, newId } from "@adripatina/shared";
import type { Ctx } from "../../context.js";
import { nowIso } from "../../context.js";
import { auditStmt } from "../../repos/audit.js";
import { getMaterial } from "../../repos/catalog.js";
import { recordTechniqueTimeObservation } from "../learning.js";
import { applyConfirmedPrice, type ApplyResult } from "../material-pricing.js";
import { addEvent, updateRequest, type RequestRow } from "./repo.js";

/**
 * Aplicação dos dados obtidos na coleta proativa. Cada função valida de novo,
 * grava histórico/auditoria e marca valores aproximados como aproximados.
 * Nenhum parâmetro técnico é calibrado com uma única observação.
 */

export interface AnswerMeta {
  userId: string;
  messageId: string | null;
  sourceText: string;
}

async function closeResolved(ctx: Ctx, req: RequestRow, meta: AnswerMeta, result: unknown, confidence: string): Promise<void> {
  const now = nowIso(ctx);
  await updateRequest(ctx, req.id, {
    status: "resolved",
    answer_text: meta.sourceText.slice(0, 500),
    answer_message_id: meta.messageId,
    interpretation_confidence: confidence,
    result_json: JSON.stringify(result),
    resolved_at: now,
    needs_confirmation: 0,
  });
  await addEvent(ctx, { requestId: req.id, userId: req.user_id, correlationId: req.correlation_id, kind: "applied", actor: meta.userId, messageId: meta.messageId, data: result });
}

export async function applyCollectedPrice(
  ctx: Ctx,
  req: RequestRow,
  v: { priceCents: number; packageSize: string; approximate: boolean; packages?: number | null; totalCents?: number | null },
  meta: AnswerMeta,
): Promise<ApplyResult> {
  const material = await getMaterial(ctx, req.entity_id);
  if (!material) return { kind: "invalid", reason: "material não encontrado" };
  const res = await applyConfirmedPrice(ctx, {
    materialKey: material.key,
    priceCents: v.priceCents,
    packageSize: v.packageSize,
    packages: v.packages ?? null,
    totalCents: v.totalCents ?? null,
    confidence: v.approximate ? "media" : "alta",
    isEstimate: v.approximate,
    origin: "telegram_proactive",
    userId: meta.userId,
    messageId: meta.messageId,
    jobId: req.benefit_job_id,
    quoteId: req.benefit_quote_id,
    sourceText: meta.sourceText,
    idempotencyKey: `dcr:${req.id}`,
    observationKind: "MATERIAL_PRICE_QUOTE",
    collectionRequestId: req.id,
  });
  if (res.kind === "applied" || res.kind === "duplicate") {
    await closeResolved(
      ctx,
      req,
      meta,
      { field: "replacement_price_cents", previousPriceCents: res.kind === "applied" ? res.previousPriceCents : null, newPriceCents: v.priceCents, packageSize: v.packageSize, approximate: v.approximate, packages: v.packages ?? null, totalCents: v.totalCents ?? null },
      v.approximate ? "media" : "alta",
    );
  }
  return res;
}

/** Só o tamanho da embalagem (preço real já conhecido). */
export async function applyCollectedPackageSize(ctx: Ctx, req: RequestRow, v: { packageSize: string }, meta: AnswerMeta): Promise<ApplyResult> {
  const material = await getMaterial(ctx, req.entity_id);
  if (!material || material.replacementPriceCents === null) return { kind: "invalid", reason: "material sem preço" };
  const res = await applyConfirmedPrice(ctx, {
    materialKey: material.key,
    priceCents: material.replacementPriceCents,
    packageSize: v.packageSize,
    confidence: "alta",
    isEstimate: false,
    origin: "telegram_proactive",
    userId: meta.userId,
    messageId: meta.messageId,
    jobId: null,
    quoteId: null,
    sourceText: meta.sourceText,
    idempotencyKey: `dcr:${req.id}`,
    observationKind: "MATERIAL_PRICE_QUOTE",
    collectionRequestId: req.id,
  });
  if (res.kind === "applied" || res.kind === "duplicate") await closeResolved(ctx, req, meta, { field: "package_size", previous: material.packageSize, packageSize: v.packageSize }, "alta");
  return res;
}

/** Estoque informado: ajuste (AJUSTE) até a quantidade dita, marcado como estimado quando aproximado. */
export async function applyCollectedStock(ctx: Ctx, req: RequestRow, v: { quantity: string; approximate: boolean }, meta: AnswerMeta): Promise<{ previous: string; delta: string }> {
  const q = Dec.tryParse(v.quantity);
  if (!q || q.lt(0)) throw new RangeError("quantidade inválida");
  const moves = await ctx.db.all<{ kind: string; quantity: string }>("SELECT kind, quantity FROM stock_movements WHERE material_id = ?", req.entity_id);
  let raw = Dec.ZERO;
  for (const m of moves) raw = m.kind === "CONSUMO" ? raw.sub(m.quantity) : raw.add(m.quantity);
  const delta = q.sub(raw);
  const now = nowIso(ctx);
  const stmts: D1PreparedStatement[] = [];
  if (!delta.eq(0)) {
    stmts.push(
      ctx.db.stmt(
        "INSERT INTO stock_movements (id, material_id, kind, quantity, historical_unit_cost_cents, purchase_id, job_id, condition, note, created_by, created_at) VALUES (?, ?, 'AJUSTE', ?, NULL, NULL, NULL, ?, ?, ?, ?)",
        newId(),
        req.entity_id,
        delta.toString(),
        v.approximate ? "estimado" : "contado",
        `Contagem informada pelo Adriano na conversa (${v.approximate ? "aproximada" : "contada"})`,
        meta.userId,
        now,
      ),
    );
  }
  stmts.push(
    ctx.db.stmt("UPDATE materials SET stock_checked_at = ?, stock_is_estimate = ?, updated_at = ? WHERE id = ?", now, v.approximate ? 1 : 0, now, req.entity_id),
    ctx.db.stmt(
      "INSERT INTO learning_observations (id, user_id, job_id, message_id, kind, entity_type, entity_key, data_json, confidence, status, applied_at, created_at, origin, source_text, collection_request_id) VALUES (?, ?, NULL, ?, 'STOCK_COUNT', 'material', ?, ?, ?, 'APLICADO', ?, ?, 'telegram_proactive', ?, ?)",
      newId(),
      meta.userId,
      meta.messageId,
      req.entity_key ?? req.entity_id,
      JSON.stringify({ quantity: q.toString(), previousComputed: raw.toString(), delta: delta.toString(), approximate: v.approximate }),
      v.approximate ? 0.6 : 1,
      now,
      now,
      meta.sourceText.slice(0, 500),
      req.id,
    ),
    auditStmt(ctx, meta.userId, "material.stock_count", "material", req.entity_id, { quantity: raw.toString() }, { quantity: q.toString(), approximate: v.approximate, requestId: req.id }),
  );
  await ctx.db.batch(stmts);
  await closeResolved(ctx, req, meta, { field: "stock_quantity", previous: raw.toString(), quantity: q.toString(), delta: delta.toString(), approximate: v.approximate }, v.approximate ? "media" : "alta");
  return { previous: raw.toString(), delta: delta.toString() };
}

function techniqueKeysOfJob(factsJson: string | undefined): string[] {
  try {
    const f = JSON.parse(factsJson ?? "{}") as { techniques?: { value?: unknown } };
    return Array.isArray(f.techniques?.value) ? (f.techniques!.value as string[]) : [];
  } catch {
    return [];
  }
}

/** Horas reais de um trabalho concluído: lançamento de tempo + observação (não calibra sozinho). */
export async function applyCollectedHours(ctx: Ctx, req: RequestRow, v: { hours: string; approximate: boolean }, meta: AnswerMeta): Promise<void> {
  const h = Dec.tryParse(v.hours);
  if (!h || !h.gt(0) || h.gt(500)) throw new RangeError("horas inválidas");
  const job = await ctx.db.first<{ facts_json: string }>("SELECT facts_json FROM jobs WHERE id = ?", req.entity_id);
  const techniques = techniqueKeysOfJob(job?.facts_json);
  await recordTechniqueTimeObservation(ctx, { userId: meta.userId, jobId: req.entity_id, messageId: meta.messageId ?? "", techniqueKeys: techniques, hours: h.toString() });
  const now = nowIso(ctx);
  await ctx.db.batch([
    ctx.db.stmt(
      "INSERT INTO learning_observations (id, user_id, job_id, message_id, kind, entity_type, entity_key, data_json, confidence, status, created_at, origin, source_text, collection_request_id) VALUES (?, ?, ?, ?, 'JOB_ACTUAL_HOURS', 'job', ?, ?, ?, 'COLETADO', ?, 'telegram_proactive', ?, ?)",
      newId(),
      meta.userId,
      req.entity_id,
      meta.messageId,
      req.entity_id,
      JSON.stringify({ hours: h.toString(), approximate: v.approximate, techniques }),
      v.approximate ? 0.6 : 1,
      now,
      meta.sourceText.slice(0, 500),
      req.id,
    ),
    auditStmt(ctx, meta.userId, "job.actual_hours", "job", req.entity_id, null, { hours: h.toString(), approximate: v.approximate, requestId: req.id }),
  ]);
  await closeResolved(ctx, req, meta, { field: "actual_hours", hours: h.toString(), approximate: v.approximate }, v.approximate ? "media" : "alta");
}

/** Demãos: só observação (status COLETADO). A técnica continua não calibrada até revisão/estatística. */
export async function applyCollectedCoats(ctx: Ctx, req: RequestRow, v: { coats: number; approximate: boolean }, meta: AnswerMeta): Promise<void> {
  const now = nowIso(ctx);
  await ctx.db.run(
    "INSERT INTO learning_observations (id, user_id, job_id, message_id, kind, entity_type, entity_key, data_json, confidence, status, created_at, origin, source_text, collection_request_id) VALUES (?, ?, NULL, ?, 'TECHNIQUE_OBSERVATION', 'technique', ?, ?, ?, 'COLETADO', ?, 'telegram_proactive', ?, ?)",
    newId(),
    meta.userId,
    meta.messageId,
    req.entity_key ?? req.entity_id,
    JSON.stringify({ coats: v.coats, approximate: v.approximate, singleObservation: true }),
    v.approximate ? 0.6 : 1,
    now,
    meta.sourceText.slice(0, 500),
    req.id,
  );
  await closeResolved(ctx, req, meta, { field: "coats", coats: v.coats, approximate: v.approximate, calibrated: false }, v.approximate ? "media" : "alta");
}

/** Consumo de material num trabalho concluído: observação de uso (não mexe no estoque nem no custo). */
export async function applyCollectedUsage(ctx: Ctx, req: RequestRow, v: { quantity: string; label: string; approximate: boolean; materialKey: string }, meta: AnswerMeta): Promise<void> {
  const now = nowIso(ctx);
  await ctx.db.run(
    "INSERT INTO learning_observations (id, user_id, job_id, message_id, kind, entity_type, entity_key, data_json, confidence, status, created_at, origin, source_text, collection_request_id) VALUES (?, ?, ?, ?, 'MATERIAL_USAGE', 'material', ?, ?, ?, 'COLETADO', ?, 'telegram_proactive', ?, ?)",
    newId(),
    meta.userId,
    req.entity_id,
    meta.messageId,
    v.materialKey,
    JSON.stringify({ quantity: v.quantity, label: v.label, approximate: v.approximate }),
    v.approximate ? 0.6 : 1,
    now,
    meta.sourceText.slice(0, 500),
    req.id,
  );
  await closeResolved(ctx, req, meta, { field: "material_quantity_used", materialKey: v.materialKey, quantity: v.quantity, approximate: v.approximate }, v.approximate ? "media" : "alta");
}
