// _boxhunt.mjs - THE SCANYAH's AUTO BOX WITH ITS TRAILER (owner 11-17: "its box hunts 1-2 loaded"),
// headless with the game's own steps (physics/powertrain.ts autoShift): pulls from rest at several
// throttles, flat and up a slope, the tractor alone and towing; every shift in the first 30 s with
// its time, gear, rpm and speed, and the count of 2 -> 1 drops. Nothing is changed.
// node tools/scratch/_boxhunt.mjs [seconds]
import { makeCar, step, reset, PHYSICS_STEP_SECONDS as dt } from '../../src/vehicle.ts';
import { SURFACES } from '../../src/lab.ts';
import { attachTrailer, stepTrailer } from '../../src/physics/trailer.ts';

const SECONDS = +(process.argv[2] || 30);

/**
 * One pull from rest: every shift and the count of drops back to 1st.
 * @param towing with the loaded trailer
 * @param throttle the pedal, 0-1
 * @param slope the road's grade (a force share of the weight pulling back), e.g. 0.05
 */
function pull(towing, throttle, slope) {
  const car = makeCar('scanyah-r450');
  reset(car, 0, 0, 0);
  car.autoBox = true;
  if (towing) attachTrailer(car);
  const shifts = [];
  let gear = car.gear, drops = 0;
  for (let time = 0; time < SECONDS; time += dt) {
    car.surface = SURFACES.tarmac;
    if (car.trailer) car.trailer.surface = SURFACES.tarmac;
    if (slope) {
      car.vx -= slope * 9.81 * dt;
      if (car.trailer) car.trailer.vx -= slope * 9.81 * dt;
    }
    step(car, { steer: 0, throttle, brake: 0, handbrake: 0, reverse: 0 }, dt);
    if (car.trailer) stepTrailer(car, 0, dt);
    if (car.gear !== gear) {
      if (gear === 2 && car.gear === 1) drops++;
      if (shifts.length < 14) shifts.push(`${time.toFixed(2)}s ${gear}->${car.gear} `
        + `${Math.round(car.rpm)}rpm ${(car.t.vLong * 3.6).toFixed(1)}km/h`);
      gear = car.gear;
    }
  }
  console.log(`${towing ? 'towing' : 'alone '} throttle ${throttle} slope ${slope}: `
    + `${(car.t.vLong * 3.6).toFixed(1)} km/h in gear ${car.gear} at ${SECONDS} s; 2->1 drops `
    + `${drops}; shifts: ${shifts.join(' | ')}`);
}

for (const towing of [false, true]) {
  for (const throttle of [1, 0.6, 0.35]) {
    for (const slope of [0, 0.04]) pull(towing, throttle, slope);
  }
}
