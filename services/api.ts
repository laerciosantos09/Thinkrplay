import { GameSetting, LoginMethod, LoginProvider, RankingPeriod, Score, User } from '../types';
import { Tier, TierProgress } from '../lib/tiers';

let onUnauthorized: () => void = () => {};
let onTermsRequired: () => void = () => {};
export const setTermsRequiredHandler = (fn: () => void) => {
  onTermsRequired = fn;
};
export const setUnauthorizedHandler = (fn: () => void) => {
  onUnauthorized = fn;
};

export class ApiError extends Error {
  constructor(public status: number, message: string, public data: Record<string, any> = {}) {
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
    if (res.status === 403 && (data.code === 'terms_required' || data.code === 'email_unverified')) onTermsRequired(); // o servidor barrou: volta para a tela de aceite
    throw new ApiError(res.status, data.error ?? 'Algo deu errado.', data);
  }
  return data as T;
};

// A sessão é um cookie: perguntar pelo perfil também diz se há alguém logado.
export const fetchProfile = () => request<{ user: User }>('profile');
// linkPending: depois de um login social que esperava a senha, conecta o provedor a esta conta.
export const login = (email: string, password: string, linkPending = false) =>
  request<{ user: User; linked: LoginProvider | null }>('auth/login', { body: { email, password, ...(linkPending ? { linkPending } : {}) } });
export interface AdminUser {
  id: string; username: string; email: string; role: string; createdAt: string;
  signupMethod: LoginMethod; emailVerified: boolean; loginMethods: LoginMethod[];
  termsAccepted: boolean; privacyAccepted: boolean;
}
export const fetchUsers = (q: string, page: number) =>
  request<{ users: AdminUser[]; total: number; page: number; pageSize: number }>(`profile?users=1&q=${encodeURIComponent(q)}&page=${page}`);
export const register = (body: { username: string; email: string; password: string; secretWord: string; acceptTerms: boolean; acceptPrivacy: boolean }) =>
  request<{ user: User }>('auth/register', { body });
export const updateUsername = (username: string) =>
  request<{ user: User }>('profile', { body: { action: 'username', username } });
// currentPassword/password ficam de fora para contas criadas pelo Google/Apple que ainda não têm senha.
export const changePassword = (currentPassword: string | undefined, newPassword: string) =>
  request<{ ok: true }>('profile', { body: { action: 'password', currentPassword, newPassword } });
export const deleteAccount = (password: string | undefined, confirm: string) =>
  request<{ ok: true }>('profile', { body: { action: 'delete', password, confirm } });
export const unlinkProvider = (provider: LoginProvider) =>
  request<{ ok: true; connections: LoginProvider[] }>('profile', { body: { action: 'unlink', provider } });
// Quais botões de login social mostrar (público: serve para a tela de login).
export const fetchProviders = () => request<Record<LoginProvider, boolean>>('oauth/providers');
// Um flag por documento: manda só o que ainda falta aceitar.
export const acceptTerms = (docs: { terms?: boolean; privacy?: boolean }) =>
  request<{ user: User }>('profile', { body: { action: 'accept_terms', ...docs } });
export const changeSecret = (currentPassword: string, secretWord: string) =>
  request<{ ok: true }>('profile', { body: { action: 'secret', currentPassword, secretWord } });
export const logoutEverywhere = () => request<{ ok: true }>('profile', { body: { action: 'logout_all' } });
export const logout = () => request<{ ok: true }>('profile', { body: { action: 'logout' } });
export const recoverPassword = (body: { email: string; secretWord: string; newPassword: string }) =>
  request<{ ok: true }>('auth/recover', { body });

// Desafios resolvidos por jogo e nível.
// Configurações do app: jogos habilitados e anúncios (qualquer usuário logado lê; só admin altera).
export interface PremiumState {
  available: boolean; // dá para assinar agora (ligado pelo admin e Stripe configurado)
  active: boolean; // este usuário é Premium
  status: string | null;
  renewsAt: string | null;
  cancelAtPeriodEnd: boolean;
  // só para administradores:
  enabled?: boolean;
  configured?: boolean;
  subscribers?: number;
}
// Limite de partidas em sequência ("energia"): estoque que recarrega com o tempo.
export interface EnergyPlan { capacity: number; intervalSec: number }
export interface EnergyState extends EnergyPlan {
  charges: number; // partidas disponíveis agora
  nextRefillAt: string | null; // quando volta a próxima (null = estoque cheio)
}
export interface EnergySettings {
  enabled: boolean;
  free: EnergyPlan;
  premium: EnergyPlan;
  state: EnergyState | null; // deste usuário (só quando o limite está ligado)
}
export interface LoginProviderState {
  available: boolean; // o botão aparece (ligado + variáveis + migração)
  // só para administradores:
  enabled?: boolean;
  configured?: boolean;
}
export interface AppSettings {
  games: GameSetting[];
  ads: { enabled: boolean };
  premium: PremiumState;
  energy: EnergySettings;
  login: Record<LoginProvider, LoginProviderState>;
  emailVerification: { available: boolean; enabled?: boolean; configured?: boolean };
  setup?: { missingMigrations: string[]; missingEnv?: { name: string; why: string }[] }; // só para administradores: migrações do banco que faltam
}
export const fetchSettings = () => request<AppSettings>('settings');
export const setGameEnabled = (game: string, enabled: boolean) => request<AppSettings>('settings', { body: { game, enabled } });
export const setAdsEnabled = (enabled: boolean) => request<AppSettings>('settings', { body: { setting: 'ads', enabled } });
export const setEnergyEnabled = (enabled: boolean) => request<AppSettings>('settings', { body: { setting: 'energy', enabled } });
export const setLoginEnabled = (provider: LoginProvider, enabled: boolean) =>
  request<AppSettings>('settings', { body: { setting: `login_${provider}`, enabled } });
export const setEmailVerificationEnabled = (enabled: boolean) =>
  request<AppSettings>('settings', { body: { setting: 'email_verification', enabled } });
export const resendVerification = () => request<{ ok: true }>('profile', { body: { action: 'resend_verification' } });
export interface SuspiciousUser { id: string; username: string; email: string; flagged: number; plays: number; bestRatio: number; lastAt: string }
export const fetchSuspicious = () => request<{ available: boolean; threshold: number; users: SuspiciousUser[] }>('profile?suspicious=1');
export const setPremiumEnabled = (enabled: boolean) => request<AppSettings>('settings', { body: { setting: 'premium', enabled } });

// Premium: abre o pagamento / o portal de assinatura do Stripe (devolvem a URL para redirecionar).
export const startCheckout = () => request<{ url: string }>('billing', { body: { action: 'checkout' } });
export const openBillingPortal = () => request<{ url: string }>('billing', { body: { action: 'portal' } });

export const fetchProgress = () => request<Record<string, Partial<TierProgress>>>('progress');
export const fetchRanking = (game: string) =>
  request<Record<RankingPeriod, Score[]>>(`ranking?game=${encodeURIComponent(game)}`);

export interface StartedPlay {
  playId: string;
  tier: Tier;
  challenge: number;
  scored: boolean; // false = desafio já resolvido antes (repetição não pontua)
  energy?: EnergyState | null; // estoque de partidas depois de gastar esta (se o limite estiver ligado)
  seed?: number;
  puzzles?: { shown: number[]; options: number[]; hint: string }[];
}
export interface PlayResult { points: number; awarded: boolean; progress: TierProgress }

export const startPlay = (game: string, tier: Tier, challenge: number) =>
  request<StartedPlay>('play/start', { body: { game, tier, challenge } });
export const finishPlay = (playId: string, proof: unknown) => request<PlayResult>('play/finish', { body: { playId, proof } });
export const guessPlay = <T,>(playId: string, body: Record<string, unknown>) =>
  request<T>('play/guess', { body: { playId, ...body } });
