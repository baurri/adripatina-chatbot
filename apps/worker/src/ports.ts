import type { Button } from "@adripatina/conversations";

/** Interfaces de provedores externos. Implementações reais e mocks são separadas. */

export interface OutgoingMessage {
  text: string;
  buttons?: Button[][];
  document?: { filename: string; bytes: Uint8Array; caption?: string };
}

export interface TelegramClient {
  readonly mode: "mock" | "live";
  sendMessage(chatId: string, text: string, buttons?: Button[][]): Promise<void>;
  sendDocument(chatId: string, filename: string, bytes: Uint8Array, caption?: string): Promise<void>;
  answerCallbackQuery(callbackQueryId: string, text?: string): Promise<void>;
  /** Baixa um arquivo pelo file_id. */
  downloadFile(fileId: string, maxBytes: number): Promise<{ bytes: Uint8Array; filePath: string }>;
}

/** Subconjunto do R2 usado pelo sistema (o binding R2Bucket satisfaz). */
export interface FileStorage {
  put(key: string, value: ArrayBuffer | Uint8Array, options?: { httpMetadata?: { contentType?: string } }): Promise<unknown>;
  get(key: string): Promise<{ arrayBuffer(): Promise<ArrayBuffer>; httpMetadata?: { contentType?: string } } | null>;
  delete(key: string): Promise<void>;
}

export interface SttResult {
  text: string;
  durationSeconds?: number;
}

export interface SpeechToText {
  readonly name: string;
  transcribe(audio: Uint8Array, mime: string): Promise<SttResult>;
}

export interface ExtractionProvider {
  readonly name: string;
  /** Retorna JSON bruto (validado pelo chamador com Zod). */
  extract(text: string): Promise<unknown>;
}

export interface VisionProvider {
  readonly name: string;
  describe(image: Uint8Array, mime: string): Promise<{ furnitureType?: string; description: string }>;
}

export interface AiProviders {
  stt: SpeechToText | null;
  extraction: ExtractionProvider | null;
  vision: VisionProvider | null;
}

export type Clock = () => Date;

export interface AccessVerifier {
  /** Valida o JWT do Cloudflare Access e retorna o e-mail autenticado. */
  verify(token: string): Promise<{ email: string }>;
}
