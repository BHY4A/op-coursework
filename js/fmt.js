/* fmt.js — форматирование чисел (десятичная запятая), построитель отчёта, интерполяция */
(function (root) {
  'use strict';
  let DIG = -1;   // −1 — «Авто» (4 значащие цифры, целая часть не округляется), иначе знаков после запятой
  function setDig(d) { DIG = d === undefined || d === null ? -1 : +d; }
  function fdec(x, N) {
    if (x === null || x === undefined || isNaN(x)) return '—';
    if (!isFinite(x)) return x > 0 ? '∞' : '−∞';
    if (x === 0) return '0';
    const ax = Math.abs(x);
    if (ax >= 1e6 || ax < 1e-4) return fsig(x, N + 1);
    let s = ax < Math.pow(10, 1 - N) ? x.toPrecision(2) : x.toFixed(N);
    s = parseFloat(s).toString();
    return s.replace('.', ',').replace('-', '−');
  }
  function fauto(x) {
    if (x === null || x === undefined || isNaN(x)) return '—';
    if (!isFinite(x)) return x > 0 ? '∞' : '−∞';
    if (x === 0) return '0';
    const ax = Math.abs(x);
    if (ax >= 1e7 || ax < 1e-4) return fsig(x, 4);
    const d = Math.floor(Math.log10(ax)) + 1;
    const s = d >= 4 ? String(Math.round(x)) : parseFloat(x.toPrecision(4)).toString();
    return s.replace('.', ',').replace('-', '−');
  }
  function fsig(x, sig) {
    if (x === null || x === undefined || isNaN(x)) return '—';
    if (!isFinite(x)) return x > 0 ? '∞' : '−∞';
    if (x === 0) return '0';
    const ax = Math.abs(x);
    if (ax >= 1e7 || ax < 1e-4) {
      let e = Math.floor(Math.log10(ax)); let m = x / Math.pow(10, e);
      let ms = parseFloat(m.toPrecision(sig)).toString();
      if (Math.abs(parseFloat(ms)) >= 10) { e++; ms = parseFloat((x / Math.pow(10, e)).toPrecision(sig)).toString(); }
      return ms.replace('.', ',').replace('-', '−') + '·10^' + e;
    }
    const d = Math.floor(Math.log10(ax)) + 1;
    const s = d >= sig ? String(Math.round(x)) : parseFloat(x.toPrecision(sig)).toString();
    return s.replace('.', ',').replace('-', '−');
  }
  /* основной вывод: sig — «точное» число значащих цифр (для табличных/принятых величин sig = 0 → как есть) */
  function fnum(x, sig) {
    if (sig === 0) return fexact(x);
    if (sig) return fsig(x, sig);
    return DIG < 0 ? fauto(x) : fdec(x, DIG);
  }
  function fexact(x) {
    if (x === null || x === undefined || isNaN(x)) return '—';
    return String(+(+x).toPrecision(10)).replace('.', ',').replace('-', '−');
  }
  // для LaTeX
  function n(x, sig) {
    if (typeof x === 'number' && Math.abs(x) < 1e-9) x = 0;   // «пыль» плавающей точки
    const s = fnum(x, sig).replace('−', '-');
    if (s.indexOf('·10^') >= 0) { const [m, e] = s.split('·10^'); return m.replace(',', '{,}') + '\\cdot 10^{' + e + '}'; }
    return s.replace(',', '{,}');
  }
  const sq = (x, sig) => { const t = n(x, sig); return (/^-|\\cdot/.test(t)) ? '(' + t + ')' : t; };  // основание степени
  const nx = x => n(x, 0);                        // точное (табличное) значение
  const deg = x => { const d = Math.floor(x + 1e-9); let m = Math.round((x - d) * 60); let dd = d; if (m === 60) { dd++; m = 0; } return dd + '^{\\circ}' + String(m).padStart(2, '0') + '\''; };
  const degTxt = x => { const d = Math.floor(x + 1e-9); let m = Math.round((x - d) * 60); let dd = d; if (m === 60) { dd++; m = 0; } return dd + '°' + String(m).padStart(2, '0') + '′'; };

  /* ---------- интерполяция и ряды ---------- */
  function interp(xs, ys, x, opt) {
    opt = opt || {};
    const pts = []; for (let i = 0; i < xs.length; i++) if (ys[i] !== null && ys[i] !== undefined) pts.push([xs[i], ys[i]]);
    if (!pts.length) return NaN;
    if (x <= pts[0][0]) return opt.extrap ? lin(pts[0], pts[1], x) : pts[0][1];
    if (x >= pts[pts.length - 1][0]) return opt.extrap ? lin(pts[pts.length - 2], pts[pts.length - 1], x) : pts[pts.length - 1][1];
    for (let i = 1; i < pts.length; i++) if (x <= pts[i][0]) return lin(pts[i - 1], pts[i], x);
    return NaN;
  }
  function lin(a, b, x) { return a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0]); }
  function inRange(xs, ys, x) { const v = []; for (let i = 0; i < xs.length; i++) if (ys[i] !== null && ys[i] !== undefined) v.push(xs[i]); return v.length && x >= v[0] - 1e-9 && x <= v[v.length - 1] + 1e-9; }
  const up = (v, list) => { for (const x of list) if (x >= v - 1e-9) return x; return list[list.length - 1]; };
  const down = (v, list) => { let r = list[0]; for (const x of list) if (x <= v + 1e-9) r = x; return r; };
  const near = (v, list) => list.reduce((b, x) => Math.abs(x - v) < Math.abs(b - v) - 1e-12 ? x : b, list[0]);
  const nearLog = (v, list) => list.reduce((b, x) => Math.abs(Math.log(x / v)) < Math.abs(Math.log(b / v)) - 1e-12 ? x : b, list[0]);
  const r1 = x => Math.round(x * 10) / 10, r2 = x => Math.round(x * 100) / 100, ri = x => Math.round(x);
  const ceilTo = (x, s) => Math.ceil(x / s - 1e-9) * s;
  const D2R = Math.PI / 180;

  /* ---------- построитель отчёта ----------
   * h(no, t, lvl) — заголовок; p(html) — абзац; eq(...) — карточка расчёта; check; table; fig; note (только сайт) */
  function Report(tab) { this.items = []; this.tab = tab; }
  const RP = Report.prototype;
  RP.h = function (no, t, lvl) { this.items.push({ k: 'h', no, t, lvl: lvl || 2 }); return this; };
  RP.p = function (t, o) { this.items.push(Object.assign({ k: 'p', t }, o || {})); return this; };
  RP.note = function (t, kind) { this.items.push({ k: 'note', t, kind: kind || 'info' }); return this; };
  /* eq: o = { lhs, f, s, v, u, sig, d (что и зачем), raw (готовая строка вместо числа), cmp ('\\le', '\\ge', '\\approx'), lead (текст перед формулой в записке) } */
  RP.eq = function (o) { this.items.push(Object.assign({ k: 'eq' }, o)); return this; };
  RP.tex = function (t, o) { this.items.push(Object.assign({ k: 'tex', t }, o || {})); return this; };
  RP.check = function (tex, ok, t, o) { this.items.push(Object.assign({ k: 'check', tex, ok, t }, o || {})); return this; };
  RP.table = function (cap, head, rows, o) { this.items.push(Object.assign({ k: 'table', cap, head, rows }, o || {})); return this; };
  RP.fig = function (id, title, lead, o) { this.items.push(Object.assign({ k: 'fig', id, title, lead }, o || {})); return this; };
  RP.list = function (lines, lead) { this.items.push({ k: 'list', lines, lead }); return this; };
  RP.web = function () { this.items[this.items.length - 1].web = true; return this; };

  root.F = { setDig, fnum, fsig, fauto, fdec, fexact, n, nx, sq, deg, degTxt, interp, inRange, up, down, near, nearLog, r1, r2, ri, ceilTo, D2R, Report,
    get dig() { return DIG; } };
})(typeof window !== 'undefined' ? window : globalThis);
