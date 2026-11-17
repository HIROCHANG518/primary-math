# 拨轮数字输入组件（Dial / Digit Wheel）

竖式计算里「结果填几位数」的输入控件。手指上下拖动整轮、松手吸附到整数；桌面用滚轮或点上下箭头。

- 独立可运行演示：`docs/dial-demo.html`（双击就能在浏览器打开，触屏/滚轮都能试）
- 正式出处：`vertical.html`，样式 150–186 行、构建 1108–1140 行、手势与滚轮 1632–1720 行、判题 1581–1596 行

---

## 1. 视觉结构

```
┌──────────────┐  ← .dial（视窗，高 = 2 个数字格）
│  3    ▲      │  ← 上半格：显示上一个数字的下半截 + 加一热区
├──────────────┤  ← .dband 上边线
│     7        │  ← 中间满格：当前值 .dnum.cur
├──────────────┤  ← .dband 下边线
│  8    ▼      │  ← 下半格：显示下一个数字的上半截 + 减一热区
└──────────────┘
   .dstrip 在里面整体上下平移，.dfade 在最上层做上下渐隐
```

层级（z-index 从下往上）：`.dstrip`(2，数字) → `.dband`(1，取景框线) → `.dfade`(3，渐隐) → `.dbtn`(4，箭头热区)

HTML：

```html
<div class="dial" data-id="o" role="spinbutton" aria-label="结果数字：上下拖动或点上下箭头">
  <div class="dstrip">
    <div class="dnum">7</div>   <!-- 索引 0，对应 -3 -->
    ...
    <div class="dnum cur">0</div> <!-- 实际要显示的值 -->
    ...
    <div class="dnum">2</div>   <!-- 索引 15，对应 12 -->
  </div>
  <i class="dband"></i>
  <i class="dfade"></i>
  <button class="dbtn up" data-step="1" aria-label="加一">▲</button>
  <button class="dbtn dn" data-step="-1" aria-label="减一">▼</button>
</div>
```

数字带铺 **从 −3 到 12 共 16 个 `div.dnum`**（`DIAL_PAD = 3`），内容取 `((i % 10) + 10) % 10`，所以 0~9 循环出现，往下拖到头也能看到相邻数，不会露白。

---

## 2. 样式（原样复制，数值不要改）

```css
.dial{
  --dh:46px;                              /* 单个数字的高度 */
  position:relative;border-radius:13px;overflow:hidden;
  width:56px;height:calc(var(--dh) * 2);  /* 视窗 = 中间满格 + 上下各半格 */
  border:1.5px solid #cdd8ec;
  background:linear-gradient(#e7edfa,#f9fbff 30%,#f9fbff 70%,#e7edfa);
  box-shadow:0 2px 5px rgba(22,40,80,.07),inset 0 12px 14px -12px rgba(22,40,80,.3),inset 0 -12px 14px -12px rgba(22,40,80,.3);
  touch-action:none;-webkit-user-select:none;user-select:none;
  -webkit-tap-highlight-color:transparent;margin:3px 0 1px;
  transition:border-color .18s,box-shadow .18s,background .18s;
}
.dial.on{border-color:var(--pri);box-shadow:0 0 0 4px var(--pri-soft),inset 0 12px 14px -12px rgba(22,40,80,.3)}
.dial.ok{border-color:var(--ok);background:linear-gradient(#e4f7ee,#f5fdf9 30%,#f5fdf9 70%,#e4f7ee)}
.dial.bad{border-color:var(--bad);background:linear-gradient(#fdeded,#fef9f9 30%,#fef9f9 70%,#fdeded)}
.dstrip{position:relative;z-index:2;transition:transform .32s cubic-bezier(.34,1.42,.6,1);will-change:transform}
.dial.dragging .dstrip{transition:none}
.dnum{height:var(--dh);line-height:var(--dh);text-align:center;font-size:32px;font-weight:600;
  font-variant-numeric:tabular-nums;color:#aab5ca;letter-spacing:-.02em}
.dnum.cur{color:#141d33;font-weight:700}
.dnum.nb{color:#93a0bb}
.dnum.far{color:#c8d2e3}
.dband{position:absolute;left:0;right:0;top:50%;height:var(--dh);transform:translateY(-50%);
  z-index:1;pointer-events:none;border-top:1px solid rgba(74,99,216,.22);border-bottom:1px solid rgba(74,99,216,.22);
  background:rgba(255,255,255,.42)}
.dfade{position:absolute;inset:0;z-index:3;pointer-events:none;
  background:linear-gradient(rgba(249,251,255,.62) 0%,rgba(249,251,255,.26) 12%,rgba(249,251,255,0) 30%,
             rgba(249,251,255,0) 70%,rgba(249,251,255,.26) 88%,rgba(249,251,255,.62) 100%)}
.dbtn{position:absolute;left:0;right:0;height:calc(var(--dh) * .62);border:0;padding:0;margin:0;
  background:transparent;cursor:pointer;z-index:4;display:flex;justify-content:flex-start;
  font-size:9px;line-height:1;color:#8e9ab4;opacity:.85;padding-left:4px;padding-right:0;
  -webkit-tap-highlight-color:transparent;transition:color .15s,opacity .15s}
.dbtn.up{top:0;align-items:flex-start;padding-top:2px}
.dbtn.dn{bottom:0;align-items:flex-end;padding-bottom:2px}
.dbtn:active,.dbtn:hover{color:var(--pri);opacity:1}
.dial.flash{animation:dialflash .42s}
@keyframes dialflash{0%{transform:scale(1)}45%{transform:scale(1.05)}100%{transform:scale(1)}}
@media (hover:none){ .dbtn{opacity:.8} }
```

依赖的外部变量：`--pri`(主色 `#4a63d8`)、`--pri-soft`(`#eef1ff`)、`--ok`(`#1f9c66`)、`--bad`(`#dc4f4f`)。

设计要点：

| 数值 | 为什么是这个 |
|---|---|
| `height:calc(var(--dh)*2)` | 中间一整格 + 上下各半格，正好露出相邻数字的一半，让人知道上下还有数 |
| `overflow:hidden` | 数字带靠它裁掉外面多余的格子 |
| `--dh:46px` / 字号 32px | 数字占格高的 70%，留出呼吸空间；46px 也是 iPad 上手指容易点准的高度 |
| `font-variant-numeric:tabular-nums` | 等宽数字，滚动时不会左右抖 |
| `.dband` 的两条线 | 画在 `top:50%` 再 `translateY(-50%)`，正好切在上下半格的分界，视觉上「框住」当前值 |
| `.dfade` 只做到 62% 不透明度 | 再深就看不见邻格数字了；只压边缘不进中间 |
| `.dbtn` 高 `0.62*dh` 且 `justify-content:flex-start` | 热区占满整条宽度（好点），箭头画在左边缘，不压住中间的 32px 数字 |
| `touch-action:none` | 否则 iOS 上手指一竖划就触发页面滚动，拖不动轮子 |

---

## 3. 几何：滚到某个数字的位移公式

数字带第 `k` 格的**中心**相对带顶是 `k*dh + dh/2`；视窗中心在 `dh` 处。要让第 `k` 格居中，带顶必须上移：

```
translateY = -(k*dh + dh/2 - dh) = -(k - 0.5) * dh
其中 k = v + DIAL_PAD   （v 是 0~9，PAD=3）
```

```js
const DIAL_PAD = 3;

function placeDial(el, v, instant){
  const dh = el.querySelector('.dnum').offsetHeight || 46;   /* 必须等元素已进 DOM，兜底 46 */
  const strip = el.querySelector('.dstrip');
  if(instant) strip.style.transition = 'none';
  strip.style.transform = 'translateY(' + (-(Number(v) + DIAL_PAD - 0.5) * dh) + 'px)';
  if(instant){ void strip.offsetWidth; strip.style.transition = ''; }  /* 强制回流后再恢复过渡 */
  const k = Number(v) + DIAL_PAD;
  el.querySelectorAll('.dnum').forEach((n,i)=>{
    const dst = Math.abs(i - k);
    n.className = 'dnum' + (dst === 0 ? ' cur' : dst === 1 ? ' nb' : ' far');  /* 当前/相邻/远处，三档颜色 */
  });
  return dh;
}
```

`instant=true` 只在初始化用（首屏不想要一屏数字滚上来）。`void strip.offsetWidth` 是强制重排，没有它浏览器会把「设成 none → 设成 ''」合并掉，过渡恢复不了。

---

## 4. 交互映射

| 操作 | 行为 | 代码位置 |
|---|---|---|
| 手指上下拖（>4px） | 跟手平移，`dragging` 去掉过渡；位移限制 ±2.4 格 | `touchmove` |
| 松手 | `steps = Math.round(dy/dh)`，值 = `(base - steps + 10) % 10`；轮子闪一下 | `touchend` |
| 轻点（<4px） | 不当作拖，交给 click | `touchend` 里 `if(!d.moved) return` |
| 点上半格 ▲ | +1，轮子亮 `on` 650ms | `click` 里的 `.dbtn` 分支 |
| 点下半格 ▼ | −1 | 同上，`data-step="-1"` |
| 鼠标滚轮 | `deltaY>0` 减一，否则加一 | `wheel` |
| 判题 | 加 `ok` / `bad` 类，边框和底色变绿/红 | `check()` |

**方向约定**：向上拖 → 数字**变大**（`base - steps` 里 `steps` 是负数，减负等于加），因为数字带跟着手指往上走，中间露出来的是原本在下方、序号更大的数。滚轮向下滚 → 减一（等价于内容往上走）。三条通道方向一致，和 iOS 原生 picker 相同：

| 操作 | 值 |
|---|---|
| 手指往上拖一格 | +1 |
| 手指往下拖一格 | −1（0 再往下是 9）|
| 点上半格 ▲ | +1 |
| 点下半格 ▼ | −1 |
| 滚轮向下（`deltaY>0`） | −1 |
| 键盘 ↑ | +1 |

**死区**：`Math.abs(dy) < 4` 不算拖。作用是指尖轻微抖动不会把「点箭头」变成「拖一格」。

**抖动锁**：`dragGuard`。手指拖完松手时，浏览器还会补一个 click 事件，如果落点正好在 `.dbtn` 热区上就会又跳一格。所以 `touchend` 记下时间，`click` 里判断 `Date.now() - dragGuard > 320` 才响应。

---

## 5. 完整控制逻辑

```js
/* 生成一个拨轮。id 是这道题里结果格的标识，判题靠它回查 */
function inputHTML(id){
  let nums = '';
  for(let i = -DIAL_PAD; i <= 9 + DIAL_PAD; i++)
    nums += '<div class="dnum">' + (((i % 10) + 10) % 10) + '</div>';
  return '<div class="dial" data-id="' + id + '" role="spinbutton" aria-label="结果数字：上下拖动或点上下箭头">' +
    '<div class="dstrip">' + nums + '</div>' +
    '<i class="dband"></i><i class="dfade"></i>' +
    '<button class="dbtn up" data-step="1" aria-label="加一">▲</button>' +
    '<button class="dbtn dn" data-step="-1" aria-label="减一">▼</button></div>';
}

/* 唯一的写入口：改 state.res 再让轮子滚过去 */
function setResult(id, v){
  state.res[id] = String(v);
  const el = document.querySelector('.dial[data-id="' + id + '"]');
  if(el) placeDial(el, v);          /* 滚动本身就是动画，不用额外做 */
}

/* ---------- 拖拽 ---------- */
let drag = null;

stage.addEventListener('touchstart', e => {
  const d = e.target.closest('.dial');
  drag = null;
  if(!d || state.playing || state.answered) return;     /* 讲解中/已判题时锁死 */
  drag = {
    el: d, id: d.dataset.id,
    y0: e.touches[0].clientY,
    base: Number(state.res[d.dataset.id] || 0),
    dh: d.querySelector('.dnum').offsetHeight || 46,
    dy: 0, moved: false
  };
}, { passive: true });

stage.addEventListener('touchmove', e => {
  if(!drag) return;
  const dy = e.touches[0].clientY - drag.y0;
  if(!drag.moved){
    if(Math.abs(dy) < 4) return;
    drag.moved = true;
    drag.el.classList.add('dragging');
    drag.el.classList.remove('ok', 'bad');       /* 一动就清掉对错颜色 */
  }
  e.preventDefault();                            /* 配合 touch-action:none 阻止页面滚动 */
  const lim = drag.dh * 2.4;
  drag.dy = Math.max(-lim, Math.min(lim, dy));
  drag.el.querySelector('.dstrip').style.transform =
    'translateY(' + (-(drag.base + DIAL_PAD - 0.5) * drag.dh + drag.dy) + 'px)';
}, { passive: false });                          /* 要 preventDefault 必须 passive:false */

stage.addEventListener('touchend', () => {
  if(!drag) return;
  const d = drag; drag = null;
  d.el.classList.remove('dragging');
  if(!d.moved) return;
  dragGuard = Date.now();
  const steps = Math.round(d.dy / d.dh);
  setResult(d.id, ((d.base - steps) % 10 + 10) % 10);   /* 取模保证 0~9 循环 */
  d.el.classList.add('flash');
  setTimeout(() => d.el.classList.remove('flash'), 440);
}, { passive: true });

stage.addEventListener('touchcancel', () => {
  if(!drag) return;
  const d = drag; drag = null;
  d.el.classList.remove('dragging');
  setResult(d.id, d.base);                       /* 来电/手势冲突取消时回原位 */
});

/* ---------- 桌面滚轮 ---------- */
stage.addEventListener('wheel', e => {
  const dial = e.target.closest('.dial');
  if(!dial || state.playing || state.answered) return;
  e.preventDefault();
  const id = dial.dataset.id;
  setResult(id, (Number(state.res[id] || 0) + (e.deltaY > 0 ? -1 : 1) + 10) % 10);
}, { passive: false });

/* ---------- 箭头点击 ---------- */
let dragGuard = 0;
stage.addEventListener('click', e => {
  const btn = e.target.closest('.dbtn');
  if(btn && !state.playing && !state.answered && Date.now() - dragGuard > 320){
    const dial = btn.closest('.dial');
    const id = dial.dataset.id;
    setResult(id, (Number(state.res[id] || 0) + Number(btn.dataset.step) + 10) % 10);
    dial.classList.add('on');
    dial.classList.remove('ok', 'bad');
    setTimeout(() => dial.classList.remove('on'), 650);
  }
});
```

事件全部绑在容器 `#stage` 上，用 `closest('.dial')` 委托——题目重建（`innerHTML` 覆盖）后不用重新绑事件，这一点很重要。

---

## 6. 状态类一览

| 类 | 加在哪 | 含义 |
|---|---|---|
| `.on` | `.dial` | 刚被点过（主色描边 + 外发光），650ms 后自动摘 |
| `.dragging` | `.dial` | 正在拖，`.dstrip` 过渡关掉 |
| `.ok` | `.dial` | 判题正确：绿边 + 绿底渐变 |
| `.bad` | `.dial` | 判题错误：红边 + 红底渐变 |
| `.flash` | `.dial` | 松手后放大回弹 1.05 倍，420ms |
| `.cur` / `.nb` / `.far` | `.dnum` | 当前值（深色加粗）/ 相邻（中灰）/ 远处（浅灰） |

---

## 7. 与题目模型的对接

题目对象里结果格只记「id + 正确值」，控件类型由全局 `state.design` 决定，两种控件共用同一套判题：

```js
/* 结果格定义 */
inputs: [{ id: 'r0', ans: '7' }, { id: 'r1', ans: '2' }]

/* 判题：只认 data-id，不关心是 .dial 还是 .vinp */
q.inputs.forEach(inp => {
  const el = document.querySelector('[data-id="' + inp.id + '"]');
  el.classList.remove('ok', 'bad');
  if((state.res[inp.id] || '') === inp.ans) el.classList.add('ok');
  else el.classList.add('bad');
});
```

两个前提：

1. `.dial` 和 `.vinp` 都带 `data-id`，且同一个 id 在页面上唯一。
2. 每次重建题目要把 `state.res` 清空并 `placeDial(el, 0, true)` 初始化，否则会带着上一题的数字。

---

## 8. 移植时的坑

1. **`offsetHeight` 必须在元素进 DOM 之后测**。刚 `innerHTML` 赋值想立刻量，量到的是 0（有 `|| 46` 兜底，但会错位）。
2. **`instant` 初始化必须强制回流**（`void strip.offsetWidth`），否则过渡恢复不生效，首屏会看到数字滚上来。
3. **`touchmove` 要 `{passive:false}`**，否则 `preventDefault()` 无效，iOS 上页面会跟着滚。
4. **`.dial` 上必须有 `touch-action:none`**，只靠 `preventDefault` 在部分 Android WebView 上不保险。
5. **`dragging` 类不能漏**。漏了以后 `transition:.32s` 会作用在跟手位移上，手指动一格它慢半拍，拖起来像在拉橡皮筋。
6. **取模要写 `((x % 10) + 10) % 10`**。JS 的 `%` 对负数返回负值，`-1 % 10 === -1`，直接用作索引会拿到 `undefined`。
7. **`dragGuard` 不能省**。省了以后每次拖完松手，如果手指停在箭头热区，会再多跳一格。
8. **判题后要锁输入**（`state.answered`），否则孩子判完还能改数字，错题统计就乱了。
9. **`.dnum` 的颜色别只留两档**。只区分「当前 / 其他」时，上下半格和更远的格子一样灰，滚动时看不出层次。
10. **原版没有键盘支持**，只有触屏拖动 + 滚轮 + 箭头点击。要在桌面用 ↑↓，得自己加（演示页里有一段可参考，用 `pointerdown` 记焦点 `data-id`）。

---

## 9. 无障碍

- 容器 `role="spinbutton"`，`aria-label` 说明操作方式。
- 箭头是真 `<button>`，带 `aria-label="加一" / "减一"`，键盘 Tab 可达、Enter 可触发。
- 数字带本身是装饰性的位置，读屏不会逐格念（`div` 无 role）。
- 若需要严格无障碍，建议补 `aria-valuenow / aria-valuemin / aria-valuemax`，并在 `setResult` 里同步更新——原版没做，因为主要用户是孩子在 iPad 上手拖。

---

## 10. 快速自测清单

- [ ] 首屏三个轮子都停在 0，没有滚入动画
- [ ] 慢拖一格，松手吸附到相邻数字，轮子闪一下
- [ ] 快速上甩，最多只走 2.4 格，不会连跳
- [ ] 从 0 往下拖，变成 9（循环）
- [ ] 从 0 往上拖，变成 1
- [ ] 拖到一半手指松开（touchcancel），回到原值
- [ ] 拖完手指停在 ▲ 上，不会额外 +1
- [ ] 滚轮向下滚一格，数字 −1
- [ ] 判题后红/绿描边正确，且不能再改
