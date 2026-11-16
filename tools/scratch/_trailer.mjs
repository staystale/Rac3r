// _trailer.mjs - THE SCANYAH's TRAILER ON ITS PIN (physics/trailer.ts, ?scanyah), headless with the
// game's own steps: a pull from rest, a steady circle (the trailer's hitch angle against the
// textbook figure), braking in a bend without the trailer's brakes (the jack-knife when the
// tractor's rear axle locks alone), reversing straight (the fold, the hitch stop), crashes (the
// pin), and the largest gap at the pin in each run (it should stay under 1 cm). Nothing in the game
// is changed. node tools/scratch/_trailer.mjs  (SCANYAH=1)
import { makeCar, step, reset, PHYSICS_STEP_SECONDS as dt } from '../../src/vehicle.ts';
import { SURFACES } from '../../src/lab.ts';
import { attachTrailer, stepTrailer } from '../../src/physics/trailer.ts';

let worstGap = 0, ground = 'tarmac';
const hitchDeg = (car) => Math.abs(Math.atan2(Math.sin(car.trailer.heading - car.heading),
  Math.cos(car.trailer.heading - car.heading))) * 180 / Math.PI;
const gapCm = () => (worstGap * 100).toFixed(2);
/** A tractor and its trailer at rest. */
function rig() {
  const car = makeCar('scanyah-r450');
  reset(car, 0, 0, 0);
  attachTrailer(car);
  worstGap = 0;
  return car;
}
/** One step of both, the trailer's brakes on the pedal (or none). */
function both(car, input, trailerBrakes = true) {
  car.surface = SURFACES[ground];
  car.trailer.surface = SURFACES[ground];
  step(car, input, dt);
  stepTrailer(car, trailerBrakes ? input.brake : 0, dt);
  if (!car.trailer.pinFree) worstGap = Math.max(worstGap, car.trailer.pinGap || 0);
}
const drive = (steer, throttle, brake = 0, reverse = 0) => ({ steer, throttle, brake,
  handbrake: 0, reverse });
/** Flat out to a speed. */
function upTo(car, kph) {
  for (let time = 0; time < 120 && car.t.vLong < kph / 3.6; time += dt) both(car, drive(0, 1));
}

// 1. a pull from rest to 60 km/h
let car = rig(), time = 0;
for (; time < 120 && car.t.vLong < 60 / 3.6; time += dt) both(car, drive(0, 1));
console.log(`pull 0-60 km/h with the loaded trailer: ${time.toFixed(1)} s; the pin's gap at most `
  + `${gapCm()} cm`);
// 2. a steady circle at ~20 km/h
car = rig();
for (time = 0; time < 60; time += dt) both(car, drive(0.35, car.t.vLong < 20 / 3.6 ? 0.5 : 0));
const speed = Math.hypot(car.vx, car.vy), radius = speed / Math.max(1e-6, Math.abs(car.yawRate));
const rearR = Math.sqrt(Math.max(0, radius * radius - car.spec.lr ** 2));
const pinR = Math.hypot(rearR, 0.5), pinToAxle = car.trailer.spec.lf + car.trailer.spec.lr;
// (the textbook, no tyre slip: each axle on a circle square to its body, the pin 0.5 m ahead of
// the tractor's rear axle, the trailer's axle on the circle inside the pin's)
const axleR = Math.sqrt(Math.max(0, pinR * pinR - pinToAxle * pinToAxle));
const textbook = (Math.atan2(pinToAxle, axleR) - Math.atan2(0.5, rearR))
  * 180 / Math.PI;
console.log(`steady circle: ${(speed * 3.6).toFixed(1)} km/h, radius ${radius.toFixed(1)} m: the `
  + `hitch ${hitchDeg(car).toFixed(1)} deg (textbook ${textbook.toFixed(1)}); the trailer's axle on `
  + `a ${axleR.toFixed(1)} m circle, ${(rearR - axleR).toFixed(2)} m inside the tractor's rear axle; the pin's gap at most ${gapCm()} cm`);
// 3. braking in a bend at 60 km/h without the trailer's brakes
for (const [abs, brake, surf] of [[true, 0.45, 'tarmac'], [false, 0.45, 'tarmac'],
  [false, 1, 'tarmac'], [true, 0.3, 'wet'], [false, 0.3, 'wet']]) {
  ground = surf;
  car = rig();
  car.absOn = abs;
  upTo(car, 60);
  let worst = 0, rearAlone = 0;
  for (time = 0; time < 6; time += dt) {
    both(car, drive(0.15, 0, brake), false);
    worst = Math.max(worst, hitchDeg(car));
    if (car.t.lockedR && !car.t.lockedF) rearAlone += dt;
  }
  console.log(`braking in a bend on ${surf} at 60 km/h, pedal ${brake}, ABS ${abs ? 'on ' : 'off'},`
    + ` no trailer brakes: the rear locked alone ${rearAlone.toFixed(2)} s, the hitch at most `
    + `${worst.toFixed(1)} deg${worst > 60 ? ' - JACK-KNIFE' : ''}; the pin's gap at most `
    + `${gapCm()} cm`);
}
ground = 'tarmac';
// 4. reversing from a 1 deg kink (turned about the pin): hands off, and a driver who steers the
// tractor's front after the trailer's swing (steer = gain x the signed hitch angle)
const signedHitch = (car) => Math.atan2(Math.sin(car.trailer.heading - car.heading),
  Math.cos(car.trailer.heading - car.heading));
for (const gain of [0, 3, -3]) {
  car = rig();
  const pinX = car.trailer.x + Math.cos(car.trailer.heading) * car.trailer.spec.lf,
    pinY = car.trailer.y + Math.sin(car.trailer.heading) * car.trailer.spec.lf;
  car.trailer.heading += 0.02;
  car.trailer.x = pinX - Math.cos(car.trailer.heading) * car.trailer.spec.lf;
  car.trailer.y = pinY - Math.sin(car.trailer.heading) * car.trailer.spec.lf;
  let worst = 0;
  const x0 = car.x, y0 = car.y;
  for (time = 0; time < 20; time += dt) {
    const steer = Math.max(-1, Math.min(1, gain * signedHitch(car)));
    both(car, drive(steer, 0, 0, 0.6));
    worst = Math.max(worst, hitchDeg(car));
  }
  console.log(`reversing 20 s from a 1 deg kink, steer = ${gain} x the hitch angle: `
    + `${Math.hypot(car.x - x0, car.y - y0).toFixed(0)} m back, the hitch at most `
    + `${worst.toFixed(1)} deg, the pin ${car.trailer.pinFree ? 'BROKE' : 'held'}; its gap at `
    + `most ${gapCm()} cm`);
}
// 5. crashes: a stop spread over 0.15 s at 60, and a dead stop in one step (the barrier clamp)
car = rig();
upTo(car, 60);
for (let i = 0; i < 18; i++) {
  car.vx *= 0.82; car.vy *= 0.82;
  both(car, drive(0, 0));
}
console.log(`a 60 km/h crash spread over 0.15 s: the pin ${car.trailer.pinFree ? 'BROKE' : 'held'}`);
for (const kph of [20, 40, 50, 60]) {
  car = rig();
  upTo(car, kph);
  car.vx = 0; car.vy = 0;
  both(car, drive(0, 0));
  console.log(`a ${kph} km/h dead stop in one step: the pin ${car.trailer.pinFree ? 'BROKE' : 'held'}`);
}
// 6. a reset after a broken pin: the trailer back in line on a whole pin
reset(car, 50, 20, 1);
both(car, drive(0, 0));
console.log(`after a reset: the pin ${car.trailer.pinFree ? 'still BROKEN' : 'whole'}, the hitch `
  + `${hitchDeg(car).toFixed(1)} deg, the gap ${(car.trailer.pinGap * 100).toFixed(2)} cm`);
