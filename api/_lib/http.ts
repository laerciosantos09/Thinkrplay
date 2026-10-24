import type { VercelRequest, VercelResponse } from '@vercel/node';
import { SignJWT, jwtVerify } from 'jose';
import { HttpError, assertDb } from './db.js';

export interface Session {
  id: string;
  username: string;
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

export const startSession = async (req: VercelRequest, res: VercelResponse, session: Session) => {
  const token = await new SignJWT({ username: session.username })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(session.id)
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

export const requireSession = async (req: VercelRequest): Promise<Session> => {
  const token = readCookie(req, COOKIE);
  if (!token) throw new HttpError(401, 'Sessão expirada. Entre novamente.');
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ['HS256'] });
    return { id: String(payload.sub), username: String(payload.username) };
  } catch {
    throw new HttpError(401, 'Sessão expirada. Entre novamente.');
  }
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
      if (err instanceof HttpError && err.status < 500) {
        res.status(err.status).json({ error: err.message });
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
