-- 002 · Níveis Easy/Medium/Hard (500 desafios por jogo e nível).
-- Acrescenta a coluna tier em scores e plays e cria tier_progress (desafios resolvidos por usuário, jogo e nível).
-- ATENÇÃO: remove a tabela antiga "progress" (modelo de níveis 1..1000 sem tiers); quem tinha progresso nela volta ao Easy.
-- Pode ser executado várias vezes sem problema.

ALTER TABLE scores ADD COLUMN IF NOT EXISTS tier text NOT NULL DEFAULT 'easy';

ALTER TABLE plays ADD COLUMN IF NOT EXISTS tier text NOT NULL DEFAULT 'easy';

-- Os desafios de cada nível abrem em sequência (1..500); "solved" é quantos já foram resolvidos.
CREATE TABLE IF NOT EXISTS tier_progress (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game text NOT NULL,
  tier text NOT NULL CHECK (tier IN ('easy', 'medium', 'hard')),
  solved integer NOT NULL DEFAULT 0 CHECK (solved BETWEEN 0 AND 500),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, game, tier)
);

DROP TABLE IF EXISTS progress;
