import { Hono } from "hono";
import { z } from "zod";
import { JOB_STATUSES, PROJECT_FIELDS, QUOTE_STATUSES, type ProjectField } from "@adripatina/domain";
import { PricingSettingsSchema, RecipeStepSchema } from "@adripatina/pricing";
import { Dec, newId, normalizePersonName, normalizeText } from "@adripatina/shared";
import { CATALOG_SOURCES, PARTS } from "@adripatina/conversations";
import { addFurnitureAlias, createFurnitureType, loadFurnitureCatalog, setFurnitureAliasActive, syncFurnitureCatalog, updateFurnitureType, type FurnitureTypePatch } from "../repos/furniture.js";
import { humanizeCallback } from "../conversation/callbacks.js";
import type { AppEnv } from "../app.js";
import { nowIso } from "../context.js";
import { json } from "../db/sql.js";
import { audit, auditStmt } from "../repos/audit.js";
import { BusinessSchema, getActiveSettings, getInventory, getMaterial, listMaterials, listMethods, listTechniques, saveSettingsVersion } from "../repos/catalog.js";
import { financialIdempotencyKey, jobEconomics, recordConsumption, recordExpense, recordPayment, recordPurchase } from "../repos/finance.js";
import { createJob, getJob, jobBalance, listJobs, setFact, summarizeJob, transitionJob } from "../repos/jobs.js";
import { createUser, listUsers } from "../repos/users.js";
import { listSuspicions, markDistinct, mergeJobs, scanForDuplicates, undoMerge } from "../services/duplicates.js";
import {
  approveQuote,
  calculateQuote,
  DomainError,
  getDocument,
  getOverrides,
  getQuote,
  issueDocuments,
  listDocuments,
  listQuotes,
  markQuoteOutcome,
  PricingOverridesSchema,
  saveOverrides,
  sendDocumentToArtisan,
  submitForReview,
} from "../services/quotes.js";
import { cashflowReport, dashboardSummary, profitabilityReport, toCsv } from "../services/reports.js";
import { approveAccessRequest, listAccessRequests, rejectAccessRequest } from "../services/access-requests.js";
import { listLearningObservations } from "../services/learning.js";
import { registerProactiveRoutes } from "./proactive-routes.js";

const decStr = z.string().regex(/^\d+(\.\d+)?$/);
const cents = z.number().int().positive();
const optionalDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional();
const page = (c: { req: { query: (k: string) => string | undefined } }) => ({
  limit: Math.min(200, Math.max(1, Number(c.req.query("limit") ?? 50) || 50)),
  offset: Math.max(0, Number(c.req.query("offset") ?? 0) || 0),
});

export function adminRoutes(): Hono<AppEnv> {
  const r = new Hono<AppEnv>();

  r.get("/me", (c) => {
    const a = c.get("admin");
    return c.json({ id: a.id, name: a.displayName, email: a.adminEmail, role: a.role });
  });

  // ---------------- dashboard & relatórios
  r.get("/dashboard/summary", async (c) => {
    const ctx = c.get("ctx");
    return c.json({ summary: await dashboardSummary(ctx), cashflow: await cashflowReport(ctx, 6) });
  });
  r.get("/reports/cashflow", async (c) => {
    const rows = await cashflowReport(c.get("ctx"), 24);
    if (c.req.query("format") === "csv") return csv(c, "fluxo-de-caixa.csv", rows);
    return c.json({ rows });
  });
  r.get("/reports/profitability", async (c) => {
    const rows = await profitabilityReport(c.get("ctx"));
    if (c.req.query("format") === "csv") return csv(c, "rentabilidade.csv", rows);
    return c.json({ rows });
  });
  r.get("/conversations", async (c) => {
    const { limit, offset } = page(c);
    const filters = z.object({ userId: z.string().min(1).optional(), from: optionalDate, to: optionalDate }).parse({
      userId: c.req.query("userId") || undefined,
      from: c.req.query("from") || undefined,
      to: c.req.query("to") || undefined,
    });
    const userId = filters.userId ?? null;
    const from = filters.from ?? null;
    const to = filters.to ?? null;
    const rows = await c.get("ctx").db.all(
      `SELECT cm.id, cm.direction, cm.kind, COALESCE(cm.transcript, cm.text) AS text, cm.text AS raw_text, cm.transcript, cm.intent, cm.confidence, cm.status, cm.created_at,
              cm.contextual_intent, cm.route, cm.routing_json,
              u.id AS user_id, u.display_name, u.role, j.code AS job_code, j.title AS job_title
         FROM conversation_messages cm
         LEFT JOIN users u ON u.id = cm.user_id
         LEFT JOIN jobs j ON j.id = cm.job_id
        WHERE (? IS NULL OR cm.user_id = ?)
          AND (? IS NULL OR substr(cm.created_at, 1, 10) >= ?)
          AND (? IS NULL OR substr(cm.created_at, 1, 10) <= ?)
        ORDER BY cm.created_at DESC LIMIT ? OFFSET ?`,
      userId,
      userId,
      from,
      from,
      to,
      to,
      limit,
      offset,
    );
    // callbacks técnicos ("prog:confirm") viram texto compreensível; o valor bruto fica nos detalhes
    return c.json({
      rows: (rows as { kind: string; text: string | null; display_name: string | null }[]).map((r) => ({
        ...r,
        display_text: r.kind === "callback" ? humanizeCallback(r.text, r.display_name ?? "Usuário") : r.text,
      })),
    });
  });
  // detalhe de uma mensagem: por que o bot respondeu assim e o que mudou no banco
  r.get("/conversations/:id", async (c) => {
    const ctx = c.get("ctx");
    const msg = await ctx.db.first<{ id: string; routing_json: string | null; kind: string; text: string | null; transcript: string | null; created_at: string; user_id: string | null }>(
      "SELECT * FROM conversation_messages WHERE id = ?",
      c.req.param("id"),
    );
    if (!msg) throw new DomainError("NOT_FOUND", "Mensagem não encontrada", 404);
    const routing = json<{ requestId?: string } | null>(msg.routing_json, null);
    const changes = routing?.requestId ? await ctx.db.all("SELECT action, entity_type, entity_id, before_json, after_json, created_at FROM audit_events WHERE request_id = ? ORDER BY created_at", routing.requestId) : [];
    const learned = await ctx.db.all("SELECT kind, entity_key, data_json, confidence, status, origin, created_at FROM learning_observations WHERE message_id = ?", msg.id);
    const prices = await ctx.db.all(
      "SELECT m.name, h.price_cents, h.previous_price_cents, h.package_size, h.previous_package_size, h.confidence, h.source, h.source_text, h.recorded_at FROM material_price_history h JOIN materials m ON m.id = h.material_id WHERE h.message_id = ?",
      msg.id,
    );
    return c.json({
      message: { ...msg, display_text: msg.kind === "callback" ? humanizeCallback(msg.text) : (msg.transcript ?? msg.text) },
      routing,
      changes,
      learned,
      prices,
    });
  });
  // resumo de aprendizado por técnica: amostras e sugestão SEPARADA do parâmetro oficial
  r.get("/learning/techniques", async (c) => {
    const rows = await c.get("ctx").db.all<{ entity_key: string; data_json: string }>("SELECT entity_key, data_json FROM learning_observations WHERE kind = 'TECHNIQUE_TIME'");
    const acc = new Map<string, { n: number; sum: Dec }>();
    for (const r0 of rows) {
      const h = Dec.tryParse(json<{ hours?: string }>(r0.data_json, {}).hours ?? null);
      if (!h) continue;
      const a = acc.get(r0.entity_key) ?? { n: 0, sum: Dec.ZERO };
      a.n++;
      a.sum = a.sum.add(h);
      acc.set(r0.entity_key, a);
    }
    return c.json({
      minSamplesForPromotion: null,
      note: "Sugestões não são aplicadas automaticamente: um serviço só não calibra uma técnica. Promoção automática exige regra explícita, amostra mínima e limites seguros (não configurados).",
      rows: [...acc.entries()].map(([key, a]) => ({ technique: key, samples: a.n, avgHoursPerJob: a.sum.div(a.n).round(2).toString(), status: "SUGESTAO_NAO_APLICADA" })),
    });
  });
  r.get("/learning-observations", async (c) => {
    const filters = z.object({ userId: z.string().min(1).optional(), from: optionalDate, to: optionalDate }).parse({
      userId: c.req.query("userId") || undefined,
      from: c.req.query("from") || undefined,
      to: c.req.query("to") || undefined,
    });
    return c.json({ rows: await listLearningObservations(c.get("ctx"), { limit: page(c).limit, ...filters }) });
  });

  // ---------------- clientes
  r.get("/clients", async (c) => {
    const { limit, offset } = page(c);
    const rows = await c.get("ctx").db.all("SELECT id, name, aliases_json, phone, notes, created_at FROM clients WHERE merged_into_id IS NULL ORDER BY name LIMIT ? OFFSET ?", limit, offset);
    return c.json({ rows: rows.map((x) => ({ ...x, aliases: json(x.aliases_json, []) })) });
  });
  const ClientBody = z.object({ name: z.string().trim().min(2).max(120), aliases: z.array(z.string().trim().min(1)).max(10).default([]), phone: z.string().trim().max(40).nullable().default(null), notes: z.string().max(1000).nullable().default(null) });
  r.post("/clients", async (c) => {
    const ctx = c.get("ctx");
    const body = ClientBody.parse(await c.req.json());
    const id = newId();
    const now = nowIso(ctx);
    await ctx.db.batch([
      ctx.db.stmt("INSERT INTO clients (id, name, normalized_name, aliases_json, phone, notes, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", id, body.name, normalizePersonName(body.name), JSON.stringify(body.aliases.map((a) => normalizePersonName(a))), body.phone, body.notes, c.get("admin").id, now, now),
      auditStmt(ctx, c.get("admin").id, "client.create", "client", id, undefined, { name: body.name }),
    ]);
    return c.json({ id }, 201);
  });
  r.patch("/clients/:id", async (c) => {
    const ctx = c.get("ctx");
    const body = ClientBody.partial().parse(await c.req.json());
    const before = await ctx.db.first("SELECT name, aliases_json, notes FROM clients WHERE id = ?", c.req.param("id"));
    if (!before) throw new DomainError("NOT_FOUND", "Cliente não encontrado", 404);
    await ctx.db.run(
      "UPDATE clients SET name = COALESCE(?, name), normalized_name = COALESCE(?, normalized_name), aliases_json = COALESCE(?, aliases_json), phone = COALESCE(?, phone), notes = COALESCE(?, notes), updated_at = ? WHERE id = ?",
      body.name ?? null,
      body.name ? normalizePersonName(body.name) : null,
      body.aliases ? JSON.stringify(body.aliases.map((a) => normalizePersonName(a))) : null,
      body.phone ?? null,
      body.notes ?? null,
      nowIso(ctx),
      c.req.param("id"),
    );
    await audit(ctx, c.get("admin").id, "client.update", "client", c.req.param("id"), before, body);
    return c.json({ ok: true });
  });

  // ---------------- serviços (jobs)
  r.get("/jobs", async (c) => {
    const status = c.req.query("status");
    const statuses = status ? status.split(",").filter((s): s is (typeof JOB_STATUSES)[number] => (JOB_STATUSES as readonly string[]).includes(s)) : undefined;
    const jobs = await listJobs(c.get("ctx"), { ...(statuses ? { statuses } : {}), ...page(c) });
    // proposta mais recente que inclui o serviço (PDF de uma peça ou de várias): "Orçamento enviado · AP-…"
    const ctx = c.get("ctx");
    const proposals = await Promise.all(
      jobs.map((j) =>
        ctx.db.first<{ number: string }>(
          "SELECT s.number FROM quote_snapshots s WHERE EXISTS (SELECT 1 FROM quotes q WHERE q.job_id = ? AND s.snapshot_json LIKE '%' || q.id || '%') ORDER BY s.created_at DESC LIMIT 1",
          j.id,
        ),
      ),
    );
    return c.json({ rows: jobs.map((j, i) => ({ id: j.id, code: j.code, title: j.title, status: j.status, proposal: proposals[i]?.number ?? null, clientName: j.clientName, contractedCents: j.contractedCents, lastInteractionAt: j.lastInteractionAt, pending: j.pending, createdAt: j.createdAt })) });
  });
  r.post("/jobs", async (c) => {
    const body = z.object({ description: z.string().trim().min(3).max(1000) }).parse(await c.req.json());
    const job = await createJob(c.get("ctx"), { actor: c.get("admin").id, description: body.description });
    return c.json({ id: job.id, code: job.code }, 201);
  });
  r.get("/jobs/:id", async (c) => {
    const ctx = c.get("ctx");
    const job = await getJob(ctx, c.req.param("id"));
    if (!job) throw new DomainError("NOT_FOUND", "Serviço não encontrado", 404);
    const [facts, events, quotes, payments, purchases, expenses, subcontracts, attachments, messages, economics, balance, overrides, merges] = await Promise.all([
      ctx.db.all("SELECT field, value_json, status, source, change_kind, actor_id, created_at, superseded_at FROM job_facts WHERE job_id = ? ORDER BY created_at DESC", job.id),
      ctx.db.all("SELECT type, payload_json, actor_id, reason, created_at FROM job_events WHERE job_id = ? ORDER BY created_at DESC LIMIT 200", job.id),
      ctx.db.all("SELECT id, version, status, floor_cents, recommended_cents, final_price_cents, confidence, definitive_allowed, created_at, updated_at FROM quotes WHERE job_id = ? ORDER BY version DESC", job.id),
      ctx.db.all("SELECT id, amount_cents, kind, method, paid_at, reference FROM payments WHERE job_id = ? ORDER BY paid_at DESC", job.id),
      ctx.db.all("SELECT id, description, amount_cents, packages, quantity, purchased_at, voided_at FROM purchases WHERE job_id = ? ORDER BY purchased_at DESC", job.id),
      ctx.db.all("SELECT id, category, description, amount_cents, spent_at, voided_at FROM expenses WHERE job_id = ? ORDER BY spent_at DESC", job.id),
      ctx.db.all("SELECT * FROM subcontract_quotes WHERE job_id = ?", job.id),
      ctx.db.all("SELECT id, mime, size_bytes, classification, created_at FROM attachments WHERE job_id = ? AND deleted_at IS NULL", job.id),
      ctx.db.all("SELECT direction, kind, COALESCE(transcript, text) AS text, intent, created_at FROM conversation_messages WHERE job_id = ? ORDER BY created_at DESC LIMIT 100", job.id),
      jobEconomics(ctx, job.id),
      jobBalance(ctx, job.id),
      getOverrides(ctx, job.id),
      ctx.db.all("SELECT * FROM job_merges WHERE target_job_id = ? OR source_job_id = ? ORDER BY merged_at DESC", job.id, job.id),
    ]);
    return c.json({ job, summary: summarizeJob(job), facts, events, quotes, payments, purchases, expenses, subcontracts, attachments, messages, economics, balance, overrides, merges });
  });
  r.patch("/jobs/:id/facts", async (c) => {
    const body = z.object({ field: z.enum(PROJECT_FIELDS), value: z.unknown() }).parse(await c.req.json());
    const ctx = c.get("ctx");
    const job = await getJob(ctx, c.req.param("id"));
    if (!job) throw new DomainError("NOT_FOUND", "Serviço não encontrado", 404);
    await setFact(ctx, job.id, body.field as ProjectField, (body.value ?? null) as never, { actor: c.get("admin").id, source: "admin", correction: true, changeKind: "admin" });
    await audit(ctx, c.get("admin").id, "job.fact_admin", "job", job.id, job.facts[body.field as ProjectField]?.value ?? null, body);
    return c.json({ ok: true });
  });
  r.post("/jobs/:id/transition", async (c) => {
    const body = z.object({ to: z.enum(JOB_STATUSES), reason: z.string().max(500).optional() }).parse(await c.req.json());
    if (body.to === "MESCLADO") throw new DomainError("INVALID", "Use a função de mesclagem.", 422);
    const job = await transitionJob(c.get("ctx"), c.req.param("id"), body.to, c.get("admin").id, body.reason);
    return c.json({ status: job.status });
  });
  r.patch("/jobs/:id/pricing-overrides", async (c) => {
    const body = PricingOverridesSchema.parse(await c.req.json());
    await saveOverrides(c.get("ctx"), c.req.param("id"), body, c.get("admin").id);
    return c.json({ ok: true });
  });
  r.patch("/jobs/:id/due-date", async (c) => {
    const body = z.object({ dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable() }).parse(await c.req.json());
    const ctx = c.get("ctx");
    await ctx.db.run("UPDATE jobs SET due_date = ?, updated_at = ? WHERE id = ?", body.dueDate, nowIso(ctx), c.req.param("id"));
    await audit(ctx, c.get("admin").id, "job.due_date", "job", c.req.param("id"), undefined, body);
    return c.json({ ok: true });
  });

  // ---------------- financeiro por serviço (idempotente)
  const idem = (c: { req: { header: (k: string) => string | undefined } }) => c.req.header("Idempotency-Key")?.slice(0, 100);
  r.post("/jobs/:id/payments", async (c) => {
    const ctx = c.get("ctx");
    const body = z.object({ amountCents: cents, kind: z.enum(["ENTRADA", "PARCELA", "QUITACAO", "ESTORNO"]).optional(), method: z.string().max(40).nullable().default(null), reference: z.string().max(200).nullable().default(null) }).parse(await c.req.json());
    const key = idem(c) ?? (await financialIdempotencyKey(ctx, { userId: c.get("admin").id, kind: `payment-${body.kind ?? "auto"}`, amountCents: body.amountCents, jobId: c.req.param("id"), description: body.reference ?? "" }));
    const res = await recordPayment(ctx, { jobId: c.req.param("id"), ...body, actor: c.get("admin").id, idempotencyKey: key });
    return c.json({ ...res, balance: await jobBalance(ctx, c.req.param("id")) }, res.kind === "created" ? 201 : 200);
  });
  r.post("/jobs/:id/purchases", async (c) => {
    const ctx = c.get("ctx");
    const body = z.object({ materialId: z.string().nullable().default(null), description: z.string().trim().min(2).max(200), amountCents: cents, packages: z.number().int().positive().nullable().default(null), supplierId: z.string().nullable().default(null) }).parse(await c.req.json());
    const jobId = c.req.param("id") === "geral" ? null : c.req.param("id");
    const key = idem(c) ?? (await financialIdempotencyKey(ctx, { userId: c.get("admin").id, kind: "purchase", amountCents: body.amountCents, jobId, description: body.description }));
    const res = await recordPurchase(ctx, { ...body, jobId, actor: c.get("admin").id, idempotencyKey: key });
    return c.json(res, res.kind === "created" ? 201 : 200);
  });
  r.post("/jobs/:id/expenses", async (c) => {
    const ctx = c.get("ctx");
    const body = z.object({ category: z.enum(["transporte", "embalagem", "estacionamento", "outros"]), description: z.string().trim().min(2).max(200), amountCents: cents }).parse(await c.req.json());
    const jobId = c.req.param("id") === "geral" ? null : c.req.param("id");
    const key = idem(c) ?? (await financialIdempotencyKey(ctx, { userId: c.get("admin").id, kind: "expense", amountCents: body.amountCents, jobId, description: body.description }));
    const res = await recordExpense(ctx, { ...body, jobId, actor: c.get("admin").id, idempotencyKey: key });
    return c.json(res, res.kind === "created" ? 201 : 200);
  });
  r.post("/jobs/:id/consumptions", async (c) => {
    const ctx = c.get("ctx");
    const body = z.object({ materialId: z.string(), quantity: decStr, source: z.enum(["ESTOQUE", "COMPRA", "MISTO"]) }).parse(await c.req.json());
    const mat = await getMaterial(ctx, body.materialId);
    if (!mat) throw new DomainError("NOT_FOUND", "Material não encontrado", 404);
    if (mat.replacementPriceCents === null) throw new DomainError("PRICE_MISSING", "Cadastre o preço de reposição antes de registrar consumo (nunca custo zero).", 422);
    const unit = (mat.replacementPriceCents / Number(mat.packageSize)).toFixed(4);
    await recordConsumption(ctx, { jobId: c.req.param("id"), quoteId: null, materialId: mat.id, quantity: body.quantity, replacementUnitCostCents: unit, source: body.source, actor: c.get("admin").id });
    await audit(ctx, c.get("admin").id, "consumption.create", "job", c.req.param("id"), undefined, body);
    return c.json({ ok: true }, 201);
  });
  r.post("/jobs/:id/time-entries", async (c) => {
    const ctx = c.get("ctx");
    const body = z.object({ hours: decStr, workDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), note: z.string().max(300).nullable().default(null) }).parse(await c.req.json());
    const id = newId();
    await ctx.db.run("INSERT INTO time_entries (id, job_id, hours, work_date, note, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)", id, c.req.param("id"), body.hours, body.workDate, body.note, c.get("admin").id, nowIso(ctx));
    await audit(ctx, c.get("admin").id, "time_entry.create", "job", c.req.param("id"), undefined, body);
    return c.json({ id }, 201);
  });
  r.post("/jobs/:id/subcontracts", async (c) => {
    const ctx = c.get("ctx");
    const body = z.object({ supplierId: z.string().nullable().default(null), scope: z.string().trim().min(2).max(300), costCents: z.number().int().nonnegative().nullable(), logisticsCents: z.number().int().nonnegative().default(0), leadDays: z.number().int().nonnegative().nullable().default(null), confirmed: z.boolean(), validUntil: z.string().nullable().default(null) }).parse(await c.req.json());
    if (body.confirmed && body.costCents === null) throw new DomainError("INVALID", "Cotação confirmada precisa de valor.", 422);
    const id = newId();
    const now = nowIso(ctx);
    await ctx.db.run(
      "INSERT INTO subcontract_quotes (id, job_id, supplier_id, scope, cost_cents, logistics_cents, lead_days, confirmed, valid_until, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      id,
      c.req.param("id"),
      body.supplierId,
      body.scope,
      body.costCents,
      body.logisticsCents,
      body.leadDays,
      body.confirmed ? 1 : 0,
      body.validUntil,
      now,
      now,
    );
    await audit(ctx, c.get("admin").id, "subcontract.create", "job", c.req.param("id"), undefined, body);
    return c.json({ id }, 201);
  });

  // ---------------- orçamentos
  // propostas (AP-…): uma linha por PDF comercial, com as peças; a mais nova que inclui uma peça substitui as anteriores
  r.get("/proposals", async (c) => {
    const ctx = c.get("ctx");
    const rows = await ctx.db.all<{ id: string; number: string; doc_version: number; created_at: string; snapshot_json: string; quote_id: string; doc_id: string | null }>(
      "SELECT s.id, s.number, s.doc_version, s.created_at, s.snapshot_json, s.quote_id, d.id AS doc_id FROM quote_snapshots s LEFT JOIN quote_documents d ON d.snapshot_id = s.id AND d.kind = 'COMERCIAL' ORDER BY s.created_at DESC LIMIT 100",
    );
    const quoteJobs = new Map((await ctx.db.all<{ id: string; job_id: string; status: string }>("SELECT id, job_id, status FROM quotes")).map((q) => [q.id, q]));
    const seenJobs = new Set<string>();
    const out = rows.map((r) => {
      const snap = JSON.parse(r.snapshot_json) as { quoteId?: string; quoteIds?: string[]; commercial?: { client?: { name?: string }; furniture?: { description?: string }; items?: { title: string; amountCents: number }[]; totalCents?: number; deadlineText?: string; preliminary?: boolean } };
      const qids = snap.quoteIds ?? [snap.quoteId ?? r.quote_id];
      const jobIds = [...new Set(qids.map((q) => quoteJobs.get(q)?.job_id).filter((x): x is string => !!x))];
      const superseded = jobIds.length > 0 && jobIds.every((j) => seenJobs.has(j));
      for (const j of jobIds) seenJobs.add(j);
      const statuses = qids.map((q) => quoteJobs.get(q)?.status ?? "");
      const outcome = statuses.every((s) => s === "ACEITO") ? "aceita" : statuses.some((s) => s === "RECUSADO") ? "recusada" : "enviada";
      const cm = snap.commercial ?? {};
      return {
        id: r.id,
        number: r.number,
        version: r.doc_version,
        createdAt: r.created_at,
        documentId: r.doc_id,
        client: cm.client?.name ?? "—",
        pieces: cm.items?.length ? cm.items.map((i) => i.title) : [cm.furniture?.description?.split(" — ")[0] ?? "—"],
        totalCents: cm.totalCents ?? null,
        deadline: cm.deadlineText ?? null,
        preliminary: !!cm.preliminary,
        situation: superseded ? "substituída" : outcome,
      };
    });
    return c.json({ rows: out });
  });
  r.get("/quotes", async (c) => {
    const status = c.req.query("status");
    const s = status && (QUOTE_STATUSES as readonly string[]).includes(status) ? (status as (typeof QUOTE_STATUSES)[number]) : undefined;
    const rows = await listQuotes(c.get("ctx"), s);
    return c.json({ rows: rows.map((q) => ({ id: q.id, jobId: q.jobId, jobCode: q.jobCode, jobTitle: q.jobTitle, version: q.version, status: q.status, floorCents: q.floorCents, recommendedCents: q.recommendedCents, finalPriceCents: q.finalPriceCents, confidence: q.confidence, definitiveAllowed: q.definitiveAllowed, blockers: q.result.blockers.length, updatedAt: q.updatedAt })) });
  });
  r.post("/quotes/draft", async (c) => {
    const body = z.object({ jobId: z.string() }).parse(await c.req.json());
    const q = await calculateQuote(c.get("ctx"), body.jobId, c.get("admin").id);
    return c.json({ id: q.id }, 201);
  });
  r.get("/quotes/:id", async (c) => {
    const q = await getQuote(c.get("ctx"), c.req.param("id"));
    if (!q) throw new DomainError("NOT_FOUND", "Orçamento não encontrado", 404);
    return c.json({ quote: q });
  });
  r.get("/quotes/:id/internal", async (c) => {
    const q = await getQuote(c.get("ctx"), c.req.param("id"));
    if (!q) throw new DomainError("NOT_FOUND", "Orçamento não encontrado", 404);
    return c.json({ result: q.result, input: q.input });
  });
  r.post("/quotes/:id/recalculate", async (c) => {
    const q = await getQuote(c.get("ctx"), c.req.param("id"));
    if (!q) throw new DomainError("NOT_FOUND", "Orçamento não encontrado", 404);
    const body = z.object({ proposedPriceCents: cents.nullable().default(null) }).parse(await c.req.json().catch(() => ({})));
    const nq = await calculateQuote(c.get("ctx"), q.jobId, c.get("admin").id, { proposedPriceCents: body.proposedPriceCents });
    return c.json({ id: nq.id, version: nq.version });
  });
  r.post("/quotes/:id/submit-review", async (c) => {
    const q = await submitForReview(c.get("ctx"), c.req.param("id"), c.get("admin").id);
    return c.json({ status: q.status });
  });
  r.post("/quotes/:id/approve", async (c) => {
    const q = await approveQuote(c.get("ctx"), c.req.param("id"), c.get("admin").id, await c.req.json());
    return c.json({ status: q.status, finalPriceCents: q.finalPriceCents, id: q.id });
  });
  r.post("/quotes/:id/issue", async (c) => {
    const body = z.object({ preliminary: z.boolean().default(false) }).parse(await c.req.json().catch(() => ({})));
    const docs = await issueDocuments(c.get("ctx"), c.req.param("id"), c.get("admin").id, body);
    return c.json({ commercial: stripKey(docs.commercial), internal: stripKey(docs.internal) }, 201);
  });
  r.get("/quotes/:id/documents", async (c) => {
    const docs = await listDocuments(c.get("ctx"), c.req.param("id"), true);
    return c.json({ rows: docs.map(stripKey) });
  });
  r.post("/quotes/:id/send-to-artisan", async (c) => {
    const ctx = c.get("ctx");
    const body = z.object({ documentId: z.string(), artisanUserId: z.string() }).parse(await c.req.json());
    const artisan = await ctx.db.first<{ telegram_chat_id: string | null }>("SELECT telegram_chat_id FROM users WHERE id = ? AND role = 'ARTESAO' AND active = 1", body.artisanUserId);
    if (!artisan?.telegram_chat_id) throw new DomainError("NO_CHAT", "O artesão ainda não iniciou conversa com o bot.", 422);
    await sendDocumentToArtisan(ctx, body.documentId, c.get("admin").id, artisan.telegram_chat_id);
    return c.json({ ok: true });
  });
  r.post("/quotes/:id/outcome", async (c) => {
    const body = z.object({ outcome: z.enum(["ACEITO", "RECUSADO"]) }).parse(await c.req.json());
    const q = await markQuoteOutcome(c.get("ctx"), c.req.param("id"), c.get("admin").id, body.outcome);
    return c.json({ status: q.status });
  });
  r.get("/documents/:id/download", async (c) => {
    const ctx = c.get("ctx");
    const doc = await getDocument(ctx, c.req.param("id"));
    if (!doc) throw new DomainError("NOT_FOUND", "Documento não encontrado", 404);
    const obj = await ctx.storage.get(doc.r2Key);
    if (!obj) throw new DomainError("NOT_FOUND", "Arquivo não encontrado", 404);
    await audit(ctx, c.get("admin").id, "document.download", "quote_document", doc.id);
    return new Response(await obj.arrayBuffer(), {
      headers: { "content-type": "application/pdf", "content-disposition": `attachment; filename="${doc.filename}"`, "cache-control": "private, no-store" },
    });
  });

  // ---------------- catálogo, estoque, fornecedores
  r.get("/materials", async (c) => c.json({ rows: await listMaterials(c.get("ctx")) }));
  const MaterialBody = z.object({
    key: z.string().regex(/^[a-z0-9_]{2,40}$/),
    name: z.string().trim().min(2).max(120),
    category: z.string().max(60).nullable().default(null),
    unit: z.string().min(1).max(10),
    packageSize: decStr,
    replacementPriceCents: cents.nullable(),
    yieldM2PerUnitPerCoat: decStr.nullable(),
    lossPct: decStr,
    calibrated: z.boolean(),
    minStock: decStr.nullable().default(null),
    active: z.boolean().default(true),
  });
  r.post("/materials", async (c) => {
    const ctx = c.get("ctx");
    const b = MaterialBody.parse(await c.req.json());
    const id = newId();
    const now = nowIso(ctx);
    await ctx.db.batch([
      ctx.db.stmt(
        "INSERT INTO materials (id, key, name, category, base_unit, package_size, replacement_price_cents, price_updated_at, yield_m2_per_unit_per_coat, loss_pct, calibrated, origin, min_stock, active, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'admin', ?, ?, ?)",
        id,
        b.key,
        b.name,
        b.category,
        b.unit,
        b.packageSize,
        b.replacementPriceCents,
        b.replacementPriceCents ? now : null,
        b.yieldM2PerUnitPerCoat,
        b.lossPct,
        b.calibrated ? 1 : 0,
        b.minStock,
        b.active ? 1 : 0,
        now,
      ),
      auditStmt(ctx, c.get("admin").id, "material.create", "material", id, undefined, b),
    ]);
    return c.json({ id }, 201);
  });
  r.patch("/materials/:id", async (c) => {
    const ctx = c.get("ctx");
    const b = MaterialBody.partial().omit({ key: true }).parse(await c.req.json());
    const before = await getMaterial(ctx, c.req.param("id"));
    if (!before) throw new DomainError("NOT_FOUND", "Material não encontrado", 404);
    const now = nowIso(ctx);
    const priceChanged = b.replacementPriceCents !== undefined && b.replacementPriceCents !== before.replacementPriceCents;
    const stmts = [
      ctx.db.stmt(
        `UPDATE materials SET name = COALESCE(?, name), category = COALESCE(?, category), base_unit = COALESCE(?, base_unit), package_size = COALESCE(?, package_size),
          replacement_price_cents = CASE WHEN ? = 1 THEN ? ELSE replacement_price_cents END,
          price_updated_at = CASE WHEN ? = 1 THEN ? ELSE price_updated_at END,
          yield_m2_per_unit_per_coat = CASE WHEN ? = 1 THEN ? ELSE yield_m2_per_unit_per_coat END,
          loss_pct = COALESCE(?, loss_pct), calibrated = COALESCE(?, calibrated), min_stock = COALESCE(?, min_stock), active = COALESCE(?, active), origin = 'admin', updated_at = ? WHERE id = ?`,
        b.name ?? null,
        b.category ?? null,
        b.unit ?? null,
        b.packageSize ?? null,
        b.replacementPriceCents !== undefined ? 1 : 0,
        b.replacementPriceCents ?? null,
        b.replacementPriceCents !== undefined ? 1 : 0,
        b.replacementPriceCents !== undefined ? now : null,
        b.yieldM2PerUnitPerCoat !== undefined ? 1 : 0,
        b.yieldM2PerUnitPerCoat ?? null,
        b.lossPct ?? null,
        b.calibrated === undefined ? null : b.calibrated ? 1 : 0,
        b.minStock ?? null,
        b.active === undefined ? null : b.active ? 1 : 0,
        now,
        before.id,
      ),
      auditStmt(ctx, c.get("admin").id, "material.update", "material", before.id, before, b),
    ];
    if (priceChanged && b.replacementPriceCents) {
      stmts.push(ctx.db.stmt("INSERT INTO material_price_history (id, material_id, price_cents, source, recorded_by, recorded_at) VALUES (?, ?, ?, 'admin', ?, ?)", newId(), before.id, b.replacementPriceCents, c.get("admin").id, now));
    }
    await ctx.db.batch(stmts);
    return c.json({ ok: true });
  });
  r.get("/materials/:id/price-history", async (c) => c.json({ rows: await c.get("ctx").db.all("SELECT price_cents, source, recorded_at FROM material_price_history WHERE material_id = ? ORDER BY recorded_at DESC", c.req.param("id")) }));
  r.get("/inventory", async (c) => c.json({ rows: await getInventory(c.get("ctx")) }));
  r.post("/inventory/movements", async (c) => {
    const ctx = c.get("ctx");
    const b = z
      .object({ materialId: z.string(), kind: z.enum(["ENTRADA", "AJUSTE"]), quantity: z.string().regex(/^-?\d+(\.\d+)?$/), historicalUnitCostCents: decStr.nullable().default(null), condition: z.string().max(100).nullable().default(null), note: z.string().max(300).nullable().default(null) })
      .parse(await c.req.json());
    if (b.kind === "ENTRADA" && b.quantity.startsWith("-")) throw new DomainError("INVALID", "Entrada deve ser positiva.", 422);
    const id = newId();
    await ctx.db.batch([
      ctx.db.stmt("INSERT INTO stock_movements (id, material_id, kind, quantity, historical_unit_cost_cents, condition, note, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", id, b.materialId, b.kind, b.quantity, b.historicalUnitCostCents, b.condition, b.note, c.get("admin").id, nowIso(ctx)),
      auditStmt(ctx, c.get("admin").id, "stock.movement", "material", b.materialId, undefined, b),
    ]);
    return c.json({ id }, 201);
  });
  r.get("/techniques", async (c) => c.json({ rows: await listTechniques(c.get("ctx")) }));
  r.patch("/techniques/:id", async (c) => {
    const ctx = c.get("ctx");
    const b = z.object({ name: z.string().min(2).optional(), steps: z.array(RecipeStepSchema).optional(), calibrated: z.boolean().optional() }).parse(await c.req.json());
    const before = await ctx.db.first("SELECT name, recipe_json, calibrated, version FROM techniques WHERE id = ?", c.req.param("id"));
    if (!before) throw new DomainError("NOT_FOUND", "Técnica não encontrada", 404);
    const now = nowIso(ctx);
    await ctx.db.batch([
      ctx.db.stmt(
        "UPDATE techniques SET name = COALESCE(?, name), recipe_json = COALESCE(?, recipe_json), calibrated = COALESCE(?, calibrated), version = version + 1, origin = 'admin', reviewed_by = ?, reviewed_at = ?, updated_at = ? WHERE id = ?",
        b.name ?? null,
        b.steps ? JSON.stringify(b.steps) : null,
        b.calibrated === undefined ? null : b.calibrated ? 1 : 0,
        c.get("admin").id,
        now,
        now,
        c.req.param("id"),
      ),
      auditStmt(ctx, c.get("admin").id, "technique.update", "technique", c.req.param("id"), before, b),
    ]);
    return c.json({ ok: true });
  });
  r.get("/methods", async (c) => c.json({ rows: await listMethods(c.get("ctx")) }));
  r.patch("/methods/:id", async (c) => {
    const ctx = c.get("ctx");
    const b = z.object({ speedM2PerHour: decStr.optional(), lossPct: decStr.optional(), setupHours: decStr.optional(), cleanupHours: decStr.optional(), calibrated: z.boolean().optional() }).parse(await c.req.json());
    if (b.lossPct && Number(b.lossPct) >= 100) throw new DomainError("INVALID", "Perda deve ser menor que 100%.", 422);
    if (b.speedM2PerHour && Number(b.speedM2PerHour) <= 0) throw new DomainError("INVALID", "Velocidade deve ser positiva.", 422);
    const before = await ctx.db.first("SELECT * FROM application_methods WHERE id = ?", c.req.param("id"));
    if (!before) throw new DomainError("NOT_FOUND", "Método não encontrado", 404);
    await ctx.db.batch([
      ctx.db.stmt(
        "UPDATE application_methods SET speed_m2_per_hour = COALESCE(?, speed_m2_per_hour), loss_pct = COALESCE(?, loss_pct), setup_hours = COALESCE(?, setup_hours), cleanup_hours = COALESCE(?, cleanup_hours), calibrated = COALESCE(?, calibrated), origin = 'admin', updated_at = ? WHERE id = ?",
        b.speedM2PerHour ?? null,
        b.lossPct ?? null,
        b.setupHours ?? null,
        b.cleanupHours ?? null,
        b.calibrated === undefined ? null : b.calibrated ? 1 : 0,
        nowIso(ctx),
        c.req.param("id"),
      ),
      auditStmt(ctx, c.get("admin").id, "method.update", "application_method", c.req.param("id"), before, b),
    ]);
    return c.json({ ok: true });
  });
  r.get("/suppliers", async (c) => c.json({ rows: await c.get("ctx").db.all("SELECT * FROM suppliers ORDER BY name") }));
  r.post("/suppliers", async (c) => {
    const ctx = c.get("ctx");
    const b = z.object({ name: z.string().trim().min(2).max(120), kind: z.string().max(60).nullable().default(null), contact: z.string().max(200).nullable().default(null), notes: z.string().max(1000).nullable().default(null) }).parse(await c.req.json());
    const id = newId();
    await ctx.db.run("INSERT INTO suppliers (id, name, kind, contact, notes, created_at) VALUES (?, ?, ?, ?, ?, ?)", id, b.name, b.kind, b.contact, b.notes, nowIso(ctx));
    await audit(ctx, c.get("admin").id, "supplier.create", "supplier", id, undefined, { name: b.name });
    return c.json({ id }, 201);
  });

  // ---------------- configurações
  r.get("/settings", async (c) => c.json(await getActiveSettings(c.get("ctx"))));
  r.patch("/settings", async (c) => {
    const ctx = c.get("ctx");
    const current = await getActiveSettings(ctx);
    const b = z.object({ params: PricingSettingsSchema.partial().optional(), business: BusinessSchema.partial().optional() }).parse(await c.req.json());
    const params = PricingSettingsSchema.parse({ ...current.params, ...(b.params ?? {}) });
    if (Number(params.taxRatePct) >= 100 || Number(params.productivityPct) <= 0 || Number(params.productivityPct) > 100) throw new DomainError("INVALID", "Percentuais fora do intervalo permitido.", 422);
    const id = await saveSettingsVersion(ctx, c.get("admin").id, params, BusinessSchema.parse({ ...current.business, ...(b.business ?? {}) }), "admin");
    return c.json({ id });
  });
  r.get("/settings/history", async (c) => c.json({ rows: await c.get("ctx").db.all("SELECT id, params_json, effective_from, origin, approved_by, is_active, created_at FROM settings_versions ORDER BY created_at DESC LIMIT 100") }));

  // ---------------- duplicidades
  r.get("/duplicates", async (c) => c.json({ rows: (await listSuspicions(c.get("ctx"), c.req.query("status") ?? "ABERTA")).map((d) => ({ ...d, reasons: json(d.reasons_json, []) })) }));
  r.post("/duplicates/scan", async (c) => c.json({ found: await scanForDuplicates(c.get("ctx")) }));
  r.post("/duplicates/:id/distinct", async (c) => {
    await markDistinct(c.get("ctx"), c.req.param("id"), c.get("admin").id);
    return c.json({ ok: true });
  });
  r.post("/duplicates/merge", async (c) => {
    const b = z.object({ sourceJobId: z.string(), targetJobId: z.string(), reason: z.string().trim().min(3).max(500) }).parse(await c.req.json());
    const id = await mergeJobs(c.get("ctx"), b.sourceJobId, b.targetJobId, c.get("admin").id, b.reason);
    return c.json({ mergeId: id }, 201);
  });
  r.get("/merges", async (c) => c.json({ rows: await c.get("ctx").db.all("SELECT m.*, s.code AS source_code, t.code AS target_code FROM job_merges m JOIN jobs s ON s.id = m.source_job_id JOIN jobs t ON t.id = m.target_job_id ORDER BY merged_at DESC LIMIT 100") }));
  r.post("/merges/:id/undo", async (c) => {
    await undoMerge(c.get("ctx"), c.req.param("id"), c.get("admin").id);
    return c.json({ ok: true });
  });

  // ---------------- aprovações, auditoria, IA, usuários
  r.get("/approvals", async (c) => c.json({ rows: await c.get("ctx").db.all("SELECT * FROM approval_requests ORDER BY created_at DESC LIMIT 200") }));
  r.get("/audit-events", async (c) => {
    const { limit, offset } = page(c);
    const entity = c.req.query("entityId");
    const rows = entity
      ? await c.get("ctx").db.all("SELECT * FROM audit_events WHERE entity_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?", entity, limit, offset)
      : await c.get("ctx").db.all("SELECT * FROM audit_events ORDER BY created_at DESC LIMIT ? OFFSET ?", limit, offset);
    return c.json({ rows });
  });
  r.get("/ai-usage", async (c) => {
    const ctx = c.get("ctx");
    const since = new Date(ctx.clock().getTime() - 30 * 86_400_000).toISOString();
    const rows = await ctx.db.all(
      "SELECT substr(created_at,1,10) AS day, task, model, COUNT(*) AS requests, SUM(success) AS ok, ROUND(SUM(COALESCE(estimated_neurons,0)),2) AS neurons, SUM(COALESCE(estimated_cost_usd_micros,0)) AS cost_usd_micros FROM ai_usage WHERE created_at >= ? GROUP BY day, task, model ORDER BY day DESC",
      since,
    );
    return c.json({ rows, dailyLimit: ctx.config.aiDailyRequestLimit, aiEnabled: ctx.config.aiEnabled, note: "Estimativas locais. O teto interno não garante limite na fatura Cloudflare." });
  });
  // decisões recentes da IA (objetivo, schema, fallback, confiança, decisão) — sem prompts nem segredos
  r.get("/ai-decisions", async (c) => {
    const ctx = c.get("ctx");
    const limit = Math.min(200, Math.max(1, Number(c.req.query("limit") ?? 50) || 50));
    try {
      const rows = await ctx.db.all(
        "SELECT created_at, purpose, schema_name, model, success, fallback_used, confidence, latency_ms, decision_json, error_code, correlation_id FROM ai_usage WHERE purpose IS NOT NULL ORDER BY created_at DESC LIMIT ?",
        limit,
      );
      return c.json({ rows: rows.map((r) => ({ ...r, decision: json((r as { decision_json?: string }).decision_json, null) })) });
    } catch {
      return c.json({ rows: [], note: "Migration 0006 ainda não aplicada." });
    }
  });

  // ---------------------------------------------------------------- catálogo mestre de móveis
  r.get("/furniture-types", async (c) => {
    const ctx = c.get("ctx");
    const cat = await loadFurnitureCatalog(ctx);
    const q = normalizeText(c.req.query("q") ?? "");
    const category = c.req.query("category") ?? "";
    const active = c.req.query("active");
    const rows = cat.types
      .filter((t) => !category || t.category === category)
      .filter((t) => active === undefined || active === "" || (active === "1") === (t.active !== false))
      .filter((t) => !q || normalizeText(`${t.name} ${t.key} ${t.aliases.join(" ")}`).includes(q))
      .map((t) => ({ ...t, active: t.active !== false, sourceKind: CATALOG_SOURCES.find((s) => s.key === t.sourceKey)?.kind ?? null }));
    return c.json({ rows, source: cat.source, total: cat.types.length, sources: CATALOG_SOURCES });
  });
  r.get("/furniture-types/:key", async (c) => {
    const ctx = c.get("ctx");
    const cat = await loadFurnitureCatalog(ctx);
    const t = cat.types.find((x) => x.key === c.req.param("key"));
    if (!t) throw new DomainError("NOT_FOUND", "Tipo de móvel não encontrado", 404);
    const parts = t.parts.map((k) => PARTS.find((p) => p.key === k) ?? { key: k, label: k, variants: [], measurable: false });
    return c.json({ ...t, active: t.active !== false, partsDetail: parts, source: CATALOG_SOURCES.find((s) => s.key === t.sourceKey) ?? null });
  });
  const FurnitureTypePatchBody = z.object({
    displayName: z.string().min(2).max(80).optional(),
    category: z.enum(["quarto", "jantar", "estar", "escritorio", "cozinha", "banheiro", "externo", "infantil", "antigo", "outro"]).optional(),
    description: z.string().max(500).optional(),
    active: z.boolean().optional(),
    dimensionPolicy: z.enum(["market_reference", "usual_range", "variable", "custom"]).optional(),
    measurementSchema: z.enum(["width_length", "length_width_height", "diameter_height", "side_height", "width_depth_height", "width_height", "length_depth_thickness", "open_closed", "two_sides_depth", "per_module", "unknown"]).optional(),
    typicalRanges: z.record(z.enum(["widthCm", "lengthCm", "depthCm", "heightCm", "diameterCm"]), z.object({ min: z.number().int().min(1).max(1000), max: z.number().int().min(1).max(1000) }).refine((r) => r.max >= r.min, "faixa inválida")).optional(),
    requiredQuoteFields: z.array(z.string().max(40)).max(20).optional(),
    optionalQuoteFields: z.array(z.string().max(40)).max(20).optional(),
    hasInterior: z.boolean().optional(),
    outdoor: z.boolean().optional(),
  });
  r.patch("/furniture-types/:key", async (c) => {
    const ctx = c.get("ctx");
    const b = FurnitureTypePatchBody.parse(await c.req.json());
    const ok = await updateFurnitureType(ctx, c.req.param("key"), b as FurnitureTypePatch, c.get("admin").id);
    if (!ok) throw new DomainError("NOT_FOUND", "Tipo de móvel não encontrado", 404);
    return c.json({ ok: true });
  });
  r.post("/furniture-types", async (c) => {
    const ctx = c.get("ctx");
    const b = z
      .object({
        key: z.string().regex(/^[a-z][a-z0-9_]{2,59}$/, "use letras minúsculas, números e _"),
        displayName: z.string().min(2).max(80),
        category: FurnitureTypePatchBody.shape.category.unwrap(),
        feminine: z.boolean().optional(),
        legacyKey: z.string().max(40).nullable().optional(),
        measurementSchema: FurnitureTypePatchBody.shape.measurementSchema.unwrap().optional(),
        aliases: z.array(z.string().min(2).max(60)).max(30).optional(),
      })
      .parse(await c.req.json());
    const r2 = await createFurnitureType(ctx, b, c.get("admin").id);
    if (r2 === "exists") throw new DomainError("CONFLICT", "Já existe um tipo com essa chave", 409);
    return c.json({ ok: true }, 201);
  });
  r.post("/furniture-types/:key/aliases", async (c) => {
    const ctx = c.get("ctx");
    const b = z.object({ alias: z.string().min(2).max(60) }).parse(await c.req.json());
    const res = await addFurnitureAlias(ctx, c.req.param("key"), b.alias, c.get("admin").id);
    if (res === "not_found") throw new DomainError("NOT_FOUND", "Tipo de móvel não encontrado", 404);
    return c.json({ result: res }, res === "added" ? 201 : 200);
  });
  r.post("/furniture-types/:key/aliases/deactivate", async (c) => {
    const ctx = c.get("ctx");
    const b = z.object({ alias: z.string().min(1).max(60) }).parse(await c.req.json());
    return c.json({ ok: await setFurnitureAliasActive(ctx, c.req.param("key"), b.alias, false, c.get("admin").id) });
  });
  r.post("/furniture-types/sync", async (c) => c.json(await syncFurnitureCatalog(c.get("ctx"))));

  r.get("/access-requests", async (c) => c.json({ rows: await listAccessRequests(c.get("ctx"), c.req.query("status") ?? "PENDENTE") }));
  r.post("/access-requests/:id/approve", async (c) => c.json(await approveAccessRequest(c.get("ctx"), c.req.param("id"), c.get("admin").id, await c.req.json()), 201));
  r.post("/access-requests/:id/reject", async (c) => {
    await rejectAccessRequest(c.get("ctx"), c.req.param("id"), c.get("admin").id);
    return c.json({ ok: true });
  });
  r.get("/users", async (c) => c.json({ rows: await listUsers(c.get("ctx")) }));
  r.post("/users", async (c) => {
    const ctx = c.get("ctx");
    const b = z
      .object({ role: z.enum(["ARTESAO", "ADMIN"]), displayName: z.string().trim().min(2).max(60), telegramUserId: z.string().regex(/^\d{3,20}$/).nullable().default(null), adminEmail: z.string().email().nullable().default(null) })
      .parse(await c.req.json());
    const id = await createUser(ctx, b);
    await audit(ctx, c.get("admin").id, "user.create", "user", id, undefined, { role: b.role, displayName: b.displayName });
    return c.json({ id }, 201);
  });
  r.patch("/users/:id", async (c) => {
    const ctx = c.get("ctx");
    const b = z.object({ active: z.boolean().optional(), displayName: z.string().trim().min(2).max(60).optional(), telegramUserId: z.string().regex(/^\d{3,20}$/).nullable().optional() }).parse(await c.req.json());
    if (c.req.param("id") === c.get("admin").id && b.active === false) throw new DomainError("INVALID", "Você não pode desativar a si mesmo.", 422);
    await ctx.db.run(
      "UPDATE users SET active = COALESCE(?, active), display_name = COALESCE(?, display_name), telegram_user_id = CASE WHEN ? = 1 THEN ? ELSE telegram_user_id END, updated_at = ? WHERE id = ?",
      b.active === undefined ? null : b.active ? 1 : 0,
      b.displayName ?? null,
      b.telegramUserId !== undefined ? 1 : 0,
      b.telegramUserId ?? null,
      nowIso(ctx),
      c.req.param("id"),
    );
    await audit(ctx, c.get("admin").id, "user.update", "user", c.req.param("id"), undefined, b);
    return c.json({ ok: true });
  });

  registerProactiveRoutes(r);

  return r;
}

function stripKey<T extends { r2Key: string }>(d: T): Omit<T, "r2Key"> {
  // nunca expor a chave interna do R2 no painel
  const { r2Key: _r2Key, ...rest } = d;
  return rest;
}

function csv(c: { body: (data: string, status: number, headers: Record<string, string>) => Response }, filename: string, rows: object[]): Response {
  return c.body("﻿" + toCsv(rows as Record<string, unknown>[]), 200, { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${filename}"` });
}
