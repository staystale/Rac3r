// _brakebase.mjs - ROOT FIX baseline: braking from 100 km/h on tarmac, per car. Stop distance
// with full pedal ABS on / off, the best constant pedal with ABS off (threshold braking), and with
// half lock held from the start of a full ABS stop: how far the car moved sideways (steering kept?)
// and its heading change. node tools/scratch/_brakebase.mjs [cars,comma] [surface]
import { makeCar, step, reset, neutralInput, PHYSICS_STEP_SECONDS as DT } from '../../src/vehicle.ts';
import { CAR_IDS } from '../../src/cars.ts';
import { SURFACES } from '../../src/world/surfaces.ts';
const ids = process.argv[2] ? process.argv[2].split(',') : CAR_IDS;
const surf = SURFACES[process.argv[3] || 'tarmac'];
function stop(id, pedal, abs, steer = 0) {
  const car = makeCar(id); reset(car, 0, 0, 0); car.surface = surf; car.absOn = abs; car.tcsOn = false;
  car.vx = 100 / 3.6; car.vy = 0;
  for (let i = 0; i < 60; i++) step(car, { ...neutralInput(), throttle: 0 }, DT);
  car.vx = 100 / 3.6; car.vy = 0; car.x = 0; car.y = 0; car.heading = 0; car.yawRate = 0;
  let t = 0, locked = 0, absT = 0;
  while (Math.hypot(car.vx, car.vy) > 0.3 && t < 15) {
    step(car, { ...neutralInput(), brake: pedal, steer }, DT); t += DT;
    if (car.t.lockedF || car.t.lockedR) locked += DT;
    if (car.t.absWorking) absT += DT;
  }
  return { d: Math.hypot(car.x, car.y), x: car.x, y: car.y, t, locked, absT, h: car.heading * 180 / Math.PI };
}
console.log('surface', surf.id);
for (const id of ids) {
  const on = stop(id, 1, true), off = stop(id, 1, false);
  let best = { d: Infinity };
  for (let p = 0.3; p <= 1.001; p += 0.05) { const r = stop(id, p, false); if (r.d < best.d) best = { ...r, p }; }
  const steerOn = stop(id, 1, true, 0.5), steerOff = stop(id, 1, false, 0.5);
  console.log(`${id.padEnd(14)} ABS ${on.d.toFixed(1)} m (abs ${on.absT.toFixed(1)} s, locked ${on.locked.toFixed(1)}) | no ABS full ${off.d.toFixed(1)} m (locked ${off.locked.toFixed(1)} s) | best pedal ${best.p.toFixed(2)} ${best.d.toFixed(1)} m | half lock: ABS side ${steerOn.y.toFixed(1)} m turn ${steerOn.h.toFixed(0)} deg, no ABS side ${steerOff.y.toFixed(1)} m turn ${steerOff.h.toFixed(0)} deg`);
}
