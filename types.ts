export type LoginProvider = 'google' | 'apple';
export type LoginMethod = 'password' | LoginProvider;

export interface User {
  id: string;
  username: string;
  email: string;
  role?: 'user' | 'admin';
  createdAt?: string | null;
  needsTerms?: boolean; // ainda não aceitou a versão atual dos Termos/Privacidade
  signupMethod?: 'password' | LoginProvider; // por onde a conta foi criada
  loginMethods?: LoginMethod[]; // flags: formas de entrar ativas
  hasPassword?: boolean; // contas criadas pelo Google/Apple começam sem senha
  connections?: LoginProvider[]; // provedores de login conectados
}

export interface Score {
  position: number;
  isMe: boolean;
  premium?: boolean; // assinante Premium (selo)
  username: string;
  score: number;
  solved: number; // desafios resolvidos no período
  date: string;
}

export type RankingPeriod = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface GameInfo {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
  color: string;
}

export interface GameSetting {
  slug: string;
  enabled: boolean;
  updatedAt: string | null;
}
