'use strict';
/* Сочетания настроек: каждый вариант с каждой настройкой, которую можно поменять в утилите, — все методики расчёта,
   все подходящие двигатели, константы методики на краях диапазона и настройки чертежей (js/opt_combos.js). Пользователь может выбрать любое из них —
   листы и макрос КОМПАС должны строиться без сбоев и без лишних наложений.
   node tests/combos.js [варианты | all] [--quick] [--no-emu] [--only подстрока]
   --redo файл — только сочетания с замечаниями из вывода прошлого прогона.
   --only — только сочетания, в названии которых есть подстрока (например, --only двигатель).
   --quick — по три сочетания на вариант (по кругу), иначе все (≈1500, несколько часов). Для каждого сочетания: tests/variant.js (листы, линтер)
   и эмулятор КОМПАС (tests/kompas_emu.js). Ошибки и сбои — код выхода 1; замечания линтера сверх варианта по умолчанию — в сводке. */
const path = require('path'), os = require('os'), { execFile } = require('child_process');
const { load } = require('./load.js');
const ctx = load(path.join(__dirname, '..'));
const args = process.argv.slice(2);
const sel = (args[0] && !args[0].startsWith('--') ? args[0] : 'all').toLowerCase();
const vars = sel === 'all' || sel.startsWith('--') ? Array.from({ length: 26 }, (_, i) => i + 1) : sel.split(',').map(Number);
const quick = args.includes('--quick'), emu = !args.includes('--no-emu');
const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;
// --redo файл — только сочетания, отмеченные в выводе прошлого прогона (строки «△ № N, название» / «✗ № N, название»)
const redo = args.includes('--redo') ? new Set(require('fs').readFileSync(args[args.indexOf('--redo') + 1], 'utf8').split('\n')
  .map(l => /^[△✗] № (\d+), (.+)$/.exec(l.trim())).filter(Boolean).map(m => m[1] + '|' + m[2])) : null;

// все сочетания — из js/opt_combos.js (их же предлагает отладочный KOMPAS Build на сайте)
const combos = no => ctx.OPT_COMBOS(no);

const run = (file, a) => new Promise(res => execFile(process.execPath, [path.join(__dirname, file), ...a], { maxBuffer: 64 << 20, timeout: 900000 },
  (err, stdout, stderr) => res({ err, stdout: String(stdout), stderr: String(stderr) })));

(async () => {
  const jobs = [];
  vars.forEach((no, i) => {
    const all = combos(no).filter(c => (!only || c.name.includes(only) || c.key.startsWith(only)) && (!redo || redo.has(no + '|' + c.name)));
    const pick = quick ? [0, 1, 2].map(k => all[(3 * i + k) % all.length]) : all;
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
      // замечания печатаются сразу (длинный прогон идёт часами), итог — ещё раз в конце
      if (msgs.length) console.log('\n' + lines[lines.length - 1]); else process.stdout.write('.');
    }
  }
  await Promise.all(Array.from({ length: N }, worker));
  console.log('\n' + lines.sort((a, b) => a.localeCompare(b, 'ru', { numeric: true })).filter(l => !l.startsWith('✓')).join('\n'));
  console.log(`\nСочетаний: ${jobs.length}, со сбоями: ${bad}, время ${Math.round((Date.now() - t0) / 1000)} с`);
  process.exit(bad ? 1 : 0);
})();
