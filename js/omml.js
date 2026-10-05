/* omml.js — преобразование MathML (вывод KaTeX) в Office Math Markup Language (формулы Word) */
(function (root) {
  'use strict';
  const xe = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const RPR = sz => `<w:rPr><w:rFonts w:ascii="Cambria Math" w:hAnsi="Cambria Math"/><w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/></w:rPr>`;

  function convert(mathml, opts) {
    opts = opts || {};
    const sz = opts.size || 28;
    const doc = new DOMParser().parseFromString(mathml, 'application/xml');
    const math = doc.documentElement;
    const run = (text, sty) => text === '' ? '' : `<m:r>${sty ? (sty === 'p' && /[\u0400-\u04ff]/.test(text) ? '<m:rPr><m:nor/><m:sty m:val="p"/></m:rPr>' : `<m:rPr><m:sty m:val="${sty}"/></m:rPr>`) : ''}${RPR(sz)}<m:t xml:space="preserve">${xe(text)}</m:t></m:r>`;
    const kids = el => Array.from(el.childNodes).filter(n => n.nodeType === 1);
    const seq = els => els.map(conv).join('');
    const arg = el => conv(el);

    function conv(el) {
      const tag = el.localName;
      const k = kids(el);
      switch (tag) {
        case 'math': case 'mrow': case 'mstyle': case 'mpadded': case 'mphantom':
          if (tag === 'mphantom') return '';
          return mrow(k);
        case 'semantics': return k.length ? conv(k[0]) : '';
        case 'annotation': case 'annotation-xml': return '';
        case 'mi': {
          const t = el.textContent, mv = el.getAttribute('mathvariant');
          if (mv === 'bold') return run(t, 'b');
          if (mv === 'normal' || t.length > 1 || /[\u0370-\u03ff\u0400-\u04ff]/.test(t)) return run(t, 'p');   // ГОСТ 2.304: греческие и кириллица — прямые
          return run(t);
        }
        case 'mn': return run(el.textContent, 'p');
        case 'mo': {
          const t = el.textContent;
          if (t === '⁡' || t === '⁢') return '';
          return run(t, 'p');
        }
        case 'mtext': return run(el.textContent.replace(/ /g, ' '), 'p');
        case 'ms': return run(el.textContent, 'p');
        case 'mspace': {
          const w = parseFloat(el.getAttribute('width') || '0');
          return w >= 0.9 ? run(' ', 'p') : w > 0.2 ? run(' ', 'p') : w > 0 ? run(' ', 'p') : '';
        }
        case 'msub': return `<m:sSub><m:e>${arg(k[0])}</m:e><m:sub>${arg(k[1])}</m:sub></m:sSub>`;
        case 'msup': return `<m:sSup><m:e>${arg(k[0])}</m:e><m:sup>${arg(k[1])}</m:sup></m:sSup>`;
        case 'msubsup': return `<m:sSubSup><m:e>${arg(k[0])}</m:e><m:sub>${arg(k[1])}</m:sub><m:sup>${arg(k[2])}</m:sup></m:sSubSup>`;
        case 'mfrac': {
          const lt = el.getAttribute('linethickness');
          if (lt === '0' || lt === '0px' || lt === '0em') return `<m:f><m:fPr><m:type m:val="noBar"/></m:fPr><m:num>${arg(k[0])}</m:num><m:den>${arg(k[1])}</m:den></m:f>`;
          return `<m:f><m:num>${arg(k[0])}</m:num><m:den>${arg(k[1])}</m:den></m:f>`;
        }
        case 'msqrt': return `<m:rad><m:radPr><m:degHide m:val="1"/></m:radPr><m:deg/><m:e>${mrow(k)}</m:e></m:rad>`;
        case 'mroot': return `<m:rad><m:deg>${arg(k[1])}</m:deg><m:e>${arg(k[0])}</m:e></m:rad>`;
        case 'mover': return `<m:limUpp><m:e>${arg(k[0])}</m:e><m:lim>${arg(k[1])}</m:lim></m:limUpp>`;
        case 'munder': return `<m:limLow><m:e>${arg(k[0])}</m:e><m:lim>${arg(k[1])}</m:lim></m:limLow>`;
        case 'munderover': return `<m:sSubSup><m:e>${arg(k[0])}</m:e><m:sub>${arg(k[1])}</m:sub><m:sup>${arg(k[2])}</m:sup></m:sSubSup>`;
        case 'mtable': {
          const rows = k.filter(r => r.localName === 'mtr' || r.localName === 'mlabeledtr');
          const ncol = Math.max(1, ...rows.map(r => kids(r).length));
          return `<m:m><m:mPr><m:mcs><m:mc><m:mcPr><m:count m:val="${ncol}"/><m:mcJc m:val="center"/></m:mcPr></m:mc></m:mcs></m:mPr>` +
            rows.map(r => '<m:mr>' + kids(r).map(c => `<m:e>${mrow(kids(c))}</m:e>`).join('') + '</m:mr>').join('') + '</m:m>';
        }
        case 'menclose': return mrow(k);
        default: return k.length ? mrow(k) : (el.textContent ? run(el.textContent) : '');
      }
    }
    // последовательность с распознаванием парных скобок (mo fence) -> m:d
    function mrow(list) {
      let out = '';
      for (let i = 0; i < list.length; i++) {
        const el = list[i];
        if (el.localName === 'mo' && el.getAttribute('fence') === 'true' && isOpen(el.textContent)) {
          // ищем парную закрывающую на том же уровне
          let depth = 0, j = -1;
          for (let q = i; q < list.length; q++) {
            const e = list[q];
            if (e.localName === 'mo' && e.getAttribute('fence') === 'true') {
              if (isOpen(e.textContent) && q !== i) depth++;
              else if (!isOpen(e.textContent)) { if (depth === 0) { j = q; break; } depth--; }
            }
          }
          if (j > i) {
            const beg = el.textContent, end = list[j].textContent;
            out += `<m:d><m:dPr><m:begChr m:val="${xe(beg)}"/><m:endChr m:val="${xe(end)}"/></m:dPr><m:e>${mrow(list.slice(i + 1, j))}</m:e></m:d>`;
            i = j; continue;
          }
        }
        out += conv(el);
      }
      return out;
    }
    function isOpen(t) { return '([{⟨⌊⌈'.includes(t); }
    return `<m:oMath>${conv(math)}</m:oMath>`;
  }
  root.OMML = { convert };
})(typeof window !== 'undefined' ? window : globalThis);
