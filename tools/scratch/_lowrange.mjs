// _lowrange.mjs - ?lowrange=1 (physics/lowrange.ts) measured: each car with a two-speed box, a
// standing start flat out (TCS as fitted) on dirt / mud / thick mud / sand, flat and up a GRADE
// (default 0.25: a 1 in 4 slope), HIGH against LOW: the metres made in 10 s and the speed then;
// and the top speed in low on tarmac (40 s flat out). Run with LOWRANGE=1 (off, low is not there).
// node tools/scratch/_lowrange.mjs [cars] [grades]
import { makeCar, step, reset, PHYSICS_STEP_SECONDS as DT } from '../../src/vehicle.ts';
import { SURFACES } from '../../src/world/surfaces.ts';
const cars = (process.argv[2] || 'defunder-110,strange-l322').split(',');
const grades = (process.argv[3] || '0,0.25,0.4').split(',').map(Number);
/** One run: metres in `seconds`, the speed at its end (km/h). */
function run(id, surface, grade, low, seconds) {
  const car = makeCar(id); reset(car, 0, 0, 0); car.tyreT = [60, 60, 60, 60]; car.lowRange = low;
  let metres = 0, speed = 0;
  for (let time = 0; time < seconds; time += DT) {
    car.surface = SURFACES[surface];
    car.slopeLong = -car.spec.mass * 9.81 * Math.sin(Math.atan(grade));
    step(car, { steer: 0, throttle: 1, brake: 0, handbrake: 0 }, DT);
    metres += car.t.vLong * DT;
    speed = car.t.vLong;
  }
  return `${metres.toFixed(0)} m ${Math.round(speed * 3.6)} km/h`;
}
console.log(`lowrange ${process.env.LOWRANGE ? 'ON' : 'off'}: 10 s flat out from rest, HIGH -> LOW`);
for (const id of cars) {
  for (const grade of grades) {
    const row = (process.env.SURFACES || 'dirt,mud,thickMud,sand').split(',').filter((surface) => SURFACES[surface])
      .map((surface) => `${surface} ${run(id, surface, grade, false, 10)} -> ${run(id, surface, grade, true, 10)}`);
    console.log(`  ${id.padEnd(13)} grade ${grade}: ${row.join(' | ')}`);
  }
  console.log(`  ${id.padEnd(13)} top speed on tarmac (40 s): high ${run(id, 'tarmac', 0, false, 40)}, low ${run(id, 'tarmac', 0, true, 40)}`);
}
