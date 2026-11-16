// _tipcheck.mjs - THE TWO-WHEEL STATE (physics/tip.ts, ?tipping), headless with the game's own
// step: per car and speed on race tarmac, flat out to the speed, then full lock held (throttle to
// hold the speed) for 4 s - whether it lifts, how far it leans, whether it goes over; and the same
// with the SAVE (as soon as it lifts: the steering eased to 30 %, off the throttle). Nothing in the
// game is changed. node tools/scratch/_tipcheck.mjs <cars> [speeds km/h]  (TIPPING=1; NAME=1)
import { makeCar, step, reset, PHYSICS_STEP_SECONDS as dt } from '../../src/vehicle.ts';
import { SURFACES } from '../../src/lab.ts';
import { stepTipping, isTipping, tipSave } from '../../src/physics/tip.ts';
import { rolling } from '../../src/roll.ts';

const [carsArg = 'routemonster,hatch-fwd', speedsArg = '30,40,50,60'] = process.argv.slice(2);
/**
 * One run: to the speed, then full lock for 4 s.
 * @returns lifted, max lean (deg), over
 */
function run(id, kph, save) {
  const car = makeCar(id);
  reset(car, 0, 0, 0);
  car.tyreT = [85, 85, 85, 85];
  const target = kph / 3.6;
  let lifted = false, over = false, maxLean = 0, saved = false;
  for (let time = 0; time < 40 && car.t.vLong < target; time += dt) {
    car.surface = SURFACES.racetarmac;
    step(car, { steer: 0, throttle: 1, brake: 0, handbrake: 0 }, dt);
  }
  for (let time = 0; time < 4; time += dt) {
    car.surface = SURFACES.racetarmac;
    if (rolling(car)) { over = true; break; }
    const hold = car.t.vLong < target ? 0.6 : 0;
    let input = { steer: 1, throttle: hold, brake: 0, handbrake: 0 };
    if (save && isTipping(car)) input = tipSave(input);
    step(car, input, dt);
    stepTipping(car, dt);
    if (isTipping(car)) { lifted = true; maxLean = Math.max(maxLean, Math.abs(car.roll.phi)); }
    if (lifted && !car.roll) saved = true;
  }
  return { lifted, lean: (maxLean * 180 / Math.PI).toFixed(1), over, saved };
}
for (const id of carsArg.split(',')) {
  for (const kph of speedsArg.split(',').map(Number)) {
    const held = run(id, kph, false), eased = run(id, kph, true);
    console.log(`${id.padEnd(14)} ${String(kph).padStart(3)} km/h | held: ${held.lifted ? 'LIFTS' : 'flat '}`
      + ` lean ${held.lean.padStart(4)} deg ${held.over ? 'OVER' : held.lifted ? 'down' : ''}`
      + ` | saved: ${eased.lifted ? 'LIFTS' : 'flat '} lean ${eased.lean.padStart(4)} deg `
      + `${eased.over ? 'OVER' : eased.lifted ? 'down' : ''}`);
  }
}
