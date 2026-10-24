import React, { createContext, useContext } from 'react';
import { EnergySettings, EnergyState } from '../../services/api';

interface EnergyCtx {
  energy: EnergySettings | null;
  setState: (state: EnergyState) => void; // atualiza o estoque com o que o servidor devolveu
  refresh: () => Promise<void>;
  /** Abre a página do Premium (só quando o plano está à venda e o usuário ainda não é Premium). */
  onPremium?: () => void;
}

const Ctx = createContext<EnergyCtx>({ energy: null, setState: () => {}, refresh: async () => {} });

export const EnergyProvider: React.FC<EnergyCtx & { children: React.ReactNode }> = ({ children, ...value }) => (
  <Ctx.Provider value={value}>{children}</Ctx.Provider>
);

export const useEnergy = () => useContext(Ctx);

export const formatCountdown = (ms: number) => {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};
