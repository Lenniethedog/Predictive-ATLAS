// Credited photographic cutaways, timed to the object named in the narration.
import fs from "node:fs";
import path from "node:path";
import { loadImage } from "@napi-rs/canvas";
import { ROOT } from "../config.mjs";
import { W, H, clamp, smooth } from "./core.mjs";
import { text } from "./draw.mjs";

export const PHOTO_DURATION = 3.2;
export const PHOTO_FADE = 0.65;
export const photoFiles = (n) => (INSERTS[n] ?? []).map((s) => path.join(ROOT, "assets/broll", s.file));

export const INSERTS = {
  1: [
    { phrase: "oil that feeds", file: "tanker-maracaibo.jpg", label: "CRUDE TANKER", credit: "Wilfredor, CC0" },
    { phrase: "United States Treasury", file: "treasury-highsmith.jpg", label: "U.S. TREASURY", credit: "Carol M. Highsmith, public domain" },
    { phrase: "Chinese goods", file: "yangshan-containers.jpg", label: "A CHINESE PORT", credit: "Reb42, CC BY 3.0" },
  ],
  2: [
    { phrase: "Either result has to deal with the capital", file: "kyiv-dnieper.jpg", label: "KYIV · CITY VIEW", credit: "Vvlasenko, CC BY 4.0" },
  ],
  3: [
    { phrase: "ships that feed", file: "tanker-maracaibo.jpg", label: "CRUDE TANKER", credit: "Wilfredor, CC0" },
  ],
  4: [
    { phrase: "moved by pipe", file: "gas-pipeline.jpg", label: "A GAS PIPELINE STATION", credit: "Mbrickn, CC BY 4.0" },
    { phrase: "Seaborne liquefied", file: "lng-terminal.jpg", label: "AN LNG TERMINAL", credit: "Sigma64, CC BY 3.0" },
  ],
  5: [
    { phrase: "Cleanrooms are a promise", file: "cleanroom.jpg", label: "CLEANROOM · JEFFERSON LAB", credit: "Aileen Devlin, Jefferson Lab, public domain" },
  ],
};


export function photoShots(n, timing) {
  const shots = (INSERTS[n] ?? []).map((shot) => {
    const sentence = timing.paragraphs.flatMap((p) => p.sentences)
      .find((s) => s.text.toLowerCase().includes(shot.phrase.toLowerCase()));
    if (!sentence) throw new Error(`ep${n}: photo anchor missing: ${shot.phrase}`);
    const fraction = sentence.text.toLowerCase().indexOf(shot.phrase.toLowerCase()) / sentence.text.length;
    const start = sentence.start + fraction * (sentence.end - sentence.start);
    const file = path.join(ROOT, "assets/broll", shot.file);
    if (!fs.existsSync(file)) throw new Error(`ep${n}: photo missing: ${file}`);
    if (start < timing.titleCard || start + PHOTO_DURATION > timing.total) {
      throw new Error(`ep${n}: photo falls outside the film: ${shot.label}`);
    }
    return { ...shot, start, file };
  }).sort((a, b) => a.start - b.start);
  for (let i = 1; i < shots.length; i++) {
    if (shots[i].start < shots[i - 1].start + PHOTO_DURATION) {
      throw new Error(`ep${n}: photo cutaways overlap: ${shots[i].label}`);
    }
  }
  return shots;
}

export async function loadPhotos(n, timing) {
  return Promise.all(photoShots(n, timing).map(async (shot) => ({
    ...shot, image: await loadImage(shot.file),
  })));
}

// The picture settles from a closer crop, then pushes through a soft dissolve.
// Rotation is deliberately small; captions stay level while the photograph moves.
export function photoMotion(t) {
  const enter = 1 - Math.pow(1 - clamp(t / PHOTO_FADE), 3);
  const leave = smooth(clamp((t - PHOTO_DURATION + PHOTO_FADE) / PHOTO_FADE));
  const travel = smooth(clamp(t / PHOTO_DURATION));
  return {
    alpha: smooth(clamp(t / PHOTO_FADE)) * (1 - leave),
    zoom: 1.025 + 0.035 * travel + 0.135 * (1 - enter) + 0.16 * leave,
    angle: (-0.9 * (1 - enter) + 1.2 * leave) * Math.PI / 180,
    x: -24 * (1 - enter) + 30 * leave,
    blur: 7 * (1 - enter) + 9 * leave,
    captionAlpha: smooth(clamp((t - 0.18) / 0.35)) * (1 - smooth(clamp((t - PHOTO_DURATION + 0.75) / 0.4))),
  };
}

export function drawPhotos(ctx, shots, T) {
  for (const shot of shots) {
    const t = T - shot.start;
    if (t < 0 || t >= PHOTO_DURATION) continue;
    const motion = photoMotion(t);
    ctx.save();
    ctx.globalAlpha *= motion.alpha;
    ctx.save();
    ctx.translate(W / 2 + motion.x, H / 2);
    ctx.rotate(motion.angle);
    // Cover the entire viewport even while tilted, panned, and blurred.
    const c = Math.abs(Math.cos(motion.angle)), s = Math.abs(Math.sin(motion.angle));
    const margin = 2 * (Math.abs(motion.x) + motion.blur * 3);
    const scale = Math.max((W * c + H * s + margin) / shot.image.width,
      (H * c + W * s + margin) / shot.image.height) * motion.zoom;
    const w = shot.image.width * scale;
    const h = shot.image.height * scale;
    if (motion.blur > 0.05) ctx.filter = `blur(${motion.blur.toFixed(2)}px)`;
    ctx.drawImage(shot.image, -w / 2, -h / 2, w, h);
    ctx.restore();
    ctx.fillStyle = "rgba(6,8,12,0.15)";
    ctx.fillRect(0, 0, W, H);
    const shade = ctx.createLinearGradient(0, H - 240, 0, H);
    shade.addColorStop(0, "rgba(6,8,12,0)");
    shade.addColorStop(1, "rgba(6,8,12,0.92)");
    ctx.fillStyle = shade;
    ctx.fillRect(0, H - 240, W, 240);
    ctx.globalAlpha *= motion.captionAlpha;
    text(ctx, shot.label, 72, H - 108, { size: 32, weight: 600, tracking: 3 });
    text(ctx, shot.credit, 72, H - 68, { kind: "mono", size: 16, tracking: 1.2 });
    ctx.restore();
  }
}
