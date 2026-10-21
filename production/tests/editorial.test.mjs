import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { OUT } from "../src/config.mjs";
import { INSERTS, photoShots, PHOTO_DURATION } from "../src/engine/photos.mjs";
import { lensEvents } from "../src/engine/chrome.mjs";

const timing = (text, start = 4, end = 10, total = 20) => ({
  titleCard: 3, total, paragraphs: [{ sentences: [{ text, start, end }] }],
});

test("all episode photos match the authored narration and include credits", async () => {
  for (const n of [1, 2, 3, 4, 5]) {
    const ep = (await import(`../src/episodes/ep${n}.mjs`)).default;
    for (const shot of INSERTS[n]) {
      assert.ok(ep.scenes.some((s) => s.narration.toLowerCase().includes(shot.phrase.toLowerCase())));
      assert.ok(shot.credit);
    }
    const file = path.join(OUT, "timing", `episode-0${n}.json`);
    if (fs.existsSync(file)) {
      for (const shot of photoShots(n, JSON.parse(fs.readFileSync(file, "utf8")))) {
        assert.ok(shot.start >= 3);
        assert.ok(fs.existsSync(shot.file));
      }
    }
  }
});

test("photos arrive at the named phrase within the spoken sentence", () => {
  const t = timing("First the ships that feed industry arrive.");
  const [shot] = photoShots(3, t);
  assert.equal(shot.start, 4 + 6 * (10 / 42));
  assert.ok(shot.start + PHOTO_DURATION < t.total);
});

test("missing anchors and cutaways beyond the film fail before rendering", () => {
  assert.throws(() => photoShots(3, timing("An unrelated sentence.")), /anchor missing/);
  assert.throws(() => photoShots(3, timing("ships that feed", 19, 20)), /outside the film/);
});

test("overlapping photo inserts are rejected", () => {
  const text = INSERTS[4].map((s) => s.phrase).join(" ");
  assert.throws(() => photoShots(4, timing(text, 4, 5)), /overlap/);
});

test("scenes with their own thinker panels suppress duplicate lecturer cards", () => {
  const t = timing("Mearsheimer and Sachs compare Jiang's model.");
  assert.equal(lensEvents(t, [{ noBadges: true }]).length, 0);
  assert.equal(lensEvents(t, [{}]).length, 3);
});
