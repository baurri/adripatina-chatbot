import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import type { Ctx } from "../src/context.js";
import { Db } from "../src/db/sql.js";
import { loadConfig } from "../src/env.js";
import { MockTelegramClient, type SentRecord } from "../src/telegram/client.js";
import { MockExtraction, MockStt } from "../src/ai/providers.js";
import { resetAiBreaker } from "../src/ai/service.js";
import { processUpdate } from "../src/telegram/webhook.js";
import { seedDemoData, saveSettingsVersion, getActiveSettings } from "../src/repos/catalog.js";
import { createUser } from "../src/repos/users.js";
import { createApp } from "../src/app.js";
import type { AccessVerifier } from "../src/ports.js";
import { D1Shim, MemoryBucket } from "./d1-shim.js";

const here = dirname(fileURLToPath(import.meta.url));
export const MIGRATIONS = join(here, "../../../db/migrations");

export const ARTISAN_TG = 1001;
export const ADMIN_TG = 2001;
export const STRANGER_TG = 9999;
export const ADMIN_EMAIL = "admin@exemplo.local";

export interface Harness {
  ctx: Ctx;
  d1: D1Shim;
  telegram: MockTelegramClient;
  bucket: MemoryBucket;
  stt: MockStt;
  extraction: MockExtraction;
  clock: { now: Date };
  artisanId: string;
  adminId: string;
  /** envia texto como se viesse do Telegram; devolve as respostas novas */
  send(text: string, from?: number, updateId?: number): Promise<SentRecord[]>;
  click(data: string, from?: number): Promise<SentRecord[]>;
  voice(fileUniqueId: string, transcript: string | null, from?: number): Promise<SentRecord[]>;
  photo(bytes: Uint8Array, caption?: string, from?: number): Promise<SentRecord[]>;
  lastText(): string;
  allText(records: SentRecord[]): string;
  advance(days: number): void;
  calibrateAndPrice(): Promise<void>;
  app(verifier?: AccessVerifier | null, env?: "test" | "production"): ReturnType<typeof createApp>;
}

export async function createHarness(opts: { requireAdminReview?: boolean } = {}): Promise<Harness> {
  resetAiBreaker();
  const d1 = new D1Shim();
  d1.applyMigrations(MIGRATIONS);
  const telegram = new MockTelegramClient();
  const bucket = new MemoryBucket();
  const stt = new MockStt();
  const extraction = new MockExtraction();
  const clock = { now: new Date("2026-11-16T13:00:00Z") };
  const ctx: Ctx = {
    db: new Db(d1 as unknown as D1Database),
    config: loadConfig({ ENVIRONMENT: "test", AI_ENABLED: "false", ADMIN_DEV_BYPASS_EMAIL: "", TELEGRAM_MODE: "mock" }),
    clock: () => clock.now,
    telegram,
    storage: bucket,
    ai: { stt: null, extraction: null, vision: null },
    requestId: "test",
  };
  await seedDemoData(ctx);
  if (opts.requireAdminReview === false) {
    const s = await getActiveSettings(ctx);
    await saveSettingsVersion(ctx, "test", { ...s.params, requireAdminReview: false }, s.business, "test");
  }
  const artisanId = await createUser(ctx, { role: "ARTESAO", displayName: "Adriano", telegramUserId: String(ARTISAN_TG) });
  const adminId = await createUser(ctx, { role: "ADMIN", displayName: "Admin Família", telegramUserId: String(ADMIN_TG), adminEmail: ADMIN_EMAIL });

  let updateSeq = 1;
  let msgSeq = 1;
  const since = () => telegram.sent.length;
  const newSince = (n: number) => telegram.sent.slice(n).filter((s) => s.kind !== "callback");

  const h: Harness = {
    ctx,
    d1,
    telegram,
    bucket,
    stt,
    extraction,
    clock,
    artisanId,
    adminId,
    async send(text, from = ARTISAN_TG, updateId) {
      const n = since();
      await processUpdate(ctx, {
        update_id: updateId ?? updateSeq++,
        message: { message_id: msgSeq++, from: { id: from, is_bot: false, first_name: "X" }, chat: { id: from, type: "private" }, date: Math.floor(clock.now.getTime() / 1000), text },
      });
      return newSince(n);
    },
    async click(data, from = ARTISAN_TG) {
      const n = since();
      await processUpdate(ctx, {
        update_id: updateSeq++,
        callback_query: { id: `cb${updateSeq}`, from: { id: from, is_bot: false }, message: { message_id: 1, chat: { id: from, type: "private" } }, data },
      });
      return newSince(n);
    },
    async voice(fileUniqueId, transcript, from = ARTISAN_TG) {
      const n = since();
      const fileId = `file-${fileUniqueId}-${updateSeq}`;
      const content = `audio:${fileUniqueId}`;
      telegram.files.set(fileId, new TextEncoder().encode(content));
      if (transcript !== null) stt.transcripts.set(content, transcript);
      await processUpdate(ctx, {
        update_id: updateSeq++,
        message: { message_id: msgSeq++, from: { id: from }, chat: { id: from, type: "private" }, date: 0, voice: { file_id: fileId, file_unique_id: fileUniqueId, duration: 6, mime_type: "audio/ogg" } },
      });
      return newSince(n);
    },
    async photo(bytes, caption, from = ARTISAN_TG) {
      const n = since();
      const fileId = `photo-${updateSeq}`;
      telegram.files.set(fileId, bytes);
      await processUpdate(ctx, {
        update_id: updateSeq++,
        message: { message_id: msgSeq++, from: { id: from }, chat: { id: from, type: "private" }, date: 0, ...(caption ? { caption } : {}), photo: [{ file_id: fileId, file_unique_id: `u-${fileId}`, width: 10, height: 10 }] },
      });
      return newSince(n);
    },
    lastText() {
      return telegram.last()?.text ?? "";
    },
    allText(records) {
      return records.map((r) => r.text ?? "").join("\n---\n");
    },
    advance(days) {
      clock.now = new Date(clock.now.getTime() + days * 86_400_000);
    },
    async calibrateAndPrice() {
      // preços FICTÍCIOS de teste + calibração aprovada (simula revisão do admin)
      const prices: Record<string, number> = {
        lixa: 300, massa_madeira: 2000, fundo_preparador: 4500, tinta_esmalte: 12000, tinta_base_patina: 5000, betume_patina: 3000,
        verniz: 9000, cera: 4000, folha_ouro: 8000, cola_mordente: 3500, solvente: 2500,
      };
      for (const [key, cents] of Object.entries(prices)) {
        await ctx.db.run("UPDATE materials SET replacement_price_cents = ?, price_updated_at = ?, calibrated = 1 WHERE key = ?", cents, clock.now.toISOString(), key);
      }
      await ctx.db.run("UPDATE techniques SET calibrated = 1");
      await ctx.db.run("UPDATE application_methods SET calibrated = 1");
    },
    app(verifier = null, env = "test") {
      return createApp({
        makeCtx: () => ({ ...ctx, config: { ...ctx.config, environment: env, adminDevBypassEmail: "" } }),
        accessVerifier: verifier,
        telegramWebhookSecret: "segredo-de-teste",
      });
    },
  };
  return h;
}

export function buttonsOf(r: SentRecord | undefined): string[] {
  return (r?.buttons ?? []).flat().map((b) => b.data);
}

export async function count(h: Harness, sql: string, ...params: (string | number)[]): Promise<number> {
  const r = await h.ctx.db.first<{ n: number }>(sql, ...params);
  return r?.n ?? 0;
}
