// Full pipeline for one or more episodes, in dependency order:
//   narration -> animation cue list -> effects -> score -> mix -> video
//
//   node src/build.mjs                 all five, everything
//   node src/build.mjs 2 4             selected episodes
//   node src/build.mjs 3 --no-tts      reuse existing narration (e.g. after visual edits)
//   node src/build.mjs 3 --sound-only  rebuild the soundtrack but not the video
import { spawnSync } from "node:child_process";

const args = process.argv.slice(2);
const eps = args.filter((a) => /^[1-5]$/.test(a));
const list = eps.length ? eps : ["1", "2", "3", "4", "5"];
const run = (...cmd) => {
  console.log(`\n$ node ${cmd.join(" ")}`);
  const r = spawnSync("node", cmd, { stdio: "inherit" });
  // onnxruntime can abort noisily on exit after tts has finished writing; tolerate that one
  if (r.status !== 0 && cmd[0] !== "src/tts.mjs") process.exit(r.status ?? 1);
};

if (!args.includes("--no-tts")) run("src/tts.mjs", ...list);
for (const n of list) run("src/render.mjs", n, "--events");
run("src/sfx.mjs", ...list);
run("src/music.mjs", ...list);
run("src/mix.mjs", ...list);
if (!args.includes("--sound-only")) for (const n of list) run("src/render.mjs", n);
