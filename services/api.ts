import { GameSetting, RankingPeriod, Score, User } from '../types';
import { Tier, TierProgress } from '../lib/tiers';

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

// A sessão é um cookie: perguntar pelo perfil também diz se há alguém logado.
export const fetchProfile = () => request<{ user: User }>('profile');
export const login = (email: string, password: string) => request<{ user: User }>('auth/login', { body: { email, password } });
export const register = (body: { username: string; email: string; password: string; secretWord: string; acceptTerms: boolean }) =>
  request<{ user: User }>('auth/register', { body });
export const updateUsername = (username: string) =>
  request<{ user: User }>('profile', { body: { action: 'username', username } });
export const changePassword = (currentPassword: string, newPassword: string) =>
  request<{ ok: true }>('profile', { body: { action: 'password', currentPassword, newPassword } });
export const deleteAccount = (password: string, confirm: string) =>
  request<{ ok: true }>('profile', { body: { action: 'delete', password, confirm } });
export const acceptTerms = () => request<{ user: User }>('profile', { body: { action: 'accept_terms' } });
export const logout = () => request<{ ok: true }>('auth/logout', { body: {} });
export const recoverPassword = (body: { email: string; secretWord: string; newPassword: string }) =>
  request<{ ok: true }>('auth/recover', { body });

// Desafios resolvidos por jogo e nível.
// Configurações do app: jogos habilitados e anúncios (qualquer usuário logado lê; só admin altera).
export interface AppSettings {
  games: GameSetting[];
  ads: { enabled: boolean };
}
export const fetchSettings = () => request<AppSettings>('settings');
export const setGameEnabled = (game: string, enabled: boolean) => request<AppSettings>('settings', { body: { game, enabled } });
export const setAdsEnabled = (enabled: boolean) => request<AppSettings>('settings', { body: { setting: 'ads', enabled } });

export const fetchProgress = () => request<Record<string, Partial<TierProgress>>>('progress');
export const fetchRanking = (game: string) =>
  request<Record<RankingPeriod, Score[]>>(`ranking?game=${encodeURIComponent(game)}`);

export interface StartedPlay {
  playId: string;
  tier: Tier;
  challenge: number;
  scored: boolean; // false = desafio já resolvido antes (repetição não pontua)
  seed?: number;
  puzzles?: { shown: number[]; options: number[]; hint: string }[];
}
export interface PlayResult { points: number; awarded: boolean; progress: TierProgress }

export const startPlay = (game: string, tier: Tier, challenge: number) =>
  request<StartedPlay>('play/start', { body: { game, tier, challenge } });
export const finishPlay = (playId: string, proof: unknown) => request<PlayResult>('play/finish', { body: { playId, proof } });
export const guessPlay = <T,>(playId: string, body: Record<string, unknown>) =>
  request<T>('play/guess', { body: { playId, ...body } });
