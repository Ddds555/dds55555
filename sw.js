/* Service worker «ЕГЭ на 100»: хранит приложение на устройстве, чтобы оно открывалось без интернета.
   Собирается из tools/sw.template.js (tools/build.py подставляет версию и список файлов). */
const VERSION = "2b457f61e2";
const CACHE = 'ege70-' + VERSION;
const ASSETS = [
 "./",
 "manifest.webmanifest",
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

/* напоминания (15.11.2026): их присылает GitHub Actions (tools/push/remind.mjs), текст приходит готовым.
   iPhone требует показывать уведомление на каждое пришедшее - поэтому решение «напоминать или нет» принимает сервер */
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (x) { d = { body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'ЕГЭ на 100', {
    body: d.body || 'Пять заданий - и день засчитан.',
    icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', tag: d.tag || 'ege100', data: { url: d.url || './?go=next' },
  }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || './?go=next', self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const c of list) if ('focus' in c) { if ('navigate' in c) c.navigate(url).catch(() => {}); return c.focus(); }
    return self.clients.openWindow(url);
  }));
});
