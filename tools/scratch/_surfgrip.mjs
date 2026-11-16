// _surfgrip.mjs - A CAR'S GRIP ON EACH SURFACE: the best steady lateral g at 60 km/h, the steer
// swept, warm tyres (as tools/carstats.mjs measures its tarmac grip), on tarmac, gravel, dirt,
// grass and sand; the car on its own stock tyres. Nothing in the game is changed: it only reads.
// node tools/scratch/_surfgrip.mjs <cars, comma list>   (NAME=1 for a new car)
import { makeCar, step, reset, PHYSICS_STEP_SECONDS } from '../../src/vehicle.ts';
import { SURFACES } from '../../src/lab.ts';

// the steer sweep's step (carstats: 0.02; finer reads a small change)
const STEER_STEP = Number(process.env.STEER_STEP || 0.02);
const SURFS = ['tarmac', 'gravel', 'dirt', 'grass', 'sand'];

/**
 * The best steady lateral g one car holds on one surface at 60 km/h.
 * @param {string} id the car
 * @param {string} surfaceId the surface (src/lab.ts SURFACES)
 * @returns {number} g
 */
function steadyG(id, surfaceId) {
  let best = 0;
  for (let steer = STEER_STEP; steer <= 0.5; steer += STEER_STEP) {
    const car = makeCar(id);
    reset(car, 0, 0, 0);
    car.tyreT = [85, 85, 85, 85];
    car.vx = 16.7;
    car.gear = 2;
    let sum = 0, count = 0, slid = false;
    for (let k = 0; k < 480; k++) {
      car.surface = SURFACES[surfaceId];
      const throttle = car.t.vLong < 16.7 ? 0.5 : 0;
      step(car, { steer, throttle, brake: 0, handbrake: 0 }, PHYSICS_STEP_SECONDS);
      if (Math.abs(Math.atan2(car.t.vLat, Math.abs(car.t.vLong))) > 0.2) slid = true;
      if (k > 300) {
        sum += Math.abs(car.t.vLong * car.yawRate);
        count++;
      }
    }
    if (!slid) best = Math.max(best, sum / count / 9.81);
  }
  return best;
}

for (const id of (process.argv[2] || 'hatch-fwd').split(','))
  console.log(id.padEnd(14), SURFS.map((surf) => `${surf} ${steadyG(id, surf).toFixed(2)} g`).join(' | '));
