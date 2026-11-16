// _launchtrace.mjs - A STANDING LAUNCH, full throttle from rest on race tarmac (headless, the
// game's own vehicle step): per car, how long each axle shows wheelspin (telemetry spinF / spinR),
// the peak slip speed of the driven axle, and the time to 100 km/h; aids off and on; tyres cold
// (the grid) or warm (85 C); the pedal floored at once (flat) or as the player's held button gives
// it (ramp: src/input.ts, 0.26 at once to full over 1.5 s). Nothing in the game is changed.
// node tools/scratch/_launchtrace.mjs <cars, comma list> [cold|warm] [flat|ramp]  (NAME=1: a new car;
// TYRE=<tyre id> fits that set, e.g. p-soft)
import { makeCar, step, reset, PHYSICS_STEP_SECONDS } from '../../src/vehicle.ts';
import { SURFACES } from '../../src/lab.ts';
import { applyTyre } from '../../src/cars.ts';

const [carsArg = 'hatch-fwd', tyres = 'cold', pedal = 'flat'] = process.argv.slice(2);
// the held button's throttle (src/input.ts THR_MIN, THR_RAMP)
const pedalAt = (time) => (pedal === 'ramp' ? Math.min(1, 0.26 + 0.74 * time / 1.5) : 1);
for (const id of carsArg.split(',')) {
  for (const aids of [false, true]) {
    const car = makeCar(id);
    if (process.env.TYRE) applyTyre(car.spec, process.env.TYRE);
    reset(car, 0, 0, 0);
    if (tyres === 'warm') car.tyreT = [85, 85, 85, 85];
    car.absOn = aids;
    car.tcsOn = aids;
    let spinFs = 0, spinRs = 0, peakSlip = 0, firstSpin = null, lastSpin = null, at100 = null;
    for (let time = 0; time < 12; time += PHYSICS_STEP_SECONDS) {
      car.surface = SURFACES.racetarmac;
      step(car, { steer: 0, throttle: pedalAt(time), brake: 0, handbrake: 0 }, PHYSICS_STEP_SECONDS);
      const spin = car.t.spinF || car.t.spinR;
      if (car.t.spinF) spinFs += PHYSICS_STEP_SECONDS;
      if (car.t.spinR) spinRs += PHYSICS_STEP_SECONDS;
      if (spin && firstSpin === null) firstSpin = time;
      if (spin) lastSpin = time;
      peakSlip = Math.max(peakSlip, car.t.slipSpeedDriven || 0);
      if (at100 === null && car.t.vLong >= 27.78) at100 = time;
    }
    const fmt = (value) => (value === null ? '-' : value.toFixed(2));
    console.log(`${id.padEnd(14)} aids ${aids ? 'on ' : 'off'} | spin F ${spinFs.toFixed(2)} s, R `
      + `${spinRs.toFixed(2)} s (from ${fmt(firstSpin)} to ${fmt(lastSpin)} s) | peak driven slip `
      + `${peakSlip.toFixed(2)} m/s | 0-100 ${fmt(at100)} s`);
  }
}
