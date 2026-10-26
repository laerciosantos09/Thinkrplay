// Testes de segurança: confirmação de e-mail, tentativas de SQL injection e painel de partidas suspeitas.
import { build } from 'esbuild';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { SignJWT } from 'jose';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
mkdirSync(path.join(root, 'node_modules/.cache'), { recursive: true });
const out = mkdtempSync(path.join(root, 'node_modules/.cache/sec-test-'));
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

const names = ['auth/register', 'auth/login', 'profile', 'settings', 'ranking', 'play/start'];
await build({
  entryPoints: Object.fromEntries(names.map((n) => [n, path.join(root, 'api', `${n}.ts`)])),
  outdir: out, bundle: true, format: 'esm', platform: 'node', packages: 'external',
  plugins: [{ name: 'db', setup: (b) => b.onResolve({ filter: /(^|\/)db\.js$/ }, () => ({ path: path.join(out, 'db-shim.js') })) }],
});

// Resend falso: guarda os e-mails enviados
let mails = []; let mailStatus = 200;
globalThis.fetch = async (url, init) => {
  if (String(url).includes('api.resend.com')) {
    if (mailStatus !== 200) return new Response('{}', { status: mailStatus });
    mails.push(JSON.parse(init.body)); return new Response('{"id":"x"}', { status: 200 });
  }
  throw new Error(`fetch inesperado: ${url}`);
};
Object.assign(process.env, { JWT_SECRET: 'x'.repeat(40), APP_URL: 'https://app.test', RESEND_API_KEY: 're_test', EMAIL_FROM: 'Thinkrplay <nao-responda@app.test>' });
const h = Object.fromEntries(await Promise.all(names.map(async (n) => [n, (await import(pathToFileURL(path.join(out, `${n}.js`)).href)).default])));

let cookie = '';
const call = async (name, { method, query = {}, body, headers = {} } = {}) => {
  method ??= body ? 'POST' : 'GET';
  const hdrs = {};
  const res = { statusCode: 200, headers: hdrs, setHeader(k, v) { hdrs[k] = v; }, getHeader(k) { return hdrs[k]; }, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; }, end() { return this; } };
  await h[name]({ method, query, body, headers: { host: 'app.test', origin: 'https://app.test', 'content-type': 'application/json', cookie, 'x-forwarded-for': '1.2.3.4', ...headers }, socket: {} }, res);
  const sc = [].concat(res.headers['Set-Cookie'] ?? []).find((c) => c.startsWith('session='));
  if (sc) cookie = sc.split(';')[0];
  return res;
};
const ok = async (...a) => { const r = await call(...a); assert.equal(r.statusCode, 200, JSON.stringify(r.body)); return r.body; };
const code = async (...a) => (await call(...a)).statusCode;
const reg = (u, over = {}) => ({ body: { username: u, email: `${u}@x.com`, password: 'senha-forte-1', secretWord: 'palavra-secreta', acceptTerms: true, acceptPrivacy: true, ...over } });
const setting = (key, enabled) => pg.query(`INSERT INTO app_settings (key, enabled) VALUES ($1,$2) ON CONFLICT (key) DO UPDATE SET enabled=$2`, [key, enabled]);
const tokenFrom = (mail) => new URL(mail.text.match(/https:\/\/\S+/)[0]).searchParams.get('token');
const verifyLink = async (token) => { const r = await call('auth/register', { method: 'GET', query: { action: 'verify', token } }); return r.headers.Location; };

// ---- sem o recurso ligado, o cadastro continua como antes e nenhum e-mail sai
let r = await ok('auth/register', reg('antigo'));
assert.equal(r.user.needsEmailVerification, false);
assert.equal(mails.length, 0);
assert.equal(await code('settings', { method: 'GET' }), 200);
const antigoCookie = cookie;

// ---- ligado: conta nova fica barrada até confirmar; contas antigas não
await setting('email_verification', true);
cookie = '';
r = await ok('auth/register', reg('novo'));
assert.equal(r.user.needsEmailVerification, true);
assert.equal(r.emailSent, true);
assert.equal(mails.length, 1);
assert.deepEqual(mails[0].to, ['novo@x.com']);
const token1 = tokenFrom(mails[0]);
assert.ok(mails[0].text.includes('https://app.test/api/auth/register?action=verify&token='), 'link do app');
const stored = (await pg.query(`SELECT token_hash FROM email_tokens`)).rows;
assert.equal(stored.length, 1);
assert.ok(stored[0].token_hash !== token1 && !stored[0].token_hash.includes(token1), 'o banco guarda só o hash do token');
for (const [name, opts] of [['settings', {}], ['ranking', { query: { game: 'all' } }], ['play/start', { body: { game: 'sudoku', tier: 'easy', challenge: 1 } }]]) {
  const x = await call(name, opts);
  assert.equal(x.statusCode, 403, `${name} barrado sem confirmar`); assert.equal(x.body.code, 'email_unverified');
}
const me = (await ok('profile', { method: 'GET' })).user;
assert.deepEqual([me.emailVerified, me.needsEmailVerification], [false, true], 'o perfil funciona para reenviar/sair');
const novoCookie = cookie;
cookie = antigoCookie;
assert.equal(await code('settings', { method: 'GET' }), 200, 'conta antiga não é barrada quando o recurso é ligado');
cookie = novoCookie;

// ---- reenvio: só o link mais novo vale; limite de 3 por hora
await ok('profile', { body: { action: 'resend_verification' } });
assert.equal(mails.length, 2);
const token2 = tokenFrom(mails[1]);
assert.equal(await verifyLink(token1), '/?auth_error=verify_failed', 'link antigo foi invalidado pelo reenvio');
await ok('profile', { body: { action: 'resend_verification' } });
const token3 = tokenFrom(mails[2]);
assert.equal(await verifyLink(token2), '/?auth_error=verify_failed', 'o segundo foi trocado pelo terceiro');
await ok('profile', { body: { action: 'resend_verification' } });
assert.equal(await code('profile', { body: { action: 'resend_verification' } }), 429, 'limite de reenvios');
assert.equal(mails.length, 4);
assert.equal(await verifyLink('lixo'), '/?auth_error=verify_failed');
assert.equal(await verifyLink("' OR 1=1 --"), '/?auth_error=verify_failed');
assert.equal(await verifyLink(token3), '/?auth_error=verify_failed', 'trocado pelo quarto');
const token4 = tokenFrom(mails[3]);
await pg.query(`UPDATE email_tokens SET expires_at = now() - interval '1 minute' WHERE used_at IS NULL`);
assert.equal(await verifyLink(token4), '/?auth_error=verify_failed', 'expirado');
await pg.query(`DELETE FROM auth_attempts`);
await ok('profile', { body: { action: 'resend_verification' } });
const token5 = tokenFrom(mails.at(-1));

// ---- confirmar: uso único; libera o app e marca o e-mail como verificado
assert.equal(await verifyLink(token5), '/?auth_notice=email_verified');
assert.equal(await verifyLink(token5), '/?auth_error=verify_failed', 'uso único');
assert.equal(await code('settings', { method: 'GET' }), 200, 'liberado');
const me2 = (await ok('profile', { method: 'GET' })).user;
assert.deepEqual([me2.emailVerified, me2.needsEmailVerification], [true, false]);
assert.equal(await code('profile', { body: { action: 'resend_verification' } }), 400, 'já confirmado');

// ---- falha do provedor de e-mail não derruba o cadastro: dá para pedir o reenvio depois
mailStatus = 500; cookie = '';
r = await ok('auth/register', reg('semmail'));
assert.equal(r.emailSent, false); assert.equal(r.user.needsEmailVerification, true);
mailStatus = 200;
await ok('profile', { body: { action: 'resend_verification' } });
// recurso desligado de novo: reenvio indisponível, mas quem já foi barrado... segue barrado até confirmar (conta já exige)
await setting('email_verification', false);
assert.equal(await code('profile', { body: { action: 'resend_verification' } }), 503);

// ---- SQL injection: nada do que o usuário digita vira SQL
const payloads = ["'; DROP TABLE users; --", "' OR '1'='1", "\" OR 1=1 --", "x'); DELETE FROM scores; --", '%', '_', '\\', "admin'--"];
const tablesBefore = (await pg.query(`SELECT count(*)::int n FROM information_schema.tables WHERE table_schema='public'`)).rows[0].n;
const usersBefore = (await pg.query(`SELECT count(*)::int n FROM users`)).rows[0].n;
cookie = '';
for (const p of payloads) {
  assert.notEqual(await code('auth/login', { body: { email: p, password: p } }), 200, `login com ${p}`);
  assert.ok([400, 401].includes(await code('auth/register', reg('inj', { username: p, email: `${p}@x.com` }))), `cadastro com ${p}`);
}
assert.equal((await pg.query(`SELECT count(*)::int n FROM users`)).rows[0].n, usersBefore, 'nenhum usuário criado/apagado');
// e-mail com aspas que passa na validação simples: vira dado, nunca SQL
r = await call('auth/register', reg('aspas', { email: "o'brien@x.com" }));
assert.equal(r.statusCode, 200);
assert.equal((await pg.query(`SELECT email FROM users WHERE username='aspas'`)).rows[0].email, "o'brien@x.com", 'gravado literalmente');
// com sessão: parâmetros de consulta e corpo
await pg.query(`UPDATE users SET terms_version='2026-10-25.1', privacy_version='2026-10-25.1', verification_required=false WHERE username IN ('aspas','antigo')`);
cookie = ''; await ok('auth/login', { body: { email: "o'brien@x.com", password: 'senha-forte-1' } });
for (const p of payloads) {
  assert.equal(await code('ranking', { method: 'GET', query: { game: p } }), 400, 'ranking?game');
  assert.equal(await code('play/start', { body: { game: p, tier: 'easy', challenge: 1 } }), 400, 'play/start game');
  assert.equal(await code('play/start', { body: { game: 'sudoku', tier: p, challenge: 1 } }), 400, 'play/start tier');
  assert.equal(await code('profile', { body: { action: 'username', username: p } }), 400, 'nome de usuário');
  assert.equal(await code('profile', { body: { action: p } }), 400, 'ação');
  assert.equal(await code('profile', { body: { action: 'unlink', provider: p } }), 400, 'provedor');
}
// busca do admin (ILIKE) com payloads
await pg.query(`INSERT INTO users (username, email, password_hash, secret_hash, role, terms_version, privacy_version) VALUES ('adm','adm@x.com','h','h','admin','2026-10-25.1','2026-10-25.1')`);
const admId = (await pg.query(`SELECT id FROM users WHERE username='adm'`)).rows[0].id;
cookie = `session=${await new SignJWT({ v: 0 }).setProtectedHeader({ alg: 'HS256' }).setSubject(admId).setExpirationTime('1h').sign(new TextEncoder().encode(process.env.JWT_SECRET))}`;
for (const p of payloads) {
  const list = await ok('profile', { method: 'GET', query: { users: '1', q: p, page: p } });
  assert.ok(Array.isArray(list.users), `busca com ${p}`);
}
assert.equal((await ok('profile', { method: 'GET', query: { users: '1', q: '%' } })).total, 0, 'curinga é literal');
assert.equal((await ok('profile', { method: 'GET', query: { users: '1', q: "o'brien" } })).total, 1, 'aspas na busca');
assert.equal((await pg.query(`SELECT count(*)::int n FROM information_schema.tables WHERE table_schema='public'`)).rows[0].n, tablesBefore, 'nenhuma tabela apagada');

// ---- partidas suspeitas (só admin; informa, não bloqueia)
const bot = (await pg.query(`INSERT INTO users (username, email, password_hash, secret_hash) VALUES ('robo','robo@x.com','h','h') RETURNING id`)).rows[0].id;
const humano = (await pg.query(`INSERT INTO users (username, email, password_hash, secret_hash) VALUES ('humano','humano@x.com','h','h') RETURNING id`)).rows[0].id;
for (let i = 0; i < 4; i++) await pg.query(`INSERT INTO plays (user_id, game, tier, level, seed, finished_at, pace_ratio) VALUES ($1,'memory','easy',$2,1, now(), 1.1)`, [bot, i + 1]);
for (let i = 0; i < 4; i++) await pg.query(`INSERT INTO plays (user_id, game, tier, level, seed, finished_at, pace_ratio) VALUES ($1,'memory','easy',$2,1, now(), 6)`, [humano, i + 1]);
await pg.query(`INSERT INTO plays (user_id, game, tier, level, seed, finished_at, pace_ratio) VALUES ($1,'memory','easy',9,1, now() - interval '30 days', 1.0), ($1,'memory','easy',10,1, now() - interval '30 days', 1.0), ($1,'memory','easy',11,1, now() - interval '30 days', 1.0)`, [humano]);
let sus = await ok('profile', { method: 'GET', query: { suspicious: '1' } });
assert.equal(sus.available, true);
assert.deepEqual(sus.users.map((u) => [u.username, u.flagged, u.plays]), [['robo', 4, 4]], 'só quem tem ritmo de robô recente');
assert.equal(sus.users[0].bestRatio, 1.1);
cookie = ''; await ok('auth/login', { body: { email: "o'brien@x.com", password: 'senha-forte-1' } });
assert.equal(await code('profile', { method: 'GET', query: { suspicious: '1' } }), 403, 'só administrador');
// migração 012 pendente
cookie = `session=${await new SignJWT({ v: 0 }).setProtectedHeader({ alg: 'HS256' }).setSubject(admId).setExpirationTime('1h').sign(new TextEncoder().encode(process.env.JWT_SECRET))}`;
await pg.query('ALTER TABLE plays RENAME COLUMN pace_ratio TO pace_off');
sus = await ok('profile', { method: 'GET', query: { suspicious: '1' } });
assert.equal(sus.available, false);

console.log('SECURITY OK');
process.exit(0);
