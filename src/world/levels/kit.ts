import { parkMiller } from "../../core/random.ts";
import { alongTrack, smoothOnTrack } from "../barriers.ts";
import { autoKerbs } from "../subtrack.ts";
import { FLOOR } from "../bounds.ts";
import { onTrack, querySubtrack } from "../tyrewall.ts";
import type { Subtrack, Lane, Point, Prop, Bump, Cone, TrackKit } from "../types.ts";
export const ss01 = (x: number): number => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

// TRACK KIT (written for Castle Cum after doing Thruston endY hand): decorate a traced
// circuit endY DISTANCE + OFFSET (+ = right of travel; on a clockwise lap that is the INSIDE).
// Everything generated is filtered off the road, off the given lanes and inside the floor — the
// Thruston lesson: an outside offset on the inside of a left-hander lands on the track.
// LANE INDEX. onLane is asked for every sample of every prop, bank and tree while a level is
// built, and it walked every segment of every lane. MEASURED (first load, CPU x4): Brands GP alone
// spent 0.94 s in it. The segments now sit in LANE_CELL m cells and a query checks only the cells
// within its reach: the same answers (the exact distance test is unchanged), a few segments each.
const LANE_CELL = 16;
const LANE_KEY_OFFSET = 1 << 15, LANE_KEY_SPAN = 1 << 16;
const laneKey = (cellX: number, cellY: number) =>
  (cellX + LANE_KEY_OFFSET) * LANE_KEY_SPAN + (cellY + LANE_KEY_OFFSET);
/**
 * Builds the "is this point on a lane?" test for a set of lanes.
 * @param lanes the lanes (pit lanes, traps)
 * @returns onLane(x, y, pad): within half a lane's width + pad of any of its segments
 */
function laneIndex(lanes: Lane[]): (x: number, y: number, pad: number) => boolean {
  const cells = new Map<number, [Lane, number][]>();
  let widest = 0;
  for (const lane of lanes) {
    widest = Math.max(widest, lane.width / 2);
    for (let i = 0; i + 1 < lane.pts.length; i++) {
      const [startX, startY] = lane.pts[i], [endX, endY] = lane.pts[i + 1];
      for (let cellX = Math.floor(Math.min(startX, endX) / LANE_CELL);
        cellX <= Math.floor(Math.max(startX, endX) / LANE_CELL); cellX++)
        for (let cellY = Math.floor(Math.min(startY, endY) / LANE_CELL);
          cellY <= Math.floor(Math.max(startY, endY) / LANE_CELL); cellY++) {
          const key = laneKey(cellX, cellY), cell = cells.get(key);
          if (cell) cell.push([lane, i]);
          else cells.set(key, [[lane, i]]);
        }
    }
  }
  const nearSegment = (lane: Lane, i: number, x: number, y: number, pad: number) => {
    const [startX, startY] = lane.pts[i], next = lane.pts[i + 1];
    const dx = next[0] - startX, dy = next[1] - startY, len2 = dx * dx + dy * dy || 1e-6;
    let along = ((x - startX) * dx + (y - startY) * dy) / len2;
    along = along < 0 ? 0 : along > 1 ? 1 : along;
    return Math.hypot(x - startX - dx * along, y - startY - dy * along) <= lane.width / 2 + pad;
  };
  return (x: number, y: number, pad: number) => {
    if (!cells.size) return false;
    const reach = widest + pad, lastX = Math.floor((x + reach) / LANE_CELL);
    for (let cellX = Math.floor((x - reach) / LANE_CELL); cellX <= lastX; cellX++)
      for (let cellY = Math.floor((y - reach) / LANE_CELL);
        cellY <= Math.floor((y + reach) / LANE_CELL); cellY++) {
        const cell = cells.get(laneKey(cellX, cellY));
        if (cell) for (const [lane, i] of cell) if (nearSegment(lane, i, x, y, pad)) return true;
      }
    return false;
  };
}

export function trackKit(sub: Subtrack, seed: number, lanes: Lane[] = []): TrackKit {
  const rnd = parkMiller(seed);
  const pointAt = (dist: number, off: number) => smoothOnTrack(sub, dist, off);
  const rot = (dist: number) =>
    onTrack(sub, ((dist % sub.totalDist) + sub.totalDist) % sub.totalDist, 0, {}).rot;
  const prop = (dist: number, off: number, other: Omit<Prop, 'x' | 'y'>) =>
    ({ ...other, ...pointAt(dist, off), rot: rot(dist) + (other.rot || 0) });
  const onLane = laneIndex(lanes);
  const clear = (x: number, y: number, reach: number) =>
    querySubtrack(sub, x, y).dist >= sub.width / 2 + reach
    && Math.abs(x) < FLOOR - 6 - reach
    && Math.abs(y) < FLOOR - 6 - reach
    && !onLane(x, y, reach);
  const span = (from: number, end: number) => ((end - from) + sub.totalDist) % sub.totalDist;
  // earth bank = humps every 4 m (at 10 m they photographed as separate blobs)
  const bank = (from: number, end: number, off: number, radius: number, height: number) => {
    const out: Bump[] = [];
    for (let step = 0; step <= span(from, end); step += 4) {
      const point = pointAt(from + step, off);
      if (clear(point.x, point.y, radius + 2))
        out.push({ kind: 'hump', x: point.x, y: point.y, r: radius, h: height });
    }
    return out;
  };
  const along = (from: number, end: number, off: number, step: number) =>
    alongTrack(sub, from, end, off, step);
  return { rnd, at: pointAt, rot, prop, clear, span, bank, along, onLane };
}

// RALLYCROSS DRESSING (requirement: a couple more hay bales and tyres around Slidden Hill and
// Knobhill): knockable HAY BALES every 2.2 m along the OUTSIDE of every corner (hw + 4.5), and a 2
// x 3 block of TYRE STACKS on each inside apex (hw + 2.5) — kept off the road, every
// lane (joker, start, traps, paddock) and 1.6 m clear of any existing object.
// lined: [[d0, d1]] stretches with bales along BOTH sides every 4.4 m
export function rxDress(
  sub: Subtrack, lanes: Lane[], existing: Cone[], lined: Point[] = []): Cone[] {
  const halfWidth = sub.width / 2, out: Cone[] = [], have = [...existing];
  const onLane = (x: number, y: number) => lanes.some((lane) => lane.pts.some(
    ([startX, startY], i) => {
      const next = lane.pts[i + 1];
      if (!next) return false;
      const dx = next[0] - startX, dy = next[1] - startY, len2 = dx * dx + dy * dy || 1;
      let along = ((x - startX) * dx + (y - startY) * dy) / len2;
      along = along < 0 ? 0 : along > 1 ? 1 : along;
      return Math.hypot(x - startX - dx * along, y - startY - dy * along) <= lane.width / 2 + 1;
    }));
  const free = (x: number, y: number) =>
    querySubtrack(sub, x, y).dist > halfWidth + 1.5
    && !onLane(x, y)
    && Math.abs(x) < FLOOR - 5
    && Math.abs(y) < FLOOR - 5
    && !have.some((cone) => Math.hypot(cone.x - x, cone.y - y) < 1.6);
  const add = (cone: Cone) => {
    if (free(cone.x, cone.y)) {
      out.push(cone);
      have.push(cone);
    }
  };
  for (const kerb of autoKerbs(sub, { maxR: 60, exitR: 0, minTurn: 25, mergeGap: 10 })) {
    const outS = kerb.side === 'left' ? -1 : 1, mid = (kerb.startDist + kerb.endDist) / 2;
    // ONLY WHERE THERE IS NO WALL YET (requirement: they should go where there isn't already Armco
    // and tyre walls — the first pass lined bales in front of Slidden Hill's tyre walls): skip a
    // bale with an existing tyre stack within 6 m
    for (let dist = kerb.startDist - 6; dist <= kerb.endDist + 10; dist += 2.2) {
      const point = smoothOnTrack(sub, dist, outS * (halfWidth + 4.5));
      if (existing.some(
        (other) => other.kind === 'tyrestack'
          && Math.hypot(other.x - point.x, other.y - point.y) < 6
      )) continue;
      add({
        x: point.x,
        y: point.y,
        kind: 'bale',
        rot: onTrack(sub, ((dist % sub.totalDist) + sub.totalDist) % sub.totalDist, 0, {}).rot,
      });
    }
    for (const offset of [-1, 0, 1])
      for (const row of [0, 1]) {
        const point = smoothOnTrack(
          sub, mid + offset * 0.95, -outS * (halfWidth + 2.5 + row * 0.95));
        add({ x: point.x, y: point.y, kind: 'tyrestack' });
      }
  }
  for (const [from, end] of lined)
    for (let dist = from; dist <= end; dist += 4.4)
      for (const side of [-1, 1]) {
        const point = smoothOnTrack(sub, dist, side * (halfWidth + 4.5));
        add({
          x: point.x,
          y: point.y,
          kind: "bale",
          rot: onTrack(sub, ((dist % sub.totalDist) + sub.totalDist) % sub.totalDist, 0, {}).rot,
        });
      }
  return out;
}

// JOKER SEPARATION (requirement: hay bales between the joker section and the normal track on both
// rallycross tracks — a clear barrier): a line of bales in the MIDDLE of the grass strip between
// the joker and the main road, every 2.1 m wherever that strip is at least 2.2 m wide
// (so the joker's mouth and exit stay open).
export function jokerBales(sub: Subtrack, joker: Lane, existing: Cone[]): Cone[] {
  const halfWidth = sub.width / 2, jokerHalf = joker.width / 2,
    out: Cone[] = [], jokerPts = joker.pts;
  let acc = 0;
  for (let i = 1; i < jokerPts.length; i++) {
    const [startX, startY] = jokerPts[i - 1], [endX, endY] = jokerPts[i],
      length = Math.hypot(endX - startX, endY - startY);
    for (let along = acc; along < length; along += 2.1) {
      const x = startX + (endX - startX) * along / length,
        y = startY + (endY - startY) * along / length,
        query = querySubtrack(sub, x, y), gap = query.dist - halfWidth - jokerHalf;
      // clear of the main road's KERBS (2.4 m) too: bale centre >= 3.3 m off the road edge and
      // >= 0.9 m off the joker edge (photographed on a kerb)
      if (gap < 4.2) continue;
      const centre = onTrack(sub, query.trackDist, 0, {}), dx = centre.x - x, dy = centre.y - y,
        toCentre = Math.hypot(dx, dy) || 1, shift = jokerHalf + Math.min(gap / 2, gap - 3.3);
      const bale = {
        x: +(x + dx / toCentre * shift).toFixed(2),
        y: +(y + dy / toCentre * shift).toFixed(2),
        kind: 'bale',
        rot: Math.atan2(endY - startY, endX - startX),
      };
      if (![...existing, ...out].some(
        (other) => Math.hypot(other.x - bale.x, other.y - bale.y) < 1.6
      ))
        out.push(bale);
    }
    acc = (acc - length) % 2.1;
    if (acc < 0) acc += 2.1;
  }
  return out;
}