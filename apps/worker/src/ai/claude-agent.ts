import Anthropic from "@anthropic-ai/sdk";
import type { AgentBlock, AgentMessage, AgentModel, AgentStep, AgentTool } from "../ports.js";

/**
 * D-075 — o Claude conduzindo a conversa com ferramentas (uso de ferramentas da API de mensagens).
 * Um `step` é uma chamada: devolve texto e/ou pedidos de ferramenta; o laço e as travas ficam no
 * motor (apps/worker/src/agent/engine.ts). O contrato de conversa já vem no `system`.
 */
export class ClaudeAgentModel implements AgentModel {
  private readonly client: Anthropic;
  constructor(
    apiKey: string,
    readonly name: string,
    private readonly opts: { timeoutMs?: number; effort?: "low" | "medium" | "high" } = {},
  ) {
    this.client = new Anthropic({ apiKey, timeout: opts.timeoutMs ?? 30000, maxRetries: 1 });
  }

  async step(system: string, messages: AgentMessage[], tools: AgentTool[], maxTokens: number): Promise<AgentStep> {
    const response = await this.client.messages.create({
      model: this.name,
      max_tokens: maxTokens,
      system,
      messages: messages as Anthropic.MessageParam[],
      tools: tools as Anthropic.Tool[],
      output_config: { effort: this.opts.effort ?? "medium" },
    });
    const content: AgentBlock[] = [];
    for (const b of response.content) {
      if (b.type === "text") content.push({ type: "text", text: b.text });
      else if (b.type === "tool_use") content.push({ type: "tool_use", id: b.id, name: b.name, input: b.input });
    }
    return {
      stopReason: response.stop_reason ?? "end_turn",
      content,
      usage: { inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens },
    };
  }
}
