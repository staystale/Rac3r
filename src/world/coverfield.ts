// coverfield.ts - THE COVER FIELD (?coverfield=1; owner, 2026-10-18: rain and snow build in small
// patches that grow and join until they coat the race surface if it goes on long enough; heat
// dries and melts them back; everything by the weather and the temperature, on every level, the
// endless highway too; wet and snowy races start with some already settled).
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
import { WEATHER, weatherRandom, weatherRuns } from "./weather.ts";
import { wearMap, wearDirty, WEAR_CELL } from "./wear.ts";
import type { Cover, Layers, Surface, WearCell } from "./types.ts";

// LEVEL per second at rain 1 / snow 1 (owner: heavy coats the track in ~10 min, light in ~25;
// the first patches within a minute)
const WATER_FILL_PER_S = 1 / 600, SNOW_FILL_PER_S = 1 / 420;
// a dry spell takes water down per C of track (20 C: a full level in ~13 min)
const WATER_DRY_PER_S_PER_C = 1 / (780 * 20);
// snow settles below SNOW_SETTLE_C and melts above it per C (15 C: a full coat in ~10 min, 43 C
// ~3 min), packed snow slower, both faster in rain; MELT_WATER of what melts is left as water
const SNOW_SETTLE_C = 1, SNOW_MELT_PER_S_PER_C = 1 / 7000, PACKED_MELT_PER_S_PER_C = 1 / 14000;
const RAIN_MELT = 2, MELT_WATER = 0.6;
// water freezes below FREEZE_C (per C colder), ice thaws above THAW_C (per C warmer)
const FREEZE_C = 0, FREEZE_PER_S_PER_C = 1 / 60, THAW_C = 1, THAW_PER_S_PER_C = 1 / 120;
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
// lying - each a range, dealt from the weather's seeded stream
const START_RAIN = [0.15, 0.5], START_DRYING = 0.35, START_SNOW = [0.2, 0.7], SNOW_LYING = 0.6;
// what lies under an area with no `under` of its own: open snow ground's grass, else tarmac
const UNDER_SNOW_GROUND = 'grass', UNDER_DEFAULT = 'tarmac';

/** How far up the catch water, snow, ice and packed snow reach, 0..LEVEL_MAX. */
export interface Levels { water: number; snow: number; ice: number; packed: number }

/** The kinds of level area, in the order of their mask codes (render/glfield.ts) from 1. */
export const AREA_KINDS = ['wet', 'snow', 'ice', 'packedSnow'] as const;
export type AreaKind = typeof AREA_KINDS[number];

const emptyLevels = (): Levels => ({ water: 0, snow: 0, ice: 0, packed: 0 });

/** The weather's levels over the whole world. */
export const FIELD: Levels = emptyLevels();

/** Each kind of level area's own levels. */
export const AREAS: Record<AreaKind, Levels> = {
  wet: emptyLevels(), snow: emptyLevels(), ice: emptyLevels(), packedSnow: emptyLevels(),
};

let enabled = false, syncS = 0, epoch = 0;
// the AI plans its speeds again when a level crosses a tenth (ai/line.ts): the bands last seen
const bandsSeen = new Int16Array((AREA_KINDS.length + 1) * 4);

/**
 * Turns the cover field on (?coverfield=1, at start-up): the weather's water and snow lie by it
 * instead of the puddle sites, and the level's own covers are areas of it.
 * @param isOn true for the field
 */
export function setCoverField(isOn: boolean): void {
  enabled = isOn;
  fillAreas();
}

/** Whether the weather's water and snow lie by the field. */
export function coverFieldOn(): boolean { return enabled; }

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
  return !!cell.fixed || cell.cover !== (cell.laid ?? null);
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
 * What a set of levels lays on a square with these catches: snow, packed snow, water or ice.
 * @param levels the levels
 * @param x the square's centre x, m
 * @param y the square's centre y, m
 * @returns the cover, or null
 */
function coverOfLevels(levels: Levels, x: number, y: number): string | null {
  if (levels.snow > 0 || levels.packed > 0) {
    const snowCatch = catchAt(x, y, SNOW_SEED);
    if (levels.snow > snowCatch) return 'snow';
    if (levels.packed > snowCatch) return 'packedSnow';
  }
  if (levels.water + levels.ice <= 0) return null;
  const waterCatch = catchAt(x, y, WATER_SEED);
  if (waterCatch < levels.water) return 'wet';
  return waterCatch < levels.water + levels.ice ? 'ice' : null;
}

/**
 * What lies at a point by the field: a level area's own cover where it still reaches, else the
 * weather's - snow over packed snow over water over ice, or nothing.
 * @param x world x, m
 * @param y world y, m
 * @param area the level area the point is in, or null
 * @returns the cover, or null
 */
export function fieldCoverAt(x: number, y: number, area: AreaKind | null = null): string | null {
  if (!enabled) return null;
  const squareX = (Math.floor(x / FIELD_SQ) + 0.5) * FIELD_SQ;
  const squareY = (Math.floor(y / FIELD_SQ) + 0.5) * FIELD_SQ;
  return (area && coverOfLevels(AREAS[area], squareX, squareY))
    || coverOfLevels(FIELD, squareX, squareY);
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
  const kind = enabled ? areaKindOf(surfaceId) : null;
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
  const cover = fieldCoverAt(x, y, area);
  return { base, cover, standing: cover === 'wet', fixed: false, area };
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
  water += rain * WATER_FILL_PER_S * dt;
  if (rain < 0.05) water -= Math.max(0, trackC) * WATER_DRY_PER_S_PER_C * dt;
  if (trackC < SNOW_SETTLE_C) snow += WEATHER.snow * SNOW_FILL_PER_S * dt;
  else {
    const warmth = (trackC - SNOW_SETTLE_C) * (1 + RAIN_MELT * rain) * dt;
    const meltedSnow = Math.min(snow, warmth * SNOW_MELT_PER_S_PER_C);
    const meltedPacked = Math.min(packed, warmth * PACKED_MELT_PER_S_PER_C);
    snow -= meltedSnow;
    packed -= meltedPacked;
    water += (meltedSnow + meltedPacked) * MELT_WATER;
  }
  if (trackC < FREEZE_C && water > 0) {
    const frozen = Math.min(water, (FREEZE_C - trackC + 1) * FREEZE_PER_S_PER_C * dt);
    water -= frozen;
    ice += frozen;
  } else if (trackC > THAW_C && ice > 0) {
    const thawed = Math.min(ice, (trackC - THAW_C) * THAW_PER_S_PER_C * dt);
    ice -= thawed;
    water += thawed;
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
  if (!enabled || !weatherRuns()) return;
  stepLevels(FIELD, dt);
  for (const kind of AREA_KINDS) stepLevels(AREAS[kind], dt);
  noteBands();
  syncS += dt;
  if (syncS >= SYNC_S) {
    syncFieldCells(syncS);
    syncS = 0;
  }
}

/**
 * Counts an epoch when any level (the weather's or an area's) crosses a tenth.
 */
function noteBands(): void {
  let moved = noteLevels(FIELD, 0);
  for (let kind = 0; kind < AREA_KINDS.length; kind++) {
    if (noteLevels(AREAS[AREA_KINDS[kind]], (kind + 1) * 4)) moved = true;
  }
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
    cell.area ? areaKindOf(cell.area) : null);
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
  if (!enabled || !weatherRuns()) return;
  const deal = (range: number[]) => range[0] + (range[1] - range[0]) * weatherRandom();
  if (WEATHER.rain > 0) FIELD.water = deal(START_RAIN);
  else if (WEATHER.wetness > 0.1) FIELD.water = WEATHER.wetness * START_DRYING;
  const cold = WEATHER.trackC < SNOW_SETTLE_C;
  if (cold && (WEATHER.snow > 0 || weatherRandom() < SNOW_LYING)) FIELD.snow = deal(START_SNOW);
  if (WEATHER.trackC < FREEZE_C) {
    FIELD.ice = FIELD.water;
    FIELD.water = 0;
  }
}
