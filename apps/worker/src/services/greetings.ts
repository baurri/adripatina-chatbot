import { localDateKey, newId } from "@adripatina/shared";
import type { Ctx } from "../context.js";
import { nowIso } from "../context.js";
import { listArtisans } from "../repos/users.js";
import { loadSession, logMessage } from "../repos/sessions.js";

/**
 * D-083 — BOM DIA E BOA NOITE. Toda manhã às 07h30 e toda noite às 23h10 (horário de Brasília) o bot
 * cumprimenta o artesão. De manhã lembra que pode chamar o assistente pra orçar e pra consultar coisas de
 * antes; à noite se oferece pra ajudar e deseja bom descanso. Com pacotes de figurinhas configurados
 * (STICKERS_BOM_DIA / STICKERS_BOA_NOITE), vai junto uma figurinha sorteada. Uma vez por dia cada.
 */
export type GreetingKind = "bom_dia" | "boa_noite";

/** Janela de cada cumprimento (minutos desde 00h00, horário de Brasília). O cron roda a cada 15 min + 23h10. */
const WINDOWS: Record<GreetingKind, [number, number]> = {
  bom_dia: [7 * 60 + 30, 7 * 60 + 45],
  boa_noite: [23 * 60 + 10, 23 * 60 + 25],
};

const MORNING = [
  (n: string) => `Bom dia${n}! ☀️ Que seu dia seja ótimo.\n\nQualquer dúvida, é só me chamar aqui: pra fazer um orçamento ou pra consultar alguma coisa de antes (um cliente, um valor, uma peça). Tô por aqui! 🙂`,
  (n: string) => `Bom dia${n}! ☀️ Bom trabalho hoje!\n\nNão esquece de mim: se quiser fazer um orçamento ou lembrar de algo que já conversamos, é só mandar uma mensagem ou um áudio. 🙂`,
  (n: string) => `Bom dia${n}! ☀️☕\n\nSe aparecer cliente pedindo orçamento, ou se bater dúvida sobre um serviço de antes, me chama aqui que eu te ajudo. 🙂`,
];

const NIGHT = [
  (n: string) => `Boa noite${n}! 🌙\n\nSe precisar de alguma coisa, é só me chamar aqui. Bom descanso! 😴`,
  (n: string) => `Boa noite${n}! 🌙 Obrigado pelo dia.\n\nSe lembrar de algo pra anotar ou orçar, me manda aqui, a qualquer hora. Descansa bem! 😴`,
  (n: string) => `Boa noite${n}! 🌙✨\n\nTô por aqui se precisar de ajuda. Tenha um ótimo descanso! 😴`,
];

function localMinutes(d: Date): number {
  const [h, m] = new Intl.DateTimeFormat("en-GB", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d).split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export function greetingDue(d: Date): GreetingKind | null {
  const m = localMinutes(d);
  for (const k of Object.keys(WINDOWS) as GreetingKind[]) {
    const [a, b] = WINDOWS[k];
    if (m >= a && m < b) return k;
  }
  return null;
}

export function greetingText(kind: GreetingKind, firstName: string, pick = Math.random()): string {
  const list = kind === "bom_dia" ? MORNING : NIGHT;
  return list[Math.floor(pick * list.length) % list.length]!(firstName ? `, ${firstName}` : "");
}

/** Figurinha sorteada de um dos pacotes; null quando não há pacote ou o Telegram falha (a mensagem vai sem). */
async function pickSticker(ctx: Ctx, kind: GreetingKind): Promise<string | null> {
  const packs = kind === "bom_dia" ? ctx.config.stickersMorning : ctx.config.stickersNight;
  if (!packs.length || !ctx.telegram.getStickerSet || !ctx.telegram.sendSticker) return null;
  const pack = packs[Math.floor(Math.random() * packs.length)]!;
  try {
    const ids = await ctx.telegram.getStickerSet(pack);
    return ids.length ? ids[Math.floor(Math.random() * ids.length)]! : null;
  } catch (err) {
    console.error(JSON.stringify({ level: "error", msg: "sticker_set_failed", pack, error: err instanceof Error ? err.message.slice(0, 200) : "unknown" }));
    return null;
  }
}

/** Cron: manda o cumprimento da hora, uma vez por dia por artesão. Devolve quantos mandou. */
export async function runGreetings(ctx: Ctx): Promise<number> {
  if (!ctx.config.greetings) return 0;
  const now = ctx.clock();
  const kind = greetingDue(now);
  if (!kind) return 0;
  const day = localDateKey(now);
  let sent = 0;
  for (const user of await listArtisans(ctx)) {
    if (!user.telegramChatId) continue;
    const ins = await ctx.db.run(
      "INSERT OR IGNORE INTO scheduled_reminders (id, user_id, kind, due_at, sent_at, dedupe_key, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      newId(),
      user.id,
      kind,
      nowIso(ctx),
      nowIso(ctx),
      `${kind}:${user.id}:${day}`,
      nowIso(ctx),
    );
    if (!ins) continue;
    const sticker = await pickSticker(ctx, kind);
    if (sticker) {
      try {
        await ctx.telegram.sendSticker!(user.telegramChatId, sticker);
      } catch (err) {
        console.error(JSON.stringify({ level: "error", msg: "sticker_send_failed", error: err instanceof Error ? err.message.slice(0, 200) : "unknown" }));
      }
    }
    const text = greetingText(kind, user.displayName.split(" ")[0] ?? "");
    await ctx.telegram.sendMessage(user.telegramChatId, text);
    const session = await loadSession(ctx, user.id);
    await logMessage(ctx, { sessionId: session.id, userId: user.id, jobId: null, direction: "out", kind: "text", text });
    sent++;
  }
  return sent;
}
