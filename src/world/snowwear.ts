// PACKED SNOW WEARS (the default since 2026-10-18, owner: "yes all"; ?packedwear=0 off; owner:
// packed snow should have a chance to degrade into snow or ice, 50:50). After PACKED_SNOW_WEAR
// passes a bare packed-snow wear cell takes a cover of loose SNOW (churned up) or ICE
// (polished), even odds; wet, it churns to snow, never ice
// (the owner's wet table: wet snow turns to slush). The packed base stays under the cover, and the
// existing rules take it from there (wear.ts): the snow packs again (passSnowCell), the ice scrubs
// through to meltwater (scrubCell), the water clears, and the base wears again.
import type { WearCell } from "./types.ts";

// passes before packed snow breaks up; the chance it goes to loose snow (else ice)
const PACKED_SNOW_WEAR = 4, PACKED_TO_SNOW_CHANCE = 0.5;

// on here too, so the headless tools wear the ground as the game does
let enabled = true;

/**
 * Turns packed-snow wear on (?packedwear=1, at start-up).
 * @param isOn true to let packed snow wear to snow or ice
 */
export function setPackedSnowWear(isOn: boolean): void { enabled = isOn; }

/** Whether a bare base is packed snow that wears (with ?packedwear=1). */
export function packedSnowWears(base: string): boolean {
  return enabled && base === 'packedSnow';
}

/**
 * One pass over a bare packed-snow cell: after PACKED_SNOW_WEAR passes it takes a cover of loose
 * snow or ice, even odds.
 * @param cell the wear cell (changed in place)
 * @param wet whether the cell is wet enough to wear as wet ground (then snow, never ice)
 */
export function passPackedSnowCell(cell: WearCell, wet: boolean): void {
  if (++cell.passes < PACKED_SNOW_WEAR) return;
  cell.cover = wet || Math.random() < PACKED_TO_SNOW_CHANCE ? 'snow' : 'ice';
  cell.passes = 0;
  cell.scrub = 0;
}
