/** Cliente da API administrativa. A autenticação é feita pelo Cloudflare Access (cookie CF_Authorization). */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export async function api<T = unknown>(path: string, init: { method?: string; body?: unknown; idempotencyKey?: string } = {}): Promise<T> {
  const res = await fetch(`/api/v1/admin${path}`, {
    method: init.method ?? "GET",
    credentials: "same-origin",
    headers: {
      ...(init.body !== undefined ? { "content-type": "application/json" } : {}),
      ...(init.idempotencyKey ? { "Idempotency-Key": init.idempotencyKey } : {}),
    },
    ...(init.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
  });
  const ct = res.headers.get("content-type") ?? "";
  const data = ct.includes("json") ? await res.json() : null;
  if (!res.ok) {
    const err = (data as { error?: { code?: string; message?: string } } | null)?.error;
    throw new ApiError(res.status, err?.code ?? "ERRO", err?.message ?? `Erro ${res.status}`);
  }
  return data as T;
}

export function formatBRL(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "—";
  const neg = cents < 0;
  const abs = Math.abs(cents);
  const reais = Math.floor(abs / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${neg ? "-" : ""}R$ ${reais},${String(abs % 100).padStart(2, "0")}`;
}

/** "1.234,56" | "1234.56" | "90" → centavos inteiros (sem ponto flutuante). */
export function parseBRLToCents(input: string): number | null {
  const s = input.trim().replace(/^R\$\s*/i, "");
  if (!s) return null;
  let normalized = s;
  if (/,\d{1,2}$/.test(s)) normalized = s.replace(/\./g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const [int, frac = ""] = normalized.split(".");
  return Number(int) * 100 + Number(frac.padEnd(2, "0"));
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }).format(new Date(iso));
}

export function newIdempotencyKey(): string {
  return crypto.randomUUID();
}
