// Renders an episode: narration timing + scene modules -> 1080p MP4.
//
//   node src/render.mjs 1                    full episode -> out/video/episode-01.mp4
//   node src/render.mjs 1 --sheet            contact sheets (4 frames per scene) -> out/sheets/
//   node src/render.mjs 1 --sheet --scene 3  one scene only
//   node src/render.mjs 1 --stills 12.5,40   PNG frames at absolute times
//   node src/render.mjs 1 --from 60 --to 90  render a time range (preview mp4)
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { OUT, VIDEO, TIMELINE } from "./config.mjs";
import { C, W, H, canvas, makeBeats, smooth, clamp } from "./engine/core.mjs";
import { titleCard, overlay, finish, lensEvents, badges } from "./engine/chrome.mjs";

const args = process.argv.slice(2);
const opt = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const n = Number(args.find((a) => /^[1-5]$/.test(a)));
if (!n) throw new Error("usage: node src/render.mjs <episode 1-5> [--sheet] [--scene i] [--stills t,..] [--from s --to s]");

const timing = JSON.parse(fs.readFileSync(path.join(OUT, "timing", `episode-0${n}.json`), "utf8"));
const ep = (await import(`./episodes/ep${n}.mjs`)).default;
ep.n = n;

const XF = 0.7; // crossfade between scenes, centered on the paragraph gap
const HOLD = TIMELINE.tail - 1.0; // final hold before cut to black

// ---------------------------------------------------------------- scene clock
const paras = timing.paragraphs;
if (paras.length !== ep.scenes.length) throw new Error(`ep${n}: ${paras.length} paragraphs vs ${ep.scenes.length} scenes`);
const starts = paras.map((p, i) => (i === 0 ? p.start : (paras[i - 1].end + p.start) / 2));
const ends = paras.map((p, i) => (i < paras.length - 1 ? starts[i + 1] : p.end + HOLD));
const END = ends[ends.length - 1];
const TOTAL = timing.total;

const scenes = ep.scenes.map((factory, i) => {
  const S = makeBeats(paras[i], starts[i], ends[i]);
  S.index = i;
  const draw = factory(S);
  draw.S = S;
  return draw;
});
const events = lensEvents(timing, scenes);

// ---------------------------------------------------------------- frame
const main = canvas();
const ctx = main.getContext("2d");
const aux = canvas();
const actx = aux.getContext("2d");

function drawScene(c, i, T) {
  const t = T - starts[i];
  c.save();
  c.fillStyle = C.bg;
  c.fillRect(0, 0, W, H);
  scenes[i](c, t);
  c.restore();
}

function sceneAt(T) {
  for (let i = scenes.length - 1; i >= 0; i--) if (T >= starts[i]) return i;
  return 0;
}

export function renderFrame(T, frame) {
  ctx.save();
  if (T < timing.titleCard) {
    titleCard(ctx, T, ep);
    finish(ctx, frame);
    ctx.restore();
    return;
  }
  if (T >= END) {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
    return;
  }
  const i = sceneAt(T);
  drawScene(ctx, i, T);
  // crossfade with the neighbouring scene inside the gap window
  const intoNext = i < scenes.length - 1 ? starts[i + 1] - T : Infinity;
  const fromPrev = i > 0 ? T - starts[i] : Infinity;
  if (fromPrev < XF / 2 && !scenes[i].cut) {
    drawScene(actx, i - 1, T);
    ctx.globalAlpha = 1 - smooth(clamp(0.5 + fromPrev / XF));
    ctx.drawImage(aux, 0, 0);
    ctx.globalAlpha = 1;
  } else if (intoNext < XF / 2 && !scenes[i + 1].cut) {
    drawScene(actx, i + 1, T);
    ctx.globalAlpha = smooth(clamp(0.5 - intoNext / XF));
    ctx.drawImage(aux, 0, 0);
    ctx.globalAlpha = 1;
  }
  overlay(ctx, { ep, sceneIndex: i, sceneCount: scenes.length, T, total: END });
  badges(ctx, T, events);
  finish(ctx, frame);
  ctx.restore();
}

// ---------------------------------------------------------------- modes
const fps = Number(opt("--fps", VIDEO.fps));

async function png(file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, await main.encode("png"));
}

async function sheet() {
  const only = opt("--scene");
  const fr = (opt("--fr", "0.12,0.38,0.64,0.94")).split(",").map(Number);
  const sheetC = canvas(W, H);
  const s = sheetC.getContext("2d");
  const list = only !== undefined ? only.split(",").map(Number) : scenes.map((_, i) => i);
  for (const i of list) {
    s.fillStyle = "#000";
    s.fillRect(0, 0, W, H);
    fr.forEach((f, k) => {
      const T = starts[i] + f * (ends[i] - starts[i]);
      renderFrame(T, k);
      s.drawImage(main, (k % 2) * (W / 2), Math.floor(k / 2) * (H / 2), W / 2, H / 2);
      s.fillStyle = "#ff0";
      s.font = "20px 'Plex Mono'";
      s.fillText(`t=${(T - starts[i]).toFixed(1)}/${(ends[i] - starts[i]).toFixed(1)}`, (k % 2) * (W / 2) + 12, Math.floor(k / 2) * (H / 2) + 26);
    });
    const file = path.join(OUT, "sheets", `ep${n}`, `scene-${String(i + 1).padStart(2, "0")}.png`);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, await sheetC.encode("png"));
    console.log(file);
  }
}

async function stills(list) {
  for (const T of list) {
    renderFrame(T, 0);
    const file = path.join(OUT, "stills", `ep${n}-${T.toFixed(2)}.png`);
    await png(file);
    console.log(file);
  }
}

async function video(from = 0, to = TOTAL) {
  const preview = from > 0 || to < TOTAL;
  const dir = path.join(OUT, preview ? "previews" : "video");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, preview ? `episode-0${n}-${from}-${to}.mp4` : `episode-0${n}.mp4`);
  const audio = path.join(OUT, "audio", `episode-0${n}-narration.wav`);
  const enc = spawn(
    "ffmpeg",
    [
      "-hide_banner", "-loglevel", "error", "-y",
      "-f", "rawvideo", "-pix_fmt", "rgba", "-s", `${W}x${H}`, "-r", String(fps), "-i", "-",
      "-ss", String(from), "-t", String(to - from), "-i", audio,
      "-map", "0:v", "-map", "1:a",
      "-c:v", "libx264", "-preset", opt("--preset", "medium"), "-crf", opt("--crf", "18"), "-pix_fmt", "yuv420p",
      "-c:a", "aac", "-b:a", "192k", "-ar", "48000",
      "-movflags", "+faststart", "-shortest", file,
    ],
    { stdio: ["pipe", "inherit", "inherit"] },
  );
  const done = new Promise((res, rej) => enc.on("close", (c) => (c === 0 ? res() : rej(new Error(`ffmpeg exit ${c}`)))));
  const frames = Math.round((to - from) * fps);
  const t0 = Date.now();
  for (let f = 0; f < frames; f++) {
    const T = from + f / fps;
    renderFrame(T, f);
    const buf = Buffer.from(main.data());
    if (!enc.stdin.write(buf)) await new Promise((r) => enc.stdin.once("drain", r));
    if (f % (fps * 30) === 0) {
      const el = (Date.now() - t0) / 1000;
      process.stdout.write(`ep${n} ${(T / 60).toFixed(1)}/${(to / 60).toFixed(1)} min  ${(f / Math.max(el, 0.001)).toFixed(0)} fps\n`);
    }
  }
  enc.stdin.end();
  await done;
  console.log(`${file}  (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
}

if (args.includes("--sheet")) await sheet();
else if (args.includes("--stills")) await stills(opt("--stills").split(",").map(Number));
else await video(Number(opt("--from", 0)), Number(opt("--to", TOTAL)));
