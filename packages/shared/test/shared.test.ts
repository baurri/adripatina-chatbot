import { describe, expect, it } from "vitest";
import {
  Dec,
  allocateCents,
  extractLengths,
  extractMoney,
  formatBRL,
  normalizePersonName,
  reaisToCents,
  canonicalJson,
  timingSafeEqual,
} from "../src/index.js";

describe("Dec", () => {
  it("evita erro binário de ponto flutuante", () => {
    expect(Dec.from("0.1").add("0.2").toString()).toBe("0.3");
  });
  it("arredonda half-up para centavos", () => {
    expect(Dec.from("40.105").toCents()).toBe(4011);
    expect(Dec.from("40.104").toCents()).toBe(4010);
  });
  it("aceita vírgula decimal", () => {
    expect(Dec.parse("1,80").toString()).toBe("1.8");
  });
  it("ceilInt arredonda embalagens para cima", () => {
    expect(Dec.from("1.0001").ceilInt()).toBe(2n);
    expect(Dec.from("2").ceilInt()).toBe(2n);
  });
  it("lança em divisão por zero", () => {
    expect(() => Dec.ONE.div(0)).toThrow();
  });
});

describe("money", () => {
  it("formata BRL", () => {
    expect(formatBRL(123456)).toBe("R$ 1.234,56");
    expect(formatBRL(5)).toBe("R$ 0,05");
  });
  it("converte reais em centavos exatos", () => {
    expect(reaisToCents("90.50")).toBe(9050);
  });
  it("aloca sem perder centavos", () => {
    const parts = allocateCents(10001, [1, 1, 1]);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(10001);
  });
});

describe("números em português", () => {
  it.each([
    ["Gastei R$ 90 num verniz", 9000],
    ["comprei uma lata de tinta por noventa reais", 9000],
    ["A dona Ana pagou duzentos reais", 20000],
    ["recebi 1.250,50 reais", 125050],
    ["mil e quinhentos reais", 150000],
    ["paguei duzentos e cinquenta reais e cinquenta centavos", 25050],
  ])("%s", (text, cents) => {
    expect(extractMoney(text)?.cents).toBe(cents);
  });

  it("extrai medidas", () => {
    expect(extractLengths("tem uns 2 metros")[0]?.meters.toString()).toBe("2");
    expect(extractLengths("mede 1,80 m de altura")[0]?.meters.toString()).toBe("1.8");
    expect(extractLengths("180 cm")[0]?.meters.toString()).toBe("1.8");
    expect(extractLengths("um metro e oitenta")[0]?.meters.toString()).toBe("1.8");
    expect(extractLengths("dois metros")[0]?.meters.toString()).toBe("2");
  });
});

describe("texto", () => {
  it("remove pronome de tratamento", () => {
    expect(normalizePersonName("Dona Maria")).toBe("maria");
    expect(normalizePersonName("seu João")).toBe("joao");
  });
  it("json canônico ordena chaves", () => {
    expect(canonicalJson({ b: 1, a: { d: 2, c: 3 } })).toBe('{"a":{"c":3,"d":2},"b":1}');
  });
  it("comparação em tempo constante", () => {
    expect(timingSafeEqual("abc", "abc")).toBe(true);
    expect(timingSafeEqual("abc", "abd")).toBe(false);
    expect(timingSafeEqual("abc", "abcd")).toBe(false);
  });
});
