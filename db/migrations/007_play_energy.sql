-- 007 · Limite de partidas em sequência ("energia"): estoque que recarrega com o tempo.
-- charges = partidas disponíveis na última contabilização; refilled_at = até quando a recarga já foi contada.
-- Só é usado quando o administrador liga o limite (app_settings, chave "energy"). Pode ser executado várias vezes.

CREATE TABLE IF NOT EXISTS play_energy (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  charges integer NOT NULL,
  refilled_at timestamptz NOT NULL DEFAULT now()
);
