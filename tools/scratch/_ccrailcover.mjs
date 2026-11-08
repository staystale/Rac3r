// _ccrailcover.mjs - metres of each side of the Castle Cum lap with a real rail beside it within
// 30 m of the edge (OSM, then OSM + the rails seen on the aerial photographs), at game scale
import { CASTLE_CUM_SPEC as SPEC } from '../../src/world/levels/castle-cum-venue.ts';
import { venueBuild } from '../../src/world/venue.ts';
import { makePlacer, VENUE_ROAD_M, HALF_ROAD, centreAt, distToLine } from '../../src/world/venuegeo.ts';
const build = venueBuild(SPEC);
const loops = Object.values(build.loops), sub = build.loops.circuit;
const place = makePlacer(build.scale, loops, (VENUE_ROAD_M - SPEC.realRoadM * build.scale) / 2);
const osm = build.spec.data.rails.map((rail) => rail.pts.map(place));
const seen = build.spec.railsSeen.map((pts) => pts.map(place));
let osmLen = 0;
for (const rail of osm) for (let i = 1; i < rail.length; i++) osmLen += Math.hypot(rail[i][0] - rail[i - 1][0], rail[i][1] - rail[i - 1][1]);
const beside = (rails, centre, side) => {
  for (let out = HALF_ROAD + 0.5; out <= HALF_ROAD + 30; out += 1)
    if (rails.some((rail) => distToLine(rail, centre.x + centre.nx * side * out, centre.y + centre.ny * side * out) < 1)) return true;
  return false;
};
const count = { osm: { 1: 0, '-1': 0 }, all: { 1: 0, '-1': 0 } };
for (let dist = 0; dist < sub.totalDist; dist += 2) {
  const centre = centreAt(sub, dist);
  for (const side of [1, -1]) {
    if (beside(osm, centre, side)) count.osm[side] += 2;
    if (beside([...osm, ...seen], centre, side)) count.all[side] += 2;
  }
}
console.log(`OSM rails: ${osm.length} ways, ${osmLen.toFixed(0)} m at game scale; lap ${sub.totalDist.toFixed(0)} m`);
console.log(`rail beside the lap (OSM): left ${count.osm[1]} m, right ${count.osm[-1]} m`);
console.log(`rail beside the lap (OSM + seen on aerials): left ${count.all[1]} m, right ${count.all[-1]} m`);
// where a real rail would stand on a road or a building of the built level
const { LEVELS } = await import('../../src/world/levels/index.ts');
const { buildLevel } = await import('../../src/world/load.ts');
const level = buildLevel(LEVELS.find((entry) => entry.id === 'castle-cum'));
const blocks = level.props.filter((prop) => prop.w && prop.h && !['bridge', 'gantry', 'tunnel', 'board'].includes(prop.kind));
const inBlock = (x, y) => blocks.find((prop) => {
  const cosR = Math.cos(prop.rot || 0), sinR = Math.sin(prop.rot || 0);
  return Math.abs((x - prop.x) * cosR + (y - prop.y) * sinR) <= prop.w / 2
    && Math.abs(-(x - prop.x) * sinR + (y - prop.y) * cosR) <= prop.h / 2;
});
const hits = {};
for (const rail of [...osm, ...seen]) for (let i = 1; i < rail.length; i++) {
  const [ax, ay] = rail[i - 1], [bx, by] = rail[i], len = Math.hypot(bx - ax, by - ay);
  for (let t = 0; t <= len; t += 1) {
    const x = ax + (bx - ax) * t / len, y = ay + (by - ay) * t / len;
    const lane = level.lanes.find((entry) => distToLine(entry.pts, x, y) < entry.width / 2);
    const what = lane ? `${lane.surface.id} w${lane.width}` : inBlock(x, y) ? `building ${inBlock(x, y).kind}` : null;
    if (!what) continue;
    const key = `${what} near ${Math.round(x / 20) * 20},${Math.round(y / 20) * 20}`;
    hits[key] = (hits[key] || 0) + 1;
  }
}
for (const [key, metres] of Object.entries(hits).sort((a, b) => b[1] - a[1])) console.log(`  rail on ${key}: ${metres} m`);
