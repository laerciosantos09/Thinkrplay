import { HttpError } from '../_lib/db.js';
import { requireSession, route } from '../_lib/http.js';
import { assertHumanPace, finishPlay, loadPlay } from '../_lib/play.js';
import { VERIFIERS } from '../../lib/verify.js';
import { pairsFor } from '../../lib/memory.js';
import { generateHanoi } from '../../lib/hanoi.js';
import { mulberry32 } from '../../lib/rng.js';
import { scoreHanoi, scoreLights, scoreMemory, scoreSudoku } from '../../lib/scoring.js';

// Jogos verificáveis por prova: o servidor refaz a partida a partir da semente.
export default route(['POST'], async (req) => {
  const session = await requireSession(req);
  const { playId, proof } = req.body ?? {};
  const play = await loadPlay(session.id, playId);
  const verify = VERIFIERS[play.game as keyof typeof VERIFIERS];
  if (!verify) throw new HttpError(400, 'Este jogo é validado jogada a jogada.');

  const { tier, level } = play;
  const result = verify(play.seed, tier, level, proof);
  if (!result.ok) throw new HttpError(422, result.reason ?? 'Partida inválida.');
  assertHumanPace(play, result.actions);

  const points =
    play.game === 'sudoku' ? scoreSudoku(tier, level, play.seconds)
    : play.game === 'memory' ? scoreMemory(tier, level, result.actions, pairsFor(tier, level))
    : play.game === 'hanoi' ? scoreHanoi(tier, level, generateHanoi(mulberry32(play.seed), tier, level).disks, result.actions, result.par!)
    : scoreLights(tier, level, result.actions, result.par!);

  return finishPlay(play, points);
});
