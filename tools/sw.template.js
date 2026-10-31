/* Service worker «ЕГЭ на 100»: хранит приложение на устройстве, чтобы оно открывалось без интернета.
   Собирается из tools/sw.template.js (tools/build.py подставляет версию и список файлов). */
const VERSION = '__VERSION__';
const CACHE = 'ege70-' + VERSION;
const ASSETS = [/* __ASSETS__ */];

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
