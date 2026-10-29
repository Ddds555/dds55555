/* ================= ОФЛАЙН-ВЕРСИЯ =================
   Этот блок вставляет tools/build.py перед «старт». Всё остальное - код и материалы артефакта из Claude.
   Здесь то, чего нет в версии в Claude: тест по каждому произведению и отметка «прочитала», вкладка «Сочинение»,
   копия прогресса в файл и загрузка из файла, работа без интернета (service worker). */

/* ---- итоговое сочинение: новые виды заданий из карточек произведений ----
   r - кто есть кто (роль героя), g - жанр, c - цитата, k - аргумент-карточка «вспомни эпизод и вывод» (самопроверка).
   id постоянные - по ним хранятся ответы: fin-r-<произведение>-<номер героя>, fin-g-<произведение>,
   fin-c-<произведение>-<номер цитаты>, fin-k-<произведение>-<номер аргумента>. Новые виды - только в конец. */
Object.assign(FIN_KIND, { r: 'кто есть кто', g: 'жанры', c: 'цитаты', k: 'аргументы' });
const GENRE_IN = { 'роман': 'в романе', 'роман-эпопея': 'в романе-эпопее', 'роман в стихах': 'в романе в стихах', 'повесть': 'в повести', 'повесть-сказка': 'в повести-сказке', 'рассказ': 'в рассказе', 'пьеса': 'в пьесе', 'драма': 'в драме', 'комедия': 'в комедии', 'поэма': 'в поэме', 'стихотворение в прозе': 'в стихотворении в прозе' };
/* «Капитанскую дочку» в школе называют и романом, и повестью - повесть в неверные варианты не ставим */
const GENRE_ALSO = { kapdoch: ['P'] };
const GENRE_NOTE = { kapdoch: '«Капитанскую дочку» называют и романом, и повестью - оба варианта не ошибка.' };
/* вопросы FINAL_QUIZ, которые относятся к произведению (для теста по произведению).
   [] - вопрос не берём: в тесте по одной книге ответ на него слишком очевиден («какое произведение НЕ подходит…») */
const FQ_WORKS = {
  'fq-001': ['kapdoch'], 'fq-002': ['prest'], 'fq-003': ['yushka', 'matrena'], 'fq-004': [], 'fq-005': ['prinz'],
  'fq-006': ['yushka', 'nadne'], 'fq-007': ['sudba'], 'fq-008': ['shinel'], 'fq-009': ['izergil', 'geroy'], 'fq-010': [],
  'fq-011': ['matrena'], 'fq-012': ['nedorosl'], 'fq-013': ['voina'], 'fq-014': ['groza'], 'fq-015': ['master', 'onegin'],
  'fq-016': [], 'fq-017': ['gore'], 'fq-018': ['sudba', 'zori'], 'fq-019': ['prest'], 'fq-020': ['kapdoch'],
  'fq-021': ['smotr', 'shinel'], 'fq-022': ['izergil'], 'fq-023': ['oblomov'], 'fq-024': ['matrena'], 'fq-025': ['prinz'],
  'fq-026': [], 'fq-027': ['nedorosl'], 'fq-028': ['sobach'], 'fq-029': ['master'], 'fq-030': ['sudba'],
  'fq-031': ['prest', 'master'], 'fq-032': [], 'fq-033': ['groza'], 'fq-034': ['otcy'], 'fq-035': ['granat'],
  'fq-036': ['yushka', 'nadne'], 'fq-037': ['gore'], 'fq-038': ['oblomov', 'nedorosl'], 'fq-039': ['rusyaz'], 'fq-040': ['taras'],
  'fq-041': ['smotr'], 'fq-042': ['voina'], 'fq-043': ['izergil'], 'fq-044': ['granat'], 'fq-045': ['geroy'],
  'fq-046': ['oblomov'], 'fq-047': ['sudba', 'tdon'], 'fq-048': [], 'fq-049': ['vishsad'], 'fq-050': [],
  'fq-051': ['granat', 'yushka'], 'fq-052': [], 'fq-053': ['shinel'], 'fq-054': ['gore'], 'fq-055': ['onegin', 'geroy'],
  'fq-056': ['yushka'], 'fq-057': ['nedorosl', 'mertvye'], 'fq-058': ['tdon'],
};
const finNameP = w => `«${w.title}»${w.authorShort ? ` (${w.authorShort})` : ''}`;
{
  const hashStr = s => { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return ((h >>> 0) % 2147483645) + 1; };
  const uniq = a => [...new Set(a.filter(Boolean))];
  const all = TASK_ITEMS['fin:all'] = TASK_ITEMS['fin:all'] || [];
  const put = (kind, it) => { if (ITEMS[it.id]) return; addItem('fin:' + kind, { subj: 'fin', task: kind, exc: false, ...it }); all.push(it.id); };
  const choice = (kind, id, q, right, wrong, ex, work) => {
    const w = uniq(wrong).filter(x => x !== right); if (!right || w.length < 3) return;
    const r = rng(hashStr(id)), o = pickN([right, ...pickN(w, 3, r)], 4, r);
    put(kind, { id, type: 'choice', q, o, a: o.indexOf(right), ex, work });
  };
  /* новые произведения (tools/content/extra-works.js): в список, к темам, «кто автор» и «чей герой» - как у остальных.
     Герой с q: false (например, безымянный «Профессор») в тесты не идёт: вопрос о нём был бы неоднозначным */
  const fresh = EXTRA_WORKS.filter(w => w && w.id && w.title && !finWork(w.id));
  for (const w of fresh) FIN_W.push(w);
  for (const [tid, ids] of Object.entries(EXTRA_TOPIC_WORKS)) { const t = finTopic(tid); if (t) t.works = uniq([...(t.works || []), ...ids]); }
  const authors = uniq(FIN_W.map(w => w.author));
  for (const w of fresh) {
    const gy = [w.genre, w.year].filter(Boolean).join(', ');
    choice('a', 'fin-a-' + w.id, `Кто автор произведения «${w.title}»? На сочинении автора называют полностью.`, w.author, authors.filter(a => a !== w.author), `«${w.title}»${gy ? ` (${gy})` : ''} - автор **${w.author}**.`, w.id);
    (w.heroes || []).forEach((h, i) => {
      if (!h || !h.name || h.q === false) return;
      const other = FIN_W.filter(x => x.id !== w.id && !(x.heroes || []).some(y => y && y.name === h.name)).map(finWorkName);
      choice('h', `fin-h-${w.id}-${i + 1}`, `Из какого произведения герой: ${h.name}?`, finWorkName(w), other, `**${h.name}**${h.who ? ` - ${h.who}` : ''}. Это ${finWorkName(w)}.`, w.id);
    });
  }
  for (const x of EXTRA_QUIZ) if (x.id && x.q && Array.isArray(x.o) && x.o[x.a] != null) put('q', { ...x, type: 'choice' });
  /* тренажёр слов (вкладка «Слова»): вспомнить близкие слова - потом проверить себя. В общий тест по книгам не входит */
  FIN_KIND.v = 'синонимы';
  for (const w of FINAL_WORDS) if (w.id && !ITEMS['fin-v-' + w.id]) addItem('fin:v', { id: 'fin-v-' + w.id, type: 'card', subj: 'fin', task: 'v', exc: false, q: `«${w.w}» - что это значит и какими близкими словами заменить, чтобы не повторяться? Назови хотя бы три.`, a: w.syn.join(', '), why: `**Что это:** ${w.def}\n**Противоположные:** ${w.ant.join(', ')}\n**Готовые сочетания:** ${w.ph.join('; ')}` });
  const fam = g => /роман/.test(g) ? 'R' : /повесть/.test(g) ? 'P' : /рассказ/.test(g) ? 'S' : /пьеса|драма|комедия|трагедия/.test(g) ? 'D' : /поэма/.test(g) ? 'Po' : /стихотворени/.test(g) ? 'St' : g;
  const genres = uniq(FIN_W.map(w => w.genre));
  for (const w of FIN_W) {
    const heroes = w.heroes || [], who = heroes.filter(h => h && h.name && h.who).map(h => h.who);
    const otherWho = FIN_W.filter(x => x.id !== w.id).flatMap(x => (x.heroes || []).filter(h => h && h.who).map(h => h.who));
    heroes.forEach((h, i) => { // кто есть кто: неверные варианты - другие герои этой же книги
      if (!h || !h.name || !h.who || h.q === false) return;
      const id = `fin-r-${w.id}-${i + 1}`, same = who.filter(x => x !== h.who);
      const wrong = same.length >= 3 ? same : [...same, ...pickN(otherWho, 3 - same.length, rng(hashStr(id + ':x')))];
      choice('r', id, `«${w.title}»: ${h.name} - это…`, h.who, wrong, `**${h.name}** - ${h.who}.`, w.id);
    });
    if (w.genre) { // жанр: неверные варианты - из других семейств жанров (драма, пьеса и комедия друг другу не ошибка)
      const skip = new Set([fam(w.genre), ...(GENRE_ALSO[w.id] || [])]), seen = new Set(), wrong = [];
      for (const g of genres) { const f = fam(g); if (!skip.has(f) && !seen.has(f)) { seen.add(f); wrong.push(g); } }
      const inG = GENRE_IN[w.genre];
      choice('g', 'fin-g-' + w.id, `Какой жанр у произведения ${finNameP(w)}?`, w.genre, wrong, `${finNameP(w)} - **${w.genre}**${w.year ? `, ${w.year}` : ''}.${inG ? ` На сочинении так и пиши: «${inG} «${w.title}»…».` : ''} Перепутанный жанр - фактическая ошибка.${GENRE_NOTE[w.id] ? ' ' + GENRE_NOTE[w.id] : ''}`, w.id);
    }
    (w.quotes || []).forEach((x, i) => { // цитата -> произведение
      const text = typeof x === 'string' ? x : x?.text; if (!text) return;
      choice('c', `fin-c-${w.id}-${i + 1}`, `Из какого произведения цитата: ${text}?`, finWorkName(w), FIN_W.filter(y => y.id !== w.id).map(finWorkName), `Это ${finWorkName(w)}. Точная цитата к месту украшает сочинение: ею можно начать вступление или закрепить вывод аргумента.`, w.id);
    });
    (w.args || []).forEach((a, i) => { // аргумент: вспомнить эпизод и вывод, потом проверить себя
      if (!a || !a.title || !a.ep) return;
      put('k', { id: `fin-k-${w.id}-${i + 1}`, type: 'card', q: `${finNameP(w)}. Аргумент «${a.title}»: вспомни эпизод и что он доказывает - потом проверь себя.`, a: a.ep, why: a.proves ? `**Что доказывает:** ${a.proves}` : '', work: w.id });
    });
  }
  /* тест по произведению: автор, жанр, кто есть кто, аргументы и вопросы FINAL_QUIZ про эту книгу.
     «Чей герой», «чья цитата» и «что подходит к теме» сюда не берём: в тесте по одной книге ответ на них очевиден */
  const st = t => { const s = t.toLowerCase().replace(/ё/g, 'е'), f = s.split(/\s+/)[0]; return f.length > 5 ? f.slice(0, -2) : s.slice(0, 6); };
  const guess = it => { const q = String(it?.q || '').toLowerCase().replace(/ё/g, 'е'); return FIN_W.filter(w => q.includes('«' + st(w.title))).map(w => w.id); };
  const pools = {}, add = (wid, id) => { if (!finWork(wid) || !ITEMS[id]) return; const p = pools[wid] = pools[wid] || []; if (!p.includes(id)) p.push(id); };
  for (const k of ['a', 'g', 'r', 'k']) for (const id of TASK_ITEMS['fin:' + k] || []) add(ITEMS[id].work, id);
  for (const id of TASK_ITEMS['fin:q'] || []) for (const wid of FQ_WORKS[id] || ITEMS[id].works || guess(ITEMS[id])) add(wid, id);
  for (const w of FIN_W) TASK_ITEMS['finw:' + w.id] = pools[w.id] || [];
}

/* ---- прочитала -> закрепила ---- */
const finReadOf = id => state.readW?.[id] || null;
const finDone = w => { const m = mastery('finw:' + w.id); return m.total > 0 && m.pct >= 0.8; };
const finQuizN = w => { const n = (TASK_ITEMS['finw:' + w.id] || []).length; return n <= 20 ? n : 15; };
/* что читать дальше: избранное, которое ещё не закреплено, потом непрочитанное по порядку, потом самое слабое */
function finNextWork() {
  const open = w => !(finReadOf(w.id) && finDone(w));
  return favWorks().map(finWork).filter(Boolean).find(open) || FIN_W.find(w => !finReadOf(w.id)) || [...FIN_W].filter(open).sort((a, b) => mastery('finw:' + a.id).pct - mastery('finw:' + b.id).pct)[0] || null;
}
function finReadBtn(w) {
  const rd = finReadOf(w.id);
  return `<button class="btn sm ${rd ? 'gold' : 'ghost'}" data-a="finRead" data-id="${esc(w.id)}" aria-pressed="${!!rd}">${ic('check', 16)} ${rd ? `Прочитано ${fmtD(rd)}` : 'Прочитала'}</button>`;
}
finWorkRow = function (w) {
  const fav = !!state.favW?.[w.id], rd = finReadOf(w.id), m = mastery('finw:' + w.id), done = finDone(w), gy = [w.genre, w.year].filter(Boolean).join(', ');
  const st = [rd ? 'прочитано' : '', m.seen ? `тест ${m.ok} из ${m.total}` : ''].filter(Boolean).join(' · ');
  return `<button class="trow" data-a="finWork" data-id="${esc(w.id)}"><span class="tnum ${fav ? '' : done ? 'done' : 'theory'}" style="${fav ? 'background:var(--gold-soft);color:var(--gold);font-size:26px' : ''}">${fav ? '★' : done ? ic('check', 24) : ic('book', 24)}</span><span style="min-width:0"><span class="ttl">«${esc(w.title)}»</span><br><span class="tmeta">${esc(w.authorShort || w.author || '')}${gy ? ' · ' + esc(gy) : ''}</span>${st ? `<br><span class="tmeta" style="font-weight:800;color:${done ? 'var(--good)' : 'var(--violet)'}">${st}</span>` : ''}${m.seen ? `<div class="bar ${done ? '' : 'violet'}" style="height:6px;margin-top:6px"><i style="width:${m.pct * 100}%"></i></div>` : ''}</span><span class="pts">${rd ? `<span style="color:var(--good)">${ic('check', 20)}</span>` : ''}</span></button>`;
};
const finWorksHTML0 = finWorksHTML;
finWorksHTML = function () {
  if (!FIN_W.length) return finWorksHTML0();
  const rd = FIN_W.filter(w => finReadOf(w.id)).length, done = FIN_W.filter(finDone).length, N = FIN_W.length, nx = finNextWork();
  return `<section class="card" style="border-left:5px solid var(--rose)"><div class="kicker">Прочитала - закрепила</div>
    <div class="blk"><div class="row sb small"><span>Прочитано</span><span class="num">${rd} из ${N}</span></div><div class="bar"><i style="width:${rd / N * 100}%"></i></div></div>
    <div class="blk"><div class="row sb small"><span>Тест сдан (80% и больше)</span><span class="num">${done} из ${N}</span></div><div class="bar violet"><i style="width:${done / N * 100}%"></i></div></div>
    <p class="muted small" style="margin:0">Открой книгу, прочитай карточку - героев, сюжет и аргументы - и нажми «Прочитала». Внизу карточки - тест только по этой книге.</p>
    ${nx ? `<button class="btn primary block" data-a="finWork" data-id="${esc(nx.id)}">${ic('book', 18)} Дальше: «${esc(nx.title)}»</button>` : ''}</section>` + finWorksHTML0();
};
function finWorkQuizCard(w) {
  const key = 'finw:' + w.id, ids = TASK_ITEMS[key] || []; if (!ids.length) return '';
  const m = mastery(key), n = finQuizN(w), kinds = new Set(ids.map(id => ITEMS[id]?.task));
  const what = [kinds.has('a') ? 'автор' : '', kinds.has('g') ? 'жанр' : '', kinds.has('r') ? 'кто есть кто' : '', kinds.has('k') ? 'аргументы: вспомни эпизод и вывод' : '', kinds.has('q') ? 'вопросы как на сочинении' : ''].filter(Boolean).join(', ');
  return `<section class="card" id="finq" style="border-left:5px solid var(--violet)">
    <div class="row sb"><h2 class="h2">Закрепить</h2><span class="num muted small">${Math.round(m.pct * 100)}%</span></div>
    <div class="big">${m.ok}<span>/${m.total}</span></div><div class="bar violet"><i style="width:${m.pct * 100}%"></i></div>
    <p class="muted small" style="margin:0">Тест только по этой книге: ${what}. Ошибки уйдут в красную тетрадь - повторишь в марафоне.</p>
    <button class="btn primary block" data-a="finWorkQuiz" data-id="${esc(w.id)}">${ic('play', 18)} ${m.seen ? 'Пройти ещё раз' : 'Пройти тест'}: ${n} ${plural(n, 'вопрос', 'вопроса', 'вопросов')}</button>
    ${m.seen ? restBtnHTML(key) : ''}
    <div class="row">${finReadBtn(w)}</div>
  </section>`;
}
const finWorkHTML0 = finWorkHTML;
finWorkHTML = function (w) {
  let h = finWorkHTML0(w);
  const key = 'finw:' + w.id, m = mastery(key), n = (TASK_ITEMS[key] || []).length;
  const top = `<div class="row">${finReadBtn(w)}${n ? `<button class="btn sm violet" data-a="finWorkQuiz" data-id="${esc(w.id)}">${ic('play', 16)} Тест: ${m.seen ? `${m.ok} из ${m.total}` : `${n} ${plural(n, 'вопрос', 'вопроса', 'вопросов')}`}</button>` : ''}</div>`;
  const i = h.indexOf('</p>'); // первый абзац - автор: кнопки сразу под ним, до списка разделов
  if (i >= 0) h = h.slice(0, i + 4) + top + h.slice(i + 4);
  // «Сюжет» -> «Кратко», а сразу под ним - подробный пересказ и полный текст
  const plotH = '<h2 class="h2">Сюжет</h2>', p = h.indexOf(plotH), more = finMoreHTML(w);
  if (p >= 0) { h = h.replace(plotH, '<h2 class="h2">Кратко</h2>'); const e = h.indexOf('</section>', p); h = e >= 0 ? h.slice(0, e + 10) + more + h.slice(e + 10) : h + more; }
  else h += more;
  return h + finWorkQuizCard(w);
};
/* свёрнутый раздел, который остаётся открытым, когда экран перерисовывается (ui.finOpen - как у разделов тем) */
const finDet = (key, title) => `<details class="card fsec" data-fd="${esc(key)}" ${ui.finOpen?.[key] ? 'open' : ''}><summary style="cursor:pointer">${title}</summary>`;
/* подробный пересказ по частям (FINAL_DETAILS) и полный текст небольших произведений (FINAL_TEXTS) - свёрнуты, чтобы карточка не была бесконечной */
function finMoreHTML(w) {
  const parts = FINAL_DETAILS[w.id] || [], T = FINAL_TEXTS[w.id];
  const det = parts.length ? `${finDet('more-' + w.id, 'Подробно - по главам и эпизодам')}<p class="muted small" style="margin:6px 0 0">Чтобы точно не перепутать, кто что сделал и в каком порядке. Жирным - эпизоды, которые чаще всего берут в аргументы.</p>${parts.map(x => `<article class="sheet-note"><h3>${esc(x.h)}</h3><p>${md(x.p)}</p></article>`).join('')}</details>` : '';
  const txt = T ? `${finDet('text-' + w.id, 'Текст целиком')}${T.note ? `<p class="muted small" style="margin:6px 0 0">${esc(T.note)}</p>` : ''}<div class="fulltext">${T.p.map(x => `<p>${esc(x)}</p>`).join('')}</div></details>` : '';
  return det + txt;
}
finQuizHTML = function () {
  const ids = TASK_ITEMS['fin:all'] || []; if (!ids.length) return finSoon('Тренировка');
  const m = mastery('fin:all'), errs = ids.filter(id => state.errors[id] && !state.errors[id].learned).length;
  const kinds = Object.keys(FIN_KIND).filter(k => (TASK_ITEMS['fin:' + k] || []).length);
  const row = w => { const mw = mastery('finw:' + w.id), done = finDone(w); return `<button class="wq" data-a="finWorkQuiz" data-id="${esc(w.id)}"><span style="min-width:0"><b>«${esc(w.title)}»</b> <span class="muted small">${esc(w.authorShort || '')}</span>${finReadOf(w.id) ? ' <span class="okmark">прочитано</span>' : ''}<span class="bar ${done ? '' : 'violet'}" style="height:6px;margin-top:6px;display:block"><i style="width:${mw.pct * 100}%"></i></span></span><span class="wqs num" style="${done ? 'color:var(--good)' : ''}">${mw.ok}/${mw.total}</span></button>`; };
  return `<section class="card">
    <div class="row sb"><span class="kicker">Твой прогресс</span><span class="num muted small">${Math.round(m.pct * 100)}%</span></div>
    <div class="big">${m.ok}<span>/${m.total}</span></div><div class="bar"><i style="width:${m.pct * 100}%"></i></div>
    <p class="muted small" style="margin:0">Всё вперемешку: кто автор (полностью - имя, отчество, фамилия), чей герой и кто есть кто, жанр, цитаты, аргументы (вспомни эпизод и вывод), что подходит к теме. В красной тетради: ${errs}.</p>
    <button class="btn primary block" data-a="startKey" data-k="fin:all" data-n="10">${ic('play', 18)} 10 заданий</button>
    ${restBtnHTML('fin:all')}
    <div class="row">${kinds.map(k => `<button class="btn sm" data-a="startKey" data-k="fin:${k}" data-n="10">${FIN_KIND[k][0].toUpperCase() + FIN_KIND[k].slice(1)}: ${TASK_ITEMS['fin:' + k].length}</button>`).join('')}</div>
  </section>
  <section class="card"><div class="row sb"><h2 class="h2">По одному произведению</h2><span class="kicker">${FIN_W.filter(finDone).length} из ${FIN_W.length} сдано</span></div>
    <p class="muted small" style="margin:0">Прочитала карточку - сразу закрепи. Зелёный - тест сдан на 80% и больше.</p>
    <div>${FIN_W.map(row).join('')}</div></section>`;
};
/* карточка итогового сочинения на главной */
function finHomeCard() {
  if (!FIN_W.length) return '';
  const fd = daysTo(ESSAY_DATE), N = FIN_W.length, rd = FIN_W.filter(w => finReadOf(w.id)).length, done = FIN_W.filter(finDone).length, nx = finNextWork();
  return `<section class="card" style="border-left:5px solid var(--rose)">
    <div class="row sb"><h2 class="h2">Итоговое сочинение</h2><span class="kicker">${fd >= 0 ? `${fmtD(ESSAY_DATE)} · через ${fd} ${plural(fd, 'день', 'дня', 'дней')}` : 'допуск к ЕГЭ'}</span></div>
    <div class="blk"><div class="row sb small"><span>Прочитано произведений</span><span class="num">${rd} из ${N}</span></div><div class="bar"><i style="width:${rd / N * 100}%"></i></div></div>
    <div class="blk"><div class="row sb small"><span>Тест по книге сдан</span><span class="num">${done} из ${N}</span></div><div class="bar violet"><i style="width:${done / N * 100}%"></i></div></div>
    <div class="row">${nx ? `<button class="btn primary" data-a="finWork" data-id="${esc(nx.id)}">${ic('book', 18)} «${esc(nx.title)}»</button>` : ''}${rd ? `<button class="btn violet" data-a="finParaMine">${ic('pen', 18)} Аргумент к теме</button>` : ''}<button class="btn" data-a="tab" data-t="final">Все разделы</button></div>
  </section>`;
}

/* ---- вкладка «Слова»: слова к темам, готовые фразы, как писать без воды, тренажёр синонимов ---- */
function finWordsHTML() {
  const chips = a => `<div class="chips">${a.map(x => `<span class="tagc">${esc(x)}</span>`).join('')}</div>`;
  const nV = (TASK_ITEMS['fin:v'] || []).length, m = mastery('fin:v');
  const word = w => `${finDet('word-' + w.id, esc(w.w))}<div class="stack" style="gap:10px;margin-top:10px">
      <p style="margin:0;line-height:1.6"><b>Что это:</b> ${esc(w.def)}</p>
      <div class="stack" style="gap:6px"><div class="kicker">Близкие слова - чтобы не повторяться</div>${chips(w.syn)}</div>
      <div class="stack" style="gap:6px"><div class="kicker">Противоположные</div>${chips(w.ant)}</div>
      <div class="stack" style="gap:6px"><div class="kicker">Готовые сочетания</div><p style="margin:0;line-height:1.6">${w.ph.map(esc).join(' · ')}</p></div>
      <div class="excbox soft"><b>Мысль для вступления:</b> ${esc(w.idea)}</div></div></details>`;
  return `<p class="muted" style="margin:0">Когда пишешь, а слова получаются общие и одно и то же повторяется, - загляни сюда. У каждой темы: что это значит, какими словами её заменить, готовые сочетания и мысль, с которой можно начать.</p>
  <section class="card" style="border-left:5px solid var(--violet)"><div class="row sb"><h2 class="h2">Тренажёр слов</h2><span class="num muted small">${m.ok}/${m.total}</span></div><p class="muted small" style="margin:0">Видишь слово темы - вспоминаешь близкие слова, потом открываешь ответ и честно отмечаешь, вспомнила или нет. Непомнящиеся уходят в красную тетрадь.</p><button class="btn primary block" data-a="startKey" data-k="fin:v" data-n="${Math.min(10, nV)}">${ic('play', 18)} 10 слов</button></section>
  <section class="stack"><div class="kicker">Слова к темам: ${FINAL_WORDS.length}</div>${FINAL_WORDS.map(word).join('')}</section>
  <section class="card"><h2 class="h2">Готовые фразы</h2><p class="muted small" style="margin:0">Каркас сочинения: вместо «...» - своё. Не учи наизусть всё - выбери по одной фразе для каждой части.</p>${FINAL_PHRASES.map(g => `<div class="stack" style="gap:6px"><div class="kicker">${esc(g.h)}</div>${g.list.map(x => `<div class="excline" style="border-left-color:var(--violet-soft)">${esc(x)}</div>`).join('')}</div>`).join('')}</section>
  <section class="card"><h2 class="h2">Как писать без воды</h2>${FINAL_NOWATER.map(t => `<div class="stack" style="gap:6px"><b>${esc(t.h)}</b><p class="muted small" style="margin:0">${esc(t.p)}</p><div class="verd no"><b style="color:var(--bad)">Было</b>${esc(t.bad)}</div><div class="verd"><b style="color:var(--good)">Стало</b>${esc(t.good)}</div></div>`).join('')}</section>`;
}

/* ---- абзац-аргумент по своим книгам: тема подбирается к прочитанным произведениям, после - сверка с образцом ---- */
const finReadWorks = () => FIN_W.filter(w => finReadOf(w.id));
finParaPick = function (prev) {
  const read = new Set(finReadWorks().map(w => w.id));
  const mine = FIN_T.filter(t => t.id !== prev && (t.works || []).some(id => read.has(id)));
  const any = FIN_T.filter(t => t.id !== prev && (t.works || []).some(finWork));
  const pool = mine.length ? mine : any.length ? any : FIN_T;
  return pool[Math.floor(Math.random() * pool.length)]?.id || null;
};
/* «Другая тема» и «Аргумент к теме» на главной: новая пара «тема + книга». Книга - любая из прочитанных, каждая одинаково
   часто (у «Юшки» тем больше, чем у «Чудесного доктора», - иначе он почти не попадался бы); выбранная вручную непрочитанная остаётся */
function finParaNext() {
  const P = state.finPara = state.finPara && typeof state.finPara === 'object' ? state.finPara : { tid: null, wid: '', text: '', res: null };
  const topics = w => FIN_T.filter(t => t.id !== P.tid && (t.works || []).includes(w.id)), rnd = a => a[Math.floor(Math.random() * a.length)];
  const cur = finWork(P.wid), read = finReadWorks().filter(w => topics(w).length);
  const w = cur && !finReadOf(cur.id) && topics(cur).length ? cur : read.length ? rnd(read) : null;
  if (w) { P.tid = rnd(topics(w)).id; P.wid = w.id; } else P.tid = finParaPick(P.tid);
  save();
}
const GENRE_TO = { 'роман': 'к роману', 'роман-эпопея': 'к роману-эпопее', 'роман в стихах': 'к роману в стихах', 'повесть': 'к повести', 'повесть-сказка': 'к повести-сказке', 'рассказ': 'к рассказу', 'пьеса': 'к пьесе', 'драма': 'к драме', 'комедия': 'к комедии', 'поэма': 'к поэме', 'стихотворение в прозе': 'к стихотворению в прозе' };
/* автор в родительном падеже для «Обратимся к рассказу А. П. Платонова»: Толстой -> Толстого, Гоголь -> Гоголя, Пушкин -> Пушкина */
const authorGen = s => String(s || '').replace(/(\S+)$/, x => /ой$|ий$/.test(x) ? x.slice(0, -2) + 'ого' : /ь$/.test(x) ? x.slice(0, -1) + 'я' : /[иеоуюэ]$/.test(x) ? x : x + 'а');
function finParaModelHTML() {
  const P = state.finPara || {}, t = finTopic(P.tid); if (!t) return '';
  const read = finReadWorks().filter(w => (t.works || []).includes(w.id)), w = finWork(P.wid);
  const mine = read.length ? `<p style="margin:0">Из твоих прочитанных к этой теме подходят: ${read.map(x => `<b>«${esc(x.title)}»</b>`).join(', ')}.</p>` : `<p class="muted small" style="margin:0">Отмечай книги «Прочитала» - тогда темы будут подбираться к твоим книгам.</p>`;
  let model = '';
  if (w) {
    const args = [...(w.args || [])].sort((a, b) => ((b.subs || []).includes(t.sub) ? 1 : 0) - ((a.subs || []).includes(t.sub) ? 1 : 0));
    const a0 = args[0], lead = `Обратимся ${GENRE_TO[w.genre] || 'к произведению'} ${authorGen(w.authorShort || w.author)} «${w.title}».`;
    model = a0 ? `<details class="fbd"><summary>Сверь себя с образцом - открой, когда напишешь</summary><div class="stack" style="gap:10px;margin-top:8px">
      <div class="ai"><b>Вход:</b> ${esc(lead)}\n<b>Эпизод:</b> ${esc(a0.ep)}\n<b>Вывод:</b> ${esc(a0.proves)}\n<b>Связь с темой:</b> закончи фразой со словами из темы - «${esc(t.text)}»</div>
      ${args.slice(1).map(a => `<article class="sheet-note"><h3>${esc(a.title)}</h3><p>${md(a.ep)}</p><p><b>Вывод:</b> ${md(a.proves || '')}</p></article>`).join('')}
      <p class="muted small" style="margin:0">Проверь себя: есть ли у тебя автор и название, эпизод в 3-5 предложениях без пересказа всей книги, вывод одной фразой и слова из темы в последнем предложении.</p></div></details>` : '';
  }
  return `<section class="card"><h2 class="h2">Твои книги и образец</h2>${mine}${model}
    <div class="row"><button class="btn sm" data-a="copyPara">Скопировать абзац для проверки Claude</button></div></section>`;
}
const finParaHTML0 = finParaHTML;
finParaHTML = () => finParaHTML0() + finParaModelHTML();
const finFullHTML0 = finFullHTML;
finFullHTML = () => finFullHTML0() + `<section class="card"><h2 class="h2">Проверка</h2><p class="muted small" style="margin:0">Когда есть интернет, скопируй сочинение и вставь его в чат с Claude: проверю как комиссия по критериям К1-К5, найду воду и повторы, подскажу, чем заменить.</p><button class="btn block" data-a="copyEssay">Скопировать сочинение для проверки Claude</button><button class="btn sm ghost" data-a="finTab" data-s="words">Слова и фразы - если пишется «водой»</button></section>`;
const finStepsHTML0 = finStepsHTML;
finStepsHTML = () => finStepsHTML0() + `<section class="card"><div class="row sb"><h2 class="h2">Если пишется «водой»</h2></div><p class="muted small" style="margin:0">Слова к темам (доброта, милосердие, честь, совесть, равнодушие…), готовые фразы для каждой части и примеры «было - стало» - во вкладке «Слова».</p><button class="btn" data-a="finTab" data-s="words">Открыть «Слова»</button></section>`;
/* вкладка «Сочинение» открывается там, где была в прошлый раз */
function finLastSub() { try { const s = localStorage.getItem(LS + '.fin'); return FIN_TABS.some(t => t[0] === s) ? s : 'theory'; } catch { return 'theory'; } }
const finRemember = s => { try { localStorage.setItem(LS + '.fin', s); } catch {} };
if (ui.route.v === 'final' && !ui.route.sub) ui.route.sub = finLastSub();

/* ---- мои данные: копия прогресса в файл и загрузка ---- */
const isIOS = () => /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const backupJSON = () => JSON.stringify({ app: 'ege70', kind: 'progress', v: 1, exported: new Date().toISOString(), state });
/* код для переноса текстом: EGE1: + gzip в base64 (если браузер умеет сжимать), иначе просто JSON */
async function packState() {
  const json = backupJSON();
  try {
    if (typeof CompressionStream === 'function') {
      const u = new Uint8Array(await new Response(new Blob([json]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());
      let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
      return 'EGE1:' + btoa(s);
    }
  } catch {}
  return json;
}
async function unpackText(text) {
  const t = String(text || '').trim();
  if (!t.startsWith('EGE1:')) return t;
  const bin = atob(t.slice(5).replace(/\s+/g, '')), u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return await new Response(new Blob([u]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
}
/* понимает три вида: файл копии этого приложения, просто состояние и запись из базы версии в Claude ({ json: "..." }) */
function parseBackup(text) {
  let o; try { o = JSON.parse(text); } catch { return null; }
  if (o && o.app === 'ege70' && o.state) o = o.state;
  else if (o && typeof o.json === 'string') o = o.json;
  return parseState(o);
}
function beforeImport() { try { const b = JSON.parse(localStorage.getItem(LS + '.before') || 'null'); return b && b.json ? b : null; } catch { return null; } }
let pendingImp = null;
async function importText(text) {
  let s = null; try { s = parseBackup(await unpackText(text)); } catch {}
  if (!s) { toast('Не получилось прочитать - это точно копия прогресса?'); return; }
  pendingImp = s;
  const cnt = x => Object.keys(x.ans || {}).length, last = Object.keys(s.days || {}).filter(k => (s.days[k]?.n || 0) > 0).sort().pop();
  openSheet(`<h2 class="h2">Загрузить этот прогресс?</h2>
    <table class="tbl wrap"><tbody><tr><td>В копии</td><td>${cnt(s)} ${plural(cnt(s), 'ответ', 'ответа', 'ответов')} · ${rub(s.coins || 0)}${last ? ` · последний день ${fmtD(last)}` : ''}</td></tr><tr><td>Сейчас здесь</td><td>${cnt(state)} ${plural(cnt(state), 'ответ', 'ответа', 'ответов')} · ${rub(state.coins)}</td></tr></tbody></table>
    <p class="muted small" style="margin:0">Прогресс на этом устройстве заменится копией. Если передумаешь - «Вернуть как было» в «Моих данных».</p>
    <div class="row"><button class="btn primary" data-a="importYes">${ic('check', 18)} Загрузить</button><button class="btn" data-a="closeSheet">Отмена</button></div>`);
}
/* ---- жалобы «Здесь ошибка?»: в офлайне их никто не проверяет сам - список копируется для Claude,
   а ответы Claude приходят с обновлением приложения (tools/report-checks.json -> REPORT_CHECKS) ---- */
function reportVerdict(r) {
  if (!r) return null;
  const c = REPORT_CHECKS[r.id];
  // ответ - на жалобы, поданные до проверки; если она с ответом не согласилась (after), нужен ответ новее
  if (c && (!r.d || r.d <= c.d) && (!r.after || c.d > r.after)) return { ok: !!c.ok, why: c.why || '', d: c.d };
  if (r.v) return { ok: !!r.v.ok, why: [r.v.why, r.v.fix].filter(Boolean).join(' '), d: r.v.d }; // проверка в версии в Claude
  return null;
}
const reportsWaiting = () => (state.reports || []).filter(r => !reportVerdict(r));
/* скопировать текст для чата с Claude; если буфер обмена недоступен - показать текст, чтобы скопировать руками */
async function copyForClaude(t) {
  try { await navigator.clipboard.writeText(t); toast('Скопировала - вставь в чат с Claude'); }
  catch { openSheet(`<h2 class="h2">Скопируй и отправь Claude</h2><textarea class="codebox" readonly>${esc(t)}</textarea><button class="btn block" data-a="closeSheet">Готово</button>`); }
}
function reportsText() {
  return 'Проверь мои жалобы на задания из приложения «ЕГЭ на 70» (офлайн-версия):\n' + reportsWaiting().map((r, i) => {
    const it = getItem(r.id);
    return `${i + 1}. [${r.id}] ${it ? `${itemLabel(it)} - ${questionText(it)}` : 'задание не найдено'}${it && it.o && it.type !== 'stress' ? `\n   Варианты: ${it.o.join(' | ')}` : ''}\n   Мой ответ: ${r.my || '-'} · ответ программы: ${it ? correctText(it) : '-'} · ${r.d || ''}${r.after ? ` · повторно: не согласна с ответом от ${r.after}` : ''}`;
  }).join('\n');
}
function reportsCardHTML() {
  const n = (state.reports || []).length, w = reportsWaiting().length;
  return `<section class="card"><div class="row sb"><h2 class="h2">Жалобы на задания</h2><span class="kicker">${n ? (w ? `ждут проверки: ${w}` : 'все проверены') : 'нет'}</span></div><p class="muted small" style="margin:0">Всё, где ты нажала «Здесь ошибка?», и ответ Claude по каждой жалобе.</p><button class="btn block" data-a="openReports">Открыть жалобы</button></section>`;
}
function vReports() {
  const list = [...(state.reports || [])].sort((a, b) => String(b.d || '').localeCompare(String(a.d || ''))), wait = reportsWaiting().length;
  const card = r => {
    const it = getItem(r.id), v = reportVerdict(r);
    const [col, st] = v ? (v.ok ? ['var(--good)', 'Проверено: в задании всё верно'] : ['var(--violet)', 'Проверено: ты права - в задании была ошибка, исправлено']) : ['var(--gold)', 'Ждёт проверки'];
    return `<div class="err" style="border-left-color:${col}"><div class="kicker">${it ? esc(itemLabel(it)) : 'Задание'}${r.d ? ' · ' + fmtD(r.d) : ''}</div>
      <div class="q">${it ? esc(questionText(it)) : `Этого задания (${esc(r.id)}) больше нет в программе`}</div>
      <div class="small">${r.my ? `Твой ответ: <b>${esc(r.my)}</b>` : ''}${r.my && it ? ' · ' : ''}${it ? `ответ программы: <b>${esc(correctText(it))}</b>` : ''}</div>
      <div class="small" style="font-weight:800;color:${col}">${st}</div>${v && v.why ? `<div class="small exp" style="line-height:1.55">${fmtRich(v.why, false)}</div>` : ''}</div>`;
  };
  return `${ui.stack.length ? `<button class="back" data-a="back">${ic('left', 18)} Назад</button>` : ''}
  <header class="stack" style="gap:6px"><div class="kicker">Здесь ошибка?</div><h1 class="h1">Жалобы на задания</h1><p class="muted" style="margin:0">Здесь всё, где ты нажала «Здесь ошибка?». Без интернета задания никто не проверяет сам: когда будет связь, скопируй жалобы и отправь их Claude. Claude проверит по правилам ФИПИ, исправит ошибки, и после обновления приложения у каждой жалобы появится ответ.</p></header>
  <section class="card"><div class="row sb"><div><div class="big">${wait}</div><div class="muted small">ждут проверки</div></div><div style="text-align:right"><div class="big" style="color:var(--good)">${list.length - wait}</div><div class="muted small">проверено</div></div></div>
    ${wait ? `<button class="btn primary block" data-a="copyReports">Скопировать для Claude: ${wait}</button>` : `<p class="muted small" style="margin:0">${list.length ? 'Все жалобы проверены.' : 'Жалоб пока нет. Если в задании что-то не так - после ответа нажми «Здесь ошибка?».'}</p>`}</section>
  ${list.length ? `<section class="stack">${list.map(card).join('')}</section>` : ''}`;
}
askHTML = function (it) { // в офлайне: только жалоба и её статус (вопросов к Claude нет)
  const r0 = state.reports?.find(r => r.id === it.id), v = reportVerdict(r0);
  const rep = !r0 ? '<button class="btn sm ghost" data-a="report">Здесь ошибка?</button>'
    : v ? `<span class="muted small">${v.ok ? 'Проверено: в задании всё верно' : 'Проверено: ошибка в задании исправлена'}</span><button class="btn sm ghost" data-a="reportAgain">Всё равно ошибка?</button>`
    : '<span class="muted small">Жалоба записана - ждёт проверки</span>';
  return `<p class="muted small" style="margin:0">В офлайн-версии вопросов к Claude нет - смотри разбор и теорию выше.</p><div class="row">${rep}<button class="linkbtn" data-a="openReports">Жалобы →</button></div>`;
};
const weakErrLink0 = weakErrLink;
weakErrLink = () => { // в «Ошибках» рядом с «Подтянуть» и «Избранным» - ссылка на жалобы
  const n = (state.reports || []).length, w = reportsWaiting().length;
  return weakErrLink0().replace(/<\/div>\s*$/, `<button class="linkbtn" data-a="openReports">⚑ Жалобы${n ? (w ? `: ждут проверки ${w}` : ': все проверены') : ''} →</button></div>`);
};
function dataLinkHTML() {
  const b = state.backupAt, busy = Object.keys(state.ans).length > 0, old = !b || daysTo(b) < -7;
  const t = b ? (old && busy ? 'пора сохранить копию' : `копия от ${fmtD(b)}`) : busy ? 'сохранить копию прогресса' : 'мои данные';
  return `<button class="linkbtn inl" data-a="openData">${t}</button>`;
}
function vData() {
  const n = Object.keys(state.ans).length, errs = errList().filter(e => !e.learned).length, single = !!window.EGE_SINGLE, B = window.EGE_BUILD || {}, before = beforeImport();
  const rd = FIN_W.filter(w => finReadOf(w.id)).length;
  const off = single ? 'Это файл-копия приложения: работает без интернета, пока файл у тебя есть.'
    : OFF.ready ? 'Приложение сохранено на этом устройстве и работает без интернета.'
    : 'Открой приложение один раз с интернетом и подожди несколько секунд - оно сохранится для работы без сети.';
  return `${ui.stack.length ? `<button class="back" data-a="back">${ic('left', 18)} Назад</button>` : ''}
  <header class="stack" style="gap:6px"><div class="kicker">Офлайн-версия</div><h1 class="h1">Мои данные</h1><p class="muted" style="margin:0">Всё, что ты решаешь, хранится только на этом устройстве - интернет и Claude не нужны. Сохраняй копию прогресса раз в неделю: если телефон потеряется или браузер очистится, копия всё вернёт.</p></header>
  <section class="card"><div class="row sb"><h2 class="h2">Сейчас здесь</h2><span class="kicker" style="color:${single || OFF.ready ? 'var(--good)' : 'var(--gold)'}">${single || OFF.ready ? 'без интернета - да' : 'нужен интернет 1 раз'}</span></div>
    <table class="tbl plain"><tbody><tr><td>Ответов</td><td>${n}</td></tr><tr><td>Ошибок учим</td><td>${errs}</td></tr><tr><td>Прочитано произведений</td><td>${rd} из ${FIN_W.length}</td></tr><tr><td>Копилка</td><td>${rub(state.coins)}</td></tr><tr><td>Последняя копия</td><td>${state.backupAt ? fmtD(state.backupAt) : 'ещё не было'}</td></tr></tbody></table>
    <p class="muted small" style="margin:0">${off}</p></section>
  <section class="card"><h2 class="h2">Сохранить копию</h2><p class="muted small" style="margin:0">${isIOS() ? 'Откроется меню «Поделиться» - выбери «Сохранить в Файлы» или отправь себе в мессенджер.' : 'Файл ляжет в «Загрузки». Можно ещё отправить его себе в мессенджер.'}</p>
    <button class="btn primary block" data-a="exportFile">${ic('check', 18)} Сохранить файл копии</button>
    <button class="btn block" data-a="exportCode">Показать копию текстом</button>
    <div id="codeOut" class="stack" style="gap:10px"></div></section>
  <section class="card"><h2 class="h2">Загрузить прогресс</h2><p class="muted small" style="margin:0">Из файла копии - или из файла, который прислал Claude: так переносится прогресс из версии в Claude. Прогресс на этом устройстве заменится, прежний можно будет вернуть.</p>
    <label class="btn primary block" for="impFile">${ic('plus', 18)} Выбрать файл</label><input type="file" id="impFile" accept=".json,application/json,text/plain" hidden>
    <details class="fbd"><summary>Вставить копию текстом</summary><form class="stack" data-f="impCode" style="margin-top:8px"><textarea class="codebox" id="impCode" placeholder="Вставь сюда текст копии"></textarea><button class="btn block">Загрузить из текста</button></form></details>
    ${before ? `<button class="btn ghost block" data-a="importUndo">${ic('repeat', 18)} Вернуть как было до загрузки (${fmtD(before.d)})</button>` : ''}</section>
  ${reportsCardHTML()}
  ${single || isIOS() ? '' : `<section class="card"><h2 class="h2">Приложение одним файлом</h2><p class="muted small" style="margin:0">Запасной вариант для компьютера: один HTML-файл, открывается двойным щелчком в любом браузере, интернет не нужен. Прогресс у файла свой - переноси его копией.</p><a class="btn block" href="ege70-offline.html" download="ege70-offline.html">Скачать файл приложения</a></section>`}
  <section class="card"><h2 class="h2">Как поставить на телефон</h2>
    <p style="margin:0"><b>iPhone:</b> открой ссылку в Safari → «Поделиться» → «На экран «Домой»».</p>
    <p style="margin:0"><b>Android:</b> открой ссылку в Chrome → меню ⋮ → «Установить приложение» или «Добавить на главный экран».</p>
    <p class="muted small" style="margin:0">Дальше открывай значком «ЕГЭ на 70» - и без интернета тоже.${B.version ? ` Версия ${esc(B.version)}` : ''}${B.content ? `, материалы от ${esc(fmtD(B.content))}` : ''}.</p></section>`;
}
Object.assign(A, {
  openData: () => { closeSheet(); go({ v: 'data' }); },
  openGifts: () => go({ v: 'gifts' }),
  openReports: () => { closeSheet(); go({ v: 'reports' }); },
  copyReports: () => copyForClaude(reportsText()),
  copyEssay: () => {
    const d2 = state.draft2, text = String(d2.text || '').trim(); if (words(text) < 30) { toast('Сначала напиши сочинение'); return; }
    copyForClaude(`Проверь моё итоговое сочинение как член комиссии: зачёт или нет по критериям К1-К5, где вода и повторы, какие слова заменить и как сказать точнее.\nТема: ${d2.theme || '(не указана)'}\n\nСочинение (${words(text)} слов):\n${text}`);
  },
  copyPara: () => {
    const P = state.finPara || {}, t = finTopic(P.tid), w = finWork(P.wid), text = String(P.text || '').trim();
    if (words(text) < 15) { toast('Сначала напиши абзац'); return; }
    copyForClaude(`Проверь мой абзац-аргумент для итогового сочинения: верны ли факты, доказывает ли он тему, где вода и повторы, как сказать точнее.\nТема: ${t ? t.text : '-'}\nПроизведение: ${w ? finWorkName(w) : '-'}\n\n${text}`);
  },
  finParaNew: () => { finParaNext(); render(); },
  finParaMine: () => { finParaNext(); finRemember('write'); go({ v: 'final', sub: 'write', part: 'para' }); },
  reportAgain: () => { // ответ уже был, но она всё ещё видит ошибку - жалоба снова ждёт проверки
    const id = ses?.ids?.[ses.i], r = id && state.reports?.find(x => x.id === id); if (!r) return;
    const c = REPORT_CHECKS[id]; if (c) r.after = c.d;
    r.d = today(); r.my = String(ses.last?.my || r.my || '').slice(0, 60); delete r.v;
    save(); render(); toast('Записала - жалоба снова ждёт проверки');
  },
  reload: () => location.reload(),
  finRead: b => {
    const id = b.dataset.id; if (!finWork(id)) return; state.readW = state.readW || {};
    const on = !state.readW[id]; if (on) state.readW[id] = today(); else delete state.readW[id];
    save(); render(); toast(on ? 'Прочитано! Теперь закрепи - тест по этой книге' : 'Сняла отметку «прочитано»');
  },
  finWorkQuiz: b => {
    const w = finWork(b.dataset.id); if (!w) return;
    const key = 'finw:' + w.id; startPool(`«${w.title}»`, TASK_ITEMS[key] || [], finQuizN(w), { key });
  },
  exportFile: async () => {
    const name = `ege70-progress-${today()}.json`, file = new File([backupJSON()], name, { type: 'application/json' });
    const done = () => { state.backupAt = today(); save(); if (ui.route.v === 'data') render(); };
    if (isIOS() && navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file], title: 'Копия прогресса ЕГЭ' }); done(); toast('Копия сохранена'); }
      catch (e) { if (e?.name !== 'AbortError') toast('Не получилось - попробуй «Показать копию текстом»'); }
      return;
    }
    const url = URL.createObjectURL(file), a = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    done(); toast('Файл копии сохранён');
  },
  exportCode: async () => {
    const out = $('#codeOut'); if (!out) return;
    const code = await packState();
    out.innerHTML = `<textarea class="codebox" id="codeBox" readonly>${esc(code)}</textarea><div class="row"><button class="btn sm primary" data-a="copyCode">Скопировать</button><span class="muted small">Сохрани в заметки или отправь себе.</span></div>`;
    state.backupAt = today(); save();
  },
  copyCode: async () => {
    const t = $('#codeBox'); if (!t) return;
    try { await navigator.clipboard.writeText(t.value); toast('Скопировала'); }
    catch { t.focus(); t.select(); try { document.execCommand('copy'); toast('Скопировала'); } catch { toast('Выдели текст и скопируй'); } }
  },
  importYes: () => {
    const s = pendingImp; if (!s) return; pendingImp = null;
    try { localStorage.setItem(LS + '.before', JSON.stringify({ d: today(), json: JSON.stringify(state) })); } catch {}
    state = s; state.importedAt = today(); ses = null; save();
    closeSheet(); ui.tab = 'home'; ui.stack = []; ui.route = { v: 'home' }; render(); window.scrollTo(0, 0);
    toast('Готово: прогресс загружен');
  },
  importUndo: () => {
    const b = beforeImport(), s = b && parseState(b.json); if (!s) return;
    try { localStorage.removeItem(LS + '.before'); } catch {}
    state = s; ses = null; save(); render(); toast('Вернула прогресс, который был до загрузки');
  },
});
{ const t0 = A.finTab, w0 = A.finWork; A.finTab = b => { finRemember(b.dataset.s); t0(b); }; A.finWork = b => { finRemember('works'); w0(b); }; }
const vGifts0 = vGifts;
vGifts = () => (ui.stack.length ? `<button class="back" data-a="back">${ic('left', 18)} Назад</button>` : '') + vGifts0();
document.addEventListener('change', e => {
  if (e.target.id !== 'impFile') return;
  const f = e.target.files?.[0]; e.target.value = ''; if (!f) return;
  if (f.size > 5e6) { toast('Файл слишком большой - это не копия прогресса'); return; }
  f.text().then(importText, () => toast('Не получилось открыть файл'));
});
document.addEventListener('submit', e => {
  if (!e.target.closest('form[data-f="impCode"]')) return;
  e.preventDefault(); const v = $('#impCode')?.value || ''; if (!v.trim()) { toast('Вставь текст копии'); return; } importText(v);
});

/* ---- работа без интернета: service worker (только в версии с сайта; файлу-копии он не нужен) ---- */
const OFF = { ready: false };
function showUpd() {
  if ($('#upd')) return;
  const d = document.createElement('div'); d.id = 'upd'; d.setAttribute('role', 'status');
  d.innerHTML = `<span>Вышло обновление</span><button class="btn sm primary" data-a="reload">Обновить</button>`;
  document.body.appendChild(d);
}
(() => {
  try { navigator.storage?.persist?.(); } catch {}
  if (window.EGE_SINGLE || !('serviceWorker' in navigator) || !/^https?:$/.test(location.protocol)) return;
  const had = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register('sw.js').catch(() => {});
  navigator.serviceWorker.ready.then(() => {
    OFF.ready = true;
    try { if (!localStorage.getItem(LS + '.offline')) { localStorage.setItem(LS + '.offline', '1'); toast('Приложение сохранено - теперь работает без интернета'); } } catch {}
    if (ui.route.v === 'data') safeRender();
  });
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (had) showUpd(); });
})();
