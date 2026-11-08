// _bankair.mjs <level> [car] [diff] - the racing AI on an oval's banking: two laps alone, the most
// air (both axles light) and where, the lowest load, the top speed, and how far up the banking it runs
import { makeCar, step, reset, PHYSICS_STEP_SECONDS } from '../../src/vehicle.ts';
import * as L from '../../src/lab.ts';
import { createAIDriver } from '../../src/ai/circuit.ts';
import { aiTraits } from '../../src/ai/traits.ts';
const [lv = 'dieatona', carId = 'naffcar', diff = '4'] = process.argv.slice(2);
L.setLevel(lv); L.clearWear();
const sub = L.LEVEL.subtrack, car = makeCar(carId);
const p = L.onTrack(sub, sub.totalDist - 40, 0, {}); reset(car, p.x, p.y, p.rot);
const drv = createAIDriver(L.LEVEL, aiTraits(+diff, 0, 1));
let loadOff = 0, t = 0, air = 0, airAt = 0, airRun = 0, minLoad = 9, loadAt = 0, top = 0, laps = 0, prev = null, off = 0;
while (t < 200 && laps < 3) {
  L.applyGround(car, PHYSICS_STEP_SECONDS);
  step(car, drv.drive(car, PHYSICS_STEP_SECONDS), PHYSICS_STEP_SECONDS); t += PHYSICS_STEP_SECONDS;
  const q = L.querySubtrack(sub, car.x, car.y);
  if (prev !== null && prev > sub.totalDist - 60 && q.trackDist < 60) laps++;
  prev = q.trackDist;
  if (laps < 1) continue;
  airRun = car.air > 0 ? airRun + PHYSICS_STEP_SECONDS : 0;
  if (airRun > air) { air = airRun; airAt = q.trackDist; }
  if (car.loadK < minLoad) { minLoad = car.loadK; loadAt = q.trackDist; loadOff = (q.side === "left" ? 1 : -1) * q.dist; }
  top = Math.max(top, Math.hypot(car.vx, car.vy) * 3.6);
  if (q.dist > sub.width / 2) off += PHYSICS_STEP_SECONDS;
}
console.log(`${lv} ${carId} diff ${diff}: ${laps - 1} laps timed; top ${top.toFixed(0)} km/h; longest air ${air.toFixed(2)} s at ${airAt.toFixed(0)} m; lowest load ${minLoad.toFixed(2)} at ${loadAt.toFixed(0)} m, ${loadOff.toFixed(1)} m off the centre; off the road ${off.toFixed(1)} s`);
