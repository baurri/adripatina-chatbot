import { newId } from "@adripatina/shared";
import type { Ctx } from "../context.js";
import { nowIso } from "../context.js";
import { learnPriceFromPurchase } from "./material-pricing.js";

/**
 * Uma compra confirmada pelo artesão é uma fonte objetiva para preço de reposição.
 * O valor da embalagem é derivado do total / número de embalagens; nunca da IA.
 * Delegado ao serviço único de preços (histórico, auditoria e idempotência).
 */
export async function learnFromConfirmedPurchase(
  ctx: Ctx,
  input: { userId: string; jobId: string | null; messageId: string; materialKey: string; totalCents: number; packages: number; packageSize: string; purchaseKey?: string },
): Promise<void> {
  await learnPriceFromPurchase(ctx, { ...input, purchaseKey: input.purchaseKey ?? `${input.messageId}:${input.materialKey}` });
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
    `SELECT lo.id, lo.kind, lo.entity_type, lo.entity_key, lo.data_json, lo.confidence, lo.status, lo.created_at, lo.origin, lo.source_text, lo.message_id,
            u.display_name, j.code AS job_code, j.title AS job_title, cm.created_at AS message_at, COALESCE(cm.transcript, cm.text) AS message_text
       FROM learning_observations lo
       LEFT JOIN users u ON u.id = lo.user_id
       LEFT JOIN jobs j ON j.id = lo.job_id
       LEFT JOIN conversation_messages cm ON cm.id = lo.message_id
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

