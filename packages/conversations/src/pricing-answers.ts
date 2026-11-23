import { Dec, extractMoney, normalizeText, wordsToNumber } from "@adripatina/shared";

/**
 * Interpretação de respostas sobre preço e embalagem de material.
 * Usado tanto no registro de compras quanto na coleta de preços durante o
 * orçamento — um único parser para não divergir regras.
 * A IA nunca participa daqui: só o que o artesão falou é extraído.
 */

export type PriceConfidence = "alta" | "media" | "baixa";

export interface PriceAnswer {
  /** valor mencionado (total da compra ou preço da embalagem), em centavos */
  amountCents?: number;
  /** quantidade de embalagens (quando dita) */
  packages?: number;
  /** tamanho de UMA embalagem na unidade base do material (L, kg, folha, un) */
  packageSize?: string;
  /** como foi dito, para mostrar na confirmação ("900 ml") */
  sizeLabel?: string;
  /** "cada uma custou X" — valor é por embalagem mesmo havendo várias */
  pricePerPackage: boolean;
  confidence: PriceConfidence;
  dontKnow: boolean;
  wantsLater: boolean;
  wantsPhoto: boolean;
}

const COUNT_NOUNS = "latas?|galoes|galao|potes?|frascos?|caixas?|pacotes?|embalagens?|baldes?|tubos?|rolos?|unidades?|folhas?";
const UNCERTAIN = /\b(acho|acho que|deve ser|deve estar|deve|uns|umas|mais ou menos|por volta|aproximadamente|cerca de|tipo|se nao me engano|parece)\b/;
const DONT_KNOW = /\b(nao sei|nao lembro|nao me lembro|nao faco ideia|sei la|tenho que olhar|preciso olhar|preciso ver|vou olhar|vou ver|deixa eu ver|nao tenho ideia|esqueci)\b/;
const LATER = /\b(depois|mais tarde|outra hora|continuar depois|amanha eu vejo|depois eu vejo)\b/;
const PHOTO = /\b(foto|fotografia|recibo|nota fiscal|notinha|cupom|etiqueta|comprovante)\b/;

function liquidUnit(baseUnit: string): boolean {
  return baseUnit.toLowerCase() === "l";
}

/** Tamanho da embalagem convertido para a unidade base (exato). */
export function parsePackageSizeText(text: string, baseUnit: string): { size: string; label: string } | null {
  const norm = normalizeText(text).replace(/(\d),(\d)/g, "$1.$2");
  const unit = baseUnit.toLowerCase();
  // "meio litro", "um litro", "um litro e meio", "um quilo"
  if (/\bmeio (litro|quilo|kg)\b/.test(norm)) return { size: "0.5", label: /litro/.test(norm) ? "meio litro" : "meio quilo" };
  if (/\bum (litro|quilo) e meio\b/.test(norm)) return { size: "1.5", label: /litro/.test(norm) ? "1,5 litro" : "1,5 kg" };
  const re = /(\d+(?:\.\d+)?|[a-z]+(?: e [a-z]+)?)\s*(ml|mililitros?|l|lt|litros?|g|gr|gramas?|kg|quilos?|kilos?|folhas?)\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(norm))) {
    const rawNum = m[1]!;
    let n: Dec | null = /^\d/.test(rawNum) ? Dec.tryParse(rawNum) : (() => {
      const w = wordsToNumber(rawNum.split(" "));
      return w === null ? null : Dec.from(w);
    })();
    if (!n || !n.gt(0)) continue;
    const u = m[2]!;
    let label = `${n.toString().replace(".", ",")} ${u.startsWith("folha") ? "folhas" : u}`;
    if (unit === "folha" || unit === "un") {
      if (u.startsWith("folha")) return { size: n.toString(), label };
      continue;
    }
    if (/^(ml|mililitro)/.test(u)) n = n.div(1000);
    else if (/^(g|gr|grama)/.test(u) && !/^(gal)/.test(u)) n = n.div(1000);
    if (liquidUnit(unit) && /^(g|gr|grama|kg|quilo|kilo)/.test(u)) label += " (peso)";
    return { size: n.round(4).toString(), label };
  }
  // "lata de 900" sem unidade: em líquidos, ≥ 50 é ml; ≤ 20 é litro
  const bare = /\b(?:lata|galao|embalagem|pote|frasco|balde)\s+de\s+(\d+(?:\.\d+)?)\b(?!\s*(?:reais|real|r\$))/.exec(norm);
  if (bare) {
    const n = Dec.from(bare[1]!);
    if (liquidUnit(unit)) {
      if (n.gte(50)) return { size: n.div(1000).round(4).toString(), label: `${bare[1]} ml` };
      if (n.lte(20) && n.gt(0)) return { size: n.toString(), label: `${bare[1]!.replace(".", ",")} L` };
    }
  }
  return null;
}

function parsePackageCount(norm: string): number | null {
  const re = new RegExp(`\\b(\\d+|um|uma|dois|duas|tres|quatro|cinco|seis|sete|oito|nove|dez)\\s+(${COUNT_NOUNS})\\b`);
  const m = re.exec(norm);
  if (!m) return null;
  const n = /^\d+$/.test(m[1]!) ? Number(m[1]) : wordsToNumber([m[1]!]);
  return n && n > 0 && n <= 1000 ? n : null;
}

/** Valor dito sem "reais": "90", "noventa", "uns 85". Remove antes os números de embalagem. */
function looseAmount(norm: string): number | null {
  const m = /(?:^|\s)(?:r\$\s*)?(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:,\d{1,2})?)(?=\s|$)/.exec(norm);
  if (m) {
    const raw = m[1]!;
    const d = Dec.tryParse(raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw.replace(/\./g, ""));
    if (d && d.gt(0)) return d.toCents();
  }
  const tokens = norm.split(" ").filter(Boolean);
  for (let i = 0; i < tokens.length; i++) {
    for (let j = Math.min(tokens.length, i + 6); j > i; j--) {
      const w = wordsToNumber(tokens.slice(i, j));
      if (w !== null && w > 0 && !["um", "uma"].includes(tokens[i]!)) return w * 100;
    }
  }
  return null;
}

export function parsePriceAnswer(text: string, baseUnit: string, opts: { expectPrice?: boolean } = {}): PriceAnswer {
  const norm = normalizeText(text);
  const out: PriceAnswer = {
    pricePerPackage: /\b(cada|cada uma|cada um|a unidade|por unidade|por lata|por galao)\b/.test(norm),
    confidence: "alta",
    dontKnow: DONT_KNOW.test(norm),
    wantsLater: LATER.test(norm),
    wantsPhoto: PHOTO.test(norm),
  };
  const size = parsePackageSizeText(text, baseUnit);
  if (size) {
    out.packageSize = size.size;
    out.sizeLabel = size.label;
  }
  const count = parsePackageCount(norm);
  if (count !== null) out.packages = count;

  // remove expressões de tamanho/quantidade antes de procurar o valor
  const withoutSize = norm
    .replace(/(\d+(?:[.,]\d+)?)\s*(ml|mililitros?|l|lt|litros?|g|gr|gramas?|kg|quilos?|kilos?|folhas?)\b/g, " ")
    .replace(/\b(?:lata|galao|embalagem|pote|frasco|balde)\s+de\s+\d+(?:[.,]\d+)?\b/g, " ")
    .replace(new RegExp(`\\b(\\d+|um|uma|dois|duas|tres|quatro|cinco)\\s+(${COUNT_NOUNS})\\b`, "g"), " ");
  const money = extractMoney(withoutSize);
  if (money) out.amountCents = money.cents;
  else if (opts.expectPrice && !out.dontKnow) {
    const loose = looseAmount(withoutSize);
    if (loose !== null) out.amountCents = loose;
  }
  if (out.dontKnow && out.amountCents === undefined) out.confidence = "baixa";
  else if (UNCERTAIN.test(norm)) out.confidence = "media";
  return out;
}

/** Preço de reposição por embalagem a partir do total (centavos exatos, meio para cima). */
export function pricePerPackageCents(totalCents: number, packages: number): number {
  if (!Number.isSafeInteger(totalCents) || totalCents <= 0) throw new RangeError("Valor inválido");
  if (!Number.isInteger(packages) || packages < 1) throw new RangeError("Quantidade inválida");
  return Dec.from(totalCents).div(packages).toIntegerCents("HALF_UP");
}

/** Texto amigável do tamanho na unidade base: 0.9 L → "900 ml", 3.6 L → "3,6 litros". */
export function packageSizeLabel(size: string, baseUnit: string): string {
  const d = Dec.from(size);
  const u = baseUnit.toLowerCase();
  if (u === "l") return d.lt(1) ? `${d.mul(1000).round(0).toString()} ml` : `${d.toString().replace(".", ",")} ${d.eq(1) ? "litro" : "litros"}`;
  if (u === "kg") return d.lt(1) ? `${d.mul(1000).round(0).toString()} g` : `${d.toString().replace(".", ",")} kg`;
  if (u === "folha") return `${d.toString()} ${d.eq(1) ? "folha" : "folhas"}`;
  return `${d.toString()} ${baseUnit}`;
}
