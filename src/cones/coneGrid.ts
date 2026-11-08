// cones/coneGrid.ts: the persistent grid of loose objects at rest, and the object-object
// collisions of the ones that move (impulse along the contact normal, stack bursts, dust).
// Every function takes the one cones context made in cones.ts (createCones).
import { BROKEN, OBJ_REST, STACK_BURST_V, TOPPLE_V, TOPPLES, burstStack } from "./coneConsts.ts";
import type { ConesCtx, Loose } from './coneTypes.ts';

export const OBJ_CELL = 2.5;              // m; larger than any moving object's diameter

/**
 * The grid cell key of a point.
 * @param x world x
 * @param y world y
 * @returns the cell key
 */
export const cellKey = (x: number, y: number): number =>
  Math.floor(x / OBJ_CELL) * 65536 + Math.floor(y / OBJ_CELL);

/**
 * File an object into the cell it sits in (leaving its old cell).
 * @param ctx the cones context
 * @param obj the loose object
 */
export function fileAtRest(ctx: ConesCtx, obj: Loose) {
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
 * @param ctx the cones context
 */
export function rebuildRestGrid(ctx: ConesCtx) {
  ctx.restGrid.clear();
  for (const obj of ctx.list) { obj._ck = undefined; fileAtRest(ctx, obj); }
}

/**
 * Mark an object as struck: tally it and topple it if hit hard enough.
 * @param obj the object
 * @param rel closing speed
 */
function touch(obj: Loose, rel: number) {
  obj.moved = true;
  obj.hitCount = (obj.hitCount || 0) + 1;
  if (TOPPLES.has(obj.kind) && obj.down === 0 && rel > TOPPLE_V) {
    obj.down = 0.001;
    obj.ang = Math.atan2(obj.vy, obj.vx);
  }
}

/**
 * Whether the pair is out of play (flat patches, tarps).
 * @param objA first object
 * @param objB second object
 * @returns true if they cannot collide
 */
function passesThrough(objA: Loose, objB: Loose) {
  return objA.kind === 'straw' || objB.kind === 'straw' || objA.flat || objB.flat
      || BROKEN.has(objA.kind) || BROKEN.has(objB.kind) || objA.kind === 'tarp' || objB.kind
      === 'tarp';
}

/**
 * Impulse and consequences for a touching pair: velocity change, spin, bursts and dust.
 * @param ctx the cones context
 * @param objA first object
 * @param objB second object
 * @param rel closing speed along the normal
 * @param nx contact normal x
 * @param ny contact normal y
 */
function respond(ctx: ConesCtx, objA: Loose, objB: Loose, rel: number, nx: number, ny: number) {
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
 * @param ctx the cones context
 * @param objA first object
 * @param objB second object
 */
function pair(ctx: ConesCtx, objA: Loose, objB: Loose) {
  const reach = objA.r + objB.r;
  const dx = objB.x - objA.x, dy = objB.y - objA.y;
  // the box reject first: nearly every pair is apart, and it is arithmetic (tools/crashbench.mjs)
  if (dx > reach || dx < -reach || dy > reach || dy < -reach) return;
  if (passesThrough(objA, objB)) return;
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
 * @param ctx the cones context
 * @param mover the moving object
 */
function pairWithResting(ctx: ConesCtx, mover: Loose) {
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

// moving objects from which they are paired through a grid, not each with every other: a burst
// tyre wall threw ~900 and paired ~400 000 a step (tools/crashbench.mjs: the impact's second
// 32 ms a step, the budget 8)
const CROWD = 64;

// the later movers' indices, reused (no allocation a step)
const LATER: number[] = [];

/**
 * Every later mover, for a few movers (each with every other, as ever).
 * @param count how many movers
 * @returns mover i -> the indices above it
 */
function everyLater(count: number): (index: number) => number[] {
  return (index) => {
    LATER.length = 0;
    for (let next = index + 1; next < count; next++) LATER.push(next);
    return LATER;
  };
}

/**
 * The movers near each mover, through a grid of where they all are at the step's start: for mover
 * i, the later movers (index above i) in the cells round it, in index order - the same pairs, in
 * the same order, as pairing each with every later one, less the ones too far apart to touch
 * (the reach: the biggest mover's diameter, and a cell for the pushes of the pairs before).
 * @param movers the moving objects
 * @returns mover i -> the indices to pair it with
 */
function crowdGrid(movers: Loose[]): (index: number) => number[] {
  const grid = new Map<number, number[]>(), cellOf: number[] = [];
  let biggest = 0;
  movers.forEach((mover, index) => {
    biggest = Math.max(biggest, mover.r);
    const cellX = Math.floor(mover.x / OBJ_CELL), cellY = Math.floor(mover.y / OBJ_CELL);
    cellOf.push(cellX, cellY);
    const key = cellX * 65536 + cellY;
    (grid.get(key) || grid.set(key, []).get(key)!).push(index);
  });
  const span = Math.ceil((2 * biggest) / OBJ_CELL) + 1, found: number[] = [];
  return (index) => {
    found.length = 0;
    const cellX = cellOf[index * 2], cellY = cellOf[index * 2 + 1];
    for (let x = cellX - span; x <= cellX + span; x++) for (let y = cellY - span; y <= cellY + span;
      y++) {
      const cell = grid.get(x * 65536 + y);
      if (cell) for (const other of cell) if (other > index) found.push(other);
    }
    return found.sort((first, second) => first - second);
  };
}

/**
 * OBJECT-OBJECT COLLISIONS (requirement: tyres should hit other tyres and cones or objects etc and
 * pass impact onto them if necessary). Every object is a circle of radius r and mass m.
 * Only objects that are MOVING are tested, each against the resting grid cells around it and
 * against each other. Anything that stopped since the last step is filed where it stopped.
 * @param ctx the cones context
 */
export function collideObjects(ctx: ConesCtx) {
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
  const near = movers.length > CROWD ? crowdGrid(movers) : everyLater(movers.length);
  for (let moverIdx = 0; moverIdx < movers.length; moverIdx++) {
    const mover = movers[moverIdx];
    // movers against each other, each pair once (a crowd: only the ones near enough, in order)
    for (const next of near(moverIdx)) pair(ctx, mover, movers[next]);
    // movers against whatever is resting in the 3x3 cells around them (skip ones that have
    // since moved)
    pairWithResting(ctx, mover);
  }
  if (ctx.burst.length) {
    for (const tyre of ctx.burst) tyre._n = ctx.nextN++;
    list.push(...ctx.burst);
  }
}
