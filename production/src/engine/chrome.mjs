// Channel chrome: title card, frame overlay, film grain, and lecturer cards.
import { C, W, H, canvas, clamp, ease, lerp, prog, rgba, rng } from "./core.mjs";
import { brackets, measure, roundRect, text, typed } from "./draw.mjs";

// ---------------------------------------------------------------- grain + vignette (prebuilt)
const GRAIN = [];
{
  const r = rng(99);
  for (let k = 0; k < 6; k++) {
    const c = canvas(W / 2, H / 2);
    const x = c.getContext("2d");
    const img = x.createImageData(W / 2, H / 2);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.floor(r() * 255);
      img.data[i] = v;
      img.data[i + 1] = v;
      img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    x.putImageData(img, 0, 0);
    GRAIN.push(c);
  }
}

// Vignette built per pixel with ±1.5 levels of baked noise: smooth radial falloffs in
// dark 8-bit video otherwise show up as concentric bands.
const VIGNETTE = (() => {
  const c = canvas(W, H);
  const x = c.getContext("2d");
  const img = x.createImageData(W, H);
  const r = rng(7);
  const r0 = H * 0.32;
  const r1 = H * 1.02;
  for (let py = 0; py < H; py++) {
    for (let px = 0; px < W; px++) {
      const d = Math.hypot(px - W / 2, py - H / 2);
      const u = Math.min(1, Math.max(0, (d - r0) / (r1 - r0)));
      const a = 0.72 * u * u * (3 - 2 * u) * 255 + (r() - 0.5) * 3;
      const k = (py * W + px) * 4;
      img.data[k + 3] = Math.max(0, Math.min(255, Math.round(a)));
    }
  }
  x.putImageData(img, 0, 0);
  return c;
})();

// Full-resolution dither (~±1 level) applied last, so dark gradients don't band.
const DITHER = (() => {
  const r = rng(31337);
  return [0, 1, 2].map(() => {
    const c = canvas(W, H);
    const x = c.getContext("2d");
    const img = x.createImageData(W, H);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.floor(r() * 256);
      img.data[i] = v;
      img.data[i + 1] = v;
      img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    x.putImageData(img, 0, 0);
    return c;
  });
})();

export function finish(ctx, frame) {
  ctx.drawImage(VIGNETTE, 0, 0);
  ctx.save();
  ctx.globalAlpha = 0.055;
  ctx.globalCompositeOperation = "overlay";
  ctx.drawImage(GRAIN[frame % GRAIN.length], 0, 0, W, H);
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 0.009;
  ctx.drawImage(DITHER[frame % DITHER.length], 0, 0);
  ctx.restore();
}

// ---------------------------------------------------------------- atlas glyph
export function glyph(ctx, x, y, r, color = C.cyan, alpha = 1) {
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1.2, r * 0.12);
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(x, y, r * 0.42, r, 0, 0, Math.PI * 2);
  ctx.moveTo(x - r, y);
  ctx.lineTo(x + r, y);
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x + r * 0.42, y - r * 0.42, r * 0.16, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// ---------------------------------------------------------------- title card
// Faint wireframe globe turning behind the wordmark.
function wireGlobe(ctx, cx, cy, r, rot, alpha) {
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.strokeStyle = rgba(C.cyan, 0.5);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = rgba(C.cyan, 0.22);
  for (let k = 0; k < 12; k++) {
    const a = rot + (k * Math.PI) / 12;
    const w = Math.abs(Math.cos(a)) * r;
    ctx.beginPath();
    ctx.ellipse(cx, cy, Math.max(0.5, w), r, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  for (let k = -4; k <= 4; k++) {
    const yy = (k / 5) * r;
    const ww = Math.sqrt(Math.max(0, r * r - yy * yy));
    ctx.beginPath();
    ctx.ellipse(cx, cy + yy, ww, ww * 0.06, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

export function titleCard(ctx, t, ep) {
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, H);
  const g = ctx.createRadialGradient(W / 2, 470, 40, W / 2, 470, 900);
  g.addColorStop(0, "rgba(25,211,255,0.06)");
  g.addColorStop(1, "rgba(25,211,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  wireGlobe(ctx, W / 2, 470, 330, t * 0.35, 0.22 * prog(t, 0, 1.2, ease.out));

  const a1 = prog(t, 0.05, 0.7, ease.out);
  const track = lerp(16, 24, prog(t, 0, 3, ease.out));
  glyph(ctx, W / 2, 360, 22, C.cyan, a1);
  text(ctx, "PREDICTIVE ATLAS", W / 2, 470, { size: 72, weight: 600, tracking: track, align: "center", alpha: a1 });
  // light sweep across the wordmark
  const sw = lerp(-500, W + 500, prog(t, 0.35, 1.6, ease.inOut));
  ctx.save();
  ctx.beginPath();
  ctx.rect(sw - 120, 380, 240, 120);
  ctx.clip();
  text(ctx, "PREDICTIVE ATLAS", W / 2, 470, { size: 72, weight: 600, tracking: track, align: "center", alpha: a1 * 0.9, color: "#ffffff", glow: 24 });
  ctx.restore();

  const rw = 520 * prog(t, 0.5, 0.8, ease.out);
  ctx.fillStyle = rgba(C.cyan, 0.8);
  ctx.fillRect(W / 2 - rw / 2, 512, rw, 2);
  const a2 = prog(t, 1.0, 0.7, ease.out);
  text(ctx, `EPISODE ${ep.n} OF 5`, W / 2, 566, { kind: "mono", size: 18, tracking: 6, align: "center", color: C.dim, alpha: a2 });
  text(ctx, ep.title, W / 2, 640, { size: 46, weight: 600, tracking: 7, align: "center", alpha: a2, caps: true });
  text(ctx, ep.subtitle, W / 2, 690, { size: 24, weight: 500, tracking: 5, align: "center", color: C.mid, alpha: prog(t, 1.4, 0.7, ease.out), caps: true });
  text(ctx, "POWER · MONEY · WHAT COMES NEXT", W / 2, 960, { kind: "mono", size: 13, tracking: 4, align: "center", color: C.dim, alpha: prog(t, 1.8, 0.8, ease.out) });
  brackets(ctx, 56, 56, W - 112, H - 112, { color: C.faint, len: 26, alpha: a1 });
}

// ---------------------------------------------------------------- frame overlay
export function overlay(ctx, { ep, sceneIndex, sceneCount, T, total, title, since = 99 }) {
  brackets(ctx, 40, 40, W - 80, H - 80, { color: rgba(C.mid, 0.35), len: 22, lw: 1.2 });
  glyph(ctx, 82, 78, 10, C.cyan, 0.85);
  text(ctx, "PREDICTIVE ATLAS", 104, 85, { size: 18, weight: 600, tracking: 5, alpha: 0.82 });
  // second line: episode + scene slug; the slug types in at the head of each scene
  const head = `EP ${String(ep.n).padStart(2, "0")} · ${String(sceneIndex + 1).padStart(2, "0")} · `;
  const slug = title ?? ep.short;
  const typed = slug.slice(0, Math.floor(slug.length * clamp((since - 0.2) / 0.9)));
  const fresh = 1 - clamp((since - 5) / 1.5);
  const hw = text(ctx, head, 104, 108, { kind: "mono", size: 12, tracking: 2.5, color: C.dim, alpha: 0.9, caps: true });
  text(ctx, typed, 104 + hw + 2.5, 108, { kind: "mono", size: 12, tracking: 2.5, color: fresh > 0.5 ? C.ice : C.dim, alpha: 0.9, caps: true });
  const s = `${String(sceneIndex + 1).padStart(2, "0")} / ${String(sceneCount).padStart(2, "0")}`;
  text(ctx, s, W - 70, 85, { kind: "mono", size: 14, tracking: 2, color: C.mid, align: "right", alpha: 0.8 });
  const pw = 150;
  ctx.fillStyle = rgba(C.mid, 0.16);
  ctx.fillRect(W - 70 - pw, 98, pw, 2);
  ctx.fillStyle = rgba(C.cyan, 0.8);
  ctx.fillRect(W - 70 - pw, 98, pw * clamp(T / total), 2);
}

// ---------------------------------------------------------------- lecturers
// Faceless on purpose. A small figure and a blackboard, not a portrait.
export const LENSES = {
  M: { re: /Mearsheimer/, name: "JOHN MEARSHEIMER", short: "MEARSHEIMER", board: ["POWER, NOT PROMISES", "PLAN FOR THE WORST"], color: "#dfe7ef" },
  S: { re: /Sachs/, name: "JEFFREY SACHS", short: "SACHS", board: ["WHO BUILT THE RULES", "AND WHO PAYS"], color: C.violet },
  J: { re: /Jiang/, name: "PROFESSOR JIANG", short: "JIANG", board: ["THE NEXT MOVE", "AND WHAT IT COSTS"], color: C.green },
};

const LECTURE_W = 508;
const LECTURE_H = 168;

// One card per mention. A later mention of the same person extends the card instead of stacking a copy.
export function lensEvents(timing, scenes) {
  const ev = [];
  const seen = new Set();
  timing.paragraphs.forEach((p, i) => {
    if (scenes[i]?.noBadges) return;
    for (const s of p.sentences) {
      for (const [k, L] of Object.entries(LENSES)) {
        if (!L.re.test(s.text)) continue;
        ev.push({ key: k, t: s.start, full: !seen.has(k) });
        seen.add(k);
      }
    }
  });
  return ev;
}

function lectureWindows(events) {
  const wins = [];
  for (const e of events) {
    const span = e.full ? 8.2 : 6.6;
    let prev = null;
    for (let i = wins.length - 1; i >= 0; i--) {
      if (wins[i].key === e.key) {
        prev = wins[i];
        break;
      }
    }
    if (prev && e.t <= prev.end + 0.4) prev.end = Math.max(prev.end, e.t + span);
    else wins.push({ key: e.key, t: e.t, end: e.t + span, full: e.full });
  }
  return wins;
}

function hair(ctx, key, hx, hy) {
  ctx.beginPath();
  if (key === "M") {
    ctx.moveTo(hx - 12, hy - 2);
    ctx.quadraticCurveTo(hx - 10, hy - 18, hx + 2, hy - 17);
    ctx.quadraticCurveTo(hx + 12, hy - 15, hx + 13, hy - 2);
  } else if (key === "S") {
    ctx.moveTo(hx - 13, hy);
    for (let i = 0; i <= 5; i++) {
      const a = Math.PI + (i / 5) * Math.PI;
      ctx.lineTo(hx + Math.cos(a) * 13, hy - 2 + Math.sin(a) * (12 + (i % 2) * 2));
    }
  } else {
    ctx.ellipse(hx, hy - 8, 12, 8, 0, Math.PI, Math.PI * 2);
  }
  ctx.stroke();
}

function glasses(ctx, key, hx, hy) {
  if (key === "S") {
    ctx.strokeRect(hx - 11, hy - 3, 8, 6);
    ctx.strokeRect(hx + 3, hy - 3, 8, 6);
    ctx.beginPath();
    ctx.moveTo(hx - 3, hy);
    ctx.lineTo(hx + 3, hy);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.arc(hx - 5, hy, 4.2, 0, Math.PI * 2);
    ctx.moveTo(hx + 5 + 4.2, hy);
    ctx.arc(hx + 5, hy, 4.2, 0, Math.PI * 2);
    ctx.moveTo(hx - 1, hy);
    ctx.lineTo(hx + 1, hy);
    ctx.stroke();
  }
}

// A standing figure, arm out toward the board. No face, so it cannot be a likeness.
function figure(ctx, key, x, foot, color, reach, aimY) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = rgba(color, 0.18);
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(x - 7, foot - 42);
  ctx.lineTo(x - 11, foot);
  ctx.moveTo(x + 6, foot - 42);
  ctx.lineTo(x + 12, foot);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x - 16, foot - 44);
  ctx.lineTo(x - 18, foot - 86);
  ctx.quadraticCurveTo(x, foot - 94, x + 16, foot - 86);
  ctx.lineTo(x + 14, foot - 44);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  const hx = x;
  const hy = foot - 104;
  ctx.beginPath();
  ctx.ellipse(hx, hy, 13, 15, 0, 0, Math.PI * 2);
  ctx.fillStyle = rgba(color, 0.28);
  ctx.fill();
  ctx.stroke();
  hair(ctx, key, hx, hy);
  glasses(ctx, key, hx, hy);
  const shoulder = [x + 14, foot - 78];
  const hand = [lerp(shoulder[0], x + 78, reach), lerp(shoulder[1], aimY, reach)];
  ctx.beginPath();
  ctx.moveTo(shoulder[0], shoulder[1]);
  ctx.lineTo(hand[0], hand[1]);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(hand[0], hand[1]);
  ctx.lineTo(hand[0] + 16 * reach, hand[1] - 1);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(hand[0], hand[1], 3, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

function lectureCard(ctx, win, T, alpha) {
  const L = LENSES[win.key];
  const sway = Math.sin((T - win.t) * 1.7) * 1.3;
  const reach = prog(T, win.t + 0.15, 0.45, ease.out);
  const bx = 128;
  const by = 14;
  const bw = 356;
  const bh = 118;
  const aimY = by + 36 + Math.sin((T - win.t) * 2.2) * 7;
  ctx.save();
  ctx.translate(0, sway);
  roundRect(ctx, bx - 7, by - 7, bw + 14, bh + 14, 4);
  ctx.fillStyle = "#6b5138";
  ctx.fill();
  roundRect(ctx, bx, by, bw, bh, 2);
  ctx.fillStyle = "#163028";
  ctx.fill();
  ctx.strokeStyle = rgba("#d7c4a1", 0.45);
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.fillStyle = rgba("#0c1a14", 0.45);
  ctx.fillRect(bx + 8, by + bh - 16, bw - 16, 5);
  L.board.forEach((line, i) => {
    const p = prog(T, win.t + 0.4 + i * 0.7, 0.85, ease.linear);
    const shown = typed(line, p);
    text(ctx, shown, bx + 18, by + 40 + i * 32, { kind: "mono", size: 16, color: "#e7f6ea", tracking: 1.1 });
    if (p > 0.02 && p < 0.98) {
      const tw = measure(ctx, shown, { kind: "mono", size: 16, tracking: 1.1 });
      ctx.fillStyle = "#f4fff6";
      ctx.fillRect(bx + 18 + tw + 2, by + 28 + i * 32, 7, 3);
    }
  });
  text(ctx, L.short, bx + 18, by + bh - 8, { kind: "mono", size: 11, color: L.color, tracking: 1.6 });
  figure(ctx, win.key, 58, 146, L.color, reach, aimY);
  ctx.restore();
}

export function badges(ctx, T, events) {
  const live = lectureWindows(events).filter((w) => T >= w.t - 0.1 && T < w.end + 0.6);
  live.forEach((w, slot) => {
    const a = prog(T, w.t, 0.4, ease.out) * (1 - prog(T, w.end, 0.5));
    if (a <= 0) return;
    const slide = (1 - prog(T, w.t, 0.5, ease.out)) * 28;
    const x = W - 36 - LECTURE_W + slide;
    const y = H - 32 - LECTURE_H - slot * (LECTURE_H + 12);
    ctx.save();
    ctx.globalAlpha *= a;
    ctx.translate(x, y);
    roundRect(ctx, 0, 0, LECTURE_W, LECTURE_H, 8);
    ctx.fillStyle = rgba("#07090c", 0.9);
    ctx.fill();
    ctx.strokeStyle = rgba(LENSES[w.key].color, 0.4);
    ctx.lineWidth = 1;
    ctx.stroke();
    lectureCard(ctx, w, T, a);
    ctx.restore();
  });
}

export { measure };
