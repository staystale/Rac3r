// _railbridge.mjs - A RAIL BRIDGE DRIVEN AND ITS TRAIN MET (?railbridges=1): the endless road
// (ROAD, SCENERY) driven by the autopilot until a rail bridge's crossing is loaded; then (1) a car
// driven along its track both ways at 12 m/s (on, off past the far end, wall hits) and (2) a car
// stopped on the deck's middle, in the train's path, with the world's clock run until the train
// has passed: its speed before / after, how far it was carried, the impact (the speed change).
// RAILBRIDGES=1 [ROAD=motorway] [SCENERY=canyon] [SEED=4242] node tools/scratch/_railbridge.mjs
import { makeCar, step, reset, PHYSICS_STEP_SECONDS } from '../../src/vehicle.ts';
import * as L from '../../src/lab.ts';
import * as hw from '../../src/highway.ts';
import { createAutoDriver } from '../../src/ai/autodrive.ts';
import { solidClamp } from '../../src/world/barriers.ts';
import { clampWorld } from '../../src/world/crossings.ts';
import { alongOf, acrossOf } from '../../src/world/crossinggeo.ts';
import { advanceWorldClock, worldSeconds } from '../../src/world/worldclock.ts';
import { trainAt } from '../../src/world/trains.ts';
hw.addHighwayLevel();
L.setLevel('highway');
const level = L.LEVEL;
level.seed = +(process.env.SEED || 4242);
hw.setHighwayPreset(level, process.env.ROAD || 'motorway', process.env.SCENERY || 'canyon');
hw.resetHighway(level);
const pilot = makeCar('hatch-rwd');
reset(pilot, level.spawn.x, level.spawn.y, level.spawn.heading);
let sub = level.subtrack, driver = createAutoDriver(sub), way = null;
for (let time = 0; time < 900 && !way; time += PHYSICS_STEP_SECONDS) {
  if (level.subtrack !== sub) { sub = level.subtrack; driver = createAutoDriver(sub); }
  L.applyGround(pilot, PHYSICS_STEP_SECONDS);
  step(pilot, driver.drive(pilot, PHYSICS_STEP_SECONDS), PHYSICS_STEP_SECONDS);
  solidClamp(pilot);
  hw.stepHighway(level, pilot, L.querySubtrack(sub, pilot.x, pilot.y).trackDist);
  way = (level.crossings || []).find((item) => item.ballast && item.length > 0) || null;
}
if (!way) { console.log('no rail bridge reached'); process.exit(1); }
const index = level.crossings.indexOf(way), bridge = way.train;
console.log(`rail bridge at ${Math.round(bridge._s)} m (${bridge.look || 'plain'}), crossing`
  + ` ${way.length.toFixed(1)} m, deck ${way.minAcross}..${way.maxAcross}`);
// (1) along the track both ways, between trains (the clock run on to a gap)
for (let time = 0; time < 60 && trainAt(bridge, worldSeconds() + (bridge.phase || 0)); time += 0.1)
  advanceWorldClock(0.1);
for (const sign of [1, -1]) {
  const car = makeCar('hatch-rwd');
  const startAlong = sign > 0 ? -8 : way.length + 8;
  reset(car, way.ax + way.dirX * startAlong, way.ay + way.dirY * startAlong,
    Math.atan2(way.dirY * sign, way.dirX * sign));
  let came = false, left = false, hits = 0;
  for (let time = 0; time < 20 && !left; time += PHYSICS_STEP_SECONDS) {
    const head = Math.atan2(way.dirY * sign, way.dirX * sign);
    let err = head - car.heading - acrossOf(way, car.x, car.y) * sign * 0.08;
    err = Math.atan2(Math.sin(err), Math.cos(err));
    const speed = Math.hypot(car.vx, car.vy);
    clampWorld(car, PHYSICS_STEP_SECONDS);
    L.applyGround(car, PHYSICS_STEP_SECONDS);
    step(car, { steer: Math.max(-1, Math.min(1, err * 2.5)), throttle: speed < 12 ? 0.6 : 0,
      brake: 0, handbrake: 0 }, PHYSICS_STEP_SECONDS);
    if (car.crossing === index) { came = true; if (car._hitKind) hits++; }
    else if (came) left = true;
    car._hitKind = null;
  }
  const along = alongOf(way, car.x, car.y);
  console.log(`  ${sign > 0 ? 'A->B' : 'B->A'}: on ${came}, off ${left} past the far end`
    + ` ${sign > 0 ? along > way.length : along < 0}, ${hits} wall hits`);
}
// (2) stopped on the deck in the train's path, the clock run until the train has passed
const car = makeCar('hatch-rwd'), mid = way.length / 2;
const first = trainAt(bridge, worldSeconds() + (bridge.phase || 0));
reset(car, way.ax + way.dirX * mid, way.ay + way.dirY * mid, Math.atan2(way.dirY, way.dirX));
car.crossing = index;
car.crossX = car.x;
car.crossY = car.y;
let worst = 0, carried = 0, met = false, before = 0;
const x0 = car.x, y0 = car.y;
for (let time = 0; time < 120; time += PHYSICS_STEP_SECONDS) {
  advanceWorldClock(PHYSICS_STEP_SECONDS);
  const v0 = Math.hypot(car.vx, car.vy);
  clampWorld(car, PHYSICS_STEP_SECONDS);
  const kick = Math.hypot(car.vx, car.vy) - v0;
  if (kick > 1 && !met) { met = true; before = v0; }
  worst = Math.max(worst, kick);
  L.applyGround(car, PHYSICS_STEP_SECONDS);
  step(car, { steer: 0, throttle: 0, brake: 1, handbrake: 0 }, PHYSICS_STEP_SECONDS);
  carried = Math.max(carried, Math.hypot(car.x - x0, car.y - y0));
}
console.log(`  stopped on the deck: met the train ${met} (${first ? 'one was on it' : 'between'}`
  + ` trains at the start), from ${before.toFixed(1)} m/s, the worst kick ${worst.toFixed(1)} m/s`
  + ` a step, carried ${carried.toFixed(1)} m, on the deck after ${car.crossing === index}`);
