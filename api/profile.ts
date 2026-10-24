import bcrypt from 'bcryptjs';
import { HttpError, sql } from './_lib/db.js';
import { clientIp, endSession, requireSession, route, startSession, str } from './_lib/http.js';
import { assertNotLocked, recordFailure } from './_lib/limit.js';
import { publicUser } from './_lib/user.js';
import { LEGAL_VERSION, RESERVED_USERNAMES, USERNAME_PATTERN } from '../lib/legal.js';

const loadUser = async (id: string) => {
  const rows = await sql`
    SELECT id, username, email, role, created_at, terms_version, token_version, password_hash
    FROM users WHERE id = ${id}`;
  if (!rows[0]) throw new HttpError(401, 'Sessão expirada. Entre novamente.');
  return rows[0];
};

// Ações sensíveis exigem a senha atual e contam tentativas erradas (mesmo limite do login).
const checkPassword = async (user: Record<string, any>, password: string, ip: string, message: string) => {
  await assertNotLocked(user.email, ip);
  if (!(await bcrypt.compare(password, user.password_hash))) {
    await recordFailure(user.email, ip);
    // 403 (e não 401): o cliente trata 401 como "sessão expirada" e deslogaria quem só errou a senha.
    throw new HttpError(403, message);
  }
};

// GET: dados do próprio usuário (também usado para saber se há alguém logado).
// POST { action }: username | password | delete | accept_terms
export default route(['GET', 'POST'], async (req, res) => {
  const session = await requireSession(req);
  const user = await loadUser(session.id);
  if (req.method === 'GET') return { user: publicUser(user), legalVersion: LEGAL_VERSION };

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
        return { user: publicUser(rows[0]) };
      } catch (err: any) {
        if (err?.code === '23505') throw new HttpError(409, 'Este nome de usuário já está em uso.');
        throw err;
      }
    }

    case 'password': {
      const current = str(body.currentPassword, 'Senha atual', 1, 100);
      const next = str(body.newPassword, 'Nova senha', 8, 100);
      await checkPassword(user, current, ip, 'Senha atual incorreta.');
      if (current === next) throw new HttpError(400, 'A nova senha precisa ser diferente da atual.');
      const hash = await bcrypt.hash(next, 11);
      // token_version + 1 encerra as sessões de todos os outros dispositivos; esta continua com um token novo.
      const rows = await sql`
        UPDATE users SET password_hash = ${hash}, token_version = token_version + 1 WHERE id = ${user.id}
        RETURNING token_version`;
      await startSession(req, res, { id: user.id, version: rows[0].token_version });
      return { ok: true };
    }

    case 'delete': {
      const password = str(body.password, 'Senha', 1, 100);
      await checkPassword(user, password, ip, 'Senha incorreta.');
      if (String(body.confirm ?? '').trim().toUpperCase() !== 'EXCLUIR') {
        throw new HttpError(400, 'Digite EXCLUIR para confirmar.');
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

    case 'accept_terms': {
      const rows = await sql`
        UPDATE users SET terms_version = ${LEGAL_VERSION}, terms_accepted_at = now() WHERE id = ${user.id}
        RETURNING id, username, email, role, created_at, terms_version`;
      return { user: publicUser(rows[0]) };
    }

    default:
      throw new HttpError(400, 'Ação inválida.');
  }
});
