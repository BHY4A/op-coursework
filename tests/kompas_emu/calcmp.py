# -*- coding: utf-8 -*-
"""Сверка эмулятора с настоящим КОМПАС по калибровке.
   python3 calcmp.py РЕАЛЬНЫЙ_cal.json [ЭМУЛЯТОР_cal.json] [--all]
   Калибровочный макрос (60_calibrate.py) ставит одни и те же пробы в одном и том же порядке, поэтому записи сравниваются по номеру.
   Без второго файла макрос прогоняется в эмуляторе заново. Печатает по группам, сколько проб совпало по габариту (±0,3 мм),
   и худшие расхождения: что задано, что получил КОМПАС, что выдал эмулятор."""
import json, os, sys, subprocess, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))


def emu_cal():
    ROOT = os.path.dirname(os.path.dirname(HERE))
    tmp = tempfile.mkdtemp(prefix='kcal-')
    js = ("const {load}=require('./tests/load.js');const ctx=load('.');const TC=ctx.TASKS_CALC;const P=TC.defaults(4),R=TC['task'+P.task](P);"
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


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    real = json.load(open(args[0], encoding='utf-8'))['rec']
    emu = json.load(open(args[1] if len(args) > 1 else emu_cal(), encoding='utf-8'))['rec']
    if len(real) != len(emu):
        print('ВНИМАНИЕ: проб в КОМПАС %d, в эмуляторе %d — макрос калибровки изменился, сверка по номеру неточна' % (len(real), len(emu)))
    groups = {}
    for i, (r, e) in enumerate(zip(real, emu)):
        d = dev(r.get('gab'), e.get('gab'))
        groups.setdefault(r['g'], []).append((d, i, r, e))
    bad_total = 0
    for g, rows in groups.items():
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
