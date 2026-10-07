// Full pipeline for one or more episodes, in dependency order:
//   narration -> animation cue list -> effects -> score -> mix -> video
//
// Unchanged stages are skipped. A picture edit does not resynthesize narration,
// and a narration edit does not redraw scenes whose drawing did not change.
//
//   node src/build.mjs                 all five, everything
//   node src/build.mjs 2 4             selected episodes
//   node src/build.mjs 3 --no-tts      reuse existing narration
//   node src/build.mjs 3 --sound-only  rebuild the soundtrack but not the video
//   node src/build.mjs 3 --preview     960×540 at 15 fps, no bloom, grain, or dither
//   node src/build.mjs 1 --remux       keep the existing picture and replace its soundtrack
//   node src/build.mjs 3 --force       ignore stamps and rebuild every stage
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { OUT, ROOT, SPEED, TIMELINE, VOICE } from "./config.mjs";
import { digest, engineFiles, fileDigest, isFresh, markFresh } from "./stamp.mjs";
import { assertEpisode } from "./story.mjs";

const args = process.argv.slice(2);
const force = args.includes("--force");
const preview = args.includes("--preview");
const noTts = args.includes("--no-tts");
const soundOnly = args.includes("--sound-only");
const remuxOnly = args.includes("--remux");
const picked = args.filter((a) => /^[1-5]$/.test(a)).map(Number);
const list = picked.length ? picked : [1, 2, 3, 4, 5];

function run(script, ...rest) {
  const cmd = [script, ...rest.map(String)];
  console.log(`\n$ node ${cmd.join(" ")}`);
  const started = Date.now();
  const r = spawnSync("node", cmd, { stdio: "inherit", cwd: ROOT });
  return { status: r.status ?? 1, started };
}

function mustUpdate(file, started) {
  if (!fs.existsSync(file) || fs.statSync(file).size === 0 || fs.statSync(file).mtimeMs + 1000 < started) {
    console.error(`expected a new ${path.relative(ROOT, file)}`);
    process.exit(1);
  }
}

function narrationMatches(scenes, timingPath) {
  if (!fs.existsSync(timingPath)) return false;
  const timing = JSON.parse(fs.readFileSync(timingPath, "utf8"));
  if (timing.voice !== VOICE || Number(timing.speed) !== Number(SPEED)) return false;
  const norm = (s) => String(s).replace(/\s+/g, " ").trim();
  const got = (timing.paragraphs ?? []).map((p) => norm(p.sentences.map((s) => s.text).join(" ")));
  const want = scenes.map((s) => norm(s.narration));
  return got.length === want.length && got.every((line, i) => line === want[i]);
}

function remux(video, audio) {
  const tmp = `${video}.tmp.mp4`;
  const r = spawnSync(
    "ffmpeg",
    ["-hide_banner", "-loglevel", "error", "-y", "-i", video, "-i", audio, "-map", "0:v:0", "-map", "1:a:0", "-c:v", "copy", "-c:a", "aac", "-b:a", "256k", "-shortest", tmp],
    { stdio: "inherit" },
  );
  if ((r.status ?? 1) !== 0) process.exit(r.status ?? 1);
  fs.renameSync(tmp, video);
}

function stage(n, name, hash, outputs, skip, build) {
  if (!force && isFresh(n, name, hash, outputs)) {
    console.log(`ep${n}: ${skip}`);
    return;
  }
  const started = build();
  for (const file of outputs) mustUpdate(file, started);
  markFresh(n, name, hash, outputs);
}

const exported = run("src/export-scripts.mjs");
if (exported.status !== 0) process.exit(exported.status);
const checked = run("src/check.mjs");
if (checked.status !== 0) process.exit(checked.status);

const engines = engineFiles();
const storyFiles = ["src/story.mjs", "src/config.mjs"].map((f) => path.join(ROOT, f));

for (const n of list) {
  const ep = (await import(`./episodes/ep${n}.mjs`)).default;
  const scenes = assertEpisode(ep, n);
  const storyHash = digest(scenes.map((s) => [s.title, s.mood, s.narration, s.cue]));
  const timing = path.join(OUT, "timing", `episode-0${n}.json`);
  const narration = path.join(OUT, "audio", `episode-0${n}-narration.wav`);
  const srt = path.join(OUT, "subtitles", `episode-0${n}.srt`);
  const vtt = path.join(OUT, "subtitles", `episode-0${n}.vtt`);
  // phrase-v5 is the flowing English read. A voice-chain edit bumps this and reruns TTS.
  const voiceHash = digest([storyHash, VOICE, SPEED, TIMELINE, "phrase-v5"]);
  const voiceOuts = [timing, narration, srt, vtt];

  if (!noTts) {
    const adopt = !force && narrationMatches(scenes, timing) && voiceOuts.every((f) => fs.existsSync(f) && fs.statSync(f).size > 0);
    if (adopt) {
      if (!isFresh(n, "tts", voiceHash, voiceOuts)) markFresh(n, "tts", voiceHash, voiceOuts);
      console.log(`ep${n}: narration unchanged, skip`);
    } else stage(n, "tts", voiceHash, voiceOuts, "narration unchanged", () => {
      const r = run("src/tts.mjs", n);
      let clean = false;
      try {
        const written = JSON.parse(fs.readFileSync(timing, "utf8"));
        clean = written.align?.fallback === 0 && fs.statSync(timing).mtimeMs + 1000 >= r.started;
      } catch {
        clean = false;
      }
      if (r.status !== 0 && !clean) process.exit(r.status || 1);
      if (r.status !== 0) console.log(`ep${n}: tts exited ${r.status} after a clean alignment`);
      return r.started;
    });
  } else if (!fs.existsSync(timing) || !fs.existsSync(narration)) {
    console.error(`ep${n}: --no-tts needs an existing narration and timing file`);
    process.exit(1);
  }

  const timingHash = fileDigest([timing]);
  // Drawing only. The spoken story sits in the same file and must not force a redraw.
  const pictureHash = digest([
    digest(scenes.map((s) => s.draw.toString())),
    fileDigest([path.join(ROOT, "src/render.mjs"), ...engines]),
  ]);
  const eventsOut = path.join(OUT, "sfx", `episode-0${n}.json`);
  stage(n, "events", digest([pictureHash, timingHash]), [eventsOut], "animation cues unchanged", () => {
    const extra = force ? ["--force"] : [];
    const r = run("src/render.mjs", n, "--events", ...extra);
    if (r.status !== 0) process.exit(r.status);
    return r.started;
  });

  const musicOut = path.join(OUT, "audio", `episode-0${n}-music.wav`);
  const musicHash = digest([
    storyHash,
    timingHash,
    fileDigest([path.join(ROOT, "src/music.mjs"), path.join(ROOT, "src/engine/audio.mjs"), ...storyFiles]),
  ]);
  stage(n, "music", musicHash, [musicOut], "score unchanged", () => {
    const r = run("src/music.mjs", n);
    if (r.status !== 0) process.exit(r.status);
    return r.started;
  });

  const sfxOut = path.join(OUT, "audio", `episode-0${n}-sfx.wav`);
  const sfxHash = digest([
    storyHash,
    fileDigest([eventsOut]),
    fileDigest([path.join(ROOT, "src/sfx.mjs"), path.join(ROOT, "src/engine/audio.mjs"), path.join(ROOT, "src/story.mjs")]),
  ]);
  stage(n, "sfx", sfxHash, [sfxOut], "effects unchanged", () => {
    const r = run("src/sfx.mjs", n);
    if (r.status !== 0) process.exit(r.status);
    return r.started;
  });

  const mixOut = path.join(OUT, "audio", `episode-0${n}-mix.wav`);
  const mixMp3 = path.join(OUT, "audio", `episode-0${n}-mix.mp3`);
  const mixHash = digest([
    fileDigest([narration, musicOut, sfxOut, path.join(ROOT, "src/mix.mjs"), path.join(ROOT, "src/engine/audio.mjs")]),
  ]);
  stage(n, "mix", mixHash, [mixOut, mixMp3], "mix unchanged", () => {
    const r = run("src/mix.mjs", n);
    if (r.status !== 0) process.exit(r.status);
    return r.started;
  });

  if (soundOnly) continue;

  const videoName = preview ? `episode-0${n}-preview.mp4` : `episode-0${n}.mp4`;
  const videoOut = path.join(OUT, preview ? "previews" : "video", videoName);
  const videoHash = digest([pictureHash, fileDigest([mixOut, timing]), preview ? "half-15fps" : "full"]);
  const pictureStamp = path.join(OUT, "stamps", `episode-0${n}-picture.json`);
  let stamped = null;
  try {
    stamped = JSON.parse(fs.readFileSync(pictureStamp, "utf8"));
  } catch {
    stamped = null;
  }
  const samePicture = stamped?.hash === pictureHash && fs.existsSync(videoOut);
  // A new read moves every sentence. Remux only when the picture was drawn to this timing.
  const sameTiming = stamped?.timing === timingHash;
  if (!preview && (remuxOnly || (samePicture && sameTiming)) && !force) {
    if (!fs.existsSync(videoOut)) {
      console.error(`ep${n}: --remux needs an existing ${videoOut}`);
      process.exit(1);
    }
    if (!isFresh(n, "video", videoHash, [videoOut])) {
      console.log(`ep${n}: picture unchanged, remux soundtrack`);
      remux(videoOut, mixOut);
      markFresh(n, "video", videoHash, [videoOut]);
    } else console.log(`ep${n}: picture unchanged`);
    fs.mkdirSync(path.dirname(pictureStamp), { recursive: true });
    fs.writeFileSync(pictureStamp, JSON.stringify({ hash: pictureHash, timing: timingHash }));
    continue;
  }
  stage(n, preview ? "preview" : "video", videoHash, [videoOut], preview ? "preview unchanged" : "picture unchanged", () => {
    const r = run("src/render.mjs", n, ...(preview ? ["--preview"] : []));
    if (r.status !== 0) process.exit(r.status);
    if (!preview) {
      fs.mkdirSync(path.dirname(pictureStamp), { recursive: true });
      fs.writeFileSync(pictureStamp, JSON.stringify({ hash: pictureHash, timing: timingHash }));
    }
    return r.started;
  });

  if (!preview) {
    const brollScript = path.join(ROOT, "src/broll.mjs");
    stage(n, "broll", digest([fileDigest([videoOut, brollScript])]), [videoOut], "photographs unchanged", () => {
      const r = run("src/broll.mjs", n);
      if (r.status !== 0) process.exit(r.status);
      return r.started;
    });
  }
}
