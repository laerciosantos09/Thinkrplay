import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '../_lib/db.js';
import { requireSession, startSession } from '../_lib/http.js';
import { CHALLENGE_RE, consumeHandoff, handoffReady, issueHandoff, returnToApp } from '../_lib/handoff.js';
import {
  PROVIDERS, authorizeUrl, clearStateCookie, pendingCookie, createOAuthUser, encryptToken, exchangeCode, identitiesTableExists, isProvider,
  providerAvailable, randomToken, readStateCookie, safeEqual, stateCookie, verifyIdToken, type FlowState, type Identity, type Provider,
} from '../_lib/oauth.js';

// Login com Google e Apple (fluxo "código de autorização" no servidor). Uma função só, por provedor:
//   GET  /api/oauth/providers           -> quais botões mostrar (público)
//   GET  /api/oauth/google|apple        -> começa o login (?link=1 liga a um usuário já logado)
//   GET  /api/oauth/google              -> retorno do Google (?code&state)
//   POST /api/oauth/apple               -> retorno da Apple (form_post: code, state, user)
//   GET  /api/oauth/google?app=1&challenge=...  -> igual, mas para o app nativo: termina em thinkrplay://auth?code=...
//   GET  /api/oauth/handoff?code&verifier       -> o app troca o código por uma sessão (dentro do WebView)
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
  const fromApp = req.query.app === '1';
  const bail = (code: string) => (fromApp ? returnToApp(res, { error: code }) : fail(res, code)); // o app espera o erro por thinkrplay://
  if (!(await providerAvailable(p))) return bail('unavailable');
  let mode: FlowState['mode'] = 'login';
  let uid: string | undefined;
  if (req.query.link === '1') {
    try {
      uid = (await requireSession(req)).id;
      mode = 'link';
    } catch {
      return bail('session');
    }
  }
  let app = false;
  let challenge: string | undefined;
  if (req.query.app === '1') { // app nativo: só login (não "conectar") e com a challenge do app
    challenge = String(req.query.challenge ?? '');
    if (mode !== 'login' || !CHALLENGE_RE.test(challenge) || !(await handoffReady())) return bail('unavailable');
    app = true;
  }
  const flow: FlowState = { provider: p, state: randomToken(), nonce: randomToken(), mode, uid, ...(app ? { app, challenge } : {}) };
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
  // No app nativo o resultado (erro ou código) volta pelo esquema thinkrplay://; no site, por redirecionamento.
  const failFlow = (code: string) => (flow.app ? returnToApp(res, { error: code }) : fail(res, code));
  const signIn = async (user: { id: string; version: number }) => {
    if (flow.app) return returnToApp(res, { code: await issueHandoff(user.id, flow.challenge!) });
    await startSession(req, res, user);
    go(res, '/');
  };
  if (params.error || !params.code) return failFlow('cancelled');
  if (!(await providerAvailable(p))) return failFlow('unavailable');

  let identity: Identity;
  let refresh: string | undefined;
  try {
    const tokens = await exchangeCode(req, p, String(params.code));
    refresh = tokens.refresh_token;
    identity = await verifyIdToken(p, tokens.id_token, flow.nonce);
  } catch (err) {
    console.error(`OAuth ${p}: validação falhou:`, err instanceof Error ? err.message : err);
    return failFlow('failed');
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
    // O provedor confirmou o mesmo e-mail da conta: ela passa a contar como verificada.
    if (identity.emailVerified && identity.email) await sql`UPDATE users SET email_verified = true WHERE id = ${session.id} AND lower(email) = ${identity.email}`;
    return go(res, `/?auth_notice=linked_${p}`);
  }

  // ---- entrar ----
  if (existing) {
    await saveToken(p, identity.providerUserId, refresh);
    return signIn({ id: existing.user_id, version: existing.token_version });
  }
  // Sem identidade conhecida: precisa de e-mail verificado pelo provedor.
  if (!identity.email || !identity.emailVerified) return failFlow('unverified_email');
  const owner = (await sql`SELECT id, token_version, email_verified, password_hash, coalesce((to_jsonb(users)->>'verification_required')::boolean, false) AS verification_required FROM users WHERE lower(email) = ${identity.email}`)[0];
  if (owner && owner.verification_required && !owner.email_verified && owner.password_hash) {
    // Cadastro com senha que NUNCA confirmou o e-mail, e agora o dono de verdade prova o e-mail pelo provedor: a conta é dele.
    // As credenciais criadas antes (senha e palavra secreta, possivelmente de um impostor) são apagadas e as sessões antigas encerradas.
    const reset = await sql`UPDATE users SET password_hash = NULL, secret_hash = NULL, email_verified = true, token_version = token_version + 1 WHERE id = ${owner.id} RETURNING token_version`;
    owner.token_version = reset[0].token_version;
    owner.email_verified = true;
    owner.password_hash = null;
  }
  if (owner) {
    // Mesma pessoa, mesma conta: se o e-mail dessa conta já foi verificado por um provedor (ou ela nem tem senha), conecta e entra.
    if (owner.email_verified || !owner.password_hash) {
      await sql`INSERT INTO oauth_identities (provider, provider_user_id, user_id, email) VALUES (${p}, ${identity.providerUserId}, ${owner.id}, ${identity.email}) ON CONFLICT DO NOTHING`;
      await saveToken(p, identity.providerUserId, refresh);
      return signIn({ id: owner.id, version: owner.token_version });
    }
    // Conta criada com senha e e-mail nunca verificado: o cadastro por senha não prova que o e-mail é de quem o digitou,
    // então só conecta depois de a pessoa confirmar a senha da conta (evita tomada de conta por cadastro antecipado).
    if (flow.app) return failFlow('email_in_use'); // a confirmação da senha acontece no site: no app, entre com e-mail e senha
    addCookie(res, await pendingCookie(req, { provider: p, sub: identity.providerUserId, email: identity.email, refresh: refresh ? encryptToken(refresh) : undefined }));
    return go(res, `/?auth_link=${p}`);
  }
  const created = await createOAuthUser(identity, p);
  if (!created) return failFlow('email_in_use');
  await sql`INSERT INTO oauth_identities (provider, provider_user_id, user_id, email) VALUES (${p}, ${identity.providerUserId}, ${created.id}, ${identity.email}) ON CONFLICT DO NOTHING`;
  await saveToken(p, identity.providerUserId, refresh);
  return signIn({ id: created.id, version: created.token_version });
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
    if (slug === 'handoff') { // o app (WebView) troca o código de uso único por uma sessão
      if (req.method !== 'GET') return void res.status(405).json({ error: 'Método não permitido.' });
      const user = await consumeHandoff(String(req.query.code ?? ''), String(req.query.verifier ?? ''));
      if (!user) return fail(res, 'failed');
      await startSession(req, res, { id: user.id, version: user.token_version });
      return go(res, '/');
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
