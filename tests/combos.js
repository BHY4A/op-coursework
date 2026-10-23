'use strict';
/* Сочетания настроек: каждый вариант с другими расчётными настройками (двигатель, передаточное число цепи, методики)
   и настройками чертежей (формат, масштаб видов, отрезки вместо объектов). Пользователь может выбрать любое из них —
   листы и макрос КОМПАС должны строиться без сбоев и без лишних наложений.
   node tests/combos.js [варианты | all] [--quick] [--no-emu]
   --quick — по два сочетания на вариант (по кругу), иначе все. Для каждого сочетания: tests/variant.js (листы, линтер)
   и эмулятор КОМПАС (tests/kompas_emu.js). Ошибки и сбои — код выхода 1; замечания линтера сверх варианта по умолчанию — в сводке. */
const path = require('path'), os = require('os'), { execFile } = require('child_process');
const { load } = require('./load.js');
const ctx = load(path.join(__dirname, '..'));
const args = process.argv.slice(2);
const sel = (args[0] && !args[0].startsWith('--') ? args[0] : 'all').toLowerCase();
const vars = sel === 'all' ? Array.from({ length: 26 }, (_, i) => i + 1) : sel.split(',').map(Number);
const quick = args.includes('--quick'), emu = !args.includes('--no-emu');

function combos(no) {
  const task = ctx.TASKS_CALC.defaults(no).task, out = [];
  const O = (o, name) => out.push({ name, O: o });
  const T = (t, name) => out.push({ name, T: t });
  O({ sync: 1000 }, 'двигатель 1000 мин⁻¹');
  O({ sync: 3000 }, 'двигатель 3000 мин⁻¹');
  if (task !== 1) { O({ uChain: 2 }, 'u цепи 2'); O({ uChain: 3 }, 'u цепи 3'); }
  if (task !== 3) { O({ awRow: 1 }, 'aw — 1-й ряд'); O({ zMode: 'sum' }, 'z через zΣ'); }
  if (task === 3) { O({ wormAw: 'ch' }, 'aw червячной по Чернавскому'); O({ wormSH: 'ch' }, '[σ]H по таблицам [Ч]'); }
  if (task === 6) O({ awT6: 'pin' }, 'aw по моменту шестерни');
  if (task === 1) O({ t1Coup: 'scheme' }, 'T2Т по схеме');
  else O({ FmMode: 'gost' }, 'Fм по ГОСТ 16162');
  O({ autoFix: false }, 'без автосогласования');
  O({ sync: 1000, wKey: task === 1 ? 'net' : 'met', keyExact: true }, 'двигатель 1000 + шпонки иначе');
  T({ sheetFmt: 'A2' }, 'листы А2');
  T({ sheetFmt: 'A0' }, 'листы А0');
  T({ scaleUniform: true }, 'виды в одном масштабе');
  T({ kompasDims: 'lines' }, 'обозначения отрезками');
  return out;
}

const run = (file, a) => new Promise(res => execFile(process.execPath, [path.join(__dirname, file), ...a], { maxBuffer: 64 << 20, timeout: 900000 },
  (err, stdout, stderr) => res({ err, stdout: String(stdout), stderr: String(stderr) })));

(async () => {
  const jobs = [];
  vars.forEach((no, i) => {
    const all = combos(no);
    const pick = quick ? [all[(2 * i) % all.length], all[(2 * i + 1) % all.length]] : all;
    pick.forEach(c => jobs.push({ no, c }));
  });
  // замечания линтера по умолчанию — для сравнения
  const base = {};
  let bad = 0, next = 0;
  const lines = [];
  const N = Math.max(1, os.cpus().length);
  const t0 = Date.now();
  async function worker() {
    while (next < jobs.length) {
      const j = jobs[next++], opt = JSON.stringify({ O: j.c.O || {}, T: j.c.T || {} });
      if (!base[j.no]) base[j.no] = run('variant.js', [String(j.no)]).then(r => { try { return JSON.parse(r.stdout); } catch (e) { return null; } });
      const [r, b] = await Promise.all([run('variant.js', [String(j.no), opt]), base[j.no]]);
      let v = null;
      try { v = JSON.parse(r.stdout); } catch (e) { /* ниже */ }
      const msgs = [];
      if (!v) msgs.push('variant.js не отработал: ' + (r.stderr || String(r.err)).split('\n').slice(-3).join(' '));
      else {
        v.fails.forEach(f => msgs.push(f));
        if (b) for (const [id, s] of Object.entries(v.sheets)) { const d = s.lint - ((b.sheets[id] || {}).lint || 0); if (d > 2) msgs.push(`${id}: замечаний линтера ${s.lint} (по умолчанию ${(b.sheets[id] || {}).lint || 0}) — ${s.lintMsgs.slice(0, 2).join('; ')}`); }
      }
      if (emu) {
        const e = await run('kompas_emu.js', [String(j.no), '--opt', opt]);
        if (e.err) msgs.push('эмулятор КОМПАС: ' + e.stdout.split('\n').filter(l => /ОШИБКИ|КОМПАС:|макрос:|ПАДЕНИЕ/.test(l)).slice(0, 4).join(' | '));
      }
      const hard = msgs.some(m => !/замечаний линтера/.test(m));
      if (hard) bad++;
      lines.push(`${hard ? '✗' : msgs.length ? '△' : '✓'} № ${j.no}, ${j.c.name}${msgs.length ? '\n    ' + msgs.join('\n    ') : ''}`);
      process.stdout.write(hard ? 'x' : '.');
    }
  }
  await Promise.all(Array.from({ length: N }, worker));
  console.log('\n' + lines.sort((a, b) => a.localeCompare(b, 'ru', { numeric: true })).filter(l => !l.startsWith('✓')).join('\n'));
  console.log(`\nСочетаний: ${jobs.length}, со сбоями: ${bad}, время ${Math.round((Date.now() - t0) / 1000)} с`);
  process.exit(bad ? 1 : 0);
})();
