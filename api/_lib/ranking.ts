import { sql } from './db.js';

// Rankings: a tabela ranking_totals guarda os totais por usuário/jogo/período (migração 013). Os períodos são calendários
// no fuso de São Paulo; "period_start" é o primeiro dia do período (date_trunc), igual na escrita e na leitura.
export const TZ = 'America/Sao_Paulo';
export const PERIODS = { daily: 'day', weekly: 'week', monthly: 'month', yearly: 'year' } as const;
export type PeriodName = keyof typeof PERIODS;

// Depois de uma pontuação nova, recalcula (não soma) os totais dos períodos em andamento daquele usuário, do jogo e do geral.
// Recalcular a partir de scores é idempotente: repetir o comando nunca conta pontos em dobro.
// Melhor esforço: se falhar, a partida já foi salva e o próximo desafio do usuário corrige; sem a tabela (013 pendente) é ignorado.
export const refreshTotals = async (userId: string, game: string) => {
  try {
    await sql`
      WITH p AS (
        SELECT u AS period, date_trunc(u, now() AT TIME ZONE ${TZ}) AS local_start
        FROM unnest(ARRAY['day', 'week', 'month', 'year']::text[]) AS u
      )
      INSERT INTO ranking_totals (user_id, game, period, period_start, points, solved, last_at)
      SELECT ${userId}::uuid, g.game, p.period, p.local_start::date, SUM(s.points)::int, COUNT(*)::int, MAX(s.created_at)
      FROM p
      CROSS JOIN LATERAL (VALUES (${game}::text), ('all')) AS g(game)
      JOIN scores s ON s.user_id = ${userId}::uuid
        AND s.created_at >= p.local_start AT TIME ZONE ${TZ}
        AND (g.game = 'all' OR s.game = g.game)
      GROUP BY g.game, p.period, p.local_start
      ON CONFLICT (user_id, game, period, period_start) DO UPDATE
        SET points = EXCLUDED.points, solved = EXCLUDED.solved, last_at = EXCLUDED.last_at`;
  } catch (err: any) {
    if (err?.code !== '42P01') console.error('Falha ao atualizar os totais do ranking:', err?.message ?? err);
  }
};
