// Teste do login Google/Apple: provedores simulados (fetch e JWKS falsos), banco PGlite em memória.
import { build } from 'esbuild';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { pathToFileURL, fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import { SignJWT, exportJWK, exportPKCS8, generateKeyPair } from 'jose';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
mkdirSync(path.join(root, 'node_modules/.cache'), { recursive: true });
const out = mkdtempSync(path.join(root, 'node_modules/.cache/oauth-test-'));
const pg = new PGlite();
for (const s of readFileSync(path.join(root, 'db/schema.sql'), 'utf8').split(/;\s*\n/).map((x) => x.trim()).filter(Boolean)) await pg.query(s);
globalThis.__sql = async (strings, ...values) => {
  const text = strings.reduce((acc, s, i) => acc + s + (i < values.length ? `$${i + 1}` : ''), '');
  return (await pg.query(text, values)).rows;
};
writeFileSync(path.join(out, 'db-shim.js'), `export const sql = (...a) => globalThis.__sql(...a);
export const assertDb = () => {};
export class HttpError extends Error { constructor(status, message, expose = false, extra) { super(message); this.status = status; this.expose = expose; this.extra = extra; } }
export const isMissingTable = (err) => err?.code === '42P01';
export const orIfMissing = async (run, fallback) => { try { return await run(); } catch (err) { if (isMissingTable(err)) return fallback; throw err; } };`);

const names = ['oauth/[provider]', 'profile', 'settings', 'auth/login'];
await build({
  entryPoints: Object.fromEntries(names.map((n) => [n, path.join(root, 'api', `${n}.ts`)])),
  outdir: out, bundle: true, format: 'esm', platform: 'node', packages: 'external',
  plugins: [{ name: 'db', setup: (b) => b.onResolve({ filter: /(^|\/)db\.js$/ }, () => ({ path: path.join(out, 'db-shim.js') })) }],
});

// ---- provedores falsos
const google = await generateKeyPair('RS256');
const apple = await generateKeyPair('RS256');
const appleSecretKey = await generateKeyPair('ES256', { extractable: true });
const jwk = async (pair, kid) => ({ ...(await exportJWK(pair.publicKey)), kid, alg: 'RS256', use: 'sig' });
const jwks = { google: { keys: [await jwk(google, 'g1')] }, apple: { keys: [await jwk(apple, 'a1')] } };
const idToken = (p, claims, { nonce } = {}) =>
  new SignJWT({ nonce: nonce ?? flowNonce, ...claims })
    .setProtectedHeader({ alg: 'RS256', kid: p === 'google' ? 'g1' : 'a1' })
    .setIssuer(p === 'google' ? 'https://accounts.google.com' : 'https://appleid.apple.com')
    .setAudience(p === 'google' ? 'gid' : 'com.thinkrplay.web')
    .setSubject(claims.sub).setIssuedAt().setExpirationTime('5m')
    .sign((p === 'google' ? google : apple).privateKey);

let flowNonce = '';
let nextToken = null; // o que o endpoint de token devolve
let revoked = []; let revokeStatus = 200; let tokenCalls = [];
globalThis.fetch = async (url, init) => {
  url = String(url);
  const json = (b, status = 200) => new Response(JSON.stringify(b), { status, headers: { 'content-type': 'application/json' } });
  if (url.includes('googleapis.com/oauth2/v3/certs')) return json(jwks.google);
  if (url.includes('appleid.apple.com/auth/keys')) return json(jwks.apple);
  if (url.includes('/token')) { tokenCalls.push(Object.fromEntries(new URLSearchParams(init.body))); return nextToken ? json(nextToken) : json({ error: 'invalid_grant' }, 400); }
  if (url.includes('/auth/revoke')) { revoked.push(Object.fromEntries(new URLSearchParams(init.body))); return json({}, revokeStatus); }
  throw new Error(`fetch inesperado: ${url}`);
};

Object.assign(process.env, {
  JWT_SECRET: 'x'.repeat(40), APP_URL: 'https://app.test',
  GOOGLE_CLIENT_ID: 'gid', GOOGLE_CLIENT_SECRET: 'gsecret',
  APPLE_CLIENT_ID: 'com.thinkrplay.web', APPLE_TEAM_ID: 'TEAM123456', APPLE_KEY_ID: 'KEY1234567',
  APPLE_PRIVATE_KEY: (await exportPKCS8(appleSecretKey.privateKey)).replace(/\n/g, '\\n'),
});
const load = async (n) => (await import(pathToFileURL(path.join(out, `${n}.js`)).href)).default;
const h = { oauth: await load('oauth/[provider]'), profile: await load('profile'), settings: await load('settings'), login: await load('auth/login') };

// ---- cliente simples com jar de cookies
const jar = new Map();
const setCookies = (v) => { for (const c of [].concat(v ?? [])) { const [kv, ...attrs] = c.split(';'); const [k, ...rest] = kv.split('='); if (/Max-Age=0/i.test(attrs.join(';')) || !rest.join('=')) jar.delete(k.trim()); else jar.set(k.trim(), rest.join('=')); } };
const cookieHeader = () => [...jar].map(([k, v]) => `${k}=${v}`).join('; ');
const run = async (handler, { method, query = {}, body, headers = {} } = {}) => {
  method ??= body ? 'POST' : 'GET';
  const hdrs = {};
  const res = {
    statusCode: 200, headers: hdrs,
    setHeader(k, v) { hdrs[k.toLowerCase()] = v; }, getHeader(k) { return hdrs[k.toLowerCase()]; },
    status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; }, end() { return this; },
  };
  await handler({ method, query, body, headers: { host: 'app.test', origin: 'https://app.test', 'content-type': 'application/json', cookie: cookieHeader(), 'x-forwarded-for': '9.9.9.9', ...headers }, socket: {} }, res);
  setCookies(res.headers['set-cookie']);
  return res;
};
const api = async (name, opts) => run(h[name], opts);
const okJson = async (name, opts) => { const r = await api(name, opts); assert.equal(r.statusCode, 200, JSON.stringify(r.body)); return r.body; };
const loc = (r) => r.headers.location;
const setting = (key, enabled) => pg.query(`INSERT INTO app_settings (key, enabled) VALUES ($1,$2) ON CONFLICT (key) DO UPDATE SET enabled=$2`, [key, enabled]);

// inicia o fluxo e devolve state/nonce vistos na URL de autorização
const begin = async (p, query = {}) => {
  const r = await api('oauth', { query: { provider: p, ...query } });
  assert.equal(r.statusCode, 302);
  const u = new URL(loc(r), 'https://app.test');
  if (u.origin === 'https://app.test' && !u.pathname.includes('oauth2')) return { r, error: u.searchParams.get('auth_error') };
  flowNonce = u.searchParams.get('nonce');
  return { r, u, state: u.searchParams.get('state') };
};
const finish = async (p, state, { claims, post = false, extra = {}, tokens } = {}) => {
  nextToken = tokens ?? { id_token: await idToken(p, claims), ...(p === 'apple' ? { refresh_token: 'apple-refresh-1' } : {}) };
  const params = { code: 'abc', state, ...extra };
  return api('oauth', post ? { method: 'POST', query: { provider: p }, body: params, headers: { 'content-type': 'application/x-www-form-urlencoded', origin: 'https://appleid.apple.com' } } : { query: { provider: p, ...params } });
};

// ---- disponibilidade
let prov = await okJson('oauth', { query: { provider: 'providers' } });
assert.deepEqual(prov, { google: false, apple: false }, 'desligado por padrão');
assert.equal((await begin('google')).error, 'unavailable');
await setting('login_google', true);
prov = await okJson('oauth', { query: { provider: 'providers' } });
assert.deepEqual(prov, { google: true, apple: false });
assert.equal((await api('oauth', { query: { provider: 'facebook' } })).statusCode, 404);

// ---- Google: cria conta nova
let f = await begin('google');
assert.equal(f.u.origin + f.u.pathname, 'https://accounts.google.com/o/oauth2/v2/auth');
assert.equal(f.u.searchParams.get('redirect_uri'), 'https://app.test/api/oauth/google');
assert.ok(jar.get('oauth_state'), 'cookie de estado');
let r = await finish('google', f.state, { claims: { sub: 'g-1', email: 'Ana@Gmail.com', email_verified: true, name: 'Ana Maria' } });
assert.equal(loc(r), '/');
assert.ok(jar.get('session') && !jar.has('oauth_state'), 'sessão criada, estado consumido');
assert.equal(tokenCalls.at(-1).client_secret, 'gsecret');
let me = (await okJson('profile', { method: 'GET' })).user;
assert.equal(me.email, 'ana@gmail.com');
assert.equal(me.username, 'AnaMaria');
assert.equal(me.hasPassword, false);
assert.deepEqual(me.connections, ['google']);
assert.equal(me.signupMethod, 'google');
assert.deepEqual(me.loginMethods, ['google']);
assert.deepEqual([me.termsAccepted, me.privacyAccepted, me.needsTerms], [false, false, true], 'conta social precisa aceitar os dois documentos');

// entrar de novo com a mesma identidade não duplica
await api('profile', { method: 'POST', body: { action: 'logout' } }); jar.delete('session');
f = await begin('google');
r = await finish('google', f.state, { claims: { sub: 'g-1', email: 'ana@gmail.com', email_verified: true } });
assert.equal(loc(r), '/');
assert.equal((await pg.query('SELECT count(*)::int n FROM users')).rows[0].n, 1);

// senha: conta sem senha não entra pelo formulário; define a primeira sem a atual
jar.delete('session');
assert.equal((await api('login', { method: 'POST', body: { email: 'ana@gmail.com', password: 'qualquer-coisa-1' } })).statusCode, 401);
f = await begin('google'); await finish('google', f.state, { claims: { sub: 'g-1', email: 'ana@gmail.com', email_verified: true } });
assert.equal((await api('profile', { method: 'POST', body: { action: 'delete', password: 'x', confirm: 'nao' } })).statusCode, 400, 'sem confirmação');
assert.equal((await api('profile', { method: 'POST', body: { action: 'unlink', provider: 'google' } })).statusCode, 400, 'único método de login');
await okJson('profile', { body: { action: 'password', newPassword: 'primeira-senha-1' } });
me = (await okJson('profile', { method: 'GET' })).user;
assert.equal(me.hasPassword, true);
assert.equal((await api('profile', { method: 'POST', body: { action: 'password', newPassword: 'outra-senha-22' } })).statusCode, 400, 'agora exige a atual');

// ---- ataques ao fluxo
f = await begin('google');
assert.equal(loc(await finish('google', 'state-errado', { claims: { sub: 'g-9', email: 'x@x.com', email_verified: true } })), '/?auth_error=state', 'state inválido');
f = await begin('google');
flowNonce = 'nonce-diferente';
assert.equal(loc(await finish('google', f.state, { tokens: { id_token: await idToken('google', { sub: 'g-9', email: 'x@x.com', email_verified: true }, { nonce: 'outro' }) } })), '/?auth_error=failed', 'nonce inválido');
f = await begin('google');
const forged = await new SignJWT({ nonce: flowNonce, email: 'x@x.com', email_verified: true }).setProtectedHeader({ alg: 'RS256', kid: 'g1' }).setIssuer('https://accounts.google.com').setAudience('gid').setSubject('g-9').setExpirationTime('5m').sign((await generateKeyPair('RS256')).privateKey);
assert.equal(loc(await finish('google', f.state, { tokens: { id_token: forged } })), '/?auth_error=failed', 'assinatura falsa');
f = await begin('google');
const wrongAud = await new SignJWT({ nonce: flowNonce }).setProtectedHeader({ alg: 'RS256', kid: 'g1' }).setIssuer('https://accounts.google.com').setAudience('outro-app').setSubject('g-9').setExpirationTime('5m').sign(google.privateKey);
assert.equal(loc(await finish('google', f.state, { tokens: { id_token: wrongAud } })), '/?auth_error=failed', 'audiência errada');
f = await begin('google');
nextToken = null; // o Google recusa o código
assert.equal(loc(await api('oauth', { query: { provider: 'google', code: 'x', state: f.state } })), '/?auth_error=failed', 'troca de código recusada');
f = await begin('google');
assert.equal(loc(await api('oauth', { query: { provider: 'google', error: 'access_denied', state: f.state } })), '/?auth_error=cancelled', 'usuário cancelou');
assert.equal(loc(await api('oauth', { query: { provider: 'google', code: 'x', state: 'sem-cookie' } })), '/?auth_error=state', 'sem cookie de estado (consumido)');
// estado de um provedor não vale para o outro
await setting('login_apple', true);
f = await begin('google');
assert.equal(loc(await finish('apple', f.state, { claims: { sub: 'a-9', email: 'x@x.com', email_verified: true }, post: true })), '/?auth_error=state', 'cookie do Google no retorno da Apple');

// e-mail não verificado e e-mail já cadastrado (sem vínculo automático)
jar.delete('session');
f = await begin('google');
assert.equal(loc(await finish('google', f.state, { claims: { sub: 'g-2', email: 'novo@gmail.com', email_verified: false } })), '/?auth_error=unverified_email');
// e-mail já tem conta com SENHA e nunca foi verificado: não entra nem conecta sem confirmar a senha
await pg.query(`INSERT INTO users (username, email, password_hash, secret_hash, terms_version, privacy_version) VALUES ('dudu', 'dudu@gmail.com', $1, 'h', '2026-10-25.1', '2026-10-25.1')`, [await bcrypt.hash('senha-do-dudu-1', 4)]);
f = await begin('google');
assert.equal(loc(await finish('google', f.state, { claims: { sub: 'g-3', email: 'dudu@gmail.com', email_verified: true } })), '/?auth_link=google');
assert.ok(!jar.has('session'), 'não entrou na conta alheia');
assert.ok(jar.get('oauth_pending'), 'vínculo aguardando a senha');
assert.equal((await api('login', { body: { email: 'dudu@gmail.com', password: 'senha-errada-99', linkPending: true } })).statusCode, 401);
assert.equal((await pg.query(`SELECT count(*)::int n FROM oauth_identities WHERE provider_user_id = 'g-3'`)).rows[0].n, 0, 'senha errada não conecta');
let lg = await okJson('login', { body: { email: 'dudu@gmail.com', password: 'senha-do-dudu-1', linkPending: true } });
assert.equal(lg.linked, 'google');
assert.ok(!jar.has('oauth_pending'), 'pendência consumida');
me = (await okJson('profile', { method: 'GET' })).user;
assert.equal(me.signupMethod, 'password', 'origem do cadastro não muda');
assert.deepEqual(me.loginMethods, ['password', 'google'], 'flags dos métodos ativos');
assert.equal((await pg.query(`SELECT email_verified FROM users WHERE username = 'dudu'`)).rows[0].email_verified, true);
// agora o Google entra direto nessa MESMA conta, e o Apple com o mesmo e-mail verificado também se junta a ela
jar.clear();
f = await begin('google');
assert.equal(loc(await finish('google', f.state, { claims: { sub: 'g-3', email: 'dudu@gmail.com', email_verified: true } })), '/');
assert.equal((await okJson('profile', { method: 'GET' })).user.username, 'dudu');
jar.clear();
f = await begin('apple');
assert.equal(loc(await finish('apple', f.state, { post: true, claims: { sub: 'a-dudu', email: 'dudu@gmail.com', email_verified: true } })), '/');
me = (await okJson('profile', { method: 'GET' })).user;
assert.equal(me.username, 'dudu');
assert.deepEqual(me.loginMethods, ['password', 'apple', 'google'], 'três formas de entrar na mesma conta');
assert.equal((await pg.query(`SELECT count(*)::int n FROM users WHERE email = 'dudu@gmail.com'`)).rows[0].n, 1, 'usuário unificado');
await okJson('login', { body: { email: 'dudu@gmail.com', password: 'senha-do-dudu-1' } }); // a senha continua valendo
jar.clear();

// cadastro com senha que nunca confirmou o e-mail (confirmação ligada): quem prova o e-mail pelo provedor fica com a conta,
// e a senha/palavra secreta cadastradas antes (de um possível impostor) deixam de valer
await pg.query(`INSERT INTO users (username, email, password_hash, secret_hash, verification_required) VALUES ('impostor', 'vitima@gmail.com', $1, 'h', true)`, [await bcrypt.hash('senha-do-impostor-1', 4)]);
await api('login', { body: { email: 'vitima@gmail.com', password: 'senha-do-impostor-1' } });
const impCookie = jar.get('session');
jar.clear();
f = await begin('google');
assert.equal(loc(await finish('google', f.state, { claims: { sub: 'g-vitima', email: 'vitima@gmail.com', email_verified: true, name: 'Vitima Real' } })), '/', 'dono real entra direto');
assert.equal((await pg.query(`SELECT count(*)::int n FROM users WHERE email = 'vitima@gmail.com'`)).rows[0].n, 1);
const vit = (await pg.query(`SELECT password_hash, secret_hash, email_verified FROM users WHERE email = 'vitima@gmail.com'`)).rows[0];
assert.deepEqual([vit.password_hash, vit.secret_hash, vit.email_verified], [null, null, true], 'credenciais do impostor apagadas');
jar.clear();
assert.equal((await api('login', { body: { email: 'vitima@gmail.com', password: 'senha-do-impostor-1' } })).statusCode, 401, 'senha do impostor não entra mais');
jar.set('session', impCookie);
assert.equal((await api('profile', { method: 'GET' })).statusCode, 401, 'sessão do impostor encerrada');
jar.clear();

// ---- Apple: POST form_post, nome só na primeira vez, token de atualização cifrado
f = await begin('apple');
assert.equal(f.u.searchParams.get('response_mode'), 'form_post');
r = await finish('apple', f.state, { post: true, claims: { sub: 'a-1', email: 'bia@icloud.com', email_verified: 'true' }, extra: { user: JSON.stringify({ name: { firstName: 'Bia', lastName: 'Souza' } }) } });
assert.equal(loc(r), '/');
assert.match(tokenCalls.at(-1).client_secret, /^eyJ/, 'client secret da Apple é um JWT');
me = (await okJson('profile', { method: 'GET' })).user;
assert.equal(me.username, 'BiaSouza');
assert.equal(me.signupMethod, 'apple');
const stored = (await pg.query(`SELECT refresh_token FROM oauth_identities WHERE provider='apple'`)).rows[0].refresh_token;
assert.ok(stored && !stored.includes('apple-refresh-1'), 'refresh token cifrado');

// conectar Apple a quem já usa Google (modo link) e conflitos
jar.delete('session'); jar.delete('oauth_state');
f = await begin('google'); await finish('google', f.state, { claims: { sub: 'g-1', email: 'ana@gmail.com', email_verified: true } });
await okJson('profile', { body: { action: 'accept_terms', terms: true, privacy: true } });
assert.equal((await begin('apple', { link: '1' })).u.origin, 'https://appleid.apple.com');
f = await begin('apple', { link: '1' });
assert.equal(loc(await finish('apple', f.state, { post: true, claims: { sub: 'a-1', email: 'bia@icloud.com', email_verified: true } })), '/?auth_error=identity_in_use', 'Apple já é de outra conta');
f = await begin('apple', { link: '1' });
assert.equal(loc(await finish('apple', f.state, { post: true, claims: { sub: 'a-2', email: 'ana@icloud.com', email_verified: true } })), '/?auth_notice=linked_apple');
assert.deepEqual((await okJson('profile', { method: 'GET' })).user.connections, ['apple', 'google']);
f = await begin('apple', { link: '1' });
assert.equal(loc(await finish('apple', f.state, { post: true, claims: { sub: 'a-3', email: 'ana@icloud.com', email_verified: true } })), '/?auth_error=already_linked');
// link sem sessão
const keep = jar.get('session'); jar.delete('session');
assert.equal((await begin('apple', { link: '1' })).error, 'session');
jar.set('session', keep);

// desconectar: revoga na Apple e mantém ao menos um método
revoked = []; revokeStatus = 500;
assert.equal((await api('profile', { method: 'POST', body: { action: 'unlink', provider: 'apple' } })).statusCode, 502, 'falha na Apple interrompe');
revokeStatus = 200;
const un = await okJson('profile', { body: { action: 'unlink', provider: 'apple' } });
assert.deepEqual(un.connections, ['google']);
assert.equal(revoked.length, 2); assert.equal(revoked.at(-1).token_type_hint, 'refresh_token');
assert.equal((await api('profile', { method: 'POST', body: { action: 'unlink', provider: 'apple' } })).statusCode, 400);

// ---- excluir conta Apple sem senha: revoga o token
jar.clear();
f = await begin('apple');
await finish('apple', f.state, { post: true, claims: { sub: 'a-1', email: 'bia@icloud.com', email_verified: true } });
revoked = []; revokeStatus = 500;
assert.equal((await api('profile', { method: 'POST', body: { action: 'delete', confirm: 'EXCLUIR' } })).statusCode, 502, 'revogação falhou: não exclui');
assert.equal((await pg.query(`SELECT count(*)::int n FROM users WHERE email='bia@icloud.com'`)).rows[0].n, 1);
revokeStatus = 200;
await okJson('profile', { body: { action: 'delete', confirm: 'EXCLUIR' } });
assert.equal(revoked.at(-1).token, 'apple-refresh-1', 'token decifrado enviado à Apple');
assert.equal((await pg.query(`SELECT count(*)::int n FROM users WHERE email='bia@icloud.com'`)).rows[0].n, 0);
assert.equal((await pg.query(`SELECT count(*)::int n FROM oauth_identities WHERE provider='apple' AND provider_user_id='a-1'`)).rows[0].n, 0, 'identidade apagada em cascata');

// ---- configurações
await pg.query(`INSERT INTO users (username, email, password_hash, secret_hash, role, terms_version, privacy_version) VALUES ('adm','adm@x.com','h','h','admin','2026-10-25.1','2026-10-25.1')`);
jar.clear();
const admId = (await pg.query(`SELECT id FROM users WHERE username='adm'`)).rows[0].id;
const { SignJWT: S } = await import('jose');
jar.set('session', await new S({ v: 0 }).setProtectedHeader({ alg: 'HS256' }).setSubject(admId).setExpirationTime('1h').sign(new TextEncoder().encode(process.env.JWT_SECRET)));
let st = await okJson('settings', { method: 'GET' });
assert.deepEqual(st.login.google, { enabled: true, configured: true, available: true });
await okJson('settings', { body: { setting: 'login_google', enabled: false } });
st = await okJson('settings', { method: 'GET' });
assert.equal(st.login.google.available, false);
assert.deepEqual(await okJson('oauth', { query: { provider: 'providers' } }), { google: false, apple: true });
const savedId = process.env.GOOGLE_CLIENT_ID; delete process.env.GOOGLE_CLIENT_ID;
await okJson('settings', { body: { setting: 'login_google', enabled: true } });
st = await okJson('settings', { method: 'GET' });
assert.deepEqual(st.login.google, { enabled: true, configured: false, available: false }, 'ligado mas sem variáveis');
process.env.GOOGLE_CLIENT_ID = savedId;

// cadastro de usuários (admin): origem e flags de login
let ul = await okJson('profile', { method: 'GET', query: { users: '1' } });
const dudu = ul.users.find((u) => u.username === 'dudu');
assert.deepEqual([dudu.signupMethod, dudu.emailVerified, dudu.loginMethods], ['password', true, ['password', 'apple', 'google']]);
assert.deepEqual([dudu.termsAccepted, dudu.privacyAccepted, ul.users.find((u) => u.username === 'AnaMaria').termsAccepted], [true, true, true]);
assert.equal(ul.users.find((u) => u.username === 'AnaMaria').signupMethod, 'google');
assert.deepEqual((await okJson('profile', { method: 'GET', query: { users: '1', q: 'dud' } })).users.map((u) => u.username), ['dudu']);
assert.equal((await okJson('profile', { method: 'GET', query: { users: '1', q: '%' } })).total, 0, 'curinga é literal');
const adminCookie = jar.get('session'); jar.clear();
f = await begin('google'); await finish('google', f.state, { claims: { sub: 'g-3', email: 'dudu@gmail.com', email_verified: true } });
assert.equal((await api('profile', { method: 'GET', query: { users: '1' } })).statusCode, 403, 'usuário comum não lista cadastros');
jar.clear(); jar.set('session', adminCookie);

// migração 009 pendente: login social fica fora do ar, o resto segue
await pg.query('ALTER TABLE users RENAME COLUMN signup_method TO signup_off');
st = await okJson('settings', { method: 'GET' });
assert.ok(st.setup.missingMigrations.includes('009_signup_method.sql'));
assert.equal(st.login.apple.available, false);
assert.deepEqual(await okJson('oauth', { query: { provider: 'providers' } }), { google: false, apple: false });
assert.equal((await okJson('profile', { method: 'GET', query: { users: '1' } })).users.length > 0, true, 'lista de usuários tolera a 009 pendente');
await pg.query('ALTER TABLE users RENAME COLUMN signup_off TO signup_method');

// migração 008 pendente: tudo segue de pé
await pg.query('ALTER TABLE oauth_identities RENAME TO oauth_off');
st = await okJson('settings', { method: 'GET' });
assert.ok(st.setup.missingMigrations.includes('008_oauth_login.sql'));
assert.deepEqual(await okJson('oauth', { query: { provider: 'providers' } }), { google: false, apple: false });
assert.equal((await okJson('profile', { method: 'GET' })).user.connections.length, 0);

console.log('OAUTH OK');
process.exit(0);
