import bcrypt from 'bcryptjs';
import { HttpError, sql } from '../_lib/db.js';
import { route, str } from '../_lib/http.js';

export default route(['POST'], async (req) => {
  const email = str(req.body?.email, 'E-mail', 3, 120).toLowerCase();
  const secretWord = str(req.body?.secretWord, 'Palavra secreta', 2, 100).toLowerCase();
  const newPassword = str(req.body?.newPassword, 'Nova senha', 6, 100);

  const rows = await sql`SELECT id, secret_hash FROM users WHERE lower(email) = ${email}`;
  const found = rows[0];
  const ok = found && (await bcrypt.compare(secretWord, found.secret_hash));
  if (!ok) throw new HttpError(401, 'E-mail ou palavra secreta incorretos.');

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await sql`UPDATE users SET password_hash = ${passwordHash} WHERE id = ${found.id}`;
  return { ok: true };
});
