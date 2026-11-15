// _crxjoker.mjs - CROUGHED RX'S JOKER DRIVEN (scratch): jokercost's joker lap (the lap with the
// branch -> rejoin stretch swapped for the joker lane), the autodriver's speed and the surface
// under the car every 10 m from 60 m before the branch to 40 m past the rejoin, one car.
// CROUGHEDRX=1 node tools/scratch/_crxjoker.mjs [car]
import { makeCar, step, reset, PHYSICS_STEP_SECONDS } from '../../src/vehicle.ts';
import * as L from '../../src/lab.ts';
import { createAutoDriver } from '../../src/ai/autodrive.ts';
import { jokerLane } from '../../src/world/joker.ts';

L.setLevel('croughedrx');
const sub = L.LEVEL.subtrack, lane = jokerLane(L.LEVEL).pts;
const lapAt = ([x, y]) => L.querySubtrack(sub, x, y).trackDist;
const branch = lapAt(lane[0]), rejoin = lapAt(lane.at(-1));
const pts = sub.pts.filter((pt) => pt.dist < branch).map((pt) => [pt.x, pt.y])
  .concat(lane.slice(1, -1), sub.pts.filter((pt) => pt.dist > rejoin).map((pt) => [pt.x, pt.y]));
const jokerLap = L.createSubtrack(pts, sub.width, [], [], true);
const car = makeCar(process.argv[2] || 'rally-4x4');
const from = L.querySubtrack(jokerLap, ...lane[0]).trackDist - 60;
const start = jokerLap.pts.find((pt) => pt.dist >= from - 150);
reset(car, start.x, start.y, start.heading);
const driver = createAutoDriver(jokerLap);
let time = 0, next = from;
while (time < 120) {
  L.applyGround(car, PHYSICS_STEP_SECONDS);
  step(car, driver.drive(car), PHYSICS_STEP_SECONDS);
  time += PHYSICS_STEP_SECONDS;
  const hit = L.querySubtrack(jokerLap, car.x, car.y);
  if (hit.trackDist >= next && hit.trackDist < next + 30) {
    console.log(`${hit.trackDist.toFixed(0)} m t ${time.toFixed(1)} s ${(Math.hypot(car.vx, car.vy)
      * 3.6).toFixed(0)} km/h off ${hit.dist.toFixed(1)} m at ${car.x.toFixed(0)},${car.y.toFixed(0)}`);
    next += 10;
  }
  if (next > from + 60 + (rejoin - branch) + 80) break;
}
