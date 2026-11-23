import { describe, expect, it } from "vitest";
import { FURNITURE_CATALOG, AMBIGUOUS_TERMS } from "../src/furniture/catalog.js";
import { CATALOG_SOURCES } from "../src/furniture/sources.js";
import { aliasForms, findFurnitureMentions, shortlistFurniture } from "../src/furniture/matcher.js";
import { normalizeText } from "@adripatina/shared";

describe("catálogo mestre", () => {
  it("tem os tipos exigidos, chaves únicas e aliases sem duplicidade entre tipos", () => {
    expect(FURNITURE_CATALOG.length).toBeGreaterThanOrEqual(150);
    const keys = FURNITURE_CATALOG.map((t) => t.key);
    expect(new Set(keys).size).toBe(keys.length);
    const owner = new Map<string, string>();
    const dups: string[] = [];
    for (const t of FURNITURE_CATALOG) for (const a of t.aliases) {
      const n = normalizeText(a).replace(/-/g, " ");
      if (owner.has(n) && owner.get(n) !== t.key) dups.push(`${n}: ${owner.get(n)} x ${t.key}`);
      owner.set(n, t.key);
    }
    expect(dups).toEqual([]);
  });
  it("toda fonte citada existe e termos ambíguos apontam para tipos reais", () => {
    const src = new Set(CATALOG_SOURCES.map((s) => s.key));
    for (const t of FURNITURE_CATALOG) {
      expect(src.has(t.sourceKey), t.key).toBe(true);
      for (const p of t.presets) expect(src.has(p.sourceKey), p.key).toBe(true);
    }
    const keys = new Set(FURNITURE_CATALOG.map((t) => t.key));
    for (const list of Object.values(AMBIGUOUS_TERMS)) for (const k of list) expect(keys.has(k), k).toBe(true);
  });
});

describe("reconhecimento", () => {
  const key = (t: string) => shortlistFurniture(t);
  it("aliases, diminutivos e acentos", () => {
    expect(aliasForms("mesa de centro")).toContain("mesinha de centro");
    expect(key("tenho uma mesinha de centro pra pintar").best?.key).toBe("mesa_centro");
    expect(key("um criado mudo antigo").best?.key).toBe("criado_mudo_antigo");
    expect(key("Cômoda da Dona Ana").best?.key).toBe("comoda");
    expect(key("cama de casal queen").best?.key).toBe("cama_queen");
    expect(key("o guarda roupa de 4 portas").best?.key).toBe("guarda_roupa");
  });
  it("criado com contexto suficiente vira criado-mudo", () => {
    expect(key("o criado do quarto dela").best?.key).toBe("criado_mudo");
  });
  it("termos genéricos geram esclarecimento", () => {
    const a = key("vou reformar um armario");
    expect(a.status).toBe("ambiguous");
    expect(a.candidates.map((c) => c.key)).toContain("guarda_roupa");
    const c = key("é uma cama grande");
    expect(c.status).toBe("ambiguous");
    expect(c.candidates.map((x) => x.key)).toEqual(expect.arrayContaining(["cama_casal", "cama_queen", "cama_king"]));
    expect(key("uma mesinha pra envernizar").status).toBe("ambiguous");
  });
  it("contexto resolve o genérico", () => {
    expect(key("o armario da cozinha").best?.key).toBe("armario_cozinha_inferior");
    expect(key("a mesinha ao lado da cama").best?.key).toBe("criado_mudo");
    expect(key("banco do jardim").best?.key).toBe("banco_jardim");
  });
  it("erro de digitação leve", () => {
    expect(key("uma comdoa velha").best?.key).toBe("comoda");
    expect(key("a cristaleria").best?.key).toBe("cristaleira");
  });
  it("vários móveis na mesma frase", () => {
    const m = findFurnitureMentions("uma mesinha de centro, seis cadeiras e um buffet");
    expect(m.map((x) => x.best?.key)).toEqual(["mesa_centro", "cadeira_jantar", "buffet"]);
  });
  it("tipo inativo não aparece como sugestão", () => {
    const types = FURNITURE_CATALOG.map((t) => (t.key === "buffet" ? { ...t, active: false } : t));
    expect(shortlistFurniture("um buffet", types).best?.key).not.toBe("buffet");
  });
});

import { describePreset, nominalDimensions, presetByKey, suggestPreset, findType } from "../src/furniture/nominal.js";
import { ATTRIBUTES, catalogAttributesFor, dimensionQuestion, parseCatalogDimensions } from "../src/furniture/answers.js";
import { isRealMeasurement } from "@adripatina/domain";

describe("medidas nominais", () => {
  const pre = (k: string) => presetByKey(k)!.preset;
  it("camas usam referências de colchão com ressalva", () => {
    expect(describePreset(pre("solteiro_88"))).toBe("colchão de 88 × 188 cm");
    expect(describePreset(pre("casal_138"))).toBe("colchão de 138 × 188 cm");
    expect(describePreset(pre("queen_158"))).toBe("colchão de 158 × 198 cm");
    expect(describePreset(pre("king_193"))).toBe("colchão de 193 × 203 cm");
    expect(pre("king_193").isMarketReference).toBe(true);
    expect(pre("king_193").isStandardized).toBe(false);
  });
  it("super king e viúva exigem confirmação; super king nunca é sugerido sozinho", () => {
    expect(pre("super_king_203").requiresConfirmation).toBe(true);
    expect(suggestPreset(findType("cama_super_king")!)).toBeNull();
    expect(pre("viuva_128").requiresConfirmation).toBe(true);
    expect(pre("queen_158").requiresConfirmation).toBe(false);
  });
  it("hipótese nominal nunca é medida real e a estrutura não herda o colchão", () => {
    const d = nominalDimensions(pre("queen_158"));
    expect(d).toMatchObject({ width: "1.58", depth: "1.98", source: "nominal", kind: "mattress" });
    expect(isRealMeasurement(d)).toBe(false);
    expect(isRealMeasurement({ width: "1.7", source: "customer_informed" })).toBe(true);
  });
  it("mesas por lugares usam faixas; redonda usa diâmetro", () => {
    expect(describePreset(pre("mesa_4_retangular"))).toBe("cerca de 120–140 × 80–90 cm");
    expect(describePreset(pre("mesa_6_retangular"))).toBe("cerca de 160–180 × 90–100 cm");
    expect(describePreset(pre("mesa_8_retangular"))).toBe("cerca de 200–240 × 100–110 cm");
    const round = nominalDimensions(suggestPreset(findType("mesa_jantar_4_lugares")!, "é redonda")!);
    expect(round.diameter).toBe("1");
    expect(round.nominalRange?.min.diameter).toBe("0.9");
  });
});

describe("respostas guiadas pelo catálogo", () => {
  it("cama: largura × comprimento; mesa: comprimento × largura; redonda: diâmetro", () => {
    const bed = parseCatalogDimensions("uns 1,70 por 2,10", "width_length");
    expect(bed).toMatchObject({ kind: "dims", dims: { width: "1.7", depth: "2.1", source: "customer_informed", confidence: "media" } });
    expect(parseCatalogDimensions("160 x 90", "length_width_height")).toMatchObject({ dims: { width: "1.6", depth: "0.9" } });
    expect(parseCatalogDimensions("medi com a trena: 1,20 de diâmetro", "diameter_height")).toMatchObject({ dims: { diameter: "1.2", source: "measured" } });
    expect(parseCatalogDimensions("90 de largura e 1,80 de comprimento", "length_width_height")).toMatchObject({ dims: { width: "1.8", depth: "0.9" } });
    expect(parseCatalogDimensions("é o padrão", "width_length").kind).toBe("standard");
    expect(parseCatalogDimensions("não sei", "width_length").kind).toBe("dont_know");
  });
  it("perguntas específicas por tipo", () => {
    expect(catalogAttributesFor(findType("guarda_roupa")!)).toEqual(expect.arrayContaining(["doors_count", "door_type"]));
    expect(catalogAttributesFor(findType("comoda")!)).toContain("drawers_count");
    expect(catalogAttributesFor(findType("sofa_3_lugares")!)).toContain("upholstery_scope");
    expect(catalogAttributesFor(findType("mesa_jardim")!)).toContain("exposure");
    expect(catalogAttributesFor(findType("cama_queen")!)).toContain("work_scope");
    const t = findType("guarda_roupa")!;
    expect(ATTRIBUTES.doors_count.parse("tem quatro portas", t)).toBe(4);
    expect(ATTRIBUTES.door_type.parse("de correr", t)).toBe("correr");
    expect(ATTRIBUTES.upholstery_scope.parse("só a madeira", findType("poltrona")!)).toBe("madeira");
    expect(ATTRIBUTES.exposure.parse("pega sol e chuva", findType("banco_jardim")!)).toBe("sol_e_chuva");
    expect(ATTRIBUTES.work_scope.parse("só a cabeceira", findType("cama_queen")!)).toBe("cabeceira");
    expect(ATTRIBUTES.extension.parse("aberta fica 2,20", findType("mesa_extensivel")!)).toMatchObject({ width: "2.2" });
  });
  it("pergunta de medida informa a ordem", () => {
    expect(dimensionQuestion(findType("mesa_retangular")!)).toMatch(/comprimento e a largura do tampo/);
    expect(dimensionQuestion(findType("cama_queen")!)).toMatch(/largura e o comprimento da estrutura/);
    expect(dimensionQuestion(findType("mesa_redonda")!)).toMatch(/diâmetro/);
  });
});

import { extractQuoteRequest } from "../src/multi.js";

describe("referência de lugar não é peça", () => {
  it("'fica na frente do sofá' / 'ao lado da cama' não somam móveis ao serviço", () => {
    const now = new Date("2026-11-23T12:00:00Z");
    expect(extractQuoteRequest("Peguei uma mesinha da dona Gal para envernizar, fica na frente do sofá", now).items).toHaveLength(1);
    expect(extractQuoteRequest("vou pintar o criado-mudo que fica ao lado da cama", now).items).toHaveLength(1);
    expect(extractQuoteRequest("uma mesa e um sofá para restaurar", now).items).toHaveLength(2);
  });
});
