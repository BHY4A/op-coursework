/* drw_sketch.js — эскиз общего вида привода (после компоновки, пп. 1.9–1.10 методички).
   Строится только из чисел расчёта (R): ступени валов, межосевые расстояния, da и b колёс, подшипники,
   размеры корпуса R.H (δ, зазоры, фланцы), каталог двигателя, муфта, цепная передача.
   3D-модель и её проекции не используются. Корпус — прямоугольные объёмы:
   полость каждой ступени (колёса + зазор) + стенка δ, продлённая до наружных торцев подшипников;
   близкие грани (разница меньше допуска) выравниваются, поэтому ступени остаются только там,
   где действительно меняется размер колёс. */
(function (root) {
  'use strict';
  const C = root.DRWCORE;
  const nf = (x, d) => C.fmtNum(x, d === undefined ? 0 : d);
  const CH = { 10: [100, 46], 12: [120, 52], 14: [140, 58], 16: [160, 64], 18: [180, 70] };   // швеллеры: h, b
  const E = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];

  /* ---------------- валы: ступени с координатами вдоль оси, подшипники */
  function shaft(list, b, o, ax) {
    let x = 0;
    const S = list.map(s => { const q = Object.assign({}, s, { x0: x, x1: x + s.l, r: s.d / 2 }); x += s.l; return q; });
    const inner = S.filter(s => s.gear || /ступиц/.test(s.name));
    const gx = inner.length ? inner.reduce((a, s) => a + (s.x0 + s.x1) / 2, 0) / inner.length : x / 2;
    const W = b ? (b.T || b.B) : 15;
    const br = S.filter(s => /подшипник/.test(s.name)).map(s => { const left = (s.x0 + s.x1) / 2 < gx; const a = left ? s.x0 : s.x1 - W; return { a, b: a + W, D: b ? b.D : 2 * s.r + 30 }; });
    const sh = { S, L: x, b, o, ax, br, gx };
    // консольная шестерня: зубчатая ступень вне пролёта подшипников
    const g = S.find(s => s.gear);
    sh.cant = !!(g && br.length && (g.x1 <= Math.min(...br.map(q => q.a)) + 0.5 || g.x0 >= Math.max(...br.map(q => q.b)) - 0.5));
    return sh;
  }
  const at = (sh, s) => sh.o.map((v, i) => v + E[sh.ax][i] * s);
  const midOf = (sh, re) => { const s = sh.S.find(q => re(q)); return s ? (s.x0 + s.x1) / 2 : null; };
  const body = (sh, s0, s1, r) => { const c = at(sh, (s0 + s1) / 2); return { ax: sh.ax, c, h: Math.abs(s1 - s0) / 2, r }; };
  const bodyBox = b => { const lo = [], hi = []; for (let i = 0; i < 3; i++) { const e = i === b.ax ? b.h : b.r; lo.push(b.c[i] - e); hi.push(b.c[i] + e); } return { lo, hi }; };
  const unionBox = bs => ({ lo: [0, 1, 2].map(i => Math.min(...bs.map(b => b.lo[i]))), hi: [0, 1, 2].map(i => Math.max(...bs.map(b => b.hi[i]))) });

  /* ---------------- компоновка редуктора по заданию (мировые оси: x — к двигателю, y — поперёк, z — вверх) */
  function layout(R) {
    const sh = R.shafts, H = R.H || {};
    if (!sh || !sh.I) return null;
    const out = { shafts: [], stages: [], zp: 0, vert: false, task: R.task };
    if (R.task === 3) {
      const g = R.g;
      const I = shaft(sh.I, R.b1, [0, 0, 0], 0);
      const xw = midOf(I, s => s.gear);
      const II0 = shaft(sh.II, R.b2, [0, 0, 0], 1), xh = midOf(II0, s => /ступиц/.test(s.name));
      const II = shaft(sh.II, R.b2, [xw, -xh, g.aw], 1);
      const gs = I.S.find(s => s.gear), hub = II.S.find(s => /ступиц/.test(s.name));
      out.shafts = [I, II];
      out.stages = [{ shafts: [0, 1], bodies: [body(I, gs.x0, gs.x1, g.da1 / 2), body(II, (hub.x0 + hub.x1) / 2 - g.b2 / 2, (hub.x0 + hub.x1) / 2 + g.b2 / 2, (g.daM2 || g.da2) / 2)] }];
      out.zp = g.aw;
      out.outShaft = 1;
    } else if (R.task === 6) {
      const gB = R.gB, gT = R.gT;
      const I = shaft(sh.I, R.b1, [-R.b1.B, 0, 0], 0), II = shaft(sh.II, R.b2, [-R.b2.B, gB.aw, 0], 0), III = shaft(sh.III, R.b3, [-R.b3.B, gB.aw + gT.aw, 0], 0);
      const p1 = I.S.find(s => s.gear), h2 = II.S.find(s => /ступиц/.test(s.name)), p3 = II.S.find(s => s.gear), h4 = III.S.find(s => /ступиц/.test(s.name));
      const wheel = (S, h, g) => body(S, (h.x0 + h.x1) / 2 - g.b2 / 2, (h.x0 + h.x1) / 2 + g.b2 / 2, g.da2 / 2);
      out.shafts = [I, II, III];
      out.stages = [{ shafts: [0, 1], bodies: [body(I, p1.x0, p1.x1, gB.da1 / 2), wheel(II, h2, gB)] }, { shafts: [1, 2], bodies: [body(II, p3.x0, p3.x1, gT.da1 / 2), wheel(III, h4, gT)] }];
      out.zp = 0;
      out.outShaft = 2;
    } else {
      // задание 1: коническая ступень (вал I горизонтален), промежуточный и тихоходный валы вертикальны, выход тихоходного вала — вверх
      const gC = R.gC, gT = R.gT;
      const I = shaft(sh.I, R.b1, [0, 0, 0], 0);
      const d1r = gC.d1deg * Math.PI / 180, d2r = gC.d2deg * Math.PI / 180;
      const xII = I.S[0].l - gC.Re * Math.cos(d1r);          // ось колеса проходит через вершину конуса шестерни
      const II0 = shaft(sh.II, R.b2, [0, 0, 0], 2), III0 = shaft(sh.III, R.b3, [0, 0, 0], 2);
      const xpII = midOf(II0, s => /коническ/.test(s.name)), xgII = midOf(II0, s => s.gear), xwIII = midOf(III0, s => /ступиц/.test(s.name));
      let xcHub = gC.Rm * Math.cos(d2r);
      try { const W = root.DRAWINGS.wheelProfile({ de: gC.de2, dae: gC.dae2, b: gC.b, Re: gC.Re, delta: gC.d2deg, mte: gC.mte, dbore: (R.dims || {}).d2p || 40, dst: (R.wC || {}).dst || 60, lst: (R.wC || {}).lst || 40, key: null }, 'bevel'); xcHub = (W.x0 + W.x1) / 2; } catch (e) { /* по Rm */ }
      const zC = -xcHub;
      const II = shaft(sh.II, R.b2, [xII, 0, zC - xpII], 2), III = shaft(sh.III, R.b3, [xII - gT.aw, 0, zC - xpII + xgII - xwIII], 2);
      const p1 = I.S[0], p2 = II.S.find(s => s.gear), h3 = III.S.find(s => /ступиц/.test(s.name));
      const zL = -gC.Re * Math.cos(d2r), zS = -(gC.Re - gC.b) * Math.cos(d2r);
      const bevel = { ax: 2, c: [xII, 0, (zL + zS) / 2], h: Math.abs(zS - zL) / 2 + 4, r: gC.dae2 / 2 };
      out.shafts = [I, II, III];
      out.stages = [{ shafts: [0, 1], bodies: [body(I, p1.x0, p1.x1, gC.dae1 / 2), bevel] }, { shafts: [1, 2], bodies: [body(II, p2.x0, p2.x1, gT.da1 / 2), body(III, (h3.x0 + h3.x1) / 2 - Math.max(gT.b2, h3.l) / 2, (h3.x0 + h3.x1) / 2 + Math.max(gT.b2, h3.l) / 2, gT.da2 / 2)] }];
      out.vert = true;
      out.outShaft = 2;
    }
    housing(out, H);
    return out;
  }

  /* ---------------- корпус: объёмы стенок, фланец разъёма, лапы, крышки подшипников, концы валов */
  function housing(Lt, H) {
    const del = H.del || 8, del1 = H.del1 || del, gap = H.gap || 10, gapTop = H.gapTop || gap, gapBot = H.gapBot || 3 * gap;
    const K = H.K || 24, ov = (H.K1 || 20) + 8, pF = H.p || Math.round(2.35 * del), dks = H.dks || 8;
    const tol = Math.max(15, 2 * del);
    const allB = Lt.stages.flatMap(s => s.bodies.map(bodyBox));
    const zMin = Math.min(...allB.map(b => b.lo[2]));
    // полость ступени + стенка
    const boxes = Lt.stages.map(st => {
      const u = unionBox(st.bodies.map(bodyBox));
      const lo = u.lo.map(v => v - gap - del), hi = u.hi.map(v => v + gap + del);
      hi[2] = u.hi[2] + gapTop + del;
      lo[2] = (Lt.vert ? u.lo[2] : zMin) - gapBot - del;
      return { lo, hi, st };
    });
    // продлить стенки вдоль осей валов до наружных торцев подшипников (у консольной шестерни — стакан)
    Lt.tubes = [];
    Lt.shafts.forEach((sh, si) => {
      const mine = boxes.filter(b => b.st.shafts.includes(si));
      if (!mine.length || !sh.br.length) return;
      const a = sh.ax;
      if (sh.cant) {
        const hostB = mine.find(b => b.st.bodies.some(q => q.ax === a)) || mine[0];
        const lo = Math.min(...sh.br.map(q => q.a)), hi = Math.max(...sh.br.map(q => q.b));
        const towardHi = sh.gx < lo;
        const w1 = at(sh, towardHi ? hi : lo)[a];
        const D = Math.max(...sh.br.map(q => q.D));
        const tlo = [0, 1, 2].map(i => i === a ? Math.min(w1, towardHi ? hostB.hi[a] - del : hostB.lo[a] + del) : sh.o[i] - D / 2 - del);
        const thi = [0, 1, 2].map(i => i === a ? Math.max(w1, towardHi ? hostB.hi[a] - del : hostB.lo[a] + del) : sh.o[i] + D / 2 + del);
        boxes.push({ lo: tlo, hi: thi, st: { shafts: [si], bodies: [] }, tube: true });
        return;
      }
      sh.br.forEach(q => {
        const p1 = at(sh, q.a)[a], p2 = at(sh, q.b)[a], lo = Math.min(p1, p2), hi = Math.max(p1, p2);
        // ближайшая по оси ступень
        const near = mine.map(b => ({ b, d: Math.max(0, b.lo[a] - hi, lo - b.hi[a]) })).sort((u, v) => u.d - v.d)[0].b;
        near.lo[a] = Math.min(near.lo[a], lo); near.hi[a] = Math.max(near.hi[a], hi);
      });
    });
    snap(boxes, tol);
    const walls = boxes.map(b => ({ lo: b.lo.slice(), hi: b.hi.slice(), tube: !!b.tube }));
    // плоскость разъёма (задание 1 — горизонтальная между нижними и верхними подшипниками вертикальных валов)
    if (Lt.vert) {
      const lowIn = [], upIn = [];
      Lt.shafts.filter(s => s.ax === 2).forEach(s => s.br.forEach(q => { const z1 = at(s, q.a)[2], z2 = at(s, q.b)[2]; if ((q.a + q.b) / 2 < s.gx) lowIn.push(Math.max(z1, z2)); else upIn.push(Math.min(z1, z2)); }));
      if (lowIn.length && upIn.length) { const a = Math.max(...lowIn) + del + 4, b = Math.min(...upIn) - del - 4; Lt.zp = Math.round(b > a ? b : (a + b) / 2); }
    }
    const tf = 1.5 * del, tf1 = 1.5 * del1;
    const atP = walls.filter(b => !b.tube && b.lo[2] < Lt.zp + tf && b.hi[2] > Lt.zp - tf1);
    const fp = unionBox(atP.length ? atP : walls);
    // напуск фланца K — только там, где в плоскости разъёма нет подшипников (у валов в разъёме кромка фланца = торец бобышки)
    const inPl = i => Lt.shafts.some(s => s.ax === i && Math.abs(s.o[2] - Lt.zp) < tf + 1);
    const Kx = inPl(0) ? 2 : K, Ky = inPl(1) ? 2 : K;    // 2 мм — чтобы линия разъёма была видна на стенке
    const flange = { lo: [fp.lo[0] - Kx, fp.lo[1] - Ky, Lt.zp - tf], hi: [fp.hi[0] + Kx, fp.hi[1] + Ky, Lt.zp + tf1] };
    // крышки подшипников и выходящие концы валов
    const caps = [], ends = [];
    const faceAt = (sh, dir) => {
      const a = sh.ax, oth = [0, 1, 2].filter(i => i !== a);
      const p = sh.o;
      const hit = walls.filter(b => oth.every(i => p[i] > b.lo[i] - 0.5 && p[i] < b.hi[i] + 0.5));
      if (!hit.length) return null;
      return dir > 0 ? Math.max(...hit.map(b => b.hi[a])) : Math.min(...hit.map(b => b.lo[a]));
    };
    Lt.shafts.forEach((sh, si) => {
      if (!sh.br.length) return;
      const a = sh.ax, sAt = s => at(sh, s)[a];
      const brLo = Math.min(...sh.br.map(q => q.a)), brHi = Math.max(...sh.br.map(q => q.b));
      [[-1, brLo], [1, brHi]].forEach(([dir, sb]) => {
        if (sh.cant && (dir < 0 ? sh.gx < sb : sh.gx > sb)) return;       // со стороны консольной шестерни крышки нет
        const face = faceAt(sh, dir); if (face === null) return;
        const D = Math.max(...sh.br.map(q => q.D));
        const Df = D + 4.4 * dks + 8, t = Math.max(8, Math.round(1.1 * dks));
        const endS = dir > 0 ? sh.L : 0, endW = sAt(endS);
        const beyond = dir > 0 ? endW > face + 1 : endW < face - 1;
        caps.push({ shaft: si, ax: a, c: sh.o, a1: Math.min(face, face + dir * t), a2: Math.max(face, face + dir * t), r: Df / 2, dir, through: beyond });
        if (!beyond) return;
        // конец вала: участок под манжету (до выходной ступени) и выходной конец
        const cf = face + dir * t;
        const outSeg = dir > 0 ? sh.S[sh.S.length - 1] : sh.S[0];
        const oS0 = sAt(outSeg.x0), oS1 = sAt(outSeg.x1), oLo = Math.min(oS0, oS1), oHi = Math.max(oS0, oS1);
        // участок между крышкой и выходной ступенью (под манжету) — отдельной ступенью, только если заметно толще
        let o1 = dir > 0 ? Math.max(cf, oLo) : oLo, o2 = dir > 0 ? oHi : Math.min(cf, oHi);
        if (dir > 0 && oLo > cf + 0.5) { const s = sh.S.find(q => sAt(q.x1) > cf + 0.5 && q !== outSeg) || outSeg; if (s.r - outSeg.r >= 4) ends.push({ shaft: si, ax: a, c: sh.o, a1: cf, a2: oLo, r: s.r }); else o1 = cf; }
        if (dir < 0 && oHi < cf - 0.5) { const s = sh.S.slice().reverse().find(q => sAt(q.x0) < cf - 0.5 && q !== outSeg) || outSeg; if (s.r - outSeg.r >= 4) ends.push({ shaft: si, ax: a, c: sh.o, a1: oHi, a2: cf, r: s.r }); else o2 = cf; }
        ends.push({ shaft: si, ax: a, c: sh.o, a1: o1, a2: o2, r: outSeg.r, out: true, dir, lOut: outSeg.l });
      });
    });
    // лапы
    const all = unionBox(walls.filter(b => !b.tube));
    let feet, holes = [];
    const dH = H.d1 || 16;
    if (Lt.vert) {
      const zB = all.lo[2];
      const lowCap = Math.min(zB, ...caps.filter(c => c.ax === 2 && c.dir < 0).map(c => c.a1 - 10));
      const deep = walls.filter(b => !b.tube && b.lo[2] < zB + pF + 1);
      const xa = Math.min(...deep.map(b => b.lo[0])), xb = Math.max(...deep.map(b => b.hi[0])), Y = Math.max(...deep.map(b => Math.max(-b.lo[1], b.hi[1])));
      const zTop = Math.max(zB + pF, lowCap + pF);
      feet = [-1, 1].map(s => ({ lo: [xa - ov, s < 0 ? -(Y + ov) : Y - del, lowCap], hi: [xb + ov, s < 0 ? -(Y - del) : Y + ov, zTop] }));
      for (const x of [xa - ov / 2, xb + ov / 2]) for (const s of [-1, 1]) holes.push([x, s * (Y + ov / 2)]);
      Lt.zFeet = lowCap;
    } else {
      feet = [{ lo: [all.lo[0] - ov, all.lo[1] - ov, all.lo[2]], hi: [all.hi[0] + ov, all.hi[1] + ov, all.lo[2] + pF] }];
      const f = feet[0], xs = [f.lo[0] + ov / 2, f.hi[0] - ov / 2], ys = [f.lo[1] + ov / 2, f.hi[1] - ov / 2];
      if (f.hi[1] - f.lo[1] > 650) ys.splice(1, 0, (f.lo[1] + f.hi[1]) / 2);
      if (f.hi[0] - f.lo[0] > 650) xs.splice(1, 0, (f.lo[0] + f.hi[0]) / 2);
      xs.forEach(x => ys.forEach(y => { if (x === xs[0] || x === xs[xs.length - 1] || y === ys[0] || y === ys[ys.length - 1]) holes.push([x, y]); }));
      Lt.zFeet = all.lo[2];
    }
    // фланец и лапы в плане: близкие кромки — в одну линию (отверстия лап сдвигаются вместе с кромкой)
    const pl = [flange].concat(feet), before = feet.map(f => ({ lo: f.lo.slice(), hi: f.hi.slice() }));
    for (let i = 0; i < 2; i++) for (const side of ['lo', 'hi']) {
      const ext = side === 'lo' ? Math.min(...pl.map(b => b.lo[i])) : Math.max(...pl.map(b => b.hi[i]));
      pl.forEach(b => { if (Math.abs(b[side][i] - ext) < tol) b[side][i] = ext; });
    }
    holes = holes.map(([x, y]) => { const f = feet.findIndex(q => x > q.lo[0] - 1 && x < q.hi[0] + 1 && y > q.lo[1] - 1 && y < q.hi[1] + 1); if (f < 0) return [x, y]; const b0 = before[f], b1 = feet[f];
      const mv = (v, i) => v - b0.lo[i] < b0.hi[i] - v ? v + (b1.lo[i] - b0.lo[i]) : v + (b1.hi[i] - b0.hi[i]); return [mv(x, 0), mv(y, 1)]; });
    Object.assign(Lt, { walls, flange, caps, ends, feet, holes, dHole: dH + 2, del, K, ov });
  }

  /* близкие грани ящиков (по каждой оси отдельно для «нижних» и «верхних» граней) выравниваются наружу */
  function snap(boxes, tol) {
    for (let i = 0; i < 3; i++) for (const side of ['lo', 'hi']) {
      const vals = boxes.map(b => b[side][i]).sort((a, c) => side === 'lo' ? a - c : c - a);
      const rep = [];
      vals.forEach(v => { const r = rep.find(q => Math.abs(q - v) < tol); if (r === undefined) rep.push(v); });
      boxes.forEach(b => { const r = rep.find(q => Math.abs(q - b[side][i]) < tol); if (r !== undefined) b[side][i] = r; });
    }
  }

  /* ---------------- сцена и видимость: ящики и цилиндры, проекция на вид, удаление невидимых частей */
  // вид сверху без зеркального отражения (ГОСТ 2.305): наблюдатель главного вида — со стороны −y, на виде сверху +y — вверх
  const VIEWS = { front: { u: 0, v: 2, vs: 1, d: 1, near: -1 }, top: { u: 0, v: 1, vs: 1, d: 2, near: 1 } };
  const SY = VIEWS.top.vs;
  function Scene() { this.o = []; }
  Scene.prototype.box = function (lo, hi, st, tag) { this.o.push({ t: 'b', lo, hi, st: st || 1, tag }); return this; };
  Scene.prototype.cyl = function (ax, c, a1, a2, r, st, tag) { const lo = c.slice(), hi = c.slice(); for (let i = 0; i < 3; i++) { if (i === ax) { lo[i] = Math.min(a1, a2); hi[i] = Math.max(a1, a2); } else { lo[i] = c[i] - r; hi[i] = c[i] + r; } } this.o.push({ t: 'c', ax, c, lo, hi, r, st: st || 1, tag }); return this; };
  Scene.prototype.render = function (sh, vw, k) {
    const V = VIEWS[vw], P = (u, v) => [u * k, V.vs * v * k];
    const nearness = q => V.near > 0 ? q.hi[V.d] : -q.lo[V.d];
    const list = this.o.slice().sort((a, b) => nearness(b) - nearness(a));
    const occR = [], occC = [], seen = new Set();
    const RS = root.DRWASM.RectSet;
    const clipC = (x1, y1, x2, y2, cs) => {   // осевые отрезки минус круги
      let segs = [[0, 1]];
      const hor = Math.abs(y2 - y1) < 1e-6, L = hor ? x2 - x1 : y2 - y1;
      cs.forEach(c => {
        const dd = hor ? y1 - c.y : x1 - c.x; if (Math.abs(dd) >= c.r) return;
        const w = Math.sqrt(c.r * c.r - dd * dd), m = hor ? c.x : c.y, s0 = hor ? x1 : y1;
        const t1 = (m - w - s0) / L, t2 = (m + w - s0) / L, a = Math.min(t1, t2), b = Math.max(t1, t2);
        const nx = []; segs.forEach(([p, q]) => { if (b <= p || a >= q) nx.push([p, q]); else { if (a > p) nx.push([p, a]); if (b < q) nx.push([b, q]); } }); segs = nx;
      });
      return segs.filter(([p, q]) => (q - p) * Math.abs(L) > 0.2).map(([p, q]) => [x1 + (x2 - x1) * p, y1 + (y2 - y1) * p, x1 + (x2 - x1) * q, y1 + (y2 - y1) * q]);
    };
    const put = (x1, y1, x2, y2, st) => { const key = [x1, y1, x2, y2].map(v => v.toFixed(1)).join(','), k2 = [x2, y2, x1, y1].map(v => v.toFixed(1)).join(','); if (seen.has(key) || seen.has(k2)) return; seen.add(key); sh.line(x1, y1, x2, y2, st); };
    const inR = (x, y) => occR.some(r => x > r.x1 + 0.01 && x < r.x2 - 0.01 && y > r.y1 + 0.01 && y < r.y2 - 0.01);
    list.forEach(q => {
      if (q.t === 'c' && q.ax === V.d) {
        const [cx, cy] = P(q.c[V.u], q.c[V.v]);
        if (inR(cx, cy)) return;
        sh.circle(cx, cy, q.r * k, q.st);
        occC.push({ x: cx, y: cy, r: q.r * k });
        return;
      }
      const a = P(q.lo[V.u], q.lo[V.v]), b = P(q.hi[V.u], q.hi[V.v]);
      const r = { x1: Math.min(a[0], b[0]), x2: Math.max(a[0], b[0]), y1: Math.min(a[1], b[1]), y2: Math.max(a[1], b[1]) };
      const S = new RS(); S.add(r); occR.forEach(o => S.sub(o));
      S.solve().edges.forEach(([x1, y1, x2, y2]) => clipC(x1, y1, x2, y2, occC).forEach(s => put(...s, q.st)));
      occR.push(r);
    });
  };

  /* прямоугольники проекций объектов с меткой tag и отрезок минус эти прямоугольники (для цепи за корпусом) */
  Scene.prototype.rects = function (vw, k, tag) {
    const V = VIEWS[vw];
    return this.o.filter(q => q.tag === tag && !(q.t === 'c' && q.ax === V.d)).map(q => { const a = [q.lo[V.u] * k, V.vs * q.lo[V.v] * k], b = [q.hi[V.u] * k, V.vs * q.hi[V.v] * k]; return { x1: Math.min(a[0], b[0]), x2: Math.max(a[0], b[0]), y1: Math.min(a[1], b[1]), y2: Math.max(a[1], b[1]) }; });
  };
  function lineOutside(sh, x1, y1, x2, y2, rects, st) {
    let segs = [[0, 1]];
    const dx = x2 - x1, dy = y2 - y1;
    rects.forEach(r => {
      // Лян — Барски: параметры входа и выхода отрезка в прямоугольник
      let t0 = 0, t1 = 1; const P = [-dx, dx, -dy, dy], Q = [x1 - r.x1, r.x2 - x1, y1 - r.y1, r.y2 - y1];
      for (let i = 0; i < 4; i++) { if (Math.abs(P[i]) < 1e-12) { if (Q[i] < 0) return; } else { const t = Q[i] / P[i]; if (P[i] < 0) t0 = Math.max(t0, t); else t1 = Math.min(t1, t); } }
      if (t0 >= t1) return;
      const nx = []; segs.forEach(([p, q]) => { if (t1 <= p || t0 >= q) nx.push([p, q]); else { if (t0 > p) nx.push([p, t0]); if (t1 < q) nx.push([t1, q]); } }); segs = nx;
    });
    segs.forEach(([p, q]) => { if ((q - p) * Math.hypot(dx, dy) > 0.3) sh.line(x1 + dx * p, y1 + dy * p, x1 + dx * q, y1 + dy * q, st); });
  }

  /* ---------------- рама, двигатель, муфта (в мировых осях; ось вала I — z = 0) */
  function drive(R, Lt) {
    const m = R.motor || {}, cp = (R.cp && R.cp.c) || {};
    const I = Lt.shafts[0], endX = at(I, I.L)[0];
    const mEnd = endX + 4, mSh = mEnd + (m.l1 || 80), h = m.h || 112;
    const motHoles = [];
    for (const x of [mSh + (m.l31 || 70), mSh + (m.l31 || 70) + (m.l10 || 140)]) for (const s of [-1, 1]) motHoles.push([x, s * (m.b10 || 190) / 2]);
    const zM = -h;                                   // опорная плоскость лап двигателя
    const zR = Lt.zFeet;                             // опорная плоскость лап редуктора
    const zTop = Math.min(zM, zR) - 10;              // верх рамы (подкладки ≥ 10 мм)
    const no = (m.P || 4) <= 3 ? 10 : (m.P || 4) <= 7.5 ? 12 : (m.P || 4) <= 15 ? 14 : 16;
    const [hc, bc] = CH[no];
    const holes = Lt.holes.concat(motHoles);
    const yL = Math.min(...holes.map(p => p[1])), yR = Math.max(...holes.map(p => p[1]));
    const fx0 = Math.min(...holes.map(p => p[0])) - 40, fx1 = Math.max(...holes.map(p => p[0]), mSh + (m.l30 || 400) - (m.l1 || 80) - 20) + 40;
    const floor = [];
    const n = Math.max(2, Math.ceil((fx1 - fx0) / 650) + 1);
    for (let i = 0; i < n; i++) { const x = fx0 + 30 + (fx1 - fx0 - 60) * i / (n - 1); floor.push([x, yL], [x, yR]); }   // на осях продольных швеллеров
    return { m, cp, endX, mEnd, mSh, h, zM, zR, zTop, hc, bc, yL, yR, fx0, fx1, floor, motHoles, dF: (R.H && R.H.d1) ? R.H.d1 + 2 : 18 };
  }

  /* ---------------- вид: сцена → лист */
  function views(R, P, T, Lt, D, k) {
    const res = {}, items = { front: [], top: [] };
    const mk = () => { const sh = new C.Sheet('A1', true); sh.frame = { x1: -1e5, y1: -1e5, x2: 1e5, y2: 1e5 }; return sh; };
    const sc = new Scene();
    Lt.walls.forEach(b => sc.box(b.lo, b.hi, 1, 'red'));
    sc.box(Lt.flange.lo, Lt.flange.hi, 1, 'red');
    Lt.feet.forEach(b => sc.box(b.lo, b.hi, 1, 'red'));
    Lt.caps.forEach(c => sc.cyl(c.ax, c.c, c.a1, c.a2, c.r, 1, 'red'));
    Lt.ends.forEach(c => sc.cyl(c.ax, c.c, c.a1, c.a2, c.r, 1, 'red'));
    // двигатель (каталог АИР)
    const m = D.m, Lb = (m.l30 || 400) - (m.l1 || 80), d30 = m.d30 || 2 * D.h * 0.95, d1 = m.d1 || 28, l31 = m.l31 || 60, l10 = m.l10 || 120, b11 = m.b11 || (m.b10 || 160) + 40;
    const x0 = D.mSh, xm1 = x0 + Lb;
    sc.cyl(0, [0, 0, 0], D.mEnd, x0, d1 / 2, 1, 'motor');
    sc.cyl(0, [0, 0, 0], x0, xm1 - Lb * 0.18, d30 / 2, 1, 'motor');
    sc.cyl(0, [0, 0, 0], xm1 - Lb * 0.18, xm1, d30 * 0.44, 1, 'motor');
    sc.box([x0 + l31 - 22, -b11 / 2, D.zM], [x0 + l31 + l10 + 22, b11 / 2, D.zM + Math.max(10, D.h * 0.14)], 1, 'motor');
    sc.box([x0 + Lb * 0.25, -d30 * 0.3, d30 / 2 - 10], [x0 + Lb * 0.55, d30 * 0.3, D.zM + (m.h31 || D.h + d30 / 2 + 40)], 1, 'motor');
    // муфта
    const cp = D.cp, gc = D.mEnd - 2, Lc = Math.min(cp.L1 || 2 * (cp.l1 || 60), (D.mSh - D.mEnd) * 2 + 40), Dc = cp.D || 120;
    sc.cyl(0, [0, 0, 0], gc - Lc / 2, gc - 2, Dc / 2, 1, 'coupling');
    sc.cyl(0, [0, 0, 0], gc + 2, gc + Lc / 2, Dc / 2, 1, 'coupling');
    // подкладки и рама
    const pads = [];
    Lt.feet.forEach(f => pads.push({ lo: [f.lo[0], f.lo[1], D.zTop], hi: [f.hi[0], f.hi[1], D.zR] }));
    pads.push({ lo: [x0 + l31 - 30, -b11 / 2 - 5, D.zTop], hi: [x0 + l31 + l10 + 30, b11 / 2 + 5, D.zM] });
    pads.forEach(p => { if (p.hi[2] - p.lo[2] > 0.5) sc.box(p.lo, p.hi, 1, 'frame'); });
    const b2 = D.bc / 2;
    [D.yL, D.yR].forEach(y => sc.box([D.fx0, y - b2, D.zTop - D.hc], [D.fx1, y + b2, D.zTop], 1, 'frame'));
    [D.fx0 + b2, D.fx1 - b2].forEach(x => sc.box([x - b2, D.yL + b2, D.zTop - D.hc], [x + b2, D.yR - b2, D.zTop], 1, 'frame'));
    // звёздочка цепной передачи на выходном валу
    const chn = R.chn, os = Lt.shafts[Lt.outShaft], oe = Lt.ends.find(e => e.out && e.shaft === Lt.outShaft);
    let spr = null;
    if (chn && oe) {
      const b = 0.93 * chn.chain.Bvn - 0.15, mid = (oe.a1 + oe.a2) / 2;
      sc.cyl(os.ax, os.o, mid - b / 2, mid + b / 2, chn.De1 / 2, 1, 'chain');
      spr = { ax: os.ax, c: os.o.map((v, i) => i === os.ax ? mid : v), b };
    }
    for (const vw of ['front', 'top']) {
      const sh = mk(), V = VIEWS[vw];
      sc.render(sh, vw, k);
      const P = (w) => [w[V.u] * k, V.vs * w[V.v] * k];
      // оси валов
      Lt.shafts.forEach((s, si) => {
        const e1 = at(s, 0), e2 = at(s, s.L);
        const ends = Lt.ends.filter(e => e.shaft === si);
        const lo = Math.min(e1[s.ax], e2[s.ax], ...ends.map(e => e.a1)), hi = Math.max(e1[s.ax], e2[s.ax], ...ends.map(e => e.a2));
        if (s.ax === V.d) {
          const c = P(s.o), cap = Lt.caps.filter(q => q.shaft === si).reduce((a, q) => Math.max(a, q.r), 30);
          const e = cap * k + 4;   // центровые выходят за контур на 4 мм листа при любом масштабе
          sh.line(c[0] - e, c[1], c[0] + e, c[1], 3).line(c[0], c[1] - e, c[0], c[1] + e, 3);
        } else {
          const a = s.o.slice(), b = s.o.slice(); a[s.ax] = lo - 6; b[s.ax] = hi + 6;
          const pa = P(a), pb = P(b); sh.line(pa[0], pa[1], pb[0], pb[1], 3);
        }
      });
      // ось двигателя
      { const a = P([D.mEnd - 10, 0, 0]), b = P([xm1 + 10, 0, 0]); sh.line(a[0], a[1], b[0], b[1], 3); }
      // отверстия под фундаментные болты (вид сверху)
      if (vw === 'top') {
        D.floor.forEach(([x, y]) => { const c = P([x, y, 0]); sh.circle(c[0], c[1], D.dF / 2 * k, 1); sh.line(c[0] - D.dF * k, c[1], c[0] + D.dF * k, c[1], 3).line(c[0], c[1] - D.dF * k, c[0], c[1] + D.dF * k, 3); });
      }
      // позиции
      // точка позиции редуктора: выноска идёт вертикально — не по оси вертикального вала и не через середину межосевого размера
      const rb = unionBox(Lt.walls), avoid = [];
      Lt.shafts.forEach((q, i) => { if (q.ax === 2) { avoid.push(q.o[0]); const n = Lt.shafts[i + 1]; if (n && n.ax === 2) avoid.push((q.o[0] + n.o[0]) / 2); } });
      const fx = [0.3, 0.62, 0.45, 0.8, 0.15].map(f => rb.lo[0] + (rb.hi[0] - rb.lo[0]) * f).find(x => avoid.every(a => Math.abs(a - x) > 40)) || rb.lo[0] + (rb.hi[0] - rb.lo[0]) * 0.3;
      const rc = [fx,  (rb.lo[1] + rb.hi[1]) / 2, rb.lo[2] + (rb.hi[2] - rb.lo[2]) * 0.65];
      items[vw].push({ kind: 'red', pt: P(rc) });
      items[vw].push({ kind: 'motor', pt: P([x0 + Lb * 0.6, vw === 'top' ? -d30 * 0.35 : 0, d30 * 0.2]) });
      items[vw].push({ kind: 'coupling', pt: P([gc + Lc / 4, -Dc * 0.3, Dc * 0.3]) });
      if (vw === 'front') items[vw].push({ kind: 'frame', pt: P([D.fx0 + (D.fx1 - D.fx0) * 0.3, 0, D.zTop - D.hc / 2]) });   // не по центру — там надпись габарита
      res[vw] = { sh };
    }
    if (spr) chainDraw(R, Lt, spr, res, items, k, { front: sc.rects('front', k, 'red'), top: sc.rects('top', k, 'red') });
    // надпись «к звёздочке конвейера» ставится после размеров (sketchSheet → dims), чтобы обойти их линии
    const post = () => { if (R.task !== 1) return;
      const s = Lt.shafts[Lt.outShaft], top = at(s, s.L), sh = res.front.sh, oe = Lt.ends.find(e => e.out && e.shaft === Lt.outShaft), r = oe ? oe.r : 20;
      const p = [(top[0] - r) * k, (top[2] - 12) * k];   // от боковой образующей ниже торца — не через размер ⌀d над торцом
      sh.attempt([[-20, 10], [-24, 4], [-20, 18], [-30, 12], [20, 14]].map(([dx, dy]) => () => sh.leader(p[0], p[1], p[0] + dx, p[1] + dy, 'к звёздочке', 'конвейера', dx < 0 ? { side: 'l' } : undefined)));
    };
    return { res, items, post };
  }

  /* цепная передача и вал барабана — по R.chn, R.drum (как на чертеже общего вида) */
  function chainDraw(R, Lt, spr, res, items, k, hide) {
    const chn = R.chn, r1 = chn.De1 / 2, r2 = chn.De2 / 2, a = chn.a, b = spr.b;
    const alongX = spr.ax === 0;
    const aD = Math.min(a, Math.max(r1 + r2 + 70, 300)), broken = aD < a - 1;
    const c1 = { x: spr.c[0], y: spr.c[1], z: spr.c[2] };
    const c2 = alongX ? { x: c1.x, y: c1.y + aD, z: c1.z } : { x: c1.x - aD, y: c1.y, z: c1.z };
    ['front', 'top'].forEach(vw => {
      const sh = res[vw].sh, pt = q => vw === 'front' ? [q.x * k, q.z * k] : [q.x * k, SY * q.y * k];
      const seesFace = vw === 'front' && !alongX;
      if (seesFace) {
        const p2 = pt(c2); sh.circle(p2[0], p2[1], r2 * k, 2); sh.circle(p2[0], p2[1], (r2 - chn.t * 0.6) * k, 2);
        const p1 = pt(c1), d = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) || 1, nx = -(p2[1] - p1[1]) / d, ny = (p2[0] - p1[0]) / d;
        [1, -1].forEach(s => lineOutside(sh, p1[0] + nx * r1 * k * s, p1[1] + ny * r1 * k * s, p2[0] + nx * r2 * k * s, p2[1] + ny * r2 * k * s, hide[vw], 2));
      } else if (!(vw === 'front' && alongX)) {
        const p = pt(c2);
        if (alongX) sh.rect(p[0] - b / 2 * k, p[1] - r2 * k, p[0] + b / 2 * k, p[1] + r2 * k, 2);
        else sh.rect(p[0] - r2 * k, p[1] - b / 2 * k, p[0] + r2 * k, p[1] + b / 2 * k, 2);
        const p1 = pt(c1); sh.line(p1[0], p1[1], p[0], p[1], 3);
      }
      const q1 = pt(c1), q2 = pt(c2);
      if (broken && !(vw === 'front' && alongX)) { const mx = (q1[0] + q2[0]) / 2, my = (q1[1] + q2[1]) / 2, dx = q2[0] - q1[0], dy = q2[1] - q1[1], d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d, nx = -uy, ny = ux, L0 = 10; [-2.5, 2.5].forEach(o => sh.poly([[mx + ux * o - nx * L0, my + uy * o - ny * L0], [mx + ux * o + nx * L0 * 0.1, my + uy * o + ny * L0 * 0.1], [mx + ux * o - nx * L0 * 0.1 + ux * 2, my + uy * o - ny * L0 * 0.1 + uy * 2], [mx + ux * o + nx * L0, my + uy * o + ny * L0]], 2, false)); }
      if (vw === 'top' || seesFace) sh.attempt([1, -1].map(sg => () => { const off = (Math.max(r1, r2) + 14) * k * sg; return Math.abs(q2[0] - q1[0]) > Math.abs(q2[1] - q1[1]) ? sh.dimH(q1[0], q1[1], q2[0], q2[1], q1[1] + off, nf(a)) : sh.dimV(q1[0], q1[1], q2[0], q2[1], q1[0] + off, nf(a)); }));
      if (!(vw === 'front' && alongX)) items[vw].push({ kind: 'chain', pt: [(q1[0] + q2[0]) / 2, (q1[1] + q2[1]) / 2] });
    });
    if (R.drum && alongX) {
      const dr = R.drum, D = dr.Db, B = dr.Bb, sh = res.top.sh;
      const p = [c2.x * k, SY * c2.y * k], sg = -1;
      const xm = p[0] + sg * (dr.ak4 || 100) * k + sg * dr.l4 / 2 * k, yA = p[1], Lw = dr.l4 + 120;
      sh.rect(xm - B / 2 * k, yA - D / 2 * k, xm + B / 2 * k, yA + D / 2 * k, 1);
      sh.line(Math.min(p[0], xm - sg * Lw / 2 * k) - 6, yA, Math.max(p[0], xm + sg * Lw / 2 * k) + 6, yA, 3);
      [xm - dr.l4 / 2 * k, xm + dr.l4 / 2 * k].forEach(x => sh.rect(x - 30 * k, yA - (dr.dp / 2 + 40) * k, x + 30 * k, yA + (dr.dp / 2 + 40) * k, 1));
      sh.rect(Math.min(p[0], xm + sg * (dr.l4 / 2 + 40) * k), yA - dr.dv / 2 * k, Math.max(p[0], xm + sg * (dr.l4 / 2 + 40) * k), yA + dr.dv / 2 * k, 1);
      items.top.push({ kind: 'drum', pt: [xm, yA + D / 4 * k] });
    }
  }

  /* ---------------- лист: эскиз общего вида */
  function sketchSheet(R, P, T, drvSpec, meta) {
    const Lt = layout(R); if (!Lt) return null;
    const D = drive(R, Lt);
    return root.DRWDRIVE.compose(R, P, T, drvSpec, {
      views: k => views(R, P, T, Lt, D, k),
      post: V => V.post(),
      dims: (V, k) => {
        const fr = V.res.front.sh, tp = V.res.top.sh;
        {
          const b = fr.geoBox();
          fr.dimH(b.x1, b.y1, b.x2, b.y1, b.y1 - 14, nf((b.x2 - b.x1) / k) + '*');
          fr.dimV(b.x2, b.y1, b.x2, b.y2, b.x2 + 14, nf((b.y2 - b.y1) / k) + '*');
          const yb = (D.zTop - D.hc) * k;
          fr.dimV(D.fx0 * k, yb, D.fx0 * k, 0, D.fx0 * k - 12, nf(-(D.zTop - D.hc)));
        }
        {
          const b = tp.geoBox();
          tp.dimV(b.x1, b.y1, b.x1, b.y2, b.x1 - 14, nf((b.y2 - b.y1) / k) + '*');
          const xs = [...new Set(D.floor.map(h => Math.round(h[0])))].sort((p, q) => p - q), ys = [...new Set(D.floor.map(h => Math.round(h[1])))].sort((p, q) => p - q);
          const yLow = SY > 0 ? ys[0] : ys[ys.length - 1];   // ряд отверстий, что ниже на листе
          const yHigh = SY > 0 ? ys[ys.length - 1] : ys[0], xT = nf(xs[xs.length - 1] - xs[0]);
          // под видом может уже стоять размер цепной передачи — тогда шаг отверстий над видом, от другого ряда
          tp.attempt([...[12, 20].map(o => () => tp.dimH(xs[0] * k, SY * yLow * k, xs[xs.length - 1] * k, SY * yLow * k, Math.min(b.y1, SY * yLow * k) - o, xT)),
            ...[12, 20].map(o => () => tp.dimH(xs[0] * k, SY * yHigh * k, xs[xs.length - 1] * k, SY * yHigh * k, Math.max(b.y2, SY * yHigh * k) + o, xT))]);
          tp.dimV(xs[xs.length - 1] * k, SY * ys[0] * k, xs[xs.length - 1] * k, SY * ys[ys.length - 1] * k, b.x2 + 12, nf(ys[ys.length - 1] - ys[0]));
          const h = D.floor[0];
          tp.attempt([[-14, 14], [-14, -14], [14, -14]].map(([dx, dy]) => () => tp.leader(h[0] * k + Math.sign(dx) * D.dF / 2 * k * 0.7, SY * h[1] * k + Math.sign(dy) * D.dF / 2 * k * 0.7, h[0] * k + dx, SY * h[1] * k + dy, `⌀${D.dF}`, `${D.floor.length} отв.`, { side: dx > 0 ? 'r' : 'l' })));
          // межосевые расстояния параллельных валов в плане
          const sv = Lt.shafts;
          for (let i = 0; i + 1 < sv.length; i++) {
            const a = sv[i], c = sv[i + 1]; if (a.ax !== c.ax) continue;
            if (a.ax === 2) { const pa = [a.o[0] * k, SY * a.o[1] * k], pc = [c.o[0] * k, SY * c.o[1] * k]; tp.attempt([34, -34, 46, -46, 58, -58].map(off => () => tp.dimH(pa[0], pa[1], pc[0], pc[1], pa[1] + off, nf(Math.abs(a.o[0] - c.o[0]), 1)))); }
            else if (a.ax === 0) { const x = Math.min(a.o[0], c.o[0]) * k, xo = Math.min(Lt.flange.lo[0], ...Lt.feet.map(f => f.lo[0]), ...Lt.walls.map(w => w.lo[0])) * k - 8; tp.attempt([xo, xo - 8, x - 12].map(xd => () => tp.dimV(x, SY * a.o[1] * k, x, SY * c.o[1] * k, xd, nf(Math.abs(a.o[1] - c.o[1]), 1)))); }   // слева от корпуса
          }
        }
        // червячная передача: межосевое расстояние на виде спереди (ось червяка — ось колеса)
        if (R.task === 3) { const w = Lt.shafts[1].o; fr.attempt([1, -1].map(sg => () => fr.dimV(w[0] * k, 0, w[0] * k, w[2] * k, w[0] * k + sg * 70, nf(w[2], 1)))); }
        // присоединительные размеры выходного конца тихоходного вала: ⌀d с полем допуска m6 и длина от крышки до торца
        const oe = Lt.ends.find(e => e.out && e.shaft === Lt.outShaft);
        if (oe) {
          const vw = oe.ax === 2 ? 'front' : 'top', sh = V.res[vw].sh;
          const Vv = VIEWS[vw], perp = oe.ax === 2 ? 0 : oe.ax === 0 ? Vv.v : 0;
          const w = (s, p) => { const q = oe.c.slice(); q[oe.ax] = s; q[perp] += p; return q; };
          const P = q => [q[Vv.u] * k, Vv.vs * q[Vv.v] * k];
          const tip = oe.dir > 0 ? oe.a2 : oe.a1, base = tip - oe.dir * (oe.lOut || Math.abs(oe.a2 - oe.a1));   // длина выходной ступени
          const A = P(w(tip, -oe.r)), B = P(w(tip, oe.r)), T0 = P(w(base, 0)), T1 = P(w(tip, 0));
          const along = [Math.sign(T1[0] - T0[0]), Math.sign(T1[1] - T0[1])];   // направление к торцу на листе
          const dTxt = `⌀${nf(2 * oe.r, 1)}${R.task === 1 ? 'k6' : 'm6'}`, lTxt = nf(Math.abs(tip - base), 0);   // поле допуска — как на СБ редуктора и чертеже вала
          if (Math.abs(A[0] - B[0]) > Math.abs(A[1] - B[1])) sh.attempt([8, 14, 20, 28].map(o => () => sh.dimH(A[0], A[1], B[0], B[1], A[1] + along[1] * o, dTxt)));
          else sh.attempt([8, 14, 20, 28].map(o => () => sh.dimV(A[0], A[1], B[0], B[1], A[0] + along[0] * o, dTxt)));
          const C = [P(w(base, oe.r)), P(w(tip, oe.r))], C2 = [P(w(base, -oe.r)), P(w(tip, -oe.r))];
          const lenDim = (Q, sg) => Math.abs(Q[0][0] - Q[1][0]) > Math.abs(Q[0][1] - Q[1][1])
            ? () => sh.dimH(Q[0][0], Q[0][1], Q[1][0], Q[1][1], Q[0][1] + sg * 10, lTxt) : () => sh.dimV(Q[0][0], Q[0][1], Q[1][0], Q[1][1], Q[0][0] + sg * 10, lTxt);
          const sideC = Math.sign((C[0][0] - T0[0]) + (C[0][1] - T0[1])) || 1;
          // торец корпуса (крышки) у основания ступени: выносная линия легла бы на него — тогда размерная линия упирается прямо в торец (ГОСТ 2.307 п. 2.4)
          const wallDim = (Q, sg, o) => () => { const ox = Math.sign(Q[0][0] - T0[0]) * o, oy = Math.sign(Q[0][1] - T0[1]) * o, a = [Q[0][0] + ox, Q[0][1] + oy];
            if (Math.abs(Q[0][0] - Q[1][0]) > Math.abs(Q[0][1] - Q[1][1])) sh.dimH(a[0], a[1], Q[1][0], Q[1][1], a[1], lTxt, { fixed: true }); else sh.dimV(a[0], a[1], Q[1][0], Q[1][1], a[0], lTxt, { fixed: true }); };
          sh.attempt([...[10, 16, 24, 32].flatMap(o => [lenDim(C, sideC * o / 10), lenDim(C2, -sideC * o / 10)]), ...[8, 12, 16].flatMap(o => [wallDim(C, 1, o), wallDim(C2, -1, o)])]);
          // высота оси выходного вала над полом (если вал горизонтальный и выше входного)
          if (oe.ax !== 2 && Math.abs(oe.c[2]) > 1) {
            const yb = (D.zTop - D.hc) * k, x = D.fx0 * k;   // рядом с высотой оси входного вала, слева
            fr.attempt([2, 3].map(i => () => fr.dimV(x, yb, oe.c[0] * k, oe.c[2] * k, x - 12 * i, nf(oe.c[2] - (D.zTop - D.hc)))));
          }
        }
      }
    }, meta || { id: 'eskiz_vo', file: 'privod_VO_eskiz.cdw', nameSub: 'Эскиз общего вида' });
  }

  root.DRWSKETCH = { sketchSheet, layout, Scene };
})(typeof window !== 'undefined' ? window : globalThis);
