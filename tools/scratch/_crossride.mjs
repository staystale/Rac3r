// _crossride.mjs - each crossing driven along at a speed: its rise, the car's highest and lowest
// ground height on it, and its time in the air (CROSSINGS=1)
import { makeCar, step, reset, PHYSICS_STEP_SECONDS } from '../../src/vehicle.ts';
import * as L from '../../src/lab.ts';
import { clampWorld } from '../../src/world/crossings.ts';
import { acrossOf } from '../../src/world/crossinggeo.ts';
L.setLevel(process.argv[2] || 'brands-snatch');
for (const kmh of [60, 90, 120]) L.LEVEL.crossings.forEach((way, index) => {
  const mid = (way.minAcross + way.maxAcross) / 2, head = Math.atan2(way.dirY, way.dirX);
  const car = makeCar('hatch-rwd');
  reset(car, way.ax - way.dirX * 3 - way.dirY * mid, way.ay - way.dirY * 3 + way.dirX * mid, head);
  const speed = kmh / 3.6;
  car.vx = way.dirX * speed; car.vy = way.dirY * speed;
  let air = 0, low = Infinity, high = -Infinity, on = false;
  for (let time = 0; time < (way.length + 6) / speed; time += PHYSICS_STEP_SECONDS) {
    clampWorld(car, PHYSICS_STEP_SECONDS);
    L.applyGround(car, PHYSICS_STEP_SECONDS);
    let err = head - car.heading - (acrossOf(way, car.x, car.y) - mid) * 0.08;
    err = Math.atan2(Math.sin(err), Math.cos(err));
    const now = Math.hypot(car.vx, car.vy);
    step(car, { steer: err * 2.5, throttle: now < speed ? 0.8 : 0, brake: 0, handbrake: 0 },
      PHYSICS_STEP_SECONDS);
    if (car.crossing === index) { on = true; low = Math.min(low, car.groundF);
      high = Math.max(high, car.groundF); if (car.air > 0) air += PHYSICS_STEP_SECONDS; }
  }
  console.log(`${kmh} km/h ${way.kind} ${index} (${way.length.toFixed(0)} m, rise ${way.rise
    .toFixed(2)} m): on ${on}, ground ${low.toFixed(2)}..${high.toFixed(2)} m, air ${air
    .toFixed(2)} s`);
});
