// coverfield.ts - THE COVER FIELD (?coverfield=1; owner, 2026-10-18: rain and snow build in small
// patches that grow and join until they coat the race surface if it goes on long enough; heat
// dries and melts them back; everything by the weather and the temperature, on every level, the
// endless highway too; wet and snowy races start with some already settled).
//
// How: every point of the world has a CATCH, 0..1 - smooth value noise in world space (the water
// and the snow each their own), so neighbouring points catch alike and patches have shape. The
// weather moves three LEVELS: water, snow and ice. A point is covered where the level is above
// its catch: the lowest-catching points first (small scattered patches), then more and more until
// at level 1 everything is covered; drying and melting take the level down again, so patches
// shrink and break up the same way. Nothing is stored per point, so a new piece of the endless
// road is covered as the rest of the world at once. Water freezes from its shallow edge: with
// water w and ice i, a point with catch < w holds water, w..w+i ice. Snow lies over both.
// Tyres change single cells (wear.ts): those follow their own rules and the field again when the
// weather moves (syncFieldCells).
import { WEATHER, weatherRandom, weatherRuns } from "./weather.ts";
import { wearMap, wearDirty, WEAR_CELL } from "./wear.ts";
import type { CoverId, WearCell } from "./types.ts";

// LEVEL per second at rain 1 / snow 1 (owner: heavy coats the track in ~10 min, light in ~25;
// the first patches within a minute)
const WATER_FILL_PER_S = 1 / 600, SNOW_FILL_PER_S = 1 / 420;
// a dry spell takes water down per C of track (20 C: a full level in ~13 min)
const WATER_DRY_PER_S_PER_C = 1 / (780 * 20);
// snow settles below SNOW_SETTLE_C and melts above it per C (15 C: a full coat in ~10 min, 43 C
// ~3 min), faster in rain; MELT_WATER of what melts is left as water
const SNOW_SETTLE_C = 1, SNOW_MELT_PER_S_PER_C = 1 / 7000, RAIN_MELT = 2, MELT_WATER = 0.6;
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

/** The weather's levels: how far up the catch water, snow and ice reach, 0..LEVEL_MAX. */
export const FIELD = { water: 0, snow: 0, ice: 0 };

let enabled = false, syncS = 0;

/**
 * Turns the cover field on (?coverfield=1, at start-up): the weather's water and snow lie by it
 * instead of the puddle sites.
 * @param isOn true for the field
 */
export function setCoverField(isOn: boolean): void { enabled = isOn; }

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
 * What the weather lays at a point by the field: snow over ice over water, or nothing.
 * @param x world x, m
 * @param y world y, m
 * @returns the cover, or null
 */
export function fieldCoverAt(x: number, y: number): CoverId | null {
  if (!enabled) return null;
  const { water, snow, ice } = FIELD;
  if (snow <= 0 && water + ice <= 0) return null;
  const squareX = (Math.floor(x / FIELD_SQ) + 0.5) * FIELD_SQ;
  const squareY = (Math.floor(y / FIELD_SQ) + 0.5) * FIELD_SQ;
  if (snow > 0 && snow > catchAt(squareX, squareY, SNOW_SEED)) return 'snow';
  if (water + ice <= 0) return null;
  const waterCatch = catchAt(squareX, squareY, WATER_SEED);
  if (waterCatch < water) return 'wet';
  return waterCatch < water + ice ? 'ice' : null;
}

/**
 * One sim step of the field: rain fills, a dry spell dries, snow settles and melts, water freezes
 * and thaws - all by the weather and the track temperature. No event weather: nothing moves.
 * @param dt sim seconds
 */
export function stepCoverField(dt: number): void {
  if (!enabled || !weatherRuns()) return;
  const trackC = WEATHER.trackC, rain = WEATHER.rain;
  let { water, snow, ice } = FIELD;
  water += rain * WATER_FILL_PER_S * dt;
  if (rain < 0.05) water -= Math.max(0, trackC) * WATER_DRY_PER_S_PER_C * dt;
  if (trackC < SNOW_SETTLE_C) snow += WEATHER.snow * SNOW_FILL_PER_S * dt;
  else if (snow > 0) {
    const melted = Math.min(snow,
      (trackC - SNOW_SETTLE_C) * SNOW_MELT_PER_S_PER_C * (1 + RAIN_MELT * rain) * dt);
    snow -= melted;
    water += melted * MELT_WATER;
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
  FIELD.water = clampLevel(water);
  FIELD.snow = clampLevel(snow);
  FIELD.ice = clampLevel(ice);
  syncS += dt;
  if (syncS >= SYNC_S) {
    syncFieldCells(syncS);
    syncS = 0;
  }
}

/**
 * One wear cell follows the field: what the field laid (and the tyres left alone) moves with it;
 * a spot the tyres cleared fills again while it rains or snows; what the tyres made of it (packed
 * snow, polished ice, meltwater) keeps its own rules (wear.ts, snowwear.ts, puddles.ts).
 * @param cell the wear cell (changed in place)
 * @param seconds sim seconds since the last sync
 * @returns true when its cover changed
 */
function followField(cell: WearCell, seconds: number): boolean {
  const want = fieldCoverAt((cell.cx + 0.5) * WEAR_CELL, (cell.cy + 0.5) * WEAR_CELL);
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

/**
 * An event's start: the levels already settled by the weather (owner) - water while it rains or
 * the track is drying, snow lying on a cold start (cold: the water frozen). Dealt from the
 * weather's seeded stream, so a restart starts the same.
 */
export function resetCoverField(): void {
  syncS = 0;
  FIELD.water = 0;
  FIELD.snow = 0;
  FIELD.ice = 0;
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
