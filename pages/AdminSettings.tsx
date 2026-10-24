import React, { useState } from 'react';
import { GAMES } from '../config';
import { setGameEnabled } from '../services/api';
import { GameSetting } from '../types';

interface AdminSettingsProps {
  games: GameSetting[];
  onChange: (games: GameSetting[]) => void;
  onBack: () => void;
}

const formatDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : null;

const AdminSettings: React.FC<AdminSettingsProps> = ({ games, onChange, onBack }) => {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const state = new Map(games.map((g) => [g.slug, g]));
  const activeCount = GAMES.filter((g) => state.get(g.slug)?.enabled ?? true).length;

  const toggle = async (slug: string, enabled: boolean) => {
    setBusy(slug);
    setError(null);
    try {
      onChange((await setGameEnabled(slug, enabled)).games);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível salvar.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="max-w-3xl mx-auto animate-fadeIn">
      <div className="flex items-center gap-4 mb-8">
        <button onClick={onBack} aria-label="Voltar" className="w-10 h-10 flex items-center justify-center bg-white rounded-full shadow-sm hover:text-brand-600 border border-slate-100">
          &larr;
        </button>
        <div>
          <h1 className="text-3xl font-extrabold text-ink-900">Configurações</h1>
          <p className="text-slate-500 text-sm font-medium">Área do administrador</p>
        </div>
      </div>

      <section className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        <header className="p-6 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-xl font-extrabold text-ink-800">Jogos</h2>
            <p className="text-sm text-slate-500">Desativados ficam invisíveis para os jogadores e não podem ser jogados.</p>
          </div>
          <span className="text-xs font-black text-brand-700 bg-brand-50 rounded-full px-3 py-1.5">
            {activeCount} de {GAMES.length} ativos
          </span>
        </header>

        {error && (
          <p role="alert" className="mx-6 mt-4 text-sm font-bold text-red-600 bg-red-50 rounded-xl px-4 py-3">{error}</p>
        )}

        <ul className="divide-y divide-slate-100">
          {GAMES.map((game) => {
            const current = state.get(game.slug);
            const enabled = current?.enabled ?? true;
            const changedAt = formatDate(current?.updatedAt ?? null);
            return (
              <li key={game.slug} className="flex items-center gap-4 p-5">
                <span className={`w-12 h-12 rounded-xl ${game.color} flex items-center justify-center text-2xl shadow ${enabled ? '' : 'opacity-40 grayscale'}`}>
                  {game.icon}
                </span>
                <div className="flex-1 min-w-0">
                  <p className={`font-extrabold ${enabled ? 'text-ink-800' : 'text-slate-400'}`}>{game.name}</p>
                  <p className="text-xs text-slate-400 truncate">
                    {enabled ? 'Ativo' : 'Desativado'}
                    {changedAt && ` · alterado em ${changedAt}`}
                  </p>
                </div>
                <button
                  role="switch"
                  aria-checked={enabled}
                  aria-label={`${enabled ? 'Desativar' : 'Ativar'} ${game.name}`}
                  disabled={busy !== null}
                  onClick={() => toggle(game.slug, !enabled)}
                  className={`relative w-14 h-8 rounded-full transition-colors disabled:opacity-60 ${enabled ? 'bg-mint-500' : 'bg-slate-300'}`}
                >
                  <span className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full shadow transition-transform ${enabled ? 'translate-x-6' : ''}`} />
                </button>
              </li>
            );
          })}
        </ul>

        <footer className="p-5 bg-slate-50 text-xs text-slate-500">
          O progresso e os pontos dos jogadores são mantidos. Ao reativar, o jogo volta exatamente como estava.
        </footer>
      </section>
    </div>
  );
};

export default AdminSettings;
