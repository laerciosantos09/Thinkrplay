import React, { useEffect, useState } from 'react';
import { PremiumState, openBillingPortal, startCheckout } from '../services/api';
import { PREMIUM_PRICE_LABEL } from '../config';

interface PremiumProps {
  premium: PremiumState;
  justPaid: boolean; // voltou do pagamento: aguarda a confirmação (webhook) e atualiza sozinho
  onRefresh: () => Promise<void>;
  onBack: () => void;
}

const BENEFITS = [
  ['🚫', 'Sem anúncios', 'Jogue sem nenhuma publicidade.'],
  ['⭐', 'Selo Premium', 'Aparece no seu perfil e ao lado do seu nome nos rankings.'],
  ['💜', 'Apoie o Thinkrplay', 'Ajuda a manter o app e a criar novos jogos e desafios.'],
] as const;

const formatDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('pt-BR') : null);

const Premium: React.FC<PremiumProps> = ({ premium, justPaid, onRefresh, onBack }) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Depois do pagamento, a confirmação chega por webhook alguns segundos depois: consulta até ativar (máx. ~30 s).
  useEffect(() => {
    if (!justPaid || premium.active) return;
    let tries = 0;
    const timer = setInterval(() => {
      if (++tries > 10) return clearInterval(timer);
      onRefresh().catch(() => {});
    }, 3000);
    return () => clearInterval(timer);
  }, [justPaid, premium.active, onRefresh]);

  const go = async (request: () => Promise<{ url: string }>) => {
    setBusy(true);
    setError(null);
    try {
      window.location.href = (await request()).url; // página do Stripe
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Algo deu errado.');
      setBusy(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto animate-fadeIn space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={onBack} aria-label="Voltar" className="w-10 h-10 flex items-center justify-center bg-white rounded-full shadow-sm hover:text-brand-600 border border-slate-100">&larr;</button>
        <div>
          <h1 className="text-3xl font-extrabold text-ink-900">Thinkrplay <span className="text-amber-500">Premium</span></h1>
          <p className="text-slate-500 text-sm font-medium">Jogue sem anúncios e apoie o app</p>
        </div>
      </div>

      {justPaid && !premium.active && (
        <p role="status" className="text-sm font-bold text-brand-700 bg-brand-50 rounded-xl px-4 py-3">
          Pagamento recebido! Estamos ativando o seu Premium, isso leva alguns segundos...
        </p>
      )}
      {error && <p role="alert" className="text-sm font-bold text-red-600 bg-red-50 rounded-xl px-4 py-3">{error}</p>}

      {premium.active ? (
        <section className="bg-white rounded-3xl shadow-sm border border-amber-200 p-6">
          <p className="text-2xl font-extrabold text-ink-900">Você é Premium ⭐</p>
          <p className="text-slate-600 mt-1">
            {premium.cancelAtPeriodEnd
              ? `Sua assinatura foi cancelada e vale até ${formatDate(premium.renewsAt) ?? 'o fim do período pago'}.`
              : premium.renewsAt ? `Sua assinatura renova em ${formatDate(premium.renewsAt)}.` : 'Sua assinatura está ativa.'}
          </p>
          <button onClick={() => go(openBillingPortal)} disabled={busy}
            className="mt-5 bg-ink-900 text-white px-6 py-3 rounded-xl font-black disabled:opacity-50 hover:bg-ink-800">
            {busy ? 'Abrindo...' : 'Gerenciar ou cancelar assinatura'}
          </button>
        </section>
      ) : premium.available ? (
        <section className="bg-white rounded-3xl shadow-sm border border-slate-100 p-6">
          <ul className="space-y-4 mb-6">
            {BENEFITS.map(([icon, title, text]) => (
              <li key={title} className="flex items-start gap-3">
                <span className="text-2xl" aria-hidden="true">{icon}</span>
                <div><p className="font-extrabold text-ink-800">{title}</p><p className="text-sm text-slate-500">{text}</p></div>
              </li>
            ))}
          </ul>
          <p className="text-sm text-slate-500 bg-slate-50 rounded-xl px-4 py-3 mb-5">
            O Premium <strong>não dá pontos extras</strong>: os rankings continuam iguais e justos para todos.
          </p>
          {PREMIUM_PRICE_LABEL && <p className="text-3xl font-extrabold text-ink-900 mb-4">{PREMIUM_PRICE_LABEL}</p>}
          <button onClick={() => go(startCheckout)} disabled={busy}
            className="w-full bg-linear-to-r from-amber-400 to-orange-500 text-ink-900 py-4 rounded-xl font-black shadow-lg disabled:opacity-50 hover:brightness-105">
            {busy ? 'Abrindo pagamento...' : 'Assinar Premium'}
          </button>
          <p className="text-xs text-slate-400 mt-3">
            Assinatura recorrente cobrada pelo Stripe. Cancele quando quiser: o acesso continua até o fim do período pago.
            Veja os <a href="/termos" target="_blank" rel="noopener" className="underline">Termos de Uso</a>.
          </p>
        </section>
      ) : (
        <p className="text-slate-500 bg-white rounded-3xl border border-slate-100 p-6">O plano Premium não está disponível no momento.</p>
      )}
    </div>
  );
};

export default Premium;
