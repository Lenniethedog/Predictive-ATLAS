import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const SCRIPTS = path.resolve(ROOT, "../scripts");
export const OUT = path.join(ROOT, "out");

// Narration engine. "chatterbox" (Resemble AI, MIT, local) reads with human-like
// prosody, matched to the channel's British narrator from a short reference clip;
// "kokoro" is the original lightweight engine (VOICE / SPEED below apply to it).
export const ENGINE = process.env.NARRATION_ENGINE ?? "chatterbox";
export const VOICE = "bm_george";
export const SPEED = 0.96;

export const CHATTERBOX = {
  reference: "assets/voice/george-reference.wav", // 10 s of the existing narrator
  cfg: 0.45, // pacing guidance; lower is slower and more deliberate
  temperature: 0.75,
  // expressiveness by scene mood: a little more energy under pressure, cooler at the close
  exaggeration: { establish: 0.48, history: 0.45, system: 0.45, pressure: 0.56, shock: 0.55, motion: 0.5, cold: 0.4, fracture: 0.52, close: 0.42 },
  maxChars: 240, // passages longer than this lose coherence
  tries: 4, // takes per passage when the transcript disagrees with the script
};

// Identity recorded in timing files; a read from a different engine or voice never matches.
export const NARRATOR = ENGINE === "chatterbox" ? `chatterbox:${CHATTERBOX.reference.split("/").pop().replace(/\.wav$/, "")}` : VOICE;

// Episode timeline, in seconds.
export const TIMELINE = {
  titleCard: 3.0, // silent title card; picture cuts in on the first spoken word
  sentencePause: 0.42,
  colonPause: 0.3,
  commaSplitPause: 0.2,
  paragraphGap: 1.15, // room for the thought and scene to change
  tail: 5.0, // hold after the last line, then cut to black
};

export const VIDEO = { width: 1920, height: 1080, fps: 30 };
