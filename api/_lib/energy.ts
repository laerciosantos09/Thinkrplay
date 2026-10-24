import { orIfMissing, sql } from './db.js';
import { ENERGY, EnergyPlan } from '../../lib/energy.js';

export const planFor = (premium: boolean): EnergyPlan => (premium ? ENERGY.premium : ENERGY.free);

export interface EnergyState {
  capacity: number;
  intervalSec: number;
  charges: number; // partidas disponíveis agora
  nextRefillAt: string | null; // quando volta a próxima (null = estoque cheio)
}

// Estado atual (só leitura): soma o que já recarregou desde a última contabilização.
export const energyState = async (userId: string, premium: boolean): Promise<EnergyState> => {
  const plan = planFor(premium);
  const rows = await orIfMissing(
    () => sql`SELECT charges, refilled_at, extract(epoch FROM (now() - refilled_at))::float AS elapsed FROM play_energy WHERE user_id = ${userId}`,
    [] as Record<string, any>[],
  );
  const row = rows[0];
  if (!row) return { ...plan, charges: plan.capacity, nextRefillAt: null };
  const regen = Math.floor(row.elapsed / plan.intervalSec);
  const charges = Math.min(plan.capacity, row.charges + regen);
  const next = charges >= plan.capacity ? null : new Date(new Date(row.refilled_at).getTime() + (regen + 1) * plan.intervalSec * 1000).toISOString();
  return { ...plan, charges, nextRefillAt: next };
};

// Gasta 1 partida, de forma atômica (duas partidas simultâneas não gastam a mesma). false = sem partidas.
// A recarga já ganha é somada; o "relógio" avança só pelas recargas contadas, preservando o tempo parcial até a próxima.
export const consumeEnergy = async (userId: string, premium: boolean): Promise<boolean> => {
  const { capacity, intervalSec } = planFor(premium);
  // Sem a tabela (migração 007 pendente) não limita: o jogo não pode parar por causa de uma migração.
  const rows = await orIfMissing(() => sql`
    INSERT INTO play_energy (user_id, charges, refilled_at) VALUES (${userId}, ${capacity - 1}, now())
    ON CONFLICT (user_id) DO UPDATE SET
      charges = LEAST(${capacity}::int, play_energy.charges + floor(extract(epoch FROM (now() - play_energy.refilled_at)) / ${intervalSec})::int) - 1,
      refilled_at = CASE
        WHEN LEAST(${capacity}::int, play_energy.charges + floor(extract(epoch FROM (now() - play_energy.refilled_at)) / ${intervalSec})::int) >= ${capacity}::int
          THEN now()
        ELSE play_energy.refilled_at + make_interval(secs => floor(extract(epoch FROM (now() - play_energy.refilled_at)) / ${intervalSec}) * ${intervalSec})
      END
    WHERE LEAST(${capacity}::int, play_energy.charges + floor(extract(epoch FROM (now() - play_energy.refilled_at)) / ${intervalSec})::int) >= 1
    RETURNING charges`, [{ charges: 0 }] as Record<string, any>[]);
  return rows.length > 0;
};

// Devolve 1 partida (usado se algo falhar depois de gastar, antes de a partida existir).
export const refundEnergy = async (userId: string, premium: boolean) => {
  const { capacity } = planFor(premium);
  await orIfMissing(() => sql`UPDATE play_energy SET charges = LEAST(${capacity}::int, charges + 1) WHERE user_id = ${userId}`, []);
};
