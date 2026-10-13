// tyregrip.mjs — what each TYRE (cars.js TYRES) really does: steady cornering grip (the surfacegrip / carstats method — steer swept at
// 60 km/h, best steady lateral g with body slip under BETA) on all 9 tyre surfaces (cars.js TYRE_SURFS), vs the stock car (no tyre object), and
// how hot the tyres get in 30 s of hard tarmac cornering (heatHard). Also proves Pre-Spun == stock (the floor, user 2026-10-04).
// node tools/tyregrip.mjs [car] [tyre,tyre,...]
import { makeCar, step, reset, DT } from '../src/vehicle.js';
import { SURFACES } from '../src/lab.js';
import { TYRES, applyTyre } from '../src/cars.ts';
const car = process.argv[2] || 'hatch-rwd', BETA = 0.2;
const list = process.argv[3] ? process.argv[3].split(',') : TYRES.map((t) => t.id);
const surfs = ['tarmac', 'wet', 'gravel', 'dirt', 'grass', 'mud', 'sand', 'snow', 'ice'];
const mk = (tyre) => { const c = makeCar(car); if (tyre !== 'stock') applyTyre(c.spec, tyre); return c; };
function grip(tyre, S, v0 = 16.7) {
  let g = 0;
  for (let st = 0.02; st <= 0.6; st += 0.02) {
    const c = mk(tyre); reset(c, 0, 0, 0); const o = c.spec.tyreOpt || [65, 110]; c.tyreT = Array(4).fill((o[0] + o[1]) / 2); c.vx = v0; c.gear = 2; let ay = 0, n = 0, bad = false;
    for (let k = 0; k < 480; k++) { c.surface = S; step(c, { steer: st, throttle: c.t.vLong < v0 ? 0.5 : 0, brake: 0, handbrake: 0 }, DT);
      if (Math.abs(Math.atan2(c.t.vLat, Math.abs(c.t.vLong))) > BETA) bad = true; if (k > 300) { ay += Math.abs(c.t.vLong * c.yawRate); n++; } }
    if (!bad) g = Math.max(g, ay / n / 9.81);
  }
  return g;
}
function heat(tyre) {
  // 30 s at 70 km/h on tarmac with the wheel at 0.25 and the throttle holding speed (a hard, slightly sliding corner)
  const c = mk(tyre); reset(c, 0, 0, 0); c.vx = 19.4; c.gear = 3;
  for (let k = 0; k < 30 / DT; k++) { c.surface = SURFACES.tarmac; step(c, { steer: 0.25, throttle: c.t.vLong < 19.4 ? 0.9 : 0.2, brake: 0, handbrake: 0 }, DT); }
  return Math.max(...c.tyreT);
}
const base = {}; for (const k of surfs) base[k] = grip('stock', SURFACES[k]);
console.log(car, 'STOCK  ', surfs.map((k) => `${k} ${base[k].toFixed(3)}g`).join(' | '), `| heat30s ${heat('stock').toFixed(0)}C`);
for (const t of list) {
  const row = surfs.map((k) => { const g = grip(t, SURFACES[k]); return `${k} ${g.toFixed(3)}g (${g >= base[k] ? '+' : ''}${((g / base[k] - 1) * 100).toFixed(0)}%)`; });
  console.log(t.padEnd(13), row.join(' | '), `| heat30s ${heat(t).toFixed(0)}C`);
}
