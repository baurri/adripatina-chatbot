import { describe, expect, it } from "vitest";
import { DEMO_SETTINGS, estimateArea } from "../src/index.js";

describe("geometria de cama (perfil bed, fatores NÃO CALIBRADOS)", () => {
  it("queen 1,58 × 1,98: cabeceira + peseira + 2 laterais, frente e verso", () => {
    // um lado: 1,58×1,0 + 1,58×0,45 + 2×(1,98×0,30) = 1,58 + 0,711 + 1,188 = 3,479 → ×2 = 6,958
    expect(estimateArea({ width: "1.58", depth: "1.98", profile: "bed" }, DEMO_SETTINGS)).toEqual({ kind: "exact", m2: "6.958" });
  });

  it("cama não é tratada como caixa (área bem diferente da fórmula de armário)", () => {
    const box = estimateArea({ width: "1.58", height: "1.0", depth: "1.98" }, DEMO_SETTINGS);
    const bed = estimateArea({ width: "1.58", height: "1.0", depth: "1.98", profile: "bed" }, DEMO_SETTINGS);
    expect(bed).not.toEqual(box);
  });

  it("sem largura/comprimento cai no cálculo geral (porte)", () => {
    const r = estimateArea({ sizeClass: "grande", profile: "bed" }, DEMO_SETTINGS);
    expect(r?.kind).toBe("range");
  });
});
