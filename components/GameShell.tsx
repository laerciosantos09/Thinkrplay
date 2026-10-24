import React from 'react';
import RankingTable from './RankingTable';
import { MAX_LEVEL } from '../config';

interface GameShellProps {
  title: string;
  slug: string;
  level: number;
  unlocked: number;
  onLevel: (level: number) => void;
  onBack: () => void;
  rankingKey: number;
  stats?: React.ReactNode;
  children: React.ReactNode;
}

const GameShell: React.FC<GameShellProps> = ({
  title, slug, level, unlocked, onLevel, onBack, rankingKey, stats, children,
}) => (
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
            onClick={() => onLevel(level - 1)}
            className="w-9 h-9 bg-white rounded shadow-sm hover:bg-indigo-50 disabled:opacity-40"
          >
            &lsaquo;
          </button>
          <span className="px-2 font-bold text-slate-700 min-w-[84px] text-center">Nível {level}</span>
          <button
            aria-label="Próximo nível"
            disabled={level >= Math.min(unlocked, MAX_LEVEL)}
            onClick={() => onLevel(level + 1)}
            className="w-9 h-9 bg-white rounded shadow-sm hover:bg-indigo-50 disabled:opacity-40"
          >
            &rsaquo;
          </button>
        </div>
      </div>
      {children}
    </div>
    <RankingTable slug={slug} refreshKey={rankingKey} />
  </div>
);

export const WinPanel: React.FC<{
  title: string;
  text: string;
  points: number;
  saveError: string | null;
  canAdvance: boolean;
  onNext: () => void;
  onRetry: () => void;
}> = ({ title, text, points, saveError, canAdvance, onNext, onRetry }) => (
  <div className="mt-6 p-6 bg-green-50 rounded-2xl border border-green-200 text-center animate-fadeIn">
    <h3 className="text-xl font-black text-green-700 mb-1">{title}</h3>
    <p className="text-green-700">{text}</p>
    <p className="font-black text-green-800 text-2xl my-2">+{points} pontos</p>
    {saveError && <p className="text-sm text-amber-700 mb-2">{saveError}</p>}
    <div className="flex gap-3 justify-center mt-3">
      <button onClick={onRetry} className="bg-white text-green-700 border border-green-300 px-6 py-2 rounded-full font-bold">
        Repetir
      </button>
      {canAdvance && (
        <button onClick={onNext} className="bg-green-600 text-white px-8 py-2 rounded-full font-bold shadow-lg hover:bg-green-700">
          Próximo nível
        </button>
      )}
    </div>
  </div>
);

export default GameShell;
