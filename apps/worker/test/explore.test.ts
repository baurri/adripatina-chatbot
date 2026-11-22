import { it } from "vitest";
import { createHarness } from "./harness.js";

it.skipIf(!process.env.EXPLORE)("explora conversa", async () => {
  const h = await createHarness();
  const log = async (label: string, p: Promise<{ text?: string; buttons?: { text: string; data: string }[][] }[]>) => {
    const r = await p;
    console.info(`\n>>> ${label}\n` + r.map((x) => `${x.text}${x.buttons ? `\n   [${x.buttons.flat().map((b) => b.text + "=" + b.data).join(" | ")}]` : ""}`).join("\n"));
  };
  await log("start", h.send("/start"));
  await log("cristaleira", h.send("Peguei uma cristaleira da dona Maria para fazer pátina"));
  await log("estado", h.click("ans:reparos"));
  await log("medida", h.send("tem uns dois metros"));
  h.advance(1);
  await log("terça", h.send("Tenho aquela cristaleira grande que precisa de pátina."));
  await log("sim", h.click("match:yes"));
  h.advance(1);
  await log("quarta", h.send("A dona Maria quer que eu pinte a cristaleira dela."));
  await log("gasto", h.send("Gastei R$ 90 num verniz"));
});
