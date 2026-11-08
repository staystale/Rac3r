import { makeCar, step, reset, neutralInput, PHYSICS_STEP_SECONDS as DT } from '../../src/vehicle.ts';
import { SURFACES } from '../../src/world/surfaces.ts';
import { wakeStep } from '../../src/physics/wake.ts';
for (const id of ['track-rwd', 'f2-rwd', 'naffcar', 'hatch-fwd']) for (const gap of [0, 8, 15, 25]) {
  const lead = makeCar(id); reset(lead, gap || 999, 0, 0); lead.vx = 200 / 3.6;
  const car = makeCar(id); reset(car, 0, 0, 0); car.surface = SURFACES.tarmac; car.vx = 200 / 3.6; car.gear = 5; car.rpm = 7000;
  let t = 0, g = 0, n = 0, dsum = 0, dn = 0;
  // constant-radius corner at 200 km/h: max lateral g reached with a steering sweep
  while (t < 3) { const h = car.heading; lead.x = car.x + Math.cos(h) * (gap || 999); lead.y = car.y + Math.sin(h) * (gap || 999); lead.heading = h; lead.vx = Math.cos(h) * 200 / 3.6; lead.vy = Math.sin(h) * 200 / 3.6;
    wakeStep([lead, car]); const v = Math.hypot(car.vx, car.vy); const k = 200 / 3.6 / v;
    car.vx *= k; car.vy *= k;   // hold the speed
    step(car, { ...neutralInput(), throttle: 0.5, steer: Math.min(1, t / 3) * 0.2 }, DT); t += DT;
    if (t > 2.5) dsum += car.wakeDown ?? 1, dn++; g = Math.max(g, Math.abs(car.yawRate * v) / 9.81); }
  console.log(`${id.padEnd(10)} ${gap ? gap + ' m behind' : 'clean air  '} downforce x${(dsum / dn).toFixed(2)} drag x${(car.dragMul ?? 1).toFixed(2)} peak corner g ${g.toFixed(2)}`);
}
