import type { Button } from "@adripatina/conversations";

/** Interfaces de provedores externos. Implementações reais e mocks são separadas. */

export interface OutgoingMessage {
  text: string;
  buttons?: Button[][];
  document?: { filename: string; bytes: Uint8Array; caption?: string };
}

export interface TelegramClient {
  readonly mode: "mock" | "live";
  /** devolve o message_id do Telegram (null quando indisponível) para correlação */
  sendMessage(chatId: string, text: string, buttons?: Button[][]): Promise<{ messageId: number | null }>;
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
  /** interpreta a resposta a uma pergunta específica (JSON validado pelo chamador) */
  interpretAnswer?(field: string, question: string, answer: string): Promise<unknown>;
  /** reescreve uma pergunta de forma natural (validada pelo chamador) */
  rephrase?(text: string): Promise<string>;
  /** chamada genérica (JSON quando houver schema); SEMPRE validada pelo chamador */
  generate?(req: GenerateRequest): Promise<unknown>;
}

export interface GenerateRequest {
  /** objetivo da chamada, para auditoria (ex.: "compose:ask_dimensions") */
  purpose: string;
  system: string;
  user: string;
  jsonSchema?: object;
  maxTokens: number;
  temperature?: number;
}

export interface VisionProvider {
  readonly name: string;
  describe(image: Uint8Array, mime: string): Promise<{ furnitureType?: string; description: string }>;
}

/** Ferramenta oferecida ao agente de conversa (D-075). */
export interface AgentTool {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export type AgentBlock = { type: "text"; text: string } | { type: "tool_use"; id: string; name: string; input: unknown };

/** Mensagem no formato da API de mensagens (usuário/assistente; conteúdo texto ou blocos). */
export interface AgentMessage {
  role: "user" | "assistant";
  content: string | Record<string, unknown>[];
}

export interface AgentStep {
  stopReason: string;
  content: AgentBlock[];
  usage?: { inputTokens: number; outputTokens: number };
}

/** O modelo que conduz a conversa com ferramentas (Claude). Um passo = uma chamada. */
export interface AgentModel {
  readonly name: string;
  step(system: string, messages: AgentMessage[], tools: AgentTool[], maxTokens: number): Promise<AgentStep>;
}

export interface AiProviders {
  stt: SpeechToText | null;
  extraction: ExtractionProvider | null;
  vision: VisionProvider | null;
  /** D-075: agente de conversa (Claude com ferramentas); null → motor antigo */
  agent?: AgentModel | null;
}

export type Clock = () => Date;

export interface AccessVerifier {
  /** Valida o JWT do Cloudflare Access e retorna o e-mail autenticado. */
  verify(token: string): Promise<{ email: string }>;
}
