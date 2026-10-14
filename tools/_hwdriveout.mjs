// _hwdriveout.mjs — AI ROUND 2.1: the DRIVE OUT on the HIGHWAY (new: the old highway driver had none). A racer is put STOPPED off the
// road, nose pointing ACROSS the road at the verge (beached), with nothing else around; does it reverse, turn back and drive on?
// Per scenario: drive-outs fired, gave up?, speed + distance up the road after 12 s, back on the carriageway?  node tools/_hwdriveout.mjs
import { makeCar, step, reset, PHYSICS_STEP_SECONDS } from '../src/vehicle.ts';
import * as L from '../src/lab.js';
import * as H from '../src/highway.js';
import { aiTraits } from '../src/ai/traits.ts';
import { createAIDriver } from '../src/ai/circuit.ts';
import { hwFrames } from '../src/highwayrace.ts';
// the levels importing these modules used to add (task 078 made it explicit)
H.addHighwayLevel();
let fails = 0;
for (const [name, side, ang] of [['left verge, nose out 70 deg', -1, 70], ['right edge, nose out 80 deg', 1, 80], ['left verge, nose out 110 deg', -1, 110]]) {
  const lv = H.createHighway(4242, 'motorway'); lv.id = 'do' + name.length + side; if (!L.LEVELS.includes(lv)) L.LEVELS.push(lv); L.setLevel(lv.id);
  const c = makeCar('saloon-rwd'); c.absOn = c.tcsOn = true;
  const s0 = H.roadFrame(lv, lv.spawn.x, lv.spawn.y, null).s, hw = lv._hw.geo.hw;
  const p = H.roadPose(lv, s0 + 50, side * (hw + 2.5));
  reset(c, p.x, p.y, p.h + side * ang * Math.PI / 180);
  const drv = createAIDriver(lv, aiTraits(2, 1, 6, 9));
  let t = 0, outs = 0, rev = 0;
  for (; t < 12; t += PHYSICS_STEP_SECONDS) {
    hwFrames(lv, [c]); if (!c._hwf) break; H.stepHighway(lv, c);
    const w = drv.drive(c, PHYSICS_STEP_SECONDS, { cars: [] }); if (w.reverse) rev++;
    L.applyGround(c, PHYSICS_STEP_SECONDS); step(c, w, PHYSICS_STEP_SECONDS);
  }
  const f = c._hwf, onRoad = f && Math.abs(f.off) < hw, v = Math.hypot(c.vx, c.vy) * 3.6, gone = f ? f.s - (s0 + 50) : NaN;
  outs = drv.state.nOut || 0;
  // PASS = it tried (reversed) AND either drove back onto the road at speed, or GAVE UP (-> main.js resets it: the circuit rule too).
  // FAIL = sat there: no drive-out, or neither recovered nor gave up (the old highway driver: waited for the 3 s reset every time)
  const back = onRoad && v > 30 && gone > 15, ok = outs >= 1 && (back || drv.state.giveUp);
  if (!ok) fails++;
  console.log(`${ok ? (back ? 'ok  (drove out)  ' : 'ok  (gave up -> reset)') : 'FAIL'} ${name}: drive-outs ${outs}, reversing ${(rev * PHYSICS_STEP_SECONDS).toFixed(1)} s, gave up ${!!drv.state.giveUp} | after 12 s: ${v.toFixed(0)} km/h, ${gone.toFixed(0)} m up the road, off ${f ? f.off.toFixed(1) : '?'} m (road half width ${hw.toFixed(1)})`);
}
console.log(fails ? `${fails} FAILED` : 'ALL OK');
