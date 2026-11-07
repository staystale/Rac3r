// _rolltest.mjs - ?bigparts: what a ROLL sheds (damage.ts hitRoll -> world/debris.ts rollParts): a
// roll of N quarter turns (side, roof, side, wheels ...) at spin W rad/s easing 0.7 a face, 200 tries;
// each kind per 100 rolls. BIGPARTS=1 node tools/scratch/_rolltest.mjs [car] [quarters] [spin]
import * as L from '../../src/lab.ts';
import { makeCar, reset } from '../../src/vehicle.ts';
import { hitRoll } from '../../src/damage.ts';
L.setLevel('test-track');
const [id = 'hatch-fwd', quartersArg = '4', spinArg = '8'] = process.argv.slice(2);
const faces = ['side', 'roof', 'side', 'wheels'];
const tally = {};
for (let k = 0; k < 200; k++) {
  const car = makeCar(id); reset(car, 0, 0, 0);
  let spin = +spinArg;
  for (let q = 0; q < +quartersArg; q++) { hitRoll(car, faces[q % 4], q % 4 === 0 ? 1 : -1, spin); spin *= 0.7; }
  for (const part of car.partSpawn || []) tally[part.kind] = (tally[part.kind] || 0) + 1;
}
console.log(`${id} ${quartersArg} quarters from ${spinArg} rad/s: ` + Object.entries(tally).map(([kind, n]) => kind + ' ' + Math.round(n / 2)).join(', '));
