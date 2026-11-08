// _groundbench.mjs - the ground lookups a tile paint makes (layersAt) over a level's road
// surroundings on a 0.5 m grid near the track: us per lookup
import * as L from '../../src/lab.ts';
const levelId = process.argv[2] || 'brands-snatch';
L.setLevel(levelId);
const sub = L.LEVEL.subtrack, points = [];
for (const point of sub.pts) for (let off = -40; off <= 40; off += 0.5)
  points.push([point.x + point.nx * off, point.y + point.ny * off]);
let count = 0;
const t0 = performance.now();
for (let pass = 0; pass < 2; pass++) for (const [x, y] of points) { L.layersAt(x, y); count++; }
const ms = performance.now() - t0;
console.log(`${levelId}: ${count} lookups, ${(ms * 1000 / count).toFixed(2)} us each, `
  + `${(L.LEVEL.zones || []).length} zones, ${(L.LEVEL.lanes || []).length} lanes`);
const zones = await import('../../src/world/zones.ts');
for (const [name, fn] of [['zoneAt', zones.zoneAt], ['laneAt', zones.laneAt]]) {
  const t1 = performance.now();
  for (const [x, y] of points) fn(x, y);
  console.log(`  ${name}: ${((performance.now() - t1) * 1000 / points.length).toFixed(2)} us each`);
}
