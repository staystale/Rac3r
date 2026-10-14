// cones/coneStep.js: one simulation step of the loose objects: motion by mode (roll, flip,
// wobble, flat slide), spin, the floor, the cars' hits, then the object-object collisions.
import { FX0, FX1, FY0, FY1 } from "../world/bounds.ts";
import { BROKEN, DRAG, REST_V, SPIN_DRAG } from "./coneConsts.js";
import { hitWalls } from "./coneWalls.js";
import { hitByCar } from "./coneCar.js";
import { stepTape } from "./coneTape.js";
import { OBJ_CELL, cellKey, collideObjects } from "./coneGrid.js";

/**
 * A rolling tyre: low rolling resistance on the tread edge, wobbling below 3.2 m/s.
 * @param {any} obj the tyre
 * @param {number} dt step seconds
 * @param {number} speed its speed
 */
function moveRoll(obj, dt, speed) {
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
 * @param {any} obj the tyre
 * @param {number} dt step seconds
 * @param {number} speed its speed
 */
function moveFlip(obj, dt, speed) {
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
 * @param {any} ctx the cones context
 * @param {any} obj the tyre
 * @param {number} dt step seconds
 * @param {number} speed its speed
 */
function moveWobble(ctx, obj, dt, speed) {
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
 * @param {any} obj the object
 * @param {number} dt step seconds
 */
function moveFlat(obj, dt) {
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
 * Integrate one object's movement based on its simulation mode, then stop it or bounce it off
 * the walls.
 * @param {any} ctx the cones context
 * @param {any} obj the object
 * @param {number} dt step seconds
 * @param {number} speed its speed at the start of the step
 */
function integrate(ctx, obj, dt, speed) {
  obj.x += obj.vx * dt; obj.y += obj.vy * dt;

  if (obj.mode === 'roll') moveRoll(obj, dt, speed);
  else if (obj.mode === 'flip') moveFlip(obj, dt, speed);
  else if (obj.mode === 'wobble') moveWobble(ctx, obj, dt, speed);
  else moveFlat(obj, dt);

  if (speed < REST_V) { obj.vx = 0; obj.vy = 0; obj.over = false; obj.overTried = false; }
  else hitWalls(obj);
}

/**
 * Move one object for the step and test it against every car if it is moving.
 * @param {any} ctx the cones context
 * @param {any} obj the object
 * @param {any[]} cars the cars
 * @param {number} dt step seconds
 * @param {any[]} newTyres receives the tyres a burst stack throws out
 */
function stepObject(ctx, obj, cars, dt, newTyres) {
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
  if (obj.vx || obj.vy || obj._ck !== cellKey(obj.x, obj.y)) for (let carIndex = 0; carIndex
      < cars.length; carIndex++) hitByCar(ctx, obj, cars[carIndex], newTyres);
}

/**
 * Test every car against the resting objects in the 5x5 cells around it.
 * @param {any} ctx the cones context
 * @param {any[]} cars the cars
 * @param {any[]} newTyres receives the tyres a burst stack throws out
 */
function hitRestingObjects(ctx, cars, newTyres) {
  for (let carIndex = 0; carIndex < cars.length; carIndex++) {
    const car = cars[carIndex], gridX = Math.floor(car.x / OBJ_CELL), gridY = Math.floor(car.y
        / OBJ_CELL), cand = [];
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
    cand.sort((left, right) => left._n - right._n);
    for (const other of cand) hitByCar(ctx, other, car, newTyres);
  }
}

/**
 * step(car | [cars], dt): objects integrate ONCE per step, then are tested against every car.
 * @param {any} ctx the cones context
 * @param {any} carOrCars one car or an array of cars
 * @param {number} dt step seconds
 */
export function stepCones(ctx, carOrCars, dt) {
  ctx.clock += dt;   // sim time: distinct-impact counting (chevrons / flags)
  if (ctx.sections.length) stepTape(ctx, Array.isArray(carOrCars) ? carOrCars : [carOrCars]);
  const cars = Array.isArray(carOrCars) ? carOrCars : [carOrCars];
  const newTyres = [];

  for (const obj of ctx.list) stepObject(ctx, obj, cars, dt, newTyres);

  hitRestingObjects(ctx, cars, newTyres);
  if (newTyres.length > 0) {
    for (const tyre of newTyres) tyre._n = ctx.nextN++;
    ctx.list.push(...newTyres);
  }
  if (ctx.objectHits) collideObjects(ctx);
}

