import { Dec, allocateCents } from "@adripatina/shared";
import { hourlyRates } from "./hourly.js";
import {
  PricingInputSchema,
  type BlockerCode,
  type Issue,
  type LaborLine,
  type MaterialLine,
  type PricingCatalog,
  type PricingInput,
  type PricingResult,
  type PricingSettings,
  type RecipeStep,
  type SubcontractLine,
  type WarningCode,
} from "./types.js";

export const ENGINE_VERSION = "pricing-1.0.0";

interface StepInstance {
  step: RecipeStep;
  techniqueKey: string;
  hours: Dec;
  drying: Dec;
}

export interface PriceOptions {
  now?: Date;
}

/**
 * Motor determinístico de precificação. Função pura: mesma entrada → mesma saída.
 * Nenhum valor vem de IA. Valores desconhecidos geram bloqueios, nunca zero.
 */
export function priceJob(
  rawInput: PricingInput,
  settings: PricingSettings,
  catalog: PricingCatalog,
  opts: PriceOptions = {},
): PricingResult {
  const input = PricingInputSchema.parse(rawInput);
  const now = opts.now ?? new Date();
  const blockers: Issue<BlockerCode>[] = [];
  const warnings: Issue<WarningCode>[] = [];
  const formula: string[] = [];
  const uncalibrated: string[] = [];

  const rates = hourlyRates(settings);
  formula.push(
    "hora_objetivo = ((renda_mensal_alvo + custos_fixos) × (1 + reserva_geral)) ÷ horas_produtivas",
    `horas_produtivas = ${settings.availableHoursPerMonth} × ${settings.productivityPct}% = ${rates.productive.toString(2)} h`,
  );

  // ---------- 1. Geometria ----------
  let area: Dec | null = null;
  if (input.area === null) {
    blockers.push({ code: "AREA_UNKNOWN", message: "Falta saber o tamanho do móvel (medidas ou porte)." });
  } else if (input.area.kind === "exact") {
    area = Dec.from(input.area.m2);
  } else {
    // intervalo: usa o máximo (conservador, protege contra prejuízo)
    area = Dec.from(input.area.maxM2);
    warnings.push({
      code: "AREA_RANGE_MAX_USED",
      message: `Área estimada entre ${input.area.minM2} e ${input.area.maxM2} m²; usado o maior valor (${input.area.source}).`,
    });
  }
  if (area && !area.gt(0)) {
    blockers.push({ code: "AREA_UNKNOWN", message: "Área deve ser maior que zero." });
    area = null;
  }

  // ---------- 2. Receita técnica ----------
  if (input.techniqueKeys.length === 0) {
    blockers.push({ code: "TECHNIQUE_UNKNOWN", message: "Falta definir a técnica." });
  }
  const techniques = input.techniqueKeys.map((k) => {
    const t = catalog.techniques[k];
    if (!t) blockers.push({ code: "TECHNIQUE_UNKNOWN", message: `Técnica não cadastrada: ${k}`, ref: k });
    else if (!t.calibrated) uncalibrated.push(`técnica ${t.name}`);
    return t;
  });

  const needsMethod = techniques.some((t) => t?.steps.some((s) => s.kind === "coating"));
  const method = input.methodKey ? catalog.methods[input.methodKey] : undefined;
  if (needsMethod && !method) {
    blockers.push({ code: "METHOD_REQUIRED", message: "Falta definir o método de aplicação (pincel, rolo ou pistola)." });
  }
  if (method && !method.calibrated) uncalibrated.push(`método ${method.name}`);

  // ---------- 3/4. Mão de obra por etapas deduplicadas ----------
  const instances: StepInstance[] = [];
  if (area) {
    for (const t of techniques) {
      if (!t) continue;
      for (const step of t.steps) {
        const hours = stepHours(step, area, method?.speedM2PerHour, method?.setupHours, method?.cleanupHours);
        if (hours === null) continue; // coating sem método → já bloqueado
        instances.push({ step, techniqueKey: t.key, hours, drying: Dec.from(step.dryingHours ?? "0") });
      }
    }
  }

  const dedupedSteps = dedupeSteps(instances);
  const laborLines: LaborLine[] = dedupedSteps.map((d) => ({
    stepKey: d.chosen.step.key,
    label: d.chosen.step.label,
    techniqueKeys: d.techniqueKeys,
    hours: d.chosen.hours.round(3).toString(),
    dryingHours: d.chosen.drying.toString(),
    dedupedFrom: d.dedupedFrom,
  }));
  for (const extra of input.extraLabor) {
    laborLines.push({
      stepKey: "extra",
      label: extra.description,
      techniqueKeys: [],
      hours: Dec.from(extra.hours).round(3).toString(),
      dryingHours: "0",
      dedupedFrom: [],
    });
  }
  const totalHours = laborLines.reduce((acc, l) => acc.add(l.hours), Dec.ZERO);
  const totalDrying = laborLines.reduce((acc, l) => acc.add(l.dryingHours), Dec.ZERO);
  const laborMinCents = totalHours.mul(rates.min).toIntegerCents("UP");
  const laborIdealCents = totalHours.mul(rates.ideal).toIntegerCents("UP");
  formula.push("mão_de_obra = Σ horas_ativas_etapa × hora_objetivo (secagem não é hora ativa)");

  // ---------- 5. Materiais (FIN-ESTOQUE-001) ----------
  const qtyByMaterial = new Map<string, Dec>();
  for (const d of dedupedSteps) {
    const step = d.chosen.step;
    for (const sm of step.materials) {
      if (input.excludedMaterialKeys.includes(sm.materialKey)) continue;
      const mat = catalog.materials[sm.materialKey];
      if (!mat) {
        blockers.push({ code: "MATERIAL_UNKNOWN", message: `Material não cadastrado: ${sm.materialKey}`, ref: sm.materialKey });
        continue;
      }
      if (!area) continue;
      let qty: Dec | null = null;
      if (sm.mode === "coverage") {
        if (mat.yieldM2PerUnitPerCoat === null || !Dec.from(mat.yieldM2PerUnitPerCoat).gt(0)) {
          blockers.push({
            code: "MATERIAL_YIELD_MISSING",
            message: `Falta o rendimento de ${mat.name}.`,
            ref: mat.key,
          });
          continue;
        }
        // perda do método de aplicação em revestimentos; senão perda do material
        const loss = Dec.pct(step.kind === "coating" && method ? method.lossPct : mat.lossPct);
        if (!Dec.ONE.sub(loss).gt(0)) throw new RangeError(`Perda inválida para ${mat.key}`);
        const coats = step.coats ?? 1;
        // litros = área × demãos ÷ rendimento ÷ (1 − perda)
        qty = area.mul(coats).div(mat.yieldM2PerUnitPerCoat).div(Dec.ONE.sub(loss));
      } else if (sm.mode === "per_m2") {
        const loss = Dec.pct(mat.lossPct);
        qty = area.mul(sm.quantityPerM2).div(Dec.ONE.sub(loss));
      } else {
        qty = Dec.from(sm.quantity);
      }
      if (!mat.calibrated) uncalibrated.push(`material ${mat.name}`);
      qtyByMaterial.set(mat.key, (qtyByMaterial.get(mat.key) ?? Dec.ZERO).add(qty));
    }
  }
  formula.push(
    "quantidade = área × demãos ÷ rendimento ÷ (1 − perda)",
    "custo_consumo = quantidade × (preço_reposição_embalagem ÷ volume_embalagem) — inclui material já em estoque",
    "desembolso_compra = embalagens_faltantes × preço_reposição_embalagem",
  );

  const materialLines: MaterialLine[] = [];
  const missingPrices: string[] = [];
  let consumptionTotal = 0;
  let purchaseTotal = 0;
  let historicalTotal = 0;
  for (const [key, rawQty] of qtyByMaterial) {
    const mat = catalog.materials[key]!;
    const qty = rawQty.round(4, "UP");
    const pkg = Dec.from(mat.packageSize);
    if (!pkg.gt(0)) throw new RangeError(`Embalagem inválida para ${mat.key}`);
    const inv = input.inventory[key];
    const available = inv ? Dec.max(Dec.from(inv.quantity), Dec.ZERO) : Dec.ZERO;
    const used = Dec.min(available, qty);
    const purchaseQty = Dec.max(qty.sub(available), Dec.ZERO);
    const packages = purchaseQty.isZero() ? 0 : Number(purchaseQty.div(pkg, "UP").ceilInt());

    let unitCost: Dec | null = null;
    let consumption: number | null = null;
    let purchase: number | null = null;
    let stale = false;
    if (mat.replacementPriceCents === null) {
      missingPrices.push(mat.name);
      blockers.push({
        code: "MATERIAL_PRICE_MISSING",
        message: `Falta o preço atual de ${mat.name}. Não é possível considerar custo zero.`,
        ref: mat.key,
      });
    } else {
      unitCost = Dec.from(mat.replacementPriceCents).div(pkg);
      consumption = qty.mul(unitCost).toIntegerCents("UP");
      purchase = packages * mat.replacementPriceCents;
      consumptionTotal += consumption;
      purchaseTotal += purchase;
      if (mat.priceUpdatedAt) {
        const ageDays = (now.getTime() - new Date(mat.priceUpdatedAt).getTime()) / 86_400_000;
        stale = ageDays > settings.stalePriceDays;
      } else stale = true;
      if (stale)
        warnings.push({ code: "STALE_PRICE", message: `Preço de ${mat.name} pode estar desatualizado.`, ref: mat.key });
    }
    let historical: number | null = null;
    if (inv?.historicalUnitCostCents !== undefined && used.gt(0)) {
      historical = used.mul(inv.historicalUnitCostCents).toIntegerCents();
      historicalTotal += historical;
    }
    materialLines.push({
      materialKey: key,
      name: mat.name,
      unit: mat.unit,
      quantity: qty.toString(),
      replacementUnitCostCents: unitCost ? unitCost.round(4).toString() : null,
      consumptionCostCents: consumption,
      inventoryAvailable: available.toString(),
      inventoryUsed: used.toString(),
      purchaseQuantity: purchaseQty.toString(),
      packagesToBuy: packages,
      purchaseCashOutlayCents: purchase,
      historicalCostOfInventoryUsedCents: historical,
      priceStale: stale,
    });
  }

  // ---------- 6. Terceiros ----------
  const coordPct = Dec.pct(settings.subcontractCoordinationPct);
  const subLines: SubcontractLine[] = input.subcontracts.map((s) => {
    if (!s.confirmed || s.costCents === null) {
      blockers.push({
        code: "SUBCONTRACT_UNCONFIRMED",
        message: `Serviço de terceiro sem cotação confirmada: ${s.description}.`,
        ref: s.description,
      });
    }
    const base = (s.costCents ?? 0) + s.logisticsCents;
    const fee = s.costCents === null ? 0 : Dec.from(base).mul(coordPct).toIntegerCents("UP");
    return {
      description: s.description,
      costCents: s.costCents,
      logisticsCents: s.logisticsCents,
      coordinationFeeCents: fee,
      totalCents: s.costCents === null ? null : base + fee,
      confirmed: s.confirmed,
    };
  });
  const subTotal = subLines.reduce((a, l) => a + (l.totalCents ?? 0), 0);

  // ---------- 7. Despesas específicas ----------
  const transport = input.specificExpenses.filter((e) => e.category === "transporte").reduce((a, e) => a + e.amountCents, 0);
  const otherExp = input.specificExpenses.filter((e) => e.category === "outros").reduce((a, e) => a + e.amountCents, 0);

  // ---------- Calibração ----------
  if (uncalibrated.length > 0) {
    const list = [...new Set(uncalibrated)].join(", ");
    if (input.approvals.uncalibrated) {
      warnings.push({ code: "UNCALIBRATED_APPROVED", message: `Parâmetros não calibrados aprovados pelo administrador: ${list}.` });
    } else {
      blockers.push({
        code: "UNCALIBRATED_PARAMETERS",
        message: `Parâmetros ainda NÃO CALIBRADOS: ${list}. Proposta definitiva exige revisão do administrador.`,
      });
    }
  }

  const computable = area !== null && !blockers.some((b) => ["AREA_UNKNOWN", "TECHNIQUE_UNKNOWN", "METHOD_REQUIRED", "MATERIAL_UNKNOWN"].includes(b.code));

  // ---------- 8/9/10. Risco, markup, tributos, piso e recomendado ----------
  const directCosts = consumptionTotal + subTotal + transport + otherExp;
  const riskPct = input.specificRisk ? Dec.pct(input.specificRisk.pct) : Dec.ZERO;
  if (input.specificRisk) {
    warnings.push({ code: "SPECIFIC_RISK_APPLIED", message: `Risco específico de ${input.specificRisk.pct}%: ${input.specificRisk.reason}` });
  }
  const taxRate = settings.taxConfigured ? Dec.pct(settings.taxRatePct) : Dec.ZERO;
  if (!settings.taxConfigured) {
    warnings.push({ code: "TAX_NOT_CONFIGURED", message: "Tributos não configurados — preço sem impostos. Confirme o enquadramento fiscal." });
  }
  if (!Dec.ONE.sub(taxRate).gt(0)) throw new RangeError("Alíquota inválida");
  const markupPct = Dec.pct(settings.commercialMarkupPct);

  const baseMin = laborMinCents + directCosts;
  const riskMin = Dec.from(baseMin).mul(riskPct).toIntegerCents("UP");
  const preTaxMin = baseMin + riskMin;
  const floorRaw = Dec.from(preTaxMin).div(Dec.ONE.sub(taxRate)).toIntegerCents("UP");
  const taxMin = floorRaw - preTaxMin;

  const baseIdeal = laborIdealCents + directCosts;
  const riskIdeal = Dec.from(baseIdeal).mul(riskPct).toIntegerCents("UP");
  const markupCents = Dec.from(baseIdeal + riskIdeal).mul(markupPct).toIntegerCents("UP");
  const preTaxIdeal = baseIdeal + riskIdeal + markupCents;
  const recRaw = Dec.from(preTaxIdeal).div(Dec.ONE.sub(taxRate)).toIntegerCents("UP");
  const rounding = settings.recommendedRoundingCents;
  const recommendedRounded = Math.ceil(recRaw / rounding) * rounding;
  formula.push(
    "piso = (mão_de_obra(hora_mínima) + materiais_consumidos + terceiros + despesas) × (1 + risco_específico) ÷ (1 − alíquota)",
    "recomendado = (mão_de_obra(hora_ideal) + materiais_consumidos + terceiros + despesas) × (1 + risco_específico) × (1 + markup_sobre_custo) ÷ (1 − alíquota), arredondado para cima",
    "reserva geral e custos fixos já estão na hora — não são somados de novo",
  );

  const floorCents = computable ? floorRaw : null;
  const recommendedCents = computable ? Math.max(recommendedRounded, floorRaw) : null;
  let finalPriceCents: number | null = computable ? (input.proposedPriceCents ?? recommendedCents) : null;

  if (computable && finalPriceCents !== null && floorCents !== null && finalPriceCents < floorCents) {
    if (input.approvals.belowFloor) {
      warnings.push({ code: "BELOW_FLOOR_APPROVED", message: "Preço abaixo do piso com aprovação administrativa registrada." });
    } else {
      blockers.push({
        code: "BELOW_FLOOR",
        message: "O preço proposto está abaixo do piso. Precisa de aprovação do administrador.",
      });
    }
  }
  if (!computable) finalPriceCents = null;

  const depositRecommendedCents =
    finalPriceCents === null
      ? null
      : Math.max(
          Dec.from(finalPriceCents).mul(Dec.pct(settings.depositPct)).toIntegerCents("UP"),
          purchaseTotal + subTotal + transport, // entrada cobre compras, terceiros e logística iniciais
        );

  // ---------- Prazo ----------
  const hoursPerDay = Dec.from(settings.hoursPerWorkday);
  const subDays = input.subcontracts.reduce((a, s) => Math.max(a, s.leadDays ?? 0), 0);
  const workDays = Number(totalHours.div(hoursPerDay, "UP").ceilInt()) + Number(totalDrying.div(24, "UP").ceilInt()) + subDays;

  // ---------- Comercial (sem custos internos) ----------
  let commercial: PricingResult["commercial"] = null;
  if (finalPriceCents !== null) {
    const servicesWeight = laborIdealCents + subTotal + otherExp;
    const [servicesCents, materialsCents, transportCents] = allocateCents(finalPriceCents, [
      Math.max(servicesWeight, 1),
      consumptionTotal,
      transport,
    ]);
    commercial = { servicesCents: servicesCents!, materialsCents: materialsCents!, transportCents: transportCents! };
  }

  const definitiveAllowed = computable && blockers.length === 0;
  const confidence: PricingResult["confidence"] =
    blockers.length > 0 ? "baixa" : warnings.some((w) => w.code === "AREA_RANGE_MAX_USED" || w.code === "STALE_PRICE" || w.code === "UNCALIBRATED_APPROVED") ? "media" : "alta";

  return {
    engineVersion: ENGINE_VERSION,
    computable,
    definitiveAllowed,
    confidence,
    blockers,
    warnings,
    areaM2: area ? area.toString() : null,
    hourlyRate: {
      minCentsPerHour: rates.min.round(4).toString(),
      idealCentsPerHour: rates.ideal.round(4).toString(),
      productiveHours: rates.productive.toString(),
    },
    labor: { lines: laborLines, totalHours: totalHours.round(3).toString(), minCents: laborMinCents, idealCents: laborIdealCents },
    materials: {
      lines: materialLines,
      consumptionCostCents: consumptionTotal,
      purchaseCashOutlayCents: purchaseTotal,
      historicalCostOfInventoryUsedCents: historicalTotal,
      missingPrices,
    },
    subcontracts: { lines: subLines, totalCents: subTotal },
    expenses: { transportCents: transport, otherCents: otherExp, totalCents: transport + otherExp },
    risk: { pct: input.specificRisk?.pct ?? "0", reason: input.specificRisk?.reason ?? null, minCents: riskMin, idealCents: riskIdeal },
    markup: { pct: settings.commercialMarkupPct, cents: markupCents, definition: "markup_sobre_custo_total" },
    taxes: {
      configured: settings.taxConfigured,
      ratePct: settings.taxConfigured ? settings.taxRatePct : "0",
      minCents: taxMin,
      idealCents: settings.taxConfigured ? recRaw - preTaxIdeal : 0,
      base: "preço final (gross-up: preço = base ÷ (1 − alíquota))",
    },
    floorCents,
    recommendedCents,
    finalPriceCents,
    depositRecommendedCents,
    leadTime: {
      activeHours: totalHours.round(2).toString(),
      dryingHours: totalDrying.toString(),
      subcontractDays: subDays,
      workingDays: workDays,
    },
    commercial,
    formula,
  };
}

function stepHours(
  step: RecipeStep,
  area: Dec,
  speed: string | undefined,
  setup: string | undefined,
  cleanup: string | undefined,
): Dec | null {
  const fixed = Dec.from(step.fixedHours ?? "0");
  if (step.kind === "labor") {
    return area.mul(step.laborHoursPerM2 ?? "0").add(fixed);
  }
  if (!speed) return null;
  const sp = Dec.from(speed);
  if (!sp.gt(0)) throw new RangeError("Velocidade de aplicação deve ser positiva");
  const coats = step.coats ?? 1;
  // aplicação: área × demãos ÷ velocidade + preparo + limpeza do equipamento (por etapa)
  return area.mul(coats).div(sp).add(setup ?? "0").add(cleanup ?? "0").add(fixed);
}

/**
 * Técnicas combinadas: etapas com o mesmo `sharedKey` (ex.: lixamento, limpeza,
 * montagem) são executadas uma só vez — mantém-se a de maior esforço.
 */
function dedupeSteps(instances: StepInstance[]): { chosen: StepInstance; techniqueKeys: string[]; dedupedFrom: string[] }[] {
  const out: { chosen: StepInstance; techniqueKeys: string[]; dedupedFrom: string[] }[] = [];
  const byShared = new Map<string, number>();
  for (const inst of instances) {
    const sk = inst.step.sharedKey;
    if (!sk) {
      out.push({ chosen: inst, techniqueKeys: [inst.techniqueKey], dedupedFrom: [] });
      continue;
    }
    const idx = byShared.get(sk);
    if (idx === undefined) {
      byShared.set(sk, out.length);
      out.push({ chosen: inst, techniqueKeys: [inst.techniqueKey], dedupedFrom: [] });
      continue;
    }
    const existing = out[idx]!;
    existing.techniqueKeys.push(inst.techniqueKey);
    if (inst.hours.gt(existing.chosen.hours)) {
      existing.dedupedFrom.push(`${existing.chosen.techniqueKey}:${existing.chosen.step.key}`);
      existing.chosen = inst;
    } else {
      existing.dedupedFrom.push(`${inst.techniqueKey}:${inst.step.key}`);
    }
  }
  return out;
}
