// YouTube Shorts: one vertical 1080×1920 cut per episode, built from the finished film.
//
// Each Short is the episode's own thesis (its opening paragraph) plus, where it fits, a
// payoff line from later in the film. Picture and narration come from the same moments
// of the episode, so sync is exact. Layout keeps clear of the Shorts UI: a headline up
// top, the full 16:9 picture in the middle (nothing cropped), large word-by-word captions
// below it, and an end card pointing to the full episode.
//
//   node src/shorts.mjs            all five
//   node src/shorts.mjs 3          one
//
// Needs out/video/episode-0N.mp4, out/audio/episode-0N-{narration,music}.wav and the
// timing file. Word timings come from Whisper (src/words.py, local).
// Writes out/shorts/short-0N.mp4.
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { OUT, ROOT } from "./config.mjs";
import { C, canvas, clamp, ease, prog, rgba } from "./engine/core.mjs";
import { text, measure, roundRect } from "./engine/draw.mjs";
import { SR, svf, rng, writeStereo, integratedLUFS } from "./engine/audio.mjs";
import { glyph } from "./engine/chrome.mjs";
import { photoShots, PHOTO_DURATION } from "./engine/photos.mjs";

const SW = 1080;
const SH = 1920;
const FPS = 30;
const PANEL = { x: 0, y: 610, w: 1080, h: 608 };
const CARD = 3.2; // end card length (s)
const BUDGET = 59.5; // stay under a minute, end card included
const MUSIC_LUFS = -28.5; // same bed level as the films

// scene: 0-based scene index; sent: sentence indices (omit for the whole paragraph);
// optional segments are dropped (last first) if the Short would run long.
const SHORTS = {
  1: {
    headline: ["HOW THE PETRODOLLAR", "TRAPPED CHINA"],
    title: "How the petrodollar trapped China",
    tags: ["geopolitics", "China", "petrodollar", "economics"],
    segments: [{ scene: 0 }],
  },
  2: {
    headline: ["WHY UKRAINE ENDS", "IN PARTITION"],
    title: "Why the war in Ukraine points to partition",
    tags: ["geopolitics", "Ukraine", "NATO", "Russia"],
    segments: [{ scene: 0 }, { scene: 5, sent: [0, 1], optional: true }],
  },
  3: {
    headline: ["CAN THE U.S. CUT OFF", "CHINA'S OIL?"],
    title: "Can the U.S. really cut off China's oil?",
    tags: ["geopolitics", "China", "oil", "Malacca"],
    segments: [{ scene: 0 }, { scene: 4, sent: [2] }, { scene: 4, sent: [4] }, { scene: 4, sent: [6, 7] }],
  },
  4: {
    headline: ["GERMANY'S", "IMPOSSIBLE BARGAIN"],
    title: "Germany's impossible energy bargain",
    tags: ["geopolitics", "Germany", "energy", "Europe"],
    segments: [{ scene: 0 }],
  },
  5: {
    headline: ["WHY NEITHER SIDE", "WANTS TSMC INTACT"],
    title: "Why neither side wants TSMC intact",
    tags: ["geopolitics", "Taiwan", "semiconductors", "TSMC"],
    segments: [{ scene: 0 }, { scene: -1, sent: [-1], optional: true }],
  },
};

const run = (cmd, args, opts = {}) => {
  const r = spawnSync(cmd, args, { encoding: "utf8", maxBuffer: 1 << 30, ...opts });
  if (r.status !== 0) throw new Error(`${cmd} failed: ${(r.stderr || "").slice(-600)}`);
  return r;
};

// ---------------------------------------------------------------- plan
function plan(n) {
  const timing = JSON.parse(fs.readFileSync(path.join(OUT, "timing", `episode-0${n}.json`), "utf8"));
  const paras = timing.paragraphs;
  const spec = SHORTS[n];
  const resolve = (seg) => {
    const p = paras[seg.scene < 0 ? paras.length + seg.scene : seg.scene];
    const idx = (seg.sent ?? p.sentences.map((_, i) => i)).map((i) => (i < 0 ? p.sentences.length + i : i));
    const ss = idx.map((i) => p.sentences[i]);
    return { from: ss[0].start - 0.08, to: ss[ss.length - 1].end + 0.24, text: ss.map((s) => s.text).join(" "), sentences: ss, optional: !!seg.optional };
  };
  let segs = spec.segments.map(resolve);
  const total = () => segs.reduce((a, s) => a + (s.to - s.from), 0) + CARD;
  while (total() > BUDGET && segs.some((s) => s.optional)) {
    const k = segs.map((s) => s.optional).lastIndexOf(true);
    segs.splice(k, 1);
  }
  let t = 0;
  for (const s of segs) {
    s.at = t;
    t += s.to - s.from;
  }
  return { segs, speech: t, total: t + CARD, spec, timing };
}

// ---------------------------------------------------------------- audio
function readF32(file, from, dur, ch = 2) {
  const r = run("ffmpeg", ["-v", "error", "-ss", String(Math.max(0, from)), "-t", String(dur), "-i", file, "-f", "f32le", "-ac", String(ch), "-ar", String(SR), "pipe:1"], { encoding: "buffer" });
  return new Float32Array(r.stdout.buffer, r.stdout.byteOffset, r.stdout.length / 4);
}

function noiseBurst(dur, f0, f1, seed) {
  const n = Math.round(dur * SR);
  const r = rng(seed);
  const b = new Float32Array(n);
  for (let i = 0; i < n; i++) b[i] = r() * 2 - 1;
  svf(b, (t) => f0 + (f1 - f0) * Math.sin((Math.PI * t) / dur), 1.1, "band");
  for (let i = 0; i < n; i++) b[i] *= Math.pow(Math.sin((Math.PI * i) / n), 2);
  return b;
}

function boom(dur, seed) {
  const n = Math.round(dur * SR);
  const b = new Float32Array(n);
  let ph = 0;
  const r = rng(seed);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    ph += (40 + 26 * Math.exp(-t / 0.1)) / SR;
    b[i] = (Math.sin(2 * Math.PI * ph) + 0.3 * Math.sin(4 * Math.PI * ph)) * Math.min(1, t / 0.003) * Math.exp(-t / 0.7) + (r() - 0.5) * 0.4 * Math.exp(-t / 0.01);
  }
  return b;
}

function buildAudio(n, p, dir) {
  const narr = path.join(OUT, "audio", `episode-0${n}-narration.wav`);
  const music = path.join(OUT, "audio", `episode-0${n}-music.wav`);
  const len = Math.ceil(p.total * SR);
  const vL = new Float32Array(len);
  const vR = new Float32Array(len);
  for (const s of p.segs) {
    const buf = readF32(narr, s.from, s.to - s.from);
    const i0 = Math.round(s.at * SR);
    const frames = buf.length / 2;
    const fade = Math.round(0.012 * SR);
    for (let j = 0; j < frames && i0 + j < len; j++) {
      const g = Math.min(1, j / fade, (frames - j) / fade);
      vL[i0 + j] = buf[2 * j] * g;
      vR[i0 + j] = buf[2 * j + 1] * g;
    }
  }
  // one continuous stretch of the episode's own score under the whole Short
  const m = readF32(music, p.segs[0].from, p.total + 0.5);
  const mL = new Float32Array(len);
  const mR = new Float32Array(len);
  for (let i = 0; i < len && 2 * i + 1 < m.length; i++) {
    const t = i / SR;
    const g = Math.min(1, t / 0.4) * (1 - clamp((t - (p.total - 1.4)) / 1.4));
    mL[i] = m[2 * i] * g;
    mR[i] = m[2 * i + 1] * g;
  }
  // effects: a whoosh at each cut, a hit under the end card
  const fL = new Float32Array(len);
  const fR = new Float32Array(len);
  const put = (b, t, gain) => {
    const i0 = Math.round(t * SR);
    for (let j = 0; j < b.length && i0 + j < len; j++) {
      if (i0 + j < 0) continue;
      fL[i0 + j] += b[j] * gain;
      fR[i0 + j] += b[j] * gain;
    }
  };
  const peak = (b) => b.reduce((a, v) => Math.max(a, Math.abs(v)), 0) || 1;
  p.segs.slice(1).forEach((s, k) => {
    const w = noiseBurst(0.9, 400, 2200, 900 + k);
    put(w, s.at - 0.55, Math.pow(10, -24 / 20) / peak(w));
  });
  const b = boom(2.6, 77);
  put(b, p.speech + 0.05, Math.pow(10, -13 / 20) / peak(b));

  const files = { voice: path.join(dir, "voice.wav"), music: path.join(dir, "music.wav"), sfx: path.join(dir, "sfx.wav"), mix: path.join(dir, "mix.wav") };
  writeStereo(files.voice, vL, vR);
  writeStereo(files.music, mL, mR);
  writeStereo(files.sfx, fL, fR);
  const gain = MUSIC_LUFS - integratedLUFS(path.join(OUT, "audio", `episode-0${n}-music.wav`));
  const graph =
    `[1:a]volume=${gain.toFixed(2)}dB[m];[0:a]asplit=2[v][k];` +
    "[m][k]sidechaincompress=threshold=0.05:ratio=2.5:attack=220:release=1800:knee=6[md];" +
    // Shorts play on phones beside louder content: finish at -14 LUFS
    "[v][md][2:a]amix=inputs=3:weights=1 1 1:normalize=0,loudnorm=I=-14:TP=-1.2:LRA=9[out]";
  run("ffmpeg", ["-v", "error", "-y", "-i", files.voice, "-i", files.music, "-i", files.sfx, "-filter_complex", graph, "-map", "[out]", "-ar", "48000", "-ac", "2", files.mix]);
  return files;
}

// ---------------------------------------------------------------- words
function wordTimings(p, files, dir) {
  const script = path.join(dir, "script.txt");
  fs.writeFileSync(script, p.segs.map((s) => s.text).join(" "));
  const out = path.join(dir, "words.json");
  const whisper = path.join(ROOT, ".venv/models/whisper-small.en/model.bin");
  if (fs.existsSync(whisper) && fs.statSync(whisper).size > 1e8 && !fs.existsSync(`${whisper}.aria2`)) {
    run(path.join(ROOT, ".venv/bin/python"), [path.join(ROOT, "src/words.py"), files.voice, script, out], { cwd: ROOT, stdio: "pipe" });
    return { words: JSON.parse(fs.readFileSync(out, "utf8")).words, source: "whisper" };
  }
  // Fallback: spread each sentence's words across its known span, weighted by length.
  const words = [];
  for (const seg of p.segs) {
    for (const s of seg.sentences) {
      const ws = s.text.split(/\s+/).filter(Boolean);
      const weight = ws.map((w) => 0.35 + w.replace(/[^a-z0-9]/gi, "").length);
      const sum = weight.reduce((a, b) => a + b, 0);
      let t = seg.at + (s.start - seg.from);
      const span = s.end - s.start;
      ws.forEach((w, i) => {
        const d = (span * weight[i]) / sum;
        words.push({ w, start: t, end: t + d });
        t += d;
      });
    }
  }
  return { words, source: "estimated" };
}

// Groups of up to three words (shorter if long), broken at punctuation.
function captionGroups(words) {
  const groups = [];
  let cur = [];
  const flush = () => {
    if (cur.length) groups.push(cur);
    cur = [];
  };
  for (const w of words) {
    cur.push(w);
    const chars = cur.map((x) => x.w).join(" ").length;
    if (/[.,;:?!—]$/.test(w.w) || cur.length >= 3 || chars >= 15) flush();
  }
  flush();
  return groups.map((g, i) => ({ words: g, start: g[0].start - 0.04, end: (groups[i + 1]?.[0].start ?? g[g.length - 1].end + 0.35) - 0.04 }));
}

// ---------------------------------------------------------------- picture
async function buildVideo(n, p, files, words, outFile) {
  const ep = (await import(`./episodes/ep${n}.mjs`)).default;
  const groups = captionGroups(words);
  const film = path.join(OUT, "video", `episode-0${n}.mp4`);
  const main = canvas(SW, SH);
  const ctx = main.getContext("2d");
  const frameC = canvas(PANEL.w, PANEL.h);
  const fctx = frameC.getContext("2d");
  const small = canvas(270, 480);
  const sctx = small.getContext("2d");
  const img = fctx.createImageData(PANEL.w, PANEL.h);

  const enc = spawn("ffmpeg", [
    "-hide_banner", "-loglevel", "error", "-y",
    "-f", "rawvideo", "-pix_fmt", "rgba", "-s", `${SW}x${SH}`, "-r", String(FPS), "-i", "-",
    "-i", files.mix, "-map", "0:v", "-map", "1:a",
    "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", "-x264-params", "aq-mode=3",
    "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", "-shortest", outFile,
  ], { stdio: ["pipe", "inherit", "inherit"] });
  const done = new Promise((res, rej) => enc.on("close", (c) => (c === 0 ? res() : rej(new Error(`encoder exit ${c}`)))));

  const frameBytes = PANEL.w * PANEL.h * 4;
  let frame = 0;
  const totalFrames = Math.round(p.total * FPS);
  const emit = async (T) => {
    draw(ctx, T);
    if (!enc.stdin.write(Buffer.from(main.data()))) await new Promise((r) => enc.stdin.once("drain", r));
    frame++;
  };

  function draw(c, T) {
    // background: the same picture, blurred, dark, filling the frame
    sctx.filter = "blur(7px) brightness(0.42) saturate(1.15)";
    sctx.drawImage(frameC, (PANEL.w - PANEL.h * (270 / 480)) / 2, 0, PANEL.h * (270 / 480), PANEL.h, -20, -20, 310, 520);
    sctx.filter = "none";
    c.drawImage(small, 0, 0, SW, SH);
    const vg = c.createLinearGradient(0, 0, 0, SH);
    vg.addColorStop(0, "rgba(7,9,12,0.86)");
    vg.addColorStop(0.28, "rgba(7,9,12,0.35)");
    vg.addColorStop(0.68, "rgba(7,9,12,0.45)");
    vg.addColorStop(1, "rgba(7,9,12,0.92)");
    c.fillStyle = vg;
    c.fillRect(0, 0, SW, SH);

    // header + headline
    const hIn = prog(T, 0, 0.45, ease.out);
    glyph(c, 92, 228, 13, C.cyan, hIn);
    text(c, "PREDICTIVE ATLAS", 118, 237, { size: 26, weight: 600, tracking: 6, alpha: hIn });
    text(c, `EPISODE ${n} · ${ep.title}`, 92, 284, { kind: "mono", size: 20, tracking: 3, color: C.mid, caps: true, alpha: hIn });
    p.spec.headline.forEach((line, i) => {
      const a = prog(T, 0.08 + i * 0.1, 0.4, ease.out);
      text(c, line, 90 - (1 - a) * 30, 392 + i * 96, { size: 86, weight: 600, tracking: 1.5, alpha: a, maxWidth: SW - 170 });
    });
    c.fillStyle = rgba(C.cyan, 0.9);
    c.fillRect(92, 560, 140 * hIn, 4);

    // the film, full width
    c.save();
    c.shadowColor = "rgba(0,0,0,0.6)";
    c.shadowBlur = 40;
    c.fillStyle = "#000";
    c.fillRect(PANEL.x, PANEL.y, PANEL.w, PANEL.h);
    c.restore();
    c.drawImage(frameC, PANEL.x, PANEL.y);
    c.fillStyle = rgba(C.cyan, 0.75);
    c.fillRect(PANEL.x, PANEL.y - 2, PANEL.w, 2);
    // progress through the Short
    c.fillStyle = rgba(C.mid, 0.18);
    c.fillRect(0, PANEL.y + PANEL.h, SW, 5);
    c.fillStyle = C.cyan;
    c.fillRect(0, PANEL.y + PANEL.h, SW * clamp(T / p.total), 5);

    // captions: the current group, the spoken word lit
    const g = groups.find((x) => T >= x.start && T < x.end);
    if (g && T < p.speech) {
      const pop = 1 + 0.07 * (1 - prog(T, g.start, 0.14, ease.out));
      const size = 82;
      const parts = g.words.map((w) => w.w.toUpperCase());
      const widths = parts.map((s) => measure(c, s, { size, weight: 700, tracking: 1 }));
      const gap = 26;
      const total = widths.reduce((a, b) => a + b, 0) + gap * (parts.length - 1);
      const y = 1400;
      c.save();
      c.translate(SW / 2, y);
      c.scale(pop, pop);
      let x = -total / 2;
      parts.forEach((s, i) => {
        const w = g.words[i];
        const live = T >= w.start - 0.03 && T < (g.words[i + 1]?.start ?? g.end);
        c.save();
        c.font = `700 ${size}px 'Plex Cond'`;
        c.letterSpacing = "1px";
        c.lineJoin = "round";
        c.lineWidth = 12;
        c.strokeStyle = "rgba(5,7,10,0.9)";
        c.strokeText(s, x, 0);
        c.restore();
        text(c, s, x, 0, { size, weight: 700, tracking: 1, color: live ? C.amber : C.ice, glow: live ? 14 : 0 });
        x += widths[i] + gap;
      });
      c.restore();
    }

    // end card
    const card = prog(T, p.speech, 0.45, ease.out);
    if (card > 0) {
      c.fillStyle = `rgba(5,7,10,${(0.82 * card).toFixed(3)})`;
      c.fillRect(0, 0, SW, SH);
      glyph(c, SW / 2, 800, 30, C.cyan, card);
      text(c, "FULL BREAKDOWN", SW / 2, 930, { size: 64, weight: 600, tracking: 10, align: "center", alpha: card });
      text(c, `EPISODE ${n} · ${ep.title}`, SW / 2, 1000, { kind: "mono", size: 24, tracking: 3, align: "center", color: C.mid, caps: true, alpha: card, maxWidth: SW - 160 });
      c.fillStyle = rgba(C.cyan, 0.9 * card);
      c.fillRect(SW / 2 - 120, 1046, 240, 3);
      text(c, "PREDICTIVE ATLAS", SW / 2, 1120, { size: 34, weight: 600, tracking: 8, align: "center", color: C.cyan, alpha: prog(T, p.speech + 0.3, 0.5, ease.out) });
    }
    // brief flash on each cut between segments
    for (const s of p.segs.slice(1)) {
      const u = (T - s.at + 0.06) / 0.3;
      if (u > 0 && u < 1) {
        c.fillStyle = `rgba(200,240,255,${(0.16 * Math.sin(Math.PI * u)).toFixed(3)})`;
        c.fillRect(PANEL.x, PANEL.y, PANEL.w, PANEL.h);
      }
    }
  }

  // decode each segment of the film and lay it into the vertical frame
  let held = null;
  for (const s of p.segs) {
    const dur = s.to - s.from;
    const dec = spawn("ffmpeg", ["-v", "error", "-ss", String(s.from), "-t", String(dur), "-i", film, "-vf", `scale=${PANEL.w}:${PANEL.h},fps=${FPS}`, "-f", "rawvideo", "-pix_fmt", "rgba", "pipe:1"], { stdio: ["ignore", "pipe", "inherit"] });
    let pending = Buffer.alloc(0);
    const want = Math.round(dur * FPS);
    let got = 0;
    for await (const chunk of dec.stdout) {
      pending = pending.length ? Buffer.concat([pending, chunk]) : chunk;
      while (pending.length >= frameBytes && got < want) {
        img.data.set(pending.subarray(0, frameBytes));
        pending = pending.subarray(frameBytes);
        fctx.putImageData(img, 0, 0);
        await emit(frame / FPS);
        got++;
      }
    }
    held = true;
    while (got < want) {
      await emit(frame / FPS); // decoder came up short: hold the last frame
      got++;
    }
  }
  void held;
  while (frame < totalFrames) await emit(frame / FPS); // end card over the last frame
  enc.stdin.end();
  await done;
}

// ---------------------------------------------------------------- upload text
// "U.S. TREASURY" -> "U.S. Treasury", "AN LNG TERMINAL" -> "An LNG Terminal"
function titleCase(label) {
  return label
    .split(" ")
    .map((w, i) => {
      if (/\./.test(w) || (/^[A-Z]{2,5}$/.test(w) && !/[AEIOU]/.test(w)) || w === "·") return w;
      const lower = w.toLowerCase();
      if (i > 0 && ["a", "an", "the", "of", "and"].includes(lower)) return lower;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");
}
async function uploadText(n, p, file) {
  const ep = (await import(`./episodes/ep${n}.mjs`)).default;
  const credits = photoShots(n, p.timing)
    .filter((shot) => p.segs.some((s) => shot.start < s.to && shot.start + PHOTO_DURATION > s.from))
    .map((shot) => `${titleCase(shot.label)}: ${shot.credit}`);
  const lead = p.segs[0].sentences.slice(0, 2).map((s) => s.text).join(" ");
  const lines = [
    `TITLE: ${p.spec.title} #Shorts`,
    "",
    "DESCRIPTION:",
    lead,
    "",
    `Full breakdown: Episode ${n}, "${ep.title}", on Predictive Atlas.`,
    ...(credits.length ? ["", "Photo credits:", ...credits.map((c) => `- ${c}`)] : []),
    "",
    ["#Shorts", ...p.spec.tags.map((t) => `#${t.replace(/\s+/g, "")}`)].join(" "),
  ];
  fs.writeFileSync(file, `${lines.join("\n")}\n`);
}

// ---------------------------------------------------------------- main
const eps = process.argv.slice(2).filter((a) => /^[1-5]$/.test(a)).map(Number);
fs.mkdirSync(path.join(OUT, "shorts"), { recursive: true });
for (const n of eps.length ? eps : [1, 2, 3, 4, 5]) {
  const t0 = Date.now();
  const p = plan(n);
  const dir = path.join(OUT, "shorts", `work-0${n}`);
  fs.mkdirSync(dir, { recursive: true });
  const files = buildAudio(n, p, dir);
  const { words, source } = wordTimings(p, files, dir);
  const outFile = path.join(OUT, "shorts", `short-0${n}.mp4`);
  await buildVideo(n, p, files, words, outFile);
  await uploadText(n, p, outFile.replace(/\.mp4$/, ".txt"));
  console.log(`short ${n}: ${p.total.toFixed(1)}s, ${p.segs.length} segment(s), ${words.length} words (${source} timing) -> ${outFile} (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
}
