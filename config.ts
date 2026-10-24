import { GameInfo } from './types';
import { Tier } from './lib/tiers';

export const APP_NAME = 'Thinkrplay';
export const APP_TAGLINE = 'Jogos de raciocínio para treinar a mente';

// E-mail de suporte exibido no Perfil e citado nos Termos e na Política de Privacidade (opcional, mas recomendado).
// Defina na Vercel (Environment Variables): VITE_SUPPORT_EMAIL.
export const SUPPORT_EMAIL: string | undefined = import.meta.env.VITE_SUPPORT_EMAIL || undefined;

// ---- Anúncios (Google AdSense) -------------------------------------------------------------------------------
// Tudo vem de variáveis de build da Vercel (valores públicos). Sem VITE_ADSENSE_CLIENT nenhum anúncio é carregado,
// mesmo que o administrador ligue o interruptor em Configurações. Veja o README ("Anúncios").
export type AdPlacement = 'home' | 'ranking' | 'result';

export const ADS = {
  client: import.meta.env.VITE_ADSENSE_CLIENT || undefined, // ca-pub-XXXXXXXXXXXXXXXX
  slots: {
    home: import.meta.env.VITE_ADSENSE_SLOT_HOME || undefined, // painel de jogos
    ranking: import.meta.env.VITE_ADSENSE_SLOT_RANKING || undefined, // tela de ranking
    result: import.meta.env.VITE_ADSENSE_SLOT_RESULT || undefined, // depois de concluir um desafio
  } as Record<AdPlacement, string | undefined>,
  test: import.meta.env.VITE_ADSENSE_TEST === 'true', // anúncios de teste (não contam impressões nem cliques)
};

// Texto do preço mostrado na tela do Premium (ex.: "R$ 9,90 por mês"). Deve ser igual ao preço cadastrado no Stripe.
export const PREMIUM_PRICE_LABEL: string | undefined = import.meta.env.VITE_PREMIUM_PRICE_LABEL || undefined;

export const TIER_LABELS: Record<Tier, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };

export const GAMES: GameInfo[] = [
  { id: '1', name: 'Sudoku', slug: 'sudoku', description: 'Lógica e números', icon: '🔢', color: 'bg-linear-to-br from-sky-400 to-blue-600' },
  { id: '2', name: 'Memória', slug: 'memory', description: 'Encontre os pares', icon: '🧩', color: 'bg-linear-to-br from-fuchsia-400 to-purple-600' },
  { id: '3', name: 'Sequências', slug: 'sequence', description: 'Descubra o próximo número', icon: '🔍', color: 'bg-linear-to-br from-amber-300 to-orange-500' },
  { id: '4', name: 'Torre de Hanói', slug: 'hanoi', description: 'Planeje cada movimento', icon: '🗼', color: 'bg-linear-to-br from-emerald-300 to-teal-600' },
  { id: '5', name: 'Luzes', slug: 'lights', description: 'Apague todas as luzes', icon: '💡', color: 'bg-linear-to-br from-rose-400 to-pink-600' },
  { id: '6', name: 'Código Secreto', slug: 'mastermind', description: 'Decifre a combinação', icon: '🎯', color: 'bg-linear-to-br from-cyan-300 to-indigo-500' },
];
