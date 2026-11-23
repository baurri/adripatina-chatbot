import type { Dimensions } from "@adripatina/domain";
import { Dec, extractCount, extractLengths, normalizeText, wordsToNumber } from "@adripatina/shared";
import type { FurnitureTypeDef, MeasurementSchema, QuoteFieldKey } from "./types.js";

/**
 * Respostas guiadas pelo catálogo: medidas na ordem certa para cada tipo de móvel e
 * perguntas específicas (portas, gavetas, estofado, exposição ao tempo...).
 * Tudo determinístico; a IA só complementa escolhendo entre as MESMAS opções.
 */

// ------------------------------------------------------------------ medidas

export type DimensionAnswer =
  | { kind: "dims"; dims: Dimensions }
  | { kind: "standard" }
  | { kind: "dont_know" }
  | { kind: "none" };

const STANDARD = /\b(e o padrao|tamanho padrao|padrao mesmo|medida padrao|e padrao|normal mesmo|tamanho normal|e desse tamanho|desse tamanho mesmo|e isso mesmo|isso mesmo)\b/;
const DONT_KNOW = /\b(nao sei|nao tenho|nao medi|nao lembro|sei la|nao faco ideia|sem medida|nao tenho as medidas|nao (tenho|tem|da) como medir|nao da pra medir|sem medir)\b/;
const MEASURED = /\b(medi|medido|medida certinha|trena|fita metrica|exat[oa]s?)\b/;
const APPROX = /\b(mais ou menos|uns|umas|aproximad\w*|acho|por volta|cerca de|deve ter)\b/;

type Label = "width" | "depth" | "height" | "diameter" | "length" | "side";
const LABELS: [RegExp, Label][] = [
  [/\b(diametro)\b/, "diameter"],
  [/\b(largura|de largo|largo)\b/, "width"],
  [/\b(comprimento|de comprido|comprid[oa])\b/, "length"],
  [/\b(altura|de alto|alt[oa])\b/, "height"],
  [/\b(profundidade|fundura|de fundo|fundo)\b/, "depth"],
  [/\b(lado|cada lado)\b/, "side"],
];

interface Num {
  meters: Dec;
  start: number;
  end: number;
}

/** Números de medida em ordem: "1,60", "160 cm", "2 metros", "um metro e sessenta". Sem unidade: > 10 = cm. */
function numbersIn(norm: string): Num[] {
  const out: Num[] = [];
  const re = /(\d+(?:[.,]\d+)?)\s*(centimetros?|cm|metros?|m)?\b(?!\s*(lugares?|portas?|gavetas?|reais|real|pessoas|cadeiras|modulos?|folhas?|anos?|%))/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(norm))) {
    const v = Dec.tryParse(m[1]!.replace(",", "."));
    if (!v || !v.gt(0)) continue;
    const unit = m[2] ?? "";
    const meters = unit.startsWith("c") ? v.div(100) : unit.startsWith("m") ? v : v.gt(10) ? v.div(100) : v;
    if (meters.gt(15)) continue;
    out.push({ meters, start: m.index, end: m.index + m[0].length });
  }
  if (!out.length) {
    for (const l of extractLengths(norm)) {
      const at = norm.indexOf(l.raw);
      out.push({ meters: l.meters, start: at, end: at + l.raw.length });
    }
    out.sort((a, b) => a.start - b.start);
  }
  return out;
}

function labelFor(norm: string, n: Num, next: Num | undefined, prev: Num | undefined): Label | null {
  const after = norm.slice(n.end, next ? next.start : Math.min(norm.length, n.end + 24));
  for (const [re, l] of LABELS) if (re.test(after.slice(0, 24))) return l;
  const before = norm.slice(prev ? prev.end : Math.max(0, n.start - 24), n.start);
  for (const [re, l] of LABELS) if (re.test(before.slice(-24))) return l;
  return null;
}

/** Ordem posicional quando não há rótulo, por esquema de medida. */
const POSITIONAL: Partial<Record<MeasurementSchema, (keyof Dimensions)[]>> = {
  width_length: ["width", "depth"],
  length_width_height: ["width", "depth", "height"],
  diameter_height: ["diameter", "height"],
  side_height: ["width", "height"],
  width_height: ["width", "height"],
  length_depth_thickness: ["width", "depth", "height"],
  two_sides_depth: ["width", "depth", "height"],
  open_closed: ["width", "depth", "height"],
  width_depth_height: ["width", "depth", "height"],
};

/** Esquemas em que a resposta posicional segue o catálogo (caixas mantêm a convenção antiga altura×largura×fundura). */
export function usesCatalogDimensionOrder(schema: MeasurementSchema): boolean {
  return schema !== "width_depth_height" && schema !== "per_module" && schema !== "unknown";
}

export function parseCatalogDimensions(text: string, schema: MeasurementSchema, kind: Dimensions["kind"] = "external"): DimensionAnswer {
  const norm = normalizeText(text).replace(/\s+/g, " ");
  const nums = numbersIn(norm);
  if (!nums.length) {
    if (STANDARD.test(norm)) return { kind: "standard" };
    if (DONT_KNOW.test(norm)) return { kind: "dont_know" };
    return { kind: "none" };
  }
  const dims: Dimensions = {};
  const order = POSITIONAL[schema] ?? ["width", "depth", "height"];
  let pos = 0;
  nums.forEach((n, i) => {
    const label = labelFor(norm, n, nums[i + 1], nums[i - 1]);
    const v = n.meters.round(3).toString();
    if (label === "length") {
      // mesas: comprimento é o lado maior (width); camas: comprimento vai em depth
      if (schema === "width_length") dims.depth = v;
      else dims.width = v;
    } else if (label === "side") {
      dims.width = v;
      if (schema === "side_height") dims.depth = v;
    } else if (label === "width" && (schema === "length_width_height" || schema === "open_closed" || schema === "length_depth_thickness")) dims.depth = v; // mesa: largura é o lado menor
    else if (label) dims[label] = v;
    else {
      while (pos < order.length && dims[order[pos]!] !== undefined) pos++;
      const slot = order[pos];
      if (slot) {
        (dims as Record<string, string>)[slot] = v;
        pos++;
      }
    }
  });
  if (schema === "side_height" && dims.width && !dims.depth) dims.depth = dims.width;
  dims.source = MEASURED.test(norm) ? "measured" : "customer_informed";
  dims.kind = kind;
  dims.confidence = APPROX.test(norm) ? "media" : "alta";
  return { kind: "dims", dims };
}

// ------------------------------------------------------------------ perguntas específicas

export type AttributeKey = Extract<
  QuoteFieldKey,
  "doors_count" | "drawers_count" | "door_type" | "upholstery_scope" | "exposure" | "shape" | "seats_count" | "extension" | "modules" | "mirror_glass" | "top_material" | "wall_mounted" | "work_scope"
>;

export type AttributeValue = string | number | boolean | { width?: string; depth?: string; height?: string };

export interface AttributeSpec {
  key: AttributeKey;
  /** pergunta-base (determinística); a IA pode só reescrever mantendo o sentido */
  question: (t: FurnitureTypeDef) => string;
  /** opções fechadas (para a IA escolher entre elas quando as regras não entenderem) */
  options?: string[];
  parse: (text: string, t: FurnitureTypeDef) => AttributeValue | null;
  /** por que perguntar (explicação curta, se ele perguntar "pra quê?") */
  why: string;
}

const count = (re: RegExp) => (text: string): number | null => {
  const n = extractCount(text, re);
  if (n !== null && n > 0 && n < 60) return n;
  const norm = normalizeText(text);
  const bare = /^\s*(\d{1,2})\s*$/.exec(norm)?.[1];
  if (bare) return Number(bare);
  const w = wordsToNumber(norm.split(" ").filter(Boolean).slice(0, 2));
  return w !== null && w > 0 && w < 60 ? w : null;
};

const art = (t: FurnitureTypeDef) => (t.feminine ? "ela" : "ele");
const name = (t: FurnitureTypeDef) => t.name.toLowerCase().replace(/ de \d+ lugares$/, "");

export const ATTRIBUTES: Record<AttributeKey, AttributeSpec> = {
  doors_count: {
    key: "doors_count",
    question: (t) => `Quantas portas ${art(t)} tem?`,
    parse: (x) => count(/^portas?$/)(x),
    why: "Cada porta tem frente e verso para lixar e pintar, então muda o tempo de trabalho.",
  },
  drawers_count: {
    key: "drawers_count",
    question: (t) => `Quantas gavetas ${art(t)} tem?`,
    parse: (x) => count(/^gavetas?$/)(x),
    why: "Gaveta dá trabalho extra (frente, laterais e corrediça).",
  },
  door_type: {
    key: "door_type",
    question: () => "As portas são de abrir ou de correr?",
    options: ["abrir", "correr", "misto"],
    parse: (x) => {
      const n = normalizeText(x);
      const a = /\b(abrir|abre|dobradica)\b/.test(n);
      const c = /\b(correr|corre|trilho)\b/.test(n);
      return a && c ? "misto" : a ? "abrir" : c ? "correr" : null;
    },
    why: "Porta de correr tem trilho e ferragem diferentes.",
  },
  upholstery_scope: {
    key: "upholstery_scope",
    question: (t) => `O serviço ${t.feminine ? "nela" : "nele"} é só na madeira, só no estofado ou nos dois?`,
    options: ["madeira", "estofado", "completo"],
    parse: (x) => {
      const n = normalizeText(x);
      if (/\b(os dois|ambos|tudo|completo|completa|madeira e (o )?estofado|estofado e (a )?madeira)\b/.test(n)) return "completo";
      if (/\b(so (na |a )?madeira|madeira so|so a parte de madeira|so madeira|madeira)\b/.test(n) && !/estof|tecido/.test(n)) return "madeira";
      if (/\b(estofado|estofamento|tecido|tapecaria|assento novo)\b/.test(n)) return "estofado";
      return null;
    },
    why: "Madeira fica com você; estofado normalmente vai para o tapeceiro.",
  },
  exposure: {
    key: "exposure",
    question: (t) => `${art(t) === "ela" ? "Ela" : "Ele"} fica no sol ou na chuva, ou numa área coberta?`,
    options: ["coberta", "sol", "chuva", "sol_e_chuva", "interna"],
    parse: (x) => {
      const n = normalizeText(x);
      const sol = /\b(sol)\b/.test(n);
      const chuva = /\b(chuva|molha|sereno|tempo)\b/.test(n);
      if (/\b(coberta|coberto|varanda fechada|debaixo de telhado|na sombra)\b/.test(n) && !chuva) return "coberta";
      if (/\b(dentro de casa|interna|dentro)\b/.test(n)) return "interna";
      if (sol && chuva) return "sol_e_chuva";
      if (sol) return "sol";
      if (chuva) return "chuva";
      return null;
    },
    why: "Peça exposta ao tempo precisa de acabamento próprio para área externa.",
  },
  shape: {
    key: "shape",
    question: (t) => `Qual é o formato d${t.feminine ? "ela" : "ele"}: retangular, redondo, quadrado ou oval?`,
    options: ["retangular", "redonda", "quadrada", "oval", "organica"],
    parse: (x) => {
      const n = normalizeText(x);
      if (/\bredond/.test(n) || /\bcircular/.test(n)) return "redonda";
      if (/\bquadrad/.test(n)) return "quadrada";
      if (/\boval/.test(n)) return "oval";
      if (/\bretangul|\bcomprid/.test(n)) return "retangular";
      if (/\borganic|\birregular/.test(n)) return "organica";
      return null;
    },
    why: "O formato muda como eu calculo a área do tampo.",
  },
  seats_count: {
    key: "seats_count",
    question: () => "São quantos lugares?",
    parse: (x) => count(/^lugares?$/)(x),
    why: "Ajuda a estimar o tamanho quando não tem a medida.",
  },
  extension: {
    key: "extension",
    question: (t) => `E aberta, com a extensão, ${art(t)} fica com quanto de comprimento? 📏`,
    parse: (x) => {
      const r = parseCatalogDimensions(x, "length_width_height", "open");
      return r.kind === "dims" ? { width: r.dims.width, depth: r.dims.depth, height: r.dims.height } : null;
    },
    why: "A extensão também recebe acabamento.",
  },
  modules: {
    key: "modules",
    question: () => "São quantos módulos ou partes separadas?",
    parse: (x) => count(/^(modulos?|partes?|pecas?)$/)(x),
    why: "Cada módulo é trabalhado separadamente.",
  },
  mirror_glass: {
    key: "mirror_glass",
    question: () => "Tem espelho ou vidro nela?",
    options: ["sim", "nao"],
    parse: (x) => {
      const n = normalizeText(x);
      if (/\b(nao|sem|nenhum)\b/.test(n)) return false;
      if (/\b(sim|tem|espelho|vidro)\b/.test(n)) return true;
      return null;
    },
    why: "Vidro e espelho precisam ser protegidos ou retirados.",
  },
  top_material: {
    key: "top_material",
    question: () => "O tampo é de madeira, pedra ou outro material?",
    options: ["madeira", "pedra", "vidro", "formica", "outro"],
    parse: (x) => {
      const n = normalizeText(x);
      if (/\b(pedra|granito|marmore|quartzo)\b/.test(n)) return "pedra";
      if (/\bvidro\b/.test(n)) return "vidro";
      if (/\b(formica|laminado)\b/.test(n)) return "formica";
      if (/\bmadeira\b/.test(n)) return "madeira";
      return null;
    },
    why: "Tampo de pedra ou vidro não recebe o mesmo acabamento.",
  },
  wall_mounted: {
    key: "wall_mounted",
    question: (t) => `${art(t) === "ela" ? "Ela" : "Ele"} está fixad${t.feminine ? "a" : "o"} na parede?`,
    options: ["sim", "nao"],
    parse: (x) => {
      const n = normalizeText(x);
      if (/\b(nao|solt[oa]|no chao|apoiad[oa])\b/.test(n)) return false;
      if (/\b(sim|fixad[oa]|parafusad[oa]|na parede|preso|presa)\b/.test(n)) return true;
      return null;
    },
    why: "Peça presa na parede pode precisar ser trabalhada no local.",
  },
  work_scope: {
    key: "work_scope",
    question: (t) =>
      t.legacyKey === "cama" && t.key !== "cabeceira"
        ? "Você vai trabalhar só na cabeceira ou na cama inteira?"
        : `Você vai trabalhar só no tampo ou n${t.feminine ? "a" : "o"} ${name(t)} inteir${t.feminine ? "a" : "o"}?`,
    options: ["tampo", "cabeceira", "inteiro"],
    parse: (x, t) => {
      const n = normalizeText(x);
      if (/\b(inteir[oa]|tod[oa]|completa|completo|tudo)\b/.test(n)) return "inteiro";
      if (t.legacyKey === "cama" && /\bcabeceira\b/.test(n)) return "cabeceira";
      if (/\btampo\b/.test(n)) return "tampo";
      return null;
    },
    why: "Trabalhar só uma parte muda bastante a área e o valor.",
  },
};

/** Campos do catálogo perguntados por este módulo (os demais já existem no fluxo comum). */
/** Detalhes que mudam o cálculo e por isso são perguntados na conversa; os demais ficam como campos opcionais. */
export const ASKED_ATTRIBUTES: readonly AttributeKey[] = ["work_scope", "doors_count", "door_type", "drawers_count", "upholstery_scope", "exposure", "extension"];

export function catalogAttributesFor(t: FurnitureTypeDef): AttributeKey[] {
  const wanted = t.requiredQuoteFields.filter((k): k is AttributeKey => k in ATTRIBUTES && ASKED_ATTRIBUTES.includes(k as AttributeKey));
  // escopo só faz sentido onde existe "parte" (mesas com tampo, camas com cabeceira)
  return wanted.filter((k) => k !== "work_scope" || t.legacyKey === "mesa" || (t.legacyKey === "cama" && t.key !== "cabeceira"));
}

/** Pergunta de medida na ordem certa para o tipo (com unidade e "pode ser aproximado"). */
export function dimensionQuestion(t: FurnitureTypeDef, opts: { presetHint?: string; mattressOnly?: boolean } = {}): string {
  const hint = opts.presetHint ? `\n\n${opts.presetHint}` : "";
  switch (t.measurementSchema) {
    case "width_length":
      return `Você consegue me passar a largura e o comprimento da estrutura, por fora? 📏\n\nPode ser aproximado, em centímetros ou metros.${hint}`;
    case "length_width_height":
      return t.legacyKey === "mesa" || t.legacyKey === "escrivaninha"
        ? `Qual é o comprimento e a largura do tampo? 📏\n\nPode me passar em centímetros, mais ou menos.${hint}`
        : `Quanto ${t.feminine ? "ela" : "ele"} mede de comprimento, largura e altura? 📏\n\nPode me passar em centímetros, mais ou menos.${hint}`;
    case "diameter_height":
      return `Quanto mede o diâmetro do tampo, de uma ponta à outra? 📏\n\nPode ser aproximado.${hint}`;
    case "side_height":
      return `Quanto mede cada lado do tampo? 📏\n\nPode ser aproximado.${hint}`;
    case "width_height":
      return `Qual é a largura e a altura? 📏\n\nPode ser aproximado.${hint}`;
    case "length_depth_thickness":
      return `Quanto mede de comprimento e de profundidade? 📏\n\nPode ser aproximado.${hint}`;
    case "two_sides_depth":
      return `Quanto mede cada um dos dois lados, e a profundidade? 📏\n\nPode ser aproximado.${hint}`;
    case "open_closed":
      return `Fechad${t.feminine ? "a" : "o"}, quanto mede de comprimento e de largura? 📏\n\nPode ser aproximado.${hint}`;
    default:
      return `Qual é o tamanho d${t.feminine ? "ela" : "ele"}? 📏\n\nSe tiver as medidas, pode falar assim: "1,80 de altura, 1 metro de largura e 40 de fundura". Se não, pequeno, médio ou grande já serve.${hint}`;
  }
}
