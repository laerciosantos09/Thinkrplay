import React, { useCallback, useEffect, useState } from 'react';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import SudokuGame from './pages/SudokuGame';
import MemoryGame from './pages/MemoryGame';
import SequenceGame from './pages/SequenceGame';
import HanoiGame from './pages/HanoiGame';
import LightsGame from './pages/LightsGame';
import MastermindGame from './pages/MastermindGame';
import GlobalRanking from './pages/GlobalRanking';
import AdminSettings from './pages/AdminSettings';
import Navbar from './components/Navbar';
import { GameSetting, User } from './types';
import { fetchGames, fetchMe, logout as apiLogout, setUnauthorizedHandler } from './services/api';

const GAME_PAGES: Record<string, React.FC<{ onBack: () => void }>> = {
  sudoku: SudokuGame,
  memory: MemoryGame,
  sequence: SequenceGame,
  hanoi: HanoiGame,
  lights: LightsGame,
  mastermind: MastermindGame,
};

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);
  const [page, setPage] = useState('dashboard');
  const [games, setGames] = useState<GameSetting[] | null>(null);

  const clear = useCallback(() => {
    setUser(null);
    setPage('dashboard');
  }, []);

  const logout = useCallback(() => {
    apiLogout().catch(() => {});
    clear();
  }, [clear]);

  useEffect(() => setUnauthorizedHandler(clear), [clear]);

  // A sessão é um cookie HttpOnly; pergunta ao servidor quem está logado.
  useEffect(() => {
    fetchMe()
      .then((r) => setUser(r.user))
      .catch(() => {})
      .finally(() => setChecking(false));
  }, []);

  // Jogos habilitados: recarrega ao entrar e a cada troca de tela (o admin pode ter mudado algo).
  useEffect(() => {
    if (!user) return;
    fetchGames()
      .then((r) => setGames(r.games))
      .catch(() => setGames((g) => g ?? [])); // sem resposta: o servidor continua barrando jogo desativado
  }, [user, page]);

  // Jogo sem informação conta como habilitado.
  const isEnabled = (slug: string) => games?.find((g) => g.slug === slug)?.enabled !== false;

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-ink-900">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-brand-500" />
      </div>
    );
  }

  if (!user) {
    return <Login onLogin={(u) => { setUser(u); setPage('dashboard'); }} />;
  }

  const home = () => setPage('dashboard');
  const isAdmin = user.role === 'admin';
  const Game = GAME_PAGES[page];

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar user={user} onLogout={logout} onHome={home} onRanking={() => setPage('ranking')}
        onSettings={isAdmin ? () => setPage('settings') : undefined} />
      <main className="container mx-auto px-4 py-6 sm:py-8">
        {Game && isEnabled(page) ? (
          <Game key={page} onBack={home} />
        ) : page === 'ranking' ? (
          <GlobalRanking onBack={home} isEnabled={isEnabled} />
        ) : page === 'settings' && isAdmin ? (
          <AdminSettings games={games ?? []} onChange={setGames} onBack={home} />
        ) : (
          <Dashboard onSelectGame={setPage} onGoToRanking={() => setPage('ranking')} isEnabled={isEnabled} loading={games === null} />
        )}
      </main>
    </div>
  );
};

export default App;
