export const disksForLevel = (level: number) => Math.min(8, 3 + Math.floor((level - 1) / 3));

export const initialPegs = (n: number) => [Array.from({ length: n }, (_, i) => n - i), [], []] as number[][];

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
