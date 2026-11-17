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

  const R = { dots, compare, ordinal, split, merge: s => mergeOrLeave(s, 'merge'), leave: s => mergeOrLeave(s, 'leave'), zero, tenframe, rods, numberline, shapes3d, shape, fraction, clock, placevalue, bar, angle, text };

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
