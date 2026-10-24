import { HttpError, sql } from './db.js';
import { MIN_SECONDS_PER_ACTION } from '../../lib/scoring.js';

export interface Play {
  id: string;
  user_id: string;
  game: string;
  level: number;
  seed: number;
  state: Record<string, any>;
  seconds: number;
}

const EXPIRES_SECONDS = 3 * 60 * 60;

export const loadPlay = async (userId: string, playId: unknown, game?: string): Promise<Play> => {
  if (typeof playId !== 'string' || !/^[0-9a-f-]{36}$/i.test(playId)) throw new HttpError(400, 'Partida inválida.');
  const rows = await sql`
    SELECT id, user_id, game, level, seed, state, finished_at,
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

// Encerra a partida, grava a pontuação e libera o próximo nível em um único comando atômico.
// Só quem "reivindicar" a partida primeiro leva os pontos (impede reenvio/corrida).
export const finishPlay = async (play: Play, points: number) => {
  const rows = await sql`
    WITH claimed AS (
      UPDATE plays SET finished_at = now(), points = ${points}::int
      WHERE id = ${play.id} AND finished_at IS NULL
      RETURNING user_id, game, level
    ), s AS (
      INSERT INTO scores (user_id, game, points, level)
      SELECT user_id, game, ${points}::int, level FROM claimed RETURNING 1
    ), p AS (
      INSERT INTO progress (user_id, game, unlocked_level)
      SELECT user_id, game, LEAST(1000, level + 1) FROM claimed
      ON CONFLICT (user_id, game) DO UPDATE
        SET unlocked_level = GREATEST(progress.unlocked_level, EXCLUDED.unlocked_level), updated_at = now()
      RETURNING unlocked_level
    )
    SELECT (SELECT count(*) FROM claimed)::int AS claimed, (SELECT unlocked_level FROM p) AS unlocked`;
  if (rows[0].claimed !== 1) throw new HttpError(409, 'Esta partida já foi encerrada.');
  return { points, unlocked: rows[0].unlocked as number };
};

export const abandonPlay = (play: Play) =>
  sql`UPDATE plays SET finished_at = now(), points = 0 WHERE id = ${play.id} AND finished_at IS NULL`;
