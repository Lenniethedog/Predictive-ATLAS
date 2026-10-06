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
import { C, W, H, canvas, makeBeats, smooth, clamp, rng } from "./engine/core.mjs";
import { titleCard, overlay, finish, lensEvents, badges } from "./engine/chrome.mjs";
import { setFrame } from "./engine/draw.mjs";
import * as SFX from "./engine/sfx-rec.mjs";

const args = process.argv.slice(2);
const opt = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const n = Number(args.find((a) => /^[1-5]$/.test(a)));
if (!n) throw new Error("usage: node src/render.mjs <episode 1-5> [--sheet] [--scene i] [--stills t,..] [--from s --to s]");

const timing = JSON.parse(fs.readFileSync(path.join(OUT, "timing", `episode-0${n}.json`), "utf8"));
const ep = (await import(`./episodes/ep${n}.mjs`)).default;
ep.n = n;

const XF = 1.0; // crossfade between scenes, centered on the paragraph gap
const PUSH = 0.028; // slow camera push-in across each scene
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
const glow = canvas(W / 4, H / 4);
const gctx = glow.getContext("2d");

// Bloom: bright parts of the frame, blurred at quarter resolution, added back softly.
function bloom(c, amount = 0.3) {
  gctx.globalCompositeOperation = "copy";
  gctx.filter = "brightness(1.1) contrast(3.4) blur(5px)";
  gctx.drawImage(main, 0, 0, W / 4, H / 4);
  gctx.filter = "none";
  c.save();
  c.globalCompositeOperation = "lighter";
  c.globalAlpha = amount;
  c.drawImage(glow, 0, 0, W, H);
  c.restore();
}

// Drifting dust: a few dozen faint motes, slow, with depth (size/speed/alpha linked).
const MOTES = (() => {
  const r = rng(424242);
  return Array.from({ length: 70 }, () => {
    const z = 0.3 + r() * 0.7;
    return { x: r() * W, y: r() * H, z, vx: (r() - 0.5) * 6 * z, vy: -(2 + r() * 6) * z, ph: r() * 10 };
  });
})();
function motes(c, T) {
  c.save();
  c.globalCompositeOperation = "lighter";
  for (const m of MOTES) {
    const x = (((m.x + m.vx * T + 8 * Math.sin(T * 0.2 + m.ph)) % W) + W) % W;
    const y = (((m.y + m.vy * T) % H) + H) % H;
    const a = 0.05 + 0.07 * m.z * (0.6 + 0.4 * Math.sin(T * 0.7 + m.ph));
    c.fillStyle = `rgba(190,225,245,${a.toFixed(3)})`;
    c.beginPath();
    c.arc(x, y, 0.6 + 1.3 * m.z, 0, Math.PI * 2);
    c.fill();
  }
  c.restore();
}

function drawScene(c, i, T) {
  const t = T - starts[i];
  const dur = ends[i] - starts[i];
  // gentle push-in over the scene, plus a small settle as it fades up
  const k = 1 + PUSH * smooth(clamp(t / dur)) + 0.012 * (1 - smooth(clamp((t + XF / 2) / (XF * 1.5))));
  // organic drift: a few pixels of slow, non-repeating float, as if the camera breathes
  const dx = 2.6 * Math.sin(T * 0.21) + 1.3 * Math.sin(T * 0.53 + 1.7);
  const dy = 1.9 * Math.sin(T * 0.17 + 2.1) + 1.0 * Math.sin(T * 0.47 + 0.4);
  c.save();
  c.fillStyle = C.bg;
  c.fillRect(0, 0, W, H);
  if (!scenes[i].still) {
    c.translate(W / 2 + dx, H / 2 + dy);
    c.scale(k, k);
    c.translate(-W / 2, -H / 2);
  }
  scenes[i](c, t);
  c.restore();
}

function sceneAt(T) {
  for (let i = scenes.length - 1; i >= 0; i--) if (T >= starts[i]) return i;
  return 0;
}

export function renderFrame(T, frame) {
  setFrame(frame);
  ctx.save();
  if (T < timing.titleCard) {
    titleCard(ctx, T, ep);
    motes(ctx, T);
    bloom(ctx, 0.32);
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
  // a faint band of light crosses the frame with each scene change, panned like the whoosh
  for (let k = 1; k < starts.length; k++) {
    const u = (T - starts[k] + 0.6) / 1.2;
    if (u <= 0 || u >= 1) continue;
    const x = -300 + (W + 600) * smooth(u);
    const g = ctx.createLinearGradient(x - 220, 0, x + 220, 0);
    const a = 0.06 * Math.sin(Math.PI * u);
    g.addColorStop(0, "rgba(180,235,255,0)");
    g.addColorStop(0.5, `rgba(180,235,255,${a.toFixed(3)})`);
    g.addColorStop(1, "rgba(180,235,255,0)");
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = g;
    ctx.fillRect(x - 220, 0, 440, H);
    ctx.restore();
  }
  motes(ctx, T);
  bloom(ctx, 0.24);
  overlay(ctx, { ep, sceneIndex: i, sceneCount: scenes.length, T, total: END, title: ep.titles?.[i], since: T - starts[i] });
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
  const mixed = path.join(OUT, "audio", `episode-0${n}-mix.wav`);
  const audio = fs.existsSync(mixed) ? mixed : path.join(OUT, "audio", `episode-0${n}-narration.wav`);
  const enc = spawn(
    "ffmpeg",
    [
      "-hide_banner", "-loglevel", "error", "-y",
      "-f", "rawvideo", "-pix_fmt", "rgba", "-s", `${W}x${H}`, "-r", String(fps), "-i", "-",
      "-ss", String(from), "-t", String(to - from), "-i", audio,
      "-map", "0:v", "-map", "1:a",
      "-c:v", "libx264", "-preset", opt("--preset", "medium"), "-crf", opt("--crf", "17"), "-pix_fmt", "yuv420p",
      "-x264-params", "aq-mode=3:aq-strength=1.1:deblock=-1,-1",
      "-c:a", "aac", "-b:a", "256k", "-ar", "48000",
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

// Coverage audit: share of the frame carrying visible content at points in each scene.
function audit() {
  const probe = [1.5, 4, 8];
  console.log(`ep${n} scene  ${probe.map((p) => `t=${p}s`.padStart(7)).join(" ")}   mid`);
  scenes.forEach((sc, i) => {
    const row = [...probe.map((p) => starts[i] + p), (starts[i] + ends[i]) / 2].map((T) => {
      drawScene(ctx, i, T);
      const d = ctx.getImageData(0, 0, W, H).data;
      let on = 0;
      for (let k = 0; k < d.length; k += 16) if (d[k] + d[k + 1] + d[k + 2] > 3 * 34) on++;
      return (100 * on) / (d.length / 16);
    });
    const flag = row[1] < 3 ? "  ← sparse opening" : "";
    console.log(`  ${String(i + 1).padStart(2)}      ${row.map((v) => v.toFixed(1).padStart(6) + "%").join(" ")}${flag}`);
  });
}

// One frame per scene at a fixed offset, tiled: quick check of how each scene opens.
async function grid(at) {
  const cols = 4;
  const tw = W / cols;
  const th = H / cols;
  const rows = Math.ceil(scenes.length / cols);
  const g = canvas(W, rows * th);
  const gc = g.getContext("2d");
  gc.fillStyle = "#000";
  gc.fillRect(0, 0, W, rows * th);
  for (let i = 0; i < scenes.length; i++) {
    renderFrame(starts[i] + at, i);
    gc.drawImage(main, (i % cols) * tw, Math.floor(i / cols) * th, tw - 4, th - 4);
    gc.fillStyle = "#ff0";
    gc.font = "22px 'Plex Mono'";
    gc.fillText(String(i + 1), (i % cols) * tw + 10, Math.floor(i / cols) * th + 26);
  }
  const file = path.join(OUT, "sheets", `ep${n}`, `grid-${at}s.png`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, await g.encode("png"));
  console.log(file);
}

// Walk every scene with the recorder on and write the sound-effects cue list.
function collectEvents() {
  SFX.reset();
  SFX.rec.on = true;
  const step = 1 / 10;
  for (let i = 0; i < scenes.length; i++) {
    SFX.rec.scene = i;
    for (let t = 0; t < ends[i] - starts[i]; t += step) {
      SFX.rec.t = t;
      setFrame(-100);
      drawScene(actx, i, starts[i] + t);
    }
  }
  SFX.rec.on = false;
  const out = [];
  for (const e of SFX.rec.events) {
    // anything visible from a scene's first moments rides on the transition whoosh
    if (["blip", "panel"].includes(e.kind) && e.t < 0.45) continue;
    out.push({ kind: e.kind, t: +(starts[e.scene] + e.t).toFixed(3), dur: e.dur, pan: e.x !== undefined ? +((e.x / W) * 2 - 1).toFixed(2) : 0, scene: e.scene, key: e.key });
  }
  starts.forEach((s, i) => i > 0 && out.push({ kind: "whoosh", t: +s.toFixed(3), scene: i }));
  events.forEach((e) => out.push({ kind: "swipe", t: +e.t.toFixed(3), pan: 0.7 }));
  out.push({ kind: "ident", t: 0.05 });
  out.push({ kind: "end", t: +END.toFixed(3) });
  out.sort((a, b) => a.t - b.t);
  const file = path.join(OUT, "sfx", `episode-0${n}.json`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify({ end: END, total: TOTAL, starts, events: out }, null, 1));
  const counts = {};
  out.forEach((e) => (counts[e.kind] = (counts[e.kind] ?? 0) + 1));
  console.log(file, JSON.stringify(counts));
}

if (args.includes("--events")) collectEvents();
else if (args.includes("--grid")) await grid(Number(opt("--grid", 2.5)));
else if (args.includes("--audit")) audit();
else if (args.includes("--sheet")) await sheet();
else if (args.includes("--stills")) await stills(opt("--stills").split(",").map(Number));
else await video(Number(opt("--from", 0)), Number(opt("--to", TOTAL)));
