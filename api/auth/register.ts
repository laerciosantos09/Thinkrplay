import bcrypt from 'bcryptjs';
import { HttpError, sql } from '../_lib/db.js';
import { route, signToken, str } from '../_lib/http.js';

export default route(['POST'], async (req) => {
  const username = str(req.body?.username, 'Nome de usuário', 3, 24);
  const email = str(req.body?.email, 'E-mail', 5, 120).toLowerCase();
  const password = str(req.body?.password, 'Senha', 6, 100);
  const secretWord = str(req.body?.secretWord, 'Palavra secreta', 2, 100).toLowerCase();

  if (!/^[\p{L}\p{N}_.-]+$/u.test(username)) {
    throw new HttpError(400, 'Nome de usuário só pode ter letras, números, _ . e -');
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new HttpError(400, 'E-mail inválido.');

  const [passwordHash, secretHash] = await Promise.all([
    bcrypt.hash(password, 10),
    bcrypt.hash(secretWord, 10),
  ]);

  const rows = await sql`
    INSERT INTO users (username, email, password_hash, secret_hash)
    VALUES (${username}, ${email}, ${passwordHash}, ${secretHash})
    ON CONFLICT DO NOTHING
    RETURNING id, username, email`;
  if (rows.length === 0) throw new HttpError(409, 'Nome de usuário ou e-mail já cadastrado.');

  const user = rows[0];
  const token = await signToken({ id: user.id, username: user.username });
  return { token, user };
});
