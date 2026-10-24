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
const { buildDeck, pairsFor } = await import('../lib/memory.ts');
const { generateHanoi, moveDisk } = await import('../lib/hanoi.ts');
const { generateLights } = await import('../lib/lights.ts');
const { generateSequence } = await import('../lib/sequence.ts');
const { generateCode, configFor } = await import('../lib/mastermind.ts');
const { mulberry32 } = await import('../lib/rng.ts');
const { sequenceSeed } = await import('../lib/rounds.ts');

const start = (game, tier, challenge) => call('play/start', { body: { game, tier, challenge } });
const seedOf = async (playId) => (await pg.query('SELECT seed FROM plays WHERE id=$1', [playId])).rows[0].seed;
const progressOf = async () => await ok('progress', { method: 'GET' });
const scoreCount = async (game) => (await pg.query(`SELECT count(*)::int n FROM scores WHERE game=$1`, [game])).rows[0].n;

// resolve um desafio de Memória (o teste conhece o baralho pela semente)
const solveMemory = async (tier, challenge) => {
  const p = await ok('play/start', { body: { game: 'memory', tier, challenge } });
  const deck = buildDeck(p.seed, tier, challenge);
  assert.equal(deck.length, pairsFor(tier, challenge) * 2, 'tamanho do baralho segue o tier');
  const flips = []; const seen = new Set();
  deck.forEach((e, i) => { if (seen.has(e)) return; seen.add(e); flips.push([i, deck.indexOf(e, i + 1)]); });
  await backdate(p.playId, 600);
  return ok('play/finish', { body: { playId: p.playId, proof: { flips } } });
};

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

// --- validações de entrada e bloqueios
assert.equal(await code('play/start', { body: { game: 'xadrez', tier: 'easy', challenge: 1 } }), 400);
assert.equal(await code('play/start', { body: { game: 'memory', tier: 'insane', challenge: 1 } }), 400);
assert.equal(await code('play/start', { body: { game: 'memory', tier: 'easy', challenge: 501 } }), 400);
assert.equal(await code('play/start', { body: { game: 'memory', tier: 'easy', challenge: 2 } }), 403, 'desafio 2 só após resolver o 1');
const lockedMedium = await start('memory', 'medium', 1);
assert.equal(lockedMedium.statusCode, 403);
assert.match(lockedMedium.body.error, /10 desafios/);
assert.equal(await code('play/start', { body: { game: 'memory', tier: 'hard', challenge: 1 } }), 403);
assert.deepEqual(await progressOf(), {}, 'todos começam sem progresso (Easy)');

// --- Sudoku easy #1: prova errada, rápida demais, certa, reenvio, replay sem pontos, corrida
let p = await ok('play/start', { body: { game: 'sudoku', tier: 'easy', challenge: 1 } });
assert.equal(p.scored, true);
const sud = generateSudoku(mulberry32(p.seed), 'easy', 1);
assert.equal(await code('play/finish', { body: { playId: p.playId, proof: { board: sud.puzzle } } }), 422);
assert.equal(await code('play/finish', { body: { playId: p.playId, proof: { board: sud.solution } } }), 422, 'rápida demais');
await backdate(p.playId, 600);
const fin = await ok('play/finish', { body: { playId: p.playId, proof: { board: sud.solution } } });
assert.equal(fin.awarded, true); assert.ok(fin.points >= 20);
assert.deepEqual(fin.progress, { easy: 1, medium: 0, hard: 0 });
assert.equal(await code('play/finish', { body: { playId: p.playId, proof: { board: sud.solution } } }), 409, 'reenvio');
// replay do mesmo desafio: resolve, mas não pontua nem avança
p = await ok('play/start', { body: { game: 'sudoku', tier: 'easy', challenge: 1 } });
assert.equal(p.scored, false);
await backdate(p.playId, 600);
const replay = await ok('play/finish', { body: { playId: p.playId, proof: { board: generateSudoku(mulberry32(p.seed), 'easy', 1).solution } } });
assert.equal(replay.awarded, false); assert.equal(replay.points, 0); assert.equal(replay.progress.easy, 1);
assert.equal(await scoreCount('sudoku'), 1, 'repetição não gera pontuação');
// corrida: duas partidas do desafio 2 abertas ao mesmo tempo; só uma avança/pontua
const [a1, a2] = [await ok('play/start', { body: { game: 'sudoku', tier: 'easy', challenge: 2 } }), await ok('play/start', { body: { game: 'sudoku', tier: 'easy', challenge: 2 } })];
await backdate(a1.playId, 600); await backdate(a2.playId, 600);
const sol2 = (pl) => ({ board: generateSudoku(mulberry32(pl.seed), 'easy', 2).solution });
const results = await Promise.all([a1, a2].map((pl) => call('play/finish', { body: { playId: pl.playId, proof: sol2(pl) } })));
assert.equal(results.filter((r) => r.statusCode === 200 && r.body.awarded).length, 1, 'só um conta');
assert.equal((await progressOf()).sudoku.easy, 2);
assert.equal(await scoreCount('sudoku'), 2);
// o mesmo desafio é sempre o mesmo puzzle; outro usuário/partida recebe a mesma semente
const again = await ok('play/start', { body: { game: 'sudoku', tier: 'easy', challenge: 2 } });
assert.equal(again.seed, a1.seed, 'desafio tem semente fixa');

// --- Memória: libera Medium ao resolver 10 no Easy, e Hard ao resolver 20 no Medium
for (let n = 1; n <= 9; n++) await solveMemory('easy', n);
assert.equal((await start('memory', 'medium', 1)).statusCode, 403, 'com 9 resolvidos ainda bloqueado');
const tenth = await solveMemory('easy', 10);
assert.equal(tenth.progress.easy, 10);
assert.equal((await start('memory', 'medium', 1)).statusCode, 200, 'medium liberado com 10');
assert.equal((await start('memory', 'medium', 2)).statusCode, 403, 'medium também abre em sequência');
assert.equal((await start('memory', 'hard', 1)).statusCode, 403);
assert.equal((await start('sudoku', 'medium', 1)).statusCode, 403, 'a liberação é por jogo');
for (let n = 1; n <= 19; n++) await solveMemory('medium', n);
assert.equal((await start('memory', 'hard', 1)).statusCode, 403, 'com 19 no medium ainda bloqueado');
const m20 = await solveMemory('medium', 20);
assert.equal(m20.progress.medium, 20);
assert.equal((await start('memory', 'hard', 1)).statusCode, 200, 'hard liberado com 20 no medium');
const hardRun = await solveMemory('hard', 1);
assert.ok(hardRun.points > tenth.points, 'hard vale mais pontos que easy');
assert.equal(await scoreCount('memory'), 10 + 20 + 1);

// --- Hanói: clássico (#1) e um desafio embaralhado (#2), resolvendo a partir do estado dado
const solveHanoi = (puzzle) => {
  let pegs = puzzle.pegs; const moves = [];
  const go = (disk, to) => {
    if (disk === 0) return;
    const from = pegs.findIndex((peg) => peg.includes(disk));
    if (from === to) return go(disk - 1, to);
    go(disk - 1, 3 - from - to);
    pegs = moveDisk(pegs, from, to); moves.push([from, to]);
    go(disk - 1, to);
  };
  go(puzzle.disks, puzzle.goal);
  return moves;
};
for (const n of [1, 2]) {
  p = await ok('play/start', { body: { game: 'hanoi', tier: 'easy', challenge: n } });
  const puzzle = generateHanoi(mulberry32(p.seed), 'easy', n);
  await backdate(p.playId, 600);
  assert.equal(await code('play/finish', { body: { playId: p.playId, proof: { moves: [[0, 1]] } } }), 422);
  const r = await ok('play/finish', { body: { playId: p.playId, proof: { moves: solveHanoi(puzzle) } } });
  assert.ok(r.awarded && r.points > 0);
}

// --- Luzes (#1 é 3x3: força bruta nos 512 subconjuntos de toques)
p = await ok('play/start', { body: { game: 'lights', tier: 'easy', challenge: 1 } });
await backdate(p.playId, 600);
assert.equal(await code('play/finish', { body: { playId: p.playId, proof: { taps: [[0, 0]] } } }), 422);
let solved = null;
for (let mask = 1; mask < 512 && !solved; mask++) {
  const taps = []; for (let i = 0; i < 9; i++) if (mask & (1 << i)) taps.push([Math.floor(i / 3), i % 3]);
  const r = await call('play/finish', { body: { playId: p.playId, proof: { taps } } });
  if (r.statusCode === 200) solved = r.body;
}
assert.ok(solved && solved.awarded, 'lights resolvido');

// --- Sequências: resposta e semente nunca vêm no start
p = await ok('play/start', { body: { game: 'sequence', tier: 'easy', challenge: 1 } });
assert.equal(p.seed, undefined);
assert.ok(!JSON.stringify(p).includes('answer'));
const sseed = await seedOf(p.playId);
assert.equal(await code('play/guess', { body: { playId: p.playId, value: 99999 } }), 400);
for (let round = 0; round < 3; round++) {
  const puz = generateSequence(mulberry32(sequenceSeed(sseed, round)), 'easy', 1);
  if (round === 0) assert.equal((await ok('play/guess', { body: { playId: p.playId, value: puz.options.find((o) => o !== puz.answer) } })).correct, false);
  if (round === 2) await backdate(p.playId, 600);
  const r = await ok('play/guess', { body: { playId: p.playId, value: puz.answer } });
  assert.equal(r.correct, true);
  if (round === 2) { assert.equal(r.done, true); assert.equal(r.awarded, true); assert.equal(r.points, 100 + 0 - 20); }
}

// --- Código Secreto: feedback do servidor; o código só aparece ao perder
p = await ok('play/start', { body: { game: 'mastermind', tier: 'easy', challenge: 1 } });
assert.equal(p.seed, undefined);
const cfg = configFor('easy', 1);
const secret = generateCode(mulberry32(await seedOf(p.playId)), 'easy', 1);
assert.equal(await code('play/guess', { body: { playId: p.playId, guess: [9, 9, 9, 9] } }), 400);
const first = await ok('play/guess', { body: { playId: p.playId, guess: secret.map((c) => (c + 1) % cfg.colors) } });
assert.equal(first.code, undefined);
await backdate(p.playId, 600);
const won = await ok('play/guess', { body: { playId: p.playId, guess: secret } });
assert.equal(won.won, true); assert.equal(won.awarded, true); assert.ok(won.points > 0);
p = await ok('play/start', { body: { game: 'mastermind', tier: 'easy', challenge: 2 } });
const sec2 = generateCode(mulberry32(await seedOf(p.playId)), 'easy', 2);
let last;
for (let i = 0; i < cfg.attempts; i++) last = await ok('play/guess', { body: { playId: p.playId, guess: sec2.map((c) => (c + 1) % cfg.colors) } });
assert.deepEqual(last.code, sec2); assert.equal(last.won, false);
assert.equal(await code('play/guess', { body: { playId: p.playId, guess: sec2 } }), 409);
assert.equal((await progressOf()).mastermind.easy, 1, 'perder não avança');

// --- partida de outro usuário / ranking / progresso por tier
const anaCookie = cookie; cookie = '';
await ok('auth/register', { body: { username: 'bia', email: 'bia@x.com', password: 'senha-forte-2', secretWord: 'escola' } });
assert.equal(await code('play/guess', { body: { playId: p.playId, guess: sec2 } }), 404);
assert.deepEqual(await progressOf(), {}, 'outro usuário começa do zero');
assert.equal((await start('memory', 'medium', 1)).statusCode, 403, 'progresso é por usuário');
cookie = anaCookie;
const rank = await ok('ranking', { method: 'GET', query: { game: 'memory' } });
assert.equal(rank.daily[0].username, 'ana');
assert.equal(rank.daily[0].solved, 31, 'ranking conta desafios resolvidos (sem repetições)');
const prog = await progressOf();
assert.deepEqual(prog.memory, { easy: 10, medium: 20, hard: 1 });
await ok('auth/logout');

// --- erros de configuração não vazam para o cliente
const saved = process.env.JWT_SECRET;
process.env.JWT_SECRET = 'curto';
const leaked = await call('auth/me', { method: 'GET', headers: { cookie: 'session=x' } });
assert.equal(leaked.statusCode, 401);
const cfgErr = await call('auth/register', { body: { username: 'zed', email: 'zed@x.com', password: 'senha-forte-3', secretWord: 'escola' } });
assert.equal(cfgErr.statusCode, 500);
assert.ok(!/JWT|SECRET|segredo/i.test(JSON.stringify(cfgErr.body)), `vazou: ${JSON.stringify(cfgErr.body)}`);
process.env.JWT_SECRET = saved;
await pg.query(`DELETE FROM users WHERE username='zed'`);

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
