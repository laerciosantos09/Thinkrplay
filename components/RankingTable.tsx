import React, { useEffect, useRef, useState } from 'react';
import { RankingPeriod, Score } from '../types';
import { fetchPastRanking, fetchRanking } from '../services/api';

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
  // Períodos anteriores: back = 0 é o atual (atualiza sozinho); 1, 2... são os já encerrados (não mudam mais).
  const [back, setBack] = useState(0);
  const [past, setPast] = useState<{ start: string; rows: Score[] } | null>(null);
  const [pastError, setPastError] = useState<string | null>(null);

  useEffect(() => {
    setScores(null);
    setUpdatedAt(null);
    setBack(0);
  }, [slug]);

  useEffect(() => {
    if (back === 0) {
      setPast(null);
      return;
    }
    let alive = true;
    setPast(null);
    setPastError(null);
    fetchPastRanking(slug, period, back)
      .then((r) => alive && setPast({ start: r.start, rows: r.rows }))
      .catch((e: Error) => alive && setPastError(e.message));
    return () => { alive = false; };
  }, [slug, period, back]);

  useEffect(() => {
    let alive = true;
    const load = () => {
      if (loading.current || document.hidden || back > 0) return; // período encerrado não precisa atualizar
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
  }, [slug, refreshKey, back]);

  const list = back > 0 ? past?.rows ?? [] : scores?.[period] ?? [];
  const loaded = back > 0 ? past !== null : scores !== null;
  const failed = back > 0 ? pastError : error;

  // Rótulo do período encerrado, a partir do primeiro dia dele (AAAA-MM-DD).
  const label = (() => {
    if (back === 0 || !past) return null;
    const d = new Date(`${past.start}T12:00:00`);
    if (period === 'daily') return d.toLocaleDateString('pt-BR');
    if (period === 'weekly') return `Semana de ${d.toLocaleDateString('pt-BR')}`;
    if (period === 'monthly') return d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    return String(d.getFullYear());
  })();

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
              onClick={() => { setPeriod(p.value); setBack(0); }}
              className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                period === p.value ? 'bg-brand-600 text-white shadow-md shadow-brand-200' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex items-center justify-between gap-2 mt-3 text-xs font-bold">
          <button onClick={() => setBack(back + 1)} disabled={back >= 400} className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 disabled:opacity-40">← Anterior</button>
          <span className="text-slate-500 truncate">{back === 0 ? 'Em andamento' : label ?? '...'}</span>
          <button onClick={() => setBack(back - 1)} disabled={back === 0} className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 disabled:opacity-40">Próximo →</button>
        </div>
      </div>

      <div className="p-4">
        {failed && !loaded ? (
          <p className="text-center py-8 text-red-500 text-sm">{failed}</p>
        ) : !loaded ? (
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
                          {s.premium && <span title="Assinante Premium" aria-label="Premium" className="ml-1">⭐</span>}
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
