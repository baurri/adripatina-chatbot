import { describe, expect, it } from "vitest";
import {
  BED_SIZES,
  detectBedSize,
  detectJoinedClients,
  extractClientNames,
  extractQuoteRequest,
  furnitureHasInterior,
  isQuestionToBot,
  parseAnswer,
  parseClientsRelation,
  validateAiAnswer,
  validateRephrase,
} from "../src/index.js";

const NOW = new Date("2026-11-22T15:00:00Z");

describe("cama e perfis de móvel", () => {
  it("reconhece o tamanho da cama, com prioridade para o mais específico", () => {
    expect(detectBedSize("cama de casal queen")).toBe("queen");
    expect(detectBedSize("uma cama king")).toBe("king");
    expect(detectBedSize("cama de casal")).toBe("casal");
    expect(detectBedSize("cama de solteiro")).toBe("solteiro");
    expect(detectBedSize("uma mesa")).toBeNull();
    expect(BED_SIZES.queen).toMatchObject({ width: "1.58", length: "1.98" });
  });

  it("só pergunta 'por dentro' para móveis que têm parte interna", () => {
    expect(furnitureHasInterior("guarda_roupa")).toBe(true);
    expect(furnitureHasInterior("cama")).toBe(false);
    expect(furnitureHasInterior("mesa")).toBe(false);
  });
});

describe("respostas", () => {
  it("pergunta do artesão ao bot não é resposta", () => {
    expect(isQuestionToBot("pra que você precisa saber isso?")).toBe(true);
    expect(isQuestionToBot("está boa")).toBe(false);
  });

  it("logística parcial: cliente traz / cliente busca", () => {
    expect(parseAnswer("logistics", "ela vai deixar a cama na minha casa")).toMatchObject({ kind: "partial", known: { pickup: false } });
    expect(parseAnswer("logistics", "ela mesma busca")).toMatchObject({ kind: "partial", known: { delivery: false } });
  });

  it("estado da peça não aceita texto qualquer", () => {
    expect(parseAnswer("condition", "hmm deixa eu ver aqui").kind).toBe("unparsed");
    expect(parseAnswer("condition", "precisa de pátina").kind).toBe("unparsed");
    expect(parseAnswer("condition", "bem estragada")).toMatchObject({ kind: "value", value: "danificado" });
  });

  it("pagamento reconhecido mesmo quando dito na pergunta do prazo", () => {
    expect(parseAnswer("payment_terms", "entrada agora metade na entrega")).toMatchObject({ kind: "value", value: "entrada e restante na entrega", strength: "specific" });
  });
});

describe("IA: slot-filling e reescrita validados", () => {
  it("só aceita valores da lista do campo e nunca dinheiro", () => {
    expect(validateAiAnswer("condition", { kind: "value", value: "danificado" })).toMatchObject({ kind: "value", value: "danificado" });
    expect(validateAiAnswer("condition", { kind: "value", value: "R$ 999" })).toBeNull();
    expect(validateAiAnswer("application_method", { kind: "value", value: "spray mágico" })).toBeNull();
    expect(validateAiAnswer("condition", "lixo")).toBeNull();
    expect(validateAiAnswer("condition", { kind: "dont_know" })).toEqual({ kind: "dont_know" });
  });

  it("reescrita não pode mudar números, inventar preço, perder a pergunta ou o nome", () => {
    const base = "E como está a cama da Dona Licele hoje? Tá boa ou precisa de reparos?";
    expect(validateRephrase(base, "Me conta: a cama da Dona Licele tá inteira ou precisa de uns reparos?")).toBeTruthy();
    expect(validateRephrase(base, "A cama da Dona Licele custa R$ 500?")).toBeNull();
    expect(validateRephrase(base, "A cama tá boa ou precisa de reparos?")).toBeNull(); // perdeu o nome
    expect(validateRephrase(base, "A cama da Dona Licele está boa.")).toBeNull(); // perdeu a pergunta
    expect(validateRephrase(base, 42)).toBeNull();
  });
});

describe("casal ou dois clientes", () => {
  it("nomes juntos com 'e' pedem esclarecimento; nomes em orações separadas não", () => {
    const joined = extractQuoteRequest("Seu Roberto e Dona Jo trouxeram uma mesa para envernizar", NOW);
    expect(joined.clients.map((c) => c.name)).toEqual(["Seu Roberto", "Dona Jo"]);
    expect(joined.ambiguities).toContain("clients_relation");
    const apart = extractQuoteRequest("uma mesa do Seu Roberto e uma cômoda da Dona Jo para envernizar", NOW);
    expect(apart.clientsJoined).toBeNull();
    expect(detectJoinedClients("o seu roberto e a dona jo", [{ ref: "c1", rawName: "x", name: "Seu Roberto", confidence: 1 }, { ref: "c2", rawName: "y", name: "Dona Jo", confidence: 1 }])).toEqual(["c1", "c2"]);
  });

  it("entende a resposta", () => {
    expect(parseClientsRelation("é um casal")).toBe("couple");
    expect(parseClientsRelation("marido e mulher, um cliente só")).toBe("couple");
    expect(parseClientsRelation("são dois clientes")).toBe("separate");
    expect(parseClientsRelation("separados")).toBe("separate");
    expect(parseClientsRelation("talvez")).toBeNull();
  });

  it("verbo depois do nome não vira sobrenome", () => {
    expect(extractClientNames("Seu Roberto e Dona Jo trouxeram duas peças")).toEqual(["Seu Roberto", "Dona Jo"]);
    expect(extractClientNames("a Dona Maria Clara pediu")).toEqual(["Dona Maria Clara"]);
  });
});
