import { normalizeText } from "@adripatina/shared";

/** Vocabulário de móveis: forma canônica → variações (sem acento, minúsculas). */
export const FURNITURE: Record<string, { label: string; feminine: boolean; variants: string[] }> = {
  cristaleira: { label: "cristaleira", feminine: true, variants: ["cristaleira", "cristaleiras", "cristaleirinha", "louceira", "louceiro"] },
  guarda_roupa: { label: "guarda-roupa", feminine: false, variants: ["guarda-roupa", "guarda roupa", "guardaroupa", "guarda-roupas", "roupeiro"] },
  comoda: { label: "cômoda", feminine: true, variants: ["comoda", "comodas", "comodinha"] },
  mesa_cabeceira: { label: "criado-mudo", feminine: false, variants: ["criado-mudo", "criado mudo", "mesa de cabeceira", "mesinha de cabeceira", "um criado", "o criado", "criados"] },
  mesa: { label: "mesa", feminine: true, variants: ["mesa", "mesas", "mesinha", "mesa de jantar", "mesa de centro"] },
  cadeira: { label: "cadeira", feminine: true, variants: ["cadeira", "cadeiras", "cadeirinha"] },
  armario: { label: "armário", feminine: false, variants: ["armario", "armarios", "armarinho"] },
  estante: { label: "estante", feminine: true, variants: ["estante", "estantes", "prateleira"] },
  aparador: { label: "aparador", feminine: false, variants: ["aparador", "aparadores"] },
  buffet: { label: "buffet", feminine: false, variants: ["buffet", "bufe", "bufet", "balcao"] },
  penteadeira: { label: "penteadeira", feminine: true, variants: ["penteadeira"] },
  banco: { label: "banco", feminine: false, variants: ["banco", "banquinho", "banqueta"] },
  poltrona: { label: "poltrona", feminine: true, variants: ["poltrona", "poltronas"] },
  cama: { label: "cama", feminine: true, variants: ["cama", "cabeceira de cama"] },
  escrivaninha: { label: "escrivaninha", feminine: true, variants: ["escrivaninha", "secretaria"] },
  bau: { label: "baú", feminine: false, variants: ["bau", "bauzinho"] },
  oratorio: { label: "oratório", feminine: false, variants: ["oratorio"] },
  rack: { label: "rack", feminine: false, variants: ["rack"] },
  sapateira: { label: "sapateira", feminine: true, variants: ["sapateira"] },
  moldura: { label: "moldura", feminine: true, variants: ["moldura", "quadro", "espelho"] },
  porta: { label: "porta", feminine: true, variants: ["porta antiga", "porta de madeira"] },
  sofa: { label: "sofá", feminine: false, variants: ["sofa", "sofas", "sofa cama", "sofa-cama", "bicama"] },
};

/**
 * Nomes que não bastam para saber o móvel: "mesinha" pode ser de centro, lateral,
 * de cabeceira ou de apoio. O bot pergunta em vez de assumir.
 */
export const AMBIGUOUS_FURNITURE: { re: RegExp; question: string; options: { label: string; key: string; descriptor?: string }[] }[] = [
  {
    re: /\bmesinhas?\b(?!\s+(de\s+)?(centro|cabeceira|canto|lateral|apoio|cafe|jantar|cozinha|escritorio|estudo|cabeceira))/,
    question: "Essa mesinha é de centro, lateral, de cabeceira ou de apoio?",
    options: [
      { label: "De centro", key: "mesa", descriptor: "de centro" },
      { label: "Lateral", key: "mesa", descriptor: "lateral" },
      { label: "De cabeceira", key: "mesa_cabeceira" },
      { label: "De apoio", key: "mesa", descriptor: "de apoio" },
    ],
  },
  {
    re: /\b(movel|armario)\s+(onde|que|pra|para|de)\s+(se\s+)?(poe|guarda|guardar|coloca|ficam?)\s+(as\s+)?loucas?\b|\bmovel das loucas\b/,
    question: "É uma cristaleira, um buffet ou um armário de cozinha?",
    options: [
      { label: "Cristaleira", key: "cristaleira" },
      { label: "Buffet", key: "buffet" },
      { label: "Armário", key: "armario", descriptor: "de cozinha" },
    ],
  },
];

/** Resposta à pergunta de esclarecimento ("de centro", "a de cabeceira", "buffet"). */
export function resolveAmbiguousFurniture(kind: number, text: string): { key: string; descriptor?: string } | null {
  const amb = AMBIGUOUS_FURNITURE[kind];
  if (!amb) return null;
  const n = normalizeText(text);
  for (const o of amb.options) {
    const words = normalizeText(o.label).replace(/^de\s+/, "");
    if (new RegExp(`\\b${words}\\b`).test(n)) return { key: o.key, ...(o.descriptor ? { descriptor: o.descriptor } : {}) };
  }
  return null;
}

/** Índice do esclarecimento necessário para o texto, ou -1. */
export function ambiguousFurnitureKind(text: string): number {
  const n = normalizeText(text);
  return AMBIGUOUS_FURNITURE.findIndex((a) => a.re.test(n));
}

/** Diminutivos informais ("rackzinho", "comodazinha") → forma base, mantendo o comprimento do texto. */
export function normalizeFurnitureText(norm: string): string {
  return norm.replace(/\b([a-z]+?)(zinhos|zinhas|zinho|zinha)\b/g, (_m, base: string, suf: string) => base + " ".repeat(suf.length));
}

export const TECHNIQUES: Record<string, { label: string; variants: string[] }> = {
  patina: { label: "pátina", variants: ["patina", "patinar", "patinado", "patinada"] },
  decape: { label: "decapê", variants: ["decape", "decapar", "decapado", "decapada"] },
  folha_ouro: { label: "folha de ouro", variants: ["folha de ouro", "dourar", "douracao", "dourado", "dourada", "folheado a ouro"] },
  verniz: { label: "verniz", variants: ["verniz", "envernizar", "envernizado", "envernizada"] },
  enceramento: { label: "enceramento", variants: ["encerar", "enceramento", "cera"] },
  restauracao: { label: "restauração", variants: ["restaurar", "restauracao", "restauro", "reformar", "reforma"] },
  pintura_lisa: { label: "pintura", variants: ["pintar", "pintura", "repintar", "pinte", "pintado", "pintada", "pinto"] },
};

export const DESCRIPTORS = [
  "grande", "pequena", "pequeno", "antiga", "antigo", "velha", "velho", "nova", "novo", "alta", "alto", "baixa", "baixo",
  "branca", "branco", "preta", "preto", "marrom", "azul", "verde", "vermelha", "vermelho", "amarela", "amarelo", "rosa", "cinza",
  "colonial", "rustica", "rustico", "provencal", "madeira macica", "imbuia", "jacaranda", "cedro", "pinus", "mdf",
] as const;

const OPPOSITES: Record<string, string> = {
  grande: "pequena", pequena: "grande", pequeno: "grande", alta: "baixa", baixa: "alta", alto: "baixo", baixo: "alto",
  antiga: "nova", antigo: "novo", nova: "antiga", novo: "antigo",
};

export function descriptorsConflict(a: readonly string[], b: readonly string[]): boolean {
  const norm = (s: string) => s.replace(/o$/, "a");
  const sb = new Set(b.map(norm));
  return a.some((d) => {
    const opp = OPPOSITES[d];
    return opp !== undefined && sb.has(norm(opp));
  });
}

function containsPhrase(norm: string, phrase: string): boolean {
  const p = normalizeText(phrase);
  return new RegExp(`(^|[^a-z])${p.replace(/[-\s]/g, "[-\\s]?")}([^a-z]|$)`).test(norm);
}

/**
 * Móvel principal da frase: a menção que aparece PRIMEIRO vence ("sofá que vira cama" → sofá,
 * "mesa de oito cadeiras" → mesa); entre menções sobrepostas, a variante mais longa
 * ("mesa de cabeceira" antes de "mesa").
 */
export function findFurniture(text: string): string | undefined {
  const norm = normalizeFurnitureText(normalizeText(text));
  const entries = Object.entries(FURNITURE).flatMap(([key, v]) => v.variants.map((variant) => ({ key, variant: normalizeText(variant) })));
  let best: { key: string; start: number; len: number } | undefined;
  for (const { key, variant } of entries) {
    const m = new RegExp(`(^|[^a-z])${variant.replace(/[-\s]/g, "[-\\s]?")}([^a-z]|$)`).exec(norm);
    if (!m) continue;
    const start = m.index + m[1]!.length;
    if (!best || start < best.start || (start === best.start && variant.length > best.len)) best = { key, start, len: variant.length };
  }
  // "aquele móvel onde põe as louças": não adivinhar, o fluxo pergunta
  if (best && ambiguousFurnitureKind(text) === 1 && best.key === "armario") return undefined;
  return best?.key;
}

export function findTechniques(text: string): string[] {
  const norm = normalizeText(text);
  const found: string[] = [];
  for (const [key, v] of Object.entries(TECHNIQUES)) {
    if (v.variants.some((variant) => containsPhrase(norm, variant))) found.push(key);
  }
  return found;
}

export function findDescriptors(text: string): string[] {
  const norm = normalizeText(text);
  return DESCRIPTORS.filter((d) => containsPhrase(norm, d));
}

export function furnitureLabel(key: string | null | undefined): string {
  if (!key) return "móvel";
  return FURNITURE[key]?.label ?? key.replace(/_/g, " ");
}

export function furnitureArticle(key: string | null | undefined): "a" | "o" {
  return key && FURNITURE[key]?.feminine ? "a" : "o";
}

export function techniqueLabel(key: string): string {
  return TECHNIQUES[key]?.label ?? key.replace(/_/g, " ");
}

export function techniquesLabel(keys: readonly string[]): string {
  const labels = keys.map(techniqueLabel);
  if (labels.length <= 1) return labels[0] ?? "";
  return `${labels.slice(0, -1).join(", ")} e ${labels[labels.length - 1]}`;
}

/**
 * Perfil de cada móvel: o que faz sentido perguntar. Cama, cadeira, mesa etc.
 * não têm "parte de dentro" — perguntar isso confunde e soa robótico.
 */
const HAS_INTERIOR = new Set(["cristaleira", "guarda_roupa", "comoda", "mesa_cabeceira", "armario", "estante", "buffet", "aparador", "penteadeira", "bau", "oratorio", "rack", "sapateira", "escrivaninha"]);

/** Móveis com tampo (faz sentido perguntar "só o tampo ou a peça inteira?"). Cadeira, cama, sofá não. */
const HAS_TOP = new Set(["mesa", "comoda", "mesa_cabeceira", "aparador", "buffet", "rack", "escrivaninha", "penteadeira", "bau", "sapateira", "armario"]);

export function furnitureHasTop(key: string | null | undefined): boolean {
  return !key || HAS_TOP.has(key);
}

export function furnitureHasInterior(key: string | null | undefined): boolean | null {
  if (!key) return null;
  return FURNITURE[key] ? HAS_INTERIOR.has(key) : null;
}

/** Medidas padrão de colchão no Brasil (largura × comprimento, metros). */
export const BED_SIZES: Record<string, { label: string; width: string; length: string }> = {
  solteiro: { label: "solteiro", width: "0.88", length: "1.88" },
  viuva: { label: "viúva", width: "1.28", length: "1.88" },
  casal: { label: "casal", width: "1.38", length: "1.88" },
  queen: { label: "queen", width: "1.58", length: "1.98" },
  king: { label: "king", width: "1.93", length: "2.03" },
};

/** "cama de casal queen" → queen (o tamanho mais específico vence). */
export function detectBedSize(text: string): keyof typeof BED_SIZES | null {
  const n = normalizeText(text);
  if (/\b(super ?king|king ?size|king)\b/.test(n)) return "king";
  if (/\bqueen\b/.test(n)) return "queen";
  if (/\bviuva\b/.test(n)) return "viuva";
  if (/\b(de )?solteiro\b/.test(n)) return "solteiro";
  if (/\b(de )?casal\b/.test(n)) return "casal";
  return null;
}
