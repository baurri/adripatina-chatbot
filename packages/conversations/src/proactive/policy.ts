import { z } from "zod";
import type { NeedKind } from "./types.js";

/**
 * Política ÚNICA da coleta proativa: horários, limites, cooldowns e validade.
 * Nenhuma regra de frequência deve existir fora deste arquivo.
 */

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

export const ProactiveSettingsSchema = z.object({
  /** chave geral — começa DESLIGADA; o administrador liga no painel */
  enabled: z.boolean().default(false),
  /** pausa temporária (ISO); null = sem pausa */
  pausedUntil: z.string().nullable().default(null),
  /** usuários elegíveis (vazio = todos os artesãos ativos com Telegram) */
  eligibleUserIds: z.array(z.string()).default([]),
  timezone: z.string().default("America/Sao_Paulo"),
  windowStart: hhmm.default("09:00"),
  windowEnd: hhmm.default("18:00"),
  /** 0 = domingo … 6 = sábado */
  allowedWeekdays: z.array(z.number().int().min(0).max(6)).default([1, 2, 3, 4, 5, 6]),
  maxPerDay: z.number().int().min(0).max(10).default(1),
  maxPerWeek: z.number().int().min(0).max(30).default(4),
  minIntervalHours: z.number().min(0).max(168).default(20),
  /** não puxar assunto se ele falou com o bot há menos de N minutos */
  quietAfterActivityMinutes: z.number().int().min(0).max(1440).default(30),
  /** objetivo (ex.: orçamento pausado) sem mensagem dele há N horas não conta como conversa ativa */
  staleGoalHours: z.number().min(1).max(720).default(12),
  /** sem uso (ver resendAfterDays) */
  maxAttempts: z.number().int().min(1).max(10).default(3),
  snoozeDays: z.number().min(0.5).max(60).default(3),
  dontKnowCooldownDays: z.number().min(1).max(120).default(14),
  /** repetir a mesma pergunta sem resposta só depois de N dias */
  resendAfterDays: z.number().min(1).max(60).default(3),
  expireAfterDays: z.number().min(1).max(180).default(21),
  /** após cancelar/expirar, não recriar a mesma solicitação por N dias */
  recreateAfterCloseDays: z.number().min(1).max(365).default(30),
  validity: z
    .object({
      priceDays: z.number().int().min(7).max(730).default(90),
      stockDays: z.number().int().min(1).max(365).default(30),
      completedJobDays: z.number().int().min(1).max(180).default(30),
    })
    .default({}),
  kinds: z
    .object({
      material_price: z.boolean().default(true),
      material_package_size: z.boolean().default(true),
      stock_level: z.boolean().default(true),
      job_actual_hours: z.boolean().default(true),
      job_materials_used: z.boolean().default(true),
      technique_coats: z.boolean().default(true),
    })
    .default({}),
  /** pontuação mínima para virar pergunta */
  minScore: z.number().min(0).max(200).default(20),
  /** botões rápidos ("Não sei", "Pergunte depois") — desligados: ele prefere responder livremente */
  showButtons: z.boolean().default(false),
  /** IA pode reescrever só a frase de contexto (validada); a pergunta é determinística */
  useAiPhrasing: z.boolean().default(true),
});
export type ProactiveSettings = z.infer<typeof ProactiveSettingsSchema>;

export function parseProactiveSettings(raw: unknown): ProactiveSettings {
  const r = ProactiveSettingsSchema.safeParse(raw ?? {});
  return r.success ? r.data : ProactiveSettingsSchema.parse({});
}

/** Grupos que o painel expõe como "permitir perguntas sobre…". */
export const KIND_GROUP: Record<NeedKind, "precos" | "estoque" | "tecnicas" | "apos_trabalho"> = {
  material_price: "precos",
  material_package_size: "precos",
  stock_level: "estoque",
  technique_coats: "tecnicas",
  job_actual_hours: "apos_trabalho",
  job_materials_used: "apos_trabalho",
};

export interface ZonedParts {
  dateKey: string;
  weekday: number;
  hour: number;
  minute: number;
}

const WEEKDAYS: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export function zonedParts(now: Date, timezone: string): ZonedParts {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", weekday: "short", hour12: false })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  ) as Record<string, string>;
  const hour = Number(parts.hour) % 24;
  return { dateKey: `${parts.year}-${parts.month}-${parts.day}`, weekday: WEEKDAYS[parts.weekday!] ?? 0, hour, minute: Number(parts.minute) };
}

/** Instante UTC da meia-noite local de hoje no fuso. */
export function localDayStart(now: Date, timezone: string): Date {
  const p = zonedParts(now, timezone);
  const [y, m, d] = p.dateKey.split("-").map(Number) as [number, number, number];
  const asUtc = Date.UTC(y, m - 1, d, p.hour, p.minute);
  const offsetMs = asUtc - Math.floor(now.getTime() / 60_000) * 60_000;
  return new Date(Date.UTC(y, m - 1, d) - offsetMs);
}

function minutesOf(hm: string): number {
  const [h, m] = hm.split(":").map(Number) as [number, number];
  return h * 60 + m;
}

export function isWithinWindow(settings: ProactiveSettings, now: Date): { ok: boolean; reason?: string } {
  const p = zonedParts(now, settings.timezone);
  if (!settings.allowedWeekdays.includes(p.weekday)) return { ok: false, reason: "dia_nao_permitido" };
  const cur = p.hour * 60 + p.minute;
  if (cur < minutesOf(settings.windowStart) || cur >= minutesOf(settings.windowEnd)) return { ok: false, reason: "fora_do_horario" };
  return { ok: true };
}

export interface SendState {
  sentToday: number;
  sentLast7Days: number;
  lastSentAt: string | null;
  /** já existe uma pergunta proativa aguardando resposta */
  waitingRequest: boolean;
  lastActivityAt: string | null;
  /** sessão sem fluxo ativo (nenhum orçamento/registro em andamento) */
  flowIdle: boolean;
}

export type GateReason =
  | "desativado"
  | "pausado"
  | "dia_nao_permitido"
  | "fora_do_horario"
  | "limite_diario"
  | "limite_semanal"
  | "intervalo_minimo"
  | "aguardando_resposta"
  | "conversa_ativa";

export const GATE_LABEL: Record<GateReason, string> = {
  desativado: "Coleta proativa desligada",
  pausado: "Coleta proativa pausada",
  dia_nao_permitido: "Dia da semana não permitido",
  fora_do_horario: "Fora do horário permitido",
  limite_diario: "Limite diário atingido",
  limite_semanal: "Limite semanal atingido",
  intervalo_minimo: "Intervalo mínimo entre mensagens",
  aguardando_resposta: "Já existe pergunta aguardando resposta",
  conversa_ativa: "Adriano está conversando sobre outro assunto",
};

/** Pode puxar assunto agora? Ordem fixa e explicável. */
export function canSendNow(settings: ProactiveSettings, state: SendState, now: Date): { ok: true } | { ok: false; reason: GateReason } {
  if (!settings.enabled) return { ok: false, reason: "desativado" };
  if (settings.pausedUntil && Date.parse(settings.pausedUntil) > now.getTime()) return { ok: false, reason: "pausado" };
  const win = isWithinWindow(settings, now);
  if (!win.ok) return { ok: false, reason: win.reason as GateReason };
  if (state.waitingRequest) return { ok: false, reason: "aguardando_resposta" };
  if (state.sentToday >= settings.maxPerDay) return { ok: false, reason: "limite_diario" };
  if (state.sentLast7Days >= settings.maxPerWeek) return { ok: false, reason: "limite_semanal" };
  if (state.lastSentAt && now.getTime() - Date.parse(state.lastSentAt) < settings.minIntervalHours * 3_600_000) return { ok: false, reason: "intervalo_minimo" };
  if (!state.flowIdle) return { ok: false, reason: "conversa_ativa" };
  if (state.lastActivityAt && now.getTime() - Date.parse(state.lastActivityAt) < settings.quietAfterActivityMinutes * 60_000) return { ok: false, reason: "conversa_ativa" };
  return { ok: true };
}

export type CooldownKind = "snooze" | "dont_know" | "resend" | "expire" | "recreate";

/** Próxima data permitida após um evento (fonte única dos cooldowns). */
export function cooldownUntil(settings: ProactiveSettings, kind: CooldownKind, from: Date): string {
  const days = {
    snooze: settings.snoozeDays,
    dont_know: settings.dontKnowCooldownDays,
    resend: settings.resendAfterDays,
    expire: settings.expireAfterDays,
    recreate: settings.recreateAfterCloseDays,
  }[kind];
  return new Date(from.getTime() + days * 86_400_000).toISOString();
}

/**
 * Pergunta aguardando resposta: NUNCA é repetida. Fica esperando até ele responder ou
 * interagir com outro assunto (ver `ignoredByOtherInteraction`); por segurança, uma
 * pergunta esquecida expira depois de `expireAfterDays` (não fica travando a fila
 * nem é lida como resposta semanas depois).
 */
export function waitingDecision(settings: ProactiveSettings, req: { lastSentAt: string | null }, now: Date): "wait" | "expire" {
  if (!req.lastSentAt) return "wait";
  return now.getTime() - Date.parse(req.lastSentAt) >= settings.expireAfterDays * 86_400_000 ? "expire" : "wait";
}

/** Ele mandou mensagem depois da pergunta e a conversa já não está nela → a pergunta foi deixada de lado. */
export function ignoredByOtherInteraction(req: { lastSentAt: string | null }, lastInboundAt: string | null, sessionPointsToRequest: boolean): boolean {
  if (!req.lastSentAt || !lastInboundAt || sessionPointsToRequest) return false;
  return Date.parse(lastInboundAt) > Date.parse(req.lastSentAt);
}
