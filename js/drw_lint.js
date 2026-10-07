/* drw_lint.js — автоматическая проверка листов чертежей на соответствие правилам ЕСКД (ГОСТ 2.303, 2.304, 2.307, 2.309, 2.316):
 * обозначения привязаны к изображению детали, надписи не пересекаются линиями и друг другом, у окружностей есть центровые линии,
 * размерные и выносные линии не накладываются на контур, ничего не выходит за рамку и не заходит в основную надпись. */
(function (root) {
  'use strict';
  const D2R = Math.PI / 180;
  const KIND = { dimH: 'размер', dimV: 'размер', dimAng: 'угловой размер', leader: 'выноска', rough: 'знак шероховатости', roughLeader: 'шероховатость на выноске', tol: 'допуск формы/расположения', datum: 'обозначение базы', cutV: 'линия сечения', viewArrow: 'стрелка вида', roughCorner: 'шероховатость остальных поверхностей' };

  function distSeg(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1, L2 = dx * dx + dy * dy;
    let t = L2 ? ((px - x1) * dx + (py - y1) * dy) / L2 : 0; t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - x1 - t * dx, py - y1 - t * dy);
  }
  function angIn(a, a1, a2) { a = ((a % 360) + 360) % 360; a1 = ((a1 % 360) + 360) % 360; a2 = ((a2 % 360) + 360) % 360; return a1 <= a2 ? a >= a1 - 0.5 && a <= a2 + 0.5 : a >= a1 - 0.5 || a <= a2 + 0.5; }
  function distPrim(px, py, q) {
    if (q.t === 'L') return distSeg(px, py, q.a[0], q.a[1], q.a[2], q.a[3]);
    if (q.t === 'C') return Math.abs(Math.hypot(px - q.a[0], py - q.a[1]) - q.a[2]);
    if (q.t === 'A') { const ang = Math.atan2(py - q.a[1], px - q.a[0]) / D2R; if (angIn(ang, q.a[3], q.a[4])) return Math.abs(Math.hypot(px - q.a[0], py - q.a[1]) - q.a[2]); const e = a => [q.a[0] + q.a[2] * Math.cos(a * D2R), q.a[1] + q.a[2] * Math.sin(a * D2R)]; const p1 = e(q.a[3]), p2 = e(q.a[4]); return Math.min(Math.hypot(px - p1[0], py - p1[1]), Math.hypot(px - p2[0], py - p2[1])); }
    if (q.t === 'H') { let d = Infinity; for (let i = 0; i + 3 < q.l.length; i += 4) d = Math.min(d, distSeg(px, py, q.l[i], q.l[i + 1], q.l[i + 2], q.l[i + 3])); return d; }
    return Infinity;
  }
  function textRect(q, k, pad) {
    const [x, y, h, ang] = q.a, w = q.w * (k || 1), c = Math.cos(ang * D2R), s = Math.sin(ang * D2R);
    const xs = [x, x + w * c, x - h * s + w * c, x - h * s], ys = [y, y + w * s, y + h * c + w * s, y + h * c];
    return { x1: Math.min(...xs) + pad, y1: Math.min(...ys) + pad, x2: Math.max(...xs) - pad, y2: Math.max(...ys) - pad };
  }
  function segHitsRect(x1, y1, x2, y2, r) {
    if (Math.max(x1, x2) < r.x1 || Math.min(x1, x2) > r.x2 || Math.max(y1, y2) < r.y1 || Math.min(y1, y2) > r.y2) return false;
    let t0 = 0, t1 = 1; const dx = x2 - x1, dy = y2 - y1;
    const P = [-dx, dx, -dy, dy], Q = [x1 - r.x1, r.x2 - x1, y1 - r.y1, r.y2 - y1];
    for (let i = 0; i < 4; i++) { if (Math.abs(P[i]) < 1e-12) { if (Q[i] < 0) return false; } else { const t = Q[i] / P[i]; if (P[i] < 0) { if (t > t1) return false; if (t > t0) t0 = t; } else { if (t < t0) return false; if (t < t1) t1 = t; } } }
    return t0 <= t1;
  }
  function circHitsRect(q, r) {
    const [cx, cy, R] = q.a;
    const dmin = Math.hypot(Math.max(r.x1 - cx, 0, cx - r.x2), Math.max(r.y1 - cy, 0, cy - r.y2));
    const dmax = Math.max(Math.hypot(r.x1 - cx, r.y1 - cy), Math.hypot(r.x2 - cx, r.y1 - cy), Math.hypot(r.x1 - cx, r.y2 - cy), Math.hypot(r.x2 - cx, r.y2 - cy));
    if (!(dmin <= R && dmax >= R)) return false;
    if (q.t === 'C') return true;
    for (let i = 0; i <= 24; i++) { const a = q.a[3] + ((((q.a[4] - q.a[3]) % 360) + 360) % 360 || 360) * i / 24, px = cx + R * Math.cos(a * D2R), py = cy + R * Math.sin(a * D2R); if (px >= r.x1 && px <= r.x2 && py >= r.y1 && py <= r.y2) return true; }
    return false;
  }
  const rectsHit = (a, b) => a.x1 < b.x2 && a.x2 > b.x1 && a.y1 < b.y2 && a.y2 > b.y1;
  const f1 = x => (Math.round(x * 10) / 10).toString().replace('.', ',');
  const short = s => { s = String(s || '').replace(/\s+/g, ' '); return s.length > 40 ? s.slice(0, 38) + '…' : s; };

  /* sh — лист (DRWCORE.Sheet); o.kText — коэффициент ширины надписей (КОМПАС шире оценки до 1,15 раза) */
  function lint(sh, o) {
    o = o || {};
    const kT = o.kText || 1.0, tolOn = 0.35;
    const P = sh.p, issues = [];
    const add = (sev, rule, msg, at, ex) => issues.push(Object.assign({ sev, rule, msg, at: at ? [Math.round(at[0] * 10) / 10, Math.round(at[1] * 10) / 10] : null }, ex ? { ex } : {}));
    const kindOf = {}; P.forEach(q => { if (q.t === 'K') kindOf[q.g] = q.k; });
    const geo = P.filter(q => (q.t === 'L' || q.t === 'C' || q.t === 'A') && q.g === undefined);
    const ann = P.filter(q => (q.t === 'L' || q.t === 'C' || q.t === 'A') && q.g !== undefined);
    const hatch = P.filter(q => q.t === 'H');
    const texts = P.filter(q => q.t === 'T');
    const f = sh.frame, st = sh.stamp;

    // 1. привязка обозначений к изображению
    for (const k of P.filter(q => q.t === 'K')) {
      for (const pt of k.pts) {
        const onGeo = geo.some(q => distPrim(pt[0], pt[1], q) <= tolOn) || hatch.some(q => distPrim(pt[0], pt[1], q) <= tolOn);
        if (onGeo) continue;
        const onAnn = (k.k === 'rough' || k.k === 'datum' || k.k === 'tol' || k.k === 'leader' || k.k === 'roughLeader') && ann.some(q => q.g !== k.g && q.t === 'L' && q.s === 2 && /dim|leader|roughLeader/.test(kindOf[q.g] || '') && distPrim(pt[0], pt[1], q) <= tolOn);
        if (onAnn) continue;
        const near = Math.min(...geo.map(q => distPrim(pt[0], pt[1], q)));
        add('error', 'привязка', `${KIND[k.k] || k.k}${k.text ? ' «' + short(k.text) + '»' : ''}: точка привязки не лежит на линии изображения (ближайшая линия в ${f1(near)} мм)`, pt);
      }
    }
    // 2. надписи: не пересекаются линиями, штриховкой, окружностями и другими надписями (ГОСТ 2.304, 2.307, 2.306)
    const TR = texts.map(q => ({ q, r: textRect(q, kT, 0.35) }));
    for (let i = 0; i < TR.length; i++) {
      const { q, r } = TR[i];
      const lines = P.filter(z => z.t === 'L' && (z.g === undefined || z.g !== q.g) && segHitsRect(z.a[0], z.a[1], z.a[2], z.a[3], r));
      const circs = P.filter(z => (z.t === 'C' || z.t === 'A') && z.a[2] > 0.8 && (z.g === undefined || z.g !== q.g) && circHitsRect(z, r));
      const hh = hatch.some(z => { for (let j = 0; j + 3 < z.l.length; j += 4) if (segHitsRect(z.l[j], z.l[j + 1], z.l[j + 2], z.l[j + 3], r)) return true; return false; });
      const what = [];
      const nGeo = lines.filter(z => z.g === undefined && z.s !== 3).length + circs.filter(z => z.g === undefined).length;
      const nAx = lines.filter(z => z.g === undefined && z.s === 3).length;
      const nAnn = lines.filter(z => z.g !== undefined).length + circs.filter(z => z.g !== undefined).length;
      if (nGeo) what.push('линии изображения'); if (nAx) what.push('осевые линии'); if (nAnn) what.push('линии других обозначений'); if (hh) what.push('штриховку');
      if (what.length) { const z = lines.find(z => !(z.g === undefined && z.s === 3)) || circs[0]; add('error', 'надпись на линии', `надпись «${short(q.s)}» пересекает ${what.join(', ')}`, [q.a[0], q.a[1]], z ? { by: (z.g === undefined ? 'геом.' : (kindOf[z.g] || '?')) + ' ' + z.t + ' s' + z.s + ' ' + z.a.map(f1).join(' '), tg: kindOf[q.g] } : null); }
      for (let j = i + 1; j < TR.length; j++) if (rectsHit(r, TR[j].r) && !(q.g !== undefined && q.g === TR[j].q.g && Math.abs(q.a[2] - TR[j].q.a[2]) > 0.5)) add('error', 'надписи накладываются', `надписи «${short(q.s)}» и «${short(TR[j].q.s)}» накладываются`, [q.a[0], q.a[1]]);
      if (r.x1 < f.x1 || r.x2 > f.x2 || r.y1 < f.y1 || r.y2 > f.y2) add('error', 'за рамкой', `надпись «${short(q.s)}» выходит за рамку`, [q.a[0], q.a[1]]);
      if (st && rectsHit(r, st)) add('error', 'основная надпись', `надпись «${short(q.s)}» заходит на основную надпись`, [q.a[0], q.a[1]]);
    }
    // 3. размерные и выносные линии не должны лежать на линиях контура
    for (const a of ann) {
      if (a.t !== 'L') continue;
      const ax = a.a, len = Math.hypot(ax[2] - ax[0], ax[3] - ax[1]); if (len < 1) continue;
      const ux = (ax[2] - ax[0]) / len, uy = (ax[3] - ax[1]) / len;
      for (const g of geo) {
        if (g.t !== 'L' || g.s !== 1) continue;
        const gx = g.a, gl = Math.hypot(gx[2] - gx[0], gx[3] - gx[1]); if (gl < 1) continue;
        const vx = (gx[2] - gx[0]) / gl, vy = (gx[3] - gx[1]) / gl;
        if (Math.abs(ux * vy - uy * vx) > 0.01) continue;
        if (distSeg(ax[0], ax[1], gx[0], gx[1], gx[2], gx[3]) > 0.3 && distSeg(ax[2], ax[3], gx[0], gx[1], gx[2], gx[3]) > 0.3 && distSeg(gx[0], gx[1], ax[0], ax[1], ax[2], ax[3]) > 0.3) continue;
        // длина перекрытия вдоль направления
        const pr = (x, y) => (x - ax[0]) * ux + (y - ax[1]) * uy;
        const a1 = 0, a2 = len, b1 = Math.min(pr(gx[0], gx[1]), pr(gx[2], gx[3])), b2 = Math.max(pr(gx[0], gx[1]), pr(gx[2], gx[3]));
        const ov = Math.min(a2, b2) - Math.max(a1, b1);
        const perp = Math.abs((gx[0] - ax[0]) * uy - (gx[1] - ax[1]) * ux);
        if (ov > 1.5 && perp < 0.3) { add('error', 'наложение на контур', `${KIND[kindOf[a.g]] || 'обозначение'}: линия лежит на линии контура на длине ${f1(ov)} мм`, [ax[0], ax[1]], { line: ax.map(f1).join(' '), txt: (P.find(t => t.t === 'T' && t.g === a.g) || {}).s }); break; }
      }
    }
    // 4. центровые линии окружностей (ГОСТ 2.303: выходят за контур на 2…5 мм; для окружностей ⌀ < 12 мм допускаются сплошные тонкие)
    const axes = geo.filter(q => q.t === 'L' && q.s === 3);
    const thin = geo.filter(q => q.t === 'L' && q.s === 2);
    const circles = geo.filter(q => q.t === 'C' && q.s === 1);
    const seen = new Set();
    for (const c of circles) {
      const [cx, cy, R] = c.a; const key = Math.round(cx * 2) + ':' + Math.round(cy * 2);
      const big = circles.filter(z => Math.hypot(z.a[0] - cx, z.a[1] - cy) < 0.3).reduce((m, z) => Math.max(m, z.a[2]), 0);
      if (R < big - 1e-6) continue;            // концентрические — проверяется наибольшая
      if (seen.has(key)) continue; seen.add(key);
      const need = R >= 6 ? axes : axes.concat(thin);
      const cover = (dir) => need.filter(q => { const [x1, y1, x2, y2] = q.a; if (dir === 'h') return Math.abs(y1 - cy) < 0.3 && Math.abs(y2 - cy) < 0.3; return Math.abs(x1 - cx) < 0.3 && Math.abs(x2 - cx) < 0.3; })
        .reduce((m, q) => { const [x1, y1, x2, y2] = q.a; const lo = dir === 'h' ? Math.min(x1, x2) - cx : Math.min(y1, y2) - cy, hi = dir === 'h' ? Math.max(x1, x2) - cx : Math.max(y1, y2) - cy; return { lo: Math.min(m.lo, lo), hi: Math.max(m.hi, hi) }; }, { lo: Infinity, hi: -Infinity });
      for (const dir of ['h', 'v']) {
        const cv = cover(dir);
        if (!isFinite(cv.lo)) { if (R >= 3) add(R >= 6 ? 'error' : 'warn', 'центровые линии', `окружность ⌀${f1(2 * R)} мм (на листе): нет ${dir === 'h' ? 'горизонтальной' : 'вертикальной'} центровой линии`, [cx, cy]); continue; }
        const e1 = -cv.lo - R, e2 = cv.hi - R;
        if (R >= 6 && (Math.min(e1, e2) < 1.5)) add('warn', 'центровые линии', `окружность ⌀${f1(2 * R)} мм: центровая линия выходит за контур меньше чем на 2 мм (${f1(Math.min(e1, e2))} мм)`, [cx, cy]);
      }
    }
    // 5. геометрия за рамкой и в основной надписи
    for (const q of P) {
      if (q.t !== 'L') continue;
      const xs = [q.a[0], q.a[2]], ys = [q.a[1], q.a[3]];
      if (Math.min(...xs) < f.x1 - 0.2 || Math.max(...xs) > f.x2 + 0.2 || Math.min(...ys) < f.y1 - 0.2 || Math.max(...ys) > f.y2 + 0.2) { add('error', 'за рамкой', 'линия выходит за рамку чертежа', [q.a[0], q.a[1]]); break; }
    }
    if (st) for (const q of P) { if (q.t === 'L' && segHitsRect(q.a[0], q.a[1], q.a[2], q.a[3], { x1: st.x1 + 0.5, y1: st.y1 + 0.5, x2: st.x2 - 0.5, y2: st.y2 - 0.5 })) { add('error', 'основная надпись', 'линия заходит на основную надпись', [q.a[0], q.a[1]]); break; } }
    // сгруппировать одинаковые
    const out = [], idx = new Map();
    for (const it of issues) { const k = it.rule + '|' + it.msg; if (idx.has(k)) { idx.get(k).n++; continue; } const z = Object.assign({ n: 1 }, it); idx.set(k, z); out.push(z); }
    return out;
  }
  root.DRWLINT = { lint, KIND };
})(typeof window !== 'undefined' ? window : globalThis);
