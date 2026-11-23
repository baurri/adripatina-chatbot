import type { MaterialDef, MethodDef, PricingCatalog, PricingSettings, TechniqueDef } from "./types.js";

/**
 * ATENÇÃO: valores de DEMONSTRAÇÃO, NÃO CALIBRADOS.
 * Servem apenas para testes e para a primeira carga do banco. Todos estão
 * marcados com calibrated=false e bloqueiam emissão comercial definitiva até
 * revisão do administrador. Preços de materiais ficam NULOS de propósito
 * (exceto em fixtures de teste) para não inventar preços de mercado.
 */

export const DEMO_SETTINGS: PricingSettings = {
  incomeMinCents: 300_000,
  incomeIdealCents: 400_000,
  fixedCostsCents: 40_000,
  reservePct: "15",
  availableHoursPerMonth: "130",
  productivityPct: "75",
  hoursPerWorkday: "6",
  commercialMarkupPct: "0",
  taxRatePct: "0",
  taxConfigured: false,
  subcontractCoordinationPct: "10",
  stalePriceDays: 90,
  depositPct: "40",
  recommendedRoundingCents: 100,
  quoteValidityDays: 15,
  requireAdminReview: true,
  sizeClassAreaM2: {
    pequeno: ["0.5", "1.5"],
    medio: ["1.5", "3.5"],
    grande: ["3.5", "6"],
  },
  internalAreaFactor: "0.8",
  priceSanity: { minPackagePriceCents: 100, maxPackagePriceCents: 200_000 },
};

export const DEMO_METHODS: MethodDef[] = [
  { key: "pincel", name: "Pincel/trincha", speedM2PerHour: "3", lossPct: "8", setupHours: "0.25", cleanupHours: "0.25", calibrated: false },
  { key: "rolo", name: "Rolo", speedM2PerHour: "5", lossPct: "12", setupHours: "0.3", cleanupHours: "0.3", calibrated: false },
  { key: "pistola", name: "Pistola/compressor", speedM2PerHour: "9", lossPct: "35", setupHours: "1.1", cleanupHours: "0.5", calibrated: false },
];

/** Materiais sem preço (null) — o administrador deve cadastrar preços reais. */
export const DEMO_MATERIALS: MaterialDef[] = [
  { key: "lixa", name: "Lixa (folha)", unit: "folha", packageSize: "1", replacementPriceCents: null, priceUpdatedAt: null, yieldM2PerUnitPerCoat: null, lossPct: "0", calibrated: false },
  { key: "massa_madeira", name: "Massa para madeira", unit: "kg", packageSize: "0.4", replacementPriceCents: null, priceUpdatedAt: null, yieldM2PerUnitPerCoat: null, lossPct: "10", calibrated: false },
  { key: "fundo_preparador", name: "Fundo preparador", unit: "L", packageSize: "0.9", replacementPriceCents: null, priceUpdatedAt: null, yieldM2PerUnitPerCoat: "10", lossPct: "10", calibrated: false },
  { key: "tinta_esmalte", name: "Tinta esmalte/acrílica", unit: "L", packageSize: "3.6", replacementPriceCents: null, priceUpdatedAt: null, yieldM2PerUnitPerCoat: "10", lossPct: "10", calibrated: false },
  { key: "tinta_base_patina", name: "Tinta base para pátina", unit: "L", packageSize: "0.9", replacementPriceCents: null, priceUpdatedAt: null, yieldM2PerUnitPerCoat: "10", lossPct: "10", calibrated: false },
  { key: "betume_patina", name: "Betume/veladura para pátina", unit: "L", packageSize: "0.25", replacementPriceCents: null, priceUpdatedAt: null, yieldM2PerUnitPerCoat: "15", lossPct: "15", calibrated: false },
  { key: "verniz", name: "Verniz", unit: "L", packageSize: "0.9", replacementPriceCents: null, priceUpdatedAt: null, yieldM2PerUnitPerCoat: "12", lossPct: "10", calibrated: false },
  { key: "cera", name: "Cera", unit: "kg", packageSize: "0.4", replacementPriceCents: null, priceUpdatedAt: null, yieldM2PerUnitPerCoat: "20", lossPct: "5", calibrated: false },
  { key: "folha_ouro", name: "Folha de ouro (imitação)", unit: "folha", packageSize: "100", replacementPriceCents: null, priceUpdatedAt: null, yieldM2PerUnitPerCoat: "0.0196", lossPct: "20", calibrated: false },
  { key: "cola_mordente", name: "Mordente/cola para douração", unit: "L", packageSize: "0.1", replacementPriceCents: null, priceUpdatedAt: null, yieldM2PerUnitPerCoat: "8", lossPct: "15", calibrated: false },
  { key: "solvente", name: "Solvente/thinner", unit: "L", packageSize: "0.9", replacementPriceCents: null, priceUpdatedAt: null, yieldM2PerUnitPerCoat: null, lossPct: "0", calibrated: false },
];

const prepSanding = {
  key: "lixamento_preparo",
  label: "Lixamento e preparação",
  sharedKey: "preparo",
  kind: "labor" as const,
  laborHoursPerM2: "0.6",
  fixedHours: "0.5",
  materials: [{ materialKey: "lixa", mode: "per_m2" as const, quantityPerM2: "2" }],
};
const cleanup = {
  key: "limpeza_final",
  label: "Limpeza e montagem",
  sharedKey: "limpeza_montagem",
  kind: "labor" as const,
  laborHoursPerM2: "0.1",
  fixedHours: "0.5",
  materials: [{ materialKey: "solvente", mode: "fixed" as const, quantity: "0.2" }],
};
const primer = {
  key: "fundo",
  label: "Fundo preparador",
  sharedKey: "fundo",
  kind: "coating" as const,
  coats: 1,
  materials: [{ materialKey: "fundo_preparador", mode: "coverage" as const }],
  dryingHours: "4",
};

export const DEMO_TECHNIQUES: TechniqueDef[] = [
  {
    key: "pintura_lisa",
    name: "Pintura lisa",
    version: 1,
    calibrated: false,
    steps: [
      prepSanding,
      primer,
      { key: "pintura", label: "Pintura (demãos)", kind: "coating", coats: 2, materials: [{ materialKey: "tinta_esmalte", mode: "coverage" }], dryingHours: "8" },
      cleanup,
    ],
  },
  {
    key: "patina",
    name: "Pátina",
    version: 1,
    calibrated: false,
    steps: [
      prepSanding,
      primer,
      { key: "base_patina", label: "Base da pátina", kind: "coating", coats: 2, materials: [{ materialKey: "tinta_base_patina", mode: "coverage" }], dryingHours: "8" },
      { key: "efeito_patina", label: "Efeito de pátina (manual)", kind: "labor", laborHoursPerM2: "0.8", fixedHours: "0.5", materials: [{ materialKey: "betume_patina", mode: "coverage" }], dryingHours: "12" },
      cleanup,
    ],
  },
  {
    key: "decape",
    name: "Decapê",
    version: 1,
    calibrated: false,
    steps: [
      prepSanding,
      { key: "base_decape", label: "Camadas de cor", kind: "coating", coats: 2, materials: [{ materialKey: "tinta_esmalte", mode: "coverage" }], dryingHours: "8" },
      { key: "desgaste", label: "Desgaste manual (decapê)", kind: "labor", laborHoursPerM2: "0.7", fixedHours: "0.3", materials: [{ materialKey: "lixa", mode: "per_m2", quantityPerM2: "1" }] },
      cleanup,
    ],
  },
  {
    key: "folha_ouro",
    name: "Folha de ouro",
    version: 1,
    calibrated: false,
    steps: [
      prepSanding,
      { key: "mordente", label: "Aplicação de mordente", kind: "labor", laborHoursPerM2: "1", fixedHours: "0.3", materials: [{ materialKey: "cola_mordente", mode: "coverage" }], dryingHours: "1" },
      { key: "douracao", label: "Douração com folha", kind: "labor", laborHoursPerM2: "4", fixedHours: "0.5", materials: [{ materialKey: "folha_ouro", mode: "coverage" }] },
      cleanup,
    ],
  },
  {
    key: "verniz",
    name: "Verniz",
    version: 1,
    calibrated: false,
    steps: [
      prepSanding,
      { key: "verniz", label: "Envernizamento", kind: "coating", coats: 2, materials: [{ materialKey: "verniz", mode: "coverage" }], dryingHours: "8" },
      cleanup,
    ],
  },
  {
    key: "enceramento",
    name: "Enceramento",
    version: 1,
    calibrated: false,
    steps: [
      { key: "cera", label: "Enceramento e polimento", kind: "labor", laborHoursPerM2: "0.5", fixedHours: "0.3", materials: [{ materialKey: "cera", mode: "coverage" }], dryingHours: "2" },
      cleanup,
    ],
  },
  {
    key: "restauracao",
    name: "Restauração",
    version: 1,
    calibrated: false,
    steps: [
      prepSanding,
      { key: "reparos_massa", label: "Reparos com massa", kind: "labor", laborHoursPerM2: "0.4", fixedHours: "1", materials: [{ materialKey: "massa_madeira", mode: "per_m2", quantityPerM2: "0.05" }], dryingHours: "4" },
      cleanup,
    ],
  },
];

export function demoCatalog(): PricingCatalog {
  // cópia profunda: o catálogo de demonstração nunca deve ser mutado
  return structuredClone({
    techniques: Object.fromEntries(DEMO_TECHNIQUES.map((t) => [t.key, t])),
    methods: Object.fromEntries(DEMO_METHODS.map((m) => [m.key, m])),
    materials: Object.fromEntries(DEMO_MATERIALS.map((m) => [m.key, m])),
  });
}
