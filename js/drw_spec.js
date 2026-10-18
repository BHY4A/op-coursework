/* drw_spec.js — спецификация (ГОСТ 2.106-96, форма 1) для предпросмотра: листы А4,
   первый лист — основная надпись по форме 2, последующие — по форме 2а (ГОСТ 2.104-2006).
   Данные — те же, что макрос передаёт в КОМПАС (KOMPAS.specs). */
(function (root) {
  'use strict';
  const C = root.DRWCORE;
  const COLS = [['Формат', 6, true], ['Зона', 6, true], ['Поз.', 8, true], ['Обозначение', 70], ['Наименование', 63], ['Кол.', 10], ['Примечание', 22]];
  const ROW = 8, HEAD = 15, ST1 = 40, ST2 = 15, H = 3.5;

  // строки спецификации: разделы с заголовками (подчёркнутыми), пустые строки между разделами, перенос длинных наименований
  function rowsOf(spec) {
    const rows = [];
    spec.sections.forEach((sc, i) => {
      if (!sc.items.length) return;
      if (i) rows.push({});
      rows.push({ title: sc.title }); rows.push({});
      sc.items.forEach(it => {
        const nm = C.wrap(String(it.name || '').replace(/ГОСТ /g, 'ГОСТ\u00a0'), 63 - 3, H).map(q => q.replace(/\u00a0/g, ' ')), nt = C.wrap(String(it.note || ''), 22 - 2, H);
        const n = Math.max(nm.length, nt.length, 1);
        for (let j = 0; j < n; j++) rows.push(j ? { name: nm[j] || '', note: nt[j] || '' } : { fmt: it.fmt || '', zone: it.zone || '', pos: it.noPos ? '' : (it.pos || ''), code: it.code || '', name: nm[0] || '', qty: it.qty === undefined ? '' : String(it.qty), note: nt[0] || '' });
      });
    });
    return rows;
  }

  function stampForm2(sh, f, s, nSheet, nTot, T) {
    const x0 = f.x1, y0 = f.y1, L = (a, b, c, d, st) => sh.line(a, b, c, d, st || 1), t = (x, y, str, h, an) => str && sh.text(x, y, String(str), { h, anchor: an || 'lb' });
    L(x0, y0 + ST1, f.x2, y0 + ST1);
    [7, 17, 40, 55, 65].forEach(dx => L(x0 + dx, y0, x0 + dx, y0 + ST1));
    for (let i = 1; i < 8; i++) L(x0, y0 + 5 * i, x0 + 65, y0 + 5 * i, i === 4 || i === 5 ? 1 : 2);
    L(x0 + 65, y0 + 25, f.x2, y0 + 25);                                   // под обозначением
    L(x0 + 135, y0, x0 + 135, y0 + 25);                                    // наименование | литера…
    L(x0 + 135, y0 + 15, f.x2, y0 + 15); L(x0 + 135, y0 + 20, f.x2, y0 + 20);
    L(x0 + 150, y0 + 15, x0 + 150, y0 + 25); L(x0 + 165, y0 + 15, x0 + 165, y0 + 25);
    [140, 145].forEach(dx => L(x0 + dx, y0 + 15, x0 + dx, y0 + 20, 2));
    const sm = 2.5;
    [['Изм.', 0], ['Лист', 7], ['№ докум.', 17], ['Подп.', 40], ['Дата', 55]].forEach(([q, dx]) => t(x0 + dx + 0.6, y0 + 20.8, q, sm));
    ['Разраб.', 'Пров.', 'Н.контр.', 'Утв.'].forEach((q, i) => t(x0 + 0.6, y0 + 15.8 - i * 5, q, sm));
    t(x0 + 137, y0 + 21, 'Лит.', sm); t(x0 + 152, y0 + 21, 'Лист', sm); t(x0 + 167, y0 + 21, 'Листов', sm);
    t(x0 + 157.5, y0 + 16.2, String(nSheet), H, 'cb'); t(x0 + 175, y0 + 16.2, String(nTot), H, 'cb');
    const I = root.KOMPAS && root.KOMPAS.stampInfo ? root.KOMPAS.stampInfo(T) : { student: (T || {}).student, teacher: (T || {}).teacher, org: 'КНИТУ' };
    [[I.student, 15.8], [I.teacher, 10.8], [I.normo, 5.8], [I.utv, 0.8]].forEach(([q, y]) => q && t(x0 + 17.6, y0 + y, q, sm));
    if (I.dateDev) t(x0 + 55.3, y0 + 15.8, I.dateDev, Math.min(2.5, 9.2 / Math.max(C.tw(I.dateDev, 1), 0.1)));
    if (I.lit) String(I.lit).slice(0, 3).split('').forEach((ch, i) => t(x0 + 137.5 + 5 * i, y0 + 16.2, ch, H, 'cb'));
    t(x0 + 65 + 60, y0 + 32.5, s.code, 6, 'cm');
    const nm = String(s.name || ''), hn = Math.min(5, 66 / Math.max(C.tw(nm, 1), 1));
    t(x0 + 100, y0 + 12.5, nm, hn, 'cm');
    t(x0 + 160, y0 + 7.5, I.org, Math.min(5, 48 / Math.max(C.tw(I.org, 1), 0.1)), 'cm');
  }
  function stampForm2a(sh, f, s, nSheet) {
    const x0 = f.x1, y0 = f.y1, L = (a, b, c, d, st) => sh.line(a, b, c, d, st || 1);
    L(x0, y0 + ST2, f.x2, y0 + ST2);
    [7, 17, 40, 55, 65].forEach(dx => L(x0 + dx, y0, x0 + dx, y0 + ST2));
    L(x0, y0 + 5, x0 + 65, y0 + 5); L(x0, y0 + 10, x0 + 65, y0 + 10, 2);
    L(f.x2 - 10, y0, f.x2 - 10, y0 + ST2); L(f.x2 - 10, y0 + 8, f.x2, y0 + 8);
    [['Изм.', 0], ['Лист', 7], ['№ докум.', 17], ['Подп.', 40], ['Дата', 55]].forEach(([q, dx]) => sh.text(x0 + dx + 0.6, y0 + 0.8, q, { h: 2.5 }));
    sh.text(f.x2 - 5, y0 + 9.5, 'Лист', { h: 2.5, anchor: 'cb' }); sh.text(f.x2 - 5, y0 + 1.5, String(nSheet), { h: H, anchor: 'cb' });
    sh.text((x0 + 65 + f.x2 - 10) / 2, y0 + 7.5, String(s.code), { h: 6, anchor: 'cm' });
  }

  function sheets(spec, T) {
    const rows = rowsOf(spec);
    const top = 292, area = n => Math.floor((top - 5 - HEAD - (n === 1 ? ST1 : ST2)) / ROW);
    // разбивка по листам: заголовок раздела не остаётся последней строкой листа
    const pages = []; let i = 0;
    while (i < rows.length) {
      const cap = area(pages.length + 1); let take = Math.min(cap, rows.length - i);
      if (i + take < rows.length) { while (take > 1 && (rows[i + take - 1].title || !Object.keys(rows[i + take - 1]).length)) take--; }
      pages.push(rows.slice(i, i + take)); i += take;
    }
    if (!pages.length) pages.push([]);
    return pages.map((pg, p) => {
      const sh = new C.Sheet('A4', false), f = sh.frame, n = p + 1;
      // рамка и внешний контур листа
      sh.rect(0, 0, sh.W, sh.H, 2); sh.rect(f.x1, f.y1, f.x2, f.y2, 1);
      const yS = f.y1 + (n === 1 ? ST1 : ST2), yH = f.y2 - HEAD, cap = area(n);
      // графы: вертикальные линии через шапку и строки
      let x = f.x1; const xs = [x]; COLS.forEach(c => { x += c[1]; xs.push(x); });
      xs.slice(1, -1).forEach(xx => sh.line(xx, yS, xx, f.y2, 1));
      sh.line(f.x1, yH, f.x2, yH, 1);
      for (let r = 1; r <= cap; r++) { const y = yH - r * ROW; if (y > yS + 0.1) sh.line(f.x1, y, f.x2, y, r % 5 === 0 ? 1 : 2); }
      sh.line(f.x1, yS, f.x2, yS, 1);
      // шапка: узкие графы — надпись вертикально
      COLS.forEach((c, j) => { const cx = (xs[j] + xs[j + 1]) / 2; if (c[2]) sh.text(cx + 1.2, yH + HEAD / 2, c[0], { h: 2.5, anchor: 'cm', ang: 90 }); else sh.text(cx, yH + HEAD / 2, c[0], { h: Math.min(H, (c[1] - 2) / Math.max(C.tw(c[0], 1), 0.1)), anchor: 'cm' }); });   // надпись вписывается в ширину графы
      // строки
      pg.forEach((r, k) => {
        const yb = yH - (k + 1) * ROW + 2.2, cx = j => (xs[j] + xs[j + 1]) / 2;
        if (r.title) { const w = C.tw(r.title, H); sh.text(cx(4), yb, r.title, { h: H, anchor: 'cb' }); sh.line(cx(4) - w / 2, yb - 0.8, cx(4) + w / 2, yb - 0.8, 2); return; }
        if (r.fmt) sh.text(cx(0), yb, r.fmt, { h: Math.min(2.5, 5 / Math.max(C.tw(r.fmt, 1), 0.1)), anchor: 'cb' });
        if (r.zone) sh.text(cx(1), yb, r.zone, { h: H, anchor: 'cb' });
        if (r.pos) sh.text(cx(2), yb, r.pos, { h: H, anchor: 'cb' });
        if (r.code) { const hc = Math.min(H, 68 / Math.max(C.tw(r.code, 1), 1)); sh.text(xs[3] + 1.5, yb, r.code, { h: hc }); }
        if (r.name) sh.text(xs[4] + 1.5, yb, r.name, { h: H });
        if (r.qty) sh.text(cx(5), yb, r.qty, { h: H, anchor: 'cb' });
        if (r.note) sh.text(xs[6] + 1, yb, r.note, { h: H });
      });
      if (n === 1) stampForm2(sh, f, spec, n, pages.length, T); else stampForm2a(sh, f, spec, n);
      return { id: 'spec:' + spec.file + ':' + n, file: spec.file.replace(/\.\w+$/, '') + (pages.length > 1 ? '_' + n : '') + '.spw', isSpec: true, code: spec.code, name: spec.name + '\nСпецификация', fmt: 'A4', landscape: false, scale: pages.length > 1 ? `лист ${n} из ${pages.length}` : '', sh, specFile: spec.file };
    });
  }

  root.DRWSPEC = { sheets, rowsOf };
})(typeof window !== 'undefined' ? window : globalThis);
