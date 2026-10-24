// Pontuação calculada somente no servidor. Tiers mais difíceis valem mais.
import { Tier } from './tiers.js';

const clamp = (v: number) => Math.max(20, Math.min(4000, Math.round(v)));
const base = (tier: Tier, challenge: number) => ({ easy: 100, medium: 180, hard: 280 })[tier] + Math.round(challenge * 0.4);

export const scoreSudoku = (tier: Tier, challenge: number, seconds: number) =>
  clamp(base(tier, challenge) + 100 - Math.floor(seconds / 5));
export const scoreMemory = (tier: Tier, challenge: number, moves: number, pairs: number) =>
  clamp(base(tier, challenge) + 50 - (moves - pairs) * 8);
export const scoreHanoi = (tier: Tier, challenge: number, disks: number, moves: number, optimal: number) =>
  clamp(base(tier, challenge) + disks * 10 - (moves - optimal) * 3);
export const scoreLights = (tier: Tier, challenge: number, taps: number, par: number) =>
  clamp(base(tier, challenge) - Math.max(0, taps - par) * 5);
export const scoreSequence = (tier: Tier, challenge: number, mistakes: number) =>
  clamp(base(tier, challenge) - mistakes * 20);
export const scoreMastermind = (tier: Tier, challenge: number, guesses: number, attempts: number) =>
  clamp(base(tier, challenge) + (attempts - guesses) * 15);

// Segundos mínimos plausíveis por ação para um humano; abaixo disso a partida é recusada.
export const MIN_SECONDS_PER_ACTION: Record<string, number> = {
  sudoku: 0.8,
  memory: 0.6,
  hanoi: 0.25,
  lights: 0.25,
  sequence: 1.5,
  mastermind: 2,
};
