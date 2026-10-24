import { randomInt } from 'node:crypto';
import { HttpError, sql } from '../_lib/db.js';
import { GAME_SLUGS, MAX_LEVEL, requireSession, route } from '../_lib/http.js';
import { generateSequence } from '../../lib/sequence.js';
import { mulberry32 } from '../../lib/rng.js';
import { SEQUENCE_ROUNDS, sequenceSeed } from '../../lib/rounds.js';

const MAX_STARTS_PER_HOUR = 200;

export default route(['POST'], async (req) => {
  const session = await requireSession(req);
  const { game, level } = req.body ?? {};
  if (typeof game !== 'string' || !GAME_SLUGS.includes(game)) throw new HttpError(400, 'Jogo inválido.');
  if (!Number.isInteger(level) || level < 1 || level > MAX_LEVEL) throw new HttpError(400, 'Nível inválido.');

  const [prog, recent] = await Promise.all([
    sql`SELECT unlocked_level FROM progress WHERE user_id = ${session.id} AND game = ${game}`,
    sql`SELECT count(*)::int AS n FROM plays WHERE user_id = ${session.id} AND started_at > now() - interval '1 hour'`,
  ]);
  if (level > (prog[0]?.unlocked_level ?? 1)) throw new HttpError(403, 'Nível ainda bloqueado.');
  if (recent[0].n >= MAX_STARTS_PER_HOUR) throw new HttpError(429, 'Muitas partidas em pouco tempo. Faça uma pausa.');

  const seed = randomInt(1, 2 ** 31 - 1);
  const rows = await sql`
    INSERT INTO plays (user_id, game, level, seed) VALUES (${session.id}, ${game}, ${level}, ${seed})
    RETURNING id`;
  const playId = rows[0].id as string;

  // Jogos com segredo (sequence, mastermind) nunca expõem a semente ao cliente.
  if (game === 'sequence') {
    const puzzles = Array.from({ length: SEQUENCE_ROUNDS }, (_, i) => {
      const p = generateSequence(mulberry32(sequenceSeed(seed, i)), level);
      return { shown: p.shown, options: p.options, hint: p.hint };
    });
    return { playId, level, puzzles };
  }
  if (game === 'mastermind') return { playId, level };
  return { playId, level, seed };
});
