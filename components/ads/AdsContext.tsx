import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { ADS } from '../../config';

// "personalized": anúncios personalizados (cookies/dados de navegação). "limited": anúncios não personalizados.
export type AdsConsent = 'personalized' | 'limited';

interface AdsState {
  active: boolean; // ligado pelo administrador E configurado nas variáveis de build
  consent: AdsConsent | null; // null = ainda não escolheu (nenhum script do Google é carregado)
  setConsent: (value: AdsConsent) => void;
}

const STORAGE_KEY = 'thinkrplay_ads_consent';
const Ctx = createContext<AdsState>({ active: false, consent: null, setConsent: () => {} });

const readConsent = (): AdsConsent | null => {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === 'personalized' || v === 'limited' ? v : null;
  } catch {
    return null; // armazenamento indisponível: pergunta de novo na próxima visita
  }
};

export const AdsProvider: React.FC<{ enabled: boolean; children: React.ReactNode }> = ({ enabled, children }) => {
  const [consent, setConsentState] = useState<AdsConsent | null>(readConsent);

  const setConsent = useCallback((value: AdsConsent) => {
    setConsentState(value);
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch {
      /* vale só para esta sessão */
    }
  }, []);

  const value = useMemo<AdsState>(
    () => ({ active: enabled && Boolean(ADS.client), consent, setConsent }),
    [enabled, consent, setConsent],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};

export const useAds = () => useContext(Ctx);
