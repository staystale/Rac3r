// aidcheck.mjs — DRIVER AIDS (ABS, TCS = traction + stability), each measured ON vs OFF on the same car.
// A few degrees of body slip at full lock is TURNING, not sliding: MEASURED, the estate floored on full lock at 45 km/h
// runs wide on a 21.7 m circle without TCS (power understeer) and holds a 12.5 m circle at 4.4 deg with it. So "the aid
// does not make a slide" means it never pushes peak slip past 12 deg where there was none.
// Added 2026-10-03 with the aids (user: real-world fit, on by default, switchable). If an aid cannot move its number,
// the player cannot feel it (CLAUDE.md §3), so every one has a bar it must clear:
//   ABS  hard brake mid-corner: no front lock, the car keeps turning; straight stop no longer than without
//   TCS  slippery launch: less wheelspin; a provoked slide: smaller peak slip; clean cornering: grip not reduced
import { makeCar, step, reset, PHYSICS_STEP_SECONDS } from '../src/vehicle.ts';
import { SURFACES } from '../src/lab.js';

const I = (o) => ({ steer: 0, throttle: 0, brake: 0, handbrake: 0, ...o });
const fails = [];
const check = (ok, msg) => { console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${msg}`); if (!ok) fails.push(msg); };
const mk = (id, on, surf = SURFACES.tarmac, kph = 0) => {
  const c = makeCar(id); reset(c, 0, 0, 0); c.absOn = on && !!c.spec.aids?.abs; c.tcsOn = on && !!c.spec.aids?.tcs;
  c.tyreT = [80, 80, 80, 80]; c.surface = surf;
  if (kph) { c.vx = kph / 3.6; c.gear = 3; c.rpm = c.spec.upshiftRpm * 0.7; }
  return c;
};
const run = (c, secs, inp, each) => { for (let t = 0; t < secs; t += PHYSICS_STEP_SECONDS) { c.surface = c.surface; step(c, typeof inp === 'function' ? inp(c, t) : inp, PHYSICS_STEP_SECONDS); if (each) each(c, t); } };
const beta = (c) => Math.abs(Math.atan2(c.t.vLat, Math.abs(c.t.vLong))) * 57.3;

console.log('ABS — full brake while turning at 100 km/h (steer 0.15), 1.5 s');
for (const id of ['hatch-fwd', 'hatch-rwd', 'estate-4x4', 'muscle-rwd']) {
  const r = {};
  for (const on of [false, true]) {
    const c = mk(id, on, SURFACES.tarmac, 100); let lockT = 0; const h0 = c.heading;
    run(c, 1.5, I({ steer: 0.15, brake: 1 }), (c) => { if (c.t.lockedF) lockT += PHYSICS_STEP_SECONDS; });
    r[on] = { lockT, turn: Math.abs(c.heading - h0) * 57.3, v: c.t.vLong * 3.6 };
  }
  console.log(`  ${id.padEnd(11)} off: front locked ${r[false].lockT.toFixed(2)} s, turned ${r[false].turn.toFixed(0)} deg | on: locked ${r[true].lockT.toFixed(2)} s, turned ${r[true].turn.toFixed(0)} deg`);
  check(r[true].lockT < 0.05, `${id}: ABS keeps the fronts from locking`);
  check(r[true].turn >= r[false].turn, `${id}: ABS keeps it turning at least as much`);
}
console.log('ABS — straight stop from 100 km/h, tarmac and wet');
for (const id of ['hatch-rwd', 'muscle-rwd']) for (const surf of ['tarmac', 'wet']) {
  const d = {};
  for (const on of [false, true]) {
    const c = mk(id, on, SURFACES[surf], 100); let dist = 0;
    run(c, 10, I({ brake: 1 }), (c) => { dist += Math.max(0, c.t.vLong) * PHYSICS_STEP_SECONDS; });
    d[on] = dist;
  }
  console.log(`  ${id.padEnd(11)} ${surf.padEnd(7)} off ${d[false].toFixed(1)} m | on ${d[true].toFixed(1)} m`);
  check(d[true] <= d[false] * 1.05, `${id} ${surf}: ABS stop no longer than a locked stop (+5%)`);
}
console.log('TCS traction — full throttle from rest, 3 s, on wet / grass / ice');
for (const id of ['hatch-fwd', 'hatch-rwd', 'estate-4x4']) for (const surf of ['wet', 'grass', 'ice']) {
  const r = {};
  for (const on of [false, true]) {
    const c = mk(id, on, SURFACES[surf]); let spin = 0;
    run(c, 3, I({ throttle: 1 }), (c) => { spin += (c.wheelSpin || 0) * PHYSICS_STEP_SECONDS; });
    r[on] = { spin, v: c.t.vLong * 3.6 };
  }
  console.log(`  ${id.padEnd(11)} ${surf.padEnd(6)} off: spin ${r[false].spin.toFixed(2)} m, ${r[false].v.toFixed(0)} km/h | on: spin ${r[true].spin.toFixed(2)} m, ${r[true].v.toFixed(0)} km/h`);
  if (r[false].spin > 0.3) check(r[true].spin < r[false].spin * 0.7, `${id} ${surf}: TCS cuts wheelspin by 30%+`);
}
console.log('TCS + HANDBRAKE — handbrake flick (0.5 s) at 70 km/h, 0.7 lock, 0.6 throttle (peak body slip)');
for (const id of ['hatch-rwd', 'estate-4x4', 'hatch-fwd']) {
  const r = {};
  for (const on of [false, true]) {
    const c = mk(id, on, SURFACES.tarmac, 70); let pk = 0;
    // peak taken while the PLAYER is asking for rotation: the 0.5 s pull + the 0.6 s ESC.hbHold after it. Later, catching the
    // overshoot is exactly what TCS on is for (MEASURED: hatch-fwd 48 deg off vs 39 on over 2.5 s, all of it after the hold).
    run(c, 2.5, (c, t) => I({ steer: 0.7, throttle: 0.6, handbrake: t < 0.5 ? 1 : 0 }), (c, t) => { if (t < 1.1) pk = Math.max(pk, beta(c)); });
    r[on] = pk;
  }
  console.log(`  ${id.padEnd(11)} off: peak slip ${r[false].toFixed(0)} deg | on: ${r[true].toFixed(0)} deg`);
  // HANDBRAKE OVERRIDES STABILITY (user, 2026-10-03): a handbrake turn must rotate as much with TCS on as off.
  check(r[true] >= r[false] * 0.85, `${id}: a handbrake turn is not straightened by TCS (within 15%)`);
}
console.log('TCS stability — POWER slide: 45 km/h, steer 0.8, full throttle, 3 s (peak body slip)');
for (const id of ['hatch-rwd', 'estate-4x4']) {
  const r = {};
  for (const on of [false, true]) {
    const c = mk(id, on, SURFACES.tarmac, 45); let pk = 0;
    run(c, 3, I({ steer: 0.8, throttle: 1 }), (c) => { pk = Math.max(pk, beta(c)); });
    r[on] = pk;
  }
  console.log(`  ${id.padEnd(11)} off: peak slip ${r[false].toFixed(0)} deg | on: ${r[true].toFixed(0)} deg`);
  if (r[false] > 15) check(r[true] < r[false] * 0.75, `${id}: power slide caught (25%+ less slip)`);
  else check(r[true] < 12, `${id}: no slide to catch, and the aid does not make one (< 12 deg)`);
}
console.log('TCS stability — braking (0.5) while turning hard at 90 km/h, 2 s (peak body slip)');
for (const id of ['hatch-rwd', 'estate-4x4', 'hatch-fwd']) {
  const r = {};
  for (const on of [false, true]) {
    const c = mk(id, on, SURFACES.tarmac, 90); let pk = 0;
    run(c, 2, I({ steer: 0.35, brake: 0.5 }), (c) => { pk = Math.max(pk, beta(c)); });
    r[on] = pk;
  }
  console.log(`  ${id.padEnd(11)} off: peak slip ${r[false].toFixed(0)} deg | on: ${r[true].toFixed(0)} deg`);
  if (r[false] > 15) check(r[true] < r[false] * 0.75, `${id}: brake-in-corner slide caught (25%+ less slip)`);
  else check(r[true] < 12, `${id}: no slide to catch, and the aid does not make one (< 12 deg)`);
}
console.log('Clean cornering at 60 km/h (steer 0.08, 4 s): the aids must not cost grip');
for (const id of ['hatch-rwd', 'estate-4x4']) {
  const r = {};
  for (const on of [false, true]) {
    const c = mk(id, on, SURFACES.tarmac, 60); let ay = 0, n = 0;
    run(c, 4, (c) => I({ steer: 0.08, throttle: c.t.vLong < 16.7 ? 0.5 : 0 }), (c, t) => { if (t > 2) { ay += Math.abs(c.t.vLong * c.yawRate); n++; } });
    r[on] = ay / n / 9.81;
  }
  console.log(`  ${id.padEnd(11)} off ${r[false].toFixed(2)} g | on ${r[true].toFixed(2)} g`);
  check(r[true] >= r[false] * 0.97, `${id}: clean cornering is not slowed by the aids`);
}
console.log('TCS must stay OUT of ordinary corners (user, 2026-10-03: "TCS is too strong, making the hatch RWD nearly undrivable")');
// MEASURED BUG: against a pure kinematic yaw reference every road car "understeered" in every corner, so the aid ran 3 of 4 s in
// a gentle corner and 65% of a lap, cutting the engine. Now: understeer-aware reference, wider dead band, cut on oversteer only.
for (const id of ['hatch-rwd', 'hatch-fwd', 'estate-4x4']) {
  const c = mk(id, true, SURFACES.tarmac, 72); let act = 0, cut = 0;
  run(c, 4, I({ steer: 0.15, throttle: 0.5 }), (c) => { if (c.t.tcsWorking) act += PHYSICS_STEP_SECONDS; if (c.escCut < 0.95) cut += PHYSICS_STEP_SECONDS; });
  console.log(`  ${id.padEnd(11)} gentle corner at 72 km/h: aid active ${act.toFixed(1)} of 4 s, engine cut ${cut.toFixed(1)} s`);
  check(act < 1.5 && cut < 0.2, `${id}: TCS leaves an ordinary corner alone (active < 1.5 s, no engine cut)`);
}
console.log(fails.length ? `\nFAIL (${fails.length})` : '\nDriver aids: all OK');
process.exitCode = fails.length ? 1 : 0;
