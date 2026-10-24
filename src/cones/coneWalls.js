// cones/coneWalls.js: pushes a moving loose object out of barrier segments and level solids,
// bouncing it off with a little scrape, or letting a fast one hop over (cone.over).
import { LEVEL } from "../world/state.ts";
import { BARRIER_HALF } from "../world/barriers.ts";
import { solidsNear } from "../world/solidgrid.ts";
const WALL_E = 0.3, WALL_SCRAPE = 0.8, OVER_V = 9, OVER_CHANCE = 0.3;

/**
 * Push the object out along (nx, ny) by `push` and reflect its velocity; a fast one may hop over.
 * @param {any} cone the loose object
 * @param {number} speed its speed before the push
 * @param {number} nx contact normal x
 * @param {number} ny contact normal y
 * @param {number} push how far to move it out
 */
function bounce(cone, speed, nx, ny, push) {
  if (speed > OVER_V && !cone.overTried) {
    cone.overTried = true;
    if (Math.random() < OVER_CHANCE) { cone.over = true; return; }
  }
  cone.x += nx * push; cone.y += ny * push;
  const normalSpeed = cone.vx * nx + cone.vy * ny;
  if (normalSpeed < 0) {
    const tangentX = -ny, tangentY = nx, tangentSpeed = cone.vx * tangentX + cone.vy * tangentY;
    cone.vx = nx * -normalSpeed * WALL_E + tangentX * tangentSpeed * WALL_SCRAPE;
    cone.vy = ny * -normalSpeed * WALL_E + tangentY * tangentSpeed * WALL_SCRAPE;
    cone.spin = (cone.spin || 0) * 0.5;
  }
}

/**
 * Test the object against one barrier segment and bounce it if it touches.
 * @param {any} cone the loose object
 * @param {number} radius its radius
 * @param {number} speed its speed
 * @param {any} segment a barrier segment
 * @param {number} half the barrier's half width
 */
function hitSegment(cone, radius, speed, segment, half) {
  if (cone.x < segment.minX - radius || cone.x > segment.maxX + radius || cone.y
      < segment.minY - radius || cone.y > segment.maxY + radius) return;
  let along = ((cone.x - segment.ax) * segment.dx + (cone.y - segment.ay) * segment.dy)
      / segment.l2;
  along = along < 0 ? 0 : along > 1 ? 1 : along;
  const nearX = segment.ax + segment.dx * along, nearY = segment.ay + segment.dy * along,
      dx = cone.x - nearX, dy = cone.y - nearY, dist = Math.hypot(dx, dy);
  if (dist >= half + radius) return;
  if (dist < 1e-6) {
    bounce(cone, speed, -segment.dy / Math.sqrt(segment.l2), segment.dx / Math.sqrt(segment.l2),
        half + radius);
  } else bounce(cone, speed, dx / dist, dy / dist, half + radius - dist);
}

/**
 * Bounce the object off every barrier it touches, stopping once it hops over.
 * @param {any} cone the loose object
 * @param {number} radius its radius
 * @param {number} speed its speed
 */
function hitBarriers(cone, radius, speed) {
  for (const barrier of LEVEL.barriers || []) {
    const half = BARRIER_HALF[barrier.kind]; if (!half || !barrier._segs) continue;
    for (const segment of barrier._segs) {
      hitSegment(cone, radius, speed, segment, half);
      if (cone.over) return;
    }
  }
}

/**
 * Contact with one solid's box in its own frame: the push-out normal (box frame) and depth.
 * @param {any} solid the level solid
 * @param {number} radius the object's radius
 * @param {number} localU object x in the solid's frame
 * @param {number} localV object y in the solid's frame
 * @returns {{ normalU: number, normalV: number, push: number } | null} null if clear of the box
 */
function solidContact(solid, radius, localU, localV) {
  const clampU = Math.max(-solid.w / 2, Math.min(solid.w / 2, localU)),
      clampV = Math.max(-solid.h / 2, Math.min(solid.h / 2, localV)), edgeU = localU - clampU,
      edgeV = localV - clampV, dist = Math.hypot(edgeU, edgeV);
  if (dist >= radius) return null;
  let normalU, normalV, push;
  if (dist > 1e-6) {
    normalU = edgeU / dist;
    normalV = edgeV / dist;
    push = radius - dist;
  } else { const penU = solid.w / 2 - Math.abs(localU), penV = solid.h / 2
      - Math.abs(localV); if (penU < penV) { normalU = Math.sign(localU)
      || 1; normalV = 0; push = penU + radius; } else { normalU = 0; normalV = Math.sign(localV)
      || 1; push = penV + radius; } }
  return { normalU, normalV, push };
}

/**
 * Bounce the object off every level solid it touches, stopping once it hops over.
 * @param {any} cone the loose object
 * @param {number} radius its radius
 * @param {number} speed its speed
 */
function hitSolids(cone, radius, speed) {
  // the solids near it (world/solidgrid.ts), or all of them for a big object
  const found = solidsNear(cone.x, cone.y, radius);
  for (const solid of found ? found.solids : LEVEL.solids || []) {
    const dx = cone.x - solid.x, dy = cone.y - solid.y;
    if (dx * dx + dy * dy > (solid.r + radius) ** 2) continue;
    const cosRot = Math.cos(solid.rot), sinRot = Math.sin(solid.rot), localU = dx * cosRot + dy
        * sinRot, localV = -dx * sinRot + dy * cosRot;
    const contact = solidContact(solid, radius, localU, localV);
    if (!contact) continue;
    const { normalU, normalV, push } = contact;
    bounce(cone, speed, normalU * cosRot - normalV * sinRot, normalU * sinRot + normalV * cosRot,
        push);
    if (cone.over) return;
  }
}

/**
 * Keep a moving loose object out of the level's barriers and solids.
 * @param {any} cone the loose object
 */
export function hitWalls(cone) {
  const radius = cone.r || 0.3;
  if (cone.over) return;
  const speed = Math.hypot(cone.vx, cone.vy);
  hitBarriers(cone, radius, speed);
  if (cone.over) return;
  hitSolids(cone, radius, speed);
}
