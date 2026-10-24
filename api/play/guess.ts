import { HttpError, sql } from '../_lib/db.js';
import { requireSession, route } from '../_lib/http.js';
import { assertGameEnabled } from '../_lib/games.js';
import { abandonPlay, assertHumanPace, finishPlay, loadPlay } from '../_lib/play.js';
import { generateSequence } from '../../lib/sequence.js';
import { configFor, evaluate, generateCode } from '../../lib/mastermind.js';
import { mulberry32 } from '../../lib/rng.js';
import { SEQUENCE_ROUNDS, sequenceSeed } from '../../lib/rounds.js';
import { scoreMastermind, scoreSequence } from '../../lib/scoring.js';

// Jogos com segredo: cada palpite é checado no servidor, que guarda o estado da partida.
export default route(['POST'], async (req) => {
  const session = await requireSession(req);
  const { playId, value, guess } = req.body ?? {};
  const play = await loadPlay(session.id, playId);
  await assertGameEnabled(play.game);

  if (play.game === 'sequence') {
    const round: number = play.state.round ?? 0;
    const mistakes: number = play.state.mistakes ?? 0;
    const puzzle = generateSequence(mulberry32(sequenceSeed(play.seed, round)), play.tier, play.level);
    if (!puzzle.options.includes(value)) throw new HttpError(400, 'Resposta inválida.');

    if (value !== puzzle.answer) {
      await sql`UPDATE plays SET state = ${JSON.stringify({ round, mistakes: mistakes + 1 })}::jsonb WHERE id = ${play.id}`;
      return { correct: false, done: false };
    }
    if (round + 1 < SEQUENCE_ROUNDS) {
      await sql`UPDATE plays SET state = ${JSON.stringify({ round: round + 1, mistakes })}::jsonb WHERE id = ${play.id}`;
      return { correct: true, done: false };
    }
    assertHumanPace(play, SEQUENCE_ROUNDS);
    return { correct: true, done: true, ...(await finishPlay(play, scoreSequence(play.tier, play.level, mistakes))) };
  }

  if (play.game === 'mastermind') {
    const cfg = configFor(play.tier, play.level);
    if (!Array.isArray(guess) || guess.length !== cfg.length ||
        !guess.every((c) => Number.isInteger(c) && c >= 0 && c < cfg.colors)) {
      throw new HttpError(400, 'Combinação inválida.');
    }
    const code = generateCode(mulberry32(play.seed), play.tier, play.level);
    const { exact, partial } = evaluate(code, guess);
    const used: number = (play.state.guesses ?? 0) + 1;

    if (exact === cfg.length) {
      assertHumanPace(play, used);
      return { exact, partial, done: true, won: true, ...(await finishPlay(play, scoreMastermind(play.tier, play.level, used, cfg.attempts))) };
    }
    if (used >= cfg.attempts) {
      await abandonPlay(play);
      return { exact, partial, done: true, won: false, code };
    }
    await sql`UPDATE plays SET state = ${JSON.stringify({ guesses: used })}::jsonb WHERE id = ${play.id}`;
    return { exact, partial, done: false };
  }

  throw new HttpError(400, 'Este jogo é validado por prova ao final.');
});
