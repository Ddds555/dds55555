// Напоминания «ЕГЭ на 100» (15.11.2026). Запускает GitHub Actions по расписанию: .github/workflows/reminders.yml.
// Её просьба: «если ты напомнил, а я не зашла - напомни снова; если зашла и порешала - зачем ещё раз напоминать».
// Поэтому перед каждым напоминанием читаем последнюю сводку из приложения (ntfy.sh/<канал>, только цифры: сколько решено
// сегодня, когда был последний ответ, серия, копилка) и решаем: норма сделана или занималась недавно - молчим.
// iPhone требует показывать уведомление на каждый пришедший push, поэтому решение принимается здесь, а не в телефоне.
// Секреты: VAPID_PRIVATE - закрытый ключ, PUSH_CODE - код подписки из приложения («EGE1.» + base64url JSON {t, s}).
import webpush from 'web-push';

const SITE = 'https://ddds555.github.io/dds55555/';
const VAPID_PUBLIC = 'BFty7rLDRethAuk0nC69XcqdvkxLsA7j-4zUylAFYpQIaoxz7-iLyPer2Vv2jvQHEKA7PCkIGlmd0kPze6uZlec';
const ESSAY_LAST = '2026-12-02'; // итоговое сочинение: до этой даты в выходные - «сочинение недели»
const NORM = 15, MIN_N = 5;
const MODE = (process.env.MODE || 'auto').trim(), DRY = process.env.DRY === '1';

const P = (n, a, b, c) => { const m10 = n % 10, m100 = n % 100; return m10 === 1 && m100 !== 11 ? a : m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20) ? b : c; };
const days = n => `${n} ${P(n, 'день', 'дня', 'дней')}`;

function decode(code) {
  code = (code || '').trim();
  if (!code.startsWith('EGE1.')) return null;
  try { return JSON.parse(Buffer.from(code.slice(5).replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')); } catch { return null; }
}
async function lastSummary(topic) {
  try {
    const r = await fetch(`https://ntfy.sh/${encodeURIComponent(topic)}/json?poll=1&since=36h`);
    if (!r.ok) { console.log('ntfy:', r.status); return null; }
    let last = null;
    for (const line of (await r.text()).split('\n')) {
      if (!line.trim()) continue;
      try { const m = JSON.parse(line); if (m.event !== 'message') continue; const s = JSON.parse(m.message); if (s && s.v === 1 && (!last || (s.op || 0) >= (last.op || 0))) last = s; } catch { /* чужое сообщение - пропускаем */ }
    }
    return last;
  } catch (e) { console.log('ntfy недоступен:', e.message); return null; }
}

const now = Date.now(), msk = new Date(now + 3 * 3600e3);
const today = msk.toISOString().slice(0, 10), yesterday = new Date(now + 3 * 3600e3 - 864e5).toISOString().slice(0, 10);
const hm = msk.getUTCHours() * 60 + msk.getUTCMinutes(), wd = msk.getUTCDay(), weekend = wd === 0 || wd === 6;
const slot = MODE !== 'auto' ? MODE : hm < 10 * 60 ? 'morning' : hm < 15 * 60 + 30 ? 'day' : hm < 20 * 60 + 15 ? 'evening' : 'late';
const doy = Math.floor((Date.UTC(msk.getUTCFullYear(), msk.getUTCMonth(), msk.getUTCDate()) - Date.UTC(msk.getUTCFullYear(), 0, 0)) / 864e5);

const code = decode(process.env.PUSH_CODE);
if (!code || !code.s || !code.t) { console.log('Нет кода подписки (секрет PUSH_CODE) - напоминания ещё не включены в приложении.'); process.exit(0); }
const S = await lastSummary(code.t);
const T = S && S.d === today ? S : null; // сводка за сегодня
const n = T ? T.n || 0 : 0;
const st = S && (S.d === today || S.d === yesterday) ? S.st || 0 : 0;
const sinceAns = S && S.at ? (now - S.at) / 60000 : 1e9; // минут с последнего ответа
const c = S ? S.c : null, g = S ? S.g : null, gt = S && S.gt ? S.gt : 'подарок', due = S ? S.due || 0 : 0;
const ed = Math.round((Date.parse(ESSAY_LAST) - Date.parse(today)) / 864e5);
const essDue = weekend && ed > 0 && !(T && T.ew);
console.log(`слот ${slot}, мск ${String(msk.getUTCHours()).padStart(2, '0')}:${String(msk.getUTCMinutes()).padStart(2, '0')}, сводка ${S ? S.d : 'нет'}, сегодня решено ${n}, с последнего ответа ${sinceAns < 1e8 ? Math.round(sinceAns) + ' мин' : 'давно'}`);

const pick = arr => { const L = arr.filter(Boolean); return L[(doy + ['morning', 'day', 'evening', 'late'].indexOf(slot) + 4) % L.length]; };
let body = null, why = '';
if (slot === 'test') body = 'Напоминания работают! Пишу утром, на перемене и вечером - и только если ты ещё не занималась.';
else if (slot === 'morning') {
  if (weekend) why = 'выходной - утром не будим';
  else if (n >= MIN_N) why = 'день уже засчитан';
  else body = n ? `Уже ${n} из ${MIN_N} - добей порцию до уроков, и день засчитан.` : pick([
    st ? `Серия ${days(st)} - не урони. 5 заданий до уроков, минуты три.` : null,
    'Доброе утро! 5 заданий по русскому до уроков - и день засчитан.',
    due ? `${due} ${P(due, 'ошибка ждёт', 'ошибки ждут', 'ошибок ждут')} повтора. 5 минут - и они ближе к выученным.` : null,
    ed > 0 && ed <= 21 ? `До итогового ${days(ed)}. 5 заданий утром - и день уже не пустой.` : null,
  ]);
} else if (slot === 'day') {
  if (essDue) body = `Сочинение недели: до итогового ${days(ed)}. Тема уже ждёт в приложении - можно на бумаге.`;
  else if (sinceAns < 90) why = 'занималась меньше 1,5 часа назад';
  else if (n >= 10) why = 'сегодня уже 10+ заданий';
  else body = n ? `Уже ${n} из ${NORM}. Ещё 5 на перемене?` : pick([
    'Перемена? 5 заданий, пока ждёшь звонка.',
    c != null && g != null ? `В копилке ${c} ₽ - «${gt}» уже на ${g}%. Порция на перемене - ещё ближе.` : null,
    st ? `Серия ${days(st)} ждёт сегодняшние 5 заданий.` : 'Пять заданий - и день засчитан. Можно прямо сейчас.',
  ]);
} else if (slot === 'evening') {
  if (n >= NORM) why = 'норма сделана';
  else if (sinceAns < 60) why = 'занималась меньше часа назад';
  else body = n >= MIN_N ? `${n} из ${NORM}. Ещё ${NORM - n} - и +100 ₽ в копилку.` : n ? `Ещё ${MIN_N - n} - и день засчитан${st ? `, серия ${days(st)} не сгорит` : ''}.` : pick([
    `Сегодня пока 0. 5 заданий - и день засчитан${st ? `, серия ${days(st)} не сгорит` : ''}.`,
    c != null && g != null ? `Копилка: ${c} ₽, «${gt}» на ${g}%. Вечерняя порция - и ещё ближе.` : null,
    'Пять заданий перед сном - минуты три. День будет засчитан.',
  ]);
} else if (slot === 'late') {
  if (n >= MIN_N) why = 'день уже засчитан';
  else if (sinceAns < 60) why = 'занималась меньше часа назад';
  else body = st ? `Последний шанс сохранить серию ${days(st)}: 5 заданий, минуты три.` : 'Ещё не поздно: 5 заданий - и день засчитан. Завтра будет легче.';
}
if (!body) { console.log('Не напоминаю:', why || 'нечего сказать'); process.exit(0); }
const msg = { title: 'ЕГЭ на 100', body, url: './?go=next', tag: 'ege100-' + slot };
console.log('Текст:', body);
if (DRY) { console.log('DRY=1 - не отправляю'); process.exit(0); }
if (!process.env.VAPID_PRIVATE) { console.log('Нет секрета VAPID_PRIVATE'); process.exit(1); }
webpush.setVapidDetails(SITE, VAPID_PUBLIC, process.env.VAPID_PRIVATE.trim());
try {
  const r = await webpush.sendNotification(code.s, JSON.stringify(msg), { TTL: 3 * 3600, urgency: 'normal' });
  console.log('Отправлено:', r.statusCode);
} catch (e) {
  console.log('Не отправилось:', e.statusCode || '', e.body || e.message);
  if (e.statusCode === 404 || e.statusCode === 410) console.log('Подписка больше не действует - в приложении нужно заново нажать «Включить напоминания» и прислать новый код.');
  process.exitCode = 1;
}
