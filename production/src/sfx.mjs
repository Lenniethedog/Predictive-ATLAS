// Sound design, synthesized from the animation's own cue list.
//
// `node src/render.mjs N --events` records what each scene puts on screen (stamps,
// captions typing, tags and panels appearing, lines drawing on, scene changes, lens
// badges). This turns that list into a stereo effects track: soft whooshes on scene
// changes, a low thud under stamps, quiet tuned blips for tags, faint typing ticks,
// a shimmer as lines draw, an ident on the title card and a hit on the cut to black.
// Everything is kept low: it should be felt more than noticed.
//
//   node src/sfx.mjs            all episodes (needs out/sfx/episode-0N.json)
//   node src/sfx.mjs 3
//
// Writes out/audio/episode-0N-sfx.wav.
import fs from "node:fs";
import path from "node:path";
import { OUT } from "./config.mjs";
import { SR, TAU, midiHz, rng, svf, freeverb, writeStereo, place } from "./engine/audio.mjs";
import { scenesOf } from "./story.mjs";

const TONIC = { 1: 38, 2: 36, 3: 40, 4: 41, 5: 39 }; // matches the score's keys
const db = (x) => Math.pow(10, x / 20);
// Scale degrees and panel pitches, so a shock scene does not blip like an establishing one.
const BLIP = {
  establish: [0, 7, 12],
  history: [3, 7, 10],
  system: [3, 10, 14],
  pressure: [0, 5, 10],
  shock: [1, 6, 11],
  motion: [0, 7, 14],
  cold: [0, 7],
  fracture: [0, 6, 10],
  close: [0, 7, 19],
};
const PANEL_F = { establish: 210, history: 196, system: 220, pressure: 168, shock: 124, motion: 262, cold: 180, fracture: 146, close: 150 };

// ---------------------------------------------------------------- voices
function noise(n, r) {
  const b = new Float32Array(n);
  for (let i = 0; i < n; i++) b[i] = r() * 2 - 1;
  return b;
}

// Air moved past the mic: band-passed noise whose centre rises then falls.
function whoosh(dur, f0, f1, f2, r, peakAt = 0.62) {
  const n = Math.round(dur * SR);
  const b = noise(n, r);
  svf(b, (t) => {
    const u = t / dur;
    return u < peakAt ? f0 + (f1 - f0) * Math.pow(u / peakAt, 1.5) : f1 + (f2 - f1) * ((u - peakAt) / (1 - peakAt));
  }, 1.1, "band");
  for (let i = 0; i < n; i++) {
    const u = i / n;
    const env = u < peakAt ? Math.pow(u / peakAt, 2.2) : Math.pow(1 - (u - peakAt) / (1 - peakAt), 1.6);
    b[i] *= env;
  }
  return b;
}

function tone(dur, f, decay, partials = [[1, 1]], attack = 0.002) {
  const n = Math.round(dur * SR);
  const b = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    let v = 0;
    for (const [mul, a, dk = decay] of partials) v += a * Math.sin(TAU * f * mul * t) * Math.exp(-t / dk);
    b[i] = v * Math.min(1, t / attack);
  }
  return b;
}

// Low body with a falling pitch: thuds, booms.
function thump(dur, fStart, fEnd, fall, decay, r, click = 0.25) {
  const n = Math.round(dur * SR);
  const b = new Float32Array(n);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const f = fEnd + (fStart - fEnd) * Math.exp(-t / fall);
    ph += f / SR;
    b[i] = (Math.sin(TAU * ph) + 0.3 * Math.sin(TAU * 2 * ph)) * Math.min(1, t / 0.002) * Math.exp(-t / decay);
  }
  const c = noise(Math.round(0.05 * SR), r);
  svf(c, () => 1100, 0.8, "band");
  for (let i = 0; i < c.length; i++) b[i] += c[i] * click * Math.exp(-i / SR / 0.012);
  return b;
}

function peakNorm(b, peak) {
  let m = 0;
  for (let i = 0; i < b.length; i++) m = Math.max(m, Math.abs(b[i]));
  const g = peak / (m || 1);
  for (let i = 0; i < b.length; i++) b[i] *= g;
  return b;
}

// ---------------------------------------------------------------- episode
function build(n, moods) {
  const cue = JSON.parse(fs.readFileSync(path.join(OUT, "sfx", `episode-0${n}.json`), "utf8"));
  const len = Math.ceil(cue.total * SR);
  const L = new Float32Array(len);
  const R = new Float32Array(len);
  const sL = new Float32Array(len);
  const sR = new Float32Array(len);
  const r = rng(5000 + n);
  const tonic = TONIC[n] ?? 38;
  const moodOf = (e) => moods[e.scene] ?? "establish";
  const put = (buf, t, gain, pan = 0, send = 0.3) => {
    const i0 = Math.round(t * SR);
    place(L, R, buf, i0, gain, pan);
    if (send) place(sL, sR, buf, i0, gain * send, pan);
  };

  // thin out: one blip/panel at a time, nothing fighting a scene change
  const last = {};
  const spacing = { blip: 0.3, panel: 0.5, draw: 0.7, type: 0.2 };
  const whooshes = cue.events.filter((e) => e.kind === "whoosh").map((e) => e.t);
  const used = { blip: 0, panel: 0, draw: 0, impact: 0, type: 0, whoosh: 0, swipe: 0 };

  for (const e of cue.events) {
    if (spacing[e.kind] && e.t - (last[e.kind] ?? -9) < spacing[e.kind]) continue;
    if (["blip", "panel", "draw"].includes(e.kind) && whooshes.some((w) => Math.abs(w - e.t) < 0.5)) continue;
    last[e.kind] = e.t;
    const pan = (e.pan ?? 0) * 0.6;
    switch (e.kind) {
      case "whoosh": {
        // centred on the crossfade: builds into the cut, tails off after
        const mood = moodOf(e);
        const dark = mood === "shock" || mood === "fracture" || mood === "close";
        const bright = mood === "motion" || mood === "establish";
        const b = peakNorm(whoosh(1.5, dark ? 180 : 320, bright ? 2400 : dark ? 900 : 1900, dark ? 420 : 650, r, 0.6), 1);
        const i0 = Math.round((e.t - 0.9) * SR);
        // sweep left -> right across the transition
        for (let j = 0; j < b.length; j++) {
          const p = -0.7 + (1.4 * j) / b.length;
          const a = ((p + 1) * Math.PI) / 4;
          const i = i0 + j;
          if (i < 0 || i >= len) continue;
          L[i] += b[j] * Math.cos(a) * Math.SQRT2 * db(-25);
          R[i] += b[j] * Math.sin(a) * Math.SQRT2 * db(-25);
          sL[i] += b[j] * Math.cos(a) * db(-30);
          sR[i] += b[j] * Math.sin(a) * db(-30);
        }
        // a soft low swell under it
        const sub = peakNorm(tone(1.6, 55, 0.6, [[1, 1], [2, 0.2]], 0.5), 1);
        put(sub, e.t - 0.45, db(-31), 0, 0);
        break;
      }
      case "blip": {
        const degrees = BLIP[moodOf(e)] ?? BLIP.establish;
        const f = midiHz(tonic + 48 + degrees[Math.floor(r() * degrees.length)]);
        const b = peakNorm(tone(0.22, f, 0.06, [[1, 1], [2, 0.3, 0.025], [3.01, 0.08, 0.012]], 0.0015), 1);
        put(b, e.t, db(-33), pan, 0.5);
        break;
      }
      case "panel": {
        const f0 = PANEL_F[moodOf(e)] ?? 190;
        const b = peakNorm(tone(0.25, f0 + r() * 16, 0.07, [[1, 1], [2.02, 0.25, 0.03]], 0.002), 1);
        const c = noise(Math.round(0.012 * SR), r);
        svf(c, () => 2600, 0.9, "band");
        for (let i = 0; i < c.length; i++) b[i] += c[i] * 0.5 * (1 - i / c.length);
        put(peakNorm(b, 1), e.t, db(-31), pan, 0.4);
        break;
      }
      case "impact": {
        const b = peakNorm(thump(1.1, 92, 52, 0.06, 0.3, r, 0.35), 1);
        put(b, e.t + 0.02, db(-17), pan * 0.5, 0.45);
        break;
      }
      case "type": {
        const dur = Math.max(0.3, e.dur ?? 1);
        const rate = 21;
        for (let k = 0; k < dur * rate; k++) {
          const t = e.t + k / rate + (r() - 0.5) * 0.012;
          const c = noise(Math.round(0.004 * SR), r);
          svf(c, () => 3800 + r() * 1500, 0.9, "band");
          for (let i = 0; i < c.length; i++) c[i] *= 1 - i / c.length;
          put(peakNorm(c, 1), t, db(-40) * (0.6 + 0.4 * r()), pan, 0.15);
        }
        break;
      }
      case "draw": {
        const dur = Math.min(2.4, Math.max(0.8, e.dur ?? 1.4));
        const b = peakNorm(whoosh(dur, 2600, 5200, 4200, r, 0.7), 1);
        put(b, e.t, db(-39), pan, 0.6);
        break;
      }
      case "swipe": {
        const b = peakNorm(whoosh(0.5, 900, 2800, 1600, r, 0.45), 1);
        put(b, e.t - 0.1, db(-31), 0.55, 0.3);
        break;
      }
      case "ident": {
        // title card: a deep boom, a shimmer of chord tones, and air following the light sweep
        put(peakNorm(thump(3.2, 64, 40, 0.12, 0.9, r, 0.15), 1), e.t, db(-14), 0, 0.5);
        const sh = new Float32Array(Math.round(3 * SR));
        [0, 7, 12, 19].forEach((o, k) => {
          const tt = tone(3, midiHz(tonic + 48 + o), 1.2, [[1, 1]], 0.04);
          for (let i = 0; i < tt.length; i++) sh[i] += tt[i] * (0.6 - k * 0.1);
        });
        put(peakNorm(sh, 1), e.t + 0.1, db(-30), 0, 1.2);
        const sweep = peakNorm(whoosh(1.7, 700, 3000, 1400, r, 0.55), 1);
        for (let j = 0; j < sweep.length; j++) {
          const p = -0.9 + (1.8 * j) / sweep.length;
          const a = ((p + 1) * Math.PI) / 4;
          const i = Math.round((e.t + 0.3) * SR) + j;
          L[i] += sweep[j] * Math.cos(a) * db(-30);
          R[i] += sweep[j] * Math.sin(a) * db(-30);
        }
        break;
      }
      case "end": {
        put(peakNorm(thump(3.5, 58, 36, 0.1, 1.1, r, 0.3), 1), e.t, db(-12), 0, 0.6);
        break;
      }
      default:
        continue;
    }
    used[e.kind] = (used[e.kind] ?? 0) + 1;
  }

  const [wL, wR] = freeverb(sL, sR, { room: 0.8, damp: 0.45, wet: 1 });
  for (let i = 0; i < len; i++) {
    L[i] = Math.tanh((L[i] + wL[i] * 0.8) * 1.05);
    R[i] = Math.tanh((R[i] + wR[i] * 0.8) * 1.05);
  }
  writeStereo(path.join(OUT, "audio", `episode-0${n}-sfx.wav`), L, R);
  return used;
}

const eps = process.argv.slice(2).filter((a) => /^[1-5]$/.test(a)).map(Number);
for (const n of eps.length ? eps : [1, 2, 3, 4, 5]) {
  const t0 = Date.now();
  const ep = (await import(`./episodes/ep${n}.mjs`)).default;
  const moods = scenesOf(ep).map((s) => s.mood);
  const used = build(n, moods);
  console.log(`ep${n}: sfx ${JSON.stringify(used)} ${((Date.now() - t0) / 1000).toFixed(0)}s`);
}
