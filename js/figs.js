/* figs.js — SVG-рисунки: кинематические схемы, график нагрузки, расчётные схемы валов и эпюры, эскизы валов */
(function (root) {
  'use strict';
  const F = root.F;
  const fnum = (x, s) => F.fnum(x, s);
  const esc = t => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const svg = (w, h, body, cls) => `<svg class="fg ${cls || ''}" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg" role="img">${body}</svg>`;
  const tip = (t, d) => ` data-tip="${esc(t)}|${esc(d || '')}" tabindex="0"`;
  // стили для экспорта (чёрно-белые, Times New Roman)
  const EXPORT_STYLE = '<style>.ln{fill:none;stroke:#000;stroke-width:1.4}.th{fill:none;stroke:#000;stroke-width:.8}.ax{fill:none;stroke:#000;stroke-width:.7;stroke-dasharray:14 3 2 3}.dsh{fill:none;stroke:#000;stroke-width:1;stroke-dasharray:5 3}.bx{fill:#fff;stroke:#000;stroke-width:1.4}.bx2{fill:#fff;stroke:#000;stroke-width:1}.hat{fill:url(#hat);stroke:#000;stroke-width:1}.epx{fill:url(#hatx);stroke:#000;stroke-width:1.2}.epy{fill:url(#hatx);stroke:#000;stroke-width:1.2}.ept{fill:url(#hatx);stroke:#000;stroke-width:1.2}.frc{stroke:#000;stroke-width:1.6;fill:none}.ah{fill:#000}.t{font:13px "Times New Roman",serif;fill:#000}.ti{font:italic 13px "Times New Roman",serif;fill:#000}.ts{font:11px "Times New Roman",serif;fill:#000}.tb{font:bold 13px "Times New Roman",serif;fill:#000}.pos{font:13px "Times New Roman",serif;fill:#000}.sup{fill:#fff;stroke:#000;stroke-width:1.2}.gr{fill:none;stroke:#000;stroke-width:.5}.hl{fill:none}.dim{fill:none;stroke:#000;stroke-width:.6}</style>';
  const DEFS = '<defs><pattern id="hat" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="6" class="th"/></pattern><pattern id="hatx" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(90)"><line x1="0" y1="0" x2="0" y2="7" class="th"/></pattern><marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 1 L10 5 L0 9z" class="ah"/></marker><marker id="dar" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 2 L10 5 L0 8z" class="ah"/></marker></defs>';
  const L = (x1, y1, x2, y2, c) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="${c || 'ln'}"/>`;
  const R_ = (x, y, w, h, c, extra) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" class="${c || 'bx'}"${extra || ''}/>`;
  const T = (x, y, t, c, a) => `<text x="${x}" y="${y}" class="${c || 't'}"${a ? ` text-anchor="${a}"` : ''}>${t}</text>`;
  const pos = (x, y, x2, y2, n) => L(x, y, x2, y2, 'th') + `<circle cx="${x2}" cy="${y2}" r="1.6" class="ah"/>` + T(x + (x < x2 ? -4 : 4), y - 3, n, 'pos', x < x2 ? 'end' : 'start');
  /* элементы кинематических схем (ГОСТ 2.770) */
  const gearV = (x, y, w, h) => R_(x - w / 2, y - h / 2, w, h, 'bx2') + L(x - w / 2, y - h / 2, x + w / 2, y + h / 2, 'th') + L(x + w / 2, y - h / 2, x - w / 2, y + h / 2, 'th');   // зубчатое колесо (вид вдоль оси) — прямоугольник с ×
  const brgV = (x, y) => `<path d="M${x - 5} ${y - 5} h10 v10 h-10z M${x - 5} ${y - 5} l10 10" class="th"/>`;  // подшипник
  function couplingV(x, y, h) { return `<path d="M${x - 8} ${y - h / 2} v${h} M${x - 8} ${y - h / 2} h4 M${x - 8} ${y + h / 2} h4 M${x + 8} ${y - h / 2} v${h} M${x + 8} ${y - h / 2} h-4 M${x + 8} ${y + h / 2} h-4" class="ln"/>`; }

  /* ---------- кинематические схемы ---------- */
  function scheme(task) {
    let b = DEFS;
    if (task === 3) {
      const W = 720, H = 360;
      // рама
      b += `<g${tip('5 — рама', 'Сварная рама из швеллеров: на ней крепятся электродвигатель и редуктор')}>${R_(30, 300, 470, 14, 'hat')}</g>`;
      // двигатель
      b += `<g${tip('1 — электродвигатель', 'Асинхронный двигатель АИР; вал соединён с валом червяка муфтой')}>${R_(50, 185, 110, 70)}${L(60, 255, 60, 300)}${L(150, 255, 150, 300)}${L(160, 220, 205, 220)}</g>`;
      b += `<g${tip('4 — муфта', 'Упругая втулочно-пальцевая муфта МУВП по ГОСТ 21424-93')}>${couplingV(215, 220, 34)}</g>`;
      // редуктор: корпус, червяк (вал I), колесо (вал II)
      b += `<g${tip('2 — червячный редуктор', 'Корпус с червяком (вал I) и червячным колесом (вал II); вал колеса выходит из корпуса, на нём ведущая звёздочка')}>${R_(250, 120, 190, 180, 'bx2')}`;
      b += L(223, 220, 470, 220) + brgV(262, 220) + brgV(428, 220);
      b += `<path d="M300 205 h90 v30 h-90z" class="bx2"/><path d="M305 205 l10 30 M320 205 l10 30 M335 205 l10 30 M350 205 l10 30 M365 205 l10 30" class="th"/>`;
      b += `<circle cx="345" cy="155" r="50" class="th"/>${L(345, 70, 345, 105, 'ax')}` + `<circle cx="345" cy="155" r="3" class="ah"/></g>`;
      b += T(345, 112, 'II', 'ti', 'middle') + T(470, 214, 'I', 'ti', 'end');
      // цепная передача
      b += `<g${tip('3 — цепная передача', 'Роликовая цепь ПР по ГОСТ 13568-75; ведущая звёздочка — на валу колеса (II), ведомая — на валу зажима (III)')}><circle cx="345" cy="155" r="22" class="ln"/><circle cx="600" cy="120" r="44" class="ln"/>`;
      b += `<path d="M${345 - 22 * 0.2} ${155 - 22 * 0.98} L${600 - 44 * 0.2} ${120 - 44 * 0.98} M${345 + 22 * 0.15} ${155 + 22 * 0.99} L${600 + 44 * 0.15} ${120 + 44 * 0.99}" class="dsh"/></g>`;
      b += `<g${tip('6 — ведущий зажим кантователя', 'Исполнительный орган: поворачивает свариваемое изделие (вал III)')}><path d="M600 120 l70 -40 l14 24 l-70 40z" class="hat"/>${L(600, 175, 600, 300, 'ln')}${R_(570, 290, 60, 14, 'hat')}<circle cx="600" cy="120" r="4" class="ah"/></g>`;
      b += T(600, 196, 'III', 'ti', 'middle') + T(658, 90, 'P<tspan baseline-shift="sub" font-size="9">вых</tspan>, n<tspan baseline-shift="sub" font-size="9">вых</tspan>', 'ti');
      b += pos(90, 165, 105, 190, '1') + pos(345, 30, 345, 120, '2') + pos(470, 60, 470, 115, '3') + pos(215, 175, 215, 205, '4') + pos(115, 335, 115, 312, '5') + pos(700, 60, 668, 88, '6');
      return svg(W, H, b, 'scheme');
    }
    if (task === 1) {
      const W = 720, H = 360;
      b += `<g${tip('3 — рама (плита)', 'Плита, на которой установлены электродвигатель и редуктор')}>${R_(30, 290, 520, 14, 'hat')}</g>`;
      b += `<g${tip('1 — электродвигатель', 'Асинхронный двигатель АИР')}>${R_(50, 160, 110, 70)}${L(60, 230, 60, 290)}${L(150, 230, 150, 290)}${L(160, 195, 205, 195)}</g>`;
      b += `<g${tip('4 — муфта', 'МУВП по ГОСТ 21424-93 соединяет вал двигателя с валом конической шестерни')}>${couplingV(215, 195, 34)}</g>`;
      b += `<g${tip('2 — коническо-цилиндрический редуктор', 'Быстроходная ступень — коническая прямозубая, тихоходная — цилиндрическая прямозубая; тихоходный вал вертикальный')}>${R_(250, 90, 280, 190, 'bx2')}`;
      // вал I горизонтальный с конической шестерней
      b += L(223, 195, 350, 195) + brgV(268, 195) + brgV(312, 195) + `<path d="M330 180 L352 186 L352 204 L330 210z" class="bx2"/>`;
      // вал II вертикальный: коническое колесо + цилиндрическая шестерня
      b += L(370, 105, 370, 265) + brgV(370, 112) + brgV(370, 258) + `<path d="M352 176 L388 176 L382 190 L358 190z" class="bx2"/>` + gearV(370, 228, 36, 18);
      // вал III вертикальный: колесо
      b += L(460, 105, 460, 335) + brgV(460, 112) + brgV(460, 258) + gearV(460, 228, 100, 18) + '</g>';
      b += T(240, 188, 'I', 'ti', 'end') + T(378, 125, 'II', 'ti') + T(468, 125, 'III', 'ti');
      b += `<g${tip('5 — ведущая звёздочка конвейера', 'Установлена на тихоходном (вертикальном) валу редуктора; приводит тяговую цепь подвесного конвейера')}>${R_(405, 318, 110, 10, 'bx2')}<path d="M395 323 h-60 M525 323 h60" class="dsh"/></g>`;
      b += T(590, 318, 'P<tspan baseline-shift="sub" font-size="9">вых</tspan>, n<tspan baseline-shift="sub" font-size="9">вых</tspan>', 'ti');
      b += pos(90, 140, 105, 165, '1') + pos(390, 50, 390, 92, '2') + pos(120, 330, 120, 302, '3') + pos(215, 150, 215, 180, '4') + pos(560, 345, 512, 326, '5');
      return svg(W, H, b, 'scheme');
    }
    // задание 6
    const W = 720, H = 400;
    b += `<g${tip('4 — рама (плита)', 'Плита под электродвигатель и редуктор')}>${R_(30, 352, 430, 14, 'hat')}</g>`;
    b += `<g${tip('1 — электродвигатель', 'Асинхронный двигатель АИР')}>${R_(40, 250, 110, 70)}${L(50, 320, 50, 352)}${L(140, 320, 140, 352)}${L(150, 285, 190, 285)}</g>`;
    b += `<g${tip('5 — муфта', 'МУВП соединяет вал двигателя с быстроходным валом редуктора')}>${couplingV(200, 285, 34)}</g>`;
    b += `<g${tip('2 — двухступенчатый цилиндрический редуктор', 'Развёрнутая схема: быстроходная (z1/z2) и тихоходная (z3/z4) прямозубые ступени, валы I, II, III')}>${R_(225, 90, 210, 240, 'bx2')}`;
    // валы (вертикальные на схеме — вид сверху на развёрнутую схему)
    b += L(208, 285, 420, 285) + brgV(240, 285) + brgV(420, 285) + gearV(285, 285, 18, 40);
    b += L(240, 210, 420, 210) + brgV(240, 210) + brgV(420, 210) + gearV(285, 210, 18, 90) + gearV(370, 210, 22, 36);
    b += L(240, 120, 480, 120) + brgV(240, 120) + brgV(420, 120) + gearV(370, 120, 22, 120) + '</g>';
    b += T(430, 300, 'I', 'ti') + T(430, 225, 'II', 'ti') + T(478, 112, 'III', 'ti', 'end');
    b += `<g${tip('3 — цепная передача', 'Роликовая цепь ПР: ведущая звёздочка на валу III, ведомая — на валу барабана IV')}>${R_(470, 105, 10, 30, 'bx2')}${R_(470, 30, 10, 40, 'bx2')}<path d="M475 105 V70" class="dsh"/></g>`;
    b += `<g${tip('6 — вал конвейера с барабаном', 'Вал IV на двух подшипниковых опорах; барабан приводит ленту конвейера')}>${L(475, 50, 690, 50)}${brgV(500, 50)}${brgV(680, 50)}${R_(540, 25, 110, 50, 'bx2')}</g>`;
    b += T(690, 44, 'IV', 'ti', 'end') + T(595, 18, 'P<tspan baseline-shift="sub" font-size="9">вых</tspan>, n<tspan baseline-shift="sub" font-size="9">вых</tspan>', 'ti', 'middle');
    b += pos(70, 230, 90, 255, '1') + pos(330, 60, 330, 92, '2') + pos(540, 150, 478, 90, '3') + pos(90, 385, 90, 364, '4') + pos(200, 240, 200, 270, '5') + pos(620, 110, 600, 75, '6');
    return svg(W, H, b, 'scheme');
  }

  /* ---------- график нагрузки ---------- */
  function load(ld) {
    const W = 520, H = 260, x0 = 60, y0 = 220, w = 420, h = 170;
    let b = DEFS + L(x0, y0, x0 + w + 20, y0, 'ln') + L(x0, y0, x0, y0 - h - 20, 'ln');
    b += `<path d="M${x0 + w + 20} ${y0} l-8 -3 v6z" class="ah"/><path d="M${x0} ${y0 - h - 20} l-3 8 h6z" class="ah"/>`;
    b += T(x0 + w + 18, y0 + 16, 't', 'ti', 'end') + T(x0 - 8, y0 - h - 14, 'T', 'ti', 'end');
    let x = x0, path = `M${x0} ${y0}`;
    ld.forEach(([k, t], i) => {
      const xw = t * w, yy = y0 - k * h;
      path += ` L${x} ${yy} L${x + xw} ${yy}`;
      b += L(x + xw, yy, x + xw, y0, 'dsh');
      b += T(x + xw / 2, yy - 6, (k === 1 ? '' : fnum(k, 0)) + 'T', 'ti', 'middle');
      b += T(x + xw / 2, y0 + 16, fnum(t, 0) + 't<tspan baseline-shift="sub" font-size="9">Σ</tspan>', 'ti', 'middle');
      x += xw;
    });
    path += ` L${x} ${y0}`;
    b += `<path d="${path}" class="ln"/>`;
    return svg(W, H, b, 'load');
  }

  /* ---------- расчётная схема вала и эпюры ---------- */
  function beam(B, o) {
    // o: { names: {id: 'подпись'}, T (Н·м), Tx: [x0, x1] участок кручения, title }
    o = o || {};
    const xs = [0, B.l].concat(B.loads.map(L => L.x));
    const xmin = Math.min(...xs), xmax = Math.max(...xs), span = xmax - xmin || 1;
    const W = 760, padL = 70, padR = 40, sx = (W - padL - padR) / span, X = x => padL + (x - xmin) * sx;
    let b = DEFS, y = 30;
    // схема вала
    const ys = y + 40;
    b += L(X(xmin) - 10, ys, X(xmax) + 10, ys, 'ln');
    const sup = (x, lab) => `<path d="M${X(x)} ${ys + 2} l-9 16 h18z" class="sup"/>${L(X(x) - 14, ys + 22, X(x) + 14, ys + 22, 'th')}` + T(X(x), ys + 38, lab, 'tb', 'middle');
    b += sup(0, 'A') + sup(B.l, 'B');
    for (const ld of B.loads) {
      const xx = X(ld.x);
      b += `<circle cx="${xx}" cy="${ys}" r="2.5" class="ah"/>` + T(xx, ys + 38, ld.id, 'tb', 'middle');
      if (o.names && o.names[ld.id]) b += T(xx, y - 6, o.names[ld.id], 'ts', 'middle');
    }
    y = ys + 56;
    // эпюры
    const ep = (pl, title, cls) => {
      const pts = B.diag(pl).filter(p => p[0] >= xmin - 1e-9 && p[0] <= xmax + 1e-9);
      const vmax = Math.max(1e-9, ...pts.map(p => Math.abs(p[1])));
      if (vmax < 1e-6) return { h: 0, s: '' };
      const hh = 70, yc = y + hh / 2 + 10, k = (hh / 2) / vmax;
      let s = T(14, yc + 4, title, 'ti');
      let d = `M${X(xmin)} ${yc}`;
      const sorted = [[xmin, 0]].concat(pts).concat([[xmax, 0]]);
      for (const [px, pv] of sorted) d += ` L${X(px)} ${yc - pv * k}`;
      d += ` L${X(xmax)} ${yc} Z`;
      s += `<path d="${d}" class="${cls}"/>` + L(X(xmin), yc, X(xmax), yc, 'ln');
      // подписи значений в характерных точках
      const seen = new Set();
      for (const [px, pv] of pts) {
        if (Math.abs(pv) < vmax * 0.02) continue;
        const key = Math.round(px) + '|' + Math.round(pv / vmax * 50);
        if (seen.has(key)) continue; seen.add(key);
        s += T(X(px) + 3, yc - pv * k + (pv > 0 ? -4 : 13), fnum(Math.abs(pv) / 1e3, 3), 'ts');
      }
      y = yc + hh / 2 + 18;
      return { s };
    };
    const ex = ep('x', 'M', 'epx'); b += ex.s ? ex.s.replace('>M<', '>M<tspan baseline-shift="sub" font-size="9">x</tspan>, Н·м<') : '';
    const ey = ep('y', 'M', 'epy'); b += ey.s ? ey.s.replace('>M<', '>M<tspan baseline-shift="sub" font-size="9">y</tspan>, Н·м<') : '';
    if (o.T && o.Tx) {
      const hh = 26, yc = y + hh + 6, x1 = Math.max(xmin, Math.min(o.Tx[0], o.Tx[1])), x2 = Math.min(xmax, Math.max(o.Tx[0], o.Tx[1]));
      b += T(14, yc - 6, 'T, Н·м', 'ti') + `<path d="M${X(x1)} ${yc} V${yc - hh} H${X(x2)} V${yc}Z" class="ept"/>` + L(X(xmin), yc, X(xmax), yc, 'ln') + T((X(x1) + X(x2)) / 2, yc - hh - 4, fnum(o.T, 3), 'ts', 'middle');
      y = yc + 14;
    }
    return svg(W, Math.ceil(y + 6), b, 'beam');
  }

  /* ---------- эскизы валов (ступенчатые профили) ---------- */
  function shafts(sh, title) {
    const keys = Object.keys(sh || {});
    if (!keys.length) return '';
    const W = 760, padL = 70;
    const len = s => s.reduce((a, x) => a + x.l, 0);
    const Lmax = Math.max(...keys.map(k => len(sh[k])));
    const dmax = Math.max(...keys.map(k => Math.max(...sh[k].map(x => x.d))));
    const sx = (W - padL - 30) / Lmax, sy = Math.min(sx, 90 / dmax);
    let b = DEFS, y = 16;
    for (const k of keys) {
      const segs = sh[k], hmax = Math.max(...segs.map(x => x.d)) * sy;
      const yc = y + hmax / 2 + 6;
      b += T(10, yc + 4, 'Вал ' + k, 'tb');
      let x = padL, d = '';
      b += L(padL - 8, yc, padL + len(segs) * sx + 8, yc, 'ax');
      for (const s of segs) {
        const w = s.l * sx, h = s.d * sy;
        b += `<rect x="${x}" y="${yc - h / 2}" width="${w}" height="${h}" class="${s.gear ? 'hat' : 'bx2'}"${tip(s.name, '⌀' + fnum(s.d, 4) + ' × ' + fnum(s.l, 4) + ' мм' + (s.keyDim ? '; шпонка ' + s.keyDim.b + '×' + s.keyDim.h + '×' + s.keyDim.l : ''))}/>`;
        if (s.keyDim) b += `<rect x="${x + (w - s.keyDim.l * sx) / 2}" y="${yc - h / 2}" width="${s.keyDim.l * sx}" height="${Math.max(2, s.keyDim.t1 * sy)}" class="bx" rx="${Math.max(1, s.keyDim.b * sy / 2)}"/>`;
        if (w > 22) b += T(x + w / 2, yc + h / 2 + 12, fnum(s.d, 4), 'ts', 'middle');
        x += w;
      }
      b += T(padL + len(segs) * sx / 2, y + 2, '', 'ts');
      // общая длина
      const yd = yc + hmax / 2 + 22;
      b += `<line x1="${padL}" y1="${yd}" x2="${padL + len(segs) * sx}" y2="${yd}" class="dim" marker-start="url(#dar)" marker-end="url(#dar)"/>` + T(padL + len(segs) * sx / 2, yd - 3, fnum(len(segs), 4), 'ts', 'middle');
      y = yd + 16;
    }
    return svg(W, Math.ceil(y), b, 'shafts');
  }

  root.FIGS = { scheme, load, beam, shafts, EXPORT_STYLE, DEFS };
})(typeof window !== 'undefined' ? window : globalThis);
