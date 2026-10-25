import React, { useState } from 'react';
import Logo from './Logo';
import { acceptTerms } from '../services/api';
import { User } from '../types';
import { APP_NAME } from '../config';

// Tela de aceite ("Quase lá!") para quem ainda não aceitou a versão atual dos Termos e da Política de Privacidade.
const TermsGate: React.FC<{ user: User; onAccepted: (user: User) => void; onLogout: () => void }> = ({ user, onAccepted, onLogout }) => {
  // Cada documento é um flag: o que já foi aceito na versão vigente não é pedido de novo.
  const needTerms = user.termsAccepted !== true;
  const needPrivacy = user.privacyAccepted !== true;
  const [terms, setTerms] = useState(!needTerms);
  const [privacy, setPrivacy] = useState(!needPrivacy);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accept = async () => {
    setBusy(true);
    setError(null);
    try {
      onAccepted((await acceptTerms({ ...(needTerms ? { terms: true } : {}), ...(needPrivacy ? { privacy: true } : {}) })).user);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao registrar aceite. Tente novamente.');
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-main flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8"><Logo tone="dark" size={40} /></div>
        <div role="dialog" aria-modal="true" aria-labelledby="terms-title" className="bg-white rounded-3xl shadow-2xl p-8">
          <h1 id="terms-title" className="text-2xl font-extrabold text-ink-900">Quase lá!</h1>
          <p className="text-slate-500 mb-5">Para usar o app, é preciso aceitar os dois documentos abaixo.</p>

          {error && <p role="alert" className="text-sm font-bold text-red-600 bg-red-50 rounded-xl px-4 py-3 mb-4">{error}</p>}

          <div className="bg-slate-50 rounded-xl p-4 text-sm text-slate-700 space-y-2 mb-5">
            <p>
              O {APP_NAME} coleta seu nome de usuário e e-mail para fornecer o serviço. Você pode excluir sua conta a qualquer
              momento pelo perfil, o que remove todos os seus dados permanentemente.
            </p>
            <p>Para os detalhes completos, leia nossos documentos abaixo.</p>
          </div>

          <div className="space-y-3 mb-5">
            {needTerms && (
              <label className="flex items-start gap-3 text-sm text-slate-700 cursor-pointer">
                <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} className="mt-0.5 w-5 h-5 accent-brand-600 shrink-0" />
                <span>Li e aceito os <a href="/termos" target="_blank" rel="noopener" className="font-bold text-brand-700 hover:underline">Termos de Uso</a></span>
              </label>
            )}
            {needPrivacy && (
              <label className="flex items-start gap-3 text-sm text-slate-700 cursor-pointer">
                <input type="checkbox" checked={privacy} onChange={(e) => setPrivacy(e.target.checked)} className="mt-0.5 w-5 h-5 accent-brand-600 shrink-0" />
                <span>Li e aceito a <a href="/privacidade" target="_blank" rel="noopener" className="font-bold text-brand-700 hover:underline">Política de Privacidade</a></span>
              </label>
            )}
          </div>

          <button onClick={accept} disabled={!terms || !privacy || busy}
            className="w-full bg-brand-600 text-white py-3.5 rounded-xl font-black disabled:opacity-40 hover:bg-brand-700">
            {busy ? 'Salvando...' : 'Continuar'}
          </button>
          <button onClick={onLogout} className="w-full mt-3 text-sm font-bold text-slate-400 hover:text-slate-600">Sair</button>
        </div>
      </div>
    </div>
  );
};

export default TermsGate;
