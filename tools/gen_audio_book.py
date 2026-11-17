"""批量配音（并发版）：读 jobs.json，调昕哥音色合成 48k PCM，本地 ffmpeg 降噪转 mp3
用法：python3 gen_audio_book.py jobs.json outdir [--workers 4] [--force]
已存在且大于 3KB 的文件默认跳过。火山并发上限由 --workers 控制（默认 4，勿超过配额 5）。
"""
import json, os, sys, time
from concurrent.futures import ThreadPoolExecutor, as_completed

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gen_audio import tts, build  # 复用合成与滤镜

def one(job, outdir, force):
    out = os.path.join(outdir, job["key"] + ".mp3")
    if not force and os.path.exists(out) and os.path.getsize(out) > 3000:
        return ("SKIP", job["key"], 0, job["text"][:20])
    t0 = time.time()
    try:
        pcm = tts(job["text"])
        build(pcm, out)
        return ("OK", job["key"], time.time() - t0, os.path.getsize(out))
    except Exception as e:
        return ("FAIL", job["key"], str(e), job["text"][:20])

if __name__ == "__main__":
    jobs = json.load(open(sys.argv[1], encoding="utf-8"))
    outdir = sys.argv[2]
    force = "--force" in sys.argv
    workers = 4
    if "--workers" in sys.argv:
        workers = int(sys.argv[sys.argv.index("--workers") + 1])
    os.makedirs(outdir, exist_ok=True)
    todo = [j for j in jobs if force or not (
        os.path.exists(os.path.join(outdir, j["key"] + ".mp3")) and
        os.path.getsize(os.path.join(outdir, j["key"] + ".mp3")) > 3000)]
    print("共 %d 句，待合成 %d 句，并发 %d" % (len(jobs), len(todo), workers), flush=True)
    ok = fail = 0
    t0 = time.time()
    with ThreadPoolExecutor(max_workers=workers) as ex:
        futs = [ex.submit(one, j, outdir, force) for j in todo]
        for i, f in enumerate(as_completed(futs), 1):
            st, key, extra, info = f.result()
            if st == "OK":
                ok += 1
                print("[%d/%d] OK   %-12s %5.1fs %5dKB %s" % (i, len(todo), key, extra, info // 1024, ""), flush=True)
            elif st == "FAIL":
                fail += 1
                print("[%d/%d] FAIL %-12s %s %s" % (i, len(todo), key, extra, info), flush=True)
            else:
                print("[%d/%d] SKIP %-12s %s" % (i, len(todo), key, info), flush=True)
    print("done ok=%d fail=%d 用时 %.1f 分" % (ok, fail, (time.time() - t0) / 60), flush=True)
