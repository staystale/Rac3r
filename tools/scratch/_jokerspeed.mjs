// _jokerspeed.mjs - the autodriver's speed along a rallycross level's joker (scratch): laps the
// lap with the joker lane swapped in (as tools/jokercost.mjs) and prints the car's speed, airtime
// and height every 10 m of the joker lane, and on the lap's own way between the same points.
// node tools/scratch/_jokerspeed.mjs [level] [car]
import { makeCar, step, reset, PHYSICS_STEP_SECONDS } from '../../src/vehicle.ts';
import * as L from '../../src/lab.ts';
import { createAutoDriver } from '../../src/ai/autodrive.ts';
import { jokerLane } from '../../src/world/joker.ts';
const [lv = 'xgayms', carId = 'rally-4x4'] = process.argv.slice(2);
L.setLevel(lv);
const st = L.LEVEL.subtrack, J = jokerLane(L.LEVEL).pts;
const dOf = ([x, y]) => L.querySubtrack(st, x, y).trackDist;
const d0 = dOf(J[0]), d1 = dOf(J[J.length - 1]);
const pts = st.pts.filter((p) => p.dist < d0).map((p) => [p.x, p.y]).concat(J.slice(1, -1),
  st.pts.filter((p) => p.dist > d1).map((p) => [p.x, p.y]));
const stJ = L.createSubtrack(pts, st.width, [], [], true);
for (const [name, sub, from, until] of [['joker', stJ, d0, d0 + (stJ.totalDist - st.totalDist) + (d1 - d0)], ['lap', st, d0, d1]]) {
  const car = makeCar(carId), p0 = sub.pts[Math.floor(sub.pts.length * 0.3)];
  reset(car, p0.x, p0.y, p0.heading);
  const drv = createAutoDriver(sub);
  let t = 0, next = from, row = [], enter = null;
  while (t < 200 && drv.state.travelled < sub.totalDist * 1.2) {
    L.applyGround(car, PHYSICS_STEP_SECONDS); step(car, drv.drive(car), PHYSICS_STEP_SECONDS); t += PHYSICS_STEP_SECONDS;
    const d = L.querySubtrack(sub, car.x, car.y).trackDist;
    if (drv.state.travelled < sub.totalDist * 0.2) continue;
    if (d >= next && d < next + 5 && next <= until) {
      if (enter === null) enter = t;
      row.push(`${(next - from).toFixed(0)}m ${Math.round(Math.hypot(car.vx, car.vy) * 3.6)}${car.air > 0 ? 'A' : ''}`);
      next += 10;
    }
    if (next > until && enter !== null) { row.push(`= ${(t - enter).toFixed(2)} s`); break; }
  }
  console.log(name, row.join(' '));
}
