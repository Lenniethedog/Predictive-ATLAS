import assert from "node:assert/strict";
import test from "node:test";
import { canvas, makeBeats } from "../src/engine/core.mjs";
import { splitSentences } from "../src/narration.mjs";
import { setFrame } from "../src/engine/draw.mjs";
import * as SFX from "../src/engine/sfx-rec.mjs";

test("discarding cue raster work preserves event timing, keys and pan", async () => {
  for (const [n, index] of [[1, 0], [2, 8], [3, 9], [4, 6], [5, 4]]) {
    const scene = (await import(`../src/episodes/ep${n}.mjs`)).default.scenes[index];
    const sentences = splitSentences(scene.narration).map((text, i) => ({ text, start: i * 4, end: i * 4 + 3.5 }));
    const clock = makeBeats({ sentences }, 0, sentences.length * 4 + 4);
    const run = (size) => {
      const ctx = canvas(...size).getContext("2d");
      const draw = scene.draw(clock);
      SFX.reset(); SFX.rec.on = true; SFX.rec.scene = index;
      for (let t = 0; t < clock.dur; t += 2) {
        SFX.beginFrame(); SFX.rec.t = t; setFrame(-100); draw(ctx, t);
      }
      const events = structuredClone(SFX.rec.events);
      SFX.rec.on = false;
      return events;
    };
    assert.deepEqual(run([1, 1]), run([1920, 1080]), `episode ${n}, ${scene.title}`);
  }
});
