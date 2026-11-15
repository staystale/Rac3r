// _crxlap.mjs - CROUGHED RX'S LAP AS LAPDRIVER DRIVES IT, its off time split (scratch): the same
// autodriver and the same off-road test as tools/lapdriver.mjs (the driver's distance from the
// lap's centreline past half the road), run for two laps from the grid; the seconds off counted
// apart while the car is on the start lane (within its half width: off the lap by design), and the
// second, flying lap's own; WHERE=1 prints where it is off the lap. node tools/scratch/_crxlap.mjs [car]
import { makeCar, step, reset, PHYSICS_STEP_SECONDS } from '../../src/vehicle.ts';
import * as L from '../../src/lab.ts';
import { createAutoDriver } from '../../src/ai/autodrive.ts';
import { distToLine } from '../../src/world/venuegeo.ts';

const carId = process.argv[2] || 'rally-4x4';
L.setLevel('croughedrx');
const level = L.LEVEL, sub = level.subtrack, total = sub.totalDist, halfRoad = sub.width / 2;
const startLane = level.lanes.find((lane) => Math.hypot(lane.pts.at(-1)[0] - sub.pts[0].x,
  lane.pts.at(-1)[1] - sub.pts[0].y) < 20);
const car = makeCar(carId);
reset(car, level.spawn.x, level.spawn.y, level.spawn.heading);
const driver = createAutoDriver(sub);
const laps = [{ time: 0, offLane: 0, offLap: 0, worst: 0 }, { time: 0, offLane: 0, offLap: 0,
  worst: 0 }];
let time = 0;
while (driver.state.travelled < 2 * total && time < 600) {
  L.applyGround(car, PHYSICS_STEP_SECONDS);
  step(car, driver.drive(car), PHYSICS_STEP_SECONDS);
  time += PHYSICS_STEP_SECONDS;
  const lap = laps[driver.state.travelled < total ? 0 : 1];
  lap.time += PHYSICS_STEP_SECONDS;
  const off = driver.state.lastDist - halfRoad;
  if (off <= 0) continue;
  const onLane = distToLine(startLane.pts, car.x, car.y) < startLane.width / 2;
  if (onLane) lap.offLane += PHYSICS_STEP_SECONDS;
  else {
    lap.offLap += PHYSICS_STEP_SECONDS;
    lap.worst = Math.max(lap.worst, off);
    // (where: every 0.25 s off it, the lap m, the car's spot and the time)
    if (process.env.WHERE && Math.round(time * 120) % 30 === 0) console.log(`off at lap m `
      + `${driver.state.travelled.toFixed(0)} (${car.x.toFixed(0)},${car.y.toFixed(0)}) t ${time.toFixed(2)}`);
  }
}
laps.forEach((lap, i) => console.log(`croughedrx / ${carId} ${i ? 'flying lap' : 'lap from the grid'}:`
  + ` ${lap.time.toFixed(1)} s | off the lap's road on the start lane ${lap.offLane.toFixed(1)} s`
  + ` | off it elsewhere ${lap.offLap.toFixed(1)} s, worst ${lap.worst.toFixed(1)} m past the edge`));
