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

-- ===== 008_oauth_login.sql =====
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

-- ===== 009_signup_method.sql =====
-- 009 · Origem do cadastro e e-mail verificado.
--  - signup_method: por onde a conta foi criada ('password', 'google' ou 'apple'). Os tipos de login ATIVOS (flags) são
--    derivados: senha (password_hash preenchido) + uma linha em oauth_identities por provedor conectado.
--  - email_verified: true quando um provedor (Google/Apple) confirmou o e-mail. Só contas verificadas são unificadas
--    automaticamente com um novo login social; as demais pedem a senha antes de conectar.
-- Pode ser executado várias vezes sem problema.

ALTER TABLE users ADD COLUMN IF NOT EXISTS signup_method text NOT NULL DEFAULT 'password' CHECK (signup_method IN ('password', 'google', 'apple'));
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified boolean NOT NULL DEFAULT false;

-- Contas já criadas pelo login social (sem senha): origem = primeiro provedor conectado, e-mail verificado.
UPDATE users u SET signup_method = i.provider, email_verified = true
FROM (SELECT DISTINCT ON (user_id) user_id, provider FROM oauth_identities ORDER BY user_id, created_at) i
WHERE i.user_id = u.id AND u.password_hash IS NULL AND u.signup_method = 'password';

-- ===== 010_privacy_acceptance.sql =====
-- 010 · Aceite separado da Política de Privacidade.
--  - terms_version / terms_accepted_at (da 004) passam a valer só para os TERMOS DE USO
--  - privacy_version / privacy_accepted_at: aceite da POLÍTICA DE PRIVACIDADE
-- O aceite é um "flag" por documento: marcado como aceito na versão vigente, não é pedido de novo.
-- Quem já tinha aceitado o conjunto antes continua aceito nos dois. Pode ser executado várias vezes sem problema.

ALTER TABLE users ADD COLUMN IF NOT EXISTS privacy_version text;

ALTER TABLE users ADD COLUMN IF NOT EXISTS privacy_accepted_at timestamptz;

UPDATE users SET privacy_version = terms_version, privacy_accepted_at = terms_accepted_at
WHERE privacy_version IS NULL AND terms_version IS NOT NULL;

-- ===== 011_email_verification.sql =====
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

-- ===== 012_play_signals.sql =====
-- 012 · Sinais para detectar partidas suspeitas (robôs).
--  - pace_ratio: tempo gasto dividido pelo mínimo plausível para um humano naquela partida (perto de 1 = ritmo de robô)
-- Só alimenta o painel do administrador; nada é bloqueado automaticamente. Pode ser executado várias vezes.

ALTER TABLE plays ADD COLUMN IF NOT EXISTS pace_ratio real;

CREATE INDEX IF NOT EXISTS plays_pace_idx ON plays (user_id, finished_at DESC) WHERE pace_ratio IS NOT NULL;

-- ===== 013_ranking_totals.sql =====
-- 013 · Totais do ranking salvos em tabela.
--  - ranking_totals: pontos, desafios e último horário por usuário, jogo (ou 'all' = geral) e período (dia/semana/mês/ano,
--    no fuso America/Sao_Paulo). É atualizada a cada pontuação nova e lida por índice, sem somar a tabela scores a cada consulta.
--  - scores continua sendo a fonte da verdade: esta migração (re)calcula tudo a partir dela e pode ser executada de novo
--    a qualquer momento para reparar os totais.
-- Pode ser executado várias vezes sem problema.

CREATE TABLE IF NOT EXISTS ranking_totals (
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  game text NOT NULL,
  period text NOT NULL CHECK (period IN ('day', 'week', 'month', 'year')),
  period_start date NOT NULL,
  points integer NOT NULL,
  solved integer NOT NULL,
  last_at timestamptz NOT NULL,
  PRIMARY KEY (user_id, game, period, period_start)
);

CREATE INDEX IF NOT EXISTS ranking_totals_rank_idx ON ranking_totals (game, period, period_start, points DESC, last_at ASC, user_id);

INSERT INTO ranking_totals (user_id, game, period, period_start, points, solved, last_at)
SELECT s.user_id, g.game, p.period, date_trunc(p.period, s.created_at AT TIME ZONE 'America/Sao_Paulo')::date,
       SUM(s.points)::int, COUNT(*)::int, MAX(s.created_at)
FROM scores s
CROSS JOIN (VALUES ('day'), ('week'), ('month'), ('year')) AS p(period)
CROSS JOIN LATERAL (VALUES (s.game), ('all')) AS g(game)
GROUP BY s.user_id, g.game, p.period, date_trunc(p.period, s.created_at AT TIME ZONE 'America/Sao_Paulo')::date
ON CONFLICT (user_id, game, period, period_start) DO UPDATE
  SET points = EXCLUDED.points, solved = EXCLUDED.solved, last_at = EXCLUDED.last_at;
