import { describe, expect, it } from "vitest";
import { Dec } from "@adripatina/shared";
import { estimateArea, hourlyRates, priceJob, demoCatalog, type PricingInput } from "../src/index.js";
import { NOW, settings, testCatalog } from "./fixtures.js";

const base = (over: Partial<PricingInput> = {}): PricingInput => ({
  area: { kind: "exact", m2: "2" },
  techniqueKeys: ["meia_lata"],
  methodKey: null,
  ...over,
});

describe("taxa horária (3.1)", () => {
  it("mínimo ≈ R$ 40,10/h e ideal ≈ R$ 51,90/h, sem arredondar para 40/52", () => {
    const r = hourlyRates(settings);
    expect(r.productive.toString()).toBe("97.5");
    expect(r.min.round(2).toString()).toBe("4010.26"); // centavos/hora
    expect(r.ideal.round(2).toString()).toBe("5189.74");
    expect(r.min.eq(4000)).toBe(false);
  });
});

describe("FIN-ESTOQUE-001 — material em estoque nunca é gratuito", () => {
  it("exemplo obrigatório: meia lata em estoque de R$ 120 → R$ 60 de consumo, R$ 0 de compra", () => {
    const r = priceJob(base({ inventory: { tinta_esmalte: { quantity: "1.8" } } }), settings, testCatalog(), { now: NOW });
    const tinta = r.materials.lines.find((l) => l.materialKey === "tinta_esmalte")!;
    expect(tinta.consumptionCostCents).toBe(6_000);
    expect(tinta.purchaseCashOutlayCents).toBe(0);
    expect(tinta.packagesToBuy).toBe(0);
    expect(r.materials.consumptionCostCents).toBe(6_000);
    expect(r.materials.purchaseCashOutlayCents).toBe(0);
  });

  it("aceite 1: estoque suficiente → compra 0, consumo > 0 e incluso no orçamento", () => {
    const withStock = priceJob(base({ inventory: { tinta_esmalte: { quantity: "10" } } }), settings, testCatalog(), { now: NOW });
    const noStock = priceJob(base(), settings, testCatalog(), { now: NOW });
    expect(withStock.materials.purchaseCashOutlayCents).toBe(0);
    expect(withStock.materials.consumptionCostCents).toBeGreaterThan(0);
    // o preço do cliente é IDÊNTICO com ou sem estoque
    expect(withStock.floorCents).toBe(noStock.floorCents);
    expect(withStock.recommendedCents).toBe(noStock.recommendedCents);
    // e o piso contém o custo do material
    expect(withStock.floorCents!).toBeGreaterThanOrEqual(withStock.labor.minCents + 6_000);
  });

  it("aceite 2: estoque parcial → compra só da embalagem faltante, consumo integral", () => {
    const r = priceJob(base({ inventory: { tinta_esmalte: { quantity: "1" } } }), settings, testCatalog(), { now: NOW });
    const tinta = r.materials.lines[0]!;
    expect(tinta.inventoryUsed).toBe("1");
    expect(tinta.purchaseQuantity).toBe("0.8");
    expect(tinta.packagesToBuy).toBe(1);
    expect(tinta.purchaseCashOutlayCents).toBe(12_000);
    expect(tinta.consumptionCostCents).toBe(6_000);
  });

  it("aceite 3: material comprado há anos → preço de reposição atual; histórico separado", () => {
    const r = priceJob(
      base({ inventory: { tinta_esmalte: { quantity: "3.6", historicalUnitCostCents: 1_000 } } }),
      settings,
      testCatalog(),
      { now: NOW },
    );
    const tinta = r.materials.lines[0]!;
    expect(tinta.consumptionCostCents).toBe(6_000); // reposição: 1,8 × 120/3,6
    expect(tinta.historicalCostOfInventoryUsedCents).toBe(1_800); // histórico: 1,8 × R$ 10
    expect(r.materials.historicalCostOfInventoryUsedCents).toBe(1_800);
  });

  it("aceite 4: preço ausente → pendência e bloqueio; jamais custo zero", () => {
    const cat = testCatalog();
    cat.materials.tinta_esmalte!.replacementPriceCents = null;
    const r = priceJob(base({ inventory: { tinta_esmalte: { quantity: "5" } } }), settings, cat, { now: NOW });
    const tinta = r.materials.lines[0]!;
    expect(tinta.consumptionCostCents).toBeNull();
    expect(r.blockers.map((b) => b.code)).toContain("MATERIAL_PRICE_MISSING");
    expect(r.definitiveAllowed).toBe(false);
    expect(r.materials.missingPrices).toContain("Tinta esmalte/acrílica");
  });

  it("catálogo de demonstração (sem preços) nunca permite proposta definitiva", () => {
    const r = priceJob(
      { area: { kind: "exact", m2: "3" }, techniqueKeys: ["pintura_lisa"], methodKey: "rolo" },
      settings,
      demoCatalog(),
      { now: NOW },
    );
    const codes = r.blockers.map((b) => b.code);
    expect(codes).toContain("MATERIAL_PRICE_MISSING");
    expect(codes).toContain("UNCALIBRATED_PARAMETERS");
    expect(r.definitiveAllowed).toBe(false);
    expect(r.confidence).toBe("baixa");
  });

  it("preço desatualizado gera alerta", () => {
    const cat = testCatalog();
    cat.materials.tinta_esmalte!.priceUpdatedAt = "2024-01-01T00:00:00Z";
    const r = priceJob(base(), settings, cat, { now: NOW });
    expect(r.warnings.map((w) => w.code)).toContain("STALE_PRICE");
  });
});

describe("regras de precificação", () => {
  it("aceite 6: reserva geral e custos fixos não são somados de novo no serviço", () => {
    const r = priceJob(base({ inventory: { tinta_esmalte: { quantity: "5" } } }), settings, testCatalog(), { now: NOW });
    // 1 h de mão de obra × 4010,2564 c/h → 4011 (arredondado para cima) + 6000 de material
    expect(r.labor.totalHours).toBe("1");
    expect(r.labor.minCents).toBe(4_011);
    expect(r.floorCents).toBe(4_011 + 6_000);
    // recomendado: 1 h × 5189,74 → 5190 + 6000 = 11190 → arredondado para R$ 112,00
    expect(r.recommendedCents).toBe(11_200);
  });

  it("aceite 7: técnicas compostas não duplicam lixamento/preparação comum", () => {
    const cat = testCatalog();
    const patina = priceJob({ area: { kind: "exact", m2: "2" }, techniqueKeys: ["patina"], methodKey: "pincel" }, settings, cat, { now: NOW });
    const combo = priceJob({ area: { kind: "exact", m2: "2" }, techniqueKeys: ["patina", "verniz"], methodKey: "pincel" }, settings, cat, { now: NOW });
    const prepLines = combo.labor.lines.filter((l) => l.stepKey === "lixamento_preparo");
    expect(prepLines).toHaveLength(1);
    expect(prepLines[0]!.techniqueKeys).toEqual(["patina", "verniz"]);
    const cleanupLines = combo.labor.lines.filter((l) => l.stepKey === "limpeza_final");
    expect(cleanupLines).toHaveLength(1);
    // o combo acrescenta só a etapa de verniz
    const varnish = combo.labor.lines.find((l) => l.stepKey === "verniz")!;
    expect(Dec.from(combo.labor.totalHours).sub(patina.labor.totalHours).eq(varnish.hours)).toBe(true);
  });

  it("aceite 8: secagem não conta como hora ativa", () => {
    const cat = testCatalog();
    const r = priceJob({ area: { kind: "exact", m2: "2" }, techniqueKeys: ["verniz"], methodKey: "pincel" }, settings, cat, { now: NOW });
    const v = r.labor.lines.find((l) => l.stepKey === "verniz")!;
    // 2 m² × 2 demãos ÷ 3 m²/h + 0,25 + 0,25 = 1,8333 h; secagem de 8 h fora
    expect(v.hours).toBe("1.833");
    expect(v.dryingHours).toBe("8");
    const sumHours = r.labor.lines.reduce((a, l) => a.add(l.hours), Dec.ZERO);
    expect(sumHours.eq(r.labor.totalHours)).toBe(true);
    expect(Dec.from(r.leadTime.dryingHours).gt(0)).toBe(true);
  });

  it("aceite 9: terceirização sem cotação confirmada bloqueia proposta definitiva", () => {
    const r = priceJob(
      base({ subcontracts: [{ description: "Tapeçaria do assento", costCents: null, confirmed: false }] }),
      settings,
      testCatalog(),
      { now: NOW },
    );
    expect(r.blockers.map((b) => b.code)).toContain("SUBCONTRACT_UNCONFIRMED");
    expect(r.definitiveAllowed).toBe(false);
  });

  it("terceiro confirmado entra com logística e taxa de coordenação, sem duplicar mão de obra", () => {
    const r = priceJob(
      base({ subcontracts: [{ description: "Marcenaria", costCents: 20_000, logisticsCents: 3_000, confirmed: true }] }),
      settings,
      testCatalog(),
      { now: NOW },
    );
    expect(r.subcontracts.lines[0]!.coordinationFeeCents).toBe(2_300);
    expect(r.subcontracts.totalCents).toBe(25_300);
    expect(r.labor.totalHours).toBe("1");
  });

  it("aceite 10: desconto abaixo do piso bloqueado sem aprovação; liberado com aprovação", () => {
    const blocked = priceJob(base({ proposedPriceCents: 5_000 }), settings, testCatalog(), { now: NOW });
    expect(blocked.blockers.map((b) => b.code)).toContain("BELOW_FLOOR");
    const approved = priceJob(base({ proposedPriceCents: 5_000, approvals: { belowFloor: true } }), settings, testCatalog(), { now: NOW });
    expect(approved.blockers.map((b) => b.code)).not.toContain("BELOW_FLOOR");
    expect(approved.warnings.map((w) => w.code)).toContain("BELOW_FLOOR_APPROVED");
  });

  it("parâmetros não calibrados bloqueiam até aprovação explícita", () => {
    const cat = testCatalog();
    cat.methods.rolo!.calibrated = false;
    const r = priceJob({ area: { kind: "exact", m2: "2" }, techniqueKeys: ["pintura_lisa"], methodKey: "rolo" }, settings, cat, { now: NOW });
    expect(r.blockers.map((b) => b.code)).toContain("UNCALIBRATED_PARAMETERS");
    const ok = priceJob(
      { area: { kind: "exact", m2: "2" }, techniqueKeys: ["pintura_lisa"], methodKey: "rolo", approvals: { uncalibrated: true } },
      settings,
      cat,
      { now: NOW },
    );
    expect(ok.blockers).toHaveLength(0);
  });

  it("área desconhecida ('não sei') bloqueia e não vira zero", () => {
    const r = priceJob(base({ area: null }), settings, testCatalog(), { now: NOW });
    expect(r.computable).toBe(false);
    expect(r.floorCents).toBeNull();
    expect(r.blockers.map((b) => b.code)).toContain("AREA_UNKNOWN");
  });

  it("risco específico é separado e documentado; tributo usa gross-up explícito", () => {
    const s = { ...settings, taxConfigured: true, taxRatePct: "6" };
    const r = priceJob(base({ specificRisk: { pct: "10", reason: "Madeira com cupim" } }), s, testCatalog(), { now: NOW });
    expect(r.risk.minCents).toBe(Math.ceil((4_011 + 6_000) * 0.1));
    const preTax = 4_011 + 6_000 + r.risk.minCents;
    expect(r.floorCents).toBe(Math.ceil(preTax / 0.94));
    expect(r.taxes.minCents).toBe(r.floorCents! - preTax);
  });

  it("comercial soma exatamente o preço final, sem expor custos", () => {
    const r = priceJob(base({ specificExpenses: [{ description: "Frete", amountCents: 5_000, category: "transporte" }] }), settings, testCatalog(), { now: NOW });
    const c = r.commercial!;
    expect(c.servicesCents + c.materialsCents + c.transportCents).toBe(r.finalPriceCents);
  });

  it("entrada recomendada cobre compras e terceiros", () => {
    const r = priceJob(base(), settings, testCatalog(), { now: NOW });
    expect(r.depositRecommendedCents!).toBeGreaterThanOrEqual(r.materials.purchaseCashOutlayCents);
  });

  it("é determinístico", () => {
    const a = priceJob({ area: { kind: "exact", m2: "3.2" }, techniqueKeys: ["patina", "folha_ouro"], methodKey: "pincel" }, settings, testCatalog(), { now: NOW });
    const b = priceJob({ area: { kind: "exact", m2: "3.2" }, techniqueKeys: ["patina", "folha_ouro"], methodKey: "pincel" }, settings, testCatalog(), { now: NOW });
    expect(a).toEqual(b);
  });
});

describe("geometria", () => {
  it("medidas completas → área exata", () => {
    const a = estimateArea({ width: "1", height: "2", depth: "0.5", surfaces: "externa" }, settings);
    expect(a).toEqual({ kind: "exact", m2: "4.5" }); // 2 + 2×1 + 0,5
  });
  it("porte → intervalo não calibrado", () => {
    const a = estimateArea({ sizeClass: "grande" }, settings);
    expect(a?.kind).toBe("range");
  });
  it("sem dados → null", () => {
    expect(estimateArea({}, settings)).toBeNull();
  });
});
