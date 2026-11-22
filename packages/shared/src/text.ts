/** Normalização de texto pt-BR para comparação (sem acentos, minúsculas, espaços simples). */
export function normalizeText(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s,.$-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const HONORIFICS = ["dona", "dna", "d", "seu", "sr", "sra", "senhor", "senhora", "doutor", "doutora", "dr", "dra", "tia", "tio", "professora", "professor"];

/** Normaliza nome de pessoa removendo pronomes de tratamento: "Dona Maria" → "maria". */
export function normalizePersonName(input: string): string {
  const tokens = normalizeText(input)
    .replace(/[.,]/g, " ")
    .split(" ")
    .filter(Boolean);
  while (tokens.length > 1 && HONORIFICS.includes(tokens[0]!)) tokens.shift();
  return tokens.join(" ");
}

export function tokenize(input: string): string[] {
  return normalizeText(input)
    .replace(/[.,$]/g, " ")
    .split(" ")
    .filter((t) => t.length > 0);
}

/** Distância de Levenshtein (para apelidos e erros de transcrição). */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(cur[j - 1]! + 1, prev[j]! + 1, prev[j - 1]! + cost);
    }
    prev = cur;
  }
  return prev[b.length]!;
}

/** Similaridade 0..1 baseada em Levenshtein. */
export function similarity(a: string, b: string): number {
  if (!a && !b) return 1;
  const max = Math.max(a.length, b.length);
  return max === 0 ? 1 : 1 - levenshtein(a, b) / max;
}

/** Similaridade de Jaccard entre conjuntos de tokens. */
export function jaccard(a: readonly string[], b: readonly string[]): number {
  const sa = new Set(a);
  const sb = new Set(b);
  if (sa.size === 0 && sb.size === 0) return 0;
  let inter = 0;
  for (const t of sa) if (sb.has(t)) inter++;
  return inter / (sa.size + sb.size - inter);
}

export function capitalize(s: string): string {
  return s.length === 0 ? s : s[0]!.toUpperCase() + s.slice(1);
}
