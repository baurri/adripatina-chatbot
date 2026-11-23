import { z } from "zod";

/**
 * Interpretação estruturada de um turno pela LLM (sugestão, nunca ação).
 * O código valida tipos, listas fechadas e estado antes de qualquer gravação:
 * a IA não define dinheiro, não cria cliente, não transforma estimativa em medida real.
 */

export const PRIMARY_GOALS = ["create_quote", "continue_quote", "register_expense", "register_payment", "update_progress", "ask_question", "small_talk", "correction", "other"] as const;
export const CONTEXTUAL_INTENTS = ["answer_pending_question", "add_information", "change_subject", "ask_bot", "correction", "confirm", "deny", "unclear"] as const;

export const TurnInterpretationSchema = z.object({
  primaryGoal: z.enum(PRIMARY_GOALS),
  contextualIntent: z.enum(CONTEXTUAL_INTENTS),
  /** responde à pergunta pendente? */
  answersPending: z.boolean(),
  entities: z
    .object({
      clients: z.array(z.string().max(60)).max(6).default([]),
      furnitureItems: z
        .array(z.object({ text: z.string().max(80), candidateKey: z.string().max(60).nullable().default(null), quantity: z.number().int().min(1).max(50).nullable().default(null) }))
        .max(10)
        .default([]),
      services: z.array(z.string().max(40)).max(8).default([]),
      /** condição FÍSICA da peça (nunca andamento do serviço) */
      physicalCondition: z.array(z.string().max(60)).max(8).default([]),
    })
    .default({}),
  ambiguities: z.array(z.string().max(160)).max(6).default([]),
  nextQuestion: z.object({ purpose: z.string().max(80), expectedAnswerType: z.string().max(60) }).nullable().default(null),
  confidence: z.number().min(0).max(1),
});
export type TurnInterpretation = z.infer<typeof TurnInterpretationSchema>;

export const TURN_JSON_SCHEMA = {
  type: "object",
  properties: {
    primaryGoal: { type: "string", enum: [...PRIMARY_GOALS] },
    contextualIntent: { type: "string", enum: [...CONTEXTUAL_INTENTS] },
    answersPending: { type: "boolean" },
    entities: {
      type: "object",
      properties: {
        clients: { type: "array", items: { type: "string" } },
        furnitureItems: { type: "array", items: { type: "object", properties: { text: { type: "string" }, candidateKey: { type: ["string", "null"] }, quantity: { type: ["integer", "null"] } }, required: ["text"] } },
        services: { type: "array", items: { type: "string" } },
        physicalCondition: { type: "array", items: { type: "string" } },
      },
    },
    ambiguities: { type: "array", items: { type: "string" } },
    nextQuestion: { type: ["object", "null"], properties: { purpose: { type: "string" }, expectedAnswerType: { type: "string" } } },
    confidence: { type: "number" },
  },
  required: ["primaryGoal", "contextualIntent", "answersPending", "confidence"],
} as const;

export interface TurnContext {
  text: string;
  pendingQuestion: string | null;
  activeGoal: string | null;
  knownFacts: string[];
  /** candidatos do catálogo (lista curta determinística) — a IA só pode escolher entre eles */
  furnitureCandidates: { key: string; name: string }[];
  recentTurns: { from: "bot" | "artesao"; text: string }[];
}

export function turnSystemPrompt(): string {
  return `Você interpreta mensagens de Adriano, artesão de pintura e restauração de móveis, para um assistente de orçamentos.
Devolva só JSON no formato pedido. Regras:
- Se houver pergunta pendente e a mensagem a responde, answersPending=true e contextualIntent="answer_pending_question".
- candidateKey só pode ser uma das chaves em "candidatos_moveis" ou null. Nunca invente chave.
- Não extraia valores em dinheiro, medidas nem preços: o sistema faz isso por regras.
- Estado físico da peça (riscado, descascando, quebrado, cupim) vai em physicalCondition; isso NÃO é andamento do serviço.
- Liste em ambiguities o que não dá para decidir com segurança (ex.: "um cliente ou dois?").
- confidence entre 0 e 1.`;
}

export function turnUserPrompt(c: TurnContext): string {
  return JSON.stringify({
    pergunta_pendente: c.pendingQuestion,
    objetivo_ativo: c.activeGoal,
    fatos_ja_confirmados: c.knownFacts.slice(0, 20),
    candidatos_moveis: c.furnitureCandidates.slice(0, 8),
    conversa_recente: c.recentTurns.slice(-6),
    mensagem: c.text.slice(0, 1500),
  });
}

/** Valida e restringe a saída da IA: chaves de móvel só da lista curta; nada fora do schema. */
export function validateTurn(raw: unknown, allowedFurnitureKeys: string[]): TurnInterpretation | null {
  const parsed = TurnInterpretationSchema.safeParse(raw);
  if (!parsed.success) return null;
  const allowed = new Set(allowedFurnitureKeys);
  const out = parsed.data;
  out.entities.furnitureItems = out.entities.furnitureItems.map((f) => ({ ...f, candidateKey: f.candidateKey && allowed.has(f.candidateKey) ? f.candidateKey : null }));
  return out;
}

// ------------------------------------------------------------------ escolha entre candidatos

export const CHOICE_JSON_SCHEMA = {
  type: "object",
  properties: {
    chosenKey: { type: ["string", "null"] },
    confidence: { type: "number" },
    evidence: { type: "string" },
    alternatives: { type: "array", items: { type: "string" } },
    needsClarification: { type: "boolean" },
  },
  required: ["chosenKey", "confidence", "needsClarification"],
} as const;

const ChoiceSchema = z.object({
  chosenKey: z.string().nullable(),
  confidence: z.number().min(0).max(1),
  evidence: z.string().max(200).default(""),
  alternatives: z.array(z.string()).max(6).default([]),
  needsClarification: z.boolean(),
});
export type CandidateChoice = z.infer<typeof ChoiceSchema>;

export function choiceSystemPrompt(subject: string): string {
  return `Você escolhe, entre candidatos fechados, a qual ${subject} a mensagem do artesão se refere.
Só pode responder uma chave da lista ou null. Se houver dúvida real, needsClarification=true. Responda só JSON.`;
}

/** Valida a escolha: chave precisa estar na lista; confiança baixa vira "perguntar". */
export function validateChoice(raw: unknown, allowedKeys: string[], minConfidence = 0.75): CandidateChoice | null {
  const p = ChoiceSchema.safeParse(raw);
  if (!p.success) return null;
  const c = p.data;
  if (c.chosenKey !== null && !allowedKeys.includes(c.chosenKey)) return null;
  if (c.chosenKey === null || c.confidence < minConfidence) return { ...c, chosenKey: null, needsClarification: true };
  return { ...c, alternatives: c.alternatives.filter((a) => allowedKeys.includes(a)) };
}

/** Escolha de UMA opção de uma lista fechada (respostas às perguntas específicas do catálogo). */
export function validateOption(raw: unknown, options: string[]): string | null {
  const v = raw && typeof raw === "object" ? (raw as { value?: unknown }).value : raw;
  return typeof v === "string" && options.includes(v) ? v : null;
}

export function optionJsonSchema(options: string[]): object {
  return { type: "object", properties: { value: { type: ["string", "null"], enum: [...options, null] } }, required: ["value"] };
}
