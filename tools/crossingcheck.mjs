// crossingcheck.mjs - DRIVES EVERY BRIDGE AND TUNNEL of a level (world/crossings.ts) both ways:
// a car set 8 m out from an end on the way's line, steered along it at a steady speed. It must
// come onto the crossing at that end, stay between its walls, and leave by the far end on the
// ground. Then a car on the ground is driven at the same end from beside the ramp / portal (it must
// be stopped by the walls, never come on), and one is driven along the track under each crossing
// (it must stay on the ground).
// CROSSINGS=1 node tools/crossingcheck.mjs <level>        (built 11-08)
// node tools/crossingcheck.mjs highway [road] [scenery]  - the endless road: the autopilot drives
//   on until a drivable bridge has loaded, then each loaded one is checked
import { makeCar, step, reset, PHYSICS_STEP_SECONDS } from '../src/vehicle.ts';
import * as L from '../src/lab.ts';
import { clampWorld } from '../src/world/crossings.ts';
import { alongOf, acrossOf } from '../src/world/crossinggeo.ts';
import * as highway from '../src/highway.ts';
import { createAutoDriver } from '../src/ai/autodrive.ts';
import { solidClamp } from '../src/world/barriers.ts';

const levelId = process.argv[2] || 'brands-snatch';
if (levelId === 'highway') loadHighwayBridges(process.argv[3] || 'motorway', process.argv[4]
  || 'countryside');
else L.setLevel(levelId);
const ways = L.LEVEL.crossings || [];

/**
 * The endless road with drivable bridges, driven by the autopilot until two have loaded.
 * @param road the road type
 * @param scenery its scenery
 */
function loadHighwayBridges(road, scenery) {
  highway.addHighwayLevel();
  L.setLevel('highway');
  const level = L.LEVEL;
  highway.setHighwayPreset(level, road, scenery);
  highway.resetHighway(level);
  const car = makeCar('hatch-rwd');
  reset(car, level.spawn.x, level.spawn.y, level.spawn.heading);
  let sub = level.subtrack, driver = createAutoDriver(sub);
  const real = () => (level.crossings || []).filter((way) => way.length > 0).length;
  for (let time = 0; time < 600 && real() < 2; time += PHYSICS_STEP_SECONDS) {
    if (level.subtrack !== sub) { sub = level.subtrack; driver = createAutoDriver(sub); }
    L.applyGround(car, PHYSICS_STEP_SECONDS);
    step(car, driver.drive(car, PHYSICS_STEP_SECONDS), PHYSICS_STEP_SECONDS);
    solidClamp(car);
    highway.stepHighway(level, car, L.querySubtrack(sub, car.x, car.y).trackDist);
  }
  console.log(`highway ${road} ${scenery}: driven ${Math.round(level._hw.driven || 0)} m`);
}
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
    clampWorld(car, PHYSICS_STEP_SECONDS);
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

// A BENT TUNNEL (world/crossings.ts bentTunnel: Moanaco's, its walls along the race road's bend):
// driven along its road - the middle of its two walls - not along the straight line of its ends.
/** the tunnel's road: the middle of its two walls, A to B */
const roadOf = (way) => way.walls[0].pts.map(([x, y], i) => [(x + way.walls[1].pts[i][0]) / 2,
  (y + way.walls[1].pts[i][1]) / 2]);
/** m from the road's centre to each wall's face */
const halfOf = (way) => Math.hypot(way.walls[0].pts[0][0] - way.walls[1].pts[0][0],
  way.walls[0].pts[0][1] - way.walls[1].pts[0][1]) / 2 - 0.45;
/** the nearest road point: its index, the signed m off it (+ to the left), its heading */
function onRoad(road, x, y) {
  let best = 0, bestSq = Infinity;
  road.forEach(([px, py], i) => {
    const distSq = (px - x) ** 2 + (py - y) ** 2;
    if (distSq < bestSq) { bestSq = distSq; best = i; }
  });
  const [ax, ay] = road[Math.max(0, best - 1)], [bx, by] = road[Math.min(road.length - 1, best + 1)];
  const head = Math.atan2(by - ay, bx - ax), len = Math.hypot(bx - ax, by - ay) || 1;
  const off = ((y - road[best][1]) * (bx - ax) - (x - road[best][0]) * (by - ay)) / len;
  return { index: best, off, head };
}
/** a steering law along the bent road at an offset (+ left of A -> B), sign 1 A -> B */
const holdRoad = (road, sign, offsetAt, speed) => (car) => {
  const here = onRoad(road, car.x, car.y), head = here.head + (sign > 0 ? 0 : Math.PI);
  const off = (here.off - offsetAt(car)) * sign;
  let err = head - car.heading - off * 0.08;
  err = Math.atan2(Math.sin(err), Math.cos(err));
  const now = Math.hypot(car.vx, car.vy);
  return { steer: Math.max(-1, Math.min(1, err * 2.5)), throttle: now < speed ? 0.6 : 0,
    brake: now > speed + 3 ? 0.4 : 0, handbrake: 0 };
};

/**
 * Drives a bent tunnel both ways along its road, pressed on each wall, and from beside a portal.
 * @param way the crossing
 * @param index its index
 */
function checkBent(way, index) {
  const road = roadOf(way), half = halfOf(way), last = road.length - 1;
  const lead = (from, toward, out) => {
    const [ax, ay] = road[from], [bx, by] = road[toward], len = Math.hypot(bx - ax, by - ay);
    return [ax - (bx - ax) / len * out, ay - (by - ay) / len * out, Math.atan2(by - ay, bx - ax)];
  };
  for (const sign of [1, -1]) {
    const [x, y, head] = sign > 0 ? lead(0, 1, START_OUT_M) : lead(last, last - 1, START_OUT_M);
    const car = makeCar('hatch-rwd');
    reset(car, x, y, head);
    let came = false, left = false, worst = 0, hits = 0;
    drive(car, holdRoad(road, sign, () => 0, 14), 5 + (way.length * 1.2 + START_OUT_M) / 10,
      (moved) => {
        if (moved.crossing === index) {
          came = true;
          worst = Math.max(worst, Math.abs(onRoad(road, moved.x, moved.y).off));
          if (moved._hitKind) hits++;
          moved._hitKind = null;
        } else if (came && !left) left = true;
      });
    const end = onRoad(road, car.x, car.y).index, through = sign > 0 ? end === last : end === 0;
    const ok = came && left && through && car.crossing === -1;
    if (!ok) bad++;
    console.log(`${ok ? 'OK  ' : 'FAIL'} bent tunnel ${index} ${sign > 0 ? 'A->B' : 'B->A'}`
      + ` ${way.length.toFixed(1)} m: on ${came}, off ${left} past the far end ${through},`
      + ` widest ${worst.toFixed(2)} m off its road, ${hits} wall hits,`
      + ` ${Math.hypot(car.vx, car.vy).toFixed(1)} m/s out`);
  }
  for (const [wallName, aim] of [['left', half + 3], ['right', -half - 3]]) {
    const [x, y, head] = lead(0, 1, START_OUT_M), car = makeCar('hatch-rwd');
    reset(car, x, y, head);
    let beyond = -Infinity, slipped = false, hits = 0;
    const law = holdRoad(road, 1, (moved) => (onRoad(road, moved.x, moved.y).index < 3 ? 0 : aim),
      12);
    drive(car, law, 5 + way.length * 1.2 / 8, (moved) => {
      const here = onRoad(road, moved.x, moved.y);
      if (moved.crossing === index) {
        beyond = Math.max(beyond, Math.abs(here.off) - half);
        if (moved._hitKind) hits++;
      } else if (here.index > 1 && here.index < last - 1 && Math.abs(here.off) < half) slipped = true;
      moved._hitKind = null;
    });
    const ok = beyond < 0 && !slipped && hits > 0;
    if (!ok) bad++;
    console.log(`${ok ? 'OK  ' : 'FAIL'} bent tunnel ${index} pressed on its ${wallName} wall:`
      + ` centre ${(-beyond).toFixed(2)} m inside it at the closest, ${hits} wall hits,`
      + ` fell off the level inside ${slipped}`);
  }
  // a car on the ground driven at the first portal from beside it, both sides: stopped, never on
  for (const side of [1, -1]) {
    const here = onRoad(road, road[2][0], road[2][1]), out = (half + 9) * side;
    const nx = -Math.sin(here.head), ny = Math.cos(here.head), car = makeCar('hatch-rwd');
    reset(car, road[2][0] + nx * out, road[2][1] + ny * out, Math.atan2(-ny * side, -nx * side));
    let cameOn = false;
    const law = (moved) => {
      let err = Math.atan2(-ny * side, -nx * side) - moved.heading;
      err = Math.atan2(Math.sin(err), Math.cos(err));
      return { steer: err * 2, throttle: 0.5, brake: 0, handbrake: 0 };
    };
    drive(car, law, 4, (moved) => { if (moved.crossing === index) cameOn = true; });
    const pastWall = Math.abs(onRoad(road, car.x, car.y).off) < half;
    if (cameOn || pastWall) bad++;
    console.log(`${cameOn || pastWall ? 'FAIL' : 'OK  '} bent tunnel ${index} from the`
      + ` ${side > 0 ? 'left' : 'right'}: came on ${cameOn}, got past its wall ${pastWall}`);
  }
}

ways.forEach((way, index) => {
  // (an empty slot of the endless road's: highway/bridgeways.ts)
  if (!way.length) return;
  if (way.hidden) {
    checkBent(way, index);
    return;
  }
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
  // (a bent tunnel's road is the track itself: no road over it)
  if (way.hidden) return;
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
