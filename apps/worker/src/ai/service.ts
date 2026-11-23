import { interpretRules, mergeNlu, sanitizeAiExtraction, supportsAiAnswer, validateAiAnswer, validateRephrase, type NluResult, type ParsedAnswer } from "@adripatina/conversations";
import type { ProjectField } from "@adripatina/domain";
import { newId } from "@adripatina/shared";
import type { Ctx } from "../context.js";
import { nowIso } from "../context.js";

/**
 * Estimativas de neurons por unidade, conforme página de preços oficial
 * (consultada em 22/11/2026). São ESTIMATIVAS para telemetria local — o
 * valor real cobrado é o do painel Cloudflare.
 */
const NEURONS_PER_AUDIO_MINUTE: Record<string, number> = {
  "@cf/openai/whisper-large-v3-turbo": 46.63,
  "@cf/openai/whisper": 41.14,
};
const NEURONS_PER_M_TOKENS: Record<string, [number, number]> = {
  "@cf/mistralai/mistral-small-3.1-24b-instruct": [31876, 50488],
  "@cf/meta/llama-3.3-70b-instruct-fp8-fast": [26668, 204805],
};
const USD_PER_1000_NEURONS = 0.011;

export class AiBudgetExceeded extends Error {
  constructor() {
    super("Teto operacional diário de IA atingido");
    this.name = "AiBudgetExceeded";
  }
}

/** Teto operacional interno. NÃO garante teto na fatura Cloudflare. */
export async function assertAiBudget(ctx: Ctx): Promise<void> {
  const since = new Date(ctx.clock().getTime() - 86_400_000).toISOString();
  const r = await ctx.db.first<{ n: number }>("SELECT COUNT(*) AS n FROM ai_usage WHERE created_at >= ?", since);
  if ((r?.n ?? 0) >= ctx.config.aiDailyRequestLimit) throw new AiBudgetExceeded();
}

async function logUsage(
  ctx: Ctx,
  u: { model: string; task: "stt" | "extraction" | "vision"; inputUnits?: number; outputUnits?: number; unitKind?: string; success: boolean; latencyMs: number; errorCode?: string },
): Promise<void> {
  let neurons: number | null = null;
  if (u.task === "stt" && u.inputUnits !== undefined) neurons = (NEURONS_PER_AUDIO_MINUTE[u.model] ?? 0) * (u.inputUnits / 60);
  if (u.task === "extraction" && u.inputUnits !== undefined) {
    const rates = NEURONS_PER_M_TOKENS[u.model];
    if (rates) neurons = (rates[0] * u.inputUnits + rates[1] * (u.outputUnits ?? 0)) / 1_000_000;
  }
  await ctx.db.run(
    `INSERT INTO ai_usage (id, provider, model, task, input_units, output_units, unit_kind, estimated_neurons, estimated_cost_usd_micros, success, latency_ms, error_code, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    newId(),
    "workers-ai",
    u.model,
    u.task,
    u.inputUnits ?? null,
    u.outputUnits ?? null,
    u.unitKind ?? null,
    neurons,
    neurons === null ? null : Math.round((neurons / 1000) * USD_PER_1000_NEURONS * 1_000_000),
    u.success ? 1 : 0,
    u.latencyMs,
    u.errorCode ?? null,
    nowIso(ctx),
  );
}

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      p,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("timeout")), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Circuit breaker simples por isolate: após falhas seguidas, pausa a IA por alguns minutos. */
const breaker = { failures: 0, openUntil: 0 };
function breakerOpen(now: number): boolean {
  return breaker.openUntil > now;
}
function recordFailure(now: number): void {
  breaker.failures++;
  if (breaker.failures >= 3) {
    breaker.openUntil = now + 5 * 60_000;
    breaker.failures = 0;
  }
}
function recordSuccess(): void {
  breaker.failures = 0;
}
export function resetAiBreaker(): void {
  breaker.failures = 0;
  breaker.openUntil = 0;
}

/**
 * Interpretação: regras sempre; IA opcional complementa. Falha da IA → só regras.
 * Nenhum valor de preço da IA é aceito (sanitizeAiExtraction).
 */
export async function interpret(ctx: Ctx, text: string): Promise<NluResult> {
  const rules = interpretRules(text);
  const provider = ctx.ai.extraction;
  if (!provider) return rules;
  // regras com alta confiança dispensam a IA (economia)
  if (rules.confidence >= 0.9 && rules.intent !== "unknown") return rules;
  const now = ctx.clock().getTime();
  if (breakerOpen(now)) return rules;
  const started = Date.now();
  try {
    await assertAiBudget(ctx);
    const raw = await withTimeout(provider.extract(text), 8000);
    const ai = sanitizeAiExtraction(raw);
    await logUsage(ctx, { model: provider.name, task: "extraction", inputUnits: Math.ceil(text.length / 3) + 600, outputUnits: 120, unitKind: "tokens_estimados", success: !!ai, latencyMs: Date.now() - started });
    recordSuccess();
    return mergeNlu(rules, ai);
  } catch (err) {
    if (!(err instanceof AiBudgetExceeded)) {
      recordFailure(now);
      await logUsage(ctx, { model: provider.name, task: "extraction", success: false, latencyMs: Date.now() - started, errorCode: String(err instanceof Error ? err.message : err).slice(0, 60) });
    }
    return rules;
  }
}

export class TranscriptionUnavailable extends Error {
  constructor(readonly reason: "disabled" | "failed" | "budget" | "too_long") {
    super(`Transcrição indisponível: ${reason}`);
    this.name = "TranscriptionUnavailable";
  }
}

export async function transcribe(ctx: Ctx, audio: Uint8Array, mime: string, durationSeconds: number): Promise<string> {
  const stt = ctx.ai.stt;
  if (!stt) throw new TranscriptionUnavailable("disabled");
  if (durationSeconds > ctx.config.audioMaxSeconds) throw new TranscriptionUnavailable("too_long");
  try {
    await assertAiBudget(ctx);
  } catch {
    throw new TranscriptionUnavailable("budget");
  }
  const started = Date.now();
  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const r = await withTimeout(stt.transcribe(audio, mime), 30_000);
      await logUsage(ctx, { model: stt.name, task: "stt", inputUnits: durationSeconds, unitKind: "segundos_audio", success: true, latencyMs: Date.now() - started });
      return r.text;
    } catch (err) {
      lastErr = err;
    }
  }
  await logUsage(ctx, { model: stt.name, task: "stt", inputUnits: durationSeconds, unitKind: "segundos_audio", success: false, latencyMs: Date.now() - started, errorCode: String(lastErr instanceof Error ? lastErr.message : lastErr).slice(0, 60) });
  throw new TranscriptionUnavailable("failed");
}

export async function describeImage(ctx: Ctx, image: Uint8Array, mime: string): Promise<string | null> {
  const v = ctx.ai.vision;
  if (!v) return null;
  const started = Date.now();
  try {
    await assertAiBudget(ctx);
    const r = await withTimeout(v.describe(image, mime), 15_000);
    await logUsage(ctx, { model: v.name, task: "vision", success: true, latencyMs: Date.now() - started });
    return r.description || null;
  } catch (err) {
    await logUsage(ctx, { model: v.name, task: "vision", success: false, latencyMs: Date.now() - started, errorCode: String(err instanceof Error ? err.message : err).slice(0, 60) });
    return null;
  }
}

/**
 * IA interpreta a resposta à pergunta pendente quando as regras não entenderam.
 * Só valores permitidos para o campo; sem dinheiro; falha → null (fica com as regras).
 */
export async function aiInterpretAnswer(ctx: Ctx, field: ProjectField, question: string, answer: string): Promise<ParsedAnswer | null> {
  const provider = ctx.ai.extraction;
  if (!provider?.interpretAnswer || !supportsAiAnswer(field)) return null;
  const now = ctx.clock().getTime();
  if (breakerOpen(now)) return null;
  const started = Date.now();
  try {
    await assertAiBudget(ctx);
    const raw = await withTimeout(provider.interpretAnswer(field, question, answer), 6000);
    const parsed = validateAiAnswer(field, raw);
    await logUsage(ctx, { model: provider.name, task: "extraction", inputUnits: Math.ceil((question.length + answer.length) / 3) + 250, outputUnits: 40, unitKind: "tokens_estimados_resposta", success: !!parsed, latencyMs: Date.now() - started });
    recordSuccess();
    return parsed;
  } catch (err) {
    if (!(err instanceof AiBudgetExceeded)) {
      recordFailure(now);
      await logUsage(ctx, { model: provider.name, task: "extraction", success: false, latencyMs: Date.now() - started, errorCode: String(err instanceof Error ? err.message : err).slice(0, 60) });
    }
    return null;
  }
}

/** Reescreve uma pergunta de forma natural. Só aceita reescritas seguras; senão devolve o texto-base. */
export async function aiRephrase(ctx: Ctx, base: string): Promise<string> {
  const provider = ctx.ai.extraction;
  if (!provider?.rephrase || !ctx.config.phrasingVariety) return base;
  const now = ctx.clock().getTime();
  if (breakerOpen(now)) return base;
  const started = Date.now();
  try {
    await assertAiBudget(ctx);
    const candidate = await withTimeout(provider.rephrase(base), 2500);
    const ok = validateRephrase(base, candidate);
    await logUsage(ctx, { model: provider.name, task: "extraction", inputUnits: Math.ceil(base.length / 3) + 120, outputUnits: 60, unitKind: "tokens_estimados_reescrita", success: !!ok, latencyMs: Date.now() - started });
    return ok ?? base;
  } catch {
    return base;
  }
}
