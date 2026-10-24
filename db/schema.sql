-- Thinkrplay: estrutura COMPLETA do banco (Postgres/Neon). GERADO por "npm run db:schema" a partir de db/migrations/.
-- Não edite aqui: altere ou crie uma migração em db/migrations/ e rode "npm run db:schema".
-- Pode ser executado várias vezes sem problema. Neon: SQL Editor > cole este arquivo inteiro > Run.

-- ===== 001_base.sql =====
-- 001 · Base: usuários, pontuações, partidas e tentativas de login.
-- Pode ser executado várias vezes sem problema. Neon: SQL Editor > cole este arquivo > Run.

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
  points integer NOT NULL CHECK (points >= 0),
  level integer NOT NULL CHECK (level >= 1), -- número do desafio dentro do nível
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS scores_game_created_idx ON scores (game, created_at DESC);

CREATE INDEX IF NOT EXISTS scores_user_idx ON scores (user_id);

CREATE TABLE IF NOT EXISTS plays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game text NOT NULL,
  level integer NOT NULL, -- número do desafio dentro do nível
  seed integer NOT NULL,
  state jsonb NOT NULL DEFAULT '{}',
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  points integer
);

CREATE INDEX IF NOT EXISTS plays_user_started_idx ON plays (user_id, started_at DESC);

CREATE TABLE IF NOT EXISTS auth_attempts (
  id bigserial PRIMARY KEY,
  email text NOT NULL,
  ip text NOT NULL,
  at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS auth_attempts_email_idx ON auth_attempts (email, at DESC);

CREATE INDEX IF NOT EXISTS auth_attempts_ip_idx ON auth_attempts (ip, at DESC);

-- ===== 002_levels_tiers.sql =====
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

-- ===== 003_game_settings.sql =====
-- 003 · Configurações do administrador: jogos habilitados/desabilitados.
-- Jogo sem linha aqui conta como habilitado. Pode ser executado várias vezes sem problema.

CREATE TABLE IF NOT EXISTS game_settings (
  game text PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL
);

-- ===== 004_profile_terms_rankings.sql =====
-- 004 · Perfil, Termos/Privacidade e ranking geral.
--  - token_version: sobe ao trocar/redefinir a senha e encerra as outras sessões
--  - terms_version / terms_accepted_at: aceite dos Termos de Uso e da Política de Privacidade
--  - índice por data para o ranking geral (todos os jogos)
-- Pode ser executado várias vezes sem problema.

ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version integer NOT NULL DEFAULT 0;

ALTER TABLE users ADD COLUMN IF NOT EXISTS terms_version text;

ALTER TABLE users ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz;

CREATE INDEX IF NOT EXISTS scores_created_idx ON scores (created_at DESC);

-- ===== 005_app_settings.sql =====
-- 005 · Configurações gerais do app (liga/desliga recursos pelo administrador).
-- Chave "ads" = anúncios. Sem linha para a chave, o recurso está DESLIGADO.
-- Pode ser executado várias vezes sem problema.

CREATE TABLE IF NOT EXISTS app_settings (
  key text PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL
);

-- ===== 006_premium.sql =====
-- 006 · Plano Premium (assinatura via Stripe).
--  - subscriptions: uma linha por usuário com o estado da assinatura (espelho do Stripe, atualizado por webhook)
--  - stripe_events: eventos do Stripe já processados (evita processar o mesmo evento duas vezes)
-- Pode ser executado várias vezes sem problema.

CREATE TABLE IF NOT EXISTS subscriptions (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  stripe_customer_id text NOT NULL,
  stripe_subscription_id text,
  status text NOT NULL DEFAULT 'none', -- none, active, trialing, past_due, canceled, unpaid, incomplete...
  price_id text,
  current_period_end timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  event_created timestamptz, -- momento do último evento aplicado (ignora eventos antigos que chegam fora de ordem)
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_customer_key ON subscriptions (stripe_customer_id);

CREATE TABLE IF NOT EXISTS stripe_events (
  id text PRIMARY KEY,
  type text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now()
);

-- ===== 007_play_energy.sql =====
-- 007 · Limite de partidas em sequência ("energia"): estoque que recarrega com o tempo.
-- charges = partidas disponíveis na última contabilização; refilled_at = até quando a recarga já foi contada.
-- Só é usado quando o administrador liga o limite (app_settings, chave "energy"). Pode ser executado várias vezes.

CREATE TABLE IF NOT EXISTS play_energy (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  charges integer NOT NULL,
  refilled_at timestamptz NOT NULL DEFAULT now()
);
