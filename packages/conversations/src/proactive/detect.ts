import { Dec } from "@adripatina/shared";
import type { ProactiveSettings } from "./policy.js";
import type { MaterialSnap, Need, NeedSignals, Snapshot } from "./types.js";

/**
 * Detector geral de necessidades. Campo vazio, por si só, NÃO vira pergunta:
 * cada regra exige utilidade operacional (orçamento travado, uso em técnicas,
 * serviço próximo, trabalho concluído recente).
 */

const DAY = 86_400_000;

function baseSignals(partial: Partial<NeedSignals> = {}): NeedSignals {
  return { blockedQuotes: 0, upcomingJobs: 0, usageCount: 0, staleDays: null, negativeStock: false, recentlyMentioned: false, attempts: 0, dontKnowCount: 0, ...partial };
}

function daysSince(iso: string | null, now: Date): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? Math.floor((now.getTime() - t) / DAY) : null;
}

export function validPackageSize(size: string | null | undefined): boolean {
  const d = Dec.tryParse(size ?? null);
  return !!d && d.gt(0);
}

/** Nome amigável do material para a conversa ("Verniz" → "verniz"). */
export function subjectOf(name: string): string {
  // "Lixa (folha)" → "lixa"; "Tinta esmalte" → "tinta esmalte"
  const n = name.replace(/\s*\([^)]*\)\s*/g, " ").replace(/\s+/g, " ").trim();
  // siglas e nomes próprios ficam como estão
  return /^[A-Z]{2,}/.test(n) ? n : n.charAt(0).toLowerCase() + n.slice(1);
}

function materialRelevance(m: MaterialSnap): number {
  return m.recipeUses + m.activeJobUses + m.blockedQuotes.length;
}

function materialNeeds(m: MaterialSnap, s: ProactiveSettings, now: Date): Need[] {
  if (!m.active) return [];
  if (m.mutedUntil && Date.parse(m.mutedUntil) > now.getTime()) return [];
  const out: Need[] = [];
  const signals = baseSignals({
    blockedQuotes: m.blockedQuotes.length,
    upcomingJobs: m.upcomingJobUses,
    usageCount: m.recipeUses + m.activeJobUses,
    recentlyMentioned: m.recentlyMentioned,
  });
  const relevant = materialRelevance(m) > 0;
  const context = { subject: subjectOf(m.name), baseUnit: m.baseUnit, packageSize: m.packageSize, priceCents: m.priceCents };
  const common = { entityType: "material" as const, entityId: m.id, entityKey: m.key, label: m.name, context };

  // 1) preço de reposição
  if (s.kinds.material_price) {
    const blocked = m.blockedQuotes[0];
    const stale = daysSince(m.priceUpdatedAt, now);
    let reason: Need["reason"] | null = null;
    if (blocked) reason = "quote_blocked";
    else if (relevant && m.priceCents === null) reason = "price_missing";
    else if (relevant && m.origin === "demo_only") reason = "price_demo";
    else if (relevant && m.priceCents !== null && (stale === null || stale > s.validity.priceDays)) reason = "price_stale";
    if (reason) {
      out.push({
        ...common,
        kind: "material_price",
        reason,
        fields: ["replacement_price_cents", "package_size"],
        expectedFormat: "valor em reais da embalagem (+ tamanho da embalagem, se ainda não confirmado)",
        signals: { ...signals, staleDays: reason === "price_stale" ? stale : null },
        benefit: blocked ? { jobId: blocked.jobId, quoteId: blocked.quoteId, label: blocked.jobTitle } : {},
      });
    }
  }

  // 2) preço real conhecido, mas tamanho da embalagem inválido
  if (s.kinds.material_package_size && m.priceCents !== null && m.origin !== "demo_only" && !validPackageSize(m.packageSize) && !out.some((n) => n.kind === "material_price")) {
    out.push({
      ...common,
      kind: "material_package_size",
      reason: "package_size_invalid",
      fields: ["package_size"],
      expectedFormat: "tamanho de uma embalagem na unidade do material",
      signals,
      benefit: {},
    });
  }

  // 3) estoque — só para materiais que realmente circulam
  const circulates = m.recipeUses > 0 || m.minStock !== null || m.stockQty !== null;
  if (s.kinds.stock_level && circulates) {
    const qty = m.stockQty !== null ? Dec.tryParse(m.stockQty) : null;
    const checked = daysSince(m.stockCheckedAt, now);
    let reason: Need["reason"] | null = null;
    if (qty && qty.lt(0)) reason = "stock_negative";
    else if (checked === null && (m.stockQty !== null || m.minStock !== null || m.upcomingJobUses > 0 || m.recipeUses > 1)) reason = "stock_unknown";
    else if (checked !== null && checked > s.validity.stockDays) reason = "stock_stale";
    if (reason) {
      out.push({
        ...common,
        kind: "stock_level",
        reason,
        fields: ["stock_quantity"],
        expectedFormat: "quantidade aproximada em estoque",
        signals: { ...signals, negativeStock: reason === "stock_negative", staleDays: reason === "stock_stale" ? checked : null },
        benefit: {},
      });
    }
  }
  return out;
}

export function detectNeeds(snap: Snapshot, s: ProactiveSettings): Need[] {
  const now = snap.now;
  const needs: Need[] = snap.materials.flatMap((m) => materialNeeds(m, s, now));

  for (const j of snap.jobs) {
    if (!["CONCLUIDO", "ENTREGUE"].includes(j.status) || !j.completedAt) continue;
    const age = daysSince(j.completedAt, now);
    if (age === null || age > s.validity.completedJobDays) continue;
    const context = {
      subject: j.title,
      jobTitle: j.title,
      ...(j.mainMaterial ? { materialKey: j.mainMaterial.key, materialName: j.mainMaterial.name, materialUnit: j.mainMaterial.unit, materialPackageSize: j.mainMaterial.packageSize } : {}),
    };
    if (s.kinds.job_actual_hours && !j.hasTimeEntries) {
      needs.push({
        kind: "job_actual_hours",
        reason: "job_hours_missing",
        entityType: "job",
        entityId: j.id,
        entityKey: null,
        label: j.title,
        fields: ["actual_hours"],
        expectedFormat: "horas trabalhadas no total (aproximado)",
        signals: baseSignals({ staleDays: age }),
        context,
        benefit: { jobId: j.id, label: j.title },
      });
    }
    if (s.kinds.job_materials_used && !j.hasConsumptions && j.mainMaterial) {
      needs.push({
        kind: "job_materials_used",
        reason: "job_materials_missing",
        entityType: "job",
        entityId: j.id,
        entityKey: j.mainMaterial.key,
        label: `${j.title} — ${j.mainMaterial.name}`,
        fields: ["material_quantity_used"],
        expectedFormat: "quantidade aproximada do material usada",
        signals: baseSignals({ staleDays: age }),
        context,
        benefit: { jobId: j.id, label: j.title },
      });
    }
  }

  for (const t of snap.techniques) {
    if (!s.kinds.technique_coats || t.calibrated || t.recentObservation || t.usedInJobs === 0 || !t.coatingMaterial) continue;
    needs.push({
      kind: "technique_coats",
      reason: "technique_uncalibrated",
      entityType: "technique",
      entityId: t.id,
      entityKey: t.key,
      label: t.name,
      fields: ["coats"],
      expectedFormat: "número de demãos",
      signals: baseSignals({ usageCount: t.usedInJobs }),
      context: { subject: subjectOf(t.coatingMaterial.name), techniqueName: subjectOf(t.name), materialKey: t.coatingMaterial.key, materialName: t.coatingMaterial.name },
      benefit: {},
    });
  }
  return needs;
}
