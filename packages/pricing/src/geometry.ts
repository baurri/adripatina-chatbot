import { Dec } from "@adripatina/shared";
import type { AreaInput, PricingSettings } from "./types.js";

export interface GeometryInput {
  width?: string | null; // metros
  height?: string | null;
  depth?: string | null;
  surfaces?: "externa" | "interna_externa" | null;
  sizeClass?: "pequeno" | "medio" | "grande" | null;
  /** "tampo": só a face superior é trabalhada */
  part?: "tampo" | "inteiro" | null;
}

/** Fração do porte correspondente ao tampo — hipótese NÃO CALIBRADA. */
const TOP_FRACTION_OF_SIZE_CLASS = "0.25";

/** Área só do tampo: largura × fundura; sem medidas, fração do porte (intervalo). */
function estimateTopArea(g: GeometryInput, s: PricingSettings): AreaInput | null {
  const w = Dec.tryParse(g.width ?? null);
  const d = Dec.tryParse(g.depth ?? null);
  if (w && d && w.gt(0) && d.gt(0)) return { kind: "exact", m2: w.mul(d).round(3).toString() };
  if (w && w.gt(0)) {
    return { kind: "range", minM2: w.mul("0.3").round(3).toString(), maxM2: w.mul("0.6").round(3).toString(), source: "tampo_sem_fundura" };
  }
  if (g.sizeClass) {
    const [min, max] = s.sizeClassAreaM2[g.sizeClass];
    return {
      kind: "range",
      minM2: Dec.from(min).mul(TOP_FRACTION_OF_SIZE_CLASS).round(3).toString(),
      maxM2: Dec.from(max).mul(TOP_FRACTION_OF_SIZE_CLASS).round(3).toString(),
      source: `tampo_porte_${g.sizeClass}_nao_calibrado`,
    };
  }
  return null;
}

/**
 * Estimativa de área tratada a partir de medidas.
 * Externa: frente (L×A) + 2 laterais (P×A) + tampo (L×P). Fundo não incluído.
 * Interna: externa × fator interno configurável (NÃO CALIBRADO).
 * Sem medidas completas, usa a faixa do porte (NÃO CALIBRADA) e devolve intervalo.
 */
export function estimateArea(g: GeometryInput, s: PricingSettings): AreaInput | null {
  if (g.part === "tampo") return estimateTopArea(g, s);
  const w = Dec.tryParse(g.width ?? null);
  const h = Dec.tryParse(g.height ?? null);
  const d = Dec.tryParse(g.depth ?? null);
  const internal = g.surfaces === "interna_externa";
  const factor = internal ? Dec.ONE.add(s.internalAreaFactor) : Dec.ONE;

  if (w && h && d && w.gt(0) && h.gt(0) && d.gt(0)) {
    const ext = w.mul(h).add(d.mul(h).mul(2)).add(w.mul(d));
    return { kind: "exact", m2: ext.mul(factor).round(3).toString() };
  }
  if (w && h && w.gt(0) && h.gt(0)) {
    // sem profundidade: assume P entre 0,3 e 0,6 m → intervalo
    const minExt = w.mul(h).add(Dec.from("0.3").mul(h).mul(2)).add(w.mul("0.3"));
    const maxExt = w.mul(h).add(Dec.from("0.6").mul(h).mul(2)).add(w.mul("0.6"));
    return {
      kind: "range",
      minM2: minExt.mul(factor).round(3).toString(),
      maxM2: maxExt.mul(factor).round(3).toString(),
      source: "medidas_sem_profundidade",
    };
  }
  if (g.sizeClass) {
    const [min, max] = s.sizeClassAreaM2[g.sizeClass];
    return {
      kind: "range",
      minM2: Dec.from(min).mul(factor).round(3).toString(),
      maxM2: Dec.from(max).mul(factor).round(3).toString(),
      source: `porte_${g.sizeClass}_nao_calibrado`,
    };
  }
  if (h && h.gt(0)) {
    // só a altura (ex.: "tem uns dois metros") → faixa ampla e conservadora
    const minExt = h.mul("0.6").mul(h).add(h.mul("0.3").mul(2)).add(Dec.from("0.6").mul("0.3"));
    const maxExt = h.mul("1.2").mul(h).add(h.mul("0.6").mul(2)).add(Dec.from("1.2").mul("0.6"));
    return {
      kind: "range",
      minM2: minExt.mul(factor).round(3).toString(),
      maxM2: maxExt.mul(factor).round(3).toString(),
      source: "apenas_altura",
    };
  }
  return null;
}
