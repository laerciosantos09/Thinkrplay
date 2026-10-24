import { RankingPeriod, Score, Session } from '../types';

const SESSION_KEY = 'mentalize_session';

export const loadSession = (): Session | null => {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
};

export const storeSession = (session: Session | null) => {
  try {
    if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    /* armazenamento indisponível: a sessão vale só para esta aba */
  }
};

let onUnauthorized: () => void = () => {};
export const setUnauthorizedHandler = (fn: () => void) => {
  onUnauthorized = fn;
};

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const request = async <T,>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> => {
  const token = loadSession()?.token;
  let res: Response;
  try {
    res = await fetch(`/api/${path}`, {
      method: init.method ?? (init.body ? 'POST' : 'GET'),
      headers: {
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: init.body ? JSON.stringify(init.body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'Sem conexão. Verifique sua internet e tente novamente.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && token) onUnauthorized();
    throw new ApiError(res.status, data.error ?? 'Algo deu errado.');
  }
  return data as T;
};

export const login = (email: string, password: string) =>
  request<Session>('auth/login', { body: { email, password } });

export const register = (body: { username: string; email: string; password: string; secretWord: string }) =>
  request<Session>('auth/register', { body });

export const recoverPassword = (body: { email: string; secretWord: string; newPassword: string }) =>
  request<{ ok: true }>('auth/recover', { body });

export const fetchProgress = () => request<Record<string, number>>('progress');

export const submitScore = (game: string, level: number, points: number) =>
  request<{ unlocked: number }>('scores', { body: { game, level, points } });

export const fetchRanking = (game: string) =>
  request<Record<RankingPeriod, Score[]>>(`ranking?game=${encodeURIComponent(game)}`);
