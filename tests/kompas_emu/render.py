# -*- coding: utf-8 -*-
"""Рисунок листа эмулятора (PNG) и проверка наложений надписей."""
import math, os
from model import prim_box

PX = 3.0   # пикселей на мм
FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'


def _font(h):
    from PIL import ImageFont
    try:
        return ImageFont.truetype(FONT, max(6, int(h * PX * 1.25)))
    except Exception:
        return ImageFont.load_default()


def save(sheet, path):
    from PIL import Image, ImageDraw
    W, H = sheet.W, sheet.H
    im = Image.new('RGB', (int(W * PX) + 1, int(H * PX) + 1), 'white')
    dr = ImageDraw.Draw(im)
    X = lambda x: x * PX
    Y = lambda y: (H - y) * PX
    # рамка и основная надпись (как у КОМПАС: поле 20/5 мм, надпись 185×55)
    dr.rectangle([X(20), Y(H - 5), X(W - 5), Y(5)], outline='black', width=2)
    dr.rectangle([X(W - 190), Y(60), X(W - 5), Y(5)], outline='black', width=1)
    for ref, owner, q in sheet.all_prims():
        col = (0, 0, 0) if owner == 'api5' else (20, 70, 200)
        t = q[0]
        if t == 'L':
            st = q[5]
            wd = 2 if st == 1 else 1
            if st == 3:
                col = (150, 30, 30)
            dr.line([X(q[1]), Y(q[2]), X(q[3]), Y(q[4])], fill=col, width=wd)
        elif t == 'C':
            dr.ellipse([X(q[1] - q[3]), Y(q[2] + q[3]), X(q[1] + q[3]), Y(q[2] - q[3])], outline=col, width=2 if q[4] == 1 else 1)
        elif t == 'A':
            a1, a2 = q[4], q[5]
            dr.arc([X(q[1] - q[3]), Y(q[2] + q[3]), X(q[1] + q[3]), Y(q[2] - q[3])], -a2, -a1, fill=col, width=1)
        elif t == 'H':
            for s in q[1]:
                dr.line([X(s[1]), Y(s[2]), X(s[3]), Y(s[4])], fill=(120, 120, 120), width=1)
        elif t == 'T':
            _text(im, q, X, Y, col)
    os.makedirs(os.path.dirname(os.path.abspath(path)) or '.', exist_ok=True)
    im.save(os.path.splitext(path)[0] + '.png')


def _text(im, q, X, Y, col):
    from PIL import Image, ImageDraw
    x, y, s, h, ang, w = q[1:7]
    if not s:
        return
    f = _font(h)
    tw_, th = int(max(w, 1) * PX) + 2, int(h * PX * 1.6) + 2
    t = Image.new('RGBA', (tw_, th), (255, 255, 255, 0))
    ImageDraw.Draw(t).text((0, 0), s, font=f, fill=col + (255,))
    if abs(ang) > 0.1:
        t = t.rotate(ang, expand=True, resample=Image.BICUBIC)
    b = prim_box(q)
    im.paste(t, (int(X(b[0])), int(Y(b[3]))), t)


def text_boxes(sheet):
    out = []
    for ref, owner, q in sheet.all_prims():
        if q[0] == 'T' and q[3].strip():
            out.append((ref, owner, q[3], prim_box(q)))
    return out


def overlaps(sheet, min_area=1.0):
    """Наложения надписей разных объектов: площадь пересечения рамок больше min_area мм²."""
    bx = text_boxes(sheet)
    res = []
    for i in range(len(bx)):
        r1, o1, s1, a = bx[i]
        for j in range(i + 1, len(bx)):
            r2, o2, s2, b = bx[j]
            if r1 == r2:
                continue
            ix = min(a[2], b[2]) - max(a[0], b[0])
            iy = min(a[3], b[3]) - max(a[1], b[1])
            if ix > 0 and iy > 0 and ix * iy > min_area:
                res.append((s1, o1, s2, o2, round(ix * iy, 1), tuple(round(v, 1) for v in a)))
    return res
