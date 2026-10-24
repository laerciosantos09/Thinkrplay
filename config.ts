import { GameInfo } from './types';

export const APP_NAME = 'Mentalize';
export const APP_TAGLINE = 'Jogos de raciocínio para exercitar a mente';
export const MAX_LEVEL = 1000;

export const GAMES: GameInfo[] = [
  { id: '1', name: 'Sudoku', slug: 'sudoku', description: 'Lógica e números', icon: '🔢', color: 'bg-blue-500' },
  { id: '2', name: 'Memória', slug: 'memory', description: 'Encontre os pares', icon: '🧩', color: 'bg-purple-500' },
  { id: '3', name: 'Sequências', slug: 'sequence', description: 'Descubra o próximo número', icon: '🔍', color: 'bg-amber-500' },
  { id: '4', name: 'Torre de Hanói', slug: 'hanoi', description: 'Planeje cada movimento', icon: '🗼', color: 'bg-emerald-500' },
  { id: '5', name: 'Luzes', slug: 'lights', description: 'Apague todas as luzes', icon: '💡', color: 'bg-rose-500' },
  { id: '6', name: 'Código Secreto', slug: 'mastermind', description: 'Decifre a combinação', icon: '🎯', color: 'bg-cyan-500' },
];
