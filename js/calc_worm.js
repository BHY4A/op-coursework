/* calc_worm.js — червячная передача (задание 3): материалы, геометрия, силы, проверочные и тепловой расчёты */
(function (root) {
  'use strict';
  const D = root.DATA, F = root.F, M = root.MECH;
  const { n, nx, sq, fnum, interp, up, near, D2R } = F;
  const PI = Math.PI;

  function z1ByU(u) { return u <= 14 ? 4 : u <= 30 ? 2 : 1; }
  function fPrime(vs, O) {
    const lo = interp(D.WORM_F.vs, D.WORM_F.lo, vs), hi = interp(D.WORM_F.vs, D.WORM_F.hi, vs);
    let f = O.wormGround ? lo : hi;
    return { f, lo, hi };
  }
  function shTable(name, vs) { return interp(D.WORM_SH.vs, D.WORM_SH[name], vs); }

  /* ---------- 1.3: материалы и допускаемые напряжения ---------- */
  function materials(rep, o, O) {
    // o: { nI, TII, nII, tS, load, reverse }
    const R = {};
    const vsE = 4.5e-4 * o.nI * Math.cbrt(o.TII);
    rep.eq({ lhs: 'v_{s}', f: '4{,}5\\cdot 10^{-4}\\cdot n_{I}\\cdot \\sqrt[3]{T_{II}}', s: `4{,}5\\cdot 10^{-4}\\cdot ${n(o.nI)}\\cdot \\sqrt[3]{${n(o.TII)}}`, v: vsE, u: 'м/с', cmp: '\\approx', d: 'Ожидаемая скорость скольжения — от неё зависит выбор материала венца.' });
    let key = O.wormMat;
    if (!key || key === 'auto') key = vsE > 5 ? 'БрО10Ф1-' + (O.wormCast || 'П') : vsE >= 2 ? 'БрА9Ж3Л-' + (O.wormCast || 'П') : 'СЧ15';
    const mat = D.WORM_MAT[key];
    R.key = key; R.mat = mat; R.vsE = vsE;
    rep.p(`Червяк — сталь 45 с закалкой до твёрдости не менее HRC 45 и последующим шлифованием витков (HRC ≥ 45 повышает допускаемые напряжения пары [[ch|с. 58]]). ${mat.type === 'tin' ? (vsE > 5 ? 'Так как ожидаемая скорость скольжения больше 5 м/с, венец червячного колеса выполняется из оловянной бронзы' : O.vsHint ? `Ожидаемая скорость скольжения близка к 5 м/с, а при окончательных размерах передачи она достигает ${fnum(O.vsHint)} м/с (п. 1.5.1) — выше рекомендуемой для безоловянных бронз, поэтому венец червячного колеса выполняется из оловянной бронзы` : 'Для обеспечения высокой стойкости против заедания венец червячного колеса выполняется из оловянной бронзы') : mat.type === 'al' ? 'При скорости скольжения 2…5 м/с венец червячного колеса выполняется из безоловянной бронзы' : 'При скорости скольжения менее 2 м/с червячное колесо выполняется из серого чугуна'} ${mat.name} (отливка ${mat.cast}) [[met|п. 1.3.1]]. Механические характеристики [[ch|табл. 4.8]]: σ<sub>в</sub> = ${mat.sb} МПа${mat.st ? `, σ<sub>т</sub> = ${mat.st} МПа` : ''}.`);
    // ресурс и число циклов
    rep.h('1.3.2', 'Определение допускаемых контактных напряжений', 3);
    const N0 = 60 * o.nII * o.tS;
    rep.eq({ lhs: 'N_{HE}', f: '60\\cdot n_{II}\\cdot t_{\\Sigma}', s: `60\\cdot ${n(o.nII)}\\cdot ${n(o.tS)}`, v: N0, d: 'Число циклов нагружения зуба колеса за срок службы.' });
    let NH = N0, NF = N0;
    if (O.wormNe === 'load') {
      const kH = M.loadFactor(o.load, 4), kF = M.loadFactor(o.load, 9);
      NH = N0 * kH; NF = N0 * kF;
      rep.eq({ lhs: 'N_{H\\Sigma}', f: 'N_{HE}\\cdot \\sum\\left(\\dfrac{T_{i}}{T_{max}}\\right)^{4}\\dfrac{t_{i}}{t_{\\Sigma}}', s: `${n(N0)}\\cdot ${n(kH, 4)}`, v: NH, d: 'Эквивалентное число циклов при переменной нагрузке по графику нагрузки (показатель степени 4 — для KHL) [Ч, с. 60].', ref: ['ch', 'с. 60'] });
      rep.eq({ lhs: 'N_{F\\Sigma}', f: 'N_{HE}\\cdot \\sum\\left(\\dfrac{T_{i}}{T_{max}}\\right)^{9}\\dfrac{t_{i}}{t_{\\Sigma}}', s: `${n(N0)}\\cdot ${n(kF, 4)}`, v: NF, d: 'То же для KFL (показатель степени 9).' });
    }
    let sH, KHL = 1, Cv = O.Cv;
    if (mat.type === 'tin') {
      KHL = Math.pow(1e7 / NH, 1 / 8); let KHLc = Math.min(1.15, Math.max(0.67, KHL));
      const metOne = O.KHLmode !== 'ch' && NH > 1e7;
      if (metOne) KHLc = 1;
      rep.eq({ lhs: 'K_{HL}', f: '\\sqrt[8]{\\dfrac{10^{7}}{N_{HE}}}', s: `\\sqrt[8]{\\dfrac{10^{7}}{${n(NH)}}}`, v: KHL, raw: KHL !== KHLc ? `${n(KHL, 3)}\\ \\Rightarrow\\ ${n(KHLc, 3)}` : undefined, sig: 3, d: metOne ? 'Коэффициент долговечности; так как NHE > 10⁷, принимается KHL = 1 [М, п. 1.3.2].' : 'Коэффициент долговечности, ограничивается интервалом 0,67…1,15.' });
      KHL = KHLc;
      if (O.wormSH === 'ch') { const base = mat.hi[2]; sH = base * KHL; rep.eq({ lhs: '[\\sigma]_{H}', f: "[\\sigma]_{H}'\\cdot K_{HL}", s: `${base}\\cdot ${n(KHL, 3)}`, v: sH, u: 'МПа', d: 'Допускаемое контактное напряжение по табл. 4.8 [Ч] (червяк HRC ≥ 45).', ref: ['ch', 'табл. 4.8'] }); }
      else { sH = Cv * mat.sb * KHL; rep.eq({ lhs: '[\\sigma]_{H}', f: 'C_{v}\\cdot \\sigma_{в}\\cdot K_{HL}', s: `${nx(Cv)}\\cdot ${mat.sb}\\cdot ${n(KHL, 3)}`, v: sH, u: 'МПа', d: 'Допускаемое контактное напряжение для оловянной бронзы (Cv = 0,85…0,90 учитывает скорость скольжения).' }); }
    } else if (mat.type === 'al') {
      if (O.wormSH === 'ch') { sH = shTable(mat.name, vsE); rep.eq({ lhs: '[\\sigma]_{H}', raw: n(sH), u: 'МПа', d: `Допускаемое контактное напряжение из условия стойкости против заедания при vs = ${fnum(vsE)} м/с (табл. 4.9 [Ч], интерполяция).`, ref: ['ch', 'табл. 4.9'] }); }
      else { sH = O.sH0 - 25 * vsE; rep.eq({ lhs: '[\\sigma]_{H}', f: '[\\sigma]_{H0}-25\\cdot v_{s}', s: `${nx(O.sH0)}-25\\cdot ${n(vsE)}`, v: sH, u: 'МПа', d: 'Допускаемое контактное напряжение для безоловянной бронзы из условия стойкости против заедания ([σ]H0 = 250…300 МПа).' }); }
    } else {
      sH = shTable('СЧ10/СЧ15 (сталь 45)', vsE);
      rep.eq({ lhs: '[\\sigma]_{H}', raw: n(sH), u: 'МПа', d: 'Допускаемое контактное напряжение для чугунного колеса в паре со стальным червяком (табл. 4.9 [Ч]).', ref: ['ch', 'табл. 4.9'] });
    }
    // изгиб
    rep.h('1.3.3', 'Определение допускаемых напряжений изгиба', 3);
    let KFL = Math.pow(1e6 / NF, 1 / 9); const KFLc = Math.min(1, Math.max(0.543, KFL));
    if (mat.type === 'ci') KFL = 1;
    else { rep.eq({ lhs: 'K_{FL}', f: '\\sqrt[9]{\\dfrac{10^{6}}{N_{FE}}}', s: `\\sqrt[9]{\\dfrac{10^{6}}{${n(NF)}}}`, v: KFL, raw: KFL !== KFLc ? `${n(KFL, 3)}\\ \\Rightarrow\\ ${n(KFLc, 3)}` : undefined, sig: 3, d: 'Коэффициент долговечности при изгибе (NFE = NHE), ограничивается интервалом 0,54…1,0.' }); KFL = KFLc; }
    let sF;
    if (O.wormSF === 'ch' || mat.type === 'ci') {
      const base = o.reverse ? mat.hi[1] : mat.hi[0];
      sF = base * KFL;
      rep.eq({ lhs: '[\\sigma]_{F}', f: o.reverse ? "[\\sigma_{-1F}]'\\cdot K_{FL}" : "[\\sigma_{0F}]'\\cdot K_{FL}", s: `${base}\\cdot ${n(KFL, 3)}`, v: sF, u: 'МПа', d: `Допускаемое напряжение изгиба по табл. 4.8 [Ч] (${o.reverse ? 'реверсивная работа — зубья работают обеими сторонами' : 'нереверсивная работа'}).`, ref: ['ch', 'табл. 4.8'] });
    } else {
      const k = O.kSF;
      sF = k * mat.sb * KFL * (o.reverse ? 0.8 : 1);
      rep.eq({ lhs: '[\\sigma]_{F}', f: (o.reverse ? '0{,}8\\cdot ' : '') + `${nx(k)}\\cdot \\sigma_{в}\\cdot K_{FL}`, s: (o.reverse ? '0{,}8\\cdot ' : '') + `${nx(k)}\\cdot ${mat.sb}\\cdot ${n(KFL, 3)}`, v: sF, u: 'МПа', d: `Допускаемое напряжение изгиба для бронзы ((0,25…0,3)·σв·KFL)${o.reverse ? '; при реверсивной работе снижено на 20 %' : ''}.` });
    }
    Object.assign(R, { sH, sF, KHL, KFL, NH, NF, N0, Cv });
    return R;
  }

  /* ---------- 1.4: геометрия и силы ---------- */
  function geometry(rep, o, O, mat) {
    // o: { u, TII, TI, Kpre }
    const R = {};
    rep.h('1.4.1', 'Выбор числа заходов червяка и числа зубьев червячного колеса', 3);
    const z1 = O.z1 || z1ByU(o.u);
    rep.p(`При <i>u</i><sub>ч</sub> = ${fnum(o.u, 0)} принимаем число заходов червяка <i>z</i><sub>1</sub> = ${z1} [[met|п. 1.4.1]].`);
    const z2r = z1 * o.u, z2 = Math.round(z2r);
    rep.eq({ lhs: 'z_{2}', f: 'z_{1}\\cdot u_{ч}', s: `${z1}\\cdot ${n(o.u)}`, v: z2r, raw: z2r === z2 ? undefined : `${n(z2r)}\\ \\Rightarrow\\ ${z2}`, d: 'Число зубьев червячного колеса (рекомендуется 28…80).' });
    rep.check(`28\\le z_{2}=${z2}\\le 80`, z2 >= 28 && z2 <= 80, '');
    const uf = z2 / z1;
    rep.eq({ lhs: 'u_{ч.факт}', f: '\\dfrac{z_{2}}{z_{1}}', s: `\\dfrac{${z2}}{${z1}}`, v: uf, d: 'Фактическое передаточное отношение червячной пары.' });
    rep.h('1.4.2', 'Выбор коэффициента диаметра червяка и определение межосевого расстояния', 3);
    let q = O.q || near(0.25 * z2, [8, 10, 12.5, 16, 20]);
    rep.eq({ lhs: 'q', f: '(0{,}25\\ldots 0{,}4)\\cdot z_{2}', s: `(0{,}25\\ldots 0{,}4)\\cdot ${z2}`, raw: `${n(0.25 * z2)}\\ldots ${n(0.4 * z2)}\\ \\Rightarrow\\ ${nx(q)}`, d: 'Коэффициент диаметра червяка по ГОСТ 2144-76 (табл. 4.2 [Ч]); меньшие значения повышают КПД, большие — жёсткость червяка.' });
    const K = o.Kpre;
    let awr;
    if (O.wormAw === 'met') {
      awr = 610 * (z2 + q) * Math.cbrt(o.TII * K / (q * Math.pow(o.sH * 1e6, 2))) * 1000;
      rep.eq({ lhs: 'a_{w}', f: 'K_{a}\\cdot(z_{2}+q)\\cdot \\sqrt[3]{\\dfrac{T_{II}\\cdot K_{H\\beta}}{q\\cdot [\\sigma]_{H}^{2}}}', s: `610\\cdot(${z2}+${nx(q)})\\cdot \\sqrt[3]{\\dfrac{${n(o.TII)}\\cdot ${nx(K)}}{${nx(q)}\\cdot(${n(o.sH)}\\cdot 10^{6})^{2}}}`, v: awr, u: 'мм', cmp: '\\ge', d: 'Межосевое расстояние по формуле методички (Ka = 610; момент в Н·м, напряжение в Па).' });
    } else {
      const k = z2 / q;
      awr = (k + 1) * Math.cbrt(Math.pow(170 / (k * o.sH), 2) * o.TII * 1e3 * K);
      rep.eq({ lhs: 'a_{w}', f: '\\left(\\dfrac{z_{2}}{q}+1\\right)\\sqrt[3]{\\left(\\dfrac{170}{\\dfrac{z_{2}}{q}[\\sigma]_{H}}\\right)^{2}T_{II}\\cdot 10^{3}\\cdot K}', s: `\\left(\\dfrac{${z2}}{${nx(q)}}+1\\right)\\sqrt[3]{\\left(\\dfrac{170}{\\dfrac{${z2}}{${nx(q)}}\\cdot ${n(o.sH)}}\\right)^{2}\\cdot ${n(o.TII)}\\cdot 10^{3}\\cdot ${nx(K)}}`, v: awr, u: 'мм', cmp: '\\ge', d: 'Межосевое расстояние из условия контактной выносливости (формула 4.19 [Ч]; момент — в Н·мм, предварительно K = 1,2).', ref: ['ch', 'формула (4.19)'] });
    }
    const forced = O.awMin && O.awMin > awr + 1e-9;
    let awStd = up(forced ? O.awMin : awr, D.STD.aww);
    const mBase = O.wormAwRound === 'calc' && !forced ? awr : awStd;
    if (forced) rep.p(`С учётом проверочного расчёта на контактную выносливость (п. 1.5) принимаем ближайшее большее значение по ГОСТ 2144-76 [[met|п. 1.4.2]], обеспечивающее условие σ<sub>H</sub> ≤ [σ]<sub>H</sub> при уточнённых значениях скорости скольжения и коэффициента нагрузки: <i>a</i><sub>w</sub> = ${awStd} мм.`);
    else if (O.wormAwRound !== 'calc') rep.p(`Округляем до ближайшего большего стандартного значения по ГОСТ 2144-76 [[met|п. 1.4.2]]: <i>a</i><sub>w</sub> = ${awStd} мм.`);
    rep.h('1.4.3', 'Расчёт модуля зацепления и геометрии червячной пары', 3);
    const mr = 2 * mBase / (z2 + q);
    const mods = Object.keys(D.WORM_MQ).map(Number).sort((a, b) => a - b);
    let m = O.wormMUp || forced ? up(mr - 1e-9, mods) : near(mr, mods);
    if (!D.WORM_MQ[m].includes(q)) q = near(q, D.WORM_MQ[m]);
    if (forced) while (0.5 * m * (z2 + q) < O.awMin - 0.5 && mods.indexOf(m) < mods.length - 1) { m = mods[mods.indexOf(m) + 1]; if (!D.WORM_MQ[m].includes(q)) q = near(q, D.WORM_MQ[m]); }
    rep.eq({ lhs: 'm', f: `\\dfrac{2\\cdot a_{w}}{z_{2}+q}`, s: `\\dfrac{2\\cdot ${n(mBase)}}{${z2}+${nx(q)}}`, v: mr, raw: `${n(mr)}\\ \\Rightarrow\\ ${nx(m)}`, u: 'мм', d: 'Модуль зацепления, округляется до стандартного по ГОСТ 2144-76 с проверкой сочетания m и q (табл. 4.2 [Ч]).', ref: ['ch', 'табл. 4.2'] });
    const aw = 0.5 * m * (z2 + q);
    rep.eq({ lhs: 'a_{w}', f: '0{,}5\\cdot m\\cdot(z_{2}+q)', s: `0{,}5\\cdot ${nx(m)}\\cdot(${z2}+${nx(q)})`, v: aw, u: 'мм', d: 'Межосевое расстояние при стандартных m и q.' });
    const d1 = q * m, da1 = d1 + 2 * m, df1 = d1 - 2.4 * m;
    let b1r = z1 <= 2 ? (11 + 0.06 * z2) * m : (12.5 + 0.09 * z2) * m, b1add = O.wormGround ? (m < 10 ? 25 : m <= 16 ? 35 : 50) : 0;
    const b1 = Math.round(b1r + b1add);
    const gam = Math.atan(z1 / q) / D2R;
    const d2 = m * z2, da2 = d2 + 2 * m, df2 = d2 - 2.4 * m, daM2 = Math.floor(da2 + 6 * m / (z1 + 2));
    const b2 = Math.floor(z1 <= 3 ? 0.75 * da1 : 0.67 * da1);
    rep.eq({ lhs: 'b_{1}', f: z1 <= 2 ? '(11+0{,}06\\cdot z_{2})\\cdot m' + (b1add ? `+${b1add}` : '') : '(12{,}5+0{,}09\\cdot z_{2})\\cdot m' + (b1add ? `+${b1add}` : ''), s: (z1 <= 2 ? `(11+0{,}06\\cdot ${z2})\\cdot ${nx(m)}` : `(12{,}5+0{,}09\\cdot ${z2})\\cdot ${nx(m)}`) + (b1add ? `+${b1add}` : ''), v: b1r + b1add, raw: `${n(b1r + b1add)}\\ \\Rightarrow\\ ${b1}`, u: 'мм', cmp: '\\ge', d: `Длина нарезанной части червяка${b1add ? ' (для шлифуемого червяка увеличена на ' + b1add + ' мм, [Ч] с. 50)' : ''}.` });
    rep.eq({ lhs: '\\gamma', f: '\\operatorname{arctg}\\dfrac{z_{1}}{q}', s: `\\operatorname{arctg}\\dfrac{${z1}}{${nx(q)}}`, v: gam, raw: F.deg(gam), d: 'Делительный угол подъёма линии витка.' });
    rep.table('Основные размеры червяка и червячного колеса', ['Параметр', 'Червяк', 'Колесо'], [
      ['Число заходов / зубьев', z1, z2], ['Делительный диаметр, мм', `d₁ = q·m = ${fnum(d1)}`, `d₂ = m·z₂ = ${fnum(d2)}`],
      ['Диаметр вершин, мм', `da₁ = d₁ + 2m = ${fnum(da1)}`, `da₂ = d₂ + 2m = ${fnum(da2)}`], ['Диаметр впадин, мм', `df₁ = d₁ − 2,4m = ${fnum(df1)}`, `df₂ = d₂ − 2,4m = ${fnum(df2)}`],
      ['Наибольший диаметр колеса, мм', '—', `daM₂ ≤ da₂ + 6m/(z₁+2) = ${daM2}`], ['Длина нарезанной части / ширина венца, мм', `b₁ = ${b1}`, `b₂ ≤ ${z1 <= 3 ? '0,75' : '0,67'}·da₁ = ${b2}`]]);
    // силы
    rep.h('1.4.4', 'Определение сил, действующих в червячном зацеплении', 3);
    const Ft2 = 2000 * o.TII / d2, Ft1 = 2000 * o.TI / d1, Fr = Ft2 * Math.tan(20 * D2R) / Math.cos(gam * D2R);
    rep.eq({ lhs: 'F_{t2}=F_{a1}', f: '\\dfrac{2000\\cdot T_{II}}{d_{2}}', s: `\\dfrac{2000\\cdot ${n(o.TII)}}{${n(d2)}}`, v: Ft2, u: 'Н', d: 'Окружная сила на колесе равна осевой силе на червяке.' });
    rep.eq({ lhs: 'F_{t1}=F_{a2}', f: '\\dfrac{2000\\cdot T_{I}}{d_{1}}', s: `\\dfrac{2000\\cdot ${n(o.TI)}}{${n(d1)}}`, v: Ft1, u: 'Н', d: 'Окружная сила на червяке равна осевой силе на колесе.' });
    rep.eq({ lhs: 'F_{r}', f: 'F_{t2}\\cdot \\dfrac{\\operatorname{tg}\\alpha_{n}}{\\cos\\gamma}', s: `${n(Ft2)}\\cdot \\dfrac{\\operatorname{tg}20^{\\circ}}{\\cos ${F.deg(gam)}}`, v: Fr, u: 'Н', d: 'Радиальная сила, одинаковая для червяка и колеса.' });
    Object.assign(R, { z1, z2, uf, q, K, awr, awStd, mr, m, aw, d1, da1, df1, b1, gam, d2, da2, df2, daM2, b2, Ft1, Ft2, Fr, Ra: 0.5 * d1 - m, Rf: 0.5 * d1 + 1.2 * m });
    return R;
  }

  /* ---------- 1.5: скорость скольжения, КПД, проверки ---------- */
  function check(rep, g, o, O, mt) {
    // o: { nI, TII, etaPre, x (для Kβ), mat }
    const R = {};
    const vs = PI * g.d1 * o.nI / (60000 * Math.cos(g.gam * D2R));
    rep.eq({ lhs: 'v_{s}', f: '\\dfrac{\\pi\\cdot d_{1}\\cdot n_{I}}{60000\\cdot \\cos\\gamma}', s: `\\dfrac{\\pi\\cdot ${n(g.d1)}\\cdot ${n(o.nI)}}{60000\\cdot \\cos ${F.deg(g.gam)}}`, v: vs, u: 'м/с', d: 'Фактическая скорость скольжения витков червяка по зубьям колеса.' });
    const fp = fPrime(vs, O); let f = fp.f; const nonTin = mt.mat.type !== 'tin';
    if (nonTin) f *= O.fNonTin;
    const phi = Math.atan(f) / D2R;
    rep.p(`По [[ch|табл. 4.4]] при <i>v</i><sub>s</sub> = ${fnum(vs)} м/с приведённый коэффициент трения <i>f</i>′ = ${fnum(fp.lo, 3)}…${fnum(fp.hi, 3)}; для ${O.wormGround ? 'шлифованного червяка принимаем меньшее значение' : 'нешлифованного червяка — большее значение'}${nonTin ? `, для венца из ${mt.mat.type === 'al' ? 'безоловянной бронзы' : 'чугуна'} табличное значение увеличиваем в ${fnum(O.fNonTin, 0)} раза` : ''}: <i>f</i>′ = ${fnum(f, 3)}, φ′ = arctg <i>f</i>′ = ${F.degTxt(phi)}.`);
    const eta = Math.tan(g.gam * D2R) / Math.tan((g.gam + phi) * D2R);
    rep.eq({ lhs: '\\eta_{ч}', f: "\\dfrac{\\operatorname{tg}\\gamma}{\\operatorname{tg}(\\gamma+\\varphi')}", s: `\\dfrac{\\operatorname{tg}${F.deg(g.gam)}}{\\operatorname{tg}(${F.deg(g.gam)}+${F.deg(phi)})}`, v: eta, sig: 3, d: 'Уточнённый КПД червячного зацепления.' });
    const dEta = Math.abs(eta - o.etaPre) / o.etaPre * 100;
    R.dEta = dEta;
    rep.p(`Уточнённый КПД отличается от принятого в п. 1.2.1 (η<sub>ч</sub> = ${fnum(o.etaPre, 0)}) на ${fnum(dEta, 3)} %${dEta > 5 ? ' — более 5 %, поэтому мощности, моменты и силы пересчитываются (п. 1.5.2)' : ' — менее 5 %, пересчёт силовых параметров не требуется'}.`);
    // уточнённое [σH]
    let sH = mt.sH;
    if (mt.mat.type === 'al') {
      sH = O.wormSH === 'ch' ? shTable(mt.mat.name, vs) : O.sH0 - 25 * vs;
      rep.eq({ lhs: '[\\sigma]_{H}', f: O.wormSH === 'ch' ? undefined : '[\\sigma]_{H0}-25\\cdot v_{s}', s: O.wormSH === 'ch' ? undefined : `${nx(O.sH0)}-25\\cdot ${n(vs)}`, v: sH, u: 'МПа', d: 'Допускаемое контактное напряжение уточняется по фактической скорости скольжения.' });
    } else if (mt.mat.type === 'ci') { sH = shTable('СЧ10/СЧ15 (сталь 45)', vs); rep.eq({ lhs: '[\\sigma]_{H}', raw: n(sH), u: 'МПа', d: 'Уточнённое по vs (табл. 4.9 [Ч]).' }); }
    Object.assign(R, { vs, f, phi, eta, sH });
    return R;
  }
  function stress(rep, g, o, O, mt, ck) {
    // o: { TII (уточн.), x, Ft2 }
    const R = {};
    const vs = ck.vs;
    rep.h('1.5.2', 'Проверочный расчёт на контактную выносливость', 3);
    let deg = O.wormDeg && O.wormDeg !== 'auto' ? +O.wormDeg : (vs <= 3 ? 8 : 7);
    const kvIdx = vs <= 1.5 ? 0 : vs <= 3 ? 1 : vs <= 7.5 ? 2 : 3;
    let Kv = D.WORM_KV[deg][kvIdx]; if (Kv == null) { deg = deg === 9 ? 8 : 7; Kv = D.WORM_KV[deg][kvIdx]; }
    rep.p(`По [[ch|табл. 4.7]] при <i>v</i><sub>s</sub> = ${fnum(vs)} м/с назначаем ${deg}-ю степень точности передачи; коэффициент динамичности <i>K</i><sub>v</sub> = ${fnum(Kv, 0)}.`);
    const th = interp(D.WORM_THETA.q, D.WORM_THETA[g.z1], g.q);
    const metK = O.wormSHcheck === 'met';
    const Kb = metK ? g.K : 1 + Math.pow(g.z2 / th, 3) * (1 - o.x);
    if (metK) rep.eq({ lhs: 'K_{H\\beta}', raw: nx(Kb), d: 'Коэффициент неравномерности распределения нагрузки — принятый в п. 1.4.2 (KHβ ≈ 1,1…1,4); при изгибе KFβ ≈ KHβ [М, п. 1.5].', ref: ['met', 'п. 1.4.2'] });
    else rep.eq({ lhs: 'K_{\\beta}', f: '1+\\left(\\dfrac{z_{2}}{\\theta}\\right)^{3}(1-x)', s: `1+\\left(\\dfrac{${g.z2}}{${nx(th)}}\\right)^{3}(1-${n(o.x, 3)})`, v: Kb, sig: 3, d: `Коэффициент концентрации нагрузки; θ = ${fnum(th, 0)} — по табл. 4.6 [Ч] при z1 = ${g.z1}, q = ${fnum(g.q, 0)}; x — ${O.xLoad === 'load' ? 'по графику нагрузки, формула (4.27)' : 'принят для незначительных колебаний нагрузки'}.`, ref: ['ch', 'табл. 4.6'] });
    const K = Kb * Kv;
    rep.eq({ lhs: 'K', f: metK ? 'K_{H\\beta}\\cdot K_{HV}' : 'K_{\\beta}\\cdot K_{v}', s: `${n(Kb, 3)}\\cdot ${nx(Kv)}`, v: K, sig: 3, d: 'Коэффициент нагрузки червячной передачи.' });
    let sigH;
    if (O.wormSHcheck === 'met') {
      const Zh = Math.sqrt(2 * Math.cos(g.gam * D2R) / Math.sin(40 * D2R));
      rep.eq({ lhs: 'Z_{h}', f: '\\sqrt{\\dfrac{2\\cos\\gamma}{\\sin 2\\alpha_{n}}}', s: `\\sqrt{\\dfrac{2\\cos ${F.deg(g.gam)}}{\\sin 40^{\\circ}}}`, v: Zh, sig: 3 });
      rep.p(`Коэффициент, учитывающий механические свойства пары «сталь – бронза»: <i>Z</i><sub>E</sub> = √(<i>E</i><sub>пр</sub>/(π(1 − ν²))) = √(1,32·10⁵/(π·(1 − 0,3²))) = ${fnum(O.ZE, 3)} МПа<sup>½</sup> (приведённый модуль упругости <i>E</i><sub>пр</sub> ≈ 1,32·10⁵ МПа для пар «сталь – бронза» и «сталь – чугун», ν = 0,3 [[ch|с. 26, 53]]).`);
      sigH = O.ZE * Zh * Math.sqrt(o.Ft2 * K / (g.d2 * g.b2 * Math.cos(g.gam * D2R)));
      rep.eq({ lhs: '\\sigma_{H}', f: 'Z_{E}\\cdot Z_{h}\\cdot \\sqrt{\\dfrac{F_{t2}\\cdot K_{v}\\cdot K_{\\beta}}{d_{2}\\cdot b_{2}\\cdot \\cos\\gamma}}', s: `${n(O.ZE, 3)}\\cdot ${n(Zh, 3)}\\cdot \\sqrt{\\dfrac{${n(o.Ft2)}\\cdot ${nx(Kv)}\\cdot ${n(Kb, 3)}}{${n(g.d2)}\\cdot ${g.b2}\\cdot \\cos ${F.deg(g.gam)}}}`, v: sigH, u: 'МПа', d: 'Расчётное контактное напряжение (формула методички).' });
    } else {
      const k = g.z2 / g.q;
      sigH = 170 / k * Math.sqrt(o.TII * 1e3 * K * Math.pow(k + 1, 3) / Math.pow(g.aw, 3));
      rep.eq({ lhs: '\\sigma_{H}', f: '\\dfrac{170}{z_{2}/q}\\sqrt{\\dfrac{T_{II}\\cdot 10^{3}\\cdot K\\left(\\dfrac{z_{2}}{q}+1\\right)^{3}}{a_{w}^{3}}}', s: `\\dfrac{170}{${g.z2}/${nx(g.q)}}\\sqrt{\\dfrac{${n(o.TII)}\\cdot 10^{3}\\cdot ${n(K, 3)}\\cdot\\left(\\dfrac{${g.z2}}{${nx(g.q)}}+1\\right)^{3}}{${n(g.aw)}^{3}}}`, v: sigH, u: 'МПа', d: 'Расчётное контактное напряжение (формула 4.23 [Ч]).', ref: ['ch', 'формула (4.23)'] });
    }
    const over = (sigH / ck.sH - 1) * 100;
    rep.check(`\\sigma_{H}=${n(sigH)}\\ \\text{МПа}\\ ${sigH <= ck.sH ? '\\le' : '>'}\\ [\\sigma]_{H}=${n(ck.sH)}\\ \\text{МПа}`, over <= 5 && over >= -15 || sigH <= ck.sH, sigH <= ck.sH ? `Недогрузка ${fnum(-over, 3)} %${-over > 15 ? ' (более 15 % — передача недогружена, но размеры ограничены стандартным рядом)' : ' — допустима (до 15 % [Ч, с. 55])'}.` : over <= 5 ? `Перегрузка ${fnum(over, 3)} % допустима (до 5 %).` : `Перегрузка ${fnum(over, 3)} % — необходимо увеличить aw.`);
    const zv = g.z2 / Math.pow(Math.cos(g.gam * D2R), 3), YF = interp(D.WORM_YF.z, D.WORM_YF.v, zv);
    rep.h('1.5.3', 'Проверочный расчёт зубьев колеса на изгибную выносливость', 3);
    rep.eq({ lhs: 'z_{v}', f: '\\dfrac{z_{2}}{\\cos^{3}\\gamma}', s: `\\dfrac{${g.z2}}{\\cos^{3}${F.deg(g.gam)}}`, v: zv, d: 'Эквивалентное число зубьев червячного колеса.' });
    rep.p(`Коэффициент формы зуба по [[ch|табл. 4.5]]: <i>Y</i><sub>F2</sub> = ${fnum(YF, 3)}.`);
    let sigF;
    if (O.wormSFcheck === 'ch') {
      const xi = 1.0;
      sigF = 1.2 * o.TII * 1e3 * K * YF * xi / (g.z2 * g.b2 * g.m * g.m);
      rep.eq({ lhs: '\\sigma_{F}', f: '\\dfrac{1{,}2\\cdot T_{II}\\cdot 10^{3}\\cdot K\\cdot Y_{F}\\cdot \\xi}{z_{2}\\cdot b_{2}\\cdot m^{2}}', s: `\\dfrac{1{,}2\\cdot ${n(o.TII)}\\cdot 10^{3}\\cdot ${n(K, 3)}\\cdot ${n(YF, 3)}\\cdot 1}{${g.z2}\\cdot ${g.b2}\\cdot ${nx(g.m)}^{2}}`, v: sigF, u: 'МПа', d: 'Напряжение изгиба зубьев колеса (формула 4.24 [Ч], ξ = 1 для закрытых передач).' });
    } else {
      const Yb = 1 - g.gam / 140;
      rep.eq({ lhs: 'Y_{\\beta}', f: '1-\\dfrac{\\gamma^{\\circ}}{140^{\\circ}}', s: `1-\\dfrac{${n(g.gam)}}{140}`, v: Yb, sig: 3, d: 'Коэффициент, учитывающий наклон зуба.' });
      sigF = o.Ft2 / (g.m * g.b2) * YF * Yb * Kv * Kb;
      rep.eq({ lhs: '\\sigma_{F}', f: '\\dfrac{F_{t2}}{m\\cdot b_{2}}\\cdot Y_{F2}\\cdot Y_{\\beta}\\cdot K_{Fv}\\cdot K_{F\\beta}', s: `\\dfrac{${n(o.Ft2)}}{${nx(g.m)}\\cdot ${g.b2}}\\cdot ${n(YF, 3)}\\cdot ${n(Yb, 3)}\\cdot ${nx(Kv)}\\cdot ${n(Kb, 3)}`, v: sigF, u: 'МПа', d: 'Напряжение изгиба в опасном сечении зуба колеса (KFv ≈ Kv, KFβ ≈ Kβ).' });
    }
    rep.check(`\\sigma_{F}=${n(sigF)}\\ \\text{МПа}\\ ${sigF <= mt.sF ? '\\le' : '>'}\\ [\\sigma]_{F}=${n(mt.sF)}\\ \\text{МПа}`, sigF <= mt.sF, sigF <= mt.sF ? 'Изгибная прочность зубьев колеса обеспечена.' : 'Изгибная прочность не обеспечена — требуется увеличить модуль (межосевое расстояние).');
    Object.assign(R, { deg, Kv, th, Kb, K, sigH, over, zv, YF, sigF });
    return R;
  }

  /* ---------- 1.7: тепловой расчёт ---------- */
  function thermal(rep, o, O) {
    const R = {};
    const Pp = o.PI * (1 - o.eta);
    rep.eq({ lhs: 'P_{пот}', f: 'P_{I}\\cdot(1-\\eta_{ч})', s: `${n(o.PI)}\\cdot(1-${n(o.eta, 3)})`, v: Pp, u: 'кВт', d: 'Мощность, превращающаяся в теплоту.' });
    const A = 9e-5 * Math.pow(o.aw, 1.85);
    rep.eq({ lhs: 'A', f: '9\\cdot 10^{-5}\\cdot a_{w}^{1{,}85}', s: `9\\cdot 10^{-5}\\cdot ${n(o.aw)}^{1{,}85}`, v: A, u: 'м²', d: 'Площадь теплоотдающей поверхности корпуса.' });
    const tm = Kr => O.t0 + 1000 * Pp / (O.Kt * A * Kr * (1 + O.psiT));
    let Kr = O.Kreb === 'auto' ? [1, 1.2, 1.5, 1.7].find(k => tm(k) <= O.tmax) || 1.7 : +O.Kreb;
    const Aef = A * Kr;
    if (Kr > 1) rep.eq({ lhs: 'A_{эфф}', f: 'A\\cdot K_{реб}', s: `${n(A)}\\cdot ${nx(Kr)}`, v: Aef, u: 'м²', d: 'Эффективная площадь с учётом рёбер охлаждения на корпусе.' });
    const t = tm(Kr);
    rep.eq({ lhs: 't_{м}', f: `t_{0}+\\dfrac{1000\\cdot P_{пот}}{K_{t}\\cdot ${Kr > 1 ? 'A_{эфф}' : 'A'}\\cdot(1+\\psi)}`, s: `${nx(O.t0)}+\\dfrac{1000\\cdot ${n(Pp)}}{${nx(O.Kt)}\\cdot ${n(Aef)}\\cdot(1+${nx(O.psiT)})}`, v: t, u: '°C', d: 'Установившаяся температура масла в корпусе.' });
    rep.check(`t_{м}=${n(t)}\\ ^{\\circ}\\text{C}\\ ${t <= O.tmax ? '\\le' : '>'}\\ [t_{м}]=${O.tmax}\\ ^{\\circ}\\text{C}`, t <= O.tmax, t <= O.tmax ? (Kr > 1 ? 'Тепловой режим обеспечивается при оребрении корпуса.' : 'Тепловой режим редуктора допустим, дополнительное охлаждение не требуется.') : 'Требуется обдув корпуса вентилятором на валу червяка.');
    Object.assign(R, { Pp, A, Kr, Aef, t });
    return R;
  }

  root.WORM = { z1ByU, materials, geometry, check, stress, thermal, fPrime };
})(typeof window !== 'undefined' ? window : globalThis);
