// highway/chevrons.ts - THE HIGHWAY'S CHEVRON BOARDS BY THE REAL-LIFE RULE (passed
// 11-15; TODO-DONE item 12, the owner's answer 11-15: "real life rule"): black boards with
// white chevrons (UK Traffic Signs Manual ch. 4, diagram 515: "to denote sharp changes in the
// direction of a road where a 'bend' sign alone would not be a sufficient warning"; on the
// outside of the bend, traffic passing in front of them, never before it) on the outside of the
// SHARP bends only, not in a lay-by; on Deaf Valley too, fewer (every second board). Knockable as
// every chevron board (cones TOPPLES, 45 kg). Without the switch the rally boards (black and
// yellow) stand on every bend tighter than R 650 m, none on Deaf Valley (highway/litter.ts).
import { COL } from '../world/colours.ts';
import { bayHere } from './laybys.ts';
import type { DressCtx, HwCfg } from './hwtypes.ts';
import type { LevelObj } from '../cones/coneTypes.ts';

// A SHARP bend: tighter than two steps below the desirable minimum radius for the road's design
// speed (UK DMRB CD 109: 120 km/h desirable 720 m, one step 510, two 360; 100 km/h 510 / 360 /
// 255) - the bend-sign range (TSM 3.1.4: dual carriageways' bends under R 450) is a step wider.
// m: the motorways and the dual carriageway (120 km/h), the single lane (one lane each way, the
// national limit: 100 km/h)
const SHARP_FAST_M = 360, SHARP_SINGLE_M = 255;
// road points between boards (4 m each: 48 m, as the rally boards), Deaf Valley's (96 m)
const BOARD_EVERY = 12, DESERT_EVERY = 24;
// m off the road's edge (behind the Armco where there is one, as the rally boards)
const BOARD_OUT_M = 4.5;
// m along the road either side of a board a lay-by must not reach: the board's 2.6 m half-width,
// the station's brand board 8 m before its lay-by (highway/stations.ts BOARD_BEFORE_M; a board was
// laid under one) and a margin; tested every BAY_STEP_M
const BAY_CLEAR_M = 20, BAY_STEP_M = 4;

/**
 * The sharp-bend radius for a road (the single lane has one lane each way).
 * @param cfg the road's preset
 * @returns m
 */
const sharpRadius = (cfg: HwCfg) => (cfg.oncoming === 'lane' ? SHARP_SINGLE_M : SHARP_FAST_M);

/**
 * Whether a lay-by (or a station's) reaches the board's stretch on its side.
 * @param ctx the dress context
 * @param dist the board's road distance, m
 * @param side -1 the left of the road, 1 the right
 * @returns true when one does
 */
function isInBay(ctx: DressCtx, dist: number, side: number) {
  for (let off = -BAY_CLEAR_M; off <= BAY_CLEAR_M; off += BAY_STEP_M) {
    if (bayHere(ctx.level, dist + off, side) !== null) return true;
  }
  return false;
}

/**
 * A chevron board on the outside of a sharp bend at road point i, when one is due there.
 * @param ctx the dress context
 * @param addLoose adds a loose object tagged with its road distance
 * @param i road point index
 * @param dist road distance at i, m
 */
export function layRoadChevron(ctx: DressCtx, addLoose: (obj: LevelObj, dist: number) => LevelObj,
  i: number, dist: number) {
  const { road, halfWidth, pointAt, level } = ctx;
  const curv = road[i].curv, desert = level._cfg.theme === 'canyon';
  if (i % (desert ? DESERT_EVERY : BOARD_EVERY) !== 0) return;
  if (Math.abs(curv) * sharpRadius(level._cfg) <= 1) return;
  const dir = Math.sign(curv), side = -dir;
  if (isInBay(ctx, dist, side)) return;
  const pos = pointAt(i, side * (halfWidth + BOARD_OUT_M));
  addLoose({ kind: 'chevron', x: pos.x, y: pos.y, rot: pos.rot + (dir * Math.PI) / 2,
    paint: COL.signWhite }, dist);
}
