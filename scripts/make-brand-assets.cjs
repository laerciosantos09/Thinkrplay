// Gera os ativos da marca Thinkrplay (SVGs + PNGs) em public/. Uso: node scripts/make-brand-assets.cjs
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const out = path.join(__dirname, '../public');
const C = { violet: '#6a35f5', violetLight: '#9672ff', violetDark: '#3a1f85', ink: '#0f0a26', mint: '#2ee6a6', white: '#ffffff' };

// Símbolo: balão de pensamento com "play" dentro (pensar + jogar), bolinhas de pensamento em menta.
const mark = (scale = 1) => `
  <g transform="translate(256 256) scale(${scale}) translate(-256 -256)">
    <circle cx="262" cy="232" r="158" fill="${C.white}"/>
    <path d="M226 160v144l124-72z" fill="url(#play)" stroke="url(#play)" stroke-width="26" stroke-linejoin="round"/>
    <circle cx="146" cy="404" r="30" fill="${C.mint}"/>
    <circle cx="98" cy="452" r="16" fill="${C.mint}"/>
  </g>`;

const defs = `<defs>
  <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${C.violetLight}"/><stop offset=".55" stop-color="${C.violet}"/><stop offset="1" stop-color="${C.violetDark}"/></linearGradient>
  <linearGradient id="play" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${C.violet}"/><stop offset="1" stop-color="${C.violetDark}"/></linearGradient>
</defs>`;

const icon = (rx, scale) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${defs}<rect width="512" height="512" rx="${rx}" fill="url(#bg)"/>${mark(scale)}</svg>`;

// Símbolo sem fundo (para usar sobre qualquer cor).
const bare = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${defs}${mark(1)}</svg>`;

fs.writeFileSync(path.join(out, 'icon.svg'), icon(112, 1));
fs.writeFileSync(path.join(out, 'mark.svg'), bare);
const maskable = icon(0, 0.74);
fs.writeFileSync(path.join(out, 'icon-maskable.svg'), maskable);

const ogHtml = `<!doctype html><html><head><link href="https://fonts.googleapis.com/css2?family=Sora:wght@700;800&family=Inter:wght@500;600&display=swap" rel="stylesheet"></head>
<body style="margin:0;width:1200px;height:630px;overflow:hidden;font-family:Inter,sans-serif;background:radial-gradient(900px 500px at 85% 15%,#5b34e6 0%,transparent 60%),radial-gradient(700px 420px at 10% 100%,#1e5f7a55 0%,transparent 60%),${C.ink};color:#fff;display:flex;align-items:center;padding:0 96px;box-sizing:border-box;gap:64px">
  <div style="width:300px;height:300px;flex:none">${icon(72, 1).replace('<svg ', '<svg width="300" height="300" ')}</div>
  <div>
    <div style="font-family:Sora,sans-serif;font-weight:800;font-size:112px;letter-spacing:-4px;line-height:1">Thinkr<span style="color:${C.mint}">play</span></div>
    <div style="font-size:38px;font-weight:500;color:#cfc6ff;margin-top:24px;max-width:640px;line-height:1.3">Jogos de raciocínio para treinar a mente. Suba no ranking.</div>
  </div></body></html>`;

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const raster = async (svg, size, file) => {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(`<body style="margin:0;background:transparent">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body>`);
    await page.screenshot({ path: path.join(out, file), omitBackground: true });
  };
  await raster(icon(112, 1), 192, 'icon-192.png');
  await raster(icon(112, 1), 512, 'icon-512.png');
  await raster(maskable, 512, 'icon-maskable-512.png');
  await raster(icon(0, 0.86), 180, 'apple-touch-icon.png'); // iOS aplica o próprio arredondamento
  await page.setViewportSize({ width: 1200, height: 630 });
  await page.setContent(ogHtml);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: path.join(out, 'og-image.png') });
  await browser.close();
})();
