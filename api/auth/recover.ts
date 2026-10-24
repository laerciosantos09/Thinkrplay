import bcrypt from 'bcryptjs';
import { HttpError, sql } from '../_lib/db.js';
import { clientIp, route, str } from '../_lib/http.js';
import { assertNotLocked, recordFailure } from '../_lib/limit.js';

const DUMMY = '$2b$11$Da2tv3js2BCDJcW3u1R72uq/.bufOtL3XYtKadhDaJkTtN7KM5GPu';

export default route(['POST'], async (req) => {
  const email = str(req.body?.email, 'E-mail', 3, 120).toLowerCase();
  const secretWord = str(req.body?.secretWord, 'Palavra secreta', 2, 100).toLowerCase();
  const newPassword = str(req.body?.newPassword, 'Nova senha', 8, 100);
  const ip = clientIp(req);
  await assertNotLocked(email, ip);

  const rows = await sql`SELECT id, secret_hash FROM users WHERE lower(email) = ${email}`;
  const found = rows[0];
  const ok = await bcrypt.compare(secretWord, found?.secret_hash ?? DUMMY);
  if (!found || !ok) {
    await recordFailure(email, ip);
    throw new HttpError(401, 'E-mail ou palavra secreta incorretos.');
  }

  const passwordHash = await bcrypt.hash(newPassword, 11);
  // token_version + 1 encerra todas as sessões abertas (quem redefine a senha pode ter perdido o acesso).
  await sql`UPDATE users SET password_hash = ${passwordHash}, token_version = token_version + 1 WHERE id = ${found.id}`;
  return { ok: true };
});
