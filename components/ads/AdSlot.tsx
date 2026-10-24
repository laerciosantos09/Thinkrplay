import React, { useEffect, useRef, useState } from 'react';
import { ADS, AdPlacement } from '../../config';
import { useAds } from './AdsContext';

declare global {
  interface Window {
    adsbygoogle?: Array<Record<string, unknown>> & { requestNonPersonalizedAds?: number };
  }
}

// O script do AdSense é carregado uma única vez, só depois que o usuário escolhe no aviso de anúncios.
let scriptPromise: Promise<void> | null = null;
const loadAdSense = (client: string) => {
  scriptPromise ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(client)}`;
    script.onload = () => resolve();
    script.onerror = () => {
      scriptPromise = null; // bloqueador de anúncios, sem rede etc.: tenta de novo numa próxima tela
      reject(new Error('Anúncios indisponíveis'));
    };
    document.head.appendChild(script);
  });
  return scriptPromise;
};

// Um espaço de anúncio. Não renderiza nada se: anúncios desligados pelo admin, variáveis ausentes,
// usuário ainda sem escolha de consentimento, espaço (slot) não configurado ou anúncio bloqueado.
// Colocar só em telas fora da partida e longe de botões (anúncio perto de botão gera clique acidental e viola a política).
const AdSlot: React.FC<{ placement: AdPlacement; className?: string }> = ({ placement, className = '' }) => {
  const { active, consent } = useAds();
  const slot = ADS.slots[placement];
  const show = active && consent !== null && Boolean(slot);
  const requested = useRef(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!show || requested.current || !ADS.client) return;
    let alive = true;
    loadAdSense(ADS.client)
      .then(() => {
        if (!alive || requested.current) return;
        const queue = (window.adsbygoogle = window.adsbygoogle || []);
        queue.requestNonPersonalizedAds = consent === 'limited' ? 1 : 0;
        queue.push({});
        requested.current = true;
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [show, consent]);

  if (!show || failed) return null;
  return (
    <aside aria-label="Publicidade" className={`ad-slot ${className}`}>
      <p className="mb-1 text-center text-[10px] font-bold uppercase tracking-widest text-slate-400">Publicidade</p>
      <ins
        className="adsbygoogle"
        style={{ display: 'block', minHeight: 90 }}
        data-ad-client={ADS.client}
        data-ad-slot={slot}
        data-ad-format="auto"
        data-full-width-responsive="true"
        {...(ADS.test ? { 'data-adtest': 'on' } : {})}
      />
    </aside>
  );
};

export default AdSlot;
