import { describe, expect, it } from "vitest";
import { api } from "./helpers.js";
import { count, createHarness } from "./harness.js";

describe("Aprendizado curioso e histórico administrativo", () => {
  it("pergunta preço e embalagem, registra a compra e atualiza o preço de reposição", async () => {
    const h = await createHarness();
    const first = await h.send("Comprei verniz");
    expect(h.allText(first)).toMatch(/Quanto foi o verniz/);
    const price = await h.send("90 reais");
    expect(h.allText(price)).toMatch(/quantas embalagens.*tamanho/s);
    const pack = await h.send("1 lata de 900 ml");
    expect(h.allText(pack)).toMatch(/estoque geral/);
    const done = await h.click("exp:confirm");
    expect(h.allText(done)).toMatch(/atualizei o preço de reposição/);

    const material = await h.ctx.db.first<{ package_size: string; replacement_price_cents: number; origin: string }>(
      "SELECT package_size, replacement_price_cents, origin FROM materials WHERE key = 'verniz'",
    );
    expect(material).toEqual({ package_size: "0.9", replacement_price_cents: 9000, origin: "telegram_confirmed" });
    expect(await count(h, "SELECT COUNT(*) AS n FROM learning_observations WHERE kind = 'MATERIAL_PURCHASE' AND entity_key = 'verniz' AND status = 'APLICADO'")).toBe(1);
  });

  it("pergunta explicitamente sobre estoque dos materiais da técnica e guarda a evidência", async () => {
    const h = await createHarness();
    await h.send("Peguei uma mesa da dona Ana para envernizar");
    await h.send("está boa");
    await h.send("1 metro de largura e 80 cm de altura");
    await h.send("só por fora");
    await h.send("não");
    const sourceQuestion = await h.send("não");
    expect(h.allText(sourceQuestion)).toMatch(/verniz.*estoque|estoque.*verniz/s);
    await h.send("vou precisar comprar o verniz");
    expect(await count(h, "SELECT COUNT(*) AS n FROM learning_observations WHERE kind = 'MATERIAL_SOURCE' AND entity_key = 'verniz'")).toBe(1);
  });

  it("expõe conversa e aprendizado somente pela API administrativa autenticada", async () => {
    const h = await createHarness();
    await h.send("oi");
    const history = await api(h, "GET", "/conversations?limit=20");
    expect(history.status).toBe(200);
    expect((history.json!.rows as unknown[]).length).toBeGreaterThan(0);
    expect((await api(h, "GET", "/conversations?limit=20", undefined, "")).status).toBe(401);
    expect((await api(h, "GET", "/learning-observations", undefined, "")).status).toBe(401);
  });
});
