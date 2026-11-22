import type { Button } from "@adripatina/conversations";
import type { TelegramClient } from "../ports.js";

const API = "https://api.telegram.org";

/** Cliente real da Bot API (usado apenas com TELEGRAM_MODE=live e token configurado). */
export class LiveTelegramClient implements TelegramClient {
  readonly mode = "live" as const;
  constructor(private readonly token: string) {}

  private async call(method: string, body: unknown): Promise<unknown> {
    const res = await fetch(`${API}/bot${this.token}/${method}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json()) as { ok: boolean; result?: unknown; description?: string };
    if (!data.ok) throw new Error(`Telegram ${method} falhou: ${data.description ?? res.status}`);
    return data.result;
  }

  async sendMessage(chatId: string, text: string, buttons?: Button[][]): Promise<void> {
    await this.call("sendMessage", {
      chat_id: chatId,
      text,
      ...(buttons?.length ? { reply_markup: { inline_keyboard: buttons.map((row) => row.map((b) => ({ text: b.text, callback_data: b.data.slice(0, 64) }))) } } : {}),
    });
  }

  async sendDocument(chatId: string, filename: string, bytes: Uint8Array, caption?: string): Promise<void> {
    const form = new FormData();
    form.append("chat_id", chatId);
    if (caption) form.append("caption", caption);
    form.append("document", new Blob([bytes], { type: "application/pdf" }), filename);
    const res = await fetch(`${API}/bot${this.token}/sendDocument`, { method: "POST", body: form });
    const data = (await res.json()) as { ok: boolean; description?: string };
    if (!data.ok) throw new Error(`Telegram sendDocument falhou: ${data.description ?? res.status}`);
  }

  async answerCallbackQuery(callbackQueryId: string, text?: string): Promise<void> {
    await this.call("answerCallbackQuery", { callback_query_id: callbackQueryId, ...(text ? { text } : {}) });
  }

  async downloadFile(fileId: string, maxBytes: number): Promise<{ bytes: Uint8Array; filePath: string }> {
    const file = (await this.call("getFile", { file_id: fileId })) as { file_path?: string; file_size?: number };
    if (!file.file_path) throw new Error("Arquivo indisponível no Telegram");
    if (file.file_size && file.file_size > maxBytes) throw new MediaTooLargeError();
    const res = await fetch(`${API}/file/bot${this.token}/${file.file_path}`);
    if (!res.ok) throw new Error(`Download falhou: ${res.status}`);
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.byteLength > maxBytes) throw new MediaTooLargeError();
    return { bytes: buf, filePath: file.file_path };
  }
}

export class MediaTooLargeError extends Error {
  constructor() {
    super("Arquivo maior que o limite configurado");
    this.name = "MediaTooLargeError";
  }
}

export interface SentRecord {
  kind: "message" | "document" | "callback";
  chatId: string;
  text?: string;
  buttons?: Button[][];
  filename?: string;
  bytes?: Uint8Array;
}

/** Mock explícito: registra mensagens em memória (testes e desenvolvimento sem token). */
export class MockTelegramClient implements TelegramClient {
  readonly mode = "mock" as const;
  readonly sent: SentRecord[] = [];
  readonly files = new Map<string, Uint8Array>();
  /** em desenvolvimento local, imprime as respostas no terminal do `wrangler dev` */
  constructor(private readonly log = false) {}

  async sendMessage(chatId: string, text: string, buttons?: Button[][]): Promise<void> {
    this.sent.push({ kind: "message", chatId, text, ...(buttons ? { buttons } : {}) });
    if (this.log) console.info(`[telegram-mock → ${chatId}] ${text}${buttons ? `
   [${buttons.flat().map((b) => `${b.text} = ${b.data}`).join(" | ")}]` : ""}`);
  }
  async sendDocument(chatId: string, filename: string, bytes: Uint8Array, caption?: string): Promise<void> {
    this.sent.push({ kind: "document", chatId, filename, bytes, ...(caption ? { text: caption } : {}) });
    if (this.log) console.info(`[telegram-mock → ${chatId}] [PDF ${filename}, ${bytes.byteLength} bytes]`);
  }
  async answerCallbackQuery(_id: string, text?: string): Promise<void> {
    this.sent.push({ kind: "callback", chatId: "", ...(text ? { text } : {}) });
  }
  async downloadFile(fileId: string, maxBytes: number): Promise<{ bytes: Uint8Array; filePath: string }> {
    const f = this.files.get(fileId);
    if (!f) throw new Error("Arquivo não encontrado (mock)");
    if (f.byteLength > maxBytes) throw new MediaTooLargeError();
    return { bytes: f, filePath: `mock/${fileId}` };
  }
  last(): SentRecord | undefined {
    return [...this.sent].reverse().find((s) => s.kind !== "callback");
  }
  clear(): void {
    this.sent.length = 0;
  }
}

/** Usado em modo live quando o segredo TELEGRAM_BOT_TOKEN ainda não foi configurado. */
export class MissingTokenTelegramClient implements TelegramClient {
  readonly mode = "live" as const;
  private fail(): never {
    throw new Error("TELEGRAM_BOT_TOKEN ausente (wrangler secret put TELEGRAM_BOT_TOKEN)");
  }
  async sendMessage(): Promise<void> {
    this.fail();
  }
  async sendDocument(): Promise<void> {
    this.fail();
  }
  async answerCallbackQuery(): Promise<void> {
    this.fail();
  }
  async downloadFile(): Promise<{ bytes: Uint8Array; filePath: string }> {
    this.fail();
  }
}
