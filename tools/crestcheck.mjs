// crestcheck.mjs — how LIGHT does each car go over a crest on an autodrive lap? Reports, per window of track distance, the speed
// there, the lowest load factor (1 = normal, 0 = wheels off the ground) and seconds airborne. Built 2026-10-04 for Castle Cum's
// Avon Rise (user: "felt — light over the top", not flying). node tools/crestcheck.mjs [level] [d0-d1,...]
import { makeCar, step, reset, DT } from '../src/vehicle.js';
import * as L from '../src/lab.js';
import { createAutoDriver } from '../src/ai/autodrive.ts';
import { CAR_IDS } from '../src/cars.js';
const lv = process.argv[2] || 'castle-cum';
const wins = (process.argv[3] || '270-330,815-905').split(',').map((w) => w.split('-').map(Number));
const FLAT = process.argv.includes('--flat');   // FLAT OUT from 120 m before each window (a keen player arrives faster than the careful driver)
L.setLevel(lv);
const st = L.LEVEL.subtrack;
for (const id of CAR_IDS) {
  const car = makeCar(id); reset(car, L.LEVEL.spawn.x, L.LEVEL.spawn.y, L.LEVEL.spawn.heading);
  const drv = createAutoDriver(st), res = wins.map(() => ({ v: 0, minLoad: 9, air: 0 }));
  let t = 0;
  while (drv.state.travelled < st.totalDist && t < 300) {
    const d = L.querySubtrack(st, car.x, car.y).trackDist;
    const inp = drv.drive(car); if (FLAT && wins.some(([a, b]) => d >= a - 120 && d <= b)) { inp.throttle = 1; inp.brake = 0; }
    L.applyGround(car, DT); step(car, inp, DT); t += DT;
    wins.forEach(([a, b], k) => { if (d >= a && d <= b) { const r = res[k]; r.v = Math.max(r.v, Math.hypot(car.vx, car.vy) * 3.6); r.minLoad = Math.min(r.minLoad, car.loadK); if (car.air > 0) r.air += DT; } });
  }
  console.log(id.padEnd(11), res.map((r, k) => `${wins[k].join('-')} m: ${r.v.toFixed(0)} km/h, lowest load ${r.minLoad.toFixed(2)}, air ${r.air.toFixed(2)} s`).join(' | '));
}
