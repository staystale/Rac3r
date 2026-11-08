// partcheck.mjs - COVERAGE OF THE CRASH PARTS (CLAUDE.md rule 12): every car of the roster is hit
// on every corner, end-on and side-on, rolled on every face and has every wheel torn off, with
// every chance forced to happen; each part it would throw must have its loose-object entry
// (cones/coneConsts.ts DEBRIS) and be thrown without an error (world/debris.ts throwParts). A part
// kind missing from the table threw in the sim step (the drive shaft, 11-07). And a torn catch
// fence's shreds (world/armcodent.ts SHRED_KINDS).
// node tools/partcheck.mjs        (built 11-08)
import { makeCar } from '../src/vehicle.ts';
import * as L from '../src/lab.ts';
import { ROSTER } from '../src/cars.ts';
import { DEBRIS } from '../src/cones/coneConsts.ts';
import { crashDebris, rollParts, throwParts, wheelBits } from '../src/world/debris.ts';
import { SHRED_KINDS } from '../src/world/armcodent.ts';

// on a level (a window's glass lands on its ground)
L.setLevel('lab');
const always = () => 0, kinds = new Map(), missing = new Set();
let errors = 0;
const realRandom = Math.random;
Math.random = always;
for (const row of ROSTER) {
  const car = makeCar(row.id);
  for (let corner = 0; corner < 4; corner++) {
    for (const endW of [0, 1]) crashDebris(car, corner, 1000, endW, always);
    wheelBits(car, corner, always);
  }
  for (const face of ['side', 'roof', 'wheels']) for (const side of [-1, 1])
    rollParts(car, face, side, 1);
  for (const { kind } of car.partSpawn || []) {
    kinds.set(kind, (kinds.get(kind) || 0) + 1);
    if (!DEBRIS[kind]) missing.add(`${kind} (${row.id})`);
  }
  const loose = { list: [], add(obj) { this.list.push(obj); } };
  try {
    throwParts([car], loose);
  } catch (err) {
    errors++;
    console.log(`FAIL ${row.id}: throwing its parts: ${err.message}`);
  }
}
Math.random = realRandom;
// a torn catch fence's shreds
for (const kind of SHRED_KINDS) {
  kinds.set(kind, (kinds.get(kind) || 0) + 1);
  if (!DEBRIS[kind]) missing.add(`${kind} (a torn catch fence)`);
}
console.log(`parts thrown: ${[...kinds].map(([kind, count]) => `${kind} ${count}`).join(', ')}`);
for (const entry of missing) console.log(`FAIL no DEBRIS entry for ${entry}`);
const bad = missing.size + errors;
console.log(bad ? `partcheck: ${bad} FAILED` : `partcheck: all ${kinds.size} kinds OK`);
process.exit(bad ? 1 : 0);
