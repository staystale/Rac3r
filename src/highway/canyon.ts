// highway/canyon.ts - DEAF VALLEY's roadside (owner 11-08: "canyon which can have the features
// you've described / Cactus too?"; 11-09: the HIGH road, the gorges, the rock formations; the
// canyon road's road type is presets.ts canyon). By road distance (highway/desertplan.ts) the road
// runs through a CANYON - a rock wall each side weaving GAP_MIN .. GAP_MAX m off the road edge, the
// rock behind it (a band THICK m deep with strata lines, its face shading the verge) swinging away
// over FLARE_M at each end so no wall end faces the road; saguaros on the rims, red boulders - then
// the HIGH road - a rock wall close on its uphill side, a side that falls away open to its gorge
// (highway/gorge.ts: the ground falls, the floor, the rise beyond, the Armco) - then the OPEN
// DESERT: saguaros, barrel cacti, boulders, the rock formations (buttes, hoodoos, arches). The
// cacti are loose objects (cones/coneConsts.ts DEBRIS: they snap when hit, and their spines
// puncture).
// Everything is a function of road distance (and the road's own seed), so the stretches each
// dress call lays join exactly.
import { bayOut } from './laybys.ts';
import { keepOut } from './cuts.ts';
import { FIX } from '../core/fixes.ts';
import { stretchAt, stationSideOf } from './desertplan.ts';
import { SURFACES } from '../world/surfaces.ts';
import { gorgeAt, rimOf, layGround, roomAt } from './gorge.ts';
import type { Point, Prop } from '../world/types.ts';
import type { DressCtx, HwPose } from './hwtypes.ts';

const FLARE_M = 80, FLARE_OUT = 30;
// (?desertroom=1: more room - 4 .. 9)
const GAP_MIN = FIX.desertroom ? 4 : 2.5, GAP_MAX = FIX.desertroom ? 9 : 7.5, THICK_MIN = 10,
  THICK_MAX = 22;
// the HIGH road's uphill wall: close to the road
// (?desertroom=1: 2.5 .. 4.5)
const UPHILL_MIN = FIX.desertroom ? 2.5 : 1.2, UPHILL_MAX = FIX.desertroom ? 4.5 : 3.5;
// road points per wall piece (each dropped behind with the rest)
const PIECE = 30;

/**
 * 0..1 weaving along the road, its own way each side.
 * @param dist road distance
 * @param side -1 / +1
 * @param seed the road's seed
 * @returns 0..1
 */
function wobbleAt(dist: number, side: number, seed: number): number {
  const phase = (seed % 97) * 0.13 + side * 1.7;
  return 0.5 + 0.5 * Math.sin(dist / 97 + phase) * (0.6 + 0.4 * Math.sin(dist / 233 + side));
}

/**
 * The rock's depth behind a wall's face at a road distance, m.
 * @param dist road distance
 * @param side -1 / +1
 * @returns m
 */
const thickAt = (dist: number, side: number) =>
  THICK_MIN + (THICK_MAX - THICK_MIN) * (0.5 + 0.5 * Math.sin(dist / 61 + side * 2.3));

/**
 * A rock wall's face at a road distance on one side - m off the road edge, swinging out over
 * FLARE_M at its stretch's ends - or null where there is none: the canyon's walls, the HIGH road's
 * uphill wall (none on a side falling into a gorge: its far side is the ground rising).
 * @param dist road distance
 * @param side -1 / +1
 * @param seed the road's seed
 * @returns m off the road edge, or null
 */
function wallGapAt(dist: number, side: number, seed: number): number | null {
  const stretch = stretchAt(dist, seed),
    toEnd = Math.min(stretch.along, stretch.len - stretch.along),
    flare = Math.max(0, 1 - toEnd / FLARE_M), out = FLARE_OUT * flare * flare,
    wobble = wobbleAt(dist, side, seed);
  if (stretch.kind === 'canyon') return GAP_MIN + (GAP_MAX - GAP_MIN) * wobble + out;
  if (stretch.kind !== 'high') return null;
  const cut = gorgeAt(dist, side, seed, stretch);
  if (cut) return null;
  return UPHILL_MIN + (UPHILL_MAX - UPHILL_MIN) * wobble + out;
}

// m a lay-by cut into the rock keeps its face off the lay-by's outer edge (highway/laybys.ts)
const NOTCH_M = 0.6;

/**
 * The rock's face off the road edge for a road: wallGapAt, cut back into the rock where a lay-by
 * needs the room (owner 11-09: "cut it out the rock don't move the rock / Like real life": the
 * rock behind stays where it was - layRockWalls).
 * @param ctx the dress context
 * @param dist road distance
 * @param side -1 / +1
 * @returns m off the road edge, or null
 */
function gapOf(ctx: DressCtx, dist: number, side: number): number | null {
  const gap = wallGapAt(dist, side, ctx.state.seed), bay = bayOut(ctx.level, dist, side);
  return gap === null || bay <= 0 ? gap : Math.max(gap, bay + NOTCH_M);
}

/**
 * The rock walls of road points [firstIdx, endIdx): each side in PIECE-point pieces (overlapping
 * by one point), each with its rock band and two strata lines, kept off every other part of the
 * road (the inside of a tight bend).
 * @param ctx the dress context
 */
function layRockWalls(ctx: DressCtx) {
  const { level, halfWidth, road, firstIdx, endIdx, pointAt } = ctx;
  for (let startIdx = Math.max(0, firstIdx - 1); startIdx < endIdx; startIdx += PIECE)
    for (const side of [-1, 1]) {
      let face: Point[] = [], back: Point[] = [], strata: Point[][] = [[], []];
      const flush = () => {
        if (face.length > 1) level.barriers.push({ kind: 'rock', pts: face,
          band: [...face, ...back.reverse()], strata, _s: road[startIdx].s });
        face = []; back = []; strata = [[], []];
      };
      for (let j = startIdx; j <= Math.min(endIdx, road.length - 1, startIdx + PIECE); j++) {
        const dist = road[j].s, gap = wallGapAt(dist, side, ctx.state.seed);
        if (gap === null) { flush(); continue; }
        // (the rock as it stands; a lay-by's notch cuts its face back, never past its back -
        // the strata cut off at the face)
        const from = roomAt(ctx, j, side, halfWidth + gap, 2.5),
          deep = Math.max(2, roomAt(ctx, j, side, from + thickAt(dist, side), 3) - from),
          near = Math.min(from + deep - 1, Math.max(from, halfWidth + gapOf(ctx, dist, side)!)),
          spot = (off: number) => {
            const pos = pointAt(j, side * Math.max(near, off));
            return [pos.x, pos.y] as Point;
          };
        face.push(spot(near));
        back.push(spot(from + deep));
        strata[0].push(spot(from + deep * (0.32 + 0.06 * Math.sin(dist / 23 + side))));
        strata[1].push(spot(from + deep * (0.66 + 0.06 * Math.sin(dist / 31 - side))));
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
 * A cactus (a loose object: it snaps when hit) at point i if clear there: a saguaro, or a small
 * barrel cactus.
 * @param ctx the dress context
 * @param i road point
 * @param off m off the centre line (signed)
 * @param tall a saguaro
 */
function cactus(ctx: DressCtx, i: number, off: number, tall: boolean) {
  const pos: HwPose = ctx.pointAt(i, off);
  if (ctx.loose && ctx.clear(pos.x, pos.y, tall ? 1.5 : 1))
    ctx.loose.push({ kind: tall ? 'cactus' : 'barrelcactus', x: pos.x, y: pos.y,
      rot: ((ctx.road[i].s | 0) % 7) * 0.9, _s: ctx.road[i].s });
}

/**
 * A rim at point i (a canyon's, the HIGH road's uphill side): saguaros on the rock, red boulders
 * by the wall, big boulders past it.
 * @param ctx the dress context
 * @param i road point
 * @param side -1 / +1
 * @param rim m off the road edge to the wall's face
 */
function rimProps(ctx: DressCtx, i: number, side: number, rim: number) {
  const { rand, halfWidth, road } = ctx, dist = road[i].s, seed = (dist | 0) * 2 + side,
    thick = thickAt(dist, side);
  if (rand() < (FIX.desertroom ? 0.26 : 0.18)) cactus(ctx, i, side * (halfWidth + rim + 2
    + rand() * (thick - 3)), true);
  if (rand() < 0.05) place(ctx, i, side * (halfWidth + rim - 1.2), { kind: 'rock',
    s: 1 + rand() * 1.5, pal: 'red', seed });
  if (i % 8 === 0 && rand() < 0.3) place(ctx, i, side * (halfWidth + rim + thick + 6 + rand()
    * 30), { kind: 'rock', s: 8 + rand() * 12, pal: 'red', seed });
}

/**
 * The open desert at point i from `from` m off the centre line out: saguaros, barrel cacti,
 * boulders, now and then a rock formation far out.
 * @param ctx the dress context
 * @param i road point
 * @param side -1 / +1
 * @param from m off the centre line where the open ground starts
 */
function desertProps(ctx: DressCtx, i: number, side: number, from: number) {
  const { rand, road } = ctx, seed = (road[i].s | 0) * 2 + side;
  // (owner 11-09: "cactus could be more popular haha", then "maybe more cactus in the desert":
  // about three times the first)
  // (?desertroom=1: half as many again, and a band of them by the road)
  const more = FIX.desertroom ? 1.5 : 1;
  if (rand() < 0.2 * more) cactus(ctx, i, side * (from + 2 + rand() * 45), true);
  if (rand() < 0.22 * more) cactus(ctx, i, side * (from - 1.5 + rand() * 20), false);
  if (FIX.desertroom && rand() < 0.12) cactus(ctx, i, side * (from + 2 + rand() * 5),
    rand() < 0.4);
  if (rand() < 0.05) place(ctx, i, side * (from + rand() * 40), { kind: 'rock',
    s: 1.5 + rand() * 2.5, pal: 'red', seed });
  if (i % 6 === 0 && rand() < 0.1) formation(ctx, i, side, from, seed);
  junk(ctx, i, side, from, seed);
}

/**
 * The desert's junk at point i (owner 11-09: "Definite rusted out cars ... cattle skull"): now and
 * then a rusted-out car (a solid wreck, sometimes on its roof), a cattle skull.
 * @param ctx the dress context
 * @param i road point
 * @param side -1 / +1
 * @param from m off the centre line where the open ground starts
 * @param seed its look's seed
 */
function junk(ctx: DressCtx, i: number, side: number, from: number, seed: number) {
  const { rand, pointAt } = ctx;
  if (i % 10 === 0 && rand() < 0.08) place(ctx, i, side * (from + 4 + rand() * 35),
    { kind: 'wreck', rot: pointAt(i, 0).rot + (rand() - 0.5) * 2.4, flip: rand() < 0.25, seed });
  if (rand() < 0.012) place(ctx, i, side * (from + 1 + rand() * 12), { kind: 'skull',
    rot: rand() * Math.PI * 2, seed });
}

/**
 * The dunes at point i: little grows on them - a barrel cactus now and then, a wreck half buried,
 * a skull.
 * @param ctx the dress context
 * @param i road point
 * @param side -1 / +1
 * @param from m off the centre line where the dunes start
 */
function dunesProps(ctx: DressCtx, i: number, side: number, from: number) {
  const { rand, road } = ctx, seed = (road[i].s | 0) * 2 + side;
  if (rand() < (FIX.desertroom ? 0.12 : 0.04)) cactus(ctx, i, side * (from + rand() * 30), false);
  // (?desertroom=1: saguaros on the dunes too)
  if (FIX.desertroom && rand() < 0.06) cactus(ctx, i, side * (from + 4 + rand() * 30), true);
  if (i % 4 === 0) junk(ctx, i, side, from, seed);
}

// the desert's road signs (owner 11-09: "road signs can be a thing"), one every SIGN_M m of road
// on alternating sides
const DESERT_SIGNS = ['FLASH FLOOD AREA', 'NEXT GAS 100 MI', 'WATCH FOR ROCKS',
  'DO NOT STOP ON SALT', 'SPEED LIMIT 55 (MAYBE)', 'NO SERVICES', 'DRINK WATER',
  'GORGE AHEAD (SORRY)', 'TURN BACK (JOKING)', 'CACTUS CROSSING'];
const SIGN_M = 420;

/**
 * A road sign at point i where the road passes each SIGN_M m mark (a board by the verge).
 * @param ctx the dress context
 * @param i road point
 */
function roadSign(ctx: DressCtx, i: number) {
  const { road, halfWidth, level } = ctx, dist = road[i].s, mark = Math.floor(dist / SIGN_M);
  if (mark === Math.floor((dist - 4) / SIGN_M) || mark < 1) return;
  const side = mark % 2 ? 1 : -1, pos = ctx.pointAt(i, side * (halfWidth + 3.5));
  if (!ctx.clear(pos.x, pos.y, 2)) return;
  level.props.push({ kind: 'board', x: pos.x, y: pos.y, rot: pos.rot,
    label: DESERT_SIGNS[(mark * 7 + (ctx.state.seed % 13)) % DESERT_SIGNS.length],
    _s: dist } as Prop);
}

// the station's apron: road points either way its edge runs along the road (the way in and out),
// those its forecourt's far side spans, and how deep it is off the road edge, m
const APRON_OUT = 7, APRON_IN = 4, APRON_DEEP = 19;

/**
 * The LAST GASP gas station near the start of a desert stretch (owner 11-09: "gas station"; its
 * first FLAT_START m are flat: highway/gorge.ts): a concrete apron off the road edge - its way in
 * and out tapering off the road ("a little road in n out blending into the main road"), the
 * forecourt - the shop, two pumps under the canopy (drawn over the cars), its sign. Three desert
 * stretches in five.
 * @param ctx the dress context
 * @param i road point (the stretch 44-48 m in)
 * @param index the stretch's number
 */
function gasStation(ctx: DressCtx, i: number, index: number) {
  const { level, road, halfWidth, state } = ctx, side = stationSideOf(index, state.seed);
  if (side === null) return;
  const apron = ctx.pointAt(i, side * (halfWidth + 10)),
    rot = apron.rot + (side < 0 ? Math.PI : 0), dist = road[i].s;
  if (!ctx.clear(apron.x, apron.y, 9) || i < APRON_OUT || i + APRON_OUT >= road.length) return;
  const poly: Point[] = [];
  for (let j = i - APRON_OUT; j <= i + APRON_OUT; j++) {
    const pos = ctx.pointAt(j, side * (halfWidth + 0.3));
    poly.push([pos.x, pos.y]);
  }
  for (let j = i + APRON_IN; j >= i - APRON_IN; j--) {
    const pos = ctx.pointAt(j, side * (halfWidth + APRON_DEEP));
    poly.push([pos.x, pos.y]);
  }
  const allX = poly.map(([x]) => x), allY = poly.map(([, y]) => y), minX = Math.min(...allX),
    maxX = Math.max(...allX), minY = Math.min(...allY), maxY = Math.max(...allY);
  level.zones.push({ x: (minX + maxX) / 2, y: (minY + maxY) / 2, w: maxX - minX, h: maxY - minY,
    poly, surface: SURFACES.concrete, art: null, boxed: true, _s: dist });
  level.props.push({ kind: 'gasstation', x: apron.x, y: apron.y, rot, _s: dist } as Prop,
    { kind: 'canopy', x: apron.x, y: apron.y, rot, _s: dist } as Prop);
  // (?desertroom=1: its board before the way in, not in it; the forecourt and its ways in and
  // out kept clear)
  const board = ctx.pointAt(FIX.desertroom ? Math.max(0, i - APRON_OUT - 3) : i - 5,
    side * (halfWidth + 3.5));
  level.props.push({ kind: 'board', x: board.x, y: board.y, rot: board.rot, label: 'LAST GASP',
    _s: dist } as Prop);
  if (FIX.desertroom) for (let j = i - APRON_OUT; j <= i + APRON_OUT; j += 3) {
    const pos = ctx.pointAt(j, side * (halfWidth + APRON_DEEP / 2));
    keepOut(level, { x: pos.x, y: pos.y, ax: Math.cos(pos.rot), ay: Math.sin(pos.rot),
      hu: 7, hv: APRON_DEEP / 2 + 1.5 }, road[j].s);
  }
}

/**
 * A rock formation at point i, far out: a BUTTE (a flat-topped mass 18-45 m across), a cluster of
 * HOODOOS (spires), an ARCH (14-26 m span, across the way the road runs), or a big boulder.
 * @param ctx the dress context
 * @param i road point
 * @param side -1 / +1
 * @param from m off the centre line where the open ground starts
 * @param seed its look's seed
 */
function formation(ctx: DressCtx, i: number, side: number, from: number, seed: number) {
  const { rand } = ctx, pick = rand(), rot = rand() * Math.PI;
  if (pick < 0.35) {
    const size = 18 + rand() * 27;
    place(ctx, i, side * (from + 25 + size / 2 + rand() * 60), { kind: 'butte', s: size, rot,
      seed });
  } else if (pick < 0.7) {
    const size = 6 + rand() * 7;
    place(ctx, i, side * (from + 10 + size / 2 + rand() * 50), { kind: 'hoodoo', s: size, rot,
      seed });
  } else if (pick < 0.85) {
    const size = 14 + rand() * 12;
    place(ctx, i, side * (from + 15 + size / 2 + rand() * 40), { kind: 'arch', s: size,
      rot: ctx.pointAt(i, 0).rot + (rand() - 0.5) * 0.8, seed });
  } else place(ctx, i, side * (from + 12 + rand() * 50), { kind: 'rock', s: 8 + rand() * 12,
    pal: 'red', seed });
}

/**
 * A petrol station at road point i if its desert stretch has one there (44-48 m in).
 * @param ctx the dress context
 * @param i road point
 */
function stationAt(ctx: DressCtx, i: number) {
  const stretch = stretchAt(ctx.road[i].s, ctx.state.seed);
  if (stretch.kind === 'desert' && stretch.along >= 44 && stretch.along < 48)
    gasStation(ctx, i, stretch.index);
}

/**
 * One side's things at road point i by its stretch: the desert's, the dunes', the plateau past a
 * gorge's far rim, or a wall's rim.
 * @param ctx the dress context
 * @param i road point
 * @param side -1 / +1
 * @param kind the stretch's kind
 */
function sideProps(ctx: DressCtx, i: number, side: number, kind: string) {
  const { road, halfWidth, state } = ctx, dist = road[i].s;
  const gap = gapOf(ctx, dist, side), cut = gorgeAt(dist, side, state.seed);
  if (kind === 'desert') desertProps(ctx, i, side, halfWidth + 1);
  else if (kind === 'dunes') dunesProps(ctx, i, side, halfWidth + 2);
  // past a gorge's far rim, the plateau
  else if (cut) { if (i % 4 === 0) desertProps(ctx, i, side, halfWidth + rimOf(cut) + 3); }
  else if (gap !== null) rimProps(ctx, i, side, gap);
}

/**
 * Dress road points [firstIdx, endIdx) as Deaf Valley: the rock walls, the ground (gorges, washes:
 * highway/gorge.ts), the cacti, rocks and formations, a DEAF VALLEY board now and then.
 * @param ctx the dress context
 */
export function dressCanyon(ctx: DressCtx) {
  const { level, road, firstIdx, endIdx, halfWidth, state } = ctx;
  // (?desertroom=1: the petrol stations first - the signs, cacti and rocks laid below keep off
  // their way in and out)
  // (a station whose way out runs past the road built so far is laid by the next call - MEASURED,
  // _desertroom.mjs: one in three was dropped at the window's end)
  if (FIX.desertroom) for (let i = Math.max(0, firstIdx - APRON_OUT); i < endIdx - APRON_OUT; i++)
    stationAt(ctx, i);
  for (let i = firstIdx; i < endIdx; i++) {
    const dist = road[i].s, stretch = stretchAt(dist, state.seed);
    if (!FIX.desertroom) stationAt(ctx, i);
    if (stretch.kind !== 'canyon') roadSign(ctx, i);
    if (i % 2 === 0) for (const side of [-1, 1]) sideProps(ctx, i, side, stretch.kind);
    // the board at the start of each canyon
    if (stretch.kind === 'canyon' && stretch.along < 4) {
      const pos = ctx.pointAt(i, -(halfWidth + 5 + bayOut(level, dist)));
      level.props.push({ kind: 'board', x: pos.x, y: pos.y, rot: pos.rot, label: 'DEAF VALLEY',
        _s: dist } as Prop);
    }
  }
  layGround(ctx);
  layRockWalls(ctx);
}
