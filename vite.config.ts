import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  if (mode === 'production' && !env.VITE_SUPPORT_EMAIL) {
    console.warn('\n[thinkrplay] Aviso: defina VITE_SUPPORT_EMAIL (e-mail de suporte). Os Termos e a Política de Privacidade mandam o usuário falar com o "e-mail de suporte disponível na plataforma".\n');
  }
  return {
  server: {
    port: 3000,
    host: '0.0.0.0',
    // Em dev, use `vercel dev` para servir também /api. Se rodar só o Vite, aponte para o backend:
    proxy: process.env.API_PROXY ? { '/api': process.env.API_PROXY } : undefined,
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'mark.svg', 'apple-touch-icon.png', 'og-image.png'],
      manifest: {
        name: 'Thinkrplay - Jogos de raciocínio',
        short_name: 'Thinkrplay',
        description: 'Jogos de raciocínio para treinar a mente, com ranking.',
        lang: 'pt-BR',
        start_url: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0f0a26',
        theme_color: '#0f0a26',
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml' },
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        // As chamadas à API nunca vêm do cache.
        runtimeCaching: [
          { urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/, handler: 'StaleWhileRevalidate', options: { cacheName: 'fonts' } },
        ],
      },
    }),
  ],
  resolve: { alias: { '@': path.resolve(__dirname, '.') } },
};
});
