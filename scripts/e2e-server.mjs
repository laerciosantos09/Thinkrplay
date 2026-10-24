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
// Admin de teste (senha só existe aqui, em memória): admin@e2e.com / AdminE2E-1@
const { execFileSync } = await import('node:child_process');
await pg.exec(execFileSync('node', [path.join(root, 'scripts/create-admin.mjs'), '--sql'], {
  env: { ...process.env, ADMIN_EMAIL: 'admin@e2e.com', ADMIN_USERNAME: 'admin', ADMIN_PASSWORD: 'AdminE2E-1@' }, encoding: 'utf8' }));
globalThis.__sql = async (strings, ...values) =>
  (await pg.query(strings.reduce((acc, s, i) => acc + s + (i < values.length ? `$${i + 1}` : ''), ''), values)).rows;
globalThis.__pg = pg;
writeFileSync(path.join(out, 'db-shim.js'), `export const sql = (...a) => globalThis.__sql(...a);
export const assertDb = () => {};
export class HttpError extends Error { constructor(status, message, expose = false) { super(message); this.status = status; this.expose = expose; } }`);

const names = ['auth/register', 'auth/login', 'auth/recover', 'profile', 'billing', 'play/start', 'play/finish', 'play/guess', 'ranking', 'progress', 'settings'];
await build({
  entryPoints: Object.fromEntries(names.map((n) => [n, path.join(root, 'api', `${n}.ts`)])),
  outdir: out, bundle: true, format: 'esm', platform: 'node', packages: 'external',
  plugins: [{ name: 'db', setup: (b) => b.onResolve({ filter: /(^|\/)db\.js$/ }, () => ({ path: path.join(out, 'db-shim.js') })) }],
});
process.env.JWT_SECRET = 'x'.repeat(40);
const handlers = {};
for (const n of names) handlers[n] = (await import(pathToFileURL(path.join(out, `${n}.js`)).href)).default;

// Stripe simulado: páginas de pagamento/portal falsas que disparam webhooks assinados de verdade.
process.env.STRIPE_SECRET_KEY ??= 'sk_test_e2e'; process.env.STRIPE_PRICE_ID ??= 'price_e2e'; process.env.STRIPE_WEBHOOK_SECRET ??= 'whsec_e2e';
const { createHmac } = await import('node:crypto');
const { Readable } = await import('node:stream');
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init = {}) => {
  if (!String(url).startsWith('https://api.stripe.com/v1')) return realFetch(url, init);
  const path = String(url).replace('https://api.stripe.com/v1', '');
  const body = Object.fromEntries(new URLSearchParams(init.body ?? ''));
  const json = (data) => ({ ok: true, status: 200, json: async () => data });
  if (path === '/customers') return json({ id: 'cus_' + body['metadata[user_id]'].slice(0, 8) });
  if (path === '/checkout/sessions') return json({ url: `http://localhost:4174/__pay?customer=${body.customer}&user=${body.client_reference_id}` });
  if (path === '/billing_portal/sessions') return json({ url: `http://localhost:4174/__portal?customer=${body.customer}` });
  return json({ id: 'sub_e2e', status: 'canceled' });
};
let eventCounter = 0;
const sendWebhook = async (customer, user, over) => {
  const created = Math.floor(Date.now() / 1000) + eventCounter;
  const event = { id: `evt_e2e_${++eventCounter}`, type: 'customer.subscription.updated', created,
    data: { object: { id: 'sub_e2e', customer, status: 'active', cancel_at_period_end: false, metadata: { user_id: user },
      items: { data: [{ price: { id: 'price_e2e' }, current_period_end: created + 86400 * 30 }] }, ...over } } };
  const raw = JSON.stringify(event);
  const sig = `t=${created},v1=${createHmac('sha256', process.env.STRIPE_WEBHOOK_SECRET).update(`${created}.${raw}`).digest('hex')}`;
  const req = Object.assign(Readable.from([Buffer.from(raw)]), { method: 'POST', headers: { 'stripe-signature': sig }, query: {}, socket: {} });
  const res = { statusCode: 200, setHeader() {}, status(c) { this.statusCode = c; return this; }, json() { return this; } };
  await handlers.billing(req, res);
  return res.statusCode;
};

const vercel = JSON.parse(readFileSync(path.join(root, 'vercel.json'), 'utf8'));
const secHeaders = Object.fromEntries(vercel.headers[0].headers.map((h) => [h.key, h.value]));
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/__backdate') { // só para o teste: envelhece partidas abertas
    await pg.query(`UPDATE plays SET started_at = now() - interval '600 seconds' WHERE finished_at IS NULL`);
    return res.end('ok');
  }
  if (url.pathname === '/__pay') { // "pagou": ativa a assinatura e volta para o app
    await sendWebhook(url.searchParams.get('customer'), url.searchParams.get('user'), {});
    return res.writeHead(302, { Location: '/?premium=success' }).end();
  }
  if (url.pathname === '/__portal') { // "cancelou" no portal: agenda o fim da assinatura e volta
    const u = (await pg.query('SELECT user_id FROM subscriptions WHERE stripe_customer_id = $1', [url.searchParams.get('customer')])).rows[0]?.user_id;
    await sendWebhook(url.searchParams.get('customer'), u, { cancel_at_period_end: true });
    return res.writeHead(302, { Location: '/' }).end();
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
