// _frontdump.mjs - per-step dump of one stop from speed: CAR=id BRAKE=0..1 V=m/s AIDS=0/1
import { makeCar, step, reset, setAidsDefault, neutralInput, PHYSICS_STEP_SECONDS as DT }
  from '../../src/vehicle.ts';
import { SURFACES } from '../../src/lab.ts';
setAidsDefault(process.env.AIDS === '1');
const car = makeCar(process.env.CAR || 'track-rwd');
reset(car, 0, 0, 0); car.surface = SURFACES.tarmac;
const brake = Number(process.env.BRAKE || 1), target = Number(process.env.V || 60);
while (Math.hypot(car.vx, car.vy) < target) { car.surface = SURFACES.tarmac; step(car, { ...neutralInput(), throttle: 1 }, DT); }
console.log('after accel: tyres', car.tyreT.map((t) => t.toFixed(0)).join(' '));
let i = 0;
while (Math.hypot(car.vx, car.vy) > 0.5 && i < 4000) {
  car.surface = SURFACES.tarmac; step(car, { ...neutralInput(), brake }, DT);
  if (i++ % 30 === 0) { const t = car.t;
    console.log(`v ${Math.hypot(car.vx, car.vy).toFixed(1)} FzF ${t.FzF.toFixed(0)} FxF ${t.FxF.toFixed(0)} FxR ${t.FxR.toFixed(0)} lockF ${t.lockedF} slideF ${t.slidingF} F ${car.tyreT[0].toFixed(1)} R ${car.tyreT[2].toFixed(1)}`); }
}
console.log(`stop ${(i * DT).toFixed(2)} s, fronts ${car.tyreT[0].toFixed(1)} rears ${car.tyreT[2].toFixed(1)}`);
