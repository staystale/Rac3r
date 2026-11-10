// _crestmap.mjs - WHERE A VENUE'S CRESTS ARE AND HOW FAST THEY LAUNCH A CAR (Bathworst's mountain,
// 11-10): the ground along the lap's centreline (world/terrain.ts heightAt) every 2 m, its grade and
// its vertical radius over a 20 m chord; each crest sharper than RADIUS m with the speed at which a
// car's weight is gone there (v^2 / R = g), against the speed the careful driver and a flat-out
// driver (full throttle through it, on the careful line) carry over it, and the airtime each had.
// [BATHURST=1] node tools/scratch/_crestmap.mjs <level> [car] [radius m, 400]
import { makeCar, step, reset, PHYSICS_STEP_SECONDS } from '../../src/vehicle.ts';
import * as L from '../../src/lab.ts';
import { heightAt } from '../../src/world/terrain.ts';
import { createAutoDriver } from '../../src/ai/autodrive.ts';

const [lv = 'bathurst', carId = 'hatch-rwd', radiusArg = '400'] = process.argv.slice(2);
const RADIUS = +radiusArg, G = 9.81, STEP = 2, CHORD = 10;
L.setLevel(lv);
const sub = L.LEVEL.subtrack, total = sub.totalDist;
const at = (d) => L.onTrack(sub, ((d % total) + total) % total, 0, {});
const z = [];
for (let d = 0; d < total; d += STEP) { const p = at(d); z.push(heightAt(p.x, p.y)); }
const n = z.length, k = CHORD / STEP;
const zAt = (i) => z[((i % n) + n) % n];
const crests = [];
for (let i = 0; i < n; i++) {
  const g1 = (zAt(i) - zAt(i - k)) / CHORD, g2 = (zAt(i + k) - zAt(i)) / CHORD;
  const curv = (g2 - g1) / CHORD;   // 1 / R; negative over a crest
  if (curv < 0 && -1 / curv < RADIUS) crests.push({ d: i * STEP, r: -1 / curv, grade: (g1 + g2) / 2 });
}
// one row per crest (the sharpest sample of each run)
const runs = [];
for (const c of crests) {
  const last = runs.at(-1);
  if (last && c.d - last.end <= 6) { last.end = c.d; if (c.r < last.best.r) last.best = c; } else runs.push({ start: c.d, end: c.d, best: c });
}
// the careful driver's and the flat-out driver's speed and airtime over each crest (one lap each)
function drive(flat) {
  const car = makeCar(carId), drv = createAutoDriver(sub);
  reset(car, L.LEVEL.spawn.x, L.LEVEL.spawn.y, L.LEVEL.spawn.heading);
  const out = runs.map(() => ({ v: 0, air: 0, load: 9 }));
  let t = 0;
  while (drv.state.travelled < total && t < 400) {
    const d = L.querySubtrack(sub, car.x, car.y).trackDist, inp = drv.drive(car);
    const near = runs.findIndex((r) => d >= r.start - 40 && d <= r.end + 20);
    if (flat && near >= 0) { inp.throttle = 1; inp.brake = 0; }
    L.applyGround(car, PHYSICS_STEP_SECONDS); step(car, inp, PHYSICS_STEP_SECONDS); t += PHYSICS_STEP_SECONDS;
    const on = runs.findIndex((r) => d >= r.start - 4 && d <= r.end + 10);
    if (on >= 0) {
      const r = out[on];
      r.v = Math.max(r.v, Math.hypot(car.vx, car.vy));
      r.load = Math.min(r.load, car.loadK);
      if (car.air > 0) r.air += PHYSICS_STEP_SECONDS;
    }
  }
  return out;
}
const careful = drive(false), flat = drive(true);
const zs = z.slice();
console.log(`${lv}: ground ${Math.min(...zs).toFixed(1)} .. ${Math.max(...zs).toFixed(1)} m (game), ${runs.length} crests sharper than ${RADIUS} m; ${carId}`);
runs.forEach((r, i) => {
  const lift = Math.sqrt(G * r.best.r) * 3.6;
  console.log(`  ${r.start}-${r.end} m: radius ${r.best.r.toFixed(0)} m, grade ${(r.best.grade * 100).toFixed(1)} %, weightless at ${lift.toFixed(0)} km/h`
    + ` | careful ${(careful[i].v * 3.6).toFixed(0)} km/h load ${careful[i].load.toFixed(2)} air ${careful[i].air.toFixed(2)} s`
    + ` | flat ${(flat[i].v * 3.6).toFixed(0)} km/h load ${flat[i].load.toFixed(2)} air ${flat[i].air.toFixed(2)} s`);
});
