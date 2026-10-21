// Check the pauses actually present in a saved read before adopting its audio.
// Speed and synthesis fingerprints alone do not cover changes in config.mjs.
export function timingMatchesPolicy(timing, policy) {
  const near = (a, b) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) < 0.001;
  const paragraphs = timing.paragraphs;
  if (!paragraphs?.length || !Number.isInteger(timing.episode)) return false;
  if (!near(timing.titleCard, policy.titleCard) || !near(paragraphs[0].start, policy.titleCard)) return false;
  if (!near(timing.total - paragraphs.at(-1).end, policy.tail)) return false;
  for (let p = 0; p < paragraphs.length - 1; p++) {
    const para = paragraphs[p];
    const r = Math.abs((Math.sin((timing.episode * 100 + p) * 78.233) * 43758.5453) % 1);
    const expected = policy.paragraphGap + (r - 0.5) * 0.4 + Math.min(0.3, (para.end - para.start) / 200);
    if (!near(paragraphs[p + 1].start - para.end, expected)) return false;
  }
  return true;
}
