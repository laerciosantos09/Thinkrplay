import { RankingPeriod, Score, User } from '../types';

let onUnauthorized: () => void = () => {};
export const setUnauthorizedHandler = (fn: () => void) => {
  onUnauthorized = fn;
};

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

// A sessão vive em um cookie HttpOnly: o JavaScript da página nunca enxerga o token.
const request = async <T,>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> => {
  let res: Response;
  try {
    res = await fetch(`/api/${path}`, {
      method: init.method ?? (init.body !== undefined ? 'POST' : 'GET'),
      headers: init.body !== undefined ? { 'Content-Type': 'application/json' } : {},
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      credentials: 'same-origin',
    });
  } catch {
    throw new ApiError(0, 'Sem conexão. Verifique sua internet e tente novamente.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && !path.startsWith('auth/')) onUnauthorized();
    throw new ApiError(res.status, data.error ?? 'Algo deu errado.');
  }
  return data as T;
};

export const fetchMe = () => request<{ user: User }>('auth/me');
export const login = (email: string, password: string) => request<{ user: User }>('auth/login', { body: { email, password } });
export const register = (body: { username: string; email: string; password: string; secretWord: string }) =>
  request<{ user: User }>('auth/register', { body });
export const logout = () => request<{ ok: true }>('auth/logout', { body: {} });
export const recoverPassword = (body: { email: string; secretWord: string; newPassword: string }) =>
  request<{ ok: true }>('auth/recover', { body });

export const fetchProgress = () => request<Record<string, number>>('progress');
export const fetchRanking = (game: string) =>
  request<Record<RankingPeriod, Score[]>>(`ranking?game=${encodeURIComponent(game)}`);

export interface StartedPlay {
  playId: string;
  level: number;
  seed?: number;
  puzzles?: { shown: number[]; options: number[]; hint: string }[];
}
export interface PlayResult { points: number; unlocked: number }

export const startPlay = (game: string, level: number) => request<StartedPlay>('play/start', { body: { game, level } });
export const finishPlay = (playId: string, proof: unknown) => request<PlayResult>('play/finish', { body: { playId, proof } });
export const guessPlay = <T,>(playId: string, body: Record<string, unknown>) =>
  request<T>('play/guess', { body: { playId, ...body } });
