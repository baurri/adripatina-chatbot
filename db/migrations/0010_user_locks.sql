-- Uma mensagem por vez por artesão: o texto e o toque no botão chegando juntos geravam duas respostas
-- e um botão velho podia fechar um orçamento em cima de outro recém-fechado.
CREATE TABLE IF NOT EXISTS user_locks (
  user_id TEXT PRIMARY KEY,
  until_ms INTEGER NOT NULL,
  token TEXT NOT NULL
);
