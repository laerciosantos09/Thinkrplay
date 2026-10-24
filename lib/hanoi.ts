import { Rng } from './rng.js';
import { Tier, lerpInt } from './tiers.js';

const DISKS: Record<Tier, [number, number]> = { easy: [4, 6], medium: [6, 7], hard: [7, 8] };

export interface HanoiPuzzle {
  disks: number;
  pegs: number[][]; // 3 torres, do disco maior (base) ao menor (topo)
  goal: number; // torre de destino
  optimal: number; // menor número de movimentos possível
}

// Aplica um movimento; devolve null se for ilegal.
export const moveDisk = (pegs: number[][], from: number, to: number): number[][] | null => {
  if (![from, to].every((p) => Number.isInteger(p) && p >= 0 && p < 3) || from === to) return null;
  const disk = pegs[from][pegs[from].length - 1];
  if (disk === undefined) return null;
  const top = pegs[to][pegs[to].length - 1];
  if (top !== undefined && top < disk) return null;
  const next = pegs.map((p) => [...p]);
  next[from].pop();
  next[to].push(disk);
  return next;
};

export const isGoal = (pegs: number[][], goal: number, disks: number) => pegs[goal].length === disks;

// Busca em largura sobre os 3^n estados: menor número de movimentos até a torre de destino.
const shortestSolution = (assign: number[], goal: number) => {
  const n = assign.length;
  const encode = (a: number[]) => a.reduce((acc, p) => acc * 3 + p, 0);
  const target = encode(Array(n).fill(goal));
  const seen = new Set([encode(assign)]);
  let frontier = [assign];
  for (let depth = 0; frontier.length; depth++) {
    const next: number[][] = [];
    for (const state of frontier) {
      if (encode(state) === target) return depth;
      // Disco 0 é o maior; o topo de cada torre é o disco de MAIOR índice (o menor) nela.
      const top: number[] = [-1, -1, -1];
      for (let d = 0; d < n; d++) top[state[d]] = d;
      for (let from = 0; from < 3; from++) {
        const disk = top[from];
        if (disk < 0) continue;
        for (let to = 0; to < 3; to++) {
          if (to === from || (top[to] >= 0 && top[to] > disk)) continue; // não pode sobre disco menor
          const moved = state.slice();
          moved[disk] = to;
          const key = encode(moved);
          if (!seen.has(key)) {
            seen.add(key);
            next.push(moved);
          }
        }
      }
    }
    frontier = next;
  }
  return -1;
};

// Configurações (disco -> torre, destino) numeradas de 0 a 3^(n+1)-1. Dentro de cada faixa de discos, os desafios
// percorrem esses números com um passo coprimo ao total (bijeção): nunca repetem enquanto couberem no espaço.
const STEP = 7919;
const classicCode = (_disks: number) => 2; // tudo na torre 0 (dígitos 0) e destino 2

const decode = (code: number, disks: number) => {
  const goal = code % 3;
  let rest = Math.floor(code / 3);
  const assign: number[] = [];
  for (let d = disks - 1; d >= 0; d--) {
    assign[d] = rest % 3;
    rest = Math.floor(rest / 3);
  }
  return { assign, goal };
};

export const generateHanoi = (_rng: Rng, tier: Tier, challenge: number): HanoiPuzzle => {
  const disks = lerpInt(challenge, ...DISKS[tier]);
  const total = 3 ** (disks + 1);
  // posição do desafio dentro do bloco de desafios que usam esta mesma quantidade de discos
  let first = challenge;
  while (first > 1 && lerpInt(first - 1, ...DISKS[tier]) === disks) first--;
  const base = disks * 104729 + (tier === 'easy' ? 0 : tier === 'medium' ? 31 : 67);

  let code = (base + (challenge - first) * STEP) % total;
  if (tier === 'easy' && challenge === 1) code = classicCode(disks); // primeiro desafio: o clássico
  let state = decode(code, disks);
  // evita estados já resolvidos e o clássico (reservado ao primeiro desafio do Easy)
  while (state.assign.every((p) => p === state.goal) || (challenge > 1 || tier !== 'easy' ? code === classicCode(disks) : false)) {
    code = (code + 1) % total;
    state = decode(code, disks);
  }

  const { assign, goal } = state;
  const pegs: number[][] = [[], [], []];
  assign.forEach((p, d) => pegs[p].push(disks - d)); // tamanhos de n (maior) a 1 (menor), base -> topo
  return { disks, pegs, goal, optimal: shortestSolution(assign, goal) };
};
