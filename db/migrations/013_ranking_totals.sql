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
