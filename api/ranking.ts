import { HttpError, sql } from './_lib/db.js';
import { GAME_LIMITS, route } from './_lib/http.js';

const PERIODS = { daily: 'day', weekly: 'week', monthly: 'month', yearly: 'year' } as const;
const TZ = 'America/Sao_Paulo';

export default route(['GET'], async (req) => {
  const game = String(req.query.game ?? '');
  if (!(game in GAME_LIMITS)) throw new HttpError(400, 'Jogo inválido.');

  const entries = await Promise.all(
    Object.entries(PERIODS).map(async ([period, unit]) => {
      const rows = await sql`
        SELECT u.username, SUM(s.points)::int AS score, MAX(s.level)::int AS level,
               MAX(s.created_at) AS date
        FROM scores s JOIN users u ON u.id = s.user_id
        WHERE s.game = ${game}
          AND s.created_at >= date_trunc(${unit}, now() AT TIME ZONE ${TZ}) AT TIME ZONE ${TZ}
        GROUP BY u.id, u.username
        ORDER BY score DESC, date ASC
        LIMIT 10`;
      return [period, rows] as const;
    }),
  );
  return Object.fromEntries(entries);
});
