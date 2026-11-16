// _rollthrow.mjs - what ROLLS throw (damage.ts hitRoll: physics/openwheel.ts rollRipWheels, world/
// debris.ts rollParts / wheelBits): per car, ROLLS rolls from rest-free starts stepped through
// roll.ts, each with a fresh car; the wheels torn off by the face that hit (side / roof / back on
// its wheels) and every part thrown, by kind. Seeded for an off / on pair:
//   RANDOM_SEED=1 [UNDERSKIN=1] node --import ./tools/scratch/_seedrandom.mjs \
//     tools/scratch/_rollthrow.mjs [cars] [rolls]
import { makeCar, reset } from '../../src/vehicle.ts';
import { startRoll, stepRoll } from '../../src/roll.ts';
import { damageInit, hitRoll } from '../../src/damage.ts';
import * as lab from '../../src/lab.ts';
const [carsArg = 'hatch-fwd,saloon-rwd,track-rwd', rollsArg = '300'] = process.argv.slice(2);
// (the Lab: open grass, nothing to hit)
lab.setLevel('lab');
for (const id of carsArg.split(',')) {
  const wheels = { side: 0, roof: 0, wheels: 0 }, faces = { side: 0, roof: 0, wheels: 0 };
  const kinds = {}, landing = { match: 0, other: 0 };
  for (let n = 0; n < Number(rollsArg); n++) {
    lab.clearWear();
    const car = makeCar(id); reset(car, 0, 0, 0); damageInit(car);
    car.vx = 0; car.vy = 9; car.surface = { id: 'grass' };
    startRoll(car, n % 2 ? 1 : -1, 6 + (n % 9));
    for (let step = 0; step < 4000 && car.roll && car.roll.phase === 'rolling'; step++) {
      stepRoll(car, 1 / 120, (kind, side, weight) => {
        const before = car.wheelOff.map(Boolean);
        faces[kind]++;
        hitRoll(car, kind, side, weight);
        car.wheelOff.forEach((off, corner) => {
          if (!off || before[corner]) return;
          wheels[kind]++;
          if (kind === 'wheels') landing[(corner % 2 ? 1 : -1) === side ? 'match' : 'other']++;
        });
      });
    }
    for (const part of car.partSpawn || []) kinds[part.kind] = (kinds[part.kind] || 0) + 1;
  }
  console.log(id.padEnd(11), 'impacts', JSON.stringify(faces), 'wheels off', JSON.stringify(wheels),
    'landing side', JSON.stringify(landing), 'parts', JSON.stringify(kinds));
}
