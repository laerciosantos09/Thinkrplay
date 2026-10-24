import bcrypt from 'bcryptjs';
import { HttpError, sql } from '../_lib/db.js';
import { route, startSession, str } from '../_lib/http.js';
import { publicUser } from '../_lib/user.js';
import { LEGAL_VERSION, RESERVED_USERNAMES, USERNAME_PATTERN } from '../../lib/legal.js';

export default route(['POST'], async (req, res) => {
  const username = str(req.body?.username, 'Nome de usuário', 3, 24);
  const email = str(req.body?.email, 'E-mail', 5, 120).toLowerCase();
  const password = str(req.body?.password, 'Senha', 8, 100);
  const secretWord = str(req.body?.secretWord, 'Palavra secreta', 4, 100).toLowerCase();

  if (req.body?.acceptTerms !== true) {
    throw new HttpError(400, 'É necessário aceitar os Termos de Uso e a Política de Privacidade.');
  }
  if (!USERNAME_PATTERN.test(username)) {
    throw new HttpError(400, 'Nome de usuário só pode ter letras, números, _ . e -');
  }
  if (RESERVED_USERNAMES.includes(username.toLowerCase())) throw new HttpError(400, 'Este nome de usuário não está disponível.');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new HttpError(400, 'E-mail inválido.');

  const [passwordHash, secretHash] = await Promise.all([
    bcrypt.hash(password, 11),
    bcrypt.hash(secretWord, 11),
  ]);

  const rows = await sql`
    INSERT INTO users (username, email, password_hash, secret_hash, terms_version, terms_accepted_at)
    VALUES (${username}, ${email}, ${passwordHash}, ${secretHash}, ${LEGAL_VERSION}, now())
    ON CONFLICT DO NOTHING
    RETURNING id, username, email, role, created_at, terms_version, token_version`;
  if (rows.length === 0) throw new HttpError(409, 'Nome de usuário ou e-mail já cadastrado.');

  await startSession(req, res, { id: rows[0].id, version: rows[0].token_version });
  return { user: publicUser(rows[0]) };
});
