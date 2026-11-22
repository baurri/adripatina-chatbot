/**
 * Termos que NUNCA podem aparecer em um documento comercial.
 * Usado em testes e como verificação em tempo de execução antes de salvar.
 */
export const CONFIDENTIAL_TERMS = [
  "hora técnica",
  "valor/hora",
  "custo interno",
  "custo de reposição",
  "markup",
  "margem",
  "lucro",
  "piso",
  "risco",
  "fornecedor",
  "estoque",
  "desembolso",
  "coeficiente",
  "rendimento",
  "calibrad",
  "engine",
  "pricing-",
  "custo histórico",
];

export function findConfidentialTerms(texts: readonly string[]): string[] {
  const all = texts.join("\n").toLowerCase();
  return CONFIDENTIAL_TERMS.filter((t) => all.includes(t.toLowerCase()));
}
