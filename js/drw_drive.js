/* drw_drive.js — чертёж общего вида привода (00.00.00 ВО): вид спереди, вид слева и вид сверху (план).
   Редуктор изображается по его 3D-модели (силуэт объединения корпуса, крышек подшипников, концов валов, звёздочки);
   двигатель — по размерам каталога АИР; муфта, рама, цепная передача, вал с барабаном — по расчёту. */
(function (root) {
  'use strict';
  const C = root.DRWCORE, DR = root.DRAWINGS;
  const { Sheet } = C;
  const nf = (x, d) => C.fmtNum(x, d === undefined ? 0 : d);
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const CAN = { XOY: [0, 1], XOZ: [0, 2], YOZ: [1, 2] }, NRM = { XOY: 2, XOZ: 1, YOZ: 0 };

  /* ---------- растровое объединение проекций → контур (ломаные) */
  function Raster(cell) { this.c = cell; this.rows = new Map(); }
  Raster.prototype.span = function (j, x1, x2) { // заполнить отрезок строки j
    const c = this.c; if (x2 < x1) [x1, x2] = [x2, x1];
    const i1 = Math.round(x1 / c), i2 = Math.round(x2 / c); if (i2 <= i1) return;
    const r = this.rows.get(j) || []; r.push([i1, i2]); this.rows.set(j, r);
  };
  Raster.prototype.rect = function (x1, y1, x2, y2) { if (y2 < y1) [y1, y2] = [y2, y1]; const c = this.c; for (let j = Math.round(y1 / c); j < Math.round(y2 / c); j++) this.span(j, x1, x2); };
  Raster.prototype.circle = function (cx, cy, r) { const c = this.c; for (let j = Math.round((cy - r) / c); j < Math.round((cy + r) / c); j++) { const y = (j + 0.5) * c - cy; if (Math.abs(y) >= r) continue; const w = Math.sqrt(r * r - y * y); this.span(j, cx - w, cx + w); } };
  Raster.prototype.poly = function (pts) {
    const c = this.c, ys = pts.map(p => p[1]);
    for (let j = Math.round(Math.min(...ys) / c); j < Math.round(Math.max(...ys) / c); j++) {
      const y = (j + 0.5) * c, xs = [];
      for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; if ((a[1] <= y) !== (b[1] <= y)) xs.push(a[0] + (y - a[1]) * (b[0] - a[0]) / (b[1] - a[1])); }
      xs.sort((p, q) => p - q);
      for (let i = 0; i + 1 < xs.length; i += 2) this.span(j, xs[i], xs[i + 1]);
    }
  };
  Raster.prototype.inside = function (x, y) {
    const c = this.c, r = this.rows.get(Math.floor(y / c)); if (!r) return false;
    const i = x / c; return r.some(s => i >= s[0] && i < s[1]);
  };
  /* отрезок без частей, закрытых растром (линии невидимого контура на общем виде не показываются) */
  Raster.prototype.clip = function (x1, y1, x2, y2) {
    const L = Math.hypot(x2 - x1, y2 - y1), n = Math.max(1, Math.ceil(L / (this.c / 2))), out = [];
    let a = null;
    for (let i = 0; i < n; i++) {
      const t0 = i / n, t1 = (i + 1) / n, tm = (t0 + t1) / 2, vis = !this.inside(x1 + (x2 - x1) * tm, y1 + (y2 - y1) * tm);
      if (vis && a === null) a = t0;
      if (!vis && a !== null) { out.push([a, t0]); a = null; }
    }
    if (a !== null) out.push([a, 1]);
    return out.map(([u, v]) => [x1 + (x2 - x1) * u, y1 + (y2 - y1) * u, x1 + (x2 - x1) * v, y1 + (y2 - y1) * v]);
  };
  Raster.prototype.loops = function () {
    const c = this.c, rects = [];
    this.rows.forEach((spans, j) => {
      spans.sort((a, b) => a[0] - b[0]);
      const m = []; spans.forEach(s => { const l = m[m.length - 1]; if (l && s[0] <= l[1]) l[1] = Math.max(l[1], s[1]); else m.push(s.slice()); });
      m.forEach(([i1, i2]) => rects.push({ x1: i1 * c, x2: i2 * c, y1: j * c, y2: (j + 1) * c }));
    });
    return rects.length ? root.M3D.outline(rects) : [];
  };

  /* проекция 3D-модели редуктора на вид: ex, ey — мировые векторы осей листа, ed — направление взгляда */
  function projectReducer(M, view, cell) {
    const R = new Raster(cell);
    const X = w => dot(w, view.ex) + view.ox, Y = w => dot(w, view.ey) + view.oy, SC = Math.hypot(...view.ex);
    const parts = {}; M.parts.forEach(p => { parts[p.file] = p; });
    const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    // корпус и крышка корпуса — по операциям выдавливания (вырезы на силуэт почти не влияют)
    M.parts.filter(p => p.kind === 'ops').forEach(p => p.geom.ops.filter(o => !o.cut).forEach(o => {
      const n = NRM[o.base], cc = CAN[o.base];
      const toW = (u, v, t) => { const w = [0, 0, 0]; w[cc[0]] = u; w[cc[1]] = v; w[n] = t; return w; };
      const along = Math.abs(view.ed[n]) > 0.9;
      o.loops.forEach(l => {
        if (along) {
          if (l.c) { const w = toW(l.c[0], l.c[1], 0); R.circle(X(w), Y(w), l.c[2] * SC); }
          else R.poly(l.p.map(q => { const w = toW(q[0], q[1], 0); return [X(w), Y(w)]; }));
        } else {
          // боковая проекция призмы — прямоугольник: протяжённость контура вдоль видимой оси плоскости × толщина
          const pts = l.c ? [[l.c[0] - l.c[2], l.c[1] - l.c[2]], [l.c[0] + l.c[2], l.c[1] + l.c[2]]] : l.p;
          const corners = [];
          pts.forEach(q => [o.a, o.b].forEach(t => corners.push(toW(q[0], q[1], t))));
          const xs = corners.map(X), ys = corners.map(Y);
          R.rect(Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys));
        }
      });
    }));
    // тела вращения из сборки: крышки подшипников, концы валов, колёса/звёздочки снаружи
    M.asm.items.forEach(it => {
      const p = parts[it.file]; if (!p || p.kind === 'ops') return;
      if (!['cover', 'shaft', 'sprocket'].includes(p.kind)) return;
      const ax = it.axes.slice(0, 3), b = p.bbox || root.KOMPAS.partBox(p); if (!b) return;
      const c0 = it.pos;
      if (Math.abs(dot(ax, view.ed)) > 0.9) { const w = c0.map((v, i) => v + ax[i] * (b[0] + b[3]) / 2); R.circle(X(w), Y(w), b[4] * SC); }
      else if (p.kind === 'shaft') {
        p.geom.segs.reduce((x0, s) => { const w1 = c0.map((v, i) => v + ax[i] * x0), w2 = c0.map((v, i) => v + ax[i] * (x0 + s.l)); const r = s.d / 2; const dv = cross(ax, view.ed); const off = dv.map(q => q * r); R.poly([[X(w1) + dot(off, view.ex), Y(w1) + dot(off, view.ey)], [X(w2) + dot(off, view.ex), Y(w2) + dot(off, view.ey)], [X(w2) - dot(off, view.ex), Y(w2) - dot(off, view.ey)], [X(w1) - dot(off, view.ex), Y(w1) - dot(off, view.ey)]]); return x0 + s.l; }, 0);
      } else {
        const w1 = c0.map((v, i) => v + ax[i] * b[0]), w2 = c0.map((v, i) => v + ax[i] * b[3]), r = b[4];
        const dv = cross(ax, view.ed), off = dv.map(q => q * r);
        R.poly([[X(w1) + dot(off, view.ex), Y(w1) + dot(off, view.ey)], [X(w2) + dot(off, view.ex), Y(w2) + dot(off, view.ey)], [X(w2) - dot(off, view.ex), Y(w2) - dot(off, view.ey)], [X(w1) - dot(off, view.ex), Y(w1) - dot(off, view.ey)]]);
      }
    });
    // видимые линии внутри силуэта: фланец разъёма (кромки), торцы крышек подшипников, обращённые к наблюдателю
    const det = [];
    M.parts.filter(p => p.kind === 'ops').forEach(p => p.geom.ops.filter(o => !o.cut && /фланц/.test(o.n)).forEach(o => {
      const n = NRM[o.base], cc = CAN[o.base];
      if (Math.abs(view.ed[n]) > 0.9) return;
      const toW = (u, v, t) => { const w = [0, 0, 0]; w[cc[0]] = u; w[cc[1]] = v; w[n] = t; return w; };
      o.loops.forEach(l => { const pts = l.p || []; const cs = []; pts.forEach(q => [o.a, o.b].forEach(t => cs.push(toW(q[0], q[1], t)))); if (!cs.length) return; const xs = cs.map(X), ys = cs.map(Y); const x1 = Math.min(...xs), x2 = Math.max(...xs), y1 = Math.min(...ys), y2 = Math.max(...ys); if (x2 - x1 > y2 - y1) { det.push(['L', x1, y1, x2, y1], ['L', x1, y2, x2, y2]); } else { det.push(['L', x1, y1, x1, y2], ['L', x2, y1, x2, y2]); } });
    }));
    M.asm.items.forEach(it => {
      const p = parts[it.file]; if (!p || p.kind !== 'cover') return;
      const ax = it.axes.slice(0, 3); if (Math.abs(dot(ax, view.ed)) < 0.9) return;
      const w = it.pos; det.push(['C', X(w), Y(w), p.geom.Df / 2 * Math.hypot(...view.ex)], ['C', X(w), Y(w), (p.geom.D / 2 - 6) * Math.hypot(...view.ex)]);
    });
    const loops = R.loops();
    loops.det = det;
    loops.raster = R;
    return loops;
  }

  /* ---------- компоновка привода в координатах рамы: fx — вдоль оси двигателя, fy — поперёк, fz — вверх от верха рамы */
  function layout(R, P, T) {
    const F = root.DRWFRAME.frameLayout(R, P, T); if (!F) return null;
    const M = root.KOMPAS.model3d(R, P, T, root.KOMPAS.specs(R, P, T)[0]);
    const H3 = root.M3D.housing3d(R, P, T);
    const up = H3.feet.up, zOff = F.tr - H3.feet.bottom;
    const fyAx = R.task === 1 ? [0, 0, 1] : [0, 1, 0];
    const A = root.DRWASM.asmData(R, P, T);
    const out = A.shafts[A.shafts.length - 1];
    return { F, M, H3, up, zOff, fyAx, A, out };
  }

  function views(R, P, T, L, k) {
    const { F, M, up, zOff, fyAx } = L;
    const m = R.motor || {}, cp = (R.cp && R.cp.c) || {};
    const res = {};
    const mk = () => { const sh = new Sheet('A1', true); sh.frame = { x1: -1e5, y1: -1e5, x2: 1e5, y2: 1e5 }; return sh; };
    const axZ = F.Hin + F.tr;                         // высота оси входного вала над верхом рамы
    const zM0 = F.raise + F.tm;                       // опорная плоскость лап двигателя
    const items = { front: [], top: [] };
    for (const vw of ['front', 'top']) {
      const sh = mk();
      // ось листа: x = fx; y = fz (вид спереди, смотрим вдоль +fy) или −fy (вид сверху)
      const view = vw === 'front' ? { ex: [k, 0, 0], ey: up.map(v => v * k), ed: fyAx, ox: 0, oy: zOff * k } : { ex: [k, 0, 0], ey: fyAx.map(v => -v * k), ed: up, ox: 0, oy: 0 };
      const P2 = (fx, a) => [fx * k, a * k];          // a — fz (спереди) или −fy (сверху)
      const rect = (x1, a1, x2, a2, st) => sh.poly([P2(x1, a1), P2(x2, a1), P2(x2, a2), P2(x1, a2)], st === undefined ? 1 : st);
      // редуктор — силуэт по 3D-модели
      const sil = projectReducer(M, view, 1.2);
      sil.forEach(lp => sh.poly(lp, 1));
      (sil.det || []).forEach(q => q[0] === 'L' ? sh.line(q[1], q[2], q[3], q[4], 1) : sh.circle(q[1], q[2], q[3], 1));
      const rb = sh.bbox(0);
      items[vw].push({ kind: 'red', pt: [(rb.x1 + rb.x2) / 2, vw === 'front' ? rb.y2 - (rb.y2 - rb.y1) * 0.25 : (rb.y1 + rb.y2) / 2] });
      // рама
      const b2 = F.bc / 2;
      if (vw === 'front') {
        rect(F.fx0, -F.hc, F.fx1, 0);
        F.padsR.slice(0, 1).forEach(p => rect(p.x1, 0, p.x2, p.t));
        F.cross.filter(c => c.top).forEach(c => rect(c.x - b2, 0, c.x + b2, F.hc));
        F.padsM.forEach(p => rect(p.x1, p.z0, p.x2, p.z0 + p.t));
        items.front.push({ kind: 'frame', pt: P2((F.fx0 + F.fx1) / 2, -F.hc / 2) });
      } else {
        [F.yL, F.yR].forEach(y => rect(F.fx0, -(y - b2), F.fx1, -(y + b2), 2));
        F.cross.forEach(c => c.top ? rect(c.x - b2, -(F.yL - b2), c.x + b2, -(F.yR + b2), 2) : rect(c.x - b2, -(F.yL + b2), c.x + b2, -(F.yR - b2), 2));
        F.floor.forEach(h => { sh.circle(h.fx * k, -h.fy * k, F.dF / 2 * k, 1); sh.line((h.fx - F.dF) * k, -h.fy * k, (h.fx + F.dF) * k, -h.fy * k, 3).line(h.fx * k, (-h.fy - F.dF) * k, h.fx * k, (-h.fy + F.dF) * k, 3); });
      }
      // двигатель
      const Lb = (m.l30 || 400) - (m.l1 || 80), d30 = m.d30 || 2 * (m.h || 100) * 0.95, h = m.h || 100, l31 = m.l31 || 60, l10 = m.l10 || 120, b10 = m.b10 || 160, b11 = m.b11 || b10 + 40, d1 = m.d1 || 28;
      const x0 = F.mSh, xm1 = x0 + Lb;
      if (vw === 'front') {
        const ax = zM0 + h;
        rect(F.mEnd, ax - d1 / 2, x0, ax + d1 / 2);                               // вал
        rect(x0, ax - d30 / 2, xm1 - Lb * 0.18, ax + d30 / 2);                   // корпус
        rect(xm1 - Lb * 0.18, ax - d30 * 0.44, xm1, ax + d30 * 0.44);             // кожух вентилятора
        rect(x0 + l31 - 22, zM0, x0 + l31 + l10 + 22, zM0 + Math.max(10, h * 0.14)); // лапы
        rect(x0 + Lb * 0.25, ax + d30 / 2, x0 + Lb * 0.55, zM0 + (m.h31 || h + d30 / 2 + 40));  // коробка выводов
        sh.line((F.mEnd - 10) * k, ax * k, (xm1 + 10) * k, ax * k, 3);
        items.front.push({ kind: 'motor', pt: P2(x0 + Lb * 0.6, ax) });
      } else {
        const y = -F.axY;
        rect(F.mEnd, y - d1 / 2, x0, y + d1 / 2);
        rect(x0, y - d30 / 2, xm1 - Lb * 0.18, y + d30 / 2);
        rect(xm1 - Lb * 0.18, y - d30 * 0.44, xm1, y + d30 * 0.44);
        rect(x0 + l31 - 22, y - b11 / 2, x0 + l31 + l10 + 22, y + b11 / 2);
        F.motHoles.forEach(q => sh.circle(q.fx * k, -q.fy * k, F.dMot / 2 * k, 1));
        rect(x0 + Lb * 0.25, y - d30 * 0.3, x0 + Lb * 0.55, y + d30 * 0.3);
        sh.line((F.mEnd - 10) * k, y * k, (xm1 + 10) * k, y * k, 3);
        items.top.push({ kind: 'motor', pt: P2(x0 + Lb * 0.7, y) });
      }
      // муфта — между концами валов
      const gc = F.mEnd - 2, Lc = Math.min(cp.L1 || 2 * (cp.l1 || 60), (F.mSh - F.mEnd) * 2 + 40), Dc = cp.D || 120;
      const ac = vw === 'front' ? axZ : -F.axY;
      rect(gc - Lc / 2, ac - Dc / 2, gc - 2, ac + Dc / 2); rect(gc + 2, ac - Dc / 2, gc + Lc / 2, ac + Dc / 2);
      items[vw].push({ kind: 'coupling', pt: P2(gc + Lc / 4, ac + Dc * 0.3) });
      res[vw] = { sh, view };
    }
    // цепная передача / выходной вал
    const out = L.out, sp = M.parts.find(p => p.kind === 'sprocket'), spIt = sp && M.asm.items.find(i => i.file === sp.file);
    const W2F = w => ({ fx: w[0], fy: dot(w, fyAx), fz: dot(w, up) + zOff });
    if (sp && spIt && R.chn) {
      const c1 = W2F(spIt.pos.map((v, i) => v + spIt.axes[i] * 0)), r1 = R.chn.De1 / 2, r2 = R.chn.De2 / 2, a = R.chn.a, b = sp.geom.b;
      const axv = spIt.axes.slice(0, 3);
      const alongFx = Math.abs(axv[0]) > 0.9;
      // ведомая звёздочка: задание 6 — на валу барабана (поперёк рамы), задание 3 — к кантователю (вдоль рамы, от двигателя)
      // межосевое расстояние цепи велико — изображение с разрывом, размер — действительный
      const aD = Math.min(a, Math.max(r1 + r2 + 70, 300)), broken = aD < a - 1;
      const c2 = alongFx ? { fx: c1.fx, fy: c1.fy + aD, fz: c1.fz } : { fx: c1.fx - aD, fy: c1.fy, fz: c1.fz };
      const draw = (vw) => {
        const sh = res[vw].sh;
        const pt = q => vw === 'front' ? [q.fx * k, q.fz * k] : [q.fx * k, -q.fy * k];
        const seesFace = vw === 'front' ? !alongFx : false;
        const behind = vw === 'front' && alongFx;   // ведомая звёздочка за редуктором — на виде спереди не показывается
        if (seesFace) {
          [[c1, r1, 1], [c2, r2, 2]].forEach(([c, r, st]) => { const p = pt(c); sh.circle(p[0], p[1], r * k, st); sh.circle(p[0], p[1], (r - R.chn.t * 0.6) * k, 2); });
          const p1 = pt(c1), p2 = pt(c2), d = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) || 1, nx = -(p2[1] - p1[1]) / d, ny = (p2[0] - p1[0]) / d;
          [1, -1].forEach(s => sh.line(p1[0] + nx * r1 * k * s, p1[1] + ny * r1 * k * s, p2[0] + nx * r2 * k * s, p2[1] + ny * r2 * k * s, 2));
        } else {
          // вид сбоку звёздочек — прямоугольники толщиной b
          [[c1, r1, 1], [c2, r2, 2]].filter((q, i) => !(behind && i === 1)).forEach(([c, r, st]) => {
            const p = pt(c);
            if (vw === 'front') sh.poly([[p[0] - b / 2 * k, p[1] - r * k], [p[0] + b / 2 * k, p[1] - r * k], [p[0] + b / 2 * k, p[1] + r * k], [p[0] - b / 2 * k, p[1] + r * k]], st);
            else if (alongFx) sh.poly([[p[0] - b / 2 * k, p[1] - r * k], [p[0] + b / 2 * k, p[1] - r * k], [p[0] + b / 2 * k, p[1] + r * k], [p[0] - b / 2 * k, p[1] + r * k]], st);
            else sh.poly([[p[0] - r * k, p[1] - b / 2 * k], [p[0] + r * k, p[1] - b / 2 * k], [p[0] + r * k, p[1] + b / 2 * k], [p[0] - r * k, p[1] + b / 2 * k]], st);
          });
          const p1 = pt(c1), p2 = pt(c2);
          if (!behind) sh.line(p1[0], p1[1], p2[0], p2[1], 3);
        }
        const q1 = pt(c1), q2 = pt(c2);
        if (broken && !behind) { const mx = (q1[0] + q2[0]) / 2, my = (q1[1] + q2[1]) / 2, dx = q2[0] - q1[0], dy = q2[1] - q1[1], d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d, nx = -uy, ny = ux, L0 = 10; [-2.5, 2.5].forEach(o => sh.poly([[mx + ux * o - nx * L0, my + uy * o - ny * L0], [mx + ux * o + nx * L0 * 0.1, my + uy * o + ny * L0 * 0.1 - 0], [mx + ux * o - nx * L0 * 0.1 + ux * 2, my + uy * o - ny * L0 * 0.1 + uy * 2], [mx + ux * o + nx * L0, my + uy * o + ny * L0]], 2, false)); }
        if (vw === 'top' || seesFace) sh.attempt([1, -1].map(sg => () => { const off = (Math.max(r1, r2) + 14) * k * sg; return Math.abs(q2[0] - q1[0]) > Math.abs(q2[1] - q1[1]) ? sh.dimH(q1[0], q1[1], q2[0], q2[1], q1[1] + off, nf(a) + (broken ? '' : '')) : sh.dimV(q1[0], q1[1], q2[0], q2[1], q1[0] + off, nf(a)); }));
        items[vw].push({ kind: 'chain', pt: [(pt(c1)[0] + pt(c2)[0]) / 2, (pt(c1)[1] + pt(c2)[1]) / 2 + (seesFace ? (r1 + r2) / 2 * k : 0)] });
      };
      draw('front'); draw('top');
      // вал конвейера с барабаном (задание 6)
      if (R.drum && alongFx) {
        const dr = R.drum, Lw = dr.l4 + 2 * 60, D = dr.Db, B = dr.Bb;
        ['top'].forEach(vw => {
          const sh = res[vw].sh, st = 1;
          const ctr = { fx: c2.fx, fy: c2.fy, fz: c2.fz };
          const pt = q => vw === 'front' ? [q.fx * k, q.fz * k] : [q.fx * k, -q.fy * k];
          const p = pt(ctr), sg = c1.fx > F.fx0 + (F.fx1 - F.fx0) / 2 ? -1 : 1;   // барабан — в сторону от звёздочки
          const xm = p[0] + sg * (dr.ak4 || 100) * k + sg * dr.l4 / 2 * k;
          const yA = vw === 'front' ? p[1] : p[1];
          sh.poly([[xm - B / 2 * k, yA - D / 2 * k], [xm + B / 2 * k, yA - D / 2 * k], [xm + B / 2 * k, yA + D / 2 * k], [xm - B / 2 * k, yA + D / 2 * k]], st);
          sh.line(Math.min(p[0], xm - sg * Lw / 2 * k) - 6, yA, Math.max(p[0], xm + sg * Lw / 2 * k) + 6, yA, 3);
          [xm - dr.l4 / 2 * k, xm + dr.l4 / 2 * k].forEach(x => sh.poly([[x - 30 * k, yA - (dr.dp / 2 + 40) * k], [x + 30 * k, yA - (dr.dp / 2 + 40) * k], [x + 30 * k, yA + (dr.dp / 2 + 40) * k], [x - 30 * k, yA + (dr.dp / 2 + 40) * k]], st));
          sh.poly([[p[0], yA - dr.dv / 2 * k], [xm + sg * (dr.l4 / 2 + 40) * k, yA - dr.dv / 2 * k], [xm + sg * (dr.l4 / 2 + 40) * k, yA + dr.dv / 2 * k], [p[0], yA + dr.dv / 2 * k]], st);
          items[vw].push({ kind: 'drum', pt: [xm, yA + D / 4 * k] });
        });
      }
    }
    // ---- вид слева (ГОСТ 2.305: справа от главного вида): смотрим вдоль +fx; ось листа x = −fy, y = fz
    {
      const sh = mk(), vS = { ex: fyAx.map(v => -v * k), ey: up.map(v => v * k), ed: [1, 0, 0], ox: 0, oy: zOff * k };
      const P3 = (fy, fz) => [-fy * k, fz * k];
      const sil = projectReducer(M, vS, 1.2), RS = sil.raster;
      sil.forEach(lp => sh.poly(lp, 1));
      (sil.det || []).forEach(q => q[0] === 'L' ? sh.line(q[1], q[2], q[3], q[4], 1) : sh.circle(q[1], q[2], q[3], 1));
      // что дальше редуктора от наблюдателя (по fx) — закрыто его силуэтом
      const fb = res.front.sh.geoBox(), redFx = (fb.x1 + fb.x2) / 2 / k;
      const seg = (behind, x1, y1, x2, y2, st) => (behind ? RS.clip(x1, y1, x2, y2) : [[x1, y1, x2, y2]]).forEach(q => sh.line(q[0], q[1], q[2], q[3], st));
      const box = (behind, fy1, z1, fy2, z2, st) => { const a = P3(fy1, z1), b = P3(fy2, z2); [[a[0], a[1], b[0], a[1]], [b[0], a[1], b[0], b[1]], [b[0], b[1], a[0], b[1]], [a[0], b[1], a[0], a[1]]].forEach(q => seg(behind, ...q, st === undefined ? 1 : st)); };
      const circ = (behind, fy, z, r, st) => { const c = P3(fy, z), n = 48; if (!behind || ![0, 1, 2, 3].some(i => RS.inside(c[0] + r * k * Math.cos(i * Math.PI / 2), c[1] + r * k * Math.sin(i * Math.PI / 2))) && !RS.inside(c[0], c[1])) { sh.circle(c[0], c[1], r * k, st === undefined ? 1 : st); return; } for (let i = 0; i < n; i++) { const a1 = 2 * Math.PI * i / n, a2 = 2 * Math.PI * (i + 1) / n; seg(true, c[0] + r * k * Math.cos(a1), c[1] + r * k * Math.sin(a1), c[0] + r * k * Math.cos(a2), c[1] + r * k * Math.sin(a2), st === undefined ? 1 : st); } };
      // рама: продольные швеллеры в торец, поперечины сверху, подкладки под двигатель
      const b2 = F.bc / 2;
      [F.yL, F.yR].forEach(y => box(false, y - b2, -F.hc, y + b2, 0));
      box(false, F.yL - b2, -F.hc, F.yR + b2, 0);
      if (F.cross.some(c => c.top)) box(true, F.yL - b2, 0, F.yR + b2, F.hc);
      // двигатель (в торец): корпус, кожух вентилятора, лапы, коробка выводов
      const Lb = (m.l30 || 400) - (m.l1 || 80), d30 = m.d30 || 2 * (m.h || 100) * 0.95, h = m.h || 100, b10 = m.b10 || 160, b11 = m.b11 || b10 + 40;
      const mBehind = F.mSh + Lb / 2 > redFx, axM = zM0 + h;
      F.padsM.forEach(p => box(mBehind, F.axY - b11 / 2 - 10, p.z0, F.axY + b11 / 2 + 10, p.z0 + p.t));
      box(mBehind, F.axY - b11 / 2, zM0, F.axY + b11 / 2, zM0 + Math.max(10, h * 0.14));
      box(mBehind, F.axY - d30 * 0.3, axM + d30 / 2 - 4, F.axY + d30 * 0.3, zM0 + (m.h31 || h + d30 / 2 + 40));
      circ(mBehind, F.axY, axM, d30 / 2);
      // муфта
      const Dc = cp.D || 120;
      circ(F.mEnd > redFx, F.axY, axZ, Dc / 2, 1);
      res.side = { sh, view: vS };
      items.side = [];
    }
    // цепная передача и барабан на виде слева
    if (sp && spIt && R.chn) {
      const sh = res.side.sh, RS = null;
      const c1 = W2F(spIt.pos), r1 = R.chn.De1 / 2, r2 = R.chn.De2 / 2, b = sp.geom.b, a = R.chn.a;
      const axv = spIt.axes.slice(0, 3), alongFx = Math.abs(axv[0]) > 0.9;
      const aD = Math.min(a, Math.max(r1 + r2 + 70, 300));
      const P3 = (fy, fz) => [-fy * k, fz * k];
      if (alongFx) {
        // звёздочки видны с торца: окружности и ветви цепи (вторая звёздочка смещена поперёк рамы)
        const p1 = P3(c1.fy, c1.fz), p2 = P3(c1.fy + aD, c1.fz);
        [[p1, r1, 1], [p2, r2, 2]].forEach(([p, r, st]) => { sh.circle(p[0], p[1], r * k, st); sh.circle(p[0], p[1], (r - R.chn.t * 0.6) * k, 2); });
        [1, -1].forEach(sg => sh.line(p1[0], p1[1] + sg * r1 * k, p2[0], p2[1] + sg * r2 * k, 2));
        if (R.drum) { const D = R.drum.Db; sh.circle(p2[0], p2[1], D / 2 * k, 1); }
      } else {
        const p = P3(c1.fy, c1.fz);
        sh.poly([[p[0] - b / 2 * k, p[1] - r1 * k], [p[0] + b / 2 * k, p[1] - r1 * k], [p[0] + b / 2 * k, p[1] + r1 * k], [p[0] - b / 2 * k, p[1] + r1 * k]], 1);
      }
      void RS;
    }
    // выходной вал задания 1 — к ведущей звёздочке подвесного конвейера
    if (R.task === 1) {
      const o = L.out, top = o.pos.map((v, i) => v + o.ax[i] * o.segs[o.segs.length - 1].x1);
      const q = W2F(top), sh = res.front.sh;
      sh.leader(q.fx * k, q.fz * k - 2, q.fx * k + 20, q.fz * k + 14, 'к звёздочке', 'конвейера');
    }
    return { res, items, axZ, zM0 };
  }

  /* общая сборка листа общего вида: виды → размеры → позиции → техтребования и характеристика → раскладка на А1.
     build.views(k) → { res: { front: { sh }, top: { sh } }, items }, build.dims(V, k) — размеры на видах */
  function compose(R, P, T, drvSpec, build, meta) {
    const findPos = re => { let p = ''; drvSpec.sections.forEach(sc => sc.items.forEach(it => { if (!p && it.pos && re.test(it.name)) p = it.pos; })); return p; };
    const POS = { red: findPos(/^Редуктор/), frame: findPos(/^Рама/), drum: findPos(/барабан/), motor: findPos(/Электродвигатель/), coupling: findPos(/Муфта/), chain: findPos(/^Цепь/) };
    const K = R.K || {};
    const last = R.task === 6 ? { T: K.TIII, n: K.nIII } : R.task === 3 ? { T: K.TII, n: K.nII } : { T: K.T2T, n: K.n2T };
    const tech = [`1. Мощность электродвигателя ${nf((R.motor || {}).P, 1)} кВт, частота вращения ${nf((R.motor || {}).n)} мин⁻¹.`, `2. Электродвигатель ${(R.motor || {}).type || ''}.`,
      `3. Вращающий момент на выходном валу ${nf(last.T || 0, 1)} Н·м, частота вращения ${nf(last.n || 0, 1)} мин⁻¹.`, `4. Общее передаточное число привода ${nf((R.motor && last.n) ? R.motor.n / last.n : 0, 2)}.`];
    const req = ['1. *Размеры для справок.', `2. Смещение осей валов электродвигателя и редуктора не более ${R.cp && R.cp.c ? nf(R.cp.c.dr, 1) : '0,3'} мм, перекос — не более ${R.cp && R.cp.c ? R.cp.c.da : '1°'}.`,
      ...(R.chn ? [`3. Звёздочки цепной передачи установить в одной плоскости; отклонение — не более 0,2 мм на 100 мм межосевого расстояния. Стрела провисания цепи ${nf(0.02 * R.chn.a, 0)} мм.`] : []),
      `${R.chn ? 4 : 3}. Ограждения муфты${R.chn ? ' и цепной передачи' : ''} условно не показаны.`, `${R.chn ? 5 : 4}. Раму крепить к полу фундаментными болтами М${(R.H && R.H.d1) || 16}.`];
    for (const [k, kt] of [[0.4, '1:2,5'], [0.25, '1:4'], [0.2, '1:5'], [0.1, '1:10']]) for (const land of [true, false]) {
      const V = build.views(k);
      const fr = V.res.front.sh, tp = V.res.top.sh;
      build.dims(V, k);
      // позиции
      const pl = (vw, sh) => root.DRWASM.positions(sh, V.items[vw].map(it => Object.assign({ pos: POS[it.kind] || '' }, it)).filter((it, i, arr) => it.pos && arr.findIndex(q => q.pos === it.pos) === i));
      pl('front', fr); pl('top', tp);
      if (build.post) build.post(V, k);
      const sh = new Sheet('A1', land), f = sh.frame;
      sh.occupy(sh.stamp, 2); sh.occupy(sh.reserved(), 2);
      const W = 185, hT = (arr) => { let n = 0; arr.forEach(t => { n += C.wrap(String(t), W - 8, 3.5).length; }); return n * 3.5 * 1.65; };
      let y0 = sh.stamp.y2 + 8;
      sh.notes(sh.stamp.x1 + 2, y0, W - 4, req, { title: 'Технические требования' }); const rq = { x1: sh.stamp.x1, y1: y0 - 2, x2: f.x2 - 2, y2: y0 + hT(req) + 9 }; sh.occupy(rq, 2);
      y0 = rq.y2 + 8;
      sh.notes(sh.stamp.x1 + 2, y0, W - 4, tech, { title: 'Техническая характеристика' }); sh.occupy({ x1: sh.stamp.x1, y1: y0 - 2, x2: f.x2 - 2, y2: y0 + hT(tech) + 9 }, 2);
      const fb = fr.bbox(0), tb = tp.bbox(0), sL = Math.max(0, fb.x1 - tb.x1);   // вид сверху шире слева — сдвинуть оба вправо
      const p1 = DR.placeGroup(sh, fr.p, { near: [f.x1 + 15 + sL + (fb.x2 - fb.x1) / 2, f.y2 - 15 - (fb.y2 - fb.y1) / 2] });
      if (!p1) continue;
      const p2 = DR.placeGroup(sh, tp.p, { fixX: p1.dx, near: [0, p1.box.y1 - 12 - (tb.y2 - tb.y1) / 2] });
      if (!p2) continue;
      // вид слева — справа от главного, в проекционной связи (на одной высоте)
      const sd = V.res.side && V.res.side.sh;
      if (sd) { const sb = sd.bbox(0); const p3 = DR.placeGroup(sh, sd.p, { fixY: p1.dy, near: [p1.box.x2 + 20 + (sb.x2 - sb.x1) / 2, 0] }); if (!p3) continue; }
      return { id: meta.id, file: meta.file, name: (root.DATA.TASKS[P.task] || {}).title || 'Привод', nameSub: meta.nameSub, scale: kt, fmt: 'A1', landscape: land, sh };
    }
    return null;
  }

  function driveSheet(R, P, T, drvSpec) {
    const L = layout(R, P, T); if (!L) return null;
    const { F } = L;
    return compose(R, P, T, drvSpec, { views: k => views(R, P, T, L, k), dims: (V, k) => {
      const fr = V.res.front.sh, tp = V.res.top.sh;
      {
        const b = fr.geoBox();
        fr.dimH(b.x1, b.y1, b.x2, b.y1, b.y1 - 14, nf((b.x2 - b.x1) / k) + '*');
        fr.dimV(b.x2, b.y1, b.x2, b.y2, b.x2 + 14, nf((b.y2 - b.y1) / k) + '*');
        fr.dimV(F.fx0 * k, -F.hc * k, F.fx0 * k, V.axZ * k, F.fx0 * k - 12, nf(V.axZ + F.hc));
      }
      {
        const b = tp.geoBox();
        tp.dimV(b.x1, b.y1, b.x1, b.y2, b.x1 - 14, nf((b.y2 - b.y1) / k) + '*');
        const fl = F.floor.slice().sort((p, q) => p.fx - q.fx || p.fy - q.fy);
        const xs = [...new Set(fl.map(h => Math.round(h.fx)))];
        tp.dimH(xs[0] * k, -F.yR * k, xs[xs.length - 1] * k, -F.yR * k, Math.min(b.y1, -(F.yR + F.bc / 2) * k) - 12, nf(xs[xs.length - 1] - xs[0]));
        tp.dimV(xs[xs.length - 1] * k, -F.yL * k, xs[xs.length - 1] * k, -F.yR * k, b.x2 + 12, nf(F.yR - F.yL));
        const h = fl[0];
        tp.attempt([[-14, 14], [-14, -14], [14, -14]].map(([dx, dy]) => () => tp.leader(h.fx * k + Math.sign(dx) * F.dF / 2 * k * 0.7, -h.fy * k + Math.sign(dy) * F.dF / 2 * k * 0.7, h.fx * k + dx, -h.fy * k + dy, `⌀${F.dF}`, `${F.floor.length} отв.`, { side: dx > 0 ? 'r' : 'l' })));
        if (R.chn) { /* межосевое расстояние цепной передачи */ }
      }
      if (V.res.side) {
        const sd = V.res.side.sh, b = sd.geoBox();
        sd.dimH(b.x1, b.y1, b.x2, b.y1, b.y1 - 14, nf((b.x2 - b.x1) / k) + '*');
      }
    } }, { id: 'obshiy_vid', file: 'privod_VO.cdw', nameSub: 'Чертёж общего вида' });
  }

  root.DRWDRIVE = { driveSheet, compose, projectReducer, Raster };
})(typeof window !== 'undefined' ? window : globalThis);
