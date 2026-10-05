/* calc_common.js — общие расчётные блоки курсового проекта (по методичкам кафедры и [Ч]) */
(function (root) {
  'use strict';
  const D = root.DATA, F = root.F;
  const { n, nx, sq, fnum, interp, up, down, near, nearLog, D2R } = F;
  const PI = Math.PI;

  /* ---------- словарь обозначений для «где …» в записке ---------- */
  const SYM = {
    '\\eta_{общ}': ['общий КПД привода', ''], '\\eta_{м}': ['КПД соединительной муфты', ''], '\\eta_{ч}': ['КПД червячной передачи', ''],
    '\\eta_{цеп}': ['КПД открытой цепной передачи', ''], '\\eta_{подш}': ['КПД одной пары подшипников качения', ''], '\\eta_{к}': ['КПД конической зубчатой передачи с учётом потерь в подшипниках', ''],
    '\\eta_{ц}': ['КПД цилиндрической зубчатой передачи с учётом потерь в подшипниках', ''], '\\eta_{ц.б}': ['КПД быстроходной цилиндрической передачи', ''], '\\eta_{ц.т}': ['КПД тихоходной цилиндрической передачи', ''],
    'P_{вых}': ['заданная мощность на валу рабочего органа', 'кВт'], 'P_{расч}': ['требуемая мощность электродвигателя', 'кВт'], 'P_{в}': ['мощность на рабочем органе', 'кВт'], 'P_{эд}': ['требуемая мощность электродвигателя', 'кВт'],
    'n_{эд}': ['номинальная частота вращения вала электродвигателя', 'мин⁻¹'], 'n_{вых}': ['заданная частота вращения вала рабочего органа', 'мин⁻¹'], 'n_{в}': ['заданная частота вращения рабочего органа', 'мин⁻¹'],
    'u_{общ}': ['общее передаточное отношение привода', ''], 'u_{ч}': ['передаточное отношение червячного редуктора', ''], 'u_{цеп}': ['передаточное отношение цепной передачи', ''],
    'u_{ред}': ['передаточное число редуктора', ''], 'u_{т}': ['передаточное число тихоходной ступени', ''], 'u_{б}': ['передаточное число быстроходной ступени', ''],
    'L': ['срок службы привода', 'лет'], 'K_{г}': ['коэффициент годового использования', ''], 'K_{сут}': ['коэффициент суточного использования', ''],
    't_{\\Sigma}': ['суммарное время работы привода', 'ч'], 't_{ч}': ['суммарная наработка редуктора', 'ч'],
    'T_{I}': ['крутящий момент на быстроходном валу', 'Н·м'], 'T_{II}': ['крутящий момент на валу II', 'Н·м'], 'T_{III}': ['крутящий момент на валу III', 'Н·м'], 'T_{IV}': ['крутящий момент на валу IV', 'Н·м'],
    'n_{I}': ['частота вращения быстроходного вала', 'мин⁻¹'], 'n_{II}': ['частота вращения вала II', 'мин⁻¹'], 'n_{III}': ['частота вращения вала III', 'мин⁻¹'], 'n_{IV}': ['частота вращения вала IV', 'мин⁻¹'],
    'P_{I}': ['мощность на быстроходном валу', 'кВт'], 'P_{II}': ['мощность на валу II', 'кВт'], 'P_{III}': ['мощность на валу III', 'кВт'],
    'v_{s}': ['скорость скольжения', 'м/с'], '\\sigma_{в}': ['предел прочности материала', 'МПа'], 'K_{HL}': ['коэффициент долговечности по контактным напряжениям', ''],
    'K_{FL}': ['коэффициент долговечности по напряжениям изгиба', ''], 'N_{HE}': ['эквивалентное число циклов напряжений', ''], 'N_{FE}': ['эквивалентное число циклов при изгибе', ''],
    'C_{v}': ['коэффициент, учитывающий скорость скольжения', ''], 'z_{1}': ['число заходов червяка (зубьев шестерни)', ''], 'z_{2}': ['число зубьев колеса', ''],
    'q': ['коэффициент диаметра червяка', ''], 'm': ['модуль зацепления', 'мм'], 'a_{w}': ['межосевое расстояние', 'мм'], 'K': ['коэффициент нагрузки', ''],
    '[\\sigma]_{H}': ['допускаемое контактное напряжение', 'МПа'], '[\\sigma]_{F}': ['допускаемое напряжение изгиба', 'МПа'],
    'd_{1}': ['делительный диаметр червяка (шестерни)', 'мм'], 'd_{2}': ['делительный диаметр колеса', 'мм'], '\\gamma': ['делительный угол подъёма линии витка', '°'],
    'F_{t2}': ['окружная сила на колесе', 'Н'], 'F_{t1}': ['окружная сила на червяке (шестерне)', 'Н'], 'F_{r}': ['радиальная сила', 'Н'], 'b_{2}': ['ширина венца колеса', 'мм'],
    'Y_{F}': ['коэффициент формы зуба', ''], 'Y_{F2}': ['коэффициент формы зуба колеса', ''], 'Y_{\\beta}': ['коэффициент, учитывающий наклон зуба', ''], 'K_{Fv}': ['коэффициент динамической нагрузки при изгибе', ''], 'K_{F\\beta}': ['коэффициент концентрации нагрузки при изгибе', ''],
    'K_{\\beta}': ['коэффициент концентрации нагрузки', ''], 'K_{v}': ['коэффициент динамической нагрузки', ''], '\\theta': ['коэффициент деформации червяка', ''], 'x': ['коэффициент, учитывающий характер изменения нагрузки', ''],
    "\\varphi'": ['приведённый угол трения', '°'], 'Z_{E}': ['коэффициент, учитывающий механические свойства материалов пары', 'МПа^½'], 'Z_{h}': ['коэффициент, учитывающий форму рабочей поверхности зубьев', ''],
    'K_{э}': ['коэффициент эксплуатации', ''], '[p]': ['допускаемое давление в шарнирах цепи', 'МПа'], 'z_{зв1}': ['число зубьев ведущей звёздочки', ''], 'z_{зв2}': ['число зубьев ведомой звёздочки', ''],
    't': ['шаг цепи', 'мм'], 'L_{p}': ['число звеньев цепи', ''], 'A_{оп}': ['площадь проекции опорной поверхности шарнира', 'мм²'], 'F_{t.цеп}': ['окружная сила, передаваемая цепью', 'Н'], 'K_{в}': ['коэффициент нагрузки на вал', ''],
    '[\\tau_{к}]': ['допускаемое напряжение на кручение', 'МПа'], '\\sigma_{-1}': ['предел выносливости при симметричном цикле изгиба', 'МПа'], 'n_{з}': ['нормативный коэффициент запаса прочности', ''],
    'K_{\\sigma D}': ['суммарный коэффициент концентрации напряжений', ''], 'K_{ри}': ['коэффициент режима нагрузки', ''], 'k_{\\sigma}': ['эффективный коэффициент концентрации напряжений', ''],
    '\\varepsilon_{\\sigma}': ['масштабный фактор', ''], '\\beta_{ш}': ['коэффициент, учитывающий шероховатость поверхности', ''],
    'W_{x}': ['момент сопротивления сечения изгибу', 'мм³'], 'W_{p}': ['момент сопротивления сечения кручению', 'мм³'],
    'h': ['высота шпонки', 'мм'], 'b': ['ширина шпонки', 'мм'], 't_{1}': ['глубина паза вала', 'мм'], 'l_{р}': ['рабочая длина шпонки', 'мм'],
    'V': ['коэффициент вращения', ''], 'X': ['коэффициент радиальной нагрузки', ''], 'Y': ['коэффициент осевой нагрузки', ''], 'K_{б}': ['коэффициент безопасности', ''], 'K_{т}': ['температурный коэффициент', ''],
    'L_{h}': ['требуемый ресурс подшипника', 'ч'], 'e': ['коэффициент осевого нагружения', ''],
    'K_{р}': ['коэффициент режима работы', ''], 'D_{0}': ['диаметр окружности расположения пальцев', 'мм'], 'd_{п}': ['диаметр пальца', 'мм'], 'l_{вт}': ['длина упругой втулки', 'мм'], 'C_{м}': ['зазор между полумуфтами', 'мм'],
    'K_{a}': ['вспомогательный коэффициент', ''], '\\psi_{ba}': ['коэффициент ширины венца по межосевому расстоянию', ''], '\\psi_{bd}': ['коэффициент ширины венца по диаметру', ''],
    'K_{H\\beta}': ['коэффициент неравномерности распределения нагрузки по ширине венца', ''], 'K_{Hv}': ['коэффициент динамической нагрузки', ''], 'K_{H}': ['коэффициент нагрузки', ''],
    'Z_{H}': ['коэффициент, учитывающий форму сопряжённых поверхностей зубьев', ''], 'Z_{M}': ['коэффициент, учитывающий механические свойства материалов', 'МПа^½'], 'Z_{\\varepsilon}': ['коэффициент, учитывающий суммарную длину контактных линий', ''],
    '\\varepsilon_{\\alpha}': ['торцовый коэффициент перекрытия', ''], 'K_{F}': ['коэффициент нагрузки при изгибе', ''],
    'P_{пот}': ['мощность тепловых потерь', 'кВт'], 'K_{t}': ['коэффициент теплопередачи', 'Вт/(м²·°C)'], 'A_{эфф}': ['эффективная площадь теплоотдающей поверхности', 'м²'], '\\psi': ['коэффициент, учитывающий отвод теплоты через раму', ''], 't_{0}': ['температура окружающей среды', '°C'],
    'K_{be}': ['коэффициент ширины венца по конусному расстоянию', ''], 'R_{e}': ['внешнее конусное расстояние', 'мм'], 'm_{te}': ['внешний окружной модуль', 'мм'], 'm_{tm}': ['средний окружной модуль', 'мм'], 'd_{m1}': ['средний делительный диаметр шестерни', 'мм'], '\\delta_{1}': ['угол делительного конуса шестерни', '°'], '\\delta_{2}': ['угол делительного конуса колеса', '°'],
    'E': ['модуль упругости стали', 'МПа'], 'I_{экв}': ['момент инерции сечения червяка', 'мм⁴'], 'l_{1}': ['расстояние между опорами', 'мм'],
    'd_{f1}': ['диаметр впадин витков червяка', 'мм'], 'd_{a1}': ['диаметр вершин витков червяка', 'мм'], 'D_{б}': ['диаметр барабана', 'мм']
  };

  /* ---------- общие помощники ---------- */
  const lst = a => a.map(v => fnum(v)).join('; ');
  function tSum(P) { return P.L * 365 * P.Kg * 24 * P.Kc; }
  function steelSb(key, d) { const s = D.STEELS[key]; for (const r of s.rows) if (d <= r[0]) return { sb: r[1], st: r[2], HB: r[3], name: s.name, ht: s.ht }; const r = s.rows[s.rows.length - 1]; return { sb: r[1], st: r[2], HB: r[3], name: s.name, ht: s.ht }; }
  function shaftStd(x) { return up(x, D.STD.shaft); }
  function bolt(x) { return near(x, D.STD.bolt); }
  function key(d) { for (const k of D.KEYS) if (d <= k.dmax) return k; return D.KEYS[D.KEYS.length - 1]; }
  function keyLen(lHub, b) { const c = D.STD.keyL.filter(l => l <= lHub - 5 + 1e-9 && l > b + 2); return c.length ? c[c.length - 1] : D.STD.keyL.find(l => l > b); }
  function seal(dmin) { return D.SEALS.find(s => s.d >= dmin - 1e-9) || D.SEALS[D.SEALS.length - 1]; }
  function std5(x) { return Math.ceil(x / 5 - 1e-9) * 5; }

  /* выбор двигателя: Pном ≥ Pрасч при заданной синхронной частоте */
  function pickMotor(Preq, sync, type) {
    if (type && type !== 'auto') { const m = D.MOTORS.find(x => x.type === type); if (m) return m; }
    const c = D.MOTORS.filter(m => m.sync === sync && m.P >= Preq - 1e-9).sort((a, b) => a.P - b.P);
    return c[0] || D.MOTORS.filter(m => m.P >= Preq).sort((a, b) => a.P - b.P)[0];
  }
  function motorCandidates(Preq) {
    const out = [];
    for (const s of [3000, 1500, 1000, 750]) { const m = D.MOTORS.filter(x => x.sync === s && x.P >= Preq - 1e-9).sort((a, b) => a.P - b.P)[0]; if (m) out.push(m); }
    return out;
  }

  /* эквивалентное число циклов по графику нагрузки: N = 60·n·tΣ·Σ(Ti/Tmax)^q·(ti/tΣ) */
  function loadFactor(load, q) { return load.reduce((s, [k, t]) => s + Math.pow(k, q) * t, 0); }

  /* ---------- балка на двух опорах (A — x = 0, B — x = l) ----------
   * loads: [{ id, x, Fx, Fy, Cx, Cy }] — силы в плоскостях xOz (Fx) и yOz (Fy), пары сил (момент, Н·мм) */
  function beam(l, loads) {
    const res = {};
    for (const pl of ['x', 'y']) {
      let sm = 0, sf = 0;
      for (const L of loads) { const F = L['F' + pl] || 0, C = L['C' + pl] || 0; sm += F * L.x + C; sf += F; }
      const RB = -sm / l, RA = -sf - RB;
      res['RA' + pl] = RA; res['RB' + pl] = RB;
    }
    const pts = [{ id: 'A', x: 0 }, { id: 'B', x: l }].concat(loads.map(L => ({ id: L.id, x: L.x })));
    const M = (pl, x, side) => {     // изгибающий момент слева от сечения (side = -1) / справа (+1)
      let m = 0;
      const all = [{ x: 0, F: res['RA' + pl] }, { x: l, F: res['RB' + pl] }].concat(loads.map(L => ({ x: L.x, F: L['F' + pl] || 0, C: L['C' + pl] || 0 })));
      for (const p of all) {
        const left = p.x < x - 1e-9 || (Math.abs(p.x - x) < 1e-9 && side > 0);
        if (left) { m += p.F * (x - p.x); if (p.C) m -= p.C; }
      }
      return m;
    };
    res.M = M; res.l = l; res.loads = loads;
    res.at = (x) => { const mx = Math.max(Math.abs(M('x', x, -1)), Math.abs(M('x', x, 1))), my = Math.max(Math.abs(M('y', x, -1)), Math.abs(M('y', x, 1))); return { Mx: mx, My: my, M: Math.hypot(mx, my) }; };
    res.RA = Math.hypot(res.RAx, res.RAy); res.RB = Math.hypot(res.RBx, res.RBy);
    // точки для эпюр
    const xs = Array.from(new Set(pts.map(p => p.x))).sort((a, b) => a - b);
    res.diag = pl => { const out = []; for (const x of xs) { out.push([x, M(pl, x, -1)]); out.push([x, M(pl, x, 1)]); } return out; };
    res.xs = xs;
    return res;
  }

  /* уравнения равновесия в TeX: терминами «знак, обозначение силы, плечо» */
  function momentEq(R, pl, terms, ltex, val, rep, d) {
    // terms: [{ s: ±1, F: 'F_{t1}', a: 'a_{1}', Fv, av }] — момент относительно опоры A, R — реакция опоры B
    const sym = `R_{B${pl}}`;
    let num = '', sub = '';
    terms.forEach((t, i) => {
      const sg = t.s > 0 ? (i ? '+' : '') : '-';
      num += sg + (t.C ? t.F : t.F + '\\cdot ' + t.a);
      sub += sg + (t.C ? n(t.Cv) : n(t.Fv) + '\\cdot ' + n(t.av));
    });
    rep.eq({ lhs: sym, f: `\\dfrac{${num}}{${ltex}}`, s: `\\dfrac{${sub}}{${n(R.lv)}}`, v: val, u: 'Н', d });
  }

  /* ---------- предварительный (ориентировочный) расчёт вала на кручение ---------- */
  function torsionD(rep, o) {
    // o: { lhs, T, tau, mode: '02' | '16pi', name }
    const v = o.mode === '16pi' ? Math.cbrt(16 * o.T * 1e3 / (PI * o.tau)) : Math.cbrt(o.T * 1e3 / (0.2 * o.tau));
    rep.eq({ lhs: o.lhs, f: o.mode === '16pi' ? `\\sqrt[3]{\\dfrac{16\\cdot ${o.Tsym}\\cdot 10^{3}}{\\pi\\cdot [\\tau_{к}]}}` : `\\sqrt[3]{\\dfrac{${o.Tsym}\\cdot 10^{3}}{0{,}2\\cdot [\\tau_{к}]}}`,
      s: o.mode === '16pi' ? `\\sqrt[3]{\\dfrac{16\\cdot ${n(o.T)}\\cdot 10^{3}}{\\pi\\cdot ${nx(o.tau)}}}` : `\\sqrt[3]{\\dfrac{${n(o.T)}\\cdot 10^{3}}{0{,}2\\cdot ${nx(o.tau)}}}`, v, u: 'мм', cmp: '\\ge', d: o.d || 'Ориентировочный диаметр из расчёта на чистое кручение по пониженному допускаемому напряжению — изгиб и концентрация напряжений учитываются снижением [τк].' });
    return v;
  }

  /* ---------- проверка вала по методичке: σэкв ≤ [σи−1] ---------- */
  function kSigma(sec, sb, d) {
    // sec.kind: 'key' — шпоночный паз (табл. 8.5 + 8.8); 'press' — напрессованная деталь, посадка подшипника (табл. 8.7)
    const sbc = Math.min(900, Math.max(600, sb));
    if (sec.kind === 'press') {
      const rowAt = dd => interp(D.K_PRESS.sb, D.K_PRESS.v[D.K_PRESS.d.indexOf(dd)], sbc);
      const ke = interp(D.K_PRESS.d, D.K_PRESS.d.map(rowAt), d);
      return { ke, txt: 'табл. 8.7', ks: null, eps: null };
    }
    const ks = interp(D.K_KEY.sb, D.K_KEY.ks, sbc), eps = interp(D.EPS.d, D.EPS.s, d);
    return { ks, eps, ke: ks / eps, txt: 'табл. 8.5, 8.8' };
  }
  function Wnet(d, k) { if (!k) return { W: PI * d ** 3 / 32, Wp: PI * d ** 3 / 16 }; const c = k.b * k.t1 * (d - k.t1) ** 2 / (2 * d); return { W: PI * d ** 3 / 32 - c, Wp: PI * d ** 3 / 16 - c }; }

  function shaftCheck(rep, o) {
    // o: { name, sh (обозначение вала), sb, n, beta, Kri, secs: [{ id, title, d, M:{Mx,My,M}, T (Н·м), kind: 'key'|'press', key }] , ref }
    const s1 = 0.43 * o.sb;
    rep.eq({ lhs: '\\sigma_{-1}', f: '0{,}43\\cdot \\sigma_{в}', s: `0{,}43\\cdot ${nx(o.sb)}`, v: s1, u: 'МПа', d: 'Предел выносливости стали при симметричном цикле изгиба (эмпирическая связь с пределом прочности для углеродистых сталей).' });
    const out = { s1, secs: [] };
    let ok = true;
    for (const sc of o.secs) {
      rep.p(`<b>${sc.title}</b> (диаметр вала <i>d</i> = ${fnum(sc.d, 0)} мм${sc.key ? `, шпоночный паз ${sc.key.b}×${sc.key.h}, <i>t</i><sub>1</sub> = ${fnum(sc.key.t1, 0)} мм` : ''}).`);
      const k = kSigma(sc, o.sb, sc.d);
      let KsD;
      if (sc.kind === 'press') {
        KsD = k.ke / o.beta;
        rep.eq({ lhs: 'K_{\\sigma D}', f: '\\dfrac{k_{\\sigma}/\\varepsilon_{\\sigma}}{\\beta_{ш}}', s: `\\dfrac{${n(k.ke, 3)}}{${nx(o.beta)}}`, v: KsD, sig: 3, d: 'Суммарный коэффициент концентрации для посадки с натягом (подшипник, ступица): отношение kσ/εσ — по табл. 8.7 [Ч], влияние шероховатости — βш.', ref: ['ch', k.txt] });
      } else {
        KsD = k.ks / (k.eps * o.beta);
        rep.eq({ lhs: 'K_{\\sigma D}', f: '\\dfrac{k_{\\sigma}}{\\varepsilon_{\\sigma}\\cdot \\beta_{ш}}', s: `\\dfrac{${n(k.ks, 3)}}{${n(k.eps, 3)}\\cdot ${nx(o.beta)}}`, v: KsD, sig: 3, d: 'Суммарный коэффициент концентрации напряжений у шпоночного паза: kσ — табл. 8.5, масштабный фактор εσ — табл. 8.8 [Ч].', ref: ['ch', k.txt] });
      }
      const allow = s1 / (o.n * KsD * o.Kri);
      rep.eq({ lhs: '[\\sigma_{и-1}]', f: '\\dfrac{\\sigma_{-1}}{n_{з}\\cdot K_{\\sigma D}\\cdot K_{ри}}', s: `\\dfrac{${n(s1)}}{${nx(o.n)}\\cdot ${n(KsD, 3)}\\cdot ${nx(o.Kri)}}`, v: allow, u: 'МПа', d: 'Допускаемое напряжение изгиба при симметричном цикле с учётом запаса, концентрации напряжений и режима нагрузки.' });
      const met09 = sc.kind === 'key' && o.wMode !== 'net';
      const W = met09 ? Wnet(0.9 * sc.d, null) : Wnet(sc.d, sc.kind === 'key' ? sc.key : null);
      const sub = sc.id;
      rep.eq({ lhs: `M_{${sub}}`, f: `\\sqrt{M_{x${sub}}^{2}+M_{y${sub}}^{2}}`, s: `\\sqrt{${sq(sc.M.Mx / 1e3)}^{2}+${sq(sc.M.My / 1e3)}^{2}}`, v: sc.M.M / 1e3, u: 'Н·м', d: 'Суммарный изгибающий момент в сечении — геометрическая сумма моментов в двух взаимно перпендикулярных плоскостях.' });
      if (met09) {
        rep.eq({ lhs: 'd_{расч}', f: '0{,}9\\cdot d', s: `0{,}9\\cdot ${nx(sc.d)}`, v: 0.9 * sc.d, u: 'мм', d: 'Расчётный диаметр с учётом ослабления вала шпоночным пазом (уменьшение на 10 %).', ref: ['met', 'п. 1.10'] });
        rep.eq({ lhs: 'W_{x}', f: '\\dfrac{\\pi\\cdot d_{расч}^{3}}{32}', s: `\\dfrac{\\pi\\cdot ${n(0.9 * sc.d)}^{3}}{32}`, v: W.W, u: 'мм³', d: 'Осевой момент сопротивления расчётного сечения.' });
        rep.eq({ lhs: 'W_{p}', f: '\\dfrac{\\pi\\cdot d_{расч}^{3}}{16}', s: `\\dfrac{\\pi\\cdot ${n(0.9 * sc.d)}^{3}}{16}`, v: W.Wp, u: 'мм³', d: 'Полярный момент сопротивления расчётного сечения.' });
      } else if (sc.kind === 'key') {
        rep.eq({ lhs: 'W_{x}', f: '\\dfrac{\\pi d^{3}}{32}-\\dfrac{b t_{1}(d-t_{1})^{2}}{2d}', s: `\\dfrac{\\pi\\cdot ${nx(sc.d)}^{3}}{32}-\\dfrac{${sc.key.b}\\cdot ${nx(sc.key.t1)}\\cdot(${nx(sc.d)}-${nx(sc.key.t1)})^{2}}{2\\cdot ${nx(sc.d)}}`, v: W.W, u: 'мм³', d: 'Момент сопротивления изгибу сечения, ослабленного шпоночным пазом.' });
        rep.eq({ lhs: 'W_{p}', f: '\\dfrac{\\pi d^{3}}{16}-\\dfrac{b t_{1}(d-t_{1})^{2}}{2d}', s: `\\dfrac{\\pi\\cdot ${nx(sc.d)}^{3}}{16}-\\dfrac{${sc.key.b}\\cdot ${nx(sc.key.t1)}\\cdot(${nx(sc.d)}-${nx(sc.key.t1)})^{2}}{2\\cdot ${nx(sc.d)}}`, v: W.Wp, u: 'мм³', d: 'Момент сопротивления кручению сечения со шпоночным пазом.' });
      } else {
        rep.eq({ lhs: 'W_{x}', f: '\\dfrac{\\pi d^{3}}{32}', s: `\\dfrac{\\pi\\cdot ${nx(sc.d)}^{3}}{32}`, v: W.W, u: 'мм³', d: 'Осевой момент сопротивления сплошного круглого сечения.' });
        rep.eq({ lhs: 'W_{p}', f: '\\dfrac{\\pi d^{3}}{16}', s: `\\dfrac{\\pi\\cdot ${nx(sc.d)}^{3}}{16}`, v: W.Wp, u: 'мм³', d: 'Полярный момент сопротивления сплошного круглого сечения.' });
      }
      const si = sc.M.M / W.W, tk = sc.T * 1e3 / W.Wp, se = Math.sqrt(si * si + 4 * tk * tk);
      rep.eq({ lhs: '\\sigma_{и}', f: `\\dfrac{M_{${sub}}}{W_{x}}`, s: `\\dfrac{${n(sc.M.M / 1e3)}\\cdot 10^{3}}{${n(W.W)}}`, v: si, u: 'МПа', d: 'Напряжение изгиба в опасном сечении.' });
      rep.eq({ lhs: '\\tau_{к}', f: `\\dfrac{${sc.Tsym}}{W_{p}}`, s: `\\dfrac{${n(sc.T)}\\cdot 10^{3}}{${n(W.Wp)}}`, v: tk, u: 'МПа', d: 'Напряжение кручения в том же сечении.' });
      rep.eq({ lhs: '\\sigma_{экв}', f: '\\sqrt{\\sigma_{и}^{2}+4\\tau_{к}^{2}}', s: `\\sqrt{${sq(si)}^{2}+4\\cdot ${sq(tk)}^{2}}`, v: se, u: 'МПа', d: 'Эквивалентное напряжение — сложение изгиба и кручения.' });
      const okk = se <= allow * 1.0001; ok = ok && okk;
      rep.check(`\\sigma_{экв}=${n(se)}\\ \\text{МПа}\\ ${okk ? '\\le' : '>'}\\ [\\sigma_{и-1}]=${n(allow)}\\ \\text{МПа}`, okk, okk ? 'Прочность вала в сечении обеспечена.' : 'Условие прочности не выполняется — увеличьте диаметр вала в сечении.');
      out.secs.push({ id: sc.id, d: sc.d, si, tk, se, allow, ok: okk, KsD });
    }
    out.ok = ok;
    return out;
  }

  /* ---------- шпоночное соединение ---------- */
  function keyCheck(rep, o) {
    // o: { title, d, lHub, T, Tsym, sig, exact, joint, two }
    const k = key(o.d), l = keyLen(o.lHub, k.b), lp = l - k.b, two = !!o.two, kk = two ? '1{,}5\\cdot ' : '';
    const twoRef = (root.TASKS_CALC && root.TASKS_CALC.mref) ? root.TASKS_CALC.mref('two') : 'п. 1.11';
    rep.p(`<b>${o.title}.</b> Диаметр вала <i>d</i> = ${fnum(o.d, 0)} мм, длина ступицы <i>l</i><sub>ст</sub> = ${fnum(o.lHub, 0)} мм. По ГОСТ 23360-78 [[ch|табл. 8.9]] принимаем ${two ? 'две шпонки' : 'шпонку'} ${k.b}×${k.h}×${l} (<i>t</i><sub>1</sub> = ${fnum(k.t1, 0)} мм), исполнение 1${two ? ', расположенные под углом 180°; считается, что две шпонки передают момент 1,5<i>T</i> [[met|' + twoRef + ']]' : ''}.`);
    rep.eq({ lhs: 'l_{р}', f: 'l-b', s: `${l}-${k.b}`, v: lp, u: 'мм', d: 'Рабочая длина шпонки со скруглёнными торцами (исполнение 1).' });
    let s; const K = two ? 1.5 : 1;
    if (o.exact) { s = 2 * o.T * 1e3 / (K * o.d * (k.h - k.t1) * lp); rep.eq({ lhs: '\\sigma_{см}', f: `\\dfrac{2\\cdot ${o.Tsym}\\cdot 10^{3}}{${kk}d\\,(h-t_{1})\\,l_{р}}`, s: `\\dfrac{2\\cdot ${n(o.T)}\\cdot 10^{3}}{${kk}${nx(o.d)}\\cdot(${k.h}-${nx(k.t1)})\\cdot ${lp}}`, v: s, u: 'МПа', d: 'Напряжение смятия боковых граней шпонки (уточнённая формула).' }); }
    else { s = 4.4 * o.T * 1e3 / (K * o.d * k.h * lp); rep.eq({ lhs: '\\sigma_{см}', f: `\\dfrac{4{,}4\\cdot ${o.Tsym}\\cdot 10^{3}}{${kk}d\\cdot h\\cdot l_{р}}`, s: `\\dfrac{4{,}4\\cdot ${n(o.T)}\\cdot 10^{3}}{${kk}${nx(o.d)}\\cdot ${k.h}\\cdot ${lp}}`, v: s, u: 'МПа', d: 'Напряжение смятия по приближённой формуле методички (глубина погружения шпонки в ступицу 0,45h).' }); }
    const ok = s <= o.sig * 1.0001;
    rep.check(`\\sigma_{см}=${n(s)}\\ \\text{МПа}\\ ${ok ? '\\le' : '>'}\\ [\\sigma_{см}]=${nx(o.sig)}\\ \\text{МПа}`, ok, ok ? 'Прочность шпоночного соединения обеспечена.' : 'Условие не выполняется: следует увеличить длину ступицы или поставить две шпонки под углом 180°.');
    return { d: o.d, b: k.b, h: k.h, t1: k.t1, t2: k.t2, l, lp, s, ok, two, title: o.title, joint: o.joint };
  }
  /* наименьшая длина ступицы, при которой шпонка проходит по смятию (null — не найдено до lMax) */
  function keyHubNeed(o) {
    const k = key(o.d), Kf = o.exact ? 2 / (k.h - k.t1) : 4.4 / k.h;
    const lp = Kf * o.T * 1e3 / (o.d * o.sig), l = D.STD.keyL.find(x => x - k.b >= lp - 1e-9);
    return l ? l + 5 : null;
  }

  /* ---------- подшипники ---------- */
  function bearingList(kind, d, order) {
    const cat = kind === 'taper' ? D.TAPER : D.BALL;
    return order.map(pre => cat.find(b => b.d === d && b.id.startsWith(pre))).filter(Boolean);
  }
  /* o: { rep, kind, d, Ra, Rb (радиальные, Н), Fa (внешняя осевая, направлена к опоре B), n, Lh, Kb, Kt, scheme, order, idx (символ вала), fixed (выбранный вручную) } */
  function bearingCalc(rep, o) {
    const p = o.kind === 'taper' ? 10 / 3 : 3;
    const tryOne = b => {
      let FaA = 0, FaB = 0, SA = 0, SB = 0, e = b.e || 0, Y = b.Y || 0, X = 0.4;
      if (o.kind === 'taper') {
        SA = 0.83 * e * o.Ra; SB = 0.83 * e * o.Rb;
        // [Ч] табл. 9.21 (опора A — «I», B — «II»; внешняя Fa направлена к опоре B)
        if (SA >= SB || o.Fa >= SB - SA) { FaA = SA; FaB = SA + o.Fa; } else { FaA = SB - o.Fa; FaB = SB; }
      } else if (o.Fa > 0) { FaB = o.Fa; }
      const eq1 = (R, Fa) => {
        if (o.kind === 'taper') { if (Fa / (1 * R) <= e) return { X: 1, Y: 0, P: R * o.Kb * o.Kt }; return { X, Y, P: (X * R + Y * Fa) * o.Kb * o.Kt }; }
        if (Fa > 0) { const r = Fa / (b.C0 * 1e3); const tbl = [[0.014, 2.30, 0.19], [0.028, 1.99, 0.22], [0.056, 1.71, 0.26], [0.084, 1.55, 0.28], [0.11, 1.45, 0.30], [0.17, 1.31, 0.34], [0.28, 1.15, 0.38], [0.42, 1.04, 0.42], [0.56, 1.00, 0.44]];
          const ee = interp(tbl.map(t => t[0]), tbl.map(t => t[2]), r), YY = interp(tbl.map(t => t[0]), tbl.map(t => t[1]), r);
          if (Fa / R <= ee) return { X: 1, Y: 0, P: R * o.Kb * o.Kt, e: ee }; return { X: 0.56, Y: YY, P: (0.56 * R + YY * Fa) * o.Kb * o.Kt, e: ee }; }
        return { X: 1, Y: 0, P: R * o.Kb * o.Kt };
      };
      const A = eq1(o.Ra, FaA), B = eq1(o.Rb, FaB);
      const Pm = Math.max(A.P, B.P), Creq = Pm * Math.pow(6e-5 * o.n * o.Lh, 1 / p);
      const L10h = 1e6 / (60 * o.n) * Math.pow(b.C * 1e3 / Pm, p);
      return { b, SA, SB, FaA, FaB, A, B, Pm, Creq, L10h, ok: b.C * 1e3 >= Creq, worst: A.P >= B.P ? 'A' : 'B' };
    };
    let cands = o.fixed && o.fixed.d === o.d ? [o.fixed] : bearingList(o.kind, o.d, o.order);   // закреплённый подшипник — только если диаметр шейки не изменился
    if (!cands.length) cands = (o.kind === 'taper' ? D.TAPER : D.BALL).filter(b => b.d === o.d);
    let r = null;
    for (const b of cands) { r = tryOne(b); if (r.ok) break; }
    if (!r) return null;
    const b = r.b, idx = o.idx;
    rep.p(`Предварительно ${o.fixed ? 'принят' : 'выбран'} подшипник ${b.id} (${b.kind === 'taper' ? 'роликовый конический однорядный' : 'шариковый радиальный однорядный'}, ${b.series} серия) [[ch|прил. ${b.kind === 'taper' ? 'П7' : 'П3'}]]: <i>d</i> = ${b.d} мм, <i>D</i> = ${b.D} мм, ${b.kind === 'taper' ? `<i>T</i> = ${fnum(b.T, 0)} мм` : `<i>B</i> = ${b.B} мм`}, <i>C</i> = ${fnum(b.C, 0)} кН, <i>C</i><sub>0</sub> = ${fnum(b.C0, 0)} кН${b.kind === 'taper' ? `, <i>e</i> = ${fnum(b.e, 0)}, <i>Y</i> = ${fnum(b.Y, 0)}` : ''}.`);
    rep.eq({ lhs: `F_{rA${idx}}`, f: `\\sqrt{R_{Ax}^{2}+R_{Ay}^{2}}`, s: `\\sqrt{${sq(o.RAx)}^{2}+${sq(o.RAy)}^{2}}`, v: o.Ra, u: 'Н', d: 'Суммарная радиальная нагрузка на опору A — геометрическая сумма реакций в двух плоскостях.' });
    rep.eq({ lhs: `F_{rB${idx}}`, f: `\\sqrt{R_{Bx}^{2}+R_{By}^{2}}`, s: `\\sqrt{${sq(o.RBx)}^{2}+${sq(o.RBy)}^{2}}`, v: o.Rb, u: 'Н', d: 'Суммарная радиальная нагрузка на опору B.' });
    if (b.kind === 'taper') {
      rep.eq({ lhs: `S_{A${idx}}`, f: `0{,}83\\cdot e\\cdot F_{rA${idx}}`, s: `0{,}83\\cdot ${nx(b.e)}\\cdot ${n(o.Ra)}`, v: r.SA, u: 'Н', d: 'Осевая составляющая, возникающая в коническом подшипнике от радиальной нагрузки.' });
      rep.eq({ lhs: `S_{B${idx}}`, f: `0{,}83\\cdot e\\cdot F_{rB${idx}}`, s: `0{,}83\\cdot ${nx(b.e)}\\cdot ${n(o.Rb)}`, v: r.SB, u: 'Н' });
      const case1 = r.SA >= r.SB || o.Fa >= r.SB - r.SA;
      rep.p(`Внешняя осевая сила <i>F</i><sub>a</sub> = ${fnum(o.Fa)} Н направлена к опоре B; подшипники установлены ${o.scheme || 'враспор'}. ${case1 ? `Так как ${r.SA >= r.SB ? '<i>S</i><sub>A</sub> ≥ <i>S</i><sub>B</sub>' : '<i>F</i><sub>a</sub> ≥ <i>S</i><sub>B</sub> − <i>S</i><sub>A</sub>'}, по [[ch|табл. 9.21]] осевые нагрузки опор:` : 'Так как <i>S</i><sub>A</sub> < <i>S</i><sub>B</sub> и <i>F</i><sub>a</sub> < <i>S</i><sub>B</sub> − <i>S</i><sub>A</sub>, по [[ch|табл. 9.21]]:'}`);
      if (case1) { rep.eq({ lhs: `F_{aA${idx}}`, f: `S_{A${idx}}`, v: r.FaA, u: 'Н' }); rep.eq({ lhs: `F_{aB${idx}}`, f: `S_{A${idx}}+F_{a}`, s: `${n(r.SA)}+${n(o.Fa)}`, v: r.FaB, u: 'Н' }); }
      else { rep.eq({ lhs: `F_{aA${idx}}`, f: `S_{B${idx}}-F_{a}`, s: `${n(r.SB)}-${n(o.Fa)}`, v: r.FaA, u: 'Н' }); rep.eq({ lhs: `F_{aB${idx}}`, f: `S_{B${idx}}`, v: r.FaB, u: 'Н' }); }
    }
    const show = (S, R, Fa, res) => {
      if (b.kind === 'taper' || Fa > 0) {
        const ee = b.kind === 'taper' ? b.e : res.e;
        rep.p(`Опора ${S}: отношение <i>F</i><sub>a</sub>/(<i>V F</i><sub>r</sub>) = ${fnum(Fa)}/(1·${fnum(R)}) = ${fnum(Fa / R, 3)} ${Fa / R <= ee ? '≤' : '>'} <i>e</i> = ${fnum(ee, 3)}, поэтому <i>X</i> = ${fnum(res.X, 0)}, <i>Y</i> = ${fnum(res.Y, 3)}.`);
      }
      rep.eq({ lhs: `P_{${S}${idx}}`, f: res.Y ? '(X\\cdot V\\cdot F_{r}+Y\\cdot F_{a})\\cdot K_{б}\\cdot K_{т}' : 'V\\cdot F_{r}\\cdot K_{б}\\cdot K_{т}', s: res.Y ? `(${nx(res.X)}\\cdot 1\\cdot ${n(R)}+${n(res.Y, 3)}\\cdot ${n(Fa)})\\cdot ${nx(o.Kb)}\\cdot ${nx(o.Kt)}` : `1\\cdot ${n(R)}\\cdot ${nx(o.Kb)}\\cdot ${nx(o.Kt)}`, v: res.P, u: 'Н', d: `Эквивалентная динамическая нагрузка опоры ${S}; Kб — по табл. 9.19 [Ч], Kт = 1 при температуре до 100 °C.` });
    };
    show('A', o.Ra, r.FaA, r.A); show('B', o.Rb, r.FaB, r.B);
    rep.eq({ lhs: `C_{тр${idx}}`, f: `P_{max}\\cdot \\sqrt[${p === 3 ? 3 : '3{,}33'}]{6\\cdot 10^{-5}\\cdot n\\cdot L_{h}}`, s: `${n(r.Pm)}\\cdot \\sqrt[${p === 3 ? 3 : '3{,}33'}]{6\\cdot 10^{-5}\\cdot ${n(o.n)}\\cdot ${n(o.Lh)}}`, v: r.Creq, u: 'Н', d: 'Требуемая динамическая грузоподъёмность по наиболее нагруженной опоре.' });
    const okC = b.C * 1e3 >= r.Creq;
    rep.check(`C=${n(b.C * 1e3)}\\ \\text{Н}\\ ${okC ? '\\ge' : '<'}\\ C_{тр}=${n(r.Creq)}\\ \\text{Н}`, okC, okC ? `Подшипник ${b.id} пригоден.` : `Подшипник ${b.id} недостаточен — требуется больший типоразмер.`);
    rep.eq({ lhs: `L_{10h${idx}}`, f: `\\dfrac{10^{6}}{60\\cdot n}\\left(\\dfrac{C}{P_{max}}\\right)^{${p === 3 ? 3 : '10/3'}}`, s: `\\dfrac{10^{6}}{60\\cdot ${n(o.n)}}\\left(\\dfrac{${n(b.C * 1e3)}}{${n(r.Pm)}}\\right)^{${p === 3 ? 3 : '10/3'}}`, v: r.L10h, u: 'ч', d: 'Расчётный ресурс выбранного подшипника, ч.' });
    rep.check(`L_{10h}=${n(r.L10h)}\\ \\text{ч}\\ ${r.L10h >= o.Lh ? '\\ge' : '<'}\\ L_{h}=${n(o.Lh)}\\ \\text{ч}`, r.L10h >= o.Lh, '');
    // статическая проверка
    const X0 = b.kind === 'taper' ? 0.5 : 0.6, Y0 = b.kind === 'taper' ? b.Y0 : 0.5;
    const P0 = Math.max(X0 * o.Ra + Y0 * r.FaA, X0 * o.Rb + Y0 * r.FaB, o.Ra, o.Rb);
    rep.eq({ lhs: `P_{0${idx}}`, f: '\\max(X_{0}\\cdot F_{r}+Y_{0}\\cdot F_{a};\\ F_{r})', s: `\\max(${nx(X0)}\\cdot ${n(r.worst === 'A' ? o.Ra : o.Rb)}+${nx(Y0)}\\cdot ${n(r.worst === 'A' ? r.FaA : r.FaB)};\\ ${n(r.worst === 'A' ? o.Ra : o.Rb)})`, v: P0, u: 'Н', d: 'Эквивалентная статическая нагрузка (X0, Y0 — по табл. 9.23 [Ч] и каталогу); если она меньше радиальной, принимают P0 = Fr.' });
    rep.check(`P_{0}=${n(P0)}\\ \\text{Н}\\ ${P0 <= b.C0 * 1e3 ? '\\le' : '>'}\\ C_{0}=${n(b.C0 * 1e3)}\\ \\text{Н}`, P0 <= b.C0 * 1e3, '');
    return Object.assign(r, { P0, p });
  }

  /* ---------- цепная передача [М] 1.6, [Ч] § 7.4 ---------- */
  function chainCalc(rep, o) {
    // o: { T (Н·м), n1, u, Tsym, nsym, Kd, Ka, Kn, Kreg, Ksm, Kp, aRatio, angle, horizontalKv, verticalKv, zMode }
    const R = {};
    let z1 = 29 - 2 * o.u; R.z1raw = z1; z1 = Math.max(13, Math.round(z1)); if (z1 % 2 === 0) z1 += (29 - 2 * o.u) > z1 ? 1 : -1; z1 = Math.max(13, z1);
    rep.eq({ lhs: 'z_{зв1}', f: `29-2\\cdot u_{цеп}'`, s: `29-2\\cdot ${n(o.u)}`, v: R.z1raw, raw: `${n(R.z1raw)}\\ \\Rightarrow\\ ${z1}`, d: 'Число зубьев ведущей звёздочки; округляется до ближайшего нечётного (при нечётном z1 и чётном числе звеньев износ равномернее), не менее 13.' });
    const z2raw = z1 * o.u, z2 = Math.min(120, Math.round(z2raw));
    rep.eq({ lhs: 'z_{зв2}', f: `z_{зв1}\\cdot u_{цеп}'`, s: `${z1}\\cdot ${n(o.u)}`, v: z2raw, raw: `${n(z2raw)}\\ \\Rightarrow\\ ${z2}`, d: 'Число зубьев ведомой звёздочки (не более 120 во избежание соскакивания цепи).' });
    const uf = z2 / z1; R.uf = uf;
    rep.eq({ lhs: 'u_{цеп.факт}', f: '\\dfrac{z_{зв2}}{z_{зв1}}', s: `\\dfrac{${z2}}{${z1}}`, v: uf, d: 'Фактическое передаточное отношение цепной передачи.' });
    const du = Math.abs(uf - o.u) / o.u * 100;
    rep.check(`\\Delta u=\\dfrac{|${n(uf)}-${n(o.u)}|}{${n(o.u)}}\\cdot 100\\%=${n(du, 2)}\\%\\ ${du <= 3 ? '\\le' : '>'}\\ 3\\%`, du <= 3, du <= 3 ? 'Отклонение допустимо.' : 'Отклонение превышает ±3 %.');
    const Ke = o.Kd * o.Ka * o.Kn * o.Kreg * o.Ksm * o.Kp;
    rep.eq({ lhs: 'K_{э}', f: 'K_{д}\\cdot K_{а}\\cdot K_{нак}\\cdot K_{рег}\\cdot K_{смаз}\\cdot K_{см}', s: [o.Kd, o.Ka, o.Kn, o.Kreg, o.Ksm, o.Kp].map(nx).join('\\cdot '), v: Ke, sig: 3, d: 'Коэффициент эксплуатации учитывает динамичность нагрузки, межосевое расстояние, наклон, способ регулировки, смазывание и сменность работы.' });
    // шаг: последовательные приближения по табл. 7.18
    const kz = 1 + 0.01 * (z1 - 17);
    let pick = null;
    for (const t of D.STD.chainT) {
      const row = D.CHAIN_P[t]; const p0 = interp(D.CHAIN_P.n, row, o.n1); if (!(p0 > 0)) continue;
      const pAllow = p0 * kz, treq = 2.8 * Math.cbrt(o.T * 1e3 * Ke / (z1 * pAllow));
      const cc = D.CHAINS.find(c => c.t === t), Ftc = 2000 * o.T / (t / Math.sin(PI / z1));
      if (t >= treq - 1e-9 && (D.CHAIN_NMAX[t] || 0) >= o.n1 && Ftc * Ke / cc.A <= pAllow) { pick = { t, p0, pAllow, treq }; break; }
    }
    if (!pick) { const t = 50.8; const p0 = interp(D.CHAIN_P.n, D.CHAIN_P[t], o.n1); pick = { t, p0, pAllow: p0 * kz, treq: 2.8 * Math.cbrt(o.T * 1e3 * Ke / (z1 * p0 * kz)) }; }
    rep.eq({ lhs: '[p]', f: '[p]_{табл}\\cdot k_{z}', s: `${n(pick.p0, 3)}\\cdot(1+0{,}01\\cdot(${z1}-17))`, v: pick.pAllow, u: 'МПа', d: `Допускаемое давление в шарнирах для шага ${fnum(pick.t, 0)} мм при n1 = ${fnum(o.n1)} мин⁻¹ (табл. 7.18 [Ч]${o.n1 < 50 ? ', при n1 < 50 мин⁻¹ — как для 50 мин⁻¹' : ''}) с поправкой на z1 ≠ 17.`, ref: ['ch', 'табл. 7.18'] });
    rep.eq({ lhs: 't', f: `2{,}8\\cdot \\sqrt[3]{\\dfrac{${o.Tsym}\\cdot 10^{3}\\cdot K_{э}}{z_{зв1}\\cdot [p]}}`, s: `2{,}8\\cdot \\sqrt[3]{\\dfrac{${n(o.T)}\\cdot 10^{3}\\cdot ${n(Ke, 3)}}{${z1}\\cdot ${n(pick.pAllow, 3)}}}`, v: pick.treq, u: 'мм', cmp: '\\ge', d: 'Расчётный шаг цепи из условия износостойкости шарниров (формула 7.38 [Ч], момент — в Н·мм, однорядная цепь).' });
    const ch = D.CHAINS.find(c => c.t === pick.t);
    R.chain = ch; R.t = pick.t; R.z1 = z1; R.z2 = z2; R.Ke = Ke; R.pAllow = pick.pAllow;
    R.code = `ПР-${String(ch.t).replace('.', ',')}-${Math.round(ch.Q * 100)}`;
    rep.p(`Принимаем цепь ${R.code} ГОСТ 13568-75 [[ch|табл. 7.15]]: шаг <i>t</i> = ${fnum(ch.t, 0)} мм, разрушающая нагрузка <i>Q</i> = ${fnum(ch.Q, 0)} кН, масса 1 м <i>q</i> = ${fnum(ch.q, 0)} кг/м, проекция опорной поверхности шарнира <i>A</i><sub>оп</sub> = ${fnum(ch.A, 0)} мм², диаметр ролика <i>d</i><sub>1</sub> = ${fnum(ch.d1, 0)} мм, ширина цепи <i>b</i> = ${ch.b} мм.`);
    const dd1 = ch.t / Math.sin(PI / z1), dd2 = ch.t / Math.sin(PI / z2);
    rep.eq({ lhs: 'd_{д1}', f: '\\dfrac{t}{\\sin(180^{\\circ}/z_{зв1})}', s: `\\dfrac{${nx(ch.t)}}{\\sin(180^{\\circ}/${z1})}`, v: dd1, u: 'мм', d: 'Делительный диаметр ведущей звёздочки.' });
    rep.eq({ lhs: 'd_{д2}', f: '\\dfrac{t}{\\sin(180^{\\circ}/z_{зв2})}', s: `\\dfrac{${nx(ch.t)}}{\\sin(180^{\\circ}/${z2})}`, v: dd2, u: 'мм', d: 'Делительный диаметр ведомой звёздочки.' });
    const De = z => ch.t * (1 / Math.tan(PI / z) + 0.7) - 0.31 * ch.d1;
    R.De1 = De(z1); R.De2 = De(z2);
    rep.eq({ lhs: 'D_{e1}', f: 't\\,(\\operatorname{ctg}(180^{\\circ}/z_{зв1})+0{,}7)-0{,}31\\,d_{1}', s: `${nx(ch.t)}\\cdot(\\operatorname{ctg}(180^{\\circ}/${z1})+0{,}7)-0{,}31\\cdot ${nx(ch.d1)}`, v: R.De1, u: 'мм', d: 'Наружный диаметр ведущей звёздочки по ГОСТ 592-81 (формула 7.35 [Ч]).' });
    rep.eq({ lhs: 'D_{e2}', f: 't\\,(\\operatorname{ctg}(180^{\\circ}/z_{зв2})+0{,}7)-0{,}31\\,d_{1}', s: `${nx(ch.t)}\\cdot(\\operatorname{ctg}(180^{\\circ}/${z2})+0{,}7)-0{,}31\\cdot ${nx(ch.d1)}`, v: R.De2, u: 'мм' });
    const a = o.aRatio * ch.t;
    rep.eq({ lhs: 'a', f: `${nx(o.aRatio)}\\cdot t`, s: `${nx(o.aRatio)}\\cdot ${nx(ch.t)}`, v: a, u: 'мм', d: 'Оптимальное межосевое расстояние принимается в интервале (30…50)t.' });
    const LpRaw = 2 * a / ch.t + (z1 + z2) / 2 + (z2 - z1) ** 2 * ch.t / (4 * PI * PI * a);
    let Lp = Math.round(LpRaw); if (Lp % 2) Lp += 1;
    rep.eq({ lhs: 'L_{p}', f: '\\dfrac{2a}{t}+\\dfrac{z_{зв1}+z_{зв2}}{2}+\\dfrac{(z_{зв2}-z_{зв1})^{2}\\,t}{4\\pi^{2}a}', s: `\\dfrac{2\\cdot ${n(a)}}{${nx(ch.t)}}+\\dfrac{${z1}+${z2}}{2}+\\dfrac{(${z2}-${z1})^{2}\\cdot ${nx(ch.t)}}{4\\pi^{2}\\cdot ${n(a)}}`, v: LpRaw, raw: `${n(LpRaw)}\\ \\Rightarrow\\ ${Lp}`, d: 'Число звеньев цепи, округляется до ближайшего чётного (чтобы не применять переходное звено).' });
    const w = Lp - (z1 + z2) / 2, as = 0.25 * ch.t * (w + Math.sqrt(w * w - 2 * ((z2 - z1) / PI) ** 2));
    rep.eq({ lhs: 'a^{*}', f: '0{,}25\\,t\\left[L_{p}-\\dfrac{z_{зв1}+z_{зв2}}{2}+\\sqrt{\\left(L_{p}-\\dfrac{z_{зв1}+z_{зв2}}{2}\\right)^{2}-2\\left(\\dfrac{z_{зв2}-z_{зв1}}{\\pi}\\right)^{2}}\\,\\right]', s: `0{,}25\\cdot ${nx(ch.t)}\\left[${Lp}-${n((z1 + z2) / 2)}+\\sqrt{${sq(w)}^{2}-2\\left(\\dfrac{${z2 - z1}}{\\pi}\\right)^{2}}\\,\\right]`, v: as, u: 'мм', d: 'Уточнённое межосевое расстояние по принятому числу звеньев.' });
    const am = as * (1 - 0.003);
    rep.eq({ lhs: 'a_{монт}', f: 'a^{*}-0{,}003\\,a^{*}', s: `${n(as)}-0{,}003\\cdot ${n(as)}`, v: am, u: 'мм', d: 'Монтажное межосевое расстояние: уменьшение на 0,2…0,4 % обеспечивает нормальное провисание цепи.' });
    const nmax = D.CHAIN_NMAX[ch.t];
    rep.check(`n_{1}=${n(o.n1)}\\ \\text{мин}^{-1}\\ \\le\\ [n_{1}]=${nmax}\\ \\text{мин}^{-1}`, o.n1 <= nmax, `Частота вращения ведущей звёздочки допустима (табл. 7.17 [Ч]).`);
    const U = 4 * z1 * o.n1 / (60 * Lp);
    rep.eq({ lhs: 'U', f: '\\dfrac{4\\cdot z_{зв1}\\cdot n_{1}}{60\\cdot L_{p}}', s: `\\dfrac{4\\cdot ${z1}\\cdot ${n(o.n1)}}{60\\cdot ${Lp}}`, v: U, u: 'с⁻¹', d: 'Число ударов цепи о зубья звёздочек в секунду.' });
    rep.check(`U=${n(U)}\\ \\text{с}^{-1}\\ \\le\\ [U]=20\\ \\text{с}^{-1}`, U <= 20, '');
    const Ft = 2000 * o.T / dd1;
    rep.eq({ lhs: 'F_{t.цеп}', f: `\\dfrac{2000\\cdot ${o.Tsym}}{d_{д1}}`, s: `\\dfrac{2000\\cdot ${n(o.T)}}{${n(dd1)}}`, v: Ft, u: 'Н', d: 'Окружная сила, передаваемая цепью.' });
    const pp = Ft * Ke / ch.A;
    rep.eq({ lhs: 'p', f: '\\dfrac{F_{t.цеп}\\cdot K_{э}}{A_{оп}}', s: `\\dfrac{${n(Ft)}\\cdot ${n(Ke, 3)}}{${nx(ch.A)}}`, v: pp, u: 'МПа', d: 'Расчётное давление в шарнирах цепи.' });
    rep.check(`p=${n(pp)}\\ \\text{МПа}\\ \\le\\ [p]=${n(pick.pAllow)}\\ \\text{МПа}`, pp <= pick.pAllow * 1.0001, pp <= pick.pAllow ? 'Износостойкость шарниров обеспечена.' : 'Давление в шарнирах превышает допускаемое.');
    const v = z1 * ch.t * o.n1 / 60e3, Fv = ch.q * v * v, kf = o.angle >= 70 ? 1 : o.angle >= 40 ? 1.5 : 6, Ff = 9.81 * kf * ch.q * am / 1000;
    const s = ch.Q * 1e3 / (Ft * o.Kd + Fv + Ff), sAllow = interp(D.CHAIN_S.n, D.CHAIN_S[ch.t], o.n1);
    rep.eq({ lhs: 's', f: '\\dfrac{Q}{F_{t.цеп}\\,K_{д}+F_{v}+F_{f}}', s: `\\dfrac{${n(ch.Q * 1e3)}}{${n(Ft)}\\cdot ${nx(o.Kd)}+${n(Fv, 3)}+${n(Ff, 3)}}`, v: s, d: `Коэффициент запаса прочности цепи (формула 7.40 [Ч]): скорость цепи v = ${fnum(v, 3)} м/с, центробежная сила Fv = q·v², сила от провисания Ff = 9,81·kf·q·a (kf = ${kf}).` });
    rep.check(`s=${n(s)}\\ \\ge\\ [s]=${n(sAllow)}`, s >= sAllow, 'Нормативный запас — по табл. 7.19 [Ч].');
    const Kv = o.angle >= 40 ? o.Kv2 : o.Kv1, Fc = Kv * Ft;
    rep.eq({ lhs: 'F_{цеп}', f: 'K_{в}\\cdot F_{t.цеп}', s: `${nx(Kv)}\\cdot ${n(Ft)}`, v: Fc, u: 'Н', d: `Нагрузка на валы от цепной передачи (Kв = ${fnum(Kv, 0)} — для ${o.angle >= 40 ? 'наклонной или вертикальной' : 'горизонтальной'} передачи), направлена по линии центров звёздочек.` });
    Object.assign(R, { dd1, dd2, a, Lp, as, am, U, Ft, p: pp, Fc, Kv, s, v });
    return R;
  }

  /* ---------- муфта МУВП ---------- */
  function couplingPick(T, d1, d2, n) {
    const dmax = Math.max(d1, d2);
    for (const c of D.MUVP) {
      if (c.T < T || c.n < n) continue;
      const bores = c.d.concat(c.d2nd);
      const fits = dd => D.MUVP.some(x => x.T === c.T && x.d.concat(x.d2nd).includes(dd));
      if (fits(d1) && fits(d2)) return { c, bore1: d1, bore2: d2, exact: true };
      if (bores.some(b => b >= dmax)) { const b = bores.filter(x => x >= dmax).sort((a, b) => a - b)[0]; return { c, bore1: b, bore2: b, exact: false }; }
    }
    return { c: D.MUVP[D.MUVP.length - 1], bore1: dmax, bore2: dmax, exact: false };
  }
  function muvpRow(T, d) { return D.MUVP.find(x => x.T === T && x.d.concat(x.d2nd).includes(d)) || D.MUVP.find(x => x.T === T); }

  /* ---------- корпус (литой чугунный) ---------- */
  function housing(rep, o) {
    // o: { aw, awSym, kind: 'met' }
    const R = {};
    const ar = o.aw;
    const del = Math.max(8, Math.ceil(0.025 * ar + 3)), del1 = Math.max(8, Math.ceil(0.02 * ar + 3));
    rep.eq({ lhs: '\\delta', f: `0{,}025\\cdot ${o.awSym}+3`, s: `0{,}025\\cdot ${n(ar)}+3`, v: 0.025 * ar + 3, raw: `${n(0.025 * ar + 3)}\\ \\Rightarrow\\ ${del}`, u: 'мм', cmp: '\\ge', d: 'Толщина стенки основания корпуса; принимается не менее 8 мм по условиям литья.' });
    rep.eq({ lhs: '\\delta_{1}', f: `0{,}02\\cdot ${o.awSym}+3`, s: `0{,}02\\cdot ${n(ar)}+3`, v: 0.02 * ar + 3, raw: `${n(0.02 * ar + 3)}\\ \\Rightarrow\\ ${del1}`, u: 'мм', cmp: '\\ge', d: 'Толщина стенки крышки редуктора.' });
    R.del = del; R.del1 = del1;
    R.b = Math.round(1.5 * del); R.b1 = Math.round(1.5 * del1); R.p = Math.round(2.35 * del); R.c = Math.round(0.85 * del);
    rep.eq({ lhs: 'b', f: '1{,}5\\cdot \\delta', s: `1{,}5\\cdot ${del}`, v: 1.5 * del, raw: `${n(1.5 * del)}\\ \\Rightarrow\\ ${R.b}`, u: 'мм', d: 'Толщина верхнего фланца (пояса) корпуса.' });
    rep.eq({ lhs: 'b_{1}', f: '1{,}5\\cdot \\delta_{1}', s: `1{,}5\\cdot ${del1}`, v: 1.5 * del1, raw: `${n(1.5 * del1)}\\ \\Rightarrow\\ ${R.b1}`, u: 'мм', d: 'Толщина нижнего фланца крышки.' });
    rep.eq({ lhs: 'p', f: '2{,}35\\cdot \\delta', s: `2{,}35\\cdot ${del}`, v: 2.35 * del, raw: `${n(2.35 * del)}\\ \\Rightarrow\\ ${R.p}`, u: 'мм', d: 'Толщина нижнего пояса корпуса (лап) без бобышек.' });
    rep.eq({ lhs: "c'", f: '0{,}85\\cdot \\delta', s: `0{,}85\\cdot ${del}`, v: 0.85 * del, raw: `${n(0.85 * del)}\\ \\Rightarrow\\ ${R.c}`, u: 'мм', d: 'Толщина рёбер жёсткости.' });
    const d1r = 0.03 * ar + 12; R.d1 = bolt(d1r); if (R.d1 < 16) R.d1 = 16;
    rep.eq({ lhs: 'd_{ф}', f: `0{,}03\\cdot ${o.awSym}+12`, s: `0{,}03\\cdot ${n(ar)}+12`, v: d1r, raw: `${n(d1r)}\\ \\Rightarrow\\ \\text{М}${R.d1}`, u: 'мм', d: 'Диаметр фундаментных болтов, округляется до стандартной резьбы М16…М24.' });
    R.d2 = bolt(0.72 * R.d1); R.d3 = bolt(0.55 * R.d1); R.d4 = Math.max(6, bolt(0.35 * R.d1));
    rep.eq({ lhs: 'd_{п}', f: '(0{,}7\\ldots 0{,}75)\\cdot d_{ф}', s: `(0{,}7\\ldots 0{,}75)\\cdot ${R.d1}`, raw: `${n(0.7 * R.d1)}\\ldots ${n(0.75 * R.d1)}\\ \\Rightarrow\\ \\text{М}${R.d2}`, u: 'мм', d: 'Болты у подшипниковых гнёзд.' });
    rep.eq({ lhs: 'd_{к}', f: '(0{,}5\\ldots 0{,}6)\\cdot d_{ф}', s: `(0{,}5\\ldots 0{,}6)\\cdot ${R.d1}`, raw: `${n(0.5 * R.d1)}\\ldots ${n(0.6 * R.d1)}\\ \\Rightarrow\\ \\text{М}${R.d3}`, u: 'мм', d: 'Болты, соединяющие крышку с корпусом.' });
    rep.eq({ lhs: 'd_{с}', f: '(0{,}3\\ldots 0{,}4)\\cdot d_{ф}', s: `(0{,}3\\ldots 0{,}4)\\cdot ${R.d1}`, raw: `${n(0.3 * R.d1)}\\ldots ${n(0.4 * R.d1)}\\ \\Rightarrow\\ \\text{М}${R.d4}`, u: 'мм', d: 'Винты крепления смотровой крышки.' });
    R.s = Math.round(1.5 * del); R.K2 = Math.ceil(2.1 * R.d1); R.K = Math.round(3 * R.d3); R.K1 = Math.round(2.5 * R.d3);
    rep.eq({ lhs: 'K_{2}', f: '2{,}1\\cdot d_{ф}', s: `2{,}1\\cdot ${R.d1}`, v: 2.1 * R.d1, raw: `${n(2.1 * R.d1)}\\ \\Rightarrow\\ ${R.K2}`, u: 'мм', cmp: '\\ge', d: 'Ширина нижнего фланца корпуса.' });
    rep.eq({ lhs: 'K', f: '3\\cdot d_{к}', s: `3\\cdot ${R.d3}`, v: 3 * R.d3, u: 'мм', d: 'Ширина соединительных фланцев около подшипников.' });
    rep.eq({ lhs: 'K_{1}', f: '2{,}5\\cdot d_{к}', s: `2{,}5\\cdot ${R.d3}`, v: 2.5 * R.d3, u: 'мм' });
    R.gap = Math.max(10, Math.ceil(1.1 * del)); R.gapBot = Math.ceil(3.5 * del);
    rep.eq({ lhs: 'c', f: '(1{,}0\\ldots 1{,}2)\\cdot \\delta', s: `(1{,}0\\ldots 1{,}2)\\cdot ${del}`, raw: `${n(del)}\\ldots ${n(1.2 * del)}\\ \\Rightarrow\\ ${R.gap}`, u: 'мм', d: 'Зазор между вращающимися деталями и внутренними стенками корпуса (не менее 8…10 мм).' });
    rep.eq({ lhs: '\\Delta', f: '(3\\ldots 4)\\cdot \\delta', s: `(3\\ldots 4)\\cdot ${del}`, raw: `${3 * del}\\ldots ${4 * del}\\ \\Rightarrow\\ ${R.gapBot}`, u: 'мм', d: 'Зазор между дном корпуса и вершинами зубьев колеса — для отстоя продуктов износа.' });
    R.dpr = bolt(Math.max(1.6 * R.d3, 12)); if (R.dpr < 1.6 * R.d3) R.dpr = up(1.6 * R.d3, D.STD.bolt);
    rep.eq({ lhs: 'd_{пр}', f: '(1{,}6\\ldots 2{,}2)\\cdot d_{к}', s: `(1{,}6\\ldots 2{,}2)\\cdot ${R.d3}`, raw: `${n(1.6 * R.d3)}\\ldots ${n(2.2 * R.d3)}\\ \\Rightarrow\\ \\text{М}${R.dpr}\\times 1{,}5`, u: 'мм', d: 'Резьба сливной пробки (ГОСТ 19421-74).' });
    R.dks = 8;
    return R;
  }

  root.MECH = { SYM, tSum, steelSb, shaftStd, bolt, key, keyLen, seal, std5, pickMotor, motorCandidates, loadFactor, beam, momentEq, torsionD, shaftCheck, keyCheck, keyHubNeed, bearingCalc, bearingList, chainCalc, couplingPick, muvpRow, housing, Wnet, kSigma, lst };
})(typeof window !== 'undefined' ? window : globalThis);
