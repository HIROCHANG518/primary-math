'use strict';
/**
 * sx2-tts —— 小学竖式闯关的讲解语音网关
 *
 *   GET /sx2-tts?t=<要念的话>[&e=volc|yunxi]
 *
 * 主引擎：火山引擎豆包语音 2.0 · 本人声音复刻（seed-icl-2.0 / S_bjuVnqqj2）
 * 备用引擎：微软 Edge 在线语音 zh-CN-YunxiNeural（云希）
 * 两家的 Key 与实现都留在服务器，页面只拿 mp3。
 *
 * 结果按文本 hash 落在 CACHE_DIR，同一句只合成一次。
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');

const CACHE_DIR = process.env.SX2_TTS_CACHE || '/opt/sx2-math/tts-cache';
const KEY_FILE = process.env.SX2_TTS_KEYFILE || '/opt/sweettalk-wework/.sx2-tts.key';

const VOLC_URL = 'https://openspeech.bytedance.com/api/v3/tts/unidirectional';
const VOLC_RESOURCE = 'seed-icl-2.0';
const VOLC_MODEL = 'seed-tts-2.0-expressive';
const VOLC_VOICE = process.env.SX2_VOLC_VOICE || 'S_bjuVnqqj2';   /* 昕哥原声版 */
const VOLC_RATE = Number(process.env.SX2_VOLC_RATE || 5);          /* 语速：5 是规范默认，嫌慢改 15 */
const YUNXI_VOICE = 'zh-CN-YunxiNeural';
const EDGE_TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4';
const EDGE_WSS = 'wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1';
const EDGE_GEC_VERSION = '2-143.0.3650.96';

/* 语气指导：按本机已认可的配音预设（xin-original-oral-v001-20261029）改写到讲题场景 */
const CONTEXT = '保持你本人的自然说话声线，像坐在孩子旁边一道一道讲竖式题。'
  + '正常有声口语，不刻意压低嗓音，不用气声或耳语，不采用播音、配音、说教腔。'
  + '表达耐心、清楚、克制，有老师的那种稳，不夸张也不哄小孩。'
  + '念数字时一位一位说清楚，不连读成一串。句末自然收稳，每句不上扬。'
  + '只读正文，不读这些指导，不加笑声叹气或背景声。';

const MAX_TEXT = 300;
const MAX_CONCURRENT = 4;
const VOLC_TIMEOUT = 15000;
const EDGE_TIMEOUT = 12000;
const VOLC_COOLDOWN_MS = 90 * 1000;   /* 火山失败后这段时间直接走云希 */

let keyCache = null;
let volcDownUntil = 0;
let active = 0;
let writesSinceSweep = 0;
const waiters = [];
const inflight = new Map();

/* ---------------- 基础工具 ---------------- */

function apiKey() {
  if (keyCache) return keyCache;
  try {
    keyCache = fs.readFileSync(KEY_FILE, 'utf8').trim();
  } catch (e) {
    return null;
  }
  return keyCache;
}

function sha1(s) {
  return crypto.createHash('sha1').update(s, 'utf8').digest('hex');
}

function cachePath(engine, text) {
  /* 语速进文件名：改语速后自动换一套缓存，不用手工清目录 */
  const prefix = engine === 'volc' ? ('v' + VOLC_RATE + '-') : 'yx-';
  return path.join(CACHE_DIR, prefix + sha1(text) + '.mp3');
}

function readCache(engine, text) {
  try {
    const p = cachePath(engine, text);
    const st = fs.statSync(p);
    if (st.size > 1000) return fs.readFileSync(p);
  } catch (e) { /* miss */ }
  return null;
}

function writeCache(engine, text, buf) {
  try {
    if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
    const p = cachePath(engine, text);
    fs.writeFileSync(p + '.tmp', buf);
    fs.renameSync(p + '.tmp', p);
    if (++writesSinceSweep > 150) { writesSinceSweep = 0; sweepCache(); }
  } catch (e) {
    console.error('[sx2-tts] cache write failed:', e.message);
  }
}

/* 题目随机、句子各不相同，缓存会一直涨：超过 4000 条就按最久未用删掉三成 */
function sweepCache() {
  try {
    const names = fs.readdirSync(CACHE_DIR).filter(n => n.endsWith('.mp3'));
    if (names.length <= 4000) return;
    const rows = [];
    for (const n of names) {
      try {
        const p = path.join(CACHE_DIR, n);
        rows.push({ p, m: fs.statSync(p).mtimeMs });
      } catch (e) { /* 并发删掉了 */ }
    }
    rows.sort((a, b) => a.m - b.m);
    const drop = rows.slice(0, Math.floor(rows.length * 0.3));
    for (const r of drop) { try { fs.unlinkSync(r.p); } catch (e) { /* ignore */ } }
    console.error('[sx2-tts] swept ' + drop.length + ' clips, kept ' + (rows.length - drop.length));
  } catch (e) {
    console.error('[sx2-tts] sweep failed:', e.message);
  }
}

function acquire() {
  if (active < MAX_CONCURRENT) { active++; return Promise.resolve(); }
  return new Promise(res => waiters.push(() => { active++; res(); }));
}

function release() {
  active--;
  const next = waiters.shift();
  if (next) next();
}

/* ---------------- 引擎一：火山（昕哥音色） ---------------- */

function volcSynth(text) {
  const key = apiKey();
  if (!key) return Promise.reject(new Error('no volc api key'));

  const body = JSON.stringify({
    user: { uid: 'sx2-math-web' },
    req_params: {
      text,
      speaker: VOLC_VOICE,
      model: VOLC_MODEL,
      audio_params: { format: 'mp3', sample_rate: 24000, speech_rate: VOLC_RATE },
      additions: JSON.stringify({ context_texts: [CONTEXT], explicit_language: 'zh' })
    }
  });

  return new Promise((resolve, reject) => {
    let settled = false;
    const done = (err, buf) => {
      if (settled) return;
      settled = true;
      err ? reject(err) : resolve(buf);
    };

    const req = https.request(VOLC_URL, {
      method: 'POST',
      timeout: VOLC_TIMEOUT,
      headers: {
        'X-Api-Key': key,
        'X-Api-Resource-Id': VOLC_RESOURCE,
        'X-Api-Request-Id': crypto.randomUUID(),
        'X-Control-Require-Usage-Tokens-Return': '*',
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    }, res => {
      if (res.statusCode !== 200) {
        let err = '';
        res.setEncoding('utf8');
        res.on('data', d => { if (err.length < 500) err += d; });
        res.on('end', () => done(new Error('volc http ' + res.statusCode + ' ' + err.slice(0, 200))));
        return;
      }
      let buf = '';
      const parts = [];
      res.setEncoding('utf8');
      res.on('data', chunk => {
        buf += chunk;
        let i;
        while ((i = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, i).trim();
          buf = buf.slice(i + 1);
          if (!line || line.startsWith('event:') || line.startsWith(':')) continue;
          const json = line.startsWith('data:') ? line.slice(5).trim() : line;
          let obj;
          try { obj = JSON.parse(json); } catch (e) { continue; }
          if (obj.code && obj.code !== 0 && obj.code !== 20000000) {
            return done(new Error('volc code ' + obj.code + ' ' + (obj.message || '')));
          }
          if (obj.data) parts.push(Buffer.from(obj.data, 'base64'));
          if (obj.code === 20000000) {
            const out = Buffer.concat(parts);
            return out.length > 1000 ? done(null, out) : done(new Error('volc empty audio'));
          }
        }
      });
      res.on('end', () => done(new Error('volc stream ended without finish')));
    });

    req.on('timeout', () => { req.destroy(new Error('volc timeout')); });
    req.on('error', e => done(e));
    req.write(body);
    req.end();
  });
}

/* ---------------- 引擎二：微软云希（Edge 在线语音协议） ---------------- */

function sha256ToUpperHex(bytes) {
  return Buffer.from(bytes).toString('hex').toUpperCase();
}

function rol16(v) {
  return (((v << 16) | (v >>> 16)) >>> 0);
}

/* Sec-MS-GEC v2：CS64 校验 + 常规 SHA-256，算法同 edge-tts / msedge-tts */
function cs64(message, digest) {
  const firstKey = (digest.readUInt32LE(0) | 1) >>> 0;
  const secondKey = (digest.readUInt32LE(4) | 1) >>> 0;
  const padded = Buffer.alloc(Math.ceil(message.length / 8) * 8);
  message.copy(padded);

  const SWAP_FIRST = { word: 0xEF0569FB, sum: 0x76F50F34, product: 0xC3EFEA97 };
  const SWAP_SECOND = { word: 0xC31713DB, sum: 0x1881CE3C, product: 0x35BD1EC9 };
  const MIX_FIRST = [0xCF98B111, 0x87085B9F, 0x12CEB96D, 0x257E1D83];
  const MIX_SECOND = [0xA27416F5, 0xD38396FF, 0x7C932B89, 0xBFA49F69];

  const swapTerm = (word, key, m) => {
    const s = Math.imul(word, key) + Math.imul(rol16(word), m.word);
    const p = Math.imul(rol16(s), m.sum) >>> 0;
    return (Math.imul(rol16(p), m.product) + p) >>> 0;
  };
  const swapAndMultiply = (value, mults) => {
    for (const m of mults) value = Math.imul(rol16(value), m) >>> 0;
    return value;
  };

  let swapSum = 0, lastSwap = 0, mix = 0, mixSum = 0;
  for (let off = 0; off < padded.length; off += 8) {
    const w0 = padded.readUInt32LE(off);
    const w1 = padded.readUInt32LE(off + 4);
    const s0 = swapTerm(w0, firstKey, SWAP_FIRST);
    lastSwap = swapTerm(w1, secondKey, SWAP_SECOND);
    swapSum = (swapSum + s0 + lastSwap) >>> 0;
    mix = swapAndMultiply(Math.imul(mix + w0, firstKey), MIX_FIRST);
    mixSum = (mixSum + mix) >>> 0;
    mix = swapAndMultiply(Math.imul(mix + w1, secondKey), MIX_SECOND);
    mixSum = (mixSum + mix) >>> 0;
  }
  const out = Buffer.alloc(8);
  out.writeUInt32LE((lastSwap ^ mix) >>> 0, 0);
  out.writeUInt32LE((swapSum ^ mixSum) >>> 0, 4);
  return out;
}

async function secMsGec() {
  const EDGE_COPYRIGHT = 'Copyright (C) Microsoft Corporation. All rights reserved.';
  let ticks = Math.floor(Date.now() / 1000) + 11644473600;
  ticks -= ticks % 300;
  const input = Buffer.from(EDGE_COPYRIGHT + String(ticks * 1e7) + EDGE_TOKEN, 'utf8');
  const digest = Buffer.from(await crypto.webcrypto.subtle.digest('SHA-256', input));
  return sha256ToUpperHex(cs64(input, digest)) + '-' + sha256ToUpperHex(digest);
}

function yunxiSynth(text) {
  return secMsGec().then(gec => new Promise((resolve, reject) => {
    let WS;
    try { WS = require('ws'); } catch (e) { return reject(new Error('ws module missing')); }

    const url = EDGE_WSS
      + '?TrustedClientToken=' + EDGE_TOKEN
      + '&Sec-MS-GEC=' + gec
      + '&Sec-MS-GEC-Version=' + EDGE_GEC_VERSION
      + '&ConnectionId=' + crypto.randomBytes(16).toString('hex');

    const ws = new WS(url, {
      handshakeTimeout: EDGE_TIMEOUT,
      headers: {
        'Pragma': 'no-cache',
        'Cache-Control': 'no-cache',
        'Accept-Language': 'zh-CN,zh;q=0.9',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
          + '(KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0'
      }
    });

    let settled = false;
    const chunks = [];
    const done = (err, buf) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { ws.close(); } catch (e) { /* ignore */ }
      err ? reject(err) : resolve(buf);
    };
    const timer = setTimeout(() => done(new Error('yunxi timeout')), EDGE_TIMEOUT);

    ws.on('unexpected-response', (rq, res) => done(new Error('yunxi handshake ' + res.statusCode)));
    ws.on('error', e => done(e));
    ws.on('open', () => {
      const ts = new Date().toISOString();
      ws.send('X-Timestamp:' + ts + '\r\n'
        + 'Content-Type:application/json; charset=utf-8\r\n'
        + 'Path:speech.config\r\n\r\n'
        + JSON.stringify({
          context: {
            synthesis: {
              audio: {
                metadataoptions: { sentenceBoundaryEnabled: false, wordBoundaryEnabled: false },
                outputFormat: 'audio-24khz-48kbitrate-mono-mp3'
              }
            }
          }
        }));
      const safe = text.replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));
      const ssml = "<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='zh-CN'>"
        + "<voice name='" + YUNXI_VOICE + "'>"
        + "<prosody pitch='+0Hz' rate='-4%' volume='+0%'>" + safe + '</prosody></voice></speak>';
      ws.send('X-RequestId:' + crypto.randomBytes(16).toString('hex') + '\r\n'
        + 'Content-Type:application/ssml+xml\r\n'
        + 'X-Timestamp:' + ts + '\r\n'
        + 'Path:ssml\r\n\r\n' + ssml);
    });
    ws.on('message', (data, isBinary) => {
      if (isBinary) {
        const b = Buffer.from(data);
        if (b.length < 2) return;
        const hlen = b.readUInt16BE(0);
        const head = b.slice(2, 2 + hlen).toString('utf8');
        if (head.includes('Path:audio')) chunks.push(b.slice(2 + hlen));
      } else if (data.toString('utf8').includes('Path:turn.end')) {
        const out = Buffer.concat(chunks);
        out.length > 1000 ? done(null, out) : done(new Error('yunxi empty audio'));
      }
    });
  }));
}

/* ---------------- 对外接口 ---------------- */

function sendJson(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*'
  });
  res.end(body);
}

function normalize(text) {
  return String(text || '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, MAX_TEXT);
}

async function synth(text, prefer) {
  const volcCooling = Date.now() < volcDownUntil;
  const order = prefer === 'yunxi' ? ['yunxi', 'volc']
    : prefer === 'volc' ? ['volc', 'yunxi']
      : (volcCooling ? ['yunxi', 'volc'] : ['volc', 'yunxi']);

  let lastErr = null;
  for (const engine of order) {
    const cached = readCache(engine, text);
    if (cached) return { engine, buf: cached, cache: 'hit' };

    await acquire();
    try {
      const buf = engine === 'volc' ? await volcSynth(text) : await yunxiSynth(text);
      writeCache(engine, text, buf);
      if (engine === 'volc') volcDownUntil = 0;
      return { engine, buf, cache: 'miss' };
    } catch (e) {
      lastErr = e;
      if (engine === 'volc') {
        volcDownUntil = Date.now() + VOLC_COOLDOWN_MS;
        console.error('[sx2-tts] volc failed, fallback to yunxi:', e.message);
      } else {
        console.error('[sx2-tts] yunxi failed:', e.message);
      }
    } finally {
      release();
    }
  }
  throw lastErr || new Error('no engine available');
}

function handle(req, res, query) {
  const text = normalize(query.t || '');
  const prefer = (query.e === 'yunxi' || query.e === 'volc') ? query.e : '';

  if (!text) return sendJson(res, 400, { error: 'missing t' });
  if (!/[\u4e00-\u9fa5A-Za-z0-9]/.test(text)) return sendJson(res, 400, { error: 'bad text' });

  const id = sha1(prefer + '\u0001' + text);
  if (inflight.has(id)) {
    return inflight.get(id).then(r => sendAudio(res, r), e => sendJson(res, 503, { error: e.message }));
  }

  const job = synth(text, prefer).finally(() => inflight.delete(id));
  inflight.set(id, job);
  job.then(r => sendAudio(res, r), e => sendJson(res, 503, { error: e.message }));
}

function sendAudio(res, r) {
  res.writeHead(200, {
    'Content-Type': 'audio/mpeg',
    'Content-Length': r.buf.length,
    'Cache-Control': 'public, max-age=604800',
    'X-TTS-Engine': r.engine,
    'X-TTS-Cache': r.cache,
    'Access-Control-Allow-Origin': '*'
  });
  res.end(r.buf);
}

module.exports = { handle };
