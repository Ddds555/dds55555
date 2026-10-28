#!/usr/bin/env python3
"""Собирает офлайн-приложение «ЕГЭ на 70» из HTML артефакта в Claude.

    python3 tools/build.py

Читает source/ege70-artifact.html и source/source.json, пишет в docs/:
  index.html            - приложение (PWA): ставится на телефон значком и работает без интернета
  sw.js                 - service worker: хранит приложение на устройстве
  manifest.webmanifest  - имя, значок и цвета для установки на телефон
  ege70-offline.html    - то же приложение одним файлом (шрифты внутри) - для компьютера и про запас
Шрифты и значки лежат в docs/fonts и docs/icons (значки рисует tools/make-icons.cjs).

Код и материалы артефакта не переписываются: сборщик точечно меняет несколько мест (PATCHES - каждое
должно найтись ровно один раз, иначе сборка останавливается) и вставляет перед «старт» tools/offline.js.
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
FONTS = [  # (файл в docs/fonts, семейство, насыщенность)
    ('manrope-cyrillic-ext', 'Manrope', '200 800'), ('manrope-cyrillic', 'Manrope', '200 800'),
    ('manrope-latin-ext', 'Manrope', '200 800'), ('manrope-latin', 'Manrope', '200 800'),
    ('unbounded-cyrillic-ext', 'Unbounded', '200 900'), ('unbounded-cyrillic', 'Unbounded', '200 900'),
    ('unbounded-latin-ext', 'Unbounded', '200 900'), ('unbounded-latin', 'Unbounded', '200 900'),
]
ICONS = ['icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png']

BACK = '<button class="back" data-a="back">${ic(\'left\', 18)} Назад</button>'

# (что меняем, было, стало)
PATCHES = [
    ('вкладка «Сочинение» вместо «Подарков» (подарки - с карточки «Копилка» на главной)',
     "const TABS = [['home', 'Сегодня', 'home'], ['ru', 'Русский', 'book'], ['soc', 'Общество', 'scale'], ['en', 'English', 'globe'], ['err', 'Ошибки', 'note'], ['gifts', 'Подарки', 'gift']];",
     "const TABS = [['home', 'Сегодня', 'home'], ['final', 'Сочинение', 'pen'], ['ru', 'Русский', 'book'], ['soc', 'Общество', 'scale'], ['en', 'English', 'globe'], ['err', 'Ошибки', 'note']];"),
    ('вкладка «Сочинение» открывается на разделе, где была в прошлый раз',
     'function setTab(t) { ui.tab = t; ui.stack = []; ui.route = { v: t };',
     "function setTab(t) { ui.tab = t; ui.stack = []; ui.route = t === 'final' ? { v: t, sub: finLastSub() } : { v: t };"),
    ('экраны «Мои данные» и «Жалобы на задания»',
     "r.v === 'fav' ? vFav() : vHome()",
     "r.v === 'fav' ? vFav() : r.v === 'data' ? vData() : r.v === 'reports' ? vReports() : vHome()"),
    ('жалоба «Здесь ошибка?» без Claude: где её потом смотреть',
     "s.textContent = caps.sample ? 'Записала. Проверяю задание…' : 'Записала: проверю это задание';",
     "s.textContent = caps.sample ? 'Записала. Проверяю задание…' : 'Жалоба записана - она во вкладке «Ошибки» → «Жалобы»';"),
    ('главная: где хранится прогресс',
     "'сохраняется на этом устройстве'",
     "'офлайн-версия, всё хранится на этом устройстве'"),
    ('главная: ссылка на копию прогресса',
     '<div class="muted small">${sync}</div></header>',
     '<div class="muted small">${sync} · ${dataLinkHTML()}</div></header>'),
    ('главная: карточка итогового сочинения',
     '${resumeCard()}',
     '${resumeCard()}\n  ${finHomeCard()}'),
    ('главная: копилка открывает подарки',
     'data-a="tab" data-t="gifts" style="cursor:pointer"',
     'data-a="openGifts" style="cursor:pointer"'),
    ('главная: срок итогового сочинения уже в его карточке - отдельная плашка не нужна',
     '<div class="chips">${essayD >= 0 ? `<button class="chip" data-a="openFinal"',
     '<div class="chips">${essayD >= 0 && !FIN_W.length ? `<button class="chip" data-a="openFinal"'),
    ('итоговое сочинение: на вкладке «Назад» не нужен',
     BACK + '\n  <header class="stack" style="gap:6px"><div class="kicker">${fd >= 0',
     '${ui.stack.length ? `' + BACK + '` : \'\'}\n  <header class="stack" style="gap:6px"><div class="kicker">${fd >= 0'),
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
    ('карточка-самопроверка: ответ уже был на экране - «Правильно» не повторяем',
     "${L.ok ? '' : `<p class=\"right\">",
     "${L.ok || it.type === 'card' ? '' : `<p class=\"right\">"),
    # без Claude: честные подписи вместо «проверка работает в приложении Claude»
    ('без Claude: вопросы к заданию',
     'Объяснения и вопросы Claude работают, когда программа открыта по ссылке или значком на рабочем столе.',
     'В офлайн-версии вопросов к Claude нет - смотри разбор и теорию выше.'),
    ('без Claude: сочинение ЕГЭ',
     'Проверка через Claude работает в приложении Claude. Пока - самопроверка по галочкам выше.',
     'В офлайн-версии сочинение проверяешь сама - по галочкам выше. Проверка Claude - в версии в Claude.'),
    ('без Claude: абзац-аргумент',
     ' Claude проверит факты и логику.</p>',
     ' Потом сверь его с карточкой произведения: факты и вывод.</p>'),
    ('без Claude: абзац-аргумент, подсказка',
     'Проверка Claude работает, когда программа открыта по ссылке или значком на рабочем столе. Пока - сравни свой абзац с карточкой произведения.',
     'В офлайн-версии абзац проверяешь сама: открой карточку произведения (кнопка выше) и сверь факты и вывод.'),
    ('без Claude: итоговое сочинение',
     'Проверка через Claude работает в приложении Claude. Пока - самопроверка по галочкам.',
     'В офлайн-версии сочинение проверяешь сама - по галочкам выше. Проверка Claude на зачёт - в версии в Claude.'),
    ('без Claude: английский, письмо',
     'Проверка через Claude работает в приложении Claude.</p>',
     'В офлайн-версии проверки Claude нет - сверь текст с шаблоном во вкладке «Теория».</p>'),
    ('без Claude: английский, список',
     "'шаблон и проверка Claude'",
     "'шаблон и самопроверка'"),
    ('без Claude: «Объясни с нуля»',
     "Объяснения Claude работают в приложении Claude - открой программу по ссылке или значком",
     "В офлайн-версии объяснений Claude нет - открыла теорию"),
    ('без Claude: шаги итогового сочинения',
     "сочинение целиком с проверкой Claude'",
     "сочинение целиком с самопроверкой'"),
    ('без Claude: «Продолжить» сочинение',
     'черновик и проверка Claude.',
     'черновик и самопроверка.'),
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


def font_css(inline):
    ranges = json.loads((TOOLS / 'font-ranges.json').read_text(encoding='utf-8'))
    out = []
    for name, family, weight in FONTS:
        path = OUT / 'fonts' / f'{name}.woff2'
        url = ('data:font/woff2;base64,' + base64.b64encode(path.read_bytes()).decode()) if inline else f'fonts/{name}.woff2'
        out.append(f"@font-face{{font-family:'{family}';font-style:normal;font-weight:{weight};font-display:swap;"
                   f"src:url({url}) format('woff2');unicode-range:{ranges[name]}}}")
    return '\n'.join(out)


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
<style>
{font_css(single)}
</style>
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
    base, title, css, markup, js = split_source(html)
    if re.search(r'fonts\.googleapis|fonts\.gstatic', css + markup + js):
        fail('в стиле или скрипте осталась ссылка на Google Fonts')

    for label, old, new in PATCHES + CONTENT_FIXES:
        js = patch(js, old, new, label)
    # ответы на жалобы «Здесь ошибка?» - данные для tools/offline.js
    checks = {k: v for k, v in json.loads((TOOLS / 'report-checks.json').read_text(encoding='utf-8')).items() if not k.startswith('_')}
    offline = ('const REPORT_CHECKS = ' + json.dumps(checks, ensure_ascii=False) + ';\n'
               + (TOOLS / 'offline.js').read_text(encoding='utf-8'))
    js = patch(js, START, offline.rstrip() + '\n\n' + START, 'вставка tools/offline.js перед «старт»')
    css = css.rstrip() + '\n' + (TOOLS / 'offline.css').read_text(encoding='utf-8')

    for name in [f'fonts/{n}.woff2' for n, _, _ in FONTS] + [f'icons/{n}' for n in ICONS]:
        if not (OUT / name).is_file():
            fail(f'нет файла docs/{name}' + (' - запусти node tools/make-icons.cjs' if name.startswith('icons/') else ''))

    # версия = хеш всего, из чего собрано приложение: меняется только когда что-то поменялось
    h = hashlib.sha256()
    for part in (html, json.dumps(meta, sort_keys=True), offline, css,
                 (TOOLS / 'build.py').read_text(encoding='utf-8'), (TOOLS / 'sw.template.js').read_text(encoding='utf-8')):
        h.update(part.encode('utf-8'))
    for name in [f'fonts/{n}.woff2' for n, _, _ in FONTS] + [f'icons/{n}' for n in ICONS]:
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

    # приложение ('./' - это index.html), шрифты и значки; файл-копия для компьютера в кэш телефона не нужен
    assets = ['./', 'manifest.webmanifest'] + [f'fonts/{n}.woff2' for n, _, _ in FONTS] + [f'icons/{n}' for n in ICONS]
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
