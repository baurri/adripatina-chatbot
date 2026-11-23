import type { NluResult } from "@adripatina/conversations";
import { GOAL_FLOWS, type Flow, type PendingQuestion } from "../repos/sessions.js";

/**
 * Política ÚNICA de prioridade contextual. Ordem:
 *  1. comando universal inequívoco
 *  2. confirmação/cancelamento esperado
 *  3. resposta à pergunta pendente
 *  4. continuação do objetivo ativo
 *  5. interrupção temporária claramente identificada
 *  6. intenção global
 *  7. fallback
 *
 * Uma resposta plausível à pergunta pendente vence intenções globais de média
 * confiança. Só interrupções com evidência forte (verbo de pagamento + valor,
 * andamento explícito, consultas inequívocas) suspendem o objetivo.
 */

export type Route = "universal" | "expected_confirmation" | "pending_answer" | "active_goal" | "interruption" | "global" | "fallback";

export interface RoutingInput {
  nlu: NluResult;
  flow: Flow;
  pendingQuestion: PendingQuestion | null;
  /** a mensagem é uma resposta plausível ao tipo da pergunta pendente */
  plausibleAnswer: boolean;
}

export interface RoutingDecision {
  route: Route;
  rawIntent: string;
  rawConfidence: number;
  contextualIntent: string;
  reason: string;
  activeGoal: Flow | null;
  pendingQuestion: string | null;
  confidence: number;
}

const UNIVERSAL = new Set(["menu", "greeting", "help", "cancel", "pause"]);
const CONFIRM_FLOWS: readonly Flow[] = ["confirm_match", "choose_match", "confirm_new_similar", "progress_confirm", "admin_confirm", "contradiction", "disambiguate", "resume_prompt"];
const SIDE_FLOWS: readonly Flow[] = ["expense", "payment", "learning_time", "data_collection"];

/** Interrupção só com sinal claro. */
export function isStrongInterruption(nlu: NluResult, pending: PendingQuestion | null): boolean {
  const e = nlu.entities;
  // intenção sugerida só pela IA nunca interrompe um fluxo (precisa de padrão literal no texto)
  if (nlu.source === "ai") return false;
  switch (nlu.intent) {
    case "register_payment":
      return e.amountCents !== undefined && nlu.confidence >= 0.85;
    case "register_expense":
      // durante a coleta de preço, "comprei por 90" é resposta, não uma nova compra
      // (vale também para a pergunta proativa de preço/embalagem: "comprei duas latas por 150" responde a ela)
      return e.amountCents !== undefined && nlu.confidence >= 0.85 && pending?.type !== "material_purchase_price" && pending?.type !== "material_package_size" && pending?.type !== "data_request";
    case "job_progress":
      // andamento exige evidência operacional explícita e nunca é só estado físico
      // "ainda não comecei" não muda nada: não interrompe o objetivo
      return !!e.progress && e.progress !== "nao_iniciado" && !(e.conditionStatement && (e.progress === "iniciado" || e.progress === "em_execucao") && pending?.type === "item_condition");
    case "list_jobs":
    case "agenda":
      return nlu.confidence >= 0.85;
    case "query_status":
      return nlu.confidence >= 0.8;
    default:
      return false;
  }
}

export function decideRoute(input: RoutingInput): RoutingDecision {
  const { nlu, flow, pendingQuestion } = input;
  const activeGoal = GOAL_FLOWS.includes(flow) ? flow : null;
  const base = {
    rawIntent: nlu.intent,
    rawConfidence: nlu.confidence,
    activeGoal,
    pendingQuestion: pendingQuestion?.type ?? null,
  };
  const decide = (route: Route, contextualIntent: string, reason: string, confidence = nlu.confidence): RoutingDecision => ({ ...base, route, contextualIntent, reason, confidence });

  // 1. universal (os padrões do intérprete são ancorados no início da frase)
  if (UNIVERSAL.has(nlu.intent) && nlu.confidence >= 0.9) return decide("universal", nlu.intent, "comando universal inequívoco");
  if (nlu.intent === "back" && nlu.confidence >= 0.9) return decide("universal", "back", "pedido explícito de voltar");

  // 2. confirmação esperada
  if (CONFIRM_FLOWS.includes(flow)) {
    if (["yes", "no", "dont_know"].includes(nlu.intent) || input.plausibleAnswer) return decide("expected_confirmation", `${flow}_answer`, "havia uma confirmação pendente");
  }

  const strong = isStrongInterruption(nlu, pendingQuestion);

  // 3. resposta à pergunta pendente
  if ((activeGoal || SIDE_FLOWS.includes(flow)) && input.plausibleAnswer && !strong) {
    return decide("pending_answer", pendingQuestion ? `${pendingQuestion.type}_answer` : "answer", "resposta plausível à pergunta pendente tem prioridade sobre intenção global", Math.max(nlu.confidence, 0.8));
  }
  if (SIDE_FLOWS.includes(flow) && !strong) return decide("active_goal", `${flow}_continue`, "fluxo lateral em andamento");

  // 5. interrupção clara durante um objetivo
  if (activeGoal && strong) return decide("interruption", nlu.intent, `interrupção com evidência forte (${nlu.intent}); objetivo ${activeGoal} será retomado`);

  // 4. continuação do objetivo
  if (activeGoal) return decide("active_goal", `${activeGoal}_continue`, nlu.intent === "unknown" ? "sem intenção clara: continuar objetivo ativo" : `intenção ${nlu.intent} sem evidência suficiente para interromper`);

  // 6. intenção global
  if (nlu.intent !== "unknown") return decide("global", nlu.intent, "sem objetivo ativo");
  return decide("fallback", "unknown", "nenhuma intenção reconhecida");
}
