import { z } from "zod";

/** Bindings e variáveis do Worker. Segredos via `wrangler secret put`. */
export interface Env {
  DB: D1Database;
  FILES: R2Bucket;
  AI?: Ai;
  ASSETS?: Fetcher;
  ENVIRONMENT: string;
  AI_ENABLED: string;
  AI_STT_MODEL: string;
  AI_EXTRACTION_MODEL: string;
  AI_VISION_MODEL: string;
  AI_DAILY_REQUEST_LIMIT: string;
  AUDIO_MAX_SECONDS: string;
  AUDIO_MAX_BYTES: string;
  IMAGE_MAX_BYTES: string;
  MEDIA_RETENTION_DAYS: string;
  ACCESS_TEAM_DOMAIN: string;
  ACCESS_AUD: string;
  ADMIN_DEV_BYPASS_EMAIL: string;
  TELEGRAM_MODE: string;
  DAILY_SUMMARY_HOUR: string;
  PHRASING_VARIETY?: string;
  CONVERSATION_AI?: string;
  PUBLIC_BASE_URL?: string;
  AGENT_ENGINE?: string;
  AI_AGENT_MODEL?: string;
  /** coleta proativa: off | dry_run | live (live ainda exige ativação no painel) */
  PROACTIVE_MODE?: string;
  /** modelo Claude para texto quando ANTHROPIC_API_KEY existe (padrão claude-haiku-5-5) */
  AI_CLAUDE_MODEL?: string;
  /** bom dia (07h30) e boa noite (23h10) para o artesão; "false" desliga */
  GREETINGS?: string;
  /** pacotes de figurinhas (nomes de t.me/addstickers/NOME, separados por vírgula) */
  STICKERS_BOM_DIA?: string;
  STICKERS_BOA_NOITE?: string;
  // segredos
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_WEBHOOK_SECRET?: string;
  /** com a chave, a parte de TEXTO da IA vai para o Claude (o áudio segue no Workers AI) */
  ANTHROPIC_API_KEY?: string;
}

/** "t.me/addstickers/Nome, Outro" → ["Nome", "Outro"] */
const packList = (v?: string) => (v ?? "").split(",").map((x) => x.trim().replace(/^.*addstickers\//, "")).filter(Boolean);

const intStr = (def: number) =>
  z
    .string()
    .optional()
    .transform((v) => (v && /^\d+$/.test(v) ? Number(v) : def));

export const ConfigSchema = z.object({
  environment: z.enum(["local", "test", "staging", "production"]),
  aiEnabled: z.boolean(),
  sttModel: z.string(),
  extractionModel: z.string(),
  visionModel: z.string(),
  aiDailyRequestLimit: z.number(),
  audioMaxSeconds: z.number(),
  audioMaxBytes: z.number(),
  imageMaxBytes: z.number(),
  mediaRetentionDays: z.number(),
  accessTeamDomain: z.string(),
  accessAud: z.string(),
  adminDevBypassEmail: z.string(),
  telegramMode: z.enum(["mock", "live"]),
  dailySummaryHour: z.number(),
  /** varia a forma das perguntas (testes usam false para textos estáveis) */
  phrasingVariety: z.boolean(),
  /** D-073: Claude lê toda mensagem recebida e dá voz a toda mensagem enviada */
  conversationAi: z.boolean(),
  publicBaseUrl: z.string().nullable(),
  /** D-075: motor de conversa novo (Claude com ferramentas) */
  agentEngine: z.boolean(),
  agentModel: z.string(),
  /** coleta proativa: off (nada), dry_run (só simula), live (envia, se ligada no painel) */
  proactiveMode: z.enum(["off", "dry_run", "live"]),
  /** modelo Claude para texto (usado só se houver ANTHROPIC_API_KEY; a chave fica fora da Config) */
  claudeModel: z.string(),
  greetings: z.boolean(),
  stickersMorning: z.array(z.string()),
  stickersNight: z.array(z.string()),
});
export type Config = z.infer<typeof ConfigSchema>;

export function loadConfig(env: Partial<Env>): Config {
  const environment = (["local", "test", "staging", "production"].includes(env.ENVIRONMENT ?? "") ? env.ENVIRONMENT : "local") as Config["environment"];
  return ConfigSchema.parse({
    environment,
    aiEnabled: env.AI_ENABLED === "true",
    sttModel: env.AI_STT_MODEL ?? "",
    extractionModel: env.AI_EXTRACTION_MODEL ?? "",
    visionModel: env.AI_VISION_MODEL ?? "",
    aiDailyRequestLimit: intStr(200).parse(env.AI_DAILY_REQUEST_LIMIT),
    audioMaxSeconds: intStr(300).parse(env.AUDIO_MAX_SECONDS),
    audioMaxBytes: intStr(10 * 1024 * 1024).parse(env.AUDIO_MAX_BYTES),
    imageMaxBytes: intStr(10 * 1024 * 1024).parse(env.IMAGE_MAX_BYTES),
    mediaRetentionDays: intStr(180).parse(env.MEDIA_RETENTION_DAYS),
    accessTeamDomain: env.ACCESS_TEAM_DOMAIN ?? "",
    accessAud: env.ACCESS_AUD ?? "",
    // bypass de desenvolvimento só vale em ambiente local/test
    adminDevBypassEmail: environment === "local" || environment === "test" ? (env.ADMIN_DEV_BYPASS_EMAIL ?? "") : "",
    telegramMode: env.TELEGRAM_MODE === "live" ? "live" : "mock",
    dailySummaryHour: intStr(7).parse(env.DAILY_SUMMARY_HOUR),
    phrasingVariety: env.PHRASING_VARIETY !== "false",
    conversationAi: env.CONVERSATION_AI !== "false",
    publicBaseUrl: env.PUBLIC_BASE_URL?.trim().replace(/\/+$/, "") || null,
    agentEngine: env.AGENT_ENGINE !== "false",
    agentModel: env.AI_AGENT_MODEL ?? env.AI_CLAUDE_MODEL ?? "claude-haiku-5-5",
    // fora de produção o padrão é só simular — nunca enviar mensagens reais automaticamente
    claudeModel: env.AI_CLAUDE_MODEL || "claude-haiku-5-5",
    greetings: env.GREETINGS !== "false",
    stickersMorning: packList(env.STICKERS_BOM_DIA),
    stickersNight: packList(env.STICKERS_BOA_NOITE),
    proactiveMode: (["off", "dry_run", "live"].includes(env.PROACTIVE_MODE ?? "") ? env.PROACTIVE_MODE : environment === "production" ? "live" : "dry_run") as "off" | "dry_run" | "live",
  });
}
