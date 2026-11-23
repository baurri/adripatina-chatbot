import { describe, expect, it } from "vitest";
import { ClaudeExtraction, FallbackExtraction, closedSchema } from "../src/ai/claude.js";
import { createAiProviders } from "../src/ai/providers.js";
import { loadConfig } from "../src/env.js";

/** Nenhuma chamada real: o cliente HTTP do SDK é trocado por um falso. */
function fakeClaude(reply: { text?: string; stop?: string; fail?: boolean }) {
  const c = new ClaudeExtraction("sk-test", "claude-haiku-5-5");
  const sent: Record<string, unknown>[] = [];
  (c as unknown as { client: unknown }).client = {
    messages: {
      create: async (body: Record<string, unknown>) => {
        sent.push(body);
        if (reply.fail) throw new Error("rede caiu");
        return { stop_reason: reply.stop ?? "end_turn", content: [{ type: "text", text: reply.text ?? "" }] };
      },
    },
  };
  return { c, sent };
}

const workers = { name: "@cf/mistral", extract: async () => ({ intent: "greeting", from: "workers" }), generate: async () => ({ text: "do workers" }), interpretAnswer: async () => ({ kind: "value", value: "bom" }), rephrase: async () => "do workers" };

describe("provedor Claude (texto) com plano B no Workers AI", () => {
  it("manda saída estruturada fechada, esforço baixo e nenhum parâmetro de amostragem", async () => {
    const { c, sent } = fakeClaude({ text: '{"text":"Oi"}' });
    await c.generate({ purpose: "compose:x", system: "s", user: "u", jsonSchema: { type: "object", properties: { text: { type: "string" } }, required: ["text"] }, maxTokens: 100, temperature: 0.7 });
    expect(sent[0]!.model).toBe("claude-haiku-5-5");
    expect(sent[0]!.temperature).toBeUndefined();
    expect(sent[0]!.output_config).toEqual({ effort: "low", format: { type: "json_schema", schema: { type: "object", properties: { text: { type: "string" } }, required: ["text"], additionalProperties: false } } });
  });

  it("closedSchema fecha objetos aninhados sem mexer no resto", () => {
    expect(closedSchema({ type: "object", properties: { a: { type: "array", items: { type: "object", properties: { b: { type: "string" } } } } } })).toEqual({
      type: "object",
      additionalProperties: false,
      properties: { a: { type: "array", items: { type: "object", additionalProperties: false, properties: { b: { type: "string" } } } } },
    });
  });

  it("erro, recusa ou resposta vazia do Claude → responde o Workers AI, e o nome registrado é o de quem respondeu", async () => {
    for (const reply of [{ fail: true }, { stop: "refusal", text: "{}" }, { text: "" }]) {
      const { c } = fakeClaude(reply);
      const f = new FallbackExtraction(c, workers, {});
      expect(await f.extract("oi")).toEqual({ intent: "greeting", from: "workers" });
      expect(f.name).toBe("@cf/mistral");
    }
    const { c } = fakeClaude({ text: '{"intent":"greeting"}' });
    const ok = new FallbackExtraction(c, workers, {});
    expect(await ok.extract("oi")).toEqual({ intent: "greeting" });
    expect(ok.name).toBe("claude-haiku-5-5");
  });

  it("sem chave da Anthropic, nada muda (só Workers AI); com chave, texto vai para o Claude e o áudio continua no Whisper", () => {
    const config = loadConfig({ ENVIRONMENT: "production", AI_ENABLED: "true", AI_STT_MODEL: "@cf/openai/whisper-large-v3-turbo", AI_EXTRACTION_MODEL: "@cf/mistral" });
    const ai = { run: async () => ({}) } as unknown as Ai;
    expect(createAiProviders(config, ai).extraction!.name).toBe("@cf/mistral");
    const withKey = createAiProviders(config, ai, "sk-test");
    expect(withKey.extraction!.name).toBe("claude-haiku-5-5");
    expect(withKey.stt!.name).toBe("@cf/openai/whisper-large-v3-turbo");
    expect(loadConfig({ AI_CLAUDE_MODEL: "claude-sonnet-5-5" }).claudeModel).toBe("claude-sonnet-5-5");
  });
});
