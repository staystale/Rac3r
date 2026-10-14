// phase1check.mjs — verify Phase 1 mechanics:
// 1. New surfaces (racetarmac, dirt, grassLong, grassShort)
// 2. Subtrack generation & recovery
// 3. Dynamic surface degradation (grassLong -> grassShort -> dirt -> mud)
// 4. Fence collision wedging protection

import { SURFACES, createSubtrack, findNearestSubtrackPoint, recordWearAt, getWornSurface, clearWear, fenceClamp, groundAt, setLevel, LEVELS, FLOOR, FENCE } from '../src/lab.js';
import { makeCar, reset, step, neutralInput, PHYSICS_STEP_SECONDS } from '../src/vehicle.ts';

console.log('=== PHASE 1 VERIFICATION ===\n');

// 1. Verify New Surfaces
console.log('1. Checking new surfaces...');
const required = ['racetarmac', 'dirt', 'grassLong', 'grassShort'];
for (const id of required) {
  const s = SURFACES[id];
  if (!s) throw new Error(`Missing surface: ${id}`);
  console.log(`   ${s.label.padEnd(16)} mu=${s.mu} peakK=${s.peakK} longK=${s.longK} rough=${s.rough}`);
}
console.log('   New surfaces defined: OK\n');

// 2. Subtrack & Recovery Test
console.log('2. Checking subtrack & recovery...');
const testApexes = [[0, 0], [100, 0], [100, 50], [0, 50]];
const sub = createSubtrack(testApexes, 12);
if (sub.pts.length < 20) throw new Error('Subtrack points failed to generate');
console.log(`   Subtrack generated with ${sub.pts.length} sampled points, total length = ${sub.totalDist.toFixed(1)} m`);

// Car drives off track at [50, 15] (track is near y=0)
const pt = findNearestSubtrackPoint(sub, 50, 15, 60);
if (!pt) throw new Error('findNearestSubtrackPoint returned null');
console.log(`   Nearest recovery point from [50, 15]: [${pt.x.toFixed(1)}, ${pt.y.toFixed(1)}], heading = ${(pt.heading*57.3).toFixed(1)} deg`);
if (Math.abs(pt.x - 50) > 6.0) throw new Error(`Recovery point x coordinate unexpectedly far: ${pt.x}`);
console.log('   Subtrack recovery: OK\n');

// 3. Dynamic Degradation Test
console.log('3. Checking surface degradation...');
// CORRECTED 2026-10-03: this used to wear point (12,12) while CLAIMING it was long grass — it is lab tarmac —
// and checked the old duplicate rule table (mud at 8) that the game never used. It now wears the REAL long
// grass test panel through lab.js's one rule table: short @2, dirt @4, mud @6 (tools/wearcheck.mjs has more).
setLevel('lab');
clearWear();
const wx = -143, wy = -106;

let tMs = 1000;
// Pass 1-2 on grassLong -> should turn into grassShort
recordWearAt(wx, wy, 'grassLong', tMs); tMs += 500;
recordWearAt(wx, wy, 'grassLong', tMs); tMs += 500;

let worn = getWornSurface(wx, wy);
console.log(`   After 2 passes on long grass: ${worn ? worn.label : 'none'}`);
if (worn.id !== 'grassShort') throw new Error(`Expected grassShort, got ${worn.id}`);

// 2 more passes -> should become dirt (total 4)
for (let p = 0; p < 2; p++) {
  recordWearAt(wx, wy, 'grassLong', tMs); tMs += 500;
}
worn = getWornSurface(wx, wy);
console.log(`   After 4 total passes: ${worn ? worn.label : 'none'}`);
if (worn.id !== 'dirt') throw new Error(`Expected dirt, got ${worn.id}`);

// 2 more passes -> should become mud (total 6)
for (let p = 0; p < 2; p++) {
  recordWearAt(wx, wy, 'grassLong', tMs); tMs += 500;
}
worn = getWornSurface(wx, wy);
console.log(`   After 6 total passes: ${worn ? worn.label : 'none'}`);
if (worn.id !== 'mud') throw new Error(`Expected mud, got ${worn.id}`);
clearWear();
console.log('   Degradation cycle: OK\n');

// 4. Fence Clamping Wedging Test
console.log('4. Checking fence wedging protection...');
const car = makeCar('hatch-rwd');
reset(car, FENCE - 1.0, 0, 0); // nose right against fence
car.vx = 25; // ramming right into fence at 90 km/h
fenceClamp(car);
console.log(`   After ramming fence: car.x = ${car.x.toFixed(2)}, limit = ${(FENCE - Math.max(car.spec.wid, car.spec.len)*0.48).toFixed(2)}, vx = ${car.vx.toFixed(2)}`);
if (car.vx >= 0) throw new Error('Fence did not reflect velocity outward');
if (car.x >= FENCE) throw new Error('Car penetrated through fence');
console.log('   Fence anti-wedging: OK\n');

// 5. Test Track Level Exists
console.log('5. Checking Test Track level...');
const tt = LEVELS.find(l => l.id === 'test-track');
if (!tt) throw new Error('test-track level not found');
console.log(`   Found level "${tt.name}" with ${tt.zones.length} zones and ${tt.cones.length} cones.`);
console.log('   Test Track level: OK\n');

console.log('ALL PHASE 1 CHECKS PASSED!');
