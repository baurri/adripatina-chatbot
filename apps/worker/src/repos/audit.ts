import { newId } from "@adripatina/shared";
import type { Ctx } from "../context.js";
import { nowIso } from "../context.js";

const SENSITIVE_KEYS = /(token|secret|password|senha|phone|telefone|chat_id|telegram_user_id|email)/i;

/** Remove/mascara dados sensíveis antes de gravar auditoria. */
export function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SENSITIVE_KEYS.test(k) ? "[redigido]" : redact(v);
    }
    return out;
  }
  return value;
}

export function auditStmt(
  ctx: Ctx,
  actor: string,
  action: string,
  entityType: string,
  entityId: string | null,
  before: unknown,
  after: unknown,
): D1PreparedStatement {
  return ctx.db.stmt(
    `INSERT INTO audit_events (id, actor, action, entity_type, entity_id, before_json, after_json, request_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    newId(),
    actor,
    action,
    entityType,
    entityId,
    before === undefined ? null : JSON.stringify(redact(before)),
    after === undefined ? null : JSON.stringify(redact(after)),
    ctx.requestId,
    nowIso(ctx),
  );
}

export async function audit(
  ctx: Ctx,
  actor: string,
  action: string,
  entityType: string,
  entityId: string | null,
  before?: unknown,
  after?: unknown,
): Promise<void> {
  await auditStmt(ctx, actor, action, entityType, entityId, before, after).run();
}
