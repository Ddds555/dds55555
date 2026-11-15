/* ================= НАПОМИНАНИЯ НА ТЕЛЕФОН (15.11.2026) =================
   Её просьба: «подключи уведомления на телефоне - утром, на переменах, вечером, чтобы реально захотелось зайти;
   но если я зашла и порешала - зачем ещё раз напоминать; а если не зашла - напомни снова».
   Как устроено (бесплатно, без своего сервера):
   1) Приложение подписывается на web push (iPhone: только из значка на экране «Домой», iOS 16.4 и новее) и показывает
      код подписки. Она присылает код Claude - он кладёт его в секрет репозитория PUSH_CODE.
   2) После ответов (раз в ~20 с) и при открытии приложение шлёт короткую сводку - только цифры: сколько решено сегодня,
      время последнего ответа, серия, копилка - в закрытый канал ntfy.sh/<случайное имя> (бесплатный сервис уведомлений;
      имя канала знают только приложение и секрет PUSH_CODE).
   3) GitHub Actions (.github/workflows/reminders.yml) в 7:47 (будни), 12:41, 19:03 и 20:47 по Москве читает последнюю сводку
      (tools/push/remind.mjs): норма сделана или она недавно занималась - молчит; не заходила - присылает напоминание
      с её цифрами. Нажатие на напоминание открывает приложение сразу на 5 заданиях (?go=next). */
const VAPID_PUBLIC = 'BFty7rLDRethAuk0nC69XcqdvkxLsA7j-4zUylAFYpQIaoxz7-iLyPer2Vv2jvQHEKA7PCkIGlmd0kPze6uZlec';
const NOTIFY_PREFIX = 'EGE1.';
const NOTIFY_TIMES = 'в будни в 7:47 - до уроков, каждый день в 12:41 - на перемене, в 19:03 - вечером и в 20:47 - если день ещё не засчитан';
const notifySupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
const b64uEnc = s => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const b64uU8 = s => { const b = atob((s + '='.repeat((4 - s.length % 4) % 4)).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(b, c => c.charCodeAt(0)); };
function notifyTopic() {
  if (!state.notify?.topic) { const a = new Uint8Array(12); crypto.getRandomValues(a); state.notify = { ...(state.notify || {}), topic: 'ege100-' + Array.from(a, x => x.toString(16).padStart(2, '0')).join('') }; save(); }
  return state.notify.topic;
}
const notifyCode = () => state.notify?.sub ? NOTIFY_PREFIX + b64uEnc(JSON.stringify({ t: state.notify.topic, s: state.notify.sub })) : '';
/* сводка для напоминаний - только цифры */
function notifySummary() {
  const d = state.days[today()] || {}, g = mainGift();
  return { v: 1, d: today(), n: d.n || 0, at: state.notify?.lastAns || 0, op: Date.now(), st: planStreak(), c: Math.round(state.coins),
    g: g ? Math.min(100, Math.round(state.coins / g.cost * 100)) : null, gt: g ? String(g.title).slice(0, 30) : '', due: errDue().length, ew: essWeekDone() ? 1 : 0, ed: daysTo(ESSAY_DATE) };
}
let notifyT = null;
function notifySend() {
  notifyT = null; const t = state.notify?.topic; if (!t || !state.notify?.sub || navigator.onLine === false) return;
  try { fetch('https://ntfy.sh/' + t, { method: 'POST', body: JSON.stringify(notifySummary()), keepalive: true }).catch(() => {}); } catch {}
}
/* kind: 'open' - открыла приложение; без kind - ответила на задание (вызывается из record в tools/plan.js) */
function notifyPing(kind) {
  if (!state.notify?.sub) return;
  if (kind !== 'open') state.notify.lastAns = Date.now();
  clearTimeout(notifyT); notifyT = setTimeout(notifySend, kind === 'open' ? 1500 : 20000);
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') notifyPing('open');
  else if (notifyT) { clearTimeout(notifyT); notifySend(); } // уходит из приложения - сводку сразу
});
async function notifyOn() {
  if (!notifySupported()) { toast('На этом телефоне напоминания не работают: нужен iOS 16.4 или новее'); return; }
  if (isIOS() && !isStandalone()) { toast('Открой приложение значком на экране «Домой» - из Safari напоминания не включаются'); return; }
  try {
    let perm = Notification.permission;
    if (perm !== 'granted') perm = await Notification.requestPermission();
    if (perm !== 'granted') { state.notify = { ...(state.notify || {}), denied: today() }; save(); render(); toast('Без разрешения напоминания не придут'); return; }
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64uU8(VAPID_PUBLIC) });
    notifyTopic();
    state.notify = { ...state.notify, sub: sub.toJSON(), on: today(), sent: null, denied: null };
    save(); render(); notifyPing('open');
  } catch (e) { toast('Не получилось включить: ' + (e && e.message ? e.message : 'ошибка')); }
}
async function notifyOff() {
  try { const reg = await navigator.serviceWorker.ready, sub = await reg.pushManager.getSubscription(); if (sub) await sub.unsubscribe(); } catch {}
  state.notify = { ...(state.notify || {}), sub: null, sent: null, off: today() }; save(); render(); toast('Напоминания выключены');
}
function notifyCodeHTML() {
  const code = notifyCode();
  return `<p style="margin:0"><b>Последний шаг:</b> скопируй код и пришли его Claude в чат - он включит напоминания и пришлёт пробное.</p>
    <textarea class="inp" readonly rows="3" style="font-size:12px;line-height:1.3;word-break:break-all" aria-label="Код напоминаний">${esc(code)}</textarea>
    <div class="row" style="gap:8px"><button class="btn primary" data-a="notifyCopy">${ic('note', 18)} Скопировать код</button><button class="btn sm ghost" data-a="notifySent">Я отправила</button></div>`;
}
/* карточка в «Копилке» - всё про напоминания */
function notifyCardHTML() {
  const n = state.notify || {};
  let body;
  if (!notifySupported()) body = '<p class="muted" style="margin:0">На этом устройстве напоминания не работают. На iPhone нужен iOS 16.4 или новее и приложение, открытое значком с экрана «Домой».</p>';
  else if (isIOS() && !isStandalone()) body = '<p class="muted" style="margin:0">Открой приложение значком на экране «Домой» - из Safari напоминания не включаются.</p>';
  else if (!n.sub) body = `<p style="margin:0">Напомню ${NOTIFY_TIMES}. Если ты уже сделала норму или занималась недавно - не потревожу.</p>${n.denied ? '<p class="muted small" style="margin:0">Ты не разрешила уведомления. Включить можно в «Настройках» iPhone → «Уведомления» → «ЕГЭ на 100».</p>' : ''}<button class="btn primary block" data-a="notifyOn">${ic('spark', 18)} Включить напоминания</button>`;
  else if (!n.sent) body = notifyCodeHTML();
  else body = `<p style="margin:0">${ic('check', 16)} Включены: ${NOTIFY_TIMES}. Норма сделана или занималась недавно - молчат.</p><div class="row" style="gap:8px"><button class="btn sm ghost" data-a="notifyShow">Показать код</button><button class="btn sm ghost" data-a="notifyOff">Выключить</button></div>`;
  return `<section class="card" id="notifyCard"><h2 class="h2">Напоминания на телефон</h2>${body}</section>`;
}
/* на главной - только на iPhone, пока не включены (и не «Не надо») */
function notifyHomeHTML() {
  const n = state.notify || {};
  if (!isIOS() || !notifySupported() || n.hideHome) return '';
  if (n.sub && !n.sent) return `<section class="card" style="border-left:5px solid var(--violet)"><h2 class="h2">Напоминания: почти готово</h2>${notifyCodeHTML()}</section>`;
  if (n.sub) return '';
  return `<section class="card" style="border-left:5px solid var(--violet)"><h2 class="h2">Напоминать тебе?</h2><p style="margin:0">Утром, на перемене и вечером - только если ты ещё не занималась. Сделала норму - тишина.</p>
    <div class="row"><button class="btn primary" data-a="notifyOn">${ic('spark', 18)} Включить</button><button class="btn sm ghost" data-a="notifyHide">Не надо</button></div></section>`;
}
Object.assign(A, {
  notifyOn: () => { notifyOn(); },
  notifyOff: () => { notifyOff(); },
  notifyCopy: async () => {
    const code = notifyCode(); if (!code) return;
    try { await navigator.clipboard.writeText(code); toast('Код скопирован - вставь его в чат с Claude'); }
    catch { const t = document.querySelector('#notifyCard textarea, textarea[aria-label="Код напоминаний"]'); if (t) { t.select(); toast('Выдели и скопируй код вручную'); } }
  },
  notifySent: () => { state.notify = { ...(state.notify || {}), sent: today() }; save(); render(); toast('Как только Claude включит - придёт пробное напоминание'); },
  notifyShow: () => { state.notify = { ...(state.notify || {}), sent: null }; save(); render(); },
  notifyHide: () => { state.notify = { ...(state.notify || {}), hideHome: today() }; save(); render(); toast('Включить можно во вкладке «Копилка»'); },
});
/* нажала на напоминание - приложение открывается сразу на 5 заданиях (если нет незаконченной тренировки) */
{
  let goNext = false;
  try { const q = new URLSearchParams(location.search); if (q.get('go') === 'next') { goNext = true; history.replaceState(null, '', location.pathname); } } catch {}
  if (goNext) { const t0 = Date.now(), tick = () => { if (typeof A.five === 'function' && document.querySelector('#tabs .tab')) { if (!sesLive()) A.five(); } else if (Date.now() - t0 < 8000) setTimeout(tick, 300); }; setTimeout(tick, 600); }
}
