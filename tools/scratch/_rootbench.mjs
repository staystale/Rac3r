// _rootbench.mjs - the DRIVING ROOT FIX bench (?wheelspin=1): the same runs with the switch off
// and on, in one process (FIX.wheelSpin flipped between them). Per car:
//  BRAKE   100 km/h on tarmac: stop m with ABS / locked (ABS off, full pedal) / best pedal (ABS
//          off); ABS pulses a second; half lock held in a full ABS stop: metres sideways, heading.
//  LAUNCH  0-100 km/h s on tarmac (TCS off), 0-50 km/h s on gravel and on mud; top speed in 40 s.
//  FLICK   20 m/s, full lock + handbrake 0.6 s then the wheel straight: peak body slip deg and
//          the speed kept after 3 s (%).
//  JERK    the biggest step-to-step change in longitudinal accel over the launch (judder).
// node tools/scratch/_rootbench.mjs [cars,comma] [off|on|both]
import { makeCar, step, reset, neutralInput, PHYSICS_STEP_SECONDS as DT } from '../../src/vehicle.ts';
import { SURFACES } from '../../src/world/surfaces.ts';
import { FIX } from '../../src/core/fixes.ts';
const ids = (process.argv[2] || 'hatch-fwd,hatch-rwd,muscle-rwd,rally-4x4,track-rwd,naffcar,mini-fwd')
  .split(',');
const modes = { off: [false], on: [true], both: [false, true] }[process.argv[3] || 'both'];
const fresh = (id, surf, v) => {
  const car = makeCar(id); reset(car, 0, 0, 0); car.surface = SURFACES[surf]; car.tcsOn = false;
  if (v) { car.vx = v; car.gear = 4; car.rpm = 4000; }
  return car;
};
function stop(id, pedal, abs, steer = 0) {
  const car = fresh(id, 'tarmac', 100 / 3.6); car.absOn = abs;
  car.gear = 5; let t = 0, locked = 0, pulses = 0, beta = 0;
  while (Math.hypot(car.vx, car.vy) > 0.3 && t < 15) {
    step(car, { ...neutralInput(), brake: pedal, steer }, DT); t += DT;
    if (Math.hypot(car.vx, car.vy) > 3) beta = Math.max(beta, Math.abs(Math.atan2(car.t.vLat, car.t.vLong)) * 57.3);
    if (car.t.lockedF || car.t.lockedR) locked += DT;
  }
  pulses = (car.absPulses || 0) / 2;
  return { d: Math.hypot(car.x, car.y), y: car.y, t, locked, pulses, beta, h: car.heading * 180 / Math.PI };
}
function launch(id, surf, kmh) {
  const car = fresh(id, surf, 0); let t = 0, jerk = 0, lastA = 0, top = 0, hit = null;
  while (t < 40) {
    step(car, { ...neutralInput(), throttle: 1 }, DT); t += DT;
    const a = car.t.ax || 0; if (t > 0.05) jerk = Math.max(jerk, Math.abs(a - lastA)); lastA = a;
    const v = Math.hypot(car.vx, car.vy) * 3.6; top = Math.max(top, v);
    if (hit === null && v >= kmh) hit = t;
    if (hit !== null && surf !== 'tarmac') break;
  }
  return { t: hit, top, jerk };
}
function flick(id) {
  const car = fresh(id, 'tarmac', 20); let peak = 0; const inp = { ...neutralInput() };
  for (let i = 0; i < 360; i++) {
    const t = i * DT;
    inp.steer = t < 0.6 ? 1 : 0; inp.handbrake = t < 0.6 ? 1 : 0;
    step(car, inp, DT);
    peak = Math.max(peak, Math.abs(Math.atan2(car.t.vLat, car.t.vLong)) * 180 / Math.PI);
  }
  return { peak, kept: Math.hypot(car.vx, car.vy) / 20 * 100 };
}
const f1 = (x) => (x == null ? ' n/a' : x.toFixed(1));
for (const on of modes) {
  FIX.wheelSpin = on;
  console.log(`\n=== wheelspin ${on ? 'ON' : 'off'}`);
  for (const id of ids) {
    const abs = stop(id, 1, true), lock = stop(id, 1, false);
    let best = { d: Infinity };
    for (let p = 0.3; p <= 1.001; p += 0.05) { const r = stop(id, p, false); if (r.d < best.d) best = { ...r, p }; }
    const steer = stop(id, 1, true, 0.05), steer2 = stop(id, 1, true, 0.2), steerL = stop(id, 1, false, 0.05);
    const tar = launch(id, 'tarmac', 100), grav = launch(id, 'gravel', 50), mud = launch(id, 'mud', 50);
    const fl = flick(id);
    console.log(`${id.padEnd(11)} BRAKE abs ${f1(abs.d)} locked ${f1(lock.d)} best ${f1(best.d)}@${best.p.toFixed(2)}`
      + ` pulses ${(abs.pulses / abs.t).toFixed(1)}/s swerve0.05 ${f1(Math.abs(steer.y))} m slip ${steer.beta.toFixed(0)} (locked ${f1(Math.abs(steerL.y))} m) | 0.2: ${f1(Math.abs(steer2.y))} m slip ${steer2.beta.toFixed(0)}`
      + ` | 0-100 ${f1(tar.t)} top ${tar.top.toFixed(0)} grav0-50 ${f1(grav.t)} mud0-50 ${f1(mud.t)} jerk ${tar.jerk.toFixed(1)}`
      + ` | flick ${fl.peak.toFixed(0)}deg kept ${fl.kept.toFixed(0)}%`);
  }
}
