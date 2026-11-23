import { describe, expect, it } from "vitest";
import { extractDateMention, extractLooseMoney, extractMoney, parseBareAmountCents } from "../src/index.js";

/** Rodada de validação 22/11/2026 — valores e datas como o Adriano fala/escreve. */
describe("dinheiro pt-BR (regressão)", () => {
  it("ponto decimal nunca vira separador de milhar nem pedaço de número", () => {
    // antes: "1000.50 reais" → R$ 50,00 (pegava só o "50")
    expect(extractMoney("me pagou 1000.50 reais")?.cents).toBe(100050);
    expect(extractMoney("R$ 1000.50")?.cents).toBe(100050);
    expect(extractMoney("R$ 1.000,50")?.cents).toBe(100050);
    expect(extractMoney("1.000 reais")?.cents).toBe(100000);
    expect(extractMoney("85,90 reais")?.cents).toBe(8590);
    expect(extractMoney("85 reais")?.cents).toBe(8500);
  });

  it("valor solto ('1.000' era lido como R$ 1 pelo parser antigo em ponto flutuante)", () => {
    expect(parseBareAmountCents("1.000")).toBe(100000);
    expect(parseBareAmountCents("uns 85,90")).toBe(8590);
    expect(parseBareAmountCents("1000.50")).toBe(100050);
    expect(parseBareAmountCents("nada")).toBeNull();
  });

  it("valor sem 'reais' só depois de verbo de dinheiro, ignorando quantidade e tamanho", () => {
    expect(extractLooseMoney("comprei duas latas por 150")?.cents).toBe(15000);
    expect(extractLooseMoney("me pagou 85,90")?.cents).toBe(8590);
    expect(extractLooseMoney("comprei 2 latas de 900 ml")).toBeNull();
    expect(extractLooseMoney("foi 3 litros")).toBeNull();
    expect(extractLooseMoney("peguei duas cadeiras")).toBeNull();
  });
});

describe("datas (regressão)", () => {
  const sunday = new Date("2026-11-22T15:00:00Z"); // domingo 22/11/2026, 12h em SP

  it("dia N e DD/MM", () => {
    expect(extractDateMention("entrego dia 5", sunday)).toMatchObject({ isoDate: "2026-12-05", ambiguous: true });
    expect(extractDateMention("entrego dia 28", sunday)).toMatchObject({ isoDate: "2026-11-28", ambiguous: false });
    expect(extractDateMention("entrego 05/12", sunday)).toMatchObject({ isoDate: "2026-12-05", ambiguous: false });
    expect(extractDateMention("entrego 5/12/2026", sunday)).toMatchObject({ isoDate: "2026-12-05" });
  });

  it("data passada é ambígua; data inexistente é ignorada", () => {
    expect(extractDateMention("foi 10/11", sunday)).toMatchObject({ isoDate: "2027-11-10", ambiguous: true });
    expect(extractDateMention("dia 31/02", sunday)).toBeNull();
  });

  it("'terça que vem' dito no domingo fica marcado para confirmar", () => {
    expect(extractDateMention("pego terça que vem", sunday)).toMatchObject({ ambiguous: true });
    expect(extractDateMention("pego terça", sunday)).toMatchObject({ isoDate: "2026-11-24", ambiguous: false });
  });
});
