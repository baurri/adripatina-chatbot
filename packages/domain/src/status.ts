/**
 * Ciclo de vida separado em três eixos para evitar estados impossíveis:
 *  - QuoteStatus: o orçamento (proposta)
 *  - JobStatus: a ordem de serviço (execução física)
 *  - FinancialStatus: situação de recebimento
 *
 * A sequência da especificação (RASCUNHO → ... → QUITADO) é a composição dos três.
 */

export const QUOTE_STATUSES = [
  "RASCUNHO",
  "ESTIMATIVA",
  "AGUARDANDO_REVISAO",
  "APROVADO",
  "ENVIADO",
  "ACEITO",
  "RECUSADO",
  "CANCELADO",
  "EXPIRADO",
] as const;
export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

export const JOB_STATUSES = [
  "ORCAMENTO", // projeto em levantamento/orçamento
  "AGUARDANDO_INICIO", // orçamento aceito, aguardando início
  "EM_EXECUCAO",
  "CONCLUIDO",
  "ENTREGUE",
  "CANCELADO",
  "MESCLADO", // projeto absorvido por outro (deduplicação)
] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export const FINANCIAL_STATUSES = ["SEM_COBRANCA", "EM_ABERTO", "PARCIAL", "QUITADO"] as const;
export type FinancialStatus = (typeof FINANCIAL_STATUSES)[number];

const QUOTE_TRANSITIONS: Record<QuoteStatus, readonly QuoteStatus[]> = {
  RASCUNHO: ["ESTIMATIVA", "CANCELADO"],
  ESTIMATIVA: ["RASCUNHO", "AGUARDANDO_REVISAO", "APROVADO", "CANCELADO"],
  AGUARDANDO_REVISAO: ["APROVADO", "RASCUNHO", "CANCELADO"],
  APROVADO: ["ENVIADO", "RASCUNHO", "CANCELADO", "EXPIRADO"],
  ENVIADO: ["ACEITO", "RECUSADO", "EXPIRADO", "CANCELADO", "RASCUNHO"],
  ACEITO: ["CANCELADO"],
  RECUSADO: ["RASCUNHO"],
  CANCELADO: [],
  EXPIRADO: ["RASCUNHO"],
};

const JOB_TRANSITIONS: Record<JobStatus, readonly JobStatus[]> = {
  ORCAMENTO: ["AGUARDANDO_INICIO", "EM_EXECUCAO", "CANCELADO", "MESCLADO"],
  AGUARDANDO_INICIO: ["EM_EXECUCAO", "CANCELADO", "ORCAMENTO", "MESCLADO"],
  EM_EXECUCAO: ["CONCLUIDO", "CANCELADO", "MESCLADO"],
  CONCLUIDO: ["ENTREGUE", "EM_EXECUCAO"],
  ENTREGUE: [],
  CANCELADO: ["ORCAMENTO"],
  MESCLADO: ["ORCAMENTO", "AGUARDANDO_INICIO", "EM_EXECUCAO", "CONCLUIDO", "ENTREGUE", "CANCELADO"], // desfazer mesclagem
};

export class TransitionError extends Error {
  constructor(
    readonly entity: string,
    readonly from: string,
    readonly to: string,
  ) {
    super(`Transição inválida de ${entity}: ${from} → ${to}`);
    this.name = "TransitionError";
  }
}

export function canTransitionQuote(from: QuoteStatus, to: QuoteStatus): boolean {
  return QUOTE_TRANSITIONS[from].includes(to);
}

export function assertQuoteTransition(from: QuoteStatus, to: QuoteStatus): void {
  if (!canTransitionQuote(from, to)) throw new TransitionError("orçamento", from, to);
}

export function canTransitionJob(from: JobStatus, to: JobStatus): boolean {
  return JOB_TRANSITIONS[from].includes(to);
}

export function assertJobTransition(from: JobStatus, to: JobStatus): void {
  if (!canTransitionJob(from, to)) throw new TransitionError("serviço", from, to);
}

/** Situação financeira derivada de valores (nunca armazenada sem recálculo). */
export function deriveFinancialStatus(contractedCents: number | null, paidCents: number): FinancialStatus {
  if (contractedCents === null || contractedCents <= 0) return "SEM_COBRANCA";
  if (paidCents <= 0) return "EM_ABERTO";
  if (paidCents >= contractedCents) return "QUITADO";
  return "PARCIAL";
}

export const QUOTE_STATUS_LABEL: Record<QuoteStatus, string> = {
  RASCUNHO: "Rascunho",
  ESTIMATIVA: "Estimativa",
  AGUARDANDO_REVISAO: "Aguardando revisão",
  APROVADO: "Aprovado",
  ENVIADO: "Enviado",
  ACEITO: "Aceito",
  RECUSADO: "Recusado",
  CANCELADO: "Cancelado",
  EXPIRADO: "Expirado",
};

export const JOB_STATUS_LABEL: Record<JobStatus, string> = {
  ORCAMENTO: "Em orçamento",
  AGUARDANDO_INICIO: "Aguardando início",
  EM_EXECUCAO: "Em execução",
  CONCLUIDO: "Concluído",
  ENTREGUE: "Entregue",
  CANCELADO: "Cancelado",
  MESCLADO: "Mesclado",
};

export const ACTIVE_JOB_STATUSES: readonly JobStatus[] = ["ORCAMENTO", "AGUARDANDO_INICIO", "EM_EXECUCAO", "CONCLUIDO"];
