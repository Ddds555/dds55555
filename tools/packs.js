/* ================= ЗАДАНИЯ ЕГЭ С САЙТА: БАНК ФИПИ И СБОРНИКИ 2027 (16.11.2026) =================
   Её просьба: «хочу именно ЕГЭшные задания - с ФИПИ и из сборников 2027, а не составленные». Это чужие задания и книги,
   поэтому открыто на сайт их не кладём. docs/packs/<файл>.bin - обычный пакет заданий (как «Задания из её файлов»,
   см. offline.js), сжатый gzip и зашифрованный AES-GCM. Ключ пакета знает только её телефон: он завёрнут ключом
   из имени её канала напоминаний (state.notify.topic - случайное, есть только в её прогрессе), поэтому задания
   загружаются сами, без кода. Запасной путь (устройство без её прогресса): код из Claude - ключ завёрнут и им.
   Список пакетов - docs/packs/index.json: { packs: [{ id, title, n, ver, file, iv, wraps: [{ kind, salt, iv, key }] }] }.
   Собирает и шифрует tools-local/pack_publish.py (вне репозитория, ключи - в ~/Claude/ege-dasha/secrets). */
const CLOUD_DIR = 'packs/';
const PACK_CODE_KEY = LS + '.packCode';
const b64u8 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
const packCodeNorm = s => String(s || '').replace(/\D/g, '');
async function packKek(secret, salt) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt: b64u8(salt), iterations: 150000 }, base, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
}
async function packUnwrap(p, sec) {
  for (const w of p.wraps || []) {
    const s = sec[w.kind]; if (!s) continue;
    try {
      const raw = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64u8(w.iv) }, await packKek(s, w.salt), b64u8(w.key));
      return await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['decrypt']);
    } catch {}
  }
  return null;
}
const cloudSt = { need: [], busy: false, tried: false };
async function cloudPacks(manual) {
  if (cloudSt.busy || !(window.crypto && crypto.subtle) || typeof DecompressionStream !== 'function') return;
  if (location.protocol === 'file:') return;
  cloudSt.busy = true;
  let got = 0, upd = 0;
  try {
    const idx = await (await fetch(CLOUD_DIR + 'index.json?t=' + Date.now(), { cache: 'no-store' })).json();
    let code = ''; try { code = packCodeNorm(localStorage.getItem(PACK_CODE_KEY)); } catch {}
    const sec = { topic: state.notify?.topic || '', code }, need = [];
    for (const p of idx.packs || []) {
      const have = PACKS[p.id];
      if (have && (have.v || 0) >= p.ver) continue;
      const key = await packUnwrap(p, sec);
      if (!key) { need.push({ id: p.id, title: p.title, n: p.n }); continue; }
      const buf = await (await fetch(CLOUD_DIR + p.file + '?v=' + p.ver, { cache: 'no-store' })).arrayBuffer();
      const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64u8(p.iv) }, key, buf);
      const json = await new Response(new Blob([plain]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
      const o = JSON.parse(json); if (!o || o.kind !== 'ege100-pack' || o.id !== p.id) continue;
      let ok = false;
      try { await packIdbPut(o.id, json); ok = true; try { localStorage.removeItem(PACK_KEY + o.id); } catch {} } catch {}
      if (!ok) { try { localStorage.setItem(PACK_KEY + o.id, json); ok = true; } catch {} }
      if (!ok) continue;
      if (have) upd++; else { packApply(o); got += o.items.length; } // обновлённый пакет заменит старый при следующем запуске
    }
    cloudSt.need = need;
    if (got) toast(`Новые задания ЕГЭ: ${got} - на вкладке «Русский»`);
    else if (upd) toast('Задания ЕГЭ обновлены - откроются при следующем запуске');
    else if (manual && need.length) toast('Код не подошёл - проверь цифры');
  } catch { if (manual) toast('Не получилось загрузить - нужен интернет'); }
  cloudSt.busy = false; cloudSt.tried = true;
  if (got || manual || cloudSt.need.length) safeRender();
}
/* карточка «нужен код» - только если ключ из её прогресса не подошёл (другое устройство) */
function cloudCard() {
  if (!cloudSt.need.length) return '';
  const n = cloudSt.need.reduce((a, p) => a + (p.n || 0), 0);
  return `<section class="card" style="border-left:5px solid var(--rose)"><h2 class="h2">Задания ЕГЭ ждут код</h2>
    <p class="muted small" style="margin:0">${n} заданий: ${cloudSt.need.map(p => esc(p.title)).join(', ')}. На твоём телефоне они загружаются сами, а на этом устройстве нужен код - его пришлёт Claude.</p>
    <form class="row" style="flex-wrap:nowrap" data-f="packcode"><input class="inp" id="packCode" inputmode="numeric" autocomplete="off" placeholder="12 цифр" aria-label="Код"><button class="btn primary">Загрузить</button></form></section>`;
}
document.addEventListener('submit', e => {
  const f = e.target.closest('form[data-f="packcode"]'); if (!f) return; e.preventDefault();
  const v = packCodeNorm(document.getElementById('packCode')?.value); if (v.length < 12) { toast('В коде 12 цифр'); return; }
  try { localStorage.setItem(PACK_CODE_KEY, v); } catch {}
  cloudPacks(true);
});
const vRuC0 = vRu;
vRu = function () { return packInject(vRuC0(), cloudCard()); };
/* выделенные слова в текстах (задание 2: «В тексте выделено пять слов») - **слово** */
const textHTMLc0 = textHTML;
textHTML = function (it) { return textHTMLc0(it).replace(/\*\*([^*<]{1,80})\*\*/g, '<b class="hl">$1</b>'); };
packsReady.finally(() => setTimeout(() => { if (navigator.onLine !== false) cloudPacks(); }, 2500));
