// objcheck.mjs — proves object-object collisions in cones.js (added 2026-10-03) by measurement.
//
//   node tools/objcheck.mjs        exit code 1 on any failure
//
// 1. a tyre flung at a cone knocks it over and passes its momentum on (momentum conserved)
// 2. a tyre hitting a stack faster than STACK_BURST_V bursts it; slower only shoves it
// 3. AT REST NOTHING MOVES: every level's objects stay perfectly still for 3 s (no object starts
//    overlapping another and explodes apart) — and it costs ~nothing, since nothing is tested
// 4. a car into the Stock Car tyre wall now knocks more over than the car touches (debris chains)
// 5. cost per step with a burst of moving debris
import { makeCar, step, reset, PHYSICS_STEP_SECONDS } from '../src/vehicle.ts';
import * as L from '../src/lab.js';
import { createCones } from '../src/cones.js';

const fails = [];
const check = (ok, msg) => { console.log((ok ? '  ok   ' : '  FAIL ') + msg); if (!ok) fails.push(msg); };
const farCar = makeCar('hatch-rwd'); reset(farCar, 1e4, 1e4, 0);     // a car nowhere near, so only objects interact
const obj = (kind, x, y, vx = 0) => ({ kind, mode: kind === 'tyrestack' ? 'stack' : kind === 'tyre' ? 'flat' : kind,
  x, y, hx: x, hy: y, vx, vy: 0, ang: 0, spin: 0, down: 0, moved: false, hitCount: 0, rollDist: 0, flipPhase: 0, flipSpeed: 0, wobblePhase: 0, wobbleAmp: 0,
  mass: { cone: 2, tyre: 12, tyrestack: 38 }[kind], r: { cone: 0.27, tyre: 0.42, tyrestack: 0.48 }[kind] });

// ---- 1. tyre -> cone
L.setLevel('naffcar');                 // a level with few objects; we clear them anyway
let c = createCones(); c.list.length = 0;
const tyre = obj('tyre', 0, 0, 10), cone = obj('cone', 0.75, 0);    // 0.06 m short of contact
c.list.push(tyre, cone); c.rebuildGrid();
const p0 = tyre.mass * tyre.vx;
for (let i = 0; i < 2; i++) c.step(farCar, PHYSICS_STEP_SECONDS);    // contact on step 1; 2 steps of drag (~6%) in the total
const p1 = tyre.mass * tyre.vx + cone.mass * cone.vx;
console.log(`1. tyre 10 m/s -> cone: cone ${cone.vx.toFixed(1)} m/s, down ${cone.down > 0}, tyre ${tyre.vx.toFixed(1)} m/s; momentum ${p0.toFixed(0)} -> ${p1.toFixed(0)} (drag included)`);
check(cone.vx > 5 && cone.down > 0 && cone.moved, 'the cone is knocked over and flies off');
check(tyre.vx < 10 * 0.9, 'the tyre loses speed doing it');
check(Math.abs(p1 - p0) / p0 < 0.10, 'momentum passed on, not created (within drag over 6 steps)');

// ---- 2. tyre -> stack, fast and slow
for (const [v, want] of [[8, true], [2.5, false]]) {
  c = createCones(); c.list.length = 0;
  c.list.push(obj('tyre', 0, 0, v), obj('tyrestack', 0.95, 0)); c.rebuildGrid();    // 0.05 m short of contact
  for (let i = 0; i < 30; i++) c.step(farCar, PHYSICS_STEP_SECONDS);
  const burst = c.list.length > 2;
  const shoved = c.list[1].moved && Math.hypot(c.list[1].x - 0.95, c.list[1].y) > 0.01;
  console.log(`2. tyre ${v} m/s -> stack: ${burst ? 'BURST into ' + c.list.length + ' objects' : 'not burst; stack shoved ' + Math.hypot(c.list[1].x - 0.95, c.list[1].y).toFixed(2) + ' m'}`);
  check(burst === want && (want || shoved), want ? 'a fast tyre bursts the stack' : 'a slow tyre only shoves it');
}

// ---- 3. at rest, every level
for (const lv of L.LEVELS) {
  L.setLevel(lv.id); c = createCones();
  const before = c.list.map((k) => [k.x, k.y]);
  const t0 = performance.now();
  for (let i = 0; i < 120 * 3; i++) c.step(farCar, PHYSICS_STEP_SECONDS);
  const ms = (performance.now() - t0) / 360;
  const moved = c.list.filter((k, i) => Math.hypot(k.x - before[i][0], k.y - before[i][1]) > 1e-6).length;
  check(moved === 0, `${lv.id.padEnd(12)} ${String(c.list.length).padStart(3)} objects at rest: ${moved} moved, ${(ms * 1000).toFixed(1)} us/step`);
}

// ---- 4 + 5. car into the Stock Car wall — and the SAME crash with object-object hits OFF, in the same run, as
// the cost baseline. (A fixed 235 us baseline measured once made the check flaky: the mean ran 280-286 us against a
// 294 us line, and a busy machine pushed it over. Measuring both sides together cancels machine load out.)
function crash(objectHits) {
  L.setLevel('stock-car'); const cc = createCones({ objectHits });
  const car = makeCar('hatch-rwd'); reset(car, 100, 0, 0); car.vx = 22;
  let sum = 0, n = 0;
  for (let i = 0; i < 120 * 2.5; i++) {
    L.applyGround(car, PHYSICS_STEP_SECONDS); step(car, { throttle: 1, brake: 0, steer: 0 }, PHYSICS_STEP_SECONDS);
    const t0 = performance.now(); cc.step(car, PHYSICS_STEP_SECONDS); const dt = performance.now() - t0;
    if (i > 30 && cc.list.some((k) => k.vx || k.vy)) { sum += dt; n++; }
  }
  return { knocked: cc.list.filter((k) => k.moved).length, total: cc.list.length, mean: sum / Math.max(1, n) };
}
crash(true); crash(false);                         // JIT warm-up for both paths
const on = crash(true), off = crash(false);
console.log(`4. car 22 m/s into the Stock Car wall: ${on.knocked} knocked with object hits, ${off.knocked} without; cone step mean ${(on.mean * 1000).toFixed(0)} us vs ${(off.mean * 1000).toFixed(0)} us baseline`);
check(on.knocked > off.knocked, 'debris carries the hit on to neighbouring stacks');
// NOT a ratio gate: with object hits the crash knocks MORE objects (15 vs 9), so more debris is moving and
// being simulated — that is more game, not overhead, and a ratio punishes it. Measured over 3 runs on a busy
// machine the ratio was 1.6-1.9x. The gate is an absolute BUDGET: 0.5 ms per physics step (2 steps a frame =
// ~6% of a 60 fps frame) for the whole object system mid-crash.
console.log(`   ratio with / without object hits: ${(on.mean / off.mean).toFixed(2)}x (reported, not gated)`);
check(on.mean < 0.5, 'object system mid-crash under 0.5 ms per physics step');

console.log(fails.length ? `\nFAIL (${fails.length})` : '\nObject collisions: all OK');
process.exitCode = fails.length ? 1 : 0;
