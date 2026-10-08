// validate.mjs — check the model against the CLOSED-FORM bicycle model, not against opinion.
//
// In the linear region a bicycle model has an exact steady-state solution:
//   understeer gradient  K = W_f/C_f - W_r/C_r        (rad)
//   steady yaw rate      r = V*delta / (L + K*V^2/g)
//   steady lateral acc   ay = V*r
// If the simulation does not reproduce these at small slip angles, something is wrong in the rig
// itself and no amount of tuning will fix it. This is the test that says "the physics is right".
import { makeCar, step, reset, neutralInput, DT, TUNE } from '../src/vehicle.js';
import { CAR_IDS } from '../src/cars.js';
const G = 9.81;

// Use a small steering INPUT and read back the road-wheel angle the model actually settled on, then
// compare against theory computed with that same angle. (Pinning car.delta after the step does not
// work: the next step recomputes it from input.steer and drives it back to zero.)
function measured(id, V, steerIn) {
  const car = makeCar(id);
  reset(car, 0, 0, 0);
  car.vx = V; car.gear = 3; car.rpm = 4000;
  const inp = { ...neutralInput(), steer: steerIn };
  let rSum = 0, dSum = 0, aySum = 0, n = 0;
  for (let i = 0; i < 120 * 6; i++) {
    const sp = Math.hypot(car.vx, car.vy);
    inp.throttle = Math.max(0, Math.min(0.5, (V - sp) * 0.3));
    step(car, inp, DT);
    if (i > 120 * 4) { rSum += car.yawRate; dSum += car.delta; aySum += car.t.ay; n++; }
  }
  return { r: rSum / n, delta: dSum / n, ay: aySum / n };
}

console.log('Steady-state yaw rate vs the closed-form bicycle model, small steer (linear region)\n');
console.log('car            V    delta   r measured   r theory   error');
let worst = 0;
for (const id of CAR_IDS) {
  const s = makeCar(id).spec;
  const Wf = s.mass * G * s.lr / s.L, Wr = s.mass * G * s.lf / s.L;
  const K = Wf / s.caF - Wr / s.caR;
  for (const V of [15, 25]) {
    const m = measured(id, V, 0.10);           // small input; read back the angle it settled on
    const delta = m.delta;
    const theory = V * delta / (s.L + K * V * V / G);
    const err = 100 * (m.r - theory) / theory;
    worst = Math.max(worst, Math.abs(err));
    console.log(`${id.padEnd(13)} ${String(V).padStart(2)}   ${delta.toFixed(3)}   ${m.r.toFixed(4).padStart(9)}   ${theory.toFixed(4).padStart(8)}   ${err >= 0 ? '+' : ''}${err.toFixed(1)}%`);
  }
}
console.log(`\nworst error ${worst.toFixed(1)}%  —  under ~10% means the chassis reproduces the textbook model`);
