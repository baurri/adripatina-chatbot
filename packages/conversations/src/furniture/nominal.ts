import type { Dimensions } from "@adripatina/domain";
import { normalizeText } from "@adripatina/shared";
import { FURNITURE_CATALOG } from "./catalog.js";
import type { DimValue, FurnitureTypeDef, SizePreset } from "./types.js";

/**
 * Hipóteses nominais a partir dos presets do catálogo.
 * Resultado SEMPRE com source "nominal" — nunca medida real.
 */

const cmToM = (cm: number) => (cm / 100).toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
const lo = (v: DimValue | undefined) => (v === undefined ? undefined : typeof v === "number" ? v : v.min);
const hi = (v: DimValue | undefined) => (v === undefined ? undefined : typeof v === "number" ? v : v.max);
const mid = (v: DimValue | undefined) => (v === undefined ? undefined : typeof v === "number" ? v : Math.round((v.min + v.max) / 2));

function pick(p: SizePreset, f: (v: DimValue | undefined) => number | undefined) {
  // Dimensions: width = maior lado horizontal (largura da cama / comprimento da mesa), depth = o outro
  const isTable = p.dimensionKind === "top";
  const w = isTable ? f(p.lengthCm) : f(p.widthCm);
  const d = isTable ? f(p.widthCm) : (f(p.lengthCm) ?? f(p.depthCm));
  const out: { width?: string; depth?: string; height?: string; diameter?: string } = {};
  if (w !== undefined) out.width = cmToM(w);
  if (d !== undefined) out.depth = cmToM(d);
  const h = f(p.heightCm);
  if (h !== undefined && p.dimensionKind !== "mattress") out.height = cmToM(h);
  const dia = f(p.diameterCm);
  if (dia !== undefined) out.diameter = cmToM(dia);
  return out;
}

/** Converte um preset numa hipótese nominal (fato `dimensions`). */
export function nominalDimensions(p: SizePreset): Dimensions {
  const base = pick(p, mid);
  const hasRange = [p.widthCm, p.lengthCm, p.depthCm, p.heightCm, p.diameterCm].some((v) => v !== undefined && typeof v !== "number");
  return {
    ...base,
    source: "nominal",
    kind: p.dimensionKind === "mattress" ? "mattress" : p.dimensionKind === "top" ? "top" : "external",
    confidence: "baixa",
    presetKey: p.key,
    ...(hasRange ? { nominalRange: { min: pick(p, lo), max: pick(p, hi) } } : {}),
  };
}

const fmt = (v: DimValue | undefined) => (v === undefined ? "" : typeof v === "number" ? `${v}` : `${v.min}–${v.max}`);

/** Descrição curta da referência, para mensagem e orçamento: "colchão de 158 × 198 cm". */
export function describePreset(p: SizePreset): string {
  if (p.dimensionKind === "mattress") return `colchão de ${fmt(p.widthCm)} × ${fmt(p.lengthCm)} cm`;
  if (p.diameterCm !== undefined) return `cerca de ${fmt(p.diameterCm)} cm de diâmetro`;
  const parts = p.dimensionKind === "top" ? [p.lengthCm, p.widthCm] : [p.widthCm, p.depthCm ?? p.lengthCm, p.heightCm];
  const shown = parts.filter((v) => v !== undefined);
  return shown.length ? `cerca de ${shown.map(fmt).join(" × ")} cm` : p.label;
}

export function findType(key: string, types: readonly FurnitureTypeDef[] = FURNITURE_CATALOG): FurnitureTypeDef | undefined {
  return types.find((t) => t.key === key);
}

export function presetByKey(key: string, types: readonly FurnitureTypeDef[] = FURNITURE_CATALOG): { type: FurnitureTypeDef; preset: SizePreset } | null {
  for (const type of types) {
    const preset = type.presets.find((p) => p.key === key);
    if (preset) return { type, preset };
  }
  return null;
}

/**
 * Preset sugerido para um tipo, considerando o texto (formato "redonda"/"quadrada").
 * Só devolve presets com autoSuggest OU quando o tipo tem um único preset coerente;
 * `requiresConfirmation` continua valendo para quem usa o resultado.
 */
export function suggestPreset(type: FurnitureTypeDef, text = ""): SizePreset | null {
  if (!type.presets.length) return null;
  const n = normalizeText(text);
  const shape = /\bredond/.test(n) ? "redonda" : /\bquadrad/.test(n) ? "quadrada" : /\boval/.test(n) ? "oval" : null;
  const byShape = shape ? type.presets.find((p) => p.shape === shape) : null;
  if (byShape) return byShape;
  const auto = type.presets.find((p) => p.autoSuggest);
  if (auto) return auto;
  // mesas por lugares: o retangular é a referência inicial (faixa, sempre a confirmar)
  const rect = type.presets.find((p) => p.shape === "retangular");
  return rect ?? null;
}
