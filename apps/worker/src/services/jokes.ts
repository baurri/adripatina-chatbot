import { localDateKey, newId } from "@adripatina/shared";
import type { Ctx } from "../context.js";
import { nowIso } from "../context.js";
import { listArtisans } from "../repos/users.js";
import { loadSession, logMessage } from "../repos/sessions.js";
import { listOpenForUser } from "./proactive/repo.js";

/**
 * D-084 — PIADINHA DO DIA. Quando não há nada pra perguntar (a coleta proativa não tem nenhum dado
 * faltando nem pergunta aberta) e o dia está calmo, o bot manda uma piadinha pra animar o Adriano —
 * no máximo uma por dia, num horário sorteado entre 10h e 17h, nunca no meio de uma conversa, sem
 * repetir as últimas. As duas primeiras são as que ele adora (vêm com mais frequência).
 */
export const JOKES: { text: string; weight: number }[] = [
  { text: "Adriano, você pinta como eu pinto? 😄", weight: 4 },
  { text: "Adriano, uma sala tem 4 cantos, cada canto tem um gato, cada gato vê 3 gatos. Quantos gatos tem na sala? 🐱🤔", weight: 3 },
  { text: "Adriano, sabe a diferença entre o pinto e o pintor? O pinto pia, o pintor pinta... e às vezes pia também, quando vê o preço da tinta! 😂", weight: 1 },
  { text: "Adriano, qual é o pinto mais trabalhador do mundo? O que pinta de segunda a sábado! 🐥🖌️", weight: 1 },
  { text: "Adriano, o que a tinta disse pra parede? \"Fica tranquila, que eu te cubro!\" 🎨😄", weight: 1 },
  { text: "Adriano, por que o pincel foi ao médico? Tava com as cerdas todas em pé! 🖌️😄", weight: 1 },
  { text: "Adriano, por que o pintor nunca guarda mágoa? Porque ele sempre passa uma demão por cima! 😄", weight: 1 },
  { text: "Adriano, o que o verniz falou pro móvel velho? \"Deixa comigo que eu te dou um brilho!\" ✨😄", weight: 1 },
  { text: "Adriano, o que a lixa disse pra madeira? \"Vamos aparar as arestas?\" 😄", weight: 1 },
  { text: "Adriano, sabe por que o pinto atravessou a oficina? Pra ver o mestre pintando! 🐥🎨", weight: 1 },
];

const QUIET_MS = 2 * 3600_000;
const NO_REPEAT = 4;

/** Hora do dia (10–17, horário de Brasília) em que a piadinha pode sair — muda a cada dia. */
export function jokeHour(day: string): number {
  let h = 0;
  for (const ch of day) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return 10 + (h % 8);
}

function localHour(d: Date): number {
  return Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", hour: "2-digit", hour12: false }).format(d)) % 24;
}

/** Sorteia uma piada (com peso), fora das últimas mandadas. */
export function pickJoke(recent: number[], rnd = Math.random()): number {
  const pool = JOKES.map((j, i) => ({ i, w: j.weight })).filter((x) => !recent.includes(x.i));
  const list = pool.length ? pool : JOKES.map((j, i) => ({ i, w: j.weight }));
  const total = list.reduce((a, x) => a + x.w, 0);
  let r = rnd * total;
  for (const x of list) {
    if ((r -= x.w) < 0) return x.i;
  }
  return list.at(-1)!.i;
}

/** Cron: no máximo uma piadinha por dia por artesão, só quando não há nada pra perguntar. */
export async function runJokes(ctx: Ctx): Promise<number> {
  if (!ctx.config.jokes) return 0;
  const now = ctx.clock();
  const day = localDateKey(now);
  const hour = localHour(now);
  if (hour < jokeHour(day) || hour > 17) return 0;
  let sent = 0;
  for (const user of await listArtisans(ctx)) {
    if (!user.telegramChatId) continue;
    // nada a perguntar: nenhuma solicitação de dado aberta (estoque e preços em dia)
    if ((await listOpenForUser(ctx, user.id)).length) continue;
    // nenhuma pergunta de coleta hoje e nada nas últimas 2 h (nunca no meio de uma conversa)
    const last = await ctx.db.first<{ created_at: string }>("SELECT created_at FROM conversation_messages WHERE user_id = ? ORDER BY created_at DESC LIMIT 1", user.id);
    if (last && now.getTime() - Date.parse(last.created_at) < QUIET_MS) continue;
    const dayStart = new Date(now.getTime() - 20 * 3600_000).toISOString();
    const asked = await ctx.db.first("SELECT 1 FROM data_collection_requests WHERE user_id = ? AND last_sent_at >= ? LIMIT 1", user.id, dayStart);
    if (asked) continue;
    const recent = (await ctx.db.all<{ kind: string }>("SELECT kind FROM scheduled_reminders WHERE user_id = ? AND kind LIKE 'piada:%' ORDER BY created_at DESC LIMIT ?", user.id, NO_REPEAT)).map((r) => Number(r.kind.split(":")[1]));
    const idx = pickJoke(recent);
    const ins = await ctx.db.run(
      "INSERT OR IGNORE INTO scheduled_reminders (id, user_id, kind, due_at, sent_at, dedupe_key, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      newId(),
      user.id,
      `piada:${idx}`,
      nowIso(ctx),
      nowIso(ctx),
      `piada:${user.id}:${day}`,
      nowIso(ctx),
    );
    if (!ins) continue;
    const first = user.displayName.split(" ")[0] ?? "";
    const text = first ? JOKES[idx]!.text.replace(/^Adriano/, first) : JOKES[idx]!.text;
    await ctx.telegram.sendMessage(user.telegramChatId, text);
    const session = await loadSession(ctx, user.id);
    await logMessage(ctx, { sessionId: session.id, userId: user.id, jobId: null, direction: "out", kind: "text", text });
    sent++;
  }
  return sent;
}
