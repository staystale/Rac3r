// world/levels/spikesdress.ts - SPIKES PEAK'S STONES (world/levels/spikes.ts): the scenery stones
// on its verges and hillside (?spikestones; owner 11-22: "little stones and bits placed around" -
// rock props, small, not solid), and the MOVABLE stones on its edges and the insides of its tight
// corners (?spikerocks: cones/stones.ts - loose objects, at most SPIKE_ROCKS_MAX). Both seeded,
// the same every build, never on any part of the road.
import { lcg } from '../../core/random.ts';
import { querySubtrack } from '../tyrewall.ts';
import type { Cone, Prop, Subtrack } from '../types.ts';

// m along the road between two tries at a scenery stone; the chance a try places one each side;
// the band past the road's edge they lie in; their size (s, m): the smallest, and the most more
const STONES_EVERY_M = 6, STONES_CHANCE = 0.5, STONES_FROM_M = 1.2, STONES_BAND_M = 14,
  STONES_MIN_S = 0.25, STONES_MORE_S = 1.1;
// the most movable stones on the road; m along between two tries; a try's chance on a tight
// corner's inside (turning past ROCKS_TIGHT_DEG in ROCKS_SPAN_M) and anywhere else
const SPIKE_ROCKS_MAX = 160, ROCKS_EVERY_M = 2, ROCKS_TIGHT_DEG = 35, ROCKS_SPAN_M = 12,
  ROCKS_TIGHT_CHANCE = 0.22, ROCKS_EDGE_CHANCE = 0.006;
// m: a movable stone lies this far either side of the road's edge (inside it to just past it)
const ROCKS_IN_M = 0.6, ROCKS_OUT_M = 1.4;
// a movable stone's size by chance: a pebble, a rock, a small boulder (cones/stones.ts)
const ROCK_SIZES: [string, number][] = [['stone', 0.6], ['stonemid', 0.3], ['stonebig', 0.1]];

/**
 * Whether a spot is clear of every part of the road (by `gap` m past its edge).
 * @param sub the road
 * @param x world x, m
 * @param y world y, m
 * @param gap m past the edge
 * @returns it is
 */
const offRoad = (sub: Subtrack, x: number, y: number, gap: number) =>
  querySubtrack(sub, x, y).dist > sub.width / 2 + gap;

/**
 * The scenery stones: small rock props scattered over the verges and the hillside beside the
 * course, never on the road.
 * @param sub the road
 * @param endDist the road distance they run to, m
 * @returns the props
 */
export function spikeStones(sub: Subtrack, endDist: number): Prop[] {
  const rand = lcg(0x5e1ce5), out: Prop[] = [], half = sub.width / 2;
  for (let dist = 0; dist < endDist; dist += STONES_EVERY_M) {
    const spot = pointAtDist(sub, dist);
    for (const side of [-1, 1]) {
      if (rand() >= STONES_CHANCE) continue;
      const off = side * (half + STONES_FROM_M + rand() * STONES_BAND_M);
      const x = spot.x + spot.nx * off, y = spot.y + spot.ny * off;
      if (!offRoad(sub, x, y, STONES_FROM_M)) continue;
      const size = STONES_MIN_S + rand() * rand() * STONES_MORE_S;
      out.push({ kind: 'rock', x, y, s: size, seed: 1 + Math.floor(rand() * 9999) });
    }
  }
  return out;
}

/**
 * The movable stones: on the inside edge of each tight corner, now and then on any edge - at most
 * SPIKE_ROCKS_MAX, the first ones up the road kept.
 * @param sub the road
 * @param endDist the road distance they run to, m
 * @returns the loose objects
 */
export function spikeRocks(sub: Subtrack, endDist: number): Cone[] {
  const rand = lcg(0x50c4), out: Cone[] = [], half = sub.width / 2;
  for (let dist = ROCKS_SPAN_M; dist < endDist - ROCKS_SPAN_M && out.length < SPIKE_ROCKS_MAX;
    dist += ROCKS_EVERY_M) {
    const turn = turnAt(sub, dist), tight = Math.abs(turn) > ROCKS_TIGHT_DEG * Math.PI / 180;
    if (rand() >= (tight ? ROCKS_TIGHT_CHANCE : ROCKS_EDGE_CHANCE)) continue;
    // (the inside of a tight corner: the side it turns toward - subtrack normals point left)
    const side = tight ? (turn > 0 ? 1 : -1) : (rand() < 0.5 ? -1 : 1);
    const spot = pointAtDist(sub, dist), off = side * (half - ROCKS_IN_M + rand()
      * (ROCKS_IN_M + ROCKS_OUT_M));
    const x = spot.x + spot.nx * off, y = spot.y + spot.ny * off;
    let pick = rand(), kind = ROCK_SIZES[0][0];
    for (const [size, share] of ROCK_SIZES) {
      kind = size;
      if ((pick -= share) <= 0) break;
    }
    out.push({ kind, x, y, rot: rand() * Math.PI * 2 });
  }
  return out;
}

/**
 * The road's point and its normal at a road distance (the nearest laid point).
 * @param sub the road
 * @param dist road distance, m
 * @returns the point
 */
function pointAtDist(sub: Subtrack, dist: number) {
  const pts = sub.pts;
  let low = 0, high = pts.length - 1;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (pts[mid].dist < dist) low = mid + 1; else high = mid;
  }
  return pts[low];
}

/**
 * The road's turn over ROCKS_SPAN_M centred on a road distance (rad, + toward its normal's side).
 * @param sub the road
 * @param dist road distance, m
 * @returns rad
 */
function turnAt(sub: Subtrack, dist: number): number {
  const before = pointAtDist(sub, dist - ROCKS_SPAN_M / 2), after = pointAtDist(sub, dist
    + ROCKS_SPAN_M / 2);
  const headBefore = Math.atan2(before.dirY, before.dirX), headAfter = Math.atan2(after.dirY,
    after.dirX);
  return Math.atan2(Math.sin(headAfter - headBefore), Math.cos(headAfter - headBefore));
}
