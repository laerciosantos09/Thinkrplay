import { sql } from './_lib/db.js';
import { requireSession, route } from './_lib/http.js';

// { jogo: { easy: n, medium: n, hard: n } } com os desafios resolvidos pelo usuário.
export default route(['GET'], async (req) => {
  const session = await requireSession(req);
  const rows = await sql`SELECT game, tier, solved FROM tier_progress WHERE user_id = ${session.id}`;
  const out: Record<string, Record<string, number>> = {};
  for (const r of rows) (out[r.game] ??= {})[r.tier] = r.solved;
  return out;
});
