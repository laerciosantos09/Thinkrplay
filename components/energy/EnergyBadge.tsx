import React, { useEffect, useState } from 'react';
import { formatCountdown, useEnergy } from './EnergyContext';

// "⚡ 17/20 · +1 em 7:32": estoque de partidas com contagem regressiva ao vivo. Some se o limite estiver desligado.
const EnergyBadge: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { energy, refresh } = useEnergy();
  const state = energy?.enabled ? energy.state : null;
  const [now, setNow] = useState(() => Date.now());
  const next = state?.nextRefillAt ? new Date(state.nextRefillAt).getTime() : null;

  useEffect(() => {
    if (next === null) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [next]);

  // Chegou a hora de uma recarga: pergunta ao servidor o estoque atualizado.
  useEffect(() => {
    if (next === null || now < next) return;
    const t = setTimeout(() => refresh().catch(() => {}), 400);
    return () => clearTimeout(t);
  }, [now, next, refresh]);

  if (!state) return null;
  const empty = state.charges === 0;
  return (
    <span
      title={`Partidas em sequência: ${state.capacity} no máximo, +1 a cada ${Math.round(state.intervalSec / 60)} min`}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-black ${empty ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-800'} ${className}`}
    >
      <span aria-hidden="true">⚡</span>
      <span aria-label={`${state.charges} de ${state.capacity} partidas`}>{state.charges}/{state.capacity}</span>
      {next !== null && <span className="font-bold opacity-70">· +1 em {formatCountdown(next - now)}</span>}
    </span>
  );
};

export default EnergyBadge;
