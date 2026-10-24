import type { VercelRequest, VercelResponse } from '@vercel/node';
import { SignJWT, jwtVerify } from 'jose';
import { HttpError, assertDb, sql } from './db.js';

export interface Session {
  id: string;
  username: string;
  role: string;
  version: number; // token_version do usuário: trocar a senha invalida as sessões antigas
}

export const GAME_SLUGS = ['sudoku', 'memory', 'sequence', 'hanoi', 'lights', 'mastermind'];

const COOKIE = 'session';
const MAX_AGE = 60 * 60 * 24 * 30;

const secret = () => {
  const value = process.env.JWT_SECRET;
  if (!value || value.length < 32) throw new HttpError(500, 'JWT_SECRET não configurado (mínimo 32 caracteres).');
  return new TextEncoder().encode(value);
};

const isLocal = (req: VercelRequest) => /^(localhost|127\.0\.0\.1)(:|$)/.test(String(req.headers.host ?? ''));

export const startSession = async (
  req: VercelRequest,
  res: VercelResponse,
  user: { id: string; version: number },
) => {
  const token = await new SignJWT({ v: user.version })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(user.id)
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret());
  res.setHeader(
    'Set-Cookie',
    `${COOKIE}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${MAX_AGE}${isLocal(req) ? '' : '; Secure'}`,
  );
};

export const endSession = (res: VercelResponse) =>
  res.setHeader('Set-Cookie', `${COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`);

const readCookie = (req: VercelRequest, name: string) =>
  String(req.headers.cookie ?? '')
    .split(';')
    .map((c) => c.trim().split('='))
    .find(([k]) => k === name)?.[1];

const EXPIRED = 'Sessão expirada. Entre novamente.';

// Confere o token E o usuário no banco: conta excluída, senha trocada ou perfil rebaixado valem na hora.
export const requireSession = async (req: VercelRequest): Promise<Session> => {
  const token = readCookie(req, COOKIE);
  if (!token) throw new HttpError(401, EXPIRED);
  let id: string;
  let version: unknown;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ['HS256'] });
    id = String(payload.sub);
    version = payload.v;
  } catch {
    throw new HttpError(401, EXPIRED);
  }
  const rows = await sql`SELECT username, role, token_version FROM users WHERE id = ${id}`;
  const user = rows[0];
  if (!user || user.token_version !== version) throw new HttpError(401, EXPIRED);
  return { id, username: user.username, role: user.role, version: user.token_version };
};

// Sessão opcional (rotas públicas que personalizam a resposta quando há alguém logado).
export const optionalSession = async (req: VercelRequest): Promise<Session | null> => {
  try {
    return await requireSession(req);
  } catch (err) {
    if (err instanceof HttpError && err.status === 401) return null;
    throw err;
  }
};

export const requireAdmin = async (req: VercelRequest): Promise<Session> => {
  const session = await requireSession(req);
  if (session.role !== 'admin') throw new HttpError(403, 'Acesso restrito a administradores.');
  return session;
};

export const clientIp = (req: VercelRequest) =>
  String(req.headers['x-forwarded-for'] ?? req.socket?.remoteAddress ?? 'unknown').split(',')[0].trim();

type Handler = (req: VercelRequest, res: VercelResponse) => Promise<unknown>;

export const route = (methods: string[], handler: Handler) =>
  async (req: VercelRequest, res: VercelResponse) => {
    try {
      if (!methods.includes(req.method ?? '')) {
        res.setHeader('Allow', methods.join(', '));
        throw new HttpError(405, 'Método não permitido.');
      }
      // Defesa extra contra CSRF (além do SameSite=Strict): POST só da própria origem.
      if (req.method !== 'GET') {
        const origin = req.headers.origin;
        if (origin && new URL(origin).host !== req.headers.host) throw new HttpError(403, 'Origem não permitida.');
        if (!String(req.headers['content-type'] ?? '').includes('application/json')) {
          throw new HttpError(415, 'Conteúdo inválido.');
        }
      }
      assertDb();
      const body = await handler(req, res);
      res.setHeader('Cache-Control', 'no-store');
      res.status(200).json(body);
    } catch (err) {
      if (err instanceof HttpError && (err.status < 500 || err.expose)) {
        res.status(err.status).json({ error: err.message, ...(err.extra ?? {}) });
      } else {
        // Detalhes de configuração/infraestrutura ficam só no log do servidor, nunca na resposta.
        console.error(err instanceof HttpError ? err.message : err);
        res.status(500).json({ error: 'Erro interno. Tente novamente.' });
      }
    }
  };

export const str = (value: unknown, field: string, min: number, max: number) => {
  if (typeof value !== 'string') throw new HttpError(400, `Campo inválido: ${field}.`);
  const trimmed = value.trim();
  if (trimmed.length < min || trimmed.length > max) {
    throw new HttpError(400, `${field} deve ter entre ${min} e ${max} caracteres.`);
  }
  return trimmed;
};
