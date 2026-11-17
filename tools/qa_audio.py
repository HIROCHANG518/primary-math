"""抽查新生成的讲解音频：时长、静音段、语音电平、是否削顶"""
import glob
import json
import math
import os
import random
import subprocess
import sys

import array

SR = 48000


def samples(path):
    b = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-f", "s16le",
                        "-ac", "1", "-ar", str(SR), "-"], capture_output=True).stdout
    a = array.array("h")
    a.frombytes(b)
    return a


def db(v):
    return 20 * math.log10(v / 32768) if v > 0 else -120


def main(d):
    files = sorted(glob.glob(os.path.join(d, "*.mp3")))
    random.seed(3)
    pick = random.sample(files, min(12, len(files)))
    print("%-16s %6s %8s %8s %6s %5s" % ("文件", "时长", "语音RMS", "静音占比", "峰值", "削顶"))
    bad = 0
    for f in pick:
        a = samples(f)
        n = len(a)
        w = int(SR * 0.01)
        frames = []
        for i in range(0, n - w, w):
            s = 0
            for v in a[i:i + w]:
                s += v * v
            frames.append(math.sqrt(s / w))
        silent = sum(1 for r in frames if r == 0)
        loud = [r for r in frames if r > 300]
        voice = db(math.sqrt(sum(r * r for r in loud) / len(loud))) if loud else -120
        peak = max(abs(v) for v in a) if n else 0
        clip = sum(1 for v in a if abs(v) >= 32700)
        flag = ""
        if n / SR < 1.0 or n / SR > 60 or clip > 0:
            flag = "  <== 检查"
            bad += 1
        print("%-16s %6.2f %8.1f %7.0f%% %6d %5d%s" % (
            os.path.basename(f), n / SR, voice, silent / max(1, len(frames)) * 100, peak, clip, flag))
    print("\n抽查 %d 个，异常 %d 个" % (len(pick), bad))


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "learn/audio")
