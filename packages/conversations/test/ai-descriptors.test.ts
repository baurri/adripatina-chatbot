import { describe, expect, it } from "vitest";
import { cleanAiDescriptors } from "../src/index.js";

describe("descritores vindos da IA (teste real 23/11/2026)", () => {
  it("descarta frase com medida e cliente, mantém característica curta", () => {
    expect(
      cleanAiDescriptors(["cômoda com aproximadamente 1 metro por 80 centímetros", "cliente Carla e seu Abreu", "antiga", "de madeira maciça", "comoda"], "comoda"),
    ).toEqual(["antiga", "de madeira maciça"]);
  });

  it("frase longa demais não é descritor", () => {
    expect(cleanAiDescriptors(["que chegou hoje aqui na oficina pra fazer"])).toEqual([]);
  });
});
