import { Rng, shuffle } from './rng.js';
import { Tier, lerpInt } from './tiers.js';

export type Grid = number[][]; // 0 = vazio

const emptyGrid = (): Grid => Array.from({ length: 9 }, () => Array(9).fill(0));

export const canPlace = (g: Grid, r: number, c: number, n: number) => {
  for (let i = 0; i < 9; i++) {
    if (g[r][i] === n || g[i][c] === n) return false;
  }
  const br = r - (r % 3);
  const bc = c - (c % 3);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) if (g[br + i][bc + j] === n) return false;
  return true;
};

// Conta soluções (até `limit`) escolhendo sempre a célula com menos candidatos.
export const countSolutions = (g: Grid, limit = 2): number => {
  let best: [number, number] | null = null;
  let bestOptions: number[] = [];
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (g[r][c] !== 0) continue;
      const options = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((n) => canPlace(g, r, c, n));
      if (best === null || options.length < bestOptions.length) {
        best = [r, c];
        bestOptions = options;
        if (options.length === 0) return 0;
      }
    }
  }
  if (best === null) return 1;
  let total = 0;
  const [r, c] = best;
  for (const n of bestOptions) {
    g[r][c] = n;
    total += countSolutions(g, limit - total);
    g[r][c] = 0;
    if (total >= limit) break;
  }
  return total;
};

const fillSolved = (g: Grid, rng: Rng): boolean => {
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (g[r][c] !== 0) continue;
      for (const n of shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9], rng)) {
        if (!canPlace(g, r, c, n)) continue;
        g[r][c] = n;
        if (fillSolved(g, rng)) return true;
        g[r][c] = 0;
      }
      return false;
    }
  }
  return true;
};

// Menos dicas = mais difícil. Dentro de cada tier a quantidade cai aos poucos.
const CLUES: Record<Tier, [number, number]> = { easy: [40, 36], medium: [34, 30], hard: [29, 25] };
export const cluesFor = (tier: Tier, challenge: number) => lerpInt(challenge, ...CLUES[tier]);

export const generateSudoku = (rng: Rng, tier: Tier, challenge: number) => {
  const solution = emptyGrid();
  fillSolved(solution, rng);

  const puzzle = solution.map((row) => [...row]);
  const target = cluesFor(tier, challenge);
  let clues = 81;
  for (const idx of shuffle(Array.from({ length: 81 }, (_, i) => i), rng)) {
    if (clues <= target) break;
    const r = Math.floor(idx / 9);
    const c = idx % 9;
    const saved = puzzle[r][c];
    puzzle[r][c] = 0;
    if (countSolutions(puzzle.map((row) => [...row])) !== 1) puzzle[r][c] = saved;
    else clues--;
  }
  return { puzzle, solution };
};
