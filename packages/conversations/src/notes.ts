import { extractClientNames } from "./nlu.js";

/**
 * Observações livres de um serviço: detalhes que o artesão fala de passagem e que não têm
 * pergunta própria, mas que ele (e o PDF) não podem perder — cor, quanto tempo ele acha que
 * leva, outro dono citado. Regras simples e conservadoras: na dúvida, não anota.
 *
 * Exemplos reais (23/11/2026): "lixar e pintar de azul marinho", "vou demorar de 3 a 5 dias",
 * "é o móvel do seu Abreu e da dona Isa".
 */

/** minúsculas e sem acento, caractere a caractere (o índice continua batendo com o texto original) */
function fold(text: string): string {
  let out = "";
  for (const ch of text.toLowerCase()) out += ch.normalize("NFD").replace(/[̀-ͯ]/g, "").charAt(0) || ch;
  return out;
}

const COLORS = [
  "off white", "off-white", "branco", "branca", "preto", "preta", "azul", "verde", "vermelho", "vermelha", "amarelo", "amarela",
  "cinza", "marrom", "bege", "rosa", "roxo", "roxa", "laranja", "dourado", "dourada", "prateado", "prateada", "creme", "gelo",
  "nude", "vinho", "mostarda", "terracota", "grafite", "tabaco", "imbuia", "mogno", "cerejeira", "nogueira", "carvalho", "marfim",
];
const MODIFIERS = ["marinho", "bebe", "claro", "clara", "escuro", "escura", "petroleo", "turquesa", "royal", "oliva", "musgo", "bandeira", "fosco", "fosca", "acetinado", "acetinada", "brilhante", "envelhecido", "envelhecida", "provencal"];
const COLOR_RE = new RegExp(`\\b(${COLORS.map((c) => c.replace("-", "[- ]")).join("|")})((?:\\s+(?:${MODIFIERS.join("|")}))*)\\b`, "g");

const NUM_WORDS: Record<string, number> = { um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10, quinze: 15, vinte: 20 };
const NUM = `(\\d+(?:[.,]\\d+)?|${Object.keys(NUM_WORDS).join("|")})`;
const UNIT = "(dias?|horas?|semanas?)";
/** só com verbo de duração do trabalho — "daqui a 15 dias" é prazo do cliente, não tempo de trabalho */
const DURATION_VERB = "(?:demor\\w*|lev\\w*|gast\\w*|faco em|fazer em|termino em|terminar em|trabalh\\w* uns|uns|umas|cerca de|mais ou menos)";
// fala real tem enchimento entre o verbo e a faixa: "vou demorar talvez uns 3, de 3 a 5 dias"
const RANGE_RE = new RegExp(`\\b${DURATION_VERB}\\b[^.?!]{0,30}?\\b${NUM}\\s+(?:a|ou|ate)\\s+${NUM}\\s+${UNIT}\\b`);
const SINGLE_RE = new RegExp(`\\b${DURATION_VERB}\\s+(?:de\\s+|uns\\s+|umas\\s+|tipo\\s+|talvez\\s+(?:uns\\s+)?)*${NUM}\\s+${UNIT}\\b`);

const n = (s: string): string => String(NUM_WORDS[s] ?? s.replace(",", "."));

export interface NoteContext {
  /** cliente já registrado no serviço (não vira "também citado") */
  clientName?: string | null;
}

export function extractNotes(text: string, ctx: NoteContext = {}): string[] {
  const out: string[] = [];
  const f = fold(text);

  // cor (pega o trecho do texto original, com acento)
  const colors = new Set<string>();
  for (const m of f.matchAll(COLOR_RE)) {
    // "rosa" e "laranja" também são nomes de gente/fruta: só com contexto de cor/pintura
    const word = m[1]!;
    const before = f.slice(Math.max(0, m.index! - 25), m.index!);
    if (["rosa", "laranja", "vinho", "creme", "carvalho", "nogueira"].includes(word) && !/\b(cor|de|tinta|pintar|pinta|em)\s*$/.test(before)) continue;
    colors.add(text.slice(m.index!, m.index! + m[0].length).trim().toLowerCase());
  }
  if (colors.size) out.push(`cor: ${[...colors].join(", ")}`);

  // quanto tempo ELE acha que leva (ouro para calibrar as horas)
  const range = RANGE_RE.exec(f);
  if (range) out.push(`tempo que ele estima: ${n(range[1]!)} a ${n(range[2]!)} ${range[3]!.replace(/s?$/, "s")}`);
  else {
    const single = SINGLE_RE.exec(f);
    if (single) {
      const qty = n(single[1]!);
      const unit = qty === "1" ? single[2]!.replace(/s$/, "") : single[2]!.replace(/s?$/, "s");
      out.push(`tempo que ele estima: ${qty} ${unit}`);
    }
  }

  // peça diferente das outras: "4 gavetas e 1 gavetão" (o total vai para a contagem; o detalhe, para cá)
  const bigDrawer = /\b(\d+|um|uma|dois|duas|tres)\s+(gavetao|gavetoes|gavetona|gavetonas)\b/.exec(f);
  if (bigDrawer) {
    const q = n(bigDrawer[1]!);
    out.push(`inclui ${q} ${q === "1" ? "gavetão" : "gavetões"}`);
  }

  // ferramenta ou etapa extra: "pincel e estilete pra raspar" (teste real 23/11/2026: o estilete se perdia)
  const tools: string[] = [];
  for (const m of f.matchAll(/\b(estilete|espatula|lixadeira|soprador termico|soprador|removedor|formao|grosa|palha de aco|escova de aco|esponja de aco)\b(?:\s+(?:pra|para|p\/)\s+([a-z]+))?/g)) {
    tools.push(text.slice(m.index!, m.index! + m[0].length).trim().toLowerCase());
  }
  if (!tools.length && /\b(raspar|raspagem|decapar|decapagem)\b/.test(f)) tools.push(/\bdecap/.test(f) ? "decapagem" : "raspagem");
  if (tools.length) out.push(`também vai usar: ${tools.join(", ")}`);

  // outro dono citado junto ("do seu Abreu e da dona Isa")
  const known = ctx.clientName ? fold(ctx.clientName).replace(/^(dona|seu|sr|sra|dr|dra)\.?\s+/, "") : null;
  const others = extractClientNames(text).filter((name) => {
    const k = fold(name).replace(/^(dona|seu|sr|sra|dr|dra)\.?\s+/, "");
    return !known || (!k.includes(known) && !known.includes(k));
  });
  if (known && others.length) out.push(`também citado: ${others.join(", ")}`);

  return out;
}

/** Junta observações novas às já guardadas, sem repetir (mesma chave "cor:", "tempo..." é substituída). */
export function mergeNotes(previous: string | null | undefined, added: string[]): string | null {
  const items = (previous ?? "").split(/\s*;\s*/).filter((s) => s && s !== "nenhum");
  for (const note of added) {
    const key = note.split(":")[0]!;
    const i = items.findIndex((x) => x.split(":")[0] === key);
    if (i < 0) items.push(note);
    else if (key === "também citado") {
      const names = new Set([...items[i]!.slice(key.length + 1).split(","), ...note.slice(key.length + 1).split(",")].map((s) => s.trim()).filter(Boolean));
      items[i] = `${key}: ${[...names].join(", ")}`;
    } else items[i] = note;
  }
  const merged = items.join("; ");
  return merged && merged !== (previous ?? "") ? merged : null;
}
