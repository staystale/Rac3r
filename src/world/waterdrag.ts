// waterdrag.ts - WATER DRAGGED BY THE TYRES (owner 10-26, ?waterspread=1): standing water a
// wheel drives through spreads the way oil does (oil.ts passOilCell) - a chance per pass that it
// is dragged on; then half the time (owner: "50:50") it runs into the next cell the way the wheel
// was going, and half the time that cell's water is used up (the tyre took it). Each spread is a
// generation weaker (cell.waterGen), so a puddle smears a cell or two along the line and stops.
// Water pushed onto soft ground is a puddle there like any other: the usual rules churn it into
// mud (wear.ts passWetCell). One liquid, one set of rules.
import { getCell, wearDirty, WEAR_CELL } from "./wear.ts";
import { PASS } from "./pass.ts";
import type { WearCell } from "./types.ts";

// the chance a pass drags the water on (oil's DRAG_SPREAD); of those, the share that spreads
// (the rest is used up); the generations a puddle starts with (spreads up to WATER_GEN - 1 times)
const WATER_DRAG = 0.25, WATER_SPREAD_SHARE = 0.5, WATER_GEN = 3;

let dragOn = false;
/**
 * Turns water dragged by the tyres on (?waterspread=1, main.js).
 * @param isOn on or off
 */
export function setWaterSpread(isOn: boolean): void { dragOn = isOn; }

/**
 * Makes a wear cell standing water, a generation weaker than where it came from. Snow, ice, oil
 * and glass keep their cover (oil runs into water by its own rule, oil.ts).
 * @param cell the wear cell, or null
 * @param gen its generation
 */
function waterCell(cell: WearCell | null, gen: number): void {
  if (!cell || cell.fixed) return;
  if (cell.cover === 'wet') {
    cell.waterGen = Math.max(cell.waterGen ?? WATER_GEN, gen);
    return;
  }
  if (cell.cover) return;
  cell.cover = 'wet';
  cell.waterGen = gen;
  cell.standing = true;
  cell.dry = 0;
  cell.scrub = 0;
  cell.passes = 0;
  cell.current = 'wet';
  wearDirty.push(cell);
}

/**
 * A tyre's pass through standing water (wear.ts passCell): by chance it is dragged on - it runs
 * into the next cell the way the wheel was going, or the cell's water is used up.
 * @param cell the water cell
 * @returns true when its water was used up (the pass is over: nothing left to clear)
 */
export function dragWater(cell: WearCell): boolean {
  if (!dragOn || !cell.standing || Math.random() >= WATER_DRAG) return false;
  if (Math.random() >= WATER_SPREAD_SHARE) {
    cell.cover = null;
    cell.waterGen = undefined;
    cell.dry = 0;
    cell.passes = 0;
    cell.current = cell.base;
    wearDirty.push(cell);
    return true;
  }
  const gen = cell.waterGen ?? WATER_GEN, length = Math.hypot(PASS.dx, PASS.dy);
  if (gen <= 1 || length < 1e-6) return false;
  const aheadX = (cell.cx + 0.5) * WEAR_CELL + (PASS.dx / length) * WEAR_CELL;
  const aheadY = (cell.cy + 0.5) * WEAR_CELL + (PASS.dy / length) * WEAR_CELL;
  waterCell(getCell(Math.floor(aheadX / WEAR_CELL), Math.floor(aheadY / WEAR_CELL), true), gen - 1);
  return false;
}
