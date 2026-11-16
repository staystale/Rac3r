// _glassthrow.mjs - A HARD CORNER HIT'S GLASS (world/debris.ts crashDebris, headless): per car,
// N seeded hits of one front corner (damage 0.5 added, side-on) on fresh ground: how often a
// window breaks, the cells of road glass it leaves and how far out they lie. Nothing in the game is
// changed. node tools/scratch/_glassthrow.mjs <cars, comma list> [hits, 200]  (NAME=1: a new car)
import * as L from '../../src/lab.ts';
import { makeCar, reset } from '../../src/vehicle.ts';
import { crashDebris } from '../../src/world/debris.ts';
import { clearWear, wearMap, WEAR_CELL } from '../../src/world/wear.ts';
import { parkMiller } from '../../src/core/random.ts';

const [carsArg = 'hatch-fwd', hitsArg = '200'] = process.argv.slice(2);
L.setLevel('thruston');
for (const id of carsArg.split(',')) {
  let broke = 0, cells = 0;
  for (let hit = 0; hit < Number(hitsArg); hit++) {
    clearWear();
    const car = makeCar(id);
    reset(car, 0, 0, 0);
    car.vx = 10;
    crashDebris(car, 0, 0.5, 0.1, parkMiller(hit + 1));
    const glass = [...wearMap.values()].filter((cell) => cell.cover === 'glass');
    if (glass.length) broke++;
    cells += glass.length;
  }
  console.log(`${id.padEnd(14)} windows broken ${broke} / ${hitsArg} | glass cells a break `
    + `${(cells / Math.max(1, broke)).toFixed(1)}`);
}
