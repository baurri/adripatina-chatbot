import { describe, expect, it } from "vitest";
import {
  assertJobTransition,
  assertQuoteTransition,
  canTransitionQuote,
  deriveFinancialStatus,
  hasPermission,
  nextQuestion,
  factValuesEqual,
  type FactSet,
} from "../src/index.js";

describe("transições", () => {
  it("permite fluxo feliz do orçamento", () => {
    const path = ["RASCUNHO", "ESTIMATIVA", "AGUARDANDO_REVISAO", "APROVADO", "ENVIADO", "ACEITO"] as const;
    for (let i = 0; i < path.length - 1; i++) expect(canTransitionQuote(path[i]!, path[i + 1]!)).toBe(true);
  });
  it("bloqueia salto de rascunho para enviado", () => {
    expect(() => assertQuoteTransition("RASCUNHO", "ENVIADO")).toThrow();
  });
  it("serviço entregue não volta", () => {
    expect(() => assertJobTransition("ENTREGUE", "EM_EXECUCAO")).toThrow();
  });
});

describe("financeiro derivado", () => {
  it("calcula status", () => {
    expect(deriveFinancialStatus(null, 0)).toBe("SEM_COBRANCA");
    expect(deriveFinancialStatus(10000, 0)).toBe("EM_ABERTO");
    expect(deriveFinancialStatus(10000, 5000)).toBe("PARCIAL");
    expect(deriveFinancialStatus(10000, 10000)).toBe("QUITADO");
  });
});

describe("permissões", () => {
  it("artesão não aprova abaixo do piso", () => {
    expect(hasPermission("ARTESAO", "quotes:approve_below_floor")).toBe(false);
    expect(hasPermission("ADMIN", "quotes:approve_below_floor")).toBe(true);
  });
});

describe("perguntas", () => {
  it("não repete pergunta já respondida, inclusive 'não sei'", () => {
    const now = new Date().toISOString();
    const facts: FactSet = {
      furniture_type: { field: "furniture_type", value: { type: "cristaleira" }, status: "confirmed", source: "telegram_text", updatedAt: now },
      techniques: { field: "techniques", value: ["patina"], status: "confirmed", source: "telegram_text", updatedAt: now },
      client_name: { field: "client_name", value: null, status: "unknown", source: "telegram_text", updatedAt: now },
    };
    expect(nextQuestion(facts)).toBe("condition");
  });
  it("compara valores ignorando ordem e caixa", () => {
    expect(factValuesEqual(["patina", "verniz"], ["Verniz", "patina"])).toBe(true);
  });
});
