// _overroll.mjs - a car driven at a thrown part on the open floor, many times per kind: how often
// it goes over the part (the part barely moves, the car keeps its speed) and how often into it
// (the part is knocked away). node tools/scratch/_overroll.mjs
import { makeCar, step, reset, PHYSICS_STEP_SECONDS } from '../../src/vehicle.ts';
import * as L from '../../src/lab.ts';
import { createCones } from '../../src/cones.ts';
import { DEBRIS } from '../../src/cones/coneConsts.ts';

L.setLevel('lab');
const KINDS = ['mesh', 'mirror', 'panel', 'bumper', 'strut', 'bonnet', 'fencepost', 'engine'];
const CHANCE = { mesh: 1, mirror: 0.7, panel: 0.6, bumper: 0.6, strut: 0.5, bonnet: 0.5,
  fencepost: 0.4, engine: 0 };
const RUNS = 40;
for (const carId of (process.env.CARS || 'hatch-rwd').split(',')) for (const kind of KINDS) {
  let over = 0;
  for (let run = 0; run < RUNS; run++) {
    const cones = createCones();
    const table = DEBRIS[kind];
    cones.add({ kind, mode: kind, part: true, mass: table.mass, r: table.r, x: 0, y: 0, vx: 0,
      vy: 0, overChance: CHANCE[kind] });
    const car = makeCar(carId);
    reset(car, -12, 0, 0);
    car.vx = 11;
    let hit = false;
    for (let time = 0; time < 2; time += PHYSICS_STEP_SECONDS) {
      L.applyGround(car, PHYSICS_STEP_SECONDS);
      step(car, { steer: 0, throttle: 0.3, brake: 0, handbrake: 0 }, PHYSICS_STEP_SECONDS);
      cones.step(car, PHYSICS_STEP_SECONDS);
      if (car._hitKind === kind) hit = true;
      car._hitKind = null;
    }
    if (!hit) over++;
  }
  console.log(`${carId} rideH ${makeCar(carId).spec.rideH}: ${kind.padEnd(10)} chance ${CHANCE[kind].toFixed(1)}: over ${over} of ${RUNS}`
    + ` (${(over / RUNS).toFixed(2)})`);
}
