// kerbcheck.mjs — is the edge a PHYSICS STATE or an animation?
//
// The user's test, in their words: "it should be more of a feeling that you feel it destabilizes the
// car as it goes like light and then heavy as it goes up and down over the bump. It should also be able
// to happen while turning or handbraking or anything else. It should be a physics change to the state
// of the car that temporarily occurs rather than like a jump that you make happen to it."
//
// So this checks four things, and nothing about jump timers, because there are none any more:
//   1. LIGHT THEN HEAVY — load must dip below 1 AND overshoot above 1, then settle.
//   2. SPEED-SCALED — a crawl over the kerb is nothing; a fast strike takes the wheels off the ground.
//   3. WORKS WHILE BUSY — the same strike mid-corner and mid-handbrake, with nothing suppressed.
//   4. TRANSIENT — it must be over. Load back to ~1, body back down, car still under control.
import { makeCar, step, reset, neutralInput, DT } from '../src/vehicle.js';
import { applyGround as edge, FLOOR, KERB_W, FENCE, LEVELS, setLevel, SURFACES } from '../src/lab.js';
// S-B (2026-10-06): the lab's south edge moved 480 m south (past the extension's off-road area), so the edge is measured on a BARE square
// lab floor - the same lab surface, kerb, verge and trap the old lab's south edge had at x 0, and nothing else
{ const lab = LEVELS.find((l) => l.id === 'lab');   // the old lab's quarters + its blend / inclusion patches; no extension, no bounds
  LEVELS.push({ id: 'edge-test', name: 'edge', base: SURFACES.lab, zones: lab.zones.filter((z) => !z.ext), bumps: [], paint: [], boards: [], cones: [], props: [], spawn: { x: 0, y: 0, heading: 0 }, _blend: lab._blend, _incl: lab._incl, _coversBase: lab._coversBase });
  setLevel('edge-test'); }
import { CAR_IDS } from '../src/cars.js';


// Approach the south kerb at `v` m/s, `deg` off perpendicular, doing `extra` throughout.
function strike(id, v, deg = 0, extra = {}) {
  const car = makeCar(id);
  const a = (deg * Math.PI) / 180;
  reset(car, 0, FLOOR - KERB_W - 25, Math.PI / 2 - a);
  car.vx = v * Math.sin(a); car.vy = v * Math.cos(a);
  car.gear = 3; car.rpm = 3500;
  const inp = { ...neutralInput(), ...extra };

  const r = { minLoad: 1, maxLoad: 1, air: 0, maxZ: 0, peakSlip: 0, minF: 1, minR: 1 };
  let onKerb = false; const order = [];
  for (let i = 0; i < 120 * 6; i++) {
    edge(car, DT);
    step(car, inp, DT);
    const out = Math.max(Math.abs(car.x), Math.abs(car.y));
    if (out > FLOOR - KERB_W - 0.5) {
      onKerb = true;
      if (car.loadK < 0.92 && !order.includes('light')) order.push('light');
      if (car.loadK > 1.08 && !order.includes('heavy')) order.push('heavy');
      r.minLoad = Math.min(r.minLoad, car.loadK);
      r.maxLoad = Math.max(r.maxLoad, car.loadK);
      r.maxZ = Math.max(r.maxZ, car.z);
      r.minF = Math.min(r.minF, car.t.loadKF); r.minR = Math.min(r.minR, car.t.loadKR);
      if (car.loadK <= 0) r.air += DT;
      const sp = Math.hypot(car.vx, car.vy);
      if (sp > 3) r.peakSlip = Math.max(r.peakSlip, Math.abs(Math.atan2(car.t.vLat, car.t.vLong) * 57.3));
    }
    if (out > FENCE - 1) break;
    if (onKerb && Math.hypot(car.vx, car.vy) < 1) break;
  }
  r.order = order.join('->') || 'none';
  r.settled = car.loadK;
  return r;
}

const F = (v, n = 2) => v.toFixed(n).padStart(n === 0 ? 4 : n + 3);

console.log('1. LIGHT THEN HEAVY, and how it scales with speed (hatch-rwd, straight at the kerb)');
console.log('   v m/s   load min   load max   FRONT min  REAR min   order          air s  body z m');
for (const v of [3, 8, 15, 22, 30, 42]) {
  const r = strike('hatch-rwd', v);
  console.log(`   ${F(v, 0)}     ${F(r.minLoad)}       ${F(r.maxLoad)}       ${F(r.minF)}      ${F(r.minR)}      ${r.order.padEnd(14)} ${F(r.air)}   ${F(r.maxZ)}`);
}

console.log('\n2. THE SAME STRIKE WHILE BUSY at 24 m/s — nothing suppressed, nothing special-cased');
const busy = [
  ['straight', {}],
  ['on the throttle', { throttle: 1 }],
  ['braking', { brake: 1 }],
  ['turning hard', { steer: 0.7 }],
  ['turning + braking', { steer: 0.7, brake: 0.8 }],
  ['handbrake sideways', { steer: 0.6, handbrake: 1 }],
];
console.log('   what                  load min   load max   order          air s   slip deg');
for (const [label, inp] of busy) {
  const r = strike('hatch-rwd', 24, 18, inp);
  console.log(`   ${label.padEnd(21)} ${F(r.minLoad)}       ${F(r.maxLoad)}      ${r.order.padEnd(14)} ${F(r.air)}    ${F(r.peakSlip, 1)}`);
}

console.log('\n3. EVERY CAR over the kerb at 24 m/s at a shallow angle (the way you really clip one)');
console.log('   car             load min   load max   order          air s   settled  slip deg');
for (const id of CAR_IDS) {
  const r = strike(id, 24, 55);
  console.log(`   ${id.padEnd(15)} ${F(r.minLoad)}       ${F(r.maxLoad)}      ${r.order.padEnd(14)} ${F(r.air)}    ${F(r.settled)}     ${F(r.peakSlip, 1)}`);
}

console.log('\n4. RUNNING ALONG the kerb, not across it — the ridges alone must shake it, scaled by speed');
console.log('   v m/s   load min   load max   swing');
for (const v of [5, 14, 25, 38]) {
  const car = makeCar('hatch-rwd');
  reset(car, 0, FLOOR - KERB_W / 2, 0);
  car.vx = v; car.gear = 3; car.rpm = 3500;
  const inp = { ...neutralInput() };
  let lo = 1, hi = 1;
  for (let i = 0; i < 120 * 5; i++) {
    car.y = FLOOR - KERB_W / 2; car.vy = 0;   // pinned on the strip: this is about the ridges only
    edge(car, DT); step(car, inp, DT);
    // MEASURED ARTIFACT: spawning ON the crest steps the ground 0 -> 0.10 m in one step, and the ring
    // decays over ~0.31 s (1/zeta*omega). Measuring from 0.25 s read that spawn, not the ridges: it
    // reported a 0.48 swing at a 5 m/s CRAWL. Settle for 2.5 s first.
    if (i > 300) { lo = Math.min(lo, car.loadK); hi = Math.max(hi, car.loadK); }
  }
  console.log(`   ${F(v, 0)}     ${F(lo)}       ${F(hi)}      ${F(hi - lo)}`);
}

console.log('\n5. TRANSIENT: 1.5 s after a 30 m/s strike, is the car back to normal?');
{
  const car = makeCar('hatch-rwd');
  reset(car, 0, FLOOR - KERB_W - 20, Math.PI / 2);
  car.vy = 30; car.gear = 3; car.rpm = 3500;
  const inp = { ...neutralInput() };
  let crossed = -1;
  for (let i = 0; i < 120 * 6; i++) {
    edge(car, DT); step(car, inp, DT);
    if (crossed < 0 && Math.abs(car.y) > FLOOR) crossed = i;
    if (crossed > 0 && i === crossed + 180) {
      console.log(`   load ${car.loadK.toFixed(3)}   body z ${car.z.toFixed(3)} m   zvF ${car.zvF.toFixed(3)} m/s   (want load ~1, z ~0)`);
      break;
    }
  }
}
