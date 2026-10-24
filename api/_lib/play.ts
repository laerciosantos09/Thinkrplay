import { HttpError, sql } from './db.js';
import { MIN_SECONDS_PER_ACTION } from '../../lib/scoring.js';
import { Tier, TierProgress, emptyProgress } from '../../lib/tiers.js';

export interface Play {
  id: string;
  user_id: string;
  game: string;
  tier: Tier;
  level: number; // número do desafio (1..500) dentro do tier
  seed: number;
  state: Record<string, any>;
  seconds: number;
}

const EXPIRES_SECONDS = 3 * 60 * 60;

export const loadProgress = async (userId: string, game: string): Promise<TierProgress> => {
  const rows = await sql`SELECT tier, solved FROM tier_progress WHERE user_id = ${userId} AND game = ${game}`;
  const progress = emptyProgress();
  for (const r of rows) progress[r.tier as Tier] = r.solved;
  return progress;
};

export const loadPlay = async (userId: string, playId: unknown, game?: string): Promise<Play> => {
  if (typeof playId !== 'string' || !/^[0-9a-f-]{36}$/i.test(playId)) throw new HttpError(400, 'Partida inválida.');
  const rows = await sql`
    SELECT id, user_id, game, tier, level, seed, state, finished_at,
           extract(epoch FROM (now() - started_at))::float AS seconds
    FROM plays WHERE id = ${playId} AND user_id = ${userId}`;
  const play = rows[0];
  if (!play) throw new HttpError(404, 'Partida não encontrada.');
  if (play.finished_at) throw new HttpError(409, 'Esta partida já foi encerrada.');
  if (game && play.game !== game) throw new HttpError(400, 'Partida inválida.');
  if (play.seconds > EXPIRES_SECONDS) throw new HttpError(410, 'Partida expirada. Comece uma nova.');
  return play as Play;
};

// Recusa partidas rápidas demais para um humano.
export const assertHumanPace = (play: Play, actions: number) => {
  const min = actions * (MIN_SECONDS_PER_ACTION[play.game] ?? 1);
  if (play.seconds < min) throw new HttpError(422, 'Partida rápida demais para ser válida e não foi pontuada.');
};

export interface FinishResult {
  points: number; // pontos efetivamente ganhos (0 em repetição)
  awarded: boolean; // false = desafio já resolvido antes (prática, sem pontos)
  progress: TierProgress;
}

// Encerra a partida em UM comando atômico: só quem "reivindicar" a partida primeiro conta, e só o PRIMEIRO acerto
// de cada desafio avança o progresso e gera pontos (repetições não pontuam, impedindo farm do mesmo desafio).
export const finishPlay = async (play: Play, points: number): Promise<FinishResult> => {
  const rows = await sql`
    WITH claimed AS (
      UPDATE plays SET finished_at = now(), points = ${points}::int
      WHERE id = ${play.id} AND finished_at IS NULL
      RETURNING user_id, game, tier, level
    ), first AS (
      INSERT INTO tier_progress (user_id, game, tier, solved)
      SELECT user_id, game, tier, 1 FROM claimed WHERE level = 1
      ON CONFLICT (user_id, game, tier) DO NOTHING
      RETURNING user_id, game, tier
    ), next AS (
      UPDATE tier_progress tp SET solved = c.level, updated_at = now()
      FROM claimed c
      WHERE tp.user_id = c.user_id AND tp.game = c.game AND tp.tier = c.tier
        AND c.level > 1 AND tp.solved = c.level - 1
      RETURNING tp.user_id, tp.game, tp.tier
    ), advanced AS (
      SELECT * FROM first UNION ALL SELECT * FROM next
    ), s AS (
      INSERT INTO scores (user_id, game, tier, points, level)
      SELECT c.user_id, c.game, c.tier, ${points}::int, c.level
      FROM claimed c JOIN advanced a ON a.user_id = c.user_id AND a.game = c.game AND a.tier = c.tier
      RETURNING 1
    )
    SELECT (SELECT count(*) FROM claimed)::int AS claimed, (SELECT count(*) FROM advanced)::int AS advanced`;
  if (rows[0].claimed !== 1) throw new HttpError(409, 'Esta partida já foi encerrada.');
  const awarded = rows[0].advanced === 1;
  return { points: awarded ? points : 0, awarded, progress: await loadProgress(play.user_id, play.game) };
};

export const abandonPlay = (play: Play) =>
  sql`UPDATE plays SET finished_at = now(), points = 0 WHERE id = ${play.id} AND finished_at IS NULL`;
