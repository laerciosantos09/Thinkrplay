import { HttpError, sql } from './_lib/db.js';
import { GAME_SLUGS, optionalSession, route } from './_lib/http.js';

const PERIODS = { daily: 'day', weekly: 'week', monthly: 'month', yearly: 'year' } as const;
const TZ = 'America/Sao_Paulo';
const TOP = 10;

// GET /api/ranking?game=<jogo> -> ranking do jogo; ?game=all -> ranking geral (soma de todos os jogos).
// Calculado na hora a partir das pontuações, então cada desafio concluído já aparece na próxima consulta.
// Quando há usuário logado, a posição dele vem junto (marcada com isMe) mesmo fora do top 10.
export default route(['GET'], async (req) => {
  const game = String(req.query.game ?? '');
  if (game !== 'all' && !GAME_SLUGS.includes(game)) throw new HttpError(400, 'Jogo inválido.');
  const filter = game === 'all' ? null : game;
  const me = (await optionalSession(req))?.id ?? null;

  const entries = await Promise.all(
    Object.entries(PERIODS).map(async ([period, unit]) => {
      const rows = await sql`
        WITH agg AS (
          SELECT s.user_id, SUM(s.points)::int AS score, COUNT(*)::int AS solved, MAX(s.created_at) AS last_at
          FROM scores s
          WHERE (${filter}::text IS NULL OR s.game = ${filter}::text)
            AND s.created_at >= date_trunc(${unit}, now() AT TIME ZONE ${TZ}) AT TIME ZONE ${TZ}
          GROUP BY s.user_id
        ), ranked AS (
          SELECT agg.*, ROW_NUMBER() OVER (ORDER BY agg.score DESC, agg.last_at ASC, agg.user_id) AS position
          FROM agg
        )
        SELECT r.position::int AS position, u.username, r.score, r.solved, r.last_at AS date,
               (r.user_id = ${me}::uuid) IS TRUE AS is_me,
               EXISTS (SELECT 1 FROM subscriptions sb WHERE sb.user_id = r.user_id AND sb.status IN ('active', 'trialing')) AS premium
        FROM ranked r JOIN users u ON u.id = r.user_id
        WHERE r.position <= ${TOP} OR r.user_id = ${me}::uuid
        ORDER BY r.position`;
      return [
        period,
        rows.map((r) => ({ position: r.position, username: r.username, score: r.score, solved: r.solved, date: r.date, isMe: r.is_me, premium: r.premium })),
      ] as const;
    }),
  );
  return Object.fromEntries(entries);
});
