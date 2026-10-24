-- Thinkrplay: estrutura do banco (Postgres/Neon). Pode ser executado várias vezes sem problema.
-- Neon: SQL Editor > cole este arquivo inteiro > Run. Ou: npm run db:migrate

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text NOT NULL,
  email text NOT NULL,
  password_hash text NOT NULL,
  secret_hash text NOT NULL,
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Bancos criados antes do campo role
ALTER TABLE users ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin'));

CREATE UNIQUE INDEX IF NOT EXISTS users_username_key ON users (lower(username));

CREATE UNIQUE INDEX IF NOT EXISTS users_email_key ON users (lower(email));

CREATE TABLE IF NOT EXISTS scores (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game text NOT NULL,
  tier text NOT NULL DEFAULT 'easy',
  points integer NOT NULL CHECK (points >= 0),
  level integer NOT NULL CHECK (level >= 1), -- número do desafio (1..500) dentro do tier
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS scores_game_created_idx ON scores (game, created_at DESC);

CREATE INDEX IF NOT EXISTS scores_user_idx ON scores (user_id);

-- Desafios resolvidos por usuário, jogo e nível (easy/medium/hard). Os desafios abrem em sequência (1..500).
CREATE TABLE IF NOT EXISTS tier_progress (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game text NOT NULL,
  tier text NOT NULL CHECK (tier IN ('easy', 'medium', 'hard')),
  solved integer NOT NULL DEFAULT 0 CHECK (solved BETWEEN 0 AND 500),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, game, tier)
);

-- Modelo antigo (níveis 1..1000 sem tiers), substituído por tier_progress
DROP TABLE IF EXISTS progress;

CREATE TABLE IF NOT EXISTS plays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game text NOT NULL,
  tier text NOT NULL DEFAULT 'easy',
  level integer NOT NULL, -- número do desafio (1..500) dentro do tier
  seed integer NOT NULL,
  state jsonb NOT NULL DEFAULT '{}',
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  points integer
);

CREATE INDEX IF NOT EXISTS plays_user_started_idx ON plays (user_id, started_at DESC);

-- Bancos criados antes dos níveis (easy/medium/hard)
ALTER TABLE scores ADD COLUMN IF NOT EXISTS tier text NOT NULL DEFAULT 'easy';

ALTER TABLE plays ADD COLUMN IF NOT EXISTS tier text NOT NULL DEFAULT 'easy';

CREATE TABLE IF NOT EXISTS auth_attempts (
  id bigserial PRIMARY KEY,
  email text NOT NULL,
  ip text NOT NULL,
  at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS auth_attempts_email_idx ON auth_attempts (email, at DESC);

CREATE INDEX IF NOT EXISTS auth_attempts_ip_idx ON auth_attempts (ip, at DESC);
