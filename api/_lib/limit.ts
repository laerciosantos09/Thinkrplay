import { HttpError, sql } from './db.js';

const WINDOW = '15 minutes';
const MAX_PER_IP = 8; // tentativas erradas por IP na janela
const MAX_PER_EMAIL = 15; // por e-mail na janela: mais alto que o do IP para que um estranho não consiga trancar a conta de outra pessoa com poucos erros
const MAX_PER_EMAIL_DAY = 20; // só para a palavra secreta (daily): senha de recuperação costuma ser fraca, então tem teto diário

// Bloqueia força bruta em login/recuperação, por IP e por e-mail.
export const assertNotLocked = async (email: string, ip: string, { daily = false } = {}) => {
  const rows = await sql`
    SELECT count(*) FILTER (WHERE ip = ${ip})::int AS by_ip, count(*) FILTER (WHERE email = ${email})::int AS by_email
    FROM auth_attempts WHERE (email = ${email} OR ip = ${ip}) AND at > now() - ${WINDOW}::interval`;
  if (rows[0].by_ip >= MAX_PER_IP || rows[0].by_email >= MAX_PER_EMAIL) {
    throw new HttpError(429, 'Muitas tentativas. Aguarde alguns minutos e tente de novo.');
  }
  if (daily) {
    const day = await sql`SELECT count(*)::int AS n FROM auth_attempts WHERE email = ${email} AND at > now() - interval '1 day'`;
    if (day[0].n >= MAX_PER_EMAIL_DAY) throw new HttpError(429, 'Limite diário de tentativas atingido. Tente novamente amanhã.');
  }
};

export const recordFailure = async (email: string, ip: string) => {
  await sql`INSERT INTO auth_attempts (email, ip) VALUES (${email}, ${ip})`;
  await sql`DELETE FROM auth_attempts WHERE at < now() - interval '1 day'`;
};

// Limite simples por IP para ações que não são "tentativa de senha" (ex.: cadastro). Usa chaves próprias na mesma tabela
// (e-mail "kind", IP "kind:ip"), então não se mistura com o bloqueio de login. Cada chamada conta 1.
export const throttle = async (kind: string, ip: string, max: number, window = '1 hour') => {
  const key = `${kind}:${ip}`;
  const rows = await sql`SELECT count(*)::int AS n FROM auth_attempts WHERE email = ${kind} AND ip = ${key} AND at > now() - ${window}::interval`;
  if (rows[0].n >= max) throw new HttpError(429, 'Muitas solicitações. Aguarde um pouco e tente de novo.');
  await sql`INSERT INTO auth_attempts (email, ip) VALUES (${kind}, ${key})`;
};
