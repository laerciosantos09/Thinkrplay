import React from 'react';
import { User } from '../types';
import { APP_NAME } from '../config';

interface NavbarProps {
  user: User;
  onLogout: () => void;
  onHome: () => void;
  onRanking: () => void;
}

const Navbar: React.FC<NavbarProps> = ({ user, onLogout, onHome, onRanking }) => (
  <nav className="bg-slate-900 text-white shadow-lg sticky top-0 z-50 pt-[env(safe-area-inset-top)]">
    <div className="container mx-auto px-4 py-3 flex justify-between items-center">
      <button onClick={onHome} className="text-xl sm:text-2xl font-black tracking-tighter flex items-center gap-2 group">
        <span className="bg-indigo-600 px-2 py-1 rounded group-hover:bg-indigo-500 transition-colors">{APP_NAME[0]}</span>
        <span>{APP_NAME}</span>
      </button>

      <div className="flex items-center gap-3 md:gap-8">
        <button onClick={onRanking} className="text-sm font-bold text-slate-300 hover:text-indigo-400 transition-colors">
          <span className="hidden sm:inline">Ranking Global</span>
          <span className="sm:hidden text-xl" aria-label="Ranking Global">🏆</span>
        </button>

        <div className="hidden md:flex flex-col items-end">
          <span className="text-sm font-medium text-slate-300">Olá, {user.username}</span>
          <span className="text-xs text-slate-500">{user.email}</span>
        </div>

        <button
          onClick={onLogout}
          className="bg-slate-800 hover:bg-red-900/40 text-slate-300 hover:text-white px-4 py-2 rounded-lg text-sm font-semibold transition-all border border-slate-700"
        >
          Sair
        </button>
      </div>
    </div>
  </nav>
);

export default Navbar;
