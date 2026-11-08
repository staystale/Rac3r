// _leakcheck.mjs - a car leaking water and oil fast driven through each bridge and tunnel: the
// ground under the way must take none of it (no new wet or oil cells between its ends); the
// crossing's own ground must (world/deckwear.ts), and a car on it must feel it.
// CROSSINGS=1 node tools/scratch/_leakcheck.mjs
import { makeCar, step, reset, PHYSICS_STEP_SECONDS } from '../../src/vehicle.ts';
import * as L from '../../src/lab.ts';
import { clampWorld } from '../../src/world/crossings.ts';
import { acrossOf } from '../../src/world/crossinggeo.ts';
import { deckCellsOf } from '../../src/world/deckwear.ts';
import { engineInit, stepEngine } from '../../src/physics/engineheat.ts';

L.setLevel(process.argv[2] || 'brands-snatch');
const ways = L.LEVEL.crossings;
const groundUnder = (way) => {
  let wet = 0, oil = 0;
  for (let along = 0; along <= way.length; along += 1)
    for (let across = way.minAcross; across <= way.maxAcross; across += 1) {
      const x = way.ax + way.dirX * along - way.dirY * across;
      const y = way.ay + way.dirY * along + way.dirX * across;
      const cell = L.getCell(Math.floor(x / L.WEAR_CELL), Math.floor(y / L.WEAR_CELL));
      if (cell && cell.cover === 'wet') wet++;
      if (cell && cell.cover === 'oil') oil++;
    }
  return { wet, oil };
};
const drive = (way, index, leak) => {
  const mid = (way.minAcross + way.maxAcross) / 2, car = makeCar('hatch-rwd');
  reset(car, way.ax - way.dirX * 4 - way.dirY * mid, way.ay - way.dirY * 4 + way.dirX * mid,
    Math.atan2(way.dirY, way.dirX));
  engineInit(car);
  if (leak) { car.engLeak = 0.2; car.oilLeak = 0.3; }
  car.vx = way.dirX * 8; car.vy = way.dirY * 8;
  const felt = new Set();
  for (let time = 0; time < (way.length + 4) / 8; time += PHYSICS_STEP_SECONDS) {
    clampWorld(car, PHYSICS_STEP_SECONDS);
    L.applyGround(car, PHYSICS_STEP_SECONDS);
    let err = Math.atan2(way.dirY, way.dirX) - car.heading - (acrossOf(way, car.x, car.y) - mid) * 0.08;
    err = Math.atan2(Math.sin(err), Math.cos(err));
    step(car, { steer: err * 2.5, throttle: Math.hypot(car.vx, car.vy) < 8 ? 0.5 : 0, brake: 0,
      handbrake: 0 }, PHYSICS_STEP_SECONDS);
    if (car.crossing === index) { stepEngine(car, PHYSICS_STEP_SECONDS); felt.add(car.surface.id); }
  }
  return felt;
};
ways.forEach((way, index) => {
  const before = groundUnder(way);
  drive(way, index, true);
  const after = groundUnder(way), cells = deckCellsOf(index);
  const wet = cells.filter((cell) => cell.cover === 'wet').length;
  const oil = cells.filter((cell) => cell.cover === 'oil').length;
  // a second car, not leaking, over what the first left
  const felt = drive(way, index, false);
  const ok = after.wet === before.wet && after.oil === before.oil && wet + oil > 0
    && [...felt].some((id) => id !== 'tarmac');
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${way.kind} ${index}: ground under it wet ${before.wet}->`
    + `${after.wet}, oil ${before.oil}->${after.oil}; its own ground: ${wet} wet, ${oil} oil cells;`
    + ` the next car felt ${[...felt].join(', ')}`);
});
