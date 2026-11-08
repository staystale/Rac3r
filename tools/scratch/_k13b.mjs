// _k13b.mjs - K13: per car peak torque (Nm), peak power (kW, hp) from the torque curve up to the
// redline, power-to-weight, and the turning circle (kerb, 3 m/s full lock).
import { makeCar, step, reset, neutralInput, PHYSICS_STEP_SECONDS as DT } from '../../src/vehicle.ts';
import { CAR_IDS } from '../../src/cars.ts';
import { SURFACES } from '../../src/world/surfaces.ts';
for (const id of CAR_IDS) {
  const s = makeCar(id).spec; let tq = 0, kw = 0;
  const curve = s.curve;
  for (let rpm = curve[0][0]; rpm <= s.redline; rpm += 50) {
    let i = 0; while (i < curve.length - 2 && curve[i + 1][0] < rpm) i++;
    const [r0, t0] = curve[i], [r1, t1] = curve[i + 1];
    const t = t0 + (t1 - t0) * Math.min(1, Math.max(0, (rpm - r0) / (r1 - r0)));
    tq = Math.max(tq, t); kw = Math.max(kw, t * rpm * 2 * Math.PI / 60 / 1000);
  }
  const car = makeCar(id); reset(car, 0, 0, 0); car.surface = SURFACES.tarmac; car.vx = 3; car.gear = 1;
  let rad = 0, n = 0;
  for (let k = 0; k < 600; k++) {
    step(car, { ...neutralInput(), steer: 1, throttle: car.t.vLong < 3 ? 0.3 : 0 }, DT);
    if (k > 360) { rad += Math.abs(car.t.vLong / car.yawRate); n++; }
  }
  const circle = 2 * rad / n + (s.trackWidth || s.wid);
  console.log(`${id.padEnd(14)} ${Math.round(tq)} Nm ${Math.round(kw)} kW ${Math.round(kw * 1.341)} hp`
    + ` ${Math.round(kw * 1341 / s.mass)} hp/t circle ${circle.toFixed(1)} m drag ${s.dragC}`);
}
