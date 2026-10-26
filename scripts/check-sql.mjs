// Guarda contra SQL injection: todo acesso ao banco em api/ precisa usar o template tagged `sql\`...\``, em que cada ${valor}
// vira parâmetro ($1, $2...) e nunca texto SQL. Falha se aparecer chamada em formato de função, sql.unsafe/query/raw,
// concatenação de strings ou ${} em posição de identificador (tabela/coluna).
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const walk = (dir) => readdirSync(dir).flatMap((f) => {
  const full = path.join(dir, f);
  return statSync(full).isDirectory() ? walk(full) : full.endsWith('.ts') ? [full] : [];
});

const problems = [];
for (const file of walk(path.join(root, 'api'))) {
  const src = readFileSync(file, 'utf8');
  const rel = path.relative(root, file);
  const lines = src.split('\n');
  lines.forEach((line, i) => {
    const at = `${rel}:${i + 1}`;
    if (/\bsql\s*\(/.test(line) && !/^\s*(\/\/|\*)/.test(line)) problems.push(`${at}: sql(...) como função (use o template sql\`...\`)`);
    if (/\bsql\.(unsafe|query|raw|file)\b/.test(line)) problems.push(`${at}: API que aceita SQL em texto`);
    if (/\.query\s*\(/.test(line) && !/pg\.query/.test(line)) problems.push(`${at}: .query() com texto SQL`);
  });
  // ${} em posição de identificador dentro de templates sql
  for (const m of src.matchAll(/sql`([\s\S]*?)`/g)) {
    const body = m[1];
    const hit = body.match(/(?<!DISTINCT\s)\b(FROM|JOIN|INTO|UPDATE|TABLE|ORDER\s+BY|GROUP\s+BY)\s+\$\{/i) || body.match(/\bAS\s+\$\{/i);
    if (hit) problems.push(`${rel}: \${} em posição de identificador: "${hit[0]}"`);
  }
}
if (problems.length) {
  console.error('Possível SQL injection:\n' + problems.map((p) => ' - ' + p).join('\n'));
  process.exit(1);
}
console.log('SQL seguro OK (só templates parametrizados)');
