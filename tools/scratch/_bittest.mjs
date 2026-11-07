// _bittest.mjs - ?bigparts: what a hit throws (world/debris.ts partOff + bigParts + wheelBits), by
// car, hit direction and speed change: 200 tries each, each kind's count per 100 hits.
// BIGPARTS=1 node tools/scratch/_bittest.mjs [cars]
import * as L from '../../src/lab.ts';
import { makeCar, reset } from '../../src/vehicle.ts';
import { hit } from '../../src/damage.ts';
L.setLevel('test-track');
const cars = (process.argv[2] || 'hatch-fwd,lambo-awd,track-rwd').split(',');
for (const id of cars) for (const [name, dir] of [['front', [1, 0]], ['rear', [-1, 0]], ['side', [0, 1]]]) {
  const row = [];
  for (const dv of [8, 14, 22]) {
    const tally = {};
    for (let k = 0; k < 200; k++) {
      const car = makeCar(id); reset(car, 0, 0, 0);
      car.vx = 0; car.vy = 0;
      hit(car, dir[0] * dv, dir[1] * dv);
      for (const part of car.partSpawn || []) tally[part.kind] = (tally[part.kind] || 0) + 1;
      if (car.wheelSpawn?.length) tally.wheel = (tally.wheel || 0) + car.wheelSpawn.length;
    }
    row.push(`dv ${dv}: ` + (Object.entries(tally).map(([kind, n]) => kind + ' ' + Math.round(n / 2)).join(', ') || '-'));
  }
  console.log(id.padEnd(10), name.padEnd(6), row.join(' | '));
}
