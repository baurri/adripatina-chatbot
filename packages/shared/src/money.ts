import { Dec, type RoundingMode } from "./decimal.js";

/** Centavos inteiros (BRL). */
export type Cents = number;

export function assertCents(value: number, label = "valor"): Cents {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`${label} deve ser um número inteiro de centavos`);
  }
  return value;
}

export function reaisToCents(reais: string | number | Dec): Cents {
  return Dec.from(reais).toCents();
}

export function centsToDec(cents: Cents): Dec {
  return Dec.from(cents).div(100);
}

/** Multiplica centavos por um fator decimal e arredonda para centavos inteiros. */
export function mulCents(cents: Cents, factor: Dec | string | number, mode: RoundingMode = "HALF_UP"): Cents {
  return Dec.from(cents).mul(factor).toIntegerCents(mode);
}

export function sumCents(values: readonly Cents[]): Cents {
  let total = 0;
  for (const v of values) total += assertCents(v);
  return assertCents(total, "soma");
}

/** Formata centavos em BRL: 12345 → "R$ 123,45" */
export function formatBRL(cents: Cents): string {
  assertCents(cents);
  const negative = cents < 0;
  const abs = Math.abs(cents);
  const reais = Math.floor(abs / 100);
  const c = abs % 100;
  const reaisStr = reais.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${negative ? "-" : ""}R$ ${reaisStr},${c.toString().padStart(2, "0")}`;
}

/**
 * Distribui um total em centavos proporcionalmente aos pesos, garantindo que
 * a soma das partes seja exatamente o total (método do maior resto).
 */
export function allocateCents(total: Cents, weights: readonly Cents[]): Cents[] {
  assertCents(total, "total");
  const weightSum = weights.reduce((a, b) => a + b, 0);
  if (weights.length === 0) return [];
  if (weightSum <= 0) {
    const out = weights.map(() => 0);
    out[0] = total;
    return out;
  }
  const big = BigInt(total);
  const ws = BigInt(weightSum);
  const base = weights.map((w) => (big * BigInt(w)) / ws);
  const remainders = weights.map((w, i) => ({ i, r: (big * BigInt(w)) % ws }));
  let distributed = base.reduce((a, b) => a + b, 0n);
  remainders.sort((a, b) => (b.r > a.r ? 1 : b.r < a.r ? -1 : a.i - b.i));
  let k = 0;
  while (distributed < big && remainders.length > 0) {
    const idx = remainders[k % remainders.length]!.i;
    base[idx] = base[idx]! + 1n;
    distributed += 1n;
    k++;
  }
  return base.map((b) => Number(b));
}
