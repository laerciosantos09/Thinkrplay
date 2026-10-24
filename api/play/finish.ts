import { HttpError } from '../_lib/db.js';
import { requireSession, route } from '../_lib/http.js';
import { assertHumanPace, finishPlay, loadPlay } from '../_lib/play.js';
import { VERIFIERS } from '../../lib/verify.js';
import { pairsForLevel } from '../../lib/memory.js';
import { disksForLevel } from '../../lib/hanoi.js';
import { scoreHanoi, scoreLights, scoreMemory, scoreSudoku } from '../../lib/scoring.js';

// Jogos verificáveis por prova: o servidor refaz a partida a partir da semente.
export default route(['POST'], async (req) => {
  const session = await requireSession(req);
  const { playId, proof } = req.body ?? {};
  const play = await loadPlay(session.id, playId);
  const verify = VERIFIERS[play.game as keyof typeof VERIFIERS];
  if (!verify) throw new HttpError(400, 'Este jogo é validado jogada a jogada.');

  const result = verify(play.seed, play.level, proof);
  if (!result.ok) throw new HttpError(422, result.reason ?? 'Partida inválida.');
  assertHumanPace(play, result.actions);

  const { level } = play;
  const points =
    play.game === 'sudoku' ? scoreSudoku(level, play.seconds)
    : play.game === 'memory' ? scoreMemory(level, result.actions, pairsForLevel(level))
    : play.game === 'hanoi' ? scoreHanoi(level, disksForLevel(level), result.actions, result.par!)
    : scoreLights(level, result.actions, result.par!);

  return finishPlay(play, points);
});
