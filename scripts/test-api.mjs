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
export class HttpError extends Error { constructor(status, message, expose = false, extra) { super(message); this.status = status; this.expose = expose; this.extra = extra; } }`;
writeFileSync(path.join(out, 'db-shim.js'), shim);

const names = ['auth/register', 'auth/login', 'auth/recover', 'profile', 'billing', 'play/start', 'play/finish', 'play/guess', 'ranking', 'progress', 'settings'];
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
assert.equal(await code('profile', { method: 'GET' }), 401);
const reg = await call('auth/register', { body: { username: 'ana', email: 'Ana@x.com', password: 'senha-forte-1', secretWord: 'escola', acceptTerms: true } });
assert.equal(reg.statusCode, 200);
assert.match(reg.headers['Set-Cookie'], /HttpOnly; SameSite=Strict/);
assert.equal(reg.headers['Set-Cookie'].includes('Secure'), true);
assert.equal(await code('auth/register', { body: { username: 'ANA', email: 'b@x.com', password: 'senha-forte-1', secretWord: 'escola', acceptTerms: true } }), 409);
assert.equal((await ok('profile', { method: 'GET' })).user.username, 'ana');
assert.equal(await code('auth/register', { body: { username: 'bob', email: 'bob@x.com', password: 'curta', secretWord: 'escola', acceptTerms: true } }), 400);
assert.equal(await code('profile', { method: 'GET', headers: { cookie: 'session=forjado' } }), 401);
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
await ok('auth/register', { body: { username: 'bia', email: 'bia@x.com', password: 'senha-forte-2', secretWord: 'escola', acceptTerms: true } });
assert.equal(await code('play/guess', { body: { playId: p.playId, guess: sec2 } }), 404);
assert.deepEqual(await progressOf(), {}, 'outro usuário começa do zero');
assert.equal((await start('memory', 'medium', 1)).statusCode, 403, 'progresso é por usuário');
cookie = anaCookie;
const rank = await ok('ranking', { method: 'GET', query: { game: 'memory' } });
assert.equal(rank.daily[0].username, 'ana');
assert.equal(rank.daily[0].solved, 31, 'ranking conta desafios resolvidos (sem repetições)');
const prog = await progressOf();
assert.deepEqual(prog.memory, { easy: 10, medium: 20, hard: 1 });
await ok('profile', { body: { action: 'logout' } });

// --- erros de configuração não vazam para o cliente
const saved = process.env.JWT_SECRET;
process.env.JWT_SECRET = 'curto';
const leaked = await call('profile', { method: 'GET', headers: { cookie: 'session=x' } });
assert.equal(leaked.statusCode, 401);
const cfgErr = await call('auth/register', { body: { username: 'zed', email: 'zed@x.com', password: 'senha-forte-3', secretWord: 'escola', acceptTerms: true } });
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

// --- configurações de jogos (somente admin altera; todos os logados veem)
const adminCookie = cookie;
assert.equal(await code('settings', { method: 'GET', headers: { cookie: '' } }), 401, 'precisa estar logado');
const list0 = await ok('settings', { method: 'GET' });
assert.equal(list0.games.length, 6);
assert.ok(list0.games.every((g) => g.enabled), 'tudo habilitado por padrão');
cookie = anaCookie; // usuário comum
assert.equal((await ok('settings', { method: 'GET' })).games.length, 6);
assert.equal(await code('settings', { body: { game: 'memory', enabled: false } }), 403, 'usuário comum não altera');
const inflight = await ok('play/start', { body: { game: 'memory', tier: 'easy', challenge: 11 } }); // partida em andamento
cookie = adminCookie;
assert.equal(await code('settings', { body: { game: 'xadrez', enabled: false } }), 400);
assert.equal(await code('settings', { body: { game: 'memory', enabled: 'nao' } }), 400);
const off = await ok('settings', { body: { game: 'memory', enabled: false } });
assert.equal(off.games.find((g) => g.slug === 'memory').enabled, false);
assert.ok(off.games.find((g) => g.slug === 'memory').updatedAt, 'registra quando foi alterado');
assert.equal(off.games.filter((g) => g.enabled).length, 5, 'só o memory foi desativado');
cookie = anaCookie;
const blockedStart = await start('memory', 'easy', 11);
assert.equal(blockedStart.statusCode, 403);
assert.match(blockedStart.body.error, /desativado/);
assert.equal((await start('sudoku', 'easy', 1)).statusCode, 200, 'os outros jogos seguem funcionando');
assert.equal(await code('play/finish', { body: { playId: inflight.playId, proof: { flips: [[0, 1]] } } }), 403, 'partida em andamento também é bloqueada');
cookie = adminCookie;
assert.equal((await ok('settings', { body: { game: 'memory', enabled: true } })).games.every((g) => g.enabled), true);
cookie = anaCookie;
assert.equal((await start('memory', 'easy', 11)).statusCode, 200, 'reabilitado volta a funcionar');
assert.equal(await code('play/finish', { body: { playId: inflight.playId, proof: { flips: [[0, 1]] } } }), 422, 'passa do bloqueio (prova inválida)');
// o perfil é conferido no banco: rebaixar o admin vale na hora, mesmo com o token antigo
await pg.query(`UPDATE users SET role='user' WHERE lower(email)='admin@teste.com'`);
cookie = adminCookie;
assert.equal(await code('settings', { body: { game: 'memory', enabled: false } }), 403, 'ex-admin perde o acesso imediatamente');

// --- Termos no cadastro e nomes reservados
const reg2 = (over) => ({ body: { username: 'novo', email: 'novo@x.com', password: 'senha-forte-9', secretWord: 'escola', acceptTerms: true, ...over } });
cookie = '';
assert.equal(await code('auth/register', reg2({ acceptTerms: undefined })), 400, 'sem aceitar os termos');
assert.equal(await code('auth/register', reg2({ acceptTerms: 'true' })), 400, 'aceite precisa ser booleano true');
assert.equal(await code('auth/register', reg2({ username: 'Admin' })), 400, 'nome reservado');
assert.equal(await code('auth/register', reg2({ username: 'x@y.com' })), 400, 'username não pode ser e-mail');

// --- Perfil: nome de usuário único
await ok('auth/register', reg2({ username: 'carla', email: 'carla@x.com', password: 'senha-forte-4' }));
const carlaOld = cookie;
const me1 = await ok('profile', { method: 'GET' });
assert.equal(me1.user.email, 'carla@x.com'); assert.equal(me1.user.needsTerms, false);
assert.ok(!/hash/i.test(JSON.stringify(me1)), 'perfil nunca expõe hashes');
for (const bad of ['a b', 'ab', 'x@y.com', 'a'.repeat(25)]) assert.equal(await code('profile', { body: { action: 'username', username: bad } }), 400, bad);
assert.equal(await code('profile', { body: { action: 'username', username: 'ADMIN' } }), 400, 'reservado');
assert.equal(await code('profile', { body: { action: 'username', username: 'carla' } }), 400, 'igual ao atual');
assert.equal(await code('profile', { body: { action: 'username', username: 'ANA' } }), 409, 'já em uso (sem diferenciar maiúsculas)');
assert.equal((await ok('profile', { body: { action: 'username', username: 'Carla.M' } })).user.username, 'Carla.M');
assert.equal((await ok('profile', { body: { action: 'username', username: 'carla.m' } })).user.username, 'carla.m', 'trocar só maiúsculas é permitido');
assert.equal(await code('profile', { body: { action: 'xyz' } }), 400);
assert.equal(await code('profile', { method: 'GET', headers: { cookie: '' } }), 401);

// --- Trocar senha: exige a atual, encerra os outros dispositivos, mantém este
assert.equal(await code('profile', { body: { action: 'password', currentPassword: 'errada-123', newPassword: 'nova-senha-4' } }), 403, 'senha atual errada não desloga (403)');
assert.equal(await code('profile', { body: { action: 'password', currentPassword: 'senha-forte-4', newPassword: 'senha-forte-4' } }), 400, 'igual à atual');
assert.equal(await code('profile', { body: { action: 'password', currentPassword: 'senha-forte-4', newPassword: 'curta' } }), 400);
await pg.query('DELETE FROM auth_attempts');
const thisDevice = cookie;
cookie = ''; await ok('auth/login', { body: { email: 'carla@x.com', password: 'senha-forte-4' } });
const otherDevice = cookie;
cookie = thisDevice;
await ok('profile', { body: { action: 'password', currentPassword: 'senha-forte-4', newPassword: 'nova-senha-4' } });
await ok('profile', { method: 'GET' }); // este dispositivo continua logado (token novo)
cookie = otherDevice; assert.equal(await code('profile', { method: 'GET' }), 401, 'outro dispositivo foi deslogado');
cookie = carlaOld; assert.equal(await code('profile', { method: 'GET' }), 401, 'token antigo não vale mais');
cookie = ''; assert.equal(await code('auth/login', { body: { email: 'carla@x.com', password: 'senha-forte-4' } }), 401, 'senha antiga não entra');
await ok('auth/login', { body: { email: 'carla@x.com', password: 'nova-senha-4' } });
const carla = cookie;
assert.ok(!(await pg.query(`SELECT password_hash FROM users WHERE username='carla.m'`)).rows[0].password_hash.includes('nova-senha'), 'senha só em hash');
// redefinir pela palavra secreta também derruba as sessões abertas
await ok('auth/recover', { body: { email: 'carla@x.com', secretWord: 'escola', newPassword: 'recuperada-4' } });
assert.equal(await code('profile', { method: 'GET' }), 401, 'recuperar senha encerra sessões');
await ok('auth/login', { body: { email: 'carla@x.com', password: 'recuperada-4' } });

// --- Aceite dos termos (usuários antigos ou nova versão)
await pg.query(`UPDATE users SET terms_version = NULL, terms_accepted_at = NULL WHERE username = 'carla.m'`);
assert.equal((await ok('profile', { method: 'GET' })).user.needsTerms, true);
assert.equal((await ok('profile', { body: { action: 'accept_terms' } })).user.needsTerms, false);
assert.ok((await pg.query(`SELECT terms_accepted_at FROM users WHERE username='carla.m'`)).rows[0].terms_accepted_at, 'registra quando aceitou');

// --- Rankings: geral (all) e por jogo, posição do próprio usuário e atualização a cada desafio
const fakeHash = '$2b$11$' + 'x'.repeat(53);
for (let i = 1; i <= 11; i++) {
  const u = (await pg.query(`INSERT INTO users (username,email,password_hash,secret_hash) VALUES ($1,$2,$3,$3) RETURNING id`, [`rk${i}`, `rk${i}@x.com`, fakeHash])).rows[0].id;
  await pg.query(`INSERT INTO scores (user_id, game, tier, points, level) VALUES ($1,'sudoku','easy',$2,1), ($1,'hanoi','easy',$2,1)`, [u, 20000 + i * 10]);
}
cookie = anaCookie;
const allBefore = await ok('ranking', { method: 'GET', query: { game: 'all' } });
assert.equal(allBefore.daily.filter((r) => !r.isMe).length, 10, 'top 10');
assert.deepEqual(allBefore.daily.slice(0, 10).map((r) => r.position), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
assert.equal(allBefore.daily[0].username, 'rk11', 'maior pontuação em primeiro');
const meRow = allBefore.daily.find((r) => r.isMe);
assert.ok(meRow && meRow.username === 'ana' && meRow.position > 10, 'a posição do usuário vem junto, mesmo fora do top 10');
assert.equal(allBefore.yearly.find((r) => r.isMe).position, meRow.position);
const anaSudoku = await ok('ranking', { method: 'GET', query: { game: 'sudoku' } });
assert.ok(anaSudoku.daily.find((r) => r.isMe).position > 10);
cookie = ''; // sem login: só o top, sem linha do usuário
const anon = await ok('ranking', { method: 'GET', query: { game: 'all' } });
assert.equal(anon.daily.length, 10); assert.ok(anon.daily.every((r) => !r.isMe));
assert.equal(await code('ranking', { method: 'GET', query: { game: 'xadrez' } }), 400);
// concluir um desafio atualiza o ranking na hora (geral e do jogo), sem nenhum cache
cookie = anaCookie;
const hardNext = await solveMemory('hard', 2);
const allAfter = await ok('ranking', { method: 'GET', query: { game: 'all' } });
const meAfter = allAfter.daily.find((r) => r.isMe);
assert.equal(meAfter.score, meRow.score + hardNext.points, 'ranking geral somou os pontos do desafio');
assert.equal(meAfter.solved, meRow.solved + 1);
const memAfter = (await ok('ranking', { method: 'GET', query: { game: 'memory' } })).daily.find((r) => r.isMe);
assert.equal(memAfter.solved, 32);
// o geral soma todos os jogos: ana pontuou em vários
assert.ok(meAfter.score > memAfter.score);
// username novo aparece no ranking
await pg.query(`INSERT INTO scores (user_id, game, tier, points, level) SELECT id, 'lights', 'easy', 99999, 1 FROM users WHERE username = 'carla.m'`);
assert.equal((await ok('ranking', { method: 'GET', query: { game: 'all' } })).daily[0].username, 'carla.m');

// --- Excluir conta: exige senha e confirmação, apaga tudo e libera o e-mail
cookie = ''; await ok('auth/login', { body: { email: 'carla@x.com', password: 'recuperada-4' } });
const carlaId = (await pg.query(`SELECT id FROM users WHERE username='carla.m'`)).rows[0].id;
await pg.query(`INSERT INTO tier_progress (user_id, game, tier, solved) VALUES ($1,'lights','easy',1)`, [carlaId]);
await pg.query(`INSERT INTO plays (user_id, game, tier, level, seed) VALUES ($1,'lights','easy',1,1)`, [carlaId]);
await pg.query(`DELETE FROM auth_attempts`);
assert.equal(await code('profile', { body: { action: 'delete', password: 'errada-123', confirm: 'EXCLUIR' } }), 403, 'senha errada');
assert.equal(await code('profile', { body: { action: 'delete', password: 'recuperada-4', confirm: 'talvez' } }), 400, 'sem confirmação');
assert.equal((await pg.query(`SELECT count(*)::int n FROM users WHERE id=$1`, [carlaId])).rows[0].n, 1, 'nada apagado ainda');
const delRes = await call('profile', { body: { action: 'delete', password: 'recuperada-4', confirm: 'excluir' } });
assert.equal(delRes.statusCode, 200);
assert.match(delRes.headers['Set-Cookie'], /Max-Age=0/, 'cookie de sessão limpo');
for (const table of ['users WHERE id', 'scores WHERE user_id', 'plays WHERE user_id', 'tier_progress WHERE user_id']) {
  assert.equal((await pg.query(`SELECT count(*)::int n FROM ${table} = $1`, [carlaId])).rows[0].n, 0, `${table} apagado`);
}
assert.equal((await ok('ranking', { method: 'GET', query: { game: 'all' } })).daily.some((r) => r.username === 'carla.m'), false, 'sai do ranking');
cookie = carla; assert.equal(await code('profile', { method: 'GET' }), 401, 'sessão da conta excluída não vale');
cookie = ''; assert.equal(await code('auth/login', { body: { email: 'carla@x.com', password: 'recuperada-4' } }), 401);
await ok('auth/register', reg2({ username: 'carla', email: 'carla@x.com', password: 'outra-senha-4' })); // e-mail e usuário liberados
// último admin não pode se excluir; com outro admin pode (e o FK de game_settings não impede)
await pg.query(`UPDATE users SET role='admin' WHERE lower(email)='admin@teste.com'`);
await pg.query(`DELETE FROM auth_attempts`);
cookie = ''; await ok('auth/login', { body: { email: 'admin@teste.com', password: 'Outra-Senha-2@' } });
await ok('settings', { body: { game: 'lights', enabled: true } }); // deixa um registro com updated_by = este admin
assert.equal(await code('profile', { body: { action: 'delete', password: 'Outra-Senha-2@', confirm: 'EXCLUIR' } }), 409, 'único admin');
await pg.query(`UPDATE users SET role='admin' WHERE username='ana'`);
assert.equal(await code('profile', { body: { action: 'delete', password: 'Outra-Senha-2@', confirm: 'EXCLUIR' } }), 200, 'com outro admin pode');
assert.equal((await pg.query(`SELECT count(*)::int n FROM game_settings WHERE updated_by IS NULL AND game='lights'`)).rows[0].n, 1, 'registro de configuração permanece (updated_by nulo)');

// --- anúncios: interruptor do admin (desligado por padrão; só admin liga)
await pg.query(`UPDATE users SET role='admin' WHERE username='ana'`); // ana é admin desde o teste de exclusão do último admin
cookie = anaCookie;
assert.equal((await ok('settings', { method: 'GET' })).ads.enabled, false, 'anúncios começam desligados');
await pg.query(`UPDATE users SET role='user' WHERE username='ana'`);
assert.equal((await ok('settings', { method: 'GET' })).ads.enabled, false);
assert.equal(await code('settings', { body: { setting: 'ads', enabled: true } }), 403, 'usuário comum não liga anúncios');
await pg.query(`UPDATE users SET role='admin' WHERE username='ana'`);
assert.equal(await code('settings', { body: { setting: 'outra', enabled: true } }), 400, 'configuração desconhecida');
assert.equal(await code('settings', { body: { setting: 'ads', enabled: 'sim' } }), 400);
const adsOn = await ok('settings', { body: { setting: 'ads', enabled: true } });
assert.equal(adsOn.ads.enabled, true);
assert.equal(adsOn.games.length, 6, 'jogos continuam na resposta');
assert.equal((await pg.query(`SELECT count(*)::int n FROM app_settings WHERE key='ads' AND enabled AND updated_by IS NOT NULL`)).rows[0].n, 1, 'registra quem alterou');
await pg.query(`UPDATE users SET role='user' WHERE username='ana'`);
assert.equal((await ok('settings', { method: 'GET' })).ads.enabled, true, 'usuário comum vê o estado');
await pg.query(`UPDATE users SET role='admin' WHERE username='ana'`);
assert.equal((await ok('settings', { body: { setting: 'ads', enabled: false } })).ads.enabled, false, 'desliga de novo');
const memoryToggle = await ok('settings', { body: { game: 'memory', enabled: false } });
assert.equal(memoryToggle.games.find((g) => g.slug === 'memory').enabled, false);
assert.equal(memoryToggle.ads.enabled, false, 'alternar jogo não mexe nos anúncios');
await ok('settings', { body: { game: 'memory', enabled: true } });

// ===================== Plano Premium (Stripe simulado) =====================
const { createHmac } = await import('node:crypto');
const { Readable } = await import('node:stream');
process.env.STRIPE_SECRET_KEY = 'sk_test_x'; process.env.STRIPE_PRICE_ID = 'price_123'; process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
const stripeCalls = []; let stripeFail = false;
globalThis.fetch = async (url, init = {}) => {
  const path = String(url).replace('https://api.stripe.com/v1', '');
  const body = Object.fromEntries(new URLSearchParams(init.body ?? ''));
  stripeCalls.push({ method: init.method, path, body, headers: init.headers });
  const json = (status, data) => ({ ok: status < 400, status, json: async () => data });
  if (stripeFail) return json(500, { error: { message: 'falha simulada' } });
  if (path === '/customers') return json(200, { id: 'cus_' + body['metadata[user_id]'].slice(0, 8) });
  if (path === '/checkout/sessions') return json(200, { id: 'cs_1', url: 'https://checkout.stripe.test/cs_1' });
  if (path === '/billing_portal/sessions') return json(200, { url: 'https://billing.stripe.test/portal' });
  if (init.method === 'DELETE' && path.startsWith('/subscriptions/')) return json(200, { id: path.split('/')[2], status: 'canceled' });
  return json(404, { error: { message: 'não simulado' } });
};
const now = Math.floor(Date.now() / 1000);
const sign = (raw, secret = 'whsec_test', t = now) => `t=${t},v1=${createHmac('sha256', secret).update(`${t}.${raw}`).digest('hex')}`;
const hook = async (event, { signature, secret, t, raw } = {}) => {
  const body = raw ?? JSON.stringify(event);
  const req = Object.assign(Readable.from([Buffer.from(body)]), { method: 'POST', headers: { 'stripe-signature': signature ?? sign(body, secret, t), 'content-type': 'application/json' }, query: {}, socket: {} });
  const res = { headers: {}, statusCode: 200, setHeader() {}, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } };
  await h.billing(req, res);
  return res;
};
const subEvent = (id, type, customer, userId, over = {}, created = now) => ({
  id, type, created,
  data: { object: { id: 'sub_1', customer, status: 'active', cancel_at_period_end: false, metadata: { user_id: userId },
    items: { data: [{ price: { id: 'price_123' }, current_period_end: now + 86400 * 30 }] }, ...over } },
});
const flag = async (key, enabled) => ok('settings', { body: { setting: key, enabled } });

cookie = ''; await ok('auth/register', reg2({ username: 'pam', email: 'pam@x.com', password: 'senha-forte-5' }));
const pamCookie = cookie;
const pamId = (await pg.query(`SELECT id FROM users WHERE username='pam'`)).rows[0].id;
const adminC = anaCookie; // ana é admin neste ponto
await pg.query(`UPDATE users SET role='admin' WHERE username='ana'`);
await pg.query(`INSERT INTO scores (user_id, game, tier, points, level) VALUES ($1,'sudoku','easy',100,1)`, [pamId]);

// desligado por padrão: ninguém vê oferta e o checkout é recusado
cookie = pamCookie;
let ps = (await ok('settings', { method: 'GET' })).premium;
assert.deepEqual(ps, { available: false, active: false, status: null, renewsAt: null, cancelAtPeriodEnd: false }, 'usuário comum não recebe dados de configuração');
assert.equal(await code('billing', { body: { action: 'checkout' } }), 403, 'checkout recusado com o plano desligado');
cookie = adminC;
let admin = (await ok('settings', { method: 'GET' })).premium;
assert.equal(admin.enabled, false); assert.equal(admin.configured, true); assert.equal(admin.subscribers, 0); assert.equal(admin.available, false);
assert.equal((await flag('premium', true)).premium.available, true, 'ligado + Stripe configurado = disponível');
const keep = process.env.STRIPE_PRICE_ID; delete process.env.STRIPE_PRICE_ID;
admin = (await ok('settings', { method: 'GET' })).premium;
assert.deepEqual([admin.enabled, admin.configured, admin.available], [true, false, false], 'sem a chave do Stripe, não é oferecido mesmo ligado');
cookie = pamCookie; assert.equal(await code('billing', { body: { action: 'checkout' } }), 403);
process.env.STRIPE_PRICE_ID = keep;

// checkout: cria cliente (1x) e sessão; só chama a API do Stripe com os dados certos
assert.equal(await code('billing', { method: 'GET' }), 405);
const co = await ok('billing', { body: { action: 'checkout' } });
assert.equal(co.url, 'https://checkout.stripe.test/cs_1');
const custCall = stripeCalls.find((c) => c.path === '/customers');
assert.equal(custCall.body.email, 'pam@x.com'); assert.equal(custCall.headers['Idempotency-Key'], `customer-${pamId}`);
assert.match(custCall.headers.Authorization, /^Bearer sk_test_x$/);
const sess = stripeCalls.find((c) => c.path === '/checkout/sessions').body;
assert.equal(sess.mode, 'subscription'); assert.equal(sess['line_items[0][price]'], 'price_123'); assert.equal(sess['line_items[0][quantity]'], '1');
assert.equal(sess.client_reference_id, pamId); assert.equal(sess['subscription_data[metadata][user_id]'], pamId);
assert.match(sess.success_url, /^https:\/\/app\.test\/\?premium=success$/);
const customerId = (await pg.query(`SELECT stripe_customer_id, status FROM subscriptions WHERE user_id=$1`, [pamId])).rows[0];
assert.equal(customerId.status, 'none');
await ok('billing', { body: { action: 'checkout' } });
assert.equal(stripeCalls.filter((c) => c.path === '/customers').length, 1, 'cliente do Stripe criado uma única vez');
assert.equal((await ps) && (await ok('settings', { method: 'GET' })).premium.active, false, 'ainda não é Premium antes do pagamento');

// webhook: assinatura obrigatória e válida
const created = subEvent('evt_1', 'customer.subscription.created', customerId.stripe_customer_id, pamId);
assert.equal((await hook(created, { secret: 'whsec_errado' })).statusCode, 400, 'assinatura de outro segredo');
assert.equal((await hook(created, { t: now - 3600 })).statusCode, 400, 'timestamp antigo (replay)');
assert.equal((await hook(created, { signature: sign(JSON.stringify({ ...created, id: 'evt_x' })) })).statusCode, 400, 'corpo adulterado');
assert.equal((await hook(created, { signature: 't=abc,v1=00' })).statusCode, 400, 'cabeçalho malformado');
assert.equal((await ok('settings', { method: 'GET' })).premium.active, false, 'webhook inválido não ativa nada');
assert.equal((await hook(created)).statusCode, 200);
ps = (await ok('settings', { method: 'GET' })).premium;
assert.equal(ps.active, true); assert.equal(ps.status, 'active'); assert.ok(ps.renewsAt && new Date(ps.renewsAt) > new Date());
assert.equal(ps.cancelAtPeriodEnd, false);
assert.equal(await code('billing', { body: { action: 'checkout' } }), 409, 'já é Premium');
// idempotência e eventos fora de ordem
assert.equal((await hook(created)).statusCode, 200);
assert.equal((await pg.query(`SELECT count(*)::int n FROM stripe_events WHERE id='evt_1'`)).rows[0].n, 1, 'evento repetido não é processado de novo');
assert.equal((await hook(subEvent('evt_2', 'customer.subscription.updated', customerId.stripe_customer_id, pamId, { cancel_at_period_end: true }, now + 10))).statusCode, 200);
assert.equal((await ok('settings', { method: 'GET' })).premium.cancelAtPeriodEnd, true, 'cancelamento agendado refletido');
await hook(subEvent('evt_old', 'customer.subscription.updated', customerId.stripe_customer_id, pamId, { status: 'canceled', cancel_at_period_end: false }, now - 100));
ps = (await ok('settings', { method: 'GET' })).premium;
assert.deepEqual([ps.active, ps.cancelAtPeriodEnd], [true, true], 'evento antigo que chega atrasado é ignorado');
assert.equal((await hook({ id: 'evt_other', type: 'invoice.paid', created: now, data: { object: {} } })).statusCode, 200, 'eventos desconhecidos são aceitos e ignorados');
// selo nos rankings
const rk = (await ok('ranking', { method: 'GET', query: { game: 'sudoku' } })).daily;
assert.equal(rk.find((r) => r.username === 'pam').premium, true);
assert.ok(rk.filter((r) => r.username !== 'pam').every((r) => r.premium === false), 'só assinante tem selo');
// portal
assert.equal((await ok('billing', { body: { action: 'portal' } })).url, 'https://billing.stripe.test/portal');
assert.equal(stripeCalls.filter((c) => c.path === '/billing_portal/sessions').pop().body.customer, customerId.stripe_customer_id);
cookie = adminC; assert.equal(await code('billing', { body: { action: 'portal' } }), 404, 'quem nunca assinou não tem portal');
assert.equal(await code('billing', { body: { action: 'xyz' } }), 400);
cookie = ''; assert.equal(await code('billing', { body: { action: 'checkout' } }), 401, 'precisa estar logado');

// admin para de vender: quem já assina mantém tudo; novos não conseguem assinar
cookie = adminC; assert.equal((await flag('premium', false)).premium.available, false);
cookie = pamCookie;
ps = (await ok('settings', { method: 'GET' })).premium;
assert.deepEqual([ps.available, ps.active], [false, true], 'assinante continua Premium com a venda desligada');
assert.equal((await ok('billing', { body: { action: 'portal' } })).url.startsWith('https://billing'), true, 'e continua podendo gerenciar/cancelar');
assert.equal((await ok('ranking', { method: 'GET', query: { game: 'sudoku' } })).daily.find((r) => r.username === 'pam').premium, true);
cookie = adminC; assert.equal(await code('billing', { body: { action: 'checkout' } }), 403);
await flag('premium', true);
// fim da assinatura
assert.equal((await hook(subEvent('evt_3', 'customer.subscription.deleted', customerId.stripe_customer_id, pamId, {}, now + 20))).statusCode, 200);
cookie = pamCookie; ps = (await ok('settings', { method: 'GET' })).premium;
assert.deepEqual([ps.active, ps.status], [false, 'canceled'], 'assinatura cancelada perde os benefícios');
assert.equal((await ok('ranking', { method: 'GET', query: { game: 'sudoku' } })).daily.find((r) => r.username === 'pam').premium, false);
await hook(subEvent('evt_4', 'customer.subscription.updated', customerId.stripe_customer_id, pamId, { status: 'trialing' }, now + 30));
assert.equal((await ok('settings', { method: 'GET' })).premium.active, true, 'trial também conta');
assert.equal((await ok('settings', { method: 'GET' })).premium.status, 'trialing');
cookie = adminC; assert.equal((await ok('settings', { method: 'GET' })).premium.subscribers, 1, 'admin vê quantos assinantes');

// excluir conta cancela a assinatura no Stripe; se o cancelamento falhar, não exclui
cookie = ''; await ok('auth/register', reg2({ username: 'quin', email: 'quin@x.com', password: 'senha-forte-6' }));
const quinId = (await pg.query(`SELECT id FROM users WHERE username='quin'`)).rows[0].id;
await pg.query(`INSERT INTO subscriptions (user_id, stripe_customer_id, stripe_subscription_id, status) VALUES ($1,'cus_quin','sub_quin','active')`, [quinId]);
await pg.query(`DELETE FROM auth_attempts`);
stripeFail = true;
assert.equal(await code('profile', { body: { action: 'delete', password: 'senha-forte-6', confirm: 'EXCLUIR' } }), 502, 'Stripe falhou: a exclusão é interrompida');
assert.equal((await pg.query(`SELECT count(*)::int n FROM users WHERE id=$1`, [quinId])).rows[0].n, 1, 'usuário continua existindo');
stripeFail = false;
const savedKey = process.env.STRIPE_SECRET_KEY; delete process.env.STRIPE_SECRET_KEY; delete process.env.STRIPE_WEBHOOK_SECRET;
assert.equal(await code('profile', { body: { action: 'delete', password: 'senha-forte-6', confirm: 'EXCLUIR' } }), 503, 'Stripe sem configuração: não exclui');
process.env.STRIPE_SECRET_KEY = savedKey; process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
assert.equal(await code('profile', { body: { action: 'delete', password: 'senha-forte-6', confirm: 'EXCLUIR' } }), 200);
const cancel = stripeCalls.filter((c) => c.method === 'DELETE').pop();
assert.equal(cancel.path, '/subscriptions/sub_quin', 'assinatura cancelada no Stripe antes de apagar');
assert.equal((await pg.query(`SELECT count(*)::int n FROM users WHERE id=$1`, [quinId])).rows[0].n + (await pg.query(`SELECT count(*)::int n FROM subscriptions WHERE user_id=$1`, [quinId])).rows[0].n, 0, 'usuário e assinatura apagados');
// quem nunca assinou exclui sem tocar no Stripe
cookie = ''; await ok('auth/register', reg2({ username: 'rui', email: 'rui@x.com', password: 'senha-forte-7' }));
const callsBefore = stripeCalls.length; await pg.query(`DELETE FROM auth_attempts`);
assert.equal(await code('profile', { body: { action: 'delete', password: 'senha-forte-7', confirm: 'EXCLUIR' } }), 200);
assert.equal(stripeCalls.length, callsBefore, 'sem assinatura, nenhuma chamada ao Stripe');
// webhook sem configuração
delete process.env.STRIPE_WEBHOOK_SECRET;
assert.equal((await hook(created)).statusCode, 503);
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
// logout agora é uma ação do perfil
cookie = pamCookie; const loggedOut = await call('profile', { body: { action: 'logout' } });
assert.equal(loggedOut.statusCode, 200); assert.match(loggedOut.headers['Set-Cookie'], /Max-Age=0/);

// ===================== Limite de partidas em sequência (energia) =====================
cookie = ''; await ok('auth/register', reg2({ username: 'eva', email: 'eva@x.com', password: 'senha-forte-8' }));
const evaCookie = cookie;
const evaId = (await pg.query(`SELECT id FROM users WHERE username='eva'`)).rows[0].id;
const startSudoku = () => call('play/start', { body: { game: 'sudoku', tier: 'easy', challenge: 1 } });
const energyOf = async () => (await ok('settings', { method: 'GET' })).energy;
const minutesUntil = (iso) => (new Date(iso).getTime() - Date.now()) / 60000;

// desligado por padrão: sem limite e sem estado de energia
let en = await energyOf();
assert.deepEqual([en.enabled, en.state], [false, null]);
assert.deepEqual(en.free, { capacity: 20, intervalSec: 600 }); assert.deepEqual(en.premium, { capacity: 50, intervalSec: 120 });
for (let i = 0; i < 25; i++) { const r = await startSudoku(); assert.equal(r.statusCode, 200); assert.equal(r.body.energy, null); }
assert.equal((await pg.query(`SELECT count(*)::int n FROM play_energy WHERE user_id=$1`, [evaId])).rows[0].n, 0, 'desligado não registra nada');
assert.equal(await code('settings', { body: { setting: 'energy', enabled: true } }), 403, 'usuário comum não liga');

// ligado: 20 partidas, depois bloqueia
cookie = adminC; await pg.query(`UPDATE users SET role='admin' WHERE username='ana'`);
assert.equal((await flag('energy', true)).energy.enabled, true);
cookie = evaCookie;
en = await energyOf(); assert.deepEqual([en.enabled, en.state.charges, en.state.capacity, en.state.nextRefillAt], [true, 20, 20, null], 'estoque cheio ao começar');
for (let i = 1; i <= 20; i++) { const r = await startSudoku(); assert.equal(r.statusCode, 200, `partida ${i}`); assert.equal(r.body.energy.charges, 20 - i); }
const blocked = await startSudoku();
assert.equal(blocked.statusCode, 429); assert.match(blocked.body.error, /sem partidas/);
assert.equal(blocked.body.energy.charges, 0);
const wait = minutesUntil(blocked.body.energy.nextRefillAt);
assert.ok(wait > 9 && wait <= 10.05, `próxima partida em ~10 min (deu ${wait.toFixed(2)})`);
assert.equal((await energyOf()).state.charges, 0);
assert.equal((await pg.query(`SELECT count(*)::int n FROM plays WHERE user_id=$1`, [evaId])).rows[0].n, 45, 'partida bloqueada não é criada (25 + 20)');

// recarga: 25 min = +2 partidas, e os 5 min restantes continuam contando
await pg.query(`UPDATE play_energy SET refilled_at = now() - interval '25 minutes' WHERE user_id=$1`, [evaId]);
en = await energyOf(); assert.equal(en.state.charges, 2);
assert.ok(Math.abs(minutesUntil(en.state.nextRefillAt) - 5) < 0.5, 'o tempo parcial até a próxima recarga é preservado');
assert.equal((await startSudoku()).body.energy.charges, 1); assert.equal((await startSudoku()).body.energy.charges, 0);
assert.equal((await startSudoku()).statusCode, 429);
const after = minutesUntil((await energyOf()).state.nextRefillAt);
assert.ok(after > 4 && after < 6, `ao gastar, o relógio não zera (próxima em ${after.toFixed(2)} min)`);

// atomicidade: com 1 partida sobrando, 3 inícios simultâneos gastam só uma
await pg.query(`UPDATE play_energy SET charges = 1, refilled_at = now() WHERE user_id=$1`, [evaId]);
const race = await Promise.all([startSudoku(), startSudoku(), startSudoku()]);
assert.equal(race.filter((r) => r.statusCode === 200).length, 1, `corrida: ${race.map((r) => r.statusCode)}`);

// o estoque não passa do máximo, mesmo com muito tempo parado
await pg.query(`UPDATE play_energy SET charges = 0, refilled_at = now() - interval '10 hours' WHERE user_id=$1`, [evaId]);
en = await energyOf(); assert.deepEqual([en.state.charges, en.state.nextRefillAt], [20, null]);
assert.equal((await startSudoku()).body.energy.charges, 19);

// Premium: 50 partidas e +1 a cada 2 min
await pg.query(`INSERT INTO subscriptions (user_id, stripe_customer_id, status) VALUES ($1,'cus_eva','active')`, [evaId]);
await pg.query(`UPDATE play_energy SET refilled_at = now() - interval '10 minutes' WHERE user_id=$1`, [evaId]);
en = await energyOf(); assert.deepEqual([en.state.capacity, en.state.intervalSec, en.state.charges], [50, 120, 24], '19 + 10 min / 2 min = 24');
cookie = ''; await ok('auth/register', reg2({ username: 'fox', email: 'fox@x.com', password: 'senha-forte-9' }));
const foxCookie = cookie; const foxId = (await pg.query(`SELECT id FROM users WHERE username='fox'`)).rows[0].id;
await pg.query(`INSERT INTO subscriptions (user_id, stripe_customer_id, status) VALUES ($1,'cus_fox','trialing')`, [foxId]);
for (let i = 1; i <= 50; i++) assert.equal((await startSudoku()).statusCode, 200, `premium partida ${i}`);
const foxBlocked = await startSudoku(); assert.equal(foxBlocked.statusCode, 429);
assert.ok(minutesUntil(foxBlocked.body.energy.nextRefillAt) <= 2.05, 'Premium recarrega em 2 min');
await pg.query(`UPDATE play_energy SET refilled_at = now() - interval '4 minutes' WHERE user_id=$1`, [foxId]);
assert.equal((await energyOf()).state.charges, 2);
// perdeu o Premium: volta para o limite do plano grátis
await pg.query(`UPDATE subscriptions SET status='canceled' WHERE user_id=$1`, [foxId]);
await pg.query(`UPDATE play_energy SET charges = 40, refilled_at = now() WHERE user_id=$1`, [foxId]);
en = await energyOf(); assert.equal(en.state.capacity, 20);
assert.equal((await startSudoku()).body.energy.charges, 19, 'excesso acima do plano grátis é cortado');

// admin desliga o limite: volta a ser ilimitado
cookie = adminC; assert.equal((await flag('energy', false)).energy.enabled, false);
cookie = evaCookie;
await pg.query(`UPDATE play_energy SET charges = 0 WHERE user_id=$1`, [evaId]);
for (let i = 0; i < 3; i++) { const r = await startSudoku(); assert.equal(r.statusCode, 200); assert.equal(r.body.energy, null); }
// excluir a conta apaga a energia
await pg.query(`DELETE FROM auth_attempts`);
assert.equal(await code('profile', { body: { action: 'delete', password: 'senha-forte-8', confirm: 'EXCLUIR' } }), 200);
assert.equal((await pg.query(`SELECT count(*)::int n FROM play_energy WHERE user_id=$1`, [evaId])).rows[0].n, 0);

console.log('API OK');
process.exit(0);
