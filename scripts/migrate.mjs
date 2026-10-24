// Aplica as migrações de db/migrations/ em ordem (todas são idempotentes: as já aplicadas não fazem nada).
// Uso: DATABASE_URL_UNPOOLED=... npm run db:migrate
import { readFileSync, readdirSync } from 'node:fs';
import { neon } from '@neondatabase/serverless';

// Migrações usam a conexão direta (sem pool) quando disponível, como a integração Neon/Vercel recomenda.
const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!url) {
  console.error('Defina DATABASE_URL_UNPOOLED ou DATABASE_URL (string de conexão do Neon).');
  process.exit(1);
}

const sql = neon(url);
const dir = new URL('../db/migrations/', import.meta.url);
for (const file of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
  const statements = readFileSync(new URL(file, dir), 'utf8').split(/;\s*\n/).map((s) => s.trim()).filter(Boolean);
  for (const statement of statements) await sql.query(statement);
  console.log(`✓ ${file} (${statements.length} comandos)`);
}
console.log('Migrações concluídas.');
