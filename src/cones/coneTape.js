// cones/coneTape.js: RALLY TAPE: the sections between posts snap when a car crosses them or
// their posts are pulled apart, stick to the car as a streamer, and finally puff away.
import { TAPE_GONE, TAPE_REHIT, TAPE_SNAP_V, TAPE_STICK } from "./coneConsts.js";

/**
 * Does the segment (fromX, fromY)-(toX, toY) cross the car's box? (Liang-Barsky in the car's
 * frame)
 * @param {any} car the car
 * @param {number} fromX segment start x
 * @param {number} fromY segment start y
 * @param {number} toX segment end x
 * @param {number} toY segment end y
 * @returns {boolean} true if it crosses
 */
export function crossesCar(car, fromX, fromY, toX, toY) {
  const cosH = Math.cos(car.heading), sinH = Math.sin(car.heading), halfLen = car.spec.len / 2,
      halfWid = car.spec.wid / 2;
  const lx0 = (fromX - car.x) * cosH + (fromY - car.y) * sinH, ly0 = -(fromX - car.x) * sinH
      + (fromY - car.y) * cosH, lx1 = (toX - car.x) * cosH + (toY - car.y) * sinH, ly1 = -(toX
      - car.x) * sinH + (toY - car.y) * cosH;
  let enter = 0, leave = 1; const dx = lx1 - lx0, dy = ly1 - ly0;
  for (const [delta, bound] of [[-dx, lx0 + halfLen], [dx, halfLen - lx0], [-dy, ly0 + halfWid],
      [dy, halfWid - ly0]]) {
    if (delta === 0) { if (bound < 0) return false; continue; }
    const ratio = bound / delta;
    if (delta < 0) {
      if (ratio > leave) return false;
      if (ratio > enter) enter = ratio;
    } else { if (ratio < enter) return false; if (ratio < leave) leave = ratio; }
  }
  return true;
}

/**
 * A broken section takes another hit; the second one makes it go in a puff.
 * @param {any} ctx the cones context
 * @param {any} sct the tape section
 * @param {any} car the car that hit it, or null
 */
function gone(ctx, sct, car) {
  sct.hits = (sct.hits || 1) + 1; sct.at = ctx.clock;
  if (sct.hits < TAPE_GONE) return;
  sct.gone = true;
  for (const post of [sct.a, sct.b]) ctx.puffs.push({ x: post.x, y: post.y, vx: car ? car.vx * 0.3
      : 0, vy: car ? car.vy * 0.3 : 0 });
}

/**
 * Is a car close enough, fast enough and across the section to snap it?
 * @param {any} car the car
 * @param {any} sct the tape section
 * @param {number} midX section middle x
 * @param {number} midY section middle y
 * @returns {boolean} true if the car snaps it
 */
function snaps(car, sct, midX, midY) {
  const { a, b } = sct;
  if ((car.x - midX) ** 2 + (car.y - midY) ** 2 > 36) return false;
  return !(Math.hypot(car.vx, car.vy) < TAPE_SNAP_V || !crossesCar(car, a.x, a.y, b.x, b.y));
}

/**
 * A snapped section: after TAPE_REHIT seconds a car through the gap again, or the posts torn
 * further apart, takes it away.
 * @param {any} ctx the cones context
 * @param {any} sct the tape section
 * @param {any[]} cars the cars
 */
function stepBroken(ctx, sct, cars) {
  if (ctx.clock - (sct.at || 0) < TAPE_REHIT) return;
  const { a, b } = sct, midX = (a.x + b.x) / 2, midY = (a.y + b.y) / 2;
  if (Math.hypot(b.x - a.x, b.y - a.y) > sct.rest * 3) { gone(ctx, sct, null); return; }
  for (const car of cars) {
    if (!snaps(car, sct, midX, midY)) continue;
    gone(ctx, sct, car); break;
  }
}

/**
 * A whole section: snaps when its posts are pulled apart or a car crosses it (and the car may
 * pick up a streamer).
 * @param {any} ctx the cones context
 * @param {any} sct the tape section
 * @param {any[]} cars the cars
 */
function stepWhole(ctx, sct, cars) {
  const { a, b } = sct;
  if (Math.hypot(b.x - a.x, b.y - a.y) > sct.rest * 1.8) { sct.broken = true; return; }
  const midX = (a.x + b.x) / 2, midY = (a.y + b.y) / 2;
  for (const car of cars) {
    if (!snaps(car, sct, midX, midY)) continue;
    sct.broken = true; sct.at = ctx.clock; sct.hits = 1;
    if (Math.random() < TAPE_STICK) (car.streamers
        || (car.streamers = [])).push({ born: ctx.clock, len: 2.5 + Math.random() * 3,
        phase: Math.random() * 6 });
    if (car.streamers && car.streamers.length > 3) car.streamers.shift();
    break;
  }
}

/**
 * Step every tape section against the cars.
 * @param {any} ctx the cones context
 * @param {any[]} cars the cars
 */
export function stepTape(ctx, cars) {
  for (const sct of ctx.sections) {
    if (sct.gone) continue;
    if (sct.broken) stepBroken(ctx, sct, cars);
    else stepWhole(ctx, sct, cars);
  }
}
