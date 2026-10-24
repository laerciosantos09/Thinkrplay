CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text NOT NULL,
  email text NOT NULL,
  password_hash text NOT NULL,
  secret_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS users_username_key ON users (lower(username));

CREATE UNIQUE INDEX IF NOT EXISTS users_email_key ON users (lower(email));

CREATE TABLE IF NOT EXISTS scores (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game text NOT NULL,
  points integer NOT NULL CHECK (points >= 0),
  level integer NOT NULL CHECK (level >= 1),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS scores_game_created_idx ON scores (game, created_at DESC);

CREATE INDEX IF NOT EXISTS scores_user_idx ON scores (user_id);

CREATE TABLE IF NOT EXISTS progress (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game text NOT NULL,
  unlocked_level integer NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, game)
);
