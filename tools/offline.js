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
  /* авторы полностью (tools/content/authors.js): выбрать точное имя и отчество среди похожих - fin-n-<произведение>,
     и карточка «назови полностью» на каждого автора - fin-nc-<первое его произведение> */
  FIN_KIND.n = 'авторы полностью';
  const nameOf = s => { const m = String(s).match(/^(\S+) (\S+вич) (\S+)$/); return m ? { i: m[1], o: m[2], f: m[3] } : null; };
  const NAME_OF = Object.fromEntries(Object.entries(PATRON).map(([n, o]) => [o, n])), named = FIN_W.map(w => nameOf(w.author)).filter(Boolean);
  const traps = full => { // сначала частые путаницы, потом имя и отчество местами, потом имена и отчества других писателей
    const p = nameOf(full); if (!p) return [];
    const out = [...(AUTHOR_TRAPS[full] || [])];
    if (NAME_OF[p.o] && PATRON[p.i] && NAME_OF[p.o] !== p.i) out.push(`${NAME_OF[p.o]} ${PATRON[p.i]} ${p.f}`);
    for (const x of named) if (x.f !== p.f && x.i === p.i && x.o !== p.o) out.push(`${p.i} ${x.o} ${p.f}`);
    for (const x of named) if (x.f !== p.f && x.o === p.o && x.i !== p.i) out.push(`${x.i} ${p.o} ${p.f}`);
    for (const o of ['Сергеевич', 'Николаевич', 'Михайлович', 'Александрович', 'Иванович', 'Петрович']) if (o !== p.o) out.push(`${p.i} ${o} ${p.f}`);
    return uniq(out).filter(x => x !== full);
  };
  const tip = a => AUTHOR_TIPS[a] ? ' ' + AUTHOR_TIPS[a] : '', byAuthor = {};
  for (const w of FIN_W) {
    if (!w.author) continue;
    (byAuthor[w.author] = byAuthor[w.author] || []).push(w);
    const X = AUTHOR_OPTS[w.author], right = X ? X.a : w.author, wrong = X ? X.o : traps(w.author).slice(0, 3);
    if (wrong.length < 3) continue;
    const id = 'fin-n-' + w.id, o = pickN([right, ...wrong], 4, rng(hashStr(id)));
    put('n', { id, type: 'choice', q: X?.q ? X.q(w.title) : `«${w.title}»: кто автор? Выбери точно - имя, отчество и фамилию.`, o, a: o.indexOf(right), ex: `${finNameP(w)} - **${w.author}**.${tip(w.author)}`, work: w.id });
  }
  for (const [a, ws] of Object.entries(byAuthor)) {
    const list = ws.map(w => `«${w.title}»`).join(', '), short = ws[0].authorShort;
    put('n', { id: 'fin-nc-' + ws[0].id, type: 'card', q: `${list} - кто автор? Назови полностью${nameOf(a) ? ': имя, отчество и фамилию' : ''}.`, a, why: [AUTHOR_TIPS[a] || '', short && short !== a ? `На сочинении можно и с инициалами: **${short}**.` : ''].filter(Boolean).join('\n'), work: ws[0].id, works: ws.map(w => w.id) });
  }
  /* тест по произведению: автор, жанр, кто есть кто, аргументы и вопросы FINAL_QUIZ про эту книгу.
     «Чей герой», «чья цитата» и «что подходит к теме» сюда не берём: в тесте по одной книге ответ на них очевиден */
  const st = t => { const s = t.toLowerCase().replace(/ё/g, 'е'), f = s.split(/\s+/)[0]; return f.length > 5 ? f.slice(0, -2) : s.slice(0, 6); };
  const guess = it => { const q = String(it?.q || '').toLowerCase().replace(/ё/g, 'е'); return FIN_W.filter(w => q.includes('«' + st(w.title))).map(w => w.id); };
  const pools = {}, add = (wid, id) => { if (!finWork(wid) || !ITEMS[id]) return; const p = pools[wid] = pools[wid] || []; if (!p.includes(id)) p.push(id); };
  for (const k of ['a', 'g', 'r', 'k', 'n']) for (const id of TASK_ITEMS['fin:' + k] || []) for (const wid of ITEMS[id].works || [ITEMS[id].work]) add(wid, id);
  for (const id of TASK_ITEMS['fin:q'] || []) for (const wid of FQ_WORKS[id] || ITEMS[id].works || guess(ITEMS[id])) add(wid, id);
  for (const w of FIN_W) TASK_ITEMS['finw:' + w.id] = pools[w.id] || [];
}

/* ---- прочитала -> закрепила ---- */
const finReadOf = id => state.readW?.[id] || null;
const finReadWorks = () => FIN_W.filter(w => finReadOf(w.id));
const finDone = w => { const m = mastery('finw:' + w.id); return m.total > 0 && m.pct >= 0.8; };
const finQuizN = w => { const n = (TASK_ITEMS['finw:' + w.id] || []).length; return n <= 20 ? n : 15; };
/* к скольким темам есть аргументы из прочитанного и сколько новых тем закроет книга */
const finCovered = () => { const read = new Set(finReadWorks().map(w => w.id)); return new Set(FIN_T.filter(t => (t.works || []).some(id => read.has(id))).map(t => t.id)); };
const finGain = (w, cov = finCovered()) => FIN_T.filter(t => !cov.has(t.id) && (t.works || []).includes(w.id)).length;
const finShort = w => /рассказ|повесть|стихотворение|сказка/.test(w.genre || '');
/* что дальше: избранное, которое ещё не закреплено; прочитанное, но не закреплённое (тест ниже 80%);
   потом новая книга, которая закроет больше всего новых тем (сначала короткие); потом самое слабое */
function finNextWork() {
  const open = w => !(finReadOf(w.id) && finDone(w)), weak = (a, b) => mastery('finw:' + a.id).pct - mastery('finw:' + b.id).pct;
  const fav = favWorks().map(finWork).filter(Boolean).find(open); if (fav) return fav;
  const fix = finReadWorks().filter(w => !finDone(w)).sort(weak)[0]; if (fix) return fix;
  const cov = finCovered(), next = FIN_W.filter(w => !finReadOf(w.id)).map(w => ({ w, g: finGain(w, cov) }))
    .sort((a, b) => (b.g > 0) - (a.g > 0) || finShort(b.w) - finShort(a.w) || b.g - a.g)[0];
  return next?.w || [...FIN_W].filter(open).sort(weak)[0] || null;
}
/* её прочитанное (31.10.2026 она написала, какие книги прочитала) - отмечаю один раз, дальше отметки только её */
if (!state.readSeed) {
  state.readW = state.readW || {};
  for (const [id, d] of [['prest', '2026-10-29'], ['yushka', '2026-10-29'], ['doktor', '2026-10-29'], ['knopka', '2026-10-31'], ['siren', '2026-10-31'], ['kapdoch', '2026-10-31']]) if (finWork(id) && !state.readW[id]) state.readW[id] = d;
  state.readSeed = today(); save();
}
/* «мои книги»: тест вперемешку по прочитанным и авторы прочитанных - пересчитываются перед каждым показом */
Object.assign(FIN_KIND, { mine: 'мои книги', nmine: 'авторы моих книг' });
function finMinePools() {
  const read = finReadWorks().map(w => w.id), mine = id => { const it = ITEMS[id]; return (it.works || [it.work]).some(w => read.includes(w)); };
  TASK_ITEMS['fin:mine'] = [...new Set(read.flatMap(id => TASK_ITEMS['finw:' + id] || []))];
  TASK_ITEMS['fin:nmine'] = (TASK_ITEMS['fin:n'] || []).filter(mine);
}
finMinePools();
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
  finMinePools();
  const m = mastery('fin:all'), errs = ids.filter(id => state.errors[id] && !state.errors[id].learned).length, read = finReadWorks();
  const kinds = Object.keys(FIN_KIND).filter(k => k !== 'mine' && k !== 'nmine' && (TASK_ITEMS['fin:' + k] || []).length);
  const mineM = mastery('fin:mine'), nM = mastery('fin:nmine');
  const row = w => { const mw = mastery('finw:' + w.id), done = finDone(w); return `<button class="wq" data-a="finWorkQuiz" data-id="${esc(w.id)}"><span style="min-width:0"><b>«${esc(w.title)}»</b> <span class="muted small">${esc(w.authorShort || '')}</span>${finReadOf(w.id) ? ' <span class="okmark">прочитано</span>' : ''}<span class="bar ${done ? '' : 'violet'}" style="height:6px;margin-top:6px;display:block"><i style="width:${mw.pct * 100}%"></i></span></span><span class="wqs num" style="${done ? 'color:var(--good)' : ''}">${mw.ok}/${mw.total}</span></button>`; };
  return `<section class="card" style="border-left:5px solid var(--rose)">
    <div class="row sb"><h2 class="h2">Мои книги</h2><span class="kicker">прочитано ${read.length}</span></div>
    <p class="muted small" style="margin:0">${read.length ? read.map(w => `«${esc(w.title)}»`).join(', ') + '. Тесты только по ним - чтобы закрепить прочитанное.' : 'Отмечай книги «Прочитала» в их карточках - здесь появятся тесты только по ним.'}</p>
    ${read.length ? `<button class="btn primary block" data-a="startKey" data-k="fin:mine" data-n="10">${ic('play', 18)} Мои книги вперемешку <span class="num" style="opacity:.8">${mineM.ok}/${mineM.total}</span></button>
    <button class="btn block" data-a="startKey" data-k="fin:nmine" data-n="10">${ic('pen', 18)} Авторы моих книг <span class="num muted">${nM.ok}/${nM.total}</span></button>` : ''}
    <button class="btn sm ghost" data-a="startKey" data-k="fin:n" data-n="10">Все авторы полностью: ${(TASK_ITEMS['fin:n'] || []).length}</button>
  </section>
  <section class="card">
    <div class="row sb"><span class="kicker">Все книги вперемешку</span><span class="num muted small">${Math.round(m.pct * 100)}%</span></div>
    <div class="big">${m.ok}<span>/${m.total}</span></div><div class="bar"><i style="width:${m.pct * 100}%"></i></div>
    <p class="muted small" style="margin:0">Всё вперемешку: кто автор (полностью - имя, отчество, фамилия), чей герой и кто есть кто, жанр, цитаты, аргументы (вспомни эпизод и вывод), что подходит к теме. В красной тетради: ${errs}.</p>
    <button class="btn primary block" data-a="startKey" data-k="fin:all" data-n="10">${ic('play', 18)} 10 заданий</button>
    ${restBtnHTML('fin:all')}
    <div class="row">${kinds.map(k => `<button class="btn sm" data-a="startKey" data-k="fin:${k}" data-n="10">${FIN_KIND[k][0].toUpperCase() + FIN_KIND[k].slice(1)}: ${TASK_ITEMS['fin:' + k].length}</button>`).join('')}</div>
  </section>
  <section class="card"><div class="row sb"><h2 class="h2">По одному произведению</h2><span class="kicker">${FIN_W.filter(finDone).length} из ${FIN_W.length} сдано</span></div>
    <p class="muted small" style="margin:0">Прочитала карточку - сразу закрепи. Зелёный - тест сдан на 80% и больше.</p>
    <div>${[...FIN_W].sort((a, b) => !!finReadOf(b.id) - !!finReadOf(a.id)).map(row).join('')}</div></section>`;
};

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
  return 'Проверь мои жалобы на задания из приложения «ЕГЭ на 100» (офлайн-версия):\n' + reportsWaiting().map((r, i) => {
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
  ${isIOS() && !single ? `<section class="card"><h2 class="h2">Значок «ЕГЭ на 100»</h2><p class="muted small" style="margin:0">Если на экране «Домой» старый значок «ЕГЭ на 70» - поставь новый. iPhone не меняет его сам.</p>${iconStepsHTML()}<div class="row">${isStandalone() ? `<button class="btn primary" data-a="iconCopy">Скопировать прогресс</button>` : ''}${isStandalone() ? `<button class="btn" data-a="iconPaste">Вставить прогресс</button>` : ''}</div></section>` : ''}
  ${reportsCardHTML()}
  ${single || isIOS() ? '' : `<section class="card"><h2 class="h2">Приложение одним файлом</h2><p class="muted small" style="margin:0">Запасной вариант для компьютера: один HTML-файл, открывается двойным щелчком в любом браузере, интернет не нужен. Прогресс у файла свой - переноси его копией.</p><a class="btn block" href="ege70-offline.html" download="ege70-offline.html">Скачать файл приложения</a></section>`}
  <section class="card"><h2 class="h2">Как поставить на телефон</h2>
    <p style="margin:0"><b>iPhone:</b> открой ссылку в Safari → «Поделиться» → «На экран «Домой»».</p>
    <p style="margin:0"><b>Android:</b> открой ссылку в Chrome → меню ⋮ → «Установить приложение» или «Добавить на главный экран».</p>
    <p class="muted small" style="margin:0">Дальше открывай значком «ЕГЭ на 100» - и без интернета тоже.${B.version ? ` Версия ${esc(B.version)}` : ''}${B.content ? `, материалы от ${esc(fmtD(B.content))}` : ''}.</p></section>`;
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
    finMinePools(); save(); render(); toast(on ? 'Прочитано! Теперь закрепи - тест по этой книге' : 'Сняла отметку «прочитано»');
  },
  finWorkQuiz: b => {
    const w = finWork(b.dataset.id); if (!w) return;
    const key = 'finw:' + w.id; startPool(`«${w.title}»`, TASK_ITEMS[key] || [], finQuizN(w), { key });
  },
  exportFile: async () => {
    const name = `ege100-progress-${today()}.json`, file = new File([backupJSON()], name, { type: 'application/json' });
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

/* ---- русский: теория из методички ФИПИ-2026, новые тексты и задания (tools/content/ru-extra.js) ---- */
for (const [n, blocks] of Object.entries(RU_THEORY_ADD)) { const t = ruTask(+n); if (t) t.theory = [...(t.theory || []), ...blocks]; }
Object.assign(RU_TEXTS, RU_TEXTS_ADD);
for (const it of RU_PRACTICE_ADD) if (!ITEMS[it.id]) addItem('ru:' + it.task, { exc: false, ...it, subj: 'ru' });
for (const it of [...RU_TEXT_ITEMS_ADD, ...RU_EXAM_ADD]) if (!ITEMS[it.id]) addItem('ruE:' + it.task, { exc: false, ...it, subj: 'ru', exam: true });
/* задание 7 в формате 2026 года («исправь ошибку и запиши слово») - и в «Как на ЕГЭ», и в пробнике */
for (const it of RU_PRACTICE_ADD) if (it.task === 7 && !(TASK_ITEMS['ruE:7'] || []).includes(it.id)) (TASK_ITEMS['ruE:7'] = TASK_ITEMS['ruE:7'] || []).push(it.id);
{ /* паронимы «как на ЕГЭ»: e5-g01..g12 собраны из 20 первых слов, каждое по три раза, - из-за них в тестах повторялись
     одни и те же слова (её жалоба 01.11.2026). Убираю их из тренировки (ответы и ошибки по ним остаются)
     и собираю эти 20 слов заново, каждое по одному разу: e5-x01..x04. Остальные 161 слово - в e5-g13.. по одному разу */
  const old = id => /^e5-g(0\d|1[0-2])$/.test(id);
  TASK_ITEMS['ruE:5'] = (TASK_ITEMS['ruE:5'] || []).filter(id => !old(id));
  const P = Array.from({ length: 20 }, (_, i) => ITEMS['r5-' + String(i + 1).padStart(2, '0')]).filter(x => x && x.o?.length === 2 && x.q.includes('…'));
  const R = rng(20261101), ord = pickN(P, P.length, R);
  for (let g = 0, k = 1; g + 5 <= ord.length; g += 5, k++) {
    const five = ord.slice(g, g + 5), bad = Math.floor(R() * 5), id = 'e5-x' + String(k).padStart(2, '0'); if (ITEMS[id]) continue;
    const o = five.map((x, i) => x.q.replace('…', (i === bad ? x.o[1 - x.a] : x.o[x.a]).toUpperCase()));
    addItem('ruE:5', { id, subj: 'ru', task: 5, exam: true, exc: false, type: 'choice', long: true, q: 'В каком предложении выделенное слово употреблено НЕВЕРНО?', o, a: bad,
      ex: `Нужно: ${five[bad].o[five[bad].a].toUpperCase()}. ${five[bad].ex}`,
      parts: five.map((x, i) => ({ n: i + 1, t: o[i], ok: i === bad, v: i === bad ? `ошибка - нужно ${x.o[x.a].toUpperCase()}` : `верно: ${x.o[x.a].toUpperCase()}`, ex: x.ex })) });
  }
  /* словарик: все пары паронимов из тренировки - последним блоком теории задания 5 */
  const t5 = ruTask(5), list = (TASK_ITEMS['ru:5'] || []).map(id => ITEMS[id]).filter(x => x && x.o?.length === 2);
  if (t5 && list.length) {
    const low = w => String(w).toLowerCase(), rows = list.map(x => ({ k: low(x.o[x.a]), t: `**${low(x.o[x.a])}** / ${low(x.o[1 - x.a])} - ${x.ex}` })).sort((a, b) => a.k.localeCompare(b.k, 'ru'));
    t5.theory = [...t5.theory, { h: `Словарик паронимов: все ${rows.length} пар из тренировки`, p: 'Жирным - слово, которое подходит в примере из тренировки.\n' + rows.map(r => r.t).join('\n') }];
  }
}

/* ---- русский: Навигатор ФИПИ-2026 (tools/content/navigator.js; она прислала его 01.11.2026, «всё это просмотри»):
   теория к заданиям, официальные списки и задания на них. id не менять: по ним хранятся ответы ---- */
{
  const th = (n, ...blocks) => { const t = ruTask(n); if (t) t.theory = [...(t.theory || []), ...blocks]; };
  const add = (key, it) => { if (!ITEMS[it.id]) addItem(key, { exc: false, subj: 'ru', ...it }); };
  const nn = (p, i, w = 2) => p + String(i + 1).padStart(w, '0');
  const byLetter = list => { const g = {}; for (const w of list) { const L = w[0].toUpperCase(); (g[L] = g[L] || []).push(w); } return Object.entries(g).map(([L, ws]) => `**${L}:** ${ws.join('; ')}`).join('\n'); };
  for (const [n, blocks] of Object.entries(NAV_THEORY)) th(+n, ...blocks);

  /* 4: начальные формы из списка ФИПИ; после ответа - «Запомни»: вся пара (бородА - бОроду) */
  NAV_STRESS4.forEach(([w, c, note], i) => { if (!STRESS_NOTE[w]) STRESS_NOTE[w] = [0, note]; add('ru:4', { id: nn('n4-', i, 3), task: 4, type: 'stress', w, c }); });

  /* 9: словарные слова ФИПИ */
  th(9, { h: `Навигатор ФИПИ: словарные слова (${NAV_DICT9.length})`, p: 'Непроверяемые безударные гласные в корне - их нельзя проверить, только запомнить. Учи вместе с однокоренными словами (так они и даны).\n' + byLetter(NAV_DICT9) });

  /* 13: слова меры и степени, «далеко не / отнюдь не», НИ */
  for (const it of NAV_ITEMS13) add('ru:13', { task: 13, type: 'choice', ...it });

  /* 14: смысловые пары и сложные прилагательные - по одному; наречия из списков ФИПИ - пятёрками «какие пишутся слитно» */
  NAV_ADV_PAIRS.forEach(([q, a, ex], i) => add('ru:14', { id: nn('n14-p', i), task: 14, type: 'choice', q, o: ['слитно', 'раздельно', 'через дефис'], a, ex: ex + ' (Пример ФИПИ.)' }));
  NAV_ADJ14.forEach(([q, a], i) => {
    const m = q.match(/^\((.+)\)(.+)$/), w = a === 2 ? m[1] + '-' + m[2] : m[1] + m[2];
    add('ru:14', { id: nn('n14-c', i), task: 14, type: 'choice', q, o: ['слитно', 'раздельно', 'через дефис'], a,
      ex: a === 2 ? `${w}: в первой части есть суффикс, части равноправны (можно вставить «и») - через дефис. (Пример ФИПИ.)` : `${w}: в первой части нет суффикса, одна часть подчиняется другой - слитно. (Пример ФИПИ.)` });
  });
  {
    /* без предложения двояко (впервые - в первые дни, сплеча - с плеча, в ходу - к входу): в пятёрки не беру, они только в теории */
    const PRE = ['без', 'во', 'до', 'за', 'из', 'на', 'от', 'по', 'со', 'в', 'к', 'с'], skip = new Set([...NAV_ADV_SKIP, 'всецело', 'назло', 'вправо', 'вдвое', 'втрое', 'натрое', 'напоказ', 'поверху', 'поначалу', 'сплеча', 'вправду', 'впервые', 'вплотную', 'вовсю']);
    const skipApart = new Set(['без толку', 'в ходу', 'за границей', 'за границу']);
    const list = s => s.split(/[.,]/).map(w => w.trim().toLowerCase()).filter(Boolean);
    const tog = list(NAV_ADV_TOGETHER).filter(w => !skip.has(w)).map(w => { const p = PRE.find(p => w.startsWith(p) && w.length - p.length >= 3); return p && { t: `(${p})${w.slice(p.length)}`, w, ok: true }; }).filter(Boolean);
    const apart = list(NAV_ADV_APART).map(w => w.split(' ')).filter(x => x.length === 2 && [...PRE, 'вне', 'про'].includes(x[0]) && !skipApart.has(x.join(' '))).map(x => ({ t: `(${x[0]})${x[1]}`, w: x.join(' '), ok: false }));
    const R = rng(20261104), A = pickN(tog, tog.length, R), B = pickN(apart, apart.length, R), G = Math.ceil((A.length + B.length) / 5);
    for (let g = 0; g < G; g++) {
      const cut = (L, k) => L.slice(Math.round(k * L.length / G), Math.round((k + 1) * L.length / G));
      let five = [...cut(A, g), ...cut(B, g)];
      while (five.length < 5) { const rest = [...A, ...B].filter(x => !five.includes(x) && x.ok === (five.filter(y => y.ok).length < 3)); if (!rest.length) break; five.push(rest[Math.floor(R() * rest.length)]); }
      five = pickN(five.slice(0, 5), 5, R);
      add('ru:14', { id: nn('n14-a', g), task: 14, type: 'multi', q: 'Какие из этих слов пишутся СЛИТНО? Отметь все.', o: five.map(x => x.t), a: five.map((x, i) => x.ok ? i : -1).filter(i => i >= 0),
        ex: five.map(x => `**${x.w}** - ${x.ok ? 'слитно' : 'раздельно'}`).join('; ') + '. Все наречия из списка ФИПИ - в теории задания 14.' });
    }
    th(14, { h: 'Навигатор ФИПИ: наречия, которые пишутся слитно', p: NAV_ADV_TOGETHER }, { h: 'Навигатор ФИПИ: наречные сочетания, которые пишутся раздельно', p: NAV_ADV_APART });
  }

  /* 22: только 23 средства из списка ФИПИ. Оксюморона в списке нет - задания, где он ответ или вариант справа, убираю из тренировки
     (ответы и ошибки по ним остаются), в двух заданиях он был лишь неверным вариантом - заменяю на средство из списка */
  const TERM = Object.fromEntries(NAV_TERMS22.map(([t, , d]) => [t, d])), DEV = NAV_TERMS22.map(t => t[0]);
  const oxy = id => { const x = ITEMS[id]; return !!x && (x.o?.[x.a] === 'оксюморон' || (x.right || []).includes('оксюморон')); };
  for (const k of ['ru:22', 'ruE:22']) if (TASK_ITEMS[k]) TASK_ITEMS[k] = TASK_ITEMS[k].filter(id => !oxy(id));
  for (const [id, to] of [['r22-04', 'эпитет'], ['r22-10', 'метонимия']]) { const x = ITEMS[id], i = x?.o ? x.o.indexOf('оксюморон') : -1; if (i >= 0 && i !== x.a) x.o[i] = to; }
  const R22 = rng(20261102);
  NAV_ITEMS22.forEach(([id, s, a, wrong]) => { const o = pickN([a, ...wrong], 4, R22); add('ru:22', { id, task: 22, type: 'choice', q: 'Какое средство выразительности? ' + s, o, a: o.indexOf(a), ex: `**${a[0].toUpperCase() + a.slice(1)}** - ${TERM[a]}` }); });
  { /* 22 «как на ЕГЭ»: пять примеров и девять средств; в правом столбце нет средств, которые есть и в других примерах.
       Старых e22-g с оксюмороном было 8 из 10 - взамен 14 новых */
    const ALL = NAV_ITEMS22.map(([id, s, a]) => ({ id, s, a })), used = {}, R = rng(20261103);
    for (let k = 0; k < 14; k++) {
      const id = nn('e22-x', k); if (ITEMS[id]) continue;
      let five = null, right = null;
      for (let t = 0; t < 500 && !right; t++) {
        const cand = pickN(ALL, ALL.length, R).sort((x, y) => (t < 250 ? (used[x.id] || 0) - (used[y.id] || 0) : 0)), pick = [];
        for (const x of cand) if (pick.length < 5 && !pick.some(y => y.a === x.a)) pick.push(x);
        const devs = pick.map(x => x.a), also = new Set(pick.flatMap(x => NAV_ALSO22[x.id] || []));
        if (devs.some(d => also.has(d))) continue;
        const pool = DEV.filter(d => !devs.includes(d) && !also.has(d)); if (pool.length < 4) continue;
        five = pick; right = pickN([...devs, ...pickN(pool, 4, R)], 9, R);
      }
      if (!right) continue;
      for (const x of five) used[x.id] = (used[x.id] || 0) + 1;
      add('ruE:22', { id, task: 22, exam: true, type: 'match', pts: 2, q: 'Установите соответствие между примерами и средствами выразительности: к каждому примеру подберите средство из правого столбца.',
        left: five.map(x => x.s), right, a: five.map(x => right.indexOf(x.a)),
        ex: 'Сначала то, что видно сразу: «как, словно, будто» - сравнение; одинаковое начало - анафора, конец - эпифора; вопрос и ответ - вопросно-ответная форма; точка посреди мысли - парцелляция. Потом тропы: похоже - метафора, неживое как живое - олицетворение, рядом - метонимия.',
        parts: five.map((x, i) => ({ n: LET[i], t: x.s, ok: true, v: `${x.a} - это номер ${right.indexOf(x.a) + 1}`, ex: TERM[x.a] })) });
    }
  }
  th(22, { h: 'Навигатор ФИПИ: 23 средства выразительности', p: [['фонетика', 'Звуки (фонетические средства)'], ['лексика', 'Тропы - слово в переносном смысле (лексические средства)'], ['синтаксис', 'Синтаксические средства и приёмы']]
    .map(([g, name]) => `**${name}:**\n` + NAV_TERMS22.filter(t => t[1] === g).map(([t, , d]) => `• **${t}** - ${d}`).join('\n')).join('\n') });

  /* 25: фразеологизмы ФИПИ - список в теории и «выпиши фразеологизм»; тренировка 25 берёт и их, и задания по текстам */
  NAV_ITEMS25.forEach(([id, s, a]) => add('ru:25', { id, task: 25, type: 'input', q: `Выпишите фразеологизм из предложения: «${s}»`, a, ex: `Фразеологизм - «${a[0]}». Он из списка ФИПИ (список - в теории задания 25).` }));
  th(25, { h: `Навигатор ФИПИ: фразеологизмы (${NAV_PHRASEO.length})`, p: 'Фразеологизм - устойчивое сочетание, смысл которого не складывается из смысла слов (кот наплакал = очень мало). Эти фразеологизмы могут встретиться в задании 25; в скобках - варианты.\n' + byLetter(NAV_PHRASEO) });
}

/* ---- обществознание и английский: новые темы и задания (tools/content/soc-extra.js; её просьба 01.11.2026 -
   «английский, общество - тоже не забывать»: в плане у них по два вечера в неделю: вопросы без повторов уже имеющихся) ---- */
for (const [tid, add] of Object.entries(SOC_ADD)) {
  const t = SOC_TOPICS.find(x => x.id === tid); if (!t) continue;
  t.theory = [...(t.theory || []), ...add.theory];
  for (const it of add.items) if (!ITEMS[it.id]) addItem('soc:' + tid, { exc: false, ...it, subj: 'soc', task: tid });
}
{ const pos = id => { const i = SOC_ORDER_IDS.indexOf(id); return i < 0 ? SOC_ORDER_IDS.length : i; }; SOC_TOPICS.sort((a, b) => pos(a.id) - pos(b.id)); }
for (const [sec, items] of Object.entries(EN_ADD)) for (const it of items) if (!ITEMS[it.id]) addItem('en:' + sec, { exc: false, ...it, subj: 'en', task: sec });

/* ---- значок «ЕГЭ на 100» на iPhone (её просьба 01.11.2026: «хочу, чтобы сама иконка была 100»).
   iPhone запоминает значок при установке, а у каждого установленного значка своё хранилище.
   Поэтому: поставить новый значок из Safari, в старом нажать «Скопировать прогресс», в новом - «Вставить прогресс» ---- */
const isStandalone = () => navigator.standalone === true || !!window.matchMedia?.('(display-mode: standalone)').matches;
const isFreshProgress = () => !Object.keys(state.ans || {}).length && !state.importedAt && !(state.coins > 0);
let iconMovePending = false;
const ICON_SITE = 'ddds555.github.io/dds55555';
function iconStepsHTML() {
  return `<ol class="isteps">
    <li><b>Поставь новый значок.</b> Открой <b>Safari</b> и зайди на <b>${ICON_SITE}</b> → внизу «Поделиться» (квадрат со стрелкой вверх) → «На экран „Домой“» → «Добавить». Появится второй значок - «ЕГЭ на 100».</li>
    <li><b>Скопируй прогресс.</b> Вернись в старый значок и нажми «Скопировать прогресс».</li>
    <li><b>Вставь прогресс.</b> Открой новый значок «ЕГЭ на 100» → на главной «Вставить прогресс» → «Вставить» → «Загрузить».</li>
    <li><b>Удали старый значок.</b> Проверь, что всё на месте, потом подержи палец на старом значке → «Удалить закладку».</li>
  </ol>`;
}
/* карточка на главной: в старом значке - как поставить новый, в новом (пустом) - вставить прогресс, в Safari - как добавить значок */
function iconCardHTML() {
  if (!isIOS() || state.iconDone || window.EGE_SINGLE) return '';
  if (!isStandalone()) return `<section class="card icard"><div class="row sb"><h2 class="h2">Значок «ЕГЭ на 100»</h2></div><p style="margin:0">Ты в Safari. Нажми внизу «Поделиться» (квадрат со стрелкой) → «На экран „Домой“» → «Добавить». Потом открой новый значок «ЕГЭ на 100».</p><button class="btn sm ghost" data-a="iconHow">Все шаги</button></section>`;
  if (isFreshProgress()) return `<section class="card icard"><h2 class="h2">Это новый значок «ЕГЭ на 100»?</h2><p style="margin:0">Перенеси прогресс из старого значка: открой старый значок, нажми там «Скопировать прогресс», вернись сюда и нажми:</p><button class="btn primary block" data-a="iconPaste">${ic('plus', 18)} Вставить прогресс</button><button class="btn sm ghost" data-a="iconSkip">Начать с нуля</button></section>`;
  return `<section class="card icard"><div class="row sb"><h2 class="h2">Значок «100» на экране «Домой»</h2></div><p style="margin:0">iPhone не меняет значок сам. Поставь новый - это 2 минуты, прогресс не пропадёт.</p><div class="row"><button class="btn primary" data-a="iconHow">Как поставить</button><button class="btn" data-a="iconCopy">Скопировать прогресс</button><button class="btn sm ghost" data-a="iconSkip">Не нужно</button></div></section>`;
}
async function iconPasteText(t) {
  if (!String(t || '').trim()) { toast('Буфер пустой - сначала нажми «Скопировать прогресс» в старом значке'); return; }
  iconMovePending = true; await importText(t);
}
Object.assign(A, {
  iconHow: () => openSheet(`<h2 class="h2">Значок «100» на экране «Домой»</h2><p class="muted small" style="margin:0">iPhone не меняет значок сам, поэтому ставим новый. Старый удаляешь в самом конце - прогресс не пропадёт.</p>${iconStepsHTML()}
    ${isStandalone() && !isFreshProgress() ? `<button class="btn primary block" data-a="iconCopy">${ic('check', 18)} Скопировать прогресс (шаг 2)</button>` : ''}
    ${isStandalone() && isFreshProgress() ? `<button class="btn primary block" data-a="iconPaste">${ic('plus', 18)} Вставить прогресс (шаг 3)</button>` : ''}
    <button class="btn block" data-a="closeSheet">Закрыть</button>`),
  iconCopy: () => {
    const t = backupJSON();
    navigator.clipboard?.writeText(t).then(() => { closeSheet(); toast('Прогресс скопирован. Теперь открой новый значок «ЕГЭ на 100» и нажми «Вставить прогресс»'); },
      () => openSheet(`<h2 class="h2">Скопируй прогресс</h2><p class="muted small" style="margin:0">Нажми на поле, «Выбрать все» → «Скопировать». Потом открой новый значок.</p><textarea class="codebox" readonly>${esc(t)}</textarea><button class="btn block" data-a="closeSheet">Готово</button>`))
      || toast('Не получилось скопировать');
  },
  iconPaste: () => {
    const manual = () => openSheet(`<h2 class="h2">Вставь прогресс</h2><p class="muted small" style="margin:0">Подержи палец в поле → «Вставить», потом «Загрузить».</p><form class="stack" data-f="iconPaste"><textarea class="codebox" id="iconPasteBox" placeholder="Сюда - скопированный прогресс"></textarea><button class="btn primary block">Загрузить</button></form>`);
    if (!navigator.clipboard?.readText) { manual(); return; }
    navigator.clipboard.readText().then(iconPasteText, manual);
  },
  iconSkip: () => { state.iconDone = today(); save(); render(); },
});
{ const y0 = A.importYes; A.importYes = b => { const mv = iconMovePending; iconMovePending = false; y0(b); if (mv) { state.iconDone = today(); save(); render(); toast('Готово: прогресс перенесён. Старый значок можно удалить'); } }; }
document.addEventListener('submit', e => {
  if (!e.target.closest('form[data-f="iconPaste"]')) return;
  e.preventDefault(); const v = $('#iconPasteBox')?.value || ''; iconPasteText(v);
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
