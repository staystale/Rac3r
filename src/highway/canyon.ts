// highway/canyon.ts - DEAF VALLEY's roadside (owner 11-08: "canyon which can have the features
// you've described / Cactus too?"; the canyon road's road type is presets.ts canyon). By road
// distance the road runs through a CANYON (CANYON_M) - a rock wall each side weaving GAP_MIN ..
// GAP_MAX m off the road edge, the rock behind it (a band THICK m deep with strata lines, its face
// shading the verge) swinging away over FLARE_M at each end so no wall end faces the road;
// saguaros on the rims, red boulders, rock formations beyond - then OPEN DESERT (DESERT_M):
// saguaros, barrel cacti, boulders. Everything is a function of road distance (and the road's own
// seed), so the stretches each dress call lays join exactly.
import type { Point, Prop } from '../world/types.ts';
import type { DressCtx, HwPose } from './hwtypes.ts';

const CANYON_M = 900, DESERT_M = 600, FLARE_M = 80, FLARE_OUT = 30;
const GAP_MIN = 2.5, GAP_MAX = 7.5, THICK_MIN = 10, THICK_MAX = 22;
// road points per wall piece (each dropped behind with the rest)
const PIECE = 30;
const CYCLE = CANYON_M + DESERT_M;

/**
 * How far into its canyon a road distance is, m, or -1 in the open desert.
 * @param dist road distance
 * @returns m into the canyon, or -1
 */
function canyonAlong(dist: number): number {
  const along = ((dist % CYCLE) + CYCLE) % CYCLE;
  return along < CANYON_M ? along : -1;
}

/**
 * A canyon wall's gap off the road edge at a road distance: weaving, swinging out at the ends.
 * @param dist road distance
 * @param side -1 / +1
 * @param seed the road's seed
 * @returns m
 */
function gapAt(dist: number, side: number, seed: number): number {
  const along = Math.max(0, canyonAlong(dist)), phase = (seed % 97) * 0.13 + side * 1.7;
  const wobble = 0.5 + 0.5 * Math.sin(dist / 97 + phase)
    * (0.6 + 0.4 * Math.sin(dist / 233 + side));
  const toEnd = Math.min(along, CANYON_M - along), flare = Math.max(0, 1 - toEnd / FLARE_M);
  return GAP_MIN + (GAP_MAX - GAP_MIN) * wobble + FLARE_OUT * flare * flare;
}

/**
 * The rock's depth behind a canyon wall's face at a road distance, m.
 * @param dist road distance
 * @param side -1 / +1
 * @returns m
 */
const thickAt = (dist: number, side: number) =>
  THICK_MIN + (THICK_MAX - THICK_MIN) * (0.5 + 0.5 * Math.sin(dist / 61 + side * 2.3));

/**
 * The canyon walls of road points [firstIdx, endIdx): a rock wall each side in PIECE-point pieces
 * (overlapping by one point), each with its rock band and two strata lines.
 * @param ctx the dress context
 */
function layCanyonWalls(ctx: DressCtx) {
  const { level, halfWidth, road, firstIdx, endIdx, pointAt } = ctx, seed = ctx.state.seed;
  for (let startIdx = Math.max(0, firstIdx - 1); startIdx < endIdx; startIdx += PIECE)
    for (const side of [-1, 1]) {
      let face: Point[] = [], back: Point[] = [], strata: Point[][] = [[], []];
      const flush = () => {
        if (face.length > 1) level.barriers.push({ kind: 'rock', pts: face,
          band: [...face, ...back.reverse()], strata, _s: road[startIdx].s });
        face = []; back = []; strata = [[], []];
      };
      for (let j = startIdx; j <= Math.min(endIdx, road.length - 1, startIdx + PIECE); j++) {
        const dist = road[j].s;
        if (canyonAlong(dist) < 0) { flush(); continue; }
        const gap = halfWidth + gapAt(dist, side, seed), thick = thickAt(dist, side),
          spot = (off: number) => {
            const pos = pointAt(j, side * off);
            return [pos.x, pos.y] as Point;
          };
        face.push(spot(gap));
        back.push(spot(gap + thick));
        strata[0].push(spot(gap + thick * (0.32 + 0.06 * Math.sin(dist / 23 + side))));
        strata[1].push(spot(gap + thick * (0.66 + 0.06 * Math.sin(dist / 31 - side))));
      }
      flush();
    }
}

/**
 * A prop placed off the road at point i if clear there.
 * @param ctx the dress context
 * @param i road point
 * @param off m off the centre line (signed)
 * @param prop the prop but its place
 */
function place(ctx: DressCtx, i: number, off: number, prop: Omit<Prop, 'x' | 'y'>) {
  const pos: HwPose = ctx.pointAt(i, off);
  if (ctx.clear(pos.x, pos.y, Math.max(2, (prop.s || 2) * 0.6)))
    ctx.level.props.push({ ...prop, x: pos.x, y: pos.y, _s: ctx.road[i].s } as Prop);
}

/**
 * A canyon's rims and beyond at point i: saguaros on the rock, red boulders by the wall, rock
 * formations past it.
 * @param ctx the dress context
 * @param i road point
 * @param side -1 / +1
 */
function canyonProps(ctx: DressCtx, i: number, side: number) {
  const { rand, halfWidth, road } = ctx, dist = road[i].s, seed = (dist | 0) * 2 + side,
    rim = halfWidth + gapAt(dist, side, ctx.state.seed), thick = thickAt(dist, side);
  if (rand() < 0.1) place(ctx, i, side * (rim + 2 + rand() * (thick - 3)),
    { kind: 'cactus', s: 2.2 + rand(), seed });
  if (rand() < 0.05) place(ctx, i, side * (rim - 1.2), { kind: 'rock', s: 1 + rand() * 1.5,
    pal: 'red', seed });
  if (i % 8 === 0 && rand() < 0.3) place(ctx, i, side * (rim + thick + 6 + rand() * 30),
    { kind: 'rock', s: 8 + rand() * 12, pal: 'red', seed });
}

/**
 * The open desert at point i: saguaros, barrel cacti, boulders.
 * @param ctx the dress context
 * @param i road point
 * @param side -1 / +1
 */
function desertProps(ctx: DressCtx, i: number, side: number) {
  const { rand, halfWidth, road } = ctx, seed = (road[i].s | 0) * 2 + side;
  if (rand() < 0.06) place(ctx, i, side * (halfWidth + 6 + rand() * 45),
    { kind: 'cactus', s: 2.2 + rand(), seed });
  if (rand() < 0.08) place(ctx, i, side * (halfWidth + 2.5 + rand() * 20),
    { kind: 'cactus', s: 0.7 + rand() * 0.4, seed });
  if (rand() < 0.05) place(ctx, i, side * (halfWidth + 4 + rand() * 40),
    { kind: 'rock', s: 1.5 + rand() * 2.5, pal: 'red', seed });
  if (i % 10 === 0 && rand() < 0.2) place(ctx, i, side * (halfWidth + 40 + rand() * 60),
    { kind: 'rock', s: 10 + rand() * 14, pal: 'red', seed });
}

/**
 * Dress road points [firstIdx, endIdx) as Deaf Valley: the canyon walls, the cacti and rocks, a
 * DEAF VALLEY board now and then.
 * @param ctx the dress context
 */
export function dressCanyon(ctx: DressCtx) {
  const { level, road, firstIdx, endIdx, halfWidth } = ctx;
  for (let i = firstIdx; i < endIdx; i++) {
    const dist = road[i].s, inCanyon = canyonAlong(dist) >= 0;
    if (i % 2 === 0) for (const side of [-1, 1])
      (inCanyon ? canyonProps : desertProps)(ctx, i, side);
    // the board where each canyon opens out into the desert
    if (Math.floor(dist / CYCLE) !== Math.floor((dist - 4) / CYCLE)) {
      const pos = ctx.pointAt(i, -(halfWidth + 5));
      level.props.push({ kind: 'board', x: pos.x, y: pos.y, rot: pos.rot, label: 'DEAF VALLEY',
        _s: dist } as Prop);
    }
  }
  layCanyonWalls(ctx);
}
