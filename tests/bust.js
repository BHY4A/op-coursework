'use strict';
/* Сброс кеша браузера: в index.html у каждого своего файла (js/…, css/…) ?v= — по содержимому файла (первые 10 знаков SHA-1).
   Изменился файл — изменилась ссылка, браузер берёт новый без Ctrl+F5. Запускается в конце npm test; можно и отдельно: node tests/bust.js */
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const ROOT = path.join(__dirname, '..');
function bust() {
  const p = path.join(ROOT, 'index.html');
  const src = fs.readFileSync(p, 'utf8');
  let n = 0;
  const out = src.replace(/((?:src|href)=")([^"?#]+\.(?:js|css))\?v=([^"]*)"/g, (m, a, f, v) => {
    const fp = path.join(ROOT, f);
    if (!fs.existsSync(fp)) return m;
    const h = crypto.createHash('sha1').update(fs.readFileSync(fp)).digest('hex').slice(0, 10);
    if (h !== v) n++;
    return `${a}${f}?v=${h}"`;
  });
  if (out !== src) fs.writeFileSync(p, out);
  return n;
}
module.exports = { bust };
if (require.main === module) console.log('index.html: обновлено ссылок — ' + bust());
