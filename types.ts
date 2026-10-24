export interface User {
  id: string;
  username: string;
  email: string;
  role?: 'user' | 'admin';
}

export interface Score {
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
