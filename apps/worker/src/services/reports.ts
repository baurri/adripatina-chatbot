import { ACTIVE_JOB_STATUSES } from "@adripatina/domain";
import { localDateKey } from "@adripatina/shared";
import type { Ctx } from "../context.js";
import { getActiveSettings, getInventory } from "../repos/catalog.js";

export interface DashboardSummary {
  quotesAwaitingReview: number;
  activeJobs: number;
  overdueJobs: number;
  receivablesCents: number;
  monthReceivedCents: number;
  monthSpentCents: number;
  monthPurchasesCents: number;
  monthExpensesCents: number;
  openDuplicates: number;
  materialsWithoutPrice: number;
  stalePrices: number;
  uncalibratedTechniques: number;
  lowStock: number;
  pendingApprovals: number;
  pendingAccessRequests: number;
}

function monthBounds(ctx: Ctx): { start: string; end: string } {
  const key = localDateKey(ctx.clock()); // AAAA-MM-DD (São Paulo)
  const [y, m] = key.split("-").map(Number) as [number, number];
  // início do mês em São Paulo (UTC-3, sem horário de verão desde 2019)
  const start = new Date(Date.UTC(y, m - 1, 1, 3, 0, 0)).toISOString();
  const end = new Date(Date.UTC(m === 12 ? y + 1 : y, m === 12 ? 0 : m, 1, 3, 0, 0)).toISOString();
  return { start, end };
}

export async function dashboardSummary(ctx: Ctx): Promise<DashboardSummary> {
  const { start, end } = monthBounds(ctx);
  const n = async (sql: string, ...p: (string | number)[]) => (await ctx.db.first<{ v: number }>(sql, ...p))?.v ?? 0;
  const activeList = ACTIVE_JOB_STATUSES.map(() => "?").join(",");
  const settings = await getActiveSettings(ctx);
  const staleBefore = new Date(ctx.clock().getTime() - settings.params.stalePriceDays * 86_400_000).toISOString();
  const today = localDateKey(ctx.clock());
  const purchases = await n("SELECT COALESCE(SUM(amount_cents),0) AS v FROM purchases WHERE voided_at IS NULL AND purchased_at >= ? AND purchased_at < ?", start, end);
  const expenses = await n("SELECT COALESCE(SUM(amount_cents),0) AS v FROM expenses WHERE voided_at IS NULL AND spent_at >= ? AND spent_at < ?", start, end);
  const inventory = await getInventory(ctx);
  return {
    quotesAwaitingReview: await n("SELECT COUNT(*) AS v FROM quotes WHERE status = 'AGUARDANDO_REVISAO'"),
    activeJobs: await n(`SELECT COUNT(*) AS v FROM jobs WHERE status IN (${activeList})`, ...ACTIVE_JOB_STATUSES),
    overdueJobs: await n(`SELECT COUNT(*) AS v FROM jobs WHERE status IN ('AGUARDANDO_INICIO','EM_EXECUCAO') AND due_date IS NOT NULL AND due_date < ?`, today),
    receivablesCents: await n(
      `SELECT COALESCE(SUM(j.contracted_cents - COALESCE((SELECT SUM(CASE WHEN p.kind = 'ESTORNO' THEN -p.amount_cents ELSE p.amount_cents END) FROM payments p WHERE p.job_id = j.id), 0)), 0) AS v
       FROM jobs j WHERE j.contracted_cents IS NOT NULL AND j.status NOT IN ('CANCELADO','MESCLADO')`,
    ),
    monthReceivedCents: await n("SELECT COALESCE(SUM(CASE WHEN kind = 'ESTORNO' THEN -amount_cents ELSE amount_cents END),0) AS v FROM payments WHERE paid_at >= ? AND paid_at < ?", start, end),
    monthSpentCents: purchases + expenses,
    monthPurchasesCents: purchases,
    monthExpensesCents: expenses,
    openDuplicates: await n("SELECT COUNT(*) AS v FROM duplicate_suspicions WHERE status = 'ABERTA'"),
    materialsWithoutPrice: await n("SELECT COUNT(*) AS v FROM materials WHERE active = 1 AND replacement_price_cents IS NULL"),
    stalePrices: await n("SELECT COUNT(*) AS v FROM materials WHERE active = 1 AND replacement_price_cents IS NOT NULL AND (price_updated_at IS NULL OR price_updated_at < ?)", staleBefore),
    uncalibratedTechniques: await n("SELECT COUNT(*) AS v FROM techniques WHERE calibrated = 0"),
    lowStock: inventory.filter((i) => i.low).length,
    pendingApprovals: await n("SELECT COUNT(*) AS v FROM approval_requests WHERE status = 'PENDENTE'"),
    pendingAccessRequests: await n("SELECT COUNT(*) AS v FROM access_requests WHERE status = 'PENDENTE'"),
  };
}

/** Evolução mensal: receita (recebimentos), compras, despesas e saldo de caixa. */
export async function cashflowReport(ctx: Ctx, months = 12): Promise<{ month: string; receivedCents: number; purchasesCents: number; expensesCents: number; netCents: number }[]> {
  const rows = new Map<string, { receivedCents: number; purchasesCents: number; expensesCents: number }>();
  const add = (month: string, k: "receivedCents" | "purchasesCents" | "expensesCents", v: number) => {
    const r = rows.get(month) ?? { receivedCents: 0, purchasesCents: 0, expensesCents: 0 };
    r[k] += v;
    rows.set(month, r);
  };
  for (const r of await ctx.db.all<{ m: string; v: number }>("SELECT substr(paid_at,1,7) AS m, SUM(CASE WHEN kind='ESTORNO' THEN -amount_cents ELSE amount_cents END) AS v FROM payments GROUP BY m")) add(r.m, "receivedCents", r.v);
  for (const r of await ctx.db.all<{ m: string; v: number }>("SELECT substr(purchased_at,1,7) AS m, SUM(amount_cents) AS v FROM purchases WHERE voided_at IS NULL GROUP BY m")) add(r.m, "purchasesCents", r.v);
  for (const r of await ctx.db.all<{ m: string; v: number }>("SELECT substr(spent_at,1,7) AS m, SUM(amount_cents) AS v FROM expenses WHERE voided_at IS NULL GROUP BY m")) add(r.m, "expensesCents", r.v);
  return [...rows.entries()]
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .slice(0, months)
    .map(([month, r]) => ({ month, ...r, netCents: r.receivedCents - r.purchasesCents - r.expensesCents }));
}

/** Rentabilidade por serviço: estimado (orçamento) x realizado (consumo/despesas/horas). */
export async function profitabilityReport(ctx: Ctx) {
  return ctx.db.all<{
    code: string;
    title: string;
    status: string;
    contracted_cents: number | null;
    received_cents: number;
    consumption_cents: number;
    expenses_cents: number;
    purchases_cents: number;
    estimated_hours: string | null;
    actual_hours: number | null;
  }>(
    `SELECT j.code, j.title, j.status, j.contracted_cents,
       COALESCE((SELECT SUM(CASE WHEN kind='ESTORNO' THEN -amount_cents ELSE amount_cents END) FROM payments p WHERE p.job_id = j.id),0) AS received_cents,
       COALESCE((SELECT SUM(total_cost_cents) FROM material_consumptions mc WHERE mc.job_id = j.id),0) AS consumption_cents,
       COALESCE((SELECT SUM(amount_cents) FROM expenses e WHERE e.job_id = j.id AND e.voided_at IS NULL),0) AS expenses_cents,
       COALESCE((SELECT SUM(amount_cents) FROM purchases pu WHERE pu.job_id = j.id AND pu.voided_at IS NULL),0) AS purchases_cents,
       (SELECT json_extract(q.result_json, '$.labor.totalHours') FROM quotes q WHERE q.job_id = j.id ORDER BY q.version DESC LIMIT 1) AS estimated_hours,
       (SELECT SUM(CAST(hours AS REAL)) FROM time_entries t WHERE t.job_id = j.id) AS actual_hours
     FROM jobs j WHERE j.status <> 'MESCLADO' ORDER BY j.created_at DESC LIMIT 500`,
  );
}

export function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]!);
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    // proteção contra injeção de fórmula em planilhas
    const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
    return /[",;\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  return [headers.join(";"), ...rows.map((r) => headers.map((h) => esc(r[h])).join(";"))].join("\n");
}
