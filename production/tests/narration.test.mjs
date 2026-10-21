import assert from "node:assert/strict";
import test from "node:test";
import { splitSentences, deliverySpeed, pauseAfter, trimSpeech } from "../src/narration.mjs";
import { toPhonemes } from "../src/tts.mjs";
import { makeBeats } from "../src/engine/core.mjs";

test("sentence boundaries preserve abbreviations and decimal quantities", () => {
  assert.deepEqual(splitSentences("Dr. Sachs describes U.S. debt at 1.5 percent. That changes the price."),
    ["Dr. Sachs describes U.S. debt at 1.5 percent.", "That changes the price."]);
});

test("British and American voices receive their own accent phonemes", async () => {
  const gb = await toPhonemes("The dollar buys a factory.", "bm_george");
  const us = await toPhonemes("The dollar buys a factory.", "am_michael");
  assert.notEqual(gb, us);
  assert.match(gb, /dˈɒlə/);
  assert.match(us, /dˈɑːlɚ/);
});

test("pacing slows a conclusion without turning short connective lines into punchlines", () => {
  assert.ok(deliverySpeed(0.92, "That changes the result.", "close", true) < deliverySpeed(0.92, "That changes the result.", "system"));
  assert.ok(pauseAfter("A payment arrives.", "It goes to the seller.", 12) < pauseAfter("A payment arrives.", "But the rules change.", 12));
});

test("trimming keeps quiet opening consonants and release tails", () => {
  const buf = new Float32Array(24000);
  buf.fill(0.002, 6000, 7200);
  buf.fill(0.1, 7200, 14400);
  buf.fill(0.002, 14400, 15600);
  const trimmed = trimSpeech(buf);
  assert.ok(trimmed.length < buf.length);
  assert.equal(trimmed.filter((v) => v === Math.fround(0.002)).length, 2400);
});

test("every scene still has unique narration anchors after the spoken edit", async () => {
  for (const n of [1, 2, 3, 4, 5]) {
    const ep = (await import(`../src/episodes/ep${n}.mjs`)).default;
    for (const scene of ep.scenes) {
      const sentences = splitSentences(scene.narration).map((text, i) => ({ text, start: i * 3, end: i * 3 + 2.5 }));
      const clock = makeBeats({ sentences }, 0, sentences.length * 3);
      for (const m of scene.draw.toString().matchAll(/S\.(?:at|start|end)\("([^"]+)"/g)) {
        assert.doesNotThrow(() => clock.at(m[1]), `episode ${n}, ${scene.title}, ${m[1]}`);
      }
      assert.doesNotThrow(() => scene.draw(clock), `episode ${n}, ${scene.title}`);
    }
  }
});
