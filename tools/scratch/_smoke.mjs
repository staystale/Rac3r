// _smoke.mjs - TYRE SMOKE and COLD MARKS as the renderer would draw them (particles.ts / marks.js
// formulas), scripted in the lab: a launch from cold (20 C) full throttle TCS off, a limit corner,
// an ABS stop and a locked stop from 100 km/h. Per phase: seconds smoking, puffs, seconds marking,
// rear tyre heat at the end. node tools/scratch/_smoke.mjs [cars,comma]
import { makeCar, step, reset, neutralInput, PHYSICS_STEP_SECONDS as DT } from '../../src/vehicle.ts';
import { SURFACES } from '../../src/world/surfaces.ts';
const ids = (process.argv[2] || 'hatch-fwd,hatch-rwd,muscle-rwd,lambo-awd,mini-fwd').split(',');
const SMOKE_T = 115, SLIP_FLOOR = 2.2;
function run(car, secs, input) {
  let smokeT = 0, puffs = 0, markT = 0, markA = 0;
  for (let t = 0; t < secs; t += DT) {
    step(car, input(car, t), DT);
    const wheels = [[car.t.slipSpeedF, car.tyreT[0]], [car.t.slipSpeedF, car.tyreT[1]],
      [car.t.slipSpeedR, car.tyreT[2]], [car.t.slipSpeedR, car.tyreT[3]]];
    let smoking = false, marking = false;
    for (const [slip, heat] of wheels) {
      if (heat >= SMOKE_T && slip >= 1.5) {
        smoking = true; puffs += Math.min(1, (heat - SMOKE_T) / 40 + 0.3) * Math.min(1, slip / 6) * 40 * DT;
      }
      if (slip > SLIP_FLOOR) {
        const warm0 = Math.pow(Math.max(0, Math.min(1, (heat - 35) / 55)), 1.5); const warm = process.env.SPINMARKS ? 0.35 + 0.65 * warm0 : warm0;
        const alpha = (0.05 + 0.30 * Math.min(1, (slip - SLIP_FLOOR) / 6)) * warm;
        if (alpha > 0.02) { marking = true; markA = Math.max(markA, alpha); }
      }
    }
    if (smoking) smokeT += DT; if (marking) markT += DT;
  }
  return `smoke ${smokeT.toFixed(1)}s ${Math.round(puffs)} puffs, marks ${markT.toFixed(1)}s (a ${markA.toFixed(2)}), tyres F ${car.tyreT[0].toFixed(0)} R ${car.tyreT[2].toFixed(0)} C, slipR ${car.t.slipSpeedR.toFixed(1)}`;
}
const fresh = (id, temp) => { const car = makeCar(id); reset(car, 0, 0, 0); car.surface = SURFACES.tarmac; car.tcsOn = false; car.tyreT = [temp, temp, temp, temp]; return car; };
for (const id of ids) {
  console.log(id);
  let car = fresh(id, 20);
  console.log('  launch cold 4s   ', run(car, 4, () => ({ ...neutralInput(), throttle: 1 })));
  car = fresh(id, 80); car.vx = 20; car.gear = 3;
  console.log('  corner 8s        ', run(car, 8, (c) => ({ ...neutralInput(), steer: 0.35, throttle: c.t.vLong < 20 ? 0.7 : 0.2 })));
  car = fresh(id, 80); car.vx = 27.8; car.gear = 4; car.absOn = true;
  console.log('  ABS stop         ', run(car, 5, () => ({ ...neutralInput(), brake: 1 })));
  car = fresh(id, 80); car.vx = 27.8; car.gear = 4; car.absOn = false;
  console.log('  locked stop      ', run(car, 5, () => ({ ...neutralInput(), brake: 1 })));
}
