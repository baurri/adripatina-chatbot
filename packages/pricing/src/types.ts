import { z } from "zod";

const decStr = z
  .string()
  .regex(/^-?\d+(\.\d+)?$/, "decimal em string com ponto, ex.: '0.75'");
const cents = z.number().int();

export const PricingSettingsSchema = z.object({
  incomeMinCents: cents.positive(),
  incomeIdealCents: cents.positive(),
  fixedCostsCents: cents.nonnegative(),
  /** reserva geral (%) — já embutida na taxa horária, nunca repetida por serviço */
  reservePct: decStr,
  availableHoursPerMonth: decStr,
  productivityPct: decStr,
  hoursPerWorkday: decStr,
  /** markup explícito SOBRE O CUSTO TOTAL, aplicado apenas ao preço recomendado */
  commercialMarkupPct: decStr,
  /** alíquota efetiva sobre o preço (gross-up). Só aplicada se taxConfigured. */
  taxRatePct: decStr,
  taxConfigured: z.boolean(),
  /** taxa de coordenação sobre custo de terceiros (cotação + logística) */
  subcontractCoordinationPct: decStr,
  /** dias após os quais o preço de reposição é considerado desatualizado */
  stalePriceDays: z.number().int().positive(),
  /** entrada/adiantamento recomendado (%) do preço final */
  depositPct: decStr,
  /** arredondamento do preço recomendado para cima, em centavos (100 = reais inteiros) */
  recommendedRoundingCents: cents.positive(),
  quoteValidityDays: z.number().int().positive(),
  requireAdminReview: z.boolean(),
  /** faixas de área por porte (m²) — hipótese NÃO CALIBRADA */
  sizeClassAreaM2: z.object({
    pequeno: z.tuple([decStr, decStr]),
    medio: z.tuple([decStr, decStr]),
    grande: z.tuple([decStr, decStr]),
  }),
  /** fator de área interna em relação à externa — hipótese NÃO CALIBRADA */
  internalAreaFactor: decStr,
});
export type PricingSettings = z.infer<typeof PricingSettingsSchema>;

export const MaterialDefSchema = z.object({
  key: z.string().min(1),
  name: z.string().min(1),
  unit: z.string().min(1), // L, kg, un, folha, m
  packageSize: decStr, // quantidade na embalagem (unidade base)
  replacementPriceCents: cents.positive().nullable(), // preço atual da embalagem
  priceUpdatedAt: z.string().nullable(),
  yieldM2PerUnitPerCoat: decStr.nullable(), // m² por unidade base por demão
  lossPct: decStr,
  calibrated: z.boolean(),
});
export type MaterialDef = z.infer<typeof MaterialDefSchema>;

export const MethodDefSchema = z.object({
  key: z.string(),
  name: z.string(),
  speedM2PerHour: decStr,
  lossPct: decStr,
  setupHours: decStr,
  cleanupHours: decStr,
  calibrated: z.boolean(),
});
export type MethodDef = z.infer<typeof MethodDefSchema>;

export const StepMaterialSchema = z.discriminatedUnion("mode", [
  z.object({ materialKey: z.string(), mode: z.literal("coverage") }),
  z.object({ materialKey: z.string(), mode: z.literal("per_m2"), quantityPerM2: decStr }),
  z.object({ materialKey: z.string(), mode: z.literal("fixed"), quantity: decStr }),
]);
export type StepMaterial = z.infer<typeof StepMaterialSchema>;

export const RecipeStepSchema = z.object({
  key: z.string(),
  label: z.string(),
  /** etapas com o mesmo sharedKey em técnicas combinadas são feitas UMA vez */
  sharedKey: z.string().optional(),
  /** labor = horas por m²; coating = aplicação com método (pincel/rolo/pistola) */
  kind: z.enum(["labor", "coating"]),
  laborHoursPerM2: decStr.optional(),
  fixedHours: decStr.optional(),
  coats: z.number().int().positive().optional(),
  materials: z.array(StepMaterialSchema),
  /** secagem/cura: afeta prazo, NÃO vira hora ativa faturada */
  dryingHours: decStr.optional(),
});
export type RecipeStep = z.infer<typeof RecipeStepSchema>;

export const TechniqueDefSchema = z.object({
  key: z.string(),
  name: z.string(),
  steps: z.array(RecipeStepSchema),
  calibrated: z.boolean(),
  version: z.number().int().positive(),
});
export type TechniqueDef = z.infer<typeof TechniqueDefSchema>;

export const AreaInputSchema = z.union([
  z.object({ kind: z.literal("exact"), m2: decStr }),
  z.object({ kind: z.literal("range"), minM2: decStr, maxM2: decStr, source: z.string() }),
]);
export type AreaInput = z.infer<typeof AreaInputSchema>;

export const PricingInputSchema = z.object({
  area: AreaInputSchema.nullable(),
  techniqueKeys: z.array(z.string()),
  methodKey: z.string().nullable(),
  extraLabor: z.array(z.object({ description: z.string(), hours: decStr })).default([]),
  subcontracts: z
    .array(
      z.object({
        description: z.string(),
        costCents: cents.nonnegative().nullable(),
        logisticsCents: cents.nonnegative().default(0),
        confirmed: z.boolean(),
        leadDays: z.number().int().nonnegative().optional(),
      }),
    )
    .default([]),
  specificExpenses: z
    .array(z.object({ description: z.string(), amountCents: cents.nonnegative(), category: z.enum(["transporte", "outros"]) }))
    .default([]),
  specificRisk: z.object({ pct: decStr, reason: z.string().min(3) }).nullable().default(null),
  /** estoque utilizável por material (unidade base) e custo histórico (opcional) */
  inventory: z
    .record(z.string(), z.object({ quantity: decStr, historicalUnitCostCents: cents.nonnegative().optional() }))
    .default({}),
  proposedPriceCents: cents.positive().nullable().default(null),
  approvals: z
    .object({
      belowFloor: z.boolean().default(false),
      uncalibrated: z.boolean().default(false),
    })
    .default({}),
});
export type PricingInput = z.input<typeof PricingInputSchema>;
export type PricingInputParsed = z.output<typeof PricingInputSchema>;

export interface PricingCatalog {
  techniques: Record<string, TechniqueDef>;
  methods: Record<string, MethodDef>;
  materials: Record<string, MaterialDef>;
}

export type BlockerCode =
  | "AREA_UNKNOWN"
  | "TECHNIQUE_UNKNOWN"
  | "METHOD_REQUIRED"
  | "MATERIAL_UNKNOWN"
  | "MATERIAL_PRICE_MISSING"
  | "MATERIAL_YIELD_MISSING"
  | "UNCALIBRATED_PARAMETERS"
  | "SUBCONTRACT_UNCONFIRMED"
  | "BELOW_FLOOR";

export type WarningCode =
  | "STALE_PRICE"
  | "AREA_RANGE_MAX_USED"
  | "TAX_NOT_CONFIGURED"
  | "SPECIFIC_RISK_APPLIED"
  | "UNCALIBRATED_APPROVED"
  | "BELOW_FLOOR_APPROVED";

export interface Issue<C extends string> {
  code: C;
  message: string;
  ref?: string;
}

export interface LaborLine {
  stepKey: string;
  label: string;
  techniqueKeys: string[];
  hours: string;
  dryingHours: string;
  dedupedFrom: string[];
}

export interface MaterialLine {
  materialKey: string;
  name: string;
  unit: string;
  /** quantidade prevista consumida (unidade base) */
  quantity: string;
  /** custo de reposição unitário (por unidade base) em centavos, decimal */
  replacementUnitCostCents: string | null;
  /** FIN-ESTOQUE-001: consumo valorizado a preço de reposição, independentemente do estoque */
  consumptionCostCents: number | null;
  inventoryAvailable: string;
  inventoryUsed: string;
  purchaseQuantity: string;
  packagesToBuy: number;
  /** desembolso de caixa estimado (embalagens a comprar) */
  purchaseCashOutlayCents: number | null;
  /** valor histórico do estoque usado (controle; NÃO entra no preço) */
  historicalCostOfInventoryUsedCents: number | null;
  priceStale: boolean;
}

export interface SubcontractLine {
  description: string;
  costCents: number | null;
  logisticsCents: number;
  coordinationFeeCents: number;
  totalCents: number | null;
  confirmed: boolean;
}

export interface PricingResult {
  engineVersion: string;
  computable: boolean;
  definitiveAllowed: boolean;
  confidence: "alta" | "media" | "baixa";
  blockers: Issue<BlockerCode>[];
  warnings: Issue<WarningCode>[];
  areaM2: string | null;
  hourlyRate: { minCentsPerHour: string; idealCentsPerHour: string; productiveHours: string };
  labor: { lines: LaborLine[]; totalHours: string; minCents: number; idealCents: number };
  materials: {
    lines: MaterialLine[];
    consumptionCostCents: number;
    purchaseCashOutlayCents: number;
    historicalCostOfInventoryUsedCents: number;
    missingPrices: string[];
  };
  subcontracts: { lines: SubcontractLine[]; totalCents: number };
  expenses: { transportCents: number; otherCents: number; totalCents: number };
  risk: { pct: string; reason: string | null; minCents: number; idealCents: number };
  markup: { pct: string; cents: number; definition: "markup_sobre_custo_total" };
  taxes: { configured: boolean; ratePct: string; minCents: number; idealCents: number; base: string };
  floorCents: number | null;
  recommendedCents: number | null;
  finalPriceCents: number | null;
  depositRecommendedCents: number | null;
  leadTime: { activeHours: string; dryingHours: string; subcontractDays: number; workingDays: number };
  commercial: { servicesCents: number; materialsCents: number; transportCents: number } | null;
  formula: string[];
}
