// Teste de integração da API: empacota os handlers com esbuild, troca o driver do Neon por PGlite (Postgres em memória).
import { build } from 'esbuild';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { pathToFileURL, fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
mkdirSync(path.join(root, 'node_modules/.cache'), { recursive: true });
const out = mkdtempSync(path.join(root, 'node_modules/.cache/api-test-'));
const pg = new PGlite();
for (const s of readFileSync(path.join(root, 'db/schema.sql'), 'utf8').split(/;\s*\n/).map((x) => x.trim()).filter(Boolean)) await pg.query(s);

globalThis.__sql = async (strings, ...values) => {
  const text = strings.reduce((acc, s, i) => acc + s + (i < values.length ? `$${i + 1}` : ''), '');
  return (await pg.query(text, values)).rows;
};
globalThis.__pg = pg;

const shim = `export const sql = (...a) => globalThis.__sql(...a);
export const assertDb = () => {};
export class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }`;
writeFileSync(path.join(out, 'db-shim.js'), shim);

const names = ['auth/register', 'auth/login', 'auth/recover', 'auth/me', 'auth/logout', 'play/start', 'play/finish', 'play/guess', 'ranking', 'progress'];
await build({
  entryPoints: Object.fromEntries(names.map((n) => [n, path.join(root, 'api', `${n}.ts`)])),
  outdir: out, bundle: true, format: 'esm', platform: 'node', packages: 'external',
  plugins: [{ name: 'db', setup: (b) => b.onResolve({ filter: /(^|\/)db\.js$/ }, () => ({ path: path.join(out, 'db-shim.js') })) }],
});

process.env.JWT_SECRET = 'x'.repeat(40);
const load = async (n) => (await import(pathToFileURL(path.join(out, `${n}.js`)).href)).default;
const h = Object.fromEntries(await Promise.all(names.map(async (n) => [n, await load(n)])));

// jar de cookies + chamada de handler
let cookie = '';
const call = async (name, { method = 'POST', body, query = {}, headers = {} } = {}) => {
  const res = { headers: {}, statusCode: 200, setHeader(k, v) { this.headers[k] = v; }, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } };
  await h[name]({ method, body, query, headers: { host: 'app.test', 'content-type': 'application/json', cookie, 'x-forwarded-for': '1.2.3.4', ...headers }, socket: {} }, res);
  if (res.headers['Set-Cookie']) cookie = res.headers['Set-Cookie'].split(';')[0].replace(/=$/, '=');
  return res;
};
globalThis.__dbg = true;
const ok = async (...a) => { const r = await call(...a); assert.equal(r.statusCode, 200, JSON.stringify(r.body)); return r.body; };
const code = async (...a) => (await call(...a)).statusCode;
const backdate = (id, secs) => pg.query(`UPDATE plays SET started_at = now() - ($2 || ' seconds')::interval WHERE id = $1`, [id, String(secs)]);

const { generateSudoku } = await import('../lib/sudoku.ts');
const { buildDeck } = await import('../lib/memory.ts');
const { disksForLevel } = await import('../lib/hanoi.ts');
const { generateLights } = await import('../lib/lights.ts');
const { generateSequence } = await import('../lib/sequence.ts');
const { generateCode, configForLevel } = await import('../lib/mastermind.ts');
const { mulberry32 } = await import('../lib/rng.ts');
const { sequenceSeed } = await import('../lib/rounds.ts');

// --- auth
assert.equal(await code('auth/me', { method: 'GET' }), 401);
const reg = await call('auth/register', { body: { username: 'ana', email: 'Ana@x.com', password: 'senha-forte-1', secretWord: 'escola' } });
assert.equal(reg.statusCode, 200);
assert.match(reg.headers['Set-Cookie'], /HttpOnly; SameSite=Strict/);
assert.equal(reg.headers['Set-Cookie'].includes('Secure'), true);
assert.equal(await code('auth/register', { body: { username: 'ANA', email: 'b@x.com', password: 'senha-forte-1', secretWord: 'escola' } }), 409);
assert.equal((await ok('auth/me', { method: 'GET' })).user.username, 'ana');
assert.equal(await code('auth/register', { body: { username: 'bob', email: 'bob@x.com', password: 'curta', secretWord: 'escola' } }), 400);
assert.equal(await code('auth/me', { method: 'GET', headers: { cookie: 'session=forjado' } }), 401);
assert.equal(await code('auth/login', { body: { email: 'a@x.com', password: 'x' }, headers: { origin: 'https://evil.com' } }), 403);
assert.equal(await code('auth/login', { body: { email: 'a@x.com', password: 'x' }, headers: { 'content-type': 'text/plain' } }), 415);

// força bruta: 8 falhas e bloqueia, mesmo com a senha certa
for (let i = 0; i < 8; i++) assert.equal(await code('auth/login', { body: { email: 'ana@x.com', password: 'errada' } }), 401);
assert.equal(await code('auth/login', { body: { email: 'ana@x.com', password: 'senha-forte-1' } }), 429);
assert.equal(await code('auth/recover', { body: { email: 'ana@x.com', secretWord: 'chute', newPassword: 'nova-senha-1' } }), 429);
await pg.query('DELETE FROM auth_attempts');
assert.equal(await code('auth/recover', { body: { email: 'ana@x.com', secretWord: 'chute', newPassword: 'nova-senha-1' } }), 401);
await ok('auth/recover', { body: { email: 'ana@x.com', secretWord: 'ESCOLA', newPassword: 'nova-senha-1' } });
await ok('auth/login', { body: { email: 'ana@x.com', password: 'nova-senha-1' } });

// --- níveis bloqueados
assert.equal(await code('play/start', { body: { game: 'sudoku', level: 2 } }), 403);
assert.equal(await code('play/start', { body: { game: 'xadrez', level: 1 } }), 400);

// --- Sudoku: prova errada, rápida demais, certa, reenvio
let p = await ok('play/start', { body: { game: 'sudoku', level: 1 } });
const sud = generateSudoku(mulberry32(p.seed), 1);
assert.equal(await code('play/finish', { body: { playId: p.playId, proof: { board: sud.puzzle } } }), 422);
assert.equal(await code('play/finish', { body: { playId: p.playId, proof: { board: sud.solution } } }), 422, 'rápida demais');
await backdate(p.playId, 600);
const fin = await ok('play/finish', { body: { playId: p.playId, proof: { board: sud.solution } } });
assert.ok(fin.points >= 20 && fin.unlocked === 2);
assert.equal(await code('play/finish', { body: { playId: p.playId, proof: { board: sud.solution } } }), 409, 'reenvio');
assert.equal(await code('play/start', { body: { game: 'sudoku', level: 2 } }), 200, 'nível 2 liberado');
// corrida: duas conclusões simultâneas, só uma pontua
p = await ok('play/start', { body: { game: 'sudoku', level: 1 } });
await backdate(p.playId, 600);
const s2 = generateSudoku(mulberry32(p.seed), 1);
const race = await Promise.all([1, 2, 3].map(() => code('play/finish', { body: { playId: p.playId, proof: { board: s2.solution } } })));
assert.equal(race.filter((c) => c === 200).length, 1, `corrida: ${race}`);
assert.equal((await pg.query(`SELECT count(*)::int n FROM scores WHERE game='sudoku'`)).rows[0].n, 2);

// --- Memória
p = await ok('play/start', { body: { game: 'memory', level: 1 } });
const deck = buildDeck(p.seed, 1);
const flips = []; const seen = new Set();
deck.forEach((e, i) => { if (seen.has(e)) return; seen.add(e); flips.push([i, deck.indexOf(e, i + 1)]); });
await backdate(p.playId, 600);
assert.equal(await code('play/finish', { body: { playId: p.playId, proof: { flips: flips.slice(1) } } }), 422);
assert.equal((await ok('play/finish', { body: { playId: p.playId, proof: { flips } } })).points, 152 - 0);

// --- Hanói (ilegal x legal)
p = await ok('play/start', { body: { game: 'hanoi', level: 1 } });
await backdate(p.playId, 600);
assert.equal(await code('play/finish', { body: { playId: p.playId, proof: { moves: [[0, 2], [0, 2], [0, 2], [0, 1], [0, 1], [0, 1], [0, 1]] } } }), 422);
const moves = []; const hn = (n, a, b, c) => { if (!n) return; hn(n - 1, a, c, b); moves.push([a, b]); hn(n - 1, c, b, a); };
hn(disksForLevel(1), 0, 2, 1);
assert.ok((await ok('play/finish', { body: { playId: p.playId, proof: { moves } } })).points > 0);

// --- Luzes (solução = repetir os toques que geraram o tabuleiro; aqui basta provar que um toque aleatório não vale)
p = await ok('play/start', { body: { game: 'lights', level: 1 } });
await backdate(p.playId, 600);
assert.equal(await code('play/finish', { body: { playId: p.playId, proof: { taps: [[0, 0]] } } }), 422);
const L = generateLights(mulberry32(p.seed), 1);
// força bruta no cliente de teste: testa todos os subconjuntos de 3x3
let solved = null;
for (let mask = 1; mask < 512 && !solved; mask++) {
  const taps = []; for (let i = 0; i < 9; i++) if (mask & (1 << i)) taps.push([Math.floor(i / 3), i % 3]);
  const r = await call('play/finish', { body: { playId: p.playId, proof: { taps } } });
  if (r.statusCode === 200) solved = r.body;
}
assert.ok(solved && solved.points > 0, 'lights resolvido');

// --- Sequências: resposta nunca vem no start
p = await ok('play/start', { body: { game: 'sequence', level: 1 } });
assert.equal(p.seed, undefined);
assert.ok(!JSON.stringify(p).includes('answer'));
const seedRow = (await pg.query('SELECT seed FROM plays WHERE id=$1', [p.playId])).rows[0].seed;
assert.equal(await code('play/guess', { body: { playId: p.playId, value: 99999 } }), 400);
for (let round = 0; round < 3; round++) {
  const puz = generateSequence(mulberry32(sequenceSeed(seedRow, round)), 1);
  if (round === 0) {
    const wrong = puz.options.find((o) => o !== puz.answer);
    assert.equal((await ok('play/guess', { body: { playId: p.playId, value: wrong } })).correct, false);
  }
  if (round === 2) await backdate(p.playId, 600);
  const r = await ok('play/guess', { body: { playId: p.playId, value: puz.answer } });
  assert.equal(r.correct, true);
  if (round === 2) { assert.equal(r.done, true); assert.equal(r.points, 102 - 20); }
}

// --- Código secreto: feedback do servidor, código só aparece ao perder
p = await ok('play/start', { body: { game: 'mastermind', level: 1 } });
assert.equal(p.seed, undefined);
const mseed = (await pg.query('SELECT seed FROM plays WHERE id=$1', [p.playId])).rows[0].seed;
const secret = generateCode(mulberry32(mseed), 1);
const cfg = configForLevel(1);
assert.equal(await code('play/guess', { body: { playId: p.playId, guess: [9, 9, 9] } }), 400);
const wrongGuess = secret.map((c) => (c + 1) % cfg.colors);
const first = await ok('play/guess', { body: { playId: p.playId, guess: wrongGuess } });
assert.equal(first.code, undefined);
await backdate(p.playId, 600);
const won = await ok('play/guess', { body: { playId: p.playId, guess: secret } });
assert.equal(won.won, true); assert.ok(won.points > 0);
// perder revela o código e não pontua
p = await ok('play/start', { body: { game: 'mastermind', level: 1 } });
const sd = (await pg.query('SELECT seed FROM plays WHERE id=$1', [p.playId])).rows[0].seed;
const sec2 = generateCode(mulberry32(sd), 1);
let last;
for (let i = 0; i < 10; i++) last = await ok('play/guess', { body: { playId: p.playId, guess: sec2.map((c) => (c + 1) % cfg.colors) } });
assert.deepEqual(last.code, sec2); assert.equal(last.won, false);
assert.equal(await code('play/guess', { body: { playId: p.playId, guess: sec2 } }), 409);

// --- partida de outro usuário / ranking / progresso
const anaCookie = cookie; cookie = '';
await ok('auth/register', { body: { username: 'bia', email: 'bia@x.com', password: 'senha-forte-2', secretWord: 'escola' } });
assert.equal(await code('play/guess', { body: { playId: p.playId, guess: sec2 } }), 404);
cookie = anaCookie;
const rank = await ok('ranking', { method: 'GET', query: { game: 'sudoku' } });
assert.equal(rank.daily[0].username, 'ana');
assert.ok(Object.keys(await ok('progress', { method: 'GET' })).includes('sudoku'));
await ok('auth/logout');

// --- admin criado pelo script (SQL gerado só com hashes) e login pela API
const { execFileSync } = await import('node:child_process');
const gen = (password) => execFileSync('node', [path.join(root, 'scripts/create-admin.mjs'), '--sql'], {
  env: { ...process.env, ADMIN_EMAIL: 'Admin@Teste.com', ADMIN_USERNAME: 'chefe', ADMIN_PASSWORD: password }, encoding: 'utf8' });
const sqlOut = gen('Senha-Teste-1@');
assert.ok(!sqlOut.includes('Senha-Teste-1@'), 'SQL não pode conter a senha em texto');
assert.match(sqlOut, /'\$2[aby]\$11\$/, 'senha deve estar em bcrypt');
await pg.exec(sqlOut);
const stored = (await pg.query(`SELECT password_hash, secret_hash, role FROM users WHERE lower(email)='admin@teste.com'`)).rows[0];
assert.equal(stored.role, 'admin');
assert.ok(stored.password_hash.startsWith('$2') && !stored.password_hash.includes('Senha-Teste'));
cookie = '';
const adminLogin = await ok('auth/login', { body: { email: 'admin@teste.com', password: 'Senha-Teste-1@' } });
assert.equal(adminLogin.user.role, 'admin');
assert.equal(await code('auth/login', { body: { email: 'admin@teste.com', password: 'errada-123' } }), 401);
// rodar de novo troca a senha e mantém um único usuário
await pg.exec(gen('Outra-Senha-2@'));
assert.equal((await pg.query(`SELECT count(*)::int n FROM users WHERE lower(email)='admin@teste.com'`)).rows[0].n, 1);
await pg.query(`DELETE FROM auth_attempts`);
assert.equal(await code('auth/login', { body: { email: 'admin@teste.com', password: 'Senha-Teste-1@' } }), 401);
await ok('auth/login', { body: { email: 'admin@teste.com', password: 'Outra-Senha-2@' } });
// usuário comum nunca vira admin pelo cadastro
assert.equal((await pg.query(`SELECT role FROM users WHERE username='ana'`)).rows[0].role, 'user');

console.log('API OK');
process.exit(0);
