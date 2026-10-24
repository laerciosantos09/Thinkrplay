// Gera os PNGs do PWA a partir de public/icon.svg (usa o Chromium do Playwright).
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const svg = fs.readFileSync(path.join(__dirname, '../public/icon.svg'), 'utf8');
const out = path.join(__dirname, '../public');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const shot = async (size, file, scale = 1) => {
    await page.setViewportSize({ width: size, height: size });
    const inner = Math.round(size * scale);
    const pad = Math.round((size - inner) / 2);
    await page.setContent(
      `<body style="margin:0;background:#0f172a"><div style="width:${inner}px;height:${inner}px;margin:${pad}px">${svg.replace('<svg ', `<svg width="${inner}" height="${inner}" `)}</div></body>`,
    );
    await page.screenshot({ path: path.join(out, file) });
  };
  await shot(192, 'icon-192.png');
  await shot(512, 'icon-512.png');
  await shot(512, 'icon-maskable-512.png', 0.7);
  await shot(180, 'apple-touch-icon.png');
  await browser.close();
})();
