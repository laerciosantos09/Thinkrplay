import React, { useState } from 'react';
import Logo from './Logo';
import { fetchProfile, resendVerification } from '../services/api';
import { User } from '../types';

// Conta nova com a confirmação de e-mail ligada: nada do app abre até o link do e-mail ser aberto.
const VerifyEmailGate: React.FC<{ user: User; onVerified: (user: User) => void; onLogout: () => void }> = ({ user, onVerified, onLogout }) => {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ error?: string; ok?: string }>({});

  const resend = async () => {
    setBusy(true);
    setMsg({});
    try {
      await resendVerification();
      setMsg({ ok: 'Enviamos um novo link. Confira também a caixa de spam.' });
    } catch (e) {
      setMsg({ error: e instanceof Error ? e.message : 'Não foi possível reenviar agora.' });
    } finally {
      setBusy(false);
    }
  };

  const check = async () => {
    setBusy(true);
    setMsg({});
    try {
      const { user: fresh } = await fetchProfile();
      if (fresh.needsEmailVerification) setMsg({ error: 'Ainda não confirmado. Abra o link que enviamos por e-mail.' });
      else onVerified(fresh);
    } catch (e) {
      setMsg({ error: e instanceof Error ? e.message : 'Algo deu errado.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-main flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8"><Logo tone="dark" size={40} /></div>
        <div role="dialog" aria-modal="true" aria-labelledby="verify-title" className="bg-white rounded-3xl shadow-2xl p-8">
          <h1 id="verify-title" className="text-2xl font-extrabold text-ink-900">Confirme seu e-mail</h1>
          <p className="text-slate-500 mb-5">
            Enviamos um link para <strong className="text-ink-800 break-all">{user.email}</strong>. Abra-o para liberar sua conta.
          </p>
          {msg.error && <p role="alert" className="text-sm font-bold text-red-600 bg-red-50 rounded-xl px-4 py-3 mb-4">{msg.error}</p>}
          {msg.ok && <p role="status" className="text-sm font-bold text-green-700 bg-green-50 rounded-xl px-4 py-3 mb-4">{msg.ok}</p>}
          <button onClick={check} disabled={busy} className="w-full bg-brand-600 text-white py-3.5 rounded-xl font-black disabled:opacity-40 hover:bg-brand-700">
            Já confirmei
          </button>
          <button onClick={resend} disabled={busy} className="w-full mt-3 border-2 border-slate-200 text-slate-700 py-3 rounded-xl font-black hover:bg-slate-50 disabled:opacity-40">
            Reenviar e-mail
          </button>
          <button onClick={onLogout} className="w-full mt-3 text-sm font-bold text-slate-400 hover:text-slate-600">Sair</button>
        </div>
      </div>
    </div>
  );
};

export default VerifyEmailGate;
