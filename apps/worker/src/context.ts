import type { Config } from "./env.js";
import type { Db } from "./db/sql.js";
import type { AiProviders, Clock, FileStorage, TelegramClient } from "./ports.js";

/** Dependências injetadas em serviços (facilita testes com mocks). */
export interface Ctx {
  db: Db;
  config: Config;
  clock: Clock;
  telegram: TelegramClient;
  storage: FileStorage;
  ai: AiProviders;
  requestId: string;
}

export function nowIso(ctx: Pick<Ctx, "clock">): string {
  return ctx.clock().toISOString();
}
