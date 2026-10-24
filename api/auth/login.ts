import bcrypt from 'bcryptjs';
import { HttpError, sql } from '../_lib/db.js';
import { clientIp, route, startSession, str } from '../_lib/http.js';
import { assertNotLocked, recordFailure } from '../_lib/limit.js';

// Hash fictício para gastar o mesmo tempo quando o e-mail não existe.
const DUMMY = '$2b$11$Da2tv3js2BCDJcW3u1R72uq/.bufOtL3XYtKadhDaJkTtN7KM5GPu';

export default route(['POST'], async (req, res) => {
  const email = str(req.body?.email, 'E-mail', 3, 120).toLowerCase();
  const password = str(req.body?.password, 'Senha', 1, 100);
  const ip = clientIp(req);
  await assertNotLocked(email, ip);

  const rows = await sql`SELECT id, username, email, password_hash FROM users WHERE lower(email) = ${email}`;
  const found = rows[0];
  const ok = await bcrypt.compare(password, found?.password_hash ?? DUMMY);
  if (!found || !ok) {
    await recordFailure(email, ip);
    throw new HttpError(401, 'E-mail ou senha incorretos.');
  }

  await startSession(req, res, { id: found.id, username: found.username });
  return { user: { id: found.id, username: found.username, email: found.email } };
});
