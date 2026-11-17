"""把 OCR 结果拼成 markdown：按行块聚合、保留页码便于回查原图。"""
import json, os, re, statistics

BASE = "/Users/xinzhang/WorkBuddy/2026-11-16-22-15-29/primary-math/reference/xb-notes"
OUT = "/Users/xinzhang/WorkBuddy/2026-11-16-22-15-29/primary-math/reference/小学学霸笔记-数学.md"

pages = json.load(open(os.path.join(BASE, "pages.json"), encoding="utf-8"))


TWO_COL_PAGES = set(range(1, 7))   # 目录页是左右两栏，需按栏读


def split_margin(page):
    """把左侧窄栏的批注/旁注与正文分开，避免批注插进正文中间"""
    w, h = page["width"], page["height"]
    main, margin = [], []
    for l in page["lines"]:
        cx = (l["x"] + l["w"] / 2) * w
        lw = l["w"] * w
        if cx < 0.30 * w and lw < 0.26 * w:
            margin.append(l)
        else:
            main.append(l)
    return main, margin


def columnize(page):
    w = page["width"]
    left = [l for l in page["lines"] if (l["x"] + l["w"] / 2) * w < w * 0.5]
    right = [l for l in page["lines"] if (l["x"] + l["w"] / 2) * w >= w * 0.5]
    key = lambda x: (round(x["y"], 2), x["x"])
    return sorted(left, key=key) + sorted(right, key=key)


def blocks_of(page):
    lines = page["lines"]
    if not lines:
        return []
    hs = [l["h"] for l in lines if l["h"] > 0]
    med_h = statistics.median(hs) if hs else 0.02
    gap_th = max(med_h * 0.55, 0.012)
    blocks, cur = [], []
    prev_bottom = None
    for l in lines:
        top = l["y"]
        if prev_bottom is not None and top - prev_bottom > gap_th and cur:
            blocks.append(cur)
            cur = []
        cur.append(l)
        prev_bottom = max(prev_bottom or 0, l["y"] + l["h"])
    if cur:
        blocks.append(cur)
    out = []
    for b in blocks:
        # 块内按行合并：同一行（y 接近）横向拼接，否则换行
        b = sorted(b, key=lambda x: (round(x["y"], 2), x["x"]))
        text, last = "", None
        for l in b:
            t = l["text"].strip()
            if not t:
                continue
            if last is not None and abs(l["y"] - last) < med_h * 0.5:
                text += t
            else:
                text += ("\n" if text else "") + t
            last = l["y"]
        if text.strip():
            out.append(text.strip())
    return out


def clean(t):
    t = t.replace("日期｜Date", "").replace("日期|Date", "")
    t = re.sub(r"^\s*\n+", "", t)
    return t.strip()


chunks = []
for p in pages:
    if p["page"] in TWO_COL_PAGES:
        saved = p["lines"]
        p["lines"] = columnize(p)
        bs = [clean(b) for b in blocks_of(p)]
        p["lines"] = saved
        note = ""
    else:
        main, margin = split_margin(p)
        saved = p["lines"]
        p["lines"] = main
        bs = [clean(b) for b in blocks_of(p)]
        p["lines"] = margin
        mbs = [clean(b) for b in blocks_of(p)]
        p["lines"] = saved
        note = "\n\n> 旁注：" + " / ".join(mbs) if mbs else ""
    bs = [b for b in bs if b]
    body = "\n\n".join(bs)
    if not body:
        body = "（本页无可识别文字）"
    chunks.append("### 第 %d 页\n\n%s%s\n" % (p["page"], body, note))

header = """# 小学学霸笔记 · 数学（OCR 转写稿）

> 来源：`~/Downloads/小学学霸笔记-数学.pdf`（229 页，CamScanner 扫描，无文本层）
> 转写方式：macOS Vision OCR（`zh-Hans`，accurate），按行块聚合，保留页序
> 用途：作为备课参考，取内容时读这份 md 省 token；**图形、表格、排版细节仍回看原图**
> 图片位置：`reference/xb-notes/pages/p001.jpg` … `p229.jpg`（2 倍渲染，JPEG）
> 逐页原始文本：`reference/xb-notes/txt/pNNN.txt`

---

"""
open(OUT, "w", encoding="utf-8").write(header + "\n".join(chunks))
print("wrote", OUT, os.path.getsize(OUT), "bytes")
