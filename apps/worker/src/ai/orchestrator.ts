import {
  CHOICE_JSON_SCHEMA,
  COMPOSE_JSON_SCHEMA,
  COMPOSE_SYSTEM_PROMPT,
  TURN_JSON_SCHEMA,
  choiceSystemPrompt,
  composeUserPrompt,
  optionJsonSchema,
  turnSystemPrompt,
  turnUserPrompt,
  validateChoice,
  validateComposed,
  validateOption,
  validateTurn,
  type CandidateChoice,
  type MessagePlan,
  type TurnContext,
  type TurnInterpretation,
} from "@adripatina/conversations";
import type { Ctx } from "../context.js";
import type { GenerateRequest } from "../ports.js";
import { AiBudgetExceeded, assertAiBudget, breakerOpen, logUsage, recordFailure, recordSuccess, withTimeout } from "./service.js";

/**
 * Orquestração da IA em etapas separadas:
 *   1) interpretação (sugestão estruturada, validada por schema e listas fechadas);
 *   2) validação determinística (feita pelo chamador antes de gravar qualquer coisa);
 *   3) composição da resposta (texto natural, conferido por validador; fallback determinístico).
 * A IA nunca escreve no banco, nunca define dinheiro e nunca escolhe fora das opções.
 */

function available(ctx: Ctx): boolean {
  return !!ctx.ai.extraction?.generate && !breakerOpen(ctx.clock().getTime());
}

async function call(ctx: Ctx, req: GenerateRequest, timeoutMs: number): Promise<{ raw: unknown; ms: number } | null> {
  const provider = ctx.ai.extraction;
  if (!provider?.generate || breakerOpen(ctx.clock().getTime())) return null;
  const started = Date.now();
  try {
    await assertAiBudget(ctx);
    const raw = await withTimeout(provider.generate(req), timeoutMs);
    recordSuccess();
    return { raw, ms: Date.now() - started };
  } catch (err) {
    if (!(err instanceof AiBudgetExceeded)) {
      recordFailure(ctx.clock().getTime());
      await logUsage(ctx, {
        model: provider.name,
        task: "extraction",
        success: false,
        latencyMs: Date.now() - started,
        errorCode: String(err instanceof Error ? err.message : err).slice(0, 60),
        purpose: req.purpose,
        schemaName: req.jsonSchema ? req.purpose.split(":")[0] : "text",
        fallbackUsed: true,
      });
    }
    return null;
  }
}

const tokens = (s: string) => Math.ceil(s.length / 3);

/**
 * Mensagem natural a partir de um plano. Até 2 tentativas; se a LLM omitir a pergunta,
 * inventar número, exagerar nos emojis etc., volta para o texto determinístico.
 */
export async function composeMessage(ctx: Ctx, plan: MessagePlan): Promise<{ text: string; source: "ai" | "fallback"; reasons: string[] }> {
  if (!ctx.config.phrasingVariety || !available(ctx)) return { text: plan.fallback, source: "fallback", reasons: ["ia_indisponivel"] };
  // D-073: com o Claude dando voz a todas as mensagens no fim do turno, a reescrita por pergunta
  // seria dobrada (mais lenta e mais chance de recusa): fica só o texto-base
  if (ctx.config.conversationAi && /^claude/.test(ctx.ai.extraction!.name)) return { text: plan.fallback, source: "fallback", reasons: ["voz_no_fim_do_turno"] };
  const provider = ctx.ai.extraction!;
  let reasons: string[] = [];
  for (let attempt = 0; attempt < 2; attempt++) {
    const user = composeUserPrompt(plan) + (reasons.length ? `\nA tentativa anterior foi recusada por: ${reasons.join("; ")}. Corrija.` : "");
    const r = await call(ctx, { purpose: `compose:${plan.purpose}`, system: COMPOSE_SYSTEM_PROMPT, user, jsonSchema: COMPOSE_JSON_SCHEMA, maxTokens: 260, temperature: 0.7 }, 5000);
    if (!r) break;
    const check = validateComposed(plan, r.raw);
    await logUsage(ctx, {
      model: provider.name,
      task: "extraction",
      inputUnits: tokens(COMPOSE_SYSTEM_PROMPT + user),
      outputUnits: 80,
      unitKind: "tokens_estimados",
      success: check.ok,
      latencyMs: r.ms,
      purpose: `compose:${plan.purpose}`,
      schemaName: "compose_v1",
      fallbackUsed: !check.ok && attempt === 1,
      decision: { accepted: check.ok, reasons: check.reasons.slice(0, 5), attempt },
    });
    if (check.ok) return { text: check.text, source: "ai", reasons: [] };
    reasons = check.reasons;
  }
  return { text: plan.fallback, source: "fallback", reasons };
}

/** Interpretação estruturada do turno (sugestão). Inválido → null (o chamador segue só com regras). */
export async function interpretTurn(ctx: Ctx, c: TurnContext): Promise<TurnInterpretation | null> {
  if (!available(ctx)) return null;
  const system = turnSystemPrompt();
  const user = turnUserPrompt(c);
  const r = await call(ctx, { purpose: "turn:interpret", system, user, jsonSchema: TURN_JSON_SCHEMA, maxTokens: 500 }, 8000);
  if (!r) return null;
  let parsed = validateTurn(r.raw, c.furnitureCandidates.map((f) => f.key));
  let repaired = false;
  if (!parsed) {
    // uma reparação estruturada controlada
    const again = await call(ctx, { purpose: "turn:repair", system: `${system}\nA resposta anterior não seguiu o formato. Responda SOMENTE o JSON válido.`, user, jsonSchema: TURN_JSON_SCHEMA, maxTokens: 500 }, 8000);
    parsed = again ? validateTurn(again.raw, c.furnitureCandidates.map((f) => f.key)) : null;
    repaired = true;
  }
  await logUsage(ctx, {
    model: ctx.ai.extraction!.name,
    task: "extraction",
    inputUnits: tokens(system + user),
    outputUnits: 200,
    unitKind: "tokens_estimados",
    success: !!parsed,
    latencyMs: r.ms,
    purpose: "turn:interpret",
    schemaName: "turn_v1",
    fallbackUsed: !parsed,
    confidence: parsed?.confidence ?? null,
    decision: parsed
      ? { goal: parsed.primaryGoal, intent: parsed.contextualIntent, answersPending: parsed.answersPending, furniture: parsed.entities.furnitureItems.map((f) => f.candidateKey), ambiguities: parsed.ambiguities.length, repaired }
      : { invalid: true, repaired },
  });
  return parsed;
}

/** Escolha entre candidatos fechados (tipo de móvel etc.). Confiança baixa → pedir esclarecimento. */
export async function chooseAmong(ctx: Ctx, subject: string, text: string, candidates: { key: string; name: string }[], context = ""): Promise<CandidateChoice | null> {
  if (!available(ctx) || candidates.length < 2) return null;
  const system = choiceSystemPrompt(subject);
  const user = JSON.stringify({ candidatos: candidates, contexto: context.slice(0, 600), mensagem: text.slice(0, 800) });
  const r = await call(ctx, { purpose: "choose:furniture", system, user, jsonSchema: CHOICE_JSON_SCHEMA, maxTokens: 160 }, 6000);
  if (!r) return null;
  const choice = validateChoice(r.raw, candidates.map((c) => c.key));
  await logUsage(ctx, {
    model: ctx.ai.extraction!.name,
    task: "extraction",
    inputUnits: tokens(system + user),
    outputUnits: 50,
    unitKind: "tokens_estimados",
    success: !!choice,
    latencyMs: r.ms,
    purpose: "choose:furniture",
    schemaName: "choice_v1",
    fallbackUsed: !choice || choice.needsClarification,
    confidence: choice?.confidence ?? null,
    decision: choice ? { chosen: choice.chosenKey, needsClarification: choice.needsClarification } : { invalid: true },
  });
  return choice;
}

/** Interpreta a resposta a uma pergunta específica escolhendo UMA das opções permitidas. */
export async function interpretOption(ctx: Ctx, key: string, question: string, answer: string, options: string[]): Promise<string | null> {
  if (!available(ctx) || !options.length) return null;
  const system = `Classifique a resposta do artesão à pergunta em UMA das opções permitidas, ou null se ela não responder. Responda só JSON.`;
  const user = JSON.stringify({ pergunta: question, opcoes: options, resposta: answer.slice(0, 600) });
  const r = await call(ctx, { purpose: `option:${key}`, system, user, jsonSchema: optionJsonSchema(options), maxTokens: 60 }, 6000);
  if (!r) return null;
  const v = validateOption(r.raw, options);
  await logUsage(ctx, {
    model: ctx.ai.extraction!.name,
    task: "extraction",
    inputUnits: tokens(system + user),
    outputUnits: 20,
    unitKind: "tokens_estimados",
    success: v !== null,
    latencyMs: r.ms,
    purpose: `option:${key}`,
    schemaName: "option_v1",
    fallbackUsed: v === null,
    decision: { value: v },
  });
  return v;
}

/**
 * Interpretação estruturada genérica (o chamador valida o resultado antes de usar).
 * Registra o uso; sem IA ou com falha → null.
 */
export async function interpretStructured(ctx: Ctx, purpose: string, system: string, user: string, jsonSchema: object, maxTokens = 600): Promise<unknown | null> {
  if (!available(ctx)) return null;
  const r = await call(ctx, { purpose, system, user, jsonSchema, maxTokens }, 9000);
  if (!r) return null;
  await logUsage(ctx, {
    model: ctx.ai.extraction!.name,
    task: "extraction",
    inputUnits: tokens(system + user),
    outputUnits: 150,
    unitKind: "tokens_estimados",
    success: true,
    latencyMs: r.ms,
    purpose,
    schemaName: purpose.split(":")[0],
    fallbackUsed: false,
  });
  return r.raw;
}
