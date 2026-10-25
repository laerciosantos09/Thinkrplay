-- 008 · Login com Google e Apple.
--  - password_hash e secret_hash passam a aceitar NULL: conta criada pelo Google/Apple não tem senha até o usuário definir uma
--  - oauth_identities: ligação entre a conta do app e a conta no provedor (uma de cada provedor por usuário)
--  - refresh_token (só Apple): guardado CIFRADO, usado para revogar o acesso na Apple ao excluir a conta
-- Pode ser executado várias vezes sem problema.

ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

ALTER TABLE users ALTER COLUMN secret_hash DROP NOT NULL;

CREATE TABLE IF NOT EXISTS oauth_identities (
  provider text NOT NULL CHECK (provider IN ('google', 'apple')),
  provider_user_id text NOT NULL,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email text,
  refresh_token text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (provider, provider_user_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS oauth_identities_user_provider_key ON oauth_identities (user_id, provider);
