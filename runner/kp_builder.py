# -*- coding: utf-8 -*-
"""KOMPAS Build: запускает макросы курсового проекта без установленного Python.

Собирается в один .exe (PyInstaller, см. build.bat) вместе с Python, pywin32 и Pillow.
Кладётся рядом с макросами (10_parts.py, 20_assembly.py, …) из архива утилиты «Основы проектирования».
Окно показывает этапы, ход построения и журнал; каждый макрос идёт отдельным процессом этого же .exe
(режим --run), поэтому сбой КОМПАС в одном макросе не роняет окно и не мешает следующим.
"""
import os, sys, re, json, queue, threading, subprocess, datetime, traceback, runpy

APP = 'KOMPAS Build'
VERSION = '1.2'

# порядок как в 00_build_all.py: номера позиций чертежей берутся из спецификаций
STEPS = [
    ('10_parts.py', 'Детали', '3D-модели валов, колёс, корпуса, крышек и подшипников (.m3d)'),
    ('20_assembly.py', 'Сборка', 'Сборка редуктора из моделей деталей (.a3d)'),
    ('40_spec.py', 'Спецификации', 'Спецификации редуктора, рамы и привода (.spw)'),
    ('30_drawings.py', 'Чертежи', 'Сборочные и рабочие чертежи с основной надписью (.cdw)'),
    ('50_snapshots.py', 'Снимки и архив', 'PNG всех файлов и архив для_отправки.zip'),
]


def here():
    return os.path.dirname(os.path.abspath(sys.executable if getattr(sys, 'frozen', False) else __file__))


# ---------------------------------------------------------------- макросы, вшитые в exe
# Сайт дописывает в конец exe zip с макросами варианта (данные и настройки — уже в них):
# [exe][zip][длина zip — 8 байт little-endian][MAGIC]. Такой exe самодостаточен: папка с макросами не нужна.
MAGIC = b'KPBUILD1'


def embedded_zip():
    if not getattr(sys, 'frozen', False):
        return None
    try:
        with open(sys.executable, 'rb') as fh:
            fh.seek(0, 2)
            size = fh.tell()
            if size < 16:
                return None
            fh.seek(size - 16)
            tail = fh.read(16)
            if tail[8:] != MAGIC:
                return None
            n = int.from_bytes(tail[:8], 'little')
            if n <= 0 or n > size - 16:
                return None
            fh.seek(size - 16 - n)
            return fh.read(n)
    except Exception:
        return None


def _ascii_dir(cands):
    """Первая папка из списка без кириллицы в пути, в которую можно писать (КОМПАС надёжнее сохраняет по латинским путям)."""
    for d in cands:
        if not d or any(ord(ch) > 127 for ch in d):
            continue
        try:
            os.makedirs(d, exist_ok=True)
            probe = os.path.join(d, '.w')
            open(probe, 'w').close()
            os.remove(probe)
            return d
        except Exception:
            pass
    return None


def unpack_embedded(data):
    """Распаковать вшитые макросы; вернуть (папка макросов, папка результатов)."""
    import hashlib, io, tempfile, zipfile
    stem = os.path.splitext(os.path.basename(sys.executable))[0]
    lad = os.environ.get('LOCALAPPDATA') or ''
    base = _ascii_dir([os.path.join(lad, 'KOMPAS-Build') if lad else None, r'C:\KP\.kompas-build',
                       os.path.join(tempfile.gettempdir(), 'KOMPAS-Build')]) or os.path.join(tempfile.gettempdir(), 'KOMPAS-Build')
    work = os.path.join(base, 'run_' + hashlib.sha1(data).hexdigest()[:12])
    os.makedirs(work, exist_ok=True)
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        z.extractall(work)
    # результаты — рядом с exe (папка с тем же именем); если в пути кириллица — в C:\KP
    out = _ascii_dir([os.path.join(here(), stem), os.path.join(r'C:\KP', stem)]) or os.path.join(work, 'out')
    return work, out


# ---------------------------------------------------------------- режим --run: один макрос в отдельном процессе

def _persistent_genpy():
    """Обёртки типов КОМПАС (gen_py) — в постоянную папку: иначе каждый макрос генерирует их заново (десятки секунд).
    В pywin32 нет пакета win32com/gen_py: модуль создаётся на лету (types.ModuleType с __path__ на папку кэша).
    Импортировать его нельзя — в собранном exe это «No module named 'win32com.gen_py'», поэтому модуль создаётся так же."""
    try:
        import types, tempfile, win32com
    except Exception:
        return
    gp = None
    for base in (os.environ.get('LOCALAPPDATA'), tempfile.gettempdir()):
        if not base:
            continue
        d = os.path.join(base, 'KOMPAS-Build', 'gen_py')
        try:
            os.makedirs(d, exist_ok=True)
            probe = os.path.join(d, '.w')
            open(probe, 'w').close()
            os.remove(probe)
            gp = d
            break
        except Exception:
            pass
    if not gp:
        return   # остаётся кэш по умолчанию (временная папка pywin32)
    win32com.__gen_path__ = gp
    m = types.ModuleType('win32com.gen_py')
    m.__path__ = [gp]
    sys.modules['win32com.gen_py'] = m
    win32com.gen_py = m
    try:
        from win32com.client import gencache
        gencache.is_readonly = gencache.is_zip = False   # кэш — в обычной папке, его можно дописывать
        gencache.__init__()                             # словари кэша — из новой папки
    except Exception:
        pass


def run_macro(path):
    for name in ('stdout', 'stderr'):
        st = getattr(sys, name)
        if st is None:   # окно без консоли: вывод в никуда, журнал всё равно пишется в out/log.txt
            setattr(sys, name, open(os.devnull, 'w', encoding='utf-8'))
        else:
            try:
                st.reconfigure(encoding='utf-8', errors='replace', line_buffering=True)
            except Exception:
                pass
    _persistent_genpy()
    os.chdir(os.path.dirname(os.path.abspath(path)))
    sys.argv = [path]
    try:
        runpy.run_path(path, run_name='__main__')
    except SystemExit as e:
        return e.code if isinstance(e.code, int) else 0
    except Exception:
        tb = traceback.format_exc()
        print(tb, file=sys.stderr)
        try:
            with open(os.path.join(os.environ.get('KP_OUT') or os.path.join(os.path.dirname(os.path.abspath(path)), 'out'), 'log.txt'), 'a', encoding='utf-8') as f:
                f.write(datetime.datetime.now().strftime('%H:%M:%S ') + 'СБОЙ МАКРОСА ' + os.path.basename(path) + '\n' + tb)
        except Exception:
            pass
        return 1
    return 0


def kompas_finish(mode):
    """После фонового построения: 'restore' — снова показать КОМПАС (он был открыт до запуска),
    'quit' — закрыть КОМПАС, запущенный построением (файлы уже сохранены макросами)."""
    try:
        import pythoncom, win32com.client
        pythoncom.CoInitialize()
        app = win32com.client.GetActiveObject('Kompas.Application.7')
    except Exception:
        return 0   # КОМПАС уже не запущен — делать нечего
    if mode == 'quit':
        try:
            docs = app.Documents
            for i in range(docs.Count - 1, -1, -1):
                try:
                    docs.Item(i).Close(0)
                except Exception:
                    pass
            app.Quit()
            return 0
        except Exception:
            pass   # не закрылся — пусть хотя бы станет видимым
    try:
        app.Visible = True
    except Exception:
        return 1
    return 0


def kompas_running():
    """Запущен ли КОМПАС до построения (по списку процессов)."""
    try:
        out = subprocess.run(['tasklist', '/FI', 'IMAGENAME eq KOMPAS.Exe', '/NH', '/FO', 'CSV'], capture_output=True,
                             creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0), timeout=15).stdout
        return b'kompas.exe' in out.lower()
    except Exception:
        return False


def _bundle_hints():
    """Не вызывается: перечисляет модули, которые импортируют макросы, чтобы PyInstaller положил их в .exe."""
    import pythoncom, pywintypes, win32api, win32gui, win32con, win32com.client, win32com.client.gencache  # noqa
    import zipfile, time, math, json, re, datetime, traceback  # noqa
    from PIL import Image, ImageGrab  # noqa


# ---------------------------------------------------------------- окно

PAL = {   # палитра «Журнал» (op-coursework/css/app.css)
    'light': dict(bg='#e8eeed', sheet='#fbfcfd', sheet2='#f1f5f4', fg='#1a222b', muted='#5a6776', line='#cbd6d3',
                  line_strong='#a5b4b0', accent='#0b6e62', accent_ink='#ffffff', accent_soft='#d8eeea', accent2='#c9531a',
                  ok='#2b7a4b', ok_soft='#dff0e5', warn='#9a6512', warn_soft='#f6ead2', bad='#b8352a', bad_soft='#f6dedb'),
    'dark': dict(bg='#0d1413', sheet='#131c1b', sheet2='#182321', fg='#e1e8ef', muted='#93a2b2', line='#26313d',
                 line_strong='#3a4756', accent='#4fc3ae', accent_ink='#062019', accent_soft='#11302b', accent2='#f0874a',
                 ok='#59c084', ok_soft='#13291d', warn='#e2b04f', warn_soft='#2c2412', bad='#f07a6e', bad_soft='#301a18'),
}


def windows_dark():
    try:
        import winreg
        k = winreg.OpenKey(winreg.HKEY_CURRENT_USER, r'Software\Microsoft\Windows\CurrentVersion\Themes\Personalize')
        return winreg.QueryValueEx(k, 'AppsUseLightTheme')[0] == 0
    except Exception:
        return False


def kompas_installed():
    try:
        import winreg
        for prog in ('Kompas.Application.7', 'Kompas.Application.5'):
            try:
                winreg.CloseKey(winreg.OpenKey(winreg.HKEY_CLASSES_ROOT, prog + r'\CLSID'))
                return True
            except OSError:
                pass
        return False
    except Exception:
        return None


def main_gui():
    import tkinter as tk
    from tkinter import font as tkfont, filedialog, ttk

    if sys.platform == 'win32':
        try:   # чёткий текст на экранах с масштабом 125–200 %
            import ctypes
            ctypes.windll.shcore.SetProcessDpiAwareness(1)
        except Exception:
            pass

    root = tk.Tk()
    root.withdraw()
    dark = windows_dark()
    C = PAL['dark' if dark else 'light']
    fams = set(tkfont.families(root))
    pick = lambda *names: next((n for n in names if n in fams), 'TkDefaultFont')
    F_BODY = pick('IBM Plex Sans', 'Segoe UI', 'Arial')
    F_DISP = pick('Jura', 'Bahnschrift', 'Segoe UI Semibold', F_BODY)
    F_MONO = pick('IBM Plex Mono', 'Cascadia Mono', 'Consolas', 'Courier New')
    f = lambda fam, size, *st: tkfont.Font(root, family=fam, size=size, weight='bold' if 'b' in st else 'normal')
    FN = dict(body=f(F_BODY, 10), small=f(F_BODY, 9), b=f(F_BODY, 10, 'b'), eyebrow=f(F_BODY, 8, 'b'),
              title=f(F_DISP, 19), mono=f(F_MONO, 9), mono_b=f(F_MONO, 9, 'b'), num=f(F_BODY, 9, 'b'))

    root.title(APP)
    root.configure(bg=C['bg'])
    ico = os.path.join(getattr(sys, '_MEIPASS', here()), 'kp.ico')
    if os.path.exists(ico):
        try:
            root.iconbitmap(default=ico)
        except Exception:
            pass
    root.minsize(720, 600)

    RX_SUM = re.compile(r'итог \S+: невыполненных шагов (\d+), предупреждений (\d+), расхождений габаритов (\d+)')
    st = dict(folder=here(), out=None, emb=False, proc=None, running=False, stop=False, q=queue.Queue(), idx=-1, results={})
    emb = embedded_zip()
    if emb:   # одноразовый exe с сайта: макросы варианта внутри
        try:
            st['folder'], st['out'] = unpack_embedded(emb)
            st['emb'] = True
        except Exception:
            pass
    out_dir = lambda: st['out'] or os.path.join(st['folder'], 'out')
    hidden = tk.BooleanVar(value=True)

    # --- элементы в стиле сайта: плоские кнопки, отметки-квадраты, штамп

    class Btn(tk.Label):
        def __init__(self, master, text, cmd, kind='ghost', big=False):
            self.kind, self.cmd, self.on = kind, cmd, True
            super().__init__(master, text=text, font=FN['b'] if kind == 'primary' else FN['body'], cursor='hand2',
                             padx=18 if big else 12, pady=9 if big else 5, bd=0, highlightthickness=1)
            self.bind('<Enter>', lambda e: self.paint(True))
            self.bind('<Leave>', lambda e: self.paint(False))
            self.bind('<Button-1>', lambda e: self.on and self.cmd())
            self.paint(False)

        def paint(self, hover):
            if not self.on:
                self.configure(bg=C['sheet2'], fg=C['muted'], highlightbackground=C['line'], cursor='arrow')
            elif self.kind == 'primary':
                self.configure(bg=C['accent2'] if hover else C['accent'], fg=C['accent_ink'] if not hover else '#ffffff',
                               highlightbackground=C['accent2'] if hover else C['accent'], cursor='hand2')
            else:
                self.configure(bg=C['sheet'], fg=C['accent'] if hover else C['fg'],
                               highlightbackground=C['accent'] if hover else C['line_strong'], cursor='hand2')

        def enable(self, on):
            self.on = on
            self.paint(False)

    class Check(tk.Canvas):
        def __init__(self, master, var, bg):
            super().__init__(master, width=18, height=18, bg=bg, highlightthickness=0, cursor='hand2')
            self.var = var
            self.bind('<Button-1>', lambda e: self.toggle())
            var.trace_add('write', lambda *a: self.draw())
            self.draw()

        def toggle(self):
            if not st['running']:
                self.var.set(not self.var.get())

        def draw(self):
            self.delete('all')
            if self.var.get():
                self.create_rectangle(1, 1, 17, 17, fill=C['accent'], outline=C['accent'])
                self.create_line(5, 9, 8, 12, 13, 6, fill=C['accent_ink'], width=2, capstyle='round', joinstyle='round')
            else:
                self.create_rectangle(1, 1, 17, 17, fill=C['sheet'], outline=C['line_strong'])

    # --- разметка: «лист» на фоне, как на сайте

    outer = tk.Frame(root, bg=C['bg'], padx=14, pady=14)
    outer.pack(fill='both', expand=True)
    sheet = tk.Frame(outer, bg=C['sheet'], highlightthickness=1, highlightbackground=C['line'], padx=22, pady=18)
    sheet.pack(fill='both', expand=True)

    head = tk.Frame(sheet, bg=C['sheet'])
    head.pack(fill='x')
    hl = tk.Frame(head, bg=C['sheet'])
    hl.pack(side='left', fill='x', expand=True, anchor='n')
    tk.Label(hl, text='КУРСОВОЙ ПРОЕКТ · КОМПАС-3D', font=FN['eyebrow'], fg=C['accent'], bg=C['sheet']).pack(anchor='w')
    tk.Label(hl, text='Построение в КОМПАС', font=FN['title'], fg=C['fg'], bg=C['sheet']).pack(anchor='w', pady=(2, 2))
    lead = tk.Label(hl, font=FN['body'], fg=C['muted'], bg=C['sheet'], justify='left', anchor='w',
                    text='Макросы сами запустят КОМПАС-3D и построят модели, чертежи и спецификации.\n'
                         'По умолчанию КОМПАС работает в фоне, без окна, — ход построения виден здесь.')
    lead.pack(anchor='w')

    # штамп справа — как угловой штамп листа на сайте
    stamp = tk.Frame(head, bg=C['fg'], padx=1, pady=1)
    stamp.pack(side='right', anchor='n', padx=(16, 0))
    stamp_cells = {}
    for r, (k, key) in enumerate((('Вариант', 'var'), ('Обозн.', 'code'), ('КОМПАС', 'kompas'))):
        tk.Label(stamp, text=k.upper(), font=FN['eyebrow'], fg=C['muted'], bg=C['sheet'], anchor='w', padx=8, pady=4) \
            .grid(row=r, column=0, sticky='nsew', padx=(0, 1), pady=(0 if r == 0 else 1, 0))
        v = tk.Label(stamp, text='—', font=FN['mono'], fg=C['fg'], bg=C['sheet'], anchor='w', padx=8, pady=4)
        v.grid(row=r, column=1, sticky='nsew', pady=(0 if r == 0 else 1, 0))
        stamp_cells[key] = v

    # папка с макросами
    fold = tk.Frame(sheet, bg=C['sheet2'], highlightthickness=1, highlightbackground=C['line'], padx=12, pady=8)
    fold.pack(fill='x', pady=(16, 0))
    fold_t = tk.Label(fold, text='Папка', font=FN['eyebrow'], fg=C['muted'], bg=C['sheet2'])
    fold_t.pack(side='left')
    fold_lbl = tk.Label(fold, font=FN['mono'], fg=C['fg'], bg=C['sheet2'], anchor='w')
    fold_lbl.pack(side='left', fill='x', expand=True, padx=(10, 10))

    def choose():
        d = filedialog.askdirectory(initialdir=st['folder'], title='Папка с макросами (10_parts.py, 20_assembly.py, …)')
        if d:
            st['folder'] = os.path.normpath(d)
            st['out'] = None
            st['emb'] = False
            refresh()
    b_choose = Btn(fold, 'Выбрать…', choose)
    b_choose.pack(side='right')

    note = tk.Label(sheet, font=FN['small'], justify='left', anchor='w', padx=12, pady=7, wraplength=640)

    # этапы
    tk.Label(sheet, text='Что построить', font=FN['b'], fg=C['fg'], bg=C['sheet']).pack(anchor='w', pady=(16, 6))
    steps_box = tk.Frame(sheet, bg=C['line'], padx=1, pady=1)
    steps_box.pack(fill='x')
    rows = []
    for i, (fn, title, desc) in enumerate(STEPS):
        bg = C['sheet'] if i % 2 == 0 else C['sheet2']
        row = tk.Frame(steps_box, bg=bg, padx=10, pady=5)
        row.pack(fill='x', pady=(0 if i == 0 else 1, 0))
        var = tk.BooleanVar(value=True)
        Check(row, var, bg).pack(side='left', padx=(0, 10))
        no = tk.Canvas(row, width=22, height=22, bg=bg, highlightthickness=0)
        no.pack(side='left', padx=(0, 10))
        txt = tk.Frame(row, bg=bg)
        txt.pack(side='left', fill='x', expand=True)
        tl = tk.Label(txt, text=title, font=FN['b'], fg=C['fg'], bg=bg, anchor='w')
        tl.pack(anchor='w')
        tk.Label(txt, text=desc + '  ·  ' + fn, font=FN['small'], fg=C['muted'], bg=bg, anchor='w').pack(anchor='w')
        stl = tk.Label(row, text='', font=FN['small'], bg=bg, anchor='e', width=22)
        stl.pack(side='right')
        for w in (row, txt, tl):
            w.bind('<Button-1>', lambda e, v=var: (not st['running']) and v.set(not v.get()))
        rows.append(dict(fn=fn, var=var, no=no, status=stl, bg=bg, n=i + 1))

    def set_no(r, state):
        c = r['no']
        c.delete('all')
        fill = {'run': C['accent2'], 'ok': C['ok'], 'warn': C['warn'], 'bad': C['bad']}.get(state, C['accent'])
        if state == 'off':
            c.create_oval(1, 1, 21, 21, fill=r['bg'], outline=C['line_strong'])
            c.create_text(11, 11, text=str(r['n']), font=FN['num'], fill=C['muted'])
        else:
            c.create_oval(1, 1, 21, 21, fill=fill, outline=fill)
            mark = {'ok': '✓', 'bad': '!', 'warn': '✓'}.get(state, str(r['n']))
            c.create_text(11, 11, text=mark, font=FN['num'], fill=C['accent_ink'] if state in ('', None) else '#ffffff')

    def set_status(r, text, kind='muted'):
        r['status'].configure(text=text, fg=C[kind])

    # режим: КОМПАС в фоне
    hrow = tk.Frame(sheet, bg=C['sheet'], cursor='hand2')
    hrow.pack(fill='x', pady=(10, 0))
    Check(hrow, hidden, C['sheet']).pack(side='left', padx=(11, 10))
    htxt = tk.Frame(hrow, bg=C['sheet'])
    htxt.pack(side='left', fill='x', expand=True)
    h1 = tk.Label(htxt, text='КОМПАС в фоне', font=FN['b'], fg=C['fg'], bg=C['sheet'], anchor='w')
    h1.pack(anchor='w')
    h2 = tk.Label(htxt, font=FN['small'], fg=C['muted'], bg=C['sheet'], anchor='w', justify='left',
                  text='Окно КОМПАС не показывается. Если он уже был открыт — скроется на время построения и вернётся; '
                       'запущенный построением — закроется в конце. Снимите отметку, чтобы смотреть, как строится модель.')
    h2.pack(anchor='w', fill='x')
    for w in (hrow, htxt, h1, h2):
        w.bind('<Button-1>', lambda e: (not st['running']) and hidden.set(not hidden.get()))

    # кнопки и полоса хода
    bar = tk.Frame(sheet, bg=C['sheet'])
    bar.pack(fill='x', pady=(14, 0))
    b_go = Btn(bar, 'Построить', lambda: start(), 'primary', big=True)
    b_go.pack(side='left')
    b_stop = Btn(bar, 'Остановить', lambda: stop())
    b_stop.pack(side='left', padx=(8, 0))
    b_out = Btn(bar, 'Открыть папку результатов', lambda: open_path(out_dir()))
    b_out.pack(side='right')
    b_log = Btn(bar, 'Журнал', lambda: open_path(os.path.join(out_dir(), 'log.txt')))
    b_log.pack(side='right', padx=(0, 8))

    prog = tk.Canvas(sheet, height=4, bg=C['line'], highlightthickness=0)
    prog.pack(fill='x', pady=(14, 0))
    summary = tk.Label(sheet, text='', font=FN['body'], fg=C['muted'], bg=C['sheet'], anchor='w', justify='left')
    summary.pack(fill='x', pady=(8, 6))

    # журнал
    logf = tk.Frame(sheet, bg=C['line'], padx=1, pady=1)
    logf.pack(fill='both', expand=True)
    logt = tk.Text(logf, height=10, font=FN['mono'], bg=C['sheet2'], fg=C['fg'], bd=0, padx=10, pady=8, wrap='word',
                   insertbackground=C['fg'], selectbackground=C['accent_soft'], selectforeground=C['fg'], state='disabled')
    sty = ttk.Style(root)
    try:
        sty.theme_use('clam')
    except Exception:
        pass
    sty.configure('KP.Vertical.TScrollbar', troughcolor=C['sheet2'], background=C['line_strong'], bordercolor=C['sheet2'],
                  arrowcolor=C['muted'], lightcolor=C['line_strong'], darkcolor=C['line_strong'], gripcount=0, arrowsize=12)
    sty.map('KP.Vertical.TScrollbar', background=[('active', C['accent'])])
    sb = ttk.Scrollbar(logf, orient='vertical', command=logt.yview, style='KP.Vertical.TScrollbar')
    logt.configure(yscrollcommand=sb.set)
    sb.pack(side='right', fill='y')
    logt.pack(side='left', fill='both', expand=True)
    for tag, col in (('bad', C['bad']), ('warn', C['warn']), ('ok', C['ok']), ('head', C['accent']), ('muted', C['muted'])):
        logt.tag_configure(tag, foreground=col)
    logt.tag_configure('head', font=FN['mono_b'], spacing1=6)

    def log_line(text, tag=None):
        text = text.rstrip('\r\n')
        if tag is None:
            low = text.lower()
            m = RX_SUM.search(text)
            if m:
                tag = 'bad' if int(m.group(1)) else 'warn' if int(m.group(2)) + int(m.group(3)) else 'ok'
            else:
                tag = ('bad' if ('не выполнено' in low or 'traceback' in low or 'error' in low or 'сбой' in low or text.lstrip().startswith('!!'))
                       else 'warn' if ('предупреждение:' in low or 'расхождение' in low) else 'ok' if text.lstrip().startswith('OK ') else None)
        logt.configure(state='normal')
        logt.insert('end', text + '\n', tag or ())
        if int(logt.index('end-1c').split('.')[0]) > 4000:
            logt.delete('1.0', '500.0')
        logt.configure(state='disabled')
        logt.see('end')

    def open_path(p):
        if os.path.exists(p):
            try:
                if os.path.isdir(p):
                    # папка — через Проводник: os.startfile('…\\OP_KP_01-04_KOMPAS') нашёл бы одноимённый exe рядом и запустил его
                    subprocess.Popen(['explorer', os.path.normpath(p)])
                else:
                    os.startfile(p)
            except Exception as e:
                log_line('Не удалось открыть ' + p + ': ' + str(e), 'bad')
        else:
            log_line('Пока нет: ' + p + ' — появится после построения.', 'muted')

    def draw_prog(frac):
        prog.delete('all')
        w = prog.winfo_width() or 600
        if frac > 0:
            prog.create_rectangle(0, 0, int(w * min(1, frac)), 4, fill=C['accent'], width=0)

    # --- папка: что в ней есть

    def refresh():
        folder = st['folder']
        fold_lbl.configure(text=out_dir() if st['emb'] else folder)
        fold_t.configure(text='Результаты' if st['emb'] else 'Папка')
        have = [os.path.exists(os.path.join(folder, r['fn'])) for r in rows]
        info = {}
        try:
            with open(os.path.join(folder, 'params.json'), encoding='utf-8') as fh:
                info = json.load(fh)
        except Exception:
            pass
        stamp_cells['var'].configure(text=('задача %s, вар. %s' % (info.get('task'), info.get('v'))) if info.get('task') else '—')
        stamp_cells['code'].configure(text=info.get('code') or '—')
        ki = kompas_installed()
        stamp_cells['kompas'].configure(text={True: 'найден', False: 'не найден', None: '—'}[ki],
                                        fg=C['ok'] if ki else C['bad'] if ki is False else C['muted'])
        for r, h in zip(rows, have):
            if not h:
                r['var'].set(False)
                set_status(r, 'нет файла', 'muted')
                set_no(r, 'off')
            elif not st['running']:
                set_status(r, '')
                set_no(r, '')
        msg, kind = None, None
        if not any(have):
            msg, kind = ('В этой папке нет макросов. Скачайте KOMPAS Build заново на вкладке «КОМПАС» утилиты — '
                         'макросы вашего варианта будут внутри exe — или нажмите «Выбрать…» и укажите папку с макросами.'), 'bad'
        elif ki is False:
            msg, kind = 'КОМПАС-3D не найден в системе. Макросы работают с установленным КОМПАС-3D v25.', 'bad'
        elif any(ord(ch) > 127 for ch in out_dir()):
            msg, kind = ('В пути к папке есть кириллица или пробелы не на латинице — КОМПАС может не сохранить файлы. '
                         'Надёжнее распаковать архив в C:\\KP\\.'), 'warn'
        if msg:
            note.configure(text=msg, fg=C[kind], bg=C[kind + '_soft'])
            note.pack(fill='x', pady=(10, 0), after=fold)
        else:
            note.pack_forget()
        b_go.enable(any(have) and not st['running'])
        update_buttons()

    def update_buttons():
        b_stop.enable(st['running'])
        b_choose.enable(not st['running'])
        b_go.enable(not st['running'] and any(r['var'].get() for r in rows))

    for r in rows:
        r['var'].trace_add('write', lambda *a: (not st['running']) and update_buttons())

    # --- запуск

    def start():
        todo = [r for r in rows if r['var'].get() and os.path.exists(os.path.join(st['folder'], r['fn']))]
        if not todo or st['running']:
            return
        out = out_dir()
        os.makedirs(out, exist_ok=True)
        lg = os.path.join(out, 'log.txt')
        if os.path.exists(lg):   # новый запуск — новый журнал, как в 00_build_all.py
            try:
                os.replace(lg, os.path.join(out, 'log_prev.txt'))
            except Exception:
                pass
        st.update(running=True, stop=False, results={}, todo=todo, t0=datetime.datetime.now(), hidden=hidden.get())
        logt.configure(state='normal')
        logt.delete('1.0', 'end')
        logt.configure(state='disabled')
        for r in rows:
            if r in todo:
                set_status(r, 'ожидает')
                set_no(r, '')
            elif os.path.exists(os.path.join(st['folder'], r['fn'])):
                set_status(r, 'пропущен')
                set_no(r, 'off')
        summary.configure(text='Запускаю КОМПАС-3D' + (' в фоне' if st['hidden'] else '') + '…', fg=C['muted'])
        update_buttons()
        threading.Thread(target=worker, args=(list(todo),), daemon=True).start()

    def self_cmd(*args):
        return [sys.executable] + list(args) if getattr(sys, 'frozen', False) else [sys.executable, os.path.abspath(__file__)] + list(args)

    def worker(todo):
        q = st['q']
        was_running = kompas_running() if st['hidden'] else True
        for r in todo:
            if st['stop']:
                break
            q.put(('begin', r))
            path = os.path.join(st['folder'], r['fn'])
            cmd = self_cmd('--run', path)
            env = dict(os.environ, PYTHONIOENCODING='utf-8', PYTHONUNBUFFERED='1', KP_KOMPAS_VISIBLE='0' if st['hidden'] else '1', KP_OUT=out_dir())
            flags = getattr(subprocess, 'CREATE_NO_WINDOW', 0)
            try:
                p = subprocess.Popen(cmd, cwd=st['folder'], stdin=subprocess.DEVNULL, stdout=subprocess.PIPE,
                                     stderr=subprocess.STDOUT, env=env, creationflags=flags)
            except Exception as e:
                q.put(('line', 'Не удалось запустить ' + r['fn'] + ': ' + str(e)))
                q.put(('end', r, -1))
                continue
            st['proc'] = p
            for raw in p.stdout:
                q.put(('line', raw.decode('utf-8', 'replace')))
            q.put(('end', r, p.wait()))
            st['proc'] = None
        if st['hidden']:
            q.put(('line', 'КОМПАС: ' + ('закрываю (его запустило построение)' if not was_running else 'снова показываю окно')))
            try:
                subprocess.run(self_cmd('--kompas', 'restore' if was_running else 'quit'), stdin=subprocess.DEVNULL,
                               stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=90,
                               creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
            except Exception as e:
                q.put(('line', 'КОМПАС не ответил при завершении: ' + str(e)[:120] + ' — если он остался в фоне, закройте KOMPAS.Exe в диспетчере задач.'))
        q.put(('done', None))

    def stop():
        st['stop'] = True
        p = st.get('proc')
        if p and p.poll() is None:
            try:
                p.terminate()
            except Exception:
                pass
        summary.configure(text='Останавливаю… КОМПАС остаётся открытым, недостроенные файлы можно закрыть без сохранения.', fg=C['warn'])

    def pump():
        q = st['q']
        try:
            while True:
                ev = q.get_nowait()
                kind = ev[0]
                if kind == 'begin':
                    r = ev[1]
                    st['cur'] = r
                    st['results'][r['fn']] = dict(fail=0, warn=0, mis=0, tb=False)
                    set_status(r, 'идёт…', 'accent2')
                    set_no(r, 'run')
                    log_line('>>> ' + r['fn'], 'head')
                    i = st['todo'].index(r)
                    draw_prog((i + 0.15) / len(st['todo']))
                    summary.configure(text='Этап %d из %d: %s' % (i + 1, len(st['todo']), STEPS[r['n'] - 1][1]), fg=C['fg'])
                elif kind == 'line':
                    text = ev[1]
                    res = st['results'].get(st.get('cur', {}).get('fn'))
                    m = RX_SUM.search(text)
                    if m and res is not None:
                        res.update(fail=int(m.group(1)), warn=int(m.group(2)), mis=int(m.group(3)))
                    if res is not None and ('Traceback' in text or 'СБОЙ МАКРОСА' in text):
                        res['tb'] = True
                    log_line(text)
                elif kind == 'end':
                    r, code = ev[1], ev[2]
                    res = st['results'][r['fn']]
                    if st['stop']:
                        set_status(r, 'остановлен', 'warn')
                        set_no(r, 'warn')
                    elif code != 0 or res['tb']:
                        set_status(r, 'сбой — см. журнал', 'bad')
                        set_no(r, 'bad')
                    elif res['fail']:
                        set_status(r, 'не выполнено шагов: %d' % res['fail'], 'bad')
                        set_no(r, 'bad')
                    elif res['warn'] or res['mis']:
                        set_status(r, 'готово, замечаний: %d' % (res['warn'] + res['mis']), 'warn')
                        set_no(r, 'warn')
                    else:
                        set_status(r, 'готово', 'ok')
                        set_no(r, 'ok')
                    draw_prog((st['todo'].index(r) + 1) / len(st['todo']))
                elif kind == 'done':
                    st['running'] = False
                    res = st['results'].values()
                    bad = sum(1 for x in res if x['fail'] or x['tb'])
                    secs = int((datetime.datetime.now() - st['t0']).total_seconds())
                    took = '%d мин %02d с' % (secs // 60, secs % 60)
                    if st['stop']:
                        summary.configure(text='Остановлено. Что успело построиться — в папке результатов: ' + out_dir(), fg=C['warn'])
                    elif bad:
                        summary.configure(text='Готово за %s, но в %d этап(ах) есть невыполненные шаги. Что достроить вручную — '
                                               'в журнале; размеры — на вкладке «КОМПАС» утилиты и в DXF.' % (took, bad), fg=C['bad'])
                    else:
                        summary.configure(text='Готово за %s. Файлы — в папке %s, для отправки — для_отправки.zip в ней.' % (took, out_dir()), fg=C['ok'])
                    for r in rows:
                        if r['status'].cget('text') == 'ожидает':
                            set_status(r, 'не запускался')
                            set_no(r, 'off')
                    update_buttons()
        except queue.Empty:
            pass
        root.after(80, pump)

    def on_close():
        if st['running']:
            stop()
            if st.get('hidden'):   # не оставлять невидимый КОМПАС: вернуть окно
                try:
                    subprocess.Popen(self_cmd('--kompas', 'restore'), creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
                except Exception:
                    pass
        root.destroy()

    root.protocol('WM_DELETE_WINDOW', on_close)
    def rewrap(e):
        summary.configure(wraplength=max(300, e.width - 50))
        h2.configure(wraplength=max(300, e.width - 90))
        note.configure(wraplength=max(300, e.width - 70))
    sheet.bind('<Configure>', rewrap)
    refresh()
    log_line('%s %s. Отметьте этапы и нажмите «Построить». Журнал также пишется в %s.' % (APP, VERSION, os.path.join(out_dir(), 'log.txt')), 'muted')
    root.after(80, pump)

    root.update_idletasks()
    w, h = 840, min(870, root.winfo_screenheight() - 90)
    root.geometry('%dx%d+%d+%d' % (w, h, max(0, (root.winfo_screenwidth() - w) // 2), max(0, (root.winfo_screenheight() - h) // 3)))
    if dark and sys.platform == 'win32':
        try:   # тёмный заголовок окна в тёмной теме Windows
            import ctypes
            hwnd = ctypes.windll.user32.GetParent(root.winfo_id())
            v = ctypes.c_int(1)
            ctypes.windll.dwmapi.DwmSetWindowAttribute(hwnd, 20, ctypes.byref(v), ctypes.sizeof(v))
        except Exception:
            pass
    root.deiconify()
    root.mainloop()


if __name__ == '__main__':
    if len(sys.argv) >= 3 and sys.argv[1] == '--run':
        sys.exit(run_macro(sys.argv[2]))
    if len(sys.argv) >= 3 and sys.argv[1] == '--kompas':
        sys.exit(kompas_finish(sys.argv[2]))
    main_gui()
