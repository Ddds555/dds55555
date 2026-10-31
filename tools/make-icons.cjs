/* Рисует значки приложения в docs/icons (нужен Playwright с Chromium):  node tools/make-icons.cjs
   Значок «ЕГЭ на 100»: «ЕГЭ» и «100» шрифтами приложения на градиенте от розового к лавандовому (как обложка на главной),
   под цифрами - полоска прогресса, заполненная до конца. */
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
.ic{width:${size}px;height:${size}px;border-radius:${radius * size}px;background:linear-gradient(150deg,#E27BA5 0%,#C8507E 46%,#6F5AC4 100%);display:grid;place-items:center;position:relative;overflow:hidden}
.ic::before{content:"";position:absolute;width:${size * 0.62}px;height:${size * 0.62}px;border-radius:50%;right:${-size * 0.16}px;top:${-size * 0.24}px;background:rgba(255,255,255,.12)}
.in{display:grid;justify-items:center;transform:scale(${scale});position:relative}
.k{font:800 ${size * 0.15}px/1 M;letter-spacing:.14em;margin-left:.14em;color:rgba(255,255,255,.9)}
.n{font:700 ${size * 0.34}px/1 U;color:#fff;letter-spacing:-.04em;margin-top:${size * 0.03}px}
.bar{width:${size * 0.5}px;height:${size * 0.05}px;border-radius:99px;background:rgba(255,255,255,.32);margin-top:${size * 0.06}px;overflow:hidden}
.bar i{display:block;width:100%;height:100%;border-radius:inherit;background:#fff}
</style></head><body><div class="ic"><div class="in"><div class="k">ЕГЭ</div><div class="n">100</div><div class="bar"><i></i></div></div></div></body></html>`;

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
