import React, { useState } from 'react';
import Logo from './Logo';
import { acceptTerms } from '../services/api';
import { User } from '../types';
import { LEGAL_UPDATED_LABEL } from '../lib/legal';

// Tela de aceite para quem ainda não aceitou a versão atual dos Termos e da Política de Privacidade.
const TermsGate: React.FC<{ onAccepted: (user: User) => void; onLogout: () => void }> = ({ onAccepted, onLogout }) => {
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accept = async () => {
    setBusy(true);
    setError(null);
    try {
      onAccepted((await acceptTerms()).user);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível registrar o aceite.');
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-main flex items-center justify-center p-4">
      <div role="dialog" aria-modal="true" aria-labelledby="terms-title" className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-8">
        <Logo tone="light" size={36} className="mb-5" />
        <h1 id="terms-title" className="text-2xl font-extrabold text-ink-900 mb-2">Termos de Uso e Privacidade</h1>
        <p className="text-slate-500 mb-5">
          Para continuar, leia e aceite os Termos de Uso e a Política de Privacidade (versão de {LEGAL_UPDATED_LABEL}).
        </p>
        <label className="flex items-start gap-3 text-sm text-slate-700 mb-4 cursor-pointer">
          <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} className="mt-1 w-5 h-5 accent-brand-600" />
          <span>
            Li e aceito os <a href="/termos" target="_blank" rel="noopener" className="font-bold text-brand-700 underline">Termos de Uso</a> e
            a <a href="/privacidade" target="_blank" rel="noopener" className="font-bold text-brand-700 underline">Política de Privacidade</a>.
          </span>
        </label>
        {error && <p role="alert" className="text-sm font-bold text-red-600 bg-red-50 rounded-xl px-4 py-3 mb-3">{error}</p>}
        <button onClick={accept} disabled={!checked || busy}
          className="w-full bg-brand-600 text-white py-3.5 rounded-xl font-black disabled:opacity-40 hover:bg-brand-700">
          {busy ? 'Registrando...' : 'Aceitar e continuar'}
        </button>
        <button onClick={onLogout} className="w-full mt-3 text-sm font-bold text-slate-400 hover:text-slate-600">Sair</button>
      </div>
    </div>
  );
};

export default TermsGate;
