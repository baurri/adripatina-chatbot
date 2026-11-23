import { it } from "vitest";
import { createHarness } from "./harness.js";

it.skipIf(!process.env.EXPLORE)("explora conversa real (pedido com vários móveis)", async () => {
  const h = await createHarness();
  h.clock.now = new Date("2026-11-22T15:00:00Z");
  await h.calibrateAndPrice();
  await h.ctx.db.run("UPDATE materials SET replacement_price_cents = NULL WHERE key = 'verniz'");
  const log = async (label: string, p: Promise<{ text?: string; buttons?: { text: string; data: string }[][] }[]>) => {
    const r = await p;
    console.info(`\n>>> ${label}\n` + r.map((x) => `${x.text}${x.buttons ? `\n   [${x.buttons.flat().map((b) => b.text + "=" + b.data).join(" | ")}]` : ""}`).join("\n"));
    return r;
  };
  await log(
    "pedido",
    h.send("Eu preciso, na terça-feira, pegar um trabalho do seu Roberto e Dona Jo. Uma mesinha de centro para lixar e passar verniz. E outros dois móveis, que seria só o tampo para lixar e envernizar. Eu gostaria de saber quanto eu deveria cobrar isso."),
  );
  await log("isso", h.send("Isso."));
  await log("quais", h.send("Uma cômoda e um aparador."));
  await log("escopo", h.send("Nela inteira, mas o tampo precisa de reparos. Os outros estão melhores."));
  await log("certo", h.send("Certo."));
  await log("grupo", h.send("um para cada cliente"));
  await log("dims1", h.send("45 de altura, 1 metro de largura e 60 de fundura"));
  await log("dims2", h.send("1,20 por 50"));
  await log("dims3", h.send("médio"));
  await log("reparo", h.send("umas 2 horas"));
  await log("metodo", h.send("pincel"));
  await log("material", h.send("vou comprar"));
  await log("logistica", h.send("buscar e entregar"));
  await log("frete", h.send("60 reais"));
  const r = await log("preco", h.send("a lata de 900 ml custa 90 reais"));
  const ok = r.flatMap((x) => x.buttons ?? []).flat().find((b) => b.data.startsWith("mp:ok:"));
  if (ok) await log("confirma", h.click(ok.data));
});
