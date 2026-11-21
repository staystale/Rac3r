// _leaks.mjs - measured (physics/engineheat.ts, physics/leakplaces.ts): per car,
// the radiator's and the sump's drain time after one front hit of each size, and after a second
// hit widens the crack; then where the leaks land - the car parked on the Lab, heading +x, its
// leaks stepped: the wet and oil cells' places along the car (m ahead of its middle, cells 1.5 m).
//   [DMGMORE2=1] node tools/scratch/_leaks.mjs [cars]
import { makeCar, reset } from '../../src/vehicle.ts';
import { damageInit, stepDamage } from '../../src/damage.ts';
import { crackOnHit } from '../../src/physics/engineheat.ts';
import { wearMap, WEAR_CELL } from '../../src/world/wear.ts';
import * as lab from '../../src/lab.ts';
const [carsArg = 'hatch-fwd,rally-4x4,lambo-awd'] = process.argv.slice(2);
lab.setLevel('lab');
const drain = (rate) => (rate > 0 ? Math.round(1 / rate) + ' s' : '-');
for (const id of carsArg.split(',')) {
  const rows = [];
  for (const add of [0.35, 0.6, 0.8]) {
    const car = makeCar(id); reset(car, 0, 0, 0); damageInit(car);
    crackOnHit(car, add, () => 0);
    const once = [car.engLeak, car.oilLeak];
    crackOnHit(car, 0.4, () => 0);
    rows.push(`hit ${add}: water ${drain(once[0])} oil ${drain(once[1])}; + a 0.4 hit: water `
      + `${drain(car.engLeak)} oil ${drain(car.oilLeak)}`);
  }
  lab.clearWear();
  const car = makeCar(id); reset(car, 30, 30, 0); damageInit(car);
  car.engLeak = 1 / 30; car.oilLeak = 1 / 30; car.engT = 90;
  for (let step = 0; step < 120 * 20; step++) stepDamage(car, 1 / 120);
  const places = { wet: new Set(), oil: new Set() };
  for (const cell of wearMap.values()) {
    if (cell.cover !== 'wet' && cell.cover !== 'oil') continue;
    const along = (cell.cx + 0.5) * WEAR_CELL - car.x, across = (cell.cy + 0.5) * WEAR_CELL - car.y;
    places[cell.cover].add(`${along.toFixed(2)}/${across.toFixed(2)}`);
  }
  console.log(id, '\n  ' + rows.join('\n  '), `\n  cells (ahead/right m): wet ${[...places.wet]
    .join(' ')} | oil ${[...places.oil].join(' ')}`);
}
