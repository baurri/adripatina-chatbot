import { newId } from "@adripatina/shared";
import type { Ctx } from "../context.js";
import { nowIso } from "../context.js";
import { listAdminsWithTelegram, listArtisans } from "../repos/users.js";

/**
 * Padrão outbox em D1 + Cron (decisão D-006): notificações são gravadas com
 * chave de deduplicação e entregues com retry/backoff. Nada é perdido se o
 * Telegram estiver indisponível.
 */
export async function enqueueOutbox(ctx: Ctx, kind: string, payload: unknown, dedupeKey: string): Promise<void> {
  const now = nowIso(ctx);
  await ctx.db.run(
    "INSERT OR IGNORE INTO outbox_events (id, kind, payload_json, status, attempts, next_attempt_at, dedupe_key, created_at, updated_at) VALUES (?, ?, ?, 'PENDENTE', 0, ?, ?, ?, ?)",
    newId(),
    kind,
    JSON.stringify(payload),
    now,
    dedupeKey,
    now,
    now,
  );
}

const MAX_ATTEMPTS = 6;

export async function processOutbox(ctx: Ctx, limit = 20): Promise<{ sent: number; failed: number }> {
  const now = nowIso(ctx);
  const events = await ctx.db.all<{ id: string; kind: string; payload_json: string; attempts: number }>(
    "SELECT id, kind, payload_json, attempts FROM outbox_events WHERE status = 'PENDENTE' AND next_attempt_at <= ? ORDER BY created_at LIMIT ?",
    now,
    limit,
  );
  let sent = 0;
  let failed = 0;
  for (const ev of events) {
    try {
      await deliver(ctx, ev.kind, JSON.parse(ev.payload_json));
      await ctx.db.run("UPDATE outbox_events SET status = 'ENVIADO', attempts = attempts + 1, updated_at = ? WHERE id = ?", nowIso(ctx), ev.id);
      sent++;
    } catch (err) {
      const attempts = ev.attempts + 1;
      const backoffMin = Math.min(60, 2 ** attempts);
      const next = new Date(ctx.clock().getTime() + backoffMin * 60_000).toISOString();
      await ctx.db.run(
        "UPDATE outbox_events SET status = ?, attempts = ?, next_attempt_at = ?, last_error = ?, updated_at = ? WHERE id = ?",
        attempts >= MAX_ATTEMPTS ? "FALHOU" : "PENDENTE",
        attempts,
        next,
        String(err instanceof Error ? err.message : err).slice(0, 500),
        nowIso(ctx),
        ev.id,
      );
      failed++;
    }
  }
  return { sent, failed };
}

async function deliver(ctx: Ctx, kind: string, payload: Record<string, unknown>): Promise<void> {
  switch (kind) {
    case "notify_admins": {
      for (const a of await listAdminsWithTelegram(ctx)) await ctx.telegram.sendMessage(a.telegramChatId!, String(payload.text));
      return;
    }
    case "notify_artisans_quote_approved": {
      const quoteId = String(payload.quoteId);
      const q = await ctx.db.first<{ title: string; final_price_cents: number | null }>(
        "SELECT j.title, q.final_price_cents FROM quotes q JOIN jobs j ON j.id = q.job_id WHERE q.id = ?",
        quoteId,
      );
      for (const a of await listArtisans(ctx)) {
        if (!a.telegramChatId) continue;
        await ctx.telegram.sendMessage(a.telegramChatId, `${a.displayName}, o orçamento de ${q?.title ?? "um serviço"} foi aprovado. Quer que eu gere o PDF para você mandar ao cliente?`, [
          [
            { text: "Gerar PDF", data: `pdf:issue:${quoteId}` },
            { text: "Ainda não", data: "cmd:noop" },
          ],
        ]);
      }
      return;
    }
    case "telegram_message": {
      await ctx.telegram.sendMessage(String(payload.chatId), String(payload.text));
      return;
    }
    default:
      throw new Error(`Tipo de outbox desconhecido: ${kind}`);
  }
}
