import { Rng } from './rng';

export const PALETTE = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#a855f7', '#ec4899', '#14b8a6', '#78716c'];

export const configForLevel = (level: number) => ({
  length: Math.min(6, 3 + Math.floor(level / 8)),
  colors: Math.min(8, 4 + Math.floor(level / 5)),
  attempts: 10,
});

export const generateCode = (rng: Rng, level: number) => {
  const { length, colors } = configForLevel(level);
  return Array.from({ length }, () => Math.floor(rng() * colors));
};

// exact = cor e posição certas; partial = cor certa em outra posição.
export const evaluate = (code: number[], guess: number[]) => {
  let exact = 0;
  const codeLeft: number[] = [];
  const guessLeft: number[] = [];
  code.forEach((c, i) => {
    if (c === guess[i]) exact++;
    else {
      codeLeft.push(c);
      guessLeft.push(guess[i]);
    }
  });
  let partial = 0;
  for (const g of guessLeft) {
    const idx = codeLeft.indexOf(g);
    if (idx >= 0) {
      partial++;
      codeLeft.splice(idx, 1);
    }
  }
  return { exact, partial };
};
