import { DatabaseSync, type StatementSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Implementação mínima da API D1 sobre `node:sqlite` (SQLite real) para testes
 * de integração. Executa as MESMAS migrations de produção.
 */
type Value = string | number | null;

class ShimStatement {
  constructor(
    private readonly db: DatabaseSync,
    readonly sql: string,
    readonly params: Value[] = [],
  ) {}
  bind(...params: Value[]): ShimStatement {
    return new ShimStatement(this.db, this.sql, params.map((p) => (p === undefined ? null : p)));
  }
  private prepared(): StatementSync {
    return this.db.prepare(this.sql);
  }
  async first<T>(col?: string): Promise<T | null> {
    const row = this.prepared().get(...this.params) as Record<string, unknown> | undefined;
    if (!row) return null;
    return (col ? row[col] : row) as T;
  }
  async all<T>(): Promise<{ results: T[]; success: true; meta: { changes: number } }> {
    const rows = this.prepared().all(...this.params) as T[];
    return { results: rows, success: true, meta: { changes: 0 } };
  }
  async run(): Promise<{ success: true; meta: { changes: number; last_row_id: number } }> {
    if (/\breturning\b/i.test(this.sql)) {
      const rows = this.prepared().all(...this.params);
      return { success: true, meta: { changes: rows.length, last_row_id: 0 } };
    }
    const r = this.prepared().run(...this.params);
    return { success: true, meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } };
  }
  runSync(): { changes: number } {
    if (/^\s*(select|with)\b/i.test(this.sql) || /\breturning\b/i.test(this.sql)) {
      const rows = this.prepared().all(...this.params);
      return { changes: rows.length };
    }
    return { changes: Number(this.prepared().run(...this.params).changes) };
  }
}

export class D1Shim {
  readonly raw: DatabaseSync;
  constructor() {
    this.raw = new DatabaseSync(":memory:");
    this.raw.exec("PRAGMA foreign_keys = ON;");
  }
  prepare(sql: string): ShimStatement {
    return new ShimStatement(this.raw, sql);
  }
  async batch(statements: ShimStatement[]): Promise<{ success: true; meta: { changes: number } }[]> {
    this.raw.exec("BEGIN");
    try {
      const out = statements.map((s) => ({ success: true as const, meta: { changes: s.runSync().changes } }));
      this.raw.exec("COMMIT");
      return out;
    } catch (e) {
      this.raw.exec("ROLLBACK");
      throw e;
    }
  }
  async exec(sql: string): Promise<{ count: number }> {
    this.raw.exec(sql);
    return { count: 1 };
  }
  applyMigrations(dir: string): void {
    for (const f of readdirSync(dir).filter((x) => x.endsWith(".sql")).sort()) {
      this.raw.exec(readFileSync(join(dir, f), "utf8"));
    }
  }
}

export class MemoryBucket {
  readonly objects = new Map<string, { bytes: Uint8Array; contentType?: string }>();
  async put(key: string, value: ArrayBuffer | Uint8Array, options?: { httpMetadata?: { contentType?: string } }): Promise<void> {
    const bytes = value instanceof Uint8Array ? new Uint8Array(value) : new Uint8Array(value);
    this.objects.set(key, { bytes, ...(options?.httpMetadata?.contentType ? { contentType: options.httpMetadata.contentType } : {}) });
  }
  async get(key: string) {
    const o = this.objects.get(key);
    if (!o) return null;
    return {
      arrayBuffer: async () => o.bytes.slice().buffer as ArrayBuffer,
      httpMetadata: o.contentType ? { contentType: o.contentType } : {},
    };
  }
  async delete(key: string): Promise<void> {
    this.objects.delete(key);
  }
}
