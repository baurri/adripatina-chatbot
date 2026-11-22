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
  if (/^\d+(\.\d+)?$/.test(s)) return Dec.tryParse(s);
  return null;
}

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
  const rs = /r\$\s*(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:,\d{1,2})?)/.exec(norm);
  if (rs) {
    const d = parseNumericBR(rs[1]!);
    if (d) return { cents: d.toCents(), raw: rs[0] };
  }
  // 90 reais | 90,50 reais | 200 conto
  const num = /(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:,\d{1,2})?)\s*(reais|real|conto|contos|pila|pilas)\b/.exec(norm);
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
