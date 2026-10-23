'use strict';
/* Отладочный KOMPAS Build: макросы всех вариантов (v01 … v26, настройки по умолчанию) внутри одного exe.
   node tests/kompas_debug_exe.js [выходной.exe] [варианты через запятую | all]
   Построитель видит debug.json, гоняет отмеченные этапы по всем вариантам подряд (по умолчанию — спецификации и чертежи,
   без 3D), пишет подробный журнал (KP_DEBUG=1) и собирает журналы и geom_*.json в debug_logs.zip. */
const fs = require('fs'), path = require('path'), os = require('os'), cp = require('child_process');
const { load } = require('./load.js');
const ROOT = path.join(__dirname, '..');
const ctx = load(ROOT);
const TC = ctx.TASKS_CALC;
const args = process.argv.slice(2);
const outExe = path.resolve(args[0] || 'KOMPAS-Build-debug.exe');
const sel = (args[1] || 'all').toLowerCase();
const vars = sel === 'all' ? Array.from({ length: 26 }, (_, i) => i + 1) : sel.split(',').map(Number);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kdbg-'));
const subs = [];
for (const v of vars) {
  const P = TC.defaults(v), R = TC['task' + P.task](P);
  const sub = 'v' + String(v).padStart(2, '0'), dir = path.join(tmp, sub);
  for (const f of ctx.KOMPAS.files(R, P, {})) {
    const p = path.join(dir, f.path);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, f.gen());
  }
  subs.push(sub);
  process.stdout.write(sub + ' ');
}
fs.writeFileSync(path.join(tmp, 'debug.json'), JSON.stringify({ vars: subs }));
// [exe][zip][длина zip — 8 байт little-endian]['KPBUILD1'] — как у одноразового exe с сайта
const py = `
import os, sys, io, zipfile, struct
src, exe, out = sys.argv[1:4]
b = io.BytesIO()
with zipfile.ZipFile(b, 'w', zipfile.ZIP_DEFLATED) as z:
    for d, _, fs in os.walk(src):
        for f in fs:
            p = os.path.join(d, f)
            z.write(p, os.path.relpath(p, src).replace(os.sep, '/'))
zb = b.getvalue()
with open(out, 'wb') as fo:
    fo.write(open(exe, 'rb').read() + zb + struct.pack('<Q', len(zb)) + b'KPBUILD1')
print('\\n%s: %.1f МБ (макросы %.1f МБ)' % (out, os.path.getsize(out) / 1e6, len(zb) / 1e6))
`;
const r = cp.spawnSync('python3', ['-c', py, tmp, path.join(ROOT, 'dl', 'KOMPAS-Build.exe'), outExe], { encoding: 'utf8' });
process.stdout.write(r.stdout + r.stderr);
fs.rmSync(tmp, { recursive: true, force: true });
process.exit(r.status);
