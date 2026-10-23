/* Фоновый поток для отладочного KOMPAS Build: расчёт варианта и макросы для КОМПАС.
   Раскладка листов одного варианта занимает 10–20 с, поэтому варианты считаются параллельно в нескольких таких потоках.
   Сообщение { init: [скрипты] } загружает расчётные скрипты утилиты (как в index.html, без интерфейса);
   { id, no, T, cal } → { id, files: [[путь, текст]] } или { id, err }. */
'use strict';
self.window = self;
self.requestAnimationFrame = f => setTimeout(f, 0);
const KEEP = /^(\d\d_[a-z]+\.py|params\.json|sheets\.json)$/;
self.onmessage = e => {
  const m = e.data;
  if (m.init) { importScripts(...m.init); return; }
  try {
    const TC = self.TASKS_CALC, P = TC.defaults(m.no), R = TC['task' + P.task](P);
    const files = self.KOMPAS.files(R, P, m.T || {}, { debug: true })
      .filter(f => KEEP.test(f.path) && (m.cal || f.path !== '60_calibrate.py'))
      .map(f => [f.path, f.gen()]);
    self.postMessage({ id: m.id, task: P.task, v: P.v, files });
  } catch (err) {
    self.postMessage({ id: m.id, err: String(err && err.stack || err) });
  }
};
