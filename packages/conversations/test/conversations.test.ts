import { describe, expect, it } from "vitest";
import {
  decideMatch,
  interpretRules,
  parseAnswer,
  sanitizeAiExtraction,
  mergeNlu,
  type CandidateProject,
} from "../src/index.js";

const NOW = new Date("2026-11-22T12:00:00Z");

describe("intérprete por regras", () => {
  it("mensagem espontânea de novo serviço", () => {
    const r = interpretRules("Peguei uma cristaleira antiga para fazer pátina");
    expect(r.intent).toBe("new_job");
    expect(r.entities.furnitureType).toBe("cristaleira");
    expect(r.entities.techniques).toEqual(["patina"]);
    expect(r.entities.descriptors).toContain("antiga");
  });
  it("guarda-roupa de três portas", () => {
    const r = interpretRules("Vou pintar um guarda-roupa de três portas");
    expect(r.intent).toBe("new_job");
    expect(r.entities.furnitureType).toBe("guarda_roupa");
    expect(r.entities.doors).toBe(3);
    expect(r.entities.techniques).toContain("pintura_lisa");
  });
  it("despesa", () => {
    const r = interpretRules("Gastei R$ 90 num verniz");
    expect(r.intent).toBe("register_expense");
    expect(r.entities.amountCents).toBe(9000);
    expect(r.entities.materialMention).toBe("verniz");
  });
  it("pagamento com cliente", () => {
    const r = interpretRules("Recebi R$ 200 da dona Maria");
    expect(r.intent).toBe("register_payment");
    expect(r.entities.amountCents).toBe(20000);
    expect(r.entities.clientName).toBe("Dona Maria");
  });
  it("pagamento por extenso", () => {
    const r = interpretRules("A dona Ana pagou duzentos reais");
    expect(r.intent).toBe("register_payment");
    expect(r.entities.clientName).toBe("Dona Ana");
    expect(r.entities.amountCents).toBe(20000);
  });
  it("'já tenho tinta sobrando' marca estoque, não preço", () => {
    const r = interpretRules("Já tenho tinta sobrando");
    expect(r.entities.materialStatus).toBe("tem_tudo");
    expect(r.entities.amountCents).toBeUndefined();
  });
  it("mensagem ambígua tem baixa confiança", () => {
    const r = interpretRules("hmm deixa eu ver aqui");
    expect(r.intent).toBe("unknown");
    expect(r.confidence).toBeLessThan(0.5);
  });
  it("'outra cristaleira' indica explicitamente móvel novo", () => {
    expect(interpretRules("peguei outra cristaleira da dona Maria").entities.explicitNew).toBe(true);
  });
});

describe("respostas a perguntas", () => {
  it("'não sei' fica pendente, não vira zero", () => {
    expect(parseAnswer("dimensions", "não sei")).toEqual({ kind: "dont_know" });
  });
  it("medidas rotuladas", () => {
    const r = parseAnswer("dimensions", "1,80 de altura, 1 metro de largura e 40 de fundura");
    expect(r).toMatchObject({ kind: "value", field: "dimensions", value: { height: "1.8", width: "1", depth: "0.4" } });
  });
  it("porte", () => {
    expect(parseAnswer("dimensions", "grande")).toMatchObject({ kind: "value", field: "size_class", value: "grande" });
  });
  it("material", () => {
    expect(parseAnswer("material_status", "já tenho")).toMatchObject({ value: "tem_tudo" });
  });
  it("nome do cliente", () => {
    expect(parseAnswer("client_name", "é da dona Maria")).toMatchObject({ value: "Dona Maria" });
    expect(parseAnswer("client_name", "Joana Silva")).toMatchObject({ value: "Joana Silva" });
  });
});

const cristaleiraMaria: CandidateProject = {
  jobId: "j1",
  code: "S-0001",
  clientName: "Dona Maria",
  clientAliases: [],
  furnitureType: "cristaleira",
  descriptors: ["antiga"],
  techniques: ["patina"],
  photoHashes: [],
  status: "ORCAMENTO",
  createdAt: "2026-11-16T12:00:00Z",
  lastInteractionAt: "2026-11-16T12:00:00Z",
  text: "Peguei uma cristaleira da dona Maria para fazer pátina",
};

function mention(text: string) {
  const r = interpretRules(text);
  return {
    text,
    furnitureType: r.entities.furnitureType,
    clientName: r.entities.clientName,
    techniques: r.entities.techniques,
    descriptors: r.entities.descriptors,
    explicitNew: r.entities.explicitNew,
    referencesExisting: r.entities.referencesExisting,
  };
}

describe("deduplicação semântica", () => {
  it("terça: 'aquela cristaleira grande que precisa de pátina' → pergunta se é a mesma", () => {
    const d = decideMatch(mention("Tenho aquela cristaleira grande que precisa de pátina."), [cristaleiraMaria], NOW);
    expect(d.kind).toBe("confirm_single");
  });
  it("quarta: 'a dona Maria quer que eu pinte a cristaleira dela' → correspondência forte", () => {
    const d = decideMatch(mention("A dona Maria quer que eu pinte a cristaleira dela."), [cristaleiraMaria], NOW);
    expect(d).toMatchObject({ kind: "confirm_single", strength: "forte" });
  });
  it("móvel diferente do mesmo cliente não é associado", () => {
    const d = decideMatch(mention("Peguei uma cadeira da dona Maria"), [cristaleiraMaria], NOW);
    expect(d.kind).toBe("none");
  });
  it("mesmo móvel de cliente diferente não é associado", () => {
    const d = decideMatch(mention("Peguei uma cristaleira do seu João"), [cristaleiraMaria], NOW);
    expect(d.kind).toBe("none");
  });
  it("duas cristaleiras da mesma cliente → pergunta qual", () => {
    const outra: CandidateProject = { ...cristaleiraMaria, jobId: "j2", code: "S-0002", descriptors: ["branca"], text: "cristaleira branca da dona Maria" };
    const d = decideMatch(mention("A dona Maria quer pátina na cristaleira"), [cristaleiraMaria, outra], NOW);
    expect(d.kind).toBe("choose_among");
  });
  it("'outra cristaleira' pede confirmação de que é novo", () => {
    const d = decideMatch(mention("Peguei outra cristaleira da dona Maria"), [cristaleiraMaria], NOW);
    expect(d.kind).toBe("confirm_new_despite_similar");
  });
});

describe("IA nunca define valores", () => {
  it("descarta campos de preço vindos da IA", () => {
    const r = sanitizeAiExtraction({ intent: "new_job", confidence: 0.9, furnitureType: "cristaleira", precoSugerido: 999, totalPrice: 5 });
    expect(r).not.toBeNull();
    expect(JSON.stringify(r)).not.toMatch(/999|totalPrice|preco/i);
  });
  it("rejeita vocabulário fora do catálogo", () => {
    const r = sanitizeAiExtraction({ intent: "new_job", confidence: 0.9, furnitureType: "nave espacial", techniques: ["patina", "hack"] });
    expect(r?.furnitureType).toBeNull();
    expect(r?.techniques).toEqual(["patina"]);
  });
  it("merge preserva extração literal de dinheiro das regras", () => {
    const rules = interpretRules("gastei 90 reais");
    const merged = mergeNlu(rules, { intent: "register_expense", confidence: 0.9, amountMentionedReais: 900 });
    expect(merged.entities.amountCents).toBe(9000);
  });
});
