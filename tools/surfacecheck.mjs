// surfacecheck.mjs — do the surfaces differ REALISTICALLY, or just in grip?
//
// User, 2026-09-28: "we should have road surfaces - tarmac - the lab - gravel - grass. They should all
// affect driving conditions differently and realistically" and "gravel should be a loose rally surface
// - better with softer tyres medium suspension and plenty of power".
//
// The trap to avoid is a surface system that is one number. If gravel is only "less mu" it feels like
// WET TARMAC — vague and slippery — instead of loose. The test for "loose" is the SLIP ANGLE AT PEAK
// GRIP: on tarmac you must be within a few degrees or you are losing time; on gravel the peak is way
// out at 15-25 deg, which is what lets you point the car with the throttle. So this measures the whole
// grip-versus-slip-angle curve on each surface, not just its maximum.
import { makeCar, step, reset, neutralInput, DT } from '../src/vehicle.js';
import { SURFACES, groundAt, applyGround, ZONES, FLOOR, FENCE, FY1 } from '../src/lab.js';
import { CAR_IDS } from '../src/cars.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

// Hold a steady speed and a fixed steering angle on a pinned surface, and report the lateral g reached
// and the body slip angle it took to get there.
function steady(id, surf, steer, v = 25) {
  const car = makeCar(id);
  reset(car, 0, 0, 0);
  car.vx = v; car.gear = 3; car.rpm = 4000;
  const inp = { ...neutralInput(), steer };
  let g = 0, beta = 0, n = 0;
  for (let i = 0; i < 120 * 6; i++) {
    car.surface = surf;
    car.groundF = car.groundR = 0; car.groundVF = car.groundVR = 0;
    const sp = Math.hypot(car.vx, car.vy);
    inp.throttle = clamp((v - sp) * 0.3, 0, 1);
    step(car, inp, DT);
    if (i > 120 * 3) {                     // settled
      g += Math.abs(car.t.ay) / 9.81;
      beta += Math.abs(Math.atan2(car.t.vLat, car.t.vLong) * 57.3);
      n++;
    }
  }
  return { g: g / n, beta: beta / n };
}

// Sweep the steering and find where lateral g actually PEAKS, and at what slip angle.
function peak(id, surf) {
  let best = { g: 0, beta: 0, steer: 0 };
  for (let st = 0.08; st <= 1.0; st += 0.04) {
    const r = steady(id, surf, st);
    if (r.g > best.g) best = { ...r, steer: st };
  }
  return best;
}

function brake(id, surf, v = 28) {
  const car = makeCar(id);
  reset(car, 0, 0, 0);
  car.vx = v; car.gear = 4; car.rpm = 4000;
  const inp = { ...neutralInput(), brake: 1 };
  let t = 0;
  while (Math.hypot(car.vx, car.vy) > 0.5 && t < 20) {
    car.surface = surf;
    car.groundF = car.groundR = 0; car.groundVF = car.groundVR = 0;
    step(car, inp, DT); t += DT;
  }
  return Math.hypot(car.x, car.y);
}

// SPEED REACHED IN 15 s FROM REST, not 0-100. MEASURED BUG IN THIS HARNESS, 2026-09-28: it timed 0-100
// km/h and printed '--' for anything that never got there, which on mud, sand, snow and ice is most of
// them. '--' cannot tell 'crawls out at 40 km/h' from 'cannot move at all', and those are completely
// different bugs — the second one is what the user was actually hitting. Report the speed, not a verdict.
function topIn(id, surf, secs = 15) {
  const car = makeCar(id);
  reset(car, 0, 0, 0);
  car.gear = 1; car.rpm = 1000;
  const inp = { ...neutralInput(), throttle: 1 };
  for (let i = 0; i < 120 * secs; i++) {
    car.surface = surf;
    car.groundF = car.groundR = 0; car.groundVF = car.groundVR = 0;
    step(car, inp, DT);
  }
  return Math.hypot(car.vx, car.vy) * 3.6;
}

const F = (v, n = 2) => (Number.isFinite(v) ? v.toFixed(n) : ' -- ').padStart(n + 4);
const ORDER = ['lab', 'tarmac', 'wet', 'broken', 'gravel', 'sand', 'grass', 'mud', 'snow', 'ice'];

console.log('THE SURFACE TABLE');
console.log('   surface    mu    peakK  plough  rough');
for (const k of ORDER) {
  const s = SURFACES[k];
  console.log(`   ${k.padEnd(9)} ${F(s.mu)}  ${F(s.peakK)}   ${F(s.plough, 1)}  ${s.rough.toFixed(3)}`);
}

console.log('\n1. PEAK GRIP AND THE SLIP ANGLE IT TAKES (hatch-rwd at 25 m/s).');
console.log('   The slip angle is the whole point: a low number means you must be precise, a high one');
console.log('   means you steer it on the throttle. If these were all ~7 deg, gravel would be wet tarmac.');
console.log('   surface    peak g    slip at peak   brake 28->0    km/h after 15 s flat out');
for (const k of ORDER) {
  const s = SURFACES[k];
  const p = peak('hatch-rwd', s);
  console.log(`   ${k.padEnd(9)} ${F(p.g)} g   ${F(p.beta, 1)} deg      ${F(brake('hatch-rwd', s), 1)} m     ${F(topIn('hatch-rwd', s), 0)} km/h`);
}

console.log('\n2. HOW MUCH OVERSTEER EACH SURFACE TOLERATES — lateral g still available at a big angle.');
console.log('   Fixed 0.75 of lock at 25 m/s. On tarmac that is past the limit and the car is just');
console.log('   scrubbing; on gravel it should still be pulling.');
console.log('   surface    g at 0.75 lock   body slip     vs its own peak');
for (const k of ORDER) {
  const s = SURFACES[k];
  const p = peak('hatch-rwd', s);
  const r = steady('hatch-rwd', s, 0.75);
  console.log(`   ${k.padEnd(9)} ${F(r.g)} g          ${F(r.beta, 1)} deg     ${F((r.g / p.g) * 100, 0)}% of peak`);
}

console.log('\n3. EVERY CAR, lab floor vs rally gravel — how much of its grip does it keep?');
console.log('   car             on the lab floor        on rally gravel        ratio kept');
for (const id of CAR_IDS) {
  const a = peak(id, SURFACES.lab);
  const b = peak(id, SURFACES.gravel);
  console.log(`   ${id.padEnd(15)} ${F(a.g)} g at ${F(a.beta, 1)} deg   ${F(b.g)} g at ${F(b.beta, 1)} deg   ${F((b.g / a.g) * 100, 0)}%`);
}

// MEASURED BUG IN THIS HARNESS, 2026-09-28: every test above PINS the surface and zeroes car.groundF and
// car.groundR each step. That is right for characterising mu and peakK, but it means `rough` never acts —
// the suspension is never asked to do anything, so the rally car and the track car both scored ~61%, i.e.
// indistinguishable. The one property meant to separate them was switched off by the instrument.
// This drives the REAL quadrant through applyGround, roughness and all.
console.log('\n3b. SOFT SPRINGS ON ROUGH GROUND — the same gravel, but with the surface texture LIVE.');
console.log('    Circling inside the gravel quadrant, so roughness actually reaches the suspension.');
console.log('    car             susF   mean g   worst load dip   a wheel off the ground');
{
  const stage = ZONES.find((q) => q.surface.id === 'gravel');
  const cx = stage.x, cy = stage.y;
  for (const id of CAR_IDS) {
    const car = makeCar(id);
    reset(car, cx - 55, cy, Math.PI / 2);
    car.vx = 0; car.vy = 24; car.gear = 3; car.rpm = 4000;
    const inp = { ...neutralInput(), steer: 0.42 };
    let g = 0, n = 0, dip = 1, air = 0;
    for (let i = 0; i < 120 * 10; i++) {
      applyGround(car, DT);
      const sp = Math.hypot(car.vx, car.vy);
      inp.throttle = clamp((24 - sp) * 0.3, 0, 1);
      step(car, inp, DT);
      if (i > 120 * 2) {
        g += Math.abs(car.t.ay) / 9.81; n++;
        dip = Math.min(dip, Math.min(car.t.loadKF, car.t.loadKR));
        if (car.t.loadKF <= 0 || car.t.loadKR <= 0) air += DT;
      }
    }
    console.log(`    ${id.padEnd(15)} ${F(car.spec.susF)}  ${F(g / n)} g   ${F(dip)}            ${F(air, 2)} s`);
  }
}

console.log('\n4. WHERE THE SURFACES ARE — the layout the physics actually reads.');
for (const [x, y, label] of [
  [-130, 130, 'SW: lab'], [130, 130, 'SE: tarmac'], [130, -130, 'NE: gravel'],
  [-130, -130, 'NW: grass'], [0, FY1 - 1.5, 'kerb crest'], [0, FY1 + 4, 'grass verge'],   // S-B: the floor's south edge is FY1 (740 on the lab)
  [0, FY1 + 20, 'trap, shallow'], [0, FY1 + 40, 'trap, deep'],
]) {
  const g = groundAt(x, y);
  console.log(`   ${label.padEnd(15)} ${g.surface.id.padEnd(7)} mu ${F(g.surface.mu)}  peakK ${F(g.surface.peakK || 1)}` +
              `  plough ${F(g.surface.plough || 0, 1)}  h ${g.h.toFixed(3)} m  marks ${g.surface.mark ? 'yes' : 'no'}`);
}
