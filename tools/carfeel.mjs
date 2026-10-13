// carfeel.mjs — the numbers behind "feels slow / can't wheelspin or drift" (user, 2026-10-04, the Subaroo WRZ): per car
//  PULL: 40 -> 100 km/h flat out from 3rd (auto box) (low-rpm response: turbo lag shows here, not in 0-100)
//  SPIN: standing start, full throttle, 1st, on gravel and tarmac: peak driven-wheel slip (wheelspin)
//  POWER OVERSTEER: 40 km/h on gravel, half lock, then full throttle 2 s: peak REAR slip angle (deg) and yaw rate (deg/s) — can it be
//  steered on the throttle (drifted)?
// node tools/carfeel.mjs [cars]
import { makeCar, step, reset, DT } from '../src/vehicle.js';
if (process.env.CNEXT) { const C = await import('../src/cars.next.js'), C0 = await import('../src/cars.ts'); for (const r of C.ROSTER) { const o = C0.ROSTER.find((x) => x.id === r.id); if (o) Object.assign(o, r); } }
import { SURFACES } from '../src/lab.js';
const cars = (process.argv[2] || 'hatch-rwd,saloon-rwd,wrz-awd,rally-4x4').split(',');
const warm = (c) => { c.tyreT = [85, 85, 85, 85]; };
for (const id of cars) {
  // PULL
  let c = makeCar(id); reset(c, 0, 0, 0); warm(c); c.vx = 40 / 3.6; c.gear = 3; let t = 0;
  while (c.vx < 100 / 3.6) { c.surface = SURFACES.racetarmac; step(c, { steer: 0, throttle: 1, brake: 0, handbrake: 0 }, DT); t += DT; if (t > 30) break; }
  const pull = t;
  // SPIN
  const spin = {};
  for (const sid of ['gravel', 'racetarmac']) { c = makeCar(id); reset(c, 0, 0, 0); warm(c); let m = 0; for (let k = 0; k < 240; k++) { c.surface = SURFACES[sid]; step(c, { steer: 0, throttle: 1, brake: 0, handbrake: 0 }, DT); m = Math.max(m, Math.abs(c.t.spinR ? (c.t.slipRatioR || 1) : 0), c.t.spinR || c.t.spinF ? 1 : 0); } spin[sid] = m ? 'spins' : 'grips'; }
  // POWER OVERSTEER on gravel
  c = makeCar(id); reset(c, 0, 0, 0); warm(c); c.vx = 40 / 3.6; c.gear = 2; let sR = 0, yaw = 0, beta = 0;
  for (let k = 0; k < 120 * 3; k++) { c.surface = SURFACES.gravel; const thr = k > 60 ? 1 : 0.3; step(c, { steer: 0.5, throttle: thr, brake: 0, handbrake: 0 }, DT);
    if (k > 60) { sR = Math.max(sR, Math.abs(c.t.slipR || 0)); yaw = Math.max(yaw, Math.abs(c.yawRate)); beta = Math.max(beta, Math.abs(Math.atan2(c.t.vLat || 0, Math.abs(c.t.vLong || 1)))); } }
  console.log(`${id.padEnd(11)} 40-100 ${pull.toFixed(2)} s | wheelspin gravel ${spin.gravel}, tarmac ${spin.racetarmac} | gravel power-on: rear slip ${(sR * 57.3).toFixed(0)} deg, body slip ${(beta * 57.3).toFixed(0)} deg, yaw ${(yaw * 57.3).toFixed(0)} deg/s`);
}
