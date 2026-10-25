/* tests/run.js — автотесты утилиты: все 26 вариантов, параллельно.
   npm test             — проверка против эталона tests/baseline.json
   npm run test:update  — принять текущее состояние как эталон (после намеренных изменений)
   node tests/run.js 4 14 — только указанные варианты (эталон не обновляется) */
'use strict';
const { execFile } = require('child_process'), path = require('path'), fs = require('fs'), os = require('os');

const args = process.argv.slice(2), update = args.includes('--update');
const only = args.filter(a => /^\d+$/.test(a)).map(Number);
const list = only.length ? only : Array.from({ length: 26 }, (_, i) => i + 1);
const BASE = path.join(__dirname, 'baseline.json');
const base = fs.existsSync(BASE) ? JSON.parse(fs.readFileSync(BASE, 'utf8')) : {};
const jobs = Math.max(1, Math.min(list.length, (os.availableParallelism ? os.availableParallelism() : os.cpus().length)));

function runOne(no) {
  return new Promise(res => execFile(process.execPath, [path.join(__dirname, 'variant.js'), String(no)], { maxBuffer: 64 << 20, timeout: 600000 }, (err, stdout, stderr) => {
    try { res(JSON.parse(stdout)); } catch (e) { res({ no, fails: ['процесс упал: ' + (stderr || err || 'нет вывода').toString().slice(0, 800)], sheets: {} }); }
  }));
}

(async () => {
  const t0 = Date.now(), results = [];
  let next = 0;
  await Promise.all(Array.from({ length: jobs }, async () => { while (next < list.length) { const no = list[next++]; const r = await runOne(no); results.push(r); process.stdout.write(`  вар. ${String(no).padStart(2)}: ${r.fails.length ? 'ОШИБКИ' : 'ok'} (${((r.ms || 0) / 1000).toFixed(1)} с)\n`); } }));
  results.sort((a, b) => a.no - b.no);
  let bad = 0, changed = 0, lintNow = 0, lintBase = 0;
  const report = [];
  for (const r of results) {
    r.fails.forEach(f => { report.push(`✗ вар. ${r.no}: ${f}`); bad++; });
    const b = base[r.no] || {};
    for (const [id, sd] of Object.entries(r.sheets)) {
      lintNow += sd.lint;
      const bs = b[id];
      if (!bs) { if (Object.keys(b).length) { report.push(`• вар. ${r.no}: новый лист ${id}`); changed++; } continue; }
      lintBase += bs.lint;
      if (sd.lint > bs.lint) { report.push(`✗ вар. ${r.no} ${id}: наложений стало больше — ${bs.lint} → ${sd.lint}\n    ${sd.lintMsgs.slice(0, 6).join('\n    ')}`); bad++; }
      const was = new Map(); bs.dims.forEach(d => was.set(d, (was.get(d) || 0) + 1));
      const now = new Map(); sd.dims.forEach(d => now.set(d, (now.get(d) || 0) + 1));
      const gone = [...was].filter(([d, n]) => (now.get(d) || 0) < n).map(([d]) => d), added = [...now].filter(([d, n]) => (was.get(d) || 0) < n).map(([d]) => d);
      if (gone.length || added.length) { changed++; report.push(`• вар. ${r.no} ${id}: изменились размеры${gone.length ? '\n    было: ' + gone.slice(0, 12).join(' | ') : ''}${added.length ? '\n    стало: ' + added.slice(0, 12).join(' | ') : ''}`); }
    }
    Object.keys(b).forEach(id => { if (!r.sheets[id]) { report.push(`✗ вар. ${r.no}: пропал лист ${id}`); bad++; } });
  }
  console.log(report.join('\n'));
  // сброс кеша браузера: ?v= в index.html — по содержимому файлов (tests/bust.js)
  console.log('index.html: обновлено ссылок на файлы — ' + require('./bust.js').bust());
  console.log(`\nВариантов: ${results.length}, ошибок: ${bad}, изменений размеров: ${changed}, замечаний линтера: ${lintNow}${Object.keys(base).length ? ` (эталон ${lintBase})` : ''}, время ${((Date.now() - t0) / 1000).toFixed(0)} с`);
  if (update && !only.length) {
    const nb = {}; results.forEach(r => { nb[r.no] = {}; Object.entries(r.sheets).forEach(([id, sd]) => { nb[r.no][id] = { lint: sd.lint, dims: sd.dims }; }); });
    fs.writeFileSync(BASE, JSON.stringify(nb, null, 0).replace(/\],"/g, '],\n"'));
    console.log('Эталон обновлён: tests/baseline.json');
    process.exit(bad ? 1 : 0);
  }
  if (!Object.keys(base).length) console.log('Эталона нет — создайте: npm run test:update');
  process.exit(bad || (changed && !update) ? 1 : 0);
})();
