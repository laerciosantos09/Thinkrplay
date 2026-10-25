import React from 'react';
import { LoginMethod } from '../types';
import { PROVIDER_NAMES, ProviderIcon } from './SocialButtons';

export const METHOD_NAMES: Record<LoginMethod, string> = { password: 'Senha', google: PROVIDER_NAMES.google, apple: PROVIDER_NAMES.apple };

const Icon: React.FC<{ method: LoginMethod }> = ({ method }) =>
  method === 'password' ? <span aria-hidden="true">🔑</span> : <ProviderIcon provider={method} className="w-3.5 h-3.5" />;

// "Flags" dos tipos de login ativos da conta; a origem do cadastro aparece destacada.
const LoginBadges: React.FC<{ methods: LoginMethod[]; origin?: LoginMethod }> = ({ methods, origin }) => (
  <ul className="flex flex-wrap gap-1.5" aria-label="Formas de login ativas">
    {methods.map((m) => (
      <li key={m} className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold border ${m === origin ? 'bg-brand-50 border-brand-200 text-brand-700' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
        <Icon method={m} />{METHOD_NAMES[m]}{m === origin && <span className="text-[10px] uppercase opacity-70">origem</span>}
      </li>
    ))}
  </ul>
);

export default LoginBadges;
