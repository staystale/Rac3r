// highwaycheck.mjs — HIGHWAY TO HULL (src/highway.js), the endless motorway: a bench driver drives N km; does the road keep coming,
// does the car stay on it, do props / bumps / barriers stay BOUNDED (dropped behind), and what does each rebuild cost.
// node tools/highwaycheck.mjs [km] [car]
import { makeCar, step, reset, DT } from '../src/vehicle.js';
import * as L from '../src/lab.js';
import { stepHighway } from '../src/highway.js';
import { createAutoDriver } from '../src/autodrive.js';
const KM = +(process.argv[2] || 10), carId = process.argv[3] || 'saloon-rwd';
L.setLevel('highway'); const lv = L.LEVEL;
const car = makeCar(carId); reset(car, lv.spawn.x, lv.spawn.y, lv.spawn.heading);
let sub = lv.subtrack, drv = createAutoDriver(sub), t = 0, off = 0, worst = 0, rebuilds = 0, rbMax = 0, maxProps = 0, maxBumps = 0, maxBar = 0, vSum = 0, n = 0;
console.log('FLOOR', L.FLOOR, 'start window', (sub.totalDist | 0), 'm, props', lv.props.length);
while ((lv._hw.driven || 0) < KM * 1000 && t < KM * 200) {
  if (lv.subtrack !== sub) { sub = lv.subtrack; drv = createAutoDriver(sub); }
  L.applyGround(car, DT); step(car, drv.drive(car, DT), DT); t += DT;
  const q = L.querySubtrack(sub, car.x, car.y);
  if (q.dist > sub.width / 2) off += DT; worst = Math.max(worst, isFinite(q.dist) ? q.dist - sub.width / 2 : 999);
  const t0 = performance.now(), ds = stepHighway(lv, car, q.trackDist), ms = performance.now() - t0;
  if (ds) { rebuilds++; rbMax = Math.max(rbMax, ms); }
  maxProps = Math.max(maxProps, lv.props.length); maxBumps = Math.max(maxBumps, lv.bumps.length); maxBar = Math.max(maxBar, lv.barriers.length);
  vSum += Math.hypot(car.vx, car.vy); n++;
}
console.log(`${carId}: driven ${(lv._hw.driven / 1000).toFixed(2)} km in ${t.toFixed(0)} s (avg ${(vSum / n * 3.6).toFixed(0)} km/h) | off ${off.toFixed(1)} s, worst ${worst.toFixed(1)} m`);
console.log(`rebuilds ${rebuilds}, worst rebuild ${rbMax.toFixed(1)} ms | max props ${maxProps}, bumps ${maxBumps}, barriers ${maxBar}, solids ${lv.solids.length} | car at ${(car.x / 1000).toFixed(1)}, ${(car.y / 1000).toFixed(1)} km`);
