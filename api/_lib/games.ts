import { HttpError, sql } from './db.js';
import { GAME_SLUGS } from './http.js';

export interface GameSetting {
  slug: string;
  enabled: boolean;
  updatedAt: string | null;
}

// Todos os jogos com seu estado; jogo sem linha na tabela está habilitado.
export const listGames = async (): Promise<GameSetting[]> => {
  const rows = await sql`SELECT game, enabled, updated_at FROM game_settings`;
  const byGame = new Map(rows.map((r) => [r.game as string, r]));
  return GAME_SLUGS.map((slug) => ({
    slug,
    enabled: byGame.get(slug)?.enabled ?? true,
    updatedAt: byGame.get(slug)?.updated_at ? new Date(byGame.get(slug)!.updated_at).toISOString() : null,
  }));
};

export const assertGameEnabled = async (game: string) => {
  const rows = await sql`SELECT enabled FROM game_settings WHERE game = ${game}`;
  if (rows[0] && rows[0].enabled === false) throw new HttpError(403, 'Este jogo está desativado no momento.');
};
