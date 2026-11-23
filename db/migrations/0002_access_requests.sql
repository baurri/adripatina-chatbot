-- Pedidos de acesso ao bot: quem não está autorizado e escreve ao bot fica registrado
-- para o administrador aprovar pelo painel. Guarda o mínimo (ID numérico e primeiro nome).
CREATE TABLE access_requests (
  id TEXT PRIMARY KEY,
  telegram_user_id TEXT NOT NULL UNIQUE,
  telegram_chat_id TEXT NOT NULL,
  first_name TEXT,
  username TEXT,
  attempts INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'PENDENTE' CHECK (status IN ('PENDENTE','APROVADO','RECUSADO')),
  user_id TEXT REFERENCES users(id),
  decided_by TEXT,
  decided_at TEXT,
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL
);
CREATE INDEX idx_access_requests_status ON access_requests(status, last_seen_at);
