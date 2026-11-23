import { describe, expect, it } from "vitest";
import { Dec } from "@adripatina/shared";
import { estimateArea, scaleArea } from "../src/index.js";
import { settings } from "./fixtures.js";

/**
 * Rodada de validação 22/11/2026. Cada valor esperado é calculado À MÃO aqui
 * (fórmula independente), não copiado do resultado do motor.
 */
describe("geometria — regressão", () => {
  it("várias peças iguais: área × quantidade (exata e faixa)", () => {
    expect(scaleArea({ kind: "exact", m2: "1.25" }, 3)).toEqual({ kind: "exact", m2: "3.75" });
    expect(scaleArea({ kind: "range", minM2: "0.5", maxM2: "1", source: "x" }, 2)).toMatchObject({ minM2: "1", maxM2: "2" });
    expect(() => scaleArea({ kind: "exact", m2: "1" }, 0)).toThrow();
    expect(() => scaleArea({ kind: "exact", m2: "1" }, 1.5)).toThrow();
  });

  it("cama queen só com o tamanho padrão: faixa (nunca exata), do colchão até colchão + margem", () => {
    const a = estimateArea({ profile: "bed", nominalBed: { width: "1.58", length: "1.98", label: "queen" } }, settings);
    expect(a?.kind).toBe("range");
    // fórmula independente: um lado = L×1,0 + L×0,45 + 2×(C×0,30); frente e verso ×2
    const side = (w: number, l: number) => w * 1.0 + w * 0.45 + 2 * (l * 0.3);
    const min = 2 * side(1.58, 1.98);
    const max = 2 * side(1.78, 2.18);
    if (a?.kind !== "range") throw new Error("esperado faixa");
    expect(Number(a.minM2)).toBeCloseTo(min, 3);
    expect(Number(a.maxM2)).toBeCloseTo(max, 3);
    expect(a.source).toMatch(/referencia_colchao_queen_nao_calibrado/);
  });

  it("só a cabeceira: largura × 1,0 × 2 lados", () => {
    const a = estimateArea({ profile: "bed", part: "cabeceira", width: "1.70" }, settings);
    expect(a).toEqual({ kind: "exact", m2: Dec.from("1.70").mul("2").round(3).toString() });
  });

  it("medida da estrutura dita vence a referência do colchão", () => {
    const a = estimateArea({ profile: "bed", width: "1.70", depth: "2.10", nominalBed: { width: "1.58", length: "1.98", label: "queen" } }, settings);
    expect(a?.kind).toBe("exact");
  });
});
