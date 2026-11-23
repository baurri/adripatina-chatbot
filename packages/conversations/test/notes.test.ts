import { describe, expect, it } from "vitest";
import { extractNotes, mergeNotes } from "../src/index.js";

describe("observações livres (falas reais de 23/11/2026)", () => {
  it.each([
    ["Eu tenho que fazer uma reforminha assim, eu tenho que lixar e pintar de azul marinho.", "cor: azul marinho"],
    ["eu vou demorar talvez uns 3, de 3 a 5 dias", "tempo que ele estima: 3 a 5 dias"],
    ["acho que levo umas duas semanas nela", "tempo que ele estima: 2 semanas"],
    ["demoro uns 2 dias", "tempo que ele estima: 2 dias"],
    ["quer em branco fosco", "cor: branco fosco"],
  ])("%s → %s", (text, note) => {
    expect(extractNotes(text)).toContain(note);
  });

  it("outro dono citado junto vira observação (não some)", () => {
    expect(extractNotes("É o móvel do seu Abreu e da dona Isa.", { clientName: "Seu Abreu" })).toContain("também citado: Dona Isa");
    expect(extractNotes("É o móvel do seu Abreu.", { clientName: "Seu Abreu" })).toEqual([]);
  });

  it("não confunde prazo do cliente, nome de gente ou frase comum com observação", () => {
    expect(extractNotes("ela quer pra daqui a 15 dias")).toEqual([]);
    expect(extractNotes("a dona Rosa trouxe a mesa")).toEqual([]);
    expect(extractNotes("está boa, sem consertos")).toEqual([]);
    expect(extractNotes("são 2 horas da tarde")).toEqual([]);
  });

  it("junta sem repetir e atualiza a mesma chave", () => {
    expect(mergeNotes(null, ["cor: azul marinho"])).toBe("cor: azul marinho");
    expect(mergeNotes("cor: azul marinho", ["cor: azul marinho"])).toBeNull();
    expect(mergeNotes("cor: azul", ["cor: verde", "tempo que ele estima: 3 dias"])).toBe("cor: verde; tempo que ele estima: 3 dias");
    expect(mergeNotes("também citado: Dona Isa", ["também citado: Seu João"])).toBe("também citado: Dona Isa, Seu João");
  });
});
