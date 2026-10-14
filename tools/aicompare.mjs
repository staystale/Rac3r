// aicompare.mjs — where the racing AI loses / gains time against the bench driver: speed per 25 m of lap (2nd lap), side by side,
// with the surface mu there. node tools/aicompare.mjs <level> <car> [diff 0-4]
import { makeCar, step, reset, PHYSICS_STEP_SECONDS } from '../src/vehicle.ts';
import * as L from '../src/lab.js';
import { createAutoDriver } from '../src/ai/autodrive.ts';
import { createAIDriver } from '../src/ai/circuit.ts';
import { aiTraits } from '../src/ai/traits.ts';
const [lv = 'test-track', carId = 'hatch-rwd', d = '4'] = process.argv.slice(2);
const BIN = 25;
function run(mk) {
  L.setLevel(lv); L.clearWear(); const st = L.LEVEL.subtrack;
  const car = makeCar(carId); const p = L.onTrack(st, st.totalDist - 30, 0, {}); reset(car, p.x, p.y, p.rot);
  const drv = mk(); let t = 0, prev = null, laps = 0; const bins = {};
  while (t < 300 && laps < 2) {
    L.applyGround(car, PHYSICS_STEP_SECONDS); step(car, drv.drive(car, PHYSICS_STEP_SECONDS), PHYSICS_STEP_SECONDS); t += PHYSICS_STEP_SECONDS;
    const q = L.querySubtrack(st, car.x, car.y);
    if (prev !== null && prev > st.totalDist - 60 && q.trackDist < 60) laps++;
    if (laps === 1 && isFinite(q.dist)) { const b = Math.floor(q.trackDist / BIN); (bins[b] = bins[b] || { t: 0, v: 0, n: 0, mu: car.surface.mu, off: 0 }); bins[b].t += PHYSICS_STEP_SECONDS; bins[b].v += Math.hypot(car.vx, car.vy); bins[b].n++; bins[b].off = Math.max(bins[b].off, q.dist); }
    prev = q.trackDist;
  }
  return bins;
}
const A = run(() => createAutoDriver(L.LEVEL.subtrack)), B = run(() => createAIDriver(L.LEVEL, aiTraits(+d, 0, 1)));
const nb = Math.ceil(L.LEVEL.subtrack.totalDist / BIN); let ca = 0, cb = 0;
for (let b = 0; b < nb; b++) {
  const a = A[b] || { t: 0, v: 0, n: 1 }, c = B[b] || { t: 0, v: 0, n: 1 }; ca += a.t; cb += c.t;
  console.log(`${String(b * BIN).padStart(5)} m  bench ${(a.v / a.n).toFixed(1).padStart(5)} m/s  ai ${(c.v / c.n).toFixed(1).padStart(5)} m/s  dt ${(c.t - a.t).toFixed(2).padStart(6)}  cum ${(cb - ca).toFixed(1).padStart(6)}  mu ${c.mu}  off ${(c.off || 0).toFixed(1)}`);
}
