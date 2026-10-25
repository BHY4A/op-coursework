/* suite.js — общий для всех утилит файл (одинаковый в каждом репозитории):
 *  1) тема — одна на все утилиты и хаб (ключ suite-theme), ставится до отрисовки страницы, без мигания;
 *  2) меню «Утилиты» в шапке (кнопка #apps) — переход между утилитами и на хаб;
 *  3) доступность, одинаковая везде: прокручиваемые области (длинные формулы, таблицы) получают фокус с клавиатуры,
 *     окна (.modal-back) удерживают фокус внутри и закрываются клавишей Esc (как кнопкой без акцента);
 *  4) сохранение файлов SUITE.save(name, blob): на обычном сайте — скачивание; внутри артефакта claude.ai —
 *     через окно подтверждения (возможность downloads), т.к. там страница не может скачивать сама;
 *  5) стиль оформления — один на все утилиты и хаб (ключ suite-style, атрибут data-style у <html>).
 *     Стилей два: «Журнал» — исходный, полностью описан в suite.css и ни от чего не зависит; «Лазурь» — пакет
 *     в общем файле styles/styles.css репозитория хаба; файл и шрифты подгружаются только когда она выбрана;
 *  6) плавность: окна и меню открываются и закрываются с короткой анимацией, смена вкладки, темы и стиля —
 *     мягкий переход (View Transitions, где браузер умеет); при prefers-reduced-motion всё мгновенно.
 *  7) оглавление: ссылки на разделы-настройки (section.set) получают класс set — значок шестерёнки.
 * Подключается в <head> обычным (не defer) скриптом; у <html> — атрибут data-app с id текущей утилиты. */
(function () {
  'use strict';
  var KEY = 'suite-theme', root = document.documentElement, cur = root.getAttribute('data-app') || '';
  var LEGACY = { 'sapr-labs': 'ep-theme', 'krrs-robot': 'rb-theme', 'op-coursework': 'op-theme' };

  /* ---------- тема: общая настройка; при первом заходе переносится старая настройка этой утилиты ---------- */
  try {
    var t = localStorage.getItem(KEY);
    if (!t && LEGACY[cur]) { var old = localStorage.getItem(LEGACY[cur]); if (old) { t = old.replace(/"/g, ''); localStorage.setItem(KEY, t); } }
    if (t === 'dark' || t === 'light') root.setAttribute('data-theme', t);
  } catch (e) { /* хранилище недоступно — тема по системе */ }

  /* ---------- плавность: короткий перекрёстный переход для смены темы, стиля и т.п. ---------- */
  var RM = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  function calm() { return !!(RM && RM.matches); }
  function morph(fn) {
    if (!document.startViewTransition || calm() || document.visibilityState === 'hidden') { fn(); return; }
    try { document.startViewTransition(fn); } catch (e) { fn(); }
  }
  /* кнопка темы в каждой утилите и в хабе назначается через onclick — переключение заворачивается в переход */
  document.addEventListener('click', function (e) {
    var btn = e.target && e.target.closest ? e.target.closest('#theme') : null;
    if (!btn || typeof btn.onclick !== 'function' || !document.startViewTransition || calm()) return;
    e.stopImmediatePropagation(); e.preventDefault();
    var h = btn.onclick; morph(function () { h.call(btn, e); });
  }, true);

  /* ---------- стиль оформления ---------- */
  var SKEY = 'suite-style', SVER = '202610251500';
  var STYLES = [
    { id: 'journal', name: 'Журнал', sw: 'linear-gradient(135deg,#fbfcfd 0 56%,#dfe5ea 56%)' },
    { id: 'azure', name: 'Лазурь', fonts: 'PT+Mono&family=PT+Sans:ital,wght@0,400;0,700;1,400',
      sw: 'radial-gradient(circle at 32% 30%,#fff 0 9%,rgba(255,255,255,.3) 13%,transparent 15%),linear-gradient(180deg,#1f7fd6,#9fd4f6 62%,#f2fbff)' }
  ];
  var BYID = {}; STYLES.forEach(function (s) { BYID[s.id] = s; });
  var STY_HREF = (cur === 'hub' ? '' : '../') + 'styles/styles.css?v=' + SVER;
  function fontHref(s) { return 'https://fonts.googleapis.com/css2?family=' + s.fonts + '&display=swap'; }
  var curStyle = 'journal';
  try { var ss = localStorage.getItem(SKEY); if (ss && BYID[ss]) curStyle = ss; } catch (e) { /* хранилище недоступно */ }
  root.setAttribute('data-style', curStyle);
  if (curStyle !== 'journal' && document.readyState === 'loading') {
    // скрипт подключён в <head> без defer — стили встают до первой отрисовки, без мигания
    document.write('<link rel="stylesheet" id="suite-styles" href="' + STY_HREF + '">' + (BYID[curStyle].fonts ? '<link rel="stylesheet" data-sfont="' + curStyle + '" href="' + fontHref(BYID[curStyle]) + '">' : ''));
  }
  function ensureLink(id, href, attr) {
    var el = document.getElementById(id) || (attr && document.querySelector('link[data-sfont="' + attr + '"]'));
    if (el) return null;
    el = document.createElement('link'); el.rel = 'stylesheet'; el.href = href; if (id) el.id = id; if (attr) el.setAttribute('data-sfont', attr);
    document.head.appendChild(el); return el;
  }
  function setStyle(id) {
    if (!BYID[id]) return;
    var done = function () { morph(function () { root.setAttribute('data-style', id); curStyle = id; window.dispatchEvent(new CustomEvent('suite:style', { detail: id })); }); };
    try { localStorage.setItem(SKEY, id); } catch (e) { /* ignore */ }
    if (BYID[id].fonts) ensureLink(null, fontHref(BYID[id]), id);
    if (id === 'journal') { done(); return; }
    var l = ensureLink('suite-styles', STY_HREF);
    if (l) { l.onload = done; l.onerror = done; } else done();
  }

  /* ---------- состав набора ---------- */
  var HUB = '../';
  var G = {
    'sapr-labs': '<path d="M5 22c4 0 4-12 8-12s4 8 7 8 3-4 7-4" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>',
    'krrs-robot': '<rect x="11" y="5" width="10" height="15" rx="2" fill="none" stroke="currentColor" stroke-width="2.2" transform="rotate(8 16 20)"/><circle cx="10" cy="23" r="3.6" fill="none" stroke="currentColor" stroke-width="2.2"/><circle cx="22" cy="23" r="3.6" fill="none" stroke="currentColor" stroke-width="2.2"/>',
    'op-coursework': '<circle cx="12" cy="17" r="6.5" fill="none" stroke="currentColor" stroke-width="2.2"/><circle cx="23" cy="11" r="4" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M12 10.5v-2M12 25.5v-2M5.5 17h-2M20.5 17h-2" stroke="currentColor" stroke-width="2"/>',
    'eco-pdv': '<path d="M5 27h22" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M9 27V15h5v12M18 27v-7l6 3v4" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/><circle cx="12.5" cy="10" r="2.4" fill="none" stroke="currentColor" stroke-width="1.9"/><circle cx="17.6" cy="7" r="2.9" fill="none" stroke="currentColor" stroke-width="1.9"/><circle cx="23.6" cy="5.4" r="2" fill="none" stroke="currentColor" stroke-width="1.9"/>'
  };
  var APPS = [
    { id: 'sapr-labs', name: 'Электропривод · ЛР 1–6', sub: 'Расчёт и моделирование ЭП с регуляторами', color: '#0a5aa8' },
    { id: 'krrs-robot', name: 'Робот-балансир · LQR', sub: 'Модель, пространство состояний, LQR', color: '#5a3ea8' },
    { id: 'op-coursework', name: 'Основы проектирования · КП', sub: 'Расчёт привода и файлы для КОМПАС-3D', color: '#0b6e62' },
    { id: 'eco-pdv', name: 'Промышленная экология · ПДВ', sub: 'Задачи 1.1–1.8: выбросы, ПДВ, ущерб', color: '#557313' }
  ];
  function icon(a, size) {
    return '<span class="suite-ic" style="--c:' + a.color + '"><svg width="' + size + '" height="' + size + '" viewBox="0 0 32 32" aria-hidden="true">' + G[a.id] + '</svg></span>';
  }

  /* ---------- меню «Утилиты» ---------- */
  function build() {
    var btn = document.getElementById('apps');
    if (!btn) return;
    var pop = document.createElement('div');
    pop.className = 'suite-pop'; pop.id = 'suite-pop'; pop.hidden = true;
    pop.setAttribute('role', 'menu'); pop.setAttribute('aria-label', 'Утилиты');
    pop.innerHTML = '<div class="suite-h"><span>Утилиты</span><a href="' + HUB + '" role="menuitem">Все утилиты →</a></div>' +
      APPS.map(function (a) {
        var here = a.id === cur;
        return (here ? '<div class="suite-it cur" aria-current="page">' : '<a class="suite-it" role="menuitem" href="../' + a.id + '/">') +
          icon(a, 22) + '<span class="suite-t"><b>' + a.name + '</b><small>' + a.sub + '</small></span>' +
          (here ? '<em>открыта</em></div>' : '</a>');
      }).join('');
    document.body.appendChild(pop);
    btn.setAttribute('aria-haspopup', 'menu'); btn.setAttribute('aria-expanded', 'false'); btn.setAttribute('aria-controls', 'suite-pop');
    var items = function () { return Array.prototype.slice.call(pop.querySelectorAll('a')); };
    function place() {
      var r = btn.getBoundingClientRect(), top = document.querySelector('.top');
      pop.style.top = ((top ? top.getBoundingClientRect().bottom : r.bottom) + 6) + 'px';
      pop.style.right = Math.max(8, document.documentElement.clientWidth - r.right) + 'px';
    }
    function open(focusFirst) {
      place(); pop.hidden = false; btn.setAttribute('aria-expanded', 'true');
      if (focusFirst) { var f = items()[0]; if (f) f.focus(); }
    }
    function close(back) { if (pop.hidden) return; pop.hidden = true; btn.setAttribute('aria-expanded', 'false'); if (back) btn.focus(); }
    btn.addEventListener('click', function () { if (pop.hidden) open(false); else close(false); });
    btn.addEventListener('keydown', function (e) { if (e.key === 'ArrowDown') { e.preventDefault(); open(true); } });
    pop.addEventListener('keydown', function (e) {
      var list = items(), i = list.indexOf(document.activeElement);
      if (e.key === 'Escape') { e.preventDefault(); close(true); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); list[(i + 1) % list.length].focus(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); list[(i - 1 + list.length) % list.length].focus(); }
      else if (e.key === 'Tab') close(false);
    });
    document.addEventListener('click', function (e) { if (!pop.hidden && !e.target.closest('#suite-pop, #apps')) close(false); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !pop.hidden) close(true); });
    window.addEventListener('resize', function () { if (!pop.hidden) place(); });
    window.addEventListener('scroll', function () { if (!pop.hidden) place(); }, { passive: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build); else build();

  /* ---------- меню «Стиль оформления» (кнопка #style) ---------- */
  function buildStyles() {
    var btn = document.getElementById('style');
    if (!btn) return;
    var pop = document.createElement('div');
    pop.className = 'suite-pop'; pop.id = 'style-pop'; pop.hidden = true;
    pop.setAttribute('role', 'menu'); pop.setAttribute('aria-label', 'Стиль оформления');
    function render() {
      pop.innerHTML = '<div class="suite-h"><span>Стиль оформления</span></div>' +
        STYLES.map(function (s) {
          var on = s.id === curStyle;
          return '<button type="button" class="suite-it' + (on ? ' cur' : '') + '" role="menuitemradio" aria-checked="' + on + '" data-style-id="' + s.id + '">' +
            '<span class="suite-sw" style="background:' + s.sw + '"></span><span class="suite-t"><b>' + s.name + '</b></span>' +
            (on ? '<em>выбран</em>' : '') + '</button>';
        }).join('');
    }
    render(); document.body.appendChild(pop);
    btn.setAttribute('aria-haspopup', 'menu'); btn.setAttribute('aria-expanded', 'false'); btn.setAttribute('aria-controls', 'style-pop');
    var items = function () { return Array.prototype.slice.call(pop.querySelectorAll('button')); };
    function place() {
      var r = btn.getBoundingClientRect(), top = document.querySelector('.top');
      pop.style.top = ((top ? top.getBoundingClientRect().bottom : r.bottom) + 6) + 'px';
      pop.style.right = Math.max(8, document.documentElement.clientWidth - r.right) + 'px';
    }
    function open(focusFirst) { render(); place(); pop.hidden = false; btn.setAttribute('aria-expanded', 'true'); if (focusFirst) { var f = pop.querySelector('[aria-checked="true"]') || items()[0]; if (f) f.focus(); } }
    function close(back) { if (pop.hidden) return; pop.hidden = true; btn.setAttribute('aria-expanded', 'false'); if (back) btn.focus(); }
    btn.addEventListener('click', function () { if (pop.hidden) open(false); else close(false); });
    btn.addEventListener('keydown', function (e) { if (e.key === 'ArrowDown') { e.preventDefault(); open(true); } });
    pop.addEventListener('click', function (e) { var b = e.target.closest('[data-style-id]'); if (!b) return; setStyle(b.getAttribute('data-style-id')); close(true); });
    pop.addEventListener('keydown', function (e) {
      var list = items(), i = list.indexOf(document.activeElement);
      if (e.key === 'Escape') { e.preventDefault(); close(true); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); list[(i + 1) % list.length].focus(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); list[(i - 1 + list.length) % list.length].focus(); }
      else if (e.key === 'Tab') close(false);
    });
    document.addEventListener('click', function (e) { if (!pop.hidden && !e.target.closest('#style-pop, #style')) close(false); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !pop.hidden) close(true); });
    window.addEventListener('resize', function () { if (!pop.hidden) place(); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', buildStyles); else buildStyles();

  /* ---------- доступность ---------- */
  var SCROLLERS = '.calc-math, .tbl, .check .body, figure.fig .fig-svg, .code pre.src';
  function markScroll() {
    Array.prototype.forEach.call(document.querySelectorAll(SCROLLERS), function (el) {
      var cs = getComputedStyle(el), sc = function (v) { return v === 'auto' || v === 'scroll'; };
      var over = (sc(cs.overflowX) && el.scrollWidth > el.clientWidth + 1) || (sc(cs.overflowY) && el.scrollHeight > el.clientHeight + 1);
      if (over && !el.hasAttribute('tabindex')) { el.tabIndex = 0; el.setAttribute('data-sx', ''); }
      else if (!over && el.hasAttribute('data-sx')) { el.removeAttribute('tabindex'); el.removeAttribute('data-sx'); }
    });
  }
  var sxQ = 0;
  function queueScroll() { if (sxQ) return; sxQ = requestAnimationFrame(function () { sxQ = 0; markScroll(); }); }
  function a11y() {
    var main = document.getElementById('main');
    if (main && window.MutationObserver) new MutationObserver(queueScroll).observe(main, { childList: true, subtree: true });
    window.addEventListener('resize', queueScroll); queueScroll();
    document.addEventListener('keydown', function (e) {
      var back = document.querySelector('.modal-back'); if (!back) return;
      var box = back.querySelector('[role="dialog"]') || back;
      if (e.key === 'Escape') {
        var esc = box.querySelector('.modal-act .btn:not(.primary)');
        if (esc) { e.preventDefault(); esc.click(); }
      } else if (e.key === 'Tab') {
        var f = Array.prototype.filter.call(box.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'), function (el) { return !el.disabled && el.offsetParent !== null; });
        if (!f.length) return;
        var i = f.indexOf(document.activeElement);
        if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && (i === f.length - 1 || i === -1)) { e.preventDefault(); f[0].focus(); }
      }
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', a11y); else a11y();

  /* ---------- смена вкладки: новый лист мягко проявляется (перерисовка того же этапа — без анимации) ---------- */
  function sheetMotion() {
    var main = document.getElementById('main');
    if (!main || !window.MutationObserver) return;
    var tabOf = function () { var a = document.querySelector('nav.rail a[aria-current="page"]'); return a ? a.getAttribute('data-tab') : null; };
    var last = tabOf();
    new MutationObserver(function () {
      var t = tabOf(); if (t === last) return;
      var first = last === null; last = t;
      var sh = main.querySelector('.sheet');
      if (first || !sh || calm()) return;
      sh.classList.remove('sheet-in'); void sh.offsetWidth; sh.classList.add('sheet-in');
    }).observe(main, { childList: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', sheetMotion); else sheetMotion();

  /* ---------- оглавление: разделы-настройки (section.set) отмечаются значком, как и в самом листе ---------- */
  function markSetToc() {
    Array.prototype.forEach.call(document.querySelectorAll('a[data-toc]'), function (a) {
      var t = document.getElementById(a.getAttribute('data-toc'));
      a.classList.toggle('set', !!(t && t.closest('.set')));
    });
  }
  var stQ = 0;
  function queueSetToc() { if (stQ) return; stQ = requestAnimationFrame(function () { stQ = 0; markSetToc(); }); }
  function setToc() {
    var rail = document.getElementById('rail');
    if (!window.MutationObserver) return;
    if (rail) new MutationObserver(queueSetToc).observe(rail, { childList: true });
    new MutationObserver(queueSetToc).observe(document.body, { childList: true });
    queueSetToc();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setToc); else setToc();

  /* ---------- сообщения и сохранение файлов ---------- */
  var toastT = 0;
  function toast(t) {
    var el = document.getElementById('toast');
    if (!el) { el = document.createElement('div'); el.id = 'toast'; el.className = 'toast'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
    el.textContent = t; el.hidden = false; clearTimeout(toastT); toastT = setTimeout(function () { el.hidden = true; }, 3600);
  }
  function plainSave(name, blob) {
    var url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 1500);
  }
  /* в артефакте разрешены не все расширения: .m, .st, .py, .dxf и т.п. сохраняются с добавкой .txt */
  var OK_EXT = /\.(gif|png|jpe?g|webp|txt|json|md|docx|pptx|epub|csv|ttf|html|svg|pdf|xlsx|zip)$/i;
  function save(name, blob) {
    var c = window.claude;
    if (!c || typeof c.use !== 'function') { plainSave(name, blob); return; }
    var fname = OK_EXT.test(name) ? name : name + '.txt';
    c.use('downloads').then(function (dl) {
      if (!dl) { toast('Сохранение файлов в этом окне недоступно — откройте утилиту в браузере'); return; }
      return dl.save({ filename: fname, data: blob }).then(function () {
        if (fname !== name) toast('Сохранено как ' + fname + ' — уберите «.txt» из имени файла');
      }, function (e) {
        var code = e && e.code;
        if (code === 'declined') return;
        toast(code === 'rate_limited' ? 'Окно сохранения уже открыто — подтвердите или закройте его' : 'Не удалось сохранить файл: ' + ((e && e.message) || code || 'ошибка'));
      });
    }, function () { plainSave(name, blob); });
  }

  /* превью переключателя «Сверка с ручным расчётом» — одинаковое во всех утилитах; f — формула этой утилиты, mine — «ваше» значение */
  function chkEx(f, mine) {
    var box = function (lbl, body, on) { return '<div class="ex' + (on ? ' on' : '') + '"><div class="ex-h"><span class="ex-l">' + lbl + '</span>' + (on ? '<span class="ex-now">сейчас</span>' : '') + '</div><div class="ex-b">' + body + '</div></div>'; };
    var ff = '<div class="ex-f">' + f + '</div>';
    return '<div class="opt-ex">' + box('Выключено', ff, true) + box('Включено', ff + '<div class="ex-chk">Ваше значение <i>' + mine + '</i> <b>✓ совпадает</b></div>', false) + '</div>';
  }

  window.SUITE = { KEY: KEY, chkEx: chkEx, morph: morph, APPS: APPS, icon: icon, save: save, toast: toast, STYLES: STYLES, setStyle: setStyle, style: function () { return curStyle; } };
})();
