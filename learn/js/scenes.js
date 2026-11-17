/* 知识点动画场景：每个函数返回一段 SVG（viewBox 0 0 560 320）
   约定：关键元素加 class="fx"，挂载后按 data-d 依次淡入/弹出 */
(function () {
  const W = 560, H = 320;
  const INK = '#1d2739', MUT = '#8a94a8', LINE = '#dbe2f0';
  const P = '#4a63d8', OK = '#1f9c66', BAD = '#dc4f4f', WARN = '#e8961a';

  const svg = (body, extra) =>
    `<svg viewBox="0 0 ${W} ${H}" class="scene-svg" ${extra || ''}>${body}</svg>`;

  const label = (x, y, t, o) => {
    o = o || {};
    return `<text x="${x}" y="${y}" text-anchor="${o.anchor || 'middle'}"
      font-size="${o.size || 20}" font-weight="${o.weight || 700}"
      fill="${o.fill || INK}" class="fx" data-d="${o.d || 0}">${t}</text>`;
  };

  const circle = (x, y, r, fill, d) =>
    `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" class="fx" data-d="${d || 0}"/>`;

  const rect = (x, y, w, h, o) => {
    o = o || {};
    return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${o.rx === undefined ? 12 : o.rx}"
      fill="${o.fill || '#fff'}" stroke="${o.stroke || LINE}" stroke-width="${o.sw || 2}"
      class="fx" data-d="${o.d || 0}" ${o.style ? `style="${o.style}"` : ''}/>`;
  };

  /* 点阵：数一数 */
  function dots(s) {
    const n = s.n || 3, per = s.perRow || Math.min(n, 5);
    const r = s.r || 22, gap = s.gap || 74;
    const rows = Math.ceil(n / per);
    const startY = H / 2 - ((rows - 1) * gap) / 2;
    let out = '';
    for (let i = 0; i < n; i++) {
      const row = Math.floor(i / per), col = i % per;
      const inRow = Math.min(per, n - row * per);
      const x = W / 2 - ((inRow - 1) * gap) / 2 + col * gap;
      const y = startY + row * gap;
      out += circle(x, y, r, s.color || P, i * 0.12);
      if (s.showNum !== false) out += label(x, y + r + 34, String(i + 1), { size: 17, fill: MUT, d: i * 0.12 + 0.05 });
    }
    if (s.caption) out += label(W / 2, H - 22, s.caption, { size: 18, fill: MUT, d: n * 0.12 + 0.1 });
    return out;
  }

  /* 比大小：两组点一一对应连线 */
  function compare(s) {
    const a = s.a, b = s.b;
    const gap = 44, r = 15;
    const top = 96;
    let out = '';
    const maxN = Math.max(a, b);
    const x0 = W / 2 - ((maxN - 1) * gap) / 2;
    for (let i = 0; i < a; i++) out += circle(x0 + i * gap, top, r, P, i * 0.1);
    for (let i = 0; i < b; i++) out += circle(x0 + i * gap, top + 78, r, WARN, 0.5 + i * 0.1);
    const m = Math.min(a, b);
    for (let i = 0; i < m; i++) {
      out += `<line x1="${x0 + i * gap}" y1="${top + r + 4}" x2="${x0 + i * gap}" y2="${top + 78 - r - 4}"
        stroke="${OK}" stroke-width="2" stroke-dasharray="4 4" class="fx" data-d="${1.4 + i * 0.12}"/>`;
    }
    out += label(x0 - 34, top + 6, String(a), { size: 22, fill: P });
    out += label(x0 - 34, top + 84, String(b), { size: 22, fill: WARN });
    if (s.caption) out += label(W / 2, H - 26, s.caption, { size: 22, d: 1.9 });
    return out;
  }

  /* 第几：队列中第 n 个高亮 */
  function ordinal(s) {
    const items = s.items || ['🐰', '🐱', '🐶', '🐼', '🐸'];
    const pos = s.pos || 3;              // 1-based
    const gap = 88, y = 150;
    const x0 = W / 2 - ((items.length - 1) * gap) / 2;
    let out = '';
    items.forEach((it, i) => {
      const on = i + 1 === pos;
      out += `<g class="fx" data-d="${i * 0.12}">
        <rect x="${x0 + i * gap - 34}" y="${y - 40}" width="68" height="80" rx="16"
          fill="${on ? '#eef1ff' : '#fff'}" stroke="${on ? P : LINE}" stroke-width="${on ? 3 : 2}"/>
        <text x="${x0 + i * gap}" y="${y + 12}" text-anchor="middle" font-size="38">${it}</text>
      </g>`;
      out += label(x0 + i * gap, y + 64, String(i + 1), { size: 16, fill: on ? P : MUT, d: i * 0.12 + 0.1 });
    });
    out += `<path d="M${x0 + (pos - 1) * gap - 12} ${y - 62} l12 -16 l12 16 z" fill="${P}" class="fx" data-d="1.2"/>`;
    out += label(W / 2, 54, s.title || `从左往右数，第 ${pos} 个是它`, { size: 20, d: 1.35 });
    if (s.caption) out += label(W / 2, H - 26, s.caption, { size: 17, fill: MUT, d: 1.5 });
    return out;
  }

  /* 分与合：分解树 */
  function split(s) {
    const total = s.total, a = s.a, b = s.b;
    const cy = 96, by = 220;
    let out = '';
    out += rect(W / 2 - 52, cy - 40, 104, 80, { rx: 18, fill: '#fff', stroke: P, sw: 3 });
    out += label(W / 2, cy + 12, String(total), { size: 38, fill: P, weight: 800 });
    out += `<path d="M${W / 2 - 18} ${cy + 44} L${W / 2 - 86} ${by - 46}" stroke="${LINE}" stroke-width="3" class="fx" data-d="0.5"/>`;
    out += `<path d="M${W / 2 + 18} ${cy + 44} L${W / 2 + 86} ${by - 46}" stroke="${LINE}" stroke-width="3" class="fx" data-d="0.6"/>`;
    [[W / 2 - 96, a, P], [W / 2 + 96, b, WARN]].forEach((v, i) => {
      out += rect(v[0] - 44, by - 42, 88, 84, { rx: 16, fill: '#fff', stroke: v[2], sw: 3, d: 0.9 + i * 0.15 });
      out += label(v[0], by + 10, String(v[1]), { size: 34, fill: v[2], weight: 800, d: 1 + i * 0.15 });
    });
    out += label(W / 2, 44, `${total} 可以分成 ${a} 和 ${b}`, { size: 22 });
    if (s.caption) out += label(W / 2, H - 24, s.caption, { size: 17, fill: MUT, d: 1.5 });
    return out;
  }

  /* 合并（加法） / 去掉（减法） */
  function mergeOrLeave(s, mode) {
    const a = s.a, b = s.b, r = 15, gap = 42;
    const y = 150;
    let out = '';
    const leftStart = W / 2 - ((a + b) * gap) / 2;
    for (let i = 0; i < a; i++) out += circle(leftStart + i * gap, y, r, P, i * 0.1);
    const bColor = mode === 'merge' ? WARN : BAD;
    for (let i = 0; i < b; i++) {
      const x = leftStart + (a + i) * gap;
      out += `<g class="fx ${mode === 'leave' ? 'fade-out' : 'slide-in'}" data-d="${0.8 + i * 0.15}">
        ${circle(x, y, r, bColor, 0)}</g>`;
      if (mode === 'leave') {
        out += `<path d="M${x} ${y - r - 10} l0 -22 m-7 7 l7 -7 l7 7" stroke="${BAD}" stroke-width="2.5"
          fill="none" class="fx" data-d="${1.1 + i * 0.15}"/>`;
      }
    }
    const sign = mode === 'merge' ? '+' : '−';
    out += label(leftStart - 46, y + 8, String(a), { size: 24, fill: P });
    out += label(leftStart + a * gap - 21, y + 8, sign, { size: 22, fill: MUT, d: 0.7 });
    out += label(leftStart + (a + b) * gap - 24, y + 8, String(b), { size: 24, fill: bColor, d: 0.8 });
    if (s.caption) out += label(W / 2, H - 40, s.caption, { size: 24, d: 1.6 });
    if (s.result !== undefined)
      out += label(W / 2, H - 98, '= ' + s.result, { size: 26, fill: OK, d: 2 });
    return out;
  }

  /* 空的盘子 / 0 的认识 */
  function zero(s) {
    let out = rect(W / 2 - 110, 96, 220, 120, { rx: 60, fill: '#fff', stroke: LINE, sw: 3 });
    if (s.n) for (let i = 0; i < s.n; i++) out += circle(W / 2 - 60 + i * 60, 156, 17, WARN, 0.4 + i * 0.1);
    out += label(W / 2, 268, s.caption || '一个也没有，用 0 表示', { size: 21, fill: MUT, d: 1.2 });
    if (s.eq) out += label(W / 2, 60, s.eq, { size: 26, d: 1.4 });
    return out;
  }

  /* 十格阵：凑十 */
  function tenframe(s) {
    const n = s.n || 8, c = 5, size = 46, gap = 4;
    const total = (size + gap) * c;
    const x0 = W / 2 - total / 2, y0 = 96;
    let out = '';
    for (let i = 0; i < 10; i++) {
      const row = Math.floor(i / c), col = i % c;
      const x = x0 + col * (size + gap), y = y0 + row * (size + gap);
      out += `<rect x="${x}" y="${y}" width="${size}" height="${size}" rx="8" fill="#fff" stroke="${LINE}" stroke-width="2"/>`;
      if (i < n) out += `<circle cx="${x + size / 2}" cy="${y + size / 2}" r="15" fill="${P}" class="fx" data-d="${i * 0.08}"/>`;
    }
    out += label(W / 2, y0 + 2 * (size + gap) + 40, s.caption || `已经有 ${n} 个，再添 ${10 - n} 个就是 10`, { size: 19, fill: MUT, d: 1 });
    return out;
  }

  /* 小棒：十位与个位 */
  function rods(s) {
    const tens = s.tens || 1, ones = s.ones || 3;
    let out = '';
    const perTen = 46, baseY = 236;
    for (let t = 0; t < tens; t++) {
      const x = 70 + t * 52;
      out += `<line x1="${x}" y1="${baseY - 130}" x2="${x}" y2="${baseY}" stroke="${P}" stroke-width="7"
        stroke-linecap="round" class="fx" data-d="${t * 0.12}"/>`;
      out += label(x, baseY + 28, '十', { size: 15, fill: MUT, d: t * 0.12 });
    }
    for (let o = 0; o < ones; o++) {
      const x = 90 + tens * 52 + o * 22;
      out += `<line x1="${x}" y1="${baseY - 34}" x2="${x}" y2="${baseY}" stroke="${WARN}" stroke-width="6"
        stroke-linecap="round" class="fx" data-d="${0.6 + o * 0.1}"/>`;
    }
    out += label(W / 2, 60, s.title || `${tens} 个十和 ${ones} 个一，合起来是 ${tens * 10 + ones}`, { size: 22, d: 0.3 });
    if (s.caption) out += label(W / 2, H - 16, s.caption, { size: 16, fill: MUT, d: 1 });
    return out;
  }

  /* 数轴 */
  function numberline(s) {
    const from = s.from === undefined ? 0 : s.from, to = s.to === undefined ? 10 : s.to;
    const y = 168, x0 = 62, x1 = W - 62;
    const step = (x1 - x0) / (to - from);
    let out = `<line x1="${x0 - 14}" y1="${y}" x2="${x1 + 14}" y2="${y}" stroke="${INK}" stroke-width="2.5"/>`;
    out += `<path d="M${x1 + 14} ${y} l-12 -6 l0 12 z" fill="${INK}"/>`;
    for (let v = from; v <= to; v++) {
      const x = x0 + (v - from) * step;
      const on = (s.mark || []).includes(v);
      out += `<line x1="${x}" y1="${y - 8}" x2="${x}" y2="${y + 8}" stroke="${on ? P : MUT}" stroke-width="${on ? 3 : 2}"/>`;
      out += label(x, y + 34, String(v), { size: 16, fill: on ? P : MUT, d: on ? 0.6 : 0 });
      if (on) out += `<circle cx="${x}" cy="${y}" r="6" fill="${P}" class="fx" data-d="0.5"/>`;
    }
    if (s.caption) out += label(W / 2, 60, s.caption, { size: 21, d: 0.8 });
    return out;
  }

  /* 立体图形 */
  function shapes3d(s) {
    const kinds = s.kinds || ['cuboid', 'cube', 'cylinder', 'sphere'];
    const names = { cuboid: '长方体', cube: '正方体', cylinder: '圆柱', sphere: '球' };
    const gap = 132, x0 = W / 2 - ((kinds.length - 1) * gap) / 2, y = 150;
    let out = '';
    kinds.forEach((k, i) => {
      const cx = x0 + i * gap;
      let g = '';
      if (k === 'cuboid' || k === 'cube') {
        const w = k === 'cube' ? 62 : 84, h = k === 'cube' ? 62 : 54, d = 24;
        g = `<path d="M${cx - w / 2} ${y - h / 2} h${w} v${h} h${-w} z" fill="#eef1ff" stroke="${P}" stroke-width="2.5"/>
             <path d="M${cx - w / 2} ${y - h / 2} l${d} -${d} h${w} l-${d} ${d}" fill="#f7f9ff" stroke="${P}" stroke-width="2.5"/>
             <path d="M${cx + w / 2} ${y - h / 2} v${h} l${d} -${d} v${-h}" fill="#e3e9ff" stroke="${P}" stroke-width="2.5"/>`;
      } else if (k === 'cylinder') {
        g = `<ellipse cx="${cx}" cy="${y - 34}" rx="42" ry="14" fill="#eef1ff" stroke="${P}" stroke-width="2.5"/>
             <path d="M${cx - 42} ${y - 34} v68 a42 14 0 0 0 84 0 v-68" fill="#f7f9ff" stroke="${P}" stroke-width="2.5"/>`;
      } else {
        g = `<circle cx="${cx}" cy="${y}" r="38" fill="url(#ballGrad)" stroke="${P}" stroke-width="2.5"/>
             <defs><radialGradient id="ballGrad" cx="35%" cy="30%"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#d9e2ff"/></radialGradient></defs>`;
      }
      out += `<g class="fx" data-d="${i * 0.14}">${g}</g>` + label(cx, y + 82, names[k] || k, { size: 18, fill: MUT, d: i * 0.14 + 0.1 });
    });
    if (s.caption) out += label(W / 2, 52, s.caption, { size: 20, d: 0.2 });
    return out;
  }

  /* 平面图形 */
  function shape(s) {
    const kind = s.kind || 'rect';
    const y = 150, cx = W / 2;
    let g = '';
    if (kind === 'rect') g = `<rect x="${cx - 100}" y="${y - 60}" width="200" height="120" rx="6" fill="#eef1ff" stroke="${P}" stroke-width="3"/>`;
    else if (kind === 'square') g = `<rect x="${cx - 62}" y="${y - 62}" width="124" height="124" rx="6" fill="#eef1ff" stroke="${P}" stroke-width="3"/>`;
    else if (kind === 'triangle') g = `<path d="M${cx} ${y - 76} L${cx + 96} ${y + 68} L${cx - 96} ${y + 68} z" fill="#eef1ff" stroke="${P}" stroke-width="3"/>`;
    else if (kind === 'circle') g = `<circle cx="${cx}" cy="${y}" r="78" fill="#eef1ff" stroke="${P}" stroke-width="3"/>`;
    else if (kind === 'parallelogram') g = `<path d="M${cx - 60} ${y - 58} h150 l-90 116 h-150 z" fill="#eef1ff" stroke="${P}" stroke-width="3"/>`;
    else g = `<circle cx="${cx}" cy="${y}" r="78" fill="#eef1ff" stroke="${P}" stroke-width="3"/>`;
    let out = `<g class="fx" data-d="0">${g}</g>`;
    (s.notes || []).forEach((n, i) => { out += label(n.x || cx, n.y || (200 + i * 28), n.t, { size: 17, fill: MUT, d: 0.6 + i * 0.1 }); });
    if (s.caption) out += label(W / 2, 54, s.caption, { size: 20, d: 0.2 });
    return out;
  }

  /* 分数条 */
  function fraction(s) {
    const den = s.den || 4, num = s.num === undefined ? 1 : s.num;
    const w = 420, h = 84, x0 = (W - w) / 2, y = 120;
    let out = `<rect x="${x0}" y="${y}" width="${w}" height="${h}" rx="10" fill="#fff" stroke="${LINE}" stroke-width="2"/>`;
    const cw = w / den;
    for (let i = 1; i < den; i++) out += `<line x1="${x0 + i * cw}" y1="${y}" x2="${x0 + i * cw}" y2="${y + h}" stroke="${LINE}" stroke-width="2"/>`;
    for (let i = 0; i < num; i++) out += `<rect x="${x0 + i * cw + 2}" y="${y + 2}" width="${cw - 4}" height="${h - 4}" rx="6" fill="${P}" opacity=".85" class="fx" data-d="${0.3 + i * 0.12}"/>`;
    out += label(W / 2, y + h + 56, s.caption || `${num}/${den}`, { size: 24, d: 0.6 });
    if (s.title) out += label(W / 2, 62, s.title, { size: 20, fill: MUT, d: 0.2 });
    return out;
  }

  /* 钟面 */
  function clock(s) {
    const h = s.h === undefined ? 8 : s.h, m = s.m || 0;
    const cx = W / 2, cy = 160, r = 104;
    let out = `<circle cx="${cx}" cy="${cy}" r="${r + 8}" fill="#fff" stroke="${LINE}" stroke-width="4" class="fx" data-d="0"/>`;
    for (let i = 1; i <= 12; i++) {
      const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
      out += label(cx + Math.cos(a) * (r - 22), cy + Math.sin(a) * (r - 22) + 7, String(i), { size: 17, fill: MUT });
    }
    const ha = ((h % 12) + m / 60) / 12 * Math.PI * 2 - Math.PI / 2;
    const ma = (m / 60) * Math.PI * 2 - Math.PI / 2;
    out += `<line x1="${cx}" y1="${cy}" x2="${cx + Math.cos(ha) * (r - 52)}" y2="${cy + Math.sin(ha) * (r - 52)}" stroke="${INK}" stroke-width="7" stroke-linecap="round" class="fx" data-d="0.3"/>`;
    out += `<line x1="${cx}" y1="${cy}" x2="${cx + Math.cos(ma) * (r - 26)}" y2="${cy + Math.sin(ma) * (r - 26)}" stroke="${P}" stroke-width="4" stroke-linecap="round" class="fx" data-d="0.45"/>`;
    out += circle(cx, cy, 6, INK, 0.3);
    out += label(W / 2, H - 18, s.caption || `${h}:${String(m).padStart(2, '0')}`, { size: 22, d: 0.6 });
    return out;
  }

  /* 数位表 */
  function placevalue(s) {
    const digits = s.digits || '308';
    const heads = s.heads || ['百位', '十位', '个位'];
    const cw = 96, x0 = W / 2 - (digits.length * cw) / 2, y = 108;
    let out = '';
    heads.slice(-digits.length).forEach((h, i) => {
      out += rect(x0 + i * cw, y - 46, cw - 8, 44, { rx: 10, fill: '#f4f6fc', stroke: LINE, d: i * 0.1 });
      out += label(x0 + i * cw + (cw - 8) / 2, y - 17, h, { size: 15, fill: MUT, d: i * 0.1 });
      out += rect(x0 + i * cw, y, cw - 8, 76, { rx: 10, fill: '#fff', stroke: P, sw: 2, d: 0.3 + i * 0.1 });
      out += label(x0 + i * cw + (cw - 8) / 2, y + 52, digits[i], { size: 40, fill: INK, d: 0.35 + i * 0.1 });
    });
    if (s.caption) out += label(W / 2, 240, s.caption, { size: 19, fill: MUT, d: 0.8 });
    if (s.title) out += label(W / 2, 54, s.title, { size: 20, d: 0.1 });
    return out;
  }

  /* 条形图 */
  function bar(s) {
    const items = s.items || [{ k: '苹果', v: 6, c: P }, { k: '香蕉', v: 4, c: WARN }, { k: '梨', v: 3, c: OK }];
    const max = Math.max.apply(null, items.map(i => i.v));
    const bw = 62, gap = 54, x0 = W / 2 - ((items.length - 1) * gap + bw) / 2 + bw / 2, baseY = 250;
    let out = `<line x1="60" y1="${baseY}" x2="${W - 60}" y2="${baseY}" stroke="${INK}" stroke-width="2"/>`;
    items.forEach((it, i) => {
      const h = (it.v / max) * 150;
      out += `<rect x="${x0 + i * gap - bw / 2}" y="${baseY - h}" width="${bw}" height="${h}" rx="8" fill="${it.c || P}"
        opacity=".85" class="fx grow" data-d="${i * 0.14}"/>`;
      out += label(x0 + i * gap, baseY - h - 12, String(it.v), { size: 19, d: i * 0.14 + 0.1 });
      out += label(x0 + i * gap, baseY + 26, it.k, { size: 16, fill: MUT, d: i * 0.14 + 0.1 });
    });
    if (s.caption) out += label(W / 2, 52, s.caption, { size: 20, d: 0.1 });
    return out;
  }

  /* 角 */
  function angle(s) {
    const deg = s.deg || 90, cx = W / 2 - 40, cy = 220, r = 130;
    const rad = (deg * Math.PI) / 180;
    const x2 = cx + Math.cos(rad) * r, y2 = cy - Math.sin(rad) * r;
    let out = `<line x1="${cx}" y1="${cy}" x2="${cx + r}" y2="${cy}" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>`;
    out += `<line x1="${cx}" y1="${cy}" x2="${x2}" y2="${y2}" stroke="${P}" stroke-width="4" stroke-linecap="round" class="fx" data-d="0.4"/>`;
    out += `<path d="M${cx + 44} ${cy} A44 44 0 0 0 ${cx + Math.cos(rad) * 44} ${cy - Math.sin(rad) * 44}" fill="none" stroke="${WARN}" stroke-width="3" class="fx" data-d="0.7"/>`;
    out += label(cx + 74, cy - 22, deg + '°', { size: 20, fill: WARN, d: 0.9 });
    out += circle(cx, cy, 5, INK, 0);
    if (s.caption) out += label(W / 2, 56, s.caption, { size: 20, d: 0.2 });
    return out;
  }

  /* 纯文字要点 */
  function text(s) {
    const lines = s.lines || [];
    const y0 = H / 2 - ((lines.length - 1) * 40) / 2;
    return lines.map((t, i) =>
      label(W / 2, y0 + i * 40, t, { size: i === 0 ? 24 : 19, fill: i === 0 ? INK : MUT, d: i * 0.12 })
    ).join('');
  }

  /* 竖式：加减乘除 */
  function columns(s) {
    const a = String(s.a), b = String(s.b), op = s.op || '+', res = String(s.result === undefined ? '' : s.result);
    const w = Math.max(a.length, b.length, res.length);
    const cw = 36, xr = W / 2 + (w * cw) / 2, xl = xr - w * cw - 14;
    const y = 74;
    let out = '';
    out += label(xr, y + 36, a, { anchor: 'end', size: 36, d: 0 });
    out += label(xl + 6, y + 92, op, { anchor: 'start', size: 30, fill: P, d: 0.25 });
    out += label(xr, y + 92, b, { anchor: 'end', size: 36, d: 0.25 });
    out += `<line x1="${xl}" y1="${y + 108}" x2="${xr + 10}" y2="${y + 108}" stroke="${INK}" stroke-width="3" class="fx" data-d="0.5"/>`;
    if (res) out += label(xr, y + 158, res, { anchor: 'end', size: 36, fill: OK, d: 0.75 });
    if (s.caption) out += label(W / 2, H - 26, s.caption, { size: 19, fill: MUT, d: 1 });
    return out;
  }

  /* 阵列 / 面积网格：行 × 列，前 fill 格着色 */
  function grid(s) {
    const rows = s.rows || 3, cols = s.cols || 4;
    const fill = s.fill === undefined ? rows * cols : s.fill;
    const c = Math.min(s.cell || 46, 280 / Math.max(rows, cols));
    const w = cols * c, h = rows * c, x0 = W / 2 - w / 2, y0 = 66;
    let out = '';
    for (let r = 0; r < rows; r++) {
      for (let q = 0; q < cols; q++) {
        const i = r * cols + q, on = i < fill;
        out += `<rect x="${x0 + q * c}" y="${y0 + r * c}" width="${c}" height="${c}"
          fill="${on ? P : '#fff'}" fill-opacity="${on ? '.8' : '0'}" stroke="${LINE}" stroke-width="1.5"
          class="fx" data-d="${Math.min(0.02 * i, 1.2).toFixed(2)}"/>`;
      }
    }
    if (s.rowLabel) out += label(x0 - 22, y0 + h / 2, s.rowLabel, { size: 17, fill: MUT, d: 1 });
    if (s.colLabel) out += label(x0 + w / 2, y0 - 14, s.colLabel, { size: 17, fill: MUT, d: 1 });
    if (s.caption) out += label(W / 2, y0 + h + 40, s.caption, { size: 19, fill: MUT, d: 1.1 });
    return out;
  }

  /* 平均分 */
  function groups(s) {
    const total = s.total || 12, g = s.groups || 3;
    const each = s.each || Math.floor(total / g);
    const r = 13, gap = 34, rowH = 74;
    const y0 = 96 - ((g - 1) * rowH) / 2 + 40;
    let out = '';
    for (let i = 0; i < g; i++) {
      const n = Math.min(each, total - i * each);
      const x0 = W / 2 - ((n - 1) * gap) / 2;
      out += rect(x0 - 26, y0 + i * rowH - 30, (n - 1) * gap + 52, 58, { rx: 14, fill: '#f6f8fd', stroke: LINE, d: i * 0.12 });
      for (let j = 0; j < n; j++) out += circle(x0 + j * gap, y0 + i * rowH, r, i === 1 ? WARN : P, i * 0.12 + j * 0.06);
      if (s.showEach) out += label(x0 + (n - 1) * gap + 46, y0 + i * rowH + 7, '每组 ' + n, { anchor: 'start', size: 17, fill: MUT, d: i * 0.12 + 0.3 });
    }
    if (s.caption) out += label(W / 2, H - 22, s.caption, { size: 19, fill: MUT, d: 1 });
    return out;
  }

  /* 天平 / 等式两边 */
  function balance(s) {
    const cx = W / 2, beam = 118, by = 118, py = 250;
    const tilt = s.tilt || 0;
    let out = '';
    out += `<path d="M${cx} ${by} L${cx} ${py}" stroke="${INK}" stroke-width="5" class="fx" data-d="0"/>`;
    out += `<path d="M${cx - 56} ${py} L${cx + 56} ${py}" stroke="${INK}" stroke-width="5" stroke-linecap="round" class="fx" data-d="0"/>`;
    out += `<g class="fx" data-d="0.2" style="transform-origin:${cx}px ${by}px;transform:rotate(${tilt}deg)">`
      + `<line x1="${cx - beam}" y1="${by}" x2="${cx + beam}" y2="${by}" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>`;
    const pan = (x, txt, col) => {
      const yy = by + 56;
      return `<line x1="${x}" y1="${by}" x2="${x - 34}" y2="${yy}" stroke="${MUT}" stroke-width="2"/>`
        + `<line x1="${x}" y1="${by}" x2="${x + 34}" y2="${yy}" stroke="${MUT}" stroke-width="2"/>`
        + `<rect x="${x - 52}" y="${yy}" width="104" height="46" rx="12" fill="#fff" stroke="${col}" stroke-width="3"/>`
        + `<text x="${x}" y="${yy + 31}" text-anchor="middle" font-size="21" font-weight="700" fill="${col}">${txt}</text>`;
    };
    out += pan(cx - beam, s.left || '12', P) + pan(cx + beam, s.right || '12', OK) + '</g>';
    if (s.caption) out += label(W / 2, H - 20, s.caption, { size: 19, fill: MUT, d: 0.8 });
    return out;
  }

  /* 折线统计图 */
  function linechart(s) {
    const pts = s.pts || [3, 7, 5, 9, 6], labels = s.labels || [];
    const x0 = 72, x1 = W - 56, baseY = 252, topY = 74;
    const max = Math.max.apply(null, pts), min = Math.min.apply(null, pts);
    const span = max - min || 1;
    const dx = pts.length > 1 ? (x1 - x0) / (pts.length - 1) : 0;
    let out = `<line x1="${x0}" y1="${baseY}" x2="${x1}" y2="${baseY}" stroke="${INK}" stroke-width="2"/>`;
    out += `<line x1="${x0}" y1="${baseY}" x2="${x0}" y2="${topY}" stroke="${INK}" stroke-width="2"/>`;
    const X = i => x0 + i * dx;
    const Y = v => baseY - ((v - min) / span) * 150 - 14;
    let path = '';
    pts.forEach((v, i) => { path += (i ? ' L' : 'M') + X(i) + ' ' + Y(v); });
    out += `<path d="${path}" fill="none" stroke="${P}" stroke-width="3.5" stroke-linejoin="round" class="fx draw" data-d="0.35"/>`;
    pts.forEach((v, i) => {
      out += circle(X(i), Y(v), 6, P, 0.5 + i * 0.12);
      out += label(X(i), Y(v) - 16, String(v), { size: 17, d: 0.5 + i * 0.12 });
      if (labels[i]) out += label(X(i), baseY + 24, labels[i], { size: 16, fill: MUT, d: 0.5 + i * 0.12 });
    });
    if (s.caption) out += label(W / 2, 46, s.caption, { size: 20, d: 0.1 });
    return out;
  }

  /* 扇形图 / 百分数 */
  function pie(s) {
    const parts = s.parts || [{ v: 40, label: '语文' }, { v: 30, label: '数学' }, { v: 30, label: '英语' }];
    const cols = [P, WARN, OK, '#a259d6', '#3aa8c8'];
    const cx = 196, cy = 162, r = 92;
    const sum = parts.reduce((a, p) => a + p.v, 0) || 1;
    let ang = -Math.PI / 2, out = '';
    parts.forEach((p, i) => {
      const sw = (p.v / sum) * Math.PI * 2;
      const x2 = cx + Math.cos(ang + sw) * r, y2 = cy + Math.sin(ang + sw) * r;
      const x1 = cx + Math.cos(ang) * r, y1 = cy + Math.sin(ang) * r;
      out += `<path d="M${cx} ${cy} L${x1} ${y1} A${r} ${r} 0 ${sw > Math.PI ? 1 : 0} 1 ${x2} ${y2} Z"
        fill="${cols[i % cols.length]}" fill-opacity=".85" stroke="#fff" stroke-width="2"
        class="fx" data-d="${0.1 + i * 0.18}"/>`;
      ang += sw;
    });
    parts.forEach((p, i) => {
      const yy = 96 + i * 40;
      out += `<rect x="344" y="${yy - 14}" width="16" height="16" rx="4" fill="${cols[i % cols.length]}" class="fx" data-d="${0.4 + i * 0.1}"/>`;
      out += label(370, yy, p.label + ' ' + Math.round((p.v / sum) * 100) + '%', { anchor: 'start', size: 18, d: 0.45 + i * 0.1 });
    });
    if (s.caption) out += label(W / 2, H - 18, s.caption, { size: 19, fill: MUT, d: 0.9 });
    return out;
  }

  /* 长方体的体积 */
  function volume(s) {
    const a = s.a || 4, b = s.b || 3, c = s.c || 2;
    const sMax = Math.max(a, b, c);
    const u = Math.min(46, 170 / sMax);
    const w = a * u, d = b * u * 0.55, h = c * u;
    const x0 = W / 2 - (w + d) / 2, y0 = 150 - h / 2;
    let out = '';
    out += `<path d="M${x0} ${y0} h${w} v${h} h-${w} z" fill="${P}" fill-opacity=".85" stroke="${P}" stroke-width="2" class="fx" data-d="0"/>`;
    out += `<path d="M${x0} ${y0} l${d} -${d * 0.7} h${w} l-${d} ${d * 0.7}" fill="${P}" fill-opacity=".35" stroke="${P}" stroke-width="2" class="fx" data-d="0.2"/>`;
    out += `<path d="M${x0 + w} ${y0 + h} l${d} -${d * 0.7} v-${h} l-${d} ${d * 0.7}" fill="${P}" fill-opacity=".55" stroke="${P}" stroke-width="2" class="fx" data-d="0.35"/>`;
    out += label(x0 + w / 2, y0 + h + 26, '长 ' + a, { size: 17, fill: MUT, d: 0.6 });
    out += label(x0 + w + 16, y0 + h + 8, '宽 ' + b, { anchor: 'start', size: 17, fill: MUT, d: 0.65 });
    out += label(x0 - 12, y0 + h / 2, '高 ' + c, { anchor: 'end', size: 17, fill: MUT, d: 0.7 });
    out += label(W / 2, H - 44, s.caption || (a + ' × ' + b + ' × ' + c + ' = ' + a * b * c), { size: 24, d: 0.9 });
    return out;
  }

  /* 位置与方向：方格地图 */
  function route(s) {
    const n = s.grid || 5, c = 44;
    const x0 = W / 2 - (n * c) / 2 - 24, y0 = 56;
    let out = '';
    for (let i = 0; i <= n; i++) {
      out += `<line x1="${x0}" y1="${y0 + i * c}" x2="${x0 + n * c}" y2="${y0 + i * c}" stroke="${LINE}" stroke-width="1"/>`;
      out += `<line x1="${x0 + i * c}" y1="${y0}" x2="${x0 + i * c}" y2="${y0 + n * c}" stroke="${LINE}" stroke-width="1"/>`;
    }
    const cellC = (p) => ({ x: x0 + (p[0] + 0.5) * c, y: y0 + (n - 0.5 - p[1]) * c });
    if (s.from) { const p = cellC(s.from); out += circle(p.x, p.y, 15, P, 0.2); out += label(p.x, p.y + 6, '起', { size: 15, fill: '#fff', d: 0.2 }); }
    if (s.to) { const p = cellC(s.to); out += circle(p.x, p.y, 15, BAD, 0.9); out += label(p.x, p.y + 6, '终', { size: 15, fill: '#fff', d: 0.9 }); }
    const nx = x0 + n * c + 34, ny = y0 + 30;
    out += `<g class="fx" data-d="0.1">`;
    out += `<path d="M${nx} ${ny - 18} l-9 16 h18 z" fill="${INK}"/><text x="${nx}" y="${ny + 18}" text-anchor="middle" font-size="15" font-weight="700" fill="${INK}">北</text>`;
    out += `<path d="M${nx} ${ny + 62} l-9 -16 h18 z" fill="${MUT}"/><text x="${nx}" y="${ny + 84}" text-anchor="middle" font-size="15" fill="${MUT}">南</text>`;
    out += `<text x="${nx - 30}" y="${ny + 36}" text-anchor="middle" font-size="15" fill="${MUT}">西</text>`;
    out += `<text x="${nx + 30}" y="${ny + 36}" text-anchor="middle" font-size="15" fill="${MUT}">东</text></g>`;
    if (s.caption) out += label(W / 2, H - 16, s.caption, { size: 19, fill: MUT, d: 1 });
    return out;
  }

  /* 月历 */
  function calendar(s) {
    const days = s.days || 30, start = s.start === undefined ? 0 : s.start, mark = s.mark || [];
    const cw = 58, x0 = W / 2 - (7 * cw) / 2, y0 = 74;
    const week = ['日', '一', '二', '三', '四', '五', '六'];
    let out = '';
    week.forEach((w, i) => { out += label(x0 + i * cw + cw / 2, y0, w, { size: 15, fill: MUT, d: 0 }); });
    for (let d = 1; d <= days; d++) {
      const idx = start + d - 1, r = Math.floor(idx / 7), q = idx % 7;
      const x = x0 + q * cw, y = y0 + 14 + r * 34;
      const on = mark.indexOf(d) >= 0;
      out += `<rect x="${x + 3}" y="${y}" width="${cw - 6}" height="28" rx="7" fill="${on ? WARN : '#fff'}" fill-opacity="${on ? '.9' : '0'}" stroke="${on ? WARN : LINE}" stroke-width="1" class="fx" data-d="${Math.min(0.01 * d, 0.8).toFixed(2)}"/>`;
      out += label(x + cw / 2, y + 20, String(d), { size: 15, fill: on ? '#fff' : INK, d: Math.min(0.01 * d, 0.8) });
    }
    if (s.caption) out += label(W / 2, H - 14, s.caption, { size: 19, fill: MUT, d: 0.9 });
    return out;
  }

  /* 人民币 */
  function money(s) {
    const items = s.items || [{ v: 10, n: 2 }, { v: 5, n: 1 }];
    const flat = [];
    items.forEach(it => { for (let i = 0; i < (it.n || 1); i++) flat.push(it.v); });
    const bw = 96, bh = 54, gap = 16;
    const per = Math.min(flat.length, 4);
    let out = '';
    flat.forEach((v, i) => {
      const r = Math.floor(i / 4), q = i % per;
      const x = W / 2 - (per * (bw + gap) - gap) / 2 + q * (bw + gap);
      const y = 86 + r * (bh + 22);
      const col = v >= 20 ? OK : v >= 10 ? P : WARN;
      out += `<rect x="${x}" y="${y}" width="${bw}" height="${bh}" rx="8" fill="#fff" stroke="${col}" stroke-width="2.5" class="fx" data-d="${i * 0.1}"/>`;
      out += label(x + bw / 2, y + bh / 2 + 9, v + ' 元', { size: 22, fill: col, d: i * 0.1 + 0.05 });
    });
    const total = flat.reduce((a, b) => a + b, 0);
    out += label(W / 2, H - 46, s.caption || ('一共 ' + total + ' 元'), { size: 24, d: 0.9 });
    return out;
  }

  /* 搭配 / 韦恩图 */
  function tree(s) {
    if (s.kind === 'venn') {
      const cx = W / 2, cy = 158, r = 86;
      let out = `<circle cx="${cx - 44}" cy="${cy}" r="${r}" fill="${P}" fill-opacity=".18" stroke="${P}" stroke-width="2.5" class="fx" data-d="0"/>`;
      out += `<circle cx="${cx + 44}" cy="${cy}" r="${r}" fill="${WARN}" fill-opacity=".18" stroke="${WARN}" stroke-width="2.5" class="fx" data-d="0.2"/>`;
      out += label(cx - 96, cy - r - 6, s.left || 'A', { size: 19, fill: P, d: 0.4 });
      out += label(cx + 96, cy - r - 6, s.right || 'B', { size: 19, fill: WARN, d: 0.4 });
      out += label(cx - 52, cy + 8, s.leftN === undefined ? '' : String(s.leftN), { size: 24, d: 0.5 });
      out += label(cx + 52, cy + 8, s.rightN === undefined ? '' : String(s.rightN), { size: 24, d: 0.5 });
      out += label(cx, cy + 8, s.both === undefined ? '' : String(s.both), { size: 24, fill: OK, d: 0.6 });
      if (s.caption) out += label(W / 2, H - 20, s.caption, { size: 19, fill: MUT, d: 0.8 });
      return out;
    }
    const L = s.left || ['A', 'B'], Rr = s.right || ['1', '2', '3'];
    const y0 = 92, dy = Math.min(44, 210 / Math.max(L.length, Rr.length));
    const lx = 150, rx = W - 150;
    let out = '';
    L.forEach((t, i) => {
      const y = y0 + (L.length - 1) * dy / 2 * -1 + i * dy;
      out += `<rect x="${lx - 46}" y="${y - 18}" width="92" height="36" rx="10" fill="#eef1ff" stroke="${P}" stroke-width="2" class="fx" data-d="${i * 0.1}"/>`;
      out += label(lx, y + 7, t, { size: 18, fill: P, d: i * 0.1 });
      Rr.forEach((u, j) => {
        const yy = y0 - (Rr.length - 1) * dy / 2 + j * dy;
        out += `<line x1="${lx + 48}" y1="${y}" x2="${rx - 48}" y2="${yy}" stroke="${LINE}" stroke-width="1.6" class="fx" data-d="${0.4 + i * 0.1 + j * 0.05}"/>`;
      });
    });
    Rr.forEach((t, j) => {
      const y = y0 - (Rr.length - 1) * dy / 2 + j * dy;
      out += `<rect x="${rx - 46}" y="${y - 18}" width="92" height="36" rx="10" fill="#fff5e8" stroke="${WARN}" stroke-width="2" class="fx" data-d="${j * 0.1}"/>`;
      out += label(rx, y + 7, t, { size: 18, fill: WARN, d: j * 0.1 });
    });
    if (s.caption) out += label(W / 2, H - 16, s.caption, { size: 19, fill: MUT, d: 1 });
    return out;
  }

  /* 图形的运动：平移 / 旋转 / 轴对称 */
  function transform(s) {
    const kind = s.kind || 'slide';
    const tri = (x, y, col, d, flip) => `<path d="M${x} ${y + 60} l${flip ? -46 : 46} 0 l${flip ? 46 : -46} -78 z"
      fill="${col}" fill-opacity=".85" stroke="${col}" stroke-width="2" class="fx" data-d="${d}"/>`;
    let out = tri(160, 130, P, 0.1);
    if (kind === 'slide') {
      out += tri(360, 130, OK, 0.7);
      out += `<path d="M232 168 h96" stroke="${WARN}" stroke-width="3" stroke-dasharray="7 6" class="fx" data-d="0.4"/>`;
      out += label(280, 152, '平移', { size: 18, fill: WARN, d: 0.5 });
    } else if (kind === 'turn') {
      out += `<g class="fx" data-d="0.7" style="transform-origin:340px 190px;transform:rotate(90deg)">${tri(340, 130, OK, 0)}</g>`;
      out += `<path d="M270 190 a40 40 0 0 1 40 -40" fill="none" stroke="${WARN}" stroke-width="3" class="fx" data-d="0.4"/>`;
      out += label(300, 214, '旋转 90°', { size: 18, fill: WARN, d: 0.6 });
    } else {
      out += `<line x1="300" y1="40" x2="300" y2="290" stroke="${WARN}" stroke-width="2" stroke-dasharray="7 6" class="fx" data-d="0.3"/>`;
      out += tri(390, 130, OK, 0.7, true);
      out += label(300, 306, '对称轴', { size: 17, fill: WARN, d: 0.8 });
    }
    if (s.caption) out += label(W / 2, 44, s.caption, { size: 20, d: 0.2 });
    return out;
  }

  const R = { dots, compare, ordinal, split, merge: s => mergeOrLeave(s, 'merge'), leave: s => mergeOrLeave(s, 'leave'), zero, tenframe, rods, numberline, shapes3d, shape, fraction, clock, placevalue, bar, angle, text,
    columns, grid, groups, balance, linechart, pie, volume, route, calendar, money, tree, transform };
  /* SCENE_TYPES：给内容校验脚本用 */
  window.SCENE_TYPES = Object.keys(R);

  window.SCENES = {
    render(scene) {
      if (!scene) return svg('');
      const fn = R[scene.t] || text;
      /* data-d 是节奏标记，转成 CSS 的 animation-delay，让元素一个个出来 */
      const body = fn(scene).replace(/data-d="([\d.]+)"/g,
        (m, d) => 'data-d="' + d + '" style="animation-delay:' + d + 's"');
      return svg(body);
    }
  };
})();
