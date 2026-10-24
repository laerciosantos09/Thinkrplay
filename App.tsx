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
import Navbar from './components/Navbar';
import { Session } from './types';
import { loadSession, setUnauthorizedHandler, storeSession } from './services/api';

const GAME_PAGES: Record<string, React.FC<{ onBack: () => void }>> = {
  sudoku: SudokuGame,
  memory: MemoryGame,
  sequence: SequenceGame,
  hanoi: HanoiGame,
  lights: LightsGame,
  mastermind: MastermindGame,
};

const App: React.FC = () => {
  const [session, setSession] = useState<Session | null>(() => loadSession());
  const [page, setPage] = useState('dashboard');

  const logout = useCallback(() => {
    storeSession(null);
    setSession(null);
    setPage('dashboard');
  }, []);

  useEffect(() => setUnauthorizedHandler(logout), [logout]);

  if (!session) {
    return (
      <Login
        onLogin={(s) => {
          storeSession(s);
          setSession(s);
          setPage('dashboard');
        }}
      />
    );
  }

  const home = () => setPage('dashboard');
  const Game = GAME_PAGES[page];

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar user={session.user} onLogout={logout} onHome={home} onRanking={() => setPage('ranking')} />
      <main className="container mx-auto px-4 py-6 sm:py-8">
        {Game ? (
          <Game key={page} onBack={home} />
        ) : page === 'ranking' ? (
          <GlobalRanking onBack={home} />
        ) : (
          <Dashboard onSelectGame={setPage} onGoToRanking={() => setPage('ranking')} />
        )}
      </main>
    </div>
  );
};

export default App;
