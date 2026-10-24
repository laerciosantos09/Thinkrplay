import React from 'react';
import { TIER_LABELS } from '../config';
import { TIERS, TierProgress, UNLOCK_RULES, nextLockedTier, unlockStatus } from '../lib/tiers';

const plural = (n: number) => `${n} ${n === 1 ? 'desafio' : 'desafios'}`;

// Contador do próximo nível a liberar + observação com as regras de liberação.
const UnlockInfo: React.FC<{ progress: TierProgress }> = ({ progress }) => {
  const next = nextLockedTier(progress);
  if (!next) {
    return (
      <p className="mb-4 rounded-2xl bg-mint-300/15 border border-mint-400/40 px-4 py-3 text-sm font-bold text-ink-800">
        ✅ Todos os níveis liberados neste jogo. Bom jogo!
      </p>
    );
  }
  const status = unlockStatus(next, progress)!;
  const pct = Math.round((status.solved / status.needed) * 100);

  return (
    <div className="mb-4 rounded-2xl border border-brand-100 bg-brand-50/60 p-4" aria-live="polite">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <p className="text-sm font-extrabold text-ink-800">🔒 Próximo nível: {TIER_LABELS[next]}</p>
        <p className="text-sm font-black text-brand-700">
          Faltam {plural(status.remaining)} no {TIER_LABELS[status.from]}
        </p>
      </div>
      <div
        role="progressbar" aria-label={`Progresso para liberar o ${TIER_LABELS[next]}`}
        aria-valuemin={0} aria-valuemax={status.needed} aria-valuenow={status.solved}
        className="mt-2 h-2.5 overflow-hidden rounded-full bg-white"
      >
        <div className="h-full rounded-full bg-linear-to-r from-brand-500 to-mint-400 transition-all" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-1 text-right text-[11px] font-bold text-slate-400">{status.solved}/{status.needed}</p>

      <div className="mt-2 border-t border-brand-100 pt-3 text-xs text-slate-600">
        <p className="mb-1 font-extrabold text-ink-800">Como liberar os outros níveis</p>
        <ul className="space-y-0.5">
          {TIERS.filter((t) => UNLOCK_RULES[t]).map((t) => {
            const rule = UNLOCK_RULES[t]!;
            const done = unlockStatus(t, progress)!.unlocked;
            return (
              <li key={t}>
                {done ? '✅' : '🔒'} <strong>{TIER_LABELS[t]}</strong>: resolva {plural(rule.needed)} no {TIER_LABELS[rule.from]}
                {done ? ' (liberado)' : ''}
              </li>
            );
          })}
        </ul>
        <p className="mt-2 text-slate-500">
          Observação: o progresso vale por jogo e cada desafio conta uma vez, no primeiro acerto. Repetir um desafio já resolvido não conta.
        </p>
      </div>
    </div>
  );
};

export default UnlockInfo;
