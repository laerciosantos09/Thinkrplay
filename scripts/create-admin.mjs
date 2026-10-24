// Cria (ou atualiza a senha de) um usuário administrador. A senha NUNCA é gravada em texto: só o hash bcrypt.
//
//   Direto no banco:   DATABASE_URL="postgres://..." node scripts/create-admin.mjs
//   Só gerar o SQL:    node scripts/create-admin.mjs --sql      (cole o resultado no SQL Editor do Neon)
//
// Variáveis opcionais: ADMIN_EMAIL, ADMIN_USERNAME, ADMIN_PASSWORD, ADMIN_SECRET_WORD.
// Sem ADMIN_PASSWORD o script pergunta no terminal (a digitação fica oculta).
import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import readline from 'node:readline';

const COST = 11; // mesmo custo usado pela API

const ask = (question, hidden = false) =>
  new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stderr, terminal: true });
    if (hidden) rl._writeToOutput = (s) => { if (s.includes(question)) rl.output.write(s); };
    rl.question(question, (answer) => { rl.close(); if (hidden) process.stderr.write('\n'); resolve(answer.trim()); });
  });

const email = (process.env.ADMIN_EMAIL ?? (await ask('E-mail do admin: '))).toLowerCase();
const username = process.env.ADMIN_USERNAME ?? (await ask('Nome de usuário (3-24, sem espaços): '));
const password = process.env.ADMIN_PASSWORD ?? (await ask('Senha (mín. 8 caracteres): ', true));

if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('E-mail inválido.');
if (!/^[\p{L}\p{N}_.-]{3,24}$/u.test(username)) throw new Error('Nome de usuário inválido (3-24 letras, números, _ . -).');
if (password.length < 8) throw new Error('A senha precisa ter pelo menos 8 caracteres.');

// A palavra secreta é obrigatória no cadastro; sem uma informada, gera uma aleatória (recuperação por palavra fica
// indisponível para o admin: para trocar a senha, rode este script de novo).
const secretWord = (process.env.ADMIN_SECRET_WORD ?? randomBytes(18).toString('base64url')).toLowerCase();
const [passwordHash, secretHash] = await Promise.all([bcrypt.hash(password, COST), bcrypt.hash(secretWord, COST)]);

const upsert = `INSERT INTO users (username, email, password_hash, secret_hash, role)
VALUES ($1, $2, $3, $4, 'admin')
ON CONFLICT (lower(email)) DO UPDATE SET password_hash = EXCLUDED.password_hash, role = 'admin'`;

if (process.argv.includes('--sql')) {
  const q = (v) => `'${v.replaceAll("'", "''")}'`;
  console.log(`-- Admin Thinkrplay (somente hashes bcrypt; nenhuma senha em texto)
INSERT INTO users (username, email, password_hash, secret_hash, role)
VALUES (${q(username)}, ${q(email)}, ${q(passwordHash)}, ${q(secretHash)}, 'admin')
ON CONFLICT (lower(email)) DO UPDATE SET password_hash = EXCLUDED.password_hash, role = 'admin';`);
} else {
  const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
  if (!url) throw new Error('Defina DATABASE_URL (ou use --sql para apenas gerar o SQL).');
  const { neon } = await import('@neondatabase/serverless');
  await neon(url).query(upsert, [username, email, passwordHash, secretHash]);
  console.log(`Admin pronto: ${email} (senha gravada apenas como hash).`);
}
