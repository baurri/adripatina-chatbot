import type { ProjectField } from "@adripatina/domain";
import type { Entities } from "@adripatina/conversations";
import { newId } from "@adripatina/shared";
import type { Ctx } from "../context.js";
import { nowIso } from "../context.js";
import { json } from "../db/sql.js";

export type Flow =
  | "idle"
  | "intake"
  | "collecting"
  | "confirm_match"
  | "disambiguate"
  | "choose_match"
  | "confirm_new_similar"
  | "contradiction"
  | "expense"
  | "payment"
  | "confirm_calc"
  | "progress_confirm"
  | "learning_time"
  | "resume_prompt"
  | "admin_confirm";

export interface MentionSnapshot extends Partial<Entities> {
  text: string;
  photoHash?: string;
  photoAttachmentId?: string;
  source: "telegram_text" | "telegram_voice" | "telegram_photo";
  messageId?: string;
}

export interface SessionContext {
  mention?: MentionSnapshot;
  candidateJobIds?: string[];
  disambiguation?: "client" | "date";
  contradiction?: { field: ProjectField; oldValue: unknown; newValue: unknown };
  expense?: {
    amountCents?: number;
    description?: string;
    materialKey?: string | null;
    packages?: number | null;
    packageSize?: string | null;
    jobId?: string | null;
    step: "amount" | "package" | "job" | "confirm";
    sequence?: number;
    duplicateOf?: string;
  };
  payment?: { amountCents?: number; clientName?: string; jobId?: string | null; step: "amount" | "job" | "confirm"; sequence?: number; duplicateOf?: string };
  progress?: { jobId: string; to: "EM_EXECUCAO" | "CONCLUIDO" | "ENTREGUE" };
  learning?: { jobId: string; step: "hours" };
  adminAction?: { kind: "approve"; quoteId: string };
  questionHistory?: ProjectField[];
  unparsedCount?: number;
  deferredText?: string;
}

export interface Session {
  id: string;
  userId: string;
  flow: Flow;
  context: SessionContext;
  activeJobId: string | null;
  lastQuestion: ProjectField | null;
  lastActivityAt: string;
  rowVersion: number;
}

export async function loadSession(ctx: Ctx, userId: string): Promise<Session> {
  const r = await ctx.db.first<{ id: string; user_id: string; flow: Flow; context_json: string; active_job_id: string | null; last_question: ProjectField | null; last_activity_at: string; row_version: number }>(
    "SELECT * FROM conversation_sessions WHERE user_id = ?",
    userId,
  );
  if (r) {
    return {
      id: r.id,
      userId: r.user_id,
      flow: r.flow,
      context: json<SessionContext>(r.context_json, {}),
      activeJobId: r.active_job_id,
      lastQuestion: r.last_question,
      lastActivityAt: r.last_activity_at,
      rowVersion: r.row_version,
    };
  }
  const id = newId();
  const now = nowIso(ctx);
  await ctx.db.run(
    "INSERT OR IGNORE INTO conversation_sessions (id, user_id, flow, context_json, last_activity_at, updated_at) VALUES (?, ?, 'idle', '{}', ?, ?)",
    id,
    userId,
    now,
    now,
  );
  return loadSession(ctx, userId);
}

/** Autosave a cada passo. */
export async function saveSession(ctx: Ctx, s: Session): Promise<void> {
  const now = nowIso(ctx);
  await ctx.db.run(
    "UPDATE conversation_sessions SET flow = ?, context_json = ?, active_job_id = ?, last_question = ?, last_activity_at = ?, updated_at = ?, row_version = row_version + 1 WHERE id = ?",
    s.flow,
    JSON.stringify(s.context),
    s.activeJobId,
    s.lastQuestion,
    now,
    now,
    s.id,
  );
}

export async function logMessage(
  ctx: Ctx,
  m: {
    sessionId: string | null;
    userId: string | null;
    jobId: string | null;
    direction: "in" | "out";
    kind: "text" | "voice" | "photo" | "callback" | "document" | "system";
    text?: string | null;
    transcript?: string | null;
    updateId?: number | null;
    messageId?: number | null;
    fileUniqueId?: string | null;
    intent?: string | null;
    confidence?: number | null;
    status?: string;
  },
): Promise<string> {
  const id = newId();
  await ctx.db.run(
    `INSERT INTO conversation_messages (id, session_id, user_id, job_id, direction, kind, text, transcript, telegram_update_id, telegram_message_id, telegram_file_unique_id, intent, confidence, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    m.sessionId,
    m.userId,
    m.jobId,
    m.direction,
    m.kind,
    m.text ?? null,
    m.transcript ?? null,
    m.updateId ?? null,
    m.messageId ?? null,
    m.fileUniqueId ?? null,
    m.intent ?? null,
    m.confidence ?? null,
    m.status ?? "ok",
    nowIso(ctx),
  );
  return id;
}

export async function linkMessageToJob(ctx: Ctx, messageId: string, jobId: string): Promise<void> {
  await ctx.db.run("UPDATE conversation_messages SET job_id = ? WHERE id = ?", jobId, messageId);
}
