import { describe, expect, it } from "vitest";
import { clientHandlesTransport, detectProgress, extractClientName, extractNotes, interpretRules, parseAnswer } from "../src/index.js";

describe("teste real 23/11/2026 (tarde): frases que o bot não entendia", () => {
  it.each([
    ["ele vai trazer e buscar qdo estover peonta", { pickup: false, delivery: false }],
    ["cliente deixa comigo e depois de pronto ele busca", { pickup: false, delivery: false }],
    ["a dona Carla traz e leva de volta", { pickup: false, delivery: false }],
  ])("logística pelo cliente: %s", (text, expected) => {
    const a = parseAnswer("logistics", text);
    expect(a.kind).toBe("value");
    expect((a as { value: unknown }).value).toEqual(expected);
  });

  it("'cliente traz' é resposta parcial (falta saber quem leva de volta)", () => {
    expect(clientHandlesTransport("cliente traz")).toEqual({ pickup: false });
    expect(parseAnswer("logistics", "cliente traz").kind).toBe("partial");
  });

  it("quem fala em 1ª pessoa continua sendo o artesão", () => {
    expect(clientHandlesTransport("eu vou buscar e ele pega depois")).toEqual({});
    expect((parseAnswer("logistics", "eu busco e entrego") as { value: unknown }).value).toEqual({ pickup: true, delivery: true });
  });

  it("'depois de pronto' não é andamento do serviço", () => {
    expect(detectProgress("cliente deixa comigo e depois de pronto ele busca")).toBeUndefined();
    expect(detectProgress("quando ficar pronta eu aviso")).toBeUndefined();
    expect(detectProgress("ficou pronta a cômoda")).toBe("concluido");
  });

  it("'cliente deixa comigo' não vira cliente chamado 'Deixa Comigo'", () => {
    expect(extractClientName("cliente deixa comigo e depois de pronto ele busca")).toBeUndefined();
    expect(extractClientName("cliente Ana")).toBe("Ana");
  });

  it("gavetão e ferramenta extra viram observação", () => {
    expect(extractNotes("4 gavetas e 1 gavetão")).toContain("inclui 1 gavetão");
    expect(extractNotes("vou aplicar com pincel e estilete pra raspar")).toContain("também vai usar: estilete pra raspar");
  });

  it("método negado não conta: 'não é pincel, é rolo'", () => {
    expect(interpretRules("errei, não é pincel, é rolo").entities.method).toBe("rolo");
    expect(interpretRules("muda pra rolo").intent).toBe("correction");
  });

  it("'até que tá boazinha' é estado bom", () => {
    expect((parseAnswer("condition", "até que tá boazinha") as { value: unknown }).value).toBe("bom");
  });
});
