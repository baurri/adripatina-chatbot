import { normalizeText } from "@adripatina/shared";
import { AMBIGUOUS_TERMS, FURNITURE_CATALOG } from "./catalog.js";
import type { FurnitureCategory, FurnitureTypeDef } from "./types.js";

/**
 * Reconhecimento determinístico de móveis (lista curta antes de qualquer IA).
 * - sem acento, plural e diminutivo ("mesinha de centro" → mesa de centro);
 * - erros de digitação leves (distância de edição);
 * - termos genéricos ("armário", "mesinha", "cama grande") NUNCA escolhem sozinhos:
 *   viram candidatos, e só o contexto ("da cozinha") ou uma pergunta resolve.
 */

export interface CatalogType extends FurnitureTypeDef {
  active?: boolean;
}

export interface FurnitureCandidate {
  key: string;
  name: string;
  score: number;
  evidence: string;
}

export interface FurnitureMention {
  status: "match" | "ambiguous";
  /** trecho normalizado que gerou a menção */
  term: string;
  start: number;
  end: number;
  best: FurnitureCandidate | null;
  candidates: FurnitureCandidate[];
}

export interface ShortlistResult {
  status: "match" | "ambiguous" | "none";
  best: FurnitureCandidate | null;
  candidates: FurnitureCandidate[];
  term: string | null;
}

/** Palavras de contexto que apontam para uma categoria (ou tipos específicos). */
const CATEGORY_HINTS: Record<FurnitureCategory, RegExp> = {
  quarto: /\b(quarto|cama|dormitorio|roupas?|cabide)\b/,
  jantar: /\b(jantar|copa|sala de jantar)\b/,
  estar: /\b(sala|sofa|televisao|tv)\b/,
  escritorio: /\b(escritorio|computador|pastas?|documentos?|estudo)\b/,
  cozinha: /\b(cozinha|pia|panelas?|fogao)\b/,
  banheiro: /\b(banheiro|lavabo)\b/,
  externo: /\b(jardim|varanda|quintal|area externa|praca|piscina)\b/,
  infantil: /\b(crianca|bebe|infantil|quarto do menino|quarto da menina)\b/,
  antigo: /\b(antig[oa]|de vo|da avo|do avo|centenari[oa])\b/,
  outro: /$^/,
};

const TYPE_HINTS: Record<string, RegExp> = {
  criado_mudo: /\b(lado da cama|ao lado da cama|cabeceira|quarto)\b/,
  mesa_centro: /\b(centro|frente do sofa|meio da sala)\b/,
  mesa_lateral: /\b(lado do sofa|canto|lateral)\b/,
  banco_jantar: /\b(mesa de jantar|jantar)\b/,
  banco_jardim: /\b(jardim|praca|quintal)\b/,
  cama_casal: /\b(casal)\b/,
};

function stemForms(word: string): string[] {
  const forms = new Set([word, `${word}s`, `${word}es`]);
  if (/a$/.test(word)) {
    const stem = word.slice(0, -1);
    forms.add(`${stem}inha`).add(`${stem}inhas`).add(`${stem}as`);
  } else if (/o$/.test(word)) {
    const stem = word.slice(0, -1);
    forms.add(`${stem}inho`).add(`${stem}inhos`).add(`${stem}os`);
  } else if (/e$/.test(word)) {
    forms.add(`${word.slice(0, -1)}inho`).add(`${word.slice(0, -1)}inha`);
  } else if (/u$/.test(word)) {
    forms.add(`${word}zinho`);
  } else if (/[rl]$/.test(word)) {
    forms.add(`${word}zinho`).add(`${word}es`);
  }
  if (/ao$/.test(word)) forms.add(`${word.slice(0, -2)}oes`).add(`${word.slice(0, -2)}aes`);
  return [...forms];
}

/** Variações do alias: plural/diminutivo na primeira palavra ("mesa de centro" → "mesinha de centro"). */
export function aliasForms(alias: string): string[] {
  const norm = normalizeText(alias).replace(/-/g, " ").replace(/\s+/g, " ").trim();
  const [first, ...rest] = norm.split(" ");
  if (!first) return [];
  return stemForms(first).map((f) => [f, ...rest].join(" "));
}

/** Distância de edição com transposição (Damerau/OSA): "cristaleria" ≈ "cristaleira". */
export function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > 2) return 3;
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, d[i - 2]![j - 2]! + 1);
      d[i]![j] = v;
    }
  }
  return d[a.length]![b.length]!;
}

interface Hit {
  start: number;
  end: number;
  term: string;
  keys: Map<string, { score: number; evidence: string }>;
  ambiguous: boolean;
}

interface Index {
  forms: { form: string; key: string; weight: number; alias: string }[];
  singleWord: { form: string; key: string; alias: string }[];
  byKey: Map<string, CatalogType>;
}

const indexCache = new WeakMap<object, Index>();

function buildIndex(types: readonly CatalogType[]): Index {
  const cached = indexCache.get(types);
  if (cached) return cached;
  const forms: Index["forms"] = [];
  const singleWord: Index["singleWord"] = [];
  const byKey = new Map<string, CatalogType>();
  for (const t of types) {
    if (t.active === false) continue;
    byKey.set(t.key, t);
    for (const alias of t.aliases) {
      // "movel"/"peca" só como último recurso
      const weight = t.key === "movel_nao_identificado" ? 0.2 : 1;
      for (const form of aliasForms(alias)) {
        forms.push({ form, key: t.key, weight, alias });
        if (!form.includes(" ") && form.length >= 5) singleWord.push({ form, key: t.key, alias });
      }
    }
  }
  forms.sort((a, b) => b.form.length - a.form.length);
  const idx = { forms, singleWord, byKey };
  indexCache.set(types, idx);
  return idx;
}

function cand(idx: Index, key: string, score: number, evidence: string): FurnitureCandidate | null {
  const t = idx.byKey.get(key);
  return t ? { key, name: t.name, score: Math.round(score * 100) / 100, evidence } : null;
}

/** Aplica pistas de contexto e decide se um termo genérico ficou resolvido. */
function resolveWithContext(idx: Index, cands: FurnitureCandidate[], context: string): FurnitureCandidate[] {
  return cands
    .map((c) => {
      const t = idx.byKey.get(c.key)!;
      let score = c.score;
      const ev: string[] = [c.evidence];
      if (TYPE_HINTS[c.key]?.test(context)) {
        score += 0.4;
        ev.push("pista no texto");
      } else if (CATEGORY_HINTS[t.category].test(context)) {
        score += 0.3;
        ev.push(`contexto: ${t.category}`);
      }
      return { ...c, score: Math.round(score * 100) / 100, evidence: ev.join("; ") };
    })
    .sort((a, b) => b.score - a.score);
}

/** Todas as menções de móveis no texto, sem sobreposição (a mais longa vence). */
export function findFurnitureMentions(text: string, types: readonly CatalogType[] = FURNITURE_CATALOG, ambiguousTerms: Record<string, string[]> = AMBIGUOUS_TERMS): FurnitureMention[] {
  const idx = buildIndex(types);
  const norm = ` ${normalizeText(text).replace(/[.,;:!?()"]/g, " ").replace(/-/g, " ").replace(/\s+/g, " ").trim()} `;
  const hits: Hit[] = [];
  const overlaps = (s: number, e: number) => hits.some((h) => s < h.end && e > h.start);

  // 1) aliases exatos (mais longos primeiro)
  for (const f of idx.forms) {
    let from = 0;
    for (;;) {
      const at = norm.indexOf(` ${f.form} `, from);
      if (at < 0) break;
      from = at + 1;
      const start = at + 1;
      const end = start + f.form.length;
      const same = hits.find((h) => h.start === start && h.end === end);
      if (same) {
        if (!same.keys.has(f.key)) same.keys.set(f.key, { score: f.weight, evidence: `nome "${f.alias}"` });
        continue;
      }
      if (overlaps(start, end)) continue;
      hits.push({ start, end, term: f.form, keys: new Map([[f.key, { score: f.weight, evidence: `nome "${f.alias}"` }]]), ambiguous: false });
    }
  }
  // 2) termos genéricos ainda não cobertos ("armario", "mesinha", "cama grande")
  const generic = Object.keys(ambiguousTerms).sort((a, b) => b.length - a.length);
  for (const term of generic) {
    for (const form of term.includes(" ") ? [term] : aliasForms(term)) {
      let from = 0;
      for (;;) {
        const at = norm.indexOf(` ${form} `, from);
        if (at < 0) break;
        from = at + 1;
        const start = at + 1;
        const end = start + form.length;
        const exact = hits.find((h) => h.start === start && h.end === end);
        if (exact) {
          // o alias encontrado é ele mesmo um termo genérico: vira ambíguo
          exact.ambiguous = true;
          for (const k of ambiguousTerms[term]!) if (!exact.keys.has(k)) exact.keys.set(k, { score: 0.5, evidence: `termo genérico "${term}"` });
          for (const [k, v] of exact.keys) exact.keys.set(k, { ...v, score: Math.min(v.score, 0.5) });
          continue;
        }
        if (overlaps(start, end)) continue;
        hits.push({ start, end, term: form, ambiguous: true, keys: new Map(ambiguousTerms[term]!.map((k) => [k, { score: 0.5, evidence: `termo genérico "${term}"` }])) });
      }
    }
  }
  // 3) erro de digitação em palavra isolada ("comado", "guardaropa")
  const tokens = [...norm.matchAll(/\S+/g)];
  for (const tk of tokens) {
    const word = tk[0];
    const start = tk.index!;
    const end = start + word.length;
    if (word.length < 5 || overlaps(start, end)) continue;
    let best: { key: string; alias: string; d: number } | null = null;
    for (const s of idx.singleWord) {
      const d = editDistance(word, s.form);
      const max = word.length >= 8 ? 2 : 1;
      if (d > 0 && d <= max && (!best || d < best.d)) best = { key: s.key, alias: s.alias, d };
    }
    if (best) hits.push({ start, end, term: word, ambiguous: false, keys: new Map([[best.key, { score: best.d === 1 ? 0.75 : 0.6, evidence: `parecido com "${best.alias}"` }]]) });
  }

  const context = norm;
  return hits
    .sort((a, b) => a.start - b.start)
    .map((h) => {
      let cands = [...h.keys].map(([k, v]) => cand(idx, k, v.score, v.evidence)).filter((c): c is FurnitureCandidate => !!c);
      cands = resolveWithContext(idx, cands, context.slice(0, h.start) + context.slice(h.end)).slice(0, 5);
      const [first, second] = cands;
      const clear = !!first && (!second || first.score - second.score >= 0.25) && first.score >= 0.7;
      return {
        status: clear ? "match" : "ambiguous",
        term: h.term,
        start: h.start - 1,
        end: h.end - 1,
        best: clear ? first! : null,
        candidates: cands,
      } satisfies FurnitureMention;
    });
}

/** Lista curta para UMA menção (a primeira encontrada): base para a IA escolher ou para perguntar. */
export function shortlistFurniture(text: string, types: readonly CatalogType[] = FURNITURE_CATALOG, ambiguousTerms: Record<string, string[]> = AMBIGUOUS_TERMS): ShortlistResult {
  const mentions = findFurnitureMentions(text, types, ambiguousTerms).filter((m) => !(m.best?.key === "movel_nao_identificado"));
  const m = mentions[0];
  if (!m) return { status: "none", best: null, candidates: [], term: null };
  return { status: m.status, best: m.best, candidates: m.candidates, term: m.term };
}

/** Pergunta curta de esclarecimento a partir dos candidatos ("de centro, lateral ou ao lado da cama?"). */
export function clarificationQuestion(term: string, candidates: FurnitureCandidate[], types: readonly CatalogType[] = FURNITURE_CATALOG): string {
  const idx = buildIndex(types);
  const names = candidates.slice(0, 4).map((c) => idx.byKey.get(c.key)?.name.toLowerCase() ?? c.name.toLowerCase());
  const list = names.length > 1 ? `${names.slice(0, -1).join(", ")} ou ${names[names.length - 1]}` : names[0] ?? "";
  const word = term.replace(/\b(\w)/, (x) => x.toUpperCase());
  return `${word} de qual tipo: ${list}?`;
}

/**
 * Escolhe entre candidatos já conhecidos a partir da resposta do artesão
 * ("de cozinha", "é queen", "a do lado da cama"). Nunca sai da lista.
 */
export function pickAmongCandidates(answer: string, candidateKeys: string[], types: readonly CatalogType[] = FURNITURE_CATALOG, genericTerm = ""): FurnitureCandidate | null {
  const idx = buildIndex(types);
  const norm = ` ${normalizeText(answer).replace(/[.,;:!?()"]/g, " ").replace(/-/g, " ").replace(/\s+/g, " ").trim()} `;
  const generic = new Set([...normalizeText(genericTerm).split(" "), "de", "da", "do", "com", "e", "a", "o", "um", "uma", "para"]);
  const scored = candidateKeys
    .map((key) => {
      const t = idx.byKey.get(key);
      if (!t) return null;
      let best = 0;
      let evidence = "";
      for (const alias of [t.name, ...t.aliases]) {
        const words = normalizeText(alias).replace(/-/g, " ").split(" ").filter((w) => w && !generic.has(w));
        if (!words.length) continue;
        const found = words.filter((w) => stemForms(w).some((f) => norm.includes(` ${f} `)));
        const score = found.length / words.length + found.length * 0.01;
        if (found.length && score > best) {
          best = score;
          evidence = `respondeu "${found.join(" ")}"`;
        }
      }
      // pistas de contexto também valem ("da cozinha", "ao lado da cama")
      if (best < 1 && (TYPE_HINTS[key]?.test(norm) || CATEGORY_HINTS[t.category].test(norm))) {
        best = Math.max(best, 0.8);
        evidence = evidence || "pista de contexto";
      }
      return best > 0 ? { key, name: t.name, score: Math.round(best * 100) / 100, evidence } : null;
    })
    .filter((c): c is FurnitureCandidate => !!c)
    .sort((a, b) => b.score - a.score);
  const [first, second] = scored;
  if (!first || first.score < 0.5) return null;
  if (second && first.score - second.score < 0.2) return null;
  return first;
}
