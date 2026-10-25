// _engine.mjs - car systems C3 (physics/engineheat.ts): the heat curves, headless.
// MEASURES: the hold with a full radiator (a crawl at full throttle on a 40 C day, a long flat-out
// run, idling), a cracked radiator (slow and fast leak, race-like driving): water empty, 105 /
// 115 C, power at 130 C, the seize; coasting once empty; an oil leak to the seize; and that every
// car kind in cars.ts has an exhaust spot (render/enginesmoke.ts).
// node tools/scratch/_engine.mjs
import { setEngine, engineInit, stepEngine, crackOnHit } from '../../src/physics/engineheat.ts';
import { WEATHER } from '../../src/world/weather.ts';
import { ROSTER } from '../../src/cars.ts';
import * as lab from '../../src/lab.js';
import { wearMap } from '../../src/world/wear.ts';

// the leaked water lands in the wear cells: a level's ground is needed (the Lab: one surface)
lab.setLevel('lab');
lab.clearWear();
const wetCells = () => [...wearMap.values()].filter((cell) => cell.cover === 'wet').length;

setEngine(true);
const DT = 1 / 120;
const spec = { redline: 7000, len: 4 };

function makeCar() {
  const car = { x: 0, y: 0, vx: 0, vy: 0, heading: 0, rpm: 1000, spec, throttleUsed: 0 };
  engineInit(car);
  return car;
}

/**
 * Drives a car by a schedule and reports the moments asked about.
 * @param {string} name the case
 * @param {object} car the car
 * @param {(t: number) => {speed: number, throttle: number, revs: number}} drive the schedule
 * @param {number} secs how long
 */
function run(name, car, drive, secs) {
  const marks = {};
  let maxT = 0;
  lab.clearWear();
  car.y = Math.random() * 1000;
  for (let step = 0; step * DT < secs; step++) {
    const t = step * DT, want = drive(t, car);
    car.vx = want.speed; car.throttleUsed = want.throttle; car.rpm = want.revs * spec.redline;
    car.x += car.vx * DT;
    stepEngine(car, DT);
    maxT = Math.max(maxT, car.engT);
    const note = (key, test) => { if (marks[key] === undefined && test) marks[key] = +t.toFixed(1); };
    note('water0', car.engWater <= 0);
    note('105C', car.engT >= 105);
    note('115C', car.engT >= 115);
    note('130C', car.engT >= 130);
    note('seized', car.engSeized);
    note('oilLow', car.engOil < 0.2);
  }
  console.log(`${name.padEnd(46)} end ${car.engT.toFixed(1)} C, max ${maxT.toFixed(1)} C, `
    + `pow ${car.engPowerK.toFixed(2)}, water ${Math.round(car.engWater * 100)} %  `
    + JSON.stringify(marks) + ` wet cells ${wetCells()}, driven ${Math.round(car.x)} m`);
}

const race = (t) => ({ speed: 35, throttle: 0.75, revs: 0.8 });
WEATHER.rain = 0;
for (const airC of [-5, 18, 40]) {
  WEATHER.tempC = airC;
  run(`full radiator, crawl flat out, air ${airC} C`, makeCar(),
    () => ({ speed: 1, throttle: 1, revs: 0.6 }), 300);
  run(`full radiator, 200 km/h flat out, air ${airC} C`, makeCar(),
    () => ({ speed: 55, throttle: 1, revs: 0.95 }), 300);
  run(`full radiator, idling, air ${airC} C`, makeCar(),
    () => ({ speed: 0, throttle: 0, revs: 0.12 }), 300);
}
WEATHER.tempC = 18;
for (const [label, add] of [['slow crack (hit 0.15)', 0.15], ['mid crack (hit 0.35)', 0.35],
  ['fast crack (hit 0.6)', 0.6]]) {
  const car = makeCar();
  crackOnHit(car, add, () => 0.99);
  run(`${label}, race driving, 18 C`, car, race, 600);
}
{
  const car = makeCar();
  crackOnHit(car, 0.6, () => 0.99);
  // race until 120 C, then coast at 20 m/s
  let coasting = false;
  run('fast crack, race to 120 C then coast', car, (t, c) => {
    if (c.engT >= 120) coasting = true;
    return coasting ? { speed: 20, throttle: 0, revs: 0.35 } : race(t);
  }, 400);
}
{
  WEATHER.rain = 1;
  const car = makeCar();
  crackOnHit(car, 0.6, () => 0.99);
  run('fast crack, race driving, heavy rain 10 C', car, race, 600);
  WEATHER.rain = 0;
}
{
  const car = makeCar();
  crackOnHit(car, 0.4, () => 0);   // rnd 0: the sump cracks too, fastest drain
  run('hit 0.4 + sump (oil 60 s)', car, race, 300);
}
const kinds = [...new Set(ROSTER.map((carDef) => carDef.kind))];
const { EXHAUST_SPOTS } = await import('../../src/render/enginesmoke.ts').catch(() => ({}));
if (EXHAUST_SPOTS) {
  const missing = kinds.filter((kind) => !EXHAUST_SPOTS[kind]);
  console.log(`exhaust spots: ${kinds.length} kinds, missing: ${missing.join(', ') || 'none'}`);
}
