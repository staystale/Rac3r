// highway/gorge.ts - DEAF VALLEY's GROUND beside the road (owner 11-09: "higher up canyon parts
// where there's steep drops on one or both sides sometimes with or without barriers", "slopey
// terrain or rocky valleys to the side"). A height off the road edge (world/terrain.ts bumpAt reads
// it through level.roadside), and the things that go with it:
//   HIGH    a ledge road: on a falling side a VERGE, then the FALL (the ground itself dropping
//           DEPTH m over FALL m - owner 11-09: "no high edges just a drop ... use terrain to make
//           it genuinely sloped": the hill shading shows it, nothing is drawn over it), the
//           gorge's sand FLOOR, and the ground rising again over RISE m to the far plateau;
//           boulders down the slopes and on the floor; Armco along the lip on about half the
//           falling sides (the rest open: you can go over); the other side a rock wall close by
//           (canyon.ts).
//   DESERT  each side a dry WASH (a sandy trough beside the road, boulders in it) or a RISE (the
//           ground banking up away from the road and down again).
// Everything eases in and out over each stretch's ends; a stretch's depth is its own (the same
// all along it, so where two parts of the road are nearest the ground meets itself). All of it
// lies within REACH m of the road edge (the road's lookup reaches that far: highway.ts).
import { stretchAt, inFrom, type Stretch } from './desertplan.ts';
import { SURFACES } from '../world/surfaces.ts';
import type { DressCtx } from './hwtypes.ts';
import type { Point } from '../world/types.ts';

export const REACH = 50;
// the ledge: the flat verge, the fall's plan width, the depth, the floor's width; the ease in
const VERGE = 1.2, FALL_MIN = 7, FALL_MAX = 11, DEPTH_MIN = 20, DEPTH_MAX = 35, FLOOR_MIN = 7,
  FLOOR_MAX = 12, RISE_MIN = 9, RISE_MAX = 13, EASE_M = 150;
// the desert: a wash's start off the edge, width, depth; a rise's peak off the edge and height
const WASH_IN = 5, WASH_MIN = 14, WASH_MAX = 22, WASH_DEEP = 4.5, RISE_PEAK = 22, RISE_END = 44,
  RISE_HIGH = 5, SIDES_EASE_M = 120;

/**
 * A number's hash, 0..1 (a stretch's choices, the same every visit).
 * @param seed the number
 * @returns 0..1
 */
function hash01(seed: number): number {
  let mix = Math.imul((seed | 0) ^ 0x9e3779b9, 0x85ebca6b);
  mix ^= mix >>> 13;
  mix = Math.imul(mix, 0xc2b2ae35);
  mix ^= mix >>> 16;
  return (mix >>> 0) / 4294967296;
}

/**
 * Whether a HIGH stretch's side falls away into a gorge, and whether Armco guards its lip: one
 * side or the other (two in five each), both (one in five); Armco on half the falling sides.
 * @param index the stretch's number
 * @param side -1 / +1 (the driver's left / right)
 * @param seed the road's seed
 * @returns drop, armco
 */
export function ledgeOf(index: number, side: number, seed: number) {
  const pick = hash01(index * 7 + seed), drop = pick < 0.4 ? side < 0 : pick < 0.8 ? side > 0
    : true;
  return { drop, armco: drop && hash01(index * 13 + side * 5 + seed * 3) < 0.5 };
}

/** A gorge's cut at a road distance: its depth, the fall's, floor's and far rise's widths, how far
 * eased. */
export interface Cut { depth: number; fall: number; floor: number; rise: number; ease: number }

/**
 * The gorge beside the road at a road distance on one side, or null where the side does not fall.
 * @param dist road distance
 * @param side -1 / +1
 * @param seed the road's seed
 * @param stretch the stretch there (stretchAt)
 * @returns the cut, or null
 */
export function gorgeAt(dist: number, side: number, seed: number,
    stretch: Stretch = stretchAt(dist)): Cut | null {
  if (stretch.kind !== 'high' || !ledgeOf(stretch.index, side, seed).drop) return null;
  const wave = (period: number, phase: number) =>
    0.5 + 0.5 * Math.sin(dist / period + phase + side * 1.3 + (seed % 31));
  const ease = inFrom(stretch, EASE_M);
  return { depth: (DEPTH_MIN + (DEPTH_MAX - DEPTH_MIN) * hash01(stretch.index * 5 + side + seed))
    * ease, fall: FALL_MIN + (FALL_MAX - FALL_MIN) * wave(410, 1),
  floor: FLOOR_MIN + (FLOOR_MAX - FLOOR_MIN) * wave(530, 2),
  rise: RISE_MIN + (RISE_MAX - RISE_MIN) * wave(470, 3), ease };
}

/** m off the road edge to a gorge's floor (the fall's foot), its far side's foot, its far rim. */
export const footOf = (cut: Cut) => VERGE + cut.fall;
export const farOf = (cut: Cut) => VERGE + cut.fall + cut.floor;
export const rimOf = (cut: Cut) => farOf(cut) + cut.rise;

const smooth = (frac: number) => {
  const clamped = Math.max(0, Math.min(1, frac));
  return clamped * clamped * (3 - 2 * clamped);
};

/**
 * A gorge's height `past` m off the road edge: the verge, the fall, the floor, the rise to the far
 * rim.
 * @param cut the cut
 * @param past m off the road edge
 * @returns m (0 or below)
 */
function gorgeHeight(cut: Cut, past: number): number {
  if (past < VERGE) return 0;
  const far = farOf(cut);
  if (past < far) return -cut.depth * smooth((past - VERGE) / cut.fall);
  return -cut.depth * (1 - smooth((past - far) / cut.rise));
}

/**
 * A desert stretch's side: a dry wash (a trough), a rise (a bank), its size.
 * @param index the stretch's number
 * @param side -1 / +1
 * @param seed the road's seed
 * @returns wash or rise, the width / height scale 0..1
 */
export function desertSideOf(index: number, side: number, seed: number) {
  return { wash: hash01(index * 11 + side * 3 + seed) < 0.55,
    size: hash01(index * 17 + side + seed * 7) };
}

/** m off the road edge a desert stretch's wash spans (its start and width). */
export const washOf = (size: number) => ({ from: WASH_IN, width: WASH_MIN
  + (WASH_MAX - WASH_MIN) * size });

/**
 * A desert stretch's height `past` m off the road edge on one side.
 * @param stretch the stretch
 * @param side -1 / +1
 * @param seed the road's seed
 * @param past m off the road edge
 * @returns m
 */
function desertHeight(stretch: Stretch, side: number, seed: number, past: number): number {
  const { wash, size } = desertSideOf(stretch.index, side, seed),
    ease = inFrom(stretch, SIDES_EASE_M);
  if (wash) {
    const { from, width } = washOf(size), frac = (past - from) / width;
    if (frac <= 0 || frac >= 1) return 0;
    const cos = Math.cos(Math.PI * (frac - 0.5));
    return -WASH_DEEP * (0.6 + 0.4 * size) * cos * cos * ease;
  }
  const rise = past < RISE_PEAK ? smooth((past - 6) / (RISE_PEAK - 6))
    : 1 - smooth((past - RISE_PEAK) / (RISE_END - RISE_PEAK));
  return RISE_HIGH * (0.5 + 0.5 * size) * rise * ease;
}

/**
 * DEAF VALLEY's ground `offset` m off the centre line at a road distance (level.roadside).
 * @param dist road distance
 * @param offset m off the centre line (+: the driver's right, as pointAt)
 * @param halfWidth the road's half width, m
 * @param seed the road's seed
 * @returns m added to the ground's height
 */
export function desertGround(dist: number, offset: number, halfWidth: number,
    seed: number): number {
  const past = Math.abs(offset) - halfWidth;
  if (past <= 0) return 0;
  const stretch = stretchAt(dist), side = offset < 0 ? -1 : 1;
  if (stretch.kind === 'high') {
    const cut = gorgeAt(dist, side, seed, stretch);
    return cut ? gorgeHeight(cut, past) : 0;
  }
  return stretch.kind === 'desert' ? desertHeight(stretch, side, seed, past) : 0;
}

/**
 * The furthest a thing beside road point i may reach off the centre line on one side, up to
 * `want`, keeping `margin` m off every other part of the road (the inside of a tight bend, a road
 * doubling back near).
 * @param ctx the dress context
 * @param i road point
 * @param side -1 / +1
 * @param want m off the centre line
 * @param margin m clear of the road's edge
 * @returns m off the centre line
 */
export function roomAt(ctx: DressCtx, i: number, side: number, want: number,
    margin: number): number {
  let off = want;
  for (; off > ctx.halfWidth + margin; off -= 1.5) {
    const pos = ctx.pointAt(i, side * off);
    if (ctx.clear(pos.x, pos.y, margin)) return off;
  }
  return off;
}

// road points per Armco run and floor zone
const PIECE = 30, FLOOR_STEP = 3;

/**
 * The Armco along a guarded lip, 0.6 m in from it, where the gorge is at least half deep.
 * @param ctx the dress context
 */
function layLipArmco(ctx: DressCtx) {
  const { level, road, firstIdx, endIdx, pointAt, halfWidth, state } = ctx;
  for (let startIdx = Math.max(0, firstIdx - 1); startIdx < endIdx; startIdx += PIECE)
    for (const side of [-1, 1]) {
      let rail: Point[] = [];
      const flush = () => {
        if (rail.length > 1) level.barriers.push({ kind: 'armco', pts: rail,
          _s: road[startIdx].s });
        rail = [];
      };
      for (let j = startIdx; j <= Math.min(endIdx, road.length - 1, startIdx + PIECE); j++) {
        const stretch = stretchAt(road[j].s), cut = gorgeAt(road[j].s, side, state.seed, stretch);
        if (!cut || cut.ease < 0.5 || !ledgeOf(stretch.index, side, state.seed).armco) {
          flush();
          continue;
        }
        const pos = pointAt(j, side * (halfWidth + VERGE - 0.6));
        rail.push([pos.x, pos.y]);
      }
      flush();
    }
}

/**
 * Sand along the floor of a gorge or a wash beside road points [firstIdx, endIdx): a zone every
 * FLOOR_STEP points, from `from` to `to` m off the road edge (the zones' edges blend naturally).
 * @param ctx the dress context
 * @param i road point
 * @param side -1 / +1
 * @param from m off the road edge
 * @param upTo m off the road edge
 */
function laySand(ctx: DressCtx, i: number, side: number, from: number, upTo: number) {
  const { level, road, halfWidth, pointAt } = ctx,
    near = roomAt(ctx, i, side, halfWidth + upTo, 2) - halfWidth;
  if (near - from < 2) return;
  const mid = pointAt(i, side * (halfWidth + (from + near) / 2));
  level.zones.push({ x: mid.x, y: mid.y, w: FLOOR_STEP * 4 + 4, h: near - from, rot: mid.rot,
    surface: SURFACES.sand, art: null, _s: road[i].s });
}

/**
 * The ground's things beside road points [firstIdx, endIdx): the HIGH stretches' Armco, gorge
 * floors and the boulders down their slopes and on their floors, the DESERT stretches' sandy
 * washes (boulders in them), patches. The rock walls are highway/canyon.ts's.
 * @param ctx the dress context
 */
export function layGround(ctx: DressCtx) {
  const { road, firstIdx, endIdx, state, rand, halfWidth } = ctx;
  layLipArmco(ctx);
  for (let i = firstIdx; i < endIdx; i++) {
    const stretch = stretchAt(road[i].s);
    for (const side of [-1, 1]) {
      if (stretch.kind === 'high') {
        const cut = gorgeAt(road[i].s, side, state.seed, stretch);
        if (!cut || cut.ease < 0.3) continue;
        if (i % FLOOR_STEP === 0) laySand(ctx, i, side, footOf(cut) - 1, farOf(cut) + 1);
        // boulders fallen down the fall, on the floor, down the far rise
        if (rand() < 0.2) boulder(ctx, i, side * (halfWidth + VERGE + 2 + rand()
          * (rimOf(cut) - VERGE - 2)), 1 + rand() * 2.8);
      } else if (stretch.kind === 'desert') {
        if (i % 8 === 0 && rand() < 0.3) patch(ctx, i, side);
        const { wash, size } = desertSideOf(stretch.index, side, state.seed);
        if (!wash || inFrom(stretch, SIDES_EASE_M) < 0.3) continue;
        const span = washOf(size);
        if (i % FLOOR_STEP === 0) laySand(ctx, i, side, span.from + 2, span.from + span.width - 2);
        if (rand() < 0.06) boulder(ctx, i, side * (halfWidth + span.from + 3 + rand()
          * (span.width - 6)), 1 + rand() * 2);
      }
    }
  }
}

/**
 * A patch of other ground in the desert's gravel at road point i (owner 11-09: "gravel and sand
 * for the desert ... it can have patches of whatever looks right"): sand mostly, now and then
 * dirt, 12-36 m along and 8-20 m across, clear of the road.
 * @param ctx the dress context
 * @param i road point
 * @param side -1 / +1
 */
function patch(ctx: DressCtx, i: number, side: number) {
  const { rand, halfWidth, level, road } = ctx, along = 12 + rand() * 24, across = 8 + rand() * 12,
    pos = ctx.pointAt(i, side * (halfWidth + 3 + across / 2 + rand() * 25));
  if (!ctx.clear(pos.x, pos.y, across / 2 + 1)) return;
  level.zones.push({ x: pos.x, y: pos.y, w: along, h: across, rot: pos.rot + (rand() - 0.5) * 0.6,
    surface: rand() < 0.8 ? SURFACES.sand : SURFACES.dirt, art: null, _s: road[i].s });
}

/**
 * A red boulder at road point i, off the centre line, if clear.
 * @param ctx the dress context
 * @param i road point
 * @param off m off the centre line (signed)
 * @param size m
 */
function boulder(ctx: DressCtx, i: number, off: number, size: number) {
  const pos = ctx.pointAt(i, off);
  if (ctx.clear(pos.x, pos.y, size))
    ctx.level.props.push({ kind: 'rock', x: pos.x, y: pos.y, s: size, pal: 'red',
      seed: (ctx.road[i].s | 0) * 3 + (off > 0 ? 1 : 0), _s: ctx.road[i].s });
}
