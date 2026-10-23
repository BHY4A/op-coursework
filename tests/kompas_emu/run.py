# -*- coding: utf-8 -*-
"""Прогон макроса КОМПАС в эмуляторе: python3 run.py МАКРОС.py ПАПКА_РЕЗУЛЬТАТОВ
Результат: журнал макроса (log.txt), рисунки листов (*.png), отчёт эмулятора (emu_report.json)."""
import sys, os, json, runpy, traceback

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)


def main(macro, out):
    os.makedirs(out, exist_ok=True)
    os.environ['KP_OUT'] = out
    os.environ['KP_KOMPAS_VISIBLE'] = '0'
    import fakewin
    fakewin.install()
    import model, render
    model.EMU = model.Emu(out)
    crash = None
    try:
        runpy.run_path(macro, run_name='__main__')
    except SystemExit:
        pass
    except Exception as e:
        crash = traceback.format_exc()
    E = model.EMU
    sheets = []
    for path, d in E.saved:
        ov = render.overlaps(d.sheet)
        kinds = {}
        for o in d.sheet.objs.values():
            kinds[type(o).__name__] = kinds.get(type(o).__name__, 0) + 1
        sheets.append(dict(file=os.path.basename(path), size=[d.sheet.W, d.sheet.H], objects=kinds, overlaps=ov))
    rep = dict(macro=os.path.basename(macro), crash=crash, notes=E.notes, sheets=sheets)
    with open(os.path.join(out, 'emu_report.json'), 'w', encoding='utf-8') as f:
        json.dump(rep, f, ensure_ascii=False, indent=1)
    return rep


if __name__ == '__main__':
    r = main(sys.argv[1], sys.argv[2])
    print('эмулятор: %s, листов %d, замечаний %d%s' % (r['macro'], len(r['sheets']), len(r['notes']), ', ПАДЕНИЕ' if r['crash'] else ''))
