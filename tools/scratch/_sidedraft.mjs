// _sidedraft.mjs - THE SIDE DRAFT (physics/wake.ts, ?sidedraft=1 / SIDEDRAFT=1): two cars of a kind
// door to door at 50 m/s. 1: the drag each feels as the second car's nose moves along the first's
// flank (0.4 m between the doors). 2: both flat out on rails for 4 s, the second's nose starting
// at the first's rear quarter - how far the second gains, and each one's speed, against two cars
// 30 m apart. Run with SIDEDRAFT=1 and without.
// [SIDEDRAFT=1] node tools/scratch/_sidedraft.mjs [cars]
import { makeCar, step, reset, PHYSICS_STEP_SECONDS } from '../../src/vehicle.ts';
import { SURFACE_LAB } from '../../src/cars.ts';
import { wakeStep } from '../../src/physics/wake.ts';

const DT = PHYSICS_STEP_SECONDS, SPEED = 50, DOORS = 0.4;
const held = { steer: 0, throttle: 1, brake: 0, handbrake: 0 };

/** Two cars side by side: the second's nose at `nose` along the first (-1 its tail, 1 its nose). */
function pair(carId, nose, apart = DOORS) {
  const first = makeCar(carId), second = makeCar(carId);
  const lenA = first.spec.len, lenB = second.spec.len;
  reset(first, 0, 0, 0);
  reset(second, nose * lenA / 2 - lenB / 2, (first.spec.wid + second.spec.wid) / 2 + apart, 0);
  for (const car of [first, second]) {
    car.vx = SPEED; car.vy = 0; car.surface = SURFACE_LAB;
  }
  return [first, second];
}

for (const carId of (process.argv[2] || 'naffcar,track-rwd').split(',')) {
  const profile = [];
  for (let nose = -1.4; nose <= 0.45; nose += 0.2) {
    const cars = pair(carId, nose);
    wakeStep(cars);
    profile.push(`${nose.toFixed(1)}: ${cars.map((car) => (car.dragMul ?? 1).toFixed(3)).join('/')}`);
  }
  console.log(carId, 'drag (first/second) by the second\'s nose:', profile.join('  '));
  for (const apart of [DOORS, 30]) {
    const cars = pair(carId, -0.5, apart), start = cars[1].x - cars[0].x;
    for (let t = 0; t < 4; t += DT) {
      wakeStep(cars);
      for (const car of cars) {
        step(car, held, DT);
        // on rails: straight ahead, no drift across
        car.vy = 0; car.heading = 0; car.yawRate = 0;
      }
      cars[1].y = cars[0].y + (cars[0].spec.wid + cars[1].spec.wid) / 2 + apart;
    }
    console.log(`  ${apart === DOORS ? 'door to door' : '30 m apart  '}: second gained`,
      (cars[1].x - cars[0].x - start).toFixed(2), 'm; speeds',
      cars.map((car) => (car.vx * 3.6).toFixed(1)).join(' / '), 'km/h');
  }
}
