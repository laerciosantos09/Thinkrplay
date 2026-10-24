import React from 'react';
import { useAds } from './AdsContext';

// Aviso de anúncios: aparece só quando os anúncios estão ativos e a pessoa ainda não escolheu.
const ConsentBanner: React.FC = () => {
  const { active, consent, setConsent } = useAds();
  if (!active || consent !== null) return null;

  return (
    <div role="dialog" aria-modal="false" aria-labelledby="ads-title"
      className="fixed inset-x-0 bottom-0 z-50 p-3 sm:p-4 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <div className="mx-auto max-w-2xl rounded-2xl bg-ink-900 text-white shadow-2xl border border-white/10 p-5">
        <p id="ads-title" className="font-extrabold mb-1">Anúncios no Thinkrplay</p>
        <p className="text-sm text-slate-300 leading-relaxed">
          Exibimos anúncios do Google AdSense para manter o app gratuito. Você escolhe: <strong>personalizados</strong> usam
          cookies e dados de navegação; <strong>limitados</strong> não são personalizados. Detalhes na{' '}
          <a href="/privacidade" target="_blank" rel="noopener" className="underline font-bold">Política de Privacidade</a>.
          Você pode mudar essa escolha no seu Perfil.
        </p>
        <div className="mt-4 flex flex-col sm:flex-row gap-2">
          <button onClick={() => setConsent('personalized')} className="flex-1 bg-brand-600 hover:bg-brand-500 rounded-xl py-3 font-black">
            Aceitar personalizados
          </button>
          <button onClick={() => setConsent('limited')} className="flex-1 bg-white/10 hover:bg-white/20 rounded-xl py-3 font-black">
            Só anúncios limitados
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConsentBanner;
