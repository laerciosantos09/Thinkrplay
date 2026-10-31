import React from 'react';
import { LoginProvider } from '../types';

export const PROVIDER_NAMES: Record<LoginProvider, string> = { google: 'Google', apple: 'Apple' };

export const ProviderIcon: React.FC<{ provider: LoginProvider; className?: string }> = ({ provider, className = 'w-5 h-5' }) =>
  provider === 'google' ? (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z" />
      <path fill="#FBBC05" d="M10.5 28.7A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.2.8-4.7l-7.9-6.1A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.8l7.9-6.1z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.9 2.3-8.4 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M16.4 12.6c0-2.3 1.9-3.4 2-3.5-1.1-1.6-2.8-1.8-3.4-1.8-1.4-.1-2.8.9-3.5.9s-1.8-.8-3-.8c-1.5 0-3 .9-3.8 2.3-1.6 2.8-.4 7 1.2 9.3.8 1.1 1.7 2.4 2.9 2.3 1.2 0 1.6-.7 3-.7s1.8.7 3 .7 2.1-1.100 2.800-2.200c.9-1.300 1.200-2.500 1.300-2.600-.1 0-2.500-1-2.500-3.900zM14.100 5.700c.6-.8 1.100-1.900.9-3-.9 0-2.100.6-2.700 1.400-.6.700-1.100 1.800-1 2.900 1.100.1 2.200-.5 2.800-1.300z" />
    </svg>
  );

// Os botões são links comuns: o login acontece com o navegador indo ao provedor e voltando para o app.
const SocialButtons: React.FC<{ providers: LoginProvider[]; query?: string; verb?: string; onNative?: (p: LoginProvider) => void }> = ({ providers, query = '', verb = 'Continuar com', onNative }) => (
  <div className="space-y-3">
    {providers.map((p) => {
      const cls = `w-full flex items-center justify-center gap-3 py-3.5 rounded-xl font-bold border-2 transition-all ${p === 'apple' ? 'bg-black border-black text-white hover:bg-slate-800' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'}`;
      const content = <><ProviderIcon provider={p} />{verb} {PROVIDER_NAMES[p]}</>;
      // No app nativo o login abre no navegador do sistema (o Google bloqueia WebView); no site é um link comum.
      return onNative
        ? <button key={p} type="button" onClick={() => onNative(p)} className={cls}>{content}</button>
        : <a key={p} href={`/api/oauth/${p}${query}`} className={cls}>{content}</a>;
    })}
  </div>
);

export default SocialButtons;
