// throwaway: the barrier clamp switch off vs on - run with PERFPASS unset and PERFPASS=1, compare
// the printed hashes. Cars of every roster model thrown at random barrier segments of each level
// (5-45 m/s, any heading), stepped with clampWorld, dents and tears included.
// node tools/scratch/_barriergrid.mjs [levels]
import { createHash } from 'node:crypto';
let seed = 12345;
Math.random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
const { makeCar, step, reset, PHYSICS_STEP_SECONDS: DT } = await import('../../src/vehicle.ts');
const L = await import('../../src/lab.ts');
const { ROSTER } = await import('../../src/cars.ts');
const { clampWorld } = await import('../../src/world/crossings.ts');
const WORLD = await import('../../src/world/state.ts');
const { prepBarriersOf, resetTrackside } = await import('../../src/world/barriers.ts');
const { addStageLevels } = await import('../../src/stagegen.ts');
addStageLevels();
const ids = ROSTER.map((spec) => spec.id);
const levels = (process.argv[2] || 'spa,sillystone,suzuka,lemans,brands-snatch,xgayms,thruston')
  .split(',');
const hash = createHash('sha256');
const fields = (car) => [car.x, car.y, car.vx, car.vy, car.heading, car.yawRate]
  .map((value) => Math.round(value * 1e9)).join(',');
let hits = 0, calls = 0;
for (const id of levels) {
  L.setLevel(id);
  prepBarriersOf(WORLD.LEVEL);
  const segs = [];
  for (const barrier of WORLD.LEVEL.barriers || []) for (const seg of barrier._segs || []) segs.push(seg);
  if (!segs.length) { console.log(id + ": no barrier segments"); continue; }
  for (let run = 0; run < 400; run++) {
    const seg = segs[Math.floor(Math.random() * segs.length)], frac = Math.random();
    const len = Math.sqrt(seg.l2) || 1, nx = -seg.dy / len, ny = seg.dx / len;
    const side = Math.random() < 0.5 ? -1 : 1, off = side * (1 + Math.random() * 4);
    const car = makeCar(ids[run % ids.length]);
    reset(car, seg.ax + seg.dx * frac + nx * off, seg.ay + seg.dy * frac + ny * off,
      Math.random() * Math.PI * 2);
    const speed = 5 + Math.random() * 40, aim = Math.atan2(-ny * side, -nx * side)
      + (Math.random() - 0.5) * 1.6;
    car.vx = Math.cos(aim) * speed; car.vy = Math.sin(aim) * speed;
    for (let tick = 0; tick < 90; tick++) {
      const vx0 = car.vx;
      clampWorld(car, DT);
      calls++;
      if (car.vx !== vx0) hits++;
      step(car, { steer: 0, throttle: 0.3, brake: 0, handbrake: 0 }, DT);
      hash.update(fields(car));
    }
  }
  for (const barrier of WORLD.LEVEL.barriers || []) hash.update(JSON.stringify(barrier.pts));
  resetTrackside();
}
console.log(`switch ${process.env.PERFPASS || 0}: ${calls} clamps, ${hits} hits | ${hash.digest('hex').slice(0, 24)}`);
