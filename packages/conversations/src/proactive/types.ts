/**
 * Coleta proativa: tipos puros (sem banco). O worker monta um retrato (snapshot)
 * do banco; os detectores daqui decidem o que vale a pena perguntar.
 */

export type NeedKind =
  | "material_price"
  | "material_package_size"
  | "stock_level"
  | "job_actual_hours"
  | "job_materials_used"
  | "technique_coats";

export const NEED_KINDS: readonly NeedKind[] = ["material_price", "material_package_size", "stock_level", "job_actual_hours", "job_materials_used", "technique_coats"];

export type NeedEntityType = "material" | "technique" | "job" | "quote";

export type NeedReason =
  | "quote_blocked"
  | "price_missing"
  | "price_demo"
  | "price_stale"
  | "package_size_invalid"
  | "stock_unknown"
  | "stock_stale"
  | "stock_negative"
  | "job_hours_missing"
  | "job_materials_missing"
  | "technique_uncalibrated";

/** Sinais usados na pontuação (todos explicáveis). */
export interface NeedSignals {
  blockedQuotes: number;
  upcomingJobs: number;
  usageCount: number;
  staleDays: number | null;
  negativeStock: boolean;
  recentlyMentioned: boolean;
  /** quantas vezes esta mesma pergunta já foi enviada */
  attempts: number;
  /** quantas vezes o artesão já disse "não sei" para este dado */
  dontKnowCount: number;
}

export interface NeedContext {
  /** nome amigável do assunto: "verniz", "lixa", "pátina" */
  subject: string;
  baseUnit?: string;
  packageSize?: string | null;
  priceCents?: number | null;
  jobTitle?: string;
  techniqueName?: string;
  /** material principal (trabalho concluído / técnica) */
  materialKey?: string;
  materialName?: string;
  materialUnit?: string;
  materialPackageSize?: string | null;
}

export interface Need {
  kind: NeedKind;
  reason: NeedReason;
  entityType: NeedEntityType;
  entityId: string;
  entityKey: string | null;
  /** rótulo para o painel: "Verniz", "Mesa da Dona Ana" */
  label: string;
  /** campos esperados (deterministicamente) */
  fields: string[];
  /** formato de resposta esperado (painel e interpretação) */
  expectedFormat: string;
  signals: NeedSignals;
  context: NeedContext;
  benefit: { jobId?: string; quoteId?: string; label?: string };
}

export interface MaterialSnap {
  id: string;
  key: string;
  name: string;
  baseUnit: string;
  packageSize: string;
  priceCents: number | null;
  priceUpdatedAt: string | null;
  origin: string;
  active: boolean;
  mutedUntil: string | null;
  stockCheckedAt: string | null;
  /** soma bruta dos movimentos (pode ser negativa); null = nenhum movimento */
  stockQty: string | null;
  minStock: string | null;
  /** quantas técnicas usam o material */
  recipeUses: number;
  /** serviços ativos (orçamento/aguardando/execução) cujas técnicas usam o material */
  activeJobUses: number;
  /** serviços aguardando início ou em execução que usam o material */
  upcomingJobUses: number;
  blockedQuotes: { quoteId: string; jobId: string; jobTitle: string }[];
  recentlyMentioned: boolean;
}

export interface JobSnap {
  id: string;
  title: string;
  status: string;
  completedAt: string | null;
  hasTimeEntries: boolean;
  hasConsumptions: boolean;
  mainMaterial: { key: string; name: string; unit: string; packageSize: string | null } | null;
}

export interface TechniqueSnap {
  id: string;
  key: string;
  name: string;
  calibrated: boolean;
  usedInJobs: number;
  coatingMaterial: { key: string; name: string } | null;
  /** já existe observação recente de demãos (não perguntar de novo) */
  recentObservation: boolean;
}

export interface Snapshot {
  now: Date;
  materials: MaterialSnap[];
  jobs: JobSnap[];
  techniques: TechniqueSnap[];
}

/** Chave de deduplicação: um pedido aberto por usuário + dado + entidade. */
export function needDedupeKey(userId: string, need: Pick<Need, "kind" | "entityType" | "entityId">): string {
  return `${userId}:${need.kind}:${need.entityType}:${need.entityId}`;
}
