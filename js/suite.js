/* suite.js — общий для всех утилит файл (одинаковый в каждом репозитории):
 *  1) тема — одна на все утилиты и хаб (ключ suite-theme), ставится до отрисовки страницы, без мигания;
 *  2) меню «Утилиты» в шапке (кнопка #apps) — переход между утилитами и на хаб.
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

  /* ---------- состав набора ---------- */
  var HUB = '../';
  var G = {
    'sapr-labs': '<path d="M5 22c4 0 4-12 8-12s4 8 7 8 3-4 7-4" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>',
    'krrs-robot': '<rect x="11" y="5" width="10" height="15" rx="2" fill="none" stroke="currentColor" stroke-width="2.2" transform="rotate(8 16 20)"/><circle cx="10" cy="23" r="3.6" fill="none" stroke="currentColor" stroke-width="2.2"/><circle cx="22" cy="23" r="3.6" fill="none" stroke="currentColor" stroke-width="2.2"/>',
    'op-coursework': '<circle cx="12" cy="17" r="6.5" fill="none" stroke="currentColor" stroke-width="2.2"/><circle cx="23" cy="11" r="4" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M12 10.5v-2M12 25.5v-2M5.5 17h-2M20.5 17h-2" stroke="currentColor" stroke-width="2"/>'
  };
  var APPS = [
    { id: 'sapr-labs', name: 'Электропривод · ЛР 1–6', sub: 'Расчёт и моделирование ЭП с регуляторами', color: '#0a5aa8' },
    { id: 'krrs-robot', name: 'Робот-балансир · LQR', sub: 'Модель, пространство состояний, LQR', color: '#5a3ea8' },
    { id: 'op-coursework', name: 'Основы проектирования · КП', sub: 'Расчёт привода и файлы для КОМПАС-3D', color: '#0b6e62' }
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

  window.SUITE = { KEY: KEY, APPS: APPS, icon: icon };
})();
