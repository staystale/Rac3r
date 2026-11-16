// _vanparts.mjs - THE BUS'S AND THE VANS' OWN PARTS (world/debris.ts, headless): per vehicle, N
// seeded hard hits - side-on at each corner (the side panels) and end-on at the back (the rear
// doors), and rolls onto the roof - what each throws, and the glass cells a broken window leaves.
// Nothing in the game is changed. node tools/scratch/_vanparts.mjs <ids> [hits, 100]  (CARPARTS=1)
import * as L from '../../src/lab.ts';
import { makeCar, reset } from '../../src/vehicle.ts';
import { crashDebris, rollParts } from '../../src/world/debris.ts';
import { clearWear, wearMap } from '../../src/world/wear.ts';
import { parkMiller } from '../../src/core/random.ts';

const [idsArg = 'transfit-van,routemonster', hitsArg = '100'] = process.argv.slice(2);
L.setLevel('thruston');
const count = (list) => Object.entries(list.reduce((all, part) => {
  all[part] = (all[part] || 0) + 1; return all; }, {})).map(([part, n]) => `${part} ${n}`).join(', ');
for (const id of idsArg.split(',')) {
  const sides = [[], [], [], []], ends = [], roofs = [];
  let glassCells = 0, breaks = 0;
  for (let hit = 0; hit < Number(hitsArg); hit++) {
    for (let corner = 0; corner < 4; corner++) {
      clearWear();
      const car = makeCar(id); reset(car, 0, 0, 0); car.vx = 8;
      crashDebris(car, corner, 0.6, 0.05, parkMiller(hit * 8 + corner + 1));
      sides[corner].push(...(car.partSpawn || []).map((part) => part.kind + ':' + part.corner));
      const glass = [...wearMap.values()].filter((cell) => cell.cover === 'glass').length;
      if (glass) { breaks++; glassCells += glass; }
    }
    const car = makeCar(id); reset(car, 0, 0, 0);
    for (const corner of [2, 3]) crashDebris(car, corner, 0.9, 0.95, parkMiller(hit * 8 + 5 + corner));
    ends.push(...(car.partSpawn || []).map((part) => part.kind + ':' + part.corner));
    const rolled = makeCar(id); reset(rolled, 0, 0, 0);
    for (let i = 0; i < 6; i++) rollParts(rolled, 'roof', 1, 1);
    roofs.push(...(rolled.partSpawn || []).filter((part) => part.kind === 'boot')
      .map((part) => part.kind + ':' + part.corner));
  }
  console.log(`${id}: side hits by corner - ` + sides.map((list, corner) => `[${corner}] `
    + (count(list.filter((name) => name.startsWith('panel'))) || 'no panel')).join(' | '));
  console.log(`  end-on at the back: ${count(ends.filter((name) => name.startsWith('boot'))) || 'no boot'}`
    + ` | on its roof: ${count(roofs) || 'no boot'} | glass cells a break ${(glassCells / Math.max(1, breaks)).toFixed(1)}`);
}
