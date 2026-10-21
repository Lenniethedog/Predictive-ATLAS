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
import { spawn, spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { TIMELINE, VOICE, SPEED, ROOT, OUT, ENGINE, CHATTERBOX, NARRATOR } from "./config.mjs";
import { assertEpisode } from "./story.mjs";
import { pathToFileURL } from "node:url";
import { VOICE_REVISION, splitSentences, deliverySpeed, pauseAfter, trimSpeech, isPunch } from "./narration.mjs";

const SR = 24000;
export function narrationFingerprint() {
  return crypto.createHash("sha256")
    .update(fs.readFileSync(new URL("./tts.mjs", import.meta.url)))
    .update(fs.readFileSync(new URL("./narration.mjs", import.meta.url)))
    .update(fs.readFileSync(new URL("./voice_worker.py", import.meta.url)))
    .update(ENGINE)
    .digest("hex");
}

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
  ["kjˈɪv", "ˈkiːv"], // Kyiv: KEEV
  ["dnˈiːpɚ", "ˈniːpɚ"], // Dnieper: NEE-per
  ["jˈʊɹɹoʊzˌoʊn", "ˈjʊɹoʊzoʊn"], // eurozone, without the doubled r
  ["ˈɪmf", "ˌaɪɛmˈɛf"], // IMF, letter by letter
  ["dˈɑːnbəz", "dɑnˈbɑːs"], // Donbas: don-BAHSS
  ["dʒjˈɑːŋ", "dʒiˈɑŋ"], // Jiang: jee-AHNG
  ["sˈæks", "sˈɑːks"], // Sachs: SAHKS
  ["bˌuːkɚɹˈɛst", "ˌbuːkəˈɹɛst"], // Bucharest: boo-kuh-REST
  ["kəzmˈiːnoʊ", "koʊzˈmiːnoʊ"], // Kozmino: koz-MEE-no
  ["tˌiːˌɛsˌɛmsˈiː", "ˌtiːɛsɛmˈsiː"], // TSMC
  ["ˈæzməl", "ˌeɪɛsɛmˈɛl"], // ASML, letter by letter
  ["pˈiːbˈɑːk", "ˌpiːbiːoʊˈsiː"], // PBOC
  ["wˈɪlhɪlmʃˌeɪvən", "ˌvɪlhɛlmsˈhɑːfən"], // Wilhelmshaven
];

const BRITISH_FIXES = [
  ["mˈiəʃeɪmə", "mˈiəʃaɪmə"],
  ["mˈalakə", "məlˈakə"],
  ["dnˈiːpə", "ˈniːpə"],
  ["sˈɛvastˌɒpɒl", "sˌɛvastˈəʊpəl"],
  ["dˈɒnbəz", "dɒnˈbɑːs"],
  ["dʒjˈaŋ", "dʒiˈɑŋ"],
  ["sˈaks", "sˈɑːks"],
  ["bˌuːkɐɹˈɛst", "ˌbuːkəˈɹɛst"],
  ["kəzmˈiːnəʊ", "kɒzˈmiːnəʊ"],
  ["ˈazməl", "ˌeɪɛsɛmˈɛl"],
  ["pˈiːbˈɒk", "ˌpiːbiːəʊˈsiː"],
];

const PUNCT = ';:,.!?¡¿—…"«»“”(){}[]';
const PUNCT_RE = new RegExp(`(\\s*[${PUNCT.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}]+\\s*)+`, "g");

// Mirrors kokoro-js's internal phonemizer (punctuation preserved, espeak en-us on the
// words in between, same post-fixes), then applies PHONEME_FIXES.
export async function toPhonemes(text, voice = VOICE) {
  const british = voice.startsWith("b");
  const locale = british ? "en" : "en-us";
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
    await Promise.all(parts.map(async (p) => (p.punct ? p.text : (await espeak(p.text, locale)).join(" "))))
  ).join("");
  ph = ph
    .replace(/ʲ/g, "j")
    .replace(/r/g, "ɹ")
    .replace(/x/g, "k")
    .replace(/ɬ/g, "l")
    .replace(/(?<=[a-zɹː])(?=hˈʌndɹɪd)/g, " ")
    .replace(/ z(?=[;:,.!?¡¿—…"«»“” ]|$)/g, "z")
    ;
  if (!british) ph = ph.replace(/(?<=nˈaɪn)ti(?!ː)/g, "di");
  for (const [from, to] of [...PHONEME_FIXES, ...(british ? BRITISH_FIXES : [])]) {
    ph = ph.replace(new RegExp(`(^|[\\s${PUNCT.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}-])${from}`, "g"), `$1${to}`);
  }
  return ph.trim();
}

// ---------------------------------------------------------------- text
export async function readParagraphs(n) {
  const ep = (await import(`./episodes/ep${n}.mjs`)).default;
  return assertEpisode(ep, Number(n)).map((s) => s.narration.replace(/\s+/g, " ").trim());
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
  const key = crypto.createHash("sha1").update(`${VOICE_REVISION}|${voice}|${speed}|${ph}`).digest("hex");
  const file = path.join(OUT, "cache", `${key}.f32`);
  if (fs.existsSync(file)) {
    const b = fs.readFileSync(file);
    return new Float32Array(b.buffer, b.byteOffset, b.length / 4).slice();
  }
  const tts = await loadTTS();
  const { input_ids } = tts.tokenizer(ph, { truncation: false });
  if (input_ids.data.length > 512) throw new Error(`Speech exceeds the model token limit (${input_ids.data.length})`);
  const audio = await tts.generate_from_ids(input_ids, { voice, speed });
  if (!audio.audio.length || audio.audio.some((v) => !Number.isFinite(v))) throw new Error("Invalid synthesized audio");
  const out = trimSpeech(audio.audio);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, Buffer.from(out.buffer, out.byteOffset, out.byteLength));
  return out;
}

// Kokoro handles ~510 phoneme tokens per call. Longer sentences are split at the
// comma closest to the middle and joined with a comma-length breath.
async function synthSentence(text, voice, speed) {
  const ph = await toPhonemes(text, voice);
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

async function buildChunks(sentences, voice) {
  const ph = await Promise.all(sentences.map((s) => toPhonemes(s, voice)));
  const chunks = [];
  let cur = null;
  sentences.forEach((s, i) => {
    const last = cur && sentences[cur.idx[cur.idx.length - 1]];
    const fits = cur && cur.len + ph[i].length + 1 <= 420 && cur.idx.length < 4 && cur.idx.reduce((n, j) => n + words(sentences[j]), words(s)) <= 58;
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
alignChunk.stats = { total: 0, fallback: 0, revoiced: 0 };

async function synthChunk(sentences, chunk, voice, baseSpeed, mood, final = false) {
  const text = chunk.idx.map((i) => sentences[i]).join(" ");
  const speed = deliverySpeed(baseSpeed, text, mood, final);
  if (chunk.idx.length === 1) {
    const buf = await synthSentence(text, voice, speed);
    return { buf, spans: [[0, buf.length / SR]], speed };
  }
  const buf = fadeEdges(await synthPhonemes(chunk.ph.join(" "), voice, speed));
  const before = { ...alignChunk.stats };
  const spans = alignChunk(buf, chunk.ph);
  if (alignChunk.stats.fallback === before.fallback) return { buf, spans, speed };
  // Keep fluent groups when boundaries are clear; revoice uncertain groups as
  // individual sentences rather than guess where the animation should move.
  alignChunk.stats = before;
  const pieces = [], exact = [];
  let cursor = 0;
  for (const [j, i] of chunk.idx.entries()) {
    const part = await synthSentence(sentences[i], voice, speed);
    exact.push([cursor, cursor + part.length / SR]);
    pieces.push(part);
    cursor += part.length / SR;
    if (j < chunk.idx.length - 1) {
      const gap = pauseAfter(sentences[i], sentences[chunk.idx[j + 1]], i + 17);
      pieces.push(silence(gap)); cursor += gap;
    }
  }
  alignChunk.stats.revoiced++;
  return { buf: concat(pieces), spans: exact, speed };
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

// ---------------------------------------------------------------- chatterbox engine
// Passages of one to three sentences: enough for intonation to carry across a thought,
// short enough to stay coherent. Punch lines stand alone.
function cbChunks(sentences) {
  const groups = [];
  let cur = null;
  sentences.forEach((s, i) => {
    const prev = cur && sentences[cur[cur.length - 1]];
    const len = cur ? cur.reduce((a, k) => a + sentences[k].length + 1, 0) : 0;
    if (!cur || cur.length >= 3 || len + s.length > CHATTERBOX.maxChars || isPunch(s) || isPunch(prev) || prev.endsWith(":")) {
      cur = [];
      groups.push(cur);
    }
    cur.push(i);
  });
  return groups;
}

function readWavF32(file) {
  const b = fs.readFileSync(file);
  let o = 12;
  let fmt = 1, bits = 16, ch = 1, sr = SR, data = null;
  while (o + 8 <= b.length) {
    const id = b.toString("ascii", o, o + 4);
    const size = b.readUInt32LE(o + 4);
    if (id === "fmt ") {
      fmt = b.readUInt16LE(o + 8);
      ch = b.readUInt16LE(o + 10);
      sr = b.readUInt32LE(o + 12);
      bits = b.readUInt16LE(o + 22);
      if (fmt === 0xfffe) fmt = b.readUInt16LE(o + 32);
    } else if (id === "data") data = b.subarray(o + 8, o + 8 + size);
    o += 8 + size + (size % 2);
  }
  if (!data) throw new Error(`no audio in ${file}`);
  if (sr !== SR) throw new Error(`${file}: expected ${SR} Hz, got ${sr}`);
  const n = data.length / (bits / 8) / ch;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const k = i * ch * (bits / 8);
    out[i] = fmt === 3 ? data.readFloatLE(k) : bits === 16 ? data.readInt16LE(k) / 32768 : data.readInt32LE(k) / 2147483648;
  }
  return out;
}

let worker = null;
function cbWorker() {
  if (worker) return worker;
  const env = { ...process.env, VOICE_REF: path.join(ROOT, CHATTERBOX.reference), PYTORCH_ENABLE_MPS_FALLBACK: "1" };
  const proc = spawn(path.join(ROOT, ".venv/bin/python"), [path.join(ROOT, "src/voice_worker.py")], { cwd: ROOT, env, stdio: ["pipe", "pipe", "inherit"] });
  const waiting = new Map();
  let buf = "";
  let ready;
  const readyP = new Promise((r) => (ready = r));
  proc.stdout.on("data", (d) => {
    buf += d;
    let k;
    while ((k = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, k).trim();
      buf = buf.slice(k + 1);
      if (!line.startsWith("{")) continue;
      const msg = JSON.parse(line);
      if (msg.ready) ready();
      else waiting.get(msg.id)?.(msg), waiting.delete(msg.id);
    }
  });
  proc.on("exit", (c) => {
    for (const fn of waiting.values()) fn({ error: `voice worker exited ${c}` });
  });
  let seq = 0;
  worker = {
    async say(req) {
      await readyP;
      const id = ++seq;
      return new Promise((res) => {
        waiting.set(id, res);
        proc.stdin.write(JSON.stringify({ ...req, id }) + "\n");
      });
    },
    close() {
      proc.stdin.end();
    },
  };
  return worker;
}

const refHash = () => crypto.createHash("sha1").update(fs.readFileSync(path.join(ROOT, CHATTERBOX.reference))).digest("hex").slice(0, 12);

async function cbSay(text, mood, seed) {
  const exaggeration = CHATTERBOX.exaggeration[mood] ?? 0.47;
  const key = crypto
    .createHash("sha1")
    .update(JSON.stringify([text, exaggeration, CHATTERBOX.cfg, CHATTERBOX.temperature, CHATTERBOX.tries, seed, refHash(), fs.readFileSync(path.join(ROOT, "src/voice_worker.py"), "utf8")]))
    .digest("hex");
  const dir = path.join(OUT, "cache", "chatterbox");
  fs.mkdirSync(dir, { recursive: true });
  const wav = path.join(dir, `${key}.wav`);
  const meta = path.join(dir, `${key}.json`);
  if (fs.existsSync(wav) && fs.existsSync(meta)) return { ...JSON.parse(fs.readFileSync(meta, "utf8")), buf: readWavF32(wav) };
  const r = await cbWorker().say({ text, out: wav, exaggeration, cfg: CHATTERBOX.cfg, temperature: CHATTERBOX.temperature, seed, tries: CHATTERBOX.tries });
  if (r.error) throw new Error(`voice worker: ${r.error} for "${text.slice(0, 60)}…"`);
  fs.writeFileSync(meta, JSON.stringify(r));
  return { ...r, buf: readWavF32(wav) };
}

// Sentence spans inside a passage, from the aligned word times.
function cbSpans(sentences, idx, words, dur) {
  const spans = [];
  let w = 0;
  let unsure = 0;
  for (const i of idx) {
    const n = sentences[i].split(/\s+/).filter(Boolean).length;
    const first = words[w];
    const last = words[w + n - 1];
    if (!first?.m || !last?.m) unsure++;
    spans.push([Math.max(0, first.start - 0.04), Math.min(dur, last.end + 0.08)]);
    w += n;
  }
  for (let k = 0; k < spans.length - 1; k++) if (spans[k][1] > spans[k + 1][0]) spans[k][1] = spans[k + 1][0];
  return { spans, unsure };
}

const cbStats = { passages: 0, retakes: 0, maxWer: 0, revoiced: 0, wer: [] };

async function cbPassage(sentences, idx, mood, seed) {
  const text = idx.map((i) => sentences[i]).join(" ");
  const r = await cbSay(text, mood, seed);
  cbStats.passages++;
  cbStats.retakes += (r.tries ?? 1) - 1;
  cbStats.wer.push(r.wer);
  cbStats.maxWer = Math.max(cbStats.maxWer, r.wer);
  if (idx.length === 1) return { buf: r.buf, spans: [[0, r.buf.length / SR]], uncertain: 0 };
  const { spans, unsure } = cbSpans(sentences, idx, r.words, r.buf.length / SR);
  if (!unsure) return { buf: r.buf, spans, uncertain: 0 };
  // A boundary word could not be matched: voice these sentences one at a time instead.
  cbStats.revoiced++;
  const pieces = [];
  const exact = [];
  let cursor = 0;
  for (const [j, i] of idx.entries()) {
    const one = await cbSay(sentences[i], mood, seed + 7 * (j + 1));
    exact.push([0, one.buf.length / SR].map((x) => x + cursor));
    pieces.push(one.buf);
    cursor += one.buf.length / SR;
    if (j < idx.length - 1) {
      const gap = pauseAfter(sentences[i], sentences[idx[j + 1]], i + 17);
      pieces.push(silence(gap));
      cursor += gap;
    }
  }
  return { buf: concat(pieces), spans: exact, uncertain: 0 };
}

// ---------------------------------------------------------------- episode
async function buildEpisode(n, voice, speed) {
  alignChunk.stats = { total: 0, fallback: 0, revoiced: 0 };
  const paras = await readParagraphs(n);
  const episode = (await import(`./episodes/ep${n}.mjs`)).default;
  const chunks = [silence(TIMELINE.titleCard)];
  let t = TIMELINE.titleCard;
  const timing = {
    episode: n,
    voice: ENGINE === "chatterbox" ? NARRATOR : voice,
    engine: ENGINE,
    speed,
    revision: VOICE_REVISION,
    fingerprint: narrationFingerprint(),
    locale: ENGINE === "chatterbox" || voice.startsWith("b") ? "en-GB" : "en-US",
    titleCard: TIMELINE.titleCard,
    paragraphs: [],
  };
  const t0 = Date.now();

  for (let p = 0; p < paras.length; p++) {
    const sentences = splitSentences(paras[p]);
    const para = { index: p, start: t, sentences: [] };
    const groups = ENGINE === "chatterbox" ? cbChunks(sentences).map((idx) => ({ idx })) : await buildChunks(sentences, voice);
    for (let g = 0; g < groups.length; g++) {
      const mood = episode.scenes[p].mood;
      const { buf, spans, speed: deliveredSpeed, uncertain = 0 } =
        ENGINE === "chatterbox"
          ? { ...(await cbPassage(sentences, groups[g].idx, mood, n * 100000 + p * 100 + g)), speed: 1 }
          : await synthChunk(sentences, groups[g], voice, speed, mood, g === groups.length - 1);
      if (ENGINE === "chatterbox") {
        alignChunk.stats.total += groups[g].idx.length - 1;
        alignChunk.stats.fallback += uncertain;
      }
      // No added breath noises. They read as a machine inhaling.
      groups[g].idx.forEach((si, j) => para.sentences.push({ text: sentences[si], start: t + spans[j][0], end: t + spans[j][1], speed: deliveredSpeed }));
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
  timing.breaths = "native only";
  timing.align = { total: alignChunk.stats.total, fallback: alignChunk.stats.fallback, revoiced: alignChunk.stats.revoiced + cbStats.revoiced };
  if (ENGINE === "chatterbox") {
    const w = cbStats.wer;
    timing.transcript = { passages: cbStats.passages, retakes: cbStats.retakes, meanWer: +(w.reduce((a, b) => a + b, 0) / Math.max(1, w.length)).toFixed(4), maxWer: +cbStats.maxWer.toFixed(4) };
  }
  if (alignChunk.stats.fallback > 0) {
    throw new Error(
      `ep${n}: ${alignChunk.stats.fallback} of ${alignChunk.stats.total} sentence breaks had no silence to align. Refusing to write a narration the picture cannot trust.`,
    );
  }
  writeWav(raw, all);
  // Leave the voice mostly alone. Heavy EQ, compression, and a fake room are what make it sound processed.
  const chain = "[0:a]aresample=48000,highpass=f=65,deesser=i=0.12:m=0.25:f=0.6,pan=stereo|c0=c0|c1=c0,loudnorm=I=-16:TP=-1.5:LRA=11[out]";
  ffmpeg(["-i", raw, "-filter_complex", chain, "-map", "[out]", "-ar", "48000", "-ac", "2", wav]);
  ffmpeg(["-i", wav, "-codec:a", "libmp3lame", "-b:a", "192k", mp3]);
  fs.rmSync(raw);
  fs.writeFileSync(path.join(OUT, "timing", `episode-0${n}.json`), JSON.stringify(timing, null, 2));

  const cues = timing.paragraphs.flatMap((p) => p.sentences.flatMap(sentenceCues));
  const srtBody = cues.map((c, i) => `${i + 1}\n${srtTime(c.start)} --> ${srtTime(c.end)}\n${c.text}\n`).join("\n");
  fs.writeFileSync(path.join(OUT, "subtitles", `episode-0${n}.srt`), srtBody);
  fs.writeFileSync(path.join(OUT, "subtitles", `episode-0${n}.vtt`), `WEBVTT\n\n${srtBody.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, "$1.$2")}`);

  console.log(
    `ep${n}: ${(t / 60).toFixed(2)} min total, ${timing.wpm} wpm spoken, synth ${((Date.now() - t0) / 1000).toFixed(0)}s, ` +
      `breaks aligned ${alignChunk.stats.total - alignChunk.stats.fallback}/${alignChunk.stats.total}` +
      (timing.transcript ? `, transcript match ${(100 * (1 - timing.transcript.meanWer)).toFixed(1)}% (worst passage ${(100 * (1 - timing.transcript.maxWer)).toFixed(1)}%), ${timing.transcript.retakes} retakes` : ""),
  );
  Object.assign(cbStats, { passages: 0, retakes: 0, maxWer: 0, revoiced: 0, wer: [] });
}

async function voiceSamples(speed) {
  const para = (await readParagraphs(1))[0];
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

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (!(speed >= 0.7 && speed <= 1.3)) throw new Error("Speed must be between 0.7 and 1.3");
  if (args.includes("--samples")) await voiceSamples(speed);
  else for (const n of eps.length ? eps : [1, 2, 3, 4, 5]) await buildEpisode(n, voice, speed);
  worker?.close();
}
// onnxruntime-node may abort during its own teardown after the files are written.
// That abort is outside this script. A failed alignment throws above and does not write.
