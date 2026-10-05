/* report.js — пояснительная записка курсового проекта (.docx) по требованиям КНИТУ 2023 / ГОСТ 2.105, 2.106, 7.32, 2.304 */
(function (root) {
  'use strict';
  const LOGO = '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';
  const D = () => root.DATA, M = () => root.MECH;
  const PARTS = { kin: 'Исходные данные и кинематический расчёт', mat: 'Материалы и допускаемые напряжения', gear: 'Расчёт передач', shaft: 'Валы, колёса, корпус, компоновка', check: 'Проверочные расчёты', other: 'Посадки, смазка, муфта' };

  /* ---------- обозначения в тексте (ГОСТ 2.304: латинские переменные — курсивом, индексы и кириллица — прямо) ---------- */
  function symHtml(t) {
    return String(t).replace(/(^|[^A-Za-zА-Яа-яЁё0-9<>\/])([A-Za-z])(?=<sub>|<sup>)/g, '$1<i>$2</i>');
  }
  const lc = t => { t = String(t); return /^[А-ЯЁ][а-яё]/.test(t) ? t.charAt(0).toLowerCase() + t.slice(1) : t; };
  const plain = s => String(s).replace(/<[^>]+>/g, '');

  /* ---------- перенос длинных формул (по знаку «=» с повторением) ---------- */
  const LIMIT = 560;
  function splitTop(t, ch) {
    const out = []; let depth = 0, cur = '';
    for (let i = 0; i < t.length; i++) {
      const c = t[i];
      if (c === '{') depth++; else if (c === '}') depth--;
      if (c === ch && depth === 0 && t[i - 1] !== '\\') { out.push(cur); cur = ''; } else cur += c;
    }
    out.push(cur); return out;
  }
  function fitMath(tex, ctx) {
    const W = x => ctx.measure(x);
    if (W(tex) <= LIMIT) return [{ t: tex, size: 28 }];
    const parts = splitTop(tex, '=');
    const lines = []; let cur = parts[0];
    for (let k = 1; k < parts.length; k++) {
      const p = parts[k], cand = cur + '=' + p;
      if (W(cand) <= LIMIT) cur = cand; else { lines.push(cur); cur = '=' + p; }
    }
    lines.push(cur);
    return lines.map(t => ({ t, size: W(t) > LIMIT ? Math.max(18, Math.floor(28 * LIMIT / W(t))) : 28 }));
  }

  /* ---------- «где …»: пояснения новых обозначений под формулой ---------- */
  const ONE = ['L', 'q', 'm', 'K', 't', 'h', 'b', 'V', 'X', 'Y', 'e', 'E', 'x'];
  function symsIn(f, lhs) {
    const SYM = M().SYM, out = [];
    for (const k of Object.keys(SYM)) {
      if (k === lhs) continue;
      let idx = -1;
      if (ONE.includes(k)) { const re = new RegExp('(^|[^A-Za-z\\\\{_])' + k + '(?![A-Za-z_{])'); const m = re.exec(f); if (m) idx = m.index + m[1].length; }
      else { idx = f.indexOf(k); if (idx >= 0 && /^[A-Za-z]$/.test(k.charAt(0)) && idx > 0 && /[A-Za-z\\]/.test(f.charAt(idx - 1))) idx = -1; if (idx >= 0) { const nx = f.charAt(idx + k.length); if (/[A-Za-z]/.test(nx) && !/\}$/.test(k)) idx = -1; } }
      if (idx >= 0) out.push({ k, idx });
    }
    // убрать символы, являющиеся частью более длинных найденных (например, t в t_{1})
    const res = out.filter(a => !out.some(b => b !== a && b.k.length > a.k.length && b.idx <= a.idx && a.idx < b.idx + b.k.length));
    return res.sort((a, b) => a.idx - b.idx).map(x => x.k);
  }

  /* ---------- титульный лист, задание, лист нормоконтролёра ---------- */
  const C = { align: 'center', indent: 0, spacing: { line: 240 } };
  function titlePage(doc, ctx, T) {
    const P = ctx.S.P, task = ctx.D.TASKS[P.task];
    if (T.logo) doc.image(LOGO, 'jpeg', 1.4, 1.3, { spacing: { before: 0, after: 60, line: 240 }, keepNext: false });
    String(T.org || '').split('\n').forEach((l, k, a) => doc.p(l, Object.assign({}, C, k === a.length - 1 ? { border: true, spacing: { line: 240, after: 240 } } : {})));
    const ul = (lab, val, after) => doc.p([{ t: lab + ' ' }, { t: val || ' '.repeat(40), u: true }], { indent: 0, align: 'left', spacing: { line: 240, before: 200, after: after || 0 } });
    ul('Кафедра', T.dept || 'ОКПМ');
    ul('Дисциплина', T.discipline || '');
    ul('Тема курсового проекта', T.topic || task.title, 120);
    doc.p('', { indent: 0, border: true, spacing: { line: 240, after: 0 } });
    doc.p([{ t: 'КУРСОВОЙ ПРОЕКТ', b: true, size: 32 }], { align: 'center', indent: 0, spacing: { before: 1500, after: 240, line: 240 } });
    doc.p([{ t: (T.code || ctx.codeDefault()) + ' 00.00.00 ПЗ', u: true }], C);
    doc.p([{ t: '(обозначение проекта, работы)', size: 18 }], C);
    const sig = (lab, mid, name, before) => {
      doc.p([{ t: lab }, { tab: true }, { t: mid }, { tab: true }, { t: '_______________' }, { tab: true }, { t: '/ ' }, { t: name || '                    ', u: !!name }, { t: ' /' }], { indent: 0, align: 'left', spacing: { before: before || 600, line: 240 }, tabs: [{ pos: 3000 }, { pos: 4300 }, { pos: 6600 }] });
      doc.p([{ tab: true }, { tab: true }, { t: '(подпись)', size: 16 }, { tab: true }, { t: '(дата)', size: 16 }], { indent: 0, spacing: { line: 240 }, tabs: [{ pos: 3000 }, { pos: 4800 }, { pos: 6000 }] });
    };
    sig('Руководитель проекта', '', T.teacher, 1500);
    doc.p([{ t: 'Студент группы  № ' }, { t: T.group || '________', u: !!T.group }, { tab: true }, { t: '_______________' }, { tab: true }, { t: '/ ' }, { t: T.student || '                    ', u: !!T.student }, { t: ' /' }], { indent: 0, align: 'left', spacing: { before: 600, line: 240 }, tabs: [{ pos: 4300 }, { pos: 6600 }] });
    doc.p([{ t: '(№ группы)', size: 16 }, { tab: true }, { t: '(подпись)', size: 16 }, { tab: true }, { t: '(дата)', size: 16 }], { indent: 2300, spacing: { line: 240 }, tabs: [{ pos: 4800 }, { pos: 6000 }] });
    sig('Нормоконтролер', '', T.normo, 600);
    doc.p((T.city || 'Казань') + ' ' + (T.year || new Date().getFullYear()) + ' г.', { align: 'center', indent: 0, spacing: { before: 1800, line: 240 } });
  }
  function taskPage(doc, ctx, T) {
    const P = ctx.S.P, R = ctx.S.R, task = ctx.D.TASKS[P.task], f = ctx.F.fnum;
    doc.p([{ t: 'ЗАДАНИЕ', b: true }], { align: 'center', indent: 0, pageBreakBefore: true, spacing: { line: 240, after: 240 } });
    const L = (segs, o) => doc.p(segs, Object.assign({ indent: 0, align: 'left', spacing: { line: 300, before: 60 } }, o || {}));
    L([{ t: 'на курсовой проект (работу) по кафедре  ' }, { t: T.dept || 'ОКПМ', u: true }]);
    L([{ t: 'студента ' }, { t: T.student || '______________________________', u: !!T.student }, { t: '   группы № ' }, { t: T.group || '__________', u: !!T.group }]);
    L([{ t: 'Тема работы: ' }, { t: T.topic || task.title, u: true }], { indent: 709 });
    L([{ t: 'Исходные данные к проекту (работе): ' }, { t: `мощность на выходном валу ${f(P.Pout, 0)} кВт; частота вращения выходного вала ${f(P.nout, 0)} мин⁻¹; срок службы ${P.L} лет; Kг = ${f(P.Kg, 0)}; Kсут = ${f(P.Kc, 0)}; режим нагружения — по графику нагрузки (${P.load.map(([k, t]) => (k === 1 ? '' : f(k, 0)) + 'T — ' + f(t, 0) + 'tΣ').join('; ')}).`, u: true }], { indent: 709 });
    L([{ t: 'согласно выданному заданию № ' }, { t: `${P.task}, вариант ${P.v}: ${task.full.replace(/^Спроектировать/, 'спроектировать')}`, u: true }]);
    L([{ t: 'Содержание расчётно-пояснительной записки (включая перечень подлежащих разработке вопросов, включая вопросы стандартизации и контроля качества): ' }, { t: 'выбор электродвигателя и кинематический расчёт привода; расчёт передач; ориентировочный расчёт валов; конструирование колёс, валов и корпуса; проверка прочности валов; подбор и проверка шпонок и подшипников; посадки; смазка; подбор муфты' + (P.task === 6 ? '; расчёт вала конвейера с барабаном' : '') + '.', u: true }], { indent: 709 });
    L([{ t: 'Перечень графического материала (схемной документации): ' }, { t: task.drawings.join('; ') + '.', u: true }], { indent: 709 });
    L([{ t: 'Консультанты по проекту (с указанием относящихся к ним разделам): ' }, { t: '                                                                  ', u: true }], { indent: 709 });
    L([{ t: 'Дата выдачи задания:  «___» __________ 20___ г.' }], { indent: 709, spacing: { before: 600, line: 240 } });
    L([{ t: 'Руководитель проекта  _______________  ( ' }, { t: T.teacher || '_______________', u: !!T.teacher }, { t: ' )' }], { indent: 709, spacing: { before: 400, line: 240 } });
    L([{ t: 'Задание принято к исполнению  «___» __________ 20___ г.' }], { indent: 709, spacing: { before: 200, line: 240 } });
    L([{ t: 'Студент  _______________  ( ' }, { t: T.student || '_______________', u: !!T.student }, { t: ' )' }], { indent: 709, spacing: { before: 400, line: 240 } });
    L([{ t: 'Примечание 1. Оформление документации к проекту согласно требованиям ЕСКД, ЕСТД, ЕСТПП', size: 24 }], { spacing: { before: 600, line: 240 } });
  }
  function normoPage(doc, ctx, T) {
    doc.p([{ t: 'ЛИСТ НОРМОКОНТРОЛЕРА', b: true }], { align: 'center', indent: 0, pageBreakBefore: true, spacing: { line: 240, after: 120 } });
    ['Лист является обязательным приложением к пояснительной записке курсового проекта.', 'Нормоконтролер имеет право возвращать документацию без рассмотрения в случаях:'].forEach((t, k) => doc.p((k + 1) + '. ' + t, { indent: 0, align: 'both', spacing: { line: 300 } }));
    ['нарушения установленной комплектности;', 'отсутствия обязательных подписей;', 'нечеткого выполнения текстового и графического материала.'].forEach(t => doc.p('– ' + t, { left: 1200, indent: 0, spacing: { line: 300 } }));
    doc.p('3. Устранение ошибок, указанных нормоконтролером, обязательно.', { indent: 0, spacing: { line: 300 } });
    doc.p([{ t: 'ПЕРЕЧЕНЬ', b: true }], { align: 'center', indent: 0, spacing: { before: 360, line: 240 } });
    doc.p('замечаний и предложений нормоконтролера по курсовому проекту студента:', C);
    doc.p([{ t: ((T.group ? T.group + ', ' : '') + (T.student || '')) || ' ', u: true }], C);
    doc.p([{ t: '(группа, инициалы, фамилия)', size: 16 }], Object.assign({}, C, { spacing: { line: 240, after: 120 } }));
    doc.table(['Лист (страница)', 'Условное обозначение (код ошибок)', 'Содержание замечаний и предложений со ссылкой на нормативный документ, стандарт или типовую документацию'], [['', '', '']], { cols: [1300, 1900, 6154], rowH: 120, noGap: true });
    doc.p([{ t: 'Дата ___________   Нормоконтролер  ' }, { t: T.normo || '______________________', u: !!T.normo }], { indent: 0, spacing: { before: 600, line: 240 } });
    doc.p([{ t: '(подпись)                (фамилия, инициалы)', size: 16 }], { indent: 0, left: 4600, spacing: { line: 240 } });
  }

  /* ---------- основное содержание ---------- */
  function Ctx(ctx, T) {
    const st = { eq: 0, tab: 0, fig: 0, refs: [], explained: new Set(), figNums: {}, figRef: new Set() };
    st.refNo = k => { let i = st.refs.indexOf(k); if (i < 0) { st.refs.push(k); i = st.refs.length - 1; } return i + 1; };
    st.text = (t, sec) => {
      let s = String(t).replace(/\[\[(\w+)\|([^\]]*)\]\]/g, (m, k, w) => `[${st.refNo(k)}, ${w}]`);
      s = s.replace(/\{fig:(\w+)\}/g, (m, id) => { st.figRef.add(id); return st.figNums[id] || '?'; });
      return symHtml(s);
    };
    return st;
  }
  function addItems(doc, items, ctx, T, st) {
    const f = ctx.F, readable = T.readable !== false;
    for (let ii = 0; ii < items.length; ii++) {
      const it = items[ii];
      if (it.web) continue;
      const next = items[ii + 1];
      switch (it.k) {
        case 'h': {
          const style = it.lvl === 1 ? 'Heading1' : it.lvl === 3 ? 'Heading3' : 'Heading2';
          doc.p(it.no + ' ' + it.t, { style });
          break;
        }
        case 'p': {
          const t = st.text(it.t);
          const kn = readable && next && (next.k === 'eq' || next.k === 'list' || next.k === 'table' || next.k === 'fig') && /:\s*$/.test(plain(t));
          doc.html(t, kn ? { keepNext: true } : undefined);
          break;
        }
        case 'list':
          it.lines.forEach((l, k) => doc.html('– ' + st.text(String(l).replace(/[;.]\s*$/, '')) + (k === it.lines.length - 1 ? '.' : ';'), readable && k < it.lines.length - 1 && it.lines.length <= 8 ? { keepNext: true } : undefined));
          break;
        case 'note': break;
        case 'tex': doc.math(ctx.omml(it.t, false, 28)); break;
        case 'eq': emitEq(doc, it, ctx, T, st); break;
        case 'check': {
          const ok = it.ok, t = it.t ? lc(st.text(it.t)).replace(/\.?\s*$/, '.') : (ok ? 'условие выполняется.' : 'условие не выполняется.');
          doc.raw(`<w:p>${doc.pPr({})}${doc.runs('Проверка: ')}${ctx.omml(it.tex, true)}${doc.runs(' – ')}${doc.runs(doc.htmlSegs(t))}</w:p>`);
          break;
        }
        case 'table': {
          st.tab++;
          doc.p('Таблица ' + st.tab + ' – ' + plain(it.cap).replace(/\.$/, ''), { style: 'TableCaption' });
          const n = it.head.length, W = doc.textW();
          const first = n > 2 ? Math.round(W * 0.34) : Math.round(W * 0.5);
          const cols = n === 1 ? [W] : [first].concat(new Array(n - 1).fill(Math.floor((W - first) / (n - 1))));
          doc.table(it.head.map(h => symHtml(String(h))), it.rows.map(r => r.map(c => symHtml(String(c)))), { cols });
          break;
        }
        case 'fig': {
          const img = ctx.png[it.id];
          if (!img) break;
          const n = st.figNums[it.id];
          if (!st.figRef.has(it.id)) doc.html(`${figLead(it)} представлена на рисунке ${n}.`.replace('представлена на рисунке', it.kind === 'beam' ? 'приведены на рисунке' : 'представлена на рисунке'), { keepNext: true });
          const wmax = 16.5, hmax = 13;
          let w = wmax, h = w * img.h / img.w; if (h > hmax) { h = hmax; w = h * img.w / img.h; }
          if (it.kind === 'scheme' || it.kind === 'load') { w = Math.min(w, 14); h = w * img.h / img.w; }
          doc.image(img.data, 'png', w, h);
          doc.p('Рисунок ' + n + ' – ' + plain(it.title).replace(/\.$/, ''), { style: 'Caption' });
          break;
        }
      }
    }
  }
  function figLead(it) {
    switch (it.kind) {
      case 'beam': return 'Расчётная схема вала и эпюры изгибающих и крутящего моментов';
      case 'layout': return 'Эскизная компоновка (ступенчатые валы с принятыми размерами)';
      case 'scheme': return 'Кинематическая схема привода';
      case 'load': return 'График нагрузки';
    }
    return it.title;
  }
  function emitEq(doc, it, ctx, T, st) {
    const f = ctx.F;
    const hasF = !!it.f || !!it.s;
    if (!hasF) {   // табличное / принятое значение — в строку
      const val = it.raw !== undefined ? it.raw : f.n(it.v, it.sig);
      const om = ctx.omml(it.lhs + '=' + val + (it.u ? '\\ \\text{' + it.u + '}' : ''), true);
      const d = it.d ? ' – ' + lc(st.text(it.d)).replace(/\.?\s*$/, '.') : '.';
      doc.raw(`<w:p>${doc.pPr({})}${doc.runs('Принимаем ')}${om}${doc.runs(doc.htmlSegs(d))}</w:p>`);
      return;
    }
    if (T.explain && it.d) doc.html(st.text(it.d), { keepNext: true });
    const lines = fitMath(ctx.eqTex(it), ctx);
    st.eq++;
    const syms = T.explain ? symsIn(it.f || '', it.lhs).filter(k => !st.explained.has(k)) : [];
    lines.forEach((l, k) => {
      const om = ctx.omml(l.t, false, l.size || 28);
      if (k < lines.length - 1) doc.math(om, { keepNext: true });
      else doc.mathNum(om, st.eq, syms.length > 0);
    });
    if (syms.length) {
      const SYM = M().SYM;
      syms.forEach((k, i) => {
        st.explained.add(k);
        const [name, unit] = SYM[k];
        const om = ctx.omml(k, true);
        const tail = ' – ' + name + (unit ? ', ' + unit : '') + (i === syms.length - 1 ? '.' : ';');
        doc.raw(`<w:p>${doc.pPr(Object.assign({ style: 'Where' }, i === 0 ? {} : { left: 600 }, i < syms.length - 1 ? { keepNext: true } : {}))}${doc.runs(i === 0 ? 'где ' : '')}${om}${doc.runs(tail)}</w:p>`);
      });
    }
    st.explained.add(it.lhs);
  }

  function intro(doc, ctx, st) {
    const P = ctx.S.P, task = ctx.D.TASKS[P.task];
    const t = s => doc.html(st.text(s));
    t('Механические приводы с редукторами являются наиболее распространённым видом приводов технологического и транспортного оборудования. От правильного выбора двигателя, передаточных отношений, материалов и размеров деталей зависят надёжность, долговечность, масса и стоимость машины.');
    t(`Цель курсового проекта — спроектировать ${lc(task.title)}: выбрать электродвигатель, рассчитать передачи, валы, подшипниковые узлы и соединения, разработать конструкцию редуктора и выполнить комплект конструкторской документации.`);
    t('Задачи проекта:');
    const tasks = ['выполнить кинематический и силовой расчёт привода, выбрать электродвигатель', P.task === 3 ? 'рассчитать червячную передачу и открытую цепную передачу, выполнить тепловой расчёт редуктора' : P.task === 6 ? 'рассчитать быстроходную и тихоходную цилиндрические передачи и открытую цепную передачу' : 'рассчитать коническую и цилиндрическую ступени редуктора',
      'определить размеры валов, колёс и корпуса, выполнить эскизную компоновку', 'проверить прочность валов, подобрать и проверить шпонки и подшипники качения', 'назначить посадки и способ смазки, подобрать муфту'];
    if (P.task === 6) tasks.splice(4, 0, 'рассчитать вал конвейера с барабаном');
    tasks.forEach((x, k) => doc.p('– ' + x + (k === tasks.length - 1 ? '.' : ';')));
    t('Расчёты выполнены по методическим указаниям кафедры [[met|с. 3]] и учебному пособию [[ch|с. 3]]; электродвигатель выбран по каталогу [[air|с. 5]], муфта — по стандарту [[gost21424|табл. 1]]. Пояснительная записка оформлена в соответствии с требованиями [[oform|с. 4]], [[g2105|разд. 6]].');
  }
  function conclusion(doc, ctx, st) {
    const R = ctx.S.R, P = ctx.S.P, task = ctx.D.TASKS[P.task];
    doc.html(st.text(`В курсовом проекте спроектирован ${lc(task.title)} с заданными мощностью ${ctx.F.fnum(P.Pout, 0)} кВт и частотой вращения выходного вала ${ctx.F.fnum(P.nout, 0)} мин<sup>−1</sup>. Основные результаты:`), { keepNext: true });
    (R.summary || []).forEach(([k, v], i, a) => doc.html('– ' + lc(k) + ' — ' + symHtml(v) + (i === a.length - 1 ? '.' : ';')));
    let bad = 0; for (const s of R.sections) for (const it of s.items) if (it.k === 'check' && !it.ok) bad++;
    doc.html(bad ? `Часть проверочных условий (${bad}) не выполняется — требуется корректировка размеров по замечаниям в соответствующих разделах.` : 'Все проверочные расчёты (контактная и изгибная выносливость передач, прочность валов, смятие шпонок, долговечность подшипников) выполняются, следовательно, принятые размеры и материалы обеспечивают работоспособность привода в течение заданного срока службы.');
  }
  function refsList(doc, ctx, st) {
    const REFS = ctx.D.REFS;
    st.refs.forEach((k, i) => doc.p((i + 1) + ' ' + (REFS[k] || k), {}));
  }
  function specAppendix(doc, ctx, T, letter) {
    const K = root.KOMPAS; if (!K) return false;
    const sp = K.specs(ctx.S.R, ctx.S.P, T);
    if (!sp.length) return false;
    doc.p(`Приложение ${letter}`, { style: 'StructHead' });
    doc.p('(обязательное)', { align: 'center', indent: 0 });
    doc.p('Спецификации', { align: 'center', indent: 0, spacing: { after: 240 } }, { b: true });
    sp.forEach((s, i) => {
      doc.p(`Таблица ${letter}.${i + 1} – Спецификация ${s.code} «${s.name}»`, { style: 'TableCaption' });
      const rows = [];
      s.sections.forEach(sec => { rows.push(['', '', '', '', `<u>${sec.title}</u>`, '', '']); sec.items.forEach(r => rows.push([r.fmt || '', '', r.pos || '', r.code || '', r.name, r.qty || '', r.note || ''])); });
      doc.table(['Формат', 'Зона', 'Поз.', 'Обозначение', 'Наименование', 'Кол.', 'Приме-чание'], rows, { cols: [700, 600, 600, 2900, 3000, 600, 954], size: 22, align: [null, null, 'center', null, null, 'center', null] });
    });
    return true;
  }
  function listingAppendix(doc, ctx, T, letter) {
    const files = ctx.kompasFiles().filter(f => /\.py$/.test(f.path));
    if (!files.length) return false;
    doc.p(`Приложение ${letter}`, { style: 'StructHead' });
    doc.p('(справочное)', { align: 'center', indent: 0 });
    doc.p('Макросы построения моделей и чертежей в КОМПАС-3D', { align: 'center', indent: 0, spacing: { after: 240 } }, { b: true });
    files.forEach((fl, i) => {
      doc.p(`Листинг ${letter}.${i + 1} – ${fl.path}`, { style: 'TableCaption' });
      fl.gen().split('\n').forEach(l => doc.p(l.replace(/\t/g, '    ') || ' ', { style: 'Code' }));
    });
    return true;
  }

  async function build(ctx, part, T) {
    const doc = new DOCX.Doc({ codePlain: !!T.codePlain });
    const R = ctx.S.R, P = ctx.S.P;
    const st = Ctx(ctx, T);
    const secs = part === 'all' ? R.sections : R.sections.filter(s => s.tab === part);
    let n = 0; for (const s of secs) for (const it of s.items) if (it.k === 'fig' && ctx.png[it.id]) st.figNums[it.id] = String(++n);
    const code = (T.code || ctx.codeDefault()) + ' 00.00.00 ПЗ';
    const stampData = { code, name: (T.topic || ctx.D.TASKS[P.task].title) + '\nПояснительная записка', dev: T.student || '', chk: T.teacher || '', norm: T.normo || '', org: 'КНИТУ' + (T.group ? ' ' + T.group : '') };
    stampData.name = stampData.name.replace('\n', '. ');
    // колонтитулы основной части
    let hfMain;
    if (T.frame) {
      const hdr = doc.addHF('header', doc.frameHeader());
      const end = '<w:p><w:pPr><w:spacing w:after="0" w:line="20" w:lineRule="exact"/></w:pPr></w:p>';
      const f2 = doc.addHF('footer', doc.stamp2(stampData) + end), f2a = doc.addHF('footer', doc.stamp2a(stampData) + end);
      hfMain = { hdr: { def: hdr, first: hdr }, ftr: { def: f2a, first: part === 'all' ? f2 : f2a }, titlePg: true, footerMm: 5, headerMm: 10 };
    } else {
      const fn = doc.addHF('footer', doc.footerNum());
      hfMain = { ftr: { def: fn, first: fn }, footerMm: 10 };
    }
    if (part === 'all') {
      titlePage(doc, ctx, T); taskPage(doc, ctx, T); normoPage(doc, ctx, T);
      const empty = doc.addHF('footer', '<w:p/>');
      doc.sectionBreak({ ftr: { def: empty } });
      doc.p('Содержание', { style: 'TocHead' });
      const toc = [{ t: 'Введение', lvl: 1 }];
      for (const s of secs) for (const it of s.items) if (it.k === 'h' && it.lvl !== 3) toc.push({ t: it.no + ' ' + it.t, lvl: it.lvl === 1 ? 1 : 2 });
      toc.push({ t: 'Заключение', lvl: 1 }, { t: 'Список использованных источников', lvl: 1 }, { t: 'Приложение А Спецификации', lvl: 1 });
      doc.toc(toc);
      doc.p('Введение', { style: 'StructHead' });
      intro(doc, ctx, st);
    } else {
      doc.p(PARTS[part] || '', { style: 'TocHead' });
    }
    for (const s of secs) addItems(doc, s.items, ctx, T, st);
    if (part === 'all') {
      doc.p('Заключение', { style: 'StructHead' });
      conclusion(doc, ctx, st);
      doc.p('Список использованных источников', { style: 'StructHead' });
      refsList(doc, ctx, st);
      specAppendix(doc, ctx, T, 'А');
      if (T.listings) listingAppendix(doc, ctx, T, 'Б');
    } else if (st.refs.length) {
      doc.p('Источники, на которые есть ссылки в разделе', { style: 'Heading2' });
      refsList(doc, ctx, st);
    }
    return doc.build({ title: 'Пояснительная записка ' + code, author: T.student || '', updateFields: part === 'all' }, hfMain);
  }
  root.REPORT = { build, symsIn, fitMath };
})(typeof window !== 'undefined' ? window : globalThis);
