// COLD COVERS AND WET CELLS. The weather's water, snow and ice, and the
// level's own snow / ice / water areas, lie by the cover field (coverfield.ts: one system). Here:
// - SCENERY water (Cover.water: rivers, lakes, fords - permanent) freezes over when it is properly
//   cold and thaws back (owner);
// - the WINTER rules of what the TYRES made in a wear cell: their snow, packed snow and ice melt to
//   water above freezing (faster per C and in rain), their water freezes to black ice below it and
//   dries off in a warm dry spell;
// - TYRES clear standing water in 3 passes, rain tyres in 1 (owner);
// - worn MUD dries back toward dirt in a dry spell (owner); all mud freezes by the cover field's
//   frost (coverfield.ts), not here.
// Every change rides a pass over the wear cells a tick (TICK_S), by chance, so the ground
// repaints a few squares a tick, never a burst. An event's start deals whether the scenery water
// is frozen from the event's seeded stream (weather.ts weatherRandom), so a restart deals the same.
// (The puddle SITES that made the weather's water before the cover field, and the level patches'
// own melting, were removed 2026-10-18: the field does both.)
import { LEVEL } from "./state.ts";
import {
  ICE_MELT_SHARE, WEATHER, weatherRandom, weatherRuns,
} from "./weather.ts";
import { hotTyreShare } from "../physics/tyrecool.ts";
import { wearMap, wearDirty, WEAR_CELL, layersAt, wearKey } from "./wear.ts";
import type { Cover, Layers, Level, WearCell } from "./types.ts";

/** An area of ground, m. */
type Area = { x0: number; y0: number; x1: number; y1: number };

// the tyres' water in a cell dries a second per C of track temperature in a dry spell (20 C:
// ~13 min); it FREEZES below FREEZE_BELOW_C and frozen things THAW above THAW_ABOVE_C
const DRAIN_PER_S_PER_C = 1 / (900 * 20), FREEZE_BELOW_C = 0, THAW_ABOVE_C = 1;
// SCENERY water freezes over below this (a chance a second; at the start: likelier the colder)
// and thaws above THAW_ABOVE_C (mud freezes by the cover field's frost, coverfield.ts); the
// tyres' water freezes and their snow / ice melt below / above these
const WATER_FREEZE_BELOW_C = -2, WATER_FREEZE_PER_S = 1 / 240, MUD_FREEZE_BELOW_C = -1;
// MELTING BY TEMPERATURE (owner: snow and ice melt in anything but the cold, faster when hot):
// above THAW_ABOVE_C a chance a second per C
const CELL_SNOW_MELT_PER_S_PER_C = 1 / 1500;
// tyre-made and scenery ice per C, a second: ICE_MELT_SHARE of snow's
const ICE_MELT_PER_S_PER_C = CELL_SNOW_MELT_PER_S_PER_C * ICE_MELT_SHARE;
// RAIN melts snow faster (x 1 + RAIN_MELT at rain 1); the tyres' water in a cell FREEZES to ice
// below freezing (per C colder, a chance a second: black ice)
const RAIN_MELT = 2, CELL_WATER_FREEZE_PER_S_PER_C = 1 / 120;
// rain melts ice too, less than snow (x 1 + ICE_RAIN_MELT at rain 1)
const ICE_RAIN_MELT = 1;
// s between ticks (the ground repaints at most this often)
const TICK_S = 1;
// MUD DRYING: a s per C of track temperature to dry one step (mud -> dirt, thick mud -> mud; 20 C:
// ~4 min), only in a dry spell and above MUD_DRY_FROM_C
const MUD_DRY_PER_S_PER_C = 1 / (240 * 20), MUD_DRY_FROM_C = 5, DRY_SPELL_WETNESS = 0.15;
const MUD_DRIES_TO: Record<string, string> = { mud: 'dirt', thickMud: 'mud' };
// a tyre's WET grip from which it is a rain tyre (cars.ts: KUM Wet 1.22, PIRRELLY Full Wet 1.35)
const RAIN_TYRE_WET = 1.2;

/** How much faster snow (or ice) melts in this rain. */
const rainMelt = (ice = false) => 1 + (ice ? ICE_RAIN_MELT : RAIN_MELT) * WEATHER.rain;

let rainTyre = false;
let tickS = 0;

/** Areas of ground whose look changed (scenery water froze / thawed): render/tilesWear repaints. */
export const groundDirtyAreas: Area[] = [];

/**
 * The tyre of the car whose wheels are being passed over the ground (wear.ts stepWear).
 * @param tyre the fitted tyre, or null (Pre-Spun)
 */
export function setPassTyre(tyre: { grip: Record<string, number> } | null | undefined): void {
  rainTyre = !!tyre && (tyre.grip.wet ?? 1) >= RAIN_TYRE_WET;
}

/**
 * How much one tyre pass clears of a cell's standing water (owner: 3 passes, rain tyres 1), or
 * null to keep the old rule (no weather, or damp ground).
 * @param standing whether the water is standing (a puddle)
 * @param tyreC the tyre's temperature, C (hot tyres clear faster)
 * @returns the dryness the pass adds, or null
 */
export function puddleClearBy(standing: boolean, tyreC = 0): number | null {
  if (!standing) return null;
  // a hot tyre clears it in 2 passes, not 3
  return rainTyre ? 1 : 1 / 3 + (1 / 2 - 1 / 3) * hotTyreShare(tyreC);
}

/**
 * The level's own covers with its puddles left out when the weather makes them (scenery water and
 * the Lab's test features stay).
 * @param level the level
 * @param covers its hand-placed and blended covers
 * @returns the covers to keep
 */
export function staticCovers(level: Level, covers: Cover[]): Cover[] {
  if (level.endless || !level.subtrack) return covers;
  return covers.filter((cover) => cover.cover !== 'wet' || cover.water);
}

/** The ground a cover can cover, as a dirty area. */
function areaOf(shape: { x: number; y: number; w: number; h: number }): Area {
  const reach = Math.max(shape.w, shape.h) / 2 + 1;
  return { x0: shape.x - reach, y0: shape.y - reach, x1: shape.x + reach, y1: shape.y + reach };
}

/**
 * Whether a wear cell takes the cover over it now: water or ice the scenery laid follows it
 * (frozen, thawed); bare ground takes new ice; frozen mud keeps its own ice.
 * @param cell the wear cell
 * @param want the cover over it now, or null
 * @returns true to take it
 */
function followsCovers(cell: WearCell, want: string | null): boolean {
  const lying = cell.cover;
  if (!lying) return !!want && (want !== 'wet' || WEATHER.rain > 0);
  const weatherLaid = lying === 'wet' || lying === 'snow' || lying === 'ice';
  return cell.standing && !cell.frozeMud && weatherLaid && want !== lying;
}

/**
 * One wear cell follows the covers over it now (resyncCells).
 * @param cell the wear cell (changed in place)
 * @param layers the static layers at its centre, with the new covers
 */
function resyncCell(cell: WearCell, layers: Layers): void {
  const want = layers.cover, was = cell.cover || cell.base;
  if (followsCovers(cell, want)) {
    cell.cover = want || null;
    cell.standing = true;
    cell.dry = 0;
    cell.passes = 0;
    cell.scrub = 0;
  }
  cell.orig = want || layers.base;
  const now = cell.cover || cell.base;
  if (now !== was) {
    cell.current = now;
    wearDirty.push(cell);
  }
}

/**
 * The wear cells in an area follow its covers' new looks, so physics and the drawn ground agree.
 * @param area the area
 */
function resyncCells(area: Area): void {
  for (let cellI = Math.floor(area.x0 / WEAR_CELL); cellI <= area.x1 / WEAR_CELL; cellI++) {
    for (let cellJ = Math.floor(area.y0 / WEAR_CELL); cellJ <= area.y1 / WEAR_CELL; cellJ++) {
      const cell = wearMap.get(wearKey(cellI, cellJ));
      if (cell) resyncCell(cell, layersAt((cellI + 0.5) * WEAR_CELL, (cellJ + 0.5) * WEAR_CELL));
    }
  }
}

/**
 * Puts the scenery water's looks (frozen or not) into the level's covers; the ground over changed
 * covers repaints, the AI reads the grip again.
 * @param changed the covers whose look changed
 */
function applyLooks(changed: Cover[]): void {
  LEVEL.covers = (LEVEL._staticCovers || []).map(staticLook);
  for (const shape of changed) {
    const area = areaOf(shape);
    groundDirtyAreas.push(area);
    resyncCells(area);
  }
  // the AI's speed plan reads the ground's grip again (line.ts regripPath)
  if (changed.length) WEATHER.epoch++;
}

/** What a level cover shows now: itself, or (scenery water) frozen over. */
function staticLook(cover: Cover): Cover {
  return cover._frozen ? iceTwin(cover) : cover;
}

/** Scenery water as ice: the same shape (cached on the water cover). */
function iceTwin(cover: Cover): Cover {
  if (!cover._iceTwin) {
    cover._iceTwin = { x: cover.x, y: cover.y, w: cover.w, h: cover.h, cover: 'ice',
      shape: cover.shape, rot: cover.rot, cut: cover.cut };
  }
  return cover._iceTwin;
}

/** Freezes or thaws scenery water over a tick (a chance a second, seeded); returns the changed. */
function stepSceneryWater(seconds: number): Cover[] {
  const trackC = WEATHER.trackC, changed: Cover[] = [];
  if (trackC >= WATER_FREEZE_BELOW_C && trackC <= THAW_ABOVE_C) return changed;
  for (const cover of LEVEL._staticCovers || []) {
    if (!cover.water) continue;
    const freeze = !cover._frozen && trackC < WATER_FREEZE_BELOW_C
      && weatherRandom() < WATER_FREEZE_PER_S * seconds;
    const thaw = cover._frozen && trackC > THAW_ABOVE_C
      && weatherRandom() < ICE_MELT_PER_S_PER_C * (trackC - THAW_ABOVE_C) * seconds;
    if (freeze || thaw) {
      cover._frozen = !cover._frozen;
      changed.push(cover);
    }
  }
  return changed;
}

/**
 * Whether a cell's water is the tyres' own (meltwater, scrubbed ice), not water the level or the
 * weather laid.
 * @param cell the wear cell
 * @returns true for the tyres' water
 */
const tyresWater = (cell: WearCell) => cell.cover === 'wet' && cell.orig !== 'wet';

/**
 * Melts the snow or ice the tyres made in a cell to water, by chance (above freezing).
 * @param cell the wear cell (changed in place)
 * @param trackC the track temperature
 * @param seconds sim seconds since the last tick
 * @returns true when it melted
 */
function meltCell(cell: WearCell, trackC: number, seconds: number): boolean {
  const kind = cell.cover;
  const frozen = kind === 'snow' || kind === 'ice' || kind === 'packedSnow';
  // what the level or the weather lays here now follows its own rules (the cover field)
  if (!frozen || cell.frozeMud) return false;
  const laid = layersAt((cell.cx + 0.5) * WEAR_CELL, (cell.cy + 0.5) * WEAR_CELL).cover;
  if (laid === kind) return false;
  const perC = kind === 'ice' ? ICE_MELT_PER_S_PER_C : CELL_SNOW_MELT_PER_S_PER_C;
  if (weatherRandom() >= perC * (trackC - THAW_ABOVE_C) * rainMelt(kind === 'ice') * seconds) {
    return false;
  }
  cell.cover = 'wet';
  cell.standing = true;
  cell.dry = 0;
  cell.scrub = 0;
  cell.passes = 0;
  cell.current = 'wet';
  wearDirty.push(cell);
  return true;
}

/**
 * Freezes the tyres' water in a cell to ice below freezing, by chance: black ice.
 * @param cell the wear cell (changed in place)
 * @param trackC the track temperature
 * @param seconds sim seconds since the last tick
 * @returns true when it froze
 */
function freezeCellWater(cell: WearCell, trackC: number, seconds: number): boolean {
  if (!tyresWater(cell)) return false;
  const chance = (FREEZE_BELOW_C - trackC) * CELL_WATER_FREEZE_PER_S_PER_C * seconds;
  if (weatherRandom() >= chance) return false;
  cell.cover = 'ice';
  cell.scrub = 0;
  cell.current = 'ice';
  wearDirty.push(cell);
  return true;
}

/**
 * Dries the tyres' water in a cell off in a dry spell, by chance.
 * @param cell the wear cell (changed in place)
 * @param trackC the track temperature
 * @param seconds sim seconds since the last tick
 * @returns true when it dried
 */
function dryCellWater(cell: WearCell, trackC: number, seconds: number): boolean {
  if (!tyresWater(cell) || weatherRandom() >= trackC * DRAIN_PER_S_PER_C * seconds) return false;
  cell.cover = null;
  cell.dry = 0;
  cell.current = cell.base;
  wearDirty.push(cell);
  return true;
}

/** Dries worn mud back toward dirt in a dry spell (owner), a tick at a time. */
function dryMud(seconds: number): void {
  const trackC = WEATHER.trackC;
  if (WEATHER.wetness > DRY_SPELL_WETNESS || WEATHER.rain > 0 || trackC < MUD_DRY_FROM_C) return;
  const melt = weatherRuns();
  for (const cell of wearMap.values()) {
    if (melt && dryCellWater(cell, trackC, seconds)) continue;
    const next = MUD_DRIES_TO[cell.base];
    if (!next || cell.cover) continue;
    cell.mudDry = (cell.mudDry || 0) + trackC * MUD_DRY_PER_S_PER_C * seconds;
    if (cell.mudDry < 1) continue;
    cell.mudDry = 0;
    cell.base = next;
    cell.current = next;
    wearDirty.push(cell);
  }
}

/** Freezes worn mud over in the cold (an ice cover a slide scrubs through), thaws it back. */
function freezeMud(seconds: number): void {
  const trackC = WEATHER.trackC;
  const freezing = trackC < MUD_FREEZE_BELOW_C, thawing = trackC > THAW_ABOVE_C;
  if (!freezing && !thawing) return;
  if (!weatherRuns()) return;
  for (const cell of wearMap.values()) {
    // the tyres' snow / ice melts above freezing, their water freezes below
    if (thawing) meltCell(cell, trackC, seconds);
    else freezeCellWater(cell, trackC, seconds);
  }
}

/**
 * One sim step (every TICK_S the cold covers and wet cells move): scenery water freezes / thaws,
 * the tyres' snow / ice / water melt, freeze and dry, mud dries.
 * @param dt sim seconds
 */
export function stepPuddles(dt: number): void {
  tickS += dt;
  if (tickS < TICK_S) return;
  const seconds = tickS;
  tickS = 0;
  const frozen = stepSceneryWater(seconds);
  if (frozen.length) applyLooks(frozen);
  dryMud(seconds);
  freezeMud(seconds);
}

/**
 * Starts an event (wear.ts has just been cleared): whether the scenery water is frozen over, dealt
 * from the event's seeded stream (likelier the colder). The race behind the menu (no weather) is
 * not frozen.
 */
export function resetPuddles(): void {
  tickS = 0;
  const trackC = WEATHER.trackC;
  const water = (LEVEL._staticCovers || []).filter((cover) => cover.water);
  for (const cover of water) {
    const chance = trackC <= -5 ? 0.85 : trackC <= WATER_FREEZE_BELOW_C ? 0.5 : 0;
    cover._frozen = chance > 0 && weatherRandom() < chance;
  }
  applyLooks(water);
}
