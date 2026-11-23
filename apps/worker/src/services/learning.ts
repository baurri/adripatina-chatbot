import { newId } from "@adripatina/shared";
import type { Ctx } from "../context.js";
import { nowIso } from "../context.js";
import { auditStmt } from "../repos/audit.js";
import { getMaterialByKey } from "../repos/catalog.js";

/**
 * Uma compra confirmada pelo artesão é uma fonte objetiva para preço de reposição.
 * O valor da embalagem é derivado do total / número de embalagens; nunca da IA.
 */
export async function learnFromConfirmedPurchase(
  ctx: Ctx,
  input: { userId: string; jobId: string | null; messageId: string; materialKey: string; totalCents: number; packages: number; packageSize: string },
): Promise<void> {
  const material = await getMaterialByKey(ctx, input.materialKey);
  if (!material || input.packages < 1 || input.totalCents < 1) return;
  const priceCents = Math.round(input.totalCents / input.packages);
  const now = nowIso(ctx);
  const observationId = newId();
  await ctx.db.batch([
    ctx.db.stmt(
      "UPDATE materials SET package_size = ?, replacement_price_cents = ?, price_updated_at = ?, origin = 'telegram_confirmed', updated_at = ? WHERE id = ?",
      input.packageSize,
      priceCents,
      now,
      now,
      material.id,
    ),
    ctx.db.stmt(
      "INSERT INTO material_price_history (id, material_id, price_cents, source, recorded_by, recorded_at) VALUES (?, ?, ?, 'telegram_confirmed', ?, ?)",
      newId(),
      material.id,
      priceCents,
      input.userId,
      now,
    ),
    ctx.db.stmt(
      "INSERT INTO learning_observations (id, user_id, job_id, message_id, kind, entity_type, entity_key, data_json, confidence, status, applied_at, created_at) VALUES (?, ?, ?, ?, 'MATERIAL_PURCHASE', 'material', ?, ?, 1, 'APLICADO', ?, ?)",
      observationId,
      input.userId,
      input.jobId,
      input.messageId,
      input.materialKey,
      JSON.stringify({ totalCents: input.totalCents, packages: input.packages, packageSize: input.packageSize, replacementPriceCents: priceCents }),
      now,
      now,
    ),
    auditStmt(ctx, input.userId, "material.learn_purchase", "material", material.id, undefined, { observationId, priceCents, packageSize: input.packageSize, packages: input.packages }),
  ]);
}
export async function recordMaterialSourceObservation(
  ctx: Ctx,
  input: { userId: string; jobId: string; messageId: string; materialKeys: string[]; source: "tem_tudo" | "tem_parte" | "precisa_comprar" },
): Promise<void> {
  const now = nowIso(ctx);
  const keys = [...new Set(input.materialKeys)];
  if (!keys.length) return;
  await ctx.db.batch(
    keys.map((key) =>
      ctx.db.stmt(
        "INSERT INTO learning_observations (id, user_id, job_id, message_id, kind, entity_type, entity_key, data_json, confidence, status, applied_at, created_at) VALUES (?, ?, ?, ?, 'MATERIAL_SOURCE', 'material', ?, ?, 1, 'APLICADO', ?, ?)",
        newId(), input.userId, input.jobId, input.messageId, key, JSON.stringify({ source: input.source }), now, now,
      ),
    ),
  );
}

export async function recordTechniqueTimeObservation(
  ctx: Ctx,
  input: { userId: string; jobId: string; messageId: string; techniqueKeys: string[]; hours: string },
): Promise<void> {
  const now = nowIso(ctx);
  const keys = [...new Set(input.techniqueKeys)];
  const stmts: D1PreparedStatement[] = [
    ctx.db.stmt(
      "INSERT INTO time_entries (id, job_id, step_id, hours, work_date, note, created_by, created_at) VALUES (?, ?, NULL, ?, substr(?,1,10), 'Tempo total informado ao bot', ?, ?)",
      newId(), input.jobId, input.hours, now, input.userId, now,
    ),
  ];
  for (const key of keys) {
    stmts.push(
      ctx.db.stmt(
        "INSERT INTO learning_observations (id, user_id, job_id, message_id, kind, entity_type, entity_key, data_json, confidence, status, created_at) VALUES (?, ?, ?, ?, 'TECHNIQUE_TIME', 'technique', ?, ?, 1, 'COLETADO', ?)",
        newId(), input.userId, input.jobId, input.messageId, key, JSON.stringify({ hours: input.hours }), now,
      ),
    );
  }
  await ctx.db.batch(stmts);
}

export async function listLearningObservations(
  ctx: Ctx,
  options: { limit?: number; userId?: string | null; from?: string | null; to?: string | null } = {},
): Promise<unknown[]> {
  const limit = options.limit ?? 100;
  return ctx.db.all(
    `SELECT lo.id, lo.kind, lo.entity_type, lo.entity_key, lo.data_json, lo.confidence, lo.status, lo.created_at,
            u.display_name, j.code AS job_code
       FROM learning_observations lo
       LEFT JOIN users u ON u.id = lo.user_id
       LEFT JOIN jobs j ON j.id = lo.job_id
      WHERE (? IS NULL OR lo.user_id = ?)
        AND (? IS NULL OR substr(lo.created_at, 1, 10) >= ?)
        AND (? IS NULL OR substr(lo.created_at, 1, 10) <= ?)
      ORDER BY lo.created_at DESC LIMIT ?`,
    options.userId ?? null,
    options.userId ?? null,
    options.from ?? null,
    options.from ?? null,
    options.to ?? null,
    options.to ?? null,
    limit,
  );
}

