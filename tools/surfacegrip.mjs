// surfacegrip.mjs — REAL steady cornering grip of each car on each surface (the carstats method — steer swept at 60 km/h, best steady
// lateral g with the body slip under BETA — run on every surface), against what the racing AI ASSUMES: gripG(tarmac) x mu(surface) /
// mu(reference). User (2026-10-04): "AI still slow down on transition change, and drive slow on slippy surfaces".
// node tools/surfacegrip.mjs [cars] [beta rad]
import { makeCar, step, reset, PHYSICS_STEP_SECONDS } from '../src/vehicle.ts';
import { SURFACES } from '../src/lab.js';
const cars = (process.argv[2] || 'hatch-rwd,rally-4x4,track-rwd').split(','), BETA = +(process.argv[3] || 0.2);
const surfs = ['racetarmac', 'tarmac', 'concrete', 'wet', 'gravel', 'dirt', 'sand', 'mud', 'grass', 'snow'];
function grip(id, S, v0 = 16.7) {
  let g = 0;
  for (let st = 0.02; st <= 0.6; st += 0.02) {
    const c = makeCar(id); reset(c, 0, 0, 0); c.tyreT = [85, 85, 85, 85]; c.vx = v0; c.gear = 2; let ay = 0, n = 0, bad = false;
    for (let k = 0; k < 480; k++) { c.surface = S; step(c, { steer: st, throttle: c.t.vLong < v0 ? 0.5 : 0, brake: 0, handbrake: 0 }, PHYSICS_STEP_SECONDS);
      if (Math.abs(Math.atan2(c.t.vLat, Math.abs(c.t.vLong))) > BETA) bad = true; if (k > 300) { ay += Math.abs(c.t.vLong * c.yawRate); n++; } }
    if (!bad) g = Math.max(g, ay / n / 9.81);
  }
  return g;
}
for (const id of cars) {
  const gT = grip(id, SURFACES.tarmac), row = [];
  for (const k of surfs) { const S = SURFACES[k], g = k === 'tarmac' ? gT : grip(id, S), assumed = gT * S.mu / SURFACES.tarmac.mu; row.push(`${k} ${g.toFixed(2)}g (x${(g / assumed).toFixed(2)})`); }
  console.log(id.padEnd(10), row.join(' | '));
}
console.log('(xN = real / assumed: > 1 means the AI plans SLOWER than the car can go there)');
