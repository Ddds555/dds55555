/* ================= ПЛАН ДНЯ И ГЛАВНЫЙ ЭКРАН «ЕГЭ на 100» =================
   Её распорядок (01.11.2026): «сочинение пишу с утра, часов в девять; днём могу прочитать какое-то произведение;
   вечером на сочинение сил нет - могу что-то прорешать, и то лёгкое». Ещё: «английский, общество - про них тоже
   не надо забывать», «будем идти по каждому заданию» (сейчас она проходит все паронимы), «по минутам - непонятно».
   Поэтому день - три шага: утро - сочинение, день - чтение, вечер - 15 лёгких заданий одного предмета
   (Пн, Ср, Пт - русский по порядку заданий; Вт, Сб - обществознание; Чт, Вс - английский). Минут больше нет.
   Сочинение и чтение (бумага, книга) она отмечает сама - кружком; вечер отмечается сам, когда решено 15 заданий.
   Учёт: ответы за день по предметам и тренировкам (day().t), написанные слова (day().w), её отметки (day().m),
   тема сочинения на день (day().pk.essT), темы, на которые уже писала (state.essT), книга, которую читает
   (state.planBook), задание русского, которое проходит (state.ruCur). */

const PLAN_PHASES = [
  { id: 'p1', from: '2026-09-01', to: '2026-12-02', when: 'до 2 декабря', name: 'Итоговое сочинение + русский по заданиям', tag: 'итоговое сочинение', morning: 'fin', day: 'book',
    focus: 'Утром - сочинение на тему дня (темы подобраны к твоим книгам), днём - книга, вечером - 15 лёгких заданий. Русский идёт по порядку заданий, каждое - до конца. Общество и английский - по два вечера в неделю, чтобы не забывались.' },
  { id: 'p2', from: '2026-12-03', to: '2027-01-31', when: '3 декабря - январь', name: 'Сочинение ЕГЭ + русский по заданиям', tag: 'сочинение ЕГЭ', morning: 'ess27', day: 'book',
    focus: 'Утром - сочинение ЕГЭ по тексту (задание 27). Днём - книга: из неё примеры-аргументы для сочинения. Вечером - те же 15 лёгких заданий: русский дальше по порядку, общество, английский.' },
  { id: 'p3', from: '2027-02-01', to: '2027-03-31', when: 'февраль - март', name: 'Сочинение ЕГЭ + пробники', tag: 'сочинение ЕГЭ + пробники', morning: 'ess27', sat: 'mock', day: 'book',
    focus: 'Утром - сочинение ЕГЭ, в субботу утром вместо него - пробник тестовой части. Вечером - последние задания русского, потом всё вперемешку.' },
  { id: 'p4', from: '2027-04-01', to: '2027-07-31', when: 'апрель - экзамен', name: 'Пробники и повторение', tag: 'пробники + повторение', morning: 'ess27', sat: 'mock', day: 'err',
    focus: 'Суббота - пробник, в остальные утра - сочинение ЕГЭ. Днём - ошибки из красной тетради. Новых тем не берём - доводим до идеала то, что знаешь.' },
];
/* вечер: какой предмет в какой день недели (0 - воскресенье) */
const PLAN_EVE = { 1: 'ru', 2: 'soc', 3: 'ru', 4: 'en', 5: 'ru', 6: 'soc', 0: 'en' };
const PLAN_EVE_NAMES = { ru: 'русский', soc: 'обществознание', en: 'английский' };
const EVE_N = 15;
const PLAN_SPECIAL = { '2026-12-01': ['review', 'rest'], '2026-12-02': ['exam'] };
/* письменный шаг засчитан, когда сегодня в поле написано не меньше need слов и из них новых - не меньше gain */
const PLAN_WRITE = { fpText: ['para', 50, 40], fText: ['full', 250, 200], esText: ['ess27', 150, 120] };
const SLOTS = ['Утро · 9:00', 'День', 'Вечер'];
const eveLine = 'Пн, Ср, Пт - русский · Вт, Сб - общество · Чт, Вс - английский';

const planPhase = (k = today()) => PLAN_PHASES.find(p => k >= p.from && k <= p.to) || (k < PLAN_PHASES[0].from ? PLAN_PHASES[0] : PLAN_PHASES[PLAN_PHASES.length - 1]);
function planIds(k = today()) {
  if (PLAN_SPECIAL[k]) return PLAN_SPECIAL[k];
  const ph = planPhase(k), wd = D(k).getDay();
  return [wd === 6 && ph.sat ? ph.sat : ph.morning, ph.day, PLAN_EVE[wd]];
}
/* какая часть дня сейчас: 0 - утро, 1 - день, 2 - вечер */
const slotNow = () => { const h = new Date().getHours(); return h < 12 ? 0 : h < 17 ? 1 : 2; };

/* ---- утро: тема сочинения на день - к прочитанным книгам, направления по кругу, сначала темы, на которые ещё не писала ---- */
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
/* день: книга, которую она читает (выбрала в плане), - пока не нажмёт «Прочитала»; потом новая книга, которая закроет
   больше всего тем (сначала короткие). Тест по уже прочитанному - кнопкой рядом, а когда новых книг нет - сам шаг */
function planBook() {
  const b = finWork(state.planBook); if (b && !finReadOf(b.id)) return b;
  const cov = finCovered(), next = FIN_W.filter(w => !finReadOf(w.id)).map(w => ({ w, g: finGain(w, cov) })).filter(x => x.g > 0)
    .sort((a, b) => finShort(b.w) - finShort(a.w) || b.g - a.g)[0];
  return next?.w || finNextWork();
}
/* прочитанная книга, которую пора закрепить тестом (тест ниже 80%) */
const planFixBook = () => finReadWorks().filter(w => !finDone(w)).sort((a, b) => mastery('finw:' + a.id).pct - mastery('finw:' + b.id).pct)[0] || null;

/* ---- русский по заданиям: сначала теория, потом все задания темы до конца (её слова: «прошиваю все паронимы,
   будем идти по каждому заданию»). Порядок - от самых быстрых баллов; первыми - паронимы, их она сейчас проходит.
   Задание пройдено, когда решены все его задания хотя бы по разу (или она нажала «Уже знаю»).
   state.ruPath[номер] = { th: дата теории, done: дата «уже знаю» }, state.ruCur - задание, которое она взяла сама ---- */
const RU_PATH = [5, 4, 8, 22, 15, 12, 9, 16, 17, 7, 6, 10, 11, 13, 14, 18, 19, 20, 26, 24, 3, 21, 23, 25, 1, 2];
const ruP = n => state.ruPath?.[n] || {};
const ruSet = (n, patch) => { state.ruPath = state.ruPath || {}; state.ruPath[n] = { ...(state.ruPath[n] || {}), ...patch }; };
const ruTopicKey = n => ((TASK_ITEMS['ru:' + n] || []).length ? 'ru:' : 'ruE:') + n;
/* 25: в тренировке только фразеологизмы ФИПИ - добавляю и задания по текстам (синонимы, антонимы) */
const ruPool = n => n === 25 ? [...(TASK_ITEMS['ru:25'] || []), ...(TASK_ITEMS['ruE:25'] || [])] : (TASK_ITEMS[ruTopicKey(n)] || []);
const ruProg = n => { const ids = ruPool(n); let seen = 0; for (const id of ids) if (itemStatus(id) !== 'new') seen++; return { seen, total: ids.length }; };
const ruTotal = n => ruPool(n).length;
const ruSeen = n => ruProg(n).seen;
const ruPassed = n => { if (ruP(n).done) return true; const p = ruProg(n); return p.total > 0 && p.seen >= p.total; };
const ruTheoryOk = n => !!ruP(n).th || ruProg(n).seen >= 10;
const ruPassedList = () => RU_PATH.filter(ruPassed);
const ruOpen = n => ruTask(n) && ruPool(n).length && !ruPassed(n);
const ruTopic = () => (ruOpen(state.ruCur) ? state.ruCur : RU_PATH.find(ruOpen)) || null;
function ruPractice(n, cnt = EVE_N) {
  const T = ruTask(n);
  startPool(`Задание ${n}: ${T ? T.title : ''}`, ruPool(n), cnt, { key: ruTopicKey(n) });
}
/* обществознание и английский: тоже по порядку - тема, пока не решены все её задания; потом самая слабая */
const SOC_ORDER = () => SOC_TOPICS.filter(t => (TASK_ITEMS['soc:' + t.id] || []).length);
function socNow() { const L = SOC_ORDER(), m = t => mastery('soc:' + t.id); return L.find(t => m(t).seen < m(t).total) || [...L].sort((a, b) => m(a).pct - m(b).pct)[0] || null; }
const EN_ORDER = ['gram', 'wf', 'lex', 'read', 'listen'];
const EN_LIST = () => EN_ORDER.map(enSec).filter(s => s && (TASK_ITEMS['en:' + s.id] || []).length);
function enNow() { const L = EN_LIST(), m = s => mastery('en:' + s.id); return L.find(s => m(s).seen < m(s).total) || [...L].sort((a, b) => m(a).pct - m(b).pct)[0] || null; }

/* один шаг плана: часть дня, что делать, сделан ли */
function planStep(id, k, d) {
  const t = d.t || {}, w = d.w || {};
  const S = {
    fin: () => {
      const tp = essTopic(k, d), ws = tp ? essWorks(tp) : [];
      return { si: 0, area: 'Итоговое сочинение', title: tp ? tp.text : 'Сочинение целиком', go: 'Писать', alt: tp ? ['essNew', 'Другая тема'] : null,
        sub: `Напиши сочинение на эту тему, от 350 слов${ws.length ? `. Подойдёт: ${ws.map(x => `«${x.title}»`).join(', ')}` : ''}. Пишешь на бумаге - потом нажми кружок слева.`, done: !!w.full };
    },
    ess27: () => ({ si: 0, area: 'Сочинение ЕГЭ', title: 'Сочинение по тексту (задание 27)', go: 'Писать',
      sub: 'Проблема, позиция автора, два примера из текста с пояснением и связью, твоё мнение и пример-аргумент. От 150 слов. На бумаге - потом кружок слева.', done: !!w.ess27 }),
    mock: () => ({ si: 0, area: 'Пробник', title: 'Пробник тестовой части', go: 'Начать', sub: '26 заданий подряд, как на экзамене, - в конце баллы по шкале ЕГЭ. Сочинение сегодня утром не пишешь.', done: state.mocks.some(x => x.d === k) }),
    book: () => {
      const b = planBook(); if (!b) return null;
      const rd = !!finReadOf(b.id), g = rd ? 0 : finGain(b), au = b.authorShort || b.author, tested = Object.keys(t).filter(x => x.startsWith('s:finw:')).reduce((a, x) => a + t[x], 0);
      const fx = rd ? null : planFixBook();
      return { si: 1, area: 'Чтение', w: b.id, title: rd ? `Повторить «${b.title}»` : `Читать «${b.title}»`, go: rd ? 'Тест по книге' : 'Открыть книгу', alt: fx ? ['bookQuiz', `Тест: «${fx.title}»`] : null, fx: fx?.id,
        sub: rd ? `${au}. Короткий тест: герои, эпизоды, аргументы - чтобы книга не забылась к сочинению.` : `${au}, ${b.genre}${g ? `. Даст аргументы ещё к ${g} ${plural(g, 'теме', 'темам', 'темам')}` : ''}. Почитала сегодня - нажми кружок. Дочитаешь - в карточке «Прочитала», будет короткий тест.`,
        done: rd ? tested >= 8 : Object.values(state.readW || {}).includes(k) };
    },
    err: () => { const due = errDue().length; return { si: 1, area: 'Ошибки', title: due ? `Красная тетрадь: ${due}` : 'Ошибки на сегодня повторены', go: due ? 'Начать' : null, sub: 'Три верных ответа в разные дни - и ошибка выучена.', done: due === 0 }; },
    ru: () => {
      const n = ruTopic(), got = n ? t['ru:' + n] || 0 : t.ru || 0;
      if (!n) return { si: 2, area: 'Русский', title: `${EVE_N} заданий вперемешку`, go: 'Начать', more: 1, sub: 'Все задания пройдены: теперь 1-26 вперемешку, как на экзамене.', count: [Math.min(got, EVE_N), EVE_N], done: got >= EVE_N };
      const T = ruTask(n), pr = ruProg(n), th = ruTheoryOk(n), need = Math.min(EVE_N, pr.total);
      return { si: 2, area: `Русский · задание ${n}`, title: T.title, topic: n, prog: [pr.seen, pr.total], go: th ? 'Начать' : 'Теория', more: th ? 1 : 0,
        sub: th ? `${EVE_N} заданий. Пройдено ${pr.seen} из ${pr.total} - идём до конца, потом следующее задание.` : `Новое задание: сначала теория (минут пять), потом ${EVE_N} заданий.`, count: [Math.min(got, need), need], done: got >= need };
    },
    soc: () => {
      const tp = socNow(); if (!tp) return null;
      const m = mastery('soc:' + tp.id), got = t.soc || 0, need = Math.min(EVE_N, m.total);
      return { si: 2, area: 'Обществознание', title: tp.title, soc: tp.id, prog: [m.seen, m.total], go: 'Начать', alt: ['socTheory', 'Теория'], more: 1,
        sub: `${need} ${plural(need, 'вопрос', 'вопроса', 'вопросов')}. Пройдено ${m.seen} из ${m.total}${m.seen ? '' : ' - тема новая, сначала загляни в теорию'}.`, count: [Math.min(got, need), need], done: got >= need };
    },
    en: () => {
      const s = enNow(); if (!s) return null;
      const m = mastery('en:' + s.id), got = t.en || 0, need = Math.min(EVE_N, m.total);
      return { si: 2, area: 'Английский', title: s.title, en: s.id, prog: [m.seen, m.total], go: 'Начать', alt: ['enTheory', 'Теория'], more: 1,
        sub: `${need} ${plural(need, 'задание', 'задания', 'заданий')}. Пройдено ${m.seen} из ${m.total}.`, count: [Math.min(got, need), need], done: got >= need };
    },
    review: () => ({ si: 0, area: 'Итоговое сочинение', title: 'Завтра итоговое - только повторить', go: 'Мои книги', sub: 'Перечитай план «Как писать» и «Кратко» своих книг, вспомни аргументы. Новое сегодня не учи.', done: false }),
    rest: () => ({ si: 2, area: 'Отдых', title: 'Отдохни и выспись', go: null, sub: 'Паспорт, чёрная гелевая ручка, вода - собери с вечера.', done: false }),
    exam: () => ({ si: 0, area: 'Итоговое сочинение', title: 'Сегодня итоговое сочинение', go: null, sub: 'Вступление - два аргумента из книг - вывод, от 350 слов. Ты готовилась - всё получится!', done: false }),
  };
  const s = S[id]?.(); if (!s) return null;
  const auto = !!s.done;
  return { id, slot: SLOTS[s.si], ...s, auto, done: auto || !!d.m?.[id] };
}
function planToday(k = today()) {
  const d = day(k), ph = planPhase(k), steps = planIds(k).map(id => planStep(id, k, d)).filter(Boolean);
  /* написала сочинение на тему дня - тема уходит в «уже писала», завтра будет другая */
  const et = d.pk?.essT; if (k === today() && et && (d.w?.full || d.m?.fin) && !state.essT?.[et]) { state.essT = { ...(state.essT || {}), [et]: k }; save(); }
  return { k, ph, steps, done: steps.filter(s => s.done).length };
}
/* следующий шаг - по времени суток: вечером не зовём писать утреннее сочинение */
const planNext = P => { const sn = slotNow(); return P.steps.find(s => !s.done && s.si >= sn) || (sn === 2 ? null : P.steps.find(s => !s.done)) || null; };
/* итог дня для полоски недели: [сделано, всего] */
function planSnap(P) { const d = day(P.k), v = [P.done, P.steps.length]; if (!d.pl || d.pl[0] !== v[0] || d.pl[1] !== v[1]) { d.pl = v; save(); } }
/* серия: дни подряд, когда план выполнен целиком; выходные без шагов серию не рвут */
function planStreak() {
  let k = today(), n = 0; const full = x => x && x[1] > 0 && x[0] >= x[1], rest = x => x && x[1] === 0;
  if (!full(state.days[k]?.pl)) k = addDays(k, -1);
  for (let i = 0; i < 400; i++, k = addDays(k, -1)) { const pl = state.days[k]?.pl; if (full(pl)) n++; else if (!rest(pl)) break; }
  return n;
}

/* ---- учёт: ответы сегодня по предметам, видам заданий итогового и тренировкам ---- */
const record0 = record;
record = function (it, ok, my) {
  const d = day(), t = d.t = d.t || {}, inc = x => { t[x] = (t[x] || 0) + 1; };
  if (it?.subj) inc(it.subj);
  if (it?.subj === 'fin' && it.task) inc('fin:' + it.task);
  if (it?.subj === 'ru' && it.task) inc('ru:' + it.task);
  if (ses?.key) inc('s:' + ses.key);
  return record0(it, ok, my);
};
/* письменные шаги: сколько слов было в поле, когда она его открыла сегодня (или меньше всего за день), - новые слова = разница.
   Так засчитывается и написанное заново, и вставленное целиком, а вчерашний текст без новых слов - нет */
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

/* ---- главный экран ---- */
ICONS.right = '<path d="M9 5l7 7-7 7"/>';
const COVER_LINES = ['Цель - сотка. Каждый день по шагу.', 'Сотка складывается из маленьких дней.', 'Не идеально, а каждый день.', 'Сделала план дня - день засчитан.', 'Три шага сегодня - это баллы в мае.', 'Ты уже в пути. Просто следующий шаг.'];
function coverHTML() {
  const ed = daysTo(ESSAY_DATE), xd = daysTo(EXAM_DATE), n = Math.round(D(today()) / 864e5);
  return `<section class="cover">
    <div class="cv-brand"><span class="cv-k">ЕГЭ<br>на</span><span class="cv-n">100</span></div>
    <p class="cv-sub">${COVER_LINES[((n % COVER_LINES.length) + COVER_LINES.length) % COVER_LINES.length]}</p>
    <div class="cv-pills">${ed >= 0 ? `<button class="cv-pill" data-a="openFinal">${ic('pen', 15)} Итоговое ${ed ? `через ${ed} ${plural(ed, 'день', 'дня', 'дней')}` : 'сегодня'}</button>` : ''}${xd >= 0 ? `<button class="cv-pill" data-a="openPlan">${ic('cap', 15)} ЕГЭ - примерно через ${xd} ${plural(xd, 'день', 'дня', 'дней')}</button>` : ''}</div>
  </section>`;
}
function planGoBtn(s, primary) {
  return s.go ? `<button class="btn sm ${primary ? 'primary' : ''} pgo" data-a="planGo" data-s="${s.id}"${s.w ? ` data-w="${esc(s.w)}"` : ''}>${ic('play', 16)} ${esc(s.go)}</button>` : '';
}
const altBtn = s => s.alt ? `<button class="btn sm ghost pgo" data-a="${s.alt[0]}"${s.soc ? ` data-id="${esc(s.soc)}"` : s.en ? ` data-id="${esc(s.en)}"` : s.fx ? ` data-id="${esc(s.fx)}"` : ''}>${esc(s.alt[1])}</button>` : '';
const moreBtn = s => s.more ? `<button class="btn sm ghost pgo" data-a="planGo" data-s="${s.id}">Ещё ${EVE_N}</button>` : '';
function planStepHTML(s, cur) {
  const bar = s.prog && s.prog[1] ? `<div class="bar" style="height:6px;margin-top:6px"><i style="width:${s.prog[0] / s.prog[1] * 100}%"></i></div>` : '';
  return `<div class="pstep ${s.done ? 'done' : ''}">
    <button class="pchk" data-a="planTick" data-s="${s.id}" aria-pressed="${s.done}" aria-label="${s.done ? 'Сделано' : 'Отметить сделанным'}">${s.done ? ic('check', 20) : ''}</button>
    <div class="pbody"><div class="parea"><span class="pslot">${esc(s.slot)}</span> ${esc(s.area)}</div><div class="pttl">${esc(s.title)}</div>
      ${s.done ? (s.more ? `<div class="row" style="gap:8px">${moreBtn(s)}</div>` : '') : `${s.sub ? `<div class="psub">${esc(s.sub)}</div>` : ''}${bar}<div class="row" style="gap:8px">${planGoBtn(s, cur)}${altBtn(s)}${s.topic && !ruTheoryOk(s.topic) ? `<button class="btn sm ghost pgo" data-a="ruSkip" data-n="${s.topic}">Уже знаю</button>` : ''}</div>`}
    </div></div>`;
}
function planCardHTML(P) {
  const n = P.steps.length, left = P.steps.filter(s => !s.done), nx = planNext(P), due = errDue().length;
  return `<section class="card plan"><div class="row sb"><h2 class="h2">План на сегодня</h2><span class="kicker num">${P.done} из ${n}</span></div>
    <div class="bar"><i style="width:${n ? P.done / n * 100 : 0}%"></i></div>
    <div class="muted small">${left.length ? 'Утро - сочинение, день - чтение, вечер - лёгкое.' : 'Всё сделано - день засчитан!'} Вечера: ${eveLine}.</div>
    <div>${P.steps.map(s => planStepHTML(s, s === nx)).join('')}</div>
    ${due && P.ph.day !== 'err' ? `<button class="linkbtn" data-a="planGo" data-s="err">Если останутся силы: ошибки на сегодня - ${due} ${ic('right', 16)}</button>` : ''}
    ${left.length ? '' : `<div class="pdone">${ic('star', 22)}<div><b>План дня выполнен!</b><div class="small">Завтра - следующие три шага.</div></div></div>`}
    <button class="linkbtn" data-a="openPlan">Весь план до ЕГЭ ${ic('right', 16)}</button>
  </section>`;
}
function weekHTML() {
  const t = today(), mon = addDays(t, -((D(t).getDay() + 6) % 7)), names = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'], st = planStreak();
  const cells = names.map((nm, i) => {
    const k = addDays(mon, i), pl = state.days[k]?.pl, cls = k > t ? 'fut' : pl && pl[1] > 0 && pl[0] >= pl[1] ? 'full' : pl && pl[1] === 0 ? 'rest' : pl && pl[0] ? 'part' : '';
    return `<div class="wd ${cls} ${k === t ? 'today' : ''}"><i>${cls === 'full' ? ic('check', 16) : D(k).getDate()}</i><span>${nm}</span></div>`;
  });
  return `<section class="card"><div class="row sb"><h2 class="h2">Неделя</h2><span class="chip fire">${ic('flame', 16)} ${st ? `${st} ${plural(st, 'день', 'дня', 'дней')} по плану` : 'серия начнётся с плана дня'}</span></div><div class="week">${cells.join('')}</div></section>`;
}
/* «Где я сейчас»: по каждому предмету - на чём она и сколько пройдено */
function nowHTML(ph) {
  const pct = x => Math.round(x * 100) + '%', g = mainGift();
  const row = (a, icon, cls, title, meta, val, p, style = '') => `<button class="prow" ${a}><span class="tnum ${cls}" style="${style}">${ic(icon, 22)}</span><span style="min-width:0"><span class="ttl">${title}</span><br><span class="tmeta">${meta}</span>${p != null ? `<span class="bar" style="display:block;height:6px;margin-top:6px"><i style="width:${p * 100}%"></i></span>` : ''}</span><span class="pts num">${val}</span></button>`;
  const read = finReadWorks(), cov = finCovered().size, n = ruTopic(), pr = n ? ruProg(n) : null, tp = socNow(), sm = tp ? mastery('soc:' + tp.id) : null, s = enNow(), em = s ? mastery('en:' + s.id) : null;
  return `<section class="card"><h2 class="h2">Где я сейчас</h2><div>
    ${ph.id === 'p1' ? row('data-a="tab" data-t="final"', 'pen', '', 'Итоговое сочинение', `прочитано ${read.length} ${plural(read.length, 'книга', 'книги', 'книг')} · аргументы к ${cov} из ${FIN_T.length} тем`, pct(FIN_T.length ? cov / FIN_T.length : 0), FIN_T.length ? cov / FIN_T.length : 0) : ''}
    ${n ? row(`data-a="openTask" data-n="${n}"`, 'book', 'theory', `Русский: задание ${n}`, `${esc(ruTask(n).title)} - пройдено ${pr.seen} из ${pr.total} · заданий позади: ${ruPassedList().length} из ${RU_PATH.length}`, `${pr.seen}/${pr.total}`, pr.total ? pr.seen / pr.total : 0)
      : row('data-a="tab" data-t="ru"', 'book', 'theory', 'Русский', 'все задания пройдены - теперь вперемешку и пробники', pct(1), null)}
    ${tp ? row(`data-a="openTopic" data-id="${esc(tp.id)}"`, 'scale', 'theory', 'Обществознание', `${esc(tp.title)} - пройдено ${sm.seen} из ${sm.total}`, `${sm.seen}/${sm.total}`, sm.total ? sm.seen / sm.total : 0) : ''}
    ${s ? row(`data-a="openEn" data-id="${esc(s.id)}"`, 'globe', 'theory', 'Английский', `${esc(s.title)} - пройдено ${em.seen} из ${em.total}`, `${em.seen}/${em.total}`, em.total ? em.seen / em.total : 0) : ''}
    ${row('data-a="openGifts"', 'gift', '', 'Копилка', g ? `на «${esc(g.title)}» - ${pct(Math.min(1, state.coins / g.cost))}` : 'добавь подарок, на который копишь', rub(state.coins), null, 'background:var(--gold-soft);color:var(--gold)')}
  </div></section>`;
}
function moreHTML() {
  const un = errList().filter(e => !e.learned).length, lastEssay = state.essays[0]?.result?.total, open = ui.finOpen?.['home-more'];
  return `<details class="more" data-fd="home-more" ${open ? 'open' : ''}><summary>Ещё: быстрые тренировки, обещания, вехи</summary><div class="stack">
    <section class="card"><h2 class="h2">Для итогового</h2><div class="row"><button class="btn sm" data-a="planGo" data-s="para">Аргумент к теме</button><button class="btn sm" data-a="planGo" data-s="mybooks">Мои книги вперемешку</button><button class="btn sm" data-a="planGo" data-s="authors">Авторы моих книг</button><button class="btn sm" data-a="planGo" data-s="words">Слова к темам</button></div></section>
    <section class="card"><h2 class="h2">Быстро, по 10</h2><div class="row"><button class="btn sm" data-a="quick" data-k="stress">10 ударений</button><button class="btn sm" data-a="startExcAll">10 исключений</button><button class="btn sm" data-a="quick" data-k="mix">10 вперемешку</button><button class="btn sm" data-a="quick" data-k="soc">10 по обществу</button><button class="btn sm" data-a="quick" data-k="en">10 по английскому</button></div>${un ? `<button class="btn block" data-a="tab" data-t="err">${ic('note', 18)} Красная тетрадь: ${un} ${plural(un, 'ошибка', 'ошибки', 'ошибок')}</button>` : ''}</section>
    ${weakHomeCard()}
    ${favRow()}
    <section class="card"><h2 class="h2">Мои обещания на сегодня</h2><div>${promisesHTML()}</div></section>
    ${planCard()}
    <section class="card"><h2 class="h2">Путь к 100: русский по блокам</h2>
      <p class="muted small" style="margin:0">100 баллов - это все 50 первичных: 28 за тест и 22 за сочинение. Цель для каждого блока - 90% и выше.</p>
      ${BLOCK_MAP.map(([name, ns]) => { const p = blockPct(ns); return `<div class="blk"><div class="row sb small"><span>${name} <span class="muted">(${ns.length > 1 ? ns[0] + '-' + ns[ns.length - 1] : ns[0]})</span></span><span class="num">${Math.round(p * 100)}%</span></div><div class="bar ${p >= 0.9 ? '' : 'violet'}"><i style="width:${p * 100}%"></i></div></div>`; }).join('')}
      <div class="blk"><div class="row sb small"><span>Сочинение <span class="muted">(27)</span></span><span class="num">${lastEssay != null ? lastEssay + ' из 22' : 'ещё не проверяли'}</span></div><div class="bar violet"><i style="width:${lastEssay != null ? lastEssay / 22 * 100 : 0}%"></i></div></div>
    </section>
    ${fipiCard()}
  </div></details>`;
}
vHome = function () {
  const P = planToday(); planSnap(P);
  return `<header class="stack" style="gap:4px;padding-top:6px"><div class="kicker">${WD[new Date().getDay()]}, ${fmtD(today())}</div><h1 class="h1">Привет, Даша!</h1><div class="muted small">офлайн-версия, всё на этом устройстве · ${dataLinkHTML()}</div></header>
  ${resumeCard()}
  ${iconCardHTML()}
  ${coverHTML()}
  ${planCardHTML(P)}
  ${nowHTML(P.ph)}
  ${weekHTML()}
  ${moreHTML()}`;
};

/* ---- после тренировки: «ещё 15» и следующий шаг плана (по времени суток) ---- */
const vSesEnd0 = vSesEnd;
vSesEnd = function () {
  const h = vSesEnd0(), P = planToday(); planSnap(P);
  const more = ses?.key && /^(ru|ruE|soc|en):/.test(ses.key) && (ses.pool || []).length ? `<button class="btn sm" data-a="planMore">Ещё ${EVE_N}</button>` : '';
  if (!P.steps.length) return more ? h + `<section class="card"><div class="row">${more}</div></section>` : h;
  const nx = planNext(P);
  return h + `<section class="card pnext">${nx ? `<div class="kicker">План дня · ${P.done} из ${P.steps.length}</div><div class="pttl">Дальше: ${esc(nx.title)}</div><div class="psub">${esc(nx.slot)} · ${esc(nx.area)}</div><div class="row">${planGoBtn(nx, true)}${more}<button class="btn sm" data-a="sesHome">К плану дня</button></div>`
    : `<div class="pdone">${ic('star', 22)}<div><b>${P.done >= P.steps.length ? 'План дня выполнен!' : 'На сегодня хватит'}</b><div class="small">${P.done >= P.steps.length ? 'Все три шага сделаны - можно отдыхать.' : 'Вечер сделан. Отдыхай, завтра - следующие три шага.'}</div></div></div>${more ? `<div class="row">${more}<button class="btn sm" data-a="sesHome">К плану дня</button></div>` : ''}`}</section>`;
};

/* ---- экран «План до ЕГЭ» ---- */
{
  const m3 = MILESTONES.find(m => m.id === 'm3'), m7 = MILESTONES.find(m => m.id === 'm7');
  if (m3) m3.t = 'Пробник русского: тест от 22 из 28 - уровень 70';
  if (m7) m7.t = 'Пробник русского: от 25 из 28 - уровень 80';
  MILESTONES.push(
    { id: 'm10', d: '2027-04-30', t: 'Сочинение ЕГЭ: от 20 из 22', auto: () => state.essays.some(e => (e.result?.total || 0) >= 20) },
    { id: 'm11', d: '2027-05-15', t: 'Пробник русского: от 27 из 28 - уровень 90+', auto: () => bestMock() >= 27, pct: () => bestMock() / 27 },
  );
  MILESTONES.sort((a, b) => a.d.localeCompare(b.d));
}
vPlan = function () {
  const t = today(), cur = planPhase(t), wd = D(t).getDay(), next = MILESTONES.find(m => !msDone(m)), cap = s => s[0].toUpperCase() + s.slice(1);
  const read = finReadWorks(), cov = finCovered().size, nx = finNextWork(), gain = nx && !finReadOf(nx.id) ? finGain(nx) : 0;
  const eve = `<table class="tbl wrap ptbl"><tbody>${[1, 2, 3, 4, 5, 6, 0].map(i => `<tr class="${i === wd ? 'on' : ''}"><td>${cap(WD[i])}</td><td>вечер - ${PLAN_EVE_NAMES[PLAN_EVE[i]]}${i === 6 && cur.sat ? ' · утром пробник' : ''}</td></tr>`).join('')}</tbody></table>`;
  const nRu = ruTopic(), ruDone = ruPassedList().length, open = id => ui.finOpen?.[id] ? 'open' : '';
  const prow = (a, mark, cls, title, meta, val) => `<button class="prow" ${a}><span class="tnum ${cls}" style="font-size:16px">${mark}</span><span style="min-width:0"><span class="ttl">${title}</span><br><span class="tmeta">${meta}</span></span><span class="pts num">${val}</span></button>`;
  const ruRow = n => { const T = ruTask(n), ok = ruPassed(n), now = n === nRu, p = ruProg(n); return prow(`data-a="openTask" data-n="${n}"`, ok ? ic('check', 20) : n, ok ? 'done' : now ? '' : 'theory', esc(T.title), `задание ${n}${ok ? (ruP(n).done && p.seen < p.total ? ' · отмечено «уже знаю»' : ' · пройдено') : now ? ' · сейчас' : ''}`, `${p.seen}/${p.total}`); };
  const socRows = SOC_ORDER().map(x => { const m = mastery('soc:' + x.id), now = socNow()?.id === x.id, ok = m.total && m.seen >= m.total; return prow(`data-a="openTopic" data-id="${esc(x.id)}"`, ok ? ic('check', 20) : ic('scale', 20), ok ? 'done' : now ? '' : 'theory', esc(x.title), now ? 'сейчас' : ok ? 'пройдено' : 'дальше', `${m.seen}/${m.total}`); }).join('');
  const enRows = EN_LIST().map(x => { const m = mastery('en:' + x.id), now = enNow()?.id === x.id, ok = m.total && m.seen >= m.total; return prow(`data-a="openEn" data-id="${esc(x.id)}"`, ok ? ic('check', 20) : ic('globe', 20), ok ? 'done' : now ? '' : 'theory', esc(x.title), now ? 'сейчас' : ok ? 'пройдено' : 'дальше', `${m.seen}/${m.total}`); }).join('');
  return `<button class="back" data-a="back">${ic('left', 18)} Назад</button>
  <header class="stack" style="gap:6px"><div class="kicker">Цель - 100</div><h1 class="h1">План до ЕГЭ</h1><p class="muted" style="margin:0">Каждый день три шага под твой режим: утром сочинение, днём книга, вечером 15 лёгких заданий. Сочинение и чтение отмечаешь сама - кружок слева, вечер отмечается сам.</p></header>
  <section class="card" style="border-left:5px solid var(--rose)"><div class="kicker">Сейчас · ${esc(cur.when)}</div><h2 class="h2">${esc(cur.name)}</h2>
    <p style="margin:0"><b>Утро, около 9:00 - сочинение.</b> ${cur.morning === 'fin' ? 'Итоговое: тема дня подобрана к твоим книгам, от 350 слов. Не та тема - «Другая тема».' : 'Сочинение ЕГЭ по тексту (задание 27), от 150 слов.'}${cur.sat ? ' В субботу утром вместо него - пробник.' : ''}</p>
    <p style="margin:0"><b>День - ${cur.day === 'err' ? 'ошибки' : 'чтение'}.</b> ${cur.day === 'err' ? 'Красная тетрадь: что ещё не выучено.' : 'Книга для сочинения. Читаешь не за один день - кружок «почитала»; дочитала - «Прочитала» в карточке и короткий тест.'}</p>
    <p style="margin:0"><b>Вечер - лёгкое.</b> 15 заданий одного предмета, твои ошибки по нему повторяются сами:</p>${eve}
    <p class="muted small" style="margin:0">${esc(cur.focus)}${cur.id === 'p1' ? ' 1 декабря - только повторить свои книги, 2 декабря - итоговое сочинение.' : ''}</p></section>
  <section class="card"><div class="row sb"><h2 class="h2">Русский по заданиям</h2><span class="kicker">${ruDone} из ${RU_PATH.length}</span></div>
    <p class="muted small" style="margin:0">Идём по порядку: задание - сначала теория, потом все его задания до конца, ошибки повторяются сами. ${nRu ? `Сейчас - задание ${nRu}, «${esc(ruTask(nRu).title)}».` : 'Все задания пройдены!'} Хочешь другое - открой его и нажми «Прочитала - закрепить»: оно станет заданием плана.</p>
    <div class="bar"><i style="width:${ruDone / RU_PATH.length * 100}%"></i></div>
    ${nRu ? ruRow(nRu) : ''}
    <details class="fbd" data-fd="ru-path" ${open('ru-path')}><summary>Все задания по порядку</summary><div>${RU_PATH.filter(n => ruTask(n)).map(ruRow).join('')}</div></details></section>
  <section class="card"><h2 class="h2">Обществознание по темам</h2><p class="muted small" style="margin:0">Вторник и суббота вечером. Тема за темой: сначала теория, потом вопросы, пока не пройдёшь все.</p><div>${socRows}</div></section>
  <section class="card"><h2 class="h2">Английский по разделам</h2><p class="muted small" style="margin:0">Четверг и воскресенье вечером: грамматика, словообразование, лексика, потом чтение и аудирование.</p><div>${enRows}</div></section>
  ${cur.id === 'p1' ? `<section class="card"><h2 class="h2">Книги для итогового</h2>
    <div class="blk"><div class="row sb small"><span>Темы, к которым у тебя есть аргументы</span><span class="num">${cov} из ${FIN_T.length}</span></div><div class="bar"><i style="width:${FIN_T.length ? cov / FIN_T.length * 100 : 0}%"></i></div></div>
    <p class="muted small" style="margin:0">${read.length ? `Прочитано: ${read.map(w => `«${esc(w.title)}»`).join(', ')}.` : 'Отмечай прочитанные книги - здесь будет видно, к каким темам хватает аргументов.'} На сочинении хватит 4-5 книг, которые знаешь хорошо.</p>
    ${nx ? `<button class="btn block" data-a="finWork" data-id="${esc(nx.id)}">${ic('book', 18)} ${finReadOf(nx.id) ? 'Закрепить' : 'Следующая'}: «${esc(nx.title)}»${gain ? ` (+${gain} ${plural(gain, 'тема', 'темы', 'тем')})` : ''}</button>` : ''}</section>` : ''}
  <section class="card"><h2 class="h2">Этапы до экзамена</h2><div>${PLAN_PHASES.map(ph => { const now = ph === cur, past = t > ph.to; return `<div class="ph ${now ? 'now' : past ? 'past' : ''}"><span class="phd">${past ? ic('check', 14) : ''}</span><div style="min-width:0"><div class="row sb"><b>${esc(ph.name)}</b>${now ? '<span class="chip fire">сейчас</span>' : ''}</div><div class="muted small">${esc(ph.when)}</div>${now ? '' : `<p class="small" style="margin:4px 0 0">${esc(ph.focus)}</p>`}</div></div>`; }).join('')}</div></section>
  <section class="card"><h2 class="h2">Вехи</h2><div>${MILESTONES.map(m => { const done = msDone(m), late = !done && m.d < t, p = m.pct ? Math.max(0, Math.min(1, m.pct())) : null; return `<div class="ms"><button class="chk ${done ? 'on' : ''}" style="border:0;padding:0;width:auto" data-a="msTog" data-id="${m.id}" aria-label="Отметить"><span class="box">${ic('check', 18)}</span></button><div style="min-width:0"><div style="font-weight:800;${done ? 'text-decoration:line-through;color:var(--muted)' : ''}">${esc(m.t)}</div>${p != null && !done ? `<div class="bar" style="height:6px;margin-top:6px"><i style="width:${p * 100}%"></i></div>` : ''}</div><span class="when" style="${late ? 'color:var(--bad)' : ''}">до ${fmtD(m.d)}</span></div>`; }).join('')}</div></section>
  <section class="card"><h2 class="h2">Сколько нужно на 100</h2><p style="margin:0">100 баллов по русскому - это все <b>50 первичных</b>: 28 за тестовую часть и 22 за сочинение. Ступеньки (шкала 2026 года, примерно): 70 баллов - около 38 первичных, 80 - около 43, 90 - около 47.</p><p class="muted small" style="margin:0">Итоговое сочинение - это зачёт или незачёт: допуск к ЕГЭ, баллы за него не ставят.</p></section>
  ${next ? '' : '<section class="card celebrate"><div class="h2">Все вехи взяты!</div></section>'}`;
};

/* ---- действия ---- */
Object.assign(A, {
  planGo: b => {
    const id = b.dataset.s, start = (k, n = 10, title) => { const pool = TASK_ITEMS[k] || []; if (pool.length) startPool(title || keyTitle(k), pool, n, { key: k }); else toast('Здесь пока нечего решать'); };
    if (id === 'fin') { const tp = essTopic(today(), day()); if (tp) A.finWrite({ dataset: { id: tp.id } }); else { finRemember('write'); go({ v: 'final', sub: 'write', part: 'full' }); } }
    else if (id === 'ess27') A.continue({ dataset: { p: '2' } });
    else if (id === 'mock') startMock();
    else if (id === 'book') {
      const w = finWork(b.dataset.w) || planBook(); if (!w) return;
      if (!finReadOf(w.id)) { state.planBook = w.id; save(); A.finWork({ dataset: { id: w.id } }); } else A.finWorkQuiz({ dataset: { id: w.id } });
    }
    else if (id === 'err') startMarathon();
    else if (id === 'ru') {
      const n = ruTopic(); if (!n) { startMix(EVE_N); return; }
      if (ruTheoryOk(n)) ruPractice(n); else go({ v: 'task', n, sub: 'theory' });
    }
    else if (id === 'soc') { const tp = socNow(); if (tp) start('soc:' + tp.id, EVE_N, `Общество: ${tp.title}`); }
    else if (id === 'en') { const s = enNow(); if (s) start('en:' + s.id, EVE_N, `Английский: ${s.title}`); }
    else if (id === 'review') { finRemember('works'); go({ v: 'final', sub: 'works' }); }
    /* то, что раньше было шагами плана, - теперь в «Ещё» на главной */
    else if (id === 'para') A.finParaMine();
    else if (id === 'authors') { finMinePools(); start((TASK_ITEMS['fin:nmine'] || []).length ? 'fin:nmine' : 'fin:n'); }
    else if (id === 'words') start('fin:v');
    else if (id === 'mybooks') { finMinePools(); start((TASK_ITEMS['fin:mine'] || []).length ? 'fin:mine' : 'fin:all'); }
  },
  planTick: b => {
    const id = b.dataset.s, s = planToday().steps.find(x => x.id === id); if (!s) return;
    if (s.auto) { toast(s.si === 2 ? `Уже сделано: ${EVE_N} заданий решены` : 'Уже сделано'); return; }
    const d = day(), m = d.m = d.m || {}; if (m[id]) delete m[id]; else m[id] = 1;
    save(); render(); toast(m[id] ? 'Отмечено: сделано' : 'Отметка снята');
  },
  planMore: () => { if (ses?.pool?.length) startPool(ses.title, ses.pool, EVE_N, ses.key ? { key: ses.key } : {}); },
  essNew: () => {
    const d = day(), cur = d.pk?.essT, all = essCands().filter(t => t.id !== cur), fresh = all.filter(t => !state.essT?.[t.id]), L = fresh.length ? fresh : all;
    const t = L[Math.floor(Math.random() * L.length)]; if (!t) return;
    d.pk = { ...(d.pk || {}), essT: t.id }; save(); render(); toast('Новая тема на сегодня');
  },
  socTheory: b => go({ v: 'topic', id: b.dataset.id, sub: 'theory' }),
  bookQuiz: b => { if (finWork(b.dataset.id)) A.finWorkQuiz({ dataset: { id: b.dataset.id } }); },
  enTheory: b => go({ v: 'ensec', id: b.dataset.id }),
});

/* ---- экран задания, вкладка «Теория»: внизу - «Прочитала - закрепить»; это задание становится заданием плана ---- */
const vTask0 = vTask;
vTask = function (r) {
  const h = vTask0(r), T = ruTask(r.n); if (!T || T.n === 27 || !ruTotal(T.n)) return h;
  const m = mastery('ru:' + T.n), sub = r.sub || (m.total > 0 && m.seen ? 'train' : 'theory');
  if (sub !== 'theory') return h;
  const th = ruP(T.n).th, inPath = ruTopic() === T.n, p = ruProg(T.n);
  return h + `<section class="card" style="border-left:5px solid var(--violet)">
    <h2 class="h2">${th ? 'Закрепить тему' : 'Прочитала теорию?'}</h2>
    <p class="muted small" style="margin:0">${th ? `Теорию ты прочитала ${fmtD(th)}. ` : ''}Сразу закрепи: ${EVE_N} заданий только по этой теме (пройдено ${p.seen} из ${p.total}). Ошибки уйдут в красную тетрадь - повторятся сами.${inPath ? ' Это задание плана.' : ' После этого оно станет заданием плана на вечер.'}</p>
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
