import type { DimValue, FurnitureCategory, FurnitureTypeDef, QuoteFieldKey, SizePreset } from "./types.js";
import { DEFAULT_SERVICES } from "./vocab.js";

/**
 * Catálogo mestre de móveis (fonte da verdade da carga inicial).
 * Chaves canônicas são ESTÁVEIS: nunca renomear (históricos apontam para elas).
 * Faixas são indicativas; presets de cama referem-se ao COLCHÃO, não à estrutura.
 */

const R = (min: number, max: number) => ({ min, max });

type PresetDims = Pick<SizePreset, "widthCm" | "lengthCm" | "depthCm" | "heightCm" | "diameterCm" | "shape">;
function preset(
  key: string,
  label: string,
  dimensionKind: SizePreset["dimensionKind"],
  dims: PresetDims,
  opts: Partial<Pick<SizePreset, "isMarketReference" | "isStandardized" | "requiresConfirmation" | "autoSuggest" | "sourceKey" | "note">> = {},
): SizePreset {
  return {
    key,
    label,
    dimensionKind,
    ...dims,
    isMarketReference: opts.isMarketReference ?? true,
    isStandardized: opts.isStandardized ?? false,
    requiresConfirmation: opts.requiresConfirmation ?? true,
    autoSuggest: opts.autoSuggest ?? false,
    sourceKey: opts.sourceKey ?? "mercado_moveis",
    ...(opts.note ? { note: opts.note } : {}),
  };
}

const MATTRESS = (key: string, label: string, w: DimValue, l: DimValue, opts: Parameters<typeof preset>[4] = {}) =>
  preset(key, label, "mattress", { widthCm: w, lengthCm: l }, { sourceKey: "mercado_colchoes", autoSuggest: true, requiresConfirmation: false, ...opts });

const TABLE_H = R(74, 78);

// conjuntos de partes reutilizáveis
const P = {
  mesa: ["tampo", "pe", "perna", "travessa", "base"],
  caixa: ["tampo", "lateral", "fundo", "frente", "pe", "rodape"],
  gavetas: ["gaveta", "frente_gaveta", "corredica", "puxador"],
  portas: ["porta", "dobradica", "puxador", "fechadura"],
  cama: ["cabeceira", "peseira", "lateral", "estrado", "pe"],
  cadeira: ["assento", "encosto", "perna", "travessa"],
  estofado: ["estrutura", "assento", "encosto", "braco", "pe", "estofado", "almofada", "tecido"],
  estante: ["prateleira", "lateral", "fundo", "tampo", "nicho"],
};

const DAMAGE_WOOD = ["riscos", "manchas", "verniz_descascando", "tinta_descascando", "rachadura", "lasca", "cupim", "umidade"];
const DAMAGE_BOX = [...DAMAGE_WOOD, "gaveta_travando", "porta_desalinhada", "dobradica_quebrada", "puxador_ausente"];
const DAMAGE_SEAT = ["riscos", "pe_frouxo", "peca_solta", "cola_ressecada", "estofado_rasgado", "palhinha_rompida", "cupim"];
const DAMAGE_OUT = ["queimado_sol", "umidade", "apodrecida", "cupim", "ferragem_oxidada", "tinta_descascando", "verniz_descascando", "mofo"];

interface Opts extends Partial<Omit<FurnitureTypeDef, "key" | "name" | "feminine" | "aliases">> {
  ranges?: FurnitureTypeDef["typicalRanges"];
  req?: QuoteFieldKey[];
  opt?: QuoteFieldKey[];
}

function t(key: string, name: string, feminine: boolean, category: FurnitureCategory, aliases: string[], o: Opts = {}): FurnitureTypeDef {
  const outdoor = o.outdoor ?? category === "externo";
  const req = o.req ?? o.requiredQuoteFields ?? ["dimensions", "work_scope"];
  const opt = o.opt ?? o.optionalQuoteFields ?? ["moisture_pests"];
  return {
    key,
    name,
    feminine,
    category,
    aliases,
    legacyKey: o.legacyKey ?? null,
    dimensionPolicy: o.dimensionPolicy ?? "variable",
    measurementSchema: o.measurementSchema ?? "width_depth_height",
    parts: o.parts ?? [],
    commonServices: o.commonServices ?? DEFAULT_SERVICES,
    commonDamage: o.commonDamage ?? (outdoor ? DAMAGE_OUT : DAMAGE_WOOD),
    commonMaterials: o.commonMaterials ?? ["madeira"],
    typicalRanges: o.ranges ?? o.typicalRanges ?? {},
    presets: o.presets ?? [],
    requiredQuoteFields: outdoor && !req.includes("exposure") ? [...req, "exposure"] : req,
    optionalQuoteFields: outdoor && !opt.includes("moisture_pests") ? [...opt, "moisture_pests"] : opt,
    hasInterior: o.hasInterior ?? false,
    outdoor,
    upholstered: o.upholstered ?? "no",
    description: o.description ?? "",
    sourceKey: o.sourceKey ?? "interno",
  };
}

// atalhos por família
const bed = (key: string, name: string, aliases: string[], presets: SizePreset[], o: Opts = {}) =>
  t(key, name, true, o.category ?? "quarto", aliases, {
    legacyKey: "cama",
    dimensionPolicy: presets.length ? "market_reference" : "variable",
    measurementSchema: "width_length",
    parts: P.cama,
    presets,
    req: ["mattress_size", "work_scope", "dimensions"],
    opt: ["headboard_footboard", "hardware", "moisture_pests"],
    sourceKey: presets.length ? "mercado_colchoes" : "interno",
    description: "Medidas de referência são do COLCHÃO; a estrutura externa costuma ser maior e deve ser medida.",
    ...o,
  });

const box = (key: string, name: string, feminine: boolean, category: FurnitureCategory, aliases: string[], o: Opts = {}) =>
  t(key, name, feminine, category, aliases, {
    measurementSchema: "width_depth_height",
    parts: [...P.caixa, ...P.portas],
    commonDamage: DAMAGE_BOX,
    hasInterior: true,
    req: ["dimensions", "work_scope", "interior_scope"],
    opt: ["doors_count", "drawers_count", "moisture_pests"],
    ...o,
  });

const diningTable = (seats: number, rect: [DimValue, DimValue], round: DimValue | null, extra: SizePreset[] = [], o: Opts = {}) =>
  t(`mesa_jantar_${seats}_lugares`, `Mesa de jantar de ${seats} lugares`, true, "jantar", [`mesa de ${seats} lugares`, `mesa para ${seats} pessoas`, `mesa de jantar de ${seats} lugares`, `mesa de ${seats} cadeiras`], {
    legacyKey: "mesa",
    dimensionPolicy: "usual_range",
    measurementSchema: "length_width_height",
    parts: P.mesa,
    presets: [
      preset(`mesa_${seats}_retangular`, `${seats} lugares retangular`, "top", { shape: "retangular", lengthCm: rect[0], widthCm: rect[1], heightCm: TABLE_H }, { sourceKey: "westwing_mesas" }),
      ...(round ? [preset(`mesa_${seats}_redonda`, `${seats} lugares redonda`, "top", { shape: "redonda", diameterCm: round, heightCm: TABLE_H }, { sourceKey: "westwing_mesas" })] : []),
      ...extra,
    ],
    req: ["shape", "dimensions", "work_scope"],
    opt: ["base_type", "extension", "top_material", "moisture_pests"],
    sourceKey: "westwing_mesas",
    description: "Faixas por lugares são indicativas (varejo); a capacidade depende do formato e das cadeiras.",
    ...o,
  });

const table = (key: string, name: string, category: FurnitureCategory, aliases: string[], o: Opts = {}) =>
  t(key, name, true, category, aliases, {
    legacyKey: "mesa",
    measurementSchema: "length_width_height",
    parts: P.mesa,
    req: ["dimensions", "work_scope"],
    opt: ["shape", "top_material", "moisture_pests"],
    ...o,
  });

const chair = (key: string, name: string, category: FurnitureCategory, aliases: string[], o: Opts = {}) =>
  t(key, name, true, category, aliases, {
    legacyKey: "cadeira",
    measurementSchema: "per_module",
    parts: P.cadeira,
    commonDamage: DAMAGE_SEAT,
    upholstered: "optional",
    req: ["quantity", "upholstery_scope", "work_scope"],
    opt: ["armrests", "cane", "upholstery_condition", "moisture_pests"],
    ...o,
  });

const sofa = (key: string, name: string, aliases: string[], o: Opts = {}) =>
  t(key, name, false, "estar", aliases, {
    legacyKey: "poltrona",
    parts: P.estofado,
    commonDamage: ["estofado_rasgado", "espuma_deformada", "peca_solta", "riscos", "cupim", "reparo_estrutural"],
    upholstered: "yes",
    req: ["upholstery_scope", "dimensions", "seats_count"],
    opt: ["upholstery_condition", "moisture_pests"],
    ...o,
  });

const outdoorItem = (key: string, name: string, feminine: boolean, aliases: string[], o: Opts = {}) =>
  t(key, name, feminine, "externo", aliases, { req: ["dimensions", "work_scope", "exposure"], opt: ["moisture_pests"], ...o });

export const FURNITURE_CATALOG: FurnitureTypeDef[] = [
  // ------------------------------------------------------------------ QUARTO
  bed("cama_solteiro", "Cama de solteiro", ["cama de solteiro", "cama solteiro", "cama individual"], [
    MATTRESS("solteiro_88", "solteiro 88 × 188", 88, 188),
    MATTRESS("solteiro_78", "solteiro estreito 78 × 188", 78, 188, { autoSuggest: false, requiresConfirmation: true }),
  ]),
  bed("cama_solteirao", "Cama de solteiro king (solteirão)", ["solteirao", "cama solteirao", "cama solteiro king", "solteiro king"], [
    MATTRESS("solteirao_96", "solteirão 96 × 203", R(96, 97), 203, { requiresConfirmation: true }),
  ]),
  bed("cama_viuva", "Cama de viúva", ["cama de viuva", "cama viuva", "meio casal"], [
    MATTRESS("viuva_128", "viúva 128 × 188", 128, 188, { requiresConfirmation: true, note: "O nome varia entre fabricantes." }),
  ]),
  bed("cama_casal", "Cama de casal padrão", ["cama de casal", "cama casal", "casal padrao"], [MATTRESS("casal_138", "casal 138 × 188", 138, 188)]),
  bed("cama_queen", "Cama queen", ["cama queen", "queen", "queen size", "cama de casal queen"], [MATTRESS("queen_158", "queen 158 × 198", 158, 198)]),
  bed("cama_king", "Cama king", ["cama king", "king", "king size", "cama de casal king"], [
    MATTRESS("king_193", "king 193 × 203", 193, 203, { requiresConfirmation: true, note: "Há fabricantes com outras medidas para o mesmo nome." }),
  ]),
  bed("cama_super_king", "Cama super king", ["super king", "cama super king"], [
    MATTRESS("super_king_203", "super king 203 × 203", 203, 203, { autoSuggest: false, requiresConfirmation: true, note: "Nome muito variável no mercado; nunca preencher sem confirmação." }),
  ]),
  bed("bicama", "Bicama", ["bicama", "cama auxiliar", "cama com auxiliar"], [], { parts: [...P.cama, "cama_auxiliar", "rodizio"], description: "Registrar a estrutura principal e a cama auxiliar separadamente." }),
  bed("beliche", "Beliche", ["beliche", "cama beliche"], [], { parts: ["cabeceira", "lateral", "estrado", "escada", "grade"], measurementSchema: "width_depth_height" }),
  bed("treliche", "Treliche", ["treliche", "triliche", "beliche de tres camas"], [], { parts: ["cabeceira", "lateral", "estrado", "escada", "grade", "cama_auxiliar"], measurementSchema: "width_depth_height" }),
  bed("cama_box", "Cama box", ["cama box", "base box", "box conjugado"], [], { parts: ["base", "lateral", "pe", "tecido"], upholstered: "optional", description: "Diferenciar base, colchão e box conjugado." }),
  bed("cama_bau", "Cama baú", ["cama bau", "box bau", "cama com bau"], [], { parts: ["tampa", "base", "ferragem", "tecido", "lateral"], opt: ["hardware", "moisture_pests"] }),
  bed("cama_infantil", "Cama infantil", ["cama infantil", "mini cama", "minicama", "cama de crianca"], [], { category: "infantil", description: "Medida variável; medir." }),
  bed("berco", "Berço", ["berco", "berco infantil", "bercinho"], [], { category: "infantil", parts: ["grade", "estrado", "cabeceira", "lateral", "pe"], measurementSchema: "width_depth_height", description: "Medida variável; não assumir." }),
  t("cabeceira", "Cabeceira", true, "quarto", ["cabeceira", "cabeceira de cama"], {
    legacyKey: "cama",
    measurementSchema: "width_height",
    parts: ["cabeceira", "moldura", "estofado", "tecido"],
    upholstered: "optional",
    req: ["dimensions", "upholstery_scope"],
    opt: ["wall_mounted", "moisture_pests"],
  }),
  box("criado_mudo", "Criado-mudo", false, "quarto", ["criado-mudo", "criado mudo", "criado", "mesa de cabeceira", "mesinha de cabeceira", "mesinha ao lado da cama", "mesinha do lado da cama"], {
    legacyKey: "mesa_cabeceira",
    dimensionPolicy: "usual_range",
    parts: ["tampo", "lateral", "fundo", "pe", ...P.gavetas],
    ranges: { widthCm: R(35, 60), depthCm: R(30, 50), heightCm: R(40, 70) },
    sourceKey: "mercado_moveis",
    req: ["dimensions", "work_scope"],
    opt: ["drawers_count", "interior_scope", "moisture_pests"],
  }),
  box("comoda", "Cômoda", true, "quarto", ["comoda", "comodinha", "gaveteiro de quarto"], {
    legacyKey: "comoda",
    dimensionPolicy: "usual_range",
    parts: [...P.caixa, ...P.gavetas],
    ranges: { widthCm: R(70, 160), depthCm: R(40, 55), heightCm: R(70, 110) },
    sourceKey: "mercado_moveis",
    req: ["dimensions", "drawers_count", "interior_scope"],
    opt: ["hardware", "moisture_pests"],
  }),
  box("gaveteiro", "Gaveteiro", false, "quarto", ["gaveteiro", "gaveteiro baixo", "gaveteiro alto", "arquivo de gavetas"], {
    legacyKey: "comoda",
    parts: [...P.caixa, ...P.gavetas],
    req: ["dimensions", "drawers_count", "interior_scope"],
  }),
  box("guarda_roupa", "Guarda-roupa", false, "quarto", ["guarda-roupa", "guarda roupa", "guardaroupa", "roupeiro", "armario de quarto"], {
    legacyKey: "guarda_roupa",
    parts: [...P.caixa, ...P.portas, "porta_abrir", "porta_correr", ...P.gavetas, "prateleira", "espelho", "modulo"],
    ranges: { depthCm: R(55, 65) },
    sourceKey: "mercado_moveis",
    presets: [2, 3, 4, 5, 6].map((n) =>
      preset(`guarda_roupa_${n}_portas`, `${n} portas`, "external", { depthCm: R(55, 65) }, { note: "Configuração, não dimensão universal: largura e altura variam muito." }),
    ),
    req: ["dimensions", "doors_count", "door_type", "interior_scope"],
    opt: ["drawers_count", "mirror_glass", "disassembled", "moisture_pests"],
    description: "Portas de abrir e de correr são características diferentes.",
  }),
  box("armario_embutido", "Armário embutido", false, "quarto", ["armario embutido", "guarda-roupa embutido", "guarda roupa embutido", "roupeiro embutido"], {
    legacyKey: "armario",
    dimensionPolicy: "custom",
    measurementSchema: "per_module",
    parts: [...P.portas, "porta_correr", "prateleira", ...P.gavetas, "modulo"],
    req: ["dimensions", "modules", "doors_count", "interior_scope"],
  }),
  box("penteadeira", "Penteadeira", true, "quarto", ["penteadeira", "toucador", "mesa de maquiagem"], {
    legacyKey: "penteadeira",
    parts: ["tampo", ...P.gavetas, "espelho", "pe", "banco"],
    req: ["dimensions", "work_scope", "mirror_glass"],
  }),
  box("sapateira", "Sapateira", true, "quarto", ["sapateira", "armario de sapatos", "porta sapatos"], { legacyKey: "sapateira", parts: [...P.caixa, ...P.portas, "prateleira"] }),
  box("bau", "Baú", false, "quarto", ["bau", "bauzinho", "arca", "caixa bau", "bau de madeira"], {
    legacyKey: "bau",
    parts: ["tampa", "caixa", "fundo", "ferragem", "pe", "fechadura"],
    req: ["dimensions", "interior_scope"],
    opt: ["hardware", "moisture_pests"],
  }),
  t("cabideiro", "Cabideiro", false, "quarto", ["cabideiro", "mancebo", "cabideiro de chao", "cabideiro de parede"], { measurementSchema: "width_height", parts: ["base", "estrutura"], req: ["dimensions", "work_scope"], opt: ["wall_mounted"] }),

  // ------------------------------------------------------------------ JANTAR E COPA
  diningTable(2, [R(60, 80), R(60, 70)], R(70, 80)),
  diningTable(4, [R(120, 140), R(80, 90)], R(90, 110), [preset("mesa_4_quadrada", "4 lugares quadrada", "top", { shape: "quadrada", lengthCm: R(90, 110), widthCm: R(90, 110), heightCm: TABLE_H }, { sourceKey: "westwing_mesas" })]),
  diningTable(6, [R(160, 180), R(90, 100)], R(120, 140)),
  diningTable(8, [R(200, 240), R(100, 110)], R(150, 160), [], { description: "Faixas indicativas; confirmar base e posição das cadeiras." }),
  diningTable(10, [R(240, 320), R(100, 120)], null, [], { dimensionPolicy: "variable", description: "Grande variação: exigir medida real." }),
  diningTable(12, [R(300, 360), R(120, 130)], null, [], { dimensionPolicy: "variable", description: "Referência inicial ~300 × 120 cm ou maior: exigir medida real." }),
  table("mesa_redonda", "Mesa redonda", "jantar", ["mesa redonda", "mesa circular"], { measurementSchema: "diameter_height", req: ["dimensions", "work_scope"], opt: ["base_type", "moisture_pests"], ranges: { heightCm: TABLE_H } }),
  table("mesa_oval", "Mesa oval", "jantar", ["mesa oval", "mesa ovalada"], { ranges: { heightCm: TABLE_H } }),
  table("mesa_quadrada", "Mesa quadrada", "jantar", ["mesa quadrada"], { measurementSchema: "side_height", ranges: { heightCm: TABLE_H } }),
  table("mesa_retangular", "Mesa retangular", "jantar", ["mesa retangular", "mesa de jantar", "mesa comprida"], { ranges: { heightCm: TABLE_H } }),
  table("mesa_extensivel", "Mesa extensível", "jantar", ["mesa extensivel", "mesa elastica", "mesa com extensao"], {
    measurementSchema: "open_closed",
    parts: [...P.mesa, "extensao", "trilho", "dobradica"],
    req: ["dimensions", "work_scope", "extension"],
    description: "Registrar as dimensões fechada e aberta.",
  }),
  table("mesa_dobravel", "Mesa dobrável", "jantar", ["mesa dobravel", "mesa de dobrar", "mesa articulada"], { measurementSchema: "open_closed", parts: [...P.mesa, "dobradica", "ferragem"] }),
  chair("cadeira_jantar", "Cadeira de jantar", "jantar", ["cadeira", "cadeiras", "cadeirinha", "cadeira de jantar", "cadeira de mesa"]),
  chair("cadeira_com_braco", "Cadeira com braço", "jantar", ["cadeira com braco", "cadeira de cabeceira", "poltrona de jantar"], { parts: [...P.cadeira, "braco"] }),
  t("banco_jantar", "Banco de jantar", false, "jantar", ["banco de jantar", "banco de mesa"], { legacyKey: "banco", measurementSchema: "length_width_height", parts: ["assento", "perna", "travessa", "estofado"], upholstered: "optional", req: ["dimensions", "seats_count", "work_scope"] }),
  box("buffet", "Buffet", false, "jantar", ["buffet", "bufe", "bufet", "balcao de jantar", "movel buffet"], { legacyKey: "buffet", parts: [...P.caixa, ...P.portas, ...P.gavetas, "prateleira"] }),
  t("aparador", "Aparador", false, "jantar", ["aparador", "aparadores", "mesa aparador", "aparadora", "aparadoras"], { legacyKey: "aparador", measurementSchema: "length_width_height", parts: ["tampo", "pe", "perna", "travessa", "gaveta"], req: ["dimensions", "work_scope"] }),
  box("cristaleira", "Cristaleira", true, "jantar", ["cristaleira", "cristaleiras", "cristaleirinha"], { legacyKey: "cristaleira", parts: [...P.caixa, ...P.portas, "vidro", "prateleira", ...P.gavetas], req: ["dimensions", "interior_scope", "mirror_glass"] }),
  box("bar", "Bar", false, "jantar", ["bar", "barzinho", "movel bar", "adega de madeira"], { parts: [...P.caixa, ...P.portas, "prateleira", "vidro"] }),
  t("carrinho_cha", "Carrinho de chá", false, "jantar", ["carrinho de cha", "carrinho bar", "carrinho de bar"], { parts: ["tampo", "prateleira", "rodizio", "estrutura"], req: ["dimensions", "work_scope"], opt: ["hardware"] }),
  t("canto_alemao", "Canto alemão", false, "jantar", ["canto alemao", "banco de canto", "canto de jantar"], {
    legacyKey: "banco",
    measurementSchema: "two_sides_depth",
    parts: ["assento", "encosto", "estofado", "modulo", "tampa"],
    upholstered: "optional",
    hasInterior: true,
    req: ["dimensions", "modules", "upholstery_scope"],
    description: "Considerar módulos e possíveis baús internos.",
  }),

  // ------------------------------------------------------------------ ESTAR E TV
  table("mesa_centro", "Mesa de centro", "estar", ["mesa de centro", "mesinha de centro", "mesa central"], {
    req: ["dimensions", "work_scope"],
    opt: ["shape", "top_material", "moisture_pests"],
    description: "Formatos: retangular, quadrada, redonda, oval e orgânica. Perguntar se o serviço é no móvel todo ou só no tampo.",
  }),
  table("mesa_lateral", "Mesa lateral", "estar", ["mesa lateral", "mesa de canto", "mesinha lateral", "mesinha de canto", "apoio lateral", "mesa de apoio", "mesinha de apoio"]),
  table("mesa_ninho", "Mesa ninho", "estar", ["mesa ninho", "mesas ninho", "conjunto de mesas", "mesas encaixaveis"], { measurementSchema: "per_module", req: ["quantity", "dimensions", "work_scope"], description: "Registrar a quantidade de peças e as medidas de cada uma." }),
  box("rack", "Rack", false, "estar", ["rack", "rack de tv", "movel de tv", "movel da tv"], { legacyKey: "rack", parts: ["tampo", "nicho", ...P.portas, ...P.gavetas, "fundo", "pe"] }),
  t("painel_tv", "Painel de TV", false, "estar", ["painel de tv", "painel para televisao", "painel da tv"], { measurementSchema: "width_height", parts: ["moldura", "prateleira", "nicho"], req: ["dimensions", "wall_mounted", "work_scope"] }),
  box("estante", "Estante", true, "estar", ["estante", "estantes", "estante de sala"], { legacyKey: "estante", parts: [...P.estante, ...P.portas, "modulo"], req: ["dimensions", "modules", "interior_scope"] }),
  box("livreiro", "Livreiro", false, "estar", ["livreiro", "estante de livros", "biblioteca"], { legacyKey: "estante", parts: P.estante }),
  t("nicho", "Nicho", false, "estar", ["nicho", "nichos", "nicho de parede", "cubo"], { legacyKey: "estante", parts: ["nicho", "fundo", "lateral"], req: ["quantity", "dimensions", "work_scope"], opt: ["wall_mounted"] }),
  t("prateleira", "Prateleira", true, "estar", ["prateleira", "prateleiras", "tabua de parede"], { legacyKey: "estante", measurementSchema: "length_depth_thickness", parts: ["prateleira", "ferragem"], req: ["quantity", "dimensions", "work_scope"] }),
  sofa("sofa_1_lugar", "Sofá de 1 lugar", ["sofa de 1 lugar", "sofa de um lugar", "cadeirao"], { req: ["upholstery_scope", "dimensions"] }),
  sofa("sofa_2_lugares", "Sofá de 2 lugares", ["sofa de 2 lugares", "sofa de dois lugares", "sofazinho"], { dimensionPolicy: "usual_range", ranges: { widthCm: R(120, 180) }, sourceKey: "mercado_moveis" }),
  sofa("sofa_3_lugares", "Sofá de 3 lugares", ["sofa de 3 lugares", "sofa de tres lugares", "sofa"], { dimensionPolicy: "usual_range", ranges: { widthCm: R(170, 230) }, sourceKey: "mercado_moveis" }),
  sofa("sofa_4_lugares", "Sofá de 4 lugares", ["sofa de 4 lugares", "sofa de quatro lugares"]),
  sofa("sofa_cama", "Sofá-cama", ["sofa-cama", "sofa cama"], { measurementSchema: "open_closed" }),
  sofa("sofa_retratil", "Sofá retrátil", ["sofa retratil", "sofa reclinavel"], { measurementSchema: "open_closed", req: ["upholstery_scope", "dimensions", "modules"] }),
  sofa("sofa_canto", "Sofá de canto", ["sofa de canto", "sofa em l", "sofa em ele"], { measurementSchema: "two_sides_depth" }),
  sofa("sofa_modular", "Sofá modular", ["sofa modular", "sofa de modulos"], { measurementSchema: "per_module", req: ["upholstery_scope", "modules"] }),
  sofa("poltrona", "Poltrona", ["poltrona", "poltronas", "cadeira de braco"], { req: ["upholstery_scope", "quantity"], opt: ["upholstery_condition", "armrests", "moisture_pests"] }),
  sofa("recamier", "Recamier", ["recamier", "diva", "chaise", "chaise longue"], { req: ["upholstery_scope", "dimensions"] }),
  sofa("namoradeira", "Namoradeira", ["namoradeira", "banco namoradeira", "sofa de dois lugares antigo"], { req: ["upholstery_scope", "dimensions"] }),
  t("banco", "Banco", false, "estar", ["banco", "banquinho", "banco de madeira", "banqueta comprida"], { legacyKey: "banco", measurementSchema: "length_width_height", parts: ["assento", "perna", "travessa"], req: ["dimensions", "seats_count", "work_scope"] }),
  t("banqueta", "Banqueta", true, "estar", ["banqueta", "banquetas", "banco alto", "banco baixo"], { legacyKey: "banco", measurementSchema: "per_module", parts: ["assento", "perna", "travessa", "estofado"], upholstered: "optional", req: ["quantity", "work_scope"], opt: ["upholstery_scope"] }),
  t("revisteiro", "Revisteiro", false, "estar", ["revisteiro", "porta-revistas", "porta revistas"], { parts: ["estrutura", "lateral", "fundo"] }),
  t("biombo", "Biombo", false, "estar", ["biombo", "divisoria articulada"], { measurementSchema: "width_height", parts: ["moldura", "dobradica", "tecido"], req: ["dimensions", "quantity", "work_scope"], description: "Perguntar o número de folhas." }),
  box("oratorio", "Oratório", false, "estar", ["oratorio", "altar domestico", "capela de madeira"], { legacyKey: "oratorio", parts: ["caixa", ...P.portas, "ornamento", "entalhe"] }),

  // ------------------------------------------------------------------ ESCRITÓRIO
  table("escrivaninha", "Escrivaninha", "escritorio", ["escrivaninha", "mesa de estudo", "mesa de trabalho"], { legacyKey: "escrivaninha", ranges: { heightCm: R(72, 76) }, parts: [...P.mesa, ...P.gavetas], sourceKey: "eneac_ergonomia" }),
  table("mesa_escritorio", "Mesa de escritório", "escritorio", ["mesa de escritorio"], { legacyKey: "escrivaninha", ranges: { heightCm: R(72, 76) }, opt: ["shape", "moisture_pests"] }),
  table("mesa_em_l", "Mesa em L", "escritorio", ["mesa em l", "mesa em ele", "mesa de canto escritorio"], { legacyKey: "escrivaninha", measurementSchema: "two_sides_depth" }),
  table("mesa_computador", "Mesa de computador", "escritorio", ["mesa de computador", "mesa do computador", "mesa para computador"], { legacyKey: "escrivaninha", parts: ["tampo", "nicho", "gaveta", "corredica", "pe"] }),
  table("mesa_executiva", "Mesa executiva", "escritorio", ["mesa executiva", "mesa de diretor"], { legacyKey: "escrivaninha", parts: [...P.mesa, ...P.gavetas] }),
  box("secretaria", "Secretária", true, "escritorio", ["secretaria", "escrivaninha antiga", "movel secretario"], { legacyKey: "escrivaninha", parts: ["tampa", ...P.gavetas, "nicho", "ferragem", "fechadura"] }),
  chair("cadeira_escritorio", "Cadeira de escritório", "escritorio", ["cadeira de escritorio", "cadeira giratoria"], { parts: ["assento", "encosto", "braco", "base", "rodizio", "estofado"], upholstered: "yes" }),
  box("arquivo", "Arquivo", false, "escritorio", ["arquivo", "arquivo de pastas", "gaveteiro arquivo"], { legacyKey: "comoda", parts: [...P.caixa, ...P.gavetas], req: ["dimensions", "drawers_count", "interior_scope"] }),
  box("armario_escritorio", "Armário de escritório", false, "escritorio", ["armario de escritorio", "armario baixo", "armario alto"], { legacyKey: "armario" }),
  box("estante_escritorio", "Estante de escritório", true, "escritorio", ["estante de escritorio"], { legacyKey: "estante", parts: P.estante }),
  box("balcao_recepcao", "Balcão de recepção", false, "escritorio", ["balcao de recepcao", "balcao de atendimento"], { measurementSchema: "per_module", req: ["dimensions", "modules", "work_scope"] }),

  // ------------------------------------------------------------------ COZINHA E SERVIÇO
  box("armario_cozinha_inferior", "Armário de cozinha inferior", false, "cozinha", ["armario de cozinha", "balcao de cozinha", "gabinete inferior", "armario de baixo da cozinha"], {
    legacyKey: "armario",
    dimensionPolicy: "usual_range",
    ranges: { depthCm: R(55, 65), heightCm: R(85, 95) },
    sourceKey: "mercado_moveis",
    parts: [...P.caixa, ...P.portas, ...P.gavetas, "prateleira"],
    opt: ["top_material", "moisture_pests"],
  }),
  box("armario_aereo", "Armário aéreo", false, "cozinha", ["armario aereo", "armario suspenso", "aereo da cozinha"], { legacyKey: "armario", dimensionPolicy: "usual_range", ranges: { depthCm: R(25, 40) }, sourceKey: "mercado_moveis", parts: [...P.caixa, ...P.portas, "prateleira"] }),
  box("torre_cozinha", "Torre de cozinha", true, "cozinha", ["torre de cozinha", "torre quente"], { legacyKey: "armario", parts: [...P.portas, "nicho", "prateleira"] }),
  box("paneleiro", "Paneleiro", false, "cozinha", ["paneleiro", "armario paneleiro"], { legacyKey: "armario" }),
  box("balcao_cozinha", "Balcão de cozinha", false, "cozinha", ["balcao com tampo", "balcao de pia"], { legacyKey: "armario", parts: [...P.caixa, ...P.portas, ...P.gavetas], opt: ["top_material", "moisture_pests"] }),
  box("ilha_cozinha", "Ilha de cozinha", true, "cozinha", ["ilha de cozinha", "bancada ilha", "ilha"], { legacyKey: "armario", opt: ["top_material", "moisture_pests"] }),
  table("mesa_cozinha", "Mesa de cozinha", "cozinha", ["mesa de cozinha", "mesinha de cozinha"], { opt: ["shape", "moisture_pests"] }),
  t("banqueta_cozinha", "Banqueta de cozinha", true, "cozinha", ["banqueta de cozinha", "banco de cozinha", "banqueta alta"], { legacyKey: "banco", measurementSchema: "per_module", parts: ["assento", "perna", "travessa"], req: ["quantity", "work_scope"] }),
  t("fruteira", "Fruteira", true, "cozinha", ["fruteira", "movel fruteira", "carrinho de cozinha"], { parts: ["prateleira", "estrutura", "rodizio"] }),
  box("despenseiro", "Armário despenseiro", false, "cozinha", ["despenseiro", "despensa", "paneleiro alto", "armario despenseiro"], { legacyKey: "armario" }),
  box("gabinete_pia", "Gabinete de pia", false, "cozinha", ["gabinete de pia", "gabinete da pia"], { legacyKey: "armario", req: ["dimensions", "doors_count", "moisture_pests"] }),
  box("armario_lavanderia", "Armário de lavanderia", false, "cozinha", ["armario de lavanderia", "armario de area de servico"], { legacyKey: "armario", opt: ["moisture_pests"] }),
  t("tabua_passar_embutida", "Tábua de passar embutida", true, "cozinha", ["tabua de passar embutida", "tabua de passar"], { parts: ["tampo", "ferragem", "dobradica"], opt: ["hardware"] }),

  // ------------------------------------------------------------------ BANHEIRO
  box("gabinete_banheiro", "Gabinete de banheiro", false, "banheiro", ["gabinete de banheiro", "armario de banheiro", "gabinete do banheiro"], { legacyKey: "armario", req: ["dimensions", "interior_scope", "moisture_pests"] }),
  box("armario_espelho", "Armário com espelho", false, "banheiro", ["armario com espelho", "espelheira", "armario aereo de banheiro"], { legacyKey: "armario", parts: [...P.caixa, ...P.portas, "espelho"], req: ["dimensions", "mirror_glass", "moisture_pests"] }),
  t("bancada_banheiro", "Bancada de banheiro", true, "banheiro", ["bancada de banheiro", "bancada do banheiro"], { measurementSchema: "length_width_height", req: ["dimensions", "top_material", "moisture_pests"] }),
  t("nicho_banheiro", "Nicho de banheiro", false, "banheiro", ["nicho de banheiro", "nicho do banheiro"], { req: ["dimensions", "moisture_pests"] }),
  t("banquinho_banheiro", "Banquinho de banheiro", false, "banheiro", ["banquinho de banheiro", "banco de banheiro"], { legacyKey: "banco", req: ["work_scope", "moisture_pests"] }),

  // ------------------------------------------------------------------ EXTERNO
  outdoorItem("mesa_varanda", "Mesa de varanda", true, ["mesa de varanda", "mesa da varanda"], { legacyKey: "mesa", measurementSchema: "length_width_height", parts: P.mesa }),
  outdoorItem("mesa_jardim", "Mesa de jardim", true, ["mesa de jardim", "mesa do jardim", "mesa externa"], { legacyKey: "mesa", measurementSchema: "length_width_height", parts: P.mesa }),
  outdoorItem("cadeira_varanda", "Cadeira de varanda", true, ["cadeira de varanda", "cadeira da varanda"], { legacyKey: "cadeira", measurementSchema: "per_module", parts: P.cadeira, req: ["quantity", "work_scope", "exposure"] }),
  outdoorItem("cadeira_jardim", "Cadeira de jardim", true, ["cadeira de jardim", "cadeira externa"], { legacyKey: "cadeira", measurementSchema: "per_module", parts: P.cadeira, req: ["quantity", "work_scope", "exposure"] }),
  outdoorItem("banco_jardim", "Banco de jardim", false, ["banco de jardim", "banco de praca", "banco externo"], { legacyKey: "banco", measurementSchema: "length_width_height", parts: ["assento", "encosto", "perna"] }),
  outdoorItem("espreguicadeira", "Espreguiçadeira", true, ["espreguicadeira", "espreguicadeiras"], { parts: ["estrutura", "encosto", "rodizio", "ferragem"] }),
  outdoorItem("balanco", "Balanço", false, ["balanco", "balanco de varanda", "cadeira de balanco"], { parts: ["assento", "encosto", "estrutura", "ferragem"] }),
  outdoorItem("namoradeira_externa", "Namoradeira externa", true, ["namoradeira externa", "namoradeira de jardim"], { parts: ["assento", "encosto", "braco", "pe"] }),
  outdoorItem("conjunto_bistro", "Conjunto bistrô", false, ["conjunto bistro", "jogo bistro"], { measurementSchema: "per_module", req: ["quantity", "work_scope", "exposure"] }),
  outdoorItem("mesa_bistro", "Mesa bistrô", true, ["mesa bistro"], { legacyKey: "mesa", measurementSchema: "diameter_height", parts: P.mesa }),
  outdoorItem("banqueta_bistro", "Banqueta bistrô", true, ["banqueta bistro"], { legacyKey: "banco", measurementSchema: "per_module", req: ["quantity", "work_scope", "exposure"] }),
  outdoorItem("floreira", "Floreira", true, ["floreira", "jardineira de madeira"], { measurementSchema: "length_width_height" }),
  outdoorItem("cachepo", "Cachepô de madeira", false, ["cachepo", "cachepo de madeira"], { req: ["quantity", "dimensions", "exposure"] }),
  outdoorItem("deck_modular", "Deck modular", false, ["deck modular", "deck", "placas de deck"], { measurementSchema: "per_module", req: ["quantity", "dimensions", "exposure"] }),
  outdoorItem("pergolado", "Pergolado", false, ["pergolado", "pergola"], { dimensionPolicy: "custom", description: "Só se estiver dentro do escopo operacional do negócio." }),

  // ------------------------------------------------------------------ INFANTIL
  box("comoda_infantil", "Cômoda infantil", true, "infantil", ["comoda infantil", "comoda de bebe", "comoda do bebe"], { legacyKey: "comoda", parts: [...P.caixa, ...P.gavetas], req: ["dimensions", "drawers_count", "interior_scope"] }),
  box("guarda_roupa_infantil", "Guarda-roupa infantil", false, "infantil", ["guarda-roupa infantil", "guarda roupa infantil", "guarda roupa de bebe"], { legacyKey: "guarda_roupa", req: ["dimensions", "doors_count", "interior_scope"] }),
  table("mesa_infantil", "Mesa infantil", "infantil", ["mesa infantil", "mesinha infantil", "mesinha de crianca"]),
  chair("cadeira_infantil", "Cadeira infantil", "infantil", ["cadeira infantil", "cadeirinha infantil", "cadeira de crianca"]),
  box("bau_brinquedos", "Baú de brinquedos", false, "infantil", ["bau de brinquedos", "caixa de brinquedos"], { legacyKey: "bau", parts: ["tampa", "caixa", "ferragem"] }),
  box("estante_brinquedos", "Estante de brinquedos", true, "infantil", ["estante de brinquedos", "estante infantil"], { legacyKey: "estante", parts: P.estante }),
  box("organizador_infantil", "Organizador infantil", false, "infantil", ["organizador infantil", "organizador de brinquedos"], { parts: ["nicho", "prateleira"] }),
  box("trocador", "Trocador", false, "infantil", ["trocador", "comoda trocador"], { parts: ["tampo", ...P.gavetas, "grade"] }),
  bed("cama_montessoriana", "Cama montessoriana", ["cama montessoriana", "cama casinha"], [], { category: "infantil" }),
  outdoorItem("casinha_infantil", "Casinha infantil de madeira", true, ["casinha infantil", "casinha de madeira", "casinha de boneca"], { category: "infantil", outdoor: false, dimensionPolicy: "custom" }),

  // ------------------------------------------------------------------ ANTIGOS, DECORATIVOS E ESPECIAIS
  box("papeleira", "Papeleira", true, "antigo", ["papeleira"], { legacyKey: "escrivaninha", parts: ["tampa", ...P.gavetas, "nicho", "fechadura", "entalhe"] }),
  box("comoda_bombe", "Cômoda bombê", true, "antigo", ["comoda bombe", "comoda abaulada"], { legacyKey: "comoda", dimensionPolicy: "custom", parts: [...P.caixa, ...P.gavetas, "entalhe"], req: ["dimensions", "drawers_count", "interior_scope"] }),
  box("comoda_antiga", "Cômoda antiga", true, "antigo", ["comoda antiga", "comoda de vo", "comoda da avo"], { legacyKey: "comoda", dimensionPolicy: "custom", parts: [...P.caixa, ...P.gavetas], req: ["dimensions", "drawers_count", "interior_scope"] }),
  box("criado_mudo_antigo", "Criado-mudo antigo", false, "antigo", ["criado-mudo antigo", "criado mudo antigo"], { legacyKey: "mesa_cabeceira", dimensionPolicy: "custom" }),
  box("cristaleira_antiga", "Cristaleira antiga", true, "antigo", ["cristaleira antiga"], { legacyKey: "cristaleira", dimensionPolicy: "custom", parts: [...P.caixa, ...P.portas, "vidro", "prateleira"] }),
  box("armario_antigo", "Armário antigo", false, "antigo", ["armario antigo", "armario de vo"], { legacyKey: "armario", dimensionPolicy: "custom" }),
  box("roupeiro_antigo", "Roupeiro antigo", false, "antigo", ["roupeiro antigo", "guarda-roupa antigo", "guarda roupa antigo"], { legacyKey: "guarda_roupa", dimensionPolicy: "custom", req: ["dimensions", "doors_count", "interior_scope"] }),
  table("mesa_fazenda", "Mesa de fazenda", "antigo", ["mesa de fazenda", "mesa rustica", "mesa de demolicao"], { dimensionPolicy: "custom" }),
  table("mesa_jogos", "Mesa de jogos", "antigo", ["mesa de jogos", "mesa de jogo"], { parts: [...P.mesa, "tecido", "gaveta"] }),
  table("mesa_carteado", "Mesa de carteado", "antigo", ["mesa de carteado", "mesa de baralho"], { parts: [...P.mesa, "tecido"] }),
  table("mesa_costura", "Mesa de costura", "antigo", ["mesa de costura"], { parts: [...P.mesa, ...P.gavetas] }),
  table("maquina_costura_gabinete", "Máquina de costura com gabinete", "antigo", ["maquina de costura", "gabinete de maquina de costura", "movel da maquina de costura"], { parts: ["tampo", "gaveta", "base", "ferragem"], opt: ["hardware", "moisture_pests"] }),
  t("console", "Console", false, "antigo", ["console", "mesa console"], { legacyKey: "aparador", measurementSchema: "length_width_height", parts: ["tampo", "perna", "travessa", "gaveta"] }),
  box("penteadeira_antiga", "Penteadeira antiga", true, "antigo", ["penteadeira antiga"], { legacyKey: "penteadeira", dimensionPolicy: "custom", parts: ["tampo", ...P.gavetas, "espelho", "pe"] }),
  box("toucador", "Toucador", false, "antigo", ["toucador antigo"], { legacyKey: "penteadeira", parts: ["tampo", "espelho", "gaveta"] }),
  table("escrivaninha_antiga", "Escrivaninha antiga", "antigo", ["escrivaninha de vo"], { legacyKey: "escrivaninha", dimensionPolicy: "custom", parts: [...P.mesa, ...P.gavetas] }),
  box("bau_antigo", "Baú antigo", false, "antigo", ["bau antigo", "bau de vo"], { legacyKey: "bau", dimensionPolicy: "custom", parts: ["tampa", "caixa", "ferragem", "fechadura"] }),
  box("arca", "Arca", true, "antigo", ["arca antiga", "arca de madeira"], { legacyKey: "bau", parts: ["tampa", "caixa", "ferragem"] }),
  box("movel_cofre", "Móvel-cofre de madeira", false, "antigo", ["cofre de madeira", "movel cofre", "movel-cofre"], { parts: ["caixa", "porta", "fechadura", "ferragem"] }),
  box("relogio_chao", "Relógio de chão (caixa de madeira)", false, "antigo", ["relogio de chao", "relogio carrilhao", "caixa de relogio"], { parts: ["caixa", "porta", "vidro", "ornamento"], description: "Só a caixa de madeira; mecanismo fora do escopo." }),
  t("moldura", "Moldura", true, "antigo", ["moldura", "molduras", "quadro"], { legacyKey: "moldura", measurementSchema: "width_height", parts: ["moldura", "ornamento"], req: ["quantity", "dimensions", "work_scope"] }),
  t("moldura_espelho", "Moldura de espelho", true, "antigo", ["moldura de espelho", "moldura do espelho"], { legacyKey: "moldura", measurementSchema: "width_height", parts: ["moldura", "espelho"] }),
  t("espelho_madeira", "Espelho com estrutura de madeira", false, "antigo", ["espelho", "espelho de madeira", "espelho com moldura"], { legacyKey: "moldura", measurementSchema: "width_height", parts: ["moldura", "espelho"], req: ["dimensions", "work_scope", "mirror_glass"] }),
  t("porta_retrato", "Porta-retrato de madeira", false, "antigo", ["porta-retrato", "porta retrato"], { legacyKey: "moldura", measurementSchema: "width_height", req: ["quantity", "work_scope"] }),
  t("pedestal", "Pedestal", false, "antigo", ["pedestal", "pedestal de madeira"], { measurementSchema: "width_depth_height", parts: ["base", "tampo", "estrutura"] }),
  t("coluna_decorativa", "Coluna decorativa", true, "antigo", ["coluna decorativa", "coluna de madeira"], { parts: ["base", "estrutura", "ornamento"] }),
  t("suporte_plantas", "Suporte de plantas", false, "antigo", ["suporte de plantas", "suporte para vaso", "porta vaso"], { parts: ["estrutura", "prateleira"] }),
  t("genuflexorio", "Genuflexório", false, "antigo", ["genuflexorio"], { parts: ["estrutura", "estofado", "travessa"], upholstered: "optional" }),
  t("banco_igreja", "Banco de igreja", false, "antigo", ["banco de igreja", "banco de capela"], { legacyKey: "banco", measurementSchema: "length_width_height", parts: ["assento", "encosto", "lateral"], req: ["quantity", "dimensions", "work_scope"] }),
  t("peca_sacra", "Peça sacra de madeira", true, "antigo", ["peca sacra", "imagem de santo", "santo de madeira"], { legacyKey: "oratorio", dimensionPolicy: "custom", parts: ["ornamento", "entalhe", "base"] }),
  t("porta_madeira", "Porta de madeira", true, "antigo", ["porta antiga", "porta de madeira"], { legacyKey: "porta", measurementSchema: "width_height", parts: ["porta", "dobradica", "fechadura", "moldura"] }),
  t("movel_sob_medida", "Móvel artesanal sob medida", false, "outro", ["movel sob medida", "movel artesanal", "movel planejado"], { dimensionPolicy: "custom", measurementSchema: "per_module" }),
  t("movel_nao_identificado", "Móvel não identificado", false, "outro", ["movel", "peca", "movel diferente"], {
    dimensionPolicy: "custom",
    measurementSchema: "unknown",
    req: ["dimensions", "work_scope"],
    description: "Registro provisório com descrição livre; classificar depois.",
  }),
];

/**
 * Termos genéricos que apontam para VÁRIOS tipos: nunca escolher sozinho.
 * O matcher devolve os candidatos e o bot pergunta (ou a IA escolhe entre eles).
 */
export const AMBIGUOUS_TERMS: Record<string, string[]> = {
  mesinha: ["mesa_centro", "mesa_lateral", "criado_mudo"],
  mesa: ["mesa_retangular", "mesa_centro", "mesa_redonda", "mesa_cozinha", "escrivaninha"],
  armario: ["guarda_roupa", "armario_cozinha_inferior", "gabinete_banheiro", "armario_escritorio", "armario_antigo"],
  armarios: ["guarda_roupa", "armario_cozinha_inferior", "gabinete_banheiro", "armario_escritorio"],
  armarinho: ["gabinete_banheiro", "armario_aereo", "armario_escritorio"],
  banco: ["banco", "banco_jantar", "banco_jardim", "banqueta"],
  "cama grande": ["cama_casal", "cama_queen", "cama_king"],
  cama: ["cama_solteiro", "cama_casal", "cama_queen", "cama_king", "cama_viuva"],
  gaveteiro: ["gaveteiro", "arquivo", "comoda"],
  estante: ["estante", "livreiro", "estante_escritorio"],
  sofa: ["sofa_2_lugares", "sofa_3_lugares", "sofa_canto"],
  balcao: ["buffet", "balcao_cozinha", "balcao_recepcao"],
  gabinete: ["gabinete_banheiro", "gabinete_pia"],
  bancada: ["bancada_banheiro", "ilha_cozinha"],
  painel: ["painel_tv", "cabeceira"],
};

export function catalogByKey(): Map<string, FurnitureTypeDef> {
  return new Map(FURNITURE_CATALOG.map((t) => [t.key, t]));
}
