#!/usr/bin/env python3
"""Собирает офлайн-приложение «ЕГЭ на 100» из HTML артефакта «ЕГЭ на 70» в Claude.

    python3 tools/build.py

Читает source/ege70-artifact.html и source/source.json, пишет в docs/:
  index.html            - приложение (PWA): ставится на телефон значком и работает без интернета
  sw.js                 - service worker: хранит приложение на устройстве
  manifest.webmanifest  - имя, значок и цвета для установки на телефон
  ege70-offline.html    - то же приложение одним файлом - для компьютера и про запас
Шрифт системный (своих шрифтов нет), значки лежат в docs/icons (их рисует tools/make-icons.cjs).

Код и материалы артефакта не переписываются: сборщик точечно меняет несколько мест (PATCHES - каждое
должно найтись ровно один раз, иначе сборка останавливается) и вставляет перед «старт» новые материалы
из tools/content (CONTENT), tools/offline.js и tools/plan.js (план дня и главный экран).
"""
import base64
import hashlib
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / 'source' / 'ege70-artifact.html'
META = ROOT / 'source' / 'source.json'
TOOLS = ROOT / 'tools'
OUT = ROOT / 'docs'

START = '/* ================= старт ================= */'
# Шрифт - системный (на iPhone San Francisco): 04.11.2026 она попросила «нормальный шрифт» вместо Unbounded и Manrope.
# Переменные --display и --body переопределены в tools/offline.css, свои шрифты приложение больше не грузит
# (Unbounded и Manrope остались только для рисования значка: tools/icon-fonts, tools/make-icons.cjs).
ICONS = ['icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png']
# материалы офлайн-версии: подробные пересказы, новые произведения, слова и связки, авторы, русский (ФИПИ-2026, тексты, задания)
CONTENT = ['details-a.js', 'details-b.js', 'extra-works.js', 'words.js', 'authors.js', 'ru-extra.js', 'navigator.js', 'soc-extra.js', 'soc-ege.js', 'en-ege.js']
# название приложения (31.10.2026 она попросила «ЕГЭ на 100»: «на сотку»); в артефакте - «ЕГЭ на 70»
APP_TITLE = 'ЕГЭ на 100'

BACK = '<button class="back" data-a="back">${ic(\'left\', 18)} Назад</button>'

# (что меняем, было, стало)
PATCHES = [
    # ---- задания из файлов по любому предмету (04.11.2026: обществознание 30 вариантов ФИПИ, русский 36 вариантов) ----
    ('тексты к заданиям 17-20 по обществознанию - отдельно от русских (их случайно берут пробник и «вперемешку» по русскому)',
     "const textOf = it => it.text ? (RU_TEXTS[it.text] || EN_TEXTS[it.text]) : null;",
     "const SOC_TEXTS = {}; // тексты к заданиям 17-20 по обществознанию из файлов-пакетов (tools/offline.js)\n"
     "const textOf = it => it.text ? (RU_TEXTS[it.text] || EN_TEXTS[it.text] || SOC_TEXTS[it.text]) : null;"),
    ('подпись задания из файла задаёт сам пакет (it.lbl: «Общество · задание 9»)',
     "const itemLabel = it => it.subj === 'ru' ?",
     "const itemLabel = it => it.lbl ? it.lbl : it.subj === 'ru' ?"),
    ('«Подтянуть» для заданий ЕГЭ по обществознанию из файла - по номеру задания (socE:N)',
     "const weakKeyOf = it => it && ['ru', 'soc', 'en'].includes(it.subj) && it.task != null ? it.subj + ':' + it.task : null;",
     "const weakKeyOf = it => it && it.pk && it.subj === 'soc' ? 'socE:' + it.task : it && ['ru', 'soc', 'en'].includes(it.subj) && it.task != null ? it.subj + ':' + it.task : null;"),
    ('короткое имя «задание N» и для socE',
     "const weakShort = key => { const [s, t] = String(key).split(':'); return s === 'ru' ?",
     "const weakShort = key => { const [s, t] = String(key).split(':'); return s === 'ru' || s === 'socE' ?"),
    ('теория для socE:N - тема обществознания, к которой относится номер задания',
     "const weakTheoryRoute = key => { const [s, t] = String(key).split(':'); return s === 'ru' ? { v: 'task', n: +t, sub: 'theory' } :",
     "const weakTheoryRoute = key => { const [s, t] = String(key).split(':'); return s === 'socE' ? { v: 'topic', id: SOC_TASK_TOPIC[t] || 'ege', sub: 'theory' } : s === 'ru' ? { v: 'task', n: +t, sub: 'theory' } :"),
    ('в «Подтянуть» задания socE стоят вместе с темами обществознания',
     "return s === 'soc' ? 1000 : 2000;",
     "return s === 'soc' || s === 'socE' ? 1000 : 2000;"),
    ('название тренировки socE:N',
     "s === 'ruE' ? `Задание ${t} · как на ЕГЭ` :",
     "s === 'ruE' ? `Задание ${t} · как на ЕГЭ` : s === 'socE' ? `Общество · задание ${t}` :"),
    ('пробник по русскому: текст только из встроенных (у текстов из файла задания 1-3 и 23-26 разнесены - пробник вышел бы неполным)',
     "const TK = Object.keys(RU_TEXTS), T = TK[Math.floor(Math.random() * TK.length)], ids = [];",
     "const TK = Object.keys(RU_TEXTS).filter(k => !PACK_TEXT_IDS.has(k)), T = TK[Math.floor(Math.random() * TK.length)], ids = [];"),
    ('часть 2 с развёрнутым ответом (open): пишет ответ, сверяет с образцом ФИПИ, ставит себе баллы',
     "  let fbh = '';\n  if (fb) {",
     "  if (it.type === 'open') q = openHTML(it, fb);\n  let fbh = '';\n  if (fb) {"),
    ('часть 2 (open): заголовок разбора - её баллы, без строки «Правильно: ...» (образец уже показан выше)',
     ": 'Ошибка - записала в красную тетрадь'}",
     ": it.type === 'open' ? `${esc(L.my || '')} - записала в красную тетрадь, вернёмся к нему` : 'Ошибка - записала в красную тетрадь'}"),
    ('соответствие: 1 балл из 2 - только за одну ошибку (как на ЕГЭ), в пробнике тоже',
     "ses.score += ok ? p : (p === 2 && part >= 3 ? 1 : 0); }",
     "ses.score += ok ? p : (p === 2 && it.left && part >= it.left.length - 1 ? 1 : 0); }"),
    ('соответствие: «почти» - только за одну ошибку',
     "part: !ok && part >= 3 ? part : 0 };",
     "part: !ok && it.left && part >= it.left.length - 1 ? part : 0 };"),
    ('соответствие за 1 балл (обществознание, задание 3): одна ошибка - уже 0 баллов',
     "L.part ? `Почти: ${L.part} из ${it.left.length} - на ЕГЭ это 1 балл из 2` :",
     "L.part ? `Почти: ${L.part} из ${it.left.length} - ${it.pts === 1 ? 'на ЕГЭ за это задание 0 баллов: нужно всё верно' : 'на ЕГЭ это 1 балл из 2'}` :"),
    ('соответствие за 1 балл: без «добьём до 2 баллов»',
     "'<p class=\"small\">Записала в красную тетрадь - добьём до 2 баллов.</p>' : ''}",
     "`<p class=\"small\">Записала в красную тетрадь - добьём до ${it.pts === 1 ? 'верного ответа' : '2 баллов'}.</p>` : ''}"),
    ('старт после загрузки заданий из файлов (они в IndexedDB, читаются асинхронно)',
     "resumeFromState(true); // незаконченная тренировка или пробник: свежая - открыть на том же месте, давняя - карточкой на главной\nrender();",
     "startAfterPacks(() => { resumeFromState(true); render(); }); // незаконченная тренировка или пробник: свежая - открыть на том же месте, давняя - карточкой на главной"),
    ('соответствие: второй допустимый ответ (it.alt) засчитывается и подсвечивается зелёным',
     "const cls = fb ? (it.a[i] === j ? 'good' : on ? 'bad' : '') : on ? 'on' : '';",
     "const cls = fb ? (it.a[i] === j || (on && matchOk(it, i, j)) ? 'good' : on ? 'bad' : '') : on ? 'on' : '';"),
    ('несколько ответов (2, 3, 21, 23, 24...): другой допустимый набор (it.altA) тоже засчитывается',
     "checkMulti: () => { const it = getItem(ses.ids[ses.i]); const a = [...it.a].sort().join(','), s = [...ses.sel].sort().join(','); answer(a === s,",
     "checkMulti: () => { const it = getItem(ses.ids[ses.i]); const a = [...it.a].sort().join(','), s = [...ses.sel].sort().join(','); answer(a === s || multiGood(it) !== it.a,"),
    ('несколько ответов, строки: засчитанный другой набор подсвечивается зелёным',
     "<div class=\"stack\" style=\"gap:8px\">${it.o.map((o, i) => { const on = ses.sel.includes(i); const cls = fb ? (it.a.includes(i) ? 'good'",
     "<div class=\"stack\" style=\"gap:8px\">${it.o.map((o, i) => { const on = ses.sel.includes(i); const cls = fb ? (multiGood(it).includes(i) ? 'good'"),
    ('несколько ответов, цифры: засчитанный другой набор подсвечивается зелёным',
     "<div class=\"digs\">${it.o.map((o, i) => { const on = ses.sel.includes(i); const cls = fb ? (it.a.includes(i) ? 'good'",
     "<div class=\"digs\">${it.o.map((o, i) => { const on = ses.sel.includes(i); const cls = fb ? (multiGood(it).includes(i) ? 'good'"),
    ('соответствие: подсчёт верных букв с учётом it.alt',
     'const n = it.a.filter((r, i) => ms[i] === r).length;',
     'const n = it.a.filter((r, i) => matchOk(it, i, ms[i])).length;'),
    ('вкладка «Сочинение» вместо «Подарков» (подарки - с карточки «Копилка» на главной)',
     "const TABS = [['home', 'Сегодня', 'home'], ['ru', 'Русский', 'book'], ['soc', 'Общество', 'scale'], ['en', 'English', 'globe'], ['err', 'Ошибки', 'note'], ['gifts', 'Подарки', 'gift']];",
     "const TABS = [['home', 'Сегодня', 'home'], ['final', 'Сочинение', 'pen'], ['ru', 'Русский', 'book'], ['soc', 'Общество', 'scale'], ['en', 'English', 'globe'], ['err', 'Ошибки', 'note']];"),
    ('вкладка «Сочинение» открывается на разделе, где была в прошлый раз',
     'function setTab(t) { ui.tab = t; ui.stack = []; ui.route = { v: t };',
     "function setTab(t) { ui.tab = t; ui.stack = []; ui.route = t === 'final' ? { v: t, sub: finLastSub() } : { v: t };"),
    ('экраны «Мои данные», «Жалобы на задания» и варианты из её файла',
     "r.v === 'fav' ? vFav() : vHome()",
     "r.v === 'fav' ? vFav() : r.v === 'data' ? vData() : r.v === 'reports' ? vReports() : r.v === 'pack' ? vPack(r) : vHome()"),
    ('жалоба «Здесь ошибка?» без Claude: где её потом смотреть',
     "s.textContent = caps.sample ? 'Записала. Проверяю задание…' : 'Записала: проверю это задание';",
     "s.textContent = caps.sample ? 'Записала. Проверяю задание…' : 'Жалоба записана - она во вкладке «Ошибки» → «Жалобы»';"),
    ('итоговое сочинение: на вкладке «Назад» не нужен',
     BACK + '\n  <header class="stack" style="gap:6px"><div class="kicker">${fd >= 0',
     '${ui.stack.length ? `' + BACK + '` : \'\'}\n  <header class="stack" style="gap:6px"><div class="kicker">${fd >= 0'),
    ('итоговое сочинение: вкладка «Слова» - синонимы, связки, как убрать воду (её просьба 29.10.2026)',
     "['topics', 'Темы'], ['quiz', 'Тренировка'],",
     "['topics', 'Темы'], ['words', 'Слова'], ['quiz', 'Тренировка'],"),
    ('итоговое сочинение: экран вкладки «Слова»',
     "  else if (sub === 'quiz') body = finQuizHTML();",
     "  else if (sub === 'quiz') body = finQuizHTML();\n  else if (sub === 'words') body = finWordsHTML();"),
    ('пробник: уровни 90 и 100',
     "${p >= 25 ? 'Уровень 80 баллов!' : p >= 22 ? 'Уровень 70 баллов есть!' : 'Хорошая точка отсчёта'}",
     "${p >= 28 ? 'Тест без единой ошибки - путь к 100!' : p >= 27 ? 'Уровень 90+!' : p >= 25 ? 'Уровень 80 баллов!' : p >= 22 ? 'Уровень 70 баллов есть!' : 'Хорошая точка отсчёта'}"),
    ('пробник: сколько нужно на 90 и 100',
     'Для 70 нужно около 38 первичных из 50, для 80 - около 43. Шкала 2026 года, примерно.',
     'Для 70 нужно около 38 первичных из 50, для 80 - около 43, для 90 - около 47, для 100 - все 50. Шкала 2026 года, примерно.'),
    ('сочинение ЕГЭ: сколько нужно на 90 и 100',
     'Для 70 баллов нужно примерно 16 из 22.',
     'Для 70 баллов нужно примерно 16 из 22, для 90 - около 20, для 100 - все 22.'),
    ('состояние: отметки «прочитано»',
     'favW: {}, finPara: null, mixSeen: {},',
     'favW: {}, readW: {}, finPara: null, mixSeen: {},'),
    ('состояние: отметки «прочитано» в старых сохранениях',
     "if (!s.favW || typeof s.favW !== 'object') s.favW = {};",
     "if (!s.favW || typeof s.favW !== 'object') s.favW = {};\n  if (!s.readW || typeof s.readW !== 'object') s.readW = {};"),
    ('название тренировки по одному произведению',
     "s === 'fin' ? (FIN_KIND[t] ?",
     "s === 'finw' ? (finWork(t) ? `«${finWork(t).title}»` : 'Произведение') : s === 'fin' ? (FIN_KIND[t] ?"),
    ('карточка-самопроверка: пояснение с жирным',
     '<b>Ответ:</b> ${esc(it.a)}${it.why ? `\\n${esc(it.why)}` : \'\'}',
     '<b>Ответ:</b> ${esc(it.a)}${it.why ? `<br>${md(it.why)}` : \'\'}'),
    ('карточка-самопроверка и часть 2 (open): ответ уже был на экране - «Правильно» не повторяем',
     "${L.ok ? '' : `<p class=\"right\">",
     "${L.ok || it.type === 'card' || it.type === 'open' ? '' : `<p class=\"right\">"),
    # без Claude: вместо проверки Claude - кнопки «Проверить в ChatGPT» (gptBox в tools/offline.js) и честные подписи
    ('без Claude: вопросы к заданию',
     'Объяснения и вопросы Claude работают, когда программа открыта по ссылке или значком на рабочем столе.',
     'Объяснения - в ChatGPT: кнопка «Спросить ChatGPT».'),
    ('без Claude: сочинение ЕГЭ → ChatGPT',
     "'<p class=\"muted small\" style=\"margin:0\">Проверка через Claude работает в приложении Claude. Пока - самопроверка по галочкам выше.</p>'",
     "gptBox('ess27')"),
    ('без Claude: абзац-аргумент',
     ' Claude проверит факты и логику.</p>',
     ' Потом проверь его в ChatGPT (кнопка под абзацем) или сверь с карточкой произведения.</p>'),
    ('без Claude: абзац-аргумент → ChatGPT',
     "'<p class=\"muted small\" style=\"margin:0\">Проверка Claude работает, когда программа открыта по ссылке или значком на рабочем столе. Пока - сравни свой абзац с карточкой произведения.</p>'",
     "gptBox('para')"),
    ('без Claude: итоговое сочинение → ChatGPT',
     "'<p class=\"muted small\" style=\"margin:0\">Проверка через Claude работает в приложении Claude. Пока - самопроверка по галочкам.</p>'",
     "gptBox('ess')"),
    ('без Claude: английский, письмо и эссе → ChatGPT',
     "'<p class=\"muted small\" style=\"margin:0\">Проверка через Claude работает в приложении Claude.</p>'",
     "gptBox('en', s.id)"),
    ('английский, письмо и эссе: выбор задания (из программы или по образцу ФИПИ)',
     '<div class="kicker">Задание</div><p style="margin:0;line-height:1.6">${esc(s.task)}</p>',
     '${enTaskHTML(s)}'),
    ('без Claude: английский, список',
     "'шаблон и проверка Claude'",
     "'шаблон и проверка в ChatGPT'"),
    ('без Claude: «Объясни с нуля»',
     "Объяснения Claude работают в приложении Claude - открой программу по ссылке или значком",
     "Внизу теории - «Спросить ChatGPT»"),
    ('без Claude: шаги итогового сочинения',
     "сочинение целиком с проверкой Claude'",
     "сочинение целиком с проверкой в ChatGPT'"),
    ('без Claude: «Продолжить» сочинение',
     'черновик и проверка Claude.',
     'черновик и проверка в ChatGPT.'),
    # критерии ЕГЭ-2026 (задание 27): К6 - этика, К7-К10 - орфография, пунктуация, грамматика, речь (в артефакте порядок был сбит)
    ('сочинение ЕГЭ: нумерация критериев как у ФИПИ',
     'К6 - орфография: 3\\nК7 - пунктуация: 3\\nК8 - грамматика: 3\\nК9 - речь: 3\\nК10 - этика: 1',
     'К6 - этические нормы: 1\\nК7 - орфография: 3\\nК8 - пунктуация: 3\\nК9 - грамматика: 3\\nК10 - речевые нормы: 3'),
]

# Правки материалов: разбор, который объясняет каждую запятую (её вопрос 28.10.2026 - «почему там запятые после что»).
# В JS-строках \\n - перенос строки, **...** - жирный.
CONTENT_FIXES = [
    ('задание 20, r20-01: разбор по каждой запятой',
     "ex: 'Дальше есть «то» - на стыке «что если» запятая не нужна.' }",
     "ex: 'Я думаю, что если ты постараешься, то всё получится.\\n**(1)** перед «что» - начинается придаточное «что… всё получится».\\n**(3)** после «постараешься» - кончается придаточное «если ты постараешься».\\n**(2)** между «что» и «если» запятой нет: дальше есть «то». Проверка: убери «если ты постараешься» - получится «что то всё получится», предложение ломается, значит, запятая не нужна.' }"),
    ('задание 20, r20-02: разбор по каждой запятой',
     "ex: '«То» нет - запятая на стыке союзов нужна.' }",
     "ex: 'Я думаю, что, если ты постараешься, всё получится.\\n**(1)** перед «что» - начинается придаточное.\\n**(2)** между «что» и «если» запятая нужна: дальше нет «то». Проверка: убери «если ты постараешься» - «Я думаю, что всё получится» - не сломалось, значит, запятая есть.\\n**(3)** после «постараешься» - кончается придаточное «если ты постараешься».' }"),
    ('задание 20, r20-03: разбор по каждой запятой',
     "ex: 'Шёл дождь, и, когда мы вышли, стало холодно.' }",
     "ex: 'Шёл дождь, и, когда мы вышли, стало холодно.\\n**(1)** перед «и» - соединяются две части: «шёл дождь» и «стало холодно».\\n**(2)** между «и» и «когда» запятая нужна: дальше нет «то». Проверка: убери «когда мы вышли» - «Шёл дождь, и стало холодно» - не сломалось.\\n**(3)** после «вышли» - кончается придаточное «когда мы вышли».' }"),
    ('задание 20, r20-04: разбор по каждой запятой',
     "ex: 'Нет «то» - запятая между «что» и «когда» нужна.' }",
     "ex: 'Мама сказала, что, когда я вернусь, мы пойдём гулять.\\n**(1)** перед «что» - начинается придаточное.\\n**(2)** между «что» и «когда» запятая нужна: дальше нет «то». Проверка: убери «когда я вернусь» - «Мама сказала, что мы пойдём гулять» - не сломалось.\\n**(3)** после «вернусь» - кончается придаточное «когда я вернусь».' }"),
    ('задание 20, r20-05: разбор по каждой запятой',
     "ex: 'Есть «то» - на стыке запятая не нужна.' }",
     "ex: 'Она знала, что если опоздает, то её не пустят.\\n**(1)** перед «что» - начинается придаточное.\\n**(2)** между «что» и «если» запятой нет: дальше есть «то». Проверка: убери «если опоздает» - «Она знала, что то её не пустят» - ломается.\\n**(3)** после «опоздает» - кончается придаточное «если опоздает».' }"),
    ('задание 20, r20-06: разбор по каждой запятой',
     "ex: 'Было тихо, и, если прислушаться, можно было услышать ручей.' }",
     "ex: 'Было тихо, и, если прислушаться, можно было услышать ручей.\\n**(1)** перед «и» - соединяются две части: «было тихо» и «можно было услышать ручей».\\n**(2)** между «и» и «если» запятая нужна: дальше нет «то». Проверка: убери «если прислушаться» - «Было тихо, и можно было услышать ручей» - не сломалось.\\n**(3)** после «прислушаться» - кончается придаточное «если прислушаться».' }"),
]


def fail(msg):
    sys.exit('Сборка остановлена: ' + msg)


def patch(text, old, new, label):
    n = text.count(old)
    if n != 1:
        fail(f'«{label}» - ожидалось одно совпадение, найдено {n}. Артефакт изменился - поправь PATCHES в tools/build.py')
    return text.replace(old, new)


def split_source(html):
    """Артефакт: обёртка <head> со стилем по умолчанию, потом в <body> - title, шрифты, стиль, разметка, скрипт."""
    m = re.search(r'<head>(.*?)</head>\s*<body>(.*)</body>', html, re.S)
    if not m:
        fail('не нашла <head> и <body> в артефакте')
    head, body = m.groups()
    base = re.search(r'<style>(.*?)</style>', head, re.S)
    title = re.search(r'<title>(.*?)</title>', body, re.S)
    css = re.search(r'<style>(.*?)</style>', body, re.S)
    js = re.search(r'<script>(.*)</script>', body, re.S)
    if not (base and title and css and js):
        fail('не нашла стиль, заголовок или скрипт артефакта')
    markup = body[css.end():js.start()].strip()
    return base.group(1), title.group(1).strip(), css.group(1), markup, js.group(1)


def page(base, title, css, markup, js, build, single):
    icon = ('data:image/png;base64,' + base64.b64encode((OUT / 'icons' / 'icon-192.png').read_bytes()).decode()) if single else 'icons/icon-192.png'
    pwa = '' if single else (
        '<link rel="manifest" href="manifest.webmanifest">\n'
        '<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">\n')
    flags = json.dumps(build, ensure_ascii=False)
    return f'''<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>{title}</title>
<meta name="description" content="Подготовка к итоговому сочинению и ЕГЭ: русский, обществознание, английский. Работает без интернета.">
<meta name="theme-color" content="#F7F0F3" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#161015" media="(prefers-color-scheme: dark)">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="{title}">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<link rel="icon" type="image/png" href="{icon}">
{pwa}<style>{base}</style>
<style>{css}</style>
</head>
<body>
{markup}
<script>window.EGE_BUILD = {flags};{' window.EGE_SINGLE = true;' if single else ''}</script>
<script>{js}</script>
</body>
</html>
'''


def main():
    html = SRC.read_text(encoding='utf-8')
    meta = json.loads(META.read_text(encoding='utf-8'))
    base, _, css, markup, js = split_source(html)
    title = APP_TITLE
    if re.search(r'fonts\.googleapis|fonts\.gstatic', css + markup + js):
        fail('в стиле или скрипте осталась ссылка на Google Fonts')

    for label, old, new in PATCHES + CONTENT_FIXES:
        js = patch(js, old, new, label)
    # ответы на жалобы «Здесь ошибка?» - данные для tools/offline.js
    checks = {k: v for k, v in json.loads((TOOLS / 'report-checks.json').read_text(encoding='utf-8')).items() if not k.startswith('_')}
    content = ''.join((TOOLS / 'content' / n).read_text(encoding='utf-8').rstrip() + '\n\n' for n in CONTENT)
    offline = (content + 'const REPORT_CHECKS = ' + json.dumps(checks, ensure_ascii=False) + ';\n'
               + (TOOLS / 'offline.js').read_text(encoding='utf-8').rstrip() + '\n\n'
               + (TOOLS / 'plan.js').read_text(encoding='utf-8'))
    js = patch(js, START, offline.rstrip() + '\n\n' + START, 'вставка tools/offline.js и tools/plan.js перед «старт»')
    css = css.rstrip() + '\n' + (TOOLS / 'offline.css').read_text(encoding='utf-8')
    # у системного шрифта 800 - это Heavy, слишком жирно для текста: везде, где в стиле 800, ставим 700 (Bold)
    css = re.sub(r'\b(font-weight:\s*|font:\s*)800\b', r'\g<1>700', css)

    for name in [f'icons/{n}' for n in ICONS]:
        if not (OUT / name).is_file():
            fail(f'нет файла docs/{name}' + (' - запусти node tools/make-icons.cjs' if name.startswith('icons/') else ''))

    # версия = хеш всего, из чего собрано приложение: меняется только когда что-то поменялось
    h = hashlib.sha256()
    for part in (html, json.dumps(meta, sort_keys=True), offline, css,
                 (TOOLS / 'build.py').read_text(encoding='utf-8'), (TOOLS / 'sw.template.js').read_text(encoding='utf-8')):
        h.update(part.encode('utf-8'))
    for name in [f'icons/{n}' for n in ICONS]:
        h.update((OUT / name).read_bytes())
    version = h.hexdigest()[:10]
    build = {'version': version, 'content': meta.get('updated', ''), 'source': meta.get('version', '')}

    (OUT / 'index.html').write_text(page(base, title, css, markup, js, build, single=False), encoding='utf-8')
    (OUT / 'ege70-offline.html').write_text(page(base, title, css, markup, js, build, single=True), encoding='utf-8')

    manifest = {
        'id': './', 'name': title, 'short_name': title, 'lang': 'ru', 'dir': 'ltr',
        'description': 'Подготовка к итоговому сочинению и ЕГЭ. Работает без интернета.',
        'start_url': './', 'scope': './', 'display': 'standalone',
        'background_color': '#F7F0F3', 'theme_color': '#F7F0F3',
        'icons': [
            {'src': 'icons/icon-192.png', 'sizes': '192x192', 'type': 'image/png'},
            {'src': 'icons/icon-512.png', 'sizes': '512x512', 'type': 'image/png'},
            {'src': 'icons/icon-maskable-512.png', 'sizes': '512x512', 'type': 'image/png', 'purpose': 'maskable'},
        ],
    }
    (OUT / 'manifest.webmanifest').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

    # приложение ('./' - это index.html) и значки; файл-копия для компьютера в кэш телефона не нужен
    assets = ['./', 'manifest.webmanifest'] + [f'icons/{n}' for n in ICONS]
    sw = (TOOLS / 'sw.template.js').read_text(encoding='utf-8')
    sw = patch(sw, "'__VERSION__'", json.dumps(version), 'версия в sw.js')
    sw = patch(sw, '[/* __ASSETS__ */]', json.dumps(assets, ensure_ascii=False, indent=1), 'список файлов в sw.js')
    (OUT / 'sw.js').write_text(sw, encoding='utf-8')
    (OUT / '.nojekyll').write_text('', encoding='utf-8')

    kb = lambda p: (OUT / p).stat().st_size // 1024
    print(f'Готово: версия {version}, материалы от {build["content"]}')
    print(f'  docs/index.html {kb("index.html")} КБ, docs/ege70-offline.html {kb("ege70-offline.html")} КБ, файлов в кэше: {len(assets)}')


if __name__ == '__main__':
    main()
