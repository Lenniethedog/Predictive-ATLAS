// Fail when a scene is missing its narration, cue, mood, or drawing,
// or when the generated script files disagree with the episode module.
import fs from "node:fs";
import path from "node:path";
import { SCRIPTS } from "./config.mjs";
import { narrationText, scriptText } from "./export-scripts.mjs";
import { assertEpisode, spokenWords } from "./story.mjs";

let failed = false;
for (const n of [1, 2, 3, 4, 5]) {
  const ep = (await import(`./episodes/ep${n}.mjs`)).default;
  let scenes;
  try {
    scenes = assertEpisode(ep, n);
  } catch (err) {
    failed = true;
    console.error(err.message);
    continue;
  }
  const narrPath = path.join(SCRIPTS, `episode-0${n}-narration.txt`);
  const scriptPath = path.join(SCRIPTS, `episode-0${n}-script.txt`);
  const narr = fs.existsSync(narrPath) ? fs.readFileSync(narrPath, "utf8") : "";
  const script = fs.existsSync(scriptPath) ? fs.readFileSync(scriptPath, "utf8") : "";
  if (narr !== narrationText(scenes)) {
    failed = true;
    console.error(`episode ${n}: narration file does not match the episode module`);
  }
  if (script !== scriptText(n, ep, scenes)) {
    failed = true;
    console.error(`episode ${n}: script file does not match the episode module`);
  }
  if (!failed) console.log(`ep${n}: ${scenes.length} scenes, ${spokenWords(scenes)} words, cue and mood on every scene`);
}
if (failed) process.exit(1);
