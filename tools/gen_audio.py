"""给知识点讲解批量生成静态语音：火山 48k PCM → 裁首尾 + 停顿清零 + 两级降噪 → mp3
用法：python3 gen_audio.py <jobs.json> <outdir>
jobs.json: [{"key":"g1au3-0","text":"..."}, ...]
已存在的文件默认跳过（--force 覆盖）。

后期链见 postproc.py：
  1. 裁掉首尾低于阈值的噪声段（火山每句首尾各约 0.3 秒）
  2. 句号级停顿整段填静音（否则降噪后残留的吹气声会变成「啵」）
  3. 首尾 8 ms 淡入淡出
  4. 两级 anlmdn + afftdn + 高低通
"""
import base64, json, os, subprocess, sys, time, uuid, wave, urllib.request, urllib.error

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import postproc

KEY = "f6881428-75b0-43ef-a997-a52d4d9c9865"
URL = "https://openspeech.bytedance.com/api/v3/tts/unidirectional"
RES = "seed-icl-2.0"
MODEL = "seed-tts-2.0-expressive"
VOICE = "S_bjuVnqqj2"
# 旧链：只做轻度降噪，首尾噪声与停顿杂音都还在，留作对照
FILTER_LEGACY = "afftdn=nr=8:nf=-30,highpass=f=80,lowpass=f=12000"
FILTER = postproc.FILTER

CONTEXT = (
    "保持你本人的自然说话声线，像坐在孩子旁边一道一道讲题。"
    "正常有声口语，不刻意压低嗓音，不用气声或耳语，不采用播音、配音、说教腔。"
    "表达耐心、清楚、克制，有老师的那种稳，不夸张也不哄小孩。"
    "念到数字和关键词时稍作停顿、说清楚，句末自然收稳，每句不上扬。"
    "只读正文，不读这些指导，不加笑声叹气或背景声。"
)


def tts(text):
    rid = str(uuid.uuid4())
    payload = {
        "user": {"uid": "sx2-learn"},
        "req_params": {
            "text": text, "speaker": VOICE, "model": MODEL,
            "audio_params": {"format": "pcm", "sample_rate": 48000,
                             "speech_rate": 0, "loudness_rate": 0},
            "additions": json.dumps({"context_texts": [CONTEXT], "explicit_language": "zh"},
                                    ensure_ascii=False),
        }}
    req = urllib.request.Request(URL, data=json.dumps(payload).encode(), headers={
        "X-Api-Key": KEY, "X-Api-Resource-Id": RES, "X-Api-Request-Id": rid,
        "Content-Type": "application/json",
        "X-Control-Require-Usage-Tokens-Return": "*"})
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    parts, finished = [], False
    with opener.open(req, timeout=180) as r:
        for raw in r:
            line = raw.decode("utf-8", "ignore").strip()
            if not line or line.startswith(("event:", ":")):
                continue
            if line.startswith("data:"):
                line = line[5:].strip()
            try:
                obj = json.loads(line)
            except json.JSONDecodeError:
                continue
            code = obj.get("code")
            if code not in (0, 20000000):
                raise RuntimeError("code=%s %s" % (code, obj.get("message")))
            if obj.get("data"):
                parts.append(base64.b64decode(obj["data"]))
            if code == 20000000:
                finished = True
                break
    if not finished or not parts:
        raise RuntimeError("incomplete")
    return b"".join(parts)


def build(pcm, out_path, thin=False):
    """完整后期：裁首尾 → 停顿清零 → 边缘淡入淡出 → 降噪滤镜 → mp3
    thin=True 时跳过停顿清零（只做裁首尾与降噪），用于对照试听。"""
    if thin:
        p = postproc.trim(pcm)
        if p is pcm:
            p = pcm
        p = postproc.fade_edges(p)
    else:
        p, _gaps = postproc.prepare(pcm)
    postproc.build(p, out_path, FILTER)
    return len(p) / 2 / 48000


if __name__ == "__main__":
    jobs = json.load(open(sys.argv[1], encoding="utf-8"))
    outdir = sys.argv[2]
    force = "--force" in sys.argv
    os.makedirs(outdir, exist_ok=True)
    ok = skip = fail = 0
    for j in jobs:
        out = os.path.join(outdir, j["key"] + ".mp3")
        if os.path.exists(out) and not force and os.path.getsize(out) > 3000:
            skip += 1
            continue
        try:
            t0 = time.time()
            pcm = tts(j["text"])
            build(pcm, out)
            ok += 1
            print("OK   %-14s %5.1fs %5dKB  %s" % (j["key"], time.time() - t0,
                                                   os.path.getsize(out) // 1024, j["text"][:24]))
        except Exception as e:
            fail += 1
            print("FAIL %-14s %s" % (j["key"], e))
    print("done ok=%d skip=%d fail=%d" % (ok, skip, fail))
