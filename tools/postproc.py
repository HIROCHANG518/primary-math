"""讲解语音的后期处理：裁首尾 → 静音段清零 → 边缘淡入淡出 → 降噪滤镜 → mp3

为什么要有「静音段清零」这一步：
火山 TTS 在句号停顿处会带一小段吹气/唇齿杂音（约 −41 dB，比正常噪声底高一点）。
降噪把周围压到 −60 dB 以下以后，这段杂音变成孤零零的一团，听感就是「啵」的一声。
它是真实声源，压不掉；只能把整段停顿填成真静音。

用法：
    from postproc import prepare, build
    build(prepare(tts_pcm), "out.mp3")
"""
import array
import math
import subprocess

SR = 48000

# 降噪：两级 anlmdn（谱平滑，去嘶声）+ afftdn（自适应降噪），再切掉 80 Hz 以下与 11 kHz 以上
FILTER = ("anlmdn=s=7:p=0.002:r=0.002:m=15,"
          "anlmdn=s=5:p=0.002:r=0.002:m=15,"
          "afftdn=nr=8:nf=-35,"
          "highpass=f=80,lowpass=f=11000")

TRIM_THRESH = 1200      # ≈ −28 dBFS，低于它当静音
TRIM_LEAD = 0.12        # 语音前保留 120 ms
TRIM_TAIL = 0.18        # 语音后保留 180 ms

GAP_REL = 12.0          # 比「语音主体电平」低 12 dB 以下的帧算安静（约 −30 dBFS）
GAP_MIN = 0.30          # 只处理句号级停顿（≥300 ms）；字间短停顿不动，免得听起来一顿一顿
GAP_FADE = 0.03         # 停顿两端各 30 ms 淡入淡出，避免硬切出「嗒」

EDGE_FADE = 0.008       # 文件首尾 8 ms 淡入淡出


def _to_array(pcm):
    a = array.array("h")
    a.frombytes(pcm)
    if len(a) % 2:                      # 理论上不会，防御一下
        a = a[:-1]
    return a


def trim(pcm, thresh=TRIM_THRESH, lead=TRIM_LEAD, tail=TRIM_TAIL):
    """切掉首尾低于阈值的部分，前后各留一点余量"""
    a = _to_array(pcm)
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


def _frame_db(a, win=0.01):
    w = int(SR * win)
    out = []
    for i in range(0, len(a) - w + 1, w):
        seg = a[i:i + w]
        s = 0.0
        for v in seg:
            s += v * v
        r = math.sqrt(s / w)
        out.append(20 * math.log10(r / 32768) if r > 0 else -120.0)
    return out, w


def find_gaps(pcm, rel=GAP_REL, min_gap=GAP_MIN):
    """返回 [(start_sample, end_sample), ...]，即需要填静音的停顿区间"""
    a = _to_array(pcm)
    db, w = _frame_db(a)
    if not db:
        return []
    ordered = sorted(db)
    speech = ordered[int(len(ordered) * 0.9)]      # 语音主体电平（90 分位）
    gate = speech - rel
    need = max(1, int(round(min_gap / 0.01)))
    gaps = []
    run = 0
    for i, d in enumerate(db):
        if d < gate:
            run += 1
        else:
            if run >= need:
                gaps.append(((i - run) * w, i * w))
            run = 0
    if run >= need:
        gaps.append(((len(db) - run) * w, len(db) * w))
    return gaps


def mute_gaps(pcm, rel=GAP_REL, min_gap=GAP_MIN, fade=GAP_FADE):
    """把停顿整段填成真静音，两端各做 fade 秒淡出/淡入"""
    a = _to_array(pcm)
    gaps = find_gaps(pcm, rel, min_gap)
    if not gaps:
        return pcm, []
    f = max(1, int(SR * fade))
    for s, e in gaps:
        s = max(0, s)
        e = min(len(a), e)
        if e - s < 2 * f + 2:
            for i in range(s, e):
                a[i] = 0
            continue
        # 前 fade 个样本：从原值线性降到 0
        for i in range(s, s + f):
            a[i] = int(a[i] * (1 - (i - s) / f))
        # 中间全零
        for i in range(s + f, e - f):
            a[i] = 0
        # 后 fade 个样本：从 0 线性升到原值
        for i in range(e - f, e):
            a[i] = int(a[i] * ((i - (e - f)) / f))
    return a.tobytes(), [(round(s / SR, 2), round(e / SR, 2)) for s, e in gaps]


def fade_edges(pcm, ms=EDGE_FADE):
    a = _to_array(pcm)
    n = len(a)
    f = max(1, int(SR * ms / 1000))
    f = min(f, n // 2)
    for i in range(f):
        k = i / f
        a[i] = int(a[i] * k)
        a[n - 1 - i] = int(a[n - 1 - i] * k)
    return a.tobytes()


def prepare(pcm):
    """完整的前处理链：裁首尾 → 停顿清零 → 边缘淡入淡出"""
    p = trim(pcm)
    p, gaps = mute_gaps(p)
    p = fade_edges(p)
    return p, gaps


def build(pcm, out_path, af=FILTER):
    """PCM 走管道直接给 ffmpeg，不落临时文件"""
    subprocess.run(["ffmpeg", "-v", "error", "-y",
                    "-f", "s16le", "-ar", str(SR), "-ac", "1", "-i", "pipe:0",
                    "-af", af, "-ar", str(SR), "-ac", "1",
                    "-c:a", "libmp3lame", "-b:a", "96k", out_path],
                   input=pcm, check=True)
