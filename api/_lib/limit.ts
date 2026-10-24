import { HttpError, sql } from './db.js';

const WINDOW = '15 minutes';
const MAX_FAILURES = 8;

// Bloqueia força bruta em login/recuperação, por e-mail e por IP.
export const assertNotLocked = async (email: string, ip: string) => {
  const rows = await sql`
    SELECT count(*)::int AS n FROM auth_attempts
    WHERE (email = ${email} OR ip = ${ip}) AND at > now() - ${WINDOW}::interval`;
  if (rows[0].n >= MAX_FAILURES) {
    throw new HttpError(429, 'Muitas tentativas. Aguarde alguns minutos e tente de novo.');
  }
};

export const recordFailure = async (email: string, ip: string) => {
  await sql`INSERT INTO auth_attempts (email, ip) VALUES (${email}, ${ip})`;
  await sql`DELETE FROM auth_attempts WHERE at < now() - interval '1 day'`;
};
