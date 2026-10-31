import { createHash, randomBytes } from 'node:crypto';
import type { VercelResponse } from '@vercel/node';
import { sql } from './db.js';

// Login social no app nativo: o provedor roda no navegador do sistema (o Google bloqueia WebView) e o resultado volta ao app
// por um código de uso único (2 min). O app guarda um segredo ("verifier") e manda só o hash dele ("challenge") ao iniciar:
// só quem iniciou o fluxo consegue trocar o código por uma sessão (impede que um link de outra pessoa logue o app na conta dela).
const sha256 = (v: string) => createHash('sha256').update(v).digest();
const b64 = (b: Buffer) => b.toString('base64url');
export const CHALLENGE_RE = /^[A-Za-z0-9_-]{43}$/; // base64url de 32 bytes (SHA-256)
export const APP_SCHEME = 'thinkrplay';

export const handoffReady = async () => Boolean((await sql`SELECT to_regclass('public.app_handoffs') IS NOT NULL AS ok`)[0]?.ok);

export const issueHandoff = async (userId: string, challenge: string) => {
  const code = randomBytes(32).toString('base64url');
  await sql`DELETE FROM app_handoffs WHERE expires_at < now() - interval '1 hour'`;
  await sql`INSERT INTO app_handoffs (code_hash, user_id, challenge, expires_at) VALUES (${b64(sha256(code))}, ${userId}, ${challenge}, now() + interval '2 minutes')`;
  return code;
};

// Atômico: o código só vale uma vez, dentro do prazo, e com o verifier certo. Devolve o usuário ou null.
export const consumeHandoff = async (code: string, verifier: string) => {
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(code) || !/^[A-Za-z0-9_-]{20,128}$/.test(verifier)) return null;
  const rows = await sql`
    WITH used AS (
      UPDATE app_handoffs SET used_at = now()
      WHERE code_hash = ${b64(sha256(code))} AND used_at IS NULL AND expires_at > now() AND challenge = ${b64(sha256(verifier))}
      RETURNING user_id
    )
    SELECT u.id, u.token_version FROM users u WHERE u.id IN (SELECT user_id FROM used)`;
  return (rows[0] as { id: string; token_version: number } | undefined) ?? null;
};

// Página (no navegador do sistema) que devolve o controle ao app pelo esquema thinkrplay://. Meta refresh em vez de script, por causa da CSP;
// o botão cobre os casos em que o navegador exige um toque para abrir o app.
export const returnToApp = (res: VercelResponse, params: { code?: string; error?: string }) => {
  const query = new URLSearchParams(params.code ? { code: params.code } : { error: params.error ?? 'failed' }).toString();
  const link = `${APP_SCHEME}://auth?${query}`;
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(200);
  res.end(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="refresh" content="0;url=${link}"><title>Voltando ao Thinkrplay</title>
<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:system-ui,sans-serif;background:#0f0b2a;color:#fff;text-align:center;padding:24px}a{display:inline-block;margin-top:20px;background:#6a35f5;color:#fff;padding:14px 28px;border-radius:12px;font-weight:700;text-decoration:none}</style></head>
<body><main><h1>${params.code ? 'Login concluído' : 'Não foi possível entrar'}</h1><p>Voltando ao app...</p><a href="${link}">Abrir o Thinkrplay</a></main></body></html>`);
};
