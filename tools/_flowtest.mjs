// scratch: the highway END COUNTDOWNS with scripted gaps (no physics). Screen = +-75 m. Scenarios: the leader pulls away and you sit
// still (must end ~15 s after it leaves the screen); you close on it slowly (must NOT end); you hover just past the edge (holds);
// you are ahead of everyone off screen (PULLING AWAY, 8 s).
import * as L from '../src/lab.js';
import * as H from '../src/highway.js';
import { createHwFlow, HW_CATCH, HW_COUNT } from '../src/hwrace.js';
const lv = H.createHighway(4242, 'motorway'); lv.id = 'ft'; L.LEVELS.push(lv); L.setLevel(lv.id);
const DT = 1 / 120, VIEW = 75;
function run(name, gapAt, T = 40, other = null) {
  const me = { spec: {}, _hwf: { s: 0 } }, ai = [{ spec: {}, _hwf: { s: 0 } }, { spec: {}, _hwf: { s: 0 } }];
  const vis = (c) => Math.abs(c._hwf.s - me._hwf.s) < VIEW;
  const flow = createHwFlow({ lv, cars: [{ car: me, player: true }, ...ai.map((car) => ({ car }))], visible: vis });
  let t = 0, holdT = 0, cdMin = 99, seen = new Set();
  for (; t < T && flow.state !== 'done'; t += DT) {
    // ai[0] = the car the scenario scripts (the slowest one when ahead); ai[1] = a faster one 30 m further on, or `other` if given
    const g = gapAt(t); me._hwf.s = 1000 + t * 40; ai[0]._hwf.s = me._hwf.s + g; ai[1]._hwf.s = me._hwf.s + (other ? other(t) : g > 0 ? g + 30 : g - 10);
    flow.step(DT); if (flow.cdKind) { seen.add(flow.cdKind); cdMin = Math.min(cdMin, flow.cd); } if (flow.cdHold) holdT += DT;
  }
  console.log(`${name.padEnd(44)} ended ${flow.state === 'done' ? 'YES at ' + t.toFixed(1) + ' s' : 'no'} | kinds ${[...seen].join(',') || '-'} | held ${holdT.toFixed(1)} s | lowest ${cdMin === 99 ? '-' : cdMin.toFixed(1)}`);
  return flow.state === 'done' ? t : null;
}
let bad = 0; const ok = (c, m) => { if (!c) { bad++; console.log('FAIL ' + m); } };
// leader pulls away 8 m/s from t=3, off screen (75 m) at ~12 s; 15 s more -> ~27 s
const a = run('leader escapes, you not trying', (t) => Math.max(5, (t - 3) * 8 + 5)); ok(a && a > 24 && a < 31, 'not trying: ends ~15 s after it leaves the screen');
// it gets to 150 m, then you claw back 2 m/s
run('it gets 150 m away, then you close 2 m/s', (t) => (t < 21 ? Math.max(5, (t - 3) * 8 + 5) : 149 - (t - 21) * 2));
const b = run('100 m away, then you close 1.5 m/s (slow)', (t) => (t < 15 ? Math.max(5, (t - 3) * 8 + 5) : 101 - (t - 15) * 1.5), 60); ok(!b, 'closing slowly must not end it');
const c = run('hovering 20 m past the screen edge', (t) => Math.min(95, Math.max(5, (t - 3) * 8 + 5)), 60); ok(c && c > 30, 'hovering just past the edge holds a while (10 s), then runs');
const d = run('hovering 60 m past the edge (not near)', (t) => Math.min(135, Math.max(5, (t - 3) * 8 + 5)), 60); ok(d, 'well past the edge, not closing: still ends');
// the 2026-10-06 rule: free racing while anyone is with you
const f = run('leader escapes, a rival still BEHIND you', (t) => Math.max(5, (t - 3) * 8 + 5), 60, () => -20); ok(!f, 'a rival behind you: no CATCH THEM');
const h = run('leader escapes, slowest rival ON SCREEN ahead', (t) => 30, 60, (t) => Math.max(35, (t - 3) * 8 + 5)); ok(!h, 'slowest rival on screen: no CATCH THEM');
const e = run('YOU pull away from everyone', (t) => -Math.max(5, (t - 3) * 8 + 5)); ok(e && e < 25, 'pulling away still ends (you win)');
// USER, 2026-10-06: "catch them timer never seems to time out it fails to count down". On a curvy road the last rival dips back ON
// screen at the edge now and then (a bend brings it into view): 0.4 s in view every 3 s. It must still run out.
{ const vis0 = null; const g = (t) => Math.min(110, Math.max(5, (t - 3) * 8 + 5));
  const flick = run('leader 110 m off, flickers on screen 0.4 s / 3 s', (t) => (t > 20 && (t % 3) < 0.4 ? 60 : g(t)), 70); ok(flick && flick < 50, 'edge flicker must not keep resetting CATCH THEM'); }
// ...but properly back with it (on screen > 2 s) cancels it, and the next escape starts a fresh clock
const back = run('caught up for 5 s at t 22, then it escapes again', (t) => (t < 22 ? g2(t) : t < 27 ? 40 : 40 + (t - 27) * 8), 70); ok(back && back > 27 + 4 + 14, 'really caught up: a fresh clock after');
// the 2026-10-06 phone report, as it most likely happened: rivals keep spinning off - every 6 s the slowest one is behind you for 3 s
// (you passed it), then off screen ahead again. Each cancel used to restart the full 15 s: it never ran out.
const spin = run('a rival keeps dropping behind you for 3 s in 6', (t) => g2(t), 120, (t) => (t > 20 && (t % 6) < 3 ? -15 : g2(t) + 30)); ok(spin && spin < 90, 'repeated short cancels must not keep the clock full');
function g2(t) { return Math.min(110, Math.max(5, (t - 3) * 8 + 5)); }
console.log(bad ? `${bad} FAIL(S)` : `ALL OK (HW_CATCH ${HW_CATCH}, HW_COUNT ${HW_COUNT})`);
