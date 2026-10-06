// Reusable visual objects built on the primitives.
import { geoInterpolate } from "d3-geo";
import { C, W, H, clamp, ease, lerp, prog, rgba, rng, smooth } from "./core.mjs";
import { node, roundRect, text, label, measure, stroke, decode } from "./draw.mjs";
import * as SFX from "./sfx-rec.mjs";

// Keyframed value: keys = [[t, v], ...]; eased between keys.
export function track(t, keys, fn = ease.inOut) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    if (t <= keys[i][0]) {
      const [t0, v0] = keys[i - 1];
      const [t1, v1] = keys[i];
      return lerp(v0, v1, fn(clamp((t - t0) / (t1 - t0 || 1))));
    }
  }
  return keys[keys.length - 1][1];
}

// Great-circle arc lifted off a globe's surface.
export function globeArc(globe, a, b, h = 0.12, n = 48) {
  const it = geoInterpolate(a, b);
  const [cx, cy] = globe.proj.translate();
  const out = [];
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const p = globe.proj(it(u));
    const lift = 1 + h * Math.sin(Math.PI * u);
    out.push([cx + (p[0] - cx) * lift, cy + (p[1] - cy) * lift]);
  }
  return out;
}

// Map camera placing lonlat at screen (sx, sy) with zoom k.
export function camFor(view, lonlat, k, sx = W / 2, sy = H / 2) {
  const [px, py] = view.proj(lonlat);
  return { x: px - (sx - W / 2) / k, y: py - (sy - H / 2) / k, k };
}

// Cluster of glowing points (factories, terminals, lights).
export function cluster(ctx, x, y, n, radius, seed, color, t, o = {}) {
  const { alpha = 1, size = 2.2, flicker = 0.35 } = o;
  if (alpha <= 0) return;
  const r = rng(seed);
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 10;
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2;
    const d = Math.sqrt(r()) * radius;
    const ph = r() * 10;
    const s = size * (0.6 + r() * 0.8);
    const f = 1 - flicker + flicker * (0.5 + 0.5 * Math.sin(t * 3 + ph));
    ctx.globalAlpha = alpha * f;
    ctx.beginPath();
    ctx.arc(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.8, s, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// Bank vault with stencil label.
export function vault(ctx, x, y, w, h, lab, o = {}) {
  const { color = C.cyan, alpha = 1, spin = 0, glow = 22 } = o;
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  roundRect(ctx, x - w / 2, y - h / 2, w, h, 10);
  ctx.fillStyle = rgba(color, 0.08);
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.shadowColor = color;
  ctx.shadowBlur = glow;
  ctx.stroke();
  ctx.shadowBlur = 0;
  const r = Math.min(w, h) * 0.26;
  const cy = y - h * 0.08;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x, cy, r * 0.25, 0, Math.PI * 2);
  ctx.stroke();
  for (let i = 0; i < 6; i++) {
    const a = spin + (i * Math.PI) / 3;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a) * r * 0.25, cy + Math.sin(a) * r * 0.25);
    ctx.lineTo(x + Math.cos(a) * r * 0.85, cy + Math.sin(a) * r * 0.85);
    ctx.stroke();
  }
  ctx.restore();
  if (lab) text(ctx, lab, x, y + h / 2 - 22, { size: Math.max(16, w * 0.085), weight: 700, tracking: 4, align: "center", color, alpha });
}

// Stack of bond certificates.
export function bondStack(ctx, x, yBase, n, w, o = {}) {
  const { color = C.cyan, alpha = 1, p = 1, h = 18, gap = 5, tag = "UST", outline = false } = o;
  if (alpha <= 0) return;
  const k = Math.ceil(n * clamp(p));
  ctx.save();
  ctx.globalAlpha *= alpha;
  for (let i = 0; i < k; i++) {
    const y = yBase - (i + 1) * (h + gap);
    const fresh = i === k - 1 ? clamp(n * p - i) : 1;
    ctx.globalAlpha = alpha * fresh;
    roundRect(ctx, x - w / 2, y, w, h, 3);
    ctx.fillStyle = outline ? rgba(color, 0.06) : rgba(color, 0.18);
    ctx.fill();
    ctx.strokeStyle = rgba(color, 0.85);
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.fillStyle = rgba(color, 0.6);
    ctx.fillRect(x - w / 2 + 10, y + h / 2 - 1, w * 0.45, 2);
    if (tag) text(ctx, tag, x + w / 2 - 10, y + h - 4, { kind: "mono", size: Math.min(12, h * 0.7), align: "right", color: rgba(color, 0.9) });
  }
  ctx.restore();
}

// "$" token in a ring.
export function dollar(ctx, x, y, r, o = {}) {
  const { color = C.cyan, alpha = 1, glow = 20, sym = "$" } = o;
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(2, r * 0.08);
  ctx.shadowColor = color;
  ctx.shadowBlur = glow;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = rgba(color, 0.1);
  ctx.fill();
  ctx.restore();
  text(ctx, sym, x, y + r * 0.42, { kind: "sans", size: r * 1.2, weight: 600, color, align: "center", alpha, glow: glow * 0.5 });
}

// Sealed envelope ("intentions are private").
export function envelope(ctx, x, y, w, o = {}) {
  const { color = C.mid, alpha = 1, seal = C.crimson } = o;
  if (alpha <= 0) return;
  const h = w * 0.62;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.fillStyle = rgba(color, 0.06);
  ctx.fillRect(x - w / 2, y - h / 2, w, h);
  ctx.strokeRect(x - w / 2, y - h / 2, w, h);
  ctx.beginPath();
  ctx.moveTo(x - w / 2, y - h / 2);
  ctx.lineTo(x, y + h * 0.08);
  ctx.lineTo(x + w / 2, y - h / 2);
  ctx.stroke();
  ctx.fillStyle = seal;
  ctx.beginPath();
  ctx.arc(x, y + h * 0.08, w * 0.09, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// Open book ("capabilities are visible").
export function book(ctx, x, y, w, o = {}) {
  const { color = C.ice, alpha = 1 } = o;
  if (alpha <= 0) return;
  const h = w * 0.5;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, y - h * 0.4);
  ctx.quadraticCurveTo(x - w * 0.25, y - h * 0.6, x - w / 2, y - h * 0.45);
  ctx.lineTo(x - w / 2, y + h * 0.5);
  ctx.quadraticCurveTo(x - w * 0.25, y + h * 0.35, x, y + h * 0.55);
  ctx.quadraticCurveTo(x + w * 0.25, y + h * 0.35, x + w / 2, y + h * 0.5);
  ctx.lineTo(x + w / 2, y - h * 0.45);
  ctx.quadraticCurveTo(x + w * 0.25, y - h * 0.6, x, y - h * 0.4);
  ctx.lineTo(x, y + h * 0.55);
  ctx.stroke();
  ctx.lineWidth = 1;
  ctx.strokeStyle = rgba(color, 0.5);
  for (let i = 0; i < 4; i++) {
    const yy = y - h * 0.2 + i * h * 0.17;
    ctx.beginPath();
    ctx.moveTo(x - w * 0.4, yy);
    ctx.lineTo(x - w * 0.08, yy);
    ctx.moveTo(x + w * 0.08, yy);
    ctx.lineTo(x + w * 0.4, yy);
    ctx.stroke();
  }
  ctx.restore();
}

// A labelled box node for flow schematics.
export function boxNode(ctx, x, y, w, h, title, o = {}) {
  const { color = C.mid, alpha = 1, fill = 0.08, glow = 0, sub, lw = 1.5, titleSize = 18, subColor = C.dim, dim = 0 } = o;
  if (alpha <= 0) return;
  SFX.appear("blip", title, alpha, { x });
  ctx.save();
  ctx.globalAlpha *= alpha * (1 - dim * 0.65);
  roundRect(ctx, x - w / 2, y - h / 2, w, h, 6);
  ctx.fillStyle = rgba(color, fill);
  ctx.fill();
  if (glow) {
    ctx.shadowColor = color;
    ctx.shadowBlur = glow;
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  ctx.stroke();
  ctx.shadowBlur = 0;
  const ty = sub ? y - 2 : y + titleSize * 0.36;
  text(ctx, title, x, ty, { size: titleSize, weight: 600, tracking: 2.5, align: "center", caps: true, color: C.ice, maxWidth: w - 20 });
  if (sub) text(ctx, sub, x, y + titleSize * 1.05, { kind: "mono", size: Math.round(titleSize * 0.66), tracking: 1.2, align: "center", caps: true, color: subColor, maxWidth: w - 20 });
  ctx.restore();
}

// Glass mirror pane with optional sheen sweep.
export function mirrorPane(ctx, x, y, w, h, o = {}) {
  const { alpha = 1, sheen = 0, color = C.ice } = o;
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  roundRect(ctx, x, y, w, h, 8);
  const g = ctx.createLinearGradient(x, y, x + w, y + h);
  g.addColorStop(0, rgba(color, 0.06));
  g.addColorStop(0.5, rgba(color, 0.015));
  g.addColorStop(1, rgba(color, 0.07));
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = rgba(color, 0.55);
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.clip();
  if (sheen > 0) {
    const sx = x - w + sheen * (w * 3);
    const sg = ctx.createLinearGradient(sx, y, sx + w * 0.5, y + h);
    sg.addColorStop(0, rgba(color, 0));
    sg.addColorStop(0.5, rgba(color, 0.12));
    sg.addColorStop(1, rgba(color, 0));
    ctx.fillStyle = sg;
    ctx.fillRect(x, y, w, h);
  }
  ctx.restore();
}

// Map place label: dot + mono caps text.
export function place(ctx, xy, str, o = {}) {
  const { color = C.mid, alpha = 1, dx = 10, dy = -8, align = "left", dot = 3, size = 13, dotColor } = o;
  if (alpha <= 0 || !Number.isFinite(xy[0])) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.fillStyle = dotColor ?? color;
  ctx.beginPath();
  ctx.arc(xy[0], xy[1], dot, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  if (str) label(ctx, str, xy[0] + dx, xy[1] + dy, { color, alpha, size, align });
}

// Heat ribbon: thick blurred additive stroke for shipping density.
export function heat(ctx, pts, o = {}) {
  const { color = C.ice, width = 14, alpha = 0.5, blur = 18 } = o;
  if (alpha <= 0 || pts.length < 2) return;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha *= alpha;
  ctx.strokeStyle = color;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
  for (const [wf, af] of [
    [1, 0.35],
    [0.4, 0.7],
    [0.12, 1],
  ]) {
    ctx.globalAlpha = alpha * af;
    ctx.lineWidth = width * wf;
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.stroke();
  }
  ctx.restore();
}

// Chip/tag with colored border.
export function chip(ctx, str, x, y, o = {}) {
  const { color = C.amber, alpha = 1, size = 15, align = "left", fill = 0.12, kind = "mono" } = o;
  if (alpha <= 0) return 0;
  SFX.appear("blip", str, alpha, { x });
  const w = measure(ctx, str, { kind, size, tracking: 1.5, caps: true }) + 24;
  const bx = align === "center" ? x - w / 2 : align === "right" ? x - w : x;
  ctx.save();
  ctx.globalAlpha *= alpha;
  roundRect(ctx, bx, y - size - 8, w, size + 18, 4);
  ctx.fillStyle = rgba(C.bg, 0.88);
  ctx.fill();
  ctx.fillStyle = rgba(color, fill);
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.restore();
  text(ctx, decode(String(str).toUpperCase(), alpha), bx + 12, y + 1, { kind, size, tracking: 1.5, caps: true, color, alpha });
  return w;
}

// Flowing particles along a polyline.
export function flow(ctx, pts, t, o = {}) {
  const { color = C.ice, n = 8, speed = 0.15, size = 2.5, alpha = 1, glow = 8 } = o;
  if (alpha <= 0 || pts.length < 2) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = glow;
  for (let i = 0; i < n; i++) {
    const f = (((t * speed + i / n) % 1) + 1) % 1;
    const q = pointOn(pts, f);
    ctx.beginPath();
    ctx.arc(q[0], q[1], size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function pointOn(pts, f) {
  let L = 0;
  const seg = [];
  for (let i = 1; i < pts.length; i++) {
    const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    seg.push(d);
    L += d;
  }
  let target = f * L;
  for (let i = 0; i < seg.length; i++) {
    if (target <= seg[i]) {
      const u = seg[i] ? target / seg[i] : 0;
      return [lerp(pts[i][0], pts[i + 1][0], u), lerp(pts[i][1], pts[i + 1][1], u)];
    }
    target -= seg[i];
  }
  return pts[pts.length - 1];
}

export { smooth, node, stroke };

// Hachure ridge (stylized relief) along a screen polyline.
export function hachure(ctx, pts, o = {}) {
  const { color = C.mid, alpha = 0.5, len = 9, spacing = 7, width = 1.2 } = o;
  if (alpha <= 0 || pts.length < 2) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    const seg = Math.hypot(x1 - x0, y1 - y0);
    const nx = -(y1 - y0) / (seg || 1);
    const ny = (x1 - x0) / (seg || 1);
    for (let d = (spacing - (acc % spacing)) % spacing; d < seg; d += spacing) {
      const x = x0 + ((x1 - x0) * d) / seg;
      const y = y0 + ((y1 - y0) * d) / seg;
      const k = 0.6 + 0.4 * Math.abs(Math.sin((acc + d) * 0.13));
      ctx.moveTo(x - nx * len * k, y - ny * len * k);
      ctx.lineTo(x + nx * len * k, y + ny * len * k);
    }
    acc += seg;
  }
  ctx.stroke();
  ctx.restore();
}
