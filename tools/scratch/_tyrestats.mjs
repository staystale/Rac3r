// _tyrestats.mjs - a car's garage numbers on each tyre (carstats.mjs's benches): 0-100, top,
// 100-0, grip g. MUSCLETYRES=1 node tools/scratch/_tyrestats.mjs [car] [tyre,tyre]
import { makeCar, step, reset, PHYSICS_STEP_SECONDS as DT } from '../../src/vehicle.ts';
import { applyTyre } from '../../src/cars.ts';
import { SURFACES } from '../../src/lab.ts';
const id = process.argv[2] || 'muscle-rwd';
const tyres = (process.argv[3] || 'pre-spun,polyglass,radial-ta,et-street').split(',');
const fresh = (tyre) => { const c = makeCar(id); applyTyre(c.spec, tyre); reset(c, 0, 0, 0); c.tyreT = [85, 85, 85, 85]; return c; };
for (const tyre of tyres) {
  let c = fresh(tyre), t = 0, t100 = null, vmax = 0;
  for (; t < 60; t += DT) { c.surface = SURFACES.racetarmac; step(c, { steer: 0, throttle: 1, brake: 0, handbrake: 0 }, DT);
    vmax = Math.max(vmax, c.t.vLong); if (t100 === null && c.t.vLong >= 27.78) t100 = t; }
  c = fresh(tyre); c.vx = 27.78; c.gear = 3; let d = 0;
  for (let k = 0; k < 1200 && (c.t.vLong > 0.3 || k < 10); k++) { c.surface = SURFACES.tarmac;
    step(c, { steer: 0, throttle: 0, brake: 1, handbrake: 0 }, DT); d += Math.max(0, c.t.vLong) * DT; }
  let g = 0;
  for (let st = 0.02; st <= 0.5; st += 0.02) {
    c = fresh(tyre); c.vx = 16.7; c.gear = 2; let ay = 0, n = 0, bad = false;
    for (let k = 0; k < 480; k++) { c.surface = SURFACES.tarmac; step(c, { steer: st, throttle: c.t.vLong < 16.7 ? 0.5 : 0, brake: 0, handbrake: 0 }, DT);
      if (Math.abs(Math.atan2(c.t.vLat, Math.abs(c.t.vLong))) > 0.2) bad = true; if (k > 300) { ay += Math.abs(c.t.vLong * c.yawRate); n++; } }
    if (!bad) g = Math.max(g, ay / n / 9.81);
  }
  console.log(`${id} ${tyre.padEnd(10)} fitted ${(c.spec.tyre && c.spec.tyre.id) || 'stock (pre-spun)'}: 0-100 ${t100?.toFixed(1)} s, top ${Math.round(vmax * 3.6)} km/h, 100-0 ${d.toFixed(1)} m, grip ${g.toFixed(2)} g`);
}
