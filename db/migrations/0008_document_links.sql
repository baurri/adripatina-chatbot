-- Link público e temporário do PDF comercial (D-080): o artesão manda no WhatsApp do cliente com um toque.
-- Token aleatório de 128 bits (não revela cliente, valor nem número), com validade.
CREATE TABLE IF NOT EXISTS document_links (
  token TEXT PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES quote_documents(id),
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  opened_count INTEGER NOT NULL DEFAULT 0,
  last_opened_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_document_links_document ON document_links(document_id);
