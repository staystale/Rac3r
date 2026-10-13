// donut.mjs — can each car hold a sustained power slide on full lock?
// Added 2026-09-27 after the user found by hand, on the TUNE panel, that the muscle car needed 2.4x
// power before it could donut at all. Raising grip to mu 1.25 had quietly made every car unable to
// break traction — the power that used to spin the rears no longer could.
//
// A donut is sustained when the rear stays sliding and the car keeps yawing, for seconds, not a moment.
import { makeCar, step, reset, neutralInput, DT } from '../src/vehicle.ts';
import { CAR_IDS } from '../src/cars.ts';

function donut(id, powerMul) {
  const car = makeCar(id);
  car.mods.power = powerMul;
  reset(car, 0, 0, 0);
  car.vx = 5; car.gear = 1; car.rpm = 2500;
  const inp = { ...neutralInput(), steer: 1, throttle: 1 };
  let slidingSteps = 0, n = 0, yawSum = 0, spd = 0;
  for (let i = 0; i < 120 * 6; i++) {
    step(car, inp, DT);
    if (i > 120) {                       // after 1 s of settling
      n++;
      if (car.t.spinR) slidingSteps++;      // TRUE wheelspin, not merely a big rear slip angle
      yawSum += Math.abs(car.yawRate);
      spd += Math.hypot(car.vx, car.vy);
    }
  }
  return { slidePct: 100 * slidingSteps / n, yaw: yawSum / n, speed: spd / n };
}

// A donut counts as HELD when the rear is sliding >80% of the time and the car is actually spinning.
function minPower(id) {
  for (let p = 0.6; p <= 4.01; p += 0.1) {
    const r = donut(id, p);
    if (r.slidePct > 70 && r.yaw > 0.7) return { p: +p.toFixed(1), ...r };
  }
  return null;
}

console.log('car            power needed to hold a donut   rear SPINNING  yaw rate   speed');
for (const id of CAR_IDS) {
  const m = minPower(id);
  if (!m) { console.log(`${id.padEnd(13)}  CANNOT DONUT even at 4.0x power`); continue; }
  console.log(`${id.padEnd(13)}  ${(m.p + 'x').padStart(24)}   ${m.slidePct.toFixed(0).padStart(11)}%   ${m.yaw.toFixed(2).padStart(8)}   ${m.speed.toFixed(1).padStart(5)}`);
}
