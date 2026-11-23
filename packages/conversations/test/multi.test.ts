import { describe, expect, it } from "vitest";
import { isoToBR, extractDateMention } from "@adripatina/shared";
import {
  detectConditionStatement,
  detectProgress,
  extractQuoteRequest,
  interpretRules,
  isMultiItemRequest,
  mergeAiQuoteRequest,
  mergeNlu,
  packageSizeLabel,
  parseFurnitureList,
  parseGrouping,
  parseItemStatements,
  parsePriceAnswer,
  pricePerPackageCents,
} from "../src/index.js";

const REAL =
  "Eu preciso, na terça-feira, pegar um trabalho do seu Roberto e Dona Jo. Uma mesinha de centro para lixar e passar verniz. E outros dois móveis, que seria só o tampo para lixar e envernizar. Eu gostaria de saber quanto eu deveria cobrar isso.";
const REPLY = "Um deles a mesinha de centro está com o tampo precisando de reparos os outros estão melhores";
const SUNDAY = new Date("2026-11-22T15:00:00Z"); // domingo em São Paulo

describe("Ajuste 2 — extração de pedido com vários móveis e clientes", () => {
  const d = extractQuoteRequest(REAL, SUNDAY);

  it("1/2. extrai os dois clientes", () => {
    expect(d.clients.map((c) => c.name)).toEqual(["Seu Roberto", "Dona Jo"]);
  });
  it("3/4. três móveis: a mesinha e o grupo 'outros dois' sem tipo", () => {
    expect(d.items).toHaveLength(2);
    expect(d.items.reduce((a, i) => a + i.quantity, 0)).toBe(3);
    expect(d.items[0]).toMatchObject({ description: "mesinha de centro", furnitureType: "mesa", quantity: 1, generic: false });
    expect(d.items[1]).toMatchObject({ quantity: 2, generic: true, furnitureType: null });
    expect(isMultiItemRequest(d)).toBe(true);
  });
  it("5. preserva os serviços lixar e envernizar em todos os itens", () => {
    for (const it of d.items) expect(it.services).toEqual(["lixar", "envernizar"]);
    expect(d.items[0]!.techniqueKeys).toEqual(["verniz"]);
  });
  it("6. preserva o escopo 'somente o tampo' nos outros dois", () => {
    expect(d.items[1]!.affectedPart).toBe("tampo");
    expect(d.items[0]!.affectedPart).toBeNull(); // ainda ambíguo: perguntar
  });
  it("7. identifica o objetivo 'quanto cobrar'", () => {
    expect(d.wantsPrice).toBe(true);
  });
  it("8/36. terça-feira vira data absoluta no fuso de São Paulo, exibida DD/MM/AAAA", () => {
    expect(d.date).toMatchObject({ isoDate: "2026-11-24", ambiguous: false });
    expect(isoToBR(d.date!.isoDate)).toBe("24/11/2026");
    // numa terça, "terça" é ambíguo (hoje ou semana que vem)
    expect(extractDateMention("na terça", new Date("2026-11-24T15:00:00Z"))).toMatchObject({ ambiguous: true, isoDate: "2026-12-01" });
  });
  it("9/31. cria ambiguidades em vez de inventar quem é dono de cada peça", () => {
    expect(d.items.every((i) => i.ownerRef === null)).toBe(true);
    expect(d.ambiguities).toEqual(expect.arrayContaining(["item_owner_mapping", "other_furniture_types", "quote_grouping"]));
  });
  it("preserva o trecho de origem de cada item (auditoria)", () => {
    expect(d.items[1]!.sourceExcerpt).toMatch(/so o tampo/);
  });
  it("um cliente só: todas as peças ficam com ele, sem pergunta", () => {
    const one = extractQuoteRequest("Peguei duas cadeiras da dona Ana para pintar", SUNDAY);
    expect(one.items[0]).toMatchObject({ quantity: 2, furnitureType: "cadeira", ownerRef: "c1", ownerConfirmed: true });
    expect(one.ambiguities).not.toContain("item_owner_mapping");
  });
});

describe("Ajuste 2 — condição física x andamento do serviço", () => {
  it("12/13. 'precisando de reparos' é condição, não job_progress", () => {
    const r = interpretRules(REPLY);
    expect(r.intent).not.toBe("job_progress");
    expect(r.entities.progress).toBeUndefined();
    expect(r.entities.conditionStatement).toBe(true);
  });
  it.each([
    "a mesa precisa de reparos",
    "o tampo está ruim",
    "os outros estão melhores",
    "a madeira está bem estragada",
    "vai precisar lixar bastante",
    "tem partes quebradas",
    "o verniz está descascando",
  ])("negativo: %s", (t) => {
    expect(detectProgress(t)).toBeUndefined();
    expect(interpretRules(t).intent).not.toBe("job_progress");
  });
  it.each([
    ["já comecei a mesa do Roberto", "iniciado"],
    ["já comecei a lixar", "iniciado"],
    ["coloca o serviço como em andamento", "em_execucao"],
    ["pode marcar como em execução", "em_execucao"],
    ["terminei o armário", "concluido"],
    ["já entreguei", "entregue"],
    ["ainda não comecei", "nao_iniciado"],
    ["o trabalho está parado", "parado"],
    ["pode marcar como concluído", "concluido"],
  ])("15/16. positivo: %s", (t, kind) => {
    expect(detectProgress(t)).toBe(kind);
    expect(interpretRules(t).intent).toBe("job_progress");
  });
  it("palavras soltas não bastam", () => {
    for (const t of ["pronto", "o trabalho é bom", "quero fazer melhor", "andamento"]) expect(detectProgress(t)).toBeUndefined();
  });
  it("detecta estado físico", () => {
    expect(detectConditionStatement("a cômoda está riscada")).toBe(true);
    expect(detectConditionStatement("vou buscar na terça")).toBe(false);
  });
  it("22. a IA nunca introduz valor em dinheiro que não foi dito", () => {
    const merged = mergeNlu(interpretRules("está boa"), { intent: "register_expense", confidence: 0.95, amountMentionedReais: 999 });
    expect(merged.entities.amountCents).toBeUndefined();
    expect(merged.intent).not.toBe("register_expense");
  });

  it("a IA não transforma condição em andamento sem evidência no texto", () => {
    const rules = interpretRules(REPLY);
    const merged = mergeNlu(rules, { intent: "job_progress", confidence: 0.95 });
    expect(merged.intent).not.toBe("job_progress");
  });
});

describe("Ajuste 2 — referências ('um deles', 'os outros')", () => {
  const d = extractQuoteRequest(REAL, SUNDAY);
  it("14/29. 'um deles, a mesinha' e 'os outros' vão para os itens certos", () => {
    const st = parseItemStatements(REPLY, d.items, []);
    expect(st).toEqual([
      expect.objectContaining({ refs: ["i1"], condition: "reparos", repairPart: "tampo" }),
      expect.objectContaining({ refs: ["i2"], condition: "melhor_que_outros" }),
    ]);
  });
  it("sem referência explícita, aplica ao item da pergunta atual", () => {
    const st = parseItemStatements("o tampo precisa de reparos", d.items, ["i1"]);
    expect(st[0]).toMatchObject({ refs: ["i1"], condition: "reparos", repairPart: "tampo" });
  });
  it("'nela inteira' define escopo da peça atual", () => {
    const st = parseItemStatements("Nela inteira, mas o tampo precisa de reparos. Os outros estão melhores.", d.items, ["i1"]);
    const onMesinha = st.filter((s) => s.refs.includes("i1"));
    expect(onMesinha.some((s) => s.affectedPart === "inteiro")).toBe(true);
    expect(onMesinha.some((s) => s.condition === "reparos" && s.repairPart === "tampo")).toBe(true);
    expect(st.at(-1)).toMatchObject({ refs: ["i2"], condition: "melhor_que_outros" });
  });
  it("lista de móveis e agrupamento", () => {
    expect(parseFurnitureList("Uma cômoda e um aparador").map((f) => f.key)).toEqual(["comoda", "aparador"]);
    expect(parseFurnitureList("uma cômoda")[0]!.description).toBe("cômoda");
    expect(parseGrouping("um para cada cliente")).toBe("por_cliente");
    expect(parseGrouping("tudo junto")).toBe("agrupado");
  });
});

describe("Ajuste 2 — IA estruturada com validação", () => {
  const d = extractQuoteRequest(REAL, SUNDAY);
  it("30. JSON inválido da IA → fallback determinístico", () => {
    expect(mergeAiQuoteRequest(d, "isso não é json")).toEqual(d);
    expect(mergeAiQuoteRequest(d, { items: [{ description: 123 }] })).toEqual(d);
  });
  it("22. IA não introduz nomes não ditos nem associa donos", () => {
    const m = mergeAiQuoteRequest(d, { clients: [{ rawName: "Dona Inventada" }, { rawName: "Dona Jo" }], items: [], wantsPrice: true });
    expect(m.clients.map((c) => c.name)).toEqual(["Seu Roberto", "Dona Jo"]);
    expect(m.items.every((i) => i.ownerRef === null)).toBe(true);
  });
});

describe("Ajuste 1 — interpretação de preço e embalagem", () => {
  it.each([
    ["90 reais", { amountCents: 9000 }],
    ["R$ 90", { amountCents: 9000 }],
    ["Noventa", { amountCents: 9000 }],
    ["Uma lata de 900 ml por 90", { amountCents: 9000, packageSize: "0.9", packages: 1 }],
    ["Duas latas de 900 ml, deu 180 reais", { amountCents: 18000, packageSize: "0.9", packages: 2 }],
    ["O galão de 3,6 litros está 240", { amountCents: 24000, packageSize: "3.6" }],
    ["Acho que foi uns 85 reais", { amountCents: 8500, confidence: "media" }],
    ["Não lembro", { dontKnow: true, confidence: "baixa" }],
    ["Tenho que olhar", { dontKnow: true }],
    ["É a lata de 900 ml", { packageSize: "0.9" }],
  ])("%s", (text, expected) => {
    expect(parsePriceAnswer(text, "L", { expectPrice: true })).toMatchObject(expected);
  });
  it("'É aquele verniz de sempre' não inventa valor", () => {
    const a = parsePriceAnswer("É aquele verniz de sempre", "L", { expectPrice: true });
    expect(a.amountCents).toBeUndefined();
    expect(a.packageSize).toBeUndefined();
  });
  it("preço por embalagem em centavos exatos", () => {
    expect(pricePerPackageCents(18000, 2)).toBe(9000);
    expect(pricePerPackageCents(10000, 3)).toBe(3333);
    expect(() => pricePerPackageCents(0, 1)).toThrow();
  });
  it("rótulos de embalagem", () => {
    expect(packageSizeLabel("0.9", "L")).toBe("900 ml");
    expect(packageSizeLabel("3.6", "L")).toBe("3,6 litros");
    expect(packageSizeLabel("0.4", "kg")).toBe("400 g");
  });
});
