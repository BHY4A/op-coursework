/* drw_core.js — движок чертежа: лист (мм, ось Y вверх), примитивы, оформление по ЕСКД, вывод в SVG.
   Примитивы потом без изменений передаются макросу КОМПАС (отрезок, окружность, дуга, текст). */
(function (root) {
  'use strict';
  const D2R = Math.PI / 180;
  const FONT_K = 1122 / 714;   // кегль шрифта ГОСТ 2.304 тип А по высоте прописной h (cap height 714 из 1122 ед.)
  const FMT = { A4: [210, 297], A3: [420, 297], A2: [594, 420], A1: [841, 594], A0: [1189, 841],
    // дополнительные форматы ГОСТ 2.301 (кратность короткой стороны) — для длинных деталей без уменьшения масштаба
    A3x3: [891, 420], A3x4: [1189, 420], A4x3: [630, 297], A4x4: [841, 297] };
  /* обозначение формата для надписей: А3×3 */
  const fmtName = f => String(f).replace('A', 'А').replace('x', '×');
  /* стандартные масштабы ГОСТ 2.302-68 — от крупного к мелкому; на лист — один, наибольший, при котором всё помещается */
  const SCALE_STD = [[4, '4:1'], [2.5, '2,5:1'], [2, '2:1'], [1, '1:1'], [0.5, '1:2'], [0.4, '1:2,5'], [0.25, '1:4'], [0.2, '1:5'], [0.1, '1:10'], [1 / 15, '1:15'], [0.05, '1:20'], [0.04, '1:25'], [0.025, '1:40'], [0.02, '1:50']];
  const scales = kMax => SCALE_STD.filter(s => s[0] <= Math.min(kMax, OPTS.kMax || Infinity) + 1e-9);   // OPTS.kMax — предел при подборе (fitSheet)
  const scaleText = k => (SCALE_STD.find(s => Math.abs(s[0] - k) < 1e-9) || [k, String(k)])[1];
  const r3 = x => Math.round(x * 1000) / 1000;
  const fmtNum = (x, dig) => { if (x === undefined || x === null || isNaN(x)) return ''; const k = Math.pow(10, dig === undefined ? 2 : dig); return String(Math.round(x * k) / k).replace('.', ','); };

  /* ширина текста шрифтом «ГОСТ тип А» (оценка, мм) */
  /* верхние индексы «⁻¹» и т. п.: в шрифте ГОСТ (и в КОМПАС) таких знаков нет — рисуются отдельной надписью 0,7h над строкой */
  const SUP = { '⁻': '-', '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9' };
  const SUP_RE = /[⁻⁰¹⁴-⁹]/;
  let TGSEQ = 0;
  function cw(c) {
    if (SUP[c]) return 0.7 * cw(SUP[c]);
    if (c === ' ') return 0.38;
    if (/[.,:;'!|]/.test(c)) return 0.28;
    if (/[()\[\]\-−]/.test(c)) return 0.36;
    if (/[0-9]/.test(c)) return 0.52;
    if (/[A-ZА-ЯЁ⌀×±°√]/.test(c)) return /[ШЩЖМЮФШWM]/.test(c) ? 0.78 : 0.6;
    if (/[шщжмюфыwm]/.test(c)) return 0.66;
    return 0.5;
  }
  /* ширина текста шрифтом «ГОСТ тип А» (оценка, мм) */
  function tw(s, h) {
    let w = 0;
    for (const c of String(s)) w += cw(c);
    // поправка по замерам КОМПАС (ksGetTextLengthFromReference): шрифт ГОСТ курсивом шире оценки в среднем на 25 %
    return w * h * 1.17 + 0.22 * h;
  }

  /* -------------------------------------------------------------- лист */
  function Sheet(fmt, landscape) {
    const [a, b] = FMT[fmt];
    this.fmt = fmt;
    this.landscape = fmt === 'A4' ? false : !!landscape;
    this.W = this.landscape ? Math.max(a, b) : Math.min(a, b);
    this.H = this.landscape ? Math.min(a, b) : Math.max(a, b);
    this.p = [];
    Object.defineProperty(this.p, '_sh', { value: this });   // обратная ссылка: placeGroup переставляет обозначения листа-черновика перед копированием
    this.frame = { x1: 20, y1: 5, x2: this.W - 5, y2: this.H - 5 };
    this.stamp = { x1: this.W - 5 - 185, y1: 5, x2: this.W - 5, y2: 60 };
    this.hatchN = 0;
  }
  const S = Sheet.prototype;
  S.line = function (x1, y1, x2, y2, s) { if (Math.hypot(x2 - x1, y2 - y1) > 1e-6) this.p.push({ t: 'L', a: [r3(x1), r3(y1), r3(x2), r3(y2)], s: s || 1 }); return this; };
  S.poly = function (pts, s, closed) { const n = pts.length; for (let i = 0; i < n - (closed === false ? 1 : 0); i++) { const a = pts[i], b = pts[(i + 1) % n]; this.line(a[0], a[1], b[0], b[1], s); } return this; };
  S.rect = function (x1, y1, x2, y2, s) { return this.poly([[x1, y1], [x2, y1], [x2, y2], [x1, y2]], s); };
  S.circle = function (x, y, r, s) { if (r > 0.05) this.p.push({ t: 'C', a: [r3(x), r3(y), r3(r)], s: s || 1 }); return this; };
  /* дуга против часовой стрелки от a1 до a2 (градусы) */
  S.arc = function (x, y, r, a1, a2, s) { if (r > 0.05) this.p.push({ t: 'A', a: [r3(x), r3(y), r3(r), r3(a1), r3(a2)], s: s || 1 }); return this; };
  /* текст: (x, y) — точка привязки; anchor: 'l'|'c'|'r' по ширине и 'b'|'m'|'t' по высоте; ang — градусы */
  /* разметка отклонений: «5^+0,2» — верхнее, «27_−0,2» — нижнее, «⌀40^+0,018_+0,002» — оба */
  function devParts(s) {
    const m = /^([^\^_]*)(?:\^([^_]*))?(?:_(.*))?$/.exec(s);
    if (!m || (m[2] === undefined && m[3] === undefined)) return null;
    return { base: m[1], up: m[2], lo: m[3] };
  }
  function twx(s, h) { const d = devParts(String(s)); if (!d) return tw(s, h); return tw(d.base, h) + Math.max(tw(d.up || '', h * 0.7), tw(d.lo || '', h * 0.7)) + 0.4; }
  S.text = function (x, y, str, o) {
    o = o || {};
    const h = o.h || 3.5, ang = o.ang || 0, s = String(str);
    if (!s) return this;
    const dv = devParts(s);
    if (dv) {
      const w = twx(s, h), an = o.anchor || 'lb';
      const fx = an.includes('c') ? -w / 2 : an.includes('r') ? -w : 0;
      const fy = an.includes('m') ? -h / 2 : an.includes('t') ? -h : 0;
      const c = Math.cos(ang * D2R), sn = Math.sin(ang * D2R);
      const P = (u, v) => [x + (fx + u) * c - (fy + v) * sn, y + (fx + u) * sn + (fy + v) * c];
      const wb = tw(dv.base, h);
      let q = P(0, 0);
      // для КОМПАС — один текст с компонентами «верхнее/нижнее отклонение» (отдельные надписи ниже — запасной вариант)
      const tg = ++TGSEQ, i0 = this.p.length;
      const runs = [[dv.base, 's']].concat(dv.up !== undefined ? [[dv.up, 'up']] : []).concat(dv.lo !== undefined ? [[dv.lo, 'lo']] : []).concat([['', 'end']]);
      this.p.push({ t: 'D', k: 'T', a: [r3(q[0]), r3(q[1]), h, ang], s, runs, tg });
      const done = () => { for (let i = i0 + 1; i < this.p.length; i++) if (this.p[i].t === 'T') this.p[i].tg = tg; return this; };
      this.text(q[0], q[1], dv.base, { h, ang });
      if (dv.up !== undefined && dv.lo !== undefined) { q = P(wb + 0.4, h * 0.55); this.text(q[0], q[1], dv.up, { h: h * 0.7, ang }); q = P(wb + 0.4, -h * 0.15); this.text(q[0], q[1], dv.lo, { h: h * 0.7, ang }); }
      else if (dv.up !== undefined) { q = P(wb + 0.4, h * 0.45); this.text(q[0], q[1], dv.up, { h: h * 0.7, ang }); }
      else { q = P(wb + 0.4, -h * 0.1); this.text(q[0], q[1], dv.lo, { h: h * 0.7, ang }); }
      return done();
    }
    if (SUP_RE.test(s)) {
      // строка с верхним индексом: обычные части и индекс — отдельными надписями (как предельные отклонения)
      const runs = []; let cur = '', sup = false;
      for (const ch of s) { const isS = !!SUP[ch]; if (isS !== sup && cur) { runs.push([cur, sup]); cur = ''; } sup = isS; cur += isS ? SUP[ch] : ch; }
      if (cur) runs.push([cur, sup]);
      const w = tw(s, h), an = o.anchor || 'lb';
      const fx = an.includes('c') ? -w / 2 : an.includes('r') ? -w : 0;
      const fy = an.includes('m') ? -h / 2 : an.includes('t') ? -h : 0;
      const c = Math.cos(ang * D2R), sn = Math.sin(ang * D2R);
      const P = (u, v) => [x + (fx + u) * c - (fy + v) * sn, y + (fx + u) * sn + (fy + v) * c];
      let u = 0;
      // для КОМПАС — один текст: индекс — компонентом «верхнее отклонение» (так в КОМПАС пишут степени: мин⁻¹, м³)
      const tg = ++TGSEQ, i0 = this.p.length, q0 = P(0, 0), kr = [];
      runs.forEach(([t, isS]) => { if (isS) kr.push([t, 'up'], ['', 'end']); else kr.push([t, 's']); });
      this.p.push({ t: 'D', k: 'T', a: [r3(q0[0]), r3(q0[1]), h, ang], s, runs: kr, tg });
      runs.forEach(([t, isS]) => {
        const hh = isS ? h * 0.7 : h, q = P(u + (isS ? 0.4 : 0), isS ? h * 0.5 : 0);
        this.text(q[0], q[1], t, { h: hh, ang });
        let ww = 0; for (const ch of t) ww += cw(ch); u += ww * hh * 1.17 + (isS ? 0.6 : 0);
      });
      for (let i = i0 + 1; i < this.p.length; i++) if (this.p[i].t === 'T') this.p[i].tg = tg;
      return this;
    }
    const w = tw(s, h), an = o.anchor || 'lb';
    const fx = an.includes('c') ? -w / 2 : an.includes('r') ? -w : 0;
    const fy = an.includes('m') ? -h / 2 : an.includes('t') ? -h : 0;
    const c = Math.cos(ang * D2R), sn = Math.sin(ang * D2R);
    const bx = x + fx * c - fy * sn, by = y + fx * sn + fy * c;
    this.p.push(o.pos ? { t: 'T', a: [r3(bx), r3(by), h, ang], s, w: r3(w), pos: true } : { t: 'T', a: [r3(bx), r3(by), h, ang], s, w: r3(w) });
    return this;
  };
  S.tw = twx;
  /* габарит примитивов с индекса from */
  S.bbox = function (from, to) {
    let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
    const add = (x, y) => { if (x < x1) x1 = x; if (x > x2) x2 = x; if (y < y1) y1 = y; if (y > y2) y2 = y; };
    for (const q of this.p.slice(from || 0, to === undefined ? this.p.length : to)) {
      if (q.t === 'L') { add(q.a[0], q.a[1]); add(q.a[2], q.a[3]); }
      else if (q.t === 'C' || q.t === 'A') { add(q.a[0] - q.a[2], q.a[1] - q.a[2]); add(q.a[0] + q.a[2], q.a[1] + q.a[2]); }
      else if (q.t === 'H') { for (let i = 0; i < q.l.length; i += 2) add(q.l[i], q.l[i + 1]); }
      else if (q.t === 'T') { const c = Math.cos(q.a[3] * D2R), s = Math.sin(q.a[3] * D2R); add(q.a[0], q.a[1]); add(q.a[0] + q.w * c, q.a[1] + q.w * s); add(q.a[0] - q.a[2] * s + q.w * c, q.a[1] + q.a[2] * c + q.w * s); add(q.a[0] - q.a[2] * s, q.a[1] + q.a[2] * c); }
    }
    return { x1, y1, x2, y2 };
  };
  /* габарит изображения без надписей и обозначений — для габаритных размеров */
  S.geoBox = function () {
    let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
    const add = (x, y) => { if (x < x1) x1 = x; if (x > x2) x2 = x; if (y < y1) y1 = y; if (y > y2) y2 = y; };
    for (const q of this.p) {
      if (q.g !== undefined) continue;
      if (q.t === 'L' && q.s !== 3) { add(q.a[0], q.a[1]); add(q.a[2], q.a[3]); }
      else if ((q.t === 'C' || q.t === 'A') && q.s !== 3) { add(q.a[0] - q.a[2], q.a[1] - q.a[2]); add(q.a[0] + q.a[2], q.a[1] + q.a[2]); }
    }
    return { x1, y1, x2, y2 };
  };
  /* ---- проверка наложений: надписи не должны пересекать другие надписи и линии */
  function textRect(q, pad) {
    pad = pad === undefined ? 0.25 : pad;
    const [x, y, h, ang] = q.a, c = Math.cos(ang * D2R), s = Math.sin(ang * D2R), w = q.w;
    const xs = [x, x + w * c, x - h * s + w * c, x - h * s], ys = [y, y + w * s, y + h * c + w * s, y + h * c];
    return { x1: Math.min(...xs) + pad, y1: Math.min(...ys) + pad, x2: Math.max(...xs) - pad, y2: Math.max(...ys) - pad };
  }
  function segHitsRect(x1, y1, x2, y2, r) {
    if (Math.max(x1, x2) < r.x1 || Math.min(x1, x2) > r.x2 || Math.max(y1, y2) < r.y1 || Math.min(y1, y2) > r.y2) return false;
    // Лианг–Барски
    let t0 = 0, t1 = 1; const dx = x2 - x1, dy = y2 - y1;
    const P = [-dx, dx, -dy, dy], Q = [x1 - r.x1, r.x2 - x1, y1 - r.y1, r.y2 - y1];
    for (let i = 0; i < 4; i++) { if (Math.abs(P[i]) < 1e-12) { if (Q[i] < 0) return false; } else { const t = Q[i] / P[i]; if (P[i] < 0) { if (t > t1) return false; if (t > t0) t0 = t; } else { if (t < t0) return false; if (t < t1) t1 = t; } } }
    return t0 <= t1;
  }
  function rectsHit(a, b) { return a.x1 < b.x2 && a.x2 > b.x1 && a.y1 < b.y2 && a.y2 > b.y1; }
  /* отрезки пересекаются во внутренних точках обоих (касание концами и наложение вдоль не считаются) */
  function segCross(p, q) { return !!segCrossPt(p, q); }
  /* точка на отрезке (в пределах tol) */
  function onSeg(pt, a, tol) { const dx = a[2] - a[0], dy = a[3] - a[1], L2 = dx * dx + dy * dy; let t = L2 ? ((pt[0] - a[0]) * dx + (pt[1] - a[1]) * dy) / L2 : 0; t = Math.max(0, Math.min(1, t)); return Math.hypot(pt[0] - a[0] - t * dx, pt[1] - a[1] - t * dy) <= tol; }
  /* пересечение дуги обозначения q (t:'A') с отрезком s во внутренних точках обоих */
  function arcSegCross(q, s) {
    const [cx, cy, R, a1, a2] = q.a, [x1, y1, x2, y2] = s, dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy);
    const fx = x1 - cx, fy = y1 - cy, A = dx * dx + dy * dy, B = 2 * (fx * dx + fy * dy), C = fx * fx + fy * fy - R * R, D = B * B - 4 * A * C;
    if (D <= 0 || !A) return false;
    let e2 = a2; while (e2 <= a1) e2 += 360;
    const da = 0.25 / R / D2R;
    for (const t of [(-B - Math.sqrt(D)) / (2 * A), (-B + Math.sqrt(D)) / (2 * A)]) {
      if (t * L < 0.25 || (1 - t) * L < 0.25) continue;
      let ang = Math.atan2(y1 + t * dy - cy, x1 + t * dx - cx) / D2R; while (ang < a1) ang += 360;
      if (ang > a1 + da && ang < e2 - da) return true;
    }
    return false;
  }
  function segCrossPt(p, q) {
    const [x1, y1, x2, y2] = p, [x3, y3, x4, y4] = q;
    if (Math.max(x1, x2) < Math.min(x3, x4) || Math.max(x3, x4) < Math.min(x1, x2) || Math.max(y1, y2) < Math.min(y3, y4) || Math.max(y3, y4) < Math.min(y1, y2)) return false;
    const d = (x2 - x1) * (y4 - y3) - (y2 - y1) * (x4 - x3); if (Math.abs(d) < 1e-9) return false;
    const t = ((x3 - x1) * (y4 - y3) - (y3 - y1) * (x4 - x3)) / d, u = ((x3 - x1) * (y2 - y1) - (y3 - y1) * (x2 - x1)) / d;
    const ea = 0.25 / (Math.hypot(x2 - x1, y2 - y1) || 1), eb = 0.25 / (Math.hypot(x4 - x3, y4 - y3) || 1);
    return t > ea && t < 1 - ea && u > eb && u < 1 - eb ? [x1 + t * (x2 - x1), y1 + t * (y2 - y1)] : null;
  }
  function collOv(a, G) {
    const len = Math.hypot(a[2] - a[0], a[3] - a[1]); if (len < 1) return 0;
    const ux = (a[2] - a[0]) / len, uy = (a[3] - a[1]) / len;
    let m = 0;
    for (const g of G) {
      const b = g.a, gl = Math.hypot(b[2] - b[0], b[3] - b[1]); if (gl < 1) continue;
      if (Math.abs(ux * (b[3] - b[1]) - uy * (b[2] - b[0])) / gl > 0.01) continue;
      if (Math.abs((b[0] - a[0]) * uy - (b[1] - a[1]) * ux) > 0.3) continue;
      const t1 = (b[0] - a[0]) * ux + (b[1] - a[1]) * uy, t2 = (b[2] - a[0]) * ux + (b[3] - a[1]) * uy;
      m = Math.max(m, Math.min(len, Math.max(t1, t2)) - Math.max(0, Math.min(t1, t2)));
    }
    return m;
  }
  /* габарит примитива (для отбора кандидатов на наложение) */
  function pbox(q) {
    if (q._b !== undefined && q._ba === q.a) return q._b;
    const b = pbox0(q);
    Object.defineProperty(q, '_b', { value: b, writable: true, configurable: true }); Object.defineProperty(q, '_ba', { value: q.a, writable: true, configurable: true });
    return b;
  }
  function pbox0(q) {
    if (q.t === 'L') return [Math.min(q.a[0], q.a[2]), Math.min(q.a[1], q.a[3]), Math.max(q.a[0], q.a[2]), Math.max(q.a[1], q.a[3])];
    if (q.t === 'T') { const r = textRect(q, 0); return [r.x1, r.y1, r.x2, r.y2]; }
    if (q.t === 'C' || q.t === 'A') return [q.a[0] - q.a[2], q.a[1] - q.a[2], q.a[0] + q.a[2], q.a[1] + q.a[2]];
    return null;
  }
  /* сетка габаритов для большого неизменяемого набора примитивов (один и тот же массив «старых» примитивов
     проверяется для всех вариантов обозначения): отбор кандидатов не перебирает весь лист */
  const GRIDS = new WeakMap(), GCS = 16;
  function gridPick(arr, x1, y1, x2, y2) {
    let g = GRIDS.get(arr);
    if (!g || g.n !== arr.length) {
      // сетка окупается со второго запроса к тому же набору
      if (!g || g.n !== arr.length || !g.once) { GRIDS.set(arr, { n: arr.length, once: true }); return arr.filter(q => { const b = pbox(q); return !b || !(b[2] < x1 || b[0] > x2 || b[3] < y1 || b[1] > y2); }); }
    }
    if (!g.cells) {
      g = { n: arr.length, cells: new Map(), free: [] };
      for (let i = 0; i < arr.length; i++) {
        const b = pbox(arr[i]); if (!b) { g.free.push(i); continue; }
        const cx1 = Math.floor(b[0] / GCS), cx2 = Math.floor(b[2] / GCS), cy1 = Math.floor(b[1] / GCS), cy2 = Math.floor(b[3] / GCS);
        for (let cx = cx1; cx <= cx2; cx++) for (let cy = cy1; cy <= cy2; cy++) { const k = cx * 65536 + cy; let c = g.cells.get(k); if (!c) g.cells.set(k, c = []); c.push(i); }
      }
      GRIDS.set(arr, g);
    }
    const seen = new Set(g.free);
    const cx1 = Math.floor(x1 / GCS), cx2 = Math.floor(x2 / GCS), cy1 = Math.floor(y1 / GCS), cy2 = Math.floor(y2 / GCS);
    for (let cx = cx1; cx <= cx2; cx++) for (let cy = cy1; cy <= cy2; cy++) { const c = g.cells.get(cx * 65536 + cy); if (c) for (const i of c) seen.add(i); }
    const out = [];
    for (const i of [...seen].sort((a, b) => a - b)) { const q = arr[i], b = pbox(q); if (!b || !(b[2] < x1 || b[0] > x2 || b[3] < y1 || b[1] > y2)) out.push(q); }
    return out;
  }
  S.conflicts = function (added, old, stopAt1, withAxes) {
    const f = this.frame;
    let n = 0;
    // наложения возможны только в пределах габарита добавленного обозначения — остальной лист не проверяется (результат тот же, быстрее)
    { let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
      for (const q of added) { const b = pbox(q); if (!b) continue; if (b[0] < x1) x1 = b[0]; if (b[1] < y1) y1 = b[1]; if (b[2] > x2) x2 = b[2]; if (b[3] > y2) y2 = b[3]; }
      if (x1 !== Infinity) { x1 -= 1; y1 -= 1; x2 += 1; y2 += 1; old = old.length > 300 ? gridPick(old, x1, y1, x2, y2) : old.filter(q => { const b = pbox(q); return !b || !(b[2] < x1 || b[0] > x2 || b[3] < y1 || b[1] > y2); }); } }
    const boxR = (q, pad) => ({ x1: q.a[0] + pad, y1: q.a[1] + pad, x2: q.a[2] - pad, y2: q.a[3] - pad });
    const T = added.filter(q => q.t === 'T').map(q => textRect(q, -0.7)).concat(added.filter(q => q.t === 'B').map(q => boxR(q, 0.3)));
    const OT = old.filter(q => q.t === 'T').map(q => textRect(q, 0)).concat(old.filter(q => q.t === 'B').map(q => boxR(q, 0)));
    const OL = old.filter(q => q.t === 'L' && (q.s !== 3 || withAxes));
    const OC = old.filter(q => (q.t === 'C' || q.t === 'A') && q.a[2] > 1);
    for (const r of T) {
      if (r.x1 < f.x1 || r.x2 > f.x2 || r.y1 < f.y1 || r.y2 > f.y2) n += 3;
      if ((this.occ || []).some(o => rectsHit(r, o))) n += 3;
      for (const o of OT) if (rectsHit(r, o)) n += 2;
      for (const q of OL) if (segHitsRect(q.a[0], q.a[1], q.a[2], q.a[3], r)) n++;
      for (const q of OC) { const d = Math.hypot(Math.max(r.x1 - q.a[0], 0, q.a[0] - r.x2), Math.max(r.y1 - q.a[1], 0, q.a[1] - r.y2)); const D = Math.max(Math.hypot(r.x1 - q.a[0], r.y1 - q.a[1]), Math.hypot(r.x2 - q.a[0], r.y1 - q.a[1]), Math.hypot(r.x1 - q.a[0], r.y2 - q.a[1]), Math.hypot(r.x2 - q.a[0], r.y2 - q.a[1])); if (d <= q.a[2] && D >= q.a[2]) n++; }
      if (stopAt1 && n) return n;
    }
    for (const q of added) if (q.t === 'L' && q.s !== 3) { for (const r of OT) if (segHitsRect(q.a[0], q.a[1], q.a[2], q.a[3], r)) n++; if (stopAt1 && n) return n; }
    // дуги добавленного обозначения (угловой размер) — по надписям и рамкам
    for (const q of added) if ((q.t === 'A' || q.t === 'C') && q.s !== 3 && OT.length) {
      const a1 = q.t === 'A' ? q.a[3] : 0; let a2 = q.t === 'A' ? q.a[4] : 360; while (a2 <= a1) a2 += 360;
      const m = Math.max(4, Math.ceil((a2 - a1) * D2R * q.a[2] / 0.5));
      for (const r of OT) for (let i = 0; i <= m; i++) { const t = (a1 + (a2 - a1) * i / m) * D2R, x = q.a[0] + q.a[2] * Math.cos(t), y = q.a[1] + q.a[2] * Math.sin(t); if (x > r.x1 && x < r.x2 && y > r.y1 && y < r.y2) { n++; break; } }
      if (stopAt1 && n) return n;
    }
    // линии обозначений не должны лежать на линиях изображения (ГОСТ 2.307)
    const GL = OL.filter(q => q.g === undefined);
    for (const q of added) if (q.t === 'L' && q.s !== 3 && collOv(q.a, GL) > 1.5) { n += 2; if (stopAt1) return n; }
    // размерные линии разных размеров не совпадают
    const DL = old.filter(q => q.t === 'L' && q.dl);
    if (DL.length) for (const q of added) if (q.t === 'L' && q.dl && collOv(q.a, DL) > 0.5) { n += 3; if (stopAt1) return n; }
    // линии разных обозначений не пересекаются: размерные и выносные (ГОСТ 2.307 п. 5.10), линии-выноски позиций (ГОСТ 2.109 п. 7.6)
    const AL = old.filter(q => q.t === 'L' && q.g !== undefined && q.s !== 3);
    if (AL.length) for (const q of added) {
      if (q.t !== 'L' || q.g === undefined || q.s === 3) continue;
      const qb = pbox(q);
      for (const b of AL) {
        const bb = pbox(b); if (bb[2] < qb[0] || bb[0] > qb[2] || bb[3] < qb[1] || bb[1] > qb[3]) continue;
        if (b.g === q.g || (q.og !== undefined && (q.og === b.g || q.og === b.og)) || (b.og !== undefined && b.og === q.g)) continue;
        if (q.ex && b.ex) continue;   // выносная с выносной — допускается (ГОСТ 2.307 запрещает пересекать размерные линии)
        if ((q.ex && b.pl) || (q.pl && b.ex)) continue;
        const pt = segCrossPt(q.a, b.a); if (!pt) continue;
        // общая выносная линия соседних размеров (цепочка) — не пересечение
        if (b.ex && added.some(e => e.ex && e.g === q.g && onSeg(pt, e.a, 0.3))) continue;
        if (q.ex && old.some(e => e.ex && e.g === b.g && onSeg(pt, e.a, 0.3))) continue;
        n += 2; if (stopAt1) return n;
      }
    }
    // дуги угловых размеров и линии других обозначений
    const sep = (q, b) => b.g === q.g || (q.og !== undefined && (q.og === b.g || q.og === b.og)) || (b.og !== undefined && b.og === q.g);
    const OA = old.filter(q => q.t === 'A' && q.g !== undefined && q.s !== 3);
    for (const q of added) {
      if (q.g === undefined || q.s === 3) continue;
      if (q.t === 'L') for (const c of OA) if (!sep(q, c) && arcSegCross(c, q.a)) { n += 2; if (stopAt1) return n; }
      if (q.t === 'A') for (const b of AL) if (!sep(q, b) && arcSegCross(q, b.a)) { n += 2; if (stopAt1) return n; }
    }
    return n;
  };
  /* попробовать варианты: первый без наложений; иначе — вариант с наименьшим числом наложений */
  S.attempt = function (fns, o) {
    o = o || {};
    let best = 0, bn = Infinity, res = -1;
    const top = !this._attDepth;
    this._attDepth = (this._attDepth || 0) + 1;
    try {
      let kept = false, oldA = null;   // лист до обозначения — один и тот же для всех вариантов
      for (let i = 0; i < fns.length; i++) {
        const i0 = this.p.length;
        fns[i]();
        const added = this.p.slice(i0);
        const n = this.conflicts(added, oldA || (oldA = this.p.slice(0, i0)));
        if (n === 0) { best = i; res = i; kept = true; if (top && fns.length > 1) (this._atts = this._atts || []).push({ fns, prims: added }); break; }   // пробный вариант подошёл — оставляем, не рисуем заново
        this.p.length = i0;
        if (n < bn) { bn = n; best = i; }
      }
      if (kept) return res;
      const i0 = this.p.length;
      fns[best]();
      // запомнить варианты — для перестановки после того, как на лист лягут все остальные обозначения (repair)
      if (top && fns.length > 1) (this._atts = this._atts || []).push({ fns, prims: this.p.slice(i0) });
    } finally { this._attDepth--; }
    return res;
  };
  /* перестановка обозначений: каждое обозначение, которое после заполнения листа на что-то наложилось
     (надпись на линии, размерная линия на контуре, размер на размере), заново выбирает лучший из своих вариантов
     с учётом ВСЕХ остальных элементов листа; повторяется, пока есть улучшения. Варианты — те же, что заданы
     при простановке (правила ГОСТ 2.307 соблюдены в каждом), меняется только выбор между ними. */
  S.repair = function (maxIter) {
    const recs = (this._atts || []).filter(r => r.fns.length > 1 && r.prims.length);
    let moved = 0;
    const P = this.p;
    for (let it = 0; it < (maxIter || 12); it++) {
      let changed = false;
      for (const r of recs) {
        const own = new Set(r.prims);
        const others = P.filter(q => !own.has(q));
        if (others.length !== P.length - r.prims.length) continue;   // обозначение уже перенесено/удалено
        const cur = this.conflicts(r.prims, others);
        if (!cur) continue;
        P.length = 0; others.forEach(q => P.push(q));
        let best = -1, bn = cur;
        this._attDepth = (this._attDepth || 0) + 1;
        try {
          for (let i = 0; i < r.fns.length; i++) {
            const i0 = P.length; r.fns[i]();
            const n = this.conflicts(P.slice(i0), others);
            P.length = i0;
            if (n < bn) { bn = n; best = i; if (!n) break; }
          }
          if (best >= 0) { const i0 = P.length; r.fns[best](); r.prims = P.slice(i0); changed = true; moved++; }
          else r.prims.forEach(q => P.push(q));
        } finally { this._attDepth--; }
      }
      if (!changed) break;
    }
    if (!globalThis.NOPAIRS) moved += this.repairPairs(recs);
    return moved;
  };
  /* перестановка парами: два обозначения, которые мешают друг другу, перебирают сочетания своих вариантов
     (по одному каждое сдвинуться не может — второе стоит на единственном свободном месте первого) */
  S.repairPairs = function (recs, maxCombos) {
    const P = this.p, lim = maxCombos || 6000;
    let work = 0;   // бюджет вызовов вариантов: перестановка парами ограничена по объёму работы (детерминированно, без таймера)
    const BUDGET = globalThis.RPBUDGET || 4000;
    let moved = 0;
    let pset = new Set(P);
    const alive = r => r.prims.every(q => pset.has(q));
    const boxOf = prims => { let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity; for (const q of prims) { const b = pbox(q); if (!b) continue; if (b[0] < x1) x1 = b[0]; if (b[1] < y1) y1 = b[1]; if (b[2] > x2) x2 = b[2]; if (b[3] > y2) y2 = b[3]; } return [x1 - 1, y1 - 1, x2 + 1, y2 + 1]; };
    const near = (a, b) => !(a[2] < b[0] || b[2] < a[0] || a[3] < b[1] || b[3] < a[1]);
    for (let pass = 0; pass < 3; pass++) {
      let changed = false;
      for (const r of recs) {
        if (work > BUDGET) break;
        pset = new Set(P);
        if (!alive(r)) continue;
        const ownR = new Set(r.prims);
        const restR = P.filter(q => !ownR.has(q));
        if (!this.conflicts(r.prims, restR)) continue;
        // соседи по конфликту — обозначения, с которыми r пересекается
        // и те, что занимают места других вариантов r (сдвинув их, r встанет без наложений)
        const cand = recs.filter(s => s !== r && alive(s) && s.fns.length * r.fns.length <= lim);
        const cb = new Map(cand.map(s => [s, boxOf(s.prims)]));
        const rb = boxOf(r.prims);
        const hits = new Map(cand.map(s => [s, near(rb, cb.get(s)) && this.conflicts(r.prims, s.prims) + this.conflicts(s.prims, r.prims) > 0 ? 1000 : 0]));
        const optBlk = [];
        {
          P.length = 0; restR.forEach(q => P.push(q));
          this._attDepth = (this._attDepth || 0) + 1;
          try {
            for (let i = 0; i < r.fns.length; i++) {
              const i0 = P.length; r.fns[i](); work++;
              const a = P.slice(i0); P.length = i0;
              const ab = boxOf(a);
              const blk = cand.filter(s => near(ab, cb.get(s)) && this.conflicts(a, s.prims) + this.conflicts(s.prims, a) > 0);
              optBlk[i] = blk;
              if (blk.length && blk.length <= 2) blk.forEach(s => hits.set(s, hits.get(s) + 1));
            }
          } finally { this._attDepth--; }
          r.prims.forEach(q => P.push(q));
        }
        const mates = cand.filter(s => hits.get(s) > 0).sort((u, v) => hits.get(v) - hits.get(u)).slice(0, 8);
        if (globalThis.RDBG) { const nm = x => ((x.prims.find(q => q.t === 'T') || {}).s || '?'); const rt = nm(r); if (rt.includes(globalThis.RDBG)) {
          console.error('REC', rt, 'opts', r.fns.length, 'cur', this.conflicts(r.prims, restR), 'mates', mates.map(m => nm(m) + ':' + hits.get(m) + '/' + m.fns.length).join(', '));
          P.length = 0; restR.forEach(q => P.push(q)); this._attDepth = (this._attDepth || 0) + 1;
          for (let i = 0; i < r.fns.length; i++) { const i0 = P.length; r.fns[i](); const a = P.slice(i0); P.length = i0; const n = this.conflicts(a, restR); const blk = cand.filter(s => this.conflicts(a, s.prims) + this.conflicts(s.prims, a) > 0).map(nm); console.error('  opt', i, n, blk.join(' | ')); }
          this._attDepth--; r.prims.forEach(q => P.push(q)); } }
        for (const s of mates) {
          if (work > BUDGET) break;
          pset = new Set(P);
          if (!alive(r) || !alive(s)) continue;
          const own = new Set(r.prims.concat(s.prims));
          const rest = P.filter(q => !own.has(q));
          const score = (a, b) => this.conflicts(a, rest) + this.conflicts(b, rest.concat(a)) + this.conflicts(a, b);
          const cur = score(r.prims, s.prims);
          if (!cur) continue;
          let best = null, bn = cur;
          P.length = 0; rest.forEach(q => P.push(q));
          this._attDepth = (this._attDepth || 0) + 1;
          try {
            outer: for (let i = 0; i < r.fns.length; i++) {
              // вариант r имеет смысл, только если ему мешает именно s (иначе его уже рассмотрела одиночная перестановка)
              if (!optBlk[i] || !optBlk[i].includes(s) || optBlk[i].length > 2) continue;
              const i0 = P.length; r.fns[i](); work++;
              const a = P.slice(i0);
              const ca = this.conflicts(a, rest);
              let restA = null;
              if (ca >= bn) { P.length = i0; continue; }
              for (let j = 0; j < s.fns.length; j++) {
                const j0 = P.length; s.fns[j](); work++;
                const b = P.slice(j0); P.length = j0;
                const n = ca + this.conflicts(b, restA || (restA = rest.concat(a))) + this.conflicts(a, b);
                if (n < bn) { bn = n; best = [i, j]; if (!n) { P.length = i0; break outer; } }
              }
              P.length = i0;
            }
            if (best) {
              let i0 = P.length; r.fns[best[0]](); r.prims = P.slice(i0);
              i0 = P.length; s.fns[best[1]](); s.prims = P.slice(i0);
              moved++; changed = true;
            } else { r.prims.forEach(q => P.push(q)); s.prims.forEach(q => P.push(q)); }
          } finally { this._attDepth--; }
        }
      }
      if (!changed) break;
    }
    if (globalThis.RPSTAT) { const t = globalThis.RPSTAT; const st = (new Error().stack || '').split('\n').map(l => (l.match(/at (\S+)/) || [])[1]).filter(x => /Sheet|sheet|compose/.test(x || ''))[0] || '?'; t[st] = (t[st] || 0) + work; t.n = (t.n || 0) + 1; t.work = (t.work || 0) + work; t.recs = (t.recs || 0) + recs.length; t.moved = (t.moved || 0) + moved; }
    return moved;
  };
  S.textRect = textRect;
  /* занятые области и поиск свободного места */
  S.occupy = function (r, pad) { pad = pad || 0; (this.occ = this.occ || []).push({ x1: r.x1 - pad, y1: r.y1 - pad, x2: r.x2 + pad, y2: r.y2 + pad }); return this; };
  S.free = function (r) { const f = this.frame; if (r.x1 < f.x1 + 2 || r.x2 > f.x2 - 2 || r.y1 < f.y1 + 2 || r.y2 > f.y2 - 2) return false; return !(this.occ || []).some(o => r.x1 < o.x2 && r.x2 > o.x1 && r.y1 < o.y2 && r.y2 > o.y1); };
  /* найти место w×h: перебор сверху вниз, слева направо (или prefer: 'br' — снизу справа) */
  S.place = function (w, h, o) {
    o = o || {};
    const f = this.frame, st = 3;
    const xs = [], ys = [];
    for (let x = f.x1 + 3; x + w <= f.x2 - 3; x += st) xs.push(x);
    for (let y = f.y2 - 3 - h; y >= f.y1 + 3; y -= st) ys.push(y);
    if (o.prefer === 'bottom') ys.reverse();
    if (o.prefer === 'right') xs.reverse();
    const near = o.near;
    let best = null, bd = Infinity;
    for (const y of ys) for (const x of xs) {
      const r = { x1: x, y1: y, x2: x + w, y2: y + h };
      if (!this.free(r)) continue;
      if (!near) return r;
      const d = Math.hypot(x + w / 2 - near[0], y + h / 2 - near[1]);
      if (d < bd) { bd = d; best = r; }
    }
    return best;
  };
  /* закрашенная стрелка (веер тонких отрезков): острие (x, y), направление ang (куда указывает острие) */
  S.arrow = function (x, y, ang, len, wid) {
    len = len || 2.5; wid = wid || 0.85;
    const c = Math.cos(ang * D2R), s = Math.sin(ang * D2R);
    const bx = x - len * c, by = y - len * s, nx = -s * wid / 2, ny = c * wid / 2;
    const k = 6;
    for (let i = 0; i <= k; i++) { const t = -1 + 2 * i / k; this.line(x, y, bx + nx * t, by + ny * t, 2); }
    return this;
  };
  /* закрашенный треугольник базы: середина основания (x, y), вершина в направлении ang, сторона a */
  S.solidTri = function (x, y, ang, a) {
    a = a || 4;
    const hgt = a * Math.sqrt(3) / 2, c = Math.cos(ang * D2R), s = Math.sin(ang * D2R), nx = -s, ny = c;
    const tip = [x + c * hgt, y + s * hgt];
    const k = 10;
    for (let i = 0; i <= k; i++) { const t = -1 + 2 * i / k; this.line(x + nx * a / 2 * t, y + ny * a / 2 * t, tip[0], tip[1], 2); }
    this.poly([[x + nx * a / 2, y + ny * a / 2], [x - nx * a / 2, y - ny * a / 2], tip], 2);
    return this;
  };
  S.dot = function (x, y, r) { r = r || 0.6; for (let k = 0; k < 4; k++) this.circle(x, y, r * (k + 1) / 4, 2); return this; };

  /* штриховка: кольца (многоугольники в мм листа) по правилу чёт-нечет; ang — угол линий, step — шаг */
  S.hatch = function (rings, o) {
    o = o || {};
    const ang = o.ang === undefined ? 45 : o.ang, step = o.step || 2.5, ph = o.phase || 0;
    const c = Math.cos(-ang * D2R), s = Math.sin(-ang * D2R);
    const rot = ([x, y]) => [x * c - y * s, x * s + y * c];
    const R = rings.filter(r => r && r.length > 2).map(r => r.map(rot));
    if (!R.length) return this;
    let ymin = Infinity, ymax = -Infinity;
    R.forEach(r => r.forEach(p => { ymin = Math.min(ymin, p[1]); ymax = Math.max(ymax, p[1]); }));
    const ci = Math.cos(ang * D2R), si = Math.sin(ang * D2R);
    const back = (x, y) => [x * ci - y * si, x * si + y * ci];
    const lines = [];
    for (let y = Math.ceil((ymin - ph) / step) * step + ph; y <= ymax; y += step) {
      const xs = [];
      for (const r of R) for (let i = 0; i < r.length; i++) {
        const a = r[i], b = r[(i + 1) % r.length];
        if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y)) xs.push(a[0] + (y - a[1]) * (b[0] - a[0]) / (b[1] - a[1]));
      }
      xs.sort((p, q) => p - q);
      for (let i = 0; i + 1 < xs.length; i += 2) if (xs[i + 1] - xs[i] > 0.3) {
        const p1 = back(xs[i], y), p2 = back(xs[i + 1], y);
        lines.push(r3(p1[0]), r3(p1[1]), r3(p2[0]), r3(p2[1]));
      }
    }
    if (lines.length) this.p.push({ t: 'H', l: lines, rings: rings.map(r => r.map(p => [r3(p[0]), r3(p[1])])), ang, step });
    return this;
  };
  /* вариант штриховки для соседних деталей разреза (ГОСТ 2.306: разный наклон и шаг) */
  S.nextHatch = function (base) {
    const n = this.hatchN++;
    const ang = n % 2 ? 135 : 45, step = (base || 2.5) * [1, 1, 1.5, 1.5, 0.75, 0.75][n % 6];
    return { ang, step };
  };

  /* -------------------------------------------------------------- вид (масштаб и начало) */
  function View(sh, ox, oy, k) { this.sh = sh; this.ox = ox; this.oy = oy; this.k = k; }
  View.prototype.X = function (x) { return this.ox + this.k * x; };
  View.prototype.Y = function (y) { return this.oy + this.k * y; };
  View.prototype.P = function (x, y) { return [this.X(x), this.Y(y)]; };
  View.prototype.line = function (x1, y1, x2, y2, s) { this.sh.line(this.X(x1), this.Y(y1), this.X(x2), this.Y(y2), s); return this; };
  View.prototype.poly = function (pts, s, closed) { this.sh.poly(pts.map(p => this.P(p[0], p[1])), s, closed); return this; };
  View.prototype.circle = function (x, y, r, s) { this.sh.circle(this.X(x), this.Y(y), r * this.k, s); return this; };
  View.prototype.arc = function (x, y, r, a1, a2, s) { this.sh.arc(this.X(x), this.Y(y), r * this.k, a1, a2, s); return this; };
  View.prototype.hatch = function (rings, o) { this.sh.hatch(rings.map(r => r.map(p => this.P(p[0], p[1]))), o); return this; };
  View.prototype.rings = function (rings) { return rings.map(r => r.map(p => this.P(p[0], p[1]))); };

  /* -------------------------------------------------------------- размеры */
  const AR = 2.5, EXT = 2;
  /* горизонтальный размер между точками (листовые мм), размерная линия на высоте yd */
  /* варианты размещения текста на продолжении размерной линии (ГОСТ 2.307, п. 2.10–2.11): сначала с предпочтительной стороны,
     затем с другой; всё дальше от стрелки — до первого свободного места */
  function outV(sh, xd, y1, y2, ext, text, h, w, below) {
    const c = [];
    if (w + 1 <= y2 - y1) c.push(() => sh.text(xd - 0.9, (y1 + y2) / 2, text, { h, anchor: 'cb', ang: 90 }));

    for (let d = 0; d <= 30; d += 2.5) for (const b of below ? [true, false] : [false, true]) c.push(b
      ? () => { sh.line(xd, y1 - ext - d - w - 1.5, xd, y1 - ext, 2); sh.text(xd - 0.9, y1 - ext - 0.75 - d, text, { h, anchor: 'rb', ang: 90 }); }
      : () => { sh.line(xd, y2 + ext, xd, y2 + ext + d + w + 1.5, 2); sh.text(xd - 0.9, y2 + ext + 0.75 + d, text, { h, anchor: 'lb', ang: 90 }); });
    return c;
  }
  function outH(sh, x1, x2, yd, ext, text, h, w, left) {
    const c = [];
    if (w + 1 <= x2 - x1) c.push(() => sh.text((x1 + x2) / 2, yd + 0.9, text, { h, anchor: 'cb' }));   // текст помещается между выносными линиями

    for (let d = 0; d <= 30; d += 2.5) for (const l of left ? [true, false] : [false, true]) c.push(l
      ? () => { sh.line(x1 - ext - d - w - 1.5, yd, x1 - ext, yd, 2); sh.text(x1 - ext - 0.75 - d, yd + 0.9, text, { h, anchor: 'rb' }); }
      : () => { sh.line(x2 + ext, yd, x2 + ext + d + w + 1.5, yd, 2); sh.text(x2 + ext + 0.75 + d, yd + 0.9, text, { h, anchor: 'lb' }); });
    return c;
  }
  S.dimH = function (x1, y1, x2, y2, yd, text, o) {
    o = o || {};
    if (x1 > x2) { [x1, y1, x2, y2] = [x2, y2, x1, y1]; }
    const i0 = this.p.length;
    if (!o.noExt1 && Math.abs(yd - y1) > 0.5) [x1, y1] = extStart(this, x1, y1, 0, yd > y1 ? 1 : -1, Math.abs(yd - y1));
    if (!o.noExt2 && Math.abs(yd - y2) > 0.5) [x2, y2] = extStart(this, x2, y2, 0, yd > y2 ? 1 : -1, Math.abs(yd - y2));
    this._lastAnch = [o.noExt1 ? null : [x1, y1], o.noExt2 ? null : [x2, y2]].filter(Boolean);
    if (!o.fixed) yd = dimShift(this, true, yd, x1, x2, yd >= Math.max(y1, y2) ? 1 : yd <= Math.min(y1, y2) ? -1 : 0);
    const h = o.h || 3.5, len = x2 - x1, w = twx(text, h);
    const up = yd >= Math.max(y1, y2) ? 1 : yd <= Math.min(y1, y2) ? -1 : 0;
    if (!o.noExt1 && Math.abs(yd - y1) > 0.5) { this.line(x1, y1 + (up ? up * (o.gap || 0) : 0), x1, yd + (up || (yd > y1 ? 1 : -1)) * EXT, 2); this.p[this.p.length - 1].ex = 1; }
    if (!o.noExt2 && Math.abs(yd - y2) > 0.5) { this.line(x2, y2 + (up ? up * (o.gap || 0) : 0), x2, yd + (up || (yd > y2 ? 1 : -1)) * EXT, 2); this.p[this.p.length - 1].ex = 1; }
    const inside = len >= 2 * AR + 2;
    const fits = len >= w + 2 * AR + 2;
    // что измеряет размер — для КОМПАС (размер создаётся объектом «Линейный размер», а не отрезками); ai — стрелки внутри
    const D = { t: 'D', k: 'H', a: [x1, o.noExt1 ? yd : y1, x2, o.noExt2 ? yd : y2, yd], s: String(text), h, ai: inside ? 1 : 0 };
    const ret = () => { this.p.push(D); return this; };
    let tx = (x1 + x2) / 2, anchor = 'cb';
    if (o.textX !== undefined) { tx = o.textX; anchor = 'lb'; }
    if (inside) {
      this.line(x1, yd, x2, yd, 2); this.p[this.p.length - 1].dl = 1; this.arrow(x1, yd, 180); this.arrow(x2, yd, 0);
      if (o.out === 'left' || o.out === 'right') {
        const ds = []; for (let d = 0; d <= 120; d += 2.5) ds.push(d);
        const fn = d => o.out === 'left' ? () => { this.line(x1 - d - w - 3, yd, x1, yd, 2); this.text(x1 - 1.5 - d, yd + 0.9, text, { h, anchor: 'rb' }); }
          : () => { this.line(x2, yd, x2 + d + w + 3, yd, 2); this.text(x2 + 1.5 + d, yd + 0.9, text, { h, anchor: 'lb' }); };
        this.textFree(ds.map(fn), i0);
        return ret();
      }
      if (!fits && o.textX === undefined) { this.textFree(outH(this, x1, x2, yd, 0, text, h, w, o.side === 'left'), i0); return ret(); }
    } else {
      const ext = AR + 2;   // стрелки снаружи: короткое продолжение размерной линии, длиннее — только со стороны надписи
      this.line(x1 - ext, yd, x2 + ext, yd, 2); this.p[this.p.length - 1].dl = 1; this.arrow(x1, yd, 0); this.arrow(x2, yd, 180);
      if (o.textX === undefined) {
        // малый размер: текст над размерной линией между выносными (если помещается по высоте ряда) или на продолжении линии
        this.textFree(outH(this, x1, x2, yd, ext, text, h, w, o.side === 'left'), i0); return ret();
      }
    }
    if (inside && fits && o.textX === undefined) {
      const span = (len - w - 2 * AR - 1) / 2, step = Math.max(1.5, span / 6), ds = [0];
      for (let k = 1; k * step <= span + 1e-9; k++) ds.push(k * step, -k * step);
      this.textFree(ds.map(d => () => this.text(tx + d, yd + 0.9, text, { h, anchor })), i0);
    } else this.text(tx, yd + 0.9, text, { h, anchor });
    return ret();
  };
  /* вертикальный размер, размерная линия на абсциссе xd; текст слева от линии, снизу вверх */
  S.dimV = function (x1, y1, x2, y2, xd, text, o) {
    o = o || {};
    if (y1 > y2) { [x1, y1, x2, y2] = [x2, y2, x1, y1]; }
    const i0 = this.p.length;
    if (!o.noExt1 && Math.abs(xd - x1) > 0.5) [x1, y1] = extStart(this, x1, y1, xd > x1 ? 1 : -1, 0, Math.abs(xd - x1));
    if (!o.noExt2 && Math.abs(xd - x2) > 0.5) [x2, y2] = extStart(this, x2, y2, xd > x2 ? 1 : -1, 0, Math.abs(xd - x2));
    this._lastAnch = [o.noExt1 ? null : [x1, y1], o.noExt2 ? null : [x2, y2]].filter(Boolean);
    if (!o.fixed) xd = dimShift(this, false, xd, y1, y2, xd >= Math.max(x1, x2) ? 1 : xd <= Math.min(x1, x2) ? -1 : 0);
    const h = o.h || 3.5, len = y2 - y1, w = twx(text, h);
    const rt = xd >= Math.max(x1, x2) ? 1 : xd <= Math.min(x1, x2) ? -1 : 0;
    if (!o.noExt1 && Math.abs(xd - x1) > 0.5) { this.line(x1, y1, xd + (rt || (xd > x1 ? 1 : -1)) * EXT, y1, 2); this.p[this.p.length - 1].ex = 1; }
    if (!o.noExt2 && Math.abs(xd - x2) > 0.5) { this.line(x2, y2, xd + (rt || (xd > x2 ? 1 : -1)) * EXT, y2, 2); this.p[this.p.length - 1].ex = 1; }
    const inside = len >= 2 * AR + 2, fits = len >= w + 2 * AR + 2;
    const D = { t: 'D', k: 'V', a: [o.noExt1 ? xd : x1, y1, o.noExt2 ? xd : x2, y2, xd], s: String(text), h, ai: inside ? 1 : 0 };
    const ret = () => { this.p.push(D); return this; };
    let ty = (y1 + y2) / 2, anchor = 'cb';
    if (o.textY !== undefined) { ty = o.textY; anchor = 'lb'; }
    if (inside) {
      this.line(xd, y1, xd, y2, 2); this.p[this.p.length - 1].dl = 1; this.arrow(xd, y1, 270); this.arrow(xd, y2, 90);
      if (o.out === 'below' || o.out === 'above') {
        // текст на продолжении размерной линии — в первом свободном месте (ГОСТ 2.307, п. 2.10)
        const ds = []; for (let d = 0; d <= 120; d += 2.5) ds.push(d);
        const fn = d => o.out === 'below' ? () => { this.line(xd, y1 - d - w - 3, xd, y1, 2); this.text(xd - 0.9, y1 - 1.5 - d, text, { h, anchor: 'rb', ang: 90 }); }
          : () => { this.line(xd, y2, xd, y2 + d + w + 3, 2); this.text(xd - 0.9, y2 + 1.5 + d, text, { h, anchor: 'lb', ang: 90 }); };
        this.textFree(ds.map(fn), i0);
        return ret();
      } else if (!fits && o.textY === undefined) { this.textFree(outV(this, xd, y1, y2, 0, text, h, w, o.side === 'below'), i0); return ret(); }
    } else {
      const ext = AR + 2;   // стрелки снаружи: короткое продолжение размерной линии, длиннее — только со стороны надписи
      this.line(xd, y1 - ext, xd, y2 + ext, 2); this.p[this.p.length - 1].dl = 1; this.arrow(xd, y1, 90); this.arrow(xd, y2, 270);
      if (o.textY === undefined) { this.textFree(outV(this, xd, y1, y2, ext, text, h, w, o.side === 'below'), i0); return ret(); }
    }
    if (inside && fits && o.textY === undefined && !o.out) {
      const span = (len - w - 2 * AR - 1) / 2, step = Math.max(1.5, span / 6), ds = [0];
      for (let k = 1; k * step <= span + 1e-9; k++) ds.push(k * step, -k * step);
      this.textFree(ds.map(d => () => this.text(xd - 0.9, ty + d, text, { h, anchor, ang: 90 })), i0);
    } else this.text(xd - 0.9, ty, text, { h, anchor, ang: 90 });
    return ret();
  };
  /* диаметр с обрывом размерной линии (вторая сторона не изображена или в разрезе с пазом): стрелка только у точки (x, y1),
     линия продолжается за ось до yEnd; текст вдоль линии (ГОСТ 2.307, п. 2.10) */
  S.dimHalfV = function (x, y1, yEnd, text, o) {
    o = o || {};
    const h = o.h || 3.5, i0 = this.p.length;
    [x, y1] = snapPt(this, x, y1, 0, yEnd > y1 ? -1 : 1, 3); this._lastAnch = [[x, y1]];
    this.line(x, y1, x, yEnd, 2); this.arrow(x, y1, yEnd > y1 ? 270 : 90);
    const w = twx(text, h), lo = Math.min(y1, yEnd), hi = Math.max(y1, yEnd), ds = [];
    for (let yy = lo + AR + 1; yy + w <= hi - 0.5 + 1e-9; yy += 1.5) ds.push(yy);
    if (!ds.length) ds.push(lo + AR + 1);
    this.textFree(ds.map(yy => () => this.text(x - 0.9, yy, text, { h, anchor: 'lb', ang: 90 })), i0);
    // для КОМПАС — объект «Линейный размер с обрывом»
    this.p.push({ t: 'D', k: 'BR', a: [r3(x), r3(y1), r3(x), r3(yEnd)], s: String(text), h });
    return this;
  };
  /* диаметр с обрывом размерной линии (ГОСТ 2.307 п. 2.? — окружность изображена не полностью): стрелка на окружности (cx, cy, r)
     в направлении ang, линия через центр и за него на ext мм; надпись — вдоль линии между окружностью и центром */
  S.dimBreak = function (cx, cy, r, ang, ext, text, o) {
    o = o || {};
    const h = o.h || 3.5, i0 = this.p.length, c = Math.cos(ang * D2R), s = Math.sin(ang * D2R);
    const p1 = [cx + r * c, cy + r * s], p2 = [cx - ext * c, cy - ext * s];
    this._lastAnch = [p1];
    this.line(p1[0], p1[1], p2[0], p2[1], 2); this.p[this.p.length - 1].dl = 1;
    this.arrow(p1[0], p1[1], ang);
    let ar = ang; while (ar > 90) ar -= 180; while (ar <= -90) ar += 180;
    const up = [-Math.sin(ar * D2R), Math.cos(ar * D2R)], w = twx(text, h), ds = [];
    // надпись над линией (со стороны «вверх» надписи), вдоль линии от стрелки к центру
    for (let t = r - AR - 1 - w / 2; t >= w / 2 - ext + 1; t -= 1.5) ds.push(t);
    if (!ds.length) ds.push(r / 2);
    this.textFree(ds.map(t => () => this.text(cx + t * c + up[0] * 0.9, cy + t * s + up[1] * 0.9, text, { h, ang: ar, anchor: 'cb' })), i0);
    // для КОМПАС — объект «Линейный размер с обрывом»: (X1, Y1) — точка со стрелкой, (X2, Y2) — конец за центром
    this.p.push({ t: 'D', k: 'BR', a: [r3(p1[0]), r3(p1[1]), r3(p2[0]), r3(p2[1])], s: String(text), h });
    return this;
  };
  /* размер, параллельный отрезку p1–p2 (наклонный), размерная линия на расстоянии off по нормали (nx, ny); ta — угол надписи */
  S.dimAligned = function (p1, p2, nx, ny, off, text, ta, o) {
    o = o || {};
    const h = o.h || 3.5, i0 = this.p.length, a = Math.atan2(p2[1] - p1[1], p2[0] - p1[0]) / D2R;
    this.line(p1[0] + nx, p1[1] + ny, p1[0] + nx * (off + 2), p1[1] + ny * (off + 2), 2).line(p2[0] + nx, p2[1] + ny, p2[0] + nx * (off + 2), p2[1] + ny * (off + 2), 2);
    this.p[this.p.length - 1].ex = this.p[this.p.length - 2].ex = 1;
    const q1 = [p1[0] + nx * off, p1[1] + ny * off], q2 = [p2[0] + nx * off, p2[1] + ny * off];
    this.line(q1[0], q1[1], q2[0], q2[1], 2); this.arrow(q1[0], q1[1], 180 + a); this.arrow(q2[0], q2[1], a);
    // надпись — параллельно размерной линии (читаемо: угол в (−90°, 90°]), с внешней стороны линии
    let ar = a; while (ar > 90) ar -= 180; while (ar <= -90) ar += 180;
    void ta;
    const upOut = -Math.sin(ar * D2R) * nx + Math.cos(ar * D2R) * ny >= 0;
    this.text((q1[0] + q2[0]) / 2 + nx * 0.8, (q1[1] + q2[1]) / 2 + ny * 0.8, text, { h, ang: ar, anchor: upOut ? 'cb' : 'ct' });
    // для КОМПАС — «Линейный размер» с ориентацией параллельно объекту
    const pg = 'al' + (++TGSEQ);
    for (let i = i0; i < this.p.length; i++) this.p[i].pg = pg;
    this.p.push({ t: 'D', k: 'PL', a: [r3(p1[0]), r3(p1[1]), r3(p2[0]), r3(p2[1]), r3((q1[0] + q2[0]) / 2), r3((q1[1] + q2[1]) / 2)], s: String(text), h, pg });
    return this;
  };
  /* угловой размер: вершина (x, y), лучи a1→a2 (против часовой), радиус дуги R */
  S.dimAng = function (x, y, a1, a2, R, text, o) {
    o = o || {};
    // выносные линии по сторонам угла — там, где сторона не совпадает с линией контура (ГОСТ 2.307 п. 4.1)
    for (const a of [a1, a2]) {
      const c = Math.cos(a * D2R), s = Math.sin(a * D2R), L = R + EXT;
      let cov = 0;   // сторона угла покрыта контуром от вершины на длину cov
      const iv = [];
      for (const q of this.p) {
        if (q.t !== 'L' || q.g !== undefined || q.s === 3) continue;
        const d1 = (q.a[0] - x) * -s + (q.a[1] - y) * c, d2 = (q.a[2] - x) * -s + (q.a[3] - y) * c;
        if (Math.abs(d1) > 0.15 || Math.abs(d2) > 0.15) continue;
        const t1 = (q.a[0] - x) * c + (q.a[1] - y) * s, t2 = (q.a[2] - x) * c + (q.a[3] - y) * s;
        iv.push([Math.min(t1, t2), Math.max(t1, t2)]);
      }
      iv.sort((u, v) => u[0] - v[0]);
      for (const [t1, t2] of iv) if (t1 <= cov + 0.2) cov = Math.max(cov, t2);
      if (cov < R - 0.5) { this.line(x + c * cov, y + s * cov, x + c * L, y + s * L, 2); this.p[this.p.length - 1].ex = 1; }
    }
    this.arc(x, y, R, a1, a2, 2);
    this.arrow(x + R * Math.cos(a1 * D2R), y + R * Math.sin(a1 * D2R), a1 - 90);
    this.arrow(x + R * Math.cos(a2 * D2R), y + R * Math.sin(a2 * D2R), a2 + 90);
    const am = (a1 + a2) / 2, tx = x + (R + 1.5) * Math.cos(am * D2R), ty = y + (R + 1.5) * Math.sin(am * D2R);
    this.text(tx, ty, text, { h: o.h || 3.5, anchor: Math.cos(am * D2R) >= 0 ? 'lm' : 'rm' });
    // для КОМПАС — объект «Угловой размер»
    this.p.push({ t: 'D', k: 'AN', a: [r3(x), r3(y), r3(a1), r3(a2), r3(R)], s: String(text), h: o.h || 3.5 });
    return this;
  };
  /* обозначение позиции (ГОСТ 2.109): линия-выноска с точкой на детали (x, y), полка от (sx, sy), номера ns столбиком (dir — вверх/вниз) */
  S.posMark = function (x, y, sx, sy, ns, side, dir, pg) {
    const w = Math.max(...ns.map(q => tw(q, 7))) + 2, ex = side === 'r' ? sx + w : sx - w;
    const i0 = this.p.length;
    this.line(x, y, sx, sy, 2); this.p[this.p.length - 1].pl = 1;   // линия-выноска позиции: выносные линии размеров пересекать может (ГОСТ 2.109 п. 7.6 — только размерные)
    this.dot(x, y, 0.8);
    ns.forEach((q, j) => { const yy = sy + dir * 9 * j; this.line(sx, yy, ex, yy, 2); this.text(side === 'r' ? sx + 1 : ex + 1, yy + 2, q, { h: 7, pos: true }); });
    if (ns.length > 1) this.line(sx, sy, sx, sy + dir * 9 * (ns.length - 1), 2);
    // для КОМПАС — объект «Обозначение позиции» (линия-выноска с точкой, номера на полках); отрезки выше — запасной вариант
    for (let i = i0; i < this.p.length; i++) this.p[i].pg = pg;
    this.p.push({ t: 'D', k: 'P', a: [x, y, sx, sy], ns, side, dir, h: 7, pg });
    return this;
  };
  /* выноска с полкой: от точки (x, y) к началу полки (sx, sy); texts — строки над и под полкой */
  S.leader = function (x, y, sx, sy, above, below, o) {
    o = o || {};
    if (!o.dot) { [x, y] = snapPt(this, x, y, x - sx, y - sy, 3); this._lastAnch = [[x, y]]; }
    const h = o.h || 3.5, side = o.side || (sx >= x ? 'r' : 'l');
    const w = Math.max(tw(above || '', h), tw(below || '', h)) + 1.5;
    const ex = side === 'r' ? sx + w : sx - w;
    this.line(x, y, sx, sy, 2); this.line(sx, sy, ex, sy, 2);
    if (o.arrow !== false && o.dot !== true) this.arrow(x, y, Math.atan2(y - sy, x - sx) / D2R);
    if (o.dot) this.dot(x, y, 0.7);
    const tx = side === 'r' ? sx + 0.75 : ex + 0.75;
    if (above) this.text(tx, sy + 0.9, above, { h });
    if (below) this.text(tx, sy - 0.9 - h, below, { h });
    // для КОМПАС — объект «Линия-выноска»: точка (x, y), начало полки (sx, sy), надписи над и под полкой
    this.p.push({ t: 'D', k: 'L', a: [r3(x), r3(y), r3(sx), r3(sy)], s: String(above || ''), s2: String(below || ''), h, side, end: o.dot ? 'dot' : o.arrow === false ? 'none' : 'arrow' });
    return this;
  };

  /* -------------------------------------------------------------- шероховатость (ГОСТ 2.309-73 ред. 2003) */
  /* знак на поверхности: острие (x, y); rot = 0 — знак сверху горизонтальной поверхности, 90 — слева от вертикальной */
  S.rough = function (x, y, val, o) {
    o = o || {};
    const h = o.h || 3.5, H = h * 2.2, t = Math.tan(30 * D2R), rot = (o.rot || 0) * D2R;
    const c = Math.cos(rot), s = Math.sin(rot);
    if (!o.free) { [x, y] = snapPt(this, x, y, -s, c, 8); this._lastAnch = [[x, y]]; }
    const T = (u, v) => [x + u * c - v * s, y + u * s + v * c];
    const w = val ? tw(val, h) + 1.2 : 0;
    const pL = T(-h * t, h), pR = T(H * t, H), pE = T(H * t + w, H);
    this.line(pL[0], pL[1], x, y, 1).line(x, y, pR[0], pR[1], 1);
    if (o.open) this.line(pL[0], pL[1], T(h * t, h)[0], T(h * t, h)[1], 1);
    if (o.circle) { const cc = T(0, h * 0.55); this.circle(cc[0], cc[1], h * 0.3, 1); }
    if (val) { this.line(pR[0], pR[1], pE[0], pE[1], 1); const tp = T(H * t + 0.6, H + 0.9); this.text(tp[0], tp[1], val, { h, ang: o.rot || 0 }); }
    // для КОМПАС — объект «Шероховатость» (кроме знака в составе выноски и знака в углу листа)
    const st = this._annStack || [];
    if (st.length === 1 && st[0] === 'rough') this.p.push({ t: 'D', k: 'R', a: [r3(x), r3(y), 0, 0], s: String(val || ''), h, rot: o.rot || 0, type: o.circle ? 2 : o.open ? 1 : 0 });
    return this;
  };
  /* знак шероховатости на полке линии-выноски со стрелкой к поверхности (x, y) */
  S.roughLeader = function (x, y, sx, sy, val, o) {
    o = o || {};
    [x, y] = snapPt(this, x, y, x - sx, y - sy, 3); this._lastAnch = [[x, y]];
    const h = o.h || 3.5, t = Math.tan(30 * D2R), H = h * 2.2, w = tw(val, h) + 1.2;
    const side = sx >= x ? 1 : -1;
    const shelf = H * t + h * t + w + 2;
    const ex = side > 0 ? sx + shelf : sx - shelf;
    this.line(x, y, sx, sy, 2).line(sx, sy, ex, sy, 2);
    this.arrow(x, y, Math.atan2(y - sy, x - sx) / D2R);
    this.rough(Math.min(sx, ex) + h * t + 1, sy, val, { h, free: true });
    // для КОМПАС — объект «Шероховатость» с линией-выноской
    this.p.push({ t: 'D', k: 'RL', a: [r3(x), r3(y), r3(sx), r3(sy)], s: String(val || ''), h, side: side > 0 ? 'r' : 'l', type: o.circle ? 2 : o.open ? 1 : 0 });
    return this;
  };
  /* шероховатость остальных поверхностей в правом верхнем углу: «Ra 6,3 (√)» */
  S.roughCorner = function (val, o) {
    o = o || {};
    const h = 5, x2 = this.frame.x2 - (this.landscape ? 8 : 18), y2 = this.frame.y2 - (o.dy || 9);
    const wv = tw(val, h);
    const H = h * 2.2, t = Math.tan(30 * D2R);
    // скобка со знаком
    const bx2 = x2, bx1 = x2 - 10;
    this.arc(bx1 + 1.6, y2 - 5, 5.5, 140, 220, 1); this.arc(bx2 - 1.6, y2 - 5, 5.5, -40, 40, 1);
    const sx = (bx1 + bx2) / 2 - 1, sy = y2 - 8.5;
    this.line(sx - 2.4 * t * 1.2, sy + 2.8, sx, sy, 1).line(sx, sy, sx + 6.2 * t * 1.2, sy + 6.2, 1);
    // основной знак со значением
    const tipx = bx1 - 4 - H * t - wv - 1.2, tipy = y2 - H - 1.5;
    // o.cast — поверхности, не обрабатываемые по данному чертежу (литьё): знак с кружком без параметра (ГОСТ 2.309-73, ред. 2003)
    this.rough(tipx, tipy, o.cast ? '' : val, { h, free: true, circle: !!o.cast });
    // для КОМПАС — «Неуказанная шероховатость» документа (знак в правом верхнем углу со знаком в скобках)
    this.p.push({ t: 'D', k: 'Q', a: [r3(tipx), r3(tipy), 0, 0], s: o.cast ? '' : String(val), h, type: o.cast ? 2 : 0 });
    return this;
  };

  /* -------------------------------------------------------------- допуски формы и расположения (ГОСТ 2.308) */
  function symbol(sh, cx, cy, kind) {
    const L = (a, b, c, d) => sh.line(cx + a, cy + b, cx + c, cy + d, 1);
    switch (kind) {
      case 'perp': L(-2.2, -2, 2.2, -2); L(0, -2, 0, 2.4); break;
      case 'par': L(-2.2, -2, -0.4, 2.2); L(0.4, -2, 2.2, 2.2); break;
      case 'cyl': sh.circle(cx, cy, 1.5, 1); L(-2.6, -1.9, -0.6, 2.4); L(0.6, -2.4, 2.6, 1.9); break;
      case 'round': sh.circle(cx, cy, 2, 1); break;
      case 'coax': sh.circle(cx, cy, 1.1, 1); sh.circle(cx, cy, 2.3, 1); break;
      case 'sym': L(-2.4, 0, 2.4, 0); L(-1.5, 1.4, 1.5, 1.4); L(-1.5, -1.4, 1.5, -1.4); break;
      case 'rrun': L(-1.6, -2.4, 1.4, 2.0); sh.arrow(cx + 1.6, cy + 2.4, 56, 1.6, 0.9); break;
      case 'trun': L(-2.3, -2.3, 0.2, 2); L(-0.2, -2.3, 2.3, 2); sh.arrow(cx + 0.4, cy + 2.3, 60, 1.4, 0.8); sh.arrow(cx + 2.5, cy + 2.3, 60, 1.4, 0.8); L(-2.6, -2.3, 2.6, -2.3); break;
      case 'flat': sh.poly([[cx - 2.6, cy - 1.4], [cx + 1.4, cy - 1.4], [cx + 2.6, cy + 1.4], [cx - 1.4, cy + 1.4]], 1); break;
      case 'pos': sh.circle(cx, cy, 1.5, 1); L(-2.6, 0, 2.6, 0); L(0, -2.6, 0, 2.6); break;
      default: break;
    }
  }
  /* рамка допуска: (x, y) — левый нижний угол; cells: [символ, значение, база?]; to: точка поверхности со стрелкой; from: 'l'|'r'|'b'|'t' */
  S.tol = function (x, y, cells, o) {
    o = o || {};
    const h = 3.5, hh = 7;
    const ws = [hh].concat(cells.slice(1).map(c => tw(c, h) + 3));
    const W = ws.reduce((a, b) => a + b, 0);
    this.rect(x, y, x + W, y + hh, 1);
    this.p.push({ t: 'B', a: [x, y, x + W, y + hh] });   // габарит рамки: для проверки наложений как надпись (в чертёж не выводится)
    let cx = x;
    ws.forEach((w, i) => {
      if (i) this.line(cx, y, cx, y + hh, 1);
      if (i === 0) symbol(this, cx + w / 2, y + hh / 2, cells[0]);
      else this.text(cx + w / 2, y + hh / 2, cells[i], { h, anchor: 'cm' });
      cx += w;
    });
    if (o.to) {
      const from = o.from || 'l';
      const st = from === 'l' ? [x, y + hh / 2] : from === 'r' ? [x + W, y + hh / 2] : from === 'b' ? [x + (o.fx !== undefined ? o.fx : 3.5), y] : [x + (o.fx !== undefined ? o.fx : 3.5), y + hh];
      const pv = (o.via && o.via.length ? o.via[o.via.length - 1] : st);
      const to = snapPt(this, o.to[0], o.to[1], o.to[0] - pv[0], o.to[1] - pv[1], 3); this._lastAnch = [to];
      const pts = [st].concat(o.via || [], [to]);
      for (let i = 0; i + 1 < pts.length; i++) this.line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], 2);
      const a = pts[pts.length - 2], b = pts[pts.length - 1];
      this.arrow(b[0], b[1], Math.atan2(b[1] - a[1], b[0] - a[0]) / D2R);
    }
    // для КОМПАС — объект «Допуск формы»: рамка (левый нижний угол), знак, значение, база, стрелка к поверхности
    const to = o.to ? (this._lastAnch || [o.to])[0] : null;
    this.p.push({ t: 'D', k: 'F', a: [r3(x), r3(y), to ? r3(to[0]) : 0, to ? r3(to[1]) : 0], s: cells.slice(1).join(' '), cells: cells.slice(1).map(String), sym: cells[0], h, to: !!to, via: (o.via || []).map(p => [r3(p[0]), r3(p[1])]), from: o.from || 'l' });
    return { w: W, h: hh };
  };
  /* база: треугольник на поверхности (x, y), направление выноса ang, буква в квадрате */
  S.datum = function (x, y, ang, letter, o) {
    o = o || {};
    const L = o.len || 5, a = 4.2, c = Math.cos(ang * D2R), s = Math.sin(ang * D2R);
    [x, y] = snapPt(this, x, y, c, s, 3); this._lastAnch = [[x, y]];
    this.solidTri(x + c * a * 0.866, y + s * a * 0.866, ang + 180, a);
    const ex = x + c * (a * 0.866 + L), ey = y + s * (a * 0.866 + L);
    this.line(x + c * a * 0.866, y + s * a * 0.866, ex, ey, 2);
    const bx = ex + c * 3.5, by = ey + s * 3.5;
    this.rect(bx - 3.5, by - 3.5, bx + 3.5, by + 3.5, 1);
    this.p.push({ t: 'B', a: [bx - 3.5, by - 3.5, bx + 3.5, by + 3.5] });
    this.text(bx, by, letter, { h: 3.5, anchor: 'cm' });
    // для КОМПАС — объект «Обозначение базы»: знак на поверхности, конец выноски у рамки, буква
    this.p.push({ t: 'D', k: 'B', a: [r3(x), r3(y), r3(ex), r3(ey)], s: String(letter), h: 3.5 });
    return this;
  };

  /* -------------------------------------------------------------- разрезы и обозначения видов */
  /* линия сечения поперёк горизонтальной детали: x, низ y1, верх y2; смотреть look = 'l'|'r' */
  S.cutV = function (x, y1, y2, letter, look) {
    const L = 9, g = 2;
    this.line(x, y2 + g, x, y2 + g + L, 1).line(x, y1 - g, x, y1 - g - L, 1);
    const dir = look === 'r' ? 0 : 180, dx = look === 'r' ? 1 : -1;
    for (const yy of [y2 + g + L - 1, y1 - g - L + 1]) { this.line(x, yy, x + dx * 6, yy, 2); this.arrow(x + dx * 7.5, yy, dir, 3, 1); }
    this.text(x + dx * 4.5, y2 + g + L + 1.2, letter, { h: 5, anchor: 'cb' });
    this.text(x + dx * 4.5, y1 - g - L - 1.2, letter, { h: 5, anchor: 'ct' });
    // для КОМПАС — объект «Линия разреза/сечения» (сверху вниз; стрелки — в сторону взгляда)
    this.p.push({ t: 'D', k: 'C', a: [r3(x), r3(y2 + g + L), r3(x), r3(y1 - g - L)], s: String(letter), h: 5, look: look === 'r' ? 'r' : 'l' });
    return this;
  };
  /* стрелка взгляда для вида «А» */
  S.viewArrow = function (x, y, ang, letter) {
    const c = Math.cos(ang * D2R), s = Math.sin(ang * D2R);
    this.line(x - c * 12, y - s * 12, x, y, 2); this.arrow(x, y, ang, 4, 1.4);
    this.text(x - c * 7 - s * 3, y - s * 7 + c * 3, letter, { h: 7, anchor: 'cb' });
    // для КОМПАС — объект «Стрелка взгляда»
    this.p.push({ t: 'D', k: 'W', a: [r3(x - c * 12), r3(y - s * 12), r3(x), r3(y)], s: String(letter), h: 7, tx: r3(x - c * 7 - s * 3), ty: r3(y - s * 7 + c * 3) });
    return this;
  };
  S.title = function (x, y, str, o) { this.text(x, y, str, Object.assign({ h: 7, anchor: 'cb' }, o || {})); return this; };

  /* -------------------------------------------------------------- таблицы и текст */
  S.table = function (x, ytop, colW, rows, o) {
    o = o || {};
    const h = o.h || 3.5, rh = o.rowH || 8, W = colW.reduce((a, b) => a + b, 0);
    let y = ytop;
    const heights = rows.map(r => (r.h || rh));
    const i0 = this.p.length, tcells = [];
    const total = heights.reduce((a, b) => a + b, 0);
    this.line(x, ytop, x + W, ytop, 1).line(x, ytop - total, x + W, ytop - total, 1);
    let cx = x;
    for (let i = 0; i <= colW.length; i++) { this.line(cx, ytop, cx, ytop - total, 1); cx += colW[i] || 0; }
    rows.forEach((r, ri) => {
      const cells = r.c || r, hh = heights[ri];
      if (ri) this.line(x, y, x + W, y, o.thin ? 2 : 1);
      let xx = x;
      cells.forEach((c, ci) => {
        const al = (o.align || [])[ci] || 'l';
        const lines = String(c === undefined ? '' : c).split('\n');
        lines.forEach((ln, li) => {
          const ty = y - hh / 2 + (lines.length - 1) * (h + 1.2) / 2 - li * (h + 1.2);
          const tx = al === 'c' ? xx + colW[ci] / 2 : al === 'r' ? xx + colW[ci] - 1.5 : xx + 1.5;
          const hf = Math.min(h, (colW[ci] - 2.5) / Math.max(twx(ln, 1), 0.1));
          this.text(tx, ty, ln, { h: hf, anchor: al + 'm' });
          (tcells[ri] = tcells[ri] || [])[ci] = (tcells[ri][ci] || []).concat([[ln, r3(hf)]]);
        });
        xx += colW[ci];
      });
      y -= hh;
    });
    // для КОМПАС — объект «Таблица» (ширины столбцов, высоты строк, тексты ячеек); отрезки и тексты выше — запасной вариант
    const pg = 'tb' + (++TGSEQ);
    for (let i = i0; i < this.p.length; i++) this.p[i].pg = pg;
    this.p.push({ t: 'D', k: 'TB', a: [r3(x), r3(ytop), r3(x + W), r3(ytop - total)], s: '', colW: colW.map(r3), heights: heights.map(r3), cells: tcells, align: colW.map((_, ci) => (o.align || [])[ci] || 'l'), h, pg });
    return total;
  };
  /* разбивка строки по ширине */
  function wrap(str, width, h) {
    const words = String(str).split(' '), out = [];
    let cur = '';
    for (const w of words) {
      const t = cur ? cur + ' ' + w : w;
      if (tw(t, h) > width && cur) { out.push(cur); cur = w; } else cur = t;
    }
    if (cur) out.push(cur);
    return out;
  }
  /* технические требования: колонка шириной width, нижний край ybot; строки с номерами «1. …» */
  S.notes = function (x, ybot, width, items, o) {
    o = o || {};
    const h = o.h || 3.5, lh = h * 1.65;
    const lines = [];
    items.forEach(it => {
      const m = String(it).match(/^(\s*\d+\.\s|\s*[–-]\s)?(.*)$/);
      const pre = m[1] || '', body = m[2];
      const ind = pre ? tw(pre, h) : 0;
      wrap(body, width - ind, h).forEach((ln, i) => lines.push({ s: (i ? '' : pre) + ln, x: x + (i ? ind : 0) }));
    });
    let y = ybot + (lines.length - 1) * lh;
    const i0 = this.p.length, top = y + lh + 1 + (o.title ? h : 0);
    if (o.title) { this.text(x + width / 2, y + lh + 1, o.title, { h, anchor: 'cb' }); }
    lines.forEach(l => { this.text(l.x, y, l.s, { h }); y -= lh; });
    // технические требования — для КОМПАС объект документа «Технические требования» (пункты — абзацами, перенос строк делает КОМПАС)
    if (!o.title || o.title === 'Технические требования') {
      const pg = 'tt' + (++TGSEQ);
      for (let i = i0; i < this.p.length; i++) this.p[i].pg = pg;
      this.p.push({ t: 'D', k: 'TT', a: [r3(x - 2), r3(ybot - 2), r3(x + width + 2), r3(top + 2)], s: '', items: items.map(String), h, pg });
    }
    return lines.length * lh + (o.title ? lh + 1 : 0);
  };

  /* -------------------------------------------------------------- рамка и штамп (только для предпросмотра) */
  S.previewFrame = function (stampTexts, o) {
    o = o || {};
    const f = this.frame, st = this.stamp, pv = [];
    const L = (x1, y1, x2, y2, s) => pv.push({ t: 'L', a: [x1, y1, x2, y2], s });
    const T = (x, y, s, h, an, ang) => { const w = tw(s, h); const fx = an && an.includes('c') ? -w / 2 : 0; const fy = an && an.includes('m') ? -h / 2 : 0; const c = Math.cos((ang || 0) * D2R), sn = Math.sin((ang || 0) * D2R); pv.push({ t: 'T', a: [x + fx * c - fy * sn, y + fx * sn + fy * c, h, ang || 0], s, w }); };
    L(0, 0, this.W, 0, 2); L(this.W, 0, this.W, this.H, 2); L(this.W, this.H, 0, this.H, 2); L(0, this.H, 0, 0, 2);
    [[f.x1, f.y1, f.x2, f.y1], [f.x2, f.y1, f.x2, f.y2], [f.x2, f.y2, f.x1, f.y2], [f.x1, f.y2, f.x1, f.y1]].forEach(a => L(...a, 1));
    // основная надпись, форма 1 (ГОСТ 2.104)
    const x0 = st.x1, y0 = st.y1;
    L(x0, y0, x0, st.y2, 1); L(x0, st.y2, st.x2, st.y2, 1);
    [7, 17, 40, 55, 65].forEach(dx => L(x0 + dx, y0, x0 + dx, st.y2, 1));
    for (let i = 1; i <= 10; i++) L(x0, y0 + 5 * i, x0 + 65, y0 + 5 * i, i === 6 || i === 7 ? 1 : 2);
    L(x0 + 65, y0 + 15, st.x2, y0 + 15, 1); L(x0 + 65, y0 + 40, st.x2, y0 + 40, 1);
    L(x0 + 135, y0, x0 + 135, y0 + 40, 1); L(x0 + 135, y0 + 35, st.x2, y0 + 35, 1); L(x0 + 135, y0 + 20, st.x2, y0 + 20, 1);
    L(x0 + 150, y0 + 20, x0 + 150, y0 + 40, 1); L(x0 + 167, y0 + 20, x0 + 167, y0 + 40, 1);
    [140, 145].forEach(dx => L(x0 + dx, y0 + 20, x0 + dx, y0 + 35, 2));
    L(x0 + 155, y0 + 15, x0 + 155, y0 + 20, 1);
    const sm = 2.5;
    [['Изм.', 0], ['Лист', 7], ['№ докум.', 17], ['Подп.', 40], ['Дата', 55]].forEach(([t, dx]) => T(x0 + dx + 0.6, y0 + 30.8, t, sm));
    ['Разраб.', 'Пров.', 'Т.контр.', '', 'Н.контр.', 'Утв.'].forEach((t, i) => T(x0 + 0.6, y0 + 25.8 - i * 5, t, sm));
    T(x0 + 137, y0 + 36, 'Лит.', sm); T(x0 + 152, y0 + 36, 'Масса', sm); T(x0 + 168, y0 + 36, 'Масштаб', sm);
    T(x0 + 137, y0 + 16, 'Лист', sm); T(x0 + 157, y0 + 16, 'Листов  1', sm);
    const s = stampTexts || {};
    if (s.code) T(x0 + 65 + 60, y0 + 47.5, s.code, 6, 'cm');
    if (s.name) { const lines = String(s.name).split('\n'); const hn = Math.min(5, ...lines.map(ln => 68 / Math.max(tw(ln, 1), 1))); lines.forEach((ln, i, a) => T(x0 + 100, y0 + 27.5 + (a.length - 1) * hn * 0.7 - i * hn * 1.4, ln, hn, 'cm')); }
    if (s.material) T(x0 + 100, y0 + 7.5, s.material, s.material.length > 30 ? 3.5 : 5, 'cm');
    if (s.org) T(x0 + 160, y0 + 7.5, s.org, Math.min(5, 48 / Math.max(tw(s.org, 1), 0.1)), 'cm');   // вписать в графу 9 (50 мм)
    if (s.mass) T(x0 + 158.5, y0 + 27.5, s.mass, 3.5, 'cm');
    if (s.scale) T(x0 + 176, y0 + 27.5, s.scale, 3.5, 'cm');
    if (s.student) T(x0 + 17.6, y0 + 25.8, s.student, sm);
    if (s.teacher) T(x0 + 17.6, y0 + 20.8, s.teacher, sm);
    if (s.normo) T(x0 + 17.6, y0 + 5.8, s.normo, sm);
    if (s.tcontr) T(x0 + 17.6, y0 + 15.8, s.tcontr, sm);
    if (s.utv) T(x0 + 17.6, y0 + 0.8, s.utv, sm);
    if (s.dateDev) T(x0 + 55.3, y0 + 25.8, s.dateDev, Math.min(2.5, 9.2 / Math.max(tw(s.dateDev, 1), 0.1)));
    if (s.lit) String(s.lit).slice(0, 3).split('').forEach((ch, i) => T(x0 + 137.5 + 5 * i, y0 + 27.5, ch, 3.5, 'cm'));
    // графа 26 (обозначение документа, повёрнутая) в верхнем левом углу
    if (s.code) {
      if (this.landscape) { L(f.x1, f.y2 - 14, f.x1 + 70, f.y2 - 14, 1); L(f.x1 + 70, f.y2 - 14, f.x1 + 70, f.y2, 1); T(f.x1 + 35, f.y2 - 7, s.code, 5, 'cm', 180); }
      else { L(f.x2 - 14, f.y2, f.x2 - 14, f.y2 - 70, 1); L(f.x2 - 14, f.y2 - 70, f.x2, f.y2 - 70, 1); T(f.x2 - 7, f.y2 - 35, s.code, 5, 'cm', 90); }
    }
    T(x0 + 70, 1.2, 'Копировал', sm); T(x0 + 140, 1.2, 'Формат ' + fmtName(this.fmt), sm);
    return pv;
  };
  /* зона, закрытая графой 26 (не занимать изображением) */
  S.reserved = function () {
    const f = this.frame;
    return this.landscape ? { x1: f.x1, y1: f.y2 - 14, x2: f.x1 + 70, y2: f.y2 } : { x1: f.x2 - 14, y1: f.y2 - 70, x2: f.x2, y2: f.y2 };
  };

  /* -------------------------------------------------------------- SVG */
  function toSVG(sh, o) {
    if (sh.finalize) sh.finalize();
    o = o || {};
    const k = o.px ? o.px / sh.W : 3;
    const Wp = sh.W * k, Hp = sh.H * k;
    const X = x => (x * k).toFixed(2), Y = y => ((sh.H - y) * k).toFixed(2);
    const col = o.dark ? '#e8edf0' : '#111', bg = o.dark ? '#1d2328' : '#fff';
    const sw = { 1: 0.5, 2: 0.18, 3: 0.18, 4: 0.25 };
    const dash = { 3: `${(8 * k).toFixed(1)} ${(1.5 * k).toFixed(1)} ${(1 * k).toFixed(1)} ${(1.5 * k).toFixed(1)}`, 4: `${(3 * k).toFixed(1)} ${(1.5 * k).toFixed(1)}` };
    const out = [];
    out.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${Wp.toFixed(1)} ${Hp.toFixed(1)}" width="${Wp.toFixed(0)}" height="${Hp.toFixed(0)}" font-family="'GOST 2.304 A','GOST type A','Jura','Arial Narrow',sans-serif" font-style="italic">`);
    out.push(`<rect width="100%" height="100%" fill="${bg}"/>`);
    const st = s => `stroke="${col}" stroke-width="${(sw[s] || 0.25) * k}"${dash[s] ? ` stroke-dasharray="${dash[s]}"` : ''} fill="none" stroke-linecap="round"`;
    const prims = sh.p.concat(o.preview || []);
    const byStyle = {};
    const push = (s, d) => { (byStyle[s] = byStyle[s] || []).push(d); };
    const texts = [];
    for (const q of prims) {
      if (q.t === 'L') push(q.s, `M${X(q.a[0])} ${Y(q.a[1])}L${X(q.a[2])} ${Y(q.a[3])}`);
      else if (q.t === 'H') { for (let i = 0; i < q.l.length; i += 4) push(2, `M${X(q.l[i])} ${Y(q.l[i + 1])}L${X(q.l[i + 2])} ${Y(q.l[i + 3])}`); }
      else if (q.t === 'C') push(q.s, `M${X(q.a[0] - q.a[2])} ${Y(q.a[1])}a${(q.a[2] * k).toFixed(2)} ${(q.a[2] * k).toFixed(2)} 0 1 0 ${(2 * q.a[2] * k).toFixed(2)} 0a${(q.a[2] * k).toFixed(2)} ${(q.a[2] * k).toFixed(2)} 0 1 0 ${(-2 * q.a[2] * k).toFixed(2)} 0`);
      else if (q.t === 'A') {
        const [x, y, r, a1, a2] = q.a; let da = a2 - a1; while (da <= 0) da += 360;
        const p1 = [x + r * Math.cos(a1 * D2R), y + r * Math.sin(a1 * D2R)], p2 = [x + r * Math.cos(a2 * D2R), y + r * Math.sin(a2 * D2R)];
        push(q.s, `M${X(p1[0])} ${Y(p1[1])}A${(r * k).toFixed(2)} ${(r * k).toFixed(2)} 0 ${da > 180 ? 1 : 0} 0 ${X(p2[0])} ${Y(p2[1])}`);
      } else if (q.t === 'T') texts.push(q);
    }
    for (const s of Object.keys(byStyle)) out.push(`<path ${st(+s)} d="${byStyle[s].join('')}"/>`);
    for (const q of texts) {
      const [x, y, h, ang] = q.a;
      const esc = String(q.s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
      out.push(`<text x="${X(x)}" y="${Y(y)}" font-size="${(h * k * FONT_K).toFixed(2)}" fill="${col}" textLength="${(q.w * k).toFixed(2)}" lengthAdjust="spacingAndGlyphs"${ang ? ` transform="rotate(${-ang} ${X(x)} ${Y(y)})"` : ''}>${esc}</text>`);
    }
    out.push('</svg>');
    return out.join('');
  }

  /* ---- привязка обозначений к изображению (ГОСТ 2.307, 2.309): выносные линии, стрелки выносок и знаки начинаются точно на линии детали */
  function geoOf(sh) { return sh.p.filter(q => (q.t === 'L' || q.t === 'C' || q.t === 'A') && q.g === undefined); }
  function onPrim(px, py, q, tol) {
    if (q.t === 'L') { const [x1, y1, x2, y2] = q.a, dx = x2 - x1, dy = y2 - y1, L2 = dx * dx + dy * dy; let t = L2 ? ((px - x1) * dx + (py - y1) * dy) / L2 : 0; t = Math.max(0, Math.min(1, t)); return Math.hypot(px - x1 - t * dx, py - y1 - t * dy) <= tol; }
    const d = Math.abs(Math.hypot(px - q.a[0], py - q.a[1]) - q.a[2]); if (d > tol) return false;
    if (q.t === 'C') return true;
    let a = Math.atan2(py - q.a[1], px - q.a[0]) / D2R; a = ((a % 360) + 360) % 360; const a1 = ((q.a[3] % 360) + 360) % 360, a2 = ((q.a[4] % 360) + 360) % 360;
    return a1 <= a2 ? a >= a1 - 0.3 && a <= a2 + 0.3 : a >= a1 - 0.3 || a <= a2 + 0.3;
  }
  /* параметры t пересечений луча (px,py)+t·(dx,dy) с изображением, |t| ≤ tmax */
  function rayHits(G, px, py, dx, dy, tmax) {
    const out = [];
    for (const q of G) {
      if (q.t === 'L') {
        const [x1, y1, x2, y2] = q.a, ex = x2 - x1, ey = y2 - y1, den = dx * ey - dy * ex;
        if (Math.abs(den) < 1e-9) {
          if (Math.abs((x1 - px) * dy - (y1 - py) * dx) < 1e-6) { out.push((x1 - px) * dx + (y1 - py) * dy, (x2 - px) * dx + (y2 - py) * dy); }
          continue;
        }
        const t = ((x1 - px) * ey - (y1 - py) * ex) / den, u = ((x1 - px) * dy - (y1 - py) * dx) / den;
        if (u >= -1e-6 && u <= 1 + 1e-6) out.push(t);
      } else {
        const fx = px - q.a[0], fy = py - q.a[1], b = fx * dx + fy * dy, c = fx * fx + fy * fy - q.a[2] * q.a[2]; let D = b * b - c;
        if (D < -0.02 * q.a[2]) continue; if (D < 0) D = 0;
        for (const t of [-b - Math.sqrt(D), -b + Math.sqrt(D)]) if (onPrim(px + t * dx, py + t * dy, q, 0.05)) out.push(t);
      }
    }
    return out.filter(t => Math.abs(t) <= tmax).sort((a, b) => Math.abs(a) - Math.abs(b));
  }
  /* точка на изображении вдоль направления (dx,dy) не дальше maxd; если точка уже на линии — без изменений */
  function snapPt(sh, x, y, dx, dy, maxd) {
    const G = geoOf(sh);
    if (!G.length || G.some(q => onPrim(x, y, q, 0.05))) return [x, y];
    const L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
    const h = rayHits(G, x, y, ux, uy, maxd || 3);
    if (h.length) return [x + h[0] * ux, y + h[0] * uy];
    // запасной вариант: ближайшая точка изображения в пределах maxd (скругления, малые дуги)
    let best = null, bd = Math.min(maxd || 3, 3);
    for (const q of G) {
      let px, py;
      if (q.t === 'L') { const [x1, y1, x2, y2] = q.a, ex = x2 - x1, ey = y2 - y1, L2 = ex * ex + ey * ey; let t = L2 ? ((x - x1) * ex + (y - y1) * ey) / L2 : 0; t = Math.max(0, Math.min(1, t)); px = x1 + t * ex; py = y1 + t * ey; }
      else { const d = Math.hypot(x - q.a[0], y - q.a[1]) || 1; px = q.a[0] + (x - q.a[0]) / d * q.a[2]; py = q.a[1] + (y - q.a[1]) / d * q.a[2]; if (!onPrim(px, py, q, 0.05)) continue; }
      const d = Math.hypot(px - x, py - y); if (d < bd) { bd = d; best = [px, py]; }
    }
    return best || [x, y];
  }
  /* длина участка размерной линии, совпадающего с линией контура (ГОСТ 2.307: размерная линия не совпадает с линиями контура) */
  function collLen(sh, hor, c, a, b) {
    let n = 0; if (a > b) [a, b] = [b, a];
    for (const q of geoOf(sh)) {
      if (q.t !== 'L' || q.s === 3) continue;
      const [x1, y1, x2, y2] = q.a;
      if (hor ? Math.abs(y1 - c) > 0.3 || Math.abs(y2 - c) > 0.3 : Math.abs(x1 - c) > 0.3 || Math.abs(x2 - c) > 0.3) continue;
      const u1 = hor ? Math.min(x1, x2) : Math.min(y1, y2), u2 = hor ? Math.max(x1, x2) : Math.max(y1, y2);
      n += Math.max(0, Math.min(b, u2) - Math.max(a, u1));
    }
    return n;
  }
  function dimShift(sh, hor, c, a, b, dir) {
    if (!dir) return c;
    for (let k = 0; k < 8 && collLen(sh, hor, c, a - 7, b + 7) > 1; k++) c += dir * 2;
    return c;
  }
  /* начало выносной линии: на изображении и в крайней точке контура со стороны размерной линии (выносная линия не идёт по контуру) */
  function extStart(sh, x, y, ux, uy, tlim) {
    const G = geoOf(sh);
    if (!G.length) return [x, y];
    let [px, py] = snapPt(sh, x, y, ux, uy, 4);
    if (px === x && py === y && !G.some(q => onPrim(x, y, q, 0.05))) {
      // габаритные размеры: крайняя (ближайшая к размерной линии) точка изображения на той же вертикали/горизонтали
      const lim = tlim > 0 ? tlim - 0.5 : 1e4;
      let hs = rayHits(G, x, y, ux, uy, 1e4).filter(t => t <= lim);
      if (!hs.length) for (const e of [0.25, -0.25, 0.5, -0.5]) { hs = rayHits(G, x - uy * e, y + ux * e, ux, uy, 1e4).filter(t => t <= lim); if (hs.length) { x -= uy * e; y += ux * e; break; } }
      if (hs.length) { const t = Math.max(...hs); px = x + t * ux; py = y + t * uy; }
    }
    // продолжить по коллинеарным отрезкам контура в сторону размерной линии
    for (let it = 0; it < 6; it++) {
      let best = 0;
      for (const q of G) {
        if (q.t !== 'L' || q.s === 3) continue;   // по осевой линии не продолжать: выносная от оси начинается в точке оси
        const [x1, y1, x2, y2] = q.a, ex = x2 - x1, ey = y2 - y1, l = Math.hypot(ex, ey); if (l < 1e-6) continue;
        if (Math.abs(ex * uy - ey * ux) / l > 1e-4) continue;
        if (!onPrim(px, py, q, 0.3)) continue;   // допуск — как у проверки «линия на контуре» (0,3 мм)
        best = Math.max(best, (x1 - px) * ux + (y1 - py) * uy, (x2 - px) * ux + (y2 - py) * uy);
      }
      if (best < 0.05) break;
      px += best * ux; py += best * uy;
    }
    // коллинеарный отрезок контура дальше по ходу выносной линии (до размерной линии): выносная линия не должна лечь на него —
    // начинаем её от его дальнего конца
    if (tlim > 0) {
      tlim += (x - px) * ux + (y - py) * uy;     // расстояние до размерной линии от фактического начала
      let far = 0;
      for (const q of G) {
        if (q.t !== 'L' || q.s === 3) continue;
        const [x1, y1, x2, y2] = q.a, ex = x2 - x1, ey = y2 - y1, l = Math.hypot(ex, ey); if (l < 0.5) continue;
        if (Math.abs(ex * uy - ey * ux) / l > 1e-4) continue;
        if (Math.abs((x1 - px) * uy - (y1 - py) * ux) > 0.3) continue;
        const t1 = (x1 - px) * ux + (y1 - py) * uy, t2 = (x2 - px) * ux + (y2 - py) * uy;
        if (Math.min(t1, t2) < -0.05 || Math.max(t1, t2) > tlim - 1) continue;
        far = Math.max(far, t1, t2);
      }
      if (far > 0.05) { px += far * ux; py += far * uy; }
    }
    return [r3(px), r3(py)];
  }
  /* поставить текст в первую свободную позицию из списка (без пересечения линий изображения и других надписей) */
  S.textFree = function (cands, i0) {
    let best = 0, bn = Infinity;
    const old = this.p.slice(0, i0);
    for (let i = 0; i < cands.length; i++) {
      const j = this.p.length; cands[i]();
      const n = this.conflicts(this.p.slice(j), old, false, true);
      this.p.length = j;
      if (n === 0) { cands[i](); return i; }
      if (n < bn) { bn = n; best = i; }
    }
    cands[best]();
    return -1;
  };
  S.snapPt = function (x, y, dx, dy, maxd) { return snapPt(this, x, y, dx, dy, maxd); };
  S.extStart = function (x, y, ux, uy) { return extStart(this, x, y, ux, uy); };

  /* ---- окончательная подготовка листа (ГОСТ 2.303, 2.307): центровые линии у всех окружностей, в местах надписей
   * осевые/центровые линии и штриховка прерываются. Выполняется один раз перед выводом в SVG и в КОМПАС. */
  S.finalize = function () {
    if (this._fin) return this;
    this._fin = true;
    const P = this.p;
    // центровые линии
    const G = P.filter(q => (q.t === 'L' || q.t === 'C' || q.t === 'A') && q.g === undefined);
    const axes = G.filter(q => q.t === 'L' && (q.s === 3 || q.s === 2));
    const circ = G.filter(q => q.t === 'C' && q.s === 1 && q.a[2] >= 1.2);
    const done = [];
    for (const c of circ.sort((a, b) => b.a[2] - a.a[2])) {
      const [cx, cy, R] = c.a;
      if (done.some(d => Math.hypot(d[0] - cx, d[1] - cy) < 0.3)) continue;
      done.push([cx, cy]);
      const has = dir => axes.some(q => { const [x1, y1, x2, y2] = q.a; return dir === 'h' ? Math.abs(y1 - cy) < 0.3 && Math.abs(y2 - cy) < 0.3 && Math.min(x1, x2) <= cx - R + 0.5 && Math.max(x1, x2) >= cx + R - 0.5 : Math.abs(x1 - cx) < 0.3 && Math.abs(x2 - cx) < 0.3 && Math.min(y1, y2) <= cy - R + 0.5 && Math.max(y1, y2) >= cy + R - 0.5; });
      // имеющаяся центровая линия выходит за контур меньше чем на 2 мм — удлинить до 3 мм
      if (2 * R >= 12) for (const q of axes.filter(z => z.s === 3)) {
        const [x1, y1, x2, y2] = q.a;
        if (Math.abs(y1 - cy) < 0.3 && Math.abs(y2 - cy) < 0.3 && Math.min(x1, x2) <= cx - R + 0.5 && Math.max(x1, x2) >= cx + R - 0.5) {
          if (x1 <= x2) q.a = [r3(Math.min(x1, cx - R - 3)), y1, r3(Math.max(x2, cx + R + 3)), y2]; else q.a = [r3(Math.max(x1, cx + R + 3)), y1, r3(Math.min(x2, cx - R - 3)), y2];
        } else if (Math.abs(x1 - cx) < 0.3 && Math.abs(x2 - cx) < 0.3 && Math.min(y1, y2) <= cy - R + 0.5 && Math.max(y1, y2) >= cy + R - 0.5) {
          if (y1 <= y2) q.a = [x1, r3(Math.min(y1, cy - R - 3)), x2, r3(Math.max(y2, cy + R + 3))]; else q.a = [x1, r3(Math.max(y1, cy + R + 3)), x2, r3(Math.min(y2, cy - R - 3))];
        }
      }
      const st = 2 * R >= 12 ? 3 : 2, e = 2 * R >= 12 ? 3 : 2;
      const hh = has('h'), vv = has('v');
      // обе центровые линии добавлены здесь — для КОМПАС это объект «Обозначение центра»
      const pg = !hh && !vv ? 'cm' + (++TGSEQ) : undefined, ex = pg ? { pg } : {};
      if (!hh) P.push(Object.assign({ t: 'L', a: [r3(cx - R - e), r3(cy), r3(cx + R + e), r3(cy)], s: st, auto: 1 }, ex));
      if (!vv) P.push(Object.assign({ t: 'L', a: [r3(cx), r3(cy - R - e), r3(cx), r3(cy + R + e)], s: st, auto: 1 }, ex));
      if (pg) P.push({ t: 'D', k: 'CM', a: [r3(cx), r3(cy), r3(R + e), 0], s: '', pg });
    }
    // выносные линии от осей (межосевые расстояния): осевая линия доводится до начала выносной линии
    const AX = P.filter(q => q.t === 'L' && q.s === 3 && q.g === undefined);
    for (const k of P) {
      if (k.t !== 'K' || !k.pts) continue;
      for (const [px, py] of k.pts) {
        if (G.some(q => onPrim(px, py, q, 0.05))) continue;
        for (const q of AX) {
          const [x1, y1, x2, y2] = q.a, l = Math.hypot(x2 - x1, y2 - y1); if (l < 1) continue;
          if (Math.abs((px - x1) * (y2 - y1) - (py - y1) * (x2 - x1)) / l > 0.1) continue;
          if (Math.hypot(px - x2, py - y2) < 3 && Math.hypot(px - x1, py - y1) > l) { q.a = [x1, y1, r3(px), r3(py)]; break; }
          if (Math.hypot(px - x1, py - y1) < 3 && Math.hypot(px - x2, py - y2) > l) { q.a = [r3(px), r3(py), x2, y2]; break; }
        }
      }
    }
    // лист без разрывов под надписями — для КОМПАС: там фон под текстом и размерами очищает сам КОМПАС
    // (настройка «Очистка фона»), а если её выключить, линии остаются целыми
    this._pre = P.slice();
    // разрывы осевых линий и штриховки под надписями
    const rects = P.filter(q => q.t === 'T').map(q => textRect(q, -0.8));
    const cut = (x1, y1, x2, y2) => {
      let segs = [[0, 1]];
      const dx = x2 - x1, dy = y2 - y1;
      for (const r of rects) {
        if (!segHitsRect(x1, y1, x2, y2, r)) continue;
        // параметрический интервал внутри прямоугольника
        let t0 = 0, t1 = 1; const Pp = [-dx, dx, -dy, dy], Q = [x1 - r.x1, r.x2 - x1, y1 - r.y1, r.y2 - y1]; let ok = true;
        for (let i = 0; i < 4; i++) { if (Math.abs(Pp[i]) < 1e-12) { if (Q[i] < 0) ok = false; } else { const t = Q[i] / Pp[i]; if (Pp[i] < 0) t0 = Math.max(t0, t); else t1 = Math.min(t1, t); } }
        if (!ok || t0 >= t1) continue;
        const nx = []; for (const [a, b] of segs) { if (t1 <= a || t0 >= b) { nx.push([a, b]); continue; } if (t0 > a) nx.push([a, t0]); if (t1 < b) nx.push([t1, b]); } segs = nx;
      }
      return segs.filter(([a, b]) => (b - a) * Math.hypot(dx, dy) > 0.6).map(([a, b]) => [x1 + a * dx, y1 + a * dy, x1 + b * dx, y1 + b * dy]);
    };
    const out = [];
    for (const q of P) {
      if (q.t === 'L' && q.s === 3 && q.g === undefined) { for (const sg of cut(...q.a)) out.push(Object.assign({}, q, { a: sg.map(r3) })); continue; }
      if (q.t === 'H') { const l = []; for (let i = 0; i + 3 < q.l.length; i += 4) for (const sg of cut(q.l[i], q.l[i + 1], q.l[i + 2], q.l[i + 3])) l.push(...sg.map(r3)); out.push(Object.assign({}, q, { l })); continue; }
      out.push(q);
    }
    this.p = out;
    return this;
  };
  /* ---- запись обозначений для автоматической проверки листа (drw_lint.js).
   * Каждый примитив обозначения получает номер группы g; точки, которые должны лежать на изображении детали,
   * записываются служебными примитивами 'K' (в чертёж и SVG не выводятся, сдвигаются вместе с группой). */
  let annSeq = 0;
  (function () {
    const wrapAnn = (name, ptsOf, textArg) => {
      const f = S[name];
      S[name] = function () {
        const a = arguments, i0 = this.p.length, g = ++annSeq;
        const prevAnch = this._lastAnch, stack = (this._annStack = this._annStack || []); stack.push(name); this._lastAnch = null;
        let r; try { r = f.apply(this, a); } finally { stack.pop(); }
        const inCorner = stack.includes('roughCorner');
        for (let i = i0; i < this.p.length; i++) { if (this.p[i].g === undefined) this.p[i].g = g; else if (this.p[i].og === undefined) this.p[i].og = g; }
        this.p.push({ t: 'K', k: name, g, a: [0, 0], pts: (inCorner ? [] : this._lastAnch || ptsOf.apply(null, a) || []).map(q => [r3(q[0]), r3(q[1])]), text: textArg >= 0 ? String(a[textArg] || '') : '' });
        this._lastAnch = prevAnch;
        return r;
      };
    };
    const ext = (o, k) => !(o && o[k]);
    wrapAnn('dimH', (x1, y1, x2, y2, yd, t, o) => [ext(o, 'noExt1') ? [x1, y1] : null, ext(o, 'noExt2') ? [x2, y2] : null].filter(Boolean), 5);
    wrapAnn('dimV', (x1, y1, x2, y2, xd, t, o) => [ext(o, 'noExt1') ? [x1, y1] : null, ext(o, 'noExt2') ? [x2, y2] : null].filter(Boolean), 5);
    wrapAnn('dimAng', () => [], 5);
    wrapAnn('dimAligned', (p1, p2) => [p1, p2], 5);
    wrapAnn('posMark', () => [], -1);
    wrapAnn('dimBreak', (cx, cy, r, ang) => [[cx + r * Math.cos(ang * D2R), cy + r * Math.sin(ang * D2R)]], 5);
    wrapAnn('dimHalfV', (x, y1) => [[x, y1]], 3);
    wrapAnn('leader', (x, y, sx, sy, ab, be, o) => (o && o.dot ? [] : [[x, y]]), 4);
    wrapAnn('rough', (x, y) => [[x, y]], 2);
    wrapAnn('roughLeader', (x, y) => [[x, y]], 4);
    wrapAnn('roughCorner', () => [], 0);
    wrapAnn('tol', (x, y, cells, o) => (o && o.to ? [o.to] : []), -1);
    wrapAnn('datum', (x, y) => [[x, y]], 3);
    wrapAnn('cutV', () => [], 3);
    wrapAnn('viewArrow', () => [], 3);
  })();
  /* Размеры и выноски, проставленные одним вызовом (без перебора вариантов), получают допустимые альтернативы:
     размерная линия отодвигается от изображения шагами по 7 мм (ГОСТ 2.307: не ближе 10 мм к контуру,
     7…10 мм между параллельными размерными линиями), полка выноски — дальше или в другую сторону.
     Выбор между ними — через attempt, а после заполнения листа — через repair.
     Режим «без размеров» (DRWCORE.opts.noDims): размеры и выноски с размерами не проставляются — для ручной простановки. */
  // views — какие виды строить: vo — общий вид привода (главный всегда; top, left, right, bottom, back),
  // sb — сборочный чертёж редуктора (главный всегда; second — второй вид/разрез, extra — третий вид)
  const VIEWS_DEF = { vo: { top: true, left: true, right: false, bottom: false, back: false }, sb: { second: true, extra: true } };
  const OPTS = { fmt: 'A1', noDims: false, wormFa: '3675', scaleUniform: false, views: JSON.parse(JSON.stringify(VIEWS_DEF)), VIEWS_DEF };
  /* форматы листа: выбранный в настройке (по умолчанию А1); если изображение не помещается даже в самом мелком масштабе — следующие, большие */
  const FMT_ORDER = ['A4', 'A3', 'A2', 'A1', 'A0'];
  const fmts = () => FMT_ORDER.slice(Math.max(0, FMT_ORDER.indexOf(OPTS.fmt)));
  /* подбор листа на формате меньше А1: build() строит лист по OPTS.fmt / OPTS.kMax.
     Если обозначения не легли без наложений (проверка DRWLINT), лист строится на ступень мельче,
     затем — на следующем формате; берётся лист с наименьшим числом наложений (при равенстве — первый, крупнее и меньше форматом) */
  function fitSheet(build) {
    const f0 = OPTS.fmt, L = root.DRWLINT, top = FMT_ORDER.indexOf('A1');
    const first = build();
    if (!L || FMT_ORDER.indexOf(f0) >= top) return first;
    const errs = d => { d.sh.finalize(); return L.lint(d.sh).filter(q => q.sev === 'error').length; };
    const kOf = t => (SCALE_STD.find(q => q[1] === t) || [0])[0];
    let best = first, be = first ? errs(first) : Infinity, d = first, step = 0;
    try {
      for (let n = 0; n < 12 && be > 0; n++) {
        const fi = d ? FMT_ORDER.indexOf(d.fmt) : FMT_ORDER.indexOf(OPTS.fmt);
        if (d && fi === FMT_ORDER.indexOf(OPTS.fmt) && step < 1 && kOf(d.scale)) { step++; OPTS.kMax = kOf(d.scale) - 1e-6; }
        else { if (fi >= top) break; OPTS.fmt = FMT_ORDER[fi + 1]; OPTS.kMax = undefined; step = 0; }
        d = build();
        if (!d) continue;
        const e = errs(d);
        if (e < be) { best = d; be = e; }
      }
    } finally { OPTS.fmt = f0; OPTS.kMax = undefined; }
    return best;
  }
  const DIMTXT = /⌀|^М\d|отв\.|^R\d|×45°|^\d+[,\d]*\*?$/;
  (function () {
    const dH = S.dimH, dV = S.dimV, ld = S.leader, dA = S.dimAng, dHV = S.dimHalfV;
    S.dimH = function (x1, y1, x2, y2, yd, text, o) {
      if (OPTS.noDims) return this;
      if (this._attDepth > 1 || (o && o.fixed)) return dH.apply(this, arguments);
      const sg = yd >= Math.max(y1, y2) ? 1 : yd <= Math.min(y1, y2) ? -1 : 0;
      if (!sg) return dH.apply(this, arguments);
      this.attempt([0, 7, 14, 21].map(d => () => dH.call(this, x1, y1, x2, y2, yd + sg * d, text, o)));
      return this;
    };
    S.dimV = function (x1, y1, x2, y2, xd, text, o) {
      if (OPTS.noDims) return this;
      if (this._attDepth > 1 || (o && o.fixed)) return dV.apply(this, arguments);
      const sg = xd >= Math.max(x1, x2) ? 1 : xd <= Math.min(x1, x2) ? -1 : 0;
      if (!sg) return dV.apply(this, arguments);
      this.attempt([0, 7, 14, 21].map(d => () => dV.call(this, x1, y1, x2, y2, xd + sg * d, text, o)));
      return this;
    };
    S.dimAng = function (x, y, a1, a2, R, text, o) {
      if (OPTS.noDims) return this;
      if (this._attDepth > 1) return dA.apply(this, arguments);
      this.attempt([0, 5, 10, 16].map(d => () => dA.call(this, x, y, a1, a2, R + d, text, o)));   // дуга дальше от вершины угла
      return this;
    };
    /* знак шероховатости: на поверхности, а если там тесно — на полке линии-выноски со стрелкой в ту же точку (ГОСТ 2.309) */
    const rg = S.rough;
    S.rough = function (x, y, val, o) {
      if (this._attDepth > 1 || (o && o.free) || !val) return rg.apply(this, arguments);   // и внутри перебора вызывающего кода — вложенный выбор
      const rot = ((o && o.rot) || 0) * D2R, tx = Math.cos(rot), ty = Math.sin(rot), nx = -ty, ny = tx, h = (o && o.h) || 3.5;
      const alt = [() => rg.call(this, x, y, val, o)];
      [[12, 10], [12, -10], [18, 14], [18, -14], [26, 6], [26, -6]].forEach(([n, t]) => alt.push(() => this.roughLeader(x, y, x + nx * n + tx * t, y + ny * n + ty * t, val, { h })));
      this.attempt(alt);
      return this;
    };
    /* рамка допуска формы/расположения с соединительной линией: рамку можно сдвинуть, стрелка остаётся у поверхности */
    const tl = S.tol;
    S.tol = function (x, y, cells, o) {
      if (this._attDepth > 1 || !o || !o.to || (o.via && o.via.length)) return tl.apply(this, arguments);
      let ret = null;
      this.attempt([[0, 0], [0, 10], [0, -10], [14, 0], [-14, 0], [14, 10], [-14, 10], [0, 18], [0, -18], [14, -10], [-14, -10]].map(([dx, dy]) => () => { ret = tl.call(this, x + dx, y + dy, cells, o); }));
      return ret || { w: 0, h: 7 };
    };
    /* база: при наложении — длиннее ножка (буква дальше от поверхности) */
    const dt = S.datum;
    S.datum = function (x, y, ang, letter, o) {
      if (this._attDepth > 1) return dt.apply(this, arguments);
      const L0 = (o && o.len) || 5;
      this.attempt([L0, L0 + 5, L0 + 10, L0 + 16].map(L => () => dt.call(this, x, y, ang, letter, Object.assign({}, o || {}, { len: L }))));
      return this;
    };
    S.dimHalfV = function () { return OPTS.noDims ? this : dHV.apply(this, arguments); };
    S.leader = function (x, y, sx, sy, above, below, o) {
      const isDim = DIMTXT.test(String(above || '')) || DIMTXT.test(String(below || ''));
      if (OPTS.noDims && isDim) return this;
      if (this._attDepth > 1 || (o && (o.dot || o.free))) return ld.apply(this, arguments);
      const dx = sx - x, dy = sy - y, a = arguments;
      const side = o && o.side, flip = side === 'r' ? 'l' : side === 'l' ? 'r' : side;
      this.attempt([[1, 1, side], [1.6, 1.6, side], [-1, 1, flip], [1, -1, side], [-1.6, 1.6, flip], [1.6, -1.6, side], [2.3, 2.3, side], [-2.3, 2.3, flip], [2.3, -2.3, side], [-1, -1, flip], [-2.3, -2.3, flip]].map(([kx, ky, sd]) => () => ld.call(this, x, y, x + dx * kx, y + dy * ky, above, below, Object.assign({}, o || {}, sd ? { side: sd } : {}))));
      void a;
      return this;
    };
  })();
  /* встроить шрифт ГОСТ 2.304 в SVG (для растрирования через <img>, где внешние шрифты недоступны) */
  function embedFont(svg) {
    const b = root.GOST_FONT_A_ITALIC; if (!b || /@font-face/.test(svg)) return svg;
    return svg.replace(/(<svg[^>]*>)/, `$1<style>@font-face{font-family:'GOST 2.304 A';font-style:italic;src:url(data:font/ttf;base64,${b}) format('truetype')}</style>`);
  }
  root.DRWCORE = { Sheet, View, tw, wrap, toSVG, embedFont, fmtNum, D2R, FMT, fmtName, segHitsRect, SCALE_STD, scales, scaleText, fmts, fitSheet, FMT_ORDER, opts: OPTS };
})(typeof window !== 'undefined' ? window : globalThis);
