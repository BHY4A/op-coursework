/* mdoc.js — общий для всех утилит файл (одинаковый в каждом репозитории):
 *  1) теория к разделам расчёта: MDOC.theory(tab, заголовок) возвращает блок «Теория» для раздела, если в js/theory.js
 *     этой утилиты (window.THEORY) есть подходящая статья. Статьи привязаны к тексту заголовка регулярным выражением,
 *     поэтому смена нумерации разделов их не ломает. Блок только на сайте — в отчёты Word теория не попадает;
 *  2) встроенный просмотр методички: кнопка «Методичка» в шапке открывает справа панель с PDF (pdf.js из общего
 *     каталога хаба vendor/pdfjs, грузится только при открытии). PDF выбирает сам пользователь — файл хранится
 *     только в этом браузере (IndexedDB) и никуда не отправляется. Ссылки «Методичка: (1.14)» в блоках теории
 *     ищут текст в PDF и открывают нужную страницу с подсветкой.
 * Подключается после suite.js обычным скриптом в конце <body> (до app.js). */
(function () {
  'use strict';
  if (typeof document === 'undefined') return;   // загрузка в Node (автотесты) — только на странице
  var root = document.documentElement, APP = root.getAttribute('data-app') || 'app';
  var BASE = new URL('../vendor/pdfjs/', location.href).href;
  var LS = { open: 'suite-mdoc-open|' + APP, doc: 'suite-mdoc-doc|' + APP, w: 'suite-mdoc-w', zoom: 'suite-mdoc-zoom', th: 'suite-theory-closed' };
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { /* хранилище недоступно */ } }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function toast(t) { if (window.SUITE && SUITE.toast) SUITE.toast(t); }
  /* поиск без учёта регистра, «ё», переносов и пробелов */
  function norm(s) { return String(s || '').toLowerCase().replace(/ё/g, 'е').replace(/[­​]/g, '').replace(/[‐-―−]/g, '-').replace(/\s+/g, ''); }

  /* =================== 1. теория к разделам =================== */
  var closed = {};
  try { closed = JSON.parse(lsGet(LS.th) || '{}') || {}; } catch (e) { closed = {}; }
  function plain(t) { return String(t || '').replace(/<[^>]+>/g, '').replace(/^\s*\d+(\.\d+)*\.?\s+/, '').trim(); }
  /* одна статья — один раз за отрисовку: подразделы с похожими заголовками не повторяют теорию раздела */
  var used = {}, clearing = false;
  function theory(tab, title) {
    var T = window.THEORY; if (!T || !T.tabs) return '';
    if (!clearing) { clearing = true; Promise.resolve().then(function () { used = {}; clearing = false; }); }
    var list = (T.tabs[tab] || []).concat(T.tabs['*'] || []), h0 = plain(title), h = h0.replace(/ё/g, 'е');
    for (var i = 0; i < list.length; i++) {
      var e = list[i];
      if (e.only && !e.only.test(tab)) continue;
      if (!e.m.test(h) && !e.m.test(h0)) continue;
      var key = APP + '|' + String(tab).split('|')[0] + '|' + (e.id || e.m.source);
      if (used[key]) return '';
      used[key] = 1;
      var dflt = T.docFor ? T.docFor(String(tab).split('|')[0]) : '';
      var refs = (e.r || []).map(function (r) {
        var d = r[2] || dflt;
        return '<button type="button" class="mdth-ref" data-mdoc-q="' + esc(r[0]) + '"' + (d ? ' data-mdoc-doc="' + esc(d) + '"' : '') + ' title="Найти в методичке: ' + esc(r[0]) + '">' + BOOK + '<span>' + (r[1] || esc(r[0])) + '</span></button>';
      }).join('');
      return '<details class="mdth" data-th="' + esc(key) + '"' + (closed[key] ? '' : ' open') + '><summary><span class="mdth-l">Теория</span><span class="mdth-s">' + (e.s || '') + '</span></summary>' +
        '<div class="mdth-b">' + e.t + (refs ? '<div class="mdth-refs">' + refs + '</div>' : '') + '</div></details>';
    }
    return '';
  }
  document.addEventListener('toggle', function (ev) {
    var d = ev.target; if (!d || !d.classList || !d.classList.contains('mdth')) return;
    var k = d.getAttribute('data-th'); if (d.open) delete closed[k]; else closed[k] = 1;
    lsSet(LS.th, JSON.stringify(closed));
  }, true);

  /* =================== 2. хранилище PDF (IndexedDB, только этот браузер) =================== */
  var dbp = null;
  function db() {
    if (dbp) return dbp;
    dbp = new Promise(function (ok, no) {
      if (!window.indexedDB) { no(new Error('IndexedDB недоступна')); return; }
      var rq = indexedDB.open('suite-mdoc', 1);
      rq.onupgradeneeded = function () { var s = rq.result.createObjectStore('files', { keyPath: 'key' }); s.createIndex('app', 'app'); };
      rq.onsuccess = function () { ok(rq.result); };
      rq.onerror = function () { no(rq.error); };
    });
    return dbp;
  }
  function tx(mode, fn) {
    return db().then(function (d) {
      return new Promise(function (ok, no) {
        var t = d.transaction('files', mode), s = t.objectStore('files'), r = fn(s);
        t.oncomplete = function () { ok(r && 'result' in r ? r.result : undefined); };
        t.onerror = function () { no(t.error); };
      });
    });
  }
  function listFiles() { return tx('readonly', function (s) { return s.index('app').getAll(APP); }).then(function (a) { return (a || []).sort(function (x, y) { return x.added - y.added; }); }); }
  function putFile(f) {
    return f.arrayBuffer().then(function (buf) {
      var rec = { key: APP + '|' + f.name + '|' + f.size, app: APP, name: f.name, size: f.size, added: Date.now(), data: buf };
      return tx('readwrite', function (s) { return s.put(rec); }).then(function () { return rec; });
    });
  }
  function delFile(key) { return tx('readwrite', function (s) { return s.delete(key); }); }

  /* =================== 3. pdf.js (лениво, из общего каталога хаба) =================== */
  var libp = null;
  function lib() {
    if (libp) return libp;
    libp = new Promise(function (ok, no) {
      if (window.pdfjsLib) { ok(window.pdfjsLib); return; }
      var s = document.createElement('script'); s.src = BASE + 'pdf.min.js';
      s.onload = function () { var L = window.pdfjsLib; if (!L) { no(new Error('pdf.js не загрузился')); return; } L.GlobalWorkerOptions.workerSrc = BASE + 'pdf.worker.min.js'; ok(L); };
      s.onerror = function () { libp = null; no(new Error('Не удалось загрузить просмотрщик PDF (нужен интернет)')); };
      document.head.appendChild(s);
    });
    return libp;
  }

  /* =================== 4. панель просмотра =================== */
  var BOOK = '<svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3.6C6.7 2.6 4.6 2.2 2 2.3v10c2.6-.1 4.7.3 6 1.3 1.3-1 3.4-1.4 6-1.3v-10c-2.6-.1-4.7.3-6 1.3zM8 3.6v10" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>';
  var I = {
    prev: '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3.5 5.5 8l4.5 4.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    next: '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3.5 10.5 8 6 12.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    x: '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
    plus: '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3v10M3 8h10" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
    minus: '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h10" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
    fit: '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M2 6V2h4M14 6V2h-4M2 10v4h4M14 10v4h-4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
    trash: '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 8.5h5.8l.6-8.5" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    find: '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="m10.5 10.5 3.5 3.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>'
  };
  var V = { el: null, files: [], cur: null, pdf: null, pages: [], text: [], scale: 1, zoom: lsGet(LS.zoom) || 'fit', io: null, hits: [], hit: -1, q: '', pending: null, loadSeq: 0 };

  function docsHint() {
    var T = window.THEORY, d = (T && T.docs) || [];
    if (!d.length) return '';
    return '<div class="md-need"><b>Для этой утилиты:</b><ul>' + d.map(function (x) { return '<li>' + x.title + (x.note ? '<span>' + x.note + '</span>' : '') + '</li>'; }).join('') + '</ul></div>';
  }
  function build() {
    if (V.el) return V.el;
    var a = document.createElement('aside');
    a.className = 'mdoc'; a.id = 'mdoc'; a.hidden = true; a.setAttribute('aria-label', 'Методичка');
    a.innerHTML =
      '<div class="md-grip" title="Потяните, чтобы изменить ширину" aria-hidden="true"></div>' +
      '<div class="md-head">' +
        '<div class="md-row"><span class="md-t">' + BOOK + 'Методичка</span>' +
          '<select class="md-sel" aria-label="Документ"></select>' +
          '<button type="button" class="md-b" data-md="del" title="Убрать этот PDF из браузера" aria-label="Убрать этот PDF">' + I.trash + '</button>' +
          '<button type="button" class="md-b" data-md="add" title="Открыть PDF с компьютера" aria-label="Открыть PDF">' + I.plus + '</button>' +
          '<button type="button" class="md-b" data-md="close" title="Закрыть" aria-label="Закрыть методичку">' + I.x + '</button></div>' +
        '<div class="md-row md-tools">' +
          '<div class="md-grp"><button type="button" class="md-b" data-md="pprev" aria-label="Предыдущая страница">' + I.prev + '</button>' +
          '<label class="md-pg"><input type="text" inputmode="numeric" class="md-pn" aria-label="Номер страницы" value="1"><span class="md-pc">/ 1</span></label>' +
          '<button type="button" class="md-b" data-md="pnext" aria-label="Следующая страница">' + I.next + '</button></div>' +
          '<div class="md-grp"><button type="button" class="md-b" data-md="zout" aria-label="Уменьшить">' + I.minus + '</button>' +
          '<button type="button" class="md-b md-zv" data-md="fit" title="По ширине панели" aria-label="По ширине">' + I.fit + '</button>' +
          '<button type="button" class="md-b" data-md="zin" aria-label="Увеличить">' + I.plus + '</button></div>' +
          '<form class="md-find" role="search"><span class="md-fi">' + I.find + '</span><input type="search" class="md-q" placeholder="Найти: (1.14), табл. П.1, Tм…" aria-label="Поиск в методичке" enterkeyhint="search">' +
          '<span class="md-hc" aria-live="polite"></span>' +
          '<button type="button" class="md-b" data-md="hprev" aria-label="Предыдущее совпадение">' + I.prev + '</button>' +
          '<button type="button" class="md-b" data-md="hnext" aria-label="Следующее совпадение">' + I.next + '</button></form>' +
        '</div></div>' +
      '<div class="md-body" tabindex="-1"><div class="md-pages"></div>' +
        '<div class="md-empty" hidden><div class="md-drop">' + BOOK.replace(/15/g, '34') +
          '<h3>Откройте PDF методички</h3>' +
          '<p>Методичка откроется здесь, рядом с расчётом: листайте, ищите формулы по номеру, а ссылки «Методичка» в блоках «Теория» сразу покажут нужное место.</p>' +
          '<p class="md-priv">Файл остаётся только в этом браузере: он никуда не отправляется и не публикуется. Открыть его нужно один раз.</p>' +
          docsHint() +
          '<button type="button" class="btn primary" data-md="add">' + I.plus + 'Выбрать PDF</button><p class="md-dnd">или перетащите файл сюда</p></div></div>' +
        '<div class="md-wait" hidden><span class="spinner"></span><span class="md-wt">Загрузка…</span></div>' +
      '</div>' +
      '<input type="file" accept="application/pdf,.pdf" multiple hidden class="md-file">';
    document.body.appendChild(a);
    V.el = a;
    bindPanel(a);
    return a;
  }
  function $(s) { return V.el.querySelector(s); }
  function wait(t) { var w = $('.md-wait'); w.hidden = !t; if (t) $('.md-wt').textContent = t; }
  function setWidth(px) {
    var w = Math.max(340, Math.min(Math.round(px), Math.round(window.innerWidth * 0.7)));
    root.style.setProperty('--mdoc-w', w + 'px'); return w;
  }
  function isOpen() { return !!(V.el && !V.el.hidden); }
  function open(opts) {
    build();
    if (!isOpen()) {
      V.el.hidden = false; root.classList.add('mdoc-on'); lsSet(LS.open, '1');
      var b = document.getElementById('mdoc-btn'); if (b) b.setAttribute('aria-expanded', 'true');
    }
    if (opts && opts.q) V.pending = opts;
    return refresh();
  }
  function close() {
    if (!V.el) return;
    V.el.hidden = true; root.classList.remove('mdoc-on'); lsSet(LS.open, null);
    var b = document.getElementById('mdoc-btn'); if (b) { b.setAttribute('aria-expanded', 'false'); b.focus(); }
  }
  /* список файлов → выбор документа → показ */
  function refresh() {
    return listFiles().then(function (fs) {
      V.files = fs;
      var sel = $('.md-sel');
      sel.innerHTML = fs.map(function (f) { return '<option value="' + esc(f.key) + '">' + esc(f.name.replace(/\.pdf$/i, '')) + '</option>'; }).join('');
      sel.hidden = !fs.length; $('[data-md="del"]').hidden = !fs.length;
      V.el.classList.toggle('empty', !fs.length);
      if (!fs.length) { $('.md-empty').hidden = false; $('.md-pages').innerHTML = ''; V.cur = null; V.pdf = null; V.pending = null; return; }
      $('.md-empty').hidden = true;
      var want = V.cur || lsGet(LS.doc), pick = null;
      if (V.pending && V.pending.doc) pick = pickDoc(V.pending.doc);
      if (!pick) fs.forEach(function (f) { if (f.key === want) pick = f; });
      if (!pick) pick = fs[0];
      sel.value = pick.key;
      if (V.cur === pick.key && V.pdf) return afterLoad();
      return load(pick);
    }).catch(function (e) { console.error(e); $('.md-empty').hidden = false; toast('Хранилище браузера недоступно: ' + e.message); });
  }
  /* документ, к которому относится ссылка: по словам из THEORY.docs[].match в имени файла */
  function pickDoc(id) {
    var T = window.THEORY, d = null;
    ((T && T.docs) || []).forEach(function (x) { if (x.id === id) d = x; });
    if (!d || !d.match) return null;
    var hit = null;
    V.files.forEach(function (f) { if (!hit && d.match.test(f.name)) hit = f; });
    return hit;
  }
  function load(f) {
    var seq = ++V.loadSeq;
    wait('Открываю ' + f.name + '…');
    if (V.io) { V.io.disconnect(); V.io = null; }
    $('.md-pages').innerHTML = ''; V.pages = []; V.text = []; V.hits = []; V.hit = -1; showHits();
    return lib().then(function (L) {
      return L.getDocument({ data: new Uint8Array(f.data.slice(0)), cMapUrl: BASE + 'cmaps/', cMapPacked: true, standardFontDataUrl: BASE + 'standard_fonts/', isEvalSupported: false }).promise;
    }).then(function (pdf) {
      if (seq !== V.loadSeq) return;
      if (V.pdf && V.pdf.destroy) V.pdf.destroy();
      V.pdf = pdf; V.cur = f.key; lsSet(LS.doc, f.key);
      return pdf.getPage(1).then(function (p1) { V.base = p1.getViewport({ scale: 1 }); layout(); });
    }).then(function () {
      if (seq !== V.loadSeq) return;
      wait(null);
      var last = +lsGet('suite-mdoc-pg|' + (V.cur || '')) || 1;
      if (!V.pending) goPage(last, true);
      return afterLoad();
    }).catch(function (e) { console.error(e); wait(null); toast(e && e.message ? e.message : 'Не удалось открыть PDF'); });
  }
  function afterLoad() {
    if (V.pending) { var p = V.pending; V.pending = null; $('.md-q').value = p.q; return find(p.q, p.tried || [V.cur]); }
  }
  /* ссылка из теории: если в открытом PDF текста нет — по очереди пробуем остальные загруженные документы */
  function findElsewhere(q, tried) {
    var next = V.files.filter(function (f) { return tried.indexOf(f.key) < 0; })[0];
    if (!next) { toast('В загруженных PDF не найдено: ' + q); return Promise.resolve(); }
    tried.push(next.key);
    V.pending = { q: q, tried: tried };
    return load(next);
  }
  /* масштаб и разметка страниц-заготовок; страницы рисуются, когда видны */
  function fitScale() { var w = $('.md-body').clientWidth - 24; return Math.max(0.3, w / V.base.width); }
  function layout() {
    if (!V.pdf) return;
    var keep = curPage();
    V.scale = V.zoom === 'fit' ? fitScale() : Math.max(0.3, Math.min(4, +V.zoom || 1));
    $('.md-zv').classList.toggle('on', V.zoom === 'fit');
    var box = $('.md-pages'), n = V.pdf.numPages, h = '';
    for (var i = 1; i <= n; i++) h += '<div class="md-p" data-p="' + i + '" style="width:' + Math.floor(V.base.width * V.scale) + 'px;height:' + Math.floor(V.base.height * V.scale) + 'px"><span class="md-pno">' + i + '</span></div>';
    box.innerHTML = h;
    V.pages = [];
    $('.md-pc').textContent = '/ ' + n;
    if (V.io) V.io.disconnect();
    V.io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) draw(+e.target.getAttribute('data-p')); }); }, { root: $('.md-body'), rootMargin: '400px 0px' });
    box.querySelectorAll('.md-p').forEach(function (p) { V.io.observe(p); });
    if (keep) goPage(keep, true);
  }
  function draw(n) {
    if (V.pages[n] || !V.pdf) return V.pages[n];
    var pdf = V.pdf, scale = V.scale;
    V.pages[n] = pdf.getPage(n).then(function (pg) {
      if (pdf !== V.pdf || scale !== V.scale) return;
      /* «по ширине» — каждая страница по своей ширине: альбомные листы не раздвигают колонку */
      var sc = V.zoom === 'fit' ? Math.max(0.3, ($('.md-body').clientWidth - 24) / pg.getViewport({ scale: 1 }).width) : scale;
      var vp = pg.getViewport({ scale: sc }), dpr = Math.min(window.devicePixelRatio || 1, 2.5);
      var host = V.el.querySelector('.md-p[data-p="' + n + '"]'); if (!host) return;
      host.style.width = Math.floor(vp.width) + 'px'; host.style.height = Math.floor(vp.height) + 'px';
      var c = document.createElement('canvas'); c.width = Math.floor(vp.width * dpr); c.height = Math.floor(vp.height * dpr);
      c.style.width = Math.floor(vp.width) + 'px'; c.style.height = Math.floor(vp.height) + 'px';
      var tl = document.createElement('div'); tl.className = 'textLayer'; tl.style.setProperty('--scale-factor', sc);
      host.appendChild(c); host.appendChild(tl);
      return pg.render({ canvasContext: c.getContext('2d'), viewport: vp, transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : null }).promise
        .then(function () { return pg.getTextContent(); })
        .then(function (tc) {
          var L = window.pdfjsLib, t = L.renderTextLayer({ textContentSource: tc, container: tl, viewport: vp });
          return (t && t.promise ? t.promise : Promise.resolve()).then(function () { host.classList.add('ok'); mark(n); });
        });
    }).catch(function (e) { console.error(e); V.pages[n] = null; });
    return V.pages[n];
  }
  function curPage() {
    if (!V.pdf || !V.el) return 0;
    var body = $('.md-body'), top = body.scrollTop + 40, ps = body.querySelectorAll('.md-p'), n = 1;
    for (var i = 0; i < ps.length; i++) { if (ps[i].offsetTop <= top) n = i + 1; else break; }
    return n;
  }
  function goPage(n, instant) {
    if (!V.pdf) return;
    n = Math.max(1, Math.min(V.pdf.numPages, n | 0));
    var p = V.el.querySelector('.md-p[data-p="' + n + '"]'); if (!p) return;
    $('.md-body').scrollTo({ top: p.offsetTop - 8, behavior: instant ? 'auto' : 'smooth' });
    $('.md-pn').value = n;
  }
  /* ---------- поиск ---------- */
  function pageText(n) {
    if (V.text[n]) return V.text[n];
    V.text[n] = V.pdf.getPage(n).then(function (pg) { return pg.getTextContent(); }).then(function (tc) {
      var raw = tc.items.map(function (it) { return it.str; }).join(' ');
      return { raw: raw.replace(/\s+/g, ' '), n: norm(raw) };
    });
    return V.text[n];
  }
  function find(q, tried) {
    q = String(q || '').trim(); V.q = q;
    var nq = norm(q);
    if (!V.pdf || !nq) { V.hits = []; V.hit = -1; showHits(); return Promise.resolve(); }
    var pdf = V.pdf, all = [];
    for (var i = 1; i <= pdf.numPages; i++) all.push(pageText(i));
    $('.md-hc').textContent = '…';
    return Promise.all(all).then(function (tx) {
      if (pdf !== V.pdf) return;
      V.hits = [];
      tx.forEach(function (t, k) { var from = 0, j; while ((j = t.n.indexOf(nq, from)) >= 0) { V.hits.push(k + 1); from = j + nq.length; } });
      V.hit = V.hits.length ? 0 : -1;
      showHits();
      clearMarks();
      if (V.hits.length) { goPage(V.hits[0], true); markAll(); }
      else if (tried && V.files.length > tried.length) return findElsewhere(q, tried);
      else toast((V.files.length > 1 ? 'В загруженных PDF не найдено: ' : 'В этом PDF не найдено: ') + q);
    });
  }
  function showHits() {
    if (!V.el) return;
    $('.md-hc').textContent = V.hits.length ? (V.hit + 1) + ' из ' + V.hits.length : (V.q ? '0' : '');
    V.el.classList.toggle('has-hits', V.hits.length > 1);
  }
  function stepHit(d) {
    if (!V.hits.length) return;
    V.hit = (V.hit + d + V.hits.length) % V.hits.length; showHits();
    var p = V.hits[V.hit]; goPage(p, true); focusMark(p);
  }
  function clearMarks() { V.el.querySelectorAll('.textLayer .md-hit').forEach(function (s) { s.classList.remove('md-hit', 'md-hit-cur'); }); }
  function markAll() { V.hits.forEach(function (p) { mark(p); }); }
  /* подсветка: спаны текстового слоя, из которых складывается совпадение */
  function mark(n) {
    var nq = norm(V.q); if (!nq || V.hits.indexOf(n) < 0) return;
    var host = V.el.querySelector('.md-p[data-p="' + n + '"] .textLayer'); if (!host) return;
    var sp = [].slice.call(host.querySelectorAll('span')).filter(function (s) { return !s.children.length; });
    var acc = '', map = [];
    sp.forEach(function (s, i) { var t = norm(s.textContent); for (var k = 0; k < t.length; k++) map.push(i); acc += t; });
    var from = 0, j;
    while ((j = acc.indexOf(nq, from)) >= 0) { for (var k = j; k < j + nq.length; k++) sp[map[k]].classList.add('md-hit'); from = j + nq.length; }
    if (V.hits[V.hit] === n) focusMark(n);
  }
  function focusMark(n) {
    var h = V.el.querySelector('.md-p[data-p="' + n + '"] .md-hit'); if (!h) return;
    V.el.querySelectorAll('.md-hit-cur').forEach(function (s) { s.classList.remove('md-hit-cur'); });
    h.classList.add('md-hit-cur');
    var body = $('.md-body'), r = h.getBoundingClientRect(), br = body.getBoundingClientRect();
    if (r.top < br.top + 40 || r.bottom > br.bottom - 40) body.scrollBy({ top: r.top - br.top - br.height / 3 });
  }
  function addFiles(list) {
    var fs = [].filter.call(list || [], function (f) { return /\.pdf$/i.test(f.name) || f.type === 'application/pdf'; });
    if (!fs.length) { toast('Нужен файл PDF. Документ Word сохраните как PDF: Файл → Сохранить как → PDF.'); return; }
    wait('Сохраняю в браузере…');
    var last = null;
    fs.reduce(function (p, f) { return p.then(function () { return putFile(f).then(function (r) { last = r; }); }); }, Promise.resolve())
      .then(function () { wait(null); if (last) { V.cur = null; lsSet(LS.doc, last.key); } return refresh(); })
      .catch(function (e) { wait(null); toast('Не удалось сохранить PDF в браузере: ' + (e && e.message || e)); });
  }
  function bindPanel(a) {
    var fi = a.querySelector('.md-file');
    fi.onchange = function () { addFiles(fi.files); fi.value = ''; };
    a.addEventListener('click', function (e) {
      var b = e.target.closest('[data-md]'); if (!b) return;
      switch (b.getAttribute('data-md')) {
        case 'add': fi.click(); break;
        case 'close': close(); break;
        case 'del': {
          var f = V.files.filter(function (x) { return x.key === V.cur; })[0]; if (!f) break;
          if (!confirm('Убрать «' + f.name + '» из этого браузера? Файл на компьютере не изменится.')) break;
          delFile(f.key).then(function () { V.cur = null; V.pdf = null; lsSet(LS.doc, null); return refresh(); });
          break;
        }
        case 'pprev': goPage(curPage() - 1); break;
        case 'pnext': goPage(curPage() + 1); break;
        case 'zin': V.zoom = String(Math.min(4, Math.round(V.scale * 1.2 * 100) / 100)); lsSet(LS.zoom, V.zoom); layout(); break;
        case 'zout': V.zoom = String(Math.max(0.3, Math.round(V.scale / 1.2 * 100) / 100)); lsSet(LS.zoom, V.zoom); layout(); break;
        case 'fit': V.zoom = 'fit'; lsSet(LS.zoom, 'fit'); layout(); break;
        case 'hprev': stepHit(-1); break;
        case 'hnext': stepHit(1); break;
      }
    });
    a.querySelector('.md-sel').onchange = function () { var k = this.value; V.files.forEach(function (f) { if (f.key === k) load(f); }); };
    var pn = a.querySelector('.md-pn');
    pn.onchange = function () { goPage(parseInt(pn.value, 10) || 1); };
    pn.onkeydown = function (e) { if (e.key === 'Enter') { e.preventDefault(); goPage(parseInt(pn.value, 10) || 1); } };
    a.querySelector('.md-find').onsubmit = function (e) {
      e.preventDefault(); var q = a.querySelector('.md-q').value;
      if (q.trim() === V.q && V.hits.length) stepHit(1); else find(q);
    };
    var body = a.querySelector('.md-body'), tm = 0;
    body.addEventListener('scroll', function () {
      clearTimeout(tm);
      tm = setTimeout(function () { var n = curPage(); if (n && document.activeElement !== pn) pn.value = n; if (V.cur && n) lsSet('suite-mdoc-pg|' + V.cur, String(n)); }, 120);
    }, { passive: true });
    ['dragenter', 'dragover'].forEach(function (t) { a.addEventListener(t, function (e) { if (e.dataTransfer && [].indexOf.call(e.dataTransfer.types || [], 'Files') >= 0) { e.preventDefault(); a.classList.add('drag'); } }); });
    a.addEventListener('dragleave', function (e) { if (!a.contains(e.relatedTarget)) a.classList.remove('drag'); });
    a.addEventListener('drop', function (e) { e.preventDefault(); a.classList.remove('drag'); addFiles(e.dataTransfer && e.dataTransfer.files); });
    a.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !e.target.closest('input')) close(); });
    /* ширина панели — перетаскиванием левого края */
    var grip = a.querySelector('.md-grip');
    grip.addEventListener('pointerdown', function (e) {
      e.preventDefault(); grip.setPointerCapture(e.pointerId); a.classList.add('resizing');
      var mv = function (ev) { setWidth(window.innerWidth - ev.clientX); };
      var up = function () { grip.removeEventListener('pointermove', mv); grip.removeEventListener('pointerup', up); a.classList.remove('resizing'); lsSet(LS.w, parseInt(getComputedStyle(root).getPropertyValue('--mdoc-w'), 10)); if (V.zoom === 'fit') layout(); };
      grip.addEventListener('pointermove', mv); grip.addEventListener('pointerup', up);
    });
    var rt = 0;
    window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(function () { if (isOpen() && V.zoom === 'fit' && V.pdf) { var w = $('.md-body').clientWidth; if (Math.abs(w - (V.lw || 0)) > 8) { V.lw = w; layout(); } } }, 160); });
  }

  /* =================== 5. кнопка в шапке и ссылки из теории =================== */
  function addButton() {
    var top = document.querySelector('.top-in'); if (!top || document.getElementById('mdoc-btn')) return;
    var b = document.createElement('button');
    b.className = 'icon-btn'; b.id = 'mdoc-btn'; b.type = 'button';
    b.title = 'Методичка рядом с расчётом'; b.setAttribute('aria-label', 'Открыть методичку'); b.setAttribute('aria-controls', 'mdoc'); b.setAttribute('aria-expanded', 'false');
    b.innerHTML = BOOK.replace(/15/g, '17');
    b.onclick = function () { if (isOpen()) close(); else open(); };
    var before = document.getElementById('share') || document.getElementById('style');
    if (before && before.parentNode === top) top.insertBefore(b, before); else top.appendChild(b);
  }
  document.addEventListener('click', function (e) {
    var r = e.target.closest && e.target.closest('[data-mdoc-q]'); if (!r) return;
    e.preventDefault();
    open({ q: r.getAttribute('data-mdoc-q'), doc: r.getAttribute('data-mdoc-doc') || '' });
  });
  function init() {
    var w = +lsGet(LS.w); setWidth(w || Math.min(720, Math.max(420, window.innerWidth * 0.42)));
    addButton();
    if (lsGet(LS.open) && window.innerWidth > 960) open();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();

  window.MDOC = { theory: theory, open: open, close: close, find: function (q) { return open({ q: q }); } };
})();
