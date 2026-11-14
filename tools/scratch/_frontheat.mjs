// _frontheat.mjs - front against rear tyre heat on EVERY car (CAR_IDS), headless, tarmac, 18 C,
// aids OFF then ON. Prints, per car, the axle averages (front / rear, C) after:
//   lock   20 s at full lock and full throttle from rest
//   hold   20 s at full lock, throttle holding 10 m/s
//   arc    30 s on a 50 m circle at 18.5 m/s (0.7 g, a gripping corner), yaw-rate steering
//   fast   30 s on a 150 m circle at 40 m/s (1.1 g at 144 km/h: downforce working)
//   stops  five stops from min(60 m/s, the car's 30 s speed), full throttle up, the phone's
//          brake ramp down (0.28 rising to 1 over 1 s):
//          fronts at 6 s, peak front, front and rear at the end
// JSON=path also writes the numbers there. Run with the switch set (FRONTHEAT=1) for the fix.
// THE CHECK (exit 1 on a failure): after the five stops every car stopping from 40 m/s or more
// ends with its fronts at 60 C or more, aids off and on.
import { makeCar, step, reset, setAidsDefault, neutralInput, PHYSICS_STEP_SECONDS as DT }
  from '../../src/vehicle.ts';
import { CAR_IDS } from '../../src/cars.ts';
import { SURFACES } from '../../src/lab.ts';
import { writeFileSync } from 'node:fs';

const front = (car) => (car.tyreT[0] + car.tyreT[1]) / 2;
const rear = (car) => (car.tyreT[2] + car.tyreT[3]) / 2;
const speedOf = (car) => Math.hypot(car.vx, car.vy);

function freshCar(id) {
  const car = makeCar(id);
  reset(car, 0, 0, 0);
  car.surface = SURFACES.tarmac;
  return car;
}

function runFor(car, seconds, control) {
  for (let i = 0; i < seconds / DT; i++) {
    car.surface = SURFACES.tarmac;
    step(car, { ...neutralInput(), ...control(car) }, DT);
  }
  return car;
}

const lockCircle = (id) => runFor(freshCar(id), 20, () => ({ steer: 1, throttle: 1 }));
const holdCircle = (id) => runFor(freshCar(id), 20,
  (car) => ({ steer: 1, throttle: speedOf(car) < 10 ? 0.7 : 0 }));

function arcCircle(id, radius = 50, target = 18.5) {
  const car = freshCar(id);
  car.vx = target;
  return runFor(car, 30, (now) => {
    const speed = speedOf(now), wantYaw = speed / radius;
    const steer = Math.max(-1, Math.min(1, 0.15 + 2 * (wantYaw - now.yawRate)));
    return { steer, throttle: speed < target ? 0.6 : 0 };
  });
}

function topSpeed(id) {
  return speedOf(runFor(freshCar(id), 30, () => ({ throttle: 1 })));
}

function fiveStops(id) {
  const car = freshCar(id), target = Math.min(60, 0.95 * topSpeed(id));
  let clock = 0, at6 = null, peakFront = 0, brakeSteps = 0, frontGrip = 0;
  const tick = (control) => {
    car.surface = SURFACES.tarmac;
    step(car, { ...neutralInput(), ...control }, DT);
    clock += DT;
    if (at6 === null && clock >= 6) at6 = front(car);
    peakFront = Math.max(peakFront, front(car));
  };
  for (let stop = 0; stop < 5; stop++) {
    for (let guard = 0; speedOf(car) < target && guard < 40 / DT; guard++) tick({ throttle: 1 });
    for (let guard = 0; speedOf(car) > 0.5 && guard < 30 / DT; guard++) {
      tick({ brake: Math.min(1, 0.28 + 0.72 * guard * DT) });
      brakeSteps++;
      if (!car.t.lockedF && !car.t.slidingF) frontGrip++;
    }
  }
  return { target, at6, peakFront, endFront: front(car), endRear: rear(car), seconds: clock,
    gripShare: frontGrip / Math.max(1, brakeSteps) };
}

const pair = (car) => `${front(car).toFixed(0)}/${rear(car).toFixed(0)}`;
const rows = [];
for (const aids of [false, true]) {
  setAidsDefault(aids);
  console.log(`\nAIDS ${aids ? 'ON' : 'OFF'}  (front/rear C)   lock  hold  arc  fast  |  stops from v: `
    + 'front@6s peak end / rear end, front gripping share of braking');
  for (const id of CAR_IDS) {
    const lock = lockCircle(id), hold = holdCircle(id), arc = arcCircle(id);
    const fast = arcCircle(id, 150, 40), stops = fiveStops(id);
    rows.push({ id, aids, lock: [front(lock), rear(lock)], hold: [front(hold), rear(hold)],
      arc: [front(arc), rear(arc)], fast: [front(fast), rear(fast)],
      fastSpeed: speedOf(fast), stops });
    console.log(`${id.padEnd(14)} ${pair(lock).padStart(8)} ${pair(hold).padStart(8)}`
      + ` ${pair(arc).padStart(8)} ${pair(fast).padStart(8)}`
      + `${speedOf(fast) < 35 ? '*' : ' '} | ${stops.target.toFixed(0).padStart(2)} m/s:`
      + ` ${stops.at6.toFixed(0)} ${stops.peakFront.toFixed(0)} ${stops.endFront.toFixed(0)}`
      + ` / ${stops.endRear.toFixed(0)}  grip ${(100 * stops.gripShare).toFixed(0)}%`);
  }
}
if (process.env.JSON) writeFileSync(process.env.JSON, JSON.stringify(rows, null, 1));
const cold = rows.filter((row) => row.stops.target >= 40 && row.stops.endFront < 60);
for (const row of cold) {
  console.log(`  FAIL ${row.id} aids ${row.aids ? 'on' : 'off'}: fronts ${
    row.stops.endFront.toFixed(0)} C after five stops`);
}
console.log(cold.length ? `FAIL (${cold.length})` : 'PASS: every car reaches 60 C at the front');
process.exitCode = cold.length ? 1 : 0;
