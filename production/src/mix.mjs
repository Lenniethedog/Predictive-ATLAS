// Final soundtrack: narration on top, the score set low and ducked under the voice,
// the effects a little lower still and lightly ducked, then a gentle limiter.
//
//   node src/mix.mjs            all episodes
//   node src/mix.mjs 1
//
// Writes out/audio/episode-0N-mix.wav (+ .mp3), which render.mjs uses as the soundtrack.
import fs from "node:fs";
import path from "node:path";
import { OUT } from "./config.mjs";
import { ffmpeg, integratedLUFS } from "./engine/audio.mjs";

const MUSIC_LUFS = -28.5; // score level before ducking (voice sits at -16); raise for more presence
const SFX_DB = 0; // trim for the effects bus

function mix(n) {
  const dir = path.join(OUT, "audio");
  const voice = path.join(dir, `episode-0${n}-narration.wav`);
  const music = path.join(dir, `episode-0${n}-music.wav`);
  const sfx = path.join(dir, `episode-0${n}-sfx.wav`);
  const out = path.join(dir, `episode-0${n}-mix.wav`);
  const gain = MUSIC_LUFS - integratedLUFS(music);
  const hasSfx = fs.existsSync(sfx);
  const graph = hasSfx
    ? `[1:a]volume=${gain.toFixed(2)}dB[m];[2:a]volume=${SFX_DB}dB[s];` +
      "[0:a]asplit=3[v][k1][k2];" +
      "[m][k1]sidechaincompress=threshold=0.05:ratio=2.5:attack=220:release=1800:knee=6[md];" +
      "[s][k2]sidechaincompress=threshold=0.08:ratio=1.8:attack=30:release=600:knee=6[sd];" +
      "[v][md][sd]amix=inputs=3:weights=1 1 1:normalize=0,alimiter=limit=0.94:attack=5:release=80[out]"
    : `[1:a]volume=${gain.toFixed(2)}dB[m];[0:a]asplit=2[v][key];` +
      "[m][key]sidechaincompress=threshold=0.05:ratio=2.5:attack=220:release=1800:knee=6[md];" +
      "[v][md]amix=inputs=2:weights=1 1:normalize=0,alimiter=limit=0.94:attack=5:release=80[out]";
  const inputs = ["-i", voice, "-i", music, ...(hasSfx ? ["-i", sfx] : [])];
  ffmpeg([...inputs, "-filter_complex", graph, "-map", "[out]", "-ar", "48000", "-ac", "2", out]);
  ffmpeg(["-i", out, "-codec:a", "libmp3lame", "-b:a", "224k", out.replace(/\.wav$/, ".mp3")]);
  return { gain, hasSfx, lufs: integratedLUFS(out) };
}

const eps = process.argv.slice(2).filter((a) => /^[1-5]$/.test(a)).map(Number);
for (const n of eps.length ? eps : [1, 2, 3, 4, 5]) {
  const { gain, hasSfx, lufs } = mix(n);
  console.log(`ep${n}: music gain ${gain.toFixed(1)} dB, sfx ${hasSfx ? "yes" : "no"}, mix ${lufs.toFixed(1)} LUFS`);
}
