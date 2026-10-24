// Limite de partidas em sequência: cada partida iniciada gasta 1; o estoque recarrega com o tempo até o máximo.
export const ENERGY = {
  free: { capacity: 20, intervalSec: 10 * 60 }, // 20 partidas, +1 a cada 10 minutos
  premium: { capacity: 50, intervalSec: 2 * 60 }, // 50 partidas, +1 a cada 2 minutos
} as const;

export interface EnergyPlan {
  capacity: number;
  intervalSec: number;
}
