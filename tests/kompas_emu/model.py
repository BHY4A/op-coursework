# -*- coding: utf-8 -*-
"""Модель КОМПАС-3D v25 для эмулятора: документы, геометрия API5, размеры и обозначения API7.

Что модель берёт из настоящего КОМПАС:
  * имена и типы свойств/методов — из gen_py (fakewin.py), их здесь не придумываем;
  * размеры элементов обозначений — из DXF, выгруженных КОМПАС 25 (стрелка 5 мм, выход выносной линии 2 мм,
    надпись размера на 2,1 мм над линией, рамка допуска 10 мм, ячейка знака 7,6 мм, ячейка текста = ширина + 5 мм,
    пустая ячейка 10 мм, рамка базы 10×10, полка выноски = 2 + ширина + 2, номер позиции на 1 мм над полкой);
  * правила размещения — из калибровки на настоящем КОМПАС 25 (журнал отладки, 60_calibrate.py → cal.json, сверка — calcmp.py):
    ширина символов и габарит надписей, авторазмещение надписи размера, знак шероховатости на выноске, размер с обрывом,
    линия разреза; и из журналов настоящих прогонов (таблица по умолчанию — ширины из Add; рамка допуска — 4 ячейки).
Чего модель не знает (помечено «гипотеза»): ручное размещение надписи размера (КОМПАС уводит её на полку), место надписи
углового размера, формы знаков. Для таких мест эмулятор проверяет только, что вызовы допустимы, а не что КОМПАС нарисует ровно так."""
import math, os, json

EMU = None
# ширина символов шрифта «GOST type A» в КОМПАС 25, доли высоты (калибровка: 44 надписи h 2,5…7, ошибка подгонки до 0,4 мм при h 7):
# ширина надписи = h · (0,371 + Σ по символам); чего в калибровке не было — оценка по похожим символам.
# Журнал 6 (chars, по 10 одинаковых цифр): цифры разной ширины (1 — 0,42, 5 — 0,55, 6 — 0,66), но подстановка их по одной ломает
# прочие пробы (⌀ и база подогнаны под общую ширину цифры) — нужна совместная подгонка всех надписей
KW = {'1': 0.418, ' ': 0.227, ',': 0.227, '.': 0.227, ':': 0.227, ';': 0.227, "'": 0.227, '!': 0.227, '|': 0.227,
      '/': 0.736, '-': 0.642, '−': 0.642, '–': 0.642, '—': 0.9, '⌀': 0.564, '∅': 0.564, '(': 0.36, ')': 0.36, '[': 0.36, ']': 0.36,
      '×': 0.6, '±': 0.6, '°': 0.4, '√': 0.6, '*': 0.5, '+': 0.633, '=': 0.633}
KW_DIGIT, KW_UPPER, KW_LOWER, KW_BASE = 0.633, 0.668, 0.678, 0.371


def tw(s, h):
    """Ширина надписи так, как её считает КОМПАС 25 (габарит текста; калибровка на листе — см. KW)."""
    SUP = '⁻⁰¹²³⁴⁵⁶⁷⁸⁹'
    if not s:
        return 0.0
    w = KW_BASE
    for c in str(s):
        if c in SUP:
            w += 0.7 * KW_DIGIT
        elif c in KW:
            w += KW[c]
        elif c.isdigit():
            w += KW_DIGIT
        elif c.isupper():
            w += KW_UPPER
        else:
            w += KW_LOWER
    return w * h


# габарит надписи по высоте (калибровка КОМПАС 25, h 2,5…7): от y − (0,317h − 0,5) до y + 1,159h + 0,6 — над базовой линией (y)
def t_lo(h):
    return 0.317 * h - 0.5


def t_hi(h):
    return 1.159 * h + 0.6


# надпись линейного размера: верх габарита — на 6,167 мм над размерной линией при h 3,5 (Height = 5,167), т. е. база на 1,51 мм выше линии
DIM_TB = 6.167 - t_hi(3.5)
# продолжение размерной линии за стрелку, вынесенную наружу (калибровка: 5 мм; DXF давал 6,8 — с выступом выносной линии)
DIM_EXT = 5.0
# надпись, что не помещается между выносными линиями, КОМПАС ставит снаружи у первой точки: 5 мм от неё, линия — ещё на 2 мм за надпись
DIM_OUT, DIM_OUT_TAIL = 5.0, 2.0
# журнал 5: в размерах 7,5…13,7 мм надпись шириной 3–9 мм КОМПАС выносит наружу, в 16 мм надпись 12,3 — по центру; журнал 6: у горизонтальных
# размеров 13…16 мм надписи «3» и «24» — по центру, а у вертикальных 12,8 и 13,9 мм («26», «35») — снаружи: порог по длине только у
# вертикальных (гипотеза — 15)
DIM_MIN_IN_V = 15.0


# ---------------------------------------------------------------- база объектов
class Impl:
    _kemu_impl_ = True
    IFACES = ()
    DYN = None          # класс gen_py для объекта, отданного как «голый» IDispatch
    DEF = {}

    def __init__(self, **kw):
        self.emu = EMU
        self.p = dict(self.DEF)
        self.p.update(kw)

    def supports(self, name):
        return name in self.IFACES or name in ('IKompasAPIObject', 'IDispatch')

    def dyn_class(self):
        import fakewin
        if self.DYN:
            return fakewin.CLASSES.get(fakewin.NAMES.get(self.DYN))
        for n in self.IFACES:
            c = fakewin.CLASSES.get(fakewin.NAMES.get(n))
            if c is not None:
                return c
        return None

    def dyn_get(self, name):
        return self.invoke(None, name, 'get', [])

    def invoke(self, iface, name, kind, args):
        f = getattr(self, ('g_' if kind == 'get' else 's_' if kind == 'put' else 'm_') + name, None)
        if f is not None:
            return f(*args)
        if kind == 'get':
            if name in self.p:
                return self.p[name]
            if name in ('Application',):
                return EMU.app
            if name in ('Valid',):
                return True
            self.emu.gap(type(self).__name__, iface, name, kind)
            return 0
        if kind == 'put':
            self.p[name] = args[0]
            return None
        if kind == 'call' and name.startswith('Set') and len(args) == 1 and name[3:] in self.p:
            self.p[name[3:]] = args[0]
            return True
        self.emu.gap(type(self).__name__, iface, name, kind)
        return None

    def enum_items(self):
        return []


# ---------------------------------------------------------------- тексты API7
class TextItem(Impl):
    IFACES = ('ITextItem', 'ITextFont', 'ITextItemFont')
    DEF = dict(ItemType=0, Str='', Height=0.0, WidthFactor=1.0, Bold=False, Italic=True, Underline=False, FontName='GOST type A', Color=0)

    def m_Update(self):
        return True


class TextLine(Impl):
    IFACES = ('ITextLine',)
    DEF = dict(Align=0, Style=0, Numbering=0, Level=0)

    def __init__(self, **kw):
        Impl.__init__(self, **kw)
        self.items = []

    def g_Str(self):
        return ''.join(str(i.p['Str']) for i in self.items)

    def s_Str(self, v):
        self.items = [TextItem(Str=str(v))] if str(v) != '' else []

    def g_Count(self):
        return len(self.items)

    def m_TextItem(self, j):
        if not 0 <= int(j) < len(self.items):
            self.emu.err('ITextLine.TextItem(%s): нет такого компонента' % j)
            return None
        return self.items[int(j)]

    def m_Add(self):
        it = TextItem()
        self.items.append(it)
        return it

    def height(self, dflt=3.5):
        hs = [float(i.p['Height']) for i in self.items if i.p['Height']]
        return max(hs) if hs else dflt

    def width(self, dflt=3.5):
        w, n = 0.0, 0
        for i in self.items:
            h = float(i.p['Height']) or dflt
            if str(i.p['Str']):
                # запас КОМПАС (KW_BASE) — один на строку, а не на каждый компонент
                w += tw(str(i.p['Str']), h) - (KW_BASE * h if n else 0.0)
                n += 1
        return w


class Text(Impl):
    # текст ячейки и надписи КОМПАС отдаётся и как ITextLine (первая строка): в настоящем КОМПАС 25 _cast(Cell.Text, ITextLine) проходит (журнал: рамки допусков)
    IFACES = ('IText', 'ITextLine')
    DEF = dict(Style=0)

    def invoke(self, iface, name, kind, args):
        if iface == 'ITextLine':
            if not self.lines:
                self.lines = [TextLine()]
            return self.lines[0].invoke(iface, name, kind, args)
        return Impl.invoke(self, iface, name, kind, args)

    def __init__(self, **kw):
        Impl.__init__(self, **kw)
        self.lines = []

    def g_Str(self):
        return '\n'.join(l.g_Str() for l in self.lines)

    def s_Str(self, v):
        self.lines = []
        for s in str(v).split('\n'):
            ln = TextLine()
            ln.s_Str(s)
            self.lines.append(ln)
        if v == '':
            self.lines = [TextLine()]

    def g_Count(self):
        return len(self.lines)

    def m_TextLine(self, i):
        if not 0 <= int(i) < len(self.lines):
            self.emu.err('IText.TextLine(%s): нет такой строки (строк %d)' % (i, len(self.lines)))
            return None
        return self.lines[int(i)]

    def m_Add(self):
        ln = TextLine()
        self.lines.append(ln)
        return ln

    def strs(self):
        return [l.g_Str() for l in self.lines if l.g_Str()]


# ---------------------------------------------------------------- геометрия
def rot(px, py, a):
    c, s = math.cos(math.radians(a)), math.sin(math.radians(a))
    return px * c - py * s, px * s + py * c


def L(x1, y1, x2, y2, st=2):
    return ('L', float(x1), float(y1), float(x2), float(y2), st)


def T(x, y, s, h, ang=0.0, w=None):
    """Надпись: (x, y) — левый нижний угол, ang — угол строки."""
    return ('T', float(x), float(y), str(s), float(h), float(ang), tw(s, h) if w is None else float(w))


def arrow(x, y, ang, ln=5.0):
    """Стрелка с остриём в (x, y), направленная по углу ang (как в DXF КОМПАС: 5 × 1,32 мм)."""
    out = []
    for d in (0.66, -0.66):
        bx, by = rot(-ln, d, ang)
        out.append(L(x, y, x + bx, y + by, 2))
    return out


def prim_box(q):
    if q[0] == 'L':
        return (min(q[1], q[3]), min(q[2], q[4]), max(q[1], q[3]), max(q[2], q[4]))
    if q[0] == 'C':
        return (q[1] - q[3], q[2] - q[3], q[1] + q[3], q[2] + q[3])
    if q[0] == 'A':
        # дуга от a1 к a2 против часовой стрелки: концы и попавшие в неё точки на осях
        a1, a2 = q[4] % 360.0, q[5] % 360.0
        span = (a2 - a1) % 360.0 or 360.0
        angs = [a1, a1 + span] + [k * 90.0 for k in range(-4, 9) if a1 < k * 90.0 < a1 + span]
        xs = [q[1] + q[3] * math.cos(math.radians(a)) for a in angs]
        ys = [q[2] + q[3] * math.sin(math.radians(a)) for a in angs]
        return (min(xs), min(ys), max(xs), max(ys))
    if q[0] == 'T':
        lo, hi = -t_lo(q[4]), t_hi(q[4])
        pts = [rot(u, v, q[5]) for u, v in ((0, lo), (q[6], lo), (q[6], hi), (0, hi))]
        xs = [q[1] + p[0] for p in pts]
        ys = [q[2] + p[1] for p in pts]
        return (min(xs), min(ys), max(xs), max(ys))
    return None


def union(boxes):
    boxes = [b for b in boxes if b]
    if not boxes:
        return None
    return (min(b[0] for b in boxes), min(b[1] for b in boxes), max(b[2] for b in boxes), max(b[3] for b in boxes))


# ---------------------------------------------------------------- объекты чертежа API7
class DObj(Impl):
    BASE = ('IDrawingObject', 'IDrawingObject1')
    KIND = ''

    def __init__(self, view, **kw):
        Impl.__init__(self, **kw)
        self.view = view
        self.ref = 0
        self.prims = []
        self.p.setdefault('LayerNumber', 0)
        self.p.setdefault('DrawingObjectParamType', -1)

    def supports(self, name):
        return name in self.IFACES or name in self.BASE or name in ('IKompasAPIObject', 'IDispatch')

    def g_Reference(self):
        return self.ref

    def g_Temp(self):
        return self.ref == 0

    def m_Update(self):
        prims = self.geom()
        if prims is False:
            return False
        self.prims = prims or []
        sh = self.view.doc.sheet
        if not self.ref:
            self.ref = sh.new_ref(self)
        return True

    def m_Delete(self):
        if self.ref:
            self.view.doc.sheet.drop(self.ref)
            self.ref = 0
        return True

    def geom(self):
        return []

    def box(self):
        return union(prim_box(q) for q in self.prims)


def _txt_attr(obj, name):
    t = obj.p.get(name)
    if t is None:
        t = Text()
        t.lines = [TextLine()]
        obj.p[name] = t
    return t


def _tl_attr(obj, name):
    t = obj.p.get(name)
    if t is None:
        t = TextLine()
        obj.p[name] = t
    return t


class Branchs:
    """IBranchs: начало ветвей (X0, Y0) и ответвления."""

    def init_br(self):
        self.p.setdefault('X0', 0.0)
        self.p.setdefault('Y0', 0.0)
        self.branches = []

    def m_AddBranchByPoint(self, idx, x, y):
        self.branches.append([(float(x), float(y))])
        return True

    def m_AddBranch(self, idx, pts):
        v = list(pts)
        self.branches.append([(float(v[i]), float(v[i + 1])) for i in range(0, len(v) - 1, 2)])
        return True

    def g_BranchCount(self):
        return len(self.branches)

    def m_DeleteBranch(self, idx):
        if 0 <= idx < len(self.branches):
            del self.branches[idx]
        return True


class LineDimension(DObj):
    IFACES = ('ILineDimension', 'IDimensionText', 'IDimensionParams', 'IDimension2D', 'ILineDimension1')
    DEF = dict(X1=0.0, Y1=0.0, X2=0.0, Y2=0.0, X3=0.0, Y3=0.0, Orientation=0, Angle=0.0, AutoNominalValue=True, DeviationOn=False,
               ArrowPos=0, TextType=0, TextPos=0, ShelfX=0.0, ShelfY=0.0, Style=0, Sign=0, ToleranceOn=False, HasTolerance=False,
               Brackets=0, Rectangle=False, Underline=False, TextAlign=0, TextFormat=0, DeviationType=0, Accuracy=0, Tolerance='',
               ArrowType1=1, ArrowType2=1, Gap=True, GapValue=0.0, RemoteLine1=True, RemoteLine2=True, ShelfAngle=0.0, ShelfDirection=0,
               ShelfLength=0.0, TextBase=0, TextOnLine=0, NominalValue=0.0)

    def g_NominalText(self):
        return _tl_attr(self, 'NominalText')

    def s_ShelfX(self, v):
        self.p['ShelfX'], self.shelf = float(v), True

    def s_ShelfY(self, v):
        self.p['ShelfY'], self.shelf = float(v), True

    def g_HighDeviation(self):
        return _tl_attr(self, 'HighDeviation')

    def g_LowDeviation(self):
        return _tl_attr(self, 'LowDeviation')

    def text_wh(self):
        nt = _tl_attr(self, 'NominalText')
        h = nt.height()
        w = nt.width()
        if self.p['DeviationOn']:
            w += max(_tl_attr(self, 'HighDeviation').width(h * 0.7), _tl_attr(self, 'LowDeviation').width(h * 0.7)) + 0.5
        if not self.p['AutoNominalValue'] and not nt.g_Str():
            self.emu.err('размер без номинала (AutoNominalValue = False, NominalText пуст)')
        return w, h

    def g_Width(self):
        return self.text_wh()[0]

    def g_Height(self):
        # калибровка КОМПАС 25: 5,167 при h 3,5 — высота габарита надписи
        return 1.476 * self.text_wh()[1]

    def geom(self):
        P = self.p
        o = int(P['Orientation'])
        if o == 0:
            return self.geom_par()
        if o not in (1, 2):
            o = 1 if abs(P['Y2'] - P['Y1']) < abs(P['X2'] - P['X1']) else 2
        H = o == 1
        # координаты вдоль размера (a) и поперёк (b)
        a1, a2 = (P['X1'], P['X2']) if H else (P['Y1'], P['Y2'])
        b1, b2 = (P['Y1'], P['Y2']) if H else (P['X1'], P['X2'])
        bd = P['Y3'] if H else P['X3']
        w, h = self.text_wh()
        lo, hi = min(a1, a2), max(a1, a2)
        d = 1.0 if a2 >= a1 else -1.0
        out = P['ArrowPos'] == 1
        ext = DIM_EXT if out else 0.0
        # точка надписи (X3 / Y3), заданная макросом; после Update() там читается начало надписи — его не путать с заданной
        k3 = 'X3' if H else 'Y3'
        if getattr(self, 't3w', None) is None or abs(P[k3] - self.t3w) > 1e-6:
            self.t3s = P[k3]
        t3 = self.t3s
        extra = []
        gtx, gext = None, []
        if getattr(self, 'shelf', False):
            # журнал 7 (полка: ShelfX / ShelfY после Update, TextType читается 2): выноска из (X3, Y3) в точку полки,
            # полка от неё влево (у вертикального — вниз) на ширину + 4 мм, надпись над полкой, правый край — в 2 мм от точки.
            # ShelfDirection (IDimensionParams; −1 влево, 1 вправо, 2 вверх, 3 вниз) не калиброван — так же, по направлению полки
            P['TextType'] = 2
            sx, sy = P['ShelfX'], P['ShelfY']
            sd = int(P['ShelfDirection'])
            if sd not in (-1, 1, 2, 3):
                sd = -1 if H else 3
            elif self.emu:
                self.emu.note('размер «%s»: направление полки (ShelfDirection %d) не калибровано' % (self.label(), sd))
            ux, uy = {-1: (-1, 0), 1: (1, 0), 2: (0, 1), 3: (0, -1)}[sd]
            x3, y3 = (t3, bd) if H else (bd, t3)
            gext = [(x3, y3, sx, sy), (sx, sy, sx + ux * (w + 4.0), sy + uy * (w + 4.0))]
            if uy == 0:
                gtx = (min(sx + 2.0 * ux, sx + ux * (w + 2.0)), sy + DIM_TB, 0)
            else:
                gtx = (sx - DIM_TB, min(sy + 2.0 * uy, sy + uy * (w + 2.0)), 90)
            t0, t1 = lo, hi
            dl0, dl1 = lo - ext, hi + ext
            tb = bd
            P[k3] = t3
            self.t3w = None
        elif int(P['TextType']) != 0:
            # журнал 6 (ручное размещение, TextType = 1; точки по возрастанию): точка надписи до первой точки — надпись на
            # продолжении линии, правый край в 2 мм от точки, линия — на 2 мм дальше надписи; точка между выносными — надпись
            # с другой стороны: X3 читается как точка + длина, надпись в (ширина + 6) мм за ней, оторванная линия до надписи
            # и лишний отрезок 5 мм у первой выносной; точка за второй выносной — как на (L − 5,1) от первой.
            # Точки в обратном порядке не калиброваны — зеркально (с пометкой)
            L0 = hi - lo
            u = (t3 - a1) * d
            if d < 0:
                self.emu.note('размер «%s»: ручная надпись при X1 > X2 не калибрована' % self.label())
            if u < 0:
                v1 = u - 2.0
                v0 = v1 - w
                dl = (v0 - 2.0, 0.0)
                P[k3] = t3
            else:
                ue = (u if u <= L0 else L0 - 5.1) + L0
                v0 = ue + w + 6.0
                v1 = v0 + w
                dl = (0.0, L0)
                extra = [(a1 + d * ue, bd, a1 + d * (v0 - 2.0), bd), (a1, b1, a1 - d * 5.0, b1)]
                P[k3] = a1 + d * ue
            t0, t1 = sorted((a1 + d * v0, a1 + d * v1))
            e0, e1 = sorted((a1 + d * dl[0], a1 + d * dl[1]))
            dl0, dl1 = min(lo - ext, e0), max(hi + ext, e1)
            tb = bd
            self.t3w = P[k3]
        else:
            # калибровка КОМПАС 25 (журнал 4): надпись — по центру, если L ≥ ширина + 0,3 мм (порог между −0,3 и 0,9);
            # точка надписи за выносной линией — надпись снаружи с той стороны в 5 мм от линии (даже если помещается);
            # не помещается — снаружи у первой точки привязки (X1 правее X2 — справа)
            if t3 < lo - 0.01:
                side = -1
            elif t3 > hi + 0.01:
                side = 1
            elif hi - lo >= max(w + 0.3, 0.0 if H else DIM_MIN_IN_V):
                side = 0
            else:
                side = -1 if d > 0 else 1
            if side == 0:
                t0 = (a1 + a2) / 2.0 - w / 2.0
                t1 = t0 + w
                dl0, dl1 = lo - ext, hi + ext
            else:
                t0 = lo - DIM_OUT - w if side < 0 else hi + DIM_OUT
                t1 = t0 + w
                dl0, dl1 = min(lo - ext, t0 - DIM_OUT_TAIL), max(hi + ext, t1 + DIM_OUT_TAIL)
            P[k3] = self.t3w = round(t0, 3)
            tb = bd
        sb1 = 1.0 if bd >= b1 else -1.0
        sb2 = 1.0 if bd >= b2 else -1.0
        # журнал 6: точка привязки на самой размерной линии — выносной линии (и выхода 2 мм) нет
        segs = [sg for sg, b in (((a1, b1, a1, bd + 2 * sb1), b1), ((a2, b2, a2, bd + 2 * sb2), b2)) if abs(bd - b) > 0.01] + [(dl0, bd, dl1, bd)] + extra
        pr = []
        for s in segs:
            pr.append(L(s[0], s[1], s[2], s[3]) if H else L(s[1], s[0], s[3], s[2]))
        pr += [L(*sg) for sg in gext]
        if H:
            pr += arrow(lo, bd, 0 if out else 180) + arrow(hi, bd, 180 if out else 0)
            if gtx is None:
                pr.append(T(t0, tb + DIM_TB, self.label(), h, 0, w))
        else:
            pr += arrow(bd, lo, 90 if out else 270) + arrow(bd, hi, 270 if out else 90)
            if gtx is None:
                pr.append(T(tb - DIM_TB, t0, self.label(), h, 90, w))
        if gtx is not None:
            pr.append(T(gtx[0], gtx[1], self.label(), h, gtx[2], w))
        return pr

    def geom_par(self):
        """Размер параллельно объекту (Orientation = 0, журнал 6: 20 из 20 наклонных размеров «объектами» без расхождения):
        размерная линия — через (X3, Y3) параллельно (X1, Y1)–(X2, Y2), выносные линии — с выходом 2 мм, надпись — по центру
        «над» линией по направлению чтения; не помещается — снаружи у первой точки, как у горизонтального."""
        P = self.p
        x1, y1, x2, y2 = P['X1'], P['Y1'], P['X2'], P['Y2']
        ln = math.hypot(x2 - x1, y2 - y1)
        if ln < 1e-6:
            self.emu.err('размер: (X1, Y1) совпадает с (X2, Y2)')
            return False
        ux, uy = (x2 - x1) / ln, (y2 - y1) / ln
        nx, ny = -uy, ux
        dist = (P['X3'] - x1) * nx + (P['Y3'] - y1) * ny
        if dist < 0:
            nx, ny, dist = -nx, -ny, -dist
        w, h = self.text_wh()
        out = P['ArrowPos'] == 1
        ext = DIM_EXT if out else 0.0
        ax, ay, bx, by = x1 + nx * dist, y1 + ny * dist, x2 + nx * dist, y2 + ny * dist
        pr = [L(x1, y1, x1 + nx * (dist + 2), y1 + ny * (dist + 2)), L(x2, y2, x2 + nx * (dist + 2), y2 + ny * (dist + 2))]
        if ln >= w + 0.3:
            s0, s1 = -ext, ln + ext
            tc = ln / 2.0
        else:
            s0, s1 = -DIM_OUT - w - DIM_OUT_TAIL, ln + ext
            tc = -DIM_OUT - w / 2.0
        pr.append(L(ax + ux * s0, ay + uy * s0, ax + ux * s1, ay + uy * s1))
        ang = math.degrees(math.atan2(uy, ux))
        pr += arrow(ax, ay, ang if out else ang + 180) + arrow(bx, by, ang + 180 if out else ang)
        ar = ang
        while ar > 90.01:
            ar -= 180
        while ar <= -89.99:
            ar += 180
        ca, sa = math.cos(math.radians(ar)), math.sin(math.radians(ar))
        cx, cy = ax + ux * tc, ay + uy * tc
        pr.append(T(cx - ca * w / 2.0 - sa * DIM_TB, cy - sa * w / 2.0 + ca * DIM_TB, self.label(), h, ar, w))
        return pr

    def label(self):
        s = _tl_attr(self, 'NominalText').g_Str()
        if self.p['DeviationOn']:
            s += '(%s/%s)' % (_tl_attr(self, 'HighDeviation').g_Str(), _tl_attr(self, 'LowDeviation').g_Str())
        return s


class BreakLineDimension(LineDimension):
    """Размер с обрывом. Калибровка КОМПАС 25 (25 проб, надпись «⌀40k6»):
    (X1, Y1) — точка привязки, (X2, Y2) задаёт направление выносной линии e; после Update() X2, Y2 — проекция (X3, Y3) на эту линию,
    размерная линия — через неё перпендикулярно e, стрелка там же. Сторона линии n = (e.y, −e.x), если (X3, Y3) на выносной линии
    (тогда X3 читается как X2 + 5n); иначе — сторона, где (X3, Y3): если до неё не меньше ширины надписи + 1 мм, линия идёт до неё
    и надпись по её центру (журнал 4), а если ближе — линия продолжается и за стрелку на ширину + 7 мм, надпись там.
    Надпись — «над» линией по направлению чтения (габарит от 0,9 до 6,17 мм от линии), с 6 мм от стрелки."""
    IFACES = ('IBreakLineDimension', 'IDimensionText', 'IDimensionParams', 'IDimension2D')

    def geom(self):
        P = self.p
        x1, y1, x3, y3 = P['X1'], P['Y1'], P['X3'], P['Y3']
        if not getattr(self, 'br_e', None):
            ex, ey = P['X2'] - x1, P['Y2'] - y1
            el = math.hypot(ex, ey)
            if el < 1e-6:
                self.emu.err('размер с обрывом: (X2, Y2) совпадает с (X1, Y1) — нет направления выносной линии')
                return False
            self.br_e = (ex / el, ey / el)
        ex, ey = self.br_e
        t = (x3 - x1) * ex + (y3 - y1) * ey
        px, py = x1 + ex * t, y1 + ey * t
        P['X2'], P['Y2'] = round(px, 3), round(py, 3)
        nx, ny = ey, -ex
        off = (x3 - px) * nx + (y3 - py) * ny
        w, h = self.text_wh()
        need = w + 7.0
        # журнал 4: (X3, Y3) в 15 мм при надписи 12,3 — линия до неё и надпись на ней (по центру), журнал 6 — так же уже в 12,8 мм; в журнале 3 — 8 мм, надпись за стрелкой
        far_min = w + 0.3
        if abs(off) < 0.01:
            sx, sy, far = nx, ny, None
            P['X3'], P['Y3'] = round(px + 5 * nx, 3), round(py + 5 * ny, 3)
        elif abs(off) >= far_min:
            (sx, sy), far = ((nx, ny) if off > 0 else (-nx, -ny)), abs(off)
        else:
            (sx, sy), far = ((-nx, -ny) if off > 0 else (nx, ny)), None
        ln = far if far else need
        pr = [L(px, py, px + sx * ln, py + sy * ln)]
        if far is None and abs(off) >= 0.01:
            pr.append(L(px, py, x3, y3))
        # выносная линия от точки привязки — с выходом 2 мм за размерную; при нулевой длине — только выход (поворот стороны на −90°)
        if abs(t) > 0.5:
            sg = 1.0 if t > 0 else -1.0
            pr.append(L(x1, y1, px + ex * sg * 2, py + ey * sg * 2))
        elif far:
            pr.append(L(px, py, px - sy * 2, py + sx * 2))       # журнал 4: выход 2 мм — поворот стороны на +90° (18 проб из 20)
        else:
            pr.append(L(px, py, px + sy * 2, py - sx * 2))
        ang = math.degrees(math.atan2(sy, sx))
        ar = ang
        while ar > 90.01:
            ar -= 180
        while ar <= -89.99:
            ar += 180
        same = abs(((ang - ar) + 180) % 360 - 180) < 1
        ca, sa = math.cos(math.radians(ar)), math.sin(math.radians(ar))
        if far:
            st = (far - w) / 2.0 if same else (far + w) / 2.0   # журнал 4: надпись по центру линии
        else:
            st = 6.0 if same else 6.0 + w            # левый край надписи по направлению чтения
        bx, by = px + sx * st, py + sy * st
        bx, by = bx - sa * DIM_TB, by + ca * DIM_TB
        pr.append(T(bx, by, self.label(), h, ar, w))
        return pr


class AngleDimension(LineDimension):
    IFACES = ('IAngleDimension', 'IDimensionText', 'IDimensionParams', 'IDimension2D')
    DEF = dict(LineDimension.DEF, Xc=0.0, Yc=0.0, Angle1=0.0, Angle2=90.0, Radius=10.0, Direction=True, DimensionType=0)

    def geom(self):
        P = self.p
        xc, yc, r, a1, a2 = P['Xc'], P['Yc'], P['Radius'], P['Angle1'], P['Angle2']
        # калибровка КОМПАС 25: выносных линий от вершины нет (габарит — дуга и надпись); надпись — вдоль дуги снаружи у середины
        # (гипотеза: по 16 пробам надпись сдвинута к одной из сторон до 2–4 мм, правило не снято)
        pr = [('A', xc, yc, abs(r), a1, a2, 2)]
        w, h = self.text_wh()
        am = (a1 + a2) / 2.0
        ar = am - 90.0
        while ar > 90.01:
            ar -= 180
        while ar <= -89.99:
            ar += 180
        ca, sa = math.cos(math.radians(ar)), math.sin(math.radians(ar))
        cx, cy = xc + (r + 0.9 + t_lo(h)) * math.cos(math.radians(am)), yc + (r + 0.9 + t_lo(h)) * math.sin(math.radians(am))
        # «верх» надписи — наружу от дуги
        up = (-sa, ca)
        if up[0] * math.cos(math.radians(am)) + up[1] * math.sin(math.radians(am)) < 0:
            cx, cy = xc + (r + 0.9 + t_hi(h)) * math.cos(math.radians(am)), yc + (r + 0.9 + t_hi(h)) * math.sin(math.radians(am))
        P['X3'], P['Y3'] = round(cx - ca * w / 2, 3), round(cy - sa * w / 2, 3)
        pr.append(T(cx - ca * w / 2, cy - sa * w / 2, self.label(), h, ar, w))
        return pr


class Leader(DObj, Branchs):
    IFACES = ('ILeader', 'IBaseLeader', 'IBranchs', 'ILeader1')
    DEF = dict(ArrowType=2, ShelfDirection=1, SignType=0, Around=False, ParamsByLeader=False, TextPos=0)
    POS = False

    def __init__(self, view, **kw):
        DObj.__init__(self, view, **kw)
        self.init_br()

    def g_TextOnShelf(self):
        return _txt_attr(self, 'TextOnShelf')

    def g_TextUnderShelf(self):
        return _txt_attr(self, 'TextUnderShelf')

    def g_TextOnBranch(self):
        return _txt_attr(self, 'TextOnBranch')

    def g_Positions(self):
        return _txt_attr(self, 'Positions')

    def geom(self):
        P = self.p
        x0, y0 = P['X0'], P['Y0']
        sd = 1 if int(P['ShelfDirection']) >= 0 else -1
        pr = []
        for br in self.branches:
            pts = [(x0, y0)] + br
            for (ax, ay), (bx, by) in zip(pts, pts[1:]):
                pr.append(L(ax, ay, bx, by))
            (ax, ay), (bx, by) = pts[-2], pts[-1]
            if int(P['ArrowType']) == 2:
                pr += arrow(bx, by, math.degrees(math.atan2(by - ay, bx - ax)))
            elif int(P['ArrowType']) == 1:
                pr.append(('C', bx, by, 0.8, 2))
        if self.POS:
            ns = _txt_attr(self, 'Positions').lines
            h = max([l.height(7.0) for l in ns] or [7.0])
            w = max([l.width(7.0) for l in ns] or [0.0])
            L_ = 2 + w + 2
            pr.append(L(x0, y0, x0 + sd * L_, y0))
            for i, ln in enumerate(ns):
                yy = y0 + 1 + i * 9
                xx = x0 + 2 if sd > 0 else x0 - 2 - ln.width(7.0)
                pr.append(T(xx, yy, ln.g_Str(), ln.height(7.0)))
            return pr
        up = _txt_attr(self, 'TextOnShelf').lines
        dn = _txt_attr(self, 'TextUnderShelf').lines
        w = max([l.width() for l in up + dn] or [0.0])
        L_ = 2 + w + 2
        pr.append(L(x0, y0, x0 + sd * L_, y0))
        for i, ln in enumerate([l for l in up if l.g_Str()][::-1]):
            h = ln.height()
            xx = x0 + 2 if sd > 0 else x0 - 2 - ln.width()
            pr.append(T(xx, y0 + 2.11 + i * (h + 2), ln.g_Str(), h))
        for i, ln in enumerate([l for l in dn if l.g_Str()]):
            h = ln.height()
            xx = x0 + 2 if sd > 0 else x0 - 2 - ln.width()
            pr.append(T(xx, y0 - 1.56 - h - i * (h + 2), ln.g_Str(), h))
        return pr


class PosLeader(Leader):
    IFACES = ('IPositionLeader', 'IBaseLeader', 'IBranchs')
    POS = True


class Rough(DObj, Branchs):
    IFACES = ('IRough', 'IRoughParams', 'IBranchs')
    DEF = dict(Angle=0.0, ShelfX=0.0, ShelfY=0.0, SignType=0, ArrowType=0, ArrowInside=False, LeaderAngle=0.0, LeaderLength=0.0,
               ProcessingByContour=False, ShelfDirection=1, ShowBrackets=False)

    def __init__(self, view, **kw):
        DObj.__init__(self, view, **kw)
        self.init_br()

    # журнал КОМПАС 25: знак стоит в начале ветвей IBranchs (X0, Y0), по умолчанию — в (0, 0);
    # IRough.BranchX0/BranchY0 — конец выноски у поверхности, без длины выноски знак не двигает; AddBranchByPoint не проходит
    def init_br(self):
        Branchs.init_br(self)
        self.p.setdefault('BranchX0', 0.0)
        self.p.setdefault('BranchY0', 0.0)

    def m_AddBranchByPoint(self, idx, x, y):
        return False

    # журналы 3 и 4: у знака с заданным направлением полки Y0 сразу читается на 10 мм выше заданного
    # (макрос, что считал длину выноски от прочитанного Y0, получал знак на 10 мм выше)
    def s_ShelfDirection(self, v):
        self.p['ShelfDirection'] = v
        self.shelf_set = True

    def s_Y0(self, v):
        self.p['Y0'] = float(v) + (10.0 if getattr(self, 'shelf_set', False) else 0.0)

    def g_RoughParamText(self):
        return _txt_attr(self, 'RoughParamText')

    def g_ProcessText(self):
        return _txt_attr(self, 'ProcessText')

    def g_AdditionalText(self):
        return _txt_attr(self, 'AdditionalText')

    def g_BaseLengthText(self):
        return _txt_attr(self, 'BaseLengthText')

    def g_TrendText(self):
        return _txt_attr(self, 'TrendText')

    def sign(self, x, y, a):
        """Знак с остриём в (x, y); a — угол оси знака на листе (90 — знак стоит прямо).
        Размеры — по журналу КОМПАС 25: знак с «Ra 1,6» (h 3,5) занимает от −2,9 до 18,4 мм по ширине и 8,5 мм по высоте."""
        tl = [l for l in _txt_attr(self, 'RoughParamText').lines if l.g_Str()]
        h = tl[0].height() if tl else 3.5
        Hh, t = 8.5, math.tan(math.radians(30))
        w = (tl[0].width() + 1.36) if tl else 0.0
        r = a - 90
        def P(u, v):
            q = rot(u, v, r)
            return x + q[0], y + q[1]
        pL, pR, pE = P(-2.9, 2.9 / t), P(Hh * t, Hh), P(Hh * t + w, Hh)
        pr = [L(pL[0], pL[1], x, y, 1), L(x, y, pR[0], pR[1], 1)]
        if w:
            pr.append(L(pR[0], pR[1], pE[0], pE[1], 1))
            # калибровка КОМПАС 25: надпись — в пределах высоты знака (верх габарита — 8,5 мм)
            tp = P(Hh * t + 0.68, Hh - t_hi(h) - 0.01)
            pr.append(T(tp[0], tp[1], tl[0].g_Str(), h, r, w - 1.36))
        return pr

    def geom(self):
        P = self.p
        bx, by = P['BranchX0'], P['BranchY0']
        if abs(bx) + abs(by) > 1e-6:
            # с выноской (калибровка КОМПАС 25, «Ra 1,6» h 3,5): длину и угол выноски КОМПАС пересчитывает — от (BranchX0, BranchY0) к знаку; знак на полке в (X0, Y0): полка длиной ширина + 11,34 мм
            # вправо (ShelfDirection 1) или влево, верх знака — на 8,5 мм над полкой
            # журнал 4: знак — в (BranchX0, BranchY0) + LeaderLength · (cos, sin) LeaderAngle, если длина выноски задана;
            # иначе — в (X0, Y0); Y0 после задания полки читается на 10 мм выше (s_Y0)
            if not getattr(self, 'rl_up', False):
                if P['LeaderLength'] > 0:
                    P['X0'] = bx + P['LeaderLength'] * math.cos(math.radians(P['LeaderAngle']))
                    P['Y0'] = by + P['LeaderLength'] * math.sin(math.radians(P['LeaderAngle']))
                self.rl_up = True
            x0, y0 = P['X0'], P['Y0']
            P['LeaderLength'] = round(math.hypot(x0 - bx, y0 - by), 3)
            P['LeaderAngle'] = round(math.degrees(math.atan2(y0 - by, x0 - bx)) % 360.0, 3)
            P['ShelfX'], P['ShelfY'] = x0, y0
            P['Angle'] = 90.0
            tl = [l for l in _txt_attr(self, 'RoughParamText').lines if l.g_Str()]
            h = tl[0].height() if tl else 3.5
            w = tl[0].width() if tl else 0.0
            sw = (w + 11.34) * (-1 if int(P['ShelfDirection']) == -1 else 1)
            # стрелка у поверхности в габарит КОМПАС не входит (выноска вертикально — габарит ровно по X0)
            pr = [L(bx, by, x0, y0), L(x0, y0, x0 + sw, y0), L(x0, y0 + 8.5, x0 + sw, y0 + 8.5, 1)]
            if tl:
                pr.append(T(min(x0, x0 + sw) + 7.0, y0 + 8.5 - t_hi(h), tl[0].g_Str(), h, 0, w))
            return pr
        return self.sign(P['X0'], P['Y0'], P['Angle'])


class Table(Impl):
    IFACES = ('ITable',)

    def __init__(self, rows, cols, rh, cw, owner=None):
        Impl.__init__(self)
        self.owner = owner
        self.W = [float(cw)] * int(cols)
        self.H = [float(rh)] * int(rows)
        self.cells = {}

    def g_ColumnsCount(self):
        return len(self.W)

    def g_RowsCount(self):
        return len(self.H)

    def m_AddColumn(self, i, right):
        i = int(i)
        if i < 0 or i >= len(self.W):
            i = len(self.W) - 1
        self.W.insert(i + 1 if right else i, 10.0)
        return True

    def m_DeleteColumn(self, i):
        i = int(i)
        if not 0 <= i < len(self.W):
            self.emu.err('ITable.DeleteColumn(%d): нет столбца' % i)
            return False
        del self.W[i]
        self.cells = {(r, c if c < i else c - 1): v for (r, c), v in self.cells.items() if c != i}
        return True

    def m_AddRow(self, i, down):
        self.H.insert(int(i) + (1 if down else 0), self.H[-1] if self.H else 10.0)
        return True

    def m_DeleteRow(self, i):
        del self.H[int(i)]
        return True

    def m_Cell(self, r, c):
        r, c = int(r), int(c)
        if not (0 <= r < len(self.H) and 0 <= c < len(self.W)):
            self.emu.err('ITable.Cell(%d, %d): нет ячейки (%d×%d)' % (r, c, len(self.H), len(self.W)))
            return None
        if (r, c) not in self.cells:
            self.cells[(r, c)] = Cell(self, r, c)
        return self.cells[(r, c)]

    def m_Range(self, r1, c1, r2, c2):
        return Range(self, int(r1), int(c1), int(r2), int(c2))

    def text_of(self, r, c):
        cl = self.cells.get((r, c))
        return cl.text.strs() if cl else []


class Cell(Impl):
    IFACES = ('ITableCell', 'ICellFormat')

    def __init__(self, t, r=0, c=0):
        Impl.__init__(self)
        self.t, self.r, self.c = t, r, c
        self.text = Text()
        self.text.lines = [TextLine()]

    def g_Text(self):
        return self.text

    # ICellFormat ячейки (гипотеза: в отличие от формата диапазона КОМПАС 25 его размеры применяет)
    def g_Width(self):
        return self.t.W[self.c]

    def s_Width(self, v):
        self.t.W[self.c] = float(v)

    def g_Height(self):
        return self.t.H[self.r]

    def s_Height(self, v):
        self.t.H[self.r] = float(v)


class Range(Impl):
    IFACES = ('ITableRange',)

    def __init__(self, t, r1, c1, r2, c2):
        Impl.__init__(self)
        self.t, self.r = t, (r1, c1, r2, c2)

    def g_CellsFormat(self):
        return CellFormat(self)


class CellFormat(Impl):
    IFACES = ('ICellFormat',)
    DEF = dict(HFormat=0, VFormat=0, LeftEdge=1.0, RightEdge=1.0, OneLine=False, ReadOnly=False, SpaceAfter=0.0, SpaceBefore=0.0, TextStyle=0)

    def __init__(self, rng):
        Impl.__init__(self)
        self.rng = rng

    def _apply(self):
        """Журнал КОМПАС 25: размеры через формат диапазона не применяются ни до, ни после первого Update (у таблицы допуска формы — применяются)."""
        o = self.rng.t.owner
        return o is None

    def g_Width(self):
        r1, c1, r2, c2 = self.rng.r
        return self.rng.t.W[c1]

    def s_Width(self, v):
        if self._apply():
            r1, c1, r2, c2 = self.rng.r
            for c in range(c1, c2 + 1):
                self.rng.t.W[c] = float(v)

    def g_Height(self):
        r1, c1, r2, c2 = self.rng.r
        return self.rng.t.H[r1]

    def s_Height(self, v):
        if self._apply():
            r1, c1, r2, c2 = self.rng.r
            for r in range(r1, r2 + 1):
                self.rng.t.H[r] = float(v)


def table_prims(t, x, y, h_default=3.5, top=True):
    """Сетка и тексты таблицы; (x, y) — левый верхний угол."""
    pr = []
    W, H = t.W, t.H
    tot_w, tot_h = sum(W), sum(H)
    pr.append(L(x, y, x + tot_w, y, 1))
    yy = y
    for hh in H:
        yy -= hh
        pr.append(L(x, yy, x + tot_w, yy, 1))
    xx = x
    pr.append(L(x, y, x, y - tot_h, 1))
    for ww in W:
        xx += ww
        pr.append(L(xx, y, xx, y - tot_h, 1))
    yy = y
    for r, hh in enumerate(H):
        xx = x
        for c, ww in enumerate(W):
            cl = t.cells.get((r, c))
            if cl:
                for i, ln in enumerate([l for l in cl.text.lines if l.g_Str()]):
                    h = ln.height(h_default)
                    pr.append(T(xx + 1, yy - hh / 2 - h / 2 - i * (h + 1), ln.g_Str(), h, 0, ln.width(h_default)))
            xx += ww
        yy -= hh
    return pr


class DrawingTable(DObj):
    IFACES = ('IDrawingTable', 'ITable')
    DEF = dict(X=0.0, Y=0.0, Angle=0.0, FixedCellsSize=False, FixedColumnCount=0, FixedRowCount=0, NumericGroup=0)

    def __init__(self, view, rows, cols, rh, cw, layout):
        DObj.__init__(self, view)
        self.t = Table(rows, cols, rh, cw, self)

    def invoke(self, iface, name, kind, args):
        if iface == 'ITable' or (iface is None and hasattr(self.t, ('g_' if kind == 'get' else 'm_') + name)):
            return self.t.invoke(iface, name, kind, args)
        return DObj.invoke(self, iface, name, kind, args)

    def geom(self):
        return table_prims(self.t, self.p['X'], self.p['Y'])


class Tolerance(DObj, Branchs):
    IFACES = ('ITolerance', 'IToleranceParam', 'IBranchs')
    DEF = dict(BasePointPos=1, Vertical=False, Sign=0, PrefixSign=0, SuffixSign=0, BaseSign1=0, BaseSign2=0, Value='')
    SIGNW = 7.6

    def __init__(self, view, **kw):
        DObj.__init__(self, view, **kw)
        self.init_br()
        # рамка допуска по умолчанию — 4 ячейки в строку (DXF КОМПАС 25: знак, допуск, база и пустая 10 мм)
        self.t = Table(1, 4, 10.0, 10.0)
        self.arrows = {}
        self.bpos = {}

    def g_Table(self):
        return self.t

    def m_SetArrowType(self, i, v):
        self.arrows[int(i)] = v
        return True

    def m_ArrowType(self, i):
        return self.arrows.get(int(i), True)

    def m_SetBranchPos(self, i, v):
        self.bpos[int(i)] = int(v)
        return True

    def m_BranchPos(self, i):
        return self.bpos.get(int(i), 2)

    def geom(self):
        t = self.t
        t.H = [10.0] * len(t.H)
        for c in range(len(t.W)):
            s = t.text_of(0, c)
            t.W[c] = self.SIGNW if c == 0 and s else (tw(' '.join(s), 3.5) + 5.0 if s else 10.0)
        x0, y0 = self.p['X0'], self.p['Y0']
        W, H = sum(t.W), sum(t.H)
        bp = int(self.p['BasePointPos'])
        # ksTablePointEnum: 1 — левый нижний, 2 — левый средний, 3 — левый верхний, 4..6 — правые (гипотеза для 4..6: зеркально)
        dy = {1: 0.0, 2: -H / 2, 3: -H, 4: 0.0, 5: -H / 2, 6: -H / 2}.get(bp, 0.0)
        dx = -W if bp in (4, 5, 6) else 0.0
        x, y = x0 + dx, y0 + dy + H
        pr = table_prims(t, x, y)
        for i, br in enumerate(self.branches):
            side = self.bpos.get(i, 2)
            sx, sy = {2: (x, y - H / 2), 6: (x + W, y - H / 2), 1: (x + 7.6 + 7, y - H), 3: (x + 7.6 + 7, y)}.get(side, (x, y - H / 2))
            pts = [(sx, sy)] + br
            for (ax, ay), (bx, by) in zip(pts, pts[1:]):
                pr.append(L(ax, ay, bx, by))
            (ax, ay), (bx, by) = pts[-2], pts[-1]
            pr += arrow(bx, by, math.degrees(math.atan2(by - ay, bx - ax)))
        return pr


class Base(DObj):
    IFACES = ('IBase',)
    DEF = dict(X0=0.0, Y0=0.0, BranchX=0.0, BranchY=0.0, DrawType=False, AutoSorted=True, Angle=0.0)

    def g_Text(self):
        return _txt_attr(self, 'Text')

    def geom(self):
        """Журнал 6 (база на горизонтальной и наклонной выноске): треугольник — основанием поперёк выноски, рамка 10 × 10 —
        за точкой (BranchX, BranchY) по направлению выноски: по оси, если выноска ближе 22,5° к оси, иначе — углом к точке."""
        P = self.p
        x0, y0, bx, by = P['X0'], P['Y0'], P['BranchX'], P['BranchY']
        ln = math.hypot(bx - x0, by - y0)
        dx, dy = ((bx - x0) / ln, (by - y0) / ln) if ln > 1e-6 else (0.0, 1.0)
        px, py = -dy * 2.89, dx * 2.89
        pr = [L(x0 - px, y0 - py, x0 + px, y0 + py, 1), L(x0 - px, y0 - py, x0 + dx * 5, y0 + dy * 5, 1),
              L(x0 + px, y0 + py, x0 + dx * 5, y0 + dy * 5, 1), L(x0, y0, bx, by)]
        k = math.sin(math.radians(22.5))
        sx = (1 if dx > 0 else -1) if abs(dx) > k else 0
        sy = (1 if dy > 0 else -1) if abs(dy) > k else 0
        cx, cy = bx + 5 * sx, by + 5 * sy
        pr += [L(cx - 5, cy - 5, cx + 5, cy - 5), L(cx + 5, cy - 5, cx + 5, cy + 5), L(cx + 5, cy + 5, cx - 5, cy + 5), L(cx - 5, cy + 5, cx - 5, cy - 5)]
        s = ''.join(_txt_attr(self, 'Text').strs())
        pr.append(T(cx - tw(s, 3.5) / 2, cy - 2.5, s, 3.5))
        return pr


class CutLine(DObj):
    IFACES = ('ICutLine',)
    DEF = dict(ArrowPos=True, ArrowType=0, AutoSheet=True, AutoSorted=True, AutoZone=True, AdditionalTextPos=0)

    def __init__(self, view, **kw):
        DObj.__init__(self, view, **kw)
        self.pts = []

    def s_Points(self, v):
        v = list(v)
        self.pts = [(float(v[i]), float(v[i + 1])) for i in range(0, len(v) - 1, 2)]

    def g_Points(self):
        return tuple(c for p in self.pts for c in p)

    def g_Text(self):
        return _txt_attr(self, 'Text')

    def g_AdditionalText(self):
        return _txt_attr(self, 'AdditionalText')

    def geom(self):
        if len(self.pts) < 2:
            self.emu.err('ICutLine: меньше двух точек')
            return False
        # калибровка КОМПАС 25 (6 проб, буква h 5): штрих у каждого конца — по направлению крайнего отрезка, вместе с буквой
        # выходит на 14,6 мм за конец (у верхнего конца вертикальной линии буква над штрихом — 18 мм); стрелка — 15 мм в сторону взгляда
        # (у горизонтальной линии буква над стрелкой — 16,5 мм). ArrowPos: TRUE — стрелки слева по направлению ломаной (справка SDK)
        (x1, y1), (x2, y2) = self.pts[0], self.pts[-1]
        (xa, ya), (xb, yb) = self.pts[1], self.pts[-2]
        pr = []
        for (px, py), (qx, qy) in (((x1, y1), (xa, ya)), ((x2, y2), (xb, yb))):
            dl = math.hypot(px - qx, py - qy) or 1.0
            ox, oy = (px - qx) / dl, (py - qy) / dl          # наружу от конца
            ext = 14.57 + (3.4 if oy > 0.9 else 0.22 if oy < -0.9 else 0.0)
            pr.append(L(px, py, px + ox * ext, py + oy * ext, 1))
        L_ = math.hypot(x2 - x1, y2 - y1) or 1.0
        for (px, py), (qx, qy), first in (((x1, y1), (xa, ya), True), ((x2, y2), (xb, yb), False)):
            dl = math.hypot(qx - px, qy - py) or 1.0
            ux, uy = ((qx - px) / dl, (qy - py) / dl) if first else ((px - qx) / dl, (py - qy) / dl)
            nx, ny = (-uy, ux) if self.p['ArrowPos'] else (uy, -ux)
            ac = 15.0 + (1.53 if abs(uy) < 0.1 and ny > 0 else 0.0)
            pr.append(L(px, py, px + nx * ac, py + ny * ac, 2))
        return pr


class ViewPointer(DObj):
    IFACES = ('IViewPointer',)
    DEF = dict(X1=0.0, Y1=0.0, X2=0.0, Y2=0.0, TextX=0.0, TextY=0.0, AutoSorted=True, AutoSheet=True, AutoZone=True)

    def g_Text(self):
        return _txt_attr(self, 'Text')

    def geom(self):
        P = self.p
        pr = [L(P['X1'], P['Y1'], P['X2'], P['Y2'])] + arrow(P['X2'], P['Y2'], math.degrees(math.atan2(P['Y2'] - P['Y1'], P['X2'] - P['X1'])), 7.5)
        s = ''.join(_txt_attr(self, 'Text').strs())
        tx, ty = (P['TextX'], P['TextY']) if (P['TextX'] or P['TextY']) else (P['X1'] - 3, P['Y1'] + 5)
        pr.append(T(tx, ty, s, 7.0))
        return pr


class CentreMarker(DObj):
    IFACES = ('ICentreMarker',)
    DEF = dict(X=0.0, Y=0.0, Angle=0.0, SignType=0, CrosshairSize=0.0, CrosshairSizeModify=False)

    def __init__(self, view, **kw):
        DObj.__init__(self, view, **kw)
        self.auto = [True] * 4
        self.len = [5.0] * 4

    def m_SetSemiAxisAutoLength(self, i, v):
        self.auto[int(i)] = bool(v)
        return True

    def m_SemiAxisAutoLength(self, i):
        return self.auto[int(i)]

    def m_SetSemiAxisLength(self, i, v):
        self.len[int(i)] = float(v)
        return True

    def m_SemiAxisLength(self, i):
        return self.len[int(i)]

    def geom(self):
        x, y, a = self.p['X'], self.p['Y'], self.p['Angle']
        L_ = [5.0 if self.auto[i] else self.len[i] for i in range(4)]
        q = [rot(L_[0], 0, a), rot(-L_[1], 0, a), rot(0, L_[2], a), rot(0, -L_[3], a)]
        return [L(x + q[1][0], y + q[1][1], x + q[0][0], y + q[0][1], 3), L(x + q[3][0], y + q[3][1], x + q[2][0], y + q[2][1], 3)]


class AxisLine(DObj):
    IFACES = ('IAxisLine',)
    DEF = dict(X1=0.0, Y1=0.0, X2=0.0, Y2=0.0, Angle=0.0, Length=0.0)

    def geom(self):
        P = self.p
        if math.hypot(P['X2'] - P['X1'], P['Y2'] - P['Y1']) < 1e-6:
            self.emu.err('IAxisLine: нулевая длина')
            return False
        return [L(P['X1'], P['Y1'], P['X2'], P['Y2'], 3)]


class DrawingText(DObj):
    IFACES = ('IDrawingText', 'IText')
    DEF = dict(X=0.0, Y=0.0, Angle=0.0, Allocation=0, Style=0, Flip=False)

    def __init__(self, view, **kw):
        DObj.__init__(self, view, **kw)
        self.text = Text()
        self.text.lines = [TextLine()]

    def invoke(self, iface, name, kind, args):
        if iface == 'IText' or (iface is None and name in ('Str', 'Count', 'TextLine', 'Add')):
            return self.text.invoke(iface, name, kind, args)
        return DObj.invoke(self, iface, name, kind, args)

    def geom(self):
        pr = []
        x, y = self.p['X'], self.p['Y']
        for i, ln in enumerate(self.text.lines):
            if ln.g_Str():
                h = ln.height()
                # калибровка КОМПАС 25: габарит текста API7 на 0,5 мм ниже, чем у текста API5 с той же точкой (h 3,5: −1,11…+4,06)
                bx, by = rot(0.0, -0.5 - i * (h + 1.5), self.p['Angle'])
                pr.append(T(x + bx, y + by, ln.g_Str(), h, self.p['Angle'], ln.width()))
        return pr


class Coll(Impl):
    """Коллекция обозначений вида (ILineDimensions, IRoughs …): Add создаёт объект."""

    def __init__(self, view, iface, cls, need_type=None):
        Impl.__init__(self)
        self.view, self.iface, self.cls, self.need_type = view, iface, cls, need_type
        self.IFACES = (iface,)

    def m_Add(self, *a):
        if self.need_type is not None:
            t = a[0] if a else None
            if t is None:
                self.emu.err('%s.Add(): нужен тип объекта' % self.iface)
                import fakewin
                fakewin.raise_com(fakewin.E_TYPE, 1)
            cls = self.need_type.get(int(t))
            if cls is None:
                self.emu.err('%s.Add(%s): тип не подходит этой коллекции' % (self.iface, t))
                return None
            return cls(self.view)
        if self.cls is DrawingTable:
            return DrawingTable(self.view, *a)
        return self.cls(self.view)

    def g_Count(self):
        return len([o for o in self.view.doc.sheet.objs.values() if isinstance(o, self.cls)]) if self.cls else 0


class View(Impl):
    IFACES = ('IView', 'IDrawingContainer', 'ISymbols2DContainer', 'IViewDesignation', 'IDrawingContainer1')
    DEF = dict(Number=0, Scale=1.0, X=0.0, Y=0.0, Angle=0.0, Name='Системный вид', Current=True)

    def __init__(self, doc):
        Impl.__init__(self)
        self.doc = doc
        C = {'LineDimensions': ('ILineDimensions', LineDimension, None), 'Leaders': ('ILeaders', None, {20: Leader, 21: PosLeader}),
             'Roughs': ('IRoughs', Rough, None), 'Tolerances': ('ITolerances', Tolerance, None), 'Bases': ('IBases', Base, None),
             'CutLines': ('ICutLines', CutLine, None), 'ViewPointers': ('IViewPointers', ViewPointer, None),
             'BreakLineDimensions': ('IBreakLineDimensions', BreakLineDimension, None),
             'AngleDimensions': ('IAngleDimensions', None, {10: AngleDimension, 39: AngleDimension}),
             'CentreMarkers': ('ICentreMarkers', CentreMarker, None), 'AxisLines': ('IAxisLines', AxisLine, None),
             'DrawingTables': ('IDrawingTables', DrawingTable, None), 'DrawingTexts': ('IDrawingTexts', DrawingText, None)}
        self.colls = {k: Coll(self, *v) for k, v in C.items()}

    def invoke(self, iface, name, kind, args):
        if kind == 'get' and name in self.colls:
            return self.colls[name]
        return Impl.invoke(self, iface, name, kind, args)


class Views(Impl):
    IFACES = ('IViews',)

    def __init__(self, doc):
        Impl.__init__(self)
        self.doc = doc

    def g_ActiveView(self):
        return self.doc.view

    def g_Count(self):
        return 1

    def m_View(self, i):
        return self.doc.view


class VLM(Impl):
    IFACES = ('IViewsAndLayersManager',)

    def __init__(self, doc):
        Impl.__init__(self)
        self.views = Views(doc)

    def g_Views(self):
        return self.views


class Stamp(Impl):
    IFACES = ('IStamp',)

    def __init__(self, doc):
        Impl.__init__(self)
        self.doc = doc
        self.cells = {}

    def m_Text(self, n):
        n = int(n)
        if n not in self.cells:
            t = Text()
            t.lines = [TextLine()]
            self.cells[n] = t
        return self.cells[n]

    def m_Update(self):
        return True


class LayoutSheet(Impl):
    IFACES = ('ILayoutSheet',)

    def __init__(self, doc):
        Impl.__init__(self)
        self.stamp = Stamp(doc)

    def g_Stamp(self):
        return self.stamp


class LayoutSheets(Impl):
    IFACES = ('ILayoutSheets',)

    def __init__(self, doc):
        Impl.__init__(self)
        self.s = LayoutSheet(doc)

    def m_Item(self, i):
        return self.s

    def g_Count(self):
        return 1


class SpecRough(Impl):
    IFACES = ('ISpecRough',)
    DEF = dict(SignType=0, Text='', AddSign=False, AutoPlacement=True, Distance=0.0)

    def m_Update(self):
        self.p['IsCreated'] = True
        return True

    def g_IsCreated(self):
        return self.p.get('IsCreated', False)


class TechnicalDemand(Impl):
    IFACES = ('ITechnicalDemand',)
    DEF = dict(AutoPlacement=True)

    def g_Text(self):
        return _txt_attr(self, 'Text')

    def s_BlocksGabarits(self, v):
        self.p['BlocksGabarits'] = list(v.value if hasattr(v, 'value') else v)

    def m_Update(self):
        self.p['IsCreated'] = bool(_txt_attr(self, 'Text').strs())
        return True

    def g_IsCreated(self):
        return self.p.get('IsCreated', False)


# ---------------------------------------------------------------- лист: всё нарисованное
class Sheet:
    FMT = {0: (1189, 841), 1: (841, 594), 2: (594, 420), 3: (420, 297), 4: (297, 210)}

    def __init__(self, fmt, mult, landscape):
        a, b = self.FMT.get(int(fmt), (841, 594))
        if mult and int(mult) > 1:
            a = b * int(mult) if int(fmt) >= 3 else a
        self.fmt = fmt
        self.W, self.H = (max(a, b), min(a, b)) if (landscape and int(fmt) != 4) else (min(a, b), max(a, b))
        self.prims = {}      # ref -> [примитивы] (API5)
        self.objs = {}       # ref -> объект API7
        self.next = 1

    def new_ref(self, o=None):
        r = self.next
        self.next += 1
        if o is not None:
            self.objs[r] = o
        return r

    def drop(self, ref):
        self.objs.pop(ref, None)
        self.prims.pop(ref, None)

    def all_prims(self):
        for r, ps in self.prims.items():
            for q in ps:
                yield r, 'api5', q
        for r, o in self.objs.items():
            for q in o.prims:
                yield r, type(o).__name__, q


class Doc7(Impl):
    IFACES = ('IKompasDocument', 'IKompasDocument1', 'IKompasDocument2D', 'IKompasDocument2D1', 'IDrawingDocument')

    def __init__(self, sheet, d5):
        Impl.__init__(self)
        self.sheet, self.d5 = sheet, d5
        self.view = View(self)
        self.vlm = VLM(self)
        self.ls = LayoutSheets(self)
        self.sr = SpecRough()
        self.td = TechnicalDemand()
        self.p.update(Name='', PathName='', Visible=True)

    def g_ViewsAndLayersManager(self):
        return self.vlm

    def g_LayoutSheets(self):
        return self.ls

    def g_SpecRough(self):
        return self.sr

    def g_TechnicalDemand(self):
        return self.td

    def m_Close(self, mode=0):
        EMU.close(self)
        return True


class Doc5(Impl):
    IFACES = ('ksDocument2D',)
    DYN = 'ksDocument2D'

    def __init__(self):
        Impl.__init__(self)
        self.sheet = None
        self.d7 = None
        self.hatch = None

    def m_ksCreateDocument(self, par):
        lay = par.sub.get('layout')
        sp = lay.sub.get('sheet') if lay else None
        f = sp.p.get('format', 1) if sp else 1
        self.sheet = Sheet(f, sp.p.get('multiply', 1) if sp else 1, sp.p.get('direct', True) if sp else True)
        self.d7 = Doc7(self.sheet, self)
        EMU.open(self.d7)
        return True

    def _need(self):
        if self.sheet is None:
            self.emu.err('ksDocument2D: вызов до ksCreateDocument')
            return False
        return True

    def _add(self, prims):
        if not self._need():
            return 0
        if self.hatch is not None:
            self.hatch['segs'] += [q for q in prims if q[0] == 'L']
            return 1
        r = self.sheet.new_ref()
        self.sheet.prims[r] = prims
        return r

    def m_ksLineSeg(self, x1, y1, x2, y2, st):
        return self._add([L(x1, y1, x2, y2, int(st))])

    def m_ksCircle(self, x, y, r, st):
        if r <= 0:
            return 0
        return self._add([('C', float(x), float(y), float(r), int(st))])

    def m_ksArcByAngle(self, x, y, r, a1, a2, d, st):
        return self._add([('A', float(x), float(y), float(r), float(a1), float(a2), int(st))])

    def m_ksText(self, x, y, ang, h, ksu, bits, s):
        return self._add([T(x, y, s, h, ang)])

    def m_ksGetTextLengthFromReference(self, ref):
        ps = self.sheet.prims.get(int(ref)) if self.sheet else None
        if not ps or ps[0][0] != 'T':
            return 0.0
        return ps[0][6]

    def m_ksHatch(self, style, ang, step, width, x0, y0):
        if not self._need():
            return 0
        self.hatch = dict(ang=ang, step=step, segs=[])
        return 1

    def m_ksEndObj(self):
        h, self.hatch = self.hatch, None
        if h is None:
            self.emu.err('ksEndObj без начатого объекта')
            return 0
        deg = {}
        for q in h['segs']:
            for p in ((round(q[1], 3), round(q[2], 3)), (round(q[3], 3), round(q[4], 3))):
                deg[p] = deg.get(p, 0) + 1
        bad = [p for p, n in deg.items() if n % 2]
        if not h['segs'] or bad:
            # контур не замкнут — КОМПАС не создаёт штриховку (ksEndObj = 0)
            self.emu.note('штриховка: контур не замкнут (%d концов без пары, например %s)' % (len(bad), bad[:2]))
            return 0
        r = self.sheet.new_ref()
        self.sheet.prims[r] = [('H', h['segs'], h['ang'], h['step'])]
        return r

    def m_ksGetObjGabaritRect(self, ref, rect):
        if not self.sheet:
            return False
        ref = int(ref)
        if ref in self.sheet.objs:
            b = self.sheet.objs[ref].box()
        elif ref in self.sheet.prims:
            b = union(prim_box(q) for q in self.sheet.prims[ref] if q[0] != 'H')
        else:
            return False
        if not b:
            return False
        rect.sub['pBot'].p.update(x=b[0], y=b[1])
        rect.sub['pTop'].p.update(x=b[2], y=b[3])
        return True

    def m_ksSaveDocument(self, path):
        if not self._need():
            return False
        EMU.save(self.d7, path)
        return True

    def m_ksCloseDocument(self):
        if self.d7:
            EMU.close(self.d7)
        return True

    def m_ksSaveToDXF(self, path):
        return True

    def m_ksCreateSheetView(self, par, num):
        return 1


class Struct(Impl):
    """Структуры параметров API5 (GetParamStruct): поля — по gen_py, вложенные структуры — Get…()."""

    def __init__(self, cls, fields=None, subs=None):
        Impl.__init__(self)
        self.DYN = cls
        self.IFACES = (cls,)
        self.p.update(fields or {})
        self.sub = subs or {}

    def invoke(self, iface, name, kind, args):
        if kind == 'call' and name == 'Init':
            return True
        if kind == 'call' and name.startswith('Get') and name[3:] in self.sub:
            return self.sub[name[3:]]
        if kind == 'call' and name == 'GetLayoutParam':
            return self.sub['layout']
        if kind == 'call' and name == 'GetSheetParam':
            return self.sub['sheet']
        if kind == 'get' and name not in self.p:
            return 0
        return Impl.invoke(self, iface, name, kind, args)


def make_struct(code):
    if code == 35:
        sheet = Struct('ksStandartSheet', dict(format=1, multiply=1, direct=True))
        lay = Struct('ksSheetPar', dict(layoutName='', shtType=1), dict(sheet=sheet))
        return Struct('ksDocumentParam', dict(fileName='', comment='', author='', type=1, regime=0), dict(layout=lay))
    if code == 15:
        return Struct('ksRectParam', {}, dict(pBot=Struct('ksMathPointParam', dict(x=0.0, y=0.0)), pTop=Struct('ksMathPointParam', dict(x=0.0, y=0.0))))
    if code == 8:
        return Struct('ksViewParam')
    return None


class KO(Impl):
    IFACES = ('KompasObject',)
    DYN = 'KompasObject'

    def m_Document2D(self):
        return Doc5()

    def m_GetParamStruct(self, code):
        s = make_struct(int(code))
        if s is None:
            self.emu.gap('KompasObject', None, 'GetParamStruct(%s)' % code, 'call')
        return s

    def m_ksGetSystemVersion(self, *a):
        return (1, 25, 0, 0, 0)

    def m_ksMessage(self, *a):
        return True


class App(Impl):
    IFACES = ('IApplication', 'IApplication1')
    DEF = dict(Visible=True, HideMessage=0)

    def g_ActiveDocument(self):
        return EMU.active

    def g_hWnd(self):
        return 0

    def m_ApplicationName(self, full):
        return 'КОМПАС-3D v25 (эмулятор)'


# ---------------------------------------------------------------- состояние эмулятора
class Emu:
    def __init__(self, out):
        self.out = out
        self.notes = []          # (вид, текст)
        self.saved = []          # (путь, документ)
        self.docs = []
        self.active = None
        self.ko = KO()
        self.app = App()
        self.ko.emu = self.app.emu = self

    def progid(self, name):
        if name.endswith('.5'):
            return self.ko
        return self.app

    def _n(self, kind, s):
        if (kind, s) not in [(k, t) for k, t in self.notes[-200:]]:
            self.notes.append((kind, s))

    def err(self, s):
        self._n('ошибка КОМПАС', s)

    def note(self, s):
        self._n('замечание', s)

    def gap(self, cls, iface, name, kind):
        self._n('нет в эмуляторе', '%s.%s (%s)' % (iface or cls, name, kind))

    def note_attr(self, cls, name, kind):
        self._n('ошибка КОМПАС', 'у %s нет свойства/метода %s' % (cls, name))

    def note_err(self, s):
        self._n('ошибка КОМПАС', s)

    def note_qi(self, cls, name):
        self._n('нет интерфейса', '%s → %s' % (cls, name))

    def open(self, d):
        self.docs.append(d)
        self.active = d

    def close(self, d):
        if d in self.docs:
            self.docs.remove(d)
        self.active = self.docs[-1] if self.docs else None

    def save(self, d, path):
        self.saved.append((path, d))
        try:
            import render
            render.save(d.sheet, path)
        except Exception as e:
            self.note('рисунок листа не сохранён: %s' % e)
