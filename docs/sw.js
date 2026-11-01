/* Service worker «ЕГЭ на 100»: хранит приложение на устройстве, чтобы оно открывалось без интернета.
   Собирается из tools/sw.template.js (tools/build.py подставляет версию и список файлов). */
const VERSION = "d3affac7af";
const CACHE = 'ege70-' + VERSION;
const ASSETS = [
 "./",
 "manifest.webmanifest",
 "fonts/manrope-cyrillic-ext.woff2",
 "fonts/manrope-cyrillic.woff2",
 "fonts/manrope-latin-ext.woff2",
 "fonts/manrope-latin.woff2",
 "fonts/unbounded-cyrillic-ext.woff2",
 "fonts/unbounded-cyrillic.woff2",
 "fonts/unbounded-latin-ext.woff2",
 "fonts/unbounded-latin.woff2",
 "icons/icon-192.png",
 "icons/icon-512.png",
 "icons/icon-maskable-512.png",
 "icons/apple-touch-icon.png"
];

self.addEventListener('install', e => {
  // cache: 'reload' - мимо HTTP-кэша, чтобы новая версия не смешалась со старыми файлами
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith('ege70-') && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  if (req.mode === 'navigate') { // приложение - из кэша; другие страницы (файл-копия) - из сети, а без сети - приложение
    e.respondWith(caches.match(req, { ignoreSearch: true, ignoreVary: true })
      .then(r => r || fetch(req).catch(() => caches.match('./', { ignoreVary: true }))));
    return;
  }
  e.respondWith(caches.match(req, { ignoreSearch: true, ignoreVary: true }).then(r => r || fetch(req)));
});
