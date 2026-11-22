// _waterinc.mjs - ?waterinc's merge (render/ground/covermerge.ts mergedChunks) against the whole-list
// one (buildMergedCovers), in node: GETAWAY STOCKHOLM's road built (stepHighway) over KM km; at
// every new covers list with water, both merges of its scenery water - the same cells (kind, x, y)
// and the same rim cells, or the differences; and what each costs, ms (the chunked one keeps its
// chunks across the lists, as in the game).
// STOCKHOLM=1 node tools/scratch/_waterinc.mjs [km 3] [scenery stockholm]
import * as L from '../../src/lab.ts';
import { createHighway, resetHighway, stepHighway, roadPose, setHighwayPreset }
  from '../../src/highway.ts';
import { buildMergedCovers, mergedChunks } from '../../src/render/ground/covermerge.ts';
const KM = +(process.argv[2] || 3), SCENERY = process.argv[3] || 'stockholm';
const level = createHighway(4242, 'motorway');
setHighwayPreset(level, 'motorway', SCENERY);
L.LEVELS.push(level);
L.setLevel('highway');
resetHighway(level);
const lane = level._hw.geo.centres[0], car = { x: 0, y: 0 }, whole = [], chunked = [];
let lists = 0, cellsDiff = 0, rimDiff = 0, cellsMost = 0;
const setsOf = (groups) => {
  const cells = new Set(), rims = new Set();
  for (const grp of groups) {
    for (let i = 0; i < grp.gx.length; i++) cells.add(`${grp.kind}:${grp.gx[i]}:${grp.gy[i]}`);
    for (const i of grp.rim) rims.add(`${grp.kind}:${grp.gx[i]}:${grp.gy[i]}`);
  }
  return { cells, rims };
};
const differ = (one, two) => [...one].filter((key) => !two.has(key)).length
  + [...two].filter((key) => !one.has(key)).length;
for (let dist = 300; dist <= 300 + KM * 1000; dist += 4) {
  const pose = roadPose(level, dist, lane);
  car.x = pose.x;
  car.y = pose.y;
  const before = level.covers;
  stepHighway(level, car);
  if (level.covers === before) continue;
  const water = level.covers.filter((cover) => cover.water);
  if (!water.length) continue;
  lists++;
  let t0 = performance.now();
  const old = buildMergedCovers(water, 0.5);
  whole.push(performance.now() - t0);
  t0 = performance.now();
  const now = mergedChunks(water, level);
  chunked.push(performance.now() - t0);
  const a = setsOf(old), b = setsOf(now);
  cellsDiff += differ(a.cells, b.cells);
  rimDiff += differ(a.rims, b.rims);
  cellsMost = Math.max(cellsMost, a.cells.size);
}
const med = (list) => list.sort((x, y) => x - y)[list.length >> 1] ?? 0;
const worst = (list) => Math.max(0, ...list);
console.log(`${SCENERY} ${KM} km: ${lists} new covers lists with water (most cells ${cellsMost});`
  + ` cells different ${cellsDiff}, rim cells different ${rimDiff}; the whole-list merge ms median`
  + ` ${med(whole).toFixed(0)} worst ${worst(whole).toFixed(0)}, by chunk median`
  + ` ${med(chunked).toFixed(0)} worst ${worst(chunked).toFixed(0)}`);
