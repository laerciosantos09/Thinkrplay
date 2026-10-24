import { HttpError, sql } from '../_lib/db.js';
import { requireSession, route } from '../_lib/http.js';

export default route(['GET'], async (req) => {
  const session = await requireSession(req);
  const rows = await sql`SELECT id, username, email FROM users WHERE id = ${session.id}`;
  if (!rows[0]) throw new HttpError(401, 'Sessão expirada. Entre novamente.');
  return { user: rows[0] };
});
