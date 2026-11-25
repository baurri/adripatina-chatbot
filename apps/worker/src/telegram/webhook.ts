import { newId, sha256Hex, timingSafeEqual, addDays } from "@adripatina/shared";
import type { Ctx } from "../context.js";
import { nowIso } from "../context.js";
import { handleConversation, type EngineInput } from "../conversation/engine.js";
import { findUserByTelegramId, rememberChatId, type User } from "../repos/users.js";
import { loadSession, logMessage } from "../repos/sessions.js";
import { describeImage, transcribe, TranscriptionUnavailable } from "../ai/service.js";
import { MediaTooLargeError } from "./client.js";
import { recordAccessRequest } from "../services/access-requests.js";
import { TelegramUpdateSchema, type TelegramMessage, type TelegramUpdate } from "./types.js";

export type WebhookOutcome = "ok" | "duplicate" | "unauthorized_sender" | "ignored" | "invalid" | "failed";

export function verifyTelegramSecret(header: string | null | undefined, secret: string | undefined): boolean {
  if (!secret) return false;
  return timingSafeEqual(header ?? "", secret);
}

const GENERIC_DENIAL = "Desculpe, este bot é de uso privado. Se você trabalha com a adripatina, peça ao administrador para liberar seu acesso.";

/**
 * Processa um update:
 * validar → deduplicar por update_id → autorizar por telegram_user_id → mídia → conversa.
 */
export async function processUpdate(ctx: Ctx, raw: unknown): Promise<WebhookOutcome> {
  const parsed = TelegramUpdateSchema.safeParse(raw);
  if (!parsed.success) return "invalid";
  const update = parsed.data;

  // idempotência: update_id é PK; reentrega do webhook não reprocessa
  const inserted = await ctx.db.run(
    "INSERT INTO telegram_updates (update_id, received_at, status) VALUES (?, ?, 'processing') ON CONFLICT(update_id) DO NOTHING",
    update.update_id,
    nowIso(ctx),
  );
  if (inserted === 0) return "duplicate";

  try {
    const outcome = await route(ctx, update);
    await ctx.db.run("UPDATE telegram_updates SET status = ? WHERE update_id = ?", outcome === "ok" ? "done" : "ignored", update.update_id);
    return outcome;
  } catch (err) {
    await ctx.db.run("UPDATE telegram_updates SET status = 'failed', error = ? WHERE update_id = ?", String(err instanceof Error ? err.message : err).slice(0, 300), update.update_id);
    console.error(JSON.stringify({ level: "error", msg: "update_failed", updateId: update.update_id, requestId: ctx.requestId, error: err instanceof Error ? err.name : "unknown" }));
    const chatId = update.message?.chat.id ?? update.callback_query?.message?.chat.id;
    if (chatId !== undefined) {
      try {
        await ctx.telegram.sendMessage(String(chatId), "Tive um problema para processar sua mensagem agora. Nada do que já anotamos foi perdido. Pode tentar de novo daqui a pouco?");
      } catch {
        /* sem retorno possível */
      }
    }
    return "failed";
  }
}

async function route(ctx: Ctx, update: TelegramUpdate): Promise<WebhookOutcome> {
  if (update.callback_query) {
    const cq = update.callback_query;
    const user = await findUserByTelegramId(ctx, cq.from.id);
    await ctx.telegram.answerCallbackQuery(cq.id).catch(() => undefined);
    if (!user) return "unauthorized_sender";
    const chatId = String(cq.message?.chat.id ?? cq.from.id);
    await rememberChatId(ctx, user.id, chatId);
    const session = await loadSession(ctx, user.id);
    const inId = await logMessage(ctx, { sessionId: session.id, userId: user.id, jobId: session.activeJobId, direction: "in", kind: "callback", text: cq.data ?? "", updateId: update.update_id });
    return deliver(ctx, user, chatId, { user, chatId, kind: "callback", text: cq.data ?? "", inboundMessageId: inId });
  }

  const msg = update.message;
  if (!msg) return "ignored"; // edições e outros tipos são ignorados com segurança
  if (msg.chat.type !== "private") return "ignored";
  const from = msg.from;
  if (!from) return "ignored";
  const user = await findUserByTelegramId(ctx, from.id);
  if (!user) {
    // usuário inativo (desativado pelo admin) não gera pedido; os demais ficam registrados para aprovação
    const inactive = await ctx.db.first("SELECT id FROM users WHERE telegram_user_id = ?", String(from.id));
    if (!inactive && !from.is_bot) await recordAccessRequest(ctx, from, String(msg.chat.id));
    // negação genérica, sem revelar dados
    await ctx.telegram.sendMessage(String(msg.chat.id), GENERIC_DENIAL);
    return "unauthorized_sender";
  }
  const chatId = String(msg.chat.id);
  await rememberChatId(ctx, user.id, chatId);
  const session = await loadSession(ctx, user.id);

  if (msg.voice || msg.audio) return handleVoice(ctx, user, chatId, msg, update.update_id, session.id, session.activeJobId);
  if (msg.photo?.length) return handlePhoto(ctx, user, chatId, msg, update.update_id, session.id, session.activeJobId);
  if (msg.document) {
    await ctx.telegram.sendMessage(chatId, "Recebi um arquivo. Por enquanto eu entendo texto, áudio e fotos. Pode mandar como foto ou me contar por áudio?");
    return "ignored";
  }
  const text = msg.text ?? "";
  if (!text.trim()) return "ignored";
  const inId = await logMessage(ctx, { sessionId: session.id, userId: user.id, jobId: session.activeJobId, direction: "in", kind: "text", text: text.slice(0, 4000), updateId: update.update_id, messageId: msg.message_id });
  return deliver(ctx, user, chatId, { user, chatId, kind: "text", text: text.slice(0, 4000), inboundMessageId: inId });
}

async function deliver(ctx: Ctx, user: User, chatId: string, input: EngineInput): Promise<WebhookOutcome> {
  // uma mensagem por vez por artesão: a segunda espera a primeira terminar e já vê o estado novo
  // (antes: texto + botão juntos davam duas respostas; botão velho fechava em cima do recém-fechado)
  const token = await acquireUserLock(ctx, user.id);
  try {
    const replies = await handleConversation(ctx, input);
    const session = await loadSession(ctx, user.id);
    for (const r of replies) {
      if (r.document) await ctx.telegram.sendDocument(chatId, r.document.filename, r.document.bytes, r.document.caption);
      else await ctx.telegram.sendMessage(chatId, r.text, r.buttons);
      await logMessage(ctx, { sessionId: session.id, userId: user.id, jobId: session.activeJobId, direction: "out", kind: "text", text: r.text });
    }
    return "ok";
  } finally {
    if (token) await ctx.db.run("DELETE FROM user_locks WHERE user_id = ? AND token = ?", user.id, token).catch(() => undefined);
  }
}

export const userLock = { ttlMs: 90_000, waitMs: 60_000, pollMs: 400 };

/** Trava por artesão (D1). Espera a anterior até waitMs; se não conseguir, segue sem trava (nunca deixa sem resposta). */
async function acquireUserLock(ctx: Ctx, userId: string): Promise<string | null> {
  const token = crypto.randomUUID();
  const deadline = Date.now() + userLock.waitMs;
  for (;;) {
    const now = Date.now();
    const got = await ctx.db
      .run(
        "INSERT INTO user_locks (user_id, until_ms, token) VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET until_ms = excluded.until_ms, token = excluded.token WHERE user_locks.until_ms < ?",
        userId,
        now + userLock.ttlMs,
        token,
        now,
      )
      .catch(() => -1);
    if (got === -1) return null; // tabela ausente/erro: não trava
    if (got > 0) return token;
    if (Date.now() > deadline) return null;
    await new Promise((r) => setTimeout(r, userLock.pollMs));
  }
}

async function handleVoice(ctx: Ctx, user: User, chatId: string, msg: TelegramMessage, updateId: number, sessionId: string, jobId: string | null): Promise<WebhookOutcome> {
  const media = (msg.voice ?? msg.audio)!;
  // mesmo áudio reenviado (mesmo file_unique_id) não é reprocessado
  const already = await ctx.db.first<{ id: string; transcript: string | null }>(
    "SELECT id, transcript FROM conversation_messages WHERE telegram_file_unique_id = ? AND direction = 'in' AND status = 'ok' LIMIT 1",
    media.file_unique_id,
  );
  if (already) {
    await ctx.telegram.sendMessage(chatId, "Esse áudio eu já recebi e já anotei o que você disse. Se quiser mudar alguma coisa, é só me falar.");
    return "ok";
  }
  if (media.duration > ctx.config.audioMaxSeconds) {
    await ctx.telegram.sendMessage(chatId, `Esse áudio ficou um pouco longo (mais de ${Math.round(ctx.config.audioMaxSeconds / 60)} minutos). Pode mandar em partes menores?`);
    return "ignored";
  }
  if (media.file_size && media.file_size > ctx.config.audioMaxBytes) {
    await ctx.telegram.sendMessage(chatId, "Esse áudio é grande demais para mim. Pode mandar um mais curto?");
    return "ignored";
  }
  const mime = media.mime_type ?? "audio/ogg";
  if (!/^audio\/(ogg|mpeg|mp4|x-m4a|wav|webm|opus|aac)/.test(mime)) {
    await ctx.telegram.sendMessage(chatId, "Não consegui abrir esse formato de áudio. Pode gravar pelo próprio Telegram (segurando o microfone) ou escrever?");
    return "ignored";
  }
  let transcript: string;
  try {
    const { bytes } = await ctx.telegram.downloadFile(media.file_id, ctx.config.audioMaxBytes);
    // guarda o áudio no R2 privado conforme política de retenção
    const key = `audio/${newId()}.ogg`;
    await ctx.storage.put(key, bytes, { httpMetadata: { contentType: mime } });
    await ctx.db.run(
      "INSERT INTO attachments (id, r2_key, mime, size_bytes, sha256, telegram_file_unique_id, owner_user_id, job_id, classification, retention_until, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'audio', ?, ?)",
      newId(),
      key,
      mime,
      bytes.byteLength,
      await sha256Hex(bytes),
      media.file_unique_id,
      user.id,
      jobId,
      addDays(ctx.clock(), ctx.config.mediaRetentionDays).toISOString(),
      nowIso(ctx),
    );
    transcript = await transcribe(ctx, bytes, mime, media.duration);
  } catch (err) {
    await logMessage(ctx, { sessionId, userId: user.id, jobId, direction: "in", kind: "voice", updateId, messageId: msg.message_id, fileUniqueId: null, status: "failed_transcription" });
    let reply = "Não consegui entender o áudio agora. Pode mandar de novo ou escrever? Não perdi nada do que já anotamos.";
    if (err instanceof TranscriptionUnavailable && err.reason === "disabled") reply = "A transcrição de áudio ainda não está ligada. Por enquanto, pode escrever? Não perdi nada do que já anotamos.";
    if (err instanceof MediaTooLargeError) reply = "Esse áudio é grande demais para mim. Pode mandar um mais curto?";
    await ctx.telegram.sendMessage(chatId, reply);
    return "ok";
  }
  const inId = await logMessage(ctx, { sessionId, userId: user.id, jobId, direction: "in", kind: "voice", transcript, updateId, messageId: msg.message_id, fileUniqueId: media.file_unique_id });
  // eco com a transcrição inteira: ele confere o que o bot entendeu (limite do Telegram: 4096 caracteres)
  const heard = transcript.trim();
  await ctx.telegram.sendMessage(chatId, `🎧 Ouvi: "${heard.length > 3500 ? `${heard.slice(0, 3500)}…` : heard}"`);
  return deliver(ctx, user, chatId, { user, chatId, kind: "voice", text: transcript, inboundMessageId: inId });
}

async function handlePhoto(ctx: Ctx, user: User, chatId: string, msg: TelegramMessage, updateId: number, sessionId: string, jobId: string | null): Promise<WebhookOutcome> {
  const best = [...msg.photo!].sort((a, b) => b.width * b.height - a.width * a.height)[0]!;
  if (best.file_size && best.file_size > ctx.config.imageMaxBytes) {
    await ctx.telegram.sendMessage(chatId, "Essa foto é grande demais. Pode mandar uma menor?");
    return "ignored";
  }
  const { bytes } = await ctx.telegram.downloadFile(best.file_id, ctx.config.imageMaxBytes);
  const mime = sniffImage(bytes);
  if (!mime) {
    await ctx.telegram.sendMessage(chatId, "Não consegui abrir essa imagem. Pode mandar de novo como foto?");
    return "ignored";
  }
  const hash = await sha256Hex(bytes);
  const attId = newId();
  const key = `photos/${attId}.${mime === "image/png" ? "png" : "jpg"}`;
  await ctx.storage.put(key, bytes, { httpMetadata: { contentType: mime } });
  const caption = msg.caption ?? "";
  const classification = /\b(recibo|nota|cupom|comprovante)\b/i.test(caption) ? "recibo" : "foto_movel";
  const group = msg.media_group_id ?? null;
  await ctx.db.run(
    "INSERT INTO attachments (id, r2_key, mime, size_bytes, sha256, telegram_file_unique_id, owner_user_id, job_id, classification, retention_until, created_at, media_group_id) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?)",
    attId,
    key,
    mime,
    bytes.byteLength,
    hash,
    best.file_unique_id,
    user.id,
    classification,
    classification === "recibo" ? addDays(ctx.clock(), ctx.config.mediaRetentionDays).toISOString() : null,
    nowIso(ctx),
    group,
  );
  const inId = await logMessage(ctx, { sessionId, userId: user.id, jobId, direction: "in", kind: "photo", text: caption, updateId, messageId: msg.message_id, fileUniqueId: best.file_unique_id });
  if (group && ctx.ai.agent) {
    // álbum: várias fotos chegam juntas, cada uma num update. Espera o álbum terminar e só a ÚLTIMA
    // responde, olhando todas (antes eram 3 fotos → 3 respostas).
    const album = await albumLeader(ctx, group, attId);
    if (!album) return "ok";
    return deliver(ctx, user, chatId, { user, chatId, kind: "photo", text: album.caption, inboundMessageId: inId, photo: { attachmentId: attId, hash, visionHint: null, groupIds: album.ids } });
  }
  // com o motor novo, o próprio Claude olha a foto; o palpite do modelo de imagem só serve ao motor antigo
  const visionHint = classification === "foto_movel" && !ctx.ai.agent ? await describeImage(ctx, bytes, mime) : null;
  return deliver(ctx, user, chatId, { user, chatId, kind: "photo", text: caption, inboundMessageId: inId, photo: { attachmentId: attId, hash, visionHint } });
}

/** Quanto esperar as outras fotos do álbum chegarem (os testes zeram). */
export const albumWait = { ms: 2500 };

/**
 * Null = outra foto do mesmo álbum responde (ou o álbum já foi respondido: a foto atrasada vai pro mesmo
 * serviço, calada). Senão: todas as fotos do álbum e a legenda (vem numa só).
 */
async function albumLeader(ctx: Ctx, group: string, attId: string): Promise<{ ids: string[]; caption: string } | null> {
  const before = await ctx.db.all<{ id: string; job_id: string | null }>("SELECT id, job_id FROM attachments WHERE media_group_id = ? AND id <> ? AND deleted_at IS NULL", group, attId);
  const handled = before.find((r) => r.job_id);
  if (handled) {
    await ctx.db.run("UPDATE attachments SET job_id = ? WHERE id = ?", handled.job_id, attId);
    return null;
  }
  if (albumWait.ms > 0) await new Promise((r) => setTimeout(r, albumWait.ms));
  const all = await ctx.db.all<{ id: string; fu: string | null }>("SELECT id, telegram_file_unique_id fu FROM attachments WHERE media_group_id = ? AND deleted_at IS NULL ORDER BY rowid", group);
  if (all.at(-1)?.id !== attId) return null;
  const caps = await ctx.db.all<{ text: string | null }>(
    `SELECT text FROM conversation_messages WHERE kind = 'photo' AND direction = 'in' AND telegram_file_unique_id IN (${all.map(() => "?").join(",")})`,
    ...all.map((r) => r.fu ?? ""),
  );
  return { ids: all.map((r) => r.id), caption: caps.map((c) => (c.text ?? "").trim()).filter(Boolean).join("\n") };
}

/** Valida MIME pelos bytes (não confia na extensão). */
export function sniffImage(b: Uint8Array): "image/jpeg" | "image/png" | null {
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  return null;
}
