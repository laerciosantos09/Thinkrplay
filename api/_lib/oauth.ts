import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { VercelRequest } from '@vercel/node';
import { SignJWT, createLocalJWKSet, importPKCS8, jwtVerify, type JWTVerifyGetKey } from 'jose';
import { HttpError, sql } from './db.js';
import { isAppSettingEnabled, type AppSetting } from './games.js';
import { RESERVED_USERNAMES } from '../../lib/legal.js';

export type Provider = 'google' | 'apple';
export const PROVIDERS: Provider[] = ['google', 'apple'];
export const isProvider = (value: unknown): value is Provider => PROVIDERS.includes(value as Provider);

const env = (name: string) => process.env[name]?.trim() || undefined;

// ---- configuração (variáveis de servidor) ----------------------------------------------------------------------
export const providerConfigured = (p: Provider) =>
  p === 'google'
    ? Boolean(env('GOOGLE_CLIENT_ID') && env('GOOGLE_CLIENT_SECRET'))
    : Boolean(env('APPLE_CLIENT_ID') && env('APPLE_TEAM_ID') && env('APPLE_KEY_ID') && env('APPLE_PRIVATE_KEY'));

export const settingKey = (p: Provider): AppSetting => (p === 'google' ? 'login_google' : 'login_apple');

// Migrações 008 (tabela) e 009 (origem do cadastro) aplicadas.
export const identitiesTableExists = async () =>
  Boolean((await sql`
    SELECT to_regclass('public.oauth_identities') IS NOT NULL
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'signup_method') AS ok`)[0]?.ok);

// O botão só aparece (e o fluxo só roda) se: ligado pelo admin + variáveis definidas + tabela criada (migração 008).
export const providerAvailable = async (p: Provider) =>
  providerConfigured(p) && (await isAppSettingEnabled(settingKey(p))) && (await identitiesTableExists());

export const baseUrl = (req: VercelRequest) => {
  const configured = env('APP_URL')?.replace(/\/+$/, '');
  if (configured) return configured;
  const host = String(req.headers['x-forwarded-host'] ?? req.headers.host ?? '');
  return `${/^(localhost|127\.0\.0\.1)(:|$)/.test(host) ? 'http' : 'https'}://${host}`;
};
export const redirectUri = (req: VercelRequest, p: Provider) => `${baseUrl(req)}/api/oauth/${p}`;

// ---- estado do fluxo (cookie assinado, sem guardar nada no servidor) ------------------------------------------
export interface FlowState {
  provider: Provider;
  state: string;
  nonce: string;
  mode: 'login' | 'link';
  uid?: string; // usuário logado, quando mode = link
}
const COOKIE = 'oauth_state';
const secret = () => {
  const v = process.env.JWT_SECRET;
  if (!v || v.length < 32) throw new HttpError(500, 'JWT_SECRET não configurado.');
  return new TextEncoder().encode(v);
};
export const randomToken = () => randomBytes(24).toString('base64url');

// SameSite=None: o retorno da Apple é um POST vindo de outro site, e um cookie Lax não seria enviado.
const isLocalHost = (req: VercelRequest) => /^(localhost|127\.0\.0\.1)(:|$)/.test(String(req.headers.host ?? ''));
const cookieAttrs = (req: VercelRequest) => `HttpOnly; Path=/api/oauth; ${isLocalHost(req) ? 'SameSite=Lax' : 'SameSite=None; Secure'}`;
export const stateCookie = async (req: VercelRequest, flow: FlowState) =>
  `${COOKIE}=${await new SignJWT({ ...flow }).setProtectedHeader({ alg: 'HS256' }).setExpirationTime('10m').sign(secret())}; Max-Age=600; ${cookieAttrs(req)}`;
export const clearStateCookie = (req: VercelRequest) => `${COOKIE}=; Max-Age=0; ${cookieAttrs(req)}`;

export const readStateCookie = async (req: VercelRequest): Promise<FlowState | null> => {
  const raw = String(req.headers.cookie ?? '').split(';').map((c) => c.trim().split('=')).find(([k]) => k === COOKIE)?.[1];
  if (!raw) return null;
  try {
    const { payload } = await jwtVerify(raw, secret(), { algorithms: ['HS256'] });
    return payload as unknown as FlowState;
  } catch {
    return null;
  }
};
// ---- vínculo pendente: o e-mail do login social já tem conta com senha; confirmar a senha antes de conectar ------
export interface PendingLink { provider: Provider; sub: string; email: string; refresh?: string } // refresh já cifrado
const PENDING = 'oauth_pending';
export const pendingCookie = async (req: VercelRequest, link: PendingLink) =>
  `${PENDING}=${await new SignJWT({ ...link }).setProtectedHeader({ alg: 'HS256' }).setExpirationTime('10m').sign(secret())}; Max-Age=600; HttpOnly; Path=/api; SameSite=Lax${isLocalHost(req) ? '' : '; Secure'}`;
export const clearPendingCookie = (req: VercelRequest) => `${PENDING}=; Max-Age=0; HttpOnly; Path=/api; SameSite=Lax${isLocalHost(req) ? '' : '; Secure'}`;
export const readPendingCookie = async (req: VercelRequest): Promise<PendingLink | null> => {
  const raw = String(req.headers.cookie ?? '').split(';').map((c) => c.trim().split('=')).find(([k]) => k === PENDING)?.[1];
  if (!raw) return null;
  try {
    return (await jwtVerify(raw, secret(), { algorithms: ['HS256'] })).payload as unknown as PendingLink;
  } catch {
    return null;
  }
};
export const safeEqual = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

// ---- URLs e troca de código por token --------------------------------------------------------------------------
export const authorizeUrl = (req: VercelRequest, p: Provider, flow: FlowState) => {
  const q = new URLSearchParams({ response_type: 'code', redirect_uri: redirectUri(req, p), state: flow.state, nonce: flow.nonce });
  if (p === 'google') {
    q.set('client_id', env('GOOGLE_CLIENT_ID')!);
    q.set('scope', 'openid email profile');
    q.set('prompt', 'select_account');
    return `https://accounts.google.com/o/oauth2/v2/auth?${q}`;
  }
  q.set('client_id', env('APPLE_CLIENT_ID')!);
  q.set('scope', 'name email');
  q.set('response_mode', 'form_post'); // exigido pela Apple quando se pede nome e e-mail
  return `https://appleid.apple.com/auth/authorize?${q}`;
};

// A Apple não usa um segredo fixo: o "client secret" é um JWT assinado (ES256) com a chave .p8 e de vida curta.
const appleClientSecret = async () => {
  const key = await importPKCS8(env('APPLE_PRIVATE_KEY')!.replace(/\\n/g, '\n'), 'ES256');
  return new SignJWT({})
    .setProtectedHeader({ alg: 'ES256', kid: env('APPLE_KEY_ID')! })
    .setIssuer(env('APPLE_TEAM_ID')!)
    .setSubject(env('APPLE_CLIENT_ID')!)
    .setAudience('https://appleid.apple.com')
    .setIssuedAt()
    .setExpirationTime('10m')
    .sign(key);
};

const postForm = async (url: string, params: Record<string, string>) => {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(params).toString() });
  const data: any = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
};

export const exchangeCode = async (req: VercelRequest, p: Provider, code: string) => {
  const common = { code, grant_type: 'authorization_code', redirect_uri: redirectUri(req, p) };
  const result =
    p === 'google'
      ? await postForm('https://oauth2.googleapis.com/token', { ...common, client_id: env('GOOGLE_CLIENT_ID')!, client_secret: env('GOOGLE_CLIENT_SECRET')! })
      : await postForm('https://appleid.apple.com/auth/token', { ...common, client_id: env('APPLE_CLIENT_ID')!, client_secret: await appleClientSecret() });
  if (!result.ok || !result.data.id_token) {
    console.error(`OAuth ${p}: troca de código falhou (${result.status}): ${result.data.error_description ?? result.data.error ?? 'sem detalhe'}`);
    throw new Error('exchange_failed');
  }
  return result.data as { id_token: string; refresh_token?: string };
};

// ---- validação do id_token (assinatura, emissor, público, validade e nonce) ------------------------------------
const JWKS_URL: Record<Provider, string> = { google: 'https://www.googleapis.com/oauth2/v3/certs', apple: 'https://appleid.apple.com/auth/keys' };
const jwksCache = new Map<Provider, { keys: JWTVerifyGetKey; at: number }>();
const loadJwks = async (p: Provider, force = false) => {
  const hit = jwksCache.get(p);
  if (hit && !force && Date.now() - hit.at < 3600_000) return hit.keys;
  const res = await fetch(JWKS_URL[p]);
  if (!res.ok) throw new Error('jwks_failed');
  const keys = createLocalJWKSet(await res.json());
  jwksCache.set(p, { keys, at: Date.now() });
  return keys;
};

export interface Identity {
  providerUserId: string;
  email: string | null;
  emailVerified: boolean;
  name: string | null;
}

export const verifyIdToken = async (p: Provider, idToken: string, nonce: string): Promise<Identity> => {
  const options = {
    issuer: p === 'google' ? ['https://accounts.google.com', 'accounts.google.com'] : 'https://appleid.apple.com',
    audience: p === 'google' ? env('GOOGLE_CLIENT_ID')! : env('APPLE_CLIENT_ID')!,
  };
  let payload;
  try {
    payload = (await jwtVerify(idToken, await loadJwks(p), options)).payload;
  } catch {
    payload = (await jwtVerify(idToken, await loadJwks(p, true), options)).payload; // chaves podem ter rodado: tenta de novo uma vez
  }
  if (typeof payload.nonce !== 'string' || !safeEqual(payload.nonce, nonce)) throw new Error('nonce_mismatch');
  if (!payload.sub) throw new Error('no_subject');
  return {
    providerUserId: String(payload.sub),
    email: typeof payload.email === 'string' ? payload.email.toLowerCase() : null,
    emailVerified: payload.email_verified === true || payload.email_verified === 'true',
    name: typeof payload.name === 'string' ? payload.name : null,
  };
};

// ---- token de atualização da Apple: cifrado no banco, usado para revogar o acesso ao excluir a conta ------------
const tokenKey = () => createHash('sha256').update(`oauth-token:${env('OAUTH_TOKEN_KEY') ?? process.env.JWT_SECRET ?? ''}`).digest();
export const encryptToken = (plain: string) => {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', tokenKey(), iv);
  const body = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString('base64url');
};
export const decryptToken = (packed: string) => {
  const raw = Buffer.from(packed, 'base64url');
  const decipher = createDecipheriv('aes-256-gcm', tokenKey(), raw.subarray(0, 12));
  decipher.setAuthTag(raw.subarray(12, 28));
  return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString('utf8');
};

// Revoga o acesso do app na conta Apple (exigência da App Store ao excluir uma conta com "Entrar com a Apple").
// 400 (token já inválido/revogado) conta como feito; falha de rede/servidor interrompe a exclusão.
export const revokeApple = async (encrypted: string) => {
  if (!providerConfigured('apple')) {
    console.error('Apple não configurada: não foi possível revogar o token ao excluir a conta.');
    return;
  }
  let token: string;
  try {
    token = decryptToken(encrypted);
  } catch {
    return; // não dá para decifrar (chave trocada): nada a revogar
  }
  const result = await postForm('https://appleid.apple.com/auth/revoke', {
    client_id: env('APPLE_CLIENT_ID')!, client_secret: await appleClientSecret(), token, token_type_hint: 'refresh_token',
  });
  if (!result.ok && result.status !== 400) {
    console.error(`Apple revoke falhou (${result.status})`);
    throw new HttpError(502, 'Não foi possível desconectar sua conta Apple agora. Tente novamente em instantes.', true);
  }
};

// ---- criação de usuário a partir do provedor -------------------------------------------------------------------
const baseUsername = (identity: Identity) => {
  const source = identity.name ?? identity.email?.split('@')[0] ?? 'jogador';
  const clean = source.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9_.-]+/g, '').slice(0, 18);
  return clean.length >= 3 && !RESERVED_USERNAMES.includes(clean.toLowerCase()) ? clean : 'jogador';
};

// Cria a conta (sem senha) com um nome de usuário livre. null = o e-mail já pertence a outra conta.
export const createOAuthUser = async (identity: Identity, provider: Provider) => {
  const base = baseUsername(identity);
  for (let attempt = 0; attempt < 8; attempt++) {
    const username = attempt === 0 ? base : `${base.slice(0, 14)}${Math.floor(100 + Math.random() * 9900)}`;
    const rows = await sql`
      INSERT INTO users (username, email, password_hash, secret_hash, signup_method, email_verified)
      VALUES (${username}, ${identity.email}, NULL, NULL, ${provider}, true)
      ON CONFLICT DO NOTHING
      RETURNING id, token_version`;
    if (rows.length > 0) return rows[0] as { id: string; token_version: number };
    const taken = await sql`SELECT 1 FROM users WHERE lower(email) = ${identity.email}`;
    if (taken.length > 0) return null; // o conflito foi no e-mail (corrida), não no nome
  }
  throw new Error('username_unavailable');
};
