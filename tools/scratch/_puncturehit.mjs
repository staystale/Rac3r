// _puncturehit.mjs - A13: the chance ONE hit punctures a tyre, by how hard it is (damage.js hit:
// the speed the car loses in the step), head-on and side-on, 1000 trials each. The game rolls
// it the same whatever was hit (a tyre wall, armco, a tree, another car); with "kinds" it uses
// ?punctkind=1's table for a few kinds of thing.
// node tools/scratch/_puncturehit.mjs [car] [kinds]
import { makeCar } from '../../src/vehicle.ts';
import { hit } from '../../src/damage.js';
import { setPunctKind } from '../../src/physics/punctures.ts';

const carId = process.argv[2] || 'hatch-rwd', TRIALS = 1000;
const byKind = process.argv[3] === 'kinds';
setPunctKind(byKind);
const cases = byKind ? ['tyrestack', 'car', 'armco', 'tree', 'board', 'pallet'].map((kind) => [kind,
  false, kind]) : [['head-on', false, null], ['side-on', true, null]];
for (const [label, side, kind] of cases) {
  const row = [];
  for (const kmh of [10, 20, 30, 40, 60, 80]) {
    const lost = kmh / 3.6;
    let punctured = 0;
    for (let trial = 0; trial < TRIALS; trial++) {
      const car = makeCar(carId);
      car.heading = 0;
      // the car was doing `lost` m/s and the clamp stopped it (head-on: forward; side: sideways)
      const v0x = side ? 0 : lost, v0y = side ? lost : 0;
      car.vx = 0;
      car.vy = 0;
      car._hitKind = kind;
      hit(car, v0x, v0y);
      if (car.punct && car.punct.some(Boolean)) punctured++;
    }
    row.push(`${kmh} km/h ${(100 * punctured / TRIALS).toFixed(0)}%`);
  }
  console.log(`${label.padEnd(9)} speed lost in the hit -> chance of a puncture: ${row.join(', ')}`);
}
