/* check3d.js — проверка 3D-модели редуктора: взаимные пересечения деталей сборки («clipping»)
   и соответствие модели чертежам (габариты корпуса и крышки, межосевые расстояния, диаметры расточек).
   Детали представляются так же, как их строит макрос: корпус и крышки — по операциям выдавливания/выреза,
   тела вращения — набором колец (цилиндров) в своей системе координат. Зубчатые венцы берутся по окружности
   впадин, чтобы зацепление не считалось пересечением. Касание (посадка, опора) пересечением не считается:
   проверяются точки, отстоящие от поверхности детали глубже допуска TOL. */
(function (root) {
  'use strict';
  const TOL = 0.6;
  const CAN = { XOY: [0, 1], XOZ: [0, 2], YOZ: [1, 2] }, NRM = { XOY: 2, XOZ: 1, YOZ: 0 };
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const r1 = x => Math.round(x * 10) / 10;

  function inPoly(pts, u, v) {
    let c = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const a = pts[i], b = pts[j];
      if ((a[1] > v) !== (b[1] > v) && u < (b[0] - a[0]) * (v - a[1]) / (b[1] - a[1]) + a[0]) c = !c;
    }
    return c;
  }
  // точка внутри тела, заданного операциями (выдавливания добавляют, вырезы удаляют — по порядку)
  function inOps(ops, p) {
    let s = false;
    for (const o of ops) {
      const n = NRM[o.base], c = CAN[o.base], t = p[n];
      if (t < o.a || t > o.b) continue;
      if (s === !o.cut) continue;
      const u = p[c[0]], v = p[c[1]];
      let ins = false;
      for (const l of o.loops) { if (l.c ? (u - l.c[0]) ** 2 + (v - l.c[1]) ** 2 <= l.c[2] ** 2 : inPoly(l.p, u, v)) { ins = true; break; } }
      if (ins) s = !o.cut;
    }
    return s;
  }
  const opsBox = ops => {
    const b = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
    ops.filter(o => !o.cut).forEach(o => { const n = NRM[o.base], c = CAN[o.base]; b[n] = Math.min(b[n], o.a); b[n + 3] = Math.max(b[n + 3], o.b);
      o.loops.forEach(l => (l.c ? [[l.c[0] - l.c[2], l.c[1] - l.c[2]], [l.c[0] + l.c[2], l.c[1] + l.c[2]]] : l.p).forEach(q => { b[c[0]] = Math.min(b[c[0]], q[0]); b[c[0] + 3] = Math.max(b[c[0] + 3], q[0]); b[c[1]] = Math.min(b[c[1]], q[1]); b[c[1] + 3] = Math.max(b[c[1] + 3], q[1]); })); });
    return b;
  };

  /* тело вращения: кольца {x1, x2, ri, ro} вдоль локальной оси X */
  function rings(p) {
    const g = p.geom || {}, R = [];
    const ring = (x1, x2, ri, ro) => { if (x2 - x1 > 0.01 && ro - ri > 0.01) R.push({ x1, x2, ri: Math.max(0, ri), ro }); };
    switch (p.kind) {
      case 'shaft': {
        let x = 0;
        g.segs.forEach(s => {
          let d = s.d;
          if (s.gear) { if (s.gear.kind === 'bevel') { x += s.l; return; } d = Math.min(d, s.gear.df || d); }
          ring(x, x + s.l, 0, d / 2); x += s.l;
        });
        break;
      }
      case 'bevel': {
        // по профилю чертежа (ступица и диск; зубья — до окружности впадин, зацепление не проверяется)
        if (!g.prof) break;
        const P = g.prof, xs = P.map(q => q[0]), x0 = Math.min(...xs), x1 = Math.max(...xs), n = 24, cap = (g.dfe || g.de) / 2;
        for (let i = 0; i < n; i++) {
          const a = x0 + (x1 - x0) * i / n, b = x0 + (x1 - x0) * (i + 1) / n, xm = (a + b) / 2, ys = [];
          for (let j = 0, k = P.length - 1; j < P.length; k = j++) { const A = P[j], B = P[k]; if ((A[0] - xm) * (B[0] - xm) < 0) ys.push(A[1] + (xm - A[0]) / (B[0] - A[0]) * (B[1] - A[1])); }
          if (ys.length >= 2) ring(a, b, Math.min(...ys), Math.min(Math.max(...ys), cap));
        }
        break;
      }
      case 'wheel': case 'wormwheel': {
        const df = g.df || g.d, h = (g.lst || g.b) / 2, rim = Math.max(2.5 * (g.m || 2), 0.05 * df);
        ring(-h, h, g.dbore / 2, g.dst / 2);
        ring(-(g.e || 10) / 2, (g.e || 10) / 2, g.dst / 2, df / 2 - rim);
        ring(-g.b / 2, g.b / 2, df / 2 - rim, df / 2);
        break;
      }
      case 'sprocket': {
        const rr = g.dd / 2 - (g.d1 || 10) / 2, h = (g.lst || g.b) / 2;
        ring(-h, h, g.dbore / 2, g.dst / 2); ring(-g.b / 2, g.b / 2, g.dst / 2, rr);
        break;
      }
      case 'bearing': ring(-g.B / 2, g.B / 2, g.d / 2, g.D / 2); break;
      case 'cover': { // как в build_cover: фланец, сплошное дно −3…0 и полый центрирующий поясок −ls…−3
        const hole = g.dSeal ? g.dSeal / 2 : 0, rc = g.D / 2 - Math.max(5, 0.08 * g.D);
        ring(0, g.tf, hole, g.Df / 2); ring(-3, 0, hole, g.D / 2); ring(-g.ls, -3, rc, g.D / 2); break; }
      case 'bolt': ring(-g.k, 0, 0, g.s / 2); ring(0, g.L, 0, 0.42 * g.d); break;
      case 'nut': ring(0, g.m, g.d / 2, g.s / 2); break;
      case 'washer': ring(0, g.t, g.d / 2, g.D / 2); break;
      case 'pin': ring(-g.L / 2, g.L / 2, 0, g.d / 2); break;
      default: return null;
    }
    return R;
  }

  /* все тела сборки в мировых координатах */
  function solids(M) {
    const parts = {}; M.parts.forEach(p => { parts[p.file] = p; });
    const S = [];
    M.asm.items.forEach((it, idx) => {
      const p = parts[it.file]; if (!p) return;
      const X = it.axes.slice(0, 3), Y = it.axes.slice(3, 6), Z = cross(X, Y), o = it.pos;
      const name = (p.name || p.id) + (p.std ? '' : '');
      if (p.kind === 'ops') {
        const ops = p.geom.ops, b = opsBox(ops);
        // операции заданы в мировых координатах при единичной ориентации вхождения
        const w = q => [q[0] - o[0], q[1] - o[1], q[2] - o[2]];
        S.push({ idx, file: it.file, name, kind: 'ops', box: [b[0] + o[0], b[1] + o[1], b[2] + o[2], b[3] + o[0], b[4] + o[1], b[5] + o[2]], inside: q => inOps(ops, w(q)) });
        return;
      }
      const R = rings(p); if (!R || !R.length) return;
      // сквозные отверстия вдоль оси (под винты крышки подшипника)
      const holes = [];
      const flats = p.kind === 'cover' && p.geom.flats ? p.geom.flats : [];
      if (p.kind === 'cover') { const g = p.geom, n = g.n || 4, rb = (g.D / 2 + g.Df / 2) / 2, ph = g.phi === undefined ? Math.PI / n : g.phi; for (let i = 0; i < n; i++) { const a = ph + 2 * Math.PI * i / n; holes.push([rb * Math.cos(a), rb * Math.sin(a), ((g.dks || 8) + 1) / 2]); } }
      const toL = q => { const d = [q[0] - o[0], q[1] - o[1], q[2] - o[2]]; return [dot(d, X), dot(d, Y), dot(d, Z)]; };
      const toW = (x, y, z) => [0, 1, 2].map(i => o[i] + X[i] * x + Y[i] * y + Z[i] * z);
      // мировой габарит
      const box = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
      R.forEach(r => [r.x1, r.x2].forEach(x => [[-1, -1], [-1, 1], [1, -1], [1, 1]].forEach(([a, c]) => { const w = toW(x, a * r.ro, c * r.ro); for (let i = 0; i < 3; i++) { box[i] = Math.min(box[i], w[i]); box[i + 3] = Math.max(box[i + 3], w[i]); } })));
      const inHole = (l, tol) => holes.some(h => Math.hypot(l[1] - h[0], l[2] - h[1]) < h[2] + tol) || flats.some(([th, dd]) => l[1] * Math.cos(th) + l[2] * Math.sin(th) > dd - tol);
      const inside = (q, tol) => { const l = toL(q), rr = Math.hypot(l[1], l[2]); tol = tol || 0; return R.some(r => l[0] > r.x1 + tol && l[0] < r.x2 - tol && rr > r.ri + tol && rr < r.ro - tol) && !inHole(l, tol); };
      // точки внутри тела (глубже допуска) для проверки чужих тел
      const samples = () => {
        const pts = [];
        R.forEach(r => {
          const L = r.x2 - r.x1 - 2 * TOL, T = r.ro - r.ri - 2 * TOL; if (L <= 0 || T <= 0) return;
          const st = Math.max(1, Math.min(6, Math.cbrt(L * T * 2 * Math.PI * r.ro / 6000)));
          for (let x = r.x1 + TOL; x <= r.x2 - TOL + 1e-9; x += Math.min(st, L) || 1) {
            for (let rr = r.ri + TOL; rr <= r.ro - TOL + 1e-9; rr += Math.min(st, T) || 1) {
              const na = Math.max(1, Math.ceil(2 * Math.PI * rr / st));
              for (let k = 0; k < na; k++) { const a = 2 * Math.PI * k / na, y = rr * Math.cos(a), z = rr * Math.sin(a); if (!inHole([x, y, z], TOL)) pts.push(toW(x, y, z)); }
              if (T < st) break;
            }
            if (L < st) break;
          }
        });
        return pts;
      };
      S.push({ idx, file: it.file, name, kind: p.kind, box, inside, samples, axis: X, pos: o });
    });
    return S;
  }

  const boxHit = (a, b) => a[0] < b[3] - TOL && b[0] < a[3] - TOL && a[1] < b[4] - TOL && b[1] < a[4] - TOL && a[2] < b[5] - TOL && b[2] < a[5] - TOL;
  // точка «глубоко» внутри тела из операций: внутри вместе с соседями на расстоянии допуска
  const deepOps = (s, q) => s.inside(q) && [[TOL, 0, 0], [-TOL, 0, 0], [0, TOL, 0], [0, -TOL, 0], [0, 0, TOL], [0, 0, -TOL]].every(d => s.inside([q[0] + d[0], q[1] + d[1], q[2] + d[2]]));

  /* пересечения: список {a, b, n, at} */
  function clashes(M) {
    const S = solids(M), out = [];
    const cache = new Map();
    const pts = s => { if (!cache.has(s.idx)) cache.set(s.idx, s.samples()); return cache.get(s.idx); };
    for (let i = 0; i < S.length; i++) for (let j = i + 1; j < S.length; j++) {
      const A = S[i], B = S[j];
      if (!boxHit(A.box, B.box)) continue;
      if (A.kind === 'ops' && B.kind === 'ops') continue;   // корпус и крышки: стык по плоскости разъёма и бобышке люка
      let n = 0, at = null;
      if (A.kind === 'ops' || B.kind === 'ops') {
        const O = A.kind === 'ops' ? A : B, Q = A.kind === 'ops' ? B : A;
        for (const q of pts(Q)) { if (q[0] < O.box[0] || q[0] > O.box[3] || q[1] < O.box[1] || q[1] > O.box[4] || q[2] < O.box[2] || q[2] > O.box[5]) continue; if (deepOps(O, q)) { n++; if (!at) at = q; } }
      } else {
        const [P, Q] = pts(A).length <= pts(B).length ? [A, B] : [B, A];
        for (const q of pts(P)) { if (Q.inside(q, TOL)) { n++; if (!at) at = q; } }
      }
      if (n >= 3) out.push({ a: A, b: B, n, at: at.map(r1) });
    }
    return out;
  }

  /* соответствие модели чертежам: габариты со «*» и диаметры расточек на чертежах корпуса и крышки, межосевые расстояния */
  function vsDrawings(M, SH) {
    const res = [];
    const ops = id => { const p = M.parts.find(q => q.id === id); return p ? p.geom.ops : null; };
    const texts = d => d.sh.p.filter(q => q.t === 'T').map(q => String(q.s));
    const num = s => parseFloat(String(s).replace(',', '.'));
    [['korpus', 'korpus', 'Корпус'], ['kryshka_korpusa', 'kryshka_korpusa', 'Крышка корпуса']].forEach(([sid, pid, nm]) => {
      const d = SH.find(q => q.id === sid), o = ops(pid); if (!d || !o) return;
      const ext = realExtent(o);
      const T = texts(d);
      T.filter(s => /^\d+[,.]?\d*\*$/.test(s)).forEach(s => {
        const v = num(s); const hit = ext.some(e => Math.abs(e - v) <= 1.5);
        res.push({ ok: hit, msg: `${nm}: габарит ${s} на чертеже ${hit ? 'совпадает с моделью' : '— в модели такого размера нет (габариты модели ' + ext.map(e => Math.round(e)).join(' × ') + ' мм)'}` });
      });
      // расточки: ⌀NNNH7 на чертеже ↔ вырезы-цилиндры этого диаметра в модели
      const bores = new Set(); o.filter(x => x.cut).forEach(x => x.loops.forEach(l => { if (l.c) bores.add(Math.round(2 * l.c[2])); }));
      T.map(s => s.match(/^⌀(\d+)H7$/)).filter(Boolean).forEach(m => { const v = +m[1]; const hit = bores.has(v); res.push({ ok: hit, msg: `${nm}: расточка ⌀${v}H7 на чертеже ${hit ? 'есть в модели' : '— в модели нет расточки такого диаметра'}` }); });
    });
    // межосевые расстояния на сборочном чертеже ↔ оси валов модели
    const asm = SH.find(q => q.id === 'reduktor_sb');
    if (asm) {
      const parts = {}; M.parts.forEach(p => { parts[p.file] = p; });
      const ax = M.asm.items.filter(it => parts[it.file] && parts[it.file].kind === 'shaft').map(it => ({ o: it.pos, d: it.axes.slice(0, 3) }));
      const dists = [];
      for (let i = 0; i < ax.length; i++) for (let j = i + 1; j < ax.length; j++) {
        const a = ax[i], b = ax[j], c = cross(a.d, b.d), w = [b.o[0] - a.o[0], b.o[1] - a.o[1], b.o[2] - a.o[2]];
        const cn = Math.hypot(...c);
        if (cn < 1e-6) { const t = dot(w, a.d); dists.push(Math.hypot(w[0] - t * a.d[0], w[1] - t * a.d[1], w[2] - t * a.d[2])); }
        else dists.push(Math.abs(dot(w, c)) / cn);
      }
      texts(asm).map(s => s.match(/^(\d+[,.]?\d*)±/)).filter(Boolean).forEach(m => {
        const v = num(m[1]); if (v < 40) return;
        const hit = dists.some(x => Math.abs(x - v) <= 0.5);
        res.push({ ok: hit, msg: `Сборочный чертёж: межосевое расстояние ${m[1]} ${hit ? 'совпадает с моделью' : '— в модели такого расстояния между осями валов нет (' + dists.map(x => r1(x)).join(', ') + ')'}` });
      });
    }
    return res;
  }
  // протяжённость тела из операций по осям (с учётом вырезов и среза по разъёму): по точкам на границах
  // каждого выдавливания (чуть внутри), которые остаются в итоговом теле
  function realExtent(ops) {
    const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity], e = 0.02;
    const add = q => { if (!inOps(ops, q)) return; for (let i = 0; i < 3; i++) { lo[i] = Math.min(lo[i], q[i]); hi[i] = Math.max(hi[i], q[i]); } };
    ops.filter(o => !o.cut).forEach(o => {
      const n = NRM[o.base], c = CAN[o.base];
      const P = (u, v, t) => { const q = [0, 0, 0]; q[c[0]] = u; q[c[1]] = v; q[n] = t; return q; };
      // кроме торцов — по обе стороны границ других операций вдоль той же оси (вырез мог срезать торец)
      const ts = [o.a + e, (o.a + o.b) / 2, o.b - e];
      ops.forEach(q => { if (NRM[q.base] !== n) return; [q.a, q.b].forEach(t => [t - 2 * e, t + 2 * e].forEach(u => { if (u > o.a && u < o.b) ts.push(u); })); });
      o.loops.forEach(l => {
        const pts = [];
        if (l.c) for (let k = 0; k < 144; k++) { const a = 2 * Math.PI * k / 144; pts.push([l.c[0] + (l.c[2] - e) * Math.cos(a), l.c[1] + (l.c[2] - e) * Math.sin(a)]); }
        else {
          const cx = l.p.reduce((a, q) => a + q[0], 0) / l.p.length, cy = l.p.reduce((a, q) => a + q[1], 0) / l.p.length;
          for (let i = 0; i < l.p.length; i++) { const A = l.p[i], B = l.p[(i + 1) % l.p.length], L = Math.hypot(B[0] - A[0], B[1] - A[1]), m = Math.max(1, Math.ceil(L / 2));
            for (let k = 0; k <= m; k++) { const x = A[0] + (B[0] - A[0]) * k / m, y = A[1] + (B[1] - A[1]) * k / m, d = Math.hypot(cx - x, cy - y) || 1; pts.push([x + (cx - x) / d * e, y + (cy - y) / d * e]); } }
        }
        pts.forEach(([u, v]) => ts.forEach(t => add(P(u, v, t))));
      });
    });
    return [0, 1, 2].map(i => hi[i] - lo[i]);
  }

  function check(M, SH) {
    const cl = clashes(M);
    const draw = SH ? vsDrawings(M, SH) : [];
    const lines = [];
    cl.forEach(c => lines.push({ ok: false, kind: 'clash', msg: `пересечение: «${c.a.name}» (${c.a.file}) и «${c.b.name}» (${c.b.file}) — ${c.n} точек, например в (${c.at.join('; ')})` }));
    draw.forEach(d => lines.push(Object.assign({ kind: 'drawing' }, d)));
    return { clashes: cl.length, drawingMismatch: draw.filter(d => !d.ok).length, lines };
  }

  root.CHECK3D = { check, clashes, vsDrawings, solids, inOps };
})(typeof window !== 'undefined' ? window : globalThis);
