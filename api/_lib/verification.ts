import { createHash, randomBytes } from 'node:crypto';
import type { VercelRequest } from '@vercel/node';
import { orIfMissing, sql } from './db.js';
import { isAppSettingEnabled } from './games.js';
import { appBaseUrl } from './http.js';
import { mailConfigured, sendMail } from './mailer.js';
const APP_NAME = 'Thinkrplay';

const TOKEN_TTL_HOURS = 24;
const hash = (token: string) => createHash('sha256').update(token).digest('hex');

// Colunas/tabelas da migração 011 existem?
export const verificationSchemaReady = async () =>
  Boolean((await sql`
    SELECT to_regclass('public.email_tokens') IS NOT NULL
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'verification_required') AS ok`)[0]?.ok);

// Liga só com: interruptor do admin + provedor de e-mail configurado + migração 011.
export const verificationAvailable = async () =>
  mailConfigured() && (await isAppSettingEnabled('email_verification')) && (await verificationSchemaReady());

// Cria um link de confirmação (uso único, 24h) e envia por e-mail. O token em texto só existe no e-mail: o banco guarda o hash.
export const sendVerification = async (req: VercelRequest, user: { id: string; email: string }) => {
  const token = randomBytes(32).toString('base64url');
  await sql`UPDATE email_tokens SET used_at = now() WHERE user_id = ${user.id} AND used_at IS NULL`; // só o link mais novo vale
  await sql`INSERT INTO email_tokens (user_id, token_hash, expires_at) VALUES (${user.id}, ${hash(token)}, now() + ${`${TOKEN_TTL_HOURS} hours`}::interval)`;
  const link = `${appBaseUrl(req)}/api/auth/register?action=verify&token=${token}`;
  await sendMail({
    to: user.email,
    subject: `Confirme seu e-mail no ${APP_NAME}`,
    text: `Olá! Para ativar sua conta no ${APP_NAME}, confirme seu e-mail neste link (vale por ${TOKEN_TTL_HOURS} horas):\n\n${link}\n\nSe não foi você, ignore esta mensagem.`,
    html: `<p>Olá! Para ativar sua conta no <strong>${APP_NAME}</strong>, confirme seu e-mail:</p><p><a href="${link}">Confirmar meu e-mail</a></p><p style="color:#64748b;font-size:13px">O link vale por ${TOKEN_TTL_HOURS} horas. Se não foi você, ignore esta mensagem.</p>`,
  });
};

// Consome o token: marca o e-mail como confirmado. Atômico (um token só vale uma vez).
export const consumeVerification = async (token: string): Promise<boolean> => {
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) return false;
  const rows = await orIfMissing(() => sql`
    WITH used AS (
      UPDATE email_tokens SET used_at = now()
      WHERE token_hash = ${hash(token)} AND used_at IS NULL AND expires_at > now()
      RETURNING user_id
    )
    UPDATE users SET email_verified = true WHERE id IN (SELECT user_id FROM used) RETURNING id`, [] as Record<string, any>[]);
  return rows.length > 0;
};
