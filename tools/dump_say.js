/* 导出某册所有讲解句为配音任务：node tools/dump_say.js g1a > /tmp/jobs-g1a.json */
const fs = require('fs');
const path = require('path');
const SRC = path.join(__dirname, '..', 'learn', 'data', 'lessons', 'src');

const book = process.argv[2];
if (!book) { console.error('用法：node tools/dump_say.js g1a'); process.exit(1); }
const files = fs.readdirSync(SRC).filter(f => f.startsWith(book) && /\.js$/.test(f)).sort((a, b) =>
  Number(a.match(/u(\d+)/)[1]) - Number(b.match(/u(\d+)/)[1]));

const jobs = [];
for (const f of files) {
  global.window = {};
  delete require.cache[require.resolve(path.join(SRC, f))];
  require(path.join(SRC, f));
  const id = f.replace(/\.js$/, '');
  const L = (global.window.LESSONS || {})[id];
  if (!L) { console.error('skip ' + f); continue; }
  L.steps.forEach((s, i) => jobs.push({ key: id + '-' + i, text: s.say }));
}
process.stdout.write(JSON.stringify(jobs, null, 0));
console.error(book + ': ' + files.length + ' 单元 ' + jobs.length + ' 句');
