import { formatBRL, localDateKey, newId } from "@adripatina/shared";
import { JOB_STATUS_LABEL } from "@adripatina/domain";
import type { Ctx } from "./context.js";
import { nowIso } from "./context.js";
import { processOutbox } from "./services/outbox.js";
import { listArtisans } from "./repos/users.js";
import { listActiveJobs } from "./repos/jobs.js";
import { scanForDuplicates } from "./services/duplicates.js";
import { runProactiveCollection } from "./services/proactive/job.js";
import { runQuoteFollowups } from "./services/followup.js";

/** Cron (a cada 15 min): outbox, resumo diário idempotente, retenção de mídia, varredura de duplicidades. */
export async function runScheduled(ctx: Ctx): Promise<Record<string, unknown>> {
  const result: Record<string, unknown> = {};
  result.outbox = await processOutbox(ctx);
  result.dailySummary = await maybeSendDailySummary(ctx);
  result.retention = await purgeExpiredMedia(ctx);
  const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", hour: "2-digit", hour12: false }).format(ctx.clock()));
  if (hour === 3) result.duplicates = await scanForDuplicates(ctx);
  // "o cliente respondeu?" alguns dias depois do PDF (D-081) — de manhã, fora de conversa
  if (hour >= 9 && hour <= 18) {
    try {
      result.followups = await runQuoteFollowups(ctx);
    } catch (err) {
      console.error(JSON.stringify({ level: "error", msg: "followups_failed", error: err instanceof Error ? err.message.slice(0, 200) : "unknown" }));
    }
  }
  // coleta proativa: isolada — uma falha aqui nunca interrompe o restante do cron nem o bot
  try {
    const r = await runProactiveCollection(ctx);
    result.proactive = { mode: r.mode, skipped: r.skipped ?? null, correlationId: r.correlationId, sent: r.users.filter((u) => u.sent).length, users: r.users.length };
  } catch (err) {
    result.proactive = { error: err instanceof Error ? err.name : "unknown" };
    console.error(JSON.stringify({ level: "error", msg: "proactive_failed", error: err instanceof Error ? err.message.slice(0, 200) : "unknown" }));
  }
  return result;
}

async function maybeSendDailySummary(ctx: Ctx): Promise<number> {
  const now = ctx.clock();
  const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", hour: "2-digit", hour12: false }).format(now));
  if (hour !== ctx.config.dailySummaryHour) return 0;
  const day = localDateKey(now);
  let sent = 0;
  for (const user of await listArtisans(ctx)) {
    if (!user.telegramChatId) continue;
    const prefs = await ctx.db.first<{ preferences_json: string }>("SELECT preferences_json FROM users WHERE id = ?", user.id);
    const p = JSON.parse(prefs?.preferences_json ?? "{}") as { dailySummary?: boolean };
    if (p.dailySummary === false) continue;
    // idempotência: um resumo por usuário por dia
    const inserted = await ctx.db.run(
      "INSERT OR IGNORE INTO scheduled_reminders (id, user_id, kind, due_at, sent_at, dedupe_key, created_at) VALUES (?, ?, 'resumo_diario', ?, ?, ?, ?)",
      newId(),
      user.id,
      nowIso(ctx),
      nowIso(ctx),
      `daily:${user.id}:${day}`,
      nowIso(ctx),
    );
    if (inserted === 0) continue;
    const text = await buildDailySummary(ctx, user.displayName.split(" ")[0] ?? "");
    if (!text) continue;
    await ctx.telegram.sendMessage(user.telegramChatId, text);
    sent++;
  }
  return sent;
}

export async function buildDailySummary(ctx: Ctx, firstName: string): Promise<string | null> {
  const jobs = await listActiveJobs(ctx, 20);
  const awaiting = await ctx.db.all<{ title: string }>("SELECT j.title FROM quotes q JOIN jobs j ON j.id = q.job_id WHERE q.status = 'ENVIADO'");
  const receivables = await ctx.db.all<{ title: string; balance: number }>(
    `SELECT j.title, j.contracted_cents - COALESCE((SELECT SUM(CASE WHEN kind='ESTORNO' THEN -amount_cents ELSE amount_cents END) FROM payments p WHERE p.job_id = j.id),0) AS balance
     FROM jobs j WHERE j.contracted_cents IS NOT NULL AND j.status IN ('CONCLUIDO','ENTREGUE')`,
  );
  const today = localDateKey(ctx.clock());
  const overdue = jobs.filter((j) => j.status === "EM_EXECUCAO" && (j as unknown as { dueDate?: string }).dueDate && (j as unknown as { dueDate: string }).dueDate < today);
  if (jobs.length === 0 && awaiting.length === 0) return null;
  const lines = [`Bom dia, ${firstName}! Seu resumo de hoje:`];
  const inExec = jobs.filter((j) => j.status === "EM_EXECUCAO");
  if (inExec.length) lines.push(`Em execução: ${inExec.map((j) => j.title).join("; ")}`);
  const toStart = jobs.filter((j) => j.status === "AGUARDANDO_INICIO");
  if (toStart.length) lines.push(`Para começar: ${toStart.map((j) => j.title).join("; ")}`);
  const inQuote = jobs.filter((j) => j.status === "ORCAMENTO");
  if (inQuote.length) lines.push(`Em orçamento: ${inQuote.map((j) => `${j.title} (${JOB_STATUS_LABEL[j.status].toLowerCase()})`).join("; ")}`);
  if (overdue.length) lines.push(`Atrasados: ${overdue.map((j) => j.title).join("; ")}`);
  if (awaiting.length) lines.push(`Orçamentos esperando resposta do cliente: ${awaiting.map((a) => a.title).join("; ")}`);
  const pend = receivables.filter((r) => r.balance > 0);
  if (pend.length) lines.push(`A receber: ${pend.map((r) => `${r.title} (${formatBRL(r.balance)})`).join("; ")}`);
  return lines.join("\n");
}

/** Retenção LGPD: remove do R2 mídias com prazo vencido e marca como excluídas. */
export async function purgeExpiredMedia(ctx: Ctx): Promise<number> {
  const rows = await ctx.db.all<{ id: string; r2_key: string }>(
    "SELECT id, r2_key FROM attachments WHERE retention_until IS NOT NULL AND retention_until < ? AND deleted_at IS NULL LIMIT 50",
    nowIso(ctx),
  );
  for (const r of rows) {
    await ctx.storage.delete(r.r2_key);
    await ctx.db.run("UPDATE attachments SET deleted_at = ? WHERE id = ?", nowIso(ctx), r.id);
  }
  return rows.length;
}
