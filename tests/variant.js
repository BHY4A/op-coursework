/* tests/variant.js — проверка одного варианта (запускается из run.js в отдельном процессе).
   Выводит JSON: листы, размеры на листах (для сравнения со снимком), замечания линтера, нарушения инвариантов. */
'use strict';
const { load } = require('./load');

const no = +process.argv[2];
// необязательный третий аргумент — сочетание настроек: {"O": {расчётные настройки}, "T": {настройки чертежей}}
const OPT = process.argv[3] ? JSON.parse(process.argv[3]) : {};
const ctx = load();
const out = { no, sheets: {}, specs: 0, fails: [], ms: 0 };
const fail = m => out.fails.push(m);
const t0 = Date.now();
try {
  const TC = ctx.TASKS_CALC, P = TC.defaults(no);
  Object.assign(P.O, OPT.O || {});
  const R = TC['task' + P.task](P);
  out.task = P.task;
  const K = ctx.KOMPAS, T = Object.assign({ student: 'Тест', group: '741-15' }, OPT.T || {});
  const S = K.sheets(R, P, T);
  const ids = S.list.map(d => d.id);
  // обязательные листы
  const REQ = { 1: ['reduktor_sb', 'obshiy_vid', 'rama_sb', 'korpus', 'eskiz_vo'], 3: ['reduktor_sb', 'obshiy_vid', 'rama_sb', 'korpus', 'eskiz_vo'], 6: ['reduktor_sb', 'obshiy_vid', 'val_baraban_sb', 'korpus', 'eskiz_vo'] }[P.task];
  REQ.forEach(id => { if (!ids.includes(id)) fail(`нет листа ${id}`); });
  if (R.pre && !ids.includes('eskiz_vo_do')) fail('проверки изменили размеры, но нет эскиза «до проверок»');
  // межосевые расстояния из расчёта — с точностью расчёта и с допуском (без округления до целого)
  const nf3 = v => String(Math.round(v * 1000) / 1000).replace('.', ',');
  const aws = [R.g, R.gB, R.gT].filter(g => g && g.aw > 0 && !(g === R.g && R.task === 1)).map(g => g.aw);
  for (const d of S.list) {
    const texts = d.sh.p.filter(q => q.t === 'T' && !q.pos).map(q => String(q.s));
    // размеры: короткие надписи (числа, ⌀, допуски, количество отверстий)
    const dims = texts.filter(s => s.length <= 24 && /\d/.test(s) && !/^\d+\.\s/.test(s)).sort();
    if (texts.some(s => /[⁻¹]/.test(s))) fail(`${d.id}: в надписи остался символ верхнего индекса (его нет в шрифте ГОСТ)`);
    if (['reduktor_sb', 'korpus'].includes(d.id)) aws.forEach(aw => { if (!texts.some(s => s.startsWith(nf3(aw) + '±'))) fail(`${d.id}: нет межосевого ${nf3(aw)} с допуском`); });
    // обозначения для КОМПАС (размеры, выноски, позиции): описание есть, запасные отрезки есть, точки привязки — на концах линий
    const sdat = K.sheetData(d);
    (sdat.dims || []).filter(m => 'HVLP'.includes(m.k)).forEach(m => { const L = m.p.filter(q => q[0] === 'L'); const near = (x, y) => L.some(q => Math.hypot(q[1] - x, q[2] - y) < 0.6 || Math.hypot(q[3] - x, q[4] - y) < 0.6); if (!m.p.length || !near(m.a[0], m.a[1]) || !near(m.a[2], m.a[3])) fail(`${d.id}: размер «${m.t}» для КОМПАС не совпадает с нарисованным`); });
    // замечания линтера — на итоговом листе (после разрывов осевых и штриховки под надписями)
    d.sh.finalize();
    const lint = ctx.DRWLINT.lint(d.sh).map(q => q.msg);
    out.sheets[d.id] = { dims, lint: lint.length, lintMsgs: lint.slice(0, 40) };
  }
  // спецификации
  const sp = K.specSheets(R, P, T);
  out.specs = sp.length;
  if (!sp.length) fail('нет спецификаций');
  sp.forEach(d => { if (!d.sh.p.length) fail(`пустая спецификация ${d.id}`); });
  // режим «без размеров»: ни одного размера на СБ редуктора (проверяется на первом варианте каждого задания — это вторая полная сборка листов)
  if (no % 10 === 1 && !process.argv[3]) {
  const Snd = K.sheets(R, P, Object.assign({}, T, { noDims: true }));
  const sb = Snd.list.find(d => d.id === 'reduktor_sb');
  if (sb && sb.sh.p.some(q => q.t === 'T' && /^⌀|±/.test(String(q.s)))) fail('режим «без размеров»: на СБ остались размеры');
  if (ctx.DRWCORE.opts.noDims) fail('флаг «без размеров» не сброшен после построения');
  }
} catch (e) { fail('исключение: ' + (e && e.stack || e)); }
out.ms = Date.now() - t0;
process.stdout.write(JSON.stringify(out));
