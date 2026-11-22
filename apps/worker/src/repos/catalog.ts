import {
  DEMO_MATERIALS,
  DEMO_METHODS,
  DEMO_SETTINGS,
  DEMO_TECHNIQUES,
  PricingSettingsSchema,
  RecipeStepSchema,
  type MaterialDef,
  type MethodDef,
  type PricingCatalog,
  type PricingSettings,
  type TechniqueDef,
} from "@adripatina/pricing";
import { Dec, newId } from "@adripatina/shared";
import { z } from "zod";
import type { Ctx } from "../context.js";
import { nowIso } from "../context.js";
import { bool, json } from "../db/sql.js";
import { auditStmt } from "./audit.js";

export const BusinessSchema = z.object({
  name: z.string().min(1).default("adripatina"),
  tagline: z.string().nullable().default(null),
  phone: z.string().nullable().default(null),
  email: z.string().nullable().default(null),
  instagram: z.string().nullable().default(null),
  city: z.string().nullable().default(null),
  document: z.string().nullable().default(null),
  primaryColor: z.string().nullable().default(null),
  accentColor: z.string().nullable().default(null),
  defaultExclusions: z.array(z.string()).default([]),
  defaultNotes: z.array(z.string()).default([]),
  showAcceptance: z.boolean().default(true),
  showCommercialBreakdown: z.boolean().default(true),
});
export type Business = z.infer<typeof BusinessSchema>;

export interface ActiveSettings {
  id: string;
  params: PricingSettings;
  business: Business;
  origin: string;
  effectiveFrom: string;
}

export async function getActiveSettings(ctx: Ctx): Promise<ActiveSettings> {
  const r = await ctx.db.first<{ id: string; params_json: string; business_json: string; origin: string; effective_from: string }>(
    "SELECT * FROM settings_versions WHERE is_active = 1 ORDER BY created_at DESC LIMIT 1",
  );
  if (!r) throw new Error("Configurações não inicializadas. Rode o seed (db:seed:local).");
  return {
    id: r.id,
    params: PricingSettingsSchema.parse(JSON.parse(r.params_json)),
    business: BusinessSchema.parse(json(r.business_json, {})),
    origin: r.origin,
    effectiveFrom: r.effective_from,
  };
}

/** Nova versão de configuração (a anterior permanece no histórico; snapshots antigos não mudam). */
export async function saveSettingsVersion(
  ctx: Ctx,
  actor: string,
  params: PricingSettings,
  business: Business,
  origin: string,
): Promise<string> {
  const parsed = PricingSettingsSchema.parse(params);
  const biz = BusinessSchema.parse(business);
  const prev = await ctx.db.first<{ id: string; params_json: string }>("SELECT id, params_json FROM settings_versions WHERE is_active = 1");
  const id = newId();
  const now = nowIso(ctx);
  await ctx.db.batch([
    ctx.db.stmt("UPDATE settings_versions SET is_active = 0 WHERE is_active = 1"),
    ctx.db.stmt(
      "INSERT INTO settings_versions (id, params_json, business_json, effective_from, origin, approved_by, is_active, created_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?)",
      id,
      JSON.stringify(parsed),
      JSON.stringify(biz),
      now,
      origin,
      actor,
      now,
    ),
    auditStmt(ctx, actor, "settings.update", "settings", id, prev ? JSON.parse(prev.params_json) : null, parsed),
  ]);
  return id;
}

interface MaterialRow {
  id: string;
  key: string;
  name: string;
  category: string | null;
  base_unit: string;
  package_size: string;
  replacement_price_cents: number | null;
  price_updated_at: string | null;
  yield_m2_per_unit_per_coat: string | null;
  loss_pct: string;
  calibrated: number;
  origin: string;
  min_stock: string | null;
  active: number;
}

export interface MaterialRecord extends MaterialDef {
  id: string;
  category: string | null;
  origin: string;
  minStock: string | null;
  active: boolean;
}

function mapMaterial(r: MaterialRow): MaterialRecord {
  return {
    id: r.id,
    key: r.key,
    name: r.name,
    unit: r.base_unit,
    packageSize: r.package_size,
    replacementPriceCents: r.replacement_price_cents,
    priceUpdatedAt: r.price_updated_at,
    yieldM2PerUnitPerCoat: r.yield_m2_per_unit_per_coat,
    lossPct: r.loss_pct,
    calibrated: bool(r.calibrated),
    category: r.category,
    origin: r.origin,
    minStock: r.min_stock,
    active: bool(r.active),
  };
}

export async function listMaterials(ctx: Ctx): Promise<MaterialRecord[]> {
  return (await ctx.db.all<MaterialRow>("SELECT * FROM materials ORDER BY name")).map(mapMaterial);
}

export async function getMaterialByKey(ctx: Ctx, key: string): Promise<MaterialRecord | null> {
  const r = await ctx.db.first<MaterialRow>("SELECT * FROM materials WHERE key = ?", key);
  return r ? mapMaterial(r) : null;
}

export async function getMaterial(ctx: Ctx, id: string): Promise<MaterialRecord | null> {
  const r = await ctx.db.first<MaterialRow>("SELECT * FROM materials WHERE id = ?", id);
  return r ? mapMaterial(r) : null;
}

export interface TechniqueRecord extends TechniqueDef {
  id: string;
  origin: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
}

export async function listTechniques(ctx: Ctx): Promise<TechniqueRecord[]> {
  const rows = await ctx.db.all<{ id: string; key: string; name: string; recipe_json: string; calibrated: number; version: number; origin: string; reviewed_by: string | null; reviewed_at: string | null }>(
    "SELECT * FROM techniques ORDER BY name",
  );
  return rows.map((r) => ({
    id: r.id,
    key: r.key,
    name: r.name,
    steps: z.array(RecipeStepSchema).parse(JSON.parse(r.recipe_json)),
    calibrated: bool(r.calibrated),
    version: r.version,
    origin: r.origin,
    reviewedBy: r.reviewed_by,
    reviewedAt: r.reviewed_at,
  }));
}

export interface MethodRecord extends MethodDef {
  id: string;
  origin: string;
}

export async function listMethods(ctx: Ctx): Promise<MethodRecord[]> {
  const rows = await ctx.db.all<{ id: string; key: string; name: string; speed_m2_per_hour: string; loss_pct: string; setup_hours: string; cleanup_hours: string; calibrated: number; origin: string }>(
    "SELECT * FROM application_methods ORDER BY name",
  );
  return rows.map((r) => ({
    id: r.id,
    key: r.key,
    name: r.name,
    speedM2PerHour: r.speed_m2_per_hour,
    lossPct: r.loss_pct,
    setupHours: r.setup_hours,
    cleanupHours: r.cleanup_hours,
    calibrated: bool(r.calibrated),
    origin: r.origin,
  }));
}

export async function loadCatalog(ctx: Ctx): Promise<PricingCatalog> {
  const [techniques, methods, materials] = await Promise.all([listTechniques(ctx), listMethods(ctx), listMaterials(ctx)]);
  return {
    techniques: Object.fromEntries(techniques.map((t) => [t.key, t])),
    methods: Object.fromEntries(methods.map((m) => [m.key, m])),
    materials: Object.fromEntries(materials.filter((m) => m.active).map((m) => [m.key, m])),
  };
}

export interface InventoryLine {
  materialId: string;
  key: string;
  name: string;
  unit: string;
  quantity: string;
  /** custo histórico médio ponderado por unidade (centavos) — controle, não precificação */
  avgHistoricalUnitCostCents: string | null;
  minStock: string | null;
  low: boolean;
}

/** Estoque estimado = Σ entradas − consumos ± ajustes (quantidades decimais exatas). */
export async function getInventory(ctx: Ctx): Promise<InventoryLine[]> {
  const materials = await listMaterials(ctx);
  const moves = await ctx.db.all<{ material_id: string; kind: string; quantity: string; historical_unit_cost_cents: string | null }>(
    "SELECT material_id, kind, quantity, historical_unit_cost_cents FROM stock_movements",
  );
  const acc = new Map<string, { qty: Dec; costQty: Dec; costSum: Dec }>();
  for (const m of moves) {
    const a = acc.get(m.material_id) ?? { qty: Dec.ZERO, costQty: Dec.ZERO, costSum: Dec.ZERO };
    const q = Dec.from(m.quantity);
    if (m.kind === "ENTRADA") {
      a.qty = a.qty.add(q);
      if (m.historical_unit_cost_cents) {
        a.costQty = a.costQty.add(q);
        a.costSum = a.costSum.add(q.mul(m.historical_unit_cost_cents));
      }
    } else if (m.kind === "CONSUMO") a.qty = a.qty.sub(q);
    else a.qty = a.qty.add(q); // AJUSTE com sinal
    acc.set(m.material_id, a);
  }
  return materials.map((mat) => {
    const a = acc.get(mat.id);
    const qty = a ? Dec.max(a.qty, Dec.ZERO) : Dec.ZERO;
    const avg = a && a.costQty.gt(0) ? a.costSum.div(a.costQty).round(4).toString() : null;
    return {
      materialId: mat.id,
      key: mat.key,
      name: mat.name,
      unit: mat.unit,
      quantity: qty.round(4).toString(),
      avgHistoricalUnitCostCents: avg,
      minStock: mat.minStock,
      low: mat.minStock !== null && qty.lt(mat.minStock),
    };
  });
}

/** Carga inicial idempotente: catálogo de demonstração NÃO CALIBRADO + configuração provisória. */
export async function seedDemoData(ctx: Ctx): Promise<void> {
  const now = nowIso(ctx);
  const stmts: D1PreparedStatement[] = [];
  for (const m of DEMO_METHODS) {
    stmts.push(
      ctx.db.stmt(
        `INSERT OR IGNORE INTO application_methods (id, key, name, speed_m2_per_hour, loss_pct, setup_hours, cleanup_hours, calibrated, origin, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 'demo_only', ?)`,
        newId(),
        m.key,
        m.name,
        m.speedM2PerHour,
        m.lossPct,
        m.setupHours,
        m.cleanupHours,
        now,
      ),
    );
  }
  for (const m of DEMO_MATERIALS) {
    stmts.push(
      ctx.db.stmt(
        `INSERT OR IGNORE INTO materials (id, key, name, base_unit, package_size, replacement_price_cents, price_updated_at, yield_m2_per_unit_per_coat, loss_pct, calibrated, origin, active, updated_at) VALUES (?, ?, ?, ?, ?, NULL, NULL, ?, ?, 0, 'demo_only', 1, ?)`,
        newId(),
        m.key,
        m.name,
        m.unit,
        m.packageSize,
        m.yieldM2PerUnitPerCoat,
        m.lossPct,
        now,
      ),
    );
  }
  for (const t of DEMO_TECHNIQUES) {
    stmts.push(
      ctx.db.stmt(
        `INSERT OR IGNORE INTO techniques (id, key, name, recipe_json, calibrated, origin, version, updated_at) VALUES (?, ?, ?, ?, 0, 'demo_only', 1, ?)`,
        newId(),
        t.key,
        t.name,
        JSON.stringify(t.steps),
        now,
      ),
    );
  }
  await ctx.db.batch(stmts);
  const hasSettings = await ctx.db.first("SELECT id FROM settings_versions LIMIT 1");
  if (!hasSettings) {
    await ctx.db.run(
      "INSERT INTO settings_versions (id, params_json, business_json, effective_from, origin, is_active, created_at) VALUES (?, ?, ?, ?, 'provisorio_especificacao', 1, ?)",
      newId(),
      JSON.stringify(DEMO_SETTINGS),
      JSON.stringify(BusinessSchema.parse({})),
      now,
      now,
    );
  }
}
