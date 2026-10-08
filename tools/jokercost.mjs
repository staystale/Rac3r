// jokercost.mjs — how much time does the JOKER cost? Laps the autodriver on the normal lap and on the same lap with the branch ->
// rejoin stretch swapped for the joker lane, per car. Real RX jokers cost ~1-2 s. node tools/jokercost.mjs [level]
import { makeCar, step, reset, DT } from '../src/vehicle.js';
import * as L from '../src/lab.js';
import { createAutoDriver } from '../src/autodrive.js';
const lv = process.argv[2] || 'slidden-hill';
L.setLevel(lv);
const st = L.LEVEL.subtrack, J = L.LEVEL.lanes.find((l) => l.surface.id === 'dirt' && l.width === 12).pts;
const dOf = ([x, y]) => L.querySubtrack(st, x, y).trackDist;
const d0 = dOf(J[0]), d1 = dOf(J[J.length - 1]);
const pts = st.pts.filter((p) => p.dist < d0).map((p) => [p.x, p.y]).concat(J.slice(1, -1), st.pts.filter((p) => p.dist > d1).map((p) => [p.x, p.y]));
const stJ = L.createSubtrack(pts, st.width, [], [], true);
const lap = (sub, id) => { const car = makeCar(id); const p0 = sub.pts[Math.floor(sub.pts.length * 0.9)]; reset(car, p0.x, p0.y, p0.heading);
  const drv = createAutoDriver(sub); let t = 0, start = null;
  while (t < 400) { L.applyGround(car, DT); step(car, drv.drive(car), DT); t += DT; if (start === null && drv.state.travelled > sub.totalDist * 0.15) start = t; if (drv.state.travelled > sub.totalDist * 1.15) return t - start; }
  return NaN; };
console.log(`branch ${d0.toFixed(0)} -> rejoin ${d1.toFixed(0)} m; normal lap ${st.totalDist.toFixed(0)} m, joker lap ${stJ.totalDist.toFixed(0)} m`);
for (const id of ['hatch-rwd', 'rally-4x4', 'track-rwd']) { const a = lap(st, id), b = lap(stJ, id); console.log(id.padEnd(10), `normal ${a.toFixed(1)} s, with joker ${b.toFixed(1)} s, joker costs ${(b - a).toFixed(1)} s`); }
