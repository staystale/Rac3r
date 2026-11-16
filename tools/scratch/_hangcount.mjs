// _hangcount.mjs - ?dmgmore2 item 4 measured (world/hanging.ts): per car, CRASHES rear-end and
// front-end hits (damage.ts hit, the sizes renderhash's crash uses, scaled), then the car driven
// straight at 15 m/s on the Lab until everything hanging has dropped: how many exhausts were
// thrown vs left hanging, how far each hanging exhaust and bumper piece dragged before it dropped.
//   RANDOM_SEED=1 DMGMORE2=1 node --import ./tools/scratch/_seedrandom.mjs \
//     tools/scratch/_hangcount.mjs [cars] [crashes]
import { makeCar, reset } from '../../src/vehicle.ts';
import { damageInit, hit, stepDamage } from '../../src/damage.ts';
import * as lab from '../../src/lab.ts';
const [carsArg = 'hatch-fwd,saloon-rwd,estate-4x4', crashesArg = '200'] = process.argv.slice(2);
lab.setLevel('lab');
const DT = 1 / 120;
for (const id of carsArg.split(',')) {
  const tally = { exhaustThrown: 0, exhaustHung: 0, bumperHung: 0 }, exhaustM = [], bumperM = [];
  for (let n = 0; n < Number(crashesArg); n++) {
    lab.clearWear();
    const car = makeCar(id); reset(car, 0, 0, 0); damageInit(car);
    // (a rear-end hit and a front-end hit, harder each crash)
    const mag = 10 + (n % 10) * 2;
    for (const fore of [-1, 1]) {
      car.vx = 0; car.vy = 0;
      hit(car, -fore * mag, 0, DT, Math.random);
    }
    if ((car.partSpawn || []).some((part) => part.kind === 'exhaust')) tally.exhaustThrown++;
    const hungExhaust = car.exhaustHang > 0;
    if (hungExhaust) tally.exhaustHung++;
    car.partSpawn = [];
    // (drive: 15 m/s straight, the hanging parts stepped; the dropped ones noted by distance)
    let driven = 0;
    const bumperAt = {};
    for (let step = 0; step < 120 * 60; step++) {
      car.vx = 15; car.vy = 0; car.heading = 0; car.x += 15 * DT;
      stepDamage(car, DT);
      driven += 15 * DT;
      for (let corner = 0; corner < 4; corner++)
        if (car.bumperHang?.[corner] > 0 && bumperAt[corner] === undefined) bumperAt[corner] = -1;
      for (const corner of Object.keys(bumperAt))
        if (bumperAt[corner] === -1 && !(car.bumperHang[corner] > 0)) bumperAt[corner] = driven;
      if (hungExhaust && !car.exhaustHang && exhaustM.length < tally.exhaustHung)
        exhaustM.push(driven);
      if (!car.exhaustHang && !(car.bumperHang || []).some((left) => left > 0) && step > 240) break;
    }
    for (const at of Object.values(bumperAt)) { tally.bumperHung++; bumperM.push(at); }
  }
  const range = (list) => list.length ? `${Math.round(Math.min(...list))}-${Math.round(
    Math.max(...list))} m (mean ${Math.round(list.reduce((a, b) => a + b, 0) / list.length)})`
    : '-';
  const thrownOrHung = tally.exhaustThrown + tally.exhaustHung;
  console.log(id.padEnd(11), JSON.stringify(tally), 'hung share',
    thrownOrHung ? (tally.exhaustHung / thrownOrHung).toFixed(2) : '-', '| exhaust dragged',
    range(exhaustM), '| bumper piece dragged', range(bumperM));
}
