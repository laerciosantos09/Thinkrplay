import { mulberry32, shuffle } from './rng.js';

export const EMOJIS = ['🚀', '🍕', '🎸', '⚽', '🕹️', '🎨', '🦁', '🌙', '🌊', '🔥', '💎', '🍒', '🎭', '🚲', '🍔', '🍦'];

export const pairsForLevel = (level: number) => Math.min(12, 3 + Math.ceil(level / 4));

export const buildDeck = (seed: number, level: number) => {
  const rng = mulberry32(seed);
  const chosen = shuffle(EMOJIS, rng).slice(0, pairsForLevel(level));
  return shuffle([...chosen, ...chosen], rng);
};
