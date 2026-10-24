import { HttpError, sql } from './_lib/db.js';
import { APP_SETTINGS, isAppSettingEnabled, listGames } from './_lib/games.js';
import { GAME_SLUGS, requireAdmin, requireSession, route } from './_lib/http.js';

// GET: qualquer usuário logado vê os jogos habilitados e se os anúncios estão ligados.
// POST: só administrador altera -> { game, enabled } (jogo) ou { setting: "ads", enabled } (recurso do app).
export default route(['GET', 'POST'], async (req) => {
  if (req.method === 'POST') {
    const admin = await requireAdmin(req);
    const { game, setting, enabled } = req.body ?? {};
    if (typeof enabled !== 'boolean') throw new HttpError(400, 'Valor inválido.');

    if (setting !== undefined) {
      if (typeof setting !== 'string' || !(APP_SETTINGS as readonly string[]).includes(setting)) {
        throw new HttpError(400, 'Configuração inválida.');
      }
      await sql`
        INSERT INTO app_settings (key, enabled, updated_by) VALUES (${setting}, ${enabled}, ${admin.id})
        ON CONFLICT (key) DO UPDATE SET enabled = EXCLUDED.enabled, updated_at = now(), updated_by = EXCLUDED.updated_by`;
    } else {
      if (typeof game !== 'string' || !GAME_SLUGS.includes(game)) throw new HttpError(400, 'Jogo inválido.');
      await sql`
        INSERT INTO game_settings (game, enabled, updated_by) VALUES (${game}, ${enabled}, ${admin.id})
        ON CONFLICT (game) DO UPDATE SET enabled = EXCLUDED.enabled, updated_at = now(), updated_by = EXCLUDED.updated_by`;
    }
  } else {
    await requireSession(req);
  }
  return { games: await listGames(), ads: { enabled: await isAppSettingEnabled('ads') } };
});
