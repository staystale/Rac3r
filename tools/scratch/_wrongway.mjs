// _wrongway.mjs - BUG 5, WHAT THE WRONG-WAY GUARD MUST ALLOW (highway.ts checkWrongWay: moving back
// down the road faster than BACK_V for BACK_T s, or BACK_M m behind the furthest point reached).
// Headless, every car (CAR_IDS), flat tarmac, the road running along +x; the player's own
// pedals (input.ts: the throttle and reverse open from 0.26 to full over 1.5 s, the brake from
// 0.28 over 1 s, the stick straight to full lock - the car's own steering rate limits it):
//   uturn     TURN ROUND from rest facing back down the road: full lock and the throttle until
//             facing up the road (within 15 deg)
//   threept   TURN ROUND in three moves: reverse on full lock until turned 90 deg, stop, then
//             forward on the other lock until facing up the road
//   spin-V    a SPIN at V m/s (20, 30, 40): full lock and the handbrake 0.8 s, then the brake to
//             a stop; then, if it ends facing back, the U-turn (spin+turn)
//   reverse   ROLLING / REVERSING back: reverse held from rest, 30 m
//   headon    a CRASH: head-on into an oncoming car at 25 + 25 m/s (contact.ts carContact, the
//             game's own), the same car and the heaviest traffic car (the muscle car, 1730 kg);
//             both drivers brake 1 s after the hit
// Per case: the longest run moving back faster than BACK_V (the guard's BACK_T clock), the most
// metres back from the furthest point reached (BACK_M), the time it all took, and whether TODAY's
// guard (1.2 s, 30 m) would have fired. Worst over every car per case, and each car's numbers
// with VERBOSE=1. node tools/scratch/_wrongway.mjs [cars,...]
import {
  makeCar, step, reset, neutralInput, PHYSICS_STEP_SECONDS as DT,
} from '../../src/vehicle.ts';
import { CAR_IDS } from '../../src/cars.ts';
import { carContact } from '../../src/contact.ts';
import * as L from '../../src/lab.ts';

const cars = process.argv[2] ? process.argv[2].split(',') : CAR_IDS;
// the guard today: m/s back down the road, s at it, m behind the furthest point
const BACK_V = 3, BACK_T = 1.2, BACK_M = 30;
const THR_MIN = 0.26, THR_RAMP = 1.5, BRAKE_MIN = 0.28, BRAKE_RAMP = 1;
// s a driver takes to react to a crash
const REACTION_S = 1;
const ramp = (held, least, full) => Math.min(1, least + (1 - least) * held / full);
const wrap = (angle) => Math.atan2(Math.sin(angle), Math.cos(angle));

/** A car at rest on tarmac at the origin, facing a heading. */
function freshCar(id, heading) {
  const car = makeCar(id);
  reset(car, 0, 0, heading);
  car.surface = L.SURFACES.tarmac;
  return car;
}

/** The guard's two clocks for one car over a run. */
function newWatch() {
  return { backT: 0, worstT: 0, best: 0, worstM: 0, time: 0, firedAt: null };
}

/** One step of the car, and of the guard's clocks. */
function stepWatched(car, input, watch) {
  car.surface = L.SURFACES.tarmac;
  step(car, { ...neutralInput(), ...input }, DT);
  watch.time += DT;
  watch.backT = car.vx < -BACK_V ? watch.backT + DT : 0;
  watch.worstT = Math.max(watch.worstT, watch.backT);
  watch.best = Math.max(watch.best, car.x);
  watch.worstM = Math.max(watch.worstM, watch.best - car.x);
  if (watch.firedAt === null && (watch.backT > BACK_T || watch.best - car.x > BACK_M))
    watch.firedAt = { time: watch.time, back: watch.best - car.x };
}

/** Drives with a control function until done says so (or a time limit). */
function driveUntil(car, watch, control, done, limitS = 30) {
  const start = watch.time;
  while (watch.time - start < limitS && !done(car)) {
    stepWatched(car, control(watch.time - start, car), watch);
  }
}

/** Brakes to a stop, the phone's brake ramp. */
function stop(car, watch) {
  driveUntil(car, watch, (held) => ({ brake: ramp(held, BRAKE_MIN, BRAKE_RAMP) }),
    (now) => Math.hypot(now.vx, now.vy) < 0.3, 15);
}

/** Full lock and the throttle until facing up the road. */
function uTurn(car, watch) {
  const side = wrap(car.heading) >= 0 ? -1 : 1;
  driveUntil(car, watch, (held) => ({ steer: side, throttle: ramp(held, THR_MIN, THR_RAMP) }),
    (now) => Math.abs(wrap(now.heading)) < 15 * Math.PI / 180, 20);
}

const CASES = {
  uturn(id) {
    const car = freshCar(id, Math.PI - 0.05), watch = newWatch();
    uTurn(car, watch);
    return watch;
  },
  threept(id) {
    const car = freshCar(id, Math.PI - 0.05), watch = newWatch(), from = car.heading;
    driveUntil(car, watch, (held) => ({ steer: 1, reverse: ramp(held, THR_MIN, THR_RAMP) }),
      (now) => Math.abs(wrap(now.heading - from)) > Math.PI / 2, 8);
    stop(car, watch);
    const side = wrap(car.heading) >= 0 ? -1 : 1;
    driveUntil(car, watch, (held) => ({ steer: side, throttle: ramp(held, THR_MIN, THR_RAMP) }),
      (now) => Math.abs(wrap(now.heading)) < 15 * Math.PI / 180, 15);
    return watch;
  },
  reverse(id) {
    const car = freshCar(id, 0), watch = newWatch();
    driveUntil(car, watch, (held) => ({ reverse: ramp(held, THR_MIN, THR_RAMP) }),
      (now) => now.x < -30, 20);
    watch.at30 = watch.time;
    return watch;
  },
  headon(id, other = id) {
    const car = freshCar(id, 0), them = freshCar(other, Math.PI), watch = newWatch();
    car.x = -40;
    them.x = 40;
    car.vx = 25;
    them.vx = -25;
    watch.best = car.x;
    // (both drivers brake a REACTION_S after the hit, the phone's brake ramp)
    let hitAt = null;
    for (let i = 0; i < 8 / DT; i++) {
      const held = hitAt === null ? -1 : watch.time - hitAt - REACTION_S;
      const brake = held < 0 ? 0 : ramp(held, BRAKE_MIN, BRAKE_RAMP);
      stepWatched(car, { brake }, watch);
      them.surface = L.SURFACES.tarmac;
      step(them, { ...neutralInput(), brake }, DT);
      if (carContact(car, them) && hitAt === null) hitAt = watch.time;
    }
    return watch;
  },
};
for (const speed of [20, 30, 40]) {
  CASES['spin-' + speed] = (id) => {
    const car = freshCar(id, 0), watch = newWatch();
    car.vx = speed;
    driveUntil(car, watch, () => ({ steer: 1, handbrake: 1 }), () => false, 0.8);
    stop(car, watch);
    watch.endDeg = Math.round(Math.abs(wrap(car.heading)) * 180 / Math.PI);
    if (watch.endDeg > 90) uTurn(car, watch);
    return watch;
  };
}
CASES['headon-heavy'] = (id) => CASES.headon(id, 'muscle-rwd');

const rows = [];
for (const [name, run] of Object.entries(CASES)) {
  const per = cars.map((id) => ({ id, ...run(id) }));
  const worstT = per.reduce((best, row) => (row.worstT > best.worstT ? row : best));
  const worstM = per.reduce((best, row) => (row.worstM > best.worstM ? row : best));
  const fired = per.filter((row) => row.worstT > BACK_T || row.worstM > BACK_M).length;
  rows.push(`${name.padEnd(15)} back-run worst ${worstT.worstT.toFixed(2)} s (${worstT.id}), `
    + `median ${median(per.map((row) => row.worstT)).toFixed(2)} s; metres back worst `
    + `${worstM.worstM.toFixed(1)} (${worstM.id}), median `
    + `${median(per.map((row) => row.worstM)).toFixed(1)}; took up to `
    + `${Math.max(...per.map((row) => row.time)).toFixed(1)} s; today's guard fires on `
    + `${fired}/${per.length}`);
  if (process.env.VERBOSE) for (const row of per) rows.push(`    ${row.id.padEnd(14)} `
    + `${row.worstT.toFixed(2)} s ${row.worstM.toFixed(1)} m ${row.time.toFixed(1)} s`
    + (row.endDeg != null ? ` ends ${row.endDeg} deg` : '')
    + (row.at30 != null ? ` (30 m back at ${row.at30.toFixed(1)} s)` : '')
    + (row.firedAt ? ` TODAY FIRES at ${row.firedAt.time.toFixed(1)} s, `
      + `${row.firedAt.back.toFixed(1)} m back` : ''));
}
console.log(rows.join('\n'));

/** The median of some numbers. */
function median(values) {
  const sorted = [...values].sort((first, second) => first - second);
  return sorted[Math.floor(sorted.length / 2)];
}
