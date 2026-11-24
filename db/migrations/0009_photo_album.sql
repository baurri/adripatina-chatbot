-- Fotos mandadas juntas (álbum do Telegram): todas chegam com o mesmo media_group_id.
-- O bot espera o álbum terminar e responde UMA vez, olhando todas as fotos.
ALTER TABLE attachments ADD COLUMN media_group_id TEXT;
CREATE INDEX IF NOT EXISTS idx_attachments_media_group ON attachments(media_group_id);
