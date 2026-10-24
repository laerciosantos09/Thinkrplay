import React from 'react';
import RankingTable from './RankingTable';
import { MAX_LEVEL } from '../config';
import { PlayCtl } from '../services/usePlay';

interface GameShellProps {
  title: string;
  slug: string;
  ctl: PlayCtl;
  onBack: () => void;
  stats?: React.ReactNode;
  children: React.ReactNode;
}

const GameShell: React.FC<GameShellProps> = ({ title, slug, ctl, onBack, stats, children }) => {
  const { level, unlocked, setLevel } = ctl;
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
      <div className="lg:col-span-2 bg-white p-4 sm:p-6 rounded-3xl shadow-sm border border-slate-100">
        <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
          <button onClick={onBack} className="text-slate-400 hover:text-indigo-600 font-bold py-2">
            &larr; Voltar
          </button>
          <div className="text-center">
            <h2 className="text-2xl font-black text-slate-800">{title}</h2>
            {stats && <div className="text-xs text-slate-400 font-bold uppercase tracking-widest">{stats}</div>}
          </div>
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
            <button
              aria-label="Nível anterior"
              disabled={level <= 1}
              onClick={() => setLevel(level - 1)}
              className="w-9 h-9 bg-white rounded shadow-sm hover:bg-indigo-50 disabled:opacity-40"
            >
              &lsaquo;
            </button>
            <span className="px-2 font-bold text-slate-700 min-w-[84px] text-center">Nível {level}</span>
            <button
              aria-label="Próximo nível"
              disabled={level >= Math.min(unlocked, MAX_LEVEL)}
              onClick={() => setLevel(level + 1)}
              className="w-9 h-9 bg-white rounded shadow-sm hover:bg-indigo-50 disabled:opacity-40"
            >
              &rsaquo;
            </button>
          </div>
        </div>

        {ctl.error && (
          <div role="alert" className="mb-4 p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-sm font-bold">
            {ctl.error}
            <button onClick={ctl.restart} className="ml-3 underline">Nova partida</button>
          </div>
        )}
        {ctl.play ? children : !ctl.error && <p className="text-center text-slate-400 py-16">Preparando partida...</p>}
      </div>
      <RankingTable slug={slug} refreshKey={ctl.rankingKey} />
    </div>
  );
};

export const WinPanel: React.FC<{ title: string; text: string; ctl: PlayCtl }> = ({ title, text, ctl }) => {
  if (!ctl.result) return null;
  return (
    <div className="mt-6 p-6 bg-green-50 rounded-2xl border border-green-200 text-center animate-fadeIn">
      <h3 className="text-xl font-black text-green-700 mb-1">{title}</h3>
      <p className="text-green-700">{text}</p>
      <p className="font-black text-green-800 text-2xl my-2">+{ctl.result.points} pontos</p>
      <div className="flex gap-3 justify-center mt-3">
        <button onClick={ctl.restart} className="bg-white text-green-700 border border-green-300 px-6 py-2 rounded-full font-bold">
          Repetir
        </button>
        {ctl.level < ctl.unlocked && (
          <button onClick={() => ctl.setLevel(ctl.level + 1)} className="bg-green-600 text-white px-8 py-2 rounded-full font-bold shadow-lg hover:bg-green-700">
            Próximo nível
          </button>
        )}
      </div>
    </div>
  );
};

export default GameShell;
