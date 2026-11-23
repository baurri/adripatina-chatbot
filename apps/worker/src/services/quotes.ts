import { assertQuoteTransition, type FactValueMap, type QuoteStatus } from "@adripatina/domain";
import { estimateArea, priceJob, type PricingInput, type PricingResult } from "@adripatina/pricing";
import { renderCommercialQuote, renderInternalQuote, findConfidentialTerms, type CommercialQuoteDoc } from "@adripatina/pdf";
import { addDays, canonicalJson, formatBRL, newId, sha256Hex } from "@adripatina/shared";
import { furnitureLabel, techniqueLabel } from "@adripatina/conversations";
import { z } from "zod";
import type { Ctx } from "../context.js";
import { nowIso } from "../context.js";
import { json } from "../db/sql.js";
import { auditStmt } from "../repos/audit.js";
import { getActiveSettings, getInventory, loadCatalog } from "../repos/catalog.js";
import { addJobEvent, getJob, type Job } from "../repos/jobs.js";
import { enqueueOutbox } from "./outbox.js";

export class DomainError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status = 409,
  ) {
    super(message);
    this.name = "DomainError";
  }
}

/** Ajustes do administrador para precificação, guardados no projeto (jobs.summary_json.pricingOverrides). */
export const PricingOverridesSchema = z.object({
  extraLabor: z.array(z.object({ description: z.string().min(1), hours: z.string().regex(/^\d+(\.\d+)?$/) })).default([]),
  specificExpenses: z
    .array(z.object({ description: z.string().min(1), amountCents: z.number().int().nonnegative(), category: z.enum(["transporte", "outros"]) }))
    .default([]),
  specificRisk: z.object({ pct: z.string().regex(/^\d+(\.\d+)?$/), reason: z.string().min(3) }).nullable().default(null),
  areaM2Override: z.string().regex(/^\d+(\.\d+)?$/).nullable().default(null),
});
export type PricingOverrides = z.infer<typeof PricingOverridesSchema>;

export type ServiceGap = { code: "REPAIRS_HOURS_MISSING" | "TRANSPORT_COST_MISSING" | "CLIENT_MISSING"; message: string };

export interface QuoteRecord {
  id: string;
  jobId: string;
  version: number;
  status: QuoteStatus;
  input: PricingInput;
  result: PricingResult & { gaps?: ServiceGap[] };
  floorCents: number | null;
  recommendedCents: number | null;
  finalPriceCents: number | null;
  confidence: string | null;
  definitiveAllowed: boolean;
  engineVersion: string;
  settingsVersionId: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  validUntil: string | null;
  createdAt: string;
  updatedAt: string;
  rowVersion: number;
}

interface QuoteRow {
  id: string;
  job_id: string;
  version: number;
  status: QuoteStatus;
  input_json: string;
  result_json: string;
  floor_cents: number | null;
  recommended_cents: number | null;
  final_price_cents: number | null;
  confidence: string | null;
  definitive_allowed: number;
  engine_version: string;
  settings_version_id: string | null;
  approved_by: string | null;
  approved_at: string | null;
  valid_until: string | null;
  created_at: string;
  updated_at: string;
  row_version: number;
}

function mapQuote(r: QuoteRow): QuoteRecord {
  return {
    id: r.id,
    jobId: r.job_id,
    version: r.version,
    status: r.status,
    input: JSON.parse(r.input_json),
    result: JSON.parse(r.result_json),
    floorCents: r.floor_cents,
    recommendedCents: r.recommended_cents,
    finalPriceCents: r.final_price_cents,
    confidence: r.confidence,
    definitiveAllowed: r.definitive_allowed === 1,
    engineVersion: r.engine_version,
    settingsVersionId: r.settings_version_id,
    approvedBy: r.approved_by,
    approvedAt: r.approved_at,
    validUntil: r.valid_until,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    rowVersion: r.row_version,
  };
}

export async function getQuote(ctx: Ctx, id: string): Promise<QuoteRecord | null> {
  const r = await ctx.db.first<QuoteRow>("SELECT * FROM quotes WHERE id = ?", id);
  return r ? mapQuote(r) : null;
}

export async function latestQuoteForJob(ctx: Ctx, jobId: string): Promise<QuoteRecord | null> {
  const r = await ctx.db.first<QuoteRow>("SELECT * FROM quotes WHERE job_id = ? ORDER BY version DESC LIMIT 1", jobId);
  return r ? mapQuote(r) : null;
}

export async function listQuotes(ctx: Ctx, status?: QuoteStatus): Promise<(QuoteRecord & { jobTitle: string; jobCode: string })[]> {
  const rows = await ctx.db.all<QuoteRow & { title: string; code: string }>(
    `SELECT q.*, j.title, j.code FROM quotes q JOIN jobs j ON j.id = q.job_id ${status ? "WHERE q.status = ?" : ""} ORDER BY q.updated_at DESC LIMIT 200`,
    ...(status ? [status] : []),
  );
  return rows.map((r) => ({ ...mapQuote(r), jobTitle: r.title, jobCode: r.code }));
}

export async function getOverrides(ctx: Ctx, jobId: string): Promise<PricingOverrides> {
  const r = await ctx.db.first<{ summary_json: string }>("SELECT summary_json FROM jobs WHERE id = ?", jobId);
  const summary = json<{ pricingOverrides?: unknown }>(r?.summary_json, {});
  return PricingOverridesSchema.parse(summary.pricingOverrides ?? {});
}

export async function saveOverrides(ctx: Ctx, jobId: string, overrides: PricingOverrides, actor: string): Promise<void> {
  const parsed = PricingOverridesSchema.parse(overrides);
  const r = await ctx.db.first<{ summary_json: string }>("SELECT summary_json FROM jobs WHERE id = ?", jobId);
  const summary = json<Record<string, unknown>>(r?.summary_json, {});
  const before = summary.pricingOverrides ?? null;
  summary.pricingOverrides = parsed;
  await ctx.db.batch([
    ctx.db.stmt("UPDATE jobs SET summary_json = ?, updated_at = ? WHERE id = ?", JSON.stringify(summary), nowIso(ctx), jobId),
    auditStmt(ctx, actor, "job.pricing_overrides", "job", jobId, before, parsed),
  ]);
}

/** Converte a memória do projeto em entrada do motor. Dados ausentes viram null/bloqueio, nunca zero. */
export async function buildPricingInput(
  ctx: Ctx,
  job: Job,
  extra: { proposedPriceCents?: number | null; approvals?: { belowFloor?: boolean; uncalibrated?: boolean } } = {},
): Promise<{ input: PricingInput; gaps: ServiceGap[] }> {
  const settings = await getActiveSettings(ctx);
  const overrides = await getOverrides(ctx, job.id);
  const f = job.facts;
  const dims = f.dimensions?.value as FactValueMap["dimensions"] | null | undefined;
  const size = f.size_class?.value as FactValueMap["size_class"] | null | undefined;
  const surfaces = f.surfaces?.value as FactValueMap["surfaces"] | null | undefined;
  const area = overrides.areaM2Override
    ? ({ kind: "exact", m2: overrides.areaM2Override } as const)
    : estimateArea({ width: dims?.width ?? null, height: dims?.height ?? null, depth: dims?.depth ?? null, surfaces: surfaces ?? null, sizeClass: size ?? null, part: (f.scope?.value as FactValueMap["scope"] | null | undefined)?.part ?? null }, settings.params);
  const techniques = (f.techniques?.value as string[] | null | undefined) ?? [];
  const method = (f.application_method?.value as string | null | undefined) ?? null;

  const gaps: ServiceGap[] = [];
  const repairs = f.repairs?.value as FactValueMap["repairs"] | null | undefined;
  if (repairs?.needed && overrides.extraLabor.length === 0 && !techniques.includes("restauracao")) {
    gaps.push({ code: "REPAIRS_HOURS_MISSING", message: "Precisa de conserto, mas as horas do conserto ainda não foram definidas." });
  }
  const logistics = f.logistics?.value as FactValueMap["logistics"] | null | undefined;
  if ((logistics?.pickup || logistics?.delivery) && !overrides.specificExpenses.some((e) => e.category === "transporte")) {
    gaps.push({ code: "TRANSPORT_COST_MISSING", message: "Tem frete (buscar/entregar), mas o custo do transporte ainda não foi informado." });
  }
  if (!f.client_name?.value) gaps.push({ code: "CLIENT_MISSING", message: "Falta o nome do cliente." });

  const subs = await ctx.db.all<{ scope: string; cost_cents: number | null; logistics_cents: number; confirmed: number; lead_days: number | null }>(
    "SELECT scope, cost_cents, logistics_cents, confirmed, lead_days FROM subcontract_quotes WHERE job_id = ?",
    job.id,
  );
  const subcontracts: NonNullable<PricingInput["subcontracts"]> = subs.map((s) => ({
    description: s.scope,
    costCents: s.cost_cents,
    logisticsCents: s.logistics_cents,
    confirmed: s.confirmed === 1,
    ...(s.lead_days !== null ? { leadDays: s.lead_days } : {}),
  }));
  const sub = f.subcontract?.value as FactValueMap["subcontract"] | null | undefined;
  if (sub?.needed && subcontracts.length === 0) {
    subcontracts.push({ description: sub.description ?? "Serviço de terceiro", costCents: null, logisticsCents: 0, confirmed: false });
  }

  const inventory: NonNullable<PricingInput["inventory"]> = {};
  for (const line of await getInventory(ctx)) {
    inventory[line.key] = {
      quantity: line.quantity,
      ...(line.avgHistoricalUnitCostCents ? { historicalUnitCostCents: Math.round(Number(line.avgHistoricalUnitCostCents)) } : {}),
    };
  }

  return {
    input: {
      area,
      techniqueKeys: techniques,
      methodKey: method,
      extraLabor: overrides.extraLabor,
      subcontracts,
      specificExpenses: overrides.specificExpenses,
      specificRisk: overrides.specificRisk,
      inventory,
      proposedPriceCents: extra.proposedPriceCents ?? null,
      approvals: { belowFloor: extra.approvals?.belowFloor ?? false, uncalibrated: extra.approvals?.uncalibrated ?? false },
    },
    gaps,
  };
}

function quoteLineStatements(ctx: Ctx, quoteId: string, r: PricingResult): D1PreparedStatement[] {
  const stmts: D1PreparedStatement[] = [ctx.db.stmt("DELETE FROM quote_lines WHERE quote_id = ?", quoteId)];
  let sort = 0;
  for (const l of r.labor.lines) {
    stmts.push(
      ctx.db.stmt(
        "INSERT INTO quote_lines (id, quote_id, kind, description, quantity, unit, internal_cost_cents, commercial_amount_cents, sort) VALUES (?, ?, 'MAO_DE_OBRA', ?, ?, 'h', NULL, NULL, ?)",
        newId(),
        quoteId,
        l.label,
        l.hours,
        sort++,
      ),
    );
  }
  for (const m of r.materials.lines) {
    stmts.push(
      ctx.db.stmt(
        "INSERT INTO quote_lines (id, quote_id, kind, description, quantity, unit, internal_cost_cents, commercial_amount_cents, sort) VALUES (?, ?, 'MATERIAL', ?, ?, ?, ?, NULL, ?)",
        newId(),
        quoteId,
        m.name,
        m.quantity,
        m.unit,
        m.consumptionCostCents,
        sort++,
      ),
    );
  }
  for (const s of r.subcontracts.lines) {
    stmts.push(
      ctx.db.stmt(
        "INSERT INTO quote_lines (id, quote_id, kind, description, quantity, unit, internal_cost_cents, commercial_amount_cents, sort) VALUES (?, ?, 'TERCEIRO', ?, '1', 'un', ?, NULL, ?)",
        newId(),
        quoteId,
        s.description,
        s.totalCents,
        sort++,
      ),
    );
  }
  if (r.commercial) {
    for (const [label, cents] of [
      ["Serviços", r.commercial.servicesCents],
      ["Materiais e insumos", r.commercial.materialsCents],
      ["Transporte", r.commercial.transportCents],
    ] as const) {
      if (cents > 0)
        stmts.push(
          ctx.db.stmt(
            "INSERT INTO quote_lines (id, quote_id, kind, description, quantity, unit, internal_cost_cents, commercial_amount_cents, sort) VALUES (?, ?, 'COMERCIAL', ?, NULL, NULL, NULL, ?, ?)",
            newId(),
            quoteId,
            label,
            cents,
            sort++,
          ),
        );
    }
  }
  return stmts;
}

/**
 * Calcula (motor determinístico) e grava um novo orçamento/versão para o projeto.
 * Se o último orçamento ainda não tem documento emitido e está editável, é atualizado
 * no lugar; caso contrário, cria nova versão — snapshots/PDFs antigos nunca mudam.
 */
export async function calculateQuote(
  ctx: Ctx,
  jobId: string,
  actor: string,
  extra: { proposedPriceCents?: number | null; approvals?: { belowFloor?: boolean; uncalibrated?: boolean } } = {},
): Promise<QuoteRecord> {
  const job = await getJob(ctx, jobId);
  if (!job) throw new DomainError("NOT_FOUND", "Projeto não encontrado", 404);
  const settings = await getActiveSettings(ctx);
  const catalog = await loadCatalog(ctx);
  const { input, gaps } = await buildPricingInput(ctx, job, extra);
  const result = priceJob(input, settings.params, catalog, { now: ctx.clock() });
  const fullResult = { ...result, gaps, definitiveAllowed: result.definitiveAllowed && gaps.length === 0 };
  const now = nowIso(ctx);
  const validUntil = addDays(ctx.clock(), settings.params.quoteValidityDays).toISOString();
  // snapshot dos parâmetros usados — imutável junto ao orçamento
  const inputSnapshot = { ...input, settingsSnapshot: settings.params, catalogSnapshot: catalog };

  const latest = await latestQuoteForJob(ctx, jobId);
  const hasDocs = latest ? !!(await ctx.db.first("SELECT id FROM quote_documents WHERE quote_id = ? LIMIT 1", latest.id)) : false;
  const editable = latest && !hasDocs && ["RASCUNHO", "ESTIMATIVA", "AGUARDANDO_REVISAO", "APROVADO"].includes(latest.status);

  let quoteId: string;
  if (latest && editable) {
    quoteId = latest.id;
    await ctx.db.batch([
      ctx.db.stmt(
        `UPDATE quotes SET status = 'ESTIMATIVA', input_json = ?, result_json = ?, floor_cents = ?, recommended_cents = ?, final_price_cents = ?, confidence = ?, definitive_allowed = ?, engine_version = ?, settings_version_id = ?, approved_by = NULL, approved_at = NULL, valid_until = ?, updated_at = ?, row_version = row_version + 1 WHERE id = ?`,
        JSON.stringify(inputSnapshot),
        JSON.stringify(fullResult),
        result.floorCents,
        result.recommendedCents,
        result.finalPriceCents,
        result.confidence,
        fullResult.definitiveAllowed ? 1 : 0,
        result.engineVersion,
        settings.id,
        validUntil,
        now,
        quoteId,
      ),
      ...quoteLineStatements(ctx, quoteId, result),
      auditStmt(ctx, actor, "quote.recalculate", "quote", quoteId, { floor: latest.floorCents, recommended: latest.recommendedCents }, { floor: result.floorCents, recommended: result.recommendedCents }),
    ]);
  } else {
    quoteId = newId();
    const version = (latest?.version ?? 0) + 1;
    await ctx.db.batch([
      ctx.db.stmt(
        `INSERT INTO quotes (id, job_id, version, status, input_json, result_json, floor_cents, recommended_cents, final_price_cents, confidence, definitive_allowed, engine_version, settings_version_id, valid_until, created_by, created_at, updated_at)
         VALUES (?, ?, ?, 'ESTIMATIVA', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        quoteId,
        jobId,
        version,
        JSON.stringify(inputSnapshot),
        JSON.stringify(fullResult),
        result.floorCents,
        result.recommendedCents,
        result.finalPriceCents,
        result.confidence,
        fullResult.definitiveAllowed ? 1 : 0,
        result.engineVersion,
        settings.id,
        validUntil,
        actor,
        now,
        now,
      ),
      ...quoteLineStatements(ctx, quoteId, result),
      auditStmt(ctx, actor, "quote.create", "quote", quoteId, undefined, { jobId, version, floor: result.floorCents, recommended: result.recommendedCents }),
    ]);
  }
  await addJobEvent(ctx, jobId, "orcamento_calculado", { quoteId, floor: result.floorCents, recommended: result.recommendedCents }, actor);
  return (await getQuote(ctx, quoteId))!;
}

async function setQuoteStatus(ctx: Ctx, q: QuoteRecord, to: QuoteStatus, actor: string, extraSql = "", extraParams: (string | number | null)[] = [], reason?: string): Promise<void> {
  assertQuoteTransition(q.status, to);
  const now = nowIso(ctx);
  const res = await ctx.db.batch([
    ctx.db.stmt(
      `UPDATE quotes SET status = ?, ${extraSql} updated_at = ?, row_version = row_version + 1 WHERE id = ? AND row_version = ?`,
      to,
      ...extraParams,
      now,
      q.id,
      q.rowVersion,
    ),
    auditStmt(ctx, actor, "quote.transition", "quote", q.id, { status: q.status }, { status: to, reason }),
  ]);
  if ((res[0]?.meta?.changes ?? 0) === 0) throw new DomainError("CONFLICT", "O orçamento foi alterado por outra pessoa. Recarregue e tente de novo.");
}

export async function submitForReview(ctx: Ctx, quoteId: string, actor: string): Promise<QuoteRecord> {
  const q = await getQuote(ctx, quoteId);
  if (!q) throw new DomainError("NOT_FOUND", "Orçamento não encontrado", 404);
  if (q.status === "AGUARDANDO_REVISAO") return q;
  await setQuoteStatus(ctx, q, "AGUARDANDO_REVISAO", actor);
  await ctx.db.run(
    "INSERT INTO approval_requests (id, object_type, object_id, kind, justification, requested_by, status, created_at) VALUES (?, 'quote', ?, 'revisao_orcamento', ?, ?, 'PENDENTE', ?)",
    newId(),
    quoteId,
    q.result.blockers.map((b) => b.message).join(" | ") || null,
    actor,
    nowIso(ctx),
  );
  const job = await getJob(ctx, q.jobId);
  await enqueueOutbox(ctx, "notify_admins", { text: `Orçamento aguardando revisão: ${job?.title ?? ""} (${job?.code ?? ""}). Piso ${q.floorCents !== null ? formatBRL(q.floorCents) : "—"}, recomendado ${q.recommendedCents !== null ? formatBRL(q.recommendedCents) : "—"}.` }, `review:${quoteId}:${q.rowVersion}`);
  return (await getQuote(ctx, quoteId))!;
}

export const ApproveSchema = z.object({
  finalPriceCents: z.number().int().positive().nullable().default(null),
  approveBelowFloor: z.boolean().default(false),
  approveUncalibrated: z.boolean().default(false),
  justification: z.string().trim().default(""),
  expectedRowVersion: z.number().int().optional(),
});

/** Aprovação administrativa. Exceções (abaixo do piso / não calibrado) exigem justificativa e ficam auditadas. */
export async function approveQuote(ctx: Ctx, quoteId: string, adminId: string, raw: z.input<typeof ApproveSchema>): Promise<QuoteRecord> {
  const body = ApproveSchema.parse(raw);
  let q = await getQuote(ctx, quoteId);
  if (!q) throw new DomainError("NOT_FOUND", "Orçamento não encontrado", 404);
  if (body.expectedRowVersion !== undefined && body.expectedRowVersion !== q.rowVersion) throw new DomainError("CONFLICT", "O orçamento mudou desde que você abriu. Recarregue.");
  if ((body.approveBelowFloor || body.approveUncalibrated) && body.justification.length < 5) {
    throw new DomainError("JUSTIFICATION_REQUIRED", "Exceções exigem justificativa por escrito.", 422);
  }
  // recalcula com as aprovações explícitas (o motor continua sendo a única fonte dos números)
  q = await calculateQuote(ctx, q.jobId, adminId, {
    proposedPriceCents: body.finalPriceCents,
    approvals: { belowFloor: body.approveBelowFloor, uncalibrated: body.approveUncalibrated },
  });
  const blocking = q.result.blockers;
  const gaps = q.result.gaps ?? [];
  if (blocking.length > 0 || gaps.length > 0) {
    const msgs = [...blocking.map((b) => b.message), ...gaps.map((g) => g.message)];
    throw new DomainError("BLOCKED", `Não é possível aprovar como definitivo: ${msgs.join(" ")}`, 422);
  }
  const now = nowIso(ctx);
  await setQuoteStatus(ctx, q, "APROVADO", adminId, "approved_by = ?, approved_at = ?, approval_note = ?,", [adminId, now, body.justification || null], body.justification);
  const stmts: D1PreparedStatement[] = [
    ctx.db.stmt(
      "UPDATE approval_requests SET status = 'APROVADA', decided_by = ?, decided_at = ?, decision_note = ? WHERE object_type = 'quote' AND object_id = ? AND status = 'PENDENTE'",
      adminId,
      now,
      body.justification || null,
      quoteId,
    ),
  ];
  for (const [flag, kind] of [
    [body.approveBelowFloor, "excecao_abaixo_do_piso"],
    [body.approveUncalibrated, "excecao_nao_calibrado"],
  ] as const) {
    if (flag)
      stmts.push(
        ctx.db.stmt(
          "INSERT INTO approval_requests (id, object_type, object_id, kind, justification, requested_by, status, decided_by, decided_at, decision_note, created_at) VALUES (?, 'quote', ?, ?, ?, ?, 'APROVADA', ?, ?, ?, ?)",
          newId(),
          q.id,
          kind,
          body.justification,
          adminId,
          adminId,
          now,
          body.justification,
          now,
        ),
      );
  }
  await ctx.db.batch(stmts);
  await enqueueOutbox(ctx, "notify_artisans_quote_approved", { quoteId: q.id }, `approved:${q.id}:${q.rowVersion}`);
  return (await getQuote(ctx, q.id))!;
}

async function nextDocumentNumber(ctx: Ctx): Promise<string> {
  const year = Number(new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric" }).format(ctx.clock()));
  const r = await ctx.db.first<{ last_value: number }>(
    "INSERT INTO document_sequences (year, last_value) VALUES (?, 1) ON CONFLICT(year) DO UPDATE SET last_value = last_value + 1 RETURNING last_value",
    year,
  );
  return `AP-${year}-${String(r!.last_value).padStart(4, "0")}`;
}

export interface IssuedDocument {
  id: string;
  number: string;
  docVersion: number;
  kind: "COMERCIAL" | "INTERNO";
  preliminary: boolean;
  r2Key: string;
  sha256: string;
  sizeBytes: number;
  createdAt: string;
  filename: string;
}

function commercialFilename(number: string, version: number, preliminary: boolean): string {
  return `${preliminary ? "Estimativa" : "Proposta"}-${number}-v${version}.pdf`;
}

/** Monta o documento comercial a partir do snapshot — sem nenhum custo interno. */
export async function buildCommercialDoc(ctx: Ctx, q: QuoteRecord, job: Job, number: string, docVersion: number, preliminary: boolean): Promise<CommercialQuoteDoc> {
  const settings = await getActiveSettings(ctx);
  const b = settings.business;
  const f = job.facts;
  const ft = f.furniture_type?.value as FactValueMap["furniture_type"] | null | undefined;
  const dims = f.dimensions?.value as FactValueMap["dimensions"] | null | undefined;
  const techniques = (f.techniques?.value as string[] | null | undefined) ?? [];
  const r = q.result;
  const descParts = [capitalize(furnitureLabel(ft?.type))];
  if (ft?.descriptors?.length) descParts.push(ft.descriptors.join(", "));
  if (ft?.doors) descParts.push(`${ft.doors} portas`);
  if (ft?.drawers) descParts.push(`${ft.drawers} gavetas`);
  if (dims && (dims.height || dims.width || dims.depth)) {
    descParts.push(`medidas aproximadas ${[dims.height, dims.width, dims.depth].filter(Boolean).map((d) => `${d!.replace(".", ",")} m`).join(" × ")}`);
  }
  const scope = [...new Set(r.labor.lines.map((l) => l.label))];
  for (const s of r.subcontracts.lines) scope.push(`${s.description} (profissional parceiro)`);
  const logistics = f.logistics?.value as FactValueMap["logistics"] | null | undefined;
  if (logistics?.pickup) scope.push("Retirada do móvel");
  if (logistics?.delivery) scope.push("Entrega do móvel");
  const lines =
    b.showCommercialBreakdown && r.commercial
      ? [
          { label: "Serviços", amountCents: r.commercial.servicesCents },
          { label: "Materiais e insumos", amountCents: r.commercial.materialsCents },
          { label: "Transporte", amountCents: r.commercial.transportCents },
        ].filter((l) => l.amountCents > 0)
      : [];
  const photos: CommercialQuoteDoc["photos"] = [];
  const photoRows = await ctx.db.all<{ r2_key: string; mime: string }>(
    "SELECT r2_key, mime FROM attachments WHERE job_id = ? AND classification = 'foto_movel' AND deleted_at IS NULL AND mime IN ('image/jpeg','image/png') ORDER BY created_at LIMIT 2",
    job.id,
  );
  for (const p of photoRows) {
    const obj = await ctx.storage.get(p.r2_key);
    if (obj) photos.push({ bytes: new Uint8Array(await obj.arrayBuffer()), mime: p.mime as "image/jpeg" | "image/png" });
  }
  const days = r.leadTime.workingDays;
  const deadlineFact = f.deadline?.value as string | null | undefined;
  return {
    number,
    version: docVersion,
    issuedAt: nowIso(ctx),
    validUntil: q.validUntil ?? addDays(ctx.clock(), settings.params.quoteValidityDays).toISOString(),
    preliminary,
    business: {
      name: b.name,
      tagline: b.tagline,
      phone: b.phone,
      email: b.email,
      instagram: b.instagram,
      city: b.city,
      document: b.document,
      primaryColor: b.primaryColor,
      accentColor: b.accentColor,
    },
    client: { name: (f.client_name?.value as string | null | undefined) ?? job.clientName ?? "Cliente" },
    furniture: { description: descParts.join(" — ") },
    scope,
    finishes: techniques.map((t) => capitalize(techniqueLabel(t))),
    lines,
    totalCents: r.finalPriceCents ?? r.recommendedCents ?? 0,
    deadlineText:
      days > 0
        ? `aproximadamente ${days} dias úteis após a aprovação${deadlineFact && deadlineFact !== "sem prazo" ? ` (combinado: ${deadlineFact})` : ""}`
        : "a combinar",
    paymentTerms: (f.payment_terms?.value as string | null | undefined) ?? "a combinar",
    depositCents: r.depositRecommendedCents,
    exclusions: b.defaultExclusions,
    notes: preliminary ? ["Valores estimados, sujeitos a confirmação após avaliação final.", ...b.defaultNotes] : b.defaultNotes,
    photos,
    showAcceptance: b.showAcceptance,
  };
}

function capitalize(s: string): string {
  return s ? s[0]!.toUpperCase() + s.slice(1) : s;
}

/**
 * Emite PDF comercial (e interno) a partir de snapshot imutável.
 * - definitivo: exige orçamento APROVADO e sem bloqueios
 * - preliminar: permitido em ESTIMATIVA/AGUARDANDO_REVISAO, rotulado NÃO DEFINITIVO
 */
export async function issueDocuments(ctx: Ctx, quoteId: string, actor: string, opts: { preliminary: boolean }): Promise<{ commercial: IssuedDocument; internal: IssuedDocument }> {
  const q = await getQuote(ctx, quoteId);
  if (!q) throw new DomainError("NOT_FOUND", "Orçamento não encontrado", 404);
  const job = await getJob(ctx, q.jobId);
  if (!job) throw new DomainError("NOT_FOUND", "Projeto não encontrado", 404);
  if (!q.result.computable || q.finalPriceCents === null && q.recommendedCents === null) {
    throw new DomainError("NOT_COMPUTABLE", "Ainda faltam dados para calcular. Não dá para gerar documento.", 422);
  }
  if (!opts.preliminary) {
    if (q.status !== "APROVADO" && q.status !== "ENVIADO") throw new DomainError("NOT_APPROVED", "Proposta definitiva exige aprovação do administrador.", 422);
    if (!q.definitiveAllowed) throw new DomainError("BLOCKED", "O orçamento tem pendências e não pode virar proposta definitiva.", 422);
  } else if (!["ESTIMATIVA", "AGUARDANDO_REVISAO", "APROVADO"].includes(q.status)) {
    throw new DomainError("INVALID_STATUS", "Status não permite estimativa preliminar.", 422);
  }

  const prev = await ctx.db.first<{ number: string; doc_version: number }>(
    "SELECT number, doc_version FROM quote_snapshots WHERE quote_id = ? ORDER BY doc_version DESC LIMIT 1",
    quoteId,
  );
  const jobPrev = prev
    ? null
    : await ctx.db.first<{ number: string; doc_version: number }>(
        "SELECT s.number, s.doc_version FROM quote_snapshots s JOIN quotes q ON q.id = s.quote_id WHERE q.job_id = ? ORDER BY s.created_at DESC LIMIT 1",
        q.jobId,
      );
  const base = prev ?? jobPrev;
  const number = base?.number ?? (await nextDocumentNumber(ctx));
  const maxVer = await ctx.db.first<{ v: number | null }>("SELECT MAX(doc_version) AS v FROM quote_snapshots WHERE number = ?", number);
  const docVersion = (maxVer?.v ?? 0) + 1;

  const commercialDoc = await buildCommercialDoc(ctx, q, job, number, docVersion, opts.preliminary);
  const snapshot = {
    quoteId: q.id,
    quoteVersion: q.version,
    number,
    docVersion,
    preliminary: opts.preliminary,
    commercial: { ...commercialDoc, photos: commercialDoc.photos.length },
    internal: { input: q.input, result: q.result, engineVersion: q.engineVersion, settingsVersionId: q.settingsVersionId, approvedBy: q.approvedBy, approvedAt: q.approvedAt },
  };
  const snapshotJson = canonicalJson(snapshot);
  const snapshotHash = await sha256Hex(snapshotJson);
  const snapshotId = newId();

  const commercialPdf = await renderCommercialQuote(commercialDoc);
  // defesa em profundidade: aborta se algum termo confidencial vazar para o PDF comercial
  const leaked = findConfidentialTerms(commercialPdf.renderedText);
  if (leaked.length > 0) throw new DomainError("CONFIDENTIAL_LEAK", `Documento comercial bloqueado: termos internos detectados (${leaked.join(", ")}).`, 500);

  const internalPdf = await renderInternalQuote({
    number,
    version: docVersion,
    generatedAt: nowIso(ctx),
    title: job.title,
    sections: internalSections(q),
  });

  const now = nowIso(ctx);
  const docs: IssuedDocument[] = [];
  for (const [kind, pdf] of [
    ["COMERCIAL", commercialPdf],
    ["INTERNO", internalPdf],
  ] as const) {
    const hash = await sha256Hex(pdf.bytes);
    // chave aleatória: o nome no R2 não revela cliente, valores nem tipo interno
    const r2Key = `documents/${newId()}.pdf`;
    await ctx.storage.put(r2Key, pdf.bytes, { httpMetadata: { contentType: "application/pdf" } });
    docs.push({
      id: newId(),
      number,
      docVersion,
      kind,
      preliminary: opts.preliminary,
      r2Key,
      sha256: hash,
      sizeBytes: pdf.bytes.byteLength,
      createdAt: now,
      filename: kind === "COMERCIAL" ? commercialFilename(number, docVersion, opts.preliminary) : `Interno-${number}-v${docVersion}.pdf`,
    });
  }
  await ctx.db.batch([
    ctx.db.stmt(
      "INSERT INTO quote_snapshots (id, quote_id, number, doc_version, snapshot_json, sha256, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      snapshotId,
      q.id,
      number,
      docVersion,
      snapshotJson,
      snapshotHash,
      actor,
      now,
    ),
    ...docs.map((d) =>
      ctx.db.stmt(
        "INSERT INTO quote_documents (id, quote_id, snapshot_id, number, doc_version, kind, preliminary, r2_key, sha256, size_bytes, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        d.id,
        q.id,
        snapshotId,
        d.number,
        d.docVersion,
        d.kind,
        d.preliminary ? 1 : 0,
        d.r2Key,
        d.sha256,
        d.sizeBytes,
        actor,
        now,
      ),
    ),
    auditStmt(ctx, actor, "quote.issue", "quote", q.id, undefined, { number, docVersion, preliminary: opts.preliminary, snapshotHash }),
  ]);
  await addJobEvent(ctx, q.jobId, "documento_emitido", { number, docVersion, preliminary: opts.preliminary }, actor);
  return { commercial: docs[0]!, internal: docs[1]! };
}

function internalSections(q: QuoteRecord): { heading: string; rows: [string, string][] }[] {
  const r = q.result;
  const money = (c: number | null) => (c === null ? "PENDENTE" : formatBRL(c));
  return [
    {
      heading: "Resultado",
      rows: [
        ["Piso (hora mínima)", money(r.floorCents)],
        ["Recomendado (hora ideal)", money(r.recommendedCents)],
        ["Preço final", money(r.finalPriceCents)],
        ["Entrada recomendada", money(r.depositRecommendedCents)],
        ["Confiança", r.confidence],
        ["Versão do motor", r.engineVersion],
        ["Aprovado por", q.approvedBy ?? "—"],
      ],
    },
    {
      heading: "Taxa horária",
      rows: [
        ["Hora mínima (centavos)", r.hourlyRate.minCentsPerHour],
        ["Hora ideal (centavos)", r.hourlyRate.idealCentsPerHour],
        ["Horas produtivas/mês", r.hourlyRate.productiveHours],
      ],
    },
    { heading: "Mão de obra", rows: [...r.labor.lines.map((l) => [l.label, `${l.hours} h (secagem ${l.dryingHours} h)`] as [string, string]), ["Total de horas ativas", r.labor.totalHours]] },
    {
      heading: "Materiais — consumo x compra",
      rows: [
        ...r.materials.lines.map(
          (m) =>
            [m.name, `consumo ${m.quantity} ${m.unit} = ${money(m.consumptionCostCents)}; estoque usado ${m.inventoryUsed}; comprar ${m.packagesToBuy} emb. = ${money(m.purchaseCashOutlayCents)}`] as [string, string],
        ),
        ["Custo de consumo (reposição)", money(r.materials.consumptionCostCents)],
        ["Desembolso de compra", money(r.materials.purchaseCashOutlayCents)],
        ["Custo histórico do estoque usado", money(r.materials.historicalCostOfInventoryUsedCents)],
      ],
    },
    { heading: "Terceiros", rows: r.subcontracts.lines.map((s) => [s.description, `${money(s.totalCents)} ${s.confirmed ? "(confirmado)" : "(SEM COTAÇÃO)"}`] as [string, string]) },
    {
      heading: "Risco, markup e tributos",
      rows: [
        ["Risco específico", `${r.risk.pct}% ${r.risk.reason ?? ""}`],
        ["Markup sobre custo", `${r.markup.pct}% = ${money(r.markup.cents)}`],
        ["Tributos", r.taxes.configured ? `${r.taxes.ratePct}% (${r.taxes.base})` : "não configurados"],
      ],
    },
    { heading: "Bloqueios e alertas", rows: [...r.blockers.map((b) => ["BLOQUEIO", b.message] as [string, string]), ...r.warnings.map((w) => ["ALERTA", w.message] as [string, string]), ...(r.gaps ?? []).map((g) => ["PENDÊNCIA", g.message] as [string, string])] },
    { heading: "Fórmulas", rows: r.formula.map((f, i) => [`F${i + 1}`, f] as [string, string]) },
  ];
}

export async function listDocuments(ctx: Ctx, quoteId: string, includeInternal: boolean): Promise<IssuedDocument[]> {
  const rows = await ctx.db.all<{ id: string; number: string; doc_version: number; kind: "COMERCIAL" | "INTERNO"; preliminary: number; r2_key: string; sha256: string; size_bytes: number; created_at: string }>(
    `SELECT * FROM quote_documents WHERE quote_id = ? ${includeInternal ? "" : "AND kind = 'COMERCIAL'"} ORDER BY doc_version DESC, kind`,
    quoteId,
  );
  return rows.map((r) => ({
    id: r.id,
    number: r.number,
    docVersion: r.doc_version,
    kind: r.kind,
    preliminary: r.preliminary === 1,
    r2Key: r.r2_key,
    sha256: r.sha256,
    sizeBytes: r.size_bytes,
    createdAt: r.created_at,
    filename: r.kind === "COMERCIAL" ? commercialFilename(r.number, r.doc_version, r.preliminary === 1) : `Interno-${r.number}-v${r.doc_version}.pdf`,
  }));
}

export async function getDocument(ctx: Ctx, documentId: string): Promise<(IssuedDocument & { quoteId: string }) | null> {
  const r = await ctx.db.first<{ id: string; quote_id: string; number: string; doc_version: number; kind: "COMERCIAL" | "INTERNO"; preliminary: number; r2_key: string; sha256: string; size_bytes: number; created_at: string }>(
    "SELECT * FROM quote_documents WHERE id = ?",
    documentId,
  );
  if (!r) return null;
  return {
    id: r.id,
    quoteId: r.quote_id,
    number: r.number,
    docVersion: r.doc_version,
    kind: r.kind,
    preliminary: r.preliminary === 1,
    r2Key: r.r2_key,
    sha256: r.sha256,
    sizeBytes: r.size_bytes,
    createdAt: r.created_at,
    filename: r.kind === "COMERCIAL" ? commercialFilename(r.number, r.doc_version, r.preliminary === 1) : `Interno-${r.number}-v${r.doc_version}.pdf`,
  };
}

/**
 * Envia o PDF COMERCIAL ao chat autorizado do artesão (para encaminhamento manual).
 * Nunca envia a contatos externos. Documento interno é recusado.
 */
export async function sendDocumentToArtisan(ctx: Ctx, documentId: string, actor: string, chatId: string): Promise<void> {
  const doc = await getDocument(ctx, documentId);
  if (!doc) throw new DomainError("NOT_FOUND", "Documento não encontrado", 404);
  if (doc.kind !== "COMERCIAL") throw new DomainError("FORBIDDEN", "Documento interno nunca é enviado pelo fluxo do artesão.", 403);
  const authorized = await ctx.db.first("SELECT id FROM users WHERE telegram_chat_id = ? AND active = 1", chatId);
  if (!authorized) throw new DomainError("FORBIDDEN", "Chat não autorizado.", 403);
  const obj = await ctx.storage.get(doc.r2Key);
  if (!obj) throw new DomainError("NOT_FOUND", "Arquivo não encontrado no armazenamento", 404);
  const bytes = new Uint8Array(await obj.arrayBuffer());
  if ((await sha256Hex(bytes)) !== doc.sha256) throw new DomainError("INTEGRITY", "Falha de integridade do documento.", 500);
  await ctx.telegram.sendDocument(
    chatId,
    doc.filename,
    bytes,
    doc.preliminary ? "Estimativa NÃO DEFINITIVA — confira antes de mandar ao cliente." : "Proposta pronta. Confira e, se estiver tudo certo, encaminhe ao cliente.",
  );
  const now = nowIso(ctx);
  await ctx.db.batch([
    ctx.db.stmt("UPDATE quote_documents SET sent_to_artisan_at = ? WHERE id = ?", now, documentId),
    auditStmt(ctx, actor, "document.sent_to_artisan", "quote_document", documentId, undefined, { number: doc.number, version: doc.docVersion }),
  ]);
  const q = await getQuote(ctx, doc.quoteId);
  if (q && q.status === "APROVADO" && !doc.preliminary) await setQuoteStatus(ctx, q, "ENVIADO", actor, "", [], "PDF entregue ao artesão para encaminhamento");
}

/** Cliente aceitou/recusou (informado pelo artesão ou admin). Aceite fixa o valor contratado. */
export async function markQuoteOutcome(ctx: Ctx, quoteId: string, actor: string, outcome: "ACEITO" | "RECUSADO"): Promise<QuoteRecord> {
  const q = await getQuote(ctx, quoteId);
  if (!q) throw new DomainError("NOT_FOUND", "Orçamento não encontrado", 404);
  await setQuoteStatus(ctx, q, outcome, actor);
  if (outcome === "ACEITO") {
    const price = q.finalPriceCents ?? q.recommendedCents;
    await ctx.db.run("UPDATE jobs SET contracted_cents = ?, status = CASE WHEN status = 'ORCAMENTO' THEN 'AGUARDANDO_INICIO' ELSE status END, updated_at = ? WHERE id = ?", price, nowIso(ctx), q.jobId);
    await addJobEvent(ctx, q.jobId, "orcamento_aceito", { quoteId, price }, actor);
  }
  return (await getQuote(ctx, quoteId))!;
}

export function artisanQuoteSummary(q: QuoteRecord): string {
  const r = q.result;
  const lines: string[] = [];
  if (!r.computable) {
    lines.push("Ainda não consigo calcular. Falta:");
    for (const b of r.blockers) lines.push(`• ${b.message}`);
    return lines.join("\n");
  }
  lines.push(`Valor mínimo (para não ter prejuízo): ${formatBRL(r.floorCents!)}`);
  lines.push(`Valor recomendado: ${formatBRL(r.recommendedCents!)}`);
  lines.push(`Confiança: ${r.confidence}`);
  lines.push(`Horas de trabalho previstas: ${r.labor.totalHours.replace(".", ",")} h`);
  if (r.materials.purchaseCashOutlayCents > 0) lines.push(`Compras de material previstas: ${formatBRL(r.materials.purchaseCashOutlayCents)}`);
  const usedFromStock = r.materials.lines.filter((m) => Number(m.inventoryUsed) > 0).map((m) => m.name);
  if (usedFromStock.length) lines.push(`Material do seu estoque (já incluído no preço, pelo valor de reposição): ${usedFromStock.join(", ")}`);
  const issues = [...r.blockers.map((b) => b.message), ...(r.gaps ?? []).map((g) => g.message)];
  if (issues.length) {
    lines.push("", "Pendências antes da proposta definitiva:");
    for (const i of issues) lines.push(`• ${i}`);
  }
  return lines.join("\n");
}
