/* ================= ПЛАН ДНЯ, ГЛАВНЫЙ ЭКРАН И КОПИЛКА «ЕГЭ на 100» =================
   15.11.2026 переделано по её словам: «план слишком огромный - думаешь "ну нафиг" и даже не решаешь», «уроки с 8:30 до 16,
   в 9 утра сидеть писать не могу», «сочинение каждый день не хочу, одно по выходным - нормально, с напоминанием»,
   «чтение такое себе», «русский - в приоритете, у меня там не очень идёт», «общество тоже, с правом сильно западает»,
   «английский пока не доработан - не надо». Поэтому день - НОРМА 15 заданий тремя ПОРЦИЯМИ по 5 (до уроков, на перемене,
   вечером - когда удобно, порядок не важен). Одна порция (5 заданий) - день засчитан в серию. Русский - главный; во вторник,
   четверг и субботу третья порция - общество (сначала «Конституция и власть»). В выходные - «сочинение недели» по желанию
   (до 2 декабря - итоговое, потом - сочинение ЕГЭ). Копилка - отдельная вкладка-кабинет: деньги, серия и бонусы за неё,
   что уже сделано, «было -> стало», активность, обещания и вехи.
   Учёт: ответы за день (day().n), по предметам и тренировкам (day().t), написанные слова (day().w), её отметки (day().m),
   тема сочинения на день (day().pk.essT), темы, на которые уже писала (state.essT), задание русского (state.ruCur). */

const PLAN_PHASES = [
  { id: 'p1', from: '2026-09-01', to: '2026-12-02', when: 'до 2 декабря', name: 'Итоговое сочинение + русский по заданиям', tag: 'итоговое сочинение',
    focus: 'Каждый день - норма 15 заданий тремя порциями по 5: русский, а во вторник, четверг и субботу вечером - общество. В выходные - сочинение недели на итоговое (по желанию). 1 декабря - только повторить свои книги, 2 декабря - итоговое.' },
  { id: 'p2', from: '2026-12-03', to: '2027-01-31', when: '3 декабря - январь', name: 'Русский по заданиям + сочинение ЕГЭ', tag: 'сочинение ЕГЭ',
    focus: 'Порции по 5 каждый день: русский дальше по порядку заданий, по Вт, Чт, Сб - общество. В выходные - сочинение ЕГЭ по тексту (задание 27).' },
  { id: 'p3', from: '2027-02-01', to: '2027-03-31', when: 'февраль - март', name: 'Сочинение ЕГЭ + пробники', tag: 'сочинение ЕГЭ + пробники', sat: 'mock',
    focus: 'Порции по 5 каждый день. В субботу - пробник тестовой части, в воскресенье - сочинение ЕГЭ.' },
  { id: 'p4', from: '2027-04-01', to: '2027-07-31', when: 'апрель - экзамен', name: 'Пробники и повторение', tag: 'пробники + повторение', sat: 'mock',
    focus: 'Порции - из красной тетради и вперемешку, в субботу - пробник. Новых тем не берём - доводим до идеала то, что знаешь.' },
];
const NORM = 15, PORTION = 5, MIN_N = 5;
const EVE_N = PORTION; // «Ещё N» после тренировки и в задании - тоже порция
const SOC_DAYS = { 2: 1, 4: 1, 6: 1 }; // Вт, Чт, Сб: третья порция - обществознание
const PLAN_SPECIAL = { '2026-12-01': 'review', '2026-12-02': 'exam' };
/* письменный шаг засчитан, когда сегодня в поле написано не меньше need слов и из них новых - не меньше gain */
const PLAN_WRITE = { fpText: ['para', 50, 40], fText: ['full', 250, 200], esText: ['ess27', 150, 120] };
const PORTION_WHEN = ['До уроков', 'На перемене', 'Вечером'];

const planPhase = (k = today()) => PLAN_PHASES.find(p => k >= p.from && k <= p.to) || (k < PLAN_PHASES[0].from ? PLAN_PHASES[0] : PLAN_PHASES[PLAN_PHASES.length - 1]);
const weekStart = k => addDays(k, -((D(k).getDay() + 6) % 7));
const isWeekend = k => [0, 6].includes(D(k).getDay());

/* ---- сочинение: тема на день - к прочитанным книгам, направления по кругу, сначала темы, на которые ещё не писала ---- */
function essCands() { const read = new Set(finReadWorks().map(w => w.id)), c = FIN_T.filter(t => (t.works || []).some(id => read.has(id))); return c.length ? c : FIN_T; }
function essPick(k) {
  const c = essCands(); if (!c.length) return null;
  const mod = (a, m) => ((a % m) + m) % m, n = Math.round(D(k) / 864e5), subs = [...new Set(c.map(t => t.sub))], sub = subs[mod(n, subs.length)];
  const pool = c.filter(t => t.sub === sub), fresh = pool.filter(t => !state.essT?.[t.id]), L = fresh.length ? fresh : pool;
  return L[mod(Math.floor(n / subs.length), L.length)];
}
function essTopic(k, d) {
  const cur = d.pk?.essT ? finTopic(d.pk.essT) : null; if (cur) return cur;
  const t = essPick(k); if (t && k === today()) { d.pk = { ...(d.pk || {}), essT: t.id }; save(); }
  return t;
}
const essWorks = t => finReadWorks().filter(w => (t.works || []).includes(w.id)).slice(0, 3);
/* сочинения целиком: дни, когда в поле написано 250+ новых слов (w.full, w.ess27) или она отметила кружок (m.fin, m.ess27) */
const essDayDone = d => !!(d?.w?.full || d?.m?.fin || d?.w?.ess27 || d?.m?.ess27);
const finEssDays = () => Object.keys(state.days || {}).filter(k => essDayDone(state.days[k]));
const essWeekDone = (k = today()) => { const ws = weekStart(k); return Object.keys(state.days || {}).some(x => x >= ws && x <= k && essDayDone(state.days[x])); };
/* книга для итогового (экран «План до ЕГЭ»): та, что читает, или та, что закроет больше всего тем */
function planBook() {
  const b = finWork(state.planBook); if (b && !finReadOf(b.id)) return b;
  const cov = finCovered(), next = FIN_W.filter(w => !finReadOf(w.id)).map(w => ({ w, g: finGain(w, cov) })).filter(x => x.g > 0)
    .sort((a, b) => finShort(b.w) - finShort(a.w) || b.g - a.g)[0];
  return next?.w || finNextWork();
}

/* ---- русский по заданиям: сначала теория, потом все задания темы до конца. Задание пройдено, когда решены все его задания
   хотя бы по разу (или она нажала «Уже знаю»). state.ruPath[номер] = { th: дата теории, done: дата «уже знаю» },
   state.ruCur - задание, которое она взяла сама.
   03.11.2026 её пробник: 1-8 верно, 9-14 - «всё ужасно» - поэтому сначала орфография 9-15, потом пунктуация, текст, а 1-8 в конце */
const RU_PATH = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 26, 24, 23, 25, 3, 5, 4, 7, 6, 8, 1, 2];
if (!state.orthoFocus) { if (state.ruCur && state.ruCur < 9) delete state.ruCur; state.orthoFocus = today(); save(); }
const ORTHO = [9, 10, 11, 12, 13, 14, 15];
const orthoPool = () => [...new Set(ORTHO.flatMap(n => [...(TASK_ITEMS['ru:' + n] || []), ...(TASK_ITEMS['ruE:' + n] || [])]))];
const ruP = n => state.ruPath?.[n] || {};
const ruSet = (n, patch) => { state.ruPath = state.ruPath || {}; state.ruPath[n] = { ...(state.ruPath[n] || {}), ...patch }; };
const ruTopicKey = n => ((TASK_ITEMS['ru:' + n] || []).length ? 'ru:' : 'ruE:') + n;
/* 17.11.2026 её просьба: «задание первое из всех вариантов - туда, в задание 1, чтобы нарешивать настоящие». Поэтому в задании
   всё вместе: тренировка программы (ru:N) и задания ЕГЭ (ruE:N - банк ФИПИ и сборники 2027, у них есть pk - пакет).
   Задание пройдено, когда решена вся тренировка и не меньше RU_REAL_MIN настоящих заданий этого номера (все - это недели
   на один номер); остальные настоящие продолжают выпадать в «Продолжить» и есть на экране задания («Задания ЕГЭ»). */
const RU_REAL_MIN = 40;
const ruPool = n => [...new Set([...(TASK_ITEMS['ru:' + n] || []), ...(TASK_ITEMS['ruE:' + n] || [])])];
const ruProg = n => { const ids = ruPool(n); let seen = 0; for (const id of ids) if (itemStatus(id) !== 'new') seen++; return { seen, total: ids.length }; };
const ruTotal = n => ruPool(n).length;
const ruPassed = n => {
  if (ruP(n).done) return true;
  const all = ruPool(n); if (!all.length) return false;
  const seen = id => itemStatus(id) !== 'new', real = all.filter(id => ITEMS[id]?.pk);
  return all.every(id => ITEMS[id]?.pk || seen(id)) && real.filter(seen).length >= Math.min(real.length, RU_REAL_MIN);
};
const ruTheoryOk = n => !!ruP(n).th || ruProg(n).seen >= 10;
const ruPassedList = () => RU_PATH.filter(ruPassed);
const ruOpen = n => ruTask(n) && ruPool(n).length && !ruPassed(n);
const ruTopic = () => (ruOpen(state.ruCur) ? state.ruCur : RU_PATH.find(ruOpen)) || null;
function ruPractice(n, cnt = PORTION) {
  const T = ruTask(n);
  startPool(`Задание ${n}: ${T ? T.title : ''}`, ruPool(n), cnt, { key: ruTopicKey(n) });
}
/* обществознание: сначала её слабое - Конституция и право (15.11.2026), потом по порядку тем; английский - по порядку */
const SOC_ORDER = () => SOC_TOPICS.filter(t => (TASK_ITEMS['soc:' + t.id] || []).length);
const SOC_FOCUS = ['konst', 'law', 'polit', 'power'];
function socNow() {
  const L = SOC_ORDER(), m = t => mastery('soc:' + t.id), open = t => t && m(t).seen < m(t).total;
  const f = SOC_FOCUS.map(id => L.find(t => t.id === id)).find(open);
  return f || L.find(open) || [...L].sort((a, b) => m(a).pct - m(b).pct)[0] || null;
}
const EN_ORDER = ['gram', 'wf', 'lex', 'read', 'listen'];
const EN_LIST = () => EN_ORDER.map(enSec).filter(s => s && (TASK_ITEMS['en:' + s.id] || []).length);
function enNow() { const L = EN_LIST(), m = s => mastery('en:' + s.id); return L.find(s => m(s).seen < m(s).total) || [...L].sort((a, b) => m(a).pct - m(b).pct)[0] || null; }

/* ---- порции: что решать. Сначала её ошибки по предмету на сегодня, потом задание (тема), которое она проходит ---- */
function portionSubj(k, i) { return i === 2 && SOC_DAYS[D(k).getDay()] ? 'soc' : 'ru'; }
function portionInfo(subj) {
  if (subj === 'soc') {
    const tp = socNow(), m = tp ? mastery('soc:' + tp.id) : null;
    const errs = errDue().filter(e => errGroup(e) === 'soc').map(e => e.id).filter(id => getItem(id));
    return { subj, area: 'Обществознание', title: tp ? tp.title : 'Обществознание', key: tp ? 'soc:' + tp.id : null, topic: tp?.id,
      prog: m ? [m.seen, m.total] : null, theory: !!tp && !m.seen, pool: [...new Set([...errs, ...(tp ? TASK_ITEMS['soc:' + tp.id] || [] : [])])] };
  }
  const n = ruTopic(), pr = n ? ruProg(n) : null;
  const errs = errDue().filter(e => errGroup(e) === 'ru').map(e => e.id).filter(id => getItem(id));
  return { subj, area: n ? `Русский · задание ${n}` : 'Русский', title: n ? ruTask(n).title : 'Орфография 9-15 вперемешку', key: n ? ruTopicKey(n) : 'ortho', n,
    prog: pr ? [pr.seen, pr.total] : null, theory: !!n && !ruTheoryOk(n), pool: [...new Set([...errs, ...(n ? ruPool(n) : orthoPool())])] };
}
function startPortion(subj) {
  const P = portionInfo(subj); if (!P.pool.length) { toast('Здесь пока нечего решать'); return; }
  startPool(`${P.subj === 'soc' ? 'Общество' : 'Русский'}: ${PORTION} заданий`, P.pool, PORTION, P.key ? { key: P.key } : {});
}

/* ---- план на день ---- */
function planToday(k = today()) {
  const d = day(k), ph = planPhase(k), n = d.n || 0, done = Math.min(3, Math.floor(n / PORTION));
  const steps = [0, 1, 2].map(i => ({ i, when: PORTION_WHEN[i], subj: portionSubj(k, i), done: done > i }));
  return { k, ph, n, done, steps, ess: essStep(k, d, ph), special: PLAN_SPECIAL[k] || null };
}
/* выходные: сочинение недели (по желанию) - до 2 декабря итоговое, потом сочинение ЕГЭ; в субботу в феврале-мае - пробник */
function essStep(k, d, ph) {
  if (PLAN_SPECIAL[k] || !isWeekend(k)) return null;
  if (ph.sat === 'mock' && D(k).getDay() === 6) return { id: 'mock', title: 'Пробник тестовой части', sub: '26 заданий подряд, как на экзамене, - в конце баллы по шкале ЕГЭ.', done: state.mocks.some(x => x.d === k), go: 'Начать' };
  if (ph.id === 'p1') {
    const tp = essTopic(k, d), ws = tp ? essWorks(tp) : [], ed = daysTo(ESSAY_DATE), cnt = finEssDays().length;
    return { id: 'fin', title: tp ? tp.text : 'Итоговое сочинение целиком', topic: tp?.id, done: essWeekDone(k), go: 'Писать', alt: tp ? ['essNew', 'Другая тема'] : null,
      sub: `Итоговое через ${ed} ${plural(ed, 'день', 'дня', 'дней')}, сочинений написано: ${cnt}. От 350 слов${ws.length ? `, подойдёт ${ws.map(x => `«${x.title}»`).join(', ')}` : ''}. Пишешь на бумаге - потом нажми кружок.` };
  }
  return { id: 'ess27', title: 'Сочинение ЕГЭ по тексту (задание 27)', done: essWeekDone(k), go: 'Писать',
    sub: 'Проблема, позиция автора, два примера из текста с пояснением и связью, твоё мнение. От 150 слов. На бумаге - потом нажми кружок.' };
}
/* итог дня для полоски недели: [порций сделано, всего] */
function planSnap(P) { const d = day(P.k), v = [P.done, 3]; if (!d.pl || d.pl[0] !== v[0] || d.pl[1] !== v[1]) { d.pl = v; save(); } }
/* серия: дни подряд, когда сделана хотя бы одна порция (MIN_N заданий) или весь план; выходные без шагов серию не рвут */
const dayCounts = k => { const d = state.days[k], pl = d?.pl; return !!(pl && pl[1] > 0 && pl[0] >= pl[1]) || (d?.n || 0) >= MIN_N; };
function planStreak() {
  let k = today(), n = 0; const rest = x => x && x[1] === 0;
  if (!dayCounts(k)) k = addDays(k, -1);
  for (let i = 0; i < 400; i++, k = addDays(k, -1)) { if (dayCounts(k)) n++; else if (!rest(state.days[k]?.pl)) break; }
  return n;
}
function bestStreak() {
  const keys = Object.keys(state.days || {}).sort(); if (!keys.length) return 0;
  let best = 0, cur = 0;
  for (let k = keys[0]; k <= today(); k = addDays(k, 1)) { if (dayCounts(k)) { cur++; best = Math.max(best, cur); } else cur = 0; }
  return best;
}
/* бонусы за серию (её просьба: «мотивашки - если серия, то ещё что-то»): один раз за каждую серию */
const STREAK_BONUS = [[3, 50], [7, 150], [14, 400], [30, 1000]];
function streakBonus() {
  const s = planStreak(); if (!s) return 0;
  const start = addDays(today(), -(s - 1)); let got = 0;
  for (const [m, amt] of STREAK_BONUS) if (s === m && once(`ser:${m}:${start}`)) got += earn(amt, `серия ${m} ${plural(m, 'день', 'дня', 'дней')} подряд`);
  if (s > 30 && s % 30 === 0 && once(`ser:${s}:${start}`)) got += earn(1000, `серия ${s} дней подряд`);
  if (got) save();
  return got;
}
const nextBonus = s => STREAK_BONUS.find(([m]) => m > s) || [Math.ceil((s + 1) / 30) * 30, 1000];

/* ---- учёт: ответы сегодня по предметам, видам заданий итогового и тренировкам; бонус за серию; сигнал напоминаниям ---- */
const record0 = record;
record = function (it, ok, my) {
  const d = day(), t = d.t = d.t || {}, inc = x => { t[x] = (t[x] || 0) + 1; }, before = d.n || 0;
  if (it?.subj) inc(it.subj);
  if (it?.subj === 'fin' && it.task) inc('fin:' + it.task);
  if (it?.subj === 'ru' && it.task) inc('ru:' + it.task);
  if (ses?.key) inc('s:' + ses.key);
  let got = record0(it, ok, my);
  if (before < MIN_N && (day().n || 0) >= MIN_N) got += streakBonus();
  if (typeof notifyPing === 'function') notifyPing();
  return got;
};
/* письменные шаги: новые слова = разница с тем, сколько было в поле, когда она его открыла сегодня */
document.addEventListener('focusin', e => {
  if (!PLAN_WRITE[e.target?.id]) return;
  const d = day(), lo = d.wl = d.wl || {}; if (lo[e.target.id] == null) { lo[e.target.id] = words(e.target.value); save(); }
});
document.addEventListener('input', e => {
  const W = PLAN_WRITE[e.target?.id]; if (!W) return;
  const n = words(e.target.value), d = day(), lo = d.wl = d.wl || {}, w = d.w = d.w || {};
  lo[e.target.id] = Math.min(lo[e.target.id] ?? n, n);
  if (!w[W[0]] && n >= W[1] && n - lo[e.target.id] >= W[2]) { w[W[0]] = 1; save(); }
});

/* ================= главный экран ================= */
ICONS.right = '<path d="M9 5l7 7-7 7"/>';
const COVER_LINES = ['Цель - сотка, минимум 80+. По 5 заданий за раз.', 'Сотка складывается из маленьких дней.', 'Не идеально, а каждый день.', 'Пять заданий - и день засчитан.', 'Маленькие порции - баллы в мае.', 'Ты уже в пути. Просто следующая порция.'];
function coverHTML() {
  const ed = daysTo(ESSAY_DATE), xd = daysTo(EXAM_DATE), n = Math.round(D(today()) / 864e5);
  return `<section class="cover">
    <div class="cv-brand"><span class="cv-k">ЕГЭ<br>на</span><span class="cv-n">100</span></div>
    <p class="cv-sub">${COVER_LINES[((n % COVER_LINES.length) + COVER_LINES.length) % COVER_LINES.length]}</p>
    <div class="cv-pills">${ed >= 0 ? `<button class="cv-pill" data-a="openFinal">${ic('pen', 15)} Итоговое ${ed ? `через ${ed} ${plural(ed, 'день', 'дня', 'дней')}` : 'сегодня'}</button>` : ''}${xd >= 0 ? `<button class="cv-pill" data-a="openPlan">${ic('cap', 15)} ЕГЭ - примерно через ${xd} ${plural(xd, 'день', 'дня', 'дней')}</button>` : ''}</div>
  </section>`;
}
function portionHTML(P, s, cur) {
  const I = portionInfo(s.subj), bar = I.prog && I.prog[1] ? `<div class="bar" style="height:6px;margin-top:6px"><i style="width:${I.prog[0] / I.prog[1] * 100}%"></i></div>` : '';
  const th = I.theory ? (s.subj === 'soc' ? `<button class="btn sm ghost pgo" data-a="socTheory" data-id="${esc(I.topic)}">Сначала теория</button>` : `<button class="btn sm ghost pgo" data-a="openTask" data-n="${I.n}">Сначала теория</button>`) : '';
  return `<div class="pstep ${s.done ? 'done' : ''} ${cur ? 'cur' : ''}">
    <span class="pchk" aria-hidden="true">${s.done ? ic('check', 20) : `<b>${s.i + 1}</b>`}</span>
    <div class="pbody"><div class="parea"><span class="pslot">${esc(s.when)}</span> ${esc(I.area)}</div><div class="pttl">${esc(I.title)}</div>
      ${s.done ? '' : cur ? `${I.prog ? `<div class="psub">Пройдено ${I.prog[0]} из ${I.prog[1]}${s.subj === 'ru' ? ' - идём до конца задания, потом следующее' : ''}.</div>` : ''}${bar}<div class="row" style="gap:8px"><button class="btn sm primary pgo" data-a="planGo" data-s="p${s.i}">${ic('play', 16)} ${PORTION} заданий</button>${th}</div>` : ''}
    </div></div>`;
}
function essRowHTML(e) {
  return `<div class="pstep ess ${e.done ? 'done' : ''}">
    <button class="pchk" data-a="planTick" data-s="${e.id}" aria-pressed="${e.done}" aria-label="${e.done ? 'Сделано' : 'Отметить: написала'}">${e.done ? ic('check', 20) : ''}</button>
    <div class="pbody"><div class="parea"><span class="pslot">Выходные</span> ${e.id === 'mock' ? 'Пробник' : 'Сочинение недели · по желанию'}</div><div class="pttl">${esc(e.title)}</div>
      ${e.done ? `<div class="psub">${e.id === 'mock' ? 'Пробник на этой неделе есть.' : 'На этой неделе сочинение есть - молодец!'}</div>` : `<div class="psub">${esc(e.sub)}</div><div class="row" style="gap:8px"><button class="btn sm pgo" data-a="planGo" data-s="${e.id}">${ic('pen', 16)} ${esc(e.go)}</button>${e.alt ? `<button class="btn sm ghost pgo" data-a="${e.alt[0]}">${esc(e.alt[1])}</button>` : ''}</div>`}
    </div></div>`;
}
function specialHTML(sp) {
  if (sp === 'review') return `<div class="pdone">${ic('book', 22)}<div><b>Завтра итоговое - сегодня только повторить</b><div class="small">Перечитай «Как писать» и «Кратко» своих книг, вспомни аргументы. Новое не учи. Паспорт, чёрная гелевая ручка, вода - с вечера.</div><button class="btn sm" data-a="planGo" data-s="review" style="margin-top:8px">Мои книги</button></div></div>`;
  if (sp === 'exam') return `<div class="pdone">${ic('star', 22)}<div><b>Сегодня итоговое сочинение</b><div class="small">Вступление - два аргумента из книг - вывод, от 350 слов. Ты готовилась - всё получится!</div></div></div>`;
  return '';
}
function planCardHTML(P) {
  const nx = P.steps.find(s => !s.done), n = P.n;
  const status = n >= NORM ? `Норма сделана${state.paid['norm:' + P.k] ? ': +100 ₽ уже в копилке' : ''}. Дальше - только если хочется.`
    : n >= MIN_N ? `День засчитан! Ещё ${NORM - n} - и норма: +100 ₽ в копилку.`
    : n ? `Ещё ${MIN_N - n} - и день засчитан.` : 'Три порции по 5 заданий - когда удобно: до уроков, на перемене, вечером. Одна порция - и день засчитан.';
  return `<section class="card plan"><div class="row sb"><h2 class="h2">План на сегодня</h2><span class="kicker num">${Math.min(n, NORM)} из ${NORM}</span></div>
    <div class="bar"><i style="width:${Math.min(1, n / NORM) * 100}%"></i></div>
    <div class="muted small">${status}</div>
    ${P.special ? specialHTML(P.special) : ''}
    <div>${P.steps.map(s => portionHTML(P, s, s === nx)).join('')}</div>
    ${!nx ? `<div class="row" style="gap:8px"><button class="btn sm" data-a="planGo" data-s="more">${ic('play', 16)} Ещё ${PORTION}</button></div>` : ''}
    ${P.ess ? essRowHTML(P.ess) : ''}
    <button class="linkbtn" data-a="openPlan">Весь план до ЕГЭ ${ic('right', 16)}</button>
  </section>`;
}
function weekHTML() {
  const t = today(), mon = weekStart(t), names = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'], st = planStreak(), [bm, ba] = nextBonus(st);
  const cells = names.map((nm, i) => {
    const k = addDays(mon, i), pl = state.days[k]?.pl, cls = k > t ? 'fut' : dayCounts(k) ? 'full' : pl && pl[1] === 0 ? 'rest' : state.days[k]?.n ? 'part' : '';
    return `<div class="wd ${cls} ${k === t ? 'today' : ''}"><i>${cls === 'full' ? ic('check', 16) : D(k).getDate()}</i><span>${nm}</span></div>`;
  });
  return `<section class="card"><div class="row sb"><h2 class="h2">Неделя</h2><span class="chip fire">${ic('flame', 16)} ${st ? `${st} ${plural(st, 'день', 'дня', 'дней')} подряд` : 'серия начнётся сегодня'}</span></div><div class="week">${cells.join('')}</div>
    <p class="muted small" style="margin:0">День засчитан, если сделана хотя бы одна порция - ${MIN_N} заданий. ${st < bm ? `До бонуса +${ba} ₽ за серию - ещё ${bm - st} ${plural(bm - st, 'день', 'дня', 'дней')}.` : ''}</p></section>`;
}
/* быстрые тренировки - отдельной карточкой внизу главной (её просьба: не прятать в «Ещё») */
function quickHTML() {
  const un = errList().filter(e => !e.learned).length;
  return `<section class="card"><h2 class="h2">Быстро, по 10</h2><div class="row"><button class="btn sm" data-a="orthoGo">Орфография</button><button class="btn sm" data-a="quick" data-k="stress">Ударения</button><button class="btn sm" data-a="startExcAll">Исключения</button><button class="btn sm" data-a="quick" data-k="mix">Вперемешку</button><button class="btn sm" data-a="quick" data-k="soc">Общество</button><button class="btn sm" data-a="quick" data-k="en">Английский</button></div>
    <div class="row" style="gap:8px">${un ? `<button class="btn sm ghost" data-a="tab" data-t="err">${ic('note', 16)} Красная тетрадь: ${un}</button>` : ''}<button class="btn sm ghost" data-a="openWeak">${ic('star', 16)} Подтянуть</button><button class="btn sm ghost" data-a="goV" data-v="fav">Избранное</button></div></section>`;
}
/* «С возвращением»: за последние 5 дней день засчитан меньше чем 2 раза, сегодня ещё меньше MIN_N заданий, «Не сейчас» не нажато */
function backCardHTML() {
  const t = today(), d = state.days[t] || {};
  if ((d.n || 0) >= MIN_N || d.pk?.backHide || !Object.keys(state.ans || {}).length) return '';
  let good = 0; for (let i = 1; i <= 5; i++) if (dayCounts(addDays(t, -i))) good++;
  if (good >= 2) return '';
  return `<section class="card" style="border-left:5px solid var(--gold)"><h2 class="h2">С возвращением!</h2>
    <p style="margin:0">Последние дни получалось мало - так бывает. Не догоняем всё сразу: одна порция - ${MIN_N} заданий по русскому, минут пять. Сделаешь - день засчитан, а дальше по силам.</p>
    <div class="row"><button class="btn primary" data-a="five">${ic('play', 18)} ${MIN_N} заданий - начать</button><button class="btn sm ghost" data-a="backHide">Не сейчас</button></div></section>`;
}
/* упрямые ошибки: не выучены и ошибок STUB_MIN и больше - верный ответ на виду и прорешать отдельно */
const STUB_MIN = 3;
const stubList = () => errList().filter(e => !e.learned && (e.wrong || 0) >= STUB_MIN && getItem(e.id)).sort((a, b) => (b.wrong || 0) - (a.wrong || 0));
function stubbornCardHTML(home) {
  const L = stubList(); if (!L.length) return '';
  const rows = L.slice(0, home ? 2 : 10).map(e => {
    const it = getItem(e.id), tip = it.type === 'stress' && typeof STRESS_NOTE !== 'undefined' ? (STRESS_NOTE[it.w]?.[1] || '') : '';
    return `<div class="stub"><div class="muted small">${esc(itemLabel(it))} · ошибок: ${e.wrong}</div><div class="stub-a">${e.my ? `<s>${esc(e.my)}</s> ${ic('right', 14)} ` : ''}<b>${esc(correctText(it))}</b></div>${tip ? `<div class="small">${md(tip)}</div>` : ''}</div>`;
  }).join('');
  const more = home && L.length > 2 ? `<button class="linkbtn" data-a="tab" data-t="err">Все упрямые: ${L.length} ${ic('right', 16)}</button>` : '';
  return `<section class="card" style="border-left:5px solid var(--bad)"><div class="row sb"><h2 class="h2">Упрямые ошибки</h2><span class="kicker">${L.length}</span></div>
    <p class="muted small" style="margin:0">Здесь ты ошибалась ${STUB_MIN} раза и больше. Прочитай верный ответ вслух - и сразу прорешай.</p>
    <div>${rows}</div>${more}
    <button class="btn block" data-a="stubGo">${ic('repeat', 18)} Прорешать упрямые: ${L.length}</button></section>`;
}
vHome = function () {
  const P = planToday(); planSnap(P);
  return `<header class="stack" style="gap:4px;padding-top:6px"><div class="kicker">${WD[new Date().getDay()]}, ${fmtD(today())}</div><h1 class="h1">Привет, Даша!</h1><div class="muted small">офлайн-версия, всё на этом устройстве · ${dataLinkHTML()}</div></header>
  ${resumeCard()}
  ${iconCardHTML()}
  ${coverHTML()}
  ${backCardHTML()}
  ${planCardHTML(P)}
  ${typeof notifyHomeHTML === 'function' ? notifyHomeHTML() : ''}
  ${stubbornCardHTML(true)}
  ${weekHTML()}
  ${quickHTML()}`;
};

/* ---- после тренировки: сколько сегодня, засчитан ли день, «Ещё 5» и к плану ---- */
const vSesEnd0 = vSesEnd;
vSesEnd = function () {
  const h = vSesEnd0(), P = planToday(); planSnap(P);
  const more = ses?.pool?.length && !/Ещё \d/.test(h) ? `<button class="btn sm primary" data-a="planMore">${ic('play', 16)} Ещё ${PORTION}</button>` : '';
  const n = P.n, title = n >= NORM ? 'Норма дня сделана!' : n >= MIN_N ? 'День засчитан!' : `Ещё ${MIN_N - n} - и день засчитан`;
  const sub = n >= NORM ? 'Можно отдыхать - завтра новые порции.' : n >= MIN_N ? `Сегодня ${n} из ${NORM}. Ещё порция - когда будет минутка.` : 'Одна короткая порция - и серия продолжится.';
  return h + `<section class="card pnext"><div class="kicker">План дня · ${Math.min(n, NORM)} из ${NORM}</div><div class="pttl">${title}</div><div class="psub">${sub}</div><div class="row">${more}<button class="btn sm" data-a="sesHome">К плану дня</button></div></section>`;
};

/* ================= экран «План до ЕГЭ» ================= */
{
  const m3 = MILESTONES.find(m => m.id === 'm3'), m7 = MILESTONES.find(m => m.id === 'm7');
  if (m3) m3.t = 'Пробник русского: тест от 22 из 28 - первая ступенька к 80';
  if (m7) m7.t = 'Пробник русского: от 25 из 28 - уровень 80';
  MILESTONES.push(
    { id: 'm10', d: '2027-04-30', t: 'Сочинение ЕГЭ: от 20 из 22', auto: () => state.essays.some(e => (e.result?.total || 0) >= 20) },
    { id: 'm11', d: '2027-05-15', t: 'Пробник русского: от 27 из 28 - уровень 90+', auto: () => bestMock() >= 27, pct: () => bestMock() / 27 },
  );
  MILESTONES.sort((a, b) => a.d.localeCompare(b.d));
}
function milestonesHTML() {
  const t = today();
  return MILESTONES.map(m => { const done = msDone(m), late = !done && m.d < t, p = m.pct ? Math.max(0, Math.min(1, m.pct())) : null; return `<div class="ms"><button class="chk ${done ? 'on' : ''}" style="border:0;padding:0;width:auto" data-a="msTog" data-id="${m.id}" aria-label="Отметить"><span class="box">${ic('check', 18)}</span></button><div style="min-width:0"><div style="font-weight:800;${done ? 'text-decoration:line-through;color:var(--muted)' : ''}">${esc(m.t)}</div>${p != null && !done ? `<div class="bar" style="height:6px;margin-top:6px"><i style="width:${p * 100}%"></i></div>` : ''}</div><span class="when" style="${late ? 'color:var(--bad)' : ''}">до ${fmtD(m.d)}</span></div>`; }).join('');
}
vPlan = function () {
  const t = today(), cur = planPhase(t), next = MILESTONES.find(m => !msDone(m));
  const read = finReadWorks(), cov = finCovered().size, nx = finNextWork(), gain = nx && !finReadOf(nx.id) ? finGain(nx) : 0;
  const nRu = ruTopic(), ruDone = ruPassedList().length, open = id => ui.finOpen?.[id] ? 'open' : '', soc = socNow();
  const prow = (a, mark, cls, title, meta, val) => `<button class="prow" ${a}><span class="tnum ${cls}" style="font-size:16px">${mark}</span><span style="min-width:0"><span class="ttl">${title}</span><br><span class="tmeta">${meta}</span></span><span class="pts num">${val}</span></button>`;
  const ruRow = n => { const T = ruTask(n), ok = ruPassed(n), now = n === nRu, p = ruProg(n); return prow(`data-a="openTask" data-n="${n}"`, ok ? ic('check', 20) : n, ok ? 'done' : now ? '' : 'theory', esc(T.title), `задание ${n}${ok ? (ruP(n).done && p.seen < p.total ? ' · отмечено «уже знаю»' : ' · пройдено') : now ? ' · сейчас' : ''}`, `${p.seen}/${p.total}`); };
  const socRows = SOC_ORDER().map(x => { const m = mastery('soc:' + x.id), now = soc?.id === x.id, ok = m.total && m.seen >= m.total; return prow(`data-a="openTopic" data-id="${esc(x.id)}"`, ok ? ic('check', 20) : ic('scale', 20), ok ? 'done' : now ? '' : 'theory', esc(x.title), now ? 'сейчас' : ok ? 'пройдено' : 'дальше', `${m.seen}/${m.total}`); }).join('');
  const enRows = EN_LIST().map(x => { const m = mastery('en:' + x.id), ok = m.total && m.seen >= m.total; return prow(`data-a="openEn" data-id="${esc(x.id)}"`, ok ? ic('check', 20) : ic('globe', 20), ok ? 'done' : 'theory', esc(x.title), ok ? 'пройдено' : 'по желанию', `${m.seen}/${m.total}`); }).join('');
  return `<button class="back" data-a="back">${ic('left', 18)} Назад</button>
  <header class="stack" style="gap:6px"><div class="kicker">Цель - 100, минимум 80+</div><h1 class="h1">План до ЕГЭ</h1><p class="muted" style="margin:0">Каждый день - норма ${NORM} заданий тремя порциями по ${PORTION}: до уроков, на перемене, вечером - когда удобно. Одна порция - и день засчитан. Русский - главный, во вторник, четверг и субботу третья порция - обществознание. В выходные - сочинение недели, по желанию.</p></header>
  <section class="card" style="border-left:5px solid var(--rose)"><div class="kicker">Сейчас · ${esc(cur.when)}</div><h2 class="h2">${esc(cur.name)}</h2><p style="margin:0">${esc(cur.focus)}</p></section>
  <section class="card"><div class="row sb"><h2 class="h2">Русский по заданиям</h2><span class="kicker">${ruDone} из ${RU_PATH.length}</span></div>
    <p class="muted small" style="margin:0">Идём по порядку: задание - сначала теория, потом тренировка и настоящие задания ЕГЭ этого номера (из банка ФИПИ и сборников 2027, не меньше ${RU_REAL_MIN}), ошибки повторяются сами. ${nRu ? `Сейчас - задание ${nRu}, «${esc(ruTask(nRu).title)}».` : 'Все задания пройдены!'} Хочешь другое - открой его и нажми «Прочитала - закрепить».</p>
    <div class="bar"><i style="width:${ruDone / RU_PATH.length * 100}%"></i></div>
    ${nRu ? ruRow(nRu) : ''}
    <details class="fbd" data-fd="ru-path" ${open('ru-path')}><summary>Все задания по порядку</summary><div>${RU_PATH.filter(n => ruTask(n)).map(ruRow).join('')}</div></details></section>
  <section class="card"><h2 class="h2">Обществознание по темам</h2><p class="muted small" style="margin:0">Вторник, четверг и суббота - вечерняя порция. Сначала «Конституция и власть» и право, потом остальные темы.</p><div>${socRows}</div></section>
  ${cur.id === 'p1' ? `<section class="card"><h2 class="h2">Книги для итогового</h2>
    <div class="blk"><div class="row sb small"><span>Темы, к которым у тебя есть аргументы</span><span class="num">${cov} из ${FIN_T.length}</span></div><div class="bar"><i style="width:${FIN_T.length ? cov / FIN_T.length * 100 : 0}%"></i></div></div>
    <p class="muted small" style="margin:0">${read.length ? `Прочитано: ${read.map(w => `«${esc(w.title)}»`).join(', ')}.` : 'Отмечай прочитанные книги - здесь будет видно, к каким темам хватает аргументов.'} На сочинении хватит 4-5 книг, которые знаешь хорошо.</p>
    ${nx ? `<button class="btn block" data-a="finWork" data-id="${esc(nx.id)}">${ic('book', 18)} ${finReadOf(nx.id) ? 'Закрепить' : 'Следующая'}: «${esc(nx.title)}»${gain ? ` (+${gain} ${plural(gain, 'тема', 'темы', 'тем')})` : ''}</button>` : ''}</section>` : ''}
  <section class="card"><h2 class="h2">Английский по разделам</h2><p class="muted small" style="margin:0">Пока по желанию - в план дня не входит.</p><div>${enRows}</div></section>
  <section class="card"><h2 class="h2">Этапы до экзамена</h2><div>${PLAN_PHASES.map(ph => { const now = ph === cur, past = t > ph.to; return `<div class="ph ${now ? 'now' : past ? 'past' : ''}"><span class="phd">${past ? ic('check', 14) : ''}</span><div style="min-width:0"><div class="row sb"><b>${esc(ph.name)}</b>${now ? '<span class="chip fire">сейчас</span>' : ''}</div><div class="muted small">${esc(ph.when)}</div>${now ? '' : `<p class="small" style="margin:4px 0 0">${esc(ph.focus)}</p>`}</div></div>`; }).join('')}</div></section>
  <section class="card"><h2 class="h2">Вехи</h2><div>${milestonesHTML()}</div></section>
  <section class="card"><h2 class="h2">Сколько нужно на 80+ и на 100</h2><p style="margin:0">100 баллов по русскому - это все <b>50 первичных</b>: 28 за тестовую часть и 22 за сочинение. <b>80 баллов - около 43 первичных</b>, например тест 25 из 28 и сочинение 18 из 22. 90 - около 47. Шкала 2026 года, примерно.</p><p class="muted small" style="margin:0">Итоговое сочинение - это зачёт или незачёт: допуск к ЕГЭ, баллы за него не ставят.</p></section>
  ${next ? '' : '<section class="card celebrate"><div class="h2">Все вехи взяты!</div></section>'}`;
};

/* ================= вкладка «Копилка» - кабинет ================= */
const pctS = x => Math.round(x * 100) + '%';
/* «было -> стало»: по каждой теме - первые ответы против последних (по датам), если ответов хотя бы 12 */
const growKey = it => it.subj === 'ru' && it.task ? 'ru:' + it.task : it.subj === 'soc' ? 'soc:' + it.task : it.subj === 'en' ? 'en:' + it.task : it.subj === 'fin' ? 'fin' : null;
function growName(k) {
  const [s, t] = k.split(':');
  if (s === 'ru') { const T = ruTask(+t); return `Задание ${t}${T ? ': ' + T.title : ''}`; }
  if (s === 'soc') return `Общество: ${socTopic(t)?.title || t}`;
  if (s === 'en') return `Английский: ${enSec(t)?.title || t}`;
  return 'Книги для итогового';
}
function growthRows() {
  const by = {};
  for (const [id, arr] of Object.entries(state.ans || {})) { const it = getItem(id), k = it && growKey(it); if (!k) continue; for (const x of arr) (by[k] = by[k] || []).push(x); }
  const rows = [];
  for (const [k, L] of Object.entries(by)) {
    if (L.length < 12) continue;
    L.sort((a, b) => a[0].localeCompare(b[0]));
    const m = Math.min(10, Math.floor(L.length / 2)), avg = A => A.reduce((s, x) => s + (x[1] ? 1 : 0), 0) / A.length;
    rows.push({ k, p1: avg(L.slice(0, m)), p2: avg(L.slice(-m)), n: L.length, m, d1: L[0][0], d2: L[L.length - 1][0] });
  }
  return rows.sort((a, b) => (b.p2 - b.p1) - (a.p2 - a.p1) || b.n - a.n);
}
function growthHTML() {
  const R = growthRows().slice(0, 6);
  if (!R.length) return `<section class="card"><h2 class="h2">Было → стало</h2><p class="muted small" style="margin:0">Появится, когда по какой-нибудь теме будет хотя бы 12 ответов.</p></section>`;
  return `<section class="card"><h2 class="h2">Было → стало</h2>
    ${R.map(r => { const up = r.p2 - r.p1; return `<div class="grow"><div class="row sb small"><b style="min-width:0">${esc(growName(r.k))}</b><span class="num ${up > 0.04 ? 'up' : up < -0.04 ? 'down' : ''}">${pctS(r.p1)} → ${pctS(r.p2)}</span></div><div class="gbars"><i style="width:${r.p1 * 100}%"></i><i class="now" style="width:${r.p2 * 100}%"></i></div></div>`; }).join('')}
    <details class="fbd"><summary>i - как посчитано</summary><p class="small" style="margin:0">«Было» - доля верных среди твоих первых ответов по теме (до 10 штук), «стало» - среди последних (до 10). Берутся темы, где ответов хотя бы 12. Порядок - по датам ответов.</p></details></section>`;
}
function calHTML() {
  const t = today(), mon = addDays(weekStart(t), -28), names = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'], cells = [];
  for (let i = 0; i < 35; i++) { const k = addDays(mon, i), n = state.days[k]?.n || 0, lv = k > t ? 'fut' : n >= NORM ? 'l3' : n >= MIN_N ? 'l2' : n ? 'l1' : ''; cells.push(`<i class="${lv} ${k === t ? 'today' : ''}" title="${fmtD(k)}: ${n}"></i>`); }
  const active = Object.values(state.days || {}).filter(d => d.n > 0).length;
  return `<section class="card"><div class="row sb"><h2 class="h2">Активность</h2><span class="kicker">${active} ${plural(active, 'день', 'дня', 'дней')} с занятиями</span></div>
    <div class="cal"><div class="cal-h">${names.map(x => `<span>${x}</span>`).join('')}</div><div class="cal-g">${cells.join('')}</div></div>
    <div class="cal-l small muted"><span><i class="l1"></i> 1-4</span><span><i class="l2"></i> 5-14 - день засчитан</span><span><i class="l3"></i> 15+ - норма</span></div></section>`;
}
function doneHTML() {
  const days = Object.values(state.days || {}), all = days.reduce((s, d) => s + (d.n || 0), 0), ok = days.reduce((s, d) => s + (d.ok || 0), 0);
  const errs = errList(), learned = errs.filter(e => e.learned).length, read = finReadWorks().length;
  const socDone = SOC_ORDER().filter(x => { const m = mastery('soc:' + x.id); return m.total && m.seen >= m.total; }).length;
  const tile = (v, l) => `<div class="tile"><b class="num">${v}</b><span>${l}</span></div>`;
  return `<section class="card"><h2 class="h2">Что уже сделано</h2><div class="tiles">
    ${tile(all, `${plural(all, 'ответ', 'ответа', 'ответов')} всего`)}${tile(all ? pctS(ok / all) : '-', 'верных')}
    ${tile(`${learned} из ${errs.length}`, 'ошибок выучено')}${tile(`${ruPassedList().length} из ${RU_PATH.length}`, 'заданий русского пройдено')}
    ${tile(`${socDone} из ${SOC_ORDER().length}`, 'тем общества пройдено')}${tile(read, `${plural(read, 'книга', 'книги', 'книг')} для итогового`)}
    ${tile(bestStreak(), 'лучшая серия, дней')}${tile(finEssDays().length, 'сочинений написано')}
  </div></section>`;
}
function bankHeroHTML() {
  const g = mainGift(), pd = perDay(), wk = state.ledger.filter(x => x.amt > 0 && x.d >= addDays(today(), -6)).reduce((s, x) => s + x.amt, 0);
  let eta = '';
  if (g && state.coins < g.cost) { const days = Math.ceil((g.cost - state.coins) / Math.max(pd, 1)); eta = `При таком темпе - примерно к ${fmtD(addDays(today(), days))}.`; }
  return `<section class="card bank"><div class="row sb"><div><div class="coin">${rub(state.coins)}</div><div class="muted small">заработано всего ${rub(state.earned || 0)}</div></div><span class="chip ${wk ? 'fire' : ''}">+${rub(wk)} за 7 дней</span></div>
    ${g ? `<div class="blk"><div class="row sb"><b>${ic('star', 16)} ${esc(g.title)}</b><span class="num muted small">${pctS(Math.min(1, state.coins / g.cost))}</span></div><div class="bar gold" style="height:14px"><i style="width:${Math.min(100, state.coins / g.cost * 100)}%"></i></div><p class="small" style="margin:0">${state.coins >= g.cost ? '<b>Хватает! Можно покупать.</b>' : `Осталось ${rub(g.cost - state.coins)}. ${eta}`}</p></div>` : '<p class="muted" style="margin:0">Добавь подарок, на который копишь (ниже).</p>'}
    <details class="fbd"><summary>i - как посчитан темп</summary><p class="small" style="margin:0">Сумма, что пришла в копилку за последние 14 дней, делённая на 14. Если за эти дни занималась меньше трёх дней, считаю по 300 ₽ в день.</p></details></section>`;
}
function streakCardHTML() {
  const s = planStreak(), best = bestStreak(), [bm, ba] = nextBonus(s);
  return `<section class="card"><div class="row sb"><h2 class="h2">Серия</h2><span class="chip fire">${ic('flame', 16)} ${s} ${plural(s, 'день', 'дня', 'дней')}</span></div>
    <p style="margin:0">${s ? `Ты занимаешься ${s} ${plural(s, 'день', 'дня', 'дней')} подряд.` : 'Серия начнётся с первой порции - 5 заданий.'} Ещё ${bm - s} ${plural(bm - s, 'день', 'дня', 'дней')} - и <b>+${ba} ₽</b>. Лучшая серия - ${best} ${plural(best, 'день', 'дня', 'дней')}.</p>
    <div class="sers">${STREAK_BONUS.map(([m, amt]) => `<div class="ser ${s >= m ? 'on' : ''}"><b>${m}</b><span>${plural(m, 'день', 'дня', 'дней')}</span><em>+${amt} ₽</em></div>`).join('')}</div>
    <p class="muted small" style="margin:0">День засчитан, если решено хотя бы ${MIN_N} заданий. Бонус - один раз за каждую серию.</p></section>`;
}
function nowCabHTML() {
  const pct = x => Math.round(x * 100) + '%';
  const row = (a, icon, cls, title, meta, val, p) => `<button class="prow" ${a}><span class="tnum ${cls}">${ic(icon, 22)}</span><span style="min-width:0"><span class="ttl">${title}</span><br><span class="tmeta">${meta}</span>${p != null ? `<span class="bar" style="display:block;height:6px;margin-top:6px"><i style="width:${p * 100}%"></i></span>` : ''}</span><span class="pts num">${val}</span></button>`;
  const read = finReadWorks(), cov = finCovered().size, n = ruTopic(), pr = n ? ruProg(n) : null, tp = socNow(), sm = tp ? mastery('soc:' + tp.id) : null;
  return `<section class="card"><h2 class="h2">Где я сейчас</h2><div>
    ${row('data-a="tab" data-t="final"', 'pen', '', 'Итоговое сочинение', `прочитано ${read.length} ${plural(read.length, 'книга', 'книги', 'книг')} · аргументы к ${cov} из ${FIN_T.length} тем`, pct(FIN_T.length ? cov / FIN_T.length : 0), FIN_T.length ? cov / FIN_T.length : 0)}
    ${n ? row(`data-a="openTask" data-n="${n}"`, 'book', 'theory', `Русский: задание ${n}`, `${esc(ruTask(n).title)} - пройдено ${pr.seen} из ${pr.total}`, `${pr.seen}/${pr.total}`, pr.total ? pr.seen / pr.total : 0) : row('data-a="tab" data-t="ru"', 'book', 'theory', 'Русский', 'все задания пройдены', pct(1), null)}
    ${tp ? row(`data-a="openTopic" data-id="${esc(tp.id)}"`, 'scale', 'theory', 'Обществознание', `${esc(tp.title)} - пройдено ${sm.seen} из ${sm.total}`, `${sm.seen}/${sm.total}`, sm.total ? sm.seen / sm.total : 0) : ''}
  </div></section>`;
}
const vGiftsCab0 = vGifts;
vGifts = function () {
  const base = vGiftsCab0(), at = base.indexOf('<section class="card"><h2 class="h2">На что коплю');
  let rest = at >= 0 ? base.slice(at) : '';
  const bonusRows = STREAK_BONUS.map(([m, amt]) => `<tr><td>Серия ${m} ${plural(m, 'день', 'дня', 'дней')} подряд (хотя бы ${MIN_N} заданий в день)</td><td>+${amt} ₽</td></tr>`).join('');
  rest = rest.replace('<tr><td>Сочинение, проверенное по критериям', bonusRows + '<tr><td>Сочинение, проверенное по критериям');
  const pd = perDay(), wkPace = Math.round(pd * 7 / 10) * 10;
  rest = rest.replace('Если заниматься каждый день по 20-30 минут, выходит около 8-10 тысяч в месяц.', `По твоему темпу за последние 2 недели - около ${rub(wkPace)} в неделю.`);
  return `${ui.stack.length ? `<button class="back" data-a="back">${ic('left', 18)} Назад</button>` : ''}<header class="stack" style="gap:4px;padding-top:6px"><div class="kicker">Мой кабинет</div><h1 class="h1">Копилка</h1><p class="muted" style="margin:0">Что ты уже сделала, сколько заработала и что получишь дальше. Деньги - твои: честно заработала учёбой.</p></header>
  ${bankHeroHTML()}
  ${streakCardHTML()}
  ${doneHTML()}
  ${growthHTML()}
  ${calHTML()}
  ${nowCabHTML()}
  ${typeof notifyCardHTML === 'function' ? notifyCardHTML() : ''}
  <section class="card"><h2 class="h2">Мои обещания на сегодня</h2><div>${promisesHTML()}</div></section>
  <section class="card"><div class="row sb"><h2 class="h2">Вехи</h2><button class="linkbtn inl" data-a="openPlan">весь план</button></div><div>${milestonesHTML()}</div></section>
  ${rest}`;
};

/* ================= действия ================= */
Object.assign(A, {
  planGo: b => {
    const id = b.dataset.s, start = (k, n = 10, title) => { const pool = TASK_ITEMS[k] || []; if (pool.length) startPool(title || keyTitle(k), pool, n, { key: k }); else toast('Здесь пока нечего решать'); };
    const m = /^p([012])$/.exec(id || '');
    if (m) startPortion(portionSubj(today(), +m[1]));
    else if (id === 'more') startPortion('ru'); // норма сделана, хочется ещё - русский
    else if (id === 'fin') { const tp = essTopic(today(), day()); if (tp) A.finWrite({ dataset: { id: tp.id } }); else { finRemember('write'); go({ v: 'final', sub: 'write', part: 'full' }); } }
    else if (id === 'ess27') A.continue({ dataset: { p: '2' } });
    else if (id === 'mock') startMock();
    else if (id === 'err') startMarathon();
    else if (id === 'review') { finRemember('works'); go({ v: 'final', sub: 'works' }); }
    else if (id === 'para') A.finParaMine();
    else if (id === 'authors') { finMinePools(); start((TASK_ITEMS['fin:nmine'] || []).length ? 'fin:nmine' : 'fin:n'); }
    else if (id === 'words') start('fin:v');
    else if (id === 'mybooks') { finMinePools(); start((TASK_ITEMS['fin:mine'] || []).length ? 'fin:mine' : 'fin:all'); }
  },
  /* кружок у сочинения недели (бумага) - отмечает она сама */
  planTick: b => {
    const id = b.dataset.s, e = planToday().ess; if (!e || e.id !== id) return;
    const d = day(), m = d.m = d.m || {}; if (m[id]) delete m[id]; else m[id] = 1;
    save(); render(); toast(m[id] ? 'Отмечено: написала' : 'Отметка снята');
  },
  planMore: () => { if (ses?.pool?.length) startPool(ses.title, ses.pool, PORTION, ses.key ? { key: ses.key } : {}); },
  essNew: () => {
    const d = day(), cur = d.pk?.essT, all = essCands().filter(t => t.id !== cur), fresh = all.filter(t => !state.essT?.[t.id]), L = fresh.length ? fresh : all;
    const t = L[Math.floor(Math.random() * L.length)]; if (!t) return;
    d.pk = { ...(d.pk || {}), essT: t.id }; save(); render(); toast('Новая тема на сегодня');
  },
  socTheory: b => go({ v: 'topic', id: b.dataset.id, sub: 'theory' }),
  bookQuiz: b => { if (finWork(b.dataset.id)) A.finWorkQuiz({ dataset: { id: b.dataset.id } }); },
  enTheory: b => go({ v: 'ensec', id: b.dataset.id }),
  five: () => { const P = planToday(), nx = P.steps.find(s => !s.done); startPortion(nx ? nx.subj : 'ru'); },
  backHide: () => { const d = day(); d.pk = { ...(d.pk || {}), backHide: 1 }; save(); render(); },
  stubGo: () => { const ids = stubList().map(e => e.id); if (ids.length) startPool('Упрямые ошибки', ids, ids.length); },
  goV: b => go({ v: b.dataset.v }),
});
/* написала сочинение на тему дня - тема уходит в «уже писала», в следующий раз будет другая */
{ const vH = vHome; vHome = function () { const d = day(), et = d.pk?.essT; if (et && (d.w?.full || d.m?.fin) && !state.essT?.[et]) { state.essT = { ...(state.essT || {}), [et]: today() }; save(); } return vH(); }; }

/* ---- экран задания, вкладка «Теория»: внизу - «Прочитала - закрепить»; это задание становится заданием плана ---- */
const vTask0 = vTask;
vTask = function (r) {
  const h = vTask0(r), T = ruTask(r.n); if (!T || T.n === 27 || !ruTotal(T.n)) return h;
  const m = mastery('ru:' + T.n), sub = r.sub || (m.total > 0 && m.seen ? 'train' : 'theory');
  if (sub !== 'theory') return h;
  const th = ruP(T.n).th, inPath = ruTopic() === T.n, p = ruProg(T.n);
  return h + `<section class="card" style="border-left:5px solid var(--violet)">
    <h2 class="h2">${th ? 'Закрепить тему' : 'Прочитала теорию?'}</h2>
    <p class="muted small" style="margin:0">${th ? `Теорию ты прочитала ${fmtD(th)}. ` : ''}Сразу закрепи: ${PORTION} заданий только по этой теме (пройдено ${p.seen} из ${p.total}). Ошибки уйдут в красную тетрадь - повторятся сами.${inPath ? ' Это задание плана.' : ' После этого оно станет заданием плана.'}</p>
    <button class="btn primary block" data-a="ruLearn" data-n="${T.n}">${ic('play', 18)} Прочитала - закрепить</button></section>`;
};
Object.assign(A, {
  ruLearn: b => { const n = +b.dataset.n; if (!ruP(n).th) ruSet(n, { th: today() }); state.ruCur = n; save(); ruPractice(n); },
  ruSkip: b => {
    const n = +b.dataset.n; ruSet(n, { done: today() }); if (state.ruCur === n) delete state.ruCur;
    save(); render(); toast(`Задание ${n} отмечено как знакомое - дальше следующее`);
  },
});
/* «По теме» на экране задания - с ключом темы: в конце видно, сколько осталось, а план засчитывает ответы */
A.startTask = b => ruPractice(+b.dataset.n);

/* ---- орфография: 10 заданий из 9-15 вперемешку ---- */
A.orthoGo = () => startPool('Орфография: задания 9-15', orthoPool(), 10, { key: 'ortho' });

/* ---- марафон ошибок по предметам (её просьба 03.11.2026: «чтобы не всё одним») ---- */
const ERR_GROUPS = { ru: 'русский', soc: 'обществознание', en: 'английский', fin: 'книги и итоговое', other: 'другое' };
const errGroup = e => ERR_GROUPS[e.subj] ? e.subj : 'other';
const startMarathon0 = startMarathon;
startMarathon = function (subj) {
  if (typeof subj !== 'string' || !ERR_GROUPS[subj]) return startMarathon0();
  const ids = errDue().filter(e => errGroup(e) === subj).map(e => e.id).filter(id => getItem(id));
  if (!ids.length) { toast('По этому предмету на сегодня всё повторено'); return; }
  ses = { sid: uid(), title: `Марафон ошибок: ${ERR_GROUPS[subj]}`, pool: ids, n: ids.length, ids: shuffle(ids.slice(0, 40)), i: 0, okN: 0, got: 0, newErr: 0, phase: 'q', sel: [], last: null, marathon: true, msubj: subj };
  sesGo();
};
const sesRestart0 = sesRestart;
sesRestart = function (x) { if (x && x.marathon && x.msubj) { ses = null; state.ses = null; save(); startMarathon(x.msubj); return; } return sesRestart0(x); };
A.marathonSubj = b => startMarathon(b.dataset.s);
const vErr0 = vErr;
vErr = function () {
  const h = vErr0(), due = errDue(), un = errList().filter(e => !e.learned);
  const rows = Object.keys(ERR_GROUPS).map(g => ({ g, d: due.filter(e => errGroup(e) === g).length, u: un.filter(e => errGroup(e) === g).length })).filter(x => x.u);
  const card = rows.length ? `<section class="card"><h2 class="h2">Марафон по предметам</h2><p class="muted small" style="margin:0">Повторяй ошибки одного предмета - так легче держать правило в голове.</p>
    <div class="stack" style="gap:8px">${rows.map(x => `<button class="btn block ${x.d ? '' : 'ghost'}" data-a="marathonSubj" data-s="${x.g}" ${x.d ? '' : 'disabled'}>${ic('repeat', 18)} ${ERR_GROUPS[x.g][0].toUpperCase() + ERR_GROUPS[x.g].slice(1)}: ${x.d ? `на сегодня ${x.d}` : 'на сегодня всё'} <span class="muted small">· учим ${x.u}</span></button>`).join('')}</div></section>` : '';
  const ins = card + stubbornCardHTML(false);
  if (!ins) return h;
  const at = h.indexOf('<section class="stack">');
  return at >= 0 ? h.slice(0, at) + ins + h.slice(at) : h + ins;
};
