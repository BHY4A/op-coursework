/* drw_drum.js — ведущий вал конвейера с барабаном и подшипниками (задание 6): геометрия узла, сборочный чертёж в 2 проекциях,
   спецификация 03.00.00 и 3D-детали узла (барабан, корпуса подшипников, крышки, звёздочка) со сборкой. */
(function (root) {
  'use strict';
  const C = root.DRWCORE, DR = root.DRAWINGS;
  const { Sheet } = C;
  const nf = (x, d) => C.fmtNum(x, d === undefined ? 0 : d);
  const r1 = x => Math.round(x * 10) / 10;

  /* геометрия узла в координатах вала: x — от торца под звёздочку, r — радиус */
  function geom(R) {
    const dr = R.drum; if (!dr) return null;
    const b = dr.b4 || (dr.BR && dr.BR.b) || { d: dr.dp, D: dr.dp * 1.8, B: 30, id: '' };
    const B = b.T || b.B, D = b.D, lz = dr.lz || 120;
    const L3 = dr.l4 - B - 60, L = lz + (30 + B) * 2 + L3;
    // барабан — по середине участка под ступицы; опоры — на расчётном расстоянии l4 друг от друга
    const xC = (lz + 30 + B + L - 30 - B) / 2;
    const xB = Math.max(lz + B / 2 + 2, xC - dr.l4 / 2), xA = Math.min(L - B / 2 - 2, xC + dr.l4 / 2);
    const Rh = D / 2 + 22, H0 = Math.round(Rh + 18), Wh = B + 44, tb = 25, Lb = Math.round(2 * Rh + 110), hole = 18, hx = Math.round(Rh + 32);
    const Db = dr.Db, Bb = dr.Bb, s = Math.max(6, Math.round(0.012 * Db + 4)), td = 12;
    const hubD = Math.round(1.6 * dr.dbar / 5) * 5, hubL = 70;
    const discs = [xC - Bb / 2 + 15 + td / 2, xC + Bb / 2 - 15 - td / 2];
    // ступицы выступают внутрь барабана от дисков, чтобы не заходить в корпуса подшипников
    const hubC = [discs[0] + (hubL - td) / 2, discs[1] - (hubL - td) / 2];
    const ch = R.chn || {}, chain = ch.chain || {};
    const sp = { c: lz / 2, b: r1(0.93 * (chain.Bvn || 25) - 0.15), De: ch.De2 || 500, dd: ch.dd2 || 480, z: ch.z2, hubD: Math.round(1.6 * dr.dv / 5) * 5, hubL: lz };
    const cov = { t: 10, sp: 8, Df: D + 44, dks: 8 };
    const seal = { d: dr.dp, D: dr.dp + 30, b: 10 };
    return { dr, b, B, D, d: dr.dp, lz, L3, L, xB, xA, xC, Rh, H0, Wh, tb, Lb, hole, hx, Db, Bb, s, td, hubD, hubL, discs, hubC, sp, cov, seal, segs: [[0, lz, dr.dv], [lz, lz + 30 + B, dr.dp], [lz + 30 + B, lz + 30 + B + L3, dr.dbar], [L - 30 - B, L, dr.dp]] };
  }

  /* ---------------- главный вид: разрез по оси вала */
  function mainView(R, g, k) {
    const sh = new Sheet('A1', true); sh.frame = { x1: -1e5, y1: -1e5, x2: 1e5, y2: 1e5 };
    const P = (x, r) => [x * k, r * k];
    const rect = (x1, r1_, x2, r2, st) => sh.poly([P(x1, r1_), P(x2, r1_), P(x2, r2), P(x1, r2)], st === undefined ? 1 : st);
    const hatch = (x1, r1_, x2, r2, ang, step) => { const q = [P(x1, r1_), P(x2, r1_), P(x2, r2), P(x1, r2)]; sh.poly(q, 1); sh.hatch([q], { ang: ang || 45, step: step || 3 }); };
    const both = (fn) => [1, -1].forEach(sg => fn(sg));
    const items = [];
    // вал (не рассекается)
    let prev = null;
    g.segs.forEach(([a, b, d]) => { rect(a, -d / 2, b, d / 2); prev = d; });
    void prev;
    sh.line(-12 * k, 0, (g.L + 12) * k, 0, 3);
    // шпоночные пазы (под звёздочкой и под ступицами)
    (g.dr.keys || []).forEach(kq => {
      const seg = kq.joint === 'sprocket2' ? g.segs[0] : g.segs[2];
      const xs = kq.joint === 'sprocket2' ? [seg[0] + (seg[1] - seg[0] - kq.l) / 2] : g.hubC.map(x => x - kq.l / 2);
      xs.forEach(x0 => { sh.line(x0 * k, (seg[2] / 2 - kq.t1) * k, (x0 + kq.l) * k, (seg[2] / 2 - kq.t1) * k, 1); hatch(x0, seg[2] / 2 - kq.t1, x0 + kq.l, seg[2] / 2 + kq.t2 * 0 + kq.h - kq.t1, 135, 1.2); });
    });
    // звёздочка ведомая
    const S = g.sp, rr = S.De / 2, rf = S.dd / 2 - 0.4 * (g.dr.dv * 0 + 12), rim = Math.max(S.b, 8);
    both(sg => {
      hatch(S.c - S.hubL / 2, sg * g.dr.dv / 2, S.c + S.hubL / 2, sg * S.hubD / 2, 45, 2.5);
      hatch(S.c - rim * 0.35, sg * S.hubD / 2, S.c + rim * 0.35, sg * (rf - 10), 45, 2.5);
      hatch(S.c - rim / 2, sg * (rf - 10), S.c + rim / 2, sg * rr, 45, 2.5);
    });
    items.push({ kind: 'sprocket', pt: P(S.c, rr - 25) });
    // корпуса подшипников, подшипники, крышки, манжеты
    [[g.xB, 'B'], [g.xA, 'A']].forEach(([xc, nm], i) => {
      const x1 = xc - g.Wh / 2, x2 = xc + g.Wh / 2;
      hatch(x1, g.D / 2, x2, g.Rh, 135, 3.5);
      hatch(x1, -g.D / 2, x2, -(g.H0 - g.tb), 135, 3.5);
      hatch(x1 - 10, -g.H0, x2 + 10, -(g.H0 - g.tb), 135, 3.5);
      root.DRWASM.drawBearing(sh, (x, r) => P(x, r), xc - g.B / 2, xc + g.B / 2, g.d / 2 * k, g.D / 2 * k, 'ball', i === 0, k);
      // крышки: снаружи и внутри; наружная у опоры A — глухая
      [[x1, -1], [x2, 1]].forEach(([xf, dir]) => {
        const blind = nm === 'A' && dir > 0;
        const rin = blind ? 0 : g.d / 2 + 1;
        both(sg => { hatch(xf, sg * Math.max(rin, 0.01), xf + dir * g.cov.t, sg * g.cov.Df / 2, 45, 2); hatch(xf, sg * (g.D / 2 - 8), xf - dir * g.cov.sp, sg * g.D / 2, 45, 2); });
        if (!blind) both(sg => { const xs = xf - dir * 2, xe = xs - dir * g.seal.b; sh.poly([P(Math.min(xs, xe), sg * g.d / 2), P(Math.max(xs, xe), sg * g.d / 2), P(Math.max(xs, xe), sg * (g.d / 2 + 12)), P(Math.min(xs, xe), sg * (g.d / 2 + 12))], 1); });
        if (i === 0 && dir < 0) items.push({ kind: 'coverT', pt: P(xf - dir * 4, g.cov.Df / 2 - 6) });
        if (blind) items.push({ kind: 'coverB', pt: P(xf + dir * 5, g.cov.Df / 2 - 10) });
      });
      // болты крепления корпуса (оси)
      sh.line(xc * k, (-g.H0 - 6) * k, xc * k, (-g.H0 + g.tb + 6) * k, 3);
      if (i === 0) { items.push({ kind: 'housing', pt: P(xc + g.Wh / 2 - 6, g.Rh - 6) }); items.push({ kind: 'bearing', pt: P(xc, g.D / 2 - 4) }); }
    });
    // барабан: обечайка, диски, ступицы
    const xc = g.xC;
    both(sg => {
      hatch(xc - g.Bb / 2, sg * (g.Db / 2 - g.s), xc + g.Bb / 2, sg * g.Db / 2, 45, 2.5);
      g.discs.forEach((xd, j) => { const xh = g.hubC[j]; hatch(xd - g.td / 2, sg * g.hubD / 2, xd + g.td / 2, sg * (g.Db / 2 - g.s), 45, 2.5); hatch(xh - g.hubL / 2, sg * g.dr.dbar / 2, xh + g.hubL / 2, sg * g.hubD / 2, 45, 2.5); });
    });
    items.push({ kind: 'drum', pt: P(xc, g.Db / 2 - g.s / 2) });
    items.push({ kind: 'shaft', pt: P((g.discs[0] + g.discs[1]) / 2, g.dr.dbar / 4) });
    // стрелка вида А — с торца опоры A (со стороны глухой крышки)
    { const xa = (g.L + 34) * k, ya = g.Rh * 0.5 * k; sh.line(xa, ya, xa + 14, ya, 1); sh.arrow(xa, ya, 180, 6, 2); sh.text(xa + 7, ya + 3, 'А', { h: 7, anchor: 'cb' }); }
    // размеры
    const yb = -g.H0;
    sh.dimH(...P(0, -g.dr.dv / 2), ...P(g.L, -g.dr.dp / 2), (yb - 18) * k, nf(g.L) + '*');
    sh.attempt([0, 8].map(d => () => sh.dimH(...P(g.xB, yb), ...P(g.xA, yb), (yb - 30) * k - d, nf(g.xA - g.xB))));
    sh.attempt([0, 8].map(d => () => sh.dimH(...P(S.c, yb), ...P(g.xB, yb), (yb - 30) * k - d, nf(g.xB - S.c))));
    sh.attempt([0, 8, -8].map(d => () => sh.dimH(...P(xc - g.Bb / 2, g.Db / 2), ...P(xc + g.Bb / 2, g.Db / 2), (g.Db / 2 + 12) * k + d, nf(g.Bb))));
    sh.attempt([0.25, 0.32, 0.18].map(f => () => sh.dimV(...P(xc - g.Bb * f, -g.Db / 2), ...P(xc - g.Bb * f, g.Db / 2), (xc - g.Bb * f) * k, '⌀' + nf(g.Db))));
    sh.attempt([0, 10].map(d => () => sh.dimV(...P(S.c + rim, -rr), ...P(S.c + rim, rr), (S.c - rim) * k - 14 - d, '⌀' + nf(S.De, 1) + '*')));
        // посадки
    const fit = (x, r, t) => sh.attempt([0, 6, -6].map(d => () => sh.dimV(x * k, -r * k, x * k, r * k, x * k + d, t, { textY: undefined })));
    fit(S.c + S.hubL / 2 - 12, g.dr.dv / 2, `⌀${nf(g.dr.dv)}H7/k6`);
    fit(g.xB, g.D / 2, `⌀${nf(g.D)}H7`);
    fit(g.xA, g.d / 2, `⌀${nf(g.d)}k6`);
    fit(g.hubC[1] - g.hubL / 2 + 10, g.dr.dbar / 2, `⌀${nf(g.dr.dbar)}H7/k6`);
    return { sh, items };
  }

  /* ---------------- вид А (по стрелке с торца опоры A): корпус подшипника с глухой крышкой и креплением */
  function sideView(R, g, k) {
    const sh = new Sheet('A1', true); sh.frame = { x1: -1e5, y1: -1e5, x2: 1e5, y2: 1e5 };
    const P = (z, y) => [z * k, y * k];
    const b = g.Lb / 2, top = -(g.H0 - g.tb), rw = g.Rh * 0.75;
    sh.poly([P(-b, -g.H0), P(b, -g.H0), P(b, top), P(rw, top), P(rw, 0), P(-rw, 0), P(-rw, top), P(-b, top)], 1);
    sh.circle(0, 0, g.Rh * k, 1);
    sh.circle(0, 0, g.cov.Df / 2 * k, 1);
    const rb = (g.D / 2 + g.cov.Df / 2) / 2;
    for (let i = 0; i < 4; i++) { const a = Math.PI / 4 + i * Math.PI / 2; sh.circle(rb * Math.cos(a) * k, rb * Math.sin(a) * k, 4 * k, 1); }
    sh.circle(0, 0, rb * k, 3);
    [-g.hx, g.hx].forEach(z => { sh.line(z * k, (-g.H0 - 5) * k, z * k, (top + 5) * k, 3); sh.circle(z * k, (top + 4) * k, 12 * k, 1); });
    sh.line((-b - 8) * k, 0, (b + 8) * k, 0, 3).line(0, (-g.H0 - 8) * k, 0, (g.Rh + 8) * k, 3);
    sh.dimH(...P(-b, -g.H0), ...P(b, -g.H0), (-g.H0 - 14) * k, nf(g.Lb) + '*');
    sh.dimH(...P(-g.hx, -g.H0), ...P(g.hx, -g.H0), (-g.H0 - 24) * k, nf(2 * g.hx));
    sh.dimV(...P(b, -g.H0), ...P(b, 0), (b + 12) * k, nf(g.H0) + '±0,2');
    sh.leader((-g.hx - 6) * k, (top + 6) * k, (-g.hx - 20) * k, (top + 22) * k, `⌀${nf(g.hole)}`, '4 отв.');
    sh.text(0, (g.Rh + 14) * k, 'А', { h: 7, anchor: 'cb' });
    return { sh };
  }

  /* ---------------- спецификация узла 03.00.00 */
  function spec(R, P, T, code, valCode) {
    const g = geom(R); if (!g) return null;
    let pos = 0;
    // КОМПАС оставляет 2 резервные позиции между разделами (так нумерует его спецификация) — нумеруем так же
    const S = (title, num, list) => { if (pos && list.some(x => !x.noPos)) pos += 2; return { title, num, items: list.map(x => Object.assign({ pos: x.noPos ? '' : String(++pos) }, x)) }; };
    const keys = (g.dr.keys || []).map(kq => ({ name: `Шпонка ${kq.b}×${kq.h}×${kq.l} ГОСТ 23360-78`, qty: kq.joint === 'drum' ? 2 : 1 }));
    const std = [{ name: `Болт М16×${Math.round(g.tb + 30)} ГОСТ 7798-70`, qty: 4 }, { name: `Винт М8×20 ГОСТ 7808-70`, qty: 16 }, { name: `Манжета 1-${nf(g.d)}×${nf(g.seal.D)} ГОСТ 8752-79`, qty: 3 }, { name: `Подшипник ${g.b.id} ${g.b.gost || 'ГОСТ 8338-75'}`, qty: 2 }, { name: 'Шайба 16 65Г ГОСТ 6402-70', qty: 4 }].concat(keys).sort((a, b) => a.name.localeCompare(b.name, 'ru', { numeric: true }));
    return {
      file: 'spec_val_baraban.cdw', code: `${code} 03.00.00`, name: 'Вал приводной с барабаном',
      sections: [
        S('Документация', 5, [{ fmt: 'А1', code: `${code} 03.00.00 СБ`, name: 'Сборочный чертёж', noPos: true }]),
        S('Сборочные единицы', 15, [{ fmt: 'А2', code: `${code} 03.01.00`, name: 'Барабан', qty: 1 }]),
        S('Детали', 20, [{ fmt: 'А2', code: valCode || `${code} 03.00.01`, name: 'Вал приводной', qty: 1 }, { fmt: 'А3', code: `${code} 03.00.02`, name: 'Корпус подшипника', qty: 2 }, { fmt: 'А4', code: `${code} 03.00.03`, name: 'Крышка подшипника глухая', qty: 1 }, { fmt: 'А4', code: `${code} 03.00.04`, name: 'Крышка подшипника сквозная', qty: 3 }, { fmt: 'А3', code: `${code} 03.00.05`, name: 'Звёздочка ведомая', qty: 1 }]),
        S('Стандартные изделия', 25, std),
        S('Материалы', 35, [{ name: 'Смазка Литол-24 ГОСТ 21150-87', qty: '', note: '0,2 кг' }])
      ]
    };
  }

  function sheet(R, P, T, sp) {
    const g = geom(R); if (!g) return null;
    const find = re => { let p = ''; sp.sections.forEach(sc => sc.items.forEach(it => { if (!p && it.pos && re.test(it.name)) p = it.pos; })); return p; };
    const POS = { drum: find(/^Барабан/), shaft: find(/^Вал/), housing: find(/^Корпус подшипника/), coverB: find(/глухая/), coverT: find(/сквозная/), sprocket: find(/^Звёздочка/), bearing: find(/^Подшипник/) };
    const K = R.K || {}, n = K.nIV || R.nOut, Tq = K.TIV || 0, v = Math.PI * g.Db * n / 60000;
    const tech = [`1. Окружная сила на барабане ${nf(g.dr.Fokr || 0)} Н.`, `2. Скорость ленты ${nf(v, 2)} м/с.`, `3. Вращающий момент на валу ${nf(Tq, 0)} Н·м, частота вращения ${nf(n, 1)} мин⁻¹.`];
    const req = ['1. *Размеры для справок.', '2. Радиальное биение обечайки барабана относительно оси вала — не более 0,3 мм.', '3. Корпуса подшипников выставить соосно; несоосность — не более 0,1 мм.', '4. Подшипники заполнить смазкой Литол-24 ГОСТ 21150-87 на 2/3 свободного объёма.', '5. Вал после сборки должен проворачиваться от руки свободно, без заеданий.'];
    for (const [k, kt] of [[0.5, '1:2'], [0.4, '1:2,5'], [0.25, '1:4'], [0.2, '1:5']]) for (const fmt of ['A1']) {
      const M = mainView(R, g, k), Sd = sideView(R, g, k);
      root.DRWASM.positions(M.sh, M.items.map(it => Object.assign({ pos: POS[it.kind] || '' }, it)).filter((it, i, arr) => it.pos && arr.findIndex(q => q.pos === it.pos) === i));
      const sh = new Sheet(fmt, true), f = sh.frame;
      sh.occupy(sh.stamp, 2); sh.occupy(sh.reserved(), 2);
      const W = 185, hT = arr => { let q = 0; arr.forEach(t => { q += C.wrap(String(t), W - 8, 3.5).length; }); return q * 3.5 * 1.65; };
      let y0 = sh.stamp.y2 + 8;
      sh.notes(sh.stamp.x1 + 2, y0, W - 4, req, { title: 'Технические требования' }); const rq = { x1: sh.stamp.x1, y1: y0 - 2, x2: f.x2 - 2, y2: y0 + hT(req) + 9 }; sh.occupy(rq, 2);
      y0 = rq.y2 + 8;
      sh.notes(sh.stamp.x1 + 2, y0, W - 4, tech, { title: 'Техническая характеристика' }); sh.occupy({ x1: sh.stamp.x1, y1: y0 - 2, x2: f.x2 - 2, y2: y0 + hT(tech) + 9 }, 2);
      const mb = M.sh.bbox(0);
      const p1 = DR.placeGroup(sh, M.sh.p, { near: [f.x1 + 15 + (mb.x2 - mb.x1) / 2, f.y2 - 15 - (mb.y2 - mb.y1) / 2] });
      if (!p1) continue;
      // вид А — справа от главного, на уровне оси
      const sb = Sd.sh.bbox(0);
      const p2 = DR.placeGroup(sh, Sd.sh.p, { near: [p1.box.x2 + 20 + (sb.x2 - sb.x1) / 2, p1.dy + (sb.y1 + sb.y2) / 2] });
      if (!p2) continue;
      return { id: 'val_baraban_sb', file: 'val_baraban_SB.cdw', code: sp.code + ' СБ', name: 'Вал приводной с барабаном\nСборочный чертёж', material: '', mass: '', scale: kt, fmt, landscape: true, sh };
    }
    return null;
  }

  root.DRWDRUM = { geom, spec, sheet, mainView, sideView };
})(typeof window !== 'undefined' ? window : globalThis);
