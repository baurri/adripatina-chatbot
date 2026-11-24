import { formatBRL, newId } from "@adripatina/shared";
import type { Ctx } from "../context.js";
import { nowIso } from "../context.js";
import { listArtisans, type User } from "../repos/users.js";
import { getJob, jobPhrase } from "../repos/jobs.js";
import { loadSession, logMessage } from "../repos/sessions.js";
import { markQuoteOutcome } from "./quotes.js";

/**
 * D-081 — DEPOIS DO PDF. Alguns dias depois de mandar a proposta, o bot pergunta se o cliente fechou,
 * com 3 botões (Fechou / Não fechou / Ainda não). A resposta marca a proposta como aceita ou recusada
 * (a peça vai pra fila) e dá ao Adriano a visão de quanto do que ele orça vira serviço.
 *
 * Regras: só a proposta MAIS NOVA de cada peça (as substituídas não contam); no máximo uma pergunta por
 * rodada; nunca no meio de uma conversa (nada nas últimas 2 h); "ainda não" pergunta de novo uma vez,
 * 4 dias depois.
 */
export const FOLLOWUP_AFTER_DAYS = 3;
export const FOLLOWUP_RETRY_DAYS = 4;
const QUIET_MS = 2 * 3600_000;

interface Proposal {
  snapshotId: string;
  number: string;
  quotes: { id: string; jobId: string; status: string; cents: number }[];
}

async function proposal(ctx: Ctx, snapshotId: string): Promise<Proposal | null> {
  const s = await ctx.db.first<{ id: string; number: string; snapshot_json: string }>("SELECT id, number, snapshot_json FROM quote_snapshots WHERE id = ?", snapshotId);
  if (!s) return null;
  const quotes = await ctx.db.all<{ id: string; job_id: string; status: string; final_price_cents: number | null; recommended_cents: number | null }>(
    "SELECT id, job_id, status, final_price_cents, recommended_cents FROM quotes WHERE ? LIKE '%' || id || '%'",
    s.snapshot_json,
  );
  if (!quotes.length) return null;
  return { snapshotId: s.id, number: s.number, quotes: quotes.map((q) => ({ id: q.id, jobId: q.job_id, status: q.status, cents: q.final_price_cents ?? q.recommended_cents ?? 0 })) };
}

/** Proposta ainda sem resposta e não substituída por um PDF mais novo de alguma das peças. */
async function isOpen(ctx: Ctx, p: Proposal, createdAt: string): Promise<boolean> {
  if (!p.quotes.every((q) => q.status === "APROVADO" || q.status === "ENVIADO")) return false;
  for (const q of p.quotes) {
    const newer = await ctx.db.first(
      "SELECT 1 FROM quote_snapshots s JOIN quote_documents d ON d.snapshot_id = s.id AND d.kind = 'COMERCIAL' WHERE s.created_at > ? AND s.id <> ? AND EXISTS (SELECT 1 FROM quotes x WHERE x.job_id = ? AND s.snapshot_json LIKE '%' || x.id || '%') LIMIT 1",
      createdAt,
      p.snapshotId,
      q.jobId,
    );
    if (newer) return false;
  }
  return true;
}

async function describe(ctx: Ctx, p: Proposal): Promise<{ pieces: string; total: string }> {
  const names: string[] = [];
  for (const q of p.quotes) {
    const j = await getJob(ctx, q.jobId);
    if (j) names.push(jobPhrase(j));
  }
  const pieces = names.length <= 1 ? (names[0] ?? "a peça") : `${names.slice(0, -1).join(", ")} e ${names.at(-1)}`;
  return { pieces, total: formatBRL(p.quotes.reduce((a, q) => a + q.cents, 0)) };
}

async function busy(ctx: Ctx, userId: string): Promise<boolean> {
  const last = await ctx.db.first<{ created_at: string }>("SELECT created_at FROM conversation_messages WHERE user_id = ? ORDER BY created_at DESC LIMIT 1", userId);
  return !!last && ctx.clock().getTime() - new Date(last.created_at).getTime() < QUIET_MS;
}

async function ask(ctx: Ctx, user: User, p: Proposal): Promise<void> {
  const { pieces, total } = await describe(ctx, p);
  const first = user.displayName.split(" ")[0] ?? "";
  const text = `Oi${first ? `, ${first}` : ""}! 🙂 E o orçamento ${pieces.replace(/^(o|a) /, (m) => (m === "a " ? "da " : "do "))} (${total}), o cliente respondeu?`;
  await ctx.telegram.sendMessage(user.telegramChatId!, text, [
    [
      { text: "✅ Fechou", data: `ag:fu:yes:${p.snapshotId}` },
      { text: "❌ Não fechou", data: `ag:fu:no:${p.snapshotId}` },
    ],
    [{ text: "⏳ Ainda não", data: `ag:fu:wait:${p.snapshotId}` }],
  ]);
  const session = await loadSession(ctx, user.id);
  await logMessage(ctx, { sessionId: session.id, userId: user.id, jobId: p.quotes[0]!.jobId, direction: "out", kind: "text", text });
}

/** Cron: pergunta de no máximo UMA proposta por artesão por rodada. Devolve quantas perguntas mandou. */
export async function runQuoteFollowups(ctx: Ctx): Promise<number> {
  const now = ctx.clock();
  const cutoff = new Date(now.getTime() - FOLLOWUP_AFTER_DAYS * 86400_000).toISOString();
  let sent = 0;
  for (const user of await listArtisans(ctx)) {
    if (!user.telegramChatId || (await busy(ctx, user.id))) continue;
    // no máximo uma pergunta dessas por dia
    const today = await ctx.db.first("SELECT 1 FROM scheduled_reminders WHERE user_id = ? AND kind IN ('followup','followup_retry') AND sent_at >= ? LIMIT 1", user.id, new Date(now.getTime() - 20 * 3600_000).toISOString());
    if (today) continue;
    // 1) "ainda não" de antes, já vencido
    const retry = await ctx.db.first<{ id: string; dedupe_key: string }>(
      "SELECT id, dedupe_key FROM scheduled_reminders WHERE user_id = ? AND kind = 'followup_retry' AND sent_at IS NULL AND due_at <= ? ORDER BY due_at LIMIT 1",
      user.id,
      now.toISOString(),
    );
    if (retry) {
      const snap = retry.dedupe_key.split(":")[1] ?? "";
      const p = await proposal(ctx, snap);
      const created = await ctx.db.first<{ created_at: string }>("SELECT created_at FROM quote_snapshots WHERE id = ?", snap);
      await ctx.db.run("UPDATE scheduled_reminders SET sent_at = ? WHERE id = ?", nowIso(ctx), retry.id);
      if (p && created && (await isOpen(ctx, p, created.created_at))) {
        await ask(ctx, user, p);
        sent++;
        continue;
      }
    }
    // 2) propostas com PDF há 3+ dias, ainda sem pergunta
    const rows = await ctx.db.all<{ id: string; created_at: string }>(
      "SELECT DISTINCT s.id, s.created_at FROM quote_snapshots s JOIN quote_documents d ON d.snapshot_id = s.id AND d.kind = 'COMERCIAL' AND d.preliminary = 0 WHERE s.created_at <= ? AND s.created_at >= ? AND NOT EXISTS (SELECT 1 FROM scheduled_reminders r WHERE r.dedupe_key = 'followup:' || s.id || ':1') ORDER BY s.created_at",
      cutoff,
      new Date(now.getTime() - 45 * 86400_000).toISOString(),
    );
    for (const r of rows) {
      const p = await proposal(ctx, r.id);
      if (!p || !(await isOpen(ctx, p, r.created_at))) continue;
      const ins = await ctx.db.run(
        "INSERT OR IGNORE INTO scheduled_reminders (id, user_id, job_id, kind, due_at, sent_at, dedupe_key, created_at) VALUES (?, ?, ?, 'followup', ?, ?, ?, ?)",
        newId(),
        user.id,
        p.quotes[0]!.jobId,
        nowIso(ctx),
        nowIso(ctx),
        `followup:${p.snapshotId}:1`,
        nowIso(ctx),
      );
      if (!ins) continue;
      await ask(ctx, user, p);
      sent++;
      break;
    }
  }
  return sent;
}

/** Botão da pergunta: Fechou / Não fechou / Ainda não. Resposta curta e fixa (sem Claude). */
export async function answerFollowup(ctx: Ctx, user: User, action: string, snapshotId: string): Promise<string> {
  const p = await proposal(ctx, snapshotId);
  if (!p) return "Não achei esse orçamento. 🤔";
  const created = await ctx.db.first<{ created_at: string }>("SELECT created_at FROM quote_snapshots WHERE id = ?", snapshotId);
  if (!created || !(await isOpen(ctx, p, created.created_at))) return "Esse já está anotado. 🙂";
  const { pieces, total } = await describe(ctx, p);
  if (action === "yes") {
    for (const q of p.quotes) await markQuoteOutcome(ctx, q.id, user.id, "ACEITO");
    return `Show! 🎉 Anotei que fechou: ${pieces} (${total}). Já tá na sua fila. Quando começar, me avisa!`;
  }
  if (action === "no") {
    for (const q of p.quotes) await markQuoteOutcome(ctx, q.id, user.id, "RECUSADO");
    return "Poxa 😕 Anotei que não fechou. Bora pro próximo!";
  }
  await ctx.db.run(
    "INSERT OR IGNORE INTO scheduled_reminders (id, user_id, job_id, kind, due_at, sent_at, dedupe_key, created_at) VALUES (?, ?, ?, 'followup_retry', ?, NULL, ?, ?)",
    newId(),
    user.id,
    p.quotes[0]!.jobId,
    new Date(ctx.clock().getTime() + FOLLOWUP_RETRY_DAYS * 86400_000).toISOString(),
    `followup:${p.snapshotId}:2`,
    nowIso(ctx),
  );
  return "Beleza! Daqui uns dias eu pergunto de novo. 😉";
}
