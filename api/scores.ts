import { HttpError, sql } from './_lib/db.js';
import { GAME_LIMITS, MAX_LEVEL, requireSession, route } from './_lib/http.js';

export default route(['POST'], async (req) => {
  const session = await requireSession(req);
  const { game, level, points } = req.body ?? {};

  if (typeof game !== 'string' || !(game in GAME_LIMITS)) throw new HttpError(400, 'Jogo inválido.');
  if (!Number.isInteger(level) || level < 1 || level > MAX_LEVEL) throw new HttpError(400, 'Nível inválido.');
  if (!Number.isInteger(points) || points < 0 || points > GAME_LIMITS[game]) {
    throw new HttpError(400, 'Pontuação inválida.');
  }

  const current = await sql`
    SELECT unlocked_level FROM progress WHERE user_id = ${session.id} AND game = ${game}`;
  const unlocked: number = current[0]?.unlocked_level ?? 1;
  if (level > unlocked) throw new HttpError(403, 'Nível ainda bloqueado.');

  const next = Math.min(MAX_LEVEL, Math.max(unlocked, level + 1));
  await sql`INSERT INTO scores (user_id, game, points, level) VALUES (${session.id}, ${game}, ${points}, ${level})`;
  await sql`
    INSERT INTO progress (user_id, game, unlocked_level) VALUES (${session.id}, ${game}, ${next})
    ON CONFLICT (user_id, game) DO UPDATE SET unlocked_level = GREATEST(progress.unlocked_level, ${next}), updated_at = now()`;

  return { unlocked: next };
});
