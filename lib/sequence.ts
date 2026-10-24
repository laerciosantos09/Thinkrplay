import { Rng, randInt, shuffle } from './rng.js';
import { Tier, t01 } from './tiers.js';

export interface SequencePuzzle {
  shown: number[];
  answer: number;
  options: number[];
  hint: string;
}

// `k` (0..1) é a posição do desafio dentro do tier: números e passos crescem com ele.
type Maker = (rng: Rng, k: number) => { seq: number[]; hint: string };

const build = (len: number, f: (i: number) => number) => Array.from({ length: len }, (_, i) => f(i));
const scale = (k: number, base: number, extra: number) => base + Math.round(k * extra);

const arithmetic: Maker = (rng, k) => {
  const start = randInt(rng, 1, scale(k, 10, 40));
  const step = randInt(rng, 2, scale(k, 5, 12));
  return { seq: build(7, (i) => start + step * i), hint: 'Soma um valor fixo a cada passo.' };
};

const descending: Maker = (rng, k) => {
  const step = randInt(rng, 2, scale(k, 5, 12));
  const start = step * 8 + randInt(rng, 5, scale(k, 20, 60));
  return { seq: build(7, (i) => start - step * i), hint: 'Subtrai um valor fixo a cada passo.' };
};

const geometric: Maker = (rng, k) => {
  const start = randInt(rng, 1, scale(k, 3, 5));
  const ratio = randInt(rng, 2, k > 0.5 ? 4 : 3);
  return { seq: build(6, (i) => start * ratio ** i), hint: 'Multiplica por um valor fixo.' };
};

const growingDiff: Maker = (rng, k) => {
  const start = randInt(rng, 1, 15);
  const d = randInt(rng, 1, scale(k, 2, 5));
  let value = start - d;
  return { seq: build(7, (i) => (value += d + i)), hint: 'A diferença entre os números aumenta a cada passo.' };
};

const squares: Maker = (rng, k) => {
  const offset = randInt(rng, 0, scale(k, 4, 8));
  const add = randInt(rng, -3, scale(k, 4, 10));
  return { seq: build(7, (i) => (i + 1 + offset) ** 2 + add), hint: 'Pense em quadrados perfeitos.' };
};

const cubes: Maker = (rng, k) => {
  const offset = randInt(rng, 0, scale(k, 2, 4));
  return { seq: build(6, (i) => (i + 1 + offset) ** 3), hint: 'Pense em cubos perfeitos.' };
};

const triangular: Maker = (rng, k) => {
  const offset = randInt(rng, 0, scale(k, 3, 8));
  return { seq: build(7, (i) => ((i + 1 + offset) * (i + 2 + offset)) / 2), hint: 'Some 1, depois 2, depois 3...' };
};

const fibonacci: Maker = (rng, k) => {
  const a = randInt(rng, 1, scale(k, 4, 8));
  const b = randInt(rng, 1, scale(k, 5, 9));
  const seq = [a, b];
  while (seq.length < 8) seq.push(seq[seq.length - 1] + seq[seq.length - 2]);
  return { seq, hint: 'Cada número é a soma dos dois anteriores.' };
};

const alternating: Maker = (rng, k) => {
  const s1 = randInt(rng, 1, 12);
  const d1 = randInt(rng, 1, scale(k, 3, 6));
  const s2 = randInt(rng, 30, 60);
  const d2 = randInt(rng, 1, scale(k, 3, 6));
  return {
    seq: build(8, (i) => (i % 2 === 0 ? s1 + d1 * (i / 2) : s2 - d2 * ((i - 1) / 2))),
    hint: 'Duas sequências estão intercaladas.',
  };
};

const affine: Maker = (rng, k) => {
  const a = randInt(rng, 2, 3);
  const b = randInt(rng, 1, scale(k, 3, 6));
  const seq = [randInt(rng, 1, 5)];
  while (seq.length < 6) seq.push(seq[seq.length - 1] * a + b);
  return { seq, hint: `Multiplique por ${a} e some ${b}.` };
};

// Easy: progressões simples. Medium: diferenças e potências. Hard: regras compostas.
const POOLS: Record<Tier, Maker[]> = {
  easy: [arithmetic, descending, geometric],
  medium: [arithmetic, descending, growingDiff, squares, triangular, alternating],
  hard: [fibonacci, affine, cubes, alternating, growingDiff, squares, triangular],
};

export const generateSequence = (rng: Rng, tier: Tier, challenge: number): SequencePuzzle => {
  const pool = POOLS[tier];
  const maker = pool[Math.floor(rng() * pool.length)];
  const { seq, hint } = maker(rng, t01(challenge));
  const answer = seq[seq.length - 1];
  const shown = seq.slice(0, -1);

  const options = new Set<number>([answer]);
  const spread = Math.max(2, Math.round(answer * 0.2));
  let guard = 0;
  while (options.size < 4 && guard++ < 100) {
    const candidate = answer + randInt(rng, -spread, spread);
    if (candidate !== answer && candidate > 0) options.add(candidate);
  }
  for (let n = answer + 1; options.size < 4; n++) options.add(n);

  return { shown, answer, options: shuffle([...options], rng), hint };
};
