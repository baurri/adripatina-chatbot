-- 0006: catálogo mestre de móveis (editável pelo administrador) e observabilidade da IA.
-- Apenas acréscimos. A carga do catálogo é feita pelo Worker (INSERT OR IGNORE, idempotente),
-- nunca sobrescrevendo edições do administrador. Chaves canônicas são estáveis.

CREATE TABLE furniture_sources (
  key TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('regulatory','standard','academic_reference','manufacturer_reference','retailer_reference','market_reference','internal_observation')),
  title TEXT NOT NULL,
  url TEXT,
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE furniture_types (
  canonical_key TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('quarto','jantar','estar','escritorio','cozinha','banheiro','externo','infantil','antigo','outro')),
  description TEXT NOT NULL DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1,
  legacy_key TEXT,
  feminine INTEGER NOT NULL DEFAULT 0,
  dimension_policy TEXT NOT NULL CHECK (dimension_policy IN ('market_reference','usual_range','variable','custom')),
  measurement_schema TEXT NOT NULL,
  typical_ranges_json TEXT NOT NULL DEFAULT '{}',
  common_materials_json TEXT NOT NULL DEFAULT '[]',
  common_services_json TEXT NOT NULL DEFAULT '[]',
  common_damage_json TEXT NOT NULL DEFAULT '[]',
  required_fields_json TEXT NOT NULL DEFAULT '[]',
  optional_fields_json TEXT NOT NULL DEFAULT '[]',
  has_interior INTEGER NOT NULL DEFAULT 0,
  outdoor INTEGER NOT NULL DEFAULT 0,
  upholstered TEXT NOT NULL DEFAULT 'no' CHECK (upholstered IN ('no','optional','yes')),
  source_key TEXT REFERENCES furniture_sources(key),
  origin TEXT NOT NULL DEFAULT 'seed' CHECK (origin IN ('seed','admin')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_furniture_types_category ON furniture_types(category, active);

CREATE TABLE furniture_aliases (
  id TEXT PRIMARY KEY,
  furniture_type_key TEXT NOT NULL REFERENCES furniture_types(canonical_key),
  alias TEXT NOT NULL,
  normalized_alias TEXT NOT NULL,
  regional TEXT,
  confidence REAL NOT NULL DEFAULT 1,
  active INTEGER NOT NULL DEFAULT 1,
  origin TEXT NOT NULL DEFAULT 'seed' CHECK (origin IN ('seed','admin')),
  created_at TEXT NOT NULL,
  UNIQUE (furniture_type_key, normalized_alias)
);
CREATE INDEX idx_furniture_aliases_norm ON furniture_aliases(normalized_alias);

CREATE TABLE furniture_type_parts (
  furniture_type_key TEXT NOT NULL REFERENCES furniture_types(canonical_key),
  part_key TEXT NOT NULL,
  quantity_rule TEXT,
  sort INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (furniture_type_key, part_key)
);

CREATE TABLE furniture_part_vocabulary (
  key TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  variants_json TEXT NOT NULL DEFAULT '[]',
  measurable INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE furniture_damage_vocabulary (
  key TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  variants_json TEXT NOT NULL DEFAULT '[]',
  severity TEXT NOT NULL CHECK (severity IN ('leve','moderado','grave'))
);

-- dims_json: {"widthCm": 158, "lengthCm": 198} ou faixas {"lengthCm": {"min":120,"max":140}}
CREATE TABLE furniture_size_presets (
  preset_key TEXT PRIMARY KEY,
  furniture_type_key TEXT NOT NULL REFERENCES furniture_types(canonical_key),
  label TEXT NOT NULL,
  dimension_kind TEXT NOT NULL CHECK (dimension_kind IN ('mattress','external','top','open','closed','seat','module')),
  shape TEXT,
  dims_json TEXT NOT NULL DEFAULT '{}',
  is_market_reference INTEGER NOT NULL DEFAULT 1,
  is_standardized INTEGER NOT NULL DEFAULT 0,
  requires_confirmation INTEGER NOT NULL DEFAULT 1,
  auto_suggest INTEGER NOT NULL DEFAULT 0,
  source_key TEXT REFERENCES furniture_sources(key),
  note TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  sort INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_furniture_presets_type ON furniture_size_presets(furniture_type_key);

-- termos genéricos ("armário", "mesinha") que apontam para vários tipos: o bot pergunta
CREATE TABLE furniture_ambiguous_terms (
  term TEXT PRIMARY KEY,
  candidates_json TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1
);

-- Observabilidade da IA: objetivo, schema, fallback, confiança e decisão (sem prompts/segredos)
ALTER TABLE ai_usage ADD COLUMN purpose TEXT;
ALTER TABLE ai_usage ADD COLUMN schema_name TEXT;
ALTER TABLE ai_usage ADD COLUMN fallback_used INTEGER;
ALTER TABLE ai_usage ADD COLUMN confidence REAL;
ALTER TABLE ai_usage ADD COLUMN decision_json TEXT;
ALTER TABLE ai_usage ADD COLUMN correlation_id TEXT;
CREATE INDEX idx_ai_usage_purpose ON ai_usage(purpose, created_at);
