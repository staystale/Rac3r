// _bumperthrow.mjs - END-ON HITS. BUMPERS (world/debris.ts crashDebris, headless): per car, N seeded hits
// end-on (a bumper) at each corner: the wings thrown at each. Nothing in the
// game is changed. node tools/scratch/_bumperthrow.mjs <cars> [hits, 100]  (CARPARTS=1)
import * as L from '../../src/lab.ts';
import { makeCar, reset } from '../../src/vehicle.ts';
import { crashDebris } from '../../src/world/debris.ts';
import { parkMiller } from '../../src/core/random.ts';

const [carsArg = 'hatch-fwd', hitsArg = '100'] = process.argv.slice(2);
L.setLevel('thruston');
for (const id of carsArg.split(',')) {
  const bumpers = [0, 0, 0, 0];
  for (let hit = 0; hit < Number(hitsArg); hit++) {
    for (let corner = 0; corner < 4; corner++) {
      const car = makeCar(id);
      reset(car, 0, 0, 0);
      crashDebris(car, corner, 0.5, 0.95, parkMiller(hit * 4 + corner + 1));
      bumpers[corner] += (car.partSpawn || []).filter((part) => part.kind === 'bumper').length;
    }
  }
  console.log(`${id.padEnd(14)} bumpers thrown by corner (front L, front R, rear L, rear R): `
    + bumpers.join(' / ') + ` of ${hitsArg} hits each`);
}
