import type { VercelRequest, VercelResponse } from '@vercel/node';
import { SignJWT, jwtVerify } from 'jose';
import { HttpError, assertDb } from './db.js';

export interface Session {
  id: string;
  username: string;
}

const secret = () => {
  const value = process.env.JWT_SECRET;
  if (!value || value.length < 16) throw new HttpError(500, 'JWT_SECRET não configurado.');
  return new TextEncoder().encode(value);
};

export const signToken = (session: Session) =>
  new SignJWT({ username: session.username })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(session.id)
    .setExpirationTime('30d')
    .sign(secret());

export const requireSession = async (req: VercelRequest): Promise<Session> => {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!token) throw new HttpError(401, 'Sessão expirada. Entre novamente.');
  try {
    const { payload } = await jwtVerify(token, secret());
    return { id: String(payload.sub), username: String(payload.username) };
  } catch {
    throw new HttpError(401, 'Sessão expirada. Entre novamente.');
  }
};

type Handler = (req: VercelRequest) => Promise<unknown>;

export const route = (methods: string[], handler: Handler) =>
  async (req: VercelRequest, res: VercelResponse) => {
    try {
      if (!methods.includes(req.method ?? '')) {
        res.setHeader('Allow', methods.join(', '));
        throw new HttpError(405, 'Método não permitido.');
      }
      assertDb();
      const body = await handler(req);
      res.setHeader('Cache-Control', 'no-store');
      res.status(200).json(body);
    } catch (err) {
      if (err instanceof HttpError) {
        res.status(err.status).json({ error: err.message });
      } else {
        console.error(err);
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

export const GAME_LIMITS: Record<string, number> = {
  sudoku: 5000,
  memory: 5000,
  sequence: 5000,
  hanoi: 5000,
  lights: 5000,
  mastermind: 5000,
};

export const MAX_LEVEL = 1000;
