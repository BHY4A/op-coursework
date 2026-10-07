/* drw_core.js — движок чертежа: лист (мм, ось Y вверх), примитивы, оформление по ЕСКД, вывод в SVG.
   Примитивы потом без изменений передаются макросу КОМПАС (отрезок, окружность, дуга, текст). */
(function (root) {
  'use strict';
  const D2R = Math.PI / 180;
  const FONT_K = 1122 / 714;   // кегль шрифта ГОСТ 2.304 тип А по высоте прописной h (cap height 714 из 1122 ед.)
  const FMT = { A4: [210, 297], A3: [420, 297], A2: [594, 420], A1: [841, 594] };
  const r3 = x => Math.round(x * 1000) / 1000;
  const fmtNum = (x, dig) => { if (x === undefined || x === null || isNaN(x)) return ''; const k = Math.pow(10, dig === undefined ? 2 : dig); return String(Math.round(x * k) / k).replace('.', ','); };

  /* ширина текста шрифтом «ГОСТ тип А» (оценка, мм) */
  function tw(s, h) {
    let w = 0;
    for (const c of String(s)) {
      if (c === ' ') w += 0.38;
      else if (/[.,:;'!|]/.test(c)) w += 0.28;
      else if (/[()\[\]\-−]/.test(c)) w += 0.36;
      else if (/[0-9]/.test(c)) w += 0.52;
      else if (/[A-ZА-ЯЁ⌀×±°√]/.test(c)) w += /[ШЩЖМЮФШWM]/.test(c) ? 0.78 : 0.6;
      else if (/[шщжмюфыwm]/.test(c)) w += 0.66;
      else w += 0.5;
    }
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
      let q = P(0, 0); this.text(q[0], q[1], dv.base, { h, ang });
      if (dv.up !== undefined && dv.lo !== undefined) { q = P(wb + 0.4, h * 0.55); this.text(q[0], q[1], dv.up, { h: h * 0.7, ang }); q = P(wb + 0.4, -h * 0.15); this.text(q[0], q[1], dv.lo, { h: h * 0.7, ang }); }
      else if (dv.up !== undefined) { q = P(wb + 0.4, h * 0.45); this.text(q[0], q[1], dv.up, { h: h * 0.7, ang }); }
      else { q = P(wb + 0.4, -h * 0.1); this.text(q[0], q[1], dv.lo, { h: h * 0.7, ang }); }
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
  S.conflicts = function (added, old, stopAt1, withAxes) {
    const f = this.frame;
    let n = 0;
    const T = added.filter(q => q.t === 'T').map(q => textRect(q, -0.7));
    const OT = old.filter(q => q.t === 'T').map(q => textRect(q, 0));
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
    // линии обозначений не должны лежать на линиях изображения (ГОСТ 2.307)
    const GL = OL.filter(q => q.g === undefined);
    for (const q of added) if (q.t === 'L' && q.s !== 3 && collOv(q.a, GL) > 1.5) { n += 2; if (stopAt1) return n; }
    // размерные линии разных размеров не совпадают
    const DL = old.filter(q => q.t === 'L' && q.dl);
    if (DL.length) for (const q of added) if (q.t === 'L' && q.dl && collOv(q.a, DL) > 0.5) { n += 3; if (stopAt1) return n; }
    return n;
  };
  /* попробовать варианты: первый без наложений; иначе — вариант с наименьшим числом наложений */
  S.attempt = function (fns, o) {
    o = o || {};
    let best = 0, bn = Infinity;
    for (let i = 0; i < fns.length; i++) {
      const i0 = this.p.length;
      fns[i]();
      const added = this.p.slice(i0);
      const n = this.conflicts(added, this.p.slice(0, i0));
      this.p.length = i0;
      if (n === 0) { fns[i](); return i; }
      if (n < bn) { bn = n; best = i; }
    }
    fns[best]();
    return -1;
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
    if (lines.length) this.p.push({ t: 'H', l: lines, rings: rings.map(r => r.map(p => [r3(p[0]), r3(p[1])])) });
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
    if (!o.noExt1 && Math.abs(yd - y1) > 0.5) this.line(x1, y1 + (up ? up * (o.gap || 0) : 0), x1, yd + (up || (yd > y1 ? 1 : -1)) * EXT, 2);
    if (!o.noExt2 && Math.abs(yd - y2) > 0.5) this.line(x2, y2 + (up ? up * (o.gap || 0) : 0), x2, yd + (up || (yd > y2 ? 1 : -1)) * EXT, 2);
    const inside = len >= 2 * AR + 2;
    const fits = len >= w + 2 * AR + 2;
    let tx = (x1 + x2) / 2, anchor = 'cb';
    if (o.textX !== undefined) { tx = o.textX; anchor = 'lb'; }
    if (inside) {
      this.line(x1, yd, x2, yd, 2); this.p[this.p.length - 1].dl = 1; this.arrow(x1, yd, 180); this.arrow(x2, yd, 0);
      if (o.out === 'left' || o.out === 'right') {
        const ds = []; for (let d = 0; d <= 120; d += 2.5) ds.push(d);
        const fn = d => o.out === 'left' ? () => { this.line(x1 - d - w - 3, yd, x1, yd, 2); this.text(x1 - 1.5 - d, yd + 0.9, text, { h, anchor: 'rb' }); }
          : () => { this.line(x2, yd, x2 + d + w + 3, yd, 2); this.text(x2 + 1.5 + d, yd + 0.9, text, { h, anchor: 'lb' }); };
        this.textFree(ds.map(fn), i0);
        return this;
      }
      if (!fits && o.textX === undefined) { this.textFree(outH(this, x1, x2, yd, 0, text, h, w, o.side === 'left'), i0); return this; }
    } else {
      const ext = 7;
      this.line(x1 - ext, yd, x2 + ext, yd, 2); this.p[this.p.length - 1].dl = 1; this.arrow(x1, yd, 0); this.arrow(x2, yd, 180);
      if (o.textX === undefined) {
        // малый размер: текст над размерной линией между выносными (если помещается по высоте ряда) или на продолжении линии
        this.textFree(outH(this, x1, x2, yd, ext, text, h, w, o.side === 'left'), i0); return this;
      }
    }
    if (inside && fits && o.textX === undefined) {
      const span = (len - w - 2 * AR - 1) / 2, step = Math.max(1.5, span / 6), ds = [0];
      for (let k = 1; k * step <= span + 1e-9; k++) ds.push(k * step, -k * step);
      this.textFree(ds.map(d => () => this.text(tx + d, yd + 0.9, text, { h, anchor })), i0);
    } else this.text(tx, yd + 0.9, text, { h, anchor });
    return this;
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
    if (!o.noExt1 && Math.abs(xd - x1) > 0.5) this.line(x1, y1, xd + (rt || (xd > x1 ? 1 : -1)) * EXT, y1, 2);
    if (!o.noExt2 && Math.abs(xd - x2) > 0.5) this.line(x2, y2, xd + (rt || (xd > x2 ? 1 : -1)) * EXT, y2, 2);
    const inside = len >= 2 * AR + 2, fits = len >= w + 2 * AR + 2;
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
        return this;
      } else if (!fits && o.textY === undefined) { this.textFree(outV(this, xd, y1, y2, 0, text, h, w, o.side === 'below'), i0); return this; }
    } else {
      const ext = 7;
      this.line(xd, y1 - ext, xd, y2 + ext, 2); this.p[this.p.length - 1].dl = 1; this.arrow(xd, y1, 90); this.arrow(xd, y2, 270);
      if (o.textY === undefined) { this.textFree(outV(this, xd, y1, y2, ext, text, h, w, o.side === 'below'), i0); return this; }
    }
    if (inside && fits && o.textY === undefined && !o.out) {
      const span = (len - w - 2 * AR - 1) / 2, step = Math.max(1.5, span / 6), ds = [0];
      for (let k = 1; k * step <= span + 1e-9; k++) ds.push(k * step, -k * step);
      this.textFree(ds.map(d => () => this.text(xd - 0.9, ty + d, text, { h, anchor, ang: 90 })), i0);
    } else this.text(xd - 0.9, ty, text, { h, anchor, ang: 90 });
    return this;
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
    return this;
  };
  /* угловой размер: вершина (x, y), лучи a1→a2 (против часовой), радиус дуги R */
  S.dimAng = function (x, y, a1, a2, R, text, o) {
    o = o || {};
    this.arc(x, y, R, a1, a2, 2);
    this.arrow(x + R * Math.cos(a1 * D2R), y + R * Math.sin(a1 * D2R), a1 - 90);
    this.arrow(x + R * Math.cos(a2 * D2R), y + R * Math.sin(a2 * D2R), a2 + 90);
    const am = (a1 + a2) / 2, tx = x + (R + 1.5) * Math.cos(am * D2R), ty = y + (R + 1.5) * Math.sin(am * D2R);
    this.text(tx, ty, text, { h: o.h || 3.5, anchor: Math.cos(am * D2R) >= 0 ? 'lm' : 'rm' });
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
    this.rough(tipx, tipy, val, { h, free: true });
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
    this.text(bx, by, letter, { h: 3.5, anchor: 'cm' });
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
    return this;
  };
  /* стрелка взгляда для вида «А» */
  S.viewArrow = function (x, y, ang, letter) {
    const c = Math.cos(ang * D2R), s = Math.sin(ang * D2R);
    this.line(x - c * 12, y - s * 12, x, y, 2); this.arrow(x, y, ang, 4, 1.4);
    this.text(x - c * 7 - s * 3, y - s * 7 + c * 3, letter, { h: 7, anchor: 'cb' });
    return this;
  };
  S.title = function (x, y, str, o) { this.text(x, y, str, Object.assign({ h: 7, anchor: 'cb' }, o || {})); return this; };

  /* -------------------------------------------------------------- таблицы и текст */
  S.table = function (x, ytop, colW, rows, o) {
    o = o || {};
    const h = o.h || 3.5, rh = o.rowH || 8, W = colW.reduce((a, b) => a + b, 0);
    let y = ytop;
    const heights = rows.map(r => (r.h || rh));
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
        });
        xx += colW[ci];
      });
      y -= hh;
    });
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
    if (o.title) { this.text(x + width / 2, y + lh + 1, o.title, { h, anchor: 'cb' }); }
    lines.forEach(l => { this.text(l.x, y, l.s, { h }); y -= lh; });
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
    L(x0 + 135, y0 + 15, x0 + 135, y0 + 40, 1); L(x0 + 135, y0 + 35, st.x2, y0 + 35, 1); L(x0 + 135, y0 + 20, st.x2, y0 + 20, 1);
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
    if (s.org) T(x0 + 160, y0 + 7.5, s.org, 5, 'cm');
    if (s.mass) T(x0 + 158.5, y0 + 27.5, s.mass, 3.5, 'cm');
    if (s.scale) T(x0 + 176, y0 + 27.5, s.scale, 3.5, 'cm');
    if (s.student) T(x0 + 17.6, y0 + 25.8, s.student, sm);
    if (s.teacher) T(x0 + 17.6, y0 + 20.8, s.teacher, sm);
    if (s.normo) T(x0 + 17.6, y0 + 5.8, s.normo, sm);
    // графа 26 (обозначение документа, повёрнутая) в верхнем левом углу
    if (s.code) {
      if (this.landscape) { L(f.x1, f.y2 - 14, f.x1 + 70, f.y2 - 14, 1); L(f.x1 + 70, f.y2 - 14, f.x1 + 70, f.y2, 1); T(f.x1 + 35, f.y2 - 7, s.code, 5, 'cm', 180); }
      else { L(f.x2 - 14, f.y2, f.x2 - 14, f.y2 - 70, 1); L(f.x2 - 14, f.y2 - 70, f.x2, f.y2 - 70, 1); T(f.x2 - 7, f.y2 - 35, s.code, 5, 'cm', 90); }
    }
    T(x0 + 70, 1.2, 'Копировал', sm); T(x0 + 140, 1.2, 'Формат ' + this.fmt.replace('A', 'А'), sm);
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
        if (q.t !== 'L') continue;
        const [x1, y1, x2, y2] = q.a, ex = x2 - x1, ey = y2 - y1, l = Math.hypot(ex, ey); if (l < 1e-6) continue;
        if (Math.abs(ex * uy - ey * ux) / l > 1e-4) continue;
        if (!onPrim(px, py, q, 0.05)) continue;
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
        if (Math.abs((x1 - px) * uy - (y1 - py) * ux) > 0.05) continue;
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
      if (!has('h')) P.push({ t: 'L', a: [r3(cx - R - e), r3(cy), r3(cx + R + e), r3(cy)], s: st, auto: 1 });
      if (!has('v')) P.push({ t: 'L', a: [r3(cx), r3(cy - R - e), r3(cx), r3(cy + R + e)], s: st, auto: 1 });
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
        for (let i = i0; i < this.p.length; i++) if (this.p[i].g === undefined) this.p[i].g = g;
        this.p.push({ t: 'K', k: name, g, a: [0, 0], pts: (inCorner ? [] : this._lastAnch || ptsOf.apply(null, a) || []).map(q => [r3(q[0]), r3(q[1])]), text: textArg >= 0 ? String(a[textArg] || '') : '' });
        this._lastAnch = prevAnch;
        return r;
      };
    };
    const ext = (o, k) => !(o && o[k]);
    wrapAnn('dimH', (x1, y1, x2, y2, yd, t, o) => [ext(o, 'noExt1') ? [x1, y1] : null, ext(o, 'noExt2') ? [x2, y2] : null].filter(Boolean), 5);
    wrapAnn('dimV', (x1, y1, x2, y2, xd, t, o) => [ext(o, 'noExt1') ? [x1, y1] : null, ext(o, 'noExt2') ? [x2, y2] : null].filter(Boolean), 5);
    wrapAnn('dimAng', () => [], 5);
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
  /* встроить шрифт ГОСТ 2.304 в SVG (для растрирования через <img>, где внешние шрифты недоступны) */
  function embedFont(svg) {
    const b = root.GOST_FONT_A_ITALIC; if (!b || /@font-face/.test(svg)) return svg;
    return svg.replace(/(<svg[^>]*>)/, `$1<style>@font-face{font-family:'GOST 2.304 A';font-style:italic;src:url(data:font/ttf;base64,${b}) format('truetype')}</style>`);
  }
  root.DRWCORE = { Sheet, View, tw, wrap, toSVG, embedFont, fmtNum, D2R, FMT };
})(typeof window !== 'undefined' ? window : globalThis);
