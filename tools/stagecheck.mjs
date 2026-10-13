// stagecheck.mjs — STAGE TIME per car on a point-to-point level (LEVEL.stage): the autodriver from the spawn, start line -> finish.
// node tools/stagecheck.mjs [level]. Built 2026-10-04 for Sweaty Lamb (user: "~1 minute").
import { makeCar, step, reset, DT } from '../src/vehicle.js';
import * as L from '../src/lab.js';
import { createAutoDriver } from '../src/ai/autodrive.ts';
import { CAR_IDS } from '../src/cars.ts';
const lv = process.argv[2] || 'sweaty-lamb';
L.setLevel(lv);
const st = L.LEVEL.subtrack, F = L.LEVEL.stage.finish, hw = st.width / 2;
for (const id of CAR_IDS) {
  const car = makeCar(id); reset(car, L.LEVEL.spawn.x, L.LEVEL.spawn.y, L.LEVEL.spawn.heading);
  const drv = createAutoDriver(st); let t = 0, t0 = null, t1 = null, prev = null, off = 0, air = 0, vmax = 0;
  while (t < 300 && t1 === null) {
    L.applyGround(car, DT); step(car, drv.drive(car), DT); t += DT;
    const q = L.querySubtrack(st, car.x, car.y), d = q.trackDist;
    if (prev !== null) { if (t0 === null && prev > st.totalDist - 60 && d < 60) t0 = t; else if (t0 !== null && prev < F && d >= F && d - prev < 30) t1 = t; }
    if (t0 !== null) { if (q.dist > hw) off += DT; if (car.air > 0) air += DT; vmax = Math.max(vmax, Math.hypot(car.vx, car.vy) * 3.6); }
    prev = d;
  }
  console.log(id.padEnd(11), t1 ? `STAGE ${(t1 - t0).toFixed(1)} s` : 'DID NOT FINISH', `| top ${vmax.toFixed(0)} km/h | off the road ${off.toFixed(1)} s | airborne ${air.toFixed(2)} s`);
}
