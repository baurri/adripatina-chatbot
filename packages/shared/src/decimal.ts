/**
 * Decimal exato de ponto fixo baseado em BigInt (escala 10^9).
 * Usado para áreas, quantidades, percentuais e cálculos intermediários.
 * Dinheiro é sempre persistido em centavos inteiros; conversões passam por
 * `toCents()` com arredondamento explícito (meio para cima, "half-up").
 *
 * Nunca usar `number` de ponto flutuante para dinheiro.
 */

const SCALE_DIGITS = 9;
const SCALE = 10n ** BigInt(SCALE_DIGITS);

export type RoundingMode = "HALF_UP" | "UP" | "DOWN";

function divRound(num: bigint, den: bigint, mode: RoundingMode): bigint {
  if (den === 0n) throw new RangeError("Divisão por zero");
  const negative = num < 0n !== den < 0n;
  const n = num < 0n ? -num : num;
  const d = den < 0n ? -den : den;
  const q = n / d;
  const r = n % d;
  let result = q;
  if (r !== 0n) {
    if (mode === "UP") result = q + 1n;
    else if (mode === "HALF_UP" && r * 2n >= d) result = q + 1n;
  }
  return negative ? -result : result;
}

export class Dec {
  /** valor bruto escalado por 10^9 */
  readonly raw: bigint;

  private constructor(raw: bigint) {
    this.raw = raw;
  }

  static readonly ZERO = new Dec(0n);
  static readonly ONE = new Dec(SCALE);

  static fromRaw(raw: bigint): Dec {
    return new Dec(raw);
  }

  /** Aceita "1.80", "1,80", "-3", 2 (inteiro), 0.75 (convertido via string). */
  static from(value: string | number | bigint | Dec): Dec {
    if (value instanceof Dec) return value;
    if (typeof value === "bigint") return new Dec(value * SCALE);
    if (typeof value === "number") {
      if (!Number.isFinite(value)) throw new RangeError(`Número inválido: ${value}`);
      if (Number.isInteger(value)) return new Dec(BigInt(value) * SCALE);
      // limita a precisão para evitar artefatos binários (ex.: 0.1+0.2)
      return Dec.parse(value.toFixed(SCALE_DIGITS));
    }
    return Dec.parse(value);
  }

  static parse(input: string): Dec {
    const s = input.trim().replace(/\s/g, "").replace(",", ".");
    if (!/^-?\d+(\.\d+)?$/.test(s)) throw new RangeError(`Decimal inválido: "${input}"`);
    const negative = s.startsWith("-");
    const body = negative ? s.slice(1) : s;
    const [intPart, fracPartRaw = ""] = body.split(".");
    const fracPart = fracPartRaw.slice(0, SCALE_DIGITS).padEnd(SCALE_DIGITS, "0");
    // arredonda dígitos excedentes (half-up)
    let raw = BigInt(intPart ?? "0") * SCALE + BigInt(fracPart || "0");
    const extra = fracPartRaw.slice(SCALE_DIGITS);
    if (extra.length > 0 && Number(extra[0]) >= 5) raw += 1n;
    return new Dec(negative ? -raw : raw);
  }

  static tryParse(input: string | null | undefined): Dec | null {
    if (input === null || input === undefined) return null;
    try {
      return Dec.parse(input);
    } catch {
      return null;
    }
  }

  /** Percentual inteiro/decimal → fração. Ex.: pct(15) = 0.15 */
  static pct(value: string | number | Dec): Dec {
    return Dec.from(value).div(100);
  }

  add(other: Dec | string | number): Dec {
    return new Dec(this.raw + Dec.from(other).raw);
  }
  sub(other: Dec | string | number): Dec {
    return new Dec(this.raw - Dec.from(other).raw);
  }
  mul(other: Dec | string | number, mode: RoundingMode = "HALF_UP"): Dec {
    return new Dec(divRound(this.raw * Dec.from(other).raw, SCALE, mode));
  }
  div(other: Dec | string | number, mode: RoundingMode = "HALF_UP"): Dec {
    const o = Dec.from(other);
    if (o.raw === 0n) throw new RangeError("Divisão por zero");
    return new Dec(divRound(this.raw * SCALE, o.raw, mode));
  }
  neg(): Dec {
    return new Dec(-this.raw);
  }
  cmp(other: Dec | string | number): -1 | 0 | 1 {
    const o = Dec.from(other).raw;
    return this.raw < o ? -1 : this.raw > o ? 1 : 0;
  }
  eq(other: Dec | string | number): boolean {
    return this.cmp(other) === 0;
  }
  gt(other: Dec | string | number): boolean {
    return this.cmp(other) > 0;
  }
  gte(other: Dec | string | number): boolean {
    return this.cmp(other) >= 0;
  }
  lt(other: Dec | string | number): boolean {
    return this.cmp(other) < 0;
  }
  lte(other: Dec | string | number): boolean {
    return this.cmp(other) <= 0;
  }
  isZero(): boolean {
    return this.raw === 0n;
  }
  isNegative(): boolean {
    return this.raw < 0n;
  }
  static max(a: Dec, b: Dec): Dec {
    return a.gte(b) ? a : b;
  }
  static min(a: Dec, b: Dec): Dec {
    return a.lte(b) ? a : b;
  }

  /** Arredonda para N casas decimais. */
  round(places: number, mode: RoundingMode = "HALF_UP"): Dec {
    if (places >= SCALE_DIGITS) return this;
    const unit = 10n ** BigInt(SCALE_DIGITS - places);
    return new Dec(divRound(this.raw, unit, mode) * unit);
  }

  /** Teto inteiro (para embalagens). */
  ceilInt(): bigint {
    return divRound(this.raw, SCALE, "UP");
  }

  /** Converte um valor em REAIS para centavos inteiros. */
  toCents(mode: RoundingMode = "HALF_UP"): number {
    const cents = divRound(this.raw * 100n, SCALE, mode);
    const n = Number(cents);
    if (!Number.isSafeInteger(n)) throw new RangeError("Valor monetário fora do intervalo seguro");
    return n;
  }

  /** Interpreta este decimal como centavos (já em centavos) e arredonda para inteiro. */
  toIntegerCents(mode: RoundingMode = "HALF_UP"): number {
    const n = Number(divRound(this.raw, SCALE, mode));
    if (!Number.isSafeInteger(n)) throw new RangeError("Valor monetário fora do intervalo seguro");
    return n;
  }

  toString(places?: number): string {
    const value = places === undefined ? this : this.round(places);
    const negative = value.raw < 0n;
    const abs = negative ? -value.raw : value.raw;
    const intPart = abs / SCALE;
    let frac = (abs % SCALE).toString().padStart(SCALE_DIGITS, "0");
    if (places === undefined) frac = frac.replace(/0+$/, "");
    else frac = frac.slice(0, places);
    return `${negative ? "-" : ""}${intPart}${frac ? "." + frac : ""}`;
  }

  toNumber(): number {
    return Number(this.toString());
  }

  toJSON(): string {
    return this.toString();
  }
}
