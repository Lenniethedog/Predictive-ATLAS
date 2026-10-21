// Write the readable script files from the episode modules.
//
//   node src/export-scripts.mjs
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { SCRIPTS } from "./config.mjs";
import { assertEpisode, spokenWords } from "./story.mjs";

const TITLE_CARD =
  "[TITLE CARD, silent, three seconds: PREDICTIVE ATLAS, then the episode title in small caps. No host. Cut to picture on the first spoken word.]";

export function narrationText(scenes) {
  return `${scenes.map((s) => s.narration.trim()).join("\n\n")}\n`;
}

export function scriptText(n, ep, scenes) {
  const title = `${ep.title}: ${ep.subtitle}`.toUpperCase();
  const parts = [
    "PREDICTIVE ATLAS",
    `EPISODE ${n} OF 5`,
    `TITLE: ${title}`,
    "",
    `SPOKEN NARRATION: ${spokenWords(scenes).toLocaleString("en-US")} words. Read only the unbracketed paragraphs.`,
    "READ the bracketed blocks as silence. They are animation direction.",
    "PACE: measured and conversational. Follow the thought across sentences; allow contrast and conclusions to land. No greeting or theatrical close.",
    "TARGET DURATION: about 11 minutes at a measured 135 words per minute.",
    "",
    TITLE_CARD,
    "",
  ];
  for (const s of scenes) {
    parts.push(s.narration.trim(), "", s.cue.trim(), "");
  }
  return `${parts.join("\n").replace(/\n+$/, "")}\n`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const only = process.argv.slice(2).filter((a) => /^[1-5]$/.test(a)).map(Number);
  for (const n of only.length ? only : [1, 2, 3, 4, 5]) {
    const ep = (await import(`./episodes/ep${n}.mjs`)).default;
    const scenes = assertEpisode(ep, n);
    fs.writeFileSync(path.join(SCRIPTS, `episode-0${n}-narration.txt`), narrationText(scenes));
    fs.writeFileSync(path.join(SCRIPTS, `episode-0${n}-script.txt`), scriptText(n, ep, scenes));
    console.log(`episode-0${n}: ${scenes.length} scenes written`);
  }
}
