// coverfield.ts - THE COVER FIELD (the default since 2026-10-18, ?coverfield=0 off; owner: rain
// and snow build in small patches that grow and join until they coat the race surface if it goes
// on long enough; heat dries and melts them back; everything by the weather and the temperature,
// on every level, the endless highway too; wet and snowy races start with some already settled).
//
// How: every point of the world has a CATCH, 0..1 - smooth value noise in world space (the water
// and the snow each their own), so neighbouring points catch alike and patches have shape. The
// weather moves LEVELS: water, snow and ice. A point is covered where the level is above its
// catch: the lowest-catching points first (small scattered patches), then more and more until at
// level 1 everything is covered; drying and melting take the level down again, so patches shrink
// and break up the same way. Nothing is stored per point, so a new piece of the endless road is
// covered as the rest of the world at once. Water freezes from its shallow edge: with water w and
// ice i, a point with catch < w holds water, w..w+i ice. Snow lies over both.
//
// LEVEL AREAS (owner: snow levels start snowy and melt; the Bowling Alley's wet lane is water that
// evaporates if the weather does not allow it): the level's own snow, ice, water and packed snow
// (its snow ground, cover zones and lanes, packed snow roads, hand-placed patches) are areas with
// levels of their own - full at an event's start, moved by the same rules - so the level's snow
// melts in patches too. Their ground is painted as what lies beneath (areaUnder: a road's tarmac,
// open snow ground's grass, or the surface's own `under`). Scenery water (Cover.water: lakes,
// streams) stays as it is. Tyres change single cells (wear.ts): those follow their own rules and
// the field again when the weather moves (syncFieldCells).
import {
  ICE_MELT_SHARE, WEATHER, setMeltSoak, weatherRandom, weatherRuns, weatherSnowy,
} from "./weather.ts";
import { wearMap, wearDirty, WEAR_CELL } from "./wear.ts";
import { isCracked } from "./icecrack.ts";
import type { Cover, Layers, Surface, WearCell } from "./types.ts";

// LEVEL per second at rain 1 / snow 1 (owner: heavy coats the track in ~10 min, light in ~25;
// the first patches within a minute)
const WATER_FILL_PER_S = 1 / 600, SNOW_FILL_PER_S = 1 / 420;
// a dry spell takes water down per C of track (20 C: a full level in ~13 min)
const WATER_DRY_PER_S_PER_C = 1 / (780 * 20);
// snow settles below SNOW_SETTLE_C and melts above it per C (15 C: a full coat in ~10 min, 43 C
// ~3 min), packed snow slower, both faster in rain; all of what melts is left as water; snow
// falling on water adds SNOW_INTO_WATER of itself to it
const SNOW_SETTLE_C = 1, SNOW_MELT_PER_S_PER_C = 1 / 7000, PACKED_MELT_PER_S_PER_C = 1 / 14000;
const RAIN_MELT = 2, SNOW_INTO_WATER = 0.6;
// MELTWATER (owner: weather melting ice and snow should leave water): a melting full coat
// dries as slowly as in the rain and soaks the track's damp as a drizzle of this rain would
const MELT_SOAK_RAIN = 0.25;
// water freezes below FREEZE_C (per C colder), ice thaws above THAW_C (per C warmer)
const FREEZE_C = 0, FREEZE_PER_S_PER_C = 1 / 60, THAW_C = 1;
// ONE COLD-SURFACE ORDER (owner: one coherent system - snow builds on ice and on
// snow, never on water: snow meeting water melts into it, or the water freezes first when cold;
// rain melts snow and ice faster, snow faster; rain on ice lies on it or freezes into it). Water
// and ice each cover from the lowest catch up (water over ice where both reach), so rain no longer
// pushes the ice ring out onto dry ground; freezing water thickens the ice under it (the ice
// reaches as far as the water did); thawing ice pools water in its middle as its rim shrinks.
// A square shows water over snow over ice; a level area's cover and the weather's stack by the
// same order.
const ICE_RAIN_MELT = 1;
// the top of a level: a little over 1, so a full coat stays full for a while as it dries
const LEVEL_MAX = 1.15;
// the wear cells follow the field every SYNC_S; a spot the tyres cleared fills again while it
// rains / snows, by a chance a second of REFILL_PER_S at rain / snow 1 (~15 s)
const SYNC_S = 1, REFILL_PER_S = 1 / 15;
// CATCH: noise cells of CATCH_BIG_M and CATCH_SMALL_M (weight CATCH_SMALL_K) in world space, then
// stretched from CATCH_LOW..CATCH_HIGH to 0..1 (two smooth octaves pile up in the middle; this
// spreads them so the coat grows steadily); the water's and the snow's own seeds
const CATCH_BIG_M = 16, CATCH_SMALL_M = 5, CATCH_SMALL_K = 0.35;
const CATCH_LOW = 0.1, CATCH_HIGH = 0.82;
export const WATER_SEED = 0x2c1b3c6d, SNOW_SEED = 0x297a2d39;
// the field lies in FIELD_SQ squares, each read at its centre - the covers' grid (coverlookup.ts
// COVER_SQ), drawn as the same squares (render/glfield.ts): what you see is what the tyre feels
export const FIELD_SQ = 0.5;
// a wet / snowy event's start: the levels already settled (owner): raining, a drying track, snow
// lying (owner: on a normal track about a quarter of what lay at first - ~3-20 % of the ground -
// then it builds or wears with racing; a snow level's own snow is its area, full) - each a range,
// dealt from the weather's seeded stream
// RAIN GRIP (owner: "less and more smaller puddles maybe like real rain"; "water
// can still evaporate during rain just less"). MEASURED before (_coverfield.mjs, Castle Cum):
// heavy rain left 98 % of the race surface under water in 10 min, light rain 100 % in 25. Now the
// water rises only to RAIN_WATER_BASE + RAIN_WATER_PER_RAIN x rain (light ~0.21, heavy 0.33 of
// the catch) and runs off above it at RUNOFF_PER_S; it evaporates in rain too, at RAIN_EVAP_SHARE
// of a dry spell's rate; a rainy start deals START_RAIN.
const RAIN_WATER_BASE = 0.11, RAIN_WATER_PER_RAIN = 0.22, RUNOFF_PER_S = 1 / 300;
const RAIN_EVAP_SHARE = 0.2;
const START_RAIN = [0.075, 0.25], START_DRYING = 0.35, START_SNOW = [0.15, 0.38], SNOW_LYING = 0.6;
// a SNOWY level (a snow-themed stage, weather only: weather.ts) in the cold: its snow always lies,
// deep (most of the ground) - what its own drawn snow was
const SNOWY_START_SNOW = [0.75, 1.05];
// MUD FROST (owner: all mud and thick mud freeze alike, driven over or not, thick mud
// a bit slower): a frost level per mud kind rises below MUD_FREEZE_C (per C colder) and falls
// above THAW_C; a mud square is ice where its frost is above its water catch, so the mud ices over
// in patches like the rest of the field (-5 C: mud fully frozen in ~5 min, thick mud ~7). A cold
// start finds it frozen already: START_FROST_PER_C a C below MUD_FREEZE_C.
const MUD_FREEZE_C = -1, FROST_PER_S_PER_C = 1 / 1500;
const THICK_FROST_RATE = 0.7, START_FROST_PER_C = 0.2;
// what lies under an area with no `under` of its own: open snow ground's grass, else tarmac
const UNDER_SNOW_GROUND = 'grass', UNDER_DEFAULT = 'tarmac';

/** How far up the catch water, snow, ice and packed snow reach, 0..LEVEL_MAX. */
export interface Levels { water: number; snow: number; ice: number; packed: number }

/** The kinds of level area, in the order of their mask codes (render/glfield.ts) from 1. */
export const AREA_KINDS = ['wet', 'snow', 'ice', 'packedSnow'] as const;
export type AreaKind = typeof AREA_KINDS[number];

const emptyLevels = (): Levels => ({ water: 0, snow: 0, ice: 0, packed: 0 });

/** How far up the water catch the frost reaches on mud and on thick mud, 0..LEVEL_MAX. */
export const FROST = { mud: 0, thickMud: 0 };
export type FrostKind = keyof typeof FROST;

/** The weather's levels over the whole world. */
export const FIELD: Levels = emptyLevels();

/** Each kind of level area's own levels. */
export const AREAS: Record<AreaKind, Levels> = {
  wet: emptyLevels(), snow: emptyLevels(), ice: emptyLevels(), packedSnow: emptyLevels(),
};

let syncS = 0, epoch = 0;
// the AI plans its speeds again when a level crosses a tenth (ai/line.ts): the bands last seen
// (the weather's and each area's four, then the two frosts)
const bandsSeen = new Int16Array((AREA_KINDS.length + 1) * 4 + 2);

/**
 * The frost kind of a ground surface: mud or thick mud, else null.
 * @param surfaceId the surface id
 * @returns the kind
 */
export function frostKindOf(surfaceId: string): FrostKind | null {
  return surfaceId === 'mud' || surfaceId === 'thickMud' ? surfaceId : null;
}

/**
 * A grid point's noise value, 0..1 (an integer hash).
 * @param gridX grid x
 * @param gridY grid y
 * @param seed the stream
 * @returns 0..1
 */
function gridValue(gridX: number, gridY: number, seed: number): number {
  let hash = Math.imul(gridX, 0x27d4eb2d) ^ Math.imul(gridY, 0x165667b1) ^ seed;
  hash = Math.imul(hash ^ (hash >>> 15), 0x85ebca6b);
  hash = Math.imul(hash ^ (hash >>> 13), 0xc2b2ae35);
  return ((hash ^ (hash >>> 16)) >>> 0) / 4294967296;
}

/**
 * Smooth value noise at a point, 0..1 (the grid values blended with a smoothstep).
 * @param x world x in noise cells
 * @param y world y in noise cells
 * @param seed the stream
 * @returns 0..1
 */
function valueNoise(x: number, y: number, seed: number): number {
  const gridX = Math.floor(x), gridY = Math.floor(y);
  const fracX = x - gridX, fracY = y - gridY;
  const easeX = fracX * fracX * (3 - 2 * fracX), easeY = fracY * fracY * (3 - 2 * fracY);
  const topLeft = gridValue(gridX, gridY, seed), bottomLeft = gridValue(gridX, gridY + 1, seed);
  const top = topLeft + (gridValue(gridX + 1, gridY, seed) - topLeft) * easeX;
  const bottom = bottomLeft + (gridValue(gridX + 1, gridY + 1, seed) - bottomLeft) * easeX;
  return top + (bottom - top) * easeY;
}

/**
 * How high water or snow must rise to cover a point, 0..1 in 255 steps (the GPU keeps it in a
 * byte: the physics compares the very same numbers).
 * @param x world x, m
 * @param y world y, m
 * @param seed the water's or the snow's
 * @returns 0..1
 */
export function catchAt(x: number, y: number, seed: number): number {
  const noise = (valueNoise(x / CATCH_BIG_M, y / CATCH_BIG_M, seed) * (1 - CATCH_SMALL_K)
    + valueNoise(x / CATCH_SMALL_M, y / CATCH_SMALL_M, seed + 1) * CATCH_SMALL_K);
  return Math.round(Math.max(0, Math.min(1, (noise - CATCH_LOW) / (CATCH_HIGH - CATCH_LOW))) * 255)
    / 255;
}

/**
 * Whether the tyres (or the level) own a wear cell's look: the field is not drawn there, the
 * tiles show it (render/glfield.ts).
 * @param cell the wear cell
 * @returns true when the tiles show it
 */
export function cellOwned(cell: WearCell): boolean {
  // a cracked cell's ice is drawn as the tyres left it (icecrack.ts)
  return !!cell.fixed || cell.cover !== (cell.laid ?? null) || isCracked(cell);
}

// ONE LOOK (owner: driven-over ice should look the same as the surface's ice - all
// one system): the covers the tyres make in a wear cell (ice, snow, packed snow, water) are drawn
// by the GPU field with the field's own look, the tiles showing the ground under them, as for the
// field's covers; the level's fixed covers (scenery water) keep their tile art
const GPU_COVERS = ['wet', 'ice', 'snow', 'packedSnow', 'oil'];

/**
 * The cover the GPU field draws for a wear cell the tyres changed, or null (the tiles
 * show it).
 * @param cell the wear cell
 * @returns the cover id, or null
 */
export function cellCoverOnGpu(cell: WearCell): string | null {
  if (cell.fixed || !cell.cover) return null;
  return GPU_COVERS.includes(cell.cover) ? cell.cover : null;
}

/**
 * Whether a wear cell's cover is the field's, untouched by the tyres (the GPU draws it; the tiles
 * show the ground under it).
 * @param cell the wear cell
 * @returns true for the field's own cover
 */
export function fieldLaysCell(cell: WearCell): boolean {
  return !cell.fixed && !!cell.laid && cell.cover === cell.laid;
}

/**
 * What a set of levels lays on a square by the one order - water, then snow or packed snow,
 * then ice; water and ice each from the lowest catch up.
 * @param levels the levels
 * @param x the square's centre x, m
 * @param y the square's centre y, m
 * @returns the cover, or null
 */
function coverOfLevels(levels: Levels, x: number, y: number): string | null {
  const waterCatch = levels.water + levels.ice > 0 ? catchAt(x, y, WATER_SEED) : 1;
  if (waterCatch < levels.water) return 'wet';
  if (levels.snow > 0 || levels.packed > 0) {
    const snowCatch = catchAt(x, y, SNOW_SEED);
    if (levels.snow > snowCatch) return 'snow';
    if (levels.packed > snowCatch) return 'packedSnow';
  }
  return waterCatch < levels.ice ? 'ice' : null;
}

/** The order of the covers in one stack: the first found wins. */
const STACK_ORDER = ['wet', 'snow', 'packedSnow', 'ice'];

/**
 * A level area's cover and the weather's on one square, by the one order.
 * @param areaCover the area's cover there, or null
 * @param weatherCover the weather's, or null
 * @returns the cover on top, or null
 */
function stackCovers(areaCover: string | null, weatherCover: string | null): string | null {
  if (!areaCover || !weatherCover) return areaCover || weatherCover;
  return STACK_ORDER.indexOf(areaCover) <= STACK_ORDER.indexOf(weatherCover) ? areaCover
    : weatherCover;
}

/**
 * What lies at a point by the field: a level area's own cover where it still reaches, else the
 * weather's - snow over packed snow over water over ice, or nothing.
 * @param x world x, m
 * @param y world y, m
 * @param area the level area the point is in, or null
 * @param ground the ground surface there (mud under its frost is ice)
 * @returns the cover, or null
 */
export function fieldCoverAt(x: number, y: number, area: AreaKind | null = null,
    ground = ''): string | null {
  const squareX = (Math.floor(x / FIELD_SQ) + 0.5) * FIELD_SQ;
  const squareY = (Math.floor(y / FIELD_SQ) + 0.5) * FIELD_SQ;
  return stackCovers(area && coverOfLevels(AREAS[area], squareX, squareY),
    coverOfLevels(FIELD, squareX, squareY)) || frostAt(squareX, squareY, ground);
}

/**
 * Ice where a mud square's frost is above its water catch, else null.
 * @param squareX the square's centre x, m
 * @param squareY the square's centre y, m
 * @param ground the ground surface id
 * @returns 'ice' or null
 */
function frostAt(squareX: number, squareY: number, ground: string): string | null {
  const kind = frostKindOf(ground);
  if (!kind || FROST[kind] <= 0) return null;
  return catchAt(squareX, squareY, WATER_SEED) < FROST[kind] ? 'ice' : null;
}

/**
 * The level area a surface makes (its own snow, ice, water or packed snow), or null.
 * @param surfaceId the surface id
 * @returns the kind
 */
export function areaKindOf(surfaceId: string): AreaKind | null {
  return (AREA_KINDS as readonly string[]).includes(surfaceId) ? surfaceId as AreaKind : null;
}

/**
 * What lies under a level area: the surface's own `under`, open snow ground's grass, else tarmac
 * (owner: a road is tarmac under its snow).
 * @param kind the area kind
 * @param under the surface's `under`, if any
 * @param isBase whether it is the level's open ground (its base surface)
 * @returns the surface id
 */
export function areaUnder(kind: AreaKind, under: string | undefined, isBase: boolean): string {
  return under || (kind === 'snow' && isBase ? UNDER_SNOW_GROUND : UNDER_DEFAULT);
}

/**
 * The surface the ground painters paint for a surface (?coverfield=1: a level area's ground is
 * what lies beneath; the field draws the area's cover over it).
 * @param surfaceId the surface id
 * @param under the surface's `under`, if any
 * @param isBase whether it is the level's open ground
 * @returns the surface id to paint
 */
export function paintAs(surfaceId: string, under?: string, isBase = false): string {
  const kind = areaKindOf(surfaceId);
  return kind ? areaUnder(kind, under, isBase) : surfaceId;
}

/**
 * The layers at a point with the field (wear.ts layersAt): scenery water as it is; a level area's
 * ground is what lies beneath, its cover by the area's levels, then the weather's.
 * @param zoneSurface the surface the zones / ribbon / base give the point
 * @param isBase whether that is the level's open ground
 * @param levelCover the level's own cover there (LEVEL.covers), or null
 * @param x world x, m
 * @param y world y, m
 * @returns the layers
 */
export function fieldLayers(zoneSurface: Surface, isBase: boolean, levelCover: Cover | null,
    x: number, y: number): Layers {
  const zoneKind = areaKindOf(zoneSurface.id);
  const base = zoneKind ? areaUnder(zoneKind, zoneSurface.under, isBase) : zoneSurface.id;
  if (levelCover && levelCover.water) {
    return { base, cover: 'wet', standing: true, fixed: true, area: null };
  }
  const area = levelCover ? areaKindOf(levelCover.cover) : zoneKind;
  const cover = fieldCoverAt(x, y, area, base);
  return { base, cover, standing: cover === 'wet', fixed: false, area };
}

/** Ice (and frozen mud) thaws per C above THAW_C, a second: slower than snow. */
const ICE_THAW_PER_S_PER_C = SNOW_MELT_PER_S_PER_C * ICE_MELT_SHARE;

/**
 * The standing water's level over a step: rain fills it only to a ceiling by how hard it rains,
 * it runs off above it, and it evaporates - in the rain too, more slowly.
 * @param water the water level
 * @param rain how hard it rains, 0..1
 * @param trackC the track temperature, C
 * @param dt sim seconds
 * @returns the new level (unclamped)
 */
function stepWater(water: number, rain: number, trackC: number, dt: number,
    isSoaked = false): number {
  const dry = Math.max(0, trackC) * WATER_DRY_PER_S_PER_C * dt;
  const isWetting = rain > 0.05 || isSoaked;
  // meltwater runs off as heavy rain's does, above heavy rain's ceiling
  const ceiling = rain > 0.05 ? RAIN_WATER_BASE + RAIN_WATER_PER_RAIN * rain
    : isSoaked ? RAIN_WATER_BASE + RAIN_WATER_PER_RAIN : 0;
  const fill = water < ceiling ? Math.min(ceiling - water, rain * WATER_FILL_PER_S * dt) : 0;
  const runoff = water > ceiling && isWetting ? Math.min(water - ceiling, RUNOFF_PER_S * dt) : 0;
  return water + fill - runoff - dry * (isWetting ? RAIN_EVAP_SHARE : 1);
}

/**
 * Whether a set of levels has a coat melting in this warmth (the ground under a
 * melting coat stays soaked).
 * @param levels the levels
 * @param trackC the track temperature, C
 * @returns true while snow, packed snow or ice is melting
 */
function isMeltingCoat(levels: Levels, trackC: number): boolean {
  return (trackC >= SNOW_SETTLE_C && (levels.snow > 0 || levels.packed > 0))
    || (trackC > THAW_C && levels.ice > 0);
}

/**
 * How much melting coat the field holds now, 0..1 (the most of the weather's and the level
 * areas'), for the track's damp.
 * @returns the share
 */
function meltingCoat(): number {
  const trackC = WEATHER.trackC;
  let most = 0;
  for (const levels of [FIELD, ...AREA_KINDS.map((kind) => AREAS[kind])]) {
    if (isMeltingCoat(levels, trackC))
      most = Math.max(most, Math.min(1, levels.snow + levels.packed + levels.ice));
  }
  return most;
}

/**
 * Moves one set of levels by the weather over a step: rain fills, a dry spell dries, snow settles
 * and melts (packed snow slower), water freezes and ice thaws.
 * @param levels the levels (changed in place)
 * @param dt sim seconds
 */
function stepLevels(levels: Levels, dt: number): void {
  const trackC = WEATHER.trackC, rain = WEATHER.rain;
  let { water, snow, ice, packed } = levels;
  water = stepWater(water, rain, trackC, dt, isMeltingCoat(levels, trackC));
  if (trackC < SNOW_SETTLE_C) {
    // the one order: snow falling on water (the water level's share) melts into it
    const fall = WEATHER.snow * SNOW_FILL_PER_S * dt;
    const onWater = Math.min(1, water);
    snow += fall * (1 - onWater);
    water += fall * onWater * SNOW_INTO_WATER;
  }
  else {
    const warmth = (trackC - SNOW_SETTLE_C) * (1 + RAIN_MELT * rain) * dt;
    const meltedSnow = Math.min(snow, warmth * SNOW_MELT_PER_S_PER_C);
    const meltedPacked = Math.min(packed, warmth * PACKED_MELT_PER_S_PER_C);
    snow -= meltedSnow;
    packed -= meltedPacked;
    water += meltedSnow + meltedPacked;
  }
  if (trackC < FREEZE_C && water > 0) {
    const frozen = Math.min(water, (FREEZE_C - trackC + 1) * FREEZE_PER_S_PER_C * dt);
    // the one order: the ice under the water reaches as far as the water did
    ice = Math.max(ice, water);
    water -= frozen;
  } else if (trackC > THAW_C && ice > 0) {
    const rainFactor = 1 + ICE_RAIN_MELT * rain;
    const thawed = Math.min(ice, (trackC - THAW_C) * ICE_THAW_PER_S_PER_C * rainFactor * dt);
    // the meltwater gathers from the lowest catch (the middle of a patch): with the one order it
    // lies on the ice there while the ice shrinks from its rim
    water += thawed;
    ice -= thawed;
  }
  const clampLevel = (level: number) => Math.max(0, Math.min(LEVEL_MAX, level));
  levels.water = clampLevel(water);
  levels.snow = clampLevel(snow);
  levels.ice = clampLevel(ice);
  levels.packed = clampLevel(packed);
}

/**
 * One sim step of the field: the weather's levels and every area's move by the weather and the
 * track temperature; the wear cells follow every SYNC_S. No event weather: nothing moves.
 * @param dt sim seconds
 */
export function stepCoverField(dt: number): void {
  if (!weatherRuns()) return;
  stepLevels(FIELD, dt);
  for (const kind of AREA_KINDS) stepLevels(AREAS[kind], dt);
  setMeltSoak(MELT_SOAK_RAIN * meltingCoat());
  stepFrost(dt);
  noteBands();
  syncS += dt;
  if (syncS >= SYNC_S) {
    syncFieldCells(syncS);
    syncS = 0;
  }
}

/**
 * Moves the mud frost: up below MUD_FREEZE_C, down above THAW_C, thick mud at THICK_FROST_RATE.
 * @param dt sim seconds
 */
function stepFrost(dt: number): void {
  const trackC = WEATHER.trackC;
  let change = 0;
  if (trackC < MUD_FREEZE_C) change = (MUD_FREEZE_C - trackC + 1) * FROST_PER_S_PER_C * dt;
  else if (trackC > THAW_C) {
    change = -(trackC - THAW_C) * ICE_THAW_PER_S_PER_C * dt;
  }
  if (change === 0) return;
  FROST.mud = Math.max(0, Math.min(LEVEL_MAX, FROST.mud + change));
  FROST.thickMud = Math.max(0, Math.min(LEVEL_MAX, FROST.thickMud + change * THICK_FROST_RATE));
}

/**
 * Counts an epoch when any level (the weather's or an area's) crosses a tenth.
 */
function noteBands(): void {
  let moved = noteLevels(FIELD, 0);
  for (let kind = 0; kind < AREA_KINDS.length; kind++) {
    if (noteLevels(AREAS[AREA_KINDS[kind]], (kind + 1) * 4)) moved = true;
  }
  const frostSlot = (AREA_KINDS.length + 1) * 4;
  if (noteBand(frostSlot, FROST.mud)) moved = true;
  if (noteBand(frostSlot + 1, FROST.thickMud)) moved = true;
  if (moved) epoch++;
}

/**
 * Notes one set of levels' tenths (no allocation: it runs every physics step).
 * @param levels the levels
 * @param first their first slot in bandsSeen
 * @returns true when one moved
 */
function noteLevels(levels: Levels, first: number): boolean {
  const water = noteBand(first, levels.water), snow = noteBand(first + 1, levels.snow);
  const ice = noteBand(first + 2, levels.ice), packed = noteBand(first + 3, levels.packed);
  return water || snow || ice || packed;
}

/**
 * Notes a level's tenth in its slot.
 * @param slot the slot in bandsSeen
 * @param level the level
 * @returns true when it moved
 */
function noteBand(slot: number, level: number): boolean {
  const band = Math.floor(level * 10);
  if (bandsSeen[slot] === band) return false;
  bandsSeen[slot] = band;
  return true;
}

/** How many times the field's levels have moved by a tenth (ai/line.ts plans again). */
export function coverEpoch(): number { return epoch; }

/**
 * One wear cell follows the field: what the field laid (and the tyres left alone) moves with it;
 * a spot the tyres cleared fills again while it rains or snows; what the tyres made of it (packed
 * snow, polished ice, meltwater) keeps its own rules (wear.ts, snowwear.ts, puddles.ts).
 * @param cell the wear cell (changed in place)
 * @param seconds sim seconds since the last sync
 * @returns true when its cover changed
 */
function followField(cell: WearCell, seconds: number): boolean {
  const want = fieldCoverAt((cell.cx + 0.5) * WEAR_CELL, (cell.cy + 0.5) * WEAR_CELL,
    cell.area ? areaKindOf(cell.area) : null, cell.base);
  if (cell.cover === want) return false;
  const untouched = cell.cover === (cell.laid ?? null);
  const falling = want === 'snow' ? WEATHER.snow : WEATHER.rain;
  const refills = !cell.cover && !!want && weatherRandom() < falling * REFILL_PER_S * seconds;
  if (!untouched && !refills) return false;
  cell.cover = want;
  cell.laid = want;
  cell.standing = true;
  cell.dry = 0;
  cell.passes = 0;
  cell.scrub = 0;
  return true;
}

/**
 * The wear cells follow the field (a pass a SYNC_S): cells changed repaint one at a time.
 * @param seconds sim seconds since the last sync
 */
function syncFieldCells(seconds: number): void {
  for (const cell of wearMap.values()) {
    if (cell.fixed || cell.frozeMud || !followField(cell, seconds)) continue;
    const now = cell.cover || cell.base;
    if (now === cell.current) continue;
    cell.current = now;
    wearDirty.push(cell);
  }
}

fillAreas();

/** Fills every level area to the top (the level as it was built). */
function fillAreas(): void {
  for (const kind of AREA_KINDS) Object.assign(AREAS[kind], emptyLevels());
  AREAS.wet.water = LEVEL_MAX;
  AREAS.snow.snow = LEVEL_MAX;
  AREAS.ice.ice = LEVEL_MAX;
  AREAS.packedSnow.packed = LEVEL_MAX;
}

/**
 * An event's start: the level's own areas full; the weather's levels already settled (owner) -
 * water while it rains or the track is drying, snow lying on a cold start (cold: the water
 * frozen). Dealt from the weather's seeded stream, so a restart starts the same.
 */
export function resetCoverField(): void {
  syncS = 0;
  fillAreas();
  Object.assign(FIELD, emptyLevels());
  FROST.mud = FROST.thickMud = 0;
  if (!weatherRuns()) return;
  if (WEATHER.trackC < MUD_FREEZE_C) {
    FROST.mud = Math.min(LEVEL_MAX, (MUD_FREEZE_C - WEATHER.trackC) * START_FROST_PER_C);
    FROST.thickMud = FROST.mud * THICK_FROST_RATE;
  }
  const deal = (range: number[]) => range[0] + (range[1] - range[0]) * weatherRandom();
  if (WEATHER.rain > 0) FIELD.water = deal(START_RAIN);
  else if (WEATHER.wetness > 0.1) FIELD.water = WEATHER.wetness * START_DRYING;
  const cold = WEATHER.trackC < SNOW_SETTLE_C;
  const isLying = cold && (WEATHER.snow > 0 || weatherRandom() < SNOW_LYING);
  if (cold && weatherSnowy()) FIELD.snow = deal(SNOWY_START_SNOW);
  else if (isLying) FIELD.snow = deal(START_SNOW);
  if (WEATHER.trackC < FREEZE_C) {
    FIELD.ice = FIELD.water;
    FIELD.water = 0;
  }
}
