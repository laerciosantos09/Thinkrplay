-- 010 · Aceite separado da Política de Privacidade.
--  - terms_version / terms_accepted_at (da 004) passam a valer só para os TERMOS DE USO
--  - privacy_version / privacy_accepted_at: aceite da POLÍTICA DE PRIVACIDADE
-- O aceite é um "flag" por documento: marcado como aceito na versão vigente, não é pedido de novo.
-- Quem já tinha aceitado o conjunto antes continua aceito nos dois. Pode ser executado várias vezes sem problema.

ALTER TABLE users ADD COLUMN IF NOT EXISTS privacy_version text;

ALTER TABLE users ADD COLUMN IF NOT EXISTS privacy_accepted_at timestamptz;

UPDATE users SET privacy_version = terms_version, privacy_accepted_at = terms_accepted_at
WHERE privacy_version IS NULL AND terms_version IS NOT NULL;
