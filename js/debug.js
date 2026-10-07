/* debug.js — скрытое меню отладки: архив OP_KP_DEBUG для прогона нескольких вариантов в КОМПАС-3D подряд
 * и сбора результатов (журналы, PNG, DXF и сами чертежи .cdw, исходные данные листов) в один архив для отправки. */
(function (root) {
  'use strict';
  const VERSION = '2026-10-06';

  const RUN_DEBUG_PY = String.raw`# -*- coding: utf-8 -*-
"""Отладочный прогон: по очереди строит выбранные варианты в КОМПАС-3D и собирает всё для проверки
в один архив debug_для_отправки.zip (журналы, PNG-снимки, DXF и файлы чертежей .cdw, данные листов, сводка ошибок).
Запуск: 02_run_debug.bat или  py 00_run_debug.py  (можно указать папки: py 00_run_debug.py T3_v02 T6_v02)"""
import os, sys, glob, shutil, subprocess, time, zipfile, datetime, json

HERE = os.path.dirname(os.path.abspath(__file__))
DIRS = sorted(d for d in os.listdir(HERE) if d.startswith('T') and os.path.isfile(os.path.join(HERE, d, '00_build_all.py')))
if len(sys.argv) > 1:
    DIRS = [d for d in DIRS if d in sys.argv[1:]]
KEYS = ('итог ', 'НЕ ВЫПОЛНЕНО', 'РАСХОЖДЕНИЕ', 'предупреждение', 'перенумеровал', 'номера позиций', 'готово деталей', 'готово чертежей',
        'сборка сохранена', 'спецификация (API', 'ширина надписей', 'снимков:', 'DXF ', 'Traceback', 'Error', 'ошибка')


def close_all_docs():
    try:
        from win32com.client import Dispatch
        app = Dispatch('Kompas.Application.7')
        docs = app.Documents
        for i in range(int(docs.Count) - 1, -1, -1):
            try:
                docs.Item(i).Close(0)
            except Exception:
                pass
    except Exception as e:
        print('  (документы КОМПАС не закрыты: %s)' % e)


def run(d):
    path = os.path.join(HERE, d)
    out = os.path.join(path, 'out')
    if os.path.isdir(out):
        prev = os.path.join(path, 'out_prev')
        if os.path.isdir(prev):
            shutil.rmtree(prev, ignore_errors=True)
        try:
            os.replace(out, prev)
        except Exception:
            shutil.rmtree(out, ignore_errors=True)
    print('=' * 70)
    print('>>> %s' % d)
    t0 = time.time()
    with open(os.path.join(path, 'console.txt'), 'w', encoding='utf-8') as con:
        env = dict(os.environ, PYTHONIOENCODING='utf-8', PYTHONUTF8='1')
        p = subprocess.Popen([sys.executable, '-u', '00_build_all.py'], cwd=path, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, env=env)
        for raw in p.stdout:
            line = raw.decode('utf-8', 'replace')
            sys.stdout.write(line)
            con.write(line)
        p.wait()
    dt = time.time() - t0
    close_all_docs()
    return dt


def summary(d, dt):
    lines = ['### %s  (время %.0f с)' % (d, dt)]
    for name in ('out/log.txt', 'console.txt'):
        f = os.path.join(HERE, d, name)
        if not os.path.exists(f):
            lines.append('  нет файла ' + name)
            continue
        with open(f, encoding='utf-8', errors='replace') as fh:
            keys = KEYS if name.endswith('log.txt') else ('Traceback', 'Error', 'Ошибка')
            n = 0
            for ln in fh:
                if any(k in ln for k in keys):
                    n += 1
                    if n <= 200:
                        lines.append('  ' + ln.rstrip()[:400])
            if n > 200:
                lines.append('  … и ещё %d строк — см. %s' % (n - 200, name))
    lines.append('  PNG-снимков: %d, DXF чертежей: %d' % (len(glob.glob(os.path.join(HERE, d, 'out', 'снимки', '*.png'))),
                                                         len(glob.glob(os.path.join(HERE, d, 'out', 'чертежи_dxf', '*.dxf')))))
    return '\n'.join(lines)


def pack(zf, d):
    """Содержимое out/для_отправки.zip варианта (журнал, снимки, DXF, .cdw, sheets.json) + console.txt."""
    inner = os.path.join(HERE, d, 'out', 'для_отправки.zip')
    if os.path.exists(inner):
        with zipfile.ZipFile(inner) as zi:
            for n in zi.namelist():
                zf.writestr(d + '/' + n, zi.read(n))
    else:
        for name in ('out/log.txt', 'sheets.json'):
            f = os.path.join(HERE, d, name)
            if os.path.exists(f):
                zf.write(f, d + '/' + os.path.basename(f))
        for f in sorted(glob.glob(os.path.join(HERE, d, 'out', 'снимки', '*.png'))):
            zf.write(f, d + '/снимки/' + os.path.basename(f))
    for name in ('console.txt', 'params.json', 'lint.txt'):
        f = os.path.join(HERE, d, name)
        if os.path.exists(f):
            zf.write(f, d + '/' + name)


def main():
    if not DIRS:
        print('Не найдено папок T*_v* рядом со скриптом.')
        return
    times = {}
    for d in DIRS:
        try:
            times[d] = run(d)
        except Exception as e:
            print('!!! %s: %s' % (d, e))
            times[d] = -1
    rep = ['Отладочный прогон %s' % datetime.datetime.now().strftime('%Y-%m-%d %H:%M'),
           'Python %s' % sys.version.split()[0], '']
    try:
        with open(os.path.join(HERE, 'variants.json'), encoding='utf-8') as f:
            rep.insert(1, 'Версия утилиты: %s' % json.load(f).get('version', '?'))
    except Exception:
        pass
    rep += [summary(d, times[d]) + '\n' for d in DIRS]
    rep_txt = '\n'.join(rep)
    with open(os.path.join(HERE, 'сводка.txt'), 'w', encoding='utf-8') as f:
        f.write(rep_txt)
    z = os.path.join(HERE, 'debug_для_отправки.zip')
    with zipfile.ZipFile(z, 'w', zipfile.ZIP_DEFLATED) as zf:
        zf.writestr('сводка.txt', rep_txt)
        vj = os.path.join(HERE, 'variants.json')
        if os.path.exists(vj):
            zf.write(vj, 'variants.json')
        for d in DIRS:
            pack(zf, d)
    print('=' * 70)
    print(rep_txt)
    print('Архив для отправки: ' + z + ' (%.1f МБ)' % (os.path.getsize(z) / 1e6))


if __name__ == '__main__':
    main()
`;

  const bat = lines => lines.concat(['']).join('\r\n');
  const p2 = x => String(x).padStart(2, '0');
  const dirOf = (task, v) => `T${task}_v${p2(v)}`;

  function readme(list) {
    return [
      'ОТЛАДОЧНЫЙ АРХИВ утилиты «Основы проектирования» (версия ' + VERSION + ') — прогон нескольких вариантов в КОМПАС-3D v25',
      '',
      'Папки:',
      ...list.map(x => `  ${dirOf(x.task, x.v)} — № ${x.no} по списку: задание ${x.task}, вариант ${x.v} (${x.title})`),
      '',
      'Как запустить:',
      '  1. Распакуйте архив в путь без кириллицы, например C:\\KPDEBUG\\',
      '  2. Один раз запустите 01_install_pywin32.bat (ставит pywin32 и pillow; нужен интернет).',
      '  3. Запустите 02_run_debug.bat. Он по очереди прогонит все варианты (детали → сборка → спецификации →',
      '     чертежи → PNG-снимки и DXF-копии чертежей). Пока идёт работа, КОМПАС не трогайте.',
      '     Между вариантами скрипт закрывает открытые документы КОМПАС без сохранения (результаты уже сохранены в out).',
      '  4. Пришлите файл debug_для_отправки.zip из этой папки. В нём для каждого варианта: журнал log.txt и console.txt,',
      '     PNG-снимки сборки, деталей и листов, DXF-копии построенных чертежей, сами файлы .cdw/.spw,',
      '     sheets.json (листы так, как их рассчитала утилита) и params.json — по ним сверяется положение осевых линий,',
      '     размеров, знаков шероховатости и выносок на реальных листах КОМПАС.',
      '',
      'Прогнать только часть вариантов:  py 00_run_debug.py T3_v02 T6_v02',
      'Предыдущий результат каждой папки сохраняется как out_prev.',
      ''].join('\r\n');
  }

  /* list: [{ no, task, v }]; computeFor(no) → { R, P }; T — данные титульного листа */
  async function build(list, computeFor, T, onProgress) {
    const zip = new root.JSZip(), top = 'OP_KP_DEBUG/';
    const done = [];
    for (let i = 0; i < list.length; i++) {
      const x = list[i];
      if (onProgress) onProgress(i, list.length, x);
      await new Promise(r => setTimeout(r, 0));
      let R, P;
      try { ({ R, P } = computeFor(x.no)); } catch (e) { console.error(e); zip.file(top + dirOf(x.task, x.v) + '/ОШИБКА_РАСЧЁТА.txt', String(e && e.stack || e)); continue; }
      const files = root.KOMPAS.files(R, P, T, { debug: true });
      for (const f of files) zip.file(top + dirOf(P.task, P.v) + '/' + f.path, f.gen());
      // самопроверка листов по ГОСТ (привязка обозначений, надписи на линиях, центровые линии)
      if (root.DRWLINT) {
        try {
          const rows = [];
          for (const d of root.KOMPAS.sheets(R, P, {}).list) { if (d.sh.finalize) d.sh.finalize(); for (const i of root.DRWLINT.lint(d.sh)) rows.push(`${d.file}\t${i.sev}\t${i.rule}\t${i.n > 1 ? i.n + '× ' : ''}${i.msg}\t${i.at ? i.at.join(';') : ''}`); }
          zip.file(top + dirOf(P.task, P.v) + '/lint.txt', rows.length ? rows.join('\r\n') : 'замечаний нет');
        } catch (e) { zip.file(top + dirOf(P.task, P.v) + '/lint.txt', 'ошибка проверки: ' + e); }
      }
      done.push(Object.assign({}, x, { title: root.DATA.TASKS[P.task].short, dir: dirOf(P.task, P.v) }));
    }
    zip.file(top + '00_run_debug.py', RUN_DEBUG_PY);
    zip.file(top + '01_install_pywin32.bat', bat(['@echo off', 'chcp 65001 >nul', 'echo Установка pywin32...', 'where py >nul 2>nul && (py -3 -m pip install --upgrade pywin32 pillow) || (python -m pip install --upgrade pywin32 pillow)', 'echo.', 'echo Готово. Если выше ошибка "не является внутренней или внешней командой" - установите Python с python.org с галочкой "Add python.exe to PATH".', 'pause']));
    zip.file(top + '02_run_debug.bat', bat(['@echo off', 'chcp 65001 >nul', 'cd /d "%~dp0"', 'where py >nul 2>nul && (py -3 00_run_debug.py %*) || (python 00_run_debug.py %*)', 'echo.', 'echo Пришлите файл debug_для_отправки.zip из этой папки.', 'pause']));
    zip.file(top + 'README.txt', readme(done));
    zip.file(top + 'variants.json', JSON.stringify({ version: VERSION, created: new Date().toISOString(), variants: done }, null, 1));
    if (onProgress) onProgress(list.length, list.length, null);
    return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  }

  root.KPDEBUG = { build, VERSION, RUN_DEBUG_PY, dirOf };
})(typeof window !== 'undefined' ? window : globalThis);
