import type { CapacitorConfig } from '@capacitor/cli';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// App nativo (Android/iOS): um WebView que abre o MESMO site publicado na Vercel. Assim a sessão (cookie HttpOnly), a API,
// o ranking e as atualizações continuam iguais à web, sem manter dois códigos. Defina o endereço antes de sincronizar:
//   CAP_SERVER_URL=https://seudominio.com npm run sync   (dentro de mobile/; ou crie mobile/.env)
// Lê mobile/.env quando existir (CAP_SERVER_URL=...), sem depender de pacote extra.
const envFile = join(process.cwd(), '.env'); // o Capacitor roda a partir de mobile/
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/);
    if (m && !m[1].startsWith('#') && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
}
const serverUrl = process.env.CAP_SERVER_URL?.trim().replace(/\/+$/, '');
if (!serverUrl || !/^https:\/\/[^/\s]+$/.test(serverUrl)) {
  throw new Error('Defina CAP_SERVER_URL com o endereço HTTPS do site (ex.: CAP_SERVER_URL=https://seudominio.com).');
}

const config: CapacitorConfig = {
  appId: 'com.thinkrplay.app', // ID do pacote nas lojas: escolha agora, não dá para mudar depois de publicar
  appName: 'Thinkrplay',
  webDir: '../dist', // build do site (raiz do projeto); com server.url só serve de reserva
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
