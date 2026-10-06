import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const SCRIPTS = path.resolve(ROOT, "../scripts");
export const OUT = path.join(ROOT, "out");

// Narration voice. Swap with --voice on the CLI; samples via `node src/tts.mjs --samples`.
export const VOICE = "am_michael";
export const SPEED = 0.96;

// Episode timeline, in seconds.
export const TIMELINE = {
  titleCard: 3.0, // silent title card; picture cuts in on the first spoken word
  sentencePause: 0.42,
  colonPause: 0.3,
  commaSplitPause: 0.2,
  paragraphGap: 1.6, // breath between paragraphs, where scenes hand off
  tail: 5.0, // hold after the last line, then cut to black
};

export const VIDEO = { width: 1920, height: 1080, fps: 30 };
