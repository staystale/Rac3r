// _ccfences.mjs [level] - THE FENCE AUDIT: each catch-fence stretch of a venue's edge (side, lap m,
// length, the corners it passes) with what the sources show beside it: a real rail (OSM guard rail
// / concrete, or one seen on the aerial photographs) within 30 m of the edge, a viewing bank, and
// the OSM fences (barrier=fence: type, height) within 30 m; then the edge's totals
import { LEVELS } from '../../src/world/levels/index.ts';
import { buildLevel } from '../../src/world/load.ts';
import { venueBuild } from '../../src/world/venue.ts';
import { CASTLE_CUM_SPEC as SPEC } from '../../src/world/levels/castle-cum-venue.ts';
import { makePlacer, VENUE_ROAD_M, HALF_ROAD, centreAt, distToLine } from '../../src/world/venuegeo.ts';
import fs from 'node:fs';
const level = buildLevel(LEVELS.find((entry) => entry.id === 'castle-cum'));
const sub = level.subtrack;
const build = venueBuild(SPEC), loops = Object.values(build.loops);
const place = makePlacer(build.scale, loops, (VENUE_ROAD_M - SPEC.realRoadM * build.scale) / 2);
const rails = [...build.spec.data.rails.map((rail) => rail.pts), ...(build.spec.railsSeen || [])]
  .map((pts) => pts.map(place));
const banks = build.spec.banks.map((bank) => bank.pts.map(place));
// the OSM fences (the venue data does not carry them: read from the Overpass download)
const osm = JSON.parse(fs.readFileSync('tools/venues/castle-cum.osm.json', 'utf8'));
const [LAT0, LON0] = [51.4892, -2.2115], ML = 111320, MO = 111320 * Math.cos(LAT0 * Math.PI / 180);
const TURN = 197 * Math.PI / 180, COS_T = Math.cos(TURN), SIN_T = Math.sin(TURN);
const real = (node) => {
  const east = (node.lon - LON0) * MO, south = -(node.lat - LAT0) * ML;
  return [east * COS_T - south * SIN_T, east * SIN_T + south * COS_T];
};
const fences = osm.elements.filter((way) => way.tags?.barrier === 'fence' && way.geometry
  && !way.tags.power).map((way) => ({ tags: way.tags, pts: way.geometry.map(real).map(place) }));
const CORNERS = { Folly: 115, 'Avon Rise': 248, Quarry: 421, 'Farm Straight': 544,
  'The Esses': 638, 'Old Paddock': 738, 'Hammer Down': 876, Tower: 1006, Bobbies: 1135,
  Westway: 1234, 'Dean Straight': 1297, Camp: 1420 };
// what stands along each side, read along the normal (as _ccedge.mjs)
const cells = new Map(), key = (x, y) => `${Math.round(x)},${Math.round(y)}`;
for (const rail of level.barriers) for (let i = 0; i + 1 < rail.pts.length; i++) {
  const [ax, ay] = rail.pts[i], [bx, by] = rail.pts[i + 1], len = Math.hypot(bx - ax, by - ay);
  for (let t = 0; t <= len; t += 0.5) {
    const cell = key(ax + (bx - ax) * t / len, ay + (by - ay) * t / len);
    if (!cells.has(cell)) cells.set(cell, rail.kind);
  }
}
const kindAt = (centre, side) => {
  for (let out = HALF_ROAD; out <= HALF_ROAD + 30; out += 0.5)
    for (const [ox, oy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const found = cells.get(key(centre.x + centre.nx * side * out + ox * 0.5,
        centre.y + centre.ny * side * out + oy * 0.5));
      if (found) return found;
    }
  return 'open';
};
const nearAny = (lines, centre, side, reach) => {
  for (let out = HALF_ROAD + 0.5; out <= HALF_ROAD + reach; out += 1) {
    const x = centre.x + centre.nx * side * out, y = centre.y + centre.ny * side * out;
    const hit = lines.find((line) => distToLine(line.pts || line, x, y) < 1.5);
    if (hit) return hit;
  }
  return null;
};
const STEP = 2, runs = [], totals = {};
for (const side of [1, -1]) {
  for (let dist = 0; dist < sub.totalDist; dist += STEP) {
    const centre = centreAt(sub, dist), kind = kindAt(centre, side);
    const name = `${side < 0 ? 'outside' : 'inside'} ${kind}`;
    totals[name] = (totals[name] || 0) + STEP;
    if (kind !== 'catchfence') continue;
    const last = runs.at(-1);
    if (!last || last.side !== side || last.to !== dist)
      runs.push({ side, from: dist, to: dist + STEP, rail: 0, bank: 0, fences: new Map() });
    const run = runs.at(-1);
    run.to = dist + STEP;
    if (nearAny(rails, centre, side, 30)) run.rail += STEP;
    if (nearAny(banks, centre, side, 30)) run.bank += STEP;
    const fence = nearAny(fences, centre, side, 30);
    if (fence) {
      const label = `${fence.tags.fence_type || 'fence'}${fence.tags.height ? ' ' + fence.tags.height + ' m' : ''}`;
      run.fences.set(label, (run.fences.get(label) || 0) + STEP);
    }
  }
}
for (const run of runs) {
  const passes = Object.entries(CORNERS).filter(([, at]) => at >= run.from - 30 && at <= run.to + 30)
    .map(([name]) => name).join(', ');
  const fenceText = [...run.fences].map(([label, metres]) => `${label} ${metres} m`).join(', ') || 'none';
  console.log(`${run.side < 0 ? 'outside' : 'inside '} lap m ${run.from}-${run.to} (${run.to - run.from} m; ${passes}):`
    + ` real rail beside ${run.rail} m, bank ${run.bank} m, OSM fence ${fenceText}`);
}
for (const [name, metres] of Object.entries(totals).sort()) console.log(`  ${name.padEnd(20)} ${String(metres).padStart(5)} m`);
