/* tasks16.js — задания 1 (коническо-цилиндрический редуктор) и 6 (двухступенчатый цилиндрический редуктор + цепь + вал барабана) */
(function (root) {
  'use strict';
  const D = root.DATA, F = root.F, M = root.MECH, G = root.GEAR, TC = root.TASKS_CALC;
  const { n, nx, sq, fnum, up, near, D2R, Report } = F;
  const PI = Math.PI;
  const THREADS = [16, 18, 20, 22, 24, 27, 30, 33, 36, 39, 42, 45, 48, 52, 56, 60, 64, 68, 72, 76, 80];

  /* ---------- общие помощники ---------- */
  const apx = b => b.kind === 'taper' ? (b.d + b.D) * b.e / 6 : 0;   // смещение точки реакции к середине пролёта
  const bw = b => b.kind === 'taper' ? b.T : b.B;
  function pickBearing(kind, d, fixedId) {
    const cat = kind === 'taper' ? D.TAPER : D.BALL;
    if (fixedId) { const b = cat.find(x => x.id === fixedId); if (b) return b; }
    const pre = kind === 'taper' ? ['72', '75', '73', '76'] : ['2', '3', '4'];
    for (const p of pre) { const b = cat.find(x => x.d === d && x.id.startsWith(p) && x.id.length === p.length + 2); if (b) return b; }
    return cat.find(b => b.d === d) || cat.filter(b => b.d >= d).sort((x, y) => x.d - y.d)[0] || cat.slice().sort((x, y) => y.d - x.d)[0];
  }
  function wheelDims(rep, o) {
    // o: { dpos, b, m, idx, cone: { mte, Re } }
    const d = o.dpos, dst = Math.round(1.6 * d), lst = Math.max(o.b, Math.round(1.2 * d), o.lstMin || 0);
    rep.eq({ lhs: `d_{ст${o.idx}}`, f: `(1{,}5\\ldots 1{,}7)\\cdot d_{посад}`, s: `(1{,}5\\ldots 1{,}7)\\cdot ${d}`, raw: `${n(1.5 * d)}\\ldots ${n(1.7 * d)}\\ \\Rightarrow\\ ${dst}`, u: 'мм', d: 'Наружный диаметр ступицы колеса.' });
    rep.eq({ lhs: `l_{ст${o.idx}}`, f: `(0{,}8\\ldots 1{,}5)\\cdot d_{посад}`, s: `(0{,}8\\ldots 1{,}5)\\cdot ${d}`, raw: `${n(0.8 * d)}\\ldots ${n(1.5 * d)}\\ \\Rightarrow\\ ${lst}`, u: 'мм', d: 'Длина ступицы — не менее ширины венца, согласуется с длиной шпонки.' });
    const R = { dst, lst };
    if (o.cone) {
      const S = 2.2 * o.cone.mte + 0.05 * o.b, e = 0.13 * o.cone.Re, d0 = 3 * o.cone.mte;
      rep.eq({ lhs: 'S', f: '2{,}2\\cdot m_{te}+0{,}05\\cdot b', s: `2{,}2\\cdot ${n(o.cone.mte)}+0{,}05\\cdot ${o.b}`, v: S, raw: `${n(S)}\\ \\Rightarrow\\ ${Math.ceil(S)}`, u: 'мм', d: 'Толщина торцов зубчатого венца.' });
      rep.eq({ lhs: 'e', f: '(0{,}1\\ldots 0{,}17)\\cdot R_{e}', s: `(0{,}1\\ldots 0{,}17)\\cdot ${n(o.cone.Re)}`, raw: `${n(0.1 * o.cone.Re)}\\ldots ${n(0.17 * o.cone.Re)}\\ \\Rightarrow\\ ${Math.round(e)}`, u: 'мм', d: 'Толщина диска колеса.' });
      rep.eq({ lhs: '\\delta_{0}', f: '(2{,}5\\ldots 4)\\cdot m_{te}', s: `(2{,}5\\ldots 4)\\cdot ${n(o.cone.mte)}`, raw: `${n(2.5 * o.cone.mte)}\\ldots ${n(4 * o.cone.mte)}\\ \\Rightarrow\\ ${Math.round(d0)}`, u: 'мм', d: 'Толщина обода колеса.' });
      Object.assign(R, { S: Math.ceil(S), e: Math.round(e), d0: Math.round(d0) });
    } else {
      const e = Math.round(0.25 * o.b), d0 = Math.round(3 * o.m);
      rep.eq({ lhs: `e_{${o.idx}}`, f: '(0{,}2\\ldots 0{,}3)\\cdot b', s: `(0{,}2\\ldots 0{,}3)\\cdot ${o.b}`, raw: `${n(0.2 * o.b)}\\ldots ${n(0.3 * o.b)}\\ \\Rightarrow\\ ${e}`, u: 'мм', d: 'Толщина диска колеса.' });
      rep.eq({ lhs: `\\delta_{0${o.idx}}`, f: '(2{,}5\\ldots 4)\\cdot m', s: `(2{,}5\\ldots 4)\\cdot ${nx(o.m)}`, raw: `${n(2.5 * o.m)}\\ldots ${n(4 * o.m)}\\ \\Rightarrow\\ ${d0}`, u: 'мм', d: 'Толщина обода колеса.' });
      Object.assign(R, { e, d0 });
    }
    return R;
  }
  /* корпус по [М] задания 1 (п. 1.8) */
  function housing1(rep, aw) {
    const R = {};
    const del = Math.max(8, Math.ceil(0.025 * aw + 3)), del1 = Math.max(8, Math.ceil(0.02 * aw + 3));
    rep.h('1.8.1', 'Расчёт толщины стенок корпуса и крышки редуктора', 3);
    rep.eq({ lhs: '\\delta', f: '0{,}025\\cdot a_{w}+(1\\ldots 5)', s: `0{,}025\\cdot ${n(aw)}+(1\\ldots 5)`, raw: `${n(0.025 * aw + 1)}\\ldots ${n(0.025 * aw + 5)}\\ \\Rightarrow\\ ${del}`, u: 'мм', d: 'Толщина стенки основания корпуса (не менее 8 мм по условиям литья).' });
    rep.eq({ lhs: '\\delta_{1}', f: '0{,}02\\cdot a_{w}+(1\\ldots 5)', s: `0{,}02\\cdot ${n(aw)}+(1\\ldots 5)`, raw: `${n(0.02 * aw + 1)}\\ldots ${n(0.02 * aw + 5)}\\ \\Rightarrow\\ ${del1}`, u: 'мм', d: 'Толщина стенки крышки редуктора.' });
    const c = Math.round(0.85 * del);
    rep.eq({ lhs: "c'", f: '0{,}85\\cdot \\delta', s: `0{,}85\\cdot ${del}`, v: 0.85 * del, raw: `${n(0.85 * del)}\\ \\Rightarrow\\ ${c}`, u: 'мм', d: 'Толщина рёбер жёсткости.' });
    rep.h('1.8.2', 'Расчёт присоединительных фланцев и поясов корпуса', 3);
    const s = Math.round(1.5 * del), s1 = Math.round(1.5 * del1), t = Math.round(2.35 * del);
    rep.eq({ lhs: 's', f: '1{,}5\\cdot \\delta', s: `1{,}5\\cdot ${del}`, v: 1.5 * del, raw: `${n(1.5 * del)}\\ \\Rightarrow\\ ${s}`, u: 'мм', d: 'Толщина верхнего фланца (пояса) корпуса.' });
    rep.eq({ lhs: 's_{1}', f: '1{,}5\\cdot \\delta_{1}', s: `1{,}5\\cdot ${del1}`, v: 1.5 * del1, raw: `${n(1.5 * del1)}\\ \\Rightarrow\\ ${s1}`, u: 'мм', d: 'Толщина фланца (пояса) крышки.' });
    rep.eq({ lhs: 't', f: '(2\\ldots 2{,}5)\\cdot \\delta', s: `(2\\ldots 2{,}5)\\cdot ${del}`, raw: `${n(2 * del)}\\ldots ${n(2.5 * del)}\\ \\Rightarrow\\ ${t}`, u: 'мм', d: 'Толщина нижнего привального фланца корпуса.' });
    rep.h('1.8.3', 'Определение диаметров крепёжных деталей и размеров фланцев', 3);
    let df = M.bolt(2 * del); if (df < 16) df = 16;
    rep.eq({ lhs: 'd_{ф}', f: '(1{,}5\\ldots 2{,}5)\\cdot \\delta', s: `(1{,}5\\ldots 2{,}5)\\cdot ${del}`, raw: `${n(1.5 * del)}\\ldots ${n(2.5 * del)}\\ \\Rightarrow\\ \\text{М}${df}`, u: 'мм', d: 'Фундаментные болты для крепления к раме (плите).' });
    const K2 = Math.ceil(2.1 * df), dk = M.bolt(0.55 * df), dkp = M.bolt(0.75 * df), K = 3 * dk, dpr = up(1.6 * dk, D.STD.bolt);
    rep.eq({ lhs: 'K_{2}', f: '2{,}1\\cdot d_{ф}', s: `2{,}1\\cdot ${df}`, v: 2.1 * df, raw: `${n(2.1 * df)}\\ \\Rightarrow\\ ${K2}`, u: 'мм', cmp: '\\ge', d: 'Ширина нижнего фланца корпуса.' });
    rep.eq({ lhs: 'd_{к}', f: '(0{,}5\\ldots 0{,}6)\\cdot d_{ф}', s: `(0{,}5\\ldots 0{,}6)\\cdot ${df}`, raw: `${n(0.5 * df)}\\ldots ${n(0.6 * df)}\\ \\Rightarrow\\ \\text{М}${dk}`, u: 'мм', d: 'Болты, соединяющие крышку с корпусом по длинным сторонам.' });
    rep.eq({ lhs: 'd_{кп}', f: '0{,}75\\cdot d_{ф}', s: `0{,}75\\cdot ${df}`, v: 0.75 * df, raw: `${n(0.75 * df)}\\ \\Rightarrow\\ \\text{М}${dkp}`, u: 'мм', d: 'Болты у подшипниковых гнёзд.' });
    rep.eq({ lhs: 'K', f: '3\\cdot d_{к}', s: `3\\cdot ${dk}`, v: K, u: 'мм', d: 'Ширина соединительных фланцев около подшипников.' });
    rep.h('1.8.4', 'Вспомогательные конструктивные элементы корпуса', 3);
    rep.eq({ lhs: 'd_{пр}', f: '(1{,}6\\ldots 2{,}2)\\cdot d_{к}', s: `(1{,}6\\ldots 2{,}2)\\cdot ${dk}`, raw: `${n(1.6 * dk)}\\ldots ${n(2.2 * dk)}\\ \\Rightarrow\\ \\text{М}${dpr}\\times 1{,}5`, u: 'мм', d: 'Резьба сливной пробки (ГОСТ 19421-74).' });
    rep.p('Винты крепления крышки смотрового люка — М8 (<i>d</i><sub>кс</sub> = 6…10 мм); смотровой люк выполняется на верхнем торце крышки для осмотра зацепления и заливки масла [[met|п. 1.8]].');
    Object.assign(R, { del, del1, c, s, s1, t, d1: df, d2: dkp, d3: dk, K2, K, dpr, dks: 8, gap: Math.max(10, Math.ceil(1.2 * del)), gapTop: Math.ceil(2 * del), gapBot: Math.ceil(3.5 * del) });
    return R;
  }
  /* предварительный диаметр вала */
  function dTors(rep, lhs, T, Tsym, tau) { return M.torsionD(rep, { lhs, T, Tsym, tau, mode: '16pi' }); }
  function sealStep(d) { return M.seal(d + 2); }

  /* ---------- проверка вала: балка + отчёт ---------- */
  function shaftBlock(rep, o) {
    // o: { l, lsym, loads (для beam), terms (для reactRep), fig, figTitle, secs (с x), sb, O, Tsym, T }
    const B = M.beam(o.l, o.loads);
    rep.p(o.intro);
    TC.reactRep(rep, B, o.terms, '', o.lsym);
    rep.eq({ lhs: 'R_{A}', f: '\\sqrt{R_{Ax}^{2}+R_{Ay}^{2}}', s: `\\sqrt{${sq(B.RAx)}^{2}+${sq(B.RAy)}^{2}}`, v: B.RA, u: 'Н', d: 'Суммарная радиальная реакция опоры A.' });
    rep.eq({ lhs: 'R_{B}', f: '\\sqrt{R_{Bx}^{2}+R_{By}^{2}}', s: `\\sqrt{${sq(B.RBx)}^{2}+${sq(B.RBy)}^{2}}`, v: B.RB, u: 'Н', d: 'Суммарная радиальная реакция опоры B.' });
    rep.fig(o.fig, o.figTitle, null, { kind: 'beam' });
    const secs = o.secs.map(sc => Object.assign({}, sc, { M: B.at(sc.x) }));
    rep.p('Изгибающие моменты в характерных сечениях: ' + secs.map(sc => `${sc.id} — <i>M</i><sub>x</sub> = ${fnum(sc.M.Mx / 1e3)} Н·м, <i>M</i><sub>y</sub> = ${fnum(sc.M.My / 1e3)} Н·м`).join('; ') + `. Крутящий момент <i>T</i> = ${fnum(o.T)} Н·м.`);
    const ch = M.shaftCheck(rep, { sb: o.sb, n: o.O.nz, beta: o.O.betaSh, Kri: o.O.Kri, wMode: o.O.wKey, secs });
    return { B, ch };
  }

  /* =================================================================== задание 6 */
  function task6core(P, A) {
    root.MREF_TASK = 6;
    const O = Object.assign({}, P.O), T = D.TASKS[6], S = [], R = { task: 6 };
    const sec = (id, tab, title) => { const r = new Report(tab); r.id = id; r.title = title; S.push(r); return r; };
    let rep = sec('s11', 'kin', 'Исходные данные');
    rep.h('1', 'Расчёт привода', 1);
    const tS = TC.secInput(rep, P, T); R.tS = tS;
    // 1.2
    rep = sec('s12', 'kin', 'Электродвигатель и кинематический расчёт');
    rep.h('1.2', 'Выбор электродвигателя и кинематический расчёт');
    rep.p('Привод ленточного конвейера разбивается на четыре вала: вал I — быстроходный (входной) вал редуктора; вал II — промежуточный вал редуктора; вал III — тихоходный (выходной) вал редуктора; вал IV — вал конвейера с барабаном.');
    rep.h('1.2.1', 'Определение общего КПД привода и требуемой мощности электродвигателя', 3);
    rep.p(`Принимаем КПД элементов привода [[met|п. 1.2.1]], [[ch|табл. 1.1]]: муфты η<sub>м</sub> = ${fnum(O.etaM, 0)}; быстроходной и тихоходной цилиндрических передач η<sub>ц.б</sub> = η<sub>ц.т</sub> = ${fnum(O.etaCyl, 0)}; открытой цепной передачи η<sub>цеп</sub> = ${fnum(O.etaCh, 0)}; пары подшипников качения η<sub>подш</sub> = ${fnum(O.etaB, 0)}.`);
    const eta = O.etaM * O.etaCyl * O.etaCyl * O.etaCh * Math.pow(O.etaB, 4), Preq = P.Pout / eta;
    rep.eq({ lhs: '\\eta_{общ}', f: '\\eta_{м}\\cdot \\eta_{ц.б}\\cdot \\eta_{ц.т}\\cdot \\eta_{цеп}\\cdot \\eta_{подш}^{4}', s: `${nx(O.etaM)}\\cdot ${nx(O.etaCyl)}\\cdot ${nx(O.etaCyl)}\\cdot ${nx(O.etaCh)}\\cdot ${nx(O.etaB)}^{4}`, v: eta, sig: 4, d: 'Общий КПД привода — произведение КПД последовательно соединённых передач и пар подшипников.' });
    rep.eq({ lhs: 'P_{расч}', f: '\\dfrac{P_{вых}}{\\eta_{общ}}', s: `\\dfrac{${nx(P.Pout)}}{${n(eta, 4)}}`, v: Preq, u: 'кВт', d: 'Требуемая мощность электродвигателя.' });
    rep.h('1.2.2', 'Выбор электродвигателя из каталога', 3);
    const mo = TC.motorSection(rep, P, Preq, P.nout); R.motor = mo;
    rep.h('1.2.3', 'Определение общего передаточного отношения и его разбивка по ступеням', 3);
    const uo = mo.n / P.nout;
    rep.eq({ lhs: 'u_{общ}', f: '\\dfrac{n_{эд}}{n_{вых}}', s: `\\dfrac{${mo.n}}{${nx(P.nout)}}`, v: uo, d: 'Общее передаточное отношение привода.' });
    rep.p(`Назначаем передаточное отношение цепной передачи из рекомендуемого интервала 1,5…3,5: <i>u</i><sub>цеп</sub> = ${fnum(O.uChain, 0)} [[met|п. 1.2.3]].`);
    const ured = uo / O.uChain;
    rep.eq({ lhs: 'u_{ред}', f: '\\dfrac{u_{общ}}{u_{цеп}}', s: `\\dfrac{${n(uo)}}{${nx(O.uChain)}}`, v: ured, d: 'Передаточное отношение редуктора.' });
    const utr = 0.63 * Math.pow(ured, 2 / 3), ut = O.ut || near(utr, D.STD.u1);
    rep.eq({ lhs: 'u_{т}', f: '0{,}63\\cdot u_{ред}^{2/3}', s: `0{,}63\\cdot ${n(ured)}^{2/3}`, v: utr, raw: `${n(utr)}\\ \\Rightarrow\\ ${nx(ut)}`, d: 'Передаточное число тихоходной ступени, округляется до стандартного по ГОСТ 2185-66.' });
    const ubr = ured / ut, ub = O.ub || near(ubr, D.STD.u1);
    rep.eq({ lhs: 'u_{б}', f: '\\dfrac{u_{ред}}{u_{т}}', s: `\\dfrac{${n(ured)}}{${nx(ut)}}`, v: ubr, raw: `${n(ubr)}\\ \\Rightarrow\\ ${nx(ub)}`, d: 'Передаточное число быстроходной ступени, округляется до стандартного.' });
    const uc = uo / (ub * ut);
    rep.eq({ lhs: "u_{цеп}'", f: '\\dfrac{u_{общ}}{u_{б}\\cdot u_{т}}', s: `\\dfrac{${n(uo)}}{${nx(ub)}\\cdot ${nx(ut)}}`, v: uc, d: 'Уточнённое передаточное отношение цепной передачи.' });
    rep.check(`1{,}5\\le u_{цеп}'=${n(uc)}\\le 3{,}5`, uc >= 1.5 && uc <= 3.5, uc >= 1.5 && uc <= 3.5 ? 'Значение в рекомендуемом интервале.' : 'Значение вне рекомендуемого интервала.');
    rep.h('1.2.4', 'Расчёт частот вращения и крутящих моментов на валах', 3);
    const nI = mo.n, nII = nI / ub, nIII = nII / ut, nIV = nIII / uc;
    const PI_ = Preq * O.etaM * O.etaB, PII = PI_ * O.etaCyl * O.etaB, PIII = PII * O.etaCyl * O.etaB, PIV = PIII * O.etaCh * O.etaB;
    const Tq = (p, nn) => 9550 * p / nn;
    const K = { nI, nII, nIII, nIV, PI: PI_, PII, PIII, PIV, TI: Tq(PI_, nI), TII: Tq(PII, nII), TIII: Tq(PIII, nIII), TIV: Tq(PIV, nIV) };
    ['I', 'II', 'III', 'IV'].forEach(k => { K['w' + k] = PI * K['n' + k] / 30; });
    rep.eq({ lhs: 'n_{I}', f: 'n_{эд}', v: nI, u: 'мин⁻¹', d: 'Частоты вращения валов.' });
    rep.eq({ lhs: 'n_{II}', f: '\\dfrac{n_{I}}{u_{б}}', s: `\\dfrac{${n(nI)}}{${nx(ub)}}`, v: nII, u: 'мин⁻¹' });
    rep.eq({ lhs: 'n_{III}', f: '\\dfrac{n_{II}}{u_{т}}', s: `\\dfrac{${n(nII)}}{${nx(ut)}}`, v: nIII, u: 'мин⁻¹' });
    rep.eq({ lhs: 'n_{IV}', f: "\\dfrac{n_{III}}{u_{цеп}'}", s: `\\dfrac{${n(nIII)}}{${n(uc)}}`, v: nIV, u: 'мин⁻¹' });
    rep.eq({ lhs: 'P_{I}', f: 'P_{расч}\\cdot \\eta_{м}\\cdot \\eta_{подш}', s: `${n(Preq)}\\cdot ${nx(O.etaM)}\\cdot ${nx(O.etaB)}`, v: PI_, u: 'кВт', d: 'Мощности на валах.' });
    rep.eq({ lhs: 'P_{II}', f: 'P_{I}\\cdot \\eta_{ц.б}\\cdot \\eta_{подш}', s: `${n(PI_)}\\cdot ${nx(O.etaCyl)}\\cdot ${nx(O.etaB)}`, v: PII, u: 'кВт' });
    rep.eq({ lhs: 'P_{III}', f: 'P_{II}\\cdot \\eta_{ц.т}\\cdot \\eta_{подш}', s: `${n(PII)}\\cdot ${nx(O.etaCyl)}\\cdot ${nx(O.etaB)}`, v: PIII, u: 'кВт' });
    rep.eq({ lhs: 'P_{IV}', f: 'P_{III}\\cdot \\eta_{цеп}\\cdot \\eta_{подш}', s: `${n(PIII)}\\cdot ${nx(O.etaCh)}\\cdot ${nx(O.etaB)}`, v: PIV, u: 'кВт' });
    for (const k of ['I', 'II', 'III', 'IV']) rep.eq({ lhs: `T_{${k}}`, f: `9550\\cdot \\dfrac{P_{${k}}}{n_{${k}}}`, s: `9550\\cdot \\dfrac{${n(K['P' + k])}}{${n(K['n' + k])}}`, v: K['T' + k], u: 'Н·м', d: k === 'I' ? 'Крутящие моменты на валах.' : undefined });
    TC.shaftsTable(rep, [{ name: 'I (быстроходный)', n: nI, w: K.wI, P: PI_, T: K.TI }, { name: 'II (промежуточный)', n: nII, w: K.wII, P: PII, T: K.TII }, { name: 'III (тихоходный)', n: nIII, w: K.wIII, P: PIII, T: K.TIII }, { name: 'IV (вал барабана)', n: nIV, w: K.wIV, P: PIV, T: K.TIV }]);
    Object.assign(R, { K, uo, ub, ut, uc, eta, Preq });
    // 1.3
    rep = sec('s13', 'mat', 'Материалы и допускаемые напряжения');
    rep.h('1.3', 'Выбор марок материалов и назначение химико-термической обработки зубьев, определение допускаемых напряжений');
    rep.p('Зуб шестерни вступает в зацепление в <i>u</i> раз чаще зуба колеса, поэтому шестерню изготавливают из более прочного материала или назначают более твёрдую термообработку [[met|п. 1.3]].');
    rep.h('1.3.1', 'Суммарное время работы редуктора', 3);
    rep.p(`Суммарная наработка определена в п. 1.1: <i>t</i><sub>ч</sub> = <i>t</i><sub>Σ</sub> = ${fnum(tS)} ч.`);
    rep.h('1.3.2', 'Первая ступень (быстроходная цилиндрическая)', 3);
    const a1 = G.allowGear(rep, { title: 'Шестерня z1', mat: 'Ст45ТВЧ', n: nI, nsym: 'n_{I}', tch: tS, label: '1' });
    const a2 = G.allowGear(rep, { title: 'Колесо z2', mat: 'Ст40ул', n: nII, nsym: 'n_{II}', tch: tS, label: '2' });
    rep.h('1.3.3', 'Вторая ступень (тихоходная цилиндрическая)', 3);
    const a3 = G.allowGear(rep, { title: 'Шестерня z3', mat: 'Ст45ул', n: nII, nsym: 'n_{II}', tch: tS, label: '3' });
    const a4 = G.allowGear(rep, { title: 'Колесо z4', mat: 'Ст40норм', n: nIII, nsym: 'n_{III}', tch: tS, label: '4' });
    const sHb = Math.min(a1.sH, a2.sH), sHt = Math.min(a3.sH, a4.sH);
    rep.p(`За допускаемое контактное напряжение ступени принимается меньшее из значений для шестерни и колеса: для быстроходной ступени σ<sub>H.б</sub> = ${fnum(sHb)} МПа, для тихоходной σ<sub>H.т</sub> = ${fnum(sHt)} МПа.`);
    // 1.4
    rep = sec('s14', 'gear', 'Проектный расчёт ступеней редуктора');
    rep.h('1.4', 'Проектный и геометрический расчёт передач редуктора, определение сил в зацеплении');
    rep.h('1.4.1', 'Первая ступень (быстроходная цилиндрическая)', 3);
    rep.p(`Межосевое расстояние определяется по моменту на шестерне ступени (<i>T</i><sub>I</sub>): эта запись равносильна формуле [[ch|формула (3.7)]] с моментом на колесе и квадратом передаточного числа, так как <i>T</i><sub>II</sub>/<i>u</i><sub>б</sub><sup>2</sup> ≈ <i>T</i><sub>I</sub>/<i>u</i><sub>б</sub>.`);
    const oB = { st: { p: '1', w: '2' }, T: K.TI, Tsym: 'T_{I}', Tw: K.TII, Twsym: 'T_{II}', n1: nI, n1sym: 'n_{I}', u: ub, usym: 'u_{б}', sH: sHb, sHsym: '\\sigma_{H.б}', psiba: O.psibaB, col: 'II', colF: 'II', hard: false, sF1: a1.sF, sF2: a2.sF, label: '.б', title: 'быстроходной ступени' };
    const gB = G.cylStage(rep, oB, O);
    rep.h('1.4.2', 'Вторая ступень (тихоходная цилиндрическая)', 3);
    const oT = { st: { p: '3', w: '4' }, T: K.TII, Tsym: 'T_{II}', Tw: K.TIII, Twsym: 'T_{III}', n1: nII, n1sym: 'n_{II}', u: ut, usym: 'u_{т}', sH: sHt, sHsym: '\\sigma_{H.т}', psiba: O.psibaT, col: 'II', colF: 'II', hard: false, sF1: a3.sF, sF2: a4.sF, label: '.т', title: 'тихоходной ступени' };
    const gT = G.cylStage(rep, oT, O);
    rep.h('1.4.3', 'Проверка фактических передаточных чисел и частот вращения', 3);
    const nIIf = nI / gB.uf, nIIIf = nIIf / gT.uf;
    rep.eq({ lhs: "n_{II}'", f: '\\dfrac{n_{I}}{u_{б.факт}}', s: `\\dfrac{${n(nI)}}{${n(gB.uf)}}`, v: nIIf, u: 'мин⁻¹' });
    rep.eq({ lhs: "n_{III}'", f: '\\dfrac{n_{II}}{u_{т.факт}}', s: `\\dfrac{${n(nIIf)}}{${n(gT.uf)}}`, v: nIIIf, u: 'мин⁻¹' });
    const dnn = Math.abs(nIIIf - nIII) / nIII * 100;
    rep.check(`\\Delta n_{III}=${n(dnn, 2)}\\%\\ \\le\\ 4\\%`, dnn <= 4, 'Расхождение с п. 1.2.4 допустимо.');
    rep.h('1.4.4', 'Определение сил, действующих в зацеплениях', 3);
    const fB = G.cylForces(rep, gB, oB), fT = G.cylForces(rep, gT, oT);
    Object.assign(R, { gB, gT, fB, fT, a1, a2, a3, a4 });
    // 1.5
    rep = sec('s15', 'gear', 'Проверочный расчёт зубчатых передач');
    rep.h('1.5', 'Проверочный расчёт передач редуктора на контактную и изгибную выносливость');
    rep.h('1.5.1', 'Первая ступень (быстроходная цилиндрическая)', 3);
    const cB = G.cylCheck(rep, gB, oB, fB);
    rep.h('1.5.2', 'Вторая ступень (тихоходная цилиндрическая)', 3);
    const cT = G.cylCheck(rep, gT, oT, fT);
    Object.assign(R, { cB, cT });
    // 1.6 цепь
    rep = sec('s16', 'gear', 'Открытая цепная передача');
    rep.h('1.6', 'Расчёт открытой цепной передачи');
    rep.h('1.6.1', 'Выбор типа цепи и определение числа зубьев звёздочек', 3);
    rep.p(`Для привода ленточного конвейера принимается приводная роликовая однорядная цепь типа ПР по ГОСТ 13568-75; ведущая звёздочка устанавливается на тихоходном валу редуктора (вал III). Коэффициенты эксплуатации [[ch|с. 130]]: <i>K</i><sub>д</sub> = ${fnum(O.Kd, 0)}, <i>K</i><sub>а</sub> = ${fnum(O.Ka, 0)}, <i>K</i><sub>нак</sub> = ${fnum(O.Kn, 0)} (наклон линии центров ${O.chainAngle}°), <i>K</i><sub>рег</sub> = ${fnum(O.Kreg, 0)}, <i>K</i><sub>смаз</sub> = ${fnum(O.Ksm, 0)}, <i>K</i><sub>см</sub> = ${fnum(TC.shiftsK(P.Kc), 0)}.`);
    const chn = M.chainCalc(rep, { T: K.TIII, n1: nIIIf, u: uc, Tsym: 'T_{III}', Kd: O.Kd, Ka: O.Ka, Kn: O.Kn, Kreg: O.Kreg, Ksm: O.Ksm, Kp: TC.shiftsK(P.Kc), aRatio: O.aRatio, angle: O.chainAngle, Kv1: O.Kv1, Kv2: O.Kv2 });
    R.chn = chn;
    const nOut = mo.n / (gB.uf * gT.uf * chn.uf); R.nOut = nOut;
    rep.eq({ lhs: 'n_{вых.факт}', f: '\\dfrac{n_{эд}}{u_{б.факт}\\cdot u_{т.факт}\\cdot u_{цеп.факт}}', s: `\\dfrac{${mo.n}}{${n(gB.uf)}\\cdot ${n(gT.uf)}\\cdot ${n(chn.uf)}}`, v: nOut, u: 'мин⁻¹', d: 'Фактическая частота вращения вала барабана.' });
    const dn = Math.abs(P.nout - nOut) / P.nout * 100;
    rep.check(`\\Delta n=${n(dn, 2)}\\%\\ \\le\\ 5\\%`, dn <= 5, '');
    // 1.7 валы предварительно
    rep = sec('s17', 'shaft', 'Ориентировочный расчёт валов, размеры колёс');
    rep.h('1.7', 'Ориентировочный расчёт валов и конструктивные размеры зубчатых колёс');
    rep.h('1.7.1', 'Быстроходный вал (вал-шестерня)', 3);
    rep.p(`Материал валов — сталь 45 по ГОСТ 1050-2013. Допускаемые напряжения при чистом кручении [[met|п. 1.7]]: быстроходный вал [τ] = ${O.tauI} МПа, промежуточный — ${O.tauII} МПа, тихоходный — ${O.tauIII} МПа.`);
    const dv1r = dTors(rep, 'd_{в1}', K.TI, 'T_{I}', O.tauI);
    let dv1 = Math.max(M.shaftStd(dv1r), M.shaftStd(0.8 * mo.d1));
    const Tc = O.Kcoup * K.TI;
    const cp0 = M.couplingPick(Tc, mo.d1, dv1, nI);
    if (!cp0.exact) dv1 = cp0.bore2;
    for (let i = 0; i < (A.dv1Up || 0); i++) dv1 = M.shaftStd(dv1 + 0.5);
    rep.p(`Диаметр округляем до стандартного и согласуем с диаметром вала электродвигателя <i>d</i><sub>эд</sub> = ${mo.d1} мм и посадочными отверстиями муфты (раздел 2): <i>d</i><sub>в1</sub> = ${dv1} мм.`);
    const s1 = sealStep(dv1); let dp1 = M.std5(s1.d + 1); dp1 += 5 * (A.dp1Up || 0);
    rep.p(`Ступени вала: под уплотнение <i>d</i><sub>упл1</sub> = ${s1.d} мм (манжета ${s1.d}×${s1.D}×${s1.h} по ГОСТ 8752-79), под подшипники <i>d</i><sub>подш1</sub> = ${dp1} мм. ${gB.d1 < 2 * dp1 ? `Так как <i>d</i><sub>1</sub> = ${fnum(gB.d1)} мм &lt; 2<i>d</i><sub>подш1</sub>, шестерня выполняется за одно целое с валом (вал-шестерня).` : 'Шестерня выполняется насадной.'}`);
    rep.h('1.7.2', 'Промежуточный вал', 3);
    const dII = dTors(rep, 'd_{подш2}', K.TII, 'T_{II}', O.tauII);
    let dp2 = Math.max(M.std5(dII), 20) + 5 * (A.dp2Up || 0);
    const dpos2 = M.shaftStd(dp2 + 3), dbur2 = M.shaftStd(dpos2 + 5);
    rep.p(`Принимаем <i>d</i><sub>подш2</sub> = ${dp2} мм (кратно 5 мм), под ступицу колеса z2 <i>d</i><sub>посад2</sub> = <i>d</i><sub>подш2</sub> + (3…5) = ${dpos2} мм, опорный бурт <i>d</i><sub>бурт2</sub> = ${dbur2} мм. Шестерня z3 выполняется за одно целое с валом (вал-шестерня).`);
    rep.p(`<b>Колесо быстроходной ступени z2</b> (<i>d</i><sub>2</sub> = ${fnum(gB.d2)} мм, <i>b</i><sub>2</sub> = ${gB.b2} мм):`);
    const w2 = wheelDims(rep, { dpos: dpos2, b: gB.b2, m: gB.m, idx: '2', lstMin: A.lst2 });
    rep.h('1.7.3', 'Тихоходный вал', 3);
    const dv3r = dTors(rep, 'd_{в3}', K.TIII, 'T_{III}', O.tauIII);
    let dv3 = M.shaftStd(dv3r); for (let i = 0; i < (A.dv3Up || 0); i++) dv3 = M.shaftStd(dv3 + 0.5);
    const s3 = sealStep(dv3); let dp3 = M.std5(s3.d + 1) + 5 * (A.dp3Up || 0);
    const dpos3 = M.shaftStd(dp3 + 3), dbur3 = M.shaftStd(dpos3 + 6);
    rep.p(`Принимаем <i>d</i><sub>в3</sub> = ${dv3} мм (согласуется с отверстием ведущей звёздочки), под уплотнение <i>d</i><sub>упл3</sub> = ${s3.d} мм (манжета ${s3.d}×${s3.D}×${s3.h}), под подшипники <i>d</i><sub>подш3</sub> = ${dp3} мм, под ступицу колеса z4 <i>d</i><sub>посад3</sub> = ${dpos3} мм, опорный бурт <i>d</i><sub>бурт3</sub> = ${dbur3} мм.`);
    rep.p(`<b>Колесо тихоходной ступени z4</b> (<i>d</i><sub>4</sub> = ${fnum(gT.d2)} мм, <i>b</i><sub>4</sub> = ${gT.b2} мм):`);
    const w4 = wheelDims(rep, { dpos: dpos3, b: gT.b2, m: gT.m, idx: '4', lstMin: A.lst4 });
    // 1.8 корпус
    rep = sec('s18', 'shaft', 'Корпус и эскизная компоновка');
    rep.h('1.8', 'Конструктивные размеры элементов корпуса и компоновка редуктора');
    rep.h('1.8.1', 'Определение конструктивных размеров элементов корпуса редуктора', 3);
    rep.p('Корпус и крышка редуктора — литые из серого чугуна СЧ15; размеры элементов определяются по межосевому расстоянию тихоходной ступени [[met|п. 1.8.1]].');
    const H = M.housing(rep, { aw: gT.aw, awSym: 'a_{w.т}' });
    rep.h('1.8.2', 'Вспомогательные конструктивные элементы корпуса', 3);
    rep.list([`резьба сливной пробки М${H.dpr}×1,5 (ГОСТ 19421-74)`, `винты крышки смотрового люка М${H.d4 || 6}`, 'маслоуказатель жезловый на боковой стенке корпуса', 'пробка-отдушина в крышке смотрового люка', 'два конических штифта по ГОСТ 3129-70 для фиксации крышки относительно корпуса']);
    rep.h('1.8.3', 'Выбор типа подшипников и эскизная компоновка редуктора', 3);
    const b1 = pickBearing('ball', dp1, A.b1), b2 = pickBearing('ball', dp2, A.b2), b3 = pickBearing('ball', dp3, A.b3);
    rep.p(`Передачи прямозубые, осевые силы отсутствуют, поэтому опоры всех валов — радиальные шарикоподшипники ${[b1, b2, b3].every(b => /^2/.test(b.id)) ? 'лёгкой серии' : 'лёгкой и средней серий (средняя — где не хватает грузоподъёмности лёгкой)'} по ГОСТ 8338-75 [[met|п. 1.8.3]], [[ch|прил. П3]]: вал I — ${b1.id} (${b1.d}×${b1.D}×${b1.B}), вал II — ${b2.id} (${b2.d}×${b2.D}×${b2.B}), вал III — ${b3.id} (${b3.d}×${b3.D}×${b3.B}).`);
    // компоновка (развёрнутая схема): от внутренней стенки x = 0
    const y = H.gap;
    const xf = y + w2.lst / 2;                               // середина быстроходной пары
    const xs = y + w2.lst + y + Math.max(gT.b1, w4.lst) / 2; // середина тихоходной пары
    const W = xs + Math.max(gT.b1, w4.lst) / 2 + y;          // расстояние между внутренними стенками
    const lI = W + b1.B, lII = W + b2.B, lIII = W + b3.B;
    const lcp = M.couplingPick(Tc, mo.d1, dv1, nI).c.l1 || Math.round(1.5 * dv1);
    const lv3 = Math.max(Math.round(1.2 * dv3), A.lv3 || 0);
    const c1 = b1.B / 2 + H.del + s1.h + 10 + lcp / 2, ak3 = b3.B / 2 + H.del + s3.h + 10 + lv3 / 2;
    const L = { y, W, lI, lII, lIII, a1: b1.B / 2 + xf, a2: b2.B / 2 + xf, b2: xs - xf, c2: lII - (b2.B / 2 + xs), a3: b3.B / 2 + xs, c1, ak3, lcp, lv3 };
    rep.p(`Компоновка выполняется по развёрнутой схеме (рисунок {fig:layout}): оси валов располагаются на расстояниях <i>a</i><sub>w.б</sub> = ${fnum(gB.aw)} мм и <i>a</i><sub>w.т</sub> = ${fnum(gT.aw)} мм; зазор между вращающимися деталями и стенками корпуса <i>c</i> = ${y} мм, между вершинами зубьев колеса и дном корпуса Δ = ${H.gapBot} мм. Быстроходная пара располагается у одной стенки корпуса, тихоходная — у противоположной; расстояние между внутренними стенками ${fnum(W)} мм. Для радиальных шарикоподшипников точка приложения реакции совпадает с серединой подшипника.`);
    rep.fig('layout', 'Эскизная компоновка двухступенчатого цилиндрического редуктора', null, { kind: 'layout' });
    rep.table('Расстояния, снятые с эскизной компоновки, мм', ['Обозначение', 'Описание', 'Значение'], [
      ['l₁', 'пролёт между серединами подшипников вала I', fnum(lI)], ['a₁', 'от опоры A вала I до середины шестерни z1', fnum(L.a1)], ['c₁', 'от опоры B вала I до середины полумуфты', fnum(c1)],
      ['l₂', 'пролёт вала II', fnum(lII)], ['a₂', 'от опоры A до середины колеса z2', fnum(L.a2)], ['b₂', 'между серединами колеса z2 и шестерни z3', fnum(L.b2)], ['c₂', 'от шестерни z3 до опоры D', fnum(L.c2)],
      ['l₃', 'пролёт вала III', fnum(lIII)], ['a₃', 'от опоры A до середины колеса z4', fnum(L.a3)], ['a_k3', 'от опоры B вала III до середины ступицы звёздочки', fnum(ak3)]]);
    Object.assign(R, { H, L, b1, b2, b3, w2, w4 });
    // 1.9 окончательные размеры валов
    rep = sec('s19', 'shaft', 'Конструктивные размеры валов и подшипниковых узлов');
    rep.h('1.9', 'Конструктивные размеры валов и подшипниковых узлов');
    rep.h('1.9.1', 'Определение конструктивных размеров ступеней валов', 3);
    rep.table('Диаметры и длины ступеней валов, мм', ['Ступень', 'Вал I', 'Вал II', 'Вал III'], [
      ['Выходной конец dв × lв', `${dv1} × ${lcp}`, '—', `${dv3} × ${lv3}`], ['Под уплотнение dупл', s1.d, '—', s3.d], ['Под подшипники dподш', dp1, dp2, dp3],
      ['Под ступицу колеса dпосад × lст', '—', `${dpos2} × ${w2.lst}`, `${dpos3} × ${w4.lst}`], ['Опорный бурт dбурт', '—', dbur2, dbur3], ['Шестерня (за одно целое с валом)', `d₁ = ${fnum(gB.d1)}, b₁ = ${gB.b1}`, `d₃ = ${fnum(gT.d1)}, b₃ = ${gT.b1}`, '—']]);
    rep.h('1.9.2', 'Конструирование подшипниковых узлов и крышек', 3);
    rep.p(`Быстроходный и тихоходный валы устанавливаются по схеме «враспор» с регулировкой осевого зазора набором прокладок под крышками; промежуточный вал — с одной фиксирующей опорой. Для выходных концов валов I и III применяются проходные крышки с резиновыми армированными манжетами по ГОСТ 8752-79 (окружная скорость под манжетой вала I ${fnum(PI * s1.d * nI / 60000)} м/с ${PI * s1.d * nI / 60000 <= 5 ? '≤ 5 м/с — манжеты без пыльника' : '> 5 м/с — манжеты с пыльником'}), для остальных торцов — глухие крышки. Толщина фланца крышки <i>K</i> ≈ δ = ${H.del} мм [[met|п. 1.9.2]].`);
    rep.h('1.9.3', 'Вторая эскизная компоновка и определение опорных расстояний', 3);
    rep.p('Окончательные опорные расстояния, принятые для расчёта валов, приведены в таблице раздела 1.8.3; они соответствуют второй эскизной компоновке редуктора.');
    R.dims = { dv1, s1, dp1, dp2, dpos2, dbur2, dv3, s3, dp3, dpos3, dbur3, lcp, lv3 };
    // 1.10 проверка валов
    rep = sec('s110', 'check', 'Проверка прочности валов');
    rep.h('1.10', 'Проверка прочности валов');
    const Fm = O.FmMode === 'met' && O.D0 > 0 ? O.FmK * 2 * Tc * 1e3 / O.D0 : TC.FmGost(K.TI, false); R.Fm = Fm;
    const sb = M.steelSb('45', 90).sb;
    rep.h('1.10.1', 'Быстроходный вал (вал-шестерня)', 3);
    if (O.FmMode === 'met' && O.D0 > 0) rep.eq({ lhs: 'F_{м}', f: `${nx(O.FmK)}\\cdot \\dfrac{2\\cdot T_{расч}\\cdot 10^{3}}{D_{0}}`, s: `${nx(O.FmK)}\\cdot \\dfrac{2\\cdot ${n(Tc)}\\cdot 10^{3}}{${nx(O.D0)}}`, v: Fm, u: 'Н', d: 'Консольная сила от муфты.' });
    else rep.eq({ lhs: 'F_{м}', f: K.TI <= 25 ? '50\\sqrt{T_{I}}' : '80\\sqrt{T_{I}}', s: `${K.TI <= 25 ? 50 : 80}\\sqrt{${n(K.TI)}}`, v: Fm, u: 'Н', d: 'Консольная сила от муфты по ГОСТ 16162 ([Ч], с. 141); направление принимается наиболее неблагоприятным.', ref: ['ch', 'с. 141'] });
    const sh1 = shaftBlock(rep, { l: lI, lsym: 'l_{1}', T: K.TI, sb, O, fig: 'shaft1', figTitle: 'Расчётная схема и эпюры моментов быстроходного вала',
      intro: `Вал рассматривается как двухопорная балка (пролёт <i>l</i><sub>1</sub> = ${fnum(lI)} мм) с шестернёй z1 на расстоянии <i>a</i><sub>1</sub> = ${fnum(L.a1)} мм от опоры A и консольной силой от муфты на расстоянии <i>c</i><sub>1</sub> = ${fnum(c1)} мм за опорой B. Нагрузки: <i>F</i><sub>t1</sub> = ${fnum(fB.Ft)} Н, <i>F</i><sub>r1</sub> = ${fnum(fB.Fr)} Н, <i>F</i><sub>м</sub> = ${fnum(Fm)} Н.`,
      loads: [{ id: 'C', x: L.a1, Fx: -fB.Ft, Fy: -fB.Fr }, { id: 'D', x: lI + c1, Fx: -Fm }],
      terms: [{ pl: 'x', F: 'F_{t1}', Fm: fB.Ft, x: L.a1, a: 'a_{1}', b: '(l_{1}-a_{1})' }, { pl: 'x', F: 'F_{м}', Fm: Fm, x: lI + c1, a: '(l_{1}+c_{1})', b: 'c_{1}' }, { pl: 'y', F: 'F_{r1}', Fm: fB.Fr, x: L.a1, a: 'a_{1}', b: '(l_{1}-a_{1})' }],
      secs: [{ id: 'C', x: L.a1, title: 'Сечение C — под шестернёй z1 (впадины зубьев)', d: gB.df1, T: K.TI, Tsym: 'T_{I}', kind: 'press' }, { id: 'B', x: lI, title: 'Сечение B — шейка под подшипник со стороны муфты', d: dp1, T: K.TI, Tsym: 'T_{I}', kind: 'press' }] });
    rep.h('1.10.2', 'Промежуточный вал', 3);
    const sh2 = shaftBlock(rep, { l: lII, lsym: 'l_{2}', T: K.TII, sb, O, fig: 'shaft2', figTitle: 'Расчётная схема и эпюры моментов промежуточного вала',
      intro: `Расчётные расстояния: <i>a</i><sub>2</sub> = ${fnum(L.a2)} мм, <i>b</i><sub>2</sub> = ${fnum(L.b2)} мм, <i>c</i><sub>2</sub> = ${fnum(L.c2)} мм, <i>l</i><sub>2</sub> = ${fnum(lII)} мм. Окружные силы колеса z2 и шестерни z3 направлены в одну сторону, радиальные — в противоположные (колёса находятся по разные стороны от оси вала II в развёрнутой схеме): <i>F</i><sub>t2</sub> = ${fnum(fB.Ft)} Н, <i>F</i><sub>r2</sub> = ${fnum(fB.Fr)} Н, <i>F</i><sub>t3</sub> = ${fnum(fT.Ft)} Н, <i>F</i><sub>r3</sub> = ${fnum(fT.Fr)} Н.`,
      loads: [{ id: 'B', x: L.a2, Fx: -fB.Ft, Fy: fB.Fr }, { id: 'C', x: L.a2 + L.b2, Fx: -fT.Ft, Fy: -fT.Fr }],
      terms: [{ pl: 'x', F: 'F_{t2}', Fm: fB.Ft, x: L.a2, a: 'a_{2}', b: '(b_{2}+c_{2})' }, { pl: 'x', F: 'F_{t3}', Fm: fT.Ft, x: L.a2 + L.b2, a: '(a_{2}+b_{2})', b: 'c_{2}' },
        { pl: 'y', F: 'F_{r2}', Fm: fB.Fr, dir: -1, x: L.a2, a: 'a_{2}', b: '(b_{2}+c_{2})' }, { pl: 'y', F: 'F_{r3}', Fm: fT.Fr, x: L.a2 + L.b2, a: '(a_{2}+b_{2})', b: 'c_{2}' }],
      secs: [{ id: 'B', x: L.a2, title: 'Сечение B — под ступицей колеса z2 (шпоночный паз)', d: dpos2, T: K.TII, Tsym: 'T_{II}', kind: 'key', key: M.key(dpos2) }, { id: 'C', x: L.a2 + L.b2, title: 'Сечение C — под шестернёй z3 (впадины зубьев)', d: gT.df1, T: K.TII, Tsym: 'T_{II}', kind: 'press' }] });
    rep.h('1.10.3', 'Тихоходный вал', 3);
    const ang = O.chainAngle * D2R, cz = x => Math.abs(x) < 1e-9 ? 0 : x, Fcx = chn.Fc * cz(Math.cos(ang)), Fcy = chn.Fc * cz(Math.sin(ang));
    const sh3 = shaftBlock(rep, { l: lIII, lsym: 'l_{3}', T: K.TIII, sb: M.steelSb('45', dbur3).sb, O, fig: 'shaft3', figTitle: 'Расчётная схема и эпюры моментов тихоходного вала',
      intro: `Вал — двухопорная балка с консолью: колесо z4 на расстоянии <i>a</i><sub>3</sub> = ${fnum(L.a3)} мм от опоры A, пролёт <i>l</i><sub>3</sub> = ${fnum(lIII)} мм, ведущая звёздочка на консоли <i>a</i><sub>k3</sub> = ${fnum(ak3)} мм. Сила от цепной передачи <i>F</i><sub>цеп</sub> = ${fnum(chn.Fc)} Н направлена по линии центров звёздочек под углом α<sub>цеп</sub> = ${O.chainAngle}° к горизонту: <i>F</i><sub>цеп.x</sub> = <i>F</i><sub>цеп</sub>·cos α<sub>цеп</sub> = ${fnum(Fcx)} Н, <i>F</i><sub>цеп.y</sub> = <i>F</i><sub>цеп</sub>·sin α<sub>цеп</sub> = ${fnum(Fcy)} Н.`,
      loads: [{ id: 'C', x: L.a3, Fx: -fT.Ft, Fy: -fT.Fr }, { id: 'D', x: lIII + ak3, Fx: -Fcx, Fy: -Fcy }],
      terms: [{ pl: 'x', F: 'F_{t4}', Fm: fT.Ft, x: L.a3, a: 'a_{3}', b: '(l_{3}-a_{3})' }, { pl: 'x', F: 'F_{цеп.x}', Fm: Fcx, x: lIII + ak3, a: '(l_{3}+a_{k3})', b: 'a_{k3}' },
        { pl: 'y', F: 'F_{r4}', Fm: fT.Fr, x: L.a3, a: 'a_{3}', b: '(l_{3}-a_{3})' }, { pl: 'y', F: 'F_{цеп.y}', Fm: Fcy, x: lIII + ak3, a: '(l_{3}+a_{k3})', b: 'a_{k3}' }],
      secs: [{ id: 'C', x: L.a3, title: 'Сечение C — под ступицей колеса z4 (шпоночный паз)', d: dpos3, T: K.TIII, Tsym: 'T_{III}', kind: 'key', key: M.key(dpos3) }, { id: 'B', x: lIII, title: 'Сечение B — шейка под подшипник со стороны звёздочки', d: dp3, T: K.TIII, Tsym: 'T_{III}', kind: 'press' }] });
    Object.assign(R, { B1: sh1.B, B2: sh2.B, B3: sh3.B, ch1: sh1.ch, ch2: sh2.ch, ch3: sh3.ch });
    R.beams = { shaft1: { B: sh1.B, names: { C: 'шестерня z1', D: 'полумуфта' }, T: K.TI, Tx: [L.a1, lI + c1] }, shaft2: { B: sh2.B, names: { B: 'колесо z2', C: 'шестерня z3' }, T: K.TII, Tx: [L.a2, L.a2 + L.b2] }, shaft3: { B: sh3.B, names: { C: 'колесо z4', D: 'звёздочка' }, T: K.TIII, Tx: [L.a3, lIII + ak3] } };
    // 1.11 шпонки
    rep = sec('s111', 'check', 'Шпоночные соединения');
    rep.h('1.11', 'Подбор шпонок и проверочный расчёт шпоночных соединений');
    rep.h('1.11.1', 'Порядок подбора и расчёта призматических шпонок', 3);
    rep.p(`Призматические шпонки по ГОСТ 23360-78; длина шпонки на 5…10 мм меньше длины ступицы. Допускаемые напряжения смятия [[met|п. 1.11.1]]: для стальных ступиц [σ]<sub>см</sub> = ${O.sCmSteel} МПа, для чугунной ступицы полумуфты [σ]<sub>см</sub> = ${O.sCmCI} МПа.`);
    rep.h('1.11.2', 'Расчёт шпоночных соединений валов редуктора', 3);
    const keys = [];
    keys.push(M.keyCheck(rep, { title: 'Быстроходный вал — полумуфта', d: dv1, lHub: lcp, T: K.TI, Tsym: 'T_{I}', sig: O.sCmCI, exact: O.keyExact, joint: 'coupling1', two: A.two.coupling1 }));
    keys.push(M.keyCheck(rep, { title: 'Промежуточный вал — колесо z2', d: dpos2, lHub: w2.lst, T: K.TII, Tsym: 'T_{II}', sig: O.sCmSteel, exact: O.keyExact, joint: 'wheel2', two: A.two.wheel2 }));
    keys.push(M.keyCheck(rep, { title: 'Тихоходный вал — колесо z4', d: dpos3, lHub: w4.lst, T: K.TIII, Tsym: 'T_{III}', sig: O.sCmSteel, exact: O.keyExact, joint: 'wheel4', two: A.two.wheel4 }));
    keys.push(M.keyCheck(rep, { title: 'Тихоходный вал — ведущая звёздочка', d: dv3, lHub: lv3, T: K.TIII, Tsym: 'T_{III}', sig: O.sCmSteel, exact: O.keyExact, joint: 'sprocket', two: A.two.sprocket }));
    R.keys = keys;
    {
      const sl1 = H.del + s1.h + 10, sl3 = H.del + s3.h + 10, dB1 = Math.min(M.shaftStd(dp1 + 5), Math.floor(gB.df1)), dB2 = dbur2;
      R.shafts = {
        I: [{ d: dp1, l: b1.B, name: 'подшипник A' }, { d: dB1, l: xf - gB.b1 / 2, name: 'участок вала' }, { d: gB.da1, l: gB.b1, name: 'шестерня z1', gear: { kind: 'spur', da: gB.da1, df: gB.df1, d: gB.d1, m: gB.m, z: gB.z1 } },
          { d: dB1, l: W - xf - gB.b1 / 2, name: 'участок вала' }, { d: dp1, l: b1.B, name: 'подшипник B' }, { d: s1.d, l: sl1, name: 'под манжету' }, { d: dv1, l: lcp, name: 'выходной конец (муфта)', key: 'coupling1' }],
        II: [{ d: dp2, l: b2.B + xf - w2.lst / 2, name: 'подшипник A + втулка' }, { d: dpos2, l: w2.lst, name: 'под ступицу колеса z2', key: 'wheel2' }, { d: dB2, l: Math.max(5, xs - gT.b1 / 2 - xf - w2.lst / 2), name: 'бурт' },
          { d: gT.da1, l: gT.b1, name: 'шестерня z3', gear: { kind: 'spur', da: gT.da1, df: gT.df1, d: gT.d1, m: gT.m, z: gT.z1 } }, { d: dp2, l: W - xs - gT.b1 / 2 + b2.B, name: 'втулка + подшипник D' }],
        III: [{ d: dp3, l: b3.B, name: 'подшипник A' }, { d: dbur3, l: Math.max(5, xs - w4.lst / 2), name: 'бурт' }, { d: dpos3, l: w4.lst, name: 'под ступицу колеса z4', key: 'wheel4' },
          { d: dp3, l: W - xs - w4.lst / 2 + b3.B, name: 'втулка + подшипник B' }, { d: s3.d, l: sl3, name: 'под манжету' }, { d: dv3, l: lv3, name: 'выходной конец (звёздочка)', key: 'sprocket' }]
      };
      TC.attachKeys(R);
    }
    // 1.12 подшипники
    rep = sec('s112', 'check', 'Подшипники качения');
    rep.h('1.12', 'Подбор и проверочный расчёт подшипников качения');
    const Lh = O.LhMode === 'tsum' ? tS : O.Lh;
    rep.p(`Требуемый ресурс <i>L</i><sub>h</sub> = ${fnum(Lh)} ч (суммарное время работы привода); <i>K</i><sub>б</sub> = ${fnum(O.Kb, 0)}, <i>K</i><sub>т</sub> = 1, <i>V</i> = 1. Осевые силы в прямозубых зацеплениях отсутствуют.`);
    const brg = (h, t, B, b, nn, idx) => { rep.h(h, t, 3); return M.bearingCalc(rep, { kind: 'ball', d: b.d, Ra: B.RA, Rb: B.RB, RAx: Math.abs(B.RAx), RAy: Math.abs(B.RAy), RBx: Math.abs(B.RBx), RBy: Math.abs(B.RBy), Fa: 0, n: nn, Lh, Kb: O.Kb, Kt: 1, order: ['2', '3'], idx, fixed: A['b' + idx] ? b : null }); };
    const BR1 = brg('1.12.1', 'Расчёт подшипников быстроходного вала', sh1.B, b1, nI, '1');
    const BR2 = brg('1.12.2', 'Расчёт подшипников промежуточного вала', sh2.B, b2, nIIf, '2');
    const BR3 = brg('1.12.3', 'Расчёт подшипников тихоходного вала', sh3.B, b3, nIIIf, '3');
    rep.h('1.12.4', 'Проверка подшипников по статической грузоподъёмности', 3);
    rep.p('Статическая проверка выполнена в составе расчёта каждого вала (эквивалентная статическая нагрузка <i>P</i><sub>0</sub> не превышает <i>C</i><sub>0</sub>).');
    Object.assign(R, { BR1, BR2, BR3 });
    // 1.13 посадки, 1.14 смазка
    rep = sec('s113', 'other', 'Посадки и смазка');
    rep.h('1.13', 'Посадки деталей и сборочных единиц редуктора');
    TC.fitsSection(rep, ['внутренние кольца подшипников на валы — k6 (циркуляционное нагружение), наружные кольца в корпус — H7 (местное нагружение)',
      'колёса z2 и z4 на валы — H7/k6 (или H7/m6), момент передаётся призматическими шпонками', 'полумуфта на вал I — H7/m6 (реверсивная работа) или H7/k6', 'ведущая звёздочка на вал III — H7/m6, при толчках H7/n6',
      'крышки подшипников в корпус — H7/d11 (посадка с зазором)', 'шпоночные пазы: вал — N9, ступица — Js9', 'штифты — H7/m6',
      'шероховатость: цапфы под подшипники Ra 0,8, расточки корпуса Ra 1,6, посадки колёс Ra 1,6, под звёздочку Ra 3,2, под манжету Ra 0,32, рабочие поверхности зубьев Ra 1,6, свободные поверхности Ra 6,3…12,5']);
    rep.h('1.14', 'Смазка зубчатых зацеплений и подшипников');
    const vmax = Math.max(cB.v, cT.v), oil = vmax <= 2 ? 'И-Г-А-68' : 'И-Г-А-46';
    rep.p(`Смазывание зацеплений — окунанием (картерный способ). При окружной скорости ${fnum(vmax)} м/с ${vmax <= 2 ? '≤ 2 м/с принимается более вязкое масло' : 'принимается масло средней вязкости'} ${oil} по ГОСТ 17479.4-87 [[met|п. 1.14]]. Колесо тихоходной ступени погружается в масло на высоту зуба (не менее 2,25<i>m</i><sub>т</sub> = ${fnum(2.25 * gT.m)} мм), но не более 1/3 радиуса. Подшипники смазываются масляным туманом от разбрызгивания.`);
    const V = 0.5 * PI_;
    rep.eq({ lhs: 'V', f: '(0{,}35\\ldots 0{,}7)\\cdot P_{I}', s: `(0{,}35\\ldots 0{,}7)\\cdot ${n(PI_)}`, raw: `${n(0.35 * PI_)}\\ldots ${n(0.7 * PI_)}`, u: 'л', d: 'Объём масляной ванны.' });
    R.oil = oil; R.V = V;
    // 1.15 вал барабана
    rep = sec('s115', 'other', 'Вал конвейера с барабаном');
    const dr = drumSection(rep, { K, nIV: nOut, chn, O, P, Lh, A });
    Object.assign(R, { drum: dr });
    R.beams.shaft4 = { B: dr.B, names: { C: 'барабан', D: 'звёздочка' }, T: K.TIV, Tx: [dr.l4 / 2, dr.l4 + dr.ak4] };
    // 2 муфта
    rep = sec('s2', 'other', 'Подбор муфты');
    rep.h('2', 'Подбор муфты', 1);
    rep.p('Упругая втулочно-пальцевая муфта (МУВП) по ГОСТ 21424-93 соединяет выходной конец вала электродвигателя с быстроходным валом редуктора (вал I); она компенсирует небольшие смещения валов и гасит динамические нагрузки.');
    const cr = TC.couplingSection(rep, { T: K.TI, Tsym: 'T_{I}', n: nI, dm: mo.d1, dv: dv1, K: O.Kcoup, cp: M.couplingPick(Tc, mo.d1, dv1, nI), O, kText: 'привод ленточного конвейера при нагрузке с умеренными толчками, K = 1,4…1,8' });
    R.cp = cr; R.sections = S;
    R.kpis = [['Двигатель', mo.type], ['uб / uт', fnum(gB.uf, 3) + ' / ' + fnum(gT.uf, 3)], ['aw.б / aw.т', fnum(gB.aw) + ' / ' + fnum(gT.aw) + ' мм'], ['mб / mт', fnum(gB.m, 0) + ' / ' + fnum(gT.m, 0) + ' мм'], ['σH.т', fnum(cT.sH) + ' / ' + fnum(sHt) + ' МПа'], ['Цепь', chn.code], ['nвых', fnum(nOut) + ' мин⁻¹']];
    R.summary = [['Двигатель', `${mo.type}, ${fnum(mo.P, 0)} кВт, ${mo.n} мин⁻¹`], ['Быстроходная ступень', `aw = ${fnum(gB.aw)} мм, m = ${fnum(gB.m, 0)} мм, z1/z2 = ${gB.z1}/${gB.z2}`], ['Тихоходная ступень', `aw = ${fnum(gT.aw)} мм, m = ${fnum(gT.m, 0)} мм, z3/z4 = ${gT.z1}/${gT.z2}`], ['Цепь', `${chn.code} ГОСТ 13568-75`], ['Подшипники', `${(BR1 || {}).b ? BR1.b.id : b1.id}, ${(BR2 || {}).b ? BR2.b.id : b2.id}, ${(BR3 || {}).b ? BR3.b.id : b3.id}`], ['Муфта', cr.code]];
    return R;
  }

  /* 1.15 — вал конвейера с барабаном */
  function drumSection(rep, o) {
    const { K, nIV, chn, O, Lh, A } = o, R = {};
    rep.h('1.15', 'Расчёт вала конвейера с барабаном');
    rep.h('1.15.1', 'Исходные данные и расчётная схема', 3);
    const Db = O.Db || 400;
    if (!O.Db) rep.note('Диаметр барабана в задании не указан — принято Dб = 400 мм. Уточните его у руководителя и задайте во вкладке «Данные».', 'warn');
    const dvr = M.torsionD(new Report('tmp'), { lhs: 'd', T: K.TIV, Tsym: 'T_{IV}', tau: O.tauIV || 25, mode: '16pi' });
    let dv = M.shaftStd(dvr); for (let i = 0; i < (A.dv4Up || 0); i++) dv = M.shaftStd(dv + 0.5);
    const dp = M.std5(dv + 5), dbar = M.shaftStd(dp + 5);
    const b4 = pickBearing('ball', dp, A.b4);
    const Bb = O.lDrum || Math.round(1.2 * Db);                 // длина барабана
    const l4 = Bb + 2 * (b4.B / 2 + 40);                           // пролёт между подшипниками
    const lz = Math.max(Math.round(1.2 * dv), A.lz || 0), ak4 = b4.B / 2 + 25 + lz / 2;
    rep.p(`Исходные данные: крутящий момент <i>T</i><sub>IV</sub> = ${fnum(K.TIV)} Н·м, частота вращения <i>n</i><sub>IV</sub> = ${fnum(nIV)} мин<sup>−1</sup>, диаметр барабана <i>D</i><sub>б</sub> = ${Db} мм, длина обечайки барабана ${Bb} мм, нагрузка от цепной передачи <i>F</i><sub>цеп</sub> = ${fnum(chn.Fc)} Н под углом ${O.chainAngle}° к горизонту. Вал — сталь 45; по ориентировочному расчёту на кручение ([τ] = ${O.tauIV || 25} МПа) <i>d</i> ≥ ${fnum(dvr)} мм, принимаем: под ведомую звёздочку ${dv} мм, под подшипники ${dp} мм, под ступицы барабана ${dbar} мм. Опоры — радиальные шарикоподшипники ${b4.id} в корпусах, пролёт <i>l</i><sub>4</sub> = ${fnum(l4)} мм, консоль до середины ступицы звёздочки <i>a</i><sub>k4</sub> = ${fnum(ak4)} мм.`);
    rep.h('1.15.2', 'Определение нагрузок на вал барабана', 3);
    const Fokr = 2000 * K.TIV / Db, Fl = 2 * Fokr;
    rep.eq({ lhs: 'F_{окр}', f: '\\dfrac{2000\\cdot T_{IV}}{D_{б}}', s: `\\dfrac{2000\\cdot ${n(K.TIV)}}{${Db}}`, v: Fokr, u: 'Н', d: 'Окружное (тяговое) усилие на барабане.' });
    rep.eq({ lhs: 'F_{ленты}', f: '2\\cdot F', s: `2\\cdot ${n(Fokr)}`, v: Fl, u: 'Н', d: 'Радиальная нагрузка на вал от натяжения ленты при угле обхвата ≈ 180°, приложена в середине барабана (направлена вертикально).' });
    const ang = O.chainAngle * D2R, cz = x => Math.abs(x) < 1e-9 ? 0 : x, Fcx = chn.Fc * cz(Math.cos(ang)), Fcy = chn.Fc * cz(Math.sin(ang));
    rep.eq({ lhs: 'F_{цеп.x}', f: 'F_{цеп}\\cdot \\cos\\alpha_{цеп}', s: `${n(chn.Fc)}\\cdot \\cos ${O.chainAngle}^{\\circ}`, v: Fcx, u: 'Н' });
    rep.eq({ lhs: 'F_{цеп.y}', f: 'F_{цеп}\\cdot \\sin\\alpha_{цеп}', s: `${n(chn.Fc)}\\cdot \\sin ${O.chainAngle}^{\\circ}`, v: Fcy, u: 'Н' });
    rep.h('1.15.3', 'Определение реакций опор', 3);
    const loads = [{ id: 'C', x: l4 / 2, Fy: -Fl }, { id: 'D', x: l4 + ak4, Fx: -Fcx, Fy: -Fcy }];
    const B = M.beam(l4, loads);
    TC.reactRep(rep, B, [{ pl: 'x', F: 'F_{цеп.x}', Fm: Fcx, x: l4 + ak4, a: '(l_{4}+a_{k4})', b: 'a_{k4}' }, { pl: 'y', F: 'F_{ленты}', Fm: Fl, x: l4 / 2, a: '\\dfrac{l_{4}}{2}', b: '\\dfrac{l_{4}}{2}' }, { pl: 'y', F: 'F_{цеп.y}', Fm: Fcy, x: l4 + ak4, a: '(l_{4}+a_{k4})', b: 'a_{k4}' }], '', 'l_{4}');
    rep.eq({ lhs: 'R_{A}', f: '\\sqrt{R_{Ax}^{2}+R_{Ay}^{2}}', s: `\\sqrt{${sq(B.RAx)}^{2}+${sq(B.RAy)}^{2}}`, v: B.RA, u: 'Н' });
    rep.eq({ lhs: 'R_{B}', f: '\\sqrt{R_{Bx}^{2}+R_{By}^{2}}', s: `\\sqrt{${sq(B.RBx)}^{2}+${sq(B.RBy)}^{2}}`, v: B.RB, u: 'Н' });
    rep.h('1.15.4', 'Построение эпюр и определение опасного сечения', 3);
    rep.fig('shaft4', 'Расчётная схема и эпюры моментов вала барабана', null, { kind: 'beam' });
    const MC = B.at(l4 / 2), MB = B.at(l4);
    rep.p(`Характерные сечения: середина барабана (C) — <i>M</i><sub>x</sub> = ${fnum(MC.Mx / 1e3)} Н·м, <i>M</i><sub>y</sub> = ${fnum(MC.My / 1e3)} Н·м; опора B — <i>M</i><sub>x</sub> = ${fnum(MB.Mx / 1e3)} Н·м, <i>M</i><sub>y</sub> = ${fnum(MB.My / 1e3)} Н·м. Крутящий момент <i>T</i><sub>IV</sub> передаётся от звёздочки к барабану.`);
    rep.h('1.15.5', 'Проверка вала барабана на прочность', 3);
    const ch = M.shaftCheck(rep, { sb: M.steelSb('45', dbar).sb, n: O.nz, beta: O.betaSh, Kri: O.Kri, wMode: O.wKey, secs: [
      { id: 'C', title: 'Сечение C — под ступицей барабана (шпоночный паз)', d: dbar, M: MC, T: K.TIV, Tsym: 'T_{IV}', kind: 'key', key: M.key(dbar) },
      { id: 'B', title: 'Сечение B — шейка под подшипник со стороны звёздочки', d: dp, M: MB, T: K.TIV, Tsym: 'T_{IV}', kind: 'press' }] });
    rep.h('1.15.6', 'Подбор подшипников вала барабана', 3);
    let BR = M.bearingCalc(rep, { kind: 'ball', d: dp, Ra: B.RA, Rb: B.RB, RAx: Math.abs(B.RAx), RAy: Math.abs(B.RAy), RBx: Math.abs(B.RBx), RBy: Math.abs(B.RBy), Fa: 0, n: nIV, Lh, Kb: O.Kb, Kt: 1, order: ['2', '3'], idx: '4' });
    if (!BR) rep.note(`В каталоге радиальных шарикоподшипников нет подшипника с d = ${dp} мм — задайте подшипник вручную или уменьшите диаметр вала.`, 'warn');
    rep.h('1.15.7', 'Расчёт шпоночного соединения «вал – барабан»', 3);
    const lstb = Math.round(1.2 * dbar);
    const k1 = M.keyCheck(rep, { title: 'Вал барабана — ступица барабана', d: dbar, lHub: Math.max(lstb, A.lstb || 0), T: K.TIV, Tsym: 'T_{IV}', sig: O.sCmSteel, exact: O.keyExact, joint: 'drum', two: A.two.drum });
    const k2 = M.keyCheck(rep, { title: 'Вал барабана — ведомая звёздочка', d: dv, lHub: lz, T: K.TIV, Tsym: 'T_{IV}', sig: O.sCmSteel, exact: O.keyExact, joint: 'sprocket2', two: A.two.sprocket2 });
    Object.assign(R, { Db, Bb, l4, ak4, dv, dp, dbar, B, ch, BR, keys: [k1, k2], Fl, Fokr, b4, lz });
    return R;
  }

  /* =================================================================== задание 1 */
  function task1core(P, A) {
    root.MREF_TASK = 1;
    const O = Object.assign({}, P.O), T = D.TASKS[1], S = [], R = { task: 1 };
    const sec = (id, tab, title) => { const r = new Report(tab); r.id = id; r.title = title; S.push(r); return r; };
    let rep = sec('s11', 'kin', 'Исходные данные');
    rep.h('1', 'Расчёт привода', 1);
    const tS = TC.secInput(rep, P, T); R.tS = tS;
    rep = sec('s12', 'kin', 'Электродвигатель и кинематический расчёт');
    rep.h('1.2', 'Выбор электродвигателя и кинематический расчёт');
    rep.p('Обозначения валов: быстроходный вал (вал коническойшестерни) — 1Б, промежуточный вал — 2Б (1Т), тихоходный вертикальный вал со звёздочкой конвейера — 2Т.'.replace('коническойшестерни', 'конической шестерни'));
    rep.p(`Принимаем КПД [[met|п. 1.2]], [[ch|табл. 1.1]]: конической зубчатой передачи с учётом потерь в подшипниках η<sub>к</sub> = ${fnum(O.etaCon, 0)}, цилиндрической η<sub>ц</sub> = ${fnum(O.etaCyl, 0)}, соединительной муфты η<sub>м</sub> = ${fnum(O.etaM, 0)} (в приводе одна муфта; в табл. 1.1 [Ч] КПД муфт не приводится — принято для упругой втулочно-пальцевой муфты).`);
    const eta = O.etaCon * O.etaCyl * O.etaM, Preq = P.Pout / eta;
    rep.eq({ lhs: '\\eta_{общ}', f: '\\eta_{к}\\cdot \\eta_{ц}\\cdot \\eta_{м}', s: `${nx(O.etaCon)}\\cdot ${nx(O.etaCyl)}\\cdot ${nx(O.etaM)}`, v: eta, sig: 4, d: 'Общий КПД привода.' });
    rep.eq({ lhs: 'P_{эд}', f: '\\dfrac{P_{в}}{\\eta_{общ}}', s: `\\dfrac{${nx(P.Pout)}}{${n(eta, 4)}}`, v: Preq, u: 'кВт', d: 'Требуемая мощность электродвигателя.' });
    rep.eq({ lhs: "n_{эд}'", f: 'n_{в}\\cdot u_{т}\\cdot u_{б}', s: `${nx(P.nout)}\\cdot(8\\ldots 15)`, raw: `${n(8 * P.nout)}\\ldots ${n(15 * P.nout)}`, u: 'мин⁻¹', d: 'Ориентировочная частота вращения вала двигателя; для коническо-цилиндрических редукторов наиболее употребительны передаточные числа u = uт·uб = 8…15, наибольшее — 22 [Ч, с. 15].', ref: ['ch', 'с. 15'] });
    // при 1500 мин⁻¹ передаточное число редуктора превысило бы наибольшее для коническо-цилиндрических (22 [Ч, с. 15]) — 1000 мин⁻¹
    const syncT1 = (O.sync || 1500) === 1500 && (!O.motor || O.motor === 'auto') && 1500 * 0.95 / P.nout > 22 ? 1000 : null;
    const mo = TC.motorSection(rep, P, Preq, P.nout, syncT1, syncT1 ? 'при синхронной частоте 1500 мин⁻¹ передаточное число редуктора превысило бы наибольшее рекомендуемое для коническо-цилиндрических редукторов u = 22 [[ch|с. 15]], поэтому принимаем синхронную частоту 1000 мин⁻¹' : null); R.motor = mo;
    const ured = mo.n / P.nout;
    rep.eq({ lhs: 'u_{ред}', f: '\\dfrac{n_{эд}}{n_{в}}', s: `\\dfrac{${mo.n}}{${nx(P.nout)}}`, v: ured, d: 'Фактическое общее передаточное число редуктора.' });
    const ut = 0.63 * Math.pow(ured, 2 / 3), ub = ured / ut;
    rep.eq({ lhs: 'u_{т}', f: '0{,}63\\cdot u_{ред}^{2/3}', s: `0{,}63\\cdot ${n(ured)}^{2/3}`, v: ut, d: 'Передаточное число тихоходной ступени.' });
    rep.eq({ lhs: 'u_{б}', f: '\\dfrac{u_{ред}}{u_{т}}', s: `\\dfrac{${n(ured)}}{${n(ut)}}`, v: ub, d: 'Передаточное число быстроходной (конической) ступени.' });
    const n1B = mo.n, n1T = n1B / ub, n2T = n1T / ut;
    rep.eq({ lhs: 'n_{1Б}', f: 'n_{эд}', v: n1B, u: 'мин⁻¹', d: 'Частоты вращения валов.' });
    rep.eq({ lhs: 'n_{1Т}=n_{2Б}', f: '\\dfrac{n_{1Б}}{u_{б}}', s: `\\dfrac{${n(n1B)}}{${n(ub)}}`, v: n1T, u: 'мин⁻¹' });
    rep.eq({ lhs: 'n_{2Т}', f: '\\dfrac{n_{1Т}}{u_{т}}', s: `\\dfrac{${n(n1T)}}{${n(ut)}}`, v: n2T, u: 'мин⁻¹' });
    const Tv = 9550 * P.Pout / P.nout, T2T = O.t1Coup === 'met' ? Tv / O.etaM : Tv, T1T = T2T / (O.etaCyl * ut), T1B = T1T / (O.etaCon * ub);
    rep.eq({ lhs: 'T_{в}', f: '9550\\cdot \\dfrac{P_{в}}{n_{в}}', s: `9550\\cdot \\dfrac{${nx(P.Pout)}}{${nx(P.nout)}}`, v: Tv, u: 'Н·м', d: 'Крутящий момент на звёздочке конвейера.' });
    if (O.t1Coup === 'met') rep.eq({ lhs: 'T_{2Т}', f: '\\dfrac{T_{в}}{\\eta_{м}}', s: `\\dfrac{${n(Tv)}}{${nx(O.etaM)}}`, v: T2T, u: 'Н·м', d: 'Крутящий момент на тихоходном валу.' });
    else rep.eq({ lhs: 'T_{2Т}', f: 'T_{в}', v: T2T, u: 'Н·м', d: 'Звёздочка конвейера установлена непосредственно на тихоходном валу редуктора.' });
    rep.eq({ lhs: 'T_{1Т}=T_{2Б}', f: '\\dfrac{T_{2Т}}{\\eta_{ц}\\cdot u_{т}}', s: `\\dfrac{${n(T2T)}}{${nx(O.etaCyl)}\\cdot ${n(ut)}}`, v: T1T, u: 'Н·м' });
    rep.eq({ lhs: 'T_{1Б}', f: '\\dfrac{T_{1Т}}{\\eta_{к}\\cdot u_{б}}', s: `\\dfrac{${n(T1T)}}{${nx(O.etaCon)}\\cdot ${n(ub)}}`, v: T1B, u: 'Н·м' });
    const P1B = T1B * n1B / 9550, P1T = T1T * n1T / 9550;
    TC.shaftsTable(rep, [{ name: '1Б (быстроходный)', n: n1B, w: PI * n1B / 30, P: P1B, T: T1B }, { name: '1Т = 2Б (промежуточный)', n: n1T, w: PI * n1T / 30, P: P1T, T: T1T }, { name: '2Т (тихоходный)', n: n2T, w: PI * n2T / 30, P: P.Pout / (O.t1Coup === 'met' ? O.etaM : 1), T: T2T }]);
    const K = { n1B, n1T, n2T, T1B, T1T, T2T, Tv, P1B };
    Object.assign(R, { K, ured, ut, ub, eta, Preq });
    // 1.3
    rep = sec('s13', 'mat', 'Материалы и допускаемые напряжения');
    rep.h('1.3', 'Выбор марки материала и назначение химико-термической обработки зубьев, определение допускаемых напряжений');
    rep.p(`Суммарная наработка редуктора <i>t</i><sub>ч</sub> = ${fnum(tS)} ч (п. 1.1).`);
    rep.p('<b>Первая ступень (быстроходная коническая).</b>');
    const q1 = G.allowGear(rep, { title: 'Шестерня', mat: 'Ст45ТВЧ', n: n1B, nsym: 'n_{1Б}', tch: tS, label: '1I' });
    const q2 = G.allowGear(rep, { title: 'Колесо', mat: 'Ст40ул', n: n1T, nsym: 'n_{2Б}', tch: tS, label: '2I' });
    rep.p('<b>Вторая ступень (тихоходная цилиндрическая).</b>');
    const q3 = G.allowGear(rep, { title: 'Шестерня', mat: 'Ст45ул', n: n1T, nsym: 'n_{1Т}', tch: tS, label: '1II' });
    const q4 = G.allowGear(rep, { title: 'Колесо', mat: 'Ст40норм', n: n2T, nsym: 'n_{2Т}', tch: tS, label: '2II' });
    const sHI = Math.min(q1.sH, q2.sH), sHII = Math.min(q3.sH, q4.sH);
    // 1.4
    rep = sec('s14', 'gear', 'Параметры передач и силы');
    rep.h('1.4', 'Вычисление параметров передачи, назначение степени точности и определение сил, действующих в зацеплении');
    rep.h('1.4.1', 'Первая ступень (быстроходная коническая)', 3);
    rep.p(`Расчёт ведётся по допускаемому напряжению менее прочного колеса пары: [σ<sub>HP</sub>]<sub>I</sub> = ${fnum(sHI)} МПа.`);
    const oC = { T: T1B, n1: n1B, u: ub, sH: sHI, sF1: q1.sF, sF2: q2.sF, hard: false };
    const gC = G.conical(rep, oC, O);
    rep.h('1.4.2', 'Вторая ступень (тихоходная цилиндрическая)', 3);
    const ub2 = gC.uf, n1Tf = n1B / ub2;
    const oT = { st: { p: '1', w: '2' }, T: T1T, Tsym: 'T_{1Т}', Tw: T2T, Twsym: 'T_{2Т}', n1: n1Tf, n1sym: 'n_{1Т}', u: ut, usym: 'u_{т}', sH: sHII, sHsym: "\\sigma_{HPII}'", psiba: O.psiba1, col: 'II', colF: 'II', hard: false, sF1: q3.sF, sF2: q4.sF, label: '', title: 'тихоходной ступени', pa: true, underRef: '[[met|п. 1.6.2]]' };
    const gT = G.cylStage(rep, oT, O);
    rep = sec('s15', 'gear', 'Окружные скорости и силы');
    rep.h('1.5', 'Вычисление окружной скорости и сил, действующих в зацеплении');
    rep.h('1.5.1', 'Первая ступень (быстроходная коническая)', 3);
    const fC = G.conForces(rep, gC, oC);
    rep.h('1.5.2', 'Вторая ступень (тихоходная цилиндрическая)', 3);
    const fT = G.cylForces(rep, gT, oT);
    rep = sec('s16', 'gear', 'Проверочный расчёт передач');
    rep.h('1.6', 'Проверочный расчёт на контактную и изгибную выносливость зубьев');
    rep.h('1.6.1', 'Первая ступень (быстроходная коническая)', 3);
    const cC = G.conCheck(rep, gC, oC, fC);
    rep.h('1.6.2', 'Вторая ступень (тихоходная цилиндрическая)', 3);
    const cT = G.cylCheck(rep, gT, oT, fT);
    Object.assign(R, { gC, gT, fC, fT, cC, cT, q1, q2, q3, q4 });
    // 1.7 валы
    rep = sec('s17', 'shaft', 'Ориентировочный расчёт валов, размеры колёс');
    rep.h('1.7', 'Ориентировочный расчёт валов и конструктивные размеры зубчатых колёс');
    rep.h('1.7.1', 'Быстроходный вал (вал-шестерня)', 3);
    rep.p(`Материал валов — сталь 45 по ГОСТ 1050-2013; допускаемые напряжения кручения [[met|п. 1.7]]: быстроходный вал [τ] = ${O.tauI} МПа, промежуточный — 25 МПа, тихоходный — 20 МПа.`);
    const dB1r = dTors(rep, 'd_{В1}', T1B, 'T_{1б}', O.tauI);
    let dB1 = Math.max(M.shaftStd(dB1r), M.shaftStd(0.8 * mo.d1));
    const Tc = O.Kcoup * T1B, cp0 = M.couplingPick(Tc, mo.d1, dB1, n1B);
    if (!cp0.exact) dB1 = cp0.bore2;
    const s11 = M.seal(dB1 + 2), d12 = THREADS.find(t => t > s11.d) || s11.d + 4, d13 = M.shaftStd(d12 + 2);
    let d14 = M.std5(d13 + 1) + 5 * (A.dp1Up || 0); const d15 = M.shaftStd(d14 + 5);
    rep.p(`Принимаем <i>d</i><sub>В1</sub> = ${dB1} мм (согласовано с валом двигателя <i>d</i><sub>эд</sub> = ${mo.d1} мм и муфтой). Ступени вала: под уплотнение <i>d</i><sub>11</sub> = ${s11.d} мм (манжета ${s11.d}×${s11.D}×${s11.h}), резьба под круглую шлицевую гайку М${d12}×1,5 (<i>d</i><sub>12</sub>), под шайбу <i>d</i><sub>13</sub> = ${d13} мм, под подшипники <i>d</i><sub>14</sub> = <i>d</i><sub>16</sub> = ${d14} мм, промежуточный участок <i>d</i><sub>15</sub> = ${d15} мм. Коническая шестерня выполняется за одно целое с валом (<i>d</i><sub>m1</sub> = ${fnum(gC.dm1)} мм, <i>d</i><sub>e1</sub> = ${fnum(gC.de1)} мм).`);
    rep.h('1.7.2', 'Промежуточный вал и конструктивные размеры конического колеса первой ступени', 3);
    const d2r = dTors(rep, 'd_{2}', T1T, 'T_{1Т}', 25);
    const d2 = Math.max(20, M.std5(d2r)) + 5 * (A.dp2Up || 0), d2p = M.shaftStd(d2 + 3), d2pp = M.shaftStd(d2p + 4);
    rep.p(`Принимаем диаметр под подшипники <i>d</i><sub>2</sub> = ${d2} мм, под ступицу конического колеса <i>d</i><sub>2</sub>′ = ${d2p} мм, опорный бурт <i>d</i><sub>2</sub>″ = ${d2pp} мм. Цилиндрическая шестерня тихоходной ступени выполняется за одно целое с валом (вал-шестерня) [[met|п. 1.10.2]].`);
    rep.p(`<b>Коническое колесо</b> (<i>d</i><sub>e2</sub> = ${fnum(gC.de2)} мм, <i>b</i> = ${gC.b} мм):`);
    const wC = wheelDims(rep, { dpos: d2p, b: gC.b, idx: '2', cone: { mte: gC.mte, Re: gC.Re }, lstMin: A.lstC });
    rep.h('1.7.3', 'Тихоходный вал и конструктивные размеры цилиндрического колеса второй ступени', 3);
    const dB3r = dTors(rep, 'd_{В3}', T2T, 'T_{2Т}', 20);
    let dB3 = M.shaftStd(dB3r); for (let i = 0; i < (A.dv3Up || 0); i++) dB3 = M.shaftStd(dB3 + 0.5);
    const s3 = M.seal(dB3 + 2), d3pp = M.std5(s3.d + 1) + 5 * (A.dp3Up || 0), d3ppp = M.shaftStd(d3pp + 3), dbur3 = M.shaftStd(d3ppp + 6);
    rep.p(`Принимаем <i>d</i><sub>В3</sub> = ${dB3} мм (под ступицу звёздочки конвейера), под уплотнение <i>d</i><sub>3</sub>′ = ${s3.d} мм (манжета ${s3.d}×${s3.D}×${s3.h}), под подшипники <i>d</i><sub>3</sub>″ = ${d3pp} мм, под ступицу колеса <i>d</i><sub>3</sub>‴ = ${d3ppp} мм.`);
    rep.p(`<b>Цилиндрическое колесо</b> (<i>d</i><sub>2</sub> = ${fnum(gT.d2)} мм, <i>b</i><sub>2</sub> = ${gT.b2} мм):`);
    const wT = wheelDims(rep, { dpos: d3ppp, b: gT.b2, m: gT.m, idx: '4', lstMin: A.lstT });
    // 1.8 корпус
    rep = sec('s18', 'shaft', 'Корпус редуктора');
    rep.h('1.8', 'Конструктивные размеры элементов корпуса и компоновка редуктора');
    rep.p('Корпус и крышка — литые из серого чугуна СЧ15; размеры определяются по межосевому расстоянию тихоходной ступени [[met|п. 1.8]].');
    const H = housing1(rep, gT.aw);
    // 1.9 компоновка
    rep = sec('s19', 'shaft', 'Компоновка и подшипники');
    rep.h('1.9', 'Конструктивные размеры элементов валов, подшипниковых узлов и компоновка редуктора');
    rep.h('1.9.1', 'Расчёт конструктивных зазоров внутри корпуса', 3);
    const y = Math.ceil(1.2 * H.del), y1 = Math.ceil(2 * H.del), y1b = Math.ceil(3.5 * H.del);
    rep.eq({ lhs: 'y', f: '1{,}2\\cdot \\delta', s: `1{,}2\\cdot ${H.del}`, v: 1.2 * H.del, raw: `${n(1.2 * H.del)}\\ \\Rightarrow\\ ${y}`, u: 'мм', cmp: '\\ge', d: 'Зазор между стенкой корпуса и торцами колёс.' });
    rep.eq({ lhs: 'y_{1}', f: '(1{,}5\\ldots 3)\\cdot \\delta', s: `(1{,}5\\ldots 3)\\cdot ${H.del}`, raw: `${n(1.5 * H.del)}\\ldots ${n(3 * H.del)}\\ \\Rightarrow\\ ${y1}`, u: 'мм', d: 'Зазор между стенкой корпуса и вершинами зубьев.' });
    rep.eq({ lhs: "y_{1}'", f: '(3\\ldots 4)\\cdot \\delta', s: `(3\\ldots 4)\\cdot ${H.del}`, raw: `${3 * H.del}\\ldots ${4 * H.del}\\ \\Rightarrow\\ ${y1b}`, u: 'мм', d: 'Расстояние от вершин зубьев до дна картера.' });
    rep.h('1.9.2', 'Выбор длин выходных концов валов', 3);
    const lcp = M.couplingPick(Tc, mo.d1, dB1, n1B).c.l1 || Math.round(1.5 * dB1);
    const l3 = Math.max(Math.round(1.5 * dB3), A.l3 || 0);
    rep.p(`Длина выходного конца быстроходного вала согласуется с длиной полумуфты: <i>l</i><sub>1</sub> = ${lcp} мм (рекомендация (1,5…2)<i>d</i><sub>В1</sub> = ${fnum(1.5 * dB1)}…${fnum(2 * dB1)} мм); тихоходного вала — <i>l</i><sub>3</sub> = (1,5…2)<i>d</i><sub>В3</sub> = ${l3} мм.`);
    rep.h('1.9.3', 'Подбор типов и габаритных размеров подшипников качения', 3);
    const b1 = pickBearing('taper', d14, A.b1), b2 = pickBearing('taper', d2, A.b2), b3 = pickBearing('ball', d3pp, A.b3);
    rep.p(`Опоры быстроходного и промежуточного валов — роликовые конические однорядные подшипники ${[b1, b2].every(b => /^72/.test(b.id)) ? 'лёгкой серии' : 'лёгкой и средней серий'} по ГОСТ 27365-87 (значительные осевые силы конического зацепления): вал 1Б — ${b1.id} (${b1.d}×${b1.D}×${fnum(b1.T, 0)}), вал 2Б — ${b2.id} (${b2.d}×${b2.D}×${fnum(b2.T, 0)}); тихоходный вал — шариковые радиальные ${b3.id} (${b3.d}×${b3.D}×${b3.B}) по ГОСТ 8338-75 [[met|п. 1.9]].`);
    // компоновка
    const ap1 = apx(b1), ap2 = apx(b2);
    const a1c = 0.5 * gC.b * Math.cos(gC.d1deg * D2R) + y + b1.T / 2;   // от середины венца шестерни до середины подшипника A
    const a1 = a1c + ap1;
    const cI = Math.round(2.5 * a1) - 2 * ap1;                           // пролёт между точками реакций
    const lI = Math.max(cI, 60);
    const cC1 = b1.T / 2 + H.del + s11.h + 10 + lcp / 2 + ap1;           // консоль до середины полумуфты от точки реакции B
    // промежуточный вал: A — шестерня z1(цил) — коническое колесо — D
    const a2 = b2.T / 2 + y + gT.b1 / 2 - ap2, b2s = gT.b1 / 2 + y + wC.lst / 2, c2 = wC.lst / 2 + y + b2.T / 2 - ap2, lII = a2 + b2s + c2;
    // тихоходный: A — колесо — C (симметрично)
    const a3 = b3.B / 2 + y + wT.lst / 2, lIII = 2 * a3;
    const L = { y, y1, y1b, a1, lI, cC1, a2, b2: b2s, c2, lII, a3, b3: a3, lIII, lcp, l3, ap1, ap2 };
    rep.p(`По эскизной компоновке (рисунок {fig:layout}) определены расчётные расстояния (с учётом смещения точек приложения реакций конических подшипников <i>a</i><sub>p</sub> = <i>T</i>/2 + (<i>d</i> + <i>D</i>)<i>e</i>/6 относительно торцов): консольная коническая шестерня вынесена от опоры A на <i>a</i><sub>1</sub> = ${fnum(a1)} мм, расстояние между опорами быстроходного вала принимается <i>c</i><sub>1</sub> ≈ 2,5<i>a</i><sub>1</sub> = ${fnum(lI)} мм для достаточной жёсткости консольного узла.`);
    rep.fig('layout', 'Эскизная компоновка коническо-цилиндрического редуктора', null, { kind: 'layout' });
    rep.table('Расстояния, снятые с эскизной компоновки, мм', ['Обозначение', 'Описание', 'Значение'], [
      ['a₁', 'от середины венца конической шестерни до опоры A', fnum(a1)], ['c₁', 'между опорами A и B быстроходного вала', fnum(lI)],
      ['a₂', 'от опоры A промежуточного вала до цилиндрической шестерни', fnum(a2)], ['b₂', 'между шестерней и коническим колесом', fnum(b2s)], ['c₂', 'от конического колеса до опоры D', fnum(c2)],
      ['a₃', 'от опоры A тихоходного вала до колеса', fnum(a3)], ['b₃', 'от колеса до опоры C', fnum(a3)]]);
    Object.assign(R, { H, L, b1, b2, b3, wC, wT });
    R.dims = { dB1, s11, d12, d13, d14, d15, d2, d2p, d2pp, dB3, s3, d3pp, d3ppp, dbur3, lcp, l3 };
    // 1.10 проверка валов
    rep = sec('s110', 'check', 'Проверка прочности валов');
    rep.h('1.10', 'Проверка прочности валов');
    const sb = M.steelSb('45', 90).sb;
    rep.h('1.10.1', 'Быстроходный вал', 3);
    const loadsI = [{ id: 'C', x: -a1, Fx: -fC.Ft, Fy: fC.Fr1, Cy: -fC.Fa1 * gC.dm1 / 2 }];
    const termsI = [{ pl: 'x', F: 'F_{t1}', Fm: fC.Ft, x: -a1, a: 'a_{1}', b: '(a_{1}+c_{1})' }, { pl: 'y', F: 'F_{r1}', Fm: fC.Fr1, dir: -1, x: -a1, a: 'a_{1}', b: '(a_{1}+c_{1})' }, { pl: 'y', C: 'F_{a1}\\cdot 0{,}5\\cdot d_{m1}', Cv: -fC.Fa1 * gC.dm1 / 2 }];
    if (O.Fm1) { const Fm = TC.FmGost(T1B, false); loadsI.push({ id: 'D', x: lI + cC1, Fx: -Fm }); termsI.push({ pl: 'x', F: 'F_{м}', Fm, x: lI + cC1, a: '(c_{1}+l_{м})', b: 'l_{м}' }); }
    const sh1 = shaftBlock(rep, { l: lI, lsym: 'c_{1}', T: T1B, sb, O, fig: 'shaft1', figTitle: 'Расчётная схема и эпюры моментов быстроходного вала',
      intro: `Расчётная схема — балка на опорах A и B (<i>c</i><sub>1</sub> = ${fnum(lI)} мм) с консольной конической шестерней (<i>a</i><sub>1</sub> = ${fnum(a1)} мм). Нагрузки: <i>F</i><sub>t1</sub> = ${fnum(fC.Ft)} Н, <i>F</i><sub>r1</sub> = ${fnum(fC.Fr1)} Н, <i>F</i><sub>a1</sub> = ${fnum(fC.Fa1)} Н (пара сил <i>F</i><sub>a1</sub>·0,5<i>d</i><sub>m1</sub>), крутящий момент <i>T</i><sub>1Б</sub> = ${fnum(T1B)} Н·м.`,
      loads: loadsI, terms: termsI,
      secs: [{ id: 'A', x: 0, title: 'Сечение A — опора у шестерни (шейка под подшипник)', d: d14, T: T1B, Tsym: 'T_{1Б}', kind: 'press' }] });
    rep.h('1.10.2', 'Промежуточный вал', 3);
    const sh2 = shaftBlock(rep, { l: lII, lsym: 'l_{общ}', T: T1T, sb, O, fig: 'shaft2', figTitle: 'Расчётная схема и эпюры моментов промежуточного вала',
      intro: `Расчётные расстояния: <i>a</i><sub>2</sub> = ${fnum(a2)} мм, <i>b</i><sub>2</sub> = ${fnum(b2s)} мм, <i>c</i><sub>2</sub> = ${fnum(c2)} мм, <i>l</i><sub>общ</sub> = ${fnum(lII)} мм. Нагрузки от конического колеса: <i>F</i><sub>t12</sub> = ${fnum(fC.Ft)} Н, <i>F</i><sub>r12</sub> = <i>F</i><sub>a1</sub> = ${fnum(fC.Fa1)} Н, <i>F</i><sub>a12</sub> = <i>F</i><sub>r1</sub> = ${fnum(fC.Fr1)} Н; от цилиндрической шестерни: <i>F</i><sub>t2</sub> = ${fnum(fT.Ft)} Н, <i>F</i><sub>r2</sub> = ${fnum(fT.Fr)} Н.`,
      loads: [{ id: 'B', x: a2, Fx: -fT.Ft, Fy: fT.Fr }, { id: 'C', x: a2 + b2s, Fx: -fC.Ft, Fy: -fC.Fa1, Cy: fC.Fr1 * gC.dm2 / 2 }],
      terms: [{ pl: 'x', F: 'F_{t2}', Fm: fT.Ft, x: a2, a: 'a_{2}', b: '(b_{2}+c_{2})' }, { pl: 'x', F: 'F_{t12}', Fm: fC.Ft, x: a2 + b2s, a: '(a_{2}+b_{2})', b: 'c_{2}' },
        { pl: 'y', F: 'F_{r2}', Fm: fT.Fr, dir: -1, x: a2, a: 'a_{2}', b: '(b_{2}+c_{2})' }, { pl: 'y', F: 'F_{r12}', Fm: fC.Fa1, x: a2 + b2s, a: '(a_{2}+b_{2})', b: 'c_{2}' }, { pl: 'y', C: 'F_{a12}\\cdot 0{,}5\\cdot d_{m2}', Cv: fC.Fr1 * gC.dm2 / 2 }],
      secs: [{ id: 'C', x: a2 + b2s, title: 'Сечение C — под коническим колесом (шпоночный паз)', d: d2p, T: T1T, Tsym: 'T_{1Т}', kind: 'key', key: M.key(d2p) }, { id: 'B', x: a2, title: 'Сечение B — под цилиндрической шестерней', d: gT.df1, T: T1T, Tsym: 'T_{1Т}', kind: 'press' }] });
    rep.h('1.10.3', 'Тихоходный вал', 3);
    const sh3 = shaftBlock(rep, { l: lIII, lsym: 'l_{общ}', T: T2T, sb: M.steelSb('45', dbur3).sb, O, fig: 'shaft3', figTitle: 'Расчётная схема и эпюры моментов тихоходного вала',
      intro: `Вал — двухопорная балка (опоры A и C) с цилиндрическим колесом посередине: <i>a</i><sub>3</sub> = <i>b</i><sub>3</sub> = ${fnum(a3)} мм. Нагрузки: <i>F</i><sub>t22</sub> = ${fnum(fT.Ft)} Н, <i>F</i><sub>r22</sub> = ${fnum(fT.Fr)} Н, крутящий момент <i>T</i><sub>2Т</sub> = ${fnum(T2T)} Н·м.`,
      loads: [{ id: 'B', x: a3, Fx: -fT.Ft, Fy: -fT.Fr }],
      terms: [{ pl: 'x', F: 'F_{t22}', Fm: fT.Ft, x: a3, a: 'a_{3}', b: 'b_{3}' }, { pl: 'y', F: 'F_{r22}', Fm: fT.Fr, x: a3, a: 'a_{3}', b: 'b_{3}' }],
      secs: [{ id: 'B', x: a3, title: 'Сечение B — под цилиндрическим колесом (шпоночный паз)', d: d3ppp, T: T2T, Tsym: 'T_{2Т}', kind: 'key', key: M.key(d3ppp) }] });
    Object.assign(R, { B1: sh1.B, B2: sh2.B, B3: sh3.B, ch1: sh1.ch, ch2: sh2.ch, ch3: sh3.ch });
    R.beams = { shaft1: { B: sh1.B, names: { C: 'шестерня' }, T: T1B, Tx: [-a1, lI] }, shaft2: { B: sh2.B, names: { B: 'шестерня', C: 'колесо' }, T: T1T, Tx: [a2, a2 + b2s] }, shaft3: { B: sh3.B, names: { B: 'колесо' }, T: T2T, Tx: [a3, lIII] } };
    // 1.11 шпонки
    rep = sec('s111', 'check', 'Шпоночные соединения');
    rep.h('1.11', 'Подбор и проверочный расчёт шпоночных соединений');
    rep.p(`Призматические шпонки по ГОСТ 23360-78 (исполнение 1). Допускаемые напряжения смятия [[met|п. 1.11]]: стальные ступицы [σ]<sub>см</sub> = ${O.sCmSteel} МПа, чугунная ступица полумуфты — ${O.sCmCI} МПа.`);
    const keys = [];
    keys.push(M.keyCheck(rep, { title: 'Быстроходный вал — полумуфта', d: dB1, lHub: lcp, T: T1B, Tsym: 'T_{1}', sig: O.sCmCI, exact: O.keyExact, joint: 'coupling1', two: A.two.coupling1 }));
    keys.push(M.keyCheck(rep, { title: 'Промежуточный вал — коническое колесо', d: d2p, lHub: wC.lst, T: T1T, Tsym: 'T_{2}', sig: O.sCmSteel, exact: O.keyExact, joint: 'wheelC', two: A.two.wheelC }));
    keys.push(M.keyCheck(rep, { title: 'Тихоходный вал — цилиндрическое колесо', d: d3ppp, lHub: wT.lst, T: T2T, Tsym: 'T_{3}', sig: O.sCmSteel, exact: O.keyExact, joint: 'wheelT', two: A.two.wheelT }));
    keys.push(M.keyCheck(rep, { title: 'Тихоходный вал — звёздочка конвейера', d: dB3, lHub: l3, T: T2T, Tsym: 'T_{3}', sig: O.sCmSteel, exact: O.keyExact, joint: 'sprocket', two: A.two.sprocket }));
    R.keys = keys;
    {
      const sl1 = H.del + s11.h + 10, sl3 = H.del + s3.h + 10, bc = gC.b * Math.cos(gC.d1deg * D2R);
      R.shafts = {
        I: [{ d: gC.dae1, l: Math.max(bc, 6), name: 'коническая шестерня z1', gear: { kind: 'bevel', da: gC.dae1, df: gC.dfe1, d: gC.de1, m: gC.mte, z: gC.z1, b: gC.b, delta: gC.d1deg } },
          { d: d15, l: Math.max(5, a1 - bc / 2 - b1.T / 2 - ap1), name: 'участок вала' }, { d: d14, l: b1.T, name: 'подшипник A' }, { d: d15, l: Math.max(10, lI + 2 * ap1 - b1.T), name: 'распорный участок' },
          { d: d14, l: b1.T, name: 'подшипник B' }, { d: d13, l: 4, name: 'под шайбу' }, { d: d12, l: 10, name: `резьба М${d12}×1,5`, thread: true }, { d: s11.d, l: sl1, name: 'под манжету' }, { d: dB1, l: lcp, name: 'выходной конец (муфта)', key: 'coupling1' }],
        II: [{ d: d2, l: b2.T, name: 'подшипник A' }, { d: d2pp, l: Math.max(5, y), name: 'бурт' }, { d: gT.da1, l: gT.b1, name: 'цилиндрическая шестерня', gear: { kind: 'spur', da: gT.da1, df: gT.df1, d: gT.d1, m: gT.m, z: gT.z1 } },
          { d: d2pp, l: y, name: 'бурт' }, { d: d2p, l: wC.lst, name: 'под ступицу конического колеса', key: 'wheelC' }, { d: d2, l: y + b2.T, name: 'втулка + подшипник D' }],
        III: [{ d: d3pp, l: b3.B, name: 'подшипник A' }, { d: dbur3, l: y, name: 'бурт' }, { d: d3ppp, l: wT.lst, name: 'под ступицу колеса', key: 'wheelT' }, { d: d3pp, l: y + b3.B, name: 'втулка + подшипник C' },
          { d: s3.d, l: sl3, name: 'под манжету' }, { d: dB3, l: l3, name: 'выходной конец (звёздочка)', key: 'sprocket' }]
      };
      TC.attachKeys(R);
    }
    // 1.12 подшипники
    rep = sec('s112', 'check', 'Подшипники качения');
    rep.h('1.12', 'Подбор и проверочный расчёт подшипников качения');
    const Lh = O.LhMode === 'tsum' ? tS : O.Lh;
    rep.p(`Требуемый ресурс <i>L</i><sub>h</sub> = ${fnum(Lh)} ч; <i>K</i><sub>безоп</sub> = ${fnum(O.Kb, 0)}, <i>K</i><sub>t</sub> = 1, <i>V</i> = 1.`);
    rep.p('<b>Быстроходный вал.</b>');
    const BR1 = M.bearingCalc(rep, { kind: 'taper', d: d14, Ra: sh1.B.RA, Rb: sh1.B.RB, RAx: Math.abs(sh1.B.RAx), RAy: Math.abs(sh1.B.RAy), RBx: Math.abs(sh1.B.RBx), RBy: Math.abs(sh1.B.RBy), Fa: fC.Fa1, n: n1B, Lh, Kb: O.Kb, Kt: 1, order: ['72', '73'], idx: '1', fixed: A.b1 ? b1 : null });
    rep.p('<b>Промежуточный вал.</b>');
    const BR2 = M.bearingCalc(rep, { kind: 'taper', d: d2, Ra: sh2.B.RA, Rb: sh2.B.RB, RAx: Math.abs(sh2.B.RAx), RAy: Math.abs(sh2.B.RAy), RBx: Math.abs(sh2.B.RBx), RBy: Math.abs(sh2.B.RBy), Fa: fC.Fr1, n: n1Tf, Lh, Kb: O.Kb, Kt: 1, order: ['72', '73'], idx: '2', fixed: A.b2 ? b2 : null });
    rep.p('<b>Тихоходный вал.</b>');
    const BR3 = M.bearingCalc(rep, { kind: 'ball', d: d3pp, Ra: sh3.B.RA, Rb: sh3.B.RB, RAx: Math.abs(sh3.B.RAx), RAy: Math.abs(sh3.B.RAy), RBx: Math.abs(sh3.B.RBx), RBy: Math.abs(sh3.B.RBy), Fa: 0, n: n1Tf / gT.uf, Lh, Kb: O.Kb, Kt: 1, order: ['2', '3'], idx: '3', fixed: A.b3 ? b3 : null });
    Object.assign(R, { BR1, BR2, BR3 });
    rep = sec('s113', 'other', 'Посадки и смазка');
    rep.h('1.13', 'Посадки деталей и сборочных единиц редуктора');
    TC.fitsSection(rep, ['внутренние кольца подшипников на валы — по полю допуска k6 (циркуляционное нагружение): ⌀d k6', 'наружные кольца в расточки корпуса — H7 (местное нагружение): ⌀D H7',
      'ступицы зубчатых колёс и деталей на выходных концах валов — H7/k6 или H7/p6', 'крышки подшипников — H7/d11', 'шпоночные пазы: вал — N9, ступица — Js9']);
    rep.h('1.14', 'Смазка зубчатых колёс и подшипников');
    rep.p('Зацепления смазываются окунанием (картерный способ) индустриальным маслом И-70А (ГОСТ 20799-88); колесо погружается в масло более чем на длину зуба. Радиально-упорные подшипники смазываются пластичной смазкой солидол УС-1, закладываемой в подшипниковые камеры при сборке; радиальный шарикоподшипник — маслом И-70А, разбрызгиваемым зубчатым колесом [[met|п. 1.14]].');
    R.oil = 'И-70А';
    rep = sec('s2', 'other', 'Подбор муфты');
    rep.h('2', 'Подбор муфты', 1);
    rep.p('Упругая втулочно-пальцевая муфта (МУВП) по ГОСТ 21424-93 соединяет выходной конец вала электродвигателя с быстроходным валом редуктора.');
    const cr = TC.couplingSection(rep, { T: T1B, Tsym: 'T_{1Б}', n: n1B, dm: mo.d1, dv: dB1, K: O.Kcoup, cp: M.couplingPick(Tc, mo.d1, dB1, n1B), O, kText: 'для подвесных конвейеров K = 1,5…2,0', fmUsed: !!O.Fm1 });
    R.cp = cr; R.sections = S;
    R.kpis = [['Двигатель', mo.type], ['uб / uт', fnum(gC.uf, 3) + ' / ' + fnum(gT.uf, 3)], ['de1 / mte', fnum(gC.de1) + ' / ' + fnum(gC.mte) + ' мм'], ['aw.т / m', fnum(gT.aw) + ' / ' + fnum(gT.m, 0) + ' мм'], ['σH кон.', fnum(cC.sH) + ' / ' + fnum(sHI) + ' МПа'], ['σH цил.', fnum(cT.sH) + ' / ' + fnum(sHII) + ' МПа']];
    R.summary = [['Двигатель', `${mo.type}, ${fnum(mo.P, 0)} кВт, ${mo.n} мин⁻¹`], ['Коническая ступень', `de1 = ${fnum(gC.de1)} мм, mte = ${fnum(gC.mte)} мм, z1/z2 = ${gC.z1}/${gC.z2}`], ['Цилиндрическая ступень', `aw = ${fnum(gT.aw)} мм, m = ${fnum(gT.m, 0)} мм, z1/z2 = ${gT.z1}/${gT.z2}`], ['Подшипники', `${(BR1 && BR1.b.id) || b1.id}, ${(BR2 && BR2.b.id) || b2.id}, ${(BR3 && BR3.b.id) || b3.id}`], ['Муфта', cr.code]];
    return R;
  }

  /* ---------- согласование (итерации без следов в отчёте) ---------- */
  function adjustGeneric(R, A, P, map) {
    const O = P.O;
    if (O.autoFix === false) return false;
    const brs = [['BR1', 'b1', 'dp1Up'], ['BR2', 'b2', 'dp2Up'], ['BR3', 'b3', 'dp3Up']];
    for (const [k, b, up_] of brs) { const br = R[k]; if (br && !br.ok) { A[up_] = (A[up_] || 0) + 1; A[b] = null; return true; } }
    for (const [k, b] of brs) { const br = R[k]; if (br && R[b] && br.b.id !== R[b].id) { A[b] = br.b.id; return true; } }
    if (R.ch1 && !R.ch1.ok) { A.dp1Up = (A.dp1Up || 0) + 1; return true; }
    if (R.ch2 && !R.ch2.ok) { A.dp2Up = (A.dp2Up || 0) + 1; return true; }
    if (R.ch3 && !R.ch3.ok) { A.dp3Up = (A.dp3Up || 0) + 1; return true; }
    for (const k of R.keys) {
      if (k.ok) continue;
      const m = map[k.joint]; if (!m) continue;
      const need = M.keyHubNeed({ d: k.d, T: m.T, sig: m.sig, exact: O.keyExact });
      if (m.hub && need && need <= Math.round(1.5 * k.d) && need > (A[m.hub] || 0)) { A[m.hub] = need; return true; }
      if (m.up && (A[m.up] || 0) < 2) { A[m.up] = (A[m.up] || 0) + 1; return true; }
      if (!A.two[k.joint]) { A.two[k.joint] = true; return true; }
    }
    return false;
  }
  function task6(P) {
    return TC.solve((P, A) => {
      const R = task6core(P, A);
      R.adjust = A2 => {
        const O = P.O, K = R.K;
        if (R.drum && R.drum.BR && !R.drum.BR.ok) { A2.dv4Up = (A2.dv4Up || 0) + 1; return true; }
        if (R.drum && R.drum.ch && !R.drum.ch.ok) { A2.dv4Up = (A2.dv4Up || 0) + 1; return true; }
        if (R.drum) for (const k of R.drum.keys) if (!k.ok) {
          const need = M.keyHubNeed({ d: k.d, T: K.TIV, sig: O.sCmSteel, exact: O.keyExact });
          const hub = k.joint === 'drum' ? 'lstb' : 'lz';
          if (need && need <= Math.round(1.6 * k.d) && need > (A2[hub] || 0)) { A2[hub] = need; return true; }
          if (!A2.two[k.joint]) { A2.two[k.joint] = true; return true; }
        }
        return adjustGeneric(R, A2, P, { coupling1: { T: K.TI, sig: O.sCmCI }, wheel2: { T: K.TII, sig: O.sCmSteel, hub: 'lst2' }, wheel4: { T: K.TIII, sig: O.sCmSteel, hub: 'lst4' }, sprocket: { T: K.TIII, sig: O.sCmSteel, hub: 'lv3', up: 'dv3Up' } });
      };
      return R;
    }, P);
  }
  function task1(P) {
    return TC.solve((P, A) => {
      const R = task1core(P, A);
      R.adjust = A2 => adjustGeneric(R, A2, P, { coupling1: { T: R.K.T1B, sig: P.O.sCmCI }, wheelC: { T: R.K.T1T, sig: P.O.sCmSteel, hub: 'lstC' }, wheelT: { T: R.K.T2T, sig: P.O.sCmSteel, hub: 'lstT' }, sprocket: { T: R.K.T2T, sig: P.O.sCmSteel, hub: 'l3', up: 'dv3Up' } });
      return R;
    }, P);
  }

  Object.assign(root.TASKS_CALC, { task1, task6, drumSection, housing1 });
})(typeof window !== 'undefined' ? window : globalThis);
