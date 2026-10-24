// Servidor local para testes: serve dist/ + os handlers de /api com Postgres em memória (PGlite).
import { build } from 'esbuild';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync, mkdirSync, mkdtempSync, writeFileSync, existsSync } from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
mkdirSync(path.join(root, 'node_modules/.cache'), { recursive: true });
const out = mkdtempSync(path.join(root, 'node_modules/.cache/e2e-'));
const pg = new PGlite();
for (const s of readFileSync(path.join(root, 'db/schema.sql'), 'utf8').split(/;\s*\n/).map((x) => x.trim()).filter(Boolean)) await pg.query(s);
globalThis.__sql = async (strings, ...values) =>
  (await pg.query(strings.reduce((acc, s, i) => acc + s + (i < values.length ? `$${i + 1}` : ''), ''), values)).rows;
globalThis.__pg = pg;
writeFileSync(path.join(out, 'db-shim.js'), `export const sql = (...a) => globalThis.__sql(...a);
export const assertDb = () => {};
export class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }`);

const names = ['auth/register', 'auth/login', 'auth/recover', 'auth/me', 'auth/logout', 'play/start', 'play/finish', 'play/guess', 'ranking', 'progress'];
await build({
  entryPoints: Object.fromEntries(names.map((n) => [n, path.join(root, 'api', `${n}.ts`)])),
  outdir: out, bundle: true, format: 'esm', platform: 'node', packages: 'external',
  plugins: [{ name: 'db', setup: (b) => b.onResolve({ filter: /(^|\/)db\.js$/ }, () => ({ path: path.join(out, 'db-shim.js') })) }],
});
process.env.JWT_SECRET = 'x'.repeat(40);
const handlers = {};
for (const n of names) handlers[n] = (await import(pathToFileURL(path.join(out, `${n}.js`)).href)).default;

const vercel = JSON.parse(readFileSync(path.join(root, 'vercel.json'), 'utf8'));
const secHeaders = Object.fromEntries(vercel.headers[0].headers.map((h) => [h.key, h.value]));
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/__backdate') { // só para o teste: envelhece partidas abertas
    await pg.query(`UPDATE plays SET started_at = now() - interval '600 seconds' WHERE finished_at IS NULL`);
    return res.end('ok');
  }
  if (url.pathname.startsWith('/api/')) {
    const chunks = []; for await (const c of req) chunks.push(c);
    const raw = Buffer.concat(chunks).toString();
    const vr = Object.assign(req, { query: Object.fromEntries(url.searchParams), body: raw ? JSON.parse(raw) : undefined });
    const vres = Object.assign(res, { status(c) { res.statusCode = c; return res; }, json(b) { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(b)); return res; } });
    return handlers[url.pathname.slice(5)]?.(vr, vres) ?? res.writeHead(404).end('{}');
  }
  let file = path.join(root, 'dist', url.pathname);
  if (!existsSync(file) || !path.extname(file)) file = path.join(root, 'dist', 'index.html');
  res.writeHead(200, { 'Content-Type': types[path.extname(file)] ?? 'application/octet-stream', ...secHeaders });
  res.end(readFileSync(file));
}).listen(4174, () => console.log('e2e server on 4174'));
