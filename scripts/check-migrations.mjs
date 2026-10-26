// Confere (com Postgres em memória) que:
//  1) db/schema.sql está em dia com db/migrations/
//  2) as migrações rodam 2x sem erro e chegam à mesma estrutura do schema.sql
//  3) bancos criados por versões antigas do schema sobem até a estrutura atual sem perder dados
import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';

const root = new URL('../', import.meta.url);
const migrationsDir = new URL('db/migrations/', root);
const files = readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
const split = (text) => text.split(/;\s*\n/).map((s) => s.trim()).filter(Boolean);
const run = async (db, text) => { for (const s of split(text)) await db.query(s); };
const migrate = async (db) => { for (const f of files) await run(db, readFileSync(new URL(f, migrationsDir), 'utf8')); };

// 1) schema.sql gerado e em dia
execFileSync('node', [new URL('scripts/build-schema.mjs', root).pathname, '--check'], { stdio: 'inherit' });

// "foto" da estrutura: colunas, índices e restrições (ignora a ordem das colunas)
const snapshot = async (db) => {
  const q = async (sql) => (await db.query(sql)).rows;
  return {
    columns: await q(`SELECT table_name, column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_schema='public' ORDER BY 1, 2`),
    indexes: await q(`SELECT indexname, indexdef FROM pg_indexes WHERE schemaname='public' ORDER BY 1`),
    constraints: await q(`SELECT conrelid::regclass::text AS tbl, contype, pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE connamespace = 'public'::regnamespace AND contype <> 'n' ORDER BY 1, 3`),
  };
};

// 2) banco novo: migrações (duas vezes) x schema.sql
const viaMigrations = new PGlite();
await migrate(viaMigrations);
await migrate(viaMigrations); // idempotente
const viaSchema = new PGlite();
await run(viaSchema, readFileSync(new URL('db/schema.sql', root), 'utf8'));
await run(viaSchema, readFileSync(new URL('db/schema.sql', root), 'utf8'));
const expected = await snapshot(viaMigrations);
assert.deepEqual(await snapshot(viaSchema), expected, 'schema.sql e migrações divergem');
const tables = [...new Set(expected.columns.map((c) => c.table_name))];
assert.deepEqual(tables, ['app_settings', 'auth_attempts', 'email_tokens', 'game_settings', 'oauth_identities', 'play_energy', 'plays', 'scores', 'stripe_events', 'subscriptions', 'tier_progress', 'users'], 'tabelas esperadas');
console.log(`banco novo OK (${tables.join(', ')})`);

// 3) bancos de versões antigas (histórico do git; ignora as que não estiverem disponíveis)
const legacy = [
  ['2e921d5', 'primeira versão (progress por jogo, sem tiers)'],
  ['469cc94', 'com tiers, sem configurações nem perfil'],
  ['adff592', 'com configurações do admin, sem perfil'],
];
for (const [sha, label] of legacy) {
  let oldSchema;
  try {
    oldSchema = execFileSync('git', ['show', `${sha}:db/schema.sql`], { cwd: new URL(root).pathname, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    console.log(`- ${sha} (${label}): histórico indisponível, ignorado`);
    continue;
  }
  const db = new PGlite();
  await run(db, oldSchema);
  const u = (await db.query(`INSERT INTO users (username,email,password_hash,secret_hash) VALUES ('velho','velho@x.com','h','s') RETURNING id`)).rows[0].id;
  const hasLevel = (await db.query(`SELECT 1 FROM information_schema.columns WHERE table_name='scores' AND column_name='level'`)).rows.length;
  if (hasLevel) await db.query(`INSERT INTO scores (user_id, game, points, level) VALUES ($1,'sudoku',100,1)`, [u]);
  await migrate(db);
  assert.deepEqual(await snapshot(db), expected, `${sha}: estrutura após migrar difere da atual`);
  assert.equal((await db.query(`SELECT count(*)::int n FROM users WHERE username='velho'`)).rows[0].n, 1, `${sha}: usuário preservado`);
  if (hasLevel) {
    const s = (await db.query(`SELECT tier, points FROM scores WHERE user_id=$1`, [u])).rows[0];
    assert.deepEqual({ ...s }, { tier: 'easy', points: 100 }, `${sha}: pontuação preservada`);
  }
  assert.equal((await db.query(`SELECT to_regclass('public.progress') AS t`)).rows[0].t, null, `${sha}: tabela antiga removida`);
  console.log(`✓ ${sha} (${label}) migrado sem perder dados`);
}
console.log('Migrações OK');
