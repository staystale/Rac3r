// aijokercheck.mjs — the racing AI on the RALLYCROSS levels, one car alone from the real grid spawn, a whole 5-lap race:
// per lap time, which lap it jokered (counted by the GATE, the same circle test as main.js stepJoker), how many gate entries (must be 1),
// and on Slidden Hill whether the start was driven down the RX start straight (the furthest it got from the start lane,
// until it reaches the lane's end, must be under the lane's half width). node tools/aijokercheck.mjs [levels] [car] [diff 0-4] [seeds e.g. 1,2,3,4,5]
import { makeCar, step, reset, DT } from '../src/vehicle.js';
import * as L from '../src/lab.js';
import { createAIDriver } from '../src/ai/circuit.js';
import { aiTraits } from '../src/ai/traits.ts';
import { aiPaths } from '../src/ai/line.js';
const levels = (process.argv[2] || 'slidden-hill,knobhill').split(','), carId = process.argv[3] || 'rally-4x4', d = +(process.argv[4] || 4);
const seeds = (process.argv[5] || '1,2,3,4,5').split(',').map(Number);
const segDist = (P, x, y) => { let bd = Infinity; for (let i = 0; i < P.length - 1; i++) { const [ax, ay] = P[i], [bx, by] = P[i + 1], vx = bx - ax, vy = by - ay, l2 = vx * vx + vy * vy || 1, t = Math.max(0, Math.min(1, ((x - ax) * vx + (y - ay) * vy) / l2)); bd = Math.min(bd, Math.hypot(ax + vx * t - x, ay + vy * t - y)); } return bd; };
for (const lv of levels) {
  L.setLevel(lv); const paths = aiPaths(L.LEVEL), st = L.LEVEL.subtrack, J = L.LEVEL.joker, sp = L.LEVEL.spawn;
  console.log(`${lv}: joker branch ${paths.joker ? paths.joker.n + ' pts' : 'NONE'}, start branch ${paths.start ? paths.start.n + ' pts' : 'none'}`);
  for (const seed of seeds) {
    L.setLevel(lv); L.clearWear();
    const car = makeCar(carId); reset(car, sp.x, sp.y, sp.heading);
    const tr = aiTraits(d, 0, 1, seed), drv = createAIDriver(L.LEVEL, tr);
    let reachedEnd = false, t = 0, prog = null, lastQ = null, inGate = false, gates = 0, gateLap = [], lapT = [], tl = 0, startDev = 0, off = 0;
    const total = st.totalDist;
    while (t < 600) {
      L.applyGround(car, DT);
      const lap = prog == null ? 1 : Math.max(1, Math.floor(prog / total) + 1);
      step(car, drv.drive(car, DT, { cars: [], lap, laps: J ? J.laps : 5 }), DT); t += DT;
      const q = L.querySubtrack(st, car.x, car.y);
      if (isFinite(q.trackDist)) { if (prog == null) { prog = q.trackDist > total / 2 ? q.trackDist - total : q.trackDist; } else { let dq = q.trackDist - lastQ; if (dq > total / 2) dq -= total; if (dq < -total / 2) dq += total; const before = Math.floor(prog / total); prog += dq; if (Math.floor(prog / total) > before && prog > 0) { lapT.push((t - tl).toFixed(1)); tl = t; } } lastQ = q.trackDist; }
      if (q.dist > st.width / 2 + 1 && !(paths.startLane && t < 8)) off += DT;
      if (J) { const g = (car.x - J.gate.x) ** 2 + (car.y - J.gate.y) ** 2 < J.gate.r * J.gate.r; if (g && !inGate) { gates++; gateLap.push(lap); } inGate = g; }
      if (paths.startLane && !reachedEnd) { const E = paths.startLane.pts[paths.startLane.pts.length - 1]; if (Math.hypot(car.x - E[0], car.y - E[1]) < 10) reachedEnd = true; else startDev = Math.max(startDev, segDist(paths.startLane.pts, car.x, car.y)); }
      if (prog != null && prog >= total * (J ? J.laps : 5)) break;
    }
    console.log(`  seed ${seed} ${tr.persona.padEnd(10)} plan L${drv.state.jPlan}${drv.state.jForget ? ' (forgets)' : ''} | gates ${gates} on lap ${gateLap.join(',') || '-'} | laps [${lapT.join(', ')}] total ${t.toFixed(1)}s | off ${off.toFixed(1)}s${paths.startLane ? ` | start-lane dev ${startDev.toFixed(1)} m (half width ${paths.startLane.width / 2})` : ''}`);
  }
}
