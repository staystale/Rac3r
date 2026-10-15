import * as L from '../../src/lab.js';
import { makeCar, step, reset, PHYSICS_STEP_SECONDS } from '../../src/vehicle.ts';
const { createCones } = await import('../../src/' + process.argv[2]);
const out = [];
for (const s0 of [1, 7, 42]) {
  let seed = s0; Math.random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  L.setLevel('stock-car'); const cc = createCones({ objectHits: true }); const car = makeCar('hatch-rwd'); reset(car, 100, 0, 0); car.vx = 22;
  for (let i = 0; i < 300; i++) { L.applyGround(car, PHYSICS_STEP_SECONDS); step(car, { throttle: 1, brake: 0, steer: 0 }, PHYSICS_STEP_SECONDS); cc.step(car, PHYSICS_STEP_SECONDS); }
  out.push(cc.list.filter((k) => k.moved).length);
}
console.log(process.argv[2], out.join(' '));
