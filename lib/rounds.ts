export const SEQUENCE_ROUNDS = 3;
export const sequenceSeed = (seed: number, round: number) => (seed + round * 7919) >>> 0;
