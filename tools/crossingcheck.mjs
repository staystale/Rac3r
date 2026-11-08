// crossingcheck.mjs - DRIVES EVERY BRIDGE AND TUNNEL of a level (world/crossings.ts) both ways:
// a car set 8 m out from an end on the way's line, steered along it at a steady speed. It must
// come onto the crossing at that end, stay between its walls, and leave by the far end on the
// ground. Then a car on the ground is driven at the same end from beside the ramp / portal (it must
// be stopped by the walls, never come on), and one is driven along the track under each crossing
// (it must stay on the ground).
// CROSSINGS=1 node tools/crossingcheck.mjs <level>        (built 11-08)
import { makeCar, step, reset, PHYSICS_STEP_SECONDS } from '../src/vehicle.ts';
import * as L from '../src/lab.ts';
import { clampWorld } from '../src/world/crossings.ts';
import { alongOf, acrossOf } from '../src/world/crossinggeo.ts';

const levelId = process.argv[2] || 'brands-snatch';
L.setLevel(levelId);
const ways = L.LEVEL.crossings || [];
console.log(`${levelId}: ${ways.length} crossings`);
if (!ways.length) process.exit(1);

/**
 * Steps a car with a steering law for some seconds.
 * @param car the car
 * @param want returns { steer, throttle, brake } for the car
 * @param seconds how long
 * @param watch called each step
 */
function drive(car, want, seconds, watch) {
  for (let time = 0; time < seconds; time += PHYSICS_STEP_SECONDS) {
    clampWorld(car);
    L.applyGround(car, PHYSICS_STEP_SECONDS);
    step(car, want(car), PHYSICS_STEP_SECONDS);
    watch(car);
  }
}

/**
 * A steering law holding a heading's line through a point at a speed.
 * @param way the crossing
 * @param sign 1 from A toward B, -1 back
 * @param offset m across the line held
 * @param speed m/s wanted
 * @returns the law
 */
const holdLine = (way, sign, offset, speed) => (car) => {
  const head = Math.atan2(way.dirY * sign, way.dirX * sign);
  const off = (acrossOf(way, car.x, car.y) - offset) * sign;
  let err = head - car.heading - off * 0.08;
  err = Math.atan2(Math.sin(err), Math.cos(err));
  const now = Math.hypot(car.vx, car.vy);
  return { steer: Math.max(-1, Math.min(1, err * 2.5)), throttle: now < speed ? 0.6 : 0,
    brake: now > speed + 3 ? 0.4 : 0, handbrake: 0 };
};

// m out from an end each run starts
const START_OUT_M = 8;
let bad = 0;
ways.forEach((way, index) => {
  const mid = (way.minAcross + way.maxAcross) / 2;
  for (const sign of [1, -1]) {
    const startAlong = sign > 0 ? -START_OUT_M : way.length + START_OUT_M;
    const car = makeCar('hatch-rwd');
    reset(car, way.ax + way.dirX * startAlong - way.dirY * mid,
      way.ay + way.dirY * startAlong + way.dirX * mid, Math.atan2(way.dirY * sign, way.dirX * sign));
    let came = false, left = false, worst = 0, hits = 0;
    drive(car, holdLine(way, sign, mid, 14), 5 + (way.length + START_OUT_M) / 10, (moved) => {
      if (moved.crossing === index) {
        came = true;
        worst = Math.max(worst, Math.abs(acrossOf(way, moved.x, moved.y) - mid));
        if (moved._hitKind) hits++;
        moved._hitKind = null;
      } else if (came && !left) left = true;
    });
    const along = alongOf(way, car.x, car.y), through = sign > 0 ? along > way.length
      : along < 0;
    const ok = came && left && through && car.crossing === -1;
    if (!ok) bad++;
    console.log(`${ok ? 'OK  ' : 'FAIL'} ${way.kind} ${index} ${sign > 0 ? 'A->B' : 'B->A'}`
      + ` ${way.length.toFixed(1)} m: on ${came}, off ${left} past the far end ${through},`
      + ` widest ${worst.toFixed(2)} m off the middle, ${hits} wall hits,`
      + ` ${Math.hypot(car.vx, car.vy).toFixed(1)} m/s out`);
  }
  // steered at a wall the whole way: the wall holds it on (never off the side, never through)
  for (const [wallName, aim] of [['lo', way.minAcross - 3], ['hi', way.maxAcross + 3]]) {
    const car = makeCar('hatch-rwd');
    reset(car, way.ax - way.dirX * START_OUT_M - way.dirY * mid,
      way.ay - way.dirY * START_OUT_M + way.dirX * mid, Math.atan2(way.dirY, way.dirX));
    let beyond = -Infinity, slipped = false, hits = 0;
    // on along the middle, then steered at the wall
    const law = (moved) => holdLine(way, 1, alongOf(way, moved.x, moved.y) < 3 ? mid : aim, 12)(moved);
    drive(car, law, 5 + (way.length + START_OUT_M) / 8, (moved) => {
      const along = alongOf(way, moved.x, moved.y), across = acrossOf(way, moved.x, moved.y);
      if (moved.crossing === index) {
        beyond = Math.max(beyond, across - way.maxAcross, way.minAcross - across);
        if (moved._hitKind) hits++;
      } else if (along > 0.5 && along < way.length - 0.5 && across > way.minAcross && across < way.maxAcross)
        slipped = true;
      moved._hitKind = null;
    });
    const ok = beyond < 0 && !slipped && hits > 0;
    if (!ok) bad++;
    console.log(`${ok ? 'OK  ' : 'FAIL'} ${way.kind} ${index} pressed on its ${wallName} wall:`
      + ` centre ${(-beyond).toFixed(2)} m inside it at the closest, ${hits} wall hits,`
      + ` fell off the level inside ${slipped}`);
  }
  // a car on the ground driven across the way just inside the end: the ramp's / cut's walls
  // stop it, it never comes on
  const car = makeCar('hatch-rwd'), cross = 3;
  reset(car, way.ax + way.dirX * cross - way.dirY * (way.maxAcross + 9),
    way.ay + way.dirY * cross + way.dirX * (way.maxAcross + 9),
    Math.atan2(-way.dirX, way.dirY));
  let cameOn = false;
  const side = (moved) => {
    const head = Math.atan2(-way.dirX, way.dirY);
    let err = head - moved.heading;
    err = Math.atan2(Math.sin(err), Math.cos(err));
    return { steer: err * 2, throttle: 0.5, brake: 0, handbrake: 0 };
  };
  drive(car, side, 4, (moved) => { if (moved.crossing === index) cameOn = true; });
  const pastWall = acrossOf(way, car.x, car.y) < way.maxAcross;
  if (cameOn || pastWall) bad++;
  console.log(`${cameOn || pastWall ? 'FAIL' : 'OK  '} ${way.kind} ${index} from the side:`
    + ` came on ${cameOn}, got past its wall ${pastWall}`);
});
// a car on the track under / over each crossing stays on the ground
const sub = L.LEVEL.subtrack;
ways.forEach((way, index) => {
  const hitAt = sub.pts.reduce((best, point) => {
    const along = alongOf(way, point.x, point.y), across = acrossOf(way, point.x, point.y);
    const score = Math.abs(across - (way.minAcross + way.maxAcross) / 2)
      + Math.max(0, -along, along - way.length);
    return score < best.score ? { score, point } : best;
  }, { score: Infinity, point: null });
  if (!hitAt.point || hitAt.score > 4) return;
  const from = sub.pts[(sub.pts.indexOf(hitAt.point) - 8 + sub.pts.length) % sub.pts.length];
  const car = makeCar('hatch-rwd');
  reset(car, from.x, from.y, from.heading);
  let cameOn = false;
  const law = (moved) => {
    const ahead = L.querySubtrack(sub, moved.x, moved.y);
    const target = sub.pts[(ahead.seg + 4) % sub.pts.length];
    let err = Math.atan2(target.y - moved.y, target.x - moved.x) - moved.heading;
    err = Math.atan2(Math.sin(err), Math.cos(err));
    const now = Math.hypot(moved.vx, moved.vy);
    return { steer: err * 2, throttle: now < 20 ? 0.6 : 0, brake: 0, handbrake: 0 };
  };
  drive(car, law, 4, (moved) => { if (moved.crossing !== -1) cameOn = true; });
  if (cameOn) bad++;
  console.log(`${cameOn ? 'FAIL' : 'OK  '} ${way.kind} ${index}: a car on the track beneath`
    + ` stays on the ground`);
});
console.log(bad ? `crossings: ${bad} FAILED` : 'crossings: all OK');
process.exit(bad ? 1 : 0);
