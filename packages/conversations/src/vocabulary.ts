import { normalizeText } from "@adripatina/shared";

/** Vocabulário de móveis: forma canônica → variações (sem acento, minúsculas). */
export const FURNITURE: Record<string, { label: string; feminine: boolean; variants: string[] }> = {
  cristaleira: { label: "cristaleira", feminine: true, variants: ["cristaleira", "cristaleiras", "cristaleirinha"] },
  guarda_roupa: { label: "guarda-roupa", feminine: false, variants: ["guarda-roupa", "guarda roupa", "guardaroupa", "guarda-roupas", "roupeiro"] },
  comoda: { label: "cômoda", feminine: true, variants: ["comoda", "comodas", "comodinha"] },
  mesa_cabeceira: { label: "criado-mudo", feminine: false, variants: ["criado-mudo", "criado mudo", "mesa de cabeceira", "mesinha de cabeceira"] },
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
};

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

export function findFurniture(text: string): string | undefined {
  const norm = normalizeText(text);
  // variantes mais longas primeiro (ex.: "mesa de cabeceira" antes de "mesa")
  const entries = Object.entries(FURNITURE).flatMap(([key, v]) => v.variants.map((variant) => ({ key, variant })));
  entries.sort((a, b) => b.variant.length - a.variant.length);
  for (const { key, variant } of entries) if (containsPhrase(norm, variant)) return key;
  return undefined;
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
