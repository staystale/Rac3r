// _hwbarrelcrash.mjs - A CAR INTO A CRASH-CUSHION CLUSTER (TODO 3a2 item 13, ?hwbarrels=1). Node
// only, as tools/balecheck.mjs: a hatch coasts (no throttle, no brake) on the Lab's floor into a
// triangle laid as the highway lays one (highway/cushions.ts CUSHION_ROWS: its one barrel first),
// square on and 0.6 m off its middle, at 50 / 80 / 120 km/h. Reads the speed it has where the
// barrier's end would stand (END_GAP_M behind the back row) against the same coast with no
// barrels - what the barrels took off the hit - and what the hits did: popped, leaked, the wet
// cells. RUNS runs a case (the pops are rolled).
// [RUNS=5] node tools/scratch/_hwbarrelcrash.mjs
import { makeCar, step, reset, PHYSICS_STEP_SECONDS } from '../../src/vehicle.ts';
import * as L from '../../src/lab.ts';
import { createCones } from '../../src/cones.ts';
import { CUSHION_ROWS } from '../../src/highway/cushions.ts';
import { wearMap, clearWear } from '../../src/world/wear.ts';
import { COL } from '../../src/world/colours.ts';

L.setLevel('lab');
const RUNS = +(process.env.RUNS || 5);
// m: the cluster's front barrel, the spacing (cushions.ts ACROSS_M / ALONG_M), the end's gap
const FRONT_X = 40, ACROSS = 0.95, ALONG = 0.9, END_GAP = 0.15 + 0.45, START_X = 10;
const NO_INPUT = { steer: 0, throttle: 0, brake: 0, handbrake: 0, reverse: 0 };

/** The cluster's barrels as level objects, front first along +x. */
function clusterObjs() {
  const rows = CUSHION_ROWS, out = [];
  rows.forEach((across, row) => {
    for (let slot = 0; slot < across; slot++)
      out.push({ kind: 'cushion', x: FRONT_X + row * ALONG, y: (slot - (across - 1) / 2) * ACROSS,
        rot: 0, paint: COL.cushionBlue });
  });
  return { objs: out, endX: FRONT_X + (rows.length - 1) * ALONG + END_GAP };
}

/** Coasts a hatch from START_X at kmh until its nose reaches endX; its speed there, km/h. */
function coast(kmh, offY, endX, cones) {
  const car = makeCar('hatch-rwd');
  reset(car, START_X, offY, 0);
  car.vx = kmh / 3.6;
  let time = 0;
  while (time < 4 && car.x + car.spec.len / 2 < endX && Math.hypot(car.vx, car.vy) > 0.3) {
    L.applyGround(car, PHYSICS_STEP_SECONDS);
    step(car, NO_INPUT, PHYSICS_STEP_SECONDS);
    if (cones) cones.step(car, PHYSICS_STEP_SECONDS);
    time += PHYSICS_STEP_SECONDS;
  }
  return car.x + car.spec.len / 2 >= endX ? Math.hypot(car.vx, car.vy) * 3.6 : 0;
}

/** One case: its runs' speeds at the end (free and through the barrels) and what the hits did. */
function runCase(kmh, offY) {
  const speeds = [], popped = [], leaked = [], wet = [];
  let free = 0;
  for (let run = 0; run < RUNS; run++) {
    clearWear();
    const cones = createCones();
    cones.list.length = 0;
    const { objs, endX } = clusterObjs();
    cones.spawn(objs);
    free = coast(kmh, offY, endX, null);
    speeds.push(coast(kmh, offY, endX, cones));
    popped.push(cones.list.filter((obj) => obj.kind === 'cushionpop').length);
    leaked.push(cones.list.filter((obj) => obj.kind === 'cushion' && obj.water != null
      && obj.water < 6).length);
    wet.push([...wearMap.values()].filter((cell) => cell.cover === 'wet').length);
  }
  const range = (list) => `${Math.min(...list).toFixed(0)}-${Math.max(...list).toFixed(0)}`;
  return `the triangle (1-2-3) ${kmh} km/h ${offY ? 'off-centre' : 'square'}: at the`
    + ` end ${range(speeds)} km/h (no barrels ${free.toFixed(0)}), popped ${range(popped)},`
    + ` leaked ${range(leaked)}, wet cells ${range(wet)}`;
}

for (const kmh of [50, 80, 120])
  for (const offY of [0, 0.6]) console.log(runCase(kmh, offY));
