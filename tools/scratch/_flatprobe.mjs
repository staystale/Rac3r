// _flatprobe.mjs - one flat tyre: launch 0-50 / 0-100 (TCS off), hands-off heading drift from
// 80 km/h over 3 s, coast-down 80->40 time; per corner. FLATGRIP=1 for the switch.
import { makeCar, step, reset, neutralInput, PHYSICS_STEP_SECONDS as DT } from '../../src/vehicle.ts';
import { SURFACES } from '../../src/world/surfaces.ts';
import { damageInit, stepDamage } from '../../src/damage.ts';
import { LEVELS } from '../../src/world/levels/index.ts';
import { setActiveLevel } from '../../src/world/state.ts';
setActiveLevel(LEVELS.find((lv) => lv.id === 'lab') || LEVELS[0]);
const ids = (process.argv[2] || 'muscle-rwd,hatch-fwd').split(',');
function fresh(id, corner, v) {
  const car = makeCar(id); reset(car, 0, 0, 0); car.surface = SURFACES.tarmac; car.tcsOn = false;
  damageInit(car);
  if (corner >= 0) { car.tyreP[corner] = 0.001; car.tyreLeak[corner] = 1; car.flatRun = [0, 0, 0, 0]; }
  if (v) { car.vx = v; car.gear = 4; car.rpm = 4000; }
  stepDamage(car, DT);
  return car;
}
const sp = (c) => Math.hypot(c.vx, c.vy) * 3.6;
for (const id of ids) for (const corner of [-1, 0, 2, 3]) {
  let car = fresh(id, corner, 0), t = 0, t50 = null, t100 = null, spin = 0;
  while (t < 20 && t100 === null) { car.flatRun = [0, 0, 0, 0];
    step(car, { ...neutralInput(), throttle: 1, steer: Math.max(-1, Math.min(1, -3 * car.heading - 0.6 * car.yawRate - 0.15 * car.y)) }, DT); stepDamage(car, DT); t += DT;
    if (t50 === null && sp(car) >= 50) t50 = t; if (sp(car) >= 100) t100 = t;
    if (car.t.slipSpeedR > 3 || car.t.slipSpeedF > 3) spin += DT;
  }
  const head0 = car.heading;
  car = fresh(id, corner, 80 / 3.6); t = 0;
  while (t < 3) { car.flatRun = [0, 0, 0, 0]; step(car, { ...neutralInput(), throttle: 0.35 }, DT); stepDamage(car, DT); t += DT; }
  const drift = car.heading * 57.3, lat = car.y;
  car = fresh(id, corner, 80 / 3.6); t = 0;
  while (sp(car) > 40 && t < 60) { step(car, { ...neutralInput() }, DT); stepDamage(car, DT); t += DT; }
  console.log(`${id.padEnd(11)} flat ${['none', 'FL', 'FR', 'RL', 'RR'][corner + 1]}  0-50 ${t50?.toFixed(2)} 0-100 ${t100?.toFixed(2)}`
    + ` spin ${spin.toFixed(2)} s | hands-off 3 s: heading ${drift.toFixed(1)} deg, ${lat.toFixed(1)} m | coast 80-40 ${t.toFixed(1)} s`);
}
