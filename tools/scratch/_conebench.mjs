// throwaway: the loose objects' step cost on a level, 21 cars lapping on its centreline
// (positions set each step at 50 m/s, 8 m apart) - us a step, and a hash of every object's state
// node tools/scratch/_conebench.mjs <level> [steps]   (PERFPASS=1 for the switch)
import { createHash } from 'node:crypto';
let seed = 99;
Math.random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
const L = await import('../../src/lab.ts');
const WORLD = await import('../../src/world/state.ts');
const { makeCar, reset } = await import('../../src/vehicle.ts');
const { createCones } = await import('../../src/cones.ts');
const { PHYSICS_STEP_SECONDS: DT } = await import('../../src/vehicle.ts');
const id = process.argv[2] || 'spa', steps = +(process.argv[3] || 2400);
L.setLevel(id);
const level = WORLD.LEVEL, sub = level.subtrack, cones = createCones();
const cars = [];
for (let k = 0; k < 21; k++) { const car = makeCar('saloon-rwd'); cars.push(car); }
const place = (car, dist, lane) => {
  const pts = sub.pts, total = sub.totalDist, at = ((dist % total) + total) % total;
  let i = 0; while (i < pts.length - 1 && pts[i + 1].dist <= at) i++;
  const p = pts[i], q = pts[(i + 1) % pts.length];
  const head = Math.atan2(q.y - p.y, q.x - p.x);
  car.x = p.x + p.nx * lane; car.y = p.y + p.ny * lane; car.heading = head;
  car.vx = Math.cos(head) * 50; car.vy = Math.sin(head) * 50; car.yawRate = 0;
};
for (const car of cars) reset(car, 0, 0, 0);
const times = [], carHash = createHash("sha256");
for (let tick = 0; tick < steps; tick++) {
  cars.forEach((car, k) => place(car, tick * DT * 50 + k * 8, (k % 7 - 3) * (+process.env.SPREAD || 3)));
  const t0 = performance.now();
  cones.step(cars, DT);
  times.push(performance.now() - t0);
  for (const car of cars) carHash.update([car.vx, car.vy, car.yawRate].join());
}
const hash = createHash('sha256');
for (const obj of cones.list) hash.update([obj.x, obj.y, obj.vx, obj.vy, obj.ang, obj.down].join());
times.sort((a, b) => a - b);
const mean = times.reduce((a, b) => a + b, 0) / times.length;
console.log(`${id}: ${cones.list.length} objects, moved ${cones.list.filter((o) => o.moved).length} | ` +
  `step us mean ${(mean * 1000).toFixed(0)} median ${(times[times.length >> 1] * 1000).toFixed(0)} | ` +
  `switch ${process.env.PERFPASS || 0} | objects ${hash.digest('hex').slice(0, 16)} cars ${carHash.digest('hex').slice(0, 16)}`);
