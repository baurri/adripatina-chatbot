import { extractLengths, normalizeText, wordsToNumber } from "@adripatina/shared";
import { findTechniques } from "../vocabulary.js";
import { extractClientNames } from "../nlu.js";
import { findFurnitureHits } from "../multi.js";
import { toneIssues } from "./compose.js";

/**
 * INVARIANTES (D-074) — a conferência única de tudo o que o Claude produz, na entrada (texto
 * claro) e na saída (voz). Não são regras por caso: são propriedades que valem para qualquer
 * mensagem — não acrescentar fato, não perder o que foi dito, não prometer o que não foi feito,
 * manter perguntas/exemplos/botões, nada de jargão nem história pessoal. Falhou → o chamador usa
 * o texto original. Espelha o NEVER/VOICE de contract.ts.
 */

/** jargão que nunca chega ao Adriano (VOICE do contrato) */
const JARGON = /\b(campo obrigatorio|cadastr\w* inval\w*|parametro\w*|calibrad\w*|nao calibrad\w*|confianca (baixa|media|alta)|pendencias? antes|piso|markup|margem|processando|invalid\w*)\b/;


const PARTS_AND_DAMAGE = [
  "perna", "pernas", "tampo", "gaveta", "gavetas", "gavetao", "porta", "portas", "puxador", "puxadores", "dobradica", "espelho", "vidro", "assento", "encosto",
  "cabeceira", "peseira", "lateral", "prateleira", "quebrou", "quebrada", "quebrado", "rachada", "rachado", "cupim", "mofo", "podre", "furo", "arranhao",
];

export function numbersIn(text: string): number[] {
  const t = normalizeText(text).replace(/\b\d+\s*[ºª°]/g, " ").replace(/\b\d+(?:o|a)\s/g, " ");
  return (t.match(/\d+(?:[.,]\d+)?/g) ?? []).map((n) => Number(n.replace(/\.(?=\d{3}\b)/g, "").replace(",", ".")));
}

/** números que a pessoa disse (dígitos, por extenso, medidas) e conversões simples (m ↔ cm). */
export function groundNumbers(text: string): number[] {
  const out = new Set<number>(numbersIn(text));
  for (const tok of normalizeText(text).split(/[\s,.;!?]+/)) {
    const w = wordsToNumber([tok]);
    if (w !== null) out.add(w);
  }
  for (const l of extractLengths(text)) out.add(Number(l.meters.toString()));
  for (const v of [...out]) {
    out.add(Math.round(v * 100) / 1);
    out.add(Math.round(v * 100) / 10000);
  }
  return [...out];
}

export const grounded = (v: number, base: number[]) => base.some((b) => Math.abs(b - v) < 0.005 || Math.abs(b - v) / Math.max(1, Math.abs(v)) < 0.001);

function furnitureKeys(text: string): Set<string> {
  return new Set(findFurnitureHits(text).filter((h) => !h.generic).map((h) => h.key));
}

function namesIn(text: string): string[] {
  return extractClientNames(text).map((n) => normalizeText(n).replace(/^(dona|seu|sr|sra|dr|dra)\.?\s+/, "").split(" ")[0]!).filter(Boolean);
}

function newDomainWords(candidate: string, allowed: string): string[] {
  const a = normalizeText(allowed);
  return PARTS_AND_DAMAGE.filter((w) => new RegExp(`\\b${w}\\b`).test(normalizeText(candidate)) && !a.includes(w.slice(0, 5)));
}

/** O texto claro da entrada não pode trazer informação que ele não deu. */
export function inboundIssues(raw: string, clear: string, corpus: string): string[] {
  const issues: string[] = [];
  if (!clear.trim() || clear.length > raw.length * 3 + 200) issues.push("tamanho");
  const base = [...groundNumbers(raw), ...groundNumbers(corpus)];
  for (const n of numbersIn(clear)) if (!grounded(n, base)) issues.push(`número inventado: ${n}`);
  if (/r\$/i.test(clear) && !/(r\$|reais|real|conto|pila|\d)/i.test(normalizeText(raw))) issues.push("valor inventado");
  const allowed = `${raw}\n${corpus}`;
  const fRaw = new Set([...furnitureKeys(raw), ...furnitureKeys(corpus)]);
  for (const k of furnitureKeys(clear)) if (!fRaw.has(k)) issues.push(`móvel inventado: ${k}`);
  // repetir o nome de uma peça não pode virar peça a mais ("mesa de centro ... a mesa de centro")
  // (citar as peças já anotadas pelo nome — "o 1º e o 2º aparador" — é explicitar, não inventar)
  if (!/peças:/.test(corpus) && pieceCount(clear) > pieceCount(raw)) issues.push("peça a mais");
  const tRaw = new Set([...findTechniques(raw), ...findTechniques(corpus)]);
  for (const t of findTechniques(clear)) if (!tRaw.has(t)) issues.push(`técnica inventada: ${t}`);
  const nAllowed = normalizeText(allowed);
  for (const n of namesIn(clear)) if (!nAllowed.includes(n)) issues.push(`nome inventado: ${n}`);
  issues.push(...newDomainWords(clear, allowed).map((w) => `detalhe inventado: ${w}`));
  return issues;
}

function pieceCount(text: string): number {
  return findFurnitureHits(text).reduce((a, h) => a + (h.quantity || 1), 0);
}

/** "anotei" nunca pode virar "marquei/agendei/confirmado" (teste real 23/11/2026: "a data já ficou marcada") */
const COMMITMENT = /\b(agend\w*|marcad[oa]s?|marquei|confirmad[oa]s?|reservad[oa]s?|garantid[oa]s?)\b/;

const QUOTED = /["“”]([^"“”]{2,80})["“”]/g;

/** A mensagem reescrita mantém tudo o que importa da original. */
export function outboundIssues(original: string, polished: string, corpus: string): string[] {
  const issues: string[] = [];
  if (polished.length < original.length * 0.5 || polished.length > original.length * 2 + 220) issues.push("tamanho");
  const a = numbersIn(original).sort().join(",");
  const b = numbersIn(polished).sort().join(",");
  if (a !== b) issues.push(`números mudaram: [${a}] → [${b}]`);
  if ((original.match(/\?/g) ?? []).length !== (polished.match(/\?/g) ?? []).length) issues.push("perguntas mudaram");
  const np = normalizeText(polished.replace(/[“”]/g, '"'));
  for (const m of original.matchAll(QUOTED)) if (!np.includes(normalizeText(m[1]!))) issues.push(`exemplo/botão sumiu: ${m[1]}`);
  const allowed = `${original}\n${corpus}`;
  const fOrig = new Set([...furnitureKeys(original), ...furnitureKeys(corpus)]);
  for (const k of furnitureKeys(polished)) if (!fOrig.has(k)) issues.push(`móvel inventado: ${k}`);
  for (const k of furnitureKeys(original)) if (!furnitureKeys(polished).has(k)) issues.push(`móvel sumiu: ${k}`);
  const tOrig = new Set([...findTechniques(original), ...findTechniques(corpus)]);
  for (const t of findTechniques(polished)) if (!tOrig.has(t)) issues.push(`técnica inventada: ${t}`);
  const nAllowed = normalizeText(allowed);
  for (const n of namesIn(polished)) if (!nAllowed.includes(n)) issues.push(`nome inventado: ${n}`);
  for (const n of namesIn(original)) if (!normalizeText(polished).includes(n)) issues.push(`nome sumiu: ${n}`);
  issues.push(...newDomainWords(polished, allowed).map((w) => `detalhe inventado: ${w}`));
  if (COMMITMENT.test(normalizeText(polished)) && !COMMITMENT.test(normalizeText(original))) issues.push("prometeu/agendou algo que não foi feito");
  if (JARGON.test(normalizeText(polished)) && !JARGON.test(normalizeText(original))) issues.push("jargão");
  issues.push(...toneIssues(polished));
  return issues;
}

