// _launch.mjs - 0-100 at each throttle cap (a feathered launch, full throttle once rolling at
// 15 m/s): the best launch vs flat out. MUSCLETYRES=1 node tools/scratch/_launch.mjs car tyre
import { makeCar, step, reset, PHYSICS_STEP_SECONDS as DT } from '../../src/vehicle.ts';
import { applyTyre } from '../../src/cars.ts';
import { SURFACES } from '../../src/lab.ts';
const [id = 'muscle-rwd', tyre = 'polyglass'] = process.argv.slice(2);
const out = [];
for (const cap of [1, 0.9, 0.8, 0.7, 0.6, 0.5]) {
  const c = makeCar(id); applyTyre(c.spec, tyre); reset(c, 0, 0, 0); c.tyreT = [85, 85, 85, 85];
  let t = 0, t100 = null;
  for (; t < 30 && t100 === null; t += DT) { c.surface = SURFACES.racetarmac;
    step(c, { steer: 0, throttle: c.t.vLong < 15 ? cap : 1, brake: 0, handbrake: 0 }, DT);
    if (c.t.vLong >= 27.78) t100 = t; }
  out.push(`${cap}: ${t100?.toFixed(1)}`);
}
console.log(`${id} ${tyre}  0-100 by launch throttle  ${out.join('  ')}`);
