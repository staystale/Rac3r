// _roofflaps.mjs - ROOF FLAPS (physics/roofflaps.ts, ?roofflaps=1 / ROOFFLAPS=1): a Naffcar. 1: how
// far up the flaps stand after 0.3 s at 50 m/s for each angle between where it points and where
// it travels. 2: travelling backwards at 60 m/s, coasting 2 s on the game's physics - its speed
// with the flaps and without (run with ROOFFLAPS=1 and without). 3: flat out straight 5 s - the
// flaps never move.
// [ROOFFLAPS=1] node tools/scratch/_roofflaps.mjs
import { makeCar, step, reset, PHYSICS_STEP_SECONDS } from '../../src/vehicle.ts';
import { SURFACE_LAB } from '../../src/cars.ts';
import { roofFlapStep } from '../../src/physics/roofflaps.ts';

const DT = PHYSICS_STEP_SECONDS;
const coast = { steer: 0, throttle: 0, brake: 0, handbrake: 0 };
const flat = { steer: 0, throttle: 1, brake: 0, handbrake: 0 };

/** A Naffcar travelling along +x at speed, pointing `off` degrees off it. */
function naffcar(speed, off) {
  const car = makeCar('naffcar');
  reset(car, 0, 0, (off * Math.PI) / 180);
  car.vx = speed; car.vy = 0; car.surface = SURFACE_LAB;
  return car;
}

const sweep = [];
for (let off = 0; off <= 180; off += 20) {
  const car = naffcar(50, off);
  for (let t = 0; t < 0.3; t += DT) roofFlapStep(car, DT);
  sweep.push(`${off}: ${(car.flaps ?? 0).toFixed(2)}`);
}
console.log('flaps up after 0.3 s at 50 m/s by degrees off its way:', sweep.join('  '));

const back = naffcar(60, 180);
let most = 0;
for (let t = 0; t < 2; t += DT) {
  roofFlapStep(back, DT);
  step(back, coast, DT);
  most = Math.max(most, back.flaps ?? 0);
}
console.log('backwards at 216 km/h, coasting 2 s: now', (Math.hypot(back.vx, back.vy) * 3.6).toFixed(1),
  'km/h, flaps up to', most.toFixed(2));

const straight = naffcar(30, 0);
let opened = 0;
for (let t = 0; t < 5; t += DT) {
  step(straight, flat, DT);
  roofFlapStep(straight, DT);
  opened = Math.max(opened, straight.flaps ?? 0);
}
console.log('flat out straight 5 s: flaps up at most', opened.toFixed(2), 'at',
  (Math.hypot(straight.vx, straight.vy) * 3.6).toFixed(0), 'km/h');
