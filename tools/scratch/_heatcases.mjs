// _heatcases.mjs - tyre heat on EVERY car (CAR_IDS), headless, tarmac, 18 C, aids OFF then ON:
//   launch  10 s of full throttle from rest
//   donut   20 s at full lock and full throttle from rest
//   arc     90 s on a 50 m circle at 18.5 m/s (0.7 g), yaw-rate steering
//   fast    90 s on a 150 m circle at 40 m/s (1.1 g at 144 km/h)
//   limit   90 s on a 50 m circle at 0.9 of the car's grip (mu g, no downforce counted)
//   stops   ten stops from min(60 m/s, the car's 30 s speed), full throttle up, the phone's
//           brake ramp down (0.28 rising to 1 over 1 s)
// Each: front / rear axle averages at the end (C); the arcs and stops also the seconds until the
// hottest front first reached 65 C and 110 C ('-' never). JSON=path writes the numbers.
import { makeCar, step, reset, setAidsDefault, neutralInput, PHYSICS_STEP_SECONDS as DT }
  from '../../src/vehicle.ts';
import { CAR_IDS } from '../../src/cars.ts';
import { SURFACES } from '../../src/lab.ts';
import { writeFileSync } from 'node:fs';

const front = (car) => (car.tyreT[0] + car.tyreT[1]) / 2;
const rear = (car) => (car.tyreT[2] + car.tyreT[3]) / 2;
const speedOf = (car) => Math.hypot(car.vx, car.vy);

/** A car on tarmac with a clock and the times its hottest front crossed 65 and 110 C. */
function freshRun(id) {
  const car = makeCar(id);
  reset(car, 0, 0, 0);
  car.surface = SURFACES.tarmac;
  const run = { car, clock: 0, warm: null, hot: null };
  run.tick = (control) => {
    car.surface = SURFACES.tarmac;
    step(car, { ...neutralInput(), ...control }, DT);
    run.clock += DT;
    const hottest = Math.max(car.tyreT[0], car.tyreT[1]);
    if (run.warm === null && hottest >= 65) run.warm = run.clock;
    if (run.hot === null && hottest > 110) run.hot = run.clock;
  };
  return run;
}

function runFor(id, seconds, control, setup) {
  const run = freshRun(id);
  if (setup) setup(run.car);
  for (let i = 0; i < seconds / DT; i++) run.tick(control(run.car));
  return run;
}

function arc(id, radius, target) {
  return runFor(id, 90, (now) => {
    const speed = speedOf(now), wantYaw = speed / radius;
    const steer = Math.max(-1, Math.min(1, 0.15 + 2 * (wantYaw - now.yawRate)));
    return { steer, throttle: speed < target ? 0.6 : 0 };
  }, (car) => { car.vx = target; });
}

function tenStops(id) {
  const top = speedOf(runFor(id, 30, () => ({ throttle: 1 })).car);
  const run = freshRun(id), target = Math.min(60, 0.95 * top);
  for (let stop = 0; stop < 10; stop++) {
    for (let guard = 0; speedOf(run.car) < target && guard < 40 / DT; guard++)
      run.tick({ throttle: 1 });
    for (let guard = 0; speedOf(run.car) > 0.5 && guard < 30 / DT; guard++)
      run.tick({ brake: Math.min(1, 0.28 + 0.72 * guard * DT) });
  }
  run.target = target;
  return run;
}

const pair = (run) => `${front(run.car).toFixed(0)}/${rear(run.car).toFixed(0)}`;
const when = (run) => `${run.warm === null ? '-' : run.warm.toFixed(0)},${
  run.hot === null ? '-' : run.hot.toFixed(0)}`;
const rows = [];
for (const aids of [false, true]) {
  setAidsDefault(aids);
  console.log(`\nAIDS ${aids ? 'ON' : 'OFF'}: front/rear C at the end [s to 65, s to 110]`);
  console.log('car            launch    donut     arc 0.7 g          fast 1.1 g         limit 0.9 mu       ten stops');
  for (const id of CAR_IDS) {
    const launch = runFor(id, 10, () => ({ throttle: 1 }));
    const donut = runFor(id, 20, () => ({ steer: 1, throttle: 1 }));
    const slow = arc(id, 50, 18.5), fast = arc(id, 150, 40), stops = tenStops(id);
    const limit = arc(id, 50, Math.sqrt(0.9 * makeCar(id).spec.mu * 9.81 * 50));
    const keep = (run) => ({ front: front(run.car), rear: rear(run.car), warm: run.warm,
      hot: run.hot, speed: speedOf(run.car) });
    rows.push({ id, aids, launch: keep(launch), donut: keep(donut), arc: keep(slow),
      fast: keep(fast), limit: keep(limit), stops: { ...keep(stops), target: stops.target } });
    console.log(`${id.padEnd(14)} ${pair(launch).padStart(7)}  ${pair(donut).padStart(7)}  `
      + `${pair(slow).padStart(7)} [${when(slow)}]`.padEnd(19)
      + `${pair(fast).padStart(7)}${speedOf(fast.car) < 35 ? '*' : ' '}[${when(fast)}]`.padEnd(19)
      + `${pair(limit).padStart(7)} [${when(limit)}]`.padEnd(19)
      + `${pair(stops).padStart(7)} [${when(stops)}] from ${stops.target.toFixed(0)} m/s`);
  }
}
if (process.env.JSON) writeFileSync(process.env.JSON, JSON.stringify(rows, null, 1));
