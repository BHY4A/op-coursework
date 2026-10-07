/* kompas.js — файлы для КОМПАС-3D v25: данные модели, Python-макросы, DXF, спецификации, подсказки по размерам */
(function (root) {
  'use strict';
  const F = root.F;
  const fnum = (x, s) => F.fnum(x, s);
  const r1 = x => Math.round(x * 10) / 10;
  const esc = t => String(t === undefined || t === null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const p2 = x => String(x).padStart(2, '0');

  function codeOf(P, T) { return (T.code || ('ОП КП ' + p2(P.task) + '-' + p2(P.v))).trim(); }
  const keyDim = k => k ? { b: k.b, h: k.h, t1: k.t1, t2: k.t2, l: k.l } : null;
  const segsOut = segs => segs.map(s => ({ d: r1(s.d), l: r1(s.l), name: s.name, key: keyDim(s.keyDim), gear: s.gear ? Object.assign({}, s.gear) : null }));
  const sumL = segs => segs.reduce((a, s) => a + s.l, 0);
  const midOf = (segs, test) => { let x = 0; for (const s of segs) { if (test(s)) return x + s.l / 2; x += s.l; } return x / 2; };
  const keyOf = (R, joint) => (R.keys || []).find(k => k.joint === joint);
  const AX_X = [1, 0, 0, 0, 1, 0], AX_Y = [0, 1, 0, -1, 0, 0], AX_Z = [0, 0, 1, 0, 1, 0];

  /* ---------- модель: детали, сборка, чертежи ---------- */
  function model(R, P, T) {
    const code = codeOf(P, T), D = root.DATA;
    const parts = [], asm = [], drawings = [];
    let n = 1;
    const add = (id, name, kind, geom, material, extra) => { const c = `${code} 01.00.${p2(n++)}`; const pd = Object.assign({ id, code: c, name, kind, geom, material: material || 'Сталь 45 ГОСТ 1050-2013', density: 7.85, file: `${id}.m3d` }, extra || {}); parts.push(pd); return pd; };
    const wheelGeom = (o) => Object.assign({ teeth: true }, o);
    const sh = R.shafts;
    const notesShaft = (segs) => {
      const fits = [];
      segs.forEach(s => { if (/подшипник/.test(s.name)) fits.push(`⌀${s.d}k6 — ${s.name}`); else if (/ступиц/.test(s.name)) fits.push(`⌀${s.d}k6 — ${s.name}`); else if (/выходной/.test(s.name)) fits.push(`⌀${s.d}m6 — ${s.name}`); else if (/манжет/.test(s.name)) fits.push(`⌀${s.d}h11, Ra 0,32 — ${s.name}`); });
      return ['1. 240…280 HB.', '2. Неуказанные радиусы скруглений 1 мм.', '3. Неуказанные предельные отклонения размеров: отверстий +t2, валов −t2, остальных ±t2/2.', '4. Поля допусков посадочных поверхностей:'].concat(fits.slice(0, 6).map(f => '   ' + f));
    };
    const gearTable = (m, z, d, extra) => [['Модуль', 'm', fnum(m, 0)], ['Число зубьев', 'z', String(z)], ['Тип зуба', '—', 'прямой'], ['Исходный контур', '—', 'ГОСТ 13755-2015'], ['Коэффициент смещения', 'x', '0'], ['Степень точности', '—', '8-B ГОСТ 1643-81'], ['Делительный диаметр', 'd', fnum(d, 4)]].concat(extra || []);
    const dShaft = (pd, segs) => { const L = sumL(segs); const sc = L <= 330 ? 1 : L <= 600 ? 0.5 : 0.4; drawings.push({ part: pd.id, file: pd.id + '.cdw', format: 'A3', landscape: true, scale: sc, scaleText: sc === 1 ? '1:1' : sc === 0.5 ? '1:2' : '1:2,5', vx: 40, vy: 160, notes: notesShaft(segs), tx: 25, ty: 70 }); };
    const dWheel = (pd, table) => { const da = pd.geom.da || pd.geom.De || 200; const sc = da <= 230 ? 1 : da <= 460 ? 0.5 : 0.4; drawings.push({ part: pd.id, file: pd.id + '.cdw', format: 'A3', landscape: true, scale: sc, scaleText: sc === 1 ? '1:1' : sc === 0.5 ? '1:2' : '1:2,5', vx: 140, vy: 150, notes: ['1. 240…280 HB.', '2. *Размеры для справок.', '3. Неуказанные радиусы скруглений 2 мм max.', '4. Неуказанные предельные отклонения размеров: отверстий +t2, валов −t2, остальных ±t2/2.'], tx: 25, ty: 70, table, tabX: 300, tabY: 275 }); };
    const H = R.H || {};
    const box = (L, B, Hh, bores, up) => add('korpus', 'Корпус', 'housing', { L: r1(L), B: r1(B), H: r1(Hh), del: H.del || 8, flange: Math.round((H.K2 || 30) * 0.8), p: H.p || 20, up: up || 'z', bores }, 'СЧ15 ГОСТ 1412-85', { density: 7.1 });
    if (R.task === 3) {
      const g = R.g, w = R.wheel, kW = keyOf(R, 'wheel'), kS = keyOf(R, 'sprocket'), chn = R.chn, dims = R.dims, L = R.L;
      const sI = segsOut(sh.I), sII = segsOut(sh.II);
      const xw = midOf(sI, s => s.gear), xh = midOf(sII, s => /ступиц/.test(s.name)), xs = midOf(sII, s => /звёздочк/.test(s.name));
      const zb = -(g.da1 / 2 + (H.gapBot || 30)), Hh = g.aw + g.daM2 / 2 + (H.gap || 10) + (H.del || 8) - zb;
      const pk = box(L.l1c + 2 * (H.del || 8) + 20, L.l2c + 2 * (H.del || 8), Hh, [{ axis: 'x', y: 0, z: r1(-zb - Hh / 2), D: R.b1.D }, { axis: 'y', x: 0, z: r1(g.aw - zb - Hh / 2), D: R.b2.D }]);
      const p1 = add('val_cherv', 'Червяк', 'shaft', { segs: sI }, 'Сталь 45 ГОСТ 1050-2013');
      const p2_ = add('val_kolesa', 'Вал', 'shaft', { segs: sII });
      const p3 = add('koleso_cherv', 'Колесо червячное', 'wormwheel', wheelGeom({ da: g.da2, daM: g.daM2, df: g.df2, d: g.d2, b: g.b2, aw: g.aw, Ra: g.Ra, z: g.z2, m: g.m, dbore: w.dpos, dst: w.dst, lst: w.lst, e: w.e, d0: w.del0, key: keyDim(kW) }), 'БрА9Ж3Л ГОСТ 493-79 / СЧ15', { density: 7.6 });
      const p4 = add('zvezdochka', 'Звёздочка ведущая', 'sprocket', { z: chn.z1, t: chn.t, dd: r1(chn.dd1), De: r1(chn.De1), d1: chn.chain.d1, b: r1(0.93 * chn.chain.Bvn - 0.15), dbore: dims.dv2, dst: Math.round(1.6 * dims.dv2), lst: dims.lv2, key: keyDim(kS) });
      asm.push({ file: pk.file, pos: [xw, 0, zb + Hh / 2], axes: AX_X }, { file: p1.file, pos: [0, 0, 0], axes: AX_X }, { file: p2_.file, pos: [xw, -xh, g.aw], axes: AX_Y }, { file: p3.file, pos: [xw, 0, g.aw], axes: AX_Y }, { file: p4.file, pos: [xw, xs - xh, g.aw], axes: AX_Y });
      dShaft(p1, sI); dShaft(p2_, sII);
      dWheel(p3, gearTable(g.m, g.z2, g.d2, [['Коэф. диаметра червяка', 'q', fnum(g.q, 0)], ['Число витков червяка', 'z1', String(g.z1)], ['Межосевое расстояние', 'aw', fnum(g.aw, 4)]]));
      dWheel(p4, [['Шаг цепи', 't', fnum(chn.t, 0)], ['Число зубьев', 'z', String(chn.z1)], ['Диаметр ролика', 'd1', fnum(chn.chain.d1, 0)], ['Делительный диаметр', 'dд', fnum(chn.dd1, 4)], ['Цепь', '—', chn.code + ' ГОСТ 13568-75']]);
    } else if (R.task === 6) {
      const gB = R.gB, gT = R.gT, w2 = R.w2, w4 = R.w4, L = R.L, chn = R.chn, dims = R.dims;
      const sI = segsOut(sh.I), sII = segsOut(sh.II), sIII = segsOut(sh.III);
      const xs3 = midOf(sIII, s => /звёздочк/.test(s.name));
      const Wx = L.W + 2 * (H.del || 8), By = gB.aw + gT.aw + gT.da2 / 2 + gB.da1 / 2 + 2 * ((H.gap || 10) + (H.del || 8));
      const zb = -(gT.da2 / 2 + (H.gapBot || 30)), Hh = gT.da2 / 2 + (H.gap || 10) + (H.del || 8) - zb;
      const y0 = -(gB.da1 / 2 + (H.gap || 10) + (H.del || 8));
      const pk = box(Wx, By, Hh, []);
      const pI = add('val_I', 'Вал-шестерня', 'shaft', { segs: sI }), pII = add('val_II', 'Вал-шестерня промежуточный', 'shaft', { segs: sII }), pIII = add('val_III', 'Вал тихоходный', 'shaft', { segs: sIII });
      const kz2 = keyOf(R, 'wheel2'), kz4 = keyOf(R, 'wheel4'), kS = keyOf(R, 'sprocket');
      const pz2 = add('koleso_z2', 'Колесо зубчатое быстроходной ступени', 'wheel', wheelGeom({ da: gB.da2, df: gB.df2, d: gB.d2, b: gB.b2, z: gB.z2, m: gB.m, dbore: dims.dpos2, dst: w2.dst, lst: w2.lst, e: w2.e, d0: w2.d0, key: keyDim(kz2) }), 'Сталь 40 ГОСТ 1050-2013');
      const pz4 = add('koleso_z4', 'Колесо зубчатое тихоходной ступени', 'wheel', wheelGeom({ da: gT.da2, df: gT.df2, d: gT.d2, b: gT.b2, z: gT.z2, m: gT.m, dbore: dims.dpos3, dst: w4.dst, lst: w4.lst, e: w4.e, d0: w4.d0, key: keyDim(kz4) }), 'Сталь 40 ГОСТ 1050-2013');
      const psp = add('zvezdochka', 'Звёздочка ведущая', 'sprocket', { z: chn.z1, t: chn.t, dd: r1(chn.dd1), De: r1(chn.De1), d1: chn.chain.d1, b: r1(0.93 * chn.chain.Bvn - 0.15), dbore: dims.dv3, dst: Math.round(1.6 * dims.dv3), lst: dims.lv3, key: keyDim(kS) });
      asm.push({ file: pk.file, pos: [L.W / 2, y0 + By / 2, zb + Hh / 2], axes: AX_X });
      asm.push({ file: pI.file, pos: [-R.b1.B, 0, 0], axes: AX_X }, { file: pII.file, pos: [-R.b2.B, gB.aw, 0], axes: AX_X }, { file: pIII.file, pos: [-R.b3.B, gB.aw + gT.aw, 0], axes: AX_X });
      asm.push({ file: pz2.file, pos: [L.a2 - R.b2.B / 2, gB.aw, 0], axes: AX_X }, { file: pz4.file, pos: [L.a3 - R.b3.B / 2, gB.aw + gT.aw, 0], axes: AX_X }, { file: psp.file, pos: [xs3 - R.b3.B, gB.aw + gT.aw, 0], axes: AX_X });
      [pI, pII, pIII].forEach((p, i) => dShaft(p, [sI, sII, sIII][i]));
      dWheel(pz4, gearTable(gT.m, gT.z2, gT.d2)); dWheel(pz2, gearTable(gB.m, gB.z2, gB.d2));
      if (R.drum) {
        const dr = R.drum, kd = (dr.keys || [])[0], kz = (dr.keys || [])[1];
        const segs = [{ d: dr.dv, l: dr.lz, name: 'под ведомую звёздочку', key: keyDim(kz) }, { d: dr.dp, l: 30 + dr.b4.B, name: 'подшипник B' }, { d: dr.dbar, l: dr.l4 - dr.b4.B - 60, name: 'под ступицы барабана', key: keyDim(kd) }, { d: dr.dp, l: 30 + dr.b4.B, name: 'подшипник A' }];
        const pd = add('val_barabana', 'Вал приводной (барабана)', 'shaft', { segs: segs.map(s => Object.assign({}, s, { d: r1(s.d), l: r1(s.l) })) });
        pd.code = `${code} 03.00.01`;
        dShaft(pd, segs);
      }
    } else {
      const gC = R.gC, gT = R.gT, wC = R.wC, wT = R.wT, L = R.L, dims = R.dims;
      const sI = segsOut(sh.I), sII = segsOut(sh.II), sIII = segsOut(sh.III);
      const kC = keyOf(R, 'wheelC'), kT = keyOf(R, 'wheelT');
      // коническая пара: вершины делительных конусов совпадают. Шестерня — первая ступень вала I (x = 0…l, внешний торец при x = l):
      // ось колеса проходит через вершину конуса шестерни; колесо ставится центром ступицы (по профилю рабочего чертежа) на ступень вала II
      const d1r = gC.d1deg * Math.PI / 180, zI = 0;
      const xII = sI[0].l - gC.Re * Math.cos(d1r);
      const xcHub = (() => {
        try { const W = root.DRAWINGS.wheelProfile({ de: gC.de2, dae: gC.dae2, b: gC.b, Re: gC.Re, delta: gC.d2deg, mte: gC.mte, dbore: dims.d2p, dst: wC.dst, lst: wC.lst, key: keyDim(keyOf(R, 'wheelC')) }, 'bevel'); return (W.x0 + W.x1) / 2; }
        catch (e) { return gC.Rm * Math.cos(gC.d2deg * Math.PI / 180); }
      })();
      const zC = zI - xcHub;
      const xpII = midOf(sII, s => /коническ/.test(s.name)), xgII = midOf(sII, s => s.gear), xwIII = midOf(sIII, s => /ступиц/.test(s.name));
      const pk = box(gT.aw + gT.da2 / 2 + gC.de2 / 2 + 60, Math.max(gT.da2, gC.de2) + 40, sumL(sII) + 30, [], 'y');
      const pI = add('val_shesternya', 'Вал-шестерня коническая', 'shaft', { segs: sI }), pII = add('val_II', 'Вал-шестерня цилиндрическая', 'shaft', { segs: sII }), pIII = add('val_III', 'Вал тихоходный', 'shaft', { segs: sIII });
      const pC = add('koleso_kon', 'Колесо коническое', 'bevel', { de: gC.de2, dae: gC.dae2, dfe: gC.dfe2, b: gC.b, Re: gC.Re, delta: gC.d2deg, z: gC.z2, mte: gC.mte, dbore: dims.d2p, dst: wC.dst, lst: wC.lst, key: keyDim(kC) }, 'Сталь 40 ГОСТ 1050-2013');
      const pT = add('koleso_cil', 'Колесо зубчатое', 'wheel', wheelGeom({ da: gT.da2, df: gT.df2, d: gT.d2, b: gT.b2, z: gT.z2, m: gT.m, dbore: dims.d3ppp, dst: wT.dst, lst: wT.lst, e: wT.e, d0: wT.d0, key: keyDim(kT) }), 'Сталь 40 ГОСТ 1050-2013');
      // тихоходный вал — по другую сторону от промежуточного, чем вал-шестерня (иначе оси I и III пересекаются)
      asm.push({ file: pk.file, pos: [xII - gT.aw / 2, 0, zC - xpII + sumL(sII) / 2], axes: AX_X });
      asm.push({ file: pI.file, pos: [0, 0, zI], axes: AX_X }, { file: pII.file, pos: [xII, 0, zC - xpII], axes: AX_Z }, { file: pC.file, pos: [xII, 0, zC], axes: AX_Z });
      asm.push({ file: pIII.file, pos: [xII - gT.aw, 0, zC - xpII + xgII - xwIII], axes: AX_Z }, { file: pT.file, pos: [xII - gT.aw, 0, zC - xpII + xgII], axes: AX_Z });
      [pI, pII, pIII].forEach((p, i) => dShaft(p, [sI, sII, sIII][i]));
      dWheel(pT, gearTable(gT.m, gT.z2, gT.d2));
      // редуктор с вертикальным тихоходным валом (задание 1, рис. 2.12): поворот компоновки на 90° вокруг оси входного вала X —
      // промежуточный и тихоходный валы становятся вертикальными (ось Y вверх), выходной конец тихоходного вала — вверх
      const rot = v => [v[0], v[2], -v[1]];
      asm.forEach(it => { it.pos = rot(it.pos); it.axes = rot(it.axes.slice(0, 3)).concat(rot(it.axes.slice(3))); });
      dWheel(pC, [['Внешний окружной модуль', 'mte', fnum(gC.mte, 4)], ['Число зубьев', 'z', String(gC.z2)], ['Тип зуба', '—', 'прямой'], ['Исходный контур', '—', 'ГОСТ 13754-81'], ['Угол делительного конуса', 'δ', F.degTxt(gC.d2deg)], ['Внешнее конусное расстояние', 'Re', fnum(gC.Re, 4)], ['Средний делительный диаметр', 'd', fnum(gC.dm2, 4)], ['Степень точности', '—', '8-B ГОСТ 1758-81']]);
    }
    // облегчающие отверстия в диске колеса — те же, что на чертеже колеса (DRAWINGS.wheelProfile)
    // коническое колесо — по профилю рабочего чертежа (ступица, диск, венец); x — от середины ступицы, +x — к вершине делительного конуса (к оси шестерни)
    parts.forEach(pd => { if (pd.kind === 'bevel' && root.DRAWINGS && root.DRAWINGS.wheelProfile && pd.geom.Re) { try { const W = root.DRAWINGS.wheelProfile(pd.geom, 'bevel'), x0 = pd.geom.Re * Math.cos(pd.geom.delta * Math.PI / 180); const xc = (W.x0 + W.x1) / 2; pd.geom.prof = W.pieces[0].map(([x, y]) => [Math.round((xc - x) * 100) / 100, Math.round(y * 100) / 100]).reverse(); pd.geom.hubx = [Math.round((xc - W.x1) * 100) / 100, Math.round((xc - W.x0) * 100) / 100]; void x0; } catch (e) { /* упрощённо */ } } });
    parts.forEach(pd => { if ((pd.kind === 'wheel' || pd.kind === 'wormwheel') && root.DRAWINGS && root.DRAWINGS.wheelProfile) { try { const h = root.DRAWINGS.wheelProfile(pd.geom, pd.kind).holes; if (h) pd.geom.holes = { d: h.d, Dc: h.Dc, n: h.n }; } catch (e) { /* без отверстий */ } } });
    return { code, parts, asm: { file: 'reduktor.a3d', code: `${code} 01.00.00`, name: 'Редуктор', items: asm }, drawings };
  }

  /* ---------- спецификации (ГОСТ 2.106, форма 1) ---------- */
  function specs(R, P, T, opt) {
    opt = opt || {};
    const code = codeOf(P, T), M = model(R, P, T), task = root.DATA.TASKS[P.task];
    const det = M.parts.filter(p => !/03\.00/.test(p.code));
    let pos = 0;
    const items = [];
    // КОМПАС оставляет 2 резервные позиции между разделами (так нумерует его спецификация) — нумеруем так же
    const S = (title, num, list) => { if (pos && list.some(x => !x.noPos)) pos += 2; return { title, num, items: list.map(x => Object.assign({ pos: x.noPos ? '' : String(++pos) }, x)) }; };
    const bear = [];
    const brg = (b, q) => { if (b) bear.push({ name: `Подшипник ${b.id} ${b.gost || ''}`.trim(), qty: q }); };
    if (R.task === 3) { brg(R.BR1 ? R.BR1.b : R.b1, 2); brg(R.BR2 ? R.BR2.b : R.b2, 2); }
    else if (R.task === 6) { brg(R.BR1 ? R.BR1.b : R.b1, 2); brg(R.BR2 ? R.BR2.b : R.b2, 2); brg(R.BR3 ? R.BR3.b : R.b3, 2); }
    else { brg(R.BR1 ? R.BR1.b : R.b1, 2); brg(R.BR2 ? R.BR2.b : R.b2, 2); brg(R.BR3 ? R.BR3.b : R.b3, 2); }
    const H = R.H || {};
    const seals = []; for (const k of Object.keys(R.shafts || {})) for (const s of R.shafts[k]) if (/манжет/.test(s.name)) { const sl = root.MECH.seal(s.d); seals.push({ name: `Манжета 1-${sl.d}×${sl.D} ГОСТ 8752-79`, qty: 1 }); }
    const keys = (R.keys || []).filter(k => k.joint !== 'coupling1').map(k => ({ name: `Шпонка ${k.b}×${k.h}×${k.l} ГОСТ 23360-78`, qty: k.two ? 2 : 1 }));
    const nShafts = Object.keys(R.shafts || {}).length;
    // крышки подшипников: у вала-шестерни в стакане (задание 1) — одна, у остальных — по две; сквозная — где есть манжета
    let nB = 0, nT = 0, nSl = 0;
    for (const kk of Object.keys(R.shafts || {})) {
      const sg = R.shafts[kk], seal = sg.some(q => /манжет/.test(q.name)), cart = R.task === 1 && kk === 'I';
      const n = cart ? 1 : 2; if (seal) { nT++; nB += n - 1; } else nB += n;
      nSl += sg.filter(q => /втулк/.test(q.name)).length;
    }
    let F0 = null; try { F0 = root.M3D && root.M3D.housing3d(R, P, T || {}).fasteners; } catch (e) { F0 = null; }
    const mslName = F0 && F0.lanternAt && F0.lanternAt.kind === 'dip' ? 'Маслоуказатель жезловый' : 'Маслоуказатель фонарный';
    const extraParts = [{ fmt: (opt.formats || {}).kryshka_korpusa || 'А2', name: 'Крышка корпуса', qty: 1 }, { fmt: 'А4', name: 'Крышка подшипника глухая', qty: nB }, { fmt: 'А4', name: 'Крышка подшипника сквозная', qty: nT }]
      .concat(nSl ? [{ fmt: 'А4', name: 'Втулка распорная', qty: nSl }] : [], [{ fmt: 'А4', name: 'Крышка смотрового люка', qty: 1 }, { fmt: 'А4', name: mslName, qty: 1 }, { fmt: 'А4', name: 'Ручка-отдушина', qty: 1 }, { fmt: 'А4', name: 'Набор прокладок регулировочных', qty: nB + nT }]);
    // крепёж — по 3D-модели корпуса (число и длина болтов, винтов, штифтов); если модель не построена — по старым нормам
    function fastItems() {
      let F = null;
      try { F = root.M3D && root.M3D.housing3d(R, P, T || {}).fasteners; } catch (e) { F = null; }
      if (!F) return [{ name: `Болт М${H.d2 || 12}×${(H.d2 || 12) * 8} ГОСТ 7798-70`, qty: 4 * Math.max(2, nShafts) }, { name: `Болт М${H.d3 || 8}×${(H.d3 || 8) * 4} ГОСТ 7798-70`, qty: 6 }, { name: `Винт М${H.dks || 8}×${(H.dks || 8) * 3} ГОСТ 7808-70`, qty: 4 * (nB + nT) }, { name: 'Штифт 8×30 ГОСТ 3129-70', qty: 2 }, { name: `Пробка М${H.dpr || 16}×1,5`, qty: 1 }];
      const L = [], add = (name, qty) => { if (!qty) return; const o = L.find(x => x.name === name); if (o) o.qty += qty; else L.push({ name, qty }); };
      const BB = [].concat(F.b2 || [], F.b3 || []);
      BB.forEach(b => add(`Болт М${b.d}×${b.L} ГОСТ 7798-70`, b.n));
      if (F.screws.n) add(`Винт М${F.screws.d}×${F.screws.L} ГОСТ 7808-70`, F.screws.n);
      if (F.lid) add(`Винт М${F.lid.d}×${F.lid.L} ГОСТ 7808-70`, F.lid.n);
      if (F.lantern) add(`Винт М${F.lantern.d}×${F.lantern.L} ГОСТ 7808-70`, F.lantern.n);
      BB.forEach(b => add(`Гайка М${b.d} ГОСТ 5915-70`, b.n));
      add(`Пробка М${F.plug || H.dpr || 16}×1,5`, 1);
      BB.forEach(b => add(`Шайба ${b.d} 65Г ГОСТ 6402-70`, b.n));
      add(`Штифт ${F.pins.d}×${F.pins.L} ГОСТ 3129-70`, F.pins.n);
      return L;
    }
    const red = {
      file: 'spec_reduktor.cdw', code: `${code} 01.00.00`, name: 'Редуктор',
      sections: [
        S('Документация', 5, [{ fmt: 'А1', code: `${code} 01.00.00 СБ`, name: 'Сборочный чертёж', noPos: true }]),
        S('Детали', 20, det.map(p => ({ fmt: /Корпус/.test(p.name) ? ((opt.formats || {}).korpus || 'А2') : ((opt.formats || {})[p.id] || 'А3'), code: p.code, name: p.name, qty: 1 })).concat(
          extraParts.map((e, i) => Object.assign({ code: `${code} 01.00.${p2(det.length + 1 + i)}` }, e)))),
        S('Стандартные изделия', 25, fastItems().concat(bear, seals, keys).sort((a, b) => (/^Пробка/.test(a.name) - /^Пробка/.test(b.name)) || a.name.localeCompare(b.name, 'ru', { numeric: true }))  /* так сортирует КОМПАС: пробка — в конце раздела */),
        S('Материалы', 35, [{ name: `Масло ${R.oil || 'И-Т-С-220'} ГОСТ 17479.4-87`, qty: '', note: R.V ? fnum(R.V, 2) + ' л' : '' }])
      ]
    };
    pos = 0;
    const drv = {
      file: 'spec_privod.cdw', code: `${code} 00.00.00`, name: task.title,
      sections: [
        S('Документация', 5, [{ fmt: (opt.formats || {}).obshiy_vid || 'А1', code: `${code} 00.00.00 ВО`, name: 'Чертёж общего вида', noPos: true }, { fmt: 'А4', code: `${code} 00.00.00 ПЗ`, name: 'Пояснительная записка', noPos: true }]),
        S('Сборочные единицы', 15, [{ fmt: 'А1', code: `${code} 01.00.00`, name: 'Редуктор', qty: 1 }, { fmt: (opt.formats || {}).rama_sb || 'А2', code: `${code} 02.00.00`, name: 'Рама', qty: 1 }].concat(R.task === 6 ? [{ fmt: (opt.formats || {}).val_baraban_sb || 'А1', code: `${code} 03.00.00`, name: 'Вал приводной с барабаном', qty: 1 }] : [])),
        S('Стандартные изделия', 25, [{ name: `Электродвигатель ${R.motor.type}`, qty: 1 }, { name: R.cp ? R.cp.code.replace('Муфта упругая втулочно-пальцевая', 'Муфта') : 'Муфта упругая втулочно-пальцевая', qty: 1 }].concat(R.chn ? [{ name: `Цепь ${R.chn.code} ГОСТ 13568-75`, qty: 1 }] : [], [{ name: `Болт фундаментный М${H.d1 || 16}`, qty: 8 }]).sort((a, b) => a.name.localeCompare(b.name, 'ru', { numeric: true })))
      ]
    };
    const out = [red, drv];
    if (root.DRWFRAME) { try { const fr = root.DRWFRAME.frameSpec(R, P, T, code); if (fr) { if ((opt.formats || {}).rama_sb) fr.sections[0].items[0].fmt = opt.formats.rama_sb; out.push(fr); } } catch (e) { console.error(e); } }
    if (R.task === 6 && R.drum && root.DRWDRUM) { try { const ds = root.DRWDRUM.spec(R, P, T, code, `${code} 03.00.01`); if (ds) { if ((opt.formats || {}).val_baraban_sb) ds.sections[0].items[0].fmt = opt.formats.val_baraban_sb; out.push(ds); } } catch (e) { console.error(e); } }
    return out;
  }

  /* ---------- DXF (R12, ASCII) ---------- */
  function Dxf() { this.e = []; }
  Dxf.prototype.line = function (x1, y1, x2, y2, layer) { this.e.push(['LINE', layer || 'CONTOUR', [10, x1, 20, y1, 30, 0, 11, x2, 21, y2, 31, 0]]); return this; };
  Dxf.prototype.circle = function (x, y, r, layer) { this.e.push(['CIRCLE', layer || 'CONTOUR', [10, x, 20, y, 30, 0, 40, r]]); return this; };
  Dxf.prototype.text = function (x, y, h, t, layer) { const u = String(t).replace(/[^\x20-\x7e]/g, c => '\\U+' + c.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0')); this.e.push(['TEXT', layer || 'TEXT', [10, x, 20, y, 30, 0, 40, h, 1, u]]); return this; };
  Dxf.prototype.poly = function (pts, layer, closed) { for (let i = 0; i < pts.length - (closed === false ? 1 : 0); i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; if (Math.abs(a[0] - b[0]) > 1e-9 || Math.abs(a[1] - b[1]) > 1e-9) this.line(a[0], a[1], b[0], b[1], layer); } return this; };
  Dxf.prototype.toString = function () {
    const num = v => typeof v === 'number' ? (+v.toFixed(4)).toString() : v;
    let s = '0\nSECTION\n2\nHEADER\n9\n$ACADVER\n1\nAC1009\n9\n$DWGCODEPAGE\n3\nANSI_1251\n9\n$INSUNITS\n70\n4\n0\nENDSEC\n0\nSECTION\n2\nTABLES\n0\nTABLE\n2\nLAYER\n70\n3\n';
    for (const [n, c] of [['CONTOUR', 7], ['AXIS', 1], ['TEXT', 3]]) s += `0\nLAYER\n2\n${n}\n70\n0\n62\n${c}\n6\nCONTINUOUS\n`;
    s += '0\nENDTAB\n0\nENDSEC\n0\nSECTION\n2\nENTITIES\n';
    for (const [type, layer, codes] of this.e) { s += `0\n${type}\n8\n${layer}\n`; for (let i = 0; i < codes.length; i += 2) s += `${codes[i]}\n${num(codes[i + 1])}\n`; }
    return s + '0\nENDSEC\n0\nEOF\n';
  };
  function dxfShaft(pd) {
    const d = new Dxf(), segs = pd.geom.segs; let x = 0, prev = 0;
    segs.forEach((s, i) => {
      const r = s.d / 2;
      d.line(x, -Math.max(r, prev), x, Math.max(r, prev));
      d.line(x, r, x + s.l, r); d.line(x, -r, x + s.l, -r);
      if (s.key) { const xc = x + s.l / 2, a = xc - s.key.l / 2, b = xc + s.key.l / 2; d.line(a, r - s.key.t1, b, r - s.key.t1); d.line(a, r, a, r - s.key.t1); d.line(b, r, b, r - s.key.t1); }
      d.text(x + 1, -r - 6, 2.5, `D${s.d} L${s.l}`);
      prev = r; x += s.l;
    });
    d.line(x, -prev, x, prev); d.line(-5, 0, x + 5, 0, 'AXIS');
    d.text(0, Math.max(...segs.map(s => s.d)) / 2 + 8, 3.5, `${pd.code} ${pd.name}`);
    return d.toString();
  }
  function dxfWheel(pd) {
    const g = pd.geom, d = new Dxf();
    const ra = (g.da || g.dae || g.De) / 2, rb = g.dbore / 2, rh = g.dst / 2, hb = (g.b || 20) / 2, hl = g.lst / 2, he = (g.e || hb * 2) / 2;
    const rr = Math.max(rh + 2, (g.df || g.dfe || ra * 1.8) / 2 - (g.d0 || 6));
    const pts = [[-hl, rb], [hl, rb], [hl, rh], [he, rh], [he, rr], [hb, rr], [hb, ra], [-hb, ra], [-hb, rr], [-he, rr], [-he, rh], [-hl, rh]];
    d.poly(pts); d.poly(pts.map(([x, y]) => [x, -y]));
    d.line(-hl - 8, 0, hl + 8, 0, 'AXIS');
    // вид слева: окружности
    const cx = hl + ra + 30;
    d.circle(cx, 0, ra); if (g.df) d.circle(cx, 0, g.df / 2); d.circle(cx, 0, rh); d.circle(cx, 0, rb);
    if (g.dd) d.circle(cx, 0, g.dd / 2, 'AXIS');
    d.line(cx - ra - 5, 0, cx + ra + 5, 0, 'AXIS'); d.line(cx, -ra - 5, cx, ra + 5, 'AXIS');
    d.text(-hl, ra + 10, 3.5, `${pd.code} ${pd.name}`);
    return d.toString();
  }
  function dxfBox(pd) {
    const g = pd.geom, d = new Dxf(), L = g.L, B = g.B, s = g.del, f = g.flange || 0;
    d.poly([[-L / 2, -B / 2], [L / 2, -B / 2], [L / 2, B / 2], [-L / 2, B / 2]]);
    d.poly([[-L / 2 + s, -B / 2 + s], [L / 2 - s, -B / 2 + s], [L / 2 - s, B / 2 - s], [-L / 2 + s, B / 2 - s]]);
    if (f) d.poly([[-L / 2 - f, -B / 2 - f], [L / 2 + f, -B / 2 - f], [L / 2 + f, B / 2 + f], [-L / 2 - f, B / 2 + f]]);
    d.line(-L / 2 - f - 10, 0, L / 2 + f + 10, 0, 'AXIS'); d.line(0, -B / 2 - f - 10, 0, B / 2 + f + 10, 'AXIS');
    d.text(-L / 2, B / 2 + f + 8, 3.5, `${pd.code} ${pd.name} (план, высота ${g.H} мм)`);
    return d.toString();
  }

  /* ---------- файлы ---------- */
  /* листы чертежей (рабочие + сборочный), с кешем на объект результата расчёта */
  const SHEETS = new WeakMap();
  /* построение листов по этапам: генератор отдаёт название следующего этапа — синхронно (sheets) или с паузами для отрисовки (sheetsAsync) */
  function* sheetsGen(R, P, T) {
    const key = JSON.stringify({ c: codeOf(P, T || {}), s: (T || {}).student, t: (T || {}).teacher });
    const c = SHEETS.get(R); if (c && c.key === key) return c.v;
    yield 'Рабочие чертежи деталей';
    const out = [];
    if (root.DRAWINGS && root.DRWASM) {
      let det = [];
      try { det = root.DRAWINGS.detailSheets(R, P, T || {}); } catch (e) { console.error(e); }
      const formats = {}; det.forEach(d => { formats[d.id] = d.fmt.replace('A', 'А'); });
      let sp = null;
      try { sp = specs(R, P, T || {}, { formats })[0]; } catch (e) { console.error(e); }
      yield 'Сборочный чертёж редуктора';
      try {
        const a = sp && root.DRWASM.asmSheet(R, P, T || {}, sp);
        if (a) out.push({ id: 'reduktor_sb', file: 'reduktor_SB.cdw', code: sp.code + ' СБ', name: 'Редуктор\nСборочный чертёж', material: '', mass: '', scale: a.scale, fmt: a.fmt, landscape: true, sh: a.sh });
      } catch (e) { console.error(e); }
      yield 'Чертежи корпуса';
      try {
        if (sp) {
          // по 3D-модели — по одному листу за этап; иначе — общим вызовом
          const b = root.DRWASM.housingSheets(R, P, T || {}, sp, { part: 'base' });
          let hs = null;
          if (b) { yield 'Чертёж крышки корпуса'; const c2 = root.DRWASM.housingSheets(R, P, T || {}, sp, { part: 'cover' }); if (c2) hs = b.concat(c2); }
          if (!hs) hs = root.DRWASM.housingSheets(R, P, T || {}, sp);
          hs.forEach(d => { out.push(d); formats[d.id] = d.fmt.replace('A', 'А'); });
        }
      } catch (e) { console.error(e); }
      yield 'Рама и общий вид';
      try {
        const fs = root.DRWFRAME && specs(R, P, T || {}, { formats })[2];
        const fr = fs && root.DRWFRAME.frameSheet(R, P, T || {}, codeOf(P, T || {}), fs);
        if (fr) { out.push(fr); formats[fr.id] = fr.fmt.replace('A', 'А'); }
      } catch (e) { console.error(e); }
      try {
        const ds = R.task === 6 && root.DRWDRUM ? specs(R, P, T || {}, { formats }).find(q => /03\.00\.00$/.test(q.code)) : null;
        const db = ds && root.DRWDRUM.sheet(R, P, T || {}, ds);
        if (db) { out.push(db); formats[db.id] = db.fmt.replace('A', 'А'); }
      } catch (e) { console.error(e); }
      try {
        const dv = root.DRWDRIVE && root.DRWDRIVE.driveSheet(R, P, T || {}, specs(R, P, T || {}, { formats })[1]);
        if (dv) { const code = codeOf(P, T || {}); out.splice(1, 0, Object.assign(dv, { code: `${code} 00.00.00 ВО`, name: dv.name + '\n' + dv.nameSub, material: '', mass: '' })); formats[dv.id] = 'А1'; }
      } catch (e) { console.error(e); }
      det.forEach(d => out.push(d));
      SHEETS.set(R, { key, v: { list: out, formats } });
      return { list: out, formats };
    }
    return { list: out, formats: {} };
  }
  function sheets(R, P, T) { const g = sheetsGen(R, P, T); let r; do r = g.next(); while (!r.done); return r.value; }
  async function sheetsAsync(R, P, T, onStep) {
    const g = sheetsGen(R, P, T); let r;
    for (;;) { r = g.next(); if (r.done) return r.value; if (onStep) onStep(r.value); await new Promise(res => requestAnimationFrame(() => setTimeout(res, 0))); }
  }
  function sheetData(d) {
    if (d.sh.finalize) d.sh.finalize();
    const r2 = x => Math.round(x * 100) / 100;
    const P = [];
    for (const q of d.sh.p) {
      if (q.t === 'L') P.push(['L', r2(q.a[0]), r2(q.a[1]), r2(q.a[2]), r2(q.a[3]), q.s]);
      else if (q.t === 'C') P.push(['C', r2(q.a[0]), r2(q.a[1]), r2(q.a[2]), q.s]);
      else if (q.t === 'A') P.push(['A', r2(q.a[0]), r2(q.a[1]), r2(q.a[2]), r2(q.a[3]), r2(q.a[4]), q.s]);
      else if (q.t === 'T') P.push(['T', r2(q.a[0]), r2(q.a[1]), r2(q.a[2]), r2(q.a[3]), q.s, r2(root.DRWCORE.tw(q.s, q.a[2]))].concat(q.pos ? ['P'] : []));
      else if (q.t === 'H') P.push(['H', q.l.map(r2)]);
    }
    const SPEC = { reduktor_sb: 'spec_reduktor.spw', obshiy_vid: 'spec_privod.spw', rama_sb: 'spec_rama.spw', val_baraban_sb: 'spec_val_baraban.spw' };
    return { file: d.file, spec: SPEC[d.id] || '', fmt: d.fmt, land: !!d.landscape, code: d.code, name: d.name, material: d.material || '', mass: d.mass || '', scale: d.scale || '', p: P };
  }
  function sheetSVG(d, T, o) {
    const pv = d.sh.previewFrame({ code: d.code, name: d.name, material: d.material, mass: d.mass, scale: d.scale, org: 'КНИТУ' + (T && T.group ? ' ' + T.group : ''), student: T && T.student, teacher: T && T.teacher, normo: T && T.normo });
    return root.DRWCORE.toSVG(d.sh, Object.assign({ preview: pv }, o || {}));
  }
  /* модель для макросов: корпус — основание и крышка по геометрии сборочного чертежа, плюс подшипники и крышки подшипников */
  function model3d(R, P, T, spec) {
    const M = model(R, P, T);
    if (!root.M3D) return M;
    let h = null;
    try { h = root.M3D.housing3d(R, P, T || {}); } catch (e) { console.error(e); }
    if (!h) return M;
    const codeIn = name => { let c = ''; (spec ? spec.sections : []).forEach(sc => sc.items.forEach(it => { if (!c && it.name === name) c = it.code; })); return c; };
    const pk = M.parts.find(p => p.kind === 'housing');
    if (pk) {
      const old = pk.file;
      pk.kind = 'ops'; pk.geom = { ops: h.baseOps };
      M.asm.items = M.asm.items.filter(it => it.file !== old);
      M.asm.items.unshift({ file: pk.file, pos: [0, 0, 0], axes: AX_X });
      M.parts.push({ id: 'kryshka_korpusa', code: codeIn('Крышка корпуса'), name: 'Крышка корпуса', kind: 'ops', geom: { ops: h.coverOps }, material: 'СЧ15 ГОСТ 1412-85', density: 7.1, file: 'kryshka_korpusa.m3d' });
      M.asm.items.splice(1, 0, { file: 'kryshka_korpusa.m3d', pos: [0, 0, 0], axes: AX_X });
    }
    h.parts.forEach(p => M.parts.push(Object.assign({ code: p.std ? '' : codeIn(p.name), density: 7.85 }, p)));
    h.extra.forEach(it => M.asm.items.push(it));
    return M;
  }
  /* ожидаемый габарит детали в её системе координат [xmin, ymin, zmin, xmax, ymax, zmax] — для проверки в журнале КОМПАС */
  function partBox(p) {
    const g = p.geom || {}, R3 = (x1, x2, r) => [x1, -r, -r, x2, r, r].map(v => Math.round(v * 10) / 10);
    try {
      switch (p.kind) {
        case 'shaft': { const L = g.segs.reduce((a, s) => a + s.l, 0), r = Math.max(...g.segs.map(s => (s.gear && s.gear.da ? Math.max(s.d, s.gear.da) : s.d) / 2)); return R3(0, L, r); }
        case 'wheel': case 'sprocket': { const h = Math.max(g.lst || 0, g.b || 0) / 2; return R3(-h, h, (g.da || g.De) / 2); }
        case 'wormwheel': { const h = Math.max(g.lst || 0, g.b || 0) / 2; return R3(-h, h, Math.max(g.daM || 0, g.da || 0) / 2); }
        case 'bevel': {
          if (g.prof && g.prof.length) { const xs = g.prof.map(q => q[0]), r = Math.max(...g.prof.map(q => q[1])); return R3(Math.min(...xs), Math.max(...xs), r); }
          const d = g.delta * Math.PI / 180, xi = -g.b * Math.cos(d); return R3(xi, g.lst + xi, g.de / 2 + g.mte * Math.cos(d));
        }
        case 'bearing': return R3(-g.B / 2, g.B / 2, g.D / 2);
        case 'cover': {
          const b = R3(-g.ls, g.tf, g.Df / 2);
          if (g.flats && g.flats.length) { // лыски уменьшают габарит поперёк оси
            const R = g.Df / 2, pts = [];
            for (let i = 0; i < 720; i++) { const a = i * Math.PI / 360; pts.push([R * Math.cos(a), R * Math.sin(a)]); }
            g.flats.forEach(([th, d]) => { const h = Math.sqrt(Math.max(0, R * R - d * d)), c = Math.cos(th), sn = Math.sin(th); pts.push([d * c - h * sn, d * sn + h * c], [d * c + h * sn, d * sn - h * c]); });
            const ok = pts.filter(([y, z]) => g.flats.every(([th, d]) => y * Math.cos(th) + z * Math.sin(th) <= d + 0.01));
            b[1] = Math.round(Math.min(...ok.map(q => q[0])) * 10) / 10; b[4] = Math.round(Math.max(...ok.map(q => q[0])) * 10) / 10;
            b[2] = Math.round(Math.min(...ok.map(q => q[1])) * 10) / 10; b[5] = Math.round(Math.max(...ok.map(q => q[1])) * 10) / 10;
          }
          return b;
        }
        case 'bolt': { const b = R3(-g.k, g.L, Math.max(g.s / Math.sqrt(3), g.d / 2)); b[2] = -Math.max(g.s / 2, g.d / 2); b[5] = Math.max(g.s / 2, g.d / 2); return b; }
        case 'nut': { const b = R3(0, g.m, g.s / Math.sqrt(3)); b[2] = -g.s / 2; b[5] = g.s / 2; return b; }
        case 'washer': return R3(0, g.t, g.D / 2);
        case 'pin': return R3(-g.L / 2, g.L / 2, g.d / 2);
        case 'ops': {
          const CAN = { XOY: [0, 1], XOZ: [0, 2], YOZ: [1, 2] }, NRM = { XOY: 2, XOZ: 1, YOZ: 0 };
          const box = o => { const b = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity], c = CAN[o.base], n = NRM[o.base];
            o.loops.forEach(l => (l.c ? [[l.c[0] - l.c[2], l.c[1] - l.c[2]], [l.c[0] + l.c[2], l.c[1] + l.c[2]]] : l.p).forEach(q => { b[c[0]] = Math.min(b[c[0]], q[0]); b[c[0] + 3] = Math.max(b[c[0] + 3], q[0]); b[c[1]] = Math.min(b[c[1]], q[1]); b[c[1] + 3] = Math.max(b[c[1] + 3], q[1]); }));
            b[n] = o.a; b[n + 3] = o.b; return b; };
          let B = null;
          // каждый элемент обрезается большими вырезами, которые перекрывают его целиком поперёк своей нормали (срез по разъёму):
          // элемент целиком по ту сторону среза (стакан вала-шестерни в крышке) в габарит основания не входит
          const cuts = g.ops.filter(o => o.cut).map(o => ({ b: box(o), n: NRM[o.base], c: CAN[o.base] }));
          g.ops.forEach((o, k) => {
            if (o.cut) return;
            let b = box(o);
            for (const ct of cuts) {
              if (g.ops.indexOf(g.ops.find(q => q.cut && box(q).join() === ct.b.join())) < k) continue;   // вырез раньше элемента его не обрезает
              const { n, c } = ct, cb = ct.b;
              if (!c.every(i => cb[i] <= b[i] + 0.01 && cb[i + 3] >= b[i + 3] - 0.01)) continue;
              if (cb[n] <= b[n] + 0.01 && cb[n + 3] >= b[n + 3] - 0.01) { b = null; break; }
              if (cb[n] <= b[n] + 0.01 && cb[n + 3] > b[n]) b[n] = cb[n + 3];
              else if (cb[n + 3] >= b[n + 3] - 0.01 && cb[n] < b[n + 3]) b[n + 3] = cb[n];
            }
            if (b) B = B ? B.map((v, i) => i < 3 ? Math.min(v, b[i]) : Math.max(v, b[i])) : b;
          });
          return B.map(v => Math.round(v * 10) / 10);
        }
      }
    } catch (e) { /* без габарита */ }
    return null;
  }
  /* ---------- состав: что строить (настройка пользователя; «по заданию» — то, что требует задание на курсовой проект) ---------- */
  const GROUPS = [
    { key: 'g:bearings', title: 'Подшипники', test: p => p.kind === 'bearing' },
    { key: 'g:covers', title: 'Крышки подшипников', test: p => p.kind === 'cover' },
    { key: 'g:fasteners', title: 'Крепёж: болты, гайки, шайбы, винты, штифты, пробка', test: p => ['bolt', 'nut', 'washer', 'pin'].includes(p.kind) }
  ];
  const REQ_SHEETS = { 1: ['reduktor_sb', 'obshiy_vid', 'rama_sb', 'korpus', 'val_III', 'koleso_cil'], 3: ['reduktor_sb', 'obshiy_vid', 'rama_sb', 'korpus', 'val_kolesa', 'koleso_cherv'], 6: ['reduktor_sb', 'obshiy_vid', 'val_baraban_sb', 'korpus', 'val_III', 'koleso_z4'] };
  function catalog(R, P, T) {
    const M = model3d(R, P, T, specs(R, P, T)[0]), SH = sheets(R, P, T), task = P.task;
    const req = REQ_SHEETS[task] || [];
    const g3 = [{ key: 'asm', title: 'Сборка редуктора (' + M.asm.file + ')', req: true }];
    M.parts.filter(p => !GROUPS.some(g => g.test(p))).forEach(p => g3.push({ key: 'p:' + p.id, title: p.name + (p.code ? ' — ' + p.code : ''), note: p.file }));
    GROUPS.forEach(g => { const n = M.parts.filter(g.test).length; if (n) g3.push({ key: g.key, title: g.title, note: 'разных деталей: ' + n }); });
    const g2 = SH.list.map(d => ({ key: 's:' + d.id, title: d.name.replace(/\n(.)/, (m, c) => ', ' + c.toLowerCase()) + ' — ' + d.code, note: d.fmt.replace('A', 'А') + ', ' + d.scale, req: req.includes(d.id) }));
    const g1 = specs(R, P, T).map(s => ({ key: 'c:' + s.file, title: 'Спецификация: ' + s.name + ' — ' + s.code }));
    return [{ title: '3D-модели и сборка', items: g3 }, { title: 'Чертежи', items: g2 }, { title: 'Спецификации', items: g1 }];
  }
  const offSet = T => new Set(Object.keys((T && T.koff) || {}).filter(k => T.koff[k]));
  /* В КОМПАС ось Y — вверх (вид «Спереди» смотрит вдоль −Z). Компоновка заданий 3 и 6 рассчитана с осью Z вверх —
     для КОМПАС модель поворачивается на −90° вокруг X: (x, y, z) → (x, z, −y); задание 1 уже повёрнуто в model().
     Повёрнутые копии: исходные операции и вхождения кэшируются и используются чертежами. */
  function yUp(M, task) {
    if (task === 1) return M;
    const rot = v => [v[0], v[2], -v[1]].map(x => Object.is(x, -0) ? 0 : x);
    const rotOp = o => {
      const q = Object.assign({}, o);
      const tr = { XOY: ([u, v]) => [u, -v], XOZ: ([u, v]) => [u, v], YOZ: ([u, v]) => [v, -u] }[o.base];
      q.loops = o.loops.map(l => l.c ? { c: tr([l.c[0], l.c[1]]).concat([l.c[2]]) } : { p: l.p.map(tr) });
      if (o.base === 'XOY') q.base = 'XOZ';
      else if (o.base === 'XOZ') { q.base = 'XOY'; q.a = -o.b; q.b = -o.a; }
      return q;
    };
    M.parts = M.parts.map(p => p.kind === 'ops' ? Object.assign({}, p, { geom: Object.assign({}, p.geom, { ops: p.geom.ops.map(rotOp) }) }) : p);
    M.asm = Object.assign({}, M.asm, { items: M.asm.items.map(it => Object.assign({}, it, { pos: rot(it.pos), axes: rot(it.axes.slice(0, 3)).concat(rot(it.axes.slice(3))) })) });
    return M;
  }
  /* проверка модели до выгрузки: пересечения деталей сборки и соответствие чертежам (результат — в журнал макроса и на сайт) */
  const CHK = new WeakMap();
  function modelCheck(R, P, T) {
    if (!root.CHECK3D || !R) return null;
    const key = R; if (CHK.has(key) && CHK.get(key).T === JSON.stringify(T || {})) return CHK.get(key).r;
    let r = null;
    try { r = root.CHECK3D.check(model3d(R, P, T, specs(R, P, T)[0]), sheets(R, P, T).list); } catch (e) { console.error(e); r = { error: String(e) }; }
    CHK.set(key, { T: JSON.stringify(T || {}), r });
    return r;
  }
  // ожидаемый габарит всей сборки (в координатах КОМПАС) — для сверки с прочитанным из КОМПАС
  function asmBox(M) {
    const parts = {}; M.parts.forEach(p => { parts[p.file] = p; });
    let B = null;
    M.asm.items.forEach(it => {
      const p = parts[it.file]; if (!p) return; const b = p.bbox || partBox(p); if (!b) return;
      const X = it.axes.slice(0, 3), Y = it.axes.slice(3, 6), Z = [X[1] * Y[2] - X[2] * Y[1], X[2] * Y[0] - X[0] * Y[2], X[0] * Y[1] - X[1] * Y[0]];
      for (const x of [b[0], b[3]]) for (const y of [b[1], b[4]]) for (const z of [b[2], b[5]]) {
        const w = [0, 1, 2].map(i => it.pos[i] + X[i] * x + Y[i] * y + Z[i] * z);
        B = B ? [Math.min(B[0], w[0]), Math.min(B[1], w[1]), Math.min(B[2], w[2]), Math.max(B[3], w[0]), Math.max(B[4], w[1]), Math.max(B[5], w[2])] : [w[0], w[1], w[2], w[0], w[1], w[2]];
      }
    });
    return B && B.map(v => Math.round(v * 10) / 10);
  }
  function data(R, P, T) {
    const M = yUp(model3d(R, P, T, specs(R, P, T)[0]), P.task);
    M.parts.forEach(p => { const b = partBox(p); if (b) p.bbox = b; });
    const chk = modelCheck(R, P, T);
    const SH = sheets(R, P, T);
    const off = offSet(T);
    // выключенные пользователем элементы не строятся; из сборки убираются их вхождения
    const partOff = p => off.has('p:' + p.id) || GROUPS.some(g => off.has(g.key) && g.test(p));
    const dropFiles = new Set(M.parts.filter(partOff).map(p => p.file));
    M.parts = M.parts.filter(p => !partOff(p));
    M.asm = Object.assign({}, M.asm, { items: off.has('asm') ? [] : M.asm.items.filter(it => !dropFiles.has(it.file)), off: off.has('asm') });
    const sh = SH.list.filter(d => !off.has('s:' + d.id));
    const sp = specs(R, P, T, { formats: SH.formats }).filter(s => !off.has('c:' + s.file));
    if (!M.asm.off) M.asm.bbox = asmBox(M);
    const check = chk ? { clashes: chk.clashes, drawingMismatch: chk.drawingMismatch, lines: (chk.lines || []).map(l => (l.ok ? 'OK ' : '!! ') + l.msg), error: chk.error } : null;
    return Object.assign({ task: P.task, v: P.v, student: T.student || '', teacher: T.teacher || '', normo: T.normo || '', org: 'КНИТУ' + (T.group ? ' ' + T.group : '') }, M, { specs: sp, sheets: sh.map(sheetData), check });
  }
  function py(body, d, run) {
    const K = root.KPY || {};
    if (/snapshots/.test(run)) d = Object.assign({}, d, { sheets: (d.sheets || []).map(q => ({ file: q.file, fmt: q.fmt, code: q.code })) });
    else if (!/drawings/.test(run)) { d = Object.assign({}, d); delete d.sheets; }
    return `# -*- coding: utf-8 -*-\n# ${d.code}: макрос КОМПАС-3D v25 (Python, API5/API7). Создан утилитой «Основы проектирования».\n` + K.common + '\n\nDATA = json.loads(r"""' + JSON.stringify(d, null, 1) + '""")\n\n' + body + '\n\nif __name__ == "__main__":\n    log("=== ' + run.replace(/"/g, '') + ' ===")\n    ' + run + '\n';
  }
  function files(R, P, T, opt) {
    if (!R) return [];
    const K = root.KPY || {};
    let d;
    try { d = data(R, P, T); } catch (e) { console.error(e); return []; }
    const out = [];
    out.push({ path: '00_build_all.py', desc: 'Запускает все макросы по очереди', gen: () => `# -*- coding: utf-8 -*-\n# Запуск всех макросов: детали → сборка → спецификации → чертежи (номера позиций берутся из спецификаций) → снимки\nimport os, sys, runpy, traceback\nfor _st in (sys.stdout, sys.stderr):\n    try:\n        _st.reconfigure(encoding='utf-8', errors='replace')\n    except Exception:\n        pass\ntry:\n    HERE = os.path.dirname(os.path.abspath(__file__))\nexcept NameError:\n    HERE = os.getcwd()\n# новый запуск — новый журнал (старый сохраняется как log_prev.txt)\nLOG = os.path.join(HERE, 'out', 'log.txt')\nif os.path.exists(LOG):\n    try:\n        os.replace(LOG, os.path.join(HERE, 'out', 'log_prev.txt'))\n    except Exception:\n        pass\nfor name in ['10_parts.py', '20_assembly.py', '40_spec.py', '30_drawings.py', '50_snapshots.py']:\n    print('>>> ' + name)\n    try:\n        runpy.run_path(os.path.join(HERE, name), run_name='__main__')\n    except Exception:\n        traceback.print_exc()\nprint('Готово. Результаты — в папке out, журнал — out/log.txt, снимки и журнал для отправки — out/для_отправки.zip')\n` });
    out.push({ path: '10_parts.py', desc: '3D-модели деталей: валы и колёса с эвольвентными зубьями, звёздочка, основание и крышка корпуса, подшипники, крышки подшипников (.m3d)', gen: () => py(K.parts, d, 'run_parts()') });
    out.push({ path: '20_assembly.py', desc: 'Сборка редуктора из моделей деталей (.a3d)', gen: () => py(K.asm, d, 'run_assembly()') });
    out.push({ path: '30_drawings.py', desc: 'Сборочные чертежи редуктора и рамы, чертежи корпуса, крышки корпуса, валов и колёс (.cdw)', gen: () => py(K.drw, d, 'run_drawings()') });
    out.push({ path: '40_spec.py', desc: 'Спецификации редуктора, рамы и привода (.spw или вычерченная на А4)', gen: () => py(K.spec, d, 'run_spec()') });
    out.push({ path: '50_snapshots.py', desc: 'Снимки PNG сборки, деталей, чертежей и спецификаций + архив для отправки (out/для_отправки.zip)', gen: () => py(K.snap, d, 'run_snapshots()') });
    out.push({ path: '03_snapshots.bat', desc: 'Только снимки PNG и архив для отправки (если всё уже построено)', gen: () => ['@echo off', 'chcp 65001 >nul', 'cd /d "%~dp0"', 'where py >nul 2>nul && (py -3 50_snapshots.py) || (python 50_snapshots.py)', 'echo.', 'echo Снимки - в папке out\\снимки, архив для отправки - out\\для_отправки.zip', 'pause', ''].join('\r\n') });
    out.push({ path: '01_install_pywin32.bat', desc: 'Один раз: ставит пакет pywin32 для связи Python с КОМПАС', gen: () => ['@echo off', 'chcp 65001 >nul', 'echo Установка pywin32...', 'where py >nul 2>nul && (py -3 -m pip install --upgrade pywin32 pillow) || (python -m pip install --upgrade pywin32 pillow)', 'echo.', 'echo Готово. Если выше ошибка "не является внутренней или внешней командой" - установите Python с python.org с галочкой "Add python.exe to PATH".', 'pause', ''].join('\r\n') });
    out.push({ path: '02_run_all.bat', desc: 'Запуск всех макросов двойным щелчком', gen: () => ['@echo off', 'chcp 65001 >nul', 'cd /d "%~dp0"', 'where py >nul 2>nul && (py -3 00_build_all.py) || (python 00_build_all.py)', 'echo.', 'echo Результаты - в папке out, журнал - out\\log.txt', 'pause', ''].join('\r\n') });
    out.push({ path: 'params.json', desc: 'Все размеры в машиночитаемом виде', gen: () => JSON.stringify(Object.assign({}, d, { sheets: undefined }), null, 1) });
    for (const p of d.parts.filter(q => ['shaft', 'housing', 'wheel', 'wormwheel', 'sprocket', 'bevel'].includes(q.kind))) {
      const g = p.kind === 'shaft' ? dxfShaft(p) : p.kind === 'housing' ? dxfBox(p) : dxfWheel(p);
      out.push({ path: 'DXF/' + p.id + '.dxf', desc: `${p.code} ${p.name} — контур для импорта в КОМПАС`, gen: () => g });
    }
    sheets(R, P, T).list.forEach(sd => out.push({ path: 'Чертежи_предпросмотр/' + sd.file.replace('.cdw', '.svg'), desc: `${sd.code} — ${sd.name.replace(/\n(.)/, (m, c) => ', ' + c.toLowerCase())} (${sd.fmt.replace('A', 'А')}, ${sd.scale})`, gen: () => sheetSVG(sd, T, { px: 3000 }) }));
    out.push({ path: 'README.txt', desc: 'Как пользоваться файлами', gen: () => readme(d, R) });
    if (opt && opt.debug) out.push({ path: 'sheets.json', desc: 'Листы чертежей так, как их рассчитала утилита (для сверки с построенными в КОМПАС)', gen: () => JSON.stringify(d.sheets) });
    // порядок в списке — как в инструкции: сначала bat-файлы запуска, затем макросы, данные, DXF и предпросмотр
    const rank = f => /^README/.test(f.path) ? 0 : /\.bat$/.test(f.path) ? 1 : /\.py$/.test(f.path) ? 2 : /\.json$/.test(f.path) ? 3 : /^DXF\//.test(f.path) ? 4 : 5;
    return out.map((f, i) => [f, i]).sort((a, b) => rank(a[0]) - rank(b[0]) || (rank(a[0]) === 1 ? a[0].path.localeCompare(b[0].path) : a[1] - b[1])).map(x => x[0]);
  }
  function readme(d, R) {
    let s = `Файлы для КОМПАС-3D v25 — ${d.code}\r\n\r\n`;
    s += '1. Установите Python 3 с python.org (при установке отметьте «Add python.exe to PATH»). Встроенный в КОМПАС Python не нужен.\r\n2. Распакуйте папку в путь без кириллицы (например C:\\KP\\).\r\n3. Один раз запустите 01_install_pywin32.bat (нужен интернет).\r\n4. Запустите 02_run_all.bat. КОМПАС-3D откроется сам, если он не запущен; не трогайте его, пока идёт построение.\r\n   Вместо bat можно в командной строке: py 00_build_all.py (или каждый макрос отдельно).\r\n5. Результаты: папка out (детали .m3d, сборка .a3d, чертежи .cdw, спецификации .spw/.cdw), журнал out/log.txt.\r\n';
    s += '4. Если шаг не выполнился, в журнале указано, что построить вручную. Размеры — в params.json и на вкладке «КОМПАС» утилиты; контуры — в папке DXF (Файл → Открыть → тип DXF).\r\n\r\nДетали:\r\n';
    d.parts.forEach(p => { s += `  ${p.code}  ${p.name}  (${p.file})\r\n`; });
    s += `\r\nСборка: ${d.asm.code} ${d.asm.name} (${d.asm.file})\r\nПоложения компонентов (мм, ось детали X → направление):\r\n`;
    d.asm.items.forEach(it => { s += `  ${it.file}: (${it.pos.map(v => r1(v)).join('; ')}) ось ${it.axes[0] ? 'X' : it.axes[1] ? 'Y' : 'Z'}\r\n`; });
    return s;
  }

  /* ---------- подсказки для ручного построения ---------- */
  function hints(R, P, T) {
    let d; try { d = data(R, P, T); } catch (e) { return '<div class="note bad">Не удалось подготовить данные: ' + esc(e.message) + '</div>'; }
    let h = '<p>Порядок ручного построения в КОМПАС: деталь → эскиз на плоскости XY → контур по таблице → операция «Вращение» (для валов и колёс) → пазы «Вырезать выдавливанием» на смещённой плоскости. Размеры ниже — в миллиметрах.</p>';
    const tbl = (cap, head, rows) => `<div class="tbl"><table><caption>${esc(cap)}</caption><thead><tr>${head.map(c => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
    for (const p of d.parts) {
      const g = p.geom;
      if (p.kind === 'shaft') {
        let x = 0;
        h += `<h3>${p.code ? esc(p.code) + ' — ' : ''}${esc(p.name)}${p.file ? ' <small>(' + esc(p.file) + ')</small>' : ''}</h3>` + tbl('Ступени вала слева направо (эскиз: ступенчатый контур над осью, затем «Вращение»)', ['№', 'Участок', '⌀, мм', 'Длина, мм', 'От левого торца, мм', 'Шпоночный паз b×h×l, t₁'], g.segs.map((s, i) => { const r = [i + 1, s.name, fnum(s.d, 4), fnum(s.l, 4), fnum(x, 4) + '…' + fnum(x + s.l, 4), s.key ? `${s.key.b}×${s.key.h}×${s.key.l}, t₁ = ${fnum(s.key.t1, 0)}` : '—']; x += s.l; return r; }));
        const gear = g.segs.find(s => s.gear);
        if (gear) h += `<p class="dhint">${gear.gear.kind === 'worm' ? `Нарезка червяка: d₁ = ${fnum(gear.gear.d, 4)}, d<sub>a1</sub> = ${fnum(gear.gear.da, 4)}, d<sub>f1</sub> = ${fnum(gear.gear.df, 4)}, m = ${fnum(gear.gear.m, 0)}, z₁ = ${gear.gear.z}, q = ${fnum(gear.gear.q, 0)} — в КОМПАС: «Элементы механической передачи → Червяк» на цилиндре ⌀${fnum(gear.gear.da, 4)}.` : `Зубья шестерни: m = ${fnum(gear.gear.m, 4)}, z = ${gear.gear.z}, d<sub>a</sub> = ${fnum(gear.gear.da, 4)}, d<sub>f</sub> = ${fnum(gear.gear.df, 4)} — «Элементы механической передачи → Зубчатое колесо/шестерня» или вырез впадин массивом.`}</p>`;
      } else if (p.kind === 'housing') {
        h += `<h3>${p.code ? esc(p.code) + ' — ' : ''}${esc(p.name)}${p.file ? ' <small>(' + esc(p.file) + ')</small>' : ''}</h3>` + tbl('Габариты корпуса (упрощённая модель)', ['Параметр', 'Значение'], [['Длина', fnum(g.L, 4)], ['Ширина', fnum(g.B, 4)], ['Высота', fnum(g.H, 4)], ['Толщина стенки δ', fnum(g.del, 0)], ['Ширина опорного фланца', fnum(g.flange, 0)]]);
      } else if (p.kind === 'ops') {
        h += `<h3>${p.code ? esc(p.code) + ' — ' : ''}${esc(p.name)}${p.file ? ' <small>(' + esc(p.file) + ')</small>' : ''}</h3>` + tbl('Операции построения (координаты сборки, мм; «вырез» — вырезать выдавливанием)', ['№', 'Операция', 'Плоскость', 'От', 'До', 'Контуры'], g.ops.map((o, i) => [i + 1, o.n + (o.cut ? ' (вырез)' : ''), o.base, fnum(o.a, 4), fnum(o.b, 4), o.loops.map(l => l.c ? `окр. (${fnum(l.c[0], 4)}; ${fnum(l.c[1], 4)}) R${fnum(l.c[2], 4)}` : `ломаная из ${l.p.length} точек`).join(', ')]));
      } else if (p.kind === 'bearing') {
        h += `<h3>${esc(p.name)}</h3><p class="dhint">d = ${fnum(g.d, 4)}, D = ${fnum(g.D, 4)}, ${g.roller ? 'T' : 'B'} = ${fnum(g.B, 4)} — проще вставить из «Библиотеки стандартных изделий».</p>`;
      } else if (p.kind === 'cover') {
        h += `<h3>${p.code ? esc(p.code) + ' — ' : ''}${esc(p.name)}${p.file ? ' <small>(' + esc(p.file) + ')</small>' : ''}</h3>` + tbl('Размеры крышки (полупрофиль для «Вращения»)', ['Параметр', 'Значение'], [['Диаметр центрирующего пояска D', fnum(g.D, 4)], ['Диаметр фланца', fnum(g.Df, 4)], ['Толщина фланца', fnum(g.tf, 4)], ['Длина пояска', fnum(g.ls, 4)], ['Отверстие под манжету', g.dSeal ? fnum(g.dSeal, 4) : '—'], ['Винты', `${g.n} × М${g.dks}`]]);
      } else {
        const rows = [['Число зубьев z', g.z], ['Модуль / шаг', fnum(g.m || g.mte || g.t, 4)], ['Диаметр вершин', fnum(g.da || g.dae || g.De, 4)], ['Диаметр впадин', g.df || g.dfe ? fnum(g.df || g.dfe, 4) : '—'], ['Ширина венца b', fnum(g.b, 4)], ['Отверстие ступицы', fnum(g.dbore, 4)], ['Диаметр ступицы', fnum(g.dst, 4)], ['Длина ступицы', fnum(g.lst, 4)], ['Толщина диска e', g.e ? fnum(g.e, 4) : '—'], ['Шпоночный паз ступицы b×t₂', g.key ? `${g.key.b}×${fnum(g.key.t2, 0)}` : '—']];
        if (p.kind === 'wormwheel') rows.push(['Наибольший диаметр daM2', fnum(g.daM, 4)], ['Радиус выемки Ra (центр на оси червяка, aw = ' + fnum(g.aw, 4) + ')', fnum(g.Ra, 4)]);
        if (p.kind === 'bevel') rows.push(['Угол делительного конуса δ', F.degTxt(g.delta)], ['Внешнее конусное расстояние Re', fnum(g.Re, 4)]);
        if (p.kind === 'sprocket') rows.push(['Делительный диаметр dд', fnum(g.dd, 4)], ['Диаметр ролика цепи d₁', fnum(g.d1, 4)]);
        h += `<h3>${p.code ? esc(p.code) + ' — ' : ''}${esc(p.name)}${p.file ? ' <small>(' + esc(p.file) + ')</small>' : ''}</h3>` + tbl('Размеры (полупрофиль для «Вращения»: ступица → диск → обод)', ['Параметр', 'Значение'], rows);
      }
    }
    h += '<h3>Сборка</h3>' + tbl('Положение компонентов в сборке (точка начала детали, мм)', ['Файл', 'X', 'Y', 'Z', 'Ось детали'], d.asm.items.map(it => [it.file, fnum(it.pos[0], 4), fnum(it.pos[1], 4), fnum(it.pos[2], 4), it.axes[0] ? 'X' : it.axes[1] ? 'Y' : 'Z']));
    h += '<h3>Спецификации</h3>';
    for (const s of d.specs) h += tbl(`${s.code} — ${s.name}`, ['Формат', 'Поз.', 'Обозначение', 'Наименование', 'Кол.', 'Прим.'], [].concat(...s.sections.map(sec => [['', '', '', sec.title, '', '']].concat(sec.items.map(i => [i.fmt || '', i.pos || '', i.code || '', i.name, i.qty === undefined ? '' : String(i.qty), i.note || ''])))));
    return h;
  }

  root.KOMPAS = { modelCheck, partBox, catalog, offSet, model3d, sheets, sheetsAsync, sheetSVG, sheetData, files, hints, specs, model, data, Dxf };
})(typeof window !== 'undefined' ? window : globalThis);
