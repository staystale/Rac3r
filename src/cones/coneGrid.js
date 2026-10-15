// cones/coneGrid.js: the persistent grid of loose objects at rest, and the object-object
// collisions of the ones that move (impulse along the contact normal, stack bursts, dust).
// Every function takes the one cones context made in cones.js (createCones).
import { BROKEN, OBJ_REST, STACK_BURST_V, TOPPLE_V, TOPPLES, burstStack } from "./coneConsts.js";

export const OBJ_CELL = 2.5;              // m; larger than any moving object's diameter

/**
 * The grid cell key of a point.
 * @param {number} x world x
 * @param {number} y world y
 * @returns {number} the cell key
 */
export const cellKey = (x, y) => Math.floor(x / OBJ_CELL) * 65536 + Math.floor(y / OBJ_CELL);

/**
 * File an object into the cell it sits in (leaving its old cell).
 * @param {any} ctx the cones context
 * @param {any} obj the loose object
 */
export function fileAtRest(ctx, obj) {
  const key = cellKey(obj.x, obj.y);
  if (obj._ck === key) return;
  if (obj._ck !== undefined) {
    const old = ctx.restGrid.get(obj._ck);
    if (old) { const i = old.indexOf(obj); if (i >= 0) old.splice(i, 1); }
  }
  obj._ck = key;
  const cell = ctx.restGrid.get(key);
  if (cell) cell.push(obj); else ctx.restGrid.set(key, [obj]);
}

/**
 * Throw the grid away and file every object again.
 * @param {any} ctx the cones context
 */
export function rebuildRestGrid(ctx) {
  ctx.restGrid.clear();
  for (const obj of ctx.list) { obj._ck = undefined; fileAtRest(ctx, obj); }
}

/**
 * Mark an object as struck: tally it and topple it if hit hard enough.
 * @param {any} obj the object
 * @param {number} rel closing speed
 */
function touch(obj, rel) {
  obj.moved = true;
  obj.hitCount = (obj.hitCount || 0) + 1;
  if (TOPPLES.has(obj.kind) && obj.down === 0 && rel > TOPPLE_V) {
    obj.down = 0.001;
    obj.ang = Math.atan2(obj.vy, obj.vx);
  }
}

/**
 * Whether the pair is out of play (flat patches, tarps).
 * @param {any} objA first object
 * @param {any} objB second object
 * @returns {boolean} true if they cannot collide
 */
function passesThrough(objA, objB) {
  return objA.kind === 'straw' || objB.kind === 'straw' || objA.flat || objB.flat
      || BROKEN.has(objA.kind) || BROKEN.has(objB.kind) || objA.kind === 'tarp' || objB.kind
      === 'tarp';
}

/**
 * Impulse and consequences for a touching pair: velocity change, spin, bursts and dust.
 * @param {any} ctx the cones context
 * @param {any} objA first object
 * @param {any} objB second object
 * @param {number} rel closing speed along the normal
 * @param {number} nx contact normal x
 * @param {number} ny contact normal y
 */
function respond(ctx, objA, objB, rel, nx, ny) {
  const invMassA = 1 / objA.mass, invMassB = 1 / objB.mass, invMassSum = invMassA + invMassB;
  const restitution = Math.min(OBJ_REST[objA.kind] ?? 0.15, OBJ_REST[objB.kind] ?? 0.15);
  const j = ((1 + restitution) * rel) / invMassSum;
  objA.vx -= j * invMassA * nx; objA.vy -= j * invMassA * ny;
  objB.vx += j * invMassB * nx; objB.vy += j * invMassB * ny;
  // a glancing blow sets the struck object spinning
  objB.spin += ((objA.vx - objB.vx) * -ny + (objA.vy - objB.vy) * nx) * 0.8;
  touch(objA, rel); touch(objB, rel);
  if (objB.kind === 'tyrestack' && rel > STACK_BURST_V) burstStack(objB, ctx.burst);
  if (objA.kind === 'tyrestack' && rel > STACK_BURST_V) burstStack(objA, ctx.burst);
  if (rel > 2 && ctx.hits.length < 24) ctx.hits.push({ x: (objA.x + objB.x) / 2, y: (objA.y
      + objB.y) / 2, speed: rel, kind: objB.kind });
}

/**
 * ONE pair test, defined once at module level. MEASURED (objcheck, same-run
 * baseline): building this as a closure every step and looping over a fresh [a, b] array per
 * contact cost ~140 us/step over the no-collision path.
 * @param {any} ctx the cones context
 * @param {any} objA first object
 * @param {any} objB second object
 */
function pair(ctx, objA, objB) {
  if (passesThrough(objA, objB)) return;
  const reach = objA.r + objB.r;
  const dx = objB.x - objA.x, dy = objB.y - objA.y;
  if (dx > reach || dx < -reach || dy > reach || dy < -reach) return;
  const dist = Math.hypot(dx, dy);
  if (dist >= reach || dist < 1e-6) return;
  const nx = dx / dist, ny = dy / dist;
  const invMassA = 1 / objA.mass, invMassB = 1 / objB.mass, invMassSum = invMassA + invMassB;
  // push apart, shared by inverse mass
  const pen = reach - dist;
  objA.x -= nx * pen * invMassA / invMassSum; objA.y -= ny * pen * invMassA / invMassSum;
  objB.x += nx * pen * invMassB / invMassSum; objB.y += ny * pen * invMassB / invMassSum;
  // closing speed along the normal
  const rel = (objA.vx - objB.vx) * nx + (objA.vy - objB.vy) * ny;
  if (rel <= 0) return;
  respond(ctx, objA, objB, rel, nx, ny);
}

/**
 * Test one mover against the resting objects in the 3x3 cells around it.
 * @param {any} ctx the cones context
 * @param {any} mover the moving object
 */
function pairWithResting(ctx, mover) {
  const gridX = Math.floor(mover.x / OBJ_CELL), gridY = Math.floor(mover.y / OBJ_CELL);
  for (let cellX = gridX - 1; cellX <= gridX + 1; cellX++) for (let cellY = gridY - 1; cellY
      <= gridY + 1; cellY++) {
    const cell = ctx.restGrid.get(cellX * 65536 + cellY);
    if (!cell) continue;
    for (let slot = 0; slot < cell.length; slot++) {
      const other = cell[slot];
      if (other !== mover && !other.vx && !other.vy) pair(ctx, mover, other);
    }
  }
}

/**
 * OBJECT-OBJECT COLLISIONS (user: "tyres should hit other tyres and cones or objects
 * etc and pass impact onto them if necessary"). Every object is a circle of radius r and mass m.
 * Only objects that are MOVING are tested, each against the resting grid cells around it and
 * against each other. Anything that stopped since the last step is filed where it stopped.
 * @param {any} ctx the cones context
 */
export function collideObjects(ctx) {
  const { list, movers, prevMovers } = ctx;
  movers.length = 0;
  for (let i = 0; i < list.length; i++) {
    const obj = list[i];
    if (obj.vx || obj.vy) { obj._i = i; movers.push(obj); }
  }
  // anything that was moving last step and has now stopped is filed where it stopped
  for (let i = 0; i < prevMovers.length; i++) {
    const obj = prevMovers[i];
    if (!obj.vx && !obj.vy) fileAtRest(ctx, obj);
  }
  prevMovers.length = 0; for (let i = 0; i < movers.length; i++) prevMovers.push(movers[i]);
  if (!movers.length) return;
  ctx.burst.length = 0;
  for (let moverIdx = 0; moverIdx < movers.length; moverIdx++) {
    const mover = movers[moverIdx];
    // movers against each other, each pair once
    for (let next = moverIdx + 1; next < movers.length; next++) pair(ctx, mover, movers[next]);
    // movers against whatever is resting in the 3x3 cells around them (skip ones that have
    // since moved)
    pairWithResting(ctx, mover);
  }
  if (ctx.burst.length) {
    for (const tyre of ctx.burst) tyre._n = ctx.nextN++;
    list.push(...ctx.burst);
  }
}
