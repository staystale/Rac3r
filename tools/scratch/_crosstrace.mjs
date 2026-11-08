// _crosstrace.mjs - one crossing driven one way with the car's level, place and speed every 0.25 s
// and what it hit. CROSSINGS=1 node tools/scratch/_crosstrace.mjs <level> <index> <1|-1>
import { makeCar, step, reset, PHYSICS_STEP_SECONDS } from '../../src/vehicle.ts';
import * as L from '../../src/lab.ts';
import { clampWorld } from '../../src/world/crossings.ts';
import { alongOf, acrossOf } from '../../src/world/crossinggeo.ts';

const [levelId = 'brands-snatch', index = '3', dir = '1'] = process.argv.slice(2);
L.setLevel(levelId);
const way = L.LEVEL.crossings[+index], sign = +dir, mid = (way.minAcross + way.maxAcross) / 2;
const endB = [way.ax + way.dirX * way.length, way.ay + way.dirY * way.length];
console.log(`${way.kind} ${index}: A ${way.ax.toFixed(1)},${way.ay.toFixed(1)} B ${endB[0].toFixed(1)},`
  + `${endB[1].toFixed(1)} length ${way.length.toFixed(1)} walls ${way.minAcross.toFixed(2)}..`
  + `${way.maxAcross.toFixed(2)} cut ${way.cut}`);
const start = sign > 0 ? -8 : way.length + 8;
const car = makeCar('hatch-rwd');
reset(car, way.ax + way.dirX * start - way.dirY * mid, way.ay + way.dirY * start + way.dirX * mid,
  Math.atan2(way.dirY * sign, way.dirX * sign));
const head = Math.atan2(way.dirY * sign, way.dirX * sign);
for (let time = 0, next = 0; time < 12; time += PHYSICS_STEP_SECONDS) {
  clampWorld(car, PHYSICS_STEP_SECONDS);
  if (car._hitKind) console.log(`  t ${time.toFixed(2)} hit ${car._hitKind}`);
  car._hitKind = null;
  L.applyGround(car, PHYSICS_STEP_SECONDS);
  const off = (acrossOf(way, car.x, car.y) - mid) * sign;
  let err = head - car.heading - off * 0.08;
  err = Math.atan2(Math.sin(err), Math.cos(err));
  const now = Math.hypot(car.vx, car.vy);
  step(car, { steer: Math.max(-1, Math.min(1, err * 2.5)), throttle: now < 12 ? 0.6 : 0,
    brake: 0, handbrake: 0 }, PHYSICS_STEP_SECONDS);
  if (time >= next) {
    next += 0.25;
    console.log(`t ${time.toFixed(2)} level ${car.crossing} along ${alongOf(way, car.x, car.y)
      .toFixed(1)} across ${acrossOf(way, car.x, car.y).toFixed(2)} ${now.toFixed(1)} m/s`
      + ` ${car.surface.id}`);
  }
}
