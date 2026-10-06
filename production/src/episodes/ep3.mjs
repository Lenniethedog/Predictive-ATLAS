// EPISODE 3 — THE MALACCA SIEGE
import { geoMercator, geoAzimuthalEquidistant } from "d3-geo";
import { C, W, H, clamp, lerp, ease, prog, fade, pulse, rgba, mix, rng } from "../engine/core.mjs";
import * as D from "../engine/draw.mjs";
import { MapView, P, ID, LANES, PIPES } from "../engine/geo.mjs";
import * as K from "../engine/kit.mjs";

// Usable lane through the strait (water-routed for close zooms).
const STRAIT = [[94.0, 6.4], [95.8, 6.1], [97.5, 5.6], [99.0, 4.6], [100.3, 3.3], [101.3, 2.5], [102.5, 1.75], [103.4, 1.2], [103.85, 1.13], [104.35, 1.25], [104.7, 1.6], [105.5, 2.6], [107.0, 4.6], [109.0, 8.0]];
const WEST_IN = [[80.5, 5.6], [86, 5.8], [92, 6.2], [94.0, 6.4]];
const TO_CHINA = [[109.0, 8.0], [111.5, 13.0], [113.5, 18.0], [114.3, 21.9]];
const TO_JAPAN = [[109.0, 8.0], [113.0, 12.5], [117.0, 17.0], [120.5, 21.0], [124.0, 26.0], [131.0, 31.5], [139.6, 35.0]];

function seAsia(scale = 1800, res = "10m") {
  return new MapView(geoMercator().scale(scale).translate([W / 2, H / 2]), { res, bbox: [[66, -28], [152, 32]] });
}

function asiaWide(scale = 1000, bbox = [[30, -15], [150, 62]]) {
  return new MapView(geoMercator().scale(scale).translate([W / 2, H / 2]), { res: "50m", bbox });
}

// Up-pointing triangle (the fonts lack ▲).
function tri(ctx, x, y, r, color, alpha = 1) {
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.lineTo(x + r * 0.9, y + r * 0.6);
  ctx.lineTo(x - r * 0.9, y + r * 0.6);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// Valve wheel (hand-wheel) graphic.
function valve(ctx, x, y, r, o = {}) {
  const { color = C.ice, alpha = 1, spin = 0, open = 1 } = o;
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.strokeStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 16;
  ctx.lineWidth = r * 0.12;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = r * 0.08;
  for (let i = 0; i < 4; i++) {
    const a = spin + (i * Math.PI) / 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    ctx.stroke();
  }
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r * 0.18, 0, Math.PI * 2);
  ctx.fill();
  // gate indicator
  ctx.shadowBlur = 0;
  ctx.fillStyle = rgba(color, 0.25 + 0.5 * (1 - open));
  ctx.fillRect(x - r * 0.08, y + r * 1.25, r * 0.16, r * 0.9 * (1 - open) + r * 0.1);
  ctx.restore();
}

// Stylized hand (mitten + fingers), pointing toward +x when ang = 0.
function hand(ctx, x, y, s, ang, color, alpha = 1) {
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(x, y);
  ctx.rotate(ang);
  ctx.fillStyle = rgba(color, 0.22);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.shadowColor = color;
  ctx.shadowBlur = 14;
  D.roundRect(ctx, -s * 0.9, -s * 0.42, s * 0.75, s * 0.84, s * 0.18);
  ctx.fill();
  ctx.stroke();
  for (let i = 0; i < 4; i++) {
    const fy = -s * 0.36 + i * s * 0.24;
    D.roundRect(ctx, -s * 0.2, fy, s * (0.55 - Math.abs(i - 1.5) * 0.08), s * 0.18, s * 0.09);
    ctx.fill();
    ctx.stroke();
  }
  D.roundRect(ctx, -s * 0.55, -s * 0.62, s * 0.38, s * 0.2, s * 0.1);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

// Equation with highlightable terms.
function equation(ctx, x, y, t, t0, hl = {}) {
  const terms = [["DEFICIT", C.ice], [" = ", C.mid], ["SOUTHERN FLOW", C.ice], [" − ", C.mid], ["STOCKS", C.amber], [" − ", C.mid], ["PACIFIC", C.amber], [" − ", C.mid], ["PIPELINES", C.amber]];
  let cx = x;
  terms.forEach(([s, col], i) => {
    const a = prog(t, t0 + i * 0.18, 0.4);
    const glow = hl[s] ?? 0;
    const w = D.text(ctx, s, cx, y, { kind: "mono", size: 24, weight: 500, color: glow > 0 ? mix(C.mid, col, glow) : s.trim().length > 1 ? C.ice : C.mid, alpha: a, glow: glow * 14 });
    cx += w + (s.startsWith(" ") ? 0 : 0);
  });
}

// ================================================================ 1. an import equation
function s1(S) {
  const view = seAsia(1500);
  const wide = K.camFor(view, [104, 6], 0.9, 960, 520);
  const close = K.camFor(view, [101.6, 2.9], 3.1, 960, 520);
  const tEq = S.at(1);
  const tBuy = S.at(2);
  const lanes = [
    [...WEST_IN, ...STRAIT, ...TO_CHINA],
    [...WEST_IN, ...STRAIT, ...TO_JAPAN],
    [[86, -4], [91.5, 2.0], [94.3, 5.9], [96, 6.0], ...STRAIT.slice(2), [110, 6.5], [116, 9.5], [121.0, 14.5]],
    [...STRAIT.slice(4), [105.0, 0.5], [106.5, -3], [107, -6]],
  ];
  return (ctx, t) => {
    D.bg(ctx, { grid: false, color: "#090c10" });
    view.setCam(MapView.mixCam(wide, close, prog(t, 0, S.dur * 0.75, ease.inOut)));
    view.base(ctx, { landFill: "#161c24", borderAlpha: 0.5 });
    // shipping density, white-hot in the lane near Singapore
    const k = view.cam.k;
    lanes.forEach((l, i) => K.heat(ctx, D.smoothPts(view.line(l), 4), { color: "#bfe9ff", width: 8 + 2.5 * k, alpha: 0.3 * prog(t, 0.2 + i * 0.2, 1.2), blur: 12 }));
    const sg = view.xy([103.85, 1.2]);
    const hot = ctx.createRadialGradient(sg[0], sg[1], 0, sg[0], sg[1], 60 * k);
    hot.addColorStop(0, "rgba(255,255,255,0.85)");
    hot.addColorStop(0.3, "rgba(200,240,255,0.35)");
    hot.addColorStop(1, "rgba(200,240,255,0)");
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = hot;
    ctx.globalAlpha = prog(t, 1, 2);
    ctx.fillRect(sg[0] - 80 * k, sg[1] - 80 * k, 160 * k, 160 * k);
    ctx.restore();
    const la = prog(t, 2, 1);
    D.label(ctx, "SUMATRA", ...view.xy([99.6, 1.0]), { color: C.mid, alpha: la, size: 14, align: "center" });
    D.label(ctx, "MALAY PENINSULA", ...view.xy([101.9, 4.6]), { color: C.mid, alpha: la, size: 14, align: "center" });
    D.label(ctx, "SINGAPORE", sg[0] + 18, sg[1] + 30, { color: C.ice, alpha: la, size: 13 });
    D.label(ctx, "STRAIT OF MALACCA", ...view.xy([100.2, 3.9]), { color: C.ice, alpha: la, size: 13, align: "center" });
    // the equation
    D.panel(ctx, 110, 870, 1050, 110, { alpha: prog(t, tEq, 0.6), fill: rgba("#0b0e13", 0.9) });
    equation(ctx, 140, 940, t, tEq + 0.2, { STOCKS: prog(t, tBuy, 0.8), PACIFIC: prog(t, tBuy + 0.4, 0.8), PIPELINES: prog(t, tBuy + 0.8, 0.8) });
    D.label(ctx, "TWO DECADES BUYING DOWN THE SHORTFALL →", 140, 900, { color: C.amber, alpha: prog(t, tBuy + 1, 0.6), size: 12 });
  };
}

// ================================================================ 2. the funnel
function s2(S) {
  const view = seAsia(1500);
  const wideView = asiaWide(900, [[-5, -45], [150, 50]]);
  wideView.setCam(K.camFor(wideView, [80, 10], 1, 960, 540));
  const lane = K.camFor(view, [103.85, 1.2], 26, 960, 520);
  const strait = K.camFor(view, [101.6, 2.9], 3.1, 960, 520);
  const tNarrow = 0.3;
  const tFlows = S.at(1);
  const tCard1 = S.at(2);
  const tCard2 = S.at(3);
  const tWide = S.at(5) - 1.2;
  return (ctx, t) => {
    D.bg(ctx, { grid: false, color: "#090c10" });
    const wideA = prog(t, tWide, 1.4);
    if (wideA < 1) {
      ctx.save();
      ctx.globalAlpha = 1 - wideA;
      const zin = prog(t, tNarrow, 5, ease.inOut);
      const zout = prog(t, tFlows - 0.5, 3, ease.inOut);
      view.setCam(MapView.mixCam(MapView.mixCam(strait, lane, zin), strait, zout));
      view.base(ctx, { landFill: "#161c24", borderAlpha: 0.5 });
      const k = view.cam.k;
      // usable lane
      const lp = D.smoothPts(view.line(STRAIT), 6);
      K.heat(ctx, lp, { color: "#bfe9ff", width: Math.min(18, 6 + 0.5 * k), alpha: 0.45 });
      // width callout at the Phillips Channel
      const ca = fade(t, tNarrow + 3.5, 0.6, tFlows, 0.6);
      if (ca > 0) {
        const a = view.xy([103.8, 1.205]);
        const b = view.xy([103.8, 1.18]);
        D.stroke(ctx, [[a[0] - 120, a[1]], [a[0] + 120, a[1]]], { color: C.ice, width: 1, alpha: ca * 0.5 });
        D.stroke(ctx, [[b[0] - 120, b[1]], [b[0] + 120, b[1]]], { color: C.ice, width: 1, alpha: ca * 0.5 });
        D.arrow(ctx, [[a[0] + 100, (a[1] + b[1]) / 2], [a[0] + 100, a[1]]], { color: C.ice, width: 1.5, head: 8, alpha: ca });
        D.arrow(ctx, [[a[0] + 100, (a[1] + b[1]) / 2], [a[0] + 100, b[1]]], { color: C.ice, width: 1.5, head: 8, alpha: ca });
        D.label(ctx, "A FEW KILOMETRES OF USABLE LANE", a[0] + 130, (a[1] + b[1]) / 2 + 5, { color: C.ice, alpha: ca, size: 14 });
        D.label(ctx, "SINGAPORE STRAIT", a[0] - 130, (a[1] + b[1]) / 2 + 5, { color: C.mid, alpha: ca, size: 12, align: "right" });
      }
      // crude + dry cargo ribbons
      const fa = prog(t, tFlows, 1);
      const fpts = view.line(STRAIT);
      K.flow(ctx, fpts, t, { color: "#ffe2b0", n: 18, speed: 0.05, size: 3, alpha: fa });
      K.flow(ctx, fpts.slice().reverse(), t, { color: C.steel, n: 12, speed: 0.045, size: 2.6, alpha: fa });
      D.label(ctx, "CRUDE →", 140, 960, { color: "#ffe2b0", alpha: fa, size: 13 });
      D.label(ctx, "← DRY CARGO", 300, 960, { color: C.steel, alpha: fa, size: 13 });
      D.label(ctx, "INDIAN OCEAN", ...view.xy([96.4, 4.0]), { color: C.dim, alpha: fa, size: 13, align: "center" });
      D.label(ctx, "SOUTH CHINA SEA", ...view.xy([106.6, 4.8]), { color: C.dim, alpha: fa, size: 13, align: "center" });
      ctx.restore();
    }
    // planning cards
    const c1 = fade(t, tCard1, 0.5, tWide + 1.6, 0.6);
    const c2 = fade(t, tCard2, 0.5, tWide + 1.6, 0.6);
    const card = (x, title, sub, frac, a, col, note) => {
      if (a <= 0) return;
      D.panel(ctx, x, 160, 440, 200, { alpha: a, fill: rgba("#0b0e13", 0.92), title });
      D.text(ctx, sub, x + 24, 250, { size: 34, weight: 600, tracking: 3, alpha: a, color: col });
      D.hbar(ctx, x + 24, 285, 392, 18, col, { p: frac * prog(t, x === 1000 ? tCard1 + 0.3 : tCard2 + 0.3, 1), alpha: a });
      D.text(ctx, note, x + 24, 336, { kind: "mono", size: 12, color: C.mid, alpha: a });
    };
    card(1000, "Planning card · 2000s", "FOUR-FIFTHS", 0.8, c1, C.ice, "OF OIL IMPORTS THROUGH ONE PASSAGE");
    card(1460 - 20, "Planning card · today", "LOWER", 0.62, c2, C.amber, "PIPELINES CUT IT · STILL DOMINANT");
    // wide: ME + African crude still enters from the west
    if (wideA > 0) {
      ctx.save();
      ctx.globalAlpha = wideA;
      wideView.base(ctx, { colors: { [ID.china]: rgba(C.crimson, 0.25) }, borderAlpha: 0.5 });
      ctx.restore();
      const lanes = [
        [LANES.gulfToMalacca, "#ffe2b0"],
        [LANES.africaToMalacca, "#ffd08a"],
      ];
      lanes.forEach(([l, col], i) => {
        const pts = D.smoothPts(wideView.line([...l, ...STRAIT.slice(4), ...TO_CHINA]), 6);
        D.thread(ctx, pts, t, tWide + 0.6 + i * 0.4, 2.2, { color: col, width: 2.4, particles: 10, speed: 0.06, glow: 12, alpha: wideA });
      });
      for (const p of [P.guangzhou, P.ningbo, P.qingdao]) {
        const q = wideView.xy(p);
        D.node(ctx, q[0], q[1], 5, C.crimson, { alpha: wideA, glow: 14, ring: false });
      }
      D.label(ctx, "MIDDLE EAST CRUDE", ...wideView.xy([60, 18]), { color: "#ffe2b0", alpha: wideA, size: 13 });
      D.label(ctx, "WEST AFRICAN CRUDE", ...wideView.xy([30, -30]), { color: "#ffd08a", alpha: wideA, size: 13 });
      D.label(ctx, "CHINESE TERMINALS", ...wideView.xy([118, 30]), { color: C.crimson, alpha: wideA, size: 13 });
      K.chip(ctx, "THE SOUTHERN APPROACHES", ...wideView.xy([97, 2]), { color: C.ice, alpha: wideA * prog(t, tWide + 2.5, 0.6), size: 13 });
    }
  };
}

// ================================================================ 3. valve hands
function s3(S) {
  const tGrip = S.at(2);
  const tCap = S.at(3);
  const tDep = S.at(4);
  const tZero = S.at(5);
  const tDecide = S.at(6);
  return (ctx, t) => {
    D.bg(ctx, { gridAlpha: 0.2 });
    const cx = 960;
    const cy = 520;
    // sides
    ctx.save();
    const gL = ctx.createLinearGradient(0, 0, cx, 0);
    gL.addColorStop(0, rgba(C.cyan, 0.16));
    gL.addColorStop(1, rgba(C.cyan, 0.02));
    ctx.fillStyle = gL;
    ctx.fillRect(0, 140, cx - 80, 760);
    const gR = ctx.createLinearGradient(cx, 0, W, 0);
    gR.addColorStop(0, rgba(C.crimson, 0.02));
    gR.addColorStop(1, rgba(C.crimson, 0.16));
    ctx.fillStyle = gR;
    ctx.fillRect(cx + 80, 140, W - cx - 80, 760);
    ctx.restore();
    D.text(ctx, "OUTER SEA", 240, 230, { size: 30, weight: 600, tracking: 8, color: C.cyan, alpha: prog(t, 0.3, 0.6) });
    D.text(ctx, "INDIAN OCEAN SIDE · OFFSHORE HEGEMON", 240, 260, { kind: "mono", size: 13, color: C.mid, alpha: prog(t, 0.6, 0.6) });
    D.text(ctx, "INDUSTRIAL DEMAND", 1680, 230, { size: 30, weight: 600, tracking: 8, color: C.crimson, align: "right", alpha: prog(t, S.at(1), 0.6) });
    D.text(ctx, "PACIFIC SIDE · CHINESE INDUSTRY", 1680, 260, { kind: "mono", size: 13, color: C.mid, align: "right", alpha: prog(t, S.at(1) + 0.3, 0.6) });
    // pipe
    const pipeY = cy;
    ctx.save();
    ctx.fillStyle = "#121820";
    ctx.strokeStyle = C.border;
    ctx.lineWidth = 2;
    ctx.fillRect(140, pipeY - 34, W - 280, 68);
    ctx.strokeRect(140, pipeY - 34, W - 280, 68);
    ctx.restore();
    // valve state: flips open/closed after tZero
    const flipT = t - tZero;
    const closed = flipT > 0 ? Math.floor(flipT / 1.6) % 2 === 1 : false;
    const closing = flipT > 0 ? clamp(((flipT % 1.6) - 1.2) / 0.4) : 0;
    const open = flipT > 0 ? (closed ? closing : 1 - closing) : 1;
    const flowOn = open > 0.5;
    if (flowOn) {
      K.flow(ctx, [[150, pipeY], [cx - 90, pipeY]], t, { color: "#ffe2b0", n: 10, speed: 0.25, size: 4 });
      K.flow(ctx, [[cx + 90, pipeY], [W - 150, pipeY]], t, { color: "#ffe2b0", n: 10, speed: 0.25, size: 4, alpha: open });
    } else {
      K.flow(ctx, [[150, pipeY], [cx - 90, pipeY]], t * 0.2, { color: "#ffe2b0", n: 14, speed: 0.05, size: 4, alpha: 0.6 });
    }
    // the valve: one object, recoloured
    const vcol = t < tZero ? C.ice : flowOn ? C.cyan : C.crimson;
    valve(ctx, cx, cy - 150, 86, { color: vcol, spin: t * 0.4 + (closed ? 1.2 : 0), open });
    D.stroke(ctx, [[cx, cy - 64], [cx, cy - 34]], { color: vcol, width: 6 });
    ctx.save();
    ctx.fillStyle = rgba(vcol, 0.4);
    ctx.fillRect(cx - 50, pipeY - 34, 100, 68 * (1 - open));
    ctx.restore();
    D.label(ctx, "THE CHOKEPOINT", cx, cy + 90, { align: "center", color: C.ice, size: 15, weight: 600 });
    if (t >= tZero) {
      D.text(ctx, flowOn ? "OPEN LANE" : "CLOSED VALVE", cx, cy - 270, { size: 24, weight: 600, tracking: 6, align: "center", color: vcol });
    }
    // hands
    const ga = prog(t, tGrip, 0.8);
    const turn = t > tDecide ? Math.sin((t - tDecide) * 1.4) * 0.25 : 0;
    hand(ctx, lerp(cx - 400, cx - 120, ease.out(ga)), cy - 150, 90, 0 + turn, C.cyan, ga);
    hand(ctx, cx + 220, cy - 150, 90, Math.PI, C.crimson, prog(t, tGrip + 0.8, 0.8) * 0.5);
    // capability vs assurance
    const capA = prog(t, tCap, 0.6);
    K.chip(ctx, "PLANS AGAINST: CAPABILITY", 240, 720, { color: C.ice, alpha: capA, size: 15 });
    K.chip(ctx, "NOT AGAINST: ASSURANCE", 240, 776, { color: C.mid, alpha: prog(t, tCap + 1, 0.6), size: 15 });
    K.chip(ctx, "ENERGY DEPENDENCE = ASSET OF THE OUTER-SEA SIDE", 1680, 720, { color: C.cyan, alpha: prog(t, tDep, 0.6), size: 15, align: "right" });
    D.caption(ctx, "Security at a chokepoint is zero-sum", t, tZero + 0.4, { y: 960, x: 960, align: "center" });
    K.chip(ctx, "RELATIVE POWER = DECIDING WHICH VALVE IS WHICH", 960, 870, { color: C.ice, align: "center", alpha: prog(t, tDecide, 0.6), size: 15 });
  };
}

// ================================================================ 4. the same ships, a different mechanism
function s4(S) {
  const view = asiaWide(780, [[20, -20], [150, 70]]);
  view.setCam(K.camFor(view, [86, 33], 0.92, 960, 560));
  const ships = [[93.5, 6.6], [95.5, 5.4], [92.0, 4.6], [97.5, 7.2], [90.5, 7.6], [94.8, 3.9]];
  const coalition = [[[62, 57], "RUSSIA"], [[51.4, 35.7], "IRAN"], [[51.2, 25.3], "QATAR"], [[54.4, 24.5], "UAE"], [P.beijing, "CHINA"]];
  const links = [[0, 4], [1, 4], [2, 4], [3, 4], [0, 1], [1, 2]];
  const tOverlay = S.at(1);
  const tMission = S.at(3);
  const tCoal = S.at(4);
  return (ctx, t) => {
    D.bg(ctx, { gridAlpha: 0.2 });
    view.base(ctx, { colors: { [ID.china]: rgba(C.crimson, 0.2) }, borderAlpha: 0.5 });
    const desat = prog(t, tOverlay, 1.2);
    ships.forEach(([lon, lat], i) => {
      const [x, y] = view.xy([lon, lat]);
      D.icon.ship(ctx, x, y, 26, -0.2 + (i % 3) * 0.1, mix(C.cyan, C.steelDeep, desat), 1 - desat * 0.4);
    });
    D.label(ctx, "THE SAME SHIPS", ...view.xy([94, 10.2]), { color: mix(C.cyan, C.steel, desat), size: 13, align: "center" });
    // institutional overlay
    const oa = prog(t, tOverlay + 0.4, 0.8);
    // budget line
    D.panel(ctx, 1380, 640, 420, 170, { alpha: oa, title: "Fleet mission · budget line", color: C.cyan });
    const pul = t > tMission ? 0.5 + 0.5 * Math.sin((t - tMission) * 3) : 0;
    for (let i = 0; i < 6; i++) D.bar(ctx, 1410 + i * 62, 790, 40, 30 + i * 14, C.cyan, { alpha: oa, glow: 6 + pul * 14 });
    D.label(ctx, "FUNDED", 1780, 690, { align: "right", color: C.cyan, alpha: prog(t, tMission, 0.5), size: 14, weight: 600 });
    // allied price spikes (Japan, Korea)
    const jp = view.xy([138, 36]);
    const kr = view.xy([127.8, 36.5]);
    for (const [p, lab] of [[jp, "JAPAN · PRICE"], [kr, "KOREA · PRICE"]]) {
      const data = [];
      for (let i = 0; i <= 20; i++) data.push([i / 20, 0.2 + (i > 12 ? (i - 12) * 0.09 : 0) + 0.03 * Math.sin(i)]);
      D.series(ctx, p[0] - 30, p[1] - 70, 90, 50, data, { color: C.amber, width: 2, p: prog(t, tOverlay + 1, 2), glow: 6, alpha: oa });
      D.label(ctx, lab, p[0] - 30, p[1] - 80, { color: C.amber, alpha: oa, size: 11 });
    }
    // Gulf producer choice
    const gc = view.xy([47, 23]);
    D.stroke(ctx, [[gc[0], gc[1]], [gc[0] - 60, gc[1] + 70]], { color: C.ice, width: 2, alpha: oa, to: prog(t, tOverlay + 1.5, 0.6) });
    D.stroke(ctx, [[gc[0], gc[1]], [gc[0] + 60, gc[1] + 70]], { color: C.ice, width: 2, alpha: oa, to: prog(t, tOverlay + 1.5, 0.6) });
    D.label(ctx, "GULF PRODUCER CHOICE", gc[0], gc[1] - 16, { align: "center", color: C.ice, alpha: oa, size: 12 });
    D.label(ctx, "CHINESE DEMAND", gc[0] - 60, gc[1] + 92, { align: "center", color: C.mid, alpha: oa, size: 10 });
    D.label(ctx, "U.S. ENFORCEMENT", gc[0] + 60, gc[1] + 92, { align: "center", color: C.mid, alpha: oa, size: 10 });
    // Eurasian energy coalition, brightening with each pulse of the mission
    const ca = prog(t, tCoal, 1.2) * (0.55 + 0.45 * pul);
    links.forEach(([a, b], i) => {
      const pa = view.xy(coalition[a][0]);
      const pb = view.xy(coalition[b][0]);
      D.stroke(ctx, D.arcPts(pa, pb, 0.12, 30), { color: C.amber, width: 2.2, glow: 12, alpha: ca, to: prog(t, tCoal + i * 0.3, 1) });
    });
    coalition.forEach(([ll, n], i) => {
      const p = view.xy(ll);
      D.node(ctx, p[0], p[1], 7, i === 4 ? C.crimson : C.amber, { alpha: prog(t, tCoal + i * 0.2, 0.6), glow: 10 + 14 * ca });
      D.label(ctx, n, p[0] + 12, p[1] - 10, { color: C.amber, alpha: prog(t, tCoal + i * 0.2, 0.6), size: 12 });
    });
    K.chip(ctx, "A EURASIAN ENERGY COALITION LOOKS LIKE PRUDENCE", 960, 990, { color: C.amber, align: "center", alpha: prog(t, tCoal + 2, 0.6), size: 15 });
  };
}

// ================================================================ 5. the arithmetic
function s5(S) {
  const tSrc = S.at(1);
  const tSplit = S.at(2);
  const tSouth = S.at(3);
  const tPac = S.at(4);
  const tDial = S.at(5);
  const tAll = S.at(6);
  const tSouthOnly = S.at(7);
  const tRation = S.at(8);
  const tLit = S.at(9);
  return (ctx, t) => {
    D.bg(ctx, { gridAlpha: 0.25 });
    D.stamp(ctx, "SCENARIO", 1640, 190, t, 0.4, { color: C.amber, size: 30, angle: -0.06 });
    D.label(ctx, "PLANNING CASE · NOT A CENSUS", 1640, 250, { align: "center", color: C.amber, size: 12, alpha: prog(t, 0.8, 0.6) });
    // Sankey
    const x0 = 330;
    const x1 = 860;
    const top = 300;
    const unit = 46; // px per mb/d
    const sa = prog(t, tSrc, 0.6);
    ctx.save();
    ctx.globalAlpha = sa;
    ctx.fillStyle = C.ice;
    ctx.fillRect(x0 - 26, top, 26, 11 * unit);
    ctx.restore();
    D.text(ctx, "11.0", x0 - 40, top + 5.5 * unit, { kind: "mono", size: 30, weight: 600, align: "right", alpha: sa });
    D.text(ctx, "MB/D CRUDE IMPORTS", x0 - 40, top + 5.5 * unit + 26, { kind: "mono", size: 12, align: "right", color: C.mid, alpha: sa });
    const rp1 = prog(t, tSouth - 0.6, 1.6);
    const rp2 = prog(t, tPac - 0.6, 1.6);
    D.ribbon(ctx, x0, top, top + 6 * unit, x1, top - 20, top - 20 + 6 * unit, C.crimson, { p: rp1, alpha: 0.6 });
    D.ribbon(ctx, x0, top + 6 * unit, top + 11 * unit, x1, top + 6 * unit + 60, top + 11 * unit + 60, C.amber, { p: rp2, alpha: 0.55 });
    D.text(ctx, "6.0", x1 + 20, top - 20 + 3 * unit, { kind: "mono", size: 30, weight: 600, color: C.crimson, alpha: rp1 });
    D.text(ctx, "SOUTHERN STRAIT", x1 + 20, top - 20 + 3 * unit + 26, { kind: "mono", size: 12, color: C.crimson, alpha: rp1 });
    D.text(ctx, "5.0", x1 + 20, top + 60 + 8.5 * unit, { kind: "mono", size: 30, weight: 600, color: C.amber, alpha: rp2 });
    D.text(ctx, "PACIFIC OR LAND · UNTOUCHED BY A MALACCA-ONLY STOP", x1 + 20, top + 60 + 8.5 * unit + 26, { kind: "mono", size: 12, color: C.amber, alpha: rp2 });
    D.label(ctx, "THREE PIPES", (x0 + x1) / 2, top - 60, { align: "center", color: C.mid, alpha: prog(t, tSplit, 0.6), size: 13 });
    // stock dial
    const da = prog(t, tDial, 0.8);
    const gx = 1460;
    const gy = 560;
    D.gauge(ctx, gx, gy, 150, 0.8 * prog(t, tDial + 0.3, 1.5, ease.out), { alpha: da, color: C.ice });
    D.text(ctx, "800", gx, gy + 70, { kind: "mono", size: 48, weight: 600, align: "center", alpha: da });
    D.text(ctx, "MN BBL · HYPOTHETICAL STOCK", gx, gy + 100, { kind: "mono", size: 13, align: "center", color: C.mid, alpha: da });
    // readouts
    const r1 = prog(t, tAll, 0.6);
    const r2 = prog(t, tSouthOnly, 0.6);
    D.panel(ctx, 1240, 720, 440, 92, { alpha: r1, fill: rgba("#0b0e13", 0.9) });
    D.text(ctx, "≈ 70 DAYS", 1264, 772, { size: 34, weight: 600, tracking: 3, alpha: r1 });
    D.text(ctx, "IF EVERY IMPORT STOPS · 800 ÷ 11", 1264, 798, { kind: "mono", size: 12, color: C.mid, alpha: r1 });
    D.panel(ctx, 1240, 830, 440, 92, { alpha: r2, fill: rgba("#0b0e13", 0.9), color: C.crimson });
    D.text(ctx, "≈ 4 MONTHS", 1264, 882, { size: 34, weight: 600, tracking: 3, alpha: r2, color: C.crimson });
    D.text(ctx, "IF ONLY THE SOUTHERN 6 STOP · 800 ÷ 6", 1264, 908, { kind: "mono", size: 12, color: C.mid, alpha: r2 });
    D.label(ctx, "RATIONING STARTS BEFORE EMPTY", 180, 980, { color: C.amber, alpha: prog(t, tRation, 0.6), size: 15, weight: 600 });
    K.chip(ctx, "DIVIDING BY TOTAL IMPORTS OVERSTATES THE SPEED OF A NARROW CLOSURE", 180, 930, { color: C.mid, alpha: prog(t, tLit, 0.6), size: 13 });
  };
}

// ================================================================ 6. the surviving five million
function s6(S) {
  const view = asiaWide(900, [[55, 0], [175, 64]]);
  view.setCam(K.camFor(view, [104, 37], 1, 900, 520));
  const tMy = S.at(2);
  const tKz = S.at(3);
  const tRu = S.at(4);
  const tSum = S.at(5);
  const tGas = S.at(6);
  const tPac = S.at(7);
  const tWar = S.at(8);
  const bars = [["MYANMAR", 22, tMy], ["KAZAKHSTAN", 20, tKz], ["RUSSIA → DAQING", 30, tRu]];
  const americas = [[180, 30.5], [165, 31.5], [150, 32], [138, 31.2], [128, 31.0], P.shanghai];
  return (ctx, t) => {
    D.bg(ctx, { gridAlpha: 0.2 });
    view.base(ctx, { colors: { [ID.china]: rgba(C.crimson, 0.18) }, borderAlpha: 0.5 });
    const pipe = (pts, t0, col, w = 4) => {
      const l = D.smoothPts(view.line(pts), 6);
      D.thread(ctx, l, t, t0, 1.6, { color: col, width: w, particles: 5, speed: 0.15, glow: 14 });
      return l;
    };
    pipe(PIPES.myanmar, tMy, C.amber);
    pipe(PIPES.kazakhstan, tKz, C.amber);
    pipe(PIPES.espoDaqing, tRu, C.amber);
    pipe([[118, 56.5], [121, 55.5], P.skovorodino], tRu - 0.3, rgba(C.amber, 0.5), 2);
    D.label(ctx, "BAY OF BENGAL → YUNNAN", ...view.xy([91, 17.5]), { color: C.amber, alpha: prog(t, tMy + 1, 0.5), size: 12, align: "right" });
    D.label(ctx, "KAZAKHSTAN → XINJIANG", ...view.xy([72, 51.5]), { color: C.amber, alpha: prog(t, tKz + 1, 0.5), size: 12, align: "center" });
    D.label(ctx, "ESPO SPUR → DAQING", ...view.xy([127.5, 55.6]), { color: C.amber, alpha: prog(t, tRu + 1, 0.5), size: 12 });
    // gas: explicitly not plugged into the crude gap
    const gl = D.smoothPts(view.line(PIPES.powerOfSiberia), 6);
    D.stroke(ctx, gl, { color: C.violet, width: 3, dash: [8, 6], to: prog(t, tGas, 1.6), glow: 8 });
    D.label(ctx, "POWER OF SIBERIA · GAS ≈ 38 BCM/Y · NOT CRUDE", ...view.xy([126.5, 62.0]), { color: C.violet, alpha: prog(t, tGas + 1, 0.5), size: 12 });
    // Pacific inflows bypass the Indian Ocean and stay lit
    const ko = D.smoothPts(view.line(PIPES.espoPacific), 6);
    D.stroke(ctx, ko, { color: C.amber, width: 2, alpha: 0.6 * prog(t, tPac, 1) });
    const kl = D.smoothPts(view.line(LANES.kozminoToChina), 6);
    D.thread(ctx, kl, t, tPac + 0.5, 1.6, { color: "#ffe2b0", width: 2.5, particles: 6, speed: 0.14 });
    K.place(ctx, view.xy(P.kozmino), "KOZMINO", { color: C.ice, alpha: prog(t, tPac + 0.5, 0.5), dx: 12, dy: -8, dot: 4 });
    const al = D.smoothPts(view.line(americas), 6);
    D.thread(ctx, al, t, tPac + 2.2, 1.8, { color: "#ffe2b0", width: 2.5, particles: 6, speed: 0.14 });
    D.label(ctx, "← CARGOES FROM THE AMERICAS", ...view.xy([158, 34]), { color: "#ffe2b0", alpha: prog(t, tPac + 3, 0.5), size: 12, align: "center" });
    // larger war bracket
    const wa = prog(t, tWar, 0.6);
    if (wa > 0) {
      const a = view.xy([124, 47]);
      const b = view.xy([176, 24]);
      D.brackets(ctx, a[0], a[1], b[0] - a[0], b[1] - a[1], { color: C.crimson, len: 22, lw: 2.5, alpha: wa });
      D.label(ctx, "INCLUDE THE PACIFIC → A LARGER WAR", a[0] + 10, b[1] + 30, { color: C.crimson, alpha: wa, size: 13 });
    }
    // design-capacity bars
    const pa = prog(t, S.at(1), 0.6);
    const px = 110;
    const py = 640;
    D.panel(ctx, px, py, 600, 350, { alpha: pa, title: "Inland crude lines · design capacity", fill: rgba("#0b0e13", 0.92) });
    bars.forEach(([n, v, t0], i) => {
      const y = py + 80 + i * 66;
      D.text(ctx, n, px + 24, y, { kind: "mono", size: 13, color: C.mid, alpha: pa });
      D.hbar(ctx, px + 24, y + 10, 420, 20, C.amber, { p: (v / 32) * prog(t, t0, 1.2, ease.out), alpha: pa });
      D.text(ctx, `${v} MT/Y`, px + 560, y + 26, { kind: "mono", size: 16, weight: 600, align: "right", color: C.amber, alpha: prog(t, t0 + 0.8, 0.5) });
    });
    const sa = prog(t, tSum, 0.6);
    D.stroke(ctx, [[px + 24, py + 285], [px + 576, py + 285]], { color: C.border, width: 1, alpha: sa });
    D.text(ctx, "≈ 1.45 MB/D", px + 24, py + 324, { kind: "mono", size: 28, weight: 600, color: C.ice, alpha: sa });
    D.text(ctx, "72 MT/Y · JUST UNDER 1.5", px + 576, py + 324, { kind: "mono", size: 13, color: C.mid, align: "right", alpha: sa });
  };
}

// ================================================================ 7. every southern gate
function s7(S) {
  const view = seAsia(1500);
  const camM = K.camFor(view, [101.5, 3.0], 2.6, 960, 540);
  const camA = K.camFor(view, [112.5, -1.5], 0.86, 960, 560);
  const gates = [
    ["SUNDA", P.sunda, LANES.sundaRoute, ID.indonesia],
    ["LOMBOK", P.lombok, LANES.lombokRoute, ID.philippines],
    ["EASTERN EXITS", P.ombai, LANES.ombaiRoute, ID.timor],
  ];
  const tGates = S.at(1);
  const tCost = S.at(2);
  const tDeep = S.at(4);
  const tCap = S.at(5);
  const tCoast = S.at(6);
  const tValve = S.at(8);
  return (ctx, t) => {
    D.bg(ctx, { grid: false, color: "#090c10" });
    view.setCam(MapView.mixCam(camM, camA, prog(t, 0.5, Math.max(4, tGates + 4), ease.inOut)));
    view.base(ctx, { landFill: "#161c24", borderAlpha: 0.5 });
    // Malacca closed
    const mp = view.line(STRAIT);
    K.heat(ctx, D.smoothPts(mp, 4), { color: "#bfe9ff", width: 12, alpha: 0.25 });
    const mx = view.xy([100.6, 3.1]);
    D.stroke(ctx, [[mx[0] - 16, mx[1] - 16], [mx[0] + 16, mx[1] + 16]], { color: C.crimson, width: 4 });
    D.stroke(ctx, [[mx[0] - 16, mx[1] + 16], [mx[0] + 16, mx[1] - 16]], { color: C.crimson, width: 4 });
    D.label(ctx, "MALACCA", mx[0] - 24, mx[1] - 20, { color: C.crimson, size: 13, align: "right" });
    // diverted ribbons + gates light third-country coastlines
    gates.forEach(([n, ll, route, coast], i) => {
      const t0 = tGates + i * 1.4;
      const pts = D.smoothPts(view.line(route), 6);
      D.thread(ctx, pts, t, t0, 2.2, { color: "#ffe2b0", width: 2.6, particles: 7, speed: 0.08, glow: 12 });
      const g = view.xy(ll);
      D.node(ctx, g[0], g[1], 8, C.amber, { alpha: prog(t, t0 + 1, 0.5), glow: 18, pulseT: t > tValve ? t + i : undefined });
      D.label(ctx, n, g[0] + 14, g[1] + 24, { color: C.amber, alpha: prog(t, t0 + 1, 0.5), size: 14, weight: 600 });
      const ca = prog(t, tCoast + i * 1.2, 0.8);
      view.draw(ctx, view.country(coast), { stroke: C.ice, width: 1.6, glow: 10, alpha: ca * 0.8 });
    });
    view.draw(ctx, view.country(ID.indonesia), { stroke: C.ice, width: 1.4, glow: 8, alpha: prog(t, tCoast, 0.8) * 0.7 });
    D.label(ctx, "EACH GATE · A THIRD COUNTRY'S TERRITORIAL SEA", 140, 220, { color: C.ice, alpha: prog(t, tCoast, 0.6), size: 13 });
    // freight + insurance indices
    const ia = prog(t, tCost - 1.5, 0.6);
    const tick = (label, x, base, t0) => {
      const v = base * (1 + 0.65 * prog(t, t0, 4, ease.out));
      D.panel(ctx, x, 140, 250, 86, { alpha: ia, fill: rgba("#0b0e13", 0.92) });
      D.text(ctx, label, x + 16, 168, { kind: "mono", size: 11, color: C.mid, alpha: ia });
      D.text(ctx, v.toFixed(0), x + 16, 206, { kind: "mono", size: 28, weight: 600, color: C.amber, alpha: ia });
      tri(ctx, x + 214, 196, 9, C.amber, ia * prog(t, t0, 0.4));
    };
    tick("FREIGHT INDEX", 1290, 100, S.at(2));
    tick("WAR-RISK INSURANCE", 1560, 100, S.at(3));
    D.label(ctx, "LONGER JOURNEY", 1290, 250, { color: C.mid, alpha: prog(t, S.at(2), 0.5), size: 12 });
    // depth callout
    const dA = fade(t, tDeep, 0.6, tCap + 2, 0.6);
    const lb = view.xy(P.lombok);
    if (dA > 0) {
      D.stroke(ctx, [lb, [lb[0] + 120, lb[1] + 120]], { color: C.ice, width: 1.2, alpha: dA });
      D.panel(ctx, lb[0] + 120, lb[1] + 100, 360, 84, { alpha: dA, fill: rgba("#0b0e13", 0.92) });
      D.text(ctx, "DEEP WATER", lb[0] + 140, lb[1] + 134, { size: 20, weight: 600, tracking: 3, alpha: dA });
      D.text(ctx, "THE LARGEST TANKERS ALREADY PREFER IT", lb[0] + 140, lb[1] + 160, { kind: "mono", size: 11, color: C.mid, alpha: dA });
    }
    D.caption(ctx, "A real closure must price every southern gate", t, tCap, { y: 990 });
    K.chip(ctx, "THE OFFSHORE POWER WANTS A VALVE · THE GEOGRAPHY OFFERS AN ARCHIPELAGO", 960, 900, { color: C.ice, align: "center", alpha: prog(t, tValve, 0.6), size: 14 });
  };
}

// ================================================================ 8. demand destruction
function s8(S) {
  const segs = [
    ["AGRICULTURAL DIESEL", 1.6, "protect"],
    ["MILITARY DIESEL", 1.2, "protect"],
    ["HOUSEHOLD HEATING", 1.3, "keep"],
    ["POWER & INDUSTRY", 2.3, "keep"],
    ["EXPORTED PRODUCT", 1.2, "refine"],
    ["EXPORT PETROCHEMICALS", 1.6, "cut2"],
    ["PRIVATE ROAD FUEL", 1.8, "cut1"],
  ];
  const tProt = S.at(1);
  const tRoad = S.at(2);
  const tPetro = S.at(3);
  const tRef = S.at(4);
  const tGrid = S.at(5);
  const tFx = S.at(6);
  const tComp = S.at(7);
  const tIns = S.at(8);
  const tRetag = S.at(9);
  return (ctx, t) => {
    D.bg(ctx, { gridAlpha: 0.2 });
    // stacked priority chart
    const x = 160;
    const w = 520;
    let y = 920;
    D.label(ctx, "CRUDE ALLOCATION · PRIORITY STACK", x, 150, { color: C.mid, size: 13 });
    segs.forEach(([n, v, kind]) => {
      let a = prog(t, 0.2, 0.8);
      let col = C.steel;
      let scale = 1;
      if (kind === "protect") col = mix(C.steel, C.green, prog(t, tProt, 0.8));
      if (kind === "cut1") scale = 1 - prog(t, tRoad + 0.3, 1.2);
      if (kind === "cut2") scale = 1 - prog(t, tPetro + 0.6, 1.2);
      if (kind === "refine") scale = 1 - 0.75 * prog(t, tRef + 0.5, 1.2);
      const h = v * 66 * scale;
      if (h > 1) {
        ctx.save();
        ctx.globalAlpha = a;
        ctx.fillStyle = rgba(col, kind === "protect" ? 0.45 : 0.28);
        ctx.strokeStyle = col;
        ctx.lineWidth = 1.5;
        ctx.fillRect(x, y - h, w, h - 3);
        ctx.strokeRect(x, y - h, w, h - 3);
        ctx.restore();
        if (h > 22) D.text(ctx, n, x + 16, y - h / 2 + 6, { kind: "mono", size: 14, color: kind === "protect" ? C.green : C.ice, alpha: a * clamp(scale * 2) });
        if (kind === "protect") D.icon.lock(ctx, x + w - 26, y - h / 2 - 4, 18, C.green, a * prog(t, tProt, 0.8));
      }
      if (kind === "cut1" || kind === "cut2") D.label(ctx, `${n} · CUT`, x + w + 24, kind === "cut1" ? 250 : 280, { color: C.crimson, size: 12, alpha: prog(t, kind === "cut1" ? tRoad : tPetro, 0.5) });
      y -= h;
    });
    K.chip(ctx, "CUT BEFORE HOUSEHOLD HEATING", x + w + 24, 640, { color: C.mid, alpha: prog(t, tPetro + 1, 0.6), size: 12 });
    K.chip(ctx, "REFINERIES FAVOR THE DOMESTIC BARREL", x + w + 24, 700, { color: C.mid, alpha: prog(t, tRef, 0.6), size: 12 });
    // grid mix that lets a state absorb a season
    ["COAL", "NUCLEAR", "HYDRO", "PIPELINE GAS"].forEach((n, i) => K.chip(ctx, n, x + i * 132, 990, { color: C.ice, alpha: prog(t, tGrid + i * 0.4, 0.5), size: 13 }));
    // factory idles + currency loop
    const fa = prog(t, tFx, 0.6);
    const fx = 1180;
    const fy = 300;
    const idle = prog(t, tFx + 0.5, 1.5);
    D.icon.factory(ctx, fx, fy, 110, mix(C.ice, C.steelDeep, idle), Math.max(0.3, fa), 1 - idle);
    D.label(ctx, idle > 0.5 ? "EXPORT FACTORY · IDLE" : "EXPORT FACTORY", fx, fy + 86, { align: "center", color: C.mid, alpha: fa, size: 12 });
    const loopC = [1500, 330];
    const loopR = 120;
    const nodes = [["EXPORTS", -Math.PI / 2], ["FX EARNINGS", Math.PI / 6], ["NEXT CARGO", (5 * Math.PI) / 6]];
    const brk = prog(t, tComp, 1);
    for (let i = 0; i < 3; i++) {
      const a0 = nodes[i][1] + 0.35;
      const a1 = nodes[(i + 1) % 3][1] - 0.35 + (i === 2 ? Math.PI * 2 : 0);
      const pts = [];
      for (let k = 0; k <= 30; k++) {
        const a = lerp(a0, a1 < a0 ? a1 + Math.PI * 2 : a1, k / 30);
        pts.push([loopC[0] + Math.cos(a) * loopR, loopC[1] + Math.sin(a) * loopR]);
      }
      const broken = i === 0 && brk > 0;
      D.arrow(ctx, broken ? D.slice(pts, 0, 0.4) : pts, { color: broken ? C.crimson : C.ice, width: 2, head: 10, alpha: fa });
    }
    nodes.forEach(([n, a]) => D.label(ctx, n, loopC[0] + Math.cos(a) * loopR * 1.25, loopC[1] + Math.sin(a) * loopR * 1.25 + 5, { align: "center", color: C.ice, alpha: fa, size: 12 }));
    K.chip(ctx, "AN ENERGY SIEGE AND A DOLLAR SIEGE ARE COMPLEMENTS", 1340, 540, { color: C.crimson, align: "center", alpha: brk, size: 13 });
    // insurance goes dark; remaining cargoes retag amber
    const tankers = [[1060, 760], [1240, 820], [1420, 760], [1600, 830], [1760, 770]];
    tankers.forEach(([tx, ty], i) => {
      const dark = prog(t, tIns + i * 0.25, 0.6);
      const moving = i === 1 || i === 3;
      const retag = moving ? prog(t, tRetag + (i === 3 ? 0.6 : 0), 0.6) : 0;
      const col = moving && retag > 0 ? mix(C.steel, C.amber, retag) : mix(C.cyan, "#2a3340", dark);
      D.icon.ship(ctx, tx + (moving ? ((t - tRetag) > 0 ? (t - tRetag) * 14 : 0) : 0), ty, 60, 0, col, 1);
      D.node(ctx, tx, ty - 44, 6, C.cyan, { alpha: 1 - dark, glow: 10, ring: false });
      if (moving && retag > 0) K.chip(ctx, i === 1 ? "YUAN · GOLD" : "BILATERAL BALANCE", tx, ty + 56, { color: C.amber, align: "center", alpha: retag, size: 12 });
    });
    D.label(ctx, "BLUE INSURANCE SYSTEM", 1060, 690, { color: C.cyan, alpha: prog(t, tIns - 1, 0.5) * (1 - prog(t, tIns + 1.5, 0.6)), size: 12 });
    D.label(ctx, "INSURED OUTSIDE AMERICAN LEGAL REACH", 1060, 920, { color: C.amber, alpha: prog(t, tRetag + 1, 0.6), size: 12 });
  };
}

// ================================================================ 9. the Arctic and overland option set
function s9(S) {
  const proj = geoAzimuthalEquidistant().rotate([-100, -90]).scale(560).translate([W / 2, H / 2]);
  const view = new MapView(proj, { res: "50m" });
  view.setCam(K.camFor(view, [100, 90], 1, 900, 250));
  const tPipes = S.at(1);
  const tNsr = S.at(3);
  const tVol = S.at(4);
  const tGw = S.at(6);
  return (ctx, t) => {
    D.bg(ctx, { gridAlpha: 0.15 });
    view.base(ctx, { graticule: true, colors: { [ID.china]: rgba(C.crimson, 0.18), [ID.russia]: C.landHi }, borderAlpha: 0.5 });
    D.label(ctx, "NORTH POLE", ...view.xy([0, 90]), { color: C.dim, size: 11, align: "center" });
    // pipelines: needles rise, stop below the deficit
    for (const k of ["myanmar", "kazakhstan", "espoDaqing"]) D.stroke(ctx, D.smoothPts(view.line(PIPES[k]), 6), { color: C.amber, width: 2.5, glow: 10, alpha: prog(t, tPipes, 1) });
    // Northern Sea Route: thin seasonal thread
    const nsr = D.smoothPts(view.line(LANES.nsr), 8);
    D.stroke(ctx, nsr, { color: C.ice, width: 1.5, dash: [6, 6], to: prog(t, tNsr, 3), alpha: 0.9 });
    for (let i = 1; i <= 5; i++) {
      const q = D.pointAt(nsr, i / 7);
      const a = prog(t, tNsr + i * 0.5, 0.4);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.strokeStyle = C.ice;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let k = 0; k < 3; k++) {
        const ang = (k * Math.PI) / 3;
        ctx.moveTo(q.x - Math.cos(ang) * 7, q.y - Math.sin(ang) * 7);
        ctx.lineTo(q.x + Math.cos(ang) * 7, q.y + Math.sin(ang) * 7);
      }
      ctx.stroke();
      ctx.restore();
    }
    D.label(ctx, "NORTHERN SEA ROUTE · ICE CLASS · ICEBREAKERS", ...view.xy([95, 80]), { color: C.ice, alpha: prog(t, tNsr + 1, 0.6), size: 12, align: "center" });
    // calendar window
    const ca = prog(t, tNsr + 1.5, 0.6);
    const months = "JFMAMJJASOND";
    for (let i = 0; i < 12; i++) {
      const on = i >= 6 && i <= 10;
      ctx.save();
      ctx.globalAlpha = ca;
      ctx.fillStyle = on ? rgba(C.ice, i === 10 ? 0.4 : 0.75) : rgba(C.mid, 0.12);
      ctx.fillRect(1380 + i * 34, 170, 30, 22);
      ctx.restore();
      D.text(ctx, months[i], 1395 + i * 34, 212, { kind: "mono", size: 11, color: on ? C.ice : C.dim, align: "center", alpha: ca });
    }
    D.label(ctx, "SUMMER + SHOULDER SEASON", 1380, 156, { color: C.ice, alpha: ca, size: 12 });
    // volume: a rounding error
    const va = prog(t, tVol, 0.6);
    D.panel(ctx, 1360, 260, 460, 180, { alpha: va, title: "Annual volume", fill: rgba("#0b0e13", 0.92) });
    D.text(ctx, "MALACCA · OIL", 1384, 330, { kind: "mono", size: 12, color: C.mid, alpha: va });
    D.hbar(ctx, 1384, 340, 410, 18, C.ice, { p: prog(t, tVol, 1), alpha: va });
    D.text(ctx, "NSR · ALL CARGO", 1384, 392, { kind: "mono", size: 12, color: C.mid, alpha: va });
    D.hbar(ctx, 1384, 402, 410, 18, C.ice, { p: 0.025 * prog(t, tVol + 0.5, 1), alpha: va });
    D.text(ctx, "ROUNDING ERROR", 1420, 418, { kind: "mono", size: 12, color: C.amber, alpha: prog(t, tVol + 1, 0.5) });
    K.chip(ctx, "A RELIEF VALVE, NOT A REPLACEMENT ARTERY", 1360, 490, { color: C.ice, alpha: prog(t, S.at(5), 0.6), size: 13 });
    // pipeline needles vs southern deficit
    const pa = prog(t, tPipes + 1, 0.6);
    D.panel(ctx, 1360, 560, 460, 170, { alpha: pa, title: "Pipelines vs southern deficit", fill: rgba("#0b0e13", 0.92) });
    const fill = (1.45 / 6) * prog(t, tPipes + 1.5, 2.5, ease.out);
    D.hbar(ctx, 1384, 620, 410, 22, C.amber, { p: fill, alpha: pa });
    D.stroke(ctx, [[1384 + 410, 606], [1384 + 410, 656]], { color: C.crimson, width: 2, dash: [4, 4], alpha: pa });
    D.text(ctx, "DEFICIT 6 MB/D", 1794, 680, { kind: "mono", size: 12, color: C.crimson, align: "right", alpha: pa });
    D.text(ctx, "FULL DESIGN ≈ 1.45", 1384, 680, { kind: "mono", size: 12, color: C.amber, alpha: pa });
    D.label(ctx, "RUSSIAN SURPLUS · KAZAKH POLITICS · BURMESE CORRIDOR", 1384, 712, { color: C.mid, alpha: prog(t, S.at(2), 0.6), size: 10 });
    // Gwadar: a thin political line with berth limits and a risk hatch
    const gw = D.smoothPts(view.line(PIPES.gwadarKashgar), 6);
    const ga = prog(t, tGw, 1.5);
    view.withClip(ctx, view.pathOf({ type: "Polygon", coordinates: [[[60, 24], [70, 24], [72, 33], [62, 30], [60, 24]].reverse()] }), () => {
      ctx.save();
      ctx.globalAlpha = ga * 0.35;
      ctx.strokeStyle = C.crimson;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 0; x < W; x += 9) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x - 400, H);
      }
      ctx.stroke();
      ctx.restore();
    });
    D.stroke(ctx, gw, { color: C.amber, width: 1.5, to: ga, glow: 6 });
    const g = view.xy(P.gwadar);
    D.square(ctx, g[0], g[1], 9, C.amber, { stroke: true, alpha: ga, glow: 6 });
    D.label(ctx, "GWADAR · BERTH LIMITS", g[0] - 14, g[1] + 22, { color: C.amber, alpha: ga, size: 11, align: "right" });
    D.label(ctx, "SECURITY RISK", g[0] - 14, g[1] + 40, { color: C.crimson, alpha: ga, size: 11, align: "right" });
  };
}

// ================================================================ 10. one quarter forward
function s10(S) {
  const gx = 260;
  const gy = 220;
  const gw = 1100;
  const gh = 480;
  const X = (m) => gx + (m / 3) * gw;
  const Y = (v) => gy + gh - ((v - 200) / 650) * gh;
  // illustrative stock path (mn bbl)
  const base = [[0, 800], [0.5, 770], [1, 715], [1.5, 665], [2, 605]];
  const openB = [[2, 605], [2.5, 562], [3, 518]];
  const closedB = [[2, 605], [2.5, 470], [3, 330]];
  const tM1 = S.at(1);
  const tIns = S.at(2);
  const tM2 = S.at(3);
  const tPipe = S.at(4);
  const tFac = S.at(5);
  const tM3 = S.at(6);
  const tClosed = S.at(7);
  const tCalc = S.at(8);
  const tForm = S.at(9);
  const tPrice = S.at(10);
  return (ctx, t) => {
    D.bg(ctx, { gridAlpha: 0.2 });
    D.axes(ctx, gx, gy, gw, gh, { ticks: 4 });
    for (let m = 0; m <= 3; m++) {
      D.stroke(ctx, [[X(m), gy], [X(m), gy + gh]], { color: C.faint, width: 1, dash: [3, 6] });
      if (m > 0) D.text(ctx, `MONTH ${m}`, X(m - 0.5), gy + gh + 34, { kind: "mono", size: 15, align: "center", color: C.mid });
    }
    D.text(ctx, "STOCKS · MN BBL", gx, gy - 20, { kind: "mono", size: 12, color: C.mid });
    D.text(ctx, "ILLUSTRATIVE", gx + gw, gy - 20, { kind: "mono", size: 12, color: C.amber, align: "right" });
    for (const v of [800, 600, 400]) D.text(ctx, String(v), gx - 14, Y(v) + 5, { kind: "mono", size: 12, color: C.dim, align: "right" });
    // priority floor
    D.stroke(ctx, [[gx, Y(330)], [gx + gw, Y(330)]], { color: C.crimson, width: 1.5, dash: [8, 6], alpha: prog(t, tClosed, 0.8) });
    D.label(ctx, "MILITARY + AGRICULTURAL PRIORITY FLOOR", gx + 10, Y(330) + 22, { color: C.crimson, alpha: prog(t, tClosed, 0.8), size: 11 });
    // stock draw
    const m = K.track(t, [[tM1, 0], [tM2, 1], [tM3, 2], [tCalc - 1, 3]], ease.linear);
    const path = base.map(([mm, v]) => [X(mm), Y(v)]);
    const upTo = clamp(m / 2);
    D.stroke(ctx, path, { color: C.ice, width: 3.5, glow: 10, to: upTo });
    if (m > 2) {
      const b = clamp(m - 2);
      D.stroke(ctx, openB.map(([mm, v]) => [X(mm), Y(v)]), { color: C.amber, width: 3, glow: 10, to: b });
      D.stroke(ctx, closedB.map(([mm, v]) => [X(mm), Y(v)]), { color: C.crimson, width: 3, glow: 10, to: b * prog(t, tClosed, 0.5) });
      D.label(ctx, "PACIFIC OPEN · INJURED, FUNCTIONING", X(3) + 14, Y(518) + 4, { color: C.amber, alpha: b, size: 12 });
      D.label(ctx, "PACIFIC CLOSED · INDUSTRIAL CORE CONTRACTS", X(3) + 14, Y(330) - 14, { color: C.crimson, alpha: prog(t, tClosed + 1, 0.6), size: 12 });
    }
    // event annotations
    const ev = [
      [0.15, "SHIPS EAST OF THE GATES DISCHARGE", tM1 + 0.6, 0],
      [0.55, "TANKER INSURANCE SPIKES", tIns, 1],
      [1.15, "PARTIAL REROUTE", tM2 + 0.6, 0],
      [1.4, "PACIFIC RUSSIAN BARRELS", tM2 + 2.5, 1],
      [1.65, "PIPELINES FORCED UP", tPipe, 2],
      [1.85, "SOUTH-COAST FACTORIES IDLE", tFac, 3],
    ];
    ev.forEach(([mm, lab, t0, row]) => {
      const a = prog(t, t0, 0.5);
      const x = X(mm);
      D.stroke(ctx, [[x, gy + gh - 4], [x, gy + 40 + row * 30]], { color: C.mid, width: 1, alpha: a * 0.5 });
      D.label(ctx, lab, x + 6, gy + 40 + row * 30, { color: C.ice, alpha: a, size: 11 });
    });
    // insurance spike sparkline
    const ia = prog(t, tIns, 0.6);
    const sp = [];
    for (let i = 0; i <= 20; i++) sp.push([i / 20, i < 6 ? 0.15 : 0.15 + 0.8 * Math.exp(-Math.pow((i - 9) / 4, 2)) + (i > 9 ? 0.35 : 0)]);
    D.series(ctx, 1420, 230, 360, 110, sp, { color: C.amber, width: 2, p: prog(t, tIns, 2), alpha: ia, glow: 6 });
    D.label(ctx, "WAR-RISK PREMIUM", 1420, 220, { color: C.amber, alpha: ia, size: 11 });
    // option value formula
    const fa = prog(t, tForm, 0.6);
    D.panel(ctx, 260, 820, 1500, 120, { alpha: fa, fill: rgba("#0b0e13", 0.92), title: "Why redundant routes look overpriced", titleColor: C.mid });
    D.text(ctx, "OPTION VALUE  =  P(SIEGE)  ×  OUTPUT LOST PER MONTH OF SHORTAGE", 290, 900, { kind: "mono", size: 26, weight: 500, alpha: fa, color: C.ice });
    K.chip(ctx, "PRICE IN P(SIEGE) AND THE PEACETIME OVERPAYMENT DISAPPEARS", 1760, 800, { color: C.amber, align: "right", alpha: prog(t, tPrice, 0.6), size: 12 });
    D.label(ctx, "CHINA'S PEACETIME OVERPAYMENT FOR REDUNDANT ROUTES", 1760, 770, { color: C.mid, align: "right", alpha: prog(t, tCalc, 0.6) * (1 - prog(t, tPrice, 0.4)), size: 12 });
  };
}

// ================================================================ 11. the third month
function s11(S) {
  const tGauge = S.at(1);
  const tRed = S.at(2);
  const tResp = S.at(3);
  const tPrem = S.at(4);
  const tTaiwan = S.at(5);
  const tEscape = S.at(6);
  return (ctx, t) => {
    D.bg(ctx, { gridAlpha: 0.2 });
    // survival gauge of the continental power
    const ga = prog(t, 0.2, 0.8);
    const v = lerp(0.35, 0.93, prog(t, tGauge, Math.max(2, tRed - tGauge + 1), ease.inOut)) + 0.01 * Math.sin(t * 5);
    D.gauge(ctx, 420, 470, 190, v, { alpha: ga, zones: [[0, 0.55, C.steel], [0.55, 0.8, C.amber], [0.8, 1, C.crimson]] });
    D.text(ctx, "SURVIVAL PRESSURE", 420, 540, { size: 22, weight: 600, tracking: 5, align: "center", alpha: ga });
    D.text(ctx, "CONTINENTAL POWER · MONTH 3 · PACIFIC CLOSED", 420, 568, { kind: "mono", size: 12, color: C.mid, align: "center", alpha: ga });
    K.chip(ctx, "NOT A LIMITED NAVAL MEASURE", 420, 640, { color: C.mid, align: "center", alpha: fade(t, S.at(1, 0.5), 0.5, tRed, 0.5), size: 14 });
    K.chip(ctx, "AN ATTEMPT ON POLITICAL SURVIVAL", 420, 640, { color: C.crimson, align: "center", alpha: prog(t, tRed, 0.5), size: 14 });
    // response categories only
    const cats = [
      ["ECONOMIC RETALIATION", "ECON"],
      ["PRESSURE ON THIRD COUNTRIES", "THIRD"],
      ["RISK TO THE BLOCKADING FLEET", "FLEET"],
    ];
    D.label(ctx, "RESPONSE SET · CATEGORIES ONLY", 900, 250, { color: C.mid, alpha: prog(t, tResp, 0.6), size: 12 });
    cats.forEach(([n, k], i) => {
      const a = prog(t, tResp + i * (S.e[3] - S.b[3]) * 0.28, 0.5);
      const y = 300 + i * 110;
      D.panel(ctx, 900, y, 460, 84, { alpha: a, fill: rgba("#0b0e13", 0.9), color: C.crimson });
      D.text(ctx, n, 990, y + 50, { size: 19, weight: 600, tracking: 2.5, alpha: a });
      if (k === "ECON") {
        D.text(ctx, "⇄", 945, y + 54, { size: 30, color: C.crimson, align: "center", alpha: a });
      } else if (k === "THIRD") {
        for (let j = 0; j < 3; j++) D.node(ctx, 930 + j * 16, y + 34 + (j % 2) * 16, 5, C.crimson, { alpha: a, ring: false, glow: 6 });
      } else {
        ctx.save();
        ctx.globalAlpha = a;
        ctx.strokeStyle = C.crimson;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(925, y + 50);
        ctx.lineTo(965, y + 50);
        ctx.lineTo(958, y + 36);
        ctx.lineTo(932, y + 36);
        ctx.closePath();
        ctx.stroke();
        ctx.restore();
      }
    });
    K.chip(ctx, "PREMISE: SURVIVAL RANKS ABOVE THE OTHER SIDE'S RULES OF ENGAGEMENT", 900, 680, { color: C.ice, alpha: prog(t, tPrem, 0.6), size: 13 });
    // a Taiwan-crisis thread, with the energy valve hung on it
    const ta = prog(t, tTaiwan, 0.8);
    const y0 = 830;
    const ext = prog(t, tEscape + 1, 3);
    D.stroke(ctx, [[120, y0], [lerp(1500, 1950, ext), y0]], { color: C.ice, width: 2.5, to: prog(t, tTaiwan, 1.4), alpha: ta, glow: 8 });
    D.text(ctx, "TAIWAN CRISIS", 140, y0 - 16, { size: 20, weight: 600, tracking: 5, alpha: ta });
    for (let i = 0; i < 8; i++) D.stroke(ctx, [[220 + i * 160, y0 - 7], [220 + i * 160, y0 + 7]], { color: C.ice, width: 1.5, alpha: ta * 0.7 });
    const vx = 980;
    const sw = Math.sin(t * 1.3) * 0.08;
    D.stroke(ctx, [[vx, y0], [vx + Math.sin(sw) * 90, y0 + 90]], { color: C.ice, width: 1.5, alpha: ta });
    valve(ctx, vx + Math.sin(sw) * 130, y0 + 130, 34, { color: C.amber, alpha: prog(t, tTaiwan + 1, 0.6), spin: t * 0.3 });
    D.text(ctx, "ADJUNCT", vx + 60, y0 + 140, { size: 22, weight: 600, tracking: 6, color: C.amber, alpha: prog(t, tTaiwan + 1.6, 0.6) });
    D.text(ctx, "THE ENERGY VALVE", vx + 60, y0 + 164, { kind: "mono", size: 12, color: C.mid, alpha: prog(t, tTaiwan + 1.6, 0.6) });
    if (ext > 0) D.label(ctx, "→ LARGER FIGHTS ESCAPE THEIR AUTHORS", 1300, y0 - 16, { color: C.crimson, alpha: ext, size: 12 });
  };
}

// ================================================================ 12. the allies' bill and the second buyer
function s12(S) {
  const view = asiaWide(820, [[25, -15], [150, 55]]);
  view.setCam(K.camFor(view, [92, 24], 1, 960, 560));
  const tAllies = S.at(1);
  const tFork = S.at(2);
  const tHabit = S.at(3);
  const tBuyer = S.at(4);
  const tEp1 = S.at(5);
  return (ctx, t) => {
    D.bg(ctx, { gridAlpha: 0.2 });
    const al = prog(t, tAllies, 1);
    view.base(ctx, { colors: { [ID.japan]: rgba(C.cyan, 0.35 * al), [ID.skorea]: rgba(C.cyan, 0.35 * al), [ID.taiwan]: rgba(C.cyan, 0.25 * al), [ID.china]: rgba(C.crimson, 0.2) }, borderAlpha: 0.5 });
    // Gulf oil lanes to the allies through the same strait
    const lane = D.smoothPts(view.line([...LANES.gulfToMalacca, ...STRAIT.slice(4), ...TO_JAPAN]), 6);
    D.stroke(ctx, lane, { color: C.cyan, width: 2, alpha: 0.5 * al });
    // price + shipping-risk indices
    for (const [ll, lab, off] of [[[138, 37], "JAPAN", 0], [[128, 36.5], "KOREA", 0.4]]) {
      const p = view.xy(ll);
      const data = [];
      for (let i = 0; i <= 24; i++) data.push([i / 24, 0.15 + (i > 10 ? Math.pow((i - 10) / 14, 1.5) * 0.75 : 0) + 0.03 * Math.sin(i * 1.7)]);
      D.panel(ctx, p[0] + 30, p[1] - 150 + off * 200, 220, 110, { alpha: al, fill: rgba("#0b0e13", 0.9), color: C.cyan });
      D.text(ctx, `${lab} · OIL + SHIPPING RISK`, p[0] + 44, p[1] - 126 + off * 200, { kind: "mono", size: 10, color: C.cyan, alpha: al });
      D.series(ctx, p[0] + 44, p[1] - 116 + off * 200, 190, 66, data, { color: C.amber, width: 2, p: prog(t, tAllies + off, 3), alpha: al, glow: 6 });
    }
    // the Gulf producer's fork
    const g = view.xy([47, 25]);
    const fa = prog(t, tFork, 0.8);
    D.node(ctx, g[0], g[1], 9, C.ice, { alpha: fa, glow: 12 });
    D.stroke(ctx, [g, [g[0] - 140, g[1] + 130]], { color: C.ice, width: 2, alpha: fa, to: fa });
    D.stroke(ctx, [g, [g[0] + 140, g[1] + 130]], { color: C.ice, width: 2, alpha: fa, to: fa });
    D.label(ctx, "FORGO CHINESE DEMAND", g[0] - 140, g[1] + 156, { align: "center", color: C.ice, alpha: fa, size: 12 });
    D.label(ctx, "ACCEPT ENFORCEMENT", g[0] + 140, g[1] + 156, { align: "center", color: C.ice, alpha: fa, size: 12 });
    D.label(ctx, "OF THEIR CUSTOMER", g[0] + 140, g[1] + 174, { align: "center", color: C.ice, alpha: fa, size: 12 });
    D.label(ctx, "GULF PRODUCERS", g[0], g[1] - 22, { align: "center", color: C.ice, alpha: fa, size: 13, weight: 600 });
    K.chip(ctx, "THE UNIPOLAR HABIT ASSUMES THE ASKS WILL BE OBEYED", 960, 190, { color: C.mid, align: "center", alpha: fade(t, tHabit, 0.5, tBuyer + 3, 0.6), size: 13 });
    // the second buyer stays available
    const cb = view.xy([108, 33]);
    const ba = prog(t, tBuyer, 0.6);
    D.node(ctx, cb[0], cb[1], 16, C.crimson, { alpha: ba, glow: 26, pulseT: t });
    D.label(ctx, "SECOND BUYER", cb[0], cb[1] - 34, { align: "center", color: C.crimson, alpha: ba, size: 14, weight: 600 });
    // inset: episode 1's marginal-barrel contract, triggered by the siege
    const ea = prog(t, tEp1, 0.8);
    if (ea > 0) {
      const ix = 1300;
      const iy = 620;
      D.panel(ctx, ix, iy, 520, 330, { alpha: ea, title: "Replay · Episode 1 · the marginal barrel", fill: rgba("#0b0e13", 0.94), color: C.amber });
      const a = [ix + 70, iy + 230];
      const b = [ix + 440, iy + 130];
      D.icon.barrel(ctx, a[0], a[1], 40, C.ice, ea);
      D.thread(ctx, D.arcPts(a, b, 0.2, 40, -1), t, tEp1 + 0.6, 1.4, { color: C.amber, width: 5, particles: 6, speed: 0.2, glow: 16, alpha: ea });
      D.node(ctx, b[0], b[1], 9, C.crimson, { alpha: ea, glow: 16 });
      K.chip(ctx, "YUAN", (a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - 40, { color: C.amber, align: "center", alpha: prog(t, tEp1 + 1.6, 0.5), size: 15 });
      const share = 0.12 + 0.2 * prog(t, tEp1 + 1.5, Math.max(3, S.dur - tEp1 - 3), ease.out);
      D.text(ctx, "AMBER INVOICE SHARE · ILLUSTRATIVE", ix + 24, iy + 300, { kind: "mono", size: 12, color: C.mid, alpha: ea });
      D.text(ctx, `${(share * 100).toFixed(1)}%`, ix + 470, iy + 300, { kind: "mono", size: 18, weight: 600, color: C.amber, align: "right", alpha: ea });
      tri(ctx, ix + 488, iy + 293, 7, C.amber, ea);
      D.label(ctx, "TRIGGERED BY THE SIEGE", ix + 24, iy + 70, { color: C.amber, alpha: ea, size: 11 });
    }
  };
}

// ================================================================ 13. two numbers, two maps
function s13(S) {
  const mk = () => {
    const v = new MapView(geoMercator().scale(1300).translate([W / 2, H / 2]), { res: "50m", bbox: [[75, -12], [150, 52]] });
    return v;
  };
  const L = mk();
  const R = mk();
  L.setCam(K.camFor(L, [113, 17], 0.55, 500, 455));
  R.setCam(K.camFor(R, [113, 17], 0.55, 1420, 455));
  const tL = S.at(1);
  const tR = S.at(2);
  const tBeijing = S.at(3);
  const tWash = S.at(4);
  const panel = (ctx, view, x, title, sub, a, t, siege) => {
    D.panel(ctx, x, 180, 820, 720, { alpha: a, title, fill: rgba("#0b0e13", 0.9), color: siege ? C.crimson : C.border, titleColor: siege ? C.crimson : C.mid });
    ctx.save();
    ctx.globalAlpha = a;
    ctx.beginPath();
    ctx.rect(x + 2, 220, 816, 470);
    ctx.clip();
    view.base(ctx, { colors: { [ID.china]: rgba(C.crimson, siege ? 0.3 : 0.18) }, borderAlpha: 0.4 });
    // malacca closed
    const m = view.xy([100.6, 3.1]);
    D.stroke(ctx, [[m[0] - 12, m[1] - 12], [m[0] + 12, m[1] + 12]], { color: C.crimson, width: 4 });
    D.stroke(ctx, [[m[0] - 12, m[1] + 12], [m[0] + 12, m[1] - 12]], { color: C.crimson, width: 4 });
    // diverted hulls
    for (const r of [LANES.sundaRoute, LANES.lombokRoute]) D.stroke(ctx, D.smoothPts(view.line(r), 4), { color: siege ? C.steelDeep : "#ffe2b0", width: 1.5, dash: [5, 5], alpha: 0.8 });
    // pipelines maxed
    for (const k of ["myanmar", "espoDaqing"]) D.stroke(ctx, D.smoothPts(view.line(PIPES[k]), 4), { color: C.amber, width: 3, glow: 8 });
    // pacific crude
    const pac = D.smoothPts(view.line(LANES.kozminoToChina), 4);
    if (!siege) K.flow(ctx, pac, t, { color: "#ffe2b0", n: 6, speed: 0.2, size: 2.4 });
    D.stroke(ctx, pac, { color: siege ? C.crimson : "#ffe2b0", width: 2, alpha: siege ? 0.9 : 0.6, dash: siege ? [4, 4] : undefined });
    if (siege) {
      const k = view.xy([127, 33]);
      D.stroke(ctx, [[k[0] - 12, k[1] - 12], [k[0] + 12, k[1] + 12]], { color: C.crimson, width: 4 });
      D.stroke(ctx, [[k[0] - 12, k[1] + 12], [k[0] + 12, k[1] - 12]], { color: C.crimson, width: 4 });
    }
    ctx.restore();
    D.text(ctx, sub[0], x + 30, 740, { size: 30, weight: 600, tracking: 3, alpha: a, color: siege ? C.crimson : C.ice });
    D.text(ctx, sub[1], x + 30, 772, { kind: "mono", size: 13, color: C.mid, alpha: a });
    D.text(ctx, sub[2], x + 30, 796, { kind: "mono", size: 13, color: C.mid, alpha: a });
    // output line
    const data = [];
    for (let i = 0; i <= 30; i++) data.push([i / 30, siege ? 0.85 - 0.75 * ease.in(i / 30) : 0.85 - 0.18 * (i / 30)]);
    D.series(ctx, x + 520, 720, 260, 140, data, { color: siege ? C.crimson : C.amber, width: 2.5, p: prog(t, siege ? tR + 1 : tL + 1, 3), alpha: a, glow: 8 });
    D.label(ctx, "INDUSTRIAL OUTPUT", x + 520, 712, { color: C.mid, alpha: a, size: 10 });
  };
  return (ctx, t) => {
    D.bg(ctx, { gridAlpha: 0.2 });
    panel(ctx, L, 90, "Malacca-only closure", ["MONTHS", "STOCKS DRAW · HULLS DIVERT · PIPELINES ≈ 1.5 MB/D", "PACIFIC CRUDE STILL FLOWS"], prog(t, tL, 0.8), t, false);
    panel(ctx, R, 1010, "Southern + Pacific siege", ["REGIONAL WAR", "A SHARP INDUSTRIAL CONTRACTION", "NOT A STRAIT · A WAR"], prog(t, tR, 0.8), t, true);
    // Beijing's gambit
    D.stamp(ctx, "DISAPPOINTING", 500, 860, t, tBeijing, { color: C.steel, size: 28, angle: -0.05 });
    D.stamp(ctx, "ENORMOUS", 1420, 860, t, tBeijing + 1.2, { color: C.crimson, size: 28, angle: -0.05 });
    D.label(ctx, "BEIJING'S GAMBIT", 960, 160, { align: "center", color: C.crimson, alpha: fade(t, tBeijing, 0.5, tWash, 0.5), size: 13 });
    // Washington's threat bracket around both
    const wa = prog(t, tWash, 0.8);
    if (wa > 0) {
      const pad = lerp(60, 0, ease.out(wa));
      D.brackets(ctx, 70 - pad, 150 - pad, 1780 + pad * 2, 780 + pad * 2, { color: C.cyan, len: 46, lw: 4, alpha: wa });
      D.label(ctx, "WASHINGTON'S GAMBIT · THREATEN BOTH", 960, 960, { align: "center", color: C.cyan, alpha: wa, size: 14, weight: 600 });
    }
    K.chip(ctx, "BOTH SIDES BUILD FOR THE TEST ANYWAY", 960, 1010, { color: C.ice, align: "center", alpha: prog(t, S.at(5), 0.6), size: 14 });
  };
}

export default {
  title: "The Malacca Siege",
  subtitle: "The math behind China's chokepoint gambit",
  short: "The Malacca Siege",
  scenes: [s1, s2, s3, s4, s5, s6, s7, s8, s9, s10, s11, s12, s13],
};
