-- adripatina — schema inicial (D1 / SQLite)
-- Dinheiro: INTEGER em centavos. Quantidades/percentuais: TEXT decimal exato.
-- Timestamps: TEXT ISO-8601 UTC. IDs: UUID (TEXT), não sequenciais.

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  role TEXT NOT NULL CHECK (role IN ('ARTESAO','ADMIN')),
  display_name TEXT NOT NULL,
  telegram_user_id TEXT UNIQUE,
  telegram_chat_id TEXT,
  admin_email TEXT UNIQUE,
  active INTEGER NOT NULL DEFAULT 1,
  preferences_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE clients (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  aliases_json TEXT NOT NULL DEFAULT '[]',
  phone TEXT,
  notes TEXT,
  data_consent_note TEXT,
  merged_into_id TEXT REFERENCES clients(id),
  created_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_clients_normalized ON clients(normalized_name);

CREATE TABLE furniture_items (
  id TEXT PRIMARY KEY,
  client_id TEXT REFERENCES clients(id),
  type TEXT,
  descriptors_json TEXT NOT NULL DEFAULT '[]',
  width_m TEXT,
  height_m TEXT,
  depth_m TEXT,
  size_class TEXT CHECK (size_class IS NULL OR size_class IN ('pequeno','medio','grande')),
  condition TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Projeto / ordem de serviço. Memória estruturada vive aqui (facts/summary) + job_facts (histórico).
CREATE TABLE jobs (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  client_id TEXT REFERENCES clients(id),
  furniture_id TEXT REFERENCES furniture_items(id),
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'ORCAMENTO'
    CHECK (status IN ('ORCAMENTO','AGUARDANDO_INICIO','EM_EXECUCAO','CONCLUIDO','ENTREGUE','CANCELADO','MESCLADO')),
  contracted_cents INTEGER,
  facts_json TEXT NOT NULL DEFAULT '{}',
  summary_json TEXT NOT NULL DEFAULT '{}',
  pending_json TEXT NOT NULL DEFAULT '[]',
  search_text TEXT NOT NULL DEFAULT '',
  started_at TEXT,
  completed_at TEXT,
  delivered_at TEXT,
  due_date TEXT,
  delivery_address TEXT,
  last_interaction_at TEXT,
  merged_into_id TEXT REFERENCES jobs(id),
  created_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  row_version INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX idx_jobs_client ON jobs(client_id);
CREATE INDEX idx_jobs_status ON jobs(status);
CREATE INDEX idx_jobs_last_interaction ON jobs(last_interaction_at);

CREATE TABLE job_code_sequence (id INTEGER PRIMARY KEY CHECK (id = 1), last_value INTEGER NOT NULL);
INSERT INTO job_code_sequence (id, last_value) VALUES (1, 0);

-- Histórico de fatos (memória persistente): cada mudança/correção cria uma linha; a anterior é marcada superseded.
CREATE TABLE job_facts (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES jobs(id),
  field TEXT NOT NULL,
  value_json TEXT,
  status TEXT NOT NULL CHECK (status IN ('confirmed','unconfirmed','unknown')),
  source TEXT NOT NULL,
  message_id TEXT,
  change_kind TEXT NOT NULL DEFAULT 'set' CHECK (change_kind IN ('set','correction','merge','admin')),
  actor_id TEXT,
  created_at TEXT NOT NULL,
  superseded_at TEXT
);
CREATE INDEX idx_job_facts_job ON job_facts(job_id, field);

CREATE TABLE job_events (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES jobs(id),
  type TEXT NOT NULL,
  payload_json TEXT NOT NULL DEFAULT '{}',
  actor_id TEXT,
  reason TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_job_events_job ON job_events(job_id, created_at);

CREATE TABLE job_steps (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES jobs(id),
  step_key TEXT NOT NULL,
  label TEXT NOT NULL,
  technique_keys_json TEXT NOT NULL DEFAULT '[]',
  estimated_hours TEXT,
  actual_hours TEXT,
  drying_hours TEXT,
  depends_on_json TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'PENDENTE' CHECK (status IN ('PENDENTE','EM_ANDAMENTO','CONCLUIDA')),
  sort INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE time_entries (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES jobs(id),
  step_id TEXT REFERENCES job_steps(id),
  hours TEXT NOT NULL,
  work_date TEXT NOT NULL,
  note TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL
);

-- Catálogo técnico (valores iniciais NÃO CALIBRADOS)
CREATE TABLE techniques (
  id TEXT PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  recipe_json TEXT NOT NULL,
  calibrated INTEGER NOT NULL DEFAULT 0,
  origin TEXT NOT NULL DEFAULT 'demo_only',
  version INTEGER NOT NULL DEFAULT 1,
  reviewed_by TEXT,
  reviewed_at TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE application_methods (
  id TEXT PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  speed_m2_per_hour TEXT NOT NULL,
  loss_pct TEXT NOT NULL,
  setup_hours TEXT NOT NULL,
  cleanup_hours TEXT NOT NULL,
  calibrated INTEGER NOT NULL DEFAULT 0,
  origin TEXT NOT NULL DEFAULT 'demo_only',
  updated_at TEXT NOT NULL
);

CREATE TABLE suppliers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  kind TEXT,
  contact TEXT,
  notes TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE materials (
  id TEXT PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT,
  base_unit TEXT NOT NULL,
  package_size TEXT NOT NULL,
  replacement_price_cents INTEGER CHECK (replacement_price_cents IS NULL OR replacement_price_cents > 0),
  price_updated_at TEXT,
  yield_m2_per_unit_per_coat TEXT,
  loss_pct TEXT NOT NULL DEFAULT '0',
  calibrated INTEGER NOT NULL DEFAULT 0,
  origin TEXT NOT NULL DEFAULT 'demo_only',
  min_stock TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL
);

CREATE TABLE material_price_history (
  id TEXT PRIMARY KEY,
  material_id TEXT NOT NULL REFERENCES materials(id),
  price_cents INTEGER NOT NULL,
  source TEXT,
  recorded_by TEXT,
  recorded_at TEXT NOT NULL
);

CREATE TABLE attachments (
  id TEXT PRIMARY KEY,
  r2_key TEXT NOT NULL UNIQUE,
  mime TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  sha256 TEXT,
  telegram_file_unique_id TEXT,
  owner_user_id TEXT REFERENCES users(id),
  job_id TEXT REFERENCES jobs(id),
  classification TEXT NOT NULL CHECK (classification IN ('foto_movel','recibo','audio','documento','outro')),
  retention_until TEXT,
  deleted_at TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_attachments_job ON attachments(job_id);
CREATE INDEX idx_attachments_file_unique ON attachments(telegram_file_unique_id);

-- Compras (desembolso de caixa). Consumo é registrado separadamente (material_consumptions).
CREATE TABLE purchases (
  id TEXT PRIMARY KEY,
  material_id TEXT REFERENCES materials(id),
  description TEXT NOT NULL,
  packages INTEGER,
  quantity TEXT,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  purchased_at TEXT NOT NULL,
  supplier_id TEXT REFERENCES suppliers(id),
  job_id TEXT REFERENCES jobs(id),
  attachment_id TEXT REFERENCES attachments(id),
  idempotency_key TEXT NOT NULL UNIQUE,
  created_by TEXT,
  created_at TEXT NOT NULL,
  voided_at TEXT
);

CREATE TABLE stock_movements (
  id TEXT PRIMARY KEY,
  material_id TEXT NOT NULL REFERENCES materials(id),
  kind TEXT NOT NULL CHECK (kind IN ('ENTRADA','CONSUMO','AJUSTE')),
  quantity TEXT NOT NULL,
  historical_unit_cost_cents TEXT,
  purchase_id TEXT REFERENCES purchases(id),
  job_id TEXT REFERENCES jobs(id),
  condition TEXT,
  note TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_stock_material ON stock_movements(material_id);

CREATE TABLE material_consumptions (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES jobs(id),
  quote_id TEXT,
  material_id TEXT NOT NULL REFERENCES materials(id),
  quantity TEXT NOT NULL,
  replacement_unit_cost_snapshot_cents TEXT NOT NULL,
  total_cost_cents INTEGER NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('ESTOQUE','COMPRA','MISTO')),
  created_at TEXT NOT NULL
);

-- Despesas que NÃO são compra de material (transporte, estacionamento...).
CREATE TABLE expenses (
  id TEXT PRIMARY KEY,
  job_id TEXT REFERENCES jobs(id),
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  spent_at TEXT NOT NULL,
  attachment_id TEXT REFERENCES attachments(id),
  idempotency_key TEXT NOT NULL UNIQUE,
  created_by TEXT,
  created_at TEXT NOT NULL,
  voided_at TEXT
);

CREATE TABLE subcontract_quotes (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES jobs(id),
  supplier_id TEXT REFERENCES suppliers(id),
  scope TEXT NOT NULL,
  cost_cents INTEGER,
  logistics_cents INTEGER NOT NULL DEFAULT 0,
  lead_days INTEGER,
  confirmed INTEGER NOT NULL DEFAULT 0,
  valid_until TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE settings_versions (
  id TEXT PRIMARY KEY,
  params_json TEXT NOT NULL,
  business_json TEXT NOT NULL DEFAULT '{}',
  effective_from TEXT NOT NULL,
  origin TEXT NOT NULL,
  approved_by TEXT,
  is_active INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE quotes (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES jobs(id),
  version INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('RASCUNHO','ESTIMATIVA','AGUARDANDO_REVISAO','APROVADO','ENVIADO','ACEITO','RECUSADO','CANCELADO','EXPIRADO')),
  input_json TEXT NOT NULL,
  result_json TEXT NOT NULL,
  floor_cents INTEGER,
  recommended_cents INTEGER,
  final_price_cents INTEGER,
  confidence TEXT,
  definitive_allowed INTEGER NOT NULL DEFAULT 0,
  engine_version TEXT NOT NULL,
  settings_version_id TEXT REFERENCES settings_versions(id),
  approved_by TEXT,
  approved_at TEXT,
  approval_note TEXT,
  valid_until TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  row_version INTEGER NOT NULL DEFAULT 1,
  UNIQUE (job_id, version)
);
CREATE INDEX idx_quotes_status ON quotes(status);

CREATE TABLE quote_lines (
  id TEXT PRIMARY KEY,
  quote_id TEXT NOT NULL REFERENCES quotes(id),
  kind TEXT NOT NULL,
  description TEXT NOT NULL,
  quantity TEXT,
  unit TEXT,
  internal_cost_cents INTEGER,
  commercial_amount_cents INTEGER,
  sort INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE quote_snapshots (
  id TEXT PRIMARY KEY,
  quote_id TEXT NOT NULL REFERENCES quotes(id),
  number TEXT NOT NULL,
  doc_version INTEGER NOT NULL,
  snapshot_json TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  created_by TEXT,
  created_at TEXT NOT NULL,
  UNIQUE (number, doc_version)
);

-- Documentos são imutáveis: nunca UPDATE. Revisão = nova linha/versão.
CREATE TABLE quote_documents (
  id TEXT PRIMARY KEY,
  quote_id TEXT NOT NULL REFERENCES quotes(id),
  snapshot_id TEXT NOT NULL REFERENCES quote_snapshots(id),
  number TEXT NOT NULL,
  doc_version INTEGER NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('COMERCIAL','INTERNO')),
  preliminary INTEGER NOT NULL DEFAULT 0,
  r2_key TEXT NOT NULL UNIQUE,
  sha256 TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  created_by TEXT,
  created_at TEXT NOT NULL,
  sent_to_artisan_at TEXT,
  UNIQUE (number, doc_version, kind)
);
CREATE TRIGGER quote_documents_immutable BEFORE UPDATE OF r2_key, sha256, snapshot_id, number, doc_version ON quote_documents
BEGIN SELECT RAISE(ABORT, 'quote_documents é imutável'); END;
CREATE TRIGGER quote_snapshots_immutable BEFORE UPDATE ON quote_snapshots
BEGIN SELECT RAISE(ABORT, 'quote_snapshots é imutável'); END;

CREATE TABLE document_sequences (
  year INTEGER PRIMARY KEY,
  last_value INTEGER NOT NULL
);

CREATE TABLE payments (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES jobs(id),
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  kind TEXT NOT NULL CHECK (kind IN ('ENTRADA','PARCELA','QUITACAO','ESTORNO')),
  method TEXT,
  paid_at TEXT NOT NULL,
  reference TEXT,
  idempotency_key TEXT NOT NULL UNIQUE,
  created_by TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_payments_job ON payments(job_id);

-- Memória conversacional
CREATE TABLE conversation_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE REFERENCES users(id),
  flow TEXT NOT NULL DEFAULT 'idle',
  context_json TEXT NOT NULL DEFAULT '{}',
  active_job_id TEXT REFERENCES jobs(id),
  last_question TEXT,
  last_activity_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  row_version INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE conversation_messages (
  id TEXT PRIMARY KEY,
  session_id TEXT REFERENCES conversation_sessions(id),
  user_id TEXT REFERENCES users(id),
  job_id TEXT REFERENCES jobs(id),
  direction TEXT NOT NULL CHECK (direction IN ('in','out')),
  kind TEXT NOT NULL CHECK (kind IN ('text','voice','photo','callback','document','system')),
  text TEXT,
  transcript TEXT,
  telegram_update_id INTEGER,
  telegram_message_id INTEGER,
  telegram_file_unique_id TEXT,
  intent TEXT,
  confidence REAL,
  status TEXT NOT NULL DEFAULT 'ok',
  created_at TEXT NOT NULL
);
CREATE INDEX idx_messages_job ON conversation_messages(job_id, created_at);
CREATE INDEX idx_messages_user ON conversation_messages(user_id, created_at);
CREATE INDEX idx_messages_file ON conversation_messages(telegram_file_unique_id);

-- Idempotência de webhook: update_id é a chave primária.
CREATE TABLE telegram_updates (
  update_id INTEGER PRIMARY KEY,
  received_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing','done','failed','ignored')),
  error TEXT
);

-- Suspeitas de duplicidade e mesclagens (reversíveis, auditadas)
CREATE TABLE duplicate_suspicions (
  id TEXT PRIMARY KEY,
  job_a_id TEXT NOT NULL REFERENCES jobs(id),
  job_b_id TEXT NOT NULL REFERENCES jobs(id),
  score REAL NOT NULL,
  reasons_json TEXT NOT NULL DEFAULT '[]',
  origin TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ABERTA' CHECK (status IN ('ABERTA','DISTINTOS','MESCLADOS')),
  decided_by TEXT,
  decided_at TEXT,
  created_at TEXT NOT NULL,
  UNIQUE (job_a_id, job_b_id)
);

CREATE TABLE job_merges (
  id TEXT PRIMARY KEY,
  source_job_id TEXT NOT NULL REFERENCES jobs(id),
  target_job_id TEXT NOT NULL REFERENCES jobs(id),
  moved_json TEXT NOT NULL,
  source_status_before TEXT NOT NULL,
  reason TEXT,
  merged_by TEXT NOT NULL,
  merged_at TEXT NOT NULL,
  undone_by TEXT,
  undone_at TEXT
);

CREATE TABLE approval_requests (
  id TEXT PRIMARY KEY,
  object_type TEXT NOT NULL,
  object_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  justification TEXT,
  requested_by TEXT,
  status TEXT NOT NULL DEFAULT 'PENDENTE' CHECK (status IN ('PENDENTE','APROVADA','RECUSADA')),
  decided_by TEXT,
  decided_at TEXT,
  decision_note TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_approvals_status ON approval_requests(status);

CREATE TABLE audit_events (
  id TEXT PRIMARY KEY,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  before_json TEXT,
  after_json TEXT,
  request_id TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_audit_entity ON audit_events(entity_type, entity_id);
CREATE INDEX idx_audit_created ON audit_events(created_at);

CREATE TABLE scheduled_reminders (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  job_id TEXT REFERENCES jobs(id),
  kind TEXT NOT NULL,
  due_at TEXT NOT NULL,
  sent_at TEXT,
  dedupe_key TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);

CREATE TABLE outbox_events (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDENTE' CHECK (status IN ('PENDENTE','ENVIADO','FALHOU','DESCARTADO')),
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TEXT NOT NULL,
  last_error TEXT,
  dedupe_key TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_outbox_pending ON outbox_events(status, next_attempt_at);

CREATE TABLE ai_usage (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  task TEXT NOT NULL CHECK (task IN ('stt','extraction','vision','match_hint')),
  input_units REAL,
  output_units REAL,
  unit_kind TEXT,
  estimated_neurons REAL,
  estimated_cost_usd_micros INTEGER,
  success INTEGER NOT NULL,
  latency_ms INTEGER,
  error_code TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_ai_usage_created ON ai_usage(created_at);
