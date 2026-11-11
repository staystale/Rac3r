// cones/coneStep.ts: one simulation step of the loose objects: motion by mode (roll, flip,
// wobble, flat slide), spin, the floor, the cars' hits, then the object-object collisions.
import { FX0, FX1, FY0, FY1 } from "../world/bounds.ts";
import { BROKEN, DRAG, REST_V, SLEEP_V, SPIN_DRAG, TUMBLE_AHEAD_M, TUMBLE_EASE,
  TUMBLE_GUST, TUMBLE_SPINUP_S } from "./coneConsts.ts";
import { hitWalls } from "./coneWalls.ts";
import { hitByCar } from "./coneCar.ts";
import { stepTape } from "./coneTape.ts";
import { OBJ_CELL, cellKey, collideObjects } from "./coneGrid.ts";
import type { ConesCtx, Loose, ConeCar } from './coneTypes.ts';

/**
 * A rolling tyre: low rolling resistance on the tread edge, wobbling below 3.2 m/s.
 * @param obj the tyre
 * @param dt step seconds
 * @param speed its speed
 */
function moveRoll(obj: Loose, dt: number, speed: number) {
  const decay = Math.exp(-1.4 * dt);
  obj.vx *= decay; obj.vy *= decay;
  obj.rollDist += speed * dt;
  obj.ang = Math.atan2(obj.vy, obj.vx);
  // When speed slows down below 3.2 m/s, the rolling tyre begins to wobble
  if (speed < 3.2) {
    obj.mode = 'wobble';
    obj.wobblePhase = 0;
    obj.wobbleAmp = 0.2;
  }
}

/**
 * A tyre cartwheeling end over end until it settles flat.
 * @param obj the tyre
 * @param dt step seconds
 * @param speed its speed
 */
function moveFlip(obj: Loose, dt: number, speed: number) {
  const decay = Math.exp(-2.2 * dt);
  obj.vx *= decay; obj.vy *= decay;
  obj.flipPhase += obj.flipSpeed * dt;
  obj.flipSpeed *= Math.exp(-1.6 * dt);
  if (Math.abs(obj.flipSpeed) < 1.8 || speed < 1.2) {
    obj.mode = 'flat';
    obj.down = 1.0;
  }
}

/**
 * A precessing Euler disc wobble before settling flat.
 * @param ctx the cones context
 * @param obj the tyre
 * @param dt step seconds
 * @param speed its speed
 */
function moveWobble(ctx: ConesCtx, obj: Loose, dt: number, speed: number) {
  const decay = Math.exp(-2.6 * dt);
  obj.vx *= decay; obj.vy *= decay;
  obj.wobbleAmp = Math.min(1.0, obj.wobbleAmp + dt * 1.6);
  obj.wobblePhase += dt * (16 + obj.wobbleAmp * 18);
  if (speed < 0.35 || obj.wobbleAmp >= 0.95) {
    obj.mode = 'flat';
    obj.down = 1.0;
    if (ctx.hits.length < 24) ctx.hits.push({ x: obj.x, y: obj.y, speed: 2, kind: 'tyre' });
  }
}

/**
 * Flat sliding (tyre, cone, banger, caravan): drag by kind.
 * @param obj the object
 * @param dt step seconds
 */
function moveFlat(obj: Loose, dt: number) {
  const dragVal = (obj.kind === 'banger' || obj.kind === 'caravan' || obj.kind
      === 'podium' || obj.kind === 'bale' || obj.kind === 'straw' || obj.kind === 'cow')
      ? 6.5
    : obj.kind === 'tyrestack' || obj.kind === 'sheep' ? 4.5 : obj.kind === 'tyre' ? 3.8
        : obj.kind === 'barrel' ? 1.6 : obj.kind === 'tarp' ? 5 : BROKEN.has(obj.kind) ? 7
        : DRAG;
  const decay = Math.exp(-dragVal * dt);
  obj.vx *= decay; obj.vy *= decay;
}

/**
 * A TUMBLEWEED's breeze: snagged until a car comes in time to cross before it, then
 * easing to its breeze as it gusts, hopping the low barriers (MEASURED, _desertjunkshot.mjs: on
 * the dual carriageway all 5 seen stopped at the central reservation), and rolling (rollDist:
 * render/props/tumbleweed.ts hops and turns it by it).
 * @param obj the tumbleweed
 * @param cars the cars
 * @param dt step seconds
 * @param clock sim time, s
 */
function blowTumbleweed(obj: Loose, cars: ConeCar[], dt: number, clock: number) {
  if (!obj.wind) return;
  if (!obj.blowing) {
    // (in time to cross in front of the car: TUMBLE_AHEAD_M off, and its way in the lead)
    const lead = (obj.lead || 0) + TUMBLE_SPINUP_S;
    if (!cars.some((car) => (car.x - obj.x) ** 2 + (car.y - obj.y) ** 2 < (TUMBLE_AHEAD_M
      + Math.hypot(car.vx, car.vy) * lead) ** 2)) return;
    obj.blowing = true;
    // (up off the ground with the gust: over the low barriers - a central reservation, armco -
    // not the tall ones, a rock wall, a catch fence: coneWalls.ts)
    obj.over = true;
  }
  // (each its own gusts, by its home spot)
  const gust = 1 + TUMBLE_GUST * Math.sin(clock * 1.7 + (obj.hx || 0) * 0.37 + (obj.hy || 0)
    * 0.21), ease = 1 - Math.exp(-TUMBLE_EASE * dt);
  obj.vx += (obj.wind[0] * gust - obj.vx) * ease;
  obj.vy += (obj.wind[1] * gust - obj.vy) * ease;
  obj.rollDist += Math.hypot(obj.vx, obj.vy) * dt;
}

/**
 * Integrate one object's movement based on its simulation mode, then stop it or bounce it off
 * the walls.
 * @param ctx the cones context
 * @param obj the object
 * @param dt step seconds
 * @param speed its speed at the start of the step
 */
function integrate(ctx: ConesCtx, obj: Loose, dt: number, speed: number) {
  obj.x += obj.vx * dt; obj.y += obj.vy * dt;

  if (obj.mode === 'roll') moveRoll(obj, dt, speed);
  else if (obj.mode === 'flip') moveFlip(obj, dt, speed);
  else if (obj.mode === 'wobble') moveWobble(ctx, obj, dt, speed);
  // (a tumbleweed goes with its breeze: blowTumbleweed)
  else if (obj.kind !== 'tumbleweed') moveFlat(obj, dt);

  // (a tyre sliding flat stops sooner, at SLEEP_V)
  const restAt = obj.kind === 'tyre' && obj.mode === 'flat' ? SLEEP_V : REST_V;
  if (speed < restAt) { obj.vx = 0; obj.vy = 0; obj.over = false; obj.overTried = false; }
  else hitWalls(obj);
}

/**
 * AT REST since its last step - still, not spinning or settling, the same spot and the
 * same filed cell - so this step would change nothing and test no car (MEASURED, 20 AI on
 * Thruston: ~1100 objects stepped for nothing were 0.2 ms of a 4.6 ms physics step).
 * @param obj the object
 * @returns true when its step can be skipped
 */
function stillAtRest(obj: Loose) {
  return obj._restX === obj.x && obj._restY === obj.y && obj._restCk === obj._ck
    && !obj.vx && !obj.vy && !obj.spin && !(obj.down > 0 && obj.down < 1);
}

/**
 * Move one object for the step and test it against every car if it is moving.
 * @param ctx the cones context
 * @param obj the object
 * @param cars the cars
 * @param dt step seconds
 * @param newTyres receives the tyres a burst stack throws out
 */
function stepObject(ctx: ConesCtx, obj: Loose, cars: ConeCar[], dt: number, newTyres: Loose[]) {
  if (obj.kind === 'tumbleweed') blowTumbleweed(obj, cars, dt, ctx.clock);
  if (stillAtRest(obj)) return;
  const speed = Math.hypot(obj.vx, obj.vy);

  if (obj.vx || obj.vy) integrate(ctx, obj, dt, speed);

  if (obj.spin) {
    obj.ang += obj.spin * dt;
    obj.spin *= Math.exp(-SPIN_DRAG * dt);
    if (Math.abs(obj.spin) < 0.05) obj.spin = 0;
  }

  if (obj.down > 0 && obj.down < 1) obj.down = Math.min(1, obj.down + dt * 6);
  // the floor rectangle (S-B: the lab is 520 x 1000)
  obj.x = Math.max(FX0, Math.min(FX1, obj.x));
  obj.y = Math.max(FY0, Math.min(FY1, obj.y));

  // MOVING (or not yet re-filed) objects test every car here; RESTING ones are found per car
  // from the grid below (MEASURED, 5 AI on
  // Thruston: testing all ~1100 objects against all 6 cars was 18 % of the frame)
  if (obj.vx || obj.vy || obj._ck !== cellKey(obj.x, obj.y)) {
    for (let carIndex = 0; carIndex < cars.length; carIndex++)
      hitByCar(ctx, obj, cars[carIndex], newTyres);
    obj._restX = undefined;
  } else { obj._restX = obj.x; obj._restY = obj.y; obj._restCk = obj._ck; }
}

/**
 * Test every car against the resting objects in the 5x5 cells around it.
 * @param ctx the cones context
 * @param cars the cars
 * @param newTyres receives the tyres a burst stack throws out
 */
function hitRestingObjects(ctx: ConesCtx, cars: ConeCar[], newTyres: Loose[]) {
  for (let carIndex = 0; carIndex < cars.length; carIndex++) {
    const car = cars[carIndex], gridX = Math.floor(car.x / OBJ_CELL), gridY = Math.floor(car.y
        / OBJ_CELL), cand: Loose[] = [];
    for (let cellX = gridX - 2; cellX <= gridX + 2; cellX++) for (let cellY = gridY - 2; cellY
        <= gridY + 2; cellY++) {
      const cell = ctx.restGrid.get(cellX * 65536 + cellY); if (!cell) continue;
      for (let slot = 0; slot < cell.length; slot++) {
        const other = cell[slot];
        if (!other.vx && !other.vy && other._ck === cellKey(other.x, other.y)) cand.push(other);
      }
    }
    // IN LIST ORDER (MEASURED: grid-cell order changed which stack the car met first — each hit
    // slows the car — and a Stock Car wall
    // crash knocked on 9-11 objects instead of 15, tools/objcheck). _n = a fixed creation index.
    cand.sort((left, right) => left._n! - right._n!);
    for (const other of cand) hitByCar(ctx, other, car, newTyres);
  }
}

// the cars stepCones meets objects with this step (reused)
const GROUND_CARS: ConeCar[] = [];

/**
 * step(car | [cars], dt): objects integrate ONCE per step, then are tested against every car.
 * @param ctx the cones context
 * @param carOrCars one car or an array of cars
 * @param dt step seconds
 */
export function stepCones(ctx: ConesCtx, carOrCars: ConeCar | ConeCar[], dt: number) {
  ctx.clock += dt;   // sim time: distinct-impact counting (chevrons / flags)
  // the cars on the ground only: one over a bridge (or in a tunnel) never meets what lies on the
  // ground beneath it (world/crossings.ts) - into a reused list, no allocation a step
  const given = Array.isArray(carOrCars) ? carOrCars : [carOrCars], cars = GROUND_CARS;
  cars.length = 0;
  for (const car of given) if ((car.crossing ?? -1) < 0) cars.push(car);
  if (ctx.sections.length) stepTape(ctx, cars);
  const newTyres: Loose[] = [];

  for (const obj of ctx.list) stepObject(ctx, obj, cars, dt, newTyres);

  hitRestingObjects(ctx, cars, newTyres);
  if (newTyres.length > 0) {
    for (const tyre of newTyres) tyre._n = ctx.nextN++;
    ctx.list.push(...newTyres);
  }
  if (ctx.objectHits) collideObjects(ctx);
}

