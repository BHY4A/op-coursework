/* drw_frame.js — рама сварная (02.00.00): компоновка по лапам двигателя и редуктора, сборочный чертёж, спецификация. */
(function (root) {
  'use strict';
  const C = root.DRWCORE, DR = root.DRAWINGS, AS = root.DRWASM;
  const { Sheet } = C;
  const nf = (x, d) => C.fmtNum(x, d === undefined ? 0 : d);
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  // швеллеры ГОСТ 8240-97 (серия У): h, b, s, t, масса 1 м
  const CH = { 10: [100, 46, 4.5, 7.6, 8.59], 12: [120, 52, 4.8, 7.8, 10.4], 14: [140, 58, 4.9, 8.1, 12.3], 16: [160, 64, 5.0, 8.4, 14.2], 18: [180, 70, 5.1, 8.7, 16.3] };
  const p2 = x => String(x).padStart(2, '0');

  /* компоновка рамы в плане: fx — вдоль оси двигателя, fy — поперёк; z — вверх от верха швеллеров */
  function frameLayout(R, P, T) {
    const A = AS.asmData(R, P, T);
    // лапы редуктора — из 3D-модели корпуса (мировые координаты): отверстия и плоскость опоры
    const H3 = root.M3D && root.M3D.housing3d(R, P, T);
    if (!H3 || !H3.feet) return null;
    const ft = H3.feet, UP = ft.up;
    const toF = w => ({ fx: w[0], fy: R.task === 1 ? w[2] : w[1] });
    const redHoles = ft.holes.map(toF);
    const K1h = 16;
    const redFoot = { x1: Math.min(...redHoles.map(h => h.fx)) - K1h, x2: Math.max(...redHoles.map(h => h.fx)) + K1h, y1: Math.min(...redHoles.map(h => h.fy)) - K1h, y2: Math.max(...redHoles.map(h => h.fy)) + K1h };
    // входной вал и двигатель
    const s0 = A.shafts[0];
    const L0 = s0.segs[s0.segs.length - 1].x1;
    const endX = s0.pos[0] + L0 * Math.sign(s0.ax[0] || 1);
    const axY = R.task === 1 ? s0.pos[2] : s0.pos[1];
    const m = R.motor || {};
    const mEnd = endX + 4, mSh = mEnd + (m.l1 || 80);
    const motHoles = [];
    for (const x of [mSh + (m.l31 || 70), mSh + (m.l31 || 70) + (m.l10 || 140)]) for (const sg of [-1, 1]) motHoles.push({ fx: x, fy: axY + sg * (m.b10 || 190) / 2 });
    // высоты: ось входного вала над подошвой редуктора и ось двигателя над его лапами
    const Hin = dot(s0.pos, UP) - ft.bottom;     // высота оси входного вала над опорной плоскостью лап
    const Hm = m.h || 112;
    let tr = 10, tm = tr + Hin - Hm;
    if (tm < 8) { tr += 8 - tm; tm = 8; }
    // швеллер по мощности
    const no = (m.P || 4) <= 3 ? 10 : (m.P || 4) <= 7.5 ? 12 : (m.P || 4) <= 15 ? 14 : 16;
    const [hc, bc, sc, tc, qm] = CH[no];
    const allY = redHoles.map(h => h.fy).concat(motHoles.map(h => h.fy));
    const Y1 = Math.min(...redHoles.map(h => h.fy)), Y2 = Math.max(...redHoles.map(h => h.fy));
    const yL = Math.min(Y1, ...allY), yR = Math.max(Y2, ...allY);
    const xs = redHoles.map(h => h.fx).concat(motHoles.map(h => h.fx));
    const X1 = Math.min(...xs) - 70, X2 = Math.max(...xs) + 70;
    let fx0 = Math.floor(X1 / 5) * 5, fx1 = Math.ceil(X2 / 5) * 5;
    const Lf = fx1 - fx0, Wf = (yR - yL) + bc;
    // поперечины: торцевые и под лапы двигателя
    const mx = [...new Set(motHoles.map(h => Math.round(h.fx)))];
    const cross = [{ x: fx0 + bc / 2, kind: 'end' }, { x: fx1 - bc / 2, kind: 'end' }];
    mx.forEach(x => { const near = cross.find(c => c.kind === 'end' && Math.abs(c.x - x) < bc * 2.2); if (near) { near.x = x; near.kind = 'motor'; } else cross.push({ x, kind: 'motor' }); });
    // если двигатель низкий — поперечины под него кладутся сверху на продольные швеллеры
    const raise = tm - hc >= 4 ? hc : 0; tm -= raise;
    if (raise) cross.forEach(c => { if (c.kind === 'motor') c.top = true; });
    cross.sort((a, b) => a.x - b.x);
    // подкладки
    const rx = [...new Set(redHoles.map(h => Math.round(h.fx)))].sort((a, b) => a - b);
    const padsR = [yL, yR].map(y => ({ x1: rx[0] - 35, x2: rx[rx.length - 1] + 35, y1: y - bc / 2 - 5, y2: y + bc / 2 + 5, t: tr }));
    const padsM = mx.map(x => ({ x1: x - bc / 2 - 5, x2: x + bc / 2 + 5, y1: axY - (m.b10 || 190) / 2 - 30, y2: axY + (m.b10 || 190) / 2 + 30, t: tm, z0: raise }));
    const mxMax = Math.max(...mx); if (fx1 < mxMax + bc / 2) fx1 = Math.ceil((mxMax + bc / 2) / 5) * 5;
    // отверстия для крепления к полу: по 4 на продольный швеллер
    const dF = (m.P || 4) > 5.5 ? 24 : 18;
    const nF = Lf > 800 ? 4 : 3;
    const floor = [];
    [yL, yR].forEach(y => { for (let i = 0; i < nF; i++) floor.push({ fx: fx0 + 40 + (Lf - 80) * i / (nF - 1), fy: y }); });
    return { R, m, no, hc, bc, sc, tc, qm, Lf, Wf, fx0, fx1, yL, yR, axY, redHoles, motHoles, redFoot, cross, padsR, padsM, tr, tm, raise, floor, dF, dRed: (ft.d || 18) + 1, dMot: (m.d10 || 12) + 1, Hin, Hm, mEnd, mSh };
  }

  function partsOf(F) {
    const crossLen = F.yR - F.yL - F.bc, topLen = F.Wf;
    const ends = F.cross.filter(c => c.kind === 'end').length, mots = F.cross.filter(c => c.kind === 'motor').length;
    const plR = F.padsR[0], plM = F.padsM[0];
    const items = [
      { key: 'long', name: `Швеллер ${F.no} ГОСТ 8240-97`, note: `L=${nf(F.Lf)}`, qty: 2, mass: F.qm * F.Lf / 1000 * 2 },
      { key: 'end', name: `Швеллер ${F.no} ГОСТ 8240-97`, note: `L=${nf(crossLen)}`, qty: ends, mass: F.qm * crossLen / 1000 * ends },
      { key: 'mot', name: `Швеллер ${F.no} ГОСТ 8240-97`, note: `L=${nf(F.raise ? topLen : crossLen)}`, qty: mots, mass: F.qm * (F.raise ? topLen : crossLen) / 1000 * mots },
      { key: 'padR', name: `Пластина ${nf(plR.t)}×${nf(plR.y2 - plR.y1)}×${nf(plR.x2 - plR.x1)}`, note: 'Ст3 ГОСТ 19903-2015', qty: 2, mass: 7.85e-6 * plR.t * (plR.y2 - plR.y1) * (plR.x2 - plR.x1) * 2 },
      { key: 'padM', name: `Пластина ${nf(plM.t)}×${nf(plM.x2 - plM.x1)}×${nf(plM.y2 - plM.y1)}`, note: 'Ст3 ГОСТ 19903-2015', qty: F.padsM.length, mass: 7.85e-6 * plM.t * (plM.x2 - plM.x1) * (plM.y2 - plM.y1) * F.padsM.length }
    ].filter(it => it.qty > 0);
    return items;
  }

  function frameSpec(R, P, T, code) {
    const F = frameLayout(R, P, T); if (!F) return null;
    const items = partsOf(F);
    let pos = 0;
    const sp = { file: 'spec_rama.cdw', code: `${code} 02.00.00`, name: 'Рама',
      sections: [
        { title: 'Документация', num: 5, items: [{ pos: '', fmt: 'А2', code: `${code} 02.00.00 СБ`, name: 'Сборочный чертёж' }] },
        { title: 'Детали', num: 20, items: items.map((it, i) => ({ pos: String(++pos), fmt: 'БЧ', code: `${code} 02.00.${p2(i + 1)}`, name: it.name, qty: it.qty, note: it.note })) }
      ] };
    Object.defineProperty(sp, 'F', { value: F, enumerable: false });
    return sp;
  }

  /* ---------------------------------------------------------------- чертёж */
  function frameViews(F, k, posOf) {
    const out = {};
    // ---- вид спереди (вдоль fy): продольный швеллер, подкладки, поперечины (невидимые)
    {
      const sh = new Sheet('A1', true); sh.frame = { x1: -1e5, y1: -1e5, x2: 1e5, y2: 1e5 };
      const X = x => (x - F.fx0) * k, Z = z => z * k;
      sh.rect(X(F.fx0), Z(-F.hc), X(F.fx1), Z(0), 1);
      sh.line(X(F.fx0), Z(-F.tc), X(F.fx1), Z(-F.tc), 4).line(X(F.fx0), Z(-F.hc + F.tc), X(F.fx1), Z(-F.hc + F.tc), 4);
      F.cross.filter(c => c.top).forEach(c => { const x1 = X(c.x - F.bc / 2), x2 = X(c.x + F.bc / 2); sh.rect(x1, Z(0), x2, Z(F.hc), 1); sh.line(x1 + F.sc * k, Z(F.tc), x1 + F.sc * k, Z(F.hc - F.tc), 1).line(x1 + F.sc * k, Z(F.tc), x2, Z(F.tc), 1).line(x1 + F.sc * k, Z(F.hc - F.tc), x2, Z(F.hc - F.tc), 1); });
      F.cross.filter(c => !c.top).forEach(c => { sh.line(X(c.x - F.bc / 2), Z(-F.hc + 1), X(c.x - F.bc / 2), Z(-1), 4).line(X(c.x + F.bc / 2), Z(-F.hc + 1), X(c.x + F.bc / 2), Z(-1), 4); });
      F.padsR.slice(0, 1).forEach(p => sh.rect(X(p.x1), Z(0), X(p.x2), Z(p.t), 1));
      F.padsM.forEach(p => sh.rect(X(p.x1), Z(p.z0), X(p.x2), Z(p.z0 + p.t), 1));
      [...new Set(F.redHoles.map(h => Math.round(h.fx)))].concat([...new Set(F.motHoles.map(h => Math.round(h.fx)))]).forEach(x => sh.line(X(x), Z(-F.hc - 4), X(x), Z(Math.max(F.tr, F.tm + F.raise) + 6), 3));
      sh.dimH(X(F.fx0), Z(-F.hc), X(F.fx1), Z(-F.hc), Z(-F.hc) - 22, nf(F.Lf));
      sh.viewArrow(X(F.fx1) - 25, Z(-F.hc) - 1, 90, 'А');
      sh.dimV(X(F.fx1), Z(-F.hc), X(F.fx1), Z(0), X(F.fx1) + 10, nf(F.hc));
      const pm = F.padsM[F.padsM.length - 1]; if (pm) { if (F.raise) sh.dimV(X(pm.x2), Z(0), X(pm.x2), Z(F.raise), X(F.fx1) + 18, nf(F.raise)); sh.attempt([0, 8, -8].map(d => () => sh.dimV(X(pm.x2), Z(pm.z0), X(pm.x2), Z(pm.z0 + pm.t), X(F.fx1) + 26 + d, nf(pm.t), { side: 'below' }))); }
      const pr = F.padsR[0]; sh.dimV(X(pr.x1), Z(0), X(pr.x1), Z(pr.t), X(F.fx0) - 10, nf(pr.t));
      out.front = { sh, items: [{ kind: 'long', pt: [X((F.fx0 + F.fx1) / 2), Z(-F.hc / 2)] }, { kind: 'padR', pt: [X((pr.x1 + pr.x2) / 2), Z(pr.t / 2)] }].concat(pm ? [{ kind: 'padM', pt: [X((pm.x1 + pm.x2) / 2), Z(pm.z0 + pm.t / 2)] }] : []).concat(F.raise ? [{ kind: 'mot', pt: [X(F.cross.find(c => c.top).x), Z(F.hc / 2)] }] : []) };
    }
    // ---- вид сверху
    {
      const sh = new Sheet('A1', true); sh.frame = { x1: -1e5, y1: -1e5, x2: 1e5, y2: 1e5 };
      const X = x => (x - F.fx0) * k, Y = y => (y - F.yL + F.bc / 2) * k;
      const b2 = F.bc / 2;
      [F.yL, F.yR].forEach(y => { sh.rect(X(F.fx0), Y(y - b2), X(F.fx1), Y(y + b2), 1); sh.line(X(F.fx0), Y(y + (y === F.yL ? 1 : -1) * (b2 - F.sc)), X(F.fx1), Y(y + (y === F.yL ? 1 : -1) * (b2 - F.sc)), 4); });
      F.cross.forEach(c => c.top ? sh.rect(X(c.x - b2), Y(F.yL - b2), X(c.x + b2), Y(F.yR + b2), 1) : sh.rect(X(c.x - b2), Y(F.yL + b2), X(c.x + b2), Y(F.yR - b2), 1));
      F.padsR.forEach(p => sh.rect(X(p.x1), Y(p.y1), X(p.x2), Y(p.y2), 1));
      F.padsM.forEach(p => sh.rect(X(p.x1), Y(p.y1), X(p.x2), Y(p.y2), 1));
      const hole = (h, d) => { sh.circle(X(h.fx), Y(h.fy), d / 2 * k, 1); sh.line(X(h.fx) - d * k * 0.8, Y(h.fy), X(h.fx) + d * k * 0.8, Y(h.fy), 3).line(X(h.fx), Y(h.fy) - d * k * 0.8, X(h.fx), Y(h.fy) + d * k * 0.8, 3); };
      F.redHoles.forEach(h => hole(h, F.dRed)); F.motHoles.forEach(h => hole(h, F.dMot));
      sh.line(X(F.fx0) - 8, Y(F.axY), X(F.fx1) + 8, Y(F.axY), 3);
      // размеры: габарит, отверстия двигателя и редуктора
      const yb = Y(F.yL - b2);
      sh.dimV(X(F.fx1), Y(F.yL - b2), X(F.fx1), Y(F.yR + b2), X(F.fx1) + 12, nf(F.Wf));
      const ry = [...new Set(F.redHoles.map(h => Math.round(h.fy * 10) / 10))].sort((a, b) => a - b);
      const rxs = [...new Set(F.redHoles.map(h => Math.round(h.fx * 10) / 10))].sort((a, b) => a - b);
      const mxs = [...new Set(F.motHoles.map(h => Math.round(h.fx * 10) / 10))].sort((a, b) => a - b);
      const my = [...new Set(F.motHoles.map(h => Math.round(h.fy * 10) / 10))].sort((a, b) => a - b);
      if (ry.length > 1) sh.dimV(X(rxs[0]), Y(ry[0]), X(rxs[0]), Y(ry[ry.length - 1]), X(F.fx0) - 12, nf(ry[ry.length - 1] - ry[0]));
      if (my.length > 1) sh.dimV(X(mxs[mxs.length - 1]), Y(my[0]), X(mxs[mxs.length - 1]), Y(my[1]), X(F.fx1) + 22, nf(my[1] - my[0]));
      const chain = [F.fx0].concat(rxs, mxs);
      for (let i = 0; i + 1 < chain.length; i++) sh.attempt([0, 8].map(d => () => sh.dimH(X(chain[i]), Y(F.yL - b2), X(chain[i + 1]), Y(F.yL - b2), yb - 12 - d, nf(chain[i + 1] - chain[i]))));
      sh.attempt([0, 8].map(d => () => sh.dimH(X(F.fx0), Y(F.yL - b2), X(F.fx1), Y(F.yL - b2), yb - 30 - d, nf(F.Lf))));
      const call = (h, d, n) => sh.attempt([[12, 12], [-12, 12], [12, -12]].map(([dx, dy]) => () => sh.leader(X(h.fx) + Math.sign(dx) * d / 2 * k * 0.7, Y(h.fy) + Math.sign(dy) * d / 2 * k * 0.7, X(h.fx) + dx, Y(h.fy) + dy, `⌀${d}`, `${n} отв.`, { side: dx > 0 ? 'r' : 'l' })));
      call(F.redHoles[F.redHoles.length - 1], F.dRed, F.redHoles.length); call(F.motHoles[F.motHoles.length - 1], F.dMot, F.motHoles.length);
      // сварные швы: №1 — поперечины к продольным швеллерам, №2 — подкладки
      const weld = (x, y, tx, ty, t) => { sh.line(x, y, tx, ty, 2); sh.line(tx, ty, tx + (tx > x ? 9 : -9), ty, 2); sh.arrow(x, y, Math.atan2(y - ty, x - tx) * 180 / Math.PI, 2.2, 0.8); sh.text(tx + (tx > x ? 0.8 : -8.2), ty + 0.8, t, { h: 3.5 }); };
      const c0 = F.cross[0];
      weld(X(c0.x + b2), Y(F.yL + b2), X(c0.x + b2) + 14, Y(F.yL + b2) + 16, '№1');
      const pR = F.padsR[F.padsR.length - 1];
      weld(X(pR.x2), Y(pR.y2), X(pR.x2) + 12, Y(pR.y2) + 12, '№2');
      out.plan = { sh, items: [{ kind: 'long', pt: [X(F.fx0 + 25), Y(F.yR)] }, { kind: 'end', pt: [X(F.cross[0].x), Y((F.yL + F.yR) / 2)] }].concat(F.cross.filter(c => c.kind === 'motor').slice(0, 1).map(c => ({ kind: 'mot', pt: [X(c.x), Y(F.axY + (F.yR - F.yL) * 0.3)] })), [{ kind: 'padR', pt: [X((F.padsR[0].x1 + F.padsR[0].x2) / 2 + 20), Y(F.padsR[0].y2 - 3)] }], F.padsM.slice(0, 1).map(p => ({ kind: 'padM', pt: [X((p.x1 + p.x2) / 2), Y(p.y2 - 8)] }))) };
    }
    // ---- вид снизу: отверстия для крепления к полу
    {
      const sh = new Sheet('A1', true); sh.frame = { x1: -1e5, y1: -1e5, x2: 1e5, y2: 1e5 };
      const X = x => (x - F.fx0) * k, Y = y => (y - F.yL + F.bc / 2) * k;
      const b2 = F.bc / 2;
      [F.yL, F.yR].forEach(y => sh.rect(X(F.fx0), Y(y - b2), X(F.fx1), Y(y + b2), 1));
      F.cross.forEach(c => c.top ? [[F.yL + b2, F.yR - b2]].forEach(([a, b]) => sh.rect(X(c.x - b2), Y(a), X(c.x + b2), Y(b), 1)) : sh.rect(X(c.x - b2), Y(F.yL + b2), X(c.x + b2), Y(F.yR - b2), 1));
      F.floor.forEach(h => { sh.circle(X(h.fx), Y(h.fy), F.dF / 2 * k, 1); sh.line(X(h.fx), Y(h.fy) - F.dF * k, X(h.fx), Y(h.fy) + F.dF * k, 3); });
      sh.line(X(F.fx0) - 6, Y(F.yL), X(F.fx1) + 6, Y(F.yL), 3).line(X(F.fx0) - 6, Y(F.yR), X(F.fx1) + 6, Y(F.yR), 3);
      const xs = F.floor.filter(h => h.fy === F.yL).map(h => h.fx);
      const chain = [F.fx0].concat(xs);
      for (let i = 0; i + 1 < chain.length; i++) sh.dimH(X(chain[i]), Y(F.yL - b2), X(chain[i + 1]), Y(F.yL - b2), Y(F.yL - b2) - 12, nf(chain[i + 1] - chain[i]));
      sh.dimV(X(F.fx1), Y(F.yL), X(F.fx1), Y(F.yR), X(F.fx1) + 12, nf(F.yR - F.yL));
      const h = F.floor[0];
      sh.leader(X(h.fx) + F.dF / 2 * k * 0.7, Y(h.fy) + F.dF / 2 * k * 0.7, X(h.fx) + 12, Y(h.fy) + 14, `⌀${F.dF}`, `${F.floor.length} отв.`);
      out.bottom = { sh, items: [] };
    }
    void posOf;
    return out;
  }

  function frameSheet(R, P, T, code, spec) {
    const F = spec.F;
    const find = kind => { const it = partsOf(F); const idx = it.findIndex(q => q.key === kind); return idx >= 0 ? String(idx + 1) : ''; };
    const notes = ['1. Сварка ручная дуговая электродами Э42 ГОСТ 9467-75.', '2. Швы сварных соединений по ГОСТ 5264-80:', '   №1 — ГОСТ 5264-80-Т3-△5; №2 — ГОСТ 5264-80-Н1-△4.', '3. Опорные поверхности подкладок обработать после сварки; неплоскостность — не более 0,2 мм на длине 1000 мм.', '4. Острые кромки притупить. Окалину и брызги металла удалить.', '5. Покрытие: грунт ГФ-021 ГОСТ 25129-82, эмаль ПФ-115 ГОСТ 6465-76.'];
    for (const [k, kt] of [[0.5, '1:2'], [0.4, '1:2,5'], [0.25, '1:4'], [0.2, '1:5'], [0.1, '1:10']]) {
      for (const fmt of ['A3', 'A2', 'A1']) {
        const V = frameViews(F, k);
        Object.values(V).forEach(g => { if (g.items.length) { const used = new Set(); DRWASMpositions(g.sh, g.items.map(it => Object.assign({ pos: find(it.kind) }, it)).filter(it => it.pos && !used.has(it.pos) && used.add(it.pos))); } });
        const sh = new Sheet(fmt, true), f = sh.frame;
        sh.occupy(sh.stamp, 2); sh.occupy(sh.reserved(), 2);
        let hN = 0; notes.forEach(t => { hN += C.wrap(String(t), 176, 3.5).length; }); hN = hN * 3.5 * 1.65;
        sh.notes(sh.stamp.x1 + 2, sh.stamp.y2 + 6, 180, notes); sh.occupy({ x1: sh.stamp.x1, y1: sh.stamp.y2 + 4, x2: f.x2 - 2, y2: sh.stamp.y2 + 8 + hN }, 2);
        const fb = V.front.sh.bbox(0);
        const sL = Math.max(0, fb.x1 - V.plan.sh.bbox(0).x1), p1 = DR.placeGroup(sh, V.front.sh.p, { near: [f.x1 + 15 + sL + (fb.x2 - fb.x1) / 2, f.y2 - 15 - (fb.y2 - fb.y1) / 2] });
        if (!p1) continue;
        const pb = V.plan.sh.bbox(0);
        const p2_ = DR.placeGroup(sh, V.plan.sh.p, { fixX: p1.dx, near: [0, p1.box.y1 - 10 - (pb.y2 - pb.y1) / 2] });
        if (!p2_) continue;
        const bb = V.bottom.sh.bbox(0);
        const p3 = DR.placeGroup(sh, V.bottom.sh.p, { near: [p2_.box.x2 + 20 + (bb.x2 - bb.x1) / 2, p2_.box.y1 + (bb.y2 - bb.y1) / 2] });
        if (!p3) continue;
        sh.text((p3.box.x1 + p3.box.x2) / 2, p3.box.y2 + 4, 'А', { h: 7, anchor: 'cb' });
        sh.text((p3.box.x1 + p3.box.x2) / 2, p3.box.y2 - 2, 'Отверстия для крепления к полу', { h: 3.5, anchor: 'ct' });
        // стрелка взгляда «А» снизу на виде спереди
        const mass = partsOf(F).reduce((a, it) => a + it.mass, 0);
        return { id: 'rama_sb', file: 'rama_SB.cdw', code: `${code} 02.00.00 СБ`, name: 'Рама сварная\nСборочный чертёж', material: '', mass: nf(mass, 0), scale: kt, fmt, landscape: true, sh };
      }
    }
    return null;
  }
  const DRWASMpositions = (sh, list) => root.DRWASM.positions(sh, list);

  root.DRWFRAME = { frameLayout, frameSpec, frameSheet, partsOf, CH };
})(typeof window !== 'undefined' ? window : globalThis);
