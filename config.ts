import { GameInfo } from './types';
import { Tier } from './lib/tiers';

export const APP_NAME = 'Thinkrplay';
export const APP_TAGLINE = 'Jogos de raciocínio para treinar a mente';

// Identificação do responsável pelo serviço, exibida nos Termos e na Política de Privacidade.
// Defina na Vercel (Settings > Environment Variables) antes de publicar: VITE_LEGAL_CONTROLLER e VITE_LEGAL_CONTACT_EMAIL.
export const LEGAL_CONTROLLER = import.meta.env.VITE_LEGAL_CONTROLLER ?? '[defina VITE_LEGAL_CONTROLLER: nome ou razão social e CPF/CNPJ]';
export const LEGAL_CONTACT_EMAIL = import.meta.env.VITE_LEGAL_CONTACT_EMAIL ?? '[defina VITE_LEGAL_CONTACT_EMAIL]';

export const TIER_LABELS: Record<Tier, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };

export const GAMES: GameInfo[] = [
  { id: '1', name: 'Sudoku', slug: 'sudoku', description: 'Lógica e números', icon: '🔢', color: 'bg-linear-to-br from-sky-400 to-blue-600' },
  { id: '2', name: 'Memória', slug: 'memory', description: 'Encontre os pares', icon: '🧩', color: 'bg-linear-to-br from-fuchsia-400 to-purple-600' },
  { id: '3', name: 'Sequências', slug: 'sequence', description: 'Descubra o próximo número', icon: '🔍', color: 'bg-linear-to-br from-amber-300 to-orange-500' },
  { id: '4', name: 'Torre de Hanói', slug: 'hanoi', description: 'Planeje cada movimento', icon: '🗼', color: 'bg-linear-to-br from-emerald-300 to-teal-600' },
  { id: '5', name: 'Luzes', slug: 'lights', description: 'Apague todas as luzes', icon: '💡', color: 'bg-linear-to-br from-rose-400 to-pink-600' },
  { id: '6', name: 'Código Secreto', slug: 'mastermind', description: 'Decifre a combinação', icon: '🎯', color: 'bg-linear-to-br from-cyan-300 to-indigo-500' },
];
