import type { Ctx } from "../context.js";
import { getQuote, latestQuoteForJob, type QuoteRecord } from "./quotes.js";

/**
 * FONTE ÚNICA de "o que foi oferecido ao cliente" (27/11).
 *
 * Um PDF de grupo (várias peças) fica gravado em quote_documents só com o orçamento da PRIMEIRA peça; as
 * outras só aparecem no snapshot (quoteIds). Quem olhava só quote_documents.quote_id ou o último orçamento
 * da peça errava nas outras peças do grupo: o recálculo sobrescrevia o valor com desconto (aparador do
 * Seu Roberto), a peça não virava ENVIADO, sumia do "esperando resposta" e o bot respondia o valor de um
 * recálculo que nunca saiu. Tudo que precisa saber se um orçamento foi oferecido — e por quanto — passa
 * por aqui.
 */

/** Orçamentos que entraram num documento (o do registro + os do snapshot de grupo). */
function quoteIdsOf(snapshotJson: string, fallbackQuoteId: string): string[] {
  try {
    const s = JSON.parse(snapshotJson) as { quoteIds?: unknown; quoteId?: unknown };
    const ids = Array.isArray(s.quoteIds) ? s.quoteIds.filter((x): x is string => typeof x === "string") : [];
    return ids.length ? ids : [fallbackQuoteId];
  } catch {
    return [fallbackQuoteId];
  }
}

/** Este orçamento já saiu em algum PDF comercial (sozinho ou no grupo)? Um orçamento oferecido nunca é editado no lugar. */
export async function isQuoteIssued(ctx: Ctx, quoteId: string): Promise<boolean> {
  const direct = await ctx.db.first("SELECT 1 FROM quote_documents WHERE quote_id = ? LIMIT 1", quoteId);
  if (direct) return true;
  const grouped = await ctx.db.first("SELECT 1 FROM quote_snapshots WHERE snapshot_json LIKE ? LIMIT 1", `%"${quoteId}"%`);
  return !!grouped;
}

/** Todos os orçamentos de um documento (para mudar a situação de todas as peças do grupo juntas). */
export async function quotesInDocument(ctx: Ctx, documentId: string): Promise<string[]> {
  const r = await ctx.db.first<{ quote_id: string; snapshot_json: string }>(
    "SELECT d.quote_id, s.snapshot_json FROM quote_documents d JOIN quote_snapshots s ON s.id = d.snapshot_id WHERE d.id = ?",
    documentId,
  );
  return r ? quoteIdsOf(r.snapshot_json, r.quote_id) : [];
}

export type OfferState = "aguardando_resposta" | "aceito" | "recusado" | "expirado";

export interface Offer {
  quote: QuoteRecord;
  /** valor que o cliente recebeu (com desconto/acréscimo) */
  cents: number | null;
  number: string;
  documentId: string;
  issuedAt: string;
  preliminary: boolean;
  state: OfferState;
  /** recálculo feito depois do PDF e que NÃO foi mandado ao cliente (valor diferente) */
  unsentRecalcCents: number | null;
}

const STATE: Partial<Record<QuoteRecord["status"], OfferState>> = { ACEITO: "aceito", RECUSADO: "recusado", EXPIRADO: "expirado" };

/**
 * A proposta vigente da peça: o PDF comercial mais novo que inclui um orçamento dela ainda válido
 * (orçamento cancelado — substituído ou fechado por engano — não conta). O valor é o do orçamento
 * (fonte de verdade, inclusive depois de uma correção), não o de um recálculo posterior.
 */
export async function offerForJob(ctx: Ctx, jobId: string): Promise<Offer | null> {
  const docs = await ctx.db.all<{ id: string; quote_id: string; number: string; created_at: string; preliminary: number; snapshot_json: string }>(
    `SELECT d.id, d.quote_id, d.number, d.created_at, d.preliminary, s.snapshot_json FROM quote_documents d JOIN quote_snapshots s ON s.id = d.snapshot_id
     WHERE d.kind = 'COMERCIAL' AND EXISTS (SELECT 1 FROM quotes q WHERE q.job_id = ? AND (q.id = d.quote_id OR s.snapshot_json LIKE '%"' || q.id || '"%'))
     ORDER BY d.created_at DESC LIMIT 10`,
    jobId,
  );
  for (const d of docs) {
    for (const qid of quoteIdsOf(d.snapshot_json, d.quote_id)) {
      const q = await getQuote(ctx, qid);
      if (!q || q.jobId !== jobId || q.status === "CANCELADO") continue;
      const cents = q.finalPriceCents ?? q.recommendedCents;
      const latest = await latestQuoteForJob(ctx, jobId);
      const recalc = latest && latest.id !== q.id && latest.version > q.version && ["ESTIMATIVA", "RASCUNHO", "AGUARDANDO_REVISAO"].includes(latest.status) ? (latest.finalPriceCents ?? latest.recommendedCents) : null;
      return {
        quote: q,
        cents,
        number: d.number,
        documentId: d.id,
        issuedAt: d.created_at,
        preliminary: d.preliminary === 1,
        state: STATE[q.status] ?? "aguardando_resposta",
        unsentRecalcCents: recalc !== null && recalc !== cents ? recalc : null,
      };
    }
  }
  return null;
}
