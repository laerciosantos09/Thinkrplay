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

  // O estado da partida (rodada, erros, palpites) só muda por UPDATE atômico no banco. Ler, somar e gravar no código
  // deixaria requisições paralelas enxergarem o mesmo contador e testar vários palpites/respostas sem gastar tentativas.
  if (play.game === 'sequence') {
    const round: number = play.state.round ?? 0;
    const puzzle = generateSequence(mulberry32(sequenceSeed(play.seed, round)), play.tier, play.level);
    if (!puzzle.options.includes(value)) throw new HttpError(400, 'Resposta inválida.');

    if (value !== puzzle.answer) {
      await sql`
        UPDATE plays SET state = jsonb_set(state, '{mistakes}', to_jsonb(coalesce((state->>'mistakes')::int, 0) + 1))
        WHERE id = ${play.id} AND finished_at IS NULL`;
      return { correct: false, done: false };
    }
    if (round + 1 < SEQUENCE_ROUNDS) {
      // só avança se a partida ainda está nesta rodada (resposta repetida/atrasada não pula rodadas)
      const moved = await sql`
        UPDATE plays SET state = jsonb_set(state, '{round}', to_jsonb(${round + 1}::int))
        WHERE id = ${play.id} AND finished_at IS NULL AND coalesce((state->>'round')::int, 0) = ${round}
        RETURNING id`;
      if (moved.length === 0) throw new HttpError(409, 'Esta rodada já foi respondida.');
      return { correct: true, done: false };
    }
    assertHumanPace(play, SEQUENCE_ROUNDS);
    const mistakes: number = (await sql`SELECT coalesce((state->>'mistakes')::int, 0) AS m FROM plays WHERE id = ${play.id}`)[0]?.m ?? 0;
    return { correct: true, done: true, ...(await finishPlay(play, scoreSequence(play.tier, play.level, mistakes))) };
  }

  if (play.game === 'mastermind') {
    const cfg = configFor(play.tier, play.level);
    if (!Array.isArray(guess) || guess.length !== cfg.length ||
        !guess.every((c) => Number.isInteger(c) && c >= 0 && c < cfg.colors)) {
      throw new HttpError(400, 'Combinação inválida.');
    }
    // Reserva o palpite ANTES de avaliar: o contador sobe de forma atômica e passou do limite não recebe nenhuma dica.
    const claimed = await sql`
      UPDATE plays SET state = jsonb_build_object('guesses', coalesce((state->>'guesses')::int, 0) + 1)
      WHERE id = ${play.id} AND finished_at IS NULL AND coalesce((state->>'guesses')::int, 0) < ${cfg.attempts}
      RETURNING (state->>'guesses')::int AS used`;
    if (claimed.length === 0) throw new HttpError(409, 'Esta partida já usou todas as tentativas.');
    const used: number = claimed[0].used;
    const code = generateCode(mulberry32(play.seed), play.tier, play.level);
    const { exact, partial } = evaluate(code, guess);

    if (exact === cfg.length) {
      assertHumanPace(play, used);
      return { exact, partial, done: true, won: true, ...(await finishPlay(play, scoreMastermind(play.tier, play.level, used, cfg.attempts))) };
    }
    if (used >= cfg.attempts) {
      await abandonPlay(play);
      return { exact, partial, done: true, won: false, code };
    }
    return { exact, partial, done: false };
  }

  throw new HttpError(400, 'Este jogo é validado por prova ao final.');
});
