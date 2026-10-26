-- 011 · Confirmação de e-mail no cadastro (ligável pelo administrador).
--  - email_tokens: links de confirmação de uso único (guarda só o HASH do token) e com validade
--  - users.verification_required: true para contas criadas com a confirmação ligada. Só elas ficam barradas até confirmar;
--    contas antigas não são afetadas quando o administrador liga o recurso
-- Pode ser executado várias vezes sem problema.

ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_required boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS email_tokens (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS email_tokens_user_idx ON email_tokens (user_id, created_at DESC);
