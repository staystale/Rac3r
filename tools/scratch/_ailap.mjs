// _ailap.mjs - ROOT FIX: a lone AI's laps with ?wheelspin off / on (FIX flipped in-process): the
// mean lap time over 3 laps after a flying start, seconds with the car's centre off the road,
// and seconds with a wheel locked / ABS working. node tools/scratch/_ailap.mjs [levels] [cars] [diff]
import { makeCar, step, reset, PHYSICS_STEP_SECONDS as DT } from '../../src/vehicle.ts';
import * as L from '../../src/lab.js';
import { createAIDriver } from '../../src/ai/circuit.ts';
import { aiTraits } from '../../src/ai/traits.ts';
import { racingLine } from '../../src/ai/line.ts';
import { FIX } from '../../src/core/fixes.ts';
const levels = (process.argv[2] || 'thruston,castle-cum,sweaty-lamb').split(',');
const cars = (process.argv[3] || 'hatch-rwd,rally-4x4,track-rwd').split(',');
const diff = +(process.argv[4] || 4);
for (const lv of levels) for (const id of cars) {
  const row = [];
  for (const on of [false, true]) {
    FIX.wheelSpin = on;
    L.setLevel(lv); L.clearWear();
    const st = L.LEVEL.subtrack, ln = racingLine(L.LEVEL), car = makeCar(id), p0 = ln.pts[0];
    reset(car, p0.x, p0.y, p0.h);
    const drv = createAIDriver(L.LEVEL, aiTraits(diff, 0, 1, 3));
    let t = 0, prog = 0, last = null, off = 0, lock = 0, abs = 0, lapT = null, laps = 0;
    while (t < 400 && laps < 4) {
      L.barrierClamp(car); L.solidClamp(car); L.applyGround(car, DT);
      step(car, drv.drive(car, DT, { cars: [], lap: 2, laps: 9 }), DT); t += DT;
      const q = L.querySubtrack(st, car.x, car.y);
      if (last !== null) { let dd = q.trackDist - last; if (dd < -st.totalDist / 2) dd += st.totalDist; prog += dd; }
      last = q.trackDist;
      const lapNow = Math.floor(prog / st.totalDist);
      if (lapNow > laps) { laps = lapNow; if (laps === 1) lapT = t; }
      if (laps >= 1) { if (q.dist > st.width / 2) off += DT; if (car.t.lockedF || car.t.lockedR) lock += DT; if (car.t.absWorking) abs += DT; }
    }
    row.push(laps >= 4 ? `${((t - lapT) / 3).toFixed(1)} s/lap off ${off.toFixed(1)} lock ${lock.toFixed(1)} abs ${abs.toFixed(1)}` : `DNF (${laps} laps)`);
  }
  console.log(`${lv.padEnd(12)} ${id.padEnd(10)} off: ${row[0]}  |  ON: ${row[1]}`);
}
