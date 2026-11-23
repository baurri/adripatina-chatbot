import { Dec, newId } from "@adripatina/shared";
import { pricePerPackageCents, type PriceConfidence } from "@adripatina/conversations";
import type { Ctx } from "../context.js";
import { nowIso } from "../context.js";
import { auditStmt } from "../repos/audit.js";
import { getMaterialByKey } from "../repos/catalog.js";
import { resolveMatchingRequests } from "./proactive/repo.js";

/**
 * Serviço único para gravar um preço de reposição CONFIRMADO pelo artesão,
 * usado pela compra registrada e pela coleta de preços durante o orçamento.
 *
 * Regras:
 * - só é chamado após confirmação explícita (botão ou "sim");
 * - idempotente pela chave (duplo clique / reentrega não duplica histórico);
 * - histórico anterior nunca é apagado; guarda valor e embalagem anteriores;
 * - NÃO marca o material como calibrado (preço ≠ rendimento/perda calibrados);
 * - valores em centavos inteiros e tamanhos em decimal exato.
 */

export type PriceOrigin = "telegram_quote_confirmed" | "telegram_confirmed" | "telegram_proactive";

export interface ConfirmedPriceInput {
  materialKey: string;
  /** preço de UMA embalagem, em centavos */
  priceCents: number;
  /** tamanho de uma embalagem na unidade base (decimal em string) */
  packageSize: string;
  packages?: number | null;
  totalCents?: number | null;
  confidence: PriceConfidence;
  origin: PriceOrigin;
  userId: string;
  messageId: string | null;
  jobId: string | null;
  quoteId: string | null;
  sourceText: string | null;
  idempotencyKey: string;
  /** tipo de observação de aprendizado registrada junto */
  observationKind: "MATERIAL_PRICE_QUOTE" | "MATERIAL_PURCHASE";
  /** valor aproximado ("uns 85") — padrão: confiança diferente de "alta" */
  isEstimate?: boolean;
  /** solicitação de coleta proativa que originou o valor */
  collectionRequestId?: string | null;
}

export type ApplyResult = { kind: "applied"; previousPriceCents: number | null } | { kind: "duplicate" } | { kind: "invalid"; reason: string };

export function validateConfirmedPrice(priceCents: number, packageSize: string): string | null {
  if (!Number.isSafeInteger(priceCents) || priceCents <= 0) return "preço precisa ser maior que zero";
  const size = Dec.tryParse(packageSize);
  if (!size || !size.gt(0)) return "tamanho da embalagem inválido";
  if (size.gt(1000)) return "tamanho da embalagem fora do razoável";
  return null;
}

export async function applyConfirmedPrice(ctx: Ctx, input: ConfirmedPriceInput): Promise<ApplyResult> {
  const invalid = validateConfirmedPrice(input.priceCents, input.packageSize);
  if (invalid) return { kind: "invalid", reason: invalid };
  const already = await ctx.db.first("SELECT id FROM material_price_history WHERE idempotency_key = ?", input.idempotencyKey);
  if (already) return { kind: "duplicate" };
  const material = await getMaterialByKey(ctx, input.materialKey);
  if (!material) return { kind: "invalid", reason: "material não cadastrado" };
  const now = nowIso(ctx);
  const observationId = newId();
  const size = Dec.from(input.packageSize).toString();
  const isEstimate = input.isEstimate ?? input.confidence !== "alta";
  const data = {
    origin: input.origin,
    previousPriceCents: material.replacementPriceCents,
    newPriceCents: input.priceCents,
    previousPackageSize: material.packageSize,
    newPackageSize: size,
    packages: input.packages ?? null,
    totalCents: input.totalCents ?? null,
    replacementPriceCents: input.priceCents,
    packageSize: size,
    unit: material.unit,
    confidence: input.confidence,
    isEstimate,
    collectionRequestId: input.collectionRequestId ?? null,
  };
  try {
    await ctx.db.batch([
      ctx.db.stmt(
        // calibrated NÃO é alterado de propósito
        "UPDATE materials SET package_size = ?, replacement_price_cents = ?, price_updated_at = ?, origin = ?, price_is_estimate = ?, updated_at = ? WHERE id = ?",
        size,
        input.priceCents,
        now,
        input.origin,
        isEstimate ? 1 : 0,
        now,
        material.id,
      ),
      ctx.db.stmt(
        `INSERT INTO material_price_history (id, material_id, price_cents, source, recorded_by, recorded_at, previous_price_cents, package_size, previous_package_size, confidence, message_id, job_id, quote_id, source_text, idempotency_key, is_estimate, collection_request_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        newId(),
        material.id,
        input.priceCents,
        input.origin,
        input.userId,
        now,
        material.replacementPriceCents,
        size,
        material.packageSize,
        input.confidence,
        input.messageId,
        input.jobId,
        input.quoteId,
        input.sourceText?.slice(0, 500) ?? null,
        input.idempotencyKey,
        isEstimate ? 1 : 0,
        input.collectionRequestId ?? null,
      ),
      ctx.db.stmt(
        `INSERT INTO learning_observations (id, user_id, job_id, message_id, kind, entity_type, entity_key, data_json, confidence, status, applied_at, created_at, origin, quote_id, source_text, collection_request_id)
         VALUES (?, ?, ?, ?, ?, 'material', ?, ?, ?, 'APLICADO', ?, ?, ?, ?, ?, ?)`,
        observationId,
        input.userId,
        input.jobId,
        input.messageId,
        input.observationKind,
        input.materialKey,
        JSON.stringify(data),
        input.confidence === "alta" ? 1 : input.confidence === "media" ? 0.6 : 0.3,
        now,
        now,
        input.origin,
        input.quoteId,
        input.sourceText?.slice(0, 500) ?? null,
        input.collectionRequestId ?? null,
      ),
      auditStmt(
        ctx,
        input.userId,
        input.origin === "telegram_quote_confirmed" ? "material.price_from_quote" : input.origin === "telegram_proactive" ? "material.price_from_proactive" : "material.learn_purchase",
        "material",
        material.id,
        { priceCents: material.replacementPriceCents, packageSize: material.packageSize },
        { priceCents: input.priceCents, packageSize: size, observationId, confidence: input.confidence, jobId: input.jobId, quoteId: input.quoteId },
      ),
    ]);
  } catch (err) {
    // corrida entre dois cliques: o índice único de idempotência garante uma só gravação
    if (/UNIQUE/i.test(String(err))) return { kind: "duplicate" };
    throw err;
  }
  // o dado chegou: perguntas proativas abertas sobre o mesmo preço não precisam mais ser feitas
  await resolveMatchingRequests(
    ctx,
    { kinds: ["material_price", "material_package_size"], entityType: "material", entityId: material.id },
    { actor: input.userId, messageId: input.messageId, reason: `preço informado (${input.origin})`, ...(input.collectionRequestId ? { exceptId: input.collectionRequestId } : {}) },
  ).catch(() => 0);
  return { kind: "applied", previousPriceCents: material.replacementPriceCents };
}

/** Compra registrada → preço de reposição (total ÷ embalagens, centavos exatos). */
export async function learnPriceFromPurchase(
  ctx: Ctx,
  input: { userId: string; jobId: string | null; messageId: string; materialKey: string; totalCents: number; packages: number; packageSize: string; purchaseKey: string },
): Promise<ApplyResult> {
  if (input.packages < 1 || input.totalCents < 1) return { kind: "invalid", reason: "compra sem quantidade ou valor" };
  return applyConfirmedPrice(ctx, {
    materialKey: input.materialKey,
    priceCents: pricePerPackageCents(input.totalCents, input.packages),
    packageSize: input.packageSize,
    packages: input.packages,
    totalCents: input.totalCents,
    confidence: "alta",
    origin: "telegram_confirmed",
    userId: input.userId,
    messageId: input.messageId,
    jobId: input.jobId,
    quoteId: null,
    sourceText: null,
    idempotencyKey: `purchase:${input.purchaseKey}`,
    observationKind: "MATERIAL_PURCHASE",
  });
}

/** Materiais sem preço exigidos pelos orçamentos (somente os usados, sem repetir). */
export function missingPriceKeys(results: { blockers: { code: string; ref?: string }[] }[]): string[] {
  const keys: string[] = [];
  for (const r of results) for (const b of r.blockers) if (b.code === "MATERIAL_PRICE_MISSING" && b.ref && !keys.includes(b.ref)) keys.push(b.ref);
  return keys;
}
