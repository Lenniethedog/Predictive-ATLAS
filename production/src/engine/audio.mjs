// Shared audio DSP for the score, the sound effects and the final mix.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { TIMELINE } from "../config.mjs";

export const SR = 48000;
export const TAU = Math.PI * 2;

export const midiHz = (m) => 440 * Math.pow(2, (m - 69) / 12);
export const smoothstep = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Band-limited sawtooth correction (PolyBLEP).
export function blep(t, dt) {
  if (t < dt) {
    t /= dt;
    return t + t - t * t - 1;
  }
  if (t > 1 - dt) {
    t = (t - 1) / dt;
    return t * t + t + t + 1;
  }
  return 0;
}

// Topology-preserving state-variable filter; cutoffAt(seconds) is sampled per block.
export function svf(buf, cutoffAt, q = 0.7, mode = "low", block = 32, offset = 0) {
  let ic1 = 0;
  let ic2 = 0;
  const k = 1 / q;
  let a1 = 0;
  let a2 = 0;
  let a3 = 0;
  for (let i = 0; i < buf.length; i++) {
    if (i % block === 0) {
      const g = Math.tan((Math.PI * Math.min(Math.max(20, cutoffAt((i + offset) / SR)), SR * 0.45)) / SR);
      a1 = 1 / (1 + g * (g + k));
      a2 = g * a1;
      a3 = g * a2;
    }
    const v3 = buf[i] - ic2;
    const v1 = a1 * ic1 + a2 * v3;
    const v2 = ic2 + a2 * ic1 + a3 * v3;
    ic1 = 2 * v1 - ic1;
    ic2 = 2 * v2 - ic2;
    buf[i] = mode === "low" ? v2 : mode === "band" ? v1 : buf[i] - k * v1 - v2;
  }
  return buf;
}

// Freeverb (Jezar), tuned for 48 kHz.
export function freeverb(inL, inR, { room = 0.86, damp = 0.35, wet = 0.4 } = {}) {
  const s = SR / 44100;
  const combs = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617].map((d) => Math.round(d * s));
  const aps = [556, 441, 341, 225].map((d) => Math.round(d * s));
  const run = (input, spread) => {
    const out = new Float32Array(input.length);
    const cb = combs.map((d) => ({ b: new Float32Array(d + spread), i: 0, st: 0 }));
    const ab = aps.map((d) => ({ b: new Float32Array(d + spread), i: 0 }));
    for (let n = 0; n < input.length; n++) {
      const x = input[n] * 0.015;
      let acc = 0;
      for (const c of cb) {
        const y = c.b[c.i];
        c.st = y * (1 - damp) + c.st * damp;
        c.b[c.i] = x + c.st * room;
        if (++c.i >= c.b.length) c.i = 0;
        acc += y;
      }
      for (const a of ab) {
        const y = a.b[a.i];
        a.b[a.i] = acc + y * 0.5;
        acc = y - acc;
        if (++a.i >= a.b.length) a.i = 0;
      }
      out[n] = acc * wet;
    }
    return out;
  };
  return [run(inL, 0), run(inR, 23)];
}

export function writeStereo(file, L, R) {
  const data = Buffer.alloc(L.length * 4);
  for (let i = 0; i < L.length; i++) {
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
  h.writeUInt32LE(SR, 24);
  h.writeUInt32LE(SR * 4, 28);
  h.writeUInt16LE(4, 32);
  h.writeUInt16LE(16, 34);
  h.write("data", 36);
  h.writeUInt32LE(data.length, 40);
  const fd = fs.openSync(file, "w");
  fs.writeSync(fd, h);
  fs.writeSync(fd, data);
  fs.closeSync(fd);
}

export function ffmpeg(args, capture = false) {
  const r = spawnSync("ffmpeg", ["-hide_banner", "-y", ...args], { encoding: "utf8", maxBuffer: 1 << 26 });
  if (r.status !== 0) throw new Error(`ffmpeg failed: ${r.stderr?.slice(-800)}`);
  return capture ? r.stderr : "";
}

export function integratedLUFS(file) {
  const log = ffmpeg(["-i", file, "-af", "ebur128", "-f", "null", "-"], true);
  const m = [...log.matchAll(/I:\s+(-?[\d.]+) LUFS/g)].pop();
  return m ? Number(m[1]) : -30;
}

// Scene clock, identical to render.mjs.
export function sceneClock(timing) {
  const p = timing.paragraphs;
  const starts = p.map((q, i) => (i === 0 ? q.start : (p[i - 1].end + q.start) / 2));
  const end = p[p.length - 1].end + TIMELINE.tail - 1;
  return { starts, end };
}

// Add src (mono) into stereo L/R at sample i0 with equal-power pan in [-1, 1].
export function place(L, R, src, i0, gain = 1, pan = 0) {
  const a = ((Math.max(-1, Math.min(1, pan)) + 1) * Math.PI) / 4;
  const gl = Math.cos(a) * gain * Math.SQRT2;
  const gr = Math.sin(a) * gain * Math.SQRT2;
  for (let j = 0; j < src.length; j++) {
    const i = i0 + j;
    if (i < 0) continue;
    if (i >= L.length) break;
    L[i] += src[j] * gl;
    R[i] += src[j] * gr;
  }
}
