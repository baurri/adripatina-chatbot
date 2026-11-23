import type { JobSnap, MaterialSnap, Snapshot, TechniqueSnap } from "@adripatina/conversations";
import { Dec } from "@adripatina/shared";
import type { Ctx } from "../../context.js";
import { listTechniques, type TechniqueRecord } from "../../repos/catalog.js";

/**
 * Retrato do banco para os detectores (somente leitura). Tudo o que os
 * detectores precisam vem daqui — eles não acessam o banco.
 */

const ACTIVE = ["ORCAMENTO", "AGUARDANDO_INICIO", "EM_EXECUCAO"];
const UPCOMING = ["AGUARDANDO_INICIO", "EM_EXECUCAO"];
const OPEN_QUOTE = ["RASCUNHO", "ESTIMATIVA", "AGUARDANDO_REVISAO"];

interface MaterialRow {
  id: string;
  key: string;
  name: string;
  base_unit: string;
  package_size: string;
  replacement_price_cents: number | null;
  price_updated_at: string | null;
  origin: string;
  active: number;
  min_stock: string | null;
  stock_checked_at: string | null;
  proactive_muted_until: string | null;
}

function techniqueMaterials(t: TechniqueRecord): string[] {
  return [...new Set(t.steps.flatMap((s) => s.materials.map((m) => m.materialKey)))];
}

function coatingMaterialKey(t: TechniqueRecord): string | null {
  const step = t.steps.find((s) => s.kind === "coating" && s.materials.length);
  return step?.materials[0]?.materialKey ?? null;
}

function techniquesOf(factsJson: string): string[] {
  try {
    const f = JSON.parse(factsJson) as { techniques?: { value?: unknown } };
    return Array.isArray(f.techniques?.value) ? (f.techniques!.value as unknown[]).filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export async function loadSnapshot(ctx: Ctx): Promise<Snapshot> {
  const now = ctx.clock();
  const materials = await ctx.db.all<MaterialRow>(
    "SELECT id, key, name, base_unit, package_size, replacement_price_cents, price_updated_at, origin, active, min_stock, stock_checked_at, proactive_muted_until FROM materials",
  );
  const byKey = new Map(materials.map((m) => [m.key, m]));
  const techniques = await listTechniques(ctx);
  const techByKey = new Map(techniques.map((t) => [t.key, t]));

  // estoque bruto (sem truncar em zero: negativo = inconsistência a investigar)
  const moves = await ctx.db.all<{ material_id: string; kind: string; quantity: string }>("SELECT material_id, kind, quantity FROM stock_movements");
  const stock = new Map<string, Dec>();
  for (const m of moves) {
    const q = Dec.tryParse(m.quantity) ?? Dec.ZERO;
    const cur = stock.get(m.material_id) ?? Dec.ZERO;
    stock.set(m.material_id, m.kind === "CONSUMO" ? cur.sub(q) : cur.add(q));
  }

  const jobs = await ctx.db.all<{ id: string; title: string; status: string; facts_json: string; completed_at: string | null; updated_at: string }>(
    "SELECT id, title, status, facts_json, completed_at, updated_at FROM jobs WHERE status NOT IN ('CANCELADO','MESCLADO')",
  );
  const recipeUses = new Map<string, number>();
  for (const t of techniques) for (const k of techniqueMaterials(t)) recipeUses.set(k, (recipeUses.get(k) ?? 0) + 1);
  const activeUses = new Map<string, number>();
  const upcomingUses = new Map<string, number>();
  const techInJobs = new Map<string, number>();
  for (const j of jobs) {
    const keys = techniquesOf(j.facts_json);
    for (const tk of keys) techInJobs.set(tk, (techInJobs.get(tk) ?? 0) + 1);
    const mats = new Set(keys.flatMap((tk) => (techByKey.get(tk) ? techniqueMaterials(techByKey.get(tk)!) : [])));
    for (const mk of mats) {
      if (ACTIVE.includes(j.status)) activeUses.set(mk, (activeUses.get(mk) ?? 0) + 1);
      if (UPCOMING.includes(j.status)) upcomingUses.set(mk, (upcomingUses.get(mk) ?? 0) + 1);
    }
  }

  // orçamentos recentes travados por preço ausente (última versão de cada serviço em orçamento)
  const since30 = new Date(now.getTime() - 30 * 86_400_000).toISOString();
  const quotes = await ctx.db.all<{ id: string; job_id: string; result_json: string; title: string }>(
    `SELECT q.id, q.job_id, q.result_json, j.title FROM quotes q JOIN jobs j ON j.id = q.job_id
      WHERE j.status = 'ORCAMENTO' AND q.status IN (${OPEN_QUOTE.map(() => "?").join(",")}) AND q.updated_at >= ?
        AND q.version = (SELECT MAX(version) FROM quotes q2 WHERE q2.job_id = q.job_id)`,
    ...OPEN_QUOTE,
    since30,
  );
  const blocked = new Map<string, { quoteId: string; jobId: string; jobTitle: string }[]>();
  for (const q of quotes) {
    try {
      const r = JSON.parse(q.result_json) as { blockers?: { code: string; ref?: string }[] };
      for (const b of r.blockers ?? []) {
        if (b.code !== "MATERIAL_PRICE_MISSING" || !b.ref) continue;
        const list = blocked.get(b.ref) ?? [];
        if (!list.some((x) => x.quoteId === q.id)) list.push({ quoteId: q.id, jobId: q.job_id, jobTitle: q.title });
        blocked.set(b.ref, list);
      }
    } catch {
      /* resultado ilegível: ignora */
    }
  }

  const since7 = new Date(now.getTime() - 7 * 86_400_000).toISOString();
  const mentioned = new Set(
    (await ctx.db.all<{ entity_key: string }>("SELECT DISTINCT entity_key FROM learning_observations WHERE entity_type = 'material' AND created_at >= ?", since7)).map((r) => r.entity_key),
  );

  const materialSnaps: MaterialSnap[] = materials.map((m) => ({
    id: m.id,
    key: m.key,
    name: m.name,
    baseUnit: m.base_unit,
    packageSize: m.package_size,
    priceCents: m.replacement_price_cents,
    priceUpdatedAt: m.price_updated_at,
    origin: m.origin,
    active: m.active === 1,
    mutedUntil: m.proactive_muted_until,
    stockCheckedAt: m.stock_checked_at,
    stockQty: stock.has(m.id) ? stock.get(m.id)!.toString() : null,
    minStock: m.min_stock,
    recipeUses: recipeUses.get(m.key) ?? 0,
    activeJobUses: activeUses.get(m.key) ?? 0,
    upcomingJobUses: upcomingUses.get(m.key) ?? 0,
    blockedQuotes: blocked.get(m.key) ?? [],
    recentlyMentioned: mentioned.has(m.key),
  }));

  // trabalhos concluídos: tempo real e consumo
  const completed = jobs.filter((j) => ["CONCLUIDO", "ENTREGUE"].includes(j.status) && j.completed_at);
  const withTime = new Set((await ctx.db.all<{ job_id: string }>("SELECT DISTINCT job_id FROM time_entries")).map((r) => r.job_id));
  const withCons = new Set((await ctx.db.all<{ job_id: string }>("SELECT DISTINCT job_id FROM material_consumptions")).map((r) => r.job_id));
  const withUsageObs = new Set(
    (await ctx.db.all<{ job_id: string }>("SELECT DISTINCT job_id FROM learning_observations WHERE kind = 'MATERIAL_USAGE' AND job_id IS NOT NULL")).map((r) => r.job_id),
  );
  const jobSnaps: JobSnap[] = completed.map((j) => {
    const tk = techniquesOf(j.facts_json).find((k) => techByKey.get(k) && coatingMaterialKey(techByKey.get(k)!));
    const mk = tk ? coatingMaterialKey(techByKey.get(tk)!) : null;
    const mat = mk ? byKey.get(mk) : undefined;
    return {
      id: j.id,
      title: j.title,
      status: j.status,
      completedAt: j.completed_at,
      hasTimeEntries: withTime.has(j.id),
      hasConsumptions: withCons.has(j.id) || withUsageObs.has(j.id),
      mainMaterial: mat ? { key: mat.key, name: mat.name, unit: mat.base_unit, packageSize: mat.package_size } : null,
    };
  });

  const since180 = new Date(now.getTime() - 180 * 86_400_000).toISOString();
  const observedTech = new Set(
    (await ctx.db.all<{ entity_key: string }>("SELECT DISTINCT entity_key FROM learning_observations WHERE kind = 'TECHNIQUE_OBSERVATION' AND created_at >= ?", since180)).map((r) => r.entity_key),
  );
  const techSnaps: TechniqueSnap[] = techniques.map((t) => {
    const mk = coatingMaterialKey(t);
    const mat = mk ? byKey.get(mk) : undefined;
    return { id: t.id, key: t.key, name: t.name, calibrated: t.calibrated, usedInJobs: techInJobs.get(t.key) ?? 0, coatingMaterial: mat ? { key: mat.key, name: mat.name } : null, recentObservation: observedTech.has(t.key) };
  });

  return { now, materials: materialSnaps, jobs: jobSnaps, techniques: techSnaps };
}
