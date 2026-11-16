// _rearparts.mjs - HARD HITS AT THE BACK (world/debris.ts crashDebris, headless): per car, N seeded
// end-on hits at each rear corner and six rolls onto the roof - its rear lids thrown (by kind and
// corner) and the loose wheels to throw (a spare: corner 4). Nothing in the game is changed.
// node tools/scratch/_rearparts.mjs <cars> [hits, 100]  (CARPARTS=1)
import * as L from '../../src/lab.ts';
import { makeCar, reset } from '../../src/vehicle.ts';
import { crashDebris, rollParts } from '../../src/world/debris.ts';
import { parkMiller } from '../../src/core/random.ts';

const [carsArg = 'defunder-110', hitsArg = '100'] = process.argv.slice(2);
L.setLevel('thruston');
const tally = (list) => Object.entries(list.reduce((all, name) => {
  all[name] = (all[name] || 0) + 1; return all; }, {})).map(([name, n]) => `${name} ${n}`).join(', ');
for (const id of carsArg.split(',')) {
  const lids = [], spares = [], rolled = [];
  for (let hit = 0; hit < Number(hitsArg); hit++) {
    const car = makeCar(id); reset(car, 0, 0, 0);
    for (const corner of [2, 3]) {
      const rnd = parkMiller(hit * 2 + corner + 1); rnd();
      crashDebris(car, corner, 0.9, 0.95, rnd);
    }
    lids.push(...(car.partSpawn || []).filter((part) => ['boot', 'spoiler'].includes(part.kind))
      .map((part) => part.kind + ':' + part.corner));
    spares.push(...(car.wheelSpawn || []).map((corner) => 'wheel:' + corner));
    const roof = makeCar(id); reset(roof, 0, 0, 0);
    for (let i = 0; i < 6; i++) rollParts(roof, 'roof', 1, 1);
    rolled.push(...(roof.partSpawn || []).filter((part) => ['boot', 'spoiler'].includes(part.kind))
      .map((part) => part.kind + ':' + part.corner));
  }
  console.log(`${id.padEnd(14)} end-on: ${tally(lids) || 'no lid'} | loose: ${tally(spares) || 'none'}`
    + ` | on its roof: ${tally(rolled) || 'no lid'}`);
}
