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
  const paras = readParagraphs(n);
  const chunks = [silence(TIMELINE.titleCard)];
  let t = TIMELINE.titleCard;
  const timing = { episode: n, voice, speed, titleCard: TIMELINE.titleCard, paragraphs: [] };
  const t0 = Date.now();

  for (let p = 0; p < paras.length; p++) {
    const sentences = splitSentences(paras[p]);
    const para = { index: p, start: t, sentences: [] };
    for (let s = 0; s < sentences.length; s++) {
      const buf = await synthSentence(sentences[s], voice, speed);
      para.sentences.push({ text: sentences[s], start: t, end: t + buf.length / SR });
      chunks.push(buf);
      t += buf.length / SR;
      if (s < sentences.length - 1) {
        const pause = sentences[s].endsWith(":") ? TIMELINE.colonPause : TIMELINE.sentencePause;
        chunks.push(silence(pause));
        t += pause;
      }
    }
    para.end = t;
    timing.paragraphs.push(para);
    const gap = p < paras.length - 1 ? TIMELINE.paragraphGap : TIMELINE.tail;
    chunks.push(silence(gap));
    t += gap;
    process.stdout.write(`  ep${n} ¶${p + 1}/${paras.length} ${para.end.toFixed(1)}s\n`);
  }
  timing.total = t;

  const words = paras.join(" ").split(/\s+/).length;
  const spoken = timing.paragraphs.reduce((a, p) => a + (p.end - p.start), 0);
  timing.wpm = Math.round((words / spoken) * 60);

  for (const d of ["audio", "timing", "subtitles"]) fs.mkdirSync(path.join(OUT, d), { recursive: true });
  const raw = path.join(OUT, "audio", `episode-0${n}-raw.wav`);
  const wav = path.join(OUT, "audio", `episode-0${n}-narration.wav`);
  const mp3 = path.join(OUT, "audio", `episode-0${n}-narration.mp3`);
  writeWav(raw, concat(chunks));
  // Light voice chain: rumble cut, gentle de-ess-ish shelf, two-pass-free loudnorm to -16 LUFS.
  ffmpeg(["-i", raw, "-af", "highpass=f=70,equalizer=f=6500:t=q:w=1.2:g=-2,loudnorm=I=-16:TP=-1.5:LRA=7", "-ar", "48000", "-ac", "1", wav]);
  ffmpeg(["-i", wav, "-codec:a", "libmp3lame", "-b:a", "192k", mp3]);
  fs.rmSync(raw);
  fs.writeFileSync(path.join(OUT, "timing", `episode-0${n}.json`), JSON.stringify(timing, null, 2));

  const cues = timing.paragraphs.flatMap((p) => p.sentences.flatMap(sentenceCues));
  fs.writeFileSync(
    path.join(OUT, "subtitles", `episode-0${n}.srt`),
    cues.map((c, i) => `${i + 1}\n${srtTime(c.start)} --> ${srtTime(c.end)}\n${c.text}\n`).join("\n"),
  );

  console.log(
    `ep${n}: ${(t / 60).toFixed(2)} min total, ${timing.wpm} wpm spoken, synth ${((Date.now() - t0) / 1000).toFixed(0)}s`,
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
