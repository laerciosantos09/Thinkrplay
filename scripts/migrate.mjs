import { readFileSync } from 'node:fs';
import { neon } from '@neondatabase/serverless';

// Migrações usam a conexão direta (sem pool) quando disponível, como a integração Neon/Vercel recomenda.
const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!url) {
  console.error('Defina DATABASE_URL_UNPOOLED ou DATABASE_URL (string de conexão do Neon).');
  process.exit(1);
}

const sql = neon(url);
const schema = readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8');
const statements = schema.split(/;\s*\n/).map((s) => s.trim()).filter(Boolean);

for (const statement of statements) {
  await sql.query(statement);
}
console.log(`Migração concluída (${statements.length} comandos).`);
