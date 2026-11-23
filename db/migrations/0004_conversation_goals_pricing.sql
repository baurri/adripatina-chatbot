-- 0004: objetivos conversacionais persistentes, roteamento auditável e coleta de preços
-- durante o orçamento. Apenas acréscimos: nenhum dado existente é apagado.

-- 1) Auditoria de roteamento por mensagem (intenção bruta já existe em `intent`).
ALTER TABLE conversation_messages ADD COLUMN contextual_intent TEXT;
ALTER TABLE conversation_messages ADD COLUMN route TEXT;
ALTER TABLE conversation_messages ADD COLUMN routing_json TEXT;

-- 2) Histórico de preços mais rico (valor e embalagem anteriores, origem, conversa, serviço, orçamento).
ALTER TABLE material_price_history ADD COLUMN previous_price_cents INTEGER;
ALTER TABLE material_price_history ADD COLUMN package_size TEXT;
ALTER TABLE material_price_history ADD COLUMN previous_package_size TEXT;
ALTER TABLE material_price_history ADD COLUMN confidence TEXT;
ALTER TABLE material_price_history ADD COLUMN message_id TEXT;
ALTER TABLE material_price_history ADD COLUMN job_id TEXT;
ALTER TABLE material_price_history ADD COLUMN quote_id TEXT;
ALTER TABLE material_price_history ADD COLUMN source_text TEXT;
ALTER TABLE material_price_history ADD COLUMN idempotency_key TEXT;
-- duplo clique / reentrega nunca duplica uma atualização confirmada
CREATE UNIQUE INDEX idx_price_history_idem ON material_price_history(idempotency_key) WHERE idempotency_key IS NOT NULL;

-- 3) Observações de aprendizado: novos tipos (CHECK exige recriar a tabela; dados copiados integralmente).
CREATE TABLE learning_observations_v2 (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  job_id TEXT REFERENCES jobs(id),
  message_id TEXT REFERENCES conversation_messages(id),
  kind TEXT NOT NULL CHECK (kind IN ('MATERIAL_PURCHASE','MATERIAL_SOURCE','TECHNIQUE_TIME','MATERIAL_USAGE','MATERIAL_PRICE_QUOTE','ITEM_CONDITION','QUOTE_REQUEST')),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('material','technique','job','quote_request')),
  entity_key TEXT NOT NULL,
  data_json TEXT NOT NULL DEFAULT '{}',
  confidence REAL NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'APLICADO' CHECK (status IN ('COLETADO','SUGERIDO','APLICADO','REJEITADO')),
  applied_at TEXT,
  created_at TEXT NOT NULL,
  origin TEXT,
  quote_id TEXT,
  source_text TEXT
);
INSERT INTO learning_observations_v2 (id, user_id, job_id, message_id, kind, entity_type, entity_key, data_json, confidence, status, applied_at, created_at)
  SELECT id, user_id, job_id, message_id, kind, entity_type, entity_key, data_json, confidence, status, applied_at, created_at FROM learning_observations;
DROP TABLE learning_observations;
ALTER TABLE learning_observations_v2 RENAME TO learning_observations;
CREATE INDEX idx_learning_entity ON learning_observations(entity_type, entity_key, created_at);
CREATE INDEX idx_learning_status ON learning_observations(status, created_at);

-- 4) Pedidos de orçamento com vários itens/clientes antes de criar serviços definitivos.
CREATE TABLE quote_requests (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'EM_ANDAMENTO' CHECK (status IN ('EM_ANDAMENTO','CALCULADO','PAUSADO','CANCELADO')),
  goal TEXT NOT NULL DEFAULT 'CALCULATE_QUOTE',
  raw_source_message TEXT NOT NULL,
  source_message_id TEXT,
  requested_for_date TEXT,
  requested_date_expression TEXT,
  state_json TEXT NOT NULL,
  job_ids_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_quote_requests_user ON quote_requests(user_id, status);
