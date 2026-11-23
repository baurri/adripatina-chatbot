import type { Role } from "@adripatina/domain";
import { newId } from "@adripatina/shared";
import { z } from "zod";
import type { Ctx } from "../context.js";
import { nowIso } from "../context.js";
import { auditStmt } from "../repos/audit.js";
import { enqueueOutbox } from "./outbox.js";
import { DomainError } from "./quotes.js";

export interface AccessRequest {
  id: string;
  telegram_user_id: string;
  telegram_chat_id: string;
  first_name: string | null;
  username: string | null;
  attempts: number;
  status: "PENDENTE" | "APROVADO" | "RECUSADO";
  user_id: string | null;
  decided_at: string | null;
  first_seen_at: string;
  last_seen_at: string;
}

/**
 * Registra (ou atualiza) um pedido de acesso de remetente desconhecido.
 * Não concede nada: só o ADMIN aprova pelo painel. Recusados não voltam a notificar.
 */
export async function recordAccessRequest(ctx: Ctx, from: { id: number; first_name?: string | undefined; username?: string | undefined }, chatId: string): Promise<void> {
  const now = nowIso(ctx);
  const firstName = from.first_name?.trim().slice(0, 60) || null;
  const username = from.username?.trim().slice(0, 60) || null;
  const existing = await ctx.db.first<{ id: string; status: string }>("SELECT id, status FROM access_requests WHERE telegram_user_id = ?", String(from.id));
  if (existing) {
    await ctx.db.run(
      "UPDATE access_requests SET attempts = MIN(attempts + 1, 1000000), last_seen_at = ?, first_name = COALESCE(?, first_name), username = COALESCE(?, username), telegram_chat_id = ? WHERE id = ?",
      now,
      firstName,
      username,
      chatId,
      existing.id,
    );
    return;
  }
  const id = newId();
  await ctx.db.run(
    "INSERT INTO access_requests (id, telegram_user_id, telegram_chat_id, first_name, username, first_seen_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    id,
    String(from.id),
    chatId,
    firstName,
    username,
    now,
    now,
  );
  await enqueueOutbox(ctx, "notify_admins", { text: `Novo pedido de acesso ao bot: ${firstName ?? "sem nome"}. Aprove ou recuse no painel (Usuários → Pedidos de acesso).` }, `access-request:${id}`);
}

export async function listAccessRequests(ctx: Ctx, status = "PENDENTE"): Promise<AccessRequest[]> {
  return ctx.db.all<AccessRequest>("SELECT * FROM access_requests WHERE status = ? ORDER BY last_seen_at DESC LIMIT 100", status);
}

export const ApproveAccessSchema = z.union([
  z.object({ mode: z.literal("new"), role: z.enum(["ARTESAO", "ADMIN"]), displayName: z.string().trim().min(2).max(60) }),
  z.object({ mode: z.literal("link"), userId: z.string().min(1) }),
]);

/** Aprova: cria um usuário novo ou vincula o Telegram a um usuário existente (ex.: admin do painel). */
export async function approveAccessRequest(ctx: Ctx, requestId: string, adminId: string, raw: unknown): Promise<{ userId: string }> {
  const body = ApproveAccessSchema.parse(raw);
  const req = await ctx.db.first<AccessRequest>("SELECT * FROM access_requests WHERE id = ?", requestId);
  if (!req) throw new DomainError("NOT_FOUND", "Pedido não encontrado", 404);
  if (req.status === "APROVADO") throw new DomainError("INVALID", "Esse pedido já foi aprovado.", 422);
  const taken = await ctx.db.first<{ id: string }>("SELECT id FROM users WHERE telegram_user_id = ?", req.telegram_user_id);
  if (taken) throw new DomainError("INVALID", "Esse Telegram já está vinculado a outro usuário.", 422);
  const now = nowIso(ctx);
  let userId: string;
  let role: Role;
  let name: string;
  const stmts: D1PreparedStatement[] = [];
  if (body.mode === "link") {
    const user = await ctx.db.first<{ id: string; role: Role; display_name: string; telegram_user_id: string | null }>("SELECT id, role, display_name, telegram_user_id FROM users WHERE id = ? AND active = 1", body.userId);
    if (!user) throw new DomainError("NOT_FOUND", "Usuário não encontrado", 404);
    if (user.telegram_user_id) throw new DomainError("INVALID", "Esse usuário já tem um Telegram vinculado.", 422);
    userId = user.id;
    role = user.role;
    name = user.display_name;
    stmts.push(ctx.db.stmt("UPDATE users SET telegram_user_id = ?, telegram_chat_id = ?, updated_at = ? WHERE id = ?", req.telegram_user_id, req.telegram_chat_id, now, userId));
  } else {
    userId = newId();
    role = body.role;
    name = body.displayName;
    stmts.push(
      ctx.db.stmt(
        "INSERT INTO users (id, role, display_name, telegram_user_id, telegram_chat_id, active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, ?, ?)",
        userId,
        role,
        name,
        req.telegram_user_id,
        req.telegram_chat_id,
        now,
        now,
      ),
    );
  }
  stmts.push(
    ctx.db.stmt("UPDATE access_requests SET status = 'APROVADO', user_id = ?, decided_by = ?, decided_at = ? WHERE id = ?", userId, adminId, now, requestId),
    auditStmt(ctx, adminId, "access_request.approve", "user", userId, undefined, { role, mode: body.mode, displayName: name }),
  );
  await ctx.db.batch(stmts);
  const firstName = name.split(" ")[0] ?? name;
  await enqueueOutbox(
    ctx,
    "telegram_message",
    { chatId: req.telegram_chat_id, text: `Pronto, ${firstName}! Seu acesso foi liberado. Mande /start para começar.` },
    `access-approved:${requestId}`,
  );
  return { userId };
}

export async function rejectAccessRequest(ctx: Ctx, requestId: string, adminId: string): Promise<void> {
  const req = await ctx.db.first<{ status: string }>("SELECT status FROM access_requests WHERE id = ?", requestId);
  if (!req) throw new DomainError("NOT_FOUND", "Pedido não encontrado", 404);
  if (req.status === "APROVADO") throw new DomainError("INVALID", "Pedido já aprovado. Para remover o acesso, desative o usuário.", 422);
  const now = nowIso(ctx);
  await ctx.db.batch([
    ctx.db.stmt("UPDATE access_requests SET status = 'RECUSADO', decided_by = ?, decided_at = ? WHERE id = ?", adminId, now, requestId),
    auditStmt(ctx, adminId, "access_request.reject", "access_request", requestId, undefined, undefined),
  ]);
}
