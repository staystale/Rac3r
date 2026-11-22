// tools/spikestrace.mjs - SPIKES PEAK'S ROAD AS GAME DATA (the hill climb, owner 11-22: the full
// true course at half scale, real grades, tight hairpins that stay smooth and connected). From the
// real Pikes Peak Highway (tools/venues/spikes.osm.json: (c) OpenStreetMap contributors, ODbL) and
// its heights (tools/venues/spikes.elev.json: USGS 3DEP via Open Topo Data, 20 m samples; fetched
// with --fetch, only the points' coordinates sent, 100 a call, 1.1 s apart):
//   1. the ways chained from the summit, the race course (COURSE_M) start -> summit, every FINE_M;
//   2. at half scale (SCALE game m per real m), x east, y SOUTH (the screen's down), the start at 0,
//      smoothed (Taubin: no shrink, as world/subtrack.ts traceTrack; the ends held) - the map's
//      straight pieces between its nodes were kinks of 10-15 deg at game scale;
//   3. the hairpins kept as tight as the real ones (owner 11-22: "tight is ok, but keep it looking
//      smooth and connected"): only one whose road would FOLD - its centre line tighter than
//      FOLD_R, half the road plus the inside edge's own least radius - pushed apart AS A WHOLE:
//      scaled up about its own centre to FOLD_R, eased back to none along both legs over EASE_M,
//      the road past it unmoved (a hairpin opened by smoothing alone shrinks - its legs drawn
//      together until it vanishes: NOTES 11-09); no two parts of the road closer than ROAD_M;
//   4. the heights smoothed (a median over MEDIAN_N samples, then a mean over MEAN_N: a 26.5 % /
//      100 m spike at a hairpin was the DEM, not the road) and halved with the length (the real
//      grades kept);
//   5. written to src/world/levels/venues/spikes.ts (the generated map data's folder): the road
//      every OUT_M game m and its rise there.
// Reports the course, the turns, the grades, every hairpin before / after, and the closest two
// parts of the road come (centre to centre, parts over APART_M apart along it).
//   node tools/spikestrace.mjs [--fetch] [--dry]
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const OSM = 'tools/venues/spikes.osm.json', ELEV = 'tools/venues/spikes.elev.json';
const OUT = 'src/world/levels/venues/spikes.ts';
// the summit (the road's top end is the way end nearest it), lat/lon
const SUMMIT = [38.8405, -105.0442];
// real m: the heights' sample spacing; the race course (12.42 miles, the event's own figure); the
// fine resample the geometry is worked on
const STEP_M = 20, COURSE_M = 19988, FINE_M = 2;
// game m per real m (owner 11-22: half scale)
const SCALE = 0.5;
// game m: the road's width (the twisty road's two 3.5 m lanes and 0.6 m shoulders:
// highway/presets.ts); the inside edge's least radius; the least centre-line radius (the road does
// not fold); the band each push eases out over along its legs; the output spacing
const ROAD_M = 8.2, EDGE_R = 1, FOLD_R = ROAD_M / 2 + EDGE_R, EASE_M = 40, OUT_M = 2;
// a hairpin: a turn past HAIRPIN_DEG within HAIRPIN_SPAN_M game m
const HAIRPIN_DEG = 100, HAIRPIN_SPAN_M = 40;
// heights: the median's and the mean's samples (20 m apart, real)
const MEDIAN_N = 9, MEAN_N = 9;
// game m: road parts this far apart along it are checked for coming close
const APART_M = 60;
const EARTH_M = 6371008.8, RAD = Math.PI / 180;

/** lat/lon -> local metres (x east, y north) about an origin. */
const toLocal = (lat, lon, origin) => [(lon - origin[1]) * RAD * EARTH_M
  * Math.cos(origin[0] * RAD), (lat - origin[0]) * RAD * EARTH_M];

/** Chains the OSM ways end to end from the one nearest the summit (top -> down). */
function chainRoad(osm) {
  const ways = osm.elements.filter((el) => el.type === 'way');
  const ends = new Map();
  for (const way of ways) for (const node of [way.nodes[0], way.nodes[way.nodes.length - 1]]) {
    if (!ends.has(node)) ends.set(node, []);
    ends.get(node).push(way);
  }
  const dist = (pt) => Math.hypot(...toLocal(pt.lat, pt.lon, SUMMIT));
  let best = null;
  for (const way of ways) for (const atEnd of [false, true]) {
    const pt = atEnd ? way.geometry[way.geometry.length - 1] : way.geometry[0];
    if (!best || dist(pt) < best.d) best = { d: dist(pt), way, atEnd };
  }
  const used = new Set(), pts = [];
  let way = best.way, reversed = best.atEnd;
  while (way) {
    used.add(way.id);
    const geom = reversed ? [...way.geometry].reverse() : way.geometry;
    const nodes = reversed ? [...way.nodes].reverse() : way.nodes;
    pts.push(...(pts.length ? geom.slice(1) : geom).map((pt) => [pt.lat, pt.lon]));
    const tail = nodes[nodes.length - 1];
    const next = (ends.get(tail) || []).filter((other) => !used.has(other.id));
    way = next[0] || null;
    if (way) reversed = way.nodes[way.nodes.length - 1] === tail;
  }
  return pts;
}

/** Resamples a polyline of [x, y] every step (its own units). */
function resample(pts, step) {
  const out = [pts[0]];
  let carry = step;
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1], [bx, by] = pts[i], len = Math.hypot(bx - ax, by - ay);
    let at = carry;
    for (; at <= len; at += step) out.push([ax + (bx - ax) * at / len, ay + (by - ay) * at / len]);
    carry = at - len;
  }
  return out;
}

// the smoothing: passes of a lambda / mu pair over KERN samples either side (traceTrack's own)
const SMOOTH_PASSES = 10, KERN = 3, LAMBDA = 0.5, MU = -0.53;

/** Taubin smoothing of an open path (its ends held): corners rounded, nothing shrunk. */
function smoothOpen(path) {
  let cur = path.map((pt) => [...pt]);
  const pass = (factor) => cur.map((pt, i) => {
    if (i < KERN || i + KERN >= cur.length) return pt;
    let sx = 0, sy = 0;
    for (let k = -KERN; k <= KERN; k++) if (k) { sx += cur[i + k][0]; sy += cur[i + k][1]; }
    const n = 2 * KERN;
    return [pt[0] + factor * (sx / n - pt[0]), pt[1] + factor * (sy / n - pt[1])];
  });
  for (let p = 0; p < SMOOTH_PASSES; p++) {
    cur = pass(LAMBDA);
    cur = pass(MU);
  }
  return cur;
}

/** Radius of the circle through three points (Infinity when straight). */
function radius3(p, q, r) {
  const ab = Math.hypot(q[0] - p[0], q[1] - p[1]), bc = Math.hypot(r[0] - q[0], r[1] - q[1]),
    ca = Math.hypot(r[0] - p[0], r[1] - p[1]);
  const area2 = Math.abs((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]));
  return area2 > 1e-9 ? ab * bc * ca / (2 * area2) : Infinity;
}

/** Each point's radius (a circle through points `span` samples either side). */
function radii(path, span) {
  return path.map((pt, i) => (i < span || i + span >= path.length ? Infinity
    : radius3(path[i - span], pt, path[i + span])));
}

/** Heading at each point (rad). */
const headings = (path) => path.map((pt, i) => {
  const a = path[Math.max(0, i - 1)], b = path[Math.min(path.length - 1, i + 1)];
  return Math.atan2(b[1] - a[1], b[0] - a[0]);
});
const wrap = (angle) => Math.atan2(Math.sin(angle), Math.cos(angle));

/** The hairpins: runs of points whose turn over HAIRPIN_SPAN_M passes HAIRPIN_DEG. */
function findHairpins(path, step) {
  const head = headings(path), half = Math.round(HAIRPIN_SPAN_M / step / 2), out = [];
  let run = null;
  for (let i = half; i + half < path.length; i++) {
    const turn = wrap(head[i + half] - head[i - half]);
    if (Math.abs(turn) >= HAIRPIN_DEG * RAD) {
      if (!run) run = { from: i, to: i, dir: Math.sign(turn) };
      run.to = i;
    } else if (run) {
      out.push(run);
      run = null;
    }
  }
  if (run) out.push(run);
  const rad = radii(path, Math.max(2, Math.round(5 / step)));
  return out.map((pin) => {
    let apex = pin.from;
    for (let i = pin.from; i <= pin.to; i++) if (rad[i] < rad[apex]) apex = i;
    return { ...pin, apex, r: rad[apex] };
  });
}

/**
 * Pushes one hairpin apart as a whole: scaled about the centre of its tightest circle by
 * FOLD_R / r, the scale eased (smoothstep) back to none over EASE_M along each leg past the turn.
 */
function spreadHairpin(path, pin, step) {
  const span = Math.max(2, Math.round(5 / step)), a = pin.apex;
  const p = path[a - span], q = path[a], r = path[a + span];
  // the circle's centre through p, q, r
  const d = 2 * (p[0] * (q[1] - r[1]) + q[0] * (r[1] - p[1]) + r[0] * (p[1] - q[1]));
  if (Math.abs(d) < 1e-9) return 0;
  const sq = (pt) => pt[0] * pt[0] + pt[1] * pt[1];
  const cx = (sq(p) * (q[1] - r[1]) + sq(q) * (r[1] - p[1]) + sq(r) * (p[1] - q[1])) / d;
  const cy = (sq(p) * (r[0] - q[0]) + sq(q) * (p[0] - r[0]) + sq(r) * (q[0] - p[0])) / d;
  const grow = FOLD_R * 1.02 / pin.r - 1;
  if (grow <= 0) return 0;
  // the turn itself: from where it starts to where it ends (its run of points), plus the ease
  const turnFrom = pin.from, turnTo = pin.to, ease = Math.round(EASE_M / step);
  const out = path.map((pt) => [...pt]);
  for (let i = Math.max(0, turnFrom - ease); i <= Math.min(path.length - 1, turnTo + ease); i++) {
    const past = i < turnFrom ? (turnFrom - i) / ease : i > turnTo ? (i - turnTo) / ease : 0;
    const share = 1 - past, weight = share * share * (3 - 2 * share);
    out[i][0] = path[i][0] + (path[i][0] - cx) * grow * weight;
    out[i][1] = path[i][1] + (path[i][1] - cy) * grow * weight;
  }
  for (let i = 0; i < path.length; i++) path[i] = out[i];
  return grow;
}

/** The closest two road parts over APART_M apart along it come, centre to centre (game m). */
function closestParts(path, step) {
  const cell = 8, grid = new Map(), key = (x, y) => `${Math.floor(x / cell)},${Math.floor(y / cell)}`;
  path.forEach((pt, i) => {
    const k = key(pt[0], pt[1]);
    if (!grid.has(k)) grid.set(k, []);
    grid.get(k).push(i);
  });
  const apart = Math.round(APART_M / step);
  let best = { d: Infinity, i: -1, j: -1 };
  path.forEach((pt, i) => {
    const gx = Math.floor(pt[0] / cell), gy = Math.floor(pt[1] / cell);
    for (let dx = -2; dx <= 2; dx++) for (let dy = -2; dy <= 2; dy++)
      for (const j of grid.get(`${gx + dx},${gy + dy}`) || []) {
        if (Math.abs(i - j) < apart) continue;
        const dist = Math.hypot(path[j][0] - pt[0], path[j][1] - pt[1]);
        if (dist < best.d) best = { d: dist, i, j };
      }
  });
  return { m: +best.d.toFixed(1), atM: Math.round(best.i * step), toM: Math.round(best.j * step) };
}

/** Median then mean smoothing of a height profile. */
function smoothHeights(heights) {
  const med = heights.map((h, i) => {
    const win = heights.slice(Math.max(0, i - (MEDIAN_N >> 1)), i + (MEDIAN_N >> 1) + 1)
      .sort((one, two) => one - two);
    return win[win.length >> 1];
  });
  return med.map((h, i) => {
    const win = med.slice(Math.max(0, i - (MEAN_N >> 1)), i + (MEAN_N >> 1) + 1);
    return win.reduce((sum, v) => sum + v, 0) / win.length;
  });
}

/** The steepest grade over `span` real m of a profile sampled every STEP_M (%). */
function steepest(heights, span) {
  const step = Math.round(span / STEP_M);
  let worst = 0;
  for (let i = 0; i + step < heights.length; i++)
    worst = Math.max(worst, Math.abs(heights[i + step] - heights[i]) / span);
  return +(worst * 100).toFixed(1);
}

async function heightsOf(samples) {
  if (existsSync(ELEV) && !process.argv.includes('--fetch')) {
    const saved = JSON.parse(readFileSync(ELEV, 'utf8'));
    if (saved.points.length === samples.length) return saved.points.map((pt) => pt.h);
    throw new Error('spikes.elev.json does not match the course: run with --fetch');
  }
  const heights = [];
  for (let i = 0; i < samples.length; i += 100) {
    const locs = samples.slice(i, i + 100).map((pt) => `${pt[0].toFixed(6)},${pt[1].toFixed(6)}`)
      .join('|');
    const body = await (await fetch(`https://api.opentopodata.org/v1/ned10m?locations=${locs}`))
      .json();
    if (body.status !== 'OK') throw new Error('opentopodata: ' + JSON.stringify(body).slice(0, 200));
    heights.push(...body.results.map((row) => row.elevation));
    await new Promise((done) => setTimeout(done, 1100));
  }
  writeFileSync(ELEV, JSON.stringify({ source: 'USGS 3DEP (ned10m) via Open Topo Data, '
    + 'api.opentopodata.org', fetched: new Date().toISOString().slice(0, 10), stepM: STEP_M,
  fromSummit: true, points: samples.map((pt, i) => ({ lat: +pt[0].toFixed(6),
    lon: +pt[1].toFixed(6), h: heights[i] })) }) + '\n');
  return heights;
}

// ---- 1. the road, top -> down, then the course start -> summit (real m, x east, y north)
const latlon = chainRoad(JSON.parse(readFileSync(OSM, 'utf8')));
const local = latlon.map(([lat, lon]) => toLocal(lat, lon, SUMMIT));
// (heights: every STEP_M from the summit, as fetched in round 1)
const coarse = resample(local, STEP_M).slice(0, Math.round(COURSE_M / STEP_M) + 1);
const toLatLon = ([x, y]) => [SUMMIT[0] + y / EARTH_M / RAD,
  SUMMIT[1] + x / (EARTH_M * Math.cos(SUMMIT[0] * RAD)) / RAD];
const heightsDown = await heightsOf(coarse.map(toLatLon));
const fineDown = resample(local, FINE_M).slice(0, Math.round(COURSE_M / FINE_M) + 1);
const fine = fineDown.reverse();
// ---- 2. half scale, y down, the start at the origin
const start = fine[0];
let path = smoothOpen(fine.map(([x, y]) => [(x - start[0]) * SCALE, -(y - start[1]) * SCALE]));
const step = FINE_M * SCALE;
const before = findHairpins(path, step);
const closestBefore = closestParts(path, step);
// ---- 3. every tight hairpin pushed apart as a whole (again until none is left: one moves the next)
const spread = [];
for (let pass = 0; pass < 6; pass++) {
  const tight = findHairpins(path, step).filter((pin) => pin.r < FOLD_R);
  if (!tight.length) break;
  // (one at a time from the start: each moves the road after it)
  for (const pin of tight) {
    const now = findHairpins(path, step).find((other) => Math.abs(other.apex - pin.apex) < 20);
    if (now && now.r < FOLD_R) spread.push({ pass, atM: Math.round(now.apex * step),
      r: +now.r.toFixed(1), grow: +spreadHairpin(path, now, step).toFixed(2) });
  }
}
const after = findHairpins(path, step);
const closestAfter = closestParts(path, step);
// ---- 4. the heights, smoothed, start -> summit, halved
const rawUp = [...heightsDown].reverse(), smoothUp = smoothHeights(rawUp);
const out = resample(path, OUT_M);
const riseAt = (share) => {
  const at = share * (smoothUp.length - 1), low = Math.floor(at), high = Math.min(low + 1,
    smoothUp.length - 1);
  return ((smoothUp[low] + (smoothUp[high] - smoothUp[low]) * (at - low)) - smoothUp[0]) * SCALE;
};
const rises = out.map((pt, i) => riseAt(i / (out.length - 1)));
const report = {
  course: { realKm: +(COURSE_M / 1000).toFixed(2), gameKm: +((out.length - 1) * OUT_M / 1000)
    .toFixed(2), points: out.length, riseGameM: Math.round(rises[rises.length - 1]),
  meanGrade: +(rises[rises.length - 1] / ((out.length - 1) * OUT_M) * 100).toFixed(1) },
  grades: { raw100m: steepest(rawUp, 100), raw500m: steepest(rawUp, 500),
    smooth100m: steepest(smoothUp, 100), smooth500m: steepest(smoothUp, 500) },
  hairpins: { foldR: FOLD_R, before: before.length, foldBefore: before.filter((pin) => pin.r
    < FOLD_R).length, after: after.length, foldAfter: after.filter((pin) => pin.r < FOLD_R).length,
    leastBefore: +Math.min(...before.map((pin) => pin.r)).toFixed(1),
    leastAfter: +Math.min(...after.map((pin) => pin.r)).toFixed(1), spreads: spread.length,
    pushed: spread.map((one) => [one.atM, one.r]),
    each: after.map((pin) => [Math.round(pin.apex * step), +pin.r.toFixed(1)]) },
  closest: { before: closestBefore, after: closestAfter },
};
console.log(JSON.stringify(report, null, 1));
if (process.argv.includes('--dry')) process.exit(0);
const fmt = (value) => +value.toFixed(2);
/** An array's items as source lines of at most 98 characters (the lint's 100). */
const wrapItems = (items) => {
  const lines = [];
  let line = ' ';
  for (const item of items) {
    const text = ' ' + item + ',';
    if (line.length + text.length > 98) {
      lines.push(line);
      line = ' ';
    }
    line += text;
  }
  lines.push(line);
  return lines.join('\n');
};
const header = [
  "// world/levels/venues/spikes.ts - SPIKES PEAK'S ROAD (GENERATED by tools/spikestrace.mjs: do not",
  `// edit by hand). The real Pikes Peak Highway race course (${report.course.realKm} km, start ->`,
  `// summit) at half scale, game m, x east, y south, every ${OUT_M} m; the hairpins as tight as`,
  `// the real ones, only those whose ${ROAD_M} m road would fold (under ${FOLD_R} m) pushed apart`,
  '// as a whole. Road: (c) OpenStreetMap contributors, ODbL. Heights: USGS 3DEP via Open Topo Data',
  `// (smoothed, halved with the length: the real grades). ${report.course.gameKm} km, rise`,
  `// ${report.course.riseGameM} m (mean ${report.course.meanGrade} %).`,
].join('\n');
writeFileSync(OUT, `${header}
import type { Point } from '../../types.ts';

/** The road's centre line, start -> summit (game m). */
export const SPIKES_ROAD: Point[] = [
${wrapItems(out.map(([x, y]) => `[${fmt(x)}, ${fmt(y)}]`))}
];

/** The road's rise above the start at each point of SPIKES_ROAD (m). */
export const SPIKES_RISE: number[] = [
${wrapItems(rises.map(fmt))}
];
`);
console.log('wrote', OUT);
