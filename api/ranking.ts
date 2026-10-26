import { HttpError, orIfMissing, sql } from './_lib/db.js';
import { GAME_SLUGS, requireSession, route } from './_lib/http.js';
import { PERIODS, PeriodName, TZ } from './_lib/ranking.js';

const TOP = 10;
const YEAR_SECONDS = 365 * 24 * 60 * 60;

type Row = { position: number; username: string; score: number; solved: number; date: string; isMe: boolean; premium: boolean };

// Períodos que já terminaram não mudam mais: ficam em memória (e no cache do navegador) por 1 ano.
// Chave = jogo + período + dia de início, então vale para qualquer usuário. O topo guardado não traz "isMe" nem selo.
const closedCache = new Map<string, { rows: Row[]; expires: number }>();
const CLOSED_CACHE_MAX = 2000;

// Posições a partir dos totais salvos (ranking_totals), por índice: top 10 + a posição do usuário (me) se ele estiver fora.
const fromTotals = (game: string, unit: string, start: string, me: string | null) => sql`
  WITH top AS (
    SELECT user_id, points, solved, last_at FROM ranking_totals
    WHERE game = ${game} AND period = ${unit} AND period_start = ${start}::date
    ORDER BY points DESC, last_at ASC, user_id LIMIT ${TOP}
  ), mine AS (
    SELECT user_id, points, solved, last_at FROM ranking_totals
    WHERE game = ${game} AND period = ${unit} AND period_start = ${start}::date AND user_id = ${me}::uuid
  )
  SELECT x.position, u.username, x.points AS score, x.solved, x.last_at AS date, x.user_id, (x.user_id = ${me}::uuid) IS TRUE AS is_me
  FROM (
    SELECT (row_number() OVER (ORDER BY points DESC, last_at ASC, user_id))::int AS position, user_id, points, solved, last_at FROM top
    UNION
    SELECT (1 + (SELECT count(*) FROM ranking_totals t
                 WHERE t.game = ${game} AND t.period = ${unit} AND t.period_start = ${start}::date
                   AND (t.points > m.points OR (t.points = m.points AND (t.last_at < m.last_at OR (t.last_at = m.last_at AND t.user_id < m.user_id))))))::int,
           m.user_id, m.points, m.solved, m.last_at
    FROM mine m
  ) x JOIN users u ON u.id = x.user_id
  ORDER BY x.position`;

// Plano B (migração 013 pendente): soma direto da tabela scores, só para o período em andamento.
const fromScores = (filter: string | null, unit: string, me: string | null) => sql`
  WITH agg AS (
    SELECT s.user_id, SUM(s.points)::int AS score, COUNT(*)::int AS solved, MAX(s.created_at) AS last_at
    FROM scores s
    WHERE (${filter}::text IS NULL OR s.game = ${filter}::text)
      AND s.created_at >= date_trunc(${unit}, now() AT TIME ZONE ${TZ}) AT TIME ZONE ${TZ}
    GROUP BY s.user_id
  ), ranked AS (
    SELECT agg.*, ROW_NUMBER() OVER (ORDER BY agg.score DESC, agg.last_at ASC, agg.user_id) AS position FROM agg
  )
  SELECT r.position::int AS position, u.username, r.score, r.solved, r.last_at AS date, r.user_id, (r.user_id = ${me}::uuid) IS TRUE AS is_me
  FROM ranked r JOIN users u ON u.id = r.user_id
  WHERE r.position <= ${TOP} OR r.user_id = ${me}::uuid
  ORDER BY r.position`;

// Primeiro dia (data local de São Paulo) do período atual, ou do que veio `back` períodos antes.
const periodStart = async (unit: string, back: number) =>
  String((await sql`SELECT (date_trunc(${unit}, now() AT TIME ZONE ${TZ}) - ${`${back} ${unit}s`}::interval)::date::text AS start`)[0].start);

// GET /api/ranking?game=<jogo|all>
//   -> os 4 períodos EM ANDAMENTO, sempre em dia: cada desafio concluído atualiza ranking_totals, e a leitura é por índice.
// GET /api/ranking?game=<jogo|all>&period=daily|weekly|monthly|yearly&back=N
//   -> o período N unidades atrás (1 = o anterior). Já encerrado, então não muda: cache de 1 ano.
// Só para quem está logado: o ranking mostra nomes de usuário e pontuações, que não devem ser públicos.
export default route(['GET'], async (req, res) => {
  const game = String(req.query.game ?? '');
  if (game !== 'all' && !GAME_SLUGS.includes(game)) throw new HttpError(400, 'Jogo inválido.');
  const me = (await requireSession(req)).id;

  // ---- período encerrado
  if (req.query.period !== undefined) {
    const name = String(req.query.period) as PeriodName;
    const back = Number(req.query.back);
    if (!(name in PERIODS)) throw new HttpError(400, 'Período inválido.');
    if (!Number.isInteger(back) || back < 1 || back > 400) throw new HttpError(400, 'Período inválido.');
    const unit = PERIODS[name];
    const start = await periodStart(unit, back);
    const key = `${game}|${unit}|${start}`;
    let hit = closedCache.get(key);
    if (!hit || hit.expires < Date.now()) {
      const rows = await orIfMissing(() => fromTotals(game, unit, start, null), [] as Record<string, any>[]);
      hit = {
        rows: rows.map((r) => ({ position: r.position, username: r.username, score: r.score, solved: r.solved, date: r.date, isMe: false, premium: false })),
        expires: Date.now() + YEAR_SECONDS * 1000,
      };
      if (closedCache.size >= CLOSED_CACHE_MAX) closedCache.delete(closedCache.keys().next().value!);
      closedCache.set(key, hit);
    }
    // "private": a resposta exige login e fica só no navegador de quem pediu.
    res.setHeader('Cache-Control', `private, max-age=${YEAR_SECONDS}, immutable`);
    return { period: name, start, closed: true, rows: hit.rows };
  }

  // ---- períodos em andamento
  const filter = game === 'all' ? null : game;
  const entries = await Promise.all(
    Object.entries(PERIODS).map(async ([period, unit]) => {
      const start = await periodStart(unit, 0);
      const rows = await orIfMissing(() => fromTotals(game, unit, start, me), null as Record<string, any>[] | null)
        ?? (await fromScores(filter, unit, me));
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
