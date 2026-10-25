import bcrypt from 'bcryptjs';
import { HttpError, sql } from './_lib/db.js';
import { clientIp, endSession, requireSession, route, startSession, str } from './_lib/http.js';
import { assertNotLocked, recordFailure } from './_lib/limit.js';
import { publicUser } from './_lib/user.js';
import { ACTIVE_STATUSES, getSubscription } from './_lib/premium.js';
import { stripe, stripeConfigured } from './_lib/stripe.js';
import { identitiesTableExists, revokeApple, isProvider } from './_lib/oauth.js';
import { LEGAL_VERSION, RESERVED_USERNAMES, USERNAME_PATTERN } from '../lib/legal.js';

const loadUser = async (id: string) => {
  const rows = await sql`
    SELECT * FROM users WHERE id = ${id}`;
  if (!rows[0]) throw new HttpError(401, 'Sessão expirada. Entre novamente.');
  return rows[0];
};

// Provedores ligados à conta (vazio se a migração 008 ainda não rodou).
const connections = async (id: string): Promise<string[]> =>
  (await identitiesTableExists())
    ? (await sql`SELECT provider FROM oauth_identities WHERE user_id = ${id} ORDER BY provider`).map((r) => r.provider as string)
    : [];

const PAGE_SIZE = 25;
const listUsers = async (q: string, page: number) => {
  const like = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  const hasIdentities = await identitiesTableExists();
  // to_jsonb(u): tolera a coluna signup_method ainda não existir (migração 009 pendente)
  const rows = hasIdentities
    ? await sql`
        SELECT u.id, u.username, u.email, u.role, u.created_at,
               coalesce(to_jsonb(u)->>'signup_method', 'password') AS signup_method,
               coalesce((to_jsonb(u)->>'email_verified')::boolean, false) AS email_verified,
               (u.password_hash IS NOT NULL) AS has_password,
               coalesce((SELECT array_agg(i.provider ORDER BY i.provider) FROM oauth_identities i WHERE i.user_id = u.id), '{}') AS providers,
               count(*) OVER() AS total
        FROM users u
        WHERE ${q === ''} OR u.username ILIKE ${like} OR u.email ILIKE ${like}
        ORDER BY u.created_at DESC LIMIT ${PAGE_SIZE} OFFSET ${(page - 1) * PAGE_SIZE}`
    : await sql`
        SELECT u.id, u.username, u.email, u.role, u.created_at, 'password' AS signup_method, false AS email_verified,
               (u.password_hash IS NOT NULL) AS has_password, '{}'::text[] AS providers, count(*) OVER() AS total
        FROM users u
        WHERE ${q === ''} OR u.username ILIKE ${like} OR u.email ILIKE ${like}
        ORDER BY u.created_at DESC LIMIT ${PAGE_SIZE} OFFSET ${(page - 1) * PAGE_SIZE}`;
  return {
    total: Number(rows[0]?.total ?? 0), page, pageSize: PAGE_SIZE,
    users: rows.map((r) => ({
      id: r.id, username: r.username, email: r.email, role: r.role, createdAt: new Date(r.created_at).toISOString(),
      signupMethod: r.signup_method, emailVerified: r.email_verified,
      loginMethods: [...(r.has_password ? ['password'] : []), ...(r.providers as string[])],
    })),
  };
};

// Ações sensíveis exigem a senha atual e contam tentativas erradas (mesmo limite do login).
const checkPassword = async (user: Record<string, any>, password: string, ip: string, message: string) => {
  await assertNotLocked(user.email, ip);
  if (!user.password_hash || !(await bcrypt.compare(password, user.password_hash))) {
    await recordFailure(user.email, ip);
    // 403 (e não 401): o cliente trata 401 como "sessão expirada" e deslogaria quem só errou a senha.
    throw new HttpError(403, message);
  }
};

// GET: dados do próprio usuário (também usado para saber se há alguém logado).
// POST { action }: logout | username | password | delete | unlink | accept_terms
export default route(['GET', 'POST'], async (req, res) => {
  // Sair não exige sessão válida: sempre limpa o cookie.
  if (req.method === 'POST' && req.body?.action === 'logout') {
    endSession(res);
    return { ok: true };
  }
  const session = await requireSession(req);
  const user = await loadUser(session.id);
  // "Flags" de login: quais formas de entrar a conta tem ativas (senha e/ou provedores conectados).
  const me = async () => {
    const conn = await connections(user.id);
    return {
      ...publicUser(user), hasPassword: Boolean(user.password_hash), connections: conn,
      loginMethods: [...(user.password_hash ? ['password'] : []), ...conn],
    };
  };
  if (req.method === 'GET' && req.query?.users) { // lista de cadastros, só para administrador
    if (user.role !== 'admin') throw new HttpError(403, 'Acesso restrito ao administrador.');
    return await listUsers(String(req.query.q ?? '').trim().slice(0, 60), Math.max(1, Number(req.query.page) || 1));
  }
  if (req.method === 'GET') return { user: await me(), legalVersion: LEGAL_VERSION };

  const body = req.body ?? {};
  const ip = clientIp(req);

  switch (body.action) {
    case 'username': {
      const username = str(body.username, 'Nome de usuário', 3, 24);
      if (!USERNAME_PATTERN.test(username)) throw new HttpError(400, 'Nome de usuário só pode ter letras, números, _ . e -');
      if (RESERVED_USERNAMES.includes(username.toLowerCase()) && user.role !== 'admin') {
        throw new HttpError(400, 'Este nome de usuário não está disponível.');
      }
      if (username === user.username) throw new HttpError(400, 'Este já é o seu nome de usuário.');
      try {
        const rows = await sql`
          UPDATE users SET username = ${username} WHERE id = ${user.id}
          RETURNING id, username, email, role, created_at, terms_version`;
        return { user: { ...(await me()), ...publicUser(rows[0]) } };
      } catch (err: any) {
        if (err?.code === '23505') throw new HttpError(409, 'Este nome de usuário já está em uso.');
        throw err;
      }
    }

    case 'password': {
      const next = str(body.newPassword, 'Nova senha', 8, 100);
      // Conta criada pelo Google/Apple ainda não tem senha: define a primeira sem pedir a atual (a sessão já prova quem é).
      const current = user.password_hash ? str(body.currentPassword, 'Senha atual', 1, 100) : '';
      if (user.password_hash) await checkPassword(user, current, ip, 'Senha atual incorreta.');
      if (user.password_hash && current === next) throw new HttpError(400, 'A nova senha precisa ser diferente da atual.');
      const hash = await bcrypt.hash(next, 11);
      // token_version + 1 encerra as sessões de todos os outros dispositivos; esta continua com um token novo.
      const rows = await sql`
        UPDATE users SET password_hash = ${hash}, token_version = token_version + 1 WHERE id = ${user.id}
        RETURNING token_version`;
      await startSession(req, res, { id: user.id, version: rows[0].token_version });
      return { ok: true };
    }

    case 'delete': {
      if (user.password_hash) await checkPassword(user, str(body.password, 'Senha', 1, 100), ip, 'Senha incorreta.');
      if (String(body.confirm ?? '').trim().toUpperCase() !== 'EXCLUIR') {
        throw new HttpError(400, 'Digite EXCLUIR para confirmar.');
      }
      // Assinatura ativa: cancela no Stripe ANTES de apagar. Se não der, interrompe (ninguém pode continuar sendo cobrado).
      const sub = await getSubscription(user.id);
      if (sub?.stripe_subscription_id && (ACTIVE_STATUSES.includes(sub.status) || sub.status === 'past_due')) {
        if (!stripeConfigured()) {
          throw new HttpError(503, 'Não foi possível cancelar sua assinatura agora. Tente novamente em instantes.', true);
        }
        await stripe('DELETE', `/subscriptions/${sub.stripe_subscription_id}`, { allowNotFound: true });
      }
      // Apple exige revogar o acesso ao excluir a conta. Se falhar, interrompe (o usuário tenta de novo).
      if (await identitiesTableExists()) {
        const apple = (await sql`SELECT refresh_token FROM oauth_identities WHERE user_id = ${user.id} AND provider = 'apple'`)[0];
        if (apple?.refresh_token) await revokeApple(apple.refresh_token);
      }
      // Apaga o usuário e, em cascata, pontuações, partidas e progresso. Não deixa o app sem nenhum admin.
      const rows = await sql`
        DELETE FROM users
        WHERE id = ${user.id} AND (role <> 'admin' OR (SELECT count(*) FROM users WHERE role = 'admin') > 1)
        RETURNING id`;
      if (rows.length === 0) {
        throw new HttpError(409, 'Você é o único administrador. Crie outro administrador antes de excluir esta conta.');
      }
      await sql`DELETE FROM auth_attempts WHERE email = ${String(user.email).toLowerCase()}`;
      endSession(res);
      return { ok: true };
    }

    case 'unlink': {
      if (!isProvider(body.provider)) throw new HttpError(400, 'Provedor inválido.');
      const linked = await connections(user.id);
      if (!linked.includes(body.provider)) throw new HttpError(400, 'Esta conta não está conectada.');
      // Precisa sobrar um jeito de entrar: senha ou outro provedor.
      if (!user.password_hash && linked.length <= 1) {
        throw new HttpError(400, 'Defina uma senha antes de desconectar o único método de login.');
      }
      if (body.provider === 'apple') {
        const apple = (await sql`SELECT refresh_token FROM oauth_identities WHERE user_id = ${user.id} AND provider = 'apple'`)[0];
        if (apple?.refresh_token) await revokeApple(apple.refresh_token);
      }
      await sql`DELETE FROM oauth_identities WHERE user_id = ${user.id} AND provider = ${body.provider}`;
      return { ok: true, connections: await connections(user.id) };
    }

    case 'accept_terms': {
      const rows = await sql`
        UPDATE users SET terms_version = ${LEGAL_VERSION}, terms_accepted_at = now() WHERE id = ${user.id}
        RETURNING id, username, email, role, created_at, terms_version`;
      return { user: { ...(await me()), ...publicUser(rows[0]) } };
    }

    default:
      throw new HttpError(400, 'Ação inválida.');
  }
});
