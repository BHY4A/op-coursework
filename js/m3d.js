/* m3d.js — уточнённые 3D-модели для макросов: литой корпус из основания и крышки (по геометрии сборочного чертежа),
   подшипники и крышки подшипников в сборке. Всё в мировых координатах сборки (деталь вставляется в начало координат). */
(function (root) {
  'use strict';
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const r2 = x => Math.round(x * 100) / 100;
  const BASE_OF_AXIS = ['YOZ', 'XOZ', 'XOY'];        // плоскость, перпендикулярная мировой оси 0/1/2
  const CAN = { XOY: [0, 1], XOZ: [0, 2], YOZ: [1, 2] };
  const NORM = { XOY: 2, XOZ: 1, YOZ: 0 };
  const axisIdx = v => [0, 1, 2].reduce((a, i) => Math.abs(v[i]) > Math.abs(v[a]) ? i : a, 0);

  /* контуры объединения прямоугольников: ориентированные граничные рёбра клеток сетки → замкнутые ломаные */
  function outline(adds, subs) {
    const sn = v => Math.round(v * 2) / 2;
    const snr = r => ({ x1: sn(r.x1), y1: sn(r.y1), x2: sn(r.x2), y2: sn(r.y2) });
    adds = adds.map(snr).filter(r => r.x2 > r.x1 && r.y2 > r.y1); subs = (subs || []).map(snr).filter(r => r.x2 > r.x1 && r.y2 > r.y1);
    const xs = [...new Set(adds.concat(subs).flatMap(r => [+r.x1.toFixed(2), +r.x2.toFixed(2)]))].sort((a, b) => a - b);
    const ys = [...new Set(adds.concat(subs).flatMap(r => [+r.y1.toFixed(2), +r.y2.toFixed(2)]))].sort((a, b) => a - b);
    const nx = xs.length - 1, ny = ys.length - 1;
    const f = new Uint8Array(Math.max(0, nx * ny));
    const mark = (r, v) => { const i1 = xs.indexOf(+r.x1.toFixed(2)), i2 = xs.indexOf(+r.x2.toFixed(2)), j1 = ys.indexOf(+r.y1.toFixed(2)), j2 = ys.indexOf(+r.y2.toFixed(2)); for (let i = i1; i < i2; i++) for (let j = j1; j < j2; j++) f[i * ny + j] = v; };
    adds.forEach(r => mark(r, 1)); subs.forEach(r => mark(r, 0));
    const F = (i, j) => i >= 0 && j >= 0 && i < nx && j < ny && f[i * ny + j] === 1;
    const next = new Map();   // ребро (вершины-индексы) с заполненной клеткой слева
    const key = (i, j) => i + ',' + j;
    for (let i = 0; i < nx; i++) for (let j = 0; j <= ny; j++) {
      if (F(i, j) && !F(i, j - 1)) next.set(key(i, j), (next.get(key(i, j)) || []).concat([[i + 1, j]]));
      if (!F(i, j) && F(i, j - 1)) next.set(key(i + 1, j), (next.get(key(i + 1, j)) || []).concat([[i, j]]));
    }
    for (let j = 0; j < ny; j++) for (let i = 0; i <= nx; i++) {
      if (F(i - 1, j) && !F(i, j)) next.set(key(i, j), (next.get(key(i, j)) || []).concat([[i, j + 1]]));
      if (!F(i - 1, j) && F(i, j)) next.set(key(i, j + 1), (next.get(key(i, j + 1)) || []).concat([[i, j]]));
    }
    const loops = [];
    for (;;) {
      const st = [...next.keys()].find(k => next.get(k).length); if (!st) break;
      let cur = st.split(',').map(Number); const pts = [cur];
      for (let g = 0; g < 100000; g++) {
        const arr = next.get(key(...cur)); if (!arr || !arr.length) break;
        const nx_ = arr.shift(); cur = nx_; if (key(...cur) === st) break; pts.push(cur);
      }
      // убрать коллинеарные вершины
      const P = pts.map(([i, j]) => [xs[i], ys[j]]);
      const Q = P.filter((p, k) => { const a = P[(k + P.length - 1) % P.length], b = P[(k + 1) % P.length]; return !((Math.abs(a[0] - p[0]) < 1e-6 && Math.abs(b[0] - p[0]) < 1e-6) || (Math.abs(a[1] - p[1]) < 1e-6 && Math.abs(b[1] - p[1]) < 1e-6)); });
      if (Q.length >= 3) loops.push(Q);
    }
    return loops;
  }

  const CACHE = new WeakMap();
  function housing3d(R, P, T) {
    if (CACHE.has(R)) return CACHE.get(R);
    const res = housing3d_(R, P, T);
    CACHE.set(R, res);
    return res;
  }
  function housing3d_(R, P, T) {
    const AS = root.DRWASM; if (!AS) return null;
    if (R.task === 1) return housingV(R, P, T);
    const A = AS.asmData(R, P, T);
    const G = AS.housingGeom(A, R, 1);
    const E = AS.housingElev(G, A, R, 1, 'base');
    const ft = E.feet; if (!ft) return null;
    const PL = AS.PLAN[R.task], S = G.S, H = R.H || {};
    const del = H.del || 8, gap = H.gap || 10;
    const us = ft.us;
    const nI = axisIdx(PL.n), base = BASE_OF_AXIS[nI];
    const W = (u, v, n) => [0, 1, 2].map(i => u * PL.u[i] + v * PL.v[i] + n * PL.n[i]);
    // точка плана (u, v) → координаты эскиза плоскости base
    const can = (u, v) => { const w = W(u, v, 0); return [r2(w[CAN[base][0]]), r2(w[CAN[base][1]])]; };
    const nsg = PL.n[nI];                             // знак: высота n = nsg · мировая координата
    const nw = n => r2(n * nsg);
    const rectL = r => ({ p: [can(r.x1, r.y1), can(r.x2, r.y1), can(r.x2, r.y2), can(r.x1, r.y2)] });
    const circL = (u, v, rr) => { const c = can(u, v); return { c: [c[0], c[1], r2(rr)] }; };
    const slab = (name, n1, n2, loops, cut) => ({ n: name, base, a: Math.min(nw(n1), nw(n2)), b: Math.max(nw(n1), nw(n2)), loops, cut: !!cut });
    // высоты (абсолютные, по нормали плана)
    const zBot = us + ft.yb, zFoot = zBot + ft.pF, tf = 1.5 * del;
    // высота крышки над каждой полостью — по деталям, которые в неё проецируются (ступенчатая крышка)
    const U = PL.u, V = PL.v;
    const foot = [];   // {x1,y1,x2,y2,h}
    const boxAlong = (c2, d2, hl, rr) => { const e = [Math.abs(d2[0]) * hl + Math.abs(d2[1]) * rr, Math.abs(d2[1]) * hl + Math.abs(d2[0]) * rr]; return { x1: c2[0] - e[0], x2: c2[0] + e[0], y1: c2[1] - e[1], y2: c2[1] + e[1] }; };
    A.wheels.forEach(w => {
      const r = (w.g.daM || w.g.da || w.g.dae || 100) / 2, c2 = [dot(w.pos, U), dot(w.pos, V)], nn = dot(w.pos, PL.n);
      if (Math.abs(dot(w.ax, PL.n)) > 0.9) foot.push({ x1: c2[0] - r, x2: c2[0] + r, y1: c2[1] - r, y2: c2[1] + r, h: nn + (w.g.b || 20) / 2 });
      else foot.push(Object.assign(boxAlong(c2, [dot(w.ax, U), dot(w.ax, V)], Math.max(w.g.b || 20, w.g.lst || 0) / 2, r), { h: nn + r }));
    });
    A.shafts.forEach(sf => {
      const nn = dot(sf.pos, PL.n);
      if (Math.abs(dot(sf.ax, PL.n)) > 0.9) { const c2 = [dot(sf.pos, U), dot(sf.pos, V)]; foot.push({ x1: c2[0] - 30, x2: c2[0] + 30, y1: c2[1] - 30, y2: c2[1] + 30, h: nn + 10 }); return; }
      const d2 = [dot(sf.ax, U), dot(sf.ax, V)];
      sf.segs.forEach(g => { const rr = g.gear ? (g.gear.da || 2 * g.r) / 2 : g.r; const mid = (g.x0 + g.x1) / 2; const c2 = [dot(sf.pos, U) + d2[0] * mid, dot(sf.pos, V) + d2[1] * mid]; foot.push(Object.assign(boxAlong(c2, d2, (g.x1 - g.x0) / 2, rr), { h: nn + rr })); });
    });
    const hit = (a, b) => a.x1 < b.x2 - 0.5 && b.x1 < a.x2 - 0.5 && a.y1 < b.y2 - 0.5 && b.y1 < a.y2 - 0.5;
    const cavTop = S.cavs.map(cv => Math.round(Math.max(us + tf + 20, ...foot.filter(f => hit(f, cv)).map(f => f.h + gap + del))));
    const zTop = Math.max(...cavTop);
    const ops = [];
    // стенки: полость + δ (ступенчатый контур — объединение прямоугольников)
    const polyL = pts => ({ p: pts.map(([u, v]) => can(u, v)) });
    const levels = [...new Set(cavTop)].sort((a, b) => a - b);
    levels.forEach((h, i) => ops.push(slab('стенки' + (levels.length > 1 ? ' ' + (i + 1) : ''), zBot, h, outline(S.cavs.filter((cv, j) => cavTop[j] === h).map(cv => ({ x1: cv.x1 - del, y1: cv.y1 - del, x2: cv.x2 + del, y2: cv.y2 + del }))).map(polyL))));
    // лапы
    const fb = G.fb;
    ops.push(slab('опорная плита (лапы)', zBot, zFoot, [rectL({ x1: ft.hx1 - ft.K1, y1: fb.y1, x2: ft.hx2 + ft.K1, y2: fb.y2 })]));
    // фланцы разъёма (у основания и крышки)
    ops.push(slab('фланцы разъёма', us - tf, us + tf, outline(G.fl.rects).map(polyL)));
    // приливы (бобышки) под подшипники — цилиндры вдоль осей валов
    const cyl = (name, ax, aIdx, along1, along2, ctr, rr, cut) => {
      const b2 = BASE_OF_AXIS[aIdx], cw = ctr, cc = CAN[b2];
      return { n: name, base: b2, a: r2(Math.min(along1, along2)), b: r2(Math.max(along1, along2)), loops: [{ c: [r2(cw[cc[0]]), r2(cw[cc[1]]), r2(rr)] }], cut: !!cut };
    };
    const planAxis = c => (c === 0 ? PL.u : PL.v);
    const alongW = (c, t) => t * planAxis(c)[axisIdx(planAxis(c))];
    S.bosses.forEach((b, i) => {
      const av = planAxis(b.c), ai = axisIdx(av);
      const ctr = b.c === 0 ? W(0, b.ax, us) : W(b.ax, 0, us);
      ops.push(cyl('прилив ' + (i + 1), av, ai, alongW(b.c, b.wallIn), alongW(b.c, b.face), ctr, b.bossR));
    });
    // стакан вала-шестерни (задание 1)
    S.inPlane.filter(s => s.tube).forEach(s => {
      const c = s.horiz ? 0 : 1, av = planAxis(c), ai = axisIdx(av), t = s.tube, ax = s.o[1 - c];
      const ctr = c === 0 ? W(0, ax, us) : W(ax, 0, us);
      const t1 = c === 0 ? t.x1 : t.y1, t2 = c === 0 ? t.x2 : t.y2, rr = (c === 0 ? t.y2 - t.y1 : t.x2 - t.x1) / 2;
      ops.push(cyl('стакан', av, ai, alongW(c, t1), alongW(c, t2), ctr, rr));
      // фланец стакана под винты крышки — у наружного торца (как на сборочном чертеже)
      const far = s.cartridge === 'hi' ? t2 : t1, flT = 9, bossR = (s.b ? s.b.D / 2 : rr) + 2.1 * (H.dks || 8) + 6;
      ops.push(cyl('фланец стакана', av, ai, alongW(c, far), alongW(c, s.cartridge === 'hi' ? far - flT : far + flT), ctr, bossR));
    });
    // полость
    levels.forEach((h, i) => ops.push(slab('полость' + (i ? ' ' + (i + 1) : ''), zBot + del, h - del, outline(S.cavs.filter((cv, j) => cavTop[j] === h)).map(polyL), true)));
    // расточки под подшипники (в плоскости разъёма)
    S.inPlane.forEach(s => {
      const c = s.horiz ? 0 : 1, av = planAxis(c), ai = axisIdx(av), ax = s.o[1 - c];
      const D = (s.b ? s.b.D : 2 * s.segs[0].r + 30) / 2;
      S.bores.filter(b => Math.abs((c === 0 ? (b.y1 + b.y2) : (b.x1 + b.x2)) / 2 - ax) < 0.5).forEach((b, i) => {
        const ctr = c === 0 ? W(0, ax, us) : W(ax, 0, us);
        ops.push(cyl('расточка ⌀' + Math.round(2 * D) + ' ' + (i + 1), av, ai, alongW(c, c === 0 ? b.x1 : b.y1), alongW(c, c === 0 ? b.x2 : b.y2), ctr, D, true));
      });
    });
    // валы ниже разъёма (червяк): внутренние приливы торцевых стенок под подшипники и сквозные расточки
    const iCav = ops.reduce((a, o, i) => /^полость/.test(o.n) ? i : a, -1);
    A.shafts.filter(s => Math.abs(dot(s.pos, PL.n) - us) >= 1 && s.b).forEach(s => {
      const pu = dot(s.pos, PL.u), au = dot(s.ax, PL.u), nAx = dot(s.pos, PL.n), D = s.b.D / 2;
      if (Math.abs(au) < 0.9) return;
      const cav = S.cavs.reduce((a, c) => a ? { x1: Math.min(a.x1, c.x1), y1: Math.min(a.y1, c.y1), x2: Math.max(a.x2, c.x2), y2: Math.max(a.y2, c.y2) } : Object.assign({}, c), null);
      AS.bearingPlaces(s).forEach((q, j) => {
        const u1 = pu + au * q.a, u2 = pu + au * q.b, lo = Math.min(u1, u2), hi = Math.max(u1, u2);
        const left = (lo + hi) / 2 < (cav.x1 + cav.x2) / 2;
        const r = left ? { x1: cav.x1 - 1, x2: hi + 6, y1: cav.y1 - 1, y2: cav.y2 + 1 } : { x1: lo - 6, x2: cav.x2 + 1, y1: cav.y1 - 1, y2: cav.y2 + 1 };
        if (r.x2 - r.x1 > 2) ops.splice(iCav + 1, 0, slab('прилив торцевой стенки ' + (j + 1), zBot + del - 1, nAx + D + 2.5 * del, [rectL(r)]));
      });
    });
    A.shafts.filter(s => Math.abs(dot(s.pos, PL.n) - us) >= 1).forEach((s, i) => {
      const ai = axisIdx(s.ax), D = (s.b ? s.b.D : 60) / 2;
      const L = s.segs[s.segs.length - 1].x1, a0 = s.pos[ai], sg = Math.sign(s.ax[ai]) || 1;
      const ctr = s.pos.slice();
      const bp = AS.bearingPlaces(s), xa = bp.length ? Math.min(...bp.map(q => q.a)) - 8 : -10, xb = bp.length ? Math.max(...bp.map(q => q.b)) + 8 : L + 10;
      ops.push(cyl('прилив червяка ' + (i + 1), s.ax, ai, a0 + xa * sg, a0 + xb * sg, ctr, D + 2.1 * (H.dks || 8) + 6));
      ops.splice(ops.findIndex(o => o.cut), 0, ops.pop());   // прилив — до вырезов
      ops.push(cyl('расточка червяка ' + (i + 1), s.ax, ai, a0 + (xa - 2) * sg, a0 + (xb + 2) * sg, ctr, D, true));
    });
    // отверстия во фланце и лапах
    const holes = [];
    G.holes2.forEach(p => holes.push(circL(p[0], p[1], G.dh2 / 2)));
    G.holes3.forEach(p => holes.push(circL(p[0], p[1], G.dh3 / 2)));
    if (holes.length) ops.push(slab('отверстия под болты фланца', us - tf - 5, us + tf + 5, holes, true));
    if (G.pins.length) ops.push(slab('отверстия под штифты', us - tf - 10, us + tf + 10, G.pins.map(p => circL(p[0], p[1], 4)), true));
    const footH = [];
    [ft.hx1 - ft.K1 / 2, ft.hx2 + ft.K1 / 2].forEach(u => [fb.y1 + ft.K1 / 2 + 6, fb.y2 - ft.K1 / 2 - 6].forEach(v => footH.push(circL(u, v, ft.d1 / 2))));
    ops.push(slab('отверстия в лапах', zBot - 1, zFoot + 1, footH, true));
    const bigR = { x1: fb.x1 - 400, y1: fb.y1 - 400, x2: fb.x2 + 400, y2: fb.y2 + 400 };
    // основание: всё выше разъёма срезать; крышка — всё ниже
    const baseOps = ops.concat([slab('срез по разъёму', us, zTop + 50, [rectL(bigR)], true)]);
    const iTop = cavTop.reduce((a, h, i) => (h > cavTop[a] || (h === cavTop[a] && (S.cavs[i].x2 - S.cavs[i].x1) * (S.cavs[i].y2 - S.cavs[i].y1) > (S.cavs[a].x2 - S.cavs[a].x1) * (S.cavs[a].y2 - S.cavs[a].y1))) ? i : a, 0);
    const cT = S.cavs[iTop], hx = Math.max(15, Math.min(100, (cT.x2 - cT.x1) * 0.25, (cT.x2 - cT.x1) / 2 - 15)), hy = Math.max(12, Math.min(70, (cT.y2 - cT.y1) * 0.25, (cT.y2 - cT.y1) / 2 - 15));
    const hatch = { x1: (cT.x1 + cT.x2) / 2 - hx, x2: (cT.x1 + cT.x2) / 2 + hx, y1: (cT.y1 + cT.y2) / 2 - hy, y2: (cT.y1 + cT.y2) / 2 + hy };
    const coverOps = ops.filter(o => !/лапах|лапы/.test(o.n)).concat([
      slab('срез по разъёму', zBot - 50, us, [rectL(bigR)], true),
      slab('бобышка смотрового люка', zTop - del, zTop + 5, [rectL({ x1: hatch.x1 - 12, y1: hatch.y1 - 12, x2: hatch.x2 + 12, y2: hatch.y2 + 12 })]),
      slab('смотровой люк', zTop - del - 2, zTop + 7, [rectL(hatch)], true)
    ]);
    // сливная пробка: прилив на торцевой стенке основания — опускаем (виден на чертеже)
    // ---- подшипники и крышки подшипников
    const extra = [], parts = [];
    const bPart = {};
    const covList = [];
    const axesFor = (xv) => { const ai = axisIdx(xv), y = ai === 1 ? [0, 0, 1] : [0, 1, 0]; return [xv[0], xv[1], xv[2], y[0], y[1], y[2]].map(r2); };
    S.inPlane.forEach((s, si) => {
      if (!s.b) return;
      const c = s.horiz ? 0 : 1, av = planAxis(c), ax = s.o[1 - c];
      const id = 'podsh_' + String(s.b.id).replace(/[^0-9A-Za-z]/g, '');
      if (!bPart[id]) { bPart[id] = { id, name: 'Подшипник ' + s.b.id, kind: 'bearing', geom: { d: s.b.d, D: s.b.D, B: s.b.T || s.b.B, roller: !!s.b.T }, file: id + '.m3d', material: 'ШХ15 ГОСТ 801-78', std: true }; parts.push(bPart[id]); }
      (s.inner || []).forEach(q => {
        const mid = (q.lo + q.hi) / 2;
        const pos = c === 0 ? W(mid, ax, us) : W(ax, mid, us);
        extra.push({ file: bPart[id].file, pos: pos.map(r2), axes: axesFor(av) });
      });
      void si;
    });
    // подшипники валов вне плоскости разъёма (червяк)
    A.shafts.filter(s => Math.abs(dot(s.pos, PL.n) - us) >= 1 && s.b).forEach(s => {
      const id = 'podsh_' + String(s.b.id).replace(/[^0-9A-Za-z]/g, '');
      if (!bPart[id]) { bPart[id] = { id, name: 'Подшипник ' + s.b.id, kind: 'bearing', geom: { d: s.b.d, D: s.b.D, B: s.b.T || s.b.B, roller: !!s.b.T }, file: id + '.m3d', material: 'ШХ15 ГОСТ 801-78', std: true }; parts.push(bPart[id]); }
      AS.bearingPlaces(s).forEach(q => { const x = (q.a + q.b) / 2; extra.push({ file: bPart[id].file, pos: s.pos.map((p, i) => r2(p + s.ax[i] * x)), axes: axesFor(s.ax) }); });
      const bp = AS.bearingPlaces(s); if (!bp.length) return;
      const lo = bp.reduce((a, b) => a.a < b.a ? a : b), hi = bp.reduce((a, b) => a.b > b.b ? a : b);
      [[lo, lo.a - 8, -1], [hi, hi.b + 8, 1]].forEach(([q, x, dir]) => {
        const sealSeg = s.segs.find(g => g.role === 'seal' && (dir < 0 ? g.x1 <= q.a + 0.5 : g.x0 >= q.b - 0.5));
        const dks = H.dks || 8, D = s.b.D;
        const g = { D: r2(D), Df: r2(D + 4.4 * dks + 8), tf: Math.max(8, Math.round(1.1 * dks)), ls: 8, dSeal: sealSeg ? r2(2 * sealSeg.r + 2) : 0, dks, n: D > 100 ? 6 : 4 };
        const cid = `kr_${sealSeg ? "s" : "g"}_${Math.round(D)}${sealSeg ? "_" + Math.round(g.dSeal) : ""}`;
        if (!parts.some(p => p.id === cid)) parts.push({ id: cid, name: sealSeg ? 'Крышка подшипника сквозная' : 'Крышка подшипника глухая', kind: 'cover', geom: g, file: cid + '.m3d', material: 'СЧ15 ГОСТ 1412-85', density: 7.1 });
        const item = { file: cid + '.m3d', pos: s.pos.map((p, i) => r2(p + s.ax[i] * x)), axes: axesFor(s.ax.map(c => c * dir)) };
        extra.push(item);
        covList.push({ pos: s.pos.map((p, i) => p + s.ax[i] * x), out: s.ax.map(c => c * dir), g, item });
      });
    });
    S.covers.forEach((cv, i) => {
      const s = cv.s, c = s.horiz ? 0 : 1, av = planAxis(c), ax = s.o[1 - c];
      const pl = cv.q || {};
      const sealSeg = (s.segs || []).find(g => g.role === 'seal' && (pl.left ? g.x1 <= pl.a + 0.5 : g.x0 >= pl.b - 0.5));
      const through = !!sealSeg;
      const pos = c === 0 ? W(cv.face, ax, us) : W(ax, cv.face, us);
      const out = av.map(x => x * cv.dir);
      const dks = H.dks || 8;
      const ls = r2(8 + (cv.ext || 0));
      const g = { D: r2(2 * cv.D), Df: r2(2 * cv.D + 4.4 * dks + 8), tf: Math.max(8, Math.round(1.1 * dks)), ls, dSeal: through ? r2(2 * sealSeg.r + 2) : 0, dks, n: 2 * cv.D > 100 ? 6 : 4 };
      const id = `kr_${through ? "s" : "g"}_${Math.round(2 * cv.D)}${through ? "_" + Math.round(g.dSeal) : ""}${ls !== 8 ? '_l' + Math.round(ls) : ''}`;
      if (!parts.some(p => p.id === id)) parts.push({ id, name: through ? 'Крышка подшипника сквозная' : 'Крышка подшипника глухая', kind: 'cover', geom: g, file: id + '.m3d', material: 'СЧ15 ГОСТ 1412-85', density: 7.1 });
      const item = { file: id + '.m3d', pos: pos.map(r2), axes: axesFor(out) };
      extra.push(item);
      covList.push({ pos, out, g, item });
      void i;
    });

    // ---- крепёж: болты фланца с шайбами и гайками, штифты, винты крышек подшипников, сливная пробка
    const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    const LEN = [10, 12, 14, 16, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 90, 100, 110, 120, 130, 140, 150];
    const lenUp = x => LEN.find(v => v >= x - 0.01) || Math.ceil(x / 10) * 10;
    const HEX = { 6: [10, 4, 5], 8: [13, 5.3, 6.5], 10: [16, 6.4, 8], 12: [18, 7.5, 10], 14: [21, 8.8, 11], 16: [24, 10, 13], 18: [27, 11.5, 15], 20: [30, 12.5, 16], 24: [36, 15, 19] };
    const hexOf = d => HEX[d] || [Math.round(1.5 * d + 1), +(0.65 * d).toFixed(1), +(0.8 * d).toFixed(1)];
    const stdPart = (id, name, kind, g, mat) => { if (!parts.some(p => p.id === id)) parts.push({ id, name, kind, geom: g, file: id + '.m3d', material: mat || 'Сталь 35 ГОСТ 1050-2013', std: true }); return id + '.m3d'; };
    const down = PL.n.map(x => -x);
    const fl = { n2: G.holes2.length, n3: G.holes3.length };
    // толщина пакета под болтом: у приливов подшипников болт проходит через бобышку целиком —
    // ищем, где под фланцем (и над ним) кончается металл в пределах опорной поверхности шайбы/головки
    const solidB = baseOps.filter(o => !/отверстия под/.test(o.n)), solidC = coverOps.filter(o => !/отверстия под/.test(o.n));
    const reach = (ops, q, rr, n0, dir) => {
      for (let t = 0; t <= 250; t += 1) {
        const n = n0 + dir * (t + 0.3);
        let hit = inOpsW(ops, W(q[0], q[1], n));
        for (let i = 0; i < 12 && !hit; i++) { const a = i * Math.PI / 6; hit = inOpsW(ops, W(q[0] + rr * Math.cos(a), q[1] + rr * Math.sin(a), n)); }
        if (!hit) return t;
      }
      return 250;
    };
    const boltHoleOps = [];
    const flBolt = (d, pts, key) => {
      if (!pts.length) return null;
      const [sk, kk, m] = hexOf(d), tw = +(0.25 * d).toFixed(1), Dw = +(1.75 * d).toFixed(1);
      const fn = stdPart(`nut_M${d}`, `Гайка М${d} ГОСТ 5915-70`, 'nut', { d, m, s: sk });
      const fw = stdPart(`washer_${d}`, `Шайба ${d} 65Г ГОСТ 6402-70`, 'washer', { d: d + 0.2, D: Dw, t: tw }, 'Сталь 65Г ГОСТ 14959-2016');
      const out = [];
      pts.forEach(q => {
        const rr = Math.max(Dw, sk * 1.16) / 2 + 0.5;
        const dn = reach(solidB, q, rr, us - tf, -1), upw = reach(solidC, q, rr, us + tf, 1);
        const lo = us - tf - dn, hi = us + tf + upw, t = hi - lo;
        const L = lenUp(t + tw + m + 2.5 * (d <= 10 ? 1.5 : 1.75));
        const fb_ = stdPart(`bolt_M${d}x${L}`, `Болт М${d}×${L} ГОСТ 7798-70`, 'bolt', { d, L, s: sk, k: kk });
        extra.push({ file: fb_, pos: W(q[0], q[1], hi).map(r2), axes: axesFor(down) });
        extra.push({ file: fw, pos: W(q[0], q[1], lo).map(r2), axes: axesFor(down) });
        extra.push({ file: fn, pos: W(q[0], q[1], lo - tw).map(r2), axes: axesFor(down) });
        if (dn > 0.5 || upw > 0.5) boltHoleOps.push(slab('отверстие под болт через прилив', lo - 1, hi + 1, [circL(q[0], q[1], (d + 1) / 2)], true));
        const o = out.find(x => x.L === L); if (o) o.n++; else out.push({ key, d, L, n: 1 });
      });
      return out;
    };
    const f2 = flBolt(H.d2 || 12, G.holes2, 'b2'), f3 = flBolt(H.d3 || 10, G.holes3, 'b3');
    const pinL = lenUp(2 * tf + 6), fp = G.pins.length ? stdPart(`pin_8x${pinL}`, `Штифт 8×${pinL} ГОСТ 3129-70`, 'pin', { d: 8, L: pinL }) : null;
    G.pins.forEach(q => extra.push({ file: fp, pos: W(q[0], q[1], us).map(r2), axes: axesFor(PL.n) }));
    { const solidAll = ops.filter(o => !/отверстия под|срез по разъёму/.test(o.n)); const obst = G.holes2.map(q => ({ p: W(q[0], q[1], us), d: PL.n.slice(), r: ((H.d2 || 12) + 1) / 2 })).concat(G.holes3.map(q => ({ p: W(q[0], q[1], us), d: PL.n.slice(), r: ((H.d3 || 10) + 1) / 2 }))); coverFlats(parts, covList, q => inOpsW(solidAll, q), obst); }
    // винты крышек подшипников и резьбовые отверстия под них
    const holeOps = [];
    let nScr = 0, scrL = 0;
    const dks = H.dks || 8;
    covList.forEach((cv, i) => {
      const g = cv.g, x = cv.out, ax6 = axesFor(x), y = ax6.slice(3), z = cross(x, y);
      const Lsc = lenUp(g.tf + 2.2 * dks); scrL = Math.max(scrL, Lsc);
      const [sk, kk] = hexOf(dks);
      const fs = stdPart(`screw_M${dks}x${Lsc}`, `Винт М${dks}×${Lsc} ГОСТ 7808-70`, 'bolt', { d: dks, L: Lsc, s: sk, k: kk });
      const rb = (g.D / 2 + g.Df / 2) / 2, ai = axisIdx(x), b2 = BASE_OF_AXIS[ai], cc = CAN[b2];
      const loops = [];
      for (let j = 0; j < g.n; j++) {
        const a = (g.phi === undefined ? Math.PI / g.n : g.phi) + 2 * Math.PI * j / g.n;
        const P = [0, 1, 2].map(k => cv.pos[k] + rb * (Math.cos(a) * y[k] + Math.sin(a) * z[k]));
        extra.push({ file: fs, pos: P.map((v, k) => r2(v + x[k] * g.tf)), axes: axesFor(x.map(c => -c)) });
        loops.push({ c: [r2(P[cc[0]]), r2(P[cc[1]]), r2(0.42 * dks)] });
        nScr++;
      }
      const f0 = cv.pos[ai], f1 = f0 - x[ai] * (Lsc - g.tf + 3);
      holeOps.push({ n: 'резьбовые отверстия под винты крышки ' + (i + 1), base: b2, a: r2(Math.min(f0, f1)), b: r2(Math.max(f0, f1)), loops, cut: true });
    });
    // сливная пробка: в стенке основания у дна — место подбирается по модели (отверстие в металле, головка свободна)
    const plugOps = [];
    let plug = null, plugAt = null;
    {
      const dp = H.dpr || 16, [sP] = hexOf(dp), sHex = sP - 2, kHex = 9;
      const solidB = baseOps.filter(o => !/отверстия под|срез по разъёму/.test(o.n));
      const cands = [];
      const lows = S.cavs.map((cv, j) => ({ cv, j })).sort((a, b) => cavTop[a.j] - cavTop[b.j]);
      for (let i = 0; i < 10; i++) {
        const n = zBot + del + dp / 2 + 2 + 3 * i; if (n + dp / 2 > us - tf - 2) break;
        lows.forEach(({ cv }) => {
          const us_ = [0.5, 0.3, 0.7, 0.15, 0.85].map(f => cv.x1 + dp + (cv.x2 - cv.x1 - 2 * dp) * f), vs_ = [0.5, 0.3, 0.7, 0.15, 0.85].map(f => cv.y1 + dp + (cv.y2 - cv.y1 - 2 * dp) * f);
          vs_.forEach(v => { cands.push({ c: W(cv.x1 + 2, v, n), d: PL.u.map(x => -x) }); cands.push({ c: W(cv.x2 - 2, v, n), d: PL.u.slice() }); });
          us_.forEach(u => { cands.push({ c: W(u, cv.y1 + 2, n), d: PL.v.map(x => -x) }); cands.push({ c: W(u, cv.y2 - 2, n), d: PL.v.slice() }); });
        });
      }
      plugAt = findPlug(q => inOpsW(solidB, q), cands, dp, sHex, kHex);
      if (plugAt) {
        plugOps.push(plugOp(plugAt, dp));
        const fpg = stdPart(`probka_M${dp}`, `Пробка М${dp}×1,5`, 'bolt', { d: dp, L: 14, s: sHex, k: kHex });
        extra.push({ file: fpg, pos: plugAt.face.map(r2), axes: axesFor(plugAt.d.map(x => -x)) });
        plug = dp; plugAt.dp = dp;
      }
    }
    const insertBefore = (arr, add) => { const k = arr.findIndex(o => o.n === 'срез по разъёму'); arr.splice(k, 0, ...add); return arr; };
    insertBefore(baseOps, holeOps.concat(plugOps, boltHoleOps));
    insertBefore(coverOps, holeOps.concat(boltHoleOps));
    const lid = hatchLid({ base, can, nw, W, nDir: PL.n, rect: hatch, top: zTop + 5 });
    coverOps.push(lid.holeOp); lid.parts.forEach(p => { if (!parts.some(q => q.id === p.id)) parts.push(p); }); lid.items.forEach(it => extra.push(it));
    const fasteners = { b2: f2, b3: f3, pins: { d: 8, L: pinL, n: G.pins.length }, screws: { d: dks, L: scrL, n: nScr }, plug, plugAt, lid: { d: lid.d, L: lid.L, n: lid.n } };
    const feet = { up: PL.n.slice(), bottom: zBot, d: ft.d1, holes: [] };
    [ft.hx1 - ft.K1 / 2, ft.hx2 + ft.K1 / 2].forEach(u => [fb.y1 + ft.K1 / 2 + 6, fb.y2 - ft.K1 / 2 - 6].forEach(v => feet.holes.push(W(u, v, zBot))));
    return { baseOps, coverOps, parts, extra, fasteners, feet };
  }


  /* ---------------------------------------------------------------- общий крепёж и подшипниковые узлы */
  const LEN = [10, 12, 14, 16, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 90, 100, 110, 120, 130, 140, 150];
  const lenUp = x => LEN.find(v => v >= x - 0.01) || Math.ceil(x / 10) * 10;
  const HEX = { 6: [10, 4, 5], 8: [13, 5.3, 6.5], 10: [16, 6.4, 8], 12: [18, 7.5, 10], 14: [21, 8.8, 11], 16: [24, 10, 13], 18: [27, 11.5, 15], 20: [30, 12.5, 16], 24: [36, 15, 19] };
  const hexOf = d => HEX[d] || [Math.round(1.5 * d + 1), +(0.65 * d).toFixed(1), +(0.8 * d).toFixed(1)];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const axesFor = (xv) => { const ai = axisIdx(xv), y = ai === 1 ? [0, 0, 1] : [0, 1, 0]; return [xv[0], xv[1], xv[2], y[0], y[1], y[2]].map(r2); };
  function makeHW(H) {
    const parts = [], extra = [];
    const stdPart = (id, name, kind, g, mat) => { if (!parts.some(p => p.id === id)) parts.push({ id, name, kind, geom: g, file: id + '.m3d', material: mat || 'Сталь 35 ГОСТ 1050-2013', std: true }); return id + '.m3d'; };
    const bPart = {};
    const bearingPart = b => { const id = 'podsh_' + String(b.id).replace(/[^0-9A-Za-z]/g, ''); if (!bPart[id]) { bPart[id] = { id, name: 'Подшипник ' + b.id, kind: 'bearing', geom: { d: b.d, D: b.D, B: b.T || b.B, roller: !!b.T }, file: id + '.m3d', material: 'ШХ15 ГОСТ 801-78', std: true }; parts.push(bPart[id]); } return bPart[id].file; };
    const dks = H.dks || 8;
    const covList = [];
    const cover = (pos, out, Dd, sealSeg, ext) => {
      const ls = r2(8 + (ext || 0));
      const g = { D: r2(Dd), Df: r2(Dd + 4.4 * dks + 8), tf: Math.max(8, Math.round(1.1 * dks)), ls, dSeal: sealSeg ? r2(2 * sealSeg.r + 2) : 0, dks, n: Dd > 100 ? 6 : 4 };
      const id = `kr_${sealSeg ? 's' : 'g'}_${Math.round(Dd)}${sealSeg ? '_' + Math.round(g.dSeal) : ''}${ls !== 8 ? '_l' + Math.round(ls) : ''}`;
      if (!parts.some(p => p.id === id)) parts.push({ id, name: sealSeg ? 'Крышка подшипника сквозная' : 'Крышка подшипника глухая', kind: 'cover', geom: g, file: id + '.m3d', material: 'СЧ15 ГОСТ 1412-85', density: 7.1 });
      const item = { file: id + '.m3d', pos: pos.map(r2), axes: axesFor(out) };
      extra.push(item);
      covList.push({ pos, out, g, item });
    };
    // винты крышек и резьбовые отверстия под них (вырезы в корпусе)
    const screws = (solid, obst) => {
      coverFlats(parts, covList, solid, obst);
      const holeOps = []; let n = 0, L = 0;
      covList.forEach((cv, i) => {
        const g = cv.g, x = cv.out, ax6 = axesFor(x), y = ax6.slice(3), z = cross(x, y);
        const Lsc = lenUp(g.tf + 2.2 * dks); L = Math.max(L, Lsc);
        const [sk, kk] = hexOf(dks);
        const fs = stdPart(`screw_M${dks}x${Lsc}`, `Винт М${dks}×${Lsc} ГОСТ 7808-70`, 'bolt', { d: dks, L: Lsc, s: sk, k: kk });
        const rb = (g.D / 2 + g.Df / 2) / 2, ai = axisIdx(x), b2 = BASE_OF_AXIS[ai], cc = CAN[b2];
        const loops = [];
        for (let j = 0; j < g.n; j++) {
          const a = (g.phi === undefined ? Math.PI / g.n : g.phi) + 2 * Math.PI * j / g.n;
          const P = [0, 1, 2].map(k => cv.pos[k] + rb * (Math.cos(a) * y[k] + Math.sin(a) * z[k]));
          extra.push({ file: fs, pos: P.map((v, k) => r2(v + x[k] * g.tf)), axes: axesFor(x.map(c => -c)) });
          loops.push({ c: [r2(P[cc[0]]), r2(P[cc[1]]), r2(0.42 * dks)] });
          n++;
        }
        const f0 = cv.pos[ai], f1 = f0 - x[ai] * (Lsc - g.tf + 3);
        holeOps.push({ n: 'резьбовые отверстия под винты крышки ' + (i + 1), base: b2, a: r2(Math.min(f0, f1)), b: r2(Math.max(f0, f1)), loops, cut: true });
      });
      return { holeOps, n, L };
    };
    // болт с шайбой и гайкой: top — точка под головкой, down — направление стержня, t — толщина пакета
    const bolts = (d, tops, down, t) => {
      if (!tops.length) return null;
      const [sk, kk, m] = hexOf(d), tw = +(0.25 * d).toFixed(1), Dw = +(1.75 * d).toFixed(1);
      const L = lenUp(t + tw + m + 2.5 * (d <= 10 ? 1.5 : 1.75));
      const fb_ = stdPart(`bolt_M${d}x${L}`, `Болт М${d}×${L} ГОСТ 7798-70`, 'bolt', { d, L, s: sk, k: kk });
      const fn = stdPart(`nut_M${d}`, `Гайка М${d} ГОСТ 5915-70`, 'nut', { d, m, s: sk });
      const fw = stdPart(`washer_${d}`, `Шайба ${d} 65Г ГОСТ 6402-70`, 'washer', { d: d + 0.2, D: Dw, t: tw }, 'Сталь 65Г ГОСТ 14959-2016');
      tops.forEach(p => {
        extra.push({ file: fb_, pos: p.map(r2), axes: axesFor(down) });
        extra.push({ file: fw, pos: p.map((v, i) => r2(v + down[i] * t)), axes: axesFor(down) });
        extra.push({ file: fn, pos: p.map((v, i) => r2(v + down[i] * (t + tw))), axes: axesFor(down) });
      });
      return { d, L, n: tops.length };
    };
    return { parts, extra, stdPart, bearingPart, cover, screws, bolts, covList };
  }

  /* соседние крышки подшипников на одной стенке не помещаются целиком — срезаются лыской по линии между осями
     (так же, как на сборочном чертеже); винты крышки поворачиваются, чтобы не попасть на лыску */
  function coverFlats(parts, covList, solid, obst) {
    covList.forEach(a => {
      const fl = [];
      // стенки корпуса рядом с торцом прилива (уступ полости, соседний прилив): где фланец крышки
      // заходит в металл — лыска на расстоянии чуть меньше первого касания
      if (solid) {
        const ax6 = axesFor(a.out), Y = ax6.slice(3), Z = crossV(a.out, Y), g = a.g;
        const hitR = th => { const c = Math.cos(th), sn = Math.sin(th);
          for (let r = g.D / 2 + 1; r <= g.Df / 2 + 0.5; r += 1) for (const h of [0.6, g.tf / 2, g.tf - 0.6]) {
            const q = [0, 1, 2].map(i => a.pos[i] + a.out[i] * h + r * (c * Y[i] + sn * Z[i])); if (solid(q)) return r; }
          return Infinity; };
        const hits = []; for (let t = 0; t < 360; t += 5) { const th = t * Math.PI / 180, r = hitR(th); if (r < Infinity) hits.push([th, r]); }
        for (let k = 0; k < 3 && hits.length; k++) {
          const left = hits.filter(([th, r]) => !fl.some(([t2, d2]) => r * Math.cos(th - t2) >= d2 - 0.01));
          if (!left.length) break;
          const [th0, r0] = left.reduce((m, h) => h[1] < m[1] ? h : m);
          fl.push([th0, r0 - 1]);
        }
      }
      covList.forEach(b => {
        if (a === b || dotV(a.out, b.out) < 0.999) return;
        const w = [0, 1, 2].map(i => b.pos[i] - a.pos[i]), along = dotV(w, a.out);
        if (Math.abs(along) > 40) return;
        const v = [0, 1, 2].map(i => w[i] - along * a.out[i]), d = Math.hypot(...v);
        if (d < 1 || d >= a.g.Df / 2 + b.g.Df / 2) return;
        const ax6 = axesFor(a.out), Y = ax6.slice(3), Z = crossV(a.out, Y);
        fl.push([Math.atan2(dotV(v, Z), dotV(v, Y)), d / 2 - 0.5]);
      });
      const g = a.g, rb = (g.D / 2 + g.Df / 2) / 2, dh = (g.dks || 8) + 1;
      // головки винтов над фланцем не должны упираться в стенку корпуса
      const ax6h = axesFor(a.out), Yh = ax6h.slice(3), Zh = crossV(a.out, Yh), [sHex, kHex] = hexOf(g.dks || 8);
      const headFree = phi => !solid || [...Array(g.n).keys()].every(j => { const a2 = phi + 2 * Math.PI * j / g.n;
        const cx = rb * Math.cos(a2), cy = rb * Math.sin(a2);
        for (const h of [g.tf + 0.5, g.tf + kHex - 0.5]) for (let i = 0; i < 8; i++) { const b = i * Math.PI / 4, y = cx + sHex / 2 * Math.cos(b), z = cy + sHex / 2 * Math.sin(b);
          if (solid([0, 1, 2].map(m => a.pos[m] + a.out[m] * h + y * Yh[m] + z * Zh[m]))) return false; }
        return true; });
      // винты не должны пересекать стяжные болты, проходящие рядом через прилив
      const Lsc = lenUp(g.tf + 2.2 * (g.dks || 8));
      const clearB = phi => !(obst && obst.length) || [...Array(g.n).keys()].every(j => { const a2 = phi + 2 * Math.PI * j / g.n;
        const cx = rb * Math.cos(a2), cy = rb * Math.sin(a2);
        for (let t = 0; t <= 1.0001; t += 0.1) {
          const h = g.tf - t * (Lsc + 3), P = [0, 1, 2].map(m => a.pos[m] + a.out[m] * h + cx * Yh[m] + cy * Zh[m]);
          for (const ob of obst) { const w = [0, 1, 2].map(m => P[m] - ob.p[m]), al = dotV(w, ob.d), d2 = Math.hypot(w[0] - al * ob.d[0], w[1] - al * ob.d[1], w[2] - al * ob.d[2]);
            if (d2 < ob.r + 0.42 * (g.dks || 8) + 1 && (ob.lo === undefined || (al >= ob.lo && al <= ob.hi))) return false; }
        }
        return true; });
      if (!fl.length && headFree(Math.PI / g.n) && clearB(Math.PI / g.n)) return;
      // поворот винтов: наибольший запас до лысок, головки — в свободном месте
      let best = Math.PI / g.n, bm = -Infinity;
      for (let t = 0; t < 360 / g.n; t += 1) {
        const phi = t * Math.PI / 180;
        let m = fl.length ? Infinity : 0;
        for (let j = 0; j < g.n; j++) { const a2 = phi + 2 * Math.PI * j / g.n; fl.forEach(([th, dist]) => { m = Math.min(m, dist - rb * Math.cos(a2 - th) - dh / 2 - 1.5); }); }
        if (!headFree(phi)) m -= 1000;
        if (!clearB(phi)) m -= 1000;
        if (m > bm + 1e-6) { bm = m; best = phi; }
      }
      const g2 = Object.assign({}, g, { flats: fl.map(([th, dd]) => [r2(th * 1000) / 1000, r2(dd)]), phi: r2(best * 1000) / 1000 });
      const base = a.item.file.replace(/\.m3d$/, '');
      const sig = g2.flats.map(([th, dd]) => Math.round(th * 180 / Math.PI) + 'x' + Math.round(dd)).join('_') + (g2.flats.length ? '' : 'r' + Math.round(best * 180 / Math.PI));
      const id = base + '_f' + sig.replace(/-/g, 'm');
      const src = parts.find(p => p.file === a.item.file);
      if (!parts.some(p => p.id === id)) parts.push(Object.assign({}, src, { id, file: id + '.m3d', geom: g2, name: src.name }));
      a.item.file = id + '.m3d'; a.g = g2;
    });
    // исходные крышки без лысок, которые больше нигде не стоят, — убрать из списка деталей
    for (let i = parts.length - 1; i >= 0; i--) if (parts[i].kind === 'cover' && !covList.some(c => c.item && c.item.file === parts[i].file)) parts.splice(i, 1);
  }
  const dotV = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const crossV = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

  /* сливная пробка: ищется место в стенке у дна полости, где отверстие целиком в металле, а головка снаружи
     ни во что не упирается (лапы, приливы, рёбра). cands — точки внутри полости с направлением наружу к стенке,
     в порядке предпочтения (снизу вверх). Возвращает {face, inner, d} или null. */
  function findPlug(solid, cands, dp, sHex, kHex) {
    const perp = d => { const a = Math.abs(d[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0]; const e1 = crossV(d, a), n1 = Math.hypot(...e1); const u = e1.map(x => x / n1); return [u, crossV(d, u)]; };
    for (const { c, d } of cands) {
      const at = t => [0, 1, 2].map(i => c[i] + d[i] * t);
      if (solid(c)) continue;
      let t1 = null, t2 = null;
      for (let t = 0; t <= 90; t += 0.5) { const sd = solid(at(t)); if (t1 === null && sd) t1 = t; else if (t1 !== null && !sd) { t2 = t; break; } }
      if (t1 === null || t2 === null || t1 > 30 || t2 - t1 > 45 || t2 - t1 < 4) continue;
      const [e1, e2] = perp(d);
      const ring = (t, r, want) => { for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6, p = at(t).map((v, k) => v + r * (Math.cos(a) * e1[k] + Math.sin(a) * e2[k])); if (solid(p) !== want) return false; } return true; };
      if (![t1 + 1, (t1 + t2) / 2, t2 - 1].every(t => ring(t, dp / 2 + 1.5, true))) continue;
      if (![t2 + 0.5, t2 + kHex / 2, t2 + kHex + 1].every(t => ring(t, sHex / 2 + 1.5, false) && !solid(at(t)))) continue;
      return { face: at(t2), inner: at(t1), d, t1, t2 };
    }
    return null;
  }
  const plugOp = (pl, dp) => { const ai = axisIdx(pl.d), base = BASE_OF_AXIS[ai], cc = CAN[base];
    const a1 = pl.face[ai] + pl.d[ai] * 1, a2 = pl.inner[ai] - pl.d[ai] * 1.5;
    return { n: 'отверстие под пробку', base, a: r2(Math.min(a1, a2)), b: r2(Math.max(a1, a2)), loops: [{ c: [r2(pl.face[cc[0]]), r2(pl.face[cc[1]]), r2(dp / 2)] }], cut: true }; };

  /* точка внутри тела из операций (выдавливания и вырезы по порядку) — для подбора крепежа по месту */
  function inOpsW(ops, p) {
    const NR = { XOY: 2, XOZ: 1, YOZ: 0 }, CN = { XOY: [0, 1], XOZ: [0, 2], YOZ: [1, 2] };
    let s = false;
    for (const o of ops) {
      const n = NR[o.base], c = CN[o.base], t = p[n];
      if (t < o.a || t > o.b || s === !o.cut) continue;
      const u = p[c[0]], v = p[c[1]];
      const ins = o.loops.some(l => {
        if (l.c) return (u - l.c[0]) ** 2 + (v - l.c[1]) ** 2 <= l.c[2] ** 2;
        let k = false; const P = l.p;
        for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const a = P[i], b = P[j]; if ((a[1] > v) !== (b[1] > v) && u < (b[0] - a[0]) * (v - a[1]) / (b[1] - a[1]) + a[0]) k = !k; }
        return k;
      });
      if (ins) s = !o.cut;
    }
    return s;
  }

  /* крышка смотрового люка (пластина по бобышке) с 4 винтами М6 и резьбовыми отверстиями в крышке корпуса.
     o: base — плоскость эскиза, can(u, v) — точка плана → эскиз, nw(n) — высота → координата по нормали эскиза,
     W(u, v, n) — точка → мир, nDir — мировое направление +n, rect — проём люка в координатах плана, top — верх бобышки */
  function hatchLid(o) {
    const t = 6, d = 6, m = 12, r = o.rect, R0 = { x1: r.x1 - m, y1: r.y1 - m, x2: r.x2 + m, y2: r.y2 + m };
    const rl = q => ({ p: [o.can(q.x1, q.y1), o.can(q.x2, q.y1), o.can(q.x2, q.y2), o.can(q.x1, q.y2)] });
    const sl = (n, n1, n2, loops, cut) => ({ n, base: o.base, a: r2(Math.min(o.nw(n1), o.nw(n2))), b: r2(Math.max(o.nw(n1), o.nw(n2))), loops, cut: !!cut });
    const cr = [[r.x1 - m / 2, r.y1 - m / 2], [r.x2 + m / 2, r.y1 - m / 2], [r.x2 + m / 2, r.y2 + m / 2], [r.x1 - m / 2, r.y2 + m / 2]];
    const ci = rr => cr.map(([u, v]) => { const c = o.can(u, v); return { c: [r2(c[0]), r2(c[1]), r2(rr)] }; });
    const L = lenUp(t + 2 * d), [sk, kk] = hexOf(d);
    const ops = [sl('пластина крышки люка', o.top, o.top + t, [rl(R0)]), sl('отверстия под винты', o.top - 1, o.top + t + 1, ci(3.3), true)];
    const part = { id: 'kryshka_lyuka', name: 'Крышка смотрового люка', kind: 'ops', geom: { ops }, file: 'kryshka_lyuka.m3d', material: 'Ст3 ГОСТ 380-2005', density: 7.85 };
    const screw = { id: `screw_M${d}x${L}`, name: `Винт М${d}×${L} ГОСТ 7808-70`, kind: 'bolt', geom: { d, L, s: sk, k: kk }, file: `screw_M${d}x${L}.m3d`, material: 'Сталь 35 ГОСТ 1050-2013', std: true };
    const down = o.nDir.map(c => -c);
    const items = [{ file: part.file, pos: [0, 0, 0], axes: [1, 0, 0, 0, 1, 0] }].concat(cr.map(([u, v]) => ({ file: screw.file, pos: o.W(u, v, o.top + t).map(r2), axes: axesFor(down) })));
    const holeOp = sl('резьбовые отверстия под винты люка', o.top - (L - t) - 3, o.top + 0.5, ci(0.42 * d), true);
    return { parts: [part, screw], items, holeOp, d, L, n: 4 };
  }

  /* ---------------------------------------------------------------- корпус с вертикальными валами (задание 1, рис. 2.12)
     Профиль — разрез по плоскости осей XY (все три вала в ней), выдавливается поперёк (по Z) на глубину колёс;
     разъём горизонтальный, между нижними и верхними подшипниками вертикальных валов. */
  function housingV(R, P, T) {
    const AS = root.DRWASM, A = AS.asmData(R, P, T), H = R.H || {};
    const del = H.del || 8, gap = H.gap || 10, K = H.K || 24, K1 = (H.K1 || 20) + 8, pF = H.p || 18, tf = 1.5 * del;
    const PL = { u: [1, 0, 0], v: [0, 1, 0], n: [0, 0, 1] };
    const S = AS.sectionView(A, R, PL, 1);
    const xy = p => ({ p: p.map(q => [r2(q[0]), r2(q[1])]) });
    const rectXY = r => xy([[r.x1, r.y1], [r.x2, r.y1], [r.x2, r.y2], [r.x1, r.y2]]);
    const rectXZ = (x1, z1, x2, z2) => ({ p: [[x1, z1], [x2, z1], [x2, z2], [x1, z2]].map(q => q.map(r2)) });
    const sXY = (name, z1, z2, loops, cut) => ({ n: name, base: 'XOY', a: r2(Math.min(z1, z2)), b: r2(Math.max(z1, z2)), loops, cut: !!cut });
    const sXZ = (name, y1, y2, loops, cut) => ({ n: name, base: 'XOZ', a: r2(Math.min(y1, y2)), b: r2(Math.max(y1, y2)), loops, cut: !!cut });
    const cyl = (name, ai, a1, a2, ctr, rr, cut) => { const b2 = BASE_OF_AXIS[ai], cc = CAN[b2]; return { n: name, base: b2, a: r2(Math.min(a1, a2)), b: r2(Math.max(a1, a2)), loops: [{ c: [r2(ctr[cc[0]]), r2(ctr[cc[1]]), r2(rr)] }], cut: !!cut }; };
    // глубина полости (по Z) над каждой частью профиля — по колёсам и шестерням, которые в неё проецируются
    const foot = [];
    const boxAlong = (c2, d2, hl, rr) => { const e = [Math.abs(d2[0]) * hl + Math.abs(d2[1]) * rr, Math.abs(d2[1]) * hl + Math.abs(d2[0]) * rr]; return { x1: c2[0] - e[0], x2: c2[0] + e[0], y1: c2[1] - e[1], y2: c2[1] + e[1] }; };
    A.wheels.forEach(w => { const r = (w.g.daM || w.g.da || w.g.dae || 100) / 2; foot.push(Object.assign(boxAlong([w.pos[0], w.pos[1]], [w.ax[0], w.ax[1]], Math.max(w.g.b || 20, w.g.lst || 0) / 2, r), { h: r })); });
    A.shafts.forEach(sf => sf.segs.forEach(g => { const rr = g.gear ? (g.gear.da || 2 * g.r) / 2 : g.r, mid = (g.x0 + g.x1) / 2; foot.push(Object.assign(boxAlong([sf.pos[0] + sf.ax[0] * mid, sf.pos[1] + sf.ax[1] * mid], [sf.ax[0], sf.ax[1]], (g.x1 - g.x0) / 2, rr), { h: rr })); }));
    const hit = (a, b) => a.x1 < b.x2 - 0.5 && b.x1 < a.x2 - 0.5 && a.y1 < b.y2 - 0.5 && b.y1 < a.y2 - 0.5;
    const cavZ = S.cavs.map(cv => Math.round(Math.max(40, ...foot.filter(f => hit(f, cv)).map(f => f.h)) + gap));
    const Wz = Math.max(...cavZ);
    const ops = [];
    const levels = [...new Set(cavZ)].sort((a, b) => a - b);
    levels.forEach((h, i) => ops.push(sXY('стенки' + (levels.length > 1 ? ' ' + (i + 1) : ''), -h - del, h + del, outline(S.cavs.filter((c, j) => cavZ[j] === h).map(cv => ({ x1: cv.x1 - del, y1: cv.y1 - del, x2: cv.x2 + del, y2: cv.y2 + del }))).map(xy))));
    // приливы под подшипники (цилиндры по осям валов) и стакан вала-шестерни
    S.bosses.forEach((b, i) => { const ai = b.c === 0 ? 0 : 1, ctr = b.c === 0 ? [0, b.ax, 0] : [b.ax, 0, 0]; ops.push(cyl('прилив ' + (i + 1), ai, b.wallIn, b.face, ctr, b.bossR)); });
    const tubeCuts = [];
    S.inPlane.filter(s => s.tube).forEach(s => {
      const c = s.horiz ? 0 : 1, t = s.tube, ax = s.o[1 - c], ctr = c === 0 ? [0, ax, 0] : [ax, 0, 0];
      const t1 = c === 0 ? t.x1 : t.y1, t2 = c === 0 ? t.x2 : t.y2, rr = (c === 0 ? t.y2 - t.y1 : t.x2 - t.x1) / 2;
      ops.push(cyl('стакан', c, t1, t2, ctr, rr));
      const far = s.cartridge === 'hi' ? t2 : t1, bossR = (s.b ? s.b.D / 2 : rr) + 2.1 * (H.dks || 8) + 6;
      ops.push(cyl('фланец стакана', c, far, s.cartridge === 'hi' ? far - 9 : far + 9, ctr, bossR));
      // стакан с фланцем относится к крышке корпуса: часть фланца ниже разъёма в основание не попадает
      tubeCuts.push(cyl('срез фланца стакана', c, s.cartridge === 'hi' ? far + 1 : far - 1, s.cartridge === 'hi' ? far - 10 : far + 10, ctr, bossR + 1, true));
    });
    // разъём: выше нижних и ниже верхних подшипников вертикальных валов
    const vb = S.bosses.filter(b => b.c === 1);
    const lowIn = vb.filter(b => b.face < b.wallIn).map(b => b.wallIn), upIn = vb.filter(b => b.face > b.wallIn).map(b => b.wallIn);
    let ys = 0;
    if (lowIn.length && upIn.length) { const a = Math.max(...lowIn) + del + 4, b = Math.min(...upIn) - del - 4; ys = Math.round(b > a ? b : (a + b) / 2); }
    // полость
    levels.forEach((h, i) => ops.push(sXY('полость' + (i ? ' ' + (i + 1) : ''), -h, h, outline(S.cavs.filter((c, j) => cavZ[j] === h)).map(xy), true)));
    S.inPlane.forEach(s => {
      const c = s.horiz ? 0 : 1, ax = s.o[1 - c], D = (s.b ? s.b.D : 2 * s.segs[0].r + 30) / 2;
      S.bores.filter(b => Math.abs((c === 0 ? (b.y1 + b.y2) : (b.x1 + b.x2)) / 2 - ax) < 0.5).forEach((b, i) => ops.push(cyl('расточка ⌀' + Math.round(2 * D) + ' ' + (i + 1), c, c === 0 ? b.x1 : b.y1, c === 0 ? b.x2 : b.y2, c === 0 ? [0, ax, 0] : [ax, 0, 0], D, true)));
    });
    // габариты стенок
    const xW1 = Math.min(...S.cavs.map(c => c.x1)) - del, xW2 = Math.max(...S.cavs.map(c => c.x2)) + del;
    const yBot = Math.min(...S.cavs.map(c => c.y1)) - del;
    const atS = S.cavs.map((c, j) => ({ c, h: cavZ[j] })).filter(q => q.c.y1 - del < ys + tf && q.c.y2 + del > ys - tf);
    const xa = Math.min(...atS.map(q => q.c.x1)) - del, xb = Math.max(...atS.map(q => q.c.x2)) + del, zW = Math.max(...atS.map(q => q.h)) + del;
    // фланцы разъёма — горизонтальная плита по контуру стенок в плоскости разъёма
    const flR = { x1: xa - K, x2: xb + K, z1: -(zW + K), z2: zW + K };
    ops.push(sXZ('фланцы разъёма', ys - tf, ys + tf, [rectXZ(flR.x1, flR.z1, flR.x2, flR.z2)]));
    ops.splice(ops.findIndex(o => o.cut), 0, ops.pop());
    // лапы: две полосы вдоль X по бокам, опора ниже нижних крышек подшипников
    const lowFace = vb.filter(b => b.face < b.wallIn).map(b => b.face);
    const yFeet = Math.round(Math.min(yBot, ...(lowFace.length ? lowFace.map(f => f - 20) : [yBot])));
    const zB = Wz + del;
    const strips = [[-(zB + K1), -(zB - del)], [zB - del, zB + K1]];
    ops.splice(ops.findIndex(o => o.cut), 0, sXZ('лапы', yFeet, yBot + pF, strips.map(([z1, z2]) => rectXZ(xW1 - K1, z1, xW2 + K1, z2))));
    // отверстия: фланец (по контуру), штифты, лапы
    const d3 = H.d3 || 10, dh = d3 + 1, d1 = (H.d1 || 16) + 2;
    const clear = (x, z, r) => {
      if (S.bosses.some(b => b.c === 1 && Math.hypot(x - b.ax, z) < b.bossR + r + 3)) return false;
      if (S.inPlane.some(s => s.tube && x > s.tube.x1 - r && x < s.tube.x2 + r && Math.abs(z) < (s.tube.y2 - s.tube.y1) / 2 + r + 2)) return false;
      // не над/под полостью и стенками вблизи разъёма (место под головку болта и гайку)
      if (S.cavs.some((c, j) => c.y1 - del < ys + tf + 30 && c.y2 + del > ys - tf - 30 && x > c.x1 - del - r - 1 && x < c.x2 + del + r + 1 && Math.abs(z) < cavZ[j] + del + r + 1)) return false;
      return x > flR.x1 + r && x < flR.x2 - r && z > flR.z1 + r && z < flR.z2 - r;
    };
    const holes = [], step = Math.max(110, 12 * d3);
    const nx = Math.max(2, Math.round((flR.x2 - flR.x1 - K) / step) + 1);
    for (const z of [flR.z1 + K / 2, flR.z2 - K / 2]) for (let i = 0; i < nx; i++) { const x = flR.x1 + K / 2 + (flR.x2 - flR.x1 - K) * i / (nx - 1); if (clear(x, z, dh * 0.9)) holes.push([x, z]); }
    for (const x of [flR.x1 + K / 2, flR.x2 - K / 2]) if (clear(x, 0, dh * 0.9)) holes.push([x, 0]);
    const pinC = [[flR.x1 + K / 2, (flR.z1 + flR.z2) / 2 - zW * 0.5], [flR.x2 - K / 2, zW * 0.5]].filter(([x, z]) => clear(x, z, 6) && !holes.some(h => Math.hypot(h[0] - x, h[1] - z) < 3 * dh));
    if (holes.length) ops.push(sXZ('отверстия под болты фланца', ys - tf - 5, ys + tf + 5, holes.map(([x, z]) => ({ c: [r2(x), r2(z), r2(dh / 2)] })), true));
    if (pinC.length) ops.push(sXZ('отверстия под штифты', ys - tf - 10, ys + tf + 10, pinC.map(([x, z]) => ({ c: [r2(x), r2(z), 4] })), true));
    const feetH = [];
    for (const x of [xW1 - K1 / 2, xW2 + K1 / 2]) for (const z of [-(zB + K1 / 2 - del / 2), zB + K1 / 2 - del / 2]) feetH.push([x, z]);
    ops.push(sXZ('отверстия в лапах', yFeet - 1, yBot + pF + 1, feetH.map(([x, z]) => ({ c: [r2(x), r2(z), r2(d1 / 2)] })), true));
    // крышка: верх — по верхней стенке; смотровой люк над самой высокой частью, в стороне от приливов
    const yTops = S.cavs.map(c => c.y2 + del), yTop = Math.max(...yTops);
    // смотровой люк: в верхней стенке крышки над той частью полости, где есть место между приливами
    let hatch = null;
    S.cavs.forEach((cT, j) => {
      const yT = cT.y2 + del;
      if (yT < ys + tf + 15) return;
      const hz = Math.min(60, cavZ[j] - 20);
      if (hz < 15) return;
      for (let hx = Math.min(60, (cT.x2 - cT.x1) / 2 - 20); hx >= 20; hx -= 5) for (let x = cT.x1 + hx + 12; x <= cT.x2 - hx - 12; x += 4) {
        const dmin = Math.min(1e9, ...vb.filter(b => b.face > b.wallIn).map(b => Math.abs(x - b.ax) - b.bossR));
        // над этим местом не должно быть более высокой части корпуса
        const covered = S.cavs.some((c2, i2) => i2 !== j && c2.y2 + del > yT && x + hx > c2.x1 - del && x - hx < c2.x2 + del);
        if (dmin > hx + 10 && !covered) { const sc = hx * hz; if (!hatch || sc > hatch.s) hatch = { x1: x - hx, x2: x + hx, z1: -hz, z2: hz, y: yT, s: sc }; }
      }
    });
    const big = rectXZ(flR.x1 - 600, flR.z1 - 600, flR.x2 + 600, flR.z2 + 600);
    const HW = makeHW(H);
    // подшипники и крышки
    S.inPlane.forEach(s => {
      if (!s.b) return;
      const c = s.horiz ? 0 : 1, av = c === 0 ? [1, 0, 0] : [0, 1, 0], ax = s.o[1 - c];
      const f = HW.bearingPart(s.b);
      (s.inner || []).forEach(q => { const mid = (q.lo + q.hi) / 2; HW.extra.push({ file: f, pos: (c === 0 ? [mid, ax, 0] : [ax, mid, 0]).map(r2), axes: axesFor(av) }); });
    });
    S.covers.forEach(cv => {
      const s = cv.s, c = s.horiz ? 0 : 1, av = c === 0 ? [1, 0, 0] : [0, 1, 0], ax = s.o[1 - c], pl = cv.q || {};
      const sealSeg = (s.segs || []).find(g => g.role === 'seal' && (pl.left ? g.x1 <= pl.a + 0.5 : g.x0 >= pl.b - 0.5));
      HW.cover(c === 0 ? [cv.face, ax, 0] : [ax, cv.face, 0], av.map(x => x * cv.dir), 2 * cv.D, sealSeg, cv.ext);
    });
    const solidAllV = ops.filter(o => !/отверстия под|срез по разъёму/.test(o.n)), sc = HW.screws(q => inOpsW(solidAllV, q), holes.map(([x, z]) => ({ p: [x, ys, z], d: [0, 1, 0], r: (d3 + 1) / 2 })));
    const fl3 = HW.bolts(d3, holes.map(([x, z]) => [x, ys + tf, z]), [0, -1, 0], 2 * tf);
    const pinL = lenUp(2 * tf + 6);
    if (pinC.length) { const fp = HW.stdPart(`pin_8x${pinL}`, `Штифт 8×${pinL} ГОСТ 3129-70`, 'pin', { d: 8, L: pinL }); pinC.forEach(([x, z]) => HW.extra.push({ file: fp, pos: [x, ys, z].map(r2), axes: axesFor([0, 1, 0]) })); }
    // сливная пробка — у дна основания; место подбирается по модели (отверстие в металле, головка не упирается в лапы)
    const plugOps = [];
    let plug = null, plugAt = null;
    {
      const dp = H.dpr || 16, [sP] = hexOf(dp), sHex = sP - 2, kHex = 9;
      const solidB = ops.filter(o => !/отверстия под/.test(o.n) && !(o.cut && /срез/.test(o.n)));
      const cands = [];
      const lows = S.cavs.map((cv, j) => ({ cv, j })).filter(({ cv }) => cv.y1 < ys - tf - dp).sort((a, b) => a.cv.y1 - b.cv.y1);
      for (let i = 0; i < 10; i++) lows.forEach(({ cv, j }) => {
        const y = cv.y1 + dp / 2 + 2 + 3 * i; if (y + dp / 2 > ys - tf - 2) return;
        const zs = [0, 0.3, -0.3, 0.6, -0.6].map(f => f * (cavZ[j] - dp)), xs = [0.5, 0.3, 0.7, 0.15, 0.85].map(f => cv.x1 + dp + (cv.x2 - cv.x1 - 2 * dp) * f);
        zs.forEach(z => { cands.push({ c: [cv.x1 + 2, y, z], d: [-1, 0, 0] }); cands.push({ c: [cv.x2 - 2, y, z], d: [1, 0, 0] }); });
        xs.forEach(x => { cands.push({ c: [x, y, -(cavZ[j] - 2)], d: [0, 0, -1] }); cands.push({ c: [x, y, cavZ[j] - 2], d: [0, 0, 1] }); });
      });
      plugAt = findPlug(q => q[1] < ys && inOpsW(solidB, q), cands, dp, sHex, kHex);
      if (plugAt) {
        plugOps.push(plugOp(plugAt, dp));
        const fpg = HW.stdPart(`probka_M${dp}`, `Пробка М${dp}×1,5`, 'bolt', { d: dp, L: 14, s: sHex, k: kHex });
        HW.extra.push({ file: fpg, pos: plugAt.face.map(r2), axes: axesFor(plugAt.d.map(x => -x)) });
        plug = dp; plugAt.dp = dp;
      }
    }
    const baseOps = ops.concat(sc.holeOps, plugOps, tubeCuts, [sXZ('срез по разъёму', ys, yTop + 300, [big], true)]);
    const coverOps = ops.filter(o => !/лапах|лапы/.test(o.n)).concat(sc.holeOps, [sXZ('срез по разъёму', yFeet - 300, ys, [big], true)]);
    let lid = null;
    if (hatch) {
      coverOps.push(sXZ('бобышка смотрового люка', hatch.y - del, hatch.y + 5, [rectXZ(hatch.x1 - 12, hatch.z1 - 12, hatch.x2 + 12, hatch.z2 + 12)]), sXZ('смотровой люк', hatch.y - del - 2, hatch.y + 7, [rectXZ(hatch.x1, hatch.z1, hatch.x2, hatch.z2)], true));
      lid = hatchLid({ base: 'XOZ', can: (u, v) => [u, v], nw: n => n, W: (u, v, n) => [u, n, v], nDir: [0, 1, 0], rect: { x1: hatch.x1, y1: hatch.z1, x2: hatch.x2, y2: hatch.z2 }, top: hatch.y + 5 });
      coverOps.push(lid.holeOp); lid.parts.forEach(p => { if (!HW.parts.some(q => q.id === p.id)) HW.parts.push(p); }); lid.items.forEach(it => HW.extra.push(it));
    }
    const fasteners = { b2: null, b3: fl3, pins: { d: 8, L: pinL, n: pinC.length }, screws: { d: H.dks || 8, L: sc.L, n: sc.n }, plug, plugAt, lid: lid ? { d: lid.d, L: lid.L, n: lid.n } : null };
    const feet = { up: [0, 1, 0], bottom: yFeet, d: d1, holes: feetH.map(([x, z]) => [x, yFeet, z]) };
    const geo = { S, ys, cavZ, Wz, del, tf, K, K1, pF, xW1, xW2, yBot, yFeet, yTop, flR, zW, zB, holes, pinC, feetH, hatch, dh, d1, d3, plugAt };
    return { baseOps, coverOps, parts: HW.parts, extra: HW.extra, fasteners, feet, geo, vertical: true };
  }

  root.M3D = { housing3d, outline };
})(typeof window !== 'undefined' ? window : globalThis);
