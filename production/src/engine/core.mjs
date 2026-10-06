// Shared canvas setup, palette, easing and timing helpers.
import { createCanvas, GlobalFonts } from "@napi-rs/canvas";
import path from "node:path";
import { ROOT, VIDEO } from "../config.mjs";

export const W = VIDEO.width;
export const H = VIDEO.height;

// ---------------------------------------------------------------- fonts
const FONT_DIR = path.join(ROOT, "node_modules/@ibm");
const FONTS = [
  ["Plex Sans", "plex-sans", ["Light", "Regular", "Medium", "SemiBold"], "IBMPlexSans-"],
  ["Plex Cond", "plex-sans-condensed", ["Light", "Regular", "Medium", "SemiBold", "Bold"], "IBMPlexSansCondensed-"],
  ["Plex Mono", "plex-mono", ["Light", "Regular", "Medium", "SemiBold"], "IBMPlexMono-"],
];
for (const [family, dir, weights, prefix] of FONTS)
  for (const w of weights) GlobalFonts.registerFromPath(path.join(FONT_DIR, dir, "fonts/complete/woff2", `${prefix}${w}.woff2`), family);

export const FAMILY = { sans: "Plex Sans", cond: "Plex Cond", mono: "Plex Mono" };

// ---------------------------------------------------------------- palette
// Channel brief: charcoal ground, U.S.-aligned nodes cyber-cyan, BRICS corridors tactical amber.
// The scripts' "blue" maps to cyan throughout.
export const C = {
  bg: "#0d1015",
  bg2: "#12161d",
  land: "#1d2430",
  landHi: "#26303d",
  border: "#323d4b",
  grid: "rgba(160,190,220,0.045)",
  faint: "#2e3844",
  dim: "#7d8a98",
  mid: "#9aa7b4",
  ice: "#e7eef5",
  cyan: "#19d3ff",
  cyanDeep: "#0a6f8f",
  crimson: "#e5243b",
  crimsonDeep: "#7a1220",
  darkred: "#a3242f",
  darkredDeep: "#4a1016",
  amber: "#ffb020",
  amberDeep: "#7a5208",
  gold: "#d9b44a",
  steel: "#8a98a8",
  steelDeep: "#3a4553",
  green: "#3ddc97",
  violet: "#a78bfa",
};

export function rgba(hex, a = 1) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

export function mix(h1, h2, t) {
  const a = parseInt(h1.slice(1), 16);
  const b = parseInt(h2.slice(1), 16);
  const ch = (s) => Math.round(((a >> s) & 255) + (((b >> s) & 255) - ((a >> s) & 255)) * t);
  return `#${((1 << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).slice(1)}`;
}

// ---------------------------------------------------------------- math / easing
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const lerp2 = (p, q, t) => [lerp(p[0], q[0], t), lerp(p[1], q[1], t)];
export const smooth = (t) => t * t * (3 - 2 * t);
export const ease = {
  linear: (t) => t,
  inOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  out: (t) => 1 - Math.pow(1 - t, 3),
  in: (t) => t * t * t,
  outExpo: (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  inOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
  outBack: (t) => 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2),
};

// Eased 0..1 progress of t through [a, a+d].
export function prog(t, a, d = 1, fn = ease.inOut) {
  if (d <= 0) return t >= a ? 1 : 0;
  return fn(clamp((t - a) / d));
}

// Fade in at a over d, optionally fade out at b over d2.
export function fade(t, a, d = 0.6, b = Infinity, d2 = 0.6) {
  return prog(t, a, d, ease.out) * (1 - prog(t, b, d2, ease.inOut));
}

export function pulse(t, period = 2, lo = 0.6, hi = 1) {
  return lo + (hi - lo) * (0.5 + 0.5 * Math.sin((t / period) * Math.PI * 2));
}

// Deterministic RNG so every render is identical.
export function rng(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function canvas(w = W, h = H) {
  return createCanvas(w, h);
}

// ---------------------------------------------------------------- scene timing
// Scenes receive S: sentence-aligned beats relative to the scene's own clock.
export function makeBeats(para, sceneStart, sceneEnd) {
  const b = para.sentences.map((s) => s.start - sceneStart);
  const e = para.sentences.map((s) => s.end - sceneStart);
  return {
    dur: sceneEnd - sceneStart,
    b,
    e,
    n: b.length,
    ps: para.start - sceneStart,
    pe: para.end - sceneStart,
    text: para.sentences.map((s) => s.text),
    at: (i, f = 0) => {
      const k = Math.max(0, Math.min(b.length - 1, i));
      return b[k] + f * (e[k] - b[k]);
    },
    // first sentence whose text matches re (fallback to index d)
    find: (re, d = 0) => {
      const i = para.sentences.findIndex((s) => re.test(s.text));
      return i < 0 ? d : i;
    },
  };
}
