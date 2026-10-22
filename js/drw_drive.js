/* drw_drive.js — чертёж общего вида привода (00.00.00 ВО): вид спереди, вид слева и вид сверху (план).
   Редуктор изображается по его 3D-модели (силуэт объединения корпуса, крышек подшипников, концов валов, звёздочки);
   двигатель — по размерам каталога АИР; муфта, рама, цепная передача, вал с барабаном — по расчёту. */
(function (root) {
  'use strict';
  const C = root.DRWCORE, DR = root.DRAWINGS;
  const { Sheet } = C;
  const nf = (x, d) => C.fmtNum(x, d === undefined ? 0 : d);
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const CAN = { XOY: [0, 1], XOZ: [0, 2], YOZ: [1, 2] }, NRM = { XOY: 2, XOZ: 1, YOZ: 0 };

  /* ---------- растровое объединение проекций → контур (ломаные) */
  function Raster(cell) { this.c = cell; this.rows = new Map(); }
  Raster.prototype.span = function (j, x1, x2) { // заполнить отрезок строки j
    const c = this.c; if (x2 < x1) [x1, x2] = [x2, x1];
    const i1 = Math.round(x1 / c), i2 = Math.round(x2 / c); if (i2 <= i1) return;
    const r = this.rows.get(j) || []; r.push([i1, i2]); this.rows.set(j, r);
  };
  Raster.prototype.rect = function (x1, y1, x2, y2) { if (y2 < y1) [y1, y2] = [y2, y1]; const c = this.c; for (let j = Math.round(y1 / c); j < Math.round(y2 / c); j++) this.span(j, x1, x2); };
  Raster.prototype.circle = function (cx, cy, r) { const c = this.c; for (let j = Math.round((cy - r) / c); j < Math.round((cy + r) / c); j++) { const y = (j + 0.5) * c - cy; if (Math.abs(y) >= r) continue; const w = Math.sqrt(r * r - y * y); this.span(j, cx - w, cx + w); } };
  Raster.prototype.poly = function (pts) {
    const c = this.c, ys = pts.map(p => p[1]);
    for (let j = Math.round(Math.min(...ys) / c); j < Math.round(Math.max(...ys) / c); j++) {
      const y = (j + 0.5) * c, xs = [];
      for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; if ((a[1] <= y) !== (b[1] <= y)) xs.push(a[0] + (y - a[1]) * (b[0] - a[0]) / (b[1] - a[1])); }
      xs.sort((p, q) => p - q);
      for (let i = 0; i + 1 < xs.length; i += 2) this.span(j, xs[i], xs[i + 1]);
    }
  };
  Raster.prototype.inside = function (x, y) {
    const c = this.c, r = this.rows.get(Math.floor(y / c)); if (!r) return false;
    const i = x / c; return r.some(s => i >= s[0] && i < s[1]);
  };
  /* отрезок без частей, закрытых растром (линии невидимого контура на общем виде не показываются) */
  Raster.prototype.clip = function (x1, y1, x2, y2) {
    const L = Math.hypot(x2 - x1, y2 - y1), n = Math.max(1, Math.ceil(L / (this.c / 2))), out = [];
    let a = null;
    for (let i = 0; i < n; i++) {
      const t0 = i / n, t1 = (i + 1) / n, tm = (t0 + t1) / 2, vis = !this.inside(x1 + (x2 - x1) * tm, y1 + (y2 - y1) * tm);
      if (vis && a === null) a = t0;
      if (!vis && a !== null) { out.push([a, t0]); a = null; }
    }
    if (a !== null) out.push([a, 1]);
    return out.map(([u, v]) => [x1 + (x2 - x1) * u, y1 + (y2 - y1) * u, x1 + (x2 - x1) * v, y1 + (y2 - y1) * v]);
  };
  Raster.prototype.loops = function () {
    const c = this.c, rects = [];
    this.rows.forEach((spans, j) => {
      spans.sort((a, b) => a[0] - b[0]);
      const m = []; spans.forEach(s => { const l = m[m.length - 1]; if (l && s[0] <= l[1]) l[1] = Math.max(l[1], s[1]); else m.push(s.slice()); });
      m.forEach(([i1, i2]) => rects.push({ x1: i1 * c, x2: i2 * c, y1: j * c, y2: (j + 1) * c }));
    });
    return rects.length ? root.M3D.outline(rects) : [];
  };

  /* проекция 3D-модели редуктора на вид: ex, ey — мировые векторы осей листа, ed — направление взгляда */
  function projectReducer(M, view, cell) {
    const R = new Raster(cell);
    const X = w => dot(w, view.ex) + view.ox, Y = w => dot(w, view.ey) + view.oy, SC = Math.hypot(...view.ex);
    const parts = {}; M.parts.forEach(p => { parts[p.file] = p; });
    const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    // корпус и крышка корпуса — по операциям выдавливания (вырезы на силуэт почти не влияют)
    M.parts.filter(p => p.kind === 'ops').forEach(p => p.geom.ops.filter(o => !o.cut).forEach(o => {
      const n = NRM[o.base], cc = CAN[o.base];
      const toW = (u, v, t) => { const w = [0, 0, 0]; w[cc[0]] = u; w[cc[1]] = v; w[n] = t; return w; };
      const along = Math.abs(view.ed[n]) > 0.9;
      o.loops.forEach(l => {
        if (along) {
          if (l.c) { const w = toW(l.c[0], l.c[1], 0); R.circle(X(w), Y(w), l.c[2] * SC); }
          else R.poly(l.p.map(q => { const w = toW(q[0], q[1], 0); return [X(w), Y(w)]; }));
        } else {
          // боковая проекция призмы — прямоугольник: протяжённость контура вдоль видимой оси плоскости × толщина
          const pts = l.c ? [[l.c[0] - l.c[2], l.c[1] - l.c[2]], [l.c[0] + l.c[2], l.c[1] + l.c[2]]] : l.p;
          const corners = [];
          pts.forEach(q => [o.a, o.b].forEach(t => corners.push(toW(q[0], q[1], t))));
          const xs = corners.map(X), ys = corners.map(Y);
          R.rect(Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys));
        }
      });
    }));
    // тела вращения из сборки: крышки подшипников, концы валов, колёса/звёздочки снаружи
    M.asm.items.forEach(it => {
      const p = parts[it.file]; if (!p || p.kind === 'ops') return;
      if (!['cover', 'shaft', 'sprocket'].includes(p.kind)) return;
      const ax = it.axes.slice(0, 3), b = p.bbox || root.KOMPAS.partBox(p); if (!b) return;
      const c0 = it.pos;
      if (Math.abs(dot(ax, view.ed)) > 0.9) { const w = c0.map((v, i) => v + ax[i] * (b[0] + b[3]) / 2); R.circle(X(w), Y(w), b[4] * SC); }
      else if (p.kind === 'shaft') {
        p.geom.segs.reduce((x0, s) => { const w1 = c0.map((v, i) => v + ax[i] * x0), w2 = c0.map((v, i) => v + ax[i] * (x0 + s.l)); const r = s.d / 2; const dv = cross(ax, view.ed); const off = dv.map(q => q * r); R.poly([[X(w1) + dot(off, view.ex), Y(w1) + dot(off, view.ey)], [X(w2) + dot(off, view.ex), Y(w2) + dot(off, view.ey)], [X(w2) - dot(off, view.ex), Y(w2) - dot(off, view.ey)], [X(w1) - dot(off, view.ex), Y(w1) - dot(off, view.ey)]]); return x0 + s.l; }, 0);
      } else {
        const w1 = c0.map((v, i) => v + ax[i] * b[0]), w2 = c0.map((v, i) => v + ax[i] * b[3]), r = b[4];
        const dv = cross(ax, view.ed), off = dv.map(q => q * r);
        R.poly([[X(w1) + dot(off, view.ex), Y(w1) + dot(off, view.ey)], [X(w2) + dot(off, view.ex), Y(w2) + dot(off, view.ey)], [X(w2) - dot(off, view.ex), Y(w2) - dot(off, view.ey)], [X(w1) - dot(off, view.ex), Y(w1) - dot(off, view.ey)]]);
      }
    });
    // видимые линии внутри силуэта: фланец разъёма (кромки), торцы крышек подшипников, обращённые к наблюдателю
    const det = [];
    M.parts.filter(p => p.kind === 'ops').forEach(p => p.geom.ops.filter(o => !o.cut && /фланц/.test(o.n)).forEach(o => {
      const n = NRM[o.base], cc = CAN[o.base];
      if (Math.abs(view.ed[n]) > 0.9) return;
      const toW = (u, v, t) => { const w = [0, 0, 0]; w[cc[0]] = u; w[cc[1]] = v; w[n] = t; return w; };
      o.loops.forEach(l => { const pts = l.p || []; const cs = []; pts.forEach(q => [o.a, o.b].forEach(t => cs.push(toW(q[0], q[1], t)))); if (!cs.length) return; const xs = cs.map(X), ys = cs.map(Y); const x1 = Math.min(...xs), x2 = Math.max(...xs), y1 = Math.min(...ys), y2 = Math.max(...ys); if (x2 - x1 > y2 - y1) { det.push(['L', x1, y1, x2, y1], ['L', x1, y2, x2, y2]); } else { det.push(['L', x1, y1, x1, y2], ['L', x2, y1, x2, y2]); } });
    }));
    M.asm.items.forEach(it => {
      const p = parts[it.file]; if (!p || p.kind !== 'cover') return;
      const ax = it.axes.slice(0, 3); if (Math.abs(dot(ax, view.ed)) < 0.9) return;
      const w = it.pos; det.push(['C', X(w), Y(w), p.geom.Df / 2 * Math.hypot(...view.ex)], ['C', X(w), Y(w), (p.geom.D / 2 - 6) * Math.hypot(...view.ex)]);
    });
    const loops = R.loops();
    loops.det = det;
    loops.raster = R;
    return loops;
  }

  /* ---------- компоновка привода в координатах рамы: fx — вдоль оси двигателя, fy — поперёк, fz — вверх от верха рамы */
  function layout(R, P, T) {
    const F = root.DRWFRAME.frameLayout(R, P, T); if (!F) return null;
    const M = root.KOMPAS.model3d(R, P, T, root.KOMPAS.specs(R, P, T)[0]);
    const H3 = root.M3D.housing3d(R, P, T);
    const up = H3.feet.up, zOff = F.tr - H3.feet.bottom;
    const fyAx = R.task === 1 ? [0, 0, 1] : [0, 1, 0];
    const A = root.DRWASM.asmData(R, P, T);
    const out = A.shafts[A.shafts.length - 1];
    // ориентация видов: наблюдатель главного вида — со стороны T = x × up; вид сверху (ГОСТ 2.305) — без зеркального отражения:
    // вверх на листе — от наблюдателя главного вида (−T). sT — знак fy на виде сверху (y листа = sT·fy)
    const Tv = [0, -up[2], up[1]], sig = Math.sign(dot(Tv, fyAx)) || 1, sT = -sig;
    return { F, M, H3, up, zOff, fyAx, A, out, sig, sT };
  }

  /* ---------- сцена общего вида в координатах рамы (fx, fy, fz): ящики, цилиндры, редуктор (по 3D-модели), ветви цепи */
  function driveScene(R, L, ch) {
    const { F } = L, m = R.motor || {}, cp = (R.cp && R.cp.c) || {}, o = [];
    const box = (lo, hi, st, item) => o.push({ t: 'b', lo, hi, st: st || 1, item });
    const cyl = (ax, c, a1, a2, r, st, item, inner) => { const lo = c.slice(), hi = c.slice(); for (let i = 0; i < 3; i++) { if (i === ax) { lo[i] = Math.min(a1, a2); hi[i] = Math.max(a1, a2); } else { lo[i] = c[i] - r; hi[i] = c[i] + r; } } o.push({ t: 'c', ax, c, lo, hi, r, st: st || 1, item, inner }); };
    const b2 = F.bc / 2, axZ = F.Hin + F.tr, zM0 = F.raise + F.tm;
    // рама
    [F.yL, F.yR].forEach(y => box([F.fx0, y - b2, -F.hc], [F.fx1, y + b2, 0], 1, 'frame'));
    F.cross.forEach(c => c.top ? box([c.x - b2, F.yL - b2, 0], [c.x + b2, F.yR + b2, F.hc]) : box([c.x - b2, F.yL + b2, -F.hc], [c.x + b2, F.yR - b2, 0]));
    F.padsR.forEach(p => box([p.x1, F.yL - b2, 0], [p.x2, F.yR + b2, p.t]));
    // двигатель
    const Lb = (m.l30 || 400) - (m.l1 || 80), d30 = m.d30 || 2 * (m.h || 100) * 0.95, h = m.h || 100, l31 = m.l31 || 60, l10 = m.l10 || 120, b10 = m.b10 || 160, b11 = m.b11 || b10 + 40, d1 = m.d1 || 28;
    const x0 = F.mSh, xm1 = x0 + Lb, ax = zM0 + h, y = F.axY;
    F.padsM.forEach(p => box([p.x1, y - b11 / 2 - 10, p.z0], [p.x2, y + b11 / 2 + 10, p.z0 + p.t]));
    box([x0 + l31 - 22, y - b11 / 2, zM0], [x0 + l31 + l10 + 22, y + b11 / 2, zM0 + Math.max(10, h * 0.14)]);
    cyl(0, [0, y, ax], x0, xm1 - Lb * 0.18, d30 / 2, 1, 'motor');
    cyl(0, [0, y, ax], xm1 - Lb * 0.18, xm1, d30 * 0.44);
    box([x0 + Lb * 0.25, y - d30 * 0.3, ax + d30 / 2 - 4], [x0 + Lb * 0.55, y + d30 * 0.3, zM0 + (m.h31 || h + d30 / 2 + 40)]);
    cyl(0, [0, y, ax], F.mEnd, x0, d1 / 2);
    // муфта
    const gc = F.mEnd - 2, Lc = Math.min(cp.L1 || 2 * (cp.l1 || 60), (F.mSh - F.mEnd) * 2 + 40), Dc = cp.D || 120;
    cyl(0, [0, y, axZ], gc - Lc / 2, gc - 2, Dc / 2, 1, 'coupling'); cyl(0, [0, y, axZ], gc + 2, gc + Lc / 2, Dc / 2);
    // редуктор
    o.push({ t: 'red', item: 'red' });
    // цепная передача, барабан
    const { sp, spIt, W2F } = ch || {};
    if (sp && spIt && R.chn) {
      const c1 = W2F(spIt.pos), r1 = R.chn.De1 / 2, r2 = R.chn.De2 / 2, b = sp.geom.b, a = R.chn.a, tch = R.chn.t;
      const alongFx = Math.abs(spIt.axes[0]) > 0.9, axI = alongFx ? 0 : 1;
      const aD = Math.min(a, Math.max(r1 + r2 + 70, 300));
      const c1a = [c1.fx, c1.fy, c1.fz], c2a = alongFx ? [c1.fx, c1.fy + aD, c1.fz] : [c1.fx - aD, c1.fy, c1.fz];
      cyl(axI, c1a, c1a[axI] - b / 2, c1a[axI] + b / 2, r1, 1, 'chain', [r1 - tch * 0.6]);
      cyl(axI, c2a, c2a[axI] - b / 2, c2a[axI] + b / 2, r2, 2, null, [r2 - tch * 0.6]);
      o.push({ t: 'chain', ax: axI, c1: c1a, c2: c2a, r1, r2 });
      if (R.drum && alongFx) {
        const dr = R.drum, sg = c1.fx > F.fx0 + (F.fx1 - F.fx0) / 2 ? -1 : 1, xm = c2a[0] + sg * ((dr.ak4 || 100) + dr.l4 / 2);
        cyl(0, [0, c2a[1], c2a[2]], xm - dr.Bb / 2, xm + dr.Bb / 2, dr.Db / 2, 1, 'drum');
        cyl(0, [0, c2a[1], c2a[2]], c2a[0], xm + sg * (dr.l4 / 2 + 40), dr.dv / 2);
        [xm - dr.l4 / 2, xm + dr.l4 / 2].forEach(x => box([x - 30, c2a[1] - dr.dp / 2 - 40, c2a[2] - dr.dp / 2 - 40], [x + 30, c2a[1] + dr.dp / 2 + 40, c2a[2] + dr.dp / 2 + 40]));
      }
    }
    return o;
  }

  /* основной вид по ГОСТ 2.305 в координатах рамы: оси листа (индекс оси рамы и знак), ось взгляда, сторона наблюдателя.
     sig = +1, если наблюдатель главного вида — со стороны +fy (знак T·fy) */
  function viewDef(vw, sig) {
    return {
      left: { u: [1, sig], v: [2, 1], d: 0, near: -1 }, right: { u: [1, -sig], v: [2, 1], d: 0, near: 1 },
      bottom: { u: [0, 1], v: [1, sig], d: 2, near: -1 }, back: { u: [0, -1], v: [2, 1], d: 1, near: -sig }
    }[vw];
  }

  /* вид сцены: ближние объекты закрывают дальние (растр занятых мест), круги — окружностями КОМПАС, если видны целиком */
  function genericView(L, M, scn, vw, k) {
    const { up, zOff, fyAx } = L, VD = viewDef(vw, L.sig);
    const sh = new Sheet('A1', true); sh.frame = { x1: -1e5, y1: -1e5, x2: 1e5, y2: 1e5 };
    const P = f => [VD.u[1] * f[VD.u[0]] * k, VD.v[1] * f[VD.v[0]] * k];
    const AXW = [[1, 0, 0], fyAx, up], wv = (i, s) => AXW[i].map(q => q * s * k);
    const view = { ex: wv(VD.u[0], VD.u[1]), ey: wv(VD.v[0], VD.v[1]), ed: AXW[VD.d], ox: VD.u[0] === 2 ? VD.u[1] * zOff * k : 0, oy: VD.v[0] === 2 ? VD.v[1] * zOff * k : 0 };
    const red = projectReducer(M, view, 1.2);
    // глубина редуктора — по его 3D-модели (габарит силуэтов в координатах рамы)
    const RB = L.redBox || (L.redBox = (() => {
      const bb = lp => { const xs = [], ys = []; lp.forEach(l => l.forEach(p => { xs.push(p[0]); ys.push(p[1]); })); return [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]; };
      const f = bb(projectReducer(M, { ex: [1, 0, 0], ey: up, ed: fyAx, ox: 0, oy: zOff }, 2)), t = bb(projectReducer(M, { ex: [1, 0, 0], ey: fyAx, ed: up, ox: 0, oy: 0 }, 2));
      return { lo: [f[0], t[2], f[2]], hi: [f[1], t[3], f[3]] };
    })());
    const nearOf = q => { const lo = q.t === 'red' ? RB.lo : q.lo, hi = q.t === 'red' ? RB.hi : q.hi; return VD.near > 0 ? hi[VD.d] : -lo[VD.d]; };
    const list = scn.filter(q => q.t !== 'chain').slice().sort((a, b) => nearOf(b) - nearOf(a));
    const U = new Raster(0.8), items = [];
    const seg = (x1, y1, x2, y2, st) => U.clip(x1, y1, x2, y2).forEach(q => sh.line(q[0], q[1], q[2], q[3], st));
    const circ = (cx, cy, r, st) => {
      const hid = [0, 1, 2, 3, 4, 5, 6, 7].some(i => U.inside(cx + r * Math.cos(i * Math.PI / 4), cy + r * Math.sin(i * Math.PI / 4))) || U.inside(cx, cy);
      if (!hid) { sh.circle(cx, cy, r, st); return; }
      const n = 72; for (let i = 0; i < n; i++) { const a1 = 2 * Math.PI * i / n, a2 = 2 * Math.PI * (i + 1) / n; seg(cx + r * Math.cos(a1), cy + r * Math.sin(a1), cx + r * Math.cos(a2), cy + r * Math.sin(a2), st); }
    };
    list.forEach(q => {
      let ctr;
      if (q.t === 'red') {
        red.forEach(lp => { for (let i = 0; i < lp.length; i++) { const a = lp[i], b = lp[(i + 1) % lp.length]; seg(a[0], a[1], b[0], b[1], 1); } });
        (red.det || []).forEach(d => d[0] === 'L' ? seg(d[1], d[2], d[3], d[4], 1) : circ(d[1], d[2], d[3], 1));
        if (red.length) { const xs = [], ys = []; red.forEach(l => l.forEach(p => { xs.push(p[0]); ys.push(p[1]); })); ctr = [(Math.min(...xs) + Math.max(...xs)) / 2, Math.min(...ys) + (Math.max(...ys) - Math.min(...ys)) * 0.75]; }
        red.forEach(lp => U.poly(lp));
      } else if (q.t === 'c' && q.ax === VD.d) {
        const [cx, cy] = P(q.c);
        ctr = [cx, cy + q.r * k * 0.5];
        if (!U.inside(cx, cy) || q.r * k > 3) { circ(cx, cy, q.r * k, q.st); (q.inner || []).forEach(r => circ(cx, cy, r * k, 2)); }
        U.circle(cx, cy, q.r * k);
      } else {
        const a = P(q.lo), b = P(q.hi), x1 = Math.min(a[0], b[0]), x2 = Math.max(a[0], b[0]), y1 = Math.min(a[1], b[1]), y2 = Math.max(a[1], b[1]);
        ctr = [(x1 + x2) / 2, (y1 + y2) / 2];
        [[x1, y1, x2, y1], [x2, y1, x2, y2], [x2, y2, x1, y2], [x1, y2, x1, y1]].forEach(e => seg(...e, q.st));
        U.rect(x1, y1, x2, y2);
      }
      if (q.item && ctr) items.push({ kind: q.item, pt: ctr });
    });
    // ветви цепи (поверх — тонкими линиями, где не закрыты)
    scn.filter(q => q.t === 'chain').forEach(q => {
      const p1 = P(q.c1), p2 = P(q.c2);
      if (q.ax === VD.d) {
        const d = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) || 1, nx = -(p2[1] - p1[1]) / d, ny = (p2[0] - p1[0]) / d;
        [1, -1].forEach(sg => seg(p1[0] + nx * q.r1 * k * sg, p1[1] + ny * q.r1 * k * sg, p2[0] + nx * q.r2 * k * sg, p2[1] + ny * q.r2 * k * sg, 2));
      } else if (Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) > 1) seg(p1[0], p1[1], p2[0], p2[1], 3);
    });
    return { sh, items };
  }

  function views(R, P, T, L, k) {
    const { F, M, up, zOff, fyAx, sT } = L;
    const TY = fy => sT * fy;
    const m = R.motor || {}, cp = (R.cp && R.cp.c) || {};
    const res = {};
    const mk = () => { const sh = new Sheet('A1', true); sh.frame = { x1: -1e5, y1: -1e5, x2: 1e5, y2: 1e5 }; return sh; };
    const axZ = F.Hin + F.tr;                         // высота оси входного вала над верхом рамы
    const zM0 = F.raise + F.tm;                       // опорная плоскость лап двигателя
    const items = { front: [], top: [] };
    for (const vw of ['front', 'top']) {
      const sh = mk();
      // ось листа: x = fx; y = fz (вид спереди, смотрим вдоль +fy) или −fy (вид сверху)
      const view = vw === 'front' ? { ex: [k, 0, 0], ey: up.map(v => v * k), ed: fyAx, ox: 0, oy: zOff * k } : { ex: [k, 0, 0], ey: fyAx.map(v => sT * v * k), ed: up, ox: 0, oy: 0 };
      const P2 = (fx, a) => [fx * k, a * k];          // a — fz (спереди) или −fy (сверху)
      const rect = (x1, a1, x2, a2, st) => sh.poly([P2(x1, a1), P2(x2, a1), P2(x2, a2), P2(x1, a2)], st === undefined ? 1 : st);
      // редуктор — силуэт по 3D-модели
      const sil = projectReducer(M, view, 1.2);
      sil.forEach(lp => sh.poly(lp, 1));
      (sil.det || []).forEach(q => q[0] === 'L' ? sh.line(q[1], q[2], q[3], q[4], 1) : sh.circle(q[1], q[2], q[3], 1));
      const rb = sh.bbox(0);
      items[vw].push({ kind: 'red', pt: [(rb.x1 + rb.x2) / 2, vw === 'front' ? rb.y2 - (rb.y2 - rb.y1) * 0.25 : (rb.y1 + rb.y2) / 2] });
      // рама
      const b2 = F.bc / 2;
      if (vw === 'front') {
        rect(F.fx0, -F.hc, F.fx1, 0);
        F.padsR.slice(0, 1).forEach(p => rect(p.x1, 0, p.x2, p.t));
        F.cross.filter(c => c.top).forEach(c => rect(c.x - b2, 0, c.x + b2, F.hc));
        F.padsM.forEach(p => rect(p.x1, p.z0, p.x2, p.z0 + p.t));
        items.front.push({ kind: 'frame', pt: P2((F.fx0 + F.fx1) / 2, -F.hc / 2) });
      } else {
        [F.yL, F.yR].forEach(y => rect(F.fx0, TY(y - b2), F.fx1, TY(y + b2), 2));
        F.cross.forEach(c => c.top ? rect(c.x - b2, TY(F.yL - b2), c.x + b2, TY(F.yR + b2), 2) : rect(c.x - b2, TY(F.yL + b2), c.x + b2, TY(F.yR - b2), 2));
        F.floor.forEach(h => { sh.circle(h.fx * k, TY(h.fy) * k, F.dF / 2 * k, 1); sh.line((h.fx - F.dF) * k, TY(h.fy) * k, (h.fx + F.dF) * k, TY(h.fy) * k, 3).line(h.fx * k, (TY(h.fy) - F.dF) * k, h.fx * k, (TY(h.fy) + F.dF) * k, 3); });
      }
      // двигатель
      const Lb = (m.l30 || 400) - (m.l1 || 80), d30 = m.d30 || 2 * (m.h || 100) * 0.95, h = m.h || 100, l31 = m.l31 || 60, l10 = m.l10 || 120, b10 = m.b10 || 160, b11 = m.b11 || b10 + 40, d1 = m.d1 || 28;
      const x0 = F.mSh, xm1 = x0 + Lb;
      if (vw === 'front') {
        const ax = zM0 + h;
        rect(F.mEnd, ax - d1 / 2, x0, ax + d1 / 2);                               // вал
        rect(x0, ax - d30 / 2, xm1 - Lb * 0.18, ax + d30 / 2);                   // корпус
        rect(xm1 - Lb * 0.18, ax - d30 * 0.44, xm1, ax + d30 * 0.44);             // кожух вентилятора
        rect(x0 + l31 - 22, zM0, x0 + l31 + l10 + 22, zM0 + Math.max(10, h * 0.14)); // лапы
        rect(x0 + Lb * 0.25, ax + d30 / 2, x0 + Lb * 0.55, zM0 + (m.h31 || h + d30 / 2 + 40));  // коробка выводов
        sh.line((F.mEnd - 10) * k, ax * k, (xm1 + 10) * k, ax * k, 3);
        items.front.push({ kind: 'motor', pt: P2(x0 + Lb * 0.6, ax) });
      } else {
        const y = TY(F.axY);
        rect(F.mEnd, y - d1 / 2, x0, y + d1 / 2);
        rect(x0, y - d30 / 2, xm1 - Lb * 0.18, y + d30 / 2);
        rect(xm1 - Lb * 0.18, y - d30 * 0.44, xm1, y + d30 * 0.44);
        rect(x0 + l31 - 22, y - b11 / 2, x0 + l31 + l10 + 22, y + b11 / 2);
        F.motHoles.forEach(q => sh.circle(q.fx * k, TY(q.fy) * k, F.dMot / 2 * k, 1));
        rect(x0 + Lb * 0.25, y - d30 * 0.3, x0 + Lb * 0.55, y + d30 * 0.3);
        sh.line((F.mEnd - 10) * k, y * k, (xm1 + 10) * k, y * k, 3);
        items.top.push({ kind: 'motor', pt: P2(x0 + Lb * 0.7, y) });
      }
      // муфта — между концами валов
      const gc = F.mEnd - 2, Lc = Math.min(cp.L1 || 2 * (cp.l1 || 60), (F.mSh - F.mEnd) * 2 + 40), Dc = cp.D || 120;
      const ac = vw === 'front' ? axZ : TY(F.axY);
      rect(gc - Lc / 2, ac - Dc / 2, gc - 2, ac + Dc / 2); rect(gc + 2, ac - Dc / 2, gc + Lc / 2, ac + Dc / 2);
      items[vw].push({ kind: 'coupling', pt: P2(gc + Lc / 4, ac + Dc * 0.3) });
      res[vw] = { sh, view };
    }
    // цепная передача / выходной вал
    const out = L.out, sp = M.parts.find(p => p.kind === 'sprocket'), spIt = sp && M.asm.items.find(i => i.file === sp.file);
    const W2F = w => ({ fx: w[0], fy: dot(w, fyAx), fz: dot(w, up) + zOff });
    if (sp && spIt && R.chn) {
      const c1 = W2F(spIt.pos.map((v, i) => v + spIt.axes[i] * 0)), r1 = R.chn.De1 / 2, r2 = R.chn.De2 / 2, a = R.chn.a, b = sp.geom.b;
      const axv = spIt.axes.slice(0, 3);
      const alongFx = Math.abs(axv[0]) > 0.9;
      // ведомая звёздочка: задание 6 — на валу барабана (поперёк рамы), задание 3 — к кантователю (вдоль рамы, от двигателя)
      // межосевое расстояние цепи велико — изображение с разрывом, размер — действительный
      const aD = Math.min(a, Math.max(r1 + r2 + 70, 300)), broken = aD < a - 1;
      const c2 = alongFx ? { fx: c1.fx, fy: c1.fy + aD, fz: c1.fz } : { fx: c1.fx - aD, fy: c1.fy, fz: c1.fz };
      const draw = (vw) => {
        const sh = res[vw].sh;
        const pt = q => vw === 'front' ? [q.fx * k, q.fz * k] : [q.fx * k, TY(q.fy) * k];
        const seesFace = vw === 'front' ? !alongFx : false;
        const behind = vw === 'front' && alongFx;   // ведомая звёздочка за редуктором — на виде спереди не показывается
        if (seesFace) {
          [[c1, r1, 1], [c2, r2, 2]].forEach(([c, r, st]) => { const p = pt(c); sh.circle(p[0], p[1], r * k, st); sh.circle(p[0], p[1], (r - R.chn.t * 0.6) * k, 2); });
          const p1 = pt(c1), p2 = pt(c2), d = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) || 1, nx = -(p2[1] - p1[1]) / d, ny = (p2[0] - p1[0]) / d;
          [1, -1].forEach(s => sh.line(p1[0] + nx * r1 * k * s, p1[1] + ny * r1 * k * s, p2[0] + nx * r2 * k * s, p2[1] + ny * r2 * k * s, 2));
        } else {
          // вид сбоку звёздочек — прямоугольники толщиной b
          [[c1, r1, 1], [c2, r2, 2]].filter((q, i) => !(behind && i === 1)).forEach(([c, r, st]) => {
            const p = pt(c);
            if (vw === 'front') sh.poly([[p[0] - b / 2 * k, p[1] - r * k], [p[0] + b / 2 * k, p[1] - r * k], [p[0] + b / 2 * k, p[1] + r * k], [p[0] - b / 2 * k, p[1] + r * k]], st);
            else if (alongFx) sh.poly([[p[0] - b / 2 * k, p[1] - r * k], [p[0] + b / 2 * k, p[1] - r * k], [p[0] + b / 2 * k, p[1] + r * k], [p[0] - b / 2 * k, p[1] + r * k]], st);
            else sh.poly([[p[0] - r * k, p[1] - b / 2 * k], [p[0] + r * k, p[1] - b / 2 * k], [p[0] + r * k, p[1] + b / 2 * k], [p[0] - r * k, p[1] + b / 2 * k]], st);
          });
          const p1 = pt(c1), p2 = pt(c2);
          if (!behind) sh.line(p1[0], p1[1], p2[0], p2[1], 3);
        }
        const q1 = pt(c1), q2 = pt(c2);
        if (broken && !behind) { const mx = (q1[0] + q2[0]) / 2, my = (q1[1] + q2[1]) / 2, dx = q2[0] - q1[0], dy = q2[1] - q1[1], d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d, nx = -uy, ny = ux, L0 = 10; [-2.5, 2.5].forEach(o => sh.poly([[mx + ux * o - nx * L0, my + uy * o - ny * L0], [mx + ux * o + nx * L0 * 0.1, my + uy * o + ny * L0 * 0.1 - 0], [mx + ux * o - nx * L0 * 0.1 + ux * 2, my + uy * o - ny * L0 * 0.1 + uy * 2], [mx + ux * o + nx * L0, my + uy * o + ny * L0]], 2, false)); }
        if (vw === 'top' || seesFace) sh.attempt([1, -1].map(sg => () => { const off = (Math.max(r1, r2) + 14) * k * sg; return Math.abs(q2[0] - q1[0]) > Math.abs(q2[1] - q1[1]) ? sh.dimH(q1[0], q1[1], q2[0], q2[1], q1[1] + off, nf(a) + (broken ? '' : '')) : sh.dimV(q1[0], q1[1], q2[0], q2[1], q1[0] + off, nf(a)); }));
        items[vw].push({ kind: 'chain', pt: [(pt(c1)[0] + pt(c2)[0]) / 2, (pt(c1)[1] + pt(c2)[1]) / 2 + (seesFace ? (r1 + r2) / 2 * k : 0)] });
      };
      draw('front'); draw('top');
      // вал конвейера с барабаном (задание 6)
      if (R.drum && alongFx) {
        const dr = R.drum, Lw = dr.l4 + 2 * 60, D = dr.Db, B = dr.Bb;
        ['top'].forEach(vw => {
          const sh = res[vw].sh, st = 1;
          const ctr = { fx: c2.fx, fy: c2.fy, fz: c2.fz };
          const pt = q => vw === 'front' ? [q.fx * k, q.fz * k] : [q.fx * k, TY(q.fy) * k];
          const p = pt(ctr), sg = c1.fx > F.fx0 + (F.fx1 - F.fx0) / 2 ? -1 : 1;   // барабан — в сторону от звёздочки
          const xm = p[0] + sg * (dr.ak4 || 100) * k + sg * dr.l4 / 2 * k;
          const yA = vw === 'front' ? p[1] : p[1];
          sh.poly([[xm - B / 2 * k, yA - D / 2 * k], [xm + B / 2 * k, yA - D / 2 * k], [xm + B / 2 * k, yA + D / 2 * k], [xm - B / 2 * k, yA + D / 2 * k]], st);
          sh.line(Math.min(p[0], xm - sg * Lw / 2 * k) - 6, yA, Math.max(p[0], xm + sg * Lw / 2 * k) + 6, yA, 3);
          [xm - dr.l4 / 2 * k, xm + dr.l4 / 2 * k].forEach(x => sh.poly([[x - 30 * k, yA - (dr.dp / 2 + 40) * k], [x + 30 * k, yA - (dr.dp / 2 + 40) * k], [x + 30 * k, yA + (dr.dp / 2 + 40) * k], [x - 30 * k, yA + (dr.dp / 2 + 40) * k]], st));
          sh.poly([[p[0], yA - dr.dv / 2 * k], [xm + sg * (dr.l4 / 2 + 40) * k, yA - dr.dv / 2 * k], [xm + sg * (dr.l4 / 2 + 40) * k, yA + dr.dv / 2 * k], [p[0], yA + dr.dv / 2 * k]], st);
          items[vw].push({ kind: 'drum', pt: [xm, yA + D / 4 * k] });
        });
      }
    }
    // ---- остальные основные виды (ГОСТ 2.305): слева, справа, снизу, сзади — по сцене из ящиков и цилиндров
    //      с удалением невидимых линий; какие строить — настройка DRWCORE.opts.views.vo
    const VO = (C.opts.views && C.opts.views.vo) || {};
    const want = ['left', 'right', 'bottom', 'back'].filter(v => VO[v]);
    if (want.length) {
      const scn = driveScene(R, L, { sp, spIt, W2F });
      want.forEach(vw => { const g = genericView(L, M, scn, vw, k); res[vw] = { sh: g.sh }; items[vw] = g.items; });
    }
    // выходной вал задания 1 — к ведущей звёздочке подвесного конвейера
    if (R.task === 1) {
      const o = L.out, top = o.pos.map((v, i) => v + o.ax[i] * o.segs[o.segs.length - 1].x1);
      const q = W2F(top), sh = res.front.sh;
      sh.leader(q.fx * k, q.fz * k - 2, q.fx * k + 20, q.fz * k + 14, 'к звёздочке', 'конвейера');
    }
    return { res, items, axZ, zM0 };
  }

  /* общая сборка листа общего вида: виды → размеры → позиции → техтребования и характеристика → раскладка на А1.
     build.views(k) → { res: { front: { sh }, top: { sh } }, items }, build.dims(V, k) — размеры на видах */
  function compose(R, P, T, drvSpec, build, meta) {
    const findPos = re => { let p = ''; drvSpec.sections.forEach(sc => sc.items.forEach(it => { if (!p && it.pos && re.test(it.name)) p = it.pos; })); return p; };
    const POS = { red: findPos(/^Редуктор/), frame: findPos(/^Рама/), drum: findPos(/барабан/), motor: findPos(/Электродвигатель/), coupling: findPos(/Муфта/), chain: findPos(/^Цепь/) };
    const K = R.K || {};
    const last = R.task === 6 ? { T: K.TIII, n: K.nIII } : R.task === 3 ? { T: K.TII, n: K.nII } : { T: K.T2T, n: K.n2T };
    const tech = [`1. Мощность электродвигателя ${nf((R.motor || {}).P, 1)} кВт, частота вращения ${nf((R.motor || {}).n)} мин⁻¹.`, `2. Электродвигатель ${(R.motor || {}).type || ''}.`,
      `3. Вращающий момент на выходном валу ${nf(last.T || 0, 1)} Н·м, частота вращения ${nf(last.n || 0, 1)} мин⁻¹.`, `4. Общее передаточное число привода ${nf((R.motor && last.n) ? R.motor.n / last.n : 0, 2)}.`];
    const req = ['1. *Размеры для справок.', `2. Смещение осей валов электродвигателя и редуктора не более ${R.cp && R.cp.c ? nf(R.cp.c.dr, 1) : '0,3'} мм, перекос — не более ${R.cp && R.cp.c ? R.cp.c.da : '1°'}.`,
      ...(R.chn ? [`3. Звёздочки цепной передачи установить в одной плоскости; отклонение — не более 0,2 мм на 100 мм межосевого расстояния. Стрела провисания цепи ${nf(0.02 * R.chn.a, 0)} мм.`] : []),
      `${R.chn ? 4 : 3}. Ограждения муфты${R.chn ? ' и цепной передачи' : ''} условно не показаны.`, `${R.chn ? 5 : 4}. Раму крепить к полу фундаментными болтами М${(R.H && R.H.d1) || 16}.`];
    // много видов на А1 не помещаются в крупном масштабе — тогда А0 (ГОСТ 2.301), и только потом 1:10
    const PLAN = [[0.4, '1:2,5', 'A1'], [0.25, '1:4', 'A1'], [0.2, '1:5', 'A1'], [0.25, '1:4', 'A0'], [0.2, '1:5', 'A0'], [0.1, '1:10', 'A1']];
    for (const [k, kt, fmt] of PLAN) for (const land of [true, false]) {
      const V = build.views(k);
      const VO = (meta.id === 'obshiy_vid' && C.opts.views && C.opts.views.vo) || { top: true };
      if (VO.top === false) delete V.res.top;
      const fr = V.res.front.sh, tp = V.res.top && V.res.top.sh;
      build.dims(V, k);
      // позиции: каждая — один раз, на первом виде, где деталь видна (главный, сверху, слева, справа, снизу, сзади)
      const usedPos = new Set();
      ['front', 'top', 'left', 'right', 'bottom', 'back'].forEach(vw => {
        if (!V.res[vw] || !V.items[vw]) return;
        const list = V.items[vw].map(it => Object.assign({ pos: POS[it.kind] || '' }, it)).filter(it => it.pos && !usedPos.has(it.pos) && usedPos.add(it.pos));
        if (list.length) root.DRWASM.positions(V.res[vw].sh, list);
      });
      if (build.post) build.post(V, k);
      const sh = new Sheet(fmt, land), f = sh.frame;
      sh.occupy(sh.stamp, 2); sh.occupy(sh.reserved(), 2);
      const W = 185, hT = (arr) => { let n = 0; arr.forEach(t => { n += C.wrap(String(t), W - 8, 3.5).length; }); return n * 3.5 * 1.65; };
      let y0 = sh.stamp.y2 + 8;
      sh.notes(sh.stamp.x1 + 2, y0, W - 4, req, { title: 'Технические требования' }); const rq = { x1: sh.stamp.x1, y1: y0 - 2, x2: f.x2 - 2, y2: y0 + hT(req) + 9 }; sh.occupy(rq, 2);
      y0 = rq.y2 + 8;
      sh.notes(sh.stamp.x1 + 2, y0, W - 4, tech, { title: 'Техническая характеристика' }); sh.occupy({ x1: sh.stamp.x1, y1: y0 - 2, x2: f.x2 - 2, y2: y0 + hT(tech) + 9 }, 2);
      // расположение видов по ГОСТ 2.305: сверху — под главным, снизу — над ним, слева — справа от главного,
      // справа — слева от него, сзади — правее вида слева; все в проекционной связи
      const G = vw => V.res[vw] && V.res[vw].sh, BX = vw => G(vw) ? G(vw).bbox(0) : null, Wd = b => b ? b.x2 - b.x1 : 0, H = b => b ? b.y2 - b.y1 : 0;
      const fb = fr.bbox(0), tb = BX('top'), bb = BX('bottom'), rb = BX('right');
      const sL = Math.max(0, tb ? fb.x1 - tb.x1 : 0, bb ? fb.x1 - bb.x1 : 0) + (rb ? Wd(rb) + 20 : 0);
      const p1 = DR.placeGroup(sh, fr.p, { near: [f.x1 + 15 + sL + Wd(fb) / 2, f.y2 - 15 - (bb ? H(bb) + 12 : 0) - H(fb) / 2] });
      if (!p1) continue;
      let ok = true, xr = p1.box.x2;
      if (tb && !DR.placeGroup(sh, G('top').p, { fixX: p1.dx, near: [0, p1.box.y1 - 12 - H(tb) / 2] })) ok = false;
      if (ok && bb && !DR.placeGroup(sh, G('bottom').p, { fixX: p1.dx, near: [0, p1.box.y2 + 12 + H(bb) / 2] })) ok = false;
      if (ok && G('left')) { const lb = BX('left'), q = DR.placeGroup(sh, G('left').p, { fixY: p1.dy, near: [p1.box.x2 + 20 + Wd(lb) / 2, 0] }); if (!q) ok = false; else xr = q.box.x2; }
      if (ok && rb && !DR.placeGroup(sh, G('right').p, { fixY: p1.dy, near: [p1.box.x1 - 20 - Wd(rb) / 2, 0] })) ok = false;
      if (ok && G('back')) { const kb = BX('back'); if (!DR.placeGroup(sh, G('back').p, { fixY: p1.dy, near: [xr + 20 + Wd(kb) / 2, 0] })) ok = false; }
      if (!ok) continue;
      return { id: meta.id, file: meta.file, name: (root.DATA.TASKS[P.task] || {}).title || 'Привод', nameSub: meta.nameSub, scale: kt, fmt, landscape: land, sh };
    }
    return null;
  }

  function driveSheet(R, P, T, drvSpec) {
    const L = layout(R, P, T); if (!L) return null;
    const { F, sT } = L, TY = fy => sT * fy;
    return compose(R, P, T, drvSpec, { views: k => views(R, P, T, L, k), dims: (V, k) => {
      const fr = V.res.front.sh, tp = V.res.top && V.res.top.sh;
      {
        const b = fr.geoBox();
        fr.dimH(b.x1, b.y1, b.x2, b.y1, b.y1 - 14, nf((b.x2 - b.x1) / k) + '*');
        fr.dimV(b.x2, b.y1, b.x2, b.y2, b.x2 + 14, nf((b.y2 - b.y1) / k) + '*');
        fr.dimV(F.fx0 * k, -F.hc * k, F.fx0 * k, V.axZ * k, F.fx0 * k - 12, nf(V.axZ + F.hc));
      }
      if (tp) {
        const b = tp.geoBox();
        tp.dimV(b.x1, b.y1, b.x1, b.y2, b.x1 - 14, nf((b.y2 - b.y1) / k) + '*');
        const fl = F.floor.slice().sort((p, q) => p.fx - q.fx || p.fy - q.fy);
        const xs = [...new Set(fl.map(h => Math.round(h.fx)))];
        const yB = TY(F.yR) < TY(F.yL) ? F.yR : F.yL;     // швеллер, что ниже на листе — размер под видом
        tp.dimH(xs[0] * k, TY(yB) * k, xs[xs.length - 1] * k, TY(yB) * k, Math.min(b.y1, (TY(yB) - F.bc / 2) * k) - 12, nf(xs[xs.length - 1] - xs[0]));
        tp.dimV(xs[xs.length - 1] * k, TY(F.yL) * k, xs[xs.length - 1] * k, TY(F.yR) * k, b.x2 + 12, nf(F.yR - F.yL));
        const h = fl[0];
        tp.attempt([[-14, 14], [-14, -14], [14, -14]].map(([dx, dy]) => () => tp.leader(h.fx * k + Math.sign(dx) * F.dF / 2 * k * 0.7, TY(h.fy) * k + Math.sign(dy) * F.dF / 2 * k * 0.7, h.fx * k + dx, TY(h.fy) * k + dy, `⌀${F.dF}`, `${F.floor.length} отв.`, { side: dx > 0 ? 'r' : 'l' })));
        if (R.chn) { /* межосевое расстояние цепной передачи */ }
      }
      // виды слева/справа — габарит по ширине (справочный)
      ['left', 'right'].forEach(vw => { if (!V.res[vw]) return; const sd = V.res[vw].sh, b = sd.geoBox(); sd.dimH(b.x1, b.y1, b.x2, b.y1, b.y1 - 14, nf((b.x2 - b.x1) / k) + '*'); });
    } }, { id: 'obshiy_vid', file: 'privod_VO.cdw', nameSub: 'Чертёж общего вида' });
  }

  root.DRWDRIVE = { driveSheet, compose, projectReducer, Raster };
})(typeof window !== 'undefined' ? window : globalThis);
