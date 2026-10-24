// Pontuação calculada somente no servidor.
const clamp = (v: number) => Math.max(20, Math.min(4000, Math.round(v)));

export const scoreSudoku = (level: number, seconds: number) => clamp(200 + level * 3 - Math.floor(seconds / 5));
export const scoreMemory = (level: number, moves: number, pairs: number) => clamp(150 + level * 2 - (moves - pairs) * 8);
export const scoreHanoi = (level: number, n: number, moves: number, optimal: number) =>
  clamp(100 + n * 20 + level - (moves - optimal) * 3);
export const scoreLights = (level: number, taps: number, par: number) =>
  clamp(100 + level * 2 - Math.max(0, taps - par) * 5);
export const scoreSequence = (level: number, mistakes: number) => clamp(100 + level * 2 - mistakes * 20);
export const scoreMastermind = (level: number, guesses: number, attempts: number) =>
  clamp(100 + level * 2 + (attempts - guesses) * 15);

// Segundos mínimos plausíveis por ação para um humano; abaixo disso a partida é recusada.
export const MIN_SECONDS_PER_ACTION: Record<string, number> = {
  sudoku: 0.8,
  memory: 0.6,
  hanoi: 0.25,
  lights: 0.25,
  sequence: 1.5,
  mastermind: 2,
};
