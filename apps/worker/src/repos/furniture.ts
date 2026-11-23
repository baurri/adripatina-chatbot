import {
  AMBIGUOUS_TERMS,
  CATALOG_SOURCES,
  DAMAGES,
  FURNITURE_CATALOG,
  PARTS,
  type CatalogType,
  type DimensionPolicy,
  type FurnitureCategory,
  type MeasurementSchema,
  type QuoteFieldKey,
  type SizePreset,
} from "@adripatina/conversations";
import { newId, normalizeText } from "@adripatina/shared";
import type { Ctx } from "../context.js";
import { nowIso } from "../context.js";
import { bool, json } from "../db/sql.js";
import { auditStmt } from "./audit.js";

/**
 * Catálogo mestre de móveis no D1.
 * - Carga idempotente (INSERT OR IGNORE): rodar de novo não duplica nem sobrescreve edições do admin.
 * - Leitura com fallback para o catálogo do código (migration ainda não aplicada, tabela vazia).
 * - Nada é apagado fisicamente: tipos e aliases são inativados.
 */

export interface LoadedCatalog {
  types: CatalogType[];
  ambiguous: Record<string, string[]>;
  source: "db" | "code";
}

const normAlias = (a: string) => normalizeText(a).replace(/-/g, " ").replace(/\s+/g, " ").trim();

/** Carga/sincronização idempotente do catálogo do código para o banco. Devolve quantas linhas novas entraram. */
export async function syncFurnitureCatalog(ctx: Ctx): Promise<{ inserted: number }> {
  const now = nowIso(ctx);
  const stmts: D1PreparedStatement[] = [];
  for (const s of CATALOG_SOURCES) {
    stmts.push(ctx.db.stmt("INSERT OR IGNORE INTO furniture_sources (key, kind, title, url, note, created_at) VALUES (?, ?, ?, ?, ?, ?)", s.key, s.kind, s.title, s.url, s.note, now));
  }
  for (const p of PARTS) stmts.push(ctx.db.stmt("INSERT OR IGNORE INTO furniture_part_vocabulary (key, label, variants_json, measurable) VALUES (?, ?, ?, ?)", p.key, p.label, JSON.stringify(p.variants), p.measurable ? 1 : 0));
  for (const d of DAMAGES) stmts.push(ctx.db.stmt("INSERT OR IGNORE INTO furniture_damage_vocabulary (key, label, variants_json, severity) VALUES (?, ?, ?, ?)", d.key, d.label, JSON.stringify(d.variants), d.severity));
  for (const t of FURNITURE_CATALOG) {
    stmts.push(
      ctx.db.stmt(
        `INSERT OR IGNORE INTO furniture_types (canonical_key, display_name, category, description, active, legacy_key, feminine, dimension_policy, measurement_schema, typical_ranges_json, common_materials_json, common_services_json, common_damage_json, required_fields_json, optional_fields_json, has_interior, outdoor, upholstered, source_key, origin, created_at, updated_at)
         VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'seed', ?, ?)`,
        t.key,
        t.name,
        t.category,
        t.description,
        t.legacyKey,
        t.feminine ? 1 : 0,
        t.dimensionPolicy,
        t.measurementSchema,
        JSON.stringify(t.typicalRanges),
        JSON.stringify(t.commonMaterials),
        JSON.stringify(t.commonServices),
        JSON.stringify(t.commonDamage),
        JSON.stringify(t.requiredQuoteFields),
        JSON.stringify(t.optionalQuoteFields),
        t.hasInterior ? 1 : 0,
        t.outdoor ? 1 : 0,
        t.upholstered,
        t.sourceKey,
        now,
        now,
      ),
    );
    for (const a of t.aliases) {
      stmts.push(ctx.db.stmt("INSERT OR IGNORE INTO furniture_aliases (id, furniture_type_key, alias, normalized_alias, confidence, active, origin, created_at) VALUES (?, ?, ?, ?, 1, 1, 'seed', ?)", newId(), t.key, a, normAlias(a), now));
    }
    t.parts.forEach((p, i) => stmts.push(ctx.db.stmt("INSERT OR IGNORE INTO furniture_type_parts (furniture_type_key, part_key, sort) VALUES (?, ?, ?)", t.key, p, i)));
    t.presets.forEach((p, i) => {
      const dims = Object.fromEntries((["widthCm", "lengthCm", "depthCm", "heightCm", "diameterCm"] as const).filter((k) => p[k] !== undefined).map((k) => [k, p[k]]));
      stmts.push(
        ctx.db.stmt(
          `INSERT OR IGNORE INTO furniture_size_presets (preset_key, furniture_type_key, label, dimension_kind, shape, dims_json, is_market_reference, is_standardized, requires_confirmation, auto_suggest, source_key, note, active, sort)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
          p.key,
          t.key,
          p.label,
          p.dimensionKind,
          p.shape ?? null,
          JSON.stringify(dims),
          p.isMarketReference ? 1 : 0,
          p.isStandardized ? 1 : 0,
          p.requiresConfirmation ? 1 : 0,
          p.autoSuggest ? 1 : 0,
          p.sourceKey,
          p.note ?? null,
          i,
        ),
      );
    });
  }
  for (const [term, keys] of Object.entries(AMBIGUOUS_TERMS)) {
    stmts.push(ctx.db.stmt("INSERT OR IGNORE INTO furniture_ambiguous_terms (term, candidates_json, active) VALUES (?, ?, 1)", term, JSON.stringify(keys)));
  }
  let inserted = 0;
  // lotes: D1 aceita batches grandes, mas lotes menores reduzem o risco de timeout
  for (let i = 0; i < stmts.length; i += 80) {
    const res = await ctx.db.batch(stmts.slice(i, i + 80));
    for (const r of res) inserted += r.meta?.changes ?? 0;
  }
  return { inserted };
}

interface TypeRow {
  canonical_key: string;
  display_name: string;
  category: string;
  description: string;
  active: number;
  legacy_key: string | null;
  feminine: number;
  dimension_policy: string;
  measurement_schema: string;
  typical_ranges_json: string;
  common_materials_json: string;
  common_services_json: string;
  common_damage_json: string;
  required_fields_json: string;
  optional_fields_json: string;
  has_interior: number;
  outdoor: number;
  upholstered: string;
  source_key: string | null;
}

interface PresetRow {
  preset_key: string;
  furniture_type_key: string;
  label: string;
  dimension_kind: SizePreset["dimensionKind"];
  shape: SizePreset["shape"] | null;
  dims_json: string;
  is_market_reference: number;
  is_standardized: number;
  requires_confirmation: number;
  auto_suggest: number;
  source_key: string | null;
  note: string | null;
  active: number;
}

const cache = new WeakMap<object, { at: number; value: LoadedCatalog }>();
const CACHE_MS = 60_000;

export function invalidateFurnitureCache(ctx: Ctx): void {
  cache.delete(ctx.db.d1 as object);
}

/** Catálogo ativo (tipos inativos vêm com active=false e são ignorados pelo matcher). */
export async function loadFurnitureCatalog(ctx: Ctx): Promise<LoadedCatalog> {
  const key = ctx.db.d1 as object;
  const hit = cache.get(key);
  const now = ctx.clock().getTime();
  if (hit && now - hit.at < CACHE_MS && now >= hit.at) return hit.value;
  let value: LoadedCatalog;
  try {
    let count = (await ctx.db.first<{ n: number }>("SELECT COUNT(*) AS n FROM furniture_types"))?.n ?? 0;
    if (count === 0) {
      await syncFurnitureCatalog(ctx);
      count = (await ctx.db.first<{ n: number }>("SELECT COUNT(*) AS n FROM furniture_types"))?.n ?? 0;
    }
    if (count === 0) throw new Error("catalogo_vazio");
    const [types, aliases, parts, presets, terms] = await Promise.all([
      ctx.db.all<TypeRow>("SELECT * FROM furniture_types"),
      ctx.db.all<{ furniture_type_key: string; alias: string }>("SELECT furniture_type_key, alias FROM furniture_aliases WHERE active = 1"),
      ctx.db.all<{ furniture_type_key: string; part_key: string }>("SELECT furniture_type_key, part_key FROM furniture_type_parts ORDER BY sort"),
      ctx.db.all<PresetRow>("SELECT * FROM furniture_size_presets WHERE active = 1 ORDER BY sort"),
      ctx.db.all<{ term: string; candidates_json: string }>("SELECT term, candidates_json FROM furniture_ambiguous_terms WHERE active = 1"),
    ]);
    const group = <T extends { furniture_type_key: string }>(rows: T[]) => {
      const m = new Map<string, T[]>();
      for (const r of rows) m.set(r.furniture_type_key, [...(m.get(r.furniture_type_key) ?? []), r]);
      return m;
    };
    const aliasBy = group(aliases);
    const partBy = group(parts);
    const presetBy = group(presets);
    value = {
      source: "db",
      ambiguous: Object.fromEntries(terms.map((t) => [t.term, json<string[]>(t.candidates_json, [])])),
      types: types.map((r) => ({
        key: r.canonical_key,
        name: r.display_name,
        feminine: bool(r.feminine),
        category: r.category as FurnitureCategory,
        aliases: (aliasBy.get(r.canonical_key) ?? []).map((a) => a.alias),
        legacyKey: r.legacy_key,
        dimensionPolicy: r.dimension_policy as DimensionPolicy,
        measurementSchema: r.measurement_schema as MeasurementSchema,
        parts: (partBy.get(r.canonical_key) ?? []).map((p) => p.part_key),
        commonServices: json<string[]>(r.common_services_json, []),
        commonDamage: json<string[]>(r.common_damage_json, []),
        commonMaterials: json<string[]>(r.common_materials_json, []),
        typicalRanges: json(r.typical_ranges_json, {}),
        presets: (presetBy.get(r.canonical_key) ?? []).map((p) => ({
          key: p.preset_key,
          label: p.label,
          dimensionKind: p.dimension_kind,
          ...(p.shape ? { shape: p.shape } : {}),
          ...json<Partial<SizePreset>>(p.dims_json, {}),
          isMarketReference: bool(p.is_market_reference),
          isStandardized: bool(p.is_standardized),
          requiresConfirmation: bool(p.requires_confirmation),
          autoSuggest: bool(p.auto_suggest),
          sourceKey: p.source_key ?? "interno",
          ...(p.note ? { note: p.note } : {}),
        })),
        requiredQuoteFields: json<QuoteFieldKey[]>(r.required_fields_json, []),
        optionalQuoteFields: json<QuoteFieldKey[]>(r.optional_fields_json, []),
        hasInterior: bool(r.has_interior),
        outdoor: bool(r.outdoor),
        upholstered: r.upholstered as CatalogType["upholstered"],
        description: r.description,
        sourceKey: r.source_key ?? "interno",
        active: bool(r.active),
      })),
    };
  } catch {
    // migration ainda não aplicada (ou banco indisponível): usa o catálogo do código
    value = { source: "code", types: FURNITURE_CATALOG, ambiguous: AMBIGUOUS_TERMS };
  }
  cache.set(key, { at: now, value });
  return value;
}

// ------------------------------------------------------------------ edição administrativa

export interface FurnitureTypePatch {
  displayName?: string;
  category?: FurnitureCategory;
  description?: string;
  active?: boolean;
  dimensionPolicy?: DimensionPolicy;
  measurementSchema?: MeasurementSchema;
  typicalRanges?: Record<string, { min: number; max: number }>;
  requiredQuoteFields?: QuoteFieldKey[];
  optionalQuoteFields?: QuoteFieldKey[];
  hasInterior?: boolean;
  outdoor?: boolean;
}

export async function updateFurnitureType(ctx: Ctx, key: string, patch: FurnitureTypePatch, actor: string): Promise<boolean> {
  const before = await ctx.db.first<TypeRow>("SELECT * FROM furniture_types WHERE canonical_key = ?", key);
  if (!before) return false;
  const sets: string[] = [];
  const params: (string | number | null)[] = [];
  const set = (col: string, v: string | number | null) => {
    sets.push(`${col} = ?`);
    params.push(v);
  };
  if (patch.displayName !== undefined) set("display_name", patch.displayName);
  if (patch.category !== undefined) set("category", patch.category);
  if (patch.description !== undefined) set("description", patch.description);
  if (patch.active !== undefined) set("active", patch.active ? 1 : 0);
  if (patch.dimensionPolicy !== undefined) set("dimension_policy", patch.dimensionPolicy);
  if (patch.measurementSchema !== undefined) set("measurement_schema", patch.measurementSchema);
  if (patch.typicalRanges !== undefined) set("typical_ranges_json", JSON.stringify(patch.typicalRanges));
  if (patch.requiredQuoteFields !== undefined) set("required_fields_json", JSON.stringify(patch.requiredQuoteFields));
  if (patch.optionalQuoteFields !== undefined) set("optional_fields_json", JSON.stringify(patch.optionalQuoteFields));
  if (patch.hasInterior !== undefined) set("has_interior", patch.hasInterior ? 1 : 0);
  if (patch.outdoor !== undefined) set("outdoor", patch.outdoor ? 1 : 0);
  if (!sets.length) return true;
  set("updated_at", nowIso(ctx));
  await ctx.db.batch([
    ctx.db.stmt(`UPDATE furniture_types SET ${sets.join(", ")} WHERE canonical_key = ?`, ...params, key),
    auditStmt(ctx, actor, "furniture_type.update", "furniture_type", key, before, patch),
  ]);
  invalidateFurnitureCache(ctx);
  return true;
}

export async function createFurnitureType(
  ctx: Ctx,
  input: { key: string; displayName: string; category: FurnitureCategory; feminine?: boolean; legacyKey?: string | null; measurementSchema?: MeasurementSchema; aliases?: string[] },
  actor: string,
): Promise<"created" | "exists"> {
  const now = nowIso(ctx);
  const changed = await ctx.db.run(
    `INSERT OR IGNORE INTO furniture_types (canonical_key, display_name, category, description, active, legacy_key, feminine, dimension_policy, measurement_schema, required_fields_json, optional_fields_json, source_key, origin, created_at, updated_at)
     VALUES (?, ?, ?, '', 1, ?, ?, 'variable', ?, '["dimensions","work_scope"]', '[]', 'interno', 'admin', ?, ?)`,
    input.key,
    input.displayName,
    input.category,
    input.legacyKey ?? null,
    input.feminine ? 1 : 0,
    input.measurementSchema ?? "width_depth_height",
    now,
    now,
  );
  if (!changed) return "exists";
  for (const a of input.aliases ?? []) await addFurnitureAlias(ctx, input.key, a, actor);
  await ctx.db.batch([auditStmt(ctx, actor, "furniture_type.create", "furniture_type", input.key, null, input)]);
  invalidateFurnitureCache(ctx);
  return "created";
}

export async function addFurnitureAlias(ctx: Ctx, key: string, alias: string, actor: string): Promise<"added" | "exists" | "not_found"> {
  const type = await ctx.db.first("SELECT canonical_key FROM furniture_types WHERE canonical_key = ?", key);
  if (!type) return "not_found";
  const n = normAlias(alias);
  if (!n) return "exists";
  const changed = await ctx.db.run(
    "INSERT OR IGNORE INTO furniture_aliases (id, furniture_type_key, alias, normalized_alias, confidence, active, origin, created_at) VALUES (?, ?, ?, ?, 1, 1, 'admin', ?)",
    newId(),
    key,
    alias.trim(),
    n,
    nowIso(ctx),
  );
  if (!changed) {
    // reativa um alias inativado antes
    await ctx.db.run("UPDATE furniture_aliases SET active = 1 WHERE furniture_type_key = ? AND normalized_alias = ?", key, n);
    invalidateFurnitureCache(ctx);
    return "exists";
  }
  await ctx.db.batch([auditStmt(ctx, actor, "furniture_alias.add", "furniture_type", key, null, { alias })]);
  invalidateFurnitureCache(ctx);
  return "added";
}

export async function setFurnitureAliasActive(ctx: Ctx, key: string, alias: string, active: boolean, actor: string): Promise<boolean> {
  const changed = await ctx.db.run("UPDATE furniture_aliases SET active = ? WHERE furniture_type_key = ? AND normalized_alias = ?", active ? 1 : 0, key, normAlias(alias));
  if (changed) await ctx.db.batch([auditStmt(ctx, actor, active ? "furniture_alias.activate" : "furniture_alias.deactivate", "furniture_type", key, null, { alias })]);
  invalidateFurnitureCache(ctx);
  return changed > 0;
}
