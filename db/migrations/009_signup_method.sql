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
