import type { ProjectField } from "@adripatina/domain";
import type { Entities, PriceConfidence, QuoteRequestDraft } from "@adripatina/conversations";
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
  | "admin_confirm"
  | "quote_request"
  | "quote_material_pricing";

/** Fluxos que representam um OBJETIVO do usuário (sobrevivem a interrupções). */
export const GOAL_FLOWS: readonly Flow[] = ["intake", "collecting", "confirm_calc", "quote_request", "quote_material_pricing"];

/** Tipo da pergunta pendente: a resposta é interpretada primeiro dentro deste tipo. */
export type PendingQuestionType =
  | "client_identity"
  | "item_identity"
  | "item_count"
  | "furniture_type"
  | "item_owner"
  | "item_condition"
  | "item_dimensions"
  | "service_type"
  | "service_scope"
  | "material_source"
  | "material_purchase_price"
  | "material_package_size"
  | "quote_grouping"
  | "confirmation"
  | "job_operational_status"
  | "repair_hours"
  | "application_method"
  | "logistics"
  | "transport_cost"
  | "amount"
  | "job_field";

export interface PendingQuestion {
  type: PendingQuestionType;
  entity: { kind: "job" | "quote_request" | "item" | "material" | "purchase" | "payment"; id?: string; refs?: string[] };
  field?: ProjectField;
  askedAt: string;
}

/** Objetivo suspenso por uma interrupção clara (pilha). */
export interface SuspendedGoal {
  flow: Flow;
  context: Omit<SessionContext, "goalStack">;
  activeJobId: string | null;
  lastQuestion: ProjectField | null;
  suspendedAt: string;
  reason: string;
}

export type QuoteRequestStep =
  | "clients_relation"
  | "owner_confirm"
  | "owner_each"
  | "identity"
  | "scope"
  | "condition"
  | "review"
  | "review_fix"
  | "grouping"
  | "dims"
  | "repair_hours"
  | "method"
  | "material_source"
  | "logistics"
  | "transport_cost"
  | "calculating"
  | "done";

export interface QuoteRequestState {
  id: string;
  draft: QuoteRequestDraft;
  step: QuoteRequestStep;
  currentRefs: string[];
  ownerProposal?: Record<string, string>;
  /** casal (um cliente só) ou dois clientes, quando os nomes vieram juntos */
  clientsRelation?: "couple" | "separate";
  grouping?: "agrupado" | "por_cliente";
  groupingAsked?: boolean;
  reviewed?: boolean;
  jobByRef?: Record<string, string>;
  askedDims?: string[];
  askedRepair?: string[];
  askedCondition?: boolean;
  method?: "pincel" | "rolo" | "pistola" | null;
  methodAsked?: boolean;
  materialSourceAsked?: boolean;
  logisticsAsked?: boolean;
  transportAsked?: boolean;
  logistics?: { pickup: boolean; delivery: boolean };
  partialLogistics?: { pickup?: boolean; delivery?: boolean };
  unparsed?: number;
  /** estado dito sem dizer de qual peça ("o tampo está ruim, os outros estão melhores"): perguntado depois, nunca descartado */
  notes?: string[];
  /** peças removidas pelo artesão ("esquece o aparador"), para auditoria e desfazer */
  removed?: { ref: string; description: string; at: string; jobId?: string | null }[];
}

export interface PricingCurrent {
  key: string;
  step: "ask_price" | "ask_size" | "confirm" | "confirm_high" | "paused" | "fix_choice";
  amountCents?: number;
  packages?: number;
  packageSize?: string;
  sizeLabel?: string;
  confidence?: PriceConfidence;
  totalGiven?: boolean;
  rawTexts: string[];
  sourceMessageId?: string;
  token: string;
}

export interface PricingState {
  target: { kind: "job"; jobId: string } | { kind: "quote_request"; requestId: string };
  quoteIds: string[];
  pending: string[];
  resolved: string[];
  total: number;
  current: PricingCurrent | null;
  recalcFailed?: boolean;
}

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
    /** valor dito por embalagem ("150 cada"): o total é unitário × embalagens */
    unitCents?: number;
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
  pendingQuestion?: PendingQuestion;
  goalStack?: SuspendedGoal[];
  quoteRequest?: QuoteRequestState;
  pricing?: PricingState;
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
/**
 * Grava a sessão com controle otimista: se outra mensagem do mesmo usuário gravou no meio
 * do caminho (entregas simultâneas do Telegram), o conflito é registrado (log + auditoria) e
 * a gravação acontece mesmo assim — nunca se perde a mensagem atual. A prevenção é operacional:
 * webhook com max_connections=1 (ver OPERATIONS.md), que entrega uma atualização por vez.
 */
export async function saveSession(ctx: Ctx, s: Session): Promise<void> {
  const now = nowIso(ctx);
  const params = [s.flow, JSON.stringify(s.context), s.activeJobId, s.lastQuestion, now, now] as const;
  const changed = await ctx.db.run(
    "UPDATE conversation_sessions SET flow = ?, context_json = ?, active_job_id = ?, last_question = ?, last_activity_at = ?, updated_at = ?, row_version = row_version + 1 WHERE id = ? AND row_version = ?",
    ...params,
    s.id,
    s.rowVersion,
  );
  if (changed > 0) {
    s.rowVersion += 1;
    return;
  }
  console.warn(JSON.stringify({ level: "warn", msg: "session_conflict", requestId: ctx.requestId, sessionId: s.id, expectedVersion: s.rowVersion }));
  await ctx.db.run(
    "INSERT INTO audit_events (id, actor, action, entity_type, entity_id, before_json, after_json, request_id, created_at) VALUES (?, 'system', 'session.conflict', 'conversation_session', ?, ?, NULL, ?, ?)",
    newId(),
    s.id,
    JSON.stringify({ expectedVersion: s.rowVersion, flow: s.flow }),
    ctx.requestId,
    now,
  );
  await ctx.db.run(
    "UPDATE conversation_sessions SET flow = ?, context_json = ?, active_job_id = ?, last_question = ?, last_activity_at = ?, updated_at = ?, row_version = row_version + 1 WHERE id = ?",
    ...params,
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
