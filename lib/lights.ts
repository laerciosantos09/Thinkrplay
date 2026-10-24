import { Rng } from './rng.js';
import { Tier, lerpInt } from './tiers.js';

export type Board = boolean[][]; // true = acesa

// Tabuleiro cresce com o tier; os primeiros desafios do Easy são 3x3.
export const sizeFor = (tier: Tier, challenge: number) => {
  if (tier === 'easy') return challenge <= 6 ? 3 : challenge <= 200 ? 4 : 5;
  if (tier === 'medium') return challenge <= 250 ? 5 : 6;
  return challenge <= 250 ? 6 : 7;
};

const TAPS: Record<Tier, [number, number]> = { easy: [4, 9], medium: [8, 14], hard: [12, 22] };

export const press = (board: Board, r: number, c: number): Board => {
  const next = board.map((row) => [...row]);
  for (const [dr, dc] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const rr = r + dr;
    const cc = c + dc;
    if (rr >= 0 && cc >= 0 && rr < next.length && cc < next.length) next[rr][cc] = !next[rr][cc];
  }
  return next;
};

// Parte do tabuleiro apagado e aplica toques aleatórios: sempre tem solução.
export const generateLights = (rng: Rng, tier: Tier, challenge: number) => {
  const size = sizeFor(tier, challenge);
  let board: Board = Array.from({ length: size }, () => Array(size).fill(false));
  const taps = Math.min(size * size - 1, lerpInt(challenge, ...TAPS[tier]));
  const used = new Set<number>();
  while (used.size < taps) used.add(Math.floor(rng() * size * size));
  for (const cell of used) board = press(board, Math.floor(cell / size), cell % size);
  if (board.every((row) => row.every((v) => !v))) board = press(board, 0, 0);
  return { board, par: used.size };
};

export const isSolved = (board: Board) => board.every((row) => row.every((v) => !v));
