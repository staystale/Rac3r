// world/obstacles.ts - THE CAR AGAINST THE FLOOR'S FENCE AND THE LEVEL'S OBSTACLES (grandstands,
// pit walls, towers as boxes): the clamps world/crossings.ts clampWorld runs for a car on the
// ground, before the barriers and solids (world/barriers.ts).
import { LEVEL } from "./state.ts";
import { FX1, FX0, FY1, FY0, RUNOFF_W } from "./bounds.ts";
import { noteHit } from "../physics/punctures.ts";
import type { CarBody, Obstacle } from "./types.ts";

// The fence is the one hard constraint out here, because a barrier IS one.
// PREVENTS WEDGING: bounds against car corners rather than center point, prevents body
// from penetrating the fence, zeroes penetrating velocity with elastic rebound, and damps snagging
// yaw.
export function fenceClamp(car: CarBody): void {
  const spec = car.spec;
  const reach = Math.max(spec.wid, spec.len) * 0.48;
  // per side (S-B: the floor is a rectangle): the fence is RUNOFF_W past each floor edge
  for (const axis of ['x', 'y'] as const) {
    const lower = (axis === 'x' ? FX0 : FY0) - RUNOFF_W + reach,
      upper = (axis === 'x' ? FX1 : FY1) + RUNOFF_W - reach;
    if (car[axis] > upper || car[axis] < lower) {
      const sgn = car[axis] > upper ? 1 : -1;
      car[axis] = sgn > 0 ? upper : lower;
      const velKey = axis === 'x' ? 'vx' : 'vy';
      if (car[velKey] * sgn > 0) {
        car[velKey] = -car[velKey] * 0.35;
        car.yawRate *= 0.65;     // kill corner pivot snagging
        noteHit(car, 'fence');
      }
    }
  }
}

/**
 * Push the car out of one solid obstacle (grandstand, pit wall, marshal tower) if it is inside,
 * bouncing it off the side of least penetration.
 * @param car the car body
 * @param obstacle the obstacle rectangle
 * @param reachX how far the car reaches along x
 * @param reachY how far the car reaches along y
 */
function pushOutOfObstacle(
  car: CarBody, obstacle: Obstacle, reachX: number, reachY: number,
): void {
  const halfW = obstacle.w / 2, halfH = obstacle.h / 2;
  const minX = obstacle.x - halfW - reachX;
  const maxX = obstacle.x + halfW + reachX;
  const minY = obstacle.y - halfH - reachY;
  const maxY = obstacle.y + halfH + reachY;

  if (car.x > minX && car.x < maxX && car.y > minY && car.y < maxY) {
    const penLeft = car.x - minX;
    const penRight = maxX - car.x;
    const penTop = car.y - minY;
    const penBottom = maxY - car.y;
    const minPen = Math.min(penLeft, penRight, penTop, penBottom);

    if (minPen === penLeft) {
      car.x = minX;
      if (car.vx > 0) car.vx = -car.vx * 0.35;
    } else if (minPen === penRight) {
      car.x = maxX;
      if (car.vx < 0) car.vx = -car.vx * 0.35;
    } else if (minPen === penTop) {
      car.y = minY;
      if (car.vy > 0) car.vy = -car.vy * 0.35;
    } else {
      car.y = maxY;
      if (car.vy < 0) car.vy = -car.vy * 0.35;
    }
    car.yawRate *= 0.50;
    const speed = Math.hypot(car.vx, car.vy);
    car.shake = Math.min(1.0, (car.shake || 0) + speed * 0.12);
  }
}
// Solid impactable obstacle collision (grandstands, pit divider walls, marshal towers)
export function obstacleClamp(car: CarBody): void {
  if (!LEVEL.obstacles || !LEVEL.obstacles.length) return;
  const spec = car.spec;
  const reachX = spec.len * 0.45, reachY = spec.wid * 0.45;

  const vx0 = car.vx, vy0 = car.vy;
  for (let i = 0; i < LEVEL.obstacles.length; i++)
    pushOutOfObstacle(car, LEVEL.obstacles[i], reachX, reachY);
  // the obstacles are buildings and stands
  if (car.vx !== vx0 || car.vy !== vy0) noteHit(car, 'building');
}
