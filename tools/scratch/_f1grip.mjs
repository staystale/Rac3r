// _f1grip.mjs - a car's cornering grip by speed (owner 11-07: F1 "grip, downforce ect" realistic):
// at each speed, held there on dry race tarmac, the steering ramped slowly - the most lateral g
// it holds; the braking g from that speed (full brake, straight); the downforce share of weight.
// node tools/scratch/_f1grip.mjs [car]
import { makeCar, step, reset, PHYSICS_STEP_SECONDS as DT } from '../../src/vehicle.ts';
import { SURFACES } from '../../src/lab.ts';
const id = process.argv[2] || 'track-rwd';
const G = 9.81;
for (const kph of [80, 120, 160, 200, 250, 300]) {
  const v = kph / 3.6;
  let car = makeCar(id); reset(car, 0, 0, 0); car.tyreT = [90, 90, 90, 90]; car.vx = v; car.gear = 6;
  let best = 0;
  for (let k = 0; k < 120 * 8; k++) {
    car.surface = SURFACES.racetarmac;
    const sp = Math.hypot(car.vx, car.vy), steer = Math.min(1, k / (120 * 8)) * 0.6;
    step(car, { steer, throttle: sp < v ? 1 : 0.2, brake: 0, handbrake: 0 }, DT);
    const lat = Math.abs(sp * car.yawRate) / G;
    const slip = Math.abs(Math.atan2(car.t.vLat || 0, Math.abs(car.t.vLong || 1)));
    if (slip < 0.12 && Math.abs(sp - v) < 0.06 * v) best = Math.max(best, lat);
  }
  car = makeCar(id); reset(car, 0, 0, 0); car.tyreT = [90, 90, 90, 90]; car.vx = v; car.gear = 6;
  let brakeG = 0;
  for (let k = 0; k < 60; k++) {
    car.surface = SURFACES.racetarmac;
    const before = Math.hypot(car.vx, car.vy);
    step(car, { steer: 0, throttle: 0, brake: 1, handbrake: 0 }, DT);
    if (k > 10) brakeG = Math.max(brakeG, (before - Math.hypot(car.vx, car.vy)) / DT / G);
  }
  const s = car.spec, down = 0.5 * 1.225 * v * v * ((s.downforceF || 0) + (s.downforceR || 0)) * (s.aeroK ? 1 : 1);
  console.log(`${String(kph).padStart(3)} km/h: cornering ${best.toFixed(2)} g | braking ${brakeG.toFixed(2)} g | downforce (ClA sum) ${(down / (s.mass * G)).toFixed(2)} x weight`);
}
