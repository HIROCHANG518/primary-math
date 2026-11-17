/* 把 src/ 下的单元片段合成按册加载的 data/lessons/<book>.js，并刷新 ids.js
   用法：node tools/build_book.js [book ...]   不带参数 = 全部重建
   片段约定：learn/data/lessons/src/g1au1.js 内容形如
       Object.assign(window.LESSONS = window.LESSONS || {}, { 'g1au1': { ... } });
*/
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'learn', 'data', 'lessons');
const SRC = path.join(ROOT, 'src');

const files = fs.readdirSync(SRC).filter(f => /^g\d[ab]u\d+\.js$/.test(f)).sort();
const byBook = {};
for (const f of files) {
  const book = f.slice(0, 3);
  (byBook[book] = byBook[book] || []).push(f);
}

const want = process.argv.slice(2);
for (const book of Object.keys(byBook).sort()) {
  if (want.length && want.indexOf(book) < 0) continue;
  const list = byBook[book].sort((a, b) => {
    const na = Number(a.match(/u(\d+)/)[1]), nb = Number(b.match(/u(\d+)/)[1]);
    return na - nb;
  });
  const head = '/* ' + book + ' · 知识点讲解（由 tools/build_book.js 从 src/ 合成，勿直接改本文件） */\n' +
    '(function () {\n  const L = (window.LESSONS = window.LESSONS || {});\n';
  const body = list.map(f => {
    let s = fs.readFileSync(path.join(SRC, f), 'utf8').trim();
    // 片段自身带 Object.assign，这里换成对象字面量直接展开
    s = s.replace(/Object\.assign\(window\.LESSONS\s*=\s*window\.LESSONS\s*\|\|\s*\{\}\s*,\s*/, 'Object.assign(L, ');
    s = s.replace(/\/\*[^]*?\*\/\s*/, '');   // 去掉片段首行的说明注释
    s = s.replace(/\n{3,}/g, '\n\n');
    return '  /* ' + f.replace(/\.js$/, '') + ' */\n  ' + s;
  }).join('\n\n');
  const out = head + body + '\n})();\n';
  fs.writeFileSync(path.join(ROOT, book + '.js'), out);
  console.log('build ' + book + '.js  (' + list.length + ' 单元, ' + (out.length / 1024).toFixed(1) + ' KB)');
}

const ids = files.map(f => f.replace(/\.js$/, '')).sort();
fs.writeFileSync(path.join(ROOT, 'ids.js'),
  '/* 已上线讲解的单元清单（自动生成） */\nwindow.LESSON_IDS = ' + JSON.stringify(ids) + ';\n');
console.log('ids.js: ' + ids.length + ' 单元');
