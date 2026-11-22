import type { Role } from "@adripatina/domain";
import { newId } from "@adripatina/shared";
import type { Ctx } from "../context.js";
import { nowIso } from "../context.js";
import { bool } from "../db/sql.js";

export interface User {
  id: string;
  role: Role;
  displayName: string;
  telegramUserId: string | null;
  telegramChatId: string | null;
  adminEmail: string | null;
  active: boolean;
}

interface UserRow {
  id: string;
  role: Role;
  display_name: string;
  telegram_user_id: string | null;
  telegram_chat_id: string | null;
  admin_email: string | null;
  active: number;
}

function map(r: UserRow): User {
  return {
    id: r.id,
    role: r.role,
    displayName: r.display_name,
    telegramUserId: r.telegram_user_id,
    telegramChatId: r.telegram_chat_id,
    adminEmail: r.admin_email,
    active: bool(r.active),
  };
}

/** Autorização por telegram_user_id numérico — username NUNCA concede acesso. */
export async function findUserByTelegramId(ctx: Ctx, telegramUserId: number | string): Promise<User | null> {
  const r = await ctx.db.first<UserRow>("SELECT * FROM users WHERE telegram_user_id = ? AND active = 1", String(telegramUserId));
  return r ? map(r) : null;
}

export async function findAdminByEmail(ctx: Ctx, email: string): Promise<User | null> {
  const r = await ctx.db.first<UserRow>("SELECT * FROM users WHERE lower(admin_email) = lower(?) AND role = 'ADMIN' AND active = 1", email);
  return r ? map(r) : null;
}

export async function getUser(ctx: Ctx, id: string): Promise<User | null> {
  const r = await ctx.db.first<UserRow>("SELECT * FROM users WHERE id = ?", id);
  return r ? map(r) : null;
}

export async function listUsers(ctx: Ctx): Promise<User[]> {
  return (await ctx.db.all<UserRow>("SELECT * FROM users ORDER BY role, display_name")).map(map);
}

export async function listAdminsWithTelegram(ctx: Ctx): Promise<User[]> {
  return (
    await ctx.db.all<UserRow>("SELECT * FROM users WHERE role = 'ADMIN' AND active = 1 AND telegram_chat_id IS NOT NULL")
  ).map(map);
}

export async function listArtisans(ctx: Ctx): Promise<User[]> {
  return (await ctx.db.all<UserRow>("SELECT * FROM users WHERE role = 'ARTESAO' AND active = 1")).map(map);
}

export async function rememberChatId(ctx: Ctx, userId: string, chatId: string): Promise<void> {
  await ctx.db.run("UPDATE users SET telegram_chat_id = ?, updated_at = ? WHERE id = ? AND (telegram_chat_id IS NULL OR telegram_chat_id <> ?)", chatId, nowIso(ctx), userId, chatId);
}

export async function createUser(
  ctx: Ctx,
  u: { role: Role; displayName: string; telegramUserId?: string | null; adminEmail?: string | null },
): Promise<string> {
  const id = newId();
  const now = nowIso(ctx);
  await ctx.db.run(
    `INSERT INTO users (id, role, display_name, telegram_user_id, admin_email, active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, ?, ?)`,
    id,
    u.role,
    u.displayName,
    u.telegramUserId ?? null,
    u.adminEmail ?? null,
    now,
    now,
  );
  return id;
}
