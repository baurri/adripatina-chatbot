import {
  subjectOf,
  baseContext,
  canSendNow,
  composeQuestion,
  checkMessageStyle,
  detectNeeds,
  GATE_LABEL,
  localDayStart,
  needDedupeKey,
  rankNeeds,
  validateContextRephrase,
  waitingDecision,
  type ComposedQuestion,
  type GateReason,
  type Need,
  type NeedKind,
  type ProactiveSettings,
  type QuestionSpec,
  type RankedNeed,
} from "@adripatina/conversations";
import { newId } from "@adripatina/shared";
import type { Ctx } from "../../context.js";
import { nowIso } from "../../context.js";
import { getMaterial } from "../../repos/catalog.js";
import { getJob, jobPhrase } from "../../repos/jobs.js";
import { listArtisans, type User } from "../../repos/users.js";
import { GOAL_FLOWS, loadSession, type SessionContext, type SuspendedGoal } from "../../repos/sessions.js";
import { addEvent, historyFor, listOpenForUser, updateRequest, upsertRequest, waitingForUser, WAITING_STATUSES, type RequestRow } from "./repo.js";
import { getProactiveSettings } from "./settings.js";
import { loadSnapshot } from "./snapshot.js";

/**
 * Job de coleta proativa (chamado pelo cron a cada 15 min). A lógica de decisão
 * está nos módulos puros de @adripatina/conversations; aqui só orquestramos:
 * lock → detectar → pontuar → persistir → avaliar limites → compor → enviar.
 */

export type ProactiveMode = "off" | "dry_run" | "live";

export interface UserReport {
  userId: string;
  name: string;
  ranked: { kind: NeedKind; label: string; reason: string; score: number; reasons: string[] }[];
  created: number;
  existing: number;
  suppressed: number;
  resolvedStale: number;
  expired: number;
  gate: { ok: boolean; reason?: GateReason; label?: string };
  selected: { requestId: string | null; kind: NeedKind; label: string; score: number; message: string; expectedUpdate: string } | null;
  sent: boolean;
  error?: string;
}

export interface JobReport {
  mode: ProactiveMode;
  correlationId: string;
  skipped?: string;
  users: UserReport[];
  durationMs: number;
}

const SLOT_MS = 15 * 60_000;

function firstNameOf(u: User): string {
  return u.displayName.split(" ")[0] ?? u.displayName;
}

async function eligibleArtisans(ctx: Ctx, settings: ProactiveSettings): Promise<User[]> {
  const out: User[] = [];
  for (const u of await listArtisans(ctx)) {
    if (!u.active || !u.telegramChatId) continue;
    if (settings.eligibleUserIds.length && !settings.eligibleUserIds.includes(u.id)) continue;
    const prefs = await ctx.db.first<{ preferences_json: string }>("SELECT preferences_json FROM users WHERE id = ?", u.id);
    try {
      if ((JSON.parse(prefs?.preferences_json ?? "{}") as { proactive?: boolean }).proactive === false) continue;
    } catch {
      /* preferências ilegíveis: segue com o padrão */
    }
    out.push(u);
  }
  return out;
}

async function withHistory(ctx: Ctx, userId: string, needs: Need[]): Promise<Need[]> {
  const out: Need[] = [];
  for (const n of needs) {
    const h = await historyFor(ctx, needDedupeKey(userId, n));
    out.push({ ...n, signals: { ...n.signals, attempts: h.attempts, dontKnowCount: h.dontKnow } });
  }
  return out;
}

/** Monta a especificação da pergunta a partir da solicitação (determinístico). */
export async function questionSpecFor(ctx: Ctx, req: Pick<RequestRow, "need_kind" | "reason" | "entity_type" | "entity_id" | "entity_label" | "entity_key" | "benefit_job_id" | "attempts" | "id">, user: User, greet: boolean): Promise<QuestionSpec> {
  const base: QuestionSpec = {
    kind: req.need_kind,
    reason: req.reason as QuestionSpec["reason"],
    subject: req.entity_label.toLowerCase(),
    firstName: firstNameOf(user),
    greet,
    seed: ctx.config.phrasingVariety ? (req.attempts + req.id.charCodeAt(req.id.length - 1)) : 0,
  };
  if (req.entity_type === "material") {
    const m = await getMaterial(ctx, req.entity_id);
    if (m) {
      base.subject = subjectOf(m.name);
      base.baseUnit = m.unit;
      base.knownPriceCents = m.replacementPriceCents;
    }
  }
  if (req.benefit_job_id && req.need_kind === "material_price") {
    const j = await getJob(ctx, req.benefit_job_id);
    // "a mesa da Dona Ana" → "da mesa da Dona Ana"
    if (j) base.benefitLabel = `d${jobPhrase(j)}`;
  }
  if (req.entity_type === "job") {
    const j = await getJob(ctx, req.entity_id);
    base.jobTitle = j ? jobPhrase(j) : req.entity_label;
    if (req.need_kind === "job_materials_used" && req.entity_key) {
      const m = await ctx.db.first<{ name: string; base_unit: string }>("SELECT name, base_unit FROM materials WHERE key = ?", req.entity_key);
      if (m) {
        base.materialName = subjectOf(m.name);
        base.materialUnit = m.base_unit;
        base.baseUnit = m.base_unit;
      }
    }
  }
  if (req.entity_type === "technique") {
    const t = await ctx.db.first<{ name: string; recipe_json: string }>("SELECT name, recipe_json FROM techniques WHERE id = ?", req.entity_id);
    if (t) {
      base.techniqueName = t.name.charAt(0).toLowerCase() + t.name.slice(1);
      try {
        const steps = JSON.parse(t.recipe_json) as { kind: string; materials: { materialKey: string }[] }[];
        const mk = steps.find((s) => s.kind === "coating" && s.materials.length)?.materials[0]?.materialKey;
        const m = mk ? await ctx.db.first<{ name: string }>("SELECT name FROM materials WHERE key = ?", mk) : null;
        if (m) base.subject = subjectOf(m.name);
      } catch {
        /* receita ilegível: usa o rótulo */
      }
    }
  }
  return base;
}

/** Unidade e embalagem do material envolvido (para interpretar "meia lata", "1 litro"…). */
export async function unitInfoFor(ctx: Ctx, req: Pick<RequestRow, "entity_type" | "entity_id" | "entity_key" | "need_kind">): Promise<{ baseUnit?: string; packageSize?: string | null }> {
  if (req.entity_type === "material") {
    const m = await getMaterial(ctx, req.entity_id);
    return m ? { baseUnit: m.unit, packageSize: m.packageSize } : {};
  }
  if (req.need_kind === "job_materials_used" && req.entity_key) {
    const m = await ctx.db.first<{ base_unit: string; package_size: string }>("SELECT base_unit, package_size FROM materials WHERE key = ?", req.entity_key);
    return m ? { baseUnit: m.base_unit, packageSize: m.package_size } : {};
  }
  return {};
}

/** IA reescreve só a frase de contexto; qualquer problema → texto determinístico. */
async function maybeRephraseContext(ctx: Ctx, spec: QuestionSpec, settings: ProactiveSettings): Promise<string | null> {
  const provider = ctx.ai.extraction;
  if (!settings.useAiPhrasing || !provider?.rephrase || !ctx.config.phrasingVariety) return null;
  const base = baseContext(spec);
  try {
    const candidate = await Promise.race([provider.rephrase(base), new Promise<string>((_, rej) => setTimeout(() => rej(new Error("timeout")), 2500))]);
    return validateContextRephrase(base, candidate, spec.subject.split(" ")[0] ?? spec.subject);
  } catch {
    return null;
  }
}

export async function composeForRequest(ctx: Ctx, req: RequestRow, user: User, settings: ProactiveSettings, greet: boolean): Promise<ComposedQuestion> {
  const spec = await questionSpecFor(ctx, req, user, greet);
  const rephrased = await maybeRephraseContext(ctx, spec, settings);
  const composed = composeQuestion(spec, rephrased);
  // trava final de estilo: se a versão reescrita quebrar alguma regra, volta à determinística
  return rephrased && checkMessageStyle(composed.text).length ? composeQuestion(spec) : composed;
}

const EXPECTED_UPDATE: Record<NeedKind, string> = {
  material_price: "Preço de reposição e tamanho da embalagem do material (histórico preservado)",
  material_package_size: "Tamanho da embalagem do material",
  stock_level: "Ajuste de estoque (movimento AJUSTE, marcado como estimado se aproximado)",
  job_actual_hours: "Lançamento de horas reais no trabalho + observação de aprendizado",
  job_materials_used: "Observação de consumo do material (sem mexer no estoque)",
  technique_coats: "Observação de demãos (técnica continua não calibrada)",
};

async function sendState(ctx: Ctx, userId: string, settings: ProactiveSettings) {
  const now = ctx.clock();
  const dayStart = localDayStart(now, settings.timezone).toISOString();
  const weekAgo = new Date(now.getTime() - 7 * 86_400_000).toISOString();
  const sentToday = (await ctx.db.first<{ n: number }>("SELECT COUNT(*) AS n FROM data_collection_events WHERE user_id = ? AND kind = 'sent' AND created_at >= ?", userId, dayStart))?.n ?? 0;
  const sentWeek = (await ctx.db.first<{ n: number }>("SELECT COUNT(*) AS n FROM data_collection_events WHERE user_id = ? AND kind = 'sent' AND created_at >= ?", userId, weekAgo))?.n ?? 0;
  const last = await ctx.db.first<{ created_at: string }>("SELECT created_at FROM data_collection_events WHERE user_id = ? AND kind = 'sent' ORDER BY created_at DESC LIMIT 1", userId);
  const lastIn = await ctx.db.first<{ created_at: string }>("SELECT created_at FROM conversation_messages WHERE user_id = ? AND direction = 'in' ORDER BY created_at DESC LIMIT 1", userId);
  const session = await loadSession(ctx, userId);
  const waiting = await waitingForUser(ctx, userId);
  // objetivo esquecido (ex.: orçamento pausado ontem) não é "conversa ativa"; fluxos laterais (gasto, pagamento) são
  const staleGoal = GOAL_FLOWS.includes(session.flow) && (!lastIn || now.getTime() - Date.parse(lastIn.created_at) > settings.staleGoalHours * 3_600_000);
  return {
    state: { sentToday, sentLast7Days: sentWeek, lastSentAt: last?.created_at ?? null, waitingRequest: !!waiting, lastActivityAt: lastIn?.created_at ?? null, flowIdle: session.flow === "idle" || staleGoal },
    waiting,
    dayStart,
  };
}

/** Envia (ou reenvia) uma solicitação. Marca 'sent' ANTES de chamar o Telegram: em caso de dúvida, nunca duplica. */
export async function deliverRequest(ctx: Ctx, req: RequestRow, user: User, settings: ProactiveSettings, correlationId: string, opts: { greet: boolean }): Promise<{ ok: boolean; message: string; error?: string }> {
  const composed = await composeForRequest(ctx, req, user, settings, opts.greet);
  const now = nowIso(ctx);
  const claimed = await updateRequest(ctx, req.id, { status: "sent", attempts: req.attempts + 1, last_sent_at: now, question_text: composed.text, next_allowed_at: null }, ["queued", "identified", "failed", "snoozed", "waiting_response", "sent"]);
  if (!claimed) return { ok: false, message: composed.text, error: "solicitação mudou de estado" };
  const buttons = settings.showButtons
    ? [
        [
          { text: "Não sei", data: `dc:dontknow:${req.id}` },
          { text: "Pergunte depois", data: `dc:later:${req.id}` },
        ],
        ...(req.entity_type === "material" ? [[{ text: "Não usamos mais", data: `dc:discontinued:${req.id}` }]] : []),
      ]
    : undefined;
  try {
    const { messageId } = await ctx.telegram.sendMessage(user.telegramChatId!, composed.text, buttons);
    await updateRequest(ctx, req.id, { status: "waiting_response", telegram_message_id: messageId === null ? null : String(messageId) });
    const session = await loadSession(ctx, user.id);
    const logId = newId();
    await ctx.db.run(
      `INSERT INTO conversation_messages (id, session_id, user_id, job_id, direction, kind, text, telegram_message_id, intent, status, created_at, contextual_intent, route, routing_json)
       VALUES (?, ?, ?, ?, 'out', 'text', ?, ?, 'proactive_question', 'ok', ?, 'data_request', 'proactive_job', ?)`,
      logId,
      session.id,
      user.id,
      req.benefit_job_id,
      composed.text,
      messageId,
      now,
      JSON.stringify({ origin: "proactive_job", requestId: req.id, correlationId, needKind: req.need_kind, entity: req.entity_label, priority: req.priority, reasons: JSON.parse(req.priority_reasons_json), expected: req.expected_format }),
    );
    // a próxima mensagem do Adriano é interpretada primeiro como resposta a esta pergunta
    const unit = await unitInfoFor(ctx, req);
    const dataCollection = { requestId: req.id, expecting: "primary" as const, kind: req.need_kind, ...unit, question: composed.question };
    const pendingQuestion = { type: "data_request" as const, entity: { kind: "data_request" as const, id: req.id }, askedAt: now };
    let context: SessionContext;
    if (session.flow === "idle" || session.flow === "data_collection") {
      context = { ...session.context, dataCollection, pendingQuestion };
    } else {
      // objetivo antigo (já considerado esquecido pelos limites) fica suspenso na pilha, sem perder nada
      const { goalStack, ...rest } = session.context;
      const suspended: SuspendedGoal = { flow: session.flow, context: rest, activeJobId: session.activeJobId, lastQuestion: session.lastQuestion, suspendedAt: now, reason: "pergunta proativa" };
      context = { goalStack: [...(goalStack ?? []), suspended], dataCollection, pendingQuestion };
    }
    await ctx.db.run("UPDATE conversation_sessions SET flow = 'data_collection', context_json = ?, last_question = NULL, row_version = row_version + 1 WHERE id = ? AND row_version = ?", JSON.stringify(context), session.id, session.rowVersion);
    await addEvent(ctx, { requestId: req.id, userId: user.id, correlationId, kind: "sent", actor: "proactive_job", messageId: logId, data: { attempt: req.attempts + 1, telegramMessageId: messageId } });
    console.info(JSON.stringify({ level: "info", msg: "proactive_sent", correlationId, requestId: req.id, kind: req.need_kind }));
    return { ok: true, message: composed.text };
  } catch (err) {
    const error = String(err instanceof Error ? err.message : err).slice(0, 300);
    // falha confirmada (exceção do Telegram): volta para a fila com espera crescente
    const backoffMin = Math.min(24 * 60, 30 * 2 ** Math.min(6, req.attempts));
    await updateRequest(ctx, req.id, { status: "failed", attempts: req.attempts, next_allowed_at: new Date(ctx.clock().getTime() + backoffMin * 60_000).toISOString() });
    await addEvent(ctx, { requestId: req.id, userId: user.id, correlationId, kind: "send_failed", actor: "proactive_job", data: { error, retryInMinutes: backoffMin } });
    console.error(JSON.stringify({ level: "error", msg: "proactive_send_failed", correlationId, requestId: req.id, error }));
    return { ok: false, message: composed.text, error };
  }
}

function slotKey(now: Date): string {
  return `proactive:${Math.floor(now.getTime() / SLOT_MS)}`;
}

/**
 * Executa a coleta proativa. Em dry_run nada é gravado nem enviado: o relatório
 * mostra necessidades, pontuação, solicitação escolhida, destinatário e mensagem.
 */
export async function runProactiveCollection(ctx: Ctx, opts: { mode?: ProactiveMode; ignoreLock?: boolean } = {}): Promise<JobReport> {
  const started = Date.now();
  const mode = opts.mode ?? ctx.config.proactiveMode;
  const correlationId = `pj-${newId()}`;
  const report: JobReport = { mode, correlationId, users: [], durationMs: 0 };
  if (mode === "off") return { ...report, skipped: "modo desligado", durationMs: Date.now() - started };
  const settings = await getProactiveSettings(ctx);
  const live = mode === "live";
  let runId: string | null = null;
  if (live && !opts.ignoreLock) {
    runId = newId();
    const got = await ctx.db.run("INSERT OR IGNORE INTO job_runs (id, job_name, run_key, status, correlation_id, started_at) VALUES (?, 'proactive_collection', ?, 'running', ?, ?)", runId, slotKey(ctx.clock()), correlationId, nowIso(ctx));
    if (got === 0) return { ...report, skipped: "outra execução já rodou nesta janela", durationMs: Date.now() - started };
  }
  try {
    const snapshot = await loadSnapshot(ctx);
    const needs = detectNeeds(snapshot, settings);
    for (const user of await eligibleArtisans(ctx, settings)) {
      report.users.push(await runForUser(ctx, user, needs, settings, live, correlationId));
    }
    report.durationMs = Date.now() - started;
    if (runId) await ctx.db.run("UPDATE job_runs SET status = 'done', result_json = ?, finished_at = ? WHERE id = ?", JSON.stringify(summarize(report)), nowIso(ctx), runId);
    console.info(JSON.stringify({ level: "info", msg: "proactive_run", ...summarize(report) }));
    return report;
  } catch (err) {
    if (runId) await ctx.db.run("UPDATE job_runs SET status = 'failed', result_json = ?, finished_at = ? WHERE id = ?", JSON.stringify({ error: String(err instanceof Error ? err.message : err).slice(0, 300) }), nowIso(ctx), runId);
    throw err;
  }
}

function summarize(r: JobReport) {
  return {
    mode: r.mode,
    correlationId: r.correlationId,
    durationMs: r.durationMs,
    users: r.users.map((u) => ({ userId: u.userId, needs: u.ranked.length, created: u.created, deduped: u.existing, suppressed: u.suppressed, resolvedStale: u.resolvedStale, expired: u.expired, gate: u.gate.reason ?? "ok", sent: u.sent, error: u.error ?? null })),
  };
}

async function runForUser(ctx: Ctx, user: User, allNeeds: Need[], settings: ProactiveSettings, live: boolean, correlationId: string): Promise<UserReport> {
  const needs = await withHistory(ctx, user.id, allNeeds);
  const ranked: RankedNeed[] = rankNeeds(needs, settings.minScore);
  const rep: UserReport = {
    userId: user.id,
    name: user.displayName,
    ranked: ranked.slice(0, 10).map((r) => ({ kind: r.need.kind, label: r.need.label, reason: r.need.reason, score: r.score.score, reasons: r.score.reasons })),
    created: 0,
    existing: 0,
    suppressed: 0,
    resolvedStale: 0,
    expired: 0,
    gate: { ok: false },
    selected: null,
    sent: false,
  };
  const now = ctx.clock();

  if (!live) {
    // simulação: não grava nada; mostra o que seria perguntado
    const { state } = await sendState(ctx, user.id, settings);
    const gate = canSendNow({ ...settings, enabled: true }, state, now);
    rep.gate = gate.ok ? { ok: true } : { ok: false, reason: gate.reason, label: GATE_LABEL[gate.reason] };
    const top = ranked[0];
    if (top) {
      const fake = { id: "simulacao", need_kind: top.need.kind, reason: top.need.reason, entity_type: top.need.entityType, entity_id: top.need.entityId, entity_label: top.need.label, entity_key: top.need.entityKey, benefit_job_id: top.need.benefit.jobId ?? null, attempts: 0 };
      const spec = await questionSpecFor(ctx, fake, user, true);
      rep.selected = { requestId: null, kind: top.need.kind, label: top.need.label, score: top.score.score, message: composeQuestion(spec).text, expectedUpdate: EXPECTED_UPDATE[top.need.kind] };
    }
    return rep;
  }

  // 1) persistir/atualizar solicitações (no máximo 10 por execução)
  const wantedKeys = new Set(needs.map((n) => needDedupeKey(user.id, n)));
  for (const r of ranked.slice(0, 10)) {
    const out = await upsertRequest(ctx, user.id, r.need, r.score, settings, correlationId);
    if (out.kind === "created") rep.created++;
    else if (out.kind === "existing") rep.existing++;
    else rep.suppressed++;
  }

  // 2) higiene: dado já disponível → resolve; pergunta sem resposta há muito → reenvia ou expira
  for (const open of await listOpenForUser(ctx, user.id)) {
    if (!wantedKeys.has(open.dedupe_key)) {
      const ok = await updateRequest(ctx, open.id, { status: "resolved", close_reason: "dado já disponível (informado em outro momento)", resolved_at: nowIso(ctx) }, ["identified", "queued", "snoozed", "failed", ...WAITING_STATUSES]);
      if (ok) {
        rep.resolvedStale++;
        await addEvent(ctx, { requestId: open.id, userId: user.id, correlationId, kind: "resolved_elsewhere", actor: "proactive_job", data: { reason: "necessidade não existe mais" } });
        await releaseSessionIfPointing(ctx, user.id, open.id);
      }
      continue;
    }
    if (WAITING_STATUSES.includes(open.status) && waitingDecision(settings, { attempts: open.attempts, lastSentAt: open.last_sent_at }, now) === "expire") {
      await updateRequest(ctx, open.id, { status: "expired", close_reason: "sem resposta após o número máximo de tentativas" });
      await addEvent(ctx, { requestId: open.id, userId: user.id, correlationId, kind: "expired", actor: "proactive_job" });
      await releaseSessionIfPointing(ctx, user.id, open.id);
      rep.expired++;
    }
  }

  // 3) limites, horário e contexto
  const { state, waiting, dayStart } = await sendState(ctx, user.id, settings);
  let candidate: RequestRow | null = null;
  if (waiting && waitingDecision(settings, { attempts: waiting.attempts, lastSentAt: waiting.last_sent_at }, now) === "resend") {
    // reenvio gentil da mesma pergunta (conta nos limites; não dispara outra)
    const gate = canSendNow(settings, { ...state, waitingRequest: false }, now);
    rep.gate = gate.ok ? { ok: true } : { ok: false, reason: gate.reason, label: GATE_LABEL[gate.reason] };
    if (gate.ok) candidate = waiting;
  } else {
    const gate = canSendNow(settings, state, now);
    rep.gate = gate.ok ? { ok: true } : { ok: false, reason: gate.reason, label: GATE_LABEL[gate.reason] };
    if (gate.ok) {
      const pool = (await listOpenForUser(ctx, user.id)).filter((r) => ["queued", "identified", "failed", "snoozed"].includes(r.status) && (!r.next_allowed_at || Date.parse(r.next_allowed_at) <= now.getTime()));
      candidate = pool.sort((a, b) => b.priority - a.priority || a.created_at.localeCompare(b.created_at))[0] ?? null;
    }
  }
  if (!candidate) return rep;

  // saudação só na primeira mensagem do dia
  const outToday = (await ctx.db.first<{ n: number }>("SELECT COUNT(*) AS n FROM conversation_messages WHERE user_id = ? AND direction = 'out' AND created_at >= ?", user.id, dayStart))?.n ?? 0;
  const res = await deliverRequest(ctx, candidate, user, settings, correlationId, { greet: outToday === 0 });
  rep.selected = { requestId: candidate.id, kind: candidate.need_kind, label: candidate.entity_label, score: candidate.priority, message: res.message, expectedUpdate: EXPECTED_UPDATE[candidate.need_kind] };
  rep.sent = res.ok;
  if (res.error) rep.error = res.error;
  return rep;
}

/** Se a sessão ainda aponta para esta solicitação, devolve a conversa ao estado livre. */
export async function releaseSessionIfPointing(ctx: Ctx, userId: string, requestId: string): Promise<void> {
  const session = await loadSession(ctx, userId);
  if (session.context.dataCollection?.requestId !== requestId) return;
  const context: SessionContext = { ...session.context };
  delete context.dataCollection;
  if (context.pendingQuestion?.type === "data_request") delete context.pendingQuestion;
  await ctx.db.run("UPDATE conversation_sessions SET flow = CASE WHEN flow = 'data_collection' THEN 'idle' ELSE flow END, context_json = ?, row_version = row_version + 1 WHERE id = ?", JSON.stringify(context), session.id);
}
