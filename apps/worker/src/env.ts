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
  // segredos
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_WEBHOOK_SECRET?: string;
}

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
  });
}
