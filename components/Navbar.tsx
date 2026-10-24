import React from 'react';
import { User } from '../types';
import Logo from './Logo';

interface NavbarProps {
  user: User;
  onLogout: () => void;
  onHome: () => void;
  onRanking: () => void;
  onSettings?: () => void; // só para administradores
  onProfile: () => void;
}

const Navbar: React.FC<NavbarProps> = ({ user, onLogout, onHome, onRanking, onSettings, onProfile }) => (
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

        <button onClick={onProfile} aria-label="Meu perfil" className="group flex items-center gap-2 text-left">
          <span className="w-9 h-9 rounded-full bg-linear-to-br from-brand-400 to-brand-700 text-white text-sm font-black flex items-center justify-center" aria-hidden="true">
            {user.username[0]?.toUpperCase()}
          </span>
          <span className="hidden md:flex flex-col items-start">
            <span className="text-sm font-medium text-slate-200 group-hover:text-white">{user.username}</span>
            <span className="text-xs text-slate-500">Meu perfil</span>
          </span>
        </button>

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
