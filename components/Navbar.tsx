import React from 'react';
import { User } from '../types';
import Logo from './Logo';

interface NavbarProps {
  user: User;
  onLogout: () => void;
  onHome: () => void;
  onRanking: () => void;
  onSettings?: () => void; // só para administradores
}

const Navbar: React.FC<NavbarProps> = ({ user, onLogout, onHome, onRanking, onSettings }) => (
  <nav className="bg-ink-900 text-white shadow-lg sticky top-0 z-50 pt-[env(safe-area-inset-top)]">
    <div className="container mx-auto px-4 py-3 flex justify-between items-center">
      <button onClick={onHome} aria-label="Início" className="group">
        <Logo size={34} className="group-hover:opacity-90 transition-opacity" />
      </button>

      <div className="flex items-center gap-3 md:gap-8">
        <button onClick={onRanking} className="text-sm font-bold text-slate-300 hover:text-brand-400 transition-colors">
          <span className="hidden sm:inline">Ranking Global</span>
          <span className="sm:hidden text-xl" aria-label="Ranking Global">🏆</span>
        </button>

        {onSettings && (
          <button onClick={onSettings} className="text-sm font-bold text-slate-300 hover:text-brand-400 transition-colors">
            <span className="hidden sm:inline">⚙️ Configurações</span>
            <span className="sm:hidden text-xl" aria-label="Configurações">⚙️</span>
          </button>
        )}

        <div className="hidden md:flex flex-col items-end">
          <span className="text-sm font-medium text-slate-300">Olá, {user.username}</span>
          <span className="text-xs text-slate-500">{user.email}</span>
        </div>

        <button
          onClick={onLogout}
          className="bg-ink-800 hover:bg-red-900/40 text-slate-300 hover:text-white px-4 py-2 rounded-lg text-sm font-semibold transition-all border border-slate-700"
        >
          Sair
        </button>
      </div>
    </div>
  </nav>
);

export default Navbar;
