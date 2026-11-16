// _doorthrow.mjs - SIDE HITS' DOORS (world/debris.ts crashDebris, headless): per car, N seeded
// side-on hits (damage 0.5 added) at each of the four corners: the doors (panels) thrown at each.
// Nothing in the game is changed. node tools/scratch/_doorthrow.mjs <cars> [hits, 100]
// (CARPARTS=1: each car's own doors)
import * as L from '../../src/lab.ts';
import { makeCar, reset } from '../../src/vehicle.ts';
import { crashDebris } from '../../src/world/debris.ts';
import { parkMiller } from '../../src/core/random.ts';

const [carsArg = 'hatch-fwd', hitsArg = '100'] = process.argv.slice(2);
L.setLevel('thruston');
for (const id of carsArg.split(',')) {
  const doors = [0, 0, 0, 0];
  for (let hit = 0; hit < Number(hitsArg); hit++) {
    for (let corner = 0; corner < 4; corner++) {
      const car = makeCar(id);
      reset(car, 0, 0, 0);
      crashDebris(car, corner, 0.5, 0.05, parkMiller(hit * 4 + corner + 1));
      doors[corner] += (car.partSpawn || []).filter((part) => part.kind === 'panel').length;
    }
  }
  console.log(`${id.padEnd(14)} doors thrown by corner (front L, front R, rear L, rear R): `
    + doors.join(' / ') + ` of ${hitsArg} hits each`);
}
