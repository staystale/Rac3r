// _spikesroad.mjs - SPIKES PEAK, ROUND 1 (the data): the real Pikes Peak Highway from
// OpenStreetMap (tools/venues/spikes.osm.json; (c) OpenStreetMap contributors, ODbL) chained into
// one road from the summit down, resampled every STEP_M real m; heights from Open Topo Data's
// ned10m (USGS 3DEP via Open Topo Data; only the points' coordinates are sent, 100 a call, 1.1 s
// apart - the free limits) saved to tools/venues/spikes.elev.json and reused when there. Reports
// the race course (COURSE_M up to the summit's end), its turns, height profile, steepest grade, and
// its hairpins too tight at half scale.
//   node tools/scratch/_spikesroad.mjs [--fetch]
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const OSM = 'tools/venues/spikes.osm.json', ELEV = 'tools/venues/spikes.elev.json';
// the summit (the road's top end is the way end nearest it), lat/lon
const SUMMIT = [38.8405, -105.0442];
// real m between samples; the race course's length (12.42 miles, the event's own figure)
const STEP_M = 20, COURSE_M = 19988;
// a turn: the heading change over TURN_SPAN_M of road past TURN_DEG; a hairpin past HAIRPIN_DEG
const TURN_SPAN_M = 60, TURN_DEG = 30, HAIRPIN_DEG = 120;
// m: the least corner radius at game scale - the traced venues' (world/levels/*-venue.ts minR:
// 10 in nearly all; world/venue.ts VENUE_MIN_R 15.5 the default); also listed against the default
const MIN_GAME_R = 10, DEFAULT_GAME_R = 15.5;
const EARTH_M = 6371008.8, RAD = Math.PI / 180;

/** lat/lon -> local metres (x east, y north) about an origin. */
const toLocal = (lat, lon, origin) => [(lon - origin[1]) * RAD * EARTH_M * Math.cos(origin[0] * RAD),
  (lat - origin[0]) * RAD * EARTH_M];

/** Chains the OSM ways end to end from the one nearest the summit. */
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
  const used = new Set(), pts = [], forks = [];
  let way = best.way, reversed = best.atEnd;
  while (way) {
    used.add(way.id);
    const geom = reversed ? [...way.geometry].reverse() : way.geometry;
    const nodes = reversed ? [...way.nodes].reverse() : way.nodes;
    pts.push(...(pts.length ? geom.slice(1) : geom).map((pt) => [pt.lat, pt.lon]));
    const tail = nodes[nodes.length - 1];
    const next = (ends.get(tail) || []).filter((other) => !used.has(other.id));
    if (next.length > 1) forks.push({ at: pts.length, ways: next.map((other) => other.id) });
    way = next[0] || null;
    if (way) reversed = way.nodes[way.nodes.length - 1] === tail;
  }
  return { pts, used: used.size, total: ways.length, forks, summitGapM: best.d };
}

/** Resamples a lat/lon polyline every step real metres. */
function resample(pts, step = STEP_M) {
  const local = pts.map(([lat, lon]) => toLocal(lat, lon, SUMMIT));
  const out = [];
  let carry = 0;
  for (let i = 1; i < local.length; i++) {
    const [ax, ay] = local[i - 1], [bx, by] = local[i], len = Math.hypot(bx - ax, by - ay);
    for (let at = carry; at < len; at += step) {
      const share = at / len;
      out.push({ x: ax + (bx - ax) * share, y: ay + (by - ay) * share,
        lat: pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * share,
        lon: pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * share });
    }
    carry = (carry - len) % step;
    if (carry < 0) carry += step;
  }
  return out;
}

/** Heights for the samples: from the saved file, or fetched (100 a call, 1.1 s apart). */
async function heightsOf(samples, fetchNew) {
  if (existsSync(ELEV) && !fetchNew) {
    const saved = JSON.parse(readFileSync(ELEV, 'utf8'));
    if (saved.points.length === samples.length) return saved.points.map((pt) => pt.h);
  }
  const heights = [];
  for (let i = 0; i < samples.length; i += 100) {
    const locs = samples.slice(i, i + 100).map((pt) => `${pt.lat.toFixed(6)},${pt.lon.toFixed(6)}`)
      .join('|');
    const res = await fetch(`https://api.opentopodata.org/v1/ned10m?locations=${locs}`);
    const body = await res.json();
    if (body.status !== 'OK') throw new Error('opentopodata: ' + JSON.stringify(body).slice(0, 200));
    heights.push(...body.results.map((row) => row.elevation));
    await new Promise((done) => setTimeout(done, 1100));
  }
  writeFileSync(ELEV, JSON.stringify({ source: 'USGS 3DEP (ned10m) via Open Topo Data, '
    + 'api.opentopodata.org', fetched: new Date().toISOString().slice(0, 10), stepM: STEP_M,
  fromSummit: true, points: samples.map((pt, i) => ({ lat: +pt.lat.toFixed(6),
    lon: +pt.lon.toFixed(6), h: heights[i] })) }) + '\n');
  return heights;
}

/** Heading change (deg, signed) over the span centred on each sample. */
function turnAt(samples, i, half) {
  const a = samples[Math.max(0, i - half)], b = samples[i], c = samples[Math.min(samples.length - 1,
    i + half)];
  const h1 = Math.atan2(b.y - a.y, b.x - a.x), h2 = Math.atan2(c.y - b.y, c.x - b.x);
  return Math.atan2(Math.sin(h2 - h1), Math.cos(h2 - h1)) / RAD;
}

const osm = JSON.parse(readFileSync(OSM, 'utf8'));
const road = chainRoad(osm);
const all = resample(road.pts);
const course = all.slice(0, Math.round(COURSE_M / STEP_M) + 1);
// (radii on a FINE_M resample, a circle through points RADIUS_SPAN samples apart: 20 m samples
// could not read a radius under ~20 m)
const FINE_M = 2, RADIUS_SPAN = 5;
const fine = resample(road.pts, FINE_M);
const heights = await heightsOf(course, process.argv.includes('--fetch'));
// turns: runs of samples whose heading change over TURN_SPAN_M passes TURN_DEG, counted once each
const half = Math.round(TURN_SPAN_M / STEP_M / 2);
const turns = [];
let run = null;
for (let i = 0; i < course.length; i++) {
  const turn = turnAt(course, i, half);
  if (Math.abs(turn) >= TURN_DEG && (!run || Math.sign(turn) === run.dir)) {
    if (!run) run = { dir: Math.sign(turn), from: i, peak: 0 };
    run.peak = Math.max(run.peak, Math.abs(turn));
    run.to = i;
  } else if (run) {
    turns.push(run);
    run = null;
  }
}
if (run) turns.push(run);
// each turn's whole heading change and its tightest radius (3-point circle over 2 samples each side)
for (const turn of turns) {
  const a = course[Math.max(0, turn.from - half)], b = course[Math.min(course.length - 1,
    turn.to + half)];
  const before = course[Math.max(0, turn.from - half) + 1] || a, after = course[Math.min(
    course.length - 1, turn.to + half) - 1] || b;
  const h1 = Math.atan2(before.y - a.y, before.x - a.x), h2 = Math.atan2(b.y - after.y, b.x - after.x);
  turn.deg = Math.abs(Math.atan2(Math.sin(h2 - h1), Math.cos(h2 - h1)) / RAD);
  let least = Infinity;
  const ratio = STEP_M / FINE_M;
  for (let i = (turn.from - half) * ratio; i <= (turn.to + half) * ratio; i++) {
    const p = fine[i - RADIUS_SPAN], q = fine[i], r = fine[i + RADIUS_SPAN];
    if (!p || !r) continue;
    const ab = Math.hypot(q.x - p.x, q.y - p.y), bc = Math.hypot(r.x - q.x, r.y - q.y),
      ca = Math.hypot(r.x - p.x, r.y - p.y);
    const area2 = Math.abs((q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x));
    if (area2 > 1e-6) least = Math.min(least, ab * bc * ca / (2 * area2));
  }
  turn.radius = least;
  // m up from the start line (course runs summit -> down here)
  turn.fromStartM = (course.length - 1 - Math.round((turn.from + turn.to) / 2)) * STEP_M;
}
const hairpins = turns.filter((turn) => turn.deg >= HAIRPIN_DEG);
const tight = turns.filter((turn) => turn.radius / 2 < MIN_GAME_R).sort((one, two) => one.fromStartM
  - two.fromStartM);
// the profile, up from the start line, and the steepest grade over 100 m and 500 m
const up = [...heights].reverse();
const grade = (span) => {
  let worst = 0, at = 0;
  const step = Math.round(span / STEP_M);
  for (let i = 0; i + step < up.length; i++) {
    const g = (up[i + step] - up[i]) / span;
    if (Math.abs(g) > Math.abs(worst)) { worst = g; at = i * STEP_M; }
  }
  return { grade: +(worst * 100).toFixed(1), atM: at };
};
const profile = [];
for (let km = 0; km * 1000 <= COURSE_M; km += 2) profile.push([km, Math.round(up[Math.min(
  up.length - 1, km * 1000 / STEP_M)])]);
profile.push([+(COURSE_M / 1000).toFixed(2), Math.round(up[up.length - 1])]);
console.log(JSON.stringify({
  osm: { ways: road.total, chained: road.used, forks: road.forks, summitGapM: +road.summitGapM
    .toFixed(1), wholeRoadKm: +((all.length - 1) * STEP_M / 1000).toFixed(2) },
  course: { km: +(COURSE_M / 1000).toFixed(2), startH: Math.round(up[0]), finishH: Math.round(
    up[up.length - 1]), riseM: Math.round(up[up.length - 1] - up[0]),
  meanGrade: +((up[up.length - 1] - up[0]) / COURSE_M * 100).toFixed(1),
  steepest100m: grade(100), steepest500m: grade(500), profileKmH: profile },
  turns: { counted: turns.length, hairpins: hairpins.length, spanM: TURN_SPAN_M, overDeg: TURN_DEG },
  halfScale: { minGameRadiusM: MIN_GAME_R, underDefault15_5: turns.filter((turn) => turn.radius / 2
    < DEFAULT_GAME_R).length, tooTight: tight.map((turn) =>
    ({ atRealKm: +(turn.fromStartM / 1000).toFixed(2), deg: Math.round(turn.deg),
      realR: +turn.radius.toFixed(1), halfR: +(turn.radius / 2).toFixed(1) })) },
}, null, 1));
