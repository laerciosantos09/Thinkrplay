import React, { useEffect, useState } from 'react';
import { RankingPeriod, Score } from '../types';
import { fetchRanking } from '../services/api';

interface RankingTableProps {
  slug: string;
  refreshKey?: number;
}

const periods: { label: string; value: RankingPeriod }[] = [
  { label: 'Diário', value: 'daily' },
  { label: 'Semanal', value: 'weekly' },
  { label: 'Mensal', value: 'monthly' },
  { label: 'Anual', value: 'yearly' },
];

const RankingTable: React.FC<RankingTableProps> = ({ slug, refreshKey = 0 }) => {
  const [period, setPeriod] = useState<RankingPeriod>('daily');
  const [scores, setScores] = useState<Record<RankingPeriod, Score[]> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setError(null);
    fetchRanking(slug)
      .then((data) => alive && setScores(data))
      .catch((e: Error) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [slug, refreshKey]);

  const list = scores?.[period] ?? [];

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="p-6 border-b border-slate-100">
        <h3 className="text-lg font-bold text-slate-800 mb-4">Mural de Líderes</h3>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {periods.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                period === p.value
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4">
        {error ? (
          <p className="text-center py-8 text-red-500 text-sm">{error}</p>
        ) : !scores ? (
          <p className="text-center py-8 text-slate-400 text-sm">Carregando...</p>
        ) : list.length === 0 ? (
          <p className="text-center py-8 text-slate-400 text-sm">Nenhum recorde neste período.</p>
        ) : (
          <div className="space-y-3">
            {list.map((s, idx) => (
              <div key={`${s.username}-${idx}`} className="flex items-center justify-between p-3 rounded-xl bg-slate-50">
                <div className="flex items-center gap-3">
                  <span
                    className={`w-8 h-8 flex items-center justify-center rounded-lg font-bold text-sm ${
                      idx === 0
                        ? 'bg-yellow-100 text-yellow-700'
                        : idx === 1
                          ? 'bg-slate-200 text-slate-700'
                          : idx === 2
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-white text-slate-400 border border-slate-200'
                    }`}
                  >
                    {idx + 1}
                  </span>
                  <div>
                    <p className="font-bold text-slate-700 text-sm">{s.username}</p>
                    <p className="text-[10px] text-slate-400 uppercase tracking-wider">Até o nível {s.level}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-black text-indigo-600">{s.score}</p>
                  <p className="text-[10px] text-slate-400">{new Date(s.date).toLocaleDateString('pt-BR')}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default RankingTable;
