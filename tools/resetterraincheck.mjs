// resetterraincheck.mjs — RESET on high ground must not launch the car (user, 2026-10-04: "resetting on terrain causes the car to get stuck
// when pulling away"). Before the fix a reset 7.5 m up Sweaty Lamb flew the car 106 m up. Pass: < 0.1 s airborne, > 30 km/h after 3 s.
// node tools/resetterraincheck.mjs
let fails = 0;
import { makeCar, step, reset, PHYSICS_STEP_SECONDS } from '../src/vehicle.ts';
import * as L from '../src/lab.js';
for (const [lv, d] of [['sweaty-lamb', 900], ['sweaty-lamb', 100], ['slidden-hill', 742], ['castle-cum', 296], ['thruston', 600]]) {
  L.setLevel(lv); const st = L.LEVEL.subtrack, p = L.onTrack(st, d, 0, {});
  const car = makeCar('hatch-rwd'); reset(car, p.x, p.y, p.rot);
  const h = L.heightAt(p.x, p.y); let maxVz = 0, airT = 0;
  for (let i = 0; i < 360; i++) { L.applyGround(car, PHYSICS_STEP_SECONDS); step(car, { steer: 0, throttle: 1, brake: 0, handbrake: 0, reverse: 0 }, PHYSICS_STEP_SECONDS); maxVz = Math.max(maxVz, Math.abs(car.zvF || 0)); if (car.air > 0) airT += PHYSICS_STEP_SECONDS; }
  const ok = airT < 0.1 && Math.hypot(car.vx, car.vy) * 3.6 > 30; if (!ok) fails++;
  console.log(ok ? 'OK  ' : 'FAIL', lv.padEnd(12), 'd', d, 'ground h', h.toFixed(2), 'm | speed after 3 s', (Math.hypot(car.vx, car.vy) * 3.6).toFixed(0), 'km/h | max |zvF|', maxVz.toFixed(1), '| airborne', airT.toFixed(2), 's | z', car.zF.toFixed(2));
}
console.log(fails ? 'FAILED: ' + fails : 'reset on terrain: all OK');
