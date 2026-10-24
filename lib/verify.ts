// Verificação de partidas: roda no servidor, que refaz o jogo a partir da semente.
import { generateSudoku } from './sudoku.js';
import { buildDeck } from './memory.js';
import { disksForLevel, initialPegs, moveDisk } from './hanoi.js';
import { generateLights, isSolved, press } from './lights.js';
import { mulberry32 } from './rng.js';

const isPair = (v: unknown): v is [number, number] =>
  Array.isArray(v) && v.length === 2 && v.every((n) => Number.isInteger(n));

export interface Verified {
  ok: boolean;
  reason?: string;
  actions: number; // jogadas, usado para exigir um tempo mínimo plausível
  par?: number;
}

const fail = (reason: string): Verified => ({ ok: false, reason, actions: 0 });

export const verifySudoku = (seed: number, level: number, proof: any): Verified => {
  const { puzzle, solution } = generateSudoku(mulberry32(seed), level);
  const board = proof?.board;
  const valid =
    Array.isArray(board) && board.length === 9 &&
    board.every((row: unknown, r: number) =>
      Array.isArray(row) && row.length === 9 && row.every((v: unknown, c: number) => v === solution[r][c]));
  if (!valid) return fail('Solução incorreta.');
  return { ok: true, actions: puzzle.flat().filter((v) => v === 0).length };
};

export const verifyMemory = (seed: number, level: number, proof: any): Verified => {
  const deck = buildDeck(seed, level);
  const flips = proof?.flips;
  if (!Array.isArray(flips) || flips.length === 0 || flips.length > deck.length * 20) return fail('Jogadas inválidas.');
  const matched = new Set<number>();
  for (const flip of flips) {
    if (!isPair(flip)) return fail('Jogadas inválidas.');
    const [a, b] = flip;
    if (a === b || [a, b].some((i) => i < 0 || i >= deck.length || matched.has(i))) return fail('Jogadas inválidas.');
    if (deck[a] === deck[b]) matched.add(a).add(b);
  }
  if (matched.size !== deck.length) return fail('A partida não foi concluída.');
  return { ok: true, actions: flips.length, par: deck.length / 2 };
};

export const verifyHanoi = (_seed: number, level: number, proof: any): Verified => {
  const n = disksForLevel(level);
  const moves = proof?.moves;
  if (!Array.isArray(moves) || moves.length < 2 ** n - 1 || moves.length > 2 ** n * 8) return fail('Jogadas inválidas.');
  let pegs: number[][] | null = initialPegs(n);
  for (const m of moves) {
    if (!isPair(m)) return fail('Jogadas inválidas.');
    pegs = moveDisk(pegs, m[0], m[1]);
    if (!pegs) return fail('Movimento ilegal.');
  }
  if (pegs[2].length !== n) return fail('A partida não foi concluída.');
  return { ok: true, actions: moves.length, par: 2 ** n - 1 };
};

export const verifyLights = (seed: number, level: number, proof: any): Verified => {
  const { board, par } = generateLights(mulberry32(seed), level);
  const taps = proof?.taps;
  const size = board.length;
  if (!Array.isArray(taps) || taps.length === 0 || taps.length > size * size * 6) return fail('Jogadas inválidas.');
  let current = board;
  for (const t of taps) {
    if (!isPair(t) || t.some((v) => v < 0 || v >= size)) return fail('Jogadas inválidas.');
    current = press(current, t[0], t[1]);
  }
  if (!isSolved(current)) return fail('A partida não foi concluída.');
  return { ok: true, actions: taps.length, par };
};

export const VERIFIERS = {
  sudoku: verifySudoku,
  memory: verifyMemory,
  hanoi: verifyHanoi,
  lights: verifyLights,
} as const;
