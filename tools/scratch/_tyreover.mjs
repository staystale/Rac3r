// _tyreover.mjs - a car driven at a tyre lying flat, 40 times: how often it goes over (no hit)
import { makeCar, step, reset, PHYSICS_STEP_SECONDS } from '../../src/vehicle.ts';
import * as L from '../../src/lab.ts';
import { createCones } from '../../src/cones.ts';
L.setLevel('lab');
for (const carId of ['track-rwd', 'hatch-rwd', 'rally-4x4', 'tractor']) {
  let over = 0;
  for (let run = 0; run < 40; run++) {
    const cones = createCones();
    cones.add({ kind: 'tyre', mode: 'flat', x: 0, y: 0, vx: 0, vy: 0, down: 1 });
    const car = makeCar(carId);
    reset(car, -12, 0, 0);
    car.vx = 11;
    let hit = false;
    for (let time = 0; time < 2; time += PHYSICS_STEP_SECONDS) {
      L.applyGround(car, PHYSICS_STEP_SECONDS);
      step(car, { steer: 0, throttle: 0.3, brake: 0, handbrake: 0 }, PHYSICS_STEP_SECONDS);
      cones.step(car, PHYSICS_STEP_SECONDS);
      if (car._hitKind === 'tyre') hit = true;
      car._hitKind = null;
    }
    if (!hit) over++;
  }
  console.log(`${carId} rideH ${makeCar(carId).spec.rideH}: over a lying tyre ${over} of 40`);
}
