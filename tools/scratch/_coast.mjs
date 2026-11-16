// _coast.mjs - A LIFT AT SPEED on race tarmac (headless, the game's own vehicle step): per car,
// full throttle to a speed, then off the pedal (no brake): the drag's g in each band as it slows
// (engine braking, or an electric car's regen, with the air and the tyres' roll), and the
// distance to lose the first 50 km/h. Nothing in the game is changed.
// node tools/scratch/_coast.mjs <cars, comma list> [from km/h, 130]  (NAME=1: a new car)
import { makeCar, step, reset, PHYSICS_STEP_SECONDS } from '../../src/vehicle.ts';
import { SURFACES } from '../../src/lab.ts';

const [carsArg = 'hatch-fwd', fromArg = '130'] = process.argv.slice(2);
const from = Number(fromArg) / 3.6, dt = PHYSICS_STEP_SECONDS, g = 9.81;
for (const id of carsArg.split(',')) {
  const car = makeCar(id);
  reset(car, 0, 0, 0);
  car.tyreT = [85, 85, 85, 85];
  let time = 0;
  for (; time < 40 && car.t.vLong < from; time += dt) {
    car.surface = SURFACES.racetarmac;
    step(car, { steer: 0, throttle: 1, brake: 0, handbrake: 0 }, dt);
  }
  const bands = [], marks = [130, 100, 70, 40, 10].map((kph) => kph / 3.6).filter((v) => v <= from);
  let last = { v: car.t.vLong, t: 0 }, dist = 0, at50 = null, coast = 0;
  for (const mark of marks.slice(1)) {
    while (car.t.vLong > mark && coast < 120) {
      car.surface = SURFACES.racetarmac;
      step(car, { steer: 0, throttle: 0, brake: 0, handbrake: 0 }, dt);
      coast += dt; dist += car.t.vLong * dt;
      if (at50 === null && car.t.vLong <= from - 50 / 3.6) at50 = dist;
    }
    bands.push(`${Math.round(last.v * 3.6)}-${Math.round(mark * 3.6)} `
      + `${((last.v - car.t.vLong) / (coast - last.t) / g).toFixed(3)} g`);
    last = { v: car.t.vLong, t: coast };
  }
  console.log(`${id.padEnd(14)} lift at ${Math.round(from * 3.6)} | ${bands.join(' | ')} | `
    + `-50 km/h in ${at50 === null ? '-' : at50.toFixed(0)} m`);
}
