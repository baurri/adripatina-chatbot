/**
 * Catálogo mestre de móveis — tipos.
 *
 * Convenção dimensional (centímetros inteiros no catálogo; o motor de preço usa metros):
 *  - camas/colchões: largura × comprimento
 *  - mesas e tampos: comprimento × largura (profundidade) × altura
 *  - móveis-caixa (cômoda, guarda-roupa...): largura × profundidade × altura
 *  - redondos: diâmetro × altura
 *  - partes/prateleiras: comprimento × profundidade × espessura
 *
 * Medida NOMINAL nunca é medida real: serve para sugestão e orçamento preliminar
 * com hipótese explícita.
 */

export type FurnitureCategory = "quarto" | "jantar" | "estar" | "escritorio" | "cozinha" | "banheiro" | "externo" | "infantil" | "antigo" | "outro";

/** Quanto a medida do tipo é padronizada no mercado. */
export type DimensionPolicy =
  /** referência de mercado consolidada (ex.: colchão de casal 138 × 188) — ainda assim confirmar a peça */
  | "market_reference"
  /** faixas usuais (ex.: mesa de 4 lugares) — nunca uma medida obrigatória */
  | "usual_range"
  /** totalmente variável: medir */
  | "variable"
  /** sob medida / antigo: medir sempre */
  | "custom";

/** Que medidas pedir e em que ordem. */
export type MeasurementSchema =
  | "width_length" // camas: largura × comprimento
  | "length_width_height" // mesas
  | "diameter_height" // redondos
  | "side_height" // quadrados
  | "width_depth_height" // móveis-caixa
  | "width_height" // painéis, cabeceiras, biombos
  | "length_depth_thickness" // prateleiras, tábuas
  | "open_closed" // extensíveis, dobráveis, sofá-cama
  | "two_sides_depth" // em L
  | "per_module" // conjuntos/módulos
  | "unknown";

export type DimensionKind = "mattress" | "external" | "top" | "open" | "closed" | "seat" | "module";

export type SourceKind = "regulatory" | "standard" | "academic_reference" | "manufacturer_reference" | "retailer_reference" | "market_reference" | "internal_observation";

export interface CatalogSource {
  key: string;
  kind: SourceKind;
  title: string;
  url: string | null;
  note: string;
}

/** Valor exato (cm) ou faixa usual (cm). */
export type DimValue = number | { min: number; max: number };

export interface SizePreset {
  key: string;
  label: string;
  dimensionKind: DimensionKind;
  shape?: "retangular" | "redonda" | "quadrada" | "oval";
  widthCm?: DimValue;
  lengthCm?: DimValue;
  depthCm?: DimValue;
  heightCm?: DimValue;
  diameterCm?: DimValue;
  /** referência de mercado (não norma) */
  isMarketReference: boolean;
  /** medida padronizada por norma/regulação — quase nunca verdadeiro para móveis */
  isStandardized: boolean;
  /** precisa confirmar com o artesão antes de usar (nome varia entre fabricantes etc.) */
  requiresConfirmation: boolean;
  /** pode ser sugerido automaticamente quando o nome bate (ex.: "queen") */
  autoSuggest: boolean;
  sourceKey: string;
  note?: string;
}

/** Campos que o catálogo pode pedir para orçar (perguntas específicas por tipo). */
export type QuoteFieldKey =
  | "dimensions"
  | "work_scope" // inteiro, só tampo, só cabeceira, só a madeira...
  | "shape"
  | "quantity"
  | "drawers_count"
  | "doors_count"
  | "door_type"
  | "interior_scope" // externo, interno ou completo
  | "modules"
  | "extension"
  | "mattress_size"
  | "headboard_footboard"
  | "upholstery_scope" // madeira, estofado ou completo
  | "upholstery_condition"
  | "seats_count"
  | "armrests"
  | "cane" // palhinha
  | "exposure" // sol, chuva, área coberta
  | "moisture_pests" // umidade, cupim, apodrecimento
  | "top_material"
  | "mirror_glass"
  | "disassembled"
  | "hardware" // ferragens, pistões, corrediças
  | "wall_mounted"
  | "base_type";

export interface FurnitureTypeDef {
  key: string;
  name: string;
  feminine: boolean;
  category: FurnitureCategory;
  /** aliases específicos deste tipo (sem acento ou com; normalizados no matcher) */
  aliases: string[];
  /** chave antiga do vocabulário (FURNITURE) para compatibilidade com serviços já salvos */
  legacyKey: string | null;
  dimensionPolicy: DimensionPolicy;
  measurementSchema: MeasurementSchema;
  parts: string[];
  commonServices: string[];
  commonDamage: string[];
  commonMaterials: string[];
  typicalRanges: Partial<Record<"widthCm" | "lengthCm" | "depthCm" | "heightCm" | "diameterCm", { min: number; max: number }>>;
  presets: SizePreset[];
  requiredQuoteFields: QuoteFieldKey[];
  optionalQuoteFields: QuoteFieldKey[];
  /** tem parte interna que pode ser trabalhada */
  hasInterior: boolean;
  outdoor: boolean;
  upholstered: "no" | "optional" | "yes";
  description: string;
  sourceKey: string;
}
