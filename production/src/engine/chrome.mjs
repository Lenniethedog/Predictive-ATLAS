// Channel chrome: title card, frame overlay, film grain, and thinker "lens badges".
import { C, W, H, canvas, clamp, ease, lerp, prog, rgba, rng } from "./core.mjs";
import { brackets, measure, roundRect, text } from "./draw.mjs";

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

const VIGNETTE = (() => {
  const c = canvas(W, H);
  const x = c.getContext("2d");
  const g = x.createRadialGradient(W / 2, H / 2, H * 0.32, W / 2, H / 2, H * 1.02);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, "rgba(0,0,0,0.72)");
  x.fillStyle = g;
  x.fillRect(0, 0, W, H);
  return c;
})();

export function finish(ctx, frame) {
  ctx.drawImage(VIGNETTE, 0, 0);
  ctx.save();
  ctx.globalAlpha = 0.045;
  ctx.globalCompositeOperation = "overlay";
  ctx.drawImage(GRAIN[frame % GRAIN.length], 0, 0, W, H);
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
export function titleCard(ctx, t, ep) {
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, H);
  const a1 = prog(t, 0.05, 0.7, ease.out);
  const track = lerp(18, 24, prog(t, 0, 3, ease.out));
  glyph(ctx, W / 2, 360, 22, C.cyan, a1);
  text(ctx, "PREDICTIVE ATLAS", W / 2, 470, { size: 72, weight: 600, tracking: track, align: "center", alpha: a1 });
  const rw = 520 * prog(t, 0.5, 0.8, ease.out);
  ctx.fillStyle = rgba(C.cyan, 0.8);
  ctx.fillRect(W / 2 - rw / 2, 512, rw, 2);
  const a2 = prog(t, 1.0, 0.7, ease.out);
  text(ctx, `EPISODE ${ep.n} OF 5`, W / 2, 566, { kind: "mono", size: 18, tracking: 6, align: "center", color: C.dim, alpha: a2 });
  text(ctx, ep.title, W / 2, 640, { size: 46, weight: 600, tracking: 7, align: "center", alpha: a2, caps: true });
  text(ctx, ep.subtitle, W / 2, 690, { size: 24, weight: 500, tracking: 5, align: "center", color: C.mid, alpha: prog(t, 1.4, 0.7, ease.out), caps: true });
  brackets(ctx, 56, 56, W - 112, H - 112, { color: C.faint, len: 26, alpha: a1 });
}

// ---------------------------------------------------------------- frame overlay
export function overlay(ctx, { ep, sceneIndex, sceneCount, T, total }) {
  brackets(ctx, 40, 40, W - 80, H - 80, { color: rgba(C.mid, 0.35), len: 22, lw: 1.2 });
  glyph(ctx, 82, 78, 10, C.cyan, 0.85);
  text(ctx, "PREDICTIVE ATLAS", 104, 85, { size: 18, weight: 600, tracking: 5, alpha: 0.82 });
  text(ctx, `EP ${String(ep.n).padStart(2, "0")} · ${ep.short}`, 104, 108, { kind: "mono", size: 12, tracking: 2.5, color: C.dim, alpha: 0.9, caps: true });
  const s = `${String(sceneIndex + 1).padStart(2, "0")} / ${String(sceneCount).padStart(2, "0")}`;
  text(ctx, s, W - 70, 85, { kind: "mono", size: 14, tracking: 2, color: C.mid, align: "right", alpha: 0.8 });
  const pw = 150;
  ctx.fillStyle = rgba(C.mid, 0.16);
  ctx.fillRect(W - 70 - pw, 98, pw, 2);
  ctx.fillStyle = rgba(C.cyan, 0.8);
  ctx.fillRect(W - 70 - pw, 98, pw * clamp(T / total), 2);
}

// ---------------------------------------------------------------- lens badges
export const LENSES = {
  M: { re: /Mearsheimer/, name: "JOHN MEARSHEIMER", school: "OFFENSIVE REALISM", color: "#dfe7ef" },
  S: { re: /Sachs/, name: "JEFFREY SACHS", school: "ANTI-IMPERIAL INSTITUTIONALISM", color: C.violet },
  J: { re: /Jiang/, name: "PROFESSOR JIANG", school: "PREDICTIVE GAME THEORY", color: C.green },
};

// Minimalist, faceless vector busts. Deliberately not likenesses.
export function avatar(ctx, key, x, y, r, alpha = 1) {
  const L = LENSES[key];
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = "#151a22";
  ctx.fill();
  ctx.clip();
  const col = L.color;
  const hx = x;
  const hy = y - r * 0.12;
  const hr = r * 0.34;
  // shoulders
  ctx.fillStyle = rgba(col, 0.22);
  ctx.beginPath();
  ctx.ellipse(x, y + r * 0.95, r * 0.78, r * 0.62, 0, Math.PI, 0);
  ctx.fill();
  // head
  ctx.fillStyle = rgba(col, 0.32);
  ctx.beginPath();
  ctx.ellipse(hx, hy, hr * 0.86, hr, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = col;
  ctx.lineWidth = Math.max(1.5, r * 0.045);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (key === "M") {
    // side-parted short hair, suit lapels + tie
    ctx.beginPath();
    ctx.moveTo(hx - hr * 0.86, hy - hr * 0.1);
    ctx.quadraticCurveTo(hx - hr * 0.8, hy - hr * 1.05, hx + hr * 0.1, hy - hr * 1.02);
    ctx.quadraticCurveTo(hx + hr * 0.8, hy - hr * 0.95, hx + hr * 0.86, hy - hr * 0.2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(hx - hr * 0.25, hy - hr * 1.0);
    ctx.lineTo(hx - hr * 0.15, hy - hr * 0.7);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x - r * 0.3, y + r * 0.38);
    ctx.lineTo(x, y + r * 0.72);
    ctx.lineTo(x + r * 0.3, y + r * 0.38);
    ctx.stroke();
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(x, y + r * 0.42);
    ctx.lineTo(x + r * 0.06, y + r * 0.66);
    ctx.lineTo(x, y + r * 0.78);
    ctx.lineTo(x - r * 0.06, y + r * 0.66);
    ctx.closePath();
    ctx.fill();
  } else if (key === "S") {
    // fuller hair crown, open collar
    ctx.beginPath();
    ctx.moveTo(hx - hr * 0.9, hy);
    for (let i = 0; i <= 6; i++) {
      const a = Math.PI + (i / 6) * Math.PI;
      const rr = hr * (1.08 + (i % 2) * 0.1);
      ctx.lineTo(hx + Math.cos(a) * rr * 0.92, hy - hr * 0.05 + Math.sin(a) * rr);
    }
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x - r * 0.22, y + r * 0.4);
    ctx.lineTo(x, y + r * 0.6);
    ctx.lineTo(x + r * 0.22, y + r * 0.4);
    ctx.stroke();
  } else {
    // short cropped hair, crew neck
    ctx.beginPath();
    ctx.ellipse(hx, hy - hr * 0.35, hr * 0.88, hr * 0.68, 0, Math.PI * 1.05, Math.PI * 1.95);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(x, y + r * 0.42, r * 0.2, r * 0.07, 0, 0, Math.PI);
    ctx.stroke();
  }
  // glasses (all three) — a single geometric accent, no facial features
  ctx.lineWidth = Math.max(1.2, r * 0.035);
  const gy = hy + hr * 0.05;
  const gw = hr * 0.3;
  if (key === "S") {
    ctx.strokeRect(hx - gw * 1.25, gy - gw * 0.35, gw, gw * 0.7);
    ctx.strokeRect(hx + gw * 0.25, gy - gw * 0.35, gw, gw * 0.7);
  } else {
    ctx.beginPath();
    ctx.arc(hx - gw * 0.72, gy, gw * 0.45, 0, Math.PI * 2);
    ctx.moveTo(hx + gw * 0.72 + gw * 0.45, gy);
    ctx.arc(hx + gw * 0.72, gy, gw * 0.45, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(hx - gw * 0.27, gy);
  ctx.lineTo(hx + gw * 0.27, gy);
  ctx.stroke();
  ctx.restore();
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.strokeStyle = rgba(col, 0.75);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

// Build badge events from the episode's sentence timings.
export function lensEvents(timing, scenes) {
  const ev = [];
  const seen = new Set();
  timing.paragraphs.forEach((p, i) => {
    if (scenes[i]?.noBadges) return;
    const shown = new Set();
    for (const s of p.sentences) {
      for (const [k, L] of Object.entries(LENSES)) {
        if (shown.has(k) || !L.re.test(s.text)) continue;
        shown.add(k);
        ev.push({ key: k, t: s.start, full: !seen.has(k) });
        seen.add(k);
      }
    }
  });
  return ev;
}

const BADGE_DUR = 5.5;

export function badges(ctx, T, events) {
  const live = events.filter((e) => T >= e.t - 0.1 && T < e.t + BADGE_DUR + 0.6);
  live.forEach((e, slot) => {
    const L = LENSES[e.key];
    const a = prog(T, e.t, 0.5, ease.out) * (1 - prog(T, e.t + BADGE_DUR, 0.6));
    if (a <= 0) return;
    const slide = (1 - prog(T, e.t, 0.6, ease.out)) * 30;
    const big = e.full;
    const r = big ? 40 : 26;
    const w = big ? 470 : 360;
    const h = big ? 104 : 70;
    const x = W - 70 - w + slide;
    const y = H - 70 - h - slot * (h + 14);
    ctx.save();
    ctx.globalAlpha *= a;
    roundRect(ctx, x, y, w, h, 6);
    ctx.fillStyle = rgba("#0b0e13", 0.86);
    ctx.fill();
    ctx.strokeStyle = rgba(L.color, 0.45);
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = L.color;
    ctx.fillRect(x, y + 10, 3, h - 20);
    avatar(ctx, e.key, x + 22 + r, y + h / 2, r);
    const tx = x + 22 + 2 * r + 20;
    if (big) {
      text(ctx, "LENS", tx, y + 30, { kind: "mono", size: 12, tracking: 3, color: C.dim });
      text(ctx, L.name, tx, y + 62, { size: 26, weight: 600, tracking: 3, color: C.ice });
      text(ctx, L.school, tx, y + 86, { kind: "mono", size: 13, tracking: 2, color: L.color });
    } else {
      text(ctx, L.name, tx, y + 32, { size: 20, weight: 600, tracking: 2.5, color: C.ice });
      text(ctx, L.school, tx, y + 54, { kind: "mono", size: 11, tracking: 1.5, color: L.color, maxWidth: w - (tx - x) - 16 });
    }
    ctx.restore();
  });
}

export { measure };
