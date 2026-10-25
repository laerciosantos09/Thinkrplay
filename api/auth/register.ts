import bcrypt from 'bcryptjs';
import { HttpError, sql } from '../_lib/db.js';
import { clientIp, newPassword, route, startSession, str } from '../_lib/http.js';
import { throttle } from '../_lib/limit.js';
import { publicUser } from '../_lib/user.js';
import { PRIVACY_VERSION, TERMS_VERSION, RESERVED_USERNAMES, USERNAME_PATTERN } from '../../lib/legal.js';

export default route(['POST'], async (req, res) => {
  const username = str(req.body?.username, 'Nome de usuário', 3, 24);
  const email = str(req.body?.email, 'E-mail', 5, 120).toLowerCase();
  const password = newPassword(req.body?.password, 'Senha');
  const secretWord = str(req.body?.secretWord, 'Palavra secreta', 4, 100).toLowerCase();

  if (req.body?.acceptTerms !== true) throw new HttpError(400, 'É necessário aceitar os Termos de Uso.');
  if (req.body?.acceptPrivacy !== true) throw new HttpError(400, 'É necessário aceitar a Política de Privacidade.');
  if (!USERNAME_PATTERN.test(username)) {
    throw new HttpError(400, 'Nome de usuário só pode ter letras, números, _ . e -');
  }
  if (RESERVED_USERNAMES.includes(username.toLowerCase())) throw new HttpError(400, 'Este nome de usuário não está disponível.');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new HttpError(400, 'E-mail inválido.');

  await throttle('register', clientIp(req), 20); // cada cadastro faz 2 hashes bcrypt: sem limite viraria spam e consumo de CPU

  const [passwordHash, secretHash] = await Promise.all([
    bcrypt.hash(password, 11),
    bcrypt.hash(secretWord, 11),
  ]);

  // Sem a coluna de privacidade (migração 010 pendente) o aceite único continua valendo para os dois documentos.
  const hasPrivacy = Boolean((await sql`SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'privacy_version'`)[0]);
  const rows = hasPrivacy
    ? await sql`
        INSERT INTO users (username, email, password_hash, secret_hash, terms_version, terms_accepted_at, privacy_version, privacy_accepted_at)
        VALUES (${username}, ${email}, ${passwordHash}, ${secretHash}, ${TERMS_VERSION}, now(), ${PRIVACY_VERSION}, now())
        ON CONFLICT DO NOTHING
        RETURNING *`
    : await sql`
        INSERT INTO users (username, email, password_hash, secret_hash, terms_version, terms_accepted_at)
        VALUES (${username}, ${email}, ${passwordHash}, ${secretHash}, ${TERMS_VERSION}, now())
        ON CONFLICT DO NOTHING
        RETURNING *`;
  if (rows.length === 0) throw new HttpError(409, 'Nome de usuário ou e-mail já cadastrado.');

  await startSession(req, res, { id: rows[0].id, version: rows[0].token_version });
  return { user: publicUser(rows[0]) };
});
