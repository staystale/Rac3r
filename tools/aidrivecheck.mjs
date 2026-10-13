// aidrivecheck.mjs — the RACING AI (stage 2) lapping alone, node only. Per level x car x difficulty: lap time, off-road seconds, worst
// distance past the edge, and the bench driver's lap for comparison. A PRO ("real") must be clearly quicker than the bench and clean;
// "mobile" slower and messier. node tools/aidrivecheck.mjs [levels,comma] [cars,comma] [diffs,comma e.g. 0,4]
import { makeCar, step, reset, DT } from '../src/vehicle.ts';
import * as L from '../src/lab.js';
import { addStageLevels } from '../src/stagegen.js';   // registers the generated + set rally stages in LEVELS
import { createAutoDriver } from '../src/ai/autodrive.ts';
// the levels importing these modules used to add (task 078 made it explicit)
addStageLevels();
const { createAIDriver } = await import(process.env.AINEXT ? '../src/ai/circuit.next.js' : '../src/ai/circuit.ts'), { aiTraits, DIFFICULTIES } = await import('../src/ai/traits.ts'), { racingLine } = await import('../src/ai/line.ts');
const levels = (process.argv[2] || 'thruston,castle-cum,brands-snatch,knobhill,slidden-hill,test-track,naffcar').split(',');
const cars = (process.argv[3] || 'hatch-rwd,rally-4x4,track-rwd').split(',');
const diffs = (process.argv[4] || '0,2,4').split(',').map(Number);
if (process.argv[5]) globalThis.__AI_K = +process.argv[5];   // calibration: corner grip fraction
for (const k of ['LO', 'LU', 'LF0', 'LF', 'LP', 'LS', 'HB', 'LW', 'SPIN', 'MUS']) if (process.env[k] != null) globalThis['__' + k] = +process.env[k];   // aidriver loose-surface A/B hooks
if (process.argv[6]) globalThis.__AI_KB = +process.argv[6];  // braking fraction
function lap(lv, carId, mk) {
  L.setLevel(lv); L.clearWear(); const st = L.LEVEL.subtrack, hw = st.width / 2;   // wear from the previous run changes grip (measured: bench 60.8 vs 52.4 s)
  const car = makeCar(carId); const p = L.onTrack(st, st.totalDist - 30, 0, {}); reset(car, p.x, p.y, p.rot);
  const drv = mk(); const lt = []; let tl = 0, t = 0, t0 = null, off = 0, worst = 0, wAt = 0, prev = null, laps = 0;
  while (t < 400) {
    L.applyGround(car, DT); step(car, drv.drive(car, DT), DT); t += DT;
    const q = L.querySubtrack(st, car.x, car.y);
    if (prev !== null && prev > st.totalDist - 60 && q.trackDist < 60) { laps++; if (laps > 1) lt.push((t - tl).toFixed(1)); tl = t; if (laps === 1) t0 = t; else if (laps === 3) return { lap: (t - t0) / 2, off, worst, wAt, lt }; }
    // POINT-TO-POINT stage (lab.js ghostSegment): one run, start line -> FINISH; off counted only on the stage
    const S = L.LEVEL.stage; if (S && st.ghost && laps === 1 && prev !== null && prev < S.finish && q.trackDist >= S.finish && q.trackDist - prev < 30) return { lap: t - t0, off, worst, wAt, lt };
    if (laps >= 1) { if (q.dist > hw) off += DT; if (q.dist - hw > worst) { worst = q.dist - hw; wAt = q.trackDist; } }
    prev = q.trackDist;
  }
  return { lap: NaN, off, worst, wAt, lt };
}
for (const lv of levels) {
  L.setLevel(lv); const t0 = performance.now(); racingLine(L.LEVEL); const lineMs = performance.now() - t0;
  console.log(`${lv} (line built in ${lineMs.toFixed(0)} ms)`);
  for (const c of cars) {
    const bench = lap(lv, c, () => createAutoDriver(L.LEVEL.subtrack));
    const row = diffs.map((d) => { const r = lap(lv, c, () => createAIDriver(L.LEVEL, aiTraits(d, 0, 1))); return `${DIFFICULTIES[d].id} ${isNaN(r.lap) ? 'DNF' : r.lap.toFixed(1) + 's'} off ${r.off.toFixed(1)}s/${r.worst.toFixed(1)}m${r.worst > 0.5 ? '@' + Math.round(r.wAt) : ''}${process.env.LAPS ? ' [' + r.lt.join(',') + ']' : ''}`; });
    console.log(`  ${c.padEnd(10)} bench ${bench.lap.toFixed(1)}s | ${row.join(' | ')}`);
  }
}
