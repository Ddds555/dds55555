/* ================= ПЛАН ДНЯ И ГЛАВНЫЙ ЭКРАН «ЕГЭ на 100» =================
   Её просьба 31.10.2026: «нет чёткого понимания, что мне сейчас проходить… глаза разбегаются… составь чёткий план».
   Главная показывает план дня: 2-4 шага на 30-45 минут, остальное спрятано в «Ещё». Шаг отмечается сам:
   ответы считаются по предметам и тренировкам (day().t), письменные шаги - по словам, написанным сегодня (day().w),
   а сделанное без телефона (сочинение на бумаге) отмечается руками (day().m).
   Этапы и ритм недели (PLAN_PHASES) - одни на главной, на экране «План до ЕГЭ» и после каждой тренировки. */

const PLAN_PHASES = [
  { id: 'p1', from: '2026-09-01', to: '2026-12-02', when: 'до 2 декабря', name: 'Итоговое сочинение и старт русского', tag: 'сочинение + русский',
    focus: 'Главное сейчас - зачёт по итоговому сочинению 2 декабря. В будни ещё одна тема русского: сначала теория, потом закрепление - так ЕГЭ тоже двигается. Обществознание и английский подключаем после 2 декабря - сейчас не распыляемся.',
    days: { 1: ['book', 'ru', 'err'], 2: ['para', 'ru', 'err'], 3: ['authors', 'ru', 'err'], 4: ['para', 'ru', 'err'], 5: ['book', 'ru', 'err'], 6: ['full', 'err'], 0: ['mybooks', 'words', 'rurev', 'err'] } },
  { id: 'p2', from: '2026-12-03', to: '2027-01-31', when: '3 декабря - январь', name: 'Русский: орфография и пунктуация', tag: 'русский + общество и английский',
    focus: 'Русский каждый день - следующая тема: теория, потом закрепление; в среду - повторение пройденного. Обществознание и английский через день. В субботу по очереди - пробник тестовой части и сочинение ЕГЭ.',
    days: { 1: ['ru', 'soc', 'err'], 2: ['ru', 'en', 'err'], 3: ['ru', 'rurev', 'err'], 4: ['ru', 'en', 'err'], 5: ['ru', 'soc', 'err'], 6: ['sat', 'err'], 0: ['err'] } },
  { id: 'p3', from: '2027-02-01', to: '2027-03-31', when: 'февраль - март', name: 'Сочинение ЕГЭ и пробники', tag: 'сочинение ЕГЭ + пробники',
    focus: 'Сочинение ЕГЭ (задание 27) и пробник - по очереди каждую субботу. Русский: последние темы, потом задания вперемешку, как на экзамене. Обществознание - все темы, английский - чтение и письмо.',
    days: { 1: ['ru', 'soc', 'err'], 2: ['ru', 'en', 'err'], 3: ['ru', 'rurev', 'err'], 4: ['ru', 'en', 'err'], 5: ['ru', 'soc', 'err'], 6: ['sat', 'err'], 0: ['err'] } },
  { id: 'p4', from: '2027-04-01', to: '2027-07-31', when: 'апрель - экзамен', name: 'Пробники и повторение', tag: 'пробники + повторение',
    focus: 'Пробник каждую субботу, марафон всей красной тетради. Новых тем не берём - доводим до идеала то, что знаешь.',
    days: { 1: ['ru', 'soc', 'err'], 2: ['ru', 'en', 'err'], 3: ['ru', 'soc', 'err'], 4: ['ru', 'en', 'err'], 5: ['ru', 'soc', 'err'], 6: ['mock', 'err'], 0: ['err'] } },
];
const PLAN_SPECIAL = { '2026-12-01': ['review', 'err'], '2026-12-02': ['exam'] };
const PLAN_NAMES = { book: 'книга дня', para: 'аргумент к теме', authors: 'авторы', words: 'слова', mybooks: 'мои книги', full: 'сочинение целиком', review: 'повторить книги', exam: 'итоговое сочинение',
  ru: 'русский: тема дня', rurev: 'повторение пройденного', soc: 'общество 10', en: 'английский 10', mock: 'пробник', ess27: 'сочинение ЕГЭ', sat: 'пробник или сочинение ЕГЭ', err: 'ошибки' };
/* письменный шаг засчитан, когда сегодня в поле написано не меньше need слов и из них новых - не меньше gain */
const PLAN_WRITE = { fpText: ['para', 50, 40], fText: ['full', 250, 200], esText: ['ess27', 150, 120] };

const planPhase = (k = today()) => PLAN_PHASES.find(p => k >= p.from && k <= p.to) || (k < PLAN_PHASES[0].from ? PLAN_PHASES[0] : PLAN_PHASES[PLAN_PHASES.length - 1]);
function planIds(k = today()) {
  if (PLAN_SPECIAL[k]) return PLAN_SPECIAL[k];
  const ids = planPhase(k).days[D(k).getDay()] || [], wk = Math.floor(Math.round((D(k) - D('2026-11-30')) / 864e5) / 7);
  return ids.map(id => id === 'sat' ? (wk % 2 ? 'ess27' : 'mock') : id); // суббота: пробник и сочинение ЕГЭ по очереди
}
/* один шаг плана: что делать, сколько минут, сделан ли */
function planStep(id, k, d) {
  const t = d.t || {}, w = d.w || {}, N = state.settings.norm || 15, due = errDue().length;
  const S = {
    book: () => {
      const b = finWork(d.pk?.book) || finNextWork(); if (!b) return null;
      const rd = !!finReadOf(b.id), g = rd ? 0 : finGain(b), tested = Object.keys(t).filter(x => x.startsWith('s:finw:')).reduce((a, x) => a + t[x], 0);
      return { area: 'Сочинение', min: rd ? 15 : 45, w: b.id, go: rd ? 'Пройти тест' : 'Открыть карточку',
        title: rd ? `Закрепить «${b.title}»` : `Новая книга: «${b.title}»`,
        sub: rd ? `${b.authorShort || b.author}. Тест по книге: автор полностью, герои, аргументы.` : `${b.authorShort || b.author}, ${b.genre}${g ? ` - аргументы ещё к ${g} ${plural(g, 'теме', 'темам', 'темам')}` : ''}. Прочитай, нажми «Прочитала» - и тест по книге.`,
        done: tested >= 8 || Object.values(state.readW || {}).includes(k) };
    },
    para: () => ({ area: 'Сочинение', min: 15, go: 'Написать', title: 'Аргумент к теме', sub: 'Тема из банка ФИПИ и твоя книга: абзац на 50-120 слов. Потом сверь себя с образцом.', done: !!w.para }),
    authors: () => ({ area: 'Сочинение', min: 5, go: 'Начать', title: 'Авторы моих книг', sub: 'Имя, отчество, фамилия - с ловушками вроде «Иван Александрович» вместо «Александр Иванович».', done: (t['fin:n'] || 0) >= 8 }),
    words: () => ({ area: 'Сочинение', min: 10, go: 'Начать', title: 'Слова к темам', sub: '10 слов: вспомни близкие по смыслу - чтобы в сочинении не было повторов.', done: (t['fin:v'] || 0) >= 10 }),
    mybooks: () => ({ area: 'Сочинение', min: 10, go: 'Начать', title: 'Мои книги вперемешку', sub: 'Вопросы по всем прочитанным книгам: проверь, что помнишь.', done: (t['s:fin:mine'] || 0) >= 10 }),
    full: () => ({ area: 'Сочинение', min: 70, go: 'Написать', title: 'Сочинение целиком', sub: 'Как на экзамене: тема, 350+ слов, потом самопроверка по галочкам. Писала на бумаге - отметь кружок слева.', done: !!w.full }),
    review: () => ({ area: 'Сочинение', min: 30, go: 'Мои книги', title: 'Завтра итоговое сочинение', sub: 'Перечитай «Кратко» и аргументы своих книг и план «Как писать». Новое сегодня не учи. Выспись!', done: false }),
    exam: () => ({ area: 'Сочинение', min: 0, go: null, title: 'Сегодня итоговое сочинение', sub: 'Паспорт, чёрная гелевая ручка, вода. Вступление - два аргумента - вывод, от 350 слов. Ты готовилась - всё получится!', done: false }),
    ru: () => {
      const n = d.pk?.ru || ruTopic();
      if (!n) return { area: 'Русский ЕГЭ', min: 15, go: 'Начать', title: `${N} заданий вперемешку`, sub: 'Все темы пройдены: теперь задания 1-26 вперемешку, как на экзамене.', count: [Math.min(t.ru || 0, N), N], done: (t.ru || 0) >= N };
      const T = ruTask(n), th = ruP(n).th, got = t['ru:' + n] || 0;
      return { area: `Русский ЕГЭ · задание ${n}`, min: th ? 15 : 20, go: th ? 'Закрепить' : 'Теория', title: T.title, topic: n,
        sub: th ? `Закрепление: 10 заданий только по этой теме.${th !== k ? ` Теорию ты прочитала ${fmtD(th)} - можно освежить на экране задания.` : ''}` : 'Новая тема: сначала теория (5 минут), потом 10 заданий только по ней.',
        count: th ? [Math.min(got, 10), 10] : null, done: !!th && got >= 10 };
    },
    rurev: () => { const pool = ruReviewPool(); return pool.length ? { area: 'Русский ЕГЭ', min: 10, go: 'Начать', title: 'Повторение пройденного', sub: `10 заданий из тем, которые ты уже прошла (${ruPassedList().length}).`, done: (t['s:rev:ru'] || 0) >= 10 } : null; },
    soc: () => ({ area: 'Обществознание', min: 15, go: 'Начать', title: '10 заданий', sub: 'Темы вперемешку, ошибки уйдут в красную тетрадь.', count: [Math.min(t.soc || 0, 10), 10], done: (t.soc || 0) >= 10 }),
    en: () => ({ area: 'Английский', min: 15, go: 'Начать', title: '10 заданий', sub: 'Грамматика, словообразование, лексика.', count: [Math.min(t.en || 0, 10), 10], done: (t.en || 0) >= 10 }),
    mock: () => ({ area: 'Русский ЕГЭ', min: 60, go: 'Начать', title: 'Пробник тестовой части', sub: '26 заданий по порядку, как на экзамене, - и баллы по шкале ЕГЭ.', done: state.mocks.some(x => x.d === k) }),
    ess27: () => ({ area: 'Русский ЕГЭ', min: 60, go: 'Написать', title: 'Сочинение ЕГЭ (задание 27)', sub: 'Позиция автора, два примера с пояснением, связь между ними, своё мнение. От 150 слов.', done: !!w.ess27 }),
    err: () => errList().some(e => !e.learned) ? { area: 'Ошибки', min: Math.max(5, Math.min(20, Math.ceil(due / 2))), go: 'Начать', title: due ? `Повторить ошибки: ${due}` : 'Ошибки на сегодня повторены', sub: 'Красная тетрадь: три верных ответа в разные дни - и ошибка выучена.', done: due === 0 } : null,
  };
  const s = S[id]?.(); if (!s) return null;
  const auto = !!s.done;
  return { id, ...s, auto, done: auto || !!d.m?.[id] };
}
function planToday(k = today()) {
  const d = day(k), ph = planPhase(k), steps = planIds(k).map(id => planStep(id, k, d)).filter(Boolean);
  return { k, ph, steps, done: steps.filter(s => s.done).length };
}
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
const COVER_LINES = ['Цель - сотка. Каждый день по шагу.', 'Сотка складывается из маленьких дней.', 'Не идеально, а каждый день.', 'Сделала план дня - день засчитан.', 'Сегодняшние 40 минут - это баллы в мае.', 'Ты уже в пути. Просто следующий шаг.'];
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
function planStepHTML(s, i, cur) {
  return `<div class="pstep ${s.done ? 'done' : ''}">
    <button class="pchk" data-a="planTick" data-s="${s.id}" aria-pressed="${s.done}" aria-label="${s.done ? 'Сделано' : 'Отметить сделанным'}">${s.done ? ic('check', 20) : i + 1}</button>
    <div class="pbody"><div class="parea">${esc(s.area)}${s.min ? ` · ${s.min} мин` : ''}</div><div class="pttl">${esc(s.title)}</div>
      ${s.done ? '' : `${s.sub ? `<div class="psub">${esc(s.sub)}</div>` : ''}${s.count && s.count[0] ? `<div class="bar" style="height:6px;margin-top:6px"><i style="width:${s.count[0] / s.count[1] * 100}%"></i></div>` : ''}<div class="row" style="gap:8px">${planGoBtn(s, cur)}${s.topic && !ruP(s.topic).th ? `<button class="btn sm ghost pgo" data-a="ruSkip" data-n="${s.topic}">Уже знаю</button>` : ''}</div>`}
    </div></div>`;
}
function planCardHTML(P) {
  const n = P.steps.length, left = P.steps.filter(s => !s.done), first = left[0], mins = left.reduce((a, s) => a + s.min, 0);
  const head = `<div class="row sb"><h2 class="h2">План на сегодня</h2>${n ? `<span class="kicker num">${P.done} из ${n}</span>` : ''}</div>`;
  if (!n) return `<section class="card plan">${head}<p style="margin:0"><b>Выходной.</b> Отдых - тоже часть подготовки. Захочется позаниматься - «Ещё» внизу.</p><button class="linkbtn" data-a="openPlan">Весь план до ЕГЭ ${ic('right', 16)}</button></section>`;
  return `<section class="card plan">${head}
    <div class="bar"><i style="width:${P.done / n * 100}%"></i></div>
    <div class="muted small">${!left.length ? 'Всё сделано - день засчитан!' : mins ? `Осталось примерно ${mins} мин` : 'Удачи!'} · этап: ${esc(P.ph.tag)}</div>
    <div>${P.steps.map((s, i) => planStepHTML(s, i, s === first)).join('')}</div>
    ${left.length ? '' : `<div class="pdone">${ic('star', 22)}<div><b>План дня выполнен!</b><div class="small">Завтра - следующий шаг. Хочешь ещё - «Ещё» внизу.</div></div></div>`}
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
function progressHTML(ph) {
  const read = finReadWorks(), fixed = read.filter(finDone).length, cov = finCovered().size, g = mainGift(), best = bestMock();
  let ok = 0, tot = 0; for (let n = 1; n <= 26; n++) { const m = mastery('ru:' + n); ok += m.ok; tot += m.total; }
  const ru = tot ? ok / tot : 0, pct = x => Math.round(x * 100) + '%';
  const row = (a, icon, cls, title, meta, val, style = '') => `<button class="prow" ${a}><span class="tnum ${cls}" style="${style}">${ic(icon, 22)}</span><span style="min-width:0"><span class="ttl">${title}</span><br><span class="tmeta">${meta}</span></span><span class="pts num">${val}</span></button>`;
  return `<section class="card"><h2 class="h2">Мой прогресс</h2><div>
    ${ph.id === 'p1' ? row('data-a="tab" data-t="final"', 'pen', '', 'Итоговое сочинение', `прочитано ${read.length}, закреплено ${fixed} · аргументы к ${cov} из ${FIN_T.length} тем`, pct(FIN_T.length ? cov / FIN_T.length : 0)) : ''}
    ${row('data-a="tab" data-t="ru"', 'book', 'theory', 'Русский ЕГЭ', `темы: пройдено ${ruPassedList().length} из ${RU_PATH.length}${ruTopic() ? ` · сейчас задание ${ruTopic()}` : ''}${best ? ` · пробник ${best} из 28` : ''}`, pct(ru))}
    ${ph.id === 'p1' ? '' : row('data-a="tab" data-t="soc"', 'scale', 'theory', 'Обществознание', 'все темы', pct(poolPct(keysOf('soc:'))))}
    ${ph.id === 'p1' ? '' : row('data-a="tab" data-t="en"', 'globe', 'theory', 'Английский', 'все разделы', pct(poolPct(keysOf('en:'))))}
    ${row('data-a="openGifts"', 'gift', '', 'Копилка', g ? `на «${esc(g.title)}» - ${pct(Math.min(1, state.coins / g.cost))}` : 'добавь подарок, на который копишь', rub(state.coins), 'background:var(--gold-soft);color:var(--gold)')}
  </div></section>`;
}
function moreHTML() {
  const un = errList().filter(e => !e.learned).length, lastEssay = state.essays[0]?.result?.total, open = ui.finOpen?.['home-more'];
  return `<details class="more" data-fd="home-more" ${open ? 'open' : ''}><summary>Ещё: быстрые тренировки, обещания, вехи</summary><div class="stack">
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
  ${weekHTML()}
  ${progressHTML(P.ph)}
  ${moreHTML()}`;
};

/* ---- после тренировки: следующий шаг плана ---- */
const vSesEnd0 = vSesEnd;
vSesEnd = function () {
  const h = vSesEnd0(), P = planToday(); planSnap(P);
  if (!P.steps.length) return h;
  const nx = P.steps.find(s => !s.done);
  return h + `<section class="card pnext">${nx ? `<div class="kicker">План дня · ${P.done} из ${P.steps.length}</div><div class="pttl">Дальше: ${esc(nx.title)}</div><div class="psub">${esc(nx.area)}${nx.min ? ` · ${nx.min} мин` : ''}</div><div class="row">${planGoBtn(nx, true)}<button class="btn sm" data-a="sesHome">К плану дня</button></div>`
    : `<div class="pdone">${ic('star', 22)}<div><b>План дня выполнен!</b><div class="small">Все шаги на сегодня сделаны - можно отдыхать.</div></div></div>`}</section>`;
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
  const t = today(), cur = planPhase(t), wd = D(t).getDay(), next = MILESTONES.find(m => !msDone(m));
  const cap = s => s[0].toUpperCase() + s.slice(1);
  const days = ph => `<table class="tbl wrap ptbl"><tbody>${[1, 2, 3, 4, 5, 6, 0].map(i => `<tr class="${ph === cur && i === wd ? 'on' : ''}"><td>${cap(WD[i])}</td><td>${(ph.days[i] || []).map(x => PLAN_NAMES[x]).join(' · ') || 'выходной'}</td></tr>`).join('')}</tbody></table>`;
  const read = finReadWorks(), cov = finCovered().size, nx = finNextWork(), gain = nx && !finReadOf(nx.id) ? finGain(nx) : 0;
  return `<button class="back" data-a="back">${ic('left', 18)} Назад</button>
  <header class="stack" style="gap:6px"><div class="kicker">Цель - 100</div><h1 class="h1">План до ЕГЭ</h1><p class="muted" style="margin:0">Держать всё в голове не нужно. Каждый день на главной - 2-4 шага на 30-45 минут. Сделала шаг - галочка ставится сама.</p></header>
  <section class="card" style="border-left:5px solid var(--rose)"><div class="kicker">Сейчас · ${esc(cur.when)}</div><h2 class="h2">${esc(cur.name)}</h2><p style="margin:0">${esc(cur.focus)}</p>${days(cur)}<p class="muted small" style="margin:0">Ошибки - каждый день, если есть что повторить. ${cur.id === 'p1' ? '1 декабря - повторить свои книги, 2 декабря - итоговое сочинение.' : ''}</p></section>
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
    const id = b.dataset.s, start = k => { const pool = TASK_ITEMS[k] || []; if (pool.length) startPool(keyTitle(k), pool, 10, { key: k }); else toast('Здесь пока нечего решать'); };
    if (id === 'book') {
      const w = finWork(b.dataset.w); if (!w) return;
      const d = day(); d.pk = { ...(d.pk || {}), book: w.id }; save();
      if (finReadOf(w.id)) A.finWorkQuiz({ dataset: { id: w.id } }); else A.finWork({ dataset: { id: w.id } });
    }
    else if (id === 'para') A.finParaMine();
    else if (id === 'authors') { finMinePools(); start((TASK_ITEMS['fin:nmine'] || []).length ? 'fin:nmine' : 'fin:n'); }
    else if (id === 'words') start('fin:v');
    else if (id === 'mybooks') { finMinePools(); start((TASK_ITEMS['fin:mine'] || []).length ? 'fin:mine' : 'fin:all'); }
    else if (id === 'full') { finRemember('write'); go({ v: 'final', sub: 'write', part: 'full' }); }
    else if (id === 'review') { finRemember('works'); go({ v: 'final', sub: 'works' }); }
    else if (id === 'ru') {
      const n = day().pk?.ru || ruTopic(); if (!n) { startMix(); return; }
      const d = day(); d.pk = { ...(d.pk || {}), ru: n }; save();
      if (ruP(n).th) ruPractice(n); else go({ v: 'task', n, sub: 'theory' });
    }
    else if (id === 'rurev') { const pool = ruReviewPool(); if (pool.length) startPool('Повторение пройденного', pool, 10, { key: 'rev:ru' }); }
    else if (id === 'soc' || id === 'en') A.quick({ dataset: { k: id } });
    else if (id === 'mock') startMock();
    else if (id === 'ess27') A.continue({ dataset: { p: '2' } });
    else if (id === 'err') startMarathon();
  },
  planTick: b => {
    const id = b.dataset.s, s = planToday().steps.find(x => x.id === id); if (!s) return;
    if (s.auto) { toast('Это отметилось само - по сделанным заданиям'); return; }
    const d = day(), m = d.m = d.m || {}; if (m[id]) delete m[id]; else m[id] = 1;
    save(); render(); toast(m[id] ? 'Отмечено: сделано' : 'Отметка снята');
  },
});

/* ---- русский по темам: сначала теория, потом закрепление (её просьба 01.11.2026: «не тупо всегда практика,
   а чтобы была теория, а потом теорию закрепляла»). Темы - в порядке «быстрых баллов» из артефакта (PRIO),
   потом задания по тексту. Тема пройдена, когда теория прочитана и решено 25 разных заданий темы
   (или все, если их меньше), - или если она нажала «Уже знаю». state.ruPath[номер] = { th: дата теории, done: дата «уже знаю» } ---- */
const RU_PATH = [4, 8, 22, 15, 12, 9, 16, 17, 5, 7, 6, 10, 11, 13, 14, 18, 19, 20, 26, 24, 3, 21, 23, 25, 1, 2];
const ruP = n => state.ruPath?.[n] || {};
const ruSet = (n, patch) => { state.ruPath = state.ruPath || {}; state.ruPath[n] = { ...(state.ruPath[n] || {}), ...patch }; };
const ruTopicKey = n => ((TASK_ITEMS['ru:' + n] || []).length ? 'ru:' : 'ruE:') + n;
const ruTotal = n => (TASK_ITEMS['ru:' + n] || []).length + (TASK_ITEMS['ruE:' + n] || []).length;
const ruSeen = n => mastery('ru:' + n).seen + mastery('ruE:' + n).seen;
const ruPassed = n => { const p = ruP(n); return !!p.done || (!!p.th && ruSeen(n) >= Math.min(25, ruTotal(n))); };
const ruPassedList = () => RU_PATH.filter(ruPassed);
const ruTopic = () => RU_PATH.find(n => ruTask(n) && ruTotal(n) && !ruPassed(n)) || null;
/* повторение: задания из пройденных тем (и тренировка, и «как на ЕГЭ») */
const ruReviewPool = () => [...new Set(ruPassedList().flatMap(n => [...(TASK_ITEMS['ru:' + n] || []), ...(TASK_ITEMS['ruE:' + n] || [])]))];
function ruPractice(n, cnt = 10) {
  const k = ruTopicKey(n), T = ruTask(n);
  startPool(`Задание ${n}: ${T ? T.title : ''}`, TASK_ITEMS[k] || [], cnt, { key: k });
}
/* экран задания, вкладка «Теория»: внизу - «Прочитала - закрепить» */
const vTask0 = vTask;
vTask = function (r) {
  const h = vTask0(r), T = ruTask(r.n); if (!T || T.n === 27 || !ruTotal(T.n)) return h;
  const m = mastery('ru:' + T.n), sub = r.sub || (m.total > 0 && m.seen ? 'train' : 'theory');
  if (sub !== 'theory') return h;
  const th = ruP(T.n).th, inPath = ruTopic() === T.n;
  return h + `<section class="card" style="border-left:5px solid var(--violet)">
    <h2 class="h2">${th ? 'Закрепить тему' : 'Прочитала теорию?'}</h2>
    <p class="muted small" style="margin:0">${th ? `Теорию ты прочитала ${fmtD(th)}. ` : ''}Сразу закрепи: 10 заданий только по этой теме. Ошибки уйдут в красную тетрадь - повторишь их в другие дни.${inPath ? ' Это тема дня из плана.' : ''}</p>
    <button class="btn primary block" data-a="ruLearn" data-n="${T.n}">${ic('play', 18)} Прочитала - закрепить</button></section>`;
};
Object.assign(A, {
  ruLearn: b => { const n = +b.dataset.n; if (!ruP(n).th) { ruSet(n, { th: today() }); save(); } ruPractice(n); },
  ruSkip: b => {
    const n = +b.dataset.n; ruSet(n, { done: today() });
    const d = day(); if (d.pk?.ru === n) { const pk = { ...d.pk }; delete pk.ru; d.pk = pk; }
    save(); render(); toast(`Задание ${n} отмечено как знакомое - дальше следующая тема`);
  },
});
/* «По теме» на экране задания - тоже с ключом темы: в конце видно, сколько осталось, а план засчитывает ответы */
A.startTask = b => ruPractice(+b.dataset.n);
/* экран плана: темы русского по порядку */
const vPlan1 = vPlan;
vPlan = function () {
  const h = vPlan1(), cur = ruTopic(), done = ruPassedList().length;
  const row = n => { const T = ruTask(n), ok = ruPassed(n), now = n === cur; return `<button class="prow" data-a="openTask" data-n="${n}"><span class="tnum ${ok ? 'done' : now ? '' : 'theory'}" style="font-size:16px">${ok ? ic('check', 20) : n}</span><span style="min-width:0"><span class="ttl">${esc(T.title)}</span><br><span class="tmeta">задание ${n}${ok ? (ruP(n).done && !ruP(n).th ? ' · отмечено «уже знаю»' : ' · пройдено') : now ? ' · тема сейчас' : ''}</span></span><span class="pts num">${ruSeen(n)}/${Math.min(25, ruTotal(n))}</span></button>`; };
  const card = `<section class="card"><div class="row sb"><h2 class="h2">Русский по темам</h2><span class="kicker">${done} из ${RU_PATH.length}</span></div>
    <p class="muted small" style="margin:0">Каждая тема: сначала теория, потом закрепление. Тема пройдена, когда решено 25 разных заданий по ней. Порядок - от самых быстрых баллов.</p>
    <div class="bar"><i style="width:${done / RU_PATH.length * 100}%"></i></div>
    <details class="fbd" data-fd="ru-path" ${ui.finOpen?.['ru-path'] ? 'open' : ''}><summary>Все темы по порядку</summary><div>${RU_PATH.filter(n => ruTask(n)).map(row).join('')}</div></details></section>`;
  const at = h.indexOf('<section class="card"><h2 class="h2">Этапы до экзамена</h2>');
  return at >= 0 ? h.slice(0, at) + card + h.slice(at) : h + card;
};
