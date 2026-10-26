-- 012 · Sinais para detectar partidas suspeitas (robôs).
--  - pace_ratio: tempo gasto dividido pelo mínimo plausível para um humano naquela partida (perto de 1 = ritmo de robô)
-- Só alimenta o painel do administrador; nada é bloqueado automaticamente. Pode ser executado várias vezes.

ALTER TABLE plays ADD COLUMN IF NOT EXISTS pace_ratio real;

CREATE INDEX IF NOT EXISTS plays_pace_idx ON plays (user_id, finished_at DESC) WHERE pace_ratio IS NOT NULL;
