import type { PricingCatalog, TechniqueDef } from "../src/index.js";
import { DEMO_SETTINGS, demoCatalog } from "../src/index.js";

export const NOW = new Date("2026-11-22T12:00:00Z");
export const settings = { ...DEMO_SETTINGS };

/** Catálogo de teste: preços FICTÍCIOS e calibrated=true para testar o cálculo. */
export function testCatalog(): PricingCatalog {
  const c = demoCatalog();
  for (const m of Object.values(c.materials)) {
    m.calibrated = true;
    m.priceUpdatedAt = "2026-11-01T00:00:00Z";
  }
  c.materials.tinta_esmalte!.replacementPriceCents = 12_000; // lata 3,6 L = R$ 120 (fictício)
  c.materials.lixa!.replacementPriceCents = 300;
  c.materials.solvente!.replacementPriceCents = 2_500;
  c.materials.fundo_preparador!.replacementPriceCents = 4_500;
  c.materials.tinta_base_patina!.replacementPriceCents = 5_000;
  c.materials.betume_patina!.replacementPriceCents = 3_000;
  c.materials.verniz!.replacementPriceCents = 9_000;
  c.materials.cera!.replacementPriceCents = 4_000;
  c.materials.massa_madeira!.replacementPriceCents = 2_000;
  c.materials.folha_ouro!.replacementPriceCents = 8_000;
  c.materials.cola_mordente!.replacementPriceCents = 3_500;
  for (const m of Object.values(c.methods)) m.calibrated = true;
  for (const t of Object.values(c.techniques)) t.calibrated = true;

  // técnica sintética para o exemplo obrigatório: consome exatamente meia lata (1,8 L)
  const halfCan: TechniqueDef = {
    key: "meia_lata",
    name: "Teste meia lata",
    version: 1,
    calibrated: true,
    steps: [
      {
        key: "aplicacao_manual",
        label: "Aplicação manual",
        kind: "labor",
        laborHoursPerM2: "0",
        fixedHours: "1",
        materials: [{ materialKey: "tinta_esmalte", mode: "fixed", quantity: "1.8" }],
      },
    ],
  };
  c.techniques[halfCan.key] = halfCan;
  return c;
}
