// EPISODE 5 — THE SEMICONDUCTOR FORTRESS
import { geoMercator, geoNaturalEarth1 } from "d3-geo";
import { C, W, H, clamp, lerp, ease, prog, fade, pulse, rgba, mix, rng } from "../engine/core.mjs";
import * as D from "../engine/draw.mjs";
import { MapView, P, ID } from "../engine/geo.mjs";
import * as K from "../engine/kit.mjs";

const WAFER = "#e9f1f8";

// Cleanroom: white light and a perspective grid floor, nothing proprietary.
function cleanroom(ctx, alpha, t = 0) {
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  const hz = 420;
  const g = ctx.createLinearGradient(0, 0, 0, hz + 40);
  g.addColorStop(0, "rgba(220,235,245,0.02)");
  g.addColorStop(1, "rgba(220,235,245,0.16)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, hz + 40);
  ctx.strokeStyle = "rgba(220,235,245,0.18)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = -24; i <= 24; i++) {
    ctx.moveTo(W / 2 + i * 12, hz);
    ctx.lineTo(W / 2 + i * 160, H);
  }
  const off = (t * 20) % 60;
  for (let k = 0; k < 14; k++) {
    const y = hz + Math.pow((k * 60 + off) / 840, 2) * (H - hz);
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
  }
  ctx.stroke();
  // overhead light panels
  for (let i = 0; i < 6; i++) {
    ctx.fillStyle = "rgba(240,248,255,0.07)";
    ctx.fillRect(160 + i * 280, 60 + (i % 2) * 14, 200, 12);
  }
  ctx.restore();
}

function fabIcon(ctx, x, y, s, o = {}) {
  const { color = WAFER, alpha = 1, running = 1, t = 0 } = o;
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.strokeStyle = color;
  ctx.fillStyle = rgba(color, 0.08);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x - s, y + s * 0.5);
  ctx.lineTo(x - s, y - s * 0.2);
  ctx.lineTo(x - s * 0.4, y - s * 0.5);
  ctx.lineTo(x + s * 0.2, y - s * 0.2);
  ctx.lineTo(x + s * 0.6, y - s * 0.45);
  ctx.lineTo(x + s, y - s * 0.2);
  ctx.lineTo(x + s, y + s * 0.5);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
  // wafer disc
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(x, y + s * 0.12, s * 0.26, 0, Math.PI * 2);
  ctx.stroke();
  if (running > 0) {
    ctx.globalAlpha *= running;
    ctx.translate(x, y + s * 0.12);
    ctx.rotate(t * 0.8);
    ctx.beginPath();
    for (let i = -2; i <= 2; i++) {
      ctx.moveTo(-s * 0.2, i * s * 0.07);
      ctx.lineTo(s * 0.2, i * s * 0.07);
      ctx.moveTo(i * s * 0.07, -s * 0.2);
      ctx.lineTo(i * s * 0.07, s * 0.2);
    }
    ctx.stroke();
  }
  ctx.restore();
}

function waferFlow(ctx, from, to, t, color, alpha = 1) {
  const pts = D.arcPts(from, to, 0.15, 30);
  D.stroke(ctx, pts, { color, width: 2, alpha: alpha * 0.6 });
  K.flow(ctx, pts, t, { color: WAFER, n: 5, speed: 0.2, size: 3, alpha });
}

function taiwanView(scale, cx, cy, res = "10m") {
  const v = new MapView(geoMercator().scale(scale).translate([W / 2, H / 2]), { res, bbox: [[112, 18], [132, 32]] });
  v.setCam(K.camFor(v, [120.9, 23.7], 1, cx, cy));
  return v;
}

// ================================================================ 1. the ranking that builds the fortress
function s1(S) {
  const tRank = 0.6;
  const tTitle = S.at(1);
  const tPeace = S.at(2);
  const tWar = S.at(3);
  const tDenial = S.at(4);
  return (ctx, t) => {
    D.bg(ctx, { grid: false, color: "#0b0e12" });
    cleanroom(ctx, 0.9 - 0.4 * prog(t, tRank, 2), t);
    // the two-cell ranking, identical for both capitals
    const ra = prog(t, tRank, 0.8);
    for (const [x, cap, col] of [[340, "WASHINGTON", C.cyan], [1000, "BEIJING", C.crimson]]) {
      D.panel(ctx, x, 140, 580, 300, { alpha: ra, fill: rgba("#0b0e13", 0.93), color: col, titleColor: col, title: `${cap} · preference` });
      D.text(ctx, "STOPPED FACTORY", x + 40, 250, { size: 28, weight: 600, tracking: 3, alpha: ra });
      D.text(ctx, "RANKED ABOVE", x + 40, 290, { kind: "mono", size: 13, color: C.green, alpha: ra });
      D.text(ctx, "INTACT FAB IN THE OTHER SIDE'S HANDS", x + 40, 360, { size: 24, weight: 600, tracking: 2, color: C.mid, alpha: ra, maxWidth: 450 });
      D.text(ctx, "WORST", x + 40, 400, { kind: "mono", size: 13, color: C.crimson, alpha: ra });
      D.arrow(ctx, [[x + 540, 390], [x + 540, 240]], { color: C.green, width: 2, head: 12, alpha: ra });
    }
    D.text(ctx, "THE FORTRESS", 960, 112, { size: 30, weight: 600, tracking: 14, align: "center", alpha: prog(t, tTitle, 0.6), glow: 10 });
    // peacetime: both ecosystems draw wafers under the leader's rules
    const fab = [960, 690];
    const war = prog(t, tWar, 0.6);
    const pa = prog(t, tPeace, 0.8);
    fabIcon(ctx, fab[0], fab[1], 70, { alpha: Math.max(pa, war), running: 1 - war * 0.6, t, color: mix(WAFER, C.crimson, war) });
    if (pa > 0) {
      waferFlow(ctx, [fab[0] - 60, fab[1]], [520, 760], t, C.cyan, pa * (1 - war));
      waferFlow(ctx, [fab[0] + 60, fab[1]], [1400, 760], t, C.crimson, pa * (1 - war));
      D.node(ctx, 520, 760, 18, C.cyan, { alpha: pa, glow: 16 });
      D.node(ctx, 1400, 760, 18, C.crimson, { alpha: pa, glow: 16 });
      D.label(ctx, "U.S.-LED ECOSYSTEM", 520, 808, { align: "center", color: C.cyan, alpha: pa, size: 12 });
      D.label(ctx, "CHINESE ECOSYSTEM", 1400, 808, { align: "center", color: C.crimson, alpha: pa, size: 12 });
      D.brackets(ctx, 440, 560, 1040, 280, { color: C.cyan, len: 24, alpha: pa * (1 - war) * 0.8 });
      D.label(ctx, "PEACETIME · RULES SET BY THE LEADER", 960, 548, { align: "center", color: C.cyan, alpha: pa * (1 - war), size: 13 });
    }
    // wartime: prize becomes denial target
    const prizeA = pa * (1 - war);
    D.text(ctx, "PRIZE", fab[0], fab[1] + 110, { size: 26, weight: 600, tracking: 10, align: "center", color: C.gold, alpha: prizeA });
    D.text(ctx, "DENIAL TARGET", fab[0], fab[1] + 110, { size: 26, weight: 600, tracking: 8, align: "center", color: C.crimson, alpha: war });
    D.label(ctx, "WAR · CONTROL MIGHT CHANGE", 960, 548, { align: "center", color: C.crimson, alpha: war, size: 13 });
    K.chip(ctx, "DENIAL WINS ONCE DETERRENCE FAILS", 960, 960, { color: C.ice, align: "center", alpha: prog(t, tDenial, 0.5), size: 15 });
  };
}

// ================================================================ 2. a global machine on contested real estate
function s2(S) {
  const tw = taiwanView(9000, 1420, 560);
  const tShare = S.at(1);
  const tChain = S.at(2);
  const tEstate = S.at(3);
  const tCap = S.at(4);
  const beads = [
    ["NETHERLANDS", "LITHOGRAPHY · EXTREME END", C.cyan],
    ["UNITED STATES", "DEPOSITION + ETCH", C.cyan],
    ["JAPAN", "MATERIALS + OPTICS", C.cyan],
  ];
  return (ctx, t) => {
    D.bg(ctx, { gridAlpha: 0.2 });
    // the island (inset map) with contested hatch
    const ia = prog(t, 0.3, 1);
    ctx.save();
    ctx.globalAlpha = ia;
    tw.base(ctx, { colors: { [ID.taiwan]: rgba(WAFER, 0.18), [ID.china]: rgba(C.crimson, 0.12) }, borderAlpha: 0.4 });
    ctx.restore();
    const ea = prog(t, tEstate, 0.8);
    if (ea > 0) {
      tw.withClip(ctx, tw.country(ID.taiwan), () => {
        ctx.save();
        ctx.globalAlpha = ea * 0.5;
        ctx.strokeStyle = C.amber;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let x = 900; x < W; x += 12) {
          ctx.moveTo(x, 0);
          ctx.lineTo(x - 500, H);
        }
        ctx.stroke();
        ctx.restore();
      });
      D.label(ctx, "CONTESTED POLITICAL REAL ESTATE", 1420, 900, { align: "center", color: C.amber, alpha: ea, size: 14 });
    }
    // the spine
    const spineY = 560;
    const isl = tw.xy([120.97, 24.8]);
    const sa = prog(t, tChain, 0.8);
    D.stroke(ctx, [[160, spineY], [isl[0] - 30, isl[1]]], { color: C.ice, width: 3, alpha: Math.max(0.25, sa), glow: 8 });
    beads.forEach(([n, sub, col], i) => {
      const a = prog(t, tChain + i * (S.e[2] - S.b[2]) * 0.3, 0.6);
      const x = 260 + i * 290;
      D.node(ctx, x, spineY, 20, col, { alpha: a, glow: 22 });
      D.label(ctx, n, x, spineY - 46, { align: "center", color: C.ice, alpha: a, size: 15, weight: 600 });
      D.label(ctx, sub, x, spineY + 52, { align: "center", color: C.cyan, alpha: a, size: 11 });
      D.label(ctx, "CHOKEPOINT", x, spineY + 72, { align: "center", color: C.dim, alpha: a, size: 10 });
    });
    D.label(ctx, "UPSTREAM · A NARROW CHAIN", 160, spineY - 110, { color: C.mid, alpha: sa, size: 12 });
    // one firm, one island, dominant share
    const fa = prog(t, S.at(1), 0.8);
    D.node(ctx, isl[0], isl[1], 16, WAFER, { alpha: Math.max(ia * 0.6, fa), glow: 24, pulseT: t });
    D.panel(ctx, 1150, 170, 560, 150, { alpha: fa, fill: rgba("#0b0e13", 0.93), title: "One firm · one island" });
    D.text(ctx, "LEADING-EDGE LOGIC", 1176, 240, { kind: "mono", size: 13, color: C.mid, alpha: fa });
    D.hbar(ctx, 1176, 256, 510, 22, WAFER, { p: 0.9 * prog(t, tShare + 1, 2, ease.out), alpha: fa });
    D.text(ctx, "DOMINANT SHARE", 1176, 302, { kind: "mono", size: 13, color: WAFER, alpha: prog(t, tShare + 2, 0.6) });
    // downstream dependence
    const da = prog(t, tShare + 4, 0.6);
    for (const [y, n] of [[700, "ADVANCED COMPUTING"], [780, "MODERN WEAPONS"]]) {
      D.arrow(ctx, [[isl[0] - 60, isl[1] + 40], [isl[0] - 300, y]], { color: C.ice, width: 1.5, head: 10, alpha: da });
      D.label(ctx, n, isl[0] - 310, y + 26, { align: "right", color: C.ice, alpha: da, size: 12 });
    }
    D.caption(ctx, "Whoever sets access sets a share of future capital stock", t, tCap, { y: 1000, size: 24 });
  };
}

// ================================================================ 3. three problems on one island
function s3(S) {
  const tw = taiwanView(7000, 620, 760);
  const tL1 = S.at(1);
  const tL2 = S.at(2);
  const tL3 = S.at(3);
  const tCapab = S.at(4);
  const tCompute = S.at(6);
  const tGap = S.at(7);
  const plate = (ctx, y, title, col, a) => {
    if (a <= 0) return;
    ctx.save();
    ctx.globalAlpha *= a;
    ctx.beginPath();
    ctx.moveTo(200, y);
    ctx.lineTo(900, y);
    ctx.lineTo(1000, y - 70);
    ctx.lineTo(300, y - 70);
    ctx.closePath();
    ctx.fillStyle = rgba(col, 0.14);
    ctx.fill();
    ctx.strokeStyle = col;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
    D.text(ctx, title, 320, y - 28, { size: 17, weight: 600, tracking: 2, alpha: a, color: C.ice, maxWidth: 640 });
  };
  return (ctx, t) => {
    D.bg(ctx, { gridAlpha: 0.2 });
    tw.base(ctx, { colors: { [ID.taiwan]: rgba(WAFER, 0.2), [ID.china]: rgba(C.crimson, 0.1) }, borderAlpha: 0.4 });
    D.label(ctx, "TAIWAN", ...tw.xy([121.6, 22.6]), { color: C.ice, size: 13 });
    const ys = [620, 500, 380];
    plate(ctx, ys[0], "1 · SEA POWER'S COMMITMENT TO AN ISLAND OFF A CONTINENTAL POWER", C.cyan, prog(t, tL1, 0.6));
    plate(ctx, ys[1], "2 · TECHNOLOGY MONOPOLY → MILITARY + ECONOMIC CAPABILITY", WAFER, prog(t, tL2, 0.6));
    plate(ctx, ys[2], "3 · POWER TRANSITION", C.amber, prog(t, tL3, 0.6));
    // stacking pillars down to the island
    const isl = tw.xy([120.97, 23.8]);
    D.stroke(ctx, [[620, ys[2] - 35], [isl[0], isl[1]]], { color: C.mid, width: 1, dash: [4, 6], alpha: prog(t, tL1, 0.6) });
    // layer 3: sealed intentions, open capabilities
    const ia = prog(t, tL3 + 2, 0.6);
    K.envelope(ctx, 1070, 250, 80, { alpha: ia, color: C.mid });
    K.envelope(ctx, 1170, 250, 80, { alpha: ia, color: C.mid });
    D.label(ctx, "INTENTIONS · SEALED", 1120, 310, { align: "center", color: C.mid, alpha: ia, size: 12 });
    const ba = prog(t, tCapab, 0.6);
    K.book(ctx, 1380, 250, 110, { alpha: ba, color: C.ice });
    D.label(ctx, "CAPABILITIES · OPEN", 1380, 310, { align: "center", color: C.ice, alpha: ba, size: 12 });
    K.chip(ctx, "PLANNED AGAINST", 1380, 360, { color: C.ice, align: "center", alpha: ba, size: 12 });
    // relative power scale gains a compute term
    const sa = prog(t, S.at(5) - 1, 0.6);
    D.panel(ctx, 1080, 430, 720, 420, { alpha: sa, title: "Relative power", fill: rgba("#0b0e13", 0.93) });
    const rows = [["MILITARY", 0.62, 0.55], ["ECONOMIC", 0.7, 0.66], ["COMPUTE", 0.86, 0.38]];
    rows.forEach(([n, a1, b1], i) => {
      const ra = i === 2 ? prog(t, tCompute, 0.6) : sa;
      const y = 520 + i * 100;
      D.text(ctx, n, 1110, y, { kind: "mono", size: 13, color: i === 2 ? WAFER : C.mid, alpha: ra });
      D.hbar(ctx, 1110, y + 12, 640, 18, C.cyan, { p: a1 * prog(t, (i === 2 ? tCompute : S.at(5)) + 0.3, 1.2), alpha: ra });
      D.hbar(ctx, 1110, y + 36, 640, 18, C.crimson, { p: b1 * prog(t, (i === 2 ? tCompute : S.at(5)) + 0.5, 1.2), alpha: ra });
    });
    D.label(ctx, "NEW TERM", 1750, 520 + 200, { align: "right", color: WAFER, alpha: prog(t, tCompute, 0.6), size: 11 });
    const ga = prog(t, tGap, 0.6);
    if (ga > 0) {
      const x0 = 1110 + 640 * 0.38;
      const x1 = 1110 + 640 * 0.86;
      D.stroke(ctx, [[x0, 790], [x1, 790]], { color: C.amber, width: 2, alpha: ga });
      D.stroke(ctx, [[x0, 780], [x0, 800]], { color: C.amber, width: 2, alpha: ga });
      D.stroke(ctx, [[x1, 780], [x1, 800]], { color: C.amber, width: 2, alpha: ga });
      K.chip(ctx, "PERMANENT COMPUTE GAP = STRATEGIC POSITION", (x0 + x1) / 2, 836, { color: C.amber, align: "center", alpha: ga, size: 12 });
    }
  };
}

// ================================================================ 4. a policy, not a law
function s4(S) {
  const tStack = S.at(1);
  const tCeil = S.at(1, 0.75);
  const tProg = S.at(2);
  const tLesson = S.at(3);
  const tAlt = S.at(5);
  const tPrice = S.at(6);
  return (ctx, t) => {
    D.bg(ctx, { gridAlpha: 0.2 });
    // the policy stack
    ["EXPORT CONTROLS · ADVANCED CHIPS", "EXPORT CONTROLS · CHIPMAKING TOOLS", "SUBSIDIES · PRODUCTION TO ALLIED SOIL"].forEach((n, i) => {
      const a = prog(t, tStack + i * (S.e[1] - S.b[1]) * 0.25, 0.5);
      K.boxNode(ctx, 360, 260 + i * 100, 480, 76, n, { color: C.cyan, alpha: a, fill: 0.12, titleSize: 17 });
    });
    D.label(ctx, "POLICY STACK", 120, 200, { color: C.cyan, alpha: prog(t, tStack, 0.5), size: 13, weight: 600 });
    // ceiling over the Chinese technology trajectory
    const ca = prog(t, tStack + 1, 0.6);
    const gx = 760;
    const gy = 200;
    const gw = 520;
    const gh = 280;
    D.axes(ctx, gx, gy, gw, gh, { alpha: ca });
    D.label(ctx, "CHINESE TECHNOLOGY TRAJECTORY", gx, gy - 14, { color: C.crimson, alpha: ca, size: 11 });
    const traj = Array.from({ length: 31 }, (_, i) => {
      const u = i / 30;
      return [u, Math.min(0.62 + 0.01 * Math.sin(u * 30), 0.1 + 0.9 * u)];
    });
    D.series(ctx, gx, gy, gw, gh, traj, { color: C.crimson, width: 3, p: prog(t, tStack + 1.2, 4), alpha: ca, glow: 8 });
    const cl = prog(t, tCeil, 0.8);
    D.stroke(ctx, [[gx, gy + gh - 0.64 * gh], [gx + gw, gy + gh - 0.64 * gh]], { color: C.cyan, width: 4, to: cl, glow: 14 });
    D.label(ctx, "CEILING", gx + gw, gy + gh - 0.64 * gh - 12, { align: "right", color: C.cyan, alpha: cl, size: 12, weight: 600 });
    // one growing program box
    const pa = prog(t, tProg, 0.6);
    const grow = 1 + 0.35 * prog(t, tProg, Math.max(5, S.dur - tProg), ease.linear);
    const pw = 360 * grow;
    const ph = 140 * grow;
    D.panel(ctx, 1560 - pw / 2, 340 - ph / 2, pw, ph, { alpha: pa, color: C.cyan, fill: rgba(C.cyan, 0.08), glow: 10 });
    D.text(ctx, "MILITARY-INDUSTRIAL COMPLEX", 1560, 330, { size: 17, weight: 600, tracking: 2, align: "center", alpha: pa });
    D.text(ctx, "+ CONTROL BUREAUCRACY", 1560, 356, { size: 17, weight: 600, tracking: 2, align: "center", alpha: pa });
    D.text(ctx, "ONE PROGRAM · PERMANENT RESTRICTION", 1560, 384, { kind: "mono", size: 11, align: "center", color: C.cyan, alpha: pa });
    // the lesson Beijing draws
    const la = prog(t, tLesson, 0.6);
    const bj = [1700, 640];
    D.node(ctx, bj[0], bj[1], 22, C.crimson, { alpha: la, glow: 22 });
    D.label(ctx, "BEIJING", bj[0], bj[1] + 50, { align: "center", color: C.crimson, alpha: la, size: 13, weight: 600 });
    D.arrow(ctx, [[gx + gw, gy + gh - 0.62 * gh], [bj[0] - 40, bj[1] - 20]], { color: C.ice, width: 2.5, head: 14, to: prog(t, tLesson + 0.5, 1), alpha: la });
    K.chip(ctx, "TIME INSIDE THE ORDER = FALLING BEHIND", 1000, 790, { color: C.ice, alpha: prog(t, S.at(4), 0.6), size: 14 });
    K.chip(ctx, "A RISKY CHANGE TO TAIWAN'S STATUS · ARGUED AS THE LESS RISKY PATH", 1000, 840, { color: C.mid, alpha: prog(t, S.at(4, 0.5), 0.6), size: 12 });
    // the alternative stays on the table
    const aa = prog(t, tAlt, 0.6);
    D.panel(ctx, 120, 600, 720, 200, { alpha: aa, title: "Sachs · multipolar alternative", color: C.violet, titleColor: C.violet, fill: rgba("#10161e", 0.96) });
    D.text(ctx, "COMMERCIAL ACCESS", 150, 690, { size: 30, weight: 600, tracking: 3, alpha: aa });
    D.text(ctx, "UNDER VERIFIED LIMITS ON MILITARY END USE", 150, 726, { kind: "mono", size: 14, color: C.mid, alpha: aa });
    K.chip(ctx, "ON THE TABLE · NOT SELECTED", 150, 776, { color: C.mid, alpha: prog(t, tAlt + 2, 0.5), size: 12 });
    // wreckage only as a priced option
    const wa = prog(t, tPrice, 0.6);
    D.panel(ctx, 120, 860, 720, 110, { alpha: wa, fill: rgba("#0b0e13", 0.93), color: C.crimson });
    D.text(ctx, "OPTION · WRECKAGE", 150, 908, { size: 22, weight: 600, tracking: 4, alpha: wa, color: C.crimson });
    D.text(ctx, "PRICED, NOT PROCEDURAL", 150, 942, { kind: "mono", size: 13, color: C.mid, alpha: wa });
    D.text(ctx, "PRICE: ?", 800, 924, { kind: "mono", size: 22, align: "right", color: C.crimson, alpha: wa });
    D.label(ctx, "WHAT A SYSTEM OF MANAGED DECLINE TEACHES THE RISING STATE", 900, 924, { color: C.mid, alpha: wa, size: 11 });
  };
}

// ================================================================ 5. four outcomes
function s5(S) {
  const cells = [
    { n: "1", title: "CONSTRAINED STATUS QUO", sub: ["ISLAND FABRICATES · U.S. TOOL CONTROL", "CHINA GETS WHAT THE RULES ALLOW"], tag: "FAVORS WASHINGTON · WHILE BEIJING TOLERATES THE LONG RUN", col: C.cyan, t0: S.at(1), x: 140, y: 170 },
    { n: "2", title: "CAPTURE WITH OPERATION", sub: ["WORKFORCE STAYS · YIELDS RECOVER", "COMPUTE POSITION SHIFTS HARD"], tag: "WORST CELL FOR WASHINGTON", col: C.crimson, t0: S.at(4), x: 980, y: 170 },
    { n: "3", title: "DENIAL", sub: ["NO FRONTIER OUTPUT · WHOEVER HOLDS THE BUILDINGS", "BOTH LOSE THE TAIWANESE FLOW"], tag: "RELATIVE LOSER = WEAKER SUBSTITUTE", col: C.steel, t0: S.at(7), x: 140, y: 590 },
    { n: "4", title: "NATIONALIZATION WITHOUT CAPABILITY", sub: ["THE FLAG CHANGES", "THE YIELDS DO NOT RETURN"], tag: "PULLED TOWARD DENIAL", col: C.steel, t0: S.at(11), x: 980, y: 590 },
  ];
  return (ctx, t) => {
    D.bg(ctx, { gridAlpha: 0.2 });
    D.label(ctx, "JIANG · FOUR OUTCOMES · THE FORTRESS IS THE ORDERING AMONG THEM", 960, 140, { align: "center", color: C.green, alpha: prog(t, 0.3, 0.6), size: 13 });
    cells.forEach((c, i) => {
      const a = prog(t, c.t0, 0.6);
      D.panel(ctx, c.x, c.y, 800, 380, { alpha: a, color: c.col, fill: rgba(c.col, i === 1 ? 0.1 : 0.05), lw: 1.6 });
      D.text(ctx, c.n, c.x + 30, c.y + 80, { size: 64, weight: 300, color: c.col, alpha: a });
      D.text(ctx, c.title, c.x + 100, c.y + 66, { size: 26, weight: 600, tracking: 3, alpha: a, maxWidth: 660 });
      c.sub.forEach((l, k) => D.text(ctx, l, c.x + 100, c.y + 110 + k * 26, { kind: "mono", size: 13, color: C.mid, alpha: prog(t, c.t0 + 1 + k * 1.2, 0.5) }));
      const tagT = i === 0 ? S.at(3) : i === 1 ? S.at(6) : i === 2 ? S.at(10) : S.at(12);
      K.chip(ctx, c.tag, c.x + 100, c.y + 340, { color: c.col, alpha: prog(t, tagT, 0.5), size: 13 });
      // cell glyph
      const gx = c.x + 640;
      const gy = c.y + 210;
      if (i === 0) {
        fabIcon(ctx, gx, gy, 60, { alpha: a, running: 1, t, color: WAFER });
        D.brackets(ctx, gx - 90, gy - 70, 180, 140, { color: C.cyan, len: 16, alpha: a });
      } else if (i === 1) {
        fabIcon(ctx, gx, gy, 60, { alpha: a, running: 1, t, color: C.crimson });
        D.icon.person(ctx, gx - 100, gy + 10, 40, C.crimson, prog(t, c.t0 + 1, 0.5));
      } else if (i === 2) {
        fabIcon(ctx, gx, gy, 60, { alpha: a, running: 0, t, color: C.steel });
        D.text(ctx, "NO OUTPUT", gx, gy + 70, { kind: "mono", size: 12, color: C.steel, align: "center", alpha: a });
      } else {
        fabIcon(ctx, gx, gy, 60, { alpha: a, running: 0, t, color: C.steel });
        D.stroke(ctx, [[gx - 70, gy + 70], [gx + 70, gy + 70]], { color: C.steel, width: 2, alpha: a });
        D.label(ctx, "YIELD", gx - 70, gy + 90, { color: C.dim, alpha: a, size: 10 });
        // pulled toward cell 3
        const pull = prog(t, S.at(12), 1.2);
        D.arrow(ctx, [[c.x + 20, c.y + 190], [c.x - 60, c.y + 190]], { color: C.steel, width: 4, head: 18, to: pull, alpha: pull });
      }
    });
  };
}

// ================================================================ 6. the substitutes decide
function s6(S) {
  const subs = [["U.S. SOUTHWEST", 0.12], ["JAPAN", 0.07], ["EUROPE", 0.05], ["KOREA · LEADING EDGE", 0.14]];
  const tWest = S.at(1);
  const tNot = S.at(2);
  const tChina = S.at(3);
  const tExpire = S.at(4);
  const tTrail = S.at(5);
  const tDelta = S.at(6);
  const tBest = S.at(7);
  return (ctx, t) => {
    D.bg(ctx, { gridAlpha: 0.2 });
    // western substitutes vs the island
    const wa = prog(t, tWest - 0.5, 0.6);
    D.panel(ctx, 120, 150, 820, 430, { alpha: wa, title: "Allied substitutes · fraction of future demand", fill: rgba("#0b0e13", 0.93) });
    let acc = 0;
    subs.forEach(([n, v], i) => {
      const a = prog(t, tWest + i * 1.6, 0.5);
      const y = 230 + i * 62;
      D.text(ctx, n, 150, y, { kind: "mono", size: 13, color: C.mid, alpha: a });
      D.hbar(ctx, 150, y + 10, 740, 20, C.cyan, { p: v * prog(t, tWest + i * 1.6 + 0.3, 1.5), alpha: a });
      D.text(ctx, "DELAY · YEARS", 150 + 740 * v + 16, y + 26, { kind: "mono", size: 11, color: C.dim, alpha: a });
      acc += v;
    });
    const ia = prog(t, tNot, 0.6);
    D.stroke(ctx, [[150 + 740 * 0.9, 210], [150 + 740 * 0.9, 480]], { color: WAFER, width: 2, dash: [6, 6], alpha: ia });
    D.label(ctx, "ISLAND VOLUME + PACE", 150 + 740 * 0.9, 500, { align: "center", color: WAFER, alpha: ia, size: 11 });
    D.hbar(ctx, 150, 530, 740, 14, C.cyan, { p: acc * prog(t, tNot + 0.4, 1.2), alpha: ia });
    D.label(ctx, "SUM · STILL SHORT", 150, 520, { color: C.cyan, alpha: ia, size: 11 });
    // Chinese side: trailing nodes, expiring stockpile
    const ca = prog(t, tChina, 0.6);
    D.panel(ctx, 980, 150, 820, 430, { alpha: ca, title: "Chinese substitutes", fill: rgba("#0b0e13", 0.93), color: C.crimson, titleColor: C.crimson });
    const nodes = ["FRONTIER", "", "", "TRAILING"];
    D.label(ctx, "PROCESS GENERATION →", 1010, 230, { color: C.dim, alpha: ca, size: 11 });
    for (let k = 0; k < 6; k++) {
      const x = 1030 + k * 120;
      D.stroke(ctx, [[x, 250], [x, 270]], { color: C.mid, width: 1, alpha: ca });
    }
    D.label(ctx, nodes[0], 1630, 290, { color: WAFER, alpha: ca, size: 11 });
    const tp = prog(t, tChina + 1, 3, ease.out);
    D.hbar(ctx, 1030, 300, 600, 22, C.amber, { p: lerp(0.3, 0.72, tp), alpha: ca, track: false });
    D.label(ctx, "DOMESTIC FOUNDRIES · OLDER TECHNIQUES, NEWER CHIPS", 1030, 352, { color: C.amber, alpha: ca, size: 11 });
    const gapA = prog(t, tTrail, 0.6);
    D.stroke(ctx, [[1030 + 600 * 0.72, 311], [1630, 311]], { color: C.crimson, width: 2, dash: [3, 5], alpha: gapA });
    D.label(ctx, "TRAILING NODES DO NOT REACH THE EDGE", 1770, 384, { align: "right", color: C.crimson, alpha: gapA, size: 11 });
    // stockpile expiring
    const sa = prog(t, tChina + 2, 0.6);
    const left = 1 - prog(t, tExpire, Math.max(4, S.dur - tExpire - 4), ease.linear) * 0.85;
    D.text(ctx, "IMPORTED STOCKPILE", 1010, 420, { kind: "mono", size: 13, color: C.mid, alpha: sa });
    D.hbar(ctx, 1010, 432, 760, 22, C.steel, { p: left, alpha: sa });
    D.label(ctx, "EXPIRES", 1770, 480, { align: "right", color: C.crimson, alpha: prog(t, tExpire, 0.5), size: 12 });
    // relative-power delta
    const da = prog(t, tDelta, 0.6);
    D.panel(ctx, 120, 640, 820, 330, { alpha: da, title: "Washington's relative-power loss", fill: rgba("#0b0e13", 0.93) });
    D.text(ctx, "UNDER DENIAL", 150, 730, { kind: "mono", size: 13, color: C.mid, alpha: da });
    D.hbar(ctx, 150, 742, 740, 26, C.steel, { p: 0.32 * prog(t, tDelta + 0.4, 1.2), alpha: da });
    D.text(ctx, "UNDER CAPTURE", 150, 820, { kind: "mono", size: 13, color: C.mid, alpha: da });
    D.hbar(ctx, 150, 832, 740, 26, C.crimson, { p: 0.85 * prog(t, tDelta + 0.8, 1.2), alpha: da });
    D.label(ctx, "DENIAL CONTEMPLATED MORE CALMLY THAN CAPTURE", 150, 930, { color: C.ice, alpha: prog(t, tBest, 0.5), size: 12 });
    // Beijing's best cell needs a living workforce
    const ba = prog(t, tBest, 0.6);
    D.panel(ctx, 980, 640, 820, 330, { alpha: ba, title: "Beijing's best cell", fill: rgba("#0b0e13", 0.93), color: C.crimson, titleColor: C.crimson });
    const present = Math.floor((t - tBest) / 2.4) % 2 === 0;
    const cellPulse = present ? 0.5 + 0.5 * Math.sin(t * 5) : 0;
    D.panel(ctx, 1040, 720, 300, 200, { alpha: ba, color: C.crimson, fill: rgba(C.crimson, 0.08 + 0.25 * cellPulse), glow: 20 * cellPulse });
    D.text(ctx, "CAPTURE WITH OPERATION", 1190, 830, { size: 15, weight: 600, align: "center", alpha: ba });
    for (let i = 0; i < 5; i++) D.icon.person(ctx, 1440 + i * 60, 820, 40, present ? C.ice : rgba(C.mid, 0.25), ba);
    D.label(ctx, present ? "WORKFORCE PRESENT" : "WORKFORCE GONE", 1560, 900, { align: "center", color: present ? C.ice : C.dim, alpha: ba, size: 12 });
  };
}

// ================================================================ 7. buying denial at a higher price
function s7(S) {
  const tTree = S.at(1);
  const tLocks = S.at(2);
  const tCard = S.at(5);
  const tHold = S.at(6);
  const tNobody = S.at(7);
  const locks = [["MAINTENANCE DEPENDENCE", S.at(2)], ["SEVERED FOREIGN TOOL CHAIN", S.at(3)], ["SCATTERED PROCESS KNOWLEDGE", S.at(4)]];
  return (ctx, t) => {
    D.bg(ctx, { gridAlpha: 0.2 });
    // probability tree
    const ta = prog(t, tTree, 0.6);
    const root = [260, 330];
    const up = [820, 210];
    const dn = [820, 450];
    D.node(ctx, root[0], root[1], 16, C.ice, { alpha: ta, glow: 14 });
    D.para(ctx, "VIOLENT CHANGE OF CONTROL", root[0] - 130, root[1] + 50, 260, { size: 17, weight: 600, tracking: 2, alpha: ta, lineHeight: 1.2 });
    D.stroke(ctx, D.arcPts(root, up, 0.1, 30), { color: C.mid, width: 1.5, alpha: ta, to: prog(t, tTree + 0.5, 1) });
    D.stroke(ctx, D.arcPts(root, dn, -0.1, 30), { color: C.crimson, width: 7, alpha: ta, to: prog(t, tTree + 0.5, 1), glow: 10 });
    D.text(ctx, "PLANT STILL OPERATES", up[0] + 30, up[1] + 6, { size: 18, weight: 600, tracking: 2, alpha: ta, color: C.mid });
    D.text(ctx, "LOW P", up[0] + 30, up[1] + 30, { kind: "mono", size: 13, color: C.mid, alpha: ta });
    D.text(ctx, "PLANT DOES NOT OPERATE", dn[0] + 30, dn[1] + 6, { size: 18, weight: 600, tracking: 2, alpha: ta, color: C.crimson });
    D.text(ctx, "HIGH P", dn[0] + 30, dn[1] + 30, { kind: "mono", size: 13, color: C.crimson, alpha: ta });
    K.chip(ctx, "GRABBING THE PLANT = BUYING DENIAL AT A HIGHER PRICE", 1380, 330, { color: C.ice, align: "center", alpha: prog(t, tTree + 3, 0.6), size: 14 });
    // three locks, not instructions
    locks.forEach(([n, t0], i) => {
      const a = prog(t, t0, 0.6);
      const x = 300 + i * 440;
      D.icon.lock(ctx, x, 640, 60, C.ice, a);
      D.label(ctx, n, x, 720, { align: "center", color: C.ice, alpha: a, size: 13, weight: 600 });
    });
    D.label(ctx, "THREE LOCKS · NOT INSTRUCTIONS", 120, 580, { color: C.mid, alpha: prog(t, tLocks, 0.6), size: 12 });
    // cleanroom fragility as one property card
    const ca = prog(t, tCard, 0.6);
    D.panel(ctx, 1360, 560, 440, 190, { alpha: ca, title: "Property card · cleanroom", fill: rgba("#0b0e13", 0.94) });
    D.text(ctx, "A PROMISE ABOUT", 1390, 650, { size: 22, weight: 600, tracking: 3, alpha: ca });
    D.text(ctx, "AIR AND VIBRATION", 1390, 684, { size: 22, weight: 600, tracking: 3, alpha: ca, color: WAFER });
    D.text(ctx, "WAR BREAKS IT", 1390, 724, { kind: "mono", size: 13, color: C.crimson, alpha: prog(t, tCard + 2, 0.5) });
    // what must be held, else outcome four
    const ha = prog(t, tHold, 0.6);
    ["STAFF", "SPARES", "POWER", "WATER"].forEach((n, i) => K.chip(ctx, n, 260 + i * 150, 840, { color: C.steel, alpha: prog(t, tHold + i * 0.5, 0.4), size: 15 }));
    D.text(ctx, "HELD FOR A LONG TIME — OR OUTCOME FOUR", 860, 840, { kind: "mono", size: 15, color: C.mid, alpha: ha });
    const na = prog(t, tNobody, 0.6);
    D.text(ctx, "NOBODY GETS A WORKING PLANT", 960, 970, { size: 40, weight: 600, tracking: 8, align: "center", alpha: na, glow: 8 });
  };
}

// ================================================================ 8. the prepared menu
function s8(S) {
  const tCards = 0.3;
  const tProb = S.at(2);
  const tHubris = S.at(3);
  const tSlope = S.at(4);
  const tCorr = S.at(5);
  const tSlide = S.at(6);
  return (ctx, t) => {
    D.bg(ctx, { gridAlpha: 0.2 });
    // identical cards
    [[120, "WASHINGTON", C.cyan], [600, "BEIJING", C.crimson]].forEach(([x, cap, col], i) => {
      const a = prog(t, tCards + i * 0.4, 0.6);
      D.panel(ctx, x, 150, 440, 230, { alpha: a, title: cap, color: col, titleColor: col, fill: rgba("#0b0e13", 0.93) });
      D.text(ctx, "MORE DANGEROUS", x + 30, 230, { kind: "mono", size: 12, color: C.crimson, alpha: a });
      D.text(ctx, "EXCLUSIVE RIVAL CONTROL", x + 30, 262, { size: 22, weight: 600, tracking: 2, alpha: a });
      D.text(ctx, "LESS DANGEROUS", x + 30, 310, { kind: "mono", size: 12, color: C.green, alpha: a });
      D.text(ctx, "SHARED LOSS", x + 30, 342, { size: 22, weight: 600, tracking: 2, alpha: a, color: C.mid });
    });
    D.label(ctx, "IDENTICAL CARD", 600, 410, { align: "center", color: C.mid, alpha: prog(t, tCards + 1, 0.5), size: 12 });
    // p(capture) > 0 forces the menu
    const pa = prog(t, tProb, 0.6);
    D.panel(ctx, 1120, 150, 680, 230, { alpha: pa, fill: rgba("#0b0e13", 0.93), title: "Unknowable intentions" });
    D.text(ctx, "P(CAPTURE) > 0", 1150, 250, { kind: "mono", size: 34, weight: 600, alpha: pa });
    D.text(ctx, "→ PREPARE THE MENU THAT MAKES CAPTURE WORTHLESS", 1150, 300, { kind: "mono", size: 14, color: C.mid, alpha: prog(t, tProb + 1.5, 0.6) });
    D.stamp(ctx, "HUBRIS", 1640, 340, t, tHubris, { color: C.violet, size: 30, angle: -0.08 });
    // yearly tightening → return to waiting
    const sa = prog(t, tSlope, 0.6);
    const gx = 120;
    const gy = 480;
    const gw = 760;
    const gh = 260;
    D.axes(ctx, gx, gy, gw, gh, { alpha: sa });
    const steps = [];
    for (let k = 0; k <= 6; k++) {
      steps.push([k / 6, 0.85 - k * 0.12]);
      if (k < 6) steps.push([(k + 1) / 6, 0.85 - k * 0.12]);
    }
    D.series(ctx, gx, gy, gw, gh, steps, { color: C.amber, width: 3, p: prog(t, tSlope + 0.3, 3.5, ease.linear), alpha: sa, glow: 8, dot: false });
    D.label(ctx, "RETURN TO WAITING", gx + gw, gy + gh - 0.15 * gh + 22, { align: "right", color: C.amber, alpha: sa, size: 12, weight: 600 });
    D.label(ctx, "CONTROLS TIGHTENED EVERY YEAR →", gx, gy + gh + 30, { color: C.dim, alpha: sa, size: 11 });
    // the corridor back to outcome one
    const ca = prog(t, tCorr, 0.6);
    const mx = 1120;
    const my = 470;
    const cw = 330;
    const ch = 240;
    const cells = [["1", C.cyan], ["2", C.crimson], ["3", C.steel], ["4", C.steel]];
    cells.forEach(([n, col], i) => {
      const x = mx + (i % 2) * (cw + 20);
      const y = my + Math.floor(i / 2) * (ch + 20);
      D.panel(ctx, x, y, cw, ch, { alpha: ca, color: col, fill: rgba(col, 0.06) });
      D.text(ctx, `OUTCOME ${n}`, x + 20, y + 40, { kind: "mono", size: 14, color: col, alpha: ca });
    });
    const removed = prog(t, tSlide, 0.8);
    const corr = [[mx - 120, my + 120], [mx - 40, my + 120], [mx + 160, my + 120]];
    D.stroke(ctx, corr, { color: C.violet, width: 26, alpha: ca * 0.25 * (1 - removed), cap: "butt" });
    D.label(ctx, "ACCESS WITH VERIFICATION", mx - 120, my + 80, { color: C.violet, alpha: ca * (1 - removed), size: 12 });
    // the token
    const slide = prog(t, tSlide + 0.6, 3, ease.inOut);
    const tok = removed > 0 ? D.pointAt([[mx + 160, my + 120], [mx + 165, my + ch + 20 + 60], [mx + 160, my + ch + 20 + 120]], slide) : { x: mx + 160, y: my + 120 };
    D.node(ctx, tok.x, tok.y, 16, C.ice, { alpha: ca, glow: 18 });
    if (removed > 0) K.chip(ctx, "TOWARD THE CELLS WHERE THE FABS DIE", mx + cw + 10, my + 2 * ch + 70, { color: C.crimson, align: "center", alpha: prog(t, tSlide + 2, 0.6), size: 13 });
  };
}

// ================================================================ 9. the dangerous middle
function s9(S) {
  const tTracks = 0.3;
  const tShave = S.at(1);
  const tNeither = S.at(2);
  const tUS = S.at(4);
  const tCN = S.at(5);
  const tMid = S.at(6);
  return (ctx, t) => {
    D.bg(ctx, { gridAlpha: 0.2 });
    const x0 = 220;
    const x1 = 1700;
    const minX = 1060;
    const islandX = 1640;
    const nowU = 0.4;
    const ta = prog(t, tTracks, 0.8);
    // finish lines
    D.stroke(ctx, [[minX, 230], [minX, 640]], { color: C.green, width: 2, dash: [6, 6], alpha: ta });
    D.label(ctx, "MILITARY MINIMUM", minX, 214, { align: "center", color: C.green, alpha: ta, size: 12 });
    D.stroke(ctx, [[islandX, 230], [islandX, 640]], { color: WAFER, width: 2, dash: [3, 7], alpha: ta * 0.6 });
    D.label(ctx, "MATCH THE ISLAND", islandX, 214, { align: "center", color: WAFER, alpha: ta * 0.6, size: 12 });
    K.chip(ctx, "NEITHER HAS TO MATCH THE ISLAND · ONLY MOVE THE RANKING", 960, 700, { color: C.ice, align: "center", alpha: prog(t, tNeither, 0.6), size: 13 });
    const lanes = [
      ["U.S. ONSHORE FABS", C.cyan, 330, tUS],
      ["CHINESE DOMESTIC TOOLS", C.crimson, 520, tCN],
    ];
    lanes.forEach(([n, col, y, tIf]) => {
      D.stroke(ctx, [[x0, y], [x1, y]], { color: C.faint, width: 30, alpha: ta, cap: "butt" });
      D.text(ctx, n, x0, y - 30, { kind: "mono", size: 14, color: col, alpha: ta });
      // actual progress: shaving the pain of a stoppage, still short of the minimum
      const pos = K.track(t, [[tTracks, 0.12], [tShave, 0.2], [tMid, nowU]], ease.inOut);
      const px = lerp(x0, x1, pos);
      D.stroke(ctx, [[x0, y], [px, y]], { color: col, width: 6, alpha: ta, glow: 12 });
      D.node(ctx, px, y, 14, col, { alpha: ta, glow: 18 });
      // the belief that substitutes cover the military minimum (a ghost marker)
      const g = fade(t, tIf, 0.6, tMid, 0.8);
      if (g > 0) {
        const gx = lerp(px, lerp(x0, x1, (minX - x0) / (x1 - x0)), prog(t, tIf, 1.4));
        D.stroke(ctx, [[px, y], [gx, y]], { color: col, width: 2, dash: [5, 5], alpha: g });
        D.node(ctx, gx, y, 14, col, { alpha: g, glow: 6, fill: false, ring: true });
        D.label(ctx, "IF BELIEVED", gx, y + 40, { align: "center", color: col, alpha: g, size: 11 });
      }
    });
    // reclassification of denial
    const ua = fade(t, tUS + 1.2, 0.6, tMid, 0.8);
    D.text(ctx, "DENIAL, FOR WASHINGTON", 1180, 400, { kind: "mono", size: 13, color: C.mid, alpha: ua });
    D.text(ctx, "NATIONAL WOUND", 1180, 430, { size: 20, weight: 600, tracking: 3, color: C.crimson, alpha: ua * (1 - prog(t, tUS + 2.4, 0.5)) });
    D.text(ctx, "TOLERABLE EMERGENCY", 1180, 430, { size: 20, weight: 600, tracking: 3, color: C.cyan, alpha: ua * prog(t, tUS + 2.4, 0.5) });
    const ca = fade(t, tCN + 1, 0.6, tMid, 0.8);
    D.text(ctx, "DETERRENT VALUE OF DENIAL ↓ · VALUE OF CAPTURE ↓", 1180, 610, { kind: "mono", size: 13, color: C.crimson, alpha: ca });
    // the dangerous middle (now)
    const ma = prog(t, tMid, 0.6);
    const nowX = lerp(x0, x1, nowU);
    D.stroke(ctx, [[nowX, 250], [nowX, 620]], { color: C.amber, width: 3, alpha: ma, glow: 14 });
    D.panel(ctx, nowX - 260, 780, 520, 150, { alpha: ma, color: C.amber, fill: rgba(C.amber, 0.06) });
    D.text(ctx, "THE DANGEROUS MIDDLE", nowX, 845, { size: 28, weight: 600, tracking: 5, align: "center", alpha: ma, color: C.amber });
    D.text(ctx, "A UNIQUE PRIZE · INCOMPLETE SUBSTITUTES", nowX, 885, { kind: "mono", size: 13, align: "center", alpha: ma, color: C.mid });
    D.label(ctx, "NOW", nowX, 240, { align: "center", color: C.amber, alpha: ma, size: 13, weight: 600 });
  };
}

// ================================================================ 10. three options, coarse by design
function s10(S) {
  const opts = [
    ["01", "DETERRENCE", "MAKE A FIGHT LOOK UNPAYABLE · STAY IN OUTCOME ONE", "BOTH", C.cyan, S.at(1)],
    ["02", "SEEK CONTROL", "ATTEMPT TO RUN WHAT IS CAPTURED · FAILS IF THE PEOPLE AND THE TOOL CHAIN ARE GONE", "MAINLY BEIJING", C.crimson, S.at(2)],
    ["03", "WORKING TRANSFER = UNACCEPTABLE", "PLAN FOR YEARS OF INTERRUPTED FRONTIER OUTPUT", "BOTH", C.steel, S.at(3)],
  ];
  const cats = ["EVACUATION OF SPECIALIZED LABOR", "LEGAL BLOCKS ON SERVICING THE MACHINES", "ORDINARY FRAGILITY OF THE PLANTS UNDER FIRE"];
  const tCats = S.at(4);
  const tNot = S.at(5);
  const tWhy = S.at(6);
  return (ctx, t) => {
    D.bg(ctx, { gridAlpha: 0.2 });
    D.label(ctx, "THE STRATEGIC MENU · COARSER THAN AN ENGINEERING CHECKLIST", 120, 150, { color: C.mid, alpha: prog(t, 0.3, 0.6), size: 13 });
    opts.forEach(([n, title, sub, who, col, t0], i) => {
      const a = prog(t, t0, 0.6);
      const x = 120 + i * 570;
      D.panel(ctx, x, 190, 540, 380, { alpha: a, color: col, fill: rgba(col, 0.05) });
      D.text(ctx, n, x + 30, 270, { size: 54, weight: 300, color: col, alpha: a });
      D.para(ctx, title, x + 30, 330, 480, { size: 26, weight: 600, tracking: 2, alpha: a, lineHeight: 1.2 });
      D.para(ctx, sub, x + 30, 430, 480, { kind: "mono", size: 13, color: C.mid, alpha: a, caps: true, lineHeight: 1.5 });
      K.chip(ctx, who, x + 30, 540, { color: col, alpha: a, size: 12 });
    });
    // categories only, as labelled chips under option three
    cats.forEach((c, i) => K.chip(ctx, c, 1260, 640 + i * 52, { color: C.steel, alpha: prog(t, tCats + i * (S.e[4] - S.b[4]) * 0.3, 0.5), size: 13 }));
    D.label(ctx, "CATEGORIES OF STATE CHOICE", 1260, 600, { color: C.mid, alpha: prog(t, tCats, 0.5), size: 12 });
    // the hard caption
    const na = prog(t, tNot, 0.3, ease.out);
    if (na > 0) {
      D.panel(ctx, 120, 820, 1060, 120, { alpha: na, color: C.crimson, fill: rgba(C.crimson, 0.08), lw: 2 });
      D.text(ctx, "NOT A SEQUENCE OF INSTRUCTIONS", 650, 896, { size: 40, weight: 700, tracking: 8, align: "center", color: C.crimson, alpha: na });
    }
    K.chip(ctx, "WHY OUTCOME THREE IS PLAUSIBLE EVEN TO PLANNERS WHO PREFER OUTCOME ONE", 120, 1000, { color: C.mid, alpha: prog(t, tWhy, 0.6), size: 13 });
  };
}

// ================================================================ 11. the narrowing window
function s11(S) {
  const tCurve = 0.3;
  const tPrize = S.at(1);
  const tWindow = S.at(2);
  const tM = S.at(3);
  const tS = S.at(4);
  const tJ = S.at(5);
  return (ctx, t) => {
    D.bg(ctx, { gridAlpha: 0.2 });
    // AI demand curve steepens
    const ca = prog(t, tCurve, 0.6);
    const gx = 120;
    const gy = 170;
    const gw = 700;
    const gh = 300;
    D.axes(ctx, gx, gy, gw, gh, { alpha: ca });
    D.label(ctx, "AI DEMAND · LEADING-EDGE WAFERS", gx, gy - 14, { color: WAFER, alpha: ca, size: 12 });
    const steep = prog(t, tPrize, 4);
    const data = Array.from({ length: 41 }, (_, i) => {
      const u = i / 40;
      return [u, 0.08 + 0.85 * Math.pow(u, lerp(2.2, 3.6, steep)) * lerp(0.7, 1, steep) + 0.1 * u];
    });
    D.series(ctx, gx, gy, gw, gh, data, { color: WAFER, width: 3, p: prog(t, tCurve + 0.3, 3), alpha: ca, glow: 10, fillAlpha: 0.12 });
    // incentives rise together
    const ia = prog(t, tPrize + 1, 0.6);
    const lvl = prog(t, tPrize + 1.5, 5, ease.inOut);
    D.panel(ctx, 900, 150, 420, 340, { alpha: ia, title: "Incentives", fill: rgba("#0b0e13", 0.93) });
    D.bar(ctx, 960, 450, 120, lerp(80, 230, lvl), C.crimson, { alpha: ia, glow: 10 });
    D.bar(ctx, 1140, 450, 120, lerp(80, 230, lvl), C.steel, { alpha: ia, glow: 10 });
    D.label(ctx, "TO CAPTURE", 1020, 476, { align: "center", color: C.crimson, alpha: ia, size: 11 });
    D.label(ctx, "TO DENY", 1200, 476, { align: "center", color: C.steel, alpha: ia, size: 11 });
    // the window narrows
    const wa = prog(t, tWindow, 0.6);
    const close = prog(t, tWindow + 0.5, Math.max(6, S.dur - tWindow - 4), ease.inOut);
    const wx = 1600;
    const wy = 320;
    const half = lerp(150, 34, close);
    ctx.save();
    ctx.globalAlpha = wa;
    ctx.fillStyle = "#1a212b";
    ctx.strokeStyle = C.mid;
    ctx.lineWidth = 2;
    ctx.fillRect(wx - 200, wy - 160, 200 - half, 320);
    ctx.fillRect(wx + half, wy - 160, 200 - half, 320);
    ctx.strokeRect(wx - 200, wy - 160, 400, 320);
    ctx.fillStyle = rgba(C.cyan, 0.12);
    ctx.fillRect(wx - half, wy - 160, half * 2, 320);
    ctx.restore();
    D.para(ctx, "STATUS QUO STILL DOMINATES", wx - 180, wy + 210, 360, { size: 16, weight: 600, tracking: 3, alpha: wa, color: C.cyan, lineHeight: 1.2 });
    // three predictions
    const tag = (x, who, col, line1, line2, a) => {
      D.panel(ctx, x, 620, 540, 330, { alpha: a, color: col, fill: rgba(col, 0.05), title: who, titleColor: col });
      D.para(ctx, line1, x + 26, 700, 490, { size: 22, weight: 600, tracking: 1.5, alpha: a, lineHeight: 1.25 });
      if (line2) D.para(ctx, line2, x + 26, 830, 490, { kind: "mono", size: 13, color: C.mid, alpha: a, caps: true });
    };
    tag(120, "Mearsheimer", "#dfe7ef", "THE WINDOW IS A POWER FACT, NOT A COMMERCIAL ONE.", "NOT LEFT TO CORPORATE GOVERNANCE", prog(t, tM, 0.6));
    tag(690, "Sachs", C.violet, "THE CONTROLS MEANT TO HOLD THE WINDOW OPEN CONVINCE THE RISING STATE IT IS A CAGE.", "", prog(t, tS, 0.6));
    const ja = prog(t, tJ, 0.6);
    D.panel(ctx, 1260, 620, 540, 330, { alpha: ja, color: C.green, fill: rgba(C.green, 0.05), title: "Jiang · numerical", titleColor: C.green });
    D.text(ctx, "EV(CAPTURE) × P(WORKING PLANT)", 1286, 700, { kind: "mono", size: 18, weight: 500, alpha: ja });
    D.text(ctx, "<  EV(DENIAL)", 1286, 732, { kind: "mono", size: 18, weight: 500, alpha: ja });
    const cx = 1290;
    const cy = 770;
    const ev1 = Array.from({ length: 21 }, (_, i) => [i / 20, 0.8 - 0.65 * (i / 20)]);
    const ev2 = Array.from({ length: 21 }, (_, i) => [i / 20, 0.3 + 0.2 * (i / 20)]);
    const p = prog(t, tJ + 1, 3);
    D.series(ctx, cx, cy, 480, 150, ev1, { color: C.crimson, width: 2.5, p, alpha: ja, glow: 6 });
    D.series(ctx, cx, cy, 480, 150, ev2, { color: C.steel, width: 2.5, p, alpha: ja, glow: 6 });
    const xc = cx + 480 * (0.5 / 0.85);
    D.stroke(ctx, [[xc, cy], [xc, cy + 150]], { color: C.green, width: 1.5, dash: [4, 4], alpha: prog(t, tJ + 3.5, 0.5) });
    D.label(ctx, "BOTH ACT TO MAKE THE PLANT UNUSABLE", xc, cy + 172, { align: "center", color: C.green, alpha: prog(t, tJ + 4, 0.5), size: 10 });
  };
}

// ================================================================ 12. the fortress redrawn
function s12(S) {
  const view = new MapView(geoMercator().scale(1500).translate([W / 2, H / 2]), { res: "50m", bbox: [[95, 5], [150, 48]] });
  view.setCam(K.camFor(view, [124, 29], 1, 900, 560));
  // NL and the U.S. sit off this map: anchor them to the frame edges.
  const blue = [[[150, 300], "NETHERLANDS ←", true], [P.kumamoto, "JAPAN", false], [P.pyeongtaek, "KOREA", false], [[1790, 520], "→ UNITED STATES", true]];
  const tw = P.hsinchu;
  const tWall = 0.2;
  const tOrder = S.at(1);
  const tBlue = S.at(2);
  const tAmber = S.at(3);
  const tIsland = S.at(4);
  const tSwitch = S.at(5);
  const tFinal = S.at(8);
  return (ctx, t) => {
    D.bg(ctx, { gridAlpha: 0.15 });
    const fin = prog(t, tFinal, 1.2);
    ctx.save();
    ctx.globalAlpha = 1 - fin * 0.75;
    view.base(ctx, { borderAlpha: 0.4, colors: { [ID.china]: rgba(C.crimson, 0.12), [ID.taiwan]: rgba(WAFER, 0.3) } });
    const isl = view.xy(tw);
    // not a wall around the island
    const wallA = fade(t, tWall, 0.6, tOrder, 1);
    ctx.save();
    ctx.globalAlpha *= wallA;
    ctx.strokeStyle = C.mid;
    ctx.lineWidth = 6;
    ctx.setLineDash([16, 6]);
    ctx.beginPath();
    ctx.arc(isl[0], isl[1], 90 + 30 * prog(t, tOrder - 0.6, 1), 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    D.label(ctx, "NOT A WALL", isl[0], isl[1] - 110, { align: "center", color: C.mid, alpha: wallA, size: 13 });
    // a preference ordering around a factory
    const oa = prog(t, tOrder, 0.8);
    fabIcon(ctx, isl[0], isl[1], 30, { alpha: Math.max(oa, prog(t, tIsland, 0.6)), running: 1, t, color: WAFER });
    // tool masters / incomplete substitutes
    blue.forEach(([ll, n, edge], i) => {
      const p = edge ? ll : view.xy(ll);
      const a = prog(t, tBlue + i * 0.6, 0.5);
      D.stroke(ctx, D.arcPts(p, isl, 0.15, 40), { color: C.cyan, width: 1.6, alpha: a * 0.7 });
      D.node(ctx, p[0], p[1], 9, C.cyan, { alpha: a, glow: 16 });
      D.label(ctx, n, p[0], p[1] + 30, { align: "center", color: C.cyan, alpha: a, size: 12 });
    });
    D.label(ctx, "TOOL MASTERS · INCOMPLETE SUBSTITUTES", 120, 1000, { color: C.cyan, alpha: prog(t, tBlue + 2, 0.5), size: 13 });
    // the trailing second source
    const ma = prog(t, tAmber, 0.6);
    const sh = view.xy(P.shanghai);
    D.node(ctx, sh[0], sh[1], 10, C.amber, { alpha: ma, glow: 16 });
    D.label(ctx, "TRAILING SECOND SOURCE", sh[0] - 20, sh[1] - 22, { align: "right", color: C.amber, alpha: ma, size: 12 });
    D.label(ctx, "IMMENSELY PRODUCTIVE · SAFE ONLY WHILE BOTH PREFER A LIVING FAB", isl[0] + 50, isl[1] + 80, { color: WAFER, alpha: prog(t, tIsland, 0.6), size: 11 });
    ctx.restore();
    // the switch: deterrence failed
    const sa = prog(t, tSwitch - 0.4, 0.5);
    const on = prog(t, tSwitch, 0.25, ease.out);
    const sx = 1500;
    const sy = 230;
    ctx.save();
    ctx.globalAlpha = sa * (1 - fin * 0.8);
    D.roundRect(ctx, sx - 60, sy - 26, 120, 52, 26);
    ctx.fillStyle = mix("#1a212b", C.crimson, on);
    ctx.fill();
    ctx.strokeStyle = C.ice;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = C.ice;
    ctx.beginPath();
    ctx.arc(lerp(sx - 32, sx + 32, on), sy, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    D.label(ctx, "DETERRENCE FAILED", sx, sy + 60, { align: "center", color: on > 0.5 ? C.crimson : C.mid, alpha: sa * (1 - fin * 0.8), size: 14, weight: 600 });
    for (const [x, cap, col] of [[1240, "WASHINGTON", C.cyan], [1760, "BEIJING", C.crimson]]) {
      const a = sa * (1 - fin * 0.8);
      D.text(ctx, cap, x, 340, { kind: "mono", size: 13, color: col, align: "center", alpha: a });
      D.text(ctx, "POSSESSION", x, 372, { size: 20, weight: 600, tracking: 4, align: "center", alpha: a * (1 - prog(t, S.at(6), 0.4)), color: C.mid });
      D.text(ctx, "PREVENTION", x, 372, { size: 20, weight: 600, tracking: 4, align: "center", alpha: a * prog(t, S.at(7), 0.4), color: C.ice });
    }
    // the final comparison, held in silence
    if (fin > 0) {
      D.panel(ctx, 260, 360, 600, 300, { alpha: fin, fill: rgba("#0b0e13", 0.95), color: C.steel });
      D.text(ctx, "RUBBLE", 560, 480, { size: 54, weight: 600, tracking: 12, align: "center", alpha: fin, color: C.steel });
      D.text(ctx, "IN A CLEANROOM", 560, 530, { kind: "mono", size: 18, tracking: 3, align: "center", alpha: fin, color: C.mid });
      D.text(ctx, "<", 960, 535, { size: 90, weight: 300, align: "center", alpha: prog(t, tFinal + 1.5, 0.8), color: C.ice });
      D.panel(ctx, 1060, 360, 600, 300, { alpha: prog(t, tFinal + 0.8, 1), fill: rgba("#0b0e13", 0.95), color: C.crimson });
      D.text(ctx, "OUTPUT", 1360, 480, { size: 54, weight: 600, tracking: 12, align: "center", alpha: prog(t, tFinal + 0.8, 1), color: C.crimson });
      D.text(ctx, "IN THE RIVAL'S ARSENAL", 1360, 530, { kind: "mono", size: 18, tracking: 3, align: "center", alpha: prog(t, tFinal + 0.8, 1), color: C.mid });
      D.text(ctx, "LESS DANGEROUS  ·  TO EACH CAPITAL  ·  MORE DANGEROUS", 960, 730, { kind: "mono", size: 15, tracking: 3, align: "center", alpha: prog(t, tFinal + 2.5, 1), color: C.dim });
    }
  };
}

export default {
  title: "The Semiconductor Fortress",
  subtitle: "The realist calculus of a destroyed TSMC",
  short: "The Semiconductor Fortress",
  scenes: [s1, s2, s3, s4, s5, s6, s7, s8, s9, s10, s11, s12],
};
