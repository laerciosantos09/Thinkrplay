import React, { useEffect, useRef, useState } from 'react';
import { RankingPeriod, Score } from '../types';
import { fetchRanking } from '../services/api';

interface RankingTableProps {
  slug: string; // slug do jogo ou "all" (ranking geral)
  refreshKey?: number; // muda quando o próprio usuário conclui um desafio
}

const periods: { label: string; value: RankingPeriod }[] = [
  { label: 'Diário', value: 'daily' },
  { label: 'Semanal', value: 'weekly' },
  { label: 'Mensal', value: 'monthly' },
  { label: 'Anual', value: 'yearly' },
];

// Os rankings são calculados no servidor a cada consulta, então qualquer desafio concluído por qualquer
// jogador aparece na próxima atualização. A tela atualiza sozinha enquanto está visível.
const POLL_MS = 20_000;

const RankingTable: React.FC<RankingTableProps> = ({ slug, refreshKey = 0 }) => {
  const [period, setPeriod] = useState<RankingPeriod>('daily');
  const [scores, setScores] = useState<Record<RankingPeriod, Score[]> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const loading = useRef(false);

  useEffect(() => {
    setScores(null);
    setUpdatedAt(null);
  }, [slug]);

  useEffect(() => {
    let alive = true;
    const load = () => {
      if (loading.current || document.hidden) return;
      loading.current = true;
      fetchRanking(slug)
        .then((data) => {
          if (!alive) return;
          setScores(data);
          setError(null);
          setUpdatedAt(new Date());
        })
        .catch((e: Error) => alive && setError(e.message))
        .finally(() => {
          loading.current = false;
        });
    };
    loading.current = false;
    load();
    const timer = setInterval(load, POLL_MS);
    const onVisible = () => !document.hidden && load();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      alive = false;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [slug, refreshKey]);

  const list = scores?.[period] ?? [];

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="p-6 border-b border-slate-100">
        <div className="flex items-center justify-between gap-2 mb-4">
          <h3 className="text-lg font-bold text-ink-800">{slug === 'all' ? 'Ranking Geral' : 'Mural de Líderes'}</h3>
          {updatedAt && (
            <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1.5" title="Atualiza sozinho a cada 20 segundos">
              <span className="w-1.5 h-1.5 rounded-full bg-mint-400 animate-pulse" />
              {updatedAt.toLocaleTimeString('pt-BR')}
            </span>
          )}
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {periods.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                period === p.value ? 'bg-brand-600 text-white shadow-md shadow-brand-200' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4">
        {error && !scores ? (
          <p className="text-center py-8 text-red-500 text-sm">{error}</p>
        ) : !scores ? (
          <p className="text-center py-8 text-slate-400 text-sm">Carregando...</p>
        ) : list.length === 0 ? (
          <p className="text-center py-8 text-slate-400 text-sm">Nenhum recorde neste período.</p>
        ) : (
          <ol className="space-y-3">
            {list.map((s, idx) => {
              const gap = idx > 0 && s.position > list[idx - 1].position + 1; // sua posição fora do top 10
              return (
                <React.Fragment key={`${s.position}-${s.username}`}>
                  {gap && <li aria-hidden="true" className="text-center text-slate-300 leading-none">⋮</li>}
                  <li className={`flex items-center justify-between p-3 rounded-xl ${s.isMe ? 'bg-brand-50 ring-2 ring-brand-300' : 'bg-slate-50'}`}>
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className={`w-8 h-8 shrink-0 flex items-center justify-center rounded-lg font-bold text-sm ${
                          s.position === 1 ? 'bg-yellow-100 text-yellow-700'
                          : s.position === 2 ? 'bg-slate-200 text-slate-700'
                          : s.position === 3 ? 'bg-amber-100 text-amber-700'
                          : 'bg-white text-slate-400 border border-slate-200'
                        }`}
                      >
                        {s.position}
                      </span>
                      <div className="min-w-0">
                        <p className="font-bold text-slate-700 text-sm truncate">
                          {s.username}
                          {s.isMe && <span className="ml-1.5 text-[10px] font-black uppercase text-brand-700">você</span>}
                        </p>
                        <p className="text-[10px] text-slate-400 uppercase tracking-wider">
                          {s.solved} {s.solved === 1 ? 'desafio' : 'desafios'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-black text-brand-600">{s.score}</p>
                      <p className="text-[10px] text-slate-400">{new Date(s.date).toLocaleDateString('pt-BR')}</p>
                    </div>
                  </li>
                </React.Fragment>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
};

export default RankingTable;
