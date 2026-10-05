/* docx.js — генератор документов Word (.docx): абзацы, формулы OMML, таблицы, рисунки, разделы,
   колонтитулы с номером страницы, рамка и основная надпись по ГОСТ 2.104 (формы 2 и 2а), поле оглавления */
(function (root) {
  'use strict';
  const xe = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const NS = 'xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:w10="urn:schemas-microsoft-com:office:word" xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:wne="http://schemas.microsoft.com/office/word/2006/wordml" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"';
  const MM = 56.6929;   // твипов в мм
  const tw = mm => Math.round(mm * MM);

  function Doc(opt) {
    this.opt = Object.assign({ font: 'Times New Roman', size: 28, line: 360, indent: 709, margins: { top: 20, right: 15, bottom: 20, left: 30 } }, opt || {});
    this.body = []; this.media = []; this.imgId = 0; this.hf = []; this.shapeId = 0;
  }
  Doc.prototype.runs = function (segs, base) {
    base = base || {};
    if (typeof segs === 'string') segs = [{ t: segs }];
    return segs.map(s => {
      const o = Object.assign({}, base, s);
      if (o.br) return '<w:r><w:br/></w:r>';
      if (o.tab) return '<w:r><w:tab/></w:r>';
      if (o.field) return `<w:r>${o.size ? `<w:rPr><w:sz w:val="${o.size}"/><w:szCs w:val="${o.size}"/></w:rPr>` : ''}<w:fldChar w:fldCharType="begin"/></w:r><w:r>${o.size ? `<w:rPr><w:sz w:val="${o.size}"/><w:szCs w:val="${o.size}"/></w:rPr>` : ''}<w:instrText xml:space="preserve"> ${o.field} </w:instrText></w:r><w:r>${o.size ? `<w:rPr><w:sz w:val="${o.size}"/><w:szCs w:val="${o.size}"/></w:rPr>` : ''}<w:fldChar w:fldCharType="separate"/></w:r><w:r>${o.size ? `<w:rPr><w:sz w:val="${o.size}"/><w:szCs w:val="${o.size}"/></w:rPr>` : ''}<w:t>${xe(o.t || '1')}</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r>`;
      let rpr = '';
      if (o.font) rpr += `<w:rFonts w:ascii="${o.font}" w:hAnsi="${o.font}" w:cs="${o.font}"/>`;
      if (o.b) rpr += '<w:b/><w:bCs/>';
      if (o.i) rpr += '<w:i/><w:iCs/>';
      if (o.u) rpr += '<w:u w:val="single"/>';
      if (o.caps) rpr += '<w:caps/>';
      if (o.spacing) rpr += `<w:spacing w:val="${o.spacing}"/>`;
      if (o.color) rpr += `<w:color w:val="${o.color}"/>`;
      if (o.size) rpr += `<w:sz w:val="${o.size}"/><w:szCs w:val="${o.size}"/>`;
      if (o.sub) rpr += '<w:vertAlign w:val="subscript"/>';
      if (o.sup) rpr += '<w:vertAlign w:val="superscript"/>';
      return `<w:r>${rpr ? '<w:rPr>' + rpr + '</w:rPr>' : ''}<w:t xml:space="preserve">${xe(o.t)}</w:t></w:r>`;
    }).join('');
  };
  /* простой HTML (<b>, <i>, <sub>, <sup>, <br>, <u>) -> сегменты; латинская переменная перед индексом — курсивом */
  Doc.prototype.htmlSegs = function (html) {
    const segs = [];
    html = String(html).replace(/·10\^(-?\d+)/g, (m, e) => '·10<sup>' + e.replace('-', '−') + '</sup>');
    const div = document.createElement('div'); div.innerHTML = html;
    const walk = (node, st) => {
      for (const n of node.childNodes) {
        if (n.nodeType === 3) { if (n.textContent) segs.push(Object.assign({ t: n.textContent }, st)); }
        else if (n.nodeType === 1) {
          const tg = n.tagName.toLowerCase();
          if (tg === 'br') { segs.push({ br: true }); continue; }
          const s2 = Object.assign({}, st);
          if (tg === 'b' || tg === 'strong') s2.b = true;
          if (tg === 'i' || tg === 'em') s2.i = true;
          if (tg === 'u') s2.u = true;
          if (tg === 'sub') s2.sub = true;
          if (tg === 'sup') s2.sup = true;
          walk(n, s2);
        }
      }
    };
    walk(div, {});
    const out = [];
    for (let k = 0; k < segs.length; k++) {
      const sg = segs[k], nx = segs[k + 1];
      if (sg.t && !sg.sub && !sg.sup && !sg.i && nx && (nx.sub || nx.sup)) {
        const m = sg.t.match(/(^|[^A-Za-zА-Яа-яЁё])([A-Za-z])$/);
        if (m) { const head = sg.t.slice(0, sg.t.length - 1); if (head) out.push(Object.assign({}, sg, { t: head })); out.push(Object.assign({}, sg, { t: m[2], i: true })); continue; }
      }
      out.push(sg);
    }
    return out;
  };
  Doc.prototype.pPr = function (p) {
    p = p || {};
    let s = '';
    if (p.style) s += `<w:pStyle w:val="${p.style}"/>`;
    if (p.keepNext) s += '<w:keepNext/>';
    if (p.keepLines) s += '<w:keepLines/>';
    if (p.pageBreakBefore) s += '<w:pageBreakBefore/>';
    if (p.tabs) s += '<w:tabs>' + p.tabs.map(t => `<w:tab w:val="${t.val || 'left'}"${t.leader ? ` w:leader="${t.leader}"` : ''} w:pos="${t.pos}"/>`).join('') + '</w:tabs>';
    if (p.spacing) s += `<w:spacing${p.spacing.before !== undefined ? ` w:before="${p.spacing.before}"` : ''}${p.spacing.after !== undefined ? ` w:after="${p.spacing.after}"` : ''}${p.spacing.line !== undefined ? ` w:line="${p.spacing.line}" w:lineRule="${p.spacing.rule || 'auto'}"` : ''}/>`;
    if (p.indent !== undefined || p.left !== undefined || p.right !== undefined) s += `<w:ind${p.left !== undefined ? ` w:left="${p.left}"` : ''}${p.right !== undefined ? ` w:right="${p.right}"` : ''}${p.indent !== undefined ? (p.indent >= 0 ? ` w:firstLine="${p.indent}"` : ` w:hanging="${-p.indent}"`) : ''}/>`;
    if (p.align) s += `<w:jc w:val="${p.align}"/>`;
    if (p.border) s += `<w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="000000"/></w:pBdr>`;
    if (p.sect) s += p.sect;
    return s ? '<w:pPr>' + s + '</w:pPr>' : '';
  };
  Doc.prototype.p = function (content, p, base) {
    const inner = typeof content === 'string' || Array.isArray(content) ? this.runs(content, base) : (content.xml || '');
    this.body.push(`<w:p>${this.pPr(p)}${inner}</w:p>`); return this;
  };
  Doc.prototype.html = function (html, p, base) { return this.p(this.htmlSegs(html), p, base); };
  Doc.prototype.raw = function (xml) { this.body.push(xml); return this; };
  Doc.prototype.pageBreak = function () { this.body.push('<w:p><w:r><w:br w:type="page"/></w:r></w:p>'); return this; };
  Doc.prototype.math = function (omml, p) {
    this.body.push(`<w:p>${this.pPr(Object.assign({ indent: 0, align: 'center', spacing: { before: 120, after: 120 } }, p || {}))}<m:oMathPara><m:oMathParaPr><m:jc m:val="center"/></m:oMathParaPr>${omml}</m:oMathPara></w:p>`); return this;
  };
  /* формула по центру с номером у правого края (ГОСТ 2.105): таблица без границ */
  Doc.prototype.mathNum = function (omml, num, keepNext) {
    const W = this.textW();
    const nb = '<w:tblBorders><w:top w:val="nil"/><w:left w:val="nil"/><w:bottom w:val="nil"/><w:right w:val="nil"/><w:insideH w:val="nil"/><w:insideV w:val="nil"/></w:tblBorders>';
    const kn = keepNext ? '<w:keepNext/>' : '';
    this.body.push(`<w:tbl><w:tblPr><w:tblW w:w="${W}" w:type="dxa"/>${nb}<w:tblLayout w:type="fixed"/><w:tblCellMar><w:left w:w="0" w:type="dxa"/><w:right w:w="0" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid><w:gridCol w:w="${W - 900}"/><w:gridCol w:w="900"/></w:tblGrid><w:tr><w:trPr><w:cantSplit/></w:trPr>` +
      `<w:tc><w:tcPr><w:tcW w:w="${W - 900}" w:type="dxa"/><w:vAlign w:val="center"/></w:tcPr><w:p><w:pPr>${kn}<w:spacing w:before="120" w:after="120" w:line="240" w:lineRule="auto"/><w:ind w:firstLine="0"/><w:jc w:val="center"/></w:pPr><m:oMathPara><m:oMathParaPr><m:jc m:val="center"/></m:oMathParaPr>${omml}</m:oMathPara></w:p></w:tc>` +
      `<w:tc><w:tcPr><w:tcW w:w="900" w:type="dxa"/><w:vAlign w:val="center"/></w:tcPr><w:p><w:pPr>${kn}<w:spacing w:line="240" w:lineRule="auto"/><w:ind w:firstLine="0"/><w:jc w:val="right"/></w:pPr>${this.runs('(' + num + ')')}</w:p></w:tc></w:tr></w:tbl>`);
    return this;
  };
  Doc.prototype.textW = function () { const m = this.opt.margins; return tw(210 - m.left - m.right); };
  /* таблица: head — массив строк/HTML, rows — массив массивов */
  Doc.prototype.table = function (head, rows, opt) {
    opt = opt || {};
    const W = opt.width || this.textW();
    const ncol = Math.max(head ? head.length : 0, ...rows.map(r => r.length));
    const cw = opt.cols || new Array(ncol).fill(Math.floor(W / ncol));
    const B = (v, sz) => `w:val="${v}" w:sz="${sz || 4}" w:space="0" w:color="000000"`;
    const border = `<w:tblBorders><w:top ${B('single')}/><w:left ${B('single')}/><w:bottom ${B('single')}/><w:right ${B('single')}/><w:insideH ${B('single')}/><w:insideV ${B('single')}/></w:tblBorders>`;
    let x = `<w:tbl><w:tblPr><w:tblW w:w="${cw.reduce((a, b) => a + b, 0)}" w:type="dxa"/><w:jc w:val="center"/>${border}<w:tblLayout w:type="fixed"/><w:tblCellMar><w:left w:w="80" w:type="dxa"/><w:right w:w="80" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>${cw.map(w => `<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid>`;
    const size = opt.size || 24;
    const cell = (c, k, hdr, last) => {
      const isO = c && typeof c === 'object' && c.omml;
      const segs = isO ? null : this.htmlSegs(String(c === undefined || c === null ? '' : c));
      const content = segs ? this.runs(segs, { size }) : '';
      const al = hdr ? '<w:jc w:val="center"/>' : (opt.align && opt.align[k] ? `<w:jc w:val="${opt.align[k]}"/>` : '');
      const para = isO ? `<w:p><w:pPr><w:pStyle w:val="TableText"/>${al}</w:pPr>${c.omml}</w:p>` : `<w:p><w:pPr><w:pStyle w:val="TableText"/>${al}</w:pPr>${content}</w:p>`;
      const bb = hdr && last ? `<w:tcBorders><w:bottom ${B('double', 6)}/></w:tcBorders>` : '';
      return `<w:tc><w:tcPr><w:tcW w:w="${cw[k]}" w:type="dxa"/>${bb}<w:vAlign w:val="center"/></w:tcPr>${para}</w:tc>`;
    };
    if (head) x += `<w:tr><w:trPr><w:tblHeader/><w:cantSplit/><w:trHeight w:val="${tw(5)}"/></w:trPr>${head.map((c, k) => cell(c, k, true, true)).join('')}</w:tr>`;
    for (const r of rows) { const rr = r.slice(); while (rr.length < ncol) rr.push(''); x += `<w:tr><w:trPr><w:cantSplit/><w:trHeight w:val="${tw(opt.rowH || 5)}"/></w:trPr>${rr.map((c, k) => cell(c, k, false)).join('')}</w:tr>`; }
    x += '</w:tbl>';
    this.body.push(x);
    if (!opt.noGap) this.body.push('<w:p><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr></w:p>');
    return this;
  };
  Doc.prototype.imageRun = function (data, type, wcm, hcm) {
    const id = ++this.imgId, rid = 'rIdImg' + id, name = `image${id}.${type === 'jpeg' ? 'jpeg' : 'png'}`;
    this.media.push({ rid, name, data });
    const cx = Math.round(wcm * 360000), cy = Math.round(hcm * 360000);
    return `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:docPr id="${id}" name="Рисунок ${id}"/><wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="${id}" name="${name}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
  };
  Doc.prototype.image = function (data, type, wcm, hcm, p) {
    this.body.push(`<w:p>${this.pPr(Object.assign({ align: 'center', indent: 0, keepNext: true, spacing: { before: 240, after: 0, line: 240 } }, p || {}))}${this.imageRun(data, type, wcm, hcm)}</w:p>`); return this;
  };
  /* поле оглавления: Word обновит его при открытии (updateFields) */
  Doc.prototype.toc = function (entries) {
    const tabs = [{ val: 'right', leader: 'dot', pos: this.textW() }];
    const pr = (lvl) => this.pPr({ style: 'TOC' + lvl, tabs, indent: 0, left: (lvl - 1) * 280 });
    let x = `<w:p>${pr(1)}<w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> TOC \\o "1-3" \\h \\z \\u </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r>`;
    entries.forEach((e, k) => {
      if (k > 0) x += `<w:p>${pr(e.lvl)}`;
      x += this.runs(e.t) + '<w:r><w:tab/></w:r>' + this.runs(String(e.page || ''));
      x += k === entries.length - 1 ? '<w:r><w:fldChar w:fldCharType="end"/></w:r></w:p>' : '</w:p>';
    });
    if (!entries.length) x += '<w:r><w:fldChar w:fldCharType="end"/></w:r></w:p>';
    this.body.push(x); return this;
  };

  /* ---------- колонтитулы, рамка, основная надпись ---------- */
  Doc.prototype.addHF = function (type, inner) { const id = 'rIdHF' + (this.hf.length + 1); this.hf.push({ id, type, file: `${type}${this.hf.length + 1}.xml`, inner }); return id; };
  const cellP = (doc, txt, o) => {
    o = o || {};
    const size = o.size || 18, al = o.align || 'center';
    const run = o.field ? doc.runs([{ field: o.field, t: o.t || '1', size }]) : doc.runs(String(txt || ''), { size, i: !!o.i, b: !!o.b });
    return `<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/><w:ind w:left="0" w:right="0" w:firstLine="0"/><w:jc w:val="${al}"/></w:pPr>${run}</w:p>`;
  };
  /* таблица основной надписи: grid — ширины колонок (мм), rows — [{h (мм), cells: [{span, vmerge: 'restart'|'cont', t, o, bTop...}]}] */
  function stampTable(doc, grid, rows, indentMm) {
    const thick = 'w:val="single" w:sz="12" w:space="0" w:color="000000"', thin = 'w:val="single" w:sz="4" w:space="0" w:color="000000"';
    let x = `<w:tbl><w:tblPr><w:tblW w:w="${tw(grid.reduce((a, b) => a + b, 0))}" w:type="dxa"/><w:tblInd w:w="${tw(indentMm)}" w:type="dxa"/><w:tblBorders><w:top ${thick}/><w:left ${thick}/><w:bottom ${thick}/><w:right ${thick}/><w:insideH ${thin}/><w:insideV ${thick}/></w:tblBorders><w:tblLayout w:type="fixed"/><w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="20" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:right w:w="20" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>${grid.map(g => `<w:gridCol w:w="${tw(g)}"/>`).join('')}</w:tblGrid>`;
    for (const r of rows) {
      x += `<w:tr><w:trPr><w:cantSplit/><w:trHeight w:val="${tw(r.h)}" w:hRule="exact"/></w:trPr>`;
      let col = 0;
      for (const c of r.cells) {
        const span = c.span || 1, w = grid.slice(col, col + span).reduce((a, b) => a + b, 0);
        col += span;
        let pr = `<w:tcW w:w="${tw(w)}" w:type="dxa"/>`;
        if (span > 1) pr += `<w:gridSpan w:val="${span}"/>`;
        if (c.vmerge) pr += c.vmerge === 'restart' ? '<w:vMerge w:val="restart"/>' : '<w:vMerge/>';
        if (c.thickBottom) pr += `<w:tcBorders><w:bottom ${thick}/></w:tcBorders>`;
        pr += `<w:vAlign w:val="${c.valign || 'center'}"/>`;
        x += `<w:tc><w:tcPr>${pr}</w:tcPr>${cellP(doc, c.t, c.o)}</w:tc>`;
      }
      x += '</w:tr>';
    }
    return x + '</w:tbl>';
  }
  /* форма 2 (первый лист текстового документа), 185×40 мм */
  Doc.prototype.stamp2 = function (st) {
    const g = [7, 10, 23, 15, 10, 70, 5, 5, 5, 15, 20];   // 185 мм
    const s = (t, o) => ({ t, o: Object.assign({ size: 16 }, o || {}) });
    const roleRow = (role, name, extra) => ({ h: 5, cells: [Object.assign({ span: 2 }, s(role, { align: 'left' })), s(name, { align: 'left' }), s(''), s('')].concat(extra) });
    const rows = [
      { h: 5, cells: [s(''), s(''), s(''), s(''), s(''), { span: 6, vmerge: 'restart', t: st.code, o: { size: 28 } }] },
      { h: 5, cells: [s(''), s(''), s(''), s(''), s(''), { span: 6, vmerge: 'cont' }] },
      { h: 5, cells: [s('Изм.'), s('Лист'), s('№ докум.'), s('Подп.'), s('Дата'), { span: 6, vmerge: 'cont' }] },
      roleRow('Разраб.', st.dev, [{ vmerge: 'restart', t: st.name, o: { size: 24 } }, { span: 3, t: 'Лит.', o: { size: 16 } }, s('Лист'), s('Листов')]),
      roleRow('Пров.', st.chk, [{ vmerge: 'cont' }, s('У'), s(''), s(''), { t: '', o: { field: 'PAGE', size: 16 } }, { t: '', o: { field: 'NUMPAGES', size: 16 } }]),
      roleRow('Т. контр.', '', [{ vmerge: 'cont' }, { span: 5, vmerge: 'restart', t: st.org, o: { size: 24 } }]),
      roleRow('Н. контр.', st.norm, [{ vmerge: 'cont' }, { span: 5, vmerge: 'cont' }]),
      roleRow('Утв.', st.appr || '', [{ vmerge: 'cont' }, { span: 5, vmerge: 'cont' }])
    ];
    return stampTable(this, g, rows, -(this.opt.margins.left - 20));
  };
  /* форма 2а (последующие листы), 185×15 мм */
  Doc.prototype.stamp2a = function (st) {
    const g = [7, 10, 23, 15, 10, 110, 10];
    const s = (t, o) => ({ t, o: Object.assign({ size: 16 }, o || {}) });
    const rows = [
      { h: 5, cells: [s(''), s(''), s(''), s(''), s(''), { vmerge: 'restart', t: st.code, o: { size: 28 } }, s('Лист')] },
      { h: 5, cells: [s(''), s(''), s(''), s(''), s(''), { vmerge: 'cont' }, { vmerge: 'restart', t: '', o: { field: 'PAGE', size: 22 } }] },
      { h: 5, cells: [s('Изм.'), s('Лист'), s('№ докум.'), s('Подп.'), s('Дата'), { vmerge: 'cont' }, { vmerge: 'cont' }] }
    ];
    return stampTable(this, g, rows, -(this.opt.margins.left - 20));
  };
  /* рамка листа (20 мм слева, 5 мм с остальных сторон) — фигура VML в верхнем колонтитуле */
  Doc.prototype.frameHeader = function () {
    const id = ++this.shapeId;
    return `<w:p><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/><w:ind w:firstLine="0"/></w:pPr><w:r><w:pict><v:rect id="frame${id}" o:spid="_x0000_s${1024 + id}" style="position:absolute;margin-left:20mm;margin-top:5mm;width:185mm;height:287mm;z-index:-251657216;mso-position-horizontal-relative:page;mso-position-vertical-relative:page" filled="f" strokecolor="black" strokeweight="1.5pt"/></w:pict></w:r></w:p>`;
  };
  Doc.prototype.footerNum = function () { return `<w:p><w:pPr><w:ind w:firstLine="0"/><w:jc w:val="center"/></w:pPr>${this.runs([{ field: 'PAGE', t: '2', size: 22 }])}</w:p>`; };
  /* разрыв раздела: sect = { hdr: {def, first}, ftr: {def, first}, titlePg, footerMm, margins } */
  Doc.prototype.sectPr = function (o) {
    o = o || {};
    const m = o.margins || this.opt.margins;
    let x = '<w:sectPr>';
    if (o.hdr) { if (o.hdr.def) x += `<w:headerReference w:type="default" r:id="${o.hdr.def}"/>`; if (o.hdr.first) x += `<w:headerReference w:type="first" r:id="${o.hdr.first}"/>`; }
    if (o.ftr) { if (o.ftr.def) x += `<w:footerReference w:type="default" r:id="${o.ftr.def}"/>`; if (o.ftr.first) x += `<w:footerReference w:type="first" r:id="${o.ftr.first}"/>`; }
    x += `<w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="${tw(m.top)}" w:right="${tw(m.right)}" w:bottom="${tw(m.bottom)}" w:left="${tw(m.left)}" w:header="${tw(o.headerMm !== undefined ? o.headerMm : 10)}" w:footer="${tw(o.footerMm !== undefined ? o.footerMm : 10)}" w:gutter="0"/><w:cols w:space="708"/>`;
    if (o.titlePg) x += '<w:titlePg/>';
    return x + '</w:sectPr>';
  };
  Doc.prototype.sectionBreak = function (o) { this.body.push(`<w:p>${this.pPr({ sect: this.sectPr(o), spacing: { after: 0, line: 240 } })}</w:p>`); return this; };

  Doc.prototype.styles = function () {
    const o = this.opt;
    const hd = (id, name, lvl, ppr, rpr) => `<w:style w:type="paragraph" w:styleId="${id}"><w:name w:val="${name}"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:keepLines/>${ppr}<w:outlineLvl w:val="${lvl}"/></w:pPr><w:rPr>${rpr}</w:rPr></w:style>`;
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="${o.font}" w:eastAsia="${o.font}" w:hAnsi="${o.font}" w:cs="${o.font}"/><w:sz w:val="${o.size}"/><w:szCs w:val="${o.size}"/><w:lang w:val="ru-RU" w:eastAsia="en-US" w:bidi="ar-SA"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="0" w:line="${o.line}" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/><w:pPr><w:widowControl/><w:spacing w:after="0" w:line="${o.line}" w:lineRule="auto"/><w:ind w:firstLine="${o.indent}"/><w:jc w:val="both"/></w:pPr></w:style>
${hd('Heading1', 'heading 1', 0, `<w:pageBreakBefore/><w:spacing w:before="0" w:after="360"/><w:ind w:firstLine="${o.indent}"/><w:jc w:val="left"/>`, '<w:b/><w:bCs/>')}
${hd('Heading2', 'heading 2', 1, `<w:spacing w:before="360" w:after="360"/><w:ind w:firstLine="${o.indent}"/><w:jc w:val="left"/>`, '<w:b/><w:bCs/>')}
${hd('Heading3', 'heading 3', 2, `<w:spacing w:before="240" w:after="240"/><w:ind w:firstLine="${o.indent}"/><w:jc w:val="left"/>`, '<w:b/><w:bCs/>')}
${hd('StructHead', 'Struct Heading', 0, '<w:pageBreakBefore/><w:spacing w:before="0" w:after="360"/><w:ind w:firstLine="0"/><w:jc w:val="center"/>', '<w:b/><w:bCs/>')}
<w:style w:type="paragraph" w:customStyle="1" w:styleId="TocHead"><w:name w:val="Toc Heading Plain"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="0" w:after="360"/><w:ind w:firstLine="0"/><w:jc w:val="center"/></w:pPr><w:rPr><w:b/><w:bCs/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="TOC1"><w:name w:val="toc 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:pPr><w:ind w:firstLine="0"/><w:jc w:val="left"/></w:pPr></w:style>
<w:style w:type="paragraph" w:styleId="TOC2"><w:name w:val="toc 2"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:pPr><w:ind w:left="280" w:firstLine="0"/><w:jc w:val="left"/></w:pPr></w:style>
<w:style w:type="paragraph" w:styleId="TOC3"><w:name w:val="toc 3"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:pPr><w:ind w:left="560" w:firstLine="0"/><w:jc w:val="left"/></w:pPr></w:style>
<w:style w:type="paragraph" w:styleId="Caption"><w:name w:val="caption"/><w:basedOn w:val="Normal"/><w:qFormat/><w:pPr><w:keepLines/><w:spacing w:before="120" w:after="240" w:line="${o.line}" w:lineRule="auto"/><w:ind w:firstLine="0"/><w:jc w:val="center"/></w:pPr></w:style>
<w:style w:type="paragraph" w:customStyle="1" w:styleId="TableCaption"><w:name w:val="Table Caption"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/><w:keepLines/><w:spacing w:before="240" w:after="60" w:line="${o.line}" w:lineRule="auto"/><w:ind w:firstLine="0"/><w:jc w:val="left"/></w:pPr></w:style>
<w:style w:type="paragraph" w:customStyle="1" w:styleId="TableText"><w:name w:val="Table Text"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/><w:ind w:firstLine="0"/><w:jc w:val="left"/></w:pPr><w:rPr><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr></w:style>
<w:style w:type="paragraph" w:customStyle="1" w:styleId="Where"><w:name w:val="Where"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="0" w:line="${o.line}" w:lineRule="auto"/><w:ind w:left="0" w:firstLine="0"/><w:jc w:val="left"/></w:pPr></w:style>
<w:style w:type="paragraph" w:customStyle="1" w:styleId="Code"><w:name w:val="Code"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/><w:ind w:firstLine="0"/><w:jc w:val="left"/></w:pPr><w:rPr>${o.codePlain ? '<w:sz w:val="24"/><w:szCs w:val="24"/>' : '<w:rFonts w:ascii="Courier New" w:hAnsi="Courier New" w:cs="Courier New"/><w:sz w:val="20"/><w:szCs w:val="20"/>'}</w:rPr></w:style>
<w:style w:type="table" w:default="1" w:styleId="TableNormal"><w:name w:val="Normal Table"/><w:tblPr><w:tblInd w:w="0" w:type="dxa"/><w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="108" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:right w:w="108" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style>
</w:styles>`;
  };
  Doc.prototype.build = async function (meta, finalSect) {
    meta = meta || {};
    const zip = new JSZip();
    const hasJpeg = this.media.some(m => m.name.endsWith('.jpeg'));
    const hfOv = this.hf.map(h => `<Override PartName="/word/${h.file}" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.${h.type}+xml"/>`).join('');
    zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/>${hasJpeg ? '<Default Extension="jpeg" ContentType="image/jpeg"/>' : ''}<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>${hfOv}<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`);
    zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`);
    const now = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
    zip.file('docProps/core.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${xe(meta.title || 'Пояснительная записка')}</dc:title><dc:creator>${xe(meta.author || '')}</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified></cp:coreProperties>`);
    zip.file('docProps/app.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Microsoft Office Word</Application></Properties>`);
    zip.file('word/_rels/document.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rIdSettings" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>${this.hf.map(h => `<Relationship Id="${h.id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/${h.type}" Target="${h.file}"/>`).join('')}${this.media.map(m => `<Relationship Id="${m.rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${m.name}"/>`).join('')}</Relationships>`);
    zip.file('word/styles.xml', this.styles());
    zip.file('word/settings.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math">${meta.updateFields ? '<w:updateFields w:val="true"/>' : ''}<w:defaultTabStop w:val="708"/><w:autoHyphenation/><w:characterSpacingControl w:val="doNotCompress"/><w:compat><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat><m:mathPr><m:mathFont m:val="Cambria Math"/><m:brkBin m:val="before"/><m:brkBinSub m:val="--"/><m:smallFrac m:val="0"/><m:dispDef/><m:lMargin m:val="0"/><m:rMargin m:val="0"/><m:defJc m:val="centerGroup"/><m:wrapIndent m:val="1440"/><m:intLim m:val="subSup"/><m:naryLim m:val="undOvr"/></m:mathPr></w:settings>`);
    const HFNS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w10="urn:schemas-microsoft-com:office:word"';
    for (const h of this.hf) zip.file('word/' + h.file, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:${h.type === 'header' ? 'hdr' : 'ftr'} ${HFNS}>${h.inner}</w:${h.type === 'header' ? 'hdr' : 'ftr'}>`);
    for (const m of this.media) zip.file('word/media/' + m.name, m.data, { base64: true });
    zip.file('word/document.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document ${NS}><w:body>${this.body.join('')}${this.sectPr(finalSect || {})}</w:body></w:document>`);
    return zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', compression: 'DEFLATE' });
  };
  root.DOCX = { Doc, tw };
})(typeof window !== 'undefined' ? window : globalThis);
