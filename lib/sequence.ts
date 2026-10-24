import { Rng, randInt, shuffle } from './rng.js';

export interface SequencePuzzle {
  shown: number[];
  answer: number;
  options: number[];
  hint: string;
}

type Maker = (rng: Rng, level: number) => { seq: number[]; hint: string };

const build = (len: number, f: (i: number) => number) => Array.from({ length: len }, (_, i) => f(i));

const arithmetic: Maker = (rng, level) => {
  const start = randInt(rng, 1, 10 + level);
  const step = randInt(rng, 2, 4 + Math.floor(level / 4));
  return { seq: build(7, (i) => start + step * i), hint: 'Soma um valor fixo a cada passo.' };
};

const geometric: Maker = (rng) => {
  const start = randInt(rng, 1, 4);
  const ratio = randInt(rng, 2, 3);
  return { seq: build(6, (i) => start * ratio ** i), hint: 'Multiplica por um valor fixo.' };
};

const growingDiff: Maker = (rng, level) => {
  const start = randInt(rng, 1, 10);
  const d = randInt(rng, 1, 2 + Math.floor(level / 10));
  let value = start - d;
  return {
    seq: build(7, (i) => (value += d + i)),
    hint: 'A diferença entre os números aumenta a cada passo.',
  };
};

const squares: Maker = (rng) => {
  const offset = randInt(rng, 0, 5);
  const add = randInt(rng, -3, 5);
  return { seq: build(7, (i) => (i + 1 + offset) ** 2 + add), hint: 'Pense em quadrados perfeitos.' };
};

const fibonacci: Maker = (rng) => {
  const a = randInt(rng, 1, 5);
  const b = randInt(rng, 1, 6);
  const seq = [a, b];
  while (seq.length < 8) seq.push(seq[seq.length - 1] + seq[seq.length - 2]);
  return { seq, hint: 'Cada número é a soma dos dois anteriores.' };
};

const alternating: Maker = (rng, level) => {
  const s1 = randInt(rng, 1, 10);
  const d1 = randInt(rng, 1, 3 + Math.floor(level / 10));
  const s2 = randInt(rng, 20, 40);
  const d2 = randInt(rng, 1, 3 + Math.floor(level / 10));
  return {
    seq: build(8, (i) => (i % 2 === 0 ? s1 + d1 * (i / 2) : s2 - d2 * ((i - 1) / 2))),
    hint: 'Duas sequências estão intercaladas.',
  };
};

const MAKERS: Maker[] = [arithmetic, geometric, growingDiff, squares, fibonacci, alternating];

export const generateSequence = (rng: Rng, level: number): SequencePuzzle => {
  // Níveis iniciais só têm progressões simples; os demais liberam tipos novos.
  const pool = MAKERS.slice(0, Math.min(MAKERS.length, 2 + Math.floor(level / 3)));
  const maker = pool[Math.floor(rng() * pool.length)];
  const { seq, hint } = maker(rng, level);
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
