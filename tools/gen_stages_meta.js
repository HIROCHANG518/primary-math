#!/usr/bin/env node
/* 从 vertical.html 抽出关卡清单，生成 js/stages-meta.js
   统计页要列出「哪些关学过、哪些没学过」，但关卡定义（含出题函数）在闯关页里，
   这里只抽一份纯文本元数据，避免手抄清单与代码漂移。
   用法：node tools/gen_stages_meta.js */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const src = fs.readFileSync(path.join(ROOT, 'vertical.html'), 'utf8');

const start = src.indexOf('const LEVELS = [');
if (start < 0) { console.error('没找到 LEVELS 定义'); process.exit(1); }
const end = src.indexOf('\n];', start);
const body = src.slice(start, end + 3);

const out = [];
const reGrade = /\{g:\s*(\d+)\s*,\s*name:\s*'([^']+)'\s*,\s*stages:\s*\[([\s\S]*?)\]\s*\}/g;
let m;
while ((m = reGrade.exec(body))) {
  const labels = [];
  const reLabel = /label:\s*'([^']+)'/g;
  let k;
  while ((k = reLabel.exec(m[3]))) labels.push(k[1]);
  out.push({ g: Number(m[1]), name: m[2], stages: labels });
}

if (!out.length) { console.error('解析出 0 个年级'); process.exit(1); }

/* 展平成带全局序号的清单，与 vertical.html 里 STAGES 的顺序一致 */
let idx = 0;
const flat = [];
out.forEach(g => g.stages.forEach((label, si) => {
  flat.push({ idx: idx++, g: g.g, gn: g.name, si, label });
}));

const lines = [
  '/* 关卡清单（由 tools/gen_stages_meta.js 从 vertical.html 生成，勿手改） */',
  'window.STAGES_META = ' + JSON.stringify(out) + ';',
  'window.STAGES_FLAT = ' + JSON.stringify(flat) + ';',
  ''
];
fs.writeFileSync(path.join(ROOT, 'js/stages-meta.js'), lines.join('\n'));

console.log('年级', out.length, '关卡', flat.length);
out.forEach(g => console.log('  ' + g.name, g.stages.length, g.stages.join(' / ')));
