import {
  ACTIVE_JOB_STATUSES,
  assertJobTransition,
  deriveFinancialStatus,
  factValuesEqual,
  nextQuestion,
  type Fact,
  type FactSet,
  type FactValueMap,
  type JobStatus,
  type ProjectField,
} from "@adripatina/domain";
import { normalizePersonName, newId, normalizeText } from "@adripatina/shared";
import { describeFact, furnitureLabel, pieceLabel, techniquesLabel, type CandidateProject } from "@adripatina/conversations";
import type { Ctx } from "../context.js";
import { nowIso } from "../context.js";
import { json } from "../db/sql.js";
import { auditStmt } from "./audit.js";

export interface Job {
  id: string;
  code: string;
  clientId: string | null;
  clientName: string | null;
  furnitureId: string | null;
  title: string;
  description: string;
  status: JobStatus;
  contractedCents: number | null;
  facts: FactSet;
  pending: ProjectField[];
  lastInteractionAt: string | null;
  mergedIntoId: string | null;
  createdAt: string;
  updatedAt: string;
  rowVersion: number;
}

interface JobRow {
  id: string;
  code: string;
  client_id: string | null;
  client_name: string | null;
  furniture_id: string | null;
  title: string;
  description: string;
  status: JobStatus;
  contracted_cents: number | null;
  facts_json: string;
  pending_json: string;
  last_interaction_at: string | null;
  merged_into_id: string | null;
  created_at: string;
  updated_at: string;
  row_version: number;
}

const SELECT_JOB = `SELECT j.*, c.name AS client_name FROM jobs j LEFT JOIN clients c ON c.id = j.client_id`;

function mapJob(r: JobRow): Job {
  return {
    id: r.id,
    code: r.code,
    clientId: r.client_id,
    clientName: r.client_name,
    furnitureId: r.furniture_id,
    title: r.title,
    description: r.description,
    status: r.status,
    contractedCents: r.contracted_cents,
    facts: json<FactSet>(r.facts_json, {}),
    pending: json<ProjectField[]>(r.pending_json, []),
    lastInteractionAt: r.last_interaction_at,
    mergedIntoId: r.merged_into_id,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    rowVersion: r.row_version,
  };
}

export async function getJob(ctx: Ctx, id: string): Promise<Job | null> {
  const r = await ctx.db.first<JobRow>(`${SELECT_JOB} WHERE j.id = ?`, id);
  return r ? mapJob(r) : null;
}

export async function getJobByCode(ctx: Ctx, code: string): Promise<Job | null> {
  const r = await ctx.db.first<JobRow>(`${SELECT_JOB} WHERE upper(j.code) = upper(?)`, code);
  return r ? mapJob(r) : null;
}

export async function listJobs(ctx: Ctx, opts: { statuses?: readonly JobStatus[]; limit?: number; offset?: number; clientId?: string } = {}): Promise<Job[]> {
  const where: string[] = [];
  const params: (string | number)[] = [];
  if (opts.statuses?.length) {
    where.push(`j.status IN (${opts.statuses.map(() => "?").join(",")})`);
    params.push(...opts.statuses);
  }
  if (opts.clientId) {
    where.push("j.client_id = ?");
    params.push(opts.clientId);
  }
  const sql = `${SELECT_JOB} ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY COALESCE(j.last_interaction_at, j.created_at) DESC LIMIT ? OFFSET ?`;
  params.push(opts.limit ?? 50, opts.offset ?? 0);
  return (await ctx.db.all<JobRow>(sql, ...params)).map(mapJob);
}

export async function listActiveJobs(ctx: Ctx, limit = 20): Promise<Job[]> {
  return listJobs(ctx, { statuses: ACTIVE_JOB_STATUSES, limit });
}

async function nextJobCode(ctx: Ctx): Promise<string> {
  const r = await ctx.db.first<{ last_value: number }>(
    // upsert: se a linha do contador sumir (ex.: banco zerado), recomeça do 1 em vez de quebrar
    "INSERT INTO job_code_sequence (id, last_value) VALUES (1, 1) ON CONFLICT(id) DO UPDATE SET last_value = last_value + 1 RETURNING last_value",
  );
  return `S-${String(r!.last_value).padStart(4, "0")}`;
}

/** Encontra cliente por nome normalizado (sem pronome de tratamento) ou apelido; cria se não existir. */
export async function findOrCreateClient(ctx: Ctx, name: string, actor: string): Promise<{ id: string; name: string; created: boolean }> {
  const norm = normalizePersonName(name);
  const existing = await ctx.db.first<{ id: string; name: string }>(
    "SELECT id, name FROM clients WHERE merged_into_id IS NULL AND (normalized_name = ? OR EXISTS (SELECT 1 FROM json_each(clients.aliases_json) WHERE lower(json_each.value) = ?)) LIMIT 1",
    norm,
    norm,
  );
  if (existing) return { ...existing, created: false };
  const id = newId();
  const now = nowIso(ctx);
  await ctx.db.batch([
    ctx.db.stmt(
      "INSERT INTO clients (id, name, normalized_name, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
      id,
      name.trim(),
      norm,
      actor,
      now,
      now,
    ),
    auditStmt(ctx, actor, "client.create", "client", id, undefined, { name }),
  ]);
  return { id, name: name.trim(), created: true };
}

export async function createJob(ctx: Ctx, input: { actor: string; description: string; facts?: FactSet; messageId?: string }): Promise<Job> {
  const id = newId();
  const code = await nextJobCode(ctx);
  const now = nowIso(ctx);
  await ctx.db.batch([
    ctx.db.stmt(
      `INSERT INTO jobs (id, code, title, description, status, facts_json, search_text, last_interaction_at, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'ORCAMENTO', '{}', ?, ?, ?, ?, ?)`,
      id,
      code,
      "Novo serviço",
      input.description,
      normalizeText(input.description),
      now,
      input.actor,
      now,
      now,
    ),
    ctx.db.stmt("INSERT INTO job_events (id, job_id, type, payload_json, actor_id, created_at) VALUES (?, ?, 'criado', '{}', ?, ?)", newId(), id, input.actor, now),
    auditStmt(ctx, input.actor, "job.create", "job", id, undefined, { code, description: input.description }),
  ]);
  if (input.facts) {
    for (const f of Object.values(input.facts)) {
      if (f) await setFact(ctx, id, f.field, f.value, { actor: input.actor, source: f.source, status: f.status, messageId: input.messageId });
    }
  }
  return (await getJob(ctx, id))!;
}

export type SetFactResult =
  | { kind: "set"; previous: null }
  | { kind: "same"; previous: Fact }
  | { kind: "conflict"; previous: Fact }
  | { kind: "corrected"; previous: Fact };

/**
 * Grava um fato do projeto com histórico. Nunca sobrescreve silenciosamente um
 * fato confirmado com valor diferente: devolve "conflict" (o chamador pergunta),
 * exceto quando `correction=true` (correção explícita do usuário/admin).
 */
export async function setFact<F extends ProjectField>(
  ctx: Ctx,
  jobId: string,
  field: F,
  value: FactValueMap[F] | null,
  opts: { actor: string; source: Fact["source"]; status?: Fact["status"]; messageId?: string | undefined; correction?: boolean; changeKind?: "set" | "correction" | "merge" | "admin" },
): Promise<SetFactResult> {
  const job = await getJob(ctx, jobId);
  if (!job) throw new Error("Projeto não encontrado");
  const previous = (job.facts[field] as Fact | undefined) ?? null;
  const status: Fact["status"] = value === null ? "unknown" : (opts.status ?? "confirmed");

  if (previous && previous.status !== "unknown" && value !== null) {
    if (factValuesEqual(previous.value, value)) return { kind: "same", previous };
    if (!opts.correction) return { kind: "conflict", previous };
  }
  if (previous && previous.status !== "unknown" && value === null && !opts.correction) {
    // "não sei" não apaga um dado já confirmado
    return { kind: "same", previous };
  }

  const now = nowIso(ctx);
  const fact: Fact<F> = { field, value, status, source: opts.source, updatedAt: now, ...(opts.messageId ? { messageId: opts.messageId } : {}) };
  const facts: FactSet = { ...job.facts, [field]: fact };
  const changeKind = opts.changeKind ?? (opts.correction && previous ? "correction" : "set");
  const stmts: D1PreparedStatement[] = [
    ctx.db.stmt("UPDATE job_facts SET superseded_at = ? WHERE job_id = ? AND field = ? AND superseded_at IS NULL", now, jobId, field),
    ctx.db.stmt(
      `INSERT INTO job_facts (id, job_id, field, value_json, status, source, message_id, change_kind, actor_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      newId(),
      jobId,
      field,
      JSON.stringify(value),
      status,
      opts.source,
      opts.messageId ?? null,
      changeKind,
      opts.actor,
      now,
    ),
  ];

  // projeções do fato em colunas/tabelas normalizadas
  let clientId = job.clientId;
  if (field === "client_name" && typeof value === "string" && value.trim()) {
    const c = await findOrCreateClient(ctx, value, opts.actor);
    clientId = c.id;
  }
  const title = buildTitle(facts);
  const search = buildSearchText(facts, job.description);
  const pending = computePending(facts);
  stmts.push(
    ctx.db.stmt(
      `UPDATE jobs SET facts_json = ?, client_id = ?, title = ?, search_text = ?, pending_json = ?, last_interaction_at = ?, updated_at = ?, row_version = row_version + 1 WHERE id = ?`,
      JSON.stringify(facts),
      clientId,
      title,
      search,
      JSON.stringify(pending),
      now,
      now,
      jobId,
    ),
  );
  if (changeKind === "correction") {
    stmts.push(
      ctx.db.stmt(
        "INSERT INTO job_events (id, job_id, type, payload_json, actor_id, created_at) VALUES (?, ?, 'correcao', ?, ?, ?)",
        newId(),
        jobId,
        JSON.stringify({ field, before: previous?.value ?? null, after: value }),
        opts.actor,
        now,
      ),
    );
  }
  await ctx.db.batch(stmts);
  await syncFurniture(ctx, jobId, facts, clientId);
  if (!previous) return { kind: "set", previous: null };
  return changeKind === "correction" ? { kind: "corrected", previous } : { kind: "set", previous: null };
}

async function syncFurniture(ctx: Ctx, jobId: string, facts: FactSet, clientId: string | null): Promise<void> {
  const ft = facts.furniture_type?.value as FactValueMap["furniture_type"] | null | undefined;
  const dims = facts.dimensions?.value as FactValueMap["dimensions"] | null | undefined;
  const size = facts.size_class?.value as string | null | undefined;
  const condition = facts.condition?.value as string | null | undefined;
  if (!ft && !dims && !size) return;
  const job = await ctx.db.first<{ furniture_id: string | null }>("SELECT furniture_id FROM jobs WHERE id = ?", jobId);
  const now = nowIso(ctx);
  if (job?.furniture_id) {
    await ctx.db.run(
      `UPDATE furniture_items SET client_id = ?, type = ?, descriptors_json = ?, width_m = ?, height_m = ?, depth_m = ?, size_class = ?, condition = ?, updated_at = ? WHERE id = ?`,
      clientId,
      ft?.type ?? null,
      JSON.stringify(ft?.descriptors ?? []),
      dims?.width ?? null,
      dims?.height ?? null,
      dims?.depth ?? null,
      size ?? null,
      condition ?? null,
      now,
      job.furniture_id,
    );
  } else {
    const fid = newId();
    await ctx.db.batch([
      ctx.db.stmt(
        `INSERT INTO furniture_items (id, client_id, type, descriptors_json, width_m, height_m, depth_m, size_class, condition, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        fid,
        clientId,
        ft?.type ?? null,
        JSON.stringify(ft?.descriptors ?? []),
        dims?.width ?? null,
        dims?.height ?? null,
        dims?.depth ?? null,
        size ?? null,
        condition ?? null,
        now,
        now,
      ),
      ctx.db.stmt("UPDATE jobs SET furniture_id = ? WHERE id = ?", fid, jobId),
    ]);
  }
}

export function computePending(facts: FactSet): ProjectField[] {
  const out: ProjectField[] = [];
  let f = nextQuestion(facts);
  const skip: ProjectField[] = [];
  while (f && out.length < 20) {
    out.push(f);
    skip.push(f);
    f = nextQuestion(facts, skip);
  }
  // campos respondidos com "não sei" continuam pendentes
  for (const [field, fact] of Object.entries(facts)) if (fact?.status === "unknown") out.push(field as ProjectField);
  return [...new Set(out)];
}

export function buildTitle(facts: FactSet): string {
  const ft = facts.furniture_type?.value as FactValueMap["furniture_type"] | null | undefined;
  const client = facts.client_name?.value as string | null | undefined;
  const base = ft ? capitalizeFirst(pieceLabel(ft)) : "Novo serviço";
  return client ? `${base} — ${client}` : base;
}

function capitalizeFirst(s: string): string {
  return s ? s[0]!.toUpperCase() + s.slice(1) : s;
}

function buildSearchText(facts: FactSet, description: string): string {
  const parts = [description];
  for (const f of Object.values(facts)) if (f?.value !== null && f?.value !== undefined) parts.push(describeFact(f.field, f.value));
  return normalizeText(parts.join(" "));
}

/** Frase curta: "a cristaleira da Dona Maria". */
export function jobPhrase(job: Pick<Job, "facts" | "clientName" | "code"> & { title?: string | null }): string {
  const ft = job.facts.furniture_type?.value as FactValueMap["furniture_type"] | null | undefined;
  const type = ft?.type;
  // serviço criado sem o móvel identificado (ex.: pelo painel): usa o título, nunca "o móvel (S-0001)"
  if (!type && job.title && job.title.trim().length > 2) return `${/^(a|o|as|os) /i.test(job.title) ? "" : "o serviço "}${job.title.trim().replace(/[.,]+$/, "").slice(0, 60)}`;
  if (type === "outro" && ft?.label) {
    const lbl = ft.label.trim();
    const art = /^[^ ]*a$/i.test(normalizeText(lbl).split(" ")[0] ?? "") ? "a" : "o";
    const c = (job.facts.client_name?.value as string | null | undefined) ?? job.clientName;
    return c ? `${art} ${lbl} d${clientArticle(c)} ${c}` : `${art} ${lbl} (ainda sem cliente)`;
  }
  const article = type && ["cristaleira", "comoda", "mesa", "cadeira", "estante", "penteadeira", "poltrona", "cama", "escrivaninha", "sapateira", "moldura", "porta"].includes(type) ? "a" : "o";
  const label = furnitureLabel(type);
  const client = (job.facts.client_name?.value as string | null | undefined) ?? job.clientName;
  return client ? `${article} ${label} d${clientArticle(client)} ${client}` : `${article} ${label} (ainda sem cliente)`;
}

function clientArticle(name: string): string {
  const n = normalizeText(name);
  if (/^(dona|sra|senhora|doutora|dra|tia|professora)\b/.test(n)) return "a";
  if (/^(seu|sr|senhor|doutor|dr|tio|professor)\b/.test(n)) return "o";
  return "e";
}

export function summarizeJob(job: Job): { headline: string; confirmed: string[]; pending: ProjectField[] } {
  const confirmed: string[] = [];
  for (const f of Object.values(job.facts)) {
    if (f && f.status !== "unknown" && f.value !== null) confirmed.push(describeFact(f.field, f.value));
  }
  const techs = job.facts.techniques?.value as string[] | null | undefined;
  const headline = `${capitalizeFirst(jobPhrase(job))}${techs?.length ? ` — ${techniquesLabel(techs)}` : ""}`;
  return { headline, confirmed, pending: computePending(job.facts) };
}

export async function addJobEvent(ctx: Ctx, jobId: string, type: string, payload: unknown, actor: string, reason?: string): Promise<void> {
  await ctx.db.run(
    "INSERT INTO job_events (id, job_id, type, payload_json, actor_id, reason, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    newId(),
    jobId,
    type,
    JSON.stringify(payload ?? {}),
    actor,
    reason ?? null,
    nowIso(ctx),
  );
}

export async function touchJob(ctx: Ctx, jobId: string): Promise<void> {
  await ctx.db.run("UPDATE jobs SET last_interaction_at = ? WHERE id = ?", nowIso(ctx), jobId);
}

export async function transitionJob(ctx: Ctx, jobId: string, to: JobStatus, actor: string, reason?: string): Promise<Job> {
  const job = await getJob(ctx, jobId);
  if (!job) throw new Error("Projeto não encontrado");
  assertJobTransition(job.status, to);
  const now = nowIso(ctx);
  const col = to === "EM_EXECUCAO" ? "started_at" : to === "CONCLUIDO" ? "completed_at" : to === "ENTREGUE" ? "delivered_at" : null;
  await ctx.db.batch([
    ctx.db.stmt(
      `UPDATE jobs SET status = ?, ${col ? `${col} = COALESCE(${col}, ?),` : ""} updated_at = ?, row_version = row_version + 1 WHERE id = ? AND row_version = ?`,
      ...(col ? [to, now, now, jobId, job.rowVersion] : [to, now, jobId, job.rowVersion]),
    ),
    ctx.db.stmt(
      "INSERT INTO job_events (id, job_id, type, payload_json, actor_id, reason, created_at) VALUES (?, ?, 'status', ?, ?, ?, ?)",
      newId(),
      jobId,
      JSON.stringify({ from: job.status, to }),
      actor,
      reason ?? null,
      now,
    ),
    auditStmt(ctx, actor, "job.transition", "job", jobId, { status: job.status }, { status: to, reason }),
  ]);
  return (await getJob(ctx, jobId))!;
}

/** Candidatos para deduplicação (inclui concluídos/entregues recentes). */
export async function loadCandidates(ctx: Ctx, limit = 200): Promise<CandidateProject[]> {
  const rows = await ctx.db.all<JobRow & { photo_hashes: string | null }>(
    `${SELECT_JOB.replace("SELECT j.*, c.name AS client_name", "SELECT j.*, c.name AS client_name, c.aliases_json AS aliases, (SELECT group_concat(a.sha256) FROM attachments a WHERE a.job_id = j.id AND a.deleted_at IS NULL) AS photo_hashes")}
     WHERE j.status <> 'MESCLADO' ORDER BY COALESCE(j.last_interaction_at, j.created_at) DESC LIMIT ?`,
    limit,
  );
  return rows.map((r) => {
    const job = mapJob(r);
    const ft = job.facts.furniture_type?.value as FactValueMap["furniture_type"] | null | undefined;
    return {
      jobId: job.id,
      code: job.code,
      clientName: (job.facts.client_name?.value as string | null | undefined) ?? job.clientName,
      clientAliases: json<string[]>((r as unknown as { aliases?: string }).aliases, []),
      furnitureType: ft?.type ?? null,
      descriptors: ft?.descriptors ?? [],
      techniques: (job.facts.techniques?.value as string[] | null | undefined) ?? [],
      photoHashes: r.photo_hashes ? r.photo_hashes.split(",") : [],
      status: job.status,
      createdAt: job.createdAt,
      lastInteractionAt: job.lastInteractionAt,
      text: `${job.description} ${job.title}`,
    };
  });
}

export async function jobBalance(ctx: Ctx, jobId: string): Promise<{ contractedCents: number | null; paidCents: number; balanceCents: number | null; status: ReturnType<typeof deriveFinancialStatus> }> {
  const job = await ctx.db.first<{ contracted_cents: number | null }>("SELECT contracted_cents FROM jobs WHERE id = ?", jobId);
  const paid = await ctx.db.first<{ paid: number | null }>(
    "SELECT COALESCE(SUM(CASE WHEN kind = 'ESTORNO' THEN -amount_cents ELSE amount_cents END), 0) AS paid FROM payments WHERE job_id = ?",
    jobId,
  );
  const contracted = job?.contracted_cents ?? null;
  const paidCents = paid?.paid ?? 0;
  return {
    contractedCents: contracted,
    paidCents,
    balanceCents: contracted === null ? null : contracted - paidCents,
    status: deriveFinancialStatus(contracted, paidCents),
  };
}

export async function recentMessagesForJob(ctx: Ctx, jobId: string, limit = 10): Promise<{ direction: string; text: string | null; created_at: string }[]> {
  return ctx.db.all("SELECT direction, COALESCE(transcript, text) AS text, created_at FROM conversation_messages WHERE job_id = ? ORDER BY created_at DESC LIMIT ?", jobId, limit);
}
