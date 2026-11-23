import { Dec } from "./decimal.js";
import { normalizeText } from "./text.js";

/**
 * Interpretação de números em português falado/escrito, como aparecem em
 * transcrições de áudio: "noventa reais", "duzentos e cinquenta",
 * "mil e quinhentos", "R$ 1.234,56", "um metro e oitenta".
 */

const UNITS: Record<string, number> = {
  zero: 0, um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9,
  dez: 10, onze: 11, doze: 12, treze: 13, quatorze: 14, catorze: 14, quinze: 15, dezesseis: 16, dezessete: 17,
  dezoito: 18, dezenove: 19, vinte: 20, trinta: 30, quarenta: 40, cinquenta: 50, sessenta: 60, setenta: 70,
  oitenta: 80, noventa: 90, cem: 100, cento: 100, duzentos: 200, duzentas: 200, trezentos: 300, trezentas: 300,
  quatrocentos: 400, quatrocentas: 400, quinhentos: 500, quinhentas: 500, seiscentos: 600, seiscentas: 600,
  setecentos: 700, setecentas: 700, oitocentos: 800, oitocentas: 800, novecentos: 900, novecentas: 900,
  meia: 0.5, meio: 0.5,
};

const NUMBER_WORDS = new Set([...Object.keys(UNITS), "mil", "e"]);

/** Converte uma sequência de palavras numéricas em inteiro. Retorna null se não for número. */
export function wordsToNumber(words: readonly string[]): number | null {
  if (words.length === 0) return null;
  let total = 0;
  let current = 0;
  let seen = false;
  for (const w of words) {
    if (w === "e") continue;
    if (w === "mil") {
      total += (current === 0 ? 1 : current) * 1000;
      current = 0;
      seen = true;
      continue;
    }
    const v = UNITS[w];
    if (v === undefined) return null;
    if (v === 0.5) return null; // "meia" tratada separadamente
    current += v;
    seen = true;
  }
  return seen ? total + current : null;
}

/** Extrai um número decimal de string numérica BR: "1.234,56", "90", "1,80", "2.5". */
export function parseNumericBR(raw: string): Dec | null {
  const s = raw.trim();
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) return Dec.tryParse(s.replace(/\./g, "").replace(",", "."));
  if (/^\d+,\d+$/.test(s)) return Dec.tryParse(s.replace(",", "."));
  // ponto com 1 ou 2 casas ("1000.50", "85.9") é decimal, nunca separador de milhar
  if (/^\d+\.\d{1,2}$/.test(s)) return Dec.tryParse(s);
  // "1.000", "12.500" (sem vírgula): milhar
  if (/^\d{1,3}(\.\d{3})+$/.test(s)) return Dec.tryParse(s.replace(/\./g, ""));
  if (/^\d+(\.\d+)?$/.test(s)) return Dec.tryParse(s);
  return null;
}

/**
 * Número monetário pt-BR sem pegar pedaço de outro número:
 * "1.000,50", "1.000", "1000.50" (ponto decimal), "85,90", "85".
 */
const MONEY_NUMBER = String.raw`\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?(?!\d)|\d+[.,]\d{1,2}(?!\d)|\d+`;
/** limites do número: vírgula/ponto só "colam" quando seguidos de dígito ("foi 120, o resto..." é 120) */
const NUM_START = String.raw`(?<!\d|\d[.,])`;
const NUM_END = String.raw`(?!\d|[.,]\d)`;

export interface MoneyMention {
  cents: number;
  raw: string;
}

/**
 * Encontra o primeiro valor monetário no texto.
 * Aceita "R$ 90", "90 reais", "R$90,50", "noventa reais", "duzentos e cinquenta reais",
 * "mil e duzentos reais", "200 conto(s)", "cinquenta e cinco reais e cinquenta centavos".
 */
export function extractMoney(text: string): MoneyMention | null {
  const norm = normalizeText(text);
  // R$ 1.234,56 | R$90
  const rs = new RegExp(String.raw`r\$\s*(${MONEY_NUMBER})${NUM_END}`).exec(norm);
  if (rs) {
    const d = parseNumericBR(rs[1]!);
    if (d) return { cents: d.toCents(), raw: rs[0] };
  }
  // 90 reais | 90,50 reais | 200 conto
  const num = new RegExp(String.raw`${NUM_START}(${MONEY_NUMBER})\s*(reais|real|conto|contos|pila|pilas)\b`).exec(norm);
  if (num) {
    const d = parseNumericBR(num[1]!);
    if (d) return { cents: d.toCents(), raw: num[0] };
  }
  // por extenso: "... noventa reais [e cinquenta centavos]"
  const tokens = norm.replace(/[.,]/g, " ").split(" ").filter(Boolean);
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]!;
    if (t !== "reais" && t !== "real" && t !== "conto" && t !== "contos") continue;
    let j = i - 1;
    while (j >= 0 && NUMBER_WORDS.has(tokens[j]!)) j--;
    const words = tokens.slice(j + 1, i);
    while (words[0] === "e") words.shift();
    const reais = wordsToNumber(words);
    if (reais === null) continue;
    let cents = reais * 100;
    // centavos opcionais
    if (tokens[i + 1] === "e") {
      let k = i + 2;
      const cw: string[] = [];
      while (k < tokens.length && NUMBER_WORDS.has(tokens[k]!)) cw.push(tokens[k++]!);
      if (tokens[k] === "centavos" || tokens[k] === "centavo") {
        const c = wordsToNumber(cw);
        if (c !== null && c < 100) cents += c;
      }
    }
    return { cents, raw: tokens.slice(j + 1, i + 1).join(" ") };
  }
  return null;
}

/**
 * Valor dito SEM "reais" logo depois de um verbo de dinheiro ("comprei duas latas por 150",
 * "me pagou 85,90", "custou uns 90"). Ignora quantidades e tamanhos ("2 latas", "900 ml").
 * Serve só para PRÉ-PREENCHER uma quantia que sempre é confirmada pelo usuário.
 */
export function extractLooseMoney(text: string): MoneyMention | null {
  const strict = extractMoney(text);
  if (strict) return strict;
  const norm = normalizeText(text);
  const re = new RegExp(
    String.raw`\b(por|foi|foram|deu|custou|custa|custando|sai|saiu|paguei|pagou|pago|recebi|valor de)\s+(?:uns\s+|umas\s+|mais ou menos\s+|cerca de\s+|r\$\s*)?(${MONEY_NUMBER})${NUM_END}(?!\s*(?:ml|l|lt|litros?|kg|g|gr|gramas?|cm|m|mm|metros?|folhas?|latas?|galao|galoes|potes?|unidades?|pecas?|moveis|horas?|h|dias?|%|x|vezes)\b)`,
  );
  const m = re.exec(norm);
  if (!m) return null;
  const d = parseNumericBR(m[2]!);
  if (!d || !d.gt(0)) return null;
  return { cents: d.toCents(), raw: m[0] };
}

/** Valor solto ("90", "1.000", "85,90", "1000.50") como resposta a "quanto foi?". */
export function parseBareAmountCents(text: string): number | null {
  const money = extractMoney(text);
  if (money) return money.cents;
  const m = new RegExp(String.raw`${NUM_START}(${MONEY_NUMBER})${NUM_END}`).exec(normalizeText(text));
  if (!m) return null;
  const d = parseNumericBR(m[1]!);
  return d && d.gt(0) ? d.toCents() : null;
}

export interface LengthMention {
  /** comprimento em metros */
  meters: Dec;
  raw: string;
}

/**
 * Extrai medidas lineares: "2 metros", "1,80 m", "180 cm", "dois metros",
 * "um metro e oitenta", "1m80".
 */
export function extractLengths(text: string): LengthMention[] {
  const norm = normalizeText(text);
  const out: LengthMention[] = [];
  const re = /(\d+(?:[.,]\d+)?)\s*(metros|metro|m|centimetros|centimetro|cm)\b(?:\s*(?:e\s*)?(\d{1,2})\b(?!\s*(?:cm|m|metros?)))?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(norm))) {
    const value = Dec.tryParse(m[1]!.replace(",", "."));
    if (!value) continue;
    const unit = m[2]!;
    let meters = unit.startsWith("c") ? value.div(100) : value;
    if (m[3] && !unit.startsWith("c")) meters = meters.add(Dec.from(m[3]).div(100));
    out.push({ meters, raw: m[0] });
  }
  // por extenso: "dois metros", "um metro e oitenta", "um metro e meio"
  const tokens = norm.replace(/[.,]/g, " ").split(" ").filter(Boolean);
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]!;
    if (t !== "metro" && t !== "metros") continue;
    let j = i - 1;
    while (j >= 0 && NUMBER_WORDS.has(tokens[j]!) && tokens[j] !== "e") j--;
    const words = tokens.slice(j + 1, i);
    const whole = wordsToNumber(words);
    if (whole === null) continue;
    let meters = Dec.from(whole);
    if (tokens[i + 1] === "e") {
      if (tokens[i + 2] === "meio") meters = meters.add("0.5");
      else {
        let k = i + 2;
        const cw: string[] = [];
        while (k < tokens.length && NUMBER_WORDS.has(tokens[k]!)) cw.push(tokens[k++]!);
        const cm = wordsToNumber(cw);
        if (cm !== null && cm < 100) meters = meters.add(Dec.from(cm).div(100));
      }
    }
    out.push({ meters, raw: tokens.slice(j + 1, i + 1).join(" ") });
  }
  return out;
}

/** Extrai uma contagem simples: "três portas" → {count:3, noun:"portas"}. */
export function extractCount(text: string, nounPattern: RegExp): number | null {
  const norm = normalizeText(text);
  const tokens = norm.replace(/[.,]/g, " ").split(" ").filter(Boolean);
  for (let i = 1; i < tokens.length; i++) {
    if (!nounPattern.test(tokens[i]!)) continue;
    const prev = tokens[i - 1]!;
    if (/^\d+$/.test(prev)) return Number(prev);
    const w = wordsToNumber([prev]);
    if (w !== null) return w;
  }
  return null;
}
