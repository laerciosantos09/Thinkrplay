import { sql } from './_lib/db.js';
import { requireSession, route } from './_lib/http.js';

export default route(['GET'], async (req) => {
  const session = await requireSession(req);
  const rows = await sql`SELECT game, unlocked_level FROM progress WHERE user_id = ${session.id}`;
  return Object.fromEntries(rows.map((r) => [r.game, r.unlocked_level]));
});
