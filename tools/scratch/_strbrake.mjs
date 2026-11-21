// _strbrake.mjs - THE OWNER'S 11-21 BUG 6 (scratch, diagnosis): THE RACING AI BRAKING ON STRAIGHTS,
// alone (headless, as _pbzoff.mjs drives it): one car for LAPS laps; every step with the brake on
// (> 0.15) or the throttle lifted (< 0.5) where the road is straight (radius over 150 m within
// 40 m ahead), grouped by 25 m of lap, with the driver's target speed against the car's.
// node tools/scratch/_strbrake.mjs [level] [car] [difficulty 0-4] [laps]
import * as L from '../../src/lab.ts';
import { makeCar, step, reset, PHYSICS_STEP_SECONDS as DT } from '../../src/vehicle.ts';
import { createAIDriver } from '../../src/ai/circuit.ts';
import { aiTraits } from '../../src/ai/traits.ts';
const [level = 'pembreezyrx', carId = 'rx-super', diffArg = '2', lapsArg = '3'] =
  process.argv.slice(2);
L.setLevel(level); L.clearWear();
const sub = L.LEVEL.subtrack, total = sub.totalDist;
const at = (d) => sub.pts[Math.floor((((d % total) + total) % total) / total * sub.pts.length)];
const radiusAt = (dist) => {
  const [a, b, c] = [at(dist - 6), at(dist), at(dist + 6)];
  const ax = b.x - a.x, ay = b.y - a.y, bx = c.x - b.x, by = c.y - b.y;
  const cross = Math.abs(ax * by - ay * bx);
  return cross < 1e-6 ? Infinity : Math.hypot(ax, ay) * Math.hypot(bx, by) * Math.hypot(c.x - a.x,
    c.y - a.y) / (2 * cross);
};
const straightAhead = (dist) => [0, 10, 20, 30, 40].every((ahead) => radiusAt(dist + ahead) > 150);
const spawn = L.LEVEL.spawn, car = makeCar(carId);
reset(car, spawn.x, spawn.y, spawn.heading);
const driver = createAIDriver(L.LEVEL, aiTraits(+diffArg, 0, 1, 1));
const bins = new Map();
let time = 0, prog = null, lastQ = null;
while (time < 600) {
  L.applyGround(car, DT);
  const input = driver.drive(car, DT, { cars: [], lap: 1, laps: +lapsArg });
  step(car, input, DT);
  time += DT;
  const q = L.querySubtrack(sub, car.x, car.y);
  if (!Number.isFinite(q.trackDist)) continue;
  if (prog == null) prog = 0;
  else { let dq = q.trackDist - lastQ; if (dq > total / 2) dq -= total; if (dq < -total / 2) dq += total; prog += dq; }
  lastQ = q.trackDist;
  if (time > 6 && straightAhead(q.trackDist) && (input.brake > 0.15 || input.throttle < 0.5)) {
    const key = Math.floor(q.trackDist / 25) * 25, bin = bins.get(key) || { n: 0, brake: 0, kmh: 0 };
    bin.n++; bin.brake += input.brake > 0.15 ? 1 : 0; bin.kmh += Math.hypot(car.vx, car.vy) * 3.6;
    bins.set(key, bin);
  }
  if (prog >= total * +lapsArg) break;
}
const rows = [...bins.entries()].sort((a, b) => a[0] - b[0]).filter(([, bin]) => bin.n * DT > 0.15)
  .map(([key, bin]) => `${key}m ${(bin.n * DT).toFixed(1)}s (brake ${(bin.brake * DT).toFixed(1)}s) ${
    Math.round(bin.kmh / bin.n)}km/h`);
console.log(`${level} ${carId} d${diffArg} ${lapsArg} laps in ${time.toFixed(1)} s; lift/brake on `
  + `straights: ${rows.length ? rows.join(' | ') : 'none'}`);
