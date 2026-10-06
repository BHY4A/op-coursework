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
        const n = zBot + del + dp / 2 + 2 + 3 * i; if (n + dp / 2 > us - tf - 2 || i > 9) break;
        lows.forEach(({ cv }) => {
          const us_ = [0.5, 0.3, 0.7, 0.15, 0.85].map(f => cv.x1 + dp + (cv.x2 - cv.x1 - 2 * dp) * f), vs_ = [0.5, 0.3, 0.7, 0.15, 0.85].map(f => cv.y1 + dp + (cv.y2 - cv.y1 - 2 * dp) * f);
          vs_.forEach(v => { cands.push({ c: W(cv.x1 + 2, v, n), d: PL.u.map(x => -x) }); cands.push({ c: W(cv.x2 - 2, v, n), d: PL.u.slice() }); });
          us_.forEach(u => { cands.push({ c: W(u, cv.y1 + 2, n), d: PL.v.map(x => -x) }); cands.push({ c: W(u, cv.y2 - 2, n), d: PL.v.slice() }); });
        });
      }
      plugAt = findPlug(q => inOpsW(solidB, q), cands, dp, sHex, kHex);
      if (plugAt) {
        if (plugAt.pad) plugOps.push(plugPad(plugAt)); plugOps.push(plugOp(plugAt, dp));
        const fpg = stdPart(`probka_M${dp}`, `Пробка М${dp}×1,5`, 'bolt', { d: dp, L: 14, s: sHex, k: kHex });
        extra.push({ file: fpg, pos: plugAt.face.map(r2), axes: axesFor(plugAt.d.map(x => -x)) });
        plug = dp; plugAt.dp = dp;
      }
    }
    // фонарный маслоуказатель — на стенке основания на уровне масла
    let lan = null;
    {
      const solidB = baseOps.filter(o => !/отверстия под|срез по разъёму/.test(o.n));
      const lvl = oilLevel(A, PL.n), n0 = lvl === null ? zBot + del + 30 : lvl, cands = [];
      for (const dn of [0, 4, -4, 8, -8, 12, -12]) {
        const n = n0 + dn; if (n + LAN.D / 2 + 4 > us - tf || n - LAN.D / 2 < zBot + del) continue;
        S.cavs.forEach(cv => {
          [0.5, 0.3, 0.7, 0.15, 0.85].forEach(f => {
            const v = cv.y1 + (cv.y2 - cv.y1) * f, u = cv.x1 + (cv.x2 - cv.x1) * f;
            cands.push({ c: W(cv.x1 + 2, v, n), d: PL.u.map(x => -x) }, { c: W(cv.x2 - 2, v, n), d: PL.u.slice() }, { c: W(u, cv.y1 + 2, n), d: PL.v.map(x => -x) }, { c: W(u, cv.y2 - 2, n), d: PL.v.slice() });
          });
        });
      }
      const avoid = covList.map(cv => ({ p: cv.pos, r: cv.g.Df / 2 })).concat(plugAt ? [{ p: plugAt.face, r: 15 }] : []);
      const L = findLantern(q => inOpsW(solidB, q), cands, PL.n.slice(), avoid);
      if (L) { lan = lanternBuild(L); lan.parts.forEach(p => { if (!parts.some(q => q.id === p.id)) parts.push(p); }); lan.items.forEach(it => extra.push(it)); }
    }
    // фонарный не поместился — жезловый в крышке корпуса
    let dip = null;
    if (!lan) {
      const sB = baseOps.filter(o => !/отверстия под/.test(o.n)), sC = coverOps.filter(o => !/отверстия под|смотровой люк/.test(o.n));
      const solid = q => inOpsW(sB, q) || inOpsW(sC, q);
      const lvl = oilLevel(A, PL.n), tops = [];
      const fr = [0.5, 0.35, 0.65, 0.2, 0.8, 0.1, 0.9];
      S.cavs.forEach(cv => {
        const us_ = fr.map(f => cv.x1 + (cv.x2 - cv.x1) * f).concat([cv.x1 + 8, cv.x2 - 8]), vs_ = fr.map(f => cv.y1 + (cv.y2 - cv.y1) * f).concat([cv.y1 + 8, cv.y2 - 8]);
        us_.forEach(u => vs_.forEach(v => tops.push(W(u, v, zTop + 60))));
      });
      const hc = W((hatch.x1 + hatch.x2) / 2, (hatch.y1 + hatch.y2) / 2, zTop), hr = Math.hypot(hatch.x2 - hatch.x1, hatch.y2 - hatch.y1) / 2 + 14;
      const D = findDipstick(solid, tops, PL.n.slice(), lvl === null ? zBot + del + 30 : lvl, partHitFn(A), [{ p: hc, r: hr }].concat(covList.map(cv => ({ p: cv.pos, r: cv.g.Df / 2 }))));
      if (D) { dip = dipstickBuild(D); dip.parts.forEach(p => { if (!parts.some(q => q.id === p.id)) parts.push(p); }); dip.items.forEach(it => extra.push(it)); coverOps.push(dip.boss, dip.hole); }
    }
    const insertBefore = (arr, add) => { const k = arr.findIndex(o => o.n === 'срез по разъёму'); arr.splice(k, 0, ...add); return arr; };
    insertBefore(baseOps, (lan ? [lan.pad].concat(lan.cuts) : []).concat(holeOps, plugOps, boltHoleOps));
    insertBefore(coverOps, holeOps.concat(boltHoleOps));
    const lid = hatchLid({ base, can, nw, W, nDir: PL.n, rect: hatch, top: zTop + 5 });
    coverOps.push(lid.holeOp); lid.parts.forEach(p => { if (!parts.some(q => q.id === p.id)) parts.push(p); }); lid.items.forEach(it => extra.push(it));
    const fasteners = { b2: f2, b3: f3, pins: { d: 8, L: pinL, n: G.pins.length }, screws: { d: dks, L: scrL, n: nScr }, plug, plugAt, lid: { d: lid.d, L: lid.L, n: lid.n }, lantern: lan ? lan.fast : null, lanternAt: lan ? lan.at : (dip ? dip.at : null), vent: lid.vent };
    const feet = { up: PL.n.slice(), bottom: zBot, d: ft.d1, holes: [] };
    [ft.hx1 - ft.K1 / 2, ft.hx2 + ft.K1 / 2].forEach(u => [fb.y1 + ft.K1 / 2 + 6, fb.y2 - ft.K1 / 2 - 6].forEach(v => feet.holes.push(W(u, v, zBot))));
    return { baseOps, coverOps, parts, extra, fasteners, feet, lvl: { us: dot(W(0, 0, us), PL.n), zFoot: dot(W(0, 0, zFoot), PL.n), zBot: dot(W(0, 0, zBot), PL.n) } };
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
      const DB = root.PLUGDBG, R_ = r => { if (DB) DB.push({ c, d, t1, t2, r }); };
      if (t1 === null || t2 === null || t1 > 30 || t2 - t1 > 45 || t2 - t1 < 4) { R_('wall'); continue; }
      const [e1, e2] = perp(d);
      const ring = (t, r, want) => { for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6, p = at(t).map((v, k) => v + r * (Math.cos(a) * e1[k] + Math.sin(a) * e2[k])); if (solid(p) !== want) return false; } return true; };
      if (![t1 + 1, (t1 + t2) / 2, t2 - 1].every(t => ring(t, dp / 2 + 1.5, true))) { R_('metal'); continue; }
      // опорная поверхность под головку: если стенка выпуклая (прилив червяка) — плоский прилив до 12 мм
      const rr = sHex / 2 + 2; let tMax = t2;
      for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6, P = t => at(t).map((v, k) => v + rr * (Math.cos(a) * e1[k] + Math.sin(a) * e2[k])); for (let t = t1; t <= t2 + 14; t += 0.5) if (!solid(P(t))) { if (t > t1 + 1) tMax = Math.max(tMax, t); break; } }
      if (tMax - t2 > 12) { R_('bulge'); continue; }
      if (![tMax + 0.5, tMax + kHex / 2, tMax + kHex + 1].every(t => ring(t, sHex / 2 + 1.5, false) && !solid(at(t)))) { R_('head'); continue; }
      return { face: at(tMax), inner: at(t1), d, t1, t2: tMax, pad: tMax - t2 > 0.5 ? { from: at(t2 - 1), r: rr } : null };
    }
    return null;
  }
  const plugPad = pl => { const ai = axisIdx(pl.d), base = BASE_OF_AXIS[ai], cc = CAN[base], a1 = pl.pad.from[ai], a2 = pl.face[ai];
    return { n: 'прилив под пробку', base, a: r2(Math.min(a1, a2)), b: r2(Math.max(a1, a2)), loops: [{ c: [r2(pl.face[cc[0]]), r2(pl.face[cc[1]]), r2(pl.pad.r)] }], cut: false }; };
  const plugOp = (pl, dp) => { const ai = axisIdx(pl.d), base = BASE_OF_AXIS[ai], cc = CAN[base];
    const a1 = pl.face[ai] + pl.d[ai] * 1, a2 = pl.inner[ai] - pl.d[ai] * 1.5;
    return { n: 'отверстие под пробку', base, a: r2(Math.min(a1, a2)), b: r2(Math.max(a1, a2)), loops: [{ c: [r2(pl.face[cc[0]]), r2(pl.face[cc[1]]), r2(dp / 2)] }], cut: true }; };

  /* фонарный маслоуказатель (Чернавский, рис. 10.36: d = 32, D = 60, D1 = 49, l = 12, винты М6, отверстия ⌀4):
     ставится на наружную плоскую стенку основания на уровне масла. Место подбирается по модели: за прокладкой
     (приливом) — сплошная стенка, снаружи ничего нет, рядом нет крышек подшипников и пробки.
     cands — точки внутри полости с направлением d наружу; up — мировое «вверх». */
  const LAN = { d: 32, D: 60, D1: 49, l: 12, fl: 5, pad: 4, ds: 6 };
  function findLantern(solid, cands, up, avoid) {
    const Rp = LAN.D / 2 + 3, Hh = LAN.pad + LAN.l + 2;
    for (const { c, d } of cands) {
      const at = t => [0, 1, 2].map(i => c[i] + d[i] * t);
      if (solid(c)) continue;
      let t1 = null, t2 = null;
      for (let t = 0; t <= 60; t += 0.5) { const sd = solid(at(t)); if (t1 === null && sd) t1 = t; else if (t1 !== null && !sd) { t2 = t; break; } }
      const DB = root.LANDBG, R_ = r => { if (DB) DB.push({ c, d, t1, t2, r }); };
      if (t1 === null || t2 === null || t1 > 20 || t2 - t1 > 25 || t2 - t1 < 6) { R_('wall'); continue; }
      const e2 = crossV(d, up);
      const pt = (t, r, a) => at(t).map((v, k) => v + r * (Math.cos(a) * up[k] + Math.sin(a) * e2[k]));
      // наружная поверхность под прокладкой: выход из металла по кольцам Rp и Rp/2 — прилив выравнивает выпуклость (прилив червяка) до 25 мм
      let tMin = Infinity, tMax = -Infinity, bad = false;
      for (const r of [Rp, Rp * 0.7, Rp / 2]) for (let i = 0; i < 16 && !bad; i++) {
        const a = i * Math.PI / 8;
        let ti = null; for (let t = 0; t <= t1 + 20; t += 0.5) if (solid(pt(t, r, a))) { ti = t; break; }
        if (ti === null) { bad = true; break; }
        let te = null; for (let t = ti; t <= ti + 45; t += 0.5) if (!solid(pt(t, r, a))) { te = t; break; }
        if (te === null || te - ti < 5) { bad = true; break; } tMin = Math.min(tMin, te); tMax = Math.max(tMax, te);
      }
      tMax = Math.max(tMax, t2); tMin = Math.min(tMin, t2);
      if (bad || tMax - tMin > 25 || tMin - t1 < 6) { R_('flat ' + (bad ? 'bad' : (tMax - tMin) + '/' + (tMin - t1))); continue; }
      // металл под резьбовыми отверстиями винтов М6 (окружность D1)
      let wallS = Infinity;
      for (const ang of [45, 135, 225, 315]) { const a = ang * Math.PI / 180; let ti = null; for (let t = 0; t <= tMax; t += 0.5) if (solid(pt(t, LAN.D1 / 2, a))) { ti = t; break; } wallS = Math.min(wallS, ti === null ? 0 : tMax - ti); }
      if (LAN.pad + wallS - 2 < 8) { R_('thread'); continue; }
      const vent = s => at(t1 - 1).map((v, k) => v + s * (LAN.d / 2 - 4) * up[k]);
      if (solid(vent(1)) || solid(vent(-1))) { R_('vent'); continue; }
      const ring = (t, r) => { for (let i = 0; i < 16; i++) if (solid(pt(t, r, i * Math.PI / 8))) return false; return true; };
      if (![0.5, Hh / 2, Hh].every(dt => ring(tMax + dt, Rp + 1.5) && ring(tMax + dt, Rp / 2) && !solid(at(tMax + dt)))) { R_('out'); continue; }
      const f = at(tMax);
      if ((avoid || []).some(a => Math.hypot(f[0] - a.p[0], f[1] - a.p[1], f[2] - a.p[2]) < a.r + Rp + 4)) { R_('avoid'); continue; }
      return { face: f, inner: at(t1), d, up, e2, wall: tMax - t1, bulge: tMax - tMin, wallS };
    }
    return null;
  }
  /* по найденному месту: вырезы и прилив в корпусе, деталь «Маслоуказатель фонарный», винты М6 */
  function lanternBuild(L) {
    const cy = (name, p0, t0, t1, rr, cut) => { const ai = axisIdx(L.d), b = BASE_OF_AXIS[ai], cc = CAN[b], a1 = p0[ai] + L.d[ai] * t0, a2 = p0[ai] + L.d[ai] * t1; return { n: name, base: b, a: r2(Math.min(a1, a2)), b: r2(Math.max(a1, a2)), loops: [{ c: [r2(p0[cc[0]]), r2(p0[cc[1]]), r2(rr)] }], cut: !!cut }; };
    const multi = (name, pts, t0, t1, rr, cut) => { const o = cy(name, pts[0], t0, t1, rr, cut); const cc = CAN[o.base]; o.loops = pts.map(p => ({ c: [r2(p[cc[0]]), r2(p[cc[1]]), r2(rr)] })); return o; };
    const off = (p, s1, s2) => p.map((v, k) => v + s1 * L.up[k] + s2 * L.e2[k]);
    const Rp = LAN.D / 2 + 3, F = LAN.pad, depth = Math.min(14, LAN.pad + L.wallS - 2);
    const scr = [45, 135, 225, 315].map(a => off(L.face, LAN.D1 / 2 * Math.cos(a * Math.PI / 180), LAN.D1 / 2 * Math.sin(a * Math.PI / 180)));
    const vents = [1, -1].map(s => off(L.face, s * (LAN.d / 2 - 4), 0));
    const pad = cy('прилив под маслоуказатель', L.face, -(L.bulge || 0) - 1, F, Rp);
    const cuts = [multi('отверстия маслоуказателя ⌀4', vents, -L.wall - 1, F + 1, 2, true), multi('резьбовые отверстия под винты маслоуказателя', scr, F - depth, F + 0.5, 0.42 * LAN.ds, true)];
    const ops = [cy('фланец маслоуказателя', L.face, F, F + LAN.fl, LAN.D / 2), cy('корпус маслоуказателя', L.face, F + LAN.fl, F + LAN.l, LAN.d / 2 + 3),
      multi('отверстия под винты', scr, F - 1, F + LAN.fl + 1, (LAN.ds + 0.6) / 2, true)];
    const Ls = LEN.filter(v => v <= LAN.fl + depth - 1).pop() || 12, [sk, kk] = hexOf(LAN.ds);
    const part = { id: 'maslouk', name: 'Маслоуказатель фонарный', kind: 'ops', geom: { ops }, file: 'maslouk.m3d', material: 'Ст3 ГОСТ 380-2005', density: 7.85 };
    const screw = { id: `screw_M${LAN.ds}x${Ls}`, name: `Винт М${LAN.ds}×${Ls} ГОСТ 7808-70`, kind: 'bolt', geom: { d: LAN.ds, L: Ls, s: sk, k: kk }, file: `screw_M${LAN.ds}x${Ls}.m3d`, material: 'Сталь 35 ГОСТ 1050-2013', std: true };
    const ax = axesFor(L.d.map(c => -c));
    const items = [{ file: part.file, pos: [0, 0, 0], axes: [1, 0, 0, 0, 1, 0] }].concat(scr.map(p => ({ file: screw.file, pos: p.map((v, k) => r2(v + L.d[k] * (F + LAN.fl))), axes: ax })));
    return { pad, cuts, parts: [part, screw], items, at: { face: L.face.map(r2), d: L.d, up: L.up, D: LAN.D, l: LAN.l + LAN.pad }, fast: { d: LAN.ds, L: Ls, n: 4 } };
  }
  /* жезловый маслоуказатель в крышке корпуса (Чернавский, рис. 10.34, б, в: головка ⌀22, резьба М16, стержень ⌀6 с рисками
     уровней) — когда фонарный не помещается (низкое основание, лапы). Вертикально сверху через стенку крышки до уровня масла;
     место подбирается по модели: одна стенка 6…16 мм, ниже — свободная полость без колёс и валов, выше — свободно. */
  const DIP = { dh: 22, dt: 16, dr: 6, boss: 6, head: 22 };
  function findDipstick(solid, tops, up, level, partHit, avoid) {
    const rodR = DIP.dr / 2;
    for (const p0 of tops) {
      const at = t => [0, 1, 2].map(i => p0[i] - up[i] * t);
      if (solid(p0)) continue;
      let tA = null, tB = null;
      for (let t = 0; t <= 400; t += 0.5) { const sd = solid(at(t)); if (tA === null && sd) tA = t; else if (tA !== null && !sd) { tB = t; break; } }
      const DB = root.DIPDBG, R_ = r => { if (DB) DB.push({ p0, tA, tB, r }); };
      if (tA === null || tB === null || tB - tA < 6 || tB - tA > 16 || tA < DIP.head + DIP.boss + 4) { R_('wall'); continue; }
      const lv = dotV(p0, up) - level, tEnd = lv + 12;            // низ стержня — на 12 мм ниже уровня
      if (tEnd < tB + 20) { R_('short'); continue; }
      const e1 = Math.abs(up[0]) < 0.9 ? crossV(up, [1, 0, 0]) : crossV(up, [0, 1, 0]), n1 = Math.hypot(...e1), u1 = e1.map(x => x / n1), u2 = crossV(up, u1);
      const ring = (t, r) => [...Array(8).keys()].map(i => { const a = i * Math.PI / 4; return at(t).map((v, k) => v + r * (Math.cos(a) * u1[k] + Math.sin(a) * u2[k])); });
      let ok = true;
      for (let t = tB + 0.5; t <= tEnd + 1 && ok; t += 2) { if (solid(at(t)) || ring(t, rodR + 3).some(q => solid(q) || partHit(q))) ok = false; }
      if (!ok) { R_('rod'); continue; }
      // бобышка и головка снаружи: свободно в радиусе бобышки
      for (let t = tA - 0.5; t >= tA - DIP.boss - DIP.head - 2 && ok; t -= 2) if (solid(at(t)) || ring(t, 16).some(q => solid(q) || partHit(q))) ok = false;
      if (!ok || ring(tA + 1, 15).some(q => !solid(q))) { R_(ok ? 'flat' : 'head'); continue; }
      const f = at(tA);
      if ((avoid || []).some(a => Math.hypot(f[0] - a.p[0], f[1] - a.p[1], f[2] - a.p[2]) < a.r + 18)) { R_('avoid'); continue; }
      return { top: f, up, wall: tB - tA, len: tEnd - tA };
    }
    return null;
  }
  function dipstickBuild(D) {
    const ai = axisIdx(D.up), b = BASE_OF_AXIS[ai], cc = CAN[b], s = D.up[ai];
    const cy = (name, t0, t1, rr, cut) => { const a1 = D.top[ai] + s * t0, a2 = D.top[ai] + s * t1; return { n: name, base: b, a: r2(Math.min(a1, a2)), b: r2(Math.max(a1, a2)), loops: [{ c: [r2(D.top[cc[0]]), r2(D.top[cc[1]]), r2(rr)] }], cut: !!cut }; };
    const B = DIP.boss;
    const boss = cy('бобышка маслоуказателя', -1, B, 15);
    const hole = cy('резьбовое отверстие М16 под маслоуказатель', -D.wall - 1, B + 1, 0.42 * DIP.dt, true);
    const ops = [cy('стержень ⌀6', -D.len, -D.wall + 1, DIP.dr / 2), cy('резьбовая часть М16', -D.wall + 1, B, 0.42 * DIP.dt - 0.2), cy('бурт ⌀20', B, B + 3, 10), cy('шейка ⌀10', B + 3, B + 15, 5), cy('головка ⌀22', B + 15, B + DIP.head, DIP.dh / 2)];
    const part = { id: 'maslouk', name: 'Маслоуказатель жезловый', kind: 'ops', geom: { ops }, file: 'maslouk.m3d', material: 'Ст3 ГОСТ 380-2005', density: 7.85 };
    return { boss, hole, parts: [part], items: [{ file: part.file, pos: [0, 0, 0], axes: [1, 0, 0, 0, 1, 0] }], at: { kind: 'dip', top: D.top.map(r2), up: D.up, len: r2(D.len), boss: B } };
  }
  // детали внутри полости (колёса, валы) — точка p задевает их с запасом
  const partHitFn = A => p => A.wheels.some(w => { const da = w.g.daM || w.g.da || w.g.dae || 100, q = [0, 1, 2].map(i => p[i] - w.pos[i]), t = dotV(q, w.ax), rr = Math.hypot(q[0] - t * w.ax[0], q[1] - t * w.ax[1], q[2] - t * w.ax[2]);
      return (Math.abs(t) <= (w.g.b || 20) / 2 + 4 && rr <= da / 2 + 4) || (Math.abs(t) <= Math.max(w.g.b || 20, w.g.lst || 0) / 2 + 4 && rr <= (w.g.dst || 0.4 * da) / 2 + 4); })
    || A.shafts.some(sf => { const q = [0, 1, 2].map(i => p[i] - sf.pos[i]), t = dotV(q, sf.ax), rr = Math.hypot(q[0] - t * sf.ax[0], q[1] - t * sf.ax[1], q[2] - t * sf.ax[2]);
      return sf.segs.some(g => t >= g.x0 - 4 && t <= g.x1 + 4 && rr <= (g.gear ? (g.gear.da || g.gear.dae || 2 * g.r) / 2 : g.r) + 4); });
  // уровень масла: нижние точки колёс + погружение ~10 мм (окно маслоуказателя ⌀32 перекрывает нижний и верхний уровни)
  const oilLevel = (A, up) => { const b = A.wheels.map(w => { const c = Math.abs(dotV(w.ax, up)), r = (w.g.daM || w.g.da || w.g.dae || 100) / 2; return dotV(w.pos, up) - r * Math.sqrt(Math.max(0, 1 - c * c)) - (w.g.b || 20) / 2 * c; });
    // червяк и шестерни на валах (червяк внизу — масло по виток червяка)
    A.shafts.forEach(sf => sf.segs.forEach(g => { if (!g.gear || g.gear.kind === 'bevel') return; const c = Math.abs(dotV(sf.ax, up)), r = (g.gear.da || 2 * g.r) / 2, mid = (g.x0 + g.x1) / 2; b.push(dotV(sf.pos, up) + mid * dotV(sf.ax, up) - r * Math.sqrt(Math.max(0, 1 - c * c)) - (g.x1 - g.x0) / 2 * c); }));
    return b.length ? Math.min(...b) + 10 : null; };

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
    // ручка-отдушина (Чернавский, рис. 10.20): ввёрнута в центр крышки люка, канал ⌀4 соединяет полость с атмосферой
    const cu = (r.x1 + r.x2) / 2, cvv = (r.y1 + r.y2) / 2, cc0 = o.can(cu, cvv), cic = rr => [{ c: [r2(cc0[0]), r2(cc0[1]), r2(rr)] }], T0 = o.top + t;
    const ops = [sl('пластина крышки люка', o.top, o.top + t, [rl(R0)]), sl('отверстия под винты', o.top - 1, o.top + t + 1, ci(3.3), true), sl('резьбовое отверстие под ручку-отдушину', o.top - 1, o.top + t + 1, cic(5), true)];
    const vops = [sl('резьбовой хвостовик М10', o.top - 3, T0, cic(4.8)), sl('бурт ⌀16', T0, T0 + 10, cic(8)), sl('шейка ⌀10', T0 + 10, T0 + 22, cic(5)), sl('головка ⌀25', T0 + 22, T0 + 35, cic(12.5)),
      sl('канал ⌀4', o.top - 4, T0 + 18, cic(2), true)];
    const vent = { id: 'ruchka_otdushina', name: 'Ручка-отдушина', kind: 'ops', geom: { ops: vops }, file: 'ruchka_otdushina.m3d', material: 'Ст3 ГОСТ 380-2005', density: 7.85 };
    const part = { id: 'kryshka_lyuka', name: 'Крышка смотрового люка', kind: 'ops', geom: { ops }, file: 'kryshka_lyuka.m3d', material: 'Ст3 ГОСТ 380-2005', density: 7.85 };
    const screw = { id: `screw_M${d}x${L}`, name: `Винт М${d}×${L} ГОСТ 7808-70`, kind: 'bolt', geom: { d, L, s: sk, k: kk }, file: `screw_M${d}x${L}.m3d`, material: 'Сталь 35 ГОСТ 1050-2013', std: true };
    const down = o.nDir.map(c => -c);
    const items = [{ file: part.file, pos: [0, 0, 0], axes: [1, 0, 0, 0, 1, 0] }, { file: vent.file, pos: [0, 0, 0], axes: [1, 0, 0, 0, 1, 0] }].concat(cr.map(([u, v]) => ({ file: screw.file, pos: o.W(u, v, o.top + t).map(r2), axes: axesFor(down) })));
    const holeOp = sl('резьбовые отверстия под винты люка', o.top - (L - t) - 3, o.top + 0.5, ci(0.42 * d), true);
    return { parts: [part, vent, screw], items, holeOp, d, L, n: 4, vent: { at: o.W(cu, cvv, T0).map(r2), up: o.nDir.slice(), H: 35, D: 25, box: [R0.x1, R0.x2].flatMap(u => [R0.y1, R0.y2].flatMap(v => [o.top, o.top + t].map(n => o.W(u, v, n).map(r2)))), scr: cr.map(([u, v]) => o.W(u, v, o.top + t).map(r2)) } };
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
    // люк может быть смещён по Z (перед/за приливом вертикального вала), если посередине места нет
    const upB = vb.filter(b => b.face > b.wallIn);
    const rectCirc = (x1, z1, x2, z2, cx, cz) => Math.hypot(Math.max(x1 - cx, 0, cx - x2), Math.max(z1 - cz, 0, cz - z2));
    S.cavs.forEach((cT, j) => {
      const yT = cT.y2 + del;
      if (yT < ys + tf + 6) return;
      for (let hx = Math.min(60, (cT.x2 - cT.x1) / 2 - 20); hx >= 20; hx -= 5) for (let hz = Math.min(60, cavZ[j] - 20); hz >= 15; hz -= 5) {
        const zcs = [0]; for (let zc = 4; zc + hz <= cavZ[j] - 14; zc += 2) zcs.push(zc, -zc);
        for (let x = cT.x1 + hx + 12; x <= cT.x2 - hx - 12; x += 4) for (const zc of zcs) {
          const x1 = x - hx, x2 = x + hx, z1 = zc - hz, z2 = zc + hz;
          if (upB.some(b => rectCirc(x1 - 12, z1 - 12, x2 + 12, z2 + 12, b.ax, 0) < b.bossR + 3)) continue;
          // над этим местом не должно быть более высокой части корпуса
          const covered = S.cavs.some((c2, i2) => i2 !== j && c2.y2 + del > yT && x2 > c2.x1 - del && x1 < c2.x2 + del);
          if (covered) continue;
          const sc = hx * hz - Math.abs(zc) * 0.01; if (!hatch || sc > hatch.s) hatch = { x1, x2, z1, z2, y: yT, s: sc };
        }
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
        if (plugAt.pad) plugOps.push(plugPad(plugAt)); plugOps.push(plugOp(plugAt, dp));
        const fpg = HW.stdPart(`probka_M${dp}`, `Пробка М${dp}×1,5`, 'bolt', { d: dp, L: 14, s: sHex, k: kHex });
        HW.extra.push({ file: fpg, pos: plugAt.face.map(r2), axes: axesFor(plugAt.d.map(x => -x)) });
        plug = dp; plugAt.dp = dp;
      }
    }
    // фонарный маслоуказатель — на передней/задней стенке основания на уровне масла
    let lan = null;
    {
      const solidB = ops.filter(o => !/отверстия под/.test(o.n) && !(o.cut && /срез/.test(o.n)));
      const lvl = oilLevel(A, [0, 1, 0]), y0 = lvl === null ? yBot + del + 30 : lvl, cands = [];
      for (const dy of [0, 4, -4, 8, -8, 12, -12]) {
        const y = y0 + dy; if (y + LAN.D / 2 + 4 > ys - tf) continue;
        S.cavs.forEach((cv, j) => {
          if (y - LAN.D / 2 < cv.y1 || y + LAN.D / 2 > cv.y2 + del) return;
          // торцевые стенки за плоскостью главного разреза (z < 0) — маслоуказатель виден на сборочном чертеже
          [-0.5, -0.35, -0.65, -0.2, -0.8].forEach(f => { const z = f * cavZ[j]; cands.push({ c: [cv.x1 + 2, y, z], d: [-1, 0, 0] }, { c: [cv.x2 - 2, y, z], d: [1, 0, 0] }); });

        });
      }
      const avoid = HW.covList.map(cv => ({ p: cv.pos, r: cv.g.Df / 2 })).concat(plugAt ? [{ p: plugAt.face, r: 15 }] : []);
      const L = findLantern(q => q[1] < ys && inOpsW(solidB, q), cands, [0, 1, 0], avoid);
      if (L) { lan = lanternBuild(L); lan.parts.forEach(p => { if (!HW.parts.some(q => q.id === p.id)) HW.parts.push(p); }); lan.items.forEach(it => HW.extra.push(it)); }
    }
    const baseOps = ops.concat(sc.holeOps, plugOps, lan ? [lan.pad].concat(lan.cuts) : [], tubeCuts, [sXZ('срез по разъёму', ys, yTop + 300, [big], true)]);
    const coverOps = ops.filter(o => !/лапах|лапы/.test(o.n)).concat(sc.holeOps, [sXZ('срез по разъёму', yFeet - 300, ys, [big], true)]);
    let lid = null;
    if (hatch) {
      coverOps.push(sXZ('бобышка смотрового люка', hatch.y - del, hatch.y + 5, [rectXZ(hatch.x1 - 12, hatch.z1 - 12, hatch.x2 + 12, hatch.z2 + 12)]), sXZ('смотровой люк', hatch.y - del - 2, hatch.y + 7, [rectXZ(hatch.x1, hatch.z1, hatch.x2, hatch.z2)], true));
      lid = hatchLid({ base: 'XOZ', can: (u, v) => [u, v], nw: n => n, W: (u, v, n) => [u, n, v], nDir: [0, 1, 0], rect: { x1: hatch.x1, y1: hatch.z1, x2: hatch.x2, y2: hatch.z2 }, top: hatch.y + 5 });
      coverOps.push(lid.holeOp); lid.parts.forEach(p => { if (!HW.parts.some(q => q.id === p.id)) HW.parts.push(p); }); lid.items.forEach(it => HW.extra.push(it));
    }
    let dip = null;
    if (!lan) {
      const sB = baseOps.filter(o => !/отверстия под/.test(o.n)), sC = coverOps.filter(o => !/отверстия под|смотровой люк/.test(o.n));
      const solid = q => inOpsW(sB, q) || inOpsW(sC, q);
      const lvl = oilLevel(A, [0, 1, 0]), tops = [];
      const fr = [0.5, 0.35, 0.65, 0.2, 0.8, 0.1, 0.9];
      S.cavs.forEach((cv, j) => fr.forEach(fu => fr.forEach(fv => tops.push([cv.x1 + (cv.x2 - cv.x1) * fu, yTop + 60, (2 * fv - 1) * cavZ[j]]))));
      tops.sort((a, b) => (a[2] > 0) - (b[2] > 0) || Math.abs(a[2]) - Math.abs(b[2]));   // за плоскостью разреза (z ≤ 0) — виден в разрезе
      const avoid = HW.covList.map(cv => ({ p: cv.pos, r: cv.g.Df / 2 })).concat(hatch ? [{ p: [(hatch.x1 + hatch.x2) / 2, hatch.y, 0], r: Math.hypot(hatch.x2 - hatch.x1, hatch.z2 - hatch.z1) / 2 + 14 }] : []);
      const D = findDipstick(solid, tops, [0, 1, 0], lvl === null ? yBot + del + 30 : lvl, partHitFn(A), avoid);
      if (D) { dip = dipstickBuild(D); dip.parts.forEach(p => { if (!HW.parts.some(q => q.id === p.id)) HW.parts.push(p); }); dip.items.forEach(it => HW.extra.push(it)); coverOps.push(dip.boss, dip.hole); }
    }
    const fasteners = { b2: null, b3: fl3, pins: { d: 8, L: pinL, n: pinC.length }, screws: { d: H.dks || 8, L: sc.L, n: sc.n }, plug, plugAt, lid: lid ? { d: lid.d, L: lid.L, n: lid.n } : null, lantern: lan ? lan.fast : null, lanternAt: lan ? lan.at : (dip ? dip.at : null), vent: lid ? lid.vent : null };
    const feet = { up: [0, 1, 0], bottom: yFeet, d: d1, holes: feetH.map(([x, z]) => [x, yFeet, z]) };
    const geo = { S, ys, cavZ, Wz, del, tf, K, K1, pF, xW1, xW2, yBot, yFeet, yTop, flR, zW, zB, holes, pinC, feetH, hatch, dh, d1, d3, plugAt, lanternAt: lan ? lan.at : (dip ? dip.at : null) };
    return { baseOps, coverOps, parts: HW.parts, extra: HW.extra, fasteners, feet, geo, vertical: true, lvl: { us: ys, zFoot: yBot + pF, zBot: yFeet } };
  }

  /* ---------------------------------------------------------------- 2D-изображения корпуса по модели
     растр (клетка h мм) → граничные контуры → упрощение (Дуглас — Пекер). Координаты листа: s = p·U, t = p·V. */
  function opsBox(ops) {
    const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    ops.filter(o => !o.cut).forEach(o => { const n = NORM[o.base], c = CAN[o.base];
      lo[n] = Math.min(lo[n], o.a); hi[n] = Math.max(hi[n], o.b);
      o.loops.forEach(l => { const pts = l.c ? [[l.c[0] - l.c[2], l.c[1] - l.c[2]], [l.c[0] + l.c[2], l.c[1] + l.c[2]]] : l.p; pts.forEach(q => { lo[c[0]] = Math.min(lo[c[0]], q[0]); hi[c[0]] = Math.max(hi[c[0]], q[0]); lo[c[1]] = Math.min(lo[c[1]], q[1]); hi[c[1]] = Math.max(hi[c[1]], q[1]); }); }); });
    return { lo, hi };
  }
  function traceGrid(G, nx, ny, s0, t0, h) {
    const F = (i, j) => i >= 0 && j >= 0 && i < nx && j < ny && G[j * nx + i] === 1;
    const next = new Map(), key = (i, j) => i * 100003 + j;
    const put = (a, b) => { const kk = key(a[0], a[1]); const arr = next.get(kk); if (arr) arr.push(b); else next.set(kk, [b]); };
    for (let j = 0; j <= ny; j++) for (let i = 0; i < nx; i++) { const a = F(i, j), b = F(i, j - 1); if (a && !b) put([i, j], [i + 1, j]); else if (!a && b) put([i + 1, j], [i, j]); }
    for (let i = 0; i <= nx; i++) for (let j = 0; j < ny; j++) { const a = F(i - 1, j), b = F(i, j); if (a && !b) put([i, j], [i, j + 1]); else if (!a && b) put([i, j + 1], [i, j]); }
    const loops = [];
    for (const [k0, arr0] of next) {
      while (arr0.length) {
        let cur = arr0.shift(); const st = k0, pts = [[Math.floor(k0 / 100003), k0 % 100003]];
        for (let g = 0; g < 1e6; g++) { const kk = key(cur[0], cur[1]); if (kk === st) break; pts.push(cur); const arr = next.get(kk); if (!arr || !arr.length) break; cur = arr.shift(); }
        if (pts.length >= 4) loops.push(pts.map(([i, j]) => [s0 + i * h, t0 + j * h]));
      }
    }
    return loops;
  }
  function simplify(loop, tol) {
    const dp = (P) => { if (P.length < 3) return P; const a = P[0], b = P[P.length - 1]; let im = 0, dm = 0; const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1e-9;
      for (let i = 1; i < P.length - 1; i++) { const d = Math.abs((b[0] - a[0]) * (a[1] - P[i][1]) - (a[0] - P[i][0]) * (b[1] - a[1])) / L; if (d > dm) { dm = d; im = i; } }
      if (dm <= tol) return [a, b]; return dp(P.slice(0, im + 1)).slice(0, -1).concat(dp(P.slice(im))); };
    // разрезать петлю в двух самых удалённых точках
    let j = 0, dmax = 0; for (let i = 1; i < loop.length; i++) { const d = Math.hypot(loop[i][0] - loop[0][0], loop[i][1] - loop[0][1]); if (d > dmax) { dmax = d; j = i; } }
    const A = dp(loop.slice(0, j + 1)), B = dp(loop.slice(j).concat([loop[0]]));
    return A.slice(0, -1).concat(B.slice(0, -1));
  }
  // сечение тела ops плоскостью p·N = cut
  function section2d(ops, U, V, N, cut, h) {
    h = h || 0.5;
    const bb = opsBox(ops), cr = [bb.lo, bb.hi];
    const corners = []; for (const a of cr) for (const b of cr) for (const c of cr) corners.push([a[0], b[1], c[2]]);
    const ss = corners.map(p => dot(p, U)), ts = corners.map(p => dot(p, V));
    const s0 = Math.floor(Math.min(...ss)) - 2, s1 = Math.ceil(Math.max(...ss)) + 2, t0 = Math.floor(Math.min(...ts)) - 2, t1 = Math.ceil(Math.max(...ts)) + 2;
    h = Math.max(h, Math.sqrt((s1 - s0) * (t1 - t0) / 400000));
    const nx = Math.ceil((s1 - s0) / h), ny = Math.ceil((t1 - t0) / h), G = new Uint8Array(nx * ny);
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const s = s0 + (i + 0.5) * h, t = t0 + (j + 0.5) * h; const p = [0, 1, 2].map(q => s * U[q] + t * V[q] + cut * N[q]); if (inOpsW(ops, p)) G[j * nx + i] = 1; }
    return traceGrid(G, nx, ny, s0, t0, h).map(l => simplify(l, h * 0.75));
  }
  // контур вида (проекция вдоль N) — объединение проекций выдавливаний
  function silhouette2d(ops, U, V, N, h) {
    h = h || 0.5;
    const pos = ops.filter(o => !o.cut);
    const rects = [], circs = [], polys = [];
    pos.forEach(o => {
      const n = NORM[o.base], c = CAN[o.base];
      const e = i => { const v = [0, 0, 0]; v[i] = 1; return v; };
      const En = e(n), E0 = e(c[0]), E1 = e(c[1]);
      if (Math.abs(dot(En, N)) > 0.9) {    // смотрим вдоль выдавливания — контур эскиза
        o.loops.forEach(l => { if (l.c) circs.push([dot(E0, U) * l.c[0] + dot(E1, U) * l.c[1], dot(E0, V) * l.c[0] + dot(E1, V) * l.c[1], l.c[2]]); else polys.push(l.p.map(q => [dot(E0, U) * q[0] + dot(E1, U) * q[1], dot(E0, V) * q[0] + dot(E1, V) * q[1]])); });
      } else {                               // сбоку — прямоугольник: ход выдавливания × проекция эскиза на вторую ось
        const Wv = Math.abs(dot(E0, N)) > 0.9 ? E1 : E0, wi = Wv === E1 ? 1 : 0;
        o.loops.forEach(l => { const vals = l.c ? [l.c[wi] - l.c[2], l.c[wi] + l.c[2]] : l.p.map(q => q[wi]); const w1 = Math.min(...vals), w2 = Math.max(...vals);
          const pa = [0, 0, 0], pb = [0, 0, 0]; pa[n] = o.a; pb[n] = o.b; pa[c[wi]] = w1; pb[c[wi]] = w2;
          const xs = [dot(pa, U), dot(pb, U)], ys = [dot(pa, V), dot(pb, V)]; rects.push([Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys), o.n]); });
      }
    });
    const all = rects.map(r => [r[0], r[1], r[2], r[3]]).concat(circs.map(c => [c[0] - c[2], c[1] - c[2], c[0] + c[2], c[1] + c[2]]), polys.map(p => [Math.min(...p.map(q => q[0])), Math.min(...p.map(q => q[1])), Math.max(...p.map(q => q[0])), Math.max(...p.map(q => q[1]))]));
    const s0 = Math.floor(Math.min(...all.map(r => r[0]))) - 2, t0 = Math.floor(Math.min(...all.map(r => r[1]))) - 2, s1 = Math.ceil(Math.max(...all.map(r => r[2]))) + 2, t1 = Math.ceil(Math.max(...all.map(r => r[3]))) + 2;
    const nx = Math.ceil((s1 - s0) / h), ny = Math.ceil((t1 - t0) / h), G = new Uint8Array(nx * ny);
    const fill = (x1, y1, x2, y2, f) => { const i1 = Math.max(0, Math.floor((x1 - s0) / h)), i2 = Math.min(nx - 1, Math.ceil((x2 - s0) / h)), j1 = Math.max(0, Math.floor((y1 - t0) / h)), j2 = Math.min(ny - 1, Math.ceil((y2 - t0) / h));
      for (let j = j1; j <= j2; j++) for (let i = i1; i <= i2; i++) { const s = s0 + (i + 0.5) * h, t = t0 + (j + 0.5) * h; if (f(s, t)) G[j * nx + i] = 1; } };
    rects.forEach(r => fill(r[0], r[1], r[2], r[3], (s, t) => s >= r[0] && s <= r[2] && t >= r[1] && t <= r[3]));
    circs.forEach(c => fill(c[0] - c[2], c[1] - c[2], c[0] + c[2], c[1] + c[2], (s, t) => (s - c[0]) ** 2 + (t - c[1]) ** 2 <= c[2] ** 2));
    polys.forEach(P => { const b = [Math.min(...P.map(q => q[0])), Math.min(...P.map(q => q[1])), Math.max(...P.map(q => q[0])), Math.max(...P.map(q => q[1]))];
      fill(b[0], b[1], b[2], b[3], (u, v) => { let kk = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const a = P[i], bq = P[j]; if ((a[1] > v) !== (bq[1] > v) && u < (bq[0] - a[0]) * (v - a[1]) / (bq[1] - a[1]) + a[0]) kk = !kk; } return kk; }); });
    return { loops: traceGrid(G, nx, ny, s0, t0, h).map(l => simplify(l, h * 0.75)), rects };
  }

  /* вид корпуса снаружи (проекция вдоль N, наблюдатель со стороны +N): карта глубины по выдавливаниям (вырезы
     внутри не видны и не учитываются) → видимые рёбра там, где глубина скачет. Возвращает {lines, loops, rects}. */
  function depthView(ops, U, V, h) {
    h = h || 0.5;
    const N = [U[1] * V[2] - U[2] * V[1], U[2] * V[0] - U[0] * V[2], U[0] * V[1] - U[1] * V[0]];
    const pos = ops.filter(o => !o.cut);
    const shapes = [];
    pos.forEach(o => {
      const n = NORM[o.base], c = CAN[o.base], e = i => { const v = [0, 0, 0]; v[i] = 1; return v; };
      const En = e(n), E = [e(c[0]), e(c[1])];
      const sg = dot(En, N);
      if (Math.abs(sg) > 0.9) {
        const dep = sg > 0 ? o.b : -o.a;
        o.loops.forEach(l => {
          const toST = (q0, q1) => [dot(E[0], U) * q0 + dot(E[1], U) * q1, dot(E[0], V) * q0 + dot(E[1], V) * q1];
          if (l.c) { const [cs, ct] = toST(l.c[0], l.c[1]), r = l.c[2]; shapes.push({ b: [cs - r, ct - r, cs + r, ct + r], f: (s, t) => (s - cs) ** 2 + (t - ct) ** 2 <= r * r ? dep : null }); }
          else { const P = l.p.map(q => toST(q[0], q[1])); const xs = P.map(q => q[0]), ys = P.map(q => q[1]);
            shapes.push({ b: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)], f: (u, v) => { let kk = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const a = P[i], bq = P[j]; if ((a[1] > v) !== (bq[1] > v) && u < (bq[0] - a[0]) * (v - a[1]) / (bq[1] - a[1]) + a[0]) kk = !kk; } return kk ? dep : null; } }); }
        });
      } else {
        // эскиз содержит направление N: одна ось эскиза (iN) — вдоль N, другая (iW) — в плоскости вида
        const iN = Math.abs(dot(E[0], N)) > 0.9 ? 0 : 1, iW = 1 - iN, sN = dot(E[iN], N), Ew = E[iW];
        const axS = [dot(En, U), dot(En, V)], wS = [dot(Ew, U), dot(Ew, V)];
        o.loops.forEach(l => {
          let wr, depAt;
          if (l.c) { const cw = l.c[iW], cn = l.c[iN] * sN, r = l.c[2]; wr = [cw - r, cw + r]; depAt = w => { const d = r * r - (w - cw) ** 2; return d >= 0 ? cn + Math.sqrt(d) : null; }; }
          else { const P = l.p; wr = [Math.min(...P.map(q => q[iW])), Math.max(...P.map(q => q[iW]))];
            depAt = w => { let m = null; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const a = P[i], b = P[j]; if ((a[iW] - w) * (b[iW] - w) <= 0 && a[iW] !== b[iW]) { const tt = (w - a[iW]) / (b[iW] - a[iW]), y = (a[iN] + tt * (b[iN] - a[iN])) * sN; if (m === null || y > m) m = y; } else if (a[iW] === w && b[iW] === w) { const y = Math.max(a[iN] * sN, b[iN] * sN); if (m === null || y > m) m = y; } } return m; }; }
          // лист: s = a·axS[0] + w·wS[0], t = a·axS[1] + w·wS[1]
          const cs = [o.a, o.b].flatMap(a => wr.map(w => [a * axS[0] + w * wS[0], a * axS[1] + w * wS[1]]));
          const along = Math.abs(axS[0]) > 0.5 ? 0 : 1;
          shapes.push({ b: [Math.min(...cs.map(q => q[0])), Math.min(...cs.map(q => q[1])), Math.max(...cs.map(q => q[0])), Math.max(...cs.map(q => q[1]))],
            f: (s, t) => { const st = [s, t], a = st[along] * axS[along], w = st[1 - along] * wS[1 - along]; if (a < o.a || a > o.b || w < wr[0] || w > wr[1]) return null; return depAt(w); } });
        });
      }
    });
    const s0 = Math.floor(Math.min(...shapes.map(q => q.b[0]))) - 2, t0 = Math.floor(Math.min(...shapes.map(q => q.b[1]))) - 2, s1 = Math.ceil(Math.max(...shapes.map(q => q.b[2]))) + 2, t1 = Math.ceil(Math.max(...shapes.map(q => q.b[3]))) + 2;
    h = Math.max(h, Math.sqrt((s1 - s0) * (t1 - t0) / 450000));
    const nx = Math.ceil((s1 - s0) / h), ny = Math.ceil((t1 - t0) / h), D = new Float32Array(nx * ny).fill(-1e9);
    shapes.forEach(q => { const i1 = Math.max(0, Math.floor((q.b[0] - s0) / h) - 1), i2 = Math.min(nx - 1, Math.ceil((q.b[2] - s0) / h) + 1), j1 = Math.max(0, Math.floor((q.b[1] - t0) / h) - 1), j2 = Math.min(ny - 1, Math.ceil((q.b[3] - t0) / h) + 1);
      for (let j = j1; j <= j2; j++) for (let i = i1; i <= i2; i++) { const v = q.f(s0 + (i + 0.5) * h, t0 + (j + 0.5) * h); if (v !== null && v > D[j * nx + i]) D[j * nx + i] = v; } });
    const thr = 0.8, at = (i, j) => (i < 0 || j < 0 || i >= nx || j >= ny) ? -1e9 : D[j * nx + i];
    const jump = (a, b) => (a > -1e8) !== (b > -1e8) || (a > -1e8 && Math.abs(a - b) > thr);
    // рёбра клеток со скачком глубины → цепочки
    const adj = new Map(), key = (i, j) => i * 100003 + j, link = (p, q) => { [[p, q], [q, p]].forEach(([a, b]) => { const kk = key(a[0], a[1]); const arr = adj.get(kk); if (arr) arr.push(b); else adj.set(kk, [b]); }); };
    // скачок, а не крутой участок гладкой поверхности (цилиндр у касательной): разность больше соседних в 2,5 раза
    // q — 6 клеток подряд поперёк ребра (ребро между q[2] и q[3]); излом поверхности (пересечение цилиндра с плоскостью) —
    // скачок наклона, заметно больший изменения наклона по соседству
    const ok = v => v > -1e8;
    const sharp = q => {
      const [p1, p0, a, b, p3, p4] = q;
      if (ok(a) !== ok(b)) return true;
      if (!ok(a)) return false;
      const d = Math.abs(a - b), s1 = ok(p0) ? Math.abs(a - p0) : 0, s2 = ok(p3) ? Math.abs(p3 - b) : 0;
      if (d > thr && d > 2.5 * Math.max(s1, s2)) return true;
      if (!(ok(p0) && ok(p3) && ok(p1) && ok(p4))) return false;
      const sl0 = p0 - p1, sl1 = a - p0, sl2 = b - a, sl3 = p3 - b, sl4 = p4 - p3;
      const c1 = Math.abs(sl2 - sl1), c2 = Math.abs(sl3 - sl2), ch = Math.max(c1, c2);
      return ch > 0.3 && ch > 3 * Math.max(Math.abs(sl1 - sl0), Math.abs(sl4 - sl3)) && Math.abs(a - b) <= thr * 4;
    };
    for (let j = 0; j <= ny; j++) for (let i = 0; i < nx; i++) if (sharp([at(i, j + 2), at(i, j + 1), at(i, j), at(i, j - 1), at(i, j - 2), at(i, j - 3)])) link([i, j], [i + 1, j]);
    for (let i = 0; i <= nx; i++) for (let j = 0; j < ny; j++) if (sharp([at(i - 3, j), at(i - 2, j), at(i - 1, j), at(i, j), at(i + 1, j), at(i + 2, j)])) link([i, j], [i, j + 1]);
    const used = new Set(), ek = (a, b) => { const k1 = key(a[0], a[1]), k2 = key(b[0], b[1]); return k1 < k2 ? k1 + ':' + k2 : k2 + ':' + k1; };
    const lines = [];
    const walk = (st) => { const pts = [st]; let cur = st, prev = null;
      for (;;) { const nb = (adj.get(key(cur[0], cur[1])) || []).filter(q => !used.has(ek(cur, q))); if (!nb.length) break;
        // на развилке — продолжать прямо
        let nx_ = nb[0]; if (prev && nb.length > 1) { const d0 = [cur[0] - prev[0], cur[1] - prev[1]]; nx_ = nb.find(q => q[0] - cur[0] === d0[0] && q[1] - cur[1] === d0[1]) || nb[0]; }
        used.add(ek(cur, nx_)); pts.push(nx_); prev = cur; cur = nx_; if (cur[0] === st[0] && cur[1] === st[1]) break; }
      return pts; };
    // сначала концы цепочек (нечётные вершины), затем замкнутые
    for (const [kk, arr] of adj) if (arr.length % 2 === 1) { const st = [Math.floor(kk / 100003), kk % 100003]; while ((adj.get(kk) || []).some(q => !used.has(ek(st, q)))) { const p = walk(st); if (p.length > 1) lines.push(p); } }
    for (const [kk] of adj) { const st = [Math.floor(kk / 100003), kk % 100003]; while ((adj.get(kk) || []).some(q => !used.has(ek(st, q)))) { const p = walk(st); if (p.length > 1) lines.push(p); } }
    const dpOpen = (P, tol) => { if (P.length < 3) return P; const a = P[0], b = P[P.length - 1]; let im = 0, dm = 0; const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      for (let i = 1; i < P.length - 1; i++) { const d = L < 1e-9 ? Math.hypot(P[i][0] - a[0], P[i][1] - a[1]) : Math.abs((b[0] - a[0]) * (a[1] - P[i][1]) - (a[0] - P[i][0]) * (b[1] - a[1])) / L; if (d > dm) { dm = d; im = i; } }
      if (dm <= tol) return [a, b]; return dpOpen(P.slice(0, im + 1), tol).slice(0, -1).concat(dpOpen(P.slice(im), tol)); };
    const out = lines.map(p => dpOpen(p.map(([i, j]) => [s0 + i * h, t0 + j * h]), h * 0.75)).filter(p => p.length >= 2 && !(p.length === 2 && Math.hypot(p[1][0] - p[0][0], p[1][1] - p[0][1]) < 0.6));
    return { lines: out, box: { x1: s0, y1: t0, x2: s1, y2: t1 }, depth: (s, t) => at(Math.floor((s - s0) / h), Math.floor((t - t0) / h)) };
  }

  /* точный вид детали (ортогональная проекция вдоль −N, наблюдатель со стороны +N) с учётом вырезов:
     на каждом луче — точная операция над отрезками (выдавливание = отрезок, вырез = вычитание), видимая глубина —
     верхний конец. Рёбра — скачки и изломы глубины, граница детали. */
  function rayView(ops, U, V, h, o) {
    h = h || 0.5; o = o || {};
    const N = [U[1] * V[2] - U[2] * V[1], U[2] * V[0] - U[0] * V[2], U[0] * V[1] - U[1] * V[0]];
    const e = i => { const v = [0, 0, 0]; v[i] = 1; return v; };
    // для каждой операции на строке t: где по s она действует и какой отрезок глубины даёт
    const crossS = (Q, t) => { const xs = []; for (let i = 0, j = Q.length - 1; i < Q.length; j = i++) { const a = Q[i], b = Q[j]; if ((a[1] > t) !== (b[1] > t)) xs.push(a[0] + (t - a[1]) / (b[1] - a[1]) * (b[0] - a[0])); } return xs.sort((x, y) => x - y); };
    const P = ops.map(op => {
      const n = NORM[op.base], c = CAN[op.base], En = e(n), E = [e(c[0]), e(c[1])], sg = dot(En, N);
      if (Math.abs(sg) > 0.9) {
        const lo = Math.min(sg * op.a, sg * op.b), hi = Math.max(sg * op.a, sg * op.b), dep = [lo, hi];
        const toST = (q0, q1) => [dot(E[0], U) * q0 + dot(E[1], U) * q1, dot(E[0], V) * q0 + dot(E[1], V) * q1];
        const L = op.loops.map(l => l.c ? { c: toST(l.c[0], l.c[1]), r: l.c[2] } : { p: l.p.map(q => toST(q[0], q[1])) });
        const pts = L.flatMap(l => l.c ? [[l.c[0] - l.r, l.c[1] - l.r], [l.c[0] + l.r, l.c[1] + l.r]] : l.p);
        return { cut: op.cut, b: [Math.min(...pts.map(q => q[0])), Math.min(...pts.map(q => q[1])), Math.max(...pts.map(q => q[0])), Math.max(...pts.map(q => q[1]))],
          row: t => { const sIv = []; L.forEach(l => { if (l.c) { const d = l.r * l.r - (t - l.c[1]) ** 2; if (d >= 0) { const r = Math.sqrt(d); sIv.push([l.c[0] - r, l.c[0] + r]); } } else { const xs = crossS(l.p, t); for (let i = 0; i + 1 < xs.length; i += 2) sIv.push([xs[i], xs[i + 1]]); } }); return sIv.length ? { sIv, dep: () => [dep] } : null; } };
      }
      const iN = Math.abs(dot(E[0], N)) > 0.9 ? 0 : 1, iW = 1 - iN, sN = dot(E[iN], N), Ew = E[iW];
      const axS = [dot(En, U), dot(En, V)], wS = [dot(Ew, U), dot(Ew, V)], along = Math.abs(axS[0]) > 0.5 ? 0 : 1;
      const cs = [];
      op.loops.forEach(l => { const ws = l.c ? [l.c[iW] - l.c[2], l.c[iW] + l.c[2]] : l.p.map(q => q[iW]); [op.a, op.b].forEach(a => ws.forEach(w => cs.push([a * axS[0] + w * wS[0], a * axS[1] + w * wS[1]]))); });
      const depW = w => { const out = [];
        op.loops.forEach(l => {
          if (l.c) { const d = l.c[2] ** 2 - (w - l.c[iW]) ** 2; if (d >= 0) { const r = Math.sqrt(d), y1 = (l.c[iN] - r) * sN, y2 = (l.c[iN] + r) * sN; out.push([Math.min(y1, y2), Math.max(y1, y2)]); } }
          else { const Q = l.p, xs = []; for (let i = 0, j = Q.length - 1; i < Q.length; j = i++) { const A = Q[i], B = Q[j]; if ((A[iW] > w) !== (B[iW] > w)) xs.push((A[iN] + (w - A[iW]) / (B[iW] - A[iW]) * (B[iN] - A[iN])) * sN); } xs.sort((x, y) => x - y); for (let i = 0; i + 1 < xs.length; i += 2) out.push([xs[i], xs[i + 1]]); }
        });
        return out.length ? out.sort((x, y) => x[0] - y[0]) : null; };
      const bb = [Math.min(...cs.map(q => q[0])), Math.min(...cs.map(q => q[1])), Math.max(...cs.map(q => q[0])), Math.max(...cs.map(q => q[1]))];
      return { cut: op.cut, b: bb,
        row: t => {
          if (along === 0) {   // s — вдоль выдавливания, w — по строке (постоянна)
            const w = t * wS[1], d = depW(w); if (!d) return null;
            const s1 = op.a * axS[0], s2 = op.b * axS[0]; return { sIv: [[Math.min(s1, s2), Math.max(s1, s2)]], dep: () => d };
          }
          const a = t * axS[1]; if (a < op.a || a > op.b) return null;
          return { sIv: [[bb[0], bb[2]]], dep: s => depW(s * wS[0]) };
        } };
    });
    const pos = P.filter(q => !q.cut);
    const s0 = Math.floor(Math.min(...pos.map(q => q.b[0]))) - 2, t0 = Math.floor(Math.min(...pos.map(q => q.b[1]))) - 2, s1 = Math.ceil(Math.max(...pos.map(q => q.b[2]))) + 2, t1 = Math.ceil(Math.max(...pos.map(q => q.b[3]))) + 2;
    h = Math.max(h, Math.sqrt((s1 - s0) * (t1 - t0) / 450000));       // не более ~450 тыс. точек на вид
    const nx = Math.ceil((s1 - s0) / h), ny = Math.ceil((t1 - t0) / h), D = new Float32Array(nx * ny).fill(-1e9), D2 = o.hidden ? new Float32Array(nx * ny).fill(-1e9) : null;
    const union = (A, B) => { const all = A.concat(B).sort((x, y) => x[0] - y[0]), r = []; all.forEach(q => { const l = r[r.length - 1]; if (l && q[0] <= l[1] + 1e-6) l[1] = Math.max(l[1], q[1]); else r.push([q[0], q[1]]); }); return r; };
    const sub = (A, B) => { let r = A; B.forEach(([c1, c2]) => { r = r.flatMap(([a1, a2]) => (c2 <= a1 || c1 >= a2) ? [[a1, a2]] : [[a1, Math.min(a2, c1)], [Math.max(a1, c2), a2]].filter(q => q[1] - q[0] > 1e-6)); }); return r; };
    for (let j = 0; j < ny; j++) {
      const t = t0 + (j + 0.5) * h;
      const row = []; P.forEach(q => { if (t < q.b[1] || t > q.b[3]) return; const r = q.row(t); if (r) row.push({ cut: q.cut, sIv: r.sIv, dep: r.dep }); });
      if (!row.some(q => !q.cut)) continue;
      for (let i = 0; i < nx; i++) {
        const s = s0 + (i + 0.5) * h;
        let I = [];
        for (const q of row) {
          if (q.cut && !I.length) continue;
          let inS = false; for (const v of q.sIv) if (s >= v[0] && s <= v[1]) { inS = true; break; }
          if (!inS) continue;
          const iv = q.dep(s); if (!iv) continue;
          I = q.cut ? sub(I, iv) : union(I, iv);
        }
        if (I.length) { D[j * nx + i] = I[I.length - 1][1]; if (D2) D2[j * nx + i] = I[0][0]; }
      }
    }
    const circles = [];
    ops.forEach(op => { const n = NORM[op.base], c = CAN[op.base]; if (Math.abs(N[n]) < 0.9) return; const E0 = e(c[0]), E1 = e(c[1]); op.loops.forEach(l => { if (l.c) circles.push([dot(E0, U) * l.c[0] + dot(E1, U) * l.c[1], dot(E0, V) * l.c[0] + dot(E1, V) * l.c[1], l.c[2], !!op.cut]); }); });
    return Object.assign(edgesOf(D, nx, ny, s0, t0, h, circles), { depth: (s, t) => { const i = Math.floor((s - s0) / h), j = Math.floor((t - t0) / h); return (i < 0 || j < 0 || i >= nx || j >= ny) ? -1e9 : D[j * nx + i]; } });
  }
  // рёбра по карте глубины (скачки, изломы, граница) — общая часть depthView / rayView
  function edgesOf(D, nx, ny, s0, t0, h, circles) {
    const thr = 0.8, at = (i, j) => (i < 0 || j < 0 || i >= nx || j >= ny) ? -1e9 : D[j * nx + i];
    const ok = v => v > -1e8;
    const sharp = q => {
      const [p1, p0, a, b, p3, p4] = q;
      if (ok(a) !== ok(b)) return true;
      if (!ok(a)) return false;
      const d = Math.abs(a - b), sl1 = ok(p0) ? Math.abs(a - p0) : 0, sl2 = ok(p3) ? Math.abs(p3 - b) : 0;
      if (d > thr && d > 2.5 * Math.max(sl1, sl2)) return true;
      if (!(ok(p0) && ok(p3) && ok(p1) && ok(p4))) return false;
      const g0 = p0 - p1, g1 = a - p0, g2 = b - a, g3 = p3 - b, g4 = p4 - p3;
      const ch = Math.max(Math.abs(g2 - g1), Math.abs(g3 - g2));
      return ch > 0.3 && ch > 3 * Math.max(Math.abs(g1 - g0), Math.abs(g4 - g3)) && d <= thr * 4;
    };
    const adj = new Map(), key = (i, j) => i * 100003 + j, link = (p, q) => { [[p, q], [q, p]].forEach(([a, b]) => { const kk = key(a[0], a[1]); const arr = adj.get(kk); if (arr) arr.push(b); else adj.set(kk, [b]); }); };
    for (let j = 0; j <= ny; j++) for (let i = 0; i < nx; i++) if (sharp([at(i, j + 2), at(i, j + 1), at(i, j), at(i, j - 1), at(i, j - 2), at(i, j - 3)])) link([i, j], [i + 1, j]);
    for (let i = 0; i <= nx; i++) for (let j = 0; j < ny; j++) if (sharp([at(i - 3, j), at(i - 2, j), at(i - 1, j), at(i, j), at(i + 1, j), at(i + 2, j)])) link([i, j], [i, j + 1]);
    const used = new Set(), ek = (a, b) => { const k1 = key(a[0], a[1]), k2 = key(b[0], b[1]); return k1 < k2 ? k1 + ':' + k2 : k2 + ':' + k1; };
    const lines = [];
    // метка ребра: номер окружности (отверстие, бобышка), на которой оно лежит, иначе −1 — цепочки не смешивают метки
    const lab = (a, b) => { if (!circles || !circles.length) return -1; const mx = s0 + (a[0] + b[0]) / 2 * h, my = t0 + (a[1] + b[1]) / 2 * h; for (let i = 0; i < circles.length; i++) { const c = circles[i]; if (c[2] > 1.5 && Math.abs(Math.hypot(mx - c[0], my - c[1]) - c[2]) < h * 1.6) return i; } return -1; };
    const walk = (st, first) => { const pts = [st]; let cur = st, prev = null, L = null;
      for (;;) { let nb = (adj.get(key(cur[0], cur[1])) || []).filter(q => !used.has(ek(cur, q)));
        if (L !== null) nb = nb.filter(q => lab(cur, q) === L); else if (first) nb = nb.filter(q => q[0] === first[0] && q[1] === first[1]);
        if (!nb.length) break;
        let nx_ = nb[0]; if (prev && nb.length > 1) { const d0 = [cur[0] - prev[0], cur[1] - prev[1]]; nx_ = nb.find(q => q[0] - cur[0] === d0[0] && q[1] - cur[1] === d0[1]) || nb[0]; }
        if (L === null) L = lab(cur, nx_);
        used.add(ek(cur, nx_)); pts.push(nx_); prev = cur; cur = nx_; if (cur[0] === st[0] && cur[1] === st[1]) break; }
      pts.L = L; return pts; };
    const run = (kk) => { const st = [Math.floor(kk / 100003), kk % 100003]; for (;;) { const nb = (adj.get(kk) || []).filter(q => !used.has(ek(st, q))); if (!nb.length) break; const p = walk(st, nb[0]); if (p.length > 1) lines.push(p); else break; } };
    for (const [kk, arr] of adj) if (arr.length % 2 === 1) run(kk);
    for (const [kk] of adj) run(kk);
    const dpOpen = (Pp, tol) => { if (Pp.length < 3) return Pp; const a = Pp[0], b = Pp[Pp.length - 1]; let im = 0, dm = 0; const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      for (let i = 1; i < Pp.length - 1; i++) { const d = L < 1e-9 ? Math.hypot(Pp[i][0] - a[0], Pp[i][1] - a[1]) : Math.abs((b[0] - a[0]) * (a[1] - Pp[i][1]) - (a[0] - Pp[i][0]) * (b[1] - a[1])) / L; if (d > dm) { dm = d; im = i; } }
      if (dm <= tol) return [a, b]; return dpOpen(Pp.slice(0, im + 1), tol).slice(0, -1).concat(dpOpen(Pp.slice(im), tol)); };
    // цепочки, лежащие на окружности известного отверстия/бобышки, — точными дугами
    const arcs = [], rest = [];
    lines.forEach(p => {
      const P2 = p.map(([i, j]) => [s0 + i * h, t0 + j * h]);
      const c = P2.length >= 4 && p.L !== undefined && p.L !== null && p.L >= 0 ? circles[p.L] : null;
      if (!c) { rest.push(P2); return; }
      const [cx, cy, r] = c, ang = q => Math.atan2(q[1] - cy, q[0] - cx);
      let sw = 0; for (let i = 1; i < P2.length; i++) { let d = ang(P2[i]) - ang(P2[i - 1]); if (d > Math.PI) d -= 2 * Math.PI; if (d < -Math.PI) d += 2 * Math.PI; sw += d; }
      const a0 = ang(P2[0]) * 180 / Math.PI, closed = Math.abs(Math.abs(sw) - 2 * Math.PI) < 0.2;
      if (closed) { arcs.push([cx, cy, r, 0, 360]); return; }
      const swd = sw * 180 / Math.PI;
      arcs.push(swd >= 0 ? [cx, cy, r, a0, a0 + swd] : [cx, cy, r, a0 + swd, a0]);
    });
    // то, что видно сквозь отверстие (дно, нижележащие детали), не изображается
    const inHole = P2 => (circles || []).some(([cx, cy, r, cut]) => cut && r > 1.5 && P2.every(q => Math.hypot(q[0] - cx, q[1] - cy) < r - 1.2 * h));
    const out = rest.filter(p => !inHole(p)).map(p => dpOpen(p, h * 0.75)).filter(p => p.length >= 2 && !(p.length === 2 && Math.hypot(p[1][0] - p[0][0], p[1][1] - p[0][1]) < 0.6));
    return { lines: out, arcs, box: { x1: s0, y1: t0, x2: s0 + nx * h, y2: t0 + ny * h } };
  }

  root.M3D = { housing3d, outline, section2d, silhouette2d, depthView, rayView, inOps: inOpsW };
})(typeof window !== 'undefined' ? window : globalThis);
