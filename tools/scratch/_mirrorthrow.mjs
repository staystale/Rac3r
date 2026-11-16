// _mirrorthrow.mjs - SIDE HITS. MIRRORS (world/debris.ts crashDebris, headless): per car, N seeded hits
// side-on (a mirror, MIRROR_P) at each corner: the wings thrown at each. Nothing in the
// game is changed. node tools/scratch/_mirrorthrow.mjs <cars> [hits, 100]  (CARPARTS=1)
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
      const rnd = parkMiller(hit * 4 + corner + 1);
      rnd();   // (a Park-Miller stream's first draw is tiny for a small seed)
      crashDebris(car, corner, 0.6, 0.05, rnd);
      bumpers[corner] += (car.partSpawn || []).filter((part) => part.kind === 'mirror').length;
    }
  }
  console.log(`${id.padEnd(14)} mirrors thrown by corner (front L, front R, rear L, rear R): `
    + bumpers.join(' / ') + ` of ${hitsArg} hits each`);
}
