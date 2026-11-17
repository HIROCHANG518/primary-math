"""给同一句话做几种后期处理，生成试听对比样本。
用法：python3 tools/voice_probe.py
输出：voice-samples/probe/<key>-<方案>.mp3 与 index.json

火山 TTS 出来的 PCM 首尾各带约 0.3 秒底噪（RMS 约 −42 dB，峰值 −31 dB），
比语音段只低 20 dB，安静环境外放能听见「嘶」声，所以这里对比几种处理。
"""
import array, json, os, subprocess, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gen_audio import tts

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "voice-samples", "probe")
SR = 48000

NOW = "afftdn=nr=8:nf=-30,highpass=f=80,lowpass=f=12000"

VARIANTS = {
    "A-now":    ("现在线上", None, NOW),
    "B-trim":   ("裁首尾", "trim", NOW),
    "C-anlmdn": ("裁首尾+强力降噪", "trim",
                 "anlmdn=s=7:p=0.002:r=0.002:m=15,afftdn=nr=8:nf=-30,highpass=f=80,lowpass=f=11000"),
    "D-anlmdn2": ("裁首尾+两级降噪", "trim",
                  "anlmdn=s=7:p=0.002:r=0.002:m=15,anlmdn=s=5:p=0.002:r=0.002:m=15,"
                  "afftdn=nr=8:nf=-35,highpass=f=80,lowpass=f=11000"),
}


def trim_pcm(pcm, thresh=1200, lead=0.15, tail=0.20):
    """把首尾低于阈值（约 −28 dBFS）的部分切掉，前后各留一点余量"""
    a = array.array("h")
    a.frombytes(pcm)
    n = len(a)
    first = last = -1
    for i in range(n):
        if abs(a[i]) > thresh:
            first = i
            break
    for i in range(n - 1, -1, -1):
        if abs(a[i]) > thresh:
            last = i
            break
    if first < 0 or last <= first:
        return pcm
    s = max(0, first - int(SR * lead))
    e = min(n, last + int(SR * tail))
    return a[s:e].tobytes()


def encode(pcm, af, out):
    cmd = ["ffmpeg", "-v", "error", "-y", "-f", "s16le", "-ar", str(SR), "-ac", "1", "-i", "pipe:0"]
    if af:
        cmd += ["-af", af]
    cmd += ["-ar", str(SR), "-ac", "1", "-c:a", "libmp3lame", "-b:a", "96k", out]
    subprocess.run(cmd, input=pcm, check=True)


def main():
    jobs = json.load(open("/tmp/jobs-all2.json", encoding="utf-8"))
    want = ["g1au3-0", "g4bu3-0", "g6bu6-3"]
    pick = []
    for w in want:
        for j in jobs:
            if j["key"] == w:
                pick.append(j)
                break
    if len(pick) < 3:
        pick = jobs[:3]

    os.makedirs(OUT, exist_ok=True)

    # 清掉旧样本
    for f in os.listdir(OUT):
        if f.endswith(".mp3"):
            os.remove(os.path.join(OUT, f))

    index = []
    for j in pick:
        print("合成", j["key"], "…", flush=True)
        pcm = tts(j["text"])
        trimmed = trim_pcm(pcm)

        encode(pcm, None, os.path.join(OUT, j["key"] + "-raw.mp3"))
        for name, (label, pre, af) in VARIANTS.items():
            src = trimmed if pre == "trim" else pcm
            encode(src, af, os.path.join(OUT, j["key"] + "-" + name + ".mp3"))
        index.append({"key": j["key"], "text": j["text"],
                      "raw": round(len(pcm) / 2 / SR, 2),
                      "trim": round(len(trimmed) / 2 / SR, 2)})

    json.dump(index, open(os.path.join(OUT, "index.json"), "w", encoding="utf-8"),
              ensure_ascii=False, indent=1)
    print("done", len(index), "句 ×", len(VARIANTS) + 1, "版")
    for x in index:
        print("  %s  原长 %.2fs → 裁后 %.2fs" % (x["key"], x["raw"], x["trim"]))


if __name__ == "__main__":
    main()
