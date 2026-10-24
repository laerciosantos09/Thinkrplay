import { HttpError, sql } from './_lib/db.js';
import { APP_SETTINGS, isAppSettingEnabled, listGames } from './_lib/games.js';
import { GAME_SLUGS, requireAdmin, requireSession, route } from './_lib/http.js';
import { premiumState } from './_lib/premium.js';
import { energyState } from './_lib/energy.js';
import { ENERGY } from '../lib/energy.js';

// Migração que cria cada tabela opcional: se faltar, o recurso fica desligado e o administrador é avisado.
const MIGRATIONS: Record<string, string> = {
  game_settings: '003_game_settings.sql',
  app_settings: '005_app_settings.sql',
  subscriptions: '006_premium.sql',
  play_energy: '007_play_energy.sql',
};

// GET: qualquer usuário logado vê os jogos habilitados, se os anúncios estão ligados e a situação do Premium.
// POST: só administrador altera -> { game, enabled } (jogo) ou { setting: "ads" | "premium", enabled } (recurso do app).
export default route(['GET', 'POST'], async (req) => {
  let session;
  if (req.method === 'POST') {
    const admin = await requireAdmin(req);
    session = admin;
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
    session = await requireSession(req);
  }
  const premium = await premiumState(session);
  const present = (await sql`
    SELECT to_regclass('public.game_settings') IS NOT NULL AS game_settings, to_regclass('public.app_settings') IS NOT NULL AS app_settings,
           to_regclass('public.subscriptions') IS NOT NULL AS subscriptions, to_regclass('public.play_energy') IS NOT NULL AS play_energy`)[0];
  const missing = Object.keys(MIGRATIONS).filter((table) => !present[table]).map((table) => MIGRATIONS[table]);
  // Não oferece um plano que não dá para contratar: sem a tabela de assinaturas (006 pendente) o Premium fica indisponível.
  if (!present.subscriptions) premium.available = false;
  const energyEnabled = Boolean(present.play_energy) && (await isAppSettingEnabled('energy'));
  return {
    ...(session.role === 'admin' ? { setup: { missingMigrations: missing } } : {}),
    games: await listGames(),
    ads: { enabled: await isAppSettingEnabled('ads') },
    premium,
    // Limite de partidas: planos (para mostrar a vantagem do Premium) e, se ligado, o estoque deste usuário.
    energy: {
      enabled: energyEnabled,
      free: ENERGY.free,
      premium: ENERGY.premium,
      state: energyEnabled ? await energyState(session.id, premium.active) : null,
    },
  };
});
