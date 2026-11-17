"""给同一句话做几种后期处理，生成试听对比样本。
用法：python3 tools/voice_probe.py
输出：voice-samples/probe/<key>-<方案>.mp3 与 index.json

对比三档：
  raw  原声，不做处理
  D    裁首尾 + 两级降噪（上一轮选的方案，句间停顿处有「啵」）
  E    裁首尾 + 两级降噪 + 停顿整段填静音（本轮修复）
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import postproc
from gen_audio import tts

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "voice-samples", "probe")
SR = 48000

WANT = ["g1au3-0", "g4bu3-0", "g6bu6-3"]
LABELS = {
    "g1au3-0": "一年级 · 1~5 的认识和加减法",
    "g4bu3-0": "四年级 · 运算定律",
    "g6bu6-3": "六年级 · 整理和复习",
}


def main():
    jobs = json.load(open("/tmp/jobs-all2.json", encoding="utf-8"))
    pick = []
    for w in WANT:
        for j in jobs:
            if j["key"] == w:
                pick.append(j)
                break
    if len(pick) < 3:
        pick = jobs[:3]

    os.makedirs(OUT, exist_ok=True)
    for f in os.listdir(OUT):
        if f.endswith(".mp3"):
            os.remove(os.path.join(OUT, f))

    index = []
    for j in pick:
        print("合成", j["key"], "…", flush=True)
        pcm = tts(j["text"])

        postproc.build(pcm, os.path.join(OUT, j["key"] + "-raw.mp3"))

        # D：裁首尾 + 两级降噪，句间停顿保持原样
        thin = postproc.fade_edges(postproc.trim(pcm))
        postproc.build(thin, os.path.join(OUT, j["key"] + "-D.mp3"), postproc.FILTER)

        # E：完整链，句号级停顿整段填静音
        full, gaps = postproc.prepare(pcm)
        postproc.build(full, os.path.join(OUT, j["key"] + "-E.mp3"), postproc.FILTER)

        index.append({
            "key": j["key"],
            "title": LABELS.get(j["key"], j["key"]),
            "text": j["text"],
            "raw": round(len(pcm) / 2 / SR, 2),
            "d": round(len(thin) / 2 / SR, 2),
            "e": round(len(full) / 2 / SR, 2),
            "gaps": [[round(a, 2), round(b, 2)] for a, b in gaps],
        })
        print("  停顿清零:", index[-1]["gaps"], flush=True)

    json.dump(index, open(os.path.join(OUT, "index.json"), "w", encoding="utf-8"),
              ensure_ascii=False, indent=1)
    print("done", len(index), "句 × 3 版")


if __name__ == "__main__":
    main()
