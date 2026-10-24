// _hwlamps.mjs - the highway's street lights (highway/roadlamps.ts): drive N km on one road type,
// at each rebuild count the lamps loaded, the gaps between them along the road and the side
// pattern, the nearest scenery solid / barrier / loose object to each post, and time solidClamp
// (us a car-step). node tools/scratch/_hwlamps.mjs [km] [preset] [on=1]
import { makeCar, step, reset, PHYSICS_STEP_SECONDS } from '../../src/vehicle.ts';
import * as L from '../../src/lab.js';
import { stepHighway, addHighwayLevel, setHighwayPreset, resetHighway } from '../../src/highway.js';
import { createAutoDriver } from '../../src/ai/autodrive.ts';
import { solidClamp } from '../../src/world/barriers.ts';
import { activeLamps } from '../../src/world/lamps.ts';
import { setRoadLamps } from '../../src/highway/roadlamps.ts';
const KM = +(process.argv[2] || 4), PRESET = process.argv[3] || 'motorway';
setRoadLamps((process.argv[4] ?? '1') === '1');
addHighwayLevel();
L.setLevel('highway'); const lv = L.LEVEL;
setHighwayPreset(lv, PRESET); resetHighway(lv);
const car = makeCar('saloon-rwd'); reset(car, lv.spawn.x, lv.spawn.y, lv.spawn.heading);
let sub = lv.subtrack, drv = createAutoDriver(sub), t = 0, rebuilds = 0;
let maxLamps = 0, maxSolids = 0, usSum = 0, usN = 0, closeSolid = 0, closeBarrier = 0, closeLoose = 0;
const seen = new Set(), gaps = [], sides = [];
const segGap = (x, y, pts) => { let best = Infinity; for (let i = 0; i + 1 < pts.length; i++) {
  const [ax, ay] = pts[i], [bx, by] = pts[i + 1], dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1e-9;
  const f = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l2));
  best = Math.min(best, Math.hypot(x - ax - dx * f, y - ay - dy * f)); } return best; };
function survey() {
  const lamps = activeLamps();
  maxLamps = Math.max(maxLamps, lamps.length); maxSolids = Math.max(maxSolids, lv.solids.length);
  for (const entry of lv.lamps) {
    if (seen.has(entry)) continue;
    seen.add(entry);
    const solid = Math.min(...lv.solids.map((s) => Math.hypot(s.x - entry.x, s.y - entry.y) - s.r));
    if (solid < 1) closeSolid++;
    const bar = Math.min(Infinity, ...lv.barriers.map((b) => segGap(entry.x, entry.y, b.pts)));
    if (bar < 0.5) closeBarrier++;
    const loose = Math.min(Infinity, ...(lv._hw.looseNew || []).concat(lv.cones).map((c) => Math.hypot(c.x - entry.x, c.y - entry.y)));
    if (loose < 0.8) closeLoose++;
  }
  const sorted = [...lv.lamps].sort((a, b) => a._s - b._s);
  for (let i = 1; i < sorted.length; i++) gaps.push(Math.round(sorted[i]._s - sorted[i - 1]._s));
}
survey();
while ((lv._hw.driven || 0) < KM * 1000 && t < KM * 200) {
  if (lv.subtrack !== sub) { sub = lv.subtrack; drv = createAutoDriver(sub); }
  L.applyGround(car, PHYSICS_STEP_SECONDS);
  step(car, drv.drive(car, PHYSICS_STEP_SECONDS), PHYSICS_STEP_SECONDS); t += PHYSICS_STEP_SECONDS;
  solidClamp(car);
  const q = L.querySubtrack(sub, car.x, car.y);
  if (stepHighway(lv, car, q.trackDist)) {
    rebuilds++;
    survey();
    const ghost = { ...car, vx: 0, vy: 0 };
    const start = performance.now();
    for (let i = 0; i < 2000; i++) solidClamp(ghost);
    usSum += (performance.now() - start) / 2000 * 1000; usN++;
  }
}
const hist = {};
for (const gap of gaps) hist[gap] = (hist[gap] || 0) + 1;
const top = Object.entries(hist).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([g, n]) => `${g}m x${n}`);
console.log(`${PRESET} ${KM} km (${rebuilds} rebuilds): lamps laid ${seen.size}, loaded max ${maxLamps},`
  + ` solids max ${maxSolids}; solidClamp ${(usSum / usN).toFixed(2)} us a car-step;`
  + ` car ${Math.hypot(car.vx, car.vy).toFixed(1)} m/s, driven ${(lv._hw.driven / 1000).toFixed(1)} km`);
console.log(`  gaps along the road: ${top.join(', ')}`);
console.log(`  posts within 1 m of a solid ${closeSolid}, 0.5 m of a barrier ${closeBarrier},`
  + ` 0.8 m of a loose object ${closeLoose}`);
