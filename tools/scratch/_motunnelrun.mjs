// _motunnelrun.mjs - Moanaco's tunnel: a car down the race road through it (pure pursuit on the
// lap's line), its level and speed each second, what it hits (scratch)
import { makeCar, step, reset, PHYSICS_STEP_SECONDS } from '../../src/vehicle.ts';
import * as L from '../../src/lab.ts';
import { clampWorld } from '../../src/world/crossings.ts';
L.setLevel('moanaco');
const sub = L.LEVEL.subtrack, span = sub.under[0], speed = +(process.env.SPEED || 25);
const from = sub.pts.find((p) => p.dist >= span.d0 - 25);
const car = makeCar('hatch-rwd');
reset(car, from.x, from.y, from.heading);
let next = 0, hits = 0;
for (let time = 0; time < 30; time += PHYSICS_STEP_SECONDS) {
  clampWorld(car, PHYSICS_STEP_SECONDS);
  L.applyGround(car, PHYSICS_STEP_SECONDS);
  const ahead = L.querySubtrack(sub, car.x, car.y);
  const target = sub.pts[(ahead.seg + 12) % sub.pts.length];
  let err = Math.atan2(target.y - car.y, target.x - car.x) - car.heading;
  err = Math.atan2(Math.sin(err), Math.cos(err));
  const now = Math.hypot(car.vx, car.vy);
  step(car, { steer: Math.max(-1, Math.min(1, err * 1.2)), throttle: now < speed ? 0.7 : 0,
    brake: now > speed + 3 ? 0.3 : 0, handbrake: 0 }, PHYSICS_STEP_SECONDS);
  if (car._hitKind) { hits++; if (hits < 5) console.log('hit', car._hitKind, time.toFixed(2), ahead.trackDist.toFixed(0)); car._hitKind = null; }
  if (time >= next) {
    console.log(`t ${time.toFixed(0)} lap m ${ahead.trackDist.toFixed(0)} off ${ahead.dist.toFixed(1)} level ${car.crossing} ${now.toFixed(1)} m/s z ${(car.z ?? 0).toFixed?.(2)}`);
    next += 1;
  }
  if (ahead.trackDist > span.d1 + 60) break;
}
console.log('hits', hits, 'span', span.d0.toFixed(0), span.d1.toFixed(0));
