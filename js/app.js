/* app.js — интерфейс утилиты «Основы проектирования: курсовой проект» */
(function () {
  'use strict';
  const D = window.DATA, F = window.F, TC = window.TASKS_CALC, FG = window.FIGS;
  const fnum = F.fnum;
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const esc = t => String(t === undefined || t === null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const pw = v => String(v === undefined || v === null ? '' : v).replace(/·10\^(-?\d+)/g, (m, e) => '·10<sup>' + e.replace('-', '−') + '</sup>');

  const TABS = [
    { id: 'data', no: '◦', short: 'Данные', t: 'Исходные данные', s: 'Параметры, элементы, методика, отчёт' },
    { id: 'kin', no: '1', short: 'Кинематика', t: 'Привод и кинематика', s: 'Исходные данные, двигатель, u, n, T' },
    { id: 'mat', no: '2', short: 'Материалы', t: 'Материалы', s: 'Допускаемые напряжения' },
    { id: 'gear', no: '3', short: 'Передачи', t: 'Передачи', s: 'Проектный и проверочный расчёт' },
    { id: 'shaft', no: '4', short: 'Валы, корпус', t: 'Валы и корпус', s: 'Диаметры, колёса, корпус, компоновка' },
    { id: 'check', no: '5', short: 'Проверки', t: 'Проверочные расчёты', s: 'Валы, шпонки, подшипники' },
    { id: 'other', no: '6', short: 'Смазка, муфта', t: 'Посадки, смазка, муфта', s: 'Посадки, смазка, муфта, вал барабана' },
    { id: 'kompas', no: 'K', short: 'КОМПАС', t: 'Файлы для КОМПАС-3D', s: 'Макросы, DXF, параметры' }
  ];
  const TAB_TITLE = { kin: 'Исходные данные и кинематический расчёт привода', mat: 'Выбор материалов и допускаемые напряжения', gear: 'Расчёт передач', shaft: 'Валы, зубчатые колёса, корпус и компоновка', check: 'Проверочные расчёты валов, шпонок и подшипников', other: 'Посадки, смазка, муфта' };

  /* ---------------- состояние ---------------- */
  const S = { P: null, R: null, tab: 'data', err: null, T: null };
  const T_DEF = {
    org: 'МИНОБРНАУКИ РОССИИ\nФедеральное государственное бюджетное образовательное учреждение\nвысшего образования\n«Казанский национальный исследовательский технологический университет»\n(ФГБОУ ВО «КНИТУ»)',
    dept: 'ОКПМ', discipline: 'Основы проектирования', topic: '', group: '', student: '', teacher: '', normo: '', city: 'Казань', year: String(new Date().getFullYear()),
    code: '', logo: true, explain: true, watermark: true, frame: true, readable: true, codePlain: true, listings: false, intro: true,
    eqNum: true, numSec: false, where: true, refs: 'num', headLine: 'single', line1: false
  };
  const KEY = { st: 'op-state', auto: 'op-autosave', slots: 'op-slots', title: 'op-title', check: 'op-check', theme: 'op-theme' };
  const lsGet = k => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } };
  function loadT() { S.T = Object.assign({}, T_DEF, lsGet(KEY.title) || {}); }
  function saveT() { lsSet(KEY.title, S.T); autoSave(); }
  function save() { lsSet(KEY.st, { P: S.P, tab: S.tab }); autoSave(); }
  let autoTimer = null;
  function autoSave(now) {
    if (S.skipAuto) { S.skipAuto = false; return; }
    clearTimeout(autoTimer);
    const run = () => {
      if (!S.P || !S.T) return;
      if (!lsSet(KEY.auto, { name: 'Автосохранение', at: Date.now(), mo: S.R && S.R.motor ? S.R.motor.type : '', tab: S.tab, P: S.P, T: S.T })) return;
      const row = $('#slot-auto'); if (row) { row.outerHTML = autoRowHtml(); bindAuto(); }
    };
    if (now) run(); else autoTimer = setTimeout(run, 1200);
  }
  const defP = (P) => TC.defaults(P.listNo, { task: P.task, v: P.v });
  function fresh(listNo, task, v) { const P = TC.defaults(listNo, task ? { task, v } : null); return P; }
  function normP(p) {   // дополнить сохранённое состояние новыми опциями
    const base = fresh(p.listNo || 1, p.task, p.v);
    const out = Object.assign(base, p);
    out.O = Object.assign({}, base.O, p.O || {});
    return out;
  }
  function load() {
    const st = lsGet(KEY.st);
    const h = (location.hash || '').match(/^#n(\d+)(?:t(\d)v(\d+))?(?:-(\w+))?(?:&s=([\w-]+))?$/);
    if (h) {
      const no = Math.min(99, Math.max(1, +h[1]));
      const P = h[2] ? fresh(no, +h[2], +h[3]) : fresh(no);
      if (h[5]) { let diff = {}; try { diff = JSON.parse(decodeURIComponent(escape(atob(h[5].replace(/-/g, '+').replace(/_/g, '/'))))); } catch (e) { diff = {}; } S.P = normP(Object.assign(P, diff, { O: Object.assign({}, P.O, diff.O || {}) })); S.shared = true; }
      else S.P = st && st.P && st.P.listNo === no && st.P.task === P.task && st.P.v === P.v ? normP(st.P) : P;
      S.tab = h[4] || 'data';
    } else if (st && st.P) { S.P = normP(st.P); S.tab = st.tab || 'data'; }
    else { S.P = fresh(13); S.tab = 'data'; }
  }
  function hashOf() { const P = S.P, d = D.byListNo(P.listNo); return '#n' + P.listNo + (d.task !== P.task || d.v !== P.v ? 't' + P.task + 'v' + P.v : '') + '-' + S.tab; }
  function setHash() { try { history.replaceState(null, '', hashOf()); } catch (e) { /* ignore */ } }

  function compute(P) { return TC['task' + P.task](P); }
  function recompute() {
    F.setDig(S.P.dec);
    try { S.R = compute(S.P); S.err = null; } catch (e) { console.error(e); S.err = e; }
    altCache.clear();
    save(); setHash(); renderTop(); renderTab();
  }

  /* ---------------- KaTeX ---------------- */
  function texify(s) { return String(s).replace(/\\text\{([^{}]*)\}/g, (m, t) => '\\text{' + t.replace(/\\/g, '') + '}').replace(/(\\text\{[^{}]*\})|([А-Яа-яЁё][А-Яа-яЁё.]*)/g, (m, a, b) => a || '\\text{' + b + '}'); }
  function tex(s, display) {
    try { return katex.renderToString(texify(s), { displayMode: !!display, throwOnError: false, strict: 'ignore', output: 'html' }); }
    catch (e) { return '<code>' + esc(s) + '</code>'; }
  }
  function eqTex(it) {
    let s = it.lhs;
    const cmp = (it.cmp || '=') + ' ';
    if (it.f) s += cmp + it.f;
    if (it.s) s += (it.f ? '=' : cmp) + it.s;
    const val = it.raw !== undefined ? it.raw : (it.v !== undefined ? F.n(it.v, it.sig) : '');
    const noU = it.raw !== undefined && /\\text\{М/.test(String(it.raw));
    if (val !== '') s += (it.f || it.s ? '=' : cmp) + val + (it.u && !noU ? '\\ \\text{' + it.u + '}' : '');
    return s;
  }
  /* ссылки на источники [[key|место]] */
  const REF_SHORT = { met: 'М', ch: 'Ч', air: 'АИР', gost21424: 'ГОСТ 21424', muvp: 'МУВП', oform: 'КНИТУ' };
  const refsWeb = t => String(t).replace(/\[\[(\w+)\|([^\]]*)\]\]/g, (m, k, w) => `<span class="ref" title="${esc(D.REFS[k] || '')}">[${REF_SHORT[k] || k}, ${w}]</span>`);
  const figRefs = (t, nums) => String(t).replace(/\{fig:(\w+)\}/g, (m, id) => nums[id] || '?');

  /* ---------------- шапка ---------------- */
  function renderTop() {
    const sel = $('#var-sel');
    if (sel.options.length !== 26) sel.innerHTML = Array.from({ length: 26 }, (x, k) => { const d = D.byListNo(k + 1); return `<option value="${k + 1}">${k + 1} · зад. ${d.task}, вар. ${d.v}</option>`; }).join('');
    sel.value = S.P.listNo <= 26 ? S.P.listNo : '';
    $$('nav.rail a').forEach(a => a.setAttribute('aria-current', a.dataset.tab === S.tab ? 'page' : 'false'));
    const R = S.R, foot = $('#rail-foot');
    if (R && foot) foot.innerHTML = `<b>№ ${S.P.listNo} · задание ${S.P.task}, вариант ${S.P.v}</b><br>${esc(D.TASKS[S.P.task].short)}<br>P = ${fnum(S.P.Pout, 0)} кВт, n = ${fnum(S.P.nout, 0)} мин⁻¹<br>${esc(R.motor ? R.motor.type : '')}`;
  }
  function isEdited() { const d = defP(S.P); return ['Pout', 'nout', 'L', 'Kg', 'Kc'].some(k => +d[k] !== +S.P[k]) || JSON.stringify(d.load) !== JSON.stringify(S.P.load); }
  function stamp(tab) {
    const P = S.P, R = S.R, m = TABS.find(t => t.id === tab) || TABS[0], n = TABS.filter(t => /^\d$/.test(t.no)).length;
    const work = tab === 'data' ? 'Данные' : tab === 'kompas' ? 'КОМПАС-3D' : 'Раздел ' + m.no;
    return `<table class="stamp" aria-label="Штамп"><tr><td class="k">Работа</td><td class="v">${work}</td><td class="k">Лист</td><td class="v">${/^\d$/.test(m.no) ? m.no : tab === 'data' ? 0 : '—'} / ${n}</td></tr>
      <tr><td class="k">№ по списку</td><td class="v">${P.listNo}</td><td class="k">Задание</td><td class="v">${P.task}</td></tr>
      <tr><td class="k">Вариант</td><td class="v">${P.v}${isEdited() ? '*' : ''}</td><td class="k sym">P / n</td><td class="v">${fnum(P.Pout, 0)} / ${fnum(P.nout, 0)}</td></tr>
      <tr><td class="k">Двигатель</td><td class="v" colspan="3">${R && R.motor ? esc(R.motor.type) + ', ' + fnum(R.motor.P, 0) + ' кВт, ' + R.motor.n + ' мин⁻¹' : '—'}</td></tr></table>`;
  }

  /* ---------------- вкладки ---------------- */
  function renderTab() {
    const main = $('#main');
    if (S.err) { main.innerHTML = `<div class="sheet"><div class="sheet-body"><div class="note bad" style="margin-top:20px">Ошибка расчёта: ${esc(S.err.message)}. Проверьте исходные данные или верните значения по умолчанию.</div><div class="dact"><button class="btn" id="err-reset">Сбросить к варианту</button></div></div></div>`; $('#err-reset').onclick = () => { S.P = fresh(S.P.listNo, S.P.task, S.P.v); recompute(); }; return; }
    calcSeq = 0; for (const k of Object.keys(CALC)) delete CALC[k]; for (const k of Object.keys(CHKIDX)) delete CHKIDX[k];
    if (S.tab === 'data') renderData(main);
    else if (S.tab === 'kompas') renderKompas(main);
    else renderSec(main, S.tab);
    $$('nav.rail a').forEach(a => a.setAttribute('aria-current', a.dataset.tab === S.tab ? 'page' : 'false'));
    buildToc();
  }

  /* ---------- оглавление вкладки ---------- */
  function tocItems() {
    const out = [];
    $$('#main .sheet-body h2').forEach((el, k) => {
      if (!el.id) el.id = 'sec-' + S.tab + '-' + k;
      const t = el.textContent.trim().replace(/\s+/g, ' ');
      const m = t.match(/^(\d+(?:\.\d+)*)\.?\s+(.*)$/);
      out.push({ id: el.id, no: m ? m[1] : '', t: m ? m[2] : t, el });
    });
    return out;
  }
  let tocList = [], tocLock = null;
  function buildToc() {
    $$('.rail-toc').forEach(x => x.remove());
    tocList = tocItems();
    const fab = $('#toc-fab'); if (fab) fab.remove();
    const pop = $('#toc-pop'); if (pop) pop.remove();
    if (!tocList.length) return;
    const links = tocList.map(it => `<a href="#${it.id}" data-toc="${it.id}"><span class="tn">${it.no || '·'}</span><span>${esc(it.t)}</span></a>`).join('');
    const cur = $(`nav.rail a[data-tab="${S.tab}"]`);
    if (cur) cur.insertAdjacentHTML('afterend', `<div class="rail-toc" aria-label="Разделы">${links}</div>`);
    document.body.insertAdjacentHTML('beforeend', `<button class="toc-fab" id="toc-fab" aria-expanded="false" aria-controls="toc-pop"><svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M2 4h12M2 8h12M2 12h8" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>Разделы</button><div class="toc-pop" id="toc-pop" hidden><div class="toc-pop-h">Разделы<button class="toc-top" data-top>↑ В начало</button></div>${links}</div>`);
    const f = $('#toc-fab'), p = $('#toc-pop');
    f.onclick = () => { const open = p.hidden; p.hidden = !open; f.setAttribute('aria-expanded', String(open)); };
    $('[data-top]', p).onclick = () => { window.scrollTo({ top: 0, behavior: 'smooth' }); p.hidden = true; f.setAttribute('aria-expanded', 'false'); };
    $$('[data-toc]').forEach(a => a.onclick = e => {
      e.preventDefault();
      const el = document.getElementById(a.dataset.toc); if (!el) return;
      const off = (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--top-h')) || 64) + (window.innerWidth <= 960 ? 60 : 16);
      window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - off, behavior: 'smooth' });
      tocLock = a.dataset.toc; markToc(tocLock);
      p.hidden = true; f.setAttribute('aria-expanded', 'false');
    });
    spy();
  }
  ['wheel', 'touchmove', 'keydown', 'mousedown'].forEach(ev => window.addEventListener(ev, e => { if (tocLock && !(e.target.closest && e.target.closest('[data-toc]'))) tocLock = null; }, { passive: true }));
  function markToc(act) { $$('[data-toc]').forEach(a => a.classList.toggle('on', a.dataset.toc === act)); }
  function spy() {
    if (!tocList.length) return;
    if (tocLock) { markToc(tocLock); return; }
    const lim = window.innerWidth <= 960 ? 150 : 110;
    let act = tocList[0].id;
    for (const it of tocList) { if (it.el.getBoundingClientRect().top - lim <= 0) act = it.id; else break; }
    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) for (const it of tocList) { const r = it.el.getBoundingClientRect(); if (r.top < window.innerHeight * 0.6) act = it.id; }
    markToc(act);
    const on = $('.rail-toc a.on'), box = $('nav.rail');
    if (on && box && box.scrollHeight > box.clientHeight) { const r = on.getBoundingClientRect(), b = box.getBoundingClientRect(); if (r.top < b.top || r.bottom > b.bottom) on.scrollIntoView({ block: 'nearest' }); }
  }
  let spyRaf = 0;
  window.addEventListener('scroll', () => { if (!spyRaf) spyRaf = requestAnimationFrame(() => { spyRaf = 0; spy(); }); }, { passive: true });
  document.addEventListener('click', e => { const p = $('#toc-pop'); if (p && !p.hidden && !e.target.closest('#toc-pop, #toc-fab')) { p.hidden = true; const f = $('#toc-fab'); if (f) f.setAttribute('aria-expanded', 'false'); } });

  /* ---------- подсказки над схемами ---------- */
  (function () {
    let tip = null;
    const show = (g, x, y) => {
      if (!tip) { tip = document.createElement('div'); tip.className = 'tipbox'; tip.setAttribute('role', 'tooltip'); document.body.appendChild(tip); }
      const [nm, d] = g.dataset.tip.split('|');
      tip.innerHTML = `<b>${esc(nm)}</b>${d ? `<span>${esc(d)}</span>` : ''}`;
      tip.style.display = 'block';
      const w = tip.offsetWidth, h = tip.offsetHeight;
      tip.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, x - w / 2)) + 'px';
      tip.style.top = (y - h - 12 < 8 ? y + 18 : y - h - 12) + 'px';
    };
    const hide = () => { if (tip) tip.style.display = 'none'; };
    document.addEventListener('mousemove', e => { const g = e.target.closest && e.target.closest('[data-tip]'); if (g) show(g, e.clientX, e.clientY); else hide(); });
    document.addEventListener('focusin', e => { const g = e.target.closest && e.target.closest('[data-tip]'); if (g) { const r = g.getBoundingClientRect(); show(g, r.left + r.width / 2, r.top); } });
    document.addEventListener('focusout', hide);
    window.addEventListener('scroll', hide, { passive: true });
  })();

  /* ---------- вкладка «Данные» ---------- */
  function fld(key, sym, label, unit, val, changed, hint, scope) {
    return `<div class="fld${changed ? ' changed' : ''}"><label for="f-${key}"><span>${label}</span><span class="sym">${sym}</span></label>
      <div class="inp${unit ? ' has-u' : ''}"><input id="f-${key}" data-${scope === 'O' ? 'okey' : 'key'}="${key}" inputmode="decimal" value="${esc(typeof val === 'number' ? String(+val.toPrecision(10)).replace('.', ',') : val)}" autocomplete="off">${unit ? `<span class="unit">${unit}</span>` : ''}</div>${hint ? `<span class="hint">${hint}</span>` : ''}</div>`;
  }
  function optRow(title, desc, ctl, pvKey, exRaw) {
    const ex = exRaw ? `<div class="opt-ex">${exRaw}</div>` : pvKey && PV[pvKey] ? `<div class="opt-ex" data-pv="${pvKey}"><div class="ex-wait"><span class="spinner"></span>Сравнение…</div></div>` : '';
    return `<div class="opt${ctl.startsWith('<div class="seg"') ? ' has-seg' : ''}"><div class="opt-t"><b>${title}</b>${desc ? `<span>${desc}</span>` : ''}</div><div class="opt-c">${ctl}</div>${ex}</div>`;
  }
  function seg(scope, key, cur, opts, kind) {
    return `<div class="seg" role="radiogroup" data-scope="${scope}" data-key="${key}" data-kind="${kind}">${opts.map(([v, l]) => `<button type="button" role="radio" aria-checked="${String(v) === String(cur)}" data-val="${v}">${l}</button>`).join('')}</div>`;
  }
  function sw(key) { return `<label class="sw"><input type="checkbox" data-tkey="${key}" ${S.T[key] ? 'checked' : ''}><span class="track" aria-hidden="true"></span><span class="sr">вкл.</span></label>`; }
  function swO(key) { return `<label class="sw"><input type="checkbox" data-obool="${key}" ${S.P.O[key] ? 'checked' : ''}><span class="track" aria-hidden="true"></span><span class="sr">вкл.</span></label>`; }

  /* сравнение вариантов настройки: пересчёт с другим значением */
  const altCache = new Map();
  function altR(patchO) {
    const key = JSON.stringify(patchO);
    if (altCache.has(key)) return altCache.get(key);
    let R = null;
    try { R = compute(Object.assign({}, S.P, { O: Object.assign({}, S.P.O, patchO) })); } catch (e) { R = null; }
    altCache.set(key, R); return R;
  }
  const segOrder = sg => sg ? [...sg.querySelectorAll('button[data-val]')].map(b => b.dataset.val) : null;
  const exF = t => `<div class="ex-f">${t}</div>`;
  /* PV[key] = { vals: [[value, label]], show: R => [строки] } */
  const motorLine = R => `Двигатель ${R.motor.type}: ${fnum(R.motor.P, 0)} кВт, ${R.motor.n} мин⁻¹`;
  const lastCheck = (R, rx) => { for (const s of R.sections) for (const it of s.items) if (it.k === 'eq' && rx.test(it.lhs)) return it; return null; };
  const PV = {
    sync: { vals: [[1500, '1500 мин⁻¹'], [1000, '1000 мин⁻¹'], [3000, '3000 мин⁻¹']], show: R => [motorLine(R), R.task === 3 ? `u<sub>ч</sub> = ${fnum(R.g.uf, 0)}, a<sub>w</sub> = ${fnum(R.g.aw)} мм` : R.task === 6 ? `u<sub>б</sub>/u<sub>т</sub> = ${fnum(R.gB.uf, 3)}/${fnum(R.gT.uf, 3)}, a<sub>w.т</sub> = ${fnum(R.gT.aw)} мм` : `d<sub>e1</sub> = ${fnum(R.gC.de1)} мм, a<sub>w</sub> = ${fnum(R.gT.aw)} мм`] },
    uChain: { vals: [[2, '2'], [2.5, '2,5'], [3, '3']], show: R => [`цепь ${R.chn.code}, z<sub>1</sub>/z<sub>2</sub> = ${R.chn.z1}/${R.chn.z2}`, R.task === 3 ? `u<sub>ч</sub> = ${fnum(R.g.uf, 0)}, a<sub>w</sub> = ${fnum(R.g.aw)} мм` : `u<sub>б</sub>/u<sub>т</sub> = ${fnum(R.gB.uf, 3)}/${fnum(R.gT.uf, 3)}`] },
    wormAw: { vals: [['ch', 'Чернавский (4.19)'], ['met', 'Методичка, K<sub>a</sub> = 610']], show: R => [`a<sub>w</sub> расч. = ${fnum(R.g.awr)} мм → ${fnum(R.g.aw)} мм`, `m = ${fnum(R.g.m, 0)} мм, q = ${fnum(R.g.q, 0)}`, `σ<sub>H</sub> = ${fnum(R.st.sigH)} МПа`] },
    wormSH: { vals: [['met', 'Формулы методички'], ['ch', 'Таблицы 4.8, 4.9 [Ч]']], show: R => [`[σ]<sub>H</sub> = ${fnum(R.ck.sH)} МПа`, `[σ]<sub>F</sub> = ${fnum(R.mt.sF)} МПа`, `a<sub>w</sub> = ${fnum(R.g.aw)} мм`] },
    KHLmode: { vals: [['met', 'K<sub>HL</sub> = 1 при N > 10⁷'], ['ch', 'По формуле, ≥ 0,67']], cur: () => S.P.O.KHLmode || 'met', show: R => [`[σ]<sub>H</sub> = ${fnum(R.ck.sH)} МПа`, `a<sub>w</sub> = ${fnum(R.g.aw)} мм, m = ${fnum(R.g.m, 0)} мм`] },
    etaWpre: { vals: [[0.7, '0,70'], [0.75, '0,75'], [0.8, '0,80']], show: R => [`P<sub>расч</sub> = ${fnum(R.eta0.Preq)} кВт → ${R.motor.type}`, `η<sub>ч</sub> уточн. = ${fnum(R.ck.eta, 3)}`] },
    wormDeg: { vals: [['auto', 'По v<sub>s</sub>'], [7, '7-я'], [8, '8-я']], show: R => [`степень ${R.st.deg}, K<sub>v</sub> = ${fnum(R.st.Kv, 0)}`, `σ<sub>H</sub> = ${fnum(R.st.sigH)} МПа`] },
    wormNe: { vals: [['simple', 'N = 60·n·t<sub>Σ</sub>'], ['load', 'По графику нагрузки']], show: R => [`K<sub>FL</sub> = ${fnum(R.mt.KFL, 3)}, [σ]<sub>F</sub> = ${fnum(R.mt.sF)} МПа`] },
    awRow: { vals: [[0, 'Оба ряда'], [1, '1-й ряд']], show: R => [R.task === 6 ? `a<sub>w.б</sub> = ${fnum(R.gB.awStd)} мм, a<sub>w.т</sub> = ${fnum(R.gT.awStd)} мм` : `a<sub>w</sub> = ${fnum(R.gT.awStd)} мм`] },
    zMode: { vals: [['met', 'z₁ → z₂ = u·z₁'], ['sum', 'Через z<sub>Σ</sub>']], show: R => { const g = R.task === 6 ? R.gT : R.gT; return [`z = ${g.z1}/${g.z2}, u<sub>ф</sub> = ${fnum(g.uf, 3)}`, `a<sub>w</sub> ф. = ${fnum(g.aw)} мм`]; } },
    wKey: { vals: [['met', 'd<sub>расч</sub> = 0,9d'], ['net', 'W с учётом паза']], show: R => { const c = (R.ch2 || R.ch1).secs.find(s => s.si !== undefined) || (R.ch2 || R.ch1).secs[0]; return [`вал II: σ<sub>экв</sub> = ${fnum(c.se)} / [σ] = ${fnum(c.allow)} МПа`]; } },
    keyExact: { vals: [[false, '4,4T/(d·h·l<sub>р</sub>)'], [true, '2T/(d(h−t₁)l<sub>р</sub>)']], show: R => R.keys.slice(0, 3).map(k => `${esc(k.title.split('—')[1] || k.title)}: σ<sub>см</sub> = ${fnum(k.s)} МПа`) },
    FmMode: { vals: [['gost', 'ГОСТ 16162'], ['met', '(0,2…0,5)·2T/D₀']], show: R => [`F<sub>м</sub> = ${fnum(R.Fm || 0)} Н`] },
    awT6: { vals: [['met', 'Момент колеса'], ['pin', 'Момент шестерни']], show: R => [`a<sub>w.б</sub> = ${fnum(R.gB.aw)} мм, a<sub>w.т</sub> = ${fnum(R.gT.aw)} мм`, `σ<sub>H.т</sub> = ${fnum(R.cT.sH)} МПа`] },
    wormSHcheck: { vals: [['met', 'Методичка'], ['ch', 'Чернавский (4.23)']], show: R => [`σ<sub>H</sub> = ${fnum(R.st.sigH)} / [σ]<sub>H</sub> = ${fnum(R.ck.sH)} МПа`, `a<sub>w</sub> = ${fnum(R.g.aw)} мм`] },
    t1Coup: { vals: [['met', 'T<sub>2Т</sub> = T<sub>в</sub>/η<sub>м</sub>'], ['scheme', 'T<sub>2Т</sub> = T<sub>в</sub>']], show: R => [`T<sub>2Т</sub> = ${fnum(R.K.T2T)} Н·м, T<sub>1Б</sub> = ${fnum(R.K.T1B)} Н·м`] },
    autoFix: { vals: [[true, 'Включено (как в методичке)'], [false, 'Выключено']], cur: () => S.P.O.autoFix !== false, show: R => { let bad = 0; for (const s of R.sections) for (const it of s.items) if (it.k === 'check' && !it.ok) bad++; return R.summary.slice(1).map(([k, v]) => `${esc(k)}: ${v}`).concat(bad ? `не выполняется проверок: ${bad}` : 'все проверки выполняются'); } },
    Fm1: { vals: [[false, 'Нет'], [true, 'Да']], show: R => { const c = R.ch1.secs[0]; return [`R<sub>A</sub> = ${fnum(R.B1.RA)} Н, R<sub>B</sub> = ${fnum(R.B1.RB)} Н`, `σ<sub>экв</sub> = ${fnum(c.se)} МПа`]; } }
  };
  /* карточки вариантов идут в том же порядке, что и кнопки переключателя */
  const byOrder = (vals, order) => order && order.length ? vals.slice().sort((a, b) => (order.indexOf(String(a[0])) + 1 || 99) - (order.indexOf(String(b[0])) + 1 || 99)) : vals;
  function pvHtml(key, order) {
    const d = PV[key], cur = d.cur ? d.cur() : S.P.O[key] === undefined ? (key === 'dec' ? S.P.dec : undefined) : S.P.O[key];
    const items = byOrder(d.vals, order).map(([v, l]) => {
      const on = String(v) === String(cur);
      const R = on ? S.R : altR({ [key]: v });
      const body = R ? d.show(R).map(exF).join('') : exF('расчёт с этой настройкой не выполняется');
      return `<div class="ex${on ? ' on' : ''}"><div class="ex-h"><span class="ex-l">${l}</span>${on ? '<span class="ex-now">сейчас</span>' : ''}</div><div class="ex-b">${body}</div></div>`;
    });
    return `<div class="ex-multi" style="--n:${items.length}">${items.join('')}</div>`;
  }
  /* превью настроек записки: как выглядит лист при каждом значении (DPV[key] = { vals: [[значение, подпись]], page: значение => html }) */
  const DEQ = 'F<sub>t2</sub> = 2·10³·T<sub>II</sub>/d<sub>2</sub> = 2·10³·412/250 = 3296 Н';
  const dPaper = (inner, cls) => `<div class="ex-paper${cls ? ' ' + cls : ''}">${inner}</div>`;
  const dFig = cap => `<svg viewBox="0 0 300 100" preserveAspectRatio="none"><rect x="70" y="14" width="160" height="72" fill="none" stroke="#7d8996"/><circle cx="120" cy="50" r="22" fill="none" stroke="#7d8996"/><circle cx="190" cy="50" r="14" fill="none" stroke="#7d8996"/><path d="M60 50H240" stroke="#7d8996" stroke-dasharray="6 3 1 3"/></svg><p class="cap">${cap}</p>`;
  const DPV = {
    frame: { vals: [[false, 'Без рамки'], [true, 'С рамкой (ГОСТ 2.104)']], page: v => v ? dPaper(`<p>…расчёт тихоходного вала.</p><div class="ex-stamp"><span>Изм.</span><span>Лист</span><span>${esc(S.T.code || codeDefault())} 00.00.00 ПЗ</span><span>7</span></div>`, 'framed') : dPaper('<p>…расчёт тихоходного вала.</p><p class="foot">7</p>') },
    logo: { vals: [[false, 'Без логотипа'], [true, 'С логотипом']], page: v => dPaper(`${v ? '<b class="ex-logo">КНИТУ</b>' : ''}<p>МИНОБРНАУКИ РОССИИ</p><p>Федеральное государственное бюджетное образовательное учреждение высшего образования</p><p>«Казанский национальный исследовательский технологический университет»</p>`, 'title') },
    explain: { vals: [[false, 'Только формулы'], [true, 'С пояснениями']], page: v => dPaper(`${v ? '<p>Окружная сила на колесе определяется передаваемым моментом и делительным диаметром:</p>' : ''}<div class="ex-math">${DEQ}</div>`) },
    where: { vals: [[false, 'Без расшифровки'], [true, 'С «где …» (как в методичке)']], page: v => dPaper(`<div class="ex-math">F<sub>t2</sub> = 2·10³·T<sub>II</sub>/d<sub>2</sub></div>${v ? '<p class="where">где T<sub>II</sub> – момент на тихоходном валу, Н·м; d<sub>2</sub> – делительный диаметр колеса, мм.</p>' : ''}`) },
    eqNum: { vals: [[false, 'Без номеров'], [true, 'С номерами']], page: v => dPaper(`<div class="ex-math">${DEQ}${v ? '<span class="ex-no">(12)</span>' : ''}</div>`) },
    numSec: { vals: [[false, 'Сквозная (как в методичке)'], [true, 'По разделам']], page: v => dPaper(`<div class="ex-math">${DEQ}<span class="ex-no">${v ? '(3.4)' : '(12)'}</span></div><p class="cap">Таблица ${v ? '3.2' : '5'} – Параметры зацепления</p><p class="cap">Рисунок ${v ? '3.1' : '4'} – Схема сил в зацеплении</p>`) },
    refs: { vals: [['num', '[1] (как в методичке)'], ['full', '[1, с. 5]'], ['none', 'Без ссылок']], page: v => dPaper(`<p>Коэффициент нагрузки принимаем K<sub>Hβ</sub> = 1,1${v === 'num' ? ' [1]' : v === 'full' ? ' [1, с. 32]' : ''}.</p>`) },
    headLine: { vals: [['single', 'Одинарная'], ['double', 'Двойная'], ['thick', 'Толстая']], page: v => dPaper(`<table class="ex-tt ${v}"><thead><tr><th>Параметр</th><th>Значение</th></tr></thead><tbody><tr><td>a<sub>w</sub>, мм</td><td>160</td></tr></tbody></table>`) },
    line1: { vals: [[false, '1,5 (как в методичке)'], [true, '1,0']], page: v => dPaper('<p>Привод предназначен для передачи вращения от электродвигателя к рабочему органу через редуктор и открытую передачу.</p>', v ? 'lh10' : 'lh15') },
    watermark: { vals: [[false, 'Без подложки'], [true, 'С подложкой']], page: v => dPaper(`${dFig('Рисунок 4 – Эскизная компоновка редуктора')}${v ? '<div class="ex-wm"><b>Замените рисунком из КОМПАС</b><span>Что вставить: эскизная компоновка редуктора.</span><span>Откуда: сборка «Редуктор», вид сверху.</span></div>' : ''}`, 'fig') },
    readable: { vals: [[false, 'Обычный перенос'], [true, 'Блок целиком']], page: v => { const brk = '<div class="ex-brk"><span>разрыв страницы</span></div>'; return v ? dPaper(`<p>…конец предыдущего расчёта.</p><p class="gap">свободное место</p>${brk}<p>Окружная сила на колесе:</p><div class="ex-math">${DEQ}</div>`) : dPaper(`<p>…конец предыдущего расчёта.</p><p>Окружная сила на колесе:</p>${brk}<div class="ex-math">${DEQ}</div>`); } },
    listings: { vals: [[false, 'Без листингов'], [true, 'С листингами']], page: v => dPaper(`<p class="h">Список использованных источников</p><p class="cap">1. Чернавский С. А. Курсовое проектирование деталей машин…</p>${v ? '<p class="h">Приложение Г. Листинги макросов КОМПАС</p><pre>import pythoncom\nfrom win32com.client import Dispatch</pre>' : ''}`) },
    codePlain: { vals: [[false, 'Courier New'], [true, 'Times New Roman']], page: v => dPaper(`<pre class="${v ? 'serif' : 'mono'}">kompas = Dispatch("Kompas.Application.7")\napp.Visible = True</pre>`) }
  };
  function dpvHtml(key, order) {
    const d = DPV[key], cur = S.T[key] === undefined ? T_DEF[key] : S.T[key];
    const items = byOrder(d.vals, order || segOrder($(`.seg[data-key="${key}"]`))).map(([v, l]) => { const on = String(v) === String(cur); return `<div class="ex${on ? ' on' : ''}"><div class="ex-h"><span class="ex-l">${l}</span>${on ? '<span class="ex-now">сейчас</span>' : ''}</div><div class="ex-b">${d.page(v)}</div></div>`; });
    return items.length === 2 ? items.join('') : `<div class="ex-multi" style="--n:${items.length}">${items.join('')}</div>`;
  }
  function refreshDpv(key) { const el = $(`.opt-ex[data-dpv="${key}"]`); if (el && DPV[key]) el.innerHTML = dpvHtml(key); }
  /* строка настройки записки — с превью листа, как в остальных утилитах */
  function docRow(title, desc, ctl) {
    const key = (ctl.match(/data-t?key="(\w+)"/) || [])[1];
    return optRow(title, desc, ctl, null, key && DPV[key] ? dpvHtml(key, [...ctl.matchAll(/data-val="([^"]*)"/g)].map(m => m[1])) : '').replace('<div class="opt-ex">', `<div class="opt-ex" data-dpv="${key}">`);
  }
  async function fillPv() {
    for (const el of $$('.opt-ex[data-pv]')) {
      await sleep(0);
      if (!document.body.contains(el)) return;
      try { el.innerHTML = pvHtml(el.dataset.pv, segOrder(el.parentElement.querySelector('.seg'))); } catch (e) { console.error(e); el.innerHTML = ''; }
    }
  }
  function decPv() {
    const R = S.R, cur = S.P.dec === undefined ? -1 : +S.P.dec;
    const w = k => k === 1 ? 'знак' : k < 5 ? 'знака' : 'знаков';
    const f = (x, k) => k < 0 ? F.fauto(x) : F.fdec(x, k);
    const cols = [['P<sub>расч</sub>, кВт', R.Preq], ['T<sub>I</sub>, Н·м', R.K.TI || R.K.T1B], ['t<sub>Σ</sub>, ч', R.tS], ['η<sub>общ</sub>', R.eta]];
    return `<div class="ex on ex-wide"><div class="ex-b"><table class="ex-tbl"><thead><tr><th>Режим</th>${cols.map(c => `<th>${c[0]}</th>`).join('')}</tr></thead><tbody>${[-1, 1, 2, 3, 4].map(k => `<tr class="${k === cur ? 'on' : ''}"><td>${k < 0 ? 'Авто' : k + ' ' + w(k)}${k === cur ? ' <span>сейчас</span>' : ''}</td>${cols.map(c => `<td>${f(c[1], k)}</td>`).join('')}</tr>`).join('')}</tbody></table></div></div>`;
  }

  /* ---------- ссылка «поделиться» ---------- */
  function shareUrl() {
    const base = defP(S.P), diff = {};
    for (const k of Object.keys(S.P)) if (!['listNo', 'task', 'v', 'O'].includes(k) && JSON.stringify(S.P[k]) !== JSON.stringify(base[k])) diff[k] = S.P[k];
    const dO = {}; for (const k of Object.keys(S.P.O)) if (JSON.stringify(S.P.O[k]) !== JSON.stringify(base.O[k])) dO[k] = S.P.O[k];
    if (Object.keys(dO).length) diff.O = dO;
    let h = hashOf();
    if (Object.keys(diff).length) h += '&s=' + btoa(unescape(encodeURIComponent(JSON.stringify(diff)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    return location.href.split('#')[0] + h;
  }
  function share() { copyText(shareUrl(), 'Ссылка скопирована: по ней откроется этот же расчёт'); }

  /* ---------- слоты сохранений ---------- */
  const SLOT_N = 5;
  function getSlots() { let a = lsGet(KEY.slots); a = Array.isArray(a) ? a : []; while (a.length < SLOT_N) a.push(null); return a.slice(0, SLOT_N); }
  function putSlots(a) { if (lsSet(KEY.slots, a)) return true; toast('Браузер не разрешает сохранять данные на этой странице'); return false; }
  function slotMeta(sl) {
    const d = new Date(sl.at), p2 = x => String(x).padStart(2, '0');
    return `№ ${sl.P.listNo} (зад. ${sl.P.task}, вар. ${sl.P.v})${sl.mo ? ' · ' + esc(sl.mo) : ''}${sl.T && sl.T.student ? ' · ' + esc(sl.T.student) : ''} · ${p2(d.getDate())}.${p2(d.getMonth() + 1)}.${d.getFullYear()} ${p2(d.getHours())}:${p2(d.getMinutes())}`;
  }
  function autoRowHtml() {
    const sl = lsGet(KEY.auto);
    return `<div class="opt slot auto" id="slot-auto"><div class="opt-t"><b><i class="slot-no">А</i>Автосохранение</b><span>${sl ? slotMeta(sl) + ' · обновляется само после каждого изменения; загрузка слота его не затирает' : 'Появится после первого изменения'}</span></div><div class="opt-c slot-act">${sl ? '<button class="btn primary" id="slot-auto-load">Загрузить</button>' : ''}</div></div>`;
  }
  function bindAuto() {
    const b = $('#slot-auto-load'); if (!b) return;
    b.onclick = () => { const sl = lsGet(KEY.auto); if (!sl) return; S.P = normP(sl.P); S.T = Object.assign({}, T_DEF, sl.T || {}); S.skipAuto = true; saveT(); S.skipAuto = true; recompute(); toast('Загружено автосохранение'); };
  }
  function slotsHtml() {
    return autoRowHtml() + getSlots().map((sl, k) => `<div class="opt slot${sl ? '' : ' empty'}"><div class="opt-t"><b><i class="slot-no">${k + 1}</i>${sl ? esc(sl.name) : 'Пустой слот'}</b><span>${sl ? slotMeta(sl) : 'Сохраните сюда текущее состояние'}</span></div><div class="opt-c slot-act">
      <button class="btn" data-slot-save="${k}">${sl ? 'Перезаписать' : 'Сохранить'}</button>${sl ? `<button class="btn primary" data-slot-load="${k}">Загрузить</button><button class="btn icon-x" data-slot-del="${k}" title="Удалить" aria-label="Удалить слот ${k + 1}">✕</button>` : ''}</div></div>`).join('');
  }
  function bindSlots() {
    const box = $('#slots'); if (!box) return;
    const redraw = () => { box.innerHTML = slotsHtml(); bindSlots(); };
    bindAuto();
    $$('[data-slot-save]', box).forEach(b => b.onclick = () => {
      const k = +b.dataset.slotSave, a = getSlots();
      const def = a[k] ? a[k].name : '№ ' + S.P.listNo + (S.T.student ? ' — ' + S.T.student : '');
      const name = prompt('Название сохранения', def); if (name === null) return;
      a[k] = { name: name.trim() || def, at: Date.now(), mo: S.R && S.R.motor ? S.R.motor.type : '', P: JSON.parse(JSON.stringify(S.P)), T: JSON.parse(JSON.stringify(S.T)) };
      if (putSlots(a)) { toast('Сохранено в слот ' + (k + 1)); redraw(); }
    });
    $$('[data-slot-load]', box).forEach(b => b.onclick = () => {
      const sl = getSlots()[+b.dataset.slotLoad]; if (!sl) return;
      autoSave(true);
      S.P = normP(sl.P); S.T = Object.assign({}, T_DEF, sl.T || {}); S.skipAuto = true; saveT();
      S.skipAuto = true; recompute(); toast('Загружено: ' + sl.name);
    });
    $$('[data-slot-del]', box).forEach(b => b.onclick = () => {
      const k = +b.dataset.slotDel, a = getSlots(); if (!a[k] || !confirm('Удалить сохранение «' + a[k].name + '»?')) return;
      a[k] = null; if (putSlots(a)) redraw();
    });
    const ex = $('#slots-exp'); if (ex) ex.onclick = () => downloadText('op-kp-sohraneniya.json', JSON.stringify({ app: 'op-kp', ver: 1, current: { P: S.P, T: S.T }, slots: getSlots() }, null, 1));
    const im = $('#slots-imp-f'); if (im) im.onchange = () => {
      const f = im.files && im.files[0]; if (!f) return;
      const rd = new FileReader();
      rd.onload = () => {
        try {
          const j = JSON.parse(rd.result); if (!j || j.app !== 'op-kp' || !Array.isArray(j.slots)) throw new Error('fmt');
          const a = getSlots(); let n = 0;
          j.slots.forEach(sl => { if (!sl || !sl.P) return; const k = a.findIndex(x => !x); if (k < 0) return; a[k] = sl; n++; });
          if (putSlots(a)) { toast(n ? 'Импортировано сохранений: ' + n : 'Нет свободных слотов или пустой файл'); redraw(); }
        } catch (e) { toast('Это не файл сохранений утилиты'); }
        im.value = '';
      };
      rd.readAsText(f);
    };
  }

  function codeDefault() { const p2 = x => String(x).padStart(2, '0'); return 'ОП КП ' + p2(S.P.task) + '-' + p2(S.P.v); }
  /* последствия выбора двигателя (ручной выбор или нерекомендуемая синхронная частота) */
  function motorAuditHtml() {
    if (!S.R || !TC.motorAudit) return '';
    const R0 = altR({ motor: 'auto', sync: 1500 });
    const a = TC.motorAudit(S.P, S.R, R0);
    if (!a.custom) return '';
    const bad = a.items.filter(x => x.lvl === 'bad'), warn = a.items.filter(x => x.lvl === 'warn'), info = a.items.filter(x => x.lvl === 'info');
    const head = bad.length ? `<b>Выбранный двигатель ${esc(S.R.motor.type)}: несостыковок в расчёте — ${bad.length}${warn.length ? `, замечаний — ${warn.length}` : ''}.</b>`
      : warn.length ? `<b>Двигатель ${esc(S.R.motor.type)} не рекомендуется: замечаний — ${warn.length}.</b> Все проверки расчёта выполняются${S.P.O.autoFix !== false ? ' — с учётом размеров, которые утилита при необходимости увеличила сама (см. сравнение ниже)' : ''}.`
        : `<b>Двигатель ${esc(S.R.motor.type)}: все проверки расчёта выполняются.</b>`;
    const li = x => `<li class="ma-${x.lvl}"><b>${x.where}:</b> ${x.text}</li>`;
    return `<div class="note ${bad.length ? 'bad' : warn.length ? 'warn' : ''} motor-audit" id="motor-audit">${head}${a.items.length ? `<ul>${bad.concat(warn, info).map(li).join('')}</ul>` : ''}<p class="hint">Рекомендуемый вариант — «Автоматически» при синхронной частоте 1500 мин⁻¹${R0 && R0.motor ? ` (${esc(R0.motor.type)})` : ''}.</p></div>`;
  }
  function renderData(main) {
    const P = S.P, R = S.R, O = P.O, V = defP(P), task = D.TASKS[P.task];
    const mcands = D.MOTORS.filter(m => m.P >= R.Preq * 0.999).sort((a, b) => a.P - b.P || b.sync - a.sync).filter((m, i, a) => a.findIndex(x => x.sync === m.sync && x.P === m.P) === i).slice(0, 16);
    const motorOpts = `<option value="auto">Автоматически — синхронная частота ${O.sync} мин⁻¹</option>` + mcands.map(m => `<option value="${esc(m.type)}">${esc(m.type)} — ${fnum(m.P, 0)} кВт, ${m.n} мин⁻¹ (n<sub>c</sub> ${m.sync})</option>`.replace(/<\/?sub>/g, '')).join('');
    const vrows = task.P.map((p, k) => `<tr data-v="${k + 1}" class="${k + 1 === P.v ? 'on' : ''}"><td class="num">${k + 1}</td><td class="num">${fnum(p, 0)}</td><td class="num">${task.n[k]}</td></tr>`).join('');
    const loadTxt = P.load.map(([k, t]) => fnum(k, 0) + 'T — ' + fnum(t, 0) + 't').join('; ');
    const ch = (k) => +V[k] !== +P[k];
    const isT = t => P.task === t;
    main.innerHTML = `<article class="sheet">
      <header class="sheet-head"><div><div class="eyebrow">Задание ${P.task} · ${esc(task.short)}</div><h1>№ ${P.listNo} — задание ${P.task}, вариант ${P.v}</h1>
        <p class="lead">${esc(task.full)} Выберите номер по списку вверху страницы — задание и вариант определяются автоматически (1–10 → задание 1, 11–20 → задание 3, 21–26 → задание 6; вариант — последняя цифра, 0 → 10). Любое значение можно изменить: изменённые поля подсвечиваются.</p></div>
        ${stamp('data')}
      </header>
      <div class="sheet-body rep data-page">
        <section class="dsec">
          <h2>1. Параметры варианта</h2>
          <div class="form-grid fg4">
            <div class="fld"><label for="f-listNo"><span>Номер по списку</span><span class="sym">№</span></label><div class="inp"><input id="f-listNo" inputmode="numeric" value="${P.listNo}"></div></div>
            <div class="fld"><label for="f-task"><span>Задание</span><span class="sym">табл.</span></label><select id="f-task">${[1, 3, 6].map(t => `<option value="${t}" ${t === P.task ? 'selected' : ''}>Задание ${t} — ${esc(D.TASKS[t].short)}</option>`).join('')}</select></div>
            <div class="fld"><label for="f-v"><span>Вариант</span><span class="sym">1…10</span></label><select id="f-v">${Array.from({ length: 10 }, (x, k) => `<option value="${k + 1}" ${k + 1 === P.v ? 'selected' : ''}>${k + 1}</option>`).join('')}</select></div>
            ${fld('Pout', 'P<sub>вых</sub>', 'Мощность на выходном валу', 'кВт', P.Pout, ch('Pout'))}
            ${fld('nout', 'n<sub>вых</sub>', 'Частота вращения', 'мин⁻¹', P.nout, ch('nout'))}
            ${fld('L', 'L', 'Срок службы', 'лет', P.L, ch('L'))}
            ${fld('Kg', 'K<sub>г</sub>', 'Коэффициент годового использования', '', P.Kg, ch('Kg'))}
            ${fld('Kc', 'K<sub>сут</sub>', 'Коэффициент суточного использования', '', P.Kc, ch('Kc'))}
          </div>
          <div class="fld"><label for="f-load"><span>График нагрузки: доли момента и времени (через «;», например «1 0,2; 0,8 0,3»)</span></label><input id="f-load" class="txt" value="${esc(P.load.map(([k, t]) => String(k).replace('.', ',') + ' ' + String(t).replace('.', ',')).join('; '))}" autocomplete="off"></div>
          <p class="dhint">Сейчас: ${loadTxt}. Сумма долей времени должна быть равна 1.</p>
          ${isT(6) ? fld('Db', 'D<sub>б</sub>', 'Диаметр приводного барабана', 'мм', O.Db || '', !!O.Db, 'По умолчанию 400 мм — как в примере привода ленточного конвейера [Ч, § 12.1, с. 252].', 'O') : ''}
          <div class="dact"><button class="btn" id="reset-var">Сбросить к варианту ${P.v}</button><button class="btn" id="go-kin">Перейти к разделу 1 →</button></div>
          <details class="adv"><summary>Таблица вариантов задания ${P.task} (щелчок по строке выбирает вариант)</summary><div class="in"><div class="tbl var-table"><table><thead><tr><th class="num">Вариант</th><th class="num">P, кВт</th><th class="num">n, мин⁻¹</th></tr></thead><tbody>${vrows}</tbody></table></div><p class="dhint">Срок службы ${task.L} лет; K<sub>г</sub> = ${fnum(task.Kg, 0)}; K<sub>сут</sub> = ${fnum(task.Kc, 0)}.</p></div></details>
        </section>
        <section class="dsec">
          <h2>2. Выбор элементов</h2>
          <p class="dlead">По умолчанию элементы подбираются по методике автоматически; при невыполнении проверок утилита сама увеличивает размеры (межосевое расстояние, диаметры, ступицы) и пересчитывает раздел. Выберите вручную, если нужно совпасть с расчётом преподавателя.</p>
          <div class="form-grid fg3">
            <div class="fld"><label for="f-motor"><span>Электродвигатель</span><span class="sym">каталог АИР</span></label><select id="f-motor" data-oselect="motor">${motorOpts}</select></div>
            ${isT(1) ? '' : fld('uChain', 'u<sub>цеп</sub>', 'Передаточное отношение цепи (1,5…3,5)', '', O.uChain, +O.uChain !== +V.O.uChain, '', 'O')}
            ${isT(3) ? fld('etaWpre', 'η<sub>ч</sub>', 'КПД червячной передачи (предварительно)', '', O.etaWpre, +O.etaWpre !== +V.O.etaWpre, '0,70…0,80', 'O') : ''}
            ${isT(1) ? fld('Kbe', 'K<sub>be</sub>', 'Коэф. ширины конического венца', '', O.Kbe, +O.Kbe !== +V.O.Kbe, '0,25…0,30', 'O') : ''}
            ${isT(1) ? fld('psiba1', 'ψ<sub>ba</sub>', 'Коэф. ширины цилиндрической ступени', '', O.psiba1, +O.psiba1 !== +V.O.psiba1, '0,2…0,5', 'O') : ''}
            ${isT(6) ? fld('psibaB', 'ψ<sub>ba.б</sub>', 'Ширина быстроходной ступени', '', O.psibaB, +O.psibaB !== +V.O.psibaB, '0,25…0,40', 'O') + fld('psibaT', 'ψ<sub>ba.т</sub>', 'Ширина тихоходной ступени', '', O.psibaT, +O.psibaT !== +V.O.psibaT, '0,30…0,50', 'O') : ''}
            ${fld('Kcoup', 'K<sub>р</sub>', 'Коэффициент режима муфты', '', O.Kcoup, +O.Kcoup !== +V.O.Kcoup, '', 'O')}
          </div>
          ${motorAuditHtml()}
          <div class="opts">
            ${optRow('Синхронная частота двигателя', 'Чернавский рекомендует 1500 или 1000 мин⁻¹: при 3000 мин⁻¹ трудно получить большое передаточное число, двигатели 750 мин⁻¹ тяжелы и громоздки.', seg('O', 'sync', O.sync, [[1500, '1500'], [1000, '1000'], [3000, '3000']], 'num'), 'sync')}
            ${isT(1) ? '' : optRow('Передаточное отношение цепи', 'Назначается из интервала 1,5…3,5; от него зависят передаточное число редуктора и размеры передач.', seg('O', 'uChain', O.uChain, [[2, '2'], [2.5, '2,5'], [3, '3']], 'num'), 'uChain')}
            ${optRow('Автоматическое согласование', 'Если проверка не выполняется, увеличить размеры и пересчитать (как требует методичка: «увеличить aw, длину ступицы, поставить две шпонки»).', seg('O', 'autoFix', O.autoFix !== false, [[true, 'Включено'], [false, 'Выключено']], 'bool'), 'autoFix')}
          </div>
        </section>
        <section class="dsec set set-calc" data-set="настройки расчёта">
          <h2>3. Методика расчёта</h2>
          <p class="dlead">Где методичка допускает разные подходы или содержит ошибку, можно выбрать вариант. Под каждой настройкой — как меняется результат.</p>
          <div class="opts">
            ${optRow('Точность вывода чисел', '«Авто» — 4 значащие цифры, целая часть не округляется. Цифра — фиксированное число знаков после запятой. На сам расчёт не влияет.', seg('P', 'dec', P.dec === undefined ? -1 : +P.dec, [[-1, 'Авто'], [1, '1'], [2, '2'], [3, '3'], [4, '4']], 'num'), null, decPv())}
            ${isT(3) ? optRow('Межосевое расстояние червячной передачи', 'Методичка (п. 1.4.2): a<sub>w</sub> = K<sub>a</sub>·∛(T<sub>II</sub>·K<sub>Hβ</sub> / (q·[σ]<sub>H</sub><sup>2</sup>)), K<sub>a</sub> = 610 МПа<sup>1/3</sup> — без множителя (z<sub>2</sub> + q). Даёт примерно вдвое меньшее значение, чем формула (4.19) Чернавского; если передача не проходит проверку по контактным напряжениям (п. 1.11), a<sub>w</sub> увеличивается до следующего стандартного.', seg('O', 'wormAw', O.wormAw, [['met', 'Методичка'], ['ch', 'Чернавский (4.19)']], 'str'), 'wormAw') : ''}
            ${isT(3) ? optRow('Допускаемые напряжения червячного колеса', 'Формулы методички (C<sub>v</sub>·σ<sub>в</sub>·K<sub>HL</sub>, [σ]<sub>H0</sub> − 25v<sub>s</sub>, (0,25…0,3)σ<sub>в</sub>K<sub>FL</sub>) или таблицы 4.8–4.9 Чернавского.', seg('O', 'wormSH', O.wormSH, [['met', 'Методичка'], ['ch', 'Таблицы [Ч]']], 'str'), 'wormSH') : ''}
            ${isT(3) ? optRow('Коэффициент долговечности K<sub>HL</sub>', 'Методичка: при N<sub>HE</sub> &gt; 10⁷ принимают K<sub>HL</sub> = 1. Чернавский: K<sub>HL</sub> = ⁸√(10⁷/N), но не менее 0,67.', seg('O', 'KHLmode', O.KHLmode || 'met', [['met', 'Методичка'], ['ch', 'Чернавский']], 'str'), 'KHLmode') : ''}
            ${isT(3) ? optRow('Предварительный КПД червячной передачи', 'Интервал 0,70…0,80; при расхождении с уточнённым более 5 % силовые параметры пересчитываются.', seg('O', 'etaWpre', O.etaWpre, [[0.7, '0,70'], [0.75, '0,75'], [0.8, '0,80']], 'num'), 'etaWpre') : ''}
            ${isT(3) ? optRow('Степень точности червячной передачи', 'По табл. 4.7 Чернавского: для редукторов общего назначения — 7-я или 8-я.', seg('O', 'wormDeg', O.wormDeg, [['auto', 'По скорости'], [7, '7'], [8, '8']], 'str'), 'wormDeg') : ''}
            ${isT(3) ? optRow('Число циклов нагружения', 'Эквивалентное число циклов по графику нагрузки (показатели 4 и 9, Чернавский с. 60) или без учёта графика.', seg('O', 'wormNe', O.wormNe, [['simple', 'Без графика'], ['load', 'По графику']], 'str'), 'wormNe') : ''}
            ${isT(1) || isT(6) ? optRow('Ряд межосевых расстояний ГОСТ 2185-66', '1-й ряд предпочтителен; при «оба ряда» берётся ближайшее большее из обоих.', seg('O', 'awRow', O.awRow, [[0, 'Оба ряда'], [1, '1-й ряд']], 'num'), 'awRow') : ''}
            ${isT(1) || isT(6) ? optRow('Числа зубьев цилиндрических колёс', 'По методичке: z₁ = 2a<sub>w</sub>/(m(u+1)), z₂ = u·z₁. Вариант через суммарное число зубьев сохраняет стандартное a<sub>w</sub>.', seg('O', 'zMode', O.zMode, [['met', 'Методичка'], ['sum', 'Через zΣ']], 'str'), 'zMode') : ''}
            ${isT(1) ? optRow('Момент на тихоходном валу', 'В методичке T<sub>2Т</sub> = T<sub>в</sub>/η<sub>м</sub>, хотя по схеме звёздочка стоит прямо на тихоходном валу и муфта в приводе одна (у двигателя). По умолчанию — как в методичке; «По схеме» — T<sub>2Т</sub> = T<sub>в</sub>. КПД муфты в η<sub>общ</sub> в обоих случаях — в первой степени.', seg('O', 't1Coup', O.t1Coup || 'met', [['met', 'Как в методичке'], ['scheme', 'По схеме']], 'str'), 't1Coup') : ''}
            ${isT(1) ? optRow('Сила от муфты на быстроходном валу', 'В методичке задания 1 при расчёте быстроходного вала консольная сила от муфты не учитывается.', seg('O', 'Fm1', !!O.Fm1, [[false, 'Не учитывать'], [true, 'Учитывать']], 'bool'), 'Fm1') : ''}
            ${optRow('Сечение со шпоночным пазом', isT(1) ? 'Методичка задания 1: расчётный диаметр уменьшают на 10 %.' : 'Методичка заданий 3 и 6: моменты сопротивления с учётом паза W = πd³/32 − bt₁(d − t₁)²/(2d).', seg('O', 'wKey', O.wKey, [['met', 'd<sub>расч</sub> = 0,9d'], ['net', 'W с учётом паза']], 'str'), 'wKey')}
            ${optRow('Расчёт шпонок на смятие', 'Приближённая формула (глубина врезания 0,45h) или уточнённая с t₁.', seg('O', 'keyExact', !!O.keyExact, [[false, 'Приближённо'], [true, 'Уточнённо']], 'bool'), 'keyExact')}
            ${isT(1) ? '' : optRow('Консольная сила от муфты', 'Методичка: F<sub>м</sub> = (0,2…0,5)·2T<sub>расч</sub>/D<sub>0</sub>, D<sub>0</sub> — у выбранной муфты (раздел 2). Альтернатива — ГОСТ 16162 (Чернавский с. 141): 50√T или 80√T.', seg('O', 'FmMode', O.FmMode, [['met', 'Методичка'], ['gost', 'ГОСТ 16162']], 'str'), 'FmMode')}
            ${isT(6) ? optRow('Момент в формуле межосевого расстояния', 'В методичке задания 6 в формулу a<sub>w</sub> (с u, а не u²) подставлен момент на колесе — это завышает a<sub>w</sub> в ∛u раз. По умолчанию — как в методичке задания 6; альтернатива — момент на шестерне, как в методичке задания 1 (равносильно формуле (3.7) Чернавского).', seg('O', 'awT6', O.awT6 || 'met', [['met', 'Момент колеса'], ['pin', 'Момент шестерни']], 'str'), 'awT6') : ''}
            ${isT(3) ? optRow('Проверка червячной передачи на контактную выносливость', 'Методичка: σ<sub>H</sub> = Z<sub>E</sub>Z<sub>h</sub>√(F<sub>t2</sub>K<sub>HV</sub>K<sub>Hβ</sub>/(d<sub>2</sub>b<sub>2</sub>cos γ)), K<sub>Hβ</sub> — из п. 1.4.2. Альтернатива — формула (4.23) Чернавского с K<sub>β</sub> по табл. 4.6.', seg('O', 'wormSHcheck', O.wormSHcheck || 'met', [['met', 'Методичка'], ['ch', 'Чернавский']], 'str'), 'wormSHcheck') : ''}
          </div>
          <details class="adv"><summary>Константы методики</summary><div class="in">
            <div class="form-grid">
              ${fld('etaM', 'η<sub>м</sub>', 'КПД муфты', '', O.etaM, +O.etaM !== +V.O.etaM, '', 'O')}
              ${fld('etaB', 'η<sub>подш</sub>', 'КПД пары подшипников', '', O.etaB, +O.etaB !== +V.O.etaB, '', 'O')}
              ${isT(1) ? '' : fld('etaCh', 'η<sub>цеп</sub>', 'КПД цепной передачи', '', O.etaCh, +O.etaCh !== +V.O.etaCh, '', 'O')}
              ${isT(3) ? '' : fld('etaCyl', 'η<sub>ц</sub>', 'КПД цилиндрической передачи', '', O.etaCyl, +O.etaCyl !== +V.O.etaCyl, '', 'O')}
              ${isT(1) ? fld('etaCon', 'η<sub>к</sub>', 'КПД конической передачи', '', O.etaCon, +O.etaCon !== +V.O.etaCon, '', 'O') : ''}
              ${fld('tauI', '[τ]<sub>I</sub>', 'Допускаемое τ быстроходного вала', 'МПа', O.tauI, +O.tauI !== +V.O.tauI, '', 'O')}
              ${fld('tauII', '[τ]<sub>II</sub>', 'Допускаемое τ промежуточного/тихоходного', 'МПа', O.tauII, +O.tauII !== +V.O.tauII, '', 'O')}
              ${fld('nz', 'n', 'Коэффициент запаса прочности вала', '', O.nz, +O.nz !== +V.O.nz, '1,5…2,2', 'O')}
              ${fld('Kri', 'K<sub>ри</sub>', 'Коэффициент режима нагрузки (валы)', '', O.Kri, +O.Kri !== +V.O.Kri, '', 'O')}
              ${fld('betaSh', 'β<sub>ш</sub>', 'Коэффициент шероховатости (валы)', '', O.betaSh, +O.betaSh !== +V.O.betaSh, '', 'O')}
              ${fld('Kb', 'K<sub>б</sub>', 'Коэффициент безопасности (подшипники)', '', O.Kb, +O.Kb !== +V.O.Kb, '1,2…1,5', 'O')}
              ${fld('sCmSteel', '[σ]<sub>см</sub>', 'Смятие, стальная ступица', 'МПа', O.sCmSteel, +O.sCmSteel !== +V.O.sCmSteel, '', 'O')}
              ${fld('sCmCI', '[σ]<sub>см</sub>', 'Смятие, чугунная ступица', 'МПа', O.sCmCI, +O.sCmCI !== +V.O.sCmCI, '', 'O')}
              ${isT(1) ? '' : fld('chainAngle', 'α<sub>цеп</sub>', 'Наклон линии центров цепи', '°', O.chainAngle, +O.chainAngle !== +V.O.chainAngle, '', 'O')}
              ${isT(3) ? fld('t0', 't<sub>0</sub>', 'Температура воздуха', '°C', O.t0, +O.t0 !== +V.O.t0, '', 'O') + fld('Kt', 'K<sub>t</sub>', 'Коэф. теплопередачи', 'Вт/(м²·°C)', O.Kt, +O.Kt !== +V.O.Kt, '', 'O') : ''}
              ${fld('D0', 'D<sub>0</sub>', 'Муфта: диаметр окружности пальцев', 'мм', O.D0 || '', !!O.D0, '', 'O')}
              ${fld('zp', 'z', 'Муфта: число пальцев', '', O.zp || '', !!O.zp, '', 'O')}
              ${fld('dp', 'd<sub>п</sub>', 'Муфта: диаметр пальца', 'мм', O.dp || '', !!O.dp, '', 'O')}
              ${fld('lvt', 'l<sub>вт</sub>', 'Муфта: длина упругой втулки', 'мм', O.lvt || '', !!O.lvt, '', 'O')}
              ${fld('Cm', 'C', 'Муфта: зазор между полумуфтами', 'мм', O.Cm || '', !!O.Cm, '', 'O')}
            </div>
            <p class="dhint">Размеры пальцев и втулок МУВП (D<sub>0</sub>, z, d<sub>п</sub>, l<sub>вт</sub>, C) берутся автоматически для выбранного типоразмера по ГОСТ 21424 (в табл. 11.5 Чернавского и табл. 1 ГОСТ 21424-93 их нет — источник указан в записке). Поля выше нужны, только если руководитель даёт другие значения.</p>
          </div></details>
        </section>
        <section class="dsec set set-rep" data-set="настройки отчёта">
          <h2>4. Отчёт и файлы</h2>
          <h3>Титульный лист и основная надпись</h3>
          <div class="form-grid fg4">
            ${tfld('student', 'Студент (Ф. И. О.)', 'Иванов И. И.')}${tfld('group', 'Группа', '741-15')}${tfld('teacher', 'Руководитель проекта', 'Фамилия И. О.')}${tfld('normo', 'Нормоконтролёр', 'Фамилия И. О.')}
            ${tfld('dept', 'Кафедра', 'ОКПМ')}${tfld('discipline', 'Дисциплина', '')}${tfld('code', 'Обозначение (шифр)', codeDefault())}${tfld('year', 'Год', '')}
          </div>
          <h3>Основная надпись чертежей, спецификаций и записки</h3>
          <div class="form-grid fg4">
            ${tfld('stOrg', 'Графа 9 — организация', 'КНИТУ' + (S.T.group ? ' ' + S.T.group : ''))}${tfld('stLit', 'Литера (графа 4)', 'У')}${tfld('stTcontr', 'Т. контр.', 'Фамилия И. О.')}${tfld('stUtv', 'Утв.', 'Фамилия И. О.')}
            ${tfld('stDate', 'Дата (у «Разраб.»)', 'дд.мм.гг')}
          </div>
          <p class="dhint">Разраб. — студент, Пров. — руководитель, Н. контр. — нормоконтролёр (поля выше). Пустая графа 9 — «КНИТУ» и группа; пустая литера — «У» (учебная документация). Поля попадают в предпросмотр, спецификации, макросы КОМПАС и рамку записки.</p>
          <div class="fld"><label for="t-topic"><span>Тема курсового проекта</span></label><input id="t-topic" data-tkey="topic" class="txt" value="${esc(S.T.topic || '')}" placeholder="${esc(D.TASKS[P.task].title)}" autocomplete="off"></div>
          <div class="fld"><label for="t-org"><span>Шапка титульного листа (каждая строка — отдельный абзац)</span></label><textarea id="t-org" data-tkey="org" rows="5">${esc(S.T.org)}</textarea></div>
          <p class="dhint">Шифр документов: «${esc(S.T.code || codeDefault())} 00.00.00 ПЗ» — пояснительная записка, «… 01.00.00 СБ» — редуктор, «… 02.00.00 СБ» — рама, «… 01.00.NN» — детали редуктора. Поле можно изменить.</p>
          <h3>Оформление записки</h3>
          <div class="opts">
            ${docRow('Рамка с основной надписью', 'По ГОСТ 2.104: на первом листе «Содержание» — форма 2 (40 мм), на остальных — форма 2а (15 мм). Без рамки — номер страницы внизу по центру (КНИТУ 2023).', sw('frame'))}
            ${docRow('Логотип КНИТУ', 'Над шапкой титульного листа.', sw('logo'))}
            ${docRow('Пояснения к формулам', 'Перед формулой — абзац о том, что считается и зачем.', sw('explain'))}
            ${docRow('Расшифровка обозначений «где …»', 'Под формулой — значения новых символов с единицами.', sw('where'))}
            ${docRow('Номера формул', '(1), (2)… у правого края строки. Выключено — формулы без номеров.', sw('eqNum'))}
            ${docRow('Нумерация формул, таблиц и рисунков', 'Сквозная — 1, 2, 3…; в пределах раздела — 1.1, 1.2, 2.1… (ГОСТ 2.105 допускает обе).', seg('T', 'numSec', !!S.T.numSec, [[false, 'Сквозная'], [true, 'По разделам']], 'bool'))}
            ${docRow('Ссылки на источники в тексте', 'Только номер — [1], как в примере методички; с местом — [1, с. 5]; без ссылок — убираются из текста, список источников остаётся.', seg('T', 'refs', S.T.refs || 'num', [['num', '[1]'], ['full', '[1, с. 5]'], ['none', 'Нет']], 'str'))}
            ${docRow('Линия под шапкой таблицы', 'ГОСТ 2.105 требует только отделить шапку линией — обычно одинарной. Двойная или утолщённая — если так принято у преподавателя.', seg('T', 'headLine', S.T.headLine || 'single', [['single', 'Одинарная'], ['double', 'Двойная'], ['thick', 'Толстая']], 'str'))}
            ${docRow('Межстрочный интервал', 'Основной текст записки; обычно требуется полуторный.', seg('T', 'line1', !!S.T.line1, [[false, '1,5'], [true, '1,0']], 'bool'))}
            ${docRow('Подложка на рисунках', '«Замените рисунком из КОМПАС» — что вставить и откуда взять (какой файл, вид, разрез).', sw('watermark'))}
            ${docRow('Улучшение читаемости', 'Не разрывать формулу с поясняющим абзацем, таблицы и подписи рисунков между страницами.', sw('readable'))}
            ${docRow('Листинги макросов КОМПАС в приложении', 'Тексты Python-макросов — приложением к записке.', sw('listings'))}
            ${docRow('Шрифт программного кода', 'Для листингов в приложении.', seg('T', 'codePlain', !!S.T.codePlain, [[true, 'Times New Roman'], [false, 'Courier New']], 'bool'))}
          </div>
          <h3>Скачать</h3>
          <div class="dl-grid"><button class="btn primary dl-all" data-docx="all">${dlIcon()} Пояснительная записка (.docx)</button>${[['kin', 'Раздел 1.1–1.2'], ['mat', 'Материалы'], ['gear', 'Передачи'], ['shaft', 'Валы и корпус'], ['check', 'Проверки'], ['other', 'Смазка, муфта']].map(([t, l]) => `<button class="btn" data-docx="${t}">${dlIcon()} ${l}</button>`).join('')}</div>
          <p class="dhint">Полная записка: титульный лист, задание, лист нормоконтролёра, содержание, введение, все разделы, заключение, список источников и приложения (спецификации). Отдельные части удобны, чтобы вставить их в свой документ.</p>
          <div class="dact"><button class="btn" id="zip-all">${dlIcon()} Архив записки и файлов КОМПАС (.zip)</button></div>
          <p class="dhint">Архив: записка целиком и по разделам (Word), файлы для КОМПАС-3D и рисунки SVG.</p>
        </section>
        <section class="dsec set set-saves" data-set="сохранения">
          <h2>5. Сохранения</h2>
          <p class="dlead">Текущее состояние запоминается автоматически; отдельно ведётся автосохранение. Чтобы держать несколько наборов (свой вариант и вариант одногруппника), сохраните их в слоты.</p>
          <div class="opts slots" id="slots">${slotsHtml()}</div>
          <div class="dact"><button class="btn" id="share2">${LINK_ICON} Скопировать ссылку на расчёт</button><button class="btn" id="slots-exp">${dlIcon()} Экспорт в файл</button><label class="btn" for="slots-imp-f">Импорт из файла</label><input type="file" id="slots-imp-f" accept=".json,application/json" hidden></div>
          <p class="dhint">Ссылка содержит номер, вариант и все правки (элементы, методику, константы) — по ней одногруппник откроет ровно этот расчёт; данные титульного листа в ссылку не попадают. Слоты хранятся только в этом браузере; файл экспорта переносит их на другое устройство.</p>
        </section>
      </div></article>`;
    bindSlots();
    $('#zip-all').onclick = e => zipAll(e.currentTarget);
    $('#share2').onclick = share;
    $('#f-motor').value = String(O.motor || 'auto');
    $('#f-listNo').onchange = e => { const v = parseInt(e.target.value, 10); if (!(v >= 1 && v <= 99)) { toast('Номер по списку — целое число'); e.target.value = P.listNo; return; } setList(v); };
    $('#f-task').onchange = e => setTV(+e.target.value, S.P.v);
    $('#f-v').onchange = e => setTV(S.P.task, +e.target.value);
    $('#f-load').onchange = e => {
      const rows = e.target.value.split(';').map(x => x.trim()).filter(Boolean).map(x => x.split(/\s+/).map(v => parseFloat(v.replace(',', '.'))));
      if (!rows.length || rows.some(r => r.length !== 2 || !(r[0] > 0 && r[0] <= 1) || !(r[1] > 0))) { toast('Формат: «доля момента доля времени; …», например «1 0,2; 0,8 0,8»'); return; }
      const st = rows.reduce((s, r) => s + r[1], 0); if (Math.abs(st - 1) > 0.005) { toast('Сумма долей времени должна быть 1 (сейчас ' + String(+st.toFixed(3)).replace('.', ',') + ')'); return; }
      S.P.load = rows; recompute();
    };
    $$('#main input[data-key]').forEach(el => el.addEventListener('change', onField));
    $$('#main input[data-okey]').forEach(el => el.addEventListener('change', onOField));
    $$('#main select[data-oselect]').forEach(el => el.addEventListener('change', () => { S.P.O[el.dataset.oselect] = el.value; recompute(); }));
    $$('#main [data-obool]').forEach(el => el.addEventListener('change', () => { S.P.O[el.dataset.obool] = el.checked; recompute(); }));
    $$('#main .seg button').forEach(b => b.onclick = () => {
      const g = b.parentElement, raw = b.dataset.val, kind = g.dataset.kind, v = kind === 'bool' ? raw === 'true' : kind === 'num' ? +raw : (isFinite(+raw) && raw !== '' ? +raw : raw);
      $$('button', g).forEach(x => x.setAttribute('aria-checked', String(x === b)));
      if (g.dataset.scope === 'P') { S.P[g.dataset.key] = v; const y = window.scrollY; recompute(); window.scrollTo(0, y); }
      else if (g.dataset.scope === 'O') { S.P.O[g.dataset.key] = v; const y = window.scrollY; recompute(); window.scrollTo(0, y); }
      else { S.T[g.dataset.key] = v; saveT(); refreshDpv(g.dataset.key); }
    });
    $('#reset-var').onclick = () => { const keep = { dec: S.P.dec }; S.P = Object.assign(fresh(S.P.listNo, S.P.task, S.P.v), keep); recompute(); };
    $('#go-kin').onclick = () => go('kin');
    $$('#main [data-tkey]').forEach(el => el.addEventListener('change', () => { S.T[el.dataset.tkey] = el.type === 'checkbox' ? el.checked : el.value; saveT(); refreshDpv(el.dataset.tkey); }));
    $$('#main [data-docx]').forEach(b => b.onclick = () => makeDocx(b.dataset.docx, b));
    $$('.var-table tr[data-v]').forEach(tr => tr.onclick = () => setTV(S.P.task, +tr.dataset.v));
    fillPv();
  }
  function tfld(key, label, ph) {
    return `<div class="fld"><label for="t-${key}"><span>${label}</span></label><input id="t-${key}" data-tkey="${key}" value="${esc(S.T[key] || '')}" placeholder="${esc(ph)}" autocomplete="off" class="txt"></div>`;
  }
  const parseNum = s => parseFloat(String(s).trim().replace(/\s/g, '').replace(',', '.'));
  function onField(e) {
    const el = e.target, k = el.dataset.key, v = parseNum(el.value);
    if (!isFinite(v) || v <= 0) { toast('Введите положительное число'); el.value = String(S.P[k]).replace('.', ','); return; }
    if ((k === 'Kg' || k === 'Kc') && v > 1) { toast('Коэффициент использования — от 0 до 1'); el.value = String(S.P[k]).replace('.', ','); return; }
    S.P[k] = v; recompute();
  }
  function onOField(e) {
    const el = e.target, k = el.dataset.okey, raw = el.value.trim();
    if (raw === '' && ['Db', 'D0', 'zp', 'dp', 'lvt', 'Cm'].includes(k)) { S.P.O[k] = 0; recompute(); return; }
    const v = parseNum(raw);
    if (!isFinite(v) || v < 0) { toast('Введите число'); el.value = String(S.P.O[k]).replace('.', ','); return; }
    S.P.O[k] = v; recompute();
  }
  function setList(no) { const keep = { dec: S.P.dec }; const d = D.byListNo(Math.min(26, no)); S.P = Object.assign(fresh(no, d.task, d.v), keep); recompute(); }
  function setTV(task, v) { const keep = { dec: S.P.dec }; S.P = Object.assign(fresh(S.P.listNo, task, v), keep); recompute(); }

  /* ---------- вкладки расчёта ---------- */
  function kpis() {
    const R = S.R;
    return (R.kpis || []).map(([a, b]) => `<div class="kpi"><div class="k">${a}</div><div class="v">${pw(esc(b))}</div></div>`).join('');
  }
  function figNums() {   // сквозная нумерация рисунков по всему расчёту
    const nums = {}; let k = 0;
    for (const s of S.R.sections) for (const it of s.items) if (it.k === 'fig') nums[it.id] = String(++k);
    return nums;
  }
  function figSvg(it) {
    const R = S.R;
    try {
      if (it.kind === 'scheme') return FG.scheme(R.task);
      if (it.kind === 'load') return FG.load(S.P.load);
      if (it.kind === 'layout') return FG.shafts(R.shafts);
      if (it.kind === 'beam') { const b = R.beams && R.beams[it.id]; return b ? FG.beam(b.B, b) : ''; }
    } catch (e) { console.error(e); }
    return '';
  }
  function renderItems(items, nums) {
    let h = ''; const seen = {};
    for (const it of items) {
      switch (it.k) {
        case 'h': h += (it.lvl === 1 ? `<h2 class="h1">${esc(it.no)} ${esc(it.t)}</h2>` : it.lvl === 3 ? `<h3>${esc(it.no)} ${esc(it.t)}</h3>` : `<h2>${esc(it.no)} ${esc(it.t)}</h2>`) + (window.MDOC ? MDOC.theory('t' + S.P.task + '|' + S.tab, it.t) : ''); break;
        case 'p': h += `<p>${pw(refsWeb(figRefs(it.t, nums)))}</p>`; break;
        case 'list': h += `<ul class="lst">${it.lines.map(l => `<li>${pw(refsWeb(l))}</li>`).join('')}</ul>`; break;
        case 'note': h += `<div class="note ${it.kind}">${pw(refsWeb(it.t))}</div>`; break;
        case 'tex': h += calcCard(it.t, it.d || ''); break;
        case 'eq': {
          const s = eqTex(it);
          const n = seen[it.lhs] = (seen[it.lhs] || 0) + 1, ck = S.tab + '|' + it.lhs + '|' + n;
          if (it.v !== undefined && isFinite(it.v)) CHKIDX[ck] = { tab: S.tab, lhs: it.lhs, n, val: it.v, unit: it.u || '', order: Object.keys(CHKIDX).length };
          h += calcCard(s, refsWeb(it.d || ''), it.v !== undefined && isFinite(it.v) ? ck : null); break;
        }
        case 'check': h += `<div class="check ${it.ok ? '' : 'bad'}"><span class="mark">${it.ok ? '✓' : '!'}</span><div class="body">${tex(it.tex, false)}<div class="ct">${pw(refsWeb(it.t || ''))}</div></div></div>`; break;
        case 'table': h += `<div class="tbl"><table>${it.cap ? `<caption>${esc(it.cap)}</caption>` : ''}<thead><tr>${it.head.map(c => `<th>${pw(esc(c))}</th>`).join('')}</tr></thead><tbody>${it.rows.map(r => `<tr>${r.map(c => `<td>${pw(esc(c))}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`; break;
        case 'fig': h += `<figure class="fig dg" id="fig-${it.id}"><div class="fig-svg">${figSvg(it).replace('role="img"', `role="img" aria-label="${esc(it.title)}"`)}</div><figcaption><span><b>Рисунок ${nums[it.id]}</b> — ${esc(it.title)}</span>${it.kind === 'scheme' ? '<span class="dhint-r">наведите на элемент — его описание</span>' : ''}</figcaption></figure>`; break;
      }
    }
    return h;
  }
  const LINK_ICON = '<svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true"><path d="M6.6 9.4a2.6 2.6 0 0 0 3.7 0l2.4-2.4a2.6 2.6 0 0 0-3.7-3.7l-.9.9M9.4 6.6a2.6 2.6 0 0 0-3.7 0L3.3 9a2.6 2.6 0 0 0 3.7 3.7l.9-.9" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';
  const ICON_COPY = '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><rect x="5" y="5" width="9" height="9" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M11 5V3.5A1.5 1.5 0 0 0 9.5 2h-6A1.5 1.5 0 0 0 2 3.5v6A1.5 1.5 0 0 0 3.5 11H5" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>';
  let calcSeq = 0; const CALC = {};
  function calcCard(src, desc, ck) {
    const id = 'f' + (++calcSeq); CALC[id] = src;
    const chk = ck && CHK.on ? chkRow(ck) : '';
    return `<div class="calc"><div class="calc-math">${tex(src, true)}</div><div class="calc-tools"><button class="calc-btn" data-mml="${id}" title="Копировать формулу для Word (MathML)" aria-label="Копировать формулу для Word">${ICON_COPY}</button><button class="calc-btn tx" data-tex="${id}" title="Копировать как LaTeX" aria-label="Копировать как LaTeX">TeX</button></div>${desc ? `<div class="calc-desc">${pw(desc)}</div>` : ''}${chk}</div>`;
  }
  /* ---------- сверка с ручным расчётом ---------- */
  const CHKIDX = {};
  const CHK = Object.assign({ on: false, vals: {} }, lsGet(KEY.check) || {});
  const saveChk = () => lsSet(KEY.check, CHK);
  const chkKey = ck => S.P.task + '.' + S.P.v + '|' + ck;
  function chkRow(ck) {
    const v = CHK.vals[chkKey(ck)];
    return `<div class="chk-row" data-ck="${esc(ck)}"><label><span>Ваше значение</span><input inputmode="decimal" autocomplete="off" value="${v === undefined ? '' : esc(String(v).replace('.', ','))}" placeholder="из тетради">${CHKIDX[ck] && CHKIDX[ck].unit ? `<em>${esc(CHKIDX[ck].unit)}</em>` : ''}</label><div class="chk-v"></div></div>`;
  }
  const relDev = (u, v) => Math.abs(u - v) / Math.max(Math.abs(v), 1e-12);
  const TOL = 0.006;
  function altItemVal(patchO, ck) {
    const R = altR(patchO); if (!R) return undefined;
    const c = CHKIDX[ck]; let n = 0;
    for (const s of R.sections) if (s.tab === c.tab) for (const it of s.items) if (it.k === 'eq' && it.lhs === c.lhs && ++n === c.n) return it.v;
    return undefined;
  }
  function scenarios() {
    const O = S.P.O, out = [];
    for (const s of [1500, 1000, 3000]) if (s !== O.sync) out.push({ t: `взять двигатель с синхронной частотой ${s} мин⁻¹`, p: { sync: s }, mo: true });
    const opts = [['wormAw', 'ch', 'met', 'считать aw по формуле Чернавского', 'считать aw по формуле методички (Ka = 610)'], ['wormSH', 'met', 'ch', 'брать допускаемые напряжения по формулам методички', 'брать допускаемые напряжения по таблицам Чернавского'],
      ['KHLmode', 'met', 'ch', 'принять KHL = 1', 'считать KHL по формуле Чернавского'], ['awRow', 0, 1, 'брать aw из обоих рядов ГОСТ 2185', 'брать aw только из 1-го ряда'], ['zMode', 'met', 'sum', 'считать z₂ = u·z₁', 'считать числа зубьев через zΣ'],
      ['wKey', 'met', 'net', 'уменьшать диаметр на 10 % из-за шпоночного паза', 'считать W с учётом шпоночного паза'], ['keyExact', false, true, 'считать шпонку по формуле 4,4T/(dhlр)', 'считать шпонку по уточнённой формуле'], ['t1Coup', 'scheme', 'met', 'не делить Tв на ηм (по схеме)', 'делить Tв на ηм, как в методичке'], ['awT6', 'pin', 'met', 'подставлять в aw момент шестерни', 'подставлять в aw момент колеса, как записано в методичке'], ['wormSHcheck', 'met', 'ch', 'проверять σH по формуле методички', 'проверять σH по формуле (4.23) Чернавского'], ['FmMode', 'met', 'gost', 'считать Fм по формуле методички', 'считать Fм по ГОСТ 16162'], ['Fm1', false, true, 'не учитывать силу от муфты', 'учитывать силу от муфты']];
    for (const [k, a, b, ta, tb] of opts) { if (O[k] === undefined) continue; const cur = O[k]; const alt = String(cur) === String(a) ? b : a; out.push({ t: String(alt) === String(a) ? ta : tb, p: { [k]: alt } }); }
    if (S.P.task !== 1) for (const u of [2, 2.5, 3]) if (u !== +O.uChain) out.push({ t: 'принять u<sub>цеп</sub> = ' + String(u).replace('.', ','), p: { uChain: u } });
    if (S.P.task === 3) for (const e of [0.7, 0.75, 0.8]) if (e !== +O.etaWpre) out.push({ t: 'принять предварительно ηч = ' + String(e).replace('.', ','), p: { etaWpre: e } });
    return out;
  }
  let chkRun = 0;
  async function verdict(ck, row) {
    const out = $('.chk-v', row), c = CHKIDX[ck];
    const raw = CHK.vals[chkKey(ck)];
    row.classList.remove('ok', 'warn', 'bad');
    if (raw === undefined || raw === '') { out.innerHTML = ''; return; }
    const u = +raw, v = c.val;
    if (!isFinite(u)) { out.textContent = 'Введите число'; row.classList.add('warn'); return; }
    const dv = relDev(u, v), pc = x => String(+(x * 100).toFixed(x < 0.01 ? 2 : 1)).replace('.', ',') + ' %';
    if (dv <= TOL) { row.classList.add('ok'); out.innerHTML = '✓ Совпадает' + (dv > 0.0005 ? ` (разница ${pc(dv)} — округление)` : ''); return 'ok'; }
    for (const k of [1e3, 1e-3, 1e6, 1e-6]) if (relDev(u * k, v) <= TOL) { row.classList.add('warn'); out.innerHTML = `≈ Совпадает с точностью до единиц: проверьте приставку (×${k >= 1 ? fnum(k) : '1/' + fnum(1 / k)}) — утилита считает в ${esc(c.unit || 'основных единицах')}.`; return 'warn'; }
    for (let k = 1; k <= 4; k++) {
      const e = Math.pow(10, Math.floor(Math.log10(Math.abs(v))) - k + 1), tr = Math.trunc(v / e) * e, rn = Math.round(v / e) * e;
      if (Math.abs(u - tr) < e * 1e-6 && Math.abs(tr - rn) > e * 0.5) { row.classList.add('warn'); out.innerHTML = `≈ Похоже, значение обрезано, а не округлено: ${fnum(v)} ≈ ${String(+rn.toPrecision(k)).replace('.', ',')}.`; return 'warn'; }
    }
    const entered = Object.entries(CHKIDX).filter(([k, x]) => k !== ck && x.tab === c.tab && CHK.vals[chkKey(k)] !== undefined && CHK.vals[chkKey(k)] !== '');
    const prev = entered.filter(([k, x]) => x.order < c.order && relDev(+CHK.vals[chkKey(k)], x.val) > 0.025);
    const okOthers = entered.filter(([k, x]) => relDev(+CHK.vals[chkKey(k)], x.val) <= TOL);
    row.classList.add('bad');
    out.innerHTML = `✗ Расхождение ${pc(dv)} (утилита: ${fnum(v)}). <span class="spinner"></span> Ищу причину…`;
    const run = ++chkRun; row.dataset.run = run;
    for (const sc of scenarios()) {
      if (row.dataset.run !== String(run)) return;
      await sleep(0);
      const av = altItemVal(sc.p, ck);
      if (av === undefined || relDev(u, av) > TOL) continue;
      if (okOthers.some(([k]) => { const a = altItemVal(sc.p, k); return a === undefined || relDev(+CHK.vals[chkKey(k)], a) > TOL; })) continue;
      row.classList.remove('bad'); row.classList.add('warn');
      out.innerHTML = `≈ Ваше значение получается, если ${sc.t} (${fnum(av)}). Расчёт верный — отличаются исходные допущения.${sc.mo ? ' Двигатель выбирается на вкладке «Данные».' : ' Переключить можно в разделе «Методика расчёта» на вкладке «Данные».'}`;
      return 'warn';
    }
    if (row.dataset.run !== String(run)) return;
    if (dv <= 0.025) { row.classList.remove('bad'); row.classList.add('warn'); out.innerHTML = `≈ Близко: расхождение ${pc(dv)} (утилита: ${fnum(v)}). Так бывает, когда промежуточные величины округлены сильнее или табличный коэффициент взят без интерполяции.`; return 'warn'; }
    out.innerHTML = `✗ Расхождение ${pc(dv)} (утилита: ${fnum(v)}). ` + (prev.length ? `Возможно, это следствие расхождения выше: ${prev.map(([, x]) => tex(x.lhs, false)).join(', ')}. Начните сверку с первого несовпадающего значения.` : 'Предыдущие значения совпадают — вероятна арифметическая ошибка в этой формуле. Сверьте подстановку чисел.');
    return 'bad';
  }
  function chkSummary() {
    const box = $('#chk-sum'); if (!box) return;
    const rows = $$('.chk-row'), n = rows.filter(r => CHK.vals[chkKey(r.dataset.ck)] !== undefined && CHK.vals[chkKey(r.dataset.ck)] !== '').length;
    const ok = rows.filter(r => r.classList.contains('ok')).length, w = rows.filter(r => r.classList.contains('warn')).length, b = rows.filter(r => r.classList.contains('bad')).length;
    box.innerHTML = n ? `Сверено: ${n} из ${rows.length} · <b class="c-ok">✓ ${ok}</b> · <b class="c-warn">≈ ${w}</b> · <b class="c-bad">✗ ${b}</b>` : 'Впишите свои значения в поля под формулами — утилита сравнит их и подскажет причину расхождения.';
  }
  function bindChk(root) {
    const swc = $('#chk-on', root);
    if (swc) swc.onchange = () => { CHK.on = swc.checked; saveChk(); const y = window.scrollY; renderTab(); window.scrollTo(0, y); };
    const clr = $('#chk-clr', root);
    if (clr) clr.onclick = () => { const pre = S.P.task + '.' + S.P.v + '|' + S.tab + '|'; Object.keys(CHK.vals).forEach(k => { if (k.startsWith(pre)) delete CHK.vals[k]; }); saveChk(); const y = window.scrollY; renderTab(); window.scrollTo(0, y); };
    if (!CHK.on) return;
    const rows = $$('.chk-row', root);
    const upd = async row => { await verdict(row.dataset.ck, row); chkSummary(); };
    rows.forEach(row => {
      const inp = $('input', row);
      inp.addEventListener('change', () => {
        const t = inp.value.trim().replace(/\s/g, '').replace(',', '.'), k = chkKey(row.dataset.ck);
        if (t === '') delete CHK.vals[k]; else CHK.vals[k] = t;
        saveChk(); upd(row);
        rows.filter(r => CHKIDX[r.dataset.ck].order > CHKIDX[row.dataset.ck].order && CHK.vals[chkKey(r.dataset.ck)] !== undefined).forEach(upd);
      });
    });
    (async () => { for (const r of rows) if (CHK.vals[chkKey(r.dataset.ck)] !== undefined) await verdict(r.dataset.ck, r); chkSummary(); })();
    chkSummary();
  }
  function mathml(src) {
    let h = katex.renderToString(texify(src), { displayMode: true, output: 'mathml', throwOnError: false, strict: 'ignore' });
    const a = h.indexOf('<math'), b = h.lastIndexOf('</math>');
    h = h.slice(a, b + 7).replace(/<annotation[\s\S]*?<\/annotation>/g, '').replace(/<\/?semantics>/g, '');
    h = h.replace(/^<math[^>]*>/, '<math xmlns="http://www.w3.org/1998/Math/MathML" display="block">');
    h = h.replace(/<mi>([\u0370-\u03ff\u0400-\u04ff])<\/mi>/g, '<mi mathvariant="normal">$1</mi>');
    return h;
  }
  function bindCalc(root) {
    $$('[data-mml]', root).forEach(b => b.onclick = () => copyText(mathml(CALC[b.dataset.mml]), 'Формула скопирована — вставьте в Word (Ctrl+V)'));
    $$('[data-tex]', root).forEach(b => b.onclick = () => copyText(texify(CALC[b.dataset.tex]), 'LaTeX скопирован'));
  }
  function renderSec(main, tab) {
    const R = S.R, nums = figNums();
    const secs = R.sections.filter(s => s.tab === tab);
    const meta = TABS.find(t => t.id === tab), k = TABS.findIndex(t => t.id === tab);
    const body = secs.map(s => renderItems(s.items, nums)).join('');
    main.innerHTML = `<article class="sheet">
      <header class="sheet-head"><div><div class="eyebrow">Курсовой проект · раздел ${meta.no}</div><h1>${esc(TAB_TITLE[tab] || meta.t)}</h1><p class="lead">${esc(leadText(tab))}</p></div>${stamp(tab)}</header>
      <div class="sheet-body rep"><div class="kpis">${kpis()}</div><p class="calc-hint">${ICON_COPY} у каждой формулы копирует её в формате MathML — в Word вставляется редактируемое уравнение (Ctrl+V). «TeX» копирует LaTeX. Ссылки в квадратных скобках: [М] — методичка, [Ч] — Чернавский, [АИР] — каталог двигателей.</p>
        <div class="opts chk-bar"><div class="opt"><div class="opt-t"><b>Сверка с ручным расчётом</b><span id="chk-sum">${CHK.on ? '' : 'Под каждой формулой появится поле для вашего значения: утилита сравнит его и подскажет причину расхождения — округление, другой двигатель, другая формула методики или ошибка в подстановке.'}</span></div><div class="opt-c" style="display:flex;gap:10px;align-items:center">${CHK.on ? '<button class="btn" id="chk-clr">Очистить</button>' : ''}<label class="sw"><input type="checkbox" id="chk-on" ${CHK.on ? 'checked' : ''}><span class="track" aria-hidden="true"></span><span class="sr">Сверка</span></label></div>${CHK.on || !window.SUITE || !SUITE.chkEx ? '' : SUITE.chkEx('T<sub>I</sub> = 9550·P<sub>I</sub>/n<sub>I</sub> = ' + fnum(S.R.K.TI || S.R.K.T1B) + ' Н·м', fnum(S.R.K.TI || S.R.K.T1B))}</div></div>
        ${tab === 'kin' ? motorAuditHtml() : ''}${body}
        <div style="display:flex;justify-content:space-between;gap:8px;margin-top:22px;flex-wrap:wrap">${k > 1 ? `<button class="btn" data-go="${TABS[k - 1].id}">← ${esc(TABS[k - 1].short)}</button>` : '<span></span>'}${k < TABS.length - 1 ? `<button class="btn" data-go="${TABS[k + 1].id}">${esc(TABS[k + 1].short)} →</button>` : ''}</div>
      </div></article>`;
    bindCalc(main); bindChk(main);
    $$('[data-go]', main).forEach(b => b.onclick = () => go(b.dataset.go));
  }
  function leadText(tab) {
    const t = S.P.task;
    switch (tab) {
      case 'kin': return 'Исходные данные варианта, выбор электродвигателя по каталогу АИР, разбивка передаточного отношения и параметры всех валов привода.';
      case 'mat': return t === 3 ? 'Материалы червяка и венца червячного колеса по ожидаемой скорости скольжения, допускаемые контактные и изгибные напряжения.' : 'Стали и термообработка шестерён и колёс, допускаемые напряжения по методичке.';
      case 'gear': return t === 3 ? 'Червячная передача: геометрия, силы, КПД, проверка на контактную и изгибную выносливость, открытая цепная передача и тепловой расчёт.' : t === 6 ? 'Две цилиндрические прямозубые ступени и открытая цепная передача.' : 'Коническая и цилиндрическая прямозубые ступени: проектный расчёт, силы, проверка выносливости зубьев.';
      case 'shaft': return 'Ориентировочные диаметры валов, размеры колёс, корпус редуктора и эскизная компоновка с опорными расстояниями.';
      case 'check': return 'Реакции опор, эпюры моментов и проверка прочности валов, подбор и проверка шпонок и подшипников качения.';
      case 'other': return t === 6 ? 'Посадки, смазка, расчёт вала конвейера с барабаном и подбор муфты.' : 'Посадки деталей, смазка зацеплений и подшипников, подбор муфты.';
    }
    return '';
  }

  /* ---------- вкладка КОМПАС ---------- */
  function kompasCatalog(K) {
    if (!K || !K.catalog) return '';
    let cat = [];
    try { cat = K.catalog(S.R, S.P, S.T); } catch (e) { console.error(e); return ''; }
    const off = K.offSet(S.T);
    return `<div class="kcat"><div class="kcat-bar"><button class="btn sm" data-kall="all">Всё</button><button class="btn sm" data-kall="req">Только чертежи по заданию</button></div>` + cat.map(g => `<fieldset class="kcat-g"><legend>${esc(g.title)}</legend>${g.items.map(it => `<label class="kcat-i"><input type="checkbox" data-koff="${esc(it.key)}" ${off.has(it.key) ? '' : 'checked'}><span>${esc(it.title)}${it.req ? ' <em class="kcat-req">по заданию</em>' : ''}${it.note ? `<small>${esc(it.note)}</small>` : ''}</span></label>`).join('')}</fieldset>`).join('') + '</div>';
  }
  function kompasCheck(K) {
    if (!K || !K.modelCheck) return '';
    let r = null;
    try { r = K.modelCheck(S.R, S.P, S.T); } catch (e) { console.error(e); }
    if (!r || r.error) return `<div class="note warn">Проверку выполнить не удалось${r && r.error ? ': ' + esc(r.error) : ''}.</div>`;
    const bad = (r.lines || []).filter(l => !l.ok), good = (r.lines || []).filter(l => l.ok);
    const head = `<p>Перед выгрузкой модель проверяется так же, как её построит КОМПАС: ни одна деталь сборки не должна заходить в другую (касание по посадке или опорной поверхности допускается), а габариты корпуса и крышки, диаметры расточек и межосевые расстояния в модели должны совпадать с чертежами. Результат проверки макрос <code>20_assembly.py</code> повторяет в журнале.</p>`;
    const sum = bad.length ? `<div class="note bad"><b>Найдено замечаний: ${bad.length}</b> (пересечений деталей — ${r.clashes}, расхождений с чертежами — ${r.drawingMismatch}).</div>` : `<div class="note">Пересечений деталей нет; модель совпадает с чертежами по ${good.length} проверенным размерам.</div>`;
    const list = arr => `<ul class="kchk">${arr.map(l => `<li class="${l.ok ? 'ok' : 'bad'}">${esc(l.msg)}</li>`).join('')}</ul>`;
    return head + sum + (bad.length ? list(bad) : '') + (good.length ? `<details class="kchk-d"><summary>Проверенные размеры (${good.length})</summary>${list(good)}</details>` : '');
  }
  /* ---------- скрытое меню отладки (Ctrl+Shift+D или ?debug в адресе) ---------- */
  function dbgOn() { try { return /[?&]debug\b/.test(location.search) || localStorage.getItem('opkp_debug') === '1'; } catch (e) { return /[?&]debug\b/.test(location.search); } }
  function debugPanel() {
    const rows = [1, 3, 6].map(t => {
      const nos = Array.from({ length: 26 }, (x, i) => i + 1).filter(no => D.byListNo(no).task === t);
      return `<div class="dbg-g"><b>Задание ${t} — ${esc(D.TASKS[t].short)}</b> <button class="btn sm" data-dbgt="${t}">все</button><div>${nos.map(no => { const v = D.byListNo(no).v; return `<label class="dbg-c"><input type="checkbox" data-dbgno="${no}"${[4, 12, 22].includes(no) ? ' checked' : ''}> № ${no} (вар. ${v})</label>`; }).join('')}</div></div>`;
    }).join('');
    return `<h2 id="dbg">7. Отладка: прогон нескольких вариантов в КОМПАС</h2>
      <div class="note">Скрытое меню (включается и выключается сочетанием Ctrl+Shift+D). Сначала отметьте варианты и, если нужно, сочетания настроек, затем скачайте отладочный exe или архив: в оба попадут <b>только отмеченные</b> варианты и сочетания.</div>
      <h3>Шаг 1. Варианты</h3>
      <p><button class="btn sm" data-dbgp="all">Все 26</button> <button class="btn sm" data-dbgp="3">По одному на задание (№ 4, 12, 22)</button> <button class="btn sm" data-dbgp="cur">Только текущий (№ ${S.P.listNo})</button> <button class="btn sm" data-dbgp="none">Снять все</button> <span id="dbgn" class="hint"></span></p>
      ${rows}
      <p class="hint">Настройки чертежей — текущие с этой страницы (раздел 5): ${esc(dbgSettings())}. Исходные данные вариантов — по умолчанию.</p>
      <h3>Шаг 1б. Сочетания настроек (необязательно)</h3>
      <p class="hint">Каждое сочетание — отдельный прогон отмеченного варианта, в котором изменена одна настройка: то, что пользователь может выбрать иначе, чем по умолчанию. Значение по умолчанию уже входит в основной прогон.</p>
      <p>${[['calc', 'Методики расчёта (раздел 3): частота двигателя, u цепи, a<sub>w</sub>, числа зубьев, момент на тихоходном валу, [σ]<sub>H</sub> червячного колеса и все остальные'], ['motors', 'Двигатели: каждый подходящий из списка «Двигатель» (750–3000 мин⁻¹, мощнее расчётного)'], ['consts', 'Константы методики: КПД, [τ], запас прочности, K<sub>б</sub>, [σ]<sub>см</sub>, наклон цепи и др. — на краях диапазона'], ['drw', 'Настройки чертежей: один масштаб, обозначения отрезками (формат — А1)']].map(([k, t]) => `<label class="dbg-c" style="display:block"><input type="checkbox" data-dbgc="${k}"> ${t}</label>`).join('')}</p>
      <h3>Шаг 2. Скачать — выберите один способ</h3>
      <div class="opt"><div class="opt-t"><b>Отладочный KOMPAS Build (.exe) — рекомендуется</b><span>Python не нужен. В окне уже отмечены спецификации, чертежи и калибровка эмулятора, 3D выключено (его можно включить). Варианты идут подряд, журнал подробный. В конце в папке результатов появится <b>debug_logs.zip</b> — его и пришлите. Время: калибровка ≈ 5 мин, затем ≈ 1 мин на вариант (все 26 — около получаса); с 3D — 5–15 мин на вариант.</span></div><div class="opt-c"><button class="btn primary" id="dbgexe">${dlIcon()} KOMPAS-Build-debug.exe</button></div></div>
      <div class="opt"><div class="opt-t"><b>Архив с макросами и bat (.zip)</b><span>Нужен свой Python с pywin32. Строит всё, включая 3D, PNG-снимки и DXF-копии листов; в конце — <b>debug_для_отправки.zip</b>. Время: 5–15 мин на вариант, все 26 — несколько часов.</span></div><div class="opt-c"><button class="btn" id="dbgzip">${dlIcon()} OP_KP_DEBUG.zip</button></div></div>
      <p><span id="dbgst" class="hint"></span></p>`;
  }
  /* настройки чертежей, которые уйдут в отладочный exe (как в разделе 5) */
  function dbgSettings() {
    const T = S.T || {}, DV = window.DRWCORE ? window.DRWCORE.opts.VIEWS_DEF : { vo: {}, sb: {} }, tv = T.views || {};
    const off = g => Object.entries(Object.assign({}, DV[g], tv[g] || {})).filter(([, v]) => !v).length;
    const nOff = Object.keys(T.koff || {}).length, vOff = off('vo') + off('sb');
    return ['формат ' + (T.sheetFmt || 'A1').replace('A', 'А'), T.kompasDims === 'lines' ? 'обозначения отрезками' : 'обозначения объектами КОМПАС',
      T.noDims ? 'без размеров' : 'с размерами', T.scaleUniform ? 'виды в одном масштабе' : 'масштаб видов как в методичке',
      vOff ? 'выключено видов: ' + vOff : 'все виды', nOff ? 'выключено элементов состава: ' + nOff : 'полный состав'].join(', ');
  }
  function bindDebug(main) {
    if (!dbgOn() || !$('#dbgzip', main)) return;
    const boxes = () => $$('[data-dbgno]', main);
    // прогоны: каждый отмеченный вариант с настройками по умолчанию + выбранные сочетания (js/opt_combos.js)
    const jobsOf = T0 => {
      const sel = {}; $$('[data-dbgc]', main).forEach(c => { sel[c.dataset.dbgc] = c.checked; });
      const any = Object.values(sel).some(Boolean), out = [];
      boxes().filter(c => c.checked).forEach(c => {
        const no = +c.dataset.dbgno, d = D.byListNo(no);
        out.push({ no, task: d.task, v: d.v, T: T0, suf: '' });
        if (any && window.OPT_COMBOS) window.OPT_COMBOS(no, sel).forEach(x => out.push({ no, task: d.task, v: d.v, O: x.O, T: Object.assign({}, T0, x.T || {}), suf: '_' + x.key, name: x.name }));
      });
      return out;
    };
    const cnt = () => {
      const n = boxes().filter(c => c.checked).length, j = jobsOf({}).length, h = (5 + j) / 60;
      $('#dbgn', main).textContent = `Отмечено вариантов: ${n} из 26` + (j > n ? `, прогонов с сочетаниями: ${j} — в КОМПАС ≈ ${h < 1.5 ? Math.round(h * 60) + ' мин' : Math.round(h) + ' ч'}` : '');
    };
    [...boxes(), ...$$('[data-dbgc]', main)].forEach(c => c.addEventListener('change', cnt)); cnt();
    $$('[data-dbgt]', main).forEach(b => b.onclick = () => boxes().forEach(c => { if (D.byListNo(+c.dataset.dbgno).task === +b.dataset.dbgt) c.checked = true; }) || cnt());
    $$('[data-dbgp]', main).forEach(b => b.onclick = () => { const m = b.dataset.dbgp; boxes().forEach(c => { const no = +c.dataset.dbgno; c.checked = m === 'all' ? true : m === 'none' ? false : m === 'cur' ? no === S.P.listNo : [4, 12, 22].includes(no); }); cnt(); });
    $('#dbgexe', main).onclick = async () => {
      const btn = $('#dbgexe', main), st = $('#dbgst', main);
      const T0 = JSON.parse(JSON.stringify(S.T || {}));
      const jobs = jobsOf(T0);
      if (!jobs.length) { st.textContent = 'Отметьте хотя бы один вариант.'; return; }
      btn.disabled = true;
      const workers = [];
      try {
        const exeP = builderExe();
        // варианты считаются параллельно в фоновых потоках (js/dbg_worker.js): раскладка листов одного варианта — 10–20 с
        const scripts = [...document.querySelectorAll('script[src]')].map(x => x.src).filter(u => /\/js\//.test(u) && !/(app|suite|debug)\.js/.test(u));
        const ver = (scripts[0] || '').split('?')[1] || '';
        const nW = Math.max(1, Math.min(6, (navigator.hardwareConcurrency || 4) - 1, jobs.length));
        const z = new JSZip(), dirs = new Array(jobs.length);
        let done = 0, next = 0;
        const t0 = Date.now();
        const show = () => {
          const el = (Date.now() - t0) / 1000, left = done ? Math.round(el / done * (jobs.length - done)) : null;
          st.textContent = `Расчёт вариантов: готово ${done} из ${jobs.length} (потоков: ${nW})` + (left !== null ? `, осталось ≈ ${left < 60 ? left + ' с' : Math.ceil(left / 60) + ' мин'}` : '…');
        };
        show();
        await new Promise((resolve, reject) => {
          const run = w => {
            if (next >= jobs.length) return;
            const id = next++;
            w.onmessage = e => {
              const r = e.data;
              if (r.err) { reject(new Error('№ ' + jobs[id].no + ': ' + r.err.split('\n')[0])); return; }
              const dir = window.KPDEBUG.dirOf(r.task, r.v) + jobs[id].suf;
              dirs[id] = dir;
              r.files.forEach(([p, t]) => z.file(dir + '/' + p, t));
              done++; show();
              if (done === jobs.length) resolve(); else run(w);
            };
            w.onerror = e => reject(new Error(e.message || 'сбой фонового потока'));
            w.postMessage({ id, no: jobs[id].no, O: jobs[id].O, T: jobs[id].T, cal: id === 0 });   // калибровка — только в первой папке
          };
          for (let k = 0; k < nW; k++) {
            const w = new Worker('js/dbg_worker.js' + (ver ? '?' + ver : ''));
            w.postMessage({ init: scripts });
            workers.push(w);
            run(w);
          }
        });
        z.file('debug.json', JSON.stringify({ vars: dirs }));
        st.textContent = 'Упаковка…';
        const exe = await exeP; if (!exe) { st.textContent = 'Не удалось скачать KOMPAS Build — проверьте соединение'; return; }
        const zb = await z.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
        const tail = new Uint8Array(16); new DataView(tail.buffer).setBigUint64(0, BigInt(zb.length), true); tail.set(new TextEncoder().encode('KPBUILD1'), 8);
        downloadBlob('KOMPAS-Build-debug.exe', new Blob([exe, zb, tail], { type: 'application/octet-stream' }));
        st.textContent = `Готово за ${Math.round((Date.now() - t0) / 1000)} с: прогонов — ${jobs.length}.`;
      } catch (e) { console.error(e); st.textContent = 'Ошибка: ' + e.message; } finally { workers.forEach(w => w.terminate()); btn.disabled = false; }
    };
    $('#dbgzip', main).onclick = async () => {
      const btn = $('#dbgzip', main), st = $('#dbgst', main);
      const list = jobsOf({}).map(j => Object.assign({}, D.byListNo(j.no), j, { T: j.T }));
      if (!list.length) { st.textContent = 'Отметьте хотя бы один вариант.'; return; }
      btn.disabled = true;
      try {
        const blob = await window.KPDEBUG.build(list, (no, O) => { const P = fresh(no); Object.assign(P.O, O || {}); return { P, R: compute(P) }; }, S.T, (i, n, x) => { st.textContent = x ? `Расчёт № ${x.no} (${i + 1} из ${n})…` : 'Упаковка архива…'; });
        downloadBlob('OP_KP_DEBUG.zip', blob); st.textContent = `Готово: прогонов — ${list.length}.`;
      } catch (e) { console.error(e); st.textContent = 'Ошибка: ' + e.message; } finally { btn.disabled = false; }
    };
  }
  document.addEventListener('keydown', e => {
    if (e.ctrlKey && e.shiftKey && (e.code === 'KeyD')) {
      e.preventDefault();
      const on = !dbgOn();
      try { localStorage.setItem('opkp_debug', on ? '1' : '0'); } catch (err) { /* ignore */ }
      if (typeof toast === 'function') toast(on ? 'Меню отладки включено — вкладка «КОМПАС», раздел 7' : 'Меню отладки выключено');
      if (S.tab === 'kompas') renderTab();
    }
  });
  /* вкладка КОМПАС: сначала мгновенно показывается каркас с индикатором, тяжёлая подготовка (модели, листы) — после отрисовки кадра */
  let kompasTok = 0;
  function renderKompas(main, keepY) {
    const tok = ++kompasTok;
    if (keepY === undefined) {
      main.innerHTML = `<article class="sheet">
        <header class="sheet-head"><div><div class="eyebrow">Курсовой проект · файлы для КОМПАС</div><h1>Файлы для КОМПАС-3D v25</h1><p class="lead">Python-макросы строят 3D-модели деталей и сборку редуктора, рабочие чертежи с основной надписью и спецификацию. Для ручного построения — таблицы размеров и DXF-контуры.</p></div>${stamp('kompas')}</header>
        <div class="sheet-body rep"><div class="k-load" role="status" aria-live="polite"><span class="spinner"></span><div class="k-load-t"><b>Готовлю файлы для КОМПАС</b><small>3D-модели, проверка сборки, листы чертежей — несколько секунд</small><span class="k-bar"><i style="width:4%"></i></span></div></div>
        <div class="k-skel"><i></i><i></i><i></i><i class="w60"></i></div><div class="k-skel cards"><i></i><i></i><i></i></div></div></article>`;
    } else main.classList.add('k-busy');
    // листы строятся по этапам с паузами — каркас и индикатор успевают отрисоваться и обновляться
    const K = window.KOMPAS, R = S.R, P = S.P, T = S.T;
    let nStep = 0; const step = t => { const el = $('.k-load small', main), bar = $('.k-bar i', main); if (el) el.textContent = t + '…'; if (bar) bar.style.width = Math.min(96, 8 + 13 * ++nStep) + '%'; };
    const frame = () => new Promise(res => requestAnimationFrame(() => setTimeout(res, 0)));
    (async () => {
      await frame(); await frame();
      try {
        if (K && K.sheetsAsync) await K.sheetsAsync(R, P, T, t => { if (tok === kompasTok) step(t); });
        if (tok !== kompasTok) return;
        step('Проверка 3D-сборки'); await frame();
        if (K && K.modelCheck) K.modelCheck(R, P, T);
        step('Макросы и файлы'); await frame();
      } catch (e) { console.error(e); }
      if (tok !== kompasTok || S.tab !== 'kompas' || S.R !== R) return;
      try { renderKompasFull(main); } finally { main.classList.remove('k-busy'); }
      if (keepY !== undefined) window.scrollTo(0, keepY);
      buildToc();
    })();
  }
  /* KOMPAS Build (runner/kp_builder.py, собран в dl/KOMPAS-Build.exe): макросы без установленного Python */
  const EDU_URL = 'https://kompas.ru/kompas-educational/about/';   // КОМПАС-3D Учебная версия (бесплатная, АСКОН)
  const BUILDER_VER = '1.5';
  let builderBlob = null;
  /* одноразовый KOMPAS Build: в конец exe дописываются макросы варианта (zip; данные и настройки — уже в макросах):
     [exe][zip][длина zip — 8 байт little-endian]['KPBUILD1'] — построитель находит их в своём файле и распаковывает сам */
  const exeName = () => zipName('KOMPAS').replace(/\.zip$/, '.exe');
  async function personalExe(files) {
    const exe = await builderExe(); if (!exe) return null;
    const z = new JSZip(); files.forEach(f => z.file(f.path, f.gen()));
    const zb = await z.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
    const tail = new Uint8Array(16); new DataView(tail.buffer).setBigUint64(0, BigInt(zb.length), true); tail.set(new TextEncoder().encode('KPBUILD1'), 8);
    return new Blob([exe, zb, tail], { type: 'application/octet-stream' });
  }
  async function builderExe() {
    if (builderBlob) return builderBlob;
    try { const r = await fetch('dl/KOMPAS-Build.exe?v=' + BUILDER_VER); if (!r.ok) return null; builderBlob = await r.blob(); return builderBlob; }
    catch (e) { console.error(e); return null; }
  }
  function renderKompasFull(main) {
    const K = window.KOMPAS;
    const files = K ? K.files(S.R, S.P, S.T) : [];
    const hints = K ? K.hints(S.R, S.P, S.T) : '';
    main.innerHTML = `<article class="sheet">
      <header class="sheet-head"><div><div class="eyebrow">Курсовой проект · файлы для КОМПАС</div><h1>Файлы для КОМПАС-3D v25</h1><p class="lead">Python-макросы строят 3D-модели деталей и сборку редуктора, рабочие чертежи с основной надписью и спецификацию. Для ручного построения — таблицы размеров и DXF-контуры.</p></div>${stamp('kompas')}</header>
      <div class="sheet-body rep">
        <h2>1. Как запустить макросы</h2>
        <div class="note">Для построения нужен установленный <b>КОМПАС-3D v25</b>. Подойдёт бесплатная <a href="${EDU_URL}" target="_blank" rel="noopener">КОМПАС-3D Учебная версия</a> от АСКОН: её достаточно для всех макросов (детали, сборка, чертежи, спецификации).</div><ol class="steps-n"><li>Скачайте KOMPAS Build — <b>один файл .exe</b>, в который уже вшиты макросы, ваш вариант и все настройки с сайта: <button class="btn primary sm" id="kb1">${dlIcon()} Скачать ${esc(exeName())}</button> Распаковывать ничего не нужно, <b>Python ставить не нужно</b>. Файл одноразовый: поменяли вариант или настройки — скачайте заново.</li><li>Отметьте этапы и нажмите «Построить». КОМПАС-3D запустится сам — по умолчанию <b>в фоне, без окна</b>: ход, ошибки и итог по каждому этапу видны в окне KOMPAS Build. Если КОМПАС уже был открыт, на время построения он скроется и вернётся, а запущенный построителем — закроется в конце. Снимите отметку «КОМПАС в фоне», чтобы смотреть, как строится модель.</li><li>Файлы <code>.m3d</code>, <code>.a3d</code>, <code>.cdw</code>, <code>.spw</code> сохраняются в папку с тем же именем, что у exe, рядом с ним (если в пути есть кириллица — в <code>C:\\KP\\</code>); путь виден в окне построителя. Там же архив для отправки <code>для_отправки.zip</code> и журнал <code>log.txt</code> (кнопка «Журнал» в окне).</li></ol><div class="note">Если Windows покажет «Windows защитила ваш компьютер», нажмите «Подробнее» → «Выполнить в любом случае»: программа не подписана платным сертификатом. Некоторые антивирусы так же настороженно относятся к любым программам, собранным из Python; исходный код — <code>runner/kp_builder.py</code> в репозитории утилиты.</div><details class="adv"><summary>Без KOMPAS Build — через свой Python</summary><div class="in"><ol class="steps-n"><li>Нажмите «Скачать всё (.zip)» внизу страницы и распакуйте архив в папку без кириллицы в пути, например <code>C:\\KP\\</code>. Результаты — в папке <code>out</code> рядом с макросами.</li><li>Установите обычный Python 3 с <a href="https://www.python.org/downloads/" target="_blank" rel="noopener">python.org</a>. В первом окне установщика отметьте <b>Add python.exe to PATH</b>. Встроенный в КОМПАС Python не нужен: макросы управляют КОМПАСом снаружи, через его COM-интерфейс.</li><li>Один раз запустите <code>01_install_pywin32.bat</code>: он ставит пакет <code>pywin32</code>, через который Python связывается с КОМПАС. Нужен интернет.</li><li>Запустите <code>02_run_all.bat</code>. Можно запускать и отдельные макросы: <code>py 10_parts.py</code> и т. д.</li></ol></div></details>
        <div class="note warn">Макросы используют API КОМПАС (KompasAPI5/API7 через pywin32). Если какой-то шаг не выполнится, остальные продолжат работу, а в журнале будет указано, что построить вручную; размеры для ручного построения — в таблицах ниже и в DXF.</div>
        <h2>2. Состав: что строить</h2>
        <p>Снимите отметку, если элемент не нужен по заданию или методичке, — макросы его не построят, он пропадёт из сборки, архива и предпросмотра. Отметка «по заданию» — листы, которые требует задание на курсовой проект. Выбор сохраняется вместе с вариантом.</p>
        ${kompasCatalog(K)}
        <h2>3. Проверка 3D-модели</h2>
        ${kompasCheck(K)}
        <h2>4. Файлы</h2>
        <div class="files"><div class="files-head"><h3>Макросы и файлы для КОМПАС-3D</h3><button class="btn primary" id="kz">${dlIcon()} Скачать всё (.zip)</button></div>
          <div class="file-row builder-row"><span><b>${esc(exeName())}</b><small>KOMPAS Build со всеми макросами, вариантом и настройками внутри: запускается сам, без папки с файлами. Python, pywin32 и Pillow уже внутри, КОМПАС работает в фоне (≈18 МБ, Windows 10/11 x64). Нужен КОМПАС-3D v25 — подойдёт бесплатная <a href="${EDU_URL}" target="_blank" rel="noopener">Учебная версия</a></small></span><button class="btn sm" id="kb" aria-label="Скачать ${esc(exeName())}" title="Скачать">${dlIcon()}</button></div>
          ${files.map((f, i) => `<div class="file-row"><span><b>${esc(f.path)}</b><small>${esc(f.desc || '')}</small></span><button class="btn sm" data-kf="${i}" aria-label="Скачать ${esc(f.path)}" title="Скачать">${dlIcon()}</button></div>`).join('')}</div>
        <h2>5. Чертежи и спецификации</h2>
        <p>Листы, которые строит макрос <code>30_drawings.py</code>: сборочные чертежи, общий вид привода, рабочие чертежи деталей и спецификации (ГОСТ 2.106). Рамку и основную надпись КОМПАС добавит сам, здесь они для наглядности.</p>
        ${(() => { const DV = window.DRWCORE ? window.DRWCORE.opts.VIEWS_DEF : { vo: {}, sb: {} }, tv = S.T.views || {}, vo = Object.assign({}, DV.vo, tv.vo || {}), sb = Object.assign({}, DV.sb, tv.sb || {});
          const SBN = { 1: ['вид сверху (план)', 'вид слева'], 3: ['разрез Б–Б', 'вид сверху'], 6: ['вид вдоль валов (над разрезом)', 'вид слева'] }[S.P.task] || ['второй вид', 'третий вид'];
          const ksw = (id, on, label) => `<label class="sw"><input type="checkbox" id="${id}" ${on ? 'checked' : ''}><span class="track" aria-hidden="true"></span><span class="sr">${label}</span></label>`;
          const opt = (title, desc, ctl) => `<div class="opt"><div class="opt-t"><b>${title}</b><span>${desc}</span></div><div class="opt-c">${ctl}</div></div>`;
          const vch = (grp, key, label, on) => `<label class="vchip"><input type="checkbox" data-vw="${grp}.${key}" ${on ? 'checked' : ''}><span>${label}</span></label>`;
          const wf = S.T.wormFa === '1643' ? '1643' : '3675';
          // формат листов: превью — листы в одном масштабе, с рамкой и основной надписью
          const SF = ['A4', 'A3', 'A2', 'A1', 'A0'], sf = SF.includes(S.T.sheetFmt) ? S.T.sheetFmt : 'A1';
          const FSZ = { A4: [210, 297], A3: [420, 297], A2: [594, 420], A1: [841, 594], A0: [1189, 841] };
          const sheetPv = f => { const [w, h] = FSZ[f], y0 = 850 - h; return `<svg viewBox="0 0 1200 850" style="display:block;width:100%;height:64px" aria-hidden="true"><rect x="1" y="${y0}" width="${w - 2}" height="${h - 1}" fill="#fff" stroke="#7d8996" stroke-width="6"/><rect x="20" y="${y0 + 5}" width="${w - 25}" height="${h - 10}" fill="none" stroke="#1b232c" stroke-width="5"/><rect x="${w - 190}" y="${850 - 60}" width="185" height="55" fill="none" stroke="#1b232c" stroke-width="5"/></svg>`; };
          const fmtEx = `<div class="ex-multi" style="--n:5">${SF.map(f => `<div class="ex${f === sf ? ' on' : ''}"><div class="ex-h"><span class="ex-l">${f.replace('A', 'А')}</span>${f === sf ? '<span class="ex-now">сейчас</span>' : ''}</div><div class="ex-b">${sheetPv(f)}<div class="ex-f">${FSZ[f][0]}×${FSZ[f][1]} мм</div></div></div>`).join('')}</div>`;
          const fmtSeg = `<div class="seg" role="radiogroup" aria-label="Формат листов чертежей" id="sheetfmt">${SF.map(f => `<button type="button" role="radio" aria-checked="${f === sf}" data-val="${f}">${f.replace('A', 'А')}</button>`).join('')}</div>`;
          return `<div class="opts dw-opts">
            <div class="opt has-seg"><div class="opt-t"><b>Формат листов чертежей</b><span>ГОСТ 2.301. Масштаб каждого листа — наибольший стандартный по ГОСТ 2.302, при котором виды в проекционной связи, размеры и надписи ложатся без наложений; он же пишется в основной надписи. Если на формате меньше А1 так не выходит, лист переходит на следующий формат. Спецификации — всегда А4.</span></div><div class="opt-c">${fmtSeg}</div><div class="opt-ex">${fmtEx}</div></div>
            ${opt('Без размеров', 'Размеры и посадки проставите сами в КОМПАС; позиции, шероховатость и техтребования останутся.', ksw('nodims', S.T.noDims, 'Без размеров'))}
            ${opt('Обозначения — объектами КОМПАС', 'Размеры, позиции, шероховатость и надписи можно выделять и править. Выключено — всё отрезками и текстом.', ksw('kdims', S.T.kompasDims !== 'lines', 'Обозначения объектами КОМПАС'))}
            <div class="opt opt-views"><div class="opt-t"><b>Виды на чертежах</b><span>Главный вид строится всегда, остальные — по ГОСТ 2.305. Не помещаются на лист — масштаб станет мельче.</span></div>
              <div class="vgroups">
                <div class="vgroup"><span class="vgroup-t">Общий вид привода</span><div class="vchips">${vch('vo', 'top', 'сверху', vo.top)}${vch('vo', 'left', 'слева', vo.left)}${vch('vo', 'right', 'справа', vo.right)}${vch('vo', 'bottom', 'снизу', vo.bottom)}${vch('vo', 'back', 'сзади', vo.back)}</div></div>
                <div class="vgroup"><span class="vgroup-t">Сборочный чертёж редуктора</span><div class="vchips">${vch('sb', 'second', SBN[0], sb.second)}${vch('sb', 'extra', SBN[1], sb.extra)}</div><small>Позиции деталей, видных только на выключенном виде, пропадут.</small></div>
              </div></div>
            ${opt('Все виды редуктора в одном масштабе', 'Выключено — как в методичке: неосновные виды можно мельче.', ksw('scaleu', S.T.scaleUniform, 'Один масштаб'))}
            ${S.P.task === 3 ? `<div class="opt has-seg"><div class="opt-t"><b>Допуск межосевого расстояния</b><span>В методичке не задан. ГОСТ 3675-81 — для червячных передач, ГОСТ 1643-81 — как для цилиндрических.</span></div><div class="opt-c"><div class="seg" role="radiogroup" aria-label="Допуск межосевого расстояния" id="wormfa">${[['3675', 'ГОСТ 3675-81'], ['1643', 'ГОСТ 1643-81']].map(([v, l]) => `<button type="button" role="radio" aria-checked="${v === wf}" data-val="${v}">${l}</button>`).join('')}</div></div></div>` : ''}
          </div>`; })()}
        <div class="dw-top"><span class="dhint">Нажмите на лист, чтобы открыть его крупно.</span><button class="btn primary" id="pdfall">${dlIcon()} Альбом чертежей и спецификаций (.pdf)</button></div>
        <div class="dw-grid" id="dwg"><p class="progress"><span class="spinner"></span>Строю листы…</p></div>
        <h2>6. Размеры для построения вручную</h2>
        ${hints}
        ${dbgOn() ? debugPanel() : ''}
      </div></article>`;
    bindDebug(main);
    $$('[data-koff]', main).forEach(cb => cb.onchange = () => {
      const k = cb.dataset.koff; S.T.koff = Object.assign({}, S.T.koff || {});
      if (cb.checked) delete S.T.koff[k]; else S.T.koff[k] = 1;
      saveT(); renderKompas(main, window.scrollY);
    });
    { const nd = $('#nodims', main); if (nd) nd.onchange = () => { S.T.noDims = nd.checked; saveT(); renderKompas(main, window.scrollY); }; }
    { const pb = $('#pdfall', main); if (pb) pb.onclick = () => makeAlbum(pb); }
    { const kd = $('#kdims', main); if (kd) kd.onchange = () => { S.T.kompasDims = kd.checked ? 'native' : 'lines'; saveT(); renderKompas(main, window.scrollY); }; }
    { const su = $('#scaleu', main); if (su) su.onchange = () => { S.T.scaleUniform = su.checked; saveT(); renderKompas(main, window.scrollY); }; }
    main.querySelectorAll('[data-vw]').forEach(el => { el.onchange = () => { const [g, k] = el.dataset.vw.split('.'); S.T.views = S.T.views || {}; S.T.views[g] = Object.assign({}, S.T.views[g] || {}, { [k]: el.checked }); saveT(); renderKompas(main, window.scrollY); }; });
    $$('#sheetfmt button', main).forEach(b => b.onclick = () => { if (b.getAttribute('aria-checked') === 'true') return; S.T.sheetFmt = b.dataset.val; saveT(); renderKompas(main, window.scrollY); });
    $$('#wormfa button', main).forEach(b => b.onclick = () => { if (b.getAttribute('aria-checked') === 'true') return; S.T.wormFa = b.dataset.val; saveT(); renderKompas(main, window.scrollY); });
    $$('[data-kall]', main).forEach(b => b.onclick = () => {
      const mode = b.dataset.kall; S.T.koff = {};
      if (mode === 'req') { try { K.catalog(S.R, S.P, S.T).forEach(g => g.items.forEach(it => { if (g.title === 'Чертежи' && !it.req) S.T.koff[it.key] = 1; })); } catch (e) { console.error(e); } }
      saveT(); renderKompas(main, window.scrollY);
    });
    $$('[data-kf]', main).forEach(b => b.onclick = () => { const f = files[+b.dataset.kf]; downloadBlob(f.path.split('/').pop(), new Blob([f.gen()], { type: 'text/plain;charset=utf-8' })); });
    setTimeout(() => {
      const box = $('#dwg', main); if (!box || !K || !K.sheets) return;
      let list = [];
      try { const off = K.offSet(S.T); list = K.sheets(S.R, S.P, S.T).list.filter(d => !off.has('s:' + d.id)); } catch (e) { console.error(e); }
      try { if (K.specSheets) list = list.concat(K.specSheets(S.R, S.P, S.T)); } catch (e) { console.error(e); }   // спецификации — после чертежей
      if (!list.length) { box.innerHTML = '<p>Не удалось построить листы для этого варианта.</p>'; return; }
      box.innerHTML = list.map((d, i) => `<button class="dw-card" data-dw="${i}" aria-label="Открыть лист ${esc(d.code)}"><span class="dw-img">${K.sheetSVG(d, S.T, { px: 900 })}</span><span class="dw-cap"><b>${esc(d.isSpec ? 'Спецификация — ' + d.name.split('\n')[0] : d.name.replace('\n', ' — '))}</b><small>${esc(d.code)} · ${d.fmt.replace('A', 'А')}${d.scale ? ' · ' + esc(d.scale) : ''}</small></span></button>`).join('');
      $$('[data-dw]', box).forEach(b => b.onclick = () => {
        const d = list[+b.dataset.dw];
        const ov = document.createElement('div'); ov.className = 'dw-over';
        ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-label', d.code);
        ov.innerHTML = `<div class="dw-bar"><b>${esc(d.code)} — ${esc(d.name.replace('\n', ' — '))}</b><span><button class="btn sm" id="dwzoom" aria-pressed="false" title="Масштаб: весь лист / крупно">⤢</button><button class="btn sm" id="dwpng">${dlIcon()} PNG</button><button class="btn sm" id="dwx" aria-label="Закрыть">✕</button></span></div><div class="dw-big">${K.sheetSVG(d, S.T, { px: 3200 })}</div>`;
        document.body.appendChild(ov);
        const prevOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden';
        const onKey = e => { if (e.key === 'Escape') close(); };
        const close = () => { ov.remove(); document.body.style.overflow = prevOverflow; document.removeEventListener('keydown', onKey); b.focus(); };
        document.addEventListener('keydown', onKey);
        $('#dwx', ov).onclick = close; $('#dwx', ov).focus();
        $('#dwzoom', ov).onclick = () => { const big = $('.dw-big', ov), z = big.classList.toggle('zoom'); $('#dwzoom', ov).setAttribute('aria-pressed', String(z)); };
        $('#dwpng', ov).onclick = async () => {
          const b = $('#dwpng', ov); b.disabled = true;
          try { const blob = await sheetPng(K.sheetSVG(d, S.T, { px: 3200 }), 4000); if (blob) downloadBlob(d.file.replace('.cdw', '.png'), blob); else toast('Не удалось сохранить PNG'); } finally { b.disabled = false; }
        };
      });
    }, 30);
    const kz = $('#kz', main); if (kz) kz.onclick = async () => {
      if (kz.disabled) return;
      const label = kz.innerHTML; kz.disabled = true; kz.innerHTML = '<span class="spinner"></span>Собираю архив…';
      try {
        const zip = new JSZip(); files.forEach(f => zip.file('KOMPAS/' + f.path, f.gen()));
        const exe = await personalExe(files);   // одноразовый KOMPAS Build с макросами внутри — тоже в архиве
        if (exe) zip.file('KOMPAS/' + exeName(), exe, { binary: true, compression: 'STORE' });
        else toast('KOMPAS Build не загрузился — в архиве только макросы; запуск через свой Python описан в п. 1');
        downloadBlob(zipName('KOMPAS'), await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' }));
      } finally { kz.disabled = false; kz.innerHTML = label; }
    };
    $$('#kb, #kb1', main).forEach(kb => kb.onclick = async () => {
      if (kb.disabled) return; kb.disabled = true;
      try { const exe = await personalExe(files); if (exe) downloadBlob(exeName(), exe); else toast('Не удалось скачать KOMPAS Build — проверьте соединение'); } finally { kb.disabled = false; }
    });
  }

  /* альбом PDF: те же листы, что в предпросмотре (с учётом снятых отметок), каждый в своём формате; jsPDF подгружается по требованию */
  function loadScript(src) { return new Promise((res, rej) => { if (window.jspdf) return res(); const el = document.createElement('script'); el.src = src; el.onload = res; el.onerror = () => rej(new Error('не загрузился ' + src)); document.head.appendChild(el); }); }
  async function makeAlbum(btn) {
    const K = window.KOMPAS; if (!K || !window.DRWPDF) return;
    btn.disabled = true; const label = btn.innerHTML; btn.textContent = 'Готовлю PDF…';
    try {
      await loadScript('vendor/jspdf.umd.min.js');
      const off = K.offSet(S.T);
      let list = K.sheets(S.R, S.P, S.T).list.filter(d => !off.has('s:' + d.id)).concat(K.specSheets(S.R, S.P, S.T));
      list = K.albumOrder(list);
      await new Promise(r => setTimeout(r, 30));
      const code = (S.T.code || codeDefault());
      const doc = DRWPDF.album(list, d => K.sheetPrims(d, S.T), { title: code + ' — чертежи и спецификации' });
      downloadBlob(`${code.replace(/\s+/g, '_')}_альбом.pdf`, doc.output('blob'));
      toast(`Альбом: ${list.length} листов`);
    } catch (e) { console.error(e); toast('Не удалось собрать PDF: ' + e.message); }
    finally { btn.disabled = false; btn.innerHTML = label; }
  }
  /* лист чертежа → PNG (белый фон, ширина wpx пикселей) */
  function sheetPng(svgStr, wpx) {
    return new Promise(res => {
      const m = svgStr.match(/viewBox="([\d.\-]+) ([\d.\-]+) ([\d.]+) ([\d.]+)"/);
      const vw = m ? +m[3] : 420, vh = m ? +m[4] : 297, W = wpx || 4000, H = Math.round(W * vh / vw);
      const img = new Image();
      img.onload = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, W, H); g.drawImage(img, 0, 0, W, H); c.toBlob(b => res(b), 'image/png'); };
      img.onerror = () => res(null);
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(window.DRWCORE && DRWCORE.embedFont ? DRWCORE.embedFont(svgStr) : svgStr);
    });
  }

  /* ---------- рисунки в PNG для Word ---------- */
  function svgPng(svgStr, scale) {
    return new Promise((res) => {
      if (!svgStr) return res(null);
      const m = svgStr.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/); const w = +m[1], h = +m[2];
      const s = svgStr.replace(/(<svg[^>]*>)/, '$1' + FG.EXPORT_STYLE).replace(/ data-tip="[^"]*"/g, '');
      const img = new Image(), k = scale || 3;
      img.onload = () => { const c = document.createElement('canvas'); c.width = w * k; c.height = h * k; const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height); res({ data: c.toDataURL('image/png').split(',')[1], w, h }); };
      img.onerror = () => res(null);
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s);
    });
  }
  function watermark(im, lines) {
    return new Promise((res) => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
        const g = c.getContext('2d'); g.drawImage(img, 0, 0);
        const W = c.width, H = c.height, u = W / 1400;
        g.fillStyle = 'rgba(255,255,255,0.45)'; g.fillRect(0, 0, W, H);
        const Lc = 40 * u, m = 12 * u;
        g.strokeStyle = '#0B6E62'; g.lineWidth = 4 * u; g.lineCap = 'round';
        [[m, m, 1, 1], [W - m, m, -1, 1], [m, H - m, 1, -1], [W - m, H - m, -1, -1]].forEach(([x, y, sx, sy]) => { g.beginPath(); g.moveTo(x, y + sy * Lc); g.lineTo(x, y); g.lineTo(x + sx * Lc, y); g.stroke(); });
        const f1 = 30 * u, f2 = 21 * u, lh2 = f2 * 1.35, pad = 24 * u, gap = 10 * u, ic = 40 * u;
        const sans = '"Segoe UI", "Helvetica Neue", Arial, sans-serif';
        const maxCard = W - 80 * u, maxText = maxCard - ic - pad * 2.8;
        g.font = `400 ${f2}px ${sans}`;
        const wrap = [];
        for (const para of lines.slice(1)) { let cur = ''; for (const word of String(para).split(' ')) { const t = cur ? cur + ' ' + word : word; if (g.measureText(t).width > maxText && cur) { wrap.push(cur); cur = word; } else cur = t; } if (cur) wrap.push(cur); }
        const w2 = Math.max(0, ...wrap.map(l => g.measureText(l).width));
        g.font = `600 ${f1}px ${sans}`; const w1 = g.measureText(lines[0]).width;
        const cw = Math.min(maxCard, Math.max(w1, w2) + ic + pad * 2.8), ch = pad * 2 + f1 + gap + wrap.length * lh2;
        const x0 = (W - cw) / 2, y0 = Math.max(8 * u, (H - ch) / 2), r = 14 * u;
        g.save(); g.shadowColor = 'rgba(15,30,50,0.25)'; g.shadowBlur = 24 * u; g.shadowOffsetY = 6 * u;
        g.fillStyle = 'rgba(255,255,255,0.97)';
        g.beginPath(); g.moveTo(x0 + r, y0); g.arcTo(x0 + cw, y0, x0 + cw, y0 + ch, r); g.arcTo(x0 + cw, y0 + ch, x0, y0 + ch, r); g.arcTo(x0, y0 + ch, x0, y0, r); g.arcTo(x0, y0, x0 + cw, y0, r); g.closePath(); g.fill(); g.restore();
        g.strokeStyle = 'rgba(11,110,98,0.3)'; g.lineWidth = 1.5 * u; g.stroke();
        const ix = x0 + pad, iy = y0 + pad;
        g.fillStyle = '#0B6E62'; g.beginPath(); g.arc(ix + ic / 2, iy + ic / 2, ic / 2, 0, Math.PI * 2); g.fill();
        g.strokeStyle = '#fff'; g.lineWidth = 3 * u; g.lineJoin = 'round';
        g.beginPath(); g.moveTo(ix + ic * 0.28, iy + ic * 0.72); g.lineTo(ix + ic * 0.72, iy + ic * 0.28); g.moveTo(ix + ic * 0.5, iy + ic * 0.28); g.lineTo(ix + ic * 0.72, iy + ic * 0.28); g.lineTo(ix + ic * 0.72, iy + ic * 0.5); g.stroke();
        const tx = ix + ic + pad * 0.8;
        g.fillStyle = '#14202c'; g.font = `600 ${f1}px ${sans}`; g.fillText(lines[0], tx, y0 + pad + f1 * 0.85);
        g.fillStyle = '#4a5765'; g.font = `400 ${f2}px ${sans}`;
        wrap.forEach((l, k) => g.fillText(l, tx, y0 + pad + f1 + gap + k * lh2 + f2 * 0.9));
        res({ data: c.toDataURL('image/png').split(',')[1], w: im.w, h: im.h });
      };
      img.onerror = () => res(im);
      img.src = 'data:image/png;base64,' + im.data;
    });
  }
  function figSource(it) {
    const c = (S.T.code || codeDefault());
    switch (it.kind) {
      case 'scheme': return ['Замените схемой, выполненной в КОМПАС', 'Что вставить: кинематическая схема привода по ГОСТ 2.770 с позициями элементов.', 'Откуда: начертите в КОМПАС-График (фрагмент) по схеме из задания; или вставьте эту схему как есть.'];
      case 'load': return null;
      case 'layout': return ['Замените эскизной компоновкой из КОМПАС', 'Что вставить: компоновка редуктора (вид сверху, разрез по осям валов).', `Откуда: сборка ${c} 01.00.00 (макрос 20_assembly.py) — вид сверху с разрезом; или эскизы валов ${c} 01.00.0N.`];
      case 'beam': return null;
    }
    return null;
  }
  function omml(src, inline, size) {
    const h = katex.renderToString(texify(src), { displayMode: !inline, output: 'mathml', throwOnError: false, strict: 'ignore' });
    const a = h.indexOf('<math'), b = h.lastIndexOf('</math>');
    const mm = h.slice(a, b + 7).replace(/^<math[^>]*>/, '<math xmlns="http://www.w3.org/1998/Math/MathML">');
    return OMML.convert(mm, { size: size || 28 });
  }
  async function buildDocxBlob(part, prog) {
    const R = S.R, png = {};
    const figs = [];
    for (const s of R.sections) for (const it of s.items) if (it.k === 'fig') figs.push(it);
    for (let k = 0; k < figs.length; k++) {
      prog && prog('Рисунки ' + (k + 1) + '/' + figs.length);
      const it = figs[k];
      const im = await svgPng(figSvg(it), 3);
      const wm = S.T.watermark ? figSource(it) : null;
      png[it.id] = im && wm ? await watermark(im, wm) : im;
      await sleep(5);
    }
    prog && prog('Сборка документа…');
    const meas = document.createElement('div'); meas.style.cssText = 'position:absolute;left:-20000px;top:0;visibility:hidden;white-space:nowrap;font-size:18.67px';
    document.body.appendChild(meas);
    const measure = t => { meas.innerHTML = katex.renderToString(texify(t), { displayMode: true, throwOnError: false, strict: 'ignore' }); const k = meas.querySelector('.katex'); return k ? k.getBoundingClientRect().width : 0; };
    const ctx = { S, F, D, omml, png, measure, eqTex, codeDefault, kompasFiles: () => window.KOMPAS ? window.KOMPAS.files(S.R, S.P, S.T) : [] };
    try { return await REPORT.build(ctx, part, S.T); } finally { meas.remove(); }
  }
  const zipName = k => `OP_KP_${String(S.P.task).padStart(2, '0')}-${String(S.P.v).padStart(2, '0')}_${k}.zip`;
  function docxName(part) { const b = `PZ_${String(S.P.task).padStart(2, '0')}-${String(S.P.v).padStart(2, '0')}`; return part === 'all' ? b + '.docx' : b + '_' + part + '.docx'; }
  async function makeDocx(part, btn) {
    const old = btn.innerHTML; btn.disabled = true;
    try {
      const blob = await buildDocxBlob(part, t => { btn.innerHTML = '<span class="spinner"></span>' + t; });
      downloadBlob(docxName(part), blob); toast('Сформирован файл ' + docxName(part));
    } catch (e) { console.error(e); toast('Ошибка формирования записки: ' + e.message); }
    btn.disabled = false; btn.innerHTML = old;
  }
  window.__docxTest = part => buildDocxBlob(part || 'all').then(b => new Promise(r => { const f = new FileReader(); f.onload = () => r(f.result.split(',')[1]); f.readAsDataURL(b); }));
  async function zipAll(btn) {
    const old = btn.innerHTML; btn.disabled = true;
    try {
      const zip = new JSZip(), root = `OP_KP_${String(S.P.task).padStart(2, '0')}-${String(S.P.v).padStart(2, '0')}/`;
      const parts = ['all', 'kin', 'mat', 'gear', 'shaft', 'check', 'other'];
      for (const p of parts) { btn.innerHTML = '<span class="spinner"></span>Записка: ' + p; zip.file(root + 'Word/' + docxName(p), await buildDocxBlob(p)); }
      if (window.KOMPAS) for (const f of KOMPAS.files(S.R, S.P, S.T)) zip.file(root + 'KOMPAS/' + f.path, f.gen());
      for (const s of S.R.sections) for (const it of s.items) if (it.k === 'fig') zip.file(root + 'Рисунки/' + it.id + '.svg', figSvg(it).replace(/(<svg[^>]*>)/, '$1' + FG.EXPORT_STYLE));
      btn.innerHTML = '<span class="spinner"></span>Упаковка…';
      downloadBlob(zipName('all'), await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' }));
      toast('Архив сформирован');
    } catch (e) { console.error(e); toast('Ошибка: ' + e.message); }
    btn.disabled = false; btn.innerHTML = old;
  }

  /* ---------------- прочее ---------------- */
  function dlIcon() { return '<svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1v9m0 0L4.5 6.5M8 10l3.5-3.5M2 12v2.5h12V12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>'; }
  function copyText(t, msg) {
    const done = () => toast(msg || 'Скопировано в буфер обмена');
    try { navigator.clipboard.writeText(t).then(done, () => fallbackCopy(t, done)); } catch (e) { fallbackCopy(t, done); }
  }
  function fallbackCopy(t, done) {
    const ta = document.createElement('textarea'); ta.value = t; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.top = '-1000px';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); done(); } catch (e) { toast('Не удалось скопировать — выделите текст вручную'); }
    ta.remove();
  }
  function downloadBlob(name, blob) {
    if (window.SUITE && SUITE.save) return SUITE.save(name, blob);   // общий механизм (suite.js): сайт или артефакт claude.ai
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1500);
  }
  function downloadText(name, text) { downloadBlob(name, new Blob([text], { type: 'text/plain;charset=utf-8' })); toast('Файл ' + name + ' сохранён'); }
  let toastT = null;
  function toast(t) {
    let el = $('#toast'); if (!el) { el = document.createElement('div'); el.id = 'toast'; el.className = 'toast'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
    el.textContent = t; el.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { el.hidden = true; }, 2800);
  }
  function go(tab) { S.tab = tab; S.skipAuto = true; save(); setHash(); renderTab(); window.scrollTo({ top: 0 }); }
  function themeToggle() {
    const r = document.documentElement;
    const cur = r.getAttribute('data-theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    const nx = cur === 'dark' ? 'light' : 'dark';
    r.setAttribute('data-theme', nx); try { localStorage.setItem('suite-theme', nx); } catch (e) { /* ignore */ }
  }
  function init() {
    try { const th = localStorage.getItem('suite-theme'); if (th) document.documentElement.setAttribute('data-theme', th); } catch (e) { /* ignore */ }
    $('#rail').innerHTML = TABS.map(m => `<a href="#" data-tab="${m.id}"><span class="no" data-short="${m.short}">${m.no}</span><span class="t">${m.t}</span><span class="s">${m.s}</span></a>`).join('') + '<div class="rail-foot" id="rail-foot"></div>';
    $$('nav.rail a').forEach(a => a.onclick = e => { e.preventDefault(); go(a.dataset.tab); });
    $('#var-sel').onchange = e => setList(+e.target.value);
    $('#var-prev').onclick = () => setList(Math.max(1, Math.min(26, S.P.listNo) - 1));
    $('#var-next').onclick = () => setList(Math.min(26, S.P.listNo + 1));
    $('#share').onclick = share;
    $('#theme').onclick = themeToggle;
    const setTopH = () => document.documentElement.style.setProperty('--top-h', $('.top').offsetHeight + 'px');
    window.addEventListener('resize', setTopH); setTopH();
    load(); loadT();
    const au = lsGet(KEY.auto);
    if (S.shared) { S.skipAuto = true; recompute(); toast('Открыт расчёт по ссылке'); }
    else if (au && au.P && !location.hash) {
      S.P = fresh(13); S.T = Object.assign({}, T_DEF); S.tab = 'data';
      S.skipAuto = true; recompute(); askResume(au);
    } else { S.skipAuto = true; recompute(); }
  }
  function askResume(au) {
    const d = document.createElement('div');
    d.className = 'modal-back';
    d.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-labelledby="rs-t"><h2 id="rs-t">Продолжить с того места?</h2>
      <p>Найдено автосохранение:</p><div class="modal-card"><b>${au.T && au.T.student ? esc(au.T.student) : 'Последняя работа'}</b><span>${slotMeta(au)}</span></div>
      <p class="dhint">«Начать заново» сбросит параметры и настройки к значениям по умолчанию. Автосохранение при этом не удаляется — к нему можно вернуться в разделе «Сохранения», пока вы не начнёте вносить изменения.</p>
      <div class="modal-act"><button class="btn" id="rs-new">Начать заново</button><button class="btn primary" id="rs-go">Продолжить</button></div></div>`;
    document.body.appendChild(d);
    const close = () => d.remove();
    $('#rs-go', d).onclick = () => { S.P = normP(au.P); S.T = Object.assign({}, T_DEF, au.T || {}); if (au.tab) S.tab = au.tab; S.skipAuto = true; saveT(); S.skipAuto = true; close(); recompute(); };
    $('#rs-new', d).onclick = () => { S.skipAuto = true; saveT(); close(); toast('Начато заново'); };
    setTimeout(() => $('#rs-go', d).focus(), 30);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
