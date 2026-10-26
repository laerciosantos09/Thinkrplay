import type { CapacitorConfig } from '@capacitor/cli';

// App nativo (Android/iOS): um WebView que abre o MESMO site publicado na Vercel. Assim a sessão (cookie HttpOnly), a API,
// o ranking e as atualizações continuam iguais à web, sem manter dois códigos. Defina o endereço antes de sincronizar:
//   CAP_SERVER_URL=https://seudominio.com npm run cap:sync
const serverUrl = process.env.CAP_SERVER_URL?.trim().replace(/\/+$/, '');
if (!serverUrl || !/^https:\/\/[^/\s]+$/.test(serverUrl)) {
  throw new Error('Defina CAP_SERVER_URL com o endereço HTTPS do site (ex.: CAP_SERVER_URL=https://seudominio.com).');
}

const config: CapacitorConfig = {
  appId: 'com.thinkrplay.app', // ID do pacote nas lojas: escolha agora, não dá para mudar depois de publicar
  appName: 'Thinkrplay',
  webDir: 'dist',
  // O site reconhece o app por este trecho do User-Agent (lib/platform.ts): sem login social, Premium e anúncios web lá dentro.
  appendUserAgent: 'ThinkrplayApp',
  backgroundColor: '#0f0b2a',
  server: {
    url: serverUrl,
    cleartext: false,
    allowNavigation: [new URL(serverUrl).host], // links para outros sites abrem no navegador do aparelho
  },
  android: { allowMixedContent: false },
  ios: { contentInset: 'always', limitsNavigationsToAppBoundDomains: false },
};

export default config;
