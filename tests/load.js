/* tests/load.js — загрузка скриптов утилиты в Node (как в браузере, по порядку из index.html), без DOM.
   Интерфейс (app.js, suite.js, debug.js) не загружается — проверяется расчёт и построение листов. */
'use strict';
const fs = require('fs'), vm = require('vm'), path = require('path');

function load(root) {
  root = root || path.resolve(__dirname, '..');
  const ctx = { console, Math, JSON, Date, setTimeout, clearTimeout, requestAnimationFrame: f => setTimeout(f, 0), performance: { now: () => Date.now() } };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx;
  vm.createContext(ctx);
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const scripts = [...html.matchAll(/<script src="(js\/[^"?]+)/g)].map(m => m[1]).filter(s => !/app\.js|suite\.js|debug\.js/.test(s));
  for (const s of scripts) vm.runInContext(fs.readFileSync(path.join(root, s), 'utf8'), ctx, { filename: s });
  return ctx;
}
module.exports = { load };
