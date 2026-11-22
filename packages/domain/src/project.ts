/**
 * Campos de um projeto (serviço) coletados na conversa. Cada campo é um "fato"
 * com proveniência e status de confirmação, armazenado em D1 (job_facts) e
 * resumido em jobs.facts_json. Campos desconhecidos permanecem "unknown",
 * nunca zero.
 */

export const PROJECT_FIELDS = [
  "furniture_type",
  "techniques",
  "client_name",
  "condition",
  "dimensions",
  "size_class",
  "surfaces",
  "details",
  "repairs",
  "subcontract",
  "logistics",
  "material_status",
  "application_method",
  "deadline",
  "payment_terms",
] as const;
export type ProjectField = (typeof PROJECT_FIELDS)[number];

/** Campos essenciais para calcular uma estimativa. */
export const ESSENTIAL_FIELDS: readonly ProjectField[] = ["furniture_type", "techniques", "client_name"];

/** Ordem das perguntas — uma de cada vez. */
export const QUESTION_ORDER: readonly ProjectField[] = [
  "furniture_type",
  "techniques",
  "client_name",
  "condition",
  "dimensions",
  "surfaces",
  "repairs",
  "subcontract",
  "material_status",
  "application_method",
  "logistics",
  "deadline",
  "payment_terms",
];

export type FactStatus = "confirmed" | "unconfirmed" | "unknown";

export interface Dimensions {
  /** metros, decimais em string */
  width?: string;
  height?: string;
  depth?: string;
}

export interface FactValueMap {
  furniture_type: { type: string; quantity?: number; doors?: number; drawers?: number; descriptors?: string[] };
  techniques: string[];
  client_name: string;
  condition: string;
  dimensions: Dimensions;
  size_class: "pequeno" | "medio" | "grande";
  surfaces: "externa" | "interna_externa";
  details: string;
  repairs: { needed: boolean; description?: string; hours?: string };
  subcontract: { needed: boolean; description?: string };
  logistics: { pickup: boolean; delivery: boolean };
  material_status: "tem_tudo" | "tem_parte" | "precisa_comprar";
  application_method: "pincel" | "rolo" | "pistola";
  deadline: string;
  payment_terms: string;
}

export interface Fact<F extends ProjectField = ProjectField> {
  field: F;
  value: FactValueMap[F] | null;
  status: FactStatus;
  source: "telegram_text" | "telegram_voice" | "telegram_photo" | "admin" | "system";
  updatedAt: string;
  messageId?: string;
}

export type FactSet = { [F in ProjectField]?: Fact<F> };

/** Resumo estruturado do projeto, usado para retomar contexto após dias/semanas. */
export interface ProjectSummary {
  headline: string;
  confirmed: string[];
  pending: ProjectField[];
  lastQuestion: ProjectField | null;
  lastInteractionAt: string | null;
  quoteStatus: string | null;
}

export function isFieldKnown(facts: FactSet, field: ProjectField): boolean {
  const f = facts[field];
  return !!f && f.status !== "unknown" && f.value !== null;
}

export function isFieldAnswered(facts: FactSet, field: ProjectField): boolean {
  // "não sei" conta como respondido (pendente), para não repetir a pergunta
  return !!facts[field];
}

export function nextQuestion(facts: FactSet, skip: readonly ProjectField[] = []): ProjectField | null {
  for (const field of QUESTION_ORDER) {
    if (skip.includes(field)) continue;
    if (field === "dimensions" && facts.size_class) continue;
    if (field === "application_method" && !techniquesNeedMethod(facts)) continue;
    if (!isFieldAnswered(facts, field)) return field;
  }
  return null;
}

function techniquesNeedMethod(facts: FactSet): boolean {
  const t = facts.techniques?.value as string[] | null | undefined;
  if (!t || t.length === 0) return true;
  return t.some((x) => x !== "enceramento");
}

export function missingEssentials(facts: FactSet): ProjectField[] {
  return ESSENTIAL_FIELDS.filter((f) => !isFieldKnown(facts, f));
}

/** Comparação de valores de fatos para detectar repetição x contradição. */
export function factValuesEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(normalizeForCompare(a)) === JSON.stringify(normalizeForCompare(b));
}

function normalizeForCompare(v: unknown): unknown {
  if (Array.isArray(v)) return [...v].map(normalizeForCompare).sort();
  if (v && typeof v === "object") {
    const o: Record<string, unknown> = {};
    for (const k of Object.keys(v as object).sort()) {
      const val = (v as Record<string, unknown>)[k];
      if (val !== undefined) o[k] = normalizeForCompare(val);
    }
    return o;
  }
  if (typeof v === "string") return v.trim().toLowerCase();
  return v;
}
