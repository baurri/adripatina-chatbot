import { describe, expect, it } from "vitest";
import {
  ambiguousFurnitureKind,
  detectProgress,
  extractClientNames,
  extractQuoteRequest,
  findFurniture,
  interpretRules,
  parseItemStatements,
  parseOwnerStatement,
  parseQuantityCorrection,
  resolveAmbiguousFurniture,
  splitUnitForStatement,
} from "../src/index.js";

/**
 * Rodada de validação 22/11/2026 — cada teste representa uma CLASSE de problema
 * encontrada nas simulações, com mais de uma frase por classe (não exceções por frase).
 */
const NOW = new Date("2026-11-22T15:00:00Z");
const pieces = (t: string) => extractQuoteRequest(t, NOW).items.reduce((a, i) => a + i.quantity, 0);

describe("enumeração explicativa não soma peças (P0: orçamento inflado)", () => {
  it("grupo genérico detalhado logo depois conta uma vez só", () => {
    expect(pieces("Preciso pegar terça uma mesinha do seu Roberto e dois móveis da Dona Jo, acho que uma cômoda e um aparador. Quanto eu cobro?")).toBe(3);
    expect(pieces("Peguei três móveis da dona Ana: uma mesa, uma cômoda e um aparador, pra envernizar")).toBe(3);
    expect(pieces("trouxe dois móveis, no caso uma cristaleira e um buffet")).toBe(2);
  });

  it("detalhe parcial deixa o resto como grupo; peças só ligadas por 'e' continuam somando", () => {
    const d = extractQuoteRequest("trouxe três móveis da dona Ana: uma cômoda e mais coisa", NOW);
    expect(d.items.reduce((a, i) => a + i.quantity, 0)).toBe(3);
    expect(d.items.find((i) => i.generic)?.quantity).toBe(2);
    expect(pieces("peguei dois móveis e duas cadeiras da dona Ana")).toBe(4);
  });

  it("detalhes herdam o dono do grupo; dono diferente no detalhe não é detalhe", () => {
    const d = extractQuoteRequest("uma mesinha do seu Roberto e dois móveis da Dona Jo, acho que uma cômoda e um aparador", NOW);
    const jo = d.clients.find((c) => c.name === "Dona Jo")!.ref;
    expect(d.items.filter((i) => i.ownerRef === jo).map((i) => i.furnitureType)).toEqual(["comoda", "aparador"]);
  });

  it("móvel citado como descrição de outro não é peça ('mesa de oito cadeiras', 'sofá que vira cama')", () => {
    expect(pieces("Peguei uma mesa grandona de oito cadeira da dona Ana")).toBe(1);
    expect(pieces("uma mesa redonda pra seis lugares da dona Ana")).toBe(1);
    expect(pieces("um sofá que vira cama da dona Ana")).toBe(1);
    expect(findFurniture("Peguei uma mesa de oito cadeiras")).toBe("mesa");
    expect(findFurniture("um sofá que vira cama")).toBe("sofa");
  });
});

describe("negação de andamento (P0: 'não terminei' virava concluído)", () => {
  it.each([
    ["ainda não terminei a cômoda", undefined],
    ["a cômoda ainda não está pronta", undefined],
    ["não entreguei ainda", undefined],
    ["não comecei não, quis dizer que vou começar", "nao_iniciado"],
    ["vou começar amanhã", undefined],
    ["terminei a cômoda", "concluido"],
    ["já comecei a lixar a mesa do Roberto", "iniciado"],
    ["entreguei a cadeira", "entregue"],
  ])("%s → %s", (text, expected) => {
    expect(detectProgress(text)).toBe(expected);
  });
});

describe("nomes de cliente não engolem verbos (pra dona Ana lixar)", () => {
  it("verbo de serviço no infinitivo não vira sobrenome", () => {
    expect(extractClientNames("duas cadeira pra dona ana lixar e pintar")).toEqual(["Dona Ana"]);
    expect(extractClientNames("da dona Maria Clara pintar")).toEqual(["Dona Maria Clara"]);
  });
});

describe("cancelar com objeto é escopado ('esquece o aparador')", () => {
  it("sem objeto é universal; com objeto não", () => {
    expect(interpretRules("esquece").confidence).toBeGreaterThanOrEqual(0.9);
    const r = interpretRules("esquece o aparador, ela não vai mais fazer");
    expect(r.intent).toBe("cancel");
    expect(r.confidence).toBeLessThan(0.9);
  });
});

describe("referências e correções no pedido", () => {
  const draft = () => extractQuoteRequest("uma mesinha do seu Roberto e dois móveis da Dona Jo, acho que uma cômoda e um aparador", NOW);

  it("'os outros' sem antecedente não vale para todos; vira pendência", () => {
    const d = draft();
    const unresolved: string[] = [];
    const st = parseItemStatements("O tampo está ruim e precisa de reparo, os outros estão melhores.", d.items, [], unresolved);
    expect(st).toEqual([]);
    expect(unresolved.length).toBeGreaterThan(0);
  });

  it("'nos outros dois' / 'as outra' são 'os outros'", () => {
    const d = extractQuoteRequest("uma mesa, uma cômoda e um aparador da dona Ana", NOW);
    const st = parseItemStatements("Na mesa é inteira. Nos outros dois é só o tampo.", d.items, [d.items[0]!.ref]);
    const mesa = st.find((s) => s.refs.includes(d.items[0]!.ref));
    expect(mesa?.affectedPart).toBe("inteiro");
    const others = st.find((s) => s.affectedPart === "tampo");
    expect(others?.refs).toEqual([d.items[1]!.ref, d.items[2]!.ref]);
  });

  it("dono corrigido com 'não ... não' enfático escolhe o nome afirmado", () => {
    const d = draft();
    const r = parseOwnerStatement("A cômoda não é da Dona Jo não, é do Roberto.", d.items, d.clients);
    expect(r?.clientRef).toBe(d.clients.find((c) => c.name === "Seu Roberto")!.ref);
    expect(r?.refs).toEqual([d.items.find((i) => i.furnitureType === "comoda")!.ref]);
    expect(parseOwnerStatement("o aparador é do Roberto", d.items, d.clients)?.refs.length).toBe(1);
    expect(parseOwnerStatement("a cômoda não é da Dona Jo", d.items, d.clients)).toBeNull();
  });

  it("quantidade corrigida", () => {
    expect(parseQuantityCorrection("não são duas são três")).toEqual({ from: 2, to: 3 });
    expect(parseQuantityCorrection("na verdade são 4")).toEqual({ from: null, to: 4 });
    expect(parseQuantityCorrection("é uma cômoda")).toBeNull();
    expect(parseQuantityCorrection("são 2 horas")).toBeNull();
  });

  it("'uma tá quebrada, as outras boas' separa uma unidade do grupo", () => {
    const d = extractQuoteRequest("três cadeiras da dona Ana", NOW);
    const refs = [d.items[0]!.ref];
    expect(splitUnitForStatement(d.items, "uma tá quebrada as outra tá boa", refs)).toBe(true);
    expect(d.items.map((i) => i.quantity)).toEqual([1, 2]);
    const st = parseItemStatements("uma tá quebrada as outra tá boa", d.items, refs);
    expect(st.find((s) => s.condition === "danificado")?.refs).toEqual([d.items[0]!.ref]);
    expect(st.find((s) => s.condition === "bom")?.refs).toEqual([d.items[1]!.ref]);
  });
});

describe("catálogo: nomes informais e ambíguos", () => {
  it.each([
    ["um criado da dona Ana", "mesa_cabeceira"],
    ["um rackzinho", "rack"],
    ["uma comoda sem acento", "comoda"],
    ["uma comodazinha", "comoda"],
    ["guarda roupa de correr", "guarda_roupa"],
    ["uma louceira antiga", "cristaleira"],
    ["um sofá-cama", "sofa"],
  ])("%s → %s", (text, key) => {
    expect(findFurniture(text)).toBe(key);
  });

  it("'mesinha' sozinha e 'móvel das louças' pedem esclarecimento", () => {
    expect(ambiguousFurnitureKind("peguei uma mesinha da dona Ana")).toBe(0);
    expect(ambiguousFurnitureKind("uma mesinha de centro")).toBe(-1);
    expect(ambiguousFurnitureKind("aquele móvel onde põe as louças")).toBe(1);
    expect(findFurniture("aquele móvel onde põe as louças")).toBeUndefined();
    expect(resolveAmbiguousFurniture(0, "a de cabeceira")).toEqual({ key: "mesa_cabeceira" });
    expect(resolveAmbiguousFurniture(0, "de centro")).toEqual({ key: "mesa", descriptor: "de centro" });
  });

  it("móvel sem nome com verbo de serviço abre serviço novo (pergunta qual é)", () => {
    expect(interpretRules("Peguei um móvel antigo que não sei o nome da dona Ana pra pintar").intent).toBe("new_job");
  });
});

describe("plural sem duplicar (23/11/2026)", () => {
  it("'cadeiras' não vira 'cadeirases'", async () => {
    const { pluralLabel, itemName } = await import("../src/index.js");
    expect(pluralLabel("cadeiras", 2)).toBe("cadeiras");
    expect(pluralLabel("cadeira", 2)).toBe("cadeiras");
    expect(pluralLabel("aparador", 2)).toBe("aparadores");
    const d = extractQuoteRequest("duas cadeiras da dona Ana", NOW);
    expect(itemName(d.items[0]!)).toBe("as 2 cadeiras");
  });
});
