import { cooldownUntil, needDedupeKey, type Need, type NeedKind, type ProactiveSettings, type Score } from "@adripatina/conversations";
import { newId } from "@adripatina/shared";
import type { Ctx } from "../../context.js";
import { nowIso } from "../../context.js";

/** Repositório das solicitações de coleta e da linha do tempo (data_collection_events). */

export type RequestStatus =
  | "identified"
  | "queued"
  | "sent"
  | "waiting_response"
  | "partially_answered"
  | "waiting_confirmation"
  | "resolved"
  | "snoozed"
  | "expired"
  | "cancelled"
  | "failed";

export const OPEN_STATUSES: readonly RequestStatus[] = ["identified", "queued", "sent", "waiting_response", "partially_answered", "waiting_confirmation", "snoozed", "failed"];
export const WAITING_STATUSES: readonly RequestStatus[] = ["sent", "waiting_response", "partially_answered", "waiting_confirmation"];

export interface RequestRow {
  id: string;
  user_id: string;
  need_kind: NeedKind;
  entity_type: string;
  entity_id: string;
  entity_key: string | null;
  entity_label: string;
  fields_json: string;
  reason: string;
  priority: number;
  priority_reasons_json: string;
  status: RequestStatus;
  origin: string;
  benefit_job_id: string | null;
  benefit_quote_id: string | null;
  question_text: string | null;
  expected_format: string | null;
  partial_json: string;
  attempts: number;
  last_sent_at: string | null;
  next_allowed_at: string | null;
  due_at: string | null;
  answer_text: string | null;
  answer_message_id: string | null;
  interpretation_confidence: string | null;
  needs_confirmation: number;
  result_json: string | null;
  close_reason: string | null;
  dedupe_key: string;
  correlation_id: string;
  telegram_message_id: string | null;
  priority_locked: number;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
}

export type EventKind =
  | "detected"
  | "priority_updated"
  | "queued"
  | "sent"
  | "send_failed"
  | "answer"
  | "partial"
  | "confirmation_asked"
  | "applied"
  | "quote_resumed"
  | "snoozed"
  | "dont_know"
  | "discontinued"
  | "cancelled"
  | "reopened"
  | "expired"
  | "resolved_elsewhere"
  | "unparsed"
  | "released";

/** Texto humano do evento (painel e histórico). */
export const EVENT_LABEL: Record<EventKind, string> = {
  detected: "Necessidade identificada",
  priority_updated: "Prioridade recalculada",
  queued: "Colocada na fila",
  sent: "Pergunta enviada ao Adriano",
  send_failed: "Falha ao enviar pelo Telegram",
  answer: "Adriano respondeu",
  partial: "Resposta parcial — faltou um dado",
  confirmation_asked: "Bot pediu confirmação",
  applied: "Dado salvo na base",
  quote_resumed: "Orçamento retomado com o novo dado",
  snoozed: "Adriano pediu para perguntar novamente depois",
  dont_know: "Adriano disse que não sabia (sem problema)",
  discontinued: "Adriano disse que não usa mais esse item",
  cancelled: "Solicitação cancelada",
  reopened: "Solicitação reaberta",
  expired: "Solicitação expirou sem resposta",
  resolved_elsewhere: "Dado informado em outra conversa — pergunta dispensada",
  unparsed: "Resposta não entendida",
  released: "Adriano mudou de assunto; a pergunta continua aguardando",
};

export async function addEvent(
  ctx: Ctx,
  e: { requestId: string | null; userId: string | null; correlationId: string | null; kind: EventKind; actor: string; messageId?: string | null; data?: unknown },
): Promise<void> {
  await ctx.db.run(
    "INSERT INTO data_collection_events (id, request_id, user_id, correlation_id, kind, actor, message_id, data_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    newId(),
    e.requestId,
    e.userId,
    e.correlationId,
    e.kind,
    e.actor,
    e.messageId ?? null,
    JSON.stringify(e.data ?? {}),
    nowIso(ctx),
  );
}

export async function getRequest(ctx: Ctx, id: string): Promise<RequestRow | null> {
  return ctx.db.first<RequestRow>("SELECT * FROM data_collection_requests WHERE id = ?", id);
}

export async function findOpenByDedupe(ctx: Ctx, dedupeKey: string): Promise<RequestRow | null> {
  return ctx.db.first<RequestRow>(
    `SELECT * FROM data_collection_requests WHERE dedupe_key = ? AND status IN (${OPEN_STATUSES.map(() => "?").join(",")}) LIMIT 1`,
    dedupeKey,
    ...OPEN_STATUSES,
  );
}

export async function listOpenForUser(ctx: Ctx, userId: string): Promise<RequestRow[]> {
  return ctx.db.all<RequestRow>(
    `SELECT * FROM data_collection_requests WHERE user_id = ? AND status IN (${OPEN_STATUSES.map(() => "?").join(",")}) ORDER BY priority DESC, created_at`,
    userId,
    ...OPEN_STATUSES,
  );
}

export async function waitingForUser(ctx: Ctx, userId: string): Promise<RequestRow | null> {
  return ctx.db.first<RequestRow>(
    `SELECT * FROM data_collection_requests WHERE user_id = ? AND status IN (${WAITING_STATUSES.map(() => "?").join(",")}) ORDER BY last_sent_at DESC LIMIT 1`,
    userId,
    ...WAITING_STATUSES,
  );
}

/** Histórico de uma mesma pergunta (todas as solicitações com a mesma chave). */
export async function historyFor(ctx: Ctx, dedupeKey: string): Promise<{ attempts: number; dontKnow: number; lastClosed: { status: string; at: string } | null }> {
  const agg = await ctx.db.first<{ attempts: number | null }>("SELECT SUM(attempts) AS attempts FROM data_collection_requests WHERE dedupe_key = ?", dedupeKey);
  const dk = await ctx.db.first<{ n: number }>(
    "SELECT COUNT(*) AS n FROM data_collection_events e JOIN data_collection_requests r ON r.id = e.request_id WHERE r.dedupe_key = ? AND e.kind = 'dont_know'",
    dedupeKey,
  );
  const closed = await ctx.db.first<{ status: string; updated_at: string }>(
    "SELECT status, updated_at FROM data_collection_requests WHERE dedupe_key = ? AND status IN ('cancelled','expired') ORDER BY updated_at DESC LIMIT 1",
    dedupeKey,
  );
  return { attempts: agg?.attempts ?? 0, dontKnow: dk?.n ?? 0, lastClosed: closed ? { status: closed.status, at: closed.updated_at } : null };
}

const UPDATABLE = new Set([
  "status",
  "priority",
  "priority_reasons_json",
  "question_text",
  "partial_json",
  "attempts",
  "last_sent_at",
  "next_allowed_at",
  "answer_text",
  "answer_message_id",
  "interpretation_confidence",
  "needs_confirmation",
  "result_json",
  "close_reason",
  "telegram_message_id",
  "priority_locked",
  "resolved_at",
  "reason",
  "benefit_job_id",
  "benefit_quote_id",
]);

/** Atualização com lista branca de colunas (nunca SQL vindo de fora). */
export async function updateRequest(ctx: Ctx, id: string, patch: Record<string, string | number | null>, onlyIfStatus?: readonly RequestStatus[]): Promise<boolean> {
  const cols = Object.keys(patch).filter((k) => UPDATABLE.has(k));
  if (!cols.length) return false;
  const where = onlyIfStatus?.length ? ` AND status IN (${onlyIfStatus.map(() => "?").join(",")})` : "";
  const changed = await ctx.db.run(
    `UPDATE data_collection_requests SET ${cols.map((c) => `${c} = ?`).join(", ")}, updated_at = ? WHERE id = ?${where}`,
    ...cols.map((c) => patch[c] ?? null),
    nowIso(ctx),
    id,
    ...(onlyIfStatus ?? []),
  );
  return changed > 0;
}

export type UpsertOutcome = { kind: "created"; id: string } | { kind: "existing"; id: string } | { kind: "suppressed"; reason: string };

/**
 * Cria (ou reaproveita) a solicitação para uma necessidade. Idempotente: o índice
 * único parcial em dedupe_key impede duas solicitações abertas para o mesmo dado.
 */
export async function upsertRequest(
  ctx: Ctx,
  userId: string,
  need: Need,
  score: Score,
  settings: ProactiveSettings,
  correlationId: string,
): Promise<UpsertOutcome> {
  const dedupeKey = needDedupeKey(userId, need);
  const open = await findOpenByDedupe(ctx, dedupeKey);
  if (open) {
    if (!open.priority_locked && open.priority !== score.score) {
      await updateRequest(ctx, open.id, { priority: score.score, priority_reasons_json: JSON.stringify(score.reasons), reason: need.reason, benefit_job_id: need.benefit.jobId ?? null, benefit_quote_id: need.benefit.quoteId ?? null });
    }
    return { kind: "existing", id: open.id };
  }
  const hist = await historyFor(ctx, dedupeKey);
  if (hist.lastClosed && Date.parse(cooldownUntil(settings, "recreate", new Date(hist.lastClosed.at))) > ctx.clock().getTime()) {
    return { kind: "suppressed", reason: `fechada recentemente (${hist.lastClosed.status})` };
  }
  const id = newId();
  const now = nowIso(ctx);
  const inserted = await ctx.db.run(
    `INSERT OR IGNORE INTO data_collection_requests
      (id, user_id, need_kind, entity_type, entity_id, entity_key, entity_label, fields_json, reason, priority, priority_reasons_json, status, origin,
       benefit_job_id, benefit_quote_id, expected_format, partial_json, attempts, due_at, dedupe_key, correlation_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'queued', ?, ?, ?, ?, '{}', 0, ?, ?, ?, ?, ?)`,
    id,
    userId,
    need.kind,
    need.entityType,
    need.entityId,
    need.entityKey,
    need.label,
    JSON.stringify(need.fields),
    need.reason,
    score.score,
    JSON.stringify(score.reasons),
    need.reason === "quote_blocked" ? "quote_blocker" : "proactive_job",
    need.benefit.jobId ?? null,
    need.benefit.quoteId ?? null,
    need.expectedFormat,
    cooldownUntil(settings, "expire", ctx.clock()),
    dedupeKey,
    correlationId,
    now,
    now,
  );
  if (inserted === 0) {
    // corrida entre duas execuções: a outra criou primeiro
    const again = await findOpenByDedupe(ctx, dedupeKey);
    return again ? { kind: "existing", id: again.id } : { kind: "suppressed", reason: "corrida" };
  }
  await addEvent(ctx, { requestId: id, userId, correlationId, kind: "detected", actor: "proactive_job", data: { reason: need.reason, score: score.score, reasons: score.reasons } });
  return { kind: "created", id };
}

/** Resolve solicitações abertas de um dado que chegou por outro caminho (ex.: compra, orçamento). */
export async function resolveMatchingRequests(
  ctx: Ctx,
  match: { kinds: NeedKind[]; entityType: string; entityId: string },
  info: { actor: string; messageId?: string | null; reason: string; exceptId?: string },
): Promise<number> {
  const rows = await ctx.db.all<{ id: string; user_id: string; correlation_id: string }>(
    `SELECT id, user_id, correlation_id FROM data_collection_requests
      WHERE entity_type = ? AND entity_id = ? AND need_kind IN (${match.kinds.map(() => "?").join(",")}) AND status IN (${OPEN_STATUSES.map(() => "?").join(",")})`,
    match.entityType,
    match.entityId,
    ...match.kinds,
    ...OPEN_STATUSES,
  );
  let n = 0;
  for (const r of rows) {
    if (r.id === info.exceptId) continue;
    const ok = await updateRequest(ctx, r.id, { status: "resolved", close_reason: info.reason, resolved_at: nowIso(ctx) }, OPEN_STATUSES);
    if (ok) {
      n++;
      await addEvent(ctx, { requestId: r.id, userId: r.user_id, correlationId: r.correlation_id, kind: "resolved_elsewhere", actor: info.actor, messageId: info.messageId ?? null, data: { reason: info.reason } });
    }
  }
  return n;
}
