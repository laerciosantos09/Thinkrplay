import path from 'path';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { mkdirSync, writeFileSync } from 'node:fs';
import { GAME_PAGES, LINK_LABELS, PUBLIC_PAGES, SITE_URL, type PublicPageData } from './content/public';

// A partir de VITE_ADSENSE_CLIENT gera o /ads.txt (exigido pelo AdSense) e a meta tag "google-adsense-account", que o Google usa
// para confirmar o site (não carrega anúncios nem cookies: o script só entra depois do consentimento). Sem a variável, nada é gerado.
const adsTxt = (client?: string): Plugin => ({
  name: 'thinkrplay-ads-txt',
  transformIndexHtml(html) {
    if (!client || !/^ca-pub-\d+$/.test(client)) return html;
    return html.replace('</head>', `    <meta name="google-adsense-account" content="${client}" />\n  </head>`);
  },
  generateBundle() {
    if (!client) return;
    const publisher = client.replace(/^ca-/, '');
    this.emitFile({ type: 'asset', fileName: 'ads.txt', source: `google.com, ${publisher}, DIRECT, f08c47fec0942fa0\n` });
  },
});

// ---- Páginas públicas pré-renderizadas ------------------------------------------------------------------------------------
// O app é uma SPA: sem isto o Google (e o AdSense) só veriam <div id="root"></div> e a tela de login. Aqui o build grava o
// conteúdo de content/public.ts em HTML de verdade: na página inicial (dentro do index.html) e em /jogos/..., /sobre, /faq,
// cada uma em sua pasta (index.html). O React substitui esse HTML quando carrega. Também gera o sitemap.xml.
const esc = (v: string) => v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const bodyHtml = (page: PublicPageData) => {
  const blocks = page.blocks.map((b) => {
    const paras = (b.paragraphs ?? []).map((t) => `<p>${esc(t)}</p>`).join('');
    const tag = b.ordered ? 'ol' : 'ul';
    const list = b.list ? `<${tag}>${b.list.map((i) => `<li>${esc(i)}</li>`).join('')}</${tag}>` : '';
    return `<section><h2>${esc(b.heading)}</h2>${paras}${list}</section>`;
  }).join('');
  const games = page.path === '/' || page.path === '/jogos'
    ? `<section><h2>Conheça cada jogo</h2><ul>${GAME_PAGES.map((g) => `<li><a href="${g.path}">${esc(`${g.icon} ${g.navLabel}`)}</a></li>`).join('')}</ul></section>`
    : '';
  const related = (page.related ?? []).length
    ? `<nav aria-label="Veja também"><h2>Veja também</h2><ul>${page.related!.map((p) => `<li><a href="${p}">${esc(LINK_LABELS[p] ?? p)}</a></li>`).join('')}</ul></nav>`
    : '';
  return `<!--prerender--><div class="pre"><style>.pre{max-width:46rem;margin:0 auto;padding:24px 16px;font-family:system-ui,sans-serif;color:#334155;line-height:1.6}.pre h1{font-size:2rem;color:#0f0b2a}.pre h2{font-size:1.25rem;color:#0f0b2a;margin-top:1.8rem}.pre a{color:#5b2ad9}</style>`
    + `<header><a href="/"><strong>Thinkrplay</strong></a> · <nav style="display:inline"><a href="/jogos">Jogos</a> · <a href="/sobre">Sobre</a> · <a href="/faq">Perguntas frequentes</a> · <a href="/entrar">Entrar</a></nav></header>`
    + `<main><h1>${esc(page.h1)}</h1><p>${esc(page.lead)}</p>${blocks}${games}${related}<p><a href="/entrar">${esc(page.cta)}</a></p></main>`
    + `<footer><a href="/termos">Termos de Uso</a> · <a href="/privacidade">Política de Privacidade</a></footer></div><!--/prerender-->`;
};
const withHead = (html: string, page: PublicPageData) => {
  const url = `${SITE_URL}${page.path === '/' ? '/' : page.path}`;
  return html
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(page.title)}</title>`)
    .replace(/(<meta name="description" content=")[^"]*(")/, `$1${esc(page.description)}$2`)
    .replace(/(<link rel="canonical" href=")[^"]*(")/, `$1${url}$2`)
    .replace(/(<meta property="og:title" content=")[^"]*(")/, `$1${esc(page.title)}$2`)
    .replace(/(<meta property="og:description" content=")[^"]*(")/, `$1${esc(page.description)}$2`)
    .replace(/(<meta property="og:url" content=")[^"]*(")/, `$1${url}$2`)
    .replace(/<!--prerender-->[\s\S]*<!--\/prerender-->/, bodyHtml(page));
};
const prerender = (): Plugin => {
  let template = '';
  let outDir = 'dist';
  return {
    name: 'thinkrplay-prerender',
    apply: 'build',
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir);
    },
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        const home = PUBLIC_PAGES.find((p) => p.path === '/')!;
        template = html.replace('<div id="root"></div>', '<div id="root"><!--prerender--><!--/prerender--></div>');
        return withHead(template, home); // a página inicial vai dentro do próprio index.html (entra no cache do app)
      },
    },
    closeBundle() {
      for (const page of PUBLIC_PAGES) {
        if (page.path === '/') continue;
        const dir = path.join(outDir, page.path);
        mkdirSync(dir, { recursive: true });
        writeFileSync(path.join(dir, 'index.html'), withHead(template, page));
      }
      const urls = [...PUBLIC_PAGES.map((p) => p.path), '/termos', '/privacidade'];
      writeFileSync(path.join(outDir, 'sitemap.xml'),
        `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${SITE_URL}${u === '/' ? '/' : u}</loc></url>`).join('\n')}\n</urlset>\n`);
    },
  };
};

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
    adsTxt(env.VITE_ADSENSE_CLIENT),
    prerender(),
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
        navigateFallbackDenylist: [/^\/api\//, /^\/ads\.txt$/, /^\/sitemap\.xml$/, /^\/robots\.txt$/],
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
