import { Dec } from "@adripatina/shared";
import type { PricingSettings } from "./types.js";

/**
 * hora_objetivo = ((renda_mensal_alvo + custos_fixos_mensais) * (1 + reserva_geral)) / horas_produtivas
 * horas_produtivas = horas_disponiveis * aproveitamento
 *
 * Retorna centavos por hora como decimal exato (sem arredondar para R$ 40/R$ 52).
 */
export function productiveHours(s: PricingSettings): Dec {
  const hours = Dec.from(s.availableHoursPerMonth).mul(Dec.pct(s.productivityPct));
  if (!hours.gt(0)) throw new RangeError("Horas produtivas devem ser positivas");
  return hours;
}

export function hourlyRateCents(s: PricingSettings, incomeCents: number): Dec {
  const base = Dec.from(incomeCents).add(s.fixedCostsCents);
  return base.mul(Dec.ONE.add(Dec.pct(s.reservePct))).div(productiveHours(s));
}

export function hourlyRates(s: PricingSettings): { min: Dec; ideal: Dec; productive: Dec } {
  return {
    min: hourlyRateCents(s, s.incomeMinCents),
    ideal: hourlyRateCents(s, s.incomeIdealCents),
    productive: productiveHours(s),
  };
}
