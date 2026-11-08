// _hbabs.mjs - does the HANDBRAKE act the same with ABS on and off (owner 11-04: "it shouldn't
// ever trigger abs like behaviour it should just lock the rear wheels")? A car at 60 km/h on the
// Test Track pulls the handbrake for 1.5 s - straight, turning, and with the foot brake too -
// with ABS on and off: rear locked share, front locked share, ABS pulses, the stop, the yaw.
// node tools/scratch/_hbabs.mjs [car]
import { makeCar, step, reset, PHYSICS_STEP_SECONDS as DT } from '../../src/vehicle.ts';
import * as L from '../../src/lab.ts';
const carId = process.argv[2] || 'hatch-fwd';
L.setLevel('test-track'); L.clearWear();
const sp = L.LEVEL.spawn;
function run(abs, steer, brake) {
  const car = makeCar(carId); reset(car, sp.x, sp.y, sp.heading); car.absOn = abs;
  car.vx = Math.cos(sp.heading) * 16.7; car.vy = Math.sin(sp.heading) * 16.7;
  let lockR = 0, lockF = 0, n = 0; const p0 = car.absPulses || 0, x0 = car.x, y0 = car.y, h0 = car.heading;
  for (let t = 0; t < 1.5; t += DT) {
    L.applyGround(car, DT);
    step(car, { steer, throttle: 0, brake, handbrake: 1, reverse: 0 }, DT);
    n++; if (car.t.lockedR) lockR++; if (car.t.lockedF) lockF++;
  }
  return { lockR: lockR / n, lockF: lockF / n, pulses: (car.absPulses || 0) - p0, v: Math.hypot(car.vx, car.vy) * 3.6,
    dist: Math.hypot(car.x - x0, car.y - y0), yaw: (car.heading - h0) * 180 / Math.PI, absW: !!car.t.absWorking };
}
for (const [name, steer, brake] of [['handbrake, straight', 0, 0], ['handbrake, turning', 0.4, 0], ['handbrake + foot brake', 0, 1], ['handbrake + brake, turning', 0.4, 1]]) {
  for (const abs of [false, true]) {
    const r = run(abs, steer, brake);
    console.log(`${name.padEnd(28)} ABS ${abs ? 'on ' : 'off'}: rears locked ${(r.lockR * 100).toFixed(0)} %, fronts ${(r.lockF * 100).toFixed(0)} % | ABS pulses ${r.pulses} | after 1.5 s ${r.v.toFixed(1)} km/h, ${r.dist.toFixed(1)} m, yaw ${r.yaw.toFixed(1)} deg`);
  }
}
