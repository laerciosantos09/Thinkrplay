-- 014 · Login social no app nativo (Android/iOS).
-- O Google bloqueia login dentro do WebView do app, então o login roda no navegador do sistema e volta para o app por um
-- código de uso único. app_handoffs guarda só o HASH do código, a "challenge" (hash do segredo que só o app conhece, estilo PKCE)
-- e a validade (2 minutos). Pode ser executado várias vezes sem problema.

CREATE TABLE IF NOT EXISTS app_handoffs (
  code_hash text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  challenge text NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz
);

CREATE INDEX IF NOT EXISTS app_handoffs_expires_idx ON app_handoffs (expires_at);
