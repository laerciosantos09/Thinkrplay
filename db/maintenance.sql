-- Manutenção periódica (rode quando quiser, por exemplo 1x por semana no SQL Editor do Neon).

-- Partidas abandonadas há mais de 7 dias (não afetam ranking nem progresso)
DELETE FROM plays WHERE finished_at IS NULL AND started_at < now() - interval '7 days';

-- Partidas finalizadas há mais de 90 dias (as pontuações ficam na tabela scores)
DELETE FROM plays WHERE finished_at IS NOT NULL AND started_at < now() - interval '90 days';

-- Tentativas de login antigas
DELETE FROM auth_attempts WHERE at < now() - interval '1 day';
