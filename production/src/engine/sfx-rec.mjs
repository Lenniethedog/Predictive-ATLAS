// Sound-effect event recorder. Drawing helpers report what they put on screen
// (a stamp lands, a caption types, a tag appears...). In normal rendering this is
// off and costs nothing; `render.mjs --events` turns it on and walks every scene to
// build the effects cue list that src/sfx.mjs turns into audio.
export const rec = { on: false, freeze: false, scene: 0, t: 0, events: [], seen: new Set(), frameHits: new Set() };

export function reset() {
  rec.events = [];
  rec.seen = new Set();
  rec.frameHits = new Set();
  rec.freeze = false;
}

export function beginFrame() {
  rec.frameHits = new Set();
}

// Stable id for a drawing call that has no title, taken from the episode line that drew it.
export function siteKey(kind) {
  const old = Error.prepareStackTrace;
  Error.prepareStackTrace = (_, frames) => frames;
  const err = new Error();
  Error.captureStackTrace(err, siteKey);
  const frames = err.stack;
  Error.prepareStackTrace = old;
  if (!Array.isArray(frames)) return kind;
  for (const frame of frames) {
    const file = frame.getFileName() || "";
    if (file.includes("/episodes/ep")) return `${kind}@${frame.getLineNumber()}`;
  }
  return kind;
}

// An event with an explicit start time (scene-relative). `freeze` probes must not record.
export function at(kind, t0, key = "", props = {}) {
  if (!rec.on || rec.freeze) return;
  const id = `${rec.scene}|${kind}|${key}|${Math.round(t0 * 20)}`;
  if (rec.seen.has(id)) return;
  rec.seen.add(id);
  rec.events.push({ scene: rec.scene, kind, t: t0, key, explicit: true, ...props });
}

// An element becoming visible: logged the first frame its alpha rises above 5%.
// frameHits still updates while frozen, so onset search can see the element.
export function appear(kind, key, alpha, props = {}) {
  if (!rec.on || !(alpha > 0.05)) return;
  const id = `${rec.scene}|${kind}|${key}`;
  rec.frameHits.add(id);
  if (rec.freeze || rec.seen.has(id)) return;
  rec.seen.add(id);
  rec.events.push({ scene: rec.scene, kind, t: rec.t, key, ...props });
}
