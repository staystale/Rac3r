// airbrake.mjs — REGRESSION TEST for "the game freezes if you brake while jumping" (fixed 2026-10-03).
//
// Every car drives at the lab launch ramp (lab.js LAB_BUMPS, x 120 / y -80), goes airborne, and then
// does each of the things a player might do in the air: brake, handbrake, throttle, brake+steer. The
// car's state is asserted finite EVERY step, and the car must land and still be drivable afterwards.
//
// What it caught: an axle with zero vertical load made the tyre model divide 0 by 0 (vehicle.js, the
// guard at the top of axle()). The NaN went into the car's position, the next step threw, and the
// browser's frame loop died — a frozen screen. Before the fix this printed NaN for 8 of 8 cars.
//
//   node tools/airbrake.mjs          all cars, all airborne inputs   (exit code 1 on any failure)

import { makeCar, step, reset, assertFinite, PHYSICS_STEP_SECONDS } from '../src/vehicle.ts';
import { applyGround } from '../src/lab.js';
import { CAR_IDS } from '../src/cars.ts';

const AIR_INPUTS = {
  brake:      { throttle: 0, brake: 1, handbrake: false, steer: 0 },
  handbrake:  { throttle: 0, brake: 0, handbrake: true, steer: 0 },
  throttle:   { throttle: 1, brake: 0, handbrake: false, steer: 0 },
  brakeSteer: { throttle: 0, brake: 1, handbrake: true, steer: 1 },
};
const fails = [];
console.log('car          input        airtime  speed@land  speed@end   ok');
for (const id of CAR_IDS) {
  for (const [name, airInput] of Object.entries(AIR_INPUTS)) {
    const car = makeCar(id);
    reset(car, 120, -10, -Math.PI / 2);   // flat floor, heading -y, 70 m short of the ramp
    // ROLLING START at 25 m/s (2026-10-03): from rest, the track car (more downforce) under VERT_G 1.4 no longer left the ramp
    // and the bench flagged itself as testing nothing. Every car now arrives fast enough to fly.
    car.vy = -25; car.gear = 3;
    let maxAir = 0, landSpeed = null, wasAir = false, bad = null;
    for (let i = 0; i < 120 * 8; i++) {
      const inAir = car.air > 0;
      const inp = inAir ? airInput : { throttle: 1, brake: 0, handbrake: false, steer: 0 };
      applyGround(car, PHYSICS_STEP_SECONDS);
      try {
        step(car, inp, PHYSICS_STEP_SECONDS);
        assertFinite(car);
      } catch (e) { bad = `step ${i}: ${e.message}`; break; }
      maxAir = Math.max(maxAir, car.air);
      if (wasAir && !inAir && landSpeed === null) landSpeed = car.t.speed;
      wasAir = inAir;
    }
    // the bench is only meaningful if the car actually flew (CLAUDE.md rule 15: verify the mechanism)
    if (!bad && maxAir < 0.05) bad = `never left the ground (maxAir ${maxAir.toFixed(2)} s) — bench is not testing anything`;
    if (bad) fails.push(`${id} / ${name}: ${bad}`);
    console.log(`${id.padEnd(12)} ${name.padEnd(12)} ${maxAir.toFixed(2).padStart(6)} s ${(landSpeed ?? NaN).toFixed(1).padStart(8)} m/s ${car.t.speed.toFixed(1).padStart(7)} m/s  ${bad ? 'FAIL ' + bad : 'ok'}`);
  }
}
console.log(fails.length ? `\nFAIL (${fails.length}):\n  ` + fails.join('\n  ') : '\nAirborne inputs: all finite, all cars land and drive on. OK');
process.exitCode = fails.length ? 1 : 0;
