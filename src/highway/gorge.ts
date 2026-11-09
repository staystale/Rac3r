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
//           ground banking up away from the road and down again), on ROLLING ground (owner
//           11-09: "more varied and random terrain"); its first FLAT_START m flat (a gas station).
//   DUNES   sand both sides, the dunes' ridges across it (a long windward slope, a short steep
//           slip face), their size and way the wind blew changing over the ground.
// Everything eases in and out over each stretch's ends; a stretch's depth is its own (the same
// all along it, so where two parts of the road are nearest the ground meets itself); the rolling
// ground and the dunes come from the ground's own place (no seam). All of it lies within REACH m
// of the road edge (the road's lookup reaches that far: highway.ts), faded out before it.
import { stretchAt, inFrom, type Stretch } from './desertplan.ts';
import { SURFACES } from '../world/surfaces.ts';
import { blendPatch, tri, BLEND_W } from '../world/blend.ts';
import { indexNewBushes, reindexBushes } from '../world/load.ts';
import type { Level, Surface, Zone } from '../world/types.ts';
import type { DressCtx } from './hwtypes.ts';
import type { Point } from '../world/types.ts';

export const REACH = 50;
// the ledge: the flat verge, the fall's plan width, the depth, the floor's width; the ease in
const VERGE = 1.2, FALL_MIN = 7, FALL_MAX = 11, DEPTH_MIN = 20, DEPTH_MAX = 35, FLOOR_MIN = 7,
  FLOOR_MAX = 12, RISE_MIN = 9, RISE_MAX = 13, EASE_M = 150;
// the desert: a wash's start off the edge, width, depth; a rise's peak off the edge and height
const WASH_IN = 5, WASH_MIN = 14, WASH_MAX = 22, WASH_DEEP = 4.5, RISE_PEAK = 22, RISE_END = 44,
  RISE_HIGH = 5, SIDES_EASE_M = 120, FLAT_START = 100;
// the rolling ground: its height and size; the dunes: their height, spacing, their slip face's
// share of a dune, how far the wind's way wanders; the ground they keep off the road edge and
// where they fade before REACH
const ROLL_HIGH = 3, ROLL_M = 45, DUNE_HIGH = 5, DUNE_M = 34, SLIP = 0.25, DUNE_WANDER = 0.35,
  NEAR_FADE = 5, NEAR_FADE_M = 10, FAR_FADE_M = 12;

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
 * Smooth value noise over the ground, -1..1 (the rolling ground, the dunes' size and wander).
 * @param x m / cell
 * @param y m / cell
 * @param seed the road's seed
 * @returns -1..1
 */
function noiseAt(x: number, y: number, seed: number): number {
  const cellX = Math.floor(x), cellY = Math.floor(y), fracX = x - cellX, fracY = y - cellY,
    corner = (dx: number, dy: number) => hash01((cellX + dx) * 73856093 ^ (cellY + dy) * 19349663
      ^ seed * 83492791) * 2 - 1,
    easeX = fracX * fracX * (3 - 2 * fracX), easeY = fracY * fracY * (3 - 2 * fracY);
  const top = corner(0, 0) + (corner(1, 0) - corner(0, 0)) * easeX,
    bottom = corner(0, 1) + (corner(1, 1) - corner(0, 1)) * easeX;
  return top + (bottom - top) * easeY;
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
    stretch: Stretch = stretchAt(dist, seed)): Cut | null {
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
  const { wash, size } = desertSideOf(stretch.index, side, seed), ease = sidesEase(stretch);
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
 * How far a desert stretch's side ground has come in: none over its first FLAT_START m (where a
 * gas station may stand: highway/canyon.ts), then easing in; easing out at its end.
 * @param stretch the stretch
 * @returns 0..1
 */
export const sidesEase = (stretch: Stretch) => Math.min(smooth((stretch.along - FLAT_START)
  / SIDES_EASE_M), smooth((stretch.len - stretch.along) / SIDES_EASE_M));

/**
 * 0 by the road, 1 from NEAR_FADE + NEAR_FADE_M m off its edge, 0 again by REACH (the rolling
 * ground and the dunes).
 * @param past m off the road edge
 * @returns 0..1
 */
const fadeOff = (past: number) => smooth((past - NEAR_FADE) / NEAR_FADE_M)
  * (1 - smooth((past - (REACH - FAR_FADE_M - 2)) / FAR_FADE_M));

/**
 * A dune field's height at a ground point: ridges across the wind (its way wandering), each a
 * long windward slope and a short slip face, their size changing over the ground.
 * @param x world x, m
 * @param y world y, m
 * @param seed the road's seed
 * @param wind the way the wind blew, rad
 * @returns m (0 .. DUNE_HIGH)
 */
function duneAt(x: number, y: number, seed: number, wind: number): number {
  const across = (x * Math.cos(wind) + y * Math.sin(wind)) / DUNE_M
    + DUNE_WANDER * noiseAt(x / 60, y / 60, seed + 5), frac = across - Math.floor(across),
    shape = frac < 1 - SLIP ? smooth(frac / (1 - SLIP)) : 1 - smooth((frac - 1 + SLIP) / SLIP);
  return DUNE_HIGH * (0.55 + 0.45 * noiseAt(x / 140, y / 140, seed + 9)) * shape;
}

/**
 * DEAF VALLEY's ground `offset` m off the centre line at a road distance (level.roadside).
 * @param dist road distance
 * @param offset m off the centre line (+: the driver's right, as pointAt)
 * @param halfWidth the road's half width, m
 * @param seed the road's seed
 * @param spot the ground point, m (the rolling ground and the dunes)
 * @returns m added to the ground's height
 */
export function desertGround(dist: number, offset: number, halfWidth: number, seed: number,
    spot: { x: number; y: number }): number {
  const past = Math.abs(offset) - halfWidth;
  if (past <= 0) return 0;
  const stretch = stretchAt(dist, seed), side = offset < 0 ? -1 : 1;
  if (stretch.kind === 'high') {
    const cut = gorgeAt(dist, side, seed, stretch);
    return cut ? gorgeHeight(cut, past) : 0;
  }
  if (stretch.kind === 'desert') return desertHeight(stretch, side, seed, past)
    + ROLL_HIGH * noiseAt(spot.x / ROLL_M, spot.y / ROLL_M, seed) * fadeOff(past)
    * sidesEase(stretch);
  if (stretch.kind === 'dunes') return duneAt(spot.x, spot.y, seed, hash01(stretch.index * 3 + seed)
    * Math.PI) * fadeOff(past) * inFrom(stretch, SIDES_EASE_M);
  return 0;
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
    // (the road only: a lay-by's keep-out is what a wall stands round - MEASURED, ?laybys=1: read
    // as blocked, it pulled the canyon's face in a 1.5 m step at a time, a sawtooth)
    if (ctx.roadClear(pos.x, pos.y, margin)) return off;
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
        const stretch = stretchAt(road[j].s, state.seed),
          cut = gorgeAt(road[j].s, side, state.seed, stretch);
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
 * @param ends which of its short sides end the chain: START_END, LAST_END (blended too)
 * @param surface its ground (sand)
 * @param blend its edges' blend
 */
function laySand(ctx: DressCtx, i: number, side: number, from: number, upTo: number,
    ends = 0, surface: Surface = SURFACES.sand, blend = CHAIN_BLEND) {
  const { level, road, halfWidth, pointAt } = ctx,
    near = roomAt(ctx, i, side, halfWidth + upTo, 2) - halfWidth;
  if (near - from < 2) return;
  const mid = pointAt(i, side * (halfWidth + (from + near) / 2)),
    zone: Zone = { x: mid.x, y: mid.y, w: FLOOR_STEP * 4 + 4, h: near - from, rot: mid.rot,
      surface, art: null, _s: road[i].s };
  level.zones.push(zone);
  // a chain of these along the road: only its long sides are its edges (and its own ends)
  speckle(ctx, zone, ends, blend);
}

/**
 * The ground's things beside road points [firstIdx, endIdx): the HIGH stretches' Armco, gorge
 * floors and the boulders down their slopes and on their floors, the DESERT stretches' sandy
 * washes (boulders in them), patches. The rock walls are highway/canyon.ts's.
 * @param ctx the dress context
 */
export function layGround(ctx: DressCtx) {
  const { road, firstIdx, endIdx, state } = ctx;
  layLipArmco(ctx);
  for (let i = firstIdx; i < endIdx; i++) {
    const stretch = stretchAt(road[i].s, state.seed);
    if (stretch.kind === 'dunes') { layDunes(ctx, i, stretch); continue; }
    for (const side of [-1, 1]) {
      if (stretch.kind === 'high') layGorgeSide(ctx, i, side, stretch);
      else if (stretch.kind === 'desert') layDesertSide(ctx, i, side, stretch);
    }
  }
}

/**
 * A HIGH stretch's falling side at road point i: the gorge's sand floor, boulders fallen down the
 * fall, on the floor, down the far rise.
 * @param ctx the dress context
 * @param i road point
 * @param side -1 / +1
 * @param stretch the stretch
 */
function layGorgeSide(ctx: DressCtx, i: number, side: number, stretch: Stretch) {
  const { road, state, rand, halfWidth } = ctx, cut = gorgeAt(road[i].s, side, state.seed, stretch);
  if (!cut || cut.ease < 0.3) return;
  if (i % FLOOR_STEP === 0) laySand(ctx, i, side, footOf(cut) - 1, farOf(cut) + 1);
  if (rand() < 0.2) boulder(ctx, i, side * (halfWidth + VERGE + 2 + rand()
    * (rimOf(cut) - VERGE - 2)), 1 + rand() * 2.8);
}

/**
 * A DESERT stretch's side at road point i: now and then a patch, a wash's sand floor and boulders.
 * @param ctx the dress context
 * @param i road point
 * @param side -1 / +1
 * @param stretch the stretch
 */
function layDesertSide(ctx: DressCtx, i: number, side: number, stretch: Stretch) {
  const { state, rand, halfWidth } = ctx;
  if (i % 8 === 0 && rand() < 0.3) patch(ctx, i, side);
  const { wash, size } = desertSideOf(stretch.index, side, state.seed);
  if (!wash || sidesEase(stretch) < 0.3) return;
  const span = washOf(size);
  if (i % FLOOR_STEP === 0) laySand(ctx, i, side, span.from + 2, span.from + span.width - 2);
  if (rand() < 0.06) boulder(ctx, i, side * (halfWidth + span.from + 3 + rand()
    * (span.width - 6)), 1 + rand() * 2);
}

/**
 * The dunes beside road point i: sand both sides from just off the edge out (its chain's end
 * blended at the stretch's ends), now and then a barrel cactus or a red rock.
 * @param ctx the dress context
 * @param i road point
 * @param stretch the dunes stretch
 */
function layDunes(ctx: DressCtx, i: number, stretch: Stretch) {
  const { rand, halfWidth } = ctx,
    end = (stretch.along < FLOOR_STEP * 4 ? START_END : 0)
      | (stretch.len - stretch.along < FLOOR_STEP * 4 ? LAST_END : 0);
  for (const side of [-1, 1]) {
    if (i % FLOOR_STEP === 0) laySand(ctx, i, side, 1.5, REACH + 6, end);
    if (rand() < 0.03) boulder(ctx, i, side * (halfWidth + 6 + rand() * 40), 1 + rand() * 1.5);
  }
}

/**
 * A patch of other ground in the desert's gravel from road point i on (owner 11-09: "gravel and
 * sand for the desert ... it can have patches of whatever looks right"; "patches need more
 * blending / to be larger"; "need to look better / be parallel to the road"): sand mostly, now
 * and then dirt, 25-60 m along the road and 14-32 m across, a chain following it, its edges and
 * ends blended wide.
 * @param ctx the dress context
 * @param i road point
 * @param side -1 / +1
 */
function patch(ctx: DressCtx, i: number, side: number) {
  const { rand, road } = ctx, along = 25 + rand() * 35, across = 14 + rand() * 18,
    from = 3 + rand() * 25, links = Math.max(2, Math.round(along / (FLOOR_STEP * 4))),
    surface = rand() < 0.8 ? SURFACES.sand : SURFACES.dirt;
  for (let link = 0; link < links && i + link * FLOOR_STEP < road.length; link++)
    laySand(ctx, i + link * FLOOR_STEP, side, from, from + across, (link === 0 ? START_END : 0)
      | (link === links - 1 ? LAST_END : 0), surface, PATCH_BLEND);
}

// the edge blend's chance a square each side of every SPECKLE_STEP m of edge
const SPECKLE_STEP = 1.2;
// the edge blend of a floor's chain, and of a patch's: denser, reaching further each way
// (x BLEND_W)
const CHAIN_BLEND = { chance: 0.5, reach: 1 }, PATCH_BLEND = { chance: 0.8, reach: 1.7 };
// a chain's first and last links (laySand ends): their short side blended as well
const START_END = 1, LAST_END = 2;

/**
 * A streamed zone's edges blended as every level's are (world/blend.ts, owner 11-09: "the sand
 * patches should blend how other soft surfaces do like speckles and fade between them"): squares
 * of the zone's ground scattered out over the gravel and of the gravel in over it, most at the
 * edge, none past BLEND_W; laid with the zone, indexed with the ground (world/load.ts), dropped
 * behind it.
 * @param ctx the dress context
 * @param zone the zone (turned: rot)
 * @param ends which short sides as well: START_END (behind), LAST_END (ahead)
 * @param blend how dense the squares and how far they reach (x BLEND_W)
 */
function speckle(ctx: DressCtx, zone: Zone, ends: number,
    blend: { chance: number; reach: number }) {
  const { level, rand } = ctx, base = level.base as Surface, cos = Math.cos(zone.rot || 0),
    sin = Math.sin(zone.rot || 0), added = [];
  // each side: [along x?, its fixed local coordinate, its length, outward sign]
  const sides: [boolean, number, number, number][] = [[true, zone.h / 2, zone.w, 1],
    [true, -zone.h / 2, zone.w, -1]];
  if (ends & LAST_END) sides.push([false, zone.w / 2, zone.h, 1]);
  if (ends & START_END) sides.push([false, -zone.w / 2, zone.h, -1]);
  for (const [alongX, fixed, len, out] of sides)
    for (let along = -len / 2 + 0.5; along < len / 2; along += SPECKLE_STEP)
      for (const [sign, surface] of [[1, zone.surface], [-1, base]] as [number, Surface][]) {
        if (rand() > blend.chance) continue;
        const deep = fixed + out * sign * (0.3 + tri(rand) * BLEND_W * blend.reach),
          localX = alongX ? along : deep, localY = alongX ? deep : along,
          x = zone.x + localX * cos - localY * sin, y = zone.y + localX * sin + localY * cos;
        if (!ctx.clear(x, y, 0.8)) continue;
        added.push({ ...blendPatch(rand, x, y, surface), streamed: true, _s: zone._s });
      }
  level._streamed = [...(level._streamed || []), ...added];
  indexNewBushes(level as Level, added);
}

/**
 * A new road (highway.ts resetHighway): no streamed patches until its zones are laid.
 * @param level the highway level
 */
export function resetStreamed(level: Level) {
  if (!level._streamed || !level._streamed.length) return;
  level._streamed = [];
  reindexBushes(level);
}

/**
 * Drops the streamed patches the road has left behind (highway.ts slide).
 * @param level the highway level
 * @param startDist the road distance everything before is dropped, m
 */
export function pruneStreamed(level: Level, startDist: number) {
  const list = level._streamed;
  if (!list || !list.length) return;
  const kept = list.filter((square) => (square._s ?? 0) >= startDist);
  if (kept.length === list.length) return;
  level._streamed = kept;
  reindexBushes(level);
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
