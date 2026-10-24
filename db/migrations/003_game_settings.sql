-- 003 · Configurações do administrador: jogos habilitados/desabilitados.
-- Jogo sem linha aqui conta como habilitado. Pode ser executado várias vezes sem problema.

CREATE TABLE IF NOT EXISTS game_settings (
  game text PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL
);
