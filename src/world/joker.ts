// THE JOKER LANE of a rallycross level: which lane it is, where a car is along it, and a pose on
// it. The lane's points run in driving order (ai/line.ts enters at the first, rejoins at the last).
// Read by the race rules (game/rules.js), RESET (game/session.js) and the minimap (hud/minimap.js).
import type { Lane, Level } from "./types.ts";

/** Where a car is on a lane: metres along it from the first point, and its signed offset. */
export interface LaneSpot {
  along: number;   // m from the lane's first point
  off: number;     // m to the left (+) or right (-) of its centre line, the left being +normal
}

const cachedLanes = new WeakMap<Level, Lane | null>();

/**
 * The level's joker lane: the lane (not a gravel trap) that passes the joker gate.
 * @param level the level
 * @returns the lane, or null when the level has no joker lane
 */
export function jokerLane(level: Level): Lane | null {
  const joker = level.joker;
  if (!joker) return null;
  if (cachedLanes.has(level)) return cachedLanes.get(level)!;
  const reach2 = joker.gate.r * joker.gate.r * 4;
  const nearGate = ([x, y]: [number, number]) =>
    (x - joker.gate.x) ** 2 + (y - joker.gate.y) ** 2 < reach2;
  const lane = (level.lanes || []).find((cand) => cand.out == null && cand.pts.some(nearGate));
  cachedLanes.set(level, lane || null);
  return lane || null;
}

/**
 * The nearest spot on a lane's centre line to a point.
 * @param lane the lane
 * @param x world x, m
 * @param y world y, m
 * @returns metres along the lane and the signed offset
 */
export function laneSpot(lane: Lane, x: number, y: number): LaneSpot {
  const pts = lane.pts;
  let best = { along: 0, off: 0 }, bestD2 = Infinity, start = 0;
  for (let i = 0; i + 1 < pts.length; i++) {
    const [fromX, fromY] = pts[i], [toX, toY] = pts[i + 1];
    const vx = toX - fromX, vy = toY - fromY, len = Math.hypot(vx, vy) || 1;
    const frac = Math.max(0, Math.min(1, ((x - fromX) * vx + (y - fromY) * vy) / (len * len)));
    const nearX = fromX + vx * frac, nearY = fromY + vy * frac;
    const dist2 = (x - nearX) ** 2 + (y - nearY) ** 2;
    if (dist2 < bestD2) {
      bestD2 = dist2;
      // +normal is (-ty, tx): a heading turned positive turns the nose that way (canvas y down)
      best = { along: start + frac * len, off: ((x - nearX) * -vy + (y - nearY) * vx) / len };
    }
    start += len;
  }
  return best;
}

/**
 * A pose on a lane: the point at a distance along it, its direction and its +normal.
 * @param lane the lane
 * @param along m from the first point (clamped to the lane)
 * @returns the point, the unit direction (tx, ty) and the heading, radians
 */
export function lanePose(lane: Lane, along: number) {
  const pts = lane.pts;
  let left = Math.max(0, along);
  for (let i = 0; i + 1 < pts.length; i++) {
    const [fromX, fromY] = pts[i], [toX, toY] = pts[i + 1];
    const vx = toX - fromX, vy = toY - fromY, len = Math.hypot(vx, vy) || 1;
    if (left <= len || i + 2 === pts.length) {
      const frac = Math.min(1, left / len);
      return { x: fromX + vx * frac, y: fromY + vy * frac, tx: vx / len, ty: vy / len,
        heading: Math.atan2(vy, vx) };
    }
    left -= len;
  }
  const [x, y] = pts[0];
  return { x, y, tx: 1, ty: 0, heading: 0 };
}
