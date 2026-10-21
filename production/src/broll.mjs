// Cut a few seconds of a real photograph into a finished episode, on the line
// where that photograph is the thing being said.
// Public domain or CC BY only. The credit is burned into the frame.
//
//   node src/broll.mjs 1 2 3
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { loadImage } from "@napi-rs/canvas";
import { OUT, ROOT } from "./config.mjs";
import { H, W, canvas, rgba } from "./engine/core.mjs";
import { text } from "./engine/draw.mjs";
import { INSERTS } from "./engine/photos.mjs";
import { writeVideoChapters, normalizeVideoClock } from "./video-metadata.mjs";

const DUR = 3.2;
const FADE = 0.35;
const DIR = path.join(ROOT, "assets", "broll");

// Only where a real photograph is the object in the sentence, not a stand-in for a different place.

function atPhrase(timing, phrase) {
  const needle = phrase.toLowerCase();
  for (const para of timing.paragraphs) {
    for (const sentence of para.sentences) {
      const i = sentence.text.toLowerCase().indexOf(needle);
      if (i < 0) continue;
      const frac = i / Math.max(1, sentence.text.length);
      return sentence.start + frac * (sentence.end - sentence.start);
    }
  }
  return null;
}

function ready(file) {
  const r = spawnSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file], { encoding: "utf8" });
  const dur = Number(String(r.stdout).trim());
  return r.status === 0 && dur > 60 ? dur : 0;
}

async function plate(insert) {
  const img = await loadImage(insert.file);
  const c = canvas(W, H);
  const ctx = c.getContext("2d");
  const scale = Math.max(W / img.width, H / img.height);
  const dw = img.width * scale;
  const dh = img.height * scale;
  ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
  ctx.fillStyle = "rgba(6,8,12,0.22)";
  ctx.fillRect(0, 0, W, H);
  const bar = ctx.createLinearGradient(0, H - 220, 0, H);
  bar.addColorStop(0, "rgba(6,8,12,0)");
  bar.addColorStop(1, "rgba(6,8,12,0.82)");
  ctx.fillStyle = bar;
  ctx.fillRect(0, H - 220, W, 220);
  text(ctx, insert.label, 72, H - 108, { size: 32, weight: 600, tracking: 3, color: "#e7eef5" });
  text(ctx, insert.credit, 72, H - 68, { kind: "mono", size: 16, tracking: 1.2, color: rgba("#e7eef5", 0.7) });
  const out = insert.file.replace(/\.[^.]+$/, ".plate.png");
  fs.writeFileSync(out, await c.encode("png"));
  return out;
}

async function cut(n) {
  const video = path.join(OUT, "video", `episode-0${n}.mp4`);
  const timingPath = path.join(OUT, "timing", `episode-0${n}.json`);
  const dur = ready(video);
  if (!dur) {
    console.error(`ep${n}: video is not a finished file yet`);
    return false;
  }
  const timing = JSON.parse(fs.readFileSync(timingPath, "utf8"));
  const shots = [];
  for (const insert of INSERTS[n] ?? []) {
    const t = atPhrase(timing, insert.phrase);
    const file = path.join(DIR, insert.file);
    if (t == null) {
      console.error(`ep${n}: no spoken line matching ${JSON.stringify(insert.phrase)}`);
      return false;
    }
    if (!fs.existsSync(file)) {
      console.error(`ep${n}: missing ${file}`);
      return false;
    }
    if (t < 1 || t + DUR > dur - 1) {
      console.error(`ep${n}: ${insert.label} at ${t.toFixed(1)}s falls outside the film`);
      return false;
    }
    shots.push({ ...insert, t, file });
  }
  shots.sort((a, b) => a.t - b.t);
  for (let i = 1; i < shots.length; i++) {
    if (shots[i].t < shots[i - 1].t + DUR + 0.4) {
      console.error(`ep${n}: ${shots[i].label} overlaps ${shots[i - 1].label}`);
      return false;
    }
  }
  for (const shot of shots) shot.plate = await plate(shot);

  const out = path.join(OUT, "video", `episode-0${n}.broll.mp4`);
  const picture = normalizeVideoClock(video, `${out}.clock.mp4`);
  const args = ["-hide_banner", "-loglevel", "error", "-y", "-i", picture];
  shots.forEach((s) => args.push("-loop", "1", "-framerate", "30", "-t", String(DUR), "-i", s.plate));
  const chapters = writeVideoChapters(video, `${out}.chapters.txt`);
  args.push("-f", "ffmetadata", "-i", chapters);
  let chain = "";
  let last = "0:v";
  shots.forEach((s, i) => {
    const fadeOut = (DUR - FADE).toFixed(3);
    chain +=
      `[${i + 1}:v]format=yuva420p,fade=t=in:st=0:d=${FADE}:alpha=1,fade=t=out:st=${fadeOut}:d=${FADE}:alpha=1,` +
      `setpts=PTS+${s.t.toFixed(3)}/TB[b${i}];` +
      `[${last}][b${i}]overlay=0:0:eof_action=pass:enable='between(t,${s.t.toFixed(3)},${(s.t + DUR).toFixed(3)})'[v${i}];`;
    last = `v${i}`;
  });
  args.push(
    "-filter_complex", chain.slice(0, -1),
    "-map", `[${last}]`,
    "-map", "0:a",
    "-map", "0:s?", "-map_metadata", "0", "-map_chapters", String(shots.length + 1), "-c:s", "copy",
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-pix_fmt", "yuv420p", "-threads", "2",
    "-c:a", "copy",
    "-movflags", "+faststart",
    out,
  );
  console.log(`ep${n}: cutting in ${shots.map((s) => `${s.label} @ ${s.t.toFixed(1)}s`).join(", ")}`);
  const started = Date.now();
  const r = spawnSync("ffmpeg", args, { stdio: "inherit" });
  if (r.status !== 0) {
    console.error(`ep${n}: ffmpeg failed`);
    return false;
  }
  const outDur = ready(out);
  if (Math.abs(outDur - dur) > 2) {
    console.error(`ep${n}: output duration ${outDur} does not match ${dur}`);
    return false;
  }
  fs.renameSync(out, video);
  fs.unlinkSync(chapters);
  fs.unlinkSync(picture);
  console.log(`ep${n}: photographs cut in (${((Date.now() - started) / 1000).toFixed(0)}s)`);
  return true;
}

const nums = process.argv.slice(2).map(Number).filter((n) => INSERTS[n]);
if (!nums.length) {
  console.error("usage: node src/broll.mjs 1 2 3 4 5");
  process.exit(1);
}
let failed = false;
for (const n of nums) if (!(await cut(n))) failed = true;
if (failed) process.exit(1);
