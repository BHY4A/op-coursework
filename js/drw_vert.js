/* drw_vert.js — редуктор с вертикальными валами (задание 1, рис. 2.12): вид сверху на сборочном чертеже,
   чертежи корпуса и крышки корпуса. Геометрия — из 3D-модели корпуса (M3D.housing3d(...).geo), чтобы чертежи и модель совпадали. */
(function (root) {
  'use strict';
  const C = root.DRWCORE, DR = root.DRAWINGS;
  const { Sheet } = C;
  const nf = (x, d) => C.fmtNum(x, d === undefined ? 0 : d);
  const scratch = () => { const sh = new Sheet('A1', true); sh.frame = { x1: -1e5, y1: -1e5, x2: 1e5, y2: 1e5 }; return sh; };
  const circ = (sh, x, y, r, st) => sh.circle(x, y, r, st === undefined ? 1 : st);
  const cross = (sh, x, y, r) => { sh.line(x - r, y, x + r, y, 3).line(x, y - r, x, y + r, 3); };
  const FA = a => a <= 120 ? 0.035 : a <= 180 ? 0.04 : a <= 250 ? 0.045 : a <= 315 ? 0.05 : 0.055;

  // данные: прямоугольники полости по уровням (XY) и их глубина по Z
  function levelsOf(g) { return g.S.cavs.map((c, j) => ({ c, h: g.cavZ[j] })); }

  /* ---------------- вид сверху для сборочного чертежа: X вправо, Z вниз (вид сверху под главным видом) */
  function topView(A, R, g, k) {
    const sh = scratch(), items = [];
    const X = x => x * k, Zs = z => -z * k;
    const rect = (x1, z1, x2, z2, st) => sh.poly([[X(x1), Zs(z1)], [X(x2), Zs(z1)], [X(x2), Zs(z2)], [X(x1), Zs(z2)]], st === undefined ? 1 : st);
    const f = g.flR;
    // фланец разъёма и стенки крышки выше разъёма
    rect(f.x1, f.z1, f.x2, f.z2);
    const up = levelsOf(g).filter(q => q.c.y2 + g.del > g.ys + g.tf + 1);
    const loops = root.M3D.outline(up.map(q => ({ x1: q.c.x1 - g.del, y1: -q.h - g.del, x2: q.c.x2 + g.del, y2: q.h + g.del })));
    loops.forEach(lp => sh.poly(lp.map(([x, z]) => [X(x), Zs(z)]), 1));
    // лапы (ниже фланца — видимые части за пределами фланца)
    const fz = g.zB + g.K1;
    [[-fz, -(g.zB - g.del)], [g.zB - g.del, fz]].forEach(([z1, z2]) => { if (Math.abs(z2) > Math.abs(f.z2) || Math.abs(z1) > Math.abs(f.z2) || g.xW1 - g.K1 < f.x1 || g.xW2 + g.K1 > f.x2) rect(g.xW1 - g.K1, z1, g.xW2 + g.K1, z2, 2); });
    g.feetH.forEach(([x, z]) => { circ(sh, X(x), Zs(z), g.d1 / 2 * k, 2); cross(sh, X(x), Zs(z), g.d1 * k * 0.8); });
    // болты фланца (условно: окружность головки), штифты
    const d3 = g.d3, s3 = { 8: 13, 10: 16, 12: 18, 16: 24 }[d3] || 1.6 * d3;
    g.holes.forEach(([x, z]) => { circ(sh, X(x), Zs(z), s3 / 2 * k); cross(sh, X(x), Zs(z), s3 * k * 0.7); });
    g.pinC.forEach(([x, z]) => circ(sh, X(x), Zs(z), 4 * k));
    // приливы и крышки подшипников вертикальных валов (верхние), выходной конец тихоходного вала
    g.S.bosses.filter(b => b.c === 1 && b.face > b.wallIn).forEach(b => { circ(sh, X(b.ax), 0, b.bossR * k); cross(sh, X(b.ax), 0, (b.bossR + 8) * k); });
    g.S.covers.filter(cv => !cv.s.horiz && cv.dir > 0).forEach(cv => circ(sh, X(cv.s.o[0]), 0, (cv.D + 2.2 * 8 + 4) * k));
    A.shafts.filter(s => Math.abs(s.ax[1]) > 0.9).forEach(s => {
      const top = s.segs[s.segs.length - 1];
      circ(sh, X(s.pos[0]), 0, top.r * k);
    });
    // входной вал со стаканом (горизонтальный, вдоль X)
    A.shafts.filter(s => Math.abs(s.ax[0]) > 0.9).forEach(s => {
      const x0 = s.pos[0], sg = Math.sign(s.ax[0]);
      let prev = null;
      s.segs.forEach(q => {
        const xa = x0 + sg * q.x0, xb = x0 + sg * q.x1, a = Math.min(xa, xb), b = Math.max(xa, xb);
        if (b > f.x2 + 2) { const aa = Math.max(a, f.x2); rect(aa, -q.r, b, q.r); }
        prev = q;
      });
      void prev;
      sh.line(X(x0 - 10), 0, X(x0 + sg * (s.segs[s.segs.length - 1].x1 + 10)), 0, 3);
    });
    g.S.inPlane.filter(s => s.tube).forEach(s => { const t = s.tube; const r = (t.y2 - t.y1) / 2 / 1; rect(Math.max(t.x1, f.x2), -r, t.x2, r); });
    // смотровой люк
    // смотровой люк, закрытый крышкой на 4 винтах М6 (проём под крышкой — невидимый)
    if (g.hatch) { const h = g.hatch; rect(h.x1 - 12, h.z1 - 12, h.x2 + 12, h.z2 + 12); rect(h.x1, h.z1, h.x2, h.z2, 4); [[h.x1 - 6, h.z1 - 6], [h.x2 + 6, h.z1 - 6], [h.x2 + 6, h.z2 + 6], [h.x1 - 6, h.z2 + 6]].forEach(([x, z]) => circ(sh, X(x), Zs(z), 5 * k)); items.push({ kind: 'hatchLid', pt: [X((h.x1 + h.x2) / 2), Zs(h.z2 + 6)] }); }
    // оси
    g.S.bosses.filter(b => b.c === 1).forEach(b => sh.line(X(b.ax), Zs(f.z1) + 6, X(b.ax), Zs(f.z2) - 6, 3));
    sh.line(X(f.x1) - 6, 0, X(f.x2) + 6, 0, 3);
    // размеры: габарит по ширине*, установочные (отверстия лап), отверстия
    const xl = X(Math.min(f.x1, g.xW1 - g.K1));
    sh.dimV(xl, Zs(fz), xl, Zs(-fz), xl - 26, nf(2 * fz) + '*');
    const fh = g.feetH.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    if (fh.length >= 4) {
      const a = fh[0], b = fh[fh.length - 1];
      sh.attempt([0, 8].map(d => () => sh.dimH(X(a[0]), Zs(-fz), X(b[0]), Zs(-fz), Zs(-fz) + 12 + d, nf(b[0] - a[0]))));
      sh.attempt([0, 8].map(d => () => sh.dimV(X(a[0]), Zs(fh[0][1]), X(a[0]), Zs(fh[1][1]), X(Math.min(f.x1, g.xW1 - g.K1)) - 12 - d, nf(Math.abs(fh[1][1] - fh[0][1])))));
      sh.attempt([[-14, 12], [14, 12], [-14, -12]].map(([dx, dy]) => () => sh.leader(X(a[0]) + Math.sign(dx) * g.d1 / 2 * k * 0.7, Zs(a[1]) + Math.sign(dy) * g.d1 / 2 * k * 0.7, X(a[0]) + dx, Zs(a[1]) + dy, `⌀${nf(g.d1)}`, '4 отв.', { side: dx > 0 ? 'r' : 'l' })));
    }
    items.push({ kind: 'housing', pt: [X((f.x1 + f.x2) / 2), Zs(f.z2 - g.K / 2)] });
    return { sh, items };
  }

  /* ---------------- чертежи корпуса и крышки: вид спереди (XY) и вид на плоскость разъёма */
  function partRects(g, part) {
    const lo = part === 'base' ? -1e9 : g.ys, hi = part === 'base' ? g.ys : 1e9;
    const clip = r => ({ x1: r.x1, x2: r.x2, y1: Math.max(r.y1, lo), y2: Math.min(r.y2, hi) });
    const ok = r => r.y2 - r.y1 > 0.2 && r.x2 - r.x1 > 0.2;
    const walls = g.S.cavs.map(c => clip({ x1: c.x1 - g.del, x2: c.x2 + g.del, y1: c.y1 - g.del, y2: c.y2 + g.del })).filter(ok);
    const bosses = g.S.bosses.map(b => b.c === 1 ? clip({ x1: b.ax - b.bossR, x2: b.ax + b.bossR, y1: Math.min(b.wallIn, b.face), y2: Math.max(b.wallIn, b.face) }) : clip({ x1: Math.min(b.wallIn, b.face), x2: Math.max(b.wallIn, b.face), y1: b.ax - b.bossR, y2: b.ax + b.bossR })).filter(ok);
    // стакан: у основания нет торцевой части под фланцем (срез фланца стакана, 10 мм от торца — он весь в крышке) и части за фланцем разъёма
    const tube = g.S.inPlane.filter(s => s.tube).map(s => clip(part === 'base' ? { x1: Math.max(s.tube.x1 + (s.cartridge === 'hi' ? 0 : 10), g.flR.x1), x2: Math.min(s.tube.x2 - (s.cartridge === 'hi' ? 10 : 0), g.flR.x2), y1: s.tube.y1, y2: s.tube.y2 } : s.tube)).concat(part === 'base' ? [] : g.S.inPlane.filter(s => s.tubeFl).map(s => clip(s.tubeFl))).filter(ok);
    const fl = [clip({ x1: g.flR.x1, x2: g.flR.x2, y1: g.ys - g.tf, y2: g.ys + g.tf })].filter(ok);
    const feet = part === 'base' ? [{ x1: g.xW1 - g.K1, x2: g.xW2 + g.K1, y1: g.yFeet, y2: g.yBot + g.pF }] : [];
    return { walls, bosses, tube, fl, feet, cav: g.S.cavs.map(clip).filter(ok), lo, hi };
  }

  function elevView(A, R, g, k, part) {
    const sh = scratch();
    const P = (x, y) => [x * k, y * k];
    const pr = partRects(g, part);
    const sc = r => ({ x1: r.x1 * k, y1: r.y1 * k, x2: r.x2 * k, y2: r.y2 * k });
    const loops = root.M3D.outline(pr.walls.concat(pr.bosses, pr.tube, pr.fl, pr.feet).map(sc));
    loops.forEach(lp => sh.poly(lp, 1));
    // невидимые: полость, расточки
    // (рёбра по плоскости разъёма совпадают с видимым контуром — не дублируются штриховой)
    root.M3D.outline(pr.cav.map(sc)).forEach(lp => lp.forEach((a, i) => { const b = lp[(i + 1) % lp.length]; if (Math.abs(a[1] - b[1]) < 0.01 && Math.abs(a[1] - g.ys * k) < 0.3) return; sh.line(a[0], a[1], b[0], b[1], 4); }));
    const bores = g.S.bores.map(b => ({ x1: b.x1, x2: b.x2, y1: Math.max(b.y1, pr.lo), y2: Math.min(b.y2, pr.hi) })).filter(r => r.y2 - r.y1 > 0.2 && r.x2 - r.x1 > 0.2);
    bores.forEach(b => { const q = sc(b); sh.line(q.x1, q.y1, q.x1, q.y2, 4).line(q.x2, q.y1, q.x2, q.y2, 4); });
    // оси вертикальных валов и входного
    g.S.bosses.filter(b => b.c === 1).forEach(b => { const ys = pr.walls.concat(pr.bosses).filter(r => r.x1 <= b.ax && r.x2 >= b.ax); if (!ys.length) return; const y1 = Math.min(...ys.map(r => r.y1)), y2 = Math.max(...ys.map(r => r.y2)); sh.line(b.ax * k, (y1 - 8) * k, b.ax * k, (y2 + 8) * k, 3); });
    // размеры
    const all = pr.walls.concat(pr.bosses, pr.tube, pr.fl, pr.feet);
    const bx1 = Math.min(...all.map(r => r.x1)), bx2 = Math.max(...all.map(r => r.x2)), by1 = Math.min(...all.map(r => r.y1)), by2 = Math.max(...all.map(r => r.y2));
    sh.dimH(...P(bx1, by1), ...P(bx2, by1), by1 * k - 14, nf(bx2 - bx1) + '*');
    if (!(part === 'base' && Math.abs(by1 - g.yFeet) < 0.5 && Math.abs(by2 - g.ys - g.tf * 0) < g.tf + 0.5)) sh.dimV(...P(bx2, by1), ...P(bx2, by2), bx2 * k + 14, nf(by2 - by1) + '*');
    if (part === 'base') {
      sh.dimV(...P(bx1, g.yFeet), ...P(bx1, g.ys), bx1 * k - 12, nf(g.ys - g.yFeet) + '±0,2');
      sh.dimV(...P(g.xW1 - g.K1, g.yFeet), ...P(g.xW1 - g.K1, g.yBot + g.pF), bx1 * k - 22, nf(g.yBot + g.pF - g.yFeet));
    }
    // диаметры расточек вертикальных валов и межосевое расстояние
    const vb = g.S.bosses.filter(b => b.c === 1 && ((part === 'base') === (b.face < b.wallIn)));
    vb.forEach((b, i) => {
      const y = (b.face < b.wallIn ? Math.min(b.face, b.wallIn) - 6 - i * 7 : Math.max(b.face, b.wallIn) + 6 + i * 7);
      sh.attempt([0, 8, -8].map(d => () => sh.dimH((b.ax - b.D) * k, (b.face) * k, (b.ax + b.D) * k, b.face * k, (y + d) * k, `⌀${nf(2 * b.D)}H7`)));
    });
    const axs = [...new Set(g.S.bosses.filter(b => b.c === 1).map(b => Math.round(b.ax * 10) / 10))].sort((a, b) => a - b);
    for (let i = 0; i + 1 < axs.length; i++) { const a = axs[i], b = axs[i + 1]; sh.attempt([0, 9].map(d => () => sh.dimH(a * k, by2 * k, b * k, by2 * k, by2 * k + 12 + d, nf(b - a) + '±' + nf(FA(b - a), 3)))); }
    // база — плоскость разъёма; перпендикулярность расточек к ней
    sh.datum(bx1 * k + 10, g.ys * k, part === 'base' ? 90 : 270, 'А', { len: 10 });
    vb.forEach(b => sh.attempt([[14, 10], [14, -14], [-34, 10]].map(([dx, dy]) => () => sh.tol((b.ax + b.D) * k + dx, b.face * k + dy, ['perp', '0,03', 'А'], { from: dx > 0 ? 'l' : 'r', to: [(b.ax + b.D) * k, b.face * k] }))));
    sh.attempt([[-30, 12], [-30, -18]].map(([dx, dy]) => () => sh.tol(bx1 * k + dx, g.ys * k + dy, ['flat', '0,05'], { from: 'r', to: [bx1 * k + 4, g.ys * k] })));
    { // шероховатость плоскости разъёма — знак на линии разъёма (ГОСТ 2.309)
      const yj = g.ys * k, segs = sh.p.filter(q => q.t === 'L' && q.g === undefined && q.s === 1 && Math.abs(q.a[1] - yj) < 0.05 && Math.abs(q.a[3] - yj) < 0.05 && Math.abs(q.a[2] - q.a[0]) > 14);
      const xs = segs.flatMap(q => [0.3, 0.6].map(f => q.a[0] + (q.a[2] - q.a[0]) * f));
      if (!xs.length) xs.push(bx1 * k + 22);
      sh.attempt(xs.map(x => () => part === 'base' ? sh.rough(x, yj, 'Ra 1,6') : sh.roughLeader(x, yj, x + 8, yj - 12, 'Ra 1,6')));
    }
    // сливное отверстие
    if (part === 'base' && R.H) {
      const dp = R.H.dpr || 16, x = g.xW1 + g.del + dp * 1.5, cav = g.S.cavs.filter(c => c.x1 <= x && c.x2 >= x).sort((a, b) => a.y1 - b.y1)[0];
      if (cav) { const y = cav.y1 + dp * 0.9; circ(sh, x * k, y * k, dp / 2 * k); sh.attempt([[18, 16], [18, 28], [26, -14]].map(([dx, dy]) => () => sh.leader(x * k + dp / 2 * k * 0.7, y * k + Math.sign(dy) * dp / 2 * k * 0.7, x * k + dx, y * k + dy, `М${dp}×1,5–7Н`, ''))); }
    }
    return { sh };
  }

  function planView(A, R, g, k, part) {
    const sh = scratch();
    const X = x => x * k, Zs = z => -z * k;
    const rect = (x1, z1, x2, z2, st) => sh.poly([[X(x1), Zs(z1)], [X(x2), Zs(z1)], [X(x2), Zs(z2)], [X(x1), Zs(z2)]], st === undefined ? 1 : st);
    const f = g.flR;
    rect(f.x1, f.z1, f.x2, f.z2);
    // полость в плоскости разъёма
    const atS = levelsOf(g).filter(q => q.c.y1 < g.ys && q.c.y2 > g.ys);
    root.M3D.outline(atS.map(q => ({ x1: q.c.x1, y1: -q.h, x2: q.c.x2, y2: q.h }))).forEach(lp => sh.poly(lp.map(([x, z]) => [X(x), Zs(z)]), 1));
    // стенки ниже/выше фланца (невидимые)
    root.M3D.outline(levelsOf(g).filter(q => part === 'base' ? q.c.y1 < g.ys : q.c.y2 > g.ys).map(q => ({ x1: q.c.x1 - g.del, y1: -q.h - g.del, x2: q.c.x2 + g.del, y2: q.h + g.del }))).forEach(lp => sh.poly(lp.map(([x, z]) => [X(x), Zs(z)]), 4));
    // отверстия
    g.holes.forEach(([x, z]) => { circ(sh, X(x), Zs(z), g.dh / 2 * k); cross(sh, X(x), Zs(z), g.dh * k * 0.9); });
    g.pinC.forEach(([x, z]) => { circ(sh, X(x), Zs(z), 4 * k); cross(sh, X(x), Zs(z), 7 * k); });
    if (part === 'base') g.feetH.forEach(([x, z]) => circ(sh, X(x), Zs(z), g.d1 / 2 * k, 4));
    if (part === 'cover' && g.hatch) {
      // смотровой люк (сквозной проём) с бобышкой и резьбовыми отверстиями под винты крышки люка
      const h = g.hatch; rect(h.x1, h.z1, h.x2, h.z2); rect(h.x1 - 12, h.z1 - 12, h.x2 + 12, h.z2 + 12);
      const cs = [[h.x1 - 6, h.z1 - 6], [h.x2 + 6, h.z1 - 6], [h.x2 + 6, h.z2 + 6], [h.x1 - 6, h.z2 + 6]];
      cs.forEach(([x, z]) => { circ(sh, X(x), Zs(z), 2.5 * k); sh.arc(X(x), Zs(z), 3 * k, 0, 270, 2); });
      sh.attempt([[18, 14], [-18, 14], [18, -14]].map(([dx, dy]) => () => sh.leader(X(cs[2][0]), Zs(cs[2][1]), X(cs[2][0]) + dx, Zs(cs[2][1]) + dy, 'М6–7Н', '4 отв.')));
    }
    sh.line(X(f.x1) - 6, 0, X(f.x2) + 6, 0, 3);
    g.S.bosses.filter(b => b.c === 1).forEach(b => sh.line(X(b.ax), Zs(f.z1) + 6, X(b.ax), Zs(f.z2) - 6, 3));
    // размеры
    sh.dimH(X(f.x1), Zs(f.z1), X(f.x2), Zs(f.z1), Zs(f.z1) + 24, nf(f.x2 - f.x1));
    sh.dimV(X(f.x2), Zs(f.z2), X(f.x2), Zs(f.z1), X(f.x2) + 12, nf(f.z2 - f.z1));
    const hz = g.holes.filter(h => Math.abs(h[1] - (f.z1 + g.K / 2)) < 1).sort((a, b) => a[0] - b[0]);
    for (let i = 0; i + 1 < hz.length; i++) sh.attempt([0, 8].map(d => () => sh.dimH(X(hz[i][0]), Zs(hz[i][1]), X(hz[i + 1][0]), Zs(hz[i][1]), Zs(f.z1) + 12 + d, nf(hz[i + 1][0] - hz[i][0]))));
    if (g.holes.length) { const h = g.holes[0]; sh.attempt([[14, 12], [-14, 12], [14, -12]].map(([dx, dy]) => () => sh.leader(X(h[0]) + Math.sign(dx) * g.dh / 2 * k * 0.7, Zs(h[1]) + Math.sign(dy) * g.dh / 2 * k * 0.7, X(h[0]) + dx, Zs(h[1]) + dy, `⌀${nf(g.dh)}`, `${g.holes.length} отв.`, { side: dx > 0 ? 'r' : 'l' }))); }
    if (g.pinC.length) { const h = g.pinC[0]; sh.attempt([[14, -12], [-14, -12], [14, 12]].map(([dx, dy]) => () => sh.leader(X(h[0]) + Math.sign(dx) * 2.8 * k, Zs(h[1]) + Math.sign(dy) * 2.8 * k, X(h[0]) + dx, Zs(h[1]) + dy, '⌀8H7', `${g.pinC.length} отв.`, { side: dx > 0 ? 'r' : 'l' }))); }
    { // плоскость разъёма в плане — знак на полке линии-выноски со стрелкой на контуре фланца
      const yT = Math.max(Zs(f.z1), Zs(f.z2)), yB = Math.min(Zs(f.z1), Zs(f.z2));
      sh.attempt([0.3, 0.55, 0.75, 0.2].flatMap(fx => [[fx, 1], [fx, -1]]).map(([fx, sg]) => () => { const x = X(f.x1 + (f.x2 - f.x1) * fx), y = sg > 0 ? yT : yB; sh.roughLeader(x, y, x + 8, y + sg * 12, 'Ra 1,6'); }));
    }
    return { sh };
  }

  function housingSheets(R, P, T, spec) {
    const A = root.DRWASM.asmData(R, P, T), H3 = root.M3D.housing3d(R, P, T);
    if (!H3 || !H3.geo) return [];
    const g = H3.geo;
    const codeOf = name => { let c = ''; spec.sections.forEach(sc => sc.items.forEach(it => { if (it.name === name) c = it.code; })); return c; };
    const notesBase = (cover) => [
      '1. Отливка СЧ15 ГОСТ 1412-85. Неуказанные литейные радиусы 3…5 мм, формовочные уклоны 1…2°.',
      '2. Отливка не должна иметь раковин, трещин и других дефектов, снижающих прочность и герметичность.',
      `3. Отверстия под подшипники обрабатывать совместно с ${cover ? 'корпусом' : 'крышкой корпуса'} после затяжки стяжных болтов и установки штифтов.`,
      '4. *Размеры для справок. Неуказанные предельные отклонения размеров: отверстий H14, валов h14, остальных ±IT14/2.',
      '5. Внутренние необработанные поверхности окрасить маслостойкой краской.'];
    const out = [];
    for (const part of ['base', 'cover']) {
      let done = null;
      for (const [k, kt] of [[1, '1:1'], [0.5, '1:2'], [0.4, '1:2,5'], [0.25, '1:4']]) {
        const El = elevView(A, R, g, k, part), Pl = planView(A, R, g, k, part);
        for (const fmt of ['A2', 'A1']) {
          const sh = new Sheet(fmt, true), f = sh.frame;
          const notes = notesBase(part === 'cover');
          sh.occupy(sh.stamp, 2); sh.occupy(sh.reserved(), 2);
          sh.roughCorner('Ra 12,5'); sh.occupy({ x1: f.x2 - 62, y1: f.y2 - 28, x2: f.x2, y2: f.y2 }, 0);
          let hN = 0; notes.forEach(t => { hN += C.wrap(String(t), 176, 3.5).length; }); hN *= 3.5 * 1.65;
          sh.notes(sh.stamp.x1 + 2, sh.stamp.y2 + 6, 180, notes); sh.occupy({ x1: sh.stamp.x1, y1: sh.stamp.y2 + 4, x2: f.x2 - 2, y2: sh.stamp.y2 + 8 + hN }, 2);
          const eb = El.sh.bbox(0);
          const sL = Math.max(0, eb.x1 - Pl.sh.bbox(0).x1), p1 = DR.placeGroup(sh, El.sh.p, { near: [f.x1 + 10 + sL + (eb.x2 - eb.x1) / 2, f.y2 - 10 - (eb.y2 - eb.y1) / 2] });
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

  root.DRWVERT = { topView, elevView, planView, housingSheets };
})(typeof window !== 'undefined' ? window : globalThis);
