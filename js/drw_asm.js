/* drw_asm.js — сборочный чертёж редуктора (А1): разрез по плоскости осей валов и вид сбоку.
   Геометрия берётся из 3D-компоновки (KOMPAS.model): валы, колёса, подшипники; корпус строится объединением
   прямоугольников (стенки, бобышки, стакан) с вычитанием расточек. */
(function (root) {
  'use strict';
  const C = root.DRWCORE, DR = root.DRAWINGS;
  const { Sheet, tw } = C;
  const D2R = Math.PI / 180;
  const nf = (x, d) => C.fmtNum(x, d === undefined ? 1 : d);
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

  /* ---------------------------------------------------------------- исходные данные сборки */
  function asmData(R, P, T) {
    const M = root.KOMPAS.model(R, P, T || {});
    const brg = [R.b1, R.b2, R.b3];
    const shafts = [], wheels = [], sprockets = [];
    let si = 0;
    const keyOf = joint => (R.keys || []).find(k => k.joint === joint);
    for (const it of M.asm.items) {
      const pd = M.parts.find(p => p.file === it.file);
      if (!pd) continue;
      const ax = it.axes.slice(0, 3);
      if (pd.kind === 'shaft') shafts.push({ pd, pos: it.pos, ax, segs: DR.prepSegsPublic(pd), b: brg[si++] });
      else if (pd.kind === 'housing') continue;
      else if (pd.kind === 'sprocket') { sprockets.push({ pd, pos: it.pos, ax: it.axes.slice(0, 3), g: pd.geom }); continue; }
      else wheels.push({ pd, pos: it.pos, ax, g: pd.geom, kind: pd.kind });
    }
    void keyOf;
    return { M, shafts, wheels, sprockets };
  }

  /* ---------------------------------------------------------------- объединение прямоугольников на сетке */
  function RectSet() { this.ops = []; }
  RectSet.prototype.add = function (r) { if (r.x2 - r.x1 > 0.01 && r.y2 - r.y1 > 0.01) this.ops.push([1, r]); return this; };
  RectSet.prototype.sub = function (r) { if (r.x2 - r.x1 > 0.01 && r.y2 - r.y1 > 0.01) this.ops.push([0, r]); return this; };
  RectSet.prototype.solve = function () {
    const xs = new Set(), ys = new Set();
    this.ops.forEach(([, r]) => { xs.add(+r.x1.toFixed(3)); xs.add(+r.x2.toFixed(3)); ys.add(+r.y1.toFixed(3)); ys.add(+r.y2.toFixed(3)); });
    const X = [...xs].sort((a, b) => a - b), Y = [...ys].sort((a, b) => a - b);
    const nx = X.length - 1, ny = Y.length - 1;
    const cell = new Uint8Array(Math.max(nx * ny, 0));
    for (const [op, r] of this.ops) {
      const i1 = X.indexOf(+r.x1.toFixed(3)), i2 = X.indexOf(+r.x2.toFixed(3)), j1 = Y.indexOf(+r.y1.toFixed(3)), j2 = Y.indexOf(+r.y2.toFixed(3));
      for (let i = i1; i < i2; i++) for (let j = j1; j < j2; j++) cell[i * ny + j] = op;
    }
    const filled = (i, j) => i >= 0 && j >= 0 && i < nx && j < ny && cell[i * ny + j] === 1;
    // контур: границы заполненных клеток, слитые в отрезки
    const edges = [];
    for (let j = 0; j <= ny; j++) { let st = null; for (let i = 0; i <= nx; i++) { const e = i < nx && filled(i, j) !== filled(i, j - 1); if (e && st === null) st = i; if (!e && st !== null) { edges.push([X[st], Y[j], X[i], Y[j]]); st = null; } } }
    for (let i = 0; i <= nx; i++) { let st = null; for (let j = 0; j <= ny; j++) { const e = j < ny && filled(i, j) !== filled(i - 1, j); if (e && st === null) st = j; if (!e && st !== null) { edges.push([X[i], Y[st], X[i], Y[j]]); st = null; } } }
    // прямоугольники для штриховки: слияние по строкам
    const rects = [];
    for (let j = 0; j < ny; j++) { let st = null; for (let i = 0; i <= nx; i++) { const f = i < nx && filled(i, j); if (f && st === null) st = i; if (!f && st !== null) { rects.push({ x1: X[st], x2: X[i], y1: Y[j], y2: Y[j + 1] }); st = null; } } }
    return { edges, rects };
  }

  /* ---------------------------------------------------------------- разрез по осям валов */
  function bearingPlaces(sh) {
    const L = sh.segs[sh.segs.length - 1].x1, W = sh.b ? (sh.b.T || sh.b.B) : 15;
    const gearX = (() => { const gs = sh.segs.filter(s => s.gear || s.role === 'hub'); if (!gs.length) return L / 2; return gs.reduce((a, s) => a + (s.x0 + s.x1) / 2, 0) / gs.length; })();
    const out = [];
    sh.segs.forEach(s => {
      if (s.role !== 'bearing') return;
      const left = (s.x0 + s.x1) / 2 < gearX;
      const a = left ? s.x0 : s.x1 - W, b = a + W;
      out.push({ seg: s, a, b, left, sleeve: s.l > W + 1 ? (left ? [b, s.x1] : [s.x0, a]) : null });
    });
    return out;
  }

  /* section(view) — строит главный разрез в координатах модели (мм), возвращает группы примитивов на «черновом» листе */
  function sectionView(A, R, view, k, opt) {
    opt = opt || {};
    const sh = new Sheet('A1', true); sh.frame = { x1: -1e5, y1: -1e5, x2: 1e5, y2: 1e5 };
    const U = view.u, V = view.v, N = view.n;
    const prj = p => [dot(p, U) * k, dot(p, V) * k];
    const H = R.H || {};
    const dks = H.dks || 8, del = H.del || 8, gap = H.gap || 10;
    const items = [];       // объекты для позиций и размеров
    // валы в плоскости
    const inPlane = A.shafts.filter(s => Math.abs(dot(s.ax, N)) < 0.1).map(s => {
      const o = prj(s.pos), d = [dot(s.ax, U), dot(s.ax, V)];
      const n2 = [-d[1], d[0]];
      const P = (x, r) => [o[0] + (x * d[0] + r * n2[0]) * k, o[1] + (x * d[1] + r * n2[1]) * k];
      return Object.assign({}, s, { o, d, n2, P, horiz: Math.abs(d[0]) > 0.5, places: bearingPlaces(s) });
    });
    const endOn = A.shafts.filter(s => Math.abs(dot(s.ax, N)) >= 0.9);
    const wheelsIn = A.wheels.filter(w => Math.abs(dot(w.ax, N)) < 0.1).map(w => {
      const o = prj(w.pos), d = [dot(w.ax, U), dot(w.ax, V)], n2 = [-d[1], d[0]];
      return Object.assign({}, w, { o, d, n2, P: (x, r) => [o[0] + (x * d[0] + r * n2[0]) * k, o[1] + (x * d[1] + r * n2[1]) * k] });
    });
    const wheelsEnd = A.wheels.filter(w => Math.abs(dot(w.ax, N)) >= 0.9);
    const box = (pts) => { const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]); return { x1: Math.min(...xs), y1: Math.min(...ys), x2: Math.max(...xs), y2: Math.max(...ys) }; };
    const union = (a, b) => a ? { x1: Math.min(a.x1, b.x1), y1: Math.min(a.y1, b.y1), x2: Math.max(a.x2, b.x2), y2: Math.max(a.y2, b.y2) } : b;
    // ---------- вращающиеся детали: габарит
    let rot = null;
    wheelsIn.forEach(w => {
      let pr = DR.wheelProfile(Object.assign({}, w.g, { noHoles: true }), w.kind);
      if (w.kind === 'bevel') {
        // ступица — по центру посадочной ступени, вершина делительного конуса — в сторону шестерни (к оси вала-шестерни)
        const xc = (pr.x0 + pr.x1) / 2;
        const toPin = (() => { const sI = A.shafts.find(s => s.segs.some(g => g.gear && g.gear.kind === 'bevel')); if (!sI) return 1; const t = (dot(sI.pos, w.ax) - dot(w.pos, w.ax)); return t >= 0 ? 1 : -1; })();
        const f = x => toPin * (x - xc) * -1;
        const mp = pc => pc.map(([x, y]) => [f(x), y]);
        pr = Object.assign({}, pr, { pieces: pr.pieces.map(mp), x0: Math.min(f(pr.x0), f(pr.x1)), x1: Math.max(f(pr.x0), f(pr.x1)) });
      }
      const pts = []; pr.pieces.forEach(pc => pc.forEach(([x, y]) => { pts.push(w.P(x, y), w.P(x, -y)); })); w.prof = pr; w.bb = box(pts); rot = union(rot, w.bb); w.rb = w.bb;
    });
    inPlane.forEach(s => s.segs.forEach(sg => { if (sg.gear) { const rr = sg.gear.kind === 'bevel' ? sg.gear.da / 2 : sg.r; rot = union(rot, box([s.P(sg.x0, rr), s.P(sg.x1, -rr)])); } }));
    const endPts = [];
    wheelsEnd.forEach(w => { const c = prj(w.pos), ra = (w.g.daM || w.g.da || w.g.dae) / 2 * k; endPts.push([c[0] - ra, c[1] - ra], [c[0] + ra, c[1] + ra]); });
    endOn.forEach(s => { const c = prj(s.pos); endPts.push(c); });
    if (endPts.length) rot = union(rot, box(endPts));
    // ---------- полость корпуса: объединение габаритов колёс и полос между подшипниками каждого вала
    const G = gap * k, Dl = del * k;
    const rotBoxes = [];
    wheelsIn.forEach(w => rotBoxes.push(w.bb));
    inPlane.forEach(s => s.segs.forEach(sg => { if (sg.gear) { const rr = sg.gear.kind === 'bevel' ? sg.gear.da / 2 : sg.r; rotBoxes.push(box([s.P(sg.x0, rr), s.P(sg.x1, -rr)])); } }));
    wheelsEnd.forEach(w => { const c = prj(w.pos), ra = (w.g.daM || w.g.da || w.g.dae) / 2 * k; rotBoxes.push({ x1: c[0] - ra, y1: c[1] - ra, x2: c[0] + ra, y2: c[1] + ra }); });
    endOn.forEach(s => { const c = prj(s.pos), g = s.segs.find(q => q.gear) || s.segs[0], r = (g.gear ? g.gear.da / 2 : g.r) * k; rotBoxes.push({ x1: c[0] - r, y1: c[1] - r, x2: c[0] + r, y2: c[1] + r }); });
    const cavs = rotBoxes.map(b => ({ x1: b.x1 - G, y1: b.y1 - G, x2: b.x2 + G, y2: b.y2 + G }));
    const cav0 = cavs.reduce((a, b) => union(a, b), null);
    inPlane.forEach(s => {
      const pl = s.places.map(p => ({ a: s.P(p.a, 0), b: s.P(p.b, 0), p }));
      const c = s.horiz ? 0 : 1, lo = s.horiz ? 'x1' : 'y1', hi = s.horiz ? 'x2' : 'y2';
      const inner = pl.map(q => { const v1 = q.a[c], v2 = q.b[c]; return { lo: Math.min(v1, v2), hi: Math.max(v1, v2), q }; });
      const beyondHi = inner.filter(q => q.lo >= cav0[hi] - 1), beyondLo = inner.filter(q => q.hi <= cav0[lo] + 1);
      s.cartridge = (beyondHi.length === inner.length && inner.length > 0) ? 'hi' : (beyondLo.length === inner.length && inner.length > 0) ? 'lo' : '';
      s.inner = inner;
      if (s.cartridge || inner.length < 2) return;
      const sorted = inner.slice().sort((a, b) => a.lo - b.lo);
      s.wlo = sorted[0].hi; s.whi = sorted[sorted.length - 1].lo;
      const ax = s.o[1 - c];
      const rMax = Math.max(...s.segs.map(g => g.r)) * k + G;
      cavs.push(c === 0 ? { x1: s.wlo, x2: s.whi, y1: ax - rMax, y2: ax + rMax } : { y1: s.wlo, y2: s.whi, x1: ax - rMax, x2: ax + rMax });
    });
    // стенки шире полости на δ; для параллельных валов (задания 3, 6) полость — прямоугольник, у вала-шестерни (задание 1) — ступенчатая
    let cav = cavs.reduce((a, b) => union(a, b), null);
    if (R.task !== 1) { cavs.length = 0; cavs.push(Object.assign({}, cav)); }
    const RS = new RectSet();
    cavs.forEach(cv => RS.add({ x1: cv.x1 - Dl, y1: cv.y1 - Dl, x2: cv.x2 + Dl, y2: cv.y2 + Dl }));
    cavs.forEach(cv => RS.sub(cv));
    // дополнительные элементы корпуса в плоскости разреза (фланец горизонтального разъёма у редуктора с вертикальными валами)
    if (opt.extra && opt.extra.length) { opt.extra.forEach(r => RS.add(r)); cavs.forEach(cv => RS.sub(cv)); }
    const bores = [], covers = [], bosses = [];
    const coverDepth = 8 * k, flT = 9 * k;
    const cavAlong = (s, side) => { // граница полости вдоль оси вала на его линии
      const c = s.horiz ? 0 : 1, ax = s.o[1 - c];
      const hit = cavs.filter(cv => c === 0 ? (cv.y1 <= ax && cv.y2 >= ax) : (cv.x1 <= ax && cv.x2 >= ax));
      const arr = hit.length ? hit : cavs;
      return side > 0 ? Math.max(...arr.map(cv => c === 0 ? cv.x2 : cv.y2)) : Math.min(...arr.map(cv => c === 0 ? cv.x1 : cv.y1));
    };
    const pend = [];
    inPlane.forEach(s => {
      const D = (s.b ? s.b.D : 2 * s.segs[0].r + 30) / 2 * k;
      const bossR = D + (2.1 * dks + 6) * k;
      const c = s.horiz ? 0 : 1, ax = s.o[1 - c];
      if (s.cartridge) {
        const qs = s.inner;
        const far = s.cartridge === 'hi' ? Math.max(...qs.map(q => q.hi)) + coverDepth : Math.min(...qs.map(q => q.lo)) - coverDepth;
        const near = cavAlong(s, s.cartridge === 'hi' ? 1 : -1);
        const t1 = Math.min(near, far), t2 = Math.max(near, far);
        const tube = c === 0 ? { x1: t1, x2: t2, y1: ax - D - Dl * 1.2, y2: ax + D + Dl * 1.2 } : { y1: t1, y2: t2, x1: ax - D - Dl * 1.2, x2: ax + D + Dl * 1.2 };
        RS.add(tube);
        const fl = c === 0 ? { x1: s.cartridge === 'hi' ? far - flT : far, x2: s.cartridge === 'hi' ? far : far + flT, y1: ax - bossR, y2: ax + bossR } : { y1: s.cartridge === 'hi' ? far - flT : far, y2: s.cartridge === 'hi' ? far : far + flT, x1: ax - bossR, x2: ax + bossR };
        RS.add(fl); s.tubeFl = fl;
        bores.push(c === 0 ? { x1: t1 - Dl * 2, x2: t2 + 0.01, y1: ax - D, y2: ax + D } : { y1: t1 - Dl * 2, y2: t2 + 0.01, x1: ax - D, x2: ax + D });
        const outerQ = s.cartridge === 'hi' ? qs.reduce((a, b) => a.hi > b.hi ? a : b) : qs.reduce((a, b) => a.lo < b.lo ? a : b);
        covers.push({ s, q: outerQ.q.p, face: far, dir: s.cartridge === 'hi' ? 1 : -1, D, bossR });
        s.tube = tube;
        return;
      }
      s.inner.forEach(q => {
        const outerSide = (q.lo + q.hi) / 2 < ((s.wlo + s.whi) / 2) ? -1 : 1;
        const face = outerSide < 0 ? q.lo - coverDepth : q.hi + coverDepth;
        const wallIn = outerSide < 0 ? s.wlo : s.whi;
        pend.push({ s, q, c, ax, D, bossR, outerSide, face, wallIn });
      });
    });
    // торцы соседних приливов на одной стенке — в одной плоскости (обрабатываются за один проход, и крышка
    // одного вала не упирается в выступающий прилив соседнего); недостающее расстояние до подшипника
    // выбирает удлинённый центрирующий поясок крышки (ext)
    pend.forEach(a => { a.face0 = a.face; });
    // крышка не должна садиться ниже соседней, более высокой стенки (уступ полости): торец прилива — не ниже её
    pend.forEach(a => cavs.forEach(cv => {
      const lo = (a.c === 0 ? cv.y1 : cv.x1) - Dl, hi = (a.c === 0 ? cv.y2 : cv.x2) + Dl;
      if (hi <= a.ax - a.bossR || lo >= a.ax + a.bossR) return;
      const ext = a.outerSide > 0 ? (a.c === 0 ? cv.x2 : cv.y2) + Dl : (a.c === 0 ? cv.x1 : cv.y1) - Dl;
      if (a.outerSide > 0 ? ext > a.face : ext < a.face) a.face = ext;
    }));
    for (let it = 0; it < 3; it++) pend.forEach(a => pend.forEach(b => {
      if (a === b || a.c !== b.c || a.outerSide !== b.outerSide || Math.abs(a.wallIn - b.wallIn) > 40 * k) return;
      if (Math.abs(a.ax - b.ax) > a.bossR + b.bossR + 4 * k) return;
      const f = a.outerSide < 0 ? Math.min(a.face, b.face) : Math.max(a.face, b.face);
      a.face = f; b.face = f;
    }));
    pend.forEach(({ s, q, c, ax, D, bossR, outerSide, face, face0, wallIn }) => {
      const t1 = Math.min(face, wallIn), t2 = Math.max(face, wallIn);
      const bossRect = c === 0 ? { x1: t1, x2: t2, y1: ax - bossR, y2: ax + bossR } : { y1: t1, y2: t2, x1: ax - bossR, x2: ax + bossR };
      RS.add(bossRect);
      bosses.push({ s, rect: bossRect, ax, c, D, bossR, wallIn, face });
      bores.push(c === 0 ? { x1: t1 - 1, x2: t2 + 1, y1: ax - D, y2: ax + D } : { y1: t1 - 1, y2: t2 + 1, x1: ax - D, x2: ax + D });
      covers.push({ s, q: q.q.p, face, dir: outerSide, D, bossR, ext: Math.abs(face - face0) / k });
    });
    bores.forEach(b => RS.sub(b));
    const hs = RS.solve();
    // штриховка корпуса
    const hatchOf = (st) => ({ ang: st.ang, step: st.step });
    const hK = { ang: 45, step: 4 };
    if (opt.model) {
      // корпус — сечение 3D-модели (основание и крышка — разные детали: штриховка в разные стороны)
      const sc = L => L.map(lp => lp.map(([x, y]) => [x * k, y * k]));
      const b = sc(opt.model.base), c = sc(opt.model.cover);
      if (b.length) sh.hatch(b, hK);
      if (c.length) sh.hatch(c, { ang: 135, step: 4 });
      b.concat(c).forEach(lp => sh.poly(lp, 1));
    } else if (opt.split === undefined) hs.rects.forEach(r => sh.hatch([[[r.x1, r.y1], [r.x2, r.y1], [r.x2, r.y2], [r.x1, r.y2]]], hK));
    else {
      // корпус и крышка корпуса — разные детали: штриховка в разные стороны, линия разъёма
      const ysp = opt.split;
      hs.rects.forEach(r => {
        if (r.y1 < ysp - 0.01) sh.hatch([[[r.x1, r.y1], [r.x2, r.y1], [r.x2, Math.min(r.y2, ysp)], [r.x1, Math.min(r.y2, ysp)]]], hK);
        if (r.y2 > ysp + 0.01) sh.hatch([[[r.x1, Math.max(r.y1, ysp)], [r.x2, Math.max(r.y1, ysp)], [r.x2, r.y2], [r.x1, r.y2]]], { ang: 135, step: 4 });
        if (r.y1 < ysp - 0.01 && r.y2 > ysp + 0.01) sh.line(r.x1, ysp, r.x2, ysp, 1);
      });
    }
    let housingBox;
    if (opt.model) {
      const all = opt.model.base.concat(opt.model.cover).flat();
      housingBox = { x1: Math.min(...all.map(p => p[0])) * k, y1: Math.min(...all.map(p => p[1])) * k, x2: Math.max(...all.map(p => p[0])) * k, y2: Math.max(...all.map(p => p[1])) * k };
      const pb = innerPoint(opt.model.base), pc = innerPoint(opt.model.cover);
      if (pb) items.push({ kind: 'housing', pt: [pb[0] * k, pb[1] * k] });
      if (pc) items.push({ kind: 'lid', pt: [pc[0] * k, pc[1] * k] });
    } else {
      hs.edges.forEach(e => sh.line(e[0], e[1], e[2], e[3], 1));
      housingBox = (() => { let b = null; hs.rects.forEach(r => { b = union(b, r); }); return b; })();
      if (opt.split !== undefined) {
        // основание и крышка корпуса — по разные стороны плоскости разъёма
        const lo = hs.rects.filter(q => q.y2 <= opt.split + 0.01 && (q.x2 - q.x1) > 4 && (q.y2 - q.y1) > 4), hi = hs.rects.filter(q => q.y1 >= opt.split - 0.01 && (q.x2 - q.x1) > 4 && (q.y2 - q.y1) > 4);
        const big = arr => arr.reduce((a, q) => !a || (q.x2 - q.x1) * (q.y2 - q.y1) > (a.x2 - a.x1) * (a.y2 - a.y1) ? q : a, null);
        const rb = big(lo) || hs.rects[0], rc = big(hi);
        items.push({ kind: 'housing', pt: [(rb.x1 + rb.x2) / 2, (rb.y1 + rb.y2) / 2] });
        if (rc) items.push({ kind: 'lid', pt: [(rc.x1 + rc.x2) / 2, (rc.y1 + rc.y2) / 2] });
      } else items.push({ kind: 'housing', pt: (() => { const r = hs.rects.find(q => (q.x2 - q.x1) > 6 && (q.y2 - q.y1) > 4) || hs.rects[0]; return [(r.x1 + r.x2) / 2, (r.y1 + r.y2) / 2]; })() });
    }
    // ---------- фланец основания (видимый контур под плоскостью разъёма) и болты
    const K2 = (H.K2 || 34) * k, K = (H.K || 24) * k;
    const flg = { x1: housingBox.x1 - K * 0.15, y1: housingBox.y1 - K * 0.15, x2: housingBox.x2 + K * 0.15, y2: housingBox.y2 + K * 0.15 };
    void K2;
    // ---------- валы
    const hatchSeq = [{ ang: 135, step: 2.5 }, { ang: 45, step: 2 }, { ang: 135, step: 3 }, { ang: 45, step: 3.5 }, { ang: 135, step: 1.8 }];
    let hs_i = 0;
    inPlane.forEach(s => {
      const P = s.P;
      // контур вала (не рассекается)
      for (const sg of [1, -1]) s.segs.forEach(g => {
        if (g.gear && g.gear.kind === 'bevel') return;
        const p1 = P(g.x0 + g.cL, sg * g.r), p2 = P(g.x1 - g.cR, sg * g.r); sh.line(p1[0], p1[1], p2[0], p2[1], 1);
        if (g.cL) { const a = P(g.x0, sg * (g.r - g.cL)); sh.line(a[0], a[1], p1[0], p1[1], 1); }
        if (g.cR) { const a = P(g.x1, sg * (g.r - g.cR)); sh.line(p2[0], p2[1], a[0], a[1], 1); }
      });
      s.segs.forEach((g, i) => {
        const pv = s.segs[i - 1];
        if (g.gear && g.gear.kind === 'bevel') {
          const gg = g.gear, dl = gg.delta * D2R, Re = gg.d / 2 / Math.sin(dl), Rae = gg.da / 2, Rai = Rae * (Re - gg.b) / Re;
          for (const sgn of [1, -1]) { const a = P(g.x0, sgn * Rai), b = P(g.x1, sgn * Rae); sh.line(a[0], a[1], b[0], b[1], 1); }
          const a = P(g.x0, -Rai), b = P(g.x0, Rai); sh.line(a[0], a[1], b[0], b[1], 1);
          const c = P(g.x1, -Rae), d = P(g.x1, Rae); sh.line(c[0], c[1], d[0], d[1], 1);
          return;
        }
        const rl = pv && !(pv.gear && pv.gear.kind === 'bevel') ? Math.max(pv.r - (pv.cR || 0), g.r - g.cL) : g.r - g.cL;
        const a = P(g.x0, -rl), b = P(g.x0, rl); sh.line(a[0], a[1], b[0], b[1], 1);
        if (g.gear) { for (const sgn of [1, -1]) { const p1 = P(g.x0 - 2, sgn * g.gear.d / 2), p2 = P(g.x1 + 2, sgn * g.gear.d / 2); sh.line(p1[0], p1[1], p2[0], p2[1], 3); if (g.gear.kind === 'worm') { const q1 = P(g.x0 + 2, sgn * g.gear.df / 2), q2 = P(g.x1 - 2, sgn * g.gear.df / 2); sh.line(q1[0], q1[1], q2[0], q2[1], 2); } } }
      });
      const last = s.segs[s.segs.length - 1], L = last.x1;
      { const a = P(L, -(last.r - last.cR)), b = P(L, last.r - last.cR); sh.line(a[0], a[1], b[0], b[1], 1); }
      { const a = P(-6, 0), b = P(L + 6, 0); sh.line(a[0], a[1], b[0], b[1], 3); }
      items.push({ kind: 'shaft', s, pt: P(s.segs.reduce((a, g) => (g.role === 'free' || g.role === 'collar') && g.l > a.l ? g : a, s.segs[0]).x0 + 3, s.segs[0].r * 0.4) });
      // подшипники, втулки
      s.places.forEach(pl => {
        const d = pl.seg.r, b = s.b || { D: 2 * d + 30, kind: 'ball' };
        const Dh = b.D / 2, W = pl.b - pl.a;
        drawBearing(sh, P, pl.a, pl.b, d, Dh, b.kind, pl.left, k);
        items.push({ kind: 'bearing', s, pt: P((pl.a + pl.b) / 2, (d + Dh) / 2 + (Dh - d) * 0.32) });
        if (pl.sleeve) {
          const t = Math.max(3, (Dh - d) * 0.32);
          const ring = [P(pl.sleeve[0], d), P(pl.sleeve[1], d), P(pl.sleeve[1], d + t), P(pl.sleeve[0], d + t)];
          const ring2 = [P(pl.sleeve[0], -d), P(pl.sleeve[1], -d), P(pl.sleeve[1], -d - t), P(pl.sleeve[0], -d - t)];
          sh.poly(ring, 1); sh.poly(ring2, 1);
          sh.hatch([ring, ring2], { ang: 45, step: 1.5 });
          items.push({ kind: 'sleeve', s, pt: [(ring[0][0] + ring[2][0]) / 2, (ring[0][1] + ring[2][1]) / 2] });
        }
        void W;
      });
      // шпонки в ступицах (видны в разрезе ступицы)
      s.segs.forEach(g => {
        if (!g.key || g.role !== 'hub') return;
        const xc = (g.x0 + g.x1) / 2, kd = g.key;
        const pts = [P(xc - kd.l / 2, g.r - kd.t1 * 0 ), P(xc + kd.l / 2, g.r), P(xc + kd.l / 2, g.r + kd.h - kd.t1), P(xc - kd.l / 2, g.r + kd.h - kd.t1)];
        sh.poly(pts, 1);
        items.push({ kind: 'key', s, kd, pt: [(pts[0][0] + pts[2][0]) / 2, (pts[0][1] + pts[2][1]) / 2] });
      });
      // шпонка на выходном конце (под муфту) — вид на шпонку в пазу; под звёздочкой — в её разрезе
      const sprOn = (A.sprockets || []).some(q => { const w = [0, 1, 2].map(i => q.pos[i] - s.pos[i]), al = dot(w, s.ax); return Math.hypot(w[0] - al * s.ax[0], w[1] - al * s.ax[1], w[2] - al * s.ax[2]) < 1; });
      s.segs.forEach(g => {
        if (!g.key || g.role !== 'out' || sprOn) return;
        const kd = g.key, xc = (g.x0 + g.x1) / 2, a = xc - kd.l / 2, b = xc + kd.l / 2, rr = kd.b / 2, ang = Math.atan2(s.d[1], s.d[0]) / D2R;
        const p1 = s.P(a + rr, rr), p2 = s.P(b - rr, rr), p3 = s.P(a + rr, -rr), p4 = s.P(b - rr, -rr), cb = s.P(b - rr, 0), ca = s.P(a + rr, 0);
        sh.line(p1[0], p1[1], p2[0], p2[1], 1).line(p3[0], p3[1], p4[0], p4[1], 1);
        sh.arc(cb[0], cb[1], rr * k, ang - 90, ang + 90, 1); sh.arc(ca[0], ca[1], rr * k, ang + 90, ang + 270, 1);
        items.push({ kind: 'key', s, kd, pt: s.P(xc, 0) });
      });
      void hatchOf;
    });
    // ---------- звёздочка на выходном конце (разрез): ступица, диск, зубья до De; шпонка в ступице
    (A.sprockets || []).filter(q => Math.abs(dot(q.ax, N)) < 0.1).forEach(q => {
      const g = q.g, o = prj(q.pos), d = [dot(q.ax, U), dot(q.ax, V)], n2 = [-d[1], d[0]];
      const Pq = (x, r) => [o[0] + (x * d[0] + r * n2[0]) * k, o[1] + (x * d[1] + r * n2[1]) * k];
      const hl = (g.lst || g.b) / 2, hb = g.b / 2, rb = g.dbore / 2, rs = g.dst / 2, rf = g.dd / 2 - (g.d1 || 10) / 2, re = (g.De || g.dd) / 2;
      [1, -1].forEach(sg => {
        const prof = [Pq(-hl, sg * rb), Pq(hl, sg * rb), Pq(hl, sg * rs), Pq(hb, sg * rs), Pq(hb, sg * rf), Pq(-hb, sg * rf), Pq(-hb, sg * rs), Pq(-hl, sg * rs)];
        sh.poly(prof, 1); sh.hatch([prof], { ang: sg > 0 ? 45 : 45, step: 2.2 });
        sh.poly([Pq(-hb, sg * rf), Pq(-hb * 0.8, sg * re), Pq(hb * 0.8, sg * re), Pq(hb, sg * rf)], 1, false);
        const a = Pq(-hb - 3, sg * g.dd / 2), b = Pq(hb + 3, sg * g.dd / 2); sh.line(a[0], a[1], b[0], b[1], 3);
      });
      if (g.key) { const kd = g.key, pts = [Pq(-kd.l / 2, rb), Pq(kd.l / 2, rb), Pq(kd.l / 2, rb + kd.h - kd.t1), Pq(-kd.l / 2, rb + kd.h - kd.t1)]; sh.poly(pts, 1); items.push({ kind: 'key', kd, pt: Pq(0, rb + (kd.h - kd.t1) / 2) }); }
      items.push({ kind: 'sprocket', pt: Pq(0, (rs + rf) / 2) });
    });
    // ---------- колёса в разрезе
    wheelsIn.forEach(w => {
      const pr = w.prof, hset = hatchSeq[hs_i++ % hatchSeq.length];
      const up = pr.pieces.map(pc => pc.map(([x, y]) => w.P(x, y)));
      const lowPc = pr.pieces.map(pc => pc.map(([x, y]) => [x, y === pr.rb + pr.kb ? pr.rb : (Math.abs(y - (pr.rb + pr.kb + (pr.cb || 0))) < 1e-9 ? pr.rb + (pr.cb || 0) : y)]));
      const lo = lowPc.map(pc => pc.map(([x, y]) => w.P(x, -y)));
      up.concat(lo).forEach(pc => sh.poly(pc, 1));
      sh.hatch(up.concat(lo), hset);
      // делительная линия
      if (w.kind !== 'bevel') for (const sg of [1, -1]) { const a = w.P(-pr.hb - 2, sg * pr.pitchR), b = w.P(pr.hb + 2, sg * pr.pitchR); sh.line(a[0], a[1], b[0], b[1], 3); }
      items.push({ kind: 'wheel', w, pt: (() => { const pc = up[up.length - 1]; const cx = pc.reduce((a, p) => a + p[0], 0) / pc.length, cy = pc.reduce((a, p) => a + p[1], 0) / pc.length; return [cx, cy]; })() });
    });
    // колёса и валы, перпендикулярные плоскости
    wheelsEnd.forEach(w => {
      const c = prj(w.pos), g = w.g;
      const ra = (g.daM || g.da) / 2 * k;
      sh.circle(c[0], c[1], (g.da || g.dae) / 2 * k, 1);
      if (g.daM) sh.circle(c[0], c[1], ra, 2);
      sh.circle(c[0], c[1], g.d / 2 * k, 3);
      sh.circle(c[0], c[1], g.dst / 2 * k, 1);
      items.push({ kind: 'wheel', w, pt: [c[0] + (g.d / 2 + g.dst / 2) / 2 * k * 0.7, c[1] + (g.d / 2 + g.dst / 2) / 2 * k * 0.7] });
    });
    endOn.forEach(s => {
      const c = prj(s.pos);
      const hub = s.segs.find(g => g.gear) || s.segs.find(g => g.role === 'hub') || s.segs[0];
      const r = (hub.gear ? hub.gear.da / 2 : hub.r) * k;
      sh.circle(c[0], c[1], r, 1);
      if (hub.gear) { sh.circle(c[0], c[1], hub.gear.d / 2 * k, 3); sh.circle(c[0], c[1], hub.gear.df / 2 * k, 2); sh.hatch([circlePts(c, hub.gear.df / 2 * k)], { ang: 45, step: 2 }); }
      else sh.hatch([circlePts(c, r)], { ang: 45, step: 2 });
      items.push({ kind: 'shaft', s, pt: [c[0] + r * 0.3, c[1] + r * 0.3] });
      sh.line(c[0] - r - 5, c[1], c[0] + r + 5, c[1], 3).line(c[0], c[1] - r - 5, c[0], c[1] + r + 5, 3);
    });
    // ---------- крышки подшипников: соседние крышки на одной стенке срезаются по линии между осями
    covers.forEach(cv => {
      cv.lim = [Infinity, Infinity];
      covers.forEach(o => {
        if (o === cv || o.s.horiz !== cv.s.horiz || o.dir !== cv.dir || Math.abs(o.face - cv.face) > 40 * k) return;
        const dlt = (o.s.o[0] - cv.s.o[0]) * cv.s.n2[0] + (o.s.o[1] - cv.s.o[1]) * cv.s.n2[1];
        const half = Math.abs(dlt) / 2 / k - 0.5;
        if (dlt > 0) cv.lim[0] = Math.min(cv.lim[0], half); else cv.lim[1] = Math.min(cv.lim[1], half);
      });
    });
    covers.forEach(cv => {
      const s = cv.s, P = s.P, b = s.b || {};
      const sealSeg = s.segs.find(g => g.role === 'seal');
      const outSide = cv.dir;
      const through = !!sealSeg && (() => { const sx = (sealSeg.x0 + sealSeg.x1) / 2; const bx = (cv.q.a + cv.q.b) / 2; return Math.sign(sx - bx) === Math.sign(s.horiz ? outSide * s.d[0] : outSide * s.d[1]); })();
      // координата вдоль оси вала: наружный торец подшипника и торец бобышки
      const bOut = Math.sign(s.horiz ? outSide * s.d[0] : outSide * s.d[1]) > 0 ? cv.q.b : cv.q.a;
      const dirL = Math.sign(s.horiz ? outSide * s.d[0] : outSide * s.d[1]);
      const xFace = bOut + dirL * (coverDepth / k + (cv.ext || 0));
      const Dh = (b.D || 60) / 2, Rk = cv.bossR / k;
      const tF = 9, rIn = through ? (sealSeg.r + 1) : 0;
      const seal = through ? root.MECH.seal(sealSeg.d) : null;
      // фланец
      const fl = [[xFace, rIn], [xFace + dirL * tF, rIn], [xFace + dirL * tF, Rk], [xFace, Rk]];
      // центрирующий поясок до подшипника
      const sp = [[bOut, Math.max(rIn, Dh - 7)], [xFace, Math.max(rIn, Dh - 7)], [xFace, Dh], [bOut, Dh]];
      const parts = [];
      for (const sg of [1, -1]) {
        const lim = cv.lim[sg > 0 ? 0 : 1];
        const flP = fl.map(([x, r]) => P(x, sg * Math.min(r, lim))), spP = sp.map(([x, r]) => P(x, sg * Math.min(r, lim)));
        if (through) {
          // гнездо манжеты в крышке
          const sx1 = xFace + dirL * (tF - seal.h - 1), sx2 = xFace + dirL * (tF - 1);
          const poc = [[sx1, sealSeg.r], [sx2, sealSeg.r], [sx2, seal.D / 2], [sx1, seal.D / 2]].map(([x, r]) => P(x, sg * r));
          parts.push({ seal: poc });
        }
        parts.push({ fl: flP, sp: spP });
      }
      const hset = hatchSeq[hs_i++ % hatchSeq.length];
      const rings = [];
      parts.forEach(p => { if (p.fl) { sh.poly(p.fl, 1); sh.poly(p.sp, 1); rings.push(p.fl, p.sp); } });
      if (through) {
        // фланец крышки с вырезом под манжету: штриховку не наносим в гнезде — рисуем манжету отдельно
        parts.forEach(p => { if (p.seal) { sh.poly(p.seal, 1); sh.line(p.seal[0][0], p.seal[0][1], p.seal[2][0], p.seal[2][1], 2); sh.line(p.seal[1][0], p.seal[1][1], p.seal[3][0], p.seal[3][1], 2); } });
        sh.hatch(rings.concat(parts.filter(p => p.seal).map(p => p.seal)), hset);
        items.push({ kind: 'seal', s, pt: (() => { const q = parts.find(p => p.seal).seal; return [(q[0][0] + q[2][0]) / 2, (q[0][1] + q[2][1]) / 2]; })() });
      } else sh.hatch(rings, hset);
      items.push({ kind: through ? 'coverT' : 'coverB', s, pt: (() => { const q = parts.find(p => p.fl).fl; return [(q[1][0] + q[2][0]) / 2 * 0.5 + (q[0][0] + q[3][0]) / 2 * 0.5, (q[1][1] * 0.3 + q[2][1] * 0.7)]; })() });
      // прокладки (набор) между фланцем и корпусом
      for (const sg of [1, -1]) { const a = P(xFace + dirL * 0.8, sg * Dh), b = P(xFace + dirL * 0.8, sg * Math.min(Rk, cv.lim[sg > 0 ? 0 : 1])); sh.line(a[0], a[1], b[0], b[1], 2); }
      items.push({ kind: 'shim', s, pt: P(xFace + dirL * 0.4, (Dh + Rk) / 2 + 2) });
      // винты крепления крышки (два в плоскости разреза)
      const rb = (Dh + Rk) / 2 + 1, dsc = dks;
      for (const sg of [1, -1]) {
        if (rb + 0.8 * dsc > cv.lim[sg > 0 ? 0 : 1]) continue;
        const hx = xFace + dirL * tF, hh = 0.7 * dsc, hw = 1.6 * dsc;
        const head = [[hx, sg * (rb - hw / 2)], [hx + dirL * hh, sg * (rb - hw / 2)], [hx + dirL * hh, sg * (rb + hw / 2)], [hx, sg * (rb + hw / 2)]].map(([x, r]) => P(x, r));
        sh.poly(head, 1);
        const sl = 2.2 * dsc;
        for (const e of [-1, 1]) { const a = P(hx, sg * rb + e * dsc / 2), bb = P(hx - dirL * (tF + sl), sg * rb + e * dsc / 2); sh.line(a[0], a[1], bb[0], bb[1], 1); }
        const c1 = P(hx + dirL * (hh + 2), sg * rb), c2 = P(hx - dirL * (tF + sl + 2), sg * rb); sh.line(c1[0], c1[1], c2[0], c2[1], 3);
        if (!items.some(q => q.kind === 'screw' && q.s === s)) items.push({ kind: 'screw', s, pt: [(head[0][0] + head[2][0]) / 2, (head[0][1] + head[2][1]) / 2] });
      }
    });
    return { sh, items, cav, cavs, housingBox, flg, inPlane, wheelsIn, covers, bosses, bores, hs, k };
  }
  // точка внутри области (чётно-нечётное правило), подальше от границы — для выноски позиции
  function innerPoint(loops) {
    if (!loops || !loops.length) return null;
    const pts = loops.flat(), x1 = Math.min(...pts.map(p => p[0])), x2 = Math.max(...pts.map(p => p[0])), y1 = Math.min(...pts.map(p => p[1])), y2 = Math.max(...pts.map(p => p[1]));
    const inside = (u, v) => { let c = false; loops.forEach(P => { for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const a = P[i], b = P[j]; if ((a[1] > v) !== (b[1] > v) && u < (b[0] - a[0]) * (v - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } }); return c; };
    const segD = (u, v) => { let m = Infinity; loops.forEach(P => { for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const a = P[j], b = P[i], dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy || 1e-9, t = Math.max(0, Math.min(1, ((u - a[0]) * dx + (v - a[1]) * dy) / L2)); m = Math.min(m, Math.hypot(u - a[0] - t * dx, v - a[1] - t * dy)); } }); return m; };
    let best = null, bd = 0;
    for (let i = 1; i < 60; i++) for (let j = 1; j < 60; j++) { const u = x1 + (x2 - x1) * i / 60, v = y1 + (y2 - y1) * j / 60; if (!inside(u, v)) continue; const d = Math.min(segD(u, v), 12); if (d > bd + 0.5) { bd = d; best = [u, v]; } }
    return best;
  }
  function circlePts(c, r) { const p = []; for (let i = 0; i < 48; i++) { const a = i / 48 * 2 * Math.PI; p.push([c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)]); } return p; }

  /* подшипник в разрезе (верх и низ), x — вдоль вала от a до b; d, D — радиусы (мм модели) */
  function drawBearing(sh, P, a, b, d, D, kind, left, k) {
    const W = b - a, h = D - d;
    for (const sg of [1, -1]) {
      const R = (x, r) => P(x, sg * r);
      const tIn = h * 0.28, tOut = h * 0.28;
      if (kind === 'taper') {
        const dirW = left ? 1 : -1; // широкий торец наружного кольца — к середине вала при установке «враспор»
        const xw = left ? a : b, xn = left ? b : a;
        const fi = x => x === xw ? 1.25 : 1, fo = x => x === xn ? 1.25 : 0.9;
        const inner = [R(a, d), R(b, d), R(b, d + tIn * fi(b)), R(a, d + tIn * fi(a))];
        const outer = [R(a, D), R(b, D), R(b, D - tOut * fo(b)), R(a, D - tOut * fo(a))];
        sh.poly(inner, 1); sh.poly(outer, 1);
        sh.hatch([inner], { ang: 45, step: 1.2 }); sh.hatch([outer], { ang: 135, step: 1.2 });
        // ролик: прямоугольник, наклонённый на 14° к оси вала
        const rm = (d + tIn + D - tOut) / 2, rr = (h - tIn - tOut) * 0.38;
        const cx = (a + b) / 2, th = 14 * D2R * dirW * -1;
        const ux = Math.cos(th), uy = Math.sin(th), nx = -uy, ny = ux, L2 = W * 0.34;
        const roll = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([p, q]) => R(cx + p * L2 * ux + q * rr * nx, rm + p * L2 * uy + q * rr * ny));
        sh.poly(roll, 1);
      } else {
        const inner = [R(a + 0.6, d), R(b - 0.6, d), R(b - 0.6, d + tIn), R(a + 0.6, d + tIn)];
        const outer = [R(a + 0.6, D - tOut), R(b - 0.6, D - tOut), R(b - 0.6, D), R(a + 0.6, D)];
        sh.poly(inner, 1); sh.poly(outer, 1);
        sh.hatch([inner], { ang: 45, step: 1.2 }); sh.hatch([outer], { ang: 135, step: 1.2 });
        const c = R((a + b) / 2, (d + D) / 2), rb = Math.min(W * 0.36, (h - tIn - tOut) * 0.62) * k;
        sh.circle(c[0], c[1], rb, 1);
        // контур подшипника
        sh.poly([R(a, d), R(b, d), R(b, D), R(a, D)], 1);
      }
    }
  }

  /* ---------------------------------------------------------------- вид сбоку (снаружи) */
  function sideView(A, R, S1, view1, side, k, M) {
    const sh = new Sheet('A1', true); sh.frame = { x1: -1e5, y1: -1e5, x2: 1e5, y2: 1e5 };
    const H = R.H || {}, del = (H.del || 8) * k, gap = (H.gap || 10) * k, gB = (H.gapBot || 30) * k;
    const items = [];
    const ih = Math.abs(dot(side.h, view1.u)) > 0.5 ? 0 : 1;           // горизонталь вида = ось главного вида №ih
    const hOf = p => dot(p, side.h) * k, uOf = p => dot(p, side.up) * k;
    // габарит основного корпуса по горизонтали (без стакана)
    const cavs = S1.cavs;
    const hx1 = Math.min(...cavs.map(c => ih === 0 ? c.x1 : c.y1)) - del, hx2 = Math.max(...cavs.map(c => ih === 0 ? c.x2 : c.y2)) + del;
    // валы, параллельные направлению взгляда
    const par = A.shafts.filter(s => Math.abs(dot(s.ax, side.along)) > 0.9).map(s => {
      const wl = A.wheels.filter(w => Math.abs(dot(w.ax, side.along)) > 0.9 && Math.abs(hOf(w.pos) - hOf(s.pos)) < 1);
      const rW = Math.max(0, ...wl.map(w => ((w.g.daM || w.g.da || w.g.dae) / 2) * k), ...s.segs.filter(g => g.gear).map(g => g.r * k));
      const cv = S1.covers.find(c => c.s.pd === s.pd);
      return { s, h: hOf(s.pos), u: uOf(s.pos), rW, bossR: cv ? cv.bossR : (s.b ? s.b.D / 2 * k + 25 * k : 40 * k), D: s.b ? s.b.D / 2 * k : 30 * k };
    });
    const u0 = 0;
    const rBot = Math.max(...par.map(p => p.rW), ...A.wheels.map(w => ((w.g.daM || w.g.da || w.g.dae) / 2) * k)) + gB;
    const yb = u0 - rBot - del, pF = (H.p || 18) * k, K = (H.K || 24) * k, K1 = (H.K1 || 20) * k + 8 * k;
    const tf = 1.5 * del;
    let env = null, top = null;
    if (M && M.sil) {
      // корпус — вид 3D-модели: контур (объединение проекций основания и крышки), фланцы разъёма и опорная плита
      const L = M.sil.loops.map(lp => lp.map(([x, y]) => [x * k, y * k]));
      if (M.dv) M.dv.lines.forEach(pl => sh.poly(pl.map(([x, y]) => [x * k, y * k]), 1, false));
      else L.forEach(lp => sh.poly(lp, 1));
      const fr = M.sil.rects.filter(r => /фланцы разъёма/.test(r[4]));
      if (fr.length) sh.line(Math.min(...fr.map(r => r[0])) * k, M.us * k, Math.max(...fr.map(r => r[2])) * k, M.us * k, 1);
      const pts = L.flat();
      M.bb = { x1: Math.min(...pts.map(p => p[0])), y1: Math.min(...pts.map(p => p[1])), x2: Math.max(...pts.map(p => p[0])), y2: Math.max(...pts.map(p => p[1])) };
      const pc = innerPoint(L.map(lp => lp.filter(p => p[1] > M.us * k + tf + 2 * k)).filter(lp => lp.length > 2));
      items.push({ kind: 'lid', pt: pc || [(M.bb.x1 + M.bb.x2) / 2, (M.bb.y2 + M.us * k) / 2] });
    } else {
      // основание: стенки от дна до разъёма
      sh.poly([[hx1, yb], [hx2, yb], [hx2, u0], [hx1, u0]], 1);
      // лапы (опорный фланец)
      sh.poly([[hx1 - K1, yb], [hx2 + K1, yb], [hx2 + K1, yb + pF], [hx1 - K1, yb + pF]], 1);
      // фланцы разъёма (основание и крышка)
      sh.poly([[hx1 - K, u0 - tf], [hx2 + K, u0 - tf], [hx2 + K, u0 + tf], [hx1 - K, u0 + tf]], 1);
      sh.line(hx1 - K, u0, hx2 + K, u0, 1);
      // крышка корпуса: огибающая окружностей вокруг колёс
      env = x => { let m = 0; par.forEach(p => { const R0 = Math.max(p.rW + gap + del, p.bossR + 4 * k); const dx = x - p.h; if (Math.abs(dx) < R0) m = Math.max(m, Math.sqrt(R0 * R0 - dx * dx)); }); return Math.max(m, tf + 18 * k); };
      top = [];
      const n = 80;
      for (let i = 0; i <= n; i++) { const x = hx1 + (hx2 - hx1) * i / n; top.push([x, u0 + env(x)]); }
      sh.poly([[hx1, u0 + tf]].concat(top).concat([[hx2, u0 + tf]]), 1, false);
      items.push({ kind: 'lid', pt: [(hx1 + hx2) / 2, u0 + env((hx1 + hx2) / 2) * 0.6] });
    }
    // смотровой люк, ручка-отдушина, маслоуказатель и пробка — по 3D-модели (accessories)
    // бобышки и крышки подшипников, винты
    par.forEach(p => {
      sh.circle(p.h, p.u, p.bossR + 3 * k, 1);
      sh.circle(p.h, p.u, p.bossR, 1);
      const seal = p.s.segs.find(g => g.role === 'seal');
      const out = p.s.segs.find(g => g.role === 'out');
      if (out) { sh.circle(p.h, p.u, out.r * k, 1); sh.circle(p.h, p.u, (seal ? seal.r : out.r) * k + 1.5 * k, 2); }
      const rb = (p.D + p.bossR) / 2 + 1 * k, ns = p.D > 50 * k ? 6 : 4;
      for (let i = 0; i < ns; i++) { const a = (45 + i * 360 / ns) * D2R; hexagon(sh, p.h + rb * Math.cos(a), p.u + rb * Math.sin(a), 0.85 * (H.dks || 8) * k); }
      sh.circle(p.h, p.u, rb, 3);
      sh.line(p.h - p.bossR - 6 * k, p.u, p.h + p.bossR + 6 * k, p.u, 3).line(p.h, p.u - p.bossR - 6 * k, p.h, p.u + p.bossR + 6 * k, 3);
      // стяжные болты у подшипников (вид сбоку: головка над фланцем крышки, гайка под фланцем основания)
      const d2 = (H.d2 || 12) * k;
      if (!(M && M.sil)) for (const sg of [-1, 1]) {
        const bx = p.h + sg * (p.bossR + 1.2 * d2);
        if (bx < hx1 - K + d2 || bx > hx2 + K - d2) continue;
        const hw = 0.9 * d2;
        sh.poly([[bx - hw, u0 + tf], [bx + hw, u0 + tf], [bx + hw, u0 + tf + 0.7 * d2], [bx - hw, u0 + tf + 0.7 * d2]], 1);
        sh.poly([[bx - hw, u0 - tf], [bx + hw, u0 - tf], [bx + hw, u0 - tf - 0.8 * d2], [bx - hw, u0 - tf - 0.8 * d2]], 1);
        sh.line(bx, u0 + tf + 0.7 * d2 + 2, bx, u0 - tf - 0.8 * d2 - 2, 3);
        if (!items.some(q => q.kind === 'bolt2')) items.push({ kind: 'bolt2', pt: [bx, u0 + tf + 0.35 * d2] });
      }
    });
    if (M && M.sil) {
      extraFasteners(sh, k, M, side.h, side.up, items, {});
      const X = p => dot(p, side.h) * k, Y = p => dot(p, side.up) * k;
      // фундаментные отверстия (невидимые) в лапах
      (M.feet.holes || []).forEach(p => { const x = X(p), d1 = M.feet.d * k, y0 = Y(p), y1 = y0 + (M.zFoot - M.feet.bottom) * k; sh.line(x - d1 / 2, y0, x - d1 / 2, y1, 4).line(x + d1 / 2, y0, x + d1 / 2, y1, 4).line(x, y0 - 3, x, y1 + 3, 3); });
    } else for (const x of [hx1 - K1 / 2, hx2 + K1 / 2]) { const d1 = (H.d1 || 16) * k; sh.line(x - d1 / 2, yb, x - d1 / 2, yb + pF, 4).line(x + d1 / 2, yb, x + d1 / 2, yb + pF, 4).line(x, yb - 3, x, yb + pF + 3, 3); }
    if (!(M && M.sil)) items.push({ kind: 'bolt3', pt: [(hx1 + hx2) / 2, u0 + tf * 0.5] });
    // вал-шестерня в стакане, перпендикулярный направлению взгляда (задание 1): контур стакана
    const perp = S1.inPlane.filter(s => s.cartridge && Math.abs(dot(s.ax, side.h)) > 0.9);
    perp.forEach(s => {
      const t = s.tube; const x1 = ih === 0 ? t.x1 : t.y1, x2 = ih === 0 ? t.x2 : t.y2, hh = (ih === 0 ? (t.y2 - t.y1) : (t.x2 - t.x1)) / 2;
      const xa = Math.max(x1, hx2), xb2 = x2;
      sh.poly([[xa, u0 - hh], [xb2, u0 - hh], [xb2, u0 + hh], [xa, u0 + hh]], 1);
      sh.line(xa - 4, u0, xb2 + 30 * k, u0, 3);
    });
    // размеры: высота оси, габаритная высота, ширина по лапам
    if (M && M.sil) {
      const b = M.bb, yF = M.feet.bottom * k, xr = b.x2;
      const fh = (M.feet.holes || []).map(p => dot(p, side.h) * k).sort((a, c) => a - c);
      sh.dimV(xr, yF, par.length ? par[par.length - 1].h : xr, M.us * k, xr + 12, nf(M.us - M.feet.bottom, 0));
      sh.dimV(xr, yF, (b.x1 + b.x2) / 2, b.y2, xr + 22, nf((b.y2 - yF) / k, 0) + '*');
      sh.dimH(b.x1, yF, b.x2, yF, yF - 12, nf((b.x2 - b.x1) / k, 0) + '*');
      if (fh.length >= 2 && fh[fh.length - 1] - fh[0] > 1) sh.dimH(fh[0], yF, fh[fh.length - 1], yF, yF - 20, nf((fh[fh.length - 1] - fh[0]) / k, 0));
    } else {
      const yTop = u0 + Math.max(...top.map(p => p[1] - u0));
      const xr = hx2 + K1;
      sh.dimV(xr, yb, par.length ? par[par.length - 1].h : hx2, u0, xr + 12, nf((u0 - yb) / k, 0));
      sh.dimV(xr, yb, (hx1 + hx2) / 2, yTop, xr + 22, nf((yTop - yb) / k, 0) + '*');
      sh.dimH(hx1 - K1, yb, hx2 + K1, yb, yb - 12, nf((hx2 - hx1 + 2 * K1) / k, 0) + '*');
      sh.dimH(hx1 - K1 / 2, yb, hx2 + K1 / 2, yb, yb - 20, nf((hx2 - hx1 + K1) / k, 0));
    }
    return { sh, items };
  }
  /* навесные элементы корпуса по 3D-модели (M3D.housing3d().fasteners): маслоуказатель (фонарный или жезловый),
     крышка люка с ручкой-отдушиной, сливная пробка. Вид: лист x = (p·U)·k, y = (p·V)·k, наблюдатель — со стороны U×V.
     cut — положение секущей плоскости вдоль U×V (на разрезе всё, что ближе к наблюдателю, удалено); null — вид без разреза. */
  /* вид снаружи по описанию корпуса (U — вправо, V — вверх; наблюдатель со стороны U×V): видимые рёбра корпуса,
     выступающие концы валов, крышки подшипников в профиль, звёздочка, навесные элементы, крепёж */
  function modelView(A, R, MV, F, U, V, k) {
    const sh = new Sheet('A1', true); sh.frame = { x1: -1e5, y1: -1e5, x2: 1e5, y2: 1e5 };
    const items = [], N = [U[1] * V[2] - U[2] * V[1], U[2] * V[0] - U[0] * V[2], U[0] * V[1] - U[1] * V[0]];
    const X = p => dot(p, U) * k, Y = p => dot(p, V) * k;
    const dvKey = U.join() + '|' + V.join(); MV._dv = MV._dv || {};
    const dv = MV._dv[dvKey] || (MV._dv[dvKey] = root.M3D.depthView(MV.ops, U, V));
    dv.lines.forEach(pl => sh.poly(pl.map(([x, y]) => [x * k, y * k]), 1, false));
    const vis = (p, r) => { const d = dv.depth(dot(p, U), dot(p, V)); return d < -1e8 || dot(p, N) + (r || 0) >= d - 0.5; };
    const prof = (p0, ax, t0, t1, r, st) => { const w = [dot(ax, U), dot(ax, V)], n2 = [-w[1], w[0]], a = p0.map((v, i) => v + ax[i] * t0), b = p0.map((v, i) => v + ax[i] * t1);
      sh.poly([[X(a) + n2[0] * r * k, Y(a) + n2[1] * r * k], [X(b) + n2[0] * r * k, Y(b) + n2[1] * r * k], [X(b) - n2[0] * r * k, Y(b) - n2[1] * r * k], [X(a) - n2[0] * r * k, Y(a) - n2[1] * r * k]], st || 1); };
    // крышки подшипников (в профиль): фланец; винты — по сборке
    MV.extra.forEach(it => {
      const pd = MV.parts.find(q => q.file === it.file); if (!pd || pd.kind !== 'cover') return;
      const x = it.axes.slice(0, 3); if (Math.abs(dot(x, N)) > 0.1) return;
      const g = pd.geom, mid = it.pos.map((v, i) => v + x[i] * g.tf / 2);
      if (!vis(mid, g.Df / 2)) return;
      prof(it.pos, x, 0, g.tf, g.Df / 2);
      items.push({ kind: g.dSeal ? 'coverT' : 'coverB', pt: [X(mid), Y(mid) + g.Df / 2 * 0.6 * k] });
    });
    // валы: ступени, видимые снаружи корпуса
    A.shafts.filter(s => Math.abs(dot(s.ax, N)) < 0.1).forEach(s => {
      s.segs.forEach(g => { const mid = s.pos.map((v, i) => v + s.ax[i] * (g.x0 + g.x1) / 2); if (!vis(mid, g.r)) return; prof(s.pos, s.ax, g.x0, g.x1, g.r); items.push({ kind: 'shaft', s, pt: [X(mid), Y(mid)] }); });
      const a = s.pos.map((v, i) => v - s.ax[i] * 8), b = s.pos.map((v, i) => v + s.ax[i] * (s.segs[s.segs.length - 1].x1 + 8)); sh.line(X(a), Y(a), X(b), Y(b), 3);
    });
    // звёздочка
    (A.sprockets || []).filter(q => Math.abs(dot(q.ax, N)) < 0.1).forEach(q => { const g = q.g; prof(q.pos, q.ax, -(g.lst || g.b) / 2, (g.lst || g.b) / 2, g.dst / 2); prof(q.pos, q.ax, -g.b / 2, g.b / 2, (g.De || g.dd) / 2); items.push({ kind: 'sprocket', pt: [X(q.pos), Y(q.pos) + g.dd / 2 * 0.7 * k] }); });
    accessories(sh, k, F, U, V, items, {});
    extraFasteners(sh, k, Object.assign({}, MV, { solid: null, depthVis: vis }), U, V, items, {});
    // точки для позиций корпуса и крышки: видимая поверхность принадлежит этой детали и вокруг — она же
    const owner = (s, tt) => { const d = dv.depth(s, tt); if (d < -1e8) return 0; const p = [0, 1, 2].map(i => s * U[i] + tt * V[i] + (d - 0.4) * N[i]); return MV.inBase(p) ? 1 : MV.inCover(p) ? 2 : 0; };
    const best = { 1: null, 2: null };
    const bx = dv.box, cx = (bx.x1 + bx.x2) / 2, cy = (bx.y1 + bx.y2) / 2;
    for (let i = 1; i < 40; i++) for (let j = 1; j < 40; j++) {
      const s = bx.x1 + (bx.x2 - bx.x1) * i / 40, tt = bx.y1 + (bx.y2 - bx.y1) * j / 40, w = owner(s, tt); if (!w) continue;
      let n = 0; for (let a = 0; a < 8; a++) if (owner(s + 7 * Math.cos(a * Math.PI / 4), tt + 7 * Math.sin(a * Math.PI / 4)) === w) n++;
      const sc = n * 1000 - Math.hypot(s - cx, tt - cy); if (!best[w] || sc > best[w].sc) best[w] = { sc, p: [s, tt] };
    }
    if (best[1]) items.push({ kind: 'housing', pt: [best[1].p[0] * k, best[1].p[1] * k] });
    if (best[2]) items.push({ kind: 'lid', pt: [best[2].p[0] * k, best[2].p[1] * k] });
    // размеры: габариты*, высота оси (разъёма) над опорой
    const b = dv.box, bb = sh.bbox(0), yF = MV.feetBottom * k;
    sh.dimH(bb.x1, yF, bb.x2, yF, bb.y1 - 12, nf((bb.x2 - bb.x1) / k, 0) + '*');
    void b;
    return { sh, items };
  }
  /* крепёж из сборки 3D-модели (болты с шайбами и гайками, штифты, винты М6 люка и маслоуказателя):
     болты, гайки, шайбы с осью в плоскости вида — контуры; видимость — луч к наблюдателю не встречает корпус. */
  function extraFasteners(sh, k, M, U, V, items, o) {
    o = o || {};
    if (!M || !M.extra) return;
    const N = [U[1] * V[2] - U[2] * V[1], U[2] * V[0] - U[0] * V[2], U[0] * V[1] - U[1] * V[0]];
    const X = p => dot(p, U) * k, Y = p => dot(p, V) * k;
    const cutOk = p => o.cut === undefined || o.cut === null || dot(p, N) <= o.cut + 0.5;
    const visible = p => { if (M.depthVis) return M.depthVis(p, 0); if (!M.solid) return true; for (let t = 1.5; t < 400; t += 2) { const q = p.map((v, i) => v + N[i] * t); if (!cutOk(q)) return true; if (M.solid(q)) return false; } return true; };
    const seen = new Set(), got = {}, hidden = [];
    const H = M.H || {};
    M.extra.forEach(it => {
      const pd = M.parts.find(q => q.file === it.file); if (!pd) return;
      const x = it.axes.slice(0, 3), g = pd.geom, at = t => it.pos.map((v, i) => v + x[i] * t);
      if (pd.kind === 'pin') { const c = it.pos; if (!got.pin && cutOk(c)) { got.pin = true; items.push({ kind: 'pin', pt: [X(c), Y(c)] }); } return; }
      if (!/^(bolt|nut|washer)$/.test(pd.kind) || !(/^(bolt_|nut_|washer_|screw_M6)/.test(pd.id) || (o.coverScrews && /^screw_/.test(pd.id)))) return;
      const head = pd.kind === 'bolt' ? at(-g.k / 2) : at((pd.kind === 'nut' ? g.m : g.t) / 2);
      if (!cutOk(head)) { if (o.hiddenFallback && pd.kind === 'bolt' && Math.abs(dot(x, N)) < 0.1) hidden.push({ it, pd, x, g, head }); return; }
      const inPl = Math.abs(dot(x, N)) < 0.1;
      if (o.coverScrews && /^screw_/.test(pd.id) && !(/^screw_M6/.test(pd.id) && (M.H.dks || 8) !== 6)) { if (visible(head) && Math.abs(dot(x, N)) < 0.1) { const w = [dot(x, U), dot(x, V)], n2 = [-w[1], w[0]], a = at(-g.k), b = at(0), hw = g.s / 2 * 1.1; sh.poly([[X(a) + n2[0] * hw * k, Y(a) + n2[1] * hw * k], [X(b) + n2[0] * hw * k, Y(b) + n2[1] * hw * k], [X(b) - n2[0] * hw * k, Y(b) - n2[1] * hw * k], [X(a) - n2[0] * hw * k, Y(a) - n2[1] * hw * k]], 1); } return; }
      if (/^screw_M6/.test(pd.id)) { const key = 's' + g.L; if (!got[key] && visible(head)) { got[key] = true; items.push({ kind: 'screwSet', d: g.d, L: g.L, pt: [X(head), Y(head)] }); } return; }
      if (!visible(head)) { if (o.hiddenFallback && pd.kind === 'bolt' && Math.abs(dot(x, N)) < 0.1) hidden.push({ it, pd, x, g, head }); return; }
      const key = pd.id + ':' + Math.round(X(it.pos) * 10) + ':' + Math.round(Y(it.pos) * 10); if (seen.has(key)) return; seen.add(key);
      if (o.draw !== false) {
        if (inPl) {
          const w = [dot(x, U), dot(x, V)], n2 = [-w[1], w[0]];
          const seg = (t0, t1, hw) => { const a = at(t0), b = at(t1); sh.poly([[X(a) + n2[0] * hw * k, Y(a) + n2[1] * hw * k], [X(b) + n2[0] * hw * k, Y(b) + n2[1] * hw * k], [X(b) - n2[0] * hw * k, Y(b) - n2[1] * hw * k], [X(a) - n2[0] * hw * k, Y(a) - n2[1] * hw * k]], 1); };
          if (pd.kind === 'bolt') { seg(-g.k, 0, g.s / 2 * 1.1); const a = at(-g.k - 2), b = at(g.L + 2); sh.line(X(a), Y(a), X(b), Y(b), 3); }
          else if (pd.kind === 'nut') seg(0, g.m, g.s / 2 * 1.1);
          else seg(0, g.t, g.D / 2);
        } else if (pd.kind === 'bolt' && dot(x, N) < 0) hexagon(sh, X(it.pos), Y(it.pos), g.s / 2 * k * 1.1);
      }
      if (pd.kind === 'bolt') { const kk = 'b' + g.d + 'x' + g.L; if (!got[kk]) { got[kk] = true; items.push({ kind: 'boltSet', d: g.d, L: g.L, pt: [X(head), Y(head)] }); } }
    });
    // болты, которых не видно ни на одном виде, — одно соединение показывается невидимыми линиями с позицией
    hidden.forEach(({ it, x, g, head }) => {
      const kk = 'b' + g.d + 'x' + g.L; if (got[kk] || (o.skip && o.skip.has(kk))) return; got[kk] = true;
      const w = [dot(x, U), dot(x, V)], n2 = [-w[1], w[0]], at = t => it.pos.map((v, i) => v + x[i] * t);
      const seg = (t0, t1, hw) => { const a = at(t0), b = at(t1); sh.poly([[X(a) + n2[0] * hw * k, Y(a) + n2[1] * hw * k], [X(b) + n2[0] * hw * k, Y(b) + n2[1] * hw * k], [X(b) - n2[0] * hw * k, Y(b) - n2[1] * hw * k], [X(a) - n2[0] * hw * k, Y(a) - n2[1] * hw * k]], 4); };
      seg(-g.k, 0, g.s / 2 * 1.1); seg(0, g.L, g.d / 2);
      items.push({ kind: 'boltSet', d: g.d, L: g.L, pt: [X(head), Y(head)] });
    });
  }
  function accessories(sh, k, F, U, V, items, o) {
    o = o || {};
    if (!F) return;
    const N = [U[1] * V[2] - U[2] * V[1], U[2] * V[0] - U[0] * V[2], U[0] * V[1] - U[1] * V[0]];
    const X = p => dot(p, U) * k, Y = p => dot(p, V) * k;
    const add = (p, d, t) => p.map((v, i) => v + d[i] * t);
    const front = (p, r) => o.cut !== undefined && o.cut !== null && dot(p, N) - (r || 0) > o.cut + 0.5;
    // тело вращения вдоль оси d от точки p0: участки [t0, t1, r]; в профиль — контуры, вдоль взгляда — окружности
    const solidRev = (p0, d, segs, st) => {
      const along = dot(d, N);
      if (Math.abs(along) > 0.9) { segs.forEach(([, , r]) => sh.circle(X(p0), Y(p0), r * k, st || 1)); return; }
      const w0 = [U, V].map(e => dot(e, d)), wl = Math.hypot(w0[0], w0[1]) || 1, ax = [w0[0] / wl, w0[1] / wl], pr = [-ax[1], ax[0]];
      const P = (t, s) => [X(p0) + (ax[0] * t + pr[0] * s) * k, Y(p0) + (ax[1] * t + pr[1] * s) * k];
      segs.forEach(([t0, t1, r]) => sh.poly([P(t0, -r), P(t1, -r), P(t1, r), P(t0, r)], st || 1));
      return P;
    };
    const L = F.lanternAt;
    if (L && L.kind !== 'dip' && o.lantern !== false) {
      const along = dot(L.d, N);
      if (!front(L.face, L.D / 2 + 3) && along > -0.9) {
        const P = solidRev(L.face, L.d, [[0, 4, 33], [4, 9, 30], [9, 16, 19]]);
        if (Math.abs(along) > 0.9) {
          sh.circle(X(L.face), Y(L.face), 16 * k, 2);
          const e2 = [L.d[1] * L.up[2] - L.d[2] * L.up[1], L.d[2] * L.up[0] - L.d[0] * L.up[2], L.d[0] * L.up[1] - L.d[1] * L.up[0]];
          [45, 135, 225, 315].forEach(a => { const q = L.face.map((v, i) => v + 24.5 * (Math.cos(a * D2R) * L.up[i] + Math.sin(a * D2R) * e2[i])); sh.circle(X(q), Y(q), 3.5 * k, 1); });
          items.push({ kind: 'dipstick', pt: [X(L.face) + 10 * k, Y(L.face) + 10 * k] });
        } else { const c = P(12, 0); items.push({ kind: 'dipstick', pt: c }); }
      }
    }
    if (L && L.kind === 'dip' && o.lantern !== false && !front(L.top, 15)) {
      const P = solidRev(L.top, L.up, [[0, L.boss, 15], [L.boss, L.boss + 3, 10], [L.boss + 3, L.boss + 15, 5], [L.boss + 15, L.boss + 22, 11]]);
      if (P) { const a = P(0, -3), b = P(-L.len, -3), c = P(-L.len, 3), d = P(0, 3); sh.line(a[0], a[1], b[0], b[1], 1).line(b[0], b[1], c[0], c[1], 1).line(c[0], c[1], d[0], d[1], 1); items.push({ kind: 'dipstick', pt: P(L.boss + 18, 0) }); }
      else items.push({ kind: 'dipstick', pt: [X(L.top) + 8 * k, Y(L.top)] });
    }
    const Vn = F.vent;
    if (Vn) {
      const xs = Vn.box.map(X), ys = Vn.box.map(Y), x1 = Math.min(...xs), x2 = Math.max(...xs), y1 = Math.min(...ys), y2 = Math.max(...ys);
      if (!front(Vn.box.reduce((a, q) => dot(q, N) < dot(a, N) ? q : a))) {
        const top = Math.abs(dot(Vn.up, N)) > 0.9;
        if (o.lid !== false) sh.poly([[x1, y1], [x2, y1], [x2, y2], [x1, y2]], 1);
        if (o.lid !== false) Vn.scr.forEach(q => { if (top) { hexagon(sh, X(q), Y(q), 5 * k); } else { const h = add(q, Vn.up, 4); const xa = X(q), ya = Y(q), xb = X(h), yb = Y(h), w0 = [U, V].map(e => 1 - Math.abs(dot(e, Vn.up))); sh.poly([[xa - 5 * k * w0[0], ya - 5 * k * w0[1]], [xb - 5 * k * w0[0], yb - 5 * k * w0[1]], [xb + 5 * k * w0[0], yb + 5 * k * w0[1]], [xa + 5 * k * w0[0], ya + 5 * k * w0[1]]], 1); } });
        const P = solidRev(Vn.at, Vn.up, [[0, 10, 8], [10, 22, 5], [22, 35, 12.5]]);
        if (o.lid !== false) items.push({ kind: 'hatchLid', pt: [(x1 + x2) / 2 + (x2 - x1) * 0.3, (y1 + y2) / 2] });
        items.push({ kind: 'vent', pt: P ? P(28, 0) : [X(Vn.at) + 6 * k, Y(Vn.at)] });
      }
    }
    const pg = F.plugAt;
    if (pg && o.plug !== false && !front(pg.face, 12) && dot(pg.d, N) > -0.9) {
      const dp = pg.dp || 16, s = (dp * 1.5 + 1) / 2;
      const P = solidRev(pg.face, pg.d, [[0, 2, s + 1], [2, 11, s]]);
      items.push({ kind: 'plug', pt: P ? P(6, 0) : [X(pg.face), Y(pg.face)] });
    }
  }
  function hexagon(sh, x, y, s) { const pts = []; for (let i = 0; i < 6; i++) { const a = (30 + i * 60) * D2R; pts.push([x + s * Math.cos(a), y + s * Math.sin(a)]); } sh.poly(pts, 1); }

  /* ---------------------------------------------------------------- размеры и позиции на разрезе */
  const FA = aw => aw <= 120 ? 0.035 : aw <= 180 ? 0.04 : aw <= 250 ? 0.045 : aw <= 315 ? 0.05 : 0.055;
  function sectionDims(S, R, task, k) {
    const sh = S.sh, inPlane = S.inPlane;
    const bb0 = sh.bbox(0);
    // межосевые расстояния между параллельными валами
    const par = inPlane.filter(s => !s.cartridge);
    const groups = {};
    par.forEach(s => { const key = s.horiz ? 'h' : 'v'; (groups[key] = groups[key] || []).push(s); });
    Object.values(groups).forEach(list => {
      if (list.length < 2) return;
      const horiz = list[0].horiz;
      list.sort((a, b) => horiz ? a.o[1] - b.o[1] : a.o[0] - b.o[0]);
      for (let i = 0; i + 1 < list.length; i++) {
        const a = list[i], b = list[i + 1];
        const aw = Math.abs(horiz ? (b.o[1] - a.o[1]) : (b.o[0] - a.o[0])) / k;
        const txt = `${nf(aw, 0)}±${nf(FA(aw), 3)}`;
        if (horiz) { const x = bb0.x1 - 12 - i * 0; sh.attempt([0, 9, 18].map(d => () => sh.dimV(Math.min(a.P(-2, 0)[0], b.P(-2, 0)[0]), a.o[1], Math.min(a.P(-2, 0)[0], b.P(-2, 0)[0]), b.o[1], x - d, txt))); }
        else { const y = bb0.y1 - 12; sh.attempt([0, 9, 18].map(d => () => sh.dimH(a.o[0], Math.min(a.P(-2, 0)[1], a.o[1]), b.o[0], Math.min(b.P(-2, 0)[1], b.o[1]), y - d, txt))); }
      }
    });
    // посадки: подшипники (наружное кольцо — H7, внутреннее — k6), колёса, выходные концы
    inPlane.forEach(s => {
      const across = (x, r, txt) => {
        const p1 = s.P(x, -r), p2 = s.P(x, r);
        const opts = s.horiz ? [() => sh.dimV(p1[0], p1[1], p2[0], p2[1], p1[0], txt), () => sh.dimV(p1[0], p1[1], p2[0], p2[1], p1[0], txt, { out: 'above' }), () => sh.dimV(p1[0], p1[1], p2[0], p2[1], p1[0], txt, { out: 'below' })]
          : [() => sh.dimH(p1[0], p1[1], p2[0], p2[1], p1[1], txt), () => sh.dimH(p1[0], p1[1], p2[0], p2[1], p1[1], txt, { side: 'left' })];
        sh.attempt(opts);
      };
      s.places.forEach(pl => {
        const b = s.b || {};
        across((pl.a + pl.b) / 2, pl.seg.r, `⌀${nf(pl.seg.d, 0)}k6`);
        const xo = pl.left ? pl.a - 3 : pl.b + 3;
        if (b.D) across(xo, b.D / 2, `⌀${nf(b.D, 0)}H7`);
      });
      s.segs.forEach(g => {
        if (g.role === 'hub') across((g.x0 + g.x1) / 2, g.r, `⌀${nf(g.d, 0)}H7/${task === 1 ? 'p6' : 'k6'}`);
        if (g.role === 'out') across(g.x0 + g.l * 0.6, g.r, `⌀${nf(g.d, 0)}${task === 1 ? 'k6' : 'm6'}`);
      });
    });
    // габаритные размеры разреза
    const bb = sh.bbox(0);
    sh.dimH(bb0.x1, bb0.y1, bb0.x2, bb0.y1, bb.y1 - 12, nf((bb0.x2 - bb0.x1) / k, 0) + '*');
    sh.dimV(bb0.x2, bb0.y1, bb0.x2, bb0.y2, bb.x2 + 12, nf((bb0.y2 - bb0.y1) / k, 0) + '*');
  }

  /* номера позиций: полки по краям изображения, без пересечения выносок */
  function positions(sh, list, o) {
    o = o || {};
    if (!list.length) return;
    const bb = sh.bbox(0), cx = (bb.x1 + bb.x2) / 2, cy = (bb.y1 + bb.y2) / 2;
    const wide = (bb.x2 - bb.x1) > (bb.y2 - bb.y1) * 1.1;
    const sides = wide ? ['t', 'b'] : ['l', 'r'];
    const by = { t: [], b: [], l: [], r: [] };
    list.forEach(it => { const s = wide ? (it.pt[1] >= cy ? 't' : 'b') : (it.pt[0] < cx ? 'l' : 'r'); by[s].push(it); });
    // уравновешивание сторон
    sides.forEach(sd => {
      const arr = by[sd];
      const key = sd === 't' || sd === 'b' ? (p => p.pt[0]) : (p => p.pt[1]);
      arr.sort((a, b) => key(a) - key(b));
      const n = arr.length; if (!n) return;
      const lo = sd === 't' || sd === 'b' ? bb.x1 : bb.y1, hi = sd === 't' || sd === 'b' ? bb.x2 : bb.y2;
      const nums = a => String(a.pos).split('/');
      const stepMin = sd === 't' || sd === 'b' ? Math.max(11, ...arr.map(a => Math.max(...nums(a).map(q => tw(q, 7))) + 6)) : 11;
      const gapAfter = i => sd === 'l' || sd === 'r' ? Math.max(stepMin, 9 * (nums(arr[i]).length - 1) + 11) : stepMin;
      let slots = arr.map(a => key(a));
      for (let i = 1; i < n; i++) slots[i] = Math.max(slots[i], slots[i - 1] + gapAfter(i - 1));
      const over = slots[n - 1] - hi; if (over > 0) for (let i = n - 1; i >= 0; i--) slots[i] = Math.min(slots[i], (i === n - 1 ? hi : slots[i + 1] - stepMin));
      for (let i = 0; i < n; i++) slots[i] = Math.max(slots[i], lo + i * stepMin);
      arr.forEach((it, i) => {
        const off = 14;
        let sx, sy, side;
        if (sd === 't') { sx = slots[i]; sy = bb.y2 + off; side = 'r'; }
        else if (sd === 'b') { sx = slots[i]; sy = bb.y1 - off; side = 'r'; }
        else if (sd === 'l') { sx = bb.x1 - off; sy = slots[i]; side = 'l'; }
        else { sx = bb.x2 + off; sy = slots[i]; side = 'r'; }
        // группа крепёжных деталей — общая выноска, номера позиций столбиком (ГОСТ 2.109-73, п. 4.18)
        const ns = String(it.pos).split('/'), w = Math.max(...ns.map(q => tw(q, 7))) + 2, dir = sd === 'b' ? -1 : 1;
        const ex = side === 'r' ? sx + w : sx - w;
        sh.line(it.pt[0], it.pt[1], sx, sy, 2);
        sh.dot(it.pt[0], it.pt[1], 0.8);
        ns.forEach((q, j) => { const yy = sy + dir * 9 * j; sh.line(sx, yy, ex, yy, 2); sh.text(side === 'r' ? sx + 1 : ex + 1, yy + 2, q, { h: 7, pos: true }); });
        if (ns.length > 1) sh.line(sx, sy, sx, sy + dir * 9 * (ns.length - 1), 2);
      });
    });
  }

  /* сопоставление объектов чертежа с позициями спецификации */
  function posFinder(spec) {
    const all = [];
    spec.sections.forEach(sc => sc.items.forEach(it => { if (it.pos) all.push(it); }));
    const by = f => { const it = all.find(f); return it ? it.pos : ''; };
    return (it) => {
      switch (it.kind) {
        case 'housing': return by(x => x.name === 'Корпус');
        case 'lid': return by(x => x.name === 'Крышка корпуса');
        case 'shaft': return by(x => x.name === it.s.pd.name);
        case 'wheel': return by(x => x.name === it.w.pd.name);
        case 'coverB': return by(x => /Крышка подшипника глухая/.test(x.name));
        case 'coverT': return by(x => /Крышка подшипника сквозная/.test(x.name));
        case 'shim': return by(x => /прокладок/.test(x.name));
        case 'sleeve': return by(x => /Втулка/.test(x.name));
        case 'dipstick': return by(x => /Маслоуказатель/.test(x.name));
        case 'vent': return by(x => /Ручка-отдушина/.test(x.name));
        case 'hatchLid': return by(x => /смотрового люка/.test(x.name));
        case 'screw': return by(x => /^Винт М(?!6×)/.test(x.name)) || by(x => /^Винт/.test(x.name));
        case 'bolt2': return by(x => /^Болт/.test(x.name));
        case 'bolt3': return by((x, i) => /^Болт/.test(x.name) && all.filter(y => /^Болт/.test(y.name)).indexOf(x) === 1);
        case 'plug': return by(x => /^Пробка/.test(x.name));
        case 'boltSet': { const b = by(x => x.name.startsWith(`Болт М${it.d}×${it.L} `)) || by(x => x.name.startsWith(`Болт М${it.d}×`)); if (!b) return ''; return [b, by(x => x.name.startsWith(`Шайба ${it.d} `)), by(x => x.name.startsWith(`Гайка М${it.d} `))].filter(Boolean).join('/'); }
        case 'screwSet': return by(x => x.name.startsWith(`Винт М${it.d}×${it.L} `));
        case 'pin': return by(x => /^Штифт/.test(x.name));
        case 'sprocket': return by(x => /^Звёздочка/.test(x.name));
        case 'bearing': return it.s.b ? by(x => x.name.includes('Подшипник ' + it.s.b.id)) : '';
        case 'seal': { const sg = it.s.segs.find(g => g.role === 'seal'); if (!sg) return ''; const sl = root.MECH.seal(sg.d); return by(x => x.name.includes(`Манжета 1-${sl.d}×${sl.D}`)); }
        case 'key': return by(x => x.name.includes(`Шпонка ${it.kd.b}×${it.kd.h}×${it.kd.l}`));
        default: return '';
      }
    };
  }

  const VIEWS = {
    1: { main: { u: [1, 0, 0], v: [0, 1, 0], n: [0, 0, 1] }, top: true, extra: { u: [0, 0, 1], v: [0, 1, 0] } },
    // по методичке (разд. 2.2): два вида редуктора, разрез — по основному виду; третий вид (extra) — если помещается
    // в том же масштабе (полнота проработки, без пустого поля): задание 1 — вид слева, 3 — вид сверху, 6 — вид слева.
    // задание 6: разрез по плоскости разъёма (основной) и над ним — вид вдоль валов (наблюдатель со стороны −X)
    6: { main: { u: [0, -1, 0], v: [1, 0, 0], n: [0, 0, 1] }, side: { h: [0, -1, 0], up: [0, 0, 1], along: [1, 0, 0] }, extra: { u: [-1, 0, 0], v: [0, 0, 1] } },
    // задание 3: разрез по оси червяка (основной), справа — разрез Б–Б по оси колеса (в проекционной связи по высоте)
    3: { main: { u: [1, 0, 0], v: [0, 0, 1], n: [0, 1, 0] }, second: { u: [0, 1, 0], v: [0, 0, 1], n: [1, 0, 0] }, extra: { u: [1, 0, 0], v: [0, 1, 0] } }
  };

  /* лист сборочного чертежа редуктора */
  function asmSheet(R, P, T, spec, opt) {
    opt = opt || {};
    const A = asmData(R, P, T);
    const V = VIEWS[R.task];
    const find = posFinder(spec);
    const notes = asmNotes(R, spec);
    // задание 3: корпус на разрезах — сечения 3D-модели (основание и крышка), чтобы чертёж и модель совпадали
    let MS = null;
    if (R.task === 3 && root.M3D && root.M3D.section2d) {
      try {
        const H3 = root.M3D.housing3d(R, P, T || {});
        const keep = ops => ops.filter(o => !/отверсти[ея] под (болт|штифт)/.test(o.n));
        const cr = (u, v) => [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
        const sec = (view, cut) => { const N = cr(view.u, view.v); return { base: root.M3D.section2d(keep(H3.baseOps), view.u, view.v, N, cut), cover: root.M3D.section2d(keep(H3.coverOps), view.u, view.v, N, cut) }; };
        const w = A.wheels.find(q => q.kind === 'wormwheel');
        MS = { main: sec(V.main, A.shafts.length ? dot(A.shafts[0].pos, cr(V.main.u, V.main.v)) : 0), second: V.second ? sec(V.second, w ? dot(w.pos, cr(V.second.u, V.second.v)) : 0) : null };
      } catch (e) { console.error(e); MS = null; }
    }
    const mfOf = H3 => { const sb = H3.baseOps.filter(o => !/отверсти|срез по разъёму/.test(o.n) || o.n === 'срез по разъёму'), sc = H3.coverOps.filter(o => !/отверсти/.test(o.n)); return { parts: H3.parts, extra: H3.extra, H: R.H || {}, solid: q => root.M3D.inOps(sb, q) || root.M3D.inOps(sc, q), inBase: q => root.M3D.inOps(sb, q), inCover: q => root.M3D.inOps(sc, q) }; };
    let MF = null; try { MF = root.M3D && root.M3D.inOps ? mfOf(root.M3D.housing3d(R, P, T || {})) : null; } catch (e) { MF = null; }
    // задание 6: вид сбоку — контур 3D-модели корпуса, крепёж — по сборке
    let MV = null;
    if (V.side && root.M3D && root.M3D.silhouette2d) {
      try {
        const H3 = root.M3D.housing3d(R, P, T || {}), sd = V.side;
        const N = [sd.h[1] * sd.up[2] - sd.h[2] * sd.up[1], sd.h[2] * sd.up[0] - sd.h[0] * sd.up[2], sd.h[0] * sd.up[1] - sd.h[1] * sd.up[0]];
        const allOps = H3.baseOps.concat(H3.coverOps.filter(o => !/лап/.test(o.n)));
        MV = Object.assign({ sil: root.M3D.silhouette2d(allOps, sd.h, sd.up, N), dv: root.M3D.depthView(allOps, sd.h, sd.up), us: H3.lvl.us, zFoot: H3.lvl.zFoot, feet: H3.feet }, mfOf(H3));
      } catch (e) { console.error(e); MV = null; }
    }
    // виды снаружи (задание 6 — спереди, задание 3 — сверху): по тому же описанию корпуса
    let Fx = null; try { Fx = root.M3D.housing3d(R, P, T || {}).fasteners; } catch (e) { Fx = null; }
    const extView = (vw) => {
      if (!vw || !root.M3D || !root.M3D.depthView) return null;
      try {
        const H3 = root.M3D.housing3d(R, P, T || {}), N = [vw.u[1] * vw.v[2] - vw.u[2] * vw.v[1], vw.u[2] * vw.v[0] - vw.u[0] * vw.v[2], vw.u[0] * vw.v[1] - vw.u[1] * vw.v[0]];
        const cov = H3.coverOps.filter(o => !/лап/.test(o.n));
        void N;
        return Object.assign({ ops: H3.baseOps.concat(cov), feetBottom: H3.lvl.zBot }, mfOf(H3));
      } catch (e) { console.error(e); return null; }
    };
    const MX = extView(V.extra || null);
    // масштабы: основной вид (разрез) — как можно крупнее; неосновные виды при нехватке места — в уменьшенном масштабе
    // с сохранением проекционной связи (методичка, разд. 2.2), над ними — их масштаб
    const SC = [[1, '1:1'], [0.5, '1:2'], [0.4, '1:2,5'], [0.25, '1:4'], [0.2, '1:5']];
    const F0 = (() => { try { return root.M3D.housing3d(R, P, T || {}).fasteners; } catch (e) { return null; } })();
    const geo = R.task === 1 && root.M3D ? (root.M3D.housing3d(R, P, T || {}) || {}).geo : null;
    const cr = (u, v) => [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const mainSec = k => {
      const S = geo ? sectionView(A, R, V.main, k, { extra: [{ x1: geo.flR.x1 * k, x2: geo.flR.x2 * k, y1: (geo.ys - geo.tf) * k, y2: (geo.ys + geo.tf) * k }], split: geo.ys * k }) : sectionView(A, R, V.main, k, MS ? { model: MS.main } : {});
      if (geo) {
        // лапы корпуса (за плоскостью разреза): видимый контур ниже стенок
        const x1 = (geo.xW1 - geo.K1) * k, x2 = (geo.xW2 + geo.K1) * k, yF = geo.yFeet * k, yT = (geo.yBot + geo.pF) * k;
        // нижние приливы и крышки подшипников закрывают лапы (они ближе к наблюдателю) — там линии не проводятся
        const gaps = geo.S.bosses.filter(b => b.c === 1 && b.face < b.wallIn).map(b => [(b.ax - b.bossR - 12) * k, (b.ax + b.bossR + 12) * k]);
        const hline = (xa, xb, y) => { let segs = [[xa, xb]]; gaps.forEach(([a, b]) => { segs = segs.flatMap(([p, q]) => (b <= p || a >= q) ? [[p, q]] : [[p, a], [b, q]].filter(([u, v]) => v - u > 0.3)); }); segs.forEach(([p, q]) => S.sh.line(p, y, q, y, 1)); };
        S.sh.line(x1, yF, x2, yF, 1); hline(x1, geo.xW1 * k, yT); hline(geo.xW2 * k, x2, yT);
        S.sh.line(x1, yF, x1, yT, 1).line(x2, yF, x2, yT, 1);
        S.sh.dimV(x1, yF, x1, geo.ys * k, x1 - 12, nf(geo.ys - geo.yFeet, 0));
      }
      sectionDims(S, R, R.task, k);
      return S;
    };
    // все виды при масштабах k1 (основной) и k2 (неосновные); позиции — без повторов между видами
    const build = (k1, k2) => {
      const S = mainSec(k1);
      let G2 = null;
      if (V.side) G2 = sideView(A, R, k2 === k1 ? S : sectionView(A, R, V.main, k2), V.main, V.side, k2, MV);
      else if (geo && root.DRWVERT) G2 = root.DRWVERT.topView(A, R, geo, k2);
      else if (V.second) { G2 = sectionView(A, R, V.second, k2, MS && MS.second ? { model: MS.second } : {}); sectionDims(G2, R, R.task, k2); }
      const Nm = cr(V.main.u, V.main.v), cutM = A.shafts.length ? dot(A.shafts[0].pos, Nm) : 0;
      accessories(S.sh, k1, F0, V.main.u, V.main.v, S.items, { cut: cutM });
      extraFasteners(S.sh, k1, MF, V.main.u, V.main.v, S.items, { cut: cutM, draw: R.task === 3 });
      if (G2 && V.side) accessories(G2.sh, k2, F0, V.side.h, V.side.up, G2.items, {});
      else if (G2 && geo) { accessories(G2.sh, k2, F0, [1, 0, 0], [0, 0, -1], G2.items, { lid: false }); extraFasteners(G2.sh, k2, MF, [1, 0, 0], [0, 0, -1], G2.items, { draw: false }); }
      else if (G2 && V.second) { const w = A.wheels.find(q => q.kind === 'wormwheel'); const N2 = cr(V.second.u, V.second.v); accessories(G2.sh, k2, F0, V.second.u, V.second.v, G2.items, { cut: w ? dot(w.pos, N2) : 0 }); const skip = new Set(S.items.filter(q => q.kind === 'boltSet').map(q => 'b' + q.d + 'x' + q.L)); extraFasteners(G2.sh, k2, MF, V.second.u, V.second.v, G2.items, { cut: w ? dot(w.pos, N2) : 0, hiddenFallback: true, skip }); }
      const used = new Set(), list = [], list2 = [], listE = [];
      const take = (items, arr) => items.forEach(it => { const p = find(it); if (p && !used.has(p)) { used.add(p); arr.push(Object.assign({ pos: p }, it)); } });
      take(S.items, list);
      if (G2) take(G2.items, list2);
      const E = MX && V.extra ? modelView(A, R, MX, Fx, V.extra.u, V.extra.v, k2) : null;
      if (E) take(E.items, listE);
      if (V.second) { const w = A.wheels.find(q => q.kind === 'wormwheel'); if (w) { const bbm = S.sh.bbox(0); const x = dot(w.pos, V.main.u) * k1; S.sh.cutV(x, bbm.y1 - 2, bbm.y2 + 2, 'Б', 'r'); } }
      positions(S.sh, list);
      if (G2) positions(G2.sh, list2);
      if (E) positions(E.sh, listE);
      // надписи над неосновными видами: Б–Б и масштаб, если он отличается от масштаба основного вида
      const lab = (sh2, txt) => { if (!txt) return; const bb = sh2.bbox(0); sh2.text((bb.x1 + bb.x2) / 2, bb.y2 + 4, txt, { h: 7, anchor: 'cb' }); };
      const kt2 = k2 !== k1 ? '(' + (SC.find(q => q[0] === k2) || [0, ''])[1] + ')' : '';
      if (G2) lab(G2.sh, V.second ? 'Б–Б' + (kt2 ? ' ' + kt2 : '') : kt2);
      if (E) lab(E.sh, kt2);
      return { S, G2, E, onlyE: listE.length > 0 };
    };
    // общая точка для проекционной связи при разных масштабах — середина между осями валов
    const mid = ax => A.shafts.reduce((s, q) => s + dot(q.pos, ax), 0) / Math.max(1, A.shafts.length);
    const al = (dRef, kRef, kNew, c) => dRef + c * (kRef - kNew);
    for (const fmt of ['A1']) for (const [k, kt] of SC) for (const [k2] of SC.filter(q => q[0] <= k)) {
      const B = build(k, k2);
      const { S, G2, E } = B;
      const DBG = root.ASMDBG ? (m => root.ASMDBG.push(kt + '/' + k2 + ' ' + m)) : () => {};
      for (const withE of (E ? [true, false] : [false])) {
        if (!withE && B.onlyE) break;                 // без третьего вида пропали бы позиции
        const sh = new Sheet(fmt, true);
        const f = sh.frame;
        sh.occupy(sh.stamp, 2); sh.occupy(sh.reserved(), 2);
        // технические требования и характеристика над основной надписью
        const W = 185, h1 = notesH(notes.tech, W), h2 = notesH(notes.req, W);
        let y0 = sh.stamp.y2 + 8;
        sh.notes(sh.stamp.x1 + 2, y0, W - 4, notes.req, { title: 'Технические требования' }); const rq = { x1: sh.stamp.x1, y1: y0 - 2, x2: f.x2 - 2, y2: y0 + h2 + 9 }; sh.occupy(rq, 2);
        y0 = rq.y2 + 8;
        sh.notes(sh.stamp.x1 + 2, y0, W - 4, notes.tech, { title: 'Техническая характеристика' }); sh.occupy({ x1: sh.stamp.x1, y1: y0 - 2, x2: f.x2 - 2, y2: y0 + h1 + 9 }, 2);
        const mb = S.sh.bbox(0);
        if (R.task === 6 && G2) {
          // вид вдоль валов — вверху слева; основной разрез по разъёму — под ним (по горизонтали); вид слева — справа (по высоте)
          const gb = G2.sh.bbox(0), cH = mid(V.main.u);
          // основной разрез — внизу слева, над ним вид вдоль валов (по горизонтали в проекционной связи)
          const gb0 = G2.sh.bbox(0), cH0 = mid(V.main.u), sL6 = Math.max(0, mb.x1 - (gb0.x1 + cH0 * (k - k2)));
          const ps = DR.placeGroup(sh, S.sh.p, { near: [f.x1 + 10 + sL6 + (mb.x2 - mb.x1) / 2, f.y1 + 10 + (mb.y2 - mb.y1) / 2] });
          if (!ps) { DBG('S ' + withE); continue; }
          const pg = DR.placeGroup(sh, G2.sh.p, { fixX: al(ps.dx, k, k2, cH), near: [0, ps.box.y2 + 12 + (gb.y2 - gb.y1) / 2] });
          if (!pg) { DBG('G2 ' + withE); continue; }
          let pe = null;
          if (withE) { const eb = E.sh.bbox(0); pe = DR.placeGroup(sh, E.sh.p, { fixY: pg.dy, near: [pg.box.x2 + 20 + (eb.x2 - eb.x1) / 2, 0] }); if (!pe) continue; }
          return { sh, scale: kt, k, fmt };
        }
        // вид под основным (по X) может быть шире слева — основной сдвигается вправо
        const below = geo ? G2 : (withE ? E : null), cX = mid(V.main.u);
        const sLb = below ? Math.max(0, mb.x1 - (below.sh.bbox(0).x1 + cX * (k - k2))) : 0;
        const pl = DR.placeGroup(sh, S.sh.p, { near: [f.x1 + 10 + sLb + (mb.x2 - mb.x1) / 2, f.y2 - 10 - (mb.y2 - mb.y1) / 2] });
        if (!pl) continue;
        let p2 = null;
        if (G2) {
          const gb = G2.sh.bbox(0);
          p2 = geo ? DR.placeGroup(sh, G2.sh.p, { fixX: al(pl.dx, k, k2, mid([1, 0, 0])), near: [0, pl.box.y1 - 12 - (gb.y2 - gb.y1) / 2] }) : DR.placeGroup(sh, G2.sh.p, { fixY: al(pl.dy, k, k2, mid(V.main.v)), near: [pl.box.x2 + 20 + (gb.x2 - gb.x1) / 2, 0] });
          if (!p2) continue;
        }
        let pe = null;
        if (withE) { const eb = E.sh.bbox(0); pe = R.task === 1 ? DR.placeGroup(sh, E.sh.p, { fixY: al(pl.dy, k, k2, mid(V.main.v)), near: [pl.box.x2 + 20 + (eb.x2 - eb.x1) / 2, 0] }) : DR.placeGroup(sh, E.sh.p, { fixX: al(pl.dx, k, k2, mid(V.main.u)), near: [0, pl.box.y1 - 12 - (eb.y2 - eb.y1) / 2] }); if (!pe) continue; }
        return { sh, scale: kt, k, fmt };
      }
    }
    return null;
  }
  function notesH(items, W) { let n = 0; items.forEach(t => { n += C.wrap(String(t), W - 8, 3.5).length; }); return n * 3.5 * 1.65; }
  function asmNotes(R, spec) {
    const K = R.K || {};
    const last = R.task === 6 ? { T: K.TIII, n: K.nIII } : R.task === 3 ? { T: K.TII, n: K.nII } : { T: K.T2T || (R.K && R.K.T2T), n: K.n2T };
    const u = R.task === 6 ? R.ub * R.ut : R.task === 3 ? R.g.uf : R.ured;
    const shim = (() => { let p = ''; spec.sections.forEach(sc => sc.items.forEach(it => { if (/прокладок/.test(it.name)) p = it.pos; })); return p; })();
    const req = ['1. *Размеры для справок.',
      '2. Плоскость разъёма покрыть тонким слоем герметика УТ-34 ГОСТ 24285-80 при окончательной сборке.',
      '3. После сборки валы редуктора должны проворачиваться свободно, без стуков и заеданий.',
      `4. Осевую игру подшипников регулировать набором прокладок${shim ? ' поз. ' + shim : ''}.`,
      '5. Наружные поверхности корпуса красить серой эмалью ПФ-115 ГОСТ 6465-76.',
      `6. В редуктор залить масло ${R.oil || 'И-Г-А-46'} ГОСТ 17479.4-87${R.V ? ' в количестве ' + nf(R.V, 1) + ' л' : ''}.`,
      '7. Перед эксплуатацией обкатать без нагрузки не менее 1 ч; течь масла и нагрев подшипниковых узлов выше 80 °C не допускаются.'];
    const nFast = (R.motor && R.motor.n) || K.nI || K.n1;
    // техническая характеристика редуктора — по методичке: частота быстроходного вала, момент на тихоходном, передаточное отношение
    const tech = [`1. Частота вращения быстроходного вала ${nf(nFast, 0)} мин⁻¹.`, `2. Вращающий момент на тихоходном валу ${nf(last.T, 1)} Н·м.`, `3. Передаточное отношение ${nf(u, 2)}.`, `4. Частота вращения тихоходного вала ${nf(last.n, 1)} мин⁻¹.`];
    return { req, tech };
  }

  /* ================================================================ КОРПУС И КРЫШКА КОРПУСА */
  const PLAN = { 1: { u: [1, 0, 0], v: [0, 0, 1], n: [0, 1, 0] }, 6: { u: [0, 1, 0], v: [-1, 0, 0], n: [0, 0, 1] }, 3: { u: [1, 0, 0], v: [0, 1, 0], n: [0, 0, 1] } };
  const ELEV = { 1: { h: [1, 0, 0], up: [0, 1, 0], along: [0, 0, 1] }, 6: { h: [0, 1, 0], up: [0, 0, 1], along: [1, 0, 0] }, 3: { h: [1, 0, 0], up: [0, 0, 1], along: [0, 1, 0] } };
  function splitHeight(A, R, side) { // высота плоскости разъёма: ось тихоходного вала (задание 3 — ось колеса)
    const w = A.wheels.find(q => q.kind === 'wormwheel');
    if (w) return dot(w.pos, side.up);
    return 0;
  }
  function housingGeom(A, R, k) {
    // в плоскость разъёма попадают только валы, лежащие в ней (червяк — ниже разъёма)
    const us = splitHeight(A, R, ELEV[R.task]);
    const A2 = Object.assign({}, A, { shafts: A.shafts.filter(s => Math.abs(dot(s.pos, ELEV[R.task].up) - us) < 1) });
    const S = sectionView(A2, R, PLAN[R.task], k);
    const H = R.H || {};
    const Kf = (H.K || 24) * k, Dl = (H.del || 8) * k;
    // фланец разъёма: полость, расширенная на δ + K
    const FS = new RectSet();
    S.cavs.forEach(cv => FS.add({ x1: cv.x1 - Dl - Kf, y1: cv.y1 - Dl - Kf, x2: cv.x2 + Dl + Kf, y2: cv.y2 + Dl + Kf }));
    S.bosses.forEach(b => FS.add(b.rect));
    // приливы фланца под стяжные болты у подшипниковых гнёзд: ширина K ≈ 3·d от наружной стенки (методичка, п. 1.8),
    // d — диаметр этих болтов (dкп)
    { const K2 = 3 * (H.d2 || 12) * k, dh2_ = ((H.d2 || 12) + 1) * k;
      S.bosses.forEach(b => { const dir = Math.sign(b.face - b.wallIn) || 1, w0 = b.wallIn + dir * Dl, w1 = w0 + dir * K2, lat = b.bossR + 2.2 * dh2_;
        FS.add(b.c === 0 ? { x1: Math.min(w0, w1), x2: Math.max(w0, w1), y1: b.ax - lat, y2: b.ax + lat } : { y1: Math.min(w0, w1), y2: Math.max(w0, w1), x1: b.ax - lat, x2: b.ax + lat }); }); }
    // фланец не должен выступать за торцы приливов: там садятся крышки подшипников (и проходят концы валов) —
    // перед каждым торцом прилива фланец вырезается на ширину прилива
    S.bosses.forEach(b => {
      const dir = Math.sign(b.face - b.wallIn) || 1, f = b.face, far = f + dir * 1000 * k, w = b.bossR + 1 * k;
      const a1 = Math.min(f, far), a2 = Math.max(f, far);
      FS.sub(b.c === 0 ? { x1: a1, x2: a2, y1: b.ax - w, y2: b.ax + w } : { y1: a1, y2: a2, x1: b.ax - w, x2: b.ax + w });
    });
    S.bosses.forEach(b => FS.add(b.rect));
    const fl = FS.solve();
    let fb = null; fl.rects.forEach(r => { fb = fb ? { x1: Math.min(fb.x1, r.x1), y1: Math.min(fb.y1, r.y1), x2: Math.max(fb.x2, r.x2), y2: Math.max(fb.y2, r.y2) } : Object.assign({}, r); });
    const inWall = (x, y) => S.cavs.some(cv => x > cv.x1 - Dl - 0.5 && x < cv.x2 + Dl + 0.5 && y > cv.y1 - Dl - 0.5 && y < cv.y2 + Dl + 0.5);
    const inFl = (x, y) => fl.rects.some(r => x >= r.x1 && x <= r.x2 && y >= r.y1 && y <= r.y2);
    // отверстия под стяжные болты у подшипников (через приливы) и по фланцу
    const d2 = (H.d2 || 12), d3 = (H.d3 || 10), dh2 = d2 + 1, dh3 = d3 + 1;
    const holes2 = [], holes3 = [], pins = [];
    // отверстие допустимо, если вся окружность (с запасом под шайбу) лежит во фланце и не задевает стенки полости
    const holeOk = (p, dh) => {
      // m — зазор от стенки до оси отверстия: под шайбу и гайку (D шайбы ≈ 1,75d)
      const r = (dh * 0.9) * k, m = (dh * 0.9 + 1) * k;
      if (S.cavs.some(cv => p[0] > cv.x1 - Dl - m && p[0] < cv.x2 + Dl + m && p[1] > cv.y1 - Dl - m && p[1] < cv.y2 + Dl + m)) return false;
      // не задевать расточки под подшипники (у соседних валов приливы могут сходиться)
      if (S.bores.some(b => p[0] > b.x1 - r - 2 * k && p[0] < b.x2 + r + 2 * k && p[1] > b.y1 - r - 2 * k && p[1] < b.y2 + r + 2 * k)) return false;
      // и стакан вала-шестерни
      if (S.inPlane.some(sf => sf.tube && p[0] > sf.tube.x1 - r && p[0] < sf.tube.x2 + r && p[1] > sf.tube.y1 - r && p[1] < sf.tube.y2 + r)) return false;
      for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; if (!inFl(p[0] + r * Math.cos(a), p[1] + r * Math.sin(a))) return false; }
      return true;
    };
    S.bosses.forEach(b => {
      // стяжной болт у подшипника: сразу за наружной поверхностью стенки (зазор под шайбу и гайку), сбоку от расточки
      const dir = Math.sign(b.face - b.wallIn) || 1, mm = (dh2 * 0.9 + 1.5) * k, along = b.wallIn + dir * (Dl + mm), off = b.D + 1.15 * d2 * k;
      for (const sg of [-1, 1]) for (const o2 of [off, b.bossR + 0.9 * dh2 * k, b.bossR + 1.2 * dh2 * k]) { const p = b.c === 0 ? [along, b.ax + sg * o2] : [b.ax + sg * o2, along]; if (holeOk(p, dh2) && !holes2.some(q => Math.hypot(q[0] - p[0], q[1] - p[1]) < 2.2 * dh2 * k)) { holes2.push(p); break; } }
    });
    const step = Math.max(120, 12 * d3) * k;
    // болты dк по длинным сторонам — по середине основного фланца (ширина K от стенки), не по приливам
    const cb = S.cavs.reduce((a, c) => a ? { x1: Math.min(a.x1, c.x1), y1: Math.min(a.y1, c.y1), x2: Math.max(a.x2, c.x2), y2: Math.max(a.y2, c.y2) } : Object.assign({}, c), null);
    const fr = { x1: cb.x1 - Dl - Kf, y1: cb.y1 - Dl - Kf, x2: cb.x2 + Dl + Kf, y2: cb.y2 + Dl + Kf };
    [[fr.y1 + Kf / 2, 'x'], [fr.y2 - Kf / 2, 'x']].forEach(([yy]) => {
      const n = Math.max(2, Math.round((fr.x2 - fr.x1 - Kf) / step) + 1);
      for (let i = 0; i < n; i++) { const x = fr.x1 + Kf / 2 + (fr.x2 - fr.x1 - Kf) * i / (n - 1); const p = [x, yy]; if (holeOk(p, dh3) && !holes2.concat(holes3).some(q => Math.hypot(q[0] - p[0], q[1] - p[1]) < 3 * dh3 * k)) holes3.push(p); }
    });
    [[fr.x1 + Kf / 2, 'y'], [fr.x2 - Kf / 2, 'y']].forEach(([xx]) => {
      const n = Math.max(2, Math.round((fr.y2 - fr.y1 - Kf) / step) + 1);
      for (let i = 1; i < n - 1; i++) { const y = fr.y1 + Kf / 2 + (fr.y2 - fr.y1 - Kf) * i / (n - 1); const p = [xx, y]; if (holeOk(p, dh3) && !holes2.concat(holes3).some(q => Math.hypot(q[0] - p[0], q[1] - p[1]) < 3 * dh3 * k)) holes3.push(p); }
    });
    // штифты — по диагонали
    const cand = [[fb.x1 + Kf * 0.5, fb.y1 + Kf * 0.5], [fb.x2 - Kf * 0.5, fb.y2 - Kf * 0.5], [fb.x1 + Kf * 0.5, fb.y2 - Kf * 0.5], [fb.x2 - Kf * 0.5, fb.y1 + Kf * 0.5]];
    // штифты — как можно дальше друг от друга по диагонали; кандидаты — углы и точки вдоль кромок фланца
    for (let t = 0; t <= 1.0001; t += 0.025) { const x = fb.x1 + (fb.x2 - fb.x1) * t, y = fb.y1 + (fb.y2 - fb.y1) * t; cand.push([x, fb.y1 + Kf * 0.5], [x, fb.y2 - Kf * 0.5], [fb.x1 + Kf * 0.5, y], [fb.x2 - Kf * 0.5, y]); }
    const okPin = p => holeOk(p, 9) && !holes2.concat(holes3).some(q => Math.hypot(q[0] - p[0], q[1] - p[1]) < 2.5 * dh3 * k);
    const pc = cand.filter(okPin);
    if (pc.length) {
      const a = pc.reduce((m, p) => (p[0] + p[1] < m[0] + m[1] ? p : m));
      const b = pc.reduce((m, p) => (Math.hypot(p[0] - a[0], p[1] - a[1]) > Math.hypot(m[0] - a[0], m[1] - a[1]) ? p : m));
      pins.push(a); if (Math.hypot(b[0] - a[0], b[1] - a[1]) > 50 * k) pins.push(b);
    }
    return { S, fl, fb, holes2, holes3, pins, dh2, dh3, Kf, Dl };
  }

  /* вид на плоскость разъёма (сверху для корпуса, снизу для крышки) */
  function housingPlan(G, R, k, part) {
    const sh = new Sheet('A1', true); sh.frame = { x1: -1e5, y1: -1e5, x2: 1e5, y2: 1e5 };
    const S = G.S, H = R.H || {};
    // плоскость разъёма: фланец и стенки минус полость и расточки
    const JS = new RectSet();
    G.fl.rects.forEach(r => JS.add(r)); S.hs.rects.forEach(r => JS.add(r));
    S.cavs.forEach(cv => JS.sub(cv)); S.bores.forEach(b => JS.sub(b));
    JS.solve().edges.forEach(e => sh.line(e[0], e[1], e[2], e[3], 1));
    G.holes2.forEach(p => { sh.circle(p[0], p[1], G.dh2 / 2 * k, 1); sh.line(p[0] - G.dh2 * k * 0.8, p[1], p[0] + G.dh2 * k * 0.8, p[1], 3).line(p[0], p[1] - G.dh2 * k * 0.8, p[0], p[1] + G.dh2 * k * 0.8, 3); });
    G.holes3.forEach(p => { sh.circle(p[0], p[1], G.dh3 / 2 * k, 1); sh.line(p[0] - G.dh3 * k * 0.8, p[1], p[0] + G.dh3 * k * 0.8, p[1], 3).line(p[0], p[1] - G.dh3 * k * 0.8, p[0], p[1] + G.dh3 * k * 0.8, 3); });
    G.pins.forEach(p => { sh.circle(p[0], p[1], 4 * k, 1); });
    // осевые линии расточек
    S.inPlane.forEach(s => { const L = s.segs[s.segs.length - 1].x1; const a = s.P(-10, 0), b = s.P(L + 10, 0); sh.line(a[0], a[1], b[0], b[1], 3); });
    if (part === 'cover') {
      // смотровой люк
      const fb = G.fb, cx = (fb.x1 + fb.x2) / 2, cy = (fb.y1 + fb.y2) / 2, w = Math.min(100 * k, (fb.x2 - fb.x1) * 0.25), h = Math.min(70 * k, (fb.y2 - fb.y1) * 0.25);
      sh.rect(cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2, 4);
      sh.rect(cx - w / 2 - 10 * k, cy - h / 2 - 10 * k, cx + w / 2 + 10 * k, cy + h / 2 + 10 * k, 1);
      for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) sh.circle(cx + sx * (w / 2 + 5 * k), cy + sy * (h / 2 + 5 * k), 3 * k, 1);
      sh.leader(cx + w / 2 + 5 * k, cy + h / 2 + 5 * k, cx + w / 2 + 25, cy + h / 2 + 20, 'М6–7Н', '4 отв.');
    }
    // размеры
    const fb = G.fb;
    sh.dimH(fb.x1, fb.y1, fb.x2, fb.y1, fb.y1 - 14, nf((fb.x2 - fb.x1) / k, 0));
    sh.dimV(fb.x2, fb.y1, fb.x2, fb.y2, fb.x2 + 14, nf((fb.y2 - fb.y1) / k, 0));
    const par = S.inPlane.filter(s => !s.cartridge);
    // привязка первой оси к краю фланца
    if (par[0]) { const s0 = par[0]; if (s0.horiz) sh.dimV(fb.x1, fb.y1, fb.x1, s0.o[1], fb.x1 - 22, nf((s0.o[1] - fb.y1) / k, 0)); else sh.dimH(fb.x1, fb.y1, s0.o[0], fb.y1, fb.y1 - 22, nf((s0.o[0] - fb.x1) / k, 0)); }
    // выноски отверстий
    const call = (list, d, txt2) => { if (!list.length) return; const p = list[0]; sh.attempt([[14, 14], [-14, 14], [14, -14], [-14, -14]].map(([dx, dy]) => () => sh.leader(p[0] + Math.sign(dx) * d / 2 * k * 0.7, p[1] + Math.sign(dy) * d / 2 * k * 0.7, p[0] + dx, p[1] + dy, `⌀${nf(d, 0)}`, `${list.length} ${txt2}`, { side: dx > 0 ? 'r' : 'l' }))); };
    call(G.holes2, G.dh2, 'отв.'); call(G.holes3, G.dh3, 'отв.');
    if (G.pins.length) { const p = G.pins[0]; sh.attempt([[14, 14], [-14, 14], [14, -14], [-14, -14]].map(([dx, dy]) => () => sh.leader(p[0] + Math.sign(dx) * 2.8 * k, p[1] + Math.sign(dy) * 2.8 * k, p[0] + dx, p[1] + dy, '⌀8H7', `${G.pins.length} отв.`, { side: dx > 0 ? 'r' : 'l' }))); }
    // шероховатость плоскости разъёма, плоскостность
    const pt = G.holes3[0] || [fb.x1 + G.Kf / 2, fb.y1 + G.Kf / 2];
    sh.attempt([[6, 4], [-14, 4], [6, -12]].map(([dx, dy]) => () => sh.rough(pt[0] + dx, pt[1] + dy, 'Ra 1,6')));
    return { sh };
  }

  /* вид спереди (вдоль осей валов): основание или крышка с расточками */
  function housingElev(G, A, R, k, part) {
    const sh = new Sheet('A1', true); sh.frame = { x1: -1e5, y1: -1e5, x2: 1e5, y2: 1e5 };
    const side = ELEV[R.task], view1 = PLAN[R.task], S = G.S;
    const H = R.H || {}, del = (H.del || 8) * k, gap = (H.gap || 10) * k, gB = (H.gapBot || 30) * k;
    const ih = Math.abs(dot(side.h, view1.u)) > 0.5 ? 0 : 1;
    const hOf = p => dot(p, side.h) * k;
    const us = splitHeight(A, R, side) * k;
    const uOf = p => dot(p, side.up) * k - us;
    const hx1 = Math.min(...S.cavs.map(c => ih === 0 ? c.x1 : c.y1)) - del, hx2 = Math.max(...S.cavs.map(c => ih === 0 ? c.x2 : c.y2)) + del;
    const par = A.shafts.filter(s => Math.abs(dot(s.ax, side.along)) > 0.9).map(s => {
      const wl = A.wheels.filter(w => Math.abs(dot(w.ax, side.along)) > 0.9 && Math.abs(hOf(w.pos) - hOf(s.pos)) < 1);
      const rW = Math.max(0, ...wl.map(w => ((w.g.daM || w.g.da || w.g.dae) / 2) * k), ...s.segs.filter(g => g.gear).map(g => g.r * k));
      const D = s.b ? s.b.D / 2 * k : 30 * k, bossR = D + (2.1 * (H.dks || 8) + 6) * k;
      return { s, h: hOf(s.pos), u: uOf(s.pos), rW, D, bossR };
    });
    const allR = Math.max(...A.wheels.map(w => ((w.g.daM || w.g.da || w.g.dae) / 2) * k), ...par.map(p => p.rW));
    const minU = Math.min(0, ...par.map(p => p.u - p.rW), ...A.shafts.map(q => uOf(q.pos) - Math.max(...q.segs.map(g => g.r)) * k), ...A.wheels.map(w => uOf(w.pos) - ((w.g.daM || w.g.da || w.g.dae) / 2) * k * (Math.abs(dot(w.ax, side.along)) > 0.9 ? 1 : 0)));
    // крышки подшипников валов, лежащих ниже разъёма (червяк), не должны садиться на опорную плиту: плита — ниже их
    const covLow = Math.min(Infinity, ...A.shafts.filter(q => q.b && Math.abs(dot(q.ax, side.h)) > 0.9).map(q => uOf(q.pos) - (q.b.D / 2 + 2.2 * (H.dks || 8) + 4) * k));
    const yb = Math.min(minU - gB - del, covLow - (H.p || 18) * k - 3 * k), pF = (H.p || 18) * k, K = (H.K || 24) * k, K1 = (H.K1 || 20) * k + 8 * k, tf = 1.5 * del;
    void allR;
    const bores = par.filter(p => Math.abs(p.u) < 1);      // расточки в плоскости разъёма — полуокружности
    const full = par.filter(p => Math.abs(p.u) >= 1);      // ниже разъёма (червяк) — полные окружности в основании
    const cutLine = (y, x1, x2, st) => { // отрезок с разрывами под расточки
      let segs = [[x1, x2]];
      bores.forEach(b => { segs = segs.flatMap(([a, c]) => { const l = b.h - b.D, r = b.h + b.D; if (r <= a || l >= c) return [[a, c]]; const o = []; if (l > a) o.push([a, l]); if (r < c) o.push([r, c]); return o; }); });
      segs.forEach(([a, c]) => sh.line(a, y, c, y, st));
    };
    if (part === 'base') {
      sh.line(hx1, yb + pF, hx1, -tf, 1).line(hx2, yb + pF, hx2, -tf, 1);
      sh.poly([[hx1 - K1, yb], [hx2 + K1, yb], [hx2 + K1, yb + pF], [hx1 - K1, yb + pF]], 1);
      sh.line(hx1 - K, -tf, hx2 + K, -tf, 1).line(hx1 - K, -tf, hx1 - K, 0, 1).line(hx2 + K, -tf, hx2 + K, 0, 1);
      cutLine(0, hx1 - K, hx2 + K, 1);
      bores.forEach(b => { sh.arc(b.h, 0, b.D, 180, 360, 1); sh.arc(b.h, 0, b.bossR + 3 * k, 180, 360, 1); sh.line(b.h, b.D + 6, b.h, -b.bossR - 8 * k, 3); sh.line(b.h - b.bossR - 8 * k, 0, b.h + b.bossR + 8 * k, 0, 3); });
      full.forEach(b => { sh.circle(b.h, b.u, b.D, 1); sh.circle(b.h, b.u, b.bossR + 3 * k, 1); sh.line(b.h - b.bossR - 8 * k, b.u, b.h + b.bossR + 8 * k, b.u, 3).line(b.h, b.u - b.bossR - 8 * k, b.h, b.u + b.bossR + 8 * k, 3); });
      // расточки валов ниже разъёма, перпендикулярных виду (червяк): невидимые линии в торцевых стенках
      A.shafts.filter(q => Math.abs(dot(q.ax, side.h)) > 0.9 && uOf(q.pos) < -1).forEach(q => {
        const u = uOf(q.pos), D = q.b ? q.b.D / 2 * k : 30 * k;
        // внутренние приливы торцевых стенок под подшипники червяка (как в 3D-модели)
        const hq = hOf(q.pos), sg = dot(q.ax, side.h), bp = bearingPlaces(q).map(p => [hq + sg * p.a * k, hq + sg * p.b * k].sort((a, b) => a - b));
        const lb = bp.filter(b => (b[0] + b[1]) / 2 < (hx1 + hx2) / 2), rb = bp.filter(b => (b[0] + b[1]) / 2 >= (hx1 + hx2) / 2);
        const xL = lb.length ? Math.max(...lb.map(b => b[1])) + 6 * k : hx1 + del * 1.5, xR = rb.length ? Math.min(...rb.map(b => b[0])) - 6 * k : hx2 - del * 1.5;
        const yTopB = u + D + 2.5 * del, yBotB = yb + pF + del * 0.4;
        sh.line(xL, yBotB, xL, yTopB, 4).line(hx1 + del, yTopB, xL, yTopB, 4).line(xR, yBotB, xR, yTopB, 4).line(xR, yTopB, hx2 - del, yTopB, 4);
        for (const x of [[hx1 - 8 * k, xL], [xR, hx2 + 8 * k]]) { sh.line(x[0], u - D, x[1], u - D, 4).line(x[0], u + D, x[1], u + D, 4); }
        sh.line(hx1 - 14 * k, u, hx2 + 14 * k, u, 3);
        sh.attempt([20, 32, 44].map(dx => () => sh.dimV(hx2 + 8 * k, u - D, hx2 + 8 * k, u + D, hx2 + dx, `⌀${nf(2 * D / k, 0)}H7`)));
      });
      // невидимый контур полости
      sh.line(hx1 + del, yb + pF + del * 0.4, hx2 - del, yb + pF + del * 0.4, 4).line(hx1 + del, yb + pF + del * 0.4, hx1 + del, -tf, 4).line(hx2 - del, yb + pF + del * 0.4, hx2 - del, -tf, 4);
      // фундаментные отверстия
      const d1 = (H.d1 || 16) + 2;
      for (const x of [hx1 - K1 / 2, hx2 + K1 / 2]) { sh.line(x - d1 / 2 * k, yb, x - d1 / 2 * k, yb + pF, 4).line(x + d1 / 2 * k, yb, x + d1 / 2 * k, yb + pF, 4).line(x, yb - 3, x, yb + pF + 3, 3); }
      // сливное отверстие с резьбой
      const dp = (H.dpr || 16) * k, xp = hx1 + del + dp * 1.5, yp = yb + pF + dp * 0.9;
      sh.circle(xp, yp, dp / 2, 1); sh.arc(xp, yp, dp / 2 * 1.15, 0, 270, 2);
      sh.attempt([[18, 16], [18, 30], [26, -14], [40, 22]].map(([dx, dy]) => () => sh.leader(xp + dp * 0.4 * Math.sign(dx), yp + dp * 0.4 * Math.sign(dy), xp + dx, yp + dy, `М${H.dpr || 16}×1,5–7Н`, '')));
      sh.feet = { hx1, hx2, K1, yb, pF, d1, us };
      // размеры
      const xr = hx2 + K1;
      sh.dimV(xr, yb, (bores[0] || par[0] || { h: hx2 }).h, 0, xr + 12, nf(-yb / k, 0) + '±0,2');
      sh.dimV(xr, yb, xr, yb + pF, xr + 22, nf(pF / k, 0));
      sh.dimV(hx1 - K, -tf, hx1 - K, 0, hx1 - K - 12, nf(tf / k, 0));
      sh.dimH(hx1 - K1, yb, hx2 + K1, yb, yb - 12, nf((hx2 - hx1 + 2 * K1) / k, 0));
      sh.dimH(hx1 - K1 / 2, yb, hx2 + K1 / 2, yb, yb - 21, nf((hx2 - hx1 + K1) / k, 0));
      sh.leader(hx1 - K1 / 2 + d1 / 2 * k, yb + pF * 0.6, hx1 - K1 / 2 - 14, yb + pF + 14, `⌀${d1}`, '4 отв.', { side: 'l' });
    } else {
      const env = x => { let m = 0; par.forEach(p => { const R0 = Math.max(p.rW + gap + del, p.bossR + 4 * k); const dx = x - p.h; if (Math.abs(dx) < R0) m = Math.max(m, Math.sqrt(R0 * R0 - (dx) * (dx)) + p.u); }); return Math.max(m, tf + 18 * k); };
      const top = []; const n = 80;
      for (let i = 0; i <= n; i++) { const x = hx1 + (hx2 - hx1) * i / n; top.push([x, env(x)]); }
      sh.poly([[hx1, tf]].concat(top).concat([[hx2, tf]]), 1, false);
      const inner = top.map(([x, y]) => [x, y - del]).filter(([x]) => x > hx1 + del && x < hx2 - del);
      if (inner.length > 1) sh.poly(inner, 4, false);
      sh.line(hx1 - K, tf, hx2 + K, tf, 1).line(hx1 - K, 0, hx1 - K, tf, 1).line(hx2 + K, 0, hx2 + K, tf, 1);
      cutLine(0, hx1 - K, hx2 + K, 1);
      bores.forEach(b => { sh.arc(b.h, 0, b.D, 0, 180, 1); sh.arc(b.h, 0, b.bossR + 3 * k, 0, 180, 1); sh.line(b.h, -6, b.h, b.bossR + 8 * k, 3); sh.line(b.h - b.bossR - 8 * k, 0, b.h + b.bossR + 8 * k, 0, 3); });
      // смотровой люк
      const xm = par.length ? (par[0].h + par[par.length - 1].h) / 2 : (hx1 + hx2) / 2, w = Math.min(100 * k, (hx2 - hx1) * 0.3), yt = env(xm);
      sh.poly([[xm - w / 2 - 10 * k, yt], [xm + w / 2 + 10 * k, yt], [xm + w / 2 + 10 * k, yt + 4 * k], [xm - w / 2 - 10 * k, yt + 4 * k]], 1);
      // размеры
      const yTop = Math.max(...top.map(p => p[1]));
      sh.dimV(hx2 + K, 0, (hx1 + hx2) / 2, yTop, hx2 + K + 14, nf(yTop / k, 0));
      sh.dimV(hx1 - K, 0, hx1 - K, tf, hx1 - K - 12, nf(tf / k, 0));
      sh.dimH(hx1 - K, 0, hx2 + K, 0, -14, nf((hx2 - hx1 + 2 * K) / k, 0));
    }
    // расточки: диаметры, межосевые, база и допуски
    bores.forEach((b, i) => {
      const y = part === 'base' ? 6 + (i % 2) * 7 : -6 - (i % 2) * 7;
      sh.attempt([y, y + (part === 'base' ? 14 : -14)].map(yy => () => sh.dimH(b.h - b.D, 0, b.h + b.D, 0, yy, `⌀${nf(2 * b.D / k, 0)}H7`)));
    });
    full.forEach(b => sh.attempt([0, 1].map(q => () => sh.dimH(b.h - b.D, b.u, b.h + b.D, b.u, b.u + b.D + 8 + q * 8, `⌀${nf(2 * b.D / k, 0)}H7`))));
    if (bores.length) {
      const b0 = bores[0];
      sh.datum(b0.h - b0.D, 0, part === 'base' ? 270 : 90, 'А', { len: 10 });
      bores.slice(1).forEach(b => { const tx = b.h + b.D * 0.7, ty = part === 'base' ? -b.D * 0.71 : b.D * 0.71; sh.attempt([[10, -18], [10, 18], [-30, -18]].map(([dx, dy]) => () => sh.tol(tx + dx, ty + dy, ['par', '0,03', 'А'], { from: dx > 0 ? 'l' : 'r', to: [tx, ty] }))); });
      for (let i = 0; i + 1 < bores.length; i++) { const a = bores[i], b = bores[i + 1]; sh.attempt([0, 9].map(d => () => sh.dimH(a.h, 0, b.h, 0, (part === 'base' ? yb - 30 : 0) - d - (part === 'base' ? 0 : 26), nf(Math.abs(b.h - a.h) / k, 0) + '±' + nf(FA(Math.abs(b.h - a.h) / k), 3)))); }
    }
    // плоскостность разъёма
    sh.attempt([[-30, 10], [-30, -18], [10, 12]].map(([dx, dy]) => () => sh.tol(hx1 - K + dx, dy, ['flat', '0,05'], { from: dx < 0 ? 'r' : 'l', to: [hx1 - K * 0.4, 0] })));
    bores.forEach(b => sh.attempt([0.3, -0.3].map(q => () => sh.rough(b.h + b.D * Math.cos((part === 'base' ? 270 : 90) * D2R + q) , (part === 'base' ? -1 : 1) * b.D * 0.999, 'Ra 1,6', { rot: 0 }))));
    return { sh, feet: sh.feet };
  }

  /* ================================================================ КОРПУС И КРЫШКА (задания 3, 6) — по описанию корпуса
     Те же операции, по которым строится деталь в КОМПАС (M3D.housing3d): точные виды с учётом вырезов (rayView)
     и разрез (section2d). Главный вид — вдоль валов, под ним — вид сверху, справа — разрез А–А по оси расточки. */
  const crs = (u, v) => [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  const NRMI = { XOY: 2, XOZ: 1, YOZ: 0 }, CANI = { XOY: [0, 1], XOZ: [0, 2], YOZ: [1, 2] };
  // круглые вырезы, видимые вдоль N: [{op, c: мировой центр (на торце), r}]
  function holesAlong(ops, N) {
    const out = [];
    ops.forEach(op => {
      if (!op.cut) return;
      const n = NRMI[op.base], c = CANI[op.base];
      if (Math.abs(N[n]) < 0.9) return;
      op.loops.forEach(l => { if (!l.c) return; const p = [0, 0, 0]; p[c[0]] = l.c[0]; p[c[1]] = l.c[1]; p[n] = N[n] > 0 ? op.b : op.a; out.push({ op, c: p, r: l.c[2] }); });
    });
    return out;
  }
  function holeText(name, r) {
    const d = 2 * r, M = [4, 5, 6, 8, 10, 12, 14, 16, 18, 20, 24];
    const md = M.reduce((a, q) => Math.abs(q * 0.42 * 2 - d) < Math.abs(a * 0.42 * 2 - d) ? q : a, M[0]);
    if (/пробк/.test(name)) return `М${nf(d, 0)}×1,5–7Н`;
    if (/М16 под маслоуказатель/.test(name)) return 'М16–7Н';
    if (/резьбов/.test(name)) return `М${md}–7Н`;
    if (/штифт/.test(name)) return `⌀${nf(d, 0)}H7`;
    return `⌀${nf(d, d % 1 ? 1 : 0)}`;
  }
  function housingPartSheet(R, P, T, H3, part, code) {
    const A = asmData(R, P, T), H = R.H || {}, EV = ELEV[R.task];
    const ops = part === 'base' ? H3.baseOps : H3.coverOps;
    const Um = EV.h, Vm = EV.up, Nm = crs(Um, Vm), Ut = Um, Vt = crs(Vm, Um), Us = Nm, Vs = Vm, Ns = Um.map(x => -x);
    const vM = root.M3D.rayView(ops, Um, Vm), vT = root.M3D.rayView(ops, Ut, Vt);
    const us = H3.lvl.us, zB = H3.lvl.zBot;
    // расточки, видимые на главном виде (по одной на вал)
    const bores = [];
    holesAlong(ops, Nm).filter(h => /^расточка/.test(h.op.n)).forEach(h => { const s = dot(h.c, Um); if (!bores.some(b => Math.abs(dot(b.c, Um) - s) < 1 && Math.abs(dot(b.c, Vm) - dot(h.c, Vm)) < 1)) bores.push(h); });
    bores.sort((a, b) => dot(a.c, Um) - dot(b.c, Um));
    const big = bores.reduce((a, b) => (!a || b.r > a.r) ? b : a, null);
    const cutS = big ? dot(big.c, Ns) : dot(A.shafts[0].pos, Ns);
    const secOps = ops.filter(o => !/отверсти[ея] под (болт|штифт)/.test(o.n));
    const sec = root.M3D.section2d(secOps, Us, Vs, crs(Us, Vs), cutS);
    const callouts = new Set();
    const make = (k) => {
      const mk = () => { const s = new Sheet('A1', true); s.frame = { x1: -1e5, y1: -1e5, x2: 1e5, y2: 1e5 }; return s; };
      const draw = (sh, rv) => { rv.lines.forEach(pl => sh.poly(pl.map(([x, y]) => [x * k, y * k]), 1, false)); (rv.arcs || []).forEach(([cx, cy, r, a1, a2]) => { if (a2 - a1 >= 359.5) sh.circle(cx * k, cy * k, r * k, 1); else sh.arc(cx * k, cy * k, r * k, a1, a2, 1); }); };
      const callHoles = (sh, rv, U, V, N, skipBores) => {
        const X = p => dot(p, U) * k, Y = p => dot(p, V) * k;
        const groups = new Map();
        holesAlong(ops, N).forEach(h => {
          if (skipBores && /^расточка/.test(h.op.n)) return;
          if (/срез|полость|люк$|лапах/.test(h.op.n)) return;
          // видна: внутри глубже, чем вокруг (или насквозь)
          const s = dot(h.c, U), t = dot(h.c, V), din = rv.depth(s, t), dout = Math.max(rv.depth(s + h.r + 1.2, t), rv.depth(s - h.r - 1.2, t), rv.depth(s, t + h.r + 1.2), rv.depth(s, t - h.r - 1.2));
          if (dout < -1e8 || !(din < dout - 0.8)) return;
          const txt = holeText(h.op.n, h.r), key = txt + '|' + h.op.n.replace(/\s\d+$/, '');
          if (/резьбов/.test(h.op.n) || /пробк/.test(h.op.n)) sh.arc(X(h.c), Y(h.c), (/пробк/.test(h.op.n) ? h.r * 1.08 : h.r / 0.84) * k, 0, 270, 2);
          if (!groups.has(key)) groups.set(key, { txt, list: [] });
          const g = groups.get(key); if (!g.list.some(q => Math.hypot(dot(q.c, U) - s, dot(q.c, V) - t) < 0.5)) g.list.push(h);
        });
        groups.forEach((g, key) => {
          if (callouts.has(key)) return; callouts.add(key);
          const h = g.list[0], x = X(h.c), y = Y(h.c), r = h.r * k;
          const n = g.list.length;
          sh.attempt([[16, 14], [-16, 14], [16, -14], [-16, -14], [24, 24], [-24, 24], [24, -24], [-24, -24]].map(([dx, dy]) => () => sh.leader(x + Math.sign(dx) * r * 0.7, y + Math.sign(dy) * r * 0.7, x + dx, y + dy, g.txt, n > 1 ? `${n} отв.` : '', { side: dx > 0 ? 'r' : 'l' })));
        });
      };
      // ---------- главный вид
      const sM = mk(), XM = p => dot(p, Um) * k, YM = p => dot(p, Vm) * k;
      draw(sM, vM);
      const pM = vM.lines.flat(), bxM = { x1: Math.min(...pM.map(q => q[0])) * k, x2: Math.max(...pM.map(q => q[0])) * k, y1: Math.min(...pM.map(q => q[1])) * k, y2: Math.max(...pM.map(q => q[1])) * k };
      // осевые линии расточек
      bores.forEach(b => { const x = XM(b.c), y = YM(b.c), L = (b.r + 2.1 * (H.dks || 8) + 12) * k; sM.line(x - L, y, x + L, y, 3).line(x, part === 'base' ? y - L : y - 4, x, part === 'base' ? y + 4 : y + L, 3); });
      callHoles(sM, vM, Um, Vm, Nm, true);
      // диаметры расточек, межосевые расстояния, база А и параллельность осей, шероховатость
      bores.forEach((b, i) => { const x = XM(b.c), y = YM(b.c), r = b.r * k, sg = part === 'base' ? 1 : -1; sM.attempt([6, 14, 22].map(d => () => sM.dimH(x - r, y, x + r, y, y + sg * (d + (i % 2) * 8), `⌀${nf(2 * b.r, 0)}H7`))); });
      for (let i = 0; i + 1 < bores.length; i++) { const a = bores[i], b = bores[i + 1], aw = Math.abs(dot(b.c, Um) - dot(a.c, Um)); const yOut = part === 'base' ? Math.max(...bores.map(q => YM(q.c) + q.r * k)) + 32 : Math.min(...bores.map(q => YM(q.c) - q.r * k)) - 32; sM.attempt([0, 9, 18].map(d => () => sM.dimH(XM(a.c), YM(a.c), XM(b.c), YM(b.c), yOut + (part === 'base' ? d : -d), nf(aw, 0) + '±' + nf(FA(aw), 3)))); }
      if (bores.length) {
        const b0 = bores[0], r0 = b0.r * k;
        sM.datum(XM(b0.c) - r0, YM(b0.c), part === 'base' ? 270 : 90, 'А', { len: 10 });
        bores.slice(1).forEach(b => { const tx = XM(b.c) + b.r * k * 0.7, ty = YM(b.c) + (part === 'base' ? -1 : 1) * b.r * k * 0.71; sM.attempt([[10, -18], [10, 18], [-30, -18], [-30, 18]].map(([dx, dy]) => () => sM.tol(tx + dx, ty + dy, ['par', '0,03', 'А'], { from: dx > 0 ? 'l' : 'r', to: [tx, ty] }))); });
        bores.forEach(b => sM.attempt([0.35, -0.35, 0.6].map(q => () => sM.rough(XM(b.c) + b.r * k * Math.cos((part === 'base' ? 270 : 90) * D2R + q), YM(b.c) + (part === 'base' ? -1 : 1) * b.r * k * Math.abs(Math.sin((part === 'base' ? 270 : 90) * D2R + q)), 'Ra 1,6'))));
      }
      // плоскость разъёма: плоскостность и шероховатость
      const yJ = us * k;
      sM.attempt([[-34, 10], [-34, -18], [12, 12]].map(([dx, dy]) => () => sM.tol(bxM.x1 + dx, yJ + dy, ['flat', '0,05'], { from: dx < 0 ? 'r' : 'l', to: [bxM.x1 + 6, yJ] })));
      if (part === 'base') sM.attempt([0.18, 0.82].map(fx => () => sM.rough(bxM.x1 + (bxM.x2 - bxM.x1) * fx, yJ, 'Ra 1,6')));
      else sM.attempt([0.12, 0.88].map(fx => () => { const x = bxM.x1 + (bxM.x2 - bxM.x1) * fx; sM.line(x, yJ, x + 8, yJ - 12, 2).line(x + 8, yJ - 12, x + 30, yJ - 12, 2); sM.arrow(x, yJ, Math.atan2(12, -8) / D2R); sM.rough(x + 12, yJ - 12, 'Ra 1,6'); }));
      // габариты и высоты
      sM.dimH(bxM.x1, bxM.y1, bxM.x2, bxM.y1, bxM.y1 - 12, nf((bxM.x2 - bxM.x1) / k, 0) + '*');
      sM.dimV(bxM.x2, bxM.y1, bxM.x2, bxM.y2, bxM.x2 + 24, nf((bxM.y2 - bxM.y1) / k, 0) + '*');
      if (part === 'base') {
        sM.dimV(bxM.x2, zB * k, bxM.x2, yJ, bxM.x2 + 12, nf(us - zB, 0) + '±0,2');
        sM.dimV(bxM.x1, zB * k, bxM.x1, H3.lvl.zFoot * k, bxM.x1 - 10, nf(H3.lvl.zFoot - zB, 0));
      } else {
        const tf = 1.5 * (H.del || 8);
        sM.dimV(bxM.x1, yJ, bxM.x1, yJ + tf * k, bxM.x1 - 10, nf(tf, 0));
      }
      // линия разреза А–А по оси самой большой расточки
      if (big) sM.cutV(XM(big.c), bxM.y1 - 2, bxM.y2 + 2, 'А', 'r');
      // ---------- вид сверху
      const sT = mk();
      draw(sT, vT);
      const pT = vT.lines.flat(), bxT = { x1: Math.min(...pT.map(q => q[0])) * k, x2: Math.max(...pT.map(q => q[0])) * k, y1: Math.min(...pT.map(q => q[1])) * k, y2: Math.max(...pT.map(q => q[1])) * k };
      bores.forEach(b => { const x = dot(b.c, Ut) * k; sT.line(x, bxT.y1 - 6, x, bxT.y2 + 6, 3); });
      callHoles(sT, vT, Ut, Vt, crs(Ut, Vt), false);
      sT.dimV(bxT.x2, bxT.y1, bxT.x2, bxT.y2, bxT.x2 + 12, nf((bxT.y2 - bxT.y1) / k, 0) + '*');
      if (part === 'base' && H3.feet && H3.feet.holes.length >= 2) {
        const fh = H3.feet.holes.map(p => [dot(p, Ut) * k, dot(p, Vt) * k]), rF = H3.feet.d / 2 * k;
        // отверстия в лапах под фланцем — невидимыми линиями
        fh.forEach(([x, y]) => { if (vT.depth(x / k, y / k) > H3.lvl.zFoot + 0.5) sT.circle(x, y, rF, 4); sT.line(x - rF - 3, y, x + rF + 3, y, 3).line(x, y - rF - 3, x, y + rF + 3, 3); });
        sT.attempt([[16, 14], [-16, 14], [16, -14], [-16, -14]].map(([dx, dy]) => () => sT.leader(fh[0][0] + Math.sign(dx) * rF * 0.7, fh[0][1] + Math.sign(dy) * rF * 0.7, fh[0][0] + dx, fh[0][1] + dy, `⌀${nf(H3.feet.d, 0)}`, `${fh.length} отв.`, { side: dx > 0 ? 'r' : 'l' })));
        const xs = [...new Set(fh.map(q => Math.round(q[0] * 10) / 10))].sort((a, b) => a - b), ys = [...new Set(fh.map(q => Math.round(q[1] * 10) / 10))].sort((a, b) => a - b);
        if (xs.length > 1) sT.dimH(xs[0], ys[0], xs[xs.length - 1], ys[0], bxT.y1 - 12, nf((xs[xs.length - 1] - xs[0]) / k, 0));
        if (ys.length > 1) sT.dimV(xs[0], ys[0], xs[0], ys[ys.length - 1], bxT.x1 - 12, nf((ys[ys.length - 1] - ys[0]) / k, 0));
      }
      // смотровой люк: размеры проёма
      if (part === 'cover') {
        const hl = ops.find(o => o.n === 'смотровой люк');
        if (hl && hl.loops[0] && hl.loops[0].p) {
          const n = NRMI[hl.base], c = CANI[hl.base], W3 = q => { const p = [0, 0, 0]; p[c[0]] = q[0]; p[c[1]] = q[1]; p[n] = hl.b; return p; };
          const P2 = hl.loops[0].p.map(q => W3(q)).map(p => [dot(p, Ut) * k, dot(p, Vt) * k]);
          const x1 = Math.min(...P2.map(q => q[0])), x2 = Math.max(...P2.map(q => q[0])), y1 = Math.min(...P2.map(q => q[1])), y2 = Math.max(...P2.map(q => q[1]));
          sT.attempt([8, 14].map(d => () => sT.dimH(x1, y2, x2, y2, y2 + d, nf((x2 - x1) / k, 0))));
          sT.attempt([8, 14].map(d => () => sT.dimV(x2, y1, x2, y2, x2 + d, nf((y2 - y1) / k, 0))));
        }
      }
      // ---------- разрез А–А
      const sA = mk(), sc = L => L.map(lp => lp.map(([x, y]) => [x * k, y * k]));
      const SL = sc(sec);
      if (SL.length) { sA.hatch(SL, { ang: part === 'base' ? 45 : 135, step: 3 }); SL.forEach(lp => sA.poly(lp, 1)); }
      const pA = SL.flat();
      if (pA.length) {
        const bxA = { x1: Math.min(...pA.map(q => q[0])), x2: Math.max(...pA.map(q => q[0])), y1: Math.min(...pA.map(q => q[1])), y2: Math.max(...pA.map(q => q[1])) };
        if (big) { const y = dot(big.c, Vs) * k; sA.line(bxA.x1 - 6, y, bxA.x2 + 6, y, 3); }
        sA.dimH(bxA.x1, bxA.y1, bxA.x2, bxA.y1, bxA.y1 - 12, nf((bxA.x2 - bxA.x1) / k, 0));
        // толщина стенки δ — у нижней (основание) или верхней (крышка) стенки посередине
        const del = H.del || 8, xm = (bxA.x1 + bxA.x2) / 2;
        const inside = (x, y) => { let c = false; SL.forEach(P2 => { for (let i = 0, j = P2.length - 1; i < P2.length; j = i++) { const a = P2[i], b = P2[j]; if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } }); return c; };
        const yW = part === 'base' ? (() => { for (let y = bxA.y1 + 0.2; y < bxA.y2; y += 0.25) if (!inside(xm, y)) return y; return null; })() : (() => { for (let y = bxA.y2 - 0.2; y > bxA.y1; y -= 0.25) if (!inside(xm, y)) return y; return null; })();
        if (yW !== null) { const yo = part === 'base' ? bxA.y1 : bxA.y2; if (Math.abs(Math.abs(yW - yo) / k - del) < 3) sA.attempt([10, 20].map(d => () => sA.dimV(xm, yo, xm, yW, xm + d, nf(Math.abs(yW - yo) / k, 0)))); }
      }
      callHoles(sA, { depth: () => 0 }, Us, Vs, crs(Us, Vs), true);
      { const bb = sA.bbox(0); sA.text((bb.x1 + bb.x2) / 2, bb.y2 + 5, 'А–А', { h: 7, anchor: 'cb' }); }
      return { sM, sT, sA };
    };
    const notes = [
      '1. Отливка СЧ15 ГОСТ 1412-85. Неуказанные литейные радиусы 3…5 мм, формовочные уклоны 1…2°.',
      '2. Отливка не должна иметь раковин, трещин и других дефектов, снижающих прочность и герметичность.',
      `3. Отверстия под подшипники обрабатывать совместно с ${part === 'cover' ? 'корпусом' : 'крышкой корпуса'} после затяжки стяжных болтов и установки штифтов.`,
      '4. *Размеры для справок. Неуказанные предельные отклонения размеров: отверстий H14, валов h14, остальных ±IT14/2.',
      '5. Внутренние необработанные поверхности окрасить маслостойкой краской.'];
    const SC = [[1, '1:1'], [0.5, '1:2'], [0.4, '1:2,5'], [0.25, '1:4']];
    for (const [k, kt] of SC) for (const fmt of ['A2', 'A1']) {
      callouts.clear();
      const V3 = make(k);
      const sh = new Sheet(fmt, true), f = sh.frame;
      sh.occupy(sh.stamp, 2); sh.occupy(sh.reserved(), 2);
      sh.roughCorner('Ra 12,5');
      sh.occupy({ x1: f.x2 - 62, y1: f.y2 - 28, x2: f.x2, y2: f.y2 }, 0);
      const hN = notesH(notes, 185);
      sh.notes(sh.stamp.x1 + 2, sh.stamp.y2 + 6, 180, notes); sh.occupy({ x1: sh.stamp.x1, y1: sh.stamp.y2 + 4, x2: f.x2 - 2, y2: sh.stamp.y2 + 8 + hN }, 2);
      const mb = V3.sM.bbox(0), sL = Math.max(0, mb.x1 - V3.sT.bbox(0).x1);
      const p1 = DR.placeGroup(sh, V3.sM.p, { near: [f.x1 + 10 + sL + (mb.x2 - mb.x1) / 2, f.y2 - 10 - (mb.y2 - mb.y1) / 2] });
      if (!p1) continue;
      const tb = V3.sT.bbox(0);
      const p2 = DR.placeGroup(sh, V3.sT.p, { fixX: p1.dx, near: [0, p1.box.y1 - 10 - (tb.y2 - tb.y1) / 2] });
      if (!p2) continue;
      const ab = V3.sA.bbox(0);
      const p3 = DR.placeGroup(sh, V3.sA.p, { fixY: p1.dy, near: [p1.box.x2 + 20 + (ab.x2 - ab.x1) / 2, 0] });
      if (!p3) continue;
      const name = part === 'base' ? 'Корпус' : 'Крышка корпуса';
      return { id: part === 'base' ? 'korpus' : 'kryshka_korpusa', file: part === 'base' ? 'korpus.cdw' : 'kryshka_korpusa.cdw', code, name, material: 'СЧ15 ГОСТ 1412-85', mass: '', scale: kt, fmt, landscape: true, sh };
    }
    return null;
  }

  function housingSheets(R, P, T, spec) {
    if (R.task === 1 && root.DRWVERT) return root.DRWVERT.housingSheets(R, P, T, spec);
    if (root.M3D && root.M3D.rayView) {
      try {
        const H3 = root.M3D.housing3d(R, P, T || {});
        const codeOf = name => { let c = ''; spec.sections.forEach(sc => sc.items.forEach(it => { if (it.name === name) c = it.code; })); return c; };
        const out = ['base', 'cover'].map(part => housingPartSheet(R, P, T, H3, part, codeOf(part === 'base' ? 'Корпус' : 'Крышка корпуса'))).filter(Boolean);
        if (out.length === 2) return out;
      } catch (e) { console.error(e); }
    }
    const A = asmData(R, P, T);
    const codeOf = name => { let c = ''; spec.sections.forEach(sc => sc.items.forEach(it => { if (it.name === name) c = it.code; })); return c; };
    const out = [];
    const notesBase = (cover) => [
      '1. Отливка СЧ15 ГОСТ 1412-85. Неуказанные литейные радиусы 3…5 мм, формовочные уклоны 1…2°.',
      '2. Отливка не должна иметь раковин, трещин и других дефектов, снижающих прочность и герметичность.',
      `3. Отверстия под подшипники обрабатывать совместно с ${cover ? 'корпусом' : 'крышкой корпуса'} после затяжки стяжных болтов и установки штифтов.`,
      '4. Неуказанные предельные отклонения размеров: отверстий H14, валов h14, остальных ±IT14/2.',
      '5. Внутренние необработанные поверхности окрасить маслостойкой краской.'];
    for (const part of ['base', 'cover']) {
      let done = null;
      for (const [k, kt] of [[1, '1:1'], [0.5, '1:2'], [0.4, '1:2,5'], [0.25, '1:4']]) {
        const G = housingGeom(A, R, k);
        const Pl = housingPlan(G, R, k, part), El = housingElev(G, A, R, k, part);
        for (const fmt of ['A2', 'A1']) {
          const sh = new Sheet(fmt, true), f = sh.frame;
          const notes = notesBase(part === 'cover');
          if (C && sh) {
            sh.occupy(sh.stamp, 2); sh.occupy(sh.reserved(), 2);
            sh.roughCorner('Ra 12,5');
            sh.occupy({ x1: f.x2 - 62, y1: f.y2 - 28, x2: f.x2, y2: f.y2 }, 0);
            const hN = notesH(notes, 185);
            sh.notes(sh.stamp.x1 + 2, sh.stamp.y2 + 6, 180, notes); sh.occupy({ x1: sh.stamp.x1, y1: sh.stamp.y2 + 4, x2: f.x2 - 2, y2: sh.stamp.y2 + 8 + hN }, 2);
          }
          const eb = El.sh.bbox(0);
          const p1 = DR.placeGroup(sh, El.sh.p, { near: [f.x1 + 10 + (eb.x2 - eb.x1) / 2, f.y2 - 10 - (eb.y2 - eb.y1) / 2] });
          if (!p1) continue;
          const pb = Pl.sh.bbox(0);
          const p2 = DR.placeGroup(sh, Pl.sh.p, { fixX: p1.dx, near: [p1.box.x1 + (pb.x2 - pb.x1) / 2, p1.box.y1 - 10 - (pb.y2 - pb.y1) / 2] });
          if (!p2) continue;
          done = { sh, scale: kt, fmt };
          break;
        }
        if (done) break;
      }
      if (!done) continue;
      const name = part === 'base' ? 'Корпус' : 'Крышка корпуса';
      out.push({ id: part === 'base' ? 'korpus' : 'kryshka_korpusa', file: part === 'base' ? 'korpus.cdw' : 'kryshka_korpusa.cdw', code: codeOf(name), name, material: 'СЧ15 ГОСТ 1412-85', mass: '', scale: done.scale, fmt: done.fmt, landscape: true, sh: done.sh });
    }
    return out;
  }

  root.DRWASM = { bearingPlaces, housingElev, PLAN, ELEV, splitHeight, housingSheets, housingGeom, asmData, sectionView, sideView, sectionDims, positions, posFinder, asmSheet, RectSet, drawBearing, VIEWS };

})(typeof window !== 'undefined' ? window : globalThis);
