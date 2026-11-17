/* 打散正确答案位置：交换选项内容而不是改答案，保证 A/B/C 大致各三分之一
   用法：node tools/fix_quiz_dist.js [g1a g2b ...]
*/
const fs = require('fs');
const path = require('path');
const SRC = path.join(__dirname, '..', 'learn', 'data', 'lessons', 'src');

const q = s => "'" + String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
const qa = a => '[' + a.map(q).join(', ') + ']';
const scene = o => '{ ' + Object.keys(o).map(k => k + ': ' + (typeof o[k] === 'string' ? q(o[k]) : JSON.stringify(o[k]))).join(', ') + ' }';

function seed(str) { let h = 2166136261; for (const c of str) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
function rng(s) { let x = s || 1; return () => { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return ((x >>> 0) % 100000) / 100000; }; }

const files = fs.readdirSync(SRC).filter(f => /^g\d[ab]u\d+\.js$/.test(f)).sort();
const want = process.argv.slice(2);
let touched = 0;

for (const f of files) {
  if (want.length && want.indexOf(f.slice(0, 3)) < 0) continue;
  const id = f.replace(/\.js$/, '');
  global.window = {};
  delete require.cache[require.resolve(path.join(SRC, f))];
  require(path.join(SRC, f));
  const L = (global.window.LESSONS || {})[id];
  if (!L || !L.quiz) continue;

  // 目标位置：3 个 A、4 个 B、3 个 C，用 id 作种子洗牌，避免「题号取模」规律
  const targets = [0, 0, 0, 1, 1, 1, 1, 2, 2, 2];
  const rand = rng(seed(id));
  for (let i = targets.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [targets[i], targets[j]] = [targets[j], targets[i]];
  }
  const before = [0, 0, 0];
  L.quiz.forEach((x, i) => {
    before[x.k] = (before[x.k] || 0) + 1;
    const t = targets[i];
    if (x.k !== t) { const tmp = x.a[t]; x.a[t] = x.a[x.k]; x.a[x.k] = tmp; x.k = t; }
  });
  if (Math.max(...before) < 5) { console.log('skip ' + id + '  ' + before.join('/')); continue; }

  const out = '/* ' + id + ' · ' + L.unit + ' */\n' +
    'Object.assign(window.LESSONS = window.LESSONS || {}, {\n' +
    "  '" + id + "': {\n" +
    '    grade: ' + L.grade + ", term: " + q(L.term) + ', unit: ' + q(L.unit) + ',\n' +
    '    color: ' + q(L.color) + ',\n' +
    '    points: ' + qa(L.points) + ',\n' +
    '    intro: ' + q(L.intro) + ',\n' +
    '    steps: [\n' +
    L.steps.map(s => '      { say: ' + q(s.say) + ', scene: ' + scene(s.scene) + ' }').join(',\n') + '\n' +
    '    ],\n' +
    '    quiz: [\n' +
    L.quiz.map(x => '      { q: ' + q(x.q) + ', a: ' + qa(x.a) + ', k: ' + x.k + ', why: ' + q(x.why) + ' }').join(',\n') + '\n' +
    '    ]\n  }\n});\n';
  fs.writeFileSync(path.join(SRC, f), out);
  touched++;
  console.log('fix  ' + id + '  ' + before.join('/') + ' → ' + [0, 1, 2].map(i => L.quiz.filter(x => x.k === i).length).join('/'));
}
console.log('处理 ' + touched + ' 个单元');
