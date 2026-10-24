export interface User {
  id: string;
  username: string;
  email: string;
}

export interface Session {
  token: string;
  user: User;
}

export interface Score {
  username: string;
  score: number;
  level: number;
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
