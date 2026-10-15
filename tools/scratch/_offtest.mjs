// scratch: the OFF-ROAD guard (highway.js highwayGuard) with a car placed by hand: sitting 12 m out (near: must not reset), 25 m out
// still (must reset at ~10 s), 25 m out heading back at 3 m/s (paused while heading in), 25 m out with a 0.5 m/s drift in (not trying).
import { makeCar, reset } from '../../src/vehicle.ts';
import * as L from '../../src/lab.js';
import * as H from '../../src/highway.js';
// the levels importing these modules used to add (task 078 made it explicit)
H.addHighwayLevel();
const PHYSICS_STEP_SECONDS = 1 / 120;
let bad = 0;
function run(name, outAt, T = 25) {
  const lv = H.createHighway(4242, 'motorway'); lv.id = 'ot' + name.length; L.LEVELS.push(lv); L.setLevel(lv.id);
  const c = makeCar('saloon-rwd'), s0 = H.roadFrame(lv, lv.spawn.x, lv.spawn.y, null).s, hw = lv._hw.geo.hw;
  let t = 0, why = null, s = s0;
  for (; t < T; t += PHYSICS_STEP_SECONDS) { s += 15 * PHYSICS_STEP_SECONDS; const out = outAt(t), p = H.roadPose(lv, s, -(hw + out)), q = H.roadPose(lv, s + 1, -(hw + out));
    reset(c, p.x, p.y, p.h); c.vx = (q.x - p.x) * 15; c.vy = (q.y - p.y) * 15;
    H.stepHighway(lv, c); why = H.highwayGuard(lv, c, PHYSICS_STEP_SECONDS); if (why) break; }
  console.log(`${name.padEnd(40)} ${why ? 'RESET at ' + t.toFixed(1) + ' s (' + why + ')' : 'no reset in ' + T + ' s'}`);
  return why ? t : null;
}
const ok = (c, m) => { if (!c) { bad++; console.log('FAIL ' + m); } };
ok(!run('12 m out, still (close to the road)', () => 12), 'near the road: no reset');
const a = run('25 m out, still', () => 25); ok(a && a > 9 && a < 11, 'far out: resets at ~10 s');
ok(!run('25 m out, heading back at 3 m/s', (t) => Math.max(9, 25 - 3 * Math.max(0, t - 4))), 'heading back: no reset');
const b = run('25 m out, creeping in at 0.5 m/s', (t) => 25 - 0.5 * t); ok(b, 'creeping in slowly is not getting back: resets');
console.log(bad ? `${bad} FAIL(S)` : 'ALL OK');
