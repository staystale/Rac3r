// terraincheck.mjs — STEP 3 TERRAIN (2026-10-03). Height is real: the suspension feels it, gravity on its slope pushes the
// car (user: "vector dips ... push in all 8 directions, OUT of bumps and IN to dips"), and render.ts shades it.
// Checks the PUSH directions, the suspension zone in the Lab, the Naffcar banking, and the cost.
import { makeCar, step, reset, PHYSICS_STEP_SECONDS } from '../src/vehicle.ts';
import * as L from '../src/lab.js';
const fails = [];
const check = (ok, msg) => { console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${msg}`); if (!ok) fails.push(msg); };
const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
const push = (x, y) => { const s = L.slopeAt(x, y); return [-s.gx, -s.gy]; };     // direction gravity pushes (downhill)

L.setLevel('lab');
const hump = L.LEVEL.bumps.find((b) => b.kind === 'hump' && b.y === 172 && b.h === 0.40);
const dip = L.LEVEL.bumps.find((b) => b.kind === 'dip' && b.d === 0.8);
const bowl = L.LEVEL.bumps.find((b) => b.kind === 'bowl');
const wash = L.LEVEL.bumps.find((b) => b.kind === 'washboard');
console.log('1. push directions, 8 compass points around a hump and a dip (user: "all 8 directions, out and in")');
let outN = 0, inN = 0;
for (let k = 0; k < 8; k++) {
  const a = (k * Math.PI) / 4, dir = [Math.cos(a), Math.sin(a)];
  if (dot(push(hump.x + dir[0] * hump.r * 0.5, hump.y + dir[1] * hump.r * 0.5), dir) > 0) outN++;
  if (dot(push(dip.x + dir[0] * dip.r * 0.5, dip.y + dir[1] * dip.r * 0.5), dir) < 0) inN++;
}
check(outN === 8, `a hump pushes OUT on all 8 sides (${outN}/8)`);
check(inN === 8, `a dip pulls IN on all 8 sides (${inN}/8)`);
const pw = push(wash.x, wash.y + 1);
check(Math.hypot(pw[0], pw[1]) < 1e-9, 'washboard ripples are felt, never pushed (no slope force)');
check(dot(push(bowl.x + 12, bowl.y), [1, 0]) < 0, 'the banked bowl wall pulls DOWN toward the middle');

console.log('2. suspension zone, driven at 50 km/h (hatch-rwd)');
const lane = (y, x0, x1, label) => {
  const c = makeCar('hatch-rwd'); reset(c, x0, y, 0); c.vx = 13.9; c.gear = 3;
  let maxL = 0, minL = 9, air = 0, sumd = 0, n = 0, prev = 1;
  for (let i = 0; i < 120 * 8 && c.x < x1; i++) {
    L.applyGround(c, PHYSICS_STEP_SECONDS); step(c, { steer: 0, throttle: c.t.vLong < 13.9 ? 0.4 : 0, brake: 0, handbrake: 0 }, PHYSICS_STEP_SECONDS);
    maxL = Math.max(maxL, c.loadK); minL = Math.min(minL, c.loadK); if (c.air > 0) air += PHYSICS_STEP_SECONDS; sumd += Math.abs(c.loadK - prev); prev = c.loadK; n++;
  }
  console.log(`   ${label.padEnd(10)} load ${minL.toFixed(2)}..${maxL.toFixed(2)} x static, airtime ${air.toFixed(2)} s, chatter ${(sumd / n * 1000).toFixed(1)}`);
  return { maxL, minL, air, chatter: sumd / n, finite: Number.isFinite(c.x + c.y) };
};
const flat = lane(150, -240, -170, 'flat floor');
const w = lane(172, -240, -170, 'whoops');
const d = lane(187, -240, -140, 'dips');
const wb = lane(203, -235, -175, 'washboard');
check(w.maxL > 1.3 && w.finite, 'whoops load the suspension (peak > 1.3x)');
check(d.maxL > 1.3 && d.finite, 'dips and the compression load the suspension (peak > 1.3x)');
check(wb.chatter > flat.chatter * 3, 'washboard chatters (3x+ the flat floor)');

console.log('3. Naffcar banking: real height, pulls toward the infield, laps unchanged');
L.setLevel('naffcar');
const p = L.LEVEL.subtrack.pts.reduce((a, b) => (b.x > a.x ? b : a));
check(L.heightAt(p.x + 8, p.y) > L.heightAt(p.x - 8, p.y) + 2, 'the outside of the turn is higher than the inside (> 2 m over 16 m)');
check(dot(push(p.x, p.y), [-1, 0]) > 0, 'gravity on the bank pulls toward the infield');
check(L.heightAt(0, -75) === 0 && L.heightAt(0, 75) === 0, 'the straights are flat');

console.log('4. cost');
L.setLevel('naffcar');
const t0 = performance.now(); let z = 0;
for (let i = 0; i < 20000; i++) { const s = L.slopeAt(150 + (i % 70), (i % 50) - 25); z += s.gx; }
const us = ((performance.now() - t0) / 20000) * 1000;
console.log(`   slopeAt ${us.toFixed(1)} us per call (one per physics step)`);
check(us < 50, 'slope lookup under 50 us');
console.log(fails.length ? `\nFAIL (${fails.length})` : '\nTerrain: all OK');
process.exitCode = fails.length ? 1 : 0;
