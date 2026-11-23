/**
 * Vocabulários reutilizáveis: partes de móveis e danos/condições físicas.
 * Danos descrevem o ESTADO da peça e nunca o andamento do serviço.
 */

export interface PartDef {
  key: string;
  label: string;
  /** variações faladas (normalizadas sem acento no matcher) */
  variants: string[];
  measurable: boolean;
}

export const PARTS: PartDef[] = [
  { key: "tampo", label: "tampo", variants: ["tampo", "tampa da mesa", "superficie"], measurable: true },
  { key: "sobretampo", label: "sobretampo", variants: ["sobretampo", "sobre tampo"], measurable: true },
  { key: "frente", label: "frente", variants: ["frente", "frontal"], measurable: true },
  { key: "traseira", label: "traseira", variants: ["traseira", "costas do movel"], measurable: true },
  { key: "lateral_esquerda", label: "lateral esquerda", variants: ["lateral esquerda", "lado esquerdo"], measurable: true },
  { key: "lateral_direita", label: "lateral direita", variants: ["lateral direita", "lado direito"], measurable: true },
  { key: "lateral", label: "lateral", variants: ["lateral", "laterais", "lado", "lados"], measurable: true },
  { key: "fundo", label: "fundo", variants: ["fundo", "fundos"], measurable: true },
  { key: "base", label: "base", variants: ["base", "pe central", "coluna"], measurable: true },
  { key: "estrutura", label: "estrutura", variants: ["estrutura", "armacao", "esqueleto"], measurable: false },
  { key: "caixa", label: "caixa", variants: ["caixa", "corpo", "caixaria"], measurable: true },
  { key: "porta", label: "porta", variants: ["porta", "portas", "portinha"], measurable: true },
  { key: "porta_abrir", label: "porta de abrir", variants: ["porta de abrir", "portas de abrir"], measurable: true },
  { key: "porta_correr", label: "porta de correr", variants: ["porta de correr", "portas de correr", "corredica da porta"], measurable: true },
  { key: "gaveta", label: "gaveta", variants: ["gaveta", "gavetas", "gavetinha"], measurable: true },
  { key: "frente_gaveta", label: "frente de gaveta", variants: ["frente de gaveta", "frentes das gavetas"], measurable: true },
  { key: "fundo_gaveta", label: "fundo de gaveta", variants: ["fundo de gaveta", "fundo da gaveta"], measurable: true },
  { key: "corredica", label: "corrediça", variants: ["corredica", "corredicas", "trilho da gaveta"], measurable: false },
  { key: "puxador", label: "puxador", variants: ["puxador", "puxadores", "macaneta"], measurable: false },
  { key: "dobradica", label: "dobradiça", variants: ["dobradica", "dobradicas"], measurable: false },
  { key: "fechadura", label: "fechadura", variants: ["fechadura", "fechaduras", "tranca"], measurable: false },
  { key: "chave", label: "chave", variants: ["chave", "chaves"], measurable: false },
  { key: "pe", label: "pé", variants: ["pe", "pes", "pezinho"], measurable: false },
  { key: "perna", label: "perna", variants: ["perna", "pernas"], measurable: false },
  { key: "rodape", label: "rodapé", variants: ["rodape", "saia"], measurable: true },
  { key: "travessa", label: "travessa", variants: ["travessa", "travessas", "trave"], measurable: false },
  { key: "prateleira", label: "prateleira", variants: ["prateleira", "prateleiras"], measurable: true },
  { key: "nicho", label: "nicho", variants: ["nicho", "nichos"], measurable: true },
  { key: "divisoria", label: "divisória", variants: ["divisoria", "divisorias"], measurable: true },
  { key: "moldura", label: "moldura", variants: ["moldura", "molduras"], measurable: true },
  { key: "espelho", label: "espelho", variants: ["espelho", "espelhos"], measurable: true },
  { key: "vidro", label: "vidro", variants: ["vidro", "vidros", "vidraca"], measurable: true },
  { key: "grade", label: "grade", variants: ["grade", "grades", "grade de protecao"], measurable: true },
  { key: "estrado", label: "estrado", variants: ["estrado", "ripas"], measurable: true },
  { key: "cabeceira", label: "cabeceira", variants: ["cabeceira", "cabeceiras"], measurable: true },
  { key: "peseira", label: "peseira", variants: ["peseira", "pezeira"], measurable: true },
  { key: "braco", label: "braço", variants: ["braco", "bracos"], measurable: false },
  { key: "assento", label: "assento", variants: ["assento", "assentos"], measurable: true },
  { key: "encosto", label: "encosto", variants: ["encosto", "encostos"], measurable: true },
  { key: "estofado", label: "estofado", variants: ["estofado", "estofamento", "estofada"], measurable: false },
  { key: "almofada", label: "almofada", variants: ["almofada", "almofadas"], measurable: false },
  { key: "rodizio", label: "rodízio", variants: ["rodizio", "rodizios", "rodinha", "rodinhas", "roda", "rodas"], measurable: false },
  { key: "trilho", label: "trilho", variants: ["trilho", "trilhos"], measurable: false },
  { key: "extensao", label: "extensão", variants: ["extensao", "extensor", "extensores", "aba"], measurable: true },
  { key: "ferragem", label: "ferragem", variants: ["ferragem", "ferragens", "pistao", "pistoes"], measurable: false },
  { key: "ornamento", label: "ornamento", variants: ["ornamento", "ornamentos", "enfeite"], measurable: false },
  { key: "entalhe", label: "entalhe", variants: ["entalhe", "entalhes", "talha"], measurable: false },
  { key: "palhinha", label: "palhinha", variants: ["palhinha", "palha"], measurable: true },
  { key: "tecido", label: "tecido", variants: ["tecido", "pano"], measurable: false },
  { key: "couro", label: "couro", variants: ["couro", "courino", "corino"], measurable: false },
  { key: "formica", label: "fórmica", variants: ["formica"], measurable: true },
  { key: "laminado", label: "laminado", variants: ["laminado", "laminada"], measurable: true },
  { key: "lamina_madeira", label: "lâmina de madeira", variants: ["lamina de madeira", "folheado", "lamina"], measurable: true },
  { key: "escada", label: "escada", variants: ["escada", "escadinha"], measurable: false },
  { key: "tampa", label: "tampa", variants: ["tampa"], measurable: true },
  { key: "banco", label: "banco", variants: ["banquinho da penteadeira"], measurable: false },
  { key: "modulo", label: "módulo", variants: ["modulo", "modulos"], measurable: true },
  { key: "cama_auxiliar", label: "cama auxiliar", variants: ["cama auxiliar", "cama de baixo"], measurable: true },
];

export interface DamageDef {
  key: string;
  label: string;
  variants: string[];
  /** gravidade indicativa para o estado geral */
  severity: "leve" | "moderado" | "grave";
}

export const DAMAGES: DamageDef[] = [
  { key: "riscos", label: "riscos", variants: ["risco", "riscos", "riscado", "riscada", "arranhado", "arranhada", "arranhao"], severity: "leve" },
  { key: "manchas", label: "manchas", variants: ["mancha", "manchas", "manchado", "manchada"], severity: "leve" },
  { key: "verniz_descascando", label: "verniz descascando", variants: ["verniz descascando", "verniz soltando", "verniz saindo"], severity: "moderado" },
  { key: "tinta_descascando", label: "tinta descascando", variants: ["tinta descascando", "descascando", "descascado", "descascada"], severity: "moderado" },
  { key: "queimado_sol", label: "acabamento queimado pelo sol", variants: ["queimado do sol", "queimado pelo sol", "desbotado", "desbotada"], severity: "moderado" },
  { key: "umidade", label: "umidade", variants: ["umidade", "umido", "umida", "molhou", "infiltracao"], severity: "moderado" },
  { key: "mofo", label: "mofo", variants: ["mofo", "mofado", "mofada", "bolor"], severity: "moderado" },
  { key: "cupim", label: "cupim", variants: ["cupim", "cupins", "broca", "carunchado", "caruncho"], severity: "grave" },
  { key: "apodrecida", label: "madeira apodrecida", variants: ["podre", "apodrecido", "apodrecida", "apodrecendo"], severity: "grave" },
  { key: "rachadura", label: "rachadura", variants: ["rachado", "rachada", "rachadura", "trincado", "trincada"], severity: "moderado" },
  { key: "lasca", label: "lasca", variants: ["lascado", "lascada", "lasca", "lascou"], severity: "leve" },
  { key: "quebra", label: "quebra", variants: ["quebrado", "quebrada", "quebrou", "partido", "partida"], severity: "grave" },
  { key: "furo", label: "furo", variants: ["furo", "furado", "furada", "buraco"], severity: "moderado" },
  { key: "empenamento", label: "empenamento", variants: ["empenado", "empenada", "torto", "torta", "envergado"], severity: "moderado" },
  { key: "peca_solta", label: "peça solta", variants: ["solto", "solta", "soltando", "descolado", "descolada"], severity: "moderado" },
  { key: "pe_frouxo", label: "pé frouxo", variants: ["pe frouxo", "perna bamba", "bambo", "bamba", "balancando", "frouxo", "frouxa"], severity: "moderado" },
  { key: "gaveta_travando", label: "gaveta travando", variants: ["gaveta travando", "gaveta emperrada", "gaveta presa", "emperrada", "emperrado"], severity: "leve" },
  { key: "porta_desalinhada", label: "porta desalinhada", variants: ["porta desalinhada", "porta caida", "porta torta"], severity: "leve" },
  { key: "dobradica_quebrada", label: "dobradiça quebrada", variants: ["dobradica quebrada", "dobradica solta"], severity: "leve" },
  { key: "puxador_ausente", label: "puxador ausente", variants: ["sem puxador", "falta puxador", "puxador faltando"], severity: "leve" },
  { key: "ferragem_oxidada", label: "ferragem oxidada", variants: ["enferrujado", "enferrujada", "ferrugem", "oxidado", "oxidada"], severity: "leve" },
  { key: "vidro_quebrado", label: "vidro quebrado", variants: ["vidro quebrado", "vidro trincado"], severity: "moderado" },
  { key: "lamina_descolando", label: "lâmina descolando", variants: ["lamina descolando", "folheado soltando", "lamina soltando"], severity: "moderado" },
  { key: "formica_soltando", label: "fórmica soltando", variants: ["formica soltando", "formica descolando"], severity: "moderado" },
  { key: "cola_ressecada", label: "cola ressecada", variants: ["cola ressecada", "cola seca", "desmanchando"], severity: "moderado" },
  { key: "estofado_rasgado", label: "estofado rasgado", variants: ["estofado rasgado", "tecido rasgado", "rasgado", "rasgada"], severity: "moderado" },
  { key: "espuma_deformada", label: "espuma deformada", variants: ["espuma deformada", "espuma baixa", "afundado", "afundada"], severity: "moderado" },
  { key: "palhinha_rompida", label: "palhinha rompida", variants: ["palhinha rompida", "palhinha furada", "palha rasgada"], severity: "moderado" },
  { key: "parte_faltando", label: "parte faltando", variants: ["faltando", "falta uma", "falta um", "sumiu"], severity: "moderado" },
  { key: "reparo_estrutural", label: "reparo estrutural", variants: ["estrutura comprometida", "desmontando", "reparo estrutural"], severity: "grave" },
  { key: "desconhecida", label: "condição desconhecida", variants: ["nao sei como esta", "nao vi ainda", "ainda nao vi"], severity: "leve" },
];

export const DEFAULT_SERVICES = ["restauracao", "pintura_lisa", "verniz", "patina", "lixamento", "enceramento", "reparos"];
