import { parseProactiveSettings, ProactiveSettingsSchema, type ProactiveSettings } from "@adripatina/conversations";
import type { Ctx } from "../../context.js";
import { nowIso } from "../../context.js";
import { auditStmt } from "../../repos/audit.js";

const KEY = "proactive_settings";

/** Configuração da coleta proativa (system_flags). Sem linha → padrões conservadores (desligada). */
export async function getProactiveSettings(ctx: Ctx): Promise<ProactiveSettings> {
  try {
    const r = await ctx.db.first<{ value_json: string }>("SELECT value_json FROM system_flags WHERE key = ?", KEY);
    return parseProactiveSettings(r ? JSON.parse(r.value_json) : {});
  } catch {
    // migration ainda não aplicada ou JSON corrompido: comportamento seguro = desligada
    return parseProactiveSettings({});
  }
}

export async function saveProactiveSettings(ctx: Ctx, patch: Record<string, unknown>, actor: string): Promise<ProactiveSettings> {
  const before = await getProactiveSettings(ctx);
  const merged = ProactiveSettingsSchema.parse({
    ...before,
    ...patch,
    validity: { ...before.validity, ...((patch.validity as object | undefined) ?? {}) },
    kinds: { ...before.kinds, ...((patch.kinds as object | undefined) ?? {}) },
  });
  const now = nowIso(ctx);
  await ctx.db.batch([
    ctx.db.stmt(
      "INSERT INTO system_flags (key, value_json, updated_by, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_by = excluded.updated_by, updated_at = excluded.updated_at",
      KEY,
      JSON.stringify(merged),
      actor,
      now,
    ),
    auditStmt(ctx, actor, "proactive.settings", "system_flags", KEY, before, merged),
  ]);
  return merged;
}
