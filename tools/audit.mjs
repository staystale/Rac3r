// audit.mjs — FUDGE AUDIT. The chassis validates against the closed-form bicycle model to 2.6%, so the
// rig is right. Everything bolted on TOP of it has to re-earn its place, especially now the integration
// bug (which several of these were compensating for) is fixed.
//
// For each soft term: switch it off, then check BOTH stability and the grip actually achieved. Anything
// that can go without the car spinning should go — and each one that goes should hand grip back.
import { makeCar, step, reset, neutralInput, DT, TUNE } from '../src/vehicle.ts';
import { CAR_IDS } from '../src/cars.ts';
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

// Sustained cornering grip: settle into a steady corner and average the lateral g actually achieved.
function grip(id) {
  const car = makeCar(id);
  reset(car, 0, 0, 0);
  car.vx = 25; car.gear = 3; car.rpm = 4000;
  const inp = { ...neutralInput(), steer: 0.55 };
  let sum = 0, n = 0;
  for (let i = 0; i < 120 * 5; i++) {
    const sp = Math.hypot(car.vx, car.vy);
    inp.throttle = clamp((25 - sp) * 0.3, 0, 0.7);
    step(car, inp, DT);
    if (i > 120 * 2.5) { sum += Math.abs(car.t.ay) / 9.81; n++; }
  }
  return sum / n;
}

// Turn-in: how much yaw does a firm input actually buy? Low = "it pushes on".
function turnIn(id) {
  const car = makeCar(id);
  reset(car, 0, 0, 0);
  car.vx = 25; car.gear = 3; car.rpm = 4000;
  const inp = { ...neutralInput(), steer: 0.8, throttle: 0.3 };
  let peak = 0;
  for (let i = 0; i < 120 * 3; i++) { step(car, inp, DT); peak = Math.max(peak, Math.abs(car.yawRate)); }
  return peak;
}

// Does it spin? Coast fast with a firm input.
function spin(id) {
  const car = makeCar(id);
  reset(car, 0, 0, 0);
  car.vx = 45; car.gear = Math.min(5, car.spec.gears.length); car.rpm = 5500;
  const inp = { ...neutralInput(), steer: 0.8 };
  let peak = 0, back = 0;
  for (let i = 0; i < 120 * 6; i++) {
    step(car, inp, DT);
    if (Math.hypot(car.vx, car.vy) > 3) peak = Math.max(peak, Math.abs(Math.atan2(car.t.vLat, car.t.vLong) * 57.3));
    back = Math.min(back, car.t.vLong);
    if (Math.hypot(car.vx, car.vy) < 1) break;
  }
  return { peak, back };
}

function row(label) {
  let worst = 0, bad = 0, g = 0, ti = 0;
  for (const id of CAR_IDS) {
    const s = spin(id);
    worst = Math.max(worst, s.peak);
    if (s.back < -0.5) bad++;
    g += grip(id); ti += turnIn(id);
  }
  console.log(
    `${label.padEnd(36)} spin ${worst.toFixed(0).padStart(3)}deg ${bad}/5 back   grip ${(g / 5).toFixed(2)}g   turn-in ${(ti / 5).toFixed(2)}`
  );
}

const base = { selfAlign: TUNE.selfAlign, yawDamp: TUNE.yawDamp, highSlipFade: TUNE.highSlipFade, loadSens: TUNE.loadSens };
const set = (o) => Object.assign(TUNE, base, o);

set({}); row('as shipped');
set({ highSlipFade: 0 }); row('  highSlipFade OFF');
set({ selfAlign: 0 }); row('  selfAlign OFF');
set({ yawDamp: 0 }); row('  yawDamp OFF');
set({ loadSens: 0.15 }); row('  loadSens 0.35 -> 0.15');
set({ highSlipFade: 0, loadSens: 0.15 }); row('  highSlipFade OFF + loadSens 0.15');
set({ highSlipFade: 0, loadSens: 0.15, selfAlign: 0 }); row('  ...and selfAlign OFF');
set({ highSlipFade: 0, loadSens: 0.15, selfAlign: 0, yawDamp: 0 }); row('  ...and yawDamp OFF (nothing left)');
set({});
