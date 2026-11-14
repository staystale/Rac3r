// _hbheat.mjs - handbrake turn and straight handbrake pull: tyre rise front / rear, every car
import { makeCar, step, reset, setAidsDefault, neutralInput, PHYSICS_STEP_SECONDS as DT }
  from '../../src/vehicle.ts';
import { CAR_IDS } from '../../src/cars.ts';
import { SURFACES } from '../../src/lab.ts';
setAidsDefault(false);
const out = [];
for (const id of CAR_IDS) {
  const row = [id.padEnd(14)];
  for (const steer of [0.3, 0]) {
    const car = makeCar(id); reset(car, 0, 0, 0); car.surface = SURFACES.tarmac; car.vx = 15;
    for (let t = 0; t < 1.5; t += DT) { car.surface = SURFACES.tarmac;
      step(car, { ...neutralInput(), steer, handbrake: 1 }, DT); }
    row.push(`${((car.tyreT[0] + car.tyreT[1]) / 2 - 18).toFixed(2)}/${((car.tyreT[2] + car.tyreT[3]) / 2 - 18).toFixed(2)}`);
  }
  out.push(row.join(' '));
}
console.log(out.join('\n'));
