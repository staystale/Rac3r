// probe.mjs — THE INSTRUMENT. Headless physics bench. Node, no canvas, no DOM.
//
// This exists BEFORE the renderer on purpose (PLAN.md Step 1 / CLAUDE.md §8): eight components x ten
// pips x five cars is a tuning space no amount of driving can cover, so every change has to be
// answerable with a number.
//
// It is also the CLAUDE.md rule 1 detector for the whole slice: hatch-fwd and hatch-rwd differ by ONE
// number (`drive`). If they come back with the same skidpad speed and the same handbrake yaw, the
// per-axle drive split is not wired up and no amount of tuning will fix it.
//
//   node tools/probe.mjs            all five cars, all benches
//   node tools/probe.mjs hatch-rwd  one car

import { makeCar, step, reset, assertFinite, neutralInput, DT } from '../src/vehicle.js';
import { CAR_IDS } from '../src/cars.js';

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

function setSpeed(car, v) {
  car.vx = v * Math.cos(car.heading);
  car.vy = v * Math.sin(car.heading);
  // settle the rpm to match so the first step is not a gearchange
  const s = car.spec;
  car.gear = 1;
  for (let i = 0; i < 5; i++) {
    let g = car.gear;
    const r = (Math.abs(v) / s.wheelR) * Math.abs(s.gears[g - 1]) * s.finalDrive * 60 / (2 * Math.PI);
    if (r > s.upshiftRpm && g < s.gears.length) car.gear++;
    else break;
  }
  const gr = s.gears[car.gear - 1] * s.finalDrive;
  car.rpm = clamp((Math.abs(v) / s.wheelR) * gr * 60 / (2 * Math.PI), s.idleRpm, s.redline);
}

// ---------- bench 1: standing acceleration, 0 -> 27 m/s. Target 9-11 s (stock hatch).
function benchAccel(car) {
  reset(car, 0, 0, 0);
  const inp = { ...neutralInput(), throttle: 1 };
  let t = 0, topSpeed = 0;
  let t100 = null;
  while (t < 40) {
    step(car, inp, DT); assertFinite(car); t += DT;
    const v = Math.hypot(car.vx, car.vy);
    topSpeed = Math.max(topSpeed, v);
    if (t100 === null && v >= 27) t100 = t;
    if (t100 !== null && t > t100 + 8) break;
  }
  // separate long run for terminal velocity
  reset(car, 0, 0, 0); let vmax = 0;
  for (let i = 0; i < 120 * 90; i++) { step(car, inp, DT); vmax = Math.max(vmax, Math.hypot(car.vx, car.vy)); }
  assertFinite(car);
  return { t27: t100, vmax };
}

// ---------- bench 2: braking from 27.8 m/s (100 km/h), full brake. Target 38-45 m, tyres locked.
function benchBrake(car) {
  reset(car, 0, 0, 0);
  setSpeed(car, 27.8);
  const inp = { ...neutralInput(), brake: 1 };
  const x0 = car.x;
  let t = 0, lockedFrames = 0, frames = 0, peakDecel = 0, vPrev = 27.8;
  while (t < 10) {
    step(car, inp, DT); assertFinite(car); t += DT; frames++;
    const v = Math.hypot(car.vx, car.vy);
    // Window the decel sample. The first 0.15 s is the load-transfer transient and the last metre is
    // the low-speed rest-snap; both read as an impossible spike. The 2.55 g in the first grid was the
    // rest-snap, not the brakes (CLAUDE.md rule 15 — the bench lied before the model did).
    if (t > 0.15 && v > 1.5) peakDecel = Math.max(peakDecel, (vPrev - v) / DT);
    vPrev = v;
    if (car.t.lockedF || car.t.lockedR) lockedFrames++;
    if (v < 0.2) break;
  }
  // MEASURED BUG in this bench, 2026-09-27: `dist` was computed as `car.x - x0` in the return
  // statement, i.e. AFTER the threshold run below had already reset the car and driven it — so both
  // columns printed the threshold distance and read identical for all five cars. Latch it here.
  // (CLAUDE.md rule 1, committed by the instrument itself.)
  const fullDist = car.x - x0;

  // THRESHOLD BRAKING SWEEP. Find the pedal position that actually stops shortest. If the optimum is
  // 1.0, lock-up costs nothing and the skid marks are decoration; if it is below 1.0, "don't stamp on
  // it" is a real skill the player can learn, and the marks are what teach it.
  let bestD = Infinity, bestPedal = 1;
  for (let pedal = 0.5; pedal <= 1.0001; pedal += 0.05) {
    reset(car, 0, 0, 0);
    setSpeed(car, 27.8);
    const thr = { ...neutralInput(), brake: pedal };
    const xT = car.x;
    let tt = 0;
    while (tt < 15) {
      step(car, thr, DT); assertFinite(car); tt += DT;
      if (Math.hypot(car.vx, car.vy) < 0.2) break;
    }
    const d = car.x - xT;
    if (d < bestD) { bestD = d; bestPedal = +pedal.toFixed(2); }
  }
  return {
    dist: fullDist, time: t, lockedPct: (100 * lockedFrames) / frames, peakG: peakDecel / 9.81,
    threshDist: bestD, threshPedal: bestPedal,
  };
}

// ---------- bench 3: peak steady-state lateral g. Target 0.85-1.00 g for a mu 1.0 car.
//
// OPEN LOOP on purpose. The first cut used a P controller to hold a 40 m radius and reported 0.49 g for
// a mu=1.0 car — because it was measuring the CONTROLLER hunting, not the car's limit (CLAUDE.md rule
// 15: verify the mechanism the benchmark depends on). A fixed steering angle at a fixed speed settles
// into the car's own natural radius, and the peak over a steer sweep is the real number.
function benchLateral(car) {
  let best = 0, bestAt = null;
  for (const v of [12, 16, 20, 24, 28, 32]) {
    for (let st = 0.1; st <= 1.0001; st += 0.1) {
      reset(car, 0, 0, 0);
      setSpeed(car, v);
      const inp = neutralInput();
      // MEASURED BUG, 2026-09-27 (second one in this bench): this averaged the LAST 40% of a 6 s run
      // and reported 0.5 g. The dump showed the car pulling 0.87-0.91 g at t=0.4-0.8 s with both axles
      // saturated, then scrubbing from 16 m/s to 2.6 m/s — so the average was the tail of a spin-down,
      // not a steady state. Take the PEAK while the car is still grip-limited rather than spun.
      let peak = 0;
      const steps = Math.round(4 / DT);
      for (let i = 0; i < steps; i++) {
        inp.steer = st;
        const sp = Math.hypot(car.vx, car.vy);
        inp.throttle = clamp((v - sp) * 0.3, 0, 1);      // hold speed against cornering scrub
        step(car, inp, DT);
        if (!Number.isFinite(car.x)) break;
        const beta = Math.abs(Math.atan2(car.t.vLat, Math.abs(car.t.vLong)));
        if (beta > 0.44) break;                          // >25 deg of body slip: spun, not cornering
        // v*yawRate overstates during a snap (yaw spikes before the velocity vector turns) and read
        // 1.95 g on a mu=1.0 car. The tyre-derived body lateral accel is bounded by mu*g by construction.
        const lat = Math.abs(car.t.ay) / 9.81;
        if (i > 24 && lat > peak) peak = lat;            // skip the first 0.2 s transient
      }
      if (peak > best) { best = peak; bestAt = { v, st: +st.toFixed(1) }; }
    }
  }
  return { lat: best, at: bestAt };
}

// ---------- bench 4: handbrake turn, 15 m/s, full lock + handbrake. Target >=90 deg in <=1.2 s.
function benchHandbrake(car) {
  reset(car, 0, 0, 0);
  setSpeed(car, 15);
  const h0 = car.heading;
  const inp = { ...neutralInput(), steer: 1, handbrake: true, throttle: 0 };
  let t = 0, t90 = null, maxYaw = 0;
  while (t < 4) {
    step(car, inp, DT); assertFinite(car); t += DT;
    const yaw = Math.abs(car.heading - h0) * 180 / Math.PI;
    maxYaw = Math.max(maxYaw, yaw);
    if (t90 === null && yaw >= 90) t90 = t;
    if (t90 !== null) break;
  }
  // recovery: release everything and steer straight; can it be caught within 3 s?
  const rec = { ...neutralInput(), throttle: 0.2 };
  let recovered = false;
  for (let i = 0; i < 120 * 3; i++) {
    rec.steer = clamp(-car.t.vLat * 0.3, -1, 1);   // counter-steer toward the slide
    step(car, rec, DT); assertFinite(car);
    if (Math.abs(car.t.vLat) < 1.0 && Math.abs(car.yawRate) < 0.25 && Math.hypot(car.vx, car.vy) > 3) { recovered = true; break; }
  }
  return { t90, maxYaw, recovered };
}

// ---------- bench 6: POWER-ON OVERSTEER. The real rule 1 detector for this slice.
//
// lat g and the handbrake test CANNOT tell the five cars apart, and that is correct physics, not a bug:
// lat g is bounded by mu, and the handbrake bench runs at zero throttle, where drive layout is
// irrelevant. The one thing that depends on `drive` is what happens when you ask for power mid-corner.
//
// Settle into a steady corner at 15 m/s, then floor it and measure the change in BODY SLIP ANGLE over
// 2 s. Positive = the tail came out (oversteer). Negative = it pushed wide (understeer).
// Expected: muscle >> hatch-rwd > estate-4x4 > 0 > hatch-fwd. If they all come back the same, the
// per-axle drive split is not wired up and nothing else in this slice matters (PLAN.md).
function benchPowerOn(car) {
  reset(car, 0, 0, 0);
  setSpeed(car, 15);
  const inp = { ...neutralInput(), steer: 0.35, throttle: 0.15 };
  // settle 1.5 s at a steady moderate corner
  for (let i = 0; i < Math.round(1.5 / DT); i++) {
    const sp = Math.hypot(car.vx, car.vy);
    inp.throttle = clamp((15 - sp) * 0.3, 0, 0.5);
    step(car, inp, DT); assertFinite(car);
  }
  const beta0 = Math.atan2(car.t.vLat, Math.abs(car.t.vLong));
  // now floor it, same steering lock
  inp.throttle = 1;
  let betaPeak = beta0, yawPeak = Math.abs(car.yawRate);
  for (let i = 0; i < Math.round(2.0 / DT); i++) {
    step(car, inp, DT); assertFinite(car);
    const b = Math.atan2(car.t.vLat, Math.abs(car.t.vLong));
    if (Math.abs(b) > Math.abs(betaPeak)) betaPeak = b;
    yawPeak = Math.max(yawPeak, Math.abs(car.yawRate));
  }
  // sign convention: steering right (+) makes vLat negative, so a growing |beta| with the same sign as
  // the initial slide is the tail coming out. Report the magnitude change in degrees.
  return { dBeta: (Math.abs(betaPeak) - Math.abs(beta0)) * 180 / Math.PI, yawPeak };
}

// ---------- bench 5: fuzz. 60 s of random inputs. Zero non-finite values, car still on the floor.
function benchFuzz(car, seed = 12345) {
  reset(car, 0, 0, 0);
  let s = seed;
  const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const inp = neutralInput();
  let bad = 0, maxDist = 0;
  const steps = Math.round(60 / DT);
  for (let i = 0; i < steps; i++) {
    if (i % 24 === 0) {
      inp.steer = rnd() * 2 - 1;
      inp.throttle = rnd();
      inp.brake = rnd() > 0.7 ? rnd() : 0;
      inp.handbrake = rnd() > 0.85;
    }
    step(car, inp, DT);
    try { assertFinite(car); } catch { bad++; break; }
    maxDist = Math.max(maxDist, Math.hypot(car.x, car.y));
  }
  return { bad, maxDist };
}

// ---------- run
const only = process.argv[2];
const ids = only ? [only] : CAR_IDS;
const rows = [];

for (const id of ids) {
  const car = makeCar(id);
  const a = benchAccel(car);
  const b = benchBrake(car);
  const sk = benchLateral(car);
  const hb = benchHandbrake(car);
  const po = benchPowerOn(car);
  const fz = benchFuzz(car);
  rows.push({
    id,
    mass: car.spec.mass,
    drive: car.spec.drive === 1 ? 'FWD' : car.spec.drive === 0 ? 'RWD' : '4WD',
    t27: a.t27 === null ? null : +a.t27.toFixed(2),
    vmax: +a.vmax.toFixed(1),
    brakeM: +b.dist.toFixed(1),
    brakeG: +b.peakG.toFixed(2),
    lockPct: Math.round(b.lockedPct),
    thrM: +b.threshDist.toFixed(1),
    thrPed: b.threshPedal,
    latAt: sk.at ? sk.at.v + "/" + sk.at.st : "-",
    padG: +sk.lat.toFixed(2),
    hbT90: hb.t90 === null ? null : +hb.t90.toFixed(2),
    hbYaw: Math.round(hb.maxYaw),
    hbRec: hb.recovered,
    powerOn: +po.dBeta.toFixed(1),
    fuzzBad: fz.bad,
  });
}

const W = {
  id: 12, drive: 5, mass: 5, t27: 7, vmax: 7, brakeM: 8, brakeG: 7, lockPct: 6, thrM: 7, thrPed: 7,
  padG: 6, hbT90: 7, hbYaw: 6, hbRec: 5, powerOn: 8, fuzzBad: 5,
};
const HEAD = {
  id: 'car', drive: 'drv', mass: 'kg', t27: '0-27s', vmax: 'vmax', brakeM: 'brake m', brakeG: 'brk g',
  lockPct: 'lock%', thrM: 'best m', thrPed: 'bestPed', padG: 'lat g', hbT90: 'hb t90', hbYaw: 'hb deg', hbRec: 'rec', powerOn: 'pwrOn d', fuzzBad: 'NaN',
};
const pad = (v, n) => String(v === null ? '—' : v === true ? 'yes' : v === false ? 'NO' : v).padStart(n);

console.log('\nBENCH GRID — five cars, five benches. Fixed step ' + (1 / DT).toFixed(0) + ' Hz.\n');
console.log(Object.keys(W).map((k) => pad(HEAD[k], W[k])).join(' '));
console.log(Object.keys(W).map((k) => '-'.repeat(W[k])).join(' '));
for (const r of rows) console.log(Object.keys(W).map((k) => pad(r[k], W[k])).join(' '));

console.log('\nTargets (stock hatch): 0-27 in 5-7 s | brake 30-38 m locked | lat 1.1-1.3 g | NaN 0');
console.log('REVISED 2026-09-27 by playtest. 0-27 was 9-11 s until the user said the car was too slow.');
console.log('lat g was 0.85-1.00 until they said grip was too low. And hb t90 ("90 deg within 1.2 s") is');
console.log('retired: raising yaw inertia to hold momentum deliberately costs rotation, so a handbrake');
console.log('turn now yaws ~74 deg and KEEPS 61% of its speed rather than yawing 90 and keeping 32%.');
console.log('pwrOn d = degrees of body slip ADDED by flooring it mid-corner: + tail out, - pushes wide.');

// rule 1 detector
const fwd = rows.find((r) => r.id === 'hatch-fwd'), rwd = rows.find((r) => r.id === 'hatch-rwd');
if (fwd && rwd) {
  const same = Math.abs(fwd.powerOn - rwd.powerOn) < 0.5;
  console.log(
    same
      ? '\n*** RULE 1 ALARM: the FWD and RWD hatches respond IDENTICALLY to mid-corner power. The per-axle drive split is NOT wired up. Do not tune. ***'
      : `\nrule 1 check OK — mid-corner power adds ${fwd.powerOn} deg of body slip to the FWD hatch vs ${rwd.powerOn} deg to the RWD hatch`
  );
}
console.log('');
