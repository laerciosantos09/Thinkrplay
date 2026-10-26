import { HttpError, orIfMissing, sql } from './_lib/db.js';
import { GAME_SLUGS, requireSession, route } from './_lib/http.js';

const PERIODS = { daily: 'day', weekly: 'week', monthly: 'month', yearly: 'year' } as const;
const TZ = 'America/Sao_Paulo';
const TOP = 10;

// GET /api/ranking?game=<jogo> -> ranking do jogo; ?game=all -> ranking geral (soma de todos os jogos).
// Calculado na hora a partir das pontuações, então cada desafio concluído já aparece na próxima consulta.
// A posição do usuário logado vem junto (marcada com isMe) mesmo fora do top 10.
export default route(['GET'], async (req) => {
  const game = String(req.query.game ?? '');
  if (game !== 'all' && !GAME_SLUGS.includes(game)) throw new HttpError(400, 'Jogo inválido.');
  const filter = game === 'all' ? null : game;
  // Só para quem está logado e aceitou os termos: o ranking mostra nomes de usuário e pontuações, que não devem ser públicos.
  const me = (await requireSession(req)).id;

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
               r.user_id, (r.user_id = ${me}::uuid) IS TRUE AS is_me
        FROM ranked r JOIN users u ON u.id = r.user_id
        WHERE r.position <= ${TOP} OR r.user_id = ${me}::uuid
        ORDER BY r.position`;
      return [period, rows] as const;
    }),
  );

  // Selo Premium: consulta à parte, assim a falta da tabela de assinaturas (migração 006 pendente) não derruba o ranking.
  const ids = [...new Set(entries.flatMap(([, rows]) => rows.map((r) => r.user_id as string)))];
  const premiumRows = ids.length
    ? await orIfMissing(() => sql`SELECT user_id FROM subscriptions WHERE user_id = ANY(${ids}::uuid[]) AND status IN ('active', 'trialing')`, [] as Record<string, any>[])
    : [];
  const premium = new Set(premiumRows.map((r) => r.user_id as string));

  return Object.fromEntries(
    entries.map(([period, rows]) => [
      period,
      rows.map((r) => ({ position: r.position, username: r.username, score: r.score, solved: r.solved, date: r.date, isMe: r.is_me, premium: premium.has(r.user_id) })),
    ]),
  );
});
