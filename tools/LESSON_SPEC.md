# 知识点讲解内容规范（写 lessons 片段前必读）

产出物：`learn/data/lessons/src/<unitId>.js`，一个文件 = 一个单元，文件名必须等于 outline 里的单元 id。

## 片段格式（照抄骨架）

```js
/* g1au1 · 准备课 */
Object.assign(window.LESSONS = window.LESSONS || {}, {
  'g1au1': {
    grade: 1, term: '上册', unit: '准备课',
    color: '#f4874b',
    points: ['与 outline.js 里该单元的要点逐条对应，可略作合并，但不能漏'],
    intro: '一句话交代这节要解决什么问题，30~70 字，口语。',
    steps: [
      { say: '一句讲解（口语，12~120 字，讲一个点）', scene: { t: 'dots', n: 3, caption: '图下方的字' } }
    ],
    quiz: [
      { q: '题干', a: ['选项A', '选项B', '选项C'], k: 1, why: '解析，讲清为什么' }
    ]
  }
});
```

- `grade`/`term`/`unit`/`color` 必须与 `learn/data/outline.js` 里该单元一致（color 用该年级的年级色）。
- `steps` 8~12 步；`quiz` 恰好 10 题，三选一，`k` 是正确项下标 0/1/2。
- 正确答案位置要打散，A/B/C 大致各 3~4 题，不能集中在 B。

## 语音（say）写作规则 —— 会直接送去 TTS，读错就废

1. **不写数学符号**：`+ − × ÷ = < > % ≈` 一律写成中文（「加、减、乘、除、等于、小于、大于、百分之、约等于」）。`~` 也不要用。
2. 数字可以直接写（「47 加 25」可以），但分数写成「四分之三」，小数写「零点五」，百分数写「百分之六十」，单位写「平方厘米」「立方米」。
3. 一句话只讲一个点，20~80 字最稳；超过 100 字要拆成两步。
4. 口语，像坐在孩子旁边讲，不念稿、不喊口号、不用「同学们」。不用 Markdown、不用引号包裹公式。
5. 每句以句号/问号/感叹号结尾。
6. 少用「如图」「看这里」，改用「你看」「注意这两个数」。

## 教学要求

- 先讲**为什么**（意义/算理），再讲**怎么做**（算法），最后**易错点**。错例要具体。
- 每个要点都要落到正确说法上，不能只说「要注意」，要说清注意什么、错了会怎样。
- 结合生活情境（分东西、排队、买东西、量长度），但不要每步都换场景。
- 已对照人教版教材（旧版单元顺序，按 outline.js）——**不要改单元名、不要改顺序**。
- 讲解要「讲透」：一个算理至少给一次直观解释（点子图/小棒/方格/数轴/竖式）。

## 场景（scene）可用类型与参数（30 种，`t` 必填）

| t | 参数 | 用途 |
|---|---|---|
| dots | n, perRow, r, gap, color, showNum, caption | 点阵数数 |
| compare | a, b, caption | 两组点一一对应比大小（a 上 b 下） |
| ordinal | items:['🐰',…], pos, title | 第几（从左数第 pos 个高亮） |
| split | total, a, b, caption | 分与合 |
| merge | a, b, result, caption | 加法（合起来） |
| leave | a, b, result, caption | 减法（去掉） |
| zero | n, eq:'3 − 3 = 0', caption | 0 的意义 |
| tenframe | n | 十格图（满十进位） |
| rods | tens, ones | 小棒：整捆与单根（数位） |
| numberline | from, to, mark:[…] | 数轴（可标点） |
| shapes3d | kinds:['cuboid','cube','cylinder','sphere'] | 立体图形 |
| shape | kind:'rect'\|'square'\|'triangle'\|'circle'\|'parallelogram', notes:[{x,y,t}], caption | 平面图形 |
| fraction | den, num, caption, title | 分数条 |
| clock | h, m, caption | 钟面 |
| placevalue | digits:'308', heads:['百位','十位','个位'], title, caption | 数位表 |
| bar | items:[{k,v,c}], caption | 条形统计图 |
| angle | deg, caption | 角（度数） |
| text | lines:['第一行','第二行'] | 纯文字要点（少用） |
| columns | a:'47', b:'25', op:'+', result:'72', caption | 竖式（加减乘除都行） |
| grid | rows, cols, fill, cell, rowLabel, colLabel, caption | 阵列/面积/百数表 |
| groups | total, groups, each, showEach, caption | 平均分/包含除 |
| balance | left:'x + 3', right:'9', tilt:-8, caption | 天平/等式（tilt 负=左低） |
| linechart | pts:[3,7,5,9], labels:['一','二','三','四'], caption | 折线统计图 |
| pie | parts:[{v:40,label:'语文'}], caption | 扇形图/百分数 |
| volume | a:4, b:3, c:2, caption | 长方体体积（棱长标注） |
| route | grid:5, from:[0,0], to:[3,2], caption | 方格地图 + 方向标（[列,行]，行从下往上） |
| calendar | days:29, start:4, mark:[29], caption | 月历（start=1 号是星期几，0=周日） |
| money | items:[{v:10,n:2},{v:5,n:1}], caption | 人民币 |
| tree | left:['A','B'], right:['1','2','3'], caption；或 kind:'venn', left/right/leftN/rightN/both | 搭配/韦恩图 |
| transform | kind:'slide'\|'turn'\|'flip', caption | 平移/旋转/轴对称 |

场景里的 `caption` 会用中文字体直接画在图上，可以带符号（`3 + 5 = 8` 没问题），但 say 里不行。

一节至少要换 4 种场景，同一场景不要连续用三次。

## 题目（quiz）要求

- 覆盖本节每个要点，难度递增：前 3 题基础识记，中间 4 题计算/判断，后 3 题应用/易错。
- 干扰项要像真的错法（漏进位、单位没换、看错数位），不要凑数。
- `why` 30~60 字，讲清算理而不只是「所以选 B」。
- 不出超出本单元知识范围的内容（尤其低年级不要用乘除）。

## 自检

```bash
cd primary-math
node tools/check_lessons.js g1a   # 或对应册
node tools/build_book.js g1a
```
校验必须 0 错误。WARN 里「要点未覆盖」要补，「正确答案分布不均」要打散。
