// highway/citywater.ts - GETAWAY STOCKHOLM's WATER and TUNNELS (behind ?stockholm;
// highway/cityplan.ts lays out the stretches). WATER: the road on a long bridge over open water -
// both sides the river's scenery water (highway/cuts.ts river: a 'wet' cover, never dries) from a
// concrete quay out WATER_W_M, laid in pieces as the road grows, kept clear (keep rects); yachts
// moored off the quays (Moanaco's). Its edges are weak fences with gaps (cityplan.ts cityWallAt:
// you can go in). A TUNNEL: the road walled in (its retaining walls) under Moanaco's slatted cover
// (world/venuecross.ts: slats SLAT_M long with SLAT_GAP_M between, a car hidden under each and
// glimpsed between) - here over the endless road at ground level, so each slat is drawn over the
// cars and is never solid (Prop.overRoad), laid by the road's distance where the ground over it has
// risen; the road under the slats in their shade, and under a roof (no rain). Sand under the water;
// the yachts solid.
import { SURFACES } from '../world/surfaces.ts';
import { keepOut } from './cuts.ts';
import { STEP } from './presets.ts';
import { cityStretchAt } from './cityplan.ts';
import type { Cover, Prop } from '../world/types.ts';
import type { DressCtx } from './hwtypes.ts';

// m: a water piece's length along the road; the quay past the road edge (behind the fence);
// the water's width out from it; the quay's concrete edge
const PIECE_M = 60, QUAY_M = 4, WATER_W_M = 90, QUAY_EDGE_M = 1.5;
// a water piece's chance of yachts on each side, how many (a range), their length and beam (a
// range each, m), m out from the quay they lie (a range)
const YACHT_SHARE = 0.45, YACHTS = [1, 3], YACHT_LEN_M = [11, 20], YACHT_BEAM_M = [3.6, 5];
const YACHT_OUT_M = [5, 24];
// m: Moanaco's slat and the gap between two (world/venuecross.ts SLAT_M, SLAT_GAP_M); the slats
// stand only where the tunnel's ground has risen, this far in from each end of the stretch; m the
// cover reaches past each road edge (over the retaining walls)
const SLAT_M = 3.2, SLAT_GAP_M = 1.4, SLAT_IN_M = 60, SLAT_OVER_M = 3;
// slats under one ROOF zone (owner 11-21: tunnels "dark AND DRY inside"): no rain reaches the road
// under it (world/wear.ts roofed); a few long zones, not one a slat, to keep the test cheap
const SLATS_A_ROOF = 10;

/**
 * A water piece's side: the water out from the quay (a keep rect: nothing stands on it), the
 * quay's concrete edge, and yachts now and then.
 * @param ctx the dress context
 * @param mid the piece's middle road point
 * @param side -1 / +1
 * @param dist the piece's road distance, m
 */
function layWaterSide(ctx: DressCtx, mid: number, side: number, dist: number) {
  const { level, state, halfWidth, pointAt } = ctx, rand = state.frnd;
  const centre = pointAt(mid, side * (halfWidth + QUAY_M + WATER_W_M / 2));
  state.covers.push({ cover: 'wet', water: true, shape: 'rect', x: centre.x, y: centre.y,
    w: PIECE_M + 8, h: WATER_W_M, rot: centre.rot, _s: dist } as Cover);
  // (SAND under it - owner 11-21: "so it's hard to drive on if you go in")
  level.zones.push({ x: centre.x, y: centre.y, w: PIECE_M + 8, h: WATER_W_M, rot: centre.rot,
    surface: SURFACES.sand, _s: dist });
  keepOut(level, { x: centre.x, y: centre.y, ax: Math.cos(centre.rot), ay: Math.sin(centre.rot),
    hu: PIECE_M / 2 + 4, hv: WATER_W_M / 2 }, dist);
  const quay = pointAt(mid, side * (halfWidth + QUAY_M - QUAY_EDGE_M / 2));
  level.zones.push({ x: quay.x, y: quay.y, w: PIECE_M + 4, h: QUAY_EDGE_M, rot: quay.rot,
    surface: SURFACES.concrete, _s: dist });
  if (rand() >= YACHT_SHARE) return;
  const count = YACHTS[0] + Math.floor(rand() * (YACHTS[1] - YACHTS[0] + 1));
  for (let boat = 0; boat < count; boat++) {
    const along = Math.round((rand() - 0.5) * (PIECE_M - 16) / STEP);
    const pos = pointAt(mid + along, side * (halfWidth + QUAY_M + YACHT_OUT_M[0]
      + rand() * (YACHT_OUT_M[1] - YACHT_OUT_M[0])));
    level.props.push({ kind: 'yacht', x: pos.x, y: pos.y, rot: pos.rot + (rand() < 0.5 ? 0
      : Math.PI), w: YACHT_LEN_M[0] + rand() * (YACHT_LEN_M[1] - YACHT_LEN_M[0]),
    h: YACHT_BEAM_M[0] + rand() * (YACHT_BEAM_M[1] - YACHT_BEAM_M[0]), moored: true,
    _s: dist } as Prop);
  }
}

/**
 * The water at road point i: on a WATER stretch a piece both sides once the last one has ended
 * (state.waterNext), when the road is laid PIECE_M on.
 * @param ctx the dress context
 * @param i the road point
 * @param kind the stretch here
 */
export function layCityWater(ctx: DressCtx, i: number, kind: string) {
  const { state, road } = ctx, dist = road[i].s;
  if (kind !== 'water') {
    state.waterNext = dist;
    return;
  }
  const count = Math.ceil(PIECE_M / STEP);
  if (dist < (state.waterNext ?? 0) || i + count >= road.length) return;
  state.waterNext = dist + PIECE_M;
  for (const side of [-1, 1]) layWaterSide(ctx, i + (count >> 1), side, dist);
  state.coversDirty = true;
}

/**
 * The tunnel's slats at road point i: each one whose start falls between this point and the next
 * (laid by the road's distance - the same spots in every dress call), on a TUNNEL stretch where
 * its ground has risen.
 * @param ctx the dress context
 * @param i the road point
 */
export function layTunnelSlats(ctx: DressCtx, i: number) {
  const { level, state, road, halfWidth, pointAt } = ctx;
  if (i + 1 >= road.length) return;
  const from = road[i].s, upto = road[i + 1].s, pitch = SLAT_M + SLAT_GAP_M;
  for (let slatAt = Math.ceil(from / pitch) * pitch; slatAt < upto; slatAt += pitch) {
    const stretch = cityStretchAt(slatAt + SLAT_M / 2, state.seed);
    if (stretch.kind !== 'tunnel' || stretch.along < SLAT_IN_M
      || stretch.len - stretch.along < SLAT_IN_M) continue;
    const share = (slatAt + SLAT_M / 2 - from) / Math.max(1e-6, upto - from);
    const here = pointAt(i, 0), next = pointAt(i + 1, 0), wide = 2 * (halfWidth + SLAT_OVER_M);
    const x = here.x + (next.x - here.x) * share, y = here.y + (next.y - here.y) * share;
    // (wid its whole pitch: the gap after it is in the tunnel's shade too - props/scenery.ts)
    level.props.push({ kind: 'slat', x, y, rot: here.rot, w: SLAT_M, wid: pitch, h: wide,
      overRoad: true, _s: road[i].s });
    if (Math.round(slatAt / pitch) % SLATS_A_ROOF === 0) {
      const roofLen = SLATS_A_ROOF * pitch, ahead = roofLen / 2 - SLAT_M / 2;
      level.zones.push({ x: x + Math.cos(here.rot) * ahead, y: y + Math.sin(here.rot) * ahead,
        w: roofLen + 1, h: wide, rot: here.rot, surface: SURFACES.tarmac, roof: true,
        _s: road[i].s });
    }
  }
}
