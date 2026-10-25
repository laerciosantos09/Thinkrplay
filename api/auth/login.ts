import bcrypt from 'bcryptjs';
import { HttpError, sql } from '../_lib/db.js';
import { clientIp, route, startSession, str } from '../_lib/http.js';
import { publicUser } from '../_lib/user.js';
import { clearPendingCookie, readPendingCookie } from '../_lib/oauth.js';
import { assertNotLocked, recordFailure } from '../_lib/limit.js';

// Hash fictício para gastar o mesmo tempo quando o e-mail não existe.
const DUMMY = '$2b$11$Da2tv3js2BCDJcW3u1R72uq/.bufOtL3XYtKadhDaJkTtN7KM5GPu';

export default route(['POST'], async (req, res) => {
  const email = str(req.body?.email, 'E-mail', 3, 120).toLowerCase();
  const password = str(req.body?.password, 'Senha', 1, 100);
  const ip = clientIp(req);
  await assertNotLocked(email, ip);

  const rows = await sql`SELECT * FROM users WHERE lower(email) = ${email}`;
  const found = rows[0];
  const ok = await bcrypt.compare(password, found?.password_hash ?? DUMMY);
  if (!found || !ok) {
    await recordFailure(email, ip);
    throw new HttpError(401, 'E-mail ou senha incorretos.');
  }

  await startSession(req, res, { id: found.id, version: found.token_version });

  // Login social que esperava a confirmação da senha: conecta o provedor a esta conta (o e-mail precisa ser o mesmo).
  let linked: string | null = null;
  if (req.body?.linkPending === true) {
    const pending = await readPendingCookie(req);
    if (pending && pending.email === String(found.email).toLowerCase()) {
      const done = await sql`
        INSERT INTO oauth_identities (provider, provider_user_id, user_id, email, refresh_token)
        VALUES (${pending.provider}, ${pending.sub}, ${found.id}, ${pending.email}, ${pending.refresh ?? null})
        ON CONFLICT DO NOTHING RETURNING provider`;
      if (done.length > 0) {
        await sql`UPDATE users SET email_verified = true WHERE id = ${found.id}`; // senha + e-mail confirmado pelo provedor
        linked = pending.provider;
      }
    }
    const current = res.getHeader('Set-Cookie');
    res.setHeader('Set-Cookie', [...(Array.isArray(current) ? current : current ? [String(current)] : []), clearPendingCookie(req)]);
  }
  return { user: publicUser(found), linked };
});
