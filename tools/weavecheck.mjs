// weavecheck.mjs — the highway WEAVER (src/aidriver.js, the highway road driver) in CONTROLLED scenarios: one racer (real physics) comes up on
// slow "traffic" (kinematic boxes on their lane lines, 90 km/h) in patterns — a single car, a wall of 2 with one gap, a slalom of 4,
// staggered pairs — at 150 / 200 / 240 km/h, on the motorway's first straight and in its bends. Per scenario: hits, worst rear slip
// (a spin starts ~0.25 rad), worst distance past the line limits, and the speed kept. Tuning via env (HWT='{"aLat":0.3,...}').
// node tools/weavecheck.mjs [diff]
import { makeCar, step, reset, DT } from '../src/vehicle.js';
import * as L from '../src/lab.js';
import * as H from '../src/highway.js';
import { aiTraits, createAIDriver } from '../src/aidriver.js';
import { hwFrames } from '../src/hwrace.js';
// the levels importing these modules used to add (task 078 made it explicit)
H.addHighwayLevel();
const DIFF = +(process.argv[2] ?? 2);
const PAT = {
  single: [[0, 1]], wall: [[0, 0], [0, 1]], wallR: [[0, 1], [0, 2]], slalom: [[0, 1], [40, 0], [80, 2], [120, 1]], pairs: [[0, 0], [0, 1], [50, 1], [50, 2], [100, 0], [100, 1]],
};
let tot = { hit: 0, spin: 0, wide: 0, n: 0 };
for (const seed of [4242, 77, 1234]) for (const v0 of [150, 200, 240]) for (const [pn, pat] of Object.entries(PAT)) {
  const lv = H.createHighway(seed, 'motorway'); lv.id = 'wv' + seed; if (!L.LEVELS.includes(lv)) L.LEVELS.push(lv); L.setLevel(lv.id);
  const C = lv._hw.geo.centres, c = makeCar('saloon-rwd'); c.absOn = c.tcsOn = true;
  const s0 = H.roadFrame(lv, lv.spawn.x, lv.spawn.y, null).s + (seed === 4242 ? -200 : 100);   // seed 4242: the straight; others: wherever
  const p = H.roadPose(lv, s0, C[1]); reset(c, p.x, p.y, p.h); c.vx = Math.cos(p.h) * v0 / 3.6; c.vy = Math.sin(p.h) * v0 / 3.6; c.gear = 5;
  const drv = createAIDriver(lv, aiTraits(DIFF, 1, 6, 9));
  const vT = 90 / 3.6, obs = pat.map(([ds, ln]) => ({ s: s0 + 120 + ds, off: C[ln], spec: { len: 4.3, wid: 1.8 } }));
  let hit = 0, slip = 0, wide = 0, vMin = 999, t = 0;
  const hi = lv._hw.geo.hw - 1.8;
  for (; t < 14; t += DT) {
    for (const o of obs) { o.s += vT * DT; const q = H.roadPose(lv, o.s, o.off); o.x = q.x; o.y = q.y; o.heading = q.h; o.vx = Math.cos(q.h) * vT; o.vy = Math.sin(q.h) * vT; o._hwf = { s: o.s, off: o.off, v: vT }; }
    hwFrames(lv, [c]); const f = c._hwf; if (!f) break;
    H.stepHighway(lv, c);
    const w = drv.drive(c, DT, { cars: obs }); L.applyGround(c, DT); step(c, w, DT);
    for (const o of obs) if (Math.abs(o.s - f.s) < (c.spec.len + o.spec.len) / 2 && Math.abs(o.off - f.off) < (c.spec.wid + o.spec.wid) / 2) { hit++; break; }
    if (process.env.WVONE === `${seed}/${v0}/${pn}` && Math.round(t / DT) % 12 === 0) console.log(`   t ${t.toFixed(2)} v ${(f.v * 3.6).toFixed(0)} off ${f.off.toFixed(2)} line ${drv.state.line.toFixed(2)} tgt ${drv.state.tgt.toFixed(2)} tv ${(drv.state.tv || 0).toFixed(2)} | ${obs.map((o) => `[${(o.s - f.s).toFixed(0)} ${o.off.toFixed(1)}]`).join(' ')} | thr ${w.throttle.toFixed(2)} brk ${w.brake.toFixed(2)} st ${w.steer.toFixed(3)} slipR ${c.t.slipR.toFixed(2)} yaw ${c.yawRate.toFixed(3)} rel ${(Math.atan2(Math.sin(c.heading - H.roadPose(lv, f.s, 0).h), Math.cos(c.heading - H.roadPose(lv, f.s, 0).h)) * 57.3).toFixed(2)}deg delta ${c.delta.toFixed(3)} vlat ${(c.t.vLat || 0).toFixed(2)}`);
    slip = Math.max(slip, Math.abs(c.t.slipR)); wide = Math.max(wide, Math.abs(f.off) - hi); vMin = Math.min(vMin, Math.hypot(c.vx, c.vy) * 3.6);
    if (obs.every((o) => f.s > o.s + 30)) break;
  }
  const bad = hit || slip > 0.25 || wide > 1;
  tot.hit += hit ? 1 : 0; tot.spin += slip > 0.25 ? 1 : 0; tot.wide += wide > 1 ? 1 : 0; tot.n++;
  if (bad || process.env.WVALL) console.log(`${bad ? 'BAD ' : '    '} seed ${seed} ${v0} km/h ${pn.padEnd(7)}: hit-steps ${hit}, rear slip ${slip.toFixed(2)}, wide ${Math.max(0, wide).toFixed(1)} m, slowest ${vMin.toFixed(0)} km/h, ${t.toFixed(1)} s`);
}
console.log(`diff ${DIFF}: ${tot.n} scenarios | hit in ${tot.hit} | spun (slip > 0.25) in ${tot.spin} | > 1 m wide in ${tot.wide}`);
