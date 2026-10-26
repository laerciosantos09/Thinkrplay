import bcrypt from 'bcryptjs';
import { HttpError, sql } from '../_lib/db.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { clientIp, newPassword, route, startSession, str } from '../_lib/http.js';
import { consumeVerification, sendVerification, verificationAvailable } from '../_lib/verification.js';
import { throttle } from '../_lib/limit.js';
import { publicUser } from '../_lib/user.js';
import { PRIVACY_VERSION, TERMS_VERSION, RESERVED_USERNAMES, USERNAME_PATTERN } from '../../lib/legal.js';

const register = route(['POST'], async (req, res) => {
  const username = str(req.body?.username, 'Nome de usuário', 3, 24);
  const email = str(req.body?.email, 'E-mail', 5, 120).toLowerCase();
  const password = newPassword(req.body?.password, 'Senha');
  const secretWord = str(req.body?.secretWord, 'Palavra secreta', 8, 100).toLowerCase();

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

  // Confirmação de e-mail ligada (e configurada): a conta nasce barrada até o link do e-mail ser aberto.
  const mustVerify = await verificationAvailable();
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

  let user = rows[0];
  let emailSent = false;
  if (mustVerify) {
    await sql`UPDATE users SET verification_required = true WHERE id = ${user.id}`;
    user = { ...user, verification_required: true };
    try {
      await sendVerification(req, user as { id: string; email: string });
      emailSent = true;
    } catch (err) {
      console.error('Falha ao enviar a confirmação de e-mail:', err instanceof Error ? err.message : err); // a pessoa pode pedir o reenvio
    }
  }
  await startSession(req, res, { id: user.id, version: user.token_version });
  return { user: publicUser(user), emailSent };
});

// GET /api/auth/register?action=verify&token=... : link do e-mail de confirmação (volta para o app com um aviso).
const verifyLink = async (req: VercelRequest, res: VercelResponse) => {
  let ok = false;
  try {
    ok = await consumeVerification(String(req.query.token ?? ''));
  } catch (err) {
    console.error('Confirmação de e-mail falhou:', err);
  }
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Referrer-Policy', 'no-referrer'); // o token está na URL: não vaza em cabeçalhos
  res.status(302);
  res.setHeader('Location', ok ? '/?auth_notice=email_verified' : '/?auth_error=verify_failed');
  res.end();
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET' && req.query?.action === 'verify') return verifyLink(req, res);
  return register(req, res);
}
