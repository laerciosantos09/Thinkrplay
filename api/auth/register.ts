import bcrypt from 'bcryptjs';
import { HttpError, sql } from '../_lib/db.js';
import { route, startSession, str } from '../_lib/http.js';

export default route(['POST'], async (req, res) => {
  const username = str(req.body?.username, 'Nome de usuário', 3, 24);
  const email = str(req.body?.email, 'E-mail', 5, 120).toLowerCase();
  const password = str(req.body?.password, 'Senha', 8, 100);
  const secretWord = str(req.body?.secretWord, 'Palavra secreta', 4, 100).toLowerCase();

  if (!/^[\p{L}\p{N}_.-]+$/u.test(username)) {
    throw new HttpError(400, 'Nome de usuário só pode ter letras, números, _ . e -');
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new HttpError(400, 'E-mail inválido.');

  const [passwordHash, secretHash] = await Promise.all([
    bcrypt.hash(password, 11),
    bcrypt.hash(secretWord, 11),
  ]);

  const rows = await sql`
    INSERT INTO users (username, email, password_hash, secret_hash)
    VALUES (${username}, ${email}, ${passwordHash}, ${secretHash})
    ON CONFLICT DO NOTHING
    RETURNING id, username, email`;
  if (rows.length === 0) throw new HttpError(409, 'Nome de usuário ou e-mail já cadastrado.');

  await startSession(req, res, { id: rows[0].id, username: rows[0].username });
  return { user: rows[0] };
});
