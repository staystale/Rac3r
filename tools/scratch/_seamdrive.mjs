// _seamdrive.mjs - K3: does a lone AI slow at the lap seam (the racing line's kink at index 0)?
// One AI, 3 laps, node; its speed and target per 10 m of track from -60 to +60 m round the line.
// node tools/scratch/_seamdrive.mjs [level] [car] [diff]
import { makeCar, step, reset, PHYSICS_STEP_SECONDS as DT } from '../../src/vehicle.ts';
import * as L from '../../src/lab.js';
import { createAIDriver } from '../../src/ai/circuit.ts';
import { aiTraits } from '../../src/ai/traits.ts';
import { racingLine } from '../../src/ai/line.ts';
const [lv = 'killder', carId = 'hatch-rwd', d = '4'] = process.argv.slice(2);
L.setLevel(lv); L.clearWear();
const st = L.LEVEL.subtrack, ln = racingLine(L.LEVEL), car = makeCar(carId), p0 = ln.pts[Math.round(ln.n / 2)];
reset(car, p0.x, p0.y, p0.h);
const drv = createAIDriver(L.LEVEL, aiTraits(+d, 0, 1, 3));
const bins = {}; let t = 0;
while (t < 200) {
  L.barrierClamp(car); L.solidClamp(car); L.applyGround(car, DT);
  step(car, drv.drive(car, DT, { cars: [], lap: 2, laps: 9 }), DT); t += DT;
  if (t < 10) continue;
  let dist = L.querySubtrack(st, car.x, car.y).trackDist; if (dist > st.totalDist / 2) dist -= st.totalDist;
  if (Math.abs(dist) > 60) continue;
  const k = Math.floor(dist / 10) * 10, b = bins[k] || (bins[k] = { n: 0, v: 0, vT: 0, steer: 0 });
  b.n++; b.v += Math.hypot(car.vx, car.vy); b.vT += Math.min(drv.state.vT, 95); b.steer += Math.abs(car.steer || 0);
}
console.log(lv, carId, 'diff', d);
for (const k of Object.keys(bins).map(Number).sort((a, b) => a - b)) {
  const b = bins[k]; console.log(`  ${String(k).padStart(4)}..${k + 10} m: v ${(b.v / b.n).toFixed(1)} target ${(b.vT / b.n).toFixed(1)} |steer| ${(b.steer / b.n).toFixed(3)}`);
}
