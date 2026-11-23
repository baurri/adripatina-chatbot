import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "vitest";
import { ClaudeAgentModel } from "../../src/ai/claude-agent.js";
import { createHarness } from "../harness.js";

/**
 * Conversa roteirizada com o Claude real (reproduz o teste do Telegram de 23/11/2026, mesa da Dona Edileuza).
 * Uso: CHAT_SMOKE=1 npx vitest run test/eval/chat-smoke.test.ts
 */
const here = dirname(fileURLToPath(import.meta.url));
function key(): string | null {
  try {
    return /^ANTHROPIC_API_KEY=(.+)$/m.exec(readFileSync(join(here, "../../../../.dev.vars"), "utf8"))?.[1]?.trim() ?? null;
  } catch {
    return null;
  }
}

const TURNS = [
  "Oi, amanhã eu tenho um serviço para pegar lá na casa da dona Edileuza e do seu Crayson, uma mesa de centro e outros dois móveis, é para lixar e fazer uns ajustes e pintar.",
  "É uma mesa de centro média",
  "só passar massa",
  "fora",
  "nao sei ainda",
  "nada disso",
  "eles trazem e buscam",
  "10 reais o pacote com 10 folhas",
  "100 reais 5 litros",
  "50 reais 2 litros",
  "500 ml 15 reais de thinner",
  "dá um desconto de 59 reais",
  "isso",
  "consigo começar daqui a 2 meses",
];

describe.skipIf(!process.env.CHAT_SMOKE || !key())("conversa com Claude real", () => {
  it("mesa da Dona Edileuza", async () => {
    const h = await createHarness();
    await h.calibrateAndPrice();
    await h.ctx.db.run("UPDATE material_prices SET deleted_at = '2026-01-01' WHERE 1=1").catch(() => undefined);
    h.ctx.ai.agent = new ClaudeAgentModel(key()!, "claude-haiku-5-5", { timeoutMs: 60000 });
    for (const text of TURNS.slice(0, Number(process.env.CHAT_TURNS ?? TURNS.length))) {
      h.telegram.clear();
      await h.send(text);
      const out = h.telegram.sent.map((s) => (s.kind === "document" ? "[PDF]" : s.text)).join("\n---\n");
      console.log(`\n>>> ${text}\n<<< ${out}`);
    }
    const jobs = await h.ctx.db.all<{ facts_json: string }>("SELECT facts_json FROM jobs");
    for (const j of jobs) {
      const f = JSON.parse(j.facts_json) as Record<string, { value: unknown }>;
      console.log("\nFATOS:", JSON.stringify(Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v?.value]))));
    }
    const q = await h.ctx.db.first<{ status: string }>("SELECT status FROM quotes ORDER BY updated_at DESC");
    console.log("orçamento:", q?.status);
  }, 600000);
});
