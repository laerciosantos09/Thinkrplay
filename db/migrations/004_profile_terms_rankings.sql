-- 004 · Perfil, Termos/Privacidade e ranking geral.
--  - token_version: sobe ao trocar/redefinir a senha e encerra as outras sessões
--  - terms_version / terms_accepted_at: aceite dos Termos de Uso e da Política de Privacidade
--  - índice por data para o ranking geral (todos os jogos)
-- Pode ser executado várias vezes sem problema.

ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version integer NOT NULL DEFAULT 0;

ALTER TABLE users ADD COLUMN IF NOT EXISTS terms_version text;

ALTER TABLE users ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz;

CREATE INDEX IF NOT EXISTS scores_created_idx ON scores (created_at DESC);
