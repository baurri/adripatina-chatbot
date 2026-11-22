import { Dec, localDateKey, newId, normalizeText, sha256Hex } from "@adripatina/shared";
import type { Ctx } from "../context.js";
import { nowIso } from "../context.js";
import { auditStmt } from "./audit.js";
import { getMaterial } from "./catalog.js";
import { jobBalance } from "./jobs.js";

/**
 * Chave de idempotência financeira: mesmo usuário + tipo + valor + destino +
 * descrição + dia local. Reenvio de áudio/mensagem não duplica lançamento.
 */
export async function financialIdempotencyKey(
  ctx: Ctx,
  parts: { userId: string; kind: string; amountCents: number; jobId: string | null; description: string; sequence?: number },
): Promise<string> {
  const day = localDateKey(ctx.clock());
  const base = [parts.userId, parts.kind, parts.amountCents, parts.jobId ?? "geral", normalizeText(parts.description), day].join("|");
  const hash = await sha256Hex(base);
  return parts.sequence ? `${hash}:${parts.sequence}` : hash;
}

export async function findByIdempotencyKey(ctx: Ctx, table: "payments" | "purchases" | "expenses", key: string): Promise<{ id: string } | null> {
  return ctx.db.first<{ id: string }>(`SELECT id FROM ${table} WHERE idempotency_key = ?`, key);
}

export type RecordResult = { kind: "created"; id: string } | { kind: "duplicate"; id: string };

export async function recordPayment(
  ctx: Ctx,
  p: { jobId: string; amountCents: number; kind?: "ENTRADA" | "PARCELA" | "QUITACAO" | "ESTORNO"; method?: string | null; reference?: string | null; actor: string; idempotencyKey: string },
): Promise<RecordResult> {
  if (!Number.isSafeInteger(p.amountCents) || p.amountCents <= 0) throw new RangeError("Valor inválido");
  const dup = await findByIdempotencyKey(ctx, "payments", p.idempotencyKey);
  if (dup) return { kind: "duplicate", id: dup.id };
  const id = newId();
  const now = nowIso(ctx);
  let kind = p.kind;
  if (!kind) {
    const bal = await jobBalance(ctx, p.jobId);
    kind = bal.paidCents === 0 ? "ENTRADA" : bal.contractedCents !== null && bal.paidCents + p.amountCents >= bal.contractedCents ? "QUITACAO" : "PARCELA";
  }
  await ctx.db.batch([
    ctx.db.stmt(
      `INSERT INTO payments (id, job_id, amount_cents, kind, method, paid_at, reference, idempotency_key, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      p.jobId,
      p.amountCents,
      kind,
      p.method ?? null,
      now,
      p.reference ?? null,
      p.idempotencyKey,
      p.actor,
      now,
    ),
    ctx.db.stmt("INSERT INTO job_events (id, job_id, type, payload_json, actor_id, created_at) VALUES (?, ?, 'pagamento', ?, ?, ?)", newId(), p.jobId, JSON.stringify({ amountCents: p.amountCents, kind }), p.actor, now),
    auditStmt(ctx, p.actor, "payment.create", "payment", id, undefined, { jobId: p.jobId, amountCents: p.amountCents, kind }),
  ]);
  return { kind: "created", id };
}

/**
 * Compra de material: registra DESEMBOLSO (caixa) e entrada de estoque com custo
 * histórico. Não cria custo de consumo — o consumo é registrado separadamente
 * para evitar dupla contagem (aceite 5).
 */
export async function recordPurchase(
  ctx: Ctx,
  p: { materialId: string | null; description: string; amountCents: number; packages?: number | null; jobId: string | null; supplierId?: string | null; attachmentId?: string | null; actor: string; idempotencyKey: string },
): Promise<RecordResult> {
  if (!Number.isSafeInteger(p.amountCents) || p.amountCents <= 0) throw new RangeError("Valor inválido");
  const dup = await findByIdempotencyKey(ctx, "purchases", p.idempotencyKey);
  if (dup) return { kind: "duplicate", id: dup.id };
  const id = newId();
  const now = nowIso(ctx);
  const stmts: D1PreparedStatement[] = [];
  let quantity: string | null = null;
  if (p.materialId && p.packages && p.packages > 0) {
    const mat = await getMaterial(ctx, p.materialId);
    if (mat) {
      const q = Dec.from(mat.packageSize).mul(p.packages);
      quantity = q.toString();
      const unitCost = Dec.from(p.amountCents).div(q).round(4).toString();
      stmts.push(
        ctx.db.stmt(
          `INSERT INTO stock_movements (id, material_id, kind, quantity, historical_unit_cost_cents, purchase_id, job_id, note, created_by, created_at) VALUES (?, ?, 'ENTRADA', ?, ?, ?, ?, ?, ?, ?)`,
          newId(),
          p.materialId,
          quantity,
          unitCost,
          id,
          p.jobId,
          "Entrada por compra",
          p.actor,
          now,
        ),
      );
    }
  }
  stmts.unshift(
    ctx.db.stmt(
      `INSERT INTO purchases (id, material_id, description, packages, quantity, amount_cents, purchased_at, supplier_id, job_id, attachment_id, idempotency_key, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      p.materialId,
      p.description,
      p.packages ?? null,
      quantity,
      p.amountCents,
      now,
      p.supplierId ?? null,
      p.jobId,
      p.attachmentId ?? null,
      p.idempotencyKey,
      p.actor,
      now,
    ),
  );
  stmts.push(auditStmt(ctx, p.actor, "purchase.create", "purchase", id, undefined, { amountCents: p.amountCents, jobId: p.jobId, materialId: p.materialId }));
  if (p.jobId) {
    stmts.push(ctx.db.stmt("INSERT INTO job_events (id, job_id, type, payload_json, actor_id, created_at) VALUES (?, ?, 'compra', ?, ?, ?)", newId(), p.jobId, JSON.stringify({ amountCents: p.amountCents, description: p.description }), p.actor, now));
  }
  await ctx.db.batch(stmts);
  return { kind: "created", id };
}

export async function recordExpense(
  ctx: Ctx,
  e: { jobId: string | null; category: string; description: string; amountCents: number; attachmentId?: string | null; actor: string; idempotencyKey: string },
): Promise<RecordResult> {
  if (!Number.isSafeInteger(e.amountCents) || e.amountCents <= 0) throw new RangeError("Valor inválido");
  const dup = await findByIdempotencyKey(ctx, "expenses", e.idempotencyKey);
  if (dup) return { kind: "duplicate", id: dup.id };
  const id = newId();
  const now = nowIso(ctx);
  await ctx.db.batch([
    ctx.db.stmt(
      `INSERT INTO expenses (id, job_id, category, description, amount_cents, spent_at, attachment_id, idempotency_key, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      e.jobId,
      e.category,
      e.description,
      e.amountCents,
      now,
      e.attachmentId ?? null,
      e.idempotencyKey,
      e.actor,
      now,
    ),
    auditStmt(ctx, e.actor, "expense.create", "expense", id, undefined, { amountCents: e.amountCents, jobId: e.jobId, category: e.category }),
  ]);
  return { kind: "created", id };
}

/** Consumo de material por serviço (custo a preço de reposição, snapshot). */
export async function recordConsumption(
  ctx: Ctx,
  c: { jobId: string; quoteId: string | null; materialId: string; quantity: string; replacementUnitCostCents: string; source: "ESTOQUE" | "COMPRA" | "MISTO"; actor: string },
): Promise<void> {
  const total = Dec.from(c.quantity).mul(c.replacementUnitCostCents).toIntegerCents("UP");
  const now = nowIso(ctx);
  await ctx.db.batch([
    ctx.db.stmt(
      `INSERT INTO material_consumptions (id, job_id, quote_id, material_id, quantity, replacement_unit_cost_snapshot_cents, total_cost_cents, source, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      newId(),
      c.jobId,
      c.quoteId,
      c.materialId,
      c.quantity,
      c.replacementUnitCostCents,
      total,
      c.source,
      now,
    ),
    ctx.db.stmt(
      `INSERT INTO stock_movements (id, material_id, kind, quantity, job_id, note, created_by, created_at) VALUES (?, ?, 'CONSUMO', ?, ?, 'Consumo no serviço', ?, ?)`,
      newId(),
      c.materialId,
      c.quantity,
      c.jobId,
      c.actor,
      now,
    ),
  ]);
}

export interface JobEconomics {
  contractedCents: number | null;
  receivedCents: number;
  balanceCents: number | null;
  /** custo econômico (reposição) dos materiais consumidos */
  materialConsumptionCents: number;
  /** desembolso de caixa com compras vinculadas ao serviço (não somado ao custo econômico) */
  purchaseCashCents: number;
  expensesCents: number;
  /** resultado econômico estimado antes da mão de obra própria (= remuneração do artesão + reserva) */
  economicResultBeforeOwnLaborCents: number | null;
  cashFlowCents: number;
}

/**
 * Resultado econômico usa CONSUMO (reposição); fluxo de caixa usa COMPRAS.
 * Nunca somar os dois — evita dupla contagem (aceite 5).
 */
export async function jobEconomics(ctx: Ctx, jobId: string): Promise<JobEconomics> {
  const bal = await jobBalance(ctx, jobId);
  const cons = await ctx.db.first<{ v: number }>("SELECT COALESCE(SUM(total_cost_cents),0) AS v FROM material_consumptions WHERE job_id = ?", jobId);
  const purch = await ctx.db.first<{ v: number }>("SELECT COALESCE(SUM(amount_cents),0) AS v FROM purchases WHERE job_id = ? AND voided_at IS NULL", jobId);
  const exp = await ctx.db.first<{ v: number }>("SELECT COALESCE(SUM(amount_cents),0) AS v FROM expenses WHERE job_id = ? AND voided_at IS NULL", jobId);
  const consumption = cons?.v ?? 0;
  const purchase = purch?.v ?? 0;
  const expenses = exp?.v ?? 0;
  return {
    contractedCents: bal.contractedCents,
    receivedCents: bal.paidCents,
    balanceCents: bal.balanceCents,
    materialConsumptionCents: consumption,
    purchaseCashCents: purchase,
    expensesCents: expenses,
    economicResultBeforeOwnLaborCents: bal.contractedCents === null ? null : bal.contractedCents - consumption - expenses,
    cashFlowCents: bal.paidCents - purchase - expenses,
  };
}
