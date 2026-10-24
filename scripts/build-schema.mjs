// Gera db/schema.sql (estrutura completa) juntando db/migrations/*.sql em ordem.
// Uso: node scripts/build-schema.mjs           (grava db/schema.sql)
//      node scripts/build-schema.mjs --check   (só confere se o arquivo está em dia)
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';

const dir = new URL('../db/migrations/', import.meta.url);
const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
const header = `-- Thinkrplay: estrutura COMPLETA do banco (Postgres/Neon). GERADO por "npm run db:schema" a partir de db/migrations/.
-- Não edite aqui: altere ou crie uma migração em db/migrations/ e rode "npm run db:schema".
-- Pode ser executado várias vezes sem problema. Neon: SQL Editor > cole este arquivo inteiro > Run.
`;
const body = files.map((f) => `\n-- ===== ${f} =====\n${readFileSync(new URL(f, dir), 'utf8').trim()}\n`).join('');
const full = header + body;

const target = new URL('../db/schema.sql', import.meta.url);
if (process.argv.includes('--check')) {
  if (readFileSync(target, 'utf8') !== full) {
    console.error('db/schema.sql está desatualizado. Rode: npm run db:schema');
    process.exit(1);
  }
  console.log(`schema.sql em dia (${files.length} migrações).`);
} else {
  writeFileSync(target, full);
  console.log(`db/schema.sql gerado a partir de ${files.length} migrações.`);
}
