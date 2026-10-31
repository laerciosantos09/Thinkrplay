import { LoginProvider } from '../types';
import { isNativeApp } from './platform';

// Login social no app nativo. O Google bloqueia login dentro do WebView, então o provedor abre no navegador do sistema
// (Custom Tabs no Android, Safari no iOS) e volta ao app por thinkrplay://auth?code=... (código de uso único).
// O app guarda um segredo (verifier) e manda só o hash dele (challenge): só este app consegue trocar o código por uma sessão.
// Os plugins nativos (Browser e App, do Capacitor) são acessados por window.Capacitor, sem empacotá-los no site.
type Plugin = Record<string, (...args: any[]) => any>;
const plugins = (): { Browser?: Plugin; App?: Plugin } => (window as any).Capacitor?.Plugins ?? {};
const KEY = 'thinkrplay.nativeVerifier';

const b64url = (buf: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(buf as ArrayBuffer))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

export const startNativeLogin = async (provider: LoginProvider) => {
  const { Browser } = plugins();
  if (!Browser) throw new Error('Atualize o app para entrar com Google ou Apple.');
  const verifier = b64url(crypto.getRandomValues(new Uint8Array(32)));
  const challenge = b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
  sessionStorage.setItem(KEY, verifier);
  await Browser.open({ url: `${window.location.origin}/api/oauth/${provider}?app=1&challenge=${challenge}` });
};

// Chamado uma vez ao abrir o app: escuta o retorno do navegador do sistema.
export const listenNativeLoginReturn = () => {
  const { App, Browser } = plugins();
  if (!isNativeApp || !App?.addListener) return;
  App.addListener('appUrlOpen', (event: { url?: string }) => {
    let url: URL;
    try {
      url = new URL(event.url ?? '');
    } catch {
      return;
    }
    if (url.protocol !== 'thinkrplay:' || url.hostname !== 'auth') return;
    Browser?.close?.().catch?.(() => {});
    const error = url.searchParams.get('error');
    const code = url.searchParams.get('code');
    const verifier = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    if (error) return window.location.assign(`/?auth_error=${encodeURIComponent(error)}`);
    // Sem um login iniciado por este app (verifier guardado), qualquer código recebido é ignorado.
    if (code && verifier) window.location.assign(`/api/oauth/handoff?code=${encodeURIComponent(code)}&verifier=${encodeURIComponent(verifier)}`);
  });
};
