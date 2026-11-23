-- 0005: coleta proativa de informações faltantes, desatualizadas ou pouco confiáveis.
-- Apenas acréscimos: nenhum dado existente é apagado. Compatível com o código anterior
-- (colunas novas têm DEFAULT; tabelas novas não são lidas pelo código antigo).

-- 1) Materiais: valor aproximado, data da última contagem de estoque e silêncio por item.
ALTER TABLE materials ADD COLUMN price_is_estimate INTEGER NOT NULL DEFAULT 0;
ALTER TABLE materials ADD COLUMN stock_checked_at TEXT;
ALTER TABLE materials ADD COLUMN stock_is_estimate INTEGER NOT NULL DEFAULT 0;
-- "não usamos mais" / admin silenciou: não perguntar sobre o item até esta data
ALTER TABLE materials ADD COLUMN proactive_muted_until TEXT;

ALTER TABLE material_price_history ADD COLUMN is_estimate INTEGER NOT NULL DEFAULT 0;
ALTER TABLE material_price_history ADD COLUMN collection_request_id TEXT;

-- 2) Solicitações persistentes de coleta.
CREATE TABLE data_collection_requests (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  need_kind TEXT NOT NULL,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('material','technique','job','quote')),
  entity_id TEXT NOT NULL,
  entity_key TEXT,
  entity_label TEXT NOT NULL,
  fields_json TEXT NOT NULL DEFAULT '[]',
  reason TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 0,
  priority_reasons_json TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'identified' CHECK (status IN ('identified','queued','sent','waiting_response','partially_answered','waiting_confirmation','resolved','snoozed','expired','cancelled','failed')),
  origin TEXT NOT NULL DEFAULT 'proactive_job' CHECK (origin IN ('proactive_job','active_conversation','quote_blocker','admin')),
  benefit_job_id TEXT,
  benefit_quote_id TEXT,
  question_text TEXT,
  expected_format TEXT,
  partial_json TEXT NOT NULL DEFAULT '{}',
  attempts INTEGER NOT NULL DEFAULT 0,
  last_sent_at TEXT,
  next_allowed_at TEXT,
  due_at TEXT,
  answer_text TEXT,
  answer_message_id TEXT,
  interpretation_confidence TEXT,
  needs_confirmation INTEGER NOT NULL DEFAULT 0,
  result_json TEXT,
  close_reason TEXT,
  dedupe_key TEXT NOT NULL,
  correlation_id TEXT NOT NULL,
  telegram_message_id TEXT,
  -- prioridade fixada manualmente pelo administrador (o job não recalcula)
  priority_locked INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  resolved_at TEXT
);
-- no máximo UMA solicitação aberta por (usuário, dado, entidade)
CREATE UNIQUE INDEX idx_dcr_open_dedupe ON data_collection_requests(dedupe_key)
  WHERE status IN ('identified','queued','sent','waiting_response','partially_answered','waiting_confirmation','snoozed','failed');
CREATE INDEX idx_dcr_status_next ON data_collection_requests(status, next_allowed_at);
CREATE INDEX idx_dcr_user_status ON data_collection_requests(user_id, status);
CREATE INDEX idx_dcr_kind ON data_collection_requests(need_kind);
CREATE INDEX idx_dcr_entity ON data_collection_requests(entity_type, entity_id);
CREATE INDEX idx_dcr_priority ON data_collection_requests(priority);
CREATE INDEX idx_dcr_dedupe_all ON data_collection_requests(dedupe_key, updated_at);

-- 3) Linha do tempo de cada solicitação (auditoria e observabilidade).
CREATE TABLE data_collection_events (
  id TEXT PRIMARY KEY,
  request_id TEXT REFERENCES data_collection_requests(id),
  user_id TEXT,
  correlation_id TEXT,
  kind TEXT NOT NULL,
  actor TEXT NOT NULL,
  message_id TEXT,
  data_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);
CREATE INDEX idx_dce_request ON data_collection_events(request_id, created_at);
CREATE INDEX idx_dce_user_kind ON data_collection_events(user_id, kind, created_at);

-- 4) Execuções de jobs agendados (lock por janela + resultado).
CREATE TABLE job_runs (
  id TEXT PRIMARY KEY,
  job_name TEXT NOT NULL,
  run_key TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running','done','failed','skipped')),
  correlation_id TEXT NOT NULL,
  result_json TEXT,
  started_at TEXT NOT NULL,
  finished_at TEXT
);
CREATE INDEX idx_job_runs_name ON job_runs(job_name, started_at);

-- 5) Configurações operacionais simples (não versionadas, não entram em orçamentos).
CREATE TABLE system_flags (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL,
  updated_by TEXT,
  updated_at TEXT NOT NULL
);

-- 6) Aprendizado: novos tipos (CHECK exige recriar a tabela; dados copiados integralmente).
CREATE TABLE learning_observations_v3 (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  job_id TEXT REFERENCES jobs(id),
  message_id TEXT REFERENCES conversation_messages(id),
  kind TEXT NOT NULL CHECK (kind IN ('MATERIAL_PURCHASE','MATERIAL_SOURCE','TECHNIQUE_TIME','MATERIAL_USAGE','MATERIAL_PRICE_QUOTE','ITEM_CONDITION','QUOTE_REQUEST','STOCK_COUNT','TECHNIQUE_OBSERVATION','JOB_ACTUAL_HOURS')),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('material','technique','job','quote_request')),
  entity_key TEXT NOT NULL,
  data_json TEXT NOT NULL DEFAULT '{}',
  confidence REAL NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'APLICADO' CHECK (status IN ('COLETADO','SUGERIDO','APLICADO','REJEITADO')),
  applied_at TEXT,
  created_at TEXT NOT NULL,
  origin TEXT,
  quote_id TEXT,
  source_text TEXT,
  collection_request_id TEXT
);
INSERT INTO learning_observations_v3 (id, user_id, job_id, message_id, kind, entity_type, entity_key, data_json, confidence, status, applied_at, created_at, origin, quote_id, source_text)
  SELECT id, user_id, job_id, message_id, kind, entity_type, entity_key, data_json, confidence, status, applied_at, created_at, origin, quote_id, source_text FROM learning_observations;
DROP TABLE learning_observations;
ALTER TABLE learning_observations_v3 RENAME TO learning_observations;
CREATE INDEX idx_learning_entity ON learning_observations(entity_type, entity_key, created_at);
CREATE INDEX idx_learning_status ON learning_observations(status, created_at);
CREATE INDEX idx_learning_request ON learning_observations(collection_request_id);
