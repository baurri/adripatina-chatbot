import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "vitest";
import { ClaudeAgentModel } from "../../src/ai/claude-agent.js";
import { createHarness } from "../harness.js";

/** Teste manual com o Claude real e uma foto: PHOTO_SMOKE=<caminho.jpg> npx vitest run test/eval/photo-smoke.test.ts */
const here = dirname(fileURLToPath(import.meta.url));
const IMG = process.env.PHOTO_SMOKE;
function key(): string | null {
  try {
    return /^ANTHROPIC_API_KEY=(.+)$/m.exec(readFileSync(join(here, "../../../../.dev.vars"), "utf8"))?.[1]?.trim() ?? null;
  } catch {
    return null;
  }
}

describe.skipIf(!IMG || !key())("foto com Claude real", () => {
  it("conversa com foto", async () => {
    const h = await createHarness();
    await h.calibrateAndPrice();
    h.ctx.ai.agent = new ClaudeAgentModel(key()!, "claude-haiku-5-5", { timeoutMs: 60000 });
    const turns: [string, () => Promise<unknown>][] = [
      ["(foto)", () => h.photo(new Uint8Array(readFileSync(IMG!)))],
      ["isso, é da dona Carla, quer patinar", () => h.send("isso, é da dona Carla, quer patinar")],
    ];
    for (const [label, run] of turns) {
      h.telegram.clear();
      await run();
      console.info(`\n>>> ADRIANO: ${label}\n<<< BOT: ${h.telegram.sent.map((s) => s.text).join("\n---\n")}`);
    }
    const att = await h.ctx.db.first<{ job_id: string | null }>("SELECT job_id FROM attachments");
    const jobs = await h.ctx.db.all<{ facts_json: string }>("SELECT facts_json FROM jobs");
    console.info("\nfoto ligada a serviço:", Boolean(att?.job_id), "\nserviços:", jobs.map((j) => j.facts_json.slice(0, 400)));
  }, 180000);
});
