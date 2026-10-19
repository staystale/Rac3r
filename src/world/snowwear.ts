// PACKED SNOW WEARS (owner: packed snow should have a chance to degrade into snow or ice). After
// PACKED_SNOW_WEAR
// passes a bare packed-snow wear cell takes a cover of loose SNOW (churned up) or ICE
// (polished), even odds; wet, it churns to snow, never ice (the owner's wet table: wet snow turns
// to slush). The packed base stays under the cover, and the existing rules take it from there
// (wear.ts): the snow packs again (passSnowCell), the ice scrubs through to meltwater
// (scrubCell), the water clears, and the base wears again.
//
// WINTER LOGIC (owner: "snow driven over should have
// a chance of becoming packed snow; packed snow a higher chance of becoming ice when degraded or
// cold, and a small chance to degrade and just leave water on whatever surface is below -
// complete logical interactions"). By the temperature snow feels (weather.ts snowTempC):
//   loose SNOW, after SNOW_TO_ICE passes -> mostly PACKED SNOW (a cover over its ground); ICE more
//     often the colder; WATER more often the warmer (wet snow: water, as before).
//   PACKED SNOW (a cover, or a snow road), after PACKED_SNOW_WEAR passes -> mostly ICE, more so
//     the colder; else churned back to loose SNOW; a small chance, bigger when warm, it breaks
//     through to WATER on the ground under it (a snow road's bed is GRAVEL). Wet: water or snow.
// Ice scrubbing, melting, freezing water and drying are in wear.ts / puddles.ts.
import type { WearCell } from "./types.ts";
import { snowTempC } from "./weather.ts";
import { hotTyreShare } from "../physics/tyrecool.ts";

// passes before packed snow breaks up
const PACKED_SNOW_WEAR = 4;
// WINTER: loose snow's outcome at 0 C (water, ice; the rest packs) and the change per C
const SNOW_WATER_AT_0 = 0.15, SNOW_WATER_PER_C = 0.1, SNOW_ICE_AT_0 = 0.15, SNOW_ICE_PER_C = 0.03;
// packed snow's breakthrough to water at 0 C and per C warmer; its share of ice at 0 C and per C
// colder (of what does not break through)
const PACKED_WATER_AT_0 = 0.05, PACKED_WATER_PER_C = 0.08;
const PACKED_ICE_AT_0 = 0.55, PACKED_ICE_PER_C = 0.03;
// DRIVEN ICE (owner: every cold top surface has a chance to break to water, more
// the warmer): after ICE_WEAR passes, water by ICE_WATER_AT_0 at 0 C and ICE_WATER_PER_C a C
// warmer (less when colder), wet ice ICE_WATER_WET more
const ICE_WEAR = 4, ICE_WATER_AT_0 = 0.1, ICE_WATER_PER_C = 0.08, ICE_WATER_WET = 0.2;
// a hot tyre (tyreheat.ts hotTyreShare 1) adds ICE_WATER_HOT to that chance
const ICE_WATER_HOT = 0.15;
// what is under a snow road when packed snow breaks through
const SNOW_ROAD_BED = 'gravel';

/** Whether a cell's packed snow (its cover, else its bare base) wears. */
export function packedSnowWears(surfaceId: string): boolean {
  return surfaceId === 'packedSnow';
}

/** A share kept between low and high. */
const clampShare = (share: number, low: number, high: number) =>
  Math.max(low, Math.min(high, share));

/**
 * Lays standing water on a cell (snow or packed snow broken through, or melted).
 * @param cell the wear cell (changed in place)
 */
function toWater(cell: WearCell): void {
  if (cell.cover === null && cell.base === 'packedSnow') cell.base = SNOW_ROAD_BED;
  cell.cover = 'wet';
  cell.standing = true;
  cell.dry = 0;
}

/**
 * One pass over a loose SNOW cover: after SNOW_TO_ICE passes it packs, ices or melts by the
 * temperature.
 * @param cell the wear cell (changed in place)
 * @param wet whether the cell is wet enough to wear as wet ground (then water)
 * @param snowToIce the passes snow takes (wear.ts SNOW_TO_ICE)
 */
export function passWinterSnow(cell: WearCell, wet: boolean, snowToIce: number): void {
  if (++cell.passes < snowToIce) return;
  cell.passes = 0;
  const tempC = snowTempC(), roll = Math.random();
  const water = clampShare(SNOW_WATER_AT_0 + SNOW_WATER_PER_C * tempC, 0.05, 0.9);
  const ice = clampShare(SNOW_ICE_AT_0 - SNOW_ICE_PER_C * tempC, 0, 0.45);
  if (wet || roll < water) toWater(cell);
  else cell.cover = roll < water + ice ? 'ice' : 'packedSnow';
}

/**
 * One pass over an ICE cover: after ICE_WEAR passes, a chance it breaks to water
 * by the temperature (slides scrub it through too: wear.ts scrubCell).
 * @param cell the wear cell (changed in place)
 * @param wet whether the cell is wet enough to wear as wet ground
 * @param tyreC the tyre's temperature, C (hot tyres break it more often)
 */
export function passIceCell(cell: WearCell, wet: boolean, tyreC = 0): void {
  if (++cell.passes < ICE_WEAR) return;
  cell.passes = 0;
  const water = clampShare(ICE_WATER_AT_0 + ICE_WATER_PER_C * snowTempC()
    + (wet ? ICE_WATER_WET : 0) + ICE_WATER_HOT * hotTyreShare(tyreC), 0.02, 0.9);
  if (Math.random() >= water) return;
  toWater(cell);
  cell.scrub = 0;
}

/**
 * One pass over packed snow (a cover, or a bare snow road): after PACKED_SNOW_WEAR passes it
 * breaks up - ice more often the colder, else loose snow (wet: snow); a small chance it breaks
 * through to water.
 * @param cell the wear cell (changed in place)
 * @param wet whether the cell is wet enough to wear as wet ground
 */
export function passPackedSnowCell(cell: WearCell, wet: boolean): void {
  if (++cell.passes < PACKED_SNOW_WEAR) return;
  cell.passes = 0;
  cell.scrub = 0;
  const tempC = snowTempC();
  const water = clampShare(PACKED_WATER_AT_0 + PACKED_WATER_PER_C * tempC, 0.03, 0.8);
  if (Math.random() < water) { toWater(cell); return; }
  const ice = wet ? 0 : clampShare(PACKED_ICE_AT_0 - PACKED_ICE_PER_C * tempC, 0.4, 0.85);
  cell.cover = Math.random() < ice ? 'ice' : 'snow';
}
