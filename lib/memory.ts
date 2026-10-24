import { mulberry32, shuffle } from './rng.js';
import { Tier, lerpInt } from './tiers.js';

export const EMOJIS = ['🚀', '🍕', '🎸', '⚽', '🕹️', '🎨', '🦁', '🌙', '🌊', '🔥', '💎', '🍒', '🎭', '🚲', '🍔', '🍦'];

const PAIRS: Record<Tier, [number, number]> = { easy: [4, 6], medium: [6, 9], hard: [9, 12] };
export const pairsFor = (tier: Tier, challenge: number) => lerpInt(challenge, ...PAIRS[tier]);

export const buildDeck = (seed: number, tier: Tier, challenge: number) => {
  const rng = mulberry32(seed);
  const chosen = shuffle(EMOJIS, rng).slice(0, pairsFor(tier, challenge));
  return shuffle([...chosen, ...chosen], rng);
};
