/**
 * Gera db/seeds/0001_demo_catalog.sql a partir do catálogo de demonstração
 * (NÃO CALIBRADO, sem preços). Uso: pnpm --filter @adripatina/worker seed:generate
 */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DEMO_MATERIALS, DEMO_METHODS, DEMO_SETTINGS, DEMO_TECHNIQUES } from "../packages/pricing/src/index.js";

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "../db/seeds/0001_demo_catalog.sql");
const q = (v: string | number | null) => (v === null ? "NULL" : typeof v === "number" ? String(v) : `'${v.replace(/'/g, "''")}'`);
const now = "2026-11-22T00:00:00.000Z";
const lines: string[] = [
  "-- GERADO por scripts/generate-seed.ts — catálogo de DEMONSTRAÇÃO, NÃO CALIBRADO.",
  "-- Materiais sem preço: o administrador deve cadastrar preços reais antes de emitir propostas.",
];
let i = 0;
const id = (p: string) => `${p}-0000-4000-8000-${String(++i).padStart(12, "0")}`;
for (const m of DEMO_METHODS) {
  lines.push(
    `INSERT OR IGNORE INTO application_methods (id, key, name, speed_m2_per_hour, loss_pct, setup_hours, cleanup_hours, calibrated, origin, updated_at) VALUES (${q(id("00000001"))}, ${q(m.key)}, ${q(m.name)}, ${q(m.speedM2PerHour)}, ${q(m.lossPct)}, ${q(m.setupHours)}, ${q(m.cleanupHours)}, 0, 'demo_only', ${q(now)});`,
  );
}
for (const m of DEMO_MATERIALS) {
  lines.push(
    `INSERT OR IGNORE INTO materials (id, key, name, base_unit, package_size, replacement_price_cents, price_updated_at, yield_m2_per_unit_per_coat, loss_pct, calibrated, origin, active, updated_at) VALUES (${q(id("00000002"))}, ${q(m.key)}, ${q(m.name)}, ${q(m.unit)}, ${q(m.packageSize)}, NULL, NULL, ${q(m.yieldM2PerUnitPerCoat)}, ${q(m.lossPct)}, 0, 'demo_only', 1, ${q(now)});`,
  );
}
for (const t of DEMO_TECHNIQUES) {
  lines.push(
    `INSERT OR IGNORE INTO techniques (id, key, name, recipe_json, calibrated, origin, version, updated_at) VALUES (${q(id("00000003"))}, ${q(t.key)}, ${q(t.name)}, ${q(JSON.stringify(t.steps))}, 0, 'demo_only', 1, ${q(now)});`,
  );
}
lines.push(
  `INSERT INTO settings_versions (id, params_json, business_json, effective_from, origin, is_active, created_at) SELECT ${q(id("00000004"))}, ${q(JSON.stringify(DEMO_SETTINGS))}, ${q(JSON.stringify({ name: "adripatina", tagline: null, phone: null, email: null, instagram: null, city: null, document: null, primaryColor: null, accentColor: null, defaultExclusions: [], defaultNotes: [], showAcceptance: true, showCommercialBreakdown: true }))}, ${q(now)}, 'provisorio_especificacao', 1, ${q(now)} WHERE NOT EXISTS (SELECT 1 FROM settings_versions);`,
);
writeFileSync(out, lines.join("\n") + "\n", "utf8");
console.info(`Seed gerado: ${out}`);
