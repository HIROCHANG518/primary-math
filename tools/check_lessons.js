/* 校验单元讲解片段：结构、场景白名单、语音可读性、题目完整性
   用法：node tools/check_lessons.js [g1a g1b ...]   不带参数 = 全部
*/
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'learn', 'data', 'lessons', 'src');

global.window = {};
require(path.join(ROOT, 'learn', 'js', 'scenes.js'));
const TYPES = new Set(window.SCENE_TYPES);
const OUTLINE = (() => {
  const s = fs.readFileSync(path.join(ROOT, 'learn', 'data', 'outline.js'), 'utf8')
    .replace(/^window\.OUTLINE\s*=\s*/, '').replace(/;\s*$/, '');
  const o = JSON.parse(s), map = {};
  for (const g of o.grades) for (const b of g.books) for (const u of b.units) map[u.id] = { g: g.g, term: b.term, t: u.t, p: u.p };
  return map;
})();

const BAD_CHARS = /[+*/=<>%×÷~≤≥≠≈]/;   // 语音里出现的符号，TTS 读不稳
const norm = s => String(s).replace(/\s/g, '').replace(/[「」“"”]/g, '');

const files = fs.readdirSync(SRC).filter(f => /^g\d[ab]u\d+\.js$/.test(f)).sort();
const want = process.argv.slice(2);
let errors = 0, warns = 0;

function err(id, m) { errors++; console.log('  ERR  ' + id + '  ' + m); }
function warn(id, m) { warns++; console.log('  WARN ' + id + '  ' + m); }

for (const f of files) {
  const book = f.slice(0, 3);
  if (want.length && want.indexOf(book) < 0) continue;
  const id = f.replace(/\.js$/, '');
  global.window = {};
  try { delete require.cache[require.resolve(path.join(SRC, f))]; require(path.join(SRC, f)); }
  catch (e) { err(id, '语法错误 ' + e.message); continue; }
  const L = (global.window.LESSONS || {})[id];
  if (!L) { err(id, '没有导出 window.LESSONS["' + id + '"]'); continue; }

  const meta = OUTLINE[id];
  if (!meta) err(id, 'outline 里没有这个单元 id');
  else {
    if (L.grade !== meta.g) err(id, 'grade 应为 ' + meta.g + '，实际 ' + L.grade);
    if (L.term !== meta.term) err(id, 'term 应为 ' + meta.term + '，实际 ' + L.term);
    if (norm(L.unit) !== norm(meta.t)) err(id, 'unit 应为「' + meta.t + '」，实际「' + L.unit + '」');
    const pts = (L.points || []).map(norm).join('|');
    const miss = meta.p.filter(p => !pts.includes(norm(p).slice(0, 8)));
    if (miss.length) warn(id, 'outline 要点未覆盖：' + miss.join(' / '));
  }
  if (!/^#[0-9a-f]{6}$/i.test(L.color || '')) err(id, 'color 缺失或格式不对');
  if (!L.intro || L.intro.length < 15) err(id, 'intro 太短');
  if (!Array.isArray(L.points) || L.points.length < Math.min(3, (meta ? meta.p.length : 3))) err(id, 'points 至少 ' + Math.min(3, (meta ? meta.p.length : 3)) + ' 条');

  const steps = L.steps || [];
  if (steps.length < 6 || steps.length > 14) err(id, 'steps 应为 6~14 步，实际 ' + steps.length);
  steps.forEach((s, i) => {
    if (!s.say || s.say.length < 12) err(id, 'steps[' + i + '].say 太短');
    if (s.say && s.say.length > 150) warn(id, 'steps[' + i + '].say 超过 150 字（' + s.say.length + '），音频会很长');
    const m = s.say && s.say.match(BAD_CHARS);
    if (m) err(id, 'steps[' + i + '].say 含符号「' + m[0] + '」，请改成中文读法');
    if (s.say && !/[。？！]$/.test(s.say.trim())) warn(id, 'steps[' + i + '].say 没有句末标点');
    if (!s.scene || !s.scene.t) err(id, 'steps[' + i + '] 缺 scene.t');
    else if (!TYPES.has(s.scene.t)) err(id, 'steps[' + i + '] 场景类型不存在：' + s.scene.t);
  });
  const sceneT = new Set(steps.map(s => s.scene && s.scene.t));
  if (sceneT.size < 4) warn(id, '整节只用了 ' + sceneT.size + ' 种场景，动画会显得单调');

  const quiz = L.quiz || [];
  if (quiz.length !== 10) err(id, 'quiz 必须 10 题，实际 ' + quiz.length);
  const qs = new Set();
  const dist = [0, 0, 0];
  quiz.forEach((q, i) => {
    if (!q.q || q.q.length < 6) err(id, 'quiz[' + i + '].q 太短');
    if (qs.has(norm(q.q))) err(id, 'quiz[' + i + '] 与前题重复');
    qs.add(norm(q.q));
    if (!Array.isArray(q.a) || q.a.length !== 3) err(id, 'quiz[' + i + '] 选项必须 3 个');
    else if (new Set(q.a.map(norm)).size !== 3) err(id, 'quiz[' + i + '] 选项有重复');
    if (!(q.k >= 0 && q.k <= 2)) err(id, 'quiz[' + i + '].k 越界');
    else dist[q.k]++;
    if (!q.why || q.why.length < 8) err(id, 'quiz[' + i + '].why 太短');
    if (q.why && BAD_CHARS.test(q.why)) warn(id, 'quiz[' + i + '].why 含符号（页面显示无妨）');
  });
  if (Math.max.apply(null, dist) > 6) warn(id, '正确答案分布不均：A' + dist[0] + ' B' + dist[1] + ' C' + dist[2]);

  console.log('  ok   ' + id + '  ' + steps.length + ' 步 · ' + sceneT.size + ' 种场景 · ' + quiz.length + ' 题');
}

console.log('\n共 ' + errors + ' 个错误，' + warns + ' 个提醒');
process.exit(errors ? 1 : 0);
