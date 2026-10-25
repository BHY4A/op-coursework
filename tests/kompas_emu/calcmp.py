# -*- coding: utf-8 -*-
"""Сверка эмулятора с настоящим КОМПАС по калибровке.
   python3 calcmp.py РЕАЛЬНЫЙ_cal.json [ЭМУЛЯТОР_cal.json] [--all] [--rev=КОММИТ] [--g=ГРУППА] [--save=ФАЙЛ]
   python3 calcmp.py --check cal/ЖУРНАЛ.meta.json — проверка, что модель не стала хуже (для tests/kompas_emu.js)
   python3 calcmp.py --export [ФАЙЛ] — габариты проб по эмулятору в js/kompas_cal_expect.js: отладочный exe сверяет с ними КОМПАС сам
   Калибровочный макрос (60_calibrate.py) ставит одни и те же пробы в одном и том же порядке, поэтому записи сравниваются по номеру.
   Без второго файла макрос прогоняется в эмуляторе заново. Печатает по группам, сколько проб совпало по габариту (±0,3 мм),
   и худшие расхождения: что задано, что получил КОМПАС, что выдал эмулятор.
   --rev — макрос калибровки из того коммита (js/kompas_py.js), каким снят журнал КОМПАС, а модель — текущая:
   так старый журнал сверяется с новым эмулятором после того, как пробы калибровки поменялись."""
import json, os, sys, subprocess, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))


def emu_cal(rev=None):
    ROOT = os.path.dirname(os.path.dirname(HERE))
    tmp = tempfile.mkdtemp(prefix='kcal-')
    old = ("require('vm').runInContext(require('child_process').execSync('git show %s:js/kompas_py.js',{maxBuffer:1<<28}).toString(),ctx);" % rev) if rev else ''
    js = ("const {load}=require('./tests/load.js');const ctx=load('.');" + old + "const TC=ctx.TASKS_CALC;const P=TC.defaults(4),R=TC['task'+P.task](P);"
          "const f=ctx.KOMPAS.files(R,P,{},{debug:true}).find(f=>f.path==='60_calibrate.py');require('fs').writeFileSync(%s,f.gen());"
          % json.dumps(os.path.join(tmp, '60_calibrate.py')))
    subprocess.run(['node', '-e', js], cwd=ROOT, check=True)
    subprocess.run([sys.executable, os.path.join(HERE, 'run.py'), os.path.join(tmp, '60_calibrate.py'), os.path.join(tmp, 'out')],
                   check=True, stdout=subprocess.DEVNULL)
    return os.path.join(tmp, 'out', 'cal', 'cal.json')


def dev(a, b):
    if not a or not b:
        return 999.0
    return max(abs(a[i] - b[i]) for i in range(4))


def check(meta_path):
    """Совпавших проб в каждой группе — не меньше, чем записано в meta (min); код выхода 1 — регресс."""
    meta = json.load(open(meta_path, encoding='utf-8'))
    real = json.load(open(os.path.join(os.path.dirname(os.path.abspath(meta_path)), meta['cal']), encoding='utf-8'))['rec']
    emu = json.load(open(emu_cal(meta.get('rev')), encoding='utf-8'))['rec']
    ok = {}
    for r, e in zip(real, emu):
        ok.setdefault(r['g'], [0, 0])
        ok[r['g']][1] += 1
        ok[r['g']][0] += dev(r.get('gab'), e.get('gab')) <= 0.3
    bad = [g for g, n in meta['min'].items() if ok.get(g, [0, 0])[0] < n]
    print('калибровка %s: %s' % (meta['cal'], ', '.join('%s %d/%d%s' % (g, a, b, ' (было %d)' % meta['min'][g] if g in bad else '')
                                                       for g, (a, b) in ok.items() if g in meta['min'])))
    if bad:
        print('РЕГРЕСС модели эмулятора: ' + ', '.join(bad))
    sys.exit(1 if bad else 0)


def export(path):
    """Ожидаемые габариты проб калибровки (по текущей модели эмулятора) — для сверки в самом отладочном прогоне (cal.py, _cal_compare)."""
    emu = json.load(open(emu_cal(), encoding='utf-8'))['rec']
    rows = [[r['g'], [round(v, 3) for v in r['gab']] if r.get('gab') else None] for r in emu]
    with open(path, 'w', encoding='utf-8') as fh:
        fh.write('/* kompas_cal_expect.js — габариты проб калибровки КОМПАС (60_calibrate.py) по эмулятору tests/kompas_emu.\n'
                 '   Отладочный exe сверяет с ними настоящий КОМПАС и пишет итог в журнал. Обновить: python3 tests/kompas_emu/calcmp.py --export */\n'
                 'window.KCAL_EXPECT = ' + json.dumps(rows, separators=(',', ':')) + ';\n')
    print('проб: %d → %s' % (len(rows), path))


def main():
    if '--export' in sys.argv:
        i = sys.argv.index('--export')
        root = os.path.dirname(os.path.dirname(HERE))
        return export(sys.argv[i + 1] if len(sys.argv) > i + 1 else os.path.join(root, 'js', 'kompas_cal_expect.js'))
    if '--check' in sys.argv:
        return check(sys.argv[sys.argv.index('--check') + 1])
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    real = json.load(open(args[0], encoding='utf-8'))['rec']
    rev = next((a.split('=', 1)[1] for a in sys.argv[1:] if a.startswith('--rev=')), None)
    ef = args[1] if len(args) > 1 else emu_cal(rev)
    sv = next((a.split('=', 1)[1] for a in sys.argv[1:] if a.startswith('--save=')), None)
    if sv:
        import shutil
        shutil.copy(ef, sv)
    only = next((a.split('=', 1)[1] for a in sys.argv[1:] if a.startswith('--g=')), None)
    emu = json.load(open(ef, encoding='utf-8'))['rec']
    if len(real) != len(emu):
        print('ВНИМАНИЕ: проб в КОМПАС %d, в эмуляторе %d — макрос калибровки изменился, сверка по номеру неточна' % (len(real), len(emu)))
    groups = {}
    for i, (r, e) in enumerate(zip(real, emu)):
        d = dev(r.get('gab'), e.get('gab'))
        groups.setdefault(r['g'], []).append((d, i, r, e))
    bad_total = 0
    for g, rows in groups.items():
        if only and g != only:
            continue
        bad = [x for x in rows if x[0] > 0.3]
        bad_total += len(bad)
        print('%-14s совпало %3d из %3d' % (g, len(rows) - len(bad), len(rows)))
        for d, i, r, e in sorted(bad, key=lambda x: -x[0])[:(len(bad) if '--all' in sys.argv else 6)]:
            print('   #%d расхождение %.1f мм: %s' % (i, d, json.dumps(r['par'], ensure_ascii=False)))
            print('      КОМПАС:   %s %s' % (r.get('gab'), json.dumps(r.get('rd', r.get('err', '')), ensure_ascii=False)[:300]))
            print('      эмулятор: %s %s' % (e.get('gab'), json.dumps(e.get('rd', e.get('err', '')), ensure_ascii=False)[:300]))
    sys.exit(1 if bad_total else 0)


if __name__ == '__main__':
    main()
