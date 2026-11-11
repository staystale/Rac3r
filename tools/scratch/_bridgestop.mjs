// _bridgestop.mjs - a car driven over the endless road's first drivable bridge (?drivebridges=1)
// at full throttle, no steering, set 20 m out from end A: each 0.1 s along / across the way, speed,
// and which of clampWorld / applyGround / the car step changed the speed most that interval.
// [ROAD=motorway] [SCENERY=countryside] node tools/scratch/_bridgestop.mjs
import { makeCar, step, reset, PHYSICS_STEP_SECONDS } from '../../src/vehicle.ts';
import * as L from '../../src/lab.ts';
import { FIX } from '../../src/core/fixes.ts';
import * as highway from '../../src/highway.ts';
import { createAutoDriver } from '../../src/ai/autodrive.ts';
import { solidClamp } from '../../src/world/barriers.ts';
import { clampWorld } from '../../src/world/crossings.ts';
FIX.drivebridges = true;
highway.addHighwayLevel();
L.setLevel('highway');
const level = L.LEVEL;
highway.setHighwayPreset(level, process.env.ROAD || 'motorway', process.env.SCENERY || 'countryside');
highway.resetHighway(level);
const car = makeCar('hatch-rwd');
reset(car, level.spawn.x, level.spawn.y, level.spawn.heading);
let sub = level.subtrack, driver = createAutoDriver(sub);
const real = () => (level.crossings || []).find((way) => way.length > 0);
for (let time = 0; time < 300 && !real(); time += PHYSICS_STEP_SECONDS) {
  if (level.subtrack !== sub) { sub = level.subtrack; driver = createAutoDriver(sub); }
  L.applyGround(car, PHYSICS_STEP_SECONDS);
  step(car, driver.drive(car, PHYSICS_STEP_SECONDS), PHYSICS_STEP_SECONDS);
  solidClamp(car);
  highway.stepHighway(level, car, L.querySubtrack(sub, car.x, car.y).trackDist);
}
const way = real(), index = level.crossings.indexOf(way), mid = (way.minAcross + way.maxAcross) / 2;
const test = makeCar('hatch-rwd');
reset(test, way.ax - way.dirX * 20 - way.dirY * mid, way.ay - way.dirY * 20 + way.dirX * mid,
  Math.atan2(way.dirY, way.dirX));
test.vx = way.dirX * 8;
test.vy = way.dirY * 8;
const speed = () => Math.hypot(test.vx, test.vy);
const loss = { clamp: 0, ground: 0, step: 0 };
for (let tick = 0; tick < 900; tick++) {
  let before = speed();
  clampWorld(test, PHYSICS_STEP_SECONDS);
  loss.clamp += before - speed();
  before = speed();
  L.applyGround(test, PHYSICS_STEP_SECONDS);
  loss.ground += before - speed();
  before = speed();
  step(test, { steer: 0, throttle: 1, brake: 0, handbrake: 0 }, PHYSICS_STEP_SECONDS);
  loss.step += before - speed();
  if (tick % 12 === 0) {
    const along = (test.x - way.ax) * way.dirX + (test.y - way.ay) * way.dirY;
    const across = (test.y - way.ay) * way.dirX - (test.x - way.ax) * way.dirY;
    console.log(`${along.toFixed(1)} ${across.toFixed(2)} ${(speed() * 3.6).toFixed(0)} km/h on`
      + ` ${test.crossing} (way ${index}, ${way.length.toFixed(1)} m) lost: clamp`
      + ` ${loss.clamp.toFixed(2)} ground ${loss.ground.toFixed(2)} step ${loss.step.toFixed(2)}`);
    loss.clamp = loss.ground = loss.step = 0;
  }
}
