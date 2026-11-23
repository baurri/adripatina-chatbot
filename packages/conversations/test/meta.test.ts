import { describe, expect, it } from "vitest";
import { detectMeta } from "../src/index.js";

describe("falas fora do roteiro (teste real 23/11/2026)", () => {
  it.each([
    ["quero começar de novo", "restart"],
    ["vamos recomeçar", "restart"],
    ["começar do zero", "restart"],
    ["e ai, vc ta bem?", "small_talk"],
    ["tudo bem?", "small_talk"],
    ["Oi, tudo bom?", "small_talk"],
    ["obrigado", "thanks"],
    ["valeu viu", "thanks"],
    ["testando o áudio", "audio_test"],
  ])("%s → %s", (text, kind) => {
    expect(detectMeta(text)).toBe(kind);
  });

  it("teste de áudio por voz", () => {
    expect(detectMeta("Oi, eu queria testar o envio de áudio, será que está funcionando direitinho?", { voice: true })).toBe("audio_test");
  });

  it.each([
    "testando, testando",
    "tá me ouvindo?",
    "o áudio tá chegando?",
  ])("teste de áudio curto por voz: %s", (text) => {
    expect(detectMeta(text, { voice: true })).toBe("audio_test");
  });

  // teste real 23/11/2026: pedido por voz virou "teste de áudio" por causa do "chegou"
  it.each([
    "Chegou uma cômoda da Dona Marta pra patinar de branco, uns 80 por 1 metro",
    "chegou aqui uma mesa do seu Roberto",
    "a cadeira já chegou, tá funcionando a gaveta",
    "tá chegando um armário amanhã",
  ])("pedido por voz não é teste de áudio: %s", (text) => {
    expect(detectMeta(text, { voice: true })).toBeNull();
  });

  it.each([
    "peguei uma cômoda da dona Ana para começar amanhã",
    "tá bem estragado",
    "está boa",
    "bom",
    "não",
    "tudo",
    "a tinta está funcionando bem",
    "pincel e rolo",
  ])("não é fora do roteiro: %s", (text) => {
    expect(detectMeta(text)).toBeNull();
  });
});
