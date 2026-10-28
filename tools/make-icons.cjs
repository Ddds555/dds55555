/* Рисует значки приложения в docs/icons (нужен Playwright с Chromium):  node tools/make-icons.cjs
   Значок: «ЕГЭ» и «70» шрифтами приложения на розовом, под цифрами - полоска прогресса, как в программе. */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const font = n => fs.readFileSync(path.join(ROOT, 'docs', 'fonts', n + '.woff2')).toString('base64');
const ICONS = [
  // файл, размер, скругление, масштаб содержимого (у maskable - безопасная зона 80%)
  ['icon-192.png', 192, 0.22, 1],
  ['icon-512.png', 512, 0.22, 1],
  ['icon-maskable-512.png', 512, 0, 0.8],
  ['apple-touch-icon.png', 180, 0, 0.92],
];

const html = (size, radius, scale) => `<!doctype html><html><head><style>
@font-face{font-family:U;font-weight:200 900;src:url(data:font/woff2;base64,${font('unbounded-latin')}) format('woff2')}
@font-face{font-family:M;font-weight:200 800;src:url(data:font/woff2;base64,${font('manrope-cyrillic')}) format('woff2')}
html,body{margin:0;width:${size}px;height:${size}px;background:transparent;overflow:hidden}
.ic{width:${size}px;height:${size}px;border-radius:${radius * size}px;background:linear-gradient(155deg,#DE76A0 0%,#C8507E 55%,#A93C68 100%);display:grid;place-items:center}
.in{display:grid;justify-items:center;transform:scale(${scale})}
.k{font:800 ${size * 0.15}px/1 M;letter-spacing:.14em;margin-left:.14em;color:rgba(255,255,255,.9)}
.n{font:700 ${size * 0.42}px/1 U;color:#fff;letter-spacing:-.03em;margin-top:${size * 0.03}px}
.bar{width:${size * 0.46}px;height:${size * 0.05}px;border-radius:99px;background:rgba(255,255,255,.32);margin-top:${size * 0.06}px;overflow:hidden}
.bar i{display:block;width:70%;height:100%;border-radius:inherit;background:#fff}
</style></head><body><div class="ic"><div class="in"><div class="k">ЕГЭ</div><div class="n">70</div><div class="bar"><i></i></div></div></div></body></html>`;

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  fs.mkdirSync(path.join(ROOT, 'docs', 'icons'), { recursive: true });
  for (const [file, size, radius, scale] of ICONS) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(html(size, radius, scale));
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: path.join(ROOT, 'docs', 'icons', file), omitBackground: radius > 0 });
    console.log('docs/icons/' + file);
  }
  await browser.close();
})();
