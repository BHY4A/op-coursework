'use strict';
/* Прогон макроса чертежей (30_drawings) в эмуляторе КОМПАС (tests/kompas_emu) по вариантам.
   node tests/kompas_emu.js [варианты через запятую | all] [--png папка]
   Ошибки, которые настоящий КОМПАС тоже выдал бы (нет свойства, не тот тип, не передан аргумент, нет интерфейса),
   и падения макроса — код выхода 1; так же — если модель хуже сходится с журналами калибровки настоящего КОМПАС (kompas_emu/cal). Обозначения, нарисованные отрезками вместо объектов КОМПАС, — в сводке. */
const fs = require('fs'), path = require('path'), os = require('os'), cp = require('child_process');
const { load } = require('./load.js');
const ROOT = path.join(__dirname, '..');
const ctx = load(ROOT);
const TC = ctx.TASKS_CALC;
const args = process.argv.slice(2);
const pngDir = args.includes('--png') ? args[args.indexOf('--png') + 1] : null;
const sel = (args[0] && !args[0].startsWith('--') ? args[0] : '4,16,22').toLowerCase();
const vars = sel === 'all' ? Array.from({ length: 26 }, (_, i) => i + 1) : sel.split(',').map(Number);
// --opt '{"O": {…}, "T": {…}}' — сочетание расчётных настроек и настроек чертежей (tests/combos.js)
const OPT = args.includes('--opt') ? JSON.parse(args[args.indexOf('--opt') + 1]) : {};
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kemu-'));
let bad = 0;
const tot = {};
for (const v of vars) {
  const P = TC.defaults(v);
  Object.assign(P.O, OPT.O || {});
  const R = TC['task' + P.task](P);
  const dir = path.join(tmp, 'v' + v), out = path.join(dir, 'out');
  fs.mkdirSync(dir, { recursive: true });
  for (const f of ctx.KOMPAS.files(R, P, OPT.T || {})) if (f.path === '30_drawings.py') fs.writeFileSync(path.join(dir, f.path), f.gen());
  const t0 = Date.now();
  const r = cp.spawnSync('python3', [path.join(__dirname, 'kompas_emu', 'run.py'), path.join(dir, '30_drawings.py'), out], { encoding: 'utf8', timeout: 900000 });
  let rep = null;
  try { rep = JSON.parse(fs.readFileSync(path.join(out, 'emu_report.json'), 'utf8')); } catch (e) { /* ниже */ }
  const log = fs.existsSync(path.join(out, 'log.txt')) ? fs.readFileSync(path.join(out, 'log.txt'), 'utf8') : '';
  const errs = (rep ? rep.notes : []).filter(n => n[0] === 'ошибка КОМПАС' || n[0] === 'нет интерфейса').map(n => n[1]);
  const gaps = (rep ? rep.notes : []).filter(n => n[0] === 'нет в эмуляторе').map(n => n[1]);
  const fails = log.split('\n').filter(l => /НЕ ВЫПОЛНЕНО|объектами КОМПАС — /.test(l)).map(l => l.slice(9));
  const lines = [];
  for (const m of log.matchAll(/итого (.+?): объектами КОМПАС (\d+), отрезками (\d+)/g)) {
    tot[m[1]] = tot[m[1]] || [0, 0]; tot[m[1]][0] += +m[2]; tot[m[1]][1] += +m[3];
    if (+m[3]) lines.push(m[1] + ' ' + m[3]);
  }
  const ov = rep ? rep.sheets.reduce((a, s) => a + s.overlaps.length, 0) : 0;
  const ok = rep && !rep.crash && !errs.length && !fails.length;
  if (!ok) bad++;
  console.log(`вар. ${v}: ${ok ? 'ok' : 'ОШИБКИ'} — листов ${rep ? rep.sheets.length : 0}, отрезками: ${lines.join(', ') || 'нет'}, наложений надписей ${ov} (${((Date.now() - t0) / 1000).toFixed(1)} с)`);
  if (!rep) console.log('   эмулятор не отработал:\n' + (r.stderr || '').split('\n').slice(-15).join('\n'));
  else if (rep.crash) console.log('   ПАДЕНИЕ:\n' + rep.crash.split('\n').slice(-8).join('\n'));
  for (const e of errs) console.log('   КОМПАС: ' + e);
  for (const e of fails) console.log('   макрос: ' + e);
  for (const g of gaps) console.log('   (нет в эмуляторе: ' + g + ')');
  if (rep) for (const s of rep.sheets) for (const o of s.overlaps.slice(0, 3)) console.log(`   наложение на ${s.file}: «${o[0]}» и «${o[2]}», ${o[4]} мм²`);
  if (pngDir) {
    fs.mkdirSync(path.join(pngDir, 'v' + v), { recursive: true });
    for (const f of fs.readdirSync(out)) if (/\.png$|^log\.txt$/.test(f)) fs.copyFileSync(path.join(out, f), path.join(pngDir, 'v' + v, f));
  }
}
console.log('\nИтого по видам обозначений (объектами КОМПАС / отрезками):');
for (const [k, [a, b]] of Object.entries(tot).sort()) console.log(`  ${k}: ${a} / ${b}`);
console.log(`\nВариантов: ${vars.length}, с ошибками: ${bad}`);
// модель эмулятора против журналов калибровки настоящего КОМПАС (tests/kompas_emu/cal/*.meta.json): не стала ли хуже
let calBad = 0;
const calDir = path.join(__dirname, 'kompas_emu', 'cal');
for (const f of fs.existsSync(calDir) ? fs.readdirSync(calDir).filter(f => f.endsWith('.meta.json')).sort() : []) {
  const r = cp.spawnSync('python3', [path.join(__dirname, 'kompas_emu', 'calcmp.py'), '--check', path.join(calDir, f)], { encoding: 'utf8', cwd: ROOT });
  process.stdout.write(r.stdout || '');
  if (r.status) { calBad++; process.stdout.write(r.stderr || ''); }
}
process.exit(bad || calBad ? 1 : 0);
