// _parttest.mjs - how often a hit throws a part (world/debris.ts partOff), by car and hit: the
// same velocity change (head-on and side-on), 40 tries each, parts thrown per try.
// node tools/scratch/_parttest.mjs [cars]
import * as L from '../../src/lab.ts';
import { makeCar, reset } from '../../src/vehicle.ts';
import { hit } from '../../src/damage.ts';
L.setLevel('test-track');
const cars = (process.argv[2] || 'hatch-fwd,track-rwd,muscle-rwd').split(',');
for (const id of cars) for (const [name, dir] of [['head-on', [1, 0]], ['side-on', [0, 1]]]) {
  const row = [];
  for (const dv of [5, 8, 12, 18]) {
    let parts = 0, wheels = 0;
    for (let k = 0; k < 40; k++) {
      const car = makeCar(id); reset(car, 0, 0, 0);
      const vx0 = dir[0] * dv, vy0 = dir[1] * dv;
      car.vx = 0; car.vy = 0;
      hit(car, vx0, vy0);
      parts += (car.partSpawn || []).length; wheels += (car.wheelSpawn || []).length;
    }
    row.push(`dv ${dv}: ${(parts / 40).toFixed(2)} parts${wheels ? ', ' + (wheels / 40).toFixed(2) + ' wheels' : ''}`);
  }
  console.log(id.padEnd(11), name.padEnd(8), row.join(' | '));
}
