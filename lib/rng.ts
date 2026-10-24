// Gerador pseudo-aleatório determinístico: o mesmo nível gera sempre o mesmo desafio.
export const mulberry32 = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export type Rng = () => number;

export const seedFor = (game: string, level: number) => {
  let h = 2166136261;
  for (const ch of `${game}:${level}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
};

export const shuffle = <T,>(items: T[], rng: Rng): T[] => {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

export const randInt = (rng: Rng, min: number, max: number) => min + Math.floor(rng() * (max - min + 1));
