/* drw_pdf.js — альбом чертежей и спецификаций одним PDF (векторно): каждый лист в своём формате (А1, А2, А3, А4),
   шрифт ГОСТ 2.304 тип А встраивается, толщины и типы линий — как в предпросмотре (ГОСТ 2.303).
   Использует jsPDF (vendor/jspdf.umd.min.js, лицензия MIT). */
(function (root) {
  'use strict';
  const FONT_K = 1122 / 714, PT = 72 / 25.4, D2R = Math.PI / 180;
  const LW = { 1: 0.5, 2: 0.18, 3: 0.18, 4: 0.25 };
  const DASH = { 3: [8, 1.5, 1, 1.5], 4: [3, 1.5] };
  // знаков нет в шрифте ГОСТ: равнозначная замена или стандартный шрифт Symbol
  const SUBST = { '′': "'", '″': '"', '−': '-', '–': '-', '—': '-' };
  const SYM = { 'τ': 't', 'Σ': 'S', 'σ': 's', 'Δ': 'D', '△': 'D', 'ψ': 'y', 'η': 'h', 'α': 'a', 'β': 'b', 'δ': 'd', 'ε': 'e', 'μ': 'm', 'π': 'p', 'φ': 'f', 'ω': 'w', 'λ': 'l', 'ν': 'n', 'ρ': 'r' };

  function runs(s) {
    const out = []; let cur = '', sym = false;
    for (let ch of String(s)) {
      ch = SUBST[ch] || ch;
      const isS = SYM[ch] !== undefined;
      if (isS !== sym && cur) { out.push([cur, sym]); cur = ''; }
      sym = isS; cur += isS ? SYM[ch] : ch;
    }
    if (cur) out.push([cur, sym]);
    return out;
  }

  function drawSheet(doc, prims, H) {
    const Y = y => H - y;
    let style = null;
    const setStyle = s => { if (s === style) return; style = s; doc.setLineWidth(LW[s] || 0.25); doc.setLineDashPattern(DASH[s] || [], 0); };
    for (const q of prims) {
      if (q.t === 'L') { setStyle(q.s); doc.line(q.a[0], Y(q.a[1]), q.a[2], Y(q.a[3])); }
      else if (q.t === 'H') { setStyle(2); for (let i = 0; i + 3 < q.l.length; i += 4) doc.line(q.l[i], Y(q.l[i + 1]), q.l[i + 2], Y(q.l[i + 3])); }
      else if (q.t === 'C') { setStyle(q.s); doc.circle(q.a[0], Y(q.a[1]), q.a[2], 'S'); }
      else if (q.t === 'A') {
        setStyle(q.s);
        const [x, y, r, a1] = q.a; let da = q.a[4] - a1; while (da <= 0) da += 360;
        const n = Math.max(4, Math.ceil(da / 4));
        let px = x + r * Math.cos(a1 * D2R), py = y + r * Math.sin(a1 * D2R);
        for (let i = 1; i <= n; i++) { const a = (a1 + da * i / n) * D2R, nx = x + r * Math.cos(a), ny = y + r * Math.sin(a); doc.line(px, Y(py), nx, Y(ny)); px = nx; py = ny; }
      }
    }
    doc.setLineDashPattern([], 0);
    for (const q of prims) {
      if (q.t !== 'T') continue;
      const [x, y, h, ang] = q.a, size = h * FONT_K * PT;
      const rr = runs(q.s);
      const c = Math.cos((ang || 0) * D2R), sn = Math.sin((ang || 0) * D2R);
      if (rr.length === 1 && !rr[0][1]) {
        // одна строка шрифтом ГОСТ — растянуть/сжать до ширины из предпросмотра (как textLength в SVG)
        doc.setFont('GOST', 'italic'); doc.setFontSize(size);
        const t = rr[0][0], nat = doc.getTextWidth(t), cs = t.length > 1 && q.w ? (q.w - nat) / t.length : 0;
        doc.text(t, x, Y(y), { angle: ang || 0, charSpace: cs });
        continue;
      }
      let u = 0;
      for (const [t, sym] of rr) {
        doc.setFont(sym ? 'symbol' : 'GOST', sym ? 'normal' : 'italic'); doc.setFontSize(size);
        doc.text(t, x + u * c, Y(y + u * sn), { angle: ang || 0 });
        u += doc.getTextWidth(t);
      }
    }
  }

  /* list — листы (как в предпросмотре), primsOf(d) — примитивы листа вместе с рамкой и основной надписью */
  function album(list, primsOf, opt) {
    opt = opt || {};
    const { jsPDF } = root.jspdf;
    let doc = null;
    list.forEach((d, i) => {
      const W = d.sh.W, H = d.sh.H, or = W > H ? 'l' : 'p';
      if (!doc) {
        doc = new jsPDF({ unit: 'mm', format: [W, H], orientation: or, compress: true });
        if (root.GOST_FONT_A_ITALIC) { doc.addFileToVFS('GOST2304A-italic.ttf', root.GOST_FONT_A_ITALIC); doc.addFont('GOST2304A-italic.ttf', 'GOST', 'italic'); }
        doc.setProperties({ title: opt.title || 'Чертежи', subject: 'Курсовой проект', creator: 'Основы проектирования · КП' });
      } else doc.addPage([W, H], or);
      doc.setDrawColor(0); doc.setTextColor(0);
      drawSheet(doc, primsOf(d), H);
      if (opt.onPage) opt.onPage(i + 1, list.length);
    });
    return doc;
  }

  root.DRWPDF = { album, runs };
})(typeof window !== 'undefined' ? window : globalThis);
