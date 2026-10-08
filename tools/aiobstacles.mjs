// aiobstacles.mjs — does the racing AI step round loose objects (cones, tyres, bales)? One AI, 2 laps with the level's real objects
// (cones.js), objects passed to drive() as main.js does (within 45 m, refreshed 0.25 s) or not (OBS=0); prints objects MOVED, lap time.
// node tools/aiobstacles.mjs [level] [car] [diff]
import { makeCar, step, reset, DT } from '../src/vehicle.js';
import * as L from '../src/lab.js';
import { createCones } from '../src/cones.js';
const { createAIDriver, aiTraits, racingLine } = await import(process.env.AINEXT ? '../src/aidriver.next.js' : '../src/aidriver.js');
const [lv = 'sweaty-lamb', carId = 'rally-4x4', d = '3'] = process.argv.slice(2), use = process.env.OBS !== '0';
if (process.env.OBL) globalThis.__OBL = +process.env.OBL;
L.setLevel(lv); L.clearWear();
const cones = createCones(); cones.reset();
const Ln = racingLine(L.LEVEL), st = L.LEVEL.subtrack, car = makeCar(carId), p = L.onTrack(st, st.totalDist - 30, 0, {});
reset(car, p.x, p.y, p.rot);
const drv = createAIDriver(L.LEVEL, aiTraits(+d, 0, 1, 3));
let t = 0, obsT = 0, obs = [], prev = null, laps = 0, t0 = 0;
while (t < 400 && laps < 3) {
  if (obsT <= 0) { obsT = 0.25; obs = use ? cones.list.filter((o) => (o.x - car.x) ** 2 + (o.y - car.y) ** 2 < 2025).map((o) => ({ x: o.x, y: o.y, r: o.r })) : []; }
  obsT -= DT;
  L.barrierClamp(car); L.solidClamp(car); L.applyGround(car, DT); step(car, drv.drive(car, DT, { cars: [], obstacles: obs, lap: 2, laps: 5 }), DT); cones.step(car, DT); t += DT;
  const q = L.querySubtrack(st, car.x, car.y);
  if (prev !== null && prev > st.totalDist - 60 && q.trackDist < 60) { laps++; if (laps === 1) t0 = t; }
  prev = q.trackDist;
}
const moved = cones.list.filter((o) => o.moved || Math.hypot(o.x - o.hx, o.y - o.hy) > 0.3).length;
if (process.env.WHERE) { const h = {}; for (const o of cones.list) if (o.moved || Math.hypot(o.x - o.hx, o.y - o.hy) > 0.3) { const q = L.querySubtrack(st, o.hx, o.hy), k = o.kind + ' off ' + Math.round(q.dist - st.width / 2) + 'm'; h[k] = (h[k] || 0) + 1; } console.log(JSON.stringify(h), 'half width', st.width / 2); }
console.log(`${lv} ${carId} diff ${d} obstacles ${use ? 'ON ' : 'OFF'}: ${cones.list.length} objects, MOVED ${moved} | 2 laps ${laps >= 3 ? (t - t0).toFixed(1) + ' s' : 'n/a'} | avoiding ${(drv.state.obst || 0).toFixed(1)} s`);
