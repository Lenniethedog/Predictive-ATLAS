// Drawing primitives shared by every scene.
import { Path2D } from "@napi-rs/canvas";
import { C, FAMILY, W, H, clamp, lerp, ease, prog, rgba, rng } from "./core.mjs";
import * as SFX from "./sfx-rec.mjs";

// ---------------------------------------------------------------- frame clock + decode
// Labels and tags "decode" as they fade in: unresolved characters flicker through
// random glyphs and lock left to right. Needs consecutive frames, so it only runs in
// video renders (sheets and stills show the plain text).
let FRAME = -10;
const seenThisFrame = new Map();
const lastAlpha = new Map();
export function setFrame(f) {
  FRAME = f;
  seenThisFrame.clear();
}
const GLYPHS = "ABCDEFGHJKLMNPRSTUVWXYZ0123456789#%/<>+=";
function decode(str, alpha) {
  const k = seenThisFrame.get(str) ?? 0;
  seenThisFrame.set(str, k + 1);
  const key = `${str}#${k}`;
  const prev = lastAlpha.get(key);
  lastAlpha.set(key, { a: alpha, f: FRAME });
  if (!prev || prev.f !== FRAME - 1 || !(alpha > prev.a + 1e-4) || alpha >= 0.999) return str;
  const locked = Math.floor(str.length * clamp((alpha - 0.08) / 0.85));
  let out = "";
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (i < locked || !/[A-Z0-9]/i.test(ch)) out += ch;
    else out += GLYPHS[((Math.imul((FRAME >> 1) + 7, 2654435761) ^ Math.imul(i + 3, 40503)) >>> 0) % GLYPHS.length];
  }
  return out;
}
export { decode };

// ---------------------------------------------------------------- background
export function bg(ctx, { grid = true, step = 60, color = C.bg, gridAlpha = 1 } = {}) {
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, W, H);
  if (grid) {
    ctx.save();
    ctx.globalAlpha = gridAlpha;
    ctx.strokeStyle = C.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = (W % step) / 2; x <= W; x += step) {
      ctx.moveTo(Math.round(x) + 0.5, 0);
      ctx.lineTo(Math.round(x) + 0.5, H);
    }
    for (let y = (H % step) / 2; y <= H; y += step) {
      ctx.moveTo(0, Math.round(y) + 0.5);
      ctx.lineTo(W, Math.round(y) + 0.5);
    }
    ctx.stroke();
    ctx.restore();
  }
}

// ---------------------------------------------------------------- text
export function font(kind = "cond", size = 24, weight = 500) {
  return `${weight} ${size}px '${FAMILY[kind] ?? kind}'`;
}

// Small type is lifted toward 16 px so labels survive phone screens and compression.
export function legible(size) {
  return size >= 17 ? size : Math.round((size + (17 - size) * 0.45) * 10) / 10;
}

export function text(ctx, str, x, y, o = {}) {
  let { size = 24 } = o;
  const {
    kind = "cond",
    weight = 500,
    color = C.ice,
    align = "left",
    baseline = "alphabetic",
    tracking = 0,
    alpha = 1,
    caps = false,
    glow = 0,
    maxWidth,
  } = o;
  if (alpha <= 0 || !str) return 0;
  const s = caps ? str.toUpperCase() : str;
  size = legible(size);
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.font = font(kind, size, weight);
  ctx.letterSpacing = `${tracking}px`;
  ctx.textBaseline = baseline;
  ctx.fillStyle = color;
  // letterSpacing adds trailing space after the last glyph; compensate for centered/right text.
  const w = ctx.measureText(s).width - tracking;
  let dx = 0;
  if (align === "center") dx = -w / 2;
  else if (align === "right") dx = -w;
  ctx.textAlign = "left";
  if (glow) {
    ctx.shadowColor = color;
    ctx.shadowBlur = glow;
  }
  if (maxWidth && w > maxWidth) {
    ctx.translate(x + dx * (maxWidth / w), y);
    ctx.scale(maxWidth / w, 1);
    ctx.fillText(s, 0, 0);
  } else ctx.fillText(s, x + dx, y);
  ctx.restore();
  return w;
}

export function measure(ctx, str, o = {}) {
  const { kind = "cond", size = 24, weight = 500, tracking = 0, caps = false } = o;
  ctx.save();
  ctx.font = font(kind, legible(size), weight);
  ctx.letterSpacing = `${tracking}px`;
  const w = ctx.measureText(caps ? str.toUpperCase() : str).width - tracking;
  ctx.restore();
  return w;
}

// Word-wrapped paragraph; returns height used.
export function para(ctx, str, x, y, width, o = {}) {
  const { size = 24, lineHeight = 1.35, reveal = 1 } = o;
  const words = str.split(/\s+/);
  const lines = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (measure(ctx, next, o) > width && cur) {
      lines.push(cur);
      cur = w;
    } else cur = next;
  }
  if (cur) lines.push(cur);
  const total = lines.reduce((a, l) => a + l.length, 0);
  let budget = Math.floor(total * clamp(reveal));
  lines.forEach((l, i) => {
    if (budget <= 0) return;
    text(ctx, l.slice(0, budget), x, y + i * size * lineHeight, o);
    budget -= l.length;
  });
  return lines.length * size * lineHeight;
}

// Typewriter substring with a soft trailing cursor.
export function typed(str, p) {
  const n = Math.floor(str.length * clamp(p));
  return str.slice(0, n);
}

// Lower-third / held caption in the channel's style: thin rule + tracked caps.
export function caption(ctx, str, t, t0, o = {}) {
  const {
    x = 120,
    y = 968,
    size = 30,
    color = C.ice,
    accent = C.cyan,
    hold = Infinity,
    align = "left",
    typeDur = Math.min(1.6, 0.045 * str.length),
    tracking = 5,
    sub,
  } = o;
  SFX.at("type", t0, str, { dur: typeDur, x });
  const a = prog(t, t0, 0.5, ease.out) * (1 - prog(t, t0 + hold, 0.6));
  if (a <= 0) return;
  const tp = prog(t, t0, typeDur, ease.linear);
  const s = typed(str, tp);
  const full = measure(ctx, str, { size, weight: 600, tracking, caps: true });
  const left = align === "center" ? x - full / 2 : align === "right" ? x - full : x;
  ctx.save();
  ctx.globalAlpha *= a;
  // soft scrim so captions stay legible over maps
  const sg = ctx.createLinearGradient(left - 40, 0, left + full + 160, 0);
  sg.addColorStop(0, "rgba(5,7,10,0.62)");
  sg.addColorStop(0.75, "rgba(5,7,10,0.45)");
  sg.addColorStop(1, "rgba(5,7,10,0)");
  ctx.fillStyle = sg;
  ctx.fillRect(left - 40, y - size - 40, full + 200, size + (sub ? 70 : 62));
  const rw = 56 * prog(t, t0, 0.5, ease.out);
  ctx.fillStyle = accent;
  ctx.fillRect(left, y - size - 18, rw, 3);
  const tw = text(ctx, s, left, y, { size, weight: 600, tracking, caps: true, color });
  // block cursor while typing, blinking out shortly after
  const since = t - t0 - typeDur;
  if (tp < 1 || since < 1.2) {
    const blink = tp < 1 ? 1 : Math.floor(since * 2.4) % 2 === 0 ? 1 : 0;
    ctx.fillStyle = rgba(accent, 0.85 * blink);
    ctx.fillRect(left + (s.length ? tw + tracking + 4 : 0), y - size * 0.78, size * 0.42, size * 0.86);
  }
  if (sub) text(ctx, sub, left, y + size * 0.95, { kind: "mono", size: size * 0.5, color: C.dim, tracking: 2, caps: true });
  ctx.restore();
}

// Small mono tag with optional leader line from (lx, ly).
export function label(ctx, str, x, y, o = {}) {
  const { color = C.mid, size = 15, align = "left", alpha = 1, box = false, kind = "mono", weight = 500, tracking = 1.5, caps = true, leader, bgColor = C.bg } = o;
  if (alpha <= 0) return;
  str = caps && kind === "mono" ? decode(String(str).toUpperCase(), alpha) : str;
  ctx.save();
  ctx.globalAlpha *= alpha;
  if (leader) {
    ctx.strokeStyle = rgba(color.startsWith("#") ? color : C.mid, 0.6);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(leader[0], leader[1]);
    ctx.lineTo(x, y - size * 0.35);
    ctx.stroke();
  }
  if (box) {
    const w = measure(ctx, str, { kind, size, weight, tracking, caps });
    const bx = align === "center" ? x - w / 2 : align === "right" ? x - w : x;
    ctx.fillStyle = rgba(bgColor, 0.85);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    roundRect(ctx, bx - 10, y - size - 6, w + 20, size + 16, 3);
    ctx.fill();
    ctx.stroke();
  }
  text(ctx, str, x, y, { kind, size, weight, color, align, tracking, caps });
  ctx.restore();
}

// ---------------------------------------------------------------- shapes
export function roundRect(ctx, x, y, w, h, r = 6) {
  r = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function panel(ctx, x, y, w, h, o = {}) {
  const { color = C.border, fill = rgba(C.bg2, 0.82), alpha = 1, title, titleColor = C.mid, r = 6, lw = 1.2, glow = 0 } = o;
  if (alpha <= 0) return;
  // only titled panels have a stable identity across frames (untitled ones may move or grow)
  if (title) SFX.appear("panel", title, alpha, { x: x + w / 2 });
  ctx.save();
  ctx.globalAlpha *= alpha;
  roundRect(ctx, x, y, w, h, r);
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (glow) {
    ctx.shadowColor = color;
    ctx.shadowBlur = glow;
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  ctx.stroke();
  ctx.shadowBlur = 0;
  if (title) text(ctx, title, x + 18, y + 30, { kind: "mono", size: 15, color: titleColor, tracking: 2, caps: true });
  ctx.restore();
}

// Corner-bracket frame, the briefing-room look.
export function brackets(ctx, x, y, w, h, o = {}) {
  const { color = C.dim, len = 18, lw = 1.5, alpha = 1 } = o;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  ctx.beginPath();
  for (const [cx, cy, sx, sy] of [
    [x, y, 1, 1],
    [x + w, y, -1, 1],
    [x, y + h, 1, -1],
    [x + w, y + h, -1, -1],
  ]) {
    ctx.moveTo(cx + sx * len, cy);
    ctx.lineTo(cx, cy);
    ctx.lineTo(cx, cy + sy * len);
  }
  ctx.stroke();
  ctx.restore();
}

export function node(ctx, x, y, r, color, o = {}) {
  const { alpha = 1, glow = 18, fill = true, ring = true, ringR = 1.9, pulseT, lw = 2, core = C.ice } = o;
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  if (pulseT !== undefined) {
    const ph = (pulseT % 2) / 2;
    ctx.strokeStyle = rgba(color, (1 - ph) * 0.55);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, y, r * (1.2 + ph * 2.6), 0, Math.PI * 2);
    ctx.stroke();
  }
  if (glow) {
    ctx.shadowColor = color;
    ctx.shadowBlur = glow;
  }
  if (fill) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    if (core && r > 5) {
      ctx.shadowBlur = 0;
      ctx.fillStyle = rgba(core, 0.85);
      ctx.beginPath();
      ctx.arc(x, y, r * 0.38, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if (ring) {
    ctx.shadowBlur = 0;
    ctx.strokeStyle = rgba(color, 0.5);
    ctx.lineWidth = lw * 0.6;
    ctx.beginPath();
    ctx.arc(x, y, r * ringR, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

// Diamond marker (used for capitals / hubs).
export function diamond(ctx, x, y, r, color, o = {}) {
  const { alpha = 1, glow = 12, stroke = false } = o;
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.shadowColor = color;
  ctx.shadowBlur = glow;
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.lineTo(x + r, y);
  ctx.lineTo(x, y + r);
  ctx.lineTo(x - r, y);
  ctx.closePath();
  if (stroke) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();
  } else {
    ctx.fillStyle = color;
    ctx.fill();
  }
  ctx.restore();
}

export function square(ctx, x, y, s, color, o = {}) {
  const { alpha = 1, glow = 10, stroke = false } = o;
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.shadowColor = color;
  ctx.shadowBlur = glow;
  if (stroke) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.strokeRect(x - s / 2, y - s / 2, s, s);
  } else {
    ctx.fillStyle = color;
    ctx.fillRect(x - s / 2, y - s / 2, s, s);
  }
  ctx.restore();
}

// ---------------------------------------------------------------- polylines & flows
export function polyLength(pts) {
  let L = 0;
  for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return L;
}

// Point (and tangent angle) at fraction f along a polyline.
export function pointAt(pts, f) {
  const L = polyLength(pts) * clamp(f);
  let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    const seg = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    if (acc + seg >= L || i === pts.length - 1) {
      const u = seg ? (L - acc) / seg : 0;
      return {
        x: lerp(pts[i - 1][0], pts[i][0], clamp(u)),
        y: lerp(pts[i - 1][1], pts[i][1], clamp(u)),
        a: Math.atan2(pts[i][1] - pts[i - 1][1], pts[i][0] - pts[i - 1][0]),
      };
    }
    acc += seg;
  }
  return { x: pts[0][0], y: pts[0][1], a: 0 };
}

// Sub-polyline between fractions f0..f1.
export function slice(pts, f0, f1) {
  if (f1 <= f0) return [];
  const L = polyLength(pts);
  const a = L * clamp(f0);
  const b = L * clamp(f1);
  const out = [];
  let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i - 1];
    const q = pts[i];
    const seg = Math.hypot(q[0] - p[0], q[1] - p[1]);
    const s0 = acc;
    const s1 = acc + seg;
    if (s1 >= a && s0 <= b) {
      const u0 = seg ? clamp((a - s0) / seg) : 0;
      const u1 = seg ? clamp((b - s0) / seg) : 1;
      if (!out.length) out.push([lerp(p[0], q[0], u0), lerp(p[1], q[1], u0)]);
      out.push([lerp(p[0], q[0], u1), lerp(p[1], q[1], u1)]);
    }
    acc = s1;
  }
  return out;
}

export function stroke(ctx, pts, o = {}) {
  const { color = C.ice, width = 2, alpha = 1, dash, glow = 0, cap = "round", from = 0, to = 1, dashOffset = 0 } = o;
  if (alpha <= 0 || pts.length < 2 || to <= from) return;
  const p = from === 0 && to === 1 ? pts : slice(pts, from, to);
  if (p.length < 2) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = cap;
  ctx.lineJoin = "round";
  if (dash) {
    ctx.setLineDash(dash);
    ctx.lineDashOffset = dashOffset;
  }
  if (glow) {
    ctx.shadowColor = color;
    ctx.shadowBlur = glow;
  }
  ctx.beginPath();
  ctx.moveTo(p[0][0], p[0][1]);
  for (let i = 1; i < p.length; i++) ctx.lineTo(p[i][0], p[i][1]);
  ctx.stroke();
  ctx.restore();
}

// Curved arc (quadratic) between two points, sampled as a polyline.
export function arcPts(a, b, lift = 0.25, n = 48, side = 1) {
  const mx = (a[0] + b[0]) / 2;
  const my = (a[1] + b[1]) / 2;
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy);
  const cx = mx + (-dy / (len || 1)) * len * lift * side;
  const cy = my + (dx / (len || 1)) * len * lift * side;
  const out = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    out.push([(1 - t) * (1 - t) * a[0] + 2 * (1 - t) * t * cx + t * t * b[0], (1 - t) * (1 - t) * a[1] + 2 * (1 - t) * t * cy + t * t * b[1]]);
  }
  return out;
}

// Smooth a sparse polyline (Catmull-Rom) into a dense one.
export function smoothPts(pts, per = 10) {
  if (pts.length < 3) return pts;
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    for (let j = 0; j < per; j++) {
      const t = j / per;
      const t2 = t * t;
      const t3 = t2 * t;
      out.push([
        0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
        0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
      ]);
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}

// Animated thread: draws on over [t0, t0+d], then carries moving particles.
export function thread(ctx, pts, t, t0, d, o = {}) {
  const { color = C.ice, width = 2, alpha = 1, glow = 10, particles = 6, speed = 0.18, psize = 2.6, base = 0.55, head = true, fadeOut = Infinity } = o;
  SFX.at("draw", t0, "thread", { dur: d, x: pts[0]?.[0] ?? W / 2 });
  const p = prog(t, t0, d, ease.inOut);
  const a = alpha * (1 - prog(t, fadeOut, 0.6));
  if (p <= 0 || a <= 0) return;
  stroke(ctx, pts, { color, width, alpha: a * base, to: p, glow: glow * 0.5 });
  if (head && p < 1) {
    const h = pointAt(pts, p);
    node(ctx, h.x, h.y, width * 1.6, color, { alpha: a, glow, ring: false, core: null });
  }
  if (p >= 1 && particles) {
    ctx.save();
    ctx.globalAlpha *= a;
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = glow;
    for (let i = 0; i < particles; i++) {
      const f = (((t - t0 - d) * speed + i / particles) % 1 + 1) % 1;
      const q = pointAt(pts, f);
      ctx.beginPath();
      ctx.arc(q.x, q.y, psize, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

export function arrowHead(ctx, x, y, ang, size, color, alpha = 1) {
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.fillStyle = color;
  ctx.translate(x, y);
  ctx.rotate(ang);
  ctx.beginPath();
  ctx.moveTo(size * 0.4, 0);
  ctx.lineTo(-size, size * 0.6);
  ctx.lineTo(-size * 0.65, 0);
  ctx.lineTo(-size, -size * 0.6);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function arrow(ctx, pts, o = {}) {
  const { color = C.ice, width = 3, to = 1, head = 16, alpha = 1 } = o;
  if (to <= 0 || alpha <= 0) return;
  stroke(ctx, pts, { ...o, to });
  const h = pointAt(pts, to);
  arrowHead(ctx, h.x, h.y, h.a, head, color, alpha);
}

// Thick tapered pressure arrow (map-style).
export function fatArrow(ctx, from, to, o = {}) {
  const { color = C.cyan, width = 60, p = 1, alpha = 0.8, glow = 20 } = o;
  if (p <= 0) return;
  const x2 = lerp(from[0], to[0], p);
  const y2 = lerp(from[1], to[1], p);
  const ang = Math.atan2(y2 - from[1], x2 - from[0]);
  const len = Math.hypot(x2 - from[0], y2 - from[1]);
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(from[0], from[1]);
  ctx.rotate(ang);
  const g = ctx.createLinearGradient(0, 0, len, 0);
  g.addColorStop(0, rgba(color, 0));
  g.addColorStop(0.5, rgba(color, 0.55));
  g.addColorStop(1, rgba(color, 0.95));
  ctx.fillStyle = g;
  ctx.shadowColor = color;
  ctx.shadowBlur = glow;
  const hw = width / 2;
  const hl = Math.min(width * 1.1, len * 0.5);
  ctx.beginPath();
  ctx.moveTo(0, -hw * 0.35);
  ctx.lineTo(len - hl, -hw * 0.6);
  ctx.lineTo(len - hl, -hw);
  ctx.lineTo(len, 0);
  ctx.lineTo(len - hl, hw);
  ctx.lineTo(len - hl, hw * 0.6);
  ctx.lineTo(0, hw * 0.35);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// ---------------------------------------------------------------- charts
export function axes(ctx, x, y, w, h, o = {}) {
  const { color = C.faint, alpha = 1, ticks = 0 } = o;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x, y + h);
  ctx.lineTo(x + w, y + h);
  ctx.stroke();
  if (ticks) {
    ctx.strokeStyle = rgba(C.mid, 0.08);
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 1; i <= ticks; i++) {
      const yy = y + h - (h * i) / (ticks + 1);
      ctx.moveTo(x, yy);
      ctx.lineTo(x + w, yy);
    }
    ctx.stroke();
  }
  ctx.restore();
}

// Series of [0..1, 0..1] points mapped into a rect; drawn on to fraction p.
export function series(ctx, x, y, w, h, data, o = {}) {
  const { color = C.cyan, width = 3, p = 1, glow = 10, fillAlpha = 0, dash, alpha = 1, dot = true } = o;
  const pts = data.map(([u, v]) => [x + u * w, y + h - v * h]);
  if (p <= 0) return pts;
  if (fillAlpha > 0) {
    const sub = slice(pts, 0, p);
    if (sub.length > 1) {
      ctx.save();
      ctx.globalAlpha *= alpha;
      const g = ctx.createLinearGradient(0, y, 0, y + h);
      g.addColorStop(0, rgba(color, fillAlpha));
      g.addColorStop(1, rgba(color, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(sub[0][0], y + h);
      for (const q of sub) ctx.lineTo(q[0], q[1]);
      ctx.lineTo(sub[sub.length - 1][0], y + h);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }
  stroke(ctx, pts, { color, width, to: p, glow, dash, alpha });
  if (dot && p > 0.02) {
    const q = pointAt(pts, p);
    node(ctx, q.x, q.y, width * 1.5, color, { glow, ring: false, core: null, alpha });
  }
  return pts;
}

export function bar(ctx, x, yBase, w, h, color, o = {}) {
  const { p = 1, alpha = 1, glow = 8, outline = false, label: lab, labelColor = C.mid, value, valueColor } = o;
  if (alpha <= 0) return;
  const hh = h * clamp(p);
  ctx.save();
  ctx.globalAlpha *= alpha;
  if (outline) {
    ctx.strokeStyle = rgba(color, 0.4);
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(x + 0.5, yBase - h + 0.5, w, h);
    ctx.setLineDash([]);
  }
  const g = ctx.createLinearGradient(0, yBase - hh, 0, yBase);
  g.addColorStop(0, color);
  g.addColorStop(1, rgba(color, 0.35));
  ctx.fillStyle = g;
  ctx.shadowColor = color;
  ctx.shadowBlur = glow;
  ctx.fillRect(x, yBase - hh, w, hh);
  ctx.restore();
  if (lab) label(ctx, lab, x + w / 2, yBase + 28, { align: "center", color: labelColor, alpha, size: 14 });
  if (value) text(ctx, value, x + w / 2, yBase - hh - 12, { kind: "mono", size: 16, align: "center", color: valueColor ?? color, alpha: alpha * clamp(p * 3 - 2) });
}

// Horizontal bar.
export function hbar(ctx, x, y, w, h, color, o = {}) {
  const { p = 1, alpha = 1, glow = 8, track = true } = o;
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  if (track) {
    ctx.fillStyle = rgba(C.mid, 0.07);
    ctx.fillRect(x, y, w, h);
  }
  const g = ctx.createLinearGradient(x, 0, x + w * p, 0);
  g.addColorStop(0, rgba(color, 0.4));
  g.addColorStop(1, color);
  ctx.fillStyle = g;
  ctx.shadowColor = color;
  ctx.shadowBlur = glow;
  ctx.fillRect(x, y, w * clamp(p), h);
  ctx.restore();
}

// Sankey ribbon between two vertical spans.
export function ribbon(ctx, x0, y0a, y0b, x1, y1a, y1b, color, o = {}) {
  const { p = 1, alpha = 0.55 } = o;
  if (p <= 0) return;
  const xe = lerp(x0, x1, p);
  const cx = (x0 + x1) / 2;
  ctx.save();
  ctx.globalAlpha *= alpha;
  const g = ctx.createLinearGradient(x0, 0, x1, 0);
  g.addColorStop(0, rgba(color, 0.9));
  g.addColorStop(1, rgba(color, 0.55));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.rect(x0 - 1, 0, xe - x0 + 1, H);
  ctx.clip();
  ctx.beginPath();
  ctx.moveTo(x0, y0a);
  ctx.bezierCurveTo(cx, y0a, cx, y1a, x1, y1a);
  ctx.lineTo(x1, y1b);
  ctx.bezierCurveTo(cx, y1b, cx, y0b, x0, y0b);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// Semicircular gauge, value 0..1.
export function gauge(ctx, x, y, r, v, o = {}) {
  const { color = C.cyan, alpha = 1, label: lab, zones, needle = C.ice } = o;
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.lineWidth = r * 0.16;
  ctx.lineCap = "butt";
  if (zones) {
    for (const [a, b, c] of zones) {
      ctx.strokeStyle = rgba(c, 0.75);
      ctx.beginPath();
      ctx.arc(x, y, r, Math.PI + a * Math.PI, Math.PI + b * Math.PI);
      ctx.stroke();
    }
  } else {
    ctx.strokeStyle = rgba(C.mid, 0.15);
    ctx.beginPath();
    ctx.arc(x, y, r, Math.PI, 2 * Math.PI);
    ctx.stroke();
    ctx.strokeStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(x, y, r, Math.PI, Math.PI + clamp(v) * Math.PI);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }
  const ang = Math.PI + clamp(v) * Math.PI;
  ctx.strokeStyle = needle;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + Math.cos(ang) * r * 0.92, y + Math.sin(ang) * r * 0.92);
  ctx.stroke();
  ctx.fillStyle = needle;
  ctx.beginPath();
  ctx.arc(x, y, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  if (lab) label(ctx, lab, x, y + 36, { align: "center", alpha, size: 14 });
}

// Horizontal slider, value 0..1.
export function slider(ctx, x, y, w, v, o = {}) {
  const { color = C.crimson, alpha = 1, label: lab, ticks = 10 } = o;
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.fillStyle = rgba(C.mid, 0.18);
  ctx.fillRect(x, y - 2, w, 4);
  ctx.fillStyle = color;
  ctx.fillRect(x, y - 2, w * clamp(v), 4);
  ctx.strokeStyle = rgba(C.mid, 0.35);
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i <= ticks; i++) {
    ctx.moveTo(x + (w * i) / ticks, y + 8);
    ctx.lineTo(x + (w * i) / ticks, y + (i % 5 ? 13 : 18));
  }
  ctx.stroke();
  const kx = x + w * clamp(v);
  ctx.fillStyle = C.ice;
  ctx.shadowColor = color;
  ctx.shadowBlur = 14;
  roundRect(ctx, kx - 9, y - 16, 18, 32, 3);
  ctx.fill();
  ctx.restore();
  if (lab) label(ctx, lab, x, y - 32, { alpha, color: C.mid, size: 15 });
}

// ---------------------------------------------------------------- stamps, cracks, misc
export function stamp(ctx, str, x, y, t, t0, o = {}) {
  const { color = C.crimson, size = 40, angle = -0.08, alpha = 1, tracking = 6 } = o;
  SFX.at("impact", t0, str, { x });
  const p = prog(t, t0, 0.35, ease.out);
  if (p <= 0 || alpha <= 0) return;
  const s = lerp(1.6, 1, p);
  const w = measure(ctx, str, { size, weight: 700, tracking, caps: true });
  ctx.save();
  ctx.globalAlpha *= alpha * p;
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(s, s);
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  roundRect(ctx, -w / 2 - 22, -size * 0.85, w + 44, size * 1.45, 4);
  ctx.stroke();
  ctx.lineWidth = 1;
  roundRect(ctx, -w / 2 - 15, -size * 0.85 + 7, w + 30, size * 1.45 - 14, 3);
  ctx.stroke();
  text(ctx, str, 0, size * 0.36, { size, weight: 700, tracking, caps: true, color, align: "center" });
  ctx.restore();
}

// Jagged crack polyline from a to b (deterministic).
export function crackPts(a, b, seed = 7, rough = 0.06, n = 22) {
  const r = rng(seed);
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy);
  const nx = -dy / len;
  const ny = dx / len;
  const out = [a];
  for (let i = 1; i < n; i++) {
    const t = i / n;
    const off = (r() - 0.5) * 2 * rough * len * Math.sin(Math.PI * t);
    out.push([a[0] + dx * t + nx * off, a[1] + dy * t + ny * off]);
  }
  out.push(b);
  return out;
}

export function vignette(ctx, strength = 0.75) {
  const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 1.05);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, `rgba(0,0,0,${strength})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

// Pre-built Path2D from an SVG string (d3-geo output).
export function svgPath(d) {
  return new Path2D(d || "");
}

// Simple icon set: drawn at (x, y) with size s.
export const icon = {
  barrel(ctx, x, y, s, color = C.ice, alpha = 1) {
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1.5, s * 0.06);
    roundRect(ctx, x - s * 0.36, y - s * 0.5, s * 0.72, s, s * 0.12);
    ctx.stroke();
    ctx.beginPath();
    for (const f of [-0.22, 0.22]) {
      ctx.moveTo(x - s * 0.36, y + f * s);
      ctx.lineTo(x + s * 0.36, y + f * s);
    }
    ctx.stroke();
    ctx.restore();
  },
  factory(ctx, x, y, s, color = C.ice, alpha = 1, smoke = 0) {
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x - s * 0.5, y + s * 0.4);
    ctx.lineTo(x - s * 0.5, y - s * 0.05);
    ctx.lineTo(x - s * 0.2, y + s * 0.12);
    ctx.lineTo(x - s * 0.2, y - s * 0.05);
    ctx.lineTo(x + s * 0.1, y + s * 0.12);
    ctx.lineTo(x + s * 0.1, y - s * 0.5);
    ctx.lineTo(x + s * 0.3, y - s * 0.5);
    ctx.lineTo(x + s * 0.3, y - s * 0.05);
    ctx.lineTo(x + s * 0.5, y - s * 0.05);
    ctx.lineTo(x + s * 0.5, y + s * 0.4);
    ctx.closePath();
    ctx.fill();
    if (smoke > 0) {
      ctx.globalAlpha *= smoke * 0.5;
      ctx.beginPath();
      ctx.arc(x + s * 0.24, y - s * 0.7, s * 0.12, 0, Math.PI * 2);
      ctx.arc(x + s * 0.36, y - s * 0.88, s * 0.16, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  },
  ship(ctx, x, y, s, ang, color = C.ice, alpha = 1) {
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.translate(x, y);
    ctx.rotate(ang);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(s * 0.6, 0);
    ctx.lineTo(s * 0.25, -s * 0.22);
    ctx.lineTo(-s * 0.5, -s * 0.22);
    ctx.lineTo(-s * 0.5, s * 0.22);
    ctx.lineTo(s * 0.25, s * 0.22);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  },
  lock(ctx, x, y, s, color = C.ice, alpha = 1, open = 0) {
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = s * 0.12;
    ctx.beginPath();
    ctx.arc(x, y - s * 0.15 - open * s * 0.25, s * 0.3, Math.PI, 0);
    ctx.lineTo(x + s * 0.3, y - open * s * 0.25);
    ctx.moveTo(x - s * 0.3, y - s * 0.15 - open * s * 0.25);
    ctx.lineTo(x - s * 0.3, y);
    ctx.stroke();
    roundRect(ctx, x - s * 0.45, y - s * 0.02, s * 0.9, s * 0.62, s * 0.08);
    ctx.fill();
    ctx.restore();
  },
  person(ctx, x, y, s, color = C.ice, alpha = 1) {
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y - s * 0.3, s * 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x, y + s * 0.3, s * 0.34, s * 0.32, 0, Math.PI, 0);
    ctx.fill();
    ctx.restore();
  },
  house(ctx, x, y, s, color = C.ice, alpha = 1) {
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x - s * 0.5, y);
    ctx.lineTo(x, y - s * 0.45);
    ctx.lineTo(x + s * 0.5, y);
    ctx.lineTo(x + s * 0.36, y);
    ctx.lineTo(x + s * 0.36, y + s * 0.42);
    ctx.lineTo(x - s * 0.36, y + s * 0.42);
    ctx.lineTo(x - s * 0.36, y);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  },
  chip(ctx, x, y, s, color = C.ice, alpha = 1) {
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1.5, s * 0.05);
    ctx.strokeRect(x - s * 0.32, y - s * 0.32, s * 0.64, s * 0.64);
    ctx.fillStyle = rgba(color, 0.25);
    ctx.fillRect(x - s * 0.18, y - s * 0.18, s * 0.36, s * 0.36);
    ctx.beginPath();
    for (let i = -2; i <= 2; i++) {
      const o = i * s * 0.12;
      ctx.moveTo(x + o, y - s * 0.32);
      ctx.lineTo(x + o, y - s * 0.46);
      ctx.moveTo(x + o, y + s * 0.32);
      ctx.lineTo(x + o, y + s * 0.46);
      ctx.moveTo(x - s * 0.32, y + o);
      ctx.lineTo(x - s * 0.46, y + o);
      ctx.moveTo(x + s * 0.32, y + o);
      ctx.lineTo(x + s * 0.46, y + o);
    }
    ctx.stroke();
    ctx.restore();
  },
  tanker(ctx, x, y, s, ang, color = C.ice, alpha = 1) {
    icon.ship(ctx, x, y, s, ang, color, alpha);
  },
};
