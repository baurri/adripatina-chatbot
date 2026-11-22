import { decideMatch, scoreCandidate, type ProjectMention } from "@adripatina/conversations";
import { newId } from "@adripatina/shared";
import type { Ctx } from "../context.js";
import { nowIso } from "../context.js";
import { json } from "../db/sql.js";
import { auditStmt } from "../repos/audit.js";
import { getJob, loadCandidates, setFact } from "../repos/jobs.js";
import { DomainError } from "./quotes.js";
import type { FactSet, JobStatus, ProjectField } from "@adripatina/domain";

export async function recordSuspicion(ctx: Ctx, jobA: string, jobB: string, score: number, reasons: string[], origin: string, status: "ABERTA" | "DISTINTOS" = "ABERTA", decidedBy?: string): Promise<void> {
  const [a, b] = jobA < jobB ? [jobA, jobB] : [jobB, jobA];
  const now = nowIso(ctx);
  await ctx.db.run(
    `INSERT INTO duplicate_suspicions (id, job_a_id, job_b_id, score, reasons_json, origin, status, decided_by, decided_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(job_a_id, job_b_id) DO UPDATE SET score = MAX(score, excluded.score), reasons_json = excluded.reasons_json`,
    newId(),
    a,
    b,
    score,
    JSON.stringify(reasons),
    origin,
    status,
    decidedBy ?? null,
    status === "ABERTA" ? null : now,
    now,
  );
}

/** Varredura periódica (cron/admin): registra pares suspeitos para revisão, sem mesclar nada. */
export async function scanForDuplicates(ctx: Ctx): Promise<number> {
  const candidates = await loadCandidates(ctx, 300);
  let found = 0;
  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i]!;
    const mention: ProjectMention = {
      text: c.text,
      descriptors: c.descriptors,
      techniques: c.techniques,
      ...(c.furnitureType ? { furnitureType: c.furnitureType } : {}),
      ...(c.clientName ? { clientName: c.clientName } : {}),
    };
    for (let j = i + 1; j < candidates.length; j++) {
      const other = candidates[j]!;
      const s = scoreCandidate(mention, other, ctx.clock());
      if (s.score >= 0.7 && s.conflicts.length === 0) {
        const existing = await ctx.db.first<{ status: string }>(
          "SELECT status FROM duplicate_suspicions WHERE job_a_id = ? AND job_b_id = ?",
          c.jobId < other.jobId ? c.jobId : other.jobId,
          c.jobId < other.jobId ? other.jobId : c.jobId,
        );
        if (existing) continue;
        await recordSuspicion(ctx, c.jobId, other.jobId, s.score, s.reasons, "varredura");
        found++;
      }
    }
  }
  return found;
}

export async function listSuspicions(ctx: Ctx, status = "ABERTA") {
  return ctx.db.all<{ id: string; job_a_id: string; job_b_id: string; score: number; reasons_json: string; status: string; origin: string; created_at: string; a_title: string; b_title: string; a_code: string; b_code: string }>(
    `SELECT d.*, ja.title AS a_title, jb.title AS b_title, ja.code AS a_code, jb.code AS b_code
     FROM duplicate_suspicions d JOIN jobs ja ON ja.id = d.job_a_id JOIN jobs jb ON jb.id = d.job_b_id
     WHERE d.status = ? ORDER BY d.score DESC`,
    status,
  );
}

export async function markDistinct(ctx: Ctx, suspicionId: string, adminId: string): Promise<void> {
  const s = await ctx.db.first<{ status: string }>("SELECT status FROM duplicate_suspicions WHERE id = ?", suspicionId);
  if (!s) throw new DomainError("NOT_FOUND", "Suspeita não encontrada", 404);
  await ctx.db.batch([
    ctx.db.stmt("UPDATE duplicate_suspicions SET status = 'DISTINTOS', decided_by = ?, decided_at = ? WHERE id = ?", adminId, nowIso(ctx), suspicionId),
    auditStmt(ctx, adminId, "duplicate.mark_distinct", "duplicate_suspicion", suspicionId, { status: s.status }, { status: "DISTINTOS" }),
  ]);
}

const MOVABLE_TABLES = ["payments", "purchases", "expenses", "attachments", "conversation_messages", "job_events", "quotes", "subcontract_quotes", "material_consumptions", "time_entries", "job_steps", "stock_movements"] as const;

/**
 * Mescla source → target preservando tudo (pagamentos, documentos, mensagens, eventos).
 * Somente ADMIN. Registra os IDs movidos para permitir desfazer. Fatos do target
 * prevalecem; fatos ausentes no target são copiados do source.
 */
export async function mergeJobs(ctx: Ctx, sourceId: string, targetId: string, adminId: string, reason: string): Promise<string> {
  if (sourceId === targetId) throw new DomainError("INVALID", "Não é possível mesclar um projeto com ele mesmo.", 422);
  const source = await getJob(ctx, sourceId);
  const target = await getJob(ctx, targetId);
  if (!source || !target) throw new DomainError("NOT_FOUND", "Projeto não encontrado", 404);
  if (source.status === "MESCLADO" || target.status === "MESCLADO") throw new DomainError("INVALID", "Projeto já mesclado.", 422);
  if (reason.trim().length < 3) throw new DomainError("JUSTIFICATION_REQUIRED", "Informe o motivo da mesclagem.", 422);

  const moved: Record<string, string[]> = {};
  for (const table of MOVABLE_TABLES) {
    const rows = await ctx.db.all<{ id: string }>(`SELECT id FROM ${table} WHERE job_id = ?`, sourceId);
    moved[table] = rows.map((r) => r.id);
  }
  // versões de orçamento do source recebem número acima das do target para manter UNIQUE(job_id, version)
  const maxV = await ctx.db.first<{ v: number | null }>("SELECT MAX(version) AS v FROM quotes WHERE job_id = ?", targetId);
  const offset = maxV?.v ?? 0;
  const mergeId = newId();
  const now = nowIso(ctx);
  const copiedFacts: ProjectField[] = [];
  for (const [field, fact] of Object.entries(source.facts)) {
    if (fact && !target.facts[field as ProjectField] && fact.status !== "unknown") copiedFacts.push(field as ProjectField);
  }
  const stmts: D1PreparedStatement[] = [];
  stmts.push(ctx.db.stmt("UPDATE quotes SET version = version + ? WHERE job_id = ?", offset + 1000, sourceId));
  for (const table of MOVABLE_TABLES) stmts.push(ctx.db.stmt(`UPDATE ${table} SET job_id = ? WHERE job_id = ?`, targetId, sourceId));
  stmts.push(
    ctx.db.stmt("UPDATE jobs SET status = 'MESCLADO', merged_into_id = ?, updated_at = ? WHERE id = ?", targetId, now, sourceId),
    ctx.db.stmt(
      "INSERT INTO job_merges (id, source_job_id, target_job_id, moved_json, source_status_before, reason, merged_by, merged_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      mergeId,
      sourceId,
      targetId,
      JSON.stringify({ ...moved, copiedFacts, quoteVersionOffset: offset + 1000, sourceContracted: source.contractedCents }),
      source.status,
      reason,
      adminId,
      now,
    ),
    ctx.db.stmt(
      "UPDATE duplicate_suspicions SET status = 'MESCLADOS', decided_by = ?, decided_at = ? WHERE (job_a_id = ? AND job_b_id = ?) OR (job_a_id = ? AND job_b_id = ?)",
      adminId,
      now,
      sourceId,
      targetId,
      targetId,
      sourceId,
    ),
    ctx.db.stmt("INSERT INTO job_events (id, job_id, type, payload_json, actor_id, reason, created_at) VALUES (?, ?, 'mesclagem', ?, ?, ?, ?)", newId(), targetId, JSON.stringify({ from: source.code, mergeId }), adminId, reason, now),
    auditStmt(ctx, adminId, "job.merge", "job", targetId, { source: source.code, target: target.code }, { mergeId, moved: Object.fromEntries(Object.entries(moved).map(([k, v]) => [k, v.length])) }),
  );
  if (target.contractedCents === null && source.contractedCents !== null) {
    stmts.push(ctx.db.stmt("UPDATE jobs SET contracted_cents = ? WHERE id = ?", source.contractedCents, targetId));
  }
  await ctx.db.batch(stmts);
  for (const field of copiedFacts) {
    const f = source.facts[field]!;
    await setFact(ctx, targetId, field, f.value as never, { actor: adminId, source: "admin", status: f.status, changeKind: "merge" });
  }
  return mergeId;
}

/** Desfaz uma mesclagem: devolve exatamente os registros movidos ao projeto de origem. */
export async function undoMerge(ctx: Ctx, mergeId: string, adminId: string): Promise<void> {
  const m = await ctx.db.first<{ source_job_id: string; target_job_id: string; moved_json: string; source_status_before: JobStatus; undone_at: string | null }>(
    "SELECT * FROM job_merges WHERE id = ?",
    mergeId,
  );
  if (!m) throw new DomainError("NOT_FOUND", "Mesclagem não encontrada", 404);
  if (m.undone_at) throw new DomainError("INVALID", "Mesclagem já desfeita.", 422);
  const moved = json<Record<string, unknown>>(m.moved_json, {});
  const now = nowIso(ctx);
  const stmts: D1PreparedStatement[] = [];
  for (const table of MOVABLE_TABLES) {
    const ids = (moved[table] as string[] | undefined) ?? [];
    for (const id of ids) stmts.push(ctx.db.stmt(`UPDATE ${table} SET job_id = ? WHERE id = ?`, m.source_job_id, id));
  }
  const offset = Number(moved.quoteVersionOffset ?? 0);
  if (offset) stmts.push(ctx.db.stmt("UPDATE quotes SET version = version - ? WHERE job_id = ? AND version > ?", offset, m.source_job_id, offset));
  // fatos copiados na mesclagem são removidos do alvo (histórico mantido em job_facts)
  const target = await getJob(ctx, m.target_job_id);
  const copied = (moved.copiedFacts as ProjectField[] | undefined) ?? [];
  if (target && copied.length) {
    const facts: FactSet = { ...target.facts };
    for (const f of copied) {
      const fact = facts[f];
      if (fact && fact.source === "admin") delete facts[f];
    }
    stmts.push(ctx.db.stmt("UPDATE jobs SET facts_json = ? WHERE id = ?", JSON.stringify(facts), m.target_job_id));
    stmts.push(ctx.db.stmt("UPDATE job_facts SET superseded_at = ? WHERE job_id = ? AND change_kind = 'merge' AND superseded_at IS NULL", now, m.target_job_id));
  }
  stmts.push(
    ctx.db.stmt("UPDATE jobs SET status = ?, merged_into_id = NULL, updated_at = ? WHERE id = ?", m.source_status_before, now, m.source_job_id),
    ctx.db.stmt("UPDATE job_merges SET undone_by = ?, undone_at = ? WHERE id = ?", adminId, now, mergeId),
    ctx.db.stmt(
      "UPDATE duplicate_suspicions SET status = 'DISTINTOS', decided_by = ?, decided_at = ? WHERE (job_a_id = ? AND job_b_id = ?) OR (job_a_id = ? AND job_b_id = ?)",
      adminId,
      now,
      m.source_job_id,
      m.target_job_id,
      m.target_job_id,
      m.source_job_id,
    ),
    auditStmt(ctx, adminId, "job.merge_undo", "job", m.target_job_id, { mergeId }, { restored: m.source_job_id }),
  );
  await ctx.db.batch(stmts);
}

export { decideMatch };
