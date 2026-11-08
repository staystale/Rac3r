// _absbutton.mjs - ABS vs no ABS as the touch BRAKE button presses it (input.js ramp: 0.28 bite,
// full after RAMP s), from 100 and 150 km/h on tarmac: stop metres and seconds.
// node tools/scratch/_absbutton.mjs [rampS] [cars,comma]
import { makeCar, step, reset, neutralInput, PHYSICS_STEP_SECONDS as DT } from '../../src/vehicle.ts';
import { SURFACES } from '../../src/world/surfaces.ts';
const RAMP = +(process.argv[2] || 0.25);
const ids = (process.argv[3] || 'hatch-fwd,hatch-rwd,muscle-rwd,lambo-awd,mini-fwd,track-rwd').split(',');
function stop(id, kmh, abs) {
  const car = makeCar(id); reset(car, 0, 0, 0); car.surface = SURFACES.tarmac; car.tyreT = [85, 85, 85, 85];
  car.absOn = abs; car.vx = kmh / 3.6; car.gear = 4; car.rpm = 4000;
  let t = 0;
  while (Math.hypot(car.vx, car.vy) > 0.3 && t < 20) {
    const brake = Math.min(1, 0.28 + 0.72 * t / RAMP);
    step(car, { ...neutralInput(), brake }, DT); t += DT;
  }
  return `${Math.hypot(car.x, car.y).toFixed(1)} m`;
}
for (const id of ids) {
  const r = [100, 150].map((v) => `${v}: ABS ${stop(id, v, true)} / locked ${stop(id, v, false)}`);
  console.log(id.padEnd(11), r.join('  |  '));
}
