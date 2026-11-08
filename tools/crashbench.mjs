// crashbench.mjs - THE PHYSICS UNDER LOAD (owner 11-08: "slams 20 ai cars in two rows of 10 into a
// 3 deep by 100 wide tyre wall against an Armco at like 120mph ... to really push the cost of the
// physics"). Its level (world/levels/crashbench.ts, the game's Festival of Splat): an Armco line 110 m long, in front of it a wall of tyre stacks
// 3 deep and 100 wide (300 stacks, the circuits' 'tyrestack'), and 20 cars of the roster in two
// rows of 10 launched at it at 120 mph, throttle held. Each physics step runs the game's own
// functions in the game's order (game/sim.ts, game/ai.ts): per car the world clamps, the hit's
// damage, the ground, the car or its roll, the bursts and damage; then car-to-car contact, the
// loose objects (the stacks, the wheels and parts thrown) and the parts' fade. Prints the cost of
// a step (median, p95, worst; the impact's second apart) and where it goes, and what happened
// (stacks knocked, cars rolled, damage).
// node tools/crashbench.mjs [seconds=5]       (built 11-08)
// node --cpu-prof --cpu-prof-dir=tools/scratch/prof tools/crashbench.mjs   for the hot functions
import { makeCar, step, reset, PHYSICS_STEP_SECONDS } from '../src/vehicle.ts';
import * as L from '../src/lab.ts';
import { ROSTER } from '../src/cars.ts';
import { createCones } from '../src/cones.ts';
import { carContacts } from '../src/contact.ts';
import { hit, hitRoll, applyBurst, stepDamage } from '../src/damage.ts';
import { rolling, tripCheck, stepRoll } from '../src/roll.ts';
import { throwParts, stepParts } from '../src/world/debris.ts';
import { clampWorld } from '../src/world/crossings.ts';
import {
  BENCH_LAUNCH, BENCH_PER_ROW, BENCH_TYRE_ROWS, benchSlot,
} from '../src/world/levels/crashbench.ts';

const SECONDS = +(process.argv[2] || 5), DT = PHYSICS_STEP_SECONDS;
// the same run every time (the bursts, trips and punctures draw on Math.random): its fingerprint
// shows whether a change kept every outcome
let seed = 12345;
Math.random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
// the scene: world/levels/crashbench.ts (the game's Festival of Splat), every car held flat out
L.setLevel('crash-bench');
const cones = createCones();
// 20 cars of the roster in turn, two rows of 10, nose to the wall, at speed (in the game the back
// row's middle one is yours: game/crashbench.ts)
const ids = ROSTER.map((row) => row.id), cars = [];
for (let row = 0; row < 2; row++)
  for (let slot = 0; slot < BENCH_PER_ROW; slot++) {
    const car = makeCar(ids[(row * BENCH_PER_ROW + slot) % ids.length]), start = benchSlot(row, slot);
    reset(car, start.x, start.y, start.heading);
    car.vy = BENCH_LAUNCH;
    cars.push(car);
  }
const held = { steer: 0, throttle: 1, brake: 0, handbrake: 0 };

// the cost of each phase, ms in all; each step's ms
const phase = { clamps: 0, ground: 0, carStep: 0, damage: 0, contacts: 0, loose: 0 };
const stepMs = [], impactMs = [];
const time = (name, work) => {
  const from = performance.now();
  work();
  phase[name] += performance.now() - from;
};
let firstImpact = -1;
for (let tick = 0; tick < SECONDS / DT; tick++) {
  const from = performance.now();
  for (const car of cars) {
    const v0x = car.vx, v0y = car.vy;
    time('clamps', () => clampWorld(car, DT));
    time('damage', () => hit(car, v0x, v0y));
    time('ground', () => L.applyGround(car, DT));
    time('carStep', () => {
      if (rolling(car)) stepRoll(car, DT, (kind, side, weight) => hitRoll(car, kind, side, weight));
      else { step(car, held, DT); tripCheck(car, DT); }
    });
    time('damage', () => { applyBurst(car); stepDamage(car, DT); });
  }
  const startVel = cars.map((car) => [car.vx, car.vy]);
  time('contacts', () => carContacts(cars));
  time('loose', () => {
    cones.step(cars, DT);
    throwParts(cars, cones);
    stepParts(cones, DT);
  });
  time('damage', () => cars.forEach((car, i) => hit(car, startVel[i][0], startVel[i][1])));
  const ms = performance.now() - from;
  stepMs.push(ms);
  if (firstImpact < 0 && cars.some((car) => car.y > BENCH_TYRE_ROWS[2] - 3)) firstImpact = tick;
  if (firstImpact >= 0 && tick - firstImpact < 1 / DT) impactMs.push(ms);
}

const stats = (list) => {
  const sorted = [...list].sort((a, b) => a - b);
  const at = (share) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * share))];
  return `median ${at(0.5).toFixed(2)} | p95 ${at(0.95).toFixed(2)} | worst ${sorted[sorted.length - 1]
    .toFixed(2)} ms`;
};
const total = stepMs.reduce((sum, ms) => sum + ms, 0);
const knocked = cones.list.filter((obj) => obj.kind !== 'tyrestack' || obj.moved).length;
const rolled = cars.filter((car) => car.roll).length;
const bill = cars.reduce((sum, car) => sum + (car.dmgBill || 0), 0);
console.log(`crashbench: 20 cars at 120 mph into 300 tyre stacks and Armco, ${SECONDS} s`
  + ` (${stepMs.length} steps of ${(DT * 1000).toFixed(2)} ms)`);
console.log(`  a step, all of it:      ${stats(stepMs)}`);
console.log(`  the impact's second:    ${stats(impactMs)}`);
console.log(`  where it goes: ${Object.entries(phase).map(([name, ms]) => `${name} ${(100 * ms / total)
  .toFixed(0)} %`).join(', ')}`);
const print = [...cars.map((car) => [car.x, car.y, car.heading]), ...cones.list.map((obj) => [obj.x, obj.y])]
  .flat().reduce((acc, value) => (Math.imul(acc, 31) + Math.round(value * 1000)) >>> 0, 7);
console.log(`  fingerprint of every car and object at the end: ${print.toString(16)}`);
console.log(`  what happened: ${knocked} loose objects moved or thrown (of ${cones.list.length}),`
  + ` ${rolled} cars rolled, damage bill ${bill.toFixed(0)}`);
