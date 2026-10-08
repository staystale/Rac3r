// Judder = step-to-step oscillation. Count sign reversals in yaw acceleration and measure jerk.
// A smooth corner should reverse rarely; a juddering one flips almost every step.
import { makeCar, step, reset, neutralInput, DT } from '../src/vehicle.js';
import { CAR_IDS } from '../src/cars.js';

function scan(id, label, v0, steer, thr) {
  const car = makeCar(id);
  reset(car, 0, 0, 0);
  car.vx = v0; car.gear = 3; car.rpm = 4000;
  const inp = { ...neutralInput(), steer, throttle: thr };
  let prevYaw = 0, prevAcc = 0, flips = 0, n = 0, jerkSum = 0, maxJerk = 0;
  for (let i = 0; i < 120 * 4; i++) {
    step(car, inp, DT);
    const acc = (car.yawRate - prevYaw) / DT;
    if (i > 40) {
      const jerk = Math.abs(acc - prevAcc) / DT;
      jerkSum += jerk; maxJerk = Math.max(maxJerk, jerk);
      if (Math.sign(acc) !== Math.sign(prevAcc) && acc !== 0 && prevAcc !== 0) flips++;
      n++;
    }
    prevAcc = acc; prevYaw = car.yawRate;
  }
  return { flipsPerSec: flips / (n * DT), meanJerk: jerkSum / n, maxJerk };
}

console.log('car            corner: flips/s  meanJerk   maxJerk  |  slow corner: flips/s  meanJerk');
for (const id of CAR_IDS) {
  const a = scan(id, 'fast', 22, 0.6, 0.4);
  const b = scan(id, 'slow', 6, 0.9, 0.3);
  console.log(`${id.padEnd(13)}  ${a.flipsPerSec.toFixed(0).padStart(11)}  ${a.meanJerk.toFixed(0).padStart(8)}  ${a.maxJerk.toFixed(0).padStart(8)}  |  ${b.flipsPerSec.toFixed(0).padStart(12)}  ${b.meanJerk.toFixed(0).padStart(8)}`);
}
