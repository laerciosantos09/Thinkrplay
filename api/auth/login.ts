import bcrypt from 'bcryptjs';
import { HttpError, sql } from '../_lib/db.js';
import { route, signToken, str } from '../_lib/http.js';

export default route(['POST'], async (req) => {
  const email = str(req.body?.email, 'E-mail', 3, 120).toLowerCase();
  const password = str(req.body?.password, 'Senha', 1, 100);

  const rows = await sql`
    SELECT id, username, email, password_hash FROM users WHERE lower(email) = ${email}`;
  const found = rows[0];
  const ok = found && (await bcrypt.compare(password, found.password_hash));
  if (!ok) throw new HttpError(401, 'E-mail ou senha incorretos.');

  const token = await signToken({ id: found.id, username: found.username });
  return { token, user: { id: found.id, username: found.username, email: found.email } };
});
