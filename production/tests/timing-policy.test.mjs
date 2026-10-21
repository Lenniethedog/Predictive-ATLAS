import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { timingMatchesPolicy } from "../src/timing-policy.mjs";

// Actual paragraph boundaries from the v7 Episode 1 read, without audio or text.
const { timing: read, policy } = JSON.parse(fs.readFileSync(new URL("./fixtures/narration-timing-v7.json", import.meta.url)));

test("cache adoption rejects a read with the old pause policy", () => {
  assert.equal(timingMatchesPolicy(read, policy), true);
  assert.equal(timingMatchesPolicy(read, { ...policy, paragraphGap: 1.5 }), false);
  assert.equal(timingMatchesPolicy(read, { ...policy, titleCard: 4 }), false);
  assert.equal(timingMatchesPolicy(read, { ...policy, tail: 3 }), false);
  const drifted = structuredClone(read);
  drifted.paragraphs[3].start += 0.2;
  assert.equal(timingMatchesPolicy(drifted, policy), false);
});
