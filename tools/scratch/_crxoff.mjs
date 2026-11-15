// _crxoff.mjs - WHERE CROUGHED RX'S RACING AI LEAVES THE ROAD, ALONE (scratch): one car, the racing
// AI (ai/circuit.ts, as aijokercheck drives it) from the grid for 160 s (three laps); every 0.25 s it is off
// (centre past the lap's edge + 1.5 m and off every lane) its lap m, spot, speed and side.
// node tools/scratch/_crxoff.mjs [car] [seed]
import { makeCar, step, reset, PHYSICS_STEP_SECONDS } from '../../src/vehicle.ts';
import * as L from '../../src/lab.ts';
import { createAIDriver } from '../../src/ai/circuit.ts';
import { aiTraits } from '../../src/ai/traits.ts';
import { distToLine } from '../../src/world/venuegeo.ts';

const [carId = 'rx-super', seedArg = '1'] = process.argv.slice(2);
L.setLevel('croughedrx');
const level = L.LEVEL, sub = level.subtrack, half = sub.width / 2;
const car = makeCar(carId);
reset(car, level.spawn.x, level.spawn.y, level.spawn.heading);
const driver = createAIDriver(level, aiTraits(2, 0, 1, +seedArg));
const onLane = (x, y) => (level.lanes || []).some((lane) => distToLine(lane.pts, x, y)
  < lane.width / 2 + 1.5);
let time = 0, lap = 1, last = 0, offTotal = 0;
while (time < 160) {
  L.applyGround(car, PHYSICS_STEP_SECONDS);
  step(car, driver.drive(car, PHYSICS_STEP_SECONDS, { cars: [], lap, laps: 5 }),
    PHYSICS_STEP_SECONDS);
  time += PHYSICS_STEP_SECONDS;
  const hit = L.querySubtrack(sub, car.x, car.y);
  if (hit.trackDist < last - sub.totalDist / 2) lap++;
  last = hit.trackDist;
  if (hit.dist > half + 1.5 && !onLane(car.x, car.y)) {
    offTotal += PHYSICS_STEP_SECONDS;
    if (Math.round(time * 120) % 30 === 0) console.log(`lap ${lap} m ${hit.trackDist.toFixed(0)} `
      + `(${car.x.toFixed(0)},${car.y.toFixed(0)}) ${(Math.hypot(car.vx, car.vy) * 3.6).toFixed(0)} `
      + `km/h ${hit.dist.toFixed(1)} m off, ${hit.side}`);
  }
}
console.log(`${carId} seed ${seedArg}: ${time.toFixed(0)} s, off ${offTotal.toFixed(1)} s`);
