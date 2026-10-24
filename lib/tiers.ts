export const TIERS = ['easy', 'medium', 'hard'] as const;
export type Tier = (typeof TIERS)[number];

export const CHALLENGES_PER_TIER = 500;

// Cada tier (exceto o primeiro) é liberado, por jogo, ao resolver N desafios do tier anterior.
export const UNLOCK_RULES: Record<Tier, { from: Tier; needed: number } | null> = {
  easy: null,
  medium: { from: 'easy', needed: 10 },
  hard: { from: 'medium', needed: 20 },
};

// Desafios resolvidos por tier, em um jogo.
export type TierProgress = Record<Tier, number>;

export const emptyProgress = (): TierProgress => ({ easy: 0, medium: 0, hard: 0 });

export const isTier = (value: unknown): value is Tier => TIERS.includes(value as Tier);

export const isTierUnlocked = (tier: Tier, progress: TierProgress) => {
  const rule = UNLOCK_RULES[tier];
  return !rule || progress[rule.from] >= rule.needed;
};

export interface UnlockStatus {
  from: Tier; // nível em que os desafios precisam ser resolvidos
  needed: number;
  solved: number; // desafios contados (no máximo `needed`)
  remaining: number; // quantos faltam para liberar
  unlocked: boolean;
}

// Situação de liberação de um nível (null para o Easy, que já começa liberado).
export const unlockStatus = (tier: Tier, progress: TierProgress): UnlockStatus | null => {
  const rule = UNLOCK_RULES[tier];
  if (!rule) return null;
  const solved = progress[rule.from];
  return {
    from: rule.from,
    needed: rule.needed,
    solved: Math.min(solved, rule.needed),
    remaining: Math.max(0, rule.needed - solved),
    unlocked: solved >= rule.needed,
  };
};

// Próximo nível ainda bloqueado (o que o jogador está tentando liberar) ou null se todos estão liberados.
export const nextLockedTier = (progress: TierProgress): Tier | null =>
  TIERS.find((t) => !isTierUnlocked(t, progress)) ?? null;

// Os desafios de um tier abrem em sequência: o próximo é sempre (resolvidos + 1).
export const maxChallenge = (tier: Tier, progress: TierProgress) =>
  Math.min(CHALLENGES_PER_TIER, progress[tier] + 1);

export const highestUnlocked = (progress: TierProgress): Tier =>
  [...TIERS].reverse().find((t) => isTierUnlocked(t, progress)) ?? 'easy';

// Posição (0..1) do desafio dentro do tier, usada para subir a dificuldade aos poucos.
export const t01 = (challenge: number) => (challenge - 1) / (CHALLENGES_PER_TIER - 1);
export const lerpInt = (challenge: number, from: number, to: number) => Math.round(from + (to - from) * t01(challenge));
