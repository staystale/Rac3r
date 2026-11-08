// _rollway.mjs - WHICH WAY A CAR ROLLS FROM AN IMPACT (owner 11-08: "check which way a car rolls
// from an impact ... sometimes it seems to roll the wrong way"). Node, the game's step order (as
// tools/crashbench.mjs). Two cases, TRIES each, a hatch:
//   SLIDE  the car sliding sideways into the Festival of Splat's Armco (left side first, SPEED m/s)
//          - a low barrier stops its base, so it should trip over TOWARD the barrier
//   TBONE  a car standing across the road, hit square in its right side by another at SPEED m/s -
//          shoved sideways, it should trip over its far wheels, AWAY from the hit
// For each: rolls started, toward / away from the impact. And TUMBLE: a car already rolling hard
// into the Armco at 8 m/s - over it or stopped by it.
// [ROLLWAY=1] [ROLLOVER=1] [SPEED=15] [TRIES=60] node tools/scratch/_rollway.mjs
import { makeCar, step, reset, PHYSICS_STEP_SECONDS } from '../../src/vehicle.ts';
import * as L from '../../src/lab.ts';
import { carContacts } from '../../src/contact.ts';
import { hit, hitRoll, stepDamage } from '../../src/damage.ts';
import { rolling, tripCheck, stepRoll, startRoll } from '../../src/roll.ts';
import { clampWorld } from '../../src/world/crossings.ts';
import { resetTrackside } from '../../src/world/barriers.ts';

const SPEED = +(process.env.SPEED || 15), TRIES = +(process.env.TRIES || 60), DT = PHYSICS_STEP_SECONDS;
const idle = { steer: 0, throttle: 0, brake: 0, handbrake: 0 };
L.setLevel('crash-bench');

/**
 * One car (or two) stepped as the game does, until the first one rolls or SECONDS pass.
 * @param cars the cars
 * @param seconds how long
 * @returns the first car's first roll: its rate's sign (+ = toward its +y) or 0, and its first face
 */
function run(cars, seconds) {
  const first = { dir: 0, side: 0 };
  // every try meets a straight rail (a dent or tear from the last one would let it through)
  resetTrackside();
  for (let tick = 0; tick < seconds / DT; tick++) {
    for (const car of cars) {
      const vx0 = car.vx, vy0 = car.vy;
      clampWorld(car, DT);
      hit(car, vx0, vy0);
      L.applyGround(car, DT);
      if (rolling(car)) stepRoll(car, DT, (kind, side, weight) => {
        if (car === cars[0] && !first.side && kind === 'side') first.side = side;
        hitRoll(car, kind, side, weight);
      });
      else { step(car, idle, DT); tripCheck(car, DT); }
      stepDamage(car, DT);
    }
    const before = cars.map((car) => [car.vx, car.vy]);
    if (cars.length > 1) {
      carContacts(cars);
      cars.forEach((car, i) => hit(car, before[i][0], before[i][1]));
    }
    if (!first.dir && cars[0].roll) first.dir = Math.sign(cars[0].roll.w);
  }
  first.beyond = cars[0].y > 0.5;
  return first;
}

const tally = (name, wantDir, make) => {
  let rolls = 0, toward = 0, away = 0, beyond = 0;
  for (let i = 0; i < TRIES; i++) {
    const { dir, beyond: over } = run(make(), 3);
    if (over) beyond++;
    if (!dir) continue;
    rolls++;
    if (dir === wantDir) away++; else toward++;
  }
  return { name, rolls, toward, away, beyond };
};

// SLIDE: heading +x along the Armco (y = 0), the car's +y (left) side toward it, moving +y
const slide = tally('SLIDE into Armco', -1, () => {
  const car = makeCar('hatch-rwd');
  reset(car, 0, -4, 0);
  car.vx = 0; car.vy = SPEED;
  return [car];
});
// TBONE: the struck car heading +x at (0, -20), standing; the other heading +y into its right
// (-y) side, so the struck car is shoved toward its +y
const tbone = tally('TBONE by a car', 1, () => {
  const struck = makeCar('hatch-rwd'), hitter = makeCar('hatch-rwd');
  reset(struck, 0, -20, 0);
  reset(hitter, 0, -26, Math.PI / 2);
  hitter.vx = 0; hitter.vy = SPEED;
  return [struck, hitter];
});
// TUMBLE: already rolling hard toward the Armco at 8 m/s (under its dent / tear) - over it, or
// stopped by it (?rollover: physics/tumble.ts)
let over = 0;
for (let i = 0; i < TRIES; i++) {
  const car = makeCar('hatch-rwd');
  reset(car, 0, -2.2, 0);
  car.vx = 0; car.vy = 8;
  startRoll(car, 1, 12);
  run([car], 2);
  if (car.y > 2) over++;
}
// SLIDE: the impact is on the +y side; toward = +1. TBONE: the impact on the -y side; away = +1.
console.log(`${TRIES} tries at ${SPEED} m/s, a hatch:`);
console.log(`  SLIDE sideways into Armco: rolled ${slide.rolls}; over TOWARD the barrier`
  + ` ${slide.toward}, AWAY from it ${slide.away}; ended beyond the Armco ${slide.beyond}`);
console.log(`  TBONE by another car: rolled ${tbone.rolls}; AWAY from the hit ${tbone.away},`
  + ` TOWARD it ${tbone.toward}`);
console.log(`  TUMBLE into Armco at 8 m/s, rolling: over it ${over} of ${TRIES}`);
