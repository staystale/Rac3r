// _rimspread.mjs - where flat tyres reach the rim (physics/tyrepressure.ts, the Weibull run):
// 2000 flat tyres at 30 m/s straight, 120 Hz; the metres at which each went to the rim.
import { pressureInit, stepTyrePressure } from '../../src/physics/tyrepressure.ts';
const at = [];
for (let n = 0; n < 2000; n++) {
  const car = { vx: 30, vy: 0, yawRate: 0 };
  pressureInit(car);
  car.tyreP[1] = 0;
  while (!car.onRim[1] && car.flatRun[1] < 5000) stepTyrePressure(car, 1 / 120);
  at.push(car.flatRun[1]);
}
at.sort((a, b) => a - b);
const q = (f) => Math.round(at[Math.floor(f * (at.length - 1))]);
console.log(`rim after m flat: 10 % ${q(0.1)}, 25 % ${q(0.25)}, half ${q(0.5)}, 75 % ${q(0.75)},`
  + ` 90 % ${q(0.9)}, first ${q(0)}, last ${q(1)}`);
