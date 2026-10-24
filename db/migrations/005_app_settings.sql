-- 005 · Configurações gerais do app (liga/desliga recursos pelo administrador).
-- Chave "ads" = anúncios. Sem linha para a chave, o recurso está DESLIGADO.
-- Pode ser executado várias vezes sem problema.

CREATE TABLE IF NOT EXISTS app_settings (
  key text PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL
);
