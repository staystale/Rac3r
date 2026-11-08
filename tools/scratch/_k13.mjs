// _k13.mjs - K13 REALISM TABLE measurements, per car: 100-0 km/h on tarmac with ABS, locked
// (full pedal, ABS off) and the best constant pedal (threshold), at the car's own front brake
// share and at a realistic 0.65; steady lateral g at 60 and 150 km/h (aero shows at 150).
// node tools/scratch/_k13.mjs [cars,comma]
import { makeCar, step, reset, neutralInput, PHYSICS_STEP_SECONDS as DT } from '../../src/vehicle.ts';
import { CAR_IDS } from '../../src/cars.ts';
import { SURFACES } from '../../src/world/surfaces.ts';
const ids = process.argv[2] ? process.argv[2].split(',') : CAR_IDS;
const fresh = (id, surf, v, bias) => {
  const car = makeCar(id); reset(car, 0, 0, 0); car.surface = SURFACES[surf]; car.tcsOn = false;
  car.tyreT = [85, 85, 85, 85]; if (bias) car.spec.brakeBiasF = bias;
  if (v) { car.vx = v; car.gear = 3; car.rpm = 4000; }
  return car;
};
function stop(id, pedal, abs, bias) {
  const car = fresh(id, 'tarmac', 100 / 3.6, bias); car.absOn = abs;
  let t = 0;
  while (Math.hypot(car.vx, car.vy) > 0.3 && t < 15) {
    step(car, { ...neutralInput(), brake: pedal }, DT); t += DT;
  }
  return Math.hypot(car.x, car.y);
}
function best(id, bias) {
  let d = Infinity;
  for (let p = 0.3; p <= 1.001; p += 0.02) d = Math.min(d, stop(id, p, false, bias));
  return d;
}
function grip(id, v) {
  let g = 0;
  for (let st = 0.01; st <= 0.5; st += 0.01) {
    const car = fresh(id, 'tarmac', v); let ay = 0, n = 0, bad = false;
    car.gear = Math.min(car.spec.gears.length, v > 30 ? 4 : 2);
    for (let k = 0; k < 480; k++) {
      step(car, { ...neutralInput(), steer: st, throttle: car.t.vLong < v ? 0.6 : 0 }, DT);
      if (Math.abs(Math.atan2(car.t.vLat, Math.abs(car.t.vLong))) > 0.2) bad = true;
      if (k > 300) { ay += Math.abs(car.t.vLong * car.yawRate); n++; }
    }
    if (!bad && n) g = Math.max(g, ay / n / 9.81);
  }
  return g;
}
const f1 = (x) => x.toFixed(1).padStart(5);
console.log('car            biasF | ABS  lock  best | @0.65: ABS  lock  best | g60  g150');
for (const id of ids) {
  const b0 = makeCar(id).spec.brakeBiasF;
  const r = [stop(id, 1, true), stop(id, 1, false), best(id),
    stop(id, 1, true, 0.65), stop(id, 1, false, 0.65), best(id, 0.65)];
  console.log(`${id.padEnd(14)} ${b0.toFixed(2)} |${r.slice(0, 3).map(f1).join('')} |      `
    + `${r.slice(3).map(f1).join('')} | ${grip(id, 60 / 3.6).toFixed(2)} ${grip(id, 150 / 3.6).toFixed(2)}`);
}
