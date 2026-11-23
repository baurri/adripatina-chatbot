import type { CatalogSource } from "./types.js";

/**
 * Fontes das referências dimensionais. Nenhuma faixa de mercado é chamada de "norma":
 * a única fonte regulatória (Inmetro) trata da OBRIGAÇÃO DE DECLARAR medidas e
 * tolerâncias de colchões — não fixa tamanhos de cama.
 */
export const CATALOG_SOURCES: CatalogSource[] = [
  {
    key: "inmetro_colchoes",
    kind: "regulatory",
    title: "Inmetro — marcações e informações obrigatórias de colchões e colchonetes de espuma",
    url: "https://www.gov.br/inmetro/pt-br/acesso-a-informacao/perguntas-frequentes/avaliacao-da-conformidade/colchoes-e-colchonetes-de-espuma/quais-sao-as-marcacoes-e-informacoes-obrigatorias-no-produto-e-na-embalagem-de-colchoes-e-colchonetes",
    note: "Exige declarar dimensões e tolerâncias do colchão; não padroniza o tamanho da cama nem da estrutura.",
  },
  {
    key: "mercado_colchoes",
    kind: "market_reference",
    title: "Medidas de colchão usuais no mercado brasileiro",
    url: null,
    note: "Solteiro 88×188, casal 138×188, queen 158×198, king 193×203 etc. Nomes e medidas variam entre fabricantes; referem-se ao colchão, não à estrutura externa.",
  },
  {
    key: "westwing_mesas",
    kind: "retailer_reference",
    title: "Westwing — mesas de jantar (faixas por quantidade de lugares)",
    url: "https://www.westwing.com.br/sala-de-jantar/mesas-de-jantar-1/",
    note: "Faixas usuais de varejo, não medidas obrigatórias.",
  },
  {
    key: "tokstok_mesas",
    kind: "retailer_reference",
    title: "Tok&Stok — mesas de jantar",
    url: "https://www.tokstok.com.br/moveis/mesas/mesas-de-jantar",
    note: "Capacidade depende de dimensões, formato e cadeiras.",
  },
  {
    key: "eneac_ergonomia",
    kind: "academic_reference",
    title: "ENEAC 2020 — ergonomia e dimensões mínimas de mobiliário",
    url: "https://pdf.blucher.com.br/designproceedings/eneac2020/99.pdf",
    note: "Referência acadêmica de dimensões e ergonomia.",
  },
  {
    key: "ufsc_mobiliario",
    kind: "academic_reference",
    title: "UFSC — dimensões usuais de mobiliário",
    url: "https://repositorio.ufsc.br/bitstream/handle/123456789/81094/147373.pdf",
    note: "Referência acadêmica com dimensões usuais.",
  },
  {
    key: "mercado_moveis",
    kind: "market_reference",
    title: "Faixas usuais de mercado para móveis residenciais",
    url: null,
    note: "Faixas indicativas para sugestão; a peça real deve ser medida.",
  },
  {
    key: "interno",
    kind: "internal_observation",
    title: "Observação interna (oficina)",
    url: null,
    note: "Sem referência dimensional externa; medir sempre.",
  },
];

export function sourceByKey(key: string): CatalogSource | undefined {
  return CATALOG_SOURCES.find((s) => s.key === key);
}
