/**
 * Entrada do PDF COMERCIAL. Por construção, este tipo NÃO possui campos de
 * custo interno, hora técnica, margem, risco, fornecedor ou estoque.
 */
export interface CommercialQuoteDoc {
  number: string; // AP-AAAA-NNNN
  version: number;
  issuedAt: string; // ISO
  validUntil: string; // ISO
  preliminary: boolean;
  business: BusinessIdentity;
  client: { name: string };
  furniture: { description: string };
  scope: string[];
  finishes: string[];
  /** detalhamento comercial opcional (categorias) — soma deve ser igual ao total */
  lines: { label: string; amountCents: number }[];
  totalCents: number;
  deadlineText: string;
  paymentTerms: string;
  depositCents: number | null;
  exclusions: string[];
  notes: string[];
  photos: { bytes: Uint8Array; mime: "image/jpeg" | "image/png" }[];
  showAcceptance: boolean;
  /** orçamento de várias peças do mesmo cliente: uma seção por peça (com o valor dela) e o total no fim */
  items?: { title: string; description: string; scope: string[]; finishes: string[]; amountCents: number }[];
}

/** Dados comerciais — exibidos SOMENTE quando fornecidos (nunca inventados). */
export interface BusinessIdentity {
  name: string; // "adripatina"
  tagline?: string | null;
  phone?: string | null;
  email?: string | null;
  instagram?: string | null;
  city?: string | null;
  document?: string | null; // CPF/CNPJ apenas se o admin cadastrar
  primaryColor?: string | null; // hex
  accentColor?: string | null;
  logo?: { bytes: Uint8Array; mime: "image/jpeg" | "image/png" } | null;
}

/** Documento interno — somente ADMIN. */
export interface InternalQuoteDoc {
  number: string;
  version: number;
  generatedAt: string;
  title: string;
  sections: { heading: string; rows: [string, string][] }[];
}

export interface RenderedPdf {
  bytes: Uint8Array;
  /** todo texto desenhado, para auditoria e testes de privacidade */
  renderedText: string[];
  pageCount: number;
}
