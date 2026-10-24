import React from 'react';
import { GAMES } from '../config';

interface DashboardProps {
  onSelectGame: (slug: string) => void;
  onGoToRanking: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ onSelectGame, onGoToRanking }) => (
  <div className="max-w-6xl mx-auto animate-fadeIn">
    <header className="mb-10 text-center">
      <h1 className="text-3xl md:text-5xl font-extrabold text-ink-900 mb-3">Qual <span className="text-gradient">desafio</span> hoje?</h1>
      <p className="text-slate-500 text-lg mb-6">Escolha um jogo de raciocínio e suba no ranking.</p>
      <button
        onClick={onGoToRanking}
        className="inline-flex items-center gap-2 bg-brand-50 text-brand-700 px-6 py-3 rounded-full font-black text-sm hover:bg-brand-100 transition-colors border border-brand-200"
      >
        🏆 Ver Rankings Globais
      </button>
    </header>

    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-8">
      {GAMES.map((game) => (
        <button
          key={game.id}
          onClick={() => onSelectGame(game.slug)}
          className="group relative bg-white p-6 sm:p-8 rounded-3xl shadow-sm border border-slate-100 text-left hover:shadow-xl hover:-translate-y-1 transition-all"
        >
          <div className={`w-16 h-16 ${game.color} rounded-2xl flex items-center justify-center text-3xl mb-5 shadow-lg group-hover:scale-110 transition-transform`}>
            {game.icon}
          </div>
          <h2 className="text-2xl font-bold text-ink-800 mb-1">{game.name}</h2>
          <p className="text-slate-500 mb-5">{game.description}</p>
          <span className="text-brand-600 font-bold">Jogar agora &rarr;</span>
          <span className="absolute top-4 right-4 bg-slate-100 text-slate-400 text-[10px] px-2 py-1 rounded-full uppercase font-bold tracking-tighter">
            1000 níveis
          </span>
        </button>
      ))}
    </div>
  </div>
);

export default Dashboard;
