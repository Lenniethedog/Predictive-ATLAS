// EPISODE 1 — THE DOLLAR TRAP
import { geoMercator, geoNaturalEarth1 } from "d3-geo";
import { C, W, H, clamp, lerp, ease, prog, fade, pulse, rgba, mix, rng } from "../engine/core.mjs";
import * as D from "../engine/draw.mjs";
import { MapView, Globe, P, ID } from "../engine/geo.mjs";
import * as K from "../engine/kit.mjs";

// ---------------------------------------------------------------- shared bits
function barrelMacro(ctx, x, y, s, alpha, t) {
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  const w = s * 0.72;
  const h = s;
  const g = ctx.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
  g.addColorStop(0, "#1a2029");
  g.addColorStop(0.35, "#2b3440");
  g.addColorStop(0.6, "#1d242e");
  g.addColorStop(1, "#0f1318");
  D.roundRect(ctx, x - w / 2, y - h / 2, w, h, s * 0.08);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = rgba(C.ice, 0.75);
  ctx.lineWidth = Math.max(1.5, s * 0.008);
  ctx.stroke();
  ctx.lineWidth = Math.max(1.5, s * 0.012);
  for (const f of [-0.3, 0.3]) {
    ctx.beginPath();
    ctx.moveTo(x - w / 2, y + f * h);
    ctx.lineTo(x + w / 2, y + f * h);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.ellipse(x, y - h / 2 + s * 0.02, w * 0.48, s * 0.025, 0, 0, Math.PI * 2);
  ctx.stroke();
  // bung
  ctx.beginPath();
  ctx.arc(x + w * 0.22, y - h / 2 + s * 0.02, s * 0.018, 0, Math.PI * 2);
  ctx.stroke();
  // sheen
  const sh = ctx.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
  sh.addColorStop(0.28, rgba(C.ice, 0));
  sh.addColorStop(0.36, rgba(C.ice, 0.08 + 0.03 * Math.sin(t)));
  sh.addColorStop(0.44, rgba(C.ice, 0));
  ctx.fillStyle = sh;
  ctx.fillRect(x - w / 2, y - h / 2, w, h);
  ctx.restore();
  if (s > 180) {
    D.text(ctx, "CRUDE · 1 BBL", x, y + s * 0.06, { kind: "mono", size: s * 0.05, color: rgba(C.ice, 0.65), align: "center", tracking: s * 0.008, alpha });
  }
}

function mirrorCrack(ctx, pts, p, o = {}) {
  const { alpha = 1, color = C.ice, width = 2.2, seed = 3 } = o;
  if (p <= 0 || alpha <= 0) return;
  D.stroke(ctx, pts, { color, width, alpha, to: p, glow: 14 });
  const r = rng(seed);
  const n = Math.floor(pts.length * p);
  for (let i = 2; i < n; i += 3) {
    const [x, y] = pts[i];
    const a = r() * Math.PI * 2;
    const L = 14 + r() * 30;
    D.stroke(ctx, [[x, y], [x + Math.cos(a) * L * 0.5, y + Math.sin(a) * L * 0.5 + (r() - 0.5) * 6], [x + Math.cos(a) * L, y + Math.sin(a) * L]], {
      color,
      width: 1,
      alpha: alpha * 0.6,
    });
  }
}

// ================================================================ 1. the mirror
function s1(S) {
  const globe = new Globe({ res: "110m", scale: 400 });
  const buoys = [P.rasTanura, P.juaymah, P.kharg, P.fujairah];
  const ports = [P.shanghai, P.ningbo, P.qingdao, P.guangzhou];
  const tBack = S.at("China finances", 0.02);
  const tGlobe = S.at("China finances", 0.22);
  const tThreads = S.at("China finances", 0.32);
  const tRebound = S.at("China finances", 0.55);
  const tMirror = S.at("This is");
  const tBar = S.at("Beijing's industrial");
  const crack = D.crackPts([1010, 300], [990, 520], 11, 0.08, 10);
  return (ctx, t) => {
    D.bg(ctx, { gridAlpha: 0.5 });
    const pull = prog(t, tBack, tGlobe - tBack + 0.8, ease.inOut);
    const shift = prog(t, tMirror, 2.4);
    const gx = lerp(820, 520, shift);
    const scale = Math.exp(lerp(Math.log(5200), Math.log(370), pull));
    globe.set({ rotate: [lerp(-50, -86, pull) - Math.max(0, t - tGlobe) * 0.25, lerp(-26, -24, pull)], scale, cx: lerp(960, gx, pull), cy: 560 });
    const chinaA = prog(t, tThreads - 0.4, 1.2);
    globe.draw(ctx, { alpha: prog(t, tBack, 1.2), colors: { [ID.china]: rgba(C.crimson, 0.55 * chinaA), [ID.saudi]: rgba(C.ice, 0.12 * chinaA) } });

    // barrel: macro -> marker at the Gulf
    const g = globe.xy(P.rasTanura);
    const bs = lerp(560, 22, ease.inOut(pull));
    const bx = lerp(960, g[0], ease.inOut(pull));
    const by = lerp(560, g[1], ease.inOut(pull));
    barrelMacro(ctx, bx, by, bs, 1 - prog(t, tGlobe + 0.4, 0.8), t);
    K.chip(ctx, "INVOICED IN USD", 960 + 250, 380, { color: C.cyan, alpha: fade(t, S.at("It is"), 0.5, tBack + 0.6, 0.5), size: 22 });

    // invoice threads Gulf -> China
    for (let i = 0; i < buoys.length; i++) {
      const a = globe.xy(buoys[i]);
      D.node(ctx, a[0], a[1], 4, C.ice, { alpha: prog(t, tGlobe, 0.6), glow: 14, ring: false });
      const pts = K.globeArc(globe, buoys[i], ports[i], 0.12);
      D.thread(ctx, pts, t, tThreads + i * 0.16, 1.6, { color: C.ice, width: 1.8, particles: 4, speed: 0.22 });
    }
    for (const p of ports) {
      const q = globe.xy(p);
      D.node(ctx, q[0], q[1], 4.5, C.crimson, { alpha: chinaA, glow: 16, ring: false });
    }
    const gl = globe.xy([50.5, 24]);
    K.place(ctx, gl, "GULF LOADING BUOYS", { alpha: prog(t, tThreads, 0.8) * (1 - shift * 0.5), dx: -14, dy: 26, align: "right", dot: 0 });
    const cl = globe.xy([123.5, 29]);
    K.place(ctx, cl, "CHINESE PORTS", { alpha: chinaA * (1 - shift * 0.5), color: C.ice, dx: 14, dy: 34, dot: 0 });

    // vault + rebound thread
    const vx = lerp(1560, 1330, shift);
    const vy = 470;
    K.vault(ctx, vx, vy, 270, 230, "U.S. TREASURIES", { alpha: prog(t, tRebound - 0.4, 0.8), spin: t * 0.15 });
    const sh = globe.xy(P.shanghai);
    const rb = D.arcPts(sh, [vx - 140, vy + 20], 0.28, 50, -1);
    D.thread(ctx, rb, t, tRebound, 1.8, { color: C.ice, width: 4.5, particles: 7, psize: 3.4, speed: 0.2, glow: 18 });

    // mirror wipe
    const mw = prog(t, tMirror, 1.6, ease.inOut);
    if (mw > 0) {
      const mx = 1000;
      ctx.save();
      ctx.beginPath();
      ctx.rect(mx, 0, (W - mx) * mw, H);
      ctx.clip();
      ctx.fillStyle = rgba("#0a1a24", 0.35);
      ctx.fillRect(mx, 0, W - mx, H);
      ctx.restore();
      K.mirrorPane(ctx, mx - 6, 170, 12, 760, { alpha: mw, sheen: prog(t, tMirror, 3) });
      D.stroke(ctx, [[mx, 170], [mx, 170 + 760 * mw]], { color: C.ice, width: 2, glow: 20, alpha: 0.85 });
      // fiscal capacity bar
      const bp = prog(t, tBar, Math.max(2, S.at("The mirror") - tBar), ease.inOut);
      D.bar(ctx, 1640, 780, 90, 420, C.cyan, { p: bp, alpha: mw, outline: true, glow: 20 });
      D.label(ctx, "WHAT WASHINGTON CAN BORROW", 1685, 822, { align: "center", alpha: mw, color: C.cyan, size: 15 });
      D.label(ctx, "CHINA'S FACTORY SURPLUS", 520, 1000, { align: "center", alpha: mw, color: C.crimson, size: 16 });
      D.label(ctx, "WASHINGTON'S BORROWING POWER", 1460, 1000, { align: "center", alpha: mw, color: C.cyan, size: 16 });
    }
    K.chip(ctx, "THE TRAP HOLDS WHILE THE NEXT BARREL IS BILLED IN DOLLARS", 1000, 150, { align: "center", color: C.ice, alpha: fade(t, S.at("The mirror"), 0.6), size: 16 });
    mirrorCrack(ctx, crack, prog(t, S.at("It breaks."), 0.25, ease.out), { alpha: 0.55, width: 1.5 });
  };
}

// ================================================================ 2. 1971–1975
function s2(S) {
  const view = new MapView(geoMercator().scale(640).translate([W / 2, H / 2]), { res: "50m", bbox: [[-30, -10], [160, 80]] });
  view.setCam(K.camFor(view, [65, 40], 1, 960, 660));
  const importers = [
    [ID.uk, P.london], [ID.france, P.paris], [ID.germany, [7.1, 50.73]], [ID.italy, P.rome], [ID.spain, [-3.7, 40.4]],
    [ID.turkey, [32.86, 39.93]], [ID.india, [77.2, 28.6]], [ID.pakistan, [73.05, 33.7]], [ID.thailand, [100.5, 13.75]],
    [ID.philippines, [121.0, 14.6]], [ID.skorea, P.seoul], [ID.japan, P.tokyo],
  ];
  const years = [1971, 1972, 1973, 1974, 1975];
  const tx0 = 560;
  const tx1 = 1700;
  const ty = 218;
  const yx = (y) => lerp(tx0, tx1, (y - 1971) / 4);
  const tSnap = S.at("In nineteen", 0.6);
  const tFall = S.at("The dollar");
  const tSaudi = S.at("The deal");
  const tImp0 = S.at("Oil would");
  const tImp1 = S.at("Every importer,", 1);
  const events = [
    [1971, "GOLD WINDOW CLOSED", 0],
    [1973, "OIL SHOCK", S.at("It promised")],
    [1974, "U.S.–SAUDI OIL DEAL", S.at("The deal")],
    [1975, "OPEC PRICES IN DOLLARS", S.at("Oil would")],
  ];
  return (ctx, t) => {
    D.bg(ctx, { gridAlpha: 0.4 });
    const saudiA = prog(t, tSaudi, 1);
    const colors = { [ID.saudi]: rgba(C.cyan, 0.35 * saudiA) };
    importers.forEach(([id], i) => {
      const a = prog(t, lerp(tImp0, tImp1, i / importers.length), 0.8);
      colors[id] = mix(C.land, C.cyanDeep, a * 0.75);
    });
    view.base(ctx, { colors, alpha: prog(t, 0, 1) });

    // timeline
    const cur = K.track(t, [[0, 1971], [S.at("The dollar"), 1971.4], [S.at("The deal"), 1974], [S.at("Surpluses would"), 1975]]);
    D.stroke(ctx, [[tx0, ty], [tx1, ty]], { color: C.dim, width: 1.5 });
    for (const y of years) {
      const x = yx(y);
      const on = cur >= y - 0.05;
      D.stroke(ctx, [[x, ty - 8], [x, ty + 8]], { color: on ? C.ice : C.dim, width: 1.5 });
      D.text(ctx, String(y), x, ty - 22, { kind: "mono", size: 18, color: on ? C.ice : C.dim, align: "center" });
    }
    D.stroke(ctx, [[tx0, ty], [yx(cur), ty]], { color: C.cyan, width: 3, glow: 10 });
    D.node(ctx, yx(cur), ty, 6, C.cyan, { ring: false });
    for (const [y, lab, at] of events) D.label(ctx, lab, yx(y), ty + 38, { align: "center", alpha: prog(t, at, 0.6), color: C.mid, size: 13 });

    // gold peg
    const gx = 220;
    const gy = 218;
    const snapped = t >= tSnap;
    const fallT = Math.max(0, t - tFall);
    const fy = gy + 0.5 * 900 * fallT * fallT;
    const rot = fallT * 1.6;
    if (fy < H + 80) {
      ctx.save();
      ctx.translate(gx, fy);
      ctx.rotate(rot);
      ctx.fillStyle = C.gold;
      ctx.shadowColor = C.gold;
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.moveTo(-46, 18);
      ctx.lineTo(46, 18);
      ctx.lineTo(32, -18);
      ctx.lineTo(-32, -18);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      D.text(ctx, "GOLD", gx, fy + 7, { kind: "mono", size: 15, weight: 600, color: "#3a2a00", align: "center", alpha: fallT > 0 ? 0 : 1 });
    }
    K.dollar(ctx, 420, gy, 30, { color: C.cyan, alpha: 1 });
    if (!snapped) {
      D.stroke(ctx, [[gx + 48, gy], [390, gy]], { color: C.gold, width: 3 });
      D.label(ctx, "$35 / OZ", 320, gy - 16, { align: "center", color: C.gold, size: 13 });
    } else {
      const k = prog(t, tSnap, 0.5, ease.out) * 22;
      D.stroke(ctx, [[gx + 48, fy], [300 - k, fy - k * 0.4]], { color: C.gold, width: 3, alpha: 1 - prog(t, tFall, 0.8) });
      D.stroke(ctx, [[322 + k, gy + k * 0.3], [390, gy]], { color: C.gold, width: 3, alpha: 1 - prog(t, tFall + 0.6, 1) });
    }
    D.label(ctx, "PEG", 320, gy + 34, { align: "center", size: 12, color: C.dim, alpha: 1 - prog(t, tSnap, 0.4) });

    // Saudi terminals lock to the dollar glyph
    const riy = view.xy(P.riyadh);
    const dg = [riy[0] - 20, riy[1] - 120];
    K.dollar(ctx, dg[0], dg[1], 34 * (1 + 0.3 * (1 - prog(t, tSaudi + 0.9, 0.4, ease.out))), { color: C.cyan, alpha: saudiA, glow: 26 });
    for (const [i, tp] of [P.rasTanura, P.juaymah, P.yanbu].entries()) {
      const a = view.xy(tp);
      D.node(ctx, a[0], a[1], 4.5, C.ice, { alpha: saudiA, ring: false, glow: 12 });
      D.stroke(ctx, [a, [dg[0] + (i - 1) * 10, dg[1] + 32]], { color: C.cyan, width: 1.6, to: prog(t, tSaudi + 0.2 + i * 0.15, 0.6), alpha: 0.9 });
    }
    D.label(ctx, "SAUDI LOADING TERMINALS", riy[0] + 50, riy[1] + 50, { color: C.cyan, alpha: saudiA, size: 13 });

    // importers flip to dollar settlement
    importers.forEach(([, ll], i) => {
      const a0 = lerp(tImp0, tImp1, i / importers.length);
      const p = view.xy(ll);
      D.stroke(ctx, D.arcPts(dg, p, 0.18, 30), { color: C.cyan, width: 1.1, to: prog(t, a0, 0.9), alpha: 0.55 });
      D.diamond(ctx, p[0], p[1], 5, C.cyan, { alpha: prog(t, a0 + 0.6, 0.4) });
    });
    const settled = importers.filter((_, i) => t > lerp(tImp0, tImp1, i / importers.length) + 0.6).length;
    D.label(ctx, `IMPORTER CONTRACTS SETTLED IN USD  ${String(settled).padStart(2, "0")} / ${importers.length}`, 1780, 330, { align: "right", color: C.cyan, alpha: prog(t, tImp0, 0.6), size: 14 });

    D.caption(ctx, "The oil bill keeps the dollar on top", t, S.at("The leading"), { y: 1000 });
  };
}

// ================================================================ 3. the hub circuit
function s3(S) {
  const cx = 960;
  const cy = 560;
  const R = 250;
  const nodes = [
    { a: -Math.PI / 2, name: "PENTAGON PROCUREMENT" },
    { a: Math.PI / 2 + Math.PI / 3, name: "TREASURY ISSUANCE" },
    { a: Math.PI / 2 - Math.PI / 3, name: "GULF RECYCLING" },
  ].map((n) => ({ ...n, x: cx + Math.cos(n.a) * R, y: cy + Math.sin(n.a) * R }));
  const loop = [];
  for (let i = 0; i <= 120; i++) {
    const a = -Math.PI / 2 + (i / 120) * Math.PI * 2;
    loop.push([cx + Math.cos(a) * R, cy + Math.sin(a) * R]);
  }
  const edge = [
    [230, 290, "A SHARED WORLD MONEY"],
    [1690, 290, "A 1944 ALTERNATIVE"],
    [230, 800, "A PLAN TO SWAP OUT DOLLARS"],
    [1690, 800, "REGIONAL MONEY POOLS"],
  ];
  const tLoop = S.at("The financial");
  const tDef = S.at("Deficits could");
  const tGray = S.at("The hub's", 0.15);
  const tWeapon = S.at("The hub's", 0.7);
  return (ctx, t) => {
    D.bg(ctx, { gridAlpha: 0.35 });
    // edge institutions desaturate to gray
    const gray = prog(t, tGray, 2.2);
    edge.forEach(([x, y, name], i) => {
      const col = mix(i % 2 ? C.amber : C.violet, C.steelDeep, gray);
      const a = prog(t, 0.3 + i * 0.2, 0.8) * (1 - gray * 0.45);
      D.stroke(ctx, [[x, y], [lerp(x, cx, 0.42), lerp(y, cy, 0.42)]], { color: col, width: 1.2, dash: [4, 6], alpha: a * 0.7 });
      D.node(ctx, x, y, 9, col, { alpha: a, glow: gray > 0.9 ? 0 : 12 });
      D.label(ctx, name, x, y + (y < 500 ? -26 : 40), { align: "center", color: mix(C.mid, C.steelDeep, gray), alpha: a, size: 14 });
    });
    // loop
    const lp = prog(t, tLoop, 1.6);
    const heavy = prog(t, tWeapon, 1);
    D.stroke(ctx, loop, { color: C.cyan, width: 3 + heavy * 3, to: lp, glow: 16 + heavy * 12, alpha: 0.8 });
    if (lp >= 1) K.flow(ctx, loop, t, { color: C.ice, n: 14, speed: 0.08 + heavy * 0.04, size: 3, glow: 12 });
    // hub
    const ha = prog(t, tLoop + 0.6, 1);
    for (let k = 0; k < 3; k++) {
      const ph = ((t * 0.4 + k / 3) % 1);
      ctx.save();
      ctx.globalAlpha = ha * (1 - ph) * 0.4;
      ctx.strokeStyle = C.cyan;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(cx, cy, 40 + ph * 120, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    D.text(ctx, "HUB", cx, cy + 22, { size: 64, weight: 600, tracking: 18, align: "center", alpha: ha, glow: 20, color: C.ice });
    // nodes
    nodes.forEach((n, i) => {
      const a = prog(t, 0.2 + i * 0.35, 0.8);
      const pul = lp >= 1 ? 1 + 0.18 * Math.max(0, Math.sin((t * 0.08 * Math.PI * 2) - i * (Math.PI * 2) / 3)) : 1;
      D.node(ctx, n.x, n.y, 18 * pul, C.cyan, { alpha: a, glow: 26 });
      const below = n.y > cy;
      D.label(ctx, n.name, n.x, n.y + (below ? 62 : -44), { align: "center", color: C.ice, alpha: a, size: 16, weight: 600 });
      D.square(ctx, n.x + (below ? 0 : 0), n.y + (below ? 82 : -66), 6, C.cyan, { alpha: a * 0.7, glow: 0 });
    });
    // foreigners must hold the paper
    const tr = nodes[1];
    const fp = prog(t, tDef, 1.2);
    for (let k = 0; k < 3; k++) {
      const from = [120, 640 + k * 90];
      const pts = D.arcPts(from, [tr.x - 26, tr.y + 6], -0.12 + k * 0.08, 30);
      D.arrow(ctx, pts, { color: C.ice, width: 1.5, to: fp, head: 10, alpha: 0.6 });
    }
    D.label(ctx, "FOREIGN HOLDERS", 120, 600, { color: C.mid, alpha: fp, size: 14 });
    K.chip(ctx, "DEFICITS FINANCED", tr.x - 30, tr.y + 140, { color: C.cyan, alpha: prog(t, tDef + 1, 0.6), align: "center", size: 14 });
  };
}

// ================================================================ 4. China enters the loop
function s4(S) {
  const view = new MapView(geoMercator().scale(1000).translate([W / 2, H / 2]), { res: "50m", bbox: [[70, 5], [150, 55]] });
  const camA = K.camFor(view, [104, 35], 1.0, 700, 560);
  const camB = K.camFor(view, [117.2, 27.4], 2.9, 640, 560);
  const yangtzeRiver = view.pathOf({ type: "LineString", coordinates: D.smoothPts([[104, 28.8], [106.55, 29.56], [108.4, 30.8], [111.3, 30.7], [112.9, 30], [114.3, 30.6], [115.9, 29.7], [117, 30.5], [118.4, 31.4], [118.8, 32.06], [120.3, 31.9], [121.2, 31.6], [121.9, 31.25]], 8) });
  const pearlRiver = view.pathOf({ type: "LineString", coordinates: D.smoothPts([[108.3, 23.5], [110.3, 23.4], [111.8, 23.2], [112.9, 23.1], [113.3, 22.8], [113.6, 22.3]], 8) });
  const holdings = [[2000, 60], [2002, 118], [2004, 223], [2006, 397], [2008, 727], [2010, 1160], [2012, 1203], [2014, 1244], [2016, 1058], [2018, 1124], [2020, 1072], [2022, 867], [2024, 759]];
  const yangtze = [120.6, 31.35];
  const pearl = [113.6, 22.85];
  const tZoom = 0.2;
  const tWTO = S.at("Joining the");
  const tOut = S.at("The surplus arrived");
  const tCrude = S.at("A rising");
  const tBars = S.at("At each");
  const tDom = S.at("Recycling was");
  return (ctx, t) => {
    D.bg(ctx, { gridAlpha: 0.35 });
    view.setCam(MapView.mixCam(camA, camB, prog(t, tZoom, Math.max(3, tWTO + 1.5 - tZoom))));
    view.base(ctx, { colors: { [ID.china]: rgba(C.crimson, 0.2), [ID.taiwan]: C.landHi } });
    view.draw(ctx, yangtzeRiver, { stroke: rgba(C.ice, 0.28), width: 1.4 });
    view.draw(ctx, pearlRiver, { stroke: rgba(C.ice, 0.28), width: 1.4 });
    const k = view.cam.k;
    const burn = prog(t, tWTO, 1.5);
    const y = view.xy(yangtze);
    const pr = view.xy(pearl);
    K.cluster(ctx, y[0], y[1], 70, 22 * k, 5, C.ice, t, { alpha: burn, size: 2.4 });
    K.cluster(ctx, pr[0], pr[1], 60, 18 * k, 9, C.ice, t, { alpha: burn, size: 2.4 });
    K.place(ctx, y, "YANGTZE DELTA", { alpha: burn, color: C.ice, dx: -30, dy: -26 * k * 0.4 - 30, dot: 0, align: "right" });
    K.place(ctx, pr, "PEARL RIVER DELTA", { alpha: burn, color: C.ice, dx: -30, dy: 50, dot: 0, align: "right" });
    K.chip(ctx, "WTO ACCESSION · 2001", 120, 200, { color: C.ice, alpha: fade(t, tWTO, 0.6), size: 16 });

    // container arcs out
    const sh = view.xy(P.shanghai);
    const gz = view.xy(P.shenzhen);
    const outNA = D.arcPts(sh, [1300, -40], 0.2, 40, -1);
    const outEU = D.arcPts(gz, [-60, 980], 0.2, 40, -1);
    D.thread(ctx, outNA, t, tOut, 1.5, { color: C.ice, width: 2.5, particles: 6, speed: 0.25 });
    D.thread(ctx, outEU, t, tOut + 0.3, 1.5, { color: C.ice, width: 2.5, particles: 6, speed: 0.25 });
    D.label(ctx, "CONTAINERS → NORTH AMERICA", 1150, 150, { color: C.ice, alpha: prog(t, tOut + 1, 0.6), size: 14, align: "right", box: true });
    D.label(ctx, "CONTAINERS → EUROPE", 120, 930, { color: C.ice, alpha: prog(t, tOut + 1.3, 0.6), size: 14, box: true });

    // dollar balances return and split
    const split = [960, 620];
    const back = D.arcPts([1240, -40], split, 0.25, 40, -1);
    D.thread(ctx, back, t, tOut + 1.6, 1.4, { color: C.cyan, width: 3, particles: 6, speed: 0.25 });
    D.label(ctx, "USD BALANCES", 1180, 330, { color: C.cyan, alpha: prog(t, tOut + 2.6, 0.6), size: 14, align: "right", box: true });
    const toGulf = D.arcPts(split, [-60, 520], 0.15, 40, -1);
    D.thread(ctx, toGulf, t, tCrude, 1.6, { color: C.cyan, width: 2.2, particles: 6, speed: 0.22 });
    D.label(ctx, "← BUYS GULF CRUDE", 120, 470, { color: C.cyan, alpha: prog(t, tCrude + 1, 0.6), size: 14, box: true });
    const toBars = D.arcPts(split, [1290, 700], 0.2, 40, 1);
    D.thread(ctx, toBars, t, tBars - 1, 1.2, { color: C.cyan, width: 2.2, particles: 6, speed: 0.22 });
    D.node(ctx, split[0], split[1], 7, C.cyan, { alpha: prog(t, tOut + 2.8, 0.4), ring: true });

    // Treasury holdings panel
    const pa = prog(t, tBars - 1.2, 0.8);
    const px = 1270;
    const py = 420;
    const pw = 560;
    const ph = 440;
    D.panel(ctx, px, py, pw, ph, { alpha: pa, title: "China · official U.S. Treasury holdings", titleColor: C.mid });
    D.label(ctx, "$BN · ROUGH FIGURE", px + 18, py + 52, { alpha: pa, color: C.dim, size: 12 });
    const bw = (pw - 60) / holdings.length;
    const grow = prog(t, tBars, Math.max(3, S.at("The Treasury") - tBars), ease.linear);
    holdings.forEach(([yr, v], i) => {
      const local = clamp(grow * holdings.length - i);
      const hgt = (v / 1300) * (ph - 130);
      D.bar(ctx, px + 30 + i * bw + 3, py + ph - 40, bw - 8, hgt, C.cyan, { p: ease.out(local), alpha: pa, glow: 6 });
      if (i % 3 === 0) D.text(ctx, String(yr), px + 30 + i * bw + bw / 2, py + ph - 16, { kind: "mono", size: 12, color: C.dim, align: "center", alpha: pa });
    });
    K.chip(ctx, "BEST MOVE: BUY U.S. DEBT", px, py - 30, { color: C.ice, alpha: fade(t, tDom, 0.6), size: 15 });
  };
}

// ================================================================ 5. reserve and hostage
function s5(S) {
  const tStack = 0.2;
  const tHead = S.at("They are", 0.25);
  const tHost = S.at("They are", 0.6);
  const tCust = S.at("A hostage is");
  const tEnv = S.at("Mearsheimer assumes");
  const tSlider = S.at("A careful");
  const tSmall = S.at("For years");
  const tHouse = S.at("China's Treasuries");
  const tMutual = S.at("Each side needed");
  return (ctx, t) => {
    D.bg(ctx, { gridAlpha: 0.35 });
    const L = 250;
    const R = 1210;
    const top = 210;
    const bot = 820;
    const mid = (L + R) / 2;
    D.panel(ctx, L, top, R - L, bot - top, { alpha: prog(t, 0, 0.8), title: "China's reserve pile" });
    D.stroke(ctx, [[mid, top + 60], [mid, bot - 20]], { color: C.border, width: 1.5, alpha: prog(t, 0.3, 0.8) });
    D.text(ctx, "RESERVE", (L + mid) / 2, top + 110, { size: 38, weight: 600, tracking: 10, align: "center", alpha: prog(t, tHead, 0.6) });
    D.text(ctx, "HOSTAGE", (mid + R) / 2, top + 110, { size: 38, weight: 600, tracking: 10, align: "center", color: C.crimson, alpha: prog(t, tHost, 0.6) });
    const sp = prog(t, tStack, 2.2, ease.linear);
    K.bondStack(ctx, (L + mid) / 2, bot - 40, 13, 280, { p: sp, color: C.cyan, h: 20, gap: 7 });
    K.bondStack(ctx, (mid + R) / 2, bot - 40, 13, 280, { p: sp, color: C.cyan, h: 20, gap: 7, alpha: prog(t, tHost, 0.6) });
    // hostage overlay: bracket + lock, faint
    const ha = prog(t, tHost + 0.2, 0.6);
    if (ha > 0) {
      D.brackets(ctx, (mid + R) / 2 - 165, bot - 40 - 13 * 27 - 20, 330, 13 * 27 + 30, { color: C.crimson, len: 26, lw: 2.5, alpha: ha * 0.8 });
      D.icon.lock(ctx, (mid + R) / 2 + 190, bot - 230, 34, C.crimson, ha * 0.6);
    }
    K.chip(ctx, "WORTH DEPENDS ON WASHINGTON HOLDING BACK", mid, bot + 52, { color: C.ice, align: "center", alpha: fade(t, tCust, 0.6), size: 15 });
    // intentions are private
    K.envelope(ctx, 1520, 690, 130, { alpha: fade(t, tEnv, 0.6, tHouse, 0.8), color: C.mid });
    D.label(ctx, "WASHINGTON'S PLANS STAY HIDDEN", 1520, 790, { align: "center", alpha: fade(t, tEnv + 0.3, 0.6, tHouse, 0.8), size: 13 });
    // freeze risk slider
    const sa = prog(t, tSlider, 0.6);
    const v = 0.035 + 0.006 * Math.sin(t * 1.3);
    D.slider(ctx, L + 40, 935, R - L - 80, v, { alpha: sa, color: C.crimson, label: "FREEZE RISK" });
    D.text(ctx, "LOOKS UNLIKELY", R - 40, 905, { kind: "mono", size: 16, color: C.crimson, align: "right", alpha: prog(t, tSmall, 0.6) });
    // household consumption
    const hx = 1560;
    const hy = 400;
    const hA = prog(t, tHouse, 0.8);
    D.icon.house(ctx, hx, hy, 110, C.cyan, hA);
    D.label(ctx, "U.S. HOUSEHOLD CONSUMPTION", hx, hy + 100, { align: "center", color: C.cyan, alpha: hA, size: 14 });
    const line = [[R - 20, 560], [1380, 500], [hx - 70, hy + 20]];
    D.stroke(ctx, D.smoothPts(line), { color: C.ice, width: 1.5, to: prog(t, tHouse + 0.3, 1.2), alpha: 0.9, glow: 6 });
    D.label(ctx, "EACH SIDE NEEDS THE OTHER", 1250, 610, { color: C.ice, alpha: prog(t, tMutual, 0.8), size: 15, weight: 600 });
  };
}

// ================================================================ 6. the freeze
function s6(S) {
  const view = new MapView(geoNaturalEarth1().rotate([-25, 0]).scale(318).translate([W / 2, 540]), { res: "110m" });
  const blocks = [
    ["RU", [62, 60], 74, 44],
    ["CN", [103, 34], 60, 36],
    ["SA", [45, 23], 46, 28],
    ["IN", [78, 21], 46, 28],
    ["BR", [-52, -11], 48, 30],
    ["TR", [34, 39.5], 40, 24],
    ["ID", [114, -1], 42, 26],
    ["ZA", [24, -29], 40, 24],
  ];
  const brics = [[[-47.9, -15.8], "BR"], [P.moscow, "RU"], [[77.2, 28.6], "IN"], [P.beijing, "CN"], [[28.2, -25.7], "ZA"], [[51.4, 35.7], "IR"], [[31.2, 30.0], "EG"], [[38.7, 9.0], "ET"], [[54.4, 24.5], "AE"]];
  const tLock = S.at("The chance", 0.55);
  const tFlick = S.at("What mattered");
  const tCred = S.at("If government");
  const tBrics = S.at("Sachs places");
  return (ctx, t) => {
    D.bg(ctx, { gridAlpha: 0.3 });
    view.base(ctx, { graticule: true });
    // BRICS nodes (amber), brighten by one stop
    const up = prog(t, tBrics, 1.4);
    for (const [ll, code] of brics) {
      const p = view.xy(ll);
      D.node(ctx, p[0] + 26, p[1] + 20, 5, C.amber, { alpha: 0.4 + 0.5 * up, glow: 8 + 14 * up, ring: up > 0.5 });
      D.text(ctx, code, p[0] + 38, p[1] + 25, { kind: "mono", size: 11, color: C.amber, alpha: 0.35 + 0.55 * up });
    }
    // reserve blocks
    blocks.forEach(([code, ll, w, h], i) => {
      const [x, y] = view.xy(ll);
      let col = C.cyan;
      let a = prog(t, 0.2 + i * 0.12, 0.6);
      if (code === "RU") {
        col = mix(C.cyan, C.steelDeep, prog(t, tLock, 0.8));
      } else {
        const ft = tFlick + (i - 1) * 0.45;
        const local = t - ft;
        if (local > 0 && local < 0.9) a *= 0.35 + 0.65 * Math.abs(Math.cos(local * Math.PI * 3.3));
        col = mix(C.cyan, "#9fdcf0", 0.5);
      }
      ctx.save();
      ctx.globalAlpha = a;
      ctx.fillStyle = rgba(col, 0.18);
      ctx.strokeStyle = col;
      ctx.lineWidth = 1.6;
      ctx.fillRect(x - w / 2, y - h / 2, w, h);
      ctx.strokeRect(x - w / 2, y - h / 2, w, h);
      for (let k = 1; k < 4; k++) {
        ctx.fillStyle = rgba(col, 0.5);
        ctx.fillRect(x - w / 2 + 6, y - h / 2 + (k * h) / 4 - 1, w * 0.5, 2);
      }
      ctx.restore();
      D.text(ctx, "FX", x + w / 2 - 6, y + h / 2 - 5, { kind: "mono", size: 10, color: col, align: "right", alpha: a });
    });
    // the lock
    const ru = view.xy([62, 60]);
    const lk = prog(t, tLock, 0.35, ease.out);
    if (lk > 0) {
      const pad = lerp(60, 10, lk);
      D.brackets(ctx, ru[0] - 37 - pad, ru[1] - 22 - pad, 74 + pad * 2, 44 + pad * 2, { color: C.cyan, len: 16, lw: 4, alpha: lk });
      D.icon.lock(ctx, ru[0] + 64, ru[1] - 6, 24, C.cyan, lk);
      D.label(ctx, "RESERVES IMMOBILIZED", ru[0], ru[1] - 52, { align: "center", color: C.cyan, alpha: lk, size: 14, weight: 600 });
    }
    // credibility series
    const ca = prog(t, tCred, 0.8);
    const gx = 110;
    const gy = 770;
    D.panel(ctx, gx, gy, 520, 210, { alpha: ca, title: "Custodian credibility" });
    const data = [];
    for (let i = 0; i <= 60; i++) {
      const u = i / 60;
      if (u < 0.59) data.push([u, 0.78 + 0.02 * Math.sin(u * 30)]);
      else {
        if (!data.some((d) => d[0] === 0.59)) data.push([0.59, 0.78 + 0.02 * Math.sin(0.59 * 30)], [0.592, 0.43]);
        data.push([u, 0.43 + 0.012 * Math.sin(u * 27)]);
      }
    }
    const dp = prog(t, tCred + 0.4, Math.max(3, S.at("The cost") - tCred), ease.linear);
    D.series(ctx, gx + 24, gy + 56, 470, 130, data, { color: C.ice, width: 2.5, p: dp, glow: 8 });
    if (dp > 0.6) D.label(ctx, "STEP DOWN · NO RECOVERY", gx + 330, gy + 110, { color: C.mid, size: 12, alpha: prog(t, tCred + 2.6, 0.6) });
    D.label(ctx, "OTHER EXPORTERS TAKE NOTICE", 1780, 990, { align: "right", color: C.amber, alpha: up, size: 14 });
  };
}

// ================================================================ 7. pipes around New York
function s7(S) {
  const cn = [260, 560];
  const ny = [960, 560];
  const sellers = [
    [1660, 395, "GULF PRODUCERS"],
    [1660, 560, "RUSSIA"],
    [1660, 750, "COMMODITY EXPORTERS"],
  ];
  const goldV = [260, 330];
  const tFlat = S.at("Fewer fresh");
  const tGold = S.at("More gold.");
  const tOil = S.at("More state-to-state");
  const tSwap = S.at("More swap");
  const tRail = S.at("More attempts");
  const swapNodes = (() => {
    const r = rng(17);
    const out = [];
    for (let i = 0; i < 8; i++) out.push([440 + i * 160 + (r() - 0.5) * 40, 905 + (r() - 0.5) * 60]);
    return out;
  })();
  const oilPts = D.smoothPts([cn, [480, 730], [960, 800], [1380, 730], [1660, 560]], 14);
  const railPts = D.smoothPts([cn, [470, 400], [960, 315], [1400, 320], [1660, 395]], 14);
  const off = (pts, d) =>
    pts.map((p, i) => {
      const q = pts[Math.min(pts.length - 1, i + 1)];
      const r0 = pts[Math.max(0, i - 1)];
      const a = Math.atan2(q[1] - r0[1], q[0] - r0[0]);
      return [p[0] - Math.sin(a) * d, p[1] + Math.cos(a) * d];
    });
  const railA = off(railPts, -6);
  const railB = off(railPts, 6);
  return (ctx, t) => {
    D.bg(ctx, { gridAlpha: 0.35 });
    // slow drift along the amber pipes
    const z = K.track(t, [[0, 1.0], [S.dur, 1.07]], ease.inOut);
    const dx = K.track(t, [[0, 30], [S.dur, -50]], ease.inOut);
    ctx.save();
    ctx.translate(960 + dx, 560);
    ctx.scale(z, z);
    ctx.translate(-960, -560);
    // legacy cyan pipe through New York
    D.stroke(ctx, [cn, ny], { color: C.cyan, width: 6, glow: 18, alpha: 0.85 });
    for (const [x, y] of sellers) D.stroke(ctx, D.arcPts(ny, [x - 20, y], 0.04, 20), { color: C.cyan, width: 3, alpha: 0.55 });
    K.flow(ctx, [cn, ny], t, { color: C.ice, n: 6, speed: 0.3 * (1 - prog(t, tFlat, 2) * 0.7) });
    // New York stays blue and bright
    D.node(ctx, ny[0], ny[1], 34, C.cyan, { glow: 40, pulseT: t });
    D.label(ctx, "NEW YORK", ny[0], ny[1] + 74, { align: "center", color: C.ice, size: 18, weight: 600 });
    D.label(ctx, "CORRESPONDENT BANKS", ny[0], ny[1] + 96, { align: "center", color: C.cyan, size: 13 });
    // China
    D.node(ctx, cn[0], cn[1], 26, C.crimson, { glow: 30 });
    D.label(ctx, "PBOC RESERVES", cn[0], cn[1] + 64, { align: "center", color: C.ice, size: 16, weight: 600 });
    for (const [x, y, n] of sellers) {
      D.node(ctx, x, y, 14, C.mid, { glow: 10 });
      D.label(ctx, n, x + 26, y + 5, { color: C.mid, size: 14 });
    }
    // gold allocation (straight up from the reserve)
    const gp = prog(t, tGold, 1.2);
    D.stroke(ctx, [[cn[0], cn[1] - 30], [goldV[0], goldV[1] + 40]], { color: C.gold, width: 4, to: gp, glow: 14 });
    ctx.save();
    ctx.globalAlpha = prog(t, tGold + 0.8, 0.6);
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j <= i; j++) {
        const x = goldV[0] - i * 13 + j * 26;
        const y = goldV[1] - 30 + i * 18;
        ctx.fillStyle = C.gold;
        ctx.shadowColor = C.gold;
        ctx.shadowBlur = 12;
        ctx.fillRect(x - 11, y, 22, 14);
      }
    }
    ctx.restore();
    D.label(ctx, "GOLD ALLOCATION", goldV[0] - 60, goldV[1] - 50, { color: C.gold, alpha: prog(t, tGold + 0.8, 0.6), size: 14 });
    // state-to-state oil contracts (below, never touching NY)
    D.thread(ctx, oilPts, t, tOil, 2.2, { color: C.amber, width: 5, particles: 8, speed: 0.12, glow: 16 });
    D.label(ctx, "STATE-TO-STATE OIL CONTRACTS", 960, 836, { align: "center", color: C.amber, alpha: prog(t, tOil + 1.6, 0.6), size: 14 });
    // swap-line lattice
    const sp = prog(t, tSwap, 2);
    const lat = [cn, ...swapNodes, sellers[2].slice(0, 2)];
    for (let i = 0; i < lat.length; i++) {
      for (let j = i + 1; j < Math.min(lat.length, i + 3); j++) {
        D.stroke(ctx, [lat[i], lat[j]], { color: C.amber, width: 1.2, alpha: 0.55, to: clamp(sp * 2 - i / lat.length) });
      }
      if (i > 0 && i < lat.length - 1) D.node(ctx, lat[i][0], lat[i][1], 4, C.amber, { alpha: clamp(sp * 2 - i / lat.length), ring: false, glow: 8 });
    }
    D.label(ctx, "CENTRAL-BANK SWAP LINES", 440, 985, { color: C.amber, alpha: prog(t, tSwap + 1, 0.6), size: 14 });
    // yuan-clearing rail (above, never touches NY)
    const rp = prog(t, tRail, 2.4);
    if (rp > 0) {
      D.stroke(ctx, railA, { color: C.amber, width: 2.2, to: rp, glow: 10 });
      D.stroke(ctx, railB, { color: C.amber, width: 2.2, to: rp, glow: 10 });
      const ties = D.slice(railPts, 0, rp);
      for (let i = 0; i < ties.length - 1; i += 3) {
        const a = Math.atan2(ties[i + 1][1] - ties[i][1], ties[i + 1][0] - ties[i][0]);
        const [x, y] = ties[i];
        D.stroke(ctx, [[x - Math.sin(a) * 10, y + Math.cos(a) * 10], [x + Math.sin(a) * 10, y - Math.cos(a) * 10]], { color: C.amber, width: 1.5, alpha: 0.6 });
      }
      D.label(ctx, "YUAN-CLEARING RAIL", 960, 290, { align: "center", color: C.amber, alpha: prog(t, tRail + 1.4, 0.6), size: 14 });
      if (rp >= 1) K.flow(ctx, railPts, t, { color: "#fff1d0", n: 6, speed: 0.1, size: 2.4 });
    }
    ctx.restore();
    // new UST purchases flatten (screen-fixed inset, top right)
    const ia = prog(t, 0.4, 0.8);
    D.panel(ctx, 1410, 130, 400, 160, { alpha: ia, title: "New U.S. debt China buys" });
    const fl = prog(t, tFlat, 2.5);
    const data = [[0, 0.1], [0.2, 0.35], [0.4, 0.62], [0.55, 0.78], [0.7, lerp(0.86, 0.8, fl)], [0.85, lerp(0.93, 0.8, fl)], [1, lerp(1, 0.8, fl)]];
    D.series(ctx, 1434, 180, 350, 90, data, { color: C.cyan, width: 2.5, p: prog(t, 0.6, 2.5, ease.out), glow: 8 });
    D.label(ctx, "FLAT", 1784, 172, { color: C.cyan, alpha: prog(t, tFlat + 1.5, 0.6), size: 12, align: "right" });
  };
}

// ================================================================ 8. the grip
function s8(S) {
  const tPress = S.at("The grip is not");
  const tStrike = S.at("The grip is not", 0.6);
  const tMesh = S.at("The grip is the");
  const tCut = S.at("An adversary");
  const tGraph = S.at("Energy is");
  const tPeg = S.at("Currency pegs");
  const tOpt = S.at("A producer that");
  const tPol = S.at("Security patrons,");
  const chain = [
    ["INVOICE", "OIL CARGO · USD", 250],
    ["CORRESPONDENT BANK", "NEW YORK MESH", 620],
    ["MESSAGE RAIL", "PAYMENT INSTRUCTIONS", 990],
    ["LEGAL GATE", "THE GRIP", 1360],
    ["SELLER", "PAID", 1700],
  ];
  // orthographic slab
  const slab = (ctx, x, y, w, h, title, sub, col, a, glow = 0, dim = 0) => {
    if (a <= 0) return;
    const d = 16;
    ctx.save();
    ctx.globalAlpha *= a * (1 - dim * 0.6);
    ctx.fillStyle = rgba(col, 0.16);
    ctx.beginPath();
    ctx.moveTo(x - w / 2, y - h / 2);
    ctx.lineTo(x - w / 2 + d, y - h / 2 - d);
    ctx.lineTo(x + w / 2 + d, y - h / 2 - d);
    ctx.lineTo(x + w / 2 + d, y + h / 2 - d);
    ctx.lineTo(x + w / 2, y + h / 2);
    ctx.lineTo(x + w / 2, y - h / 2);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = rgba(col, 0.6);
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
    K.boxNode(ctx, x, y, w, h, title, { color: col, sub, alpha: a, glow, dim, fill: 0.1, titleSize: 17 });
  };
  return (ctx, t) => {
    D.bg(ctx, { gridAlpha: 0.35 });
    const cut = t >= tCut;
    const y0 = cut ? 260 : 520;
    const sc = cut ? 0.78 : 1;
    // printing press (not the grip)
    if (!cut) {
      const pa = prog(t, tPress, 0.6);
      slab(ctx, 960, 250, 300, 80, "PRINTING PRESS", "NOT THE GRIP", C.steel, pa, 0, prog(t, tStrike, 0.5));
      D.stroke(ctx, [[790, 290], [1130, 210]], { color: C.crimson, width: 3, to: prog(t, tStrike, 0.4), alpha: pa });
    }
    // payment chain
    ctx.save();
    if (cut) {
      ctx.translate(960, y0);
      ctx.scale(sc, sc);
      ctx.translate(-960, -520);
    }
    const dimAll = cut ? 0.5 : 0;
    D.stroke(ctx, [[chain[0][2], 520], [chain[4][2], 520]], { color: C.cyan, width: 3, alpha: 0.5 * (1 - dimAll * 0.5), dash: [10, 8], dashOffset: -t * 30 });
    chain.forEach(([title, sub, x], i) => {
      const a = prog(t, 0.2 + i * 0.25, 0.6);
      const lit = i >= 1 && i <= 3 ? prog(t, tMesh + (i - 1) * (S.end("The grip is the") - S.start("The grip is the")) * 0.3, 0.5) : 0;
      const grip = i === 3;
      const col = i === 0 || i === 4 ? C.mid : mix(C.steel, C.cyan, Math.max(lit, grip ? 0.3 : 0));
      slab(ctx, x, 520, grip ? 250 : 240, 100, title, sub, col, a, grip ? 30 * lit + 8 : lit * 14, dimAll);
    });
    const gripA = prog(t, tMesh + (S.end("The grip is the") - S.start("The grip is the")) * 0.75, 0.6);
    D.text(ctx, "THE GRIP", chain[3][2], 420, { size: 34, weight: 700, tracking: 8, align: "center", color: C.cyan, glow: 22, alpha: gripA * (1 - dimAll * 0.4) });
    if (!cut) {
      const cargoP = ((t * 0.08) % 1);
      const cx = lerp(chain[0][2], chain[4][2], cargoP);
      D.icon.ship(ctx, cx, 600, 46, 0, C.ice, 0.85);
      D.label(ctx, "CARGO", cx, 640, { align: "center", size: 12, color: C.dim });
    }
    ctx.restore();
    if (!cut) return;

    // hard cut: same cargo on a bilateral amber rail that bypasses the gate
    D.label(ctx, "DOLLAR PATH", 140, 190, { color: C.cyan, size: 13 });
    const rail = D.smoothPts([[250, 600], [520, 640], [900, 700], [1120, 700], [1360, 690], [1560, 610], [1700, 515]], 12);
    const gateX = 1360;
    D.stroke(ctx, [[gateX, 330], [gateX, 640]], { color: C.cyan, width: 1, dash: [3, 5], alpha: 0.4 });
    const rp = prog(t, tCut + 0.2, 1.6);
    D.stroke(ctx, rail, { color: C.amber, width: 6, to: rp, glow: 18 });
    K.boxNode(ctx, 250, 640, 240, 90, "INVOICE", { color: C.amber, sub: "OIL CARGO · CNY", alpha: prog(t, tCut, 0.4), titleSize: 17 });
    K.boxNode(ctx, 900, 720, 300, 80, "BILATERAL RAIL", { color: C.amber, sub: "BYPASSES THE GATE", alpha: prog(t, tCut + 0.6, 0.5), titleSize: 17 });
    K.boxNode(ctx, 1700, 470, 230, 80, "SELLER", { color: C.amber, sub: "PAID OUTSIDE THE GATE", alpha: prog(t, tCut + 1.6, 0.5), titleSize: 17 });
    if (rp >= 1) {
      const f = ((t - tCut) * 0.07) % 1;
      const q = D.pointAt(rail, f);
      D.icon.ship(ctx, q.x, q.y - 30, 46, q.a, C.amber, 1);
    }
    // marginal vs average barrel
    const ga = prog(t, tGraph, 0.8);
    const gx = 1150;
    const gy = 780;
    D.panel(ctx, gx, gy, 660, 220, { alpha: ga, title: "Dollars in China's next oil bill" });
    const gp = prog(t, tGraph + 0.5, Math.max(4, S.dur - tGraph - 3), ease.linear);
    const marg = [];
    const avg = [];
    for (let i = 0; i <= 40; i++) {
      const u = i / 40;
      marg.push([u, 0.92 - 0.5 * ease.inOut(clamp((u - 0.2) / 0.8))]);
      avg.push([u, 0.92 - 0.12 * ease.inOut(clamp((u - 0.2) / 0.8))]);
    }
    D.series(ctx, gx + 30, gy + 60, 600, 140, avg, { color: C.steel, width: 2, p: gp, dash: [6, 6], glow: 0, alpha: 0.7 * ga, dot: false });
    D.series(ctx, gx + 30, gy + 60, 600, 140, marg, { color: C.cyan, width: 3, p: gp, glow: 10, alpha: ga });
    D.label(ctx, "A TYPICAL BARREL", gx + 640, gy + 74, { align: "right", color: C.steel, size: 12, alpha: ga * prog(t, tGraph + 3, 0.6) });
    D.label(ctx, "CHINA'S NEXT BARREL", gx + 640, gy + 182, { align: "right", color: C.cyan, size: 12, alpha: ga * prog(t, tGraph + 5, 0.6) });
    // pegs and the second option
    const pa = prog(t, tPeg, 0.6);
    D.panel(ctx, 110, 820, 560, 180, { alpha: pa, title: "Producer currency peg" });
    K.chip(ctx, "PEG: USD", 140, 900, { color: C.cyan, alpha: pa, size: 15 });
    const oa = prog(t, tOpt, 0.6);
    ["CNY", "GOLD", "BASKET"].forEach((s, i) => K.chip(ctx, s, 290 + i * 118, 900, { color: C.amber, alpha: oa * prog(t, tOpt + i * 0.3, 0.4), size: 15 }));
    D.label(ctx, "A SECOND WAY TO GET PAID", 140, 970, { color: C.amber, alpha: oa, size: 13 });
    const pol = prog(t, tPol, 0.6);
    ["SECURITY PARTNERS", "ARMS SUPPLIERS", "LONG-TERM BUYERS"].forEach((s, i) => D.label(ctx, s, 700, 840 + i * 30, { color: C.mid, size: 13, alpha: pol * prog(t, tPol + i * 0.25, 0.4) }));
    D.label(ctx, "THE PRICE OF THAT CHOICE", 700, 960, { color: C.ice, size: 13, alpha: prog(t, tPol + 0.9, 0.5) });
  };
}

// ================================================================ 9. the marginal barrel
function s9(S) {
  const view = new MapView(geoMercator().scale(1250).translate([W / 2, H / 2]), { res: "50m", bbox: [[30, -12], [140, 50]] });
  const wide = K.camFor(view, [86, 26], 0.88, 960, 470);
  const gulf = K.camFor(view, [51.2, 27.2], 4.0, 960, 430);
  const terms = [P.rasTanura, P.juaymah, P.kharg, P.mina, [53.06, 25.15], P.fujairah, [52.6, 27.5], P.basra];
  const tIn = S.at("This is", 0.2);
  const tOut = S.at("A Gulf");
  const tYuan = S.at("A Gulf", 0.2);
  const tCap = S.at("The volume");
  const tFlow = S.at("It must");
  const dest = [P.ningbo, P.qingdao, P.dalian, P.zhanjiang];
  return (ctx, t) => {
    D.bg(ctx, { gridAlpha: 0.2, color: "#0a0d12" });
    const zin = prog(t, tIn, 3);
    const zout = prog(t, tOut, 3);
    view.setCam(MapView.mixCam(MapView.mixCam(wide, gulf, zin), wide, zout));
    view.base(ctx, { landFill: "#121820", colors: { [ID.china]: rgba(C.crimson, 0.15) } });
    // terminal lights at night
    terms.forEach((tp, i) => {
      const p = view.xy(tp);
      K.cluster(ctx, p[0], p[1], 14, 5 + 3 * view.cam.k, 30 + i, "#ffd9a0", t, { size: 1.6 + 0.4 * view.cam.k, alpha: 0.9 });
    });
    K.place(ctx, view.xy(P.rasTanura), "RAS TANURA", { alpha: zin * (1 - zout), color: C.ice, dx: -16, align: "right", dot: 0 });
    K.place(ctx, view.xy(P.kharg), "KHARG", { alpha: zin * (1 - zout), color: C.ice, dot: 0 });
    K.place(ctx, view.xy(P.fujairah), "FUJAIRAH", { alpha: zin * (1 - zout), color: C.ice, dot: 0, dy: 24 });
    // dollar contracts detour via New York (off the top of frame)
    const dA = prog(t, S.at("The loop"), 1) * (1 - 0.6 * prog(t, tYuan, 1));
    dest.forEach((d, i) => {
      const a = view.xy(terms[i]);
      const b = view.xy(d);
      const peak = [lerp(a[0], b[0], 0.55), -260];
      const pts = D.smoothPts([a, [lerp(a[0], peak[0], 0.5), 120], peak, [lerp(peak[0], b[0], 0.6), 160], b], 10);
      D.stroke(ctx, pts, { color: C.ice, width: 1.1, alpha: 0.45 * dA, to: prog(t, S.at("The loop") + i * 0.2, 1.5) });
      K.flow(ctx, pts, t + i, { color: C.ice, n: 3, speed: 0.1, size: 2, alpha: dA * 0.8 });
    });
    D.label(ctx, "↑ VIA NEW YORK CLEARING", 1180, 80 + 70, { color: C.ice, alpha: dA * 0.8, size: 13 });
    // the yuan contract
    const a = view.xy(P.rasTanura);
    const b = view.xy(P.ningbo);
    const direct = D.arcPts(a, b, 0.12, 60, 1);
    const ghost = D.smoothPts([a, [lerp(a[0], b[0], 0.3), 160], [lerp(a[0], b[0], 0.55), -120], [lerp(a[0], b[0], 0.8), 160], b], 10);
    const ga = prog(t, tYuan + 0.6, 0.8);
    D.stroke(ctx, D.slice(ghost, 0, 0.32), { color: C.cyan, width: 1.5, dash: [5, 7], alpha: 0.6 * ga });
    D.stroke(ctx, D.slice(ghost, 0.68, 1), { color: C.cyan, width: 1.5, dash: [5, 7], alpha: 0.6 * ga });
    const gm = D.pointAt(ghost, 0.5);
    D.label(ctx, "NO NEW YORK LEG", gm.x, 210, { align: "center", color: C.cyan, alpha: ga, size: 13 });
    D.thread(ctx, direct, t, tYuan, 2, { color: C.amber, width: 6, particles: 9, psize: 3.6, speed: 0.16, glow: 22 });
    const mid = D.pointAt(direct, 0.55);
    K.chip(ctx, "YUAN", mid.x, mid.y + 54, { color: C.amber, align: "center", alpha: prog(t, tYuan + 1.6, 0.5), size: 18 });
    D.caption(ctx, "China's next barrel, not every barrel", t, tCap, { y: 820, size: 30, accent: C.amber });
    // new purchases fall through replacement
    const fa = prog(t, tFlow, 0.8);
    const fx = 120;
    const fy = 900;
    const fw = 1100;
    D.label(ctx, "NEW TREASURY PURCHASES", fx, fy - 14, { color: C.cyan, alpha: fa, size: 13 });
    const v = lerp(0.82, 0.24, prog(t, tFlow + 0.5, Math.max(3, S.dur - tFlow - 2)));
    D.hbar(ctx, fx, fy, fw, 26, C.cyan, { p: v, alpha: fa });
    const rx = fx + fw * 0.5;
    D.stroke(ctx, [[rx, fy - 16], [rx, fy + 44]], { color: C.ice, width: 2, dash: [5, 4], alpha: fa });
    D.label(ctx, "NEEDED TO HOLD THE PILE STEADY", rx + 10, fy + 64, { color: C.ice, alpha: fa, size: 12 });
  };
}

// ================================================================ 10. flow, stock, settlement
function s10(S) {
  const tPanels = 0.2;
  const tShock = S.at("Washington's sensible", 0.4);
  const keys = [[S.at("Then the"), 0], [S.at("Dollars can", 1), 0.34], [S.at("What remains", 1), 0.55], [S.at("The reminder is", 1), 0.66], [S.at("Sachs would"), 0.84], [S.dur - 1.5, 1]];
  const uMark = 0.32;
  const uShock = 0.6;
  const flow = [];
  const stock = [];
  const share = [];
  for (let i = 0; i <= 100; i++) {
    const u = i / 100;
    flow.push([u, u < uMark ? 0.72 + 0.04 * Math.sin(u * 40) : lerp(0.72, 0.12, ease.out(clamp((u - uMark) / 0.18))) + 0.02 * Math.sin(u * 35)]);
    let s = 0.85;
    if (u > uMark) s -= (u - uMark) * 0.35;
    if (u > uShock) s -= (u - uShock) * 1.2;
    stock.push([u, s]);
    share.push([u, 0.08 + (u < uMark ? 0.02 * u : 0.02 * uMark + 0.82 * ease.inOut(clamp((u - uMark) / (1 - uMark))))]);
  }
  const panels = [
    ["NEW BUYING", flow, C.cyan],
    ["THE PILE ALREADY HELD", stock, C.cyan],
    ["PAID OUTSIDE DOLLARS", share, C.amber],
  ];
  return (ctx, t) => {
    D.bg(ctx, { gridAlpha: 0.3 });
    const u = K.track(t, keys, ease.linear);
    const x0 = 230;
    const w = 1460;
    panels.forEach(([title, data, col], i) => {
      const y = 190 + i * 270;
      const a = prog(t, tPanels + i * 0.3, 0.7);
      D.axes(ctx, x0, y, w, 200, { alpha: a, ticks: 3 });
      D.text(ctx, title, x0, y - 12, { size: 20, weight: 600, tracking: 5, alpha: a, color: i === 2 ? C.amber : C.ice });
      D.series(ctx, x0, y + 10, w, 180, data, { color: col, width: 3, p: u, glow: 12, alpha: a, fillAlpha: i === 1 ? 0.18 : 0 });
    });
    // event markers through all panels
    const mx = x0 + uMark * w;
    const ma = prog(t, S.at("Dollars can", 0.5), 0.6);
    D.stroke(ctx, [[mx, 150], [mx, 170 + 2 * 270 + 210]], { color: C.amber, width: 1.5, dash: [6, 6], alpha: ma });
    K.chip(ctx, "YUAN OIL CONTRACT", mx, 140, { color: C.amber, align: "center", alpha: ma, size: 14 });
    const sx = x0 + uShock * w;
    const sa = prog(t, tShock, 0.4, ease.out);
    D.stroke(ctx, [[sx, 150], [sx, 170 + 2 * 270 + 210]], { color: C.cyan, width: 4, alpha: sa, glow: 24 });
    K.chip(ctx, "THREAT TO FREEZE THE PILE", sx, 140, { color: C.cyan, align: "center", alpha: sa, size: 14 });
    // cursor
    const cx = x0 + u * w;
    D.stroke(ctx, [[cx, 160], [cx, 170 + 2 * 270 + 200]], { color: C.ice, width: 1, alpha: 0.18 });
  };
}

// ================================================================ 11. one object
function s11(S) {
  const tLines = S.at("If official");
  const tOne = S.at("The weapon and");
  const tSplit = S.at("Use of");
  const tFast = S.at("It speeds");
  const obj = (ctx, x, y, s, half, a, spin) => {
    if (a <= 0) return;
    ctx.save();
    ctx.globalAlpha *= a;
    ctx.translate(x, y);
    ctx.scale(Math.max(0.08, Math.abs(Math.cos(spin))), 1);
    if (half === "L" || half === "both") {
      // munition half
      ctx.fillStyle = rgba(C.cyan, 0.16);
      ctx.strokeStyle = C.cyan;
      ctx.lineWidth = 2.5;
      ctx.shadowColor = C.cyan;
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.moveTo(0, -s * 0.22);
      ctx.lineTo(-s * 0.62, -s * 0.22);
      ctx.quadraticCurveTo(-s * 0.98, -s * 0.2, -s * 1.12, 0);
      ctx.quadraticCurveTo(-s * 0.98, s * 0.2, -s * 0.62, s * 0.22);
      ctx.lineTo(0, s * 0.22);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;
      for (const f of [-0.4, -0.28]) {
        ctx.beginPath();
        ctx.moveTo(f * s, -s * 0.22);
        ctx.lineTo(f * s, s * 0.22);
        ctx.stroke();
      }
    }
    if (half === "R" || half === "both") {
      ctx.fillStyle = rgba(C.ice, 0.08);
      ctx.strokeStyle = rgba(C.ice, 0.9);
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.rect(0, -s * 0.22, s * 1.05, s * 0.44);
      ctx.fill();
      ctx.stroke();
      ctx.lineWidth = 1;
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(s * 0.12, -s * 0.1 + i * s * 0.07);
        ctx.lineTo(s * (0.55 + (i % 2) * 0.2), -s * 0.1 + i * s * 0.07);
        ctx.stroke();
      }
      ctx.font = `600 ${s * 0.1}px 'Plex Mono'`;
      ctx.fillStyle = C.ice;
      ctx.fillText("U.S. TREASURY", s * 0.12, -s * 0.13);
    }
    ctx.restore();
  };
  return (ctx, t) => {
    D.bg(ctx, { grid: false, color: "#07090c" });
    const spin = t * 0.55;
    const objA = prog(t, 0.2, 1) * (1 - prog(t, S.at("Depreciation stays"), 1.5));
    const lift = prog(t, tLines, 2);
    const oy = lerp(520, 330, lift);
    const sp = prog(t, tSplit, 1.6, ease.inOut);
    if (sp <= 0) {
      obj(ctx, 960, oy, 260, "both", objA, t < tOne ? spin : spin * prog(t, tOne, 1.5, ease.out) + (1 - prog(t, tOne, 1.5, ease.out)) * spin);
      if (t > tOne - 0.2) D.stroke(ctx, [[960, oy - 90], [960, oy + 90]], { color: C.ice, width: 1.5, dash: [4, 5], alpha: fade(t, tOne, 0.5) * objA });
    } else {
      obj(ctx, 960 - sp * 200, oy, 260, "L", objA, 0);
      obj(ctx, 960 + sp * 260, oy + sp * 30, 260, "R", objA * (1 - sp * 0.85), 0);
    }
    // the two lines
    const la = prog(t, tLines, 0.8);
    const lp = prog(t, tLines + 0.3, Math.max(3, S.dur - tLines - 2), ease.linear);
    const cost = [];
    const dem = [];
    const kink = 0.62;
    for (let i = 0; i <= 60; i++) {
      const u = i / 60;
      const fast = Math.max(0, u - kink);
      cost.push([u, 0.22 + 0.25 * u + 1.0 * fast * fast * 2.2]);
      dem.push([u, 0.8 - 0.22 * u - 1.0 * fast * fast * 2.2]);
    }
    const gx = 360;
    const gy = 600;
    const gw = 1200;
    const gh = 380;
    const kp = prog(t, tFast, 1.5);
    D.series(ctx, gx, gy, gw, gh, cost, { color: C.ice, width: 3, p: lp, glow: 10, alpha: la });
    D.series(ctx, gx, gy, gw, gh, dem, { color: C.cyan, width: 3, p: lp, glow: 10, alpha: la });
    const ce = D.pointAt(cost.map(([u, v]) => [gx + u * gw, gy + gh - v * gh]), lp);
    const de = D.pointAt(dem.map(([u, v]) => [gx + u * gw, gy + gh - v * gh]), lp);
    D.label(ctx, "COST OF BORROWING", ce.x + 16, ce.y + 5, { color: C.ice, alpha: la, size: 14 });
    D.label(ctx, "FOREIGN GOVERNMENTS BUYING", de.x + 16, de.y + 5, { color: C.cyan, alpha: la, size: 14 });
    D.stroke(ctx, [[gx + kink * gw, gy + 20], [gx + kink * gw, gy + gh]], { color: C.amber, width: 1, dash: [4, 6], alpha: kp * 0.7 });
    D.label(ctx, "BARREL MOVES", gx + kink * gw + 10, gy + 36, { color: C.amber, size: 12, alpha: kp });
  };
}

// ================================================================ 12. the crack, and only the crack
function s12(S) {
  const view = new MapView(geoNaturalEarth1().rotate([-30, 0]).scale(330).translate([W / 2, 560]), { res: "110m" });
  const allied = [P.newYork, P.london, P.tokyo, P.frankfurt, P.seoul, [151.2, -33.87], [-79.38, 43.65], [8.54, 47.37], P.paris, [-46.6, -23.55]];
  const usdLinks = [[0, 1], [0, 2], [1, 3], [2, 4], [2, 5], [0, 6], [1, 7], [1, 8], [0, 9], [3, 7], [4, 5]];
  const producers = [P.riyadh, P.moscow, [51.4, 35.7], [-47.9, -15.8], P.luanda, [44.4, 33.3]];
  const factory = P.shanghai;
  const barrel = P.rasTanura;
  const bond = P.newYork;
  const tAmber = S.at("A spare");
  const tAllied = S.at("The United");
  const tCrack = S.at("The break is the");
  return (ctx, t) => {
    D.bg(ctx, { gridAlpha: 0.25 });
    const dx = K.track(t, [[0, 20], [S.dur, -30]], ease.linear);
    ctx.save();
    ctx.translate(dx, 0);
    view.base(ctx, { borderAlpha: 0.35, colors: { [ID.china]: rgba(C.crimson, 0.2) } });
    // intact dollar paths among allies
    const la = prog(t, 0.3, 1);
    usdLinks.forEach(([a, b], i) => {
      const pts = D.arcPts(view.xy(allied[a]), view.xy(allied[b]), 0.15, 30);
      D.stroke(ctx, pts, { color: C.cyan, width: 1.4, alpha: 0.5 * la });
      K.flow(ctx, pts, t + i, { color: C.cyan, n: 2, speed: 0.08, size: 1.8, alpha: la * 0.8 });
    });
    const ny = prog(t, tAllied, 1);
    allied.forEach((ll, i) => {
      const p = view.xy(ll);
      D.node(ctx, p[0], p[1], i === 0 ? 7 + ny * 4 : 5, C.cyan, { alpha: la, glow: 14 + ny * 10, ring: i === 0 });
    });
    // China's energy corridors
    const sh = view.xy(P.shanghai);
    producers.forEach((ll, i) => {
      const pts = D.arcPts(sh, view.xy(ll), 0.18, 40, -1);
      D.thread(ctx, pts, t, tAmber + i * 0.18, 1.6, { color: C.amber, width: 2.4, particles: 4, speed: 0.15, glow: 14 });
    });
    D.node(ctx, sh[0], sh[1], 7, C.crimson, { glow: 18 });
    // glass overlay
    K.mirrorPane(ctx, 70, 150, W - 140 - dx, 860, { alpha: 0.7, sheen: (t * 0.05) % 1 });
    // the crack: factory -> barrel -> bond
    const f = view.xy(factory);
    const b = view.xy(barrel);
    const n = view.xy(bond);
    const path = [...D.crackPts(f, b, 21, 0.05, 18), ...D.crackPts(b, n, 22, 0.04, 30).slice(1)];
    mirrorCrack(ctx, path, prog(t, tCrack, Math.max(2.5, S.dur - tCrack - 1.5), ease.inOut), { width: 2.4, seed: 5 });
    const ca = prog(t, tCrack, 0.6);
    D.label(ctx, "FACTORY", f[0] + 12, f[1] + 26, { color: C.ice, alpha: ca, size: 13 });
    D.label(ctx, "BARREL", b[0] - 10, b[1] + 30, { color: C.ice, alpha: prog(t, tCrack + 1.2, 0.6), size: 13, align: "right" });
    D.label(ctx, "BOND", n[0] + 12, n[1] - 14, { color: C.ice, alpha: prog(t, tCrack + 2.6, 0.6), size: 13 });
    ctx.restore();
  };
}

// ================================================================ 13. the refusal at the margin
function s13(S) {
  const tWalls = S.at("Tariffs, technology");
  const tThick = S.at("They tell");
  const tEnd = S.at("It is not");
  const tPath = S.at("The mirror");
  const crack = D.crackPts([960, 220], [960, 840], 41, 0.05, 26);
  const walls = [
    ["TARIFF WALLS", 300],
    ["EXPORT-CONTROL GATES", 470],
    ["SANCTION LISTS", 640],
  ];
  return (ctx, t) => {
    D.bg(ctx, { gridAlpha: 0.3 });
    const z = lerp(1.28, 1.0, prog(t, 0, S.dur - 4, ease.inOut));
    ctx.save();
    ctx.translate(960, 540);
    ctx.scale(z, z);
    ctx.translate(-960, -540);
    // barriers
    walls.forEach(([name, y], i) => {
      const a = prog(t, tWalls + i * 0.45, 1);
      D.stroke(ctx, [[180, y], [700, y]], { color: C.cyan, width: 2, alpha: a * 0.8, glow: 10 });
      for (let x = 190; x < 700; x += 26) D.stroke(ctx, [[x, y - 10], [x, y + 10]], { color: C.cyan, width: 1, alpha: a * 0.4 });
      D.label(ctx, name, 180, y - 18, { color: C.cyan, alpha: a, size: 14 });
    });
    // mirror
    K.mirrorPane(ctx, 760, 200, 400, 660, { alpha: 1, sheen: (t * 0.06) % 1 });
    // factory -> barrel -> bond inside the mirror
    const fct = [860, 300];
    const brl = [1060, 530];
    const bnd = [860, 760];
    D.icon.factory(ctx, fct[0], fct[1], 60, C.crimson, 0.9);
    D.icon.barrel(ctx, brl[0], brl[1], 56, C.ice, 0.9);
    K.bondStack(ctx, bnd[0], bnd[1] + 28, 3, 90, { color: C.cyan, h: 14, gap: 4, tag: "" });
    D.stroke(ctx, [fct, brl, bnd], { color: C.ice, width: 1, dash: [4, 6], alpha: 0.4 });
    mirrorCrack(ctx, crack, 0.55 + 0.45 * prog(t, tPath, 3), { width: 2, alpha: 0.85, seed: 12 });
    const crackPath = [...D.crackPts(fct, brl, 51, 0.06, 12), ...D.crackPts(brl, bnd, 52, 0.06, 12).slice(1)];
    mirrorCrack(ctx, crackPath, prog(t, tPath, Math.max(2, S.end(-1) - tPath), ease.inOut), { width: 2.6, seed: 9 });
    // amber energy corridor thickens, only on the energy path
    const th = prog(t, tThick, 3);
    const corr = D.smoothPts([[1160, 530], [1330, 470], [1500, 500], [1640, 560]], 10);
    D.stroke(ctx, corr, { color: C.amber, width: 3 + th * 9, glow: 14 + th * 16, alpha: 0.9 });
    K.flow(ctx, corr, t, { color: "#fff1d0", n: 6, speed: 0.18 + th * 0.12, size: 2.5 + th });
    D.label(ctx, "ENERGY PATH", 1330, 440, { color: C.amber, size: 14, alpha: prog(t, tThick, 0.8) });
    // the marginal barrel, settled outside
    const ba = prog(t, tEnd, 1);
    D.icon.barrel(ctx, 1700, 560, 74, C.amber, ba);
    D.label(ctx, "CHINA'S NEXT BARREL", 1700, 640, { align: "center", color: C.amber, size: 14, alpha: ba });
    D.label(ctx, "SETTLED OUTSIDE THE MIRROR", 1700, 664, { align: "center", color: C.dim, size: 12, alpha: ba });
    ctx.restore();
    // Treasury stock declining beneath
    const ga = prog(t, tEnd + 1, 1);
    const data = [];
    for (let i = 0; i <= 40; i++) data.push([i / 40, 0.85 - 0.35 * (i / 40) - 0.05 * Math.sin(i / 6)]);
    D.series(ctx, 1260, 880, 520, 110, data, { color: C.cyan, width: 2.5, p: prog(t, tEnd + 1.2, Math.max(3, S.dur - tEnd - 5), ease.linear), glow: 8, alpha: ga, fillAlpha: 0.15 });
    D.label(ctx, "CHINA · TREASURY STOCK", 1260, 870, { color: C.cyan, alpha: ga, size: 12 });
  };
}

// Spoken line, visual direction, and score mood. scripts/episode-01-*.txt are generated from this.
const STORY = [
  {
    "title": "The mirror",
    "mood": "establish",
    "narration": "The trap is not a debt. It is a simple price rule. China finances the American government because the oil that feeds Chinese factories is billed in dollars, and the only safe pile large enough to store those dollars is United States Treasury debt. This is the whole picture. Beijing's industrial surplus shows up, on the far side of the glass, as Washington's room to borrow and spend. The mirror holds only while the next barrel must be bought in dollars. When that rule fails, the loop does not bend. It breaks.",
    "cue": "[VISUAL: MACRO on a single crude barrel. PULL BACK to a black globe. Ice-white invoice threads run from Gulf loading buoys to crimson Chinese ports, then rebound as a thicker thread into a blue vault stenciled U.S. TREASURIES. A mirror wipe shows the same flow as a rising bar of what Washington can borrow. Hold on the mirror.]"
  },
  {
    "title": "1971 to 1975",
    "mood": "history",
    "narration": "In nineteen seventy-one the United States stopped promising gold for dollars. The dollar no longer promised metal. It promised that the world would keep needing it, and that need had to be built. The deal with Saudi Arabia supplied it. Oil would be priced in dollars. Surpluses would be parked in dollar assets. Every importer, whatever its flag, would need dollars to buy energy. John Mearsheimer reads this as a great power locking in its lead. The leading state does not trust promises. It ties each partner's survival to its currency, so the lead grows. A rival currency that can buy oil claims the same oil. One side's safety is the other side's risk.",
    "cue": "[VISUAL: TIMELINE, 1971 to 1975, left to right. The gold peg snaps and falls off the bottom of frame. Saudi loading terminals lock to a blue dollar glyph. Importer capitals across Europe and Asia recolor as their oil contracts flip to dollar settlement. Lower-third caption: THE OIL BILL KEEPS THE DOLLAR ON TOP.]"
  },
  {
    "title": "One circuit",
    "mood": "system",
    "narration": "Jeffrey Sachs reads the same setup as a privilege the system later mistook for a law of nature. The financial center and the arms industry became one circuit. Deficits could run for years because foreigners had to hold the paper. The hub's mistake was to treat a lucky break in history as a permanent right, and then to turn the pipes that made the break possible into a weapon.",
    "cue": "[VISUAL: CIRCUIT DIAGRAM on black. Three blue nodes pulse as one loop: Pentagon buying, Treasury borrowing, Gulf oil money coming back. Older ideas for a shared world money sit at the frame edge and fade to gray. Label the center HUB. No faces. No flags except as small node markers.]"
  },
  {
    "title": "China enters",
    "mood": "motion",
    "narration": "China entered the loop through trade, not through an alliance. Joining the World Trade Organization opened demand in rich countries to Chinese goods. The surplus arrived in dollars. A rising share of the fuel that kept the factories running came by sea, from producers who billed in dollars. Professor Jiang treats the move as forced. At each round, Beijing could park dollars in Treasuries, or try to swap them and find the next oil cargo still for sale only in dollars. Recycling was the best move on the board. The Treasury market was deep enough to take the surplus without pushing the price against the seller. The arrangement held because China, alone, could not change what the world paid for energy.",
    "cue": "[VISUAL: ZOOM IN to the Yangtze and Pearl River deltas. Factory clusters burn white. Container arcs leave for North America and Europe. A return arc of dollar balances splits: one branch buys Gulf crude, the other settles into a bar chart of official Treasury holdings that climbs through the early 2010s and then bends down. China in crimson. Treasury bars in blue.]"
  },
  {
    "title": "Savings, and a hostage",
    "mood": "pressure",
    "narration": "Call the Treasury pile what it really is. They are savings, and they are a hostage. A hostage is savings that keep their worth only if the keeper shows restraint. Mearsheimer assumes that restraint cannot be known ahead of time. Intentions stay hidden. A careful state therefore puts a chance on a freeze, a seizure, or a political condition, even when Washington's public language is mild. For years that chance looked small. China's Treasuries helped pay for the American household that bought Chinese goods. Each side needed the other, and that need passed for trust.",
    "cue": "[VISUAL: SPLIT LEDGER. The same stack of Treasuries sits under two headings, RESERVE and HOSTAGE. A slider labeled FREEZE RISK rests near zero, marked LOOKS UNLIKELY. A thin white line connects the stack to American household buying, labeled EACH SIDE NEEDS THE OTHER. The slider does not move yet.]"
  },
  {
    "title": "The freeze",
    "mood": "shock",
    "narration": "The chance moved when the dollar system froze the savings of a nuclear-armed oil seller. What mattered was the lesson other countries drew. If government bonds held in American banks could be switched off over a weekend, then Treasuries had looked safer than they were for any country that might face Washington. Sachs places that choice in a habit of punishment from the top. Sanctions had replaced a negotiated deal. The cost was delayed. It was paid in trust. Surplus countries had treated dollar savings as normal savings, and then changed their minds. The change does not reverse when a spokesman calls the case unique. What people believe about the keeper is updated by deeds.",
    "cue": "[VISUAL: A central-bank reserve block over Russia desaturates and locks with a hard blue bracket. Identical pale blocks over other surplus countries flicker in sequence. A trust line on a graph steps down once and does not recover. Amber nodes for other big exporters brighten. No explosion, no courtroom.]"
  },
  {
    "title": "Around New York",
    "mood": "motion",
    "narration": "Mearsheimer draws a plain conclusion, with no sermon attached. China cannot stay the workshop of a system whose banker can switch off China's savings. Staying free to act means holding less national wealth in a form a rival can cancel. Real power slips if a country must ask permission to use its own savings. The answer is a small change at the edge, not a grand speech. Fewer fresh purchases of Treasuries. More gold. More state-to-state oil contracts. More swap lines between central banks. More attempts to settle trade on rails that do not end in New York.",
    "cue": "[VISUAL: China's blue Treasury bar flattens. Parallel pipes draw themselves in amber: a yuan payment rail, a gold allocation, a web of central-bank swap lines. New York's bank node stays blue and bright. The new pipes route around it and never touch it. Camera drifts along the amber pipes.]"
  },
  {
    "title": "The grip",
    "mood": "pressure",
    "narration": "Jiang names what holds. The grip is not the printing press. The grip is the web of partner banks, the message system that carries payment orders, and the law that can tell those banks to stop. An adversary breaks that grip where a real good changes hands. Energy is the right place, because energy is the biggest bill that keeps coming due. Currency pegs are the support underneath. A producer tied to the dollar prefers to be paid in dollars. A producer that can be paid in money it spends on Chinese machines, or in gold, or in a mixed basket, has a second way to get paid. Security patrons, arms suppliers, and long-term buyers change the political price of using that second way.",
    "cue": "[VISUAL: PAYMENT DIAGRAM. Invoice, partner bank, message rail, legal gate. The gate is labeled THE GRIP and glows blue. CUT TO the same oil cargo moving on an amber rail that skips the gate. A small line graph tracks dollars in China's next oil bill, with a flatter ghost line for a typical barrel.]"
  },
  {
    "title": "The next barrel",
    "mood": "fracture",
    "narration": "This is why the break is narrower than a collapse of the dollar. The loop that traps China does not need every barrel on earth priced in dollars. It needs China's next barrel priced in dollars. The pressure applies only to the next purchase, not to the oil already bought. The pile of Treasuries already owned can sit quietly for a full decade. New buying stops when export earnings no longer have to be turned into the currency of the next cargo. A Gulf producer, with enough output to cover the growth in China's imports by sea, bills a standing volume of its crude in yuan and clears that payment on a rail that never enters American hands. The volume need not be most of that producer's sales to the world. It must be most of the extra barrels China would otherwise have bought with new dollars.",
    "cue": "[VISUAL: ZOOM IN on Persian Gulf loading terminals at night. One contract thread, thicker than the others, leaves a single buoy and lands on the Chinese coast in amber, tagged YUAN, with a gap where a New York detour would have been. Caption, held: CHINA'S NEXT BARREL, NOT EVERY BARREL. Beneath, new Treasury purchases fall below the line needed to hold the pile steady.]"
  },
  {
    "title": "Buying, the pile, the payment",
    "mood": "system",
    "narration": "Then the math changes direction. China's goods surplus can continue. Dollars can still arrive from buyers in the United States and in allied markets. The forced bid for Treasuries, the bid that existed only because the oil seller would take nothing else, is gone. What remains is a choice about where to keep the money, and that choice feels the hostage problem. Washington's sensible reply to a yuan oil contract is a reminder that the pile already held can still be frozen. The reminder is meant to scare others away from leaving. If plans stay hidden, the reminder points the wrong way. It raises the guessed chance of confiscation, and so it raises the gain from cutting the pile before a crisis rather than during one. Sachs would call this the center writing its own exit. Each show of force teaches surplus countries that a second way to pay is not a taste. It is insurance against seizure.",
    "cue": "[VISUAL: THREE-PANEL GRAPH, moving with the narration. Top, NEW BUYING: fresh official Treasury buying drops after the yuan contract. Middle, THE PILE ALREADY HELD: it starts a controlled decline. A blue line labeled THREAT TO FREEZE THE PILE makes that decline steeper. Bottom: the share paid outside dollars rises.]"
  },
  {
    "title": "One machine",
    "mood": "shock",
    "narration": "The arms industry arrives as another claim on the same loop. A dollar that foreign central banks must buy is a dollar that helps fund the security services of the leading state. If official foreign demand thins out, the interest needed to sell new Treasury debt has to come from home savers and allied private money. That shift is a fact about power. Higher borrowing costs tax the country that uses financial sanctions as a tool. Jiang closes on one plain point. The weapon and the funding base are one object. Use of the weapon wears down the funding base. Depreciation stays slow while China's next barrel forces the recycling. It speeds up after the barrel moves, because that barrel was the requirement.",
    "cue": "[VISUAL: A single object, half munition and half Treasury bond, rotates and splits along a seam. Left piece stays blue. Right piece fades. A cost-of-borrowing line trends up as a foreign-government-buying line trends down. Only the two lines on a black field.]"
  },
  {
    "title": "One crack",
    "mood": "fracture",
    "narration": "Nothing here requires Beijing to win a popularity contest for its currency. A spare way to pay can be messy, expensive, and still enough. Local money, gold as a neutral bridge, and a basket instead of the dollar are enough if they cover energy and some machinery. The United States remains the deepest market for savings. Allies remain inside the blue system because their protection is written there, and because depending on it limits what they can plan. The break is not the whole world walking out. The break is the exit of the one surplus economy whose oil bill made the mirror necessary.",
    "cue": "[VISUAL: WORLD MAP, borders quiet. Allied money centers stay blue and steady. China's energy routes with a handful of producers glow amber. A glass mirror cracks only along the path factory, barrel, bond. Every other dollar path on the map stays intact. Slow drift, no shake.]"
  },
  {
    "title": "The refusal",
    "mood": "close",
    "narration": "Mearsheimer adds the last limit. The leading state will not accept a gentle loss of its money weapon if it can make leaving expensive. Tariffs, technology denial, and the threat of being cut off from finance are attempts to restore the old payoffs. They are also new information. They tell the country that the leading state's intentions are hostile enough to justify speed. The two sides can therefore jump from a slow shift to a fast shift without either side wanting a crisis. That is how the trap ends. It is not a crash of the dollar against every good. It is a refusal, at the edge, to park China's surplus in claims on the American state. The mirror does not shatter everywhere. It shatters along the single path that ran from the factory, to the barrel, to the bond.",
    "cue": "[VISUAL: SLOW ZOOM OUT. The cracked mirror holds center frame. Tariff walls, export-control gates, and sanction lists fade in as thin blue barriers. Amber corridors thicken in response, not everywhere, only on the energy path. End on China's next barrel, settled outside the mirror, with the Treasury pile quietly declining on a graph beneath. Hold four seconds. Cut to black.]"
  }
];

const DRAWS = [s1, s2, s3, s4, s5, s6, s7, s8, s9, s10, s11, s12, s13];
if (DRAWS.length !== STORY.length) throw new Error(`episode 1 draws ${DRAWS.length} vs story ${STORY.length}`);

export default {
  title: "The Dollar Trap",
  subtitle: "How an oil bill in dollars trapped China",
  short: "The Dollar Trap",
  // Pull mid-sentence pictures forward a little, so the frame changes before the line finishes.
  pace: 0.9,
  scenes: STORY.map((scene, i) => ({ ...scene, draw: DRAWS[i] })),
};
