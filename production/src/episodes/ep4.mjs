// EPISODE 4 — THE GERMAN PIVOT
import { geoMercator } from "d3-geo";
import { C, W, H, clamp, lerp, ease, prog, fade, rgba, mix, rng } from "../engine/core.mjs";
import * as D from "../engine/draw.mjs";
import { MapView, P, ID, PIPES } from "../engine/geo.mjs";
import * as K from "../engine/kit.mjs";
import { germanGasBeforeBreak } from "../figures.mjs";

const GER = "#c9d3dd"; // German industrial core: neutral steel-white
const RU = C.darkred;

// Muted top-down "aerial" of a chemical complex (abstract, deterministic).
function chemComplex(ctx, alpha, t = 0) {
  if (alpha <= 0) return;
  const r = rng(404);
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.strokeStyle = "#3a4552";
  ctx.fillStyle = "#1a2029";
  ctx.lineWidth = 1.5;
  // pipe racks
  for (let i = 0; i < 9; i++) {
    const y = 140 + i * 100;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y + (r() - 0.5) * 20);
    ctx.stroke();
  }
  for (let i = 0; i < 12; i++) {
    const x = 80 + i * 160;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + (r() - 0.5) * 30, H);
    ctx.stroke();
  }
  // tanks + reactors
  for (let i = 0; i < 70; i++) {
    const x = r() * W;
    const y = r() * H;
    const rad = 10 + r() * 34;
    ctx.beginPath();
    ctx.arc(x, y, rad, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y, rad * 0.55, 0, Math.PI * 2);
    ctx.stroke();
  }
  // halls
  for (let i = 0; i < 26; i++) {
    const x = r() * W;
    const y = r() * H;
    ctx.fillRect(x, y, 60 + r() * 140, 30 + r() * 60);
    ctx.strokeRect(x, y, 60 + r() * 140, 30 + r() * 60);
  }
  // cooling-tower plumes, drifting
  for (let i = 0; i < 5; i++) {
    const x = 200 + i * 380 + Math.sin(t * 0.2 + i) * 10;
    const y = 260 + (i % 2) * 420;
    const g = ctx.createRadialGradient(x, y, 0, x, y, 90);
    g.addColorStop(0, "rgba(200,210,220,0.10)");
    g.addColorStop(1, "rgba(200,210,220,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - 90, y - 90, 180, 180);
    ctx.fillStyle = "#1a2029";
  }
  ctx.restore();
}

// Gift box and tax form icons.
function gift(ctx, x, y, s, color, alpha) {
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.strokeRect(x - s / 2, y - s * 0.3, s, s * 0.7);
  ctx.strokeRect(x - s * 0.56, y - s * 0.45, s * 1.12, s * 0.18);
  ctx.beginPath();
  ctx.moveTo(x, y - s * 0.45);
  ctx.lineTo(x, y + s * 0.4);
  ctx.moveTo(x, y - s * 0.45);
  ctx.quadraticCurveTo(x - s * 0.35, y - s * 0.85, x - s * 0.08, y - s * 0.45);
  ctx.moveTo(x, y - s * 0.45);
  ctx.quadraticCurveTo(x + s * 0.35, y - s * 0.85, x + s * 0.08, y - s * 0.45);
  ctx.stroke();
  ctx.restore();
}

function taxForm(ctx, x, y, s, color, alpha) {
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.strokeStyle = color;
  ctx.fillStyle = rgba(color, 0.12);
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x - s * 0.4, y - s * 0.5);
  ctx.lineTo(x + s * 0.2, y - s * 0.5);
  ctx.lineTo(x + s * 0.4, y - s * 0.3);
  ctx.lineTo(x + s * 0.4, y + s * 0.5);
  ctx.lineTo(x - s * 0.4, y + s * 0.5);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
  D.text(ctx, "%", x, y + s * 0.18, { kind: "sans", size: s * 0.55, weight: 600, color, align: "center", alpha });
}

function umbrella(ctx, x, y, s, color, alpha = 1) {
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.strokeStyle = color;
  ctx.fillStyle = rgba(color, 0.15);
  ctx.lineWidth = 3;
  ctx.shadowColor = color;
  ctx.shadowBlur = 14;
  ctx.beginPath();
  ctx.arc(x, y, s, Math.PI, 0);
  for (let i = 3; i >= 0; i--) {
    const x0 = x - s + (i + 1) * (s / 2);
    ctx.quadraticCurveTo(x0 - s / 4, y - s * 0.12, x0 - s / 2, y);
  }
  ctx.fill();
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x, y + s * 1.1);
  ctx.arc(x - s * 0.15, y + s * 1.1, s * 0.15, 0, Math.PI);
  ctx.stroke();
  ctx.restore();
}

function flag(ctx, x, y, s, color, alpha = 1, wave = 0) {
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x, y + s);
  ctx.lineTo(x, y - s);
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y - s);
  for (let i = 0; i <= 10; i++) ctx.lineTo(x + (i / 10) * s * 1.2, y - s + Math.sin(i * 0.7 + wave) * s * 0.06);
  for (let i = 10; i >= 0; i--) ctx.lineTo(x + (i / 10) * s * 1.2, y - s * 0.3 + Math.sin(i * 0.7 + wave) * s * 0.06);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// ================================================================ 1. two prices
function s1(S) {
  const tSec = S.at("Security was");
  const tEn = S.at("Energy was");
  const tDel = S.at("The second");
  const tShock = S.at("In the");
  const tTax = S.at("When the", 0.4);
  const tSag = S.at("Berlin's rational");
  return (ctx, t) => {
    D.bg(ctx, { grid: false });
    chemComplex(ctx, 0.5 - 0.25 * prog(t, tSec - 1, 1.5), t);
    D.text(ctx, "GERMANY'S POSTWAR BARGAIN", 960, 220, { size: 26, weight: 600, tracking: 10, align: "center", alpha: prog(t, 0.2, 0.8) });
    // security term
    const sa = prog(t, tSec, 0.6);
    D.panel(ctx, 260, 300, 560, 300, { alpha: sa, fill: rgba("#0b0e13", 0.9), color: C.cyan, title: "Term 1 · Security" });
    D.node(ctx, 360, 440, 30, C.cyan, { alpha: sa, glow: 30 });
    D.text(ctx, "PRICED IN WASHINGTON", 300, 550, { size: 22, weight: 600, tracking: 3, alpha: sa });
    const g2t = prog(t, tTax, 1);
    gift(ctx, 700, 450, 70, C.cyan, sa * (1 - g2t));
    taxForm(ctx, 700, 450, 70, C.crimson, sa * g2t);
    D.label(ctx, g2t > 0.5 ? "A TAX" : "A GIFT", 700, 530, { align: "center", color: g2t > 0.5 ? C.crimson : C.cyan, alpha: sa, size: 13 });
    D.text(ctx, "+", 960, 470, { size: 60, weight: 300, align: "center", alpha: sa * (t < tDel ? 1 : 0.15), color: C.mid });
    // energy term (hard-cut deletion)
    const deleted = t >= tDel;
    const ea = prog(t, tEn, 0.6);
    if (!deleted) {
      D.panel(ctx, 1100, 300, 560, 300, { alpha: ea, fill: rgba("#0b0e13", 0.9), color: C.amber, title: "Term 2 · Energy" });
      D.stroke(ctx, [[1620, 470], [1140, 470]], { color: C.amber, width: 10, alpha: ea, glow: 14 });
      K.flow(ctx, [[1620, 470], [1140, 470]], t, { color: "#fff0cf", n: 8, speed: 0.4, size: 3, alpha: ea });
      D.text(ctx, "PRICED IN SIBERIA", 1380, 540, { size: 22, weight: 600, tracking: 3, align: "center", alpha: ea });
    } else {
      ctx.save();
      ctx.strokeStyle = rgba(C.mid, 0.35);
      ctx.setLineDash([8, 8]);
      ctx.strokeRect(1100, 300, 560, 300);
      ctx.restore();
      D.text(ctx, "DELETED", 1380, 465, { size: 34, weight: 700, tracking: 12, align: "center", color: C.crimson });
      D.text(ctx, "PIPELINE GAS FROM RUSSIA · OFFLINE", 1380, 505, { kind: "mono", size: 14, align: "center", color: C.mid, alpha: prog(t, S.at("Pipeline gas"), 0.5) });
    }
    K.chip(ctx, "COST SHOCK", 1380, 680, { color: C.crimson, align: "center", alpha: prog(t, tShock, 0.5), size: 16 });
    // the industrial core under the tax
    const ca = prog(t, tTax - 0.4, 0.8);
    D.panel(ctx, 260, 700, 560, 240, { alpha: ca, fill: rgba("#0b0e13", 0.9), color: GER, title: "German industrial core" });
    for (let i = 0; i < 5; i++) D.icon.factory(ctx, 320 + i * 64, 830, 44, GER, ca * (0.5 + 0.5 * (1 - prog(t, tSag + i * 0.6, 0.6))));
    D.stroke(ctx, [[700, 520], [700, 700]], { color: C.crimson, width: 2, dash: [5, 5], alpha: g2t });
    const sag = prog(t, tSag, 3, ease.inOut);
    D.gauge(ctx, 720, 880, 55, lerp(0.82, 0.38, sag), { alpha: ca, color: GER, label: "OUTPUT" });
    K.chip(ctx, "HOW MUCH TAX CAN THE CORE PAY?", 1100, 860, { color: C.ice, alpha: prog(t, tSag + 1, 0.6), size: 16 });
  };
}

// ================================================================ 2. the cheap molecule, and the break
function s2(S) {
  const view = new MapView(geoMercator().scale(2600).translate([W / 2, H / 2]), { res: "10m", bbox: [[2, 50], [34, 63]] });
  view.setCam(K.camFor(view, [19, 56.4], 1, 960, 560));
  const tSteps = S.at("The molecule");
  const tUse = S.at("It fed");
  const tFeed = S.at("In German");
  const tGap = S.at("They experience");
  const tBreak = S.at("The pipelines") - 0.6;
  const tContested = S.at("Who destroyed");
  const tZero = S.at("The economic");
  return (ctx, t) => {
    D.bg(ctx, { gridAlpha: 0.2 });
    const mapA = prog(t, tBreak, 1);
    if (mapA < 1) {
      ctx.save();
      ctx.globalAlpha = 1 - mapA;
      // Sankey: sources -> Germany -> end use
      const x0 = 300;
      const xm = 900;
      const x1 = 1300;
      const top = 230;
      const u = 5.2; // px per % share
      const tone = { russia: RU, other: C.steel };
      const src = germanGasBeforeBreak.shares.map((row) => [row.label, row.pct, tone[row.colorKey]]);
      let y = top;
      let ym = top + 10;
      src.forEach(([n, v, col], i) => {
        const a = prog(t, 0.3 + i * 0.3, 0.6);
        ctx.fillStyle = rgba(col, 0.9 * a);
        ctx.fillRect(x0 - 14, y, 14, v * u - 4);
        D.text(ctx, n, x0 - 26, y + (v * u) / 2 + 5, { kind: "mono", size: 13, align: "right", color: i === 0 ? "#f0a0a6" : C.mid, alpha: a });
        D.text(ctx, `${v}%`, x0 - 26, y + (v * u) / 2 + 24, { kind: "mono", size: 12, align: "right", color: C.dim, alpha: a * (i < 3 ? 1 : 0) });
        D.ribbon(ctx, x0, y, y + v * u - 4, xm, ym, ym + v * u - 4, col, { p: prog(t, 0.6 + i * 0.3, 1.4), alpha: i === 0 ? 0.6 : 0.35 });
        y += v * u + 6;
        ym += v * u - 2;
      });
      D.label(ctx, "GERMAN GAS IMPORTS · BEFORE THE BREAK (APPROX.)", x0 - 14, top - 30, { color: C.mid, size: 12 });
      ctx.fillStyle = GER;
      ctx.fillRect(xm, top + 10, 16, 100 * u - 12);
      D.text(ctx, "GERMANY", xm + 8, top - 4, { kind: "mono", size: 13, align: "center", color: C.ice });
      // end use
      const ua = prog(t, tUse, 1.4);
      D.ribbon(ctx, xm + 16, top + 10, top + 10 + 55 * u, x1, top - 10, top - 10 + 55 * u, C.ice, { p: ua, alpha: 0.3 });
      D.ribbon(ctx, xm + 16, top + 10 + 55 * u, top + 10 + 100 * u - 12, x1, top + 30 + 55 * u, top + 30 + 100 * u - 12, C.amber, { p: prog(t, tFeed, 1.4), alpha: 0.45 });
      D.text(ctx, "BOILERS · HEAT", x1 + 20, top - 10 + 27 * u, { kind: "mono", size: 15, color: C.ice, alpha: ua });
      D.text(ctx, "CHEMISTRY · FEEDSTOCK + FUEL", x1 + 20, top + 30 + 77 * u, { kind: "mono", size: 15, color: C.amber, alpha: prog(t, tFeed, 0.6) });
      // three cost steps crossed out on the Russian ribbon
      ["LIQUEFACTION", "OCEAN LEG", "REGASIFICATION TOLL"].forEach((n, i) => {
        const a = prog(t, tSteps + 1 + i * 1.6, 0.5);
        const bx = 480 + i * 200;
        const by = top + 70 + i * 34;
        D.panel(ctx, bx - 95, by - 24, 190, 42, { alpha: a, fill: rgba("#0b0e13", 0.92), r: 3, sfx: n });
        D.text(ctx, n, bx, by + 3, { kind: "mono", size: 13, align: "center", color: C.ice, alpha: a, maxWidth: 176 });
        D.stroke(ctx, [[bx - 88, by + 12], [bx + 88, by - 20]], { color: C.crimson, width: 3, to: prog(t, tSteps + 1.3 + i * 1.6, 0.3), alpha: a });
      });
      // competitor gap
      const ga = prog(t, tGap - 1, 0.6);
      D.panel(ctx, 1300, 760, 520, 240, { alpha: ga, title: "Industrial energy cost · illustrative", fill: rgba("#0b0e13", 0.92) });
      const gp = prog(t, tGap, 3);
      const mk = (f) => Array.from({ length: 31 }, (_, i) => [i / 30, f(i / 30)]);
      D.series(ctx, 1330, 810, 460, 160, mk((u2) => 0.22 + 0.02 * Math.sin(u2 * 9)), { color: C.cyan, width: 2.5, p: gp, alpha: ga, glow: 6 });
      D.series(ctx, 1330, 810, 460, 160, mk((u2) => 0.34 + 0.02 * Math.sin(u2 * 7)), { color: C.crimson, width: 2.5, p: gp, alpha: ga, glow: 6 });
      D.series(ctx, 1330, 810, 460, 160, mk((u2) => 0.4 + (u2 > 0.6 ? 0.45 * Math.exp(-(u2 - 0.6) * 4) + 0.22 : 0)), { color: GER, width: 3, p: gp, alpha: ga, glow: 8 });
      D.label(ctx, "GERMANY", 1790, 828, { color: GER, align: "right", alpha: ga * prog(t, tGap + 2.5, 0.5), size: 11 });
      D.label(ctx, "CHINA", 1790, 900, { color: C.crimson, align: "right", alpha: ga * prog(t, tGap + 2.5, 0.5), size: 11 });
      D.label(ctx, "UNITED STATES", 1790, 945, { color: C.cyan, align: "right", alpha: ga * prog(t, tGap + 2.5, 0.5), size: 11 });
      ctx.restore();
    }
    if (mapA > 0) {
      ctx.save();
      ctx.globalAlpha = mapA;
      view.base(ctx, { colors: { [ID.germany]: rgba(GER, 0.25), [ID.russia]: rgba(RU, 0.3) }, borderAlpha: 0.6 });
      ctx.restore();
      const dark = prog(t, tBreak + 1.2, 2.5);
      for (const k of ["nordStream", "nordStream2"]) {
        const l = D.smoothPts(view.line(PIPES[k]), 6);
        D.stroke(ctx, l, { color: mix(C.amber, "#20262e", dark), width: 4, glow: 16 * (1 - dark), alpha: mapA });
        if (dark < 0.9) K.flow(ctx, l.slice().reverse(), t, { color: "#fff0cf", n: 8, speed: 0.15, size: 2.6, alpha: mapA * (1 - dark) });
      }
      D.label(ctx, "NORD STREAM 1 + 2", ...view.xy([22.5, 58.9]), { color: C.mid, alpha: mapA, size: 13 });
      const bh = view.xy([15.6, 55.4]);
      D.node(ctx, bh[0], bh[1], 10, C.crimson, { alpha: prog(t, tBreak + 1, 0.4), glow: 20, pulseT: t });
      D.label(ctx, "2022", bh[0] + 16, bh[1] + 30, { color: C.crimson, alpha: prog(t, tBreak + 1, 0.4), size: 13 });
      D.label(ctx, "ATTRIBUTION CONTESTED", 120, 900, { color: C.mid, alpha: prog(t, tContested, 0.5), size: 14 });
      D.text(ctx, "FLOW IS ZERO", 120, 980, { size: 64, weight: 600, tracking: 14, alpha: prog(t, tZero, 0.6) });
      K.chip(ctx, "NO ALLIED POLICY INTENDS TO TURN IT BACK ON", 1800, 980, { color: C.ice, align: "right", alpha: prog(t, S.at("The gas"), 0.6), size: 14 });
    }
  };
}

// ================================================================ 3. the cap on the strongest block
function s3(S) {
  const blocks = [["GERMANY", 1.0], ["ITALY", 0.42], ["FRANCE", 0.38], ["SPAIN", 0.22], ["POLAND", 0.17], ["NETHERLANDS", 0.15]];
  const tRank = 0.4;
  const tInset = S.at("Germany is", 0.55);
  const tFree = S.at("A Germany that can");
  const tCap = S.at("A Germany that must");
  const tRetire = S.at("The cap");
  const tCapt = S.at("Survival for");
  const tUmb = S.at("A security");
  return (ctx, t) => {
    D.bg(ctx, { gridAlpha: 0.2 });
    // power ranking blocks
    const baseY = 880;
    const capY = lerp(-200, baseY - 470 - 24, prog(t, tCap, 2.2, ease.out));
    blocks.forEach(([n, v], i) => {
      const a = prog(t, tRank + i * 0.25, 0.6);
      const x = 160 + i * 150;
      const h = v * 460;
      const isDe = i === 0;
      const hh = isDe ? Math.min(h, baseY - capY - 24) : h;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.fillStyle = rgba(isDe ? GER : C.steel, isDe ? 0.3 : 0.18);
      ctx.strokeStyle = isDe ? GER : C.steel;
      ctx.lineWidth = 1.5;
      ctx.fillRect(x, baseY - hh, 120, hh);
      ctx.strokeRect(x, baseY - hh, 120, hh);
      ctx.restore();
      D.label(ctx, n, x + 60, baseY + 28, { align: "center", color: isDe ? C.ice : C.mid, alpha: a, size: 12 });
    });
    D.label(ctx, "EUROPEAN INDUSTRIAL WEIGHT · RELATIVE", 160, 360, { color: C.mid, alpha: prog(t, tRank, 0.6), size: 12 });
    // factories inside the German block, retiring under the cap
    for (let i = 0; i < 6; i++) {
      const fy = baseY - 50 - i * 60;
      if (fy < capY + 40) continue;
      const off = prog(t, tRetire + i * 0.7, 0.5);
      D.icon.factory(ctx, 220, fy, 38, mix(C.ice, "#2a313b", off), prog(t, tRank, 0.6), 1 - off);
    }
    // free Germany: machines in every direction, fuel from the east
    const fa = fade(t, tFree, 0.6, tCap, 0.8);
    if (fa > 0) {
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2;
        D.arrow(ctx, [[220, 640], [220 + Math.cos(a) * 140, 640 + Math.sin(a) * 140]], { color: C.ice, width: 2, head: 10, alpha: fa });
      }
      D.label(ctx, "A GERMANY THAT CAN DISAGREE", 220, 470, { align: "center", color: C.ice, alpha: fa, size: 12 });
    }
    // the cap
    const ca = prog(t, tCap, 0.6);
    D.panel(ctx, 130, capY, 260, 64, { alpha: ca, fill: rgba(C.cyan, 0.16), color: C.cyan, glow: 14, sfx: "The cap" });
    D.text(ctx, "CAP", 260, capY + 43, { size: 26, weight: 700, tracking: 10, align: "center", color: C.cyan, alpha: ca });
    ["EXPENSIVE ALLIED ENERGY", "HOSTED ALLIED FORCES", "SANCTIONS CLEARANCE"].forEach((n, i) => {
      K.chip(ctx, n, 420, capY + 10 + i * 0 + (i - 1) * 40 + 30, { color: C.cyan, alpha: prog(t, tCap + 0.8 + i * 0.7, 0.4), size: 12 });
    });
    // century-scale inset: blocked corridors
    const ia = prog(t, tInset, 0.8);
    const ix = 1100;
    const iy = 200;
    D.panel(ctx, ix, iy, 700, 360, { alpha: ia, title: "A century of blocked corridors", fill: rgba("#0b0e13", 0.92) });
    const de = [ix + 120, iy + 210];
    const ru = [ix + 580, iy + 190];
    D.node(ctx, de[0], de[1], 14, GER, { alpha: ia, glow: 12 });
    D.node(ctx, ru[0], ru[1], 14, RU, { alpha: ia, glow: 12 });
    D.label(ctx, "GERMANY", de[0], de[1] + 40, { align: "center", color: GER, alpha: ia, size: 12 });
    D.label(ctx, "RUSSIA", ru[0], ru[1] + 40, { align: "center", color: "#f0a0a6", alpha: ia, size: 12 });
    for (let k = 0; k < 4; k++) {
      const p = prog(t, tInset + 0.6 + k * 0.9, 0.7);
      const lift = -0.35 + k * 0.23;
      const pts = D.arcPts(de, ru, lift, 30);
      const stopAt = 0.45 + (k % 2) * 0.08;
      D.stroke(ctx, pts, { color: C.ice, width: 2, to: p * stopAt, alpha: ia * 0.8 });
      if (p >= 1) {
        const b = D.pointAt(pts, stopAt);
        D.stroke(ctx, [[b.x - 14 * Math.sin(b.a + Math.PI / 2), b.y + 14 * Math.cos(b.a + Math.PI / 2) * -1], [b.x + 14 * Math.sin(b.a + Math.PI / 2), b.y - 14 * Math.cos(b.a + Math.PI / 2) * -1]], { color: C.cyan, width: 4, alpha: ia });
      }
    }
    D.text(ctx, "1900", ix + 30, iy + 340, { kind: "mono", size: 11, color: C.dim, alpha: ia });
    D.text(ctx, "2022", ix + 670, iy + 340, { kind: "mono", size: 11, color: C.dim, align: "right", alpha: ia });
    D.stroke(ctx, [[ix + 70, iy + 336], [ix + 630, iy + 336]], { color: C.faint, width: 1, alpha: ia });
    K.chip(ctx, "DEPENDENCE IS USEFUL WHEN INTENTIONS ARE OPAQUE", ix, iy + 410, { color: C.mid, alpha: fade(t, S.at("Dependence is"), 0.5, tCapt, 0.6), size: 13 });
    D.caption(ctx, "Survival for a trading state is the productive base", t, tCapt, { x: 600, y: 1000, size: 24 });
    // umbrella that arrives bundled with deindustrialization
    const ua = prog(t, tUmb, 0.8);
    umbrella(ctx, 260, capY - 70, 90, C.cyan, ua);
    D.label(ctx, "A GENUINE UMBRELLA · BUNDLED WITH DEINDUSTRIALIZATION", 1100, 900, { color: C.cyan, alpha: ua, size: 13 });
  };
}

// ================================================================ 4. stabilizer, relabelled vice
function s4(S) {
  const tStab = 0.4;
  const tVice = S.at("Eurasian energy", 0.7);
  const tSever = S.at("Sanctions, the");
  const tCost = S.at("The costs");
  const tGain = S.at("The gains");
  const tSys = S.at("A system");
  const tSheet = S.at("A multipolar");
  return (ctx, t) => {
    D.bg(ctx, { gridAlpha: 0.2 });
    // the pipeline
    const py = 250;
    const sev = prog(t, tSever, 0.8);
    ctx.save();
    ctx.fillStyle = "#151b23";
    ctx.strokeStyle = C.border;
    ctx.fillRect(200, py - 26, 1520, 52);
    ctx.strokeRect(200, py - 26, 1520, 52);
    ctx.restore();
    if (sev < 1) K.flow(ctx, [[1710, py], [210, py]], t, { color: "#fff0cf", n: 14, speed: 0.12, size: 3.5, alpha: 1 - sev });
    if (sev > 0) {
      ctx.save();
      ctx.fillStyle = C.bg;
      ctx.fillRect(940, py - 40, 40 * sev, 80);
      ctx.restore();
    }
    D.label(ctx, "SIBERIA", 1730, py + 6, { color: "#f0a0a6", size: 13 });
    D.label(ctx, "GERMANY", 186, py + 6, { color: GER, size: 13, align: "right" });
    const sa = prog(t, tStab, 0.6) * (1 - prog(t, tVice, 0.2));
    D.text(ctx, "STABILIZER", 960, py - 52, { size: 30, weight: 600, tracking: 10, align: "center", color: C.green, alpha: sa });
    D.stamp(ctx, "VICE", 960, py - 64, t, tVice, { color: C.cyan, size: 40, angle: -0.06 });
    D.label(ctx, "RECLASSIFIED BY THE UNIPOLAR PROJECT", 960, py + 66, { align: "center", color: C.cyan, alpha: prog(t, tVice + 0.4, 0.5), size: 12 });
    ["SANCTIONS", "SEVERED PIPELINE PROJECTS", "REORIENT TO SEABORNE ALLIED GAS"].forEach((n, i) => K.chip(ctx, n, 330 + i * 470, py + 120, { color: C.ice, alpha: prog(t, tSever + i * 0.9, 0.5), size: 13, align: "center" }));
    // costs fall, gains rise
    const axisY = 640;
    D.stroke(ctx, [[200, axisY], [1720, axisY]], { color: C.mid, width: 1.5, alpha: prog(t, tCost - 0.5, 0.6) });
    const costs = [["GERMAN CHEMICAL EMPLOYMENT", 0.8], ["EUROZONE SUPPLIERS", 0.6], ["HOUSEHOLD BILLS", 0.7]];
    costs.forEach(([n, v], i) => {
      const a = prog(t, tCost + i * 1.2, 0.5);
      const x = 260 + i * 200;
      const h = v * 230 * prog(t, tCost + i * 1.2, 1.2, ease.out);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.fillStyle = rgba(C.crimson, 0.75);
      ctx.fillRect(x, axisY, 120, h);
      ctx.restore();
      D.para(ctx, n, x, axisY + 260, 160, { kind: "mono", size: 11, color: C.crimson, alpha: a, caps: true, lineHeight: 1.3 });
    });
    D.label(ctx, "COSTS", 260, axisY - 20, { color: C.crimson, alpha: prog(t, tCost, 0.5), size: 13, weight: 600 });
    const gains = [["U.S. LIQUEFIED-GAS EXPORTS", 0.75], ["A LARGER EUROPEAN MISSION · MIC", 0.65]];
    gains.forEach(([n, v], i) => {
      const a = prog(t, tGain + i * 1.4, 0.5);
      const x = 1180 + i * 240;
      const h = v * 260 * prog(t, tGain + i * 1.4, 1.2, ease.out);
      D.bar(ctx, x, axisY, 140, h, C.cyan, { alpha: a, glow: 10 });
      D.para(ctx, n, x, axisY + 40, 190, { kind: "mono", size: 11, color: C.cyan, alpha: a, caps: true, lineHeight: 1.3 });
    });
    D.label(ctx, "GAINS", 1180, axisY - 220, { color: C.cyan, alpha: prog(t, tGain, 0.5), size: 13, weight: 600 });
    K.chip(ctx, "ALLIED AUTONOMY = ALLIED RISK → EUROPEAN INDUSTRY TRADED FOR AMERICAN COMFORT", 960, 1000, { color: C.mid, align: "center", alpha: fade(t, tSys, 0.6, tSheet + 1, 0.5), size: 13 });
    // the multipolar alternative: shown, then filed
    const sh = prog(t, tSheet, 0.6);
    if (sh > 0) {
      const file = prog(t, tSheet + 5, 1.6, ease.inOut);
      const x = lerp(700, 1500, file);
      const y = lerp(380, 860, file);
      const sc = lerp(1, 0.35, file);
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(sc, sc);
      D.panel(ctx, -260, -170, 520, 340, { alpha: sh, fill: rgba("#10161e", 0.97), title: "Multipolar alternative", color: C.violet, titleColor: C.violet });
      ["STORAGE", "DIVERSIFICATION", "CONTRACTS"].forEach((n, i) => {
        D.text(ctx, `${i + 1}  ${n}`, -220, -60 + i * 64, { size: 30, weight: 600, tracking: 4, alpha: sh });
      });
      D.text(ctx, "A NEGOTIATED DEPENDENCE", -220, 140, { kind: "mono", size: 13, color: C.mid, alpha: sh });
      ctx.restore();
      if (file > 0) D.text(ctx, "FILED · NOT USED", 1500, 940, { kind: "mono", size: 14, color: C.mid, align: "center", alpha: prog(t, tSheet + 6.4, 0.5) });
    }
  };
}

// ================================================================ 5. the dearer substitute
function s5(S) {
  const view = new MapView(geoMercator().scale(5200).translate([W / 2, H / 2]), { res: "10m", bbox: [[3, 50], [18, 57]] });
  view.setCam(K.camFor(view, [10.8, 53.9], 0.9, 630, 640));
  const terms = [[P.wilhelmshaven, "WILHELMSHAVEN"], [P.brunsbuttel, "BRUNSBÜTTEL"], [P.stade, "STADE"], [P.mukran, "MUKRAN"], [P.lubmin, "LUBMIN"]];
  const tProc = S.at("Seaborne liquefied");
  const tTerm = S.at("Terminals on");
  const tPrice = S.at("They did");
  const tPrem = S.at("Long-term purchases");
  const tVeto = S.at("Energy security");
  const tJiang = S.at("Professor Jiang");
  const tBoth = S.at("The same");
  return (ctx, t) => {
    D.bg(ctx, { gridAlpha: 0.2 });
    // process strip: cool, ship, warm
    const steps = [["COOL", "−162 °C · LIQUEFY", C.cyan], ["SHIP", "OCEAN LEG", C.steel], ["WARM", "REGASIFY", C.amber]];
    steps.forEach(([n, sub, col], i) => {
      const a = prog(t, tProc + i * 1.1, 0.5);
      K.boxNode(ctx, 520 + i * 440, 200, 300, 90, n, { color: col, sub, alpha: a, titleSize: 22 });
      if (i < 2) D.arrow(ctx, [[680 + i * 440, 200], [800 + i * 440, 200]], { color: C.mid, width: 2, head: 10, to: prog(t, tProc + i * 1.1 + 0.6, 0.4), alpha: a });
    });
    // German coast terminals (map clipped below the process strip)
    ctx.save();
    ctx.beginPath();
    ctx.rect(60, 290, 1140, 740);
    ctx.clip();
    view.base(ctx, { colors: { [ID.germany]: rgba(GER, 0.12) }, borderAlpha: 0.5 });
    ctx.restore();
    D.panel(ctx, 60, 290, 1140, 740, { fill: null, color: C.border, sfx: "Coast terminals", at: tTerm });
    terms.forEach(([ll, n], i) => {
      const p = view.xy(ll);
      const a = prog(t, tTerm + i * 0.5, 0.5);
      D.node(ctx, p[0], p[1], 8, C.amber, { alpha: a, glow: 20, pulseT: t + i });
      D.label(ctx, n, p[0] + 14, p[1] - 10, { color: C.ice, alpha: a, size: 12 });
    });
    const pa = prog(t, tTerm + 2.5, 0.5);
    K.chip(ctx, "PHYSICAL ABSENCE OF THE MOLECULE · SOLVED", 120, 1000, { color: C.green, alpha: pa, size: 14 });
    // the price regime stays elevated
    const ca = prog(t, tPrice, 0.6);
    D.panel(ctx, 1240, 330, 580, 250, { alpha: ca, title: "German gas price regime · illustrative", fill: rgba("#0b0e13", 0.92) });
    const data = Array.from({ length: 41 }, (_, i) => {
      const u = i / 40;
      return [u, u < 0.35 ? 0.2 : u < 0.5 ? 0.2 + 0.7 * Math.sin(((u - 0.35) / 0.15) * (Math.PI / 2)) : 0.42 + 0.48 * Math.exp(-(u - 0.5) * 8)];
    });
    D.series(ctx, 1270, 380, 520, 170, data, { color: C.amber, width: 2.5, p: prog(t, tPrice + 0.3, 2.5), alpha: ca, glow: 8 });
    D.stroke(ctx, [[1270, 380 + 170 - 0.2 * 170], [1790, 380 + 170 - 0.2 * 170]], { color: C.mid, width: 1, dash: [4, 5], alpha: ca });
    D.label(ctx, "PIPELINE-ERA LEVEL", 1790, 380 + 170 - 0.2 * 170 + 18, { align: "right", color: C.mid, alpha: ca, size: 10 });
    // political premium tags on allied cargoes
    const cargo = [1460, 720];
    const ta = prog(t, tPrem, 0.6);
    D.icon.ship(ctx, cargo[0], cargo[1], 90, 0, C.ice, ta);
    D.label(ctx, "LONG-TERM ALLIED CARGO", cargo[0], cargo[1] + 52, { align: "center", color: C.mid, alpha: ta, size: 11 });
    ["DELAY", "REDIRECT", "DIPLOMATIC ASK"].forEach((n, i) => {
      const a = prog(t, S.at("A cargo") + i * 1.6, 0.5);
      D.stroke(ctx, [[cargo[0] + 40, cargo[1] - 16], [cargo[0] + 150, cargo[1] - 90 + i * 60]], { color: C.cyan, width: 1, alpha: a });
      K.chip(ctx, n, cargo[0] + 156, cargo[1] - 82 + i * 60, { color: C.cyan, alpha: a, size: 12 });
    });
    D.label(ctx, "POLITICAL PREMIUM", cargo[0] - 60, cargo[1] - 70, { color: C.cyan, alpha: ta, size: 12, weight: 600 });
    K.chip(ctx, "SECURITY WITH A VETO ATTACHED", 1240, 900, { color: C.ice, alpha: prog(t, tVeto, 0.6), size: 14 });
    // weaponized interdependence: one state touches both umbrella and invoice
    const ja = prog(t, tJiang, 0.6);
    D.text(ctx, "WEAPONIZED INTERDEPENDENCE", 1240, 980, { size: 26, weight: 600, tracking: 5, color: C.green, alpha: ja });
    const ba = prog(t, tBoth, 0.6);
    if (ba > 0) {
      const n0 = [1100, 560];
      D.node(ctx, n0[0], n0[1], 16, C.cyan, { alpha: ba, glow: 22 });
      umbrella(ctx, 1000, 470, 40, C.cyan, ba);
      taxForm(ctx, 1180, 460, 50, C.amber, ba);
      D.stroke(ctx, [n0, [1000, 500]], { color: C.cyan, width: 1.5, alpha: ba });
      D.stroke(ctx, [n0, [1170, 490]], { color: C.cyan, width: 1.5, alpha: ba });
      D.label(ctx, "UMBRELLA + INVOICE", n0[0], n0[1] + 40, { align: "center", color: C.cyan, alpha: ba, size: 11 });
    }
  };
}

// ================================================================ 6. Berlin's three terms
function s6(S) {
  const tT1 = S.at("The first term");
  const tT2 = S.at("The second");
  const tT3 = S.at("The third term");
  const tW = S.at("A quiet");
  const tNato = S.at("Formal membership");
  const tLoose = S.at("The change");
  return (ctx, t) => {
    D.bg(ctx, { gridAlpha: 0.2 });
    D.text(ctx, "BERLIN · THREE TERMS", 120, 190, { size: 26, weight: 600, tracking: 8, alpha: prog(t, 0.2, 0.6) });
    const cols = [
      [120, "Term 1 · unit energy cost", tT1],
      [700, "Term 2 · export revenue", tT2],
      [1280, "Term 3 · insurance value", tT3],
    ];
    cols.forEach(([x, title, t0], i) => D.panel(ctx, x, 240, 520, 380, { alpha: prog(t, Math.min(t0, 0.4 + i * 0.3), 0.6), title, fill: rgba("#0b0e13", 0.92) }));
    // term 1
    const a1 = prog(t, tT1 + 0.4, 0.6);
    [["GERMANY", 0.9, GER], ["CHINA", 0.55, C.crimson], ["UNITED STATES", 0.35, C.cyan]].forEach(([n, v, col], i) => {
      D.text(ctx, n, 150, 330 + i * 80, { kind: "mono", size: 12, color: C.mid, alpha: a1 });
      D.hbar(ctx, 150, 342 + i * 80, 440, 22, col, { p: v * prog(t, tT1 + 0.6 + i * 0.3, 1), alpha: a1 });
    });
    D.label(ctx, "RIVALS FOR THE NEXT FACTORY", 150, 590, { color: C.dim, alpha: a1, size: 11 });
    // term 2
    const a2 = prog(t, tT2 + 0.4, 0.6);
    [["UNITED STATES", 0.95], ["CHINA", 0.82], ["FRANCE", 0.8], ["NETHERLANDS", 0.62]].forEach(([n, v], i) => {
      D.text(ctx, n, 730, 320 + i * 64, { kind: "mono", size: 12, color: n === "CHINA" ? C.crimson : C.mid, alpha: a2 });
      D.hbar(ctx, 730, 330 + i * 64, 440, 18, n === "CHINA" ? C.crimson : C.steel, { p: v * prog(t, tT2 + 0.6 + i * 0.3, 1), alpha: a2 });
    });
    D.label(ctx, "MACHINERY + VEHICLES · LARGEST DEMAND POOLS (APPROX.)", 730, 590, { color: C.dim, alpha: a2, size: 10 });
    // term 3
    const a3 = prog(t, tT3 + 0.4, 0.6);
    umbrella(ctx, 1460, 400, 80, C.cyan, a3);
    K.envelope(ctx, 1680, 420, 110, { alpha: prog(t, tT3 + 2, 0.6), color: C.mid, seal: C.cyan });
    D.label(ctx, "NUCLEAR FILE · SEALED", 1680, 500, { align: "center", color: C.mid, alpha: prog(t, tT3 + 2, 0.6), size: 11 });
    D.label(ctx, "AMERICAN PROTECTION", 1460, 590, { align: "center", color: C.cyan, alpha: a3, size: 11 });
    // weights reweight
    const wp = prog(t, tW, 3, ease.inOut);
    const ws = [lerp(0.2, 0.36, wp), lerp(0.2, 0.34, wp), lerp(0.6, 0.3, wp)];
    const wa = prog(t, tW - 0.5, 0.6);
    D.label(ctx, "WEIGHTS", 120, 690, { color: C.mid, alpha: wa, size: 12 });
    let wx = 120;
    ws.forEach((w, i) => {
      const col = [GER, C.crimson, C.cyan][i];
      ctx.save();
      ctx.globalAlpha = wa;
      ctx.fillStyle = rgba(col, 0.5);
      ctx.fillRect(wx, 704, 1680 * w - 4, 34);
      ctx.restore();
      D.text(ctx, `T${i + 1} · ${(w * 100).toFixed(0)}%`, wx + 12, 727, { kind: "mono", size: 13, color: C.ice, alpha: wa });
      wx += 1680 * w;
    });
    D.label(ctx, "A QUIET PIVOT IS A REWEIGHTING", 1800, 690, { align: "right", color: C.ice, alpha: prog(t, tW, 0.6), size: 12 });
    // NATO membership stays a solid check
    const na = prog(t, tNato, 0.5);
    D.panel(ctx, 1280, 800, 520, 90, { alpha: na, fill: rgba("#0b0e13", 0.92), color: C.cyan, sfx: "NATO membership" });
    ctx.save();
    ctx.globalAlpha = na;
    ctx.strokeStyle = C.cyan;
    ctx.lineWidth = 5;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(1316, 846);
    ctx.lineTo(1334, 864);
    ctx.lineTo(1366, 828);
    ctx.stroke();
    ctx.restore();
    D.text(ctx, "FORMAL NATO MEMBERSHIP · STAYS", 1390, 856, { size: 20, weight: 600, tracking: 3, color: C.cyan, alpha: na });
    // constraint sliders on terms 1 and 2 loosen
    const la = prog(t, tLoose - 0.5, 0.6);
    const lp = prog(t, tLoose, 2.5, ease.inOut);
    D.slider(ctx, 150, 850, 420, lerp(0.85, 0.4, lp), { alpha: la, color: GER, label: "CONSTRAINT ACCEPTED · TERM 1" });
    D.slider(ctx, 730, 850, 420, lerp(0.85, 0.35, lp), { alpha: la, color: C.crimson, label: "CONSTRAINT ACCEPTED · TERM 2" });
  };
}

// ================================================================ 7. documents, not speeches
function s7(S) {
  const tSanc = S.at("German diplomats");
  const tWrite = S.at("German executives");
  const tFin = S.at("The finance");
  const tLoop = S.at("Jiang would");
  const tCross = S.at("Past a");
  const tChoose = S.at("The state");
  return (ctx, t) => {
    D.bg(ctx, { gridAlpha: 0.2 });
    // secondary-sanctions draft, narrowed by a German pen
    const da = prog(t, tSanc, 0.6);
    D.panel(ctx, 120, 160, 480, 420, { alpha: Math.max(da, prog(t, 0.3, 0.6)), fill: rgba("#10161e", 0.97), title: "Secondary sanctions · draft" });
    const lines = ["MILITARY END-USE ITEMS", "DUAL-USE COMPONENTS", "ORDINARY INDUSTRIAL SALES", "MACHINE TOOLS · GENERAL", "VEHICLE EXPORTS", "CHEMICAL INPUTS"];
    lines.forEach((l, i) => {
      const y = 230 + i * 52;
      D.text(ctx, l, 150, y, { kind: "mono", size: 14, color: C.ice, alpha: da });
      if (i >= 2) D.stroke(ctx, [[146, y - 5], [146 + 330 * prog(t, tSanc + 2 + i * 0.6, 0.5), y - 5]], { color: GER, width: 3 });
    });
    const pen = prog(t, tSanc + 2, 4, ease.linear);
    if (pen > 0 && pen < 1) {
      const i = Math.min(5, 2 + Math.floor(pen * 4));
      const px = 146 + 330 * clamp((t - tSanc - 2 - i * 0.6) / 0.5);
      D.stroke(ctx, [[px, 230 + i * 52 - 5], [px + 30, 230 + i * 52 - 45]], { color: GER, width: 5 });
    }
    D.label(ctx, "NARROWED", 360, 560, { color: GER, alpha: prog(t, tSanc + 5, 0.5), size: 12, align: "center" });
    // write-off postponed
    const wa = prog(t, tWrite, 0.6);
    D.panel(ctx, 660, 160, 480, 420, { alpha: Math.max(wa, prog(t, 0.6, 0.6)), fill: rgba("#10161e", 0.97), title: "Chemical capacity · write-off" });
    for (let i = 0; i < 6; i++) D.stroke(ctx, [[690, 240 + i * 46], [690 + (i % 3 === 2 ? 240 : 380), 240 + i * 46]], { color: C.border, width: 3, alpha: wa });
    D.stamp(ctx, "POSTPONED", 900, 420, t, tWrite + 1.5, { color: C.amber, size: 34, angle: -0.08 });
    K.chip(ctx, "WHICH MOLECULE COULD RETURN QUIETLY?", 900, 540, { color: C.mid, align: "center", alpha: prog(t, tWrite + 3, 0.5), size: 12 });
    // finance ministry chart
    const fa = prog(t, tFin, 0.6);
    D.panel(ctx, 1200, 160, 600, 420, { alpha: Math.max(fa, prog(t, 0.9, 0.6)), title: "Finance ministry", fill: rgba("#0b0e13", 0.94) });
    const fp = prog(t, tFin + 0.5, 4);
    const gx = 1240;
    const gy = 230;
    const gw = 520;
    const gh = 280;
    const base = Array.from({ length: 31 }, (_, i) => [i / 30, 0.75 - 0.4 * (i / 30)]);
    const pledge = Array.from({ length: 31 }, (_, i) => [i / 30, 0.48]);
    if (fp > 0) {
      const pts = base.map(([u, v]) => [gx + u * gw, gy + gh - v * gh]);
      const pl = pledge.map(([u, v]) => [gx + u * gw, gy + gh - v * gh]);
      const cutU = 0.675;
      ctx.save();
      ctx.globalAlpha = fa * 0.35;
      ctx.fillStyle = C.crimson;
      ctx.beginPath();
      const s0 = Math.floor(cutU * 30);
      const s1 = Math.floor(fp * 30);
      if (s1 > s0) {
        ctx.moveTo(pl[s0][0], pl[s0][1]);
        for (let i = s0; i <= s1; i++) ctx.lineTo(pl[i][0], pl[i][1]);
        for (let i = s1; i >= s0; i--) ctx.lineTo(pts[i][0], pts[i][1]);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }
    D.series(ctx, gx, gy, gw, gh, base, { color: GER, width: 3, p: fp, alpha: fa, glow: 8 });
    D.series(ctx, gx, gy, gw, gh, pledge, { color: C.cyan, width: 2.5, p: fp, alpha: fa, dash: [8, 6], glow: 0 });
    D.label(ctx, "INDUSTRIAL TAX BASE", gx + 8, gy + 50, { color: GER, alpha: fa, size: 11 });
    D.label(ctx, "DEFENSE PLEDGE · FIXED", gx + gw, gy + gh - 0.48 * gh - 12, { color: C.cyan, alpha: fa, size: 11, align: "right" });
    D.label(ctx, "FUNDING GAP", gx + gw - 10, gy + gh - 0.38 * gh + 40, { color: C.crimson, alpha: prog(t, tFin + 3, 0.5), size: 11, align: "right" });
    // the loop
    const la = prog(t, tLoop, 0.8);
    const lc = [520, 820];
    const nodes = [["SECURITY TAX", -Math.PI / 2], ["INDUSTRIAL SURPLUS ↓", Math.PI / 6], ["CAPACITY TO PAY ↓", (5 * Math.PI) / 6]];
    for (let i = 0; i < 3; i++) {
      const a0 = nodes[i][1] + 0.4;
      let a1 = nodes[(i + 1) % 3][1] - 0.4;
      if (a1 < a0) a1 += Math.PI * 2;
      const pts = Array.from({ length: 25 }, (_, k) => [lc[0] + Math.cos(lerp(a0, a1, k / 24)) * 130, lc[1] + Math.sin(lerp(a0, a1, k / 24)) * 110]);
      D.arrow(ctx, pts, { color: C.crimson, width: 2.5, head: 12, alpha: la, to: prog(t, tLoop + 0.5 + i * 0.5, 0.6) });
    }
    nodes.forEach(([n, a], i) => D.label(ctx, n, lc[0] + Math.cos(a) * 175, lc[1] + Math.sin(a) * 140 + 5, { align: "center", color: C.ice, alpha: prog(t, tLoop + i * 0.5, 0.5), size: 12 }));
    D.label(ctx, "FEEDBACK LOOP", lc[0], lc[1] + 5, { align: "center", color: C.green, alpha: la, size: 13, weight: 600 });
    // past the cross: loyalty vs capacity
    const ca = prog(t, tCross, 0.6);
    const cx = 1100;
    const cy = 700;
    D.axes(ctx, cx, cy, 640, 230, { alpha: ca });
    const loyal = Array.from({ length: 21 }, (_, i) => [i / 20, 0.25 + 0.6 * (i / 20)]);
    const capac = Array.from({ length: 21 }, (_, i) => [i / 20, 0.85 - 0.6 * (i / 20)]);
    const cp = prog(t, tCross + 0.2, 2.5);
    D.series(ctx, cx, cy, 640, 230, loyal, { color: C.cyan, width: 2.5, p: cp, alpha: ca * (1 - prog(t, tChoose, 0.8) * 0.6), glow: 6 });
    D.series(ctx, cx, cy, 640, 230, capac, { color: GER, width: prog(t, tChoose, 0.6) * 3 + 2.5, p: cp, alpha: ca, glow: 6 + 10 * prog(t, tChoose, 0.6) });
    D.label(ctx, "LOYALTY", cx + 650, cy + 30, { color: C.cyan, alpha: ca, size: 11 });
    D.label(ctx, "CAPACITY", cx + 650, cy + 200, { color: GER, alpha: ca, size: 11 });
    D.stroke(ctx, [[cx + 320, cy], [cx + 320, cy + 230]], { color: C.mid, width: 1, dash: [4, 4], alpha: ca });
    D.label(ctx, "THRESHOLD", cx + 320, cy - 8, { align: "center", color: C.mid, alpha: ca, size: 10 });
    K.chip(ctx, "THE STATE CHOOSES CAPACITY", cx + 640, cy + 290, { color: GER, align: "right", alpha: prog(t, tChoose, 0.5), size: 14 });
  };
}

// ================================================================ 8. a crossing nobody announces
function s8(S) {
  const tCal = 0.2;
  const tPV = S.at("Call it");
  const tNone = S.at("No one");
  const tEx = S.at("It appears");
  const tPattern = S.at("Mearsheimer would");
  const tHedge = S.at("The hedge");
  const exceptions = [
    ["LICENSING QUESTION", "DEFAULT ANSWER CHANGED", 0.02],
    ["GAS CONTRACT", "LONG-TERM · NON-ALLIED · VIA BROKER", 0.24],
    ["SANCTIONS PACKAGE", "REFUSED · AUTO EXPORT LANE", 0.52],
    ["EUROZONE", "INDUSTRIAL SURVIVAL = EUROPEAN INTEREST", 0.78],
  ];
  return (ctx, t) => {
    D.bg(ctx, { gridAlpha: 0.2 });
    // calendar: four quarters, no holiday marked
    const ca = prog(t, tCal, 0.6);
    D.label(ctx, "20XX · NO PUBLIC HOLIDAY MARKED", 120, 170, { color: C.mid, alpha: ca, size: 12 });
    const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
    const cross = 2;
    months.forEach((m, i) => {
      const q = Math.floor(i / 3);
      const x = 120 + i * 140;
      const hl = q === cross ? prog(t, tPV + 3, 1) : 0;
      ctx.save();
      ctx.globalAlpha = ca;
      ctx.fillStyle = rgba(hl > 0 ? C.amber : C.mid, 0.06 + 0.12 * hl);
      ctx.strokeStyle = rgba(hl > 0 ? C.amber : C.mid, 0.3 + 0.4 * hl);
      ctx.fillRect(x, 190, 128, 120);
      ctx.strokeRect(x, 190, 128, 120);
      ctx.restore();
      D.text(ctx, m, x + 12, 218, { kind: "mono", size: 13, color: C.mid, alpha: ca });
      for (let d = 0; d < 20; d++) {
        ctx.save();
        ctx.globalAlpha = ca * 0.35;
        ctx.fillStyle = C.mid;
        ctx.fillRect(x + 12 + (d % 7) * 16, 236 + Math.floor(d / 7) * 18, 8, 8);
        ctx.restore();
      }
      if (i % 3 === 0) D.text(ctx, `Q${q + 1}`, x, 340, { kind: "mono", size: 14, color: hl > 0 ? C.amber : C.dim, alpha: ca });
    });
    // present values crossing
    const pa = prog(t, tPV, 0.6);
    const gx = 120;
    const gy = 400;
    const gw = 1680;
    const gh = 230;
    D.axes(ctx, gx, gy, gw, gh, { alpha: pa });
    const lost = Array.from({ length: 41 }, (_, i) => [i / 40, 0.12 + 0.75 * Math.pow(i / 40, 1.4)]);
    const prot = Array.from({ length: 41 }, (_, i) => [i / 40, 0.55 - 0.05 * (i / 40)]);
    const p = prog(t, tPV + 0.3, 3);
    D.series(ctx, gx, gy, gw, gh, prot, { color: C.cyan, width: 3, p, alpha: pa, glow: 6 });
    D.series(ctx, gx, gy, gw, gh, lost, { color: GER, width: 3, p, alpha: pa, glow: 6 });
    D.label(ctx, "PV · LOST CHEMICAL, GLASS, METAL, MACHINE-TOOL CAPACITY", gx + 10, gy + gh + 26, { color: GER, alpha: pa, size: 11 });
    D.label(ctx, "PV · PROTECTION IN THE AMERICAN UMBRELLA", gx + 10, gy + gh - 0.55 * gh - 14, { color: C.cyan, alpha: pa, size: 11 });
    const xc = gx + 0.62 * gw;
    D.stroke(ctx, [[xc, 340], [xc, gy + gh]], { color: C.amber, width: 1.5, dash: [5, 5], alpha: prog(t, tPV + 3, 0.8) });
    K.chip(ctx, "THE CROSSING · A QUARTER, NOT A DAY", xc, gy - 14, { color: C.amber, align: "center", alpha: prog(t, tPV + 3.3, 0.6), size: 13 });
    K.chip(ctx, "NO ONE ANNOUNCES IT", gx + gw, gy - 14, { color: C.mid, align: "right", alpha: prog(t, tNone, 0.5), size: 13 });
    // exceptions, small and technical
    exceptions.forEach(([h, s, f], i) => {
      const a = prog(t, tEx + f * (S.end("It appears") - S.start("It appears")), 0.5);
      const x = 120 + i * 430;
      D.panel(ctx, x, 700, 400, 120, { alpha: a, fill: rgba("#10161e", 0.95), color: GER, sfx: h });
      D.text(ctx, h, x + 20, 742, { size: 18, weight: 600, tracking: 3, alpha: a });
      D.para(ctx, s, x + 20, 772, 360, { kind: "mono", size: 12, color: C.mid, alpha: a, caps: true });
    });
    K.chip(ctx, "STATES DO NOT ADVERTISE THE MOMENT THEY BEGIN TO HEDGE A PATRON", 120, 880, { color: C.mid, alpha: prog(t, tPattern, 0.6), size: 13 });
    D.caption(ctx, "The hedge is assembled from exceptions", t, tHedge, { y: 990 });
  };
}

// ================================================================ 9. the eurozone multiplier
function s9(S) {
  const core = [760, 560];
  const peers = [
    ["ITALY", [1180, 330], "PRODUCTS · GERMAN INPUTS INSIDE"],
    ["FRANCE", [1240, 560], "NUCLEAR-HEAVY POWER"],
    ["CENTRAL EUROPE", [1180, 790], "SUPPLY CHAINS"],
  ];
  const tParts = S.at("German intermediates");
  const tHollow = S.at("A hollowed");
  const tFrance = S.at("France, with");
  const tComm = S.at("The Commission");
  const tSpeed = S.at("Berlin therefore");
  const tCcy = S.at("Currency follows");
  return (ctx, t) => {
    D.bg(ctx, { gridAlpha: 0.2 });
    // exploded diagram: German intermediates inside peers' products
    const hollow = prog(t, tHollow, 1.2);
    const r = 110;
    ctx.save();
    ctx.globalAlpha = prog(t, 0.2, 0.6);
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3 + Math.PI / 6;
      ctx[i ? "lineTo" : "moveTo"](core[0] + Math.cos(a) * r, core[1] + Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fillStyle = rgba(GER, 0.3 * (1 - hollow));
    ctx.fill();
    ctx.strokeStyle = GER;
    ctx.lineWidth = 2.5;
    ctx.setLineDash(hollow > 0.5 ? [8, 6] : []);
    ctx.stroke();
    ctx.restore();
    D.text(ctx, hollow > 0.5 ? "HOLLOWED CORE" : "GERMAN CORE", core[0], core[1] + 8, { size: 17, weight: 600, tracking: 4, align: "center", color: GER, alpha: prog(t, 0.2, 0.6) });
    peers.forEach(([n, p, sub], i) => {
      const a = prog(t, tParts + i * 0.6, 0.6);
      const isFr = n === "FRANCE";
      K.boxNode(ctx, p[0], p[1], 300, 96, n, { color: isFr ? C.steel : C.ice, sub, alpha: a, titleSize: 20 });
      // components flow from core into products
      for (let k = 0; k < 3; k++) {
        const pts = D.arcPts([core[0] + 90, core[1] + (k - 1) * 30], [p[0] - 155, p[1] + (k - 1) * 18], 0.08 * (k - 1), 20);
        D.stroke(ctx, pts, { color: GER, width: 1.5, alpha: a * 0.6 * (1 - hollow * 0.6), to: prog(t, tParts + i * 0.6 + 0.4, 0.8) });
        if (!isFr || k === 0) K.flow(ctx, pts, t + k, { color: GER, n: 2, speed: 0.25, size: 3, alpha: a * (1 - hollow) });
      }
    });
    // fiscal event ripples (France stays still)
    if (hollow > 0) {
      for (let k = 0; k < 3; k++) {
        const ph = (((t - tHollow) * 0.5 + k / 3) % 1 + 1) % 1;
        ctx.save();
        ctx.globalAlpha = (1 - ph) * 0.5 * hollow;
        ctx.strokeStyle = C.crimson;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(core[0], core[1], 120 + ph * 520, -0.9, 0.9);
        ctx.stroke();
        ctx.restore();
      }
      K.chip(ctx, "A FISCAL EVENT FOR THE CURRENCY UNION", core[0], core[1] + 190, { color: C.crimson, align: "center", alpha: prog(t, tHollow + 1, 0.6), size: 13 });
    }
    K.chip(ctx, "STABLE · WILL NOT LEAD", 1240, 640, { color: C.steel, align: "center", alpha: prog(t, tFrance + 1, 0.5), size: 12 });
    // Commission node beside the American file
    const ca = prog(t, tComm, 0.6);
    D.node(ctx, 360, 300, 18, C.violet, { alpha: ca, glow: 16 });
    D.label(ctx, "COMMISSION", 360, 260, { align: "center", color: C.violet, alpha: ca, size: 13, weight: 600 });
    D.node(ctx, 540, 300, 12, C.cyan, { alpha: ca, glow: 14 });
    D.stroke(ctx, [[380, 300], [526, 300]], { color: C.mid, width: 1, dash: [3, 4], alpha: ca });
    D.label(ctx, "AMERICAN FILE", 540, 340, { align: "center", color: C.cyan, alpha: ca, size: 11 });
    D.label(ctx, "RULE CONSISTENCY", 360, 340, { align: "center", color: C.mid, alpha: ca, size: 10 });
    // two speeds
    const sa = prog(t, tSpeed, 0.6);
    const sp = Math.max(0, t - tSpeed);
    D.text(ctx, "BRUSSELS · SPEECH", 140, 870, { kind: "mono", size: 13, color: C.violet, alpha: sa });
    D.hbar(ctx, 140, 880, 560, 18, C.violet, { p: clamp(sp * 0.03), alpha: sa });
    D.text(ctx, "BERLIN · PERMISSIONS", 140, 930, { kind: "mono", size: 13, color: GER, alpha: sa });
    D.hbar(ctx, 140, 940, 560, 18, GER, { p: clamp(sp * 0.09), alpha: sa });
    const gapA = prog(t, tSpeed + 3, 0.6);
    D.label(ctx, "THE GAP = THE WIDTH OF THE PIVOT", 140, 990, { color: C.ice, alpha: gapA, size: 12 });
    // currency follows the same gap
    const ya = prog(t, tCcy, 0.6);
    const pc = [1640, 870];
    const peel = prog(t, S.at("Trade that"), 2.5, ease.inOut);
    ctx.save();
    ctx.globalAlpha = ya;
    ctx.fillStyle = rgba(C.cyan, 0.4);
    ctx.beginPath();
    ctx.moveTo(pc[0], pc[1]);
    ctx.arc(pc[0], pc[1], 100, -Math.PI / 2 + 0.6, Math.PI * 1.5);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = rgba(GER, 0.7);
    ctx.beginPath();
    const off = 26 * peel;
    ctx.moveTo(pc[0] + off * 0.5, pc[1] - off);
    ctx.arc(pc[0] + off * 0.5, pc[1] - off, 100, -Math.PI / 2, -Math.PI / 2 + 0.6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    D.label(ctx, "DOLLAR GATE", pc[0] - 120, pc[1] + 110, { color: C.cyan, alpha: ya, size: 11 });
    D.label(ctx, "EUR INVOICING · BILATERAL NETTING", pc[0] + 30, pc[1] - 140, { color: GER, alpha: prog(t, S.at("Trade that"), 0.6), size: 11, align: "center" });
  };
}

// ================================================================ 10. the molecule without romance
function s10(S) {
  const sup = [
    ["RUSSIAN PIPE", 0.32, 0.18, RU],
    ["NORWEGIAN PIPE", 0.22, 0.3, C.steel],
    ["DOMESTIC + DUTCH", 0.08, 0.36, C.steel],
    ["U.S. LNG", 0.16, 0.55, C.cyan],
    ["QATAR LNG", 0.1, 0.62, C.steel],
    ["SPOT LNG", 0.12, 0.82, C.steel],
  ];
  const tCurve = S.at("The Siberian");
  const tPrice = S.at("It requires");
  const tRenew = S.at("A renewed");
  const tRisk = S.at("It also");
  const tPerm = S.at("Offensive realism");
  const tInst = S.at("The institutional");
  const tReal = S.at("The realist");
  return (ctx, t) => {
    D.bg(ctx, { gridAlpha: 0.2 });
    // cost curve (merit order)
    const gx = 140;
    const gy = 200;
    const gw = 1000;
    const gh = 420;
    const ca = prog(t, 0.4, 0.6);
    D.axes(ctx, gx, gy, gw, gh, { alpha: ca, ticks: 3 });
    D.label(ctx, "SUPPLY COST CURVE INTO CENTRAL EUROPE · ILLUSTRATIVE", gx, gy - 20, { color: C.mid, alpha: ca, size: 12 });
    D.label(ctx, "VOLUME →", gx + gw, gy + gh + 28, { color: C.dim, alpha: ca, size: 11, align: "right" });
    D.label(ctx, "COST ↑", gx - 12, gy + 10, { color: C.dim, alpha: ca, size: 11, align: "right" });
    let x = gx;
    const renew = prog(t, tRenew, 1.5);
    sup.forEach(([n, w, c, col], i) => {
      const a = prog(t, tCurve + i * 0.5, 0.5);
      const bw = w * gw;
      const bh = c * gh;
      const isRu = i === 0;
      ctx.save();
      ctx.globalAlpha = a * (isRu ? 0.45 + 0.55 * Math.max(renew, t < tRenew ? 1 - prog(t, tCurve + 4, 0.6) * 0.5 : 0) : 1);
      ctx.fillStyle = rgba(col, isRu ? 0.6 : 0.3);
      ctx.strokeStyle = col;
      ctx.lineWidth = 1.5;
      ctx.fillRect(x, gy + gh - bh, bw - 4, bh);
      ctx.strokeRect(x, gy + gh - bh, bw - 4, bh);
      ctx.restore();
      D.para(ctx, n, x + 8, gy + gh - bh - 34, bw - 12, { kind: "mono", size: 11, color: isRu ? "#f0a0a6" : C.mid, alpha: a, caps: true, lineHeight: 1.2 });
      x += bw;
    });
    K.chip(ctx, "LOWEST-COST LARGE PIPED SUPPLY · IF THE PIPES EXIST", gx, gy + gh + 70, { color: "#f0a0a6", alpha: prog(t, tCurve + 1, 0.5), size: 12 });
    // a price and a reliability number
    const pa = prog(t, tPrice, 0.6);
    D.panel(ctx, 1220, 200, 560, 140, { alpha: pa, fill: rgba("#0b0e13", 0.92), title: "What the model requires" });
    D.text(ctx, "PRICE", 1250, 300, { size: 26, weight: 600, tracking: 5, alpha: pa });
    D.text(ctx, "+", 1400, 300, { size: 26, color: C.mid, alpha: pa });
    D.text(ctx, "RELIABILITY", 1440, 300, { size: 26, weight: 600, tracking: 5, alpha: pa });
    K.chip(ctx, "NOT AFFECTION", 1780, 380, { color: C.mid, align: "right", alpha: prog(t, S.at("Germany's model"), 0.5), size: 12 });
    K.chip(ctx, "A PARTIAL FLOW · ANY ROUTE · UNIT COST FALLS AT ONCE", 1220, 440, { color: C.ice, alpha: renew, size: 12 });
    // permanent valve risk: a standing red flag on the eastern block
    const ra = prog(t, tRisk, 0.6);
    flag(ctx, gx + 0.16 * gw, gy + gh - 0.18 * gh - 80, 50, C.crimson, ra, t * 2);
    D.label(ctx, "VALVE RISK", gx + 0.16 * gw - 30, gy + gh - 0.18 * gh - 160, { color: C.crimson, alpha: ra, size: 13, weight: 600 });
    D.label(ctx, "PERMANENT · INTENTIONS STAY UNKNOWN", gx + 0.16 * gw - 30, gy + gh - 0.18 * gh - 140, { color: C.crimson, alpha: prog(t, tPerm, 0.5), size: 11 });
    // two answer sheets
    const sheet = (x, title, items, col, a, stampTxt, t0) => {
      D.panel(ctx, x, 730, 780, 290, { alpha: a, title, fill: rgba("#10161e", 0.96), color: col, titleColor: col });
      items.forEach((it, i) => D.text(ctx, it, x + 30, 815 + i * 56, { size: 22, weight: 600, tracking: 3, alpha: a * (stampTxt ? 0.5 : 1) }));
      if (stampTxt) D.stamp(ctx, stampTxt, x + 560, 890, t, t0, { color: C.mid, size: 30, angle: -0.1 });
    };
    sheet(140, "Institutional answer", ["STORAGE MANDATES", "A DIVERSE CONTRACT BOOK", "NO SINGLE SUPPLIER AS A VETO"], C.violet, prog(t, tInst, 0.6), "ABANDONED", tInst + 3);
    const ra2 = prog(t, tReal, 0.6);
    sheet(1000, "Realist answer · now", ["ALLIED GAS = BASE LOAD", "EASTERN MOLECULE = THE MARGIN", ""], C.ice, ra2, null, 0);
    if (ra2 > 0) {
      const tp = prog(t, tReal + 4, 0.5);
      K.chip(ctx, "U.S. · POWER", 1030, 960, { color: C.cyan, alpha: tp, size: 15 });
      K.chip(ctx, "RUSSIA · POWER", 1220, 960, { color: "#f0a0a6", alpha: tp, size: 15 });
      D.label(ctx, "NOT FRIENDS", 1440, 955, { color: C.mid, alpha: prog(t, tReal + 5, 0.5), size: 13 });
    }
  };
}

// ================================================================ 11. the export hinge
function s11(S) {
  const tLose = S.at("A Germany that loses");
  const tKeep = S.at("A Germany that keeps");
  const tPrec = S.at("The disappointment");
  const tMil = S.at("Controls aimed at genuine");
  const tInd = S.at("Controls aimed at the");
  const tSachs = S.at("Sachs would");
  const tMear = S.at("Mearsheimer would");
  return Object.assign((ctx, t) => {
    D.bg(ctx, { gridAlpha: 0.2 });
    // dual loss
    const la = prog(t, tLose, 0.6);
    D.text(ctx, "CHINA · THE EXPORT HINGE", 960, 380, { size: 26, weight: 600, tracking: 6, align: "center", alpha: fade(t, 0.5, 0.6, tMil - 1.6, 0.6) });
    D.panel(ctx, 120, 160, 520, 380, { alpha: Math.max(la, prog(t, 0.3, 0.6)), title: "Lose China + pay the energy premium", fill: rgba("#0b0e13", 0.92), color: C.crimson, titleColor: C.crimson });
    for (const [x, lab, k] of [[260, "CHINESE MARKET", 0], [500, "U.S. ENERGY PREMIUM", 1]]) {
      const p = prog(t, tLose + 0.4 + k * 0.6, 1, ease.out);
      D.arrow(ctx, [[x, 250], [x, 250 + 180 * p]], { color: C.crimson, width: 10, head: 26, alpha: la });
      D.label(ctx, lab, x, 480, { align: "center", color: C.ice, alpha: la, size: 11 });
    }
    D.text(ctx, "LOSES TWICE", 380, 525, { size: 22, weight: 600, tracking: 6, align: "center", color: C.crimson, alpha: prog(t, tLose + 2, 0.5) });
    // keep China: a narrow disappointment
    const ka = prog(t, tKeep, 0.6);
    D.panel(ctx, 1280, 160, 520, 380, { alpha: Math.max(ka, prog(t, 0.6, 0.6)), title: "Keep the Chinese market", fill: rgba("#0b0e13", 0.92), color: GER, titleColor: GER });
    D.text(ctx, "DISAPPOINT WASHINGTON", 1310, 300, { size: 24, weight: 600, tracking: 3, alpha: ka });
    D.text(ctx, "ON THE MARGIN OF TECHNOLOGY", 1310, 340, { kind: "mono", size: 13, color: C.mid, alpha: ka });
    D.text(ctx, "AND INVESTMENT CONTROLS", 1310, 362, { kind: "mono", size: 13, color: C.mid, alpha: ka });
    K.chip(ctx, "EXPLAINED AS PRECISION", 1310, 460, { color: C.ice, alpha: prog(t, tPrec, 0.5), size: 14 });
    // the filter
    const fa = prog(t, tMil - 0.8, 0.6);
    const fx = 960;
    ctx.save();
    ctx.globalAlpha = fa;
    ctx.strokeStyle = C.ice;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(fx - 200, 220);
    ctx.lineTo(fx - 40, 420);
    ctx.lineTo(fx - 40, 520);
    ctx.moveTo(fx + 200, 220);
    ctx.lineTo(fx + 40, 420);
    ctx.lineTo(fx + 40, 520);
    ctx.stroke();
    ctx.restore();
    D.label(ctx, "CONTROLS · SORTED", fx, 200, { align: "center", color: C.ice, alpha: fa, size: 13 });
    // military tech: blocked, stays (blue)
    const ma = prog(t, tMil, 0.6);
    const mp = prog(t, tMil, 1.4, ease.inOut);
    D.square(ctx, lerp(fx - 120, fx - 260, mp), lerp(260, 640, mp), 26, C.cyan, { alpha: ma, glow: 16 });
    D.panel(ctx, fx - 420, 620, 320, 110, { alpha: ma, color: C.cyan, fill: rgba(C.cyan, 0.08), sfx: "Military technology" });
    D.text(ctx, "MILITARY TECHNOLOGY", fx - 400, 668, { size: 18, weight: 600, tracking: 2, color: C.cyan, alpha: ma });
    D.text(ctx, "STAYS BLOCKED", fx - 400, 700, { kind: "mono", size: 13, color: C.cyan, alpha: ma });
    // broad industrial: passes, sanded down
    const ia = prog(t, tInd, 0.6);
    const ip = prog(t, tInd, 1.6, ease.inOut);
    const sizeK = lerp(46, 22, prog(t, tInd + 1, 3));
    D.square(ctx, lerp(fx + 120, fx, ip < 0.5 ? ip * 2 : 1), ip < 0.5 ? lerp(260, 470, ip * 2) : lerp(470, 680, (ip - 0.5) * 2), sizeK, GER, { alpha: ia, glow: 12 });
    D.panel(ctx, fx + 100, 620, 340, 150, { alpha: ia, color: GER, fill: rgba(GER, 0.06), sfx: "Broad industrial relationship" });
    D.text(ctx, "BROAD INDUSTRIAL RELATIONSHIP", fx + 120, 664, { size: 17, weight: 600, tracking: 2, color: GER, alpha: ia, maxWidth: 300 });
    ["DELAYED", "NARROWED", "INTERPRETED DOWN"].forEach((n, i) => D.text(ctx, `· ${n}`, fx + 120, 698 + i * 22, { kind: "mono", size: 13, color: C.mid, alpha: prog(t, tInd + 1 + i * 0.8, 0.4) }));
    K.chip(ctx, "A SECURITY ARGUMENT IT CANNOT WIN IN PUBLIC", fx, 820, { color: C.mid, align: "center", alpha: prog(t, S.at("This is"), 0.5), size: 13 });
    // both labels together
    const sa = prog(t, tSachs, 0.6);
    const ma2 = prog(t, tMear, 0.6);
    D.panel(ctx, 120, 880, 820, 110, { alpha: sa, color: C.violet, fill: rgba(C.violet, 0.06), sfx: "Hub overreach" });
    D.text(ctx, "SACHS", 150, 924, { kind: "mono", size: 13, color: C.violet, alpha: sa });
    D.text(ctx, "HUB OVERREACH", 150, 966, { size: 30, weight: 600, tracking: 6, alpha: sa });
    D.panel(ctx, 980, 880, 820, 110, { alpha: ma2, color: "#dfe7ef", fill: rgba("#dfe7ef", 0.04), sfx: "Relative-power maintenance" });
    D.text(ctx, "MEARSHEIMER", 1010, 924, { kind: "mono", size: 13, color: C.mid, alpha: ma2 });
    D.text(ctx, "RELATIVE-POWER MAINTENANCE", 1010, 966, { size: 30, weight: 600, tracking: 4, alpha: ma2 });
  }, { noBadges: true });
}

// ================================================================ 12. a European coat on a German frame
function s12(S) {
  const claim = "A CONTINENT WITHOUT A CHEMICAL AND MACHINE BASE IS NOT A DEFENSE BASE — DEFENSE GOODS ARE INDUSTRIAL GOODS.";
  const tCoat = 0.3;
  const tClaim = S.at("The coat is the");
  const tLanes = S.at("The body");
  const tAll = S.at("The alliance");
  const tUmb = S.at("The umbrella remains.");
  const tMono = S.at("The monopoly");
  const lanes = [
    ["ENERGY · WITHOUT A SPEECH", 0.18],
    ["EXPORTS · WITHOUT A FIGHT", 0.42],
    ["PAYMENTS · AVOIDING A DOLLAR GATE", 0.68],
  ];
  return (ctx, t) => {
    D.bg(ctx, { gridAlpha: 0.2 });
    const cx = 560;
    const cy = 560;
    // the German frame (structure)
    const fa = prog(t, tCoat, 0.8);
    ctx.save();
    ctx.globalAlpha = fa;
    ctx.strokeStyle = GER;
    ctx.lineWidth = 3;
    ctx.strokeRect(cx - 150, cy - 220, 300, 440);
    ctx.beginPath();
    for (let i = 1; i < 4; i++) {
      ctx.moveTo(cx - 150, cy - 220 + i * 110);
      ctx.lineTo(cx + 150, cy - 220 + i * 110);
    }
    ctx.moveTo(cx - 150, cy - 220);
    ctx.lineTo(cx + 150, cy + 220);
    ctx.moveTo(cx + 150, cy - 220);
    ctx.lineTo(cx - 150, cy + 220);
    ctx.stroke();
    ctx.restore();
    // the European coat over it
    const coat = prog(t, tCoat + 0.6, 1.2);
    ctx.save();
    ctx.globalAlpha = coat * 0.9;
    ctx.fillStyle = rgba(C.violet, 0.16);
    ctx.strokeStyle = C.violet;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(cx - 70, cy - 250);
    ctx.lineTo(cx - 210, cy - 200);
    ctx.lineTo(cx - 250, cy + 260);
    ctx.lineTo(cx + 250, cy + 260);
    ctx.lineTo(cx + 210, cy - 200);
    ctx.lineTo(cx + 70, cy - 250);
    ctx.lineTo(cx, cy - 150);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx, cy - 150);
    ctx.lineTo(cx, cy + 260);
    ctx.stroke();
    ctx.restore();
    D.text(ctx, "EUROPEAN COAT", cx, cy + 300, { size: 18, weight: 600, tracking: 6, align: "center", color: C.violet, alpha: coat });
    D.text(ctx, "GERMAN FRAME", cx, cy + 326, { kind: "mono", size: 12, align: "center", color: GER, alpha: fa });
    // the claim types itself
    D.para(ctx, claim, 900, 220, 900, { size: 30, weight: 600, tracking: 2, reveal: prog(t, tClaim, Math.max(4, S.end("The coat is the") - S.start("The coat is the")), ease.linear), lineHeight: 1.35 });
    // three exception lanes reopen toward Eurasia (from under the coat)
    lanes.forEach(([n, f], i) => {
      const y = cy - 120 + i * 120;
      const p = prog(t, tLanes + f * (S.end("The body") - S.start("The body")), 1.6);
      const pts = D.smoothPts([[cx + 150, y], [cx + 450, y + 10], [1300, y - 20], [1760, y - 60]], 10);
      D.thread(ctx, pts, t, tLanes + f * (S.end("The body") - S.start("The body")), 1.6, { color: C.amber, width: 3, particles: 6, speed: 0.12, glow: 14 });
      D.label(ctx, n, cx + 470, y - 16, { color: C.amber, alpha: p, size: 13 });
    });
    D.label(ctx, "EURASIA →", 1760, cy - 230, { align: "right", color: C.amber, alpha: prog(t, tLanes + 1, 0.6), size: 13 });
    // alliance flag and umbrella remain
    const aa = prog(t, tAll, 0.5);
    flag(ctx, 1000, 830, 50, C.cyan, aa, t * 2);
    D.label(ctx, "ALLIANCE · REMAINS", 1060, 880, { color: C.cyan, alpha: aa, size: 13 });
    const ua = prog(t, tUmb, 0.5);
    umbrella(ctx, 1380, 800, 50, C.cyan, ua);
    D.label(ctx, "UMBRELLA · REMAINS", 1440, 880, { color: C.cyan, alpha: ua, size: 13 });
    // monopoly over the strategy map does not
    const ma = prog(t, tMono, 0.5);
    D.text(ctx, "MONOPOLY OVER THE STRATEGY MAP", 1000, 960, { size: 26, weight: 600, tracking: 4, alpha: ma, color: C.ice });
    const strike = prog(t, tMono + 1.2, 0.5);
    D.stroke(ctx, [[992, 950], [992 + 640 * strike, 950]], { color: C.crimson, width: 3, alpha: ma });
  };
}

// Spoken line, visual direction, and score mood. scripts/episode-04-*.txt are generated from this.
const STORY = [
  {
    "title": "Two prices",
    "mood": "establish",
    "narration": "Germany's postwar bargain had two prices. Security was priced in Washington. Energy was priced in Siberia. The second price has been deleted. Pipeline gas from Russia is offline. In the state's own sums, losing that gas is a cost shock. When the energy price leaves the equation, the security price stops being a gift and becomes a tax on industry. Berlin's rational question is how much of that tax the factories can pay before they stop being the core.",
    "cue": "[VISUAL: A two-term equation. SECURITY priced as a blue Washington node. ENERGY priced as a pipeline from Siberia. The energy term is deleted with a hard cut. The security term recolors from a gift icon to a tax icon sitting on a German industrial core. The core's output gauge sags.]"
  },
  {
    "title": "The cheap molecule",
    "mood": "history",
    "narration": "Before the break, more than half of Germany's imported gas came from Russia. The molecule was cheap because it moved by pipe, without liquefaction, without a long ocean leg, and without a regasification toll. It fed boilers, and it fed chemistry. In German industry gas is a feedstock as well as a fuel. A nitrogen plant and a specialty-chemical line do not experience a price spike as a household experiences a bill. They experience it as a competitor in the United States or in China who still buys energy at a lower structural cost. The pipelines that carried the Siberian gas were destroyed in twenty twenty-two. Who destroyed them remains contested. The economic fact is not contested. The gas is not flowing, and nothing in current allied policy intends to turn it back on.",
    "cue": "[VISUAL: PRE-BREAK Sankey of German gas imports, more than half from Russia, moving by pipe with three cost steps crossed out: no liquefaction, no ocean leg, no regasification toll. Split end use: boilers and chemical feedstock. A competitor price gap opens versus the United States and China. Then the Baltic pipelines go dark. A small caption: ATTRIBUTION CONTESTED. A larger caption: FLOW IS ZERO.]"
  },
  {
    "title": "The cap",
    "mood": "pressure",
    "narration": "John Mearsheimer looks at this shock through who is stronger. Germany is the country best able to anchor a Europe that stands on its own, which is why other powers spent a century blocking a lasting German-Russian pairing, and why Washington wants Germany dependent on American security. Dependence is useful when plans stay hidden, because you cannot see the other side's intentions. A Germany that can fuel itself from the east and sell machines in every direction is a Germany that can say no. A Germany that must buy expensive allied energy, host allied forces, and clear its exports through sanctions is a Germany whose power is capped. The cap starts to close factories. Survival for a trading state means keeping the factories that make it rich. A security umbrella that arrives together with the loss of industry fails that test, even when the umbrella is real.",
    "cue": "[VISUAL: EUROPEAN POWER RANKING, abstract blocks, Germany the largest industrial block inside the continent. A century-scale inset shows repeated external efforts to prevent a durable German-Russian combination, drawn as blocked corridors, not as a war montage. A cap descends: expensive allied energy, hosted forces, sanctions clearance. Factory icons under the cap switch off one by one. Caption: SURVIVAL FOR A TRADING STATE IS THE PRODUCTIVE BASE.]"
  },
  {
    "title": "Stabilizer, relabelled vice",
    "mood": "fracture",
    "narration": "Jeffrey Sachs reads the same shock as a choice, not a law of nature. Eurasian energy interdependence was a stabilizer that one leading country then relabeled a vice. Sanctions, the cutting of pipeline projects, and the demand that Europe turn toward gas shipped by allies were decisions made in Washington's list of threats. The costs fell on German chemical workers, on suppliers across the eurozone, and on household bills. The gains showed up in American liquefied-gas exports and in a Military-Industrial Complex that received a larger European mission the moment Europe felt exposed. A system that treats allied independence as a risk will keep trading European industry for American comfort. A multipolar institution would have treated Russian gas as a dependence you negotiate, with storage, more suppliers, and contracts.",
    "cue": "[VISUAL: The same pipeline, earlier in time, labeled STABILIZER, then relabeled VICE by a blue institutional stamp. Cost bars fall on German chemical employment, eurozone suppliers, and household bills. Gain bars rise for American liquefied-gas exports and for a larger European mission inside the Military-Industrial Complex. A multipolar alternative sheet shows storage, diversification, and contracts, then is filed and not used.]"
  },
  {
    "title": "The dearer substitute",
    "mood": "system",
    "narration": "The substitute on offer is real, and it costs more by its nature. Seaborne liquefied gas must be cooled, shipped, and warmed again. Terminals on the German coast, built in a hurry, solved the simple absence of the gas. They did not solve the price. Long-term purchases from the United States and from other exporters also carry a political extra charge. A cargo that arrives from an ally can be delayed by that ally's home politics, sent to a higher bidder, or tied to a wider diplomatic ask. Energy security bought in that market is security with a veto attached. Professor Jiang's point is plain: a link you depend on can be used against you. The same state that holds the security umbrella can touch the energy bill. The customer with no second system pays for both.",
    "cue": "[VISUAL: LNG PROCESS, clinical. Cool, ship, warm. Coastal terminals at Wilhelmshaven and the other new German sites light up and solve a physical-absence icon. The price regime stays elevated. A political-premium tag hangs on long-term allied cargoes: delay, redirect, diplomatic ask. Professor Jiang's label appears: WEAPONIZED INTERDEPENDENCE. One state supplies the umbrella and can touch the invoice.]"
  },
  {
    "title": "Three terms",
    "mood": "cold",
    "narration": "Place Berlin's choice in three terms. The first term is the unit cost of energy relative to the United States and to China, the two rivals for the next factory. The second term is export revenue, especially machinery and vehicles sold into the Chinese market, which remains among Germany's largest external demand pools. The third term is the insurance value of American protection, including the nuclear questions Germany has chosen not to answer alone. A quiet pivot is a reweighting of these terms. Formal membership in the alliance can stay. The change is in the constraints Germany will accept on the first two terms in order to keep the third.",
    "cue": "[VISUAL: THREE-TERM DASHBOARD for Berlin. Term one: unit energy cost versus the United States and China. Term two: export revenue, machinery and vehicles, with China among the largest external pools. Term three: insurance value of American protection, including a sealed nuclear file Germany does not open. Weights animate. Formal NATO membership stays a solid blue check. The constraint sliders on terms one and two loosen.]"
  },
  {
    "title": "Documents, not speeches",
    "mood": "motion",
    "narration": "Watch how the reweighting shows up in decisions that look technical. German diplomats resist the widest version of secondary sanctions, the version that would block ordinary industrial sales to China. German executives delay the write-off of chemical capacity and ask which molecule could return quietly. The finance ministry discovers that a shrunken industrial tax base makes the defense spending pledged under alliance pressure harder to fund. Jiang would call this a feedback loop. The security tax reduces the industrial surplus that was supposed to pay the security tax. Past a threshold, loyalty and capacity move in opposite directions. The state then chooses capacity.",
    "cue": "[VISUAL: DOCUMENTS, not speeches. A secondary-sanctions draft aimed at ordinary industrial sales to China is narrowed by a German pen. A chemical-capacity write-off is postponed. A finance-ministry chart shows the industrial tax base shrinking while a defense-spending pledge stays fixed, the funding gap widening. A loop graphic: security tax reduces the surplus that pays the security tax. Past the cross, the capacity line is chosen.]"
  },
  {
    "title": "The unannounced crossing",
    "mood": "shock",
    "narration": "The threshold has a date only in the model. Call it the quarter when the present value of lost chemical, glass, metal, and machine-tool capacity exceeds the present value of the protection embedded in the American umbrella. No one announces the crossing. It appears as a change in the default answer to a licensing question, as a long-term gas contract written with a non-allied supplier through a broker, as a refusal to fund a sanctions package that would hit the auto export lane, as a quiet argument inside the eurozone that industrial survival is a European interest. Mearsheimer would recognize the pattern. States do not advertise the moment they begin to hedge a patron. The hedge is assembled from exceptions.",
    "cue": "[VISUAL: A calendar with no public holiday marked. The crossing is a quarter, defined as the point where the present value of lost chemical, glass, metal, and machine-tool capacity exceeds the present value of umbrella protection. Manifestations, small and technical: a changed default on a license, a brokered gas contract, a refused sanctions line on the auto lane, a eurozone argument. Caption: THE HEDGE IS ASSEMBLED FROM EXCEPTIONS.]"
  },
  {
    "title": "The eurozone multiplier",
    "mood": "system",
    "narration": "The eurozone is the multiplier. German intermediates sit inside Italian, French, and Central European products. A hollowed German core becomes a fiscal event for the currency union. France, with a nuclear-heavy power system, does not feel the gas deletion in the same organs, and will not lead this pivot. The Commission has a different objective function, closer to rule consistency and to the American file. Berlin therefore moves more slowly in Brussels than in its own licensing offices, and the gap between the European speech and the national permission is the width of the pivot. Currency follows the same gap. Trade that can be invoiced in euros, or netted on a bilateral basis with non-dollar partners, reduces the share of German commerce that a dollar sanction can reach.",
    "cue": "[VISUAL: EUROZONE EXPLODED DIAGRAM. German intermediate goods sit inside Italian, French, and Central European products. A hollow German core propagates as a fiscal event. France's nuclear-heavy power mix stays stable and does not lead. The Commission node stays close to the American file. Two speeds: slow speech in Brussels, faster permissions in Berlin. Euro invoicing and bilateral netting peel a slice of trade off the dollar gate.]"
  },
  {
    "title": "The molecule, without romance",
    "mood": "cold",
    "narration": "Russia's role at the end should be stated without romance. The Siberian gas remains the cheapest large supply that can reach Central Europe by pipe, if the pipes exist and if politics allow. Germany's model does not require loving the supplier. It requires a price and a reliability number. A renewed flow, even a partial one, even on a route that is not the destroyed Baltic lines, changes the cost per unit right away. It also carries the risk that Moscow will use the valve later. Offensive realism says that risk is permanent, because intentions stay unknown. The institutional answer is the one Germany dropped under pressure: required storage, contracts with many suppliers, and a refusal to let any one supplier, east or west, hold a veto. The realist answer now is uglier. Accept a managed dependence on the east for the extra gas, while keeping allied gas as the base, and treat both suppliers as powers rather than friends.",
    "cue": "[VISUAL: SIBERIAN GAS as a cost curve, the lowest large piped supply into Central Europe if a route exists. No romantic imagery, no folk motifs. A valve risk is permanent and drawn as a standing red flag. Two answer sheets: the abandoned institutional sheet, storage plus a diverse book plus no single veto; the current realist sheet, allied gas as base load, a managed eastern molecule at the margin, both suppliers marked POWERS.]"
  },
  {
    "title": "The export hinge",
    "mood": "pressure",
    "narration": "China is the other hinge, and it is about exports. A Germany that loses the Chinese market while paying an American energy premium loses twice. A Germany that keeps the Chinese market must disappoint Washington at the edge of technology and investment controls. The disappointment will be described as precision. Controls aimed at genuine military technology stay. Controls aimed at the broad industrial relationship are worn down, delayed, and read narrowly. This is how a trading state runs a security argument it thinks it cannot win in public. Sachs would call the American pressure the overreach of a center that wants its allies' trade to match its picture of the threat. Mearsheimer would call the German resistance a way of staying strong. Both can be true in the same quarter.",
    "cue": "[VISUAL: DUAL LOSS diagram. Lose the Chinese market while paying an American energy premium: two downward arrows. Keep the Chinese market: a narrow disappointment inside technology controls. A filter sorts controls: military technology stays blocked in blue; the broad industrial relationship is delayed, narrowed, and interpreted down. Sachs label: HUB OVERREACH. Mearsheimer label: RELATIVE-POWER MAINTENANCE. Both labels remain on screen together.]"
  },
  {
    "title": "A European coat",
    "mood": "close",
    "narration": "The day the eurozone chooses industrial survival is a German day wearing a European coat. The coat is the claim that a continent without a chemical and machine base cannot defend itself anyway, because weapons are industrial goods. The body under the coat is a set of exceptions that reopen a commercial lane across Eurasia: energy bought without a speech, exports licensed without a fight, payments that avoid a dollar gate. The alliance remains. The umbrella remains. The monopoly of that umbrella over German strategy does not. When nobody can enforce a promise, that is what a turn looks like if the country is still too exposed to slam a door, and too industrial to keep paying a tax that closes its factories.",
    "cue": "[VISUAL: A European coat on a German frame. The coat's claim types itself: a continent without a chemical and machine base is not a defense base, because defense goods are industrial goods. Under the coat, three exception lanes reopen toward Eurasia: energy without a speech, exports without a fight, payments that avoid a dollar gate. The alliance flag and the umbrella remain. Their monopoly over the strategy map does not. Hold. Cut to black.]"
  }
];

const DRAWS = [s1, s2, s3, s4, s5, s6, s7, s8, s9, s10, s11, s12];
if (DRAWS.length !== STORY.length) throw new Error(`episode 4 draws ${DRAWS.length} vs story ${STORY.length}`);

export default {
  title: "The German Pivot",
  subtitle: "When German industry cannot pay the energy bill",
  short: "The German Pivot",
  scenes: STORY.map((scene, i) => ({ ...scene, draw: DRAWS[i] })),
};
