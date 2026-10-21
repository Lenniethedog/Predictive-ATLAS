// EPISODE 2 — THE TRAGEDY OF BUFFER STATES
import { geoMercator } from "d3-geo";
import { C, W, H, clamp, lerp, ease, prog, fade, rgba, mix, rng } from "../engine/core.mjs";
import * as D from "../engine/draw.mjs";
import { MapView, P, ID, NATO, CONTACT_LINE, OCCUPIED, MOUNTAINS, RIVERS } from "../engine/geo.mjs";
import * as K from "../engine/kit.mjs";
import { contactLine } from "../figures.mjs";

const UA = [ID.ukraine, "CRIMEA"];
const WEST_STATE = "#3b4757";
const PALE_AMBER = "#e8c27a";
const OCC = "#5a1820";

function europe() {
  const v = new MapView(geoMercator().scale(1800).translate([W / 2, H / 2]), { res: "50m", bbox: [[-4, 36], [68, 68]] });
  v.setCam(K.camFor(v, [32, 51.5], 1, 960, 580));
  return v;
}

function ukraine() {
  return new MapView(geoMercator().scale(4400).translate([W / 2, H / 2]), { res: "10m", bbox: [[12, 40], [46, 58]] });
}

const poly = (ring) => ({ type: "Polygon", coordinates: [[...ring, ring[0]].reverse()] });
const line = (pts) => ({ type: "LineString", coordinates: pts });

// Fortified line: stroke + inward ticks.
function fortified(ctx, pts, o = {}) {
  const { color = C.ice, alpha = 1, to = 1, width = 3, tick = 8 } = o;
  if (alpha <= 0 || to <= 0) return;
  const p = D.slice(pts, 0, to);
  D.stroke(ctx, p, { color, width, alpha, glow: 10 });
  ctx.save();
  ctx.globalAlpha *= alpha * 0.8;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  let acc = 0;
  for (let i = 1; i < p.length; i++) {
    const [x0, y0] = p[i - 1];
    const [x1, y1] = p[i];
    const seg = Math.hypot(x1 - x0, y1 - y0);
    const nx = -(y1 - y0) / (seg || 1);
    const ny = (x1 - x0) / (seg || 1);
    for (let d = (12 - (acc % 12)) % 12; d < seg; d += 12) {
      const x = x0 + ((x1 - x0) * d) / seg;
      const y = y0 + ((y1 - y0) * d) / seg;
      ctx.moveTo(x, y);
      ctx.lineTo(x + nx * tick, y + ny * tick);
    }
    acc += seg;
  }
  ctx.stroke();
  ctx.restore();
}

function relief(ctx, view, alpha = 0.4) {
  for (const k of ["carpathians", "alps", "caucasus", "urals", "balkans"]) K.hachure(ctx, D.smoothPts(view.line(MOUNTAINS[k]), 6), { alpha, color: C.mid, len: 7, spacing: 6 });
}

// ================================================================ 1. the width
function s1(S) {
  const view = europe();
  const ua = view.union(UA);
  const tSqueeze = S.at("Treat the state");
  const tShear = S.at("The territory", 0.3);
  return (ctx, t) => {
    D.bg(ctx, { gridAlpha: 0.25 });
    view.base(ctx, { borderAlpha: 0.6 });
    relief(ctx, view, 0.45);
    D.label(ctx, "RHINE", ...view.xy([7.2, 51.2]), { color: C.dim, size: 13 });
    D.label(ctx, "URALS", ...view.xy([58.2, 55.2]), { color: C.dim, size: 13, align: "right" });
    D.label(ctx, "CARPATHIANS", ...view.xy([24.5, 46.7]), { color: C.dim, size: 12, align: "center" });
    D.text(ctx, "THE EUROPEAN PLAIN", ...view.xy([36, 55.6]), { size: 34, weight: 500, tracking: 22, align: "center", color: C.ice, alpha: 0.18 * prog(t, 0.3, 1.5) });
    const c = prog(t, tSqueeze, tShear - tSqueeze, ease.inOut);
    const w = lerp(22.0, 31.3, c);
    const e = lerp(40.3, 33.6, c);
    const shear = prog(t, tShear, 0.8, ease.out);
    const midLon = (w + e) / 2;
    const ba = prog(t, 0.6, 1.2);
    // the band, clipped to Ukraine (incl. Crimea)
    const drawHalf = (x0, x1, dx, dy) => {
      ctx.save();
      ctx.translate(dx, dy);
      view.withClip(ctx, ua, () => {
        const band = view.pathOf(poly([[x0, 43.5], [x1, 43.5], [x1, 53], [x0, 53]]));
        view.draw(ctx, band, { fill: rgba(PALE_AMBER, 0.32), alpha: ba });
      });
      ctx.restore();
    };
    if (shear <= 0) drawHalf(w, e, 0, 0);
    else {
      drawHalf(w, midLon, -shear * 10, -shear * 14);
      drawHalf(midLon, e, shear * 10, shear * 14);
      const crack = D.crackPts(view.xy([midLon, 52.6]), view.xy([midLon, 44.6]), 4, 0.06, 18);
      D.stroke(ctx, crack, { color: C.ice, width: 2, glow: 14, alpha: shear });
    }
    view.draw(ctx, ua, { stroke: rgba(PALE_AMBER, 0.6), width: 1.4, alpha: ba });
    // dimension line
    const a = view.xy([w, 53.3]);
    const b = view.xy([e, 53.3]);
    D.stroke(ctx, [a, b], { color: C.ice, width: 1.5, alpha: ba });
    D.arrowHead(ctx, a[0], a[1], Math.PI, 10, C.ice, ba);
    D.arrowHead(ctx, b[0], b[1], 0, 10, C.ice, ba);
    const km = Math.round(((e - w) * 111.3 * Math.cos((49 * Math.PI) / 180)) / 10) * 10;
    D.text(ctx, "WIDTH", (a[0] + b[0]) / 2, a[1] - 34, { size: 28, weight: 600, tracking: 10, align: "center", alpha: ba });
    D.text(ctx, `${km.toLocaleString("en-US")} KM`, (a[0] + b[0]) / 2, a[1] - 12, { kind: "mono", size: 14, color: C.mid, align: "center", alpha: ba });
    // pressure arrows
    const pa = prog(t, tSqueeze - 1.5, 1.5);
    D.fatArrow(ctx, view.xy([13.5, 50.2]), view.xy([w - 0.6, 50.2]), { color: C.cyan, width: 90, p: pa, alpha: 0.75 });
    D.fatArrow(ctx, view.xy([52, 49.4]), view.xy([e + 0.6, 49.4]), { color: C.darkred, width: 90, p: pa, alpha: 0.85 });
    D.label(ctx, "WESTERN ALLIANCE", ...view.xy([12.5, 48.6]), { color: C.cyan, alpha: pa, size: 13 });
    D.label(ctx, "RUSSIAN FORCES", ...view.xy([47.5, 47.8]), { color: "#e06a72", alpha: pa, size: 13 });
  };
}

// ================================================================ 2. capabilities, not intentions
function s2(S) {
  const view = europe();
  const allied = [
    [7.6, 49.44, "B"], [11.9, 49.7, "B"], [17.5, 47.36, "B"], [16.9, 54.48, "A"], [19.2, 51.55, "B"], [19.1, 48.64, "B"],
    [21.9, 53.8, "F"], [23.4, 55.9, "B"], [22.0, 50.1, "B"], [23.8, 59.26, "B"], [24.8, 56.8, "B"], [24.4, 44.1, "A"],
    [25.96, 59.26, "F"], [28.5, 44.36, "B"],
  ].sort((a, b) => a[0] - b[0]);
  const russian = [[20.5, 54.7, "F"], [27.5, 53.3, "A"], [34.0, 45.1, "B"], [39.7, 47.2, "F"], [36.5, 51.0, "B"], [33.0, 54.5, "A"]];
  const tCap = S.at("Weapons are easier");
  const tRuCount = S.at("Russia, as");
  const tWestCount = S.at("The Western");
  const tKm = S.at("Security is");
  const tRuler = S.at("Relative power");
  const icon = (x, y, kind, col, a) => {
    if (a <= 0) return;
    if (kind === "B") D.square(ctx0, x, y, 12, col, { alpha: a, glow: 10 });
    else if (kind === "A") {
      D.square(ctx0, x, y, 12, col, { alpha: a, glow: 10, stroke: true });
      ctx0.save();
      ctx0.globalAlpha *= a;
      ctx0.strokeStyle = col;
      ctx0.lineWidth = 1.5;
      ctx0.beginPath();
      ctx0.arc(x, y - 4, 13, Math.PI * 1.1, Math.PI * 1.9);
      ctx0.stroke();
      ctx0.restore();
    } else {
      D.square(ctx0, x, y, 12, col, { alpha: a, glow: 10 });
      D.arrowHead(ctx0, x + 14, y - 10, -Math.PI / 4, 9, col, a);
    }
  };
  let ctx0;
  return (ctx, t) => {
    ctx0 = ctx;
    D.bg(ctx, { gridAlpha: 0.25 });
    view.base(ctx, { borderAlpha: 0.7, colors: { [ID.ukraine]: C.landHi, CRIMEA: C.landHi } });
    relief(ctx, view, 0.3);
    // intentions: sealed, never text
    const ia = fade(t, S.at("Intentions are"), 0.5, tCap, 0.6);
    const br = view.xy(P.brussels);
    const mo = view.xy(P.moscow);
    K.envelope(ctx, br[0], br[1] - 50, 60, { alpha: ia });
    K.envelope(ctx, mo[0], mo[1] - 50, 60, { alpha: ia });
    // allied infrastructure steps east
    allied.forEach(([lon, lat, k], i) => {
      const [x, y] = view.xy([lon, lat]);
      icon(x, y, k, C.cyan, prog(t, tCap + (i / allied.length) * (S.end("Weapons are easier") - S.start("Weapons are easier") + 2), 0.4, ease.out));
    });
    const legendA = prog(t, tCap, 0.6);
    [["B", "BASES"], ["A", "INTEGRATED AIR DEFENSE"], ["F", "LONG-RANGE FIRES"]].forEach(([k, n], i) => {
      icon(150, 860 + i * 40, k, C.mid, legendA);
      D.label(ctx, n, 180, 866 + i * 40, { color: C.mid, alpha: legendA, size: 13 });
    });
    // Russia counts on the steppe (dark-red tallies)
    const ra = prog(t, tRuCount, 0.6) * (1 - 0.75 * prog(t, tRuler, 0.8));
    const steppe = view.xy([33.5, 48.3]);
    ["AIR DEFENSE", "LONG-RANGE FIRES", "BASES"].forEach((n, i) => {
      const a = prog(t, tRuCount + i * 0.6, 0.5) * (1 - 0.75 * prog(t, tRuler, 0.8));
      const y = steppe[1] - 40 + i * 34;
      D.panel(ctx, steppe[0] - 120, y - 22, 240, 30, { alpha: a, color: C.darkred, fill: rgba(C.darkredDeep, 0.85), r: 3, sfx: n });
      D.text(ctx, n, steppe[0] - 108, y - 2, { kind: "mono", size: 12, color: "#f0a0a6", alpha: a, tracking: 1 });
      const n2 = Math.floor(clamp((t - tRuCount - i * 0.6) / 3) * (3 + i * 2));
      D.text(ctx, "|".repeat(n2), steppe[0] + 108, y - 2, { kind: "mono", size: 14, color: "#f0a0a6", alpha: a, align: "right" });
    });
    D.label(ctx, "COUNTED IN MOSCOW", steppe[0], steppe[1] - 74, { align: "center", color: "#e06a72", alpha: ra, size: 12 });
    // the alliance counts Russian capabilities the same way
    russian.forEach(([lon, lat, k], i) => {
      const [x, y] = view.xy([lon, lat]);
      const a = prog(t, tWestCount + i * 0.25, 0.4);
      icon(x, y, k, C.darkred, a);
      D.brackets(ctx, x - 16, y - 16, 32, 32, { color: C.cyan, len: 7, lw: 1.5, alpha: prog(t, tWestCount + 1.4 + i * 0.2, 0.4) });
    });
    // one kilometre, two forward positions
    const ka = fade(t, tKm, 0.4, tRuler + 1, 0.6);
    if (ka > 0) {
      const [x, y] = view.xy([31.5, 49.6]);
      const flip = Math.floor((t - tKm) * 2.2) % 2 === 0;
      D.square(ctx, x, y, 22, flip ? C.cyan : C.darkred, { stroke: true, alpha: ka, glow: 14 });
      D.label(ctx, "1 KM", x + 22, y + 5, { color: C.ice, alpha: ka, size: 13 });
    }
    // relative power ruler
    const rr = prog(t, tRuler, 0.6);
    if (rr > 0) {
      const sh = prog(t, tRuler + 0.4, Math.max(2, S.dur - tRuler - 1.5));
      const a = view.xy([lerp(24.4, 30.5, sh), 46.3]);
      const b = view.xy([lerp(39.5, 35.5, sh), 46.3]);
      D.stroke(ctx, [a, b], { color: C.ice, width: 2, alpha: rr });
      for (const p of [a, b]) D.stroke(ctx, [[p[0], p[1] - 12], [p[0], p[1] + 12]], { color: C.ice, width: 2, alpha: rr });
      const km = Math.round(((lerp(39.5, 35.5, sh) - lerp(24.4, 30.5, sh)) * 111.3 * Math.cos((46.3 * Math.PI) / 180)) / 10) * 10;
      D.text(ctx, "THE POWER GAP", (a[0] + b[0]) / 2, a[1] + 38, { size: 22, weight: 600, tracking: 6, align: "center", alpha: rr });
      D.text(ctx, `${km} KM`, (a[0] + b[0]) / 2, a[1] - 14, { kind: "mono", size: 14, color: C.mid, align: "center", alpha: rr });
    }
  };
}

// ================================================================ 3. how the buffer thinned
function s3(S) {
  const view = europe();
  const uav = ukraine();
  uav.setCam(uav.camAt([32.5, 48.4], 0.95));
  const waves = [
    [1999, ["616", "203", "348"]],
    [2004, ["440", "428", "233", "703", "705", "642", "100"]],
    [2009, ["008", "191"]],
    [2017, ["499"]],
    [2020, ["807"]],
  ];
  const old = NATO.filter((id) => !waves.flatMap((w) => w[1]).includes(id) && !["246", "752"].includes(id));
  const donbas2014 = [[37.6, 48.3], [38.3, 48.85], [38.9, 49.1], [39.8, 48.95], [40.15, 48.3], [39.6, 47.6], [38.3, 47.1], [37.8, 47.1], [37.5, 47.6]];
  const cA = S.at("After the");
  const cB = S.at("In two");
  const cC = S.at("The government");
  const cD = S.at("The Minsk");
  const cE = S.at("By twenty");
  const year = (t) => (t < cB ? lerp(1991, 2004, prog(t, cA, 4)) : t < cC ? 2008 : t < cD ? 2014 : t < cE ? 2015 : 2022);
  return (ctx, t) => {
    D.bg(ctx, { gridAlpha: 0.25 });
    const phase = t < cB ? "A" : t < cC ? "B" : t < cD ? "C" : t < cE ? "D" : "E";
    if (phase === "A" || phase === "E") {
      const colors = {};
      for (const id of old) colors[id] = rgba(C.cyan, 0.32);
      waves.forEach(([yr, ids], i) => {
        const a = phase === "E" ? 1 : prog(t, cA + i * 0.8, 0.6);
        for (const id of ids) colors[id] = rgba(C.cyan, 0.32 * a);
      });
      view.base(ctx, { colors, borderAlpha: 0.6 });
      const ua = view.union(UA);
      const width = phase === "E" ? 0 : 1;
      view.draw(ctx, ua, { fill: rgba(PALE_AMBER, 0.22 * width), stroke: rgba(PALE_AMBER, 0.5), width: 1.2 });
      if (phase === "A") {
        waves.forEach(([yr], i) => {
          D.label(ctx, String(yr), 140, 300 + i * 34, { color: C.cyan, alpha: prog(t, cA + i * 0.8, 0.5), size: 15 });
        });
        D.label(ctx, "ALLIANCE ENLARGEMENT", 140, 268, { color: C.mid, alpha: prog(t, cA, 0.5), size: 13 });
      } else {
        const l = view.line([[24.0, 51.5], [27.5, 50.0], [31.0, 49.0], [34.5, 48.6], [38.5, 48.0]]);
        D.stroke(ctx, D.smoothPts(l), { color: PALE_AMBER, width: 2, glow: 12, alpha: prog(t, cE, 0.5) });
        K.chip(ctx, "2022 · THE BUFFER HAS COLLAPSED", 960, 960, { color: PALE_AMBER, align: "center", alpha: prog(t, cE + 0.6, 0.6), size: 18 });
      }
    } else if (phase === "B") {
      // Bucharest declaration card
      D.panel(ctx, 460, 250, 1000, 470, { title: "Bucharest summit declaration · 2008", fill: rgba("#0f141b", 0.95) });
      D.text(ctx, "“WE AGREED TODAY THAT THESE COUNTRIES", 520, 380, { size: 38, weight: 600, tracking: 3 });
      D.text(ctx, "WILL BECOME MEMBERS OF NATO.”", 520, 432, { size: 38, weight: 600, tracking: 3 });
      D.text(ctx, "§23 · ON UKRAINE AND GEORGIA", 520, 480, { kind: "mono", size: 15, color: C.mid, tracking: 2 });
      D.stroke(ctx, [[520, 540], [1400, 540]], { color: C.border, width: 1 });
      D.text(ctx, "DATE:", 520, 600, { kind: "mono", size: 22, color: C.mid });
      const da = prog(t, S.at("It set"), 0.4);
      ctx.save();
      ctx.globalAlpha = da;
      ctx.strokeStyle = C.crimson;
      ctx.setLineDash([8, 8]);
      ctx.lineWidth = 2;
      ctx.strokeRect(610, 572, 300, 40);
      ctx.restore();
      D.text(ctx, "— NONE SET —", 760, 600, { kind: "mono", size: 18, color: C.crimson, align: "center", alpha: da });
      K.chip(ctx, "KYIV · AN EXPECTATION", 560, 820, { color: PALE_AMBER, alpha: prog(t, S.at("It created", 0.2), 0.5), size: 18 });
      K.chip(ctx, "MOSCOW · A DEADLINE", 1360, 820, { color: "#e06a72", align: "right", alpha: prog(t, S.at("It created", 0.6), 0.5), size: 18 });
    } else if (phase === "C") {
      uav.base(ctx, { colors: { [ID.ukraine]: WEST_STATE, CRIMEA: WEST_STATE, [ID.russia]: "#1e1a1d" } });
      const kyiv = uav.xy(P.kyiv);
      D.diamond(ctx, kyiv[0], kyiv[1], 10, C.ice);
      K.chip(ctx, "GOVERNMENT OVERTURNED · 2014", kyiv[0] + 24, kyiv[1] - 20, { color: C.ice, alpha: prog(t, cC, 0.5), size: 15 });
      const ca = prog(t, S.at("Crimea was"), 0.5);
      uav.draw(ctx, uav.country("CRIMEA"), { fill: rgba(C.darkred, 0.75 * ca), stroke: C.darkred, width: 1.5, alpha: 1 });
      const da = prog(t, S.at("The Donbas"), 0.5);
      uav.withClip(ctx, uav.country(ID.ukraine), () => uav.draw(ctx, uav.pathOf(poly(donbas2014)), { fill: rgba(C.darkred, 0.75 * da) }));
      D.label(ctx, "CRIMEA SEIZED", ...uav.xy([33.0, 44.9]), { color: "#f0a0a6", alpha: ca, size: 14, align: "right" });
      D.label(ctx, "DONBAS WAR", ...uav.xy([39.2, 46.9]), { color: "#f0a0a6", alpha: da, size: 14 });
      // the tear
      const tear = D.crackPts(uav.xy([34.6, 46.0]), uav.xy([39.6, 49.6]), 13, 0.08, 20);
      D.stroke(ctx, tear, { color: C.ice, width: 2, glow: 12, to: prog(t, S.at("Crimea was"), 1.8), alpha: 0.85 });
    } else {
      // Minsk documents, unimplemented
      const doc = (x, title, sub, a) => {
        D.panel(ctx, x, 230, 420, 520, { alpha: a, fill: rgba("#0f141b", 0.95), sfx: title });
        D.text(ctx, title, x + 30, 290, { size: 30, weight: 600, tracking: 4, alpha: a });
        D.text(ctx, sub, x + 30, 318, { kind: "mono", size: 13, color: C.dim, alpha: a });
        for (let i = 0; i < 9; i++) D.stroke(ctx, [[x + 30, 360 + i * 30], [x + 30 + (i % 3 === 2 ? 220 : 350), 360 + i * 30]], { color: C.border, width: 3, alpha: a });
        D.text(ctx, "IMPLEMENTED", x + 30, 690, { kind: "mono", size: 14, color: C.mid, alpha: a });
        ctx.save();
        ctx.globalAlpha = a;
        ctx.strokeStyle = C.mid;
        ctx.strokeRect(x + 170, 672, 22, 22);
        ctx.restore();
      };
      doc(420, "MINSK I", "SEPTEMBER 2014", prog(t, cD, 0.4));
      doc(1080, "MINSK II", "FEBRUARY 2015", prog(t, cD + 0.4, 0.4));
      D.stamp(ctx, "NOT CARRIED OUT", 960, 520, t, S.at("They were"), { color: C.crimson, size: 40, angle: -0.1 });
      const ua1 = prog(t, S.at("Minsk left", 0.1), 0.5);
      const ua2 = prog(t, S.at("Minsk left", 0.5), 0.5);
      K.chip(ctx, "AUTONOMY IN THE EAST · UNRESOLVED", 420, 820, { color: PALE_AMBER, alpha: ua1, size: 15 });
      K.chip(ctx, "CONTROL OF THE BORDER · UNRESOLVED", 1500, 820, { color: PALE_AMBER, alpha: ua2, size: 15, align: "right" });
      K.chip(ctx, "AGREEMENTS BUY TIME TO REARM", 960, 900, { color: C.ice, align: "center", alpha: prog(t, S.at("Each unimplemented"), 0.5), size: 16 });
    }
    // timeline strip
    const tx0 = 300;
    const tx1 = 1620;
    const ty = 160;
    const yx = (y) => lerp(tx0, tx1, (y - 1991) / 31);
    D.stroke(ctx, [[tx0, ty], [tx1, ty]], { color: C.dim, width: 1.5 });
    for (const y of [1991, 1999, 2004, 2008, 2014, 2022]) {
      D.stroke(ctx, [[yx(y), ty - 6], [yx(y), ty + 6]], { color: C.mid, width: 1.5 });
      D.text(ctx, String(y), yx(y), ty - 16, { kind: "mono", size: 13, color: year(t) >= y ? C.ice : C.dim, align: "center" });
    }
    const yr = year(t);
    D.stroke(ctx, [[tx0, ty], [yx(yr), ty]], { color: PALE_AMBER, width: 3, glow: 8 });
    D.node(ctx, yx(yr), ty, 6, PALE_AMBER, { ring: false });
  };
}

// ================================================================ 4. the neutral blueprint
function s4(S) {
  const sheet = { x: 170, y: 150, w: 1180, h: 820 };
  const view = new MapView(geoMercator().scale(3300).translate([W / 2, H / 2]), { res: "50m", bbox: [[18, 42], [44, 56]] });
  view.setCam(K.camFor(view, [31.5, 48.6], 1, sheet.x + 520, sheet.y + 400));
  const fin = new MapView(geoMercator().scale(560).translate([W / 2, H / 2]), { res: "50m", bbox: [[18, 58], [34, 71]] });
  fin.setCam(K.camFor(fin, [26, 64.8], 1, sheet.x + sheet.w - 150, sheet.y + 178));
  const sites = [];
  for (let lon = 24; lon <= 39; lon += 2.5) for (let lat = 45.5; lat <= 51.5; lat += 1.6) sites.push([lon + ((lat * 7) % 1), lat]);
  const tSlide = S.at("On this");
  return (ctx, t) => {
    D.bg(ctx, { gridAlpha: 0.2 });
    const slide = prog(t, tSlide, 2.2, ease.inOut);
    ctx.save();
    ctx.translate(-slide * 820, slide * 30);
    ctx.globalAlpha = 1 - slide * 0.72;
    // the sheet
    const { x, y, w, h } = sheet;
    ctx.fillStyle = "#0b1724";
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = rgba(C.cyan, 0.08);
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let gx = x; gx <= x + w; gx += 30) {
      ctx.moveTo(gx, y);
      ctx.lineTo(gx, y + h);
    }
    for (let gy = y; gy <= y + h; gy += 30) {
      ctx.moveTo(x, gy);
      ctx.lineTo(x + w, gy);
    }
    ctx.stroke();
    ctx.strokeStyle = rgba(C.ice, 0.6);
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 10, y + 10, w - 20, h - 20);
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 16, y + 16, w - 32, h - 32);
    // title block
    ctx.strokeRect(x + w - 380, y + h - 116, 364, 100);
    D.text(ctx, "NEUTRAL UKRAINE · SHEET 01", x + w - 364, y + h - 80, { kind: "mono", size: 14, color: C.ice });
    D.text(ctx, "J. SACHS · A NEUTRALITY PROPOSAL", x + w - 364, y + h - 56, { kind: "mono", size: 12, color: C.mid });
    D.text(ctx, "REV. — · NOT BUILT", x + w - 364, y + h - 34, { kind: "mono", size: 12, color: C.dim });
    // outline
    const oa = prog(t, 0.3, 1.5);
    view.draw(ctx, view.union(UA), { stroke: C.ice, width: 2, alpha: oa, fill: rgba(C.ice, 0.03) });
    D.label(ctx, "SOVEREIGN UKRAINE", ...view.xy([30.5, 52.2]), { color: C.ice, alpha: oa, size: 15, align: "center" });
    // economic arrows west
    const ea = prog(t, S.at("A sovereign", 0.15), 1);
    for (let i = 0; i < 3; i++) {
      const s0 = view.xy([25.5, 47.8 + i * 1.3]);
      D.arrow(ctx, [s0, [s0[0] - 190, s0[1]]], { color: C.steel, width: 4, to: ea, head: 16 });
    }
    D.label(ctx, "ECONOMIC · OPEN TO THE EU", x + 40, view.xy([25, 46.9])[1] + 40, { color: C.steel, alpha: ea, size: 13 });
    // military arrows: absent
    const ma = prog(t, S.at("A sovereign", 0.6), 0.8);
    for (const [from, to, lab] of [
      [[25.5, 45.4], [21.5, 45.4], "MILITARY · WEST"],
      [[38.5, 45.4], [42.5, 45.4], "MILITARY · EAST"],
    ]) {
      const a = view.xy(from);
      const b = view.xy(to);
      D.stroke(ctx, [a, b], { color: C.mid, width: 2, dash: [6, 8], alpha: ma * 0.6 });
      const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      ctx.save();
      ctx.globalAlpha = ma;
      ctx.strokeStyle = C.crimson;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(m[0], m[1], 12, 0, Math.PI * 2);
      ctx.moveTo(m[0] - 8, m[1] + 8);
      ctx.lineTo(m[0] + 8, m[1] - 8);
      ctx.stroke();
      ctx.restore();
      D.label(ctx, lab, m[0], m[1] + 34, { color: C.mid, alpha: ma, size: 12, align: "center" });
    }
    K.chip(ctx, "FOREIGN BASES: 0", x + 380, y + h - 92, { color: C.ice, alpha: prog(t, S.at("No foreign"), 0.4), size: 15 });
    K.chip(ctx, "ALLIANCE MEMBERSHIP: NONE", x + 380, y + h - 40, { color: C.ice, alpha: prog(t, S.at("No alliance"), 0.4), size: 15 });
    // verification grid
    const va = prog(t, S.at("A long"), 1.5, ease.linear);
    sites.forEach((ll, i) => {
      const [sx, sy] = view.xy(ll);
      const a = clamp(va * sites.length - i);
      view.withClip(ctx, view.union(UA), () => {
        ctx.save();
        ctx.globalAlpha = a;
        ctx.strokeStyle = C.green;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(sx - 8, sy - 8, 16, 16);
        ctx.beginPath();
        ctx.moveTo(sx - 4, sy);
        ctx.lineTo(sx - 1, sy + 4);
        ctx.lineTo(sx + 5, sy - 4);
        ctx.stroke();
        ctx.restore();
      });
    });
    D.label(ctx, "INSPECTIONS CHECK THE AGREEMENT", x + 40, y + 50, { color: C.green, alpha: prog(t, S.at("A long") + 0.8, 0.5), size: 13 });
    // Finland reference inset
    const fa = prog(t, S.at("The reference"), 0.8);
    if (fa > 0) {
      const ix = x + w - 270;
      const iy = y + 40;
      D.panel(ctx, ix, iy, 240, 300, { alpha: fa, fill: rgba("#0b1724", 0.95), color: rgba(C.ice, 0.5), sfx: "Finland reference" });
      ctx.save();
      ctx.globalAlpha = fa;
      ctx.beginPath();
      ctx.rect(ix, iy + 40, 240, 200);
      ctx.clip();
      fin.draw(ctx, fin.country(ID.finland), { fill: rgba(C.ice, 0.12), stroke: C.ice, width: 1.5 });
      ctx.restore();
      D.label(ctx, "REFERENCE", ix + 120, iy + 30, { align: "center", color: C.ice, alpha: fa, size: 14, weight: 600 });
      D.label(ctx, "FINLAND AFTER 1945", ix + 120, iy + 266, { align: "center", color: C.mid, alpha: fa, size: 12 });
      D.label(ctx, "NON-ALIGNED · INTACT", ix + 120, iy + 286, { align: "center", color: C.green, alpha: fa, size: 12 });
    }
    ctx.restore();
    // after the slide: why the blueprint was shelved
    const fA = prog(t, S.at("Washington and"), 0.6);
    const flowY = 300;
    ["NEUTRALITY", "WAITING ROOM", "ENLARGEMENT"].forEach((n, i) => {
      const bx = 820 + i * 340;
      K.boxNode(ctx, bx, flowY, 280, 80, n, { color: i === 2 ? C.cyan : C.steel, alpha: prog(t, S.at("Washington and") + i * 0.6, 0.5), titleSize: 18 });
      if (i < 2) D.arrow(ctx, [[bx + 145, flowY], [bx + 195, flowY]], { color: C.mid, width: 2, head: 10, to: prog(t, S.at("Washington and") + i * 0.6 + 0.4, 0.4), alpha: fA });
    });
    D.label(ctx, "NEUTRALITY AS A WAITING ROOM", 680, flowY - 70, { color: C.mid, alpha: fA, size: 13 });
    const rA = prog(t, S.at("The Military-Industrial"), 0.6);
    D.panel(ctx, 680, 430, 1140, 150, { alpha: rA, title: "Standing preference · Military-Industrial Complex" });
    D.text(ctx, "BASES CLOSER TO RUSSIA", 720, 530, { size: 30, weight: 600, tracking: 3, color: C.cyan, alpha: rA });
    D.text(ctx, ">", 1170, 530, { size: 36, weight: 600, color: C.ice, alpha: rA });
    D.text(ctx, "A WIDE NEUTRAL ZONE", 1220, 530, { size: 30, weight: 600, tracking: 3, color: C.mid, alpha: rA });
    // balance: concern vs pledge
    const bA = prog(t, S.at("Sachs claims"), 0.6);
    if (bA > 0) {
      const tilt = 0.16 * prog(t, S.at("Sachs claims") + 1.2, 1.5, ease.outBack);
      const cx = 1250;
      const cy = 700;
      ctx.save();
      ctx.globalAlpha = bA;
      ctx.strokeStyle = C.ice;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx, cy + 200);
      ctx.moveTo(cx - 60, cy + 200);
      ctx.lineTo(cx + 60, cy + 200);
      ctx.stroke();
      ctx.translate(cx, cy);
      ctx.rotate(tilt);
      ctx.beginPath();
      ctx.moveTo(-330, 0);
      ctx.lineTo(330, 0);
      ctx.stroke();
      ctx.restore();
      const lx = cx - Math.cos(tilt) * 330;
      const ly = cy - Math.sin(tilt) * 330;
      const rx = cx + Math.cos(tilt) * 330;
      const ry = cy + Math.sin(tilt) * 330;
      K.boxNode(ctx, lx, ly + 60, 300, 70, "RUSSIAN SECURITY CONCERN", { color: C.darkred, alpha: bA, titleSize: 16 });
      K.boxNode(ctx, rx, ry + 60, 300, 70, "ENLARGEMENT PLEDGE", { color: C.cyan, alpha: bA, titleSize: 16 });
      D.label(ctx, "NOT RANKED AS EQUAL", cx, cy + 240, { align: "center", color: C.mid, alpha: prog(t, S.at("Sachs claims") + 2, 0.6), size: 13 });
    }
  };
}

// ================================================================ 5. the indivisible object
function s5(S) {
  const cx = 960;
  const cy = 560;
  const seats = [
    { x: 560, y: 330, col: C.cyan, name: "THE ALLIANCE", demand: "DEMAND: ENLARGEMENT OPTION" },
    { x: 1360, y: 330, col: C.darkred, name: "RUSSIA", demand: "DEMAND: DEPTH" },
    { x: 960, y: 900, col: PALE_AMBER, name: "UKRAINE", demand: "DEMAND: A PATRON" },
  ];
  const removals = [
    [0, "BUCHAREST · 2008", S.at("Bucharest, the", 0.05)],
    [2, "MINSK FAILS", S.at("Bucharest, the", 0.35)],
    [1, "INVASION · 2022", S.at("Bucharest, the", 0.72)],
  ];
  const hex = (r) => {
    const pts = [];
    for (let i = 0; i <= 6; i++) pts.push([cx + Math.cos((i * Math.PI) / 3 + Math.PI / 6) * r, cy + Math.sin((i * Math.PI) / 3 + Math.PI / 6) * r]);
    return pts;
  };
  const tEmpty = S.at("Once the");
  const tSplit = S.at("A partition");
  return (ctx, t) => {
    D.bg(ctx, { gridAlpha: 0.2 });
    const split = prog(t, tSplit, 2.5);
    // board
    ctx.save();
    ctx.globalAlpha = 1;
    D.roundRect(ctx, 300, 170, 1320, 860, 12);
    ctx.fillStyle = "#10151c";
    ctx.fill();
    ctx.strokeStyle = C.border;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
    if (split > 0) {
      // two territories and a fortified line
      const fl = [[1060, 180], [1020, 330], [1050, 470], [990, 610], [1030, 760], [980, 900], [1000, 1020]];
      ctx.save();
      ctx.globalAlpha = split;
      ctx.beginPath();
      ctx.moveTo(300, 170);
      fl.forEach(([x, y]) => ctx.lineTo(x, y));
      ctx.lineTo(300, 1030);
      ctx.closePath();
      ctx.fillStyle = rgba(WEST_STATE, 0.7);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(1620, 170);
      fl.forEach(([x, y]) => ctx.lineTo(x, y));
      ctx.lineTo(1620, 1030);
      ctx.closePath();
      ctx.fillStyle = rgba(OCC, 0.75);
      ctx.fill();
      ctx.restore();
      fortified(ctx, D.smoothPts(fl, 6), { color: C.ice, alpha: split, to: split });
      D.text(ctx, "TIES TO EUROPE", 640, 600, { size: 22, weight: 600, tracking: 3, align: "center", alpha: prog(t, tSplit + 1, 0.6), color: PALE_AMBER });
      D.text(ctx, "RUSSIAN DEPTH", 1320, 600, { size: 22, weight: 600, tracking: 4, align: "center", alpha: prog(t, tSplit + 1.4, 0.6), color: "#f0a0a6" });
    }
    const boardA = 1 - split;
    // the central object
    const empty = prog(t, tEmpty, 1);
    const ha = boardA * (1 - empty);
    D.stroke(ctx, hex(110), { color: C.ice, width: 3, alpha: Math.max(ha, boardA * empty * 0.5), dash: empty > 0 ? [8, 8] : undefined, glow: 16 * ha });
    if (ha > 0) {
      ctx.save();
      ctx.globalAlpha = ha;
      ctx.beginPath();
      hex(110).forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.fillStyle = rgba(C.ice, 0.08);
      ctx.fill();
      ctx.restore();
    }
    D.text(ctx, empty > 0.5 ? "CENTER EMPTY" : "ALIGNMENT", cx, cy + 10, { size: 24, weight: 600, tracking: 5, align: "center", alpha: boardA * (empty > 0.5 ? empty : 1 - empty * 2), color: empty > 0.5 ? C.mid : C.ice });
    // attempts to split it
    for (const [t0, ang] of [[S.at("Military alignment"), -0.6], [S.at("Bases, fused", 0.5), 0.7]]) {
      const p = prog(t, t0, 0.9, ease.inOut);
      if (p > 0 && p < 1 && boardA > 0) {
        const L = 300;
        const a = [cx - Math.cos(ang) * L, cy - Math.sin(ang) * L];
        const b = [cx + Math.cos(ang) * L, cy + Math.sin(ang) * L];
        const bounce = p > 0.5 ? 1 - (p - 0.5) * 2 : p * 2;
        const tip = D.pointAt([a, b], 0.5 * bounce);
        D.stroke(ctx, [a, [tip.x, tip.y]], { color: C.crimson, width: 2.5, glow: 10, alpha: boardA });
      }
      const fl = fade(t, t0 + 0.45, 0.15, t0 + 1.6, 0.5);
      if (fl > 0) D.text(ctx, "INDIVISIBLE", cx, cy - 140, { kind: "mono", size: 18, tracking: 4, align: "center", color: C.crimson, alpha: fl * boardA });
    }
    // players
    seats.forEach((s, i) => {
      const a = prog(t, 0.3 + i * 0.3, 0.6) * boardA;
      D.node(ctx, s.x, s.y, 26, s.col, { alpha: a, glow: 22 });
      D.label(ctx, s.name, s.x, s.y + (s.y > cy ? 62 : -44), { align: "center", color: C.ice, alpha: a, size: 16, weight: 600 });
      K.chip(ctx, s.demand, s.x, s.y + (s.y > cy ? 106 : -86), { color: s.col, align: "center", alpha: fade(t, S.at("There’s", 0.2 + i * 0.25), 0.5, S.at("The neutral"), 0.6) * boardA, size: 13 });
    });
    // the neutral-center bargain: each player's token
    const ba = prog(t, S.at("The neutral"), 0.8) * boardA;
    seats.forEach((s, i) => {
      const rem = removals.find((r) => r[0] === i);
      const gone = prog(t, rem[2], 0.7, ease.inOut);
      const a = ba * (1 - gone);
      const tx = lerp(s.x, cx, 0.42);
      const ty = lerp(s.y, cy, 0.42);
      D.stroke(ctx, [[s.x, s.y], [cx, cy]], { color: s.col, width: 1.2, dash: [5, 6], alpha: a * 0.7 });
      D.node(ctx, tx + gone * (s.x < cx ? -60 : s.x > cx ? 60 : 0), ty + gone * (s.y > cy ? 60 : -60), 12, C.green, { alpha: a, glow: 12, ring: true });
      D.label(ctx, "PREFERS 2ND-BEST", tx, ty + (s.y > cy ? 36 : -24), { align: "center", color: C.green, alpha: a, size: 11 });
      const ea = fade(t, rem[2], 0.3, rem[2] + 2.8, 0.6) * boardA;
      if (ea > 0) K.chip(ctx, rem[1], tx, ty + (s.y > cy ? 70 : -60), { color: C.crimson, align: "center", alpha: ea, size: 14 });
    });
    D.caption(ctx, "The map after neutrality fails", t, S.at("The line"), { y: 1000, x: 330 });
  };
}

// ================================================================ 6. equilibrium B: the contact-line freeze
function s6(S) {
  const view = ukraine();
  const ua = view.union(UA);
  const occ = view.pathOf(poly(OCCUPIED));
  const camFull = view.camAt([30.2, 48.7], 0.84);
  const camCrimea = K.camFor(view, [34.0, 45.15], 2.3, 960, 560);
  const camDepth = K.camFor(view, [36.0, 47.2], 1.45, 960, 560);
  const cities = [[P.kyiv, "KYIV"], [P.dnipro, "DNIPRO"], [P.zaporizhzhia, "ZAPORIZHZHIA"], [[33.42, 49.07], "KREMENCHUK"], [[32.06, 49.44], "CHERKASY"], [P.lviv, "LVIV"], [P.odesa, "ODESA"], [P.kharkiv, "KHARKIV"]];
  const natoIds = [ID.poland, ID.slovakia, ID.hungary, ID.romania];
  const tLine = S.at("The default");
  const tCrimea = S.at("Crimea stays");
  const tDepth = S.at("The land");
  const tWest = S.at("West of");
  const tArms = S.at("It integrates");
  const tHalo = S.at("Full membership");
  return (ctx, t) => {
    D.bg(ctx, { gridAlpha: 0.2 });
    const c1 = prog(t, tCrimea - 0.5, 2.5);
    const c2 = prog(t, tDepth, 2.5);
    const c3 = prog(t, tWest, 2.5);
    view.setCam(MapView.mixCam(MapView.mixCam(MapView.mixCam(camFull, camCrimea, c1), camDepth, c2), camFull, c3));
    const halo = prog(t, tHalo, 1.2);
    const colors = { [ID.russia]: "#1c1719", [ID.belarus]: "#1c1a1c" };
    for (const id of natoIds) colors[id] = mix(C.land, "#0d3a4a", halo);
    view.base(ctx, { colors, borderAlpha: 0.7 });
    const wa = prog(t, tWest, 1.2);
    view.draw(ctx, ua, { fill: mix(C.land, WEST_STATE, Math.max(0.35, wa)) });
    view.withClip(ctx, ua, () => view.draw(ctx, occ, { fill: OCC, alpha: Math.max(prog(t, tLine, 1) * 0.7, prog(t, tDepth, 1)) }));
    view.draw(ctx, ua, { stroke: rgba(PALE_AMBER, 0.4 + 0.4 * wa), width: 1.5 });
    // NATO halo, stops at the border
    if (halo > 0) for (const id of natoIds) view.draw(ctx, view.country(id), { stroke: C.cyan, width: 2, glow: 18, alpha: halo * 0.85 });
    D.label(ctx, "NATO PROTECTION ENDS HERE", ...view.xy([19.6, 51.5]), { color: C.cyan, alpha: halo, size: 13, align: "center" });
    // contact line
    fortified(ctx, view.line(CONTACT_LINE), { color: C.ice, to: prog(t, tLine, 3), alpha: 1 });
    D.label(ctx, contactLine.caption, ...view.xy([36.4, 47.15]), { color: C.dim, alpha: prog(t, tLine + 1.2, 0.5), size: 12, align: "center" });
    // Sevastopol
    const sv = view.xy(P.sevastopol);
    const sa = prog(t, tCrimea + 1, 0.6);
    D.node(ctx, sv[0], sv[1], 10, C.darkred, { alpha: sa, glow: 24, pulseT: t });
    D.label(ctx, "SEVASTOPOL · BLACK SEA FLEET", sv[0] - 20, sv[1] + 36, { color: "#f0a0a6", alpha: sa, size: 14, align: "right" });
    const fleetA = fade(t, tCrimea + 3, 0.6, tDepth, 0.6);
    D.label(ctx, "A HOSTILE COAST THREATENS THE FLEET", sv[0], sv[1] + 66, { color: C.mid, alpha: fleetA, size: 12, align: "center" });
    // depth
    const da = prog(t, tDepth + 0.6, 0.8) * (1 - c3 * 0.4);
    D.text(ctx, "DEPTH", ...view.xy([38.9, 47.55]), { size: 30, weight: 600, tracking: 10, align: "center", color: "#f0a0a6", alpha: da });
    D.label(ctx, "LAND CONNECTION", ...view.xy([35.2, 46.75]), { color: "#f0a0a6", alpha: da, size: 12, align: "center" });
    D.label(ctx, "DONBAS BELT", ...view.xy([39.0, 48.75]), { color: "#f0a0a6", alpha: da, size: 12, align: "center" });
    // the western state
    cities.forEach(([ll, n], i) => {
      const [x, y] = view.xy(ll);
      const a = prog(t, tWest + 0.6 + i * 0.15, 0.4);
      if (n === "KYIV") D.diamond(ctx, x, y, 9, PALE_AMBER, { alpha: a });
      else D.node(ctx, x, y, 4, PALE_AMBER, { alpha: a, ring: false, glow: 8 });
      D.label(ctx, n, x + 12, y - 8, { color: n === "KYIV" ? C.ice : C.mid, alpha: a, size: n === "KYIV" ? 15 : 12 });
    });
    // armed from outside
    const aa = prog(t, tArms, 1);
    for (const [from, to] of [[[19.0, 50.6], [24.6, 50.2]], [[19.5, 52.4], [24.8, 51.3]], [[24.0, 46.6], [27.6, 47.9]]]) {
      D.arrow(ctx, [view.xy(from), view.xy(to)], { color: C.steel, width: 3, to: aa, head: 14, alpha: 0.9 });
    }
    D.label(ctx, "ARMED FROM OUTSIDE", ...view.xy([20.2, 49.6]), { color: C.steel, alpha: aa, size: 13, align: "center" });
    K.chip(ctx, "FULL MEMBERSHIP · BLOCKED", 1800, 220, { color: C.cyan, align: "right", alpha: prog(t, tHalo + 1.5, 0.5), size: 15 });
    D.caption(ctx, "Contact-line freeze", t, S.at("The great"), { y: 1000 });
  };
}

// ================================================================ 7. the river line
function s7(S) {
  const view = new MapView(geoMercator().scale(2700).translate([W / 2, H / 2]), { res: "50m", bbox: [[4, 36], [60, 60]] });
  view.setCam(K.camFor(view, [31.6, 48.4], 0.66, 960, 345));
  const ua = view.union(UA);
  const occ = view.pathOf(poly(OCCUPIED));
  const dnieper = D.smoothPts(RIVERS.dnieper, 6);
  const tRiver = S.at("The Dnieper");
  const tDash = S.at("The model");
  const tCurves = S.at("Reaching it");
  const tRule = S.at("Move the");
  const tBase = S.at("The curves");
  const tDial = S.at("They cross");
  return (ctx, t) => {
    D.bg(ctx, { gridAlpha: 0.2 });
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 120, W, 470);
    ctx.clip();
    view.base(ctx, { colors: { [ID.russia]: "#1c1719" } });
    view.draw(ctx, ua, { fill: WEST_STATE, stroke: rgba(PALE_AMBER, 0.5), width: 1.2 });
    view.withClip(ctx, ua, () => view.draw(ctx, occ, { fill: OCC }));
    fortified(ctx, view.line(CONTACT_LINE), { color: C.ice, width: 2, tick: 5 });
    // the Dnieper: bright, then dashed
    const rl = view.line(dnieper);
    const dash = prog(t, tDash, 0.8);
    D.stroke(ctx, rl, { color: C.cyan, width: 4, glow: 20, to: prog(t, tRiver, 2), alpha: 1 - dash });
    D.stroke(ctx, rl, { color: C.cyan, width: 3, dash: [12, 10], alpha: dash, glow: 8 });
    const rm = view.xy([33.6, 49.5]);
    D.label(ctx, "DNIEPER", rm[0] + 14, rm[1], { color: C.cyan, alpha: prog(t, tRiver, 1), size: 15, weight: 600 });
    D.label(ctx, "CONTACT LINE", ...view.xy([38.6, 49.9]), { color: C.ice, size: 13 });
    ctx.restore();
    // chart: cost vs security value per kilometre west
    const ca = prog(t, tCurves - 0.5, 0.8);
    const gx = 360;
    const gy = 640;
    const gw = 1200;
    const gh = 330;
    D.axes(ctx, gx, gy, gw, gh, { alpha: ca, ticks: 3 });
    D.label(ctx, "KILOMETRES WEST OF THE CONTACT LINE →", gx + gw, gy + gh + 30, { align: "right", color: C.mid, alpha: ca, size: 12 });
    const xC = 0.12;
    const xR = 0.78;
    const X = (u) => gx + u * gw;
    D.stroke(ctx, [[X(xC), gy], [X(xC), gy + gh]], { color: C.ice, width: 1.5, dash: [4, 4], alpha: ca * 0.7 });
    D.label(ctx, "CONTACT LINE", X(xC), gy - 10, { align: "center", color: C.ice, alpha: ca, size: 12 });
    D.stroke(ctx, [[X(xR), gy], [X(xR), gy + gh]], { color: C.cyan, width: 1.5, dash: [10, 8], alpha: ca * 0.7 });
    D.label(ctx, "DNIEPER", X(xR), gy - 10, { align: "center", color: C.cyan, alpha: ca, size: 12 });
    const dial = prog(t, tDial + 1, 3, ease.inOut);
    // baseline: value meets cost exactly on the contact line; raised: only on the river
    const costAt = (u) => 0.3 + 0.55 * u;
    const cost = [];
    const val = [];
    for (let i = 0; i <= 50; i++) {
      const u = i / 50;
      cost.push([u, costAt(u)]);
      const vBase = costAt(xC) + 0.62 * (xC - u) + 0.25 * (u - xC) * (u - xC);
      const vHigh = costAt(xR) + 0.25 * (xR - u);
      val.push([u, clamp(lerp(vBase, vHigh, dial), 0.02, 1.05)]);
    }
    const cp = prog(t, tCurves, 2.5);
    D.series(ctx, gx, gy, gw, gh, cost, { color: C.ice, width: 3, p: cp, glow: 8, alpha: ca });
    D.series(ctx, gx, gy, gw, gh, val, { color: "#e06a72", width: 3, p: cp, glow: 8, alpha: ca });
    D.label(ctx, "MARGINAL COST", gx + gw + 14, gy + gh - 0.85 * gh, { color: C.ice, alpha: ca, size: 12 });
    D.label(ctx, "SECURITY GAIN FROM THE NEXT KM", gx + 14, gy + gh - val[0][1] * gh - 14, { color: "#e06a72", alpha: ca, size: 12 });
    D.label(ctx, "A SECOND, LARGER WAR", X(0.55), gy + gh - (0.3 + 0.55 * 0.55) * gh - 20, { color: C.ice, alpha: prog(t, tCurves + 2, 0.6), size: 12, align: "center" });
    // move only while value exceeds cost
    const ra = prog(t, tRule, 0.6);
    K.chip(ctx, "ADVANCE WHILE GAIN > COST", gx + gw - 20, gy + 36, { color: C.mid, alpha: ra, size: 13, align: "right" });
    // baseline crossing on the contact line
    const ba = prog(t, tBase, 0.5);
    const yB = gy + gh - (0.3 + 0.55 * xC) * gh;
    D.node(ctx, X(xC), yB, 8, C.ice, { alpha: ba, glow: 16, pulseT: t });
    D.label(ctx, "BASELINE CROSSING", X(xC) + 16, yB + 30, { color: C.ice, alpha: ba, size: 12 });
    // the cost dial, forced upward
    const da = prog(t, tDial, 0.6);
    D.gauge(ctx, 1640, 470, 70, lerp(0.25, 0.92, dial), { alpha: da, color: "#e06a72", label: "COST ACCEPTED" });
    const yR = gy + gh - (0.3 + 0.55 * xR) * gh;
    const ra2 = prog(t, tDial + 3.2, 0.6);
    D.node(ctx, X(xR), yR, 9, C.cyan, { alpha: ra2, glow: 20, pulseT: t });
    D.label(ctx, "SECOND, HIGHER CROSSING", X(xR) - 16, yR - 18, { color: C.cyan, alpha: ra2, size: 12, align: "right" });
    D.caption(ctx, "The river is where a bigger war would stop", t, tDial + 3.6, { y: 200, x: 1180, size: 21, tracking: 2 });
  };
}

// ================================================================ 8. the capital
function s8(S) {
  const view = new MapView(geoMercator().scale(3300).translate([W / 2, H / 2]), { res: "50m", bbox: [[18, 42], [44, 56]] });
  view.setCam(K.camFor(view, [31.5, 48.6], 1, 640, 600));
  const ua = view.union(UA);
  const occ = view.pathOf(poly(OCCUPIED));
  const tCrisis = S.at("A line");
  const tKyiv = S.at("The contact-line");
  const tGauge = S.at("That unresolved");
  const tCols = S.at("Mearsheimer expects");
  const tBlood = S.at("Once a war");
  const tStamp = S.at("It’s no");
  return (ctx, t) => {
    D.bg(ctx, { gridAlpha: 0.2 });
    const ga = prog(t, S.at("Sachs still"), 1) * 0.6;
    view.base(ctx, { colors: { [ID.russia]: "#1c1719" }, alpha: 1 });
    view.draw(ctx, ua, { fill: WEST_STATE, stroke: rgba(PALE_AMBER, 0.6), width: 1.4 });
    view.withClip(ctx, ua, () => view.draw(ctx, occ, { fill: OCC }));
    fortified(ctx, view.line(CONTACT_LINE), { color: C.ice, width: 2, tick: 6 });
    // a line through a capital
    const ca = fade(t, tCrisis, 0.5, tKyiv, 0.6);
    if (ca > 0) {
      const kx = view.xy(P.kyiv);
      const jit = [];
      for (let i = 0; i <= 20; i++) jit.push([kx[0] - 140 + i * 14, kx[1] + Math.sin(t * 14 + i * 1.7) * 9 * (1 - Math.abs(i - 10) / 12)]);
      D.stroke(ctx, jit, { color: C.crimson, width: 2.5, glow: 10, alpha: ca });
      K.chip(ctx, "A PERMANENT CRISIS", kx[0], kx[1] - 46, { color: C.crimson, align: "center", alpha: prog(t, S.at("It leaves a crisis"), 0.4) * ca, size: 14 });
    }
    // Kyiv, far enough and close enough
    const ka = prog(t, tKyiv, 0.6);
    const kx = view.xy(P.kyiv);
    D.diamond(ctx, kx[0], kx[1], 11, PALE_AMBER, { alpha: ka, glow: 18 });
    D.label(ctx, "KYIV", kx[0] - 18, kx[1] - 14, { color: C.ice, alpha: ka, size: 16, weight: 600, align: "right" });
    const near = view.xy([35.84, 47.45]);
    D.stroke(ctx, [kx, near], { color: C.ice, width: 1.5, dash: [6, 6], to: prog(t, tKyiv + 0.5, 1.2), alpha: ka });
    D.label(ctx, "≈ 500 KM TO THE FREEZE", (kx[0] + near[0]) / 2 + 16, (kx[1] + near[1]) / 2, { color: C.ice, alpha: prog(t, tKyiv + 1.4, 0.5), size: 12 });
    D.label(ctx, "KYIV CAN GOVERN · THE LOSS REMAINS", 120, 1000, { color: C.mid, alpha: prog(t, tKyiv + 3, 0.6) * (1 - prog(t, tStamp - 1, 0.5)), size: 12 });
    // political pressure gauge
    const gA = prog(t, tGauge, 0.6);
    const v = lerp(0.2, 0.86, prog(t, tGauge + 0.3, 1.5, ease.outBack)) + 0.015 * Math.sin(t * 3);
    D.gauge(ctx, 210, 330, 70, v, { alpha: gA, zones: [[0, 0.5, C.steel], [0.5, 0.75, C.amber], [0.75, 1, C.crimson]] });
    D.label(ctx, "POLITICAL PRESSURE", 210, 368, { align: "center", color: C.mid, alpha: gA, size: 12 });
    D.text(ctx, "LOSS UNRESOLVED", 210, 400, { size: 20, weight: 600, tracking: 4, align: "center", color: C.amber, alpha: gA });
    // faded single neutral state behind the columns
    if (ga > 0) {
      ctx.save();
      ctx.translate(850, -40);
      view.draw(ctx, ua, { fill: rgba(C.ice, 0.05), stroke: rgba(C.ice, 0.4), width: 1.2, alpha: ga });
      ctx.restore();
    }
    // two occupied columns
    const col = (x, title, sub, a, lens) => {
      D.panel(ctx, x, 270, 340, 400, { alpha: a, fill: rgba("#0f141b", 0.92), sfx: title.join(" ") });
      D.text(ctx, title[0], x + 170, 350, { size: 26, weight: 600, tracking: 2, align: "center", alpha: a });
      D.text(ctx, title[1], x + 170, 388, { size: 26, weight: 600, tracking: 2, align: "center", alpha: a });
      D.text(ctx, sub, x + 170, 420, { kind: "mono", size: 12, color: C.mid, align: "center", alpha: a });
      ctx.save();
      ctx.globalAlpha = a;
      ctx.strokeStyle = C.green;
      ctx.lineWidth = 6;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(x + 130, 530);
      ctx.lineTo(x + 160, 565);
      ctx.lineTo(x + 215, 495);
      ctx.stroke();
      ctx.restore();
      D.text(ctx, "OCCUPIED", x + 170, 630, { kind: "mono", size: 14, tracking: 3, color: C.green, align: "center", alpha: a });
      D.text(ctx, lens, x + 170, 650, { kind: "mono", size: 11, color: C.dim, align: "center", alpha: a });
    };
    col(1120, ["ON THE GROUND", "DIVIDED"], "THE LINE THAT HOLDS", prog(t, tCols, 0.6), "");
    col(1500, ["ON PAPER", "CLAIM REMAINS"], "THE CLAIM THAT REMAINS", prog(t, tCols + 1.2, 0.6), "");
    K.chip(ctx, "WAR HAS CHANGED THE PRICE OF A DEAL", 1490, 760, { color: C.ice, align: "center", alpha: prog(t, tBlood, 0.6), size: 13 });
    // the blueprint behind, stamped
    if (ga > 0) D.text(ctx, "SINGLE NEUTRAL STATE · STILL LEGIBLE", 1490, 236, { kind: "mono", size: 13, tracking: 3, align: "center", color: C.ice, alpha: ga });
    D.stamp(ctx, "NOT THE OUTCOME", 1490, 880, t, tStamp, { color: C.crimson, size: 34, angle: -0.06 });
  };
}

// ================================================================ 9. the repeated game
function s9(S) {
  const tCheat = S.at("Each side");
  const tLoop = S.at("The punishment");
  const tBars = S.at("The punishment", 0.5);
  const tCon = S.at("It rests");
  const tRearm = S.at("Rebuilding armies");
  const tFinal = S.at("The partition");
  return (ctx, t) => {
    D.bg(ctx, { gridAlpha: 0.2 });
    const L = [380, 420];
    const R = [1100, 420];
    const mid = [(L[0] + R[0]) / 2, 420];
    // the line
    fortified(ctx, [[mid[0], 200], [mid[0], 640]], { color: C.ice, width: 2.5, tick: 7 });
    D.label(ctx, "FREEZE LINE", mid[0], 186, { align: "center", color: C.ice, size: 13 });
    D.node(ctx, L[0], L[1], 30, PALE_AMBER, { glow: 18, alpha: prog(t, 0.2, 0.6) });
    D.node(ctx, R[0], R[1], 30, C.darkred, { glow: 18, alpha: prog(t, 0.4, 0.6) });
    D.label(ctx, "WESTERN-ARMED STATE", L[0], L[1] + 66, { align: "center", color: C.ice, size: 14 });
    D.label(ctx, "RUSSIA", R[0], R[1] + 66, { align: "center", color: C.ice, size: 14 });
    // cheat arrows
    const ca = prog(t, tCheat, 0.8);
    D.arrow(ctx, [[L[0] + 40, L[1] - 30], [mid[0] - 20, L[1] - 70]], { color: C.crimson, width: 3, to: ca, head: 14 });
    D.arrow(ctx, [[R[0] - 40, R[1] - 30], [mid[0] + 20, R[1] - 70]], { color: C.crimson, width: 3, to: ca, head: 14 });
    D.label(ctx, "CHEAT", (L[0] + mid[0]) / 2, L[1] - 80, { align: "center", color: C.crimson, alpha: ca, size: 14, weight: 600 });
    D.label(ctx, "CHEAT", (R[0] + mid[0]) / 2, R[1] - 80, { align: "center", color: C.crimson, alpha: ca, size: 14, weight: 600 });
    // punishment loop
    const la = prog(t, tLoop, 1.2);
    const loop = [];
    for (let i = 0; i <= 80; i++) {
      const a = Math.PI * 0.15 + (i / 80) * Math.PI * 1.7;
      loop.push([mid[0] + Math.cos(a + Math.PI / 2) * 300, 640 + Math.sin(a + Math.PI / 2) * 90 + 60]);
    }
    D.arrow(ctx, loop, { color: C.ice, width: 3, to: la, head: 16, alpha: 0.85 });
    D.text(ctx, "RETURN TO WAR", mid[0], 820, { size: 24, weight: 600, tracking: 5, align: "center", alpha: la });
    // weight
    ctx.save();
    ctx.globalAlpha = la;
    ctx.fillStyle = C.crimson;
    ctx.beginPath();
    ctx.moveTo(mid[0] - 60, 900);
    ctx.lineTo(mid[0] + 60, 900);
    ctx.lineTo(mid[0] + 44, 850);
    ctx.lineTo(mid[0] - 44, 850);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    D.text(ctx, "HIGH COST", mid[0], 883, { kind: "mono", size: 14, weight: 600, color: "#2a0006", align: "center", alpha: la });
    // the inequality
    const ba = prog(t, tBars, 0.8);
    const rearm = prog(t, tRearm, 2.5) * (1 - prog(t, tFinal, 1.5));
    const costH = lerp(330, 210, rearm);
    const gainH = lerp(120, 190, rearm);
    D.panel(ctx, 1320, 190, 500, 520, { alpha: ba, title: "The line holds while" });
    D.bar(ctx, 1420, 640, 110, costH, C.ice, { alpha: ba, p: prog(t, tBars, 1.2), glow: 10 });
    D.bar(ctx, 1620, 640, 110, gainH, C.crimson, { alpha: ba, p: prog(t, tBars + 0.4, 1.2), glow: 10 });
    D.label(ctx, "COST OF CHEATING", 1475, 672, { align: "center", color: C.ice, alpha: ba, size: 12 });
    D.label(ctx, "SEASONAL GAIN", 1675, 672, { align: "center", color: C.crimson, alpha: ba, size: 12 });
    D.text(ctx, ">", 1575, 520, { size: 40, weight: 600, align: "center", alpha: ba * (1 - rearm), color: C.green });
    D.text(ctx, "≈", 1575, 520, { size: 40, weight: 600, align: "center", alpha: ba * rearm, color: C.amber });
    K.chip(ctx, "REARMING LOWERS THE COST OF ATTACK", 1570, 750, { color: C.amber, align: "center", alpha: rearm, size: 13 });
    // constraints as objects
    const cA = (i) => prog(t, tCon + i * (S.end("It rests") - S.start("It rests")) * 0.3, 0.6);
    // demilitarized band
    const a0 = cA(0);
    ctx.save();
    ctx.globalAlpha = a0;
    ctx.fillStyle = rgba(C.ice, 0.06);
    ctx.fillRect(mid[0] - 40, 200, 80, 440);
    ctx.strokeStyle = rgba(C.ice, 0.25);
    ctx.beginPath();
    for (let y = 200; y < 640; y += 16) {
      ctx.moveTo(mid[0] - 40, y);
      ctx.lineTo(mid[0] + 40, y + 16);
    }
    ctx.stroke();
    ctx.restore();
    D.label(ctx, "DEMILITARIZED BAND", mid[0] + 50, 250, { color: C.ice, alpha: a0, size: 12 });
    // range limits
    const a1 = cA(1);
    for (const [p, col] of [[L, PALE_AMBER], [R, C.darkred]]) {
      ctx.save();
      ctx.globalAlpha = a1 * 0.8;
      ctx.strokeStyle = col;
      ctx.setLineDash([5, 6]);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(p[0], p[1], 230, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    D.label(ctx, "RANGE LIMITS ON STRIKE SYSTEMS", L[0], L[1] - 250, { align: "center", color: C.mid, alpha: a1, size: 12 });
    // monitors with fixed budgets
    const a2 = cA(2);
    for (let i = 0; i < 4; i++) {
      const y = 260 + i * 110;
      D.icon.person(ctx, mid[0] + 70, y, 26, C.green, a2);
    }
    D.label(ctx, "MONITORS KEEP FUNDING IF THE LINE MOVES", mid[0] + 96, 640 - 10, { color: C.green, alpha: a2, size: 12 });
    D.caption(ctx, "Final only while cheating stays expensive", t, tFinal, { y: 1000, x: 120, size: 26 });
  };
}

// ================================================================ 10. the split ledger
function s10(S) {
  const view = new MapView(geoMercator().scale(2400).translate([W / 2, H / 2]), { res: "50m", bbox: [[16, 36], [50, 50]] });
  view.setCam(K.camFor(view, [33.6, 43.8], 0.6, 960, 918));
  const corridor = D.smoothPts([P.odesa, [31.2, 45.6], [30.4, 44.2], [29.6, 42.4], [29.05, 41.25], [28.98, 41.0]], 10);
  const tWest = S.at("The western");
  const tCond = S.at("Conditionality is");
  const tEast = S.at("The eastern");
  const tGrain = S.at("Grain moving");
  const tClose = S.at("Close the");
  const tFlip = S.at("The game returns");
  return (ctx, t) => {
    D.bg(ctx, { gridAlpha: 0.2 });
    // the split ledger is on screen from the first word: two empty books, one country
    const sk = prog(t, 0.2, 0.8) * (1 - prog(t, tWest, 0.4));
    if (sk > 0) {
      D.panel(ctx, 140, 150, 800, 540, { alpha: sk, title: "Western state · reconstruction", titleColor: PALE_AMBER, fill: rgba(C.bg2, 0.5) });
      D.panel(ctx, 980, 150, 800, 540, { alpha: sk, title: "Eastern zone · Russian payments", titleColor: "#f0a0a6", color: rgba(C.darkred, 0.6), fill: rgba(C.bg2, 0.5) });
      D.stroke(ctx, [[960, 170], [960, 670]], { color: C.ice, width: 2, dash: [8, 8], alpha: sk * 0.6 });
      D.text(ctx, "ONE MAP ON PAPER", 960, 730, { kind: "mono", size: 14, tracking: 3, align: "center", color: C.mid, alpha: sk });
      D.text(ctx, "TWO PATRONS IN PRACTICE", 960, 756, { kind: "mono", size: 14, tracking: 3, align: "center", color: C.ice, alpha: sk * prog(t, 1.5, 0.8) });
    }
    const flip = prog(t, tFlip, 1.2, ease.inOut);
    const sx = Math.abs(Math.cos(flip * Math.PI));
    const back = flip > 0.5;
    ctx.save();
    ctx.translate(960, 420);
    ctx.scale(Math.max(0.02, sx), 1);
    ctx.translate(-960, -420);
    if (!back) {
      // western ledger
      const wa = prog(t, tWest, 0.6);
      D.panel(ctx, 140, 150, 800, 540, { alpha: wa, title: "Western state · reconstruction", titleColor: PALE_AMBER });
      for (let i = 0; i < 7; i++) {
        const a = prog(t, tWest + 0.3 + i * 0.35, 0.4);
        const y = 600 - i * 50;
        D.panel(ctx, 190, y - 34, 330, 40, { alpha: a, fill: rgba("#151c25", 0.95), color: C.steel, r: 3, sfx: `contract ${i + 1}` });
        D.text(ctx, i % 2 ? "$" : "€", 214, y - 6, { size: 22, weight: 600, color: i % 2 ? C.cyan : C.ice, alpha: a });
        D.text(ctx, `CONTRACT ${String(i + 1).padStart(2, "0")}`, 250, y - 8, { kind: "mono", size: 12, color: C.mid, alpha: a });
      }
      for (const [x, y, lab] of [[640, 300, "IMF"], [790, 300, "EU"]]) {
        const a = prog(t, tWest + 2.5, 0.6);
        ctx.save();
        ctx.globalAlpha = a;
        ctx.strokeStyle = C.ice;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, 50, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([3, 4]);
        ctx.beginPath();
        ctx.arc(x, y, 42, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
        D.text(ctx, lab, x, y + 9, { size: 26, weight: 700, tracking: 3, align: "center", alpha: a });
      }
      D.label(ctx, "SUPERVISING INSTITUTIONS", 715, 380, { align: "center", color: C.mid, alpha: prog(t, tWest + 2.5, 0.6), size: 11 });
      // security file + conditionality stamp
      const fa = prog(t, tWest + 4, 0.6);
      D.panel(ctx, 580, 440, 300, 190, { alpha: fa, fill: rgba("#1a2028", 0.95), color: C.steel, sfx: "Security file" });
      D.text(ctx, "SECURITY FILE", 730, 490, { size: 20, weight: 600, tracking: 4, align: "center", alpha: fa });
      D.stamp(ctx, "CONDITIONALITY", 730, 570, t, tCond, { color: PALE_AMBER, size: 24, angle: -0.12 });
      D.label(ctx, "ALIGNMENT BY ANOTHER NAME", 730, 664, { align: "center", color: PALE_AMBER, alpha: prog(t, tCond + 0.6, 0.6), size: 12 });
      // eastern ledger
      const ea = prog(t, tEast, 0.6);
      D.panel(ctx, 980, 150, 800, 540, { alpha: ea, title: "Eastern zone · Russian payments", titleColor: "#f0a0a6", color: rgba(C.darkred, 0.6) });
      const sink = [1600, 420];
      D.node(ctx, sink[0], sink[1], 34, C.darkred, { alpha: ea, glow: 24 });
      D.label(ctx, "RUSSIAN FISCAL &", sink[0], sink[1] + 66, { align: "center", color: "#f0a0a6", alpha: ea, size: 12 });
      D.label(ctx, "PAYMENT SYSTEMS", sink[0], sink[1] + 84, { align: "center", color: "#f0a0a6", alpha: ea, size: 12 });
      ["FUEL", "PENSIONS", "TRADE"].forEach((n, i) => {
        const a = prog(t, tEast + 0.5 + i * 0.5, 0.5);
        const y = 290 + i * 130;
        K.boxNode(ctx, 1150, y, 200, 70, n, { color: C.darkred, alpha: a, titleSize: 18 });
        const pts = D.arcPts([1252, y], [sink[0] - 36, sink[1]], 0.1, 20);
        D.stroke(ctx, pts, { color: C.darkred, width: 3, alpha: a, glow: 10 });
        K.flow(ctx, pts, t + i, { color: "#f0a0a6", n: 4, speed: 0.25, alpha: a, size: 2.2 });
      });
      K.chip(ctx, "ONE MAP · TWO ECONOMIES", 960, 740, { color: C.ice, align: "center", alpha: prog(t, S.at("Over time"), 0.6), size: 14 });
    } else {
      // pure security board
      D.panel(ctx, 340, 170, 1240, 520, { title: "The game · pure security" });
      fortified(ctx, [[960, 200], [960, 660]], { color: C.ice });
      for (let i = 0; i < 6; i++) {
        D.square(ctx, 700 - (i % 3) * 80, 280 + Math.floor(i / 3) * 160 + (i % 2) * 40, 18, PALE_AMBER, { glow: 10 });
        D.square(ctx, 1220 + (i % 3) * 80, 280 + Math.floor(i / 3) * 160 + (i % 2) * 40, 18, C.darkred, { glow: 10 });
      }
      D.text(ctx, "NO SHARED CASH BENEFIT", 960, 640, { kind: "mono", size: 14, tracking: 3, color: C.mid, align: "center" });
    }
    ctx.restore();
    // Black Sea grain corridor
    const ga = prog(t, tGrain, 0.6);
    const closed = prog(t, tClose, 1);
    if (ga > 0) {
      D.panel(ctx, 620, 770, 680, 260, { alpha: ga, title: "Black Sea · grain corridor", fill: rgba(C.bg, 0.96) });
      ctx.save();
      ctx.globalAlpha = ga;
      ctx.beginPath();
      ctx.rect(622, 805, 676, 223);
      ctx.clip();
      view.base(ctx, { borderAlpha: 0.5 });
      const cp = view.line(corridor);
      D.stroke(ctx, cp, { color: C.gold, width: 3, glow: 14, to: prog(t, tGrain + 0.4, 1.5), alpha: 1 - closed });
      K.flow(ctx, cp, t, { color: "#fff0b0", n: 5, speed: 0.15, alpha: (1 - closed) * prog(t, tGrain + 1.9, 0.3), size: 2.5 });
      K.place(ctx, view.xy(P.odesa), "ODESA", { color: C.mid, size: 11 });
      K.place(ctx, view.xy(P.istanbul), "BOSPORUS", { color: C.mid, size: 11, dx: 12, dy: -6 });
      ctx.restore();
      D.label(ctx, "SHARED CASH BENEFIT", 1320, 840, { color: C.gold, alpha: ga * (1 - closed), size: 13 });
      D.label(ctx, "FOREIGN CURRENCY FOR BOTH SIDES", 1320, 866, { color: C.mid, alpha: prog(t, S.at("A corridor"), 0.6) * (1 - closed), size: 11 });
      D.label(ctx, "→ BOTH EARN WHILE THE LINE HOLDS", 1320, 886, { color: C.mid, alpha: prog(t, S.at("A corridor"), 0.6) * (1 - closed), size: 11 });
      if (closed > 0) K.chip(ctx, "CORRIDOR CLOSED", 1320, 880, { color: C.crimson, alpha: closed, size: 14 });
    }
  };
}

// ================================================================ 11. two columns, and the facts
function s11(S) {
  const view = new MapView(geoMercator().scale(2300).translate([W / 2, H / 2]), { res: "50m", bbox: [[10, 42], [44, 56]] });
  view.setCam(K.camFor(view, [28.5, 48.6], 0.82, 960, 790));
  const ua = view.union(UA);
  const r = rng(31);
  const weapons = Array.from({ length: 70 }, () => [24 + r() * 14, 45.8 + r() * 5.6, Math.floor(r() * 3)]);
  const tL = 0.3;
  const tR = S.at("Mearsheimer's reply");
  const tSupply = S.at("The Military-Industrial");
  const tFill = S.at("The buffer");
  return Object.assign(
    (ctx, t) => {
      D.bg(ctx, { gridAlpha: 0.2 });
      // Sachs
      const la = prog(t, tL, 0.6);
      D.text(ctx, "SACHS", 140, 190, { size: 30, weight: 600, tracking: 8, color: C.violet, alpha: la });
      ["A MULTIPOLAR DESIGN.", "A SHARED INSPECTION REGIME.", "ONE NEUTRAL STATE.", "DIVIDED = UNIPOLAR HABIT", "MEETING A GREAT POWER'S RED LINE."].forEach((l, i) => {
        D.text(ctx, D.typed(l, prog(t, tL + 0.6 + i * 1.6, 1.2, ease.linear)), 140, 250 + i * 44, { size: 26, weight: 500, tracking: 2, color: i < 3 ? C.ice : C.mid });
      });
      // Mearsheimer
      const ra = prog(t, tR, 0.6);
      D.text(ctx, "MEARSHEIMER", 1000, 190, { size: 30, weight: 600, tracking: 8, color: "#dfe7ef", alpha: ra });
      ["A DESIGN EXISTS ONLY IF", "THE MOST POWERFUL PLAYERS", "FORGO THE ALIGNMENT.", "THEY DID NOT."].forEach((l, i) => {
        D.text(ctx, D.typed(l, prog(t, tR + 0.4 + i * 1.3, 1.1, ease.linear)), 1000, 250 + i * 44, { size: 26, weight: 500, tracking: 2, color: i === 3 ? C.crimson : C.ice });
      });
      D.stroke(ctx, [[960, 160], [960, 470]], { color: C.border, width: 1.5 });
      // the map: forward posture supply continues in; the buffer fills
      const ma = prog(t, 0.5, 1);
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 520, W, 520);
      ctx.clip();
      ctx.globalAlpha = ma;
      view.base(ctx, { colors: { [ID.poland]: "#0d3a4a", [ID.romania]: "#0d3a4a", [ID.slovakia]: "#0d3a4a", [ID.hungary]: "#0d3a4a", [ID.germany]: "#0d3a4a" }, borderAlpha: 0.5 });
      view.draw(ctx, ua, { fill: WEST_STATE, stroke: rgba(PALE_AMBER, 0.5), width: 1.2 });
      ctx.restore();
      D.stroke(ctx, [[120, 520], [1800, 520]], { color: C.border, width: 1, alpha: ma });
      const sp = prog(t, tSupply, 2.5);
      D.fatArrow(ctx, view.xy([9.0, 50.6]), view.xy([lerp(16, 33, sp), 50.0]), { color: C.cyan, width: 56, p: prog(t, tSupply, 0.8), alpha: 0.7 });
      D.label(ctx, "FORWARD POSTURE · SUPPLY", ...view.xy([11.5, 51.6]), { color: C.cyan, alpha: prog(t, tSupply, 0.6), size: 13 });
      const fill = prog(t, S.at("They were"), Math.max(3, S.dur - S.at("They were") - 2), ease.linear);
      weapons.forEach(([lon, lat, k], i) => {
        const a = clamp(fill * weapons.length - i);
        if (a <= 0) return;
        const [x, y] = view.xy([lon, lat]);
        view.withClip(ctx, ua, () => {
          if (k === 0) D.square(ctx, x, y, 8, C.ice, { alpha: a, glow: 6 });
          else if (k === 1) D.diamond(ctx, x, y, 6, C.ice, { alpha: a, glow: 6 });
          else D.arrowHead(ctx, x, y, -Math.PI / 2, 9, C.ice, a);
        });
      });
      D.caption(ctx, "Weapons are facts", t, tFill, { y: 1000, x: 1180, size: 26, accent: C.ice });
    },
    { noBadges: true },
  );
}

// ================================================================ 12. the austere map
function s12(S) {
  const view = ukraine();
  view.setCam(view.camAt([30.8, 48.5], 0.92));
  const ua = view.union(UA);
  const occ = view.pathOf(poly(OCCUPIED));
  const dnieper = view.pathOf(line(D.smoothPts(RIVERS.dnieper, 6)));
  const front = [ID.poland, ID.slovakia, ID.hungary, ID.romania];
  const tWall = S.at("Blue alliance");
  const tWest = S.at("Amber and");
  const tEast = S.at("A darker");
  const tStrip = S.at("Between them");
  const tRiver = S.at("The Dnieper");
  const tCap = S.at("The caption");
  return (ctx, t) => {
    D.bg(ctx, { gridAlpha: 0.15 });
    const z = 1 + 0.03 * prog(t, 0, S.dur, ease.linear);
    view.setCam(view.camAt([30.8, 48.5], 0.92 * z));
    const wall = prog(t, tWall, 1.5);
    const colors = { [ID.russia]: "#1a1618", [ID.belarus]: "#1a1819", [ID.moldova]: C.land };
    for (const id of front) colors[id] = mix(C.land, "#0e4a5e", wall);
    view.base(ctx, { colors, borderAlpha: 0.6 });
    for (const id of front) view.draw(ctx, view.country(id), { stroke: C.cyan, width: 1.5, alpha: wall * 0.7 });
    // truncated western state
    const wa = prog(t, tWest, 1.2);
    view.draw(ctx, ua, { fill: mix(C.land, WEST_STATE, wa) });
    view.withClip(ctx, ua, () => {
      // pale amber hatching on the western state
      ctx.save();
      ctx.globalAlpha = wa * 0.18;
      ctx.strokeStyle = PALE_AMBER;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = -1000; x < W + 1000; x += 18) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x + 700, H);
      }
      ctx.stroke();
      ctx.restore();
      view.draw(ctx, occ, { fill: mix(C.land, "#4a1219", prog(t, tEast, 1.2)) });
    });
    view.draw(ctx, ua, { stroke: rgba(PALE_AMBER, 0.7), width: 1.6 });
    // Dnieper in the background, dashed
    view.draw(ctx, dnieper, { stroke: C.cyan, width: 2, dash: [10, 9], alpha: 0.3 + 0.35 * prog(t, tRiver, 1) });
    // the thin monitored strip
    const st = prog(t, tStrip, 1.5);
    const cl = view.line(CONTACT_LINE);
    D.stroke(ctx, cl, { color: C.ice, width: 16, alpha: 0.12 * st, to: st });
    D.stroke(ctx, cl, { color: C.ice, width: 1.5, alpha: 0.9 * st, to: st, glow: 8 });
    D.label(ctx, contactLine.caption, ...view.xy([36.4, 47.15]), { color: C.dim, alpha: st, size: 12, align: "center" });
    // labels
    D.label(ctx, "ALLIANCE · A WALL, NOT A BUFFER", ...view.xy([22.0, 46.9]), { color: C.cyan, alpha: wall, size: 13, align: "center" });
    D.label(ctx, "WEST · WESTERN ARMS AND FUNDING", ...view.xy([29.4, 51.85]), { color: PALE_AMBER, alpha: wa, size: 12, align: "center" });
    D.label(ctx, "EAST · RUSSIAN FORCE AND PAYMENTS", ...view.xy([39.2, 46.0]), { color: "#f0a0a6", alpha: prog(t, tEast + 0.8, 0.6), size: 12, align: "center" });
    const sv = view.xy(P.sevastopol);
    D.node(ctx, sv[0], sv[1], 7, C.darkred, { alpha: prog(t, tEast + 1, 0.6), glow: 16 });
    D.label(ctx, "FLEET HARBOR", sv[0] - 14, sv[1] + 26, { color: "#f0a0a6", alpha: prog(t, tEast + 1, 0.6), size: 11, align: "right" });
    D.label(ctx, "THE LAST WIDTH · MONITORED", ...view.xy([38.6, 49.7]), { color: C.ice, alpha: st, size: 12 });
    D.label(ctx, "DNIEPER · A LARGER WAR WOULD COST MORE", ...view.xy([33.2, 50.6]), { color: C.cyan, alpha: prog(t, tRiver, 0.8) * 0.85, size: 11 });
    // payment rail for the east
    const pr = prog(t, tEast + 1.5, 1.5);
    const rail = view.line([[37.8, 47.2], [40.5, 47.6], [43.5, 48.4]]);
    D.stroke(ctx, rail, { color: C.darkred, width: 3, dash: [8, 6], to: pr, alpha: 0.9 });
    D.caption(ctx, "This holds when a promise cannot be enforced", t, tCap, { y: 1000, size: 28, accent: C.ice });
  };
}

// Spoken line, visual direction, and score mood. scripts/episode-02-*.txt are generated from this.
const STORY = [
  {
    "title": "The width",
    "mood": "pressure",
    "narration": "In this model, Ukraine is a strip of land between two armed camps. The camps share a flat plain, with no mountain range to separate them. The land outside either alliance is the cushion between them. Treat the state as that cushion, and the war is a fight over how thick the cushion must be. So what happens if both sides are asked to rely on trust alone? The model points toward a division that neither side welcomes. The territory splits on the ground, because this arrangement can’t give either side confidence in the other.",
    "cue": "[VISUAL: TOP-DOWN map of the European plain from the Rhine to the Urals. Terrain relief only, no weather. A translucent band across Ukraine is labeled WIDTH. Two pressure arrows, blue from the west and dark red from the east, compress the band. The band thins until it shears.]"
  },
  {
    "title": "Capabilities, not intentions",
    "mood": "system",
    "narration": "The European plain stores distance in towns and fields. John Mearsheimer starts from a simple claim. No world authority can make a promise stick. Intentions are hidden, and they change. Weapons are easier to count: bases, air defense, and long-range missiles. Russia, as a great power, counts those things on the open land of Ukraine and treats them as a future threat even when the stated purpose is defense. The Western alliance counts Russian weapons the same way. Security is one-sided here, because one kilometer can’t be Moscow's forward post and the alliance's at once. Relative power is how far the other side's forces sit from your own home ground.",
    "cue": "[VISUAL: The same plain, now with capability markers rather than speeches. Blue squares for allied military infrastructure step eastward across the former Warsaw Pact. Dark-red markers count air defense, long-range fires, and bases on the Ukrainian steppe. A distance ruler between the two sets of markers is labeled RELATIVE POWER. The ruler shortens. Intentions are never shown as text.]"
  },
  {
    "title": "How the buffer thinned",
    "mood": "history",
    "narration": "The record shows how that cushion became thinner, one decision at a time. After the Cold War the alliance moved east across the old Warsaw Pact. In two thousand eight, at Bucharest, it said Ukraine and Georgia would become members. It set no date, but it created a hope in one capital and a deadline in another. The government in Kyiv that had tried to balance between markets was overturned in twenty fourteen. Crimea was taken. The Donbas war began. The Minsk deals tried to freeze that war inside one country, but they weren’t carried out. Minsk left self-rule in the east, and control of the border, unresolved. Each unimplemented promise taught both sides that a written limit was only a pause while they rearmed. By twenty twenty-two the cushion was, in Russia's count of the threat, no longer thick enough to leave to time.",
    "cue": "[VISUAL: TIMELINE with four hard cuts: alliance enlargement after the Cold War; Bucharest, 2008, the sentence on Ukraine and Georgia, no date attached; 2014, Crimea and the Donbas marked as a tear in the band; Minsk documents appear and remain unsigned in practice. By 2022 the width band is a line. Camera does not linger on casualties.]"
  },
  {
    "title": "The neutral blueprint",
    "mood": "cold",
    "narration": "Jeffrey Sachs keeps a different plan, and it is specific. A sovereign Ukraine, open to European trade, closed to both military blocs. No foreign bases and no alliance membership, backed by a long treaty with inspectors, so checking replaces trust. The reference case is Finland after nineteen forty-five: a country that stayed independent by refusing to host someone else's army. On this account, the years when one country ran the system are what killed the plan. Washington and the allied institutions treated staying neutral as a waiting room on the way into the alliance. The Military-Industrial Complex preferred bases near the border over a wide neutral zone. Sachs claims the institutions couldn’t treat a Russian security worry as equal to a promise of enlargement, and that the refusal produced the war they later called unprovoked.",
    "cue": "[VISUAL: A clean institutional blueprint, drawn like an architect's sheet. One Ukrainian outline. Economic arrows in steel gray toward the European Union. Military arrows absent. A verification grid of inspection sites replaces flags. A small inset of postwar Finland, labeled REFERENCE, stays non-aligned and intact. The blueprint is then slid aside, not ripped.]"
  },
  {
    "title": "Cannot be split",
    "mood": "pressure",
    "narration": "Professor Jiang turns the argument into a game with one hard object. Military alignment is almost impossible to split, because bases, fused intelligence, and binding promises don’t come in gentle doses. There’s no amount of the alliance that gives Russia the depth it wants and Ukraine the protector it wants. The neutral center was the deal that needed all three players to accept a second-best result at the same time. Bucharest, the failure of Minsk, and the invasion each took one player out of that deal. Once the center is empty, the payoffs favor a split. A partition gives the west of the country to Europe's trade and weapons, and the eastern approaches to Russian depth, with a line both sides can fortify. The line is what remains when the one thing they can’t share stays unshared.",
    "cue": "[VISUAL: GAME BOARD, three players, one object in the center labeled ALIGNMENT. The object does not divide when the cursor tries to split it. Bucharest, the failure of Minsk, and the invasion each remove a player token. With the center empty, the board redraws itself as two territories and a fortified line. Caption: GEOMETRY AFTER THE CENTER FAILS.]"
  },
  {
    "title": "The contact-line freeze",
    "mood": "cold",
    "narration": "The model prints two borders, and it ranks them by what they cost. The default result is a freeze along the fortified front in the east and the south. Crimea stays on the Russian side of the books because Sevastopol is the Black Sea Fleet's harbor, and a hostile coast there would put the fleet under an enemy shore. The land link to that harbor, and the Donbas belt in front of it, work in Russian planning as depth. West of the freeze, the remaining state keeps Kyiv, the cities on the central river, and the Polish frontier. It integrates with European markets and keeps receiving weapons. Full membership in the alliance stays blocked, because membership would force the alliance to treat a new war as its own war. The great power's red line is kept by taking the contested east out of the membership question, at the price of a smaller Ukraine.",
    "cue": "[VISUAL: MAP EQUILIBRIUM B, the default. ZOOM to Crimea. Sevastopol harbor marked as a fleet node in dark red. A land connection and the Donbas belt shade as depth. West of a fortified contact line, Kyiv, the central river cities, and the Polish frontier remain in a steel-gray and pale-amber Ukrainian state, armed from outside. A blue NATO halo stops at the allied border and does not cross. Caption: CONTACT-LINE FREEZE.]"
  },
  {
    "title": "The river line",
    "mood": "pressure",
    "narration": "The second border is the river. The Dnieper is the strongest natural barrier on this plain, which makes it an obvious line to consider. A line there would give Russia depth from the eastern regions to a bank it can defend, and it would give the western state a shorter frontier. The model doesn’t pick this line as the normal result. Reaching it takes a second, larger war after a land link to Crimea already exists, and each extra kilometer buys less safety than it costs. Move the border only while the next kilometer's safety is worth more than its cost. The curves cross, in the basic case, on the present front. They cross on the river only if Moscow decides that any Western-armed force east of the water can still threaten the land bridge and the fleet, and if it is willing to pay for that judgment.",
    "cue": "[VISUAL: The Dnieper draws itself as a bright hydrographic line, then switches to a dashed stroke. A cost curve and a security-value curve plot against kilometers west. They intersect on the contact line in the baseline. A second, higher intersection appears on the river only when a cost dial is forced upward. Caption: RIVER LINE IS THE ESCALATION EQUILIBRIUM. Do not animate an advance.]"
  },
  {
    "title": "The capital",
    "mood": "pressure",
    "narration": "Either result has to deal with the capital. A line that cuts through a capital isn’t a workable border, because it leaves a crisis at the center of the country. The contact-line state leaves the capital in the western half, far enough from the freeze to govern, close enough that the loss stays politically alive. That unresolved loss is why the western half is unlikely to accept the division as legitimate. Mearsheimer expects a split on the ground, and a protest that never stops. Sachs still argues one neutral country would have cost less than either line. Both can accept the same fact. Once a war has changed what each side has lost and fears losing, the old bargain is no longer available. The old plan can still be drawn on paper. It’s no longer the result this model expects.",
    "cue": "[VISUAL: Kyiv marked well inside the western polity, with a political-pressure gauge beside it labeled UNRECONCILED. Two columns: DE FACTO PARTITION and DE JURE PROTEST, both occupied. A faded overlay of the single neutral state sits behind them, legible, stamped NOT THE EQUILIBRIUM. No crowd footage.]"
  },
  {
    "title": "Cheating must cost",
    "mood": "system",
    "narration": "The freeze lasts only if both sides keep choosing it. Each side can cheat, so the question is what makes cheating a bad bet. The punishment for cheating is a return to war, which is expensive, so the line holds when a quick gain from a surprise attack is smaller than the long cost of starting the war again. You can’t look inside the other side's intentions, so the game can’t rest on promises. It rests on limits that still work if the other side is hostile: an empty strip, limits on long-range weapons parked against the line, and monitors whose budgets don’t grow if the line moves. Rebuilding armies so that a seasonal attack looks cheap will break the freeze. The partition is final only while cheating stays expensive.",
    "cue": "[VISUAL: REPEATED GAME diagram. Two arrows labeled CHEAT. A punishment loop labeled RETURN TO WAR with a high cost weight. The ceasefire holds only while a bar titled COST OF CHEATING stays above a bar titled SEASONAL GAIN. Constraints appear as physical objects: a demilitarized band, a range limit on strike systems, monitors whose budget does not grow if the line moves.]"
  },
  {
    "title": "The split ledger",
    "mood": "motion",
    "narration": "Money locks the two halves to different patrons. That’s Jiang's quiet mechanism. The western state's rebuilding is priced in euros and dollars, watched by European institutions and the International Monetary Fund, and allowed only if the security policy suits those lenders. Conditionality is membership by another name. The eastern zone's fuel, pensions, and trade clear through Russian budgets and payment systems. Over time the two zones stop fitting as one economy, even if a diplomat still shows one map. Grain moving out of the Black Sea is the side payment that keeps the game quiet. A corridor that lets farming earn foreign money gives both sides a cash reason to prefer the freeze to the gun. Close the corridor, and that side payment disappears. The game returns to nothing but security, with one less reason for either side to hold back.",
    "cue": "[VISUAL: SPLIT LEDGER. Western reconstruction contracts stack in euros and dollars, with IMF and European institutional seals, and a conditionality stamp on the security file. Eastern fuel, pensions, and trade clear through a dark-red fiscal system. A Black Sea grain corridor is drawn as a thin gold side-payment. When the corridor closes, the gold line vanishes and the game board flips back to pure security.]"
  },
  {
    "title": "Weapons are facts",
    "mood": "shock",
    "narration": "Sachs would still call this a failure of institutions, not a law of nature. One neutral state with shared inspectors was a plan for several centers of power. A split is what follows when one leading power meets a great power willing to spend heavily to stop a hostile army on its border. The Military-Industrial Complex only has to keep supplying the forward bases that made neutrality look like giving up. Mearsheimer's reply is that a plan exists only if the strongest players will give up the alignment, and they weren’t willing. The buffer was then filled with weapons, and weapons are facts.",
    "cue": "[VISUAL: Two columns of text, no narrator on screen. Left, Sachs: multipolar design, inspection, one state. Right, Mearsheimer: a design exists only if the strongest players forgo the alignment. The forward-posture supply arrow from the blue security complex continues into the map. The buffer fills with weapon icons, shown as facts, not as a montage of combat.]"
  },
  {
    "title": "What holds",
    "mood": "close",
    "narration": "The map that comes out is spare. Blue alliance territory stands on the Polish, Slovak, Hungarian, and Romanian borders, a wall rather than a cushion. Amber and gray mark the smaller Ukrainian state, armed from outside, paid from the west, and not reconciled. A darker band marks the eastern and southern lands under Russian force, including the fleet harbor, tied to another payment system. Between them sits a thin watched strip, the last of the width. The Dnieper stays in the background as the line a bigger war would reach, drawn dashed because the basic case doesn’t pay for it. The caption says the result holds when a promise can’t be enforced, that it costs more than the other plans, and that the center couldn’t be shared.",
    "cue": "[VISUAL: FINAL MAP, held. Blue alliance territory solid on the Polish, Slovak, Hungarian, and Romanian frontiers. Pale amber and steel gray for the truncated Ukrainian state. A darker band for the eastern and southern territories under Russian force, including the fleet harbor, tied to a separate payment rail. Between them, a thin monitored strip, the last width. The Dnieper remains dashed in the background. Caption, and no other: STABLE UNDER ANARCHY. Hold. Cut to black.]"
  }
];

const DRAWS = [s1, s2, s3, s4, s5, s6, s7, s8, s9, s10, s11, s12];
if (DRAWS.length !== STORY.length) throw new Error(`episode 2 draws ${DRAWS.length} vs story ${STORY.length}`);

export default {
  title: "Buffer States",
  subtitle: "How Ukraine ends up split",
  short: "Buffer States",
  scenes: STORY.map((scene, i) => ({ ...scene, draw: DRAWS[i] })),
};
