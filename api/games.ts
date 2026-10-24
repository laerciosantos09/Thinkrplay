import { HttpError, sql } from './_lib/db.js';
import { listGames } from './_lib/games.js';
import { GAME_SLUGS, requireAdmin, requireSession, route } from './_lib/http.js';

// GET: qualquer usuário logado vê quais jogos estão habilitados. POST: só administrador altera.
export default route(['GET', 'POST'], async (req) => {
  if (req.method === 'POST') {
    const admin = await requireAdmin(req);
    const { game, enabled } = req.body ?? {};
    if (typeof game !== 'string' || !GAME_SLUGS.includes(game)) throw new HttpError(400, 'Jogo inválido.');
    if (typeof enabled !== 'boolean') throw new HttpError(400, 'Valor inválido.');
    await sql`
      INSERT INTO game_settings (game, enabled, updated_by) VALUES (${game}, ${enabled}, ${admin.id})
      ON CONFLICT (game) DO UPDATE SET enabled = EXCLUDED.enabled, updated_at = now(), updated_by = EXCLUDED.updated_by`;
  } else {
    await requireSession(req);
  }
  return { games: await listGames() };
});

