// Sound-effect event recorder. Drawing helpers report what they put on screen
// (a stamp lands, a caption types, a tag appears...). In normal rendering this is
// off and costs nothing; `render.mjs --events` turns it on and walks every scene to
// build the effects cue list that src/sfx.mjs turns into audio.
export const rec = { on: false, scene: 0, t: 0, events: [], seen: new Set() };

export function reset() {
  rec.events = [];
  rec.seen = new Set();
}

// An event with an explicit start time (scene-relative).
export function at(kind, t0, key = "", props = {}) {
  if (!rec.on) return;
  const id = `${rec.scene}|${kind}|${key}|${Math.round(t0 * 10)}`;
  if (rec.seen.has(id)) return;
  rec.seen.add(id);
  rec.events.push({ scene: rec.scene, kind, t: t0, key, ...props });
}

// An element becoming visible: logged the first frame its alpha rises above 5%.
export function appear(kind, key, alpha, props = {}) {
  if (!rec.on || !(alpha > 0.05)) return;
  const id = `${rec.scene}|${kind}|${key}`;
  if (rec.seen.has(id)) return;
  rec.seen.add(id);
  rec.events.push({ scene: rec.scene, kind, t: rec.t, key, ...props });
}
