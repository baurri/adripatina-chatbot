import { Dec, normalizeText, wordsToNumber } from "@adripatina/shared";
import { parsePackageSizeText, parsePriceAnswer } from "../pricing-answers.js";
import type { NeedKind } from "./types.js";

/**
 * Interpretação da resposta a uma solicitação proativa, SEMPRE no contexto do
 * dado pedido. Nada aqui grava no banco; a aplicação valida de novo.
 */

export type Expecting = "primary" | "size" | "confirm";

export type CollectionAnswer =
  | { kind: "price"; amountCents: number; packages?: number; packageSize?: string; sizeLabel?: string; perPackage: boolean; approximate: boolean }
  | { kind: "size"; packageSize: string; sizeLabel: string }
  | { kind: "quantity"; quantity: string; label: string; approximate: boolean }
  | { kind: "hours"; hours: string; approximate: boolean }
  | { kind: "coats"; coats: number; approximate: boolean }
  | { kind: "yes"; perPackage?: boolean }
  | { kind: "no"; perPackage?: boolean }
  | { kind: "dont_know" }
  | { kind: "later" }
  | { kind: "discontinued" }
  | { kind: "needs_hours" }
  | { kind: "unparsed" };

const UNCERTAIN = /\b(acho|acho que|deve|deve ser|deve ter|uns|umas|mais ou menos|por volta|aproximadamente|cerca de|tipo|se nao me engano|parece|quase|uma media|em media)\b/;
const DISCONTINUED = /\b(nao (uso|usamos|compro|compramos|trabalho|trabalhamos) mais|parei de (usar|comprar)|nao (to|estou) usando mais|nao uso esse|nao uso essa|nao uso isso)\b/;
const LATER = /\b(pergunt\w* (amanha|depois|outro dia|outra hora|mais tarde|semana que vem)|depois (eu )?(vejo|te falo|respondo|confiro|olho)|agora nao|outra hora|mais tarde|amanha eu (vejo|olho|confiro|te falo)|me lembra depois|deixa pra depois|fala comigo depois)\b/;
const DONT_KNOW = /\b(nao sei|nao lembro|nao me lembro|nao faco ideia|sei la|nao tenho ideia|esqueci|nao sei dizer|nao lembro agora)\b/;
const YES = /^(sim|isso|isso mesmo|certo|exato|exatamente|correto|e isso|pode ser|ok|confirmo|confirmado|foi isso|foi|isso ai|perfeito|ta certo|esta certo|no total|total)\b/;
const NO = /^(nao|errado|na verdade|negativo|nada disso)\b/;

function numberIn(norm: string): { value: Dec; raw: string } | null {
  const digits = /(\d+(?:[.,]\d+)?)/.exec(norm);
  if (digits) {
    const d = Dec.tryParse(digits[1]!.replace(",", "."));
    if (d) return { value: d, raw: digits[1]! };
  }
  const tokens = norm.split(" ").filter(Boolean);
  for (let i = 0; i < tokens.length; i++) {
    for (let j = Math.min(tokens.length, i + 4); j > i; j--) {
      const slice = tokens.slice(i, j);
      if (slice[0] === "e") continue;
      const w = wordsToNumber(slice);
      if (w !== null && w > 0) return { value: Dec.from(w), raw: slice.join(" ") };
    }
  }
  return null;
}

function common(norm: string, hasValue: boolean): CollectionAnswer | null {
  if (DISCONTINUED.test(norm)) return { kind: "discontinued" };
  if (!hasValue && LATER.test(norm)) return { kind: "later" };
  if (!hasValue && DONT_KNOW.test(norm)) return { kind: "dont_know" };
  return null;
}

/** Quantidade em estoque/usada, na unidade base do material. */
export function parseQuantityAnswer(text: string, baseUnit: string, packageSize: string | null | undefined): { quantity: string; label: string; approximate: boolean } | null {
  const norm = normalizeText(text).replace(/(\d),(\d)/g, "$1.$2");
  const approximate = UNCERTAIN.test(norm) || /\bmeia\b|\bmeio\b/.test(norm);
  if (/\b(acabou|acabaram|nao tem mais|nao tenho mais|nao sobrou|nenhum|nenhuma|zerou|zerado|zero|nada)\b/.test(norm) && !/\d/.test(norm)) return { quantity: "0", label: "nada", approximate: false };
  const unit = baseUnit.toLowerCase();
  const pkg = Dec.tryParse(packageSize ?? null);
  const containerRe = /\b(latas?|galoes|galao|potes?|baldes?|embalagens?|pacotes?|caixas?|frascos?)\b/;
  // "meia lata", "uma lata e meia", "duas latas"
  if (pkg && pkg.gt(0) && containerRe.test(norm) && unit !== "folha") {
    let count: Dec | null = null;
    if (/\bmeia (lata|embalagem|caixa|balde)\b|\bmeio (pote|galao|balde|pacote|frasco)\b/.test(norm)) count = Dec.from("0.5");
    const n = numberIn(norm.replace(/\bmeia\b|\bmeio\b/g, " "));
    if (n) count = n.value.add(/\be meia\b|\be meio\b/.test(norm) ? "0.5" : "0");
    if (count && count.gte(0)) {
      const word = (containerRe.exec(norm)?.[1] ?? "embalagem").replace(/s$/, "").replace(/oe$/, "ao");
      const label = count.eq("0.5") ? `meia ${word}` : `${count.toString().replace(".", ",")} ${word}${count.gt(1) ? (word.endsWith("m") ? "ns" : "s") : ""}`;
      return { quantity: count.mul(pkg).round(4).toString(), label: label.replace(/embalagemns$/, "embalagens"), approximate };
    }
  }
  // unidade explícita: "2 litros", "500 ml", "12 folhas"
  const sized = parsePackageSizeText(text, baseUnit);
  if (sized) return { quantity: sized.size, label: sized.label, approximate };
  const n = numberIn(norm);
  if (n && n.value.gte(0) && n.value.lte(100000)) return { quantity: n.value.round(4).toString(), label: n.raw, approximate };
  return null;
}

export function parseHoursAnswer(text: string): { hours: string; approximate: boolean } | "days" | null {
  const norm = normalizeText(text).replace(/(\d),(\d)/g, "$1.$2");
  const approximate = UNCERTAIN.test(norm);
  if (/\bmeia hora\b/.test(norm)) return { hours: "0.5", approximate };
  const hourMatch = /(\d+(?:\.\d+)?)\s*(h|hs|hora|horas)\b/.exec(norm);
  let hours: Dec | null = hourMatch ? Dec.tryParse(hourMatch[1]!) : null;
  if (!hours) {
    const w = /\b((?:[a-z]+ ?){1,3}) horas?\b/.exec(norm);
    if (w) {
      const v = wordsToNumber(w[1]!.trim().split(" ").filter((t) => !["umas", "uns", "mais", "ou", "menos"].includes(t)));
      if (v) hours = Dec.from(v);
    }
  }
  if (!hours && /\b(dias?|semanas?|manha|tarde)\b/.test(norm)) return "days";
  if (!hours) {
    const n = numberIn(norm);
    if (n) hours = n.value;
  }
  if (!hours || !hours.gt(0) || hours.gt(500)) return null;
  if (/\be meia\b/.test(norm)) hours = hours.add("0.5");
  return { hours: hours.toString(), approximate };
}

export function parseCoatsAnswer(text: string): { coats: number; approximate: boolean } | null {
  const norm = normalizeText(text);
  const n = numberIn(norm);
  if (!n || !n.value.gt(0) || n.value.gt(20)) return null;
  const v = Math.round(Number(n.value.toString()));
  return v >= 1 ? { coats: v, approximate: UNCERTAIN.test(norm) } : null;
}

export function interpretCollectionAnswer(kind: NeedKind, text: string, opts: { baseUnit?: string; packageSize?: string | null; expecting?: Expecting } = {}): CollectionAnswer {
  const norm = normalizeText(text);
  const baseUnit = opts.baseUnit ?? "un";
  const expecting = opts.expecting ?? "primary";

  if (expecting === "confirm") {
    if (DISCONTINUED.test(norm)) return { kind: "discontinued" };
    const perPackage = /\b(cada|cada uma|cada um|por lata|a unidade|unitario)\b/.test(norm);
    if (perPackage) return { kind: "no", perPackage: true };
    if (YES.test(norm)) return { kind: "yes" };
    if (NO.test(norm)) return { kind: "no" };
  }

  if (expecting === "size" || kind === "material_package_size") {
    const size = parsePackageSizeText(text, baseUnit);
    if (size) return { kind: "size", packageSize: size.size, sizeLabel: size.label };
    const c = common(norm, false);
    if (c) return c;
    // número solto: "1" (litro) ou "900" (ml) para líquidos; "50" folhas
    const n = numberIn(norm);
    if (n && n.value.gt(0)) {
      const u = baseUnit.toLowerCase();
      if (u === "l") {
        if (n.value.gte(50)) return { kind: "size", packageSize: n.value.div(1000).round(4).toString(), sizeLabel: `${n.raw} ml` };
        if (n.value.lte(20)) return { kind: "size", packageSize: n.value.toString(), sizeLabel: `${n.raw.replace(".", ",")} ${n.value.eq(1) ? "litro" : "litros"}` };
      } else if (u === "kg") {
        if (n.value.gte(50)) return { kind: "size", packageSize: n.value.div(1000).round(4).toString(), sizeLabel: `${n.raw} g` };
        if (n.value.lte(50)) return { kind: "size", packageSize: n.value.toString(), sizeLabel: `${n.raw} kg` };
      } else if (n.value.lte(1000)) return { kind: "size", packageSize: n.value.toString(), sizeLabel: `${n.raw} ${u === "folha" ? "folhas" : "unidades"}` };
    }
    return { kind: "unparsed" };
  }

  switch (kind) {
    case "material_price": {
      const p = parsePriceAnswer(text, baseUnit, { expectPrice: true });
      const c = common(norm, p.amountCents !== undefined);
      if (c) return c;
      if (p.amountCents !== undefined) {
        return {
          kind: "price",
          amountCents: p.amountCents,
          ...(p.packages !== undefined ? { packages: p.packages } : {}),
          ...(p.packageSize !== undefined ? { packageSize: p.packageSize, sizeLabel: p.sizeLabel ?? p.packageSize } : {}),
          perPackage: p.pricePerPackage,
          approximate: p.confidence !== "alta",
        };
      }
      if (p.packageSize) return { kind: "size", packageSize: p.packageSize, sizeLabel: p.sizeLabel ?? p.packageSize };
      return p.dontKnow ? { kind: "dont_know" } : p.wantsLater ? { kind: "later" } : { kind: "unparsed" };
    }
    case "stock_level":
    case "job_materials_used": {
      const q = parseQuantityAnswer(text, baseUnit, opts.packageSize);
      const c = common(norm, !!q && q.quantity !== "0");
      if (c) return c;
      return q ? { kind: "quantity", ...q } : { kind: "unparsed" };
    }
    case "job_actual_hours": {
      const h = parseHoursAnswer(text);
      const c = common(norm, !!h && h !== "days");
      if (c) return c;
      if (h === "days") return { kind: "needs_hours" };
      return h ? { kind: "hours", ...h } : { kind: "unparsed" };
    }
    case "technique_coats": {
      const k = parseCoatsAnswer(text);
      const c = common(norm, !!k);
      if (c) return c;
      return k ? { kind: "coats", ...k } : { kind: "unparsed" };
    }
    default:
      return { kind: "unparsed" };
  }
}
