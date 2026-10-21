// One episode record: spoken paragraph, visual cue, score mood, and drawing.
// scripts/episode-0N-*.txt are generated from this. They are not a second source.

export const MOODS = ["establish", "history", "system", "pressure", "shock", "motion", "cold", "fracture", "close"];

// Pad chord for each mood. close stays unresolved.
export const MOOD_CHORD = {
  establish: "i",
  history: "VI",
  system: "III",
  pressure: "iv",
  shock: "VII",
  motion: "v",
  cold: "i",
  fracture: "VI",
  close: "sus",
};

export const HEARTBEAT = new Set(["pressure", "shock", "fracture"]);

export function scenesOf(ep) {
  if (!ep?.scenes?.length) throw new Error("episode has no scenes");
  return ep.scenes.map((scene, i) => {
    if (typeof scene === "function") {
      return { title: ep.titles?.[i] ?? "", narration: "", cue: "", mood: "establish", draw: scene };
    }
    return scene;
  });
}

export function spokenWords(scenes) {
  return scenes.reduce((n, s) => n + String(s.narration ?? "").split(/\s+/).filter(Boolean).length, 0);
}

export function assertEpisode(ep, n) {
  const scenes = scenesOf(ep);
  const problems = [];
  scenes.forEach((s, i) => {
    const where = `episode ${n} scene ${i + 1} (${s.title || "untitled"})`;
    if (typeof s.draw !== "function") problems.push(`${where} has no drawing`);
    if (!s.title?.trim()) problems.push(`${where} has no title`);
    if (!s.narration?.trim()) problems.push(`${where} has no narration`);
    if (!String(s.cue ?? "").startsWith("[VISUAL:")) problems.push(`${where} cue is not a visual direction`);
    if (!MOODS.includes(s.mood)) problems.push(`${where} mood "${s.mood}" is outside ${MOODS.join(", ")}`);
    if (String(s.narration).includes("[")) problems.push(`${where} narration contains a cue bracket`);
  });
  const words = spokenWords(scenes);
  if (words < 1200 || words > 1800) problems.push(`episode ${n} has ${words} spoken words; expected 1,200–1,800 for this format`);
  const seen = new Set();
  for (const s of scenes) {
    if (seen.has(s.title)) problems.push(`episode ${n} repeats the scene title "${s.title}"`);
    seen.add(s.title);
  }
  if (problems.length) throw new Error(problems.join("\n"));
  return scenes;
}
