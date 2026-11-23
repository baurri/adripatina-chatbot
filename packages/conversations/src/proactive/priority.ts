import type { Need, NeedKind } from "./types.js";

/**
 * Pontuação explicável: cada ponto vem com um motivo em português, gravado na
 * solicitação para o painel. Ordem pretendida:
 * orçamento pedido agora > serviço próximo > material frequente > estoque > calibração > resto.
 */

export interface Score {
  score: number;
  reasons: string[];
}

const BASE: Record<NeedKind, number> = {
  material_price: 30,
  material_package_size: 28,
  job_actual_hours: 22,
  stock_level: 12,
  job_materials_used: 12,
  technique_coats: 8,
};

const BASE_LABEL: Record<NeedKind, string> = {
  material_price: "Preço de material entra direto no orçamento",
  material_package_size: "Sem o tamanho da embalagem o preço não pode ser usado",
  job_actual_hours: "Tempo real de um trabalho concluído calibra os próximos orçamentos",
  stock_level: "Estoque conhecido evita compra desnecessária",
  job_materials_used: "Consumo real calibra o rendimento dos materiais",
  technique_coats: "Número de demãos calibra a técnica",
};

export function scoreNeed(need: Need): Score {
  const s = need.signals;
  const reasons: string[] = [];
  let score = BASE[need.kind];
  reasons.push(`${BASE_LABEL[need.kind]} (+${score})`);
  const add = (pts: number, why: string) => {
    if (!pts) return;
    score += pts;
    reasons.push(`${why} (${pts > 0 ? "+" : ""}${pts})`);
  };
  if (s.blockedQuotes > 0) add(60, `Orçamento em andamento travado por esse dado${s.blockedQuotes > 1 ? ` (${s.blockedQuotes} orçamentos)` : ""}`);
  if (s.upcomingJobs > 0) add(Math.min(35, 25 + s.upcomingJobs * 5), "Serviço próximo depende dessa informação");
  if (s.usageCount > 0) add(Math.min(20, s.usageCount * 4), `Usado com frequência (${s.usageCount} usos)`);
  switch (need.reason) {
    case "price_missing":
      add(20, "Ainda não há preço real cadastrado");
      break;
    case "price_demo":
      add(15, "Preço atual é só de demonstração");
      break;
    case "price_stale":
      add(Math.min(20, 10 + Math.floor(((s.staleDays ?? 0) - 90) / 30) * 2), `Preço sem atualização há ${s.staleDays ?? "muitos"} dias`);
      break;
    case "stock_negative":
      add(15, "Estoque calculado ficou negativo (inconsistente)");
      break;
    case "stock_unknown":
      add(5, "Estoque nunca foi conferido");
      break;
    case "stock_stale":
      add(Math.min(10, 4 + Math.floor((s.staleDays ?? 0) / 30) * 2), `Estoque conferido há ${s.staleDays ?? "muitos"} dias`);
      break;
    case "job_hours_missing":
    case "job_materials_missing":
      // quanto mais recente, mais fácil lembrar
      add((s.staleDays ?? 30) <= 7 ? 8 : 0, "Trabalho concluído recentemente (fácil de lembrar)");
      break;
    default:
      break;
  }
  if (s.recentlyMentioned) add(5, "Assunto mencionado recentemente na conversa");
  if (s.attempts > 0) add(-10 * s.attempts, `Já perguntado ${s.attempts} ${s.attempts === 1 ? "vez" : "vezes"}`);
  if (s.dontKnowCount > 0) add(-15 * s.dontKnowCount, "Adriano já disse que não sabia");
  return { score: Math.max(0, score), reasons };
}

export interface RankedNeed {
  need: Need;
  score: Score;
}

/** Ordena por pontuação (desempate estável pelo tipo e rótulo) e corta pelo mínimo. */
export function rankNeeds(needs: Need[], minScore: number): RankedNeed[] {
  return needs
    .map((need) => ({ need, score: scoreNeed(need) }))
    .filter((r) => r.score.score >= minScore)
    .sort((a, b) => b.score.score - a.score.score || BASE[b.need.kind] - BASE[a.need.kind] || a.need.label.localeCompare(b.need.label));
}
