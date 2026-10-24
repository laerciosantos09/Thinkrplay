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
import Profile from './pages/Profile';
import Premium from './pages/Premium';
import LegalPage, { LEGAL_ROUTES } from './pages/Legal';
import TermsGate from './components/TermsGate';
import { SUPPORT_EMAIL } from './config';
import { AdsProvider } from './components/ads/AdsContext';
import ConsentBanner from './components/ads/ConsentBanner';
import { EnergyProvider } from './components/energy/EnergyContext';
import Navbar from './components/Navbar';
import { GameSetting, User } from './types';
import { AppSettings, EnergySettings, EnergyState, PremiumState, fetchProfile, fetchSettings, logout as apiLogout, setUnauthorizedHandler } from './services/api';

const GAME_PAGES: Record<string, React.FC<{ onBack: () => void }>> = {
  sudoku: SudokuGame,
  memory: MemoryGame,
  sequence: SequenceGame,
  hanoi: HanoiGame,
  lights: LightsGame,
  mastermind: MastermindGame,
};

const MainApp: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);
  const [page, setPage] = useState('dashboard');
  const [games, setGames] = useState<GameSetting[] | null>(null);
  const [adsEnabled, setAdsEnabled] = useState(false);
  const [premium, setPremium] = useState<PremiumState | null>(null);
  const [energy, setEnergyConfig] = useState<EnergySettings | null>(null);
  const [missingMigrations, setMissingMigrations] = useState<string[]>([]);
  const [settingsFailed, setSettingsFailed] = useState(false);
  // Voltou do pagamento do Stripe (?premium=success): abre a tela do Premium aguardando a confirmação.
  const [justPaid, setJustPaid] = useState(() => new URLSearchParams(window.location.search).get('premium') === 'success');

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
    fetchProfile()
      .then((r) => setUser(r.user))
      .catch(() => {})
      .finally(() => setChecking(false));
  }, []);

  // Jogos habilitados: recarrega ao entrar e a cada troca de tela (o admin pode ter mudado algo).
  const applySettings = useCallback((r: AppSettings) => {
    setGames(r.games);
    setAdsEnabled(r.ads.enabled);
    setPremium(r.premium);
    setEnergyConfig(r.energy);
    setMissingMigrations(r.setup?.missingMigrations ?? []);
    setSettingsFailed(false);
  }, []);

  const setEnergyState = useCallback((state: EnergyState) => setEnergyConfig((e) => (e ? { ...e, state } : e)), []);

  const refreshSettings = useCallback(() => fetchSettings().then(applySettings), [applySettings]);

  useEffect(() => {
    if (!user) return;
    refreshSettings().catch(() => {
      setGames((g) => g ?? []); // sem resposta: o servidor continua barrando jogo desativado
      setSettingsFailed(true);
    });
  }, [user, page, refreshSettings]);

  useEffect(() => {
    if (!user || !justPaid) return;
    setPage('premium');
    window.history.replaceState(null, '', '/'); // limpa o ?premium=success da barra de endereço
  }, [user, justPaid]);

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

  // Quem ainda não aceitou a versão atual dos Termos/Privacidade precisa aceitar antes de continuar.
  if (user.needsTerms) return <TermsGate onAccepted={setUser} onLogout={logout} />;

  const home = () => setPage('dashboard');
  const isAdmin = user.role === 'admin';
  const Game = GAME_PAGES[page];

  return (
    <AdsProvider enabled={adsEnabled && !premium?.active}>
    <EnergyProvider energy={energy} setState={setEnergyState} refresh={refreshSettings}
      onPremium={premium?.available && !premium.active ? () => setPage('premium') : undefined}>
    <div className="min-h-screen bg-slate-50">
      <Navbar user={user} onLogout={logout} onHome={home} onRanking={() => setPage('ranking')} onProfile={() => setPage('profile')}
        onSettings={isAdmin ? () => setPage('settings') : undefined}
        onPremium={premium && (premium.available || premium.active) ? () => setPage('premium') : undefined}
        premiumActive={premium?.active} />
      <main className="container mx-auto px-4 py-6 sm:py-8">
        {isAdmin && (settingsFailed || missingMigrations.length > 0) && (
          <div role="alert" className="mb-6 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <p className="font-extrabold">⚠️ Atenção, administrador</p>
            <p>
              {settingsFailed
                ? 'Não foi possível carregar as configurações do app. Confira se as migrações do banco foram aplicadas e veja os logs da Vercel.'
                : <>Faltam migrações no banco: <strong>{missingMigrations.join(', ')}</strong>. Os recursos que dependem delas (anúncios, Premium, limite de partidas) ficam desligados até você rodá-las no Neon, em ordem, e recarregar.</>}
            </p>
          </div>
        )}
        {Game && isEnabled(page) ? (
          <Game key={page} onBack={home} />
        ) : page === 'ranking' ? (
          <GlobalRanking onBack={home} isEnabled={isEnabled} />
        ) : page === 'profile' ? (
          <Profile user={user} premium={premium} onPremium={() => setPage('premium')} onUserChange={setUser} onDeleted={clear} onBack={home} />
        ) : page === 'premium' && premium ? (
          <Premium premium={premium} energy={energy} justPaid={justPaid} onRefresh={refreshSettings} onBack={() => { setJustPaid(false); home(); }} />
        ) : page === 'settings' && isAdmin ? (
          <AdminSettings games={games ?? []} adsEnabled={adsEnabled} premium={premium} energy={energy} onChange={applySettings} onBack={home} />
        ) : (
          <Dashboard onSelectGame={setPage} onGoToRanking={() => setPage('ranking')} isEnabled={isEnabled} loading={games === null} />
        )}
      </main>
      <footer className="container mx-auto px-4 pb-8 text-center text-xs text-slate-400">
        <a href="/termos" className="hover:underline">Termos de Uso</a> · <a href="/privacidade" className="hover:underline">Política de Privacidade</a>
        {SUPPORT_EMAIL && <> · <a href={`mailto:${SUPPORT_EMAIL}`} className="hover:underline">Suporte</a></>}
      </footer>
      <ConsentBanner />
    </div>
    </EnergyProvider>
    </AdsProvider>
  );
};

// Termos e Privacidade são páginas públicas (/termos e /privacidade), acessíveis sem login.
const App: React.FC = () => {
  const legal = LEGAL_ROUTES[window.location.pathname.replace(/\/+$/, '')];
  return legal ? <LegalPage doc={legal} /> : <MainApp />;
};

export default App;
