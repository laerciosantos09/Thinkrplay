import { Rng } from './rng';

export type Board = boolean[][]; // true = acesa

export const sizeForLevel = (level: number) => Math.min(7, 3 + Math.floor(level / 10));

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
export const generateLights = (rng: Rng, level: number) => {
  const size = sizeForLevel(level);
  let board: Board = Array.from({ length: size }, () => Array(size).fill(false));
  const taps = Math.min(size * size - 1, 3 + Math.floor(level / 3));
  const used = new Set<number>();
  while (used.size < taps) used.add(Math.floor(rng() * size * size));
  for (const cell of used) board = press(board, Math.floor(cell / size), cell % size);
  if (board.every((row) => row.every((v) => !v))) board = press(board, 0, 0);
  return { board, par: used.size };
};

export const isSolved = (board: Board) => board.every((row) => row.every((v) => !v));
