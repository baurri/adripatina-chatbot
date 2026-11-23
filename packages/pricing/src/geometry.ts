import { Dec } from "@adripatina/shared";
import type { AreaInput, PricingSettings } from "./types.js";

export interface GeometryInput {
  width?: string | null; // metros
  height?: string | null;
  depth?: string | null;
  surfaces?: "externa" | "interna_externa" | null;
  sizeClass?: "pequeno" | "medio" | "grande" | null;
  /** "tampo": só a face superior; "cabeceira": só a cabeceira da cama */
  part?: "tampo" | "inteiro" | "cabeceira" | null;
  /** perfil do móvel: cama não é uma caixa (cabeceira, peseira e laterais) */
  profile?: "bed" | null;
  /** medida PADRÃO do colchão (queen, casal...): referência, nunca medida da estrutura */
  nominalBed?: { width: string; length: string; label: string } | null;
}

/**
 * Margem da estrutura sobre o colchão (cada lado), hipótese NÃO CALIBRADA: a cama é
 * sempre maior que o colchão, quanto depende do modelo. A faixa vai do colchão nu
 * até colchão + 2 × margem.
 */
const BED_FRAME_MARGIN_M = "0.10";

/** Área de várias peças iguais (quantidade inteira ≥ 1). */
export function scaleArea(a: AreaInput, quantity: number): AreaInput {
  if (!Number.isInteger(quantity) || quantity < 1) throw new RangeError("Quantidade inválida");
  if (quantity === 1) return a;
  return a.kind === "exact"
    ? { kind: "exact", m2: Dec.from(a.m2).mul(quantity).round(3).toString() }
    : { kind: "range", minM2: Dec.from(a.minM2).mul(quantity).round(3).toString(), maxM2: Dec.from(a.maxM2).mul(quantity).round(3).toString(), source: `${a.source}_x${quantity}` };
}

function bedHeadboardOnly(w: Dec): Dec {
  return w.mul(BED_FACTORS.headboard).mul(BED_FACTORS.sides);
}

/** Cama só com o tamanho padrão: faixa entre o colchão e colchão + margem (NÃO CALIBRADA). */
function estimateNominalBed(g: GeometryInput): AreaInput | null {
  const nb = g.nominalBed;
  if (!nb) return null;
  const w = Dec.from(nb.width);
  const l = Dec.from(nb.length);
  const m2 = Dec.from(BED_FRAME_MARGIN_M).mul(2);
  const calc = (ww: Dec, ll: Dec): Dec => {
    if (g.part === "cabeceira") return bedHeadboardOnly(ww);
    const a = estimateBedArea({ width: ww.toString(), depth: ll.toString() });
    return a && a.kind === "exact" ? Dec.from(a.m2) : bedHeadboardOnly(ww);
  };
  return { kind: "range", minM2: calc(w, l).round(3).toString(), maxM2: calc(w.add(m2), l.add(m2)).round(3).toString(), source: `referencia_colchao_${nb.label}_nao_calibrado` };
}

/**
 * Cama: cabeceira (largura × 1,0 m) + peseira (largura × 0,45 m) + 2 laterais
 * (comprimento × 0,30 m), frente e verso das peças. Fatores NÃO CALIBRADOS.
 * Usa largura e comprimento do colchão (depth = comprimento).
 */
const BED_FACTORS = { headboard: "1.0", footboard: "0.45", rail: "0.30", sides: "2" };
function estimateBedArea(g: GeometryInput): AreaInput | null {
  const w = Dec.tryParse(g.width ?? null);
  const l = Dec.tryParse(g.depth ?? null);
  if (!w || !l || !w.gt(0) || !l.gt(0)) return null;
  const oneSide = w.mul(BED_FACTORS.headboard).add(w.mul(BED_FACTORS.footboard)).add(l.mul(BED_FACTORS.rail).mul(2));
  return { kind: "exact", m2: oneSide.mul(BED_FACTORS.sides).round(3).toString() };
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
  if (g.profile === "bed") {
    if (g.part === "cabeceira") {
      const w = Dec.tryParse(g.width ?? null);
      if (w && w.gt(0)) return { kind: "exact", m2: bedHeadboardOnly(w).round(3).toString() };
    } else {
      const bed = estimateBedArea(g);
      if (bed) return bed;
    }
    const nominal = estimateNominalBed(g);
    if (nominal) return nominal;
  }
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
