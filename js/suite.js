/* suite.js — общий для всех утилит файл (одинаковый в каждом репозитории):
 *  1) тема — одна на все утилиты и хаб (ключ suite-theme), ставится до отрисовки страницы, без мигания;
 *  2) меню «Утилиты» в шапке (кнопка #apps) — переход между утилитами и на хаб;
 *  3) доступность, одинаковая везде: прокручиваемые области (длинные формулы, таблицы) получают фокус с клавиатуры,
 *     окна (.modal-back) удерживают фокус внутри и закрываются клавишей Esc (как кнопкой без акцента);
 *  4) сохранение файлов SUITE.save(name, blob): на обычном сайте — скачивание; внутри артефакта claude.ai —
 *     через окно подтверждения (возможность downloads), т.к. там страница не может скачивать сама;
 *  5) стиль оформления — один на все утилиты и хаб (ключ suite-style, атрибут data-style у <html>).
 *     «Журнал» — исходный стиль, полностью описан в suite.css и ни от чего не зависит. Остальные стили —
 *     пакеты в общем файле styles/styles.css репозитория хаба (с текстурами в styles/tx); файл и шрифты стиля
 *     подгружаются только когда выбран не «Журнал». Каждая утилита в каждом стиле получает свои сюжеты фона.
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

  /* ---------- стиль оформления ---------- */
  var SKEY = 'suite-style', SVER = '202610170723';
  var STYLES = [
    { id: 'journal', name: 'Журнал', sub: 'Лабораторный журнал: бумага, штамп, чертёжная точность', sw: 'linear-gradient(135deg,#fbfcfd 0 56%,#dfe5ea 56%)' },
    { id: 'azure', name: 'Лазурь', sub: 'Глянец и стекло, небо со световыми лентами', fonts: 'PT+Mono&family=PT+Sans:ital,wght@0,400;0,700;1,400',
      sw: 'radial-gradient(circle at 32% 30%,#fff 0 9%,rgba(255,255,255,.3) 13%,transparent 15%),linear-gradient(180deg,#1f7fd6,#9fd4f6 62%,#f2fbff)' },
    { id: 'aquarelle', name: 'Акварель', sub: 'Размывы пигмента, коллаж, брызги туши', fonts: 'Oswald:wght@400;500;600&family=Spectral:ital,wght@0,400;0,600;1,400&family=PT+Mono',
      sw: 'radial-gradient(circle at 28% 34%,#7f9fa3 0,transparent 52%),radial-gradient(circle at 74% 68%,#b0583a 0,transparent 50%),radial-gradient(circle at 70% 20%,#c99a4e 0,transparent 45%),#e8e1d2' },
    { id: 'glare', name: 'Засветка', sub: 'Выжженная плёнка, двоение, кадры-сплиты', fonts: 'Oswald:wght@400;500;600;700&family=Roboto+Condensed:ital,wght@0,400;0,500;0,700;1,500',
      sw: 'linear-gradient(transparent 62%,#4e5e4e 62% 64%,transparent 64%),linear-gradient(90deg,transparent 46%,#f7f4ea 46% 52%,transparent 52%),linear-gradient(180deg,#c9e2d2,#f4efd6 60%,#e9d9a8)' },
    { id: 'neon', name: 'Неон', sub: 'Закат восьмидесятых, неоновые рамки', fonts: 'Rubik+Mono+One&family=Press+Start+2P&family=Roboto+Condensed:ital,wght@0,400;0,700;1,700',
      sw: 'radial-gradient(circle at 50% 62%,#ffd34d 0 16%,#ff2fa8 27%,transparent 29%),linear-gradient(180deg,#12041e,#3b0a5c 45%,#b0177f 62%,#12041e 63%)' },
    { id: 'ether', name: 'Эфир', sub: 'Закат в сетке, окна ретро-ОС, сигнал с кассеты', fonts: 'Dela+Gothic+One&family=M+PLUS+Rounded+1c:wght@400;700;800&family=IBM+Plex+Mono:wght@400;500',
      sw: 'repeating-linear-gradient(0deg,transparent 0 3px,#ff32bb 3px 4px) 0 100%/100% 38% no-repeat,radial-gradient(circle at 50% 62%,#fff27a 0 14%,#ff6fb5 22%,transparent 23%),linear-gradient(180deg,#bfe9ff,#ffd9ec 55%,#ffb3d9 62%,#ffe6f3 62%)' },
    { id: 'glass', name: 'Стекло', sub: 'Слои стекла, мягкий цветной свет', fonts: 'Onest:wght@400;500;600;700&family=Unbounded:wght@500;600;700&family=JetBrains+Mono:wght@400;500;600',
      sw: 'radial-gradient(circle at 22% 22%,#8fb8ff,transparent 60%),radial-gradient(circle at 82% 34%,#ffc4a2,transparent 58%),#eef0f5' },
    { id: 'graphite', name: 'Графит', sub: 'Точечная сетка, свечение, строгие числа', fonts: 'Geologica:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600',
      sw: 'radial-gradient(circle,rgba(255,255,255,.28) 1px,transparent 1.6px) 0 0/6px 6px,radial-gradient(circle at 50% 0,#3f74b0,transparent 70%),#08090c' }
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
    var done = function () { root.setAttribute('data-style', id); curStyle = id; window.dispatchEvent(new CustomEvent('suite:style', { detail: id })); };
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
    { id: 'eco-pdv', name: 'Промышленная экология · ПДВ', sub: 'Задачи 1.1–1.6: выбросы, ПДВ, ущерб', color: '#557313' }
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
      pop.innerHTML = '<div class="suite-h"><span>Стиль оформления</span><small class="suite-note">Светлая и тёмная тема — кнопка рядом</small></div>' +
        STYLES.map(function (s) {
          var on = s.id === curStyle;
          return '<button type="button" class="suite-it' + (on ? ' cur' : '') + '" role="menuitemradio" aria-checked="' + on + '" data-style-id="' + s.id + '">' +
            '<span class="suite-sw" style="background:' + s.sw + '"></span><span class="suite-t"><b>' + s.name + '</b><small>' + s.sub + '</small></span>' +
            (on ? '<em>выбран</em>' : (s.id === 'journal' ? '<em class="dim">исходный</em>' : '')) + '</button>';
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

  window.SUITE = { KEY: KEY, APPS: APPS, icon: icon, save: save, toast: toast, STYLES: STYLES, setStyle: setStyle, style: function () { return curStyle; } };
})();
