/* Сочетания настроек, которые пользователь может выбрать в утилите, — для тестов (tests/combos.js) и отладочного KOMPAS Build.
   Каждое сочетание меняет одну настройку относительно умолчания: расчётные методики (раздел «Методика расчёта»),
   двигатель (частота и любой подходящий из списка), константы методики (на краях разумного диапазона) и настройки чертежей.
   OPT_COMBOS(no, {calc, motors, consts, drw}) → [{ key, name, O?, T? }]; key — латиница для имени папки. */
(function () {
  'use strict';
  const TC = () => window.TASKS_CALC, D = () => window.DATA;
  // методики: [ключ, задания, значения с подписями] — как в app.js (раздел 3); значение по умолчанию пропускается
  const SEG = [
    ['sync', [1, 3, 6], [[1500, 'двигатель 1500 мин⁻¹'], [1000, 'двигатель 1000 мин⁻¹'], [3000, 'двигатель 3000 мин⁻¹']]],
    ['uChain', [3, 6], [[2, 'u цепи 2'], [2.5, 'u цепи 2,5'], [3, 'u цепи 3']]],
    ['autoFix', [1, 3, 6], [[false, 'без автосогласования']]],
    ['wormAw', [3], [['ch', 'aw червячной по Чернавскому']]],
    ['wormSH', [3], [['ch', '[σ]H червячного колеса по таблицам [Ч]']]],
    ['KHLmode', [3], [['ch', 'KHL по Чернавскому']]],
    ['etaWpre', [3], [[0.7, 'предв. КПД червячной 0,70'], [0.75, 'предв. КПД червячной 0,75'], [0.8, 'предв. КПД червячной 0,80']]],
    ['wormDeg', [3], [[7, 'степень точности 7'], [8, 'степень точности 8']]],
    ['wormNe', [3], [['load', 'циклы по графику нагрузки']]],
    ['wormSHcheck', [3], [['ch', 'проверка σH червячной по Чернавскому']]],
    ['awRow', [1, 6], [[1, 'aw — 1-й ряд']]],
    ['zMode', [1, 6], [['sum', 'z через zΣ']]],
    ['t1Coup', [1], [['scheme', 'T2Т по схеме']]],
    ['Fm1', [1], [[true, 'сила от муфты на быстроходном валу']]],
    ['wKey', [1, 3, 6], [['met', 'сечение с пазом: dрасч = 0,9d'], ['net', 'сечение с пазом: W с учётом паза']]],
    ['keyExact', [1, 3, 6], [[true, 'шпонки уточнённо']]],
    ['FmMode', [3, 6], [['gost', 'Fм по ГОСТ 16162']]],
    ['awT6', [6], [['pin', 'aw по моменту шестерни']]],
  ];
  // константы методики (раздел 3, «Константы методики»): [ключ, задания, подпись, низкое, высокое]
  const mul = k => v => +(v * k).toPrecision(3);
  const eta = d => v => Math.min(0.995, +(v + d).toFixed(3));
  const CONST = [
    ['etaM', [1, 3, 6], 'КПД муфты', eta(-0.02), eta(0.01)],
    ['etaB', [1, 3, 6], 'КПД подшипников', eta(-0.01), eta(0.005)],
    ['etaCh', [3, 6], 'КПД цепной', eta(-0.03), eta(0.03)],
    ['etaCyl', [1, 6], 'КПД цилиндрической', eta(-0.02), eta(0.01)],
    ['etaCon', [1], 'КПД конической', eta(-0.02), eta(0.01)],
    ['tauI', [1, 3, 6], '[τ] быстроходного вала', mul(0.75), mul(1.25)],
    ['tauII', [1, 3, 6], '[τ] тихоходного вала', mul(0.8), mul(1.2)],
    ['nz', [1, 3, 6], 'запас прочности вала', mul(0.75), mul(1.25)],
    ['Kri', [1, 3, 6], 'Kри', mul(1), mul(1.3)],
    ['betaSh', [1, 3, 6], 'βш', mul(0.9), mul(1.05)],
    ['Kb', [1, 3, 6], 'Kб подшипников', () => 1, () => 1.8],
    ['sCmSteel', [1, 3, 6], '[σ]см стальной ступицы', mul(0.75), mul(1.2)],
    ['sCmCI', [1, 3, 6], '[σ]см чугунной ступицы', mul(0.75), mul(1.2)],
    ['chainAngle', [3, 6], 'наклон цепи', () => 0, v => (v === 45 ? 90 : 45)],
    ['t0', [3], 'температура воздуха', () => 30, () => 10],
    ['Kt', [3], 'Kt теплопередачи', () => 9, () => 17],
  ];
  const fnum = v => String(v).replace('.', ',');
  function combos(no, sel) {
    sel = Object.assign({ calc: true, motors: true, consts: true, drw: true }, sel || {});
    const P0 = TC().defaults(no), task = P0.task, O0 = P0.O, out = [];
    const add = (key, name, O, T) => out.push(O ? { key, name, O } : { key, name, T });
    if (sel.calc) SEG.forEach(([k, ts, vals]) => { if (ts.includes(task)) vals.forEach(([v, name]) => { if (v !== O0[k]) add(k + '_' + String(v).replace('.', ''), name, { [k]: v }); }); });
    if (sel.motors) {
      // любой подходящий двигатель из списка «Двигатель» (как в app.js): Pном ≥ Pтреб, по одному на мощность и частоту
      const R0 = TC()['task' + task](P0), cur = R0.motor && R0.motor.type;
      D().MOTORS.filter(m => m.P >= R0.Preq * 0.999).sort((a, b) => a.P - b.P || b.sync - a.sync)
        .filter((m, i, a) => a.findIndex(x => x.sync === m.sync && x.P === m.P) === i).slice(0, 16)
        .filter(m => m.type !== cur).forEach(m => add('motor_' + String(m.P).replace('.', '') + '_' + m.sync, `двигатель ${m.type} (${fnum(m.P)} кВт, ${m.sync} мин⁻¹)`, { motor: m.type }));
    }
    if (sel.consts) CONST.forEach(([k, ts, name, fl, fh]) => {
      if (!ts.includes(task) || typeof O0[k] !== 'number') return;
      [fl(O0[k]), fh(O0[k])].filter((v, i, a) => v !== O0[k] && a.indexOf(v) === i).forEach(v => add(k + '_' + String(v).replace('.', ''), `${name} = ${fnum(v)} (по умолч. ${fnum(O0[k])})`, { [k]: v }));
    });
    if (sel.drw) {
      ['A4', 'A3', 'A2', 'A0'].forEach(f => add(f, 'листы ' + f.replace('A', 'А'), null, { sheetFmt: f }));
      add('scale1', 'виды в одном масштабе', null, { scaleUniform: true });
      add('lines', 'обозначения отрезками', null, { kompasDims: 'lines' });
    }
    return out;
  }
  window.OPT_COMBOS = combos;
})();
