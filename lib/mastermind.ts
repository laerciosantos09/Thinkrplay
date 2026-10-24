import { Rng } from './rng.js';
import { Tier, lerpInt } from './tiers.js';

export const PALETTE = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#a855f7', '#ec4899', '#14b8a6', '#78716c'];

// Tamanho e cores fixos por tier (espaço de 1.296 / 16.807 / 262.144 códigos, bem acima de 500 desafios).
// Dentro do tier a dificuldade sobe reduzindo as tentativas.
const LENGTH: Record<Tier, number> = { easy: 4, medium: 5, hard: 6 };
const COLORS: Record<Tier, number> = { easy: 6, medium: 7, hard: 8 };
const ATTEMPTS: Record<Tier, [number, number]> = { easy: [12, 10], medium: [10, 9], hard: [10, 8] };

export const configFor = (tier: Tier, challenge: number) => ({
  length: LENGTH[tier],
  colors: COLORS[tier],
  attempts: lerpInt(challenge, ...ATTEMPTS[tier]),
});

// Primeiro desafio do tier que usa o mesmo tamanho/cores deste (uma "faixa" de desafios).
export const blockStart = (tier: Tier, challenge: number) => {
  const cfg = configFor(tier, challenge);
  let first = challenge;
  while (first > 1) {
    const prev = configFor(tier, first - 1);
    if (prev.length !== cfg.length || prev.colors !== cfg.colors) break;
    first--;
  }
  return first;
};

// O `rng` deve ser semeado por FAIXA (segredo do servidor + blockStart): o deslocamento é o mesmo para a faixa
// toda e os códigos percorrem as combinações com um passo coprimo (7919 é primo), então não se repetem.
const STEP = 7919;
export const generateCode = (rng: Rng, tier: Tier, challenge: number) => {
  const { length, colors } = configFor(tier, challenge);
  const total = colors ** length;
  let index = (Math.floor(rng() * total) + (challenge - blockStart(tier, challenge)) * STEP) % total;
  const code: number[] = [];
  for (let i = 0; i < length; i++) {
    code.unshift(index % colors);
    index = Math.floor(index / colors);
  }
  return code;
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
