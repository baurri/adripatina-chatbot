/** Helpers finos sobre D1 (sem ORM — ver docs/DECISIONS.md, D-003). */

export type Row = Record<string, unknown>;
export type Param = string | number | null;

export class Db {
  constructor(readonly d1: D1Database) {}

  stmt(sql: string, ...params: Param[]): D1PreparedStatement {
    return this.d1.prepare(sql).bind(...params);
  }

  async first<T = Row>(sql: string, ...params: Param[]): Promise<T | null> {
    return (await this.stmt(sql, ...params).first<T>()) ?? null;
  }

  async all<T = Row>(sql: string, ...params: Param[]): Promise<T[]> {
    const r = await this.stmt(sql, ...params).all<T>();
    return r.results ?? [];
  }

  async run(sql: string, ...params: Param[]): Promise<number> {
    const r = await this.stmt(sql, ...params).run();
    return r.meta?.changes ?? 0;
  }

  /** Executa atomicamente (D1 batch = transação). */
  async batch(statements: D1PreparedStatement[]): Promise<D1Result[]> {
    if (statements.length === 0) return [];
    return this.d1.batch(statements);
  }
}

export function json<T>(value: unknown, fallback: T): T {
  if (typeof value !== "string" || value.length === 0) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function bool(v: unknown): boolean {
  return v === 1 || v === true || v === "1";
}
