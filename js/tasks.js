/* tasks.js — сборка полного расчёта по заданиям 1, 3, 6 */
(function (root) {
  'use strict';
  const D = root.DATA, F = root.F, M = root.MECH, G = root.GEAR, W = root.WORM;
  const { n, nx, sq, fnum, up, near, D2R, Report } = F;
  const PI = Math.PI;

  /* ---------- параметры по умолчанию ---------- */
  const OPT_DEF = {
    sync: 1500, motor: 'auto',
    // червячная передача
    etaWpre: 0.75, wormMat: 'auto', wormCast: 'П', wormSH: 'met', wormSF: 'met', wormAw: 'ch', wormAwRound: 'std', wormMUp: false, wormSHcheck: 'ch', wormSFcheck: 'met',
    wormGround: true, wormNe: 'simple', xLoad: 'load', wormDeg: 'auto', Cv: 0.85, sH0: 250, kSF: 0.25, fNonTin: 1.5, ZE: Math.sqrt(1.32e5 / (PI * (1 - 0.09))), Kpre: 1.2, z1: 0, q: 0,
    wormStiff: 'met', l1Mode: 'daM2',
    // зубчатые
    awRow: 0, mRow: 1, mK: 0.015, zMode: 'met', bAdd: 5, Kbe: 0.285, zb1: 20, psibaB: 0.315, psibaT: 0.4, psiba1: 0.4,
    // тепловой
    t0: 20, Kt: 15, psiT: 0.25, tmax: 80, Kreb: 'auto',
    // цепь
    uChain: 2.5, Kd: 1, Ka: 1, Kn: 1, Kreg: 1, Ksm: 1.5, aRatio: 40, chainAngle: null, Kv1: 1.15, Kv2: 1.25,
    // валы
    tauI: 20, tauII: 25, tauIII: 20, wKey: 'met', nz: 2.0, Kri: 1.0, betaSh: 0.95, shaftSteel: '45', etaRefine: true,
    // подшипники
    Kb: 1.3, Kt2: 1.0, LhMode: 'tsum', Lh: 10000,
    // шпонки
    keyExact: false, sCmSteel: 110, sCmRev: 90, sCmCI: 75,
    // муфта
    Kcoup: 1.5, FmMode: 'gost', D0: 0, zp: 0, dp: 0, lvt: 0, Cm: 0, FmK: 0.3, sCmRub: 1.8, sIzgPin: 120,
    // смазка
    oilMode: 'met',
    // задание 6
    Db: 0, lDrum: 0,
    // КПД
    etaM: 0.98, etaCh: 0.93, etaB: 0.99, etaCyl: 0.97, etaCon: 0.96
  };
  function defaults(listNo, tv) {
    const { task, v } = tv || D.byListNo(listNo);
    const T = D.TASKS[task];
    const O = JSON.parse(JSON.stringify(OPT_DEF));
    O.chainAngle = task === 6 ? 90 : 20;
    O.Kn = O.chainAngle > 60 ? 1.25 : 1;          // наклон линии центров более 60° [Ч, с. 130]
    O.Kcoup = task === 3 ? 1.5 : task === 6 ? 1.4 : 1.5;
    if (task !== 1) { O.sCmCI = 60; O.wKey = 'net'; }
    return { listNo, task, v, Pout: T.P[v - 1], nout: T.n[v - 1], L: T.L, Kg: T.Kg, Kc: T.Kc, load: T.load.map(x => x.slice()), O, dec: -1 };
  }

  /* ---------- общие разделы ---------- */
  function shiftsK(Kc) { const s = Math.ceil(Kc * 24 / 8 - 1e-9); return s <= 1 ? 1 : s === 2 ? 1.25 : 1.5; }
  function secInput(rep, P, T, figs) {
    rep.h('1.1', 'Исходные данные');
    rep.p(`${T.full.replace(/^Спроектировать/, 'Требуется спроектировать')} Кинематическая схема привода представлена на рисунке {fig:scheme}.`);
    rep.fig('scheme', `Кинематическая схема привода: ${T.parts.map((x, i) => (i + 1) + ' – ' + x).join('; ')}`, null, { kind: 'scheme' });
    rep.p('Исходные данные для проектирования:');
    rep.list([
      `мощность на валу рабочего органа <i>P</i><sub>вых</sub> = ${fnum(P.Pout, 0)} кВт`,
      `частота вращения вала рабочего органа <i>n</i><sub>вых</sub> = ${fnum(P.nout, 0)} мин<sup>−1</sup>`,
      `срок службы <i>L</i> = ${P.L} лет`,
      `коэффициент годового использования <i>K</i><sub>г</sub> = ${fnum(P.Kg, 0)}`,
      `коэффициент суточного использования <i>K</i><sub>сут</sub> = ${fnum(P.Kc, 0)}`]);
    rep.p(`Режим нагружения задан графиком нагрузки (рисунок {fig:load}): ${P.load.map(([k, t]) => `${fnum(k, 0) === '1' ? '' : fnum(k, 0)}<i>T</i> в течение ${fnum(t, 0)}<i>t</i><sub>Σ</sub>`).join(', ')}.`);
    rep.fig('load', 'График нагрузки привода', null, { kind: 'load' });
    const tS = M.tSum(P);
    rep.eq({ lhs: 't_{\\Sigma}', f: 'L\\cdot 365\\cdot K_{г}\\cdot 24\\cdot K_{сут}', s: `${P.L}\\cdot 365\\cdot ${nx(P.Kg)}\\cdot 24\\cdot ${nx(P.Kc)}`, v: tS, u: 'ч', d: 'Суммарное время работы привода за срок службы — нужно для расчёта числа циклов нагружения и ресурса подшипников.' });
    return tS;
  }
  /* номера пунктов методички различаются по заданиям (у каждого задания своя методичка) */
  const MREF = { 1: { fits: 'п. 1.13', two: 'п. 1.11', kreg: 'разд. 2', fm: 'п. 1.10.1' }, 3: { fits: 'п. 1.14', two: 'п. 1.12.2', kreg: 'п. 2.2', fm: 'п. 1.11.1' }, 6: { fits: 'п. 1.13', two: 'п. 1.11.2', kreg: 'п. 2.2', fm: 'п. 1.10.1' } };
  const mref = k => (MREF[root.MREF_TASK] || MREF[1])[k];
  function motorSection(rep, P, Preq, nPreview, sync, why) {
    const O = P.O;
    const cands = M.motorCandidates(Preq);
    const mo = M.pickMotor(Preq, sync || O.sync, O.motor);
    rep.table('Электродвигатели, удовлетворяющие условию Pном ≥ Pрасч', ['Двигатель', 'Pном, кВт', 'nс, мин⁻¹', 'nном, мин⁻¹', 'Масса, кг', 'u привода'],
      cands.map(m => [m.type, fnum(m.P, 0), m.sync, m.n, fnum(m.m, 0), fnum(m.n / nPreview)]), { web: true });
    rep.p(`По каталогу [[air|с. 6–8]] выбираем асинхронный электродвигатель ${mo.type} (${why ? why : (mo.sync === 1500 || mo.sync === 1000) ? 'предпочтительны двигатели с синхронной частотой 1500 и 1000 мин⁻¹: при 3000 мин⁻¹ затруднена реализация большого передаточного числа, двигатели с 750 мин⁻¹ имеют большие габариты и массу [[ch|с. 7]]' : 'синхронная частота ' + mo.sync + ' мин⁻¹'}): номинальная мощность <i>P</i><sub>ном</sub> = ${fnum(mo.P, 0)} кВт, номинальная частота вращения <i>n</i><sub>эд</sub> = ${mo.n} мин<sup>−1</sup>, КПД ${fnum(mo.eta, 0)} %, диаметр выходного конца вала <i>d</i><sub>эд</sub> = ${mo.d1} мм, длина ${mo.l1} мм, высота оси вращения <i>h</i> = ${mo.h} мм, масса ${fnum(mo.m, 0)} кг.`);
    rep.check(`P_{ном}=${nx(mo.P)}\\ \\text{кВт}\\ \\ge\\ P_{расч}=${n(Preq)}\\ \\text{кВт}`, mo.P >= Preq - 1e-9, '');
    return mo;
  }
  function shaftsTable(rep, rows, cap) {
    rep.table(cap || 'Кинематические и силовые параметры валов привода', ['Вал', 'n, мин⁻¹', 'ω, рад/с', 'P, кВт', 'T, Н·м'], rows.map(r => [r.name, fnum(r.n), fnum(r.w), fnum(r.P), fnum(r.T)]));
  }
  function fitsSection(rep, items) {
    rep.p('Посадки назначаются в системе отверстия с учётом характера нагружения, условий сборки и передачи крутящего момента [[met|' + mref('fits') + ']]:');
    rep.list(items);
  }
  function stepDiams(dv, sealMin) {
    const s = M.seal(Math.max(dv + 2, sealMin || 0));
    let dp = M.std5(s.d + 1); if (dp <= s.d) dp += 5;
    return { dupl: s.d, seal: s, dpodsh: dp };
  }
  function FmGost(T, slow) { return slow ? 125 * Math.sqrt(T) : T <= 25 ? 50 * Math.sqrt(T) : 80 * Math.sqrt(T); }

  /* реакции опор (обозначение вала idx) по балке, с формулами */
  function reactRep(rep, B, terms, idx, lsym) {
    // terms: силы { pl, F (TeX), Fm (модуль), dir (+1 — против положительного направления реакций, по умолчанию), x (координата от A) или av,
    //               a (TeX |x|), b (TeX |l − x|) }; пары { pl, C (TeX), Cv — момент как в beam() }
    const l = B.l;
    for (const pl of ['x', 'y']) {
      const tt = terms.filter(t => t.pl === pl && (t.C ? Math.abs(t.Cv) > 1e-9 : Math.abs(t.Fm) > 1e-9));
      const plName = pl === 'x' ? 'горизонтальной плоскости' : 'вертикальной плоскости';
      if (!tt.length) { if (terms.some(t => t.pl === pl)) rep.p(`В ${plName} нагрузки отсутствуют: <i>R</i><sub>A${pl}</sub> = <i>R</i><sub>B${pl}</sub> = 0.`); continue; }
      let fB = '', sB = '', fA = '', sA = '';
      const add = (str, sg, txt) => (str || sg === '-' ? sg : '') + txt;
      for (const t of tt) {
        if (t.C) {
          const sb = t.Cv > 0 ? '-' : '+', sa = t.Cv > 0 ? '+' : '-';
          fB += add(fB, sb, t.C); sB += add(sB, sb, n(Math.abs(t.Cv)));
          fA += add(fA, sa, t.C); sA += add(sA, sa, n(Math.abs(t.Cv)));
          continue;
        }
        const x = t.x !== undefined ? t.x : t.av, dir = t.dir || 1, bx = l - x;
        const sb = dir * x >= 0 ? '+' : '-', sa = dir * bx >= 0 ? '+' : '-';
        fB += add(fB, sb, t.F + '\\cdot ' + t.a); sB += add(sB, sb, n(t.Fm) + '\\cdot ' + n(Math.abs(x)));
        fA += add(fA, sa, t.F + '\\cdot ' + t.b); sA += add(sA, sa, n(t.Fm) + '\\cdot ' + n(Math.abs(bx)));
      }
      const RB = B['RB' + pl], RA = B['RA' + pl];
      rep.p(`Реакции опор в ${plName} (из уравнений моментов относительно опор A и B):`);
      rep.eq({ lhs: `R_{B${pl}}`, f: `\\dfrac{${fB}}{${lsym}}`, s: `\\dfrac{${sB}}{${n(l)}}`, v: RB, u: 'Н' });
      rep.eq({ lhs: `R_{A${pl}}`, f: `\\dfrac{${fA}}{${lsym}}`, s: `\\dfrac{${sA}}{${n(l)}}`, v: RA, u: 'Н' });
      const fl = tt.filter(t => !t.C);
      const sumF = fl.reduce((s, t) => s + (t.dir || 1) * t.Fm, 0);
      let fs = ''; fl.forEach(t => { fs += ((t.dir || 1) > 0 ? '-' : '+') + n(t.Fm); });
      const r = RA + RB - sumF;
      rep.check(`\\Sigma F_{${pl}}=${n(RA)}${RB < 0 ? '' : '+'}${n(RB)}${fs}=${Math.abs(r) < 0.05 ? '0' : n(r)}`, Math.abs(r) < 1e-6 * Math.max(1, Math.abs(sumF)) + 0.05, 'Реакции найдены верно — сумма проекций сил равна нулю.');
    }
  }

  /* сечение по балке: моменты в плоскостях (модули), Н·мм */
  function secM(B, x) { return B.at(x); }

  /* ---------- задание 3 ---------- */
  function task3core(P, A) {
    root.MREF_TASK = 3;
    const O = Object.assign({}, P.O, A.awMin ? { awMin: A.awMin } : {}, A.wormMat ? { wormMat: A.wormMat, vsHint: A.vsHint } : {}), T = D.TASKS[3], S = [], R = { task: 3 };
    const sec = (id, tab, title) => { const r = new Report(tab); r.id = id; r.title = title; S.push(r); return r; };
    // 1.1
    let rep = sec('s11', 'kin', 'Исходные данные');
    rep.h('1', 'Расчёт привода', 1);
    const tS = secInput(rep, P, T); R.tS = tS;
    // 1.2
    rep = sec('s12', 'kin', 'Электродвигатель и кинематический расчёт');
    rep.h('1.2', 'Выбор электродвигателя и кинематический расчёт');
    rep.p('Привод сварочного кантователя разбивается на три вала: вал I — быстроходный вал редуктора (вал червяка); вал II — тихоходный вал редуктора (вал червячного колеса); вал III — вал исполнительного органа (ведущий зажим кантователя).');
    rep.h('1.2.1', 'Определение общего КПД привода и требуемой мощности электродвигателя', 3);
    const etaW0 = O.etaWpre;
    const run = (etaW) => {
      const eta = O.etaM * etaW * O.etaCh * Math.pow(O.etaB, 3);
      return { eta, Preq: P.Pout / eta };
    };
    const k0 = run(etaW0);
    rep.p(`Принимаем КПД элементов привода [[met|п. 1.2.1]], [[ch|табл. 1.1]]: соединительной муфты η<sub>м</sub> = ${fnum(O.etaM, 0)}; червячной передачи (предварительно) η<sub>ч</sub> = ${fnum(etaW0, 0)}; открытой цепной передачи η<sub>цеп</sub> = ${fnum(O.etaCh, 0)}; пары подшипников качения η<sub>подш</sub> = ${fnum(O.etaB, 0)}.`);
    rep.eq({ lhs: '\\eta_{общ}', f: '\\eta_{м}\\cdot \\eta_{ч}\\cdot \\eta_{цеп}\\cdot \\eta_{подш}^{3}', s: `${nx(O.etaM)}\\cdot ${nx(etaW0)}\\cdot ${nx(O.etaCh)}\\cdot ${nx(O.etaB)}^{3}`, v: k0.eta, sig: 4, d: 'Общий КПД привода — произведение КПД последовательно соединённых передач и пар подшипников.' });
    rep.eq({ lhs: 'P_{расч}', f: '\\dfrac{P_{вых}}{\\eta_{общ}}', s: `\\dfrac{${nx(P.Pout)}}{${n(k0.eta, 4)}}`, v: k0.Preq, u: 'кВт', d: 'Требуемая мощность электродвигателя.' });
    rep.h('1.2.2', 'Выбор электродвигателя из каталога', 3);
    const preU = 1450 / P.nout;
    const mo = motorSection(rep, P, k0.Preq, P.nout);
    R.motor = mo;
    rep.h('1.2.3', 'Определение общего передаточного отношения и его разбивка по ступеням', 3);
    const uo = mo.n / P.nout;
    rep.eq({ lhs: 'u_{общ}', f: '\\dfrac{n_{эд}}{n_{вых}}', s: `\\dfrac{${mo.n}}{${nx(P.nout)}}`, v: uo, d: 'Общее передаточное отношение привода.' });
    rep.p(`Назначаем передаточное отношение цепной передачи из рекомендуемого интервала 1,5…3,5: <i>u</i><sub>цеп</sub> = ${fnum(O.uChain, 0)} [[met|п. 1.2.3]].`);
    const uwr = uo / O.uChain;
    const uw = O.uw || near(uwr, D.STD.uw);
    rep.eq({ lhs: 'u_{ч}', f: '\\dfrac{u_{общ}}{u_{цеп}}', s: `\\dfrac{${n(uo)}}{${nx(O.uChain)}}`, v: uwr, raw: `${n(uwr)}\\ \\Rightarrow\\ ${nx(uw)}`, d: 'Передаточное отношение червячного редуктора, округляется до стандартного по ГОСТ 2144-76.' });
    const uc = uo / uw;
    rep.eq({ lhs: "u_{цеп}'", f: '\\dfrac{u_{общ}}{u_{ч}}', s: `\\dfrac{${n(uo)}}{${nx(uw)}}`, v: uc, d: 'Уточнённое передаточное отношение цепной передачи.' });
    rep.check(`1{,}5\\le u_{цеп}'=${n(uc)}\\le 3{,}5`, uc >= 1.5 && uc <= 3.5, uc >= 1.5 && uc <= 3.5 ? 'Значение в рекомендуемом интервале.' : 'Значение вне рекомендуемого интервала — измените uцеп или двигатель.');
    rep.h('1.2.4', 'Расчёт частот вращения и крутящих моментов на валах', 3);
    const kin = (Preq) => {
      const nI = mo.n, nII = nI / uw, nIII = nII / uc;
      const PI_ = Preq * O.etaM * O.etaB, PII = PI_ * etaCur * O.etaB, PIII = PII * O.etaCh * O.etaB;
      const Tq = (p, nn) => 9550 * p / nn;
      return { nI, nII, nIII, wI: PI * nI / 30, wII: PI * nII / 30, wIII: PI * nIII / 30, PI: PI_, PII, PIII, TI: Tq(PI_, nI), TII: Tq(PII, nII), TIII: Tq(PIII, nIII) };
    };
    let etaCur = etaW0;
    let K = kin(k0.Preq);
    rep.eq({ lhs: 'n_{I}', f: 'n_{эд}', v: K.nI, u: 'мин⁻¹', d: 'Частоты вращения валов определяются последовательным делением на передаточные отношения.' });
    rep.eq({ lhs: 'n_{II}', f: '\\dfrac{n_{I}}{u_{ч}}', s: `\\dfrac{${n(K.nI)}}{${nx(uw)}}`, v: K.nII, u: 'мин⁻¹' });
    rep.eq({ lhs: 'n_{III}', f: "\\dfrac{n_{II}}{u_{цеп}'}", s: `\\dfrac{${n(K.nII)}}{${n(uc)}}`, v: K.nIII, u: 'мин⁻¹' });
    rep.eq({ lhs: '\\omega_{I}', f: '\\dfrac{\\pi\\cdot n_{I}}{30}', s: `\\dfrac{\\pi\\cdot ${n(K.nI)}}{30}`, v: K.wI, u: 'рад/с', d: 'Угловые скорости валов.' });
    rep.eq({ lhs: 'P_{I}', f: 'P_{расч}\\cdot \\eta_{м}\\cdot \\eta_{подш}', s: `${n(k0.Preq)}\\cdot ${nx(O.etaM)}\\cdot ${nx(O.etaB)}`, v: K.PI, u: 'кВт', d: 'Мощности на валах с учётом потерь в муфте, передачах и подшипниках.' });
    rep.eq({ lhs: 'P_{II}', f: 'P_{I}\\cdot \\eta_{ч}\\cdot \\eta_{подш}', s: `${n(K.PI)}\\cdot ${nx(etaW0)}\\cdot ${nx(O.etaB)}`, v: K.PII, u: 'кВт' });
    rep.eq({ lhs: 'P_{III}', f: 'P_{II}\\cdot \\eta_{цеп}\\cdot \\eta_{подш}', s: `${n(K.PII)}\\cdot ${nx(O.etaCh)}\\cdot ${nx(O.etaB)}`, v: K.PIII, u: 'кВт' });
    rep.eq({ lhs: 'T_{I}', f: '9550\\cdot \\dfrac{P_{I}}{n_{I}}', s: `9550\\cdot \\dfrac{${n(K.PI)}}{${n(K.nI)}}`, v: K.TI, u: 'Н·м', d: 'Крутящие моменты на валах.' });
    rep.eq({ lhs: 'T_{II}', f: '9550\\cdot \\dfrac{P_{II}}{n_{II}}', s: `9550\\cdot \\dfrac{${n(K.PII)}}{${n(K.nII)}}`, v: K.TII, u: 'Н·м' });
    rep.eq({ lhs: 'T_{III}', f: '9550\\cdot \\dfrac{P_{III}}{n_{III}}', s: `9550\\cdot \\dfrac{${n(K.PIII)}}{${n(K.nIII)}}`, v: K.TIII, u: 'Н·м' });
    shaftsTable(rep, [{ name: 'I (вал червяка)', n: K.nI, w: K.wI, P: K.PI, T: K.TI }, { name: 'II (вал колеса)', n: K.nII, w: K.wII, P: K.PII, T: K.TII }, { name: 'III (вал зажима)', n: K.nIII, w: K.wIII, P: K.PIII, T: K.TIII }]);
    R.kin0 = K; R.uo = uo; R.uw = uw; R.uc = uc; R.eta0 = k0;
    // 1.3
    rep = sec('s13', 'mat', 'Материалы и допускаемые напряжения');
    rep.h('1.3', 'Выбор марок материалов червяка и червячного венца, определение допускаемых напряжений');
    rep.h('1.3.1', 'Выбор материалов червячной пары', 3);
    const reverse = true;
    const mt = W.materials(rep, { nI: K.nI, TII: K.TII, nII: K.nII, tS, load: P.load, reverse }, O);
    R.mt = mt;
    // 1.4
    rep = sec('s14', 'gear', 'Червячная передача: геометрия и силы');
    rep.h('1.4', 'Проектный и геометрический расчёт червячной передачи, определение сил в зацеплении');
    const g = W.geometry(rep, { u: uw, TII: K.TII, TI: K.TI, Kpre: O.Kpre, sH: mt.sH }, O, mt.mat);
    R.g = g;
    // 1.5
    rep = sec('s15', 'gear', 'Скорость скольжения, КПД, проверочный расчёт');
    rep.h('1.5', 'Вычисление скорости скольжения, уточнение КПД и проверочный расчёт передачи');
    rep.h('1.5.1', 'Определение скорости скольжения и уточнение КПД передачи', 3);
    const ck = W.check(rep, g, { nI: K.nI, etaPre: etaW0 }, O, mt);
    R.ck = ck;
    let Ft2 = g.Ft2, Ft1 = g.Ft1, Fr = g.Fr, K2 = K, Preq2 = k0.Preq, eta2 = k0.eta;
    if (ck.dEta > 5 && O.etaRefine) {
      rep.p('Так как уточнённый КПД червячной передачи отличается от предварительно принятого более чем на 5 %, выполняется уточнение силовых параметров привода [[met|п. 1.5.1]].');
      etaCur = ck.eta;
      const kk = run(ck.eta); eta2 = kk.eta; Preq2 = kk.Preq;
      rep.eq({ lhs: "\\eta_{общ}'", f: '\\eta_{м}\\cdot \\eta_{ч}\\cdot \\eta_{цеп}\\cdot \\eta_{подш}^{3}', s: `${nx(O.etaM)}\\cdot ${n(ck.eta, 3)}\\cdot ${nx(O.etaCh)}\\cdot ${nx(O.etaB)}^{3}`, v: kk.eta, sig: 4, d: 'Общий КПД привода с уточнённым КПД червячной передачи.' });
      rep.eq({ lhs: "P_{расч}'", f: "\\dfrac{P_{вых}}{\\eta_{общ}'}", s: `\\dfrac{${nx(P.Pout)}}{${n(kk.eta, 4)}}`, v: kk.Preq, u: 'кВт', d: 'Уточнённая требуемая мощность.' });
      rep.check(`P_{ном}=${nx(mo.P)}\\ \\text{кВт}\\ \\ge\\ P_{расч}'=${n(kk.Preq)}\\ \\text{кВт}`, mo.P >= kk.Preq, mo.P >= kk.Preq ? 'Выбранный электродвигатель сохраняется.' : 'Мощности двигателя недостаточно — требуется двигатель большей мощности.');
      K2 = kin(kk.Preq);
      shaftsTable(rep, [{ name: 'I', n: K2.nI, w: K2.wI, P: K2.PI, T: K2.TI }, { name: 'II', n: K2.nII, w: K2.wII, P: K2.PII, T: K2.TII }, { name: 'III', n: K2.nIII, w: K2.wIII, P: K2.PIII, T: K2.TIII }], 'Уточнённые параметры валов');
      Ft2 = 2000 * K2.TII / g.d2; Ft1 = 2000 * K2.TI / g.d1; Fr = Ft2 * Math.tan(20 * D2R) / Math.cos(g.gam * D2R);
      rep.eq({ lhs: 'F_{t2}=F_{a1}', f: '\\dfrac{2000\\cdot T_{II}}{d_{2}}', s: `\\dfrac{2000\\cdot ${n(K2.TII)}}{${n(g.d2)}}`, v: Ft2, u: 'Н', d: 'Уточнённые силы в зацеплении.' });
      rep.eq({ lhs: 'F_{t1}=F_{a2}', f: '\\dfrac{2000\\cdot T_{I}}{d_{1}}', s: `\\dfrac{2000\\cdot ${n(K2.TI)}}{${n(g.d1)}}`, v: Ft1, u: 'Н' });
      rep.eq({ lhs: 'F_{r}', f: 'F_{t2}\\cdot \\dfrac{\\operatorname{tg}\\alpha_{n}}{\\cos\\gamma}', s: `${n(Ft2)}\\cdot \\dfrac{\\operatorname{tg}20^{\\circ}}{\\cos ${F.deg(g.gam)}}`, v: Fr, u: 'Н' });
    }
    R.K = K2; R.Ft1 = Ft1; R.Ft2 = Ft2; R.Fr = Fr; R.Preq = Preq2; R.eta = eta2; R.etaW = etaCur;
    const xL = O.xLoad === 'load' ? P.load.reduce((s, [k, t]) => s + k * t, 0) : 0.6;
    if (O.xLoad === 'load') rep.eq({ lhs: 'x', f: '\\dfrac{\\sum T_{i}t_{i}n_{i}}{T_{max}\\sum t_{i}n_{i}}', s: P.load.map(([k, t]) => `${nx(k)}\\cdot ${nx(t)}`).join('+'), v: xL, sig: 3, d: 'Коэффициент, учитывающий характер изменения нагрузки (формула 4.27 [Ч], частота вращения постоянна).', ref: ['ch', 'формула (4.27)'] });
    const st = W.stress(rep, g, { TII: K2.TII, x: xL, Ft2 }, O, mt, ck);
    R.st = st;
    // 1.6 цепь
    rep = sec('s16', 'gear', 'Открытая цепная передача');
    rep.h('1.6', 'Расчёт открытой цепной передачи');
    rep.p(`Принимается приводная роликовая однорядная цепь типа ПР по ГОСТ 13568-75; ведущая звёздочка устанавливается на тихоходном валу редуктора (вал II) [[met|п. 1.6]]. Коэффициенты эксплуатации [[ch|с. 130]]: <i>K</i><sub>д</sub> = ${fnum(O.Kd, 0)} (${O.Kd === 1 ? 'спокойная нагрузка' : 'нагрузка с толчками'}), <i>K</i><sub>а</sub> = ${fnum(O.Ka, 0)} (<i>a</i> = (30…50)<i>t</i>), <i>K</i><sub>нак</sub> = ${fnum(O.Kn, 0)} (наклон линии центров ${O.chainAngle}°), <i>K</i><sub>рег</sub> = ${fnum(O.Kreg, 0)} (регулировка перемещением опоры), <i>K</i><sub>смаз</sub> = ${fnum(O.Ksm, 0)} (${O.Ksm >= 1.3 ? 'периодическое смазывание' : O.Ksm === 1 ? 'непрерывное смазывание' : 'картерное смазывание'}), <i>K</i><sub>см</sub> = ${fnum(shiftsK(P.Kc), 0)} (${Math.ceil(P.Kc * 3 - 1e-9)}-сменная работа при <i>K</i><sub>сут</sub> = ${fnum(P.Kc, 0)}).`);
    const chn = M.chainCalc(rep, { T: K2.TII, n1: K2.nII, u: uc, Tsym: 'T_{II}', Kd: O.Kd, Ka: O.Ka, Kn: O.Kn, Kreg: O.Kreg, Ksm: O.Ksm, Kp: shiftsK(P.Kc), aRatio: O.aRatio, angle: O.chainAngle, Kv1: O.Kv1, Kv2: O.Kv2 });
    R.chn = chn;
    const nOut = K2.nII / chn.uf, dn = Math.abs(P.nout - nOut) / P.nout * 100;
    rep.eq({ lhs: 'n_{вых.факт}', f: '\\dfrac{n_{эд}}{u_{ч.факт}\\cdot u_{цеп.факт}}', s: `\\dfrac{${mo.n}}{${n(g.uf)}\\cdot ${n(chn.uf)}}`, v: mo.n / (g.uf * chn.uf), u: 'мин⁻¹', d: 'Фактическая частота вращения вала зажима.' });
    rep.check(`\\Delta n=\\dfrac{|n_{вых}-n_{вых.факт}|}{n_{вых}}\\cdot 100\\%=${n(Math.abs(P.nout - mo.n / (g.uf * chn.uf)) / P.nout * 100, 2)}\\%\\ \\le\\ 5\\%`, Math.abs(P.nout - mo.n / (g.uf * chn.uf)) / P.nout * 100 <= 5, '');
    R.nOut = mo.n / (g.uf * chn.uf);
    // 1.7 тепловой
    rep = sec('s17', 'gear', 'Тепловой расчёт');
    rep.h('1.7', 'Тепловой расчёт червячного редуктора');
    rep.p(`Из-за низкого КПД червячной передачи выделяется значительное количество теплоты. Принимаем [[met|п. 1.7]]: температура окружающей среды <i>t</i><sub>0</sub> = ${O.t0} °C, коэффициент теплопередачи <i>K</i><sub>t</sub> = ${O.Kt} Вт/(м²·°C) (хорошая циркуляция воздуха), ψ = ${fnum(O.psiT, 0)} (установка на металлической раме), допускаемая температура масла [<i>t</i><sub>м</sub>] = ${O.tmax} °C.`);
    const th = W.thermal(rep, { PI: K2.PI, eta: etaCur, aw: g.aw }, O);
    R.th = th;
    // 1.8 предварительный расчёт валов
    rep = sec('s18', 'shaft', 'Ориентировочный расчёт валов, размеры червячной пары');
    rep.h('1.8', 'Ориентировочный расчёт валов. Конструктивные размеры червячной пары');
    rep.h('1.8.1', 'Ориентировочный расчёт валов редуктора', 3);
    rep.p(`Валы изготавливаются из стали 45 (улучшение) по ГОСТ 1050-2013. Расчёт ведётся на чистое кручение по пониженным допускаемым напряжениям: для быстроходного вала [τ<sub>к</sub>] = ${O.tauI} МПа (интервал 15…25 МПа), для тихоходного [τ<sub>к</sub>] = ${O.tauII} МПа (20…30 МПа) [[met|п. 1.8.1]].`);
    const dv1r = M.torsionD(rep, { lhs: 'd_{в1}', T: K2.TI, Tsym: 'T_{I}', tau: O.tauI });
    let dv1 = M.shaftStd(dv1r);
    const dv1motor = Math.max(dv1, M.shaftStd(0.8 * mo.d1));
    // муфта (подбор для согласования диаметров)
    const Tc = O.Kcoup * K2.TI;
    let cp = M.couplingPick(Tc, mo.d1, Math.max(dv1, dv1motor), K2.nI);
    dv1 = cp.exact ? Math.max(dv1, dv1motor) : cp.bore2;
    if (!cp.c.d.concat(cp.c.d2nd).includes(dv1)) { const b = cp.c.d.concat(cp.c.d2nd).filter(x => x >= dv1).sort((a, b) => a - b)[0]; if (b) dv1 = b; }
    rep.p(`Полученный диаметр округляем до стандартного значения ${fnum(M.shaftStd(dv1r), 0)} мм [[ch|с. 141]] и согласуем с диаметром вала электродвигателя (<i>d</i><sub>эд</sub> = ${mo.d1} мм) и посадочными отверстиями муфты МУВП (раздел 2): диаметры соединяемых валов должны отличаться не более чем на 20 % [[ch|с. 141]]. Принимаем <i>d</i><sub>в1</sub> = ${dv1} мм.`);
    const dv2r = M.torsionD(rep, { lhs: 'd_{в2}', T: K2.TII, Tsym: 'T_{II}', tau: O.tauII });
    let dv2 = M.shaftStd(dv2r);
    for (let i = 0; i < (A.dv2Up || 0); i++) dv2 = M.shaftStd(dv2 + 0.5);
    rep.p(`Принимаем ${A.dv2Up ? 'с учётом проверки вала на прочность (п. 1.11) и прочности шпоночного соединения (п. 1.12)' : 'ближайшее большее'} стандартное значение <i>d</i><sub>в2</sub> = ${dv2} мм; диаметр согласуется с посадочным отверстием ведущей звёздочки цепной передачи.`);
    const s1 = stepDiams(dv1), s2 = stepDiams(dv2);
    s1.dpodsh += 5 * (A.dp1Up || 0); s2.dpodsh += 5 * (A.dp2Up || 0);
    const dpos2 = M.shaftStd(s2.dpodsh + 3), dbur2 = M.shaftStd(dpos2 + 5);
    rep.p('Диаметры последующих ступеней валов назначаются ступенчато (<i>d</i><sub>выход</sub> &lt; <i>d</i><sub>упл</sub> &lt; <i>d</i><sub>подш</sub> &lt; <i>d</i><sub>посад</sub>) с согласованием диаметра под уплотнение со стандартной манжетой по ГОСТ 8752-79 [[ch|табл. 9.16]] и диаметра под подшипник — кратным 5 мм:');
    rep.table('Диаметры ступеней валов, мм', ['Ступень', 'Вал I (червяк)', 'Вал II (колесо)'], [
      ['Выходной конец dв', dv1, dv2], ['Под уплотнение dупл', s1.dupl, s2.dupl], ['Под подшипники dподш', s1.dpodsh, s2.dpodsh], ['Под ступицу колеса dпосад', '—', dpos2], ['Опорный бурт dбурт', '—', dbur2]]);
    rep.h('1.8.2', 'Конструктивные размеры червяка', 3);
    rep.p(`Червяк выполняется за одно целое с валом. Его основные размеры (п. 1.4.3): <i>d</i><sub>1</sub> = ${fnum(g.d1)} мм, <i>d</i><sub>a1</sub> = ${fnum(g.da1)} мм, <i>d</i><sub>f1</sub> = ${fnum(g.df1)} мм, <i>b</i><sub>1</sub> = ${g.b1} мм; радиус закругления вершины витка <i>R</i><sub>a1</sub> = 0,1<i>m</i> = ${fnum(0.1 * g.m)} мм. Для выхода режущего инструмента участки вала, прилегающие к нарезке, протачиваются до диаметра меньше <i>d</i><sub>f1</sub> [[ch|с. 323]].`);
    rep.h('1.8.3', 'Конструктивные размеры червячного колеса', 3);
    const dst = Math.round(1.6 * dpos2), lst = Math.max(g.b2, Math.round(1.2 * dpos2), A.lst || 0), del2 = 1.5 * g.m + 2, e = Math.round(0.25 * g.b2), del0 = Math.round(3 * g.m);
    rep.eq({ lhs: 'd_{ст}', f: '(1{,}5\\ldots 1{,}7)\\cdot d_{посад}', s: `(1{,}5\\ldots 1{,}7)\\cdot ${dpos2}`, raw: `${n(1.5 * dpos2)}\\ldots ${n(1.7 * dpos2)}\\ \\Rightarrow\\ ${dst}`, u: 'мм', d: 'Наружный диаметр ступицы колеса.' });
    rep.eq({ lhs: 'l_{ст}', f: '(0{,}8\\ldots 1{,}5)\\cdot d_{посад}', s: `(0{,}8\\ldots 1{,}5)\\cdot ${dpos2}`, raw: `${n(0.8 * dpos2)}\\ldots ${n(1.5 * dpos2)}\\ \\Rightarrow\\ ${lst}`, u: 'мм', d: 'Длина ступицы, не менее ширины венца b2.' });
    rep.eq({ lhs: '\\delta_{2}', f: '1{,}5\\cdot m+2', s: `1{,}5\\cdot ${nx(g.m)}+2`, v: del2, u: 'мм', d: 'Толщина бронзового венца.' });
    rep.eq({ lhs: 'e', f: '(0{,}2\\ldots 0{,}3)\\cdot b_{2}', s: `(0{,}2\\ldots 0{,}3)\\cdot ${g.b2}`, raw: `${n(0.2 * g.b2)}\\ldots ${n(0.3 * g.b2)}\\ \\Rightarrow\\ ${e}`, u: 'мм', d: 'Толщина диска колеса.' });
    rep.eq({ lhs: '\\delta_{0}', f: '(2{,}5\\ldots 4)\\cdot m', s: `(2{,}5\\ldots 4)\\cdot ${nx(g.m)}`, raw: `${n(2.5 * g.m)}\\ldots ${n(4 * g.m)}\\ \\Rightarrow\\ ${del0}`, u: 'мм', d: 'Толщина обода колеса.' });
    rep.p(`Радиус выточки венца <i>R</i><sub>a</sub> = 0,5<i>d</i><sub>1</sub> − <i>m</i> = ${fnum(g.Ra)} мм; радиус закругления зубьев <i>R</i><sub>f</sub> = 0,5<i>d</i><sub>1</sub> + 1,2<i>m</i> = ${fnum(g.Rf)} мм. Венец из бронзы насаживается на чугунный (СЧ15) центр с натягом и дополнительно фиксируется винтами [[ch|с. 328]].`);
    R.wheel = { dst, lst, del2, e, del0, dpos: dpos2 };
    // 1.9 корпус
    rep = sec('s19', 'shaft', 'Корпус редуктора');
    rep.h('1.9', 'Конструктивные размеры элементов корпуса и компоновка редуктора');
    rep.h('1.9.1', 'Определение конструктивных размеров элементов корпуса редуктора', 3);
    rep.p('Корпус и крышка редуктора — литые из серого чугуна СЧ15; размеры элементов рассчитываются по эмпирическим зависимостям от межосевого расстояния червячной передачи [[met|п. 1.9.1]].');
    const H = M.housing(rep, { aw: g.aw, awSym: 'a_{w}' });
    R.H = H;
    rep.h('1.9.2', 'Вспомогательные конструктивные элементы корпуса', 3);
    rep.list([`резьба сливной пробки М${H.dpr}×1,5 (ГОСТ 19421-74)`, `винты крепления крышки смотрового люка М${H.dks}`, 'маслоуказатель — жезловый, на боковой стенке корпуса в зоне нижнего и верхнего уровней масла', 'отдушина — пробка-отдушина в крышке смотрового люка для выравнивания давления', 'фиксация крышки относительно корпуса — два конических штифта по ГОСТ 3129-70']);
    // подшипники и компоновка
    rep.h('1.9.3', 'Выбор типа подшипников и эскизная компоновка редуктора', 3);
    rep.p('Из-за значительных осевых сил в червячном зацеплении в качестве опор обоих валов применяются конические роликовые радиально-упорные подшипники (тип 7000 по ГОСТ 27365-87), установленные враспор; осевой зазор регулируется набором металлических прокладок под крышками [[met|п. 1.9.3]].');
    const pick = (d, Fr_, Fa_, nn) => M.bearingList('taper', d, ['72', '75', '73', '76'])[0] || D.TAPER.find(b => b.d >= d);
    let b1 = (A.b1 && D.TAPER.find(b => b.id === A.b1)) || pick(s1.dpodsh), b2 = (A.b2 && D.TAPER.find(b => b.id === A.b2)) || pick(s2.dpodsh);
    // компоновочные расстояния
    const gap = H.gap;
    const cpl = M.muvpRow(cp.c.T, dv1) || cp.c;
    const lcouple = cpl.l1 || 60;
    const lv2 = Math.max(Math.round(1.2 * dv2), A.lv2 || 0);
    const layout = () => {
      const l1c = O.l1Mode === 'daM2' ? Math.ceil(g.daM2) : g.b1 + 2 * (gap + b1.T);
      const apx = b => (b.d + b.D) * b.e / 6;
      const l1 = l1c - 2 * apx(b1);
      const l2c = lst + 2 * (gap + b2.T / 2);
      const l2 = l2c - 2 * apx(b2);
      const c1 = b1.T / 2 + apx(b1) + H.del + s1.seal.h + 10 + lcouple / 2;
      const ak2 = b2.T / 2 + apx(b2) + H.del + s2.seal.h + 10 + lv2 / 2;
      return { l1c, l1, l2c, l2, a1: l1 / 2, a2: l2 / 2, c1, ak2, ap1: b1.T / 2 + apx(b1), ap2: b2.T / 2 + apx(b2) };
    };
    let L = layout();
    rep.p(`Предварительно принимаем подшипники ${b1.id.startsWith('72') && b2.id.startsWith('72') ? 'лёгкой серии' : 'по результатам расчёта на долговечность (п. 1.13)'}: для вала червяка — ${b1.id} (<i>d</i> = ${b1.d} мм, <i>D</i> = ${b1.D} мм, <i>T</i> = ${fnum(b1.T, 0)} мм, <i>e</i> = ${fnum(b1.e, 0)}), для вала колеса — ${b2.id} (<i>d</i> = ${b2.d} мм, <i>D</i> = ${b2.D} мм, <i>T</i> = ${fnum(b2.T, 0)} мм, <i>e</i> = ${fnum(b2.e, 0)}) [[ch|прил. П7]].`);
    rep.p(`Эскизная компоновка выполняется в двух проекциях (рисунок {fig:layout}): оси валов вычерчиваются на расстоянии <i>a</i><sub>w</sub> = ${fnum(g.aw)} мм; внутренние стенки корпуса — с зазором <i>c</i> = ${gap} мм от вращающихся деталей; расстояние между подшипниками червяка принимается равным наибольшему диаметру колеса <i>l</i><sub>1</sub> ≈ <i>d</i><sub>aM2</sub> = ${L.l1c} мм [[ch|с. 324]], подшипники вала колеса располагаются симметрично относительно колеса на расстоянии <i>l</i><sub>2</sub> = <i>l</i><sub>ст</sub> + 2(<i>c</i> + <i>T</i>/2) = ${fnum(L.l2c)} мм.`);
    rep.fig('layout', 'Эскизная компоновка червячного редуктора', null, { kind: 'layout' });
    rep.p('Точка приложения радиальной реакции конического роликоподшипника смещена относительно его торца на величину');
    rep.eq({ lhs: 'a_{p}', f: '\\dfrac{T}{2}+\\dfrac{(d+D)\\cdot e}{6}', s: `\\dfrac{${nx(b1.T)}}{2}+\\dfrac{(${b1.d}+${b1.D})\\cdot ${nx(b1.e)}}{6}`, v: L.ap1, u: 'мм', d: 'Смещение точки приложения реакции подшипника вала червяка; для вала колеса аналогично.' });
    rep.p(`Для подшипника ${b2.id}: <i>a</i><sub>p</sub> = ${fnum(L.ap2)} мм. С учётом этого расчётные расстояния между точками приложения реакций: вал червяка <i>l</i><sub>1</sub> = ${fnum(L.l1)} мм (червяк посередине, <i>a</i><sub>1</sub> = ${fnum(L.a1)} мм), консоль до середины полумуфты <i>c</i><sub>1</sub> = ${fnum(L.c1)} мм; вал колеса <i>l</i><sub>2</sub> = ${fnum(L.l2)} мм (<i>a</i><sub>2</sub> = ${fnum(L.a2)} мм), консоль до середины ступицы ведущей звёздочки <i>a</i><sub>k2</sub> = ${fnum(L.ak2)} мм.`);
    R.L = L; R.b1 = b1; R.b2 = b2;
    // 1.10 окончательные размеры валов
    rep = sec('s110', 'shaft', 'Конструктивные размеры валов и подшипниковых узлов');
    rep.h('1.10', 'Конструктивные размеры валов, подшипниковых узлов и компоновка редуктора');
    rep.h('1.10.1', 'Определение конструктивных размеров ступеней валов', 3);
    const lv1 = lcouple;
    rep.p(`<b>Быстроходный вал (вал-червяк).</b> Выходной конец <i>d</i><sub>в1</sub> = ${dv1} мм длиной <i>l</i><sub>в1</sub> = ${lv1} мм (по длине полумуфты); участок под манжету ${s1.seal.d}×${s1.seal.D}×${s1.seal.h} — <i>d</i><sub>упл1</sub> = ${s1.dupl} мм; шейки под подшипники <i>d</i><sub>подш1</sub> = ${s1.dpodsh} мм; нарезанная часть — <i>d</i><sub>a1</sub> = ${fnum(g.da1)} мм, <i>d</i><sub>f1</sub> = ${fnum(g.df1)} мм, <i>b</i><sub>1</sub> = ${g.b1} мм.`);
    rep.p(`<b>Тихоходный вал (вал червячного колеса).</b> Выходной конец под ведущую звёздочку <i>d</i><sub>в2</sub> = ${dv2} мм длиной <i>l</i><sub>в2</sub> ≈ (1,2…1,5)<i>d</i><sub>в2</sub> = ${lv2} мм; участок под манжету ${s2.seal.d}×${s2.seal.D}×${s2.seal.h} — <i>d</i><sub>упл2</sub> = ${s2.dupl} мм; шейки под подшипники <i>d</i><sub>подш2</sub> = ${s2.dpodsh} мм; посадочный участок под колесо <i>d</i><sub>посад2</sub> = ${dpos2} мм длиной ${lst} мм; опорный бурт <i>d</i><sub>бурт2</sub> = ${dbur2} мм.`);
    rep.h('1.10.2', 'Конструирование подшипниковых узлов и крышек', 3);
    rep.p(`Подшипники обоих валов установлены враспор; осевой зазор регулируется набором прокладок под фланцами крышек. Для выходных концов валов применяются проходные крышки с манжетными уплотнениями по ГОСТ 8752-79 (${K2.nI * PI * s1.dupl / 60000 <= 5 ? 'окружная скорость под манжетой вала червяка ' + fnum(K2.nI * PI * s1.dupl / 60000) + ' м/с ≤ 5 м/с — манжеты без пыльника' : 'с пыльником'}), для противоположных торцов — глухие крышки. Толщина фланца крышки принимается равной толщине стенки корпуса: <i>K</i> ≈ δ = ${H.del} мм [[met|п. 1.10.2]].`);
    rep.h('1.10.3', 'Вторая эскизная компоновка и определение опорных расстояний', 3);
    rep.p('По окончательно принятым размерам валов, подшипников и крышек вычерчивается вторая эскизная компоновка редуктора; с неё снимаются расстояния, необходимые для расчёта валов на прочность и подбора подшипников [[met|п. 1.10.3]]:');
    rep.table('Опорные расстояния валов редуктора, мм', ['Обозначение', 'Описание', 'Значение'], [
      ['l₁', 'пролёт между точками приложения реакций подшипников вала червяка', fnum(L.l1)], ['a₁', 'от опоры A до середины нарезки червяка', fnum(L.a1)],
      ['c₁', 'от опоры B до середины полумуфты (сила Fм)', fnum(L.c1)], ['l₂', 'пролёт между точками приложения реакций подшипников вала колеса', fnum(L.l2)],
      ['a₂', 'от опоры A до середины червячного колеса', fnum(L.a2)], ['a_k2', 'от опоры B до середины ступицы ведущей звёздочки (сила Fцеп)', fnum(L.ak2)]]);
    // сегменты валов (для чертежей)
    R.shafts = shaftSegments3({ g, L, b1, b2, s1, s2, dv1, dv2, lv1, lv2, dpos2, dbur2, lst, H });
    R.dims = { dv1, dv2, s1, s2, dpos2, dbur2, lv1, lv2, dst, lst };
    // 1.11 проверка валов
    rep = sec('s111', 'check', 'Проверка прочности и жёсткости валов');
    rep.h('1.11', 'Проверка прочности и жёсткости валов');
    const Fm = O.FmMode === 'met' && O.D0 > 0 ? O.FmK * 2 * Tc * 1e3 / O.D0 : FmGost(K2.TI, false);
    R.Fm = Fm;
    rep.h('1.11.1', 'Быстроходный вал (вал-червяк)', 3);
    rep.p(`Вал изготавливается из стали 45 (улучшение, для заготовки диаметром до 90 мм σ<sub>в</sub> = ${M.steelSb('45', 90).sb} МПа [[ch|табл. 3.3]]); витки червяка закаливаются до HRC ≥ 45. Нагрузки на вал: силы в зацеплении <i>F</i><sub>t1</sub> = ${fnum(Ft1)} Н, <i>F</i><sub>r</sub> = ${fnum(Fr)} Н, <i>F</i><sub>a1</sub> = ${fnum(Ft2)} Н, крутящий момент <i>T</i><sub>I</sub> = ${fnum(K2.TI)} Н·м и консольная сила от муфты.`);
    if (O.FmMode === 'met' && O.D0 > 0) rep.eq({ lhs: 'F_{м}', f: `${nx(O.FmK)}\\cdot \\dfrac{2\\cdot T_{расч}\\cdot 10^{3}}{D_{0}}`, s: `${nx(O.FmK)}\\cdot \\dfrac{2\\cdot ${n(Tc)}\\cdot 10^{3}}{${nx(O.D0)}}`, v: Fm, u: 'Н', d: 'Консольная сила от муфты (раздел 2).' });
    else rep.eq({ lhs: 'F_{м}', f: K2.TI <= 25 ? '50\\sqrt{T_{I}}' : '80\\sqrt{T_{I}}', s: `${K2.TI <= 25 ? 50 : 80}\\sqrt{${n(K2.TI)}}`, v: Fm, u: 'Н', d: 'Консольная нагрузка от муфты, приложенная в середине посадочной части выходного конца, по ГОСТ 16162 ([Ч], с. 141).', ref: ['ch', 'с. 141'] });
    const sb1 = M.steelSb('45', 90).sb;
    const B1 = M.beam(L.l1, [
      { id: 'C', x: L.a1, Fx: -Ft1, Fy: -Fr, Cy: Ft2 * g.d1 / 2 },
      { id: 'D', x: L.l1 + L.c1, Fx: -Fm }]);
    rep.p(`Расчётная схема вала — двухопорная балка (опоры A и B, <i>l</i><sub>1</sub> = ${fnum(L.l1)} мм) с червяком посередине пролёта (сечение C) и консолью <i>c</i><sub>1</sub> = ${fnum(L.c1)} мм за опорой B (сечение D — середина полумуфты). Эпюры изгибающих и крутящего моментов приведены на рисунке {fig:shaft1}.`);
    reactRep(rep, B1, [
      { pl: 'x', F: 'F_{t1}', Fm: Ft1, sgn: 1, a: 'a_{1}', av: L.a1, b: '(l_{1}-a_{1})', bv: L.l1 - L.a1 },
      { pl: 'x', F: 'F_{м}', Fm: Fm, sgn: 1, a: '(l_{1}+c_{1})', av: L.l1 + L.c1, b: 'c_{1}', bv: -L.c1 },
      { pl: 'y', F: 'F_{r}', Fm: Fr, sgn: 1, a: 'a_{1}', av: L.a1, b: '(l_{1}-a_{1})', bv: L.l1 - L.a1 },
      { pl: 'y', C: 'F_{a1}\\cdot \\dfrac{d_{1}}{2}', Cv: Ft2 * g.d1 / 2, sgn: -1 }], 'I', 'l_{1}');
    rep.fig('shaft1', 'Расчётная схема и эпюры моментов вала червяка', null, { kind: 'beam' });
    const MC1 = B1.at(L.a1), MB1 = B1.at(L.l1);
    rep.p(`Изгибающие моменты: в сечении C (под червяком) <i>M</i><sub>x</sub> = ${fnum(MC1.Mx / 1e3)} Н·м, <i>M</i><sub>y</sub> = ${fnum(MC1.My / 1e3)} Н·м (наибольшее из значений слева и справа от пары сил <i>F</i><sub>a1</sub><i>d</i><sub>1</sub>/2); в сечении B (под подшипником со стороны муфты) <i>M</i><sub>x</sub> = <i>F</i><sub>м</sub>·<i>c</i><sub>1</sub> = ${fnum(MB1.Mx / 1e3)} Н·м, <i>M</i><sub>y</sub> = 0. Крутящий момент <i>T</i><sub>I</sub> = ${fnum(K2.TI)} Н·м действует на участке от полумуфты до червяка.`);
    const ch1 = M.shaftCheck(rep, { sb: sb1, n: O.nz, beta: O.betaSh, Kri: O.Kri, wMode: O.wKey, secs: [
      { id: 'C', title: 'Сечение C — середина нарезанной части червяка', d: g.df1, M: MC1, T: K2.TI, Tsym: 'T_{I}', kind: 'press' },
      { id: 'B', title: 'Сечение B — шейка под подшипник со стороны муфты', d: s1.dpodsh, M: MB1, T: K2.TI, Tsym: 'T_{I}', kind: 'press' }] });
    rep.p('Проверка вала-червяка на жёсткость (стрелу прогиба): чрезмерный прогиб приводит к перекосу витков и неравномерному распределению нагрузки по ширине венца колеса.');
    const FS = Math.hypot(Ft1, Fr);
    rep.eq({ lhs: 'F_{\\Sigma 1}', f: '\\sqrt{F_{t1}^{2}+F_{r}^{2}}', s: `\\sqrt{${sq(Ft1)}^{2}+${sq(Fr)}^{2}}`, v: FS, u: 'Н' });
    let Iek = PI * Math.pow(g.df1, 4) / 64;
    if (O.wormStiff === 'ch') { Iek *= (0.375 + 0.625 * g.da1 / g.df1); rep.eq({ lhs: 'I_{экв}', f: '\\dfrac{\\pi d_{f1}^{4}}{64}\\left(0{,}375+0{,}625\\dfrac{d_{a1}}{d_{f1}}\\right)', s: `\\dfrac{\\pi\\cdot ${n(g.df1)}^{4}}{64}\\left(0{,}375+0{,}625\\cdot\\dfrac{${n(g.da1)}}{${n(g.df1)}}\\right)`, v: Iek, u: 'мм⁴', d: 'Приведённый момент инерции сечения червяка [Ч, с. 330].' }); }
    else rep.eq({ lhs: 'I_{экв}', f: '\\dfrac{\\pi\\cdot d_{f1}^{4}}{64}', s: `\\dfrac{\\pi\\cdot ${n(g.df1)}^{4}}{64}`, v: Iek, u: 'мм⁴', d: 'Момент инерции сечения червяка по диаметру впадин.' });
    const fpr = FS * Math.pow(L.l1, 3) / (48 * 2.1e5 * Iek);
    rep.eq({ lhs: 'f', f: '\\dfrac{F_{\\Sigma 1}\\cdot l_{1}^{3}}{48\\cdot E\\cdot I_{экв}}', s: `\\dfrac{${n(FS)}\\cdot ${n(L.l1)}^{3}}{48\\cdot 2{,}1\\cdot 10^{5}\\cdot ${n(Iek)}}`, v: fpr, u: 'мм', d: 'Расчётная стрела прогиба червяка (E = 2,1·10⁵ МПа).' });
    rep.check(`f=${n(fpr, 3)}\\ \\text{мм}\\ \\le\\ [f]=0{,}01\\cdot m=${n(0.01 * g.m, 3)}\\ \\text{мм}`, fpr <= 0.01 * g.m, fpr <= 0.01 * g.m ? 'Жёсткость червяка обеспечена.' : 'Жёсткость недостаточна: уменьшите расстояние между опорами или увеличьте q.');
    R.f1 = fpr; R.B1 = B1; R.ch1 = ch1;
    rep.h('1.11.2', 'Тихоходный вал (вал червячного колеса)', 3);
    const ang = O.chainAngle * D2R, Fcx = chn.Fc * Math.cos(ang), Fcy = chn.Fc * Math.sin(ang);
    rep.p(`Вал воспринимает силы в зацеплении (<i>F</i><sub>t2</sub> = ${fnum(Ft2)} Н, <i>F</i><sub>r</sub> = ${fnum(Fr)} Н, <i>F</i><sub>a2</sub> = ${fnum(Ft1)} Н, момент от осевой силы <i>M</i><sub>a2</sub> = <i>F</i><sub>a2</sub><i>d</i><sub>2</sub>/2 = ${fnum(Ft1 * g.d2 / 2e3)} Н·м) и консольную силу от цепной передачи <i>F</i><sub>цеп</sub> = ${fnum(chn.Fc)} Н, направленную под углом ${O.chainAngle}° к горизонтали: <i>F</i><sub>цеп.x</sub> = ${fnum(Fcx)} Н, <i>F</i><sub>цеп.y</sub> = ${fnum(Fcy)} Н. Направления составляющих приняты наиболее неблагоприятными для опоры B.`);
    const B2 = M.beam(L.l2, [
      { id: 'C', x: L.a2, Fx: -Ft2, Fy: -Fr, Cy: -Ft1 * g.d2 / 2 },
      { id: 'D', x: L.l2 + L.ak2, Fx: -Fcx, Fy: -Fcy }]);
    reactRep(rep, B2, [
      { pl: 'x', F: 'F_{t2}', Fm: Ft2, sgn: 1, a: 'a_{2}', av: L.a2, b: '(l_{2}-a_{2})', bv: L.l2 - L.a2 },
      { pl: 'x', F: 'F_{цеп.x}', Fm: Fcx, sgn: 1, a: '(l_{2}+a_{k2})', av: L.l2 + L.ak2, b: 'a_{k2}', bv: -L.ak2 },
      { pl: 'y', F: 'F_{r}', Fm: Fr, sgn: 1, a: 'a_{2}', av: L.a2, b: '(l_{2}-a_{2})', bv: L.l2 - L.a2 },
      { pl: 'y', C: 'M_{a2}', Cv: -Ft1 * g.d2 / 2, sgn: 1 },
      { pl: 'y', F: 'F_{цеп.y}', Fm: Fcy, sgn: 1, a: '(l_{2}+a_{k2})', av: L.l2 + L.ak2, b: 'a_{k2}', bv: -L.ak2 }], 'II', 'l_{2}');
    rep.fig('shaft2', 'Расчётная схема и эпюры моментов вала червячного колеса', null, { kind: 'beam' });
    const MC2 = B2.at(L.a2), MB2 = B2.at(L.l2);
    rep.p(`Изгибающие моменты: под колесом (сечение C) <i>M</i><sub>x</sub> = ${fnum(MC2.Mx / 1e3)} Н·м, <i>M</i><sub>y</sub> = ${fnum(MC2.My / 1e3)} Н·м; под подшипником B <i>M</i><sub>x</sub> = <i>F</i><sub>цеп.x</sub>·<i>a</i><sub>k2</sub> = ${fnum(MB2.Mx / 1e3)} Н·м, <i>M</i><sub>y</sub> = <i>F</i><sub>цеп.y</sub>·<i>a</i><sub>k2</sub> = ${fnum(MB2.My / 1e3)} Н·м. Крутящий момент <i>T</i><sub>II</sub> = ${fnum(K2.TII)} Н·м передаётся от колеса к звёздочке.`);
    const kC2 = M.key(dpos2);
    const ch2 = M.shaftCheck(rep, { sb: M.steelSb('45', dbur2).sb, n: O.nz, beta: O.betaSh, Kri: O.Kri, wMode: O.wKey, secs: [
      { id: 'C', title: 'Сечение C — под ступицей червячного колеса (шпоночный паз)', d: dpos2, M: MC2, T: K2.TII, Tsym: 'T_{II}', kind: 'key', key: kC2 },
      { id: 'B', title: 'Сечение B — шейка под подшипник со стороны звёздочки', d: s2.dpodsh, M: MB2, T: K2.TII, Tsym: 'T_{II}', kind: 'press' }] });
    R.B2 = B2; R.ch2 = ch2;
    R.beams = { shaft1: { B: B1, names: { C: 'червяк', D: 'полумуфта' }, T: K2.TI, Tx: [L.a1, L.l1 + L.c1] }, shaft2: { B: B2, names: { C: 'колесо', D: 'звёздочка' }, T: K2.TII, Tx: [L.a2, L.l2 + L.ak2] } };
    // 1.12 шпонки
    rep = sec('s112', 'check', 'Шпоночные соединения');
    rep.h('1.12', 'Подбор шпонок и проверочный расчёт шпоночных соединений');
    rep.h('1.12.1', 'Порядок подбора и расчёта призматических шпонок', 3);
    rep.p(`Применяются призматические шпонки по ГОСТ 23360-78 из чистотянутой стали с σ<sub>в</sub> ≥ 590 МПа; длина шпонки принимается на 5…10 мм меньше длины ступицы. Допускаемые напряжения смятия [[met|п. 1.12.1]]: для чугунных ступиц (полумуфта, центр колеса) [σ]<sub>см</sub> = ${O.sCmCI} МПа, для стальной ступицы звёздочки при реверсивной нагрузке [σ]<sub>см</sub> = ${O.sCmRev} МПа.`);
    rep.h('1.12.2', 'Расчёт шпоночных соединений валов редуктора', 3);
    const keys = [];
    keys.push(M.keyCheck(rep, { title: 'Быстроходный вал — полумуфта', d: dv1, lHub: lv1, T: K2.TI, Tsym: 'T_{I}', sig: O.sCmCI, exact: O.keyExact, joint: 'coupling1', two: A.two && A.two.coupling1 }));
    keys.push(M.keyCheck(rep, { title: 'Тихоходный вал — червячное колесо', d: dpos2, lHub: lst, T: K2.TII, Tsym: 'T_{II}', sig: O.sCmCI, exact: O.keyExact, joint: 'wheel', two: A.two && A.two.wheel }));
    keys.push(M.keyCheck(rep, { title: 'Тихоходный вал — ведущая звёздочка', d: dv2, lHub: lv2, T: K2.TII, Tsym: 'T_{II}', sig: O.sCmRev, exact: O.keyExact, joint: 'sprocket', two: A.two && A.two.sprocket }));
    R.keys = keys; attachKeys(R);
    // 1.13 подшипники
    rep = sec('s113', 'check', 'Подшипники качения');
    rep.h('1.13', 'Подбор и проверочный расчёт подшипников качения');
    const Lh = O.LhMode === 'tsum' ? tS : O.Lh;
    rep.p(`Требуемый ресурс подшипников принимается равным суммарному времени работы привода <i>L</i><sub>h</sub> = ${fnum(Lh)} ч. Коэффициент безопасности <i>K</i><sub>б</sub> = ${fnum(O.Kb, 0)} (умеренные толчки, редукторы [[ch|табл. 9.19]]), температурный коэффициент <i>K</i><sub>т</sub> = 1, коэффициент вращения <i>V</i> = 1 (вращается внутреннее кольцо).`);
    rep.h('1.13.1', 'Расчёт подшипников быстроходного вала (червяка)', 3);
    const BR1 = M.bearingCalc(rep, { kind: 'taper', d: s1.dpodsh, Ra: B1.RA, Rb: B1.RB, RAx: Math.abs(B1.RAx), RAy: Math.abs(B1.RAy), RBx: Math.abs(B1.RBx), RBy: Math.abs(B1.RBy), Fa: Ft2, n: K2.nI, Lh, Kb: O.Kb, Kt: 1, order: ['72', '73'], idx: '1', fixed: A.b1 ? R.b1 : null });
    rep.h('1.13.2', 'Расчёт подшипников тихоходного вала', 3);
    const BR2 = M.bearingCalc(rep, { kind: 'taper', d: s2.dpodsh, Ra: B2.RA, Rb: B2.RB, RAx: Math.abs(B2.RAx), RAy: Math.abs(B2.RAy), RBx: Math.abs(B2.RBx), RBy: Math.abs(B2.RBy), Fa: Ft1, n: K2.nII, Lh, Kb: O.Kb, Kt: 1, order: ['72', '73'], idx: '2', fixed: A.b2 ? R.b2 : null });
    R.BR1 = BR1; R.BR2 = BR2;
    // компоновка и ступени валов рассчитаны под b1/b2; если по долговечности выбран другой подшипник — пересчёт (adjust3)
    R.b1L = b1.id; R.b2L = b2.id;
    if (BR1 && BR1.b.id !== b1.id) { R.b1 = BR1.b; }
    if (BR2 && BR2.b.id !== b2.id) { R.b2 = BR2.b; }
    // 1.14 посадки
    rep = sec('s114', 'other', 'Посадки и смазка');
    rep.h('1.14', 'Посадки деталей и сборочных единиц редуктора');
    fitsSection(rep, [
      'внутренние кольца подшипников на валы — по полю допуска k6 (циркуляционное нагружение), наружные кольца в расточки корпуса — по H7 (местное нагружение)',
      'бронзовый венец на центр червячного колеса — H7/p6 (неразъёмное прессовое соединение, дополнительно — винты в плоскости стыка)',
      'червячное колесо на тихоходный вал — H7/k6, крутящий момент передаётся призматической шпонкой',
      'полумуфта на выходной конец быстроходного вала — H7/m6 (реверсивная работа)',
      'ведущая звёздочка на выходной конец тихоходного вала — H7/m6',
      'крышки подшипников в корпус — H7/d11 (посадка с зазором, упрощает регулировку прокладками)',
      'шпоночные пазы: на валу — N9, в ступице — Js9',
      'штифты фиксации крышки — H7/m6',
      'шероховатость: шейки под подшипники Ra 0,8, расточки корпуса Ra 1,6, посадочные поверхности под колесо Ra 1,6, поверхность под манжету Ra 0,32, рабочие поверхности витков червяка Ra 0,32, зубьев колеса Ra 1,6, нерабочие поверхности Ra 6,3…12,5']);
    rep.h('1.15', 'Смазка червячного зацепления и подшипников');
    let oil;
    if (O.oilMode === 'ch') {
      const si = st.sigH <= 200 ? 0 : st.sigH <= 250 ? 1 : 2, vi = ck.vs <= 2 ? 0 : ck.vs <= 5 ? 1 : 2, nu = D.OIL_WORM[si][vi];
      const o = D.OILS.filter(x => x.t === 100).sort((a, b) => Math.abs(a.lo - nu) - Math.abs(b.lo - nu))[0];
      oil = o.name;
      rep.p(`Смазывание зацепления — окунанием (картерное). При контактных напряжениях σ<sub>H</sub> = ${fnum(st.sigH)} МПа и скорости скольжения <i>v</i><sub>s</sub> = ${fnum(ck.vs)} м/с рекомендуемая кинематическая вязкость масла при 100 °C — ${nu}·10<sup>−6</sup> м²/с [[ch|табл. 10.9]]; принимаем масло ${o.name} [[ch|табл. 10.10]].`);
    } else {
      oil = ck.vs <= 2 ? 'И-Т-С-320' : 'И-Т-С-220';
      rep.p(`Смазывание зацепления — окунанием (картерный способ). Принимается масло индустриальное ${oil} по ГОСТ 17479.4-87: при скорости скольжения <i>v</i><sub>s</sub> = ${fnum(ck.vs)} м/с ${ck.vs <= 2 ? '≤ 2 м/с — более вязкое' : '— менее вязкое (ИТС-220)'} [[met|п. 1.15]]. Масло заливается так, чтобы червяк погружался в него на высоту витка.`);
    }
    const V = 0.7 * K2.PI;
    rep.eq({ lhs: 'V', f: '0{,}7\\cdot P_{I}', s: `0{,}7\\cdot ${n(K2.PI)}`, v: V, u: 'л', d: 'Объём масляной ванны (не менее 0,7 л на 1 кВт передаваемой мощности).' });
    rep.p('Подшипники качения смазываются пластичной смазкой солидол УС-1, закладываемой в подшипниковые камеры при сборке. Для контроля уровня предусмотрен жезловый маслоуказатель, в нижней точке картера — сливная пробка, в крышке люка — отдушина.');
    R.oil = oil; R.V = V;
    // 2 муфта
    rep = sec('s2', 'other', 'Подбор муфты');
    rep.h('2', 'Подбор муфты', 1);
    rep.p('Упругая втулочно-пальцевая муфта (МУВП) по ГОСТ 21424-93 соединяет выходной конец вала электродвигателя с валом червяка; она компенсирует небольшие радиальные, осевые и угловые смещения валов и смягчает динамические нагрузки.');
    const cr = couplingSection(rep, { T: K2.TI, Tsym: 'T_{I}', n: K2.nI, dm: mo.d1, dv: dv1, K: O.Kcoup, cp: M.couplingPick(Tc, mo.d1, dv1, K2.nI), O, kText: 'для сварочного кантователя с умеренными толчками и реверсивным вращением K = 1,5…1,8' });
    R.cp = cr;
    R.sections = S;
    R.summary = [
      ['Двигатель', `${mo.type}, ${fnum(mo.P, 0)} кВт, ${mo.n} мин⁻¹`], ['Передаточное отношение редуктора', fnum(g.uf, 0)], ['Червячная пара', `aw = ${fnum(g.aw)} мм, m = ${fnum(g.m, 0)} мм, q = ${fnum(g.q, 0)}, z1/z2 = ${g.z1}/${g.z2}`],
      ['Материал венца', `${mt.mat.name}`], ['Цепь', `${chn.code} ГОСТ 13568-75, z1/z2 = ${chn.z1}/${chn.z2}`], ['Подшипники', `${(R.b1 || b1).id}, ${(R.b2 || b2).id}`], ['Муфта', cr.code], ['Температура масла', `${fnum(th.t)} °C`]];
    R.kpis = [['Двигатель', mo.type], ['uч', fnum(g.uf, 0)], ['aw', fnum(g.aw) + ' мм'], ['m / q', fnum(g.m, 0) + ' / ' + fnum(g.q, 0)], ['σH / [σH]', fnum(st.sigH) + ' / ' + fnum(ck.sH) + ' МПа'], ['ηч', fnum(ck.eta, 3)], ['Цепь', chn.code], ['tм', fnum(th.t) + ' °C']];
    return R;
  }

  /* Итерационное согласование: при невыполнении проверок изменяются исходные конструктивные решения
     (aw, диаметр выходного конца, длины ступиц, подшипники), и весь расчёт повторяется. В отчёт попадает только итоговый вариант. */
  function solve(core, P) {
    const A = { two: {} };
    let R;
    for (let it = 0; it < 40; it++) {
      R = core(P, A);
      const ch = R.adjust ? R.adjust(A) : false;
      if (!ch) break;
    }
    return R;
  }
  function adjust3(R, A, P) {
    const O = P.O;
    if (O.autoFix === false) return false;
    if (R.mt.mat.type === 'al' && R.ck.vs > 5 && !A.wormMat && (!O.wormMat || O.wormMat === 'auto')) { A.wormMat = 'БрО10Ф1-' + (O.wormCast || 'П'); A.vsHint = R.ck.vs; A.awMin = 0; return true; }
    if (R.st.sigH > 1.05 * R.ck.sH || R.st.sigF > R.mt.sF) { A.awMin = D.STD.aww.find(x => x > R.g.aw + 1e-9) || R.g.aw; return true; }
    if (R.BR1 && !R.BR1.ok) { A.dp1Up = (A.dp1Up || 0) + 1; A.b1 = null; return true; }
    if (R.BR2 && !R.BR2.ok) { A.dp2Up = (A.dp2Up || 0) + 1; A.b2 = null; return true; }
    if (R.BR1 && R.BR1.b.id !== (R.b1L || R.b1.id)) { A.b1 = R.BR1.b.id; return true; }
    if (R.BR2 && R.BR2.b.id !== (R.b2L || R.b2.id)) { A.b2 = R.BR2.b.id; return true; }
    if (R.ch1 && !R.ch1.ok) { A.dp1Up = (A.dp1Up || 0) + 1; return true; }
    if (R.ch2 && !R.ch2.ok) { A.dv2Up = (A.dv2Up || 0) + 1; return true; }
    for (const k of R.keys) {
      if (k.ok) continue;
      const need = M.keyHubNeed({ d: k.d, T: k.joint === 'coupling1' ? R.K.TI : R.K.TII, sig: k.joint === 'sprocket' ? O.sCmRev : O.sCmCI, exact: O.keyExact });
      if (k.joint === 'wheel') { const max = Math.round(1.5 * R.dims.dpos2); if (need && need <= max && need > (A.lst || 0)) { A.lst = need; return true; } if (!A.two.wheel) { A.two.wheel = true; return true; } }
      if (k.joint === 'sprocket') { const max = Math.round(1.5 * R.dims.dv2); if (need && need <= max && need > (A.lv2 || 0)) { A.lv2 = need; return true; } if ((A.dv2Up || 0) < 3) { A.dv2Up = (A.dv2Up || 0) + 1; A.lv2 = 0; return true; } if (!A.two.sprocket) { A.two.sprocket = true; return true; } }
      if (k.joint === 'coupling1' && !A.two.coupling1) { A.two.coupling1 = true; return true; }
    }
    return false;
  }
  function task3(P) { return solve((P, A) => { const R = task3core(P, A); R.adjust = A2 => adjust3(R, A2, P); return R; }, P); }

  /* привязка размеров шпонок к ступеням валов */
  function attachKeys(R) {
    if (!R.shafts) return;
    for (const k of Object.keys(R.shafts)) for (const sg of R.shafts[k]) if (typeof sg.key === 'string') { const kk = R.keys.find(x => x.joint === sg.key); if (kk) sg.keyDim = kk; }
  }
  /* сегменты валов задания 3 (от левого торца, A — слева) */
  function shaftSegments3(o) {
    const { g, L, b1, b2, s1, s2, dv1, dv2, lv1, lv2, dpos2, dbur2, lst, H } = o;
    // вал червяка: опора A слева, B справа, выходной конец справа (муфта)
    const T1 = b1.T, seal1 = H.del + s1.seal.h + 10;
    const xA = 0, xB = L.l1c, lenBody = L.l1c - T1;           // между внутренними торцами подшипников
    const dBody = Math.min(M.shaftStd(s1.dpodsh + 5), Math.floor(g.df1 - 2));
    const thread = g.b1, side = (lenBody - thread) / 2;
    const w = [
      { d: s1.dpodsh, l: T1, name: 'подшипник A' }, { d: dBody, l: side, name: 'участок вала' }, { d: g.da1, l: thread, name: 'нарезка червяка', gear: { kind: 'worm', da: g.da1, df: g.df1, d: g.d1, m: g.m, z: g.z1, q: g.q } },
      { d: dBody, l: side, name: 'участок вала' }, { d: s1.dpodsh, l: T1, name: 'подшипник B' }, { d: s1.dupl, l: seal1, name: 'под манжету' }, { d: dv1, l: lv1, name: 'выходной конец (муфта)', key: 'coupling1' }];
    // вал колеса
    const T2 = b2.T, seal2 = H.del + s2.seal.h + 10, gap = (L.l2c - lst) / 2 - T2 / 2;
    const collar = Math.min(10, Math.max(6, Math.round(gap / 2)));
    const v = [
      { d: s2.dpodsh, l: T2 + gap - collar, name: 'подшипник A' }, { d: dbur2, l: collar, name: 'бурт' }, { d: dpos2, l: lst, name: 'под ступицу колеса', key: 'wheel' },
      { d: s2.dpodsh, l: gap + T2, name: 'втулка + подшипник B' }, { d: s2.dupl, l: seal2, name: 'под манжету' }, { d: dv2, l: lv2, name: 'выходной конец (звёздочка)', key: 'sprocket' }];
    return { I: w, II: v };
  }

  /* раздел «Подбор муфты» */
  function couplingSection(rep, o) {
    const O = o.O, Tc = o.K * o.T;
    rep.h('2.1', 'Исходные данные и расчётный момент');
    rep.p(`Передаваемый момент <i>${o.Tsym === 'T_{I}' ? 'T' : 'T'}</i><sub>I</sub> = ${fnum(o.T)} Н·м, частота вращения <i>n</i><sub>I</sub> = ${fnum(o.n)} мин<sup>−1</sup>, диаметр вала электродвигателя <i>d</i><sub>эд</sub> = ${o.dm} мм, диаметр быстроходного вала редуктора <i>d</i><sub>в1</sub> = ${o.dv} мм. Коэффициент режима работы принимаем <i>K</i><sub>р</sub> = ${fnum(o.K, 0)} (${o.kText}) [[met|${mref('kreg')}]].`);
    rep.eq({ lhs: 'T_{расч}', f: `K_{р}\\cdot ${o.Tsym}`, s: `${nx(o.K)}\\cdot ${n(o.T)}`, v: Tc, u: 'Н·м', d: 'Расчётный момент муфты с учётом режима работы привода.' });
    const c = o.cp.c;
    const bores = c.d.concat(c.d2nd).sort((a, b) => a - b);
    rep.h('2.2', 'Выбор муфты по ГОСТ 21424-93');
    rep.p(`По ГОСТ 21424-93 [[gost21424|табл. 1]] выбираем муфту с номинальным крутящим моментом [<i>T</i>] = ${fnum(c.T, 0)} Н·м ≥ <i>T</i><sub>расч</sub> = ${fnum(Tc)} Н·м; диаметры посадочных отверстий полумуфт этого типоразмера — ${bores.join(', ')} мм; ${o.cp.exact ? `обе полумуфты выполняются по диаметрам соединяемых валов (${o.dm} и ${o.dv} мм)` : `разница диаметров валов превышает возможности одного типоразмера, поэтому муфта подобрана по большему диаметру, полумуфта с меньшим отверстием растачивается`}. Наружный диаметр <i>D</i> = ${c.D} мм, длина полумуфты (исполнение 1) <i>l</i> = ${c.l1} мм, общая длина <i>L</i> = ${c.L1} мм, допускаемая частота вращения ${fnum(c.n, 0)} мин<sup>−1</sup>, допускаемые смещения валов: радиальное ${fnum(c.dr, 0)} мм, угловое ${c.da}.`);
    rep.check(`n_{доп}=${fnum(c.n, 0)}\\ \\text{мин}^{-1}\\ \\ge\\ n_{I}=${n(o.n)}\\ \\text{мин}^{-1}`, c.n >= o.n, '');
    const code = `Муфта упругая втулочно-пальцевая ${String(c.T).replace('.', ',')}-${o.dv}-1${o.dm !== o.dv ? '-' + o.dm + '-1' : ''} У3 ГОСТ 21424-93`;
    rep.p(`Условное обозначение: ${code}.`);
    const R = { c, code, Tc };
    rep.h('2.3', 'Проверочный расчёт элементов муфты');
    if (O.D0 > 0 && O.zp > 0 && O.dp > 0 && O.lvt > 0) {
      const scm = 2000 * Tc / (O.zp * O.D0 * O.dp * O.lvt);
      rep.p(`Размеры пальцев и втулок выбранной муфты: <i>D</i><sub>0</sub> = ${O.D0} мм, <i>z</i> = ${O.zp}, <i>d</i><sub>п</sub> = ${O.dp} мм, <i>l</i><sub>вт</sub> = ${O.lvt} мм, <i>C</i> = ${O.Cm} мм.`);
      rep.eq({ lhs: '\\sigma_{см}', f: '\\dfrac{2000\\cdot T_{расч}}{z\\cdot D_{0}\\cdot d_{п}\\cdot l_{вт}}', s: `\\dfrac{2000\\cdot ${n(Tc)}}{${O.zp}\\cdot ${O.D0}\\cdot ${O.dp}\\cdot ${O.lvt}}`, v: scm, u: 'МПа', d: 'Напряжение смятия упругих резиновых втулок.' });
      rep.check(`\\sigma_{см}=${n(scm)}\\ \\text{МПа}\\ \\le\\ [\\sigma]_{см}=${nx(O.sCmRub)}\\ \\text{МПа}`, scm <= O.sCmRub, '');
      const siz = 2000 * Tc * (0.5 * O.lvt + O.Cm) / (O.zp * O.D0 * 0.1 * Math.pow(O.dp, 3));
      rep.eq({ lhs: '\\sigma_{изг}', f: '\\dfrac{2000\\cdot T_{расч}\\cdot(0{,}5\\cdot l_{вт}+C)}{z\\cdot D_{0}\\cdot 0{,}1\\cdot d_{п}^{3}}', s: `\\dfrac{2000\\cdot ${n(Tc)}\\cdot(0{,}5\\cdot ${O.lvt}+${O.Cm})}{${O.zp}\\cdot ${O.D0}\\cdot 0{,}1\\cdot ${O.dp}^{3}}`, v: siz, u: 'МПа', d: 'Напряжение изгиба стальных пальцев в опасном сечении (на стыке полумуфт).' });
      rep.check(`\\sigma_{изг}=${n(siz)}\\ \\text{МПа}\\ \\le\\ [\\sigma]_{изг}=${nx(O.sIzgPin)}\\ \\text{МПа}`, siz <= O.sIzgPin, '');
      R.scm = scm; R.siz = siz;
    } else {
      rep.note('Для проверки упругих втулок на смятие и пальцев на изгиб нужны D0, z, dп, lвт и C выбранной муфты — в ГОСТ 21424-93 и в [Ч] они не приводятся. Задайте их во вкладке «Данные» → «Константы методики» (муфта), и проверка появится здесь.', 'warn');
      rep.p('Муфта выбрана по ГОСТ 21424-93 по расчётному моменту, диаметрам соединяемых валов и допускаемой частоте вращения; размеры упругих элементов стандартной муфты обеспечивают передачу номинального крутящего момента.').rep = true;
    }
    rep.h('2.4', 'Компенсирующая способность и нагрузки на валы');
    rep.p(`Муфта МУВП допускает радиальное смещение валов до ${fnum(c.dr, 0)} мм и угловое до ${c.da} [[gost21424|табл. 1]]. ${o.fmUsed === false ? 'Консольная сила от муфты в расчёте быстроходного вала не учитывается (расчётная схема методички).' : 'Консольная сила от муфты учтена при расчёте быстроходного вала (' + mref('fm') + ').'}`);
    return R;
  }

  root.TASKS_CALC = { mref, defaults, OPT_DEF, task3, solve, attachKeys, couplingSection, reactRep, shiftsK, secInput, motorSection, shaftsTable, fitsSection, stepDiams, FmGost };
})(typeof window !== 'undefined' ? window : globalThis);
