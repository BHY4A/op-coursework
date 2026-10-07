/* drawings.js — листы чертежей курсового проекта: рабочие чертежи валов и колёс, сборочный чертёж редуктора.
   Всё строится в мм листа примитивами DRWCORE; те же примитивы рисует макрос КОМПАС и предпросмотр SVG. */
(function (root) {
  'use strict';
  const C = root.DRWCORE;
  const { Sheet, View, tw } = C;
  const D2R = Math.PI / 180;
  const nf = (x, dig) => C.fmtNum(x, dig === undefined ? 2 : dig);
  const n1 = x => nf(x, 1);
  const SCALES = [[4, '4:1'], [2.5, '2,5:1'], [2, '2:1'], [1, '1:1'], [0.5, '1:2'], [0.4, '1:2,5'], [0.25, '1:4'], [0.2, '1:5']];
  const scaleText = k => (SCALES.find(s => Math.abs(s[0] - k) < 1e-9) || [k, String(k)])[1];

  /* ---------------------------------------------------------------- справочные правила */
  const chamf = d => d <= 30 ? 1 : d <= 50 ? 1.6 : d <= 80 ? 2 : 2.5;
  const series = [0.002, 0.003, 0.004, 0.005, 0.006, 0.008, 0.010, 0.012, 0.016, 0.020, 0.025, 0.030, 0.040, 0.050, 0.060, 0.080, 0.1];
  const upS = v => series.find(s => s >= v - 1e-9) || v;
  const IT = (d, q) => { // поле допуска, мкм (ГОСТ 25346), качества 5…9, 11
    const D = [3, 6, 10, 18, 30, 50, 80, 120, 180, 250, 315, 400, 500];
    const T = { 5: [4, 5, 6, 8, 9, 11, 13, 15, 18, 20, 23, 25, 27], 6: [6, 8, 9, 11, 13, 16, 19, 22, 25, 29, 32, 36, 40], 7: [10, 12, 15, 18, 21, 25, 30, 35, 40, 46, 52, 57, 63], 8: [14, 18, 22, 27, 33, 39, 46, 54, 63, 72, 81, 89, 97], 9: [25, 30, 36, 43, 52, 62, 74, 87, 100, 115, 130, 140, 155], 11: [60, 75, 90, 110, 130, 160, 190, 220, 250, 290, 320, 360, 400] };
    const i = D.findIndex(x => d <= x); return T[q][i < 0 ? D.length - 1 : i];
  };
  const tolCyl = d => upS(IT(d, 5) / 2000);
  const tolRun = (d, k) => upS(IT(d, 6) / 1000 * (k || 1));
  const tolPerp = d => upS(IT(d, 6) / 1000);
  const tolSym = b => upS(IT(b, 9) * 2 / 1000 * 0.6);
  const keyT1tol = h => h <= 6 ? '+0,1' : '+0,2';

  function segRole(s) {
    const n = s.name || '';
    if (s.gear) return 'gear';
    if (/резьба/.test(n)) return 'thread';
    if (/подшипник/.test(n)) return 'bearing';
    if (/ступиц/.test(n)) return 'hub';
    if (/выходной/.test(n)) return 'out';
    if (/манжет/.test(n)) return 'seal';
    if (/шайб/.test(n)) return 'washer';
    if (/бурт/.test(n)) return 'collar';
    if (/барабан/.test(n)) return 'hub';
    if (/звёздочк/.test(n)) return 'hub';
    return 'free';
  }
  function fitOf(role, task) {
    if (role === 'bearing') return 'k6';
    if (role === 'hub') return task === 1 ? 'p6' : 'k6';
    if (role === 'out') return task === 1 ? 'k6' : 'm6';
    if (role === 'seal') return 'h11';
    return '';
  }
  function raOf(role) { return { bearing: '0,8', hub: '1,6', out: '1,6', seal: '0,32', gear: '' }[role] || ''; }
  const keyFit = task => task === 1 ? ['P9', 'P9'] : ['N9', 'Js9'];

  /* ---------------------------------------------------------------- компоновка */
  function overlaps(a, b) { return a.x1 < b.x2 && a.x2 > b.x1 && a.y1 < b.y2 && a.y2 > b.y1; }

  /* ================================================================ ВАЛ */
  function prepSegs(pd) {
    const segs = pd.geom.segs.map(s => Object.assign({}, s, { role: segRole(s) }));
    let x0 = 0;
    segs.forEach(s => { s.x0 = x0; s.x1 = x0 + s.l; s.r = s.d / 2; x0 += s.l; });
    const isBev = s => s.gear && s.gear.kind === 'bevel';
    segs.forEach((s, i) => {
      const prev = segs[i - 1], next = segs[i + 1];
      const cg = s.role === 'gear' ? Math.min(0.5 * (s.gear.m || 2), 2.5) : chamf(s.d);
      s.cL = isBev(s) ? 0 : ((!prev || prev.r < s.r - 0.05) ? cg : 0);
      s.cR = isBev(s) ? 0 : ((!next || next.r < s.r - 0.05) ? cg : 0);
      if (s.role === 'thread') { const pm = /×\s*([\d,]+)/.exec(s.name); s.p = pm ? parseFloat(pm[1].replace(',', '.')) : 1.5; }
    });
    // канавки для выхода шлифовального круга (ГОСТ 8820-69) у заплечиков под подшипники
    segs.forEach((s, i) => {
      if (s.role !== 'bearing') return;
      const nb = [['R', segs[i + 1]], ['L', segs[i - 1]]].find(([, q]) => q && q.r > s.r + 0.5);
      if (!nb) return;
      const g = s.d <= 50 ? { b: 3, h: 0.25, R: 1 } : s.d <= 100 ? { b: 5, h: 0.5, R: 1.6 } : { b: 8, h: 0.5, R: 2 };
      s.groove = Object.assign({ side: nb[0], H: nb[1].r - s.r }, g);
    });
    return segs;
  }
  const isBev = s => !!(s.gear && s.gear.kind === 'bevel');

  /* главный вид вала со всеми обозначениями; возвращает сведения для сечений */
  function shaftMain(sh, segs, ax, ay, k, info) {
    const v = new View(sh, ax, ay, k);
    const X = x => v.X(x), Y = y => v.Y(y);
    const L = segs[segs.length - 1].x1, last = segs[segs.length - 1], rmax = Math.max(...segs.map(s => s.r));
    const f = sh.frame;
    // ---------- контур
    for (const sg of [1, -1]) segs.forEach(s => {
      if (isBev(s)) return;
      const gr = s.groove;
      if (gr && gr.side === 'R') { v.line(s.x0 + s.cL, sg * s.r, s.x1 - gr.b, sg * s.r, 1); v.line(s.x1 - gr.b, sg * s.r, s.x1 - gr.b, sg * (s.r - gr.h), 1); v.line(s.x1 - gr.b, sg * (s.r - gr.h), s.x1, sg * (s.r - gr.h), 1); }
      else if (gr && gr.side === 'L') { v.line(s.x0 + gr.b, sg * s.r, s.x1 - s.cR, sg * s.r, 1); v.line(s.x0 + gr.b, sg * s.r, s.x0 + gr.b, sg * (s.r - gr.h), 1); v.line(s.x0, sg * (s.r - gr.h), s.x0 + gr.b, sg * (s.r - gr.h), 1); }
      else v.line(s.x0 + s.cL, sg * s.r, s.x1 - s.cR, sg * s.r, 1);
      if (s.cL) v.line(s.x0, sg * (s.r - s.cL), s.x0 + s.cL, sg * s.r, 1);
      if (s.cR) v.line(s.x1 - s.cR, sg * s.r, s.x1, sg * (s.r - s.cR), 1);
    });
    segs.forEach((s, i) => {
      const prev = segs[i - 1];
      if (!isBev(s)) {
        const rl = prev && !isBev(prev) ? Math.max(prev.r - (prev.cR || 0), s.r - s.cL) : s.r - s.cL;
        v.line(s.x0, -rl, s.x0, rl, 1);
      }
      if (s.cL) v.line(s.x0 + s.cL, -s.r, s.x0 + s.cL, s.r, 1);
      if (s.cR) v.line(s.x1 - s.cR, -s.r, s.x1 - s.cR, s.r, 1);
    });
    if (!isBev(last)) v.line(L, -(last.r - last.cR), L, last.r - last.cR, 1);
    const bev = segs.find(isBev);
    let bi = null;
    if (bev) {
      const g = bev.gear, dl = g.delta * D2R, Re = g.d / 2 / Math.sin(dl), b = g.b;
      const Rae = g.da / 2, Rai = Rae * (Re - b) / Re;
      const xb = bev.x1, xs = bev.x0, apex = xb - Re * Math.cos(dl);
      bi = { g, dl, Re, Rae, Rai, xb, xs, apex };
      for (const sg of [1, -1]) v.line(xs, sg * Rai, xb, sg * Rae, 1);
      v.line(xs, -Rai, xs, Rai, 1);
      v.line(xb, -Rae, xb, Rae, 1);
      const xa = xs - (xs - apex) * 0.45;
      for (const sg of [1, -1]) v.line(xa, sg * g.d / 2 * (xa - apex) / (xb - apex), xb + 2 / k, sg * (g.d / 2) * (xb + 2 / k - apex) / (xb - apex), 3);
    }
    v.line((bi ? Math.min(bi.xs - (bi.xs - bi.apex) * 0.45, 0) : 0) - 5 / k, 0, L + 5 / k, 0, 3);
    segs.forEach(s => {
      if (!s.gear || isBev(s)) return;
      for (const sg of [1, -1]) {
        v.line(s.x0 - 2 / k, sg * s.gear.d / 2, s.x1 + 2 / k, sg * s.gear.d / 2, 3);
        if (s.gear.kind === 'worm') v.line(s.x0 + s.cL, sg * s.gear.df / 2, s.x1 - s.cR, sg * s.gear.df / 2, 2);
      }
    });
    segs.forEach(s => { if (s.role === 'thread') { const r1 = s.r - 0.5413 * s.p; for (const sg of [1, -1]) v.line(s.x0 + 0.5, sg * r1, s.x1 - s.cR, sg * r1, 2); } });
    const keys = [];
    segs.forEach(s => {
      const kd = s.key; if (!kd) return;
      const xc = (s.x0 + s.x1) / 2, a = xc - kd.l / 2, b = xc + kd.l / 2, rr = kd.b / 2;
      sh.line(X(a + rr), Y(rr), X(b - rr), Y(rr), 1); sh.line(X(a + rr), Y(-rr), X(b - rr), Y(-rr), 1);
      sh.arc(X(b - rr), Y(0), rr * k, -90, 90, 1); sh.arc(X(a + rr), Y(0), rr * k, 90, 270, 1);
      keys.push({ s, kd, xc, a, b });
    });
    // ---------- линии сечений (раньше размеров, чтобы размеры их обходили)
    const datumSegs = segs.filter(s => s.role === 'bearing');
    const dLet = new Map();
    if (datumSegs[0]) dLet.set(datumSegs[0], 'А');
    if (datumSegs.length > 1) dLet.set(datumSegs[datumSegs.length - 1], 'Б');
    const base2 = datumSegs.length > 1 ? 'А-Б' : 'А';
    const used = [...dLet.values()];
    const letters = ['А', 'Б', 'В', 'Г', 'Д', 'Е', 'Ж', 'И', 'К'].filter(l => !used.includes(l));
    keys.forEach((q, i) => { q.L = letters[i]; sh.cutV(X(q.xc), Y(-q.s.r), Y(q.s.r), q.L, 'l'); });
    // ---------- длины снизу (раньше диаметров: размерные числа диаметров обходят выносные линии): цепочка без замыкающего звена, потом габарит
    let ylow = Math.min(sh.bbox(0).y1, Y(-rmax));
    const yb = Y(-rmax);
    const x0 = bi ? bi.xs : 0;
    const skip = (() => { let best = -1, bl = -1; segs.forEach((s, i) => { const sc = (/участок|распорн|бурт/.test(s.name) ? 1000 : 0) + s.l; if (sc > bl) { bl = sc; best = i; } }); return best; })();
    const rows = [0, 1, 2, 3, 4].map(i => yb - 14 - 8 * i);
    let lowest = rows[0];
    segs.forEach((s, i) => {
      if (i === skip) return;
      const t = nf(s.l, 2), y0 = isBev(s) ? -bi.Rai : -s.r;
      const opts = [];
      rows.forEach(yy => { opts.push(() => { sh.dimH(X(s.x0), Y(y0), X(s.x1), Y(-s.r), yy, t, { gap: 0 }); s._ry = yy; }); opts.push(() => { sh.dimH(X(s.x0), Y(y0), X(s.x1), Y(-s.r), yy, t, { gap: 0, side: 'left' }); s._ry = yy; }); });
      sh.attempt(opts);
      lowest = Math.min(lowest, s._ry);
    });
    const yo = lowest - 9;
    sh.attempt([0, 8, 16].map(d => () => sh.dimH(X(x0), Y(-(bi ? bi.Rai : segs[0].r)), X(L), Y(-last.r), yo - d, nf(L - x0, 1))));
    // ---------- шероховатость посадочных поверхностей
    segs.forEach(s => {
      const ra = raOf(s.role); if (!ra || isBev(s)) return;
      sh.attempt([0.2, 0.5, 0.8, 0.1, 0.35, 0.65].map(t => () => sh.rough(X(s.x0 + s.l * t), Y(s.r), 'Ra ' + ra)));
    });
    // ---------- диаметры
    segs.forEach(s => {
      if (isBev(s)) return;
      const key = keys.find(q => q.s === s);
      const txt = s.role === 'thread' ? `М${nf(s.d, 1)}×${nf(s.p, 2)}-6g` : s.role === 'gear' ? `⌀${nf(s.gear.da, 2)}h11` : `⌀${nf(s.d, 2)}${fitOf(s.role, info.task)}`;
      const xs = [];
      if (key) { const m = (s.l - key.kd.l) / 2; if (m * k >= 5) xs.push(s.x0 + m / 2, s.x1 - m / 2); xs.push(key.xc - key.kd.l * 0.3, key.xc + key.kd.l * 0.3); }
      else xs.push((s.x0 + s.x1) / 2, s.x0 + s.l * 0.3, s.x0 + s.l * 0.7);
      const opts = [];
      for (const x of xs) {
        if (key && Math.abs(x - key.xc) < key.kd.l / 2) { opts.push(() => { sh.dimV(X(x), Y(-s.r), X(x), Y(s.r), X(x), txt, { textY: Y(key.kd.b / 2) + 1.2 }); s.xd = x; }); }
        else opts.push(() => { sh.dimV(X(x), Y(-s.r), X(x), Y(s.r), X(x), txt, { side: 'below' }); s.xd = x; });   // сверху — знаки шероховатости и допуски
      }
      const xm = xs[0];
      opts.push(() => { sh.dimV(X(xm), Y(-s.r), X(xm), Y(s.r), X(xm), txt, { out: 'below' }); s.xd = xm; s.outB = true; });
      opts.push(() => { sh.dimV(X(xm), Y(-s.r), X(xm), Y(s.r), X(xm), txt, { out: 'above' }); s.xd = xm; });
      sh.attempt(opts);
    });
    if (bi) {
      const { g, Rae, Rai, xs, xb, apex } = bi;
      sh.attempt([() => sh.dimV(X(xb), Y(-Rae), X(xb), Y(Rae), X(xb), `⌀${nf(g.da, 2)}h11`, { textY: Y(0) + 2 }), () => sh.dimV(X(xb), Y(-Rae), X(xb), Y(Rae), X(xb), `⌀${nf(g.da, 2)}h11`, { out: 'above' })]);
      sh.attempt([() => sh.dimV(X(xs), Y(-Rai), X(xs), Y(Rai), X(xs) - 8, `⌀${nf(2 * Rai, 1)}*`), () => sh.dimV(X(xs), Y(-Rai), X(xs), Y(Rai), X(xs) - 14, `⌀${nf(2 * Rai, 1)}*`)]);
      if (X(apex) > f.x1 + 8) sh.attempt([0.75, 0.55, 0.95].map(q => () => sh.dimAng(X(apex), Y(0), 0, g.delta, Math.max(16, (xs - apex) * k * q), deg(g.delta))));
      const ux = Math.cos(g.delta * D2R), uy = Math.sin(g.delta * D2R), nx = -uy, ny = ux;
      const p1 = [X(xs), Y(Rai)], p2 = [X(xb), Y(Rae)];
      sh.attempt([8, 14, 20].map(off => () => {
        sh.line(p1[0] + nx * 1, p1[1] + ny * 1, p1[0] + nx * (off + 2), p1[1] + ny * (off + 2), 2).line(p2[0] + nx * 1, p2[1] + ny * 1, p2[0] + nx * (off + 2), p2[1] + ny * (off + 2), 2);
        const q1 = [p1[0] + nx * off, p1[1] + ny * off], q2 = [p2[0] + nx * off, p2[1] + ny * off];
        sh.line(q1[0], q1[1], q2[0], q2[1], 2); sh.arrow(q1[0], q1[1], 180 + g.delta); sh.arrow(q2[0], q2[1], g.delta);
        sh.text((q1[0] + q2[0]) / 2 + nx * 0.8, (q1[1] + q2[1]) / 2 + ny * 0.8, nf(g.b, 1), { h: 3.5, ang: g.delta, anchor: 'cb' });
      }));
    }
    // ---------- базы
    for (const [s, letter] of dLet) sh.attempt([2, 9, 16, 23].map(len => () => sh.datum(X(s.xd), Y(-s.r), 270, letter, { len })));
    // ---------- пазы: длина и привязка сверху
    const yt = Y(rmax);
    keys.forEach(q => {
      sh.attempt([12, 20, 28].map(dy => () => sh.dimH(X(q.a), Y(q.kd.b / 2), X(q.b), Y(q.kd.b / 2), yt + dy, nf(q.kd.l, 1))));
      const off = q.a - q.s.x0;
      sh.attempt([20, 28, 12, 36].map(dy => () => sh.dimH(X(q.s.x0), Y(q.s.r), X(q.a), Y(q.kd.b / 2), yt + dy, nf(off, 1), { side: 'left' })));
    });
    // ---------- допуски формы и расположения
    const frames = [];
    segs.forEach(s => {
      if (s.role === 'bearing') frames.push({ s, cells: ['cyl', nf(tolCyl(s.d), 3)] });
      else if (s.role === 'hub') frames.push({ s, cells: ['rrun', nf(tolRun(s.d), 3), base2] });
      else if (s.role === 'out') frames.push({ s, cells: ['rrun', nf(tolRun(s.d, 1.25), 3), base2] });
      else if (s.role === 'seal') frames.push({ s, cells: ['rrun', nf(tolRun(s.d, 1.6), 3), base2] });
      else if (s.role === 'gear' && !isBev(s)) frames.push({ s, cells: ['rrun', nf(tolRun(s.gear.da, 2), 3), base2] });
    });
    if (bi) frames.push({ s: bev, bevel: true, cells: ['rrun', nf(tolRun(bi.g.da, 2), 3), base2] });
    segs.forEach((s, i) => {
      if (s.role !== 'bearing') return;
      const nb = [segs[i + 1], segs[i - 1]].find(q => q && q.r > s.r + 0.5 && !q.gear);
      if (nb) frames.push({ s, face: nb === segs[i + 1] ? 'R' : 'L', fr: (s.r + nb.r) / 2, cells: ['perp', nf(tolPerp(s.d), 3), base2] });
    });
    const yband = Math.max(sh.bbox(0).y2, yt + 8) + 4;
    frames.forEach(fr => {
      const s = fr.s;
      const W = 7 + fr.cells.slice(1).reduce((a, c) => a + tw(c, 3.5) + 3, 0);
      const opts = [];
      for (const dy of [0, 9, 18, 27, 36]) {
        const fy = yband + dy;
        if (fr.face) {
          const tx = X(fr.face === 'R' ? s.x1 : s.x0), ty = Y(fr.fr), dir = fr.face === 'R' ? -1 : 1;
          for (const dx of [8, 14, 22]) opts.push(() => { const att = tx + dir * dx; const x1 = att - 3.5; sh.tol(x1, fy, fr.cells, { from: 'b', fx: 3.5, via: [[att, ty]], to: [tx, ty] }); });
        } else {
          const ts = fr.bevel ? [0.6, 0.4] : [0.72, 0.6, 0.85, 0.45];
          for (const t of ts) {
            const xm = s.x0 + s.l * t, tx = X(xm), ty = fr.bevel ? Y(bi.Rai + (bi.Rae - bi.Rai) * t) : Y(s.r);
            for (const sx of [0, -W / 2 - 4, W / 2 + 4]) opts.push(() => {
              const x1 = tx - W / 2 + sx, att = Math.min(Math.max(tx, x1 + 3), x1 + W - 3);
              const via = Math.abs(att - tx) > 0.5 ? [[att, fy - 4], [tx, fy - 4]] : [];
              sh.tol(x1, fy, fr.cells, { from: 'b', fx: att - x1, via, to: [tx, ty + 0.2] });
            });
          }
        }
      }
      sh.attempt(opts);
    });
    // ---------- фаски
    {
      const s = last.cR ? last : segs[0], c = s === last ? last.cR : segs[0].cL;
      if (c) {
        const px = s === last ? X(L - c / 2) : X(c / 2), py = Y(s.r - c / 2);
        const two = segs[0].cL && last.cR && Math.abs(segs[0].cL - last.cR) < 1e-6;
        const sd = s === last ? 1 : -1;
        sh.attempt([[10, 5], [5, 12], [14, 4], [6, 18]].map(([dx, dy]) => () => sh.leader(px, py, px + sd * dx, Y(s.r) + dy, `${nf(c, 1)}×45°`, two ? '2 фаски' : '', { side: sd > 0 ? 'r' : 'l' })));
      }
    }
    // ---------- обозначения выносных элементов: канавка у заплечика, профиль витков червяка
    const details = [];
    const freeL = letters.slice(keys.length);
    const gs = segs.find(q => q.groove);
    if (gs) {
      const gx = gs.groove.side === 'R' ? gs.x1 : gs.x0, cx = X(gx), cy = Y(gs.r);
      const L1 = freeL[details.length];
      sh.circle(cx, cy, 5, 2);
      sh.attempt([[-9, 9], [9, 9], [-12, 14], [12, 14]].map(([dx, dy]) => () => { const a = Math.atan2(dy, dx); sh.line(cx + 5 * Math.cos(a), cy + 5 * Math.sin(a), cx + dx, cy + dy, 2); sh.line(cx + dx, cy + dy, cx + dx + (dx > 0 ? 7 : -7), cy + dy, 2); sh.text(cx + dx + (dx > 0 ? 1 : -6), cy + dy + 0.9, L1, { h: 5 }); }));
      details.push({ type: 'groove', s: gs, L: L1, n: segs.filter(q => q.groove).length });
    }
    const wm = segs.find(q => q.gear && q.gear.kind === 'worm');
    if (wm) {
      const cx = X((wm.x0 + wm.x1) / 2 + wm.l * 0.2), cy = Y(wm.r - (wm.r - wm.gear.df / 2) / 2);
      const L1 = freeL[details.length];
      sh.circle(cx, cy, Math.max(6, (wm.r - wm.gear.df / 2) * k * 0.9), 2);
      const rr = Math.max(6, (wm.r - wm.gear.df / 2) * k * 0.9);
      sh.attempt([[10, 12], [-10, 12], [14, 18]].map(([dx, dy]) => () => { const a = Math.atan2(dy, dx); sh.line(cx + rr * Math.cos(a), cy + rr * Math.sin(a), cx + dx + rr * Math.cos(a), cy + dy + rr * Math.sin(a), 2); const ex = cx + dx + rr * Math.cos(a), ey = cy + dy + rr * Math.sin(a); sh.line(ex, ey, ex + (dx > 0 ? 7 : -7), ey, 2); sh.text(ex + (dx > 0 ? 1 : -6), ey + 0.9, L1, { h: 5 }); }));
      details.push({ type: 'worm', s: wm, L: L1 });
    }
    return { keys, v, X, Y, details };
  }

  /* лист рабочего чертежа вала: подбор формата, масштаба и положения */
  function primBox(sh, q) {
    if (q.t === 'L') return { x1: Math.min(q.a[0], q.a[2]), y1: Math.min(q.a[1], q.a[3]), x2: Math.max(q.a[0], q.a[2]), y2: Math.max(q.a[1], q.a[3]) };
    if (q.t === 'T') return sh.textRect(q, 0);
    if (q.t === 'C' || q.t === 'A') return { x1: q.a[0] - q.a[2], y1: q.a[1] - q.a[2], x2: q.a[0] + q.a[2], y2: q.a[1] + q.a[2] };
    if (q.t === 'H') { let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity; for (let i = 0; i < q.l.length; i += 2) { x1 = Math.min(x1, q.l[i]); x2 = Math.max(x2, q.l[i]); y1 = Math.min(y1, q.l[i + 1]); y2 = Math.max(y2, q.l[i + 1]); } return { x1, y1, x2, y2 }; }
    return null;
  }
  function shiftPrim(q, dx, dy) {
    const c = Object.assign({}, q);
    if (q.t === 'L') c.a = [q.a[0] + dx, q.a[1] + dy, q.a[2] + dx, q.a[3] + dy];
    else if (q.t === 'C' || q.t === 'A' || q.t === 'T') { c.a = q.a.slice(); c.a[0] += dx; c.a[1] += dy; }
    else if (q.t === 'K') { c.pts = q.pts.map(p => [p[0] + dx, p[1] + dy]); }
    else if (q.t === 'H') { c.l = q.l.map((v, i) => v + (i % 2 ? dy : dx)); c.rings = q.rings.map(r => r.map(p => [p[0] + dx, p[1] + dy])); }
    return c;
  }
  /* разместить готовую группу примитивов (нарисованную у начала координат) на листе без наложений */
  function placeGroup(sh, prims, o) {
    o = o || {};
    const boxes = prims.map(q => primBox(sh, q)).filter(Boolean);
    let gx1 = Infinity, gy1 = Infinity, gx2 = -Infinity, gy2 = -Infinity;
    boxes.forEach(b => { gx1 = Math.min(gx1, b.x1); gy1 = Math.min(gy1, b.y1); gx2 = Math.max(gx2, b.x2); gy2 = Math.max(gy2, b.y2); });
    const f = sh.frame, occ = sh.occ || [];
    const cand = [];
    if (o.fixY !== undefined) { for (let x = f.x1 + 3 - gx1; x + gx2 <= f.x2 - 3; x += 2) cand.push([x, o.fixY]); }
    else for (let y = f.y2 - 3 - gy2; y + gy1 >= f.y1 + 3; y -= 4) { if (o.fixX !== undefined) { cand.push([o.fixX, y]); continue; } for (let x = f.x1 + 3 - gx1; x + gx2 <= f.x2 - 3; x += 4) cand.push([x, y]); }
    if (o.near) cand.sort((p, q) => Math.hypot(p[0] + (gx1 + gx2) / 2 - o.near[0], p[1] + (gy1 + gy2) / 2 - o.near[1]) - Math.hypot(q[0] + (gx1 + gx2) / 2 - o.near[0], q[1] + (gy1 + gy2) / 2 - o.near[1]));
    for (const [dx, dy] of cand) {
      const R = { x1: gx1 + dx, y1: gy1 + dy, x2: gx2 + dx, y2: gy2 + dy };
      if (R.x1 < f.x1 + 1 || R.x2 > f.x2 - 1 || R.y1 < f.y1 + 1 || R.y2 > f.y2 - 1) continue;
      const near = occ.filter(z => overlaps(R, z));
      if (near.length && boxes.some(b => { const bb = { x1: b.x1 + dx, y1: b.y1 + dy, x2: b.x2 + dx, y2: b.y2 + dy }; return near.some(z => overlaps(bb, z)); })) continue;
      prims.forEach(q => sh.p.push(shiftPrim(q, dx, dy)));
      boxes.forEach(b => sh.occupy({ x1: b.x1 + dx, y1: b.y1 + dy, x2: b.x2 + dx, y2: b.y2 + dy }, 1.5));
      return { dx, dy, box: R };
    }
    return null;
  }
  function shaftSheet(pd, info) {
    const segs = prepSegs(pd);
    const notes = info.notes || [];
    const plan = [];
    for (const kk of [2, 1]) for (const fmt of ['A3', 'A2']) plan.push([fmt, kk]);
    for (const kk of [0.5, 0.4, 0.25, 0.2]) for (const fmt of ['A3', 'A2']) plan.push([fmt, kk]);
    for (const [fmt, k] of plan) {
      const tmp = new Sheet('A1', true); tmp.frame = { x1: -5000, y1: -5000, x2: 5000, y2: 5000 };
      const M = shaftMain(tmp, segs, 0, 0, k, info);
      const mb = tmp.bbox(0);
      if (k === 2 && segs[segs.length - 1].x1 > 140) continue;
      for (const ttPos of ['stamp', 'left']) {
        const sh = new Sheet(fmt, true);
        if (mb.x2 - mb.x1 > sh.frame.x2 - sh.frame.x1 - 6 || mb.y2 - mb.y1 > sh.frame.y2 - sh.frame.y1 - 6) break;
        setupSheet(sh, info, notes, ttPos);
        const pl = placeGroup(sh, tmp.p, { near: [sh.frame.x1 + (mb.x2 - mb.x1) / 2 + 10, sh.frame.y2 - (mb.y2 - mb.y1) / 2 - 10] });
        if (!pl) continue;
        let ok = true;
        for (const q of M.keys) {
          let ks = k;
          for (const [kk] of SCALES) { if (kk * q.s.d <= 46 && kk >= k) { ks = kk; break; } }
          const R = q.s.r * ks;
          const t2 = new Sheet('A1', true); t2.frame = tmp.frame;
          keySection(t2, 0, 0, R, ks, q, q.L, ks !== k ? scaleText(ks) : '', info.task);
          if (!placeGroup(sh, t2.p, { near: [M.X(q.xc) + pl.dx, M.Y(0) + pl.dy - 70] })) { ok = false; break; }
        }
        if (!ok) continue;
        for (const dt of M.details) {
          const t3 = new Sheet('A1', true); t3.frame = tmp.frame;
          if (dt.type === 'groove') grooveDetail(t3, dt.s, dt.L); else wormProfile(t3, dt.s.gear, dt.L);
          if (!placeGroup(sh, t3.p, { near: [M.X(dt.s.x0) + pl.dx, M.Y(0) + pl.dy - 60] })) { ok = false; break; }
        }
        if (!ok) continue;
        return { sh, scale: scaleText(k), k, fmt };
      }
    }
    return null;
  }
  /* выносной элемент: канавка для выхода шлифовального круга у заплечика (масштаб 4:1) */
  function grooveDetail(sh, s, L1) {
    const g = s.groove, K = g.h < 0.3 ? 10 : 8, k = 4 * (g.b <= 3 ? 1.25 : 1);
    const ks = g.b <= 3 ? 5 : 4;
    const dir = g.side === 'R' ? 1 : -1;   // заплечик справа (1) или слева (-1)
    const P = (x, y) => [dir * x * ks, y * ks];
    const H = Math.min(g.H, 4), Ls = g.b + 4;
    // контур: посадочная поверхность, канавка со скруглением, торец заплечика, фаска заплечика
    const R = g.R;
    const pts = [P(-Ls, 0), P(-g.b, 0), P(-g.b, -g.h)];
    // скругление в углу канавки у торца заплечика
    for (let i = 0; i <= 6; i++) { const a = (180 + 90 * i / 6) * D2R; pts.push(P(-Math.min(R, g.b * 0.5) + Math.min(R, g.b * 0.5) * Math.cos(a) * 0, 0)); }
    pts.length = 3;
    pts.push(P(-Math.min(R * 0.5, g.b * 0.4), -g.h));
    const rr = Math.min(R * 0.5, g.b * 0.4);
    for (let i = 1; i <= 6; i++) { const a = (270 + 90 * i / 6) * D2R; pts.push(P(-rr + rr * Math.cos(a) + rr * 0, -g.h + rr + rr * Math.sin(a))); }
    pts.push(P(0, H - 1), P(1, H), P(4, H));
    for (let i = 0; i + 1 < pts.length; i++) sh.line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], 1);
    // линия обрыва (волнистая) снизу
    const wave = [];
    for (let i = 0; i <= 16; i++) { const x = -Ls + (Ls + 4) * i / 16; wave.push(P(x, -2.2 + 0.35 * Math.sin(i * 1.4))); }
    for (let i = 0; i + 1 < wave.length; i++) sh.line(wave[i][0], wave[i][1], wave[i + 1][0], wave[i + 1][1], 2);
    sh.line(P(-Ls, 0)[0], P(-Ls, 0)[1], wave[0][0], wave[0][1], 2); sh.line(P(4, H)[0], P(4, H)[1], wave[16][0], wave[16][1], 2);
    // размеры
    const a = P(-g.b, 0), b = P(0, 0);
    { const yH = P(0, H)[1], sg = Math.sign(yH - P(0, -g.h)[1]) || 1; sh.dimH(Math.min(a[0], b[0]), a[1], Math.max(a[0], b[0]), b[1], yH + sg * 7, nf(g.b, 1)); }
    const c = P(-g.b / 2, -g.h), d = P(-g.b / 2, 0);
    sh.dimV(c[0], c[1], d[0], d[1], Math.min(a[0], b[0]) - 6, nf(g.h, 2), { noExt1: false });
    const q = P(-rr, -g.h + rr * 0.3);
    sh.leader(q[0], q[1], q[0] + dir * 10, q[1] - 9, `R${nf(R * 0.5 >= 0.5 ? Math.min(R * 0.5, g.b * 0.4) : 0.5, 1)}`, '', { side: dir > 0 ? 'r' : 'l' });
    const t = P(0, H - 0.5);
    sh.leader(t[0], t[1], t[0] + dir * 5, t[1] + 12, `R${nf(R, 1)} max`, '', { side: dir > 0 ? 'r' : 'l' });
    const bb = sh.bbox(0);
    sh.text((bb.x1 + bb.x2) / 2, bb.y2 + 4, `${L1} (${ks}:1)`, { h: 7, anchor: 'cb' });
    void K; void k;
  }
  /* выносной элемент: профиль витков червяка в осевом сечении */
  function wormProfile(sh, g, L1) {
    const m = g.m, p = Math.PI * m, ha = m, hf = 1.2 * m, ks = m <= 4 ? 4 : m <= 8 ? 2.5 : 2;
    const rp = 0, a = 20 * D2R;
    const P = (x, y) => [x * ks, y * ks];
    const n = 3, x0 = -n * p / 2;
    // витки: трапеции, s = p/2 на делительной прямой
    const ring = [];
    const top = ha, bot = -hf;
    const pts = [];
    for (let i = 0; i < n; i++) {
      const xc = x0 + p / 2 + i * p, s2 = p / 4;
      pts.push([xc - s2 - hf * Math.tan(a), bot], [xc - s2 + ha * Math.tan(a), top], [xc + s2 - ha * Math.tan(a), top], [xc + s2 + hf * Math.tan(a), bot]);
    }
    const prof = [[x0, bot]].concat(pts).concat([[x0 + n * p, bot]]);
    const body = prof.concat([[x0 + n * p, bot - 1.2 * m], [x0, bot - 1.2 * m]]);
    for (let i = 0; i + 1 < prof.length; i++) { const A = P(...prof[i]), B = P(...prof[i + 1]); sh.line(A[0], A[1], B[0], B[1], 1); }
    // линия обрыва снизу и по краям
    const wave = [];
    for (let i = 0; i <= 20; i++) { const x = x0 + n * p * i / 20; wave.push(P(x, bot - 1.2 * m + 0.25 * m * Math.sin(i * 1.3))); }
    for (let i = 0; i + 1 < wave.length; i++) sh.line(wave[i][0], wave[i][1], wave[i + 1][0], wave[i + 1][1], 2);
    { const A = P(x0, bot), B = wave[0]; sh.line(A[0], A[1], B[0], B[1], 2); const C = P(x0 + n * p, bot), D = wave[20]; sh.line(C[0], C[1], D[0], D[1], 2); }
    sh.hatch([prof.map(q => P(q[0], q[1])).concat(wave.slice().reverse())], { ang: 45, step: 2 });
    // делительная прямая
    { const A = P(x0 - 2, rp), B = P(x0 + n * p + 2, rp); sh.line(A[0], A[1], B[0], B[1], 3); }
    // размеры: шаг, угол профиля, высоты
    const xc1 = x0 + p / 2, xc2 = xc1 + p;
    const A1 = P(xc1, 0), A2 = P(xc2, 0);
    sh.dimH(A1[0], P(0, top)[1], A2[0], P(0, top)[1], P(0, top)[1] + 10, `${nf(p, 3)}±0,02`);
    sh.line(A1[0], A1[1], A1[0], P(0, top)[1] + 12, 2); sh.line(A2[0], A2[1], A2[0], P(0, top)[1] + 12, 2);
    // угол профиля 40°: боковые стороны последнего витка продолжены до пересечения над вершиной
    {
      const xc = x0 + p / 2 + (n - 1) * p, s2 = p / 4;
      const cl = [xc - s2 + ha * Math.tan(a), top], cr = [xc + s2 - ha * Math.tan(a), top];
      const ay = top + (s2 - ha * Math.tan(a)) / Math.tan(a);
      const A = P(xc, ay), CL = P(...cl), CR = P(...cr);
      const ext = 0.5;
      sh.line(CL[0], CL[1], A[0] + (A[0] - CL[0]) * ext, A[1] + (A[1] - CL[1]) * ext, 2);
      sh.line(CR[0], CR[1], A[0] + (A[0] - CR[0]) * ext, A[1] + (A[1] - CR[1]) * ext, 2);
      const R0 = Math.hypot(A[0] - CL[0], A[1] - CL[1]) * 0.42;
      sh.dimAng(A[0], A[1], 70, 110, R0, '40°');
    }
    const H0 = P(x0 + n * p, top), H1 = P(x0 + n * p, bot), H2 = P(x0 + n * p, 0);
    sh.dimV(H2[0], H2[1], H0[0], H0[1], H0[0] + 8, nf(ha, 2));
    sh.dimV(H1[0], H1[1], H2[0], H2[1], H0[0] + 16, nf(hf, 2));
    sh.text(P(x0 + n * p / 2, 0)[0], P(0, top)[1] + 26, `${L1} (${scaleText(ks)})`, { h: 7, anchor: 'cb' });
    void ring;
  }
  function hitsPrims(sh, from, r) {
    for (const q of sh.p.slice(from)) {
      if (q.t === 'L') { if (Math.max(q.a[0], q.a[2]) > r.x1 && Math.min(q.a[0], q.a[2]) < r.x2 && Math.max(q.a[1], q.a[3]) > r.y1 && Math.min(q.a[1], q.a[3]) < r.y2) return true; }
      else if (q.t === 'T') { const t = sh.textRect(q); if (overlaps(t, r)) return true; }
      else if (q.t === 'C' || q.t === 'A') { if (q.a[0] + q.a[2] > r.x1 && q.a[0] - q.a[2] < r.x2 && q.a[1] + q.a[2] > r.y1 && q.a[1] - q.a[2] < r.y2) return true; }
    }
    return false;
  }
  /* общая подготовка листа детали: занятые зоны, шероховатость в углу, таблица, ТТ */
  function setupSheet(sh, info, notes, ttPos) {
    const f = sh.frame;
    sh.occupy(sh.stamp, 2); sh.occupy(sh.reserved(), 2);
    sh.roughCorner(info.raRest || 'Ra 6,3');
    const cx2 = sh.landscape ? f.x2 : f.x2 - 14;
    sh.occupy({ x1: cx2 - 62, y1: f.y2 - 28, x2: cx2, y2: f.y2 }, 0);
    if (info.table) { const r = gearTable(sh, info.table, sh.landscape ? f.y2 - 23 : f.y2 - 73); sh.occupy(r, 3); }
    const ttH = notesHeight(notes, 180);
    let ttR = ttPos === 'left' ? { x1: f.x1 + 5, y1: f.y1 + 4, x2: f.x1 + 190, y2: f.y1 + 4 + ttH } : { x1: sh.stamp.x1, y1: sh.stamp.y2 + 5, x2: sh.stamp.x2 - 3, y2: sh.stamp.y2 + 5 + ttH };
    if (!sh.free(ttR)) ttR = { x1: sh.stamp.x1, y1: sh.stamp.y2 + 5, x2: sh.stamp.x2 - 3, y2: sh.stamp.y2 + 5 + ttH };
    sh.notes(ttR.x1 + 2, ttR.y1 + 1.5, 180, notes);
    sh.occupy(ttR, 2);
  }

  /* сечение вала по шпоночному пазу */
  function keySection(sh, cx, cy, R, ks, q, Lt, sc, task) {
    const b = q.kd.b * ks, t1 = q.kd.t1 * ks;
    const yk = cy + R - t1;
    const ang = Math.asin(Math.min(1, (b / 2) / R)) / D2R;
    sh.arc(cx, cy, R, 90 + ang, 90 - ang + 360, 1);
    const yTop = cy + Math.sqrt(R * R - b * b / 4);
    sh.line(cx - b / 2, yTop, cx - b / 2, yk, 1).line(cx - b / 2, yk, cx + b / 2, yk, 1).line(cx + b / 2, yk, cx + b / 2, yTop, 1);
    const ring = [];
    for (let i = 0; i <= 72; i++) { const a = (90 + ang) + (360 - 2 * ang) * i / 72; ring.push([cx + R * Math.cos(a * D2R), cy + R * Math.sin(a * D2R)]); }
    ring.push([cx + b / 2, yTop], [cx + b / 2, yk], [cx - b / 2, yk], [cx - b / 2, yTop]);
    sh.hatch([ring], { ang: 45, step: R > 25 ? 3 : 2 });
    sh.line(cx - R - 3, cy, cx + R + 3, cy, 3).line(cx, cy - R - 3, cx, cy + R + 3, 3);
    sh.dimH(cx - b / 2, yTop, cx + b / 2, yTop, cy + R + 7, nf(q.kd.b, 0) + keyFit(task)[0]);
    sh.dimV(cx + b / 2, yk, cx + b / 2, yTop, cx + R + 6, nf(q.kd.t1, 1) + '^' + keyT1tol(q.kd.h));
    sh.rough(cx - b / 2 - 0.2, yk + (yTop - yk) * 0.5, 'Ra 3,2', { h: 2.5, rot: 90 });
    sh.text(cx, cy + R + 17, `${Lt}–${Lt}` + (sc ? ` (${sc})` : ''), { h: 7, anchor: 'cb' });
  }

  function notesHeight(items, width) {
    let n = 0; items.forEach(it => { n += C.wrap(String(it).replace(/^\s*\d+\.\s/, ''), width - 6, 3.5).length; });
    return n * 3.5 * 1.65 + 2;
  }


  /* ================================================================ КОЛЁСА */
  /* верхняя половина осевого сечения: возвращает { pieces: [многоугольники], pitch, extra } в мм детали (ось — X) */
  function wheelProfile(g, kind) {
    const rb = g.dbore / 2, rh = g.dst / 2, hl = g.lst / 2;
    const kb = g.key ? g.key.t2 : 0;
    const cb = chamf(g.dbore), ch = 1.6;
    if (kind === 'bevel') {
      const dl = g.delta * D2R, ux = Math.cos(dl), uy = Math.sin(dl), nx = -uy, ny = ux;
      const Re = g.Re, b = g.b, ha = g.mte, hf = 1.2 * g.mte, sR = 2.5 * g.mte + 3;
      const Pe = [Re * ux, Re * uy], Pi = [(Re - b) * ux, (Re - b) * uy], q = (Re - b) / Re;
      const Te = [Pe[0] + ha * nx, Pe[1] + ha * ny], Ti = [Pi[0] + ha * q * nx, Pi[1] + ha * q * ny];
      const Be = [Pe[0] - (hf + sR) * nx, Pe[1] - (hf + sR) * ny], Bi = [Pi[0] - (hf + sR) * nx, Pi[1] - (hf + sR) * ny];
      // зубчатый венец: ось X — от вершины конуса; диск — от точки Bi до Be по X
      const xF = Bi[0], xB = Be[0], xc = (xF + xB) / 2;
      let h0 = xc - hl, h1 = xc + hl;
      if (h0 > xF) h0 = xF; if (h1 < xB) h1 = xB;
      const yLow = Math.min(Bi[1], Be[1]);
      const up = [[h0 + cb, rb + kb], [h1 - cb, rb + kb], [h1, rb + kb + cb], [h1, rh - ch], [h1 - ch, rh], [xB, rh], [xB, Be[1]], Be, Te, Ti, Bi, [xF, rh], [h0 + ch, rh], [h0, rh - ch], [h0, rb + kb + cb]];
      const lo = up.map((p, i) => i < 3 || i > 12 ? p : p).map(([x, y]) => [x, y]);
      void lo; void yLow;
      const apex = [0, 0];
      return { pieces: [up], tip: [Ti, Te], pitch: [[Pi[0] - 0.15 * b * ux, Pi[1] - 0.15 * b * uy], [Pe[0] + 3 * ux, Pe[1] + 3 * uy]], apex, x0: h0, x1: h1, hl: (h1 - h0) / 2, cb, ch, he: (xB - xF) / 2, hb: (xB - xF) / 2, rmax: Math.max(Te[1], Be[1]), rb, rh, kb, bevel: { Pe, Pi, Te, Ti, Be, Bi, xB, xF, dl } };
    }
    const ra = (kind === 'sprocket' ? g.De : kind === 'wormwheel' ? g.daM : g.da) / 2;
    const b = g.b, hb = b / 2;
    const rr = kind === 'sprocket' ? Math.max(rh + 3, (g.dd - g.d1) / 2 - 0.15 * g.t - 3) : Math.max(rh + 3, g.df / 2 - (g.d0 && g.d0 > 3 ? g.d0 : 2.5 * g.m));
    const he = kind === 'sprocket' ? Math.min(hb, Math.max(hb * 0.6, 8)) : (g.e || Math.max(0.3 * b, 8)) / 2;
    const cr = kind === 'sprocket' ? Math.min(0.2 * b, 3) : Math.min(0.5 * g.m, 3);
    // верх венца
    let top;
    if (kind === 'wormwheel') {
      const R = g.Ra, yc = g.aw, pts = [];
      for (let i = 0; i <= 12; i++) { const x = hb - i * b / 12; pts.push([x, Math.min(yc - Math.sqrt(Math.max(R * R - x * x, 0)), ra)]); }
      top = [[hb, Math.min(ra, pts[0][1]) - cr]].concat(pts.map(p => p)).concat([[-hb, Math.min(ra, pts[12][1]) - cr]]);
      top[1] = [hb - cr * 0.6, top[1][1]]; top[top.length - 2] = [-hb + cr * 0.6, top[top.length - 2][1]];
    } else if (kind === 'sprocket') {
      const rt = ra, f = 0.25 * b;
      top = [[hb, rt - 2.2 * f], [hb - f * 0.6, rt - f * 0.6], [hb - f, rt], [-hb + f, rt], [-hb + f * 0.6, rt - f * 0.6], [-hb, rt - 2.2 * f]];
    } else top = [[hb, ra - cr], [hb - cr, ra], [-hb + cr, ra], [-hb, ra - cr]];
    // отверстия в диске
    let holes = null;
    const Do = 2 * rr;
    if (kind !== 'sprocket' && g.holes === true && Do - g.dst > 60 && he * 2 < b - 4) {   // облегчающие отверстия в диске — только по явному выбору: в [М] колёса без отверстий
      const d = Math.round((Do - g.dst) / 4 / 2) * 2, Dc = Math.round((Do + g.dst) / 2);
      if (d >= 12) holes = { d, Dc, n: Do > 300 ? 6 : 4 };
    }
    const hubU = [[-hl + cb, rb + kb], [hl - cb, rb + kb], [hl, rb + kb + cb], [hl, rh - ch], [hl - ch, rh]];
    const hubD = [[-hl + ch, rh], [-hl, rh - ch], [-hl, rb + kb + cb]];
    const rimU = [[he, rr], [hb, rr]].concat(top).concat([[-hb, rr], [-he, rr]]);
    let pieces;
    const thinHub = he >= hl - 0.1;
    if (thinHub) {
      // ступица не выступает (звёздочка, узкое колесо): сплошной диск
      const H = Math.max(hl, hb);
      pieces = [[[-H + cb, rb + kb], [H - cb, rb + kb], [H, rb + kb + cb]].concat(top.map(p => [Math.sign(p[0]) * Math.max(Math.abs(p[0]), 0), p[1]])).concat([[-H, rb + kb + cb]])];
      if (hl > hb) {
        pieces = [[[-hl + cb, rb + kb], [hl - cb, rb + kb], [hl, rb + kb + cb], [hl, rh - ch], [hl - ch, rh], [hb, rh]].concat([[hb, rh]]).concat(top).concat([[-hb, rh], [-hl + ch, rh], [-hl, rh - ch], [-hl, rb + kb + cb]])];
      }
    } else if (holes) {
      const y1 = holes.Dc / 2 - holes.d / 2, y2 = holes.Dc / 2 + holes.d / 2;
      pieces = [hubU.concat([[he, rh], [he, y1], [-he, y1], [-he, rh]]).concat(hubD), [[he, y2], [he, rr], [hb, rr]].concat(top).concat([[-hb, rr], [-he, rr], [-he, y2]])];
    } else {
      pieces = [hubU.concat([[he, rh]]).concat(rimU).concat([[-he, rh]]).concat(hubD)];
    }
    return { pieces, top, x0: -Math.max(hl, hb), x1: Math.max(hl, hb), rmax: ra, rb, rh, rr, hb, he, hl, kb, holes, cr, cb, ch, pitchR: kind === 'sprocket' ? g.dd / 2 : g.d / 2 };
  }

  function wheelMain(sh, g, kind, k, info) {
    const P = wheelProfile(g, kind);
    const v = new View(sh, 0, 0, k), X = x => v.X(x), Y = y => v.Y(y);
    // контур и штриховка: верх (с пазом) и низ (без паза)
    const lowPieces = P.pieces.map(pc => pc.map(([x, y]) => [x, y === P.rb + P.kb ? P.rb : (Math.abs(y - (P.rb + P.kb + P.cb)) < 1e-9 ? P.rb + P.cb : y)]));
    P.pieces.forEach(pc => v.poly(pc, 1));
    lowPieces.forEach(pc => v.poly(pc.map(([x, y]) => [x, -y]), 1));
    sh.hatch(v.rings(P.pieces.concat(lowPieces.map(pc => pc.map(([x, y]) => [x, -y])))), { ang: 45, step: 2.5 + (k < 1 ? 0 : 0.5) });
    // линии: торцы ступицы между верхом и низом не проходят — отверстие; фаска отверстия — видимая кромка
    v.line(P.x0 - 6 / k, 0, P.x1 + 6 / k, 0, 3);
    // делительная окружность (линия) по ГОСТ 2.402
    if (kind === 'bevel') {
      const bv = P.bevel;
      for (const sg of [1, -1]) v.line(P.pitch[0][0], sg * P.pitch[0][1], P.pitch[1][0], sg * P.pitch[1][1], 3);
      void bv;
    } else for (const sg of [1, -1]) v.line(-P.hb - 3 / k, sg * P.pitchR, P.hb + 3 / k, sg * P.pitchR, 3);
    // невидимая линия дна паза в нижней половине не нужна (паз в разрезе виден сверху)
    // ---------- размеры
    const base = 'А';
    const rb = P.rb, rh = P.rh;
    const xr = P.x1, xl = P.x0;
    // ⌀ отверстия H7 — внутри, у левого торца ступицы; база А — на продолжении
    const xd = xl + Math.min(P.hl * 0.35, 10 / k);
    sh.dimHalfV(X(xd), Y(-rb), Y(0) + Math.max(8, 0.35 * (Y(rb) - Y(0))), `⌀${nf(g.dbore, 2)}H7`);
    sh.attempt([2, 8, 14].map(len => () => sh.datum(X(xd), Y(-rb), 270, base, { len }) ));
    // ⌀ ступицы
    const yHubDim = Y(0);
    void yHubDim;
    if (kind !== 'bevel' || true) sh.attempt([0.75, 0.6, 0.9].map(t => () => sh.dimV(X(xl + (P.hl - (P.he || 0)) * t * 0), Y(-rh), X(xl), Y(rh), X(xl) - 10, `⌀${nf(g.dst, 1)}`)).concat([() => sh.dimV(X(xl), Y(-rh), X(xl), Y(rh), X(xl) - 18, `⌀${nf(g.dst, 1)}`)]));
    // ⌀ вершин и др. диаметры — справа
    const tipD = kind === 'sprocket' ? g.De : kind === 'wormwheel' ? g.daM : kind === 'bevel' ? g.dae : g.da;
    const rTip = kind === 'bevel' ? P.bevel.Te[1] : P.rmax;
    const xTip = kind === 'bevel' ? P.bevel.Te[0] : (kind === 'wormwheel' ? P.hb - P.cr : P.hb - P.cr);
    const dimsR = [];
    dimsR.push({ y: rTip, x: xTip, t: `⌀${nf(tipD, 2)}${kind === 'sprocket' ? '' : 'h11'}` });
    if (kind === 'wormwheel') dimsR.push({ y: g.da / 2, x: 0, t: `⌀${nf(g.da, 2)}` });
    if (kind === 'sprocket') dimsR.push({ y: (g.dd - g.d1) / 2, x: P.hb, t: `⌀${nf(g.dd - g.d1, 2)}` });
    if (kind === 'bevel') dimsR.push({ y: P.bevel.Be[1], x: P.bevel.Be[0], t: `⌀${nf(2 * P.bevel.Be[1], 1)}*` });
    if (P.holes) dimsR.push({ y: P.holes.Dc / 2, x: P.he, t: `⌀${nf(P.holes.Dc, 0)}`, axis: true });
    if (!P.holes && kind === 'wheel' && P.rr) dimsR.push({ y: P.rr, x: P.hb, t: `⌀${nf(2 * P.rr, 1)}*` });
    dimsR.sort((a, b) => a.y - b.y);
    let xdim = X(xr) + 10;
    dimsR.forEach(d => {
      sh.attempt([0, 7, 14, 21].map(dx => () => sh.dimV(X(d.x), Y(-d.y), X(d.x), Y(d.y), xdim + dx, d.t)));
      xdim += 8;
    });
    // ширины снизу: lст, b, e
    const yb = Y(-P.rmax);
    const rowsW = [yb - 12, yb - 20, yb - 28, yb - 36];
    const hdims = [];
    if (kind !== 'bevel') {
      hdims.push([P.x0 === -P.hl ? -P.hl : P.x0, P.x0 === -P.hl ? P.x1 : P.x1, nf(g.lst, 1), -rh]);
      if (Math.abs(P.hb - P.hl) > 0.5) hdims.push([-P.hb, P.hb, nf(g.b, 1), -P.rmax + P.cr + 1]);
      if (P.he && P.he < P.hb - 0.5 && kind !== 'sprocket') {
        const yd = P.holes ? (P.rh + P.holes.Dc / 2 - P.holes.d / 2) / 2 : (P.rh + P.rr) / 2;
        sh.attempt([1, -1].map(sg => () => sh.dimH(X(-P.he), Y(sg * yd), X(P.he), Y(sg * yd), Y(sg * yd), nf(2 * P.he, 1))));
      }
    } else {
      hdims.push([P.x0, P.x1, nf(P.x1 - P.x0, 1), -rh]);
      hdims.push([P.bevel.xF, P.bevel.xB, nf(P.bevel.xB - P.bevel.xF, 1) + '*', -P.bevel.Bi[1]]);
    }
    hdims.sort((a, b) => (a[1] - a[0]) - (b[1] - b[0]));
    hdims.forEach(([a, b, t, y]) => sh.attempt(rowsW.map(yy => () => sh.dimH(X(a), Y(y), X(b), Y(y), yy, t)).concat(rowsW.map(yy => () => sh.dimH(X(a), Y(y), X(b), Y(y), yy, t, { side: 'left' })))));
    // конус: ширина венца b по образующей, угол конуса
    if (kind === 'bevel') {
      const bv = P.bevel, ux = Math.cos(bv.dl), uy = Math.sin(bv.dl), nx = -uy, ny = ux;
      const p1 = [X(bv.Ti[0]), Y(bv.Ti[1])], p2 = [X(bv.Te[0]), Y(bv.Te[1])];
      const a = Math.atan2(uy, ux) / D2R;
      sh.attempt([8, 13, 18].map(off => () => {
        sh.line(p1[0] + nx, p1[1] + ny, p1[0] + nx * (off + 2), p1[1] + ny * (off + 2), 2).line(p2[0] + nx, p2[1] + ny, p2[0] + nx * (off + 2), p2[1] + ny * (off + 2), 2);
        const q1 = [p1[0] + nx * off, p1[1] + ny * off], q2 = [p2[0] + nx * off, p2[1] + ny * off];
        sh.line(q1[0], q1[1], q2[0], q2[1], 2); sh.arrow(q1[0], q1[1], 180 + a); sh.arrow(q2[0], q2[1], a);
        sh.text((q1[0] + q2[0]) / 2 + nx * 0.8, (q1[1] + q2[1]) / 2 + ny * 0.8, nf(g.b, 1), { h: 3.5, ang: a - 180 < -90 ? a : a - 180, anchor: 'cb' });
      }));
      // угол конуса вершин δa — между образующей конуса вершин и осью (вершина угла — внешняя точка венца)
      const aTip = Math.atan2(bv.Ti[1] - bv.Te[1], bv.Ti[0] - bv.Te[0]) / D2R, dA = Math.atan2(bv.Te[1] - bv.Ti[1], bv.Te[0] - bv.Ti[0]) / D2R;
      const a1 = Math.min(180, (aTip + 360) % 360), a2 = Math.max(180, (aTip + 360) % 360);
      sh.attempt([14, 20, 26].map(Rd => () => sh.dimAng(p2[0], p2[1], a1, a2, Rd, deg(dA))));
      // базовое расстояние: от опорного торца ступицы до плоскости внешней делительной окружности
      sh.attempt(rowsW.map(yy => () => sh.dimH(X(P.x1), Y(-rh), X(bv.Pe[0]), Y(-bv.Pe[1]), yy - 8, nf(Math.abs(P.x1 - bv.Pe[0]), 1))));
      // угол делительного конуса — от оси
      const Rr = Math.hypot(bv.Pi[0], bv.Pi[1]) * k * 0.6;
      const ap = [X(0), Y(0)];
      void ap; void Rr;
    }
    if (kind === 'wormwheel') {
      // радиус выемки венца
      const R = g.Ra, yc = g.aw;
      const pA = [X(0), Y(yc - R)];
      sh.attempt([[-12, 14], [12, 14], [-20, 10]].map(([dx, dy]) => () => sh.leader(pA[0], pA[1], pA[0] + dx, pA[1] + dy, `R${nf(R, 1)}`, '', { side: dx > 0 ? 'r' : 'l' })));
    }
    // фаски
    sh.attempt([[-12, -5], [-5, -12], [12, -5], [-16, -7]].map(([dx, dy]) => () => { const px = X(xl + P.cb / 2), py = Y(-rb - P.cb / 2); sh.leader(px, py, px + dx, py + dy, `${nf(P.cb, 1)}×45°`, '2 фаски', { side: dx > 0 ? 'r' : 'l' }); }));
    // отверстия в диске
    if (P.holes) {
      const hy = (P.holes.Dc / 2 + P.holes.d / 2);
      void hy;
      sh.attempt([[-14, 10], [14, 10], [-20, 18]].map(([dx, dy]) => () => sh.leader(X(-P.he), Y(-P.holes.Dc / 2), X(-P.he) + dx, Y(-P.holes.Dc / 2) - dy, `⌀${P.holes.d}`, `${P.holes.n} отв.`, { side: dx > 0 ? 'r' : 'l' })));
    }
    if (P.holes) for (const sg of [1, -1]) v.line(-P.he - 3 / k, sg * P.holes.Dc / 2, P.he + 3 / k, sg * P.holes.Dc / 2, 3);
    // шероховатость: отверстие (на полке выноски), зубья, торцы ступицы
    { // отверстие: стрелка выноски на линии отверстия со стороны отверстия (не через материал ступицы), знак на полке
      const room = Y(0) - Y(-rb);
      sh.attempt([[0.55, 10, 0.35], [0.7, 12, 0.35], [0.4, -10, 0.35], [0.8, 14, 0.5], [0.3, -14, 0.5]].map(([t, dx, f]) => () => { const px = X(xl + (xr - xl) * t), py = Y(-rb); sh.roughLeader(px, py, px + dx, py + Math.max(4, Math.min(room * f, room - 11)), 'Ra 1,6'); }));
    }
    // середина плоского участка вершин венца (у червячного колеса посередине — впадина по дуге)
    const xFlat = (() => { const xs = P.pieces.flat().filter(([, y]) => Math.abs(y - P.rmax) < 1e-6).map(p => p[0]).filter(x => x > 0); return kind === 'wormwheel' && xs.length >= 2 ? (Math.min(...xs) + Math.max(...xs)) / 2 : null; })();
    if (kind !== 'bevel') sh.attempt((xFlat !== null ? [-xFlat, xFlat] : [0, -0.5 * P.hb]).map(x0 => () => sh.rough(X(x0) + 2, Y(P.rmax), 'Ra ' + (kind === 'sprocket' ? '3,2' : '1,6'))));
    else { const bv = P.bevel; sh.attempt([0.4, 0.6].map(t => () => sh.rough(X(bv.Ti[0] + (bv.Te[0] - bv.Ti[0]) * t), Y(bv.Ti[1] + (bv.Te[1] - bv.Ti[1]) * t) + 0.2, 'Ra 1,6', { rot: bv.dl / D2R - 90 > -90 ? 0 : 0 }))); }
    sh.attempt([0.5, 0.3, 0.7].map(t => () => sh.rough(X(xr), Y(rh - (rh - rb - P.kb) * t), 'Ra 3,2', { rot: 270 + 180 })).concat([() => sh.rough(X(xl), Y(rh * 0.6 + rb * 0.4), 'Ra 3,2', { rot: 90 })]));
    // допуски: радиальное биение вершин, торцовое биение венца/ступицы относительно А
    const rT = kind === 'bevel' ? P.bevel.Te : [xFlat !== null ? xFlat : P.hb * 0.4, P.rmax];
    const fy0 = Y(rTip) + 10;
    const tRun = nf(tolRun(tipD, kind === 'wormwheel' ? 2.5 : 2), 3), tFace = nf(tolPerp(g.dst) * 1.25, 3);
    sh.attempt([0, 8, 16].flatMap(dy => [0, -20, 20].map(dx => () => { const tx = X(rT[0]), ty = Y(rT[1]); const x1 = tx - 12 + dx; sh.tol(x1, fy0 + dy, ['rrun', tRun, base], { from: 'b', fx: Math.min(Math.max(tx - x1, 3), 20), via: dx ? [[x1 + Math.min(Math.max(tx - x1, 3), 20), fy0 + dy - 4], [tx, fy0 + dy - 4]] : [], to: [tx, ty + 0.2] }); })));
    const faceX = kind === 'bevel' ? P.bevel.xB : P.hb, faceY = kind === 'bevel' ? (P.bevel.Be[1] + rh) / 2 : (P.rr ? (P.rr + P.rmax) / 2 : P.rmax * 0.8);
    sh.attempt([12, 20, 28].flatMap(dx => [0, 10, -10].map(dy => () => { const tx = X(faceX), ty = Y(faceY); const att = tx + dx; sh.tol(att - 3.5, ty + 8 + dy, ['perp', tFace, base], { from: 'b', fx: 3.5, via: [[att, ty]], to: [tx, ty] }); })));
    return { P };
  }

  /* вид на ступицу со шпоночным пазом */
  function hubView(sh, g, k, letter, task) {
    const rb = g.dbore / 2 * k, kd = g.key;
    if (!kd) return;
    const b = kd.b * k, t2 = kd.t2 * k;
    const ang = Math.asin(Math.min(1, b / 2 / rb)) / D2R;
    sh.arc(0, 0, rb, 90 + ang, 90 - ang + 360, 1);
    const yTop = Math.sqrt(rb * rb - b * b / 4);
    sh.line(-b / 2, yTop, -b / 2, rb + t2, 1).line(-b / 2, rb + t2, b / 2, rb + t2, 1).line(b / 2, rb + t2, b / 2, yTop, 1);
    sh.circle(0, 0, g.dst / 2 * k, 1);
    sh.line(-g.dst / 2 * k - 4, 0, g.dst / 2 * k + 4, 0, 3).line(0, -g.dst / 2 * k - 4, 0, g.dst / 2 * k + 4, 3);
    sh.dimH(-b / 2, rb + t2, b / 2, rb + t2, rb + t2 + 8, nf(kd.b, 0) + keyFit(task)[1]);
    sh.dimV(b / 2, -rb, b / 2, rb + t2, g.dst / 2 * k + 8, nf(g.dbore + kd.t2, 1) + '^+0,2');
    // радиус закругления дна паза (ГОСТ 23360-78, r max: b ≤ 6 — 0,16; 8…10 — 0,25; 12…18 — 0,4; 20…28 — 0,6; 32…50 — 1,0)
    const rMax = kd.b <= 6 ? '0,16' : kd.b <= 10 ? '0,25' : kd.b <= 18 ? '0,4' : kd.b <= 28 ? '0,6' : '1,0';
    sh.attempt([[-16, 10], [-22, 4], [-12, 16]].map(([dx, dy]) => () => sh.leader(-b / 2, rb + t2, -b / 2 + dx, rb + t2 + dy, `R${rMax} max`, '', { side: 'l' })));
    sh.text(0, g.dst / 2 * k + 18, letter, { h: 7, anchor: 'cb' });
  }

  function wheelSheet(pd, info) {
    const g = pd.geom, kind = pd.kind;
    const notes = info.notes || [];
    const tipD = kind === 'sprocket' ? g.De : kind === 'wormwheel' ? g.daM : kind === 'bevel' ? g.dae : g.da;
    const plan = [];
    for (const kk of [2, 1]) for (const fmt of ['A3', 'A2']) plan.push([fmt, kk]);
    for (const kk of [0.5, 0.4, 0.25, 0.2]) for (const fmt of ['A3', 'A2']) plan.push([fmt, kk]);
    for (const [fmt, k] of plan) {
      if (k === 2 && tipD > 110) continue;
      const tmp = new Sheet('A1', true); tmp.frame = { x1: -5000, y1: -5000, x2: 5000, y2: 5000 };
      wheelMain(tmp, g, kind, k, info);
      const mb = tmp.bbox(0);
      for (const land of [false, true]) {
        const sh = new Sheet(fmt, land);
        if (mb.x2 - mb.x1 > sh.frame.x2 - sh.frame.x1 - 6 || mb.y2 - mb.y1 > sh.frame.y2 - sh.frame.y1 - 6) continue;
        for (const ttPos of ['stamp', 'left']) {
          const sh2 = new Sheet(fmt, land);
          setupSheet(sh2, info, notes, ttPos);
          const pl = placeGroup(sh2, tmp.p, { near: [sh2.frame.x1 + 15 + (mb.x2 - mb.x1) / 2, (sh2.frame.y1 + sh2.frame.y2) / 2 + 30] });
          if (info.debug) console.log('wheel', fmt, k, land, ttPos, mb, !!pl);
          if (!pl) continue;
          // стрелка взгляда «А» слева от главного вида и вид А
          if (g.key) {
            const t2 = new Sheet('A1', true); t2.frame = tmp.frame;
            const ks = (() => { for (const [kk] of SCALES) if (kk * g.dst <= 70 && kk >= k) return kk; return k; })();
            hubView(t2, g, ks, 'А' + (ks !== k ? ` (${scaleText(ks)})` : ''), info.task);
            const ax = pl.box.x1 + 2, ay = pl.dy;
            if (!placeGroup(sh2, t2.p, { near: [pl.box.x2 + 60, pl.dy] })) continue;
            { const xa = pl.dx + (wheelProfile(g, kind).x0) * k - 4; sh2.attempt([8, 14, -8, 20, -14, 26].flatMap(dy => [0, -6].map(dx => () => sh2.viewArrow(xa + dx, ay + dy, 0, 'А')))); }
            void ax;
          }
          return { sh: sh2, scale: scaleText(k), k, fmt };
        }
      }
    }
    return null;
  }

  /* ================================================================ сведения о деталях для листов */
  const INV20 = Math.tan(20 * D2R) - 20 * D2R;
  function commonNormal(m, z) { const zw = Math.max(2, Math.round(z / 9 + 0.5)); return { zw, W: m * Math.cos(20 * D2R) * (Math.PI * (zw - 0.5) + z * INV20) }; }
  const matText = mt => mt ? `${mt.name} ГОСТ 1050-2013` : 'Сталь 45 ГОСТ 1050-2013';
  const hardNote = mt => {
    if (!mt) return '240…280 HB';
    if (mt.hardSurf) return `Зубья: ${mt.ht} ${mt.hard.replace('HRC ', '')} HRC; остальное 240…280 HB`;
    return `${(mt.hard || 'HB 240…280').replace(/^HB\s*/, '')} HB`;
  };
  const NOTE_TOL = 'Неуказанные предельные отклонения размеров: отверстий +t2, валов −t2, остальных ±t2/2 по ГОСТ 25670-83.';
  function spurTable(m, z, d, deg, mate) {
    const W = commonNormal(m, z);
    return [['Модуль', 'm', nf(m, 3)], ['Число зубьев', 'z', String(z)], ['Тип зуба', '—', 'прямой'], ['Нормальный исходный\nконтур', '—', 'ГОСТ 13755-2015'], ['Коэффициент смещения', 'x', '0'], ['Степень точности\nпо ГОСТ 1643-81', '—', `${deg || 8}-B`], ['Длина общей нормали', 'W', nf(W.W, 3)], ['Число зубьев в длине\nобщей нормали', 'zw', String(W.zw)], ['Делительный диаметр', 'd', nf(d, 3)], ['Обозначение чертежа\nсопряжённого колеса', '—', mate || '']];
  }
  function bevelTable(g, z, delta, dm, mate) {
    return [['Внешний окружной\nмодуль', 'mte', nf(g.mte, 3)], ['Число зубьев', 'z', String(z)], ['Тип зуба', '—', 'прямой'], ['Исходный контур', '—', 'ГОСТ 13754-81'], ['Коэффициент смещения', 'xe', '0'], ['Коэффициент изменения\nтолщины зуба', 'xτ', '0'], ['Угол делительного\nконуса', 'δ', deg(delta)], ['Степень точности\nпо ГОСТ 1758-81', '—', '8-B'], ['Межосевой угол\nпередачи', 'Σ', '90°'], ['Внешнее конусное\nрасстояние', 'Re', nf(g.Re, 2)], ['Средний делительный\nдиаметр', 'dm', nf(dm, 2)], ['Обозначение чертежа\nсопряжённого колеса', '—', mate || '']];
  }
  function partInfo(R, M, pd) {
    const t = R.task, code = id => (M.parts.find(p => p.id === id) || {}).code || '';
    const info = { task: t, raRest: 'Ra 6,3', material: pd.material, notes: [] };
    const shaftNotes = (hard, extra) => [`1. ${hard}.`, '2. Неуказанные радиусы скруглений 1 мм max.', `3. ${NOTE_TOL}`].concat(extra || []);
    const wheelNotes = (hard, extra) => [`1. ${hard}.`, '2. *Размеры для справок.', '3. Неуказанные радиусы скруглений 2 мм max.', `4. ${NOTE_TOL}`].concat(extra || []);
    const pinMat = { 1: { val_shesternya: R.q1, val_II: R.q3, koleso_kon: R.q2, koleso_cil: R.q4 }, 6: { val_I: R.a1, val_II: R.a3, koleso_z2: R.a2, koleso_z4: R.a4 } }[t] || {};
    const mt = pinMat[pd.id] && pinMat[pd.id].mat;
    if (pd.kind === 'shaft') {
      const gs = pd.geom.segs.find(s => s.gear);
      info.material = mt ? matText(mt) : 'Сталь 45 ГОСТ 1050-2013';
      if (gs && gs.gear.kind === 'spur') {
        const isT = t === 1 || (t === 6 && pd.id === 'val_II');
        const G = t === 1 ? R.gT : (pd.id === 'val_I' ? R.gB : R.gT), cc = t === 1 ? R.cT : (pd.id === 'val_I' ? R.cB : R.cT);
        void isT;
        info.table = spurTable(G.m, G.z1, G.d1, (cc && cc.deg) || G.deg, code(t === 1 ? 'koleso_cil' : (pd.id === 'val_I' ? 'koleso_z2' : 'koleso_z4')));
        info.notes = shaftNotes(hardNote(mt));
      } else if (gs && gs.gear.kind === 'bevel') {
        const g = R.gC;
        info.table = bevelTable(g, g.z1, g.d1deg, g.dm1, code('koleso_kon'));
        info.notes = shaftNotes(hardNote(mt), ['4. *Размеры для справок.']);
      } else if (gs && gs.gear.kind === 'worm') {
        const g = R.g;
        info.material = 'Сталь 45 ГОСТ 1050-2013';
        info.table = [['Модуль', 'm', nf(g.m, 3)], ['Число витков', 'z1', String(g.z1)], ['Вид червяка', '—', 'ZA'], ['Делительный угол\nподъёма линии витка', 'γ', deg(g.gam)], ['Направление линии\nвитка', '—', 'правое'], ['Исходный производящий\nчервяк', '—', 'ГОСТ 19036-94'], ['Степень точности\nпо ГОСТ 3675-81', '—', `${(R.st && R.st.deg) || 8}-B`], ['Делительный диаметр', 'd1', nf(g.d1, 3)], ['Ход витка', 'pz', nf(Math.PI * g.m * g.z1, 3)], ['Обозначение чертежа\nсопряжённого колеса', '—', code('koleso_cherv')]];
        info.notes = ['1. Витки: закалка ТВЧ 45…50 HRC, остальное 240…280 HB.', '2. Витки шлифовать.', '3. Неуказанные радиусы скруглений 1 мм max.', `4. ${NOTE_TOL}`];
      } else info.notes = shaftNotes('240…280 HB');
    } else if (pd.kind === 'wheel') {
      const isB = pd.id === 'koleso_z2', G = t === 6 ? (isB ? R.gB : R.gT) : R.gT, cc = t === 6 ? (isB ? R.cB : R.cT) : R.cT;
      info.material = matText(mt);
      info.table = spurTable(G.m, G.z2, G.d2, (cc && cc.deg) || G.deg, code(t === 6 ? (isB ? 'val_I' : 'val_II') : 'val_II'));
      info.notes = wheelNotes(hardNote(mt));
    } else if (pd.kind === 'bevel') {
      const g = R.gC;
      info.material = matText(mt);
      info.table = bevelTable(g, g.z2, g.d2deg, g.dm2, code('val_shesternya'));
      info.notes = wheelNotes(hardNote(mt));
    } else if (pd.kind === 'wormwheel') {
      const g = R.g, wm = R.mt && R.mt.mat;
      const cast = wm && wm.type === 'ci';
      info.material = cast ? `${wm.name} ГОСТ 1412-85` : `${wm ? wm.name : 'БрА9Ж3Л'} ГОСТ 493-79`;
      info.table = [['Модуль', 'm', nf(g.m, 3)], ['Число зубьев', 'z2', String(g.z2)], ['Направление линии\nзуба', '—', 'правое'], ['Коэффициент смещения\nчервяка', 'x', '0'], ['Исходный производящий\nчервяк', '—', 'ГОСТ 19036-94'], ['Степень точности\nпо ГОСТ 3675-81', '—', `${(R.st && R.st.deg) || 8}-B`], ['Межосевое расстояние', 'aw', nf(g.aw, 1)], ['Делительный диаметр', 'd2', nf(g.d2, 3)], ['Вид сопряжённого\nчервяка', '—', 'ZA'], ['Число витков\nсопряжённого червяка', 'z1', String(g.z1)], ['Обозначение чертежа\nсопряжённого червяка', '—', code('val_cherv')]];
      info.notes = cast ? wheelNotes('170…229 HB') : ['1. Венец — ' + (wm ? wm.name : 'БрА9Ж3Л') + ' (отливка ' + (wm && wm.cast ? wm.cast : 'в песчаную форму') + '), центр — СЧ15 ГОСТ 1412-85.', '2. *Размеры для справок.', '3. Неуказанные радиусы скруглений 2 мм max.', `4. ${NOTE_TOL}`];
    } else if (pd.kind === 'sprocket') {
      const c = R.chn;
      info.material = 'Сталь 45 ГОСТ 1050-2013';
      info.table = [['Число зубьев', 'z', String(c.z1)], ['Сопрягаемая цепь', '—', c.code + '\nГОСТ 13568-75'], ['Шаг цепи', 't', nf(c.t, 2)], ['Диаметр ролика', 'd1', nf(c.chain.d1, 2)], ['Профиль зуба', '—', 'ГОСТ 591-69'], ['Группа точности', '—', 'В'], ['Делительный диаметр', 'dд', nf(c.dd1, 3)]];
      info.notes = ['1. Зубья: закалка ТВЧ 40…45 HRC, остальное 240…280 HB.', '2. *Размеры для справок.', '3. Неуказанные радиусы скруглений 2 мм max.', `4. ${NOTE_TOL}`];
    }
    // масса, кг
    info.mass = massOf(pd);
    return info;
  }
  function massOf(pd) {
    const rho = (pd.kind === 'wormwheel' ? 8.0 : 7.85) * 1e-6;
    if (pd.kind === 'shaft') return pd.geom.segs.reduce((a, s) => a + Math.PI * s.d * s.d / 4 * s.l, 0) * rho;
    try {
      const P = wheelProfile(pd.geom, pd.kind);
      let V = 0;
      P.pieces.forEach(pc => { let A = 0, cy = 0; for (let i = 0; i < pc.length; i++) { const [x1, y1] = pc[i], [x2, y2] = pc[(i + 1) % pc.length]; const c = x1 * y2 - x2 * y1; A += c; cy += (y1 + y2) * c; } A /= 2; cy /= (6 * A); V += Math.abs(A) * 2 * Math.PI * cy; });
      return Math.abs(V) * rho;
    } catch (e) { return 0; }
  }
  const massText = m => m >= 10 ? nf(m, 0) : m >= 1 ? nf(m, 1) : nf(m, 2);

  /* все листы рабочих чертежей проекта */
  function detailSheets(R, P, T) {
    const M = root.KOMPAS.model(R, P, T || {});
    const out = [];
    for (const dd of M.drawings) {
      const pd = M.parts.find(p => p.id === dd.part); if (!pd) continue;
      const info = partInfo(R, M, pd);
      const res = pd.kind === 'shaft' ? shaftSheet(pd, info) : wheelSheet(pd, info);
      if (!res) continue;
      out.push({ id: pd.id, file: pd.id + '.cdw', code: pd.code, name: pd.name, material: info.material, mass: massText(info.mass), scale: res.scale, fmt: res.fmt, landscape: res.sh.landscape, sh: res.sh });
    }
    return out;
  }

  function deg(a) { const d = Math.floor(a + 1e-9); let m = Math.round((a - d) * 60); let dd = d; if (m === 60) { dd++; m = 0; } return `${dd}°${String(m).padStart(2, '0')}′`; }

  /* таблица параметров зубчатого венца в правом верхнем углу (ГОСТ 2.403 … 2.406) */
  function gearTable(sh, rows, ytop) {
    const f = sh.frame, W = [65, 12, 33];
    const x = f.x2 - 110;
    const rws = rows.map(r => ({ c: r, h: String(r[0]).includes('\n') ? 13 : 8 }));
    const H = sh.table(x, ytop, W, rws, { align: ['l', 'c', 'c'], h: 3.5 });
    return { x1: x, y1: ytop - H, x2: f.x2, y2: ytop };
  }

  root.DRAWINGS = { prepSegsPublic: prepSegs, detailSheets, partInfo, massOf, wheelMain, hubView, placeGroup, wheelSheet, wheelProfile, shaftSheet, gearTable, segRole, fitOf, raOf, tolCyl, tolRun, tolPerp, tolSym, keyFit, chamf, deg, scaleText, SCALES, nf, IT };
})(typeof window !== 'undefined' ? window : globalThis);
