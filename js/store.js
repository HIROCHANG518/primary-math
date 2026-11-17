/* 学习统计 + 错题本
   计算闯关（vertical.html）与知识点讲解（learn/）共用，数据存本机 localStorage。
   键：ms_stats_v2

   错题分阶：一阶 → 二阶 → … → 六阶。
   在错题练习里答对升一阶，答错回到一阶，六阶再答对就出本（记为已掌握）。
   平时正常练习又错了同一道题，也会回到一阶 —— 说明还没真会。
*/
(function (global) {
  'use strict';

  var KEY = 'ms_stats_v2';
  var MAXLV = 6;              /* 六阶之后再对一次就出本 */
  var HIST_MAX = 160;         /* 最近记录条数上限 */
  var SESSION_GAP = 5 * 60 * 1000;  /* 同一范围 5 分钟内连续作答算一次练习 */

  /* ---------- 工具 ---------- */
  function pad2(n) { return n < 10 ? '0' + n : '' + n; }
  function dayKey(ts) {
    var d = new Date(ts);
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }
  function blank() {
    return {
      v: 2,
      calc:  { total: { n: 0, ok: 0 }, stages: {}, days: {} },
      learn: { total: { n: 0, ok: 0 }, units: {}, days: {} },
      wrongs: {},
      hist: []
    };
  }
  function pick(obj) { return obj && typeof obj === 'object' ? obj : {}; }

  /* 讲解站老版本把成绩存在 learn_prog_v1，首次建库时接过来（只有最高分，没有逐题记录） */
  function migrateLegacy(t) {
    var moved = 0;
    try {
      var lp = JSON.parse(localStorage.getItem('learn_prog_v1') || '{}') || {};
      Object.keys(lp).forEach(function (id) {
        var p = lp[id];
        if (!p || typeof p !== 'object') return;
        var u = t.learn.units[id] || (t.learn.units[id] = { n: 0, ok: 0 });
        if (p.quiz != null) {
          u.best = Math.max(u.best || 0, p.quiz);
          u.bestTotal = 10;
        }
        if (p.done) u.pass = 1;
        u.legacy = 1;
        moved++;
      });
    } catch (e) {}
    return moved;
  }

  var db = null;

  function load() {
    if (db) return db;
    var raw = null;
    try { raw = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { raw = null; }
    var fresh = !(raw && raw.v === 2);
    db = fresh ? blank() : raw;
    db.calc = pick(db.calc);
    db.learn = pick(db.learn);
    ['calc', 'learn'].forEach(function (k) {
      db[k].total = db[k].total || { n: 0, ok: 0 };
      db[k].days = pick(db[k].days);
      db[k].stages = pick(db[k].stages);
      db[k].units = pick(db[k].units);
    });
    db.wrongs = pick(db.wrongs);
    if (!Array.isArray(db.hist)) db.hist = [];
    if (fresh) { migrateLegacy(db); save(); }
    return db;
  }

  /* 空间不够时按「先丢已出本的、再丢最老的记录」腾地方 */
  function compact(force) {
    var t = db;
    /* 先丢已经练出本的错题，再截断最近的记录 */
    Object.keys(t.wrongs).forEach(function (k) { if (t.wrongs[k].grad) delete t.wrongs[k]; });
    while (t.hist.length > Math.floor(HIST_MAX / 2)) t.hist.shift();
    if (force) {
      var days = Object.keys(t.calc.days).sort();
      var d2 = Object.keys(t.learn.days).sort();
      days.slice(0, Math.max(0, days.length - 30)).forEach(function (k) { delete t.calc.days[k]; });
      d2.slice(0, Math.max(0, d2.length - 30)).forEach(function (k) { delete t.learn.days[k]; });
    }
  }

  function save() {
    var s;
    try { s = JSON.stringify(db); } catch (e) { return; }
    try {
      localStorage.setItem(KEY, s);
    } catch (e) {
      compact(true);
      try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e2) {}
    }
  }

  /* ---------- 错题的稳定标识 ----------
     calc 用算式文本；learn 用「单元 + 题号」，没有题号时可用 snap.key（比如题干文本） */
  function wrongId(o) {
    var sc = o.scope || {};
    if (o.kind === 'calc') {
      var e = (o.snap && o.snap.expr) || o.title || '';
      return 'c|' + e;                       /* 同一道竖式题在任何关卡里都算同一条 */
    }
    var key = (o.snap && o.snap.key != null) ? o.snap.key : (o.snap ? o.snap.qi : '');
    return 'l|' + (sc.id || '') + '|' + key;
  }

  /* ---------- 一次练习的记录归并 ---------- */
  function pushHist(t, ts, kind, name, ok) {
    var h = t.hist;
    var last = h[h.length - 1];
    if (last && last.k === kind && last.s === name && ts - last.t < SESSION_GAP) {
      last.n++; if (ok) last.ok++;
      last.t = ts;
    } else {
      h.push({ t: ts, k: kind, s: name, n: 1, ok: ok ? 1 : 0 });
    }
    while (h.length > HIST_MAX) h.shift();
  }

  function bumpDay(box, ts, ok) {
    var dk = dayKey(ts);
    var d = box.days[dk] || (box.days[dk] = { n: 0, ok: 0 });
    d.n++; if (ok) d.ok++;
  }

  /* ---------- 记录一道题 ----------
     o = {
       kind: 'calc' | 'learn',
       ok:   true/false,
       scope: calc  { idx:关卡序号, g:年级数字, gn:'一年级', label:'20 以内进位加法' }
              learn { id:'g1au3', name:'1~5 的认识和加减法', g:1, term:'上册' },
       snap:  calc { expr, answer, cols, dotCol, rows, inputs, carries }
              learn { qi, q, a, k, why },
       title / sub: 错题本里显示的两行文字（可选）
     }
     返回：这道题如果进了错题本，返回它的 id；否则 null */
  function record(o) {
    var t = load(), ts = Date.now();
    var kind = o.kind === 'calc' ? 'calc' : 'learn';
    var box = t[kind];
    var sc = o.scope || {};

    box.total.n++; if (o.ok) box.total.ok++;
    bumpDay(box, ts, o.ok);

    if (kind === 'calc') {
      var k = String(sc.idx);
      var st = box.stages[k] || (box.stages[k] = { n: 0, ok: 0 });
      st.n++; if (o.ok) st.ok++;
      st.last = ts;
      st.g = sc.g; st.gn = sc.gn; st.label = sc.label;
    } else {
      var u = box.units[sc.id] || (box.units[sc.id] = { n: 0, ok: 0 });
      u.n++; if (o.ok) u.ok++;
      u.last = ts;
      u.g = sc.g; u.term = sc.term; u.name = sc.name;
    }

    var wid = null;
    if (!o.ok) {
      wid = wrongId(o);
      var r = t.wrongs[wid];
      if (!r) {
        r = t.wrongs[wid] = {
          k: kind === 'calc' ? 'c' : 'l',
          lv: 1, n: 1, first: ts, last: ts,
          title: o.title || sc.label || sc.name || '',
          sub: o.sub || '',
          scope: kind === 'calc' ? sc.idx : sc.id,
          g: sc.g || 0,
          snap: o.snap || null
        };
      } else {
        r.n++; r.last = ts;
        r.lv = 1;                 /* 又错了，说明没真会，从一阶重来 */
        delete r.grad;
        if (o.snap) r.snap = o.snap;
      }
    }

    pushHist(t, ts, kind, sc.label ? (sc.gn ? sc.gn + ' · ' + sc.label : sc.label) : (sc.name || ''), o.ok);
    save();
    return wid;
  }

  /* ---------- 错题练习结果 ----------
     ok: 答对 → 升一阶；六阶再对 → 出本
     答错 → 回到一阶 */
  function review(wid, ok) {
    var t = load(), r = t.wrongs[wid];
    if (!r) return null;
    var ts = Date.now();
    var kind = r.k === 'c' ? 'calc' : 'learn';
    var box = t[kind];

    box.total.n++; if (ok) box.total.ok++;
    bumpDay(box, ts, ok);

    if (kind === 'calc') {
      var st = box.stages[String(r.scope)];
      if (st) { st.n++; if (ok) st.ok++; st.last = ts; }
    } else {
      var u = box.units[r.scope];
      if (u) { u.n++; if (ok) u.ok++; u.last = ts; }
    }

    r.n++;
    r.last = ts;
    if (ok) {
      r.lv = (r.lv || 1) + 1;
      if (r.lv > MAXLV) { r.grad = 1; r.gradAt = ts; }
    } else {
      r.lv = 1;
      delete r.grad;
    }

    pushHist(t, ts, kind, '错题练习 · 第 ' + Math.min(r.lv, MAXLV) + ' 阶', ok);
    save();
    return r;
  }

  /* ---------- 关卡通过 / 单元最佳成绩 ---------- */
  function stagePass(idx) {
    var t = load();
    var st = t.calc.stages[String(idx)] || (t.calc.stages[String(idx)] = { n: 0, ok: 0 });
    st.pass = 1;
    save();
  }
  function unitBest(id, score, total, pass) {
    var t = load();
    var u = t.learn.units[id] || (t.learn.units[id] = { n: 0, ok: 0 });
    if (score > (u.best || 0)) u.best = score;
    u.bestTotal = total;
    if (pass) u.pass = 1;
    save();
  }

  /* ---------- 查询 ---------- */
  function all() { return load(); }

  function rate(a, b) { return b ? Math.round(a / b * 100) : 0; }

  function summary() {
    var t = load();
    var c = t.calc.total, l = t.learn.total;
    var counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, grad: 0 };
    Object.keys(t.wrongs).forEach(function (k) {
      var r = t.wrongs[k];
      if (r.grad) counts.grad++;
      else counts[Math.min(MAXLV, r.lv || 1)]++;
    });
    var pending = 0;
    for (var i = 1; i <= MAXLV; i++) pending += counts[i];
    var unitsDone = 0, unitsTouched = 0;
    Object.keys(t.learn.units).forEach(function (k) {
      unitsTouched++;
      if (t.learn.units[k].pass) unitsDone++;
    });
    var stagesTouched = 0, stagesPassed = 0;
    Object.keys(t.calc.stages).forEach(function (k) {
      stagesTouched++;
      if (t.calc.stages[k].pass) stagesPassed++;
    });
    return {
      calc: { n: c.n, ok: c.ok, rate: rate(c.ok, c.n), stagesTouched: stagesTouched, stagesPassed: stagesPassed },
      learn: { n: l.n, ok: l.ok, rate: rate(l.ok, l.n), unitsTouched: unitsTouched, unitsDone: unitsDone },
      wrong: counts, wrongPending: pending, wrongGrad: counts.grad
    };
  }

  /* 某年级的计算表现 */
  function calcByGrade() {
    var t = load(), out = {};
    Object.keys(t.calc.stages).forEach(function (k) {
      var s = t.calc.stages[k];
      var g = s.g || 0;
      var box = out[g] || (out[g] = { n: 0, ok: 0, stages: 0, passed: 0, name: s.gn || '' });
      box.n += s.n; box.ok += s.ok; box.stages++;
      if (s.pass) box.passed++;
      if (s.gn) box.name = s.gn;
    });
    return out;
  }

  /* 某册的知识点表现：key 用 'g1au' 这种前缀 */
  function learnByBook() {
    var t = load(), out = {};
    Object.keys(t.learn.units).forEach(function (id) {
      var u = t.learn.units[id];
      var book = id.slice(0, 3);
      var box = out[book] || (out[book] = { n: 0, ok: 0, units: 0, done: 0, g: u.g, term: u.term });
      box.n += u.n; box.ok += u.ok; box.units++;
      if (u.pass) box.done++;
    });
    return out;
  }

  /* 最近 days 天的题量与正确率，按日期升序 */
  function trend(days) {
    var t = load(), out = [];
    var base = new Date();
    base.setHours(0, 0, 0, 0);
    for (var i = days - 1; i >= 0; i--) {
      var d = new Date(base.getTime() - i * 86400000);
      var k = dayKey(d.getTime());
      var a = (t.calc.days[k] || { n: 0, ok: 0 });
      var b = (t.learn.days[k] || { n: 0, ok: 0 });
      out.push({ day: k, label: (d.getMonth() + 1) + '/' + d.getDate(),
                 n: a.n + b.n, ok: a.ok + b.ok });
    }
    return out;
  }

  /* 某一阶的错题，按最近出错时间倒序 */
  function wrongList(lv) {
    var t = load(), out = [];
    Object.keys(t.wrongs).forEach(function (k) {
      var r = t.wrongs[k];
      if (lv === 'grad') { if (!r.grad) return; }
      else if (r.grad || (r.lv || 1) !== lv) return;
      out.push(Object.assign({ id: k }, r));
    });
    out.sort(function (a, b) { return (b.last || 0) - (a.last || 0); });
    return out;
  }

  function wrongOf(id) {
    var t = load();
    var r = t.wrongs[id];
    return r ? Object.assign({ id: id }, r) : null;
  }

  function histList(n) {
    var t = load();
    return t.hist.slice().reverse().slice(0, n || 20);
  }

  function reset() {
    db = blank();
    try { localStorage.removeItem(KEY); } catch (e) {}
    save();
  }

  /* 清空某一类（'calc' | 'learn' | 'wrong'） */
  function resetPart(part) {
    var t = load();
    if (part === 'calc') { t.calc = blank().calc; }
    else if (part === 'learn') { t.learn = blank().learn; }
    else if (part === 'wrong') { t.wrongs = {}; }
    save();
  }

  global.MS = {
    MAXLV: MAXLV,
    record: record,
    review: review,
    stagePass: stagePass,
    unitBest: unitBest,
    summary: summary,
    calcByGrade: calcByGrade,
    learnByBook: learnByBook,
    trend: trend,
    wrongList: wrongList,
    wrongOf: wrongOf,
    histList: histList,
    all: all,
    reset: reset,
    resetPart: resetPart,
    key: KEY
  };
})(window);
