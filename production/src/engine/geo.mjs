// Map layer: Natural Earth geometry (world-atlas) projected once into Path2D,
// then moved with an affine camera so zooms and pans stay cheap per frame.
import fs from "node:fs";
import path from "node:path";
import { feature, mesh } from "topojson-client";
import { geoArea, geoBounds, geoContains, geoGraticule10, geoPath, geoOrthographic } from "d3-geo";
import { Path2D } from "@napi-rs/canvas";
import { ROOT } from "../config.mjs";
import { C, W, H, lerp, rgba } from "./core.mjs";
export { lerp };

// Drop degenerate rings with reversed winding (d3 reads them as "the whole sphere");
// no real land polygon covers more than a hemisphere.
function sanitize(fc) {
  for (const f of fc.features) {
    const g = f.geometry;
    if (!g) continue;
    if (g.type === "MultiPolygon") g.coordinates = g.coordinates.filter((poly) => geoArea({ type: "Polygon", coordinates: poly }) < 2 * Math.PI);
    else if (g.type === "Polygon" && geoArea(g) >= 2 * Math.PI) f.geometry = { type: "MultiPolygon", coordinates: [] };
  }
  return fc;
}

const cache = {};
export function world(res = "50m") {
  if (cache[res]) return cache[res];
  const topo = JSON.parse(fs.readFileSync(path.join(ROOT, "node_modules/world-atlas", `countries-${res}.json`)));
  const countries = sanitize(feature(topo, topo.objects.countries));
  const land = sanitize(feature(topo, topo.objects.land));
  const borders = mesh(topo, topo.objects.countries, (a, b) => a !== b);
  const byId = new Map(countries.features.map((f) => [String(f.id), f]));

  // Natural Earth folds Crimea into Russia's multipolygon; split it out so the
  // Ukraine maps can treat it explicitly.
  const ru = byId.get("643");
  let crimea = null;
  let russiaNoCrimea = ru;
  if (ru && ru.geometry.type === "MultiPolygon") {
    const idx = ru.geometry.coordinates.findIndex((poly) =>
      geoContains({ type: "Feature", geometry: { type: "Polygon", coordinates: poly } }, [33.52, 44.6]),
    );
    if (idx >= 0) {
      crimea = { type: "Feature", id: "CRIMEA", properties: { name: "Crimea" }, geometry: { type: "Polygon", coordinates: ru.geometry.coordinates[idx] } };
      russiaNoCrimea = {
        ...ru,
        geometry: { type: "MultiPolygon", coordinates: ru.geometry.coordinates.filter((_, i) => i !== idx) },
      };
    }
  }
  cache[res] = { countries, land, borders, byId, crimea, russiaNoCrimea };
  return cache[res];
}

export const ID = {
  usa: "840", china: "156", russia: "643", ukraine: "804", saudi: "682", iran: "364", iraq: "368", kuwait: "414",
  uae: "784", qatar: "634", oman: "512", germany: "276", france: "250", italy: "380", poland: "616", slovakia: "703",
  hungary: "348", romania: "642", moldova: "498", belarus: "112", finland: "246", taiwan: "158", japan: "392",
  skorea: "410", nkorea: "408", netherlands: "528", kazakhstan: "398", myanmar: "104", malaysia: "458",
  indonesia: "360", singapore: "702", pakistan: "586", india: "356", uk: "826", turkey: "792", georgia: "268",
  czechia: "203", austria: "040", belgium: "056", spain: "724", portugal: "620", lithuania: "440", latvia: "428",
  estonia: "233", bulgaria: "100", greece: "300", sweden: "752", norway: "578", denmark: "208", philippines: "608",
  vietnam: "704", thailand: "764", sriLanka: "144", bangladesh: "050", mongolia: "496", australia: "036",
  canada: "124", mexico: "484", brazil: "076", southAfrica: "710", nigeria: "566", angola: "024", egypt: "818",
  croatia: "191", slovenia: "705", serbia: "688", switzerland: "756", luxembourg: "442", ireland: "372",
  albania: "008", northMacedonia: "807", montenegro: "499", bosnia: "070", azerbaijan: "031", armenia: "051",
  brunei: "096", cambodia: "116", laos: "418", timor: "626", png: "598", venezuela: "862", argentina: "032", chile: "152",
};

export const NATO = ["840", "124", "826", "250", "276", "380", "724", "620", "056", "528", "442", "208", "578", "352", "300", "792", "616", "203", "348", "440", "428", "233", "703", "705", "100", "642", "008", "191", "499", "807", "246", "752"];
export const WARSAW_PACT_EX = ["616", "203", "703", "348", "642", "100", "440", "428", "233", "276"];
export const BRICS = ["076", "643", "356", "156", "710", "818", "231", "364", "784", "360", "682"];

// ---------------------------------------------------------------- MapView
export class MapView {
  // projection: a configured d3 projection (fixed rotation). Camera moves are affine on top.
  constructor(projection, { res = "50m", bbox, extra = [] } = {}) {
    this.proj = projection;
    this.res = res;
    const wd = world(res);
    this.wd = wd;
    // Clip geometry to the region of interest so detailed (10m) maps stay cheap per frame.
    if (bbox) {
      const [[x0, y0], [x1, y1]] = bbox;
      const pts = [];
      for (let i = 0; i <= 8; i++) for (const y of [y0, y1]) pts.push(projection([lerp(x0, x1, i / 8), y]));
      for (let i = 0; i <= 8; i++) for (const x of [x0, x1]) pts.push(projection([x, lerp(y0, y1, i / 8)]));
      const xs = pts.filter(Boolean).map((p) => p[0]);
      const ys = pts.filter(Boolean).map((p) => p[1]);
      // generous margin so zoomed-out or panning cameras never reveal the clip edge
      const mx = Math.max(500, (Math.max(...xs) - Math.min(...xs)) * 0.6);
      const my = Math.max(400, (Math.max(...ys) - Math.min(...ys)) * 0.6);
      projection.clipExtent([[Math.min(...xs) - mx, Math.min(...ys) - my], [Math.max(...xs) + mx, Math.max(...ys) + my]]);
    }
    const gp = geoPath(projection);
    const keep = (f) => {
      if (!bbox) return true;
      const [[a, b], [c, d]] = geoBounds(f);
      const [[bx0, by0], [bx1, by1]] = bbox;
      const padX = (bx1 - bx0) * 0.6;
      const padY = (by1 - by0) * 0.6;
      const [[x0, y0], [x1, y1]] = [[bx0 - padX, Math.max(-90, by0 - padY)], [bx1 + padX, Math.min(90, by1 + padY)]];
      if (d < y0 || b > y1) return false;
      // antimeridian-crossing geometry spans [a, 180] and [-180, c]
      const spans = c < a ? [[a, 180], [-180, c]] : [[a, c]];
      return spans.some(([s0, s1]) => !(s1 < x0 || s0 > x1));
    };
    this.paths = new Map();
    for (const f of wd.countries.features) {
      if (!keep(f)) continue;
      const g = f.id === "643" ? wd.russiaNoCrimea : f;
      this.paths.set(String(f.id), new Path2D(gp(g) || ""));
    }
    if (wd.crimea) this.paths.set("CRIMEA", new Path2D(gp(wd.crimea) || ""));
    for (const f of extra) this.paths.set(String(f.id), new Path2D(gp(f) || ""));
    // Keep only land polygons that touch the region (Antarctica et al. can invert under clipping).
    let land = wd.land;
    if (bbox) {
      const feats = wd.land.type === "FeatureCollection" ? wd.land.features : [wd.land];
      const all = feats.flatMap((f) => (f.geometry.type === "MultiPolygon" ? f.geometry.coordinates : [f.geometry.coordinates]));
      const polys = all.filter((poly) => keep({ type: "Feature", geometry: { type: "Polygon", coordinates: poly } }));
      land = { type: "Feature", geometry: { type: "MultiPolygon", coordinates: polys } };
    }
    this.land = new Path2D(gp(land) || "");
    this.borders = new Path2D(gp(wd.borders) || "");
    this.graticule = new Path2D(gp(geoGraticule10()) || "");
    this.gp = gp;
    // keep the clip for later pathOf() calls; point projection is unaffected by clipExtent
    this.cam = { x: W / 2, y: H / 2, k: 1 };
  }

  // Path2D for an arbitrary GeoJSON feature/geometry in this projection.
  pathOf(geo) {
    return new Path2D(this.gp(geo) || "");
  }

  camAt(center, zoom = 1) {
    const [x, y] = this.proj(center);
    return { x, y, k: zoom };
  }

  // Interpolate cameras: centers linearly, zoom geometrically.
  static mixCam(a, b, t) {
    return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), k: Math.exp(lerp(Math.log(a.k), Math.log(b.k), t)) };
  }

  setCam(cam) {
    this.cam = cam;
    return this;
  }

  apply(ctx) {
    const { x, y, k } = this.cam;
    ctx.translate(W / 2, H / 2);
    ctx.scale(k, k);
    ctx.translate(-x, -y);
  }

  xy(lonlat) {
    const p = this.proj(lonlat);
    if (!p) return [NaN, NaN];
    const { x, y, k } = this.cam;
    return [(p[0] - x) * k + W / 2, (p[1] - y) * k + H / 2];
  }

  line(lonlats) {
    return lonlats.map((ll) => this.xy(ll));
  }

  // Draw a path in projection space with screen-constant stroke width.
  draw(ctx, p, { fill, stroke, width = 1, alpha = 1, glow = 0, dash } = {}) {
    if (!p || alpha <= 0) return;
    ctx.save();
    ctx.globalAlpha *= alpha;
    this.apply(ctx);
    if (fill) {
      ctx.fillStyle = fill;
      if (glow) {
        ctx.shadowColor = fill;
        ctx.shadowBlur = glow;
      }
      ctx.fill(p);
      ctx.shadowBlur = 0;
    }
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = width / this.cam.k;
      ctx.lineJoin = "round";
      if (dash) ctx.setLineDash(dash.map((d) => d / this.cam.k));
      if (glow && !fill) {
        ctx.shadowColor = stroke;
        ctx.shadowBlur = glow;
      }
      ctx.stroke(p);
    }
    ctx.restore();
  }

  country(id) {
    return this.paths.get(String(id));
  }

  // Run fn with the canvas clipped to a projected path (fn draws in screen space).
  withClip(ctx, p, fn) {
    ctx.save();
    const m = ctx.getTransform();
    this.apply(ctx);
    ctx.clip(p);
    ctx.setTransform(m);
    fn();
    ctx.restore();
  }

  // Path of several country ids (and CRIMEA) merged.
  union(ids) {
    const p = new Path2D();
    for (const id of ids) {
      const q = this.paths.get(String(id));
      if (q) p.addPath(q);
    }
    return p;
  }

  // Standard dark base map. colors: { id: fillColor } overrides.
  base(ctx, { colors = {}, borders = true, graticule = false, landFill = C.land, coast = C.border, alpha = 1, borderAlpha = 0.9 } = {}) {
    if (graticule) this.draw(ctx, this.graticule, { stroke: rgba(C.mid, 0.06), width: 1, alpha });
    this.draw(ctx, this.land, { fill: landFill, alpha });
    for (const [id, col] of Object.entries(colors)) if (col) this.draw(ctx, this.country(id), { fill: col, alpha });
    if (borders) this.draw(ctx, this.borders, { stroke: C.border, width: 0.8, alpha: alpha * borderAlpha });
    this.draw(ctx, this.land, { stroke: coast, width: 1, alpha });
  }
}

// ---------------------------------------------------------------- Globe (re-projected per frame)
export class Globe {
  constructor({ res = "110m", scale = 420, cx = W / 2, cy = H / 2 } = {}) {
    this.wd = world(res);
    this.proj = geoOrthographic().scale(scale).translate([cx, cy]).clipAngle(90).precision(0.6);
    this.gp = geoPath(this.proj);
  }

  set({ rotate, scale, cx, cy }) {
    if (rotate) this.proj.rotate(rotate);
    if (scale) this.proj.scale(scale);
    if (cx !== undefined) this.proj.translate([cx, cy]);
    return this;
  }

  visible(lonlat) {
    const r = this.proj.rotate();
    const c = [-r[0], -r[1]];
    const toRad = Math.PI / 180;
    const cosd =
      Math.sin(c[1] * toRad) * Math.sin(lonlat[1] * toRad) +
      Math.cos(c[1] * toRad) * Math.cos(lonlat[1] * toRad) * Math.cos((lonlat[0] - c[0]) * toRad);
    return cosd > 0.02;
  }

  xy(lonlat) {
    return this.proj(lonlat);
  }

  draw(ctx, { colors = {}, alpha = 1, landFill = C.land, rim = C.cyan } = {}) {
    if (alpha <= 0) return;
    const [cx, cy] = this.proj.translate();
    const r = this.proj.scale();
    ctx.save();
    ctx.globalAlpha *= alpha;
    // sphere
    const g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.35, r * 0.1, cx, cy, r);
    g.addColorStop(0, "#151b24");
    g.addColorStop(1, "#090b0f");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    // graticule
    ctx.beginPath();
    this.gp.context(ctx)(geoGraticule10());
    ctx.strokeStyle = rgba(C.mid, 0.07);
    ctx.lineWidth = 1;
    ctx.stroke();
    // land
    ctx.beginPath();
    this.gp(this.wd.land);
    ctx.fillStyle = landFill;
    ctx.fill();
    for (const [id, col] of Object.entries(colors)) {
      const f = this.wd.byId.get(String(id));
      if (!f || !col) continue;
      ctx.beginPath();
      this.gp(f);
      ctx.fillStyle = col;
      ctx.fill();
    }
    ctx.beginPath();
    this.gp(this.wd.borders);
    ctx.strokeStyle = rgba(C.border, 0.9);
    ctx.lineWidth = 0.7;
    ctx.stroke();
    ctx.beginPath();
    this.gp(this.wd.land);
    ctx.strokeStyle = "#2f3a48";
    ctx.lineWidth = 1;
    ctx.stroke();
    this.gp.context(null);
    // rim light
    ctx.strokeStyle = rgba(rim, 0.35);
    ctx.lineWidth = 1.5;
    ctx.shadowColor = rim;
    ctx.shadowBlur = 30;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

// ---------------------------------------------------------------- gazetteer
export const P = {
  // Gulf & energy
  rasTanura: [50.16, 26.64], juaymah: [50.05, 26.85], yanbu: [38.06, 24.09], fujairah: [56.36, 25.12], kharg: [50.32, 29.24],
  hormuz: [56.45, 26.45], basra: [50.2, 29.7], riyadh: [46.72, 24.69], mina: [48.2, 29.07], doha: [51.53, 25.29],
  // China
  beijing: [116.4, 39.9], shanghai: [121.47, 31.23], ningbo: [121.85, 29.87], qingdao: [120.38, 36.07], dalian: [121.6, 38.91],
  tianjin: [117.7, 39.0], guangzhou: [113.26, 23.13], shenzhen: [114.06, 22.54], hongkong: [114.17, 22.3], xiamen: [118.09, 24.48],
  zhanjiang: [110.36, 21.27], wuhan: [114.3, 30.6], nanjing: [118.8, 32.06], chongqing: [106.55, 29.56], kunming: [102.71, 25.04],
  daqing: [125.1, 46.59], kashgar: [75.99, 39.47], alashankou: [82.57, 45.17], urumqi: [87.6, 43.8],
  // US & allies
  washington: [-77.04, 38.9], newYork: [-74.0, 40.71], phoenix: [-112.07, 33.45], tokyo: [139.69, 35.69], seoul: [126.98, 37.57],
  pyeongtaek: [127.1, 36.99], kumamoto: [130.71, 32.8], veldhoven: [5.4, 51.42], dresden: [13.74, 51.05], london: [-0.12, 51.5],
  // Russia / Ukraine / Europe
  moscow: [37.62, 55.75], kyiv: [30.52, 50.45], kharkiv: [36.23, 49.99], odesa: [30.73, 46.48], dnipro: [35.04, 48.46],
  zaporizhzhia: [35.14, 47.84], kherson: [32.62, 46.64], sevastopol: [33.52, 44.6], lviv: [24.03, 49.84], mariupol: [37.55, 47.1],
  donetsk: [37.8, 48.0], luhansk: [39.3, 48.57], simferopol: [34.1, 44.95], kerch: [36.47, 45.36], warsaw: [21.01, 52.23],
  bucharest: [26.1, 44.43], minsk: [27.56, 53.9], helsinki: [24.94, 60.17], berlin: [13.4, 52.52], brussels: [4.35, 50.85],
  paris: [2.35, 48.86], rome: [12.5, 41.9], milan: [9.19, 45.46], prague: [14.42, 50.08], budapest: [19.04, 47.5],
  bratislava: [17.1, 48.15], vienna: [16.37, 48.21], frankfurt: [8.68, 50.11], munich: [11.58, 48.14], hamburg: [9.99, 53.55],
  ludwigshafen: [8.43, 49.48], wilhelmshaven: [8.13, 53.52], brunsbuttel: [9.14, 53.89], stade: [9.48, 53.6], mukran: [13.63, 54.47],
  lubmin: [13.64, 54.13], vyborg: [28.75, 60.71], ustLuga: [28.4, 59.68], bornholm: [15.0, 55.15], rzeszow: [22.0, 50.04],
  constanta: [28.63, 44.17], istanbul: [28.98, 41.01], novorossiysk: [37.77, 44.72], rhineMouth: [4.1, 51.95], urals: [59.5, 56.0],
  // Southeast Asia straits
  singapore: [103.82, 1.29], malacca: [102.25, 2.19], portKlang: [101.39, 3.0], penang: [100.33, 5.41], sabang: [95.32, 5.89],
  sunda: [105.85, -5.95], lombok: [115.7, -8.55], makassar: [118.2, -2.0], ombai: [125.0, -8.4], kyaukphyu: [93.55, 19.43],
  gwadar: [62.33, 25.12], karachi: [67.0, 24.86], colombo: [79.86, 6.93],
  // Russia east / Arctic
  kozmino: [133.04, 42.73], skovorodino: [123.93, 53.99], vladivostok: [131.88, 43.12], murmansk: [33.08, 68.97],
  sabetta: [72.06, 71.27], bering: [-169.0, 66.0], pevek: [170.3, 69.7], dikson: [80.55, 73.5], atasu: [71.64, 48.68],
  // Taiwan & chips
  taipei: [121.56, 25.04], hsinchu: [120.97, 24.8], taichung: [120.68, 24.15], tainan: [120.21, 22.99], kaohsiung: [120.3, 22.62],
  // misc
  capeTown: [18.42, -33.92], capeGoodHope: [18.47, -34.36], bonny: [7.15, 4.43], luanda: [13.23, -8.84], suez: [32.55, 30.0],
  babElMandeb: [43.4, 12.6], houston: [-95.37, 29.76], sabinePass: [-93.87, 29.73], panama: [-79.9, 9.1],
};

// Approximate tanker lanes (lon/lat waypoints).
export const LANES = {
  gulfToMalacca: [P.rasTanura, [52.6, 26.6], P.hormuz, [58.5, 24.0], [62, 20], [70, 13], [77, 7.6], [80.5, 5.6], [86, 5.8], [92, 6.2], [95.2, 6.3], [97.8, 5.2], [99.8, 3.6], [101.2, 2.6], [102.8, 1.7], [103.75, 1.2]],
  malaccaToChina: [[103.75, 1.2], [104.6, 1.6], [106.5, 4.0], [109.0, 8.5], [111.5, 13.0], [113.5, 18.0], [114.3, 21.9]],
  malaccaToShanghai: [[103.75, 1.2], [104.6, 1.6], [106.5, 4.0], [109.0, 8.5], [111.5, 13.0], [114.5, 18.0], [118.5, 22.2], [121.0, 26.5], [122.3, 30.6]],
  africaToMalacca: [P.bonny, [4.0, 1.0], [6.0, -10.0], [12.0, -28.0], [19.0, -36.5], [30.0, -36.0], [50.0, -28.0], [70.0, -15.0], [88.0, -5.0], [96.0, 3.0], [97.8, 5.2]],
  sundaRoute: [[80.5, 5.6], [90.0, -2.0], [100.0, -6.5], [104.6, -6.6], P.sunda, [106.8, -4.0], [107.5, -1.0], [106.5, 4.0]],
  lombokRoute: [[80.5, 5.6], [95.0, -8.0], [110.0, -10.8], [115.5, -9.6], P.lombok, [116.3, -5.5], [118.3, -2.0], [118.9, 1.5], [121.5, 6.5], [121.5, 12.0], [120.6, 18.5], [120.0, 21.5]],
  ombaiRoute: [[95.0, -8.0], [112.0, -12.5], [124.0, -9.8], P.ombai, [126.5, -6.5], [127.5, -2.0], [127.0, 3.0], [125.5, 10.0], [123.0, 18.0], [121.5, 23.0]],
  kozminoToChina: [P.kozmino, [131.5, 40.0], [129.5, 36.0], [126.5, 34.0], [123.5, 32.5], P.shanghai],
  americasToChina: [[-80.0, 7.0], [-110.0, 14.0], [-140.0, 22.0], [-170.0, 28.0], [170.0, 31.0], [150.0, 32.0], [135.0, 31.0], P.shanghai],
  nsr: [P.murmansk, [45.0, 71.0], [58.0, 72.5], P.sabetta, [80.0, 75.5], [100.0, 77.8], [120.0, 76.0], [140.0, 74.0], [160.0, 71.0], [175.0, 69.5], P.bering, [-173.0, 63.0], [-178.0, 57.0], [170.0, 52.0], [160.0, 48.0], [150.0, 44.0], [140.0, 40.0], P.shanghai],
};

// Pipelines (approximate routes).
export const PIPES = {
  myanmar: [P.kyaukphyu, [94.6, 20.6], [96.1, 21.97], [97.2, 23.5], [98.0, 24.1], [100.2, 24.9], P.kunming],
  kazakhstan: [P.atasu, [74.5, 47.0], [78.5, 46.3], [80.8, 45.6], P.alashankou, [85.0, 44.6], P.urumqi],
  espoDaqing: [P.skovorodino, [124.3, 53.2], [124.8, 51.0], [124.7, 49.0], P.daqing],
  espoPacific: [P.skovorodino, [127.5, 52.0], [131.0, 49.0], [134.0, 48.4], [134.5, 46.0], [133.4, 44.0], P.kozmino],
  powerOfSiberia: [[123.0, 61.5], [124.5, 58.0], [125.5, 55.0], [127.5, 50.25], [126.6, 47.5], [125.2, 45.0], [123.5, 42.5], [121.0, 41.0], [117.0, 39.5]],
  nordStream: [P.vyborg, [27.0, 60.1], [24.0, 59.6], [21.0, 58.6], [19.4, 57.0], [17.5, 55.9], P.bornholm, [14.2, 54.6], P.lubmin],
  nordStream2: [P.ustLuga, [26.5, 59.9], [23.5, 59.3], [20.8, 58.3], [19.1, 56.8], [17.2, 55.7], [15.4, 55.0], [14.2, 54.5], [13.66, 54.15]],
  druzhba: [[52.0, 54.6], [44.0, 54.0], [36.0, 53.3], [30.0, 52.5], [24.0, 52.1], [20.0, 52.2], [14.3, 53.1]],
  gwadarKashgar: [P.gwadar, [64.5, 26.8], [67.0, 29.0], [69.0, 31.5], [71.5, 33.9], [73.1, 33.7], [74.5, 35.9], [75.0, 37.5], P.kashgar],
};

// Approximate mountain crests (for stylized relief hachures).
export const MOUNTAINS = {
  carpathians: [[17.4, 48.6], [19.0, 49.25], [20.6, 49.35], [22.3, 49.1], [23.8, 48.6], [24.9, 48.0], [25.6, 47.3], [26.0, 46.3], [25.6, 45.6], [24.3, 45.4], [22.8, 45.4], [22.2, 44.8]],
  alps: [[5.9, 44.2], [6.9, 45.3], [7.5, 45.9], [8.8, 46.4], [10.2, 46.6], [11.8, 46.9], [13.3, 47.2], [15.0, 47.5], [16.0, 47.6]],
  caucasus: [[37.4, 44.8], [39.5, 43.8], [41.5, 43.3], [43.5, 42.8], [45.5, 42.3], [47.5, 41.5], [49.3, 40.6]],
  urals: [[59.5, 64.0], [59.2, 61.5], [59.0, 59.0], [59.3, 56.5], [58.8, 54.5], [58.4, 52.5], [58.0, 51.0]],
  pyrenees: [[-1.8, 43.3], [0.0, 42.8], [1.7, 42.5], [3.1, 42.4]],
  balkans: [[22.4, 43.5], [23.6, 42.9], [25.2, 42.8], [26.8, 42.7]],
};

export const RIVERS = {
  dnieper: [[33.0, 55.0], [31.5, 53.9], [30.5, 52.8], [30.45, 51.6], [30.55, 50.9], [30.52, 50.45], [31.2, 49.95], [31.8, 49.5], [32.6, 49.25], [33.42, 49.07], [34.4, 48.72], [35.04, 48.46], [35.14, 47.84], [34.88, 47.6], [34.4, 47.57], [33.37, 46.75], [32.62, 46.64], [32.2, 46.58], [31.6, 46.55]],
  yangtze: [[104.0, 28.8], [106.55, 29.56], [108.4, 30.8], [111.3, 30.7], [112.9, 30.0], [114.3, 30.6], [115.9, 29.7], [117.0, 30.5], [118.4, 31.4], [118.8, 32.06], [120.3, 31.9], [121.2, 31.6], [121.9, 31.25]],
  pearl: [[108.3, 23.5], [110.3, 23.4], [111.8, 23.2], [112.9, 23.1], [113.3, 22.8], [113.6, 22.3]],
  rhine: [[9.5, 47.6], [7.6, 47.6], [7.8, 48.6], [8.43, 49.48], [8.27, 50.0], [7.6, 50.36], [6.96, 50.94], [6.8, 51.4], [6.1, 51.85], [5.0, 51.9], [4.1, 51.95]],
};

// Approximate line of contact in Ukraine (north to south, then down the Dnieper to the sea).
// Dated in src/figures.mjs (contactLine). Change the trace and the as-of date together.
export const CONTACT_LINE = [
  [37.7, 50.35], [37.62, 49.9], [37.95, 49.45], [38.15, 49.05], [38.0, 48.6], [37.75, 48.3], [37.25, 48.2], [37.1, 47.95],
  [36.85, 47.8], [36.3, 47.62], [35.84, 47.45], [35.3, 47.44], [34.75, 47.48], [34.2, 47.42], [33.37, 46.75], [32.62, 46.62], [31.95, 46.52],
];

// Polygon of Russian-held territory east/south of the contact line (clip to land when drawing).
export const OCCUPIED = [
  ...CONTACT_LINE,
  [31.6, 46.3], [32.0, 45.3], [33.0, 44.2], [36.8, 44.6], [38.5, 46.6], [40.2, 47.5], [40.2, 49.6], [39.0, 50.1], [37.7, 50.35],
];
