// _tiptrip.mjs - A DICE TRIP THROUGH THE TWO-WHEEL STATE (physics/tip.ts startTip, ?tipping),
// headless: per car, N seeded trips of a car sliding square-on across gravel at a speed (heading
// along x, moving along +y, no input): how many go over into the roll and how many drop back onto
// four wheels. Nothing in the game is changed.
// node tools/scratch/_tiptrip.mjs <cars> [km/h, 60] [trips, 200]  (TIPPING=1)
import { makeCar, step, reset, PHYSICS_STEP_SECONDS as dt } from '../../src/vehicle.ts';
import { SURFACES } from '../../src/lab.ts';
import { startTip, stepTipping, isTipping } from '../../src/physics/tip.ts';
import { rolling } from '../../src/roll.ts';
import { parkMiller } from '../../src/core/random.ts';

const [carsArg = 'hatch-fwd', kphArg = '60', tripsArg = '200'] = process.argv.slice(2);
for (const id of carsArg.split(',')) {
  let over = 0, down = 0;
  for (let trip = 0; trip < Number(tripsArg); trip++) {
    const car = makeCar(id);
    reset(car, 0, 0, 0);
    car.vy = Number(kphArg) / 3.6;
    car.surface = SURFACES.gravel;
    step(car, { steer: 0, throttle: 0, brake: 0, handbrake: 0 }, dt);
    const rnd = parkMiller(trip + 1);
    rnd();
    startTip(car, 1, rnd);
    for (let time = 0; time < 3; time += dt) {
      car.surface = SURFACES.gravel;
      if (rolling(car)) { over++; break; }
      step(car, { steer: 0, throttle: 0, brake: 0, handbrake: 0 }, dt);
      stepTipping(car, dt);
      if (!isTipping(car) && !rolling(car)) { down++; break; }
    }
  }
  console.log(`${id.padEnd(14)} ${kphArg} km/h sideways on gravel, ${tripsArg} trips: over ${over}, `
    + `down ${down}`);
}
