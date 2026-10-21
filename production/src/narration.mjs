// Delivery choices follow the thought; variation is reproducible and restrained.
import { ENGINE } from "./config.mjs";
export const VOICE_REVISION = ENGINE === "chatterbox" ? "spoken-v8-chatterbox" : "spoken-v7-conversation";

export function splitSentences(text) {
  // Protect initials, abbreviations and decimals from becoming sentence breaks.
  const protectedText = text.replace(/\b(?:[A-Z]\.){2,}|\b(?:Mr|Mrs|Ms|Dr|Prof|St|vs)\.|\d+\.\d+/g,
    (s) => s.replace(/\./g, "\uE000"));
  return protectedText.split(/(?<=[.!?])\s+(?=[A-Z“"'])/)
    .map((s) => s.replace(/\uE000/g, ".").trim()).filter(Boolean);
}

const words = (s) => s.split(/\s+/).filter(Boolean).length;
export const isPunch = (s) => /^(?:It breaks|It shatters|The state then chooses capacity)[.!]$/i.test(s.trim());

export function deliverySpeed(base, text, mood, final = false) {
  const pace = { establish: 0.985, history: 1, system: 1.015, pressure: 1.01,
    shock: 0.98, motion: 1.015, cold: 0.99, fracture: 0.985, close: 0.965 }[mood] ?? 1;
  // Numbers and the conclusion need room. Short connective lines need flow.
  const dense = /\b(?:million|billion|percent|nineteen|twenty|outcome (?:one|two|three|four))\b/i.test(text);
  const emphasis = isPunch(text) ? 0.96 : final ? 0.985 : dense ? 0.985 : 1;
  return +(base * pace * emphasis).toFixed(3);
}

export function pauseAfter(previous, next, seed) {
  const variation = ((Math.sin(seed * 12.9898) * 43758.5453) % 1 + 1) % 1;
  const jitter = (variation - 0.5) * 0.08;
  if (previous.endsWith(":")) return 0.18 + jitter;
  if (previous.endsWith("?")) return 0.4 + jitter;
  if (isPunch(next)) return 0.48 + jitter;
  if (isPunch(previous)) return 0.58 + jitter;
  if (/^(?:But|Yet|Instead|The cost|The answer|The result|What remains)\b/.test(next)) return 0.32 + jitter;
  if (/^(?:It|They|That|This|And|Each|The same|So|Because)\b/.test(next) && words(previous) < 24) return 0.16 + jitter;
  return (words(previous) > 28 ? 0.32 : 0.24) + jitter;
}

// Use window energy, not the first loud sample: preserve quiet opening consonants.
export function trimSpeech(buf, sr = 24000) {
  const window = Math.round(sr * 0.01);
  const keep = Math.round(sr * 0.055);
  const energy = (start) => {
    let sum = 0;
    const end = Math.min(buf.length, start + window);
    for (let i = start; i < end; i++) sum += buf[i] * buf[i];
    return Math.sqrt(sum / Math.max(1, end - start));
  };
  let a = 0, b = buf.length;
  while (a + window < b && energy(a) < 0.0012) a += window;
  while (b - window > a && energy(Math.max(a, b - window)) < 0.0012) b -= window;
  return buf.slice(Math.max(0, a - keep), Math.min(buf.length, b + keep));
}
