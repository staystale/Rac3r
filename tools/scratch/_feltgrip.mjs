// _feltgrip.mjs - does the AI drive by grip it cannot have (R4 part 2, B3 felt grip)? A lone AI
// laps LAPS times with its tyres' grip x K (car.mods.gripLat / gripLong: worn, cold, a grip it
// does not know about) while its plan still assumes the car's full measured grip: per lap, the
// time, seconds off the road, spins. node tools/scratch/_feltgrip.mjs [level] [car] [diff] [K]
import { makeCar, step, reset, PHYSICS_STEP_SECONDS as DT } from '../../src/vehicle.ts';
import * as L from '../../src/lab.ts';
const { createAIDriver } = await import('../../src/ai/circuit.ts');
const { aiTraits } = await import('../../src/ai/traits.ts');
const [lv = 'thruston', carId = 'hatch-rwd', d = '2', kArg = '0.8', lapsArg = '4'] = process.argv.slice(2);
const K = +kArg, LAPS = +lapsArg;
L.setLevel(lv); L.clearWear();
const sub = L.LEVEL.subtrack, total = sub.totalDist, sp = L.LEVEL.spawn;
const car = makeCar(carId); reset(car, sp.x, sp.y, sp.heading);
car.mods.gripLat *= K; car.mods.gripLong *= K;
const drv = createAIDriver(L.LEVEL, aiTraits(+d, 0, 1, 7));
let t = 0, prog = 0, lastQ = L.querySubtrack(sub, car.x, car.y).trackDist, lapT = 0, lap = 0;
const laps = []; let off = 0, spins = 0, spinT = -9, spinSum = 0, spinN = 0, spinMax = 0;
while (lap < LAPS && t < 600) {
  L.applyGround(car, DT);
  const u = drv.drive(car, DT, { cars: [], lap: lap + 1, laps: 9 });
  step(car, u, DT); L.barrierClamp(car);
  if (u.throttle > 0.5 && Math.hypot(car.vx, car.vy) > 8) { spinSum += car.wheelSpin || 0; spinN++; spinMax = Math.max(spinMax, car.wheelSpin || 0); }
  t += DT;
  const q = L.querySubtrack(sub, car.x, car.y); let dq = q.trackDist - lastQ;
  if (dq < -total / 2) dq += total; if (dq > total / 2) dq -= total; prog += dq; lastQ = q.trackDist;
  if (q.dist > sub.width / 2 + 1) off += DT;
  const v = Math.hypot(car.vx, car.vy), slipAng = Math.abs(Math.atan2(car.vy, car.vx) - car.heading) % (2 * Math.PI);
  if (v > 5 && Math.min(slipAng, 2 * Math.PI - slipAng) > 1.2 && t - spinT > 3) { spins++; spinT = t; }
  if (prog >= (lap + 1) * total) { laps.push(+(t - lapT).toFixed(1)); lapT = t; lap++; }
}
console.log(`${lv} ${carId} diff ${d} grip x${K}: laps [${laps.join(', ')}] | off ${off.toFixed(1)} s | spins ${spins} | wheelspin on the gas ${(spinSum / Math.max(1, spinN)).toFixed(2)} m/s mean, ${spinMax.toFixed(1)} peak`);
