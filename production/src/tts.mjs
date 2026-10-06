// Narration generator: Kokoro-82M (local, Apache-2.0) via kokoro-js.
//
// For each episode it synthesizes the narration sentence by sentence, records the
// start/end of every sentence on the episode timeline (the animation syncs to these),
// and writes:
//   out/audio/episode-0N-narration.wav   loudness-normalized, 48 kHz mono
//   out/audio/episode-0N-narration.mp3
//   out/timing/episode-0N.json           paragraph + sentence timings
//   out/subtitles/episode-0N.srt
//
// Usage: node src/tts.mjs [episodes...] [--voice am_michael] [--speed 1.0]
//        node src/tts.mjs --samples        (first paragraph of ep 1 in several voices)

import { KokoroTTS } from "kokoro-js";
import { phonemize as espeak } from "phonemizer";
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { TIMELINE, VOICE, SPEED, ROOT, SCRIPTS, OUT } from "./config.mjs";

const SR = 24000;

// ---------------------------------------------------------------- pronunciation
// espeak-ng output -> corrected phonemes. Matched on whole phoneme words.
const PHONEME_FIXES = [
  ["mˈɪɹʃeɪmɚ", "mˈɪɹʃaɪmɚ"], // Mearsheimer: MEER-shy-mer
  ["mˈælækə", "məlˈækə"], // Malacca: muh-LACK-uh
  ["dˈeɪkɪŋ", "dɑːtʃˈɪŋ"], // Daqing: dah-CHING
  ["jˈuːən", "juːˈɑːn"], // yuan: yoo-AHN
  ["kˌæzɐkhstˈɑːn", "kˌæzɐkstˈɑːn"], // Kazakhstan
  ["sˈɛvɐstˌɑːpɑːl", "sˌɛvɐstˈoʊpəl"], // Sevastopol: sev-uh-STOH-pol
  ["jˈʌnən", "juːnˈɑːn"], // Yunnan: yoo-NAHN
];

const PUNCT = ';:,.!?¡¿—…"«»“”(){}[]';
const PUNCT_RE = new RegExp(`(\\s*[${PUNCT.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}]+\\s*)+`, "g");

// Mirrors kokoro-js's internal phonemizer (punctuation preserved, espeak en-us on the
// words in between, same post-fixes), then applies PHONEME_FIXES.
async function toPhonemes(text) {
  text = text.replace(/[‘’]/g, "'").replace(/\s+/g, " ").trim();
  const parts = [];
  let last = 0;
  for (const m of text.matchAll(PUNCT_RE)) {
    if (last < m.index) parts.push({ punct: false, text: text.slice(last, m.index) });
    if (m[0].length) parts.push({ punct: true, text: m[0] });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push({ punct: false, text: text.slice(last) });
  let ph = (
    await Promise.all(parts.map(async (p) => (p.punct ? p.text : (await espeak(p.text, "en-us")).join(" "))))
  ).join("");
  ph = ph
    .replace(/ʲ/g, "j")
    .replace(/r/g, "ɹ")
    .replace(/x/g, "k")
    .replace(/ɬ/g, "l")
    .replace(/(?<=[a-zɹː])(?=hˈʌndɹɪd)/g, " ")
    .replace(/ z(?=[;:,.!?¡¿—…"«»“” ]|$)/g, "z")
    .replace(/(?<=nˈaɪn)ti(?!ː)/g, "di");
  for (const [from, to] of PHONEME_FIXES) {
    ph = ph.replace(new RegExp(`(^|[\\s${PUNCT.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}-])${from}`, "g"), `$1${to}`);
  }
  return ph.trim();
}

// ---------------------------------------------------------------- text
export function readParagraphs(n) {
  const raw = fs.readFileSync(path.join(SCRIPTS, `episode-0${n}-narration.txt`), "utf8");
  return raw.split(/\n\s*\n/).map((p) => p.replace(/\s+/g, " ").trim()).filter(Boolean);
}

function splitSentences(p) {
  return p.split(/(?<=[.?!])\s+(?=[A-Z])/).map((s) => s.trim()).filter(Boolean);
}

// ---------------------------------------------------------------- audio helpers
function silence(sec) {
  return new Float32Array(Math.round(sec * SR));
}

function concat(chunks) {
  const len = chunks.reduce((a, c) => a + c.length, 0);
  const out = new Float32Array(len);
  let o = 0;
  for (const c of chunks) {
    out.set(c, o);
    o += c.length;
  }
  return out;
}

// Trim near-silent padding Kokoro leaves at the edges so pauses are under our control.
function trim(buf, thresh = 0.004, keep = 0.03) {
  let a = 0;
  let b = buf.length - 1;
  while (a < b && Math.abs(buf[a]) < thresh) a++;
  while (b > a && Math.abs(buf[b]) < thresh) b--;
  const k = Math.round(keep * SR);
  return buf.slice(Math.max(0, a - k), Math.min(buf.length, b + k));
}

// Short fades so trimmed edges never click.
function fadeEdges(buf, sec = 0.012) {
  const n = Math.min(Math.round(sec * SR), buf.length >> 1);
  for (let i = 0; i < n; i++) {
    const g = i / n;
    buf[i] *= g;
    buf[buf.length - 1 - i] *= g;
  }
  return buf;
}

function writeWav(file, buf, sr = SR) {
  const data = Buffer.alloc(buf.length * 2);
  for (let i = 0; i < buf.length; i++) {
    const s = Math.max(-1, Math.min(1, buf[i]));
    data.writeInt16LE(Math.round(s * 32767), i * 2);
  }
  const h = Buffer.alloc(44);
  h.write("RIFF", 0);
  h.writeUInt32LE(36 + data.length, 4);
  h.write("WAVE", 8);
  h.write("fmt ", 12);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);
  h.writeUInt16LE(1, 22);
  h.writeUInt32LE(sr, 24);
  h.writeUInt32LE(sr * 2, 28);
  h.writeUInt16LE(2, 32);
  h.writeUInt16LE(16, 34);
  h.write("data", 36);
  h.writeUInt32LE(data.length, 40);
  fs.writeFileSync(file, Buffer.concat([h, data]));
}

// Small-room impulse response: a few early reflections and a short decaying tail.
function writeRoomIR(file) {
  const sr = 48000;
  const len = Math.round(sr * 0.42);
  const L = new Float32Array(len);
  const R = new Float32Array(len);
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
  for (const [ms, g] of [[7, 0.5], [11, 0.38], [17, 0.3], [23, 0.22], [31, 0.16]]) {
    L[Math.round((ms * sr) / 1000)] += g;
    R[Math.round(((ms + 1.3) * sr) / 1000)] += g * 0.9;
  }
  let lpL = 0;
  let lpR = 0;
  for (let i = Math.round(0.012 * sr); i < len; i++) {
    const env = Math.exp(-i / (sr * 0.075));
    lpL = lpL * 0.55 + rnd() * 0.45;
    lpR = lpR * 0.55 + rnd() * 0.45;
    L[i] += lpL * env * 0.35;
    R[i] += lpR * env * 0.35;
  }
  const data = Buffer.alloc(len * 4);
  for (let i = 0; i < len; i++) {
    data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, L[i])) * 32767), i * 4);
    data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, R[i])) * 32767), i * 4 + 2);
  }
  const h = Buffer.alloc(44);
  h.write("RIFF", 0);
  h.writeUInt32LE(36 + data.length, 4);
  h.write("WAVE", 8);
  h.write("fmt ", 12);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);
  h.writeUInt16LE(2, 22);
  h.writeUInt32LE(sr, 24);
  h.writeUInt32LE(sr * 4, 28);
  h.writeUInt16LE(4, 32);
  h.writeUInt16LE(16, 34);
  h.write("data", 36);
  h.writeUInt32LE(data.length, 40);
  fs.writeFileSync(file, Buffer.concat([h, data]));
}

function ffmpeg(args) {
  const r = spawnSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...args], { stdio: "inherit" });
  if (r.status !== 0) throw new Error(`ffmpeg failed: ${args.join(" ")}`);
}

// ---------------------------------------------------------------- synthesis
let ttsPromise;
function loadTTS() {
  ttsPromise ??= KokoroTTS.from_pretrained("onnx-community/Kokoro-82M-v1.0-ONNX", { dtype: "fp32", device: "cpu" });
  return ttsPromise;
}

// Cached by (voice, speed, phonemes) so retiming or re-running never re-synthesizes.
async function synthPhonemes(ph, voice, speed) {
  const key = crypto.createHash("sha1").update(`${voice}|${speed}|${ph}`).digest("hex");
  const file = path.join(OUT, "cache", `${key}.f32`);
  if (fs.existsSync(file)) {
    const b = fs.readFileSync(file);
    return new Float32Array(b.buffer, b.byteOffset, b.length / 4).slice();
  }
  const tts = await loadTTS();
  const { input_ids } = tts.tokenizer(ph, { truncation: true });
  const audio = await tts.generate_from_ids(input_ids, { voice, speed });
  const out = trim(audio.audio);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, Buffer.from(out.buffer, out.byteOffset, out.byteLength));
  return out;
}

// Kokoro handles ~510 phoneme tokens per call. Longer sentences are split at the
// comma closest to the middle and joined with a comma-length breath.
async function synthSentence(text, voice, speed) {
  const ph = await toPhonemes(text);
  if (ph.length <= 480) return fadeEdges(await synthPhonemes(ph, voice, speed));
  const commas = [...text.matchAll(/,\s/g)].map((m) => m.index);
  if (!commas.length) throw new Error(`Sentence too long and no comma to split: ${text}`);
  const mid = text.length / 2;
  const at = commas.reduce((best, c) => (Math.abs(c - mid) < Math.abs(best - mid) ? c : best));
  const a = await synthSentence(text.slice(0, at + 1), voice, speed);
  const b = await synthSentence(text.slice(at + 2), voice, speed);
  return concat([a, silence(TIMELINE.commaSplitPause), b]);
}

// ---------------------------------------------------------------- phrasing
// Sentences are synthesized in small groups so Kokoro carries intonation across the
// sentence break (one-sentence-at-a-time reads like a list). Short punch lines
// ("It breaks.") are isolated and given a beat of air either side.
const words = (s) => s.split(/\s+/).length;
const isPunch = (s) => words(s) <= 5;

async function buildChunks(sentences) {
  const ph = await Promise.all(sentences.map((s) => toPhonemes(s)));
  const chunks = [];
  let cur = null;
  sentences.forEach((s, i) => {
    const last = cur && sentences[cur.idx[cur.idx.length - 1]];
    const fits = cur && cur.len + ph[i].length + 1 <= 360 && cur.idx.length < 3;
    if (!cur || !fits || isPunch(s) || isPunch(last) || last.endsWith(":")) {
      cur = { idx: [], len: 0 };
      chunks.push(cur);
    }
    cur.idx.push(i);
    cur.len += ph[i].length + 1;
  });
  return chunks.map((c) => ({ idx: c.idx, ph: c.idx.map((i) => ph[i]) }));
}

// Find the k-1 sentence breaks inside a multi-sentence chunk from its silences.
function alignChunk(buf, phs) {
  const k = phs.length;
  const dur = buf.length / SR;
  if (k === 1) return [[0, dur]];
  const hop = Math.round(SR * 0.01);
  const rms = [];
  for (let i = 0; i + hop <= buf.length; i += hop) {
    let e = 0;
    for (let j = i; j < i + hop; j++) e += buf[j] * buf[j];
    rms.push(Math.sqrt(e / hop));
  }
  const peak = Math.max(...rms);
  const thr = Math.max(0.004, peak * 0.035);
  const runs = [];
  let st = -1;
  rms.forEach((v, i) => {
    if (v < thr && st < 0) st = i;
    if ((v >= thr || i === rms.length - 1) && st >= 0) {
      if (i - st >= 9) runs.push({ a: st * 0.01, b: i * 0.01 });
      st = -1;
    }
  });
  const total = phs.reduce((a, p) => a + p.length, 0);
  let acc = 0;
  let prev = 0;
  const cuts = [];
  for (let j = 0; j < k - 1; j++) {
    acc += phs[j].length;
    const expect = (dur * acc) / total;
    let best = null;
    for (const r of runs) {
      const c = (r.a + r.b) / 2;
      if (r.a <= prev + 0.3) continue;
      const score = (r.b - r.a) * 2.5 - Math.abs(c - expect);
      if (Math.abs(c - expect) < Math.max(1.2, dur * 0.22) && (!best || score > best.score)) best = { ...r, score };
    }
    const cut = best ? [best.a + 0.03, best.b - 0.03] : [expect, expect];
    cuts.push(cut);
    prev = cut[1];
  }
  const spans = [];
  let s0 = 0;
  for (const [a, b] of cuts) {
    spans.push([s0, a]);
    s0 = b;
  }
  spans.push([s0, dur]);
  alignChunk.stats.total += k - 1;
  alignChunk.stats.fallback += cuts.filter(([a, b]) => a === b).length;
  return spans;
}
alignChunk.stats = { total: 0, fallback: 0 };

// Short, declarative lines are delivered more slowly, as a narrator would.
function phraseSpeed(base, nWords) {
  if (nWords <= 6) return +(base * 0.9).toFixed(3);
  if (nWords <= 12) return +(base * 0.94).toFixed(3);
  if (nWords <= 20) return +(base * 0.97).toFixed(3);
  return base;
}

async function synthChunk(sentences, chunk, voice, baseSpeed) {
  // a reader's tempo drifts a little phrase to phrase; ±1.5%, seeded by the text
  const h = crypto.createHash("md5").update(chunk.idx.map((i) => sentences[i]).join(" ")).digest()[0] / 255;
  const speed = +(phraseSpeed(baseSpeed, chunk.idx.reduce((a, i) => a + words(sentences[i]), 0)) * (1 + (h - 0.5) * 0.03)).toFixed(3);
  if (chunk.idx.length === 1) {
    const buf = await synthSentence(sentences[chunk.idx[0]], voice, speed);
    return { buf, spans: [[0, buf.length / SR]] };
  }
  const buf = fadeEdges(await synthPhonemes(chunk.ph.join(" "), voice, speed));
  return { buf, spans: alignChunk(buf, chunk.ph) };
}

// Pause between chunks: varied, never metronomic. Seeded so re-runs are identical.
function pauseAfter(prevText, nextText, seed) {
  const r = (Math.sin(seed * 12.9898) * 43758.5453) % 1;
  const jitter = (Math.abs(r) - 0.5) * 0.12;
  if (prevText.endsWith(":")) return 0.32 + jitter * 0.5;
  if (isPunch(nextText)) return 0.72 + jitter;
  if (isPunch(prevText)) return 0.6 + jitter;
  if (words(prevText) > 28) return 0.52 + jitter;
  return 0.44 + jitter;
}

// ---------------------------------------------------------------- breath + room tone
// RBJ biquad, applied in place.
function biquad(buf, type, f0, q) {
  const w = (2 * Math.PI * f0) / SR;
  const al = Math.sin(w) / (2 * q);
  const cw = Math.cos(w);
  let b0, b1, b2;
  if (type === "band") [b0, b1, b2] = [al, 0, -al];
  else [b0, b1, b2] = [(1 - cw) / 2, 1 - cw, (1 - cw) / 2];
  const a0 = 1 + al;
  const a1 = -2 * cw;
  const a2 = 1 - al;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < buf.length; i++) {
    const x = buf[i];
    const y = (b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
    x2 = x1; x1 = x; y2 = y1; y1 = y;
    buf[i] = y;
  }
  return buf;
}

// A soft mouth inhale: pink noise through two breathy formants, swelling then cut.
function breath(dur, rms, seed) {
  const n = Math.round(dur * SR);
  let a = seed >>> 0;
  const rnd = () => ((a = (a * 1664525 + 1013904223) >>> 0) / 4294967296) * 2 - 1;
  let b0 = 0, b1 = 0, b2 = 0;
  const pink = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const w = rnd();
    b0 = 0.99765 * b0 + w * 0.099046;
    b1 = 0.963 * b1 + w * 0.2965164;
    b2 = 0.57 * b2 + w * 1.0526913;
    pink[i] = b0 + b1 + b2 + w * 0.1848;
  }
  const f1 = biquad(pink.slice(), "band", 1250 + (seed % 7) * 40, 1.1);
  const f2 = biquad(pink.slice(), "band", 2700 + (seed % 5) * 60, 1.8);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const u = i / n;
    const env = u < 0.62 ? Math.pow(Math.sin((Math.PI / 2) * (u / 0.62)), 1.6) : Math.pow(Math.cos((Math.PI / 2) * ((u - 0.62) / 0.38)), 2);
    out[i] = (f1[i] + 0.55 * f2[i]) * env * (1 + 0.12 * Math.sin((2 * Math.PI * 6.5 * i) / SR));
  }
  biquad(out, "low", 5200, 0.7);
  let e = 0;
  for (let i = 0; i < n; i++) e += out[i] * out[i];
  const g = rms / Math.sqrt(e / n || 1e-12);
  for (let i = 0; i < n; i++) out[i] *= g;
  return out;
}

function rmsOf(bufs) {
  let e = 0;
  let k = 0;
  for (const b of bufs) for (let i = 0; i < b.length; i++) if (Math.abs(b[i]) > 0.01) { e += b[i] * b[i]; k++; }
  return Math.sqrt(e / (k || 1));
}

// ---------------------------------------------------------------- subtitles
function srtTime(t) {
  const ms = Math.max(0, Math.round(t * 1000));
  const h = String(Math.floor(ms / 3600000)).padStart(2, "0");
  const m = String(Math.floor((ms % 3600000) / 60000)).padStart(2, "0");
  const s = String(Math.floor((ms % 60000) / 1000)).padStart(2, "0");
  return `${h}:${m}:${s},${String(ms % 1000).padStart(3, "0")}`;
}

// Break a sentence into cues of at most two ~42-char lines, timed by character share.
function sentenceCues(s) {
  const words = s.text.split(" ");
  const chunks = [];
  let cur = [];
  for (const w of words) {
    const next = [...cur, w].join(" ");
    if (next.length > 84 && cur.length) {
      chunks.push(cur.join(" "));
      cur = [w];
    } else cur.push(w);
  }
  if (cur.length) chunks.push(cur.join(" "));
  const total = chunks.reduce((a, c) => a + c.length, 0);
  let t = s.start;
  return chunks.map((c) => {
    const d = ((s.end - s.start) * c.length) / total;
    const cue = { start: t, end: t + d, text: wrap2(c) };
    t += d;
    return cue;
  });
}

function wrap2(text) {
  if (text.length <= 42) return text;
  const mid = text.length / 2;
  let best = -1;
  for (let i = 0; i < text.length; i++) if (text[i] === " " && (best < 0 || Math.abs(i - mid) < Math.abs(best - mid))) best = i;
  return best < 0 ? text : `${text.slice(0, best)}\n${text.slice(best + 1)}`;
}

// ---------------------------------------------------------------- episode
async function buildEpisode(n, voice, speed) {
  alignChunk.stats = { total: 0, fallback: 0 };
  const paras = readParagraphs(n);
  const chunks = [silence(TIMELINE.titleCard)];
  const voiced = [];
  const breaths = []; // { at: speech onset (s), dur, rel: dB below speech RMS }
  let t = TIMELINE.titleCard;
  const timing = { episode: n, voice, speed, titleCard: TIMELINE.titleCard, paragraphs: [] };
  const t0 = Date.now();

  for (let p = 0; p < paras.length; p++) {
    const sentences = splitSentences(paras[p]);
    const para = { index: p, start: t, sentences: [] };
    const groups = await buildChunks(sentences);
    for (let g = 0; g < groups.length; g++) {
      const { buf, spans } = await synthChunk(sentences, groups[g], voice, speed);
      voiced.push(buf);
      const nWords = groups[g].idx.reduce((a, i) => a + words(sentences[i]), 0);
      const lastPause = g === 0 ? Infinity : pauseAfter(sentences[groups[g - 1].idx[groups[g - 1].idx.length - 1]], sentences[groups[g].idx[0]], n * 1000 + p * 50 + g - 1);
      const coin = crypto.createHash("md5").update(`${n}|${p}|${g}`).digest()[1] / 255;
      if (g === 0) breaths.push({ at: t, dur: 0.42 + coin * 0.12, rel: -28 });
      else if (lastPause >= 0.58 && nWords >= 10 && coin < 0.55) breaths.push({ at: t, dur: 0.26 + coin * 0.08, rel: -32 });
      groups[g].idx.forEach((si, j) => para.sentences.push({ text: sentences[si], start: t + spans[j][0], end: t + spans[j][1] }));
      chunks.push(buf);
      t += buf.length / SR;
      if (g < groups.length - 1) {
        const last = sentences[groups[g].idx[groups[g].idx.length - 1]];
        const next = sentences[groups[g + 1].idx[0]];
        const pause = pauseAfter(last, next, n * 1000 + p * 50 + g);
        chunks.push(silence(pause));
        t += pause;
      }
    }
    para.end = t;
    timing.paragraphs.push(para);
    // paragraph breath: a little longer after long paragraphs, never identical
    const r = Math.abs((Math.sin((n * 100 + p) * 78.233) * 43758.5453) % 1);
    const gap = p < paras.length - 1 ? TIMELINE.paragraphGap + (r - 0.5) * 0.4 + Math.min(0.3, (para.end - para.start) / 200) : TIMELINE.tail;
    chunks.push(silence(gap));
    t += gap;
    process.stdout.write(`  ep${n} ¶${p + 1}/${paras.length} ${para.end.toFixed(1)}s\n`);
  }
  timing.total = t;

  const wordCount = paras.join(" ").split(/\s+/).length;
  const spoken = timing.paragraphs.reduce((a, p) => a + (p.end - p.start), 0);
  timing.wpm = Math.round((wordCount / spoken) * 60);

  for (const d of ["audio", "timing", "subtitles"]) fs.mkdirSync(path.join(OUT, d), { recursive: true });
  const raw = path.join(OUT, "audio", `episode-0${n}-raw.wav`);
  const wav = path.join(OUT, "audio", `episode-0${n}-narration.wav`);
  const mp3 = path.join(OUT, "audio", `episode-0${n}-narration.mp3`);
  const all = concat(chunks);
  // breaths end ~70 ms before the voice comes in, as a reader's would
  const sRMS = rmsOf(voiced);
  breaths.forEach((b, k) => {
    const buf = breath(b.dur, sRMS * Math.pow(10, b.rel / 20), 1000 * n + k * 17 + 3);
    const i0 = Math.max(0, Math.round((b.at - 0.07 - b.dur) * SR));
    for (let i = 0; i < buf.length && i0 + i < all.length; i++) all[i0 + i] += buf[i];
  });
  // room tone: a faint, steady floor so pauses never drop to digital silence
  {
    let a = 77 + n;
    const rnd = () => ((a = (a * 1664525 + 1013904223) >>> 0) / 4294967296) * 2 - 1;
    let lp = 0;
    const lvl = sRMS * Math.pow(10, -60 / 20);
    for (let i = 0; i < all.length; i++) {
      lp = lp * 0.96 + rnd() * 0.04;
      all[i] += lp * lvl * 9;
    }
  }
  timing.breaths = breaths.length;
  writeWav(raw, all);
  const ir = path.join(OUT, "audio", "room-ir.wav");
  if (!fs.existsSync(ir)) writeRoomIR(ir);
  // Voice chain: rumble cut, a touch of chest, softened sibilance, gentle compression,
  // a small dry room (so silences sound like a booth, not a void), loudness to -16 LUFS.
  const chain =
    "[0:a]aresample=48000,highpass=f=65,bass=g=1.5:f=150:w=0.7," +
    "equalizer=f=2800:t=q:w=1:g=0.8,equalizer=f=6800:t=q:w=1.2:g=-2.5," +
    "acompressor=threshold=0.09:ratio=2.4:attack=12:release=220:makeup=1.6," +
    "pan=stereo|c0=c0|c1=c0,asplit=2[dry][src];" +
    "[src][1:a]afir=dry=10:wet=10[wet];" +
    "[dry][wet]amix=inputs=2:weights=1 0.16:normalize=0,loudnorm=I=-16:TP=-1.5:LRA=8[out]";
  ffmpeg(["-i", raw, "-i", ir, "-filter_complex", chain, "-map", "[out]", "-ar", "48000", "-ac", "2", wav]);
  ffmpeg(["-i", wav, "-codec:a", "libmp3lame", "-b:a", "192k", mp3]);
  fs.rmSync(raw);
  fs.writeFileSync(path.join(OUT, "timing", `episode-0${n}.json`), JSON.stringify(timing, null, 2));

  const cues = timing.paragraphs.flatMap((p) => p.sentences.flatMap(sentenceCues));
  fs.writeFileSync(
    path.join(OUT, "subtitles", `episode-0${n}.srt`),
    cues.map((c, i) => `${i + 1}\n${srtTime(c.start)} --> ${srtTime(c.end)}\n${c.text}\n`).join("\n"),
  );

  console.log(
    `ep${n}: ${(t / 60).toFixed(2)} min total, ${timing.wpm} wpm spoken, synth ${((Date.now() - t0) / 1000).toFixed(0)}s, ` +
      `breaks aligned ${alignChunk.stats.total - alignChunk.stats.fallback}/${alignChunk.stats.total}`,
  );
}

async function voiceSamples(speed) {
  const para = readParagraphs(1)[0];
  const dir = path.join(OUT, "voice-samples");
  fs.mkdirSync(dir, { recursive: true });
  for (const v of ["am_michael", "am_fenrir", "am_puck", "bm_george", "bm_fable", "af_heart", "bf_emma"]) {
    const buf = concat(
      (await Promise.all(splitSentences(para).map((s) => synthSentence(s, v, speed)))).flatMap((b) => [b, silence(TIMELINE.sentencePause)]),
    );
    const raw = path.join(dir, `${v}-raw.wav`);
    writeWav(raw, buf);
    ffmpeg(["-i", raw, "-af", "highpass=f=70,loudnorm=I=-16:TP=-1.5:LRA=7", "-ar", "48000", path.join(dir, `${v}.mp3`)]);
    fs.rmSync(raw);
    console.log(`sample ${v}`);
  }
}

// ---------------------------------------------------------------- cli
const args = process.argv.slice(2);
const opt = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const voice = opt("--voice", VOICE);
const speed = Number(opt("--speed", SPEED));
const eps = args.filter((a, i) => /^[1-5]$/.test(a) && !["--voice", "--speed"].includes(args[i - 1])).map(Number);

if (args.includes("--samples")) await voiceSamples(speed);
else for (const n of eps.length ? eps : [1, 2, 3, 4, 5]) await buildEpisode(n, voice, speed);
// onnxruntime-node may print a "mutex lock failed" abort during its own static teardown
// after everything is written. It is harmless; all outputs are complete by this point.
process.exit(0);
