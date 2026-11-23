import type { Hono } from "hono";
import { z } from "zod";
import { GATE_LABEL, KIND_GROUP, NEED_KINDS, type NeedKind } from "@adripatina/conversations";
import { formatDateBR } from "@adripatina/shared";
import { humanizeCallback } from "../conversation/callbacks.js";
import type { AppEnv } from "../app.js";
import { nowIso } from "../context.js";
import { json } from "../db/sql.js";
import { audit } from "../repos/audit.js";
import { DomainError } from "../services/quotes.js";
import { runProactiveCollection, releaseSessionIfPointing } from "../services/proactive/job.js";
import { addEvent, EVENT_LABEL, getRequest, OPEN_STATUSES, updateRequest, type EventKind, type RequestRow, type RequestStatus } from "../services/proactive/repo.js";
import { getProactiveSettings, saveProactiveSettings } from "../services/proactive/settings.js";

/** Painel: visibilidade, auditoria e intervenção excepcional na coleta proativa. */

export const STATUS_LABEL: Record<RequestStatus, string> = {
  identified: "Identificada",
  queued: "Na fila",
  sent: "Enviada",
  waiting_response: "Aguardando resposta",
  partially_answered: "Respondida em parte",
  waiting_confirmation: "Aguardando confirmação",
  resolved: "Concluída",
  snoozed: "Adiada",
  expired: "Expirada",
  cancelled: "Cancelada",
  failed: "Falhou (nova tentativa agendada)",
};

export const KIND_LABEL: Record<NeedKind, string> = {
  material_price: "Preço de material",
  material_package_size: "Tamanho da embalagem",
  stock_level: "Estoque",
  job_actual_hours: "Horas reais de trabalho concluído",
  job_materials_used: "Material usado em trabalho concluído",
  technique_coats: "Demãos da técnica",
};

const br = (iso: string | null | undefined) => (iso ? formatDateBR(iso) : null);

function present(r: RequestRow & { display_name?: string | null }) {
  return {
    ...r,
    fields: json<string[]>(r.fields_json, []),
    priority_reasons: json<string[]>(r.priority_reasons_json, []),
    partial: json<Record<string, unknown>>(r.partial_json, {}),
    result: json<unknown>(r.result_json, null),
    status_label: STATUS_LABEL[r.status] ?? r.status,
    kind_label: KIND_LABEL[r.need_kind] ?? r.need_kind,
    created_at_br: br(r.created_at),
    last_sent_at_br: br(r.last_sent_at),
    next_allowed_at_br: br(r.next_allowed_at),
    resolved_at_br: br(r.resolved_at),
  };
}

const dateParam = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional();

export function registerProactiveRoutes(r: Hono<AppEnv>): void {
  r.get("/proactive/requests", async (c) => {
    const q = z
      .object({
        status: z.string().optional(),
        kind: z.enum(NEED_KINDS as [NeedKind, ...NeedKind[]]).optional(),
        userId: z.string().optional(),
        entity: z.string().max(80).optional(),
        from: dateParam,
        to: dateParam,
        pending: z.enum(["1", "0"]).optional(),
        minPriority: z.coerce.number().optional(),
        limit: z.coerce.number().int().min(1).max(500).default(100),
      })
      .parse(Object.fromEntries(Object.entries(c.req.queries()).map(([k, v]) => [k, v[0] || undefined])));
    const statuses = q.pending === "1" ? [...OPEN_STATUSES] : q.status ? q.status.split(",").filter((s) => s in STATUS_LABEL) : [];
    const rows = await c.get("ctx").db.all<RequestRow & { display_name: string | null }>(
      `SELECT r.*, u.display_name FROM data_collection_requests r LEFT JOIN users u ON u.id = r.user_id
        WHERE (? IS NULL OR r.need_kind = ?)
          AND (? IS NULL OR r.user_id = ?)
          AND (? IS NULL OR r.entity_label LIKE ?)
          AND (? IS NULL OR substr(r.created_at, 1, 10) >= ?)
          AND (? IS NULL OR substr(r.created_at, 1, 10) <= ?)
          AND (? IS NULL OR r.priority >= ?)
          ${statuses.length ? `AND r.status IN (${statuses.map(() => "?").join(",")})` : ""}
        ORDER BY CASE WHEN r.status IN ('resolved','cancelled','expired') THEN 1 ELSE 0 END, r.priority DESC, r.updated_at DESC
        LIMIT ?`,
      q.kind ?? null,
      q.kind ?? null,
      q.userId ?? null,
      q.userId ?? null,
      q.entity ?? null,
      q.entity ? `%${q.entity}%` : null,
      q.from ?? null,
      q.from ?? null,
      q.to ?? null,
      q.to ?? null,
      q.minPriority ?? null,
      q.minPriority ?? null,
      ...statuses,
      q.limit,
    );
    const counts = await c.get("ctx").db.all<{ status: string; n: number }>("SELECT status, COUNT(*) AS n FROM data_collection_requests GROUP BY status");
    return c.json({ rows: rows.map(present), counts: Object.fromEntries(counts.map((x) => [x.status, x.n])), statusLabels: STATUS_LABEL, kindLabels: KIND_LABEL });
  });

  r.get("/proactive/requests/:id", async (c) => {
    const ctx = c.get("ctx");
    const req = await getRequest(ctx, c.req.param("id"));
    if (!req) throw new DomainError("NOT_FOUND", "Solicitação não encontrada", 404);
    const events = await ctx.db.all<{ id: string; kind: EventKind; actor: string; message_id: string | null; data_json: string; created_at: string }>(
      "SELECT id, kind, actor, message_id, data_json, created_at FROM data_collection_events WHERE request_id = ? ORDER BY created_at, rowid",
      req.id,
    );
    const messageIds = [...new Set(events.map((e) => e.message_id).filter((x): x is string => !!x))];
    const messages = messageIds.length
      ? await ctx.db.all<{ id: string; direction: string; kind: string; text: string | null; transcript: string | null; created_at: string }>(
          `SELECT id, direction, kind, text, transcript, created_at FROM conversation_messages WHERE id IN (${messageIds.map(() => "?").join(",")}) ORDER BY created_at`,
          ...messageIds,
        )
      : [];
    const learned = await ctx.db.all("SELECT kind, entity_key, data_json, confidence, status, origin, created_at FROM learning_observations WHERE collection_request_id = ? ORDER BY created_at", req.id);
    const prices = await ctx.db.all(
      "SELECT m.name, h.price_cents, h.previous_price_cents, h.package_size, h.previous_package_size, h.confidence, h.is_estimate, h.source, h.recorded_at FROM material_price_history h JOIN materials m ON m.id = h.material_id WHERE h.collection_request_id = ?",
      req.id,
    );
    return c.json({
      request: present(req),
      events: events.map((e) => ({ ...e, data: json(e.data_json, {}), label: EVENT_LABEL[e.kind] ?? e.kind, created_at_br: br(e.created_at) })),
      messages: messages.map((m) => ({ ...m, display_text: m.kind === "callback" ? humanizeCallback(m.text, m.direction === "in" ? "Adriano" : "Bot") : (m.transcript ?? m.text), created_at_br: br(m.created_at) })),
      learned,
      prices,
    });
  });

  r.post("/proactive/requests/:id/action", async (c) => {
    const ctx = c.get("ctx");
    const admin = c.get("admin").id;
    const b = z
      .object({ action: z.enum(["cancel", "snooze", "reopen", "priority", "mute"]), days: z.number().min(0.5).max(365).optional(), priority: z.number().int().min(0).max(300).optional(), note: z.string().max(300).optional() })
      .parse(await c.req.json());
    const req = await getRequest(ctx, c.req.param("id"));
    if (!req) throw new DomainError("NOT_FOUND", "Solicitação não encontrada", 404);
    const open = OPEN_STATUSES.includes(req.status);
    const note = b.note ?? null;
    switch (b.action) {
      case "cancel":
        if (!open) throw new DomainError("INVALID", "Essa solicitação já está encerrada.", 422);
        await updateRequest(ctx, req.id, { status: "cancelled", close_reason: note ?? "cancelada pelo administrador" });
        await releaseSessionIfPointing(ctx, req.user_id, req.id);
        await addEvent(ctx, { requestId: req.id, userId: req.user_id, correlationId: req.correlation_id, kind: "cancelled", actor: admin, data: { note } });
        break;
      case "snooze": {
        if (!open) throw new DomainError("INVALID", "Essa solicitação já está encerrada.", 422);
        const until = new Date(ctx.clock().getTime() + (b.days ?? 7) * 86_400_000).toISOString();
        await updateRequest(ctx, req.id, { status: "snoozed", next_allowed_at: until, close_reason: note ?? "adiada pelo administrador" });
        await releaseSessionIfPointing(ctx, req.user_id, req.id);
        await addEvent(ctx, { requestId: req.id, userId: req.user_id, correlationId: req.correlation_id, kind: "snoozed", actor: admin, data: { until, note } });
        break;
      }
      case "reopen": {
        if (open) throw new DomainError("INVALID", "Essa solicitação já está aberta.", 422);
        const clash = await ctx.db.first(`SELECT id FROM data_collection_requests WHERE dedupe_key = ? AND id <> ? AND status IN (${OPEN_STATUSES.map(() => "?").join(",")})`, req.dedupe_key, req.id, ...OPEN_STATUSES);
        if (clash) throw new DomainError("INVALID", "Já existe outra solicitação aberta para esse mesmo dado.", 422);
        await updateRequest(ctx, req.id, { status: "queued", next_allowed_at: null, close_reason: null, resolved_at: null });
        await addEvent(ctx, { requestId: req.id, userId: req.user_id, correlationId: req.correlation_id, kind: "reopened", actor: admin, data: { note } });
        break;
      }
      case "priority":
        if (b.priority === undefined) throw new DomainError("INVALID", "Informe a prioridade.", 422);
        await updateRequest(ctx, req.id, { priority: b.priority, priority_locked: 1 });
        await addEvent(ctx, { requestId: req.id, userId: req.user_id, correlationId: req.correlation_id, kind: "priority_updated", actor: admin, data: { priority: b.priority, locked: true, note } });
        break;
      case "mute": {
        // impede novas perguntas sobre o item
        const until = new Date(ctx.clock().getTime() + (b.days ?? 3650) * 86_400_000).toISOString();
        if (req.entity_type === "material") await ctx.db.run("UPDATE materials SET proactive_muted_until = ?, updated_at = ? WHERE id = ?", until, nowIso(ctx), req.entity_id);
        if (open) {
          await updateRequest(ctx, req.id, { status: "cancelled", close_reason: note ?? "item silenciado pelo administrador" });
          await releaseSessionIfPointing(ctx, req.user_id, req.id);
        }
        await addEvent(ctx, { requestId: req.id, userId: req.user_id, correlationId: req.correlation_id, kind: "cancelled", actor: admin, data: { muted: true, until, note } });
        break;
      }
    }
    await audit(ctx, admin, `proactive.${b.action}`, "data_collection_request", req.id, { status: req.status, priority: req.priority }, b);
    return c.json({ ok: true, request: present((await getRequest(ctx, req.id))!) });
  });

  r.get("/proactive/settings", async (c) => {
    const ctx = c.get("ctx");
    const lastRuns = await ctx.db.all("SELECT run_key, status, correlation_id, result_json, started_at, finished_at FROM job_runs WHERE job_name = 'proactive_collection' ORDER BY started_at DESC LIMIT 10");
    return c.json({ settings: await getProactiveSettings(ctx), mode: ctx.config.proactiveMode, kindLabels: KIND_LABEL, kindGroups: KIND_GROUP, gateLabels: GATE_LABEL, lastRuns });
  });

  r.put("/proactive/settings", async (c) => {
    const body = (await c.req.json()) as Record<string, unknown>;
    const settings = await saveProactiveSettings(c.get("ctx"), body, c.get("admin").id);
    return c.json({ settings });
  });

  // simulação: nada é enviado nem gravado
  r.post("/proactive/dry-run", async (c) => c.json(await runProactiveCollection(c.get("ctx"), { mode: "dry_run" })));

  // execução manual real (respeita todos os limites, horários e a chave geral)
  r.post("/proactive/run", async (c) => {
    const ctx = c.get("ctx");
    if (ctx.config.proactiveMode !== "live") return c.json(await runProactiveCollection(ctx, { mode: "dry_run" }));
    return c.json(await runProactiveCollection(ctx, { mode: "live", ignoreLock: true }));
  });
}
