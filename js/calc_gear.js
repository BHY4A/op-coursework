/* calc_gear.js — зубчатые (цилиндрические, конические) и червячная передачи */
(function (root) {
  'use strict';
  const D = root.DATA, F = root.F;
  const { n, nx, sq, fnum, interp, up, near, D2R } = F;
  const PI = Math.PI, TG20 = Math.tan(20 * D2R);

  const awList = O => O.awRow === 1 ? D.STD.aw1 : D.STD.aw1.concat(D.STD.aw2).sort((a, b) => a - b);
  function khb(psi, col, hard) { const t = D.KHB[hard ? 'hard' : 'soft'][col]; return interp(D.KHB.psi, t, psi); }
  function kfb(psi, col, hard) { const t = D.KFB[hard ? 'hard' : 'soft'][col]; return interp(D.KFB.psi, t, psi); }
  function kfv(deg, v, hard) { const d = Math.min(8, Math.max(6, deg)); const row = D.KFV[d][hard ? 'hard' : 'soft']; const i = v <= 3 ? 0 : v <= 8 ? 1 : 2; return row[i][0] || row[Math.max(0, i - 1)][0]; }
  function yf(z) { return interp(D.YF.z, D.YF.v, z); }
  function precisionCyl(v) { return v <= 2 ? 9 : v <= 6 ? 8 : 7; }

  /* ---------- допускаемые напряжения зубчатых колёс по [М] п. 1.3 ---------- */
  function allowGear(rep, o) {
    // o: { title, mat, n, nsym, tch, label }
    const M = D.GEARMAT[o.mat];
    rep.p(`<b>${o.title}:</b> ${M.name}, ${M.ht} (${M.hard}). Справочные данные [[met|п. 1.3]]: σ<sub>HP0</sub> = ${M.sHP0} МПа, <i>N</i><sub>H0</sub> = ${fnum(M.NH0, 3)}, σ<sub>FP0</sub> = ${M.sFP0} МПа, <i>N</i><sub>F0</sub> = ${fnum(M.NF0, 3)}.`);
    const NHE = 60 * o.tch * o.n;
    rep.eq({ lhs: `N_{HE${o.label}}`, f: `60\\cdot t_{ч}\\cdot ${o.nsym}`, s: `60\\cdot ${n(o.tch)}\\cdot ${n(o.n)}`, v: NHE, d: 'Эквивалентное число циклов напряжений (NHE = NFE).' });
    const KHL = NHE >= M.NH0 ? 1 : Math.pow(M.NH0 / NHE, 1 / 6), KFL = NHE >= M.NF0 ? 1 : Math.pow(M.NF0 / NHE, 1 / 6);
    rep.p(`Так как <i>N</i><sub>HE</sub> = ${fnum(NHE, 3)} ${NHE >= M.NH0 ? '&gt;' : '&lt;'} <i>N</i><sub>H0</sub>${NHE >= M.NF0 ? ' и <i>N</i><sub>FE</sub> &gt; <i>N</i><sub>F0</sub>' : ''}, принимаем <i>K</i><sub>HL</sub> = ${fnum(KHL, 3)}, <i>K</i><sub>FL</sub> = ${fnum(KFL, 3)}.`);
    const sH = M.sHP0 * KHL, sF = M.sFP0 * KFL;
    rep.eq({ lhs: `\\sigma_{HP${o.label}}`, f: '\\sigma_{HP0}\\cdot K_{HL}', s: `${M.sHP0}\\cdot ${n(KHL, 3)}`, v: sH, u: 'МПа', d: 'Допускаемое контактное напряжение.' });
    rep.eq({ lhs: `\\sigma_{FP${o.label}}`, f: '\\sigma_{FP0}\\cdot K_{FL}', s: `${M.sFP0}\\cdot ${n(KFL, 3)}`, v: sF, u: 'МПа', d: 'Допускаемое напряжение изгиба.' });
    return { mat: M, NHE, KHL, KFL, sH, sF };
  }

  /* ---------- цилиндрическая прямозубая ступень [М] 1.4.2 / 1.5.2 / 1.6.2 ---------- */
  function cylStage(rep, o, O) {
    // o: { st: {p:'1',w:'2'} индексы колёс, T (момент для aw), Tsym, Tw (момент колеса), Twsym, n1, n1sym, u, usym, sH (доп.), sHsym, psiba, col, colF, hard, sF1, sF2, label, nsym }
    const R = {};
    let psiba = o.psiba;
    rep.eq({ lhs: '\\psi_{ba}', raw: nx(psiba), d: 'Коэффициент ширины венца по межосевому расстоянию — из рекомендуемого ряда ГОСТ 2185-66 для редукторов.', ref: ['ch', 'с. 31'] });
    const psibd = 0.5 * psiba * (o.u + 1);
    rep.eq({ lhs: '\\psi_{bd}', f: `0{,}5\\cdot \\psi_{ba}\\cdot(${o.usym}+1)`, s: `0{,}5\\cdot ${nx(psiba)}\\cdot(${n(o.u)}+1)`, v: psibd, sig: 3, d: 'Коэффициент ширины венца по диаметру шестерни — аргумент таблицы коэффициентов концентрации нагрузки.' });
    const KHb = khb(psibd, o.col, o.hard);
    rep.eq({ lhs: 'K_{H\\beta}', raw: n(KHb, 3), d: `Коэффициент неравномерности распределения нагрузки по ширине венца при ${o.col === 'III' ? 'симметричном' : o.col === 'II' ? 'несимметричном' : 'консольном'} расположении колёс относительно опор, HB ${o.hard ? '>' : '≤'} 350 (линейная интерполяция по табл. 3.5 [Ч]).`, ref: ['ch', 'табл. 3.5'] });
    const Ka = 4950;
    const awr = Ka * (o.u + 1) * Math.cbrt(o.T * KHb / (o.u * psiba * Math.pow(o.sH * 1e6, 2)));
    rep.eq({ lhs: `a_{w${o.label}}`, f: `K_{a}\\cdot(${o.usym}+1)\\cdot \\sqrt[3]{\\dfrac{${o.Tsym}\\cdot K_{H\\beta}}{${o.usym}\\cdot \\psi_{ba}\\cdot ${o.sHsym}^{2}}}`, s: `4950\\cdot(${n(o.u)}+1)\\cdot \\sqrt[3]{\\dfrac{${n(o.T)}\\cdot ${n(KHb, 3)}}{${n(o.u)}\\cdot ${nx(psiba)}\\cdot(${n(o.sH)}\\cdot 10^{6})^{2}}}`, v: awr * 1000, u: 'мм', cmp: '\\ge', d: 'Межосевое расстояние из условия контактной выносливости (Ka = 4950 Па^⅓ для стальных прямозубых колёс; момент — в Н·м, напряжение — в Па, результат переведён в мм).' });
    const list = awList(O);
    let aw = up(awr * 1000, list), tries = 0;
    const deg2 = x => x;
    let res;
    while (true) {
      res = cylGeom(aw, o, O, psiba, KHb, psibd);
      if (res.over <= 5 || tries > 6) break;
      const k = list.indexOf(aw); aw = list[Math.min(list.length - 1, k + 1)]; tries++;
    }
    R.awBumped = tries > 0;
    rep.p(`Принимаем ближайшее ${tries ? 'стандартное значение, при котором выполняется проверка контактной прочности (п. проверочного расчёта)' : 'большее стандартное значение'} по ГОСТ 2185-66 [[ch|с. 31]]: <i>a</i><sub>w</sub> = ${aw} мм.`);
    const g = res;
    rep.eq({ lhs: `m${o.label ? '_{' + o.label.replace(/^\./, '') + '}' : ''}`, f: `(0{,}01\\ldots 0{,}02)\\cdot a_{w${o.label}}`, s: `(0{,}01\\ldots 0{,}02)\\cdot ${aw}`, raw: `${n(0.01 * aw)}\\ldots ${n(0.02 * aw)}\\ \\Rightarrow\\ ${nx(g.m)}`, u: 'мм', d: 'Модуль зацепления выбирается в интервале (0,01…0,02)aw и выравнивается по ГОСТ 9563-60.' });
    rep.eq({ lhs: `z_{${o.st.p}}`, f: `\\dfrac{2\\cdot a_{w${o.label}}}{m\\cdot(${o.usym}+1)}`, s: `\\dfrac{2\\cdot ${aw}}{${nx(g.m)}\\cdot(${n(o.u)}+1)}`, v: g.z1r, raw: `${n(g.z1r)}\\ \\Rightarrow\\ ${g.z1}`, d: 'Число зубьев шестерни (не менее 17 — условие отсутствия подрезания).' });
    rep.eq({ lhs: `z_{${o.st.w}}`, f: `${o.usym}\\cdot z_{${o.st.p}}`, s: `${n(o.u)}\\cdot ${g.z1}`, v: g.z2r, raw: `${n(g.z2r)}\\ \\Rightarrow\\ ${g.z2}`, d: 'Число зубьев колеса.' });
    rep.eq({ lhs: `${o.usym}^{ф}`, f: `\\dfrac{z_{${o.st.w}}}{z_{${o.st.p}}}`, s: `\\dfrac{${g.z2}}{${g.z1}}`, v: g.uf, d: 'Фактическое передаточное число ступени.' });
    const du = Math.abs(g.uf - o.u) / o.u * 100;
    rep.check(`\\Delta u=${n(du, 2)}\\%\\ ${du <= 4 ? '\\le' : '>'}\\ 4\\%`, du <= 4, '');
    rep.eq({ lhs: `a_{w${o.label}}^{ф}`, f: `\\dfrac{m\\cdot(z_{${o.st.p}}+z_{${o.st.w}})}{2}`, s: `\\dfrac{${nx(g.m)}\\cdot(${g.z1}+${g.z2})}{2}`, v: g.aw, u: 'мм', d: g.aw === aw ? 'Фактическое межосевое расстояние совпадает со стандартным.' : 'Фактическое межосевое расстояние отличается от стандартного — геометрия рассчитывается по фактическому значению.' });
    const i1 = o.st.p, i2 = o.st.w;
    rep.table(`Геометрические размеры колёс ${o.title}`, ['Параметр', `Шестерня z${i1}`, `Колесо z${i2}`], [
      ['Число зубьев z', g.z1, g.z2], ['Делительный диаметр d = m·z, мм', fnum(g.d1), fnum(g.d2)], ['Диаметр вершин da = d + 2m, мм', fnum(g.da1), fnum(g.da2)],
      ['Диаметр впадин df = d − 2,5m, мм', fnum(g.df1), fnum(g.df2)], ['Ширина венца b, мм', g.b1, g.b2]]);
    rep.eq({ lhs: `b_{${i2}}`, f: `\\psi_{ba}\\cdot a_{w${o.label}}`, s: `${nx(psiba)}\\cdot ${n(g.aw)}`, v: psiba * g.aw, raw: `${n(psiba * g.aw)}\\ \\Rightarrow\\ ${g.b2}`, u: 'мм', d: 'Ширина венца колеса.' });
    rep.eq({ lhs: `b_{${i1}}`, f: `b_{${i2}}+(2\\ldots 5)`, s: `${g.b2}+${g.b1 - g.b2}`, v: g.b1, u: 'мм', d: 'Шестерню делают шире колеса для компенсации осевой несоосности при сборке.' });
    Object.assign(R, g, { aw: g.aw, awStd: aw, psiba, psibd, KHb });
    return R;
  }
  function cylGeom(awStd, o, O, psiba, KHb, psibd) {
    const mr = (O.mK || 0.015) * awStd;
    const mlist = O.mRow === 1 ? D.STD.m1 : D.STD.m1.concat(D.STD.m2).sort((a, b) => a - b);
    let m = near(mr, mlist.filter(x => x >= 1));
    let z1r = 2 * awStd / (m * (o.u + 1)), z1 = Math.round(z1r);
    if (z1 < 17) { while (z1 < 17 && m > 1) { m = mlist[mlist.indexOf(m) - 1]; z1r = 2 * awStd / (m * (o.u + 1)); z1 = Math.round(z1r); } z1 = Math.max(17, z1); }
    let z2r, z2;
    if (O.zMode === 'sum') { const zs = Math.round(2 * awStd / m); z1 = Math.max(17, Math.round(zs / (o.u + 1))); z2 = zs - z1; z2r = z2; }
    else { z2r = o.u * z1; z2 = Math.round(z2r); }
    const uf = z2 / z1, aw = m * (z1 + z2) / 2;
    const d1 = m * z1, d2 = m * z2, da1 = d1 + 2 * m, da2 = d2 + 2 * m, df1 = d1 - 2.5 * m, df2 = d2 - 2.5 * m;
    const b2 = Math.round(psiba * aw), b1 = b2 + (O.bAdd || 5);
    // предварительная проверка контактных напряжений для выбора aw
    const Ft = o.ftPin ? 2000 * o.T / d1 : 2000 * o.Tw / d2, v = PI * d1 * o.n1 / 60000, deg = precisionCyl(v);
    const KHv = o.hard ? D.KHV.spur.hard : D.KHV.spur.soft, KH = KHb * KHv;
    const ea = 1.88 - 3.2 * (1 / z1 + 1 / z2), Ze = Math.sqrt((4 - ea) / 3);
    const sigH = 1.76 * 274 * Ze * Math.sqrt(KH * Ft * (uf + 1) / (b2 * uf * d1));
    const over = (sigH / o.sH - 1) * 100;
    return { m, mr, z1r, z1, z2r, z2, uf, aw, d1, d2, da1, da2, df1, df2, b1, b2, Ft, v, deg, KHv, KH, ea, Ze, sigH, over };
  }
  /* силы и проверочный расчёт цилиндрической ступени */
  function cylForces(rep, g, o) {
    const i1 = o.st.p, i2 = o.st.w;
    const Ft = o.ftPin ? 2000 * o.T / g.d1 : 2000 * o.Tw / g.d2;
    if (o.ftPin) rep.eq({ lhs: `F_{t${i2}}`, f: `\\dfrac{2\\cdot ${o.Tsym}\\cdot 10^{3}}{d_{${i1}}}`, s: `\\dfrac{2\\cdot ${n(o.T)}\\cdot 10^{3}}{${n(g.d1)}}`, v: Ft, u: 'Н', d: 'Окружная сила через крутящий момент на промежуточном валу (на шестерне) и делительный диаметр шестерни [М, п. 1.5.2].' });
    else rep.eq({ lhs: `F_{t${i1}}=F_{t${i2}}`, f: `\\dfrac{2000\\cdot ${o.Twsym}}{d_{${i2}}}`, s: `\\dfrac{2000\\cdot ${n(o.Tw)}}{${n(g.d2)}}`, v: Ft, u: 'Н', d: 'Окружная сила в зацеплении.' });
    const Fr = Ft * TG20;
    rep.eq({ lhs: o.ftPin ? `F_{r${i2}}` : `F_{r${i1}}=F_{r${i2}}`, f: `F_{t${o.ftPin ? i2 : i1}}\\cdot \\operatorname{tg}\\alpha`, s: `${n(Ft)}\\cdot \\operatorname{tg}20^{\\circ}`, v: Fr, u: 'Н', d: 'Радиальная сила (угол зацепления α = 20°); осевые силы в прямозубом зацеплении отсутствуют.' });
    return { Ft, Fr, Fa: 0 };
  }
  function cylCheck(rep, g, o, f) {
    const i1 = o.st.p, i2 = o.st.w, R = {};
    const v = PI * g.d1 * o.n1 / 60000, deg = precisionCyl(v);
    rep.eq({ lhs: `v_{${o.label || ''}}`, f: `\\dfrac{\\pi\\cdot d_{${i1}}\\cdot ${o.n1sym}}{60\\cdot 1000}`, s: `\\dfrac{\\pi\\cdot ${n(g.d1)}\\cdot ${n(o.n1)}}{60000}`, v, u: 'м/с', d: 'Окружная скорость шестерни.' });
    rep.p(`При <i>v</i> = ${fnum(v)} м/с ${v <= 2 ? '≤ 2' : v <= 6 ? '≤ 6' : '> 6'} м/с назначаем ${deg}-ю степень точности по ГОСТ 1643-81 [[met|п. 1.5]].`);
    const ea = 1.88 - 3.2 * (1 / g.z1 + 1 / g.z2), Ze = Math.sqrt((4 - ea) / 3);
    rep.eq({ lhs: '\\varepsilon_{\\alpha}', f: `1{,}88-3{,}2\\left(\\dfrac{1}{z_{${i1}}}+\\dfrac{1}{z_{${i2}}}\\right)`, s: `1{,}88-3{,}2\\left(\\dfrac{1}{${g.z1}}+\\dfrac{1}{${g.z2}}\\right)`, v: ea, sig: 3, d: 'Торцовый коэффициент перекрытия.' });
    rep.eq({ lhs: 'Z_{\\varepsilon}', f: '\\sqrt{\\dfrac{4-\\varepsilon_{\\alpha}}{3}}', s: `\\sqrt{\\dfrac{4-${n(ea, 3)}}{3}}`, v: Ze, sig: 3, d: 'Коэффициент, учитывающий суммарную длину контактных линий.' });
    const KHv = o.hard ? D.KHV.spur.hard : D.KHV.spur.soft;
    let KH, sH, over, okH;
    const contact = () => {
    KH = g.KHb * KHv;
    rep.eq({ lhs: 'K_{H}', f: 'K_{H\\beta}\\cdot K_{Hv}', s: `${n(g.KHb, 3)}\\cdot ${nx(KHv)}`, v: KH, sig: 3, d: `Коэффициент нагрузки; KHv = ${fnum(KHv, 0)} — для прямозубых колёс HB ${o.hard ? '>' : '≤'} 350 (табл. 3.6 [Ч]).`, ref: ['ch', 'табл. 3.6'] });
    sH = 1.76 * 274 * Ze * Math.sqrt(KH * f.Ft * (g.uf + 1) / (g.b2 * g.uf * g.d1));
    if (o.pa) rep.eq({ lhs: '\\sigma_{H}', f: `Z_{H}\\cdot Z_{M}\\cdot Z_{\\varepsilon}\\cdot \\sqrt{\\dfrac{K_{H}\\cdot F_{t${o.ftPin ? i2 : i1}}\\cdot(${o.usym}+1)}{b_{${i2}}\\cdot ${o.usym}\\cdot d_{${i1}}\\cdot 10^{-6}}}`, s: `1{,}76\\cdot 274\\cdot 10^{3}\\cdot ${n(Ze, 3)}\\cdot \\sqrt{\\dfrac{${n(KH, 3)}\\cdot ${n(f.Ft)}\\cdot(${n(g.uf)}+1)}{${g.b2}\\cdot ${n(g.uf)}\\cdot ${n(g.d1)}\\cdot 10^{-6}}}`, v: sH * 1e6, u: 'Па', d: 'Расчётное контактное напряжение (ZH = 1,76 — прямые зубья без смещения, ZM = 274·10³ Па^½ — пара «сталь – сталь»).' });
    else rep.eq({ lhs: '\\sigma_{H}', f: `Z_{H}\\cdot Z_{M}\\cdot Z_{\\varepsilon}\\cdot \\sqrt{\\dfrac{K_{H}\\cdot F_{t${o.ftPin ? i2 : i1}}\\cdot(${o.usym}+1)}{b_{${i2}}\\cdot ${o.usym}\\cdot d_{${i1}}}}\\cdot 10^{-3}`, s: `1{,}76\\cdot 274\\cdot 10^{3}\\cdot ${n(Ze, 3)}\\cdot \\sqrt{\\dfrac{${n(KH, 3)}\\cdot ${n(f.Ft)}\\cdot(${n(g.uf)}+1)}{${g.b2}\\cdot ${n(g.uf)}\\cdot ${n(g.d1)}}}\\cdot 10^{-3}`, v: sH, u: 'МПа', d: 'Расчётное контактное напряжение (ZH = 1,76 — прямые зубья без смещения, ZM = 274·10³ Па^½ — пара «сталь – сталь»).' });
    over = (sH / o.sH - 1) * 100;
    okH = over <= 5;
    rep.check(`\\sigma_{H}=${n(sH)}\\ \\text{МПа}\\ ${sH <= o.sH ? '\\le' : '>'}\\ ${o.sHsym}=${n(o.sH)}\\ \\text{МПа}`, okH, sH <= o.sH ? `Недогрузка ${fnum(-over, 3)} %${-over > 10 ? (g.narrowed ? ' — больше 10 %, но ширину венца дальше уменьшать нельзя по условию изгибной прочности (и ψba ≥ 0,2), поэтому недогрузка допускается' : ' — больше допустимых 10 %' + (o.underRef ? ' ' + o.underRef : '')) : ' — в допустимых пределах (до 10 %)'}.` : over <= 5 ? `Перегрузка ${fnum(over, 3)} % не превышает допустимых 5 %.` : `Перегрузка ${fnum(over, 3)} % — больше 5 %, требуется увеличить aw или ширину венца.`);
    };
    contact();
    // недогрузка больше 10 %: межосевое расстояние стандартное, поэтому уменьшается ширина венца (ψba не меньше 0,2)
    if (-over > 10) {
      const bMin = Math.ceil(0.2 * g.aw);
      // ширина не меньше нужной по изгибу (σF ~ 1/b, с запасом 3 %)
      const YFa = yf(g.z1), YFb = yf(g.z2), limF = o.sF1 / YFa <= o.sF2 / YFb ? { YF: YFa, sF: o.sF1 } : { YF: YFb, sF: o.sF2 };
      const sFat = b => limF.YF * kfb(b / g.d1, o.colF, o.hard) * kfv(deg, v, o.hard) * f.Ft / (b * g.m);
      let b2n = Math.max(bMin, Math.ceil(g.b2 * Math.pow(sH / (0.95 * o.sH), 2)));
      while (b2n < g.b2 && sFat(b2n) > 0.97 * limF.sF) b2n++;
      if (b2n < g.b2) {
        const dB = g.b1 - g.b2;
        rep.p(`Передача недогружена более чем на 10 %${o.underRef ? ' ' + o.underRef : ''}. Межосевое расстояние стандартное, поэтому уменьшаем ширину венца колеса (из σ<sub>H</sub> ~ 1/√b; не менее 0,2·<i>a</i><sub>w</sub> = ${bMin} мм и не меньше нужной по изгибной прочности): <i>b</i><sub>${i2}</sub> = ${g.b2} → ${b2n} мм, ширина шестерни <i>b</i><sub>${i1}</sub> = ${b2n + dB} мм; ψ<sub>ba</sub> = ${fnum(b2n / g.aw, 3)}. Проверку повторяем.`);
        g.b2 = b2n; g.b1 = b2n + dB; g.psiba = b2n / g.aw; g.psibd = b2n / g.d1; g.KHb = khb(g.psibd, o.col, o.hard); g.narrowed = true;
        rep.eq({ lhs: 'K_{H\\beta}', raw: n(g.KHb, 3), d: `По ψbd = b/d = ${fnum(g.psibd, 3)} (табл. 3.5 [Ч]).`, ref: ['ch', 'табл. 3.5'] });
        contact();
      }
    }
    const YF1 = yf(g.z1), YF2 = yf(g.z2), r1 = o.sF1 / YF1, r2 = o.sF2 / YF2;
    rep.p(`Коэффициенты формы зуба по числам зубьев [[ch|с. 37]]: <i>Y</i><sub>F${i1}</sub> = ${fnum(YF1, 3)} (z = ${g.z1}), <i>Y</i><sub>F${i2}</sub> = ${fnum(YF2, 3)} (z = ${g.z2}).`);
    rep.eq({ lhs: `\\dfrac{\\sigma_{FP${i1}}}{Y_{F${i1}}}`, s: `\\dfrac{${n(o.sF1)}}{${n(YF1, 3)}}`, v: r1, u: 'МПа', d: 'Сравнение изгибной прочности шестерни и колеса.' });
    rep.eq({ lhs: `\\dfrac{\\sigma_{FP${i2}}}{Y_{F${i2}}}`, s: `\\dfrac{${n(o.sF2)}}{${n(YF2, 3)}}`, v: r2, u: 'МПа' });
    const lim = r1 <= r2 ? { i: i1, YF: YF1, sF: o.sF1, b: g.b1, name: 'шестерни' } : { i: i2, YF: YF2, sF: o.sF2, b: g.b2, name: 'колеса' };
    rep.p(`Менее прочны на изгиб зубья ${lim.name} — проверочный расчёт выполняется для них.`);
    const KFb = kfb(g.psibd, o.colF, o.hard), KFv = kfv(deg, v, o.hard), KF = KFb * KFv;
    rep.eq({ lhs: 'K_{F}', f: 'K_{F\\beta}\\cdot K_{Fv}', s: `${n(KFb, 3)}\\cdot ${nx(KFv)}`, v: KF, sig: 3, d: `KFβ — по ψbd = ${fnum(g.psibd, 3)} (табл. 3.7 [Ч]), KFv — по степени точности ${Math.min(8, deg)} и скорости (табл. 3.8 [Ч]).`, ref: ['ch', 'табл. 3.7, 3.8'] });
    const sF = lim.YF * KF * f.Ft / (g.b2 * g.m);
    rep.eq({ lhs: '\\sigma_{F}', f: `\\dfrac{Y_{F${lim.i}}\\cdot K_{F}\\cdot F_{t${o.ftPin ? i2 : i1}}}{b_{${i2}}\\cdot m}`, s: `\\dfrac{${n(lim.YF, 3)}\\cdot ${n(KF, 3)}\\cdot ${n(f.Ft)}}{${g.b2}\\cdot ${nx(g.m)}}`, v: sF, u: 'МПа', d: 'Расчётное напряжение изгиба в зубьях лимитирующего элемента.' });
    rep.check(`\\sigma_{F}=${n(sF)}\\ \\text{МПа}\\ ${sF <= lim.sF ? '\\le' : '>'}\\ \\sigma_{FP${lim.i}}=${n(lim.sF)}\\ \\text{МПа}`, sF <= lim.sF, sF > lim.sF ? 'Изгибная прочность не обеспечена — требуется увеличить модуль.' : 'Изгибная прочность зубьев обеспечена.');
    Object.assign(R, { v, deg, ea, Ze, KHv, KH, sH, over, YF1, YF2, KFb, KFv, KF, sF, lim });
    return R;
  }

  /* ---------- коническая прямозубая ступень [М] 1.4.1, 1.5.1, 1.6.1 ---------- */
  function conical(rep, o, O) {
    // o: { T, n1, u, sH, sF1, sF2, hard }
    const R = {};
    const Kbe = O.Kbe;
    rep.eq({ lhs: 'K_{be}', raw: nx(Kbe), d: 'Коэффициент ширины венца по конусному расстоянию из рекомендуемого интервала 0,25…0,30.', ref: ['met', 'п. 1.4.1'] });
    const aux = Kbe * o.u / (2 - Kbe);
    rep.eq({ lhs: '\\psi_{bd}', f: '\\dfrac{K_{be}\\cdot u_{б}}{2-K_{be}}', s: `\\dfrac{${nx(Kbe)}\\cdot ${n(o.u)}}{2-${nx(Kbe)}}`, v: aux, sig: 3, d: 'Вспомогательный параметр — аналог ψbd для конической передачи.' });
    const KHb = khb(Math.min(aux, 0.8), 'I', o.hard);
    rep.eq({ lhs: 'K_{H\\beta}', raw: n(KHb, 3), d: 'Коэффициент неравномерности нагрузки для консольно расположенной шестерни (столбец I табл. 3.5 [Ч], линейная интерполяция).', ref: ['ch', 'табл. 3.5'] });
    const de1r = 1e4 * Math.cbrt(o.T * KHb / ((1 - Kbe) * Kbe * o.u * Math.pow(o.sH * 1e6, 2)));
    rep.eq({ lhs: 'd_{e1}', f: '10^{4}\\cdot \\sqrt[3]{\\dfrac{T_{1б}\\cdot K_{H\\beta}}{(1-K_{be})\\cdot K_{be}\\cdot u_{б}\\cdot [\\sigma_{HP}]_{I}^{2}}}', s: `10^{4}\\cdot \\sqrt[3]{\\dfrac{${n(o.T)}\\cdot ${n(KHb, 3)}}{(1-${nx(Kbe)})\\cdot ${nx(Kbe)}\\cdot ${n(o.u)}\\cdot(${n(o.sH)}\\cdot 10^{6})^{2}}}`, v: de1r * 1000, u: 'мм', cmp: '\\ge', d: 'Внешний делительный диаметр шестерни из условия контактной прочности (результат в метрах переведён в миллиметры).' });
    let de1 = up(de1r * 1000, D.STD.shaft), z1 = O.zb1 || 20, tries = 0, g;
    while (true) {
      g = conGeom(de1, z1, o, Kbe, KHb);
      if (g.over <= 5 || tries > 8) break;
      de1 = D.STD.shaft[D.STD.shaft.indexOf(de1) + 1]; tries++;
    }
    rep.p(`Принимаем ${tries ? 'стандартное значение, при котором выполняется проверка контактной прочности' : 'ближайшее большее стандартное значение'}: <i>d</i><sub>e1</sub> = ${fnum(de1, 0)} мм.`);
    rep.p(`Число зубьев шестерни принимаем <i>z</i><sub>1</sub> = ${z1} (рекомендуемый интервал 18…25 из условия отсутствия подрезания [[met|п. 1.4.1]]).`);
    rep.eq({ lhs: 'z_{2}', f: 'u_{б}\\cdot z_{1}', s: `${n(o.u)}\\cdot ${z1}`, v: o.u * z1, raw: `${n(o.u * z1)}\\ \\Rightarrow\\ ${g.z2}`, d: 'Число зубьев колеса.' });
    rep.eq({ lhs: 'u_{б}^{ф}', f: '\\dfrac{z_{2}}{z_{1}}', s: `\\dfrac{${g.z2}}{${z1}}`, v: g.uf, d: 'Фактическое передаточное число быстроходной ступени.' });
    const du = Math.abs(g.uf - o.u) / o.u * 100; rep.check(`\\Delta u=${n(du, 2)}\\%\\ \\le\\ 4\\%`, du <= 4, '');
    rep.eq({ lhs: 'm_{te}', f: '\\dfrac{d_{e1}}{z_{1}}', s: `\\dfrac{${nx(de1)}}{${z1}}`, v: g.mte, u: 'мм', d: 'Внешний окружной модуль.' });
    rep.eq({ lhs: '\\delta_{2}', f: '\\operatorname{arctg}u_{б}', s: `\\operatorname{arctg}${n(g.uf)}`, v: g.d2deg, raw: F.deg(g.d2deg), d: 'Угол делительного конуса колеса.' });
    rep.eq({ lhs: '\\delta_{1}', f: '90^{\\circ}-\\delta_{2}', v: g.d1deg, raw: F.deg(g.d1deg), d: 'Угол делительного конуса шестерни.' });
    rep.eq({ lhs: 'R_{e}', f: '0{,}5\\cdot m_{te}\\cdot z_{1}\\cdot \\sqrt{u_{б}^{2}+1}', s: `0{,}5\\cdot ${n(g.mte)}\\cdot ${z1}\\cdot \\sqrt{${sq(g.uf)}^{2}+1}`, v: g.Re, u: 'мм', d: 'Внешнее конусное расстояние.' });
    rep.eq({ lhs: 'b', f: 'K_{be}\\cdot R_{e}', s: `${nx(Kbe)}\\cdot ${n(g.Re)}`, v: Kbe * g.Re, raw: `${n(Kbe * g.Re)}\\ \\Rightarrow\\ ${g.b}`, u: 'мм', d: 'Ширина венца, округляется до целого.' });
    rep.eq({ lhs: 'K_{be}^{ф}', f: '\\dfrac{b}{R_{e}}', s: `\\dfrac{${g.b}}{${n(g.Re)}}`, v: g.b / g.Re, sig: 3 });
    rep.check(`0{,}25\\le K_{be}=${n(g.b / g.Re, 3)}\\le 0{,}30`, g.b / g.Re >= 0.249 && g.b / g.Re <= 0.301, '');
    rep.eq({ lhs: 'R_{m}', f: 'R_{e}-0{,}5\\cdot b', s: `${n(g.Re)}-0{,}5\\cdot ${g.b}`, v: g.Rm, u: 'мм', d: 'Среднее конусное расстояние.' });
    rep.eq({ lhs: 'm_{tm}', f: 'm_{te}-\\dfrac{b\\cdot \\sin\\delta_{1}}{z_{1}}', s: `${n(g.mte)}-\\dfrac{${g.b}\\cdot \\sin ${F.deg(g.d1deg)}}{${z1}}`, v: g.mtm, u: 'мм', d: 'Средний окружной модуль.' });
    rep.table('Геометрические размеры конических колёс', ['Параметр', 'Шестерня z1', 'Колесо z2'], [
      ['Число зубьев', z1, g.z2], ['Средний делительный диаметр dm = mtm·z, мм', fnum(g.dm1), fnum(g.dm2)], ['Внешний делительный диаметр de = mte·z, мм', fnum(g.de1), fnum(g.de2)],
      ['Внешний диаметр вершин dae = de + 2mte·cosδ, мм', fnum(g.dae1), fnum(g.dae2)], ['Внешний диаметр впадин dfe = de − 2,4mte·cosδ, мм', fnum(g.dfe1), fnum(g.dfe2)], ['Угол делительного конуса δ', F.degTxt(g.d1deg), F.degTxt(g.d2deg)]]);
    Object.assign(R, g, { Kbe, KHb, aux, de1r: de1r * 1000 });
    return R;
  }
  function conGeom(de1, z1, o, Kbe, KHb) {
    const mte = de1 / z1, z2 = Math.round(o.u * z1), uf = z2 / z1;
    const d2 = Math.atan(uf), d1 = PI / 2 - d2;
    const Re = 0.5 * mte * z1 * Math.sqrt(uf * uf + 1), b = Math.round(Kbe * Re), Rm = Re - 0.5 * b, mtm = mte - b * Math.sin(d1) / z1;
    const dm1 = mtm * z1, dm2 = mtm * z2, de2 = mte * z2, dae1 = de1 + 2 * mte * Math.cos(d1), dae2 = de2 + 2 * mte * Math.cos(d2), dfe1 = de1 - 2.4 * mte * Math.cos(d1), dfe2 = de2 - 2.4 * mte * Math.cos(d2);
    const Ft = 2 * o.T * 1e3 / dm1, zv1 = z1 / Math.cos(d1), zv2 = z2 / Math.cos(d2), ea = 1.88 - 3.2 * (1 / zv1 + 1 / zv2), Ze = Math.sqrt((4 - ea) / 3);
    const KHv = o.hard ? D.KHV.spur.hard : D.KHV.spur.soft;
    const sigH = 1.76 * 274e3 * Ze * Math.sqrt(KHb * KHv * Ft * Math.sqrt(uf * uf + 1) / (0.85 * b * uf * dm1 * 1e-6)) / 1e6;
    return { de1, z1, z2, uf, mte, d1deg: d1 / D2R, d2deg: d2 / D2R, Re, b, Rm, mtm, dm1, dm2, de2, dae1, dae2, dfe1, dfe2, over: (sigH / o.sH - 1) * 100 };
  }
  function conForces(rep, g, o) {
    const v = PI * g.dm1 * o.n1 / 60000, deg = v <= 5 ? 8 : 7;
    rep.eq({ lhs: 'v_{m1}', f: '\\dfrac{\\pi\\cdot d_{m1}\\cdot n_{1Б}}{60\\cdot 1000}', s: `\\dfrac{\\pi\\cdot ${n(g.dm1)}\\cdot ${n(o.n1)}}{60000}`, v, u: 'м/с', d: 'Окружная скорость на среднем делительном диаметре шестерни.' });
    rep.p(`При <i>v</i><sub>m1</sub> = ${fnum(v)} м/с ${v <= 5 ? '≤' : '>'} 5 м/с принимаем ${deg}-ю степень точности по ГОСТ 1758-81 [[met|п. 1.5.1]].`);
    const Ft = 2 * o.T * 1e3 / g.dm1, sd1 = Math.sin(g.d1deg * D2R), cd1 = Math.cos(g.d1deg * D2R);
    rep.eq({ lhs: 'F_{t1}', f: '\\dfrac{2\\cdot T_{1б}\\cdot 10^{3}}{d_{m1}}', s: `\\dfrac{2\\cdot ${n(o.T)}\\cdot 10^{3}}{${n(g.dm1)}}`, v: Ft, u: 'Н', d: 'Окружная сила на среднем диаметре шестерни.' });
    const Fa1 = Ft * TG20 * sd1, Fr1 = Ft * TG20 * cd1;
    rep.eq({ lhs: 'F_{a1}=F_{r2}', f: 'F_{t1}\\cdot \\operatorname{tg}\\alpha\\cdot \\sin\\delta_{1}', s: `${n(Ft)}\\cdot \\operatorname{tg}20^{\\circ}\\cdot \\sin ${F.deg(g.d1deg)}`, v: Fa1, u: 'Н', d: 'Осевая сила на шестерне равна радиальной силе на колесе; направлена от вершины конуса к основанию.' });
    rep.eq({ lhs: 'F_{r1}=F_{a2}', f: 'F_{t1}\\cdot \\operatorname{tg}\\alpha\\cdot \\cos\\delta_{1}', s: `${n(Ft)}\\cdot \\operatorname{tg}20^{\\circ}\\cdot \\cos ${F.deg(g.d1deg)}`, v: Fr1, u: 'Н', d: 'Радиальная сила на шестерне равна осевой силе на колесе.' });
    return { v, deg, Ft, Fa1, Fr1 };
  }
  function conCheck(rep, g, o, f) {
    const zv1 = g.z1 / Math.cos(g.d1deg * D2R), zv2 = g.z2 / Math.cos(g.d2deg * D2R);
    rep.eq({ lhs: 'z_{v1}', f: '\\dfrac{z_{1}}{\\cos\\delta_{1}}', s: `\\dfrac{${g.z1}}{\\cos ${F.deg(g.d1deg)}}`, v: zv1, d: 'Эквивалентное число зубьев шестерни.' });
    rep.eq({ lhs: 'z_{v2}', f: '\\dfrac{z_{2}}{\\cos\\delta_{2}}', s: `\\dfrac{${g.z2}}{\\cos ${F.deg(g.d2deg)}}`, v: zv2, d: 'Эквивалентное число зубьев колеса.' });
    const ea = 1.88 - 3.2 * (1 / zv1 + 1 / zv2), Ze = Math.sqrt((4 - ea) / 3);
    rep.eq({ lhs: '\\varepsilon_{\\alpha}', f: '1{,}88-3{,}2\\left(\\dfrac{1}{z_{v1}}+\\dfrac{1}{z_{v2}}\\right)', s: `1{,}88-3{,}2\\left(\\dfrac{1}{${n(zv1)}}+\\dfrac{1}{${n(zv2)}}\\right)`, v: ea, sig: 3 });
    rep.eq({ lhs: 'Z_{\\varepsilon}', f: '\\sqrt{\\dfrac{4-\\varepsilon_{\\alpha}}{3}}', s: `\\sqrt{\\dfrac{4-${n(ea, 3)}}{3}}`, v: Ze, sig: 3 });
    const KHv = o.hard ? D.KHV.spur.hard : D.KHV.spur.soft, KH = g.KHb * KHv;
    rep.eq({ lhs: 'K_{H}', f: 'K_{H\\beta}\\cdot K_{Hv}', s: `${n(g.KHb, 3)}\\cdot ${nx(KHv)}`, v: KH, sig: 3, d: 'KHv — по табл. 3.6 [Ч] для прямозубых колёс.', ref: ['ch', 'табл. 3.6'] });
    const sH = 1.76 * 274e3 * Ze * Math.sqrt(KH * f.Ft * Math.sqrt(g.uf ** 2 + 1) / (0.85 * g.b * g.uf * g.dm1 * 1e-6)) / 1e6;
    rep.eq({ lhs: '\\sigma_{H}', f: 'Z_{H}\\cdot Z_{M}\\cdot Z_{\\varepsilon}\\cdot \\sqrt{\\dfrac{K_{H}\\cdot F_{t1}\\cdot \\sqrt{u_{б}^{2}+1}}{0{,}85\\cdot b\\cdot u_{б}\\cdot d_{m1}\\cdot 10^{-6}}}', s: `1{,}76\\cdot 274\\cdot 10^{3}\\cdot ${n(Ze, 3)}\\cdot \\sqrt{\\dfrac{${n(KH, 3)}\\cdot ${n(f.Ft)}\\cdot \\sqrt{${sq(g.uf)}^{2}+1}}{0{,}85\\cdot ${g.b}\\cdot ${n(g.uf)}\\cdot ${n(g.dm1)}\\cdot 10^{-6}}}`, v: sH * 1e6, u: 'Па', d: 'Расчётное контактное напряжение в конической передаче (ZH = 1,76; ZM = 274·10³ Па^½).' });
    const over = (sH / o.sH - 1) * 100;
    rep.check(`\\sigma_{H}=${n(sH)}\\ \\text{МПа}\\ ${sH <= o.sH ? '\\le' : '>'}\\ [\\sigma_{HP}]_{I}=${n(o.sH)}\\ \\text{МПа}`, over <= 5, sH <= o.sH ? `Недогрузка ${fnum(-over, 3)} %.` : `Перегрузка ${fnum(over, 3)} %.`);
    const YF1 = yf(zv1), YF2 = yf(zv2), r1 = o.sF1 / YF1, r2 = o.sF2 / YF2;
    rep.p(`Коэффициенты формы зуба по эквивалентным числам зубьев [[ch|с. 37]]: <i>Y</i><sub>F1</sub> = ${fnum(YF1, 3)}, <i>Y</i><sub>F2</sub> = ${fnum(YF2, 3)}; отношения σ<sub>FP</sub>/<i>Y</i><sub>F</sub>: шестерня — ${fnum(r1)} МПа, колесо — ${fnum(r2)} МПа.`);
    const lim = r1 <= r2 ? { i: 1, YF: YF1, sF: o.sF1, name: 'шестерни' } : { i: 2, YF: YF2, sF: o.sF2, name: 'колеса' };
    rep.p(`Проверочный расчёт на изгиб выполняется для зубьев ${lim.name}.`);
    const KFb = kfb(g.aux, 'IV', o.hard), KFv = kfv(f.deg, f.v, o.hard), KF = KFb * KFv;
    rep.eq({ lhs: 'K_{F}', f: 'K_{F\\beta}\\cdot K_{Fv}', s: `${n(KFb, 3)}\\cdot ${nx(KFv)}`, v: KF, sig: 3, d: 'KFβ — консольная шестерня на роликовых подшипниках (столбец IV табл. 3.7 [Ч]), KFv — по табл. 3.8 [Ч].', ref: ['ch', 'табл. 3.7, 3.8'] });
    const sF = lim.YF * KF * f.Ft / (0.85 * g.b * g.mtm * 1e-6) / 1e6;
    rep.eq({ lhs: '\\sigma_{F}', f: `\\dfrac{Y_{F${lim.i}}\\cdot K_{F}\\cdot F_{t1}}{0{,}85\\cdot b\\cdot m_{tm}\\cdot 10^{-6}}`, s: `\\dfrac{${n(lim.YF, 3)}\\cdot ${n(KF, 3)}\\cdot ${n(f.Ft)}}{0{,}85\\cdot ${g.b}\\cdot ${n(g.mtm)}\\cdot 10^{-6}}`, v: sF * 1e6, u: 'Па', d: 'Расчётное напряжение изгиба зубьев лимитирующего элемента.' });
    rep.check(`\\sigma_{F}=${n(sF)}\\ \\text{МПа}\\ ${sF <= lim.sF ? '\\le' : '>'}\\ \\sigma_{FP${lim.i}}=${n(lim.sF)}\\ \\text{МПа}`, sF <= lim.sF, sF > lim.sF ? 'Изгибная прочность не обеспечена — требуется увеличить модуль.' : 'Изгибная прочность обеспечена.');
    return { zv1, zv2, ea, Ze, KH, sH, over, YF1, YF2, KF, sF, lim };
  }

  root.GEAR = { allowGear, cylStage, cylForces, cylCheck, conical, conForces, conCheck, khb, kfb, yf, precisionCyl };
})(typeof window !== 'undefined' ? window : globalThis);
