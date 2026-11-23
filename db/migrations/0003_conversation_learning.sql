-- Evidências aprendidas nas conversas. Fatos objetivos confirmados podem atualizar
-- o catálogo; estimativas técnicas permanecem rastreáveis para revisão.
CREATE TABLE learning_observations (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  job_id TEXT REFERENCES jobs(id),
  message_id TEXT REFERENCES conversation_messages(id),
  kind TEXT NOT NULL CHECK (kind IN ('MATERIAL_PURCHASE','MATERIAL_SOURCE','TECHNIQUE_TIME','MATERIAL_USAGE')),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('material','technique','job')),
  entity_key TEXT NOT NULL,
  data_json TEXT NOT NULL DEFAULT '{}',
  confidence REAL NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'APLICADO' CHECK (status IN ('COLETADO','SUGERIDO','APLICADO','REJEITADO')),
  applied_at TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_learning_entity ON learning_observations(entity_type, entity_key, created_at);
CREATE INDEX idx_learning_status ON learning_observations(status, created_at);
