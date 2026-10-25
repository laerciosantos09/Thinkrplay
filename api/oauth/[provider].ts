import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '../_lib/db.js';
import { requireSession, startSession } from '../_lib/http.js';
import {
  PROVIDERS, authorizeUrl, clearStateCookie, createOAuthUser, encryptToken, exchangeCode, identitiesTableExists, isProvider,
  providerAvailable, randomToken, readStateCookie, safeEqual, stateCookie, verifyIdToken, type FlowState, type Identity, type Provider,
} from '../_lib/oauth.js';

// Login com Google e Apple (fluxo "código de autorização" no servidor). Uma função só, por provedor:
//   GET  /api/oauth/providers           -> quais botões mostrar (público)
//   GET  /api/oauth/google|apple        -> começa o login (?link=1 liga a um usuário já logado)
//   GET  /api/oauth/google              -> retorno do Google (?code&state)
//   POST /api/oauth/apple               -> retorno da Apple (form_post: code, state, user)
// Quem chama é o navegador, então os resultados voltam como redirecionamento para o app (/?auth_error=... ou /).

const go = (res: VercelResponse, location: string) => {
  res.setHeader('Cache-Control', 'no-store');
  res.status(302);
  res.setHeader('Location', location);
  res.end();
};
const fail = (res: VercelResponse, code: string) => go(res, `/?auth_error=${code}`);

// Os dois cookies (sessão e limpeza do estado) precisam sair juntos.
const addCookie = (res: VercelResponse, cookie: string) => {
  const current = res.getHeader('Set-Cookie');
  res.setHeader('Set-Cookie', [...(Array.isArray(current) ? current : current ? [String(current)] : []), cookie]);
};

const readForm = async (req: VercelRequest): Promise<Record<string, any>> => {
  if (req.body && typeof req.body === 'object') return req.body;
  const raw = typeof req.body === 'string' ? req.body : '';
  return Object.fromEntries(new URLSearchParams(raw));
};

const start = async (req: VercelRequest, res: VercelResponse, p: Provider) => {
  if (!(await providerAvailable(p))) return fail(res, 'unavailable');
  let mode: FlowState['mode'] = 'login';
  let uid: string | undefined;
  if (req.query.link === '1') {
    try {
      uid = (await requireSession(req)).id;
      mode = 'link';
    } catch {
      return fail(res, 'session');
    }
  }
  const flow: FlowState = { provider: p, state: randomToken(), nonce: randomToken(), mode, uid };
  res.setHeader('Set-Cookie', await stateCookie(req, flow));
  go(res, authorizeUrl(req, p, flow));
};

const saveToken = async (p: Provider, sub: string, refresh?: string) => {
  if (p === 'apple' && refresh) {
    await sql`UPDATE oauth_identities SET refresh_token = ${encryptToken(refresh)} WHERE provider = ${p} AND provider_user_id = ${sub}`;
  }
};

const callback = async (req: VercelRequest, res: VercelResponse, p: Provider) => {
  const params: Record<string, any> = req.method === 'POST' ? await readForm(req) : req.query;
  const flow = await readStateCookie(req);
  addCookie(res, clearStateCookie(req)); // o estado vale uma única vez
  if (!flow || flow.provider !== p || !params.state || !safeEqual(String(params.state), flow.state)) return fail(res, 'state');
  if (params.error || !params.code) return fail(res, 'cancelled');
  if (!(await providerAvailable(p))) return fail(res, 'unavailable');

  let identity: Identity;
  let refresh: string | undefined;
  try {
    const tokens = await exchangeCode(req, p, String(params.code));
    refresh = tokens.refresh_token;
    identity = await verifyIdToken(p, tokens.id_token, flow.nonce);
  } catch (err) {
    console.error(`OAuth ${p}: validação falhou:`, err instanceof Error ? err.message : err);
    return fail(res, 'failed');
  }
  if (p === 'apple' && params.user && !identity.name) {
    try { // a Apple só manda o nome na primeira autorização, num campo à parte
      const u = JSON.parse(String(params.user));
      identity.name = [u?.name?.firstName, u?.name?.lastName].filter(Boolean).join(' ') || null;
    } catch { /* sem nome: usa o e-mail */ }
  }

  const existing = (await sql`
    SELECT i.user_id, u.token_version FROM oauth_identities i JOIN users u ON u.id = i.user_id
    WHERE i.provider = ${p} AND i.provider_user_id = ${identity.providerUserId}`)[0];

  // ---- conectar a uma conta já logada (Perfil) ----
  if (flow.mode === 'link') {
    let session;
    try {
      session = await requireSession(req);
    } catch {
      return fail(res, 'session');
    }
    if (session.id !== flow.uid) return fail(res, 'session');
    if (existing) {
      if (existing.user_id !== session.id) return fail(res, 'identity_in_use');
      await saveToken(p, identity.providerUserId, refresh);
      return go(res, `/?auth_notice=linked_${p}`);
    }
    const already = await sql`SELECT 1 FROM oauth_identities WHERE user_id = ${session.id} AND provider = ${p}`;
    if (already.length > 0) return fail(res, 'already_linked');
    await sql`INSERT INTO oauth_identities (provider, provider_user_id, user_id, email) VALUES (${p}, ${identity.providerUserId}, ${session.id}, ${identity.email})`;
    await saveToken(p, identity.providerUserId, refresh);
    return go(res, `/?auth_notice=linked_${p}`);
  }

  // ---- entrar ----
  if (existing) {
    await saveToken(p, identity.providerUserId, refresh);
    await startSession(req, res, { id: existing.user_id, version: existing.token_version });
    return go(res, '/');
  }
  // Conta nova: o e-mail precisa estar verificado pelo provedor. E-mail já cadastrado NÃO é vinculado automaticamente
  // (o app não confirma e-mail no cadastro, então vincular sozinho permitiria tomar a conta de outra pessoa).
  if (!identity.email || !identity.emailVerified) return fail(res, 'unverified_email');
  const created = await createOAuthUser(identity);
  if (!created) return fail(res, 'email_in_use');
  await sql`INSERT INTO oauth_identities (provider, provider_user_id, user_id, email) VALUES (${p}, ${identity.providerUserId}, ${created.id}, ${identity.email}) ON CONFLICT DO NOTHING`;
  await saveToken(p, identity.providerUserId, refresh);
  await startSession(req, res, { id: created.id, version: created.token_version });
  go(res, '/');
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const slug = String(req.query.provider ?? '');
    if (slug === 'providers') { // quais botões mostrar: público, só diz "sim/não" por provedor
      const tableOk = await identitiesTableExists();
      const out: Record<string, boolean> = {};
      for (const p of PROVIDERS) out[p] = tableOk && (await providerAvailable(p));
      res.setHeader('Cache-Control', 'no-store');
      return void res.status(200).json(out);
    }
    if (!isProvider(slug)) return void res.status(404).json({ error: 'Provedor desconhecido.' });
    const isCallback = req.method === 'POST' || Boolean(req.query.code) || Boolean(req.query.error);
    if (!isCallback && req.method !== 'GET') return void res.status(405).json({ error: 'Método não permitido.' });
    return isCallback ? await callback(req, res, slug) : await start(req, res, slug);
  } catch (err) {
    console.error('OAuth: erro inesperado:', err);
    fail(res, 'failed');
  }
}
