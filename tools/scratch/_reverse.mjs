// _reverse.mjs - FULL REVERSE FROM REST on race tarmac (headless, the game's own vehicle step): per
// car, aids on and off, the reverse pedal floored for 8 s: the top reverse speed, the time the
// driven wheels show wheelspin and the peak slip, and whether traction control cut in. Nothing in
// the game is changed. node tools/scratch/_reverse.mjs <cars, comma list>  (NAME=1: a new car)
import { makeCar, step, reset, PHYSICS_STEP_SECONDS } from '../../src/vehicle.ts';
import { SURFACES } from '../../src/lab.ts';

const dt = PHYSICS_STEP_SECONDS;
for (const id of (process.argv[2] || 'hatch-fwd').split(',')) {
  for (const aids of [true, false]) {
    for (const surface of ['racetarmac', 'gravel']) {
      const car = makeCar(id);
      reset(car, 0, 0, 0);
      car.absOn = aids; car.tcsOn = aids;
      let top = 0, spinS = 0, peak = 0, at10 = null;
      for (let time = 0; time < 8; time += dt) {
        car.surface = SURFACES[surface];
        step(car, { steer: 0, throttle: 0, brake: 0, handbrake: 0, reverse: 1 }, dt);
        top = Math.max(top, -car.t.vLong);
        if (car.t.spinF || car.t.spinR) spinS += dt;
        peak = Math.max(peak, car.t.slipSpeedDriven || 0);
        if (at10 === null && -car.t.vLong >= 10 / 3.6) at10 = time;
      }
      console.log(`${id.padEnd(12)} aids ${aids ? 'on ' : 'off'} ${surface.padEnd(10)} | top `
        + `${(top * 3.6).toFixed(1)} km/h | 0-10 ${at10 === null ? '-' : at10.toFixed(2)} s | `
        + `spin ${spinS.toFixed(2)} s | peak slip ${peak.toFixed(2)} m/s`);
    }
  }
}
