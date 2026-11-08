// _heatprobe.mjs - tyre heat: muscle burnout s to 115 C; hatch 30 s hard circle (front / rear C);
// muscle 20 s power drift; HEATEASE=1 for the switch.
import { makeCar, step, reset, neutralInput, PHYSICS_STEP_SECONDS as DT } from '../../src/vehicle.ts';
import { SURFACES } from '../../src/world/surfaces.ts';
const fresh = (id, v) => { const c = makeCar(id); reset(c, 0, 0, 0); c.surface = SURFACES.tarmac; c.tcsOn = false;
  if (v) { c.vx = v; c.gear = 2; c.rpm = 4000; } return c; };
const avg = (a, b) => ((a + b) / 2).toFixed(0);
let car = fresh('muscle-rwd'), t = 0, smoke = null;
while (t < 15) { step(car, { ...neutralInput(), throttle: 1, brake: 1 }, DT); t += DT;
  if (smoke === null && Math.max(car.tyreT[2], car.tyreT[3]) >= 115) smoke = t; }
console.log(`burnout: 115 C after ${smoke?.toFixed(1)} s, 15 s rears ${avg(car.tyreT[2], car.tyreT[3])} C`);
for (const [id, steer, thr] of [['hatch-fwd', 0.35, 0.55], ['hatch-rwd', 0.35, 0.55]]) {
  car = fresh(id, 16); t = 0;
  while (t < 30) { step(car, { ...neutralInput(), throttle: thr, steer }, DT); t += DT; }
  console.log(`${id} 30 s circle: fronts ${avg(car.tyreT[0], car.tyreT[1])} C rears ${avg(car.tyreT[2], car.tyreT[3])} C, ${(Math.hypot(car.vx, car.vy) * 3.6).toFixed(0)} km/h`);
}
car = fresh('muscle-rwd', 14); t = 0;
while (t < 20) { const beta = Math.atan2(car.t.vLat, car.t.vLong);
  step(car, { ...neutralInput(), throttle: 0.8, steer: Math.max(-1, Math.min(1, 0.4 + 1.5 * beta)) }, DT); t += DT; }
console.log(`muscle 20 s power drift: rears ${avg(car.tyreT[2], car.tyreT[3])} C`);
car = fresh('hatch-fwd'); t = 0;
for (let i = 0; i < 3; i++) { car.vx = 100 / 3.6; car.vy = 0; car.absOn = false;
  while (Math.hypot(car.vx, car.vy) > 0.3) step(car, { ...neutralInput(), brake: 1 }, DT); }
console.log(`hatch 3 locked stops from 100: fronts ${avg(car.tyreT[0], car.tyreT[1])} C rears ${avg(car.tyreT[2], car.tyreT[3])} C`);
